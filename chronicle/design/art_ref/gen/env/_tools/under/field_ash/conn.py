"""Every spawn / exit of a fitted area reachable from its first spawn (rows_fit + fix solids as tomap writes them). usage: python3 conn.py <id> ..."""
import json, sys, os
from collections import deque
WALK = set(',;".:s_=cuk')
for aid in sys.argv[1:]:
    d = json.load(open(aid + '/layout.json')); rows = [list(r) for r in (d.get('rows_fit') or d['rows'])]
    fx = json.load(open(aid + '/fix.json')) if os.path.exists(aid + '/fix.json') else {}
    for q in fx.get('solid', []): rows[q[1]][q[0]] = q[2] if len(q) > 2 else 'X'
    for k, v in fx.get('spawns', {}).items(): d['spawns'][k] = v
    H, W = len(rows), len(rows[0])
    sp = list(d['spawns'].items()); s0 = sp[0][1]
    seen = {(s0['x'], s0['y'])}; q = deque([(s0['x'], s0['y'])])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            i, j = x + dx, y + dy
            if 0 <= i < W and 0 <= j < H and (i, j) not in seen and rows[j][i] in WALK: seen.add((i, j)); q.append((i, j))
    bad = [k for k, s in sp if (s['x'], s['y']) not in seen]
    print(aid, 'from', sp[0][0], 'unreached spawns:', bad or 'none', 'walk', len(seen))
