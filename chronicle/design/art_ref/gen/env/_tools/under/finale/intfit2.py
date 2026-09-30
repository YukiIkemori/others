"""Collision of a painted archive floor from the painting alone: per 32-px cell the fraction of bright floor pixels (lum > FLOOR)
or red carpet pixels decides walkable ('c' floor, 'k' carpet) or wall 'X'; dark outside '~'. usage: python3 intfit2.py <id> <gen.png> [FLOOR=150] [FRAC=0.55]
-> prints ascii and writes <id>/intfit.json {rows}"""
import sys, json, numpy as np
from PIL import Image
aid, src = sys.argv[1], sys.argv[2]
FL = float(sys.argv[3]) if len(sys.argv) > 3 else 150; FR = float(sys.argv[4]) if len(sys.argv) > 4 else 0.55
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
lum = A @ np.array([.299, .587, .114])
red = (A[..., 0] > A[..., 1] + 35) & (A[..., 0] > A[..., 2] + 30)
C = lambda m: m.reshape(H, T, W, T).mean((1, 3))
f = C(lum > FL); rc = C(red); dark = C(lum < 45)
rows = []
for y in range(H):
    r = ''
    for x in range(W):
        if dark[y, x] > 0.6: r += '~'
        elif rc[y, x] > 0.45: r += 'k'
        elif f[y, x] + rc[y, x] > FR: r += 'c'
        else: r += 'X'
    rows.append(r)
json.dump(dict(rows=rows), open(aid + '/intfit.json', 'w'))
print('   ' + ''.join(str(i % 10) for i in range(W)))
for y, r in enumerate(rows): print('%2d %s' % (y, r.replace('c', '.').replace('X', '#')))
