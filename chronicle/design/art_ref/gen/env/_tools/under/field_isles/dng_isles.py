"""Layouts of the painted towns and dungeon floors of the Marea isles (same tools as the field areas: layout.json -> guide.py -> mkjob ->
gen.sh -> fit.py -> process.py (OUT=assets/env/isles/under) -> put_rows.py -> v2/src/maps/isles_painted_rows.js).
Buildings of the towns go to meta.blds [{id, x, y, w, h, door: [x, y]}] (the map files make building objects with those doors);
cells the map data uses (spawns, stairs, triggers, NPCs, chests) are listed in a.objects so fit.py keeps them.
Imported by areas_isles.py (MAPS)."""
import numpy as np
from lib import Area, fbm

WHITE = (236, 234, 226)
STONE = (170, 166, 156)
DARK = (40, 26, 16)
WOOD = (120, 84, 52)


def door(a, x, y, ch='c'):
    a.mark('door', [(x, y)], 'a dark ENTRANCE', DARK, solid=False)
    a.put(x, y, ch, True); a.keep[y, x] = True


def bld(a, bid, x, y, w, h, dx, text, color=WHITE):
    """a building block (solid) with its door in the bottom row at x + dx; the cell below the door stays walkable"""
    cells = [(i, j) for i in range(x, x + w) for j in range(y, y + h) if (i, j) != (x + dx, y + h - 1)]
    a.mark('b_' + bid, cells, text, color)
    door(a, x + dx, y + h - 1)
    if a.g[y + h, x + dx] not in ',;".:s_=cuk': a.put(x + dx, y + h, 'c', True)
    a.keep[y + h, x + dx] = True
    a.meta.setdefault('blds', []).append(dict(id=bid, x=x, y=y, w=w, h=h, door=[x + dx, y + h - 1]))


# ======================================================================== towns
def coral():
    """港町コーラル: white houses on terraces stacked up a sea cliff (WORLD §5.8). Top: the north gate (bridge to the cliff road), the harbour
    master's house, the lookout. Middle tiers: inn, tavern, houses; shops and the sailors' guild. Bottom: the quay with the shipyard and
    its slipway, the widows' wall on the terrace face, the own ship's pier and the ferry's T-pier; two masts of sunken warships in the
    harbour water."""
    a = Area('coral', 48, 64, 6101, base=',')
    W, H = a.W, a.H
    a.mask_fill(fbm(3, W, H, 7) > 0.62, ';', only=',')
    # the sea (S and the shipyard's inlet W)
    a.rect(0, 51, W, H - 51, '~', force=True)
    a.rect(0, 49, 13, 2, '~', force=True)
    # cliffs on the map edges, the north cliff with the gate gap
    a.rect(0, 0, W, 3, 'R', force=True); a.rect(0, 0, 2, 49, 'R', force=True); a.rect(46, 0, 2, 51, 'R', force=True)
    # terrace faces (white retaining walls) with stair gaps
    for (y, gaps) in [(14, [(22, 25)]), (27, [(11, 13), (22, 25)]), (40, [(22, 25), (41, 43)])]:
        for x in range(2, 46):
            if not any(g0 <= x <= g1 for g0, g1 in gaps):
                a.put(x, y, 'R', True); a.put(x, y + 1, 'R', True)
        for g0, g1 in gaps:
            a.rect(g0, y, g1 - g0 + 1, 2, 'c', force=True, keep=True)
            a.mark('stairs%d_%d' % (y, g0), [(x, yy) for x in range(g0, g1 + 1) for yy in (y, y + 1)], 'long flights of white STONE STEPS going down the terrace wall (walkable)', (214, 212, 204), solid=False)
    # the main street (N-S) and the terrace walks
    a.rect(22, 0, 4, 51, 'c', force=True, keep=True)
    a.rect(22, 0, 4, 3, '=', force=True, keep=True)
    for y0 in (10, 23, 36):
        a.rect(2, y0, 44, 3, 'c', force=True)
    # the quay
    a.rect(13, 42, 33, 9, 'c', force=True)
    a.rect(2, 42, 11, 7, 'c', force=True)
    # buildings
    bld(a, 'coral_harbormaster', 5, 4, 7, 6, 3, "a whitewashed HOUSE with a blue flat roof edge and a flagpole (the harbour master's house)")
    bld(a, 'coral_house1', 30, 5, 6, 5, 2, 'a small whitewashed HOUSE with a blue door and a flat roof')
    bld(a, 'coral_inn', 3, 16, 8, 7, 3, 'the INN: a long two-storey whitewashed house with blue shutters and a roof terrace')
    bld(a, 'coral_tavern', 13, 16, 8, 7, 3, 'the TAVERN: a whitewashed house with a big blue door, barrels by the wall, a hanging anchor emblem')
    bld(a, 'coral_house2', 29, 18, 6, 5, 2, 'a small whitewashed HOUSE with a blue flat roof edge')
    bld(a, 'coral_house3', 37, 17, 7, 6, 3, 'a whitewashed HOUSE with a little blue dome')
    bld(a, 'coral_items', 3, 30, 7, 6, 3, 'the ITEM SHOP: a whitewashed house with a striped blue awning')
    bld(a, 'coral_arms', 12, 30, 7, 6, 3, 'the WEAPON SHOP: a whitewashed house with a crossed-swords sign board and an iron-banded door')
    bld(a, 'coral_guild', 29, 29, 9, 7, 4, "the SAILORS' GUILD HALL: the biggest white building, a blue tiled roof, a signal mast with coloured flags on top")
    bld(a, 'coral_house4', 40, 31, 5, 5, 2, 'a small whitewashed HOUSE')
    bld(a, 'coral_shipyard', 2, 42, 10, 6, 5, "the SHIPYARD: a wide timber shed with a sloping roof open towards the sea, piles of planks, ropes, a half-built boat's ribs inside")
    # the slipway from the shipyard into the inlet (walkable planks)
    a.rect(4, 48, 4, 5, '=', force=True, keep=True)
    a.mark('slip', [(x, y) for x in range(4, 8) for y in range(48, 53)], 'a wooden SLIPWAY of greased planks and rails sloping from the shipyard down into the water (walkable)', (150, 104, 60), solid=False)
    # the widows' wall: names carved on the face of the lowest terrace
    a.mark('widows', [(x, 41) for x in range(28, 36)], "a long stretch of the white terrace wall covered in CARVED NAMES in neat rows, a few faded ribbons and dried flowers tucked into the joints (the widows' wall)", (206, 196, 176))
    # piers
    a.rect(18, 51, 2, 7, '=', force=True, keep=True)
    a.rect(36, 51, 2, 8, '=', force=True, keep=True)
    a.rect(32, 58, 10, 2, '=', force=True, keep=True)
    a.mark('pier', [(x, y) for x in (18, 19) for y in range(51, 58)] + [(x, y) for x in (36, 37) for y in range(51, 58)] + [(x, y) for x in range(32, 42) for y in (58, 59)],
           'wooden PIERS of weathered planks on posts running out over the water (walkable)', (150, 104, 60), solid=False)
    # masts of two sunken warships sticking out of the harbour water
    a.mark('masts', [(26, 56), (27, 60)], 'the top of a broken MAST of a sunken warship sticking out of the water, a torn yard and rotten rope on it', (80, 60, 44))
    # planters and trees on the terraces
    for (x, y) in [(15, 5), (40, 12), (44, 25), (26, 32), (20, 37), (44, 37)]:
        if a.g[y, x] in ',;': a.put(x, y, 'T')
    a.scatter('b', 0.02, only=',;', seed=41, clear=1)
    a.tidy()
    a.spawns = {'north': dict(x=23, y=1, dir='s'), 'warp': dict(x=24, y=24, dir='s'), 'ferry': dict(x=37, y=57, dir='n'),
                'ship': dict(x=19, y=56, dir='n'), 'harbor': dict(x=24, y=44, dir='s')}
    a.exits = [dict(x=22, y=0, w=4, h=1, to={'map': 'i_cliff', 'spawn': 'south'}, edge='n')]
    keep = [(18, 57), (19, 57), (36, 59), (37, 59), (31, 42), (34, 43), (9, 48), (40, 8), (42, 5)]
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='港町コーラル', region='r_isles', zones=[], worldRect=[600, 530, 48, 64], look='town')
    return a


def nerei():
    """岬の村ネレイ: a small fishing village on the thin ridge of a cape (WORLD §5.9): one row of whitewashed cottages either side of a
    path along the ridge, the sea on both sides; at the tip the lamp-keeper's house, the cape's stone lamp and the night pier."""
    a = Area('nerei', 40, 44, 6202, base='~')
    W, H = a.W, a.H
    land = a.region([(16, 44.5), (13, 36), (10, 28), (10, 18), (12, 9), (16, 3), (22, 2), (27, 5), (30, 14), (30, 26), (27, 36), (24, 44.5)], ',', rough=0.8, seed=1, force=True)
    a.mask_fill(fbm(3, W, H, 6) > 0.6, ';', only=',')
    from scipy import ndimage
    ring = land & ~ndimage.binary_erosion(land, iterations=1)
    a.mask_fill(ring, 'R')
    # sand coves on the shore
    for (x, y) in [(11, 26), (29, 22)]: a.blob(x, y, 1.6, 2.4, 's', rough=0.3, seed=x, force=True, only='R,;')
    # the path along the ridge and the village green
    a.rect(19, 5, 2, 39, ':', force=True, keep=True)
    a.blob(20, 5, 3.5, 2.2, 'c', rough=0.2, seed=5, force=True)
    a.mark('capelamp', [(20, 3)], "a stone LAMP HOUSING on a short white pillar at the very tip of the cape (the cape's lamp, unlit)", STONE)
    bld(a, 'nerei_lampkeeper', 12, 8, 6, 5, 3, "the LAMP-KEEPER'S cottage: a small round-ended whitewashed house with a blue door")
    bld(a, 'nerei_marina', 22, 13, 6, 5, 2, "Marina's COTTAGE: a small whitewashed cottage with blue shutters, fishing nets hung on the wall, a bench by the door")
    bld(a, 'nerei_house', 12, 19, 6, 5, 3, 'a small whitewashed fisher COTTAGE with drying nets')
    bld(a, 'nerei_store', 22, 25, 6, 5, 2, 'the GENERAL STORE: a whitewashed cottage with a striped awning')
    bld(a, 'nerei_inn', 11, 30, 7, 6, 3, 'the village INN: a long whitewashed house with a blue roof ridge')
    for (bx, by) in [(15, 12), (15, 23), (24, 17), (24, 29), (14, 35)]:
        a.stroke([(bx, by + 0.5), (19.5, by + 0.5)], 1.0, ':', seed=bx, force=True, keep=True)
    # the night pier on the east shore (planks out into the sea)
    a.rect(21, 8, 9, 2, ':', force=True, keep=True)
    a.rect(29, 8, 7, 2, '=', force=True, keep=True)
    a.rect(34, 6, 2, 6, '=', force=True, keep=True)
    a.mark('pier', [(x, y) for x in range(29, 36) for y in (8, 9)] + [(x, y) for x in (34, 35) for y in range(6, 12)], 'a long wooden PIER on posts out into the dark sea, a T at its end (walkable)', (150, 104, 60), solid=False)
    for (x, y) in [(14, 16), (25, 22), (25, 34), (15, 27)]:
        if a.g[y, x] in ',;': a.put(x, y, 'b')
    a.tidy()
    a.spawns = {'gate': dict(x=19, y=42, dir='n'), 'warp': dict(x=20, y=22, dir='s'), 'pier': dict(x=33, y=9, dir='e'), 'tip': dict(x=21, y=6, dir='n')}
    a.exits = [dict(x=19, y=43, w=2, h=1, to={'map': 'i_cape', 'spawn': 'north'}, edge='s')]
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in [(35, 8), (35, 9), (22, 4), (20, 4), (21, 21), (23, 38)]]
    a.meta.update(name='岬の村ネレイ', region='r_isles', zones=[], worldRect=[706, 440, 40, 44], look='town')
    return a


# ======================================================================== the sea cave
def isles_cave_1():
    """潮鳴りの洞窟 1 階: the entrance hall (S), a tidal channel across the passage north (ford A, open at low tide), the central grotto with
    the tide stone and a pool, a west grotto (the tide-pool spring, a chest), an east grotto (shells), a second channel (ford B, open at
    high tide) and the north passage to the steps down."""
    a = Area('isles_cave_1', 48, 40, 6301, base='R')
    S = lambda pts, w, ch='k', seed=0, wob=0.5: a.stroke(pts, w, ch, wobble=wob, seed=seed, keep=False, force=True)
    B = lambda cx, cy, rx, ry, ch='k', seed=0: a.blob(cx, cy, rx, ry, ch, rough=0.22, seed=seed, force=True)
    B(24, 33.5, 7.5, 4.0, seed=1); S([(24, 34), (24, 40.5)], 3.6, seed=2, wob=0.3)
    S([(24, 30), (24, 22)], 3.6, seed=3, wob=0.3)
    B(24, 18, 8.0, 5.0, seed=4)
    B(9, 17, 5.2, 4.4, seed=5); S([(17, 18), (12, 17.5)], 3.0, seed=6)
    B(39.5, 21, 5.0, 4.0, seed=7); S([(31, 19), (36, 20.5)], 3.0, seed=8)
    S([(24, 13), (24, 4)], 3.6, seed=9, wob=0.3); B(24, 4, 4.2, 2.4, seed=10)
    for (cx, cy, rx, ry, s_) in [(26, 34, 2.0, 1.2, 21), (12, 13, 1.6, 1.1, 22), (41, 24, 1.6, 1.0, 23)]: B(cx, cy, rx, ry, 's', s_)
    # water: the channels across the passages, pools
    S([(8, 26.5), (16, 26.2), (24, 26.6), (32, 26.2), (40, 26.8)], 2.2, 'w', seed=16, wob=0.4)
    S([(14, 11.2), (24, 10.8), (34, 11.3)], 2.2, 'w', seed=17, wob=0.4)
    B(27.5, 18.5, 2.6, 1.8, 'w', 18); B(40, 18.5, 1.8, 1.2, 'w', 19); B(20, 36, 1.4, 1.0, 'w', 24)
    # the fords (both painted as wet rock shelves; the flooded one gets the closed layer)
    for x in range(22, 27):
        for y in (25, 26, 27): a.put(x, y, 'k', True); a.keep[y, x] = True
        for y in (10, 11, 12): a.put(x, y, 'k', True); a.keep[y, x] = True
    a.mark('stone', [(20, 16)], 'a waist-high STANDING STONE carved with wave lines and a moon, crusted with barnacles (the tide stone)', (150, 150, 160))
    keep = [(23, 38), (24, 38), (24, 5), (24, 3), (20, 17), (8, 15), (6, 19), (42, 21), (38, 22), (30, 33), (18, 32), (11, 20), (44, 19)]
    for (x, y) in keep:
        if a.g[y, x] not in 'sk': a.g[y, x] = 'k'
        a.keep[y, x] = True
    a.scatter('r', 0.010, only='k', seed=41, clear=1)
    a.tidy()
    a.spawns = {'entrance': dict(x=24, y=37, dir='n'), 'up': dict(x=24, y=5, dir='s')}
    a.exits = [dict(x=22, y=39, w=4, h=1, to={}, edge='s')]
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='潮鳴りの洞窟', region='r_isles', zones=[], worldRect=[0, 0, 1, 1], look='cave')
    return a


def isles_cave_2():
    """潮鳴りの洞窟 2 階: the steps up (S); a great grotto around a deep sea pool; a ledge round the west side (the spring on it) to the
    octopus's chamber in the north; beyond it the rock shelf where the glowing shell lies; an east ledge with a chest."""
    a = Area('isles_cave_2', 44, 36, 6402, base='R')
    S = lambda pts, w, ch='k', seed=0, wob=0.5: a.stroke(pts, w, ch, wobble=wob, seed=seed, keep=False, force=True)
    B = lambda cx, cy, rx, ry, ch='k', seed=0: a.blob(cx, cy, rx, ry, ch, rough=0.22, seed=seed, force=True)
    B(22, 31, 5.0, 3.2, seed=1)
    B(22, 18, 15.5, 9.5, seed=2)
    B(22, 18.5, 10.5, 6.5, 'w', 3)
    B(22, 6.5, 7.0, 3.6, seed=4)
    B(22, 2.6, 3.4, 1.6, 's', seed=5)
    S([(22, 28), (22, 25)], 3.0, seed=6, wob=0.2)
    B(36, 26, 3.0, 2.0, 's', 7)
    for (cx, cy, rx, ry, s_) in [(10, 25, 1.4, 1.0, 21), (33, 11, 1.4, 1.0, 22)]: B(cx, cy, rx, ry, 'w', s_)
    keep = [(22, 33), (22, 31), (8, 15), (22, 3), (36, 26), (21, 9), (22, 9), (23, 9), (21, 10), (22, 10), (23, 10), (22, 6), (30, 27)]
    for (x, y) in keep:
        if a.g[y, x] not in 'sk': a.g[y, x] = 'k'
        a.keep[y, x] = True
    a.scatter('r', 0.010, only='k', seed=41, clear=1)
    a.tidy()
    a.spawns = {'up': dict(x=22, y=31, dir='n'), 'shelf': dict(x=22, y=4, dir='s')}
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='潮鳴りの洞窟', region='r_isles', zones=[], worldRect=[0, 0, 1, 1], look='cave')
    return a


# ======================================================================== the ghost ship
def ghost_ship_1():
    """幽霊船 甲板: the derelict ship lies in the fog, bow east; its deck with three broken masts, the raised stern deck (the captain's
    skylight), hatches; the own ship alongside on the south, a gangplank across."""
    a = Area('ghost_ship_1', 56, 30, 6501, base='~')
    ys, xs = np.mgrid[0:a.H, 0:a.W] + 0.5
    # the hull: a long rounded shape with a pointed bow (E) and a flat stern (W)
    t = (xs - 6) / 44.0
    half = np.where(t < 0.75, 8.0, 8.0 * np.sqrt(np.clip((1.0 - t) / 0.25, 0, 1)))
    hull = (xs >= 6) & (t <= 1.0) & (np.abs(ys - 15) <= half)
    a.mask_fill(hull, 'u', force=True)
    from scipy import ndimage
    edge = hull & ~ndimage.binary_erosion(hull, iterations=1)
    a.mask_fill(edge, 'X', force=True)
    for (x, y) in [(18, 15), (30, 15), (41, 15)]:
        a.mark('mast%d' % x, [(x, y), (x + 1, y)], 'the stump of a broken MAST wrapped in rotten rigging and torn grey sails', (70, 50, 38))
    a.mark('skylight', [(10, 14), (11, 14), (10, 15), (11, 15)], "the captain's cabin SKYLIGHT of cracked glass panes in a wooden frame on the stern deck", (90, 110, 120))
    a.mark('hatch', [(24, 11), (25, 11)], 'an open square HATCH in the deck with a ladder going down into darkness', DARK, solid=False)
    # the gangplank to the own ship (S)
    for y in range(22, 26):
        a.put(28, y, '=', True); a.put(29, y, '=', True); a.keep[y, 28] = a.keep[y, 29] = True
    a.mark('plank', [(x, y) for x in (28, 29) for y in range(22, 26)], 'a wide wooden GANGPLANK laid from the rail across the gap to a boat below (walkable)', (150, 104, 60), solid=False)
    keep = [(28, 21), (24, 12), (25, 12), (36, 18), (14, 11), (46, 15), (20, 19)]
    for (x, y) in keep: a.keep[y, x] = True
    a.spawns = {'board': dict(x=28, y=21, dir='n'), 'up': dict(x=24, y=12, dir='s')}
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='幽霊船', region='r_isles', zones=[], worldRect=[0, 0, 1, 1], look='ship')
    return a


def ghost_ship_2():
    """幽霊船 船室: the lower deck: a long corridor from the ladder (W) to the steps down (E), the crew's cabins north and south of it (hammocks,
    sea chests), the galley with the water barrels, a flooded corner."""
    a = Area('ghost_ship_2', 48, 28, 6602, base='R')
    ys, xs = np.mgrid[0:a.H, 0:a.W] + 0.5
    hull = (np.abs(ys - 14) <= 11.5 - np.clip(xs - 38, 0, 99) * 0.9) & (xs > 2) & (xs < 46)
    a.mask_fill(hull, 'X', force=True)
    inner = hull & (np.abs(ys - 14) <= 10.2 - np.clip(xs - 38, 0, 99) * 0.9) & (xs > 3.5) & (xs < 44.5)
    a.mask_fill(inner, 'u', force=True)
    # the corridor walls with cabin doors
    rooms_n = [(5, 12), (13, 20), (21, 28), (29, 36)]
    rooms_s = [(5, 12), (13, 20), (21, 28), (29, 36)]
    for x in range(4, 40):
        a.put(x, 11, 'X', True); a.put(x, 16, 'X', True)
    for (x0, x1) in rooms_n:
        for y in range(3, 11): a.put(x1, y, 'X', True)
        a.put((x0 + x1) // 2, 11, 'u', True); a.keep[11, (x0 + x1) // 2] = True
    for (x0, x1) in rooms_s:
        for y in range(17, 26): a.put(x1, y, 'X', True)
        a.put((x0 + x1) // 2, 16, 'u', True); a.keep[16, (x0 + x1) // 2] = True
    a.mark('cabinwalls', [], '', (0, 0, 0))
    a.marks.pop()
    a.blob(33, 21, 2.4, 1.6, 'w', rough=0.2, seed=3, only='u')
    a.mark('hatch', [(5, 13)], 'a LADDER going up through a square hole in the ceiling', DARK, solid=False)
    a.mark('down', [(41, 13), (41, 14)], 'narrow wooden STEPS going down into the dark hold', DARK, solid=False)
    keep = [(6, 13), (40, 13), (40, 14), (8, 6), (16, 5), (24, 7), (32, 5), (8, 21), (17, 22), (25, 21), (31, 20), (10, 8), (26, 9), (18, 20)]
    for (x, y) in keep:
        if a.g[y, x] != 'u': a.put(x, y, 'u', True)
        a.keep[y, x] = True
    a.spawns = {'up': dict(x=6, y=13, dir='e'), 'down': dict(x=40, y=13, dir='w')}
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='幽霊船', region='r_isles', zones=[], worldRect=[0, 0, 1, 1], look='ship')
    return a


def ghost_ship_3():
    """幽霊船 船倉と船長室: the dark hold full of broken cargo, sea water flooding in through the holed hull, the steps up (E); at the stern (W)
    the captain's cabin behind a bulkhead: a faded carpet, the chart table with the log, the stern windows."""
    a = Area('ghost_ship_3', 52, 30, 6703, base='R')
    ys, xs = np.mgrid[0:a.H, 0:a.W] + 0.5
    hull = (np.abs(ys - 15) <= 12.5 - np.clip(xs - 42, 0, 99) * 1.0) & (xs > 1) & (xs < 51)
    a.mask_fill(hull, 'X', force=True)
    inner = (np.abs(ys - 15) <= 11.2 - np.clip(xs - 42, 0, 99) * 1.0) & (xs > 2.5) & (xs < 49.5)
    a.mask_fill(inner, 'u', force=True)
    # the bulkhead between the hold and the captain's cabin (door at 14, 15)
    for y in range(3, 28): a.put(14, y, 'X', True)
    a.put(14, 15, 'u', True); a.keep[15, 14] = True
    a.rect(4, 10, 8, 10, 'c', force=True)
    a.mark('table', [(6, 13), (7, 13), (8, 13)], "the captain's CHART TABLE of dark wood with an open logbook, a brass compass and rolled charts on it", (96, 64, 40))
    a.mark('windows', [(x, 4) for x in range(5, 11)], "the STERN WINDOWS of the captain's cabin: small leaded panes, cracked, pale light behind them", (150, 170, 180))
    # cargo in the hold (stacks), flooding
    for (x, y, w, h) in [(18, 5, 3, 2), (26, 5, 4, 2), (34, 6, 3, 2), (18, 23, 4, 2), (29, 22, 3, 3), (39, 21, 3, 2), (22, 13, 2, 2), (33, 14, 2, 3)]:
        a.rect(x, y, w, h, 'r', force=True)
    a.blob(28, 18, 3.2, 1.8, 'w', rough=0.25, seed=5, only='u')
    a.blob(40, 9, 2.4, 1.4, 'w', rough=0.25, seed=6, only='u')
    a.mark('crates', [], '', (0, 0, 0)); a.marks.pop()
    a.mark('up', [(47, 14), (47, 15)], 'narrow wooden STEPS going up', DARK, solid=False)
    keep = [(46, 15), (18, 15), (17, 15), (15, 15), (13, 15), (7, 15), (7, 14), (44, 8), (24, 20), (11, 18), (5, 11)]
    for (x, y) in keep:
        if a.g[y, x] not in 'uc': a.put(x, y, 'u', True)
        a.keep[y, x] = True
    a.spawns = {'up': dict(x=46, y=15, dir='w')}
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='幽霊船', region='r_isles', zones=[], worldRect=[0, 0, 1, 1], look='ship')
    return a


MAPS = {k: v for k, v in globals().items() if k in ('coral', 'nerei', 'isles_cave_1', 'isles_cave_2', 'ghost_ship_1', 'ghost_ship_2', 'ghost_ship_3')}
