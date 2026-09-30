"""Layouts of the painted cavern town Dovan and the floors of the deep mine (same tools as the field areas: layout.json -> guide.py ->
mkjob -> gen.sh -> fit.py -> process.py (OUT=assets/env/mine/under) -> put_rows.py -> v2/src/maps/mine_painted_rows.js).
Buildings of the town go to meta.blds [{id, x, y, w, h, door: [x, y]}] (the map file makes building objects with those doors);
cells the map data uses (spawns, stairs, triggers, NPCs, chests) are listed in a.objects so fit.py keeps them.
Imported by areas_mine.py (MAPS)."""
import numpy as np
from lib import Area, fbm, rail

STONE = (150, 144, 136)
DARK = (40, 26, 16)
TIMBER = (140, 100, 62)
HOUSE = (128, 96, 70)


def door(a, x, y, ch='c'):
    a.mark('door', [(x, y)], 'a dark ENTRANCE', DARK, solid=False)
    a.put(x, y, ch, True); a.keep[y, x] = True


def bld(a, bid, x, y, w, h, dx, text, color=HOUSE):
    """a building block (solid) with its door in the bottom row at x + dx; the cell below the door stays walkable"""
    cells = [(i, j) for i in range(x, x + w) for j in range(y, y + h) if (i, j) != (x + dx, y + h - 1)]
    a.mark('b_' + bid, cells, text, color)
    door(a, x + dx, y + h - 1)
    if a.g[y + h, x + dx] not in ',;".:s_=cuk': a.put(x + dx, y + h, 'c', True)
    a.keep[y + h, x + dx] = True
    a.meta.setdefault('blds', []).append(dict(id=bid, x=x, y=y, w=w, h=h, door=[x + dx, y + h - 1]))


def keepcells(a, cells, ch='k'):
    for (x, y) in cells:
        if a.g[y, x] not in ',;".:s_=cuk': a.g[y, x] = ch
        a.keep[y, x] = True


# ======================================================================== the cavern town
def dovan():
    """鉱山都市ドヴァン (54 x 48): a mining town inside a huge cavern (WORLD §5.10). The tunnel from the surface gate comes in at the south
    edge. Upper tier (south, rows 36-46): the entrance street, the miners' guild office, the inn, the tavern. A rock face (rows 32-35)
    with a broad stone stair in the middle and the LIFT TOWER on the east. Middle tier (rows 18-31): the plaza, the item shop, a miner's
    house, the assembly hall, the cart station (the rails come down a ramp on the east). A rock face (rows 14-17) with a long ramp on the
    west. Lower tier (north, rows 3-13): the great FORGE of the smiths, the OATH STONE on its dais, the MINE MOUTH in the north wall (the
    rails run out of it), the old smiths' tunnel; an underground cistern in the north-east, a chasm along the east of the middle tier."""
    a = Area('dovan', 54, 48, 8101, base='R')
    W, H = a.W, a.H
    # ---- floors of the three tiers (earth), with natural rounded edges
    a.region([(5, 36.5), (14, 35.8), (26, 36.4), (40, 35.6), (49, 36.5), (49.5, 45), (40, 46), (30, 45.2), (22, 46), (12, 45.4), (4.5, 45)], 'k', rough=0.7, seed=1, force=True)
    a.region([(4, 18.5), (16, 18), (30, 18.6), (42, 17.8), (47, 18.5), (47.5, 31), (36, 31.6), (24, 31), (12, 31.6), (4.5, 31)], 'k', rough=0.7, seed=2, force=True)
    a.region([(3, 3.5), (16, 3), (30, 3.6), (43, 2.8), (50, 3.5), (50.5, 13.4), (38, 13.8), (24, 13.2), (12, 13.8), (3.5, 13.2)], 'k', rough=0.7, seed=3, force=True)
    # ---- the entrance tunnel (south edge) and the streets
    a.rect(25, 44, 4, 4, 'c', force=True, keep=True)
    a.rect(6, 42, 42, 2, 'c', force=True, keep=True)            # upper street
    a.rect(25, 29, 4, 13, 'c', force=True, keep=True)            # the broad stair to the middle tier
    a.mark('stair_u', [(x, y) for x in range(25, 29) for y in range(32, 36)], 'a broad flight of worn STONE STEPS cut into the rock face', (176, 166, 150), solid=False)
    a.rect(16, 24, 23, 6, 'c', force=True, keep=True)            # the plaza
    a.rect(6, 25, 10, 2, 'c', force=True, keep=True)             # the street to the item shop
    a.rect(11, 12, 3, 13, 'c', force=True, keep=True)            # the long ramp to the lower tier (west)
    a.mark('ramp', [(x, y) for x in range(11, 14) for y in range(13, 19)], 'a long sloping RAMP of stone slabs down the rock face', (176, 166, 150), solid=False)
    a.rect(6, 11, 42, 2, 'c', force=True, keep=True)             # lower street
    # ---- buildings
    bld(a, 'dovan_guild', 6, 36, 9, 6, 4, "the MINERS' GUILD OFFICE: a solid two-storey house of dark timber on a stone base, a big slate roof, a sign bracket with crossed picks")
    bld(a, 'dovan_inn', 16, 37, 7, 5, 3, 'the INN: a cosy timber house with a steep slate roof, a lantern bracket by the door')
    bld(a, 'dovan_tavern', 31, 36, 9, 6, 4, 'the TAVERN: a wide timber hall with a slate roof, barrels stacked by the wall')
    a.mark('house_u', [(x, y) for x in range(45, 49) for y in range(38, 42)], 'a small miners\' house of timber and stone with a slate roof', HOUSE)
    bld(a, 'dovan_items', 6, 19, 8, 6, 4, 'the ITEM SHOP: a timber house with a slate roof and a wide shop window')
    bld(a, 'dovan_house', 17, 19, 6, 5, 3, "a MINER'S HOUSE of timber and stone with a slate roof and a small chimney")
    bld(a, 'dovan_hall', 26, 17, 11, 7, 5, 'the ASSEMBLY HALL: a long stone hall with a steep timber roof and two chimneys, a wide double door')
    bld(a, 'dovan_forge', 5, 3, 12, 8, 6, "the GREAT FORGE of the smiths: a big open-fronted stone smithy under a heavy timber roof, a tall brick chimney, the red glow of a furnace mouth inside, anvils and a water trough in front")
    # ---- the lift tower on the east (spans the rock face between the upper and middle tiers)
    a.rect(41, 30, 6, 6, 'R', force=True)
    a.mark('lift', [(x, y) for x in range(43, 46) for y in range(29, 36)], 'the LIFT TOWER: a tall frame of heavy timbers against the rock face with a winch wheel on top and a wooden cage platform, ropes and a counterweight', TIMBER)
    a.rect(43, 36, 3, 1, '=', force=True, keep=True); a.rect(43, 28, 3, 1, '=', force=True, keep=True)
    # ---- the mine mouth (north wall), the rails down to the cart station
    a.mark('minemouth', [(x, y) for x in range(29, 34) for y in range(1, 3)], 'the MINE MOUTH: a great timbered portal in the rock wall, heavy beams and props, the rails run into the dark', DARK)
    door(a, 31, 3, 'k')
    a.rect(40, 13, 3, 6, 'k', force=True)                           # the rail cut down the rock face (a steep ramp beside the rails)
    a.mark('railcut', [(x, y) for x in range(40, 43) for y in range(14, 18)], 'a steep CUTTING through the rock face where the rails run down, shored with timber', (120, 100, 80), solid=False)
    rail(a, [(31.5, 3.2), (32.5, 7), (37, 10), (40.5, 12.6), (41.3, 17), (41, 22.5), (40.5, 26.6)], ground='k')
    a.mark('station', [(x, y) for x in range(40, 44) for y in (27,)], 'the CART STATION: a timber platform with a buffer stop at the end of the rails', TIMBER, solid=False)
    a.rect(40, 27, 4, 1, '=', force=True, keep=True)
    # ---- the oath stone and the smiths' tunnel
    a.rect(20, 5, 5, 4, 'c', force=True, keep=True)
    a.mark('oath', [(21, 5), (22, 5), (23, 5), (21, 6), (22, 6), (23, 6)], 'the OATH STONE: a tall slab of dark stone carved with an anvil, a hammer and lines of old letters (half of them worn away), on a low stepped dais', (96, 92, 100))
    a.rect(17, 1, 3, 2, 'R', force=True)
    a.mark('tunnel', [(17, 2), (18, 2), (19, 2)], 'a small old TUNNEL MOUTH in the rock wall, timber-framed, boarded up with planks', DARK)
    door(a, 18, 3, 'k')
    # ---- water: the cistern (north-east), the chasm (east of the middle tier)
    a.blob(46, 7, 3.2, 2.6, 'w', rough=0.25, seed=6, force=True)
    a.region([(48.5, 17), (54, 17), (54, 32), (49, 31.5), (48, 24)], 'l', rough=0.6, seed=7, force=True)
    # ---- ore heaps, crates (solid, along the walls)
    for (x, y) in [(36, 5), (37, 5), (9, 29), (10, 29), (46, 44), (4, 44)]:
        a.put(x, y, 'r', True); a.keep[y, x] = True
    # glowing ore veins in the rock (scenery only)
    a.mark('veins', [(2, 20), (51, 40), (2, 8), (52, 2)], 'veins of glowing pale-blue ORE CRYSTALS growing out of the rock', (120, 170, 210))
    a.tidy()
    a.spawns = {'gate': dict(x=26, y=46, dir='n'), 'warp': dict(x=27, y=27, dir='s'), 'mine': dict(x=31, y=4, dir='s'), 'tunnel': dict(x=18, y=4, dir='s'),
                'lift_u': dict(x=44, y=37, dir='s'), 'lift_m': dict(x=44, y=27, dir='n'), 'station': dict(x=39, y=27, dir='w'), 'oath': dict(x=22, y=9, dir='n')}
    a.exits = [dict(x=26, y=47, w=2, h=1, to={'map': 'g_valley', 'spawn': 'gate'}, edge='s')]
    keep = [(22, 8), (21, 9), (23, 9), (44, 37), (44, 27), (39, 27), (43, 37), (26, 27), (28, 27), (12, 11), (30, 4), (32, 4)]
    keepcells(a, keep, 'c')
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='鉱山都市ドヴァン', region='r_mine', zones=[], worldRect=[330, 60, 54, 48], look='town', smooth=0.6)
    return a


# ======================================================================== the deep mine
def cave(aid, W, H, seed):
    a = Area(aid, W, H, seed, base='R')
    S = lambda pts, w, ch='k', seed=0, wob=0.5: a.stroke(pts, w, ch, wobble=wob, seed=seed, keep=False, force=True)
    B = lambda cx, cy, rx, ry, ch='k', seed=0: a.blob(cx, cy, rx, ry, ch, rough=0.22, seed=seed, force=True)
    return a, S, B


def mine_1():
    """深き坑道 1 階 (54 x 44): the entrance hall (S, the rails come in from Dovan's mine mouth); the main gallery north with the rails to
    the junction (a rest nook with an old lamp); the west drift to the cave-in where miner 1 is pinned (and a crevice where a kitten
    mews); the ore-sorting room (N); east: the CART STATION at the edge of a deep shaft, the rails cross it on a narrow trestle (the cart
    rides over; too narrow to walk); beyond, the stairs down (NE); from the east side a steep one-way slope leads back down to the hall."""
    a, S, B = cave('mine_1', 54, 44, 8201)
    B(27, 37.5, 7.5, 4.0, seed=1); S([(26.5, 38), (26.5, 44.5)], 3.2, seed=2, wob=0.2)
    S([(27, 34), (27, 24)], 3.4, seed=3, wob=0.3)
    B(27, 20.5, 6.5, 4.2, seed=4)
    S([(21, 21), (14, 20), (8, 17), (6, 13)], 2.6, seed=5)
    B(6, 10.5, 3.6, 3.0, seed=6)
    B(12.5, 16.5, 1.4, 1.2, seed=7)                                   # the kitten's crevice nook
    S([(27, 16), (27, 12)], 2.8, seed=8, wob=0.3)
    B(27, 8.5, 6.5, 3.6, seed=9)
    S([(33, 21), (40, 21)], 3.0, seed=10, wob=0.3)
    B(40, 21, 2.6, 3.0, seed=11)
    # the shaft (not walkable) and the trestle over it
    a.region([(42.5, 8), (45.5, 8), (46, 32), (42, 32)], 'l', rough=0.5, seed=12, force=True)
    B(48.5, 21, 2.6, 3.0, seed=13)
    S([(48.5, 18), (48.5, 9), (47.5, 5)], 2.8, seed=14, wob=0.3)
    B(47.5, 4.5, 4.0, 2.6, seed=15)
    # the one-way slope back (east side -> hall): a long gallery down the south-east
    S([(48.5, 24), (49, 31), (44, 35.5), (35, 37.5)], 2.6, seed=16)
    # rails: from the entrance up the gallery to the junction, the branch to the station and across the trestle
    rail(a, [(26.5, 44.5), (26.6, 38), (27, 30), (27.2, 24), (29, 21.6), (35, 21.5), (47.5, 21.5)], ground='k')
    for x in range(42, 47): a.g[21, x] = 'l'
    a.mark('trestle', [(x, 21) for x in range(42, 47)], 'a narrow timber RAIL TRESTLE across the dark shaft: two rails on sleepers and a few beams, no planks to walk on', TIMBER)
    # rubble: the cave-in pinning miner 1 (west end), the ore room's heaps
    for (x, y) in [(4, 8), (3, 9), (5, 7), (8, 8)]: a.put(x, y, 'r', True)
    for (x, y) in [(22, 7), (32, 7), (23, 10)]: a.put(x, y, 'r', True)
    keep = [(26, 42), (27, 42), (6, 11), (6, 12), (12, 16), (12, 17), (27, 7), (30, 9), (40, 21), (41, 21), (48, 21), (47, 21), (47, 3), (47, 4),
            (22, 20), (23, 19), (48, 27), (36, 37), (20, 38), (33, 18), (49, 6)]
    keepcells(a, keep)
    a.scatter('r', 0.010, only='k', seed=41, clear=1)
    a.tidy()
    a.spawns = {'entrance': dict(x=26, y=42, dir='n'), 'from2': dict(x=47, y=5, dir='s'), 'cart_w': dict(x=40, y=21, dir='e'), 'cart_e': dict(x=48, y=21, dir='w')}
    a.exits = [dict(x=25, y=43, w=3, h=1, to={}, edge='s')]
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='深き坑道', region='r_mine', zones=[], worldRect=[0, 0, 1, 1], look='cave', smooth=0.6)
    return a


def mine_2():
    """深き坑道 2 階 (56 x 46): the stairs up (NE); the crossroads chamber; west, the flooded drift (a plank walkway between pools) where
    miner 2 waits; south, the old miners' REST PLACE (a bench, the shift board on the wall, the old lamp); east, the side tunnel
    where the rock-eater lies (Pip beyond it, in a small chamber); south-west, the gallery down to the stairs to the seventh layer."""
    a, S, B = cave('mine_2', 56, 46, 8302)
    B(48, 6, 4.2, 3.0, seed=1)
    S([(47, 8), (42, 13), (34, 17)], 3.0, seed=2)
    B(28, 19.5, 7.0, 4.6, seed=3)
    # the flooded drift (W)
    S([(21, 20), (6, 20.5)], 5.0, seed=4, wob=0.4)
    B(5, 20.5, 3.4, 3.2, seed=5)
    a.region([(8, 17.2), (20, 17.4), (20, 19.2), (8, 19)], 'w', rough=0.4, seed=6, force=True)
    a.region([(8, 22), (20, 21.8), (20, 23.8), (8, 24)], 'w', rough=0.4, seed=7, force=True)
    a.rect(8, 20, 13, 2, '=', force=True, keep=True)
    a.mark('walk', [(x, 20) for x in range(8, 21)], 'a WALKWAY of timber planks laid over the flooded floor', TIMBER, solid=False)
    # the rest place (S)
    S([(28, 24), (28, 30)], 3.0, seed=8, wob=0.3)
    B(28, 33.5, 6.2, 3.6, seed=9)
    a.mark('bench', [(24, 32), (25, 32)], 'a long rough timber BENCH against the rock', TIMBER)
    a.mark('board', [(31, 30)], 'a wooden SHIFT BOARD with rows of pegs nailed to a timber prop', TIMBER)
    a.blob(32.5, 35.5, 1.2, 0.9, 'w', rough=0.2, seed=10, force=True)
    # the side tunnel (E) and Pip's chamber
    S([(35, 20.5), (42, 21.5), (47, 25), (49, 30)], 2.6, seed=11)
    B(49.5, 33.5, 3.6, 3.0, seed=12)
    # the gallery down (SW) and the stairs chamber
    S([(22, 23), (16, 29), (11, 35)], 2.8, seed=13)
    B(9.5, 38.5, 4.2, 3.2, seed=14)
    for (x, y) in [(52, 32), (47, 35), (26, 17), (31, 16)]: a.put(x, y, 'r', True)
    keep = [(48, 5), (48, 7), (5, 20), (4, 20), (6, 20), (28, 32), (27, 32), (30, 31), (31, 31), (29, 35), (41, 21), (42, 21), (43, 22), (50, 33), (49, 34),
            (9, 41), (9, 39), (20, 16), (37, 18), (13, 37), (24, 35), (34, 33)]
    keepcells(a, keep)
    a.scatter('r', 0.010, only='k', seed=41, clear=1)
    a.tidy()
    a.spawns = {'up': dict(x=48, y=7, dir='s'), 'from3': dict(x=9, y=39, dir='n')}
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='深き坑道', region='r_mine', zones=[], worldRect=[0, 0, 1, 1], look='cave', smooth=0.6)
    return a


def mine_3():
    """七の層 (50 x 42): the stairs up (NW); a winding dark approach with side niches; the antechamber (the spring); in its north wall the
    great ROCK DOOR of the seventh layer (carved with an anvil and a hammer, sealed); beyond, the warden's hall: the IRON GUARDIAN seated
    on a dais, and behind it the BREACH: a hole broken through the floor where pale WHITE nothing shows instead of rock."""
    a, S, B = cave('mine_3', 50, 42, 8403)
    B(8, 4.5, 4.0, 2.6, seed=1)
    S([(8, 6), (8, 14), (5.5, 21), (9, 27), (15, 31), (21, 34)], 3.0, seed=2)
    B(3.5, 13.5, 1.8, 1.8, seed=3); S([(7, 13.5), (4, 13.5)], 2.0, seed=31)        # niche (chest)
    B(14, 22, 2.4, 2.0, seed=4); S([(7, 22), (13, 22)], 2.2, seed=5)                  # niche (the old lamp)
    B(27.5, 35, 7.0, 3.6, seed=6)                    # the antechamber
    a.rect(23, 31, 9, 2, 'k', force=True)
    # the rock door (rows 28-30) and the warden's hall (north)
    B(27.5, 17, 8.5, 7.0, seed=7)
    a.rect(24, 25, 8, 6, 'R', force=True)
    a.mark('rockdoor', [(x, y) for x in range(25, 31) for y in range(28, 31)], 'the great ROCK DOOR of the seventh layer: two huge slabs of dark stone carved with an anvil and a hammer, iron bands, sealed shut', (84, 80, 90))
    a.put(27, 30, 'k', True); a.keep[30, 27] = True
    a.put(27, 28, 'k', True); a.keep[28, 27] = True
    a.put(27, 29, 'R', True); a.keep[29, 27] = True
    for y in (22, 23, 24, 25, 26, 27):
        for x in (26, 27, 28): a.put(x, y, 'k', True); a.keep[y, x] = True
    a.mark('vestibule', [(x, y) for x in (26, 27, 28) for y in (25, 26, 27)], 'a short passage of worn stone slabs leading to the back of the rock door', (140, 130, 116), solid=False)
    a.mark('guardian', [(x, y) for x in range(25, 31) for y in range(12, 16)], 'the IRON GUARDIAN: a giant armoured figure of dark riveted iron, seated on a stone throne-dais with a great hammer across its knees, head bowed', (70, 72, 80))
    a.region([(22, 7), (33, 7), (32, 10.5), (23, 10.5)], 'l', rough=0.5, seed=8, force=True)
    a.mark('breach', [(x, y) for x in range(23, 32) for y in range(7, 11)], 'the BREACH: a jagged oval hole broken through the floor, and inside it no rock and no darkness, only a pale featureless WHITE (no bottom, no detail)', (236, 236, 240))
    a.marks[-1]['shape'] = 'round'
    for (x, y) in [(21, 21), (34, 21), (34, 13)]: a.put(x, y, 'r', True)
    keep = [(8, 3), (8, 5), (3, 13), (14, 22), (9, 26), (27, 30), (27, 28), (29, 34), (30, 34), (29, 35), (30, 35), (27, 32), (27, 31), (27, 26), (27, 25), (27, 17), (26, 17), (28, 17), (21, 17), (34, 17)]
    keepcells(a, keep)
    a.scatter('r', 0.008, only='k', seed=41, clear=1)
    a.tidy()
    a.spawns = {'up': dict(x=8, y=5, dir='s'), 'ante': dict(x=27, y=31, dir='s'), 'hall': dict(x=27, y=26, dir='n')}
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='深き坑道', region='r_mine', zones=[], worldRect=[0, 0, 1, 1], look='cave', smooth=0.6)
    return a


MAPS = {'dovan': dovan, 'mine_1': mine_1, 'mine_2': mine_2, 'mine_3': mine_3}
