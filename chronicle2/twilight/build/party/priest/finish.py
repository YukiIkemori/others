"""walk_raw.png / run_raw.png (from build.py) -> the final priestess sheets: 1x2 dot eyes, no mouth, pale-wood staff
plum-indigo robe without near-black, and the json.
usage: python3 finish.py <work dir> <out dir> [tune.json]   (tune.json "staff": {"run:down_right:2": [p, q, y0, y1]} fixes a shaft line by hand)"""
import sys, os, json, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools')
import pixlib as P
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shape
work, out = sys.argv[1:3]
OVERRIDE = json.load(open(sys.argv[3])).get('staff', {}) if len(sys.argv) > 3 else {}
CW, CH, AX, AY = 96, 128, 48, 120
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
SITE = '/home/user/others/chronicle2/twilight/site'
os.makedirs(out, exist_ok=True)
hexc = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.uint8)
EYE = np.array([34, 26, 30], np.uint8)
WOOD = [hexc('#d4ba9e'), hexc('#a78667'), np.array([122, 98, 78], np.uint8)]       # light, mid, dark (pale ash wood)
# the robe: the drawn mauve-greys and near-blacks, by lightness -> a dusty plum-indigo ramp (L in, RGB out)
PLUM_L = [8, 13, 17, 31, 39]
PLUM_RGB = np.array([(40, 33, 52), (47, 36, 60), (54, 44, 68), (75, 60, 90), (97, 78, 110)], float)
DEEP = (40, 33, 52)
N8 = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]


def labf(fr):
    return P.srgb_to_lab(fr[..., :3].astype(np.float64))


def masks(fr):
    a = fr[..., 3] > 0
    L = labf(fr)
    skin_l = a & (L[..., 0] >= 65) & (L[..., 1] >= 7) & (L[..., 2] >= 24) & (L[..., 2] <= 37)
    skin_s = a & (L[..., 1] >= 22) & (L[..., 0] >= 40) & (L[..., 0] < 65)
    gold = a & (L[..., 2] >= 24) & (L[..., 0] >= 30) & (L[..., 0] <= 84) & (L[..., 1] < 20) & ~skin_l
    return a, L, skin_l, skin_s, gold


def body(a, w, grow=0):
    b = nd.binary_opening(a, structure=np.ones((1, w), bool))
    if grow:
        b = nd.binary_dilation(b, structure=np.ones((3, 3), bool), iterations=grow, mask=a)
    return b


# ------------------------------------------------------------------ staff
def runs_of(row):
    xs = np.where(row)[0]
    return np.split(xs, np.where(np.diff(xs) > 1)[0] + 1) if len(xs) else []


def staff_line(a, name, key=None, support=None):
    """the straight shaft, anchored on the knob under the crescent: returns (p, q, dist map, knob row, last shaft row)
    with x = p*y + q, or None. OVERRIDE[key] = [p, q, y0, y1] replaces the search."""
    H, W = a.shape
    Y, X = np.arange(H)[:, None], np.arange(W)[None, :]
    if key in OVERRIDE:
        p, q, y0, y1 = OVERRIDE[key]
        return p, q, np.abs(X - (p * Y + q)), int(y0), int(y1)
    top, hcx = shape.head(a)
    side = -1 if name in ('down', 'down_left', 'down_right', 'left') else 1     # picture side of the staff, from the head
    T = a & ~shape.open_disc(a, 5.0)                       # everything thinner than the head: staff, strands, limbs
    lab, n = nd.label(T, structure=np.ones((3, 3)))
    cand = T & (side * (X - hcx) > 4) & (Y < top + 24)
    if not cand.any():
        return None
    ty = np.where(cand.any(1))[0].min()
    tx = np.where(cand[ty])[0]
    comp = lab == lab[ty, tx[len(tx) // 2]]
    # the knob: first rows under the crescent where the piece is one narrow run
    ky = None
    for y in range(ty + 4, min(H - 3, ty + 22)):
        if all(len(runs_of(comp[y + k])) == 1 and len(runs_of(comp[y + k])[0]) <= 5 for k in range(3)):
            ky = y; break
    if ky is None:
        return None
    kx = runs_of(comp[ky])[0].mean()
    thin = a & ~nd.binary_opening(a, structure=np.ones((1, 6), bool))
    pts = np.array([(y, (r[0] + r[-1]) / 2.0) for y in range(ky, H) for r in runs_of(thin[y]) if len(r) <= 5], float)
    if len(pts) < 5:
        return None
    # 1) knob -> butt: the longest line from the knob to a thin end that runs over staff colour (or her hand) all the way
    L = None
    for by, bx in pts[pts[:, 0] >= ky + 12]:
        p = (bx - kx) / (by - ky)
        if abs(p) > 0.8 or (L is not None and by - ky <= L[0]):
            continue
        yy = np.arange(ky, int(by) + 1)
        xx = np.round(kx + p * (yy - ky)).astype(int).clip(1, W - 2)
        sup = (support[yy, xx] | support[yy, xx - 1] | support[yy, xx + 1]).mean()
        if sup >= 0.86:
            L = (by - ky, p, int(by))
    if L is not None:
        p = L[1]; q = kx - p * ky
        inl = np.abs(pts[:, 1] - (p * pts[:, 0] + q)) <= 1.3
        if len(np.unique(pts[inl, 0])) >= 6:
            p, q = np.polyfit(np.r_[pts[inl, 0], [ky] * 4], np.r_[pts[inl, 1], [kx] * 4], 1)
        return p, q, np.abs(X - (p * Y + q)), int(ky), L[2]
    # 2) only the top of the shaft is free (the rest is behind her): the slope from the rows under the knob
    best = None
    near = pts[pts[:, 0] <= ky + 26]
    for p in np.arange(-0.8, 0.801, 0.01):
        inl = np.abs(near[:, 1] - (kx + p * (near[:, 0] - ky))) <= 1.0
        rows = len(np.unique(near[inl, 0]))
        if best is None or rows > best[0]:
            best = (rows, p)
    if best[0] < 5:
        return None
    p = best[1]; q = kx - p * ky
    for _ in range(2):                                     # follow the line down and refit with everything on it
        tol = 1.2 + 0.03 * (pts[:, 0] - ky)
        inl = np.abs(pts[:, 1] - (p * pts[:, 0] + q)) <= tol
        if len(np.unique(pts[inl, 0])) >= 6:
            p, q = np.polyfit(np.r_[pts[inl, 0], [ky] * 6], np.r_[pts[inl, 1], [kx] * 6], 1)
    inl = np.abs(pts[:, 1] - (p * pts[:, 0] + q)) <= 1.3
    ys = np.unique(pts[inl, 0]).astype(int)
    # the last shaft row: ignore lone far rows (a strand that happens to lie on the line)
    y1 = ky
    for y in ys:
        if y - y1 <= 3 or (ys >= y).sum() >= 4 and np.ptp(ys[ys >= y][:4]) <= 6:
            y1 = y
    return p, q, np.abs(X - (p * Y + q)), int(ky), int(y1)


def wood(fr, sel):
    """shaft pixels -> the pale wood ramp, lit from the left: per row (mid,) light ..., dark"""
    for y in np.where(sel.any(1))[0]:
        xs = np.where(sel[y])[0]
        runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
        for r in runs:
            w = len(r)
            if w == 1:
                cols = [1]
            elif w == 2:
                cols = [0, 2]
            else:
                cols = [1] + [0] * (w - 2) + [2]
            for x, c in zip(r, cols):
                fr[y, x, :3] = WOOD[c]


NEAR = ('down', 'right', 'down_right', 'up_right', 'up')     # views where nothing but her own hand is in front of the staff


def fix_staff(fr, name, key):
    a, L, skin_l, skin_s, gold = masks(fr)
    res = staff_line(a, name, key, gold | skin_s | skin_l)
    if res is None:
        return 'no staff'
    p, q, dist, y_sh, y_bot = res
    H, W = a.shape
    # colours a shaft pixel can have before the recolour: anything warm that is not skin, cream or plum
    stf = a & ~skin_l & (L[..., 2] >= 5) & ~((L[..., 0] > 75) & (L[..., 2] < 24))
    thin = a & ~nd.binary_opening(a, structure=np.ones((1, 6), bool))
    sel = np.zeros_like(a)
    for y in range(y_sh, y_bot + 1):
        cand = stf[y] & (dist[y] <= 1.9)
        if not cand.any():
            continue
        xs = np.where(cand)[0]
        x0, x1 = xs.min(), xs.max()
        free = thin[y, x0:x1 + 1].all()
        lf = x0 == 0 or (not a[y, x0 - 1]) or not (stf[y, x0 - 1] or skin_l[y, x0 - 1])
        rt = x1 == W - 1 or (not a[y, x1 + 1]) or not (stf[y, x1 + 1] or skin_l[y, x1 + 1])
        if free or (lf and rt) or name in NEAR:
            sel[y, x0:x1 + 1] = cand[x0:x1 + 1]
    wood(fr, sel)
    return 'staff p=%.3f q=%.1f rows %d-%d (%d px)' % (p, q, y_sh, y_bot, int(sel.sum()))


# ------------------------------------------------------------------ rims: skin-shadow colours used far from skin
def fix_rims(fr):
    a, L, skin_l, skin_s, gold = masks(fr)
    nearskin = nd.binary_dilation(skin_l, structure=np.ones((3, 3), bool), iterations=2)
    stray = skin_s & ~nearskin
    if not stray.any():
        return 0
    # replace by the gold-family colour of the frame that is closest in lightness
    cols = np.unique(fr[gold][:, :3], axis=0)
    if len(cols) == 0:
        return 0
    cl = P.srgb_to_lab(cols.astype(np.float64))
    for y, x in zip(*np.where(stray)):
        d = np.abs(cl[:, 0] - (L[y, x, 0] - 2)) + 0.3 * np.abs(cl[:, 2] - 30)
        fr[y, x, :3] = cols[d.argmin()]
    return int(stray.sum())


# ------------------------------------------------------------------ eyes and mouth
def fix_face(fr, name, C, state):
    a, L, skin_l, skin_s, gold = masks(fr)
    skin = skin_l | skin_s
    top, hcx = shape.head(a)
    dark = a & (L[..., 0] < 12)
    want = {'down': 2, 'down_left': 2, 'down_right': 2, 'left': 1, 'right': 1}.get(name, 0)
    lab, n = nd.label(dark, structure=np.ones((3, 3)))
    cands = []
    for i in range(1, n + 1):
        m = lab == i
        yy, xx = np.where(m)
        if yy.min() < top + 7 or yy.max() > top + 26 or m.sum() > 14:
            continue
        ring = nd.binary_dilation(m, structure=np.ones((3, 3))) & ~m
        frac = (ring & skin).sum() / float(ring.sum())
        if frac >= 0.3:
            cands.append((frac, m))
    eyes = [m for f, m in sorted(cands, key=lambda t: -t[0])[:want]]
    spots = []
    for m in eyes:
        yy, xx = np.where(m)
        xs = np.unique(xx)
        if len(xs) == 1:
            cx = xs[0]
        else:                                   # the column with most dark pixels; ties -> nearer the head centre
            cnt = {x: (xx == x).sum() for x in xs}
            mx = max(cnt.values())
            cx = min([x for x in xs if cnt[x] == mx], key=lambda x: abs(x - hcx))
        cy = int(round((yy.min() + yy.max()) / 2.0))
        if yy.max() - yy.min() + 1 <= 2:
            cy = yy.min()
        spots.append([cx, cy, m])
    if len(spots) == 2:
        cy = int(round((spots[0][1] + spots[1][1]) / 2.0))
        spots = sorted(spots, key=lambda t: t[0])
        if C == 0 or state.get('sp') is None:
            state['sp'] = spots[1][0] - spots[0][0]
        else:
            mid = (spots[0][0] + spots[1][0]) / 2.0
            x1 = int(round(mid - state['sp'] / 2.0))
            spots[0][0], spots[1][0] = x1, x1 + state['sp']
        spots[0][1] = spots[1][1] = cy
    base = fr[skin_l][:, :3]
    if len(base):
        vals, cn = np.unique(base, axis=0, return_counts=True)
        SKIN = vals[cn.argmax()]
    else:
        SKIN = np.array([248, 208, 163], np.uint8)
    keep = np.zeros_like(a)
    for cx, cy, m in spots:
        for y, x in zip(*np.where(m)):
            nb = [tuple(fr[y + dy, x + dx, :3]) for dy, dx in N8
                  if 0 <= y + dy < CH and 0 <= x + dx < CW and skin_l[y + dy, x + dx]]
            if nb:
                vals, cn = np.unique(np.array(nb), axis=0, return_counts=True)
                fr[y, x, :3] = vals[cn.argmax()]
            else:
                fr[y, x, :3] = SKIN
        keep[cy:cy + 2, cx] = True
    # mouth / nose marks: small blobs of another colour enclosed by the plain face colour, under the eyes
    nm = 0
    if spots:
        ex0 = min(s[0] for s in spots); ex1 = max(s[0] for s in spots); ey = max(s[1] for s in spots) + 2
        a2 = fr[..., 3] > 0
        plain = a2 & (fr[..., :3] == SKIN).all(-1)
        box = np.zeros_like(a); box[ey:ey + 8, max(0, ex0 - 5):ex1 + 6] = True
        non = box & a2 & ~plain & ~keep
        lab2, n2 = nd.label(non, structure=np.ones((3, 3)))
        for i in range(1, n2 + 1):
            m = lab2 == i
            if m.sum() > 5:
                continue
            ring = nd.binary_dilation(m, structure=np.ones((3, 3))) & ~m
            if (ring & plain).sum() >= 0.85 * ring.sum():
                fr[m, :3] = SKIN; nm += int(m.sum())
    fr[keep, :3] = EYE
    return len(spots), nm


def finish(name):
    sheet = np.array(Image.open(os.path.join(work, name + '_raw.png')).convert('RGBA'))
    log = []
    for R in range(8):
        state = {}
        for C in range(4):
            fr = sheet[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]
            s = fix_staff(fr, NAMES[R], '%s:%s:%d' % (name, NAMES[R], C))
            r = fix_rims(fr)
            e, m = fix_face(fr, NAMES[R], C, state)
            log.append('%s %s %d: %s; rim %d; eyes %d; mouth px %d' % (name, NAMES[R], C, s, r, e, m))
    # palette: plum-indigo robe, no near-black
    al = sheet[..., 3] > 0
    cols = np.unique(sheet[al][:, :3], axis=0)
    cl = P.srgb_to_lab(cols.astype(np.float64))
    for c, l in zip(cols, cl):
        if l[0] < 45 and l[2] < 4 and l[1] < 22 and not (c == EYE).all():
            n = np.array([np.interp(l[0], PLUM_L, PLUM_RGB[:, k]) for k in range(3)])
            sheet[(sheet[..., :3] == c).all(-1) & al, :3] = np.round(n).astype(np.uint8)
    # the flaxen / dull-gold family a little paler and dustier (palette only)
    cols = np.unique(sheet[al][:, :3], axis=0)
    cl = P.srgb_to_lab(cols.astype(np.float64))
    for c, l in zip(cols, cl):
        if l[2] >= 24 and l[1] < 20 and 30 <= l[0] <= 90 and not (l[0] >= 65 and l[1] >= 7 and l[2] <= 37):
            h, sa, v = colorsys.rgb_to_hsv(*(c / 255.0))
            n = np.round(np.array(colorsys.hsv_to_rgb(h, sa * 0.86, v)) * 255).astype(np.uint8)
            sheet[(sheet[..., :3] == c).all(-1) & al, :3] = n
    # anything still near-black (except the eye dots) -> deep plum
    L = labf(sheet)[..., 0]
    iseye = (sheet[..., :3] == EYE).all(-1)
    sheet[al & (L < 12.5) & ~iseye, :3] = DEEP
    # lonely pixels: an opaque pixel with no opaque 4-neighbour is dropped
    al = sheet[..., 3] > 0
    nb = nd.convolve(al.astype(int), np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]]), mode='constant')
    sheet[al & (nb == 0)] = 0
    return sheet, log


walk, lw = finish('walk')
run, lr = finish('run')
open(os.path.join(out, 'finish_log.txt'), 'w').write('\n'.join(lw + lr) + '\n')
Image.fromarray(walk).save(os.path.join(out, 'priest.png'))
Image.fromarray(run).save(os.path.join(out, 'priest_run.png'))
meta = {"frame": [CW, CH], "foot": [AX, AY], "body": 76, "ms": 170, "run": {"src": "priest_run.png", "cols": 4, "ms": 105}}
open(os.path.join(out, 'priest.json'), 'w').write(json.dumps(meta))
both = np.concatenate([walk[walk[..., 3] > 0][:, :3], run[run[..., 3] > 0][:, :3]])
print('colours: walk %d, run %d, both %d' % (len(np.unique(walk[walk[..., 3] > 0][:, :3], axis=0)), len(np.unique(run[run[..., 3] > 0][:, :3], axis=0)), len(np.unique(both, axis=0))))
for l in lw + lr:
    if 'no staff' in l or 'eyes 0' in l and any(k in l for k in (' down', ' left ', ' right ')):
        print('  !', l)
