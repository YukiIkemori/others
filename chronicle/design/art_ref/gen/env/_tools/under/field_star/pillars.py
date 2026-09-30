"""Painted pale pillars (marble columns): connected blobs of pale pixels inside a rect -> the base cell and the cell above it solid;
other solid cells in the rect that are not listed in keep become open. usage: python3 pillars.py <id> <gen.png> x y w h [minpx=250]"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
aid, src = sys.argv[1], sys.argv[2]; x0, y0, w, h = map(int, sys.argv[3:7]); mn = int(sys.argv[7]) if len(sys.argv) > 7 and not sys.argv[7].startswith('-') else 250
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
lum = A @ np.array([.299, .587, .114]); sat = A.max(-1) - A.min(-1)
pale = (lum > 175) & (sat < 45)
sub = np.zeros_like(pale); sub[y0 * T:(y0 + h) * T, x0 * T:(x0 + w) * T] = pale[y0 * T:(y0 + h) * T, x0 * T:(x0 + w) * T]
lab, n = ndimage.label(ndimage.binary_opening(sub, iterations=1))
sol = set()
for i in range(1, n + 1):
    ys, xs = np.nonzero(lab == i)
    if len(ys) < mn: continue
    bx, by = int(xs.mean() // T), int((ys.max() - 4) // T)
    print('blob', len(ys), 'cells', (bx, by), 'h', (ys.max() - ys.min()) / T)
    sol.add((bx, by))
    if (ys.max() - ys.min()) > T * 1.2: sol.add((bx, by - 1))
rows = d.get('rows_fit') or d['rows']; rows0 = d['rows']
NOT = set()
for a_ in sys.argv:
    if a_.startswith('--not='): NOT |= {tuple(map(int, c.split(','))) for c in a_[6:].split(';')}
sol -= NOT
fp = aid + '/fix.json'; fx = json.load(open(fp)) if os.path.exists(fp) else {}
inr = lambda q: x0 <= q[0] < x0 + w and y0 <= q[1] < y0 + h
keep = {tuple(q[:2]) for q in fx.get('keep_solid', [])}
fx['solid'] = [q for q in fx.get('solid', []) if not inr(q)] + [[x, y, 'X'] for (x, y) in sorted(sol)]
opn = [[x, y, ','] for y in range(y0, y0 + h) for x in range(x0, x0 + w) if (x, y) not in sol and (x, y) not in keep and (rows[y][x] in 'XTr' or rows0[y][x] in 'XTr')]
fx['open'] = [q for q in fx.get('open', []) if not inr(q)] + opn
json.dump(fx, open(fp, 'w'), ensure_ascii=False, indent=0)
print('solid', len(sol), 'open', len(opn))
