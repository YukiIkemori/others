"""鐘沈みの沼（marsh_bog、60x52）の描き直し用のなめらかな形（2026-09-29: 前の絵は板の道・小島がマスの段のままだった）。
同じ小島・淵・板の道・泥の道（水が引くと現れる所）・物の位置を、ゆがんだ楕円となめらかな線で描く。開いた形（泥の道が出た形）。
  layout.json  rows（凡例は marsh_00_kit.js の BOG: '~' 沼・'=' 淵・'g' 泥炭・'p' 板の道・'r' 葦・'T' 枯れ木、泥の道は 'A'（西の鐘と東の鐘の後）'B'（北の鐘の後））
  cls_34.png   34 px/マスの形の図（guide.py が描く）
usage: python3 layout.py"""
import json, math, sys, os
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../field_marsh'))
from lib import fbm

S = 34
cur = json.load(open('cur.json')); W, H = cur['w'], cur['h']
CH = '~=rTgpAB'
I = {c: i for i, c in enumerate(CH)}
ys, xs = (np.mgrid[0:H * S, 0:W * S] + 0.5) / S
d = np.minimum.reduce([xs, ys, W - xs, H - ys])
up = lambda a: np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((W * S, H * S), Image.BICUBIC)) / 255.0
n1 = up(fbm(21, W, H, 3.0, 3)); n2 = up(fbm(22, W, H, 2.0, 2))
a = np.full((H * S, W * S), I['~'], np.uint8)
a[d < 1.6 + 2.0 * n1] = I['r']                          # 葦原のふち（なめらかにゆれる帯）
a[(d < 1.3 + 1.2 * n2) & (n2 > 0.55)] = I['T']           # 外の枯れ木の林（まとまり）
im = Image.fromarray(a); g = ImageDraw.Draw(im)
P = lambda x, y: (x * S, y * S)


def blob(cx, cy, rx, ry, ch, rough=0.12, seed=0, n=96):
    rnd = np.random.RandomState(seed); ph = rnd.rand(4) * 6.28
    pts = []
    for k in range(n):
        t = k / n * 2 * math.pi
        f = 1 + rough * (0.55 * math.sin(2 * t + ph[0]) + 0.3 * math.sin(3 * t + ph[1]) + 0.2 * math.sin(5 * t + ph[2]) + 0.1 * math.sin(7 * t + ph[3]))
        pts.append(P(cx + math.cos(t) * rx * f, cy + math.sin(t) * ry * f))
    g.polygon(pts, fill=I[ch])


def chaikin(pts, it=3):
    for _ in range(it):
        q = [pts[0]]
        for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
            q += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        q.append(pts[-1]); pts = q
    return pts


PLANKS = []


def walk(pts, w=2.0, ch='p'):
    sm = chaikin(pts); out = []
    for (x0, y0), (x1, y1) in zip(sm[:-1], sm[1:]):
        L = math.hypot(x1 - x0, y1 - y0); k = max(1, int(L * 8))
        for i in range(k):
            t = i / k; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; r = w / 2 * S
            g.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=I[ch])
            out.append([round(x, 3), round(y, 3), round(math.atan2(y1 - y0, x1 - x0), 3)])
    PLANKS.append(dict(w=w, ch=ch, pts=out))


# ---------------------------------------------------------------- 淵（深い水）
blob(30.5, 27.5, 6.2, 3.4, '=', seed=11); blob(18.5, 18.5, 4.0, 3.0, '=', seed=12); blob(44.5, 16.5, 5.0, 3.0, '=', seed=13); blob(46.5, 44.5, 4.0, 2.6, '=', seed=14)
# ---------------------------------------------------------------- 小島（泥炭）
blob(30.5, 46.5, 7.2, 3.8, 'g', seed=1)                 # 南の入口の岸
g.rounded_rectangle([P(27.6, 48.5), P(32.4, 52.2)], radius=S // 2, fill=I['g'])   # 出口への首
blob(30.5, 35.5, 4.4, 2.3, 'g', seed=2)                 # 分かれ道の小島
blob(10.5, 29.5, 5.2, 4.0, 'g', seed=3)                 # 西の鐘の小島
blob(50.5, 29.5, 5.2, 4.0, 'g', seed=4)                 # 東の鐘の小島
blob(30.5, 9.5, 6.2, 4.0, 'g', seed=5)                  # 北の鐘の小島
blob(30.5, 20.5, 5.2, 3.4, 'g', seed=6)                 # まん中の小島（霧の集まる所）
blob(19.5, 42.5, 3.2, 2.1, 'g', seed=7); blob(42.5, 42.5, 3.2, 2.1, 'g', seed=8)   # 宝箱の小島
blob(48.5, 11.5, 3.2, 2.1, 'g', seed=9)                 # 北東の小島
blob(38.5, 47.5, 2.6, 1.7, 'g', seed=10)                # 子どもたちの小島
blob(7.5, 16.5, 1.8, 1.4, 'g', seed=15, rough=0.06)     # 泥の道の脇の小さな岸（宝箱）
# ---------------------------------------------------------------- 板の道（幅 2、なめらかに曲がる）
walk([(30.0, 43.6), (30.0, 40.0), (30.0, 36.8)])                                   # 入口 → 分かれ道
walk([(27.2, 35.8), (23.5, 35.4), (19.5, 34.2), (16.4, 32.6), (15.8, 30.8)])        # → 西の鐘
walk([(33.8, 35.8), (37.5, 35.4), (41.5, 34.2), (44.6, 32.6), (45.2, 30.8)])        # → 東の鐘
walk([(25.4, 45.0), (22.6, 44.6), (21.4, 43.2)])                                   # → 西の宝箱の小島
walk([(35.6, 45.0), (38.4, 44.6), (39.6, 43.2)])                                   # → 東の宝箱の小島
walk([(35.2, 47.8), (36.8, 47.8)])                                                 # → 子どもたちの小島
walk([(35.4, 9.8), (40.0, 9.6), (44.5, 10.0), (46.6, 10.9)])                       # 北の鐘の小島 → 北東の小島
# ---------------------------------------------------------------- 水が引くと現れる泥の道（A: 西の小島 → 北の鐘、B: 北の鐘 → まん中）
walk([(10.0, 26.4), (10.0, 20.0), (10.4, 16.0), (12.6, 14.4), (15.0, 12.8), (17.6, 11.0), (21.5, 10.6), (25.6, 10.6)], 2.0, 'A')
walk([(30.0, 13.4), (30.0, 15.5), (30.0, 17.6)], 2.0, 'B')
a = np.asarray(im).copy()
Image.fromarray(a).save('cls_34.png')

# ---------------------------------------------------------------- 行（マスの中の割合で）
WALKC = 'gpAB'
rows = []
for y in range(H):
    r = ''
    for x in range(W):
        blk = a[y * S:(y + 1) * S, x * S:(x + 1) * S]
        cnt = np.bincount(blk.ravel(), minlength=len(CH))
        cA, cB = cnt[I['A']], cnt[I['B']]
        wf = sum(cnt[I[c]] for c in WALKC) / blk.size
        if cA + cB > blk.size * 0.45: r += 'A' if cA >= cB else 'B'; continue
        if wf >= 0.5: r += max('gp', key=lambda c: cnt[I[c]])
        else: r += max('~=rT', key=lambda c: cnt[I[c]])
    rows.append(list(r))
# 枯れ木（小島の縁、前と同じマス）
for x, y in [(6, 27), (14, 32), (54, 27), (46, 32), (25, 7), (35, 11), (26, 47), (16, 42), (45, 41)]:
    if rows[y][x] == 'g': rows[y][x] = 'T'
need = {}
for k, s in cur['spawns'].items(): need[(s['x'], s['y'])] = 'spawn ' + k
for nn in cur['npcs']: need[(nn['x'], nn['y'])] = 'npc'
for o in cur['objects']:
    if o['type'] in ('chest', 'examine', 'sign'): need[(o['x'], o['y'])] = o['type'] + ' ' + o.get('id', o.get('event', ''))
for e in cur['exits']:
    for j in range(e['h']):
        for i in range(e['w']): need[(e['x'] + i, e['y'] + j)] = 'exit'
bad = [(xy, why, rows[xy[1]][xy[0]]) for xy, why in need.items() if rows[xy[1]][xy[0]] not in WALKC]
print('protected cells not walkable:', bad)
lamps = [o for o in cur['objects'] if o['type'] == 'prop' and o['id'] == 'wisp_lamp']
print('lamps on', [(o['x'], o['y'], rows[o['y']][o['x']]) for o in lamps])
rows = [''.join(r) for r in rows]
json.dump(dict(id='marsh_bog', w=W, h=H, rows=rows, planks=PLANKS), open('layout.json', 'w'))
print('\n'.join('%2d %s' % (y, r) for y, r in enumerate(rows)))
