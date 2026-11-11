"""Run raw sheets (4 rows x 5 cols: col 0 standing, cols 1-4 run frames; main rows down, up, left, right; diag rows
down_left, down_right, up_left, up_right) -> hero_run.png 384x1024 (96x128 frames, foot anchor 48,120), on the WALK sheet's
28-colour palette. Same steps as the walk: build.py (cut, uniform resample at standing height / 80, palette) and
finish.py (dot eyes, own-colour outline, muted wine, lantern table).
usage: python3 build_run.py <main_raw.png> <diag_raw.png> <out_dir> [pick.json]
  pick.json (optional): {"down": ["raw.png", raw_row], ...} takes single rows from other raw sheets."""
import sys, os, json, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools')
import pixlib as P

main_p, diag_p, out = sys.argv[1:4]
pick = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}
os.makedirs(out, exist_ok=True)
CW, CH, AX, AY = 96, 128, 48, 120
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
SRC = {'down': ('main', 0), 'left': ('main', 2), 'right': ('main', 3), 'up': ('main', 1),
       'down_left': ('diag', 0), 'down_right': ('diag', 1), 'up_left': ('diag', 2), 'up_right': ('diag', 3)}
STAND_T = {'down': 80, 'up': 80, 'left': 78, 'right': 78, 'down_left': 80, 'down_right': 80, 'up_left': 80, 'up_right': 80}
COL_C = [240, 780, 1380, 1980, 2580]          # cell centres of the guide
WALK = '/home/user/others/chronicle2/twilight/site/hero.png'
BUILD_PAL = np.load('/home/user/tw/hero/work/frames.npz')['pal']      # the walk's palette before finish.py
walk = np.array(Image.open(WALK).convert('RGBA'))
WPAL = np.unique(walk[walk[..., 3] > 0][:, :3], axis=0)               # the walk's final 28 colours
WPAL_LAB = P.srgb_to_lab(WPAL.astype(np.float64))
L = lambda rgb: P.srgb_to_lab(np.asarray(rgb, np.float64).reshape(1, 1, 3))[0, 0]


def cut(path, rows=4):
    rgb = np.array(Image.open(path).convert('RGB'))
    H, W = rgb.shape[:2]
    ch = H / rows
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    fg = ~((np.minimum(r, b) - g > 60) & (np.abs(r - b) < 90))
    fg = nd.binary_opening(fg, iterations=1)
    spill = (np.minimum(r, b) - g > 28) & nd.binary_dilation(~fg, iterations=3)      # magenta-blended rim pixels
    fg &= ~spill
    lab, n = nd.label(fg, structure=np.ones((3, 3)))
    sizes = nd.sum(fg, lab, range(1, n + 1)); cents = nd.center_of_mass(fg, lab, range(1, n + 1))
    big = [(i, s, c) for i, (s, c) in enumerate(zip(sizes, cents)) if s >= 3000]
    cells = {}
    for i, s, c in big:                        # bodies first
        key = (min(rows - 1, int(c[0] // ch)), int(np.argmin([abs(c[1] - x) for x in COL_C])))
        cells.setdefault(key, np.zeros_like(fg)); cells[key] |= lab == i + 1
    for i, (s, c) in enumerate(zip(sizes, cents)):       # loose bits (a lantern on its chain, a cape tip) join the nearest body
        if s < 40 or s >= 3000:
            continue
        m = lab == i + 1
        best = min(cells, key=lambda k: nd.distance_transform_edt(~cells[k])[m].min())
        if nd.distance_transform_edt(~cells[best])[m].min() < 40:
            cells[best] |= m
    figs = {}
    for key, m in cells.items():
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        figs[key] = (rgb[y0:y1, x0:x1], m[y0:y1, x0:x1])
    assert len(figs) == rows * 5, sorted(figs)
    return figs


def uniform_one(sub, m, pal, cell):
    pl = P.srgb_to_lab(pal.astype(np.float64))
    h, w = m.shape
    ny = int(round(h / cell)); nx = int(np.ceil(w / cell))
    ys = np.round(h - cell * np.arange(ny, -1, -1)).astype(int).clip(0, h)          # cuts counted from the feet
    off = (w - nx * cell) / 2.0
    xs = np.round(off + cell * np.arange(0, nx + 1)).astype(int).clip(0, w)
    ys, xs = np.unique(ys), np.unique(xs)
    return P.sample_grid(sub, m, xs, ys, ref_lab=pl, alpha_min=0.5)


def trim(im):
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


cache = {}
def sheet_of(path):
    if path not in cache:
        cache[path] = cut(path)
    return cache[path]

frames = {}
log = []
for name in NAMES:
    kind, r = SRC[name]
    path = {'main': main_p, 'diag': diag_p}[kind]
    if name in pick:
        path, r = pick[name]
    figs = sheet_of(path)
    cell = figs[(r, 0)][0].shape[0] / float(STAND_T[name])
    for c in range(5):
        sub, m = figs[(r, c)]
        v = uniform_one(sub, m, BUILD_PAL, cell)
        frames[(name, c)] = P.cleanup(P.remap(trim(v), BUILD_PAL), BUILD_PAL)
    log.append('%-10s %s row %d: standing %d px -> cell %.2f px; heights stand %d, run %s' % (
        name, os.path.basename(path), r, figs[(r, 0)][0].shape[0], cell, frames[(name, 0)].shape[0],
        [frames[(name, c)].shape[0] for c in range(1, 5)]))
np.savez(os.path.join(out, 'frames_run.npz'), pal=BUILD_PAL, **{'%s_%d' % k: v for k, v in frames.items()})

# ---- sheet: rows as the walk sheet; cols: left foot lands, flight, right foot lands, flight
def head_cx(im):
    """centre column of the head: the blob of the top 11 rows that holds the topmost pixel (a flying cape tip is ignored)"""
    a = im[..., 3] > 0
    lab, n = nd.label(a[:11], structure=np.ones((3, 3)))
    k = lab[0][np.where(a[0])[0][0]]
    xs = np.where((lab == k).any(0))[0]
    return int(round((xs.min() + xs.max()) / 2.0)), int(xs.max() - xs.min() + 1)


def legs_cx(im):
    a = im[..., 3] > 0
    return np.where(a[a.shape[0] - 26:])[1].mean()


sheet = np.zeros((8 * CH, 4 * CW, 4), np.uint8)
place = {}
LEAN = {}
LEAD = {}
for R, name in enumerate(NAMES):
    hc = np.mean([frames[(name, c)].shape[0] for c in (1, 3)])
    # how far the head runs ahead of the legs (median of the cycle); the anchor sits under the body, 0.7 of that behind the head
    lead = float(np.median([head_cx(frames[(name, c)])[0] - legs_cx(frames[(name, c)]) for c in range(1, 5)]))
    LEAN[name] = 0 if name in ('down', 'up') else int(round(0.7 * lead))
    LEAD[name] = lead
    for C in range(4):
        im = frames[(name, C + 1)]
        h, w = im.shape[:2]
        a = im[..., 3] > 0
        hx, hw = head_cx(im)
        lift = 0 if C in (0, 2) else int(np.clip(round(hc - h + 2), 2, 8))      # flight: off the ground, head about 2 px above the contact frames
        x0, y0 = C * CW + AX + LEAN[name] - hx, R * CH + AY - lift - (h - 1)
        assert x0 >= C * CW and x0 + w <= (C + 1) * CW and y0 >= R * CH, (name, C, w, h, hx, x0 - C * CW)
        sheet[y0:y0 + h, x0:x0 + w][a] = im[a]
        place[(R, C)] = (x0 - C * CW, y0 - R * CH, w, h, lift)
    log.append('  %s head lead %.1f -> head at anchor%+d; head width stand %d, run %s; place %s' % (
        name, lead, LEAN[name], head_cx(frames[(name, 0)])[1], [head_cx(frames[(name, c)])[1] for c in range(1, 5)],
        [place[(R, C)] for C in range(4)]))
Image.fromarray(sheet).save(os.path.join(out, 'run_sheet_raw.png'))

# ================= finish (as finish.py of the walk) =================
alpha = sheet[..., 3] > 0
pal = np.unique(sheet[alpha][:, :3], axis=0)
pal_lab = P.srgb_to_lab(pal.astype(np.float64))
EYE = np.array([34, 26, 30], np.uint8)
INDIGO = np.array([40, 36, 48], np.uint8)
SKIN = np.array([250, 207, 166], np.uint8)


def is_skin(c):
    r, g, b = [int(v) for v in c]
    return r > 200 and g > 140 and b > 90 and r - b > 50 and g - b > 15


def is_dark(c):
    return L(c)[0] < 12.5

N8 = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
eye_log = {}
for R in range(8):
    sp_row = None
    for C in range(4):
        fr = sheet[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]
        a = fr[..., 3] > 0
        top = np.where(a.any(1))[0].min()
        dark = np.zeros(a.shape, bool); skin = np.zeros(a.shape, bool)
        for y, x in zip(*np.where(a)):
            dark[y, x] = is_dark(fr[y, x, :3]); skin[y, x] = is_skin(fr[y, x, :3])
        lab, n = nd.label(dark, structure=np.ones((3, 3)))
        outside = nd.binary_dilation(~a, structure=np.ones((3, 3)))
        eyes = []
        want = {'down': 2, 'down_left': 2, 'down_right': 2, 'left': 1, 'right': 1}.get(NAMES[R], 0)
        for i in range(1, n + 1):
            m = lab == i
            yy, xx = np.where(m)
            if yy.min() < top + 9 or yy.max() > top + 25 or m.sum() > 14 or (m & outside).any():
                continue
            ring = nd.binary_dilation(m, structure=np.ones((3, 3))) & ~m
            frac = (ring & skin).sum() / float(ring.sum())
            if frac >= 0.3:
                eyes.append((frac, m))
        eyes = [m for f, m in sorted(eyes, key=lambda t: -t[0])[:want]]
        keep = np.zeros(a.shape, bool)
        Lf = P.srgb_to_lab(fr[..., :3].astype(np.float64))[..., 0]
        semi = a & (Lf < 24)
        spots = []
        for m in eyes:
            yy, xx = np.where(m)
            win = np.zeros(a.shape, bool)
            win[yy.min():yy.max() + 4, max(0, xx.min() - 1):xx.max() + 2] = True
            lab2, _ = nd.label(semi & win, structure=np.ones((3, 3)))
            ids = np.unique(lab2[m]); ids = ids[ids > 0]
            reg = np.isin(lab2, ids) & ~outside
            ry, rx = np.where(reg)
            low = {x: ry[rx == x].max() for x in np.unique(rx)}
            mx = max(low.values())
            cand = [x for x, v in low.items() if v == mx]
            cx = min(cand, key=lambda x: abs(x - (AX + LEAN[NAMES[R]])))
            cy = int(round((ry.min() + ry.max()) / 2.0))
            spots.append((cx, cy, reg))
        if len(spots) == 2:                                   # both eyes on the same rows, same spacing in the whole row
            cy = int(round((spots[0][1] + spots[1][1]) / 2.0))
            spots = sorted([(x, cy, r) for x, _, r in spots], key=lambda t: t[0])
            if sp_row is None:
                sp_row = spots[1][0] - spots[0][0]
            else:
                mid = (spots[0][0] + spots[1][0]) / 2.0
                x1 = int(round(mid - sp_row / 2.0))
                spots = [(x1, cy, spots[0][2]), (x1 + sp_row, cy, spots[1][2])]
        for cx, cy, reg in spots:
            for y, x in zip(*np.where(reg)):
                nb = [tuple(fr[y + dy, x + dx, :3]) for dy, dx in N8
                      if 0 <= y + dy < CH and 0 <= x + dx < CW and a[y + dy, x + dx] and not reg[y + dy, x + dx] and is_skin(fr[y + dy, x + dx, :3])]
                if nb:
                    vals, cn = np.unique(np.array(nb), axis=0, return_counts=True)
                    fr[y, x, :3] = vals[cn.argmax()]
                else:
                    fr[y, x, :3] = SKIN
                dark[y, x] = False
            for y in range(cy, cy + 2):
                keep[y, cx] = True
        fr[keep, :3] = EYE
        eye_log[NAMES[R] + str(C)] = '%d/%d' % (len(eyes), want)
        rest = dark & ~keep                     # outline: near-black pixels take a dark shade of the material they border
        src = fr.copy()
        for y, x in zip(*np.where(rest)):
            cand = []
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < CH and 0 <= xx < CW and a[yy, xx] and not dark[yy, xx]:
                    cand.append(src[yy, xx, :3])
            if not cand:
                fr[y, x, :3] = INDIGO; continue
            cl = [L(c) for c in cand]
            base = cl[int(np.argmin([c[0] for c in cl]))]
            if base[0] < 36 and abs(base[1]) < 9 and base[2] < 9:      # charcoal / indigo cloth
                fr[y, x, :3] = INDIGO; continue
            t = np.array([max(15.0, base[0] * 0.55), base[1] * 0.9, base[2] * 0.9])
            ok = pal_lab[:, 0] >= 14
            d = ((pal_lab - t) ** 2).sum(1); d[~ok] = 1e9
            fr[y, x, :3] = pal[d.argmin()]
log.append('eyes found/wanted: %s' % eye_log)

# mute the wine reds exactly as finish.py does
alpha = sheet[..., 3] > 0
for c in np.unique(sheet[alpha][:, :3], axis=0):
    h, s, v = colorsys.rgb_to_hsv(*(c / 255.0))
    if (h > 0.93 or h < 0.02) and s > 0.45:
        n = np.array(colorsys.hsv_to_rgb(h, s * 0.78, v * 0.95)) * 255
        sheet[(sheet[..., :3] == c).all(-1) & alpha, :3] = np.round(n).astype(np.uint8)

# snap onto the walk sheet's palette (anything still outside it -> nearest walk colour)
cols = np.unique(sheet[alpha][:, :3], axis=0)
stray = [c for c in cols if not (WPAL == c).all(1).any()]
for c in stray:
    k = ((WPAL_LAB - L(c)) ** 2).sum(1).argmin()
    n = int(((sheet[..., :3] == c).all(-1) & alpha).sum())
    log.append('  off-palette #%02x%02x%02x (%d px) -> #%02x%02x%02x' % (tuple(c) + (n,) + tuple(WPAL[k])))
    sheet[(sheet[..., :3] == c).all(-1) & alpha, :3] = WPAL[k]
cols = np.unique(sheet[alpha][:, :3], axis=0)
assert all((WPAL == c).all(1).any() for c in cols)
log.append('colours used %d of the walk sheet\'s %d' % (len(cols), len(WPAL)))

# leftovers of the drawn eyes: a speck (<= 4 px) of another colour that lies wholly inside the skin of the face
EYE_T, SK = tuple(EYE), [(250, 207, 166), (223, 154, 107)]
speck_log = []
for R in range(8):
    for C in range(4):
        fr = sheet[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]
        a = fr[..., 3] > 0
        top = np.where(a.any(1))[0].min()
        skin = np.zeros(a.shape, bool); eye = np.zeros(a.shape, bool)
        for y, x in zip(*np.where(a[:top + 30])):
            t = tuple(int(v) for v in fr[y, x, :3])
            skin[y, x] = t in SK; eye[y, x] = t == EYE_T
        other = a & ~skin & ~eye
        other[top + 30:] = False
        lab, n = nd.label(other)
        for i in range(1, n + 1):
            m = lab == i
            if m.sum() > 4:
                continue
            ring = nd.binary_dilation(m, structure=np.ones((3, 3))) & ~m
            if (ring & ~(skin | eye)).any() or not (ring & eye).any() and m.sum() > 2:
                continue
            vals, cn = np.unique(fr[ring & skin][:, :3], axis=0, return_counts=True)
            fr[m, :3] = vals[cn.argmax()]
            speck_log.append('%s%d:%d' % (NAMES[R], C, m.sum()))
log.append('face specks filled: %s' % speck_log)

# ---- face touch-up, so every frame has the walk sheet's face: plain skin, eyes 1x2 dots, nothing else
SKIN_SET = {(250, 207, 166), (223, 154, 107), (186, 117, 80)}
BRASS = {(231, 177, 85), (179, 122, 47)}
R_SKIN, O_SKIN = np.array([250, 207, 166], np.uint8), np.array([223, 154, 107], np.uint8)
col = lambda fr, y, x: tuple(int(v) for v in fr[y, x, :3])
touch = []


def nb8(fr, a, y, x):
    return [(y + dy, x + dx) for dy, dx in N8 if 0 <= y + dy < CH and 0 <= x + dx < CW and a[y + dy, x + dx]]


def eye_px(fr, a):
    ey, ex = np.where((fr[..., :3] == EYE).all(-1) & a)
    return sorted(set(ex.tolist())), (int(ey.min()) if len(ey) else None)

for R in range(8):
    want = {'down': 2, 'down_left': 2, 'down_right': 2, 'left': 1, 'right': 1}.get(NAMES[R], 0)
    frs = [sheet[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW] for C in range(4)]
    als = [f[..., 3] > 0 for f in frs]
    full = [eye_px(f, a)[0] for f, a in zip(frs, als) if len(eye_px(f, a)[0]) == 2]
    ref = [int(round(np.median([e[i] for e in full]))) for i in range(2)] if full else None
    for C, (fr, a) in enumerate(zip(frs, als)):
        top = np.where(a.any(1))[0].min()
        # 1) an ear drawn in orange must not land on the lantern's brass
        for y in range(top, top + 21):
            for x in np.where(a[y])[0]:
                if col(fr, y, x) in BRASS and any(col(fr, yy, xx) in SKIN_SET for yy, xx in nb8(fr, a, y, x)):
                    fr[y, x, :3] = O_SKIN; touch.append('%s%d ear' % (NAMES[R], C))
        xs, cy = eye_px(fr, a)
        # 2) a missing eye (it had run into the hair): put it where the other frames of the row have it
        if want == 2 and len(xs) == 1 and ref:
            miss = [x for x in ref if abs(x - xs[0]) > 1][0]
            for y in (cy, cy + 1):
                fr[y, miss, :3] = EYE
            touch.append('%s%d eye added at x=%d' % (NAMES[R], C, miss))
            xs, cy = eye_px(fr, a)
        if cy is None:
            continue
        # 3) dark leftovers that touch an eye dot -> skin
        for x in xs:
            for y in (cy, cy + 1):
                for yy, xx in nb8(fr, a, y, x):
                    c = col(fr, yy, xx)
                    if c == tuple(EYE) or c in SKIN_SET or L(c)[0] >= 45:
                        continue
                    if sum(col(fr, y2, x2) in SKIN_SET or col(fr, y2, x2) == tuple(EYE) for y2, x2 in nb8(fr, a, yy, xx)) >= 3:
                        fr[yy, xx, :3] = R_SKIN; touch.append('%s%d dark px by the eye' % (NAMES[R], C))
        # 4) between the two eyes there is only skin
        if len(xs) == 2:
            for y in range(cy, cy + 4):
                for x in range(xs[0] + 1, xs[1]):
                    if a[y, x] and col(fr, y, x) not in SKIN_SET:
                        fr[y, x, :3] = R_SKIN; touch.append('%s%d mark between the eyes' % (NAMES[R], C))
log.append('face touch-up: %s' % sorted(set(touch)))

# lantern table (glass centre; hidden -> the hip it hangs on), as finish.py
HIP = {'right': (49, 90), 'down_right': (55, 90), 'up_right': (42, 90)}
lantern = []
for R in range(8):
    row = []
    for C in range(4):
        fr = sheet[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]
        hsv = np.array(Image.fromarray(fr[..., :3]).convert('HSV')).astype(int)
        amber = (fr[..., 3] > 0) & (hsv[..., 0] >= 24) & (hsv[..., 0] <= 36) & (hsv[..., 1] > 140) & (hsv[..., 2] > 150)
        top = np.where((fr[..., 3] > 0).any(1))[0].min()
        amber[:max(AY - 46, top + 31)] = False          # below the chest only: never the brass dot at the throat of a lowered head
        lab, n = nd.label(amber, structure=np.ones((3, 3)))
        if n:
            sz = nd.sum(amber, lab, range(1, n + 1)); i = int(np.argmax(sz))
        if n and sz[i] >= 6 and NAMES[R] not in HIP:
            cy, cx = nd.center_of_mass(lab == i + 1)
            row.append([int(round(cx)), int(round(cy))])
        elif NAMES[R] in HIP:
            lift = place[(R, C)][4]
            # the hidden hip: the walk's hip offset from the body centre, under the runner's hips (= behind the leaning head)
            hx = AX + LEAN[NAMES[R]] - LEAD[NAMES[R]] + (HIP[NAMES[R]][0] - AX)
            row.append([int(round(hx)), HIP[NAMES[R]][1] - lift])
        else:
            row.append(None)
    known = [p for p in row if p]
    row = [p if p else ([int(round(np.mean([q[0] for q in known]))), int(round(np.mean([q[1] for q in known])))] if known else [AX, 90]) for p in row]
    lantern.append(row)
log.append('runLantern %s' % lantern)
Image.fromarray(sheet).save(os.path.join(out, 'hero_run.png'))
json.dump({'runLantern': lantern, 'lean': LEAN, 'place': {'%s_%d' % (NAMES[r], c): v for (r, c), v in place.items()}},
          open(os.path.join(out, 'run_meta.json'), 'w'))
open(os.path.join(out, 'build_run.txt'), 'w').write('\n'.join(log) + '\n')
print('\n'.join(log))
