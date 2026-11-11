"""work/final/{walk,run}_raw.png (from build.py) -> the rogue's final sheets:
  dot eyes (1x2, the hero's eye colour), no near-black outline (dark shade of the neighbouring material), the hero's skin
  tones, darker brown hair, bone-white fletchings, small hand repairs, stray pixels removed; then json, preview, gifs.
Adapted from /home/user/tw/hero/finish.py.
usage: python3 finish.py <build dir> <out dir> [--site DIR] [--prev DIR]"""
import sys, os, json, argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools')
import pixlib as P                                            # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('work'); ap.add_argument('out'); ap.add_argument('--site'); ap.add_argument('--prev')
ap.add_argument('--debug', action='store_true')
A = ap.parse_args()
ID = 'rogue'
CW, CH, AX, AY = 96, 128, 48, 120
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
EYES = {'down': 2, 'down_left': 2, 'down_right': 2, 'left': 1, 'right': 1}
HERO = '/home/user/others/chronicle2/twilight/site/hero.png'
MAP = '/home/user/others/chronicle2/twilight/site/map.webp'
os.makedirs(A.out, exist_ok=True)
EYE = np.array([0x22, 0x1a, 0x1e], np.uint8)                 # the hero's eye dots
SKIN_L, SKIN_S = np.array([0xfa, 0xcf, 0xa6], np.uint8), np.array([0xdf, 0x9a, 0x6b], np.uint8)   # the hero's skin
BONE, BONE_S = np.array([0xe2, 0xdb, 0xca], np.uint8), np.array([0xa3, 0x98, 0x86], np.uint8)     # fletchings
SLATE = np.array([0x2b, 0x2a, 0x30], np.uint8)               # outline shade where nothing lighter is near

lab_of = lambda rgb: P.srgb_to_lab(np.asarray(rgb, np.float64).reshape(-1, 1, 3))[:, 0]
N8 = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
N4 = N8[:4]
S3 = np.ones((3, 3), bool)

sheets = {k: np.array(Image.open(os.path.join(A.work, k + '_raw.png')).convert('RGBA')) for k in ('walk', 'run')}
allpx = np.concatenate([s[s[..., 3] > 0][:, :3] for s in sheets.values()])
pal = np.unique(allpx, axis=0)
pal_lab = lab_of(pal)
hexs = lambda c: '#%02x%02x%02x' % tuple(int(v) for v in c)


def is_skin(c):
    r, g, b = [int(v) for v in c]
    return r > 200 and 125 < g < 215 and 70 < b < 175 and r - b > 60 and g - b > 25


def is_cream(c):
    r, g, b = [int(v) for v in c]
    return r > 215 and g > 195 and b > 165 and r - b < 62


SKIN_COLS = [c for c in pal if is_skin(c)]
CREAM_COLS = [c for c in pal if is_cream(c)]
print('skin', [hexs(c) for c in SKIN_COLS], 'cream', [hexs(c) for c in CREAM_COLS])


def mask_of(fr, cols):
    m = np.zeros(fr.shape[:2], bool)
    for c in cols:
        m |= (fr[..., :3] == c).all(-1)
    return m & (fr[..., 3] > 0)


def head_box(a, rows=20, need=9):
    for _ in range(3):
        ys = np.where(a.any(1))[0]
        t0 = ys.min()
        cnt = a[t0:t0 + rows].sum(0)
        ok = cnt >= need
        lab, n = nd.label(ok)
        if n:
            break
        need -= 2
    sz = nd.sum(ok, lab, range(1, n + 1)); i = int(np.argmax(sz)) + 1
    xs = np.where(lab == i)[0]
    x0, x1 = int(xs.min()), int(xs.max())
    top = int(np.where(a[:, x0:x1 + 1].any(1))[0].min())
    if top > t0 and rows == 20:
        b = a.copy(); b[:top] = False
        return head_box(b, rows=19)
    return x0, x1, top


def frames():
    for kind in ('walk', 'run'):
        for R in range(8):
            for C in range(4):
                yield kind, R, C, sheets[kind][R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]


# ------------------------------------------------------------------ 1. small repairs (hand-made, per frame)
def copy_patch(kind, R, src_c, dst_c, box, only_empty=True):
    """copy the pixels of box (x0, y0, x1, y1; frame coords of the source frame) from one frame of a row to another,
    shifted by the difference of the two head positions; by default only where the target is empty"""
    s = sheets[kind][R * CH:(R + 1) * CH, src_c * CW:(src_c + 1) * CW]
    d = sheets[kind][R * CH:(R + 1) * CH, dst_c * CW:(dst_c + 1) * CW]
    hs, hd = head_box(s[..., 3] > 0), head_box(d[..., 3] > 0)
    dx = int(round((hd[0] + hd[1]) / 2.0 - (hs[0] + hs[1]) / 2.0)); dy = hd[2] - hs[2]
    x0, y0, x1, y1 = box
    n = 0
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if s[y, x, 3] and (not only_empty or not d[y + dy, x + dx, 3]):
                d[y + dy, x + dx] = s[y, x]; n += 1
    print('patch %s %s col %d -> col %d: %d px (shift %d,%d)' % (kind, NAMES[R], src_c, dst_c, n, dx, dy))


def erase(kind, R, C, box, cond=None):
    f = sheets[kind][R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]
    x0, y0, x1, y1 = box
    n = 0
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if f[y, x, 3] and (cond is None or cond(f[y, x, :3])):
                f[y, x] = 0; n += 1
    print('erase %s %s col %d: %d px' % (kind, NAMES[R], C, n))


import patches                                                # noqa: E402  (the per-frame repair list lives in patches.py)
patches.apply(copy_patch, erase, sheets, head_box)

# ------------------------------------------------------------------ 2. eyes
def find_eyes(fr, want):
    """-> (spots [(x, y)], blobs [mask], face, hull, skin, L, top). The drawn eye marks are small dark blobs inside the face."""
    a = fr[..., 3] > 0
    x0, x1, top = head_box(a)
    L = P.srgb_to_lab(fr[..., :3].astype(np.float64))[..., 0]
    win = np.zeros(a.shape, bool); win[top + 7:top + 27, max(0, x0 - 3):x1 + 4] = True
    skin = (mask_of(fr, SKIN_COLS) | mask_of(fr, CREAM_COLS)) & win
    lab, n = nd.label(skin, structure=S3)
    if not n:
        return [], [], None, None, skin, L, top
    sz = nd.sum(skin, lab, range(1, n + 1))
    face = lab == (int(np.argmax(sz)) + 1)
    hull = nd.binary_fill_holes(nd.binary_closing(np.pad(face, 4), structure=S3, iterations=3))[4:-4, 4:-4]
    dark = a & (L < 16) & hull & ~face
    dl, dn = nd.label(dark, structure=S3)
    blobs = []
    for i in range(1, dn + 1):
        m = dl == i
        ys, xs = np.where(m)
        ring = nd.binary_dilation(m, structure=S3) & ~m
        fs = (ring & skin).sum() / float(ring.sum())
        if 2 <= m.sum() <= 16 and fs >= 0.25 and ys.max() - ys.min() <= 5:
            blobs.append((m.sum() * (0.5 + fs), m, ys, xs))
    blobs.sort(key=lambda t: -t[0])
    fcx = np.where(face)[1].mean()
    pick = []
    if want == 1 and blobs:
        pick = [blobs[0]]
    elif want == 2:
        best = None
        for i in range(len(blobs)):
            for j in range(i + 1, len(blobs)):
                bi, bj = blobs[i], blobs[j]
                dy = abs(bi[2].mean() - bj[2].mean()); dx = abs(bi[3].mean() - bj[3].mean())
                if dy <= 2.5 and 3.5 <= dx <= 11:
                    sc = bi[0] + bj[0]
                    if best is None or sc > best[0]:
                        best = (sc, bi, bj)
        if best:
            pick = [best[1], best[2]]
    spots = []
    for _, m, ys, xs in pick:
        cnt = {x: (xs == x).sum() for x in np.unique(xs)}
        mx = max(cnt.values())
        cx = min([x for x, v in cnt.items() if v == mx], key=lambda x: abs(x - fcx))
        cy = int(round((ys.min() + ys.max()) / 2.0 - 0.5))
        spots.append([int(cx), cy])
    spots.sort(key=lambda t: t[0])
    if len(spots) == 2:
        spots[0][1] = spots[1][1] = int(round((spots[0][1] + spots[1][1]) / 2.0))
    return spots, [b[1] for b in blobs], face, hull, skin, L, top


eye_log = {}
for kind in ('walk', 'run'):
    for R in range(8):
        want = EYES.get(NAMES[R], 0)
        if not want:
            continue
        fs = [sheets[kind][R * CH:(R + 1) * CH, C * CW:(C + 1) * CW] for C in range(4)]
        found = [find_eyes(fr, want) for fr in fs]
        # one head, one face: the dots sit at the same place of the head in every frame of the row
        # (walk: as in the standing frame; run: the median of the four frames)
        ok = [i for i in range(4) if len(found[i][0]) == want]
        ref = [0] if (kind == 'walk' and 0 in ok) else ok
        rx = [int(round(np.median([found[i][0][k][0] for i in ref]))) for k in range(want)]
        ry = int(round(np.median([found[i][0][0][1] - found[i][6] for i in ref])))
        for C in range(4):
            fr = fs[C]
            spots, blobs, face, hull, skin, L, top = found[C]
            a = fr[..., 3] > 0
            fin = []
            for k in range(want):
                x, y = (spots[k] if len(spots) == want else (rx[k], top + ry))
                if abs(x - rx[k]) > 1:
                    x = rx[k]
                if abs((y - top) - ry) > 1:
                    y = top + ry
                fin.append((x, y))
            if want == 2:
                y = int(round((fin[0][1] + fin[1][1]) / 2.0)); fin = [(fin[0][0], y), (fin[1][0], y)]
            ov = patches.EYE_FIX.get((kind, NAMES[R], C))
            if ov is not None:
                fin = [(x, ov['y']) for x in ov['x']]
            # erase the drawn eye marks that lie at the final dots, then set the dots
            for m in blobs:
                yy, xx = np.where(m)
                if not any(xx.min() - 2 <= x <= xx.max() + 2 and yy.min() - 2 <= y <= yy.max() + 2 for x, y in fin):
                    continue
                semi = a & (L < 27) & hull & ~face             # the softer rim of the eye mark
                gl, _ = nd.label(semi, structure=S3)
                ids = np.unique(gl[m]); ids = ids[ids > 0]
                box = np.zeros(a.shape, bool); box[yy.min() - 1:yy.max() + 2, xx.min() - 1:xx.max() + 2] = True
                grow = m | (np.isin(gl, ids) & box)
                for y, x in zip(*np.where(grow)):
                    nb = [tuple(fr[y + dy, x + dx, :3]) for dy, dx in N8 if 0 <= y + dy < CH and 0 <= x + dx < CW and skin[y + dy, x + dx]]
                    if nb:
                        vals, cn = np.unique(np.array(nb), axis=0, return_counts=True)
                        fr[y, x, :3] = vals[cn.argmax()]
                    else:
                        fr[y, x, :3] = SKIN_COLS[-1]
            for x, y in fin:
                fr[y:y + 2, x, :3] = EYE
                fr[y:y + 2, x, 3] = 254                         # marks the eye dots for the later passes (reset at the end)
            if face is not None:                                # no cream highlight inside the face
                cr = mask_of(fr, CREAM_COLS) & hull
                fr[cr, :3] = SKIN_COLS[-1]
            eye_log[(kind, R, C)] = fin
            if len(spots) != want:
                print('eyes set from the row', kind, NAMES[R], C, 'found', len(spots), 'of', want)

# ------------------------------------------------------------------ 3. outline: near-black -> dark shade of the material beside it
for kind, R, C, fr in frames():
    a = fr[..., 3] > 0
    if not a.any():
        continue
    iseye = fr[..., 3] == 254
    for it in range(4):
        L = P.srgb_to_lab(fr[..., :3].astype(np.float64))
        dark = a & (L[..., 0] < 13.5) & ~iseye
        if not dark.any():
            break
        src = fr.copy()
        for y, x in zip(*np.where(dark)):
            cand = [L[y + dy, x + dx] for dy, dx in N8
                    if 0 <= y + dy < CH and 0 <= x + dx < CW and a[y + dy, x + dx] and not dark[y + dy, x + dx] and not iseye[y + dy, x + dx]]
            if not cand:
                if it == 3:
                    fr[y, x, :3] = SLATE
                continue
            base = min(cand, key=lambda c: c[0])
            t = np.array([max(15.0, base[0] * 0.55), base[1] * 0.9, base[2] * 0.9])
            ok = pal_lab[:, 0] >= 14.5
            d = ((pal_lab - t) ** 2).sum(1); d[~ok] = 1e9
            fr[y, x, :3] = pal[d.argmin()] if d.min() < 160 else SLATE

# ------------------------------------------------------------------ 4. fletchings: bone white, not skin pink
for kind, R, C, fr in frames():
    a = fr[..., 3] > 0
    cream = mask_of(fr, CREAM_COLS)
    lab, n = nd.label(nd.binary_dilation(cream, structure=S3), structure=S3)
    for i in range(1, n + 1):
        reg = lab == i
        core = reg & cream
        ys, xs = np.where(core)
        if core.sum() < 5 or (xs.max() - xs.min() > 9 and ys.max() - ys.min() > 9):      # the bow string is a long thin line
            continue
        if (nd.binary_dilation(core, structure=S3, iterations=2) & (fr[..., 3] == 254)).any():   # beside an eye: face, not feathers
            continue
        box = np.zeros(a.shape, bool); box[ys.min():ys.max() + 1, xs.min():xs.max() + 1] = True
        for y, x in zip(*np.where(box & a & ~core)):
            nc = sum(1 for dy, dx in N4 if 0 <= y + dy < CH and 0 <= x + dx < CW and core[y + dy, x + dx])
            c = fr[y, x, :3]
            if nc >= 2 and (is_skin(c) or (int(c[0]) - int(c[2]) > 45 and int(c[0]) > 90)):   # skin / rust lines between feathers
                fr[y, x, :3] = BONE if is_skin(c) and int(c[1]) > 185 else BONE_S
        fr[core, :3] = BONE

# ------------------------------------------------------------------ 5. the hero's skin tones
if SKIN_COLS:
    sl = sorted(SKIN_COLS, key=lambda c: -int(c[1]))
    for s in sheets.values():
        al = s[..., 3] > 0
        for i, c in enumerate(sl):
            s[(s[..., :3] == c).all(-1) & al, :3] = SKIN_L if i == 0 else SKIN_S

# ------------------------------------------------------------------ 6. hair: dark brown (each brown of the head -> a darker brown of the palette)
def is_brown(c):
    l, a_, b_ = lab_of(c)[0]
    return 10 < l < 50 and 4.5 < a_ < 28 and 6 < b_ < 40 and b_ / a_ < 2.3 and not (a_ > 20 and b_ < 16)   # not the ochre band, not the rust scarf


browns = [c for c in np.unique(np.concatenate([s[s[..., 3] > 0][:, :3] for s in sheets.values()]), axis=0) if is_brown(c)]
bl = lab_of(np.array(browns))
HMAP = {}
for c, l in zip(browns, bl):
    t = np.array([l[0] * (0.74 if l[0] <= 42 else 0.62), l[1] * 0.85, l[2] * 0.78])     # the lightest locks come down furthest
    d = ((bl - t) ** 2).sum(1)
    HMAP[tuple(c)] = browns[int(d.argmin())] if l[0] > 19 else c
print('hair map', {hexs(k): hexs(v) for k, v in HMAP.items()})
for kind, R, C, fr in frames():
    a = fr[..., 3] > 0
    if not a.any():
        continue
    x0, x1, top = head_box(a)
    hairc = np.zeros(a.shape, bool)
    for c in browns:
        hairc |= (fr[..., :3] == c).all(-1)
    hairc &= a
    bound = np.zeros(a.shape, bool); bound[top:top + 28, max(0, x0 - 9):x1 + 10] = True
    seed = np.zeros(a.shape, bool); seed[top:top + 10, x0 + 2:x1 - 1] = True
    lab, n = nd.label(hairc & bound, structure=S3)
    ids = np.unique(lab[seed & hairc]); ids = ids[ids > 0]
    hair = np.isin(lab, ids)
    src = fr.copy()
    for c, t in HMAP.items():
        fr[hair & (src[..., :3] == np.array(c, np.uint8)).all(-1), :3] = t

# ------------------------------------------------------------------ 7. stray pixels, eye marks back to opaque
for kind, R, C, fr in frames():
    a = fr[..., 3] > 0
    lab, n = nd.label(a, structure=S3)
    if n > 1:
        sz = nd.sum(a, lab, range(1, n + 1))
        for i, s in enumerate(sz):
            if s < 8:
                fr[lab == i + 1] = 0
    for it in range(2):                                        # single pixels sticking out of the silhouette
        a = fr[..., 3] > 0
        nb = sum(np.roll(np.roll(a, dy, 0), dx, 1) for dy, dx in N8)
        fr[a & (nb <= 1)] = 0
    fr[..., 3][fr[..., 3] > 0] = 255

# ------------------------------------------------------------------ checks + save
rep = []
for kind, s in sheets.items():
    al = s[..., 3] > 0
    px = s[al][:, :3].astype(int)
    L = lab_of(np.unique(px, axis=0))[:, 0]
    mag = ((np.minimum(px[:, 0], px[:, 2]) - px[:, 1]) > 40).sum()
    dark = np.unique(px, axis=0)[L < 13.5]
    rep.append('%s: %d colours, magenta-ish px %d, colours darker than L 13.5: %s' % (kind, len(np.unique(px, axis=0)), mag, [hexs(c) for c in dark]))
    for R in range(8):
        hs, ft, tp = [], [], []
        for C in range(4):
            a = s[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW, 3] > 0
            ys, xs = np.where(a)
            hs.append(int(ys.max() - ys.min() + 1)); ft.append(int(ys.max())); tp.append(head_box(a)[2])
            assert xs.min() >= 1 and xs.max() <= CW - 2 and ys.min() >= 1, (kind, R, C)
        rep.append('  %-5s %-10s height %s foot y %s head top %s eyes %s' % (kind, NAMES[R], hs, ft, tp, [eye_log.get((kind, R, C), []) for C in range(4)]))
tot = np.unique(np.concatenate([s[s[..., 3] > 0][:, :3] for s in sheets.values()]), axis=0)
rep.append('both sheets together: %d colours' % len(tot))
open(os.path.join(A.out, 'report.txt'), 'w').write('\n'.join(rep) + '\n')
print('\n'.join(rep))
Image.fromarray(sheets['walk']).save(os.path.join(A.out, ID + '.png'))
Image.fromarray(sheets['run']).save(os.path.join(A.out, ID + '_run.png'))
spec = {'frame': [CW, CH], 'foot': [AX, AY], 'body': 82, 'ms': 170, 'run': {'src': ID + '_run.png', 'cols': 4, 'ms': 105}}
json.dump(spec, open(os.path.join(A.out, ID + '.json'), 'w'))
if A.site:
    os.makedirs(A.site, exist_ok=True)
    for n in (ID + '.png', ID + '_run.png', ID + '.json'):
        open(os.path.join(A.site, n), 'wb').write(open(os.path.join(A.out, n), 'rb').read())
    print('site files written to', A.site)
