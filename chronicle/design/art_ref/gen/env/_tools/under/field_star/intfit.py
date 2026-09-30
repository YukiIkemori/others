"""Collision of a painted interior (walls = darker stone tops, floor = light flagstones) from the painting alone: per 32-px cell the
fraction of bright floor pixels (lum > FLOOR) decides walkable (> FRAC) or wall. usage: python3 intfit.py <id> <gen.png> [FLOOR=160] [FRAC=0.62]
-> prints ascii ('.' floor, '#' wall) and writes <id>/intfit.json {rows} (floor 'c', wall 'X', outside '~')"""
import sys, json, numpy as np
from PIL import Image
aid, src = sys.argv[1], sys.argv[2]
FL = float(sys.argv[3]) if len(sys.argv) > 3 else 160; FR = float(sys.argv[4]) if len(sys.argv) > 4 else 0.62
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
lum = A @ np.array([.299, .587, .114])
f = (lum > FL).reshape(H, T, W, T).mean((1, 3))
dark = (lum < 50).reshape(H, T, W, T).mean((1, 3))
rows = []
for y in range(H):
    r = ''
    for x in range(W):
        r += '~' if dark[y, x] > 0.6 else ('c' if f[y, x] > FR else 'X')
    rows.append(r)
json.dump(dict(rows=rows), open(aid + '/intfit.json', 'w'))
for y, r in enumerate(rows): print('%2d %s' % (y, r.replace('c', '.').replace('X', '#')))
