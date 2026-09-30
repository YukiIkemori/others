"""描いた絵の縦のずれ（南へ行くほど下がる、fitwarp.py で 1.025 倍 + 8 px）を直す。いちばん下の葦原は縮めて収める → gen1w.png"""
import numpy as np
from PIL import Image
from scipy import ndimage
A = np.asarray(Image.open('gen1.png').convert('RGB')).astype(np.float32)
H, W = A.shape[:2]
y = np.arange(H, dtype=np.float32)
y1 = 1780
sy = np.where(y <= y1, 1.025 * y + 8, (1.025 * y1 + 8) + (y - y1) * ((H - 1) - (1.025 * y1 + 8)) / ((H - 1) - y1))
yy, xx = np.meshgrid(sy, np.arange(W, dtype=np.float32), indexing='ij')
out = np.stack([ndimage.map_coordinates(A[..., c], [yy, xx], order=1, mode='nearest') for c in range(3)], -1)
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save('gen1w.png')
