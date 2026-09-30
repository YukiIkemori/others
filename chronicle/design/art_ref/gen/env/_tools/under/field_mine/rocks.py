"""Painted boulders the fit missed: walkable sand cells (not road, not next to road, not protected) whose painting shows a boulder
(a compact blob of dark rock pixels). usage: python3 rocks.py <id> <gen.png> [thr=0.10] -> prints [[x, y, 'r'], ...] and <id>/rocks.png"""
import sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
aid, src = sys.argv[1], sys.argv[2]; _a = [v for v in sys.argv[3:] if not v.startswith("--")]; thr = float(_a[0]) if _a else 0.10
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
rows = d.get('rows_fit') or d['rows']; g = np.array([list(r) for r in rows])
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
lum = A @ np.array([.299, .587, .114])
dk = (lum < 120) & (np.abs(A[..., 0] - A[..., 1]) < 22) & (np.abs(A[..., 1] - A[..., 2]) < 26) & (A[..., 1] <= A[..., 0] + 12)   # 諸島: 灰色の岩（草の暗い所は数えない）
lab, n = ndimage.label(ndimage.binary_opening(dk, iterations=1))
sizes = ndimage.sum(dk, lab, range(n + 1))
big = np.isin(lab, np.nonzero((sizes >= 70) & (sizes <= 1400))[0])
road = np.isin(g, list('.:=c'))
near = ndimage.binary_dilation(road, iterations=1)
prot = set()
for e in d['exits']:
    for j in range(e['h']):
        for i in range(e['w']): prot.add((e['x'] + i, e['y'] + j))
for s in d['spawns'].values(): prot.add((s['x'], s['y']))
for o in d['objects']:
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): prot.add((o['x'] + dx, o['y'] + dy))
for nn in d['meta'].get('npcs', []):
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): prot.add((nn['x'] + dx, nn['y'] + dy))
frac = big.reshape(H, T, W, T).mean((1, 3))
out = []
for y in range(H):
    for x in range(W):
        if g[y, x] in 's,;"' and not near[y, x] and (x, y) not in prot and frac[y, x] >= thr: out.append([x, y, 'r'])
im = Image.fromarray(A.astype(np.uint8)); dr = ImageDraw.Draw(im)
for x, y, _ in out: dr.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(0, 255, 255), width=2)
im.save(aid + '/rocks.png')
print(json.dumps(out))
if '--write' in sys.argv:   # merge into <id>/fix.json 'solid' (fit.py --apply applies it, then closes unreachable pockets)
    import os
    fp = aid + '/fix.json'
    fx = json.load(open(fp)) if os.path.exists(fp) else {}
    have = {(q[0], q[1]) for q in fx.get('solid', [])}
    fx['solid'] = fx.get('solid', []) + [q for q in out if (q[0], q[1]) not in have]
    json.dump(fx, open(fp, 'w'), ensure_ascii=False, indent=0)
    print('fix.json solid', len(fx['solid']))
