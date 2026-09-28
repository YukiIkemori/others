"""Best global offset (dx, dy in 1x px) of a painting vs the data: walkable cells should not be painted as dark wall tops / deep water.
usage: python3 align.py <layout.json> <gen.png> <mode manor|bog>"""
import json, sys, numpy as np
from PIL import Image
d = json.load(open(sys.argv[1])); W, H = d['w'], d['h']; T = 32
A = np.asarray(Image.open(sys.argv[2]).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
mode = sys.argv[3]
r, g, b = A[..., 0], A[..., 1], A[..., 2]
if mode == 'manor': bad = (r + g + b) / 3 < 70          # dark wall tops
else: bad = (b > r + 8) & (g > r + 8) & (r < 120)      # water
walk = np.array([[c == '.' for c in row] for row in d['walk']])
best = None
for dy in range(-16, 17, 2):
    for dx in range(-16, 17, 2):
        s = 0
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if not walk[y, x]: continue
                y0, x0 = y * T + 6 + dy, x * T + 6 + dx
                s += bad[y0:y0 + 20, x0:x0 + 20].mean()
        if best is None or s < best[0]: best = (s, dx, dy)
print('best offset (painting content sits at +dx,+dy from data):', best)
