"""Draft collision for a painted town from the painting alone (the painter drifted from the guide): per 32-px cell
roof (blue/teal slate, domes) / tree (dark green) -> solid; grass -> ','; the rest (beige) -> paving 'c'; then building facades:
below each roof component down to its bottom edge + FACADE rows -> 'X'; stone wall ribbons (long beige runs bordered by grass on
both sides with battlement texture) are left to hand fixes (fix.json solid_rect / open_rect).
usage: python3 townfit.py <id> <gen.png> [facade=2]  -> prints rows, writes <id>/draft.json"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
aid, src = sys.argv[1], sys.argv[2]; FAC = int(sys.argv[3]) if len(sys.argv) > 3 else 2
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
R_, G_, B_ = A[..., 0], A[..., 1], A[..., 2]
lum = A @ np.array([.299, .587, .114])
C = lambda m: m.reshape(H, T, W, T).mean((1, 3))
roof = C((B_ > R_ + 12) & (lum < 150) & (B_ > G_ - 10))
tree = C((G_ > R_ + 8) & (lum < 80))
grass = C((G_ > R_ + 12) & (G_ > B_ + 5) & (lum >= 70))
g = np.full((H, W), 'c', dtype='<U1')
g[grass > 0.5] = ','
g[tree > 0.35] = 'T'
rf = roof > 0.4
g[rf] = 'X'
lab, n = ndimage.label(rf)
for i in range(1, n + 1):
    ys, xs = np.nonzero(lab == i)
    if len(ys) < 3: continue
    y1 = ys.max()
    for x in range(xs.min(), xs.max() + 1):
        for y in range(y1 + 1, min(H, y1 + 1 + FAC)): g[y, x] = 'X'
rows = [''.join(r) for r in g]
json.dump(dict(rows=rows), open(aid + '/draft.json', 'w'))
print('\n'.join('%2d %s' % (y, r) for y, r in enumerate(rows)))
