"""当たりのつながりの確かめ: 石段 e・橋 b を閉じたとき、家の段・敷石へ漏れて行けないか。人・物・戸口の前に行けるか。"""
import json, sys, os
from collections import deque
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'caldera')
rows = json.load(open(os.path.join(D, 'rows_fit.json')))
d = json.load(open(os.path.join(D, 'map_dump.json')))
blds = {(o['x'] + i, o['y'] + j) for o in d['objects'] if o['type'] == 'building' for i in range(o['w']) for j in range(o['h'])}
doors = {(o['door']['x'], o['door']['y']) for o in d['objects'] if o['type'] == 'building'}
def flood(start, block=''):
    seen = {start}; q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            u, v = x + dx, y + dy
            if 0 <= u < 54 and 0 <= v < 54 and (u, v) not in seen and rows[v][u] in 'aceb' and rows[v][u] not in block and ((u, v) not in blds or (u, v) in doors):
                seen.add((u, v)); q.append((u, v))
    return seen
full = flood((2, 26))
noe = flood((2, 26), 'e')
nob = flood((12, 29), 'b')
print('reach all', len(full), 'walkable', sum(c in 'aceb' for r in rows for c in r))
print('rim w/o stairs reaches terrace (12,29)?', (12, 29) in noe, ' size', len(noe))
print('terrace w/o bridges reaches flagstone (20,22)?', (18, 27) in nob or (22, 20) in nob)
bad = [(n.get('id'), n['x'], n['y']) for n in d['npcs'] + d['objects'] if n.get('type') != 'building' and n.get('id') != 'lava_glow' and not any((n['x'] + a, n['y'] + b) in full for a, b in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)))]
print('unreachable objects/npcs', bad)
print('door fronts unreachable', [dd for dd in doors if (dd[0], dd[1] + 1) not in full])
walk = [(x, y) for y in range(54) for x in range(54) if rows[y][x] in 'aceb' and (x, y) not in full and (x, y) not in blds]
print('walkable pockets', len(walk), walk[:40])
