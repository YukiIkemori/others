"""Clean the intfit rows (intfit.py) and apply hand cells: majority smoothing of 1-cell specks, then <id>/intfix.json
{open: [[x, y, ch]], solid: [[x, y]], open_rect: [[x, y, w, h, ch]], solid_rect: [[x, y, w, h]]} -> writes layout.json rows_fit and prints ascii.
usage: python3 intclean.py <id> [passes=2]"""
import sys, json, os
aid = sys.argv[1]; PASSES = int(sys.argv[2]) if len(sys.argv) > 2 else 2
d = json.load(open(aid + '/layout.json')); W, H = d['w'], d['h']
g = [list(r) for r in json.load(open(aid + '/intfit.json'))['rows']]
WALK = set('ck')
for _ in range(PASSES):
    n = [r[:] for r in g]
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            nb = [g[y][x + 1], g[y][x - 1], g[y + 1][x], g[y - 1][x]]
            w = sum(c in WALK for c in nb)
            if g[y][x] in WALK and w <= 1 and g[y][x] != 'k': n[y][x] = 'X'
            elif g[y][x] == 'X' and w >= 3: n[y][x] = 'c'
    g = n
fx = json.load(open(aid + '/intfix.json')) if os.path.exists(aid + '/intfix.json') else {}
for r in fx.get('open_rect', []):
    for j in range(r[1], r[1] + r[3]):
        for i in range(r[0], r[0] + r[2]): g[j][i] = r[4] if len(r) > 4 else 'c'
for r in fx.get('solid_rect', []):
    for j in range(r[1], r[1] + r[3]):
        for i in range(r[0], r[0] + r[2]): g[j][i] = 'X'
for q in fx.get('open', []): g[q[1]][q[0]] = q[2] if len(q) > 2 else 'c'
for q in fx.get('solid', []): g[q[1]][q[0]] = 'X'
# 届かない床は壁に（最初の spawn から）
from collections import deque
seen = set(); dq = deque()
for s in d['spawns'].values(): dq.append((s['x'], s['y'])); seen.add((s['x'], s['y']))
while dq:
    x, y = dq.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        i, j = x + dx, y + dy
        if 0 <= i < W and 0 <= j < H and (i, j) not in seen and g[j][i] not in 'X~': seen.add((i, j)); dq.append((i, j))
closed = 0
for y in range(H):
    for x in range(W):
        if g[y][x] not in 'X~' and (x, y) not in seen: g[y][x] = 'X'; closed += 1
d['rows_fit'] = [''.join(r) for r in g]
json.dump(d, open(aid + '/layout.json', 'w'), ensure_ascii=False, indent=0)
print('closed', closed)
print('   ' + ''.join(str(i % 10) for i in range(W)))
for y, r in enumerate(d['rows_fit']): print('%2d %s' % (y, r.replace('c', '.').replace('X', '#')))
