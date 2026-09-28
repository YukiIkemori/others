"""Fill areas the model left as flat guide colour (no texture) with painted texture cloned from a source patch of the same painting.
usage: python3 fillflat.py <src.png> <out.png> <sx0,sy0,sx1,sy1 source patch in px | other.png (an aligned painting of the same map, same size)> [std=4]"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
src, out, box = sys.argv[1], sys.argv[2], sys.argv[3]
th = float(sys.argv[4]) if len(sys.argv) > 4 else 4
A = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
Y = A @ np.array([0.299, 0.587, 0.114], np.float32)
m1 = ndimage.uniform_filter(Y, 9); m2 = ndimage.uniform_filter(Y * Y, 9)
flat = np.sqrt(np.maximum(m2 - m1 * m1, 0)) < th
flat = ndimage.binary_opening(flat, iterations=3)
lab, n = ndimage.label(flat)
sizes = ndimage.sum(flat, lab, range(1, n + 1))
keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 5000])
keep = ndimage.binary_dilation(keep, iterations=3)
H, W = Y.shape
if box.endswith('.png'):
    big = np.asarray(Image.open(box).convert('RGB').resize((W, H), Image.BOX)).astype(np.float32)
else:
    x0, y0, x1, y1 = [int(v) for v in box.split(',')]
    P = A[y0:y1, x0:x1]
    # tile the patch, mirrored alternately so the seams match
    row = np.concatenate([P, P[:, ::-1]], 1); tile = np.concatenate([row, row[::-1]], 0)
    reps = (H // tile.shape[0] + 2, W // tile.shape[1] + 2, 1)
    big = np.tile(tile, reps)[:H, :W]
al = ndimage.gaussian_filter(keep.astype(np.float32), 3)[..., None]
B = A * (1 - al) + big * al
Image.fromarray(np.clip(np.rint(B), 0, 255).astype(np.uint8)).save(out)
print('filled px', int(keep.sum()), 'of', H * W)
