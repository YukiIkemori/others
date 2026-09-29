"""(2026-09-29 見直し) 描きこみの多い明るい灰のエリアの当たりを、絵の小物に合わせる（fit.py の後、check.py の前）。
usage: python3 objfit.py <id> <gen.png> [THR=0.2]
外の岩山（端につながる R）・水・溶岩・海・建て物の目印（砦・碑・門・宿・橋・岩の扉）はそのまま。それ以外の内側のマスは、
明るい灰の地面から浮いた小物の画素（暗い・色の濃い画素のまとまり。大きすぎる塊 = 冷えた溶岩の殻の帯や敷石は数えない）が
THR 以上のマスを 'r'（通れない）、それ以外は歩ける地面（元の字が地面ならその字、でなければ 's'）にする。
置く物・出入り口・spawn のマス（と前後左右）は元のまま。とどかない歩けるマスは閉じる。layout.json の rows_fit を書きかえる。"""
import sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from collections import deque

aid, src = sys.argv[1], sys.argv[2]
THR = float(sys.argv[3]) if len(sys.argv) > 3 else 0.2
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
rows = [list(r) for r in (d.get('rows_fit') or d['rows'])]
import os
fx = json.load(open(aid + '/fix.json')) if os.path.exists(aid + '/fix.json') else {}
for mv in fx.get('objects', []):   # tomap.py と同じ: 絵に合わせて動かした物・spawn
    for o in d['objects']:
        if all(o.get(k) == v for k, v in mv['match'].items()): o.update(mv['set'])
for k, v in fx.get('spawns', {}).items(): d['spawns'][k] = v
lay = np.array([list(r) for r in d['rows']])
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
lum = A @ np.array([.299, .587, .114])
sat = A.max(-1) - A.min(-1)
WALK = set(',;".:s_=cuk')
walk = np.isin(lay, list(WALK))
kr = lambda m: np.kron(m, np.ones((T, T), bool))
G = float(np.median(lum[kr(np.isin(lay, list('su')))]))
# 小物の画素: 地面より暗い、または色の濃い（錆・旗・硫黄・骨の白は明るさの差）
obj = (lum < G - 38) | (sat > 70) | (lum > G + 55)
obj = ndimage.binary_opening(obj, iterations=1)
lab, n = ndimage.label(obj)
sizes = ndimage.sum(obj, lab, range(n + 1))
sl = ndimage.find_objects(lab)
ok = np.zeros(n + 1, bool)
# 塊ごとに: 外の岩山にかかる・冷えた溶岩の殻や敷石の上が半分以上 → 地形なので数えない（小物ではない）
outer0 = lay == 'R'
lb0, _ = ndimage.label(outer0)
bord0 = set(np.unique(np.concatenate([lb0[0], lb0[-1], lb0[:, 0], lb0[:, -1]]))) - {0}
outerpx = kr(np.isin(lb0, list(bord0)))
flatpx = kr(np.isin(lay, list('kc')))
on_outer = ndimage.sum(outerpx, lab, range(n + 1))
on_flat = ndimage.sum(flatpx, lab, range(n + 1))
for i in range(1, n + 1):
    s = sl[i - 1]; hh, ww = s[0].stop - s[0].start, s[1].stop - s[1].start
    ok[i] = 30 <= sizes[i] <= 60000 and hh <= 9 * T and ww <= 9 * T and on_outer[i] < 0.15 * sizes[i] and on_flat[i] < 0.5 * sizes[i]
obj = ok[lab]
frac = obj.reshape(H, T, W, T).mean((1, 3))
# 外の岩山
outer = lay == 'R'
lb, _ = ndimage.label(outer)
border = set(np.unique(np.concatenate([lb[0], lb[-1], lb[:, 0], lb[:, -1]]))) - {0}
outer = np.isin(lb, list(border))
STRUCT = {'fort', 'monument', 'gate', 'inn', 'bridge', 'parapet', 'rockdoor', 'door', 'causeway', 'tube', 'arch'}
struct = set((x, y) for m in d['marks'] if m['kind'] in STRUCT for x, y in m['cells'])
prot = set()
for e in d['exits']:
    for j in range(e['h']):
        for i in range(e['w']): prot.add((e['x'] + i, e['y'] + j))
for s in d['spawns'].values(): prot.add((s['x'], s['y']))
for o in d['objects']:
    if o.get('type') == 'prop' and o.get('id') == 'lava_glow': continue
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): prot.add((o['x'] + dx, o['y'] + dy))
for nn in d['meta'].get('npcs', []):
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): prot.add((nn['x'] + dx, nn['y'] + dy))
road = ndimage.binary_dilation(np.isin(lay, list('.:=c')), iterations=0) if False else np.isin(lay, list('.:=c'))
nch = 0
for y in range(H):
    for x in range(W):
        c = rows[y][x]
        if outer[y, x] or (x, y) in struct or lay[y, x] in '~wl_=' or c in '~wl': continue
        if (x, y) in prot:
            # 置く物のマスそのものは元のまま（看板・灯籠は物の当たり）。前後左右は歩けるように
            continue
        if road[y, x] and frac[y, x] < 0.5: n_ = c if c in WALK else lay[y, x]
        elif frac[y, x] >= THR: n_ = 'r'
        else: n_ = c if c in WALK else (lay[y, x] if lay[y, x] in WALK else 's')
        if n_ != c: rows[y][x] = n_; nch += 1
# 手の直し（fix.json の objfit_solid / objfit_open）
for q in fx.get('objfit_solid', []): rows[q[1]][q[0]] = q[2] if len(q) > 2 else 'r'
for q in fx.get('objfit_open', []): rows[q[1]][q[0]] = q[2] if len(q) > 2 else 's'
# とどかない歩けるマスを閉じる
seen = np.zeros((H, W), bool); q = deque()
for sp in d['spawns'].values():
    if rows[sp['y']][sp['x']] not in WALK: rows[sp['y']][sp['x']] = 's'
    seen[sp['y'], sp['x']] = True; q.append((sp['x'], sp['y']))
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        u, v = x + dx, y + dy
        if 0 <= u < W and 0 <= v < H and not seen[v, u] and rows[v][u] in WALK: seen[v, u] = True; q.append((u, v))
closed = 0
for y in range(H):
    for x in range(W):
        if rows[y][x] in WALK and not seen[y, x]: rows[y][x] = 'r'; closed += 1
bad = [o for o in d['objects'] if o.get('id') != 'lava_glow' and not any(0 <= o['x'] + dx < W and 0 <= o['y'] + dy < H and seen[o['y'] + dy, o['x'] + dx] for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)))]
d['rows_fit'] = [''.join(r) for r in rows]
json.dump(d, open(aid + '/layout.json', 'w'), ensure_ascii=False, indent=0)
im = Image.fromarray(A.astype(np.uint8)); dr = ImageDraw.Draw(im, 'RGBA')
for y in range(H):
    for x in range(W):
        if rows[y][x] not in WALK: dr.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=(255, 0, 0, 70))
im.save(aid + '/objfit.png')
print('ground', round(G), 'objfit changed', nch, 'closed', closed, 'unreachable objects', [(o['type'], o['x'], o['y']) for o in bad])
