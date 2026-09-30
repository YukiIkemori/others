"""七の層の破れ目の形を直す（描いた絵は白い四角だった）: 白い四角の中を、ぎざぎざの楕円の外だけ上の岩の絵で埋め、縁を暗い岩の縁取りにする。
usage: python3 breach_fix.py mine_3/gen1.png mine_3/gen1b.png"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
A = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
H, W = A.shape[:2]; T = 48
wm = A.min(-1) > 215
lab, n = ndimage.label(wm); sz = ndimage.sum(wm, lab, range(n + 1)); rect = lab == np.argmax(sz)
rect0 = ndimage.binary_dilation(rect, iterations=4)
ys, xs = np.nonzero(rect0); cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2 + 6
rx, ry = (xs.max() - xs.min()) / 2 * 0.93, (ys.max() - ys.min()) / 2 * 0.86
Y, X = np.mgrid[0:H, 0:W]
ang = np.arctan2((Y - cy) / ry, (X - cx) / rx)
rng = np.random.RandomState(7)
wob = sum(rng.uniform(0.02, 0.07) * np.sin(k * ang + rng.uniform(0, 6.3)) for k in (3, 5, 8, 13))
d = np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2) / (1 + wob)
hole = d < 1
# 外側（四角と、その周りに描かれた石の縁 30 px の中で楕円の外。下の床の側は残す）: 左の岩（同じ行、四角の幅ぶん左）を写す
rect = ndimage.binary_dilation(rect0, iterations=30) & (Y < ys.max() - 4)
out = rect & ~hole
wid = xs.max() - xs.min() + 80
B = A.copy()
src_x = np.clip(X - wid, 0, W - 1)
B[out] = A[Y[out], src_x[out]]
# 縁: 穴の縁に暗い岩の縁取り（外に 7 px）と、内側に薄い灰色の影（奥行き）
rim = (d >= 1) & (d < 1.10) & ndimage.binary_dilation(rect, iterations=10)
B[rim] = B[rim] * 0.45
inner = hole & (d > 0.86)
t = ((d[inner] - 0.86) / 0.14)[:, None]
B[inner] = B[inner] * (1 - 0.35 * t) + np.array([150, 150, 160]) * 0.35 * t
Image.fromarray(np.clip(B, 0, 255).astype(np.uint8)).save(sys.argv[2])
print('breach', int(hole.sum()), 'filled', int(out.sum()))
