"""(2026-10-04 見やすさの作り直し) For a clean painting (meta clean: flat calm grass, clear masses), read the collision straight off the colours:
a solid cell that is painted as plain grass / road / sand opens, a walkable cell with tree, water or stone in it closes.
Writes the result as explicit cells into <id>/fix.json (open_auto / solid_auto, applied by fit.py like open / solid) so a re-run is reproducible.
usage: python3 clean_fix.py <id> <gen.png> [--write]   (after fit.py --apply; then fit.py --apply again. --write merges into what fix.json has)"""
import sys, json, numpy as np
from PIL import Image
aid, src = sys.argv[1], sys.argv[2]
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
rows = [list(r) for r in d['rows_fit']]; lay = d['rows']
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
R_, G_, B_ = A[..., 0], A[..., 1], A[..., 2]
lum = A @ np.array([.299, .587, .114]); sat = A.max(-1) - A.min(-1)
grass = (G_ - B_ > 30) & (np.abs(G_ - R_) < 18) & (lum > 88) & (lum < 160)
road = (R_ - G_ > 10) & (G_ - B_ > 25) & (lum > 112)
water = (B_ > R_ + 35) & (B_ > G_ + 5)
dark = (lum < 80) & ~water
stone = (sat < 34) & (lum > 80) & (lum < 210) & ~grass & ~road
C4 = lambda m: m.reshape(H, T, W, T).mean((1, 3))
fg, fr, fw, fd, fs = C4(grass), C4(road), C4(water), C4(dark), C4(stone)
WALK = set(',;".:s_=c')
prot = set()
for e in d['exits']:
    for j in range(e['h']):
        for i in range(e['w']): prot.add((e['x'] + i, e['y'] + j))
for s in d['spawns'].values(): prot.add((s['x'], s['y']))
marks = {(x, y) for m in d['marks'] for x, y in m['cells']}
_fx0 = json.load(open(aid + '/fix.json'))
hand = {(q[0], q[1]) for q in _fx0.get('solid', []) + _fx0.get('open', [])}   # hand cells win: never auto
prot |= hand
op, so = [], []
for y in range(H):
    for x in range(W):
        if (x, y) in prot or (x, y) in marks or lay[y][x] in '=c': continue
        c = rows[y][x]; w = c in WALK
        if not w and ((fg[y, x] + fr[y, x] >= 0.8 and fw[y, x] + fd[y, x] + fs[y, x] < 0.12)
                      or (c == 'r' and fg[y, x] + fr[y, x] >= 0.6 and fw[y, x] + fd[y, x] < 0.25 and fs[y, x] < 0.2)):   # 'r': the fit reads a shore lip or a wall's foot as rock
            op.append([x, y, '.' if fr[y, x] > 0.5 else ',']); rows[y][x] = op[-1][2]
        elif w and fw[y, x] + fd[y, x] + fs[y, x] >= (0.55 if lay[y][x] == 's' else 0.3):   # the beach strip: only where the sea clearly covers it
            k = max((fw[y, x], 'w'), (fd[y, x], 'T'), (fs[y, x], 'r'))[1]
            if k == 'w' and '~' in ''.join(lay) and fw[y, x] > 0 and y > H * 0.7: k = '~'
            so.append([x, y, k]); rows[y][x] = k
print(aid, 'open', len(op), 'solid', len(so))
for y in range(H): print('%2d %s' % (y, ''.join(rows[y])))
if '--write' in sys.argv:
    fx = json.load(open(aid + '/fix.json'))
    # merged with what is already there (fit.py applies these, so a re-run after it finds only the rest): stays reproducible
    for k, new in (('open_auto', op), ('solid_auto', so)):
        cur = {(q[0], q[1]): q for q in fx.get(k, [])}
        for q in new: cur[(q[0], q[1])] = q
        fx[k] = sorted((q for q in cur.values() if (q[0], q[1]) not in hand), key=lambda q: (q[1], q[0]))
    json.dump(fx, open(aid + '/fix.json', 'w'), ensure_ascii=False, indent=0)
