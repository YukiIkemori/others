"""Layouts of the painted FIELD areas of the demo (area-switching field, owner 2026-09-28: each area is one painting).
usage: python3 areas.py <id> [...]   -> <id>/layout.json + ascii on stdout (then guide.py <id>)
Every area is a rectangle with its own character and shape; exits sit on the roads at the edges (lib.Area.exit).
Map ids: f_roa f_cape f_lookout f_cross f_hut f_fern f_south f_windhill (v2/src/maps/field_*.js)."""
import sys, math
import numpy as np
from lib import Area, fbm, WALK

STONE = (226, 222, 204)    # standing stones / pale stone landmarks
WOOD = (170, 92, 40)       # timber structures
ROOF = (170, 60, 50)       # small roofs (shrines)
WELL = (120, 120, 132)


def f_roa():
    """ロアの丘: rolling sheep hills east of Roa. Roa's gate (W), the fork with the travellers' old well, a ring of standing stones on a
    knoll (NW), a wayside shrine and the road lamp on the Pharos road, a walled sheep pasture (SW), a pond, a creek from north to south
    crossed by an arched stone bridge, a rocky ridge beyond the creek (NE) hiding a small nook. Roads: N -> f_lookout, E -> f_cape."""
    a = Area('f_roa', 52, 40, 11)
    W, H = a.W, a.H
    n = fbm(3, W, H, 7)
    a.mask_fill(n > 0.60, ';')
    a.mask_fill(fbm(9, W, H, 5) > 0.72, '"', only=',;')
    # woods: west belt (Roa's woods), the north-west, the south edge
    a.region([(-2, -2), (23, -2), (20, 2), (9, 4), (5, 9), (5, 30), (3, 42), (-2, 42)], 'F', rough=1.6, seed=1)
    a.region([(-2, 36), (30, 37.5), (52, 36), (54, 42), (-2, 42)], 'F', rough=1.4, seed=2)
    # creek (north -> south), the arched stone bridge where the Pharos road crosses
    # the rocky ridge beyond the creek (NE): high rough ground, a south-facing cliff, the nook in front of it
    a.region([(44, -2), (54, -2), (54, 9), (49, 8.5), (45, 7), (43.5, 3)], 'r', rough=1.0, seed=5)
    a.stroke([(44.5, 6.5), (47, 8.2), (51.5, 9)], 1.6, 'R', keep=False)
    # roads (packed earth): from Roa's gate to the fork; north to the lookout; east over the bridge to the cape
    a.stroke([(-1, 19.5), (6, 19.5), (12, 20.0), (17, 19.2), (20.5, 18.3)], 2.0, '.', wobble=0.25, seed=6)
    a.stroke([(20.5, 18.3), (22.5, 14), (25.5, 9.5), (29.5, 5.5), (31.5, 1.5), (31.5, -1)], 2.0, '.', wobble=0.3, seed=7)
    a.stroke([(20.5, 18.3), (25, 20.8), (31, 23.8), (35, 26.2), (37.5, 27.0), (42.5, 27.0), (46, 28.6), (49, 29.6), (52.5, 29.6)], 2.0, '.', wobble=0.0, seed=8)
    # the creek (north -> south) goes over everything; where it meets the road = the arched stone bridge
    creek = [(41, -1), (41.5, 5), (39.5, 11), (40.5, 17), (39.5, 22), (40, 25), (40, 30), (41.8, 34), (43, 41)]
    for (i, j) in a.stroke(creek, 2.0, 'w', keep=True, wobble=0.5, seed=4, force=True, only=',;"rTbF'):
        pass
    for (i, j) in a.stroke(creek, 2.0, '=', keep=True, force=True, only='.'):
        pass
    # Roa's timber gate: two posts either side of the road at the west edge
    a.mark('gate', [(2, 18), (2, 21)], 'the two stout timber posts of the village gate arch, a crossbeam over the road between them', WOOD)
    # the travellers' old well at the fork (a dry round stone well, a rope ladder inside) and its little flagstone apron
    a.rect(22, 16, 3, 2, 'c', keep=True)
    a.mark('well', [(23, 16)], 'the travellers\' OLD WELL: a dry round well of grey fieldstones, open (no roof), a rope ladder hanging down into its dark shaft', WELL)
    # the knoll with the ring of standing stones (NW) and the flat altar stone in the middle (walkable)
    cx, cy = 13, 10
    a.blob(cx, cy, 4.2, 3.4, ',', rough=0.15, seed=11, force=True)
    stones = [(round(cx + 3.0 * math.cos(t)), round(cy + 2.4 * math.sin(t))) for t in [i * 2 * math.pi / 7 + 0.3 for i in range(7)]]
    a.mark('stones', stones, 'a RING OF SEVEN ANCIENT STANDING STONES (tall weathered pale-grey menhirs with lichen)', STONE)
    a.mark('altar', [(cx, cy)], 'a low flat altar stone lying in the grass in the middle of the ring (walkable, flat)', (200, 196, 180), solid=False)
    a.rect(cx, cy, 1, 1, 'c', force=True, keep=True)
    # the knoll's low south bank (a one-row earthen face), with a gap of worn steps on its south side
    bank = [(x, 14) for x in range(9, 18) if x != 13]
    a.mark('bank', bank, 'the low grassy SOUTH BANK of the knoll: a one-tile earthen face with exposed stones and roots (the top edge lit), the knoll top is north of it', (128, 108, 88), ch='R')
    a.mark('steps', [(13, 14)], 'a few worn stone STEPS up the bank onto the knoll (walkable)', (180, 172, 150), solid=False)
    a.rect(13, 14, 1, 1, 'c', force=True, keep=True)
    # the giant oak by the fork (a 2x2 trunk footprint; its crown spreads wider)
    a.mark('oak', [(17, 15), (18, 15), (17, 16), (18, 16)], 'a GIANT ANCIENT OAK standing alone by the fork, a huge round crown spreading about a tile beyond this block, thick roots', (40, 110, 44), ch='T')
    # the wayside shrine on the Pharos road (north side) and the road lamp further on
    a.mark('shrine', [(29, 21)], 'a tiny wooden WAYSIDE SHRINE with a little shingle roof on a stone base, facing the road', ROOF)
    # the walled sheep pasture (SW): an irregular low dry-stone wall with a gap on its north side, a shepherd's stone shelter inside
    from scipy import ndimage
    pm = np.zeros((H, W), bool)
    ys, xs = np.mgrid[0:H, 0:W]
    pn = fbm(41, W, H, 4)
    pm = (((xs - 13.2) / 6.6) ** 2 + ((ys - 29.6) / 4.7) ** 2) < 1 + 0.35 * (pn - 0.5)
    pm = ndimage.binary_fill_holes(ndimage.binary_opening(pm))
    edge = pm & ~ndimage.binary_erosion(pm)
    wall = [(int(x), int(y)) for y, x in zip(*np.nonzero(edge)) if not (x in (12, 13) and y < 27)]
    a.mask_fill(pm & ~edge, ',', force=True)
    a.mark('wall', wall, 'a LOW DRY-STONE WALL of the sheep pasture (knee high, grey fieldstones, grass along its foot); the gap in its north side is the pasture gate', (112, 108, 100))
    a.mark('shelter', [(9, 28), (10, 28), (9, 29), (10, 29)], "a small round SHEPHERD'S SHELTER of fieldstones with a turf roof (no door on this side)", (150, 120, 80))
    a.stroke([(12.5, 21), (12.5, 25.5)], 1.6, ':')
    # a pond east of the pasture, groves, boulders
    a.blob(25, 31, 3.2, 2.1, 'w', rough=0.25, seed=13)
    for (x, y, rx, ry, s) in [(28, 14, 2.4, 1.8, 21), (35, 14.5, 2.0, 1.6, 22), (7.5, 14, 1.6, 1.4, 23), (46, 21, 2.8, 2.2, 24), (47, 34, 2.6, 1.8, 25),
                              (32, 32, 2.2, 1.7, 26), (16, 3.5, 2.0, 1.4, 27), (36, 6, 1.8, 1.5, 28)]:
        a.blob(x, y, rx, ry, 'T', rough=0.35, seed=s, only=',;"')
    a.scatter('r', 0.012, only=',;', seed=31, clear=1)
    a.scatter('b', 0.010, only=',;', seed=32, clear=1)
    # the old windmill on the far bank of the creek (a stone tower, its four sails reach over the grass north of it)
    a.blob(46.5, 16, 3.2, 2.6, ',', rough=0.2, seed=51, force=True)
    a.mark('windmill', [(x, y) for x in range(45, 48) for y in range(13, 17)], 'an OLD STONE WINDMILL: a round tapering tower of pale fieldstone with a conical shingle cap and four big lattice sails (canvas furled), a little wooden door on its south side (closed)', (214, 200, 170))
    a.stroke([(44, 27.5), (45.5, 22), (46, 17.5)], 1.4, ':', force=True, only=',;"rTb')
    # the small nook in front of the ridge (east of the creek) with a chest
    a.rect(48, 11, 3, 2, ',', force=True, keep=True)
    a.tidy()
    # exits
    a.exit('w', 19, 20, {'map': 'roa', 'spawn': 'gate'}, 'roa')
    a.exit('n', 31, 32, {'map': 'f_lookout', 'spawn': 'south'}, 'north')
    a.exit('e', 29, 30, {'map': 'f_cape', 'spawn': 'west'}, 'east')
    a.objects += [
        dict(type='stairs', x=23, y=16, to={'map': 'well', 'spawn': 'entrance'}, painted='stairs_down'),
        dict(type='sign', x=21, y=15, text='旅人の古井戸\n枯れ井戸。底へ下りる縄ばしごがある。'),
        dict(type='examine', x=cx, y=cy, event='world_poi_stones'),
        dict(type='examine', x=29, y=21, event='world_poi_shrine'),
        dict(type='waylamp', id='wl_pen_road', x=34, y=23, lit='prologue_lamp_road', event='world_pen_lamp'),
        dict(type='sign', x=5, y=17, text='ロアの里\n語り部の里。'),
        dict(type='sign', x=43, y=27, text='東 → 港町ファロス・灯台の岬\n北 → 見晴らし台・跳ね橋'),
        dict(type='chest', id='f_roa_c1', x=49, y=11, item='i_potion', n=1),
        # the windmill's closed door is added by f_roa/fix.json objects_add (examine world_poi_windmill at the painted door)
    ]
    a.spawns['well'] = dict(x=22, y=17, dir='s')
    a.meta = dict(name='ロアの丘', sub='羊の丘と古井戸', region='prologue', worldRect=[222, 246, 70, 60], outside='forest_dark',
                  zones=[{'rect': None, 'zone': 'zw_prologue'}],
                  links={'roa': {'map': 'f_roa', 'spawn': 'roa'}, 'well': {'map': 'f_roa', 'spawn': 'well'}},
                  npcs=[{'id': 'shepherd', 'look': 'npc_old_m_2', 'name': '羊飼いの年寄り', 'x': 14, 'y': 31, 'dir': 'w', 'move': 'still', 'cond': 'prologue_done',
                         'talk': 'world_shepherd', 'reward': 'news', 'key': 'world_shepherd'}])
    return a


def f_cape():
    """灯台の岬: the peninsula's windswept southern cape. The Pharos road from the west (f_roa) to the harbour town's stone gatehouse (E),
    a caravan rest with a wagon and a camp on the plateau, a sheltered sandy cove with tide pools under a low bank (W, the chest is on
    its beach), the ruin of an old sea wall on the west cliff top, high sea cliffs along the south-east, sea stacks, and the cape's
    tip with the tall lighthouse: the footpath winds round its west side to the door on its south face."""
    from scipy import ndimage
    a = Area('f_cape', 56, 44, 23)
    W, H = a.W, a.H
    a.mask_fill(fbm(5, W, H, 6) > 0.58, ';')
    a.mask_fill(fbm(8, W, H, 4) > 0.74, '"', only=',;')
    land = [(-3, -3), (59, -3), (59, 16), (53, 17.5), (48, 21), (44, 24.5), (40.5, 29), (37.5, 32.5), (35.5, 36.5), (33.5, 40.5), (30, 42.2),
            (26.5, 40.5), (24.5, 36.5), (22.5, 33.5), (19, 32.5), (15, 33.2), (10.5, 32.2), (6.5, 29), (5, 24.5), (2, 21.5), (-3, 21)]
    ys, xs = np.mgrid[0:H, 0:W]
    L = a.region(land, ',', rough=1.3, seed=3, only='')   # mask only
    sea = ~L
    a.mask_fill(sea, '~', force=True)
    dsea = ndimage.distance_transform_edt(L)            # distance (cells) from the sea, on land
    dland = ndimage.distance_transform_edt(sea)         # distance from land, on the sea
    cove = (xs < 21) & (ys > 17)                        # the sheltered cove on the west
    # the cove: a beach (2 cells), a low one-row bank behind it; tidal shallows along its waterline
    a.mask_fill(L & cove & (dsea <= 2.2), 's', force=True)
    a.mask_fill(L & cove & (dsea > 2.2) & (dsea <= 3.2), 'R', force=True)
    a.mask_fill(sea & cove & (dland <= 1.0), '_', force=True)
    # everywhere else the land ends in sea cliffs (2 cells), a narrow rocky rim
    a.mask_fill(L & ~cove & (dsea <= 2.0), 'R', force=True)
    # sea stacks
    for (x, y, r, s_) in [(46, 32, 1.6, 1), (50, 27, 1.1, 2), (41, 39, 1.3, 3), (16, 38, 1.2, 4), (3, 35, 1.0, 5)]:
        a.blob(x, y, r, r * 0.9, 'R', rough=0.3, seed=40 + s_, only='~')
    # the Pharos road: west edge -> gatehouse arch
    a.stroke([(-1, 9), (8, 9.3), (16, 10.4), (24, 10.6), (32, 9.8), (40, 8.8), (48, 8.5), (56.5, 8.5)], 2.0, '.', wobble=0.2, seed=6)
    # the harbour town's west gatehouse and wall (NE corner), the road through its arch
    wall = [(x, y) for x in (52, 53) for y in range(1, 16) if y not in (8, 9)]
    a.mark('town', wall + [(54, y) for y in range(0, 17) if y not in (8, 9)] + [(55, y) for y in range(0, 17) if y not in (8, 9)],
           "the harbour town's old stone WALL and its GATEHOUSE: a square tower with an arched passage over the road (the gap in this block), slate roof", (150, 146, 136))
    # the footpath down the cape: from the road south along the spine, round the west side of the lighthouse to its south door
    a.stroke([(26, 11), (27, 16), (29.5, 21), (28.5, 26), (26.3, 30.5), (25.8, 34.5), (27, 37.8), (29.5, 38.6)], 1.6, ':', wobble=0.2, seed=7, force=True)
    # the path down the cove bank to the beach (a sandy ramp through the bank)
    a.stroke([(21, 24), (19.5, 27), (18.5, 30.5)], 1.6, ':', force=True, only=',;"R')
    # the lighthouse on the cape's tip: base 4x3 (rows 34-36), the tower above it (rows 28-33), door on the base's south face
    tower = [(x, y) for x in range(28, 32) for y in range(29, 37)]
    a.mark('lighthouse', tower, 'the tall PHAROS LIGHTHOUSE seen from above in the classic 3/4 top-down view: its round white stone base with grey bands sits at the BOTTOM of this block (the bottom 3 rows) and the round tower rises up to the dark lantern room with a railed gallery at the TOP of the block', (236, 236, 230))
    a.mark('door', [(29, 36), (30, 36)], 'the lighthouse DOOR: a closed arched double door of dark wood with iron bands in the south face of the base', (40, 26, 16))
    a.rect(27, 37, 5, 2, 'c', force=True, keep=True)   # the small flagstone forecourt in front of the door
    # the ruin of the old sea wall on the west cliff top (above the cove)
    a.mark('ruin', [(20, 29), (21, 29), (22, 29), (23, 30)], 'the RUIN of an OLD SEA WALL: a broken stretch of mossy stone wall with two small window holes, fallen blocks at its foot', (138, 132, 120))
    # the caravan rest on the plateau (north of the road): a covered wagon, and the camp further east
    a.mark('wagon', [(36, 5), (37, 5), (38, 5)], "a travelling merchant's COVERED WAGON with a cream canvas hood, wooden wheels, unhitched, shafts on the ground", (200, 180, 140))
    a.rect(34, 6, 6, 2, ':', force=False)
    # groves and hedges on the plateau, a windbreak of wind-bent pines on the west
    for (x, y, rx, ry, s_) in [(7, 4, 3.0, 2.0, 11), (16, 5, 2.2, 1.6, 12), (44, 3, 2.6, 1.8, 13), (41, 14.5, 2.4, 1.8, 14), (20, 16, 2.0, 1.6, 15), (33, 18, 1.8, 1.4, 16), (8, 15, 2.4, 1.7, 18), (13, 21, 1.6, 1.3, 19)]:
        a.blob(x, y, rx, ry, 'T', rough=0.35, seed=s_, only=',;"')
    a.region([(-3, -3), (25, -3), (22, 0.8), (10, 1.5), (-3, 2.5)], 'F', rough=1.0, seed=17, only=',;"')
    a.scatter('r', 0.02, only=',;"', seed=31, clear=1)
    a.scatter('r', 0.05, only='s', seed=32, clear=1)
    a.scatter('b', 0.012, only=',;', seed=33, clear=1)
    a.tidy()
    a.exit('w', 8, 9, {'map': 'f_roa', 'spawn': 'east'}, 'west')
    a.exit('e', 8, 9, {'map': 'pharos', 'spawn': 'gate_w'}, 'pharos')
    a.spawns['lighthouse'] = dict(x=29, y=37, dir='s')
    a.objects += [
        dict(type='door', x=29, y=36, w=2, look='none', to={'map': 'lighthouse_1', 'spawn': 'entrance'}),
        dict(type='sign', x=27, y=38, text='ファロス灯台'),
        dict(type='sign', x=50, y=11, text='港町ファロス'),
        dict(type='sign', x=26, y=13, text='南 → ファロス灯台'),
        dict(type='examine', x=21, y=29, event='world_poi_pen_wall'),
        dict(type='waylamp', id='wl_rest_2', x=39, y=7, lit=True),
        dict(type='prop', id='tent', x=43, y=6), dict(type='prop', id='lantern', x=44, y=6),
        dict(type='chest', id='f_cape_c1', x=12, y=31, item='i_salve', n=2),
        dict(type='prop', id='lighthouse_glow', x=31, y=28, cond='prologue_boss', painted='lighthouse_glow'),   # the lantern room lit after the prologue boss
    ]
    a.meta = dict(name='灯台の岬', sub='ファロス街道と灯台', region='prologue', worldRect=[272, 300, 72, 92], outside='sea',
                  zones=[{'rect': [0, 0, 56, 16], 'zone': 'zw_prologue'}, {'rect': None, 'zone': 'zw_peninsula'}],
                  links={'pharos': {'map': 'f_cape', 'spawn': 'pharos'}, 'lighthouse': {'map': 'f_cape', 'spawn': 'lighthouse'}}, npcs=[])
    return a


def f_lookout():
    """見晴らし台と跳ね橋 (identity: a purple heather heath on the north shore, a timber drawbridge on stone piers over a grey strait,
    a high bluff with a wooden lookout tower). The road from the south (f_roa) to the drawbridge (N edge -> f_cross; raised until the
    prologue ends: tilePatch + closed layer), the stone abutment with lamps and the bridge-keeper; the bluff (E) rises behind a rock
    face, a stair cut through it, the lookout tower, the old lamp (the lamp quest), a bench, the chest at the bluff's tip; a shingle
    beach with an upturned fishing boat (W), a birch copse, heather everywhere."""
    from scipy import ndimage
    a = Area('f_lookout', 48, 40, 37)
    W, H = a.W, a.H
    ys, xs = np.mgrid[0:H, 0:W]
    a.mask_fill(fbm(5, W, H, 5) > 0.5, ';')
    a.mask_fill(fbm(6, W, H, 4) > 0.5, '"', only=',;')      # heather
    land = [(-3, 12.5), (8, 11.5), (15, 12.5), (20, 10.5), (26, 10.5), (29.5, 8), (31, 5), (38, 3.5), (46, 4.5), (51, 5), (51, 43), (-3, 43)]
    L = a.region(land, ',', rough=1.0, seed=3, only='')
    a.mask_fill(~L, '~', force=True)
    dsea = ndimage.distance_transform_edt(L)
    a.mask_fill(L & (dsea <= 1.8) & (xs < 20), 's', force=True)            # shingle beach (W)
    a.mask_fill(L & (dsea <= 0.9) & (xs < 20) & (fbm(11, W, H, 2) > 0.55), 'r', force=True)
    # the bluff: high ground, sea cliffs on its sea sides, a rock face on its land sides
    bl = (xs >= 31) & (ys <= 19) & L
    bl &= ~((xs < 34) & (ys > 16))
    a.mask_fill(bl & (dsea <= 1.6), 'R', force=True)
    face = bl & ~ndimage.binary_erosion(bl, iterations=2, border_value=1) & (dsea > 1.6)
    face &= (ys >= 17) | (xs <= 32)
    a.mask_fill(face, 'R', force=True)
    a.mask_fill(bl & ~face & (dsea > 1.6), ',', force=True)
    a.mask_fill(bl & ~face & (dsea > 1.6) & (fbm(9, W, H, 4) > 0.55), '"')
    a.rect(33, 16, 1, 4, 'R', force=True)     # the face's south-west corner
    # road: south edge -> abutment -> drawbridge (x 22-23)
    a.stroke([(24.5, 40.5), (24.5, 34), (22.5, 28), (23.5, 21), (22.5, 15), (22.5, 12.5)], 2.0, '.', wobble=0.2, seed=6)
    a.rect(20, 10, 6, 3, 'c', force=True, keep=True)
    a.rect(22, 0, 2, 10, '=', force=True, keep=True)
    a.mark('piers', [(21, 4), (24, 4), (21, 5), (24, 5)], 'the two massive stone PIERS of the drawbridge in the sea either side of the deck, with the lifting chains and the tall timber frame of the drawbridge', (120, 116, 110))
    # footpath: from the road east to the stair cut through the bluff's face, on up to the lookout
    a.stroke([(24, 27), (30, 24.5), (36.5, 22), (37, 19.5), (38.5, 15), (41, 11.8)], 1.5, ':', force=True)
    a.mark('stair', [(36, 18), (37, 18), (36, 17), (37, 17)], 'a flight of rough STONE STEPS cut up through the rock face onto the bluff (walkable)', (182, 176, 160), solid=False)
    a.rect(36, 17, 2, 2, 'c', force=True, keep=True)
    a.mark('lookout', [(41, 10), (42, 10), (41, 11), (42, 11)], 'a tall wooden LOOKOUT TOWER on four timber legs with a railed platform and a little shingle roof, a ladder on its south side', (170, 110, 60))
    a.mark('boat', [(9, 12), (10, 12)], 'an old UPTURNED FISHING BOAT lying keel-up on the shingle, weathered planks, a coil of rope', (130, 96, 70))
    # the birch copse (W) and groves
    a.region([(-3, 17), (9, 16.5), (14, 21), (12, 29), (5, 31), (-3, 30)], 'T', rough=1.3, seed=11, only=',;"')
    for (x, y, rx, ry, s_) in [(31, 31, 2.4, 1.8, 12), (14, 36, 2.6, 1.6, 13), (41, 30, 2.8, 2.0, 14), (44, 24, 1.6, 1.3, 15)]:
        a.blob(x, y, rx, ry, 'T', rough=0.35, seed=s_, only=',;"')
    a.region([(-3, 37.5), (48, 38.5), (51, 43), (-3, 43)], 'F', rough=1.0, seed=16, only=',;"')
    a.scatter('r', 0.012, only=',;"', seed=31, clear=1)
    a.tidy()
    a.exit('s', 24, 25, {'map': 'f_roa', 'spawn': 'north'}, 'south')
    a.exit('n', 22, 23, {'map': 'f_cross', 'spawn': 'bridge'}, 'bridge')['cond'] = 'prologue_done'   # the drawbridge is up until the prologue ends
    a.objects += [
        dict(type='waylamp', id='wl_pen_lookout', x=40, y=12, lit='prologue_lamp_lookout', event='world_pen_lamp'),
        dict(type='examine', x=41, y=11, event='world_poi_pen_lookout'),
        dict(type='sign', x=38, y=16, text='見晴らし台\n半島の北の海を見わたす。'),
        dict(type='prop', id='bench', x=44, y=13),
        dict(type='prop', id='lamp_post', x=20, y=12), dict(type='prop', id='lamp_post', x=25, y=10),
        dict(type='prop', id='bollard', x=21, y=10),
        dict(type='sign', x=26, y=13, text='跳ね橋\n北 → 北の野'),
        dict(type='chest', id='f_lookout_c1', x=45, y=7, item='i_ether', n=1),
    ]
    a.meta = dict(name='見晴らし台', sub='跳ね橋と北の海', region='prologue', worldRect=[238, 214, 70, 46], outside='sea',
                  zones=[{'rect': None, 'zone': 'zw_peninsula'}],
                  tilePatches=[{'cond': '!prologue_done', 'rect': [22, 1, 2, 8], 'rows': ['~~'] * 8}],
                  npcs=[{'id': 'bridge_guard', 'look': 'npc_guard_2', 'name': '橋番', 'x': 24, 'y': 11, 'dir': 'w', 'move': 'still', 'pushable': False,
                         'talk': 'world_bridge_guard', 'reward': 'news', 'key': 'world_bridge_guard'}], links={})
    return a


def f_cross():
    """北の野の分かれ道: the open north plains beyond the strait. The drawbridge lands from the south; a crossroads with the old milestone
    cairn; the road east to the mountain pass (rockslide and a guard in the demo -> the old world map beyond), the road west to the
    woodcutters' fields; a travellers' camp and a caravan wagon; the grassy ruin of an old coaching inn (a cache in its steps) and a lone
    rune stone on the rolling grass; a reedy lake in the north-east; the foothills of the northern mountains along the top."""
    from scipy import ndimage
    a = Area('f_cross', 60, 40, 41)
    W, H = a.W, a.H
    a.mask_fill(fbm(5, W, H, 7) > 0.52, ';')
    a.mask_fill(fbm(6, W, H, 4) > 0.72, '"', only=',;')
    ys, xs = np.mgrid[0:H, 0:W]
    # the strait along the south edge, the bridge landing
    sea = a.region([(-3, 36.5), (20, 35.5), (40, 36.2), (63, 35), (63, 43), (-3, 43)], '~', rough=0.9, seed=3)
    a.mask_fill(~sea & (ndimage.distance_transform_edt(~sea) <= 1.2), 'r', force=True)
    a.rect(28, 35, 2, 5, '=', force=True, keep=True)
    a.rect(26, 32, 6, 3, 'c', force=True, keep=True)
    # mountain foothills (N): rock and a cliff
    hill = a.region([(-3, -3), (63, -3), (63, 3.5), (48, 5), (36, 3.5), (22, 5.5), (8, 4), (-3, 5)], 'r', rough=1.2, seed=4)
    a.mask_fill(hill & (fbm(7, W, H, 3) > 0.55), 'F')
    a.mask_fill(~hill & ndimage.binary_dilation(hill, iterations=1) & (ys < 8), 'R', force=True)
    # the lake (NE) with reeds (bushes on its rim)
    lk = a.blob(47, 11, 5.5, 3.2, 'w', rough=0.3, seed=5)
    a.ring(lk, 'b', 1, only=',;"')
    a.mask_fill(ndimage.binary_dilation(lk, iterations=2) & ~lk & (fbm(8, W, H, 3) > 0.5), ',', force=True)
    # roads: from the bridge north to the crossroads; east to the pass; west
    a.stroke([(28.5, 32), (28.5, 26), (29.5, 20.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(29.5, 20.5), (36, 19.5), (44, 20.5), (52, 19), (60.5, 18.5)], 2.0, '.', wobble=0.2, seed=7)
    a.stroke([(29.5, 20.5), (22, 21.5), (13, 23.5), (5, 22.5), (-1, 22.5)], 2.0, '.', wobble=0.2, seed=8)
    a.stroke([(29.5, 20.5), (27, 15), (25, 11)], 1.5, ':', seed=9)
    a.mark('cairn', [(31, 22)], 'an old MILESTONE CAIRN: a waist-high pile of fieldstones with a carved upright milestone on top, at the corner of the crossroads', (190, 184, 170))
    # the ruin of the coaching inn (N of the crossroads): a flagstone floor, broken wall stubs, three steps
    a.rect(20, 7, 8, 5, 'c', force=True, keep=True)
    rw = [(20, 7), (21, 7), (22, 7), (26, 7), (27, 7), (20, 8), (20, 9), (27, 8), (27, 9), (27, 10)]
    a.mark('ruin', rw, 'the grassy RUIN of an old coaching inn: knee-high broken stone wall stubs around a weedy flagstone floor', (150, 144, 132))
    a.mark('steps', [(24, 11), (25, 11)], 'three worn stone STEPS at the ruin\'s south side (walkable)', (182, 176, 160), solid=False)
    # a lone rune stone on the grass (E of the ruin)
    a.mark('rune', [(38, 11)], 'a lone tall RUNE STONE, pale grey with faint carved rings, leaning slightly', (226, 222, 204))
    # a wooden fishing jetty out into the lake (the chest at its end)
    a.rect(46, 11, 2, 5, '=', force=True, keep=True)
    a.stroke([(46.5, 16), (45, 19)], 1.4, ':', force=True)
    # the travellers' camp (N of the east road) and the caravan wagon (S of it)
    a.rect(40, 15, 5, 3, ':', force=False)
    a.mark('wagon', [(44, 23), (45, 23), (46, 23)], "a caravan's COVERED WAGON with a patched canvas hood, unhitched by the road", (200, 180, 140))
    # the rockslide at the pass (demo: closed; tilePatch) — the painting shows the open road, the closed look is a layer
    for (x, y, rx, ry, s_) in [(10, 30, 2.6, 1.8, 11), (40, 29, 2.4, 1.8, 13), (8, 13, 2.0, 1.5, 15), (54, 31, 1.8, 1.3, 17)]:
        a.blob(x, y, rx, ry, 'T', rough=0.35, seed=s_, only=',;"')
    a.scatter('r', 0.012, only=',;"', seed=31, clear=1)
    a.scatter('b', 0.008, only=',;"', seed=32, clear=1)
    a.tidy()
    a.exit('s', 28, 29, {'map': 'f_lookout', 'spawn': 'bridge'}, 'bridge')
    a.exit('w', 22, 23, {'map': 'f_hut', 'spawn': 'east'}, 'west')
    a.exit('e', 18, 19, {'map': 'world', 'spawn': 'f_cross_e'}, 'east')['cond'] = {'not': {'slice': True}}   # the pass: rockslide in the demo
    a.objects += [
        dict(type='sign', x=31, y=19, text='北の野の分かれ道\n西 → ヴェルダの森・フェルン\n東 → ガルド山地\n南 → 跳ね橋・ファロス半島'),
        dict(type='examine', x=24, y=10, event='world_poi_plains_found'),
        dict(type='examine', x=25, y=10, event='world_poi_cache', item='i_potion', key='world_poi_plains_found'),
        dict(type='examine', x=38, y=11, event='world_poi_stones'),
        dict(type='prop', id='tent', x=41, y=15), dict(type='prop', id='lantern', x=43, y=16),
        dict(type='waylamp', id='wl_rest_3', x=47, y=23, lit=True),
        dict(type='prop', id='lamp_post', x=27, y=32), dict(type='prop', id='lamp_post', x=31, y=32),
        dict(type='chest', id='f_cross_c1', x=46, y=11, item='i_potion', n=2),
    ]
    a.meta = dict(name='北の野', sub='三つの道の分かれ道', region='r_forest', worldRect=[232, 124, 120, 96], outside='forest_dark',
                  zones=[{'rect': None, 'zone': 'zw_forest'}],
                  tilePatches=[{'cond': {'slice': True}, 'rect': [55, 17, 3, 4], 'rows': ['rrr'] * 4}],
                  npcs=[{'id': 'traveler_plains', 'look': 'npc_merchant_2', 'name': '旅の行商人', 'x': 42, 'y': 17, 'dir': 's', 'move': 'still',
                         'talk': 'world_traveler_plains', 'reward': 'news', 'key': 'world_traveler_plains'},
                        {'id': 'guard_east', 'look': 'npc_guard_1', 'name': '番人', 'x': 54, 'y': 18, 'dir': 'w', 'move': 'still', 'pushable': False,
                         'cond': {'slice': True}, 'talk': {'lines': [{'text': ['東の峠は、ゆうべの\n崖崩れで通れないんだ。', '山地の鉱山町へ行くなら、\nしばらく待ってくれ。']}]},
                         'reward': 'news', 'key': 'world_guard_east'}], links={})
    return a


def f_hut():
    """きこりの野: stump fields at the edge of the great forest. The road from the plains (E) runs west into the trees (-> f_fern); the
    woodcutters' rest hut in a felled clearing with log stacks; a creek with a log footbridge; the forest waylamp and a wayside shrine
    among ferns; old woods closing in on the west, north and south; the chest hidden among the stumps."""
    from scipy import ndimage
    a = Area('f_hut', 52, 40, 53)
    W, H = a.W, a.H
    a.mask_fill(fbm(5, W, H, 5) > 0.55, ';')
    a.mask_fill(fbm(6, W, H, 4) > 0.75, '"', only=',;')
    ys, xs = np.mgrid[0:H, 0:W]
    fn = fbm(7, W, H, 6)
    # the forest: dense in the west and along the top and bottom, thinning to the east
    dens = (1 - xs / W) * 0.9 + np.maximum(0, (4 - ys) / 4) + np.maximum(0, (ys - (H - 5)) / 4) + (fn - 0.5) * 0.6
    a.mask_fill(dens > 0.72, 'F')
    a.mask_fill((dens > 0.52) & (dens <= 0.72) & (fbm(8, W, H, 2.5) > 0.5), 'T')
    # the felled clearing around the hut
    a.blob(24, 16, 8, 5.5, ',', rough=0.3, seed=9, force=True)
    a.mask_fill(fbm(10, W, H, 3) > 0.6, ';', only=',')
    # the creek (N -> S) and the log footbridge
    ck = [(36, -1), (35, 6), (37.5, 12), (36, 19), (38, 26), (36.5, 33), (38, 41)]
    # roads
    a.stroke([(52.5, 20.5), (45, 20.8), (38, 21.5), (31, 22), (22, 23.5), (12, 24.5), (4, 24), (-1, 24.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(24, 19.5), (24, 22)], 1.4, ':')
    a.stroke(ck, 1.8, 'w', keep=True, wobble=0.5, seed=4, force=True, only=',;"TFbr')
    a.stroke(ck, 1.8, '=', keep=True, force=True, only='.')
    # the hut (4x3 base, the door on its south face) and log stacks
    hut = [(x, y) for x in range(22, 27) for y in range(15, 19)]
    a.mark('hut', hut, "the WOODCUTTERS' REST HUT: a sturdy log cabin with a mossy shingle roof, a stone chimney, a small porch with a bench on its south side", (140, 92, 52))
    a.mark('door', [(24, 18)], "the hut's DOOR: a closed plank door with iron bands on the south face", (40, 26, 16))
    a.mark('logs', [(28, 17), (29, 17)], 'a neat STACK OF CUT LOGS beside the hut under a little lean-to roof', (160, 110, 64))
    a.mark('logs2', [(19, 13), (20, 13)], 'a pile of felled TRUNKS lying on the grass', (150, 104, 60))
    # stumps field: small rocks = stumps (the prompt tells it: cut tree stumps)
    rnd = np.random.RandomState(4)
    st = []
    for (x, y) in [(18, 18), (20, 20), (29, 13), (30, 20), (17, 15), (27, 12), (16, 21), (31, 16)]:
        st.append((x, y))
    a.mark('stumps', st, 'old CUT TREE STUMPS with rings and moss, knee high, scattered over the clearing', (176, 132, 84))
    a.mark('shrine', [(42, 17)], 'a small mossy stone WAYSIDE SHRINE with a little roof, facing the road', (170, 60, 50))
    # a rock ledge across the creek in the north: a little WATERFALL tumbling over it into a pool
    ledge = [(x, 8) for x in range(31, 42) if a.g[8, x] != 'w']
    a.mark('ledge', ledge, 'a mossy ROCK LEDGE (a one-tile step in the ground, its face towards the south)', (128, 108, 88), ch='R')
    wf = [(x, 8) for x in range(31, 42) if a.g[8, x] == 'w']
    a.mark('falls', wf, 'a small WATERFALL where the creek tumbles white over the ledge into a round pool below', (200, 230, 250), ch='w')
    a.blob(36.5, 10, 2.0, 1.4, 'w', rough=0.2, seed=61, only=',;"TFbr')
    # a sawhorse and a timber stack at the clearing's east side
    a.mark('saw', [(30, 14), (31, 14)], "a woodcutters' SAWHORSE with a half-sawn log and a big two-man saw", (170, 120, 70))
    a.scatter('r', 0.01, only=',;"', seed=31, clear=1)
    a.tidy()
    a.exit('e', 23, 24, {'map': 'f_cross', 'spawn': 'west'}, 'east')   # gen1 painted the road straighter: the east end at rows 23-24
    a.exit('w', 24, 25, {'map': 'f_fern', 'spawn': 'east'}, 'west')
    a.spawns['hut'] = dict(x=24, y=19, dir='s')
    a.objects += [
        dict(type='door', x=24, y=18, look='none', to={'map': 'hut', 'spawn': 'door'}),
        dict(type='examine', x=42, y=17, event='world_poi_shrine'),
        dict(type='waylamp', id='wl_forest_1', x=33, y=20, lit='q_forest_fireflies_1', event='forest_waylamp'),
        dict(type='sign', x=21, y=20, text='きこりの休み小屋\n旅の人も、ひと休みを。'),
        dict(type='prop', id='lantern', x=27, y=19),
        dict(type='chest', id='f_hut_c1', x=17, y=13, item='i_potion', n=2),
    ]
    a.meta = dict(name='きこりの野', sub='森の手前の切り株の野', region='r_forest', worldRect=[170, 160, 70, 60], outside='forest_dark',
                  zones=[{'rect': None, 'zone': 'zw_forest'}],
                  links={'hut': {'map': 'f_hut', 'spawn': 'hut'}}, npcs=[])
    return a


def f_fern():
    """森の街道: the old forest road to Fern. From the stump fields (E) the road winds west under colossal mossy trees; the great root arch
    of Fern's south gate at the top (N); a deep mossy ravine cuts across the south-west with a rope-railed log bridge; the two forest
    waylamps, a wayside shrine; the roads go on west (f_windhill) and south (f_south); the chest on a ledge across the ravine."""
    from scipy import ndimage
    a = Area('f_fern', 56, 44, 67)
    W, H = a.W, a.H
    ys, xs = np.mgrid[0:H, 0:W]
    a.mask_fill(fbm(5, W, H, 6) > 0.5, ';')
    fn = fbm(7, W, H, 5)
    a.mask_fill(fn > 0.47, 'F')
    a.mask_fill((fn > 0.40) & (fn <= 0.47) & (fbm(8, W, H, 2.2) > 0.45), 'T')
    # clearings
    for (x, y, rx, ry, s_) in [(28, 19, 5.5, 4, 11), (12, 14, 4, 3, 12), (45, 25, 4.5, 3.5, 13), (15, 36, 3, 1.8, 14), (40, 8, 3.2, 2.4, 15)]:
        a.blob(x, y, rx, ry, ',', rough=0.35, seed=s_, force=True)
    # roads
    a.stroke([(56.5, 12.5), (48, 13), (40, 15.5), (33, 18), (28, 18.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(28, 18.5), (27.5, 12), (28.5, 5), (28.5, -1)], 2.0, '.', wobble=0.2, seed=7)
    a.stroke([(28, 18.5), (20, 17), (12, 15.5), (4, 16.5), (-1, 16.5)], 2.0, '.', wobble=0.2, seed=8)
    a.stroke([(28, 18.5), (31, 25), (29.5, 32), (30.5, 38), (30.5, 44.5)], 2.0, '.', wobble=0.2, seed=9)
    # Fern's south gate: a great arch of living roots over the road at the top edge
    a.mark('gate', [(26, 1), (26, 2), (31, 1), (31, 2), (26, 0), (27, 0), (30, 0), (31, 0)], "the great ROOT ARCH of the forest village's south gate: two colossal mossy root pillars either side of the road, their roots arching over it", (110, 70, 40))
    # the ravine (SW -> centre-south): cliffs either side, a stream at the bottom; the log bridge on the south road
    rv = [(-1, 27), (8, 29), (16, 31), (24, 33.5), (31, 34), (38, 37), (45, 42), (48, 45)]
    rim = a.stroke(rv, 4.2, 'R', keep=False, force=True, only=',;"TFbr')
    a.stroke(rv, 1.6, 'w', keep=True, force=True, only='R')
    br = a.stroke(rv, 4.4, '=', keep=True, force=True, only='.')
    # a ledge across the ravine (the chest)
    a.rect(14, 35, 3, 2, ',', force=True, keep=True)
    a.stroke([(16, 36.5), (22, 37.5), (28, 37)], 1.4, ':', force=True, only=',;"TFbr')
    for k, (x, y) in enumerate([(33, 26), (19, 10), (48, 22)]):
        a.mark('giant%d' % k, [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)], 'the huge mossy TRUNK of a COLOSSAL ANCIENT TREE with buttress roots spreading over the ground (its enormous crown fills the area around and above it)', (96, 64, 40), ch='X')
    a.mark('ring', [(44, 25)], 'a FAIRY RING of pale glowing mushrooms in the grass (walkable, flat)', (220, 200, 240), solid=False)
    a.mark('mossrocks', [(20, 21), (35, 11), (46, 17), (9, 20)], 'big MOSS-COVERED BOULDERS with ferns at their foot', (120, 140, 100))
    a.mark('shrine', [(24, 16)], 'a small mossy stone WAYSIDE SHRINE with a little roof, facing the road', (170, 60, 50))
    a.scatter('r', 0.012, only=',;"', seed=31, clear=1)
    a.scatter('b', 0.015, only=',;"', seed=32, clear=1)
    a.tidy()
    a.exit('e', 12, 13, {'map': 'f_hut', 'spawn': 'west'}, 'east')
    a.exit('n', 28, 29, {'map': 'fern', 'spawn': 'gate_s'}, 'fern')
    a.exit('w', 16, 17, {'map': 'f_windhill', 'spawn': 'east'}, 'west')
    a.exit('s', 30, 31, {'map': 'f_south', 'spawn': 'north'}, 'south')
    a.objects += [
        dict(type='waylamp', id='wl_forest_2', x=38, y=14, lit='q_forest_fireflies_2', event='forest_waylamp'),
        dict(type='waylamp', id='wl_forest_3', x=26, y=23, lit='q_forest_fireflies_3', event='forest_waylamp'),
        dict(type='examine', x=24, y=16, event='world_poi_shrine'),
        dict(type='sign', x=30, y=4, text='森の村フェルン'),
        dict(type='sign', x=33, y=21, text='北 → フェルン\n西 → 風鳴りの丘\n南 → 森の南'),
        dict(type='prop', id='mushroom_glow', x=13, y=36), dict(type='prop', id='mushroom_glow', x=44, y=24),
        dict(type='chest', id='f_fern_c1', x=15, y=35, item='i_ether', n=1),
    ]
    a.meta = dict(name='森の街道', sub='フェルンへの森の道', region='r_forest', worldRect=[112, 188, 90, 74], outside='forest_dark',
                  zones=[{'rect': None, 'zone': 'zw_forest_road'}],
                  links={'fern': {'map': 'f_fern', 'spawn': 'fern'}}, npcs=[])
    a.spawns['fern'] = dict(x=28, y=2, dir='s')
    return a


def f_south():
    """森の南: the southern forest glades on the way to the desert pass. A woodcutters' camp in a sunny glade, the forest's south square
    (a clearing with a ring of mossy pillars), the twin watchtowers under repair (fenced), the crumbling old forest tower in the west
    (a cache in its steps), a stone circle and a shrine by the road, a brook with stepping-stone fords; the road south ends at the pass
    (rockslide and a guard in the demo -> the old world map beyond)."""
    from scipy import ndimage
    a = Area('f_south', 56, 48, 79)
    W, H = a.W, a.H
    ys, xs = np.mgrid[0:H, 0:W]
    a.mask_fill(fbm(5, W, H, 6) > 0.5, ';')
    fn = fbm(9, W, H, 6)
    a.mask_fill(fn > 0.55, 'F')
    a.mask_fill((fn > 0.47) & (fn <= 0.55) & (fbm(8, W, H, 2.2) > 0.5), 'T')
    for (x, y, rx, ry, s_) in [(30, 8, 6, 4, 11), (38, 20, 7, 5, 12), (22, 26, 7, 5, 13), (12, 14, 5, 4.5, 14), (40, 36, 6, 4, 15), (20, 40, 5, 3.5, 16)]:
        a.blob(x, y, rx, ry, ',', rough=0.35, seed=s_, force=True)
    # roads
    a.stroke([(30.5, -1), (31, 6), (35, 13), (37, 20), (31, 25), (22, 28), (19, 35), (20.5, 42), (20.5, 48.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(22, 28), (15, 21), (12, 15)], 1.5, ':', seed=7)
    a.stroke([(37, 20), (41, 28), (40, 35)], 1.5, ':', seed=8)
    # the brook, fords where paths cross
    bk = [(57, 30), (48, 29), (42, 31.5), (33, 31), (25, 33), (14, 31.5), (6, 34), (-1, 33)]
    a.stroke(bk, 1.8, 'w', keep=True, wobble=0.4, seed=4, force=True, only=',;"TFbr')
    a.stroke(bk, 1.8, '_', keep=True, force=True, only='.:')
    # the ring of mossy pillars in the south square (the glade at 38,20)
    pil = [(round(38 + 3.2 * math.cos(t)), round(19 + 2.4 * math.sin(t))) for t in [i * 2 * math.pi / 8 + 0.2 for i in range(8)]]
    pil = [p for p in pil if a.g[p[1], p[0]] != '.']
    a.mark('pillars', pil, 'a RING OF OLD MOSSY STONE PILLARS, some broken, around a floor stone carved with a great leaf pattern', (190, 196, 170))
    a.mark('leaf', [(38, 19)], 'the round FLOOR STONE carved with a thousand-year-tree leaf (walkable, flat)', (170, 180, 150), solid=False)
    a.rect(38, 19, 1, 1, 'c', force=True, keep=True)
    # the twin watchtowers under repair (fenced), east of the south road
    a.mark('towers', [(26, 38), (27, 38), (26, 39), (27, 39), (31, 38), (32, 38), (31, 39), (32, 39)],
           'the TWIN WATCHTOWERS: two square timber-and-stone towers with scaffolding and ladders against them, planks and tools stacked (under repair)', (150, 120, 90))
    # the old forest tower (W): a crumbling round stone tower overgrown with roots
    a.mark('tower', [(10, 12), (11, 12), (10, 13), (11, 13)], 'the crumbling OLD FOREST TOWER: a squat round stone ruin overgrown with roots and ivy, its doorway blocked with earth', (140, 136, 124))
    a.mark('steps', [(12, 14)], 'a few broken stone STEPS in front of the tower (walkable)', (182, 176, 160), solid=False)
    # a stone circle and a shrine by the road
    a.mark('stones', [(26, 5), (28, 4), (26, 10)], 'three leaning STANDING STONES in the grass', (226, 222, 204))
    a.mark('shrine', [(34, 9)], 'a small mossy stone WAYSIDE SHRINE with a little roof, facing the road', (170, 60, 50))
    # the pass at the south: rocky walls either side of the road
    a.region([(-3, 44), (17, 43.5), (18.5, 49), (-3, 49)], 'R', rough=0.8, seed=21, force=True)
    a.region([(23, 43.5), (59, 43), (59, 49), (22.5, 49)], 'R', rough=0.8, seed=22, force=True)
    a.scatter('r', 0.01, only=',;"', seed=31, clear=1)
    a.scatter('b', 0.012, only=',;"', seed=32, clear=1)
    a.tidy()
    a.exit('n', 30, 31, {'map': 'f_fern', 'spawn': 'south'}, 'north')
    a.exit('s', 20, 21, {'map': 'world', 'spawn': 'f_south_s'}, 'south')['cond'] = {'not': {'slice': True}}
    a.objects += [
        dict(type='examine', x=38, y=19, event='world_poi_forest_ring'),
        dict(type='sign', x=35, y=23, text='森の南の広場'),
        dict(type='sign', x=29, y=41, text='双子の見張り塔\n修理中につき、立ち入り禁止。'),
        dict(type='prop', id='fence', x=28, y=40), dict(type='prop', id='fence', x=29, y=40), dict(type='prop', id='fence', x=30, y=40),
        dict(type='examine', x=12, y=14, event='world_poi_forest_tower'),
        dict(type='examine', x=13, y=14, event='world_poi_cache', item='i_ether', key='world_poi_forest_tower'),
        dict(type='examine', x=27, y=6, event='world_poi_stones'),
        dict(type='examine', x=34, y=9, event='world_poi_shrine'),
        dict(type='prop', id='tent', x=19, y=24), dict(type='prop', id='lantern', x=20, y=24),
        dict(type='waylamp', id='wl_17', x=33, y=12, lit=True),
        dict(type='waylamp', id='wl_18', x=19, y=37, lit=True),
        dict(type='sign', x=23, y=42, text='南の峠\n南 → ザハラ砂漠'),
    ]
    a.meta = dict(name='森の南', sub='きこりの野営地と古い塔', region='r_forest', worldRect=[84, 262, 110, 100], outside='forest_dark',
                  zones=[{'rect': None, 'zone': 'zw_forest'}],
                  tilePatches=[{'cond': {'slice': True}, 'rect': [19, 44, 4, 2], 'rows': ['rrrr', 'rrrr']}],
                  npcs=[{'id': 'woodcutter_road', 'look': 'npc_woodcutter_1', 'name': 'きこり', 'x': 21, 'y': 25, 'dir': 'w', 'move': 'still',
                         'talk': 'world_woodcutter', 'reward': 'hint', 'key': 'world_woodcutter'},
                        {'id': 'guard_south', 'look': 'npc_guard_1', 'name': '番人', 'x': 21, 'y': 42, 'dir': 'n', 'move': 'still', 'pushable': False,
                         'cond': {'slice': True}, 'talk': {'lines': [{'text': ['南の峠は、砂嵐で\n道が埋まってしまったんだ。', '砂漠へ行くのは、\n嵐がやむまで待ってくれ。']}]},
                         'reward': 'news', 'key': 'world_guard_south'}], links={})
    return a


def f_windhill():
    """風鳴りの丘: the high windy downs of the north-west forest. A bare grassy hill crowned by wind-worn rocks that hum (the notes); the
    road to the moss village Yura (N, west) and the northern pass to the snowfields (N, east; rockslide and a guard in the demo);
    a travellers' camp; a fallen colossal statue in the woods; in the south-west the crown of the thousand-year tree towers over the
    forest (its beacon lights when the forest is saved); a tarn among the rocks."""
    from scipy import ndimage
    a = Area('f_windhill', 52, 44, 91)
    W, H = a.W, a.H
    ys, xs = np.mgrid[0:H, 0:W]
    a.mask_fill(fbm(5, W, H, 6) > 0.45, ';')
    fn = fbm(9, W, H, 6)
    dens = fn + np.maximum(0, (ys - 33) / 12) + np.maximum(0, (8 - xs) / 16) - np.exp(-(((xs - 33) / 12) ** 2 + ((ys - 16) / 10) ** 2)) * 0.8
    a.mask_fill(dens > 0.62, 'F')
    a.mask_fill((dens > 0.52) & (dens <= 0.62) & (fbm(8, W, H, 2.2) > 0.5), 'T')
    # the wind hill: a low cliff ring with a path up from the south-west, the rocks on top
    hill = (((xs - 34) / 7.5) ** 2 + ((ys - 15) / 5.2) ** 2) < 1 + 0.2 * (fbm(12, W, H, 3) - 0.5)
    a.mask_fill(hill, ',', force=True)
    a.mask_fill(hill & (fbm(13, W, H, 3) > 0.55), ';')
    rim = sorted({(int(round(33 + 7.8 * math.cos(t))), int(round(14 + 5.4 * math.sin(t)))) for t in np.linspace(-0.15, math.pi + 0.15, 90)})
    a.mark('rim', rim, "the low ROCK RIM of the bald hill: a one-tile grey rock face along its south side (the hilltop is north of it, a little higher)", (128, 108, 88), ch='R')
    a.mark('rocks', [(32, 12), (35, 11), (37, 13), (33, 14)], 'tall WIND-WORN ROCKS on the hilltop, pierced with holes by the wind', (170, 164, 150))
    a.mark('notes', [(34, 13)], 'a flat grey ROCK SLAB on the hilltop with an old leather satchel tucked under it (walkable in front)', (150, 146, 136))
    # roads: E edge -> west past the hill; up to the pass (N, east) and to Yura (N, west)
    a.stroke([(52.5, 30.5), (44, 29.5), (36, 26), (27, 25), (18, 22), (13, 15), (12.5, 7), (12.5, -1)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(36, 26), (40, 20), (42, 12), (40, 5), (39.5, -1)], 2.0, '.', wobble=0.2, seed=7)
    hp = a.stroke([(27, 25), (28, 21), (30, 18.5), (32, 16)], 1.4, ':', force=True)
    a.keep[np.array([[False] * W] * H)] = False
    for (x, y) in hp:
        if a.inb(x, y) and a.g[y, x] == 'R': a.g[y, x] = 'c'; a.marks.append(dict(kind='steps', cells=[[x, y]], text='worn stone STEPS through the rim (walkable)', color=[182, 176, 160], solid=False))
    a.mark('tor', [(44, 12), (45, 12), (44, 13), (45, 13), (46, 13)], 'a GRANITE TOR: a stack of huge rounded grey boulders piled by the wind, lichen-spotted', (150, 150, 150))
    # the tarn among rocks (NE)
    tn = a.blob(47, 9, 3, 2.2, 'w', rough=0.3, seed=14)
    a.ring(tn, 'r', 1, only=',;"')
    # the pass: rock walls either side of the north road
    a.region([(33, -3), (38.2, -3), (38.2, 3.5), (34, 4.5)], 'R', rough=0.6, seed=21, force=True)
    a.region([(41, -3), (55, -3), (55, 4), (41, 3.5)], 'R', rough=0.6, seed=22, force=True)
    # the fallen statue in the west woods and the camp
    a.blob(10, 30, 5, 3.6, ',', rough=0.3, seed=15, force=True)
    a.mark('statue', [(8, 30), (9, 30), (10, 30), (11, 30), (9, 29)], 'a FALLEN COLOSSAL STATUE of a robed figure lying on its side, cracked and mossy, its face worn smooth', (180, 176, 164))
    a.stroke([(18, 22), (14, 27), (11, 31.5)], 1.4, ':', seed=9)
    a.blob(21, 14, 3.5, 2.6, ',', rough=0.3, seed=16, force=True)
    # the thousand-year tree's crown (SW corner)
    ct = [(x, y) for x in range(0, 9) for y in range(36, 44) if (x - 3) ** 2 + (y - 41) ** 2 < 30]
    a.mark('elder', ct, 'the CROWN OF THE THOUSAND-YEAR TREE rising over the forest: a colossal ancient tree crown, far bigger than any other, layered dark leaves with a faint silvery sheen', (20, 60, 36), ch='F')
    a.scatter('r', 0.012, only=',;"', seed=31, clear=1)
    a.scatter('b', 0.012, only=',;"', seed=32, clear=1)
    a.tidy()
    a.exit('e', 30, 31, {'map': 'f_fern', 'spawn': 'west'}, 'east')
    a.exit('n', 12, 13, {'map': 'yura', 'spawn': 'gate'}, 'yura')
    a.exit('n', 39, 40, {'map': 'world', 'spawn': 'f_windhill_n'}, 'pass')['cond'] = {'not': {'slice': True}}
    a.spawns['yura'] = dict(x=12, y=2, dir='s')
    a.objects += [
        dict(type='examine', x=34, y=13, event='windhill_notes'),
        dict(type='sign', x=30, y=19, text='風鳴りの丘\n風が歌のように鳴るという。'),
        dict(type='examine', x=10, y=31, event='world_poi_forest_statue'),
        dict(type='prop', id='tent', x=20, y=13), dict(type='prop', id='lantern', x=22, y=13),
        dict(type='sign', x=15, y=6, text='北 → 苔の村ユーラ'),
        dict(type='sign', x=42, y=6, text='北の峠を越えて\n↑ 雪の村ユール'),
        dict(type='prop', id='beacon', x=3, y=40, cond='cleared_r_forest'),
        dict(type='waylamp', id='wl_15', x=15, y=19, lit=True),
        dict(type='chest', id='f_windhill_c1', x=47, y=15, item='i_ether', n=1),
    ]
    a.meta = dict(name='風鳴りの丘', sub='ユーラと北の峠への道', region='r_forest', worldRect=[40, 128, 92, 124], outside='forest_dark',
                  zones=[{'rect': None, 'zone': 'zw_forest'}],
                  tilePatches=[{'cond': {'slice': True}, 'rect': [38, 1, 4, 2], 'rows': ['rrrr', 'rrrr']}],
                  npcs=[{'id': 'guard_north', 'look': 'npc_guard_1', 'name': '番人', 'x': 41, 'y': 4, 'dir': 's', 'move': 'still', 'pushable': False,
                         'cond': {'slice': True}, 'talk': {'lines': [{'text': ['北の峠は、雪崩で\nふさがってしまったんだ。', '雪原へ行くのは、\n雪が落ちつくまで待ってくれ。']}]},
                         'reward': 'news', 'key': 'world_guard_north'}],
                  links={'yura': {'map': 'f_windhill', 'spawn': 'yura'}})
    return a


AREAS = {'f_roa': f_roa, 'f_cape': f_cape, 'f_lookout': f_lookout, 'f_cross': f_cross, 'f_hut': f_hut, 'f_fern': f_fern, 'f_south': f_south, 'f_windhill': f_windhill}

if __name__ == '__main__':
    for aid in sys.argv[1:]:
        a = AREAS[aid]()
        a.save(aid)
        print(a.ascii())
        # connectivity: every exit / spawn reachable from the first spawn
        sp = list(a.spawns.values())
        seen = a.reach(sp[0]['x'], sp[0]['y'])
        for k, s in a.spawns.items(): print('spawn', k, s, 'reach', bool(seen[s['y'], s['x']]))
        for o in a.objects:
            x, y = o['x'], o['y']
            nb = [(x + dx, y + dy) for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)) if a.inb(x + dx, y + dy)]
            print('obj', o['type'], o.get('id') or o.get('event') or '', (x, y), a.g[y, x], 'reach', any(seen[j, i] for i, j in nb))
        print('walkable', int(a.walk().sum()), 'reached', int(seen.sum()))
