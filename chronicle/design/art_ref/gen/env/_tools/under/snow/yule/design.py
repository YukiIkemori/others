"""Yule layout design: builds the 56x50 grid + building list, prints ASCII, writes layout.json"""
import json, math
W, H = 56, 50
g = [['#'] * W for _ in range(H)]
def put(x, y, c):
    if 0 <= x < W and 0 <= y < H: g[y][x] = c
def rect(x, y, w, h, c):
    for j in range(h):
        for i in range(w): put(x + i, y + j, c)
def ell(cx, cy, rx, ry, c, only=None):
    for y in range(H):
        for x in range(W):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0 and (only is None or g[y][x] in only): put(x, y, c)
def path(pts, c, wd, only=None):
    # thick polyline: every cell within wd/2 of a segment
    r = wd / 2.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 4) + 1
        for k in range(n + 1):
            t = k / n; px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for y in range(int(py - r) - 1, int(py + r) + 2):
                for x in range(int(px - r) - 1, int(px + r) + 2):
                    if abs(x - px) <= r - 0.01 and abs(y - py) <= r - 0.01 and (only is None or (0 <= y < H and 0 <= x < W and g[y][x] in only)):
                        put(x, y, c)

# ---------------------------------------------------------------- open ground
ell(10, 8, 8.5, 5.2, '.')          # pond shore
ell(10, 8, 6.6, 3.6, 'i')          # frozen pond
ell(28, 27, 7.6, 5.6, '.')         # plaza rim
ell(28, 27, 6.6, 4.6, 'c')         # the sunken fire circle
rect(24, 19, 9, 3, '.')            # hall forecourt
ell(28, 41, 5.6, 4.2, '.')         # snow statue garden
ell(8, 41, 5.6, 4.6, '.')          # sled-dog yard
ell(46, 8, 5, 4.2, '.')            # chief's yard
ell(49, 16, 4.2, 3.2, '.')         # firekeeper's yard
ell(16, 37, 4, 2.6, '.')           # pit-house front
ell(40, 37.5, 4.2, 2.4, '.')       # hunter's front
ell(47, 44.5, 4.2, 2.4, '.')       # branch front
# ---------------------------------------------------------------- trodden paths (winding trenches)
P = ','
path([(27.5, 0), (27.5, 3), (26, 6), (23, 9), (19, 11), (15, 12.5)], P, 3)             # north gate -> pond shore
path([(26.5, 5), (31, 5.5), (37, 6.5), (42, 8.5)], P, 2)                            # north yard -> chief
path([(45.5, 10), (46.5, 13), (46.5, 18), (45, 22), (44, 26)], P, 2)                 # chief -> down the east side
path([(50.5, 16), (50.5, 18), (47, 18)], P, 2)                                      # firekeeper -> path
path([(55, 28.5), (49, 28.5), (44, 26.5), (36, 26.5)], P, 3)                         # east gate -> plaza
path([(0, 29.5), (6, 29.5), (10, 27.5), (21, 27.5)], P, 3)                           # west gate -> plaza
path([(6.5, 13), (5.5, 17), (5.5, 22), (6.5, 26), (7.5, 29)], P, 2)                  # pond -> west side
path([(18.5, 20), (19.5, 22), (21.5, 24)], P, 2)                                    # inn door -> plaza
path([(11.5, 25), (11.5, 28)], P, 2)                                                # item shop door -> west trench
path([(38.5, 20), (36.5, 22), (34.5, 23.5)], P, 2)                                  # arms door -> plaza
path([(22, 31), (19, 34), (16.5, 37)], P, 2)                                        # plaza -> pit house
path([(16.5, 37), (12, 39), (9, 41)], P, 2)                                         # pit house -> dog yard
path([(28.5, 32), (28.5, 37)], P, 2)                                                # plaza -> statue garden
path([(34, 31), (36, 33.5), (36, 37), (39.5, 37)], P, 2)                                        # plaza -> hunter
path([(33, 41), (37, 41)], P, 1)                                                # garden -> kids' base nook
path([(40.5, 38.5), (43, 42), (47.5, 44)], P, 2)                                    # -> branch (outskirts)
# ---------------------------------------------------------------- lookout deck (north, by the gate)
rect(30, 1, 4, 3, 'p')
# ---------------------------------------------------------------- the great hearth (solid stone ring, centre of the plaza)
rect(27, 25, 3, 2, 'F')

# ---------------------------------------------------------------- buildings (x, y, w, h, wall, door or None, kind)
B = [
    # the Dragon-back Longhouse: one serpentine building curled round the plaza, four doors
    dict(id='yule_lh_hall', x=23, y=12, w=11, h=7, wall=3, door=(29, 18), to='yule_hall', kind='long', sign='guild'),
    dict(id='yule_lh_inn', x=14, y=14, w=8, h=6, wall=2, door=(18, 19), to='yule_inn', kind='long', sign='inn'),
    dict(id='yule_lh_items', x=8, y=20, w=7, h=5, wall=2, door=(11, 24), to='yule_items', kind='long', sign='item'),
    dict(id='yule_lh_arms', x=34, y=14, w=8, h=6, wall=2, door=(38, 19), to='yule_arms', kind='long', sign='weapon'),
    # dwellings, all different
    dict(id='yule_jorn_tower', x=43, y=3, w=5, h=5, wall=2, door=(45, 7), to='yule_jorn', kind='tower'),
    dict(id='yule_sonja_dome', x=48, y=11, w=5, h=4, wall=2, door=(50, 14), to='yule_sonja', kind='icedome'),
    dict(id='yule_brenda_pit', x=14, y=32, w=5, h=4, wall=1, door=(16, 35), to='yule_brenda', kind='pit'),
    dict(id='yule_olaf_lodge', x=37, y=31, w=6, h=5, wall=2, door=(39, 35), to='yule_hunter', kind='tusk'),
    dict(id='yule_branch', x=45, y=38, w=6, h=5, wall=2, door=(47, 42), to='yule_branch', kind='stone'),
    dict(id='yule_fishhut', x=7, y=5, w=4, h=3, wall=2, door=(8, 7), to='yule_fishhut', kind='hut'),
    # no doors
    dict(id='yule_watch', x=34, y=0, w=3, h=4, wall=2, door=None, kind='watch'),
    dict(id='yule_cache', x=50, y=5, w=3, h=3, wall=1, door=None, kind='cache'),
    dict(id='yule_shed', x=3, y=36, w=5, h=3, wall=2, door=None, kind='shed'),
]
# the longhouse body between the door segments (solid; painted as one continuous roof)
BODY = [(22, 12, 1, 8), (13, 18, 1, 2), (12, 19, 1, 1), (42, 16, 2, 4), (44, 18, 1, 2)]
for x, y, w, h in BODY: rect(x, y, w, h, 'Z')
for b in B:
    rect(b['x'], b['y'], b['w'], b['h'], '.')   # under the building (the object blocks)
    if b['door']:
        dx, dy = b['door']
        # the cell in front of the door must be open
        if g[dy + 1][dx] == '#': put(dx, dy + 1, ',')
# kids' secret base: tunnel mouth in the drift (door object; the drift around stays)
put(36, 40, ',')
# lookout deck joins the north trench
put(29, 2, 'p'); put(29, 3, 'p')
json.dump(dict(w=W, h=H, rows=[''.join(r) for r in g], blds=B, body=BODY), open('layout.json', 'w'), indent=1)
occ = {}
for b in B:
    for j in range(b['h']):
        for i in range(b['w']): occ[(b['x'] + i, b['y'] + j)] = 'B'
    if b['door']: occ[b['door']] = 'D'
print('    ' + ''.join(str(x % 10) for x in range(W)))
for y in range(H):
    print('%3d ' % y + ''.join(occ.get((x, y), g[y][x]) for x in range(W)))
