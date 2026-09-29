"""Layouts of the painted FIELD areas of the desert (ザハラ砂漠 r_desert; area switching like the demo's ../field/areas.py).
usage: python3 areas_desert.py <id> [...]   -> <id>/layout.json + ascii on stdout (then guide.py <id>)
The areas replace the walk over the old world map inside the region (tools/gen_world_desert.js): every place, lamp, dig site, trigger and
traveller that stood there is placed here with the same ids and events. Map ids d_* (v2/src/maps/field_desert_*.js).
Chars: lib.py (desert copy): s sand, u dune sand, k cracked clay / salt pan, . caravan road, : footpath, c flagstones, , oasis grass,
; dry scrub grass, T palms, b thorn scrub, r boulders, R sandstone cliff, X built, w water, ~ sea, _ shallows."""
import sys, math
import numpy as np
from lib import Area, fbm, WALK

SANDSTONE = (214, 150, 100)
MUDBRICK = (196, 150, 104)
STONE = (226, 214, 180)
DARK = (40, 26, 16)
CAR = {'map': 'desert_caravan_on'}
CARAVAN_ZONE = {'rect': None, 'zone': 'zw_desert_caravan', 'cond': 'desert_caravan_on'}


def desert_ground(a, s1, s2, dune=0.55, clay=1.1):
    W, H = a.W, a.H
    a.mask_fill(fbm(s1, W, H, 9) > dune, 'u', only='s')
    a.mask_fill(fbm(s2, W, H, 6) > clay, 'k', only='s')


def door(a, x, y, w=1):
    a.mark('door', [(x + i, y) for i in range(w)], 'a dark ENTRANCE', DARK, solid=False)
    a.rect(x, y, w, 1, ':', force=True, keep=True)


def d_pass():
    """赤岩の峠: the forest's southern pass opens into the desert. A red sandstone gorge at the top (the road from the forest), the road
    winding down onto the first dunes; the walled caravanserai 砂の縁 (the town sandedge) on the west with its gate on the south; a small
    palm pool; in the north-east a field of wind-carved red rocks with the gully into the 金剛トカゲの岩場 (desert_rocks); the road leaves
    south towards Kasim."""
    a = Area('d_pass', 52, 40, 101, base='s')
    W, H = a.W, a.H
    desert_ground(a, 3, 4)
    ys, xs = np.mgrid[0:H, 0:W]
    a.mask_fill((fbm(7, W, H, 5) > 0.7) & (ys < 16), ';', only='s')      # dry grass tufts near the forest edge
    # the gorge: red sandstone walls either side of the road coming down from the forest
    a.region([(-3, -3), (23, -3), (23, 4), (21.5, 8), (16, 11), (6, 12.5), (-3, 13)], 'R', rough=0.6, seed=1, force=True)
    a.region([(28.5, -3), (55, -3), (55, 1.5), (36, 2.5), (31, 6), (29, 4)], 'R', rough=0.4, seed=2, force=True)
    # the rock field (NE): a mass of wind-carved red rock towers, a narrow gully cut north into it (mouth at (46, 5))
    a.region([(37, 1), (55, 0), (55, 12), (51, 11.5), (48.5, 9.5), (44, 10), (40.5, 8), (37.5, 5)], 'R', rough=0.8, seed=3, force=True)
    for (x, y, rx, ry, s_) in [(42.5, 12.5, 1.6, 1.3, 14), (50, 14.5, 1.8, 1.5, 15)]:
        a.blob(x, y, rx, ry, 'R', rough=0.3, seed=s_)
    a.rect(46, 5, 1, 6, ':', force=True, keep=True)
    # roads: the main road from the gorge down to the south edge; the spur to the caravanserai gate; the path to the rock gully
    a.stroke([(25.5, -1), (25.5, 4), (24.8, 9), (22.5, 14), (20.5, 19.5), (22.5, 25), (26.5, 30), (27.5, 35), (27.5, 40.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(20.5, 19.5), (15, 24), (9.5, 25.5)], 1.6, '.', seed=7)
    a.stroke([(23.5, 12), (30, 14.5), (38, 14.5), (43, 12.5), (46, 11)], 1.4, ':', seed=8)
    # the caravanserai 砂の縁: a square compound of mud brick (flat roofs, a courtyard inside), its arched gate in the south wall
    cs = [(x, y) for x in range(3, 16) for y in range(14, 24)]
    a.mark('caravanserai', cs, 'the walled CARAVANSERAI "Sand\'s Edge" seen from above: a square compound of tall mud-brick walls with rounded corner towers, flat roofs of guest rooms along the inside of the walls, a sunny courtyard with a well and a palm in the middle, one big arched GATE in the middle of its south wall (the dark block)', MUDBRICK)
    door(a, 9, 23, 1)
    a.rect(8, 24, 3, 2, '.', force=True, keep=True)
    # the gully into the rocks
    door(a, 46, 5, 1)
    # the palm pool
    a.blob(38, 24, 3.4, 2.4, ',', rough=0.2, seed=21, force=True)
    a.blob(38, 24, 2.2, 1.4, 'w', rough=0.2, seed=22, force=True)
    for (x, y) in [(35, 22), (41, 23), (36, 26), (40, 26)]: a.put(x, y, 'T', True)
    a.scatter('r', 0.010, only='suk', seed=31, clear=1)
    a.scatter('b', 0.012, only='suk;', seed=32, clear=1)
    a.tidy()
    a.exit('n', 24, 26, {'map': 'f_south', 'spawn': 'south'}, 'north')
    a.exit('s', 27, 28, {'map': 'd_west', 'spawn': 'north'}, 'south')
    a.spawns['sandedge'] = dict(x=9, y=25, dir='s')
    a.spawns['rocks'] = dict(x=46, y=6, dir='s')
    a.exits.append(dict(x=9, y=23, w=1, h=1, to={'map': 'sandedge', 'spawn': 'gate'}))
    a.exits.append(dict(x=46, y=5, w=1, h=1, to={'map': 'desert_rocks', 'spawn': 'mouth'}))
    a.objects += [
        dict(type='sign', x=27, y=8, text='ザハラ砂漠\n北 → ヴェルダの森　南 → カシム'),
        dict(type='sign', x=12, y=26, text='宿場「砂の縁」\n森と砂漠と灰の街道の、まん中の宿'),
        dict(type='sign', x=44, y=13, text='北の岩場\n「岩が動いた」と隊商が言う。'),
        dict(type='waylamp', id='wl_d_pass_1', x=24, y=16, lit=True),
        dict(type='waylamp', id='wl_d_pass_2', x=29, y=31, lit=True),
        dict(type='prop', id='cart_barrels', x=13, y=26), dict(type='prop', id='copper_brazier', x=7, y=25),
    ]
    a.meta = dict(name='赤岩の峠', sub='森から砂漠へ下りる道', region='r_desert', worldRect=[70, 358, 110, 64], outside='dune_sand',
                  zones=[{'rect': None, 'zone': 'zw_desert_road'}],
                  links={'sandedge': {'map': 'd_pass', 'spawn': 'sandedge'}, 'rocks': {'map': 'd_pass', 'spawn': 'rocks'}},
                  npcs=[{'id': 'pilgrim', 'look': 'npc_desert_old_f', 'name': '夜明け待ちの巡礼', 'x': 30, 'y': 28, 'dir': 's', 'move': 'still',
                         'talk': 'desert_world_pilgrim', 'reward': 'news', 'key': 'world_pilgrim'}])
    return a


def d_west():
    """鷹の台地: the plain west of Kasim. Kasim's tall mud-brick city wall with its west gatehouse on the east edge; the road from the
    north (the pass) to the gate; the caravan road from the gate south; the great flat-topped HAWK MESA in the west (sheer red cliffs, the
    cave mouth of the hawks' den in its south face); the flat cracked-clay "mirage plain" in the middle (lanterns only on the extinguishing
    night); palms along the town wall; dunes."""
    a = Area('d_west', 60, 44, 202, base='s')
    W, H = a.W, a.H
    desert_ground(a, 3, 4, dune=0.5)
    # Kasim's west wall and gatehouse (east edge, gate rows 20-21)
    wall = [(x, y) for x in range(55, 60) for y in range(0, 44) if y not in (20, 21)]
    a.mark('town', wall, "the oasis town's tall MUD-BRICK CITY WALL with rounded towers and crenellations, and its great arched WEST GATEHOUSE over the road (the gap in this block); date palms peek over the wall", MUDBRICK)
    # palms along the wall
    for (x, y, rx, ry, s_) in [(52, 9, 2.2, 3.0, 11), (52, 32, 2.2, 3.4, 12), (53, 14.5, 1.2, 1.4, 13)]:
        a.blob(x, y, rx, ry, 'T', rough=0.3, seed=s_)
    # the hawk mesa (W): a sheer plateau of red rock, the cave mouth in its south face at (12, 24)
    a.region([(3, 9), (10, 6.5), (19, 7), (23, 11), (22.5, 18), (19, 22.5), (13, 24.5), (6, 23), (2, 17)], 'R', rough=0.9, seed=21, force=True)
    a.region([(-3, 26), (4, 27), (6, 33), (3, 38), (-3, 39)], 'R', rough=0.8, seed=22, force=True)
    a.rect(11, 23, 3, 2, 'R', force=True)
    door(a, 12, 24, 1)
    # roads
    a.stroke([(30.5, -1), (31, 5), (35, 11), (42, 16.5), (50, 20), (59.5, 20.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(48, 20), (46.5, 26), (41, 32), (36.5, 38), (34.5, 44.5)], 2.0, '.', wobble=0.2, seed=7)
    a.stroke([(41, 32), (32, 31), (22, 28.5), (15, 26.5), (12.5, 25.5)], 1.4, ':', seed=8)
    # the mirage plain: cracked clay, a low stone slab in the middle (the market appears around it at night)
    a.blob(29, 21, 7.5, 4.2, 'k', rough=0.25, seed=31, force=True)
    a.mark('slab', [(29, 21)], 'a low weathered flat STONE SLAB lying on the clay (walkable, flat)', STONE, solid=False)
    a.rect(29, 21, 1, 1, 'c', force=True, keep=True)
    a.scatter('r', 0.008, only='suk', seed=41, clear=1)
    a.scatter('b', 0.012, only='su', seed=42, clear=1)
    a.tidy()
    a.exit('n', 30, 31, {'map': 'd_pass', 'spawn': 'south'}, 'north')
    a.exit('e', 20, 21, {'map': 'kasim', 'spawn': 'gate_w'}, 'kasim')
    a.exit('s', 34, 35, {'map': 'd_caravan', 'spawn': 'north'}, 'south')
    a.spawns['hawks'] = dict(x=12, y=25, dir='s')
    a.spawns['mirage'] = dict(x=29, y=22, dir='s')
    a.exits.append(dict(x=12, y=24, w=1, h=1, to={'map': 'desert_hawks_1', 'spawn': 'mouth'}))
    night = 'desert_night'
    a.exits.append(dict(x=29, y=21, w=1, h=1, to={'map': 'desert_mirage', 'spawn': 'road'}, cond=night))
    a.objects += [
        dict(type='examine', x=29, y=21, event='desert_mirage_empty', cond={'not': night}),
        dict(type='prop', id='lantern', x=25, y=19, cond=night), dict(type='prop', id='lantern', x=33, y=19, cond=night),
        dict(type='prop', id='lantern', x=25, y=23, cond=night), dict(type='prop', id='lantern', x=33, y=23, cond=night),
        dict(type='prop', id='lantern', x=29, y=18, cond=night),
        dict(type='sign', x=35, y=24, text='砂の真ん中の平地\n消灯の刻に、灯りの列が揺れるという。'),
        dict(type='sign', x=15, y=27, text='岩の台地\n夜、鷹の笛が聞こえるという。'),
        dict(type='sign', x=50, y=23, text='オアシスの町カシム\n――泉を囲む市場'),
        dict(type='waylamp', id='wl_desert_beacon_1', x=44, y=31, lit='q_kasim_beacon_1', event='desert_beacon'),
        dict(type='waylamp', id='wl_d_west_gate_n', x=52, y=18, lit=True),
        dict(type='waylamp', id='wl_d_west_gate_s', x=50, y=24, lit=True),
        dict(type='waylamp', id='wl_d_west_road', x=36, y=12, lit=True),
        dict(type='prop', id='bones', x=9, y=26), dict(type='prop', id='thorn_bush', x=16, y=29),
        dict(type='prop', id='copper_brazier', x=53, y=19), dict(type='prop', id='copper_brazier', x=53, y=22),
    ]
    a.meta = dict(name='鷹の台地', sub='カシムの西の野', region='r_desert', worldRect=[40, 400, 116, 70], outside='dune_sand',
                  zones=[CARAVAN_ZONE, {'rect': None, 'zone': 'zw_desert'}],
                  triggers=[{'id': 'desert_ambush_1', 'x': 39, 'y': 32, 'w': 5, 'h': 3, 'on': 'step', 'event': 'desert_ambush_1',
                             'cond': ['desert_caravan_on', '!desert_ambush_1_done']}],
                  links={'kasim': {'map': 'd_west', 'spawn': 'kasim'}, 'hawks': {'map': 'd_west', 'spawn': 'hawks'},
                         'mirage': {'map': 'd_west', 'spawn': 'mirage'}}, npcs=[])
    return a


def d_east():
    """東の街道: the old paved road from Kasim's east gate to the ash-land pass. Kasim's east wall on the west edge; the strait's shore and
    a beach along the north; a white salt pan south of the road; a dry wadi crossed by an old stone bridge; an oil caravan resting by the
    road; grey ash-dusted crags on the east edge with the pass (a rockfall and a guard in the demo -> the old world map beyond)."""
    a = Area('d_east', 56, 36, 303, base='s')
    W, H = a.W, a.H
    desert_ground(a, 3, 4)
    # the strait (N)
    a.region([(-3, -3), (59, -3), (59, 3.5), (46, 4.5), (36, 3), (24, 4.5), (12, 3.2), (-3, 4)], '~', rough=1.0, seed=1, force=True)
    # Kasim's east wall (W edge), gate rows 17-18
    wall = [(x, y) for x in range(0, 5) for y in range(4, 36) if y not in (17, 18)]
    a.mark('town', wall, "the oasis town's tall MUD-BRICK CITY WALL with rounded towers and crenellations, and its great arched EAST GATEHOUSE over the road (the gap in this block); date palms peek over the wall", MUDBRICK)
    # the ash-land crags (E) with the pass
    a.region([(48, 4), (59, 3), (59, 39), (47, 39), (50, 30), (48.5, 22), (51, 17), (49.5, 10)], 'R', rough=0.9, seed=2, force=True)
    # the wadi (dry ravine, N -> S) and the stone bridge
    wadi = [(33, 3), (34, 9), (32.5, 15), (34, 21), (33, 27), (35, 33), (35.5, 39)]
    a.stroke(wadi, 2.4, 'R', keep=False, wobble=0.4, seed=4, force=True)
    # the road
    a.stroke([(-1, 17.5), (8, 17.8), (18, 16.5), (27, 16.8), (32.5, 15.5), (40, 15), (47, 14.5), (56.5, 14.5)], 2.0, '.', wobble=0.0, seed=6, force=True)
    for (x, y) in [(x, y) for x in range(30, 37) for y in range(13, 18)]:
        if a.g[y, x] == '.' and any(a.g[j, i] == 'R' for i, j in ((x - 1, y), (x + 1, y), (x, y - 2), (x, y + 2), (x - 2, y), (x + 2, y))):
            pass
    br = [(x, y) for x in range(31, 36) for y in range(14, 17)]
    a.mark('bridge', br, 'an OLD STONE BRIDGE of sandstone blocks with low parapets carrying the road over the dry ravine (the deck is walkable)', (190, 160, 120), solid=False)
    for (x, y) in br: a.put(x, y, '=', True)
    for (x, y) in [(x, y) for x in range(31, 36) for y in (13, 17)]: a.put(x, y, 'R', True)
    # the salt pan south of the road
    sp = a.blob(18, 26, 9, 4.6, 'k', rough=0.3, seed=21, force=True)
    # the oil caravan's covered wagon by the road
    a.mark('wagon', [(22, 13), (23, 13), (24, 13)], "an OIL CARAVAN'S COVERED WAGON with a patched cream canvas hood and big clay oil jars roped on its back, unhitched", (200, 180, 140))
    a.scatter('r', 0.010, only='suk', seed=31, clear=1)
    a.scatter('b', 0.010, only='su', seed=32, clear=1)
    a.tidy()
    a.exit('w', 17, 18, {'map': 'kasim', 'spawn': 'gate_e'}, 'kasim')
    a.exit('e', 14, 15, {'map': 'world', 'spawn': 'd_east_e'}, 'pass')['cond'] = {'not': {'slice': True}}
    a.exit('s', 12, 13, {'map': 'd_south', 'spawn': 'north'}, 'south')
    a.stroke([(12.5, 18), (12.5, 36)], 1.6, ':', seed=9, only='sukb r')
    a.objects += [
        dict(type='sign', x=46, y=17, text='東 → 灰の荒野・カルデラ'),
        dict(type='sign', x=8, y=15, text='オアシスの町カシム\n東の門'),
        dict(type='waylamp', id='wl_d_east_1', x=9, y=20, lit=True),
        dict(type='waylamp', id='wl_d_east_2', x=26, y=19, lit=True),
        dict(type='waylamp', id='wl_d_east_3', x=42, y=17, lit=True),
        dict(type='prop', id='cart_barrels', x=21, y=13),
    ]
    a.meta = dict(name='東の街道', sub='灰の荒野への古い道', region='r_desert', worldRect=[165, 395, 125, 50], outside='dune_sand',
                  zones=[{'rect': [0, 10, 56, 12], 'zone': 'zw_desert_road'}, {'rect': None, 'zone': 'zw_desert'}],
                  tilePatches=[{'cond': {'slice': True}, 'rect': [52, 13, 3, 3], 'rows': ['rrr', 'rrr', 'rrr']}],
                  links={'kasim_e': {'map': 'd_east', 'spawn': 'kasim'}},
                  npcs=[{'id': 'oil_caravan', 'look': 'npc_oil_carrier', 'name': '油運び', 'x': 25, 'y': 14, 'dir': 'w', 'move': 'still', 'talk': 'desert_world_oil', 'reward': 'hint', 'key': 'world_oil_caravan'},
                        {'id': 'oil_camel', 'look': 'ani_camel', 'name': 'ラクダ', 'x': 26, 'y': 13, 'dir': 'w', 'move': 'still', 'talk': {'lines': [{'text': 'ラクダは、油のつぼを背に\nのんびり砂をかんでいる。'}]}, 'reward': None},
                        {'id': 'guard_ash', 'look': 'npc_guard_1', 'name': '番人', 'x': 50, 'y': 16, 'dir': 'e', 'move': 'still', 'pushable': False, 'cond': {'slice': True},
                         'talk': {'lines': [{'text': ['灰の荒野へ抜ける峠は、\n灰の崩れでふさがってるんだ。', 'カルデラへ行くなら、\n片づくまで待ってくれ。']}]}, 'reward': 'news', 'key': 'world_guard_ash'}])
    return a


def d_south():
    """沈んだ柱の浜: the great dune sea south of Kasim down to the southern sea. The well-diggers' three sand mounds under the town (NW);
    a little palm oasis in the dunes; a nomad camp (E); the beach with the tops of a sunken temple's pillars and an obelisk (S)."""
    a = Area('d_south', 56, 44, 404, base='s')
    W, H = a.W, a.H
    desert_ground(a, 3, 4, dune=0.45)
    # dune ridges (tall rippled dunes, walkable) and a few crests of rock
    # the sea (S) and the beach
    a.region([(-3, 38), (10, 37.5), (20, 39), (34, 38.4), (46, 39.5), (59, 38.5), (59, 47), (-3, 47)], '~', rough=1.0, seed=1, force=True)
    a.region([(-3, 35.5), (59, 35.5), (59, 39.5), (-3, 39.5)], 's', rough=0.8, seed=2, only='uk')
    # the sunken temple: pillar tops and an obelisk on the beach, the half-buried doorway at (29, 35)
    pil = [(24, 34), (26, 33), (32, 33), (34, 34), (29, 32)]
    a.mark('pillars', pil, 'the TOPS OF HUGE SANDSTONE TEMPLE PILLARS with carved capitals sticking out of the sand (the rest is buried), sand drifted against them', SANDSTONE)
    a.mark('lintel', [(28, 34), (30, 34), (28, 35), (30, 35)], 'the carved stone JAMBS of a buried temple doorway, sand spilling down between them', SANDSTONE)
    door(a, 29, 35, 1)
    a.rect(28, 36, 3, 1, 's', force=True, keep=True)
    # the palm oasis
    a.blob(28, 18, 4.2, 3.0, ',', rough=0.2, seed=21, force=True)
    a.blob(28, 18, 2.6, 1.6, 'w', rough=0.2, seed=22, force=True)
    for (x, y) in [(24, 16), (32, 17), (25, 21), (31, 20), (27, 15)]: a.put(x, y, 'T', True)
    # the dig sites (NW, under the town) — flat hard sand
    a.blob(14, 7, 6, 3.5, 'k', rough=0.2, seed=31, force=True)
    # rock crests
    for (x, y, rx, ry, s_) in [(44, 8, 3, 1.8, 41), (8, 26, 2.4, 1.6, 42), (47, 30, 2, 1.4, 43), (38, 25, 1.4, 1.2, 44)]:
        a.blob(x, y, rx, ry, 'R', rough=0.3, seed=s_)
    # the nomad camp (E): a trampled clearing
    a.blob(46, 22, 5, 3, 'k', rough=0.2, seed=51, force=True)
    a.scatter('r', 0.006, only='su', seed=61, clear=1)
    a.scatter('b', 0.012, only='su', seed=62, clear=1)
    a.tidy()
    a.exit('n', 44, 45, {'map': 'd_east', 'spawn': 'south'}, 'north')
    a.exit('w', 16, 17, {'map': 'd_caravan', 'spawn': 'east'}, 'west')
    a.stroke([(44.5, 0), (40, 8), (33, 14), (22, 16), (10, 16.5), (0, 16.5)], 1.4, ':', seed=9, only='suk')
    a.stroke([(29, 21), (29, 31)], 1.2, ':', seed=10, only='suk')
    temple = {'any': ['cleared_r_desert', {'var': 'desert_nights', 'gte': 3}]}
    a.spawns['temple'] = dict(x=29, y=36, dir='s')
    a.objects += [
        dict(type='stairs', x=29, y=35, to={'map': 'desert_temple_1', 'spawn': 'entrance'}, cond=temple, look='none'),
        dict(type='examine', x=29, y=35, event='desert_temple_sand', cond={'not': temple}),
        dict(type='sign', x=24, y=36, text='沈んだ柱の浜\n砂嵐が晴れた晩、柱が増えるという。'),
        dict(type='examine', x=11, y=6, event='desert_dig', dig=1), dict(type='prop', id='sand_mound', x=12, y=6),
        dict(type='examine', x=16, y=5, event='desert_dig', dig=2), dict(type='prop', id='sand_mound', x=17, y=5),
        dict(type='examine', x=13, y=9, event='desert_dig', dig=3), dict(type='prop', id='sand_mound', x=14, y=9),
        dict(type='spring', id='world_desert_spring', x=16, y=6, cond='desert_dig_found'),
        dict(type='prop', id='tent', x=45, y=21), dict(type='prop', id='tent', x=49, y=22), dict(type='prop', id='clay_jars', x=44, y=23),
        dict(type='prop', id='bones', x=50, y=25),
        dict(type='waylamp', id='wl_d_south_1', x=40, y=11, lit=True),
    ]
    a.meta = dict(name='沈んだ柱の浜', sub='カシムの南の砂丘', region='r_desert', worldRect=[150, 430, 140, 71], outside='dune_sand',
                  zones=[CARAVAN_ZONE, {'rect': None, 'zone': 'zw_desert'}],
                  links={'temple': {'map': 'd_south', 'spawn': 'temple'}},
                  npcs=[{'id': 'lost_camel', 'look': 'ani_camel', 'name': 'ラクダ', 'x': 40, 'y': 29, 'dir': 'w', 'move': 'still',
                         'cond': ['desert_camel_asked', '!desert_camel_found'], 'talk': 'desert_camel_world', 'reward': 'side', 'key': 'world_lost_camel'}])
    return a


def d_caravan():
    """隊商路: the caravan track south-west from Kasim over dune ridges and red rock outcrops. 岩の井戸 (camp 1): a ring of red rocks with a
    cleft into it; 星の石 (camp 2): a knoll of standing stones carved with stars, the path between two tall stones; the fork: the
    storm hollow's mouth (NW, the short way; blown shut by the storm until chosen) and the long road west to the coast."""
    a = Area('d_caravan', 60, 40, 505, base='s')
    W, H = a.W, a.H
    desert_ground(a, 3, 4, dune=0.48)
    # the storm hollow's walls reach in on the north-west
    a.region([(-3, -3), (20, -3), (18, 3), (13, 6.5), (6, 6.8), (-3, 6)], 'R', rough=0.8, seed=1, force=True)
    a.region([(-3, 11), (6, 11.5), (10, 14), (8, 18), (-3, 19)], 'R', rough=0.8, seed=2, force=True)
    # camp 1: the rock ring with the cleft (open to the south-west)
    ring = a.blob(44, 20, 5.2, 4.0, 'R', rough=0.25, seed=11, force=True)
    door(a, 42, 23, 1)
    a.rect(41, 24, 3, 1, 's', force=True, keep=True)
    # camp 2: the knoll of standing stones (S), the path between two tall stones at (16, 30)
    a.blob(16, 34, 5.5, 3.6, 'R', rough=0.2, seed=12, force=True)
    a.mark('stones', [(15, 30), (17, 30)], 'two TALL STANDING STONES carved with stars and crescent moons, flanking the path up onto the knoll', STONE)
    door(a, 16, 30, 1)
    a.rect(15, 31, 3, 1, 'R', force=True)
    # rock outcrops
    for (x, y, rx, ry, s_) in [(52, 32, 3.4, 2.4, 21), (28, 6, 2.2, 1.6, 22), (54, 5, 2.6, 2.0, 23), (6, 36, 2.6, 2.0, 24)]:
        a.blob(x, y, rx, ry, 'R', rough=0.3, seed=s_)
    # the track
    a.stroke([(30.5, -1), (31, 5), (29, 11), (30.5, 17), (27, 23), (19, 26.5), (9, 28.5), (-1, 29.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(31, 5), (40, 9.5), (50, 11.5), (60.5, 12.5)], 1.6, '.', seed=7)
    a.stroke([(29, 11), (20, 9.5), (11, 9), (-1, 8.5)], 1.4, ':', seed=8, force=True)
    a.stroke([(30.5, 17), (37, 21.5), (42, 24.5)], 1.4, ':', seed=9)
    a.stroke([(19, 26.5), (16.5, 29)], 1.2, ':', seed=10)
    a.scatter('r', 0.008, only='suk', seed=31, clear=1)
    a.scatter('b', 0.012, only='su', seed=32, clear=1)
    a.tidy()
    a.exit('n', 30, 31, {'map': 'd_west', 'spawn': 'south'}, 'north')
    a.exit('e', 12, 13, {'map': 'd_south', 'spawn': 'west'}, 'east')
    a.exit('w', 8, 9, {'map': 'd_hollow', 'spawn': 'caravan'}, 'hollow')
    a.exit('w', 29, 30, {'map': 'd_coast', 'spawn': 'caravan'}, 'coast')
    a.spawns['camp1'] = dict(x=42, y=24, dir='s')
    a.spawns['camp2'] = dict(x=16, y=29, dir='n')
    a.exits.append(dict(x=42, y=23, w=1, h=1, to={'map': 'desert_camp1', 'spawn': 'road'}))
    a.exits.append(dict(x=16, y=30, w=1, h=1, to={'map': 'desert_camp2', 'spawn': 'road'}))
    short = {'any': [{'choice': 'ch_desert_route', 'is': 'short'}, 'cleared_r_desert']}
    a.objects += [
        dict(type='sign', x=39, y=25, text='野営地「岩の井戸」'),
        dict(type='sign', x=19, y=29, text='野営地「星の石」'),
        dict(type='sign', x=8, y=10, text='砂嵐のくぼ地\n――風のやまない近道。'),
        dict(type='sign', x=27, y=13, text='西 → 西の浜（遠回り）\n北西 → 砂嵐のくぼ地（近道）'),
        dict(type='waylamp', id='wl_desert_beacon_2', x=23, y=27, lit='q_kasim_beacon_2', event='desert_beacon'),
        dict(type='prop', id='tent', x=39, y=22), dict(type='prop', id='copper_brazier', x=44, y=25), dict(type='prop', id='clay_jars', x=13, y=29),
        dict(type='prop', id='bones', x=33, y=34), dict(type='prop', id='cactus', x=47, y=15),
    ]
    a.meta = dict(name='隊商路', sub='野営地をつなぐ砂の道', region='r_desert', worldRect=[60, 440, 100, 61], outside='dune_sand',
                  zones=[CARAVAN_ZONE, {'rect': None, 'zone': 'zw_desert'}],
                  tilePatches=[{'cond': {'not': short}, 'rect': [0, 7, 2, 4], 'rows': ['RR', 'RR', 'RR', 'RR']}],
                  triggers=[{'id': 'desert_ambush_2', 'x': 24, 'y': 22, 'w': 5, 'h': 4, 'on': 'step', 'event': 'desert_ambush_2',
                             'cond': ['desert_caravan_on', '!desert_ambush_2_done']}],
                  links={'camp1': {'map': 'd_caravan', 'spawn': 'camp1'}, 'camp2': {'map': 'd_caravan', 'spawn': 'camp2'}}, npcs=[])
    return a


def d_hollow():
    """砂嵐のくぼ地: the short way. A basin walled by sandstone cliffs where the wind never stops: swirling dune ridges, wind-carved
    hoodoos and arches; the old camp in the lee of a rock overhang (desert_oldcamp); the track from the caravan road (E) to the mouth
    towards the royal tomb oasis (W)."""
    a = Area('d_hollow', 44, 36, 606, base='u')
    W, H = a.W, a.H
    a.mask_fill(fbm(3, W, H, 4) > 0.62, 's')
    a.mask_fill(fbm(4, W, H, 5) > 0.72, 'k', only='s')
    # the rim
    a.region([(-3, -3), (47, -3), (47, 39), (-3, 39), (-3, 11), (3, 9), (4, 4), (-3, 3)], 'R', rough=0.1, seed=1, force=True)
    inner = a.region([(3, 5.5), (12, 3), (26, 3.5), (38, 4), (41, 10), (40.5, 20), (41.5, 30), (32, 33), (18, 33), (6, 31), (3, 22), (3.5, 12)], 's', rough=1.3, seed=2, force=True, only='')
    a.mask_fill(inner, 'u', force=True)
    a.mask_fill(inner & (fbm(3, W, H, 4) > 0.6), 's', force=True)
    # the west mouth (rows 5-6) and the east mouth (rows 25-26)
    a.rect(0, 4, 5, 3, 'u', force=True)
    a.rect(39, 24, 5, 4, 'u', force=True)
    # hoodoos
    for (x, y, rx, ry, s_) in [(14, 12, 1.8, 1.5, 11), (30, 10, 2.2, 1.7, 12), (10, 24, 2.0, 1.6, 13), (33, 26, 1.4, 1.2, 14), (24, 29, 1.6, 1.2, 15), (36, 16, 1.3, 1.2, 16)]:
        a.blob(x, y, rx, ry, 'R', rough=0.3, seed=s_)
    # the overhang of the old camp (the shelter's mouth at (22, 17))
    a.blob(22, 14.5, 4.2, 2.8, 'R', rough=0.2, seed=21, force=True)
    door(a, 22, 17, 1)
    # the track
    a.stroke([(44.5, 25.5), (36, 22.5), (28, 20.5), (22, 18.5), (15, 16.5), (8, 9), (-1, 5)], 1.4, ':', seed=6)
    a.scatter('r', 0.012, only='suk', seed=31, clear=1)
    a.scatter('b', 0.008, only='su', seed=32, clear=1)
    a.tidy()
    a.exit('e', 25, 26, {'map': 'd_caravan', 'spawn': 'hollow'}, 'caravan')
    a.exit('w', 4, 6, {'map': 'd_coast', 'spawn': 'hollow'}, 'coast')
    a.spawns['oldcamp'] = dict(x=22, y=18, dir='s')
    a.exits.append(dict(x=22, y=17, w=1, h=1, to={'map': 'desert_oldcamp', 'spawn': 'road'}))
    a.objects += [
        dict(type='sign', x=38, y=23, text='砂嵐のくぼ地\n風の音にまぎれて、はぐれないように。'),
        dict(type='prop', id='bones', x=18, y=20), dict(type='prop', id='tent', x=25, y=19),
    ]
    a.meta = dict(name='砂嵐のくぼ地', sub='隊商路の近道', region='r_desert', worldRect=[54, 436, 40, 32], outside='rock',
                  zones=[{'rect': None, 'zone': 'zw_desert_storm'}],
                  triggers=[{'id': 'desert_ambush_3b', 'x': 12, 'y': 13, 'w': 5, 'h': 5, 'on': 'step', 'event': 'desert_ambush_3',
                             'cond': ['desert_caravan_on', '!desert_ambush_3_done']}],
                  links={'oldcamp': {'map': 'd_hollow', 'spawn': 'oldcamp'}}, npcs=[])
    return a


def d_coast():
    """西の浜: the long way along the western shore. The sea on the west, a pale beach with drift and shells, dunes; a mud-brick well hut
    (desert_wellroom) with its dry well; the road north to the royal tomb oasis: at the top a broken pillar and an obelisk by the road,
    palms, and the road entering a gap in a great sandstone cliff (desert_camp3)."""
    a = Area('d_coast', 44, 52, 707, base='s')
    W, H = a.W, a.H
    desert_ground(a, 3, 4, dune=0.52)
    a.region([(-3, -3), (7, -3), (5, 10), (8, 20), (6, 32), (9, 42), (7, 55), (-3, 55)], '~', rough=1.2, seed=1, force=True)
    a.region([(5, -3), (10, -3), (9, 10), (12, 20), (10, 32), (13, 42), (11, 55), (5, 55)], 's', rough=0.8, seed=2, only='uk')
    a.mask_fill(np.zeros((H, W), bool), 's')
    # the great cliff at the top with the gap of the oasis road (x 20-21)
    a.region([(8, -3), (47, -3), (47, 6), (30, 5.5), (23, 4.5), (22.5, -1), (19, -1), (18, 4), (12, 5.5), (9, 4)], 'R', rough=0.6, seed=3, force=True)
    # the east cliffs (the hollow's rim), the hollow's mouth at rows 14-15
    a.region([(36, 6), (47, 6), (47, 13), (40, 12.5), (37, 10)], 'R', rough=0.6, seed=4, force=True)
    a.region([(38, 17), (47, 16.5), (47, 34), (41, 30), (37, 23)], 'R', rough=0.8, seed=5, force=True)
    # the oasis approach: palms, grass
    a.blob(16, 9, 4, 2.6, ',', rough=0.3, seed=11, force=True)
    for (x, y) in [(13, 8), (15, 11), (27, 8), (25, 11), (12, 11)]: a.put(x, y, 'T', True)
    a.mark('obelisk', [(24, 7)], 'a tall weathered sandstone OBELISK carved with sun discs and a faceless king', STONE)
    a.mark('pillar', [(17, 7)], 'a BROKEN SANDSTONE PILLAR, its top fallen beside it', STONE)
    # the well hut
    hut = [(x, y) for x in range(22, 26) for y in range(30, 33)]
    a.mark('hut', hut, 'a small square MUD-BRICK HUT with a flat roof of palm trunks and a low wooden door in its south wall (the dark block), a dry stone well beside it', MUDBRICK)
    door(a, 23, 32, 1)
    a.mark('well', [(27, 32)], "a DRY round stone WELL with a wooden winch frame", (120, 110, 100))
    # roads
    a.stroke([(44.5, 44.5), (34, 44), (24, 40.5), (19, 34), (20, 26), (22, 18), (21, 11), (20.5, 5), (20.5, -1)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(22, 18), (30, 15.5), (44.5, 14.5)], 1.4, ':', seed=7)
    a.stroke([(20, 34), (23, 33.5)], 1.2, ':', seed=8)
    a.scatter('r', 0.008, only='suk', seed=31, clear=1)
    a.scatter('b', 0.010, only='u', seed=32, clear=1)
    a.tidy()
    a.exit('n', 20, 21, {'map': 'desert_camp3', 'spawn': 'road'}, 'camp3')
    a.exit('e', 14, 15, {'map': 'd_hollow', 'spawn': 'coast'}, 'hollow')
    a.exit('e', 44, 45, {'map': 'd_caravan', 'spawn': 'coast'}, 'caravan')
    a.spawns['wellroom'] = dict(x=23, y=33, dir='s')
    a.exits.append(dict(x=23, y=32, w=1, h=1, to={'map': 'desert_wellroom', 'spawn': 'road'}))
    a.objects += [
        dict(type='sign', x=18, y=6, text='王墓のオアシス\n北 → 名のない王の墓'),
        dict(type='sign', x=26, y=35, text='古い井戸の小屋'),
        dict(type='waylamp', id='wl_desert_beacon_3', x=24, y=21, lit='q_kasim_beacon_3', event='desert_beacon'),
        dict(type='prop', id='bones', x=14, y=26), dict(type='prop', id='clay_jars', x=21, y=31),
    ]
    a.meta = dict(name='西の浜', sub='遠回りの浜の道と王墓のオアシス', region='r_desert', worldRect=[24, 400, 40, 101], outside='sea',
                  zones=[CARAVAN_ZONE, {'rect': None, 'zone': 'zw_desert'}],
                  triggers=[{'id': 'desert_ambush_3', 'x': 17, 'y': 36, 'w': 6, 'h': 4, 'on': 'step', 'event': 'desert_ambush_3',
                             'cond': ['desert_caravan_on', '!desert_ambush_3_done']}],
                  links={'camp3': {'map': 'd_coast', 'spawn': 'camp3'}, 'wellroom': {'map': 'd_coast', 'spawn': 'wellroom'}}, npcs=[])
    return a


AREAS = {k: v for k, v in globals().items() if k.startswith('d_') and callable(v)}

if __name__ == '__main__':
    for aid in sys.argv[1:]:
        a = AREAS[aid]()
        a.save(aid)
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
