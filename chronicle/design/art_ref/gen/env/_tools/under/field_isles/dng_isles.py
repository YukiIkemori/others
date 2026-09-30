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
    """港町コーラル (48 x 64), re-measured on the painting coral/gen1.png (the painter moved the terraces and doors by 1-3 cells from the
    first guide, so the layout below follows the picture; the guide of the generation was the first version, kept in guide_48.png).
    Terraces (white retaining walls with planters) = 'X' (fit.py leaves 'X' and 'c' alone), gardens = grass for fit.py to settle.
    Top: the north bridge (x 21-24) and tier 1 (harbour master, house1). Tier 2: inn, tavern, house2, house3. Tier 3: item shop, weapon
    shop, the sailors' guild (house4 has no painted door: solid). Bottom: the quay (rows 44-50) with the shipyard shed (solid, the boat
    on its slip is scenery), the widows' wall on the lowest terrace face (x 27-37, row 42), the middle pier (the own ship) and the
    ferry's T-pier; two sunken masts in the water. Main stairs x 21-24 on every terrace, side stairs x 41-42 (tier 3 -> quay) and a small
    stair nook at x 11 (tier 2 -> an alley between the shops, a shell to find at its end)."""
    a = Area('coral', 48, 64, 6101, base='X')
    W, H = a.W, a.H
    a.rect(0, 51, W, H - 51, '~', force=True)
    # tier 1 (rows 3-9) gardens and the walk (rows 10-11)
    a.rect(2, 3, 44, 7, ',', force=True)
    a.rect(2, 10, 44, 2, 'c', force=True, keep=True)
    # tier 2 walk (rows 25-26), tier 3 walk (rows 38-39), the quay (rows 44-50)
    a.rect(2, 25, 44, 2, 'c', force=True, keep=True)
    a.rect(2, 38, 44, 2, 'c', force=True, keep=True)
    a.rect(13, 44, 33, 7, 'c', force=True, keep=True)
    # the main street and its stairs; the bridge
    a.rect(21, 0, 4, 51, 'c', force=True, keep=True)
    a.rect(21, 0, 4, 3, '=', force=True, keep=True)
    for y0, y1 in ((12, 15), (27, 29), (40, 43)):
        a.mark('stairs%d' % y0, [(x, y) for x in range(21, 25) for y in range(y0, y1 + 1)], 'white STONE STEPS', (214, 212, 204), solid=False)
    # side stairs (tier 3 -> quay) and the nook at x 11 (tier 2 -> the alley between the item and weapon shops)
    a.rect(41, 40, 2, 4, 'c', force=True, keep=True)
    a.rect(11, 27, 1, 7, 'c', force=True, keep=True)
    # buildings (door = the painted door; the cell below it is the walk)
    bld(a, 'coral_harbormaster', 5, 3, 8, 7, 4, "the harbour master's house")
    bld(a, 'coral_house1', 28, 4, 7, 6, 2, 'house1')
    bld(a, 'coral_inn', 3, 16, 9, 9, 5, 'the inn')
    bld(a, 'coral_tavern', 13, 16, 7, 9, 3, 'the tavern')
    bld(a, 'coral_house2', 28, 18, 7, 7, 2, 'house2')
    bld(a, 'coral_house3', 36, 17, 8, 8, 3, 'house3')
    bld(a, 'coral_items', 3, 30, 8, 8, 6, 'the item shop')
    bld(a, 'coral_arms', 12, 30, 8, 8, 3, 'the weapon shop')
    bld(a, 'coral_guild', 26, 29, 13, 10, 7, "the sailors' guild")
    a.rect(40, 32, 5, 6, 'X', force=True, keep=True)          # house4 (no door)
    # the painted pots, barrels, signs and racks in front of the tier-3 shops stand on the first walk row (38): solid
    for x in [1, 2, 3, 4, 5, 6, 7, 10, 12, 13, 17, 19] + list(range(25, 46)):
        if (x, 38) != (33, 38): a.put(x, 38, 'X', True); a.keep[38, x] = True
    # tier 1 garden scenery the painter put in (palms, the flag pole, barrels, the parasol, rocks)
    for (x, y) in [(3, 5), (3, 6), (3, 7), (13, 3), (13, 4), (13, 7), (14, 7), (13, 8), (14, 8), (15, 5), (16, 5), (16, 6), (17, 6), (17, 7), (18, 6),
                   (26, 5), (26, 6), (26, 7), (35, 5), (35, 6), (35, 7), (36, 6), (41, 3), (41, 4), (42, 3), (43, 6), (44, 6), (43, 7), (44, 7), (20, 8), (20, 9)]:
        a.put(x, y, 'T', True)
    # the widows' wall (examined from the quay)
    a.mark('widows', [(x, 43) for x in range(27, 38)], "the widows' wall", (206, 196, 176))
    # piers
    a.rect(18, 51, 2, 8, '=', force=True, keep=True)
    a.rect(36, 51, 2, 7, '=', force=True, keep=True)
    a.rect(32, 58, 10, 3, '=', force=True, keep=True)
    a.spawns = {'north': dict(x=22, y=1, dir='s'), 'warp': dict(x=23, y=46, dir='s'), 'ferry': dict(x=36, y=57, dir='n'),
                'ship': dict(x=19, y=56, dir='n'), 'harbor': dict(x=23, y=45, dir='s'), 'nook': dict(x=11, y=28, dir='s')}
    a.exits = [dict(x=21, y=0, w=4, h=1, to={'map': 'i_cliff', 'spawn': 'south'}, edge='n')]
    keep = [(18, 57), (19, 57), (36, 59), (37, 59), (32, 44), (11, 33), (14, 47), (40, 45), (30, 10)]
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='港町コーラル', region='r_isles', zones=[], worldRect=[590, 500, 48, 64], look='town')
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
    # (re-measured on the painting nerei/gen1.png) the path along the ridge (x 20) and the cape plaza (x 17-24, rows 3-7)
    a.rect(20, 5, 1, 39, ':', force=True, keep=True)
    a.rect(17, 3, 8, 5, 'c', force=True, keep=True)
    a.mark('capelamp', [(21, 2), (21, 3)], "the cape's stone LAMP HOUSING on a white pillar", STONE)
    bld(a, 'nerei_lampkeeper', 12, 8, 6, 5, 3, "the lamp-keeper's cottage")
    bld(a, 'nerei_marina', 22, 13, 6, 5, 3, "Marina's cottage")
    bld(a, 'nerei_store', 12, 19, 6, 5, 4, 'the general store')
    bld(a, 'nerei_house', 22, 25, 6, 5, 3, 'a fisher cottage')
    bld(a, 'nerei_inn', 11, 30, 7, 7, 3, 'the village inn')
    # the path to the night pier (rows 8-9) and the pier (x 29-33) with its T (x 34-35, rows 6-12)
    a.rect(21, 8, 8, 2, ':', force=True, keep=True)
    a.rect(29, 8, 5, 2, '=', force=True, keep=True)
    a.rect(34, 6, 2, 7, '=', force=True, keep=True)
    a.tidy()
    a.spawns = {'gate': dict(x=20, y=42, dir='n'), 'warp': dict(x=20, y=21, dir='s'), 'pier': dict(x=33, y=9, dir='e'), 'tip': dict(x=21, y=5, dir='n'),
                'pier_end': dict(x=34, y=11, dir='s')}
    a.exits = [dict(x=20, y=43, w=1, h=1, to={'map': 'i_cape', 'spawn': 'north'}, edge='s')]
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in [(35, 7), (34, 7), (22, 4), (20, 4), (21, 20), (23, 38), (18, 17), (26, 11)]]
    a.meta.update(name='岬の村ネレイ', region='r_isles', zones=[], worldRect=[676, 440, 40, 44], look='town')
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
    for x in range(22, 26):
        for y in (25, 26): a.put(x, y, 'k', True); a.keep[y, x] = True
        for y in (10, 11): a.put(x, y, 'k', True); a.keep[y, x] = True
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
    # the tide (re-measured on the painting: the passage x 22-25 crosses the channels at rows 25-26 (ford A) and 10-11 (ford B)).
    # The painting shows both fords dry; the closed layer (process.py) clones the channel water over the flooded one:
    # low tide (default) = ford B under water, high tide (isles_tide_high, the tide stone) = ford A under water
    a.meta['tilePatches'] = [{'cond': '!isles_tide_high', 'rect': [22, 10, 4, 2], 'rows': ['wwww', 'wwww']},
                             {'cond': 'isles_tide_high', 'rect': [30, 17, 2, 4], 'rows': ['ww', 'ww', 'ww', 'ww']}]
    # (ford A stays dry: the tide only trades ford B (north) against the way into the east grotto, so the entrance is never cut off)
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
