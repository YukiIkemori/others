"""Composite one region of an edited painting back into the original (the rest stays pixel-identical).
usage: python3 apply_edit.py <orig.png> <edit.png> <out.png> <x0> <y0> <x1> <y1>   (tiles, inclusive-exclusive, 48 px/tile of the generation)
The edit may be reframed a little: the integer shift (+-16 px) that best matches the edit to the original on a ring around the box is used.
The box is feathered 16 px into the original."""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
o, e, out = sys.argv[1], sys.argv[2], sys.argv[3]
x0, y0, x1, y1 = [int(v) for v in sys.argv[4:8]]
A = np.asarray(Image.open(o).convert('RGB')).astype(np.float32)
B = np.asarray(Image.open(e).convert('RGB').resize((A.shape[1], A.shape[0]), Image.LANCZOS)).astype(np.float32)
H, W = A.shape[:2]; T = W // int(sys.argv[8]) if len(sys.argv) > 8 else 48
X0, Y0, X1, Y1 = x0 * T, y0 * T, x1 * T, y1 * T
box = np.zeros((H, W), bool); box[max(0, Y0):Y1, max(0, X0):X1] = True
ring = ndimage.binary_dilation(box, iterations=64) & ~ndimage.binary_dilation(box, iterations=8)
best, bs = None, (1.0, 0, 0)
E = Image.open(e).convert('RGB')
cy, cx = (Y0 + Y1) // 2, (X0 + X1) // 2
for sc in (0.985, 0.99, 0.995, 1.0, 1.005, 1.01, 1.015):
    Bi = np.asarray(E.resize((int(round(W * sc)), int(round(H * sc))), Image.LANCZOS)).astype(np.float32)
    for dy in range(-20, 21, 2):
        for dx in range(-20, 21, 2):
            ys, xs = np.nonzero(ring[::3, ::3]); ys, xs = ys * 3, xs * 3
            sy, sx = np.clip(ys - dy, 0, Bi.shape[0] - 1), np.clip(xs - dx, 0, Bi.shape[1] - 1)
            d = np.abs(Bi[sy, sx] - A[ys, xs]).mean()
            if best is None or d < best: best, bs = d, (sc, dx, dy)
sc, dx, dy = bs
Bi = np.asarray(E.resize((int(round(W * sc)), int(round(H * sc))), Image.LANCZOS)).astype(np.float32)
Yg, Xg = np.mgrid[0:H, 0:W]
B = Bi[np.clip(Yg - dy, 0, Bi.shape[0] - 1), np.clip(Xg - dx, 0, Bi.shape[1] - 1)]
# colour: match the edit's mean/std to the original on the ring
for c in range(3):
    ma, sa = A[ring, c].mean(), A[ring, c].std() + 1e-3
    mb, sb = B[ring, c].mean(), B[ring, c].std() + 1e-3
    B[..., c] = (B[..., c] - mb) / sb * sa + ma
m = ndimage.gaussian_filter(box.astype(np.float32), 8)
m = np.clip(m * 1.6 - 0.3, 0, 1)[..., None]
C = A * (1 - m) + np.clip(B, 0, 255) * m
Image.fromarray(np.clip(np.rint(C), 0, 255).astype(np.uint8)).save(out)
print('shift', bs, 'ring diff', round(float(best), 2))
