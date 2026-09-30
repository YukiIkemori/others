"""描いた絵（proc_last.png、32 px/マス）に当たりを合わせる: 水の割合で layout.json の行を直す（戸口の前・人・出入り口などは守る）→ rows_fit
usage: python3 refit.py  → layout.json に rows_fit、fit_ov.png（赤 = 通れない、緑の枠 = 直したマス）"""
import json, numpy as np
from PIL import Image, ImageDraw
L = json.load(open('layout.json')); W, H, T = L['w'], L['h'], 32
cur = json.load(open('cur.json')); blds = json.load(open('blds.json'))
A = np.asarray(Image.open('proc_last.png').convert('RGB')).astype(float)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
water = (b > r + 25) & (b > 70)
brown = (r > g) & (g > b) & (r > 90) & (r - b > 40)
grass = (g > r + 8) & (g > b + 8)
rows = [list(x) for x in L['rows']]
need = set()
for bb in blds:
    for j in range(bb['h']):
        for i in range(bb['w']): need.add((bb['x'] + i, bb['y'] + j))
    need.add((bb['door'][0], bb['door'][1] + 1))
for s in cur['spawns'].values(): need.add((s['x'], s['y']))
for n in cur['npcs']: need.add((n['x'], n['y']))
for o in cur['objects']: need.add((o['x'], o['y']))
for e in cur['exits']:
    for j in range(e['h']):
        for i in range(e['w']): need.add((e['x'] + i, e['y'] + j))
WALK = set('gcpb')
# 屋根・柳の冠が水の上にかかる所は開けない
NOPEN = {(9, 10), (30, 30), (31, 30), (32, 30)}
ch = []
for y in range(H):
    for x in range(W):
        if (x, y) in need or rows[y][x] in 'XT': continue
        wf = water[y * T:(y + 1) * T, x * T:(x + 1) * T].mean()
        bf = brown[y * T:(y + 1) * T, x * T:(x + 1) * T].mean()
        c = rows[y][x]
        if c in WALK and c != 'b' and wf > 0.55: rows[y][x] = '~'; ch.append((x, y, c, '~'))
        elif c == '~' and wf < 0.2 and (x, y) not in NOPEN and (brown[y * T:(y + 1) * T, x * T:(x + 1) * T].mean() + grass[y * T:(y + 1) * T, x * T:(x + 1) * T].mean()) > 0.6:
            nb = [rows[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H]
            if any(q in WALK for q in nb):
                n = 'p' if bf > 0.35 else 'g'; rows[y][x] = n; ch.append((x, y, c, n))
print('changed', len(ch), ch)
L['rows_fit'] = [''.join(q) for q in rows]
json.dump(L, open('layout.json', 'w'))
im = Image.fromarray(A.astype(np.uint8)); d = ImageDraw.Draw(im, 'RGBA')
for y in range(H):
    for x in range(W):
        if rows[y][x] not in WALK: d.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=(255, 0, 0, 70))
for x, y, a, b2 in ch: d.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(0, 255, 0, 255), width=2)
im.save('fit_ov.png')
