"""(ash copy of ../field_desert/process.py: fixed gain for the ash greys, plus the LAVA emit layer <id>_emit) Painted FIELD area: generation -> the game's underlay images, @24/@32 (+@40 when 40 x max(w, h) <= 2048), into v2/assets/env/field/under/.
usage: python3 process.py <id> <gen.png>
- box-downscale to 32 px/tile;
- brightness: a luminance gain so the walkable ground matches the approved painted Roa (the night-light tuning then holds);
- overlay (<id>_over): tree-crown pixels that hang over the walkable row just north of a tree / forest cell (drawn above people),
  from colour likelihoods (crown = deep inside the tree masses, ground = open ground away from them), kept only where connected to the mass;
- closed layer (<id>_closed) for tilePatches: the painting shows the open state; each patch's cells get the closed look
  (sea/water cloned from open water nearby, rocks = the engine's rock sprites over the painted ground), meta live: [{cells, patch: i}].
Collision: layout.json rows_fit (fit.py)."""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage

aid, src = sys.argv[1], sys.argv[2]
V2 = '/home/user/others/chronicle/v2'
OUT = os.path.join(V2, os.environ.get('OUT', 'assets/env/field/under')); os.makedirs(OUT, exist_ok=True)   # 野営地・市は OUT=assets/env/desert/under
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
rows = d.get('rows_fit') or d['rows']
g = np.array([list(r) for r in rows])
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(np.float32)
A0 = A.copy()
lum = lambda v: v @ np.array([0.299, 0.587, 0.114], np.float32)
kron = lambda m: np.kron(m, np.ones((T, T), bool))
WALK = set(',;".:s_=cuk')
walk = np.isin(g, list(WALK))

# ---- brightness: walkable ground towards Roa's painted walkable ground
roa = np.asarray(Image.open(os.path.join(V2, 'assets/env/ash/under/caldera@32.png')).convert('RGB')).astype(np.float32)
green = lambda a: (a[..., 0] > a[..., 1]) & (a[..., 1] > a[..., 2] + 10) & (lum(a) > 110)    # sand pixels, the same measure on both paintings
target = float(os.environ.get('TARGET', lum(roa[green(roa)]).mean()))
gain = float(np.clip(target / lum(A[kron(walk) & green(A)]).mean(), 0.8, 1.15))
# 2026-09-29 見直し: 暗く沈んで見えたので、歩ける地面の明るさを砂漠・雪原のエリア（歩ける所の平均 150〜165）に近づける。
#   掛け算ではなく明るさの曲線（L' = 255 (L/255)^gam）: 暗い所を持ち上げ、溶岩など明るい所はほぼそのまま
WT = float(os.environ.get('WALK_TARGET', 148))
L0 = np.maximum(lum(A), 1.0)
wm = float(L0[kron(walk)].mean())
gam = float(np.clip(np.log(WT / 255) / np.log(wm / 255), 0.45, 1.1)) if 'GAIN' not in os.environ else 1.0
A = np.clip(A * ((255 * (L0 / 255) ** gam) / L0)[..., None], 0, 255)
gain = float(os.environ.get('GAIN', 1.0)) * (1.0 if 'GAIN' not in os.environ else 1.0)
if 'GAIN' in os.environ: A = np.clip(A * gain, 0, 255)
print('walk mean', round(wm, 1), '-> gam', round(gam, 3), 'walk now', round(float(lum(A)[kron(walk)].mean()), 1))
gain = round(gam, 3)
print('gain', round(gain, 3), 'target', round(target, 1))

# ---- overlay: crowns over the walkable row north of tree cells
tree = np.isin(g, list('TF'))
band = np.zeros((H * T, W * T), bool)
for y in range(H - 1):
    for x in range(W):
        if walk[y, x] and tree[y + 1, x]: band[y * T + 6:(y + 1) * T, x * T:(x + 1) * T] = True
inner = ndimage.binary_erosion(kron(tree), iterations=12)
farg = ~ndimage.binary_dilation(kron(tree | ~walk), iterations=24) & kron(walk)
Q = (np.clip(A0, 0, 255) // 16).astype(int); qi = Q[..., 0] * 256 + Q[..., 1] * 16 + Q[..., 2]
over = np.zeros((H * T, W * T), bool)
if inner.any() and farg.any() and band.any():
    hc = np.bincount(qi[inner], minlength=4096) + 0.5; hg = np.bincount(qi[farg], minlength=4096) + 0.5
    llr = np.log(hc / hc.sum()) - np.log(hg / hg.sum())
    sc = ndimage.uniform_filter(llr[qi], 5)
    can = band & (sc > 0.5)
    can = ndimage.binary_opening(can, iterations=1)
    lab, n = ndimage.label(can | (kron(tree) & ndimage.binary_dilation(band, iterations=6)))
    keep = set(np.unique(lab[kron(tree)])) - {0}
    can = can & np.isin(lab, list(keep))
    over = ndimage.binary_fill_holes(ndimage.binary_closing(can, iterations=2)) & band
print('overlay px', int(over.sum()))

# ---- closed layers for tilePatches
PROPS = os.path.join(V2, 'assets/env/common/props/')


def cell(a, x, y): return a[y * T:(y + 1) * T, x * T:(x + 1) * T]


def paste_sprite(C, name, fx, fy):
    sp = np.asarray(Image.open(PROPS + name + '@32.png').convert('RGBA')).astype(np.float32); j = json.load(open(PROPS + name + '.json'))
    ax, ay = j['feet']['32']
    x0, y0 = int(round(fx - ax)), int(round(fy - ay)); h, w = sp.shape[:2]
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W * T, x0 + w), min(H * T, y0 + h)
    s = sp[ya - y0:yb - y0, xa - x0:xb - x0]; al = s[..., 3:4] / 255
    C[ya:yb, xa:xb] = C[ya:yb, xa:xb] * (1 - al) + s[..., :3] * al


live = []
CL = A.copy()
for pi, p in enumerate(d['meta'].get('tilePatches', [])):
    px, py = p['rect'][:2]; ch = []
    for dy, r in enumerate(p['rows']):
        for dx, c in enumerate(r):
            if c != ' ': ch.append((px + dx, py + dy, c))
    C = A.copy()
    for (x, y, c) in ch:
        if c in '~w':   # water: clone the nearest cell of open water whose 3x3 neighbourhood is all water
            wm = np.isin(g, ["~", "w"]); wi = ndimage.binary_erosion(wm, np.ones((3, 3)), iterations=2)
            if not wi.any(): wi = ndimage.binary_erosion(wm, np.ones((3, 3)), iterations=1)   # 小さな池（野営地の泉）
            if not wi.any(): wi = wm
            ys, xs = np.nonzero(wi)
            k = np.argmin((xs - x) ** 2 + (ys - y) ** 2 + ((xs * 7 + ys * 13) % 3) * 0.1)
            cell(C, x, y)[:] = cell(A, xs[k], ys[k])
    for (x, y, c) in sorted(ch, key=lambda q: q[1]):
        if c in 'r':
            paste_sprite(C, ['rock', 'rock_v1'][(x * 7 + y * 3) % 2], (x + 0.5) * T, (y + 0.9) * T)
    diff = np.abs(C - A).sum(-1) > 1
    cells = [(x, y) for y in range(H) for x in range(W) if cell(diff, x, y).any()]
    for (x, y) in cells: cell(CL, x, y)[:] = cell(C, x, y)
    # a field patch CLOSES the way while its cond holds (the painting shows the open road): the closed look shows while cond is true,
    # i.e. while {not: cond} is false (chunks.js liveClosed draws a {cond} region when its cond is false). The patch still changes the grid, so it re-bakes
    live.append({'cells': [[x, y] for x, y in cells], 'cond': {'not': p['cond']}})
    print('patch', pi, p.get('cond'), 'cells', len(cells))

sizes = [24, 32] + ([40] if max(W, H) * 40 <= 2048 else [])


def save_set(name, arr, rgba=False):
    im = Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), 'RGBA' if rgba else 'RGB')
    for t in sizes:
        (im if t == 32 else im.resize((W * t, H * t), Image.NEAREST if rgba or t > 32 else Image.LANCZOS)).save(os.path.join(OUT, '%s@%d.png' % (name, t)), optimize=True)


save_set(aid, A)
# ---- emit: molten lava pixels on and next to lava cells glow at night (drawn after the light map, like the Caldera's lava)
lava = ndimage.binary_dilation(kron(g == 'l'), iterations=10)
r_, g_, b_ = A[..., 0], A[..., 1], A[..., 2]
hot = lava & (r_ > 170) & (r_ - b_ > 90) & (g_ > 50)
if hot.any() or (g == 'l').any():
    # the dark crust plates on the lava cells glow too (a little): under the cool night / cave light they would turn teal-grey
    crust = kron(g == 'l') & ~hot
    e = np.zeros((H * T, W * T, 4), np.float32); e[..., :3] = A; e[..., 3] = hot * 235 + crust * 150
    e[..., :3] *= (e[..., 3:4] > 0)
    save_set(aid + '_emit', e, True)
print('emit px', int(hot.sum()))
if over.any():
    o = np.zeros((H * T, W * T, 4), np.float32); o[..., :3] = A; o[..., 3] = over * 255
    o[..., :3] *= (o[..., 3:4] > 0)
    save_set(aid + '_over', o, True)
if live:
    am = np.zeros((H * T, W * T), np.uint8)
    for Lr in live:
        for x, y in Lr['cells']: am[y * T:(y + 1) * T, x * T:(x + 1) * T] = 255
    save_set(aid + '_closed', np.dstack([CL * (am[..., None] > 0), am]), True)
json.dump(dict(id=aid, kind='under', map=aid, tile=32, size32=[W * T, H * T], windows32=[], painted=[], live=live, gain=round(gain, 3),
               files={t: aid + '@%d.png' % t for t in sizes}, src='generated'), open(os.path.join(OUT, aid + '.json'), 'w'), indent=1)
print('sizes', sizes, '->', OUT)
