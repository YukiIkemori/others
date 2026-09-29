"""Colour fit for areas whose painting moved the inner features (the spa pools): inside the walkable basin (layout cells that are not the
outer crags), a cell is WATER when turquoise pixels cover >= WFR of it, a BOULDER when dark stone pixels cover >= RFR, else open ground
(the layout's ground char, or ',' where the layout had water / an inner rock). Writes layout.json rows_fit (object / spawn / exit cells kept).
usage: python3 colfit.py <id> <gen.png> [WFR=0.4] [RFR=0.35]"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
aid, src = sys.argv[1], sys.argv[2]
WFR = float(sys.argv[3]) if len(sys.argv) > 3 else 0.4
RFR = float(sys.argv[4]) if len(sys.argv) > 4 else 0.35
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
rows = [list(r) for r in d['rows']]
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
lum = A @ np.array([.299, .587, .114])
turq = (b > r + 30) & (g > r + 30) & (b > 120)
dark = lum < 70
C = lambda m: m.reshape(H, T, W, T).mean((1, 3))
tf, df = C(turq), C(dark)
outer = np.array([[c == 'R' for c in rr] for rr in rows])
# the outer crags: R cells connected to the map border
lab, n = ndimage.label(outer)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
outer = np.isin(lab, list(border))
prot = set()
for e in d['exits']:
    for j in range(e['h']):
        for i in range(e['w']): prot.add((e['x'] + i, e['y'] + j))
for s in d['spawns'].values(): prot.add((s['x'], s['y']))
for o in d['objects']:
    if o.get('type') == 'examine': continue
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): prot.add((o['x'] + dx, o['y'] + dy))
for nn in d['meta'].get('npcs', []): prot.add((nn['x'], nn['y']))
marks = set((x, y) for m in d['marks'] for x, y in m['cells'] if m['solid'])
out = [rr[:] for rr in rows]
nch = 0
for y in range(H):
    for x in range(W):
        if outer[y, x] or (x, y) in marks or (x, y) in prot: continue
        c = rows[y][x]
        if tf[y, x] >= WFR: n_ = 'w'
        elif df[y, x] >= RFR: n_ = 'r'
        else: n_ = c if c in ',;".:s_=cuk' else ','
        if n_ != c: out[y][x] = n_; nch += 1
d['rows_fit'] = [''.join(rr) for rr in out]
json.dump(d, open(aid + '/layout.json', 'w'), ensure_ascii=False, indent=0)
print('colfit changed', nch)
