"""(2026-09-29) 描いた町（caldera/genN.png）は建物・輪が案内図から少し大きく・下へずれて描かれた。今の地図のデータ（戸口・人・物）を
動かさずに済むよう、なめらかな薄板スプライン（thin plate spline）で絵を地図の位置へ引き寄せる。
対応点 = caldera/warp_pts.json {"pts": [[新しい絵の x, y, 地図の x, y], …]}（単位はマス）。usage: python3 caldera_warp.py <gen.png> <out.png>
出力は 1 マス 48 px（案内図と同じ）。外の岩のはみ出しは端の折り返し。"""
import sys, json, os, numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'caldera')
P = np.array(json.load(open(os.path.join(D, 'warp_pts.json')))['pts'], float)
new, old = P[:, :2], P[:, 2:]
rbf = RBFInterpolator(old, new - old, kernel='thin_plate_spline', smoothing=0.02)
A = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
S = A.shape[0]; T = S / 54
N = 54 * 48
# 粗い格子で変位を出して拡大（速さ）
g = 4
ys, xs = np.mgrid[0:N:g, 0:N:g].astype(np.float32)
q = np.stack([(xs + 0.5) / 48, (ys + 0.5) / 48], -1).reshape(-1, 2)
dsp = rbf(q).reshape(ys.shape + (2,))
dx = ndimage.zoom(dsp[..., 0], g, order=1)[:N, :N]; dy = ndimage.zoom(dsp[..., 1], g, order=1)[:N, :N]
Y, X = np.mgrid[0:N, 0:N].astype(np.float32)
sx = ((X + 0.5) / 48 + dx) * T - 0.5; sy = ((Y + 0.5) / 48 + dy) * T - 0.5
res = np.stack([ndimage.map_coordinates(A[..., c], [sy, sx], order=1, mode='mirror') for c in range(3)], -1)
Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(out)
print('max shift tiles', float(np.abs(dsp).max()))
