"""(2026-09-29) 描いた町の絵が案内図より少し大きく・ずれて描かれることがあるので、建物（案内図に貼った今の絵）で位置合わせの
拡大率と平行移動を探す（x, y 別の拡大率）。usage: python3 caldera_reg.py <gen.png> -> caldera/reg.json"""
import sys, json, numpy as np, os
from PIL import Image
from scipy import ndimage
sys.argv, src = sys.argv[:1] + ['x'], sys.argv[1]
import caldera as C
N = 864; t = N / 54
old = np.asarray(Image.open(os.path.join(C.UNDER, 'caldera@32.png')).convert('L').resize((N, N), Image.BOX)).astype(np.float32)
new = Image.open(src).convert('L')
k = ndimage.zoom(C.keep_mask(16).astype(np.float32), 1) > 0.5
k &= ~ndimage.binary_dilation(np.zeros_like(k))
def grad(a): return np.hypot(ndimage.sobel(a, 0), ndimage.sobel(a, 1))
go = grad(old)
S = new.size[0]
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
na = np.asarray(new.resize((N * 2, N * 2), Image.BOX)).astype(np.float32); gn = grad(na)
def score(sx, sy, dx, dy):
    # 新しい絵の座標 = 中心から (旧 - c) * s + c + d （単位: 旧 N px）
    c = N / 2
    u = ((xx - c) * sx + c + dx) * 2; v = ((yy - c) * sy + c + dy) * 2
    w = ndimage.map_coordinates(gn, [v, u], order=1, mode='constant')
    a, b = go[k], w[k]
    a = a - a.mean(); b = b - b.mean()
    return float((a * b).sum() / np.sqrt((a * a).sum() * (b * b).sum() + 1e-6))
best = (-1, 1, 1, 0, 0)
for sx in np.arange(0.94, 1.12, 0.01):
    for dy in np.arange(-24, 25, 3):
        s = score(sx, sx, 0, dy)
        if s > best[0]: best = (s, sx, sx, 0, dy)
print('coarse', best)
for it in range(3):
    s0, sx, sy, dx, dy = best; st = [0.004, 0.002, 0.001][it]; sd = [1.5, 0.75, 0.35][it]
    for a in (-2, -1, 0, 1, 2):
        for b in (-2, -1, 0, 1, 2):
            for e in (-2, -1, 0, 1, 2):
                for f in (-2, -1, 0, 1, 2):
                    s = score(sx + a * st, sy + b * st, dx + e * sd, dy + f * sd)
                    if s > best[0]: best = (s, sx + a * st, sy + b * st, dx + e * sd, dy + f * sd)
    print('fine', it, best)
s, sx, sy, dx, dy = best
json.dump(dict(score=s, sx=sx, sy=sy, dx=dx / N, dy=dy / N), open(os.path.join(C.D, 'reg.json'), 'w'), indent=1)
