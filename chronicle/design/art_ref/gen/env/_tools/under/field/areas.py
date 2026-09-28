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
    ]
    a.notes.append('zone zw_prologue (the whole area)')
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
    ]
    a.notes.append('zones: y < 16 zw_prologue (the Pharos road), the cape zw_peninsula')
    return a


AREAS = {'f_roa': f_roa, 'f_cape': f_cape}

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
