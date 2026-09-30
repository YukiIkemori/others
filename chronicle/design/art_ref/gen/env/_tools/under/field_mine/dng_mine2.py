"""(2026-09-30) Layouts of the two optional places of the Gard mountains (WORLD_REDESIGN §2.7 #16・#17, §5.14):
  volk     鍛冶衆の隠れ村ヴォルク (32 x 28): the bottom of a gorge below the ore valley, a cluster of smithies beside a waterfall
  vein_1   深淵の鉱脈 1 階 (44 x 36): crystal galleries under the seventh layer, a cart line over a chasm (the cart rides, one way)
  vein_2   深淵の鉱脈 2 階 (44 x 36): an underground lake with crystal islands and plank walks, the gem hedgehogs' grotto
  vein_3   深淵の鉱脈 3 階 (36 x 30): the heart of the vein, a great hall walled with glowing crystal (the vein lord)
Same tools as dng_mine.py (layout.json -> guide.py -> mkjob -> gen.sh -> fit.py -> process.py -> put_rows.py).
Imported by areas_mine.py (MAPS2)."""
from lib import Area, rail
from dng_mine import bld, door, keepcells, dress, cave, TIMBER, DARK, CRYSTAL

STONE = (150, 144, 136)


def volk():
    """the gorge floor: cliffs all round; the WATERFALL pours from the north-east cliff into a pool, the stream runs south-west and out
    under the south cliff; the OLD ROPE BRIDGE comes in over the stream gorge at the south (from the ore valley); a steep stone STAIR
    cut into the north-west cliff (the smiths' path up to Dovan, opened by the oath); smithies round a small cobbled work yard."""
    a = Area('volk', 32, 28, 9101, base='R')
    a.region([(2.5, 4), (12, 3.2), (20, 4.2), (27, 5.5), (29.5, 12), (29, 21), (24, 25.5), (14, 26), (4, 25), (2.2, 15)], ',', rough=0.6, seed=1, force=True)
    # the waterfall (north-east cliff) and its pool, the stream to the south-west
    a.mark('fall', [(x, y) for x in range(22, 26) for y in range(0, 4)], 'a tall WATERFALL pouring down the sheer north cliff in white ribbons of spray into the pool below', (200, 225, 240))
    a.blob(24, 6.2, 3.4, 2.2, 'w', rough=0.25, seed=2, force=True)
    st = a.stroke([(23.5, 7), (21.5, 11), (22, 16), (19, 21), (15.5, 24.5), (13.5, 27.5)], 2.2, 'w', seed=3, wobble=0.3)
    # the rope bridge over the stream gorge at the south edge, and the road into the village
    a.rect(12, 24, 1, 4, 'R', force=True); a.rect(16, 24, 16, 4, 'R', force=True)
    a.stroke([(8, 27.6), (9, 24), (10, 21), (13, 18)], 2.0, '.', seed=4)
    a.rect(8, 25, 3, 3, '=', force=True, keep=True)
    a.mark('ropebridge', [(x, y) for x in range(8, 11) for y in range(25, 28)], 'an OLD ROPE BRIDGE: weathered planks slung on thick ropes between timber posts, spanning a dark gorge (walkable deck)', TIMBER, solid=False)
    for (x, y) in [(7, 25), (7, 26), (7, 27), (11, 25), (11, 26), (11, 27)]: a.put(x, y, 'R', True)
    # the work yard (cobbles) and the lanes
    a.rect(11, 14, 10, 4, 'c', force=True, keep=True)
    a.stroke([(13, 18), (12.5, 14)], 1.6, '.', seed=5)
    a.stroke([(20, 15.5), (22, 15.5)], 1.2, '=', seed=6)                      # the plank bridge over the stream to the east bank
    a.stroke([(22, 15.5), (26, 13.5)], 1.6, '.', seed=7)
    a.stroke([(11, 15), (6, 13), (5, 6)], 1.6, '.', seed=8)
    # buildings
    bld(a, 'volk_inn', 3, 7, 7, 5, 3, "the INN of the smiths' village: a sturdy timber lodge on a stone base with a mossy slate roof and a smoking chimney")
    bld(a, 'volk_forge', 12, 7, 8, 6, 4, "the GREAT SMITHY: a long open-fronted stone forge with a tall brick chimney, the red mouth of a big furnace, anvils under the eaves")
    a.mark('wheel', [(20, 9), (20, 10), (20, 11)], 'a big wooden WATER WHEEL turning in the stream beside the smithy, driving its bellows', TIMBER)
    bld(a, 'volk_house', 3, 17, 5, 4, 2, "a small smith's cottage of fieldstone and timber with a slate roof")
    bld(a, 'volk_elder', 23, 16, 5, 4, 2, "the old master smith's cottage of dark stone with a slate roof, a grinding wheel by the door")
    a.mark('shrine', [(26, 11), (27, 11)], "a small SHRINE OF THE SMITH-GOD: a squat stone statue with a hammer on a stone step, offerings of iron nails", (120, 116, 124))
    a.mark('yardanvil', [(15, 16)], 'a big iron ANVIL on a tree stump in the work yard', (90, 90, 96))
    # the smiths' stair up the north-west cliff (to Dovan)
    a.rect(4, 3, 2, 3, 'c', force=True, keep=True)
    a.mark('stair', [(4, 1), (5, 1), (4, 2), (5, 2)], "a steep flight of STONE STEPS cut into the cliff, climbing up into a dark cleft", (176, 166, 150))
    # rocks, firs
    for (x, y, rx, ry, s_) in [(27, 22, 1.8, 1.4, 11), (6, 23, 1.6, 1.2, 12), (28, 7, 1.2, 1.2, 13)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',')
    for (x, y) in [(9, 13), (26, 19), (18, 21), (3, 13)]: a.put(x, y, 'r', True)
    keep = [(9, 24), (9, 26), (4, 4), (4, 5), (15, 17), (14, 15), (17, 15), (26, 12), (27, 12), (24, 13), (12, 20), (8, 16), (19, 18), (22, 20), (6, 12)]
    keepcells(a, keep, ',')
    a.tidy()
    a.spawns = {'bridge': dict(x=9, y=26, dir='n'), 'stair': dict(x=4, y=4, dir='s'), 'warp': dict(x=15, y=18, dir='n')}
    a.exits = [dict(x=8, y=27, w=3, h=1, to={'map': 'g_valley', 'spawn': 'volk'}, edge='s')]
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='鍛冶衆の隠れ村ヴォルク', region='r_mine', zones=[], worldRect=[0, 0, 1, 1], look='village', smooth=0.6)
    return a


def vein_1():
    """深淵の鉱脈 1 階 (44 x 36): stairs up from the seventh layer (NW); galleries through rock streaked with glowing crystal veins; a
    crystal cavern (middle); the CART LINE: a station on the west rim of a wide chasm, the rails cross it on a trestle (the cart rides,
    too narrow to walk); east of the chasm a gallery south to the stairs down (SE); a side grotto with a chest (NE)."""
    a, S, B = cave('vein_1', 44, 36, 9201)
    B(6, 4.5, 3.6, 2.6, seed=1)
    S([(6, 6), (7, 12), (12, 16)], 2.8, seed=2)
    B(16, 17, 6.2, 4.6, seed=3)                                  # the crystal cavern
    S([(12, 21), (8, 26), (9, 31)], 2.6, seed=4); B(9, 31.5, 3.4, 2.4, seed=5)       # SW niche (chest)
    S([(21, 17), (25, 17)], 3.0, seed=6, wob=0.2)
    B(25.5, 17, 2.4, 3.0, seed=7)                                # the cart station (west rim)
    a.region([(28, 3), (32, 3), (32.5, 33), (27.5, 33)], 'l', rough=0.6, seed=8, force=True)
    B(35, 17, 2.8, 3.0, seed=9)                                  # east rim
    S([(35, 14), (36, 8), (38, 5)], 2.6, seed=10); B(38.5, 4.5, 3.0, 2.2, seed=11)   # NE grotto
    S([(35, 20), (36, 26), (38, 30)], 2.8, seed=12); B(38, 31, 3.6, 2.6, seed=13)    # stairs down (SE)
    rail(a, [(24.5, 17.5), (36, 17.5)], ground='k')
    for x in range(28, 33): a.g[17, x] = 'l'
    a.mark('trestle', [(x, 17) for x in range(28, 33)], 'a narrow timber RAIL TRESTLE across the glowing chasm: two rails on sleepers, no planks to walk on', TIMBER)
    dress(a, crystals=[(2, 4), (10, 3), (4, 10), (11, 12), (20, 12), (22, 21), (12, 22), (5, 27), (13, 32), (24, 13), (37, 13), (40, 8), (41, 4), (33, 24), (41, 28), (35, 34)],
          frames=[(9, 7), (21, 15), (21, 19), (34, 21)], junk=[(18, 21)])
    a.mark('chasmglow', [(29, 8), (30, 25)], 'deep in the chasm, far below, a faint glow of crystal', CRYSTAL, solid=False)
    keep = [(6, 4), (6, 5), (9, 32), (25, 17), (26, 17), (35, 17), (34, 17), (38, 4), (38, 31), (38, 30), (16, 17), (14, 19), (19, 15), (26, 19), (36, 25)]
    keepcells(a, keep)
    a.scatter('r', 0.008, only='k', seed=41, clear=1)
    a.tidy()
    a.spawns = {'up': dict(x=6, y=5, dir='s'), 'from2': dict(x=38, y=30, dir='n'), 'cart_w': dict(x=26, y=17, dir='e'), 'cart_e': dict(x=34, y=17, dir='w')}
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='深淵の鉱脈', region='r_mine', zones=[], worldRect=[0, 0, 1, 1], look='cave', smooth=0.6)
    return a


def vein_2():
    """深淵の鉱脈 2 階 (44 x 36): stairs up (NE); a still UNDERGROUND LAKE fills the middle, crossed by plank walks between crystal islands;
    west, the GEM HEDGEHOGS' GROTTO (a low cave full of small glittering crystals); south, the rest nook with the spring; stairs down (SW)."""
    a, S, B = cave('vein_2', 44, 36, 9302)
    B(38, 4.5, 3.6, 2.6, seed=1)
    S([(37, 7), (33, 11), (30, 13)], 2.8, seed=2)
    a.region([(10, 11), (30, 10), (33, 17), (30, 25), (12, 25), (8, 18)], 'k', rough=0.8, seed=3, force=True)   # the lake cavern
    a.region([(12.5, 13), (28, 12.5), (30, 18), (27.5, 22.5), (13.5, 23), (11, 18)], 'w', rough=0.7, seed=4, force=True)
    B(20, 17.5, 2.2, 1.6, 'k', seed=5)                                # the crystal island
    a.rect(13, 17, 7, 1, '=', force=True, keep=True); a.rect(22, 17, 7, 1, '=', force=True, keep=True)
    a.rect(20, 12, 1, 5, '=', force=True, keep=True)
    a.mark('walk', [(x, 17) for x in list(range(13, 20)) + list(range(22, 29))] + [(20, y) for y in range(12, 17)], 'a WALKWAY of old timber planks on posts over the dark still water', TIMBER, solid=False)
    a.mark('isle', [(20, 18), (21, 18)], 'on the islet: a tall cluster of big glowing pale-blue CRYSTALS', CRYSTAL)
    # the hedgehogs' grotto (W)
    S([(10, 17), (5, 17)], 2.6, seed=6); B(4.5, 13, 3.0, 4.2, seed=7)
    # the rest nook with the spring (S) and the stairs down (SW)
    S([(20, 25), (20, 29)], 2.6, seed=8); B(21, 31, 4.2, 2.6, seed=9)
    S([(14, 24), (8, 29), (6, 31)], 2.6, seed=10); B(5.5, 31.5, 3.0, 2.4, seed=11)
    S([(31, 22), (37, 27)], 2.4, seed=12); B(38, 28.5, 3.0, 2.6, seed=13)       # SE niche (chest)
    dress(a, crystals=[(2, 9), (2, 16), (7, 9), (7, 18), (4, 20), (15, 9), (26, 9), (33, 14), (32, 22), (41, 3), (17, 30), (25, 33), (2, 31), (41, 29), (10, 27)],
          frames=[(35, 9), (19, 27), (12, 26)], tools=[(24, 31)])
    keep = [(38, 4), (38, 5), (5, 12), (4, 14), (3, 16), (21, 31), (22, 31), (20, 30), (5, 32), (6, 31), (38, 28), (20, 17), (21, 17), (12, 17), (29, 17), (20, 11), (30, 13)]
    keepcells(a, keep)
    a.scatter('r', 0.008, only='k', seed=41, clear=1)
    a.tidy()
    a.spawns = {'up': dict(x=38, y=5, dir='s'), 'from3': dict(x=6, y=31, dir='n')}
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='深淵の鉱脈', region='r_mine', zones=[], worldRect=[0, 0, 1, 1], look='cave', smooth=0.6)
    return a


def vein_3():
    """深淵の鉱脈 3 階 (36 x 30): stairs up (S); a short gallery north into THE HEART OF THE VEIN: a great round hall whose north wall is
    one huge seam of glowing crystal (where the vein lord waits); crystal pillars; a treasure niche behind (NE)."""
    a, S, B = cave('vein_3', 36, 30, 9403)
    B(18, 26, 3.4, 2.2, seed=1)
    S([(18, 25), (18, 20)], 2.8, seed=2, wob=0.2)
    B(18, 12.5, 9.5, 7.0, seed=3)
    a.mark('seam', [(x, y) for x in range(12, 25) for y in (3, 4)], 'the HEART OF THE VEIN: one huge seam of big glowing pale-blue and violet CRYSTALS filling the north wall of the hall', CRYSTAL)
    for (x, y) in [(11, 9), (25, 9), (12, 16), (24, 16)]:
        a.put(x, y, 'X', True); a.keep[y, x] = True
    a.mark('pillar', [(11, 9), (25, 9), (12, 16), (24, 16)], 'a tall PILLAR of glowing pale-blue crystal', CRYSTAL)
    S([(26, 8), (31, 6)], 2.2, seed=4); B(31.5, 5.5, 2.2, 1.8, seed=5)       # NE treasure niche
    dress(a, crystals=[(8, 12), (9, 17), (28, 12), (27, 17), (15, 22), (21, 22), (14, 27), (22, 27), (33, 4)], frames=[(16, 21)])
    keep = [(18, 27), (18, 26), (18, 10), (17, 10), (19, 10), (31, 5), (18, 19), (14, 13), (22, 13)]
    keepcells(a, keep)
    a.tidy()
    a.spawns = {'up': dict(x=18, y=26, dir='n')}
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta.update(name='深淵の鉱脈', region='r_mine', zones=[], worldRect=[0, 0, 1, 1], look='cave', smooth=0.6)
    return a


MAPS2 = {'volk': volk, 'vein_1': vein_1, 'vein_2': vein_2, 'vein_3': vein_3}
