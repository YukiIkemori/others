"""Layouts of the painted town and dungeon floors of the Orbis plateau (same tools as the field areas: layout.json -> guide.py -> mkjob ->
gen.sh -> fit.py -> process.py (OUT=assets/env/star/under) -> put_rows.py -> v2/src/maps/star_painted_rows.js).
Buildings of the town go to meta.blds [{id, x, y, w, h, door: [x, y]}] (the map file makes building objects with those doors);
cells the map data uses (spawns, stairs, triggers, NPCs, chests, patrol routes) are listed in a.objects so fit.py keeps them.
Imported by areas_star.py (MAPS).
Interior chars (look 'int'): 'c' marble floor, 'u' wooden floor, 'k' red carpet (walkable), ',' courtyard lawn, '"' flowers,
'w' fountain / pool water, 'X' walls, 'r' furniture (desks, shelves), '~' outside the building (night)."""
import math
import numpy as np
from lib import Area, fbm

MARBLE = (226, 224, 216)
STONE = (170, 166, 156)
DARK = (40, 26, 16)
WOOD = (110, 80, 56)
BRASS = (190, 150, 70)


def door(a, x, y, ch='c'):
    a.mark('door', [(x, y)], 'a dark ENTRANCE', DARK, solid=False)
    a.put(x, y, ch, True); a.keep[y, x] = True


def bld(a, bid, x, y, w, h, dx, text, color=MARBLE):
    """a building block (solid) with its door in the bottom row at x + dx; the cell below the door stays walkable"""
    cells = [(i, j) for i in range(x, x + w) for j in range(y, y + h) if (i, j) != (x + dx, y + h - 1)]
    a.mark('b_' + bid, cells, text, color)
    door(a, x + dx, y + h - 1)
    if a.g[y + h, x + dx] not in ',;".:s_=cuk': a.put(x + dx, y + h, 'c', True)
    a.keep[y + h, x + dx] = True
    a.meta.setdefault('blds', []).append(dict(id=bid, x=x, y=y, w=w, h=h, door=[x + dx, y + h - 1]))


def keepcells(a, cells, ch='c'):
    for (x, y) in cells:
        if a.g[y, x] not in ',;".:s_=cuk': a.g[y, x] = ch
        a.keep[y, x] = True
    a.objects += [dict(type='o', x=x, y=y) for (x, y) in cells]


# ======================================================================== the town
def orbis():
    """学術都市オルビス (60 x 52): a walled university town on the plateau (WORLD §5.12). Outer wall ring; an inner wall across (rows 21-22)
    with two gates (academy gate x 14-15, observatory gate x 44-45) and a wall between the two northern districts (x 29-30).
    Market (south): plaza with a star fountain, inn, tavern, item shop, arms, magic shop, tailor, laundry, a house. Academy district (NW):
    the academy (its great door and, at night, the service door), the library, the guardroom. Observatory district (NE): the domed
    observatory, the star-lamp tower, two researchers' houses. South gate (x 29-30) -> the plateau, east gate (rows 30-31) -> the ridge."""
    a = Area('orbis', 60, 52, 8101, base=',')
    W, H = a.W, a.H
    a.mask_fill(fbm(3, W, H, 6) > 0.62, '"', only=',')
    # outer wall (2 thick) and the inner walls
    a.rect(0, 0, W, 2, 'X', force=True); a.rect(0, H - 2, W, 2, 'X', force=True)
    a.rect(0, 0, 2, H, 'X', force=True); a.rect(W - 2, 0, 2, H, 'X', force=True)
    a.rect(2, 21, W - 4, 2, 'X', force=True)
    a.rect(29, 2, 2, 19, 'X', force=True)
    wall = [(x, y) for y in range(H) for x in range(W) if a.g[y, x] == 'X']
    # gates (open passages through the walls)
    a.rect(29, H - 2, 2, 2, 'c', force=True, keep=True)          # south gate
    a.rect(W - 2, 30, 2, 2, 'c', force=True, keep=True)          # east gate
    a.rect(14, 21, 2, 2, 'c', force=True, keep=True)             # academy gate
    a.rect(44, 21, 2, 2, 'c', force=True, keep=True)             # observatory gate
    wall = [c for c in wall if a.g[c[1], c[0]] == 'X']
    a.mark('wall', wall, 'the thick pale MARBLE CITY WALLS seen from above: battlements along the top, round towers at the corners', MARBLE)
    for (x, y, w_) in [(29, H - 2, 2), (14, 21, 2), (44, 21, 2)]:
        a.mark('gate%d_%d' % (x, y), [(x + i, y + j) for i in range(w_) for j in range(2)], 'an arched GATE passage through the wall, open (walkable)', (200, 196, 186), solid=False)
    a.mark('gate_e', [(W - 2 + i, 30 + j) for i in range(2) for j in range(2)], 'an arched GATE passage through the wall, open (walkable)', (200, 196, 186), solid=False)
    # streets: the market's main street (S gate -> plaza -> academy gate / observatory gate) and the east street to the east gate
    a.rect(28, 24, 4, 26, 'c', force=True, keep=True)            # main street N-S (x 28-31)
    a.rect(3, 23, 54, 2, 'c', force=True, keep=True)             # the street along the inner wall (rows 23-24)
    a.rect(32, 30, 26, 2, 'c', force=True, keep=True)            # east street (rows 30-31)
    a.rect(3, 36, 54, 2, 'c', force=True, keep=True)             # the lower cross street (rows 36-37)
    # the plaza with the star fountain (x 24-35, rows 26-35)
    a.rect(23, 26, 14, 10, 'c', force=True, keep=True)
    a.rect(27, 29, 6, 4, 'w', force=True, keep=True)
    a.mark('fountain', [(x, y) for x in range(27, 33) for y in range(29, 33)], 'a round marble STAR FOUNTAIN: a basin of dark water with a bronze armillary sphere on a column in its middle', (140, 150, 170))
    # the academy district streets (rows 13-14 in front of the academy, x 14-15 up from the gate) and the observatory district's
    a.rect(3, 14, 26, 2, 'c', force=True, keep=True); a.rect(14, 14, 2, 7, 'c', force=True, keep=True)
    a.rect(31, 14, 26, 2, 'c', force=True, keep=True); a.rect(44, 14, 2, 7, 'c', force=True, keep=True)
    # buildings: market (doors on the bottom row)
    bld(a, 'orbis_inn', 3, 26, 9, 8, 4, 'the inn: a two-storey pale stone house with a slate-blue roof and a hanging sign bracket')
    bld(a, 'orbis_tavern', 13, 26, 8, 8, 3, 'the tavern: a stone house with a round window, a slate roof')
    bld(a, 'orbis_items', 38, 25, 7, 5, 3, 'the item shop: a small stone shop with an awning')
    bld(a, 'orbis_arms', 47, 25, 9, 5, 4, 'the weapon and armour shop: a stone shop with an iron shield bracket')
    bld(a, 'orbis_magic', 38, 32, 8, 4, 3, "the magic shop: a narrow stone shop with a pointed slate roof and a star-shaped window")
    bld(a, 'orbis_house', 48, 32, 8, 4, 4, 'a townhouse of pale stone')
    bld(a, 'orbis_tailor', 4, 39, 8, 7, 3, "the tailor's: a stone house with a big shop window")
    bld(a, 'orbis_laundry', 14, 39, 8, 7, 4, 'the laundry: a low stone wash-house with washing lines behind it', (206, 204, 196))
    bld(a, 'orbis_house2', 38, 39, 8, 7, 3, 'a townhouse of pale stone')
    bld(a, 'orbis_house3', 48, 39, 8, 7, 5, 'a townhouse of pale stone')
    # academy district
    bld(a, 'orbis_academy', 3, 3, 16, 10, 8, 'the ACADEMY OF STAR READING: a grand long hall of white marble with a colonnade along its south front, a slate-blue roof and a small dome, a great door in the middle', (236, 234, 228))
    bld(a, 'orbis_library', 20, 3, 8, 9, 4, 'the LIBRARY: a tall marble building with a copper-green roof and tall arched windows')
    bld(a, 'orbis_guardroom', 3, 16, 7, 4, 3, 'the guardroom: a small squat stone house with a barred window')
    # observatory district
    bld(a, 'orbis_observatory', 34, 3, 12, 10, 6, 'the OBSERVATORY: a round marble building crowned with a great bronze DOME with an open slit for a telescope', (220, 216, 206))
    a.mark('startower', [(51, 3), (52, 3), (51, 4), (52, 4), (51, 5), (52, 5)], 'a slender STAR-LAMP TOWER of pale stone with a glass lantern room at its top', (200, 200, 210))
    bld(a, 'orbis_luca', 47, 8, 7, 5, 3, "a researcher's house of pale stone with a small telescope on its flat roof")
    bld(a, 'orbis_house4', 31, 16, 7, 4, 3, "a researcher's house")
    bld(a, 'orbis_house5', 48, 16, 8, 4, 4, "a researcher's house")
    # gardens: trees and hedges in the districts
    for (x, y) in [(22, 16), (23, 16), (26, 17), (10, 18), (11, 19), (35, 18), (36, 18), (41, 17), (54, 11), (55, 11), (8, 47), (9, 47), (25, 44), (35, 44), (50, 47), (51, 47), (21, 19), (41, 10), (47, 3)]:
        a.put(x, y, 'T', True)
    a.tidy()
    a.spawns = {'gate_s': dict(x=29, y=49, dir='n'), 'gate_e': dict(x=57, y=30, dir='w'), 'warp': dict(x=30, y=38, dir='s'),
                'academy': dict(x=11, y=14, dir='s'), 'plaza': dict(x=26, y=33, dir='n')}
    a.exits = [dict(x=29, y=H - 1, w=2, h=1, to={'map': 's_plateau', 'spawn': 'north'}, edge='s'),
               dict(x=W - 1, y=30, w=1, h=2, to={'map': 's_ridge', 'spawn': 'west'}, edge='e')]
    keepcells(a, [(29, 49), (57, 30), (30, 38), (11, 14), (26, 33), (52, 7), (12, 14), (20, 14), (24, 15), (46, 15), (17, 24), (40, 24), (25, 34), (34, 27),
                  (6, 47), (19, 47), (45, 46)])
    a.meta.update(name='学術都市オルビス', region='r_star', zones=[], worldRect=[602, 16, 60, 52], look='town')
    return a


# ======================================================================== the academy after lights-out
def _hall(a, x0, y0, x1, y1, ch='c'):
    a.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, ch, force=True)


def star_academy_1():
    """消灯後の学院 1 階 (48 x 40): the outer walls; a ring of marble corridors around an open courtyard garden with a fountain
    (the patrols' blind spot, the spring); classrooms with desks and blackboards in the west and east wings; the stair hall in the north
    (the stairs up); the service door (SW, from the laundry yard) where the player comes in; the great door (S, barred)."""
    a = Area('star_academy_1', 48, 40, 8201, base='~')
    a.rect(2, 2, 44, 36, 'X', force=True)
    _hall(a, 4, 29, 43, 31)                 # south corridor
    _hall(a, 12, 8, 14, 31)                 # west corridor
    _hall(a, 33, 8, 35, 31)                 # east corridor
    _hall(a, 12, 8, 35, 10)                 # north corridor
    _hall(a, 18, 3, 29, 7)                  # the stair hall
    _hall(a, 16, 12, 31, 27, ',')           # the courtyard garden
    a.mask_fill(fbm(5, a.W, a.H, 3) > 0.62, '"', only=',')
    a.rect(16, 12, 16, 1, 'c', force=True); a.rect(16, 27, 16, 1, 'c', force=True)
    a.rect(16, 12, 1, 16, 'c', force=True); a.rect(31, 12, 1, 16, 'c', force=True)   # the cloister walk round the garden
    a.rect(22, 18, 4, 3, 'w', force=True)
    a.mark('fountain', [(x, y) for x in range(22, 26) for y in range(18, 21)], 'a round marble FOUNTAIN with a small bronze star on a column in the middle of its basin', (130, 150, 180))
    # the courtyard's openings into the corridors (the rest of the cloister is a low stone balustrade)
    bal = [(15, y) for y in range(11, 29) if y not in (19, 20)] + [(32, y) for y in range(11, 29) if y not in (19, 20)] + \
          [(x, 11) for x in range(15, 33) if x not in (23, 24)] + [(x, 28) for x in range(15, 33) if x not in (23, 24)]
    for (x, y) in bal: a.put(x, y, 'X', True)
    for (x, y) in [(15, 19), (15, 20), (32, 19), (32, 20), (23, 11), (24, 11), (23, 28), (24, 28)]: a.put(x, y, 'c', True)   # 中庭への口
    a.mark('balustrade', bal, 'a low white stone BALUSTRADE round the courtyard garden (the cloister rail)', (200, 198, 190))
    # classrooms (wood floors): W1 x 4-10 rows 4-13, W2 x 4-10 rows 16-26, E1 x 37-43 rows 4-13, E2 x 37-43 rows 16-26
    for (x0, y0, x1, y1) in [(4, 4, 10, 13), (4, 16, 10, 26), (37, 4, 43, 13), (37, 16, 43, 26)]:
        _hall(a, x0, y0, x1, y1, 'u')
    # doors between the classrooms and the corridors (2 per room)
    for (x, y) in [(11, 6), (11, 11), (11, 18), (11, 24), (36, 6), (36, 11), (36, 18), (36, 24), (7, 27), (40, 27), (7, 28), (40, 28)]:
        a.put(x, y, 'c', True)
    # desks (rows of benches) and blackboards
    for (x0, y0) in [(5, 7), (5, 19), (38, 7), (38, 19)]:
        for dy in (0, 3):
            for dx in (0, 3):
                a.rect(x0 + dx, y0 + dy, 2, 1, 'r', force=True)
    for (bx, by) in [(6, 4), (6, 16), (39, 4), (39, 16)]:
        a.mark('board%d_%d' % (bx, by), [(bx, by), (bx + 1, by), (bx + 2, by)], 'a dark green BLACKBOARD on the wall with chalk star diagrams on it', (40, 70, 60))
    # the stairs up (north middle of the stair hall) and the great door (south)
    a.mark('stairs', [(23, 3), (24, 3)], 'a broad marble STAIRCASE going up (walkable)', (190, 186, 176), solid=False)
    a.rect(23, 3, 2, 1, 'c', force=True, keep=True)
    a.rect(22, 32, 4, 5, 'c', force=True)           # the entrance hall
    a.mark('greatdoor', [(23, 37), (24, 37)], 'the great double DOOR of the academy, shut and barred from inside', (90, 60, 40))
    a.rect(4, 32, 5, 4, 'c', force=True)            # the service passage (SW)
    a.put(6, 36, 'c', True); a.keep[36, 6] = True
    a.mark('service', [(6, 37)], 'a small plain SERVICE DOOR in the outer wall', DARK, solid=False)
    a.put(6, 37, 'c', True); a.keep[37, 6] = True
    # carpets
    a.rect(20, 4, 8, 3, 'k', force=True)
    keep = [(6, 36), (6, 35), (23, 4), (24, 4), (23, 35), (24, 36), (7, 29), (41, 29), (34, 9), (34, 28), (13, 9), (34, 9), (8, 22), (40, 10), (23, 26), (21, 19), (13, 24)]
    keepcells(a, keep)
    a.spawns = {'service': dict(x=6, y=35, dir='n'), 'from2': dict(x=23, y=4, dir='s')}
    a.meta.update(name='消灯後の学院', region='r_star', zones=[], worldRect=[0, 0, 1, 1], look='int')
    return a


def star_academy_2():
    """消灯後の学院 2 階 (48 x 40): the stairs up from the hall arrive in the south middle; the long gallery (rows 29-31); the central
    corridor north to the vault; the archive stacks (west, rows of bookshelves); the headmaster's office (east, carpet, a desk);
    a lecture room (east, benches); the vault (north middle) behind its iron door."""
    a = Area('star_academy_2', 48, 40, 8202, base='~')
    a.rect(2, 2, 44, 36, 'X', force=True)
    _hall(a, 4, 29, 43, 31)                 # the gallery
    _hall(a, 21, 9, 26, 28)                 # the central corridor
    _hall(a, 21, 32, 26, 35)                # the stair landing
    _hall(a, 4, 4, 18, 26, 'u')             # the archive (west)
    for y in range(6, 26, 3):
        for x0 in (5, 12):
            a.rect(x0, y, 5, 1, 'r', force=True)
    a.mark('stacks', [(x, y) for y in range(6, 26, 3) for x0 in (5, 12) for x in range(x0, x0 + 5)], 'long rows of tall dark wooden BOOKSHELVES full of books and scrolls', WOOD)
    for y in (12, 22): a.put(19, y, 'c', True); a.put(20, y, 'c', True)          # archive <-> corridor
    for y in (27, 28): a.put(10, y, 'c', True)                                     # archive <-> gallery
    _hall(a, 30, 4, 43, 14, 'k')            # the headmaster's office (carpet)
    _hall(a, 30, 17, 43, 26, 'u')           # the lecture room
    for (x, y) in [(27, 10), (28, 10), (29, 10), (27, 22), (28, 22), (29, 22)]: a.put(x, y, 'c', True)
    a.mark('desk', [(36, 6), (37, 6), (38, 6)], "the headmaster's big writing DESK with a lamp, an astrolabe and piles of papers", WOOD)
    a.mark('globe', [(42, 5)], 'a big celestial GLOBE on a brass stand', BRASS)
    a.mark('shelf', [(31, 4), (32, 4), (33, 4)], 'a tall BOOKCASE', WOOD)
    for y in (19, 22, 25):
        a.rect(32, y, 10, 1, 'r', force=True)
    a.mark('benches', [(x, y) for y in (19, 22, 25) for x in range(32, 42)], 'long wooden BENCHES of a lecture room', WOOD)
    a.mark('lectern', [(36, 17)], 'a LECTERN facing the benches', WOOD)
    # the vault (north middle, x 21-26 rows 3-7) behind an iron door at (23-24, 8)
    _hall(a, 21, 3, 26, 7)
    a.mark('vaultdoor', [(23, 8), (24, 8)], 'a heavy IRON DOOR of the vault with a brass combination dial, set in a stone frame', (80, 80, 90), solid=False)
    a.put(23, 8, 'c', True); a.put(24, 8, 'c', True)
    a.mark('pedestal', [(23, 4), (24, 4)], 'a stone PEDESTAL with a glass case in the middle of the vault', (160, 160, 170))
    a.mark('cabinets', [(21, 3), (22, 3), (25, 3), (26, 3)], 'iron filing CABINETS and chests against the vault wall', (90, 90, 100))
    a.mark('stairs', [(23, 36), (24, 36)], 'a broad marble STAIRCASE going down (walkable)', (190, 186, 176), solid=False)
    a.rect(23, 36, 2, 1, 'c', force=True, keep=True)
    a.rect(20, 18, 8, 3, 'k', force=True)   # the corridor runner
    keep = [(23, 35), (24, 35), (23, 5), (24, 5), (23, 7), (24, 7), (23, 9), (24, 9), (36, 8), (37, 8), (31, 10), (6, 30), (42, 30), (23, 12), (23, 27), (11, 8), (35, 21)]
    keepcells(a, keep)
    a.spawns = {'up': dict(x=23, y=35, dir='n')}
    a.meta.update(name='消灯後の学院', region='r_star', zones=[], worldRect=[0, 0, 1, 1], look='int')
    return a


# ======================================================================== the tower of star reading
def star_tower_1():
    """星読みの塔 1 階 (52 x 46): a round tower. The door in the south; the outer ring hall inside the round outer wall; the inner round wall
    with two iron gates (west = open while the orrery rests, north = open when it is turned) round the great ORRERY in the middle
    (brass rings and spheres on a round dais); the north sanctum between the inner and the outer wall where the sentinel stands before
    the stairs up. The outer ring is closed by walls at the north-west and the north-east (the sanctum is reached from the inner ring)."""
    a = Area('star_tower_1', 52, 46, 8301, base='~')
    ys, xs = np.mgrid[0:a.H, 0:a.W] + 0.5
    cx, cy = 26.0, 23.0
    d = lambda rx, ry: np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
    outer = d(24.5, 22.0) <= 1.0
    a.mask_fill(outer, 'X', force=True)
    a.mask_fill(d(22.5, 20.2) <= 1.0, 'c', force=True)          # the floor inside the outer wall
    inner_w = (d(14.5, 13.0) <= 1.0) & (d(12.5, 11.2) > 1.0)
    a.mask_fill(inner_w, 'X', force=True)                        # the inner round wall
    a.mask_fill(d(6.0, 5.2) <= 1.0, 'X', force=True)             # the orrery's dais (solid)
    a.mark('orrery', [(x, y) for y in range(a.H) for x in range(a.W) if d(6.0, 5.2)[y, x] <= 1.0],
           'the great ORRERY: a round raised dais with huge interlocking brass rings, a golden sun sphere in the centre and silver planet spheres on arms', BRASS)
    a.marks[-1]['shape'] = 'round'
    # the north sanctum: the outer ring's north part walled off at the NW and NE (radial walls)
    for y in range(2, 12):
        for x in (16, 17, 34, 35):
            if a.g[y, x] == 'c': a.put(x, y, 'X', True)
    # the gates in the inner wall: west (x 11-13, rows 22-23) and north (x 25-26, rows 9-11)
    for x in range(10, 15):
        for y in (22, 23):
            if a.g[y, x] == 'X' and inner_w[y, x]: a.put(x, y, 'c', True); a.keep[y, x] = True
    for y in range(8, 13):
        for x in (25, 26):
            if a.g[y, x] == 'X' and inner_w[y, x]: a.put(x, y, 'c', True); a.keep[y, x] = True
    # the entrance (south) through the outer wall
    for y in range(41, 46):
        for x in (25, 26):
            a.put(x, y, 'c', True); a.keep[y, x] = True
    a.mark('entry', [(25, 45), (26, 45)], 'the arched tower DOOR (open), leading outside', DARK, solid=False)
    # the stairs up at the top of the sanctum
    a.rect(25, 2, 2, 1, 'c', force=True, keep=True)
    a.mark('stairs', [(25, 2), (26, 2)], 'a narrow stone STAIRCASE going up along the wall (walkable)', (190, 186, 176), solid=False)
    # pillars in the outer ring, bookshelves and star charts in the alcoves
    for ang in range(0, 360, 30):
        r = math.radians(ang)
        x, y = int(round(cx + 18.5 * math.cos(r))), int(round(cy + 16.6 * math.sin(r)))
        if a.g[y, x] == 'c' and not (22 <= x <= 29 and y > 30) and not (y < 14): a.put(x, y, 'X', True)
    keep = [(25, 44), (26, 44), (25, 43), (25, 3), (26, 3), (25, 5), (26, 7), (20, 30), (12, 30), (8, 22), (26, 17), (26, 30), (40, 30), (43, 22), (22, 5), (30, 5),
            (13, 22), (13, 23), (25, 10), (26, 10), (18, 15), (34, 15), (6, 16), (45, 16), (26, 36)]
    keepcells(a, keep)
    a.spawns = {'entrance': dict(x=25, y=43, dir='n'), 'from_top': dict(x=25, y=3, dir='s')}
    a.meta.update(name='星読みの塔', region='r_star', zones=[], worldRect=[0, 0, 1, 1], look='int')
    return a


def star_tower_top():
    """星読みの塔 頂 (40 x 34): the flat roof of the tower under the night sky: a round platform of pale marble inlaid with a great star map
    mosaic, ringed by a low parapet; the stairs come up in the south; a small landing (the spring) by the stairs; in the north a raised
    dais with a bronze STAR-READING LECTERN and a ring of brass sighting arms (where the names are read)."""
    a = Area('star_tower_top', 40, 34, 8302, base='~')
    ys, xs = np.mgrid[0:a.H, 0:a.W] + 0.5
    cx, cy = 20.0, 16.5
    d = lambda rx, ry: np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
    a.mask_fill(d(17.5, 14.5) <= 1.0, 'X', force=True)           # the parapet
    a.mask_fill(d(16.0, 13.2) <= 1.0, 'c', force=True)
    a.mask_fill(d(9.0, 7.0) <= 1.0, 'k', force=True)             # the star-map mosaic (walkable)
    a.mark('mosaic', [], '', (0, 0, 0)); a.marks.pop()
    a.mark('stairs', [(19, 27), (20, 27)], 'the top of a stone STAIRCASE coming up through the roof floor, an opening with steps going down (walkable)', (190, 186, 176), solid=False)
    a.mark('lectern', [(19, 4), (20, 4)], 'a bronze STAR-READING LECTERN on a raised round dais, brass sighting arms around it pointing at the sky', BRASS)
    for (x, y) in [(10, 8), (29, 8), (8, 20), (31, 20)]:
        a.mark('brazier%d' % x, [(x, y)], 'a tall bronze STAR BRAZIER (unlit) on a tripod', BRASS)
    keep = [(19, 26), (20, 26), (19, 5), (20, 5), (20, 6), (19, 16), (11, 23), (12, 23), (11, 24), (12, 24), (19, 12), (20, 12), (27, 23)]
    keepcells(a, keep)
    a.spawns = {'from1': dict(x=19, y=26, dir='n')}
    a.meta.update(name='星読みの塔', region='r_star', zones=[], worldRect=[0, 0, 1, 1], look='int')
    return a


MAPS = {k: v for k, v in globals().items() if k in ('orbis', 'star_academy_1', 'star_academy_2', 'star_tower_1', 'star_tower_top')}
