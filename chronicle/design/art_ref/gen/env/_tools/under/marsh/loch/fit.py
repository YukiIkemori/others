"""Compare the painting with the collision grid: walkable cells that are painted water, and water cells painted as land. usage: python3 fit.py proc_last.png"""
import json, sys, numpy as np
from PIL import Image
d = json.load(open('layout_data.json')); W, H = d['w'], d['h']; T = 32
A = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
water = (b > r + 8) & (g > r + 8) & (r < 120)
wet, dry = [], []
for y in range(H):
    for x in range(W):
        f = water[y * T + 4:(y + 1) * T - 4, x * T + 4:(x + 1) * T - 4].mean()
        ch = d['rows'][y][x]; wk = d['walk'][y][x] == '.'
        if wk and f > 0.55 and ch in 'g': wet.append([x, y, round(f, 2)])
        if ch == '~' and f < 0.12: dry.append([x, y, round(f, 2)])
print('walkable but painted water:', len(wet), wet)
print('lake but painted land:', len(dry), dry)
