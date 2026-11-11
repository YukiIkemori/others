"""Raw magenta sheets -> rogue walk sheet and run sheet (384x1024 each, 96x128 frames, foot anchor 48,120), one shared
palette, figure 82 art px tall. Adapted from /home/user/tw/hero/build.py (mode a: uniform resample, palette majority).
  walk / diag raws: 4 rows x 3 cols (stand, L step, R step); rows front, back, left, right / down_left, down_right, up_left, up_right
  run / rundiag raws: 4 rows x 5 cols (stand for scale, run 1..4); same row order
usage: python3 build.py <out_dir> --walk a.png [--diag b.png] [--run c.png] [--rundiag d.png] [--ncol 28]
       [--rows run:2=other.png ...]   (take one row of a sheet from another raw of the same layout)"""
import sys, os, argparse
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools')
import pixlib as P                                            # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('--walk'); ap.add_argument('--diag'); ap.add_argument('--run'); ap.add_argument('--rundiag')
ap.add_argument('--ncol', type=int, default=28); ap.add_argument('--rows', nargs='*', default=[])
ap.add_argument('--lift', type=int, default=3)
ap.add_argument('--keep', nargs='*', default=[], help='hex colours that must be in the palette (e.g. e6d0b8 for the fletchings)')
ap.add_argument('--cols', nargs='*', default=[], help='run:1=3,4,1,2  = raw column order of the 4 frames of one raw row')
ap.add_argument('--swap', nargs='*', default=[], help='diag:2,3  = exchange two raw rows of a sheet (the generator drew them in the other order)')
A = ap.parse_args()
CW, CH, AX, AY = 96, 128, 48, 120
# standing height per raw row (art px). Profiles are drawn a little shorter by the generator (as for the hero: 78 of 80).
ROW_T = {'walk': [82, 82, 81, 81], 'diag': [82, 82, 82, 82], 'run': [82, 82, 81, 81], 'rundiag': [82, 82, 82, 82]}
LEAN = {'run': [0, 0, -4, 4], 'rundiag': [-3, 3, -3, 3]}       # head ahead of the foot anchor in the run rows (art px)
os.makedirs(A.out, exist_ok=True)


def cut(path, rows, cols):
    rgb = np.array(Image.open(path).convert('RGB'))
    H, W = rgb.shape[:2]
    ch, cw = H / rows, W / cols
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    fg = ~((np.minimum(r, b) - g > 60) & (np.abs(r - b) < 90))
    fg = nd.binary_opening(fg, iterations=1)
    spill = (np.minimum(r, b) - g > 28) & nd.binary_dilation(~fg, iterations=3)      # magenta-blended rim pixels
    fg &= ~spill
    lab, n = nd.label(fg, structure=np.ones((3, 3)))
    sizes = nd.sum(fg, lab, range(1, n + 1)); cents = nd.center_of_mass(fg, lab, range(1, n + 1))
    big = {}
    for i, (s, c) in enumerate(zip(sizes, cents)):               # the body of each cell = its biggest component
        key = (min(rows - 1, int(c[0] // ch)), min(cols - 1, int(c[1] // cw)))
        if key not in big or s > big[key][0]:
            big[key] = (s, i + 1)
    cells = {k: lab == i for k, (s, i) in big.items()}
    owner = {i: k for k, (s, i) in big.items()}
    # loose bits (a scarf end, a fletching): join the nearest body if they are close to it, drop the rest
    for i, s in enumerate(sizes):
        if i + 1 in owner or s < 30:
            continue
        m = lab == i + 1
        ys, xs = np.where(m)
        best = None
        for k, bm in cells.items():
            y0, y1, x0, x1 = max(0, ys.min() - 40), ys.max() + 40, max(0, xs.min() - 40), xs.max() + 40
            if bm[y0:y1, x0:x1].any():
                best = k; break
        if best is not None:
            cells[best] = cells[best] | m
    figs = {}
    for key, m in cells.items():
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        figs[key] = (rgb[y0:y1, x0:x1], m[y0:y1, x0:x1])
    assert len(figs) == rows * cols, (path, sorted(figs))
    return figs


def native(figs):
    profs = []
    for sub, m in figs.values():
        profs += list(P.edge_profiles(sub, m))
    p = P.estimate_period(profs, lo=3.0, hi=12.0)[1]
    res = {}
    for k, (sub, m) in figs.items():
        xs, ys, _ = P.fit_grid(sub, m, p_hint=p)
        res[k] = P.sample_grid_avg(sub, m, xs, ys, alpha_min=0.5, dark_L=22.0, dark_frac=0.45, trim=0.3)
    return res, p


def uniform(figs, pal, cell):
    pl = P.srgb_to_lab(pal.astype(np.float64))
    res = {}
    for k, (sub, m) in figs.items():
        h, w = m.shape
        ny = int(round(h / cell)); nx = int(np.ceil(w / cell))
        ys = np.round(h - cell * np.arange(ny, -1, -1)).astype(int).clip(0, h)          # cuts counted from the feet
        off = (w - nx * cell) / 2.0
        xs = np.round(off + cell * np.arange(0, nx + 1)).astype(int).clip(0, w)
        ys, xs = np.unique(ys), np.unique(xs)
        res[k] = P.sample_grid(sub, m, xs, ys, ref_lab=pl, alpha_min=0.5)
    return res


def trim(im):
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def head_box(im, rows=20, need=9):
    """(x0, x1, top): the head = the widest run of columns that are well filled in the top rows (thin bow tips and
    fletchings beside the head do not count)"""
    a = im[..., 3] > 0
    for _ in range(3):
        cnt = a[:rows].sum(0)
        ok = cnt >= need
        lab, n = nd.label(ok)
        if n:
            break
        need -= 2
    sz = nd.sum(ok, lab, range(1, n + 1)); i = int(np.argmax(sz)) + 1
    xs = np.where(lab == i)[0]
    x0, x1 = xs.min(), xs.max()
    top = int(np.where(a[:, x0:x1 + 1].any(1))[0].min())
    if top > 0 and rows == 20:                                   # something thin rises above the head: measure below it
        sub = head_box(im[top:], rows=19)
        return sub[0], sub[1], top + sub[2]
    return int(x0), int(x1), top


def head_shift(ref, rx, im, ix, span=4, rows=22):
    """dx to add to im's head centre so its head lies on ref's head (both given as head-centre columns)"""
    def patch(src, cx, top):
        out = np.zeros((rows, 48, 4), np.int32)
        for y in range(rows):
            for x in range(48):
                sx = cx - 24 + x
                if 0 <= sx < src.shape[1] and top + y < src.shape[0]:
                    out[y, x] = src[top + y, sx]
        return out
    r0 = patch(ref, rx, head_box(ref)[2])
    best, bd = -1, 0
    t = head_box(im)[2]
    for d in sorted(range(-span, span + 1), key=abs):
        p1 = patch(im, ix + d, t)
        both = (r0[..., 3] > 0) & (p1[..., 3] > 0)
        same = both & (np.abs(r0[..., :3] - p1[..., :3]).sum(-1) < 40)
        sc = same.sum() - 0.5 * ((r0[..., 3] > 0) ^ (p1[..., 3] > 0)).sum()
        if sc > best:
            best, bd = sc, d
    return bd


COLS = {}
for spec in A.cols:
    key, v = spec.split('=')
    name, r = key.split(':')
    COLS[(name, int(r))] = [int(c) for c in v.split(',')]
LAY = {'walk': (4, 3), 'diag': (4, 3), 'run': (4, 5), 'rundiag': (4, 5)}
sheets = {}
for name in LAY:
    p = getattr(A, name)
    if p:
        sheets[name] = cut(p, *LAY[name])
for spec in A.rows:                                              # e.g. run:2=raw/r2b.png
    key, p = spec.split('=')
    name, r = key.split(':'); r = int(r)
    alt = cut(p, *LAY[name])
    for c in range(LAY[name][1]):
        sheets[name][(r, c)] = alt[(r, c)]
    print('row', key, 'taken from', p)
for spec in A.swap:                                              # e.g. diag:2,3
    name, v = spec.split(':'); r1, r2 = [int(x) for x in v.split(',')]
    for c in range(LAY[name][1]):
        sheets[name][(r1, c)], sheets[name][(r2, c)] = sheets[name][(r2, c)], sheets[name][(r1, c)]
    print('rows', r1, r2, 'of', name, 'exchanged')
nat = {}
for name, figs in sheets.items():
    nat[name], p = native(figs)
    hs = [figs[(r, 0)][0].shape[0] for r in range(4)]
    print(name, 'drawn pixel size %.2f px; standing figures %s px tall' % (p, hs))
imgs = [trim(v) for d in nat.values() for v in d.values()]
pal = P.build_palette(imgs, k=56, merge_de=2.5)
KEEP = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in A.keep], np.uint8).reshape(-1, 3)
while len(pal) > A.ncol - len(KEEP):
    cnt = np.zeros(len(pal))
    pl = P.srgb_to_lab(pal.astype(np.float64))
    for im in imgs:
        lab = P.srgb_to_lab(im[..., :3][im[..., 3] > 0].astype(np.float64))
        idx = ((lab[:, None] - pl[None]) ** 2).sum(-1).argmin(1)
        cnt += np.bincount(idx, minlength=len(pal))
    d = np.sqrt(((pl[:, None] - pl[None]) ** 2).sum(-1)); np.fill_diagonal(d, 1e9)
    cost = (cnt + 20) ** 0.5 * d.min(1) ** 2          # few pixels AND a close neighbour -> cheap to drop
    pal = np.delete(pal, cost.argmin(), axis=0)
pal = P.sort_palette(np.concatenate([pal, KEEP]).astype(np.uint8)) if len(KEEP) else P.sort_palette(pal)
print('palette', len(pal))

def head_w_raw(m):
    """head width of a standing figure in raw px: median width of the mask run through the head centre, upper head rows"""
    H = m.shape[0]
    ys, xs = np.where(m[int(.02 * H):int(.12 * H)])
    cx = int(np.median(xs))
    ws = []
    for y in range(int(.06 * H), int(.20 * H)):
        row = m[y]
        if not row[cx]:
            continue
        x0 = cx
        while x0 > 0 and row[x0 - 1]:
            x0 -= 1
        x1 = cx
        while x1 < len(row) - 1 and row[x1 + 1]:
            x1 += 1
        ws.append(x1 - x0 + 1)
    return float(np.median(ws))


# the two back diagonals of the run are drawn at different sizes (up-left crouched, up-right upright): meet in the middle
TWEAK = {('rundiag', 2): 1.05, ('rundiag', 3): 0.95, ('run', 0): 1.07}   # and the front run is drawn very squat: a little bigger
frames = {}
REF = {'run': 'walk', 'rundiag': 'diag'}
for name, figs in sheets.items():
    for r in range(4):
        T = float(ROW_T[name][r])
        if name in REF and REF[name] in sheets:
            # the run sheets draw their standing figure with other proportions than the walk sheets: scale each run row
            # so that its HEAD is as big as the head of the same view in the walk sheet (not its body height)
            a, b = sheets[REF[name]][(r, 0)][1], figs[(r, 0)][1]
            ka, kb = head_w_raw(a) / a.shape[0], head_w_raw(b) / b.shape[0]
            f = ka / kb
            print('  %s row %d: head/height walk %.3f run-sheet %.3f -> standing figure of the run sheet scaled to %.1f px' % (name, r, ka, kb, T * f))
            T *= f * TWEAK.get((name, r), 1.0)
        cell = figs[(r, 0)][0].shape[0] / T
        res = uniform({(r, c): figs[(r, c)] for c in range(LAY[name][1])}, pal, cell)
        for k, v in res.items():
            frames[(name,) + k] = P.mode_filter(P.cleanup(P.remap(trim(v), pal), pal), pal, de_max=12.0)   # calms speckle inside a material
np.savez(os.path.join(A.out, 'frames.npz'), pal=pal, **{'%s_%d_%d' % k: v for k, v in frames.items()})

NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
ORDER = [(0, 0), (0, 2), (0, 3), (0, 1), (1, 0), (1, 1), (1, 2), (1, 3)]      # (0 main / 1 diag, raw row)


def assemble(kind):
    """kind 'walk' (sheets walk+diag, cols stand,L,stand,R) or 'run' (sheets run+rundiag, cols run1..4).
    x: the head is the steady point of a row (walk: head centre on the anchor column; run: the landing foot on it).
    y: walk: feet on the anchor line, the head bobs at most 1 px. run: landing frames stand on the line, flight
       frames ride 1-3 px higher with their feet off the line."""
    names = ('walk', 'diag') if kind == 'walk' else ('run', 'rundiag')
    cols = [0, 1, 0, 2] if kind == 'walk' else [1, 2, 3, 4]
    sheet = np.zeros((8 * CH, 4 * CW, 4), np.uint8)
    for R, (s, r) in enumerate(ORDER):
        name = names[s]
        if name not in sheets:
            continue
        cols_r = COLS.get((name, r), cols)
        ims = [frames[(name, r, c)] for c in cols_r]
        hbs = [head_box(im) for im in ims]
        hcs = [int(round((hb[0] + hb[1]) / 2.0)) for hb in hbs]
        for i in range(1, 4):
            if cols_r[i] != cols_r[0]:
                hcs[i] += head_shift(ims[0], hcs[0], ims[i], hcs[i])
        tmax = [AY - (im.shape[0] - 1) + hb[2] for im, hb in zip(ims, hbs)]     # head top with the lowest pixel on the line
        if kind == 'walk':
            lean = 0
            T = tmax[0]
            tops = [int(np.clip(t, T - 1, T + 2)) for t in tmax]
        else:
            offs = []
            for i in (0, 2):                                   # landing frames: where is the planted foot under the head?
                a = ims[i][..., 3] > 0
                xs = np.where(a[-2:].any(0))[0]
                offs.append(hcs[i] - (xs.min() + xs.max()) / 2.0)
            lean = int(np.clip(round(np.mean(offs)), -6, 6)) if not (name == 'run' and r < 2) else 0
            T = int(round((tmax[0] + tmax[2]) / 2.0))
            tops = []
            for i, t in enumerate(tmax):
                if i % 2 == 0:                                 # landing: the foot stays within 1 px of the line
                    tops.append(int(np.clip(T, t - 1, t + 1)))
                else:                                          # flight: head up to 3 px above the landing level, feet off the line
                    tops.append(int(min(np.clip(t - A.lift, T - 3, T + 1), t - 2)))
        info = []
        lo = min(AX + lean - hc for hc in hcs); hi = max(AX + lean - hc + im.shape[1] for im, hc in zip(ims, hcs))
        if lo < 1:
            lean += 1 - lo
        elif hi > CW - 1:
            lean -= hi - (CW - 1)
        for C, (im, hb, hc, top) in enumerate(zip(ims, hbs, hcs, tops)):
            h, w = im.shape[:2]
            a = im[..., 3] > 0
            x0, y0 = AX + lean - hc, top - hb[2]
            assert x0 >= 0 and x0 + w <= CW and y0 >= 0 and y0 + h <= CH, (kind, NAMES[R], C, w, h, hc, x0, y0)
            sheet[R * CH + y0:R * CH + y0 + h, C * CW + x0:C * CW + x0 + w][a] = im[a]
            info.append('x%d w%d h%d top%d foot%d' % (x0, w, h, top, y0 + h - 1))
        print('  %-5s %-10s lean %+d ' % (kind, NAMES[R], lean), info)
    Image.fromarray(sheet).save(os.path.join(A.out, kind + '_raw.png'))
    return sheet


sh = [assemble('walk')]
if 'run' in sheets or 'rundiag' in sheets:
    sh.append(assemble('run'))
allpx = np.concatenate([s[s[..., 3] > 0][:, :3] for s in sh])
print('colours', len(np.unique(allpx, axis=0)))
lab = P.srgb_to_lab(pal.astype(np.float64))
for c, l in zip(pal, lab):
    print('  #%02x%02x%02x L=%.0f a=%.0f b=%.0f' % (c[0], c[1], c[2], l[0], l[1], l[2]))
# contact sheets at 4x on dusk grey for a first look
for s, n in zip(sh, ('walk', 'run')):
    bg = np.zeros_like(s); bg[...] = (70, 62, 84, 255)
    m = s[..., 3] > 0
    bg[m] = s[m]
    im = Image.fromarray(bg)
    two = Image.new('RGBA', (CW * 8, CH * 4))
    two.paste(im.crop((0, 0, CW * 4, CH * 4)), (0, 0)); two.paste(im.crop((0, CH * 4, CW * 4, CH * 8)), (CW * 4, 0))
    two.resize((two.size[0] * 3, two.size[1] * 3), Image.NEAREST).save(os.path.join(A.out, n + '_3x.png'))
