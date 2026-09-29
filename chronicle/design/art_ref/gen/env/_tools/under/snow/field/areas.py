"""Layouts of the painted FIELD areas of the snowfield r_snow (ノルデン雪原; area-switching field like the demo, owner 2026-09-28:
each area is one painting). Same primitives and legend characters as the demo (../../field/lib.py), read with the snow materials
(src/maps/snow_field_00_kit.js):
  walkable  ,  snow             ;  wind-rippled snow / low drifts   "  snow with frozen grass tufts   .  packed-snow road   :  footpath
            s  solid ice (lake / floe ice, walkable)   =  wooden bridge   c  flagstones (shrine floor)
  blocked   ~  dark icy sea     w  open water (thin-ice lake, hot springs, stream)   T  snow-laden fir   F  dense snowy fir forest
            b  snowy shrubs     r  rocks / crags     R  ice cliff / snowbank face     X  built / landmark
usage: python3 areas.py <id> [...]   -> <id>/layout.json + ascii on stdout (then guide.py <id>)
Map ids: f_snowpass f_lake f_peakfoot f_eastroad f_passinn f_floe (v2/src/maps/snow_field_*.js, tomap.py here)."""
import sys, os, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'field'))
import numpy as np
from scipy import ndimage
from lib import Area, fbm, WALK

STONE = (214, 214, 222)    # pale stone landmarks
WOOD = (150, 88, 44)       # timber
ICE = (150, 210, 240)      # ice landmarks
BONE = (236, 228, 200)     # old bone
ZONE = [{'rect': None, 'zone': 'zw_snow'}]


def base_snow(a, s1=5, s2=6):
    W, H = a.W, a.H
    a.mask_fill(fbm(a.seed + s1, W, H, 6) > 0.56, ';')
    a.mask_fill(fbm(a.seed + s2, W, H, 4) > 0.74, '"', only=',;')


def f_snowpass():
    """凍て風の峠: the pass out of the great forest into the snowfield. The road climbs north through a canyon between ice-glazed crags
    (west massif, east massif), past an avalanche boulder field, a frozen waterfall with its frozen pool on the east cliff, an old stone
    cairn with a weathered prayer post at the hairpin, the roofless ruin of a stone watch hut (travellers shelter), the trapper's camp in a
    side hollow (W), snowy fir forest along the south (the forest side). Roads: S -> f_windhill (pass), N -> f_lake (south)."""
    a = Area('f_snowpass', 48, 44, 101)
    W, H = a.W, a.H
    base_snow(a)
    ys, xs = np.mgrid[0:H, 0:W]
    # the forest side (S): snowy firs along the bottom, thinning out upwards
    a.region([(-2, 37), (10, 38.5), (18, 40.5), (30, 41), (38, 39), (50, 37.5), (50, 46), (-2, 46)], 'F', rough=1.4, seed=1)
    # the two massifs (crags, not walkable), their canyon faces (ice cliffs)
    west = a.region([(-2, -2), (14, -2), (16, 6), (13, 12), (15, 17), (11, 23), (6, 26.5), (-2, 27.5)], 'r', rough=1.3, seed=2, force=True)
    east = a.region([(34, -2), (50, -2), (50, 24), (44, 26), (40, 22.5), (37, 17), (38.5, 10), (35.5, 4)], 'r', rough=1.3, seed=3, force=True)
    for m in (west, east):
        a.mask_fill(ndimage.binary_dilation(m, iterations=1) & ~m & (ys < 30), 'R', only=',;"')
    # the road: S edge -> hairpin -> through the boulder field -> N edge
    road = [(23.5, 44.5), (23.5, 39), (26, 34), (29.5, 30.5), (28.5, 26), (22.5, 23.5), (20, 19), (22.5, 14), (26.5, 10), (25.5, 5), (24.5, -1)]
    a.stroke(road, 2.0, '.', wobble=0.2, seed=6)
    # avalanche boulder field (between the massifs, around the road's middle)
    rnd = np.random.RandomState(7)
    for _ in range(26):
        x, y = rnd.uniform(17, 36), rnd.uniform(12, 22)
        a.put(int(x), int(y), 'r')
    # the frozen waterfall on the east cliff and its frozen pool at the foot (landmark, not walkable)
    fall = [(37, 12), (37, 13), (37, 14), (38, 12), (38, 13), (38, 14)]
    a.mark('icefall', fall, 'a tall FROZEN WATERFALL: a curtain of pale blue ice and huge icicles pouring down the east cliff face, frozen mid-fall', ICE)
    a.mark('pool', [(35, 15), (36, 15), (37, 15), (38, 15), (36, 16), (37, 16)], 'the FROZEN POOL at the foot of the icefall: smooth blue-green ice rimmed by snowy boulders and broken icicles', (110, 190, 220))
    # the cairn with the prayer post at the hairpin (walkable ground around it)
    a.blob(31, 31, 2.5, 1.8, ',', rough=0.2, seed=11, force=True)
    a.mark('cairn', [(32, 30)], 'an old STONE CAIRN of stacked flat stones with a weathered wooden PRAYER POST on top, faded cloth strips frozen stiff', (170, 160, 150))
    # the roofless ruin of the stone watch hut (W of the road below the boulder field), a doorway gap on its east side
    a.rect(13, 20, 5, 4, 'c', force=True, keep=True)
    hut = [(13, 20), (14, 20), (15, 20), (16, 20), (17, 20), (13, 21), (13, 22), (13, 23), (14, 23), (15, 23), (16, 23), (17, 23), (17, 21)]
    a.mark('hut', hut, 'the roofless RUIN of a small stone WATCH HUT: waist-high snow-capped fieldstone walls around a flagstone floor, a doorway gap on its east side', (150, 146, 140))
    a.stroke([(18, 22), (20.5, 21)], 1.4, ':', force=True)
    # the trapper's hollow (SW, among the trees), a footpath to it from the road
    a.blob(10, 33, 4.2, 2.6, ',', rough=0.25, seed=12, force=True)
    a.stroke([(23.5, 38), (17, 36), (12, 34)], 1.4, ':', force=True)
    # scattered firs on the snow, rocks
    for (x, y, rx, ry, s_) in [(6, 36.5, 1.6, 1.2, 21), (40, 31, 2.2, 1.5, 22), (18, 29, 1.6, 1.3, 23), (32, 36, 1.8, 1.2, 24), (44, 31, 1.6, 1.2, 25)]:
        a.blob(x, y, rx, ry, 'T', rough=0.35, seed=s_, only=',;"')
    a.scatter('T', 0.02, only=',;"', seed=31, clear=1)
    a.scatter('r', 0.012, only=',;"', seed=32, clear=1)
    a.tidy()
    a.exit('s', 23, 24, {'map': 'f_windhill', 'spawn': 'pass'}, 'south')
    a.exit('n', 24, 25, {'map': 'f_lake', 'spawn': 'south'}, 'north')
    a.objects += [
        dict(type='sign', x=21, y=39, text='北の峠を越えて\n↑ 雪の村ユール'),
        dict(type='examine', x=31, y=31, event='snow_pass_cairn'),
        dict(type='examine', x=18, y=22, event='snow_pass_hut'),
        dict(type='waylamp', id='wl_snow_39_43', x=26, y=40, lit=True),
        dict(type='waylamp', id='wl_snow_39_38', x=24, y=8, lit=True),
        dict(type='prop', id='tent', x=8, y=32), dict(type='prop', id='firewood', x=9, y=34), dict(type='prop', id='lantern', x=7, y=33),
        dict(type='chest', id='f_snowpass_c1', x=15, y=21, item='i_ether', n=1),
    ]
    a.meta = dict(name='凍て風の峠', sub='森から雪原へ越える峠', region='r_snow', worldRect=[98, 104, 44, 40], outside='wall_snow',
                  zones=ZONE, weather='blizzard',
                  npcs=[{'id': 'snow_trapper', 'look': 'npc_snow_man', 'name': 'わな猟師', 'x': 11, 'y': 33, 'dir': 's', 'move': 'still',
                         'talk': 'world_snow_trapper', 'reward': 'hint', 'key': 'world_snow_trapper'}],
                  links={})
    return a


def f_lake():
    """凍った湖: the great lake west of Yule. This year the ice is thin: dark open water with floating ice plates and slush; a ring of
    solid shore ice; a rocky islet with a lone dead wind-bent tree; after the region is solved the lake freezes hard and an ICE ROAD
    crosses it north to the floe (the painting shows the ice road; before, a closed layer shows open water over it).
    The west shore is a wall of ICICLE CLIFFS with the mouth of the icicle corridor; a camp on the north-west shore; frozen reeds; the
    road from the pass (S) runs along the south-east shore to Yule's west gate (E edge: the village's log palisade and gate posts)."""
    a = Area('f_lake', 56, 44, 202)
    W, H = a.W, a.H
    base_snow(a)
    ys, xs = np.mgrid[0:H, 0:W]
    # the lake: open dark water reaching the north edge in the middle
    lake = a.region([(14, -3), (39, -3), (38, 5), (42, 12), (38.5, 19), (33, 23.5), (25, 25), (18, 22.5), (14.5, 16), (15.5, 6)], 'w', rough=1.3, seed=3)
    d_out = ndimage.distance_transform_edt(~lake)
    a.mask_fill(~lake & (d_out <= 1.5) & (ys < 30), 's', force=True)   # the shore ice shelf (walkable)
    # the rocky islet with the dead tree
    a.blob(33, 13, 2.2, 1.6, 'r', rough=0.2, seed=4, force=True)
    a.mark('deadtree', [(33, 13)], 'a lone DEAD WIND-BENT TREE, bare grey branches glazed with ice, on a rocky islet in the lake', (120, 110, 100))
    # the west: icicle cliffs (a high ice wall), the corridor mouth
    cl = a.region([(-3, -3), (7, -3), (6, 8), (8, 18), (6.5, 28), (8, 35), (5, 40), (-3, 42)], 'r', rough=1.0, seed=5, force=True)
    a.mask_fill(ndimage.binary_dilation(cl, iterations=1) & ~cl, 'R', only=',;"s')
    mouth = [(7, 30), (8, 30)]
    a.mark('cave', [(6, 29), (7, 29), (8, 29), (9, 29), (6, 30), (9, 30)], 'the ICICLE CLIFFS around the mouth of the ice corridor: a wall of blue glacier ice hung with enormous icicles like organ pipes', ICE)
    a.mark('door', mouth, 'the dark MOUTH of the ice corridor: a tall cave opening in the blue ice wall, fringed with icicles', (30, 40, 60))
    a.blob(10, 31.5, 2.6, 1.6, ',', rough=0.2, seed=6, force=True)
    a.rect(6, 31, 5, 1, ',', force=True, keep=True)
    # the road: S edge -> north-east -> Yule's west gate (E edge)
    a.stroke([(27.5, 44.5), (28, 39), (32, 35), (38, 33.5), (45, 32.5), (50, 31), (56.5, 30.5)], 2.0, '.', wobble=0.2, seed=7)
    # footpath west along the south shore to the icicle corridor
    a.stroke([(28, 37), (22, 35.5), (16, 33), (11, 31.5)], 1.4, ':', force=True)
    # the ice road (painted; closed by the tilePatch before the region is solved): south shore -> N edge
    ice = a.stroke([(29.5, 31), (29, 26), (28, 20), (27.5, 12), (26.5, 4), (26.5, -1)], 2.0, 's', force=True)
    icecells = sorted(c for c in ice if a.inb(*c) and lake[c[1], c[0]])
    # Yule's west palisade and gate posts along the east edge (gap = the road)
    pal = [(54, y) for y in range(18, 43) if y not in (29, 30, 31, 32)] + [(55, y) for y in range(18, 43) if y not in (29, 30, 31, 32)]
    a.mark('palisade', pal, "the snow village's LOG PALISADE: sharpened log stakes capped with snow, ice lanterns hung on it", WOOD)
    a.mark('gate', [(53, 28), (53, 33)], 'the two big carved GATE POSTS of the village gate, frost-covered', (120, 70, 36))
    # frozen reeds (shrubs) along the south shore, firs, rocks
    a.ring(lake, 'b', 1, only=',;"')
    a.mask_fill(ndimage.binary_dilation(lake, iterations=3) & ~ndimage.binary_dilation(lake, iterations=2) & (fbm(9, W, H, 3) > 0.55), 'b', only=',;"')
    a.region([(-3, 38), (20, 39), (30, 42), (52, 40), (58, 44), (58, 47), (-3, 47)], 'F', rough=1.4, seed=8, only=',;"b')
    a.region([(46, -3), (58, -3), (58, 16), (50, 15), (47, 8)], 'F', rough=1.3, seed=9, only=',;"b')
    for (x, y, rx, ry, s_) in [(38, 38, 2.2, 1.4, 21), (47, 24, 2.0, 1.6, 22), (17, 38, 1.8, 1.2, 23), (50, 20, 1.5, 1.2, 24)]:
        a.blob(x, y, rx, ry, 'T', rough=0.35, seed=s_, only=',;"b')
    a.scatter('T', 0.018, only=',;"', seed=31, clear=1)
    a.scatter('r', 0.01, only=',;"', seed=32, clear=1)
    # keep the ice road cells as ice (the reeds ring may have been put over them)
    for (x, y) in ice:
        if a.inb(x, y): a.g[y, x] = 's'
    a.tidy()
    for (x, y) in icecells: a.g[y, x] = 's'
    a.exit('s', 27, 28, {'map': 'f_snowpass', 'spawn': 'north'}, 'south')
    a.exit('e', 30, 31, {'map': 'yule', 'spawn': 'gate_w'}, 'yule')
    a.exit('n', 26, 27, {'map': 'f_floe', 'spawn': 'south'}, 'north')['cond'] = 'cleared_r_snow'
    a.spawns['icicle'] = dict(x=8, y=31, dir='s')
    a.objects += [
        dict(type='door', x=7, y=30, w=2, look='none', to={'map': 'icicle_1', 'spawn': 'entrance'}),
        dict(type='sign', x=11, y=33, text='つららの回廊\n氷の中に、何かが閉じこめられている。'),
        dict(type='sign', x=32, y=36, text='凍った湖\n今年は氷が薄い。渡るべからず。'),
        dict(type='examine', x=31, y=34, event='world_snow_lake'),
        dict(type='prop', id='sled', x=26, y=34), dict(type='prop', id='ice_hole', x=36, y=25),
        dict(type='prop', id='ice_crystal', x=10, y=27), dict(type='prop', id='ice_crystal', x=12, y=30),
        dict(type='waylamp', id='wl_snow_26_37', x=19, y=36, lit=True),
        dict(type='waylamp', id='wl_snow_42_32', x=44, y=35, lit=True),
        dict(type='prop', id='tent', x=10, y=18), dict(type='prop', id='firewood', x=11, y=19), dict(type='prop', id='lantern', x=9, y=18),
        dict(type='examine', x=13, y=21, event='snow_mat', mat='snow_mat_ice'),
    ]
    tp = {}
    for (x, y) in icecells: tp[(x, y)] = 'w'
    x0, x1 = min(x for x, y in tp), max(x for x, y in tp); y0, y1 = min(y for x, y in tp), max(y for x, y in tp)
    rows = [''.join(tp.get((x, y), ' ') for x in range(x0, x1 + 1)) for y in range(y0, y1 + 1)]
    a.meta = dict(name='凍った湖', sub='ユールの西の湖と、つららの崖', region='r_snow', worldRect=[60, 44, 84, 64], outside='wall_snow',
                  zones=ZONE, weather='snow', weatherCond='!cleared_r_snow',
                  tilePatches=[{'cond': {'not': 'cleared_r_snow'}, 'rect': [x0, y0, x1 - x0 + 1, y1 - y0 + 1], 'rows': rows}],
                  npcs=[], links={'yule_w': {'map': 'f_lake', 'spawn': 'yule'}, 'icicle': {'map': 'f_lake', 'spawn': 'icicle'}})
    return a


def f_peakfoot():
    """白竜の峰のふもと: the wind-swept snowfield between Yule's north gate and the dragon massif. The road runs north from the village
    (S edge: the north palisade and the watch-bell tower's shadow) to the PEAK GATE, a great stair and stone arch cut into the foot of the
    massif's ice cliff (the massif fills the top); half-way the colossal RIB BONES of an ancient dragon rise from the snow beside the
    road; the frozen SOLSTICE SHRINE, a ring of standing stones around a stone fire bowl on flagstones (the beacon after the solve);
    groves of firs, wind-carved snow, rocks."""
    a = Area('f_peakfoot', 48, 42, 303)
    W, H = a.W, a.H
    base_snow(a)
    ys, xs = np.mgrid[0:H, 0:W]
    # the massif across the top, its ice-cliff foot
    mas = a.region([(-3, -3), (51, -3), (51, 7.5), (42, 9.5), (33, 8), (24, 9), (15, 7), (6, 8.5), (-3, 7.5)], 'r', rough=1.3, seed=2, force=True)
    face = ndimage.binary_dilation(mas, iterations=2) & ~mas
    a.mask_fill(face, 'R', only=',;"')
    # the peak gate: a stone arch and stair into the cliff (door on the stair top), a small flagstone forecourt
    gx = 30
    a.rect(gx - 2, 11, 6, 3, 'c', force=True, keep=True)
    a.mark('arch', [(gx - 1, 8), (gx, 8), (gx + 1, 8), (gx + 2, 8), (gx - 1, 9), (gx + 2, 9), (gx - 1, 10), (gx + 2, 10)],
           'the PEAK GATE: a massive ancient stone ARCH carved with a coiled dragon, set into the foot of the ice cliff', STONE)
    a.mark('door', [(gx, 9), (gx + 1, 9), (gx, 10), (gx + 1, 10)], 'the dark passage behind the arch: worn stone STAIRS climbing up into the mountain (the entrance)', (40, 40, 56))
    # the road: S edge (Yule's north gate) -> north -> the gate
    a.stroke([(23.5, 42.5), (23, 36), (21, 30), (22.5, 24), (26.5, 18.5), (30.5, 14), (30.5, 12)], 2.0, '.', wobble=0.2, seed=6)
    # the dragon bones (W of the road): a ring of huge curved ribs and the skull
    bones = [(12, 21), (14, 20), (16, 20), (18, 21), (12, 25), (14, 26), (16, 26), (18, 25), (9, 23), (10, 23)]
    a.blob(14.5, 23, 5.5, 3.6, ',', rough=0.2, seed=11, force=True)
    a.mark('bones', bones, 'the colossal RIB BONES of an ancient dragon arching up out of the snow in two rows (walk between them), its huge horned SKULL half buried at the west end, bones weathered ivory and frosted', BONE)
    a.stroke([(21.5, 27), (18, 23.5), (15, 23)], 1.4, ':', force=True)
    # the solstice shrine (E of the road): flagstones, a ring of standing stones, the fire bowl
    cx, cy = 37, 25
    a.blob(cx, cy, 4.8, 3.6, ',', rough=0.2, seed=12, force=True)
    a.blob(cx, cy, 3.0, 2.2, 'c', rough=0.1, seed=13, force=True)
    for (x, y) in [(cx, cy)] + [(cx + dx, cy + dy) for dx in range(-3, 4) for dy in range(-2, 3)]:
        if a.inb(x, y): a.keep[y, x] = True
    st = [(int(round(cx + 3.6 * math.cos(t))), int(round(cy + 2.8 * math.sin(t)))) for t in [i * 2 * math.pi / 6 + 0.5 for i in range(6)]]
    a.mark('stones', st, 'a ring of six tall SNOW-CAPPED STANDING STONES carved with flame runes', (190, 190, 200))
    a.mark('bowl', [(cx, cy)], 'a round carved STONE FIRE BOWL on a low plinth in the middle of the ring (cold, filled with snow)', (130, 120, 112))
    a.stroke([(24.5, 26), (30, 25.5), (33.5, 25)], 1.4, ':', force=True)
    # Yule's north palisade stubs at the bottom edge
    pal = [(x, H - 1) for x in list(range(12, 21)) + list(range(27, 36))] + [(x, H - 2) for x in (20, 27)]
    a.mark('palisade', pal, "the snow village's LOG PALISADE seen from outside, sharpened snow-capped stakes", WOOD)
    # groves and rocks
    for (x, y, rx, ry, s_) in [(6, 32, 3.0, 2.2, 21), (42, 34, 3.2, 2.4, 22), (8, 14, 2.6, 1.8, 23), (41, 15, 2.4, 1.6, 24), (30, 33, 1.6, 1.2, 25)]:
        a.blob(x, y, rx, ry, 'T', rough=0.35, seed=s_, only=',;"')
    a.region([(-3, 36), (8, 38), (11, 43), (-3, 43)], 'F', rough=1.0, seed=7, only=',;"T')
    a.region([(40, 43), (41, 39), (51, 37), (51, 43)], 'F', rough=1.0, seed=8, only=',;"T')
    a.scatter('T', 0.018, only=',;"', seed=31, clear=1)
    a.scatter('r', 0.012, only=',;"', seed=32, clear=1)
    a.tidy()
    a.exit('s', 23, 24, {'map': 'yule', 'spawn': 'gate_n'}, 'yule')
    a.spawns['peak'] = dict(x=30, y=11, dir='s')
    a.objects += [
        dict(type='door', x=gx, y=10, w=2, look='none', to={'map': 'peak_1', 'spawn': 'south'}),
        dict(type='sign', x=27, y=13, text='白竜の峰\n吹雪の奥に、竜が眠るという。'),
        dict(type='examine', x=10, y=23, event='snow_foot_bones'),
        dict(type='examine', x=cx, y=cy, event='snow_foot_shrine'),
        dict(type='prop', id='beacon', x=cx, y=cy, cond='cleared_r_snow'),
        dict(type='waylamp', id='wl_snow_48_17', x=25, y=31, lit=True),
        dict(type='waylamp', id='wl_snow_55_17', x=34, y=18, lit=True),
        dict(type='prop', id='ice_crystal', x=26, y=13), dict(type='prop', id='snow_lamp', x=34, y=13),
        dict(type='chest', id='f_peakfoot_c1', x=16, y=24, item='i_revive', n=1),
    ]
    a.meta = dict(name='白竜の峰のふもと', sub='竜の骨と冬至の祠', region='r_snow', worldRect=[134, 16, 64, 52], outside='wall_snow',
                  zones=ZONE, weather='snow', weatherCond='!cleared_r_snow',
                  npcs=[{'id': 'snow_scout', 'look': 'npc_snow_watch', 'name': '見回りの若者', 'x': 25, 'y': 20, 'dir': 's', 'move': 'still',
                         'talk': 'world_snow_scout', 'reward': 'boss', 'key': 'world_snow_scout'}],
                  links={'yule_n': {'map': 'f_peakfoot', 'spawn': 'yule'}, 'peak': {'map': 'f_peakfoot', 'spawn': 'peak'}})
    return a


def f_eastroad():
    """灯守りの街道: the road from Yule's east gate to the pass inn through a snowy pine forest. A frozen stream crossed by a timber bridge;
    the three dead way-lamps of 【灯りを守る】 along the road; the ice-tail fox's tracks by a hollow fallen log; the pilgrim's camp; a
    woodcutter's lean-to; the path south into the dark snow woods (S edge). Roads: W -> Yule (east gate), E -> f_passinn, S -> snow_woods."""
    a = Area('f_eastroad', 56, 40, 404)
    W, H = a.W, a.H
    base_snow(a)
    ys, xs = np.mgrid[0:H, 0:W]
    # the forest: dense firs top and bottom, a broad snowy clearing band along the road
    a.region([(-3, -3), (59, -3), (59, 8), (44, 10), (33, 7.5), (20, 9.5), (8, 7), (-3, 8)], 'F', rough=1.8, seed=1)
    a.region([(-3, 30), (14, 29), (22, 32), (27, 36), (33, 36), (38, 30.5), (50, 31), (59, 29), (59, 43), (-3, 43)], 'F', rough=1.6, seed=2)
    # the road: W edge -> E edge, gently winding
    a.stroke([(-1, 16.5), (8, 17), (16, 19.5), (24, 19.5), (31, 17.5), (38, 18.5), (46, 21.5), (52, 22.5), (56.5, 22.5)], 2.0, '.', wobble=0.2, seed=6)
    # the path south into the woods (S edge)
    a.stroke([(24, 19.5), (27, 24), (29.5, 30), (30.5, 36), (30.5, 40.5)], 1.6, ':', force=True)
    # the frozen stream from N to S crossing the road, the timber bridge
    creek = [(40, -1), (39, 6), (41.5, 12), (40.5, 18.5), (42.5, 25), (41.5, 31), (43, 41)]
    a.stroke(creek, 1.6, 'w', keep=True, force=True, only=',;"rTbF')
    a.stroke(creek, 1.6, '=', keep=True, force=True, only='.')
    # Yule's east palisade at the W edge (gap = the road)
    pal = [(0, y) for y in range(6, 32) if y not in (15, 16, 17, 18)] + [(1, y) for y in range(6, 32) if y not in (15, 16, 17, 18)]
    a.mark('palisade', pal, "the snow village's LOG PALISADE: sharpened log stakes capped with snow", WOOD)
    # the hollow fallen log with the fox tracks (N of the road)
    a.mark('log', [(33, 13), (34, 13), (35, 13)], 'a huge HOLLOW FALLEN FIR LOG half buried in snow, a small dark opening at its east end', (110, 80, 56))
    a.stroke([(31, 17), (32.5, 14.5)], 1.2, ':', force=True)
    # the pilgrim's camp (N of the road, W part) and the woodcutter's lean-to (S of the road, E part)
    a.blob(14, 13, 3.6, 2.2, ',', rough=0.2, seed=11, force=True)
    a.mark('leanto', [(47, 26), (48, 26), (49, 26)], "a WOODCUTTER'S LEAN-TO: a slanted roof of bark and fir boughs on posts, split logs stacked under it", (130, 96, 60))
    a.blob(48, 28, 2.8, 1.4, ',', rough=0.2, seed=12, force=True)
    # a huge ancient fir by the road (landmark)
    a.mark('bigfir', [(20, 22), (21, 22), (20, 23), (21, 23)], 'a GIANT ANCIENT FIR, far taller than the rest, its broad snow-laden boughs spreading a tile beyond this block', (40, 90, 60), ch='T')
    for (x, y, rx, ry, s_) in [(8, 24, 2.4, 1.6, 21), (36, 25, 2.0, 1.5, 22), (52, 15, 2.2, 1.6, 23), (26, 12, 1.6, 1.2, 24), (16, 27, 1.8, 1.2, 25)]:
        a.blob(x, y, rx, ry, 'T', rough=0.35, seed=s_, only=',;"')
    a.scatter('T', 0.03, only=',;"', seed=31, clear=1)
    a.scatter('r', 0.01, only=',;"', seed=32, clear=1)
    a.scatter('b', 0.01, only=',;"', seed=33, clear=1)
    a.tidy()
    a.exit('w', 16, 17, {'map': 'yule', 'spawn': 'gate_e'}, 'yule')
    a.exit('e', 22, 23, {'map': 'f_passinn', 'spawn': 'west'}, 'east')
    a.exit('s', 30, 31, {'map': 'snow_woods', 'spawn': 'south'}, 'woods')
    a.objects += [
        dict(type='sign', x=23, y=17, text='← ユール　　峠の宿 →\n↓ 雪の林'),
        dict(type='sign', x=28, y=33, text='雪の林\n薪になる倒木が多い。'),
        dict(type='examine', x=35, y=14, event='world_snow_fox'),
        dict(type='waylamp', id='wl_snow_1', x=12, y=21, lit='q_snow_lamps_1', event='snow_waylamp'),
        dict(type='waylamp', id='wl_snow_2', x=33, y=21, lit='q_snow_lamps_2', event='snow_waylamp'),
        dict(type='waylamp', id='wl_snow_3', x=50, y=20, lit='q_snow_lamps_3', event='snow_waylamp'),
        dict(type='waylamp', id='wl_snow_67_35', x=27, y=28, lit=True),
        dict(type='prop', id='tent', x=13, y=12), dict(type='prop', id='firewood', x=15, y=13), dict(type='prop', id='lantern', x=11, y=12),
        dict(type='examine', x=48, y=27, event='snow_mat', mat='snow_mat_coal'),
    ]
    a.meta = dict(name='灯守りの街道', sub='ユールと峠の宿をむすぶ森の道', region='r_snow', worldRect=[156, 64, 96, 60], outside='forest_dark',
                  zones=ZONE, weather='snow', weatherCond='!cleared_r_snow',
                  npcs=[{'id': 'snow_pilgrim', 'look': 'npc_snow_old_m', 'name': '峠越えの年寄り', 'x': 16, 'y': 14, 'dir': 's', 'move': 'still',
                         'talk': 'world_snow_pilgrim', 'reward': 'news', 'key': 'world_snow_pilgrim'}],
                  links={'yule_e': {'map': 'f_eastroad', 'spawn': 'yule'}, 'snow_woods': {'map': 'f_eastroad', 'spawn': 'woods'}})
    return a


def f_passinn():
    """湯けむりの峠: the high pass at the east end of the snowfield. Natural HOT SPRINGS steam among dark rocks and orange mineral
    terraces (no snow on the wet warm stone), the pass inn's timber gate at the top edge (N -> pass_inn), the road on east into a
    narrow gorge between crags (E edge -> the mountains; rockslide and a guard in the demo), a stone bridge over the warm stream that
    runs from the springs, crags and firs. Roads: W -> f_eastroad, N -> pass_inn, E -> the old world (mountains)."""
    a = Area('f_passinn', 52, 42, 505)
    W, H = a.W, a.H
    base_snow(a)
    ys, xs = np.mgrid[0:H, 0:W]
    # crags: the gorge walls in the east, rock along the bottom
    a.region([(36, -3), (55, -3), (55, 26.3), (47, 26.3), (41, 22), (37, 12)], 'r', rough=0.8, seed=2, force=True)
    a.region([(38, 45), (39, 36), (44, 32), (47, 30.6), (55, 30.6), (55, 45)], 'r', rough=0.8, seed=3, force=True)
    a.region([(-3, 36), (12, 37), (24, 39.5), (38, 38), (40, 45), (-3, 45)], 'F', rough=1.4, seed=4)
    # the hot springs (middle-south): pools with rock rims, warm wet stone around them
    pools = []
    for (x, y, rx, ry, s_) in [(18, 29, 3.0, 2.0, 11), (25, 31.5, 2.4, 1.6, 12), (13, 33, 2.2, 1.5, 13), (29, 27.5, 1.8, 1.3, 14)]:
        pools.append(a.blob(x, y, rx, ry, 'w', rough=0.25, seed=s_, force=True))
    P = np.any(pools, axis=0)
    a.mask_fill(ndimage.binary_dilation(P, iterations=2) & ~P, ':', force=True)
    a.mark('springs', [(x, y) for y in range(H) for x in range(W) if P[y, x]], 'natural HOT SPRING pools of milky turquoise water, steaming, edged by orange-and-cream mineral terraces and dark wet rock with no snow on them', (80, 200, 200), solid=False)
    # the warm stream from the springs east under the road, a stone bridge
    creek = [(29, 28), (33, 26), (35, 23.5), (36.5, 20.5), (35.5, 15), (37, 10), (36, -1)]
    a.stroke(creek, 1.4, 'w', keep=True, force=True, only=',;"rTbF:')
    # the road: W edge -> the inn gate branch -> E edge through the gorge
    a.stroke([(-1, 24.5), (8, 23.5), (16, 21), (24, 20.5), (32, 21.5), (40, 26), (46, 28.5), (52.5, 28.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(20, 21), (20.5, 14), (20.5, 6), (20.5, -1)], 2.0, '.', wobble=0.15, seed=7)
    a.stroke(creek, 1.4, '=', keep=True, force=True, only='.')
    for x in range(45, W):   # the gorge: three cells wide at the east edge (rows 27-29)
        for y in (25, 26, 30, 31):
            a.g[y, x] = 'r'; a.keep[y, x] = True
        for y in (27, 28, 29):
            a.g[y, x] = '.'; a.keep[y, x] = True
    # the inn's gate and fence at the top edge (gap = the road)
    fence = [(x, 0) for x in list(range(9, 19)) + list(range(23, 33))] + [(x, 1) for x in (18, 23)]
    a.mark('fence', fence, "the pass inn's TIMBER FENCE with a roofed GATE over the road, snow on its shingles, lanterns at the posts", WOOD)
    # the gorge walls either side of the east road are the crags; a cairn at the gorge mouth
    a.mark('cairn', [(38, 31)], 'a tall stone CAIRN marking the way into the gorge, capped with snow', (170, 160, 150))
    # firs, rocks, steam vents
    for (x, y, rx, ry, s_) in [(8, 14, 2.8, 2.0, 21), (30, 11, 2.4, 1.8, 22), (6, 30, 2.0, 1.4, 23), (28, 36, 1.6, 1.2, 24)]:
        a.blob(x, y, rx, ry, 'T', rough=0.35, seed=s_, only=',;"')
    a.region([(-3, -3), (8, -3), (7, 5), (-3, 7)], 'F', rough=1.0, seed=8, only=',;"')
    a.scatter('T', 0.02, only=',;"', seed=31, clear=1)
    a.scatter('r', 0.012, only=',;"', seed=32, clear=1)
    a.tidy()
    a.exit('w', 23, 24, {'map': 'f_eastroad', 'spawn': 'east'}, 'west')
    a.exit('n', 20, 21, {'map': 'pass_inn', 'spawn': 'gate'}, 'inn')
    a.exit('e', 28, 29, {'map': 'world', 'spawn': 'snow_east'}, 'east')['cond'] = {'not': {'slice': True}}
    a.objects += [
        dict(type='sign', x=18, y=5, text='宿場「峠の宿」\n湯気の立つ峠の宿。'),
        dict(type='sign', x=36, y=24, text='東 → ガルド山地\n西 → ユール'),
        dict(type='examine', x=21, y=31, event='snow_pass_springs'),
        dict(type='waylamp', id='wl_snow_80_35', x=10, y=21, lit=True),
        dict(type='prop', id='snow_lamp', x=18, y=2), dict(type='prop', id='snow_lamp', x=23, y=2),
        dict(type='chest', id='f_passinn_c1', x=11, y=31, item='i_incense', n=1),
        dict(type='examine', x=12, y=15, event='snow_mat', mat='snow_mat_berry'),
    ]
    a.meta = dict(name='湯けむりの峠', sub='峠の宿と、湯の湧く谷', region='r_snow', worldRect=[240, 70, 44, 44], outside='wall_snow',
                  zones=ZONE, weather='snow', weatherCond='!cleared_r_snow',
                  tilePatches=[{'cond': {'slice': True}, 'rect': [48, 27, 3, 3], 'rows': ['rrr'] * 3}],
                  npcs=[{'id': 'guard_snow_east', 'look': 'npc_guard_1', 'name': '番人', 'x': 47, 'y': 28, 'dir': 'w', 'move': 'still', 'pushable': False,
                         'cond': {'slice': True}, 'talk': {'lines': [{'text': ['この先の峠は、崖崩れで\nふさがっておる。', '山の鉱山町へ行くのは、\n道が片づくまで待ってくれ。']}]},
                         'reward': 'news', 'key': 'world_guard_snow_east'}],
                  links={'pass_inn': {'map': 'f_passinn', 'spawn': 'inn'}})
    return a


def f_floe():
    """北の流氷原: pack ice on the dark northern sea. Great floes of snow-covered ice with pressure ridges of tumbled ice blocks, black
    leads of open water between them crossed by narrow ice necks; the AURORA CLIFFS of blue glacier ice on the west with a cave; the
    ICE-LOCKED SHIP, a three-masted sailing ship frozen fast in the pack (NE), its gangplank on the ice; the sled landing (S) where the
    dog sled from Yule stops; the ice road from the frozen lake arrives at the S edge (after the region is solved)."""
    a = Area('f_floe', 52, 40, 606)
    W, H = a.W, a.H
    ys, xs = np.mgrid[0:H, 0:W]
    a.g[:, :] = '~'
    n = fbm(11, W, H, 5)
    floes = [(26, 33, 15, 7.5), (12, 21, 9, 6.5), (39, 10, 13, 7.5), (41, 26, 8.5, 5.5), (22, 8, 7, 5)]
    ice = np.zeros((H, W), bool)
    for (cx, cy, rx, ry) in floes:
        ice |= (((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2) < 1 + (n - 0.5) * 0.9
    ice = ndimage.binary_opening(ice, iterations=1)
    a.mask_fill(ice, ',', force=True)
    # pressure ridges (tumbled ice blocks) on the floes, small bergs in the leads
    for (pts, s_) in [([(17, 30), (22, 28), (27, 28.5)], 4), ([(35, 34), (40, 33)], 5), ([(8, 19), (13, 16)], 6), ([(44, 24), (47, 27)], 7)]:
        a.stroke(pts, 1.2, 'r', keep=False, force=True, only=',s')
    for (x, y) in [(32, 20), (4, 30), (48, 36), (29, 17), (50, 15)]:
        a.put(x, y, 'r', True)
    # the aurora cliffs (W): blue glacier ice wall, the cave
    cl = a.region([(-3, -3), (11, -3), (10, 5), (12, 10), (9, 14), (-3, 15)], 'r', rough=0.8, seed=7, force=True)
    a.mask_fill(ndimage.binary_dilation(cl, iterations=1) & ~cl & (ys < 17), 'R', only=',s~')
    a.rect(9, 10, 6, 4, ',', force=True)
    a.mark('aurora', [(9, 8), (10, 8), (11, 8), (12, 8), (9, 9), (12, 9)], 'the AURORA CLIFFS: a wall of translucent blue glacier ice glowing faintly from within, streaked with green and violet', ICE)
    a.mark('door', [(10, 9), (11, 9)], 'the dark mouth of an ICE CAVE in the glacier wall, its rim glittering with frost crystals', (30, 40, 70))
    # the ice-locked ship (NE): hull on the ice, the gangplank down to the ice on its south side
    ship = [(x, y) for x in range(32, 46) for y in range(3, 9)]
    a.blob(38.5, 6, 10.5, 5.8, 's', rough=0.25, seed=21, force=True)
    a.mark('ship', ship, 'an old THREE-MASTED SAILING SHIP frozen fast in the pack ice, seen from above: dark timber hull and deck, snow on the deck, frost-white rigging and furled sails, masts casting no shadow; its bow points east', (90, 64, 44))
    a.mark('door', [(38, 9)], 'the ship\'s GANGPLANK: a timber ramp from the ice up to an opening in the hull side', (40, 26, 16))
    # the landing (S): flat ice, the ice road arriving at the S edge
    a.blob(25.5, 35.5, 6.5, 4.2, 's', rough=0.25, seed=22, force=True)
    # the ice necks between the floes (the only ways across the leads)
    a.stroke([(26.5, 41), (26, 33), (21, 27.5), (16, 21), (13, 14), (12, 11.5)], 2.0, 's', keep=True, force=True, only='~,sr')
    a.stroke([(28, 30), (34, 27.5), (38, 25)], 2.0, 's', keep=True, force=True, only='~,sr')
    a.stroke([(41, 22), (40, 17), (38.5, 11)], 2.0, 's', keep=True, force=True, only='~,sr')
    a.tidy()
    a.exit('s', 26, 27, {'map': 'f_lake', 'spawn': 'north'}, 'south')['cond'] = 'cleared_r_snow'
    a.spawns['landing'] = dict(x=24, y=34, dir='n')
    a.spawns['aurora'] = dict(x=11, y=11, dir='s')
    a.spawns['ship'] = dict(x=38, y=11, dir='s')
    a.objects += [
        dict(type='door', x=10, y=9, w=2, look='none', to={'map': 'aurora', 'spawn': 'south'}),
        dict(type='door', x=38, y=9, look='none', to={'map': 'frost_ship_1', 'spawn': 'entrance'}),
        dict(type='sign', x=14, y=12, text='オーロラの崖\n空が七色に揺れる崖。'),
        dict(type='sign', x=36, y=12, text='氷に閉じた帆船\n――危険。強い魔物の気配がする。'),
        dict(type='examine', x=22, y=35, event='world_snow_floe_sled'),
        dict(type='prop', id='sled', x=21, y=35), dict(type='prop', id='snow_lamp', x=27, y=35),
        dict(type='prop', id='ice_crystal', x=9, y=12), dict(type='prop', id='ice_crystal', x=14, y=10),
    ]
    a.meta = dict(name='北の流氷原', sub='オーロラの海', region='r_snow', worldRect=[44, 4, 100, 36], outside='sea',
                  zones=[{'rect': None, 'zone': 'z_snow_floe'}], weather='snow',
                  npcs=[], links={'aurora': {'map': 'f_floe', 'spawn': 'aurora'}, 'frost_ship': {'map': 'f_floe', 'spawn': 'ship'},
                                  'floe': {'map': 'f_floe', 'spawn': 'landing'}})
    return a


AREAS = {'f_snowpass': f_snowpass, 'f_lake': f_lake, 'f_peakfoot': f_peakfoot, 'f_eastroad': f_eastroad, 'f_passinn': f_passinn, 'f_floe': f_floe}

if __name__ == '__main__':
    for aid in sys.argv[1:]:
        a = AREAS[aid]()
        a.save(aid)
        print(a.ascii())
        sp = list(a.spawns.values())
        seen = a.reach(sp[0]['x'], sp[0]['y'])
        for k, s in a.spawns.items(): print('spawn', k, s, a.g[s['y'], s['x']], 'reach', bool(seen[s['y'], s['x']]))
        for o in a.objects:
            x, y = o['x'], o['y']
            nb = [(x + dx, y + dy) for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)) if a.inb(x + dx, y + dy)]
            print('obj', o['type'], o.get('id') or o.get('event') or '', (x, y), a.g[y, x], 'reach', any(seen[j, i] for i, j in nb))
        for n in a.meta.get('npcs', []):
            print('npc', n['id'], (n['x'], n['y']), a.g[n['y'], n['x']], 'reach', bool(seen[n['y'], n['x']]))
        print('walkable', int(a.walk().sum()), 'reached', int(seen.sum()))
