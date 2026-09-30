"""Layouts of the painted maps of the finale (終盤): the white town of Biblia (biblia) and the six floors of the White Archive
(archive_1 .. archive_6). Same tools as the star region (field_star): layout.json -> guide.py -> mkjob.py -> gen.sh -> fit / intfit ->
process.py (OUT=assets/env/finale/under) -> put_rows.py -> v2/src/maps/final_painted_rows.js (R.Final.PAINTED[id]).
Buildings of the town go to meta.blds [{id, x, y, w, h, door: [x, y]}] (the map file makes building objects with those doors);
cells the map data uses (spawns, stairs, triggers, NPCs, chests) are listed in a.objects so fit.py keeps them.
Town chars (look 'town'): ',' lawn, '"' flowers, 'c' white flagstones, '=' wooden pier, '~' sea, 'T' trees, 'X' buildings / walls, 'w' fountain water.
Interior chars (look 'int'): 'c' ivory marble floor, 'u' wooden floor, 'k' carpet (walkable), 'X' walls, 'r' furniture (shelves, desks),
'~' outside (night), 'w' pool.
usage: python3 dng_finale.py <id> [...]   -> <id>/layout.json + ascii"""
import sys, math, json
import numpy as np
from lib import Area, fbm, WALK

MARBLE = (236, 234, 228)
IVORY = (226, 222, 210)
DARK = (40, 26, 16)
WOOD = (96, 66, 44)
GOLD = (196, 160, 80)
PAPER = (246, 244, 236)


def door(a, x, y, ch='c'):
    a.mark('door', [(x, y)], 'a dark ENTRANCE', DARK, solid=False)
    a.put(x, y, ch, True); a.keep[y, x] = True


def bld(a, bid, x, y, w, h, dx, text, color=MARBLE):
    """a building block (solid) with its door in the bottom row at x + dx; the cell below the door stays walkable"""
    cells = [(i, j) for i in range(x, x + w) for j in range(y, y + h) if (i, j) != (x + dx, y + h - 1)]
    a.mark('b_' + bid, cells, text, color)
    door(a, x + dx, y + h - 1)
    if a.g[y + h, x + dx] not in WALK: a.put(x + dx, y + h, 'c', True)
    a.keep[y + h, x + dx] = True
    a.meta.setdefault('blds', []).append(dict(id=bid, x=x, y=y, w=w, h=h, door=[x + dx, y + h - 1]))


def keepcells(a, cells, ch='c'):
    for (x, y) in cells:
        if a.g[y, x] not in WALK: a.g[y, x] = ch
        a.keep[y, x] = True
    a.objects += [dict(type='o', x=x, y=y) for (x, y) in cells]


def hall(a, x0, y0, x1, y1, ch='c'):
    a.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, ch, force=True)


# ======================================================================== the town
def biblia():
    """書の都ビブリア (56 x 46): the white town of the Records on an island in the inner sea. The sea along the south (rows 40-45) with a
    stone quay (rows 36-38) and a wooden pier (x 26-29, rows 39-44) where the records-house ship is moored (east of the pier).
    A low white sea wall rings the town (x 0-1, x 54-55, rows 0-1). North district behind an inner wall (row 15, the north gate x 27-28):
    the WHITE ARCHIVE (x 18-37, rows 2-11, a colossal white library with a great door at x 27), the Hall of the Records (NW) and the
    great library (NE). The middle: the plaza with a round fountain and the statue of the nameless storyteller, Noa's inn (W),
    the tavern (E). The south: the shop, three houses, the quay."""
    a = Area('biblia', 56, 46, 9101, base=',')
    W, H = a.W, a.H
    a.mask_fill(fbm(3, W, H, 5) > 0.66, '"', only=',')
    # the sea (south) and the outer sea wall
    a.rect(0, 39, W, H - 39, '~', force=True)
    a.rect(0, 0, W, 2, 'X', force=True)
    a.rect(0, 0, 2, 39, 'X', force=True); a.rect(W - 2, 0, 2, 39, 'X', force=True)
    wall = [(x, y) for y in range(39) for x in range(W) if a.g[y, x] == 'X']
    a.mark('seawall', wall, 'a low wall of WHITE STONE around the town, its top edge seen from above (the sea is beyond it)', MARBLE)
    # the inner wall of the north district with the north gate (x 27-28)
    inner = [(x, 15) for x in range(2, W - 2) if x not in (27, 28)]
    a.mark('innerwall', inner, 'a low WHITE STONE WALL with a coping on top, dividing the north district from the town', (222, 220, 212))
    a.rect(27, 15, 2, 1, 'c', force=True, keep=True)
    a.mark('gate', [(27, 15), (28, 15)], 'an open arched GATE passage through the white wall (walkable), two white pillars at its sides', (214, 212, 204), solid=False)
    # the quay and the pier
    a.rect(2, 36, W - 4, 3, 'c', force=True, keep=True)
    a.rect(26, 39, 4, 5, '=', force=True, keep=True)
    a.mark('pier', [(x, y) for x in range(26, 30) for y in range(39, 44)], 'a wooden PIER of dark planks on posts, reaching out into the sea (walkable)', (130, 92, 58), solid=False)
    a.mark('ship', [(x, y) for x in range(31, 42) for y in range(39, 45)],
           'a white-hulled two-masted sailing SHIP moored alongside the pier (seen from above: long pale deck, two masts with furled white sails, a small cabin at the stern)', (232, 230, 222))
    # streets
    a.rect(27, 16, 2, 20, 'c', force=True, keep=True)             # the main street N-S (x 27-28)
    a.rect(2, 29, W - 4, 2, 'c', force=True, keep=True)           # the cross street (rows 29-30)
    a.rect(2, 16, W - 4, 2, 'c', force=True, keep=True)           # the street along the inner wall (rows 16-17)
    a.rect(4, 12, 48, 2, 'c', force=True, keep=True)              # the north district street (rows 12-13)
    a.rect(20, 11, 16, 4, 'c', force=True, keep=True)             # the forecourt of the Archive (rows 11-14)
    # the plaza (x 20-35, rows 19-28) with the fountain and the statue
    a.rect(20, 19, 16, 10, 'c', force=True, keep=True)
    a.rect(25, 21, 6, 5, 'w', force=True, keep=True)
    a.mark('fountain', [(x, y) for x in range(25, 31) for y in range(21, 26)],
           'a round white marble FOUNTAIN basin of dark water; in its middle a white stone STATUE of a hooded girl storyteller in a long cloak holding an open book, on a round pedestal', (110, 140, 180))
    a.marks[-1]['shape'] = 'round'
    # buildings (door on the bottom row)
    bld(a, 'biblia_archive', 18, 2, 20, 9, 9, 'the WHITE ARCHIVE: a colossal library of white marble seen from above, a great pale roof of white stone tiles with a round dome and many small skylights, tall buttresses, a grand arched great DOOR in the middle of its south front', (240, 238, 232))
    bld(a, 'biblia_records', 3, 3, 12, 8, 6, 'the HALL OF THE RECORDS: a long white stone hall with a pale grey slate roof, a row of tall windows and a portico of slim columns', (168, 172, 184))
    bld(a, 'biblia_library', 41, 3, 12, 8, 5, 'the GREAT LIBRARY: a tall white building with a pale green copper roof and a small bell turret', (150, 186, 170))
    bld(a, 'biblia_inn', 4, 19, 10, 8, 5, "NOA'S INN: a two-storey white house with a pale blue-grey roof, a wooden balcony and a hanging sign bracket", (176, 184, 200))
    bld(a, 'biblia_tavern', 42, 19, 10, 8, 4, 'the TAVERN: a white house with a round window and a pale grey roof, barrels by the wall', (178, 174, 170))
    bld(a, 'biblia_house1', 15, 20, 4, 6, 1, 'a narrow white townhouse with a grey roof', (172, 176, 186))
    bld(a, 'biblia_house2', 37, 20, 4, 6, 2, 'a narrow white townhouse with a grey roof', (172, 176, 186))
    bld(a, 'biblia_shop', 4, 31, 9, 5, 4, 'the SHOP: a white stone shop with a striped awning over its front', (190, 172, 156))
    bld(a, 'biblia_house3', 15, 31, 7, 5, 3, 'a white house with a grey roof and window boxes', (172, 176, 186))
    bld(a, 'biblia_house4', 34, 31, 7, 5, 3, 'a white house with a grey roof and window boxes', (172, 176, 186))
    bld(a, 'biblia_house5', 43, 31, 9, 5, 4, 'a white house with a grey roof', (172, 176, 186))
    # a notice board at the plaza (solid) and trees in the gardens
    a.mark('board', [(21, 19)], 'a wooden NOTICE BOARD on two posts covered with many pinned papers', WOOD)
    for (x, y) in [(3, 14), (15, 12), (40, 12), (52, 14), (3, 27), (52, 27), (19, 27), (36, 27), (22, 33), (32, 33), (13, 34), (41, 34), (53, 33), (2, 33)]:
        a.put(x, y, 'T', True)
    a.tidy()
    a.spawns = {'dock': dict(x=27, y=40, dir='n'), 'warp': dict(x=28, y=32, dir='s'), 'plaza': dict(x=27, y=27, dir='n'),
                'gate': dict(x=27, y=17, dir='n'), 'archive': dict(x=27, y=12, dir='s')}
    a.exits = []
    keepcells(a, [(27, 40), (28, 42), (27, 43), (28, 32), (27, 27), (27, 17), (27, 12), (28, 14), (22, 20), (26, 27), (30, 27), (33, 20), (24, 37), (30, 37),
                  (9, 14), (46, 14), (9, 27), (46, 27), (8, 36), (18, 36), (37, 36), (47, 36)])
    a.meta.update(name='書の都ビブリア', region='finale', zones=[], worldRect=[0, 0, 1, 1], look='town')
    return a


# ======================================================================== the White Archive (six floors, climbed upward)
def _shelves(a, x0, y0, x1, y1, step=3, gapx=None):
    """rows of tall bookshelves (solid 'r', 1 cell deep) every `step` rows between x0..x1, with gaps at gapx"""
    cells = []
    for y in range(y0, y1 + 1, step):
        for x in range(x0, x1 + 1):
            if gapx and x in gapx: continue
            a.put(x, y, 'r', True); cells.append((x, y))
    return cells


def archive_1():
    """白の大書庫 1 階 閲覧の間 (44 x 36): the entrance (south middle, x 21-22) -> the entrance hall (rows 27-33) with the spring's alcove
    (west) and, after the ending, a stair down to the Depths of Oblivion (east alcove, closed); the great reading hall (rows 3-24) with
    two wings of tall white shelves and reading tables; the stairs up in the north middle are reached through the east wing's aisles
    (the middle of the north is a wall of shelves). The eastern continent's sealed letter lies on a reading table in the west wing."""
    a = Area('archive_1', 44, 36, 9201, base='~')
    a.rect(1, 1, 42, 34, 'X', force=True)
    hall(a, 3, 3, 40, 24)                     # the great reading hall
    hall(a, 14, 26, 29, 33)                   # the entrance hall
    hall(a, 20, 25, 23, 25)                   # the way between them
    hall(a, 21, 34, 22, 34)                   # the entrance
    hall(a, 5, 28, 12, 32)                    # the west alcove (spring)
    hall(a, 31, 28, 38, 32)                   # the east alcove (the closed stair down)
    hall(a, 13, 30, 13, 30); hall(a, 30, 30, 30, 30)
    a.rect(18, 3, 8, 3, 'k', force=True)      # the carpet before the stairs
    # the middle: a wall of shelves across (rows 7-8, x 12-31) so the stairs are reached round the sides
    sh = []
    sh += _shelves(a, 5, 6, 12, 22, step=4)
    sh += _shelves(a, 31, 6, 38, 22, step=4)
    sh += _shelves(a, 16, 10, 27, 22, step=4, gapx=(21, 22))
    for x in range(12, 32): a.put(x, 7, 'r', True); sh.append((x, 7))
    a.mark('shelves', sh, 'tall bookshelves of pale WHITE-PAINTED wood packed with books whose spines are blank white, seen from above', (180, 168, 140))
    a.marks[-1]['solid'] = True
    # reading tables (west wing)
    tbl = [(7, 24), (8, 24)]
    for c in tbl: a.put(c[0], c[1], 'r', True)
    a.mark('table', tbl, 'a long wooden READING TABLE with a closed book on it', WOOD)
    # the stairs up and the entrance
    a.rect(21, 3, 2, 1, 'c', force=True, keep=True)
    a.mark('stairs', [(21, 2), (22, 2)], 'a broad white marble STAIRCASE going up (walkable)', (200, 196, 186), solid=False)
    a.rect(21, 2, 2, 1, 'c', force=True, keep=True)
    a.mark('entry', [(21, 34), (22, 34)], 'the great arched DOOR of the Archive (open), leading outside', DARK, solid=False)
    a.mark('downstair', [(36, 30), (37, 30)], 'a narrow STAIRCASE going down into a pale white mist, closed by a low white stone rail (not walkable)', (210, 214, 224))
    keep = [(21, 33), (22, 33), (21, 4), (22, 4), (8, 30), (9, 30), (35, 30), (34, 30), (7, 23), (21, 26), (39, 20), (4, 20), (21, 16), (40, 4), (4, 4)]
    keepcells(a, keep)
    a.spawns = {'entrance': dict(x=21, y=33, dir='n'), 'from2': dict(x=21, y=4, dir='s')}
    a.meta.update(name='白の大書庫', region='finale', zones=[], worldRect=[0, 0, 1, 1], look='int')
    return a


def archive_2():
    """2 階 写本の間 (44 x 36): the stairs from below arrive in the south-west; three copying rooms in a zigzag (south room -> middle room ->
    north room), each joined by one doorway; long copying desks in rows; the stairs up in the north-east corner of the north room,
    where the book giant stands. A spring in the middle room."""
    a = Area('archive_2', 44, 36, 9202, base='~')
    a.rect(1, 1, 42, 34, 'X', force=True)
    hall(a, 3, 24, 40, 32)                    # the south room
    hall(a, 3, 13, 40, 21)                    # the middle room
    hall(a, 3, 3, 40, 10)                     # the north room
    hall(a, 36, 22, 38, 23)                   # south -> middle (east doorway)
    hall(a, 5, 11, 7, 12)                     # middle -> north (west doorway)
    a.rect(4, 26, 3, 5, 'u', force=True)
    desks = []
    for (x0, y0, x1) in [(10, 26, 33), (10, 29, 33), (10, 15, 33), (10, 18, 33), (12, 5, 30), (12, 8, 30)]:
        for x in range(x0, x1 + 1):
            if x in (21, 22): continue
            a.put(x, y0, 'r', True); desks.append((x, y0))
    a.mark('desks', desks, 'long rows of wooden COPYING DESKS with inkwells, quills and stacks of blank white paper, seen from above', WOOD)
    a.mark('stairs', [(38, 3), (39, 3)], 'a broad white marble STAIRCASE going up (walkable)', (200, 196, 186), solid=False)
    a.mark('stairsdown', [(4, 32), (5, 32)], 'a white marble STAIRCASE going down (walkable)', (200, 196, 186), solid=False)
    keep = [(38, 4), (39, 4), (38, 5), (4, 31), (5, 31), (37, 22), (37, 23), (6, 11), (6, 12), (20, 17), (21, 17), (8, 20), (38, 30), (4, 14), (39, 9)]
    keepcells(a, keep)
    a.spawns = {'from1': dict(x=5, y=31, dir='n'), 'from3': dict(x=38, y=4, dir='s')}
    a.meta.update(name='白の大書庫', region='finale', zones=[], worldRect=[0, 0, 1, 1], look='int')
    return a


def archive_3():
    """3 階 記憶の回廊 (44 x 36): a long gallery ring round a closed core; eight alcoves open off the outer side of the ring, each with a
    lectern (the echoes of the eight tales); a resting place (spring) in the south of the ring; the stairs from below in the south-west;
    in the north a short hall before the SEALED DOOR (x 21-22, row 5) and behind it the stairs up."""
    a = Area('archive_3', 44, 36, 9203, base='~')
    a.rect(1, 1, 42, 34, 'X', force=True)
    hall(a, 7, 8, 36, 29)                     # the outer ring (then the core is walled again)
    a.rect(11, 12, 22, 14, 'X', force=True)   # the closed core
    hall(a, 17, 6, 26, 7)                     # the hall before the sealed door
    hall(a, 20, 2, 23, 4)                     # behind the door: the stairs up
    a.mark('sealdoor', [(21, 5), (22, 5)], 'a tall double DOOR of white stone covered in pale glowing script and a round seal (closed)', (214, 218, 236))
    a.rect(21, 5, 2, 1, 'X', force=True)
    a.mark('stairs', [(21, 2), (22, 2)], 'a white marble STAIRCASE going up (walkable)', (200, 196, 186), solid=False)
    # eight alcoves (4 west x 4..6, 4 east x 37..39), each 3 x 3 with a lectern at the far side
    lect = []
    for i, y in enumerate((9, 14, 19, 24)):
        hall(a, 3, y, 6, y + 2); lect.append((3, y + 1))
        hall(a, 37, y, 40, y + 2); lect.append((40, y + 1))
    for (x, y) in lect: a.put(x, y, 'r', True)
    a.mark('lecterns', lect, 'a small wooden LECTERN with an open book, lit by a faint glow', (170, 130, 80))
    # the south: the resting place and the stairs down
    hall(a, 17, 30, 26, 32)
    a.rect(8, 30, 2, 2, 'c', force=True, keep=True)
    a.mark('stairsdown', [(8, 31), (9, 31)], 'a white marble STAIRCASE going down (walkable)', (200, 196, 186), solid=False)
    a.rect(20, 18, 4, 1, 'X', force=True)
    keep = [(8, 30), (9, 30), (21, 7), (22, 7), (21, 3), (22, 3), (21, 31), (22, 31), (5, 10), (5, 15), (5, 20), (5, 25), (38, 10), (38, 15), (38, 20), (38, 25), (21, 9), (34, 28)]
    keepcells(a, keep)
    a.spawns = {'from2': dict(x=8, y=30, dir='n'), 'from4': dict(x=21, y=3, dir='s')}
    a.meta.update(name='白の大書庫', region='finale', zones=[], worldRect=[0, 0, 1, 1], look='int')
    return a


def archive_4():
    """4 階 伝説の間 (44 x 36): the stairs from below in the south-east; the long painted corridor along the south (four great paintings
    on its north wall); the west hall of statues; the HALL OF LEGENDS in the north (a red carpet to the stair alcove at the top middle),
    where the three shades rise. A spring in the west hall."""
    a = Area('archive_4', 44, 36, 9204, base='~')
    a.rect(1, 1, 42, 34, 'X', force=True)
    hall(a, 6, 27, 39, 31)                    # the painted corridor
    hall(a, 3, 6, 11, 31)                     # the west hall of statues
    hall(a, 12, 8, 38, 18)                    # the Hall of Legends
    hall(a, 19, 2, 24, 7)                     # the stair alcove
    a.rect(20, 7, 4, 12, 'k', force=True)     # the red carpet
    for (px, w_) in ((9, 3), (16, 3), (23, 3), (30, 3)):
        pass
    pics = []
    for x0 in (12, 19, 26, 33):
        cells = [(x0 + i, 26) for i in range(3)]
        pics += cells
        a.mark('painting%d' % x0, cells, 'a great framed PAINTING hanging on the wall (a legend of heroes, faded)', (160, 120, 70))
    for (x, y) in [(5, 10), (9, 10), (5, 16), (9, 16), (5, 22), (9, 22)]:
        a.put(x, y, 'X', True)
        a.mark('statue%d_%d' % (x, y), [(x, y)], 'a white marble STATUE of a robed figure on a square plinth', (224, 222, 216))
    for (x, y) in [(15, 10), (15, 16), (35, 10), (35, 16), (19, 13), (25, 13)]:
        a.put(x, y, 'X', True)
        a.mark('pillar%d_%d' % (x, y), [(x, y)], 'a round white marble PILLAR', (228, 226, 220))
    a.mark('stairs', [(21, 2), (22, 2)], 'a white marble STAIRCASE going up (walkable)', (200, 196, 186), solid=False)
    a.mark('stairsdown', [(38, 31), (39, 31)], 'a white marble STAIRCASE going down (walkable)', (200, 196, 186), solid=False)
    a.rect(37, 31, 3, 1, 'c', force=True, keep=True)
    keep = [(38, 30), (39, 30), (21, 3), (22, 3), (21, 8), (22, 8), (21, 17), (7, 28), (13, 27), (20, 27), (27, 27), (34, 27), (7, 13), (7, 25), (37, 9)]
    keepcells(a, keep)
    a.spawns = {'from3': dict(x=38, y=30, dir='w'), 'from5': dict(x=21, y=3, dir='s')}
    a.meta.update(name='白の大書庫', region='finale', zones=[], worldRect=[0, 0, 1, 1], look='int')
    return a


def archive_5():
    """5 階 白紙の写字室 (40 x 34): the stairs from below in the south; an antechamber with a resting place; the great copying hall where
    the Grand Scribe waits at his high desk in the middle north, with the WHITE BOOK on a stand; long shelves along both sides; behind
    the desk the stairs up, wrapped in layers of white paper until he has fallen."""
    a = Area('archive_5', 40, 34, 9205, base='~')
    a.rect(1, 1, 38, 32, 'X', force=True)
    hall(a, 14, 24, 25, 30)                   # the antechamber
    hall(a, 18, 31, 21, 31)
    hall(a, 18, 22, 21, 23)
    hall(a, 4, 4, 35, 21)                     # the great copying hall
    hall(a, 18, 2, 21, 3)                     # the stairs up
    a.rect(18, 9, 4, 13, 'k', force=True)
    sh = _shelves(a, 5, 5, 13, 19, step=3) + _shelves(a, 26, 5, 34, 19, step=3)
    a.mark('shelves', sh, 'tall shelves of white-painted wood full of white books', (180, 168, 140))
    desk = [(18, 6), (19, 6), (20, 6), (21, 6)]
    for c in desk: a.put(c[0], c[1], 'r', True)
    a.mark('desk', desk, "the Grand Scribe's high WRITING DESK of dark wood with an inkstand, a tall candlestick and a huge open WHITE BOOK with blank pages", WOOD)
    a.mark('stairs', [(19, 2), (20, 2)], 'a white marble STAIRCASE going up, wrapped and blocked by many layers of floating WHITE PAPER', (244, 244, 240), solid=False)
    a.mark('stairsdown', [(19, 31), (20, 31)], 'a white marble STAIRCASE going down (walkable)', (200, 196, 186), solid=False)
    keep = [(19, 30), (20, 30), (19, 3), (20, 3), (19, 4), (20, 4), (19, 8), (20, 8), (19, 15), (15, 27), (24, 27), (19, 22), (6, 20), (33, 20)]
    keepcells(a, keep)
    a.spawns = {'from4': dict(x=19, y=30, dir='n'), 'from6': dict(x=19, y=4, dir='s')}
    a.meta.update(name='白の大書庫', region='finale', zones=[], worldRect=[0, 0, 1, 1], look='int', smooth=0.3)
    return a


def archive_6():
    """6 階 虚ろの間 (36 x 32, the last floor): the stairs from below in the south; a short antechamber with a resting place; a great ROUND
    HALL of pale marble where loose white pages whirl; in the north a raised round dais with the ALTAR holding the Chronicle of
    Beginnings (a huge old book, open)."""
    a = Area('archive_6', 36, 32, 9206, base='~')
    ys, xs = np.mgrid[0:a.H, 0:a.W] + 0.5
    cx, cy = 18.0, 13.0
    d = lambda rx, ry: np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
    a.mask_fill(d(16.5, 12.5) <= 1.0, 'X', force=True)
    a.mask_fill(d(14.5, 10.6) <= 1.0, 'c', force=True)
    a.rect(13, 23, 10, 8, 'X', force=True)
    hall(a, 15, 24, 20, 29)                   # the antechamber
    hall(a, 17, 22, 18, 23)
    a.mark('dais', [(x, y) for y in range(a.H) for x in range(a.W) if d(3.2, 2.4)[y, x] <= 1.0 and y < 8], '', (0, 0, 0)); a.marks.pop()
    altar = [(17, 5), (18, 5)]
    for c in altar: a.put(c[0], c[1], 'r', True)
    a.mark('altar', altar, 'a white stone ALTAR on a round raised dais of three steps, a huge ancient open BOOK lying on it (the Chronicle of Beginnings)', (236, 228, 200))
    a.mark('stairsdown', [(17, 29), (18, 29)], 'a white marble STAIRCASE going down (walkable)', (200, 196, 186), solid=False)
    a.rect(17, 29, 2, 1, 'c', force=True, keep=True)
    keep = [(17, 28), (18, 28), (17, 7), (18, 7), (17, 12), (18, 16), (16, 26), (19, 26)]
    keepcells(a, keep)
    a.spawns = {'from5': dict(x=17, y=28, dir='n'), 'altar': dict(x=17, y=8, dir='n')}
    a.meta.update(name='白の大書庫', region='finale', zones=[], worldRect=[0, 0, 1, 1], look='int', smooth=0.45)
    return a


MAPS = {k: v for k, v in globals().items() if k in ('biblia', 'archive_1', 'archive_2', 'archive_3', 'archive_4', 'archive_5', 'archive_6')}

if __name__ == '__main__':
    for aid in [v for v in sys.argv[1:] if not v.startswith('-')]:
        a = MAPS[aid]()
        seen0 = np.zeros((a.H, a.W), bool)
        for s_ in a.spawns.values(): seen0 |= a.reach(s_['x'], s_['y'])
        pk = a.walk() & ~seen0
        a.g[pk] = 'X'
        print('closed pockets', int(pk.sum()))
        a.save(aid)
        print(a.ascii())
        sp = list(a.spawns.values())
        seen = a.reach(sp[0]['x'], sp[0]['y'])
        for k, s in a.spawns.items(): print('spawn', k, s, 'reach', bool(seen[s['y'], s['x']]))
        for o in a.objects:
            x, y = o['x'], o['y']
            if not seen[y, x]: print('obj unreached', (x, y), a.g[y, x])
        print('walkable', int(a.walk().sum()), 'reached', int(seen.sum()))
