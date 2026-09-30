"""建物ごとの位置ずれ（新しい絵 → 旧の絵、@32 px）: 戸口のまわりの窓で、勾配の相互相関の最大を探す。usage: python3 caldera_local.py <gen.png> [sx sy dx dy]"""
import sys, json, numpy as np, os
from PIL import Image
from scipy import ndimage
src = sys.argv[1]; sys.argv = sys.argv[:1] + ['x'] + sys.argv[2:]
import caldera as C
old = np.asarray(Image.open(os.path.join(C.UNDER, 'caldera@32.png')).convert('L')).astype(np.float32)
new = np.asarray(Image.open(src).convert('L').resize((1728, 1728), Image.BOX)).astype(np.float32)
def grad(a): return np.hypot(ndimage.sobel(a, 0), ndimage.sobel(a, 1))
go, gn = grad(old), grad(new)
d = json.load(open(os.path.join(C.UNDER, 'caldera.json')))
R = 48
for dr in d['doors32']:
    x, y = dr['x'], dr['y']
    a = go[y - 110:y + 20, x - 90:x + 90]
    best = (-1, 0, 0)
    for oy in range(-R, R + 1, 2):
        for ox in range(-R, R + 1, 2):
            b = gn[y - 110 + oy:y + 20 + oy, x - 90 + ox:x + 90 + ox]
            if b.shape != a.shape: continue
            aa, bb = a - a.mean(), b - b.mean()
            s = (aa * bb).sum() / np.sqrt((aa * aa).sum() * (bb * bb).sum() + 1e-6)
            if s > best[0]: best = (s, ox, oy)
    print(dr['id'], 'door', x, y, 'shift in new', best[1], best[2], 'score', round(best[0], 2))
