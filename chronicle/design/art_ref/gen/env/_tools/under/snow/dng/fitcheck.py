"""Collision fit check: per cell, how open the painting looks vs the map data (walkable cells from fullmap.js, tile + object collision).
red  = walkable in the data but the painting looks blocked there (rock, forest, face)
cyan = solid in the data (tile, not an object) but the painting looks like open ground, next to walkable ground
usage: python3 fitcheck.py <map> <aligned.png> <out.png> [open_lum=165]   -> prints the cell lists"""
import sys, json, numpy as np
from PIL import Image, ImageDraw
m, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
TH = float(sys.argv[4]) if len(sys.argv) > 4 else 165
d = json.load(open(m + '/layout_data.json')); W, H = d['w'], d['h']; T = 32
op = json.load(open(m + '/open.json'))
L = d['legend']
im = Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)
A = np.asarray(im).astype(float)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
Y = 0.299 * r + 0.587 * g + 0.114 * b
wk0 = np.array([[c == '.' for c in row] for row in d['walk']])
fc = np.zeros((H, W), bool)
for x, y, j, rr in op['face']: fc[y, x] = True
cellY = Y.reshape(H, T, W, T)[:, 8:24, :, 8:24].mean(axis=(1, 3))
sol = ~wk0 & ~fc
if len(sys.argv) <= 4 and wk0.any() and sol.any():
    TH = (np.median(cellY[wk0]) + np.median(cellY[sol])) / 2
print(m, 'threshold', round(float(TH), 1), 'walk', round(float(np.median(cellY[wk0])), 1), 'solid', round(float(np.median(cellY[sol])), 1))
tan = (r > 120) & (r - b > 20) & (r >= g - 5) & (Y > TH - 40)
openpx = (Y > TH) | tan
# interior band of the cell (ignore 4 px at the edges)
fr = np.zeros((H, W))
for y in range(H):
    for x in range(W):
        fr[y, x] = openpx[y * T + 4:(y + 1) * T - 4, x * T + 4:(x + 1) * T - 4].mean()
solid_tile = lambda x, y: bool(L.get(op['rows'][y][x], {}).get('solid')) or L.get(op['rows'][y][x], {}).get('walk') is False
wk = lambda x, y: 0 <= x < W and 0 <= y < H and d['walk'][y][x] == '.'
red, cyan = [], []
for y in range(H):
    for x in range(W):
        if wk(x, y) and fr[y, x] < 0.35: red.append((x, y, round(fr[y, x], 2)))
        if solid_tile(x, y) and not fc[y, x] and fr[y, x] > 0.8 and any(wk(x + i, y + j) for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1))): cyan.append((x, y, round(fr[y, x], 2)))
dr = ImageDraw.Draw(im)
for x, y, f in red: dr.rectangle([x * T + 2, y * T + 2, x * T + T - 3, y * T + T - 3], outline=(255, 0, 0), width=3)
for x, y, f in cyan: dr.rectangle([x * T + 2, y * T + 2, x * T + T - 3, y * T + T - 3], outline=(0, 255, 255), width=3)
im.save(out)
print(m, 'red (walkable, painted blocked):', len(red), red)
print(m, 'cyan (solid, painted open):', len(cyan), cyan)
