"""Single painted objects the fit misreads (marsh): layout willows 'T' the fit opened and layout boulders 'r' / isolated solids it kept.
A layout willow cell stays solid (the model paints every guide willow in place; the classifier misses the small crowns); a lone boulder cell stays solid only
when the painting shows grey stone there; otherwise it opens to grass. usage: python3 objfix.py <id> <gen.png> [--apply] (after fit.py --apply)"""
import sys, json, numpy as np
from PIL import Image
aid, src = sys.argv[1], sys.argv[2]
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
lay = d['rows']; fit = [list(r) for r in d['rows_fit']]
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
R_, G_, B_ = A[..., 0], A[..., 1], A[..., 2]
lum = A @ np.array([.299, .587, .114]); sat = A.max(-1) - A.min(-1)
crown = (G_ > R_ + 10) & (G_ > B_ + 40) & (lum > 85)                 # light willow leaves
grey = (sat < 24) & (lum > 70) & (lum < 190)                         # stone
C4 = lambda m: m.reshape(H, T, W, T).mean((1, 3))
fc, fg = C4(crown.astype(float)), C4(grey.astype(float))
# compact grey blobs (a boulder is a small round grey mass; mud patches and paths are large or stringy)
from scipy import ndimage
lab, n = ndimage.label(ndimage.binary_opening(grey, iterations=1))
objs = ndimage.find_objects(lab); area = ndimage.sum(grey, lab, range(1, n + 1))
okc = np.zeros(n + 1, bool)
for k, sl in enumerate(objs):
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if 40 <= area[k] <= 1200 and h <= 56 and w <= 56 and area[k] / (h * w) > 0.35: okc[k + 1] = True
fb = C4(okc[lab].astype(float))
WALK = set(',;".:s_=cuk')
prot = set()
for e in d['exits']:
    for j in range(e['h']):
        for i in range(e['w']): prot.add((e['x'] + i, e['y'] + j))
for s in d['spawns'].values(): prot.add((s['x'], s['y']))
for o in d['objects'] + d['meta'].get('npcs', []):
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): prot.add((o['x'] + dx, o['y'] + dy))
marks = {(x, y) for m in d['marks'] for x, y in m['cells']}
ch = []
for y in range(H):
    for x in range(W):
        if (x, y) in prot or (x, y) in marks: continue
        l, f = lay[y][x], fit[y][x]
        if l == 'T' and f in WALK: ch.append((x, y, 'T', 1))   # the painting traces the guide's willows (one tree per guide cell); the fit reads the small crowns as grass
        elif f in ',;"s' and fb[y, x] >= 0.08 and not any(0 <= x + i < W and 0 <= y + j < H and lay[y + j][x + i] in '.:=c' for i in (-1, 0, 1) for j in (-1, 0, 1)):
            ch.append((x, y, 'r', round(fb[y, x], 2)))   # a painted grey boulder on the grass that the fit left open
        elif f == 'r' and fg[y, x] < 0.06 and fc[y, x] < 0.2:
            nb = [fit[j][i] for i, j in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= i < W and 0 <= j < H]
            if sum(n in WALK for n in nb) >= 3: ch.append((x, y, ',', round(fg[y, x], 2)))
print(aid, len(ch), ch[:60])
if '--apply' in sys.argv:
    for x, y, c, _ in ch: fit[y][x] = c
    d['rows_fit'] = [''.join(r) for r in fit]
    json.dump(d, open(aid + '/layout.json', 'w'), ensure_ascii=False, indent=0)
