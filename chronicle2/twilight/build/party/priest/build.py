"""Raw magenta sheets of the priestess -> walk sheet and run sheet (384x1024 each, 96x128 frames, foot anchor 48,120),
figure 76 art px tall, one shared palette.
  walk raws: main 4x3 (down, up, left, right) and diag 4x3 (down_left, down_right, up_left, up_right); cols stand, L, R
  run raws:  main 4x4 and diag 4x4, same row order; cols L lands, air, R lands, air
usage: python3 build.py <walk_main> <walk_diag> <run_main> <run_diag> <out_dir> [ncolors] [tune.json]
a raw argument may also be 4 comma-separated 'path:row' entries (rows taken from different raws).
tune.json (optional): {"walk_h": {"main": [..4], "diag": [..4]}, "run_k": {"main": [..4], "diag": [..4]},
                       "run_off": {...}, "lift": {...}}"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
TOOLS = '/home/user/others/chronicle/design/sprite_pipe/tools'
sys.path.insert(0, TOOLS)
import pixlib as P
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shape
walk_main, walk_diag, run_main, run_diag, out = sys.argv[1:6]
NCOL = int(sys.argv[6]) if len(sys.argv) > 6 else 26
tune = json.load(open(sys.argv[7])) if len(sys.argv) > 7 else {}
TARGET = 76
CW, CH, AX, AY = 96, 128, 48, 120
os.makedirs(out, exist_ok=True)


def cut(path, rows, cols):
    rgb = np.array(Image.open(path).convert('RGB'))
    H, W = rgb.shape[:2]
    ch = 700.0; cw = 644.0                                   # the guide's cells
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    cast = np.minimum(r, b) - g
    fg = ~((cast > 80) & (r > 150) & (b > 150))
    fg = nd.binary_opening(fg, iterations=1)
    spill = (cast > 58) & nd.binary_dilation(~fg, iterations=3)          # magenta-blended rim pixels
    fg &= ~spill
    lab, n = nd.label(fg, structure=np.ones((3, 3)))
    sizes = nd.sum(fg, lab, range(1, n + 1)); cents = nd.center_of_mass(fg, lab, range(1, n + 1))
    big = [(s, c, i + 1) for i, (s, c) in enumerate(zip(sizes, cents)) if s >= 4000]
    # cells from the big components themselves (the generator does not always keep the guide's cells)
    ysort = sorted(big, key=lambda t: t[1][0])
    assert len(big) == rows * cols, (path, len(big))
    cells = {}
    centre = {}
    for r_ in range(rows):
        rowc = sorted(ysort[r_ * cols:(r_ + 1) * cols], key=lambda t: t[1][1])
        for c_, (s, c, i) in enumerate(rowc):
            cells[(r_, c_)] = lab == i
            centre[(r_, c_)] = c
    for i, (s, c) in enumerate(zip(sizes, cents)):           # small detached bits join the nearest figure
        if s < 40 or s >= 4000:
            continue
        k = min(centre, key=lambda k: (centre[k][0] - c[0]) ** 2 + (centre[k][1] - c[1]) ** 2)
        d = nd.distance_transform_edt(~cells[k])
        if d[lab == i + 1].min() < 30:
            cells[k] |= lab == i + 1
    figs = {}
    for key, m in cells.items():
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        figs[key] = (rgb[y0:y1, x0:x1], m[y0:y1, x0:x1], (y0, x0))
    return figs


def body_span(m, cell):
    """top of the hair and sole line of the body in a raw crop (staff excluded)"""
    return shape.span_raw(m, cell)


def native(figs):
    profs = []
    for sub, m, _ in figs.values():
        profs += list(P.edge_profiles(sub, m))
    p = P.estimate_period(profs, lo=3.0, hi=12.0)[1]
    res = {}
    for k, (sub, m, _) in figs.items():
        xs, ys, _g = P.fit_grid(sub, m, p_hint=p)
        res[k] = P.sample_grid_avg(sub, m, xs, ys, alpha_min=0.5, dark_L=22.0, dark_frac=0.45, trim=0.3)
    return res, p


def uniform(fig, pal_lab, cell, y_feet):
    """sample one figure on a uniform grid of `cell` px; rows are counted from y_feet (the sole line, in the crop)"""
    sub, m, _ = fig
    h, w = m.shape
    n_up = int(np.ceil(y_feet / cell)); n_dn = int(np.ceil((h - y_feet) / cell))
    ys = np.round(y_feet + cell * np.arange(-n_up, n_dn + 1)).astype(int).clip(0, h)
    nx = int(np.ceil(w / cell)); off = (w - nx * cell) / 2.0
    xs = np.round(off + cell * np.arange(0, nx + 1)).astype(int).clip(0, w)
    ys, xs = np.unique(ys), np.unique(xs)
    im = P.sample_grid(sub, m, xs, ys, ref_lab=pal_lab, alpha_min=0.5)
    feet_row = int(np.searchsorted(ys, y_feet))               # art row index of the sole line (exclusive bottom)
    return im, feet_row


def trim(im):
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1], ys.min(), xs.min()


_cache = {}


def load(spec, cols):
    """spec: one raw path, or 4 comma-separated 'path:row' entries (rows taken from different raws)"""
    def one(p):
        if p not in _cache:
            _cache[p] = cut(p, int(round(Image.open(p).size[1] / 700.0)), cols)
        return _cache[p]
    if ',' not in spec:
        return one(spec)
    figs = {}
    for r, ent in enumerate(spec.split(',')):
        p, sr = ent.rsplit(':', 1)
        for c in range(cols):
            figs[(r, c)] = one(p)[(int(sr), c)]
    return figs


sheets = {'walk_main': load(walk_main, 3), 'walk_diag': load(walk_diag, 3),
          'run_main': load(run_main, 4), 'run_diag': load(run_diag, 4)}
nat = {}; dot = {}
for name, figs in sheets.items():
    nat[name], dot[name] = native(figs)
    print(name, 'drawn pixel size %.2f px' % dot[name])
imgs = [trim(v)[0] for d in nat.values() for v in d.values()]
pal = P.build_palette(imgs, k=48, merge_de=2.5)
while len(pal) > NCOL:
    cnt = np.zeros(len(pal))
    pl = P.srgb_to_lab(pal.astype(np.float64))
    for im in imgs:
        lab = P.srgb_to_lab(im[..., :3][im[..., 3] > 0].astype(np.float64))
        idx = ((lab[:, None] - pl[None]) ** 2).sum(-1).argmin(1)
        cnt += np.bincount(idx, minlength=len(pal))
    d = np.sqrt(((pl[:, None] - pl[None]) ** 2).sum(-1)); np.fill_diagonal(d, 1e9)
    cost = (cnt + 20) ** 0.5 * d.min(1) ** 2
    pal = np.delete(pal, cost.argmin(), axis=0)
pal = P.sort_palette(pal)
pal_lab = P.srgb_to_lab(pal.astype(np.float64))
print('palette', len(pal))

# ---- scale: raw px per art px, per row. Walk: the standing body (staff excluded) becomes walk_h art px.
WALK_H = tune.get('walk_h', {'main': [76, 76, 76, 76], 'diag': [76, 76, 76, 76]})
RUN_K = tune.get('run_k', {'main': [1, 1, 1, 1], 'diag': [1, 1, 1, 1]})        # run cell = walk cell of that direction * k
RUN_OFF = tune.get('run_off', {'main': [None] * 4, 'diag': [None] * 4})    # head centre minus anchor, art px (None: measured)
LIFT = tune.get('lift', {'main': [None] * 4, 'diag': [None] * 4})
cellpx = {}
for kind in ('main', 'diag'):
    figs = sheets['walk_' + kind]
    for r in range(4):
        sub, m, _ = figs[(r, 0)]
        t, b = body_span(m, 6.0)
        cellpx[('walk_' + kind, r)] = (b - t) / float(WALK_H[kind][r])
        cellpx[('run_' + kind, r)] = cellpx[('walk_' + kind, r)] * RUN_K[kind][r]
        print('walk_%s row %d: standing body %d px -> cell %.2f' % (kind, r, b - t, cellpx[('walk_' + kind, r)]))

frames = {}; meta = {}
for name, figs in sheets.items():
    cols = 3 if name.startswith('walk') else 4
    for r in range(4):
        cell = cellpx[(name, r)]
        for c in range(cols):
            sub, m, (y0, x0) = figs[(r, c)]
            t, b = body_span(m, cell)                        # sole line of the body (staff butt excluded)
            im, feet_row = uniform(figs[(r, c)], pal_lab, cell, b)
            im = P.cleanup(P.remap(im, pal), pal)
            im, ty, tx = trim(im)
            frames[(name, r, c)] = im
            meta[(name, r, c)] = dict(feet=shape.sole(im[..., 3] > 0), sole_y=y0 + b, top_y=y0 + t, cell=cell)   # feet: row under the soles, measured
np.savez(os.path.join(out, 'frames.npz'), pal=pal, **{'%s_%d_%d' % k: v for k, v in frames.items()})


def head_centre(im, feet):
    """x centre of the head and the top row of the hair (staff excluded)"""
    top, cx = shape.head(im[..., 3] > 0)
    return cx, top


def low_centre(im, feet):
    b = shape.open_disc(im[..., 3] > 0, 2.2)
    xs = np.where(b[max(0, feet - 14):feet].any(0))[0]
    return (xs.min() + xs.max()) / 2.0


NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
SRC = [('main', 0), ('main', 2), ('main', 3), ('main', 1), ('diag', 0), ('diag', 1), ('diag', 2), ('diag', 3)]
report = {}
for sheetname, colmap in (('walk', [0, 1, 0, 2]), ('run', [0, 1, 2, 3])):
    sheet = np.zeros((8 * CH, 4 * CW, 4), np.uint8)
    for R, (kind, r) in enumerate(SRC):
        name = '%s_%s' % (sheetname, kind)
        ims = [frames[(name, r, c)] for c in colmap]
        mts = [meta[(name, r, c)] for c in colmap]
        hc = [head_centre(im, mt['feet']) for im, mt in zip(ims, mts)]
        if sheetname == 'run':
            # the hips, not the leaning head, sit on the anchor: one constant head offset for the row
            off = np.mean([h[0] - low_centre(im, mt['feet']) for h, im, mt in zip(hc, ims, mts)])
            off = int(round(off)) if RUN_OFF[kind][r] is None else RUN_OFF[kind][r]
            ground = max(mts[0]['sole_y'], mts[2]['sole_y'])
            lifts = []
            for C, mt in enumerate(mts):
                if C in (0, 2):
                    lifts.append(0)
                else:
                    lf = LIFT[kind][r]
                    if lf is None:
                        lf = int(round((ground - mt['sole_y']) / mt['cell']))
                        lf = min(4, max(2, lf))
                    lifts.append(lf)
        else:
            off = 0; lifts = [0, 0, 0, 0]
        row = []
        for C, (im, mt) in enumerate(zip(ims, mts)):
            h, w = im.shape[:2]
            a = im[..., 3] > 0
            x0 = C * CW + AX + off - int(round(hc[C][0]))
            y0 = R * CH + AY + 1 - lifts[C] - mt['feet']          # the lowest sole row sits on row AY, as in the hero sheet
            assert x0 >= C * CW and x0 + w <= (C + 1) * CW and y0 >= R * CH and y0 + h <= (R + 1) * CH, (sheetname, NAMES[R], C, w, h, x0 - C * CW, y0 - R * CH)
            sheet[y0:y0 + h, x0:x0 + w][a] = im[a]
            row.append(dict(x=x0 - C * CW, y=y0 - R * CH, w=w, h=h, body_h=mt['feet'] - hc[C][1], lift=lifts[C]))
        report[(sheetname, NAMES[R])] = row
        print(sheetname, NAMES[R], 'head off', off, [(d['body_h'], d['lift']) for d in row])
    Image.fromarray(sheet).save(os.path.join(out, '%s_raw.png' % sheetname))
    print(sheetname, len(np.unique(sheet[sheet[..., 3] > 0][:, :3], axis=0)), 'colours')
lab = P.srgb_to_lab(pal.astype(np.float64))
for c, l in zip(pal, lab):
    print('  #%02x%02x%02x L=%.0f' % (c[0], c[1], c[2], l[0]))
