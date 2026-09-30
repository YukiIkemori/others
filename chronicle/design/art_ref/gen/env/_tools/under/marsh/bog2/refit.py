"""沼の当たりを絵（gen1p.png、32 px/マス）に合わせる: 水と陸の割合で layout.json の行を直す（人・宝箱・調べる所・出入り口・泥の道は守る）→ rows_fit、fit_ov.png"""
import json, numpy as np
from PIL import Image, ImageDraw
L = json.load(open('layout.json')); W, H, T = L['w'], L['h'], 32
cur = json.load(open('cur.json'))
A = np.asarray(Image.open('gen1p.png').convert('RGB')).astype(float)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
lum = A.mean(2)
water = ((b > r + 6) & (lum < 70)) | ((b > g) & (lum < 45))
rows = [list(x) for x in L['rows']]
need = set()
for s in cur['spawns'].values(): need.add((s['x'], s['y']))
for n in cur['npcs']: need.add((n['x'], n['y']))
for o in cur['objects']: need.add((o['x'], o['y']))
for e in cur['exits']:
    for j in range(e['h']):
        for i in range(e['w']): need.add((e['x'] + i, e['y'] + j))
WALK = set('gpAB')
ch = []
for y in range(H):
    for x in range(W):
        c = rows[y][x]
        if (x, y) in need or c in 'ABTr': continue
        wf = water[y * T:(y + 1) * T, x * T:(x + 1) * T].mean()
        if c in 'gp' and wf > 0.55: rows[y][x] = '~'; ch.append((x, y, c, '~'))
        elif c == '~' and wf < 0.15:
            nb = [rows[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H]
            if any(q in 'gp' for q in nb): rows[y][x] = 'g'; ch.append((x, y, c, 'g'))
print('changed', len(ch), ch)
L['rows_fit'] = [''.join(q) for q in rows]
json.dump(L, open('layout.json', 'w'))
im = Image.fromarray(A.astype(np.uint8)); d = ImageDraw.Draw(im, 'RGBA')
for y in range(H):
    for x in range(W):
        q = rows[y][x]
        if q not in WALK: d.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=(255, 0, 0, 60))
        elif q in 'AB': d.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=(0, 0, 255, 60))
for x, y, a, b2 in ch: d.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(0, 255, 0, 255), width=2)
im.save('fit_ov.png')
