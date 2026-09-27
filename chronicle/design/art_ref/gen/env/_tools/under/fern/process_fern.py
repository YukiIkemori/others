"""Painted Fern underlay: generation -> 1x map image (tile 32) + emit (windows, glowing fungus) + overlay (rope bridge, root arches, canopy) + meta, @24/@32/@40.
usage: python3 process_fern.py <src.png> <outdir>   env: SHIFT='{"bld id": 1x px}', CAL=0..1, DROPWIN='x,y;..', NAME=fern"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
NAME = os.environ.get('NAME', 'fern')
d = json.load(open(os.environ.get('MAPDUMP', 'fern_data.json')))
rows, leg = d['rows'], d['legend']; W, H = d['w'], d['h']; T = 32
blds = json.load(open('blds.json'))
S = Image.open(src).convert('RGB')
k = S.width / (W * T)
# ---- vertical warp: the model drifts rows downwards (up to ~2 tiles mid-map); warp.json[gy] = painted row (1x) for guide row gy (rowwarp.py)
if os.environ.get('WARP'):
    wm = np.array(json.load(open(os.environ['WARP'])))
    a2 = np.asarray(S).astype(np.float32); Hs = a2.shape[0]
    yt = np.arange(Hs) / k
    ys = np.interp(yt, np.arange(len(wm)), wm) * k
    ys = np.clip(ys, 0, Hs - 1.001); y0i = np.floor(ys).astype(int); f = (ys - y0i)[:, None, None]
    a2 = a2[y0i] * (1 - f) + a2[np.minimum(y0i + 1, Hs - 1)] * f
    S = Image.fromarray(np.clip(np.rint(a2), 0, 255).astype(np.uint8))
    S.save('warped.png')
# ---- door surgery (in source px): slide each building's box sideways so its painted door sits on the door tile
SHIFT = json.loads(os.environ.get('SHIFT', '{}'))
if SHIFT:
    a2 = np.asarray(S).copy(); orig = a2.copy()
    for b in blds:
        o = int(round(SHIFT.get(b['id'], 0) * k))
        if not o: continue
        x0, x1 = int((b['x'] * T - 10) * k), int(((b['x'] + b['w']) * T + 10) * k)
        y0, y1 = int((b['y'] * T - 12) * k), int(((b['y'] + b['h']) * T + 12) * k)
        seg = orig[y0:y1, x0:x1].copy()
        a2[y0:y1, x0 + o:x1 + o] = seg
        if o < 0: a2[y0:y1, x1 + o:x1] = orig[y0:y1, x1:x1 - o]
        else: a2[y0:y1, x0:x0 + o] = orig[y0:y1, x0 - o:x0]
    S = Image.fromarray(a2)
A = np.asarray(S.resize((W * T, H * T), Image.BOX)).astype(np.float32)
A0 = A.copy()
mat = np.array([[leg[rows[y][x]]['mat'] for x in range(W)] for y in range(H)])
ch = np.array([[rows[y][x] for x in range(W)] for y in range(H)])
bmask = np.zeros((H, W), bool)
for b in blds: bmask[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']] = True
KT = np.ones((T, T), bool)
up = lambda m: np.kron(m, KT)
# ---- colour calibration against the tile bake of the same layout (keeps the night lighting tuning)
CAL = float(os.environ.get('CAL', '0.35'))
if CAL > 0 and os.path.exists('new_albedo.png'):
    old = np.asarray(Image.open('new_albedo.png').convert('RGB')).astype(np.float32)
    X, Y, Wt = [], [], []
    for m, w in (('moss_earth', 1.0), ('grass', 1.0), ('road', 1.0), ('cobble', 0.6), ('forest_dark', 0.5), ('dirt', 0.5)):
        for (y, x) in zip(*np.where((mat == m) & ~bmask)):
            a = A[y*T+6:y*T+26, x*T+6:x*T+26].reshape(-1, 3).mean(0); o = old[y*T+6:y*T+26, x*T+6:x*T+26].reshape(-1, 3).mean(0)
            X.append(np.r_[a, 1]); Y.append(o); Wt.append(w)
    X, Y, Wt = np.array(X), np.array(Y), np.sqrt(np.array(Wt))[:, None]
    M, *_ = np.linalg.lstsq(X * Wt, Y * Wt, rcond=None)
    lumA = (X[:, :3] @ [0.299, 0.587, 0.114]).mean(); lumO = (Y @ [0.299, 0.587, 0.114]).mean()
    flat = A.reshape(-1, 3)
    fit = np.c_[flat, np.ones(len(flat))] @ M
    gain = flat * (lumO / lumA)
    A = np.clip(fit * CAL + gain * (1 - CAL), 0, 255).reshape(A.shape)
    print('lum', round(lumA, 1), '->', round(lumO, 1))
R_, G_, B_ = A0[..., 0], A0[..., 1], A0[..., 2]
# ---- windows (emit): warm panes inside building walls and on the trunks (the pod homes)
fp = np.zeros(A.shape[:2], bool)
for b in blds: fp[(b['y'] + b['h'] - b['wall'] - 1) * T:(b['y'] + b['h']) * T - 2, b['x'] * T - 8:(b['x'] + b['w']) * T + 8] = True
fp |= up(ch == 'R')
pane = (R_ > 165) & (G_ > 115) & (B_ < 0.62 * R_) & (R_ - B_ > 75) & fp
lab, n = ndimage.label(ndimage.binary_closing(pane, iterations=2))
wins = []
emit = np.zeros(A.shape[:2] + (4,), np.uint8)
drop = [tuple(map(int, s.split(','))) for s in os.environ.get('DROPWIN', '').split(';') if s]
for i, sl in enumerate(ndimage.find_objects(lab)):
    ys, xs = sl; h, w = ys.stop - ys.start, xs.stop - xs.start
    comp = lab[sl] == i + 1
    if comp.sum() < 30 or w < 7 or h < 8 or w > 34 or h > 34 or comp.sum() < 0.35 * w * h: continue
    if any(abs(xs.start - dx) < 6 and abs(ys.start - dy) < 6 for dx, dy in drop): continue
    wins.append(dict(kind='win', x=int(xs.start), y=int(ys.start), w=int(w), h=int(h)))
    m = comp & pane[sl]
    e = emit[sl]
    px = np.clip(A[sl] * 1.12 + np.array([22, 14, 0]), 0, 255)
    e[m, :3] = px[m]; e[m, 3] = 255
print('windows', len(wins))
# ---- glowing fungus / moss (emit, no light of their own): bright cyan-green or blue-violet specks outside buildings and water
water = up((mat == 'water') | (ch == 'k'))
glow = (((G_ > 150) & (B_ > 120) & (R_ < 0.72 * G_)) | ((B_ > 170) & (R_ < 0.8 * B_) & (G_ < 0.95 * B_) & (B_ - R_ > 50))) & ~up(bmask) & ~water
glow = glow & ~(ndimage.uniform_filter(glow.astype(float), 25) > 0.35)   # big blue areas are not specks
lab, n = ndimage.label(ndimage.binary_dilation(glow, iterations=1))
nf = 0
for i, sl in enumerate(ndimage.find_objects(lab)):
    comp = lab[sl] == i + 1
    if comp.sum() > 160 or comp.sum() < 3: continue
    m = comp & glow[sl]
    e = emit[sl]; px = np.clip(A[sl] * 1.25 + np.array([10, 24, 30]), 0, 255)
    sel = m & (e[..., 3] == 0)
    e[sel, :3] = px[sel]; e[sel, 3] = 230; nf += 1
print('fungus specks', nf)
# ---- save
def save_set(name, arr, rgba=False):
    im = Image.fromarray(arr.astype(np.uint8), 'RGBA' if rgba else 'RGB')
    im.save(os.path.join(outdir, name + '@32.png'), optimize=True)
    im.resize((W * 24, H * 24), Image.LANCZOS if not rgba else Image.NEAREST).save(os.path.join(outdir, name + '@24.png'), optimize=True)
    # no @40: 60x56 tiles x 40 = 2400 px is over the 2048 atlas page (tools/pack_web.py); T.Env.under scales @32 for tile 40
base = np.rint(A).astype(np.uint8)
save_set(NAME, base)
save_set(NAME + '_emit', emit, True)
# ---- overlay (drawn above lv 0 people)
ov = np.zeros(A.shape[:2], bool)
# 1 rope bridge: the deck cells between the platforms (the part over the road and the thickets), with its rope rails
BR = [int(v) for v in os.environ.get('BRIDGE', '19,33,12,13').split(',')]
ov[BR[2] * T - int(os.environ.get('BR_UP', '10')):(BR[3] + 1) * T + int(os.environ.get('BR_DN', '6')), BR[0] * T:(BR[1] + 1) * T] = True
# 2 root arches over the road: pixels in the gate rows over the road that are not road-coloured
road = up((mat == 'road') & ~bmask)
rc = np.median(A0[road & ~up(np.isin(np.arange(H)[:, None].repeat(W, 1), list(range(0, 6)) + list(range(49, 56))))], axis=0)
dist = np.sqrt(((A0 - rc) ** 2).sum(-1))
for (ya, yb) in [tuple(map(int, p.split(','))) for p in os.environ.get('ARCHES', '2,6;48,52').split(';')]:
    reg = np.zeros(A.shape[:2], bool); reg[ya * T:yb * T, 27 * T:33 * T] = True
    arch = reg & (ndimage.uniform_filter(dist, 5) > float(os.environ.get('ARCH_D', '55')))
    arch = ndimage.binary_opening(arch, iterations=2)
    lab2, _ = ndimage.label(arch)
    # keep components that reach across most of the road (an arch spans it)
    for i, sl in enumerate(ndimage.find_objects(lab2)):
        if sl[1].stop - sl[1].start > 70: ov |= (lab2 == i + 1)
# 3 canopy of the small thickets and the forest edge hanging over walkable cells just north of them
solid_t = np.isin(mat, ['tree', 'forest_dark'])
walk_t = np.array([[not leg[rows[y][x]].get('solid') and leg[rows[y][x]].get('walk', True) is not False for x in range(W)] for y in range(H)])
band = np.zeros(A.shape[:2], bool)
for y in range(H - 1):
    for x in range(W):
        if walk_t[y, x] and not bmask[y, x] and solid_t[y + 1, x] and ch[y, x] not in '=:': band[y * T + 8:(y + 1) * T, x * T:(x + 1) * T] = True
inner = ndimage.binary_erosion(up(solid_t), iterations=14)
farg = ~ndimage.binary_dilation(up(solid_t | bmask | (ch == 'R')), iterations=30) & up(np.isin(mat, ['grass', 'moss_earth']))
Q = (np.clip(A0, 0, 255) // 16).astype(int); qi = Q[..., 0] * 256 + Q[..., 1] * 16 + Q[..., 2]
hc = np.bincount(qi[inner], minlength=4096) + 0.5; hg = np.bincount(qi[farg], minlength=4096) + 0.5
llr = np.log(hc / hc.sum()) - np.log(hg / hg.sum())
score = ndimage.uniform_filter(llr[qi], 5)
can = band & (score > 0.6)
can = ndimage.binary_opening(can, iterations=1)
lab3, _ = ndimage.label(can | (up(solid_t) & ndimage.binary_dilation(band, iterations=6)))
keep = set(np.unique(lab3[up(solid_t)])) - {0}
can = can & np.isin(lab3, list(keep))
can = ndimage.binary_fill_holes(ndimage.binary_closing(can, iterations=2)) & band
ov |= can
print('overlay px', int(ov.sum()), 'canopy', int(can.sum()))
Image.fromarray((ov * 255).astype(np.uint8)).save('over_mask.png')
o = np.zeros(A.shape[:2] + (4,), np.uint8); o[..., :3] = base * ov[..., None]; o[..., 3] = ov * 255
save_set(NAME + '_over', o, True)
doors = [dict(x=b['door'][0] * T + 16, y=b['door'][1] * T + 16, id=b['id']) for b in blds]
json.dump(dict(id=NAME, kind='under', map=NAME, tile=32, size32=[W * T, H * T], windows32=wins, doors32=doors,
               painted=['roots'], files={t: NAME + '@%d.png' % t for t in (24, 32)}), open(os.path.join(outdir, NAME + '.json'), 'w'), indent=1)
Image.fromarray(base).save('proc_last.png')
