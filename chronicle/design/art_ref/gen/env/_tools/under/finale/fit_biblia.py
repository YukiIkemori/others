"""The collision of the white town of Biblia, re-measured by hand on the painting biblia/gen1.png (the painter moved a few
buildings, walls and trees by a cell from the guide; the guide of the generation is guide_48.png). Writes layout.json rows_fit,
meta.blds (footprints and doors as painted) and the spawns. usage: python3 fit_biblia.py  (then check.py / process.py / put_rows.py)
Chars: ',' lawn, '"' flowers, 'c' flagstones, '=' pier, '~' sea, 'T' trees, 'X' buildings / walls / props, 'w' fountain."""
import json
import numpy as np

W, H = 56, 46
g = np.full((H, W), 'X', dtype='<U1')


def R(x0, y0, x1, y1, ch):
    g[y0:y1 + 1, x0:x1 + 1] = ch


def P(cells, ch='X'):
    for (x, y) in cells: g[y, x] = ch


# ---------------------------------------------------------------- north district (rows 2-14)
R(2, 4, 2, 14, ',')                  # lawn along the west wall
R(16, 3, 16, 9, ',')                 # lawn strip between the Hall of the Records and the Archive (tree at x 17)
R(3, 10, 20, 10, '"')                # flower bed in front of the Hall of the Records
R(3, 12, 20, 13, 'c')                # the street of the north district (west)
R(8, 11, 10, 11, 'c')                # the opening in the low wall before the Hall's steps
R(3, 14, 20, 14, '"')                # flower strip before the inner wall
R(21, 10, 35, 14, 'c')               # the forecourt of the Archive
R(22, 10, 25, 10, '"'); R(31, 10, 35, 10, '"')
R(37, 9, 38, 10, ',')                # lawn between the Archive and the great library
R(37, 12, 52, 13, 'c')               # the street of the north district (east)
R(45, 11, 47, 11, 'c')               # the opening in the low wall before the library
R(39, 10, 52, 10, '"')
R(36, 14, 53, 14, '"')
P([(9, 10), (46, 10), (28, 10)], 'c')   # steps below the three doors
R(36, 12, 36, 13, 'c')
# walls, posts and trees
P([(3, y) for y in range(11, 15)] + [(4, 11), (5, 11), (6, 11), (7, 11)])
P([(x, 11) for x in range(11, 21)])
P([(x, 11) for x in range(37, 45)] + [(x, 11) for x in range(48, 53)] + [(36, 10), (36, 11)])
P([(52, 12), (52, 13), (53, 11), (53, 12), (53, 13)])
P([(26, 10), (26, 11), (30, 10), (30, 11), (21, 13), (21, 14), (36, 14), (51, 14), (52, 14), (53, 14), (4, 14), (19, 14), (2, 14)])
P([(2, 4), (2, 5), (2, 6), (2, 11), (2, 12), (2, 13), (15, 11), (15, 12), (17, 5), (17, 6), (17, 7), (17, 8), (39, 11), (40, 11)], 'T')
# ---------------------------------------------------------------- the inner wall (row 15) and the street (row 16)
R(22, 15, 35, 15, 'c')               # the open part of the wall before the Archive (painted as paving)
R(2, 16, 53, 16, 'c')
P([(27, 15), (27, 16), (29, 15), (29, 16)])   # the gate posts
# ---------------------------------------------------------------- middle (rows 17-30)
R(2, 17, 26, 17, ','); R(27, 17, 29, 17, 'c'); R(30, 17, 53, 17, ',')
R(2, 18, 3, 28, ',')
R(14, 18, 14, 28, ',')
R(15, 18, 18, 19, ','); R(15, 27, 19, 28, '"')
R(19, 18, 20, 28, ',')
R(21, 17, 35, 28, 'c')               # the plaza
R(36, 18, 36, 28, ','); R(37, 18, 41, 19, ','); R(41, 20, 41, 28, ',')
R(37, 27, 41, 28, '"'); R(42, 27, 53, 28, '"')
R(52, 18, 53, 26, ',')
R(4, 27, 13, 28, '"')
P([(7, 27), (8, 27), (9, 27)], 'c')  # the inn's steps
R(2, 29, 53, 30, 'c')                # the cross street
# the fountain (round basin, centre (28.2, 22.8))
for y in range(19, 27):
    for x in range(24, 33):
        if ((x + 0.5 - 28.2) / 3.4) ** 2 + ((y + 0.5 - 22.8) / 3.0) ** 2 <= 1.0: g[y, x] = 'w'
# trees and props
P([(2, 18), (2, 19), (2, 20), (2, 23), (2, 24), (2, 25), (2, 27), (2, 28)], 'T')
P([(19, 19), (19, 20), (19, 21), (20, 26), (20, 27), (35, 19), (35, 20), (35, 21), (36, 26), (36, 27), (36, 28)], 'T')
P([(52, 18), (52, 19), (52, 20), (53, 18), (53, 19), (53, 20), (53, 23), (53, 24), (53, 25), (53, 27), (53, 28)], 'T')
P([(20, 18), (21, 18)])               # the notice board
P([(41, 26), (50, 27), (51, 27)])     # barrels
# ---------------------------------------------------------------- south (rows 31-38)
R(2, 31, 3, 35, ','); R(13, 31, 14, 35, ','); R(21, 31, 26, 35, '"'); R(29, 31, 34, 35, '"')
R(27, 31, 28, 35, 'c')               # the main street to the quay
R(41, 31, 43, 35, ','); R(52, 31, 53, 35, ',')
P([(2, 31), (2, 32), (2, 33), (2, 34), (2, 35), (3, 35), (14, 33), (14, 34), (14, 35), (22, 33), (22, 34), (22, 35), (26, 31), (26, 32),
   (29, 31), (29, 32), (29, 33), (33, 32), (33, 33), (33, 34), (41, 33), (41, 34), (42, 33), (42, 34), (53, 31), (53, 32), (53, 33)], 'T')
P([(34, 34), (34, 35), (52, 34), (52, 35)])   # barrels
R(2, 36, 53, 36, 'c')                # the quay
R(27, 37, 28, 42, '=')               # the pier
R(0, 39, 55, 45, '~')
R(26, 39, 29, 42, '~'); R(27, 39, 28, 42, '=')
R(30, 39, 42, 44, 'X')               # the moored ship

# ---------------------------------------------------------------- buildings (as painted): id, x0, y0, x1, y1, door x, door y
BLD = [('biblia_archive', 21, 0, 36, 9, 28, 9), ('biblia_records', 3, 2, 15, 9, 9, 9), ('biblia_library', 39, 2, 53, 9, 46, 9),
       ('biblia_inn', 4, 18, 13, 26, 8, 26), ('biblia_house1', 15, 20, 18, 26, 17, 26), ('biblia_house2', 37, 20, 40, 26, 39, 26),
       ('biblia_tavern', 42, 18, 51, 26, 47, 26), ('biblia_shop', 4, 31, 12, 35, 8, 35), ('biblia_house3', 15, 31, 20, 35, 18, 35),
       ('biblia_house4', 35, 31, 40, 35, 37, 35), ('biblia_house5', 44, 31, 51, 35, 47, 35)]
blds = []
for (bid, x0, y0, x1, y1, dx, dy) in BLD:
    R(x0, y0, x1, y1, 'X')
    g[dy, dx] = 'c'
    if g[dy + 1, dx] not in ',;".:s_=cuk': g[dy + 1, dx] = 'c'
    blds.append(dict(id=bid, x=x0, y=y0, w=x1 - x0 + 1, h=y1 - y0 + 1, door=[dx, dy]))

rows = [''.join(r) for r in g]
d = json.load(open('biblia/layout.json'))
d['rows_fit'] = rows
d['meta']['blds'] = blds
d['spawns'] = {'dock': dict(x=27, y=41, dir='n'), 'warp': dict(x=28, y=32, dir='s'), 'plaza': dict(x=27, y=27, dir='n'),
               'gate': dict(x=28, y=17, dir='n'), 'archive': dict(x=28, y=11, dir='s')}
json.dump(d, open('biblia/layout.json', 'w'), ensure_ascii=False, indent=0)
# reach check
from collections import deque
WALK = set(',;".:s_=cuk')
seen = set([(27, 41)]); q = deque([(27, 41)])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        i, j = x + dx, y + dy
        if 0 <= i < W and 0 <= j < H and (i, j) not in seen and rows[j][i] in WALK: seen.add((i, j)); q.append((i, j))
un = [(x, y) for y in range(H) for x in range(W) if rows[y][x] in WALK and (x, y) not in seen]
print('walkable', sum(r.count(c) for r in rows for c in WALK), 'unreached', un)
for s in d['spawns'].values(): print('spawn', s, (s['x'], s['y']) in seen)
for b in blds: print(b['id'], 'door front reach', (b['door'][0], b['door'][1] + 1) in seen)
print('   ' + ''.join(str(i % 10) for i in range(W)))
for y, r in enumerate(rows): print('%2d %s' % (y, r))
