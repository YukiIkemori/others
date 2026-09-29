"""Snow field collision helper: walkable open cells whose painting shows a dark object (rock, stump, post, shrub) and solid rock/tree
cells whose painting is plain bright snow. usage: python3 blobs.py <id> [thr=0.10] [--apply]
--apply writes the found cells into <id>/fix.json (solid [x, y, 'r'] / open [x, y, ','])."""
import sys, json, os, numpy as np
from PIL import Image
aid = sys.argv[1]; thr = float(sys.argv[2]) if len(sys.argv) > 2 and not sys.argv[2].startswith('-') else 0.10
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
rows = d.get('rows_fit') or d['rows']
A = np.asarray(Image.open('/home/user/others/chronicle/v2/assets/env/field/under/%s@32.png' % aid).convert('RGB')).astype(float)
L = A @ [0.299, 0.587, 0.114]
snow = np.percentile(L, 80)
tan = (A[..., 0] > A[..., 2] + 14)                 # the road's packed earth (warm)
dark = (L < snow * 0.62) & ~tan
bright = L > snow * 0.85
protect = set()
for o in d['objects']:
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): protect.add((o['x'] + dx, o['y'] + dy))
for s in d['spawns'].values(): protect.add((s['x'], s['y']))
for e in d['exits']:
    for j in range(e['h']):
        for i in range(e['w']): protect.add((e['x'] + i, e['y'] + j))
solid, opn = [], []
for y in range(H):
    for x in range(W):
        c = rows[y][x]
        cd = dark[y * T + 6:(y + 1) * T - 2, x * T + 5:(x + 1) * T - 5].mean()
        cb = bright[y * T:(y + 1) * T, x * T:(x + 1) * T].mean()
        ct = tan[y * T:(y + 1) * T, x * T:(x + 1) * T].mean()
        if c in ',;"' and cd > thr and ct <= 0.3 and (x, y) not in protect: solid.append((x, y, round(float(cd), 2)))
        ct = tan[y * T:(y + 1) * T, x * T:(x + 1) * T].mean()
        if c in 'rTb' and ct > 0.45 and d['rows'][y][x] in '.:' and (x, y) not in protect: opn.append((x, y, round(float(ct), 2))); continue
        if c in 'rT' and cb > 0.93 and (x, y) not in protect:
            nb = [rows[j][i] for i, j in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= i < W and 0 <= j < H]
            if sum(n in ',;".:s' for n in nb) >= 2: opn.append((x, y, round(float(cb), 2)))
print('dark on walkable', solid)
print('plain snow / road on solid', opn)
if '--apply' in sys.argv:
    f = aid + '/fix.json'; fx = json.load(open(f)) if os.path.exists(f) else {}
    have = {tuple(q[:2]) for q in fx.get('solid', [])} | {tuple(q[:2]) for q in fx.get('open', [])}
    fx.setdefault('solid', []).extend([[x, y, 'r'] for x, y, _ in solid if (x, y) not in have])
    fx.setdefault('open', []).extend([[x, y, '.' if tan[y * T:(y + 1) * T, x * T:(x + 1) * T].mean() > 0.6 else ','] for x, y, _ in opn if (x, y) not in have])
    json.dump(fx, open(f, 'w'), indent=0)
    print('fix.json', len(fx['solid']), 'solid', len(fx['open']), 'open')
