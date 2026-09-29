"""Organic layout of the Loch (repaint 2026-09-29: the first painting traced the tile-stepped rows: square plaza steps, stair-stepped
boardwalks). The same islands, buildings, doors, routes and object cells as marsh_loch.js, drawn as smooth shapes (noisy ellipses, rounded
boardwalks along smoothed polylines, a rounded plaza). Writes
  layout.json   rows (collision chars in the loch legend, from the shapes' coverage per cell) + planks (boardwalk samples for the guide)
  cls_36.png    class raster at 36 px / tile (guide.py draws from it)
usage: python3 layout.py   (prints protected cells that the shapes do not cover)"""
import json, math, sys, os
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../field_marsh'))
from lib import fbm

S = 36
cur = json.load(open('cur.json')); W, H = cur['w'], cur['h']
CH = '~=rgcpbXT'           # class ids 0..8
I = {c: i for i, c in enumerate(CH)}
WALKC = set('gcpb')
im = Image.new('L', (W * S, H * S), I['~']); g = ImageDraw.Draw(im)
P = lambda x, y: (x * S, y * S)

# ---------------------------------------------------------------- reeds round the lake (noisy band, no steps)
ys, xs = (np.mgrid[0:H * S, 0:W * S] + 0.5) / S
d = np.minimum.reduce([xs, ys, W - xs, H - ys])
n = np.asarray(Image.fromarray((fbm(11, W, H, 3.5, 3) * 255).astype(np.uint8)).resize((W * S, H * S), Image.BICUBIC)) / 255.0
reed = d < 0.9 + 1.7 * n
a = np.asarray(im).copy(); a[reed] = I['r']
# the canal (a straight dug channel with stone edges) across the whole town
a[(ys >= 26) & (ys < 29)] = I['=']
im = Image.fromarray(a); g = ImageDraw.Draw(im)


def blob(cx, cy, rx, ry, ch, rough=0.12, seed=0, n=90):
    rnd = np.random.RandomState(seed)
    ph = rnd.rand(4) * 6.28
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
    sm = chaikin(pts)
    out = []
    for (x0, y0), (x1, y1) in zip(sm[:-1], sm[1:]):
        L = math.hypot(x1 - x0, y1 - y0); k = max(1, int(L * 8))
        for i in range(k):
            t = i / k; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            r = w / 2 * S
            g.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=I[ch])
            out.append([round(x, 3), round(y, 3), round(math.atan2(y1 - y0, x1 - x0), 3)])
    out.append([sm[-1][0], sm[-1][1], out[-1][2]])
    PLANKS.append(dict(w=w, pts=out))


# ---------------------------------------------------------------- islands (peat)
blob(8.5, 15.8, 7.4, 5.2, 'g', seed=1)        # the assembly hall island
blob(47.2, 15.0, 5.6, 5.4, 'g', seed=2)       # the bell tower island
blob(33.0, 36.4, 6.6, 3.9, 'g', seed=3)       # the mayor's willow island
blob(41.0, 45.4, 5.8, 3.4, 'g', seed=4)       # the outpost office island
blob(48.6, 35.2, 4.8, 3.4, 'g', seed=5)       # the doll maker's island
blob(13.6, 32.3, 3.9, 2.0, 'g', seed=6)       # the mud bank south of the canal (the night footprints)
blob(7.0, 36.8, 6.2, 4.6, 'g', seed=7, rough=0.08)    # under the ring of barges (the inn)
blob(17.6, 43.2, 4.0, 3.2, 'g', seed=8)       # the fisher's hut
blob(1.6, 23.8, 1.8, 1.0, 'g', seed=9, rough=0.05)    # the west gate sign bank
blob(53.6, 22.9, 1.5, 0.95, 'g', seed=10, rough=0.05)  # the east gate sign bank
# the outer reeds close the map edge again over the islands
a = np.asarray(im).copy(); a[(d < 1.0) & (a == I['g'])] = I['r']; im = Image.fromarray(a); g = ImageDraw.Draw(im)
# ---------------------------------------------------------------- the cobbled square before the great bell (rounded) and its neck to the bridge
sq = chaikin([(18.4, 12.0), (37.6, 12.0), (38.5, 13.6), (38.3, 17.8), (36.6, 20.0), (31.0, 20.9), (29.0, 21.2), (29.0, 24.0),
              (26.0, 24.0), (26.0, 21.2), (24.5, 21.0), (19.6, 20.2), (17.7, 17.6), (17.8, 13.6)], 2)
sq = [sq[0]] + sq[1:-1] + [sq[-1]]
g.polygon([P(x, y) for x, y in sq], fill=I['c'])
g.rectangle([P(26, 20.5), (29 * S - 1, 24 * S - 1)], fill=I['c'])
g.rectangle([P(18.6, 12.0), (37.4 * S, 13.2 * S)], fill=I['c'])
# ---------------------------------------------------------------- boardwalks (smoothed; the same routes as before)
walk([(-1.0, 21.9), (3.0, 21.7), (5.0, 20.8), (7.4, 19.9)], 2.1)                  # west gate -> the hall
walk([(6.3, 20.4), (6.8, 23.0), (6.6, 24.9)], 2.4)                                 # hall -> the ferry landing (north)
walk([(6.6, 30.0), (6.8, 31.0), (8.6, 32.2), (11.0, 32.4)], 2.2)                   # ferry landing (south) -> the mud bank
walk([(10.4, 20.4), (15.0, 19.8), (19.2, 18.8)], 2.0)                              # hall -> the square
walk([(37.6, 18.5), (40.5, 19.0), (43.4, 19.2)], 2.0)                              # square -> the bell tower
walk([(50.0, 19.0), (52.5, 19.5), (54.2, 20.7), (57.0, 21.0)], 2.4)                # bell tower -> east gate
walk([(27.5, 30.5), (25.0, 33.4), (21.5, 35.2), (19.0, 37.5), (16.0, 39.6), (12.5, 40.8), (8.0, 41.2), (4.6, 41.2)], 2.2)   # bridge -> the inn
walk([(13.8, 33.5), (14.0, 37.0), (14.6, 39.6)], 2.0)                              # mud bank -> the inn walk
walk([(20.6, 36.4), (21.4, 41.0), (21.0, 44.6), (18.5, 46.4)], 2.0)                # -> the fisher's hut (Yena)
walk([(28.4, 30.8), (30.5, 32.4), (31.6, 33.6)], 2.0)                              # bridge foot -> the mayor
walk([(36.0, 38.6), (38.0, 39.8), (39.6, 41.4)], 2.0)                              # mayor -> the outpost office
walk([(30.0, 39.4), (30.2, 42.0), (31.0, 44.4)], 2.0)                              # mayor -> the night-market raft
walk([(36.5, 34.4), (40.0, 33.0), (44.2, 32.9), (46.2, 34.4)], 2.0)                # mayor -> the doll maker
walk([(44.8, 33.8), (44.6, 37.6), (45.4, 38.6), (46.8, 38.4)], 2.0)                              # the doll maker's back walk (the lost cat)
# the night-market raft (a platform of planks, rounded corners)
g.rounded_rectangle([P(27, 44), (37 * S - 1, 48 * S - 1)], radius=S // 2, fill=I['p'])
PLANKS.append(dict(raft=[27, 44, 37, 48]))
# the humped stone bridge over the canal
g.rectangle([P(26, 24), (29 * S - 1, 31 * S - 1)], fill=I['b'])
# ---------------------------------------------------------------- the great bell, the stilt bell towers, the willows (cells as in the map)
a = np.asarray(im).copy()
rows0 = cur['rows']
for y in range(H):
    for x in range(W):
        if rows0[y][x] == 'X' and y <= 8 and 18 <= x <= 37: a[y * S:(y + 1) * S, x * S:(x + 1) * S] = I['X']
for (x, y) in [(2, 6), (51, 4), (14, 23), (52, 29), (23, 48), (51, 44)]: a[y * S:(y + 2) * S, x * S:(x + 2) * S] = I['X']
for (x, y) in [(37, 36), (26, 37), (50, 13), (3, 15)]: a[y * S:(y + 1) * S, x * S:(x + 1) * S] = I['T']
Image.fromarray(a).save('cls_36.png')

# ---------------------------------------------------------------- rows from the coverage
blds = json.load(open('blds.json'))
rows = []
for y in range(H):
    r = ''
    for x in range(W):
        blk = a[y * S:(y + 1) * S, x * S:(x + 1) * S]
        cnt = np.bincount(blk.ravel(), minlength=len(CH))
        wf = sum(cnt[I[c]] for c in WALKC) / blk.size
        if cnt[I['X']] > blk.size * 0.5: r += 'X'; continue
        if cnt[I['T']] > blk.size * 0.5: r += 'T'; continue
        if wf >= 0.5: r += max(WALKC, key=lambda c: cnt[I[c]])
        else: r += max('~=r', key=lambda c: cnt[I[c]])
    rows.append(r)
rows = [list(r) for r in rows]
for b in blds:                                  # building plots (marsh_loch.js bld(): 'g', the door 'p')
    for j in range(b['h']):
        for i in range(b['w']): rows[b['y'] + j][b['x'] + i] = 'g'
    dx, dy = b['door']; rows[dy][dx] = 'p'
# protected cells: doors' fronts, spawns, NPCs, examines, chests, exits
need = {}
for b in blds: need[(b['door'][0], b['door'][1] + 1)] = 'front ' + b['id']
for k, s in cur['spawns'].items(): need[(s['x'], s['y'])] = 'spawn ' + k
for nn in cur['npcs']: need[(nn['x'], nn['y'])] = 'npc ' + nn['id']
for o in cur['objects']:
    if o['type'] in ('chest',): need[(o['x'], o['y'])] = 'chest'
for e in cur['exits']:
    for j in range(e['h']):
        for i in range(e['w']): need[(e['x'] + i, e['y'] + j)] = 'exit'
need.pop((27, 25), None)   # Fine on the bridge ('b')
bad = [(xy, why, rows[xy[1]][xy[0]]) for xy, why in need.items() if rows[xy[1]][xy[0]] not in WALKC]
print('protected cells not walkable:', bad)
# the canal lamps are examined from a walkable neighbour
for (x, y) in [(8, 25), (25, 29), (44, 31)]:
    nb = [rows[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
    print('canal lamp', (x, y), 'walkable neighbours', sum(c in WALKC for c in nb))
rows = [''.join(r) for r in rows]
json.dump(dict(id='loch', w=W, h=H, rows=rows, planks=PLANKS), open('layout.json', 'w'))
print('\n'.join('%2d %s' % (y, r) for y, r in enumerate(rows)))
