"""Fit the collision of a painted floor of 忘却の底 to the painting. usage: python3 fit.py <id> <gen.png> [--apply]
Per pixel: colour likelihoods (4096-bin histograms) of three classes learnt from the painting itself over the layout's eroded cells:
  void (the mist '~'), ground (every walkable char) and block (walls / trees / rocks / marks: X T F r).
A cell is walkable when more than FRAC (default 0.5) of its pixels look like ground. Landmark (mark) cells and the cells the map
data uses (a.objects, stairs, spawns) keep the layout. A walkable cell that becomes solid takes '~' (void) or the layout's block char;
a solid cell that becomes walkable takes the most common walkable char around it. Walkable pockets not reachable from the spawns are
closed. Writes <id>/fit.png (red = solid, yellow = changed from the layout) and with --apply layout.json rows_fit.
<id>/fix.json {"walk": [[x, y, ch]...], "solid": [[x, y, ch]...], "frac": 0.5} is applied last."""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from collections import deque, Counter

aid, src = sys.argv[1], sys.argv[2]
APPLY = '--apply' in sys.argv
d = json.load(open(aid + '/layout.json'))
W, H, T = d['w'], d['h'], 32
fx = json.load(open(aid + '/fix.json')) if os.path.exists(aid + '/fix.json') else {}
FRAC = float(fx.get('frac', 0.5))
WALK = set('cs,:_=k')
g = np.array([list(r) for r in d['rows']])
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(np.int32)
qi = (A[..., 0] // 16) * 256 + (A[..., 1] // 16) * 16 + (A[..., 2] // 16)
kron = lambda m: np.kron(m, np.ones((T, T), bool))
walk = np.isin(g, list(WALK))
void = g == '~'
block = ~walk & ~void
masks = {'ground': walk, 'void': void, 'block': block}
ll = {}
for k, m in masks.items():
    me = ndimage.binary_erosion(m, iterations=1)
    if me.sum() < 4: me = m
    if not me.any(): continue
    h = np.bincount(qi[kron(me)], minlength=4096).astype(float) + 0.5
    ll[k] = np.log(h / h.sum())
names = list(ll)
L = np.stack([ndimage.uniform_filter(ll[k][qi], 3) for k in names])
best = np.argmax(L, 0)
frac = {k: (best == i).reshape(H, T, W, T).mean((1, 3)) for i, k in enumerate(names)}
keep = np.zeros((H, W), bool)
for mk in d['marks']:
    for (x, y) in mk['cells']: keep[y, x] = True
for o in d['objects']: keep[o['y'], o['x']] = True
out = g.copy()
for y in range(H):
    for x in range(W):
        if keep[y, x]: continue
        gw = frac.get('ground', np.zeros((H, W)))[y, x]
        if gw > FRAC and not walk[y, x]:
            nb = [g[j, i] for j in range(y - 1, y + 2) for i in range(x - 1, x + 2) if 0 <= i < W and 0 <= j < H and g[j, i] in WALK]
            out[y, x] = Counter(nb).most_common(1)[0][0] if nb else 'c'
        elif gw < FRAC and walk[y, x]:
            vb = frac.get('void', np.zeros((H, W)))[y, x]; bb = frac.get('block', np.zeros((H, W)))[y, x]
            if vb >= bb: out[y, x] = '~'
            else:
                nb = [g[j, i] for j in range(y - 1, y + 2) for i in range(x - 1, x + 2) if 0 <= i < W and 0 <= j < H and block[j, i]]
                out[y, x] = Counter(nb).most_common(1)[0][0] if nb else 'X'
for q in fx.get('walk', []): out[q[1], q[0]] = q[2] if len(q) > 2 else 'c'
for q in fx.get('solid', []): out[q[1], q[0]] = q[2] if len(q) > 2 else '~'
# close pockets not reachable from the spawns
wk = np.isin(out, list(WALK)); seen = np.zeros_like(wk)
q = deque()
for s in d['spawns'].values(): seen[s['y'], s['x']] = True; q.append((s['x'], s['y']))
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        i, j = x + dx, y + dy
        if 0 <= i < W and 0 <= j < H and wk[j, i] and not seen[j, i]: seen[j, i] = True; q.append((i, j))
pk = wk & ~seen
out[pk] = '~'
print('changed', int((out != g).sum()), 'pockets closed', int(pk.sum()))
unre = [(o['x'], o['y']) for o in d['objects'] if not seen[o['y'], o['x']]]
if unre: print('OBJECTS UNREACHED', unre)
print('   ' + ''.join(str(i % 10) for i in range(W)))
for y in range(H):
    print('%2d %s' % (y, ''.join(('o' if out[y, x] not in WALK else 'x') if out[y, x] != g[y, x] else ('.' if out[y, x] in WALK else '#') for x in range(W))))
im = Image.fromarray(A.astype(np.uint8)).convert('RGBA'); ov = Image.new('RGBA', im.size); gd = ImageDraw.Draw(ov)
for y in range(H):
    for x in range(W):
        if out[y, x] not in WALK: gd.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=(255, 0, 0, 70))
        if out[y, x] != g[y, x]: gd.rectangle([x * T + 2, y * T + 2, x * T + T - 3, y * T + T - 3], outline=(255, 255, 0, 255), width=2)
for o in d['objects']: gd.ellipse([o['x'] * T + 10, o['y'] * T + 10, o['x'] * T + 22, o['y'] * T + 22], fill=(0, 255, 255, 255))
Image.alpha_composite(im, ov).save(aid + '/fit.png')
if APPLY:
    d['rows_fit'] = [''.join(r) for r in out]
    json.dump(d, open(aid + '/layout.json', 'w'), ensure_ascii=False, indent=0)
    print('rows_fit written')
