"""Layouts of the painted floors of 忘却の底 (the post-clear dungeon, oblivion_1 .. oblivion_5) and of the Biblia entrance patch.
Same tools as the finale (../finale/lib.py Area): layout.json -> guide.py -> mkjob.py -> gen.sh -> fit.py -> process.py
(OUT=assets/env/oblivion/under) -> put_rows.py -> v2/src/maps/oblivion_painted_rows.js (R.Oblivion.PAINTED[id]).
The look: fragments of the White Archive (ivory marble, blue-grey stone, white shelves) and of forgotten lands, floating over a
bottomless sea of pale grey-violet mist (the void, not walkable) where loose white pages drift.
Chars: walkable  c marble floor  s white paper sand  , grass  : desert sand  _ snow  = paper bridge / seam  k faded carpet
       solid     ~ mist void  X stone walls / pillars / shelves  T forest trees  F snowy pines  r rocks
Cells the map data uses (spawns, stairs, triggers, chests, springs) are kept walkable (a.objects).
usage: python3 dng_oblivion.py <id> [...]   -> <id>/layout.json + ascii"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'finale'))
from lib import Area  # noqa: E402

WALK = set('cs,:_=k')
MARBLE = (236, 234, 228)
STONE = (150, 146, 140)


def keepcells(a, cells, ch='c'):
    for (x, y) in cells:
        if a.g[y, x] not in WALK: a.g[y, x] = ch
        a.keep[y, x] = True
    a.objects += [dict(type='o', x=x, y=y) for (x, y) in cells]


def hall(a, x0, y0, x1, y1, ch='c'):
    a.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, ch, force=True)


def stairs_up(a, x, y, w=2):
    a.mark('stairs', [(x + i, y) for i in range(w)], 'a white marble STAIRCASE going UP into soft light (walkable)', (200, 196, 186), solid=False)
    a.rect(x, y, w, 1, 'c', force=True, keep=True)


def stairs_down(a, x, y, w=2):
    a.mark('stairsdown', [(x + i, y) for i in range(w)], 'a white marble STAIRCASE going DOWN into pale mist (walkable)', (120, 124, 150), solid=False)
    a.rect(x, y, w, 1, 'c', force=True, keep=True)


def tablet(a, cells, kind='tablet'):
    a.mark(kind, cells, 'a small upright grey STONE TABLET with faded carved lines (an old memorial stone), seen from above', (96, 96, 108))


# ======================================================================== 1 階 忘れられた者の岸
def oblivion_1():
    """忘れられた者の岸 (40 x 32): a shore of white paper sand along the mist. The stairs up (to Biblia) in the north-west; the shore
    runs south and then east to the down stairs in the south-east. A spit along the north runs east to a dead end (a chest); a sandbar
    leads from the south shore north to the islet of nameless graves (a ring of stones) in the middle."""
    a = Area('oblivion_1', 40, 32, 9301, base='~')
    a.blob(7, 5, 5.5, 3.6, 's', rough=0.25, seed=1)                  # the landing
    a.stroke([(7, 6), (6, 11), (7, 17), (10, 22), (15, 25), (22, 26), (29, 25), (33, 24)], 4.2, 's', wobble=0.6, seed=2)   # the shore
    a.blob(34, 25, 4.5, 3.6, 's', rough=0.25, seed=3)                # the south-east landing
    a.stroke([(11, 4), (18, 3), (26, 4), (33, 5)], 3.0, 's', wobble=0.4, seed=4)   # the north spit
    a.blob(34, 5, 3.0, 2.2, 's', rough=0.2, seed=5)
    a.blob(4, 22, 2.6, 2.4, 's', rough=0.2, seed=6)                 # the south-west pocket
    a.stroke([(5, 22), (9, 21)], 2.6, 's', seed=7)
    a.stroke([(21, 25), (21, 20), (22, 17)], 2.6, 's', wobble=0.3, seed=8)   # the sandbar
    a.blob(22, 13, 5.5, 4.2, 's', rough=0.18, seed=9)               # the islet of graves
    # the ring of nameless graves (solid stones round an open middle)
    ring = [(19, 11), (25, 11), (18, 13), (26, 13), (19, 15), (25, 15), (22, 10)]
    for (x, y) in ring: a.put(x, y, 'X', True)
    a.mark('graves', ring, 'small weathered grey GRAVESTONES without names, standing in a ring', (110, 110, 122))
    # memorial tablets along the shore (signs)
    for c in [(10, 3), (3, 12), (12, 21), (30, 23)]: a.put(c[0], c[1], 'X', True)
    tablet(a, [(10, 3), (3, 12), (12, 21), (30, 23)])
    # half-sunk white bookshelves of the archive, washed up (scenery on the sand edges)
    sh = [(15, 5), (16, 5), (8, 15), (8, 16)]
    for c in sh: a.put(c[0], c[1], 'X', True)
    a.mark('shelf', sh, 'a toppled old WHITE BOOKSHELF half buried in the sand, white books spilling out', (180, 168, 140))
    stairs_up(a, 6, 2)
    stairs_down(a, 34, 27)
    keep = [(6, 3), (7, 3), (34, 26), (35, 26), (33, 5), (4, 23), (22, 13), (17, 25), (24, 27), (29, 26)]
    keepcells(a, keep, 's')
    a.spawns = {'from_town': dict(x=6, y=3, dir='s'), 'from2': dict(x=34, y=26, dir='n')}
    a.meta.update(name='忘却の底', look='void', smooth=0.5)
    return a


# ======================================================================== 2 階 継ぎはぎの森
def oblivion_2():
    """継ぎはぎの森 (44 x 34): three forgotten landscapes floating in the mist, stitched together by long seams of white paper (bridges):
    a forest glade (north-west, the stairs up), a desert of pale sand (south-west), a snowfield (east, the stairs down)."""
    a = Area('oblivion_2', 44, 34, 9302, base='~')
    # forest glade
    a.blob(10, 9, 8.0, 6.5, ',', rough=0.2, seed=1)
    forest = [(x, y) for y in range(a.H) for x in range(a.W) if a.g[y, x] == ',']
    # tree masses inside the glade, leaving a clear winding trail
    for (cx, cy, rx, ry) in [(4, 6, 2.2, 2.6), (15, 5, 2.4, 2.0), (5, 13, 2.0, 2.2), (14, 13, 2.2, 1.8)]:
        a.blob(cx, cy, rx, ry, 'T', rough=0.2, seed=cx * 7 + cy, only=',')
    # desert
    a.blob(11, 26, 8.0, 5.2, ':', rough=0.2, seed=2)
    for (cx, cy) in [(5, 25), (16, 29), (13, 23)]:
        a.blob(cx, cy, 1.4, 1.1, 'r', rough=0.1, seed=cx + cy, only=':')
    # snowfield
    a.blob(33, 17, 8.5, 12.0, '_', rough=0.2, seed=3)
    for (cx, cy, rx, ry) in [(37, 9, 2.0, 2.4), (28, 13, 1.8, 2.0), (38, 22, 2.0, 2.2), (29, 25, 1.6, 1.6)]:
        a.blob(cx, cy, rx, ry, 'F', rough=0.2, seed=cx * 3 + cy, only='_')
    # seams of white paper (bridges over the mist)
    a.stroke([(9, 15), (9, 21)], 3.0, '=', seed=4)                      # forest -> desert
    a.stroke([(19, 26), (25, 24)], 3.0, '=', seed=5)                    # desert -> snow
    a.stroke([(18, 8), (25, 9)], 3.0, '=', seed=6)                      # forest -> snow (north)
    a.mark('seam', [(x, y) for y in range(a.H) for x in range(a.W) if a.g[y, x] == '='],
           'a long flat BRIDGE of layered sheets of WHITE PAPER stitched together with dark thread, lying over the mist (walkable)', (244, 242, 236), solid=False)
    stairs_up(a, 8, 3)
    stairs_down(a, 33, 28)
    keep = [(8, 4), (9, 4), (33, 27), (34, 27), (9, 9), (11, 26), (33, 17), (6, 28), (40, 15), (34, 6)]
    keepcells(a, keep, ',')
    for (x, y) in [(11, 26), (6, 28)]: a.g[y, x] = ':'
    for (x, y) in [(33, 27), (34, 27), (33, 17), (40, 15), (34, 6)]: a.g[y, x] = '_'
    a.spawns = {'from1': dict(x=8, y=4, dir='s'), 'from3': dict(x=33, y=27, dir='n')}
    a.meta.update(name='忘却の底', look='void', smooth=0.5)
    return a


# ======================================================================== 3 階 恐れの間
def oblivion_3():
    """恐れの間 (36 x 34): a hall of the archive gone cold. The stairs up in the south; a long pillared hall with statues of fear leads
    north; a west and an east side room; the antechamber; the THRONE ROOM in the north with a broken black throne, where the shade of
    the Demon King waits; the stairs down in the throne room's east alcove."""
    a = Area('oblivion_3', 36, 34, 9303, base='~')
    a.rect(2, 1, 32, 32, 'X', force=True)
    hall(a, 16, 28, 19, 30)                   # the stair landing (south)
    hall(a, 9, 14, 26, 27)                    # the pillared hall
    hall(a, 3, 17, 7, 23); hall(a, 8, 19, 8, 21)     # west room
    hall(a, 28, 17, 32, 23); hall(a, 27, 19, 27, 21)  # east room
    hall(a, 14, 10, 21, 12)                   # the antechamber
    hall(a, 16, 13, 19, 13)
    hall(a, 7, 2, 28, 8)                      # the throne room
    hall(a, 16, 9, 19, 9)                     # its door
    hall(a, 29, 3, 31, 6)                     # the east alcove (stairs down)
    a.rect(16, 3, 4, 6, 'k', force=True)      # the faded carpet to the throne
    pil = [(11, 16), (11, 20), (11, 24), (24, 16), (24, 20), (24, 24)]
    for c in pil: a.put(c[0], c[1], 'X', True)
    a.mark('pillars', pil, 'a round white marble PILLAR, cracked, streaked with black ink', (228, 226, 220))
    st = [(14, 18), (21, 18), (14, 22), (21, 22)]
    for c in st: a.put(c[0], c[1], 'X', True)
    a.mark('statues', st, 'a dreadful STATUE of a horned shadow figure on a square plinth, its eyes gouged out', (70, 66, 80))
    th = [(17, 2), (18, 2)]
    for c in th: a.put(c[0], c[1], 'X', True)
    a.mark('throne', th, 'a broken black stone THRONE, cracked in two, on a low dais', (40, 34, 48))
    stairs_up(a, 17, 31)
    a.rect(17, 31, 2, 1, 'c', force=True, keep=True)
    stairs_down(a, 30, 2)
    keep = [(17, 30), (18, 30), (30, 3), (31, 3), (17, 9), (18, 9), (4, 20), (31, 20), (14, 11), (21, 11), (17, 5)]
    keepcells(a, keep)
    a.spawns = {'from2': dict(x=17, y=30, dir='n'), 'from4': dict(x=30, y=3, dir='s')}
    a.meta.update(name='忘却の底', look='voidint')
    return a


# ======================================================================== 4 階 終わらない回廊
def oblivion_4():
    """終わらない回廊 (48 x 26): three identical square rooms in a row, each joined to the next by two identical corridors (north and south).
    Only one of each pair goes on (a pale flame over its mouth); the other folds back to the first room (an event). The stairs up in the
    first room's west; the stair hall with the stairs down at the far east."""
    a = Area('oblivion_4', 48, 26, 9304, base='~')
    a.rect(1, 3, 46, 20, 'X', force=True)
    rooms = [(3, 6, 11, 19), (17, 6, 25, 19), (31, 6, 39, 19)]
    for (x0, y0, x1, y1) in rooms: hall(a, x0, y0, x1, y1)
    for i in range(2):
        x0 = rooms[i][2] + 1; x1 = rooms[i + 1][0] - 1
        hall(a, x0, 8, x1, 9); hall(a, x0, 16, x1, 17)
    hall(a, 40, 8, 42, 9); hall(a, 40, 16, 42, 17)      # the last room's two corridors
    hall(a, 43, 6, 45, 19)                              # the stair hall
    hall(a, 2, 12, 2, 13)                               # the stairs up niche (west)
    # bookshelves along the north wall of every room (the same look three times)
    sh = []
    for (x0, y0, x1, y1) in rooms:
        for x in range(x0, x1 + 1):
            sh.append((x, y0))
        a.put(x0 + 4, y0 + 6, 'X', True); a.put(x0 + 5, y0 + 6, 'X', True)
        a.mark('table%d' % x0, [(x0 + 4, y0 + 6), (x0 + 5, y0 + 6)], 'a long low wooden READING TABLE with one open white book', (96, 66, 44))
    for c in sh: a.put(c[0], c[1], 'X', True)
    a.mark('shelves', sh, 'tall bookshelves of pale WHITE-PAINTED wood packed with books whose spines are blank white, against the wall', (180, 168, 140))
    a.mark('stairs', [(2, 12), (2, 13)], 'a white marble STAIRCASE going UP to the west (walkable)', (200, 196, 186), solid=False)
    stairs_down(a, 44, 19)
    a.g[19, 44] = 'c'; a.g[19, 45] = 'c'
    keep = [(3, 12), (3, 13), (44, 18), (45, 18), (7, 9), (21, 9), (35, 9), (44, 7), (24, 18)]
    keepcells(a, keep)
    a.spawns = {'from3': dict(x=3, y=12, dir='e'), 'from5': dict(x=44, y=18, dir='n'), 'loop': dict(x=4, y=13, dir='e')}
    a.meta.update(name='忘却の底', look='voidint')
    return a


# ======================================================================== 5 階 円環の間
def oblivion_5():
    """円環の間 (36 x 34): a ring-shaped hall around the dragon's bed. The stairs arrive at the south of the ring; the ring runs round both
    sides to the only gate into the inner circle, in the north, with the resting place (a goddess statue) beside it. Inside, white pages
    whirl in a great spiral on the floor where the coiled dragon sleeps."""
    a = Area('oblivion_5', 36, 34, 9305, base='~')
    ys, xs = np.mgrid[0:a.H, 0:a.W] + 0.5
    cx, cy = 18.0, 17.0
    d = np.sqrt(((xs - cx) / 15.5) ** 2 + ((ys - cy) / 15.0) ** 2)
    a.mask_fill(d <= 1.0, 'c', force=True)                      # the ring floor (outer edge)
    a.mask_fill(d <= 0.74, 'X', force=True)                     # the inner wall
    a.mask_fill(d <= 0.64, 'c', force=True)                     # the inner circle (the dragon's bed)
    hall(a, 17, 4, 18, 7)                                       # the north gate through the inner wall
    hall(a, 16, 30, 19, 32)                                     # the stair landing (south)
    sw = [(x, y) for y in range(a.H) for x in range(a.W) if 0.38 <= np.hypot(xs[y, x] - cx, ys[y, x] - cy) / 9.6 <= 0.42 and False]
    a.mark('whirl', [(17, 17), (18, 17), (17, 16), (18, 16)], 'the centre of a great SPIRAL of loose WHITE PAGES swirling on the floor (walkable, flat)', (244, 244, 240), solid=False)
    stairs_up(a, 17, 32)
    keep = [(17, 31), (18, 31), (12, 4), (13, 4), (12, 5), (13, 5), (17, 9), (18, 9), (17, 17), (3, 17), (32, 17), (8, 27)]
    keepcells(a, keep)
    a.spawns = {'from4': dict(x=17, y=31, dir='n'), 'gate': dict(x=17, y=9, dir='n')}
    a.meta.update(name='忘却の底', look='voidint', smooth=0.45)
    return a


MAPS = {k: v for k, v in globals().items() if k.startswith('oblivion_')}

if __name__ == '__main__':
    for aid in [v for v in sys.argv[1:] if not v.startswith('-')]:
        a = MAPS[aid]()
        seen0 = np.zeros((a.H, a.W), bool)
        for s_ in a.spawns.values(): seen0 |= a.reach(s_['x'], s_['y'])
        wk = np.isin(a.g, list(WALK))
        pk = wk & ~seen0
        a.g[pk] = '~'
        print('closed pockets', int(pk.sum()))
        a.save(aid)
        print('   ' + ''.join(str(i % 10) for i in range(a.W)))
        print(a.ascii())
        sp = list(a.spawns.values())
        seen = a.reach(sp[0]['x'], sp[0]['y'])
        for k, s in a.spawns.items(): print('spawn', k, s, 'reach', bool(seen[s['y'], s['x']]))
        for o in a.objects:
            x, y = o['x'], o['y']
            if not seen[y, x]: print('obj unreached', (x, y), a.g[y, x])
