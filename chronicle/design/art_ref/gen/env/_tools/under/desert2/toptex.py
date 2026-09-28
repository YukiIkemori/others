"""Add rock texture to flat painted wall tops: high-pass of the tile render (layout_albedo) inside wall-top cells, soft 4 px mask.
usage: python3 toptex.py <map> <aligned.png> <out.png> [k]"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
m, src, out = sys.argv[1:4]; k = float(sys.argv[4]) if len(sys.argv) > 4 else 0.6
d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'], d['h']; T = 32
op = json.load(open('maps/%s/open.json' % m)); face = {(x, y) for x, y, j, r in op['face']}
top = np.array([[bool(d['legend'].get(op['rows'][y][x], {'solid': True}).get('solid') and (x, y) not in face) for x in range(W)] for y in range(H)], float)
M = ndimage.gaussian_filter(np.kron(top, np.ones((T, T))), 3)
M = np.clip((M - 0.5) * 3 + 0.5, 0, 1)
A = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
O = np.asarray(Image.open('maps/%s/layout_albedo.png' % m).convert('RGB')).astype(np.float32)
lo = O @ np.array([0.299, 0.587, 0.114]); hp = lo - ndimage.gaussian_filter(lo, 6)
A = np.clip(A + (hp * k * M)[..., None], 0, 255)
Image.fromarray(np.rint(A).astype(np.uint8)).save(out)
