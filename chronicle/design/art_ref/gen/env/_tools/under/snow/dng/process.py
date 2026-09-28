"""Painted snow dungeon / interior underlay: generation -> (optional row warp, SHIFT patches) -> 1x map image, tree-canopy overlay,
closed layer for secret walls (meta.live), @24/@32(/@40) + json into v2/assets/env/snow/under/.
usage: python3 process.py <map> <gen.png> [name]
env: GAIN (default: luminance match to the tile render on walkable ground, clipped 0.8..1.0), OVER=1 (tree canopy overlay),
     WARP='[[y_out, y_src], ...]' (1x px, piecewise-linear vertical warp), SHIFT='[[x0,y0,x1,y1,dx,dy],...]' (1x px)"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
m, src = sys.argv[1], sys.argv[2]
name = sys.argv[3] if len(sys.argv) > 3 else m
OUTDIR = '/home/user/others/chronicle/v2/assets/env/snow/under'
d = json.load(open(m + '/layout_data.json')); W, H = d['w'], d['h']; T = 32
op = json.load(open(m + '/open.json'))
rows = op['rows']; face = {(x, y) for x, y, j, r in op['face']}
L = d['legend']
S = Image.open(src).convert('RGB')
A = np.asarray(S.resize((W * T, H * T), Image.BOX)).astype(np.float32)
# ---- vertical warp (piecewise linear, 1x px): output row y takes source row f(y)
WARP = json.loads(os.environ.get('WARP', '[]'))
if WARP:
    ys = np.arange(H * T)
    ya, yb = zip(*([(0, 0)] + WARP + [(H * T - 1, H * T - 1)]))
    f = np.interp(ys, ya, yb)
    A = A[np.clip(np.rint(f).astype(int), 0, H * T - 1)]
# ---- patches moved (door surgery style)
for x0, y0, x1, y1, dx, dy in json.loads(os.environ.get('SHIFT', '[]')):
    seg = A[y0:y1, x0:x1].copy(); A[y0 + dy:y1 + dy, x0 + dx:x1 + dx] = seg
# ---- gain towards the tile render on walkable ground (keeps the lighting tuning of the map)
ent = lambda x, y: L.get(rows[y][x], {'mat': d['outside'], 'solid': True}) if 0 <= x < W and 0 <= y < H else {'solid': True}
walk = np.array([[not ent(x, y).get('solid') and ent(x, y).get('walk', True) is not False for x in range(W)] for y in range(H)])
old = np.asarray(Image.open(m + '/layout_albedo.png').convert('RGB')).astype(np.float32)
lum = lambda v: v @ np.array([0.299, 0.587, 0.114], np.float32)
mk = np.kron(walk, np.ones((T, T), bool))
gain = float(np.clip(lum(old[mk]).mean() / max(1, lum(A[mk]).mean()), 0.8, 1.0))
gain = float(os.environ.get('GAIN', gain))
A = np.clip(A * gain, 0, 255)
print(m, 'gain', round(gain, 3))
base = np.rint(A).astype(np.uint8)
# ---- tree canopy overlay: the painted crown of a fir that reaches up into the walkable cell north of it
over = None
if os.environ.get('OVER'):
    over = np.zeros((H * T, W * T, 4), np.uint8)
    tree = lambda x, y: 0 <= x < W and 0 <= y < H and L.get(rows[y][x], {}).get('mat') == 'tree'
    Rr, Gg, Bb = A[..., 0], A[..., 1], A[..., 2]
    Y = lum(A)
    canopy = ((Gg > Rr + 6) & (Y < 175)) | (Y < 105)
    n = 0
    for y in range(H):
        for x in range(W):
            if not walk[y][x] or not tree(x, y + 1): continue
            sl = (slice(y * T, (y + 1) * T), slice(x * T, (x + 1) * T))
            c = canopy[sl].copy()
            lab, k = ndimage.label(c)
            keep = set(lab[-1, :][lab[-1, :] > 0].tolist())   # connected to the crown below
            mm = np.isin(lab, list(keep)) if keep else np.zeros_like(c)
            mm = ndimage.binary_opening(mm, iterations=1)
            if mm.sum() < 12: continue
            o = over[sl]; o[mm, :3] = base[sl][mm]; o[mm, 3] = 255; n += 1
    print('overlay cells', n)
# ---- closed layer for the live cells (secret walls and the hidden room behind them)
live = []
closed = None
if d.get('areas'):
    closed = base.copy()
    solid_top = [(x, y) for y in range(H) for x in range(W) if ent(x, y).get('solid') and (x, y) not in face and all(ent(x + i, y + j).get('solid') for i in (-1, 0, 1) for j in (-1, 0, 1))]
    faces = {}
    for x, y, j, r in op['face']: faces.setdefault((j, r), []).append((x, y))
    for a in d['areas']:
        P = lambda c: tuple(int(v) for v in c.split(',')) if isinstance(c, str) else tuple(c)
        gl = [P(c) for c in (a['gate'] if isinstance(a['gate'], list) and not isinstance(a['gate'][0], int) else [a['gate']])]
        cells = [P(c) for c in a['cells']] + gl
        cs = set(cells)
        for (x, y) in cells:
            # closed look: rock top, or the 2-row cliff face where the closed block stands over open floor
            below = [(x, y + k) for k in (1, 2)]
            fj = None
            for k, (bx, by) in enumerate(below):
                if (bx, by) not in cs and 0 <= by < H and not ent(bx, by).get('solid') and all((x, y + q) in cs for q in range(1, k + 1)):
                    fj = k + 1; break
            pool = faces.get((fj, 2)) if fj else None
            if not pool: pool = solid_top
            sx, sy = min(pool, key=lambda c: (c[0] - x) ** 2 + (c[1] - y) ** 2 + (0 if c not in cs else 1e9))
            closed[y * T:(y + 1) * T, x * T:(x + 1) * T] = base[sy * T:(sy + 1) * T, sx * T:(sx + 1) * T]
        live.append({'cells': [list(c) for c in cells], 'secret': '%d,%d' % tuple(gl[0])})
    print('live', [len(l['cells']) for l in live])


def save_set(nm, arr, rgba=False):
    im = Image.fromarray(arr, 'RGBA' if rgba else 'RGB')
    im.save(os.path.join(OUTDIR, nm + '@32.png'), optimize=True)
    im.resize((W * 24, H * 24), Image.NEAREST if rgba else Image.LANCZOS).save(os.path.join(OUTDIR, nm + '@24.png'), optimize=True)
    if W * 40 <= 2048 and H * 40 <= 2048:
        im.resize((W * 40, H * 40), Image.NEAREST).save(os.path.join(OUTDIR, nm + '@40.png'), optimize=True)


save_set(name, base)
if over is not None and over[..., 3].any(): save_set(name + '_over', over, True)
if closed is not None: save_set(name + '_closed', closed)
sizes = (24, 32, 40) if W * 40 <= 2048 and H * 40 <= 2048 else (24, 32)
meta = dict(id=name, kind='under', map=m, tile=32, size32=[W * T, H * T], windows32=[], painted=[], files={t: '%s@%d.png' % (name, t) for t in sizes})
if live: meta['live'] = live
json.dump(meta, open(os.path.join(OUTDIR, name + '.json'), 'w'), indent=1)
Image.fromarray(base).save(m + '/proc_last.png')
print('ok', name, sizes)
