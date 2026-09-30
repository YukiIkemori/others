"""Painted pale objects (marble columns, altars) inside a rect: cells whose painting is > thr bright pale pixels become solid, other
solid cells there become open grass. usage: python3 whites.py <id> <gen.png> x y w h [thr=0.22] -> merges into <id>/fix.json (solid, open)"""
import sys, json, os, numpy as np
from PIL import Image
aid, src = sys.argv[1], sys.argv[2]; x0, y0, w, h = map(int, sys.argv[3:7]); thr = float(sys.argv[7]) if len(sys.argv) > 7 else 0.22
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
lum = A @ np.array([.299, .587, .114]); sat = A.max(-1) - A.min(-1)
pale = (lum > 185) & (sat < 40)
rows = d.get('rows_fit') or d['rows']
fp = aid + '/fix.json'; fx = json.load(open(fp)) if os.path.exists(fp) else {}
sol, opn = [], []
for y in range(y0, y0 + h):
    for x in range(x0, x0 + w):
        f = pale[y * T:(y + 1) * T, x * T:(x + 1) * T].mean()
        if f > thr: sol.append([x, y, 'X'])
        elif rows[y][x] in 'XTr': opn.append([x, y, ','])
sk = {(q[0], q[1]) for q in sol}
fx['solid'] = [q for q in fx.get('solid', []) if not (x0 <= q[0] < x0 + w and y0 <= q[1] < y0 + h)] + sol
fx['open'] = [q for q in fx.get('open', []) if (q[0], q[1]) not in sk] + opn
json.dump(fx, open(fp, 'w'), ensure_ascii=False, indent=0)
print('solid', len(sol), 'open', len(opn))
