"""Alignment score of 1x images against the guide: correlation of blurred gradient magnitude of the guide's class map (floor / solid edges)
with the painting's. usage: python3 score.py <map> <img@32> [<img@32> ...]"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
m = sys.argv[1]
d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'], d['h']; T = 32
op = json.load(open('maps/%s/open.json' % m)); face = {(x, y) for x, y, j, r in op['face']}
cl = np.array([[0 if not d['legend'].get(op['rows'][y][x], {'solid': True}).get('solid') else (1 if (x, y) in face else 2) for x in range(W)] for y in range(H)], float)
G = np.kron(cl, np.ones((T, T)))
def gm(a, s=3): a = ndimage.gaussian_filter(a, 1.0); return ndimage.gaussian_filter(np.hypot(ndimage.sobel(a, 0), ndimage.sobel(a, 1)), s)
g = gm(G); g = (g - g.mean()) / g.std()
for f in sys.argv[2:]:
    A = np.asarray(Image.open(f).convert('RGB').resize((W * T, H * T))).astype(float) @ np.array([0.299, 0.587, 0.114])
    p = gm(A); p = (p - p.mean()) / p.std()
    print('%.4f' % (g * p).mean(), f)
