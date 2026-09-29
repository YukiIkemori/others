"""Layouts of the painted FIELD areas of the ash land (灰の荒野 r_ash; area switching like the demo's ../field/areas.py and the desert's
../field_desert/areas_desert.py).
usage: python3 areas_ash.py <id> [...]   -> <id>/layout.json + ascii on stdout (then guide.py <id>)
The areas replace the walk over the old world map inside the region (tools/gen_world_ash.js): every place, examine, door and traveller that
stood there is placed here with the same events. Map ids a_* (v2/src/maps/field_ash_*.js).
Chars: lib.py (ash copy): s grey ash ground, u ash drifts, k cooled black lava crust, . the ash road, : footpath, c basalt paving,
, moss / green grass (spa), ; dry ash scrub, T charred dead trees, b ash bushes, r boulders, R crags / cliffs, X built stone / landmarks,
w hot-spring water, ~ sea, _ warm shallows, = bridge, l LAVA (solid)."""
import sys, math
import numpy as np
from lib import Area, fbm, WALK

BASALT = (70, 66, 72)
STONE = (150, 146, 140)
RUST = (150, 96, 70)
DARK = (40, 26, 16)
BONE = (214, 206, 186)
ROAD_ZONE = 'zw_ash_road'
PLAIN_ZONE = 'zw_ash_plain'


def ash_ground(a, s1, s2, drift=0.56, crust=1.1):
    """grey ash with drifts (u) and patches of old cooled lava crust (k)"""
    W, H = a.W, a.H
    a.mask_fill(fbm(s1, W, H, 9) > drift, 'u', only='s')
    a.mask_fill(fbm(s2, W, H, 7) > crust, 'k', only='s')


def door(a, x, y, w=1):
    a.mark('door', [(x + i, y) for i in range(w)], 'a dark ENTRANCE', DARK, solid=False)
    a.rect(x, y, w, 1, ':', force=True, keep=True)


def road_band(pts, pad=2):
    """a zone rect around a road polyline [x, y, w, h]"""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0 = int(max(0, min(xs) - pad)), int(max(0, min(ys) - pad))
    return [x0, y0, int(max(xs) + pad) - x0 + 1, int(max(ys) + pad) - y0 + 1]


def a_pass():
    """灰かぶりの峠: the desert's east pass opens onto the ash land. Ash-dusted grey-brown crags N and S of the west entrance (the road
    from Kasim's east road), the old road dropping east onto grey ash drifts with the first charred trees; a traveller's camp in the lee
    of a big rock; a toppled basalt waygate arch by the road; the fork south to the old battlefield."""
    a = Area('a_pass', 52, 40, 1101, base='s')
    W, H = a.W, a.H
    ash_ground(a, 3, 4)
    # the crags of the pass (W), north and south of the road
    a.region([(-3, -3), (30, -3), (28, 3), (19, 5.5), (12, 9), (7, 15), (-3, 16.5)], 'R', rough=0.9, seed=1, force=True)
    a.region([(-3, 23.5), (6, 23), (10, 27), (9, 34), (14, 43), (-3, 43)], 'R', rough=0.9, seed=2, force=True)
    # a long ridge of crags along the north-east
    a.region([(34, -3), (55, -3), (55, 7), (47, 8.5), (41, 6.5), (36, 3)], 'R', rough=0.8, seed=3, force=True)
    # the big rock sheltering the camp, and outcrops
    for (x, y, rx, ry, s_) in [(19, 12, 2.6, 1.8, 11), (44, 29, 3.2, 2.2, 12), (35, 34, 2.0, 1.5, 13), (47, 16, 1.5, 1.3, 14)]:
        a.blob(x, y, rx, ry, 'R', rough=0.3, seed=s_)
    # charred trees in loose groups
    for (x, y, rx, ry, s_) in [(31, 11, 2.2, 1.6, 21), (39, 22, 1.6, 1.3, 22), (16, 31, 2.0, 1.4, 23), (48, 35, 2.4, 1.6, 24)]:
        a.blob(x, y, rx, ry, 'T', rough=0.5, seed=s_, only='suk')
    # the road: from the west pass east; the fork south to the battlefield
    road = [(-1, 19.5), (7, 19.5), (15, 18.5), (24, 19), (32, 17.5), (41, 18), (52.5, 18.5)]
    a.stroke(road, 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(26, 19.5), (27.5, 26), (25.5, 33), (25.5, 40.5)], 1.6, '.', wobble=0.2, seed=7)
    a.stroke([(18.5, 18.5), (17.5, 15)], 1.2, ':', seed=8)     # into the camp
    # the camp in the lee of the big rock (flat trodden ash)
    a.blob(17, 15, 3.0, 1.6, 'k', rough=0.2, seed=31, force=True, only='suk')
    a.rect(15, 14, 5, 2, 's', force=True, keep=True)
    # the toppled waygate arch (N of the road)
    a.mark('arch', [(35, 13), (36, 13), (37, 13), (35, 14), (37, 14)], 'a toppled ancient WAYGATE ARCH of black basalt blocks: two broken pillars and the fallen lintel half buried in ash, weathered carvings of a bird with spread wings', BASALT)
    a.scatter('r', 0.010, only='suk', seed=41, clear=1)
    a.scatter('b', 0.010, only='su', seed=42, clear=1)
    a.tidy()
    a.exit('w', 19, 20, {'map': 'd_east', 'spawn': 'pass'}, 'west')
    a.exit('e', 18, 19, {'map': 'a_lava', 'spawn': 'west'}, 'east')
    a.exit('s', 25, 26, {'map': 'a_battle', 'spawn': 'north'}, 'south')
    a.objects += [
        dict(type='sign', x=6, y=22, text='灰の荒野\n東 → 炎の町カルデラ'),
        dict(type='sign', x=29, y=22, text='南 → 灰の古戦場\n折れた剣の碑'),
        dict(type='waylamp', id='wl_a_pass_1', x=12, y=22, lit=True),
        dict(type='waylamp', id='wl_a_pass_2', x=40, y=21, lit=True),
        dict(type='prop', id='tent', x=14, y=10), dict(type='prop', id='lantern', x=12, y=11),
    ]
    a.meta = dict(name='灰かぶりの峠', sub='砂漠から灰の荒野へ抜ける峠', region='r_ash', worldRect=[285, 393, 96, 48], outside='rock',
                  zones=[{'rect': road_band(road, 2), 'zone': ROAD_ZONE}, {'rect': None, 'zone': PLAIN_ZONE}],
                  links={},
                  npcs=[{'id': 'ash_traveler', 'look': 'npc_traveler', 'name': '灰の荒野の旅人', 'x': 14, 'y': 12, 'dir': 's', 'move': 'still',
                         'talk': 'ash_world_traveler', 'reward': 'news', 'key': 'world_ash_traveler'}])
    return a


def a_battle():
    """折れた剣の古戦場: an ancient battlefield in a shallow ash basin south of the pass. Low crag rims around; clusters of rusted blades and
    spears stuck upright in the ash; burial cairns; a ruined stone watch-fort (outpost) with a broken gate and a paved yard; a dry old lava
    tongue; on a low mound in the south the monument of the broken sword."""
    a = Area('a_battle', 52, 40, 1202, base='s')
    W, H = a.W, a.H
    ash_ground(a, 5, 6, drift=0.6)
    # the basin rim (open to the north where the road comes in)
    a.region([(-3, -3), (21, -3), (20, 3), (9, 5), (4, 12), (3, 26), (6, 36), (18, 37.5), (34, 37), (46, 35), (48.5, 24), (47, 10), (41, 3.5), (31, 3), (30, -3), (55, -3), (55, 43), (-3, 43)], 'R', rough=0.9, seed=1, force=True)
    # the old lava tongue (cooled crust) across the east
    a.stroke([(46, 5), (41, 12), (39, 20), (41, 30)], 3.0, 'k', keep=False, wobble=0.8, seed=4, force=True, only='su')
    # the ruined outpost (W): a square of broken walls, the gate facing east, a paved yard inside
    fort = []
    for x in range(8, 19):
        for y in range(9, 20):
            edge = x in (8, 18) or y in (9, 19)
            if edge and not (x == 18 and y in (13, 14, 15)) and (x, y) not in ((8, 14), (12, 19), (13, 19), (8, 10)):
                fort.append((x, y))
    a.mark('fort', fort, 'the RUINED WALLS of a small square stone watch-fort seen from above: thick walls of grey stone blocks broken down to chest height in places, a collapsed corner tower, a wide gap of a lost gate in the east wall, rubble spilling into the ash', STONE)
    a.rect(9, 10, 9, 9, 'c', force=True)
    a.rect(19, 13, 2, 3, ':', force=True)
    for (x, y) in [(10, 11), (16, 17), (11, 17)]: a.put(x, y, 'r', True)
    # the monument mound (S): a low paved mound, the broken-sword stone in the middle
    a.blob(27, 29, 4.2, 2.8, 'c', rough=0.2, seed=21, force=True)
    a.mark('monument', [(27, 28)], 'a tall weathered STONE MONUMENT shaped like a huge BROKEN SWORD standing point-down, its blade snapped half way, on a small plinth', BONE)
    # clusters of rusted blades (solid little fields) and cairns
    blades = []
    for (cx, cy, n, s_) in [(24, 12, 5, 1), (33, 16, 6, 2), (22, 22, 5, 3), (35, 26, 5, 4), (15, 27, 4, 5), (31, 9, 4, 6)]:
        rnd = np.random.RandomState(s_ + 70)
        for _ in range(n):
            blades.append((int(cx + rnd.randint(-2, 3)), int(cy + rnd.randint(-1, 2))))
    blades = sorted(set(b for b in blades if a.g[b[1], b[0]] in 'suk'))
    a.mark('blades', blades, 'CLUSTERS OF RUSTED SWORDS, SPEARS AND BROKEN SHIELDS stuck upright in the ash (a small thicket of old weapons on each block)', RUST)
    a.scatter('r', 0.010, only='suk', seed=41, clear=1)
    a.scatter('T', 0.006, only='su', seed=42, clear=1)
    # the path from the north in to the mound, and to the fort gate
    a.stroke([(25.5, -1), (25, 8), (26, 16), (27, 22), (27, 26)], 1.6, ':', seed=7, force=True)
    a.stroke([(25, 12), (21, 14)], 1.2, ':', seed=8, force=True)
    a.tidy()
    a.exit('n', 25, 26, {'map': 'a_pass', 'spawn': 'south'}, 'north')
    a.objects += [
        dict(type='examine', x=27, y=28, event='ash_battlefield_stone'),
        dict(type='sign', x=23, y=4, text='灰の古戦場\n折れた剣の碑'),
        dict(type='chest', id='a_battle_c1', x=10, y=17, item='i_revive', n=1),
        dict(type='waylamp', id='wl_a_battle_1', x=29, y=5, lit=True),
    ]
    a.meta = dict(name='灰の古戦場', sub='折れた剣の眠る窪地', region='r_ash', worldRect=[285, 441, 96, 45], outside='rock',
                  zones=[{'rect': None, 'zone': PLAIN_ZONE}], links={}, npcs=[])
    return a


def a_lava():
    """溶岩の原: the heart of the waste between the pass and Caldera. A black plain of cooled ropey lava and grey ash; two glowing lava
    channels run south into a lava lake; the ash road crosses them on a raised basalt causeway; glassy obsidian ridges; the outer rim of
    the crater town Caldera with its carved west gate on the east edge; paths north to the hot-spring valley and south to the beach."""
    a = Area('a_lava', 60, 44, 1303, base='s')
    W, H = a.W, a.H
    ys, xs = np.mgrid[0:H, 0:W]
    # the black crust spreads from the lava (west / south-west); grey ash towards the town (east) — two big soft fields, no islands
    crust = fbm(3, W, H, 16) + (35 - xs) / 70.0 + (ys - 16) / 90.0
    a.mask_fill(crust > 0.62, 'k')
    a.mask_fill(fbm(4, W, H, 10) > 0.66, 'u', only='s')
    # the crater town's outer rim (E edge), the gate at rows 20-21
    rim = [(x, y) for x in range(55, 60) for y in range(0, 44) if not (y in (20, 21) and x >= 55)]
    a.region([(54.5, -3), (63, -3), (63, 47), (54.5, 47), (53.5, 35), (54, 20), (53.5, 8)], 'R', rough=0.5, seed=1, force=True)
    a.mark('gate', [(56, 18), (57, 18), (56, 23), (57, 23)], 'the carved stone GATE TOWERS of the crater town: squat black basalt towers flanking the road where it passes through a cut in the rock wall', BASALT)
    a.rect(54, 20, 6, 2, '.', force=True, keep=True)
    # obsidian ridges
    for (pts, s_) in [([(4, 6), (12, 3), (20, 5)], 11), ([(30, 30), (36, 27), (44, 28)], 12), ([(43, 7), (48, 11), (49, 16)], 13)]:
        a.stroke(pts, 2.4, 'R', keep=False, wobble=0.6, seed=s_, force=True)
    # the lava: two channels from the north-west falling into the lava lake (SW)
    a.stroke([(24, -2), (22.5, 6), (25, 13), (23.5, 20), (21, 27), (16, 33)], 2.6, 'l', keep=False, wobble=0.6, seed=21, force=True)
    a.stroke([(37, 24.5), (31.5, 26.5), (24, 31), (18, 34)], 1.8, 'l', keep=False, wobble=0.5, seed=22, force=True)
    a.blob(12, 36, 8.5, 5.0, 'l', rough=0.3, seed=23, force=True)
    a.blob(40, 12, 2.2, 1.6, 'l', rough=0.3, seed=24, force=True)
    # the road: W edge -> causeway over the channels -> the town gate
    road = [(-1, 20.5), (8, 20), (16, 20.5), (23, 20.5), (30, 20), (38, 21), (46, 20.5), (60.5, 20.5)]
    a.stroke(road, 2.0, '.', wobble=0.1, seed=6)
    br = [(x, y) for x in range(21, 27) for y in range(19, 22) if a.g[y, x] in 'l.' or True]
    a.mark('causeway', [(x, y) for (x, y) in br], 'a raised CAUSEWAY of fitted black basalt blocks with low kerbs, carrying the road over the glowing lava channel (the deck is walkable)', (120, 116, 122), solid=False)
    for (x, y) in br: a.put(x, y, 'c', True)
    for (x, y) in [(x, y) for x in range(21, 27) for y in (18, 22)]:
        if a.g[y, x] == 'l': a.put(x, y, 'R', True)
    # north path to the spa valley, south path to the beach (crosses the second channel on a crust ford)
    a.stroke([(14, 20), (15, 12), (17, 5), (17.5, -1)], 1.4, ':', seed=7, force=True)
    a.stroke([(44, 21), (45, 29), (48, 36), (48.5, 44.5)], 1.4, ':', seed=8, force=True)
    a.scatter('r', 0.008, only='suk', seed=41, clear=1)
    a.scatter('T', 0.004, only='su', seed=42, clear=1)
    a.tidy()
    a.exit('w', 20, 21, {'map': 'a_pass', 'spawn': 'east'}, 'west')
    a.exit('e', 20, 21, {'map': 'caldera', 'spawn': 'gate_w'}, 'caldera')
    a.exit('n', 17, 18, {'map': 'a_spa', 'spawn': 'south'}, 'north')
    a.exit('s', 48, 49, {'map': 'a_beach', 'spawn': 'lava'}, 'south')
    glow = [(12, 36), (8, 34), (16, 38), (23, 9), (24, 16), (33, 26), (22, 29), (40, 12)]
    a.objects += [
        dict(type='sign', x=10, y=23, text='溶岩の原\n道をはずれると、足もとが熱い。'),
        dict(type='sign', x=46, y=23, text='北西 → 湯けむりの谷\n南 → 火山ガメの浜\n東 → 炎の町カルデラ'),
        dict(type='sign', x=51, y=18, text='炎の町カルデラ\n――火口の段々と闘技場の町'),
        dict(type='waylamp', id='wl_a_lava_1', x=30, y=23, lit=True),
        dict(type='waylamp', id='wl_a_lava_gate', x=51, y=23, lit=True),
    ] + [dict(type='prop', id='lava_glow', x=x, y=y) for (x, y) in glow]
    a.painted_extra = ['lava_glow']
    a.meta = dict(name='溶岩の原', sub='カルデラの西の黒い原', region='r_ash', worldRect=[381, 393, 105, 93], outside='rock',
                  zones=[{'rect': road_band(road, 2), 'zone': ROAD_ZONE}, {'rect': None, 'zone': PLAIN_ZONE}],
                  links={'caldera': {'map': 'a_lava', 'spawn': 'caldera'}}, npcs=[])
    return a


def a_spa():
    """湯けむりの谷: a sheltered valley in the northern crags. Terraced turquoise hot-spring pools with pale mineral rims step down the
    valley among steaming rocks and green mossy ledges; the springs spill out of the dark mouth of an old lava tube in the north cliff;
    sulphur-yellow crusts; the path climbs in from the south."""
    a = Area('a_spa', 48, 40, 1404, base='s')
    W, H = a.W, a.H
    a.mask_fill(fbm(3, W, H, 7) > 0.55, ',')
    a.mask_fill(fbm(4, W, H, 6) > 0.7, ';', only='s')
    # the valley walls
    a.region([(-3, -3), (51, -3), (51, 43), (33, 43), (35, 36), (40, 30), (41, 20), (39, 10), (32, 6), (24, 5), (15, 6.5), (8, 12), (7, 22), (10, 31), (14, 37), (13, 43), (-3, 43)], 'R', rough=1.0, seed=1, force=True)
    # the lava tube mouth (N cliff) the water comes out of
    a.mark('tube', [(23, 5), (24, 5), (25, 5)], 'the dark round MOUTH OF AN OLD LAVA TUBE in the cliff, hot water and steam pouring out of it', DARK)
    # terraced pools (a chain from the tube down the valley) with the stream between
    pools = [(24, 9.5, 3.4, 2.0), (18, 14.5, 3.8, 2.2), (29, 17, 4.0, 2.4), (21, 22.5, 4.4, 2.4), (30, 26.5, 3.4, 2.0)]
    for i, (x, y, rx, ry) in enumerate(pools):
        a.blob(x, y, rx + 1.0, ry + 0.9, 'c', rough=0.15, seed=20 + i, force=True)   # the pale mineral rim (walkable ledge)
    for i, (x, y, rx, ry) in enumerate(pools):
        a.blob(x, y, rx, ry, 'w', rough=0.15, seed=30 + i, force=True)
    # steaming rocks
    for (x, y, rx, ry, s_) in [(13, 20, 1.6, 1.3, 41), (34, 12, 1.5, 1.2, 42), (15, 29, 1.8, 1.3, 43), (36, 22, 1.3, 1.1, 44)]:
        a.blob(x, y, rx, ry, 'R', rough=0.3, seed=s_)
    # the path up from the south, winding between the pools to the tube
    a.stroke([(23.5, 40.5), (24, 34), (26, 30), (25.5, 25.5), (24.5, 19.5), (23.5, 16), (24.5, 12.5)], 1.4, ':', seed=6, force=True)
    for (x, y) in [(x, y) for x in range(22, 27) for y in range(6, 8)]: a.put(x, y, 'c', True)
    a.scatter('b', 0.012, only=',;', seed=51, clear=1)
    a.scatter('r', 0.006, only='s,', seed=52, clear=1)
    a.tidy()
    a.exit('s', 23, 24, {'map': 'a_lava', 'spawn': 'north'}, 'south')
    a.objects += [
        dict(type='examine', x=23, y=22, event='ash_spa_pool'),
        dict(type='sign', x=21, y=33, text='溶岩洞の湯の郷\n岩の割れ目から、湯が湧く。'),
        dict(type='prop', id='steam_vent', x=12, y=25), dict(type='prop', id='steam_vent', x=33, y=20), dict(type='prop', id='steam_vent', x=28, y=8),
        dict(type='chest', id='a_spa_c1', x=35, y=27, item='i_ether', n=1),
        dict(type='waylamp', id='wl_a_spa_1', x=27, y=33, lit=True),
    ]
    a.meta = dict(name='湯けむりの谷', sub='溶岩洞の湯の郷', region='r_ash', worldRect=[360, 354, 84, 42], outside='rock',
                  zones=[{'rect': None, 'zone': 'zw_ash_spa'}], links={}, npcs=[])
    return a


def a_foot():
    """火山のふもと: east of Caldera at the foot of the ash volcano. The crater town's rim with its carved east gate on the west edge; the
    black flanks of the volcano's cone fill the east, a lava stream pours down its south side towards the sea; in the cone's west face the
    carved ROCK DOOR (bird-shaped hollows) into the volcano; boulder slopes; the road north to the tide bridge and south to the beach."""
    a = Area('a_foot', 56, 44, 1505, base='s')
    W, H = a.W, a.H
    ash_ground(a, 3, 4, drift=0.6, crust=0.74)
    # the crater town's rim (W edge), gate rows 21-22
    a.region([(-3, -3), (1.5, -3), (2.5, 10), (2, 30), (1.5, 47), (-3, 47)], 'R', rough=0.4, seed=1, force=True)
    a.mark('gate', [(0, 19), (1, 19), (0, 24), (1, 24)], 'the carved stone GATE TOWERS of the crater town: squat black basalt towers flanking the road where it passes through a cut in the rock wall', BASALT)
    a.rect(0, 21, 3, 2, '.', force=True, keep=True)
    # the volcano's cone (E): a great black mass, the rock door in its west face at (38, 19)
    a.region([(37, -3), (59, -3), (59, 36), (52, 33), (45, 29), (40, 24), (37.5, 19), (36.5, 12), (35, 5)], 'R', rough=0.8, seed=2, force=True)
    a.mark('rockdoor', [(37, 18), (39, 18)], 'the carved stone jambs of an ancient ROCK DOOR cut into the volcano: a round slab of black stone with three hollows shaped like birds with spread wings', BASALT)
    door(a, 38, 18, 1)
    a.rect(37, 19, 3, 2, 'c', force=True, keep=True)
    # a lava stream down the cone's south side to the south edge
    a.stroke([(50, 30), (46, 34), (42, 37), (40, 41), (39.5, 45)], 2.2, 'l', keep=False, wobble=0.5, seed=21, force=True)
    a.region([(47, 33), (59, 31), (59, 47), (42, 47), (43, 41), (45, 37)], 'R', rough=0.8, seed=22, force=True, only='suk')
    # boulder slopes and outcrops
    for (x, y, rx, ry, s_) in [(26, 7, 2.6, 1.7, 11), (14, 33, 2.2, 1.5, 12), (30, 30, 2.0, 1.4, 13), (10, 8, 1.8, 1.4, 14)]:
        a.blob(x, y, rx, ry, 'R', rough=0.3, seed=s_)
    for (x, y, rx, ry, s_) in [(18, 12, 2.0, 1.5, 31), (6, 36, 2.2, 1.6, 32)]:
        a.blob(x, y, rx, ry, 'T', rough=0.5, seed=s_, only='suk')
    # roads: gate -> fork -> north (bridge), -> the rock door, -> south (beach)
    road = [(-1, 21.5), (8, 21.5), (16, 21), (24, 20.5), (31, 20), (37.5, 20)]
    a.stroke(road, 2.0, '.', wobble=0.1, seed=6)
    a.stroke([(16, 21), (17.5, 13), (20.5, 6), (20.5, -1)], 1.8, '.', wobble=0.2, seed=7)
    a.stroke([(20, 22), (19, 30), (15.5, 38), (14.5, 44.5)], 1.6, '.', wobble=0.2, seed=8)
    a.scatter('r', 0.012, only='suk', seed=41, clear=1)
    a.scatter('b', 0.006, only='su', seed=42, clear=1)
    a.tidy()
    a.exit('w', 21, 22, {'map': 'caldera', 'spawn': 'gate_e'}, 'caldera')
    a.exit('n', 20, 21, {'map': 'a_bridge', 'spawn': 'south'}, 'north')
    a.exit('s', 14, 15, {'map': 'a_beach', 'spawn': 'foot'}, 'south')
    a.spawns['volcano'] = dict(x=38, y=19, dir='s')
    a.objects += [
        dict(type='stairs', x=38, y=18, to={'map': 'ash_volcano_1', 'spawn': 'entrance'}, cond='ash_champion', look='none'),
        dict(type='examine', x=38, y=18, event='ash_rockdoor_world', cond={'not': 'ash_champion'}),
        dict(type='sign', x=34, y=22, text='灰の火山\n炎の試練の勝者のほか、入るべからず。'),
        dict(type='sign', x=5, y=24, text='北 → 潮見橋・灰見の宿\n南 → 火山ガメの浜'),
        dict(type='waylamp', id='wl_a_foot_gate', x=6, y=19, lit=True),
        dict(type='waylamp', id='wl_a_foot_1', x=22, y=17, lit=True),
        dict(type='prop', id='iron_brazier', x=37, y=18), dict(type='prop', id='iron_brazier', x=39, y=18),
        dict(type='prop', id='lava_glow', x=44, y=35), dict(type='prop', id='lava_glow', x=40, y=40),
    ]
    a.painted_extra = ['lava_glow']
    a.meta = dict(name='火山のふもと', sub='カルデラの東、火の鳥の眠る山', region='r_ash', worldRect=[519, 384, 99, 66], outside='rock',
                  zones=[{'rect': road_band(road, 2), 'zone': ROAD_ZONE}, {'rect': None, 'zone': PLAIN_ZONE}],
                  links={'caldera_e': {'map': 'a_foot', 'spawn': 'caldera'}, 'volcano': {'map': 'a_foot', 'spawn': 'volcano'}}, npcs=[])
    return a


def a_bridge():
    """潮見橋のたもと: the north shore of the ash land. The strait fills the north; the long stone TIDE BRIDGE runs north over it towards
    the marsh; at its foot the inn 灰見の宿 (a squat stone house with a turf-and-slate roof) with a little yard; black rocky shore, tide
    pools, ash-grey crags east and west; the road south to the volcano's foot."""
    a = Area('a_bridge', 48, 40, 1606, base='s')
    W, H = a.W, a.H
    ash_ground(a, 3, 4, drift=0.62)
    # the strait (N) and the black shingle shore
    a.region([(-3, -3), (51, -3), (51, 14), (40, 15.5), (30, 13.5), (24, 15), (16, 13.5), (7, 15.5), (-3, 14)], '~', rough=1.0, seed=1, force=True)
    a.region([(-3, 12), (51, 12), (51, 18.5), (-3, 18.5)], 'k', rough=1.0, seed=2, only='su')
    # crags W and E
    a.region([(-3, 17), (6, 16.5), (9, 22), (8, 30), (11, 43), (-3, 43)], 'R', rough=0.9, seed=3, force=True)
    a.region([(51, 16), (41, 17), (38, 23), (40, 32), (37, 43), (51, 43)], 'R', rough=0.9, seed=4, force=True)
    # the tide bridge: a 2-wide stone deck from the shore (y 15) to the north edge, parapets either side
    for y in range(0, 17):
        a.put(22, y, '=', True); a.put(23, y, '=', True)
        a.keep[y, 22] = a.keep[y, 23] = True
    par = [(21, y) for y in range(0, 15)] + [(24, y) for y in range(0, 15)]
    a.mark('bridge', [(x, y) for x in (22, 23) for y in range(0, 17)], 'a long old STONE BRIDGE of grey blocks on arched piers, its deck running north across the sea (walkable)', (176, 172, 164), solid=False)
    a.mark('parapet', par, 'the low stone PARAPETS of the bridge, with a few stubby pillars', STONE)
    # the inn 灰見の宿 (W of the bridge foot), door at (15, 22)
    inn = [(x, y) for x in range(12, 19) for y in range(18, 23) if (x, y) != (15, 22)]
    a.mark('inn', inn, 'the roadside INN: a squat house of grey fieldstone with a steep dark slate roof, a stone chimney, small warm windows, a wooden door in the middle of its south wall (the dark block)', (120, 110, 104))
    door(a, 15, 22, 1)
    a.rect(13, 23, 5, 2, 'c', force=True, keep=True)
    # the road from the bridge foot south
    road = [(22.5, 16), (23, 22), (22, 29), (21.5, 34), (21.5, 40.5)]
    a.stroke(road, 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(22, 24), (15, 24)], 1.4, ':', seed=7, force=True)
    # tide pools and rocks on the shore
    for (x, y, rx, ry, s_) in [(33, 16.5, 1.8, 1.0, 11), (8, 14.5, 1.4, 0.9, 12)]:
        a.blob(x, y, rx, ry, 'w', rough=0.2, seed=s_, only='suk')
    a.scatter('r', 0.012, only='suk', seed=41, clear=1)
    a.scatter('T', 0.006, only='su', seed=42, clear=1)
    a.tidy()
    a.exit('n', 22, 23, {'map': 'm_bog', 'spawn': 'south'}, 'north')
    a.exit('s', 21, 22, {'map': 'a_foot', 'spawn': 'north'}, 'south')
    a.spawns['haimi'] = dict(x=15, y=23, dir='s')
    a.exits.append(dict(x=15, y=22, w=1, h=1, to={'map': 'haimi_inn', 'spawn': 'door'}))
    a.objects += [
        dict(type='examine', x=24, y=15, event='ash_bridge_sign'),
        dict(type='examine', x=21, y=3, event='ash_bridge_sign'),
        dict(type='sign', x=26, y=19, text='潮見橋\n北 → グレイモア湿原'),
        dict(type='sign', x=19, y=25, text='灰見の宿'),
        dict(type='waylamp', id='wl_a_bridge_inn', x=19, y=22, lit=True),
        dict(type='waylamp', id='wl_a_bridge_1', x=25, y=30, lit=True),
    ]
    a.meta = dict(name='潮見橋のたもと', sub='湿原と灰をつなぐ橋', region='r_ash', worldRect=[528, 336, 90, 48], outside='sea',
                  zones=[{'rect': road_band(road, 2), 'zone': ROAD_ZONE}, {'rect': None, 'zone': PLAIN_ZONE}],
                  links={'haimi': {'map': 'a_bridge', 'spawn': 'haimi'}, 'ash_bridge': {'map': 'a_bridge', 'spawn': 'north'}}, npcs=[])
    return a


def a_beach():
    """火山ガメの浜: the black-sand beach south of Caldera where the lava meets the sea. Steaming dark cliffs along the north, a wide beach
    of black volcanic sand, clusters of hexagonal basalt columns, warm tide pools, huge rounded grey-green rocks like turtle shells; in the
    east a lava flow runs down into the surf in clouds of steam; the sea along the south."""
    a = Area('a_beach', 60, 36, 1707, base='s')
    W, H = a.W, a.H
    ash_ground(a, 5, 6, drift=0.62, crust=0.9)
    # the sea (S)
    a.region([(-3, 27), (12, 28.5), (26, 26.5), (40, 28), (52, 26.5), (63, 27.5), (63, 39), (-3, 39)], '~', rough=1.1, seed=1, force=True)
    a.region([(-3, 25), (63, 25), (63, 29), (-3, 29)], '_', rough=0.8, seed=2, only='suk')
    # the steaming cliffs (N), gaps for the two paths at x 6-7 and x 50-51
    a.region([(-3, -3), (63, -3), (63, 4), (56, 5.5), (52, 3.5), (49, 3.5), (44, 6), (34, 5), (24, 6.5), (14, 5), (9, 3.5), (5, 3.5), (1, 5.5), (-3, 5)], 'R', rough=0.7, seed=3, force=True)
    for x in (6, 7): a.rect(x, 0, 1, 6, 's', force=True, keep=True)
    for x in (50, 51): a.rect(x, 0, 1, 6, 's', force=True, keep=True)
    # the lava flow into the sea (E)
    a.stroke([(57.5, 3), (56.5, 10), (57.5, 17), (56.5, 24), (57, 30)], 2.6, 'l', keep=False, wobble=0.5, seed=21, force=True)
    # basalt column clusters
    for (x, y, rx, ry, s_) in [(18, 10, 2.4, 1.6, 11), (38, 12, 2.8, 1.8, 12), (28, 20, 1.6, 1.2, 13), (46, 19, 2.0, 1.4, 14)]:
        a.blob(x, y, rx, ry, 'R', rough=0.25, seed=s_)
    # warm tide pools
    for (x, y, rx, ry, s_) in [(11, 22, 2.2, 1.2, 31), (33, 24, 2.6, 1.2, 32), (22, 14, 1.4, 1.0, 33)]:
        a.blob(x, y, rx, ry, 'w', rough=0.2, seed=s_, only='suk_')
    # the turtle-shell rocks (the moving rock is one of them)
    shells = [(26, 16), (27, 16), (42, 22), (43, 22), (14, 17)]
    a.mark('shells', shells, 'huge rounded GREY-GREEN ROCKS whose cracked domed tops look exactly like giant TURTLE SHELLS half sunk in the black sand', (110, 118, 100))
    # the footpath along the beach between the two cliff gaps
    a.stroke([(6.5, -1), (7, 6), (12, 12), (22, 18.5), (34, 18), (44, 15.5), (50.5, 8), (50.5, -1)], 1.4, ':', seed=6, force=True)
    a.scatter('r', 0.010, only='suk', seed=41, clear=1)
    a.tidy()
    a.exit('n', 6, 7, {'map': 'a_lava', 'spawn': 'south'}, 'lava')
    a.exit('n', 50, 51, {'map': 'a_foot', 'spawn': 'south'}, 'foot')
    a.objects += [
        dict(type='examine', x=26, y=16, event='ash_beach_rock'),
        dict(type='sign', x=9, y=8, text='黒い砂浜\n動く岩に注意。'),
        dict(type='chest', id='a_beach_c1', x=47, y=23, item='i_panacea', n=1),
        dict(type='waylamp', id='wl_a_beach_1', x=30, y=15, lit=True),
        dict(type='prop', id='steam_vent', x=53, y=26), dict(type='prop', id='steam_vent', x=53, y=12),
        dict(type='prop', id='lava_glow', x=57, y=10), dict(type='prop', id='lava_glow', x=56, y=22),
    ]
    a.painted_extra = ['lava_glow']
    a.meta = dict(name='火山ガメの浜', sub='黒い砂浜', region='r_ash', worldRect=[435, 444, 105, 42], outside='sea',
                  zones=[{'rect': None, 'zone': 'zw_ash_beach'}], links={}, npcs=[])
    return a


AREAS = {k: v for k, v in globals().items() if k.startswith('a_') and callable(v)}

if __name__ == '__main__':
    for aid in sys.argv[1:]:
        a = AREAS[aid]()
        # walkable pockets no spawn reaches become crags (the guide then shows what the collision will be)
        seen0 = np.zeros((a.H, a.W), bool)
        for s_ in a.spawns.values(): seen0 |= a.reach(s_['x'], s_['y'])
        pk = a.walk() & ~seen0
        a.g[pk] = 'R'
        print('closed pockets', int(pk.sum()))
        a.save(aid)
        if getattr(a, 'painted_extra', None):
            import json
            p = aid + '/layout.json'; d = json.load(open(p)); d['painted_extra'] = a.painted_extra; json.dump(d, open(p, 'w'), ensure_ascii=False, indent=0)
        print(a.ascii())
        sp = list(a.spawns.values())
        seen = a.reach(sp[0]['x'], sp[0]['y'])
        for k, s in a.spawns.items(): print('spawn', k, s, 'reach', bool(seen[s['y'], s['x']]))
        for o in a.objects + [dict(type='exit', **e) for e in a.exits]:
            x, y = o['x'], o['y']
            nb = [(x + dx, y + dy) for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)) if a.inb(x + dx, y + dy)]
            r = any(seen[j, i] for i, j in nb)
            if not r or '-v' in sys.argv: print('obj', o['type'], o.get('id') or o.get('event') or o.get('to', ''), (x, y), a.g[y, x], 'reach', r)
        print('walkable', int(a.walk().sum()), 'reached', int(seen.sum()))
