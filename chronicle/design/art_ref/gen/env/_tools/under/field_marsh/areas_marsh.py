"""Layouts of the painted FIELD areas of the marsh (グレイモア湿原 r_marsh; area switching like the demo's ../field/areas.py and
../field_desert/areas_desert.py).
usage: python3 areas_marsh.py <id> [...]   -> <id>/layout.json + ascii on stdout (then guide.py <id>)
The areas replace the walk over the old world map inside the region (tools/gen_world_marsh.js): every place, examine and sign that stood
there is placed here with the same events. Map ids m_* (v2/src/maps/marsh_field_*.js).
Chars (lib.py): , peat grass   ; sedge tussocks   " marsh flowers   . mud road   : footpath   s mud flat   = boardwalk / plank bridge
c old flagstones   ~ open lake water (teal)   w black bog pool   T willow / dead swamp tree   F drowned dead wood   b reed bed
r boulder / stump   R grey rock ridge   X built (ruins, huts, the manor, fences)."""
import sys
import numpy as np
from lib import Area, fbm, WALK

STONE = (150, 150, 140)
TIMBER = (120, 88, 58)
DARK = (40, 26, 16)
MANOR = (120, 122, 132)


def marsh_ground(a, s1, s2, s3, sedge=0.6, flowers=0.72, mud=0.78):
    W, H = a.W, a.H
    a.mask_fill(fbm(s1, W, H, 7) > sedge, ';', only=',')
    a.mask_fill(fbm(s2, W, H, 4) > flowers, '"', only=',')
    a.mask_fill(fbm(s3, W, H, 6) > mud, 's', only=',;')


def wet(a, seed, thr=0.7, reed=0.45):
    """scattered black pools with broken reed fringes over the open peat (roads and marks are kept)"""
    m = (fbm(seed, a.W, a.H, 4) > thr) & np.isin(a.g, list(',;"s')) & ~a.keep
    a.mask_fill(m, 'w')
    reeds_along(a, m, 1, seed=seed + 1, thr=reed)


def door(a, x, y, w=1, text='a dark ENTRANCE'):
    a.mark('door', [(x + i, y) for i in range(w)], text, DARK, solid=False)
    a.rect(x, y, w, 1, ':', force=True, keep=True)


def cross(a, water, road, ch='='):
    """cells where a road crosses water become a boardwalk"""
    for (x, y) in road & water:
        if a.inb(x, y): a.put(x, y, ch, True); a.keep[y, x] = True


def reeds_along(a, m, width=1, seed=0, thr=0.35):
    """a broken fringe of reeds on the grass next to the water mask m"""
    from scipy import ndimage
    ring = ndimage.binary_dilation(m, iterations=width) & ~m
    n = fbm(a.seed * 3 + seed, a.W, a.H, 3)
    a.mask_fill(ring & (n > thr), 'b', only=',;"s')


def m_north():
    """霧の入口: the mountain road from the north drops through a notch in a grey rocky ridge (the rim of the plateau) onto the first
    peat meadows of the marsh. A reedy channel crosses the land (a boardwalk carries the road over it), black pools in reed beds,
    a crumbling round stone watchtower on a knoll, a turf-roofed peat-cutter's hut with stacks of cut peat. The road goes on south
    towards the lake town."""
    a = Area('m_north', 52, 40, 1101, base=',')
    W, H = a.W, a.H
    marsh_ground(a, 3, 4, 5)
    # the ridge (N) with the notch for the road
    a.region([(-3, -3), (23.2, -3), (23.2, 2.5), (19, 5.5), (11, 7.5), (3, 7), (-3, 8.5)], 'R', rough=0.7, seed=1, force=True)
    a.region([(28.8, -3), (55, -3), (55, 7.5), (46, 8.5), (37, 6.5), (31, 4.5), (28.8, 2.5)], 'R', rough=0.7, seed=2, force=True)
    ys, xs = np.mgrid[0:H, 0:W]
    a.mask_fill((fbm(9, W, H, 3) > 0.62) & (ys < 12), 'r', only=',;"s')      # scree at the foot of the ridge
    # the reedy channel (W -> E) and its reed banks
    ch = a.stroke([(-1, 22), (7, 20.5), (15, 21.5), (22, 20.2), (30, 18.8), (39, 20.5), (46, 19.5), (53, 20.5)], 2.4, 'w', keep=False, wobble=0.5, seed=4, force=True)
    wm = np.zeros((H, W), bool)
    for (x, y) in ch:
        if a.inb(x, y): wm[y, x] = True
    # black pools in the reed beds
    for (x, y, rx, ry, s_) in [(7, 30, 3.2, 2.2, 11), (44, 30, 3.6, 2.4, 12), (40, 12.5, 2.4, 1.6, 13), (12, 13, 1.8, 1.3, 14)]:
        wm |= a.blob(x, y, rx, ry, 'w', rough=0.3, seed=s_, force=True)
    # reed beds around the pools and along the channel
    for (x, y, rx, ry, s_) in [(7, 30, 6.5, 4.8, 21), (44, 30, 7.0, 5.0, 22), (3, 18, 3.5, 2.5, 23), (49, 17, 3, 2.4, 24)]:
        a.blob(x, y, rx, ry, 'b', rough=0.45, seed=s_, only=',;"s')
    reeds_along(a, wm, 1, seed=5, thr=0.4)
    # the road (keeps its cells); where it crosses the channel it is a boardwalk
    road = a.stroke([(25.5, -1), (25.5, 4), (24, 9), (21.5, 14.5), (22.5, 20), (26, 25.5), (28, 31), (26.5, 36), (26.5, 40.5)], 2.0, '.', wobble=0.2, seed=6)
    cross(a, {(x, y) for (x, y) in ch}, road)
    # footpath to the watchtower knoll and to the peat-cutter's hut
    a.stroke([(23.5, 12), (29, 13), (33.5, 14.5)], 1.2, ':', seed=7)
    a.stroke([(22, 16), (16, 15.5), (11.5, 16)], 1.2, ':', seed=8)
    # the watchtower (a round ruin of grey stone on a knoll)
    tw = [(x, y) for x in range(33, 36) for y in range(11, 14)]
    a.mark('tower', tw, 'a crumbling ROUND WATCHTOWER of grey stone blocks seen from above, its top broken off, moss and ivy on it, a dark doorless gap at its foot facing south', STONE)
    # the peat-cutter's hut and peat stacks
    hut = [(x, y) for x in range(9, 13) for y in range(13, 15)]
    a.mark('hut', hut, "a low PEAT-CUTTER'S HUT with a mossy turf roof and plank walls, stacks of cut dark-brown peat bricks beside it", TIMBER)
    wet(a, 51, 0.7)
    a.scatter('T', 0.012, only=',;', seed=31, clear=1)
    a.scatter('r', 0.006, only=',;s', seed=32, clear=1)
    a.tidy()
    a.exit('n', 24, 26, {'map': 'world', 'spawn': 'marsh_n'}, 'north')
    a.exit('s', 25, 27, {'map': 'm_west', 'spawn': 'north'}, 'south')
    a.objects += [
        dict(type='sign', x=27, y=6, text='グレイモア湿原\n南 → 水辺の町ロッホ'),
        dict(type='examine', x=34, y=14, event='marsh_field_tower'),
        dict(type='examine', x=35, y=14, event='world_poi_cache', item='i_ether', key='marsh_tower'),
        dict(type='waylamp', id='wl_m_north_1', x=27, y=15, lit=True),
        dict(type='waylamp', id='wl_m_north_2', x=24, y=33, lit=True),
        dict(type='prop', id='log', x=13, y=16),
    ]
    a.meta = dict(name='霧の入口', sub='山あいの街道から湿原へ下りる所', region='r_marsh', worldRect=[475, 166, 54, 33], outside='marsh_water',
                  zones=[{'rect': None, 'zone': 'zw_marsh_road'}],
                  links={},
                  npcs=[{'id': 'peat_cutter', 'look': 'npc_marsh_woman', 'name': '泥炭掘り', 'x': 14, 'y': 17, 'dir': 's', 'move': 'still',
                         'talk': {'lines': [{'text': ['泥炭を掘って、干して、\nロッホへ売りに行くのさ。', '霧の濃い晩は、道の板を\n踏み外さないようにね。\n沼は底なしだよ。']}]}, 'reward': None}])
    return a


def m_west():
    """ロッホの西の岸: misty lochside. The shallow grey-green lake of the town fills the east; a long boardwalk pier runs from the
    shore out over the water to the west gate of the lake town (east edge); small bell towers on stilts stand in the lake; reeds fringe
    the shore. On the west shore willows, peat meadows and black pools, a fishing hamlet: a stilt hut with drying nets and a short jetty
    with a moored flat punt, and a collapsed stilt hut whose roof leans over the water. The road runs north-south along the shore."""
    a = Area('m_west', 56, 44, 1202, base=',')
    W, H = a.W, a.H
    marsh_ground(a, 3, 4, 5, mud=0.74)
    lake = a.region([(31, -3), (59, -3), (59, 47), (35, 47), (32, 38), (34.5, 30), (30, 23), (32.5, 13), (29.5, 5)], '~', rough=1.2, seed=1, force=True)
    reeds_along(a, lake, 2, seed=2, thr=0.42)
    # the reed border of the lake town (east edge), open where the pier comes in
    for y in range(H):
        for x in range(53, 56):
            if y in (19, 20, 21, 22): continue
            if x == 53 and (x * 7 + y * 13) % 5 < 2: continue
            a.put(x, y, 'b', True)
    # pools and willows on the west shore
    for (x, y, rx, ry, s_) in [(7, 15, 2.8, 1.8, 11), (10, 29, 3.4, 2.2, 12), (4, 40, 2.4, 1.6, 13)]:
        m = a.blob(x, y, rx, ry, 'w', rough=0.3, seed=s_, force=True)
        reeds_along(a, m, 1, seed=s_, thr=0.3)
    for (x, y, rx, ry, s_) in [(4, 6, 2.6, 2.0, 21), (13, 36, 2.2, 1.8, 22), (5, 23, 2.0, 1.8, 23), (14, 3, 1.8, 1.5, 24)]:
        a.blob(x, y, rx, ry, 'T', rough=0.3, seed=s_, only=',;"s')
    # the road along the shore and the spur to the pier
    a.stroke([(20.5, -1), (20.5, 6), (18.5, 12), (19.5, 17), (22, 21), (21, 27), (18.5, 33), (20, 39), (21, 44.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(22, 21), (26, 20.5), (29.5, 20.5)], 2.0, '.', seed=7)
    # the pier to the town gate (rows 20-21)
    pier = [(x, y) for x in range(28, 56) for y in (20, 21)]
    a.mark('pier', pier, 'a long wide BOARDWALK PIER of weathered planks on posts running over the water to the lake town (walkable deck)', (150, 102, 60), solid=False)
    for (x, y) in pier: a.put(x, y, '=', True)
    # little bell towers on stilts in the lake
    for (x, y) in [(43, 8), (46, 33)]:
        a.mark('belltower', [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)], 'a small wooden BELL TOWER on tall stilts standing in the water, a little shingled roof, a bell under it', TIMBER)
    # the fishing hamlet: a stilt hut with a jetty and a punt
    hut = [(x, y) for x in range(25, 29) for y in range(11, 13)]
    a.mark('hut', hut, 'a FISHERMAN\'S HUT on short stilts at the shore with a thatched roof, fishing nets hung to dry on poles beside it', TIMBER)
    a.rect(27, 13, 2, 1, ':', force=True, keep=True)
    jetty = [(x, 14) for x in range(29, 34)]
    for (x, y) in jetty: a.put(x, y, '=', True); a.keep[y, x] = True
    a.stroke([(21, 14.5), (26, 14), (29, 14)], 1.2, ':', seed=8)
    # the collapsed stilt hut (half in the water)
    ruin = [(x, y) for x in range(29, 32) for y in range(29, 31)]
    a.mark('ruin', ruin, 'a COLLAPSED STILT HUT: broken floor boards and snapped stilts, its sagging thatched roof leaning over the water', (110, 84, 60))
    a.stroke([(21, 30), (25, 30.5), (28, 30.5)], 1.2, ':', seed=9)
    wet(a, 52, 0.72)
    a.scatter('T', 0.008, only=',;', seed=31, clear=1)
    a.scatter('r', 0.004, only=',;s', seed=32, clear=1)
    a.tidy()
    a.exit('n', 19, 21, {'map': 'm_north', 'spawn': 'south'}, 'north')
    a.exit('e', 20, 21, {'map': 'loch', 'spawn': 'gate_w'}, 'loch')
    a.exit('s', 20, 22, {'map': 'm_fen', 'spawn': 'north'}, 'south')
    a.objects += [
        dict(type='sign', x=26, y=18, text='水辺の町ロッホ\n――湖の上の、鐘の町'),
        dict(type='examine', x=28, y=30, event='world_poi_marsh_stilt'),
        dict(type='prop', id='mud_boat', x=34, y=15),
        dict(type='waylamp', id='wl_m_west_pier', x=25, y=23, lit=True),
        dict(type='waylamp', id='wl_m_west_road', x=17, y=38, lit=True),
        dict(type='waylamp', id='wl_m_west_north', x=17, y=7, lit=True),
    ]
    a.meta = dict(name='ロッホの西の岸', sub='湖の町へ渡る桟橋', region='r_marsh', worldRect=[481, 193, 51, 54], outside='marsh_water',
                  zones=[{'rect': None, 'zone': 'zw_marsh_road'}],
                  links={'loch': {'map': 'm_west', 'spawn': 'loch'}},
                  npcs=[{'id': 'shore_fisher', 'look': 'npc_marsh_old_m', 'name': '岸の漁師', 'x': 31, 'y': 13, 'dir': 's', 'move': 'still',
                         'talk': {'lines': [{'text': ['湖のくいの鐘楼は、七つある。\n今は、どれも鳴らん。', '鐘が鳴らなくなってから、\n霧が町の中まで入ってくる。']},
                                            {'cond': 'cleared_r_marsh', 'text': '朝の鐘が、また鳴った。\n魚もよく跳ねるよ。'}]}, 'reward': None}])
    return a


def m_manor():
    """枯れ柳の庭: east of the lake town. From its east gate an old stone causeway runs over the water into a drowned wood of dead
    willows and black pools; a footpath winds through it to the grounds of the Mist Manor: an overgrown garden inside a rusted iron
    fence, mossy graves, and the grey manor with slate roofs and a spire (its door on the south face). A path leaves south."""
    a = Area('m_manor', 52, 44, 1303, base=',')
    W, H = a.W, a.H
    marsh_ground(a, 3, 4, 5, flowers=0.8)
    # the lake of the town (W) with its reed fringe, and the causeway (rows 20-21)
    lake = a.region([(-3, 8), (8, 9.5), (11, 15), (10, 27), (7, 34), (-3, 35)], '~', rough=1.0, seed=1, force=True)
    reeds_along(a, lake, 1, seed=2, thr=0.35)
    cw = [(x, y) for x in range(0, 12) for y in (20, 21)]
    a.mark('causeway', cw, 'an old STONE CAUSEWAY of grey flagstones with low mossy parapet stones along both sides, running over the water (walkable)', STONE, solid=False)
    for (x, y) in cw: a.put(x, y, 'c', True)
    # the drowned dead wood (middle and south) with black pools
    for (poly, s_) in [([(12, 25), (22, 23), (24, 30), (19, 38), (10, 40), (8, 33)], 11), ([(28, 24), (40, 22), (50, 26), (52, 40), (36, 41), (30, 34)], 12),
                       ([(12, 3), (22, 2), (24, 10), (18, 15), (12, 13)], 13)]:
        a.region(poly, 'F', rough=1.2, seed=s_, only=',;"s')
    for (x, y, rx, ry, s_) in [(17, 31, 2.8, 2.0, 21), (38, 31, 3.4, 2.4, 22), (46, 36, 2.4, 1.8, 23), (17, 8, 2.2, 1.6, 24), (29, 20, 2.0, 1.4, 25)]:
        a.blob(x, y, rx, ry, 'w', rough=0.3, seed=s_, force=True)
    # the manor grounds (NE): fence, garden, manor
    fx0, fy0, fx1, fy1 = 27, 1, 49, 16
    fence = [(x, y) for x in range(fx0, fx1 + 1) for y in (fy0, fy1)] + [(x, y) for y in range(fy0, fy1 + 1) for x in (fx0, fx1)]
    gate = {(37, fy1), (38, fy1)}
    fence = [c for c in fence if c not in gate]
    a.rect(fx0 + 1, fy0 + 1, fx1 - fx0 - 1, fy1 - fy0 - 1, ',', force=True)
    a.mark('fence', fence, 'a rusted WROUGHT-IRON FENCE with spiked bars between square mossy stone posts, enclosing the manor garden (a gap for the gate in the south side)', (70, 70, 76))
    mn = [(x, y) for x in range(31, 45) for y in range(2, 10)]
    a.mark('manor', mn, 'a gloomy two-storey MANOR HOUSE of grey stone seen from above: steep dark slate roofs with gables and chimneys, a tall pointed SPIRE tower at its west end, narrow dark windows, ivy, its arched front DOOR in the middle of the south face (the dark cell)', MANOR)
    door(a, 38, 9, 1, 'the manor\'s arched front DOOR (dark)')
    a.rect(34, 10, 8, 3, 'c', force=True, keep=True)   # the forecourt
    a.stroke([(37.5, 12), (37.5, 16.5)], 2.0, 'c', seed=6)
    for (x, y, rx, ry, s_) in [(29.5, 5, 1.5, 3.2, 31), (47, 5, 1.5, 3.0, 32), (30, 13.5, 2.0, 1.4, 33)]:
        a.blob(x, y, rx, ry, 'T', rough=0.3, seed=s_, only=',;"s')
    # paths: causeway -> manor gate; junction -> south exit
    a.stroke([(11, 20.5), (16, 20.5), (22, 19), (30, 18.5), (37.5, 18), (37.5, 16)], 2.0, ':', wobble=0.2, seed=7)
    a.stroke([(22, 19.5), (24, 26), (25, 33), (24, 38), (24, 44.5)], 2.0, ':', wobble=0.2, seed=8)
    wet(a, 53, 0.74)
    a.scatter('T', 0.014, only=',;', seed=41, clear=1)
    a.scatter('r', 0.004, only=',;s', seed=42, clear=1)
    a.tidy()
    a.exit('w', 20, 21, {'map': 'loch', 'spawn': 'gate_e'}, 'loch')
    a.exit('s', 23, 25, {'map': 'm_lotus', 'spawn': 'north'}, 'south')
    a.spawns['manor'] = dict(x=38, y=10, dir='s')
    a.objects.append(dict(type='door', x=38, y=9, w=1, look='none', to={'map': 'marsh_manor_1', 'spawn': 'entrance'}))   # 描いた扉（確かめの文は CONFIRM）
    a.objects += [
        dict(type='sign', x=40, y=18, text='霧の館\n夜ごと、楽の音が聞こえる。'),
        dict(type='prop', id='grave_moss', x=30, y=10), dict(type='prop', id='grave_moss', x=46, y=12), dict(type='prop', id='grave_moss', x=44, y=14),
        dict(type='prop', id='pale_mushrooms', x=33, y=14),
        dict(type='waylamp', id='wl_m_manor_gate', x=33, y=19, lit=True),
        dict(type='waylamp', id='wl_m_manor_cw', x=13, y=23, lit=True),
    ]
    a.meta = dict(name='枯れ柳の庭', sub='霧の館へ続く沈んだ林', region='r_marsh', worldRect=[571, 181, 51, 54], outside='marsh_water',
                  zones=[{'rect': None, 'zone': 'zw_marsh'}],
                  links={'loch_e': {'map': 'm_manor', 'spawn': 'loch'}, 'manor': {'map': 'm_manor', 'spawn': 'manor'}}, npcs=[])
    return a


def m_fen():
    """沈んだ礼拝堂の原: an open peat fen south of the lake town. In a wide stretch of open water in the middle stand the broken
    pointed arches and pillar stumps of a drowned stone chapel; part of its flagstone nave is still above the water and a plank walk
    leads out to it. Pieces of an old flagstone causeway along the road, black pools, reed beds, dead trees. The road comes from the
    north, runs round the west of the water and leaves south; a path branches east along the south shore."""
    a = Area('m_fen', 56, 44, 1404, base=',')
    W, H = a.W, a.H
    marsh_ground(a, 3, 4, 5)
    water = a.region([(19, 8), (31, 6), (43, 9), (46, 17), (42, 26), (30, 29), (21, 26), (17, 17)], '~', rough=1.3, seed=1, force=True)
    reeds_along(a, water, 2, seed=2, thr=0.45)
    # the chapel nave (an island of flagstones) and its broken arches / pillars in the water
    a.rect(26, 15, 7, 5, 'c', force=True, keep=True)
    for (x, y) in [(25, 14), (33, 14), (25, 20), (33, 20), (29, 13), (35, 17)]:   # (23, 17) は板の道の上なので描かせない
        a.mark('pillar', [(x, y)], 'broken PILLAR STUMPS and a fallen pointed ARCH of a drowned stone CHAPEL standing in the water, mossy grey stone', STONE)
    apse = [(x, y) for x in range(28, 31) for y in (11, 12)]
    a.mark('apse', apse, 'the broken APSE wall of the drowned chapel, a tall pointed ARCH window frame still standing, grey stone with moss', STONE)
    # the plank walk from the road to the nave
    pw = a.stroke([(14.5, 17.5), (20, 17.5), (26, 17.5)], 2.0, '=', seed=6)
    # black pools and reed beds elsewhere
    for (x, y, rx, ry, s_) in [(6, 8, 3.0, 2.0, 11), (48, 35, 3.6, 2.4, 12), (8, 36, 2.8, 2.0, 13), (50, 5, 2.4, 1.8, 14), (38, 38, 2.0, 1.4, 15)]:
        m = a.blob(x, y, rx, ry, 'w', rough=0.3, seed=s_, force=True)
        reeds_along(a, m, 1, seed=s_ + 5, thr=0.3)
    for (x, y, rx, ry, s_) in [(48, 12, 4, 3, 21), (4, 22, 3, 3.5, 22), (52, 26, 2.5, 3, 23)]:
        a.blob(x, y, rx, ry, 'b', rough=0.4, seed=s_, only=',;"s')
    # the road (N -> round the west of the water -> S) and the path east
    a.stroke([(21, -1), (20, 4), (15, 9), (12.5, 16), (13, 23), (17, 29), (23, 33), (27.5, 37), (27.5, 44.5)], 2.0, '.', wobble=0.2, seed=7)
    a.stroke([(23, 33), (32, 32.5), (42, 31), (49, 30.5), (56.5, 30.5)], 1.6, ':', wobble=0.2, seed=8)
    # the old flagstone causeway pieces along the road
    for (x, y) in [(13, 21), (14, 21), (13, 22), (14, 23), (16, 27), (17, 28), (18, 29)]:
        if a.g[y, x] == '.': a.put(x, y, 'c', True)
    wet(a, 54, 0.68)
    a.scatter('T', 0.012, only=',;', seed=31, clear=1)
    a.scatter('r', 0.005, only=',;s', seed=32, clear=1)
    a.tidy()
    a.exit('n', 20, 22, {'map': 'm_west', 'spawn': 'south'}, 'north')
    a.exit('s', 26, 28, {'map': 'm_bog', 'spawn': 'north'}, 'south')
    a.exit('e', 30, 31, {'map': 'm_lotus', 'spawn': 'west'}, 'east')
    a.objects += [
        dict(type='sign', x=11, y=14, text='沈んだ礼拝堂\n水の底から、歌が聞こえるという。'),
        dict(type='examine', x=29, y=14, event='marsh_field_chapel'),
        dict(type='waylamp', id='wl_m_fen_1', x=17, y=7, lit=True),
        dict(type='waylamp', id='wl_m_fen_2', x=24, y=37, lit=True),
        dict(type='prop', id='rotten_stump', x=9, y=27),
    ]
    a.meta = dict(name='沈んだ礼拝堂の原', sub='ロッホの南の泥炭の原', region='r_marsh', worldRect=[499, 241, 60, 48], outside='marsh_water',
                  zones=[{'rect': None, 'zone': 'zw_marsh'}], links={}, npcs=[])
    return a


def m_lotus():
    """はすの池: a round pool thick with lotus leaves and closed lotus buds among low peat hummocks, pale mushrooms and willows east of
    the fen; a plank jetty runs out from the south shore to the middle of the pool; small lamp posts stand in the water. Paths lead
    west (the fen) and north (to the manor's wood)."""
    a = Area('m_lotus', 44, 36, 1505, base=',')
    W, H = a.W, a.H
    marsh_ground(a, 3, 4, 5, flowers=0.64)
    pool = a.blob(21, 14, 11, 7.5, '~', rough=0.2, seed=1, force=True)
    reeds_along(a, pool, 1, seed=2, thr=0.55)
    jetty = [(x, y) for x in (20, 21) for y in range(15, 24)]
    for (x, y) in jetty: a.put(x, y, '=', True); a.keep[y, x] = True
    a.rect(19, 15, 4, 2, '=', force=True, keep=True)
    for (x, y, rx, ry, s_) in [(4, 5, 3.0, 2.4, 21), (39, 5, 3.0, 2.6, 22), (5, 30, 2.6, 2.0, 23), (39, 30, 3.2, 2.2, 24), (34, 23, 1.6, 1.4, 25)]:
        a.blob(x, y, rx, ry, 'T', rough=0.3, seed=s_, only=',;"s')
    for (x, y, rx, ry, s_) in [(11, 29, 2.2, 1.5, 31), (33, 31, 2.0, 1.4, 32)]:
        a.blob(x, y, rx, ry, 'w', rough=0.3, seed=s_, force=True)
    a.stroke([(-1, 20.5), (8, 22), (15, 25), (20.5, 25.5), (26, 25), (33, 21), (36, 14), (34, 6), (31.5, -1)], 1.6, ':', wobble=0.2, seed=6)
    wet(a, 55, 0.74)
    a.scatter('T', 0.008, only=',;', seed=41, clear=1)
    a.tidy()
    a.exit('w', 20, 21, {'map': 'm_fen', 'spawn': 'east'}, 'west')
    a.exit('n', 30, 32, {'map': 'm_manor', 'spawn': 'south'}, 'north')
    a.objects += [
        dict(type='examine', x=21, y=14, event='marsh_lotus'),
        dict(type='sign', x=17, y=27, text='はすの池\n消灯の刻に、青く光る蓮が咲くという。'),
        dict(type='prop', id='wisp_lamp', x=14, y=11), dict(type='prop', id='wisp_lamp', x=28, y=10), dict(type='prop', id='wisp_lamp', x=27, y=18),
        dict(type='prop', id='pale_mushrooms', x=8, y=18), dict(type='prop', id='pale_mushrooms', x=36, y=26), dict(type='prop', id='pale_mushrooms', x=31, y=4),
        dict(type='waylamp', id='wl_m_lotus', x=24, y=28, lit=True),
    ]
    a.meta = dict(name='はすの池', sub='消灯の刻に光る蓮', region='r_marsh', worldRect=[559, 253, 42, 36], outside='marsh_water',
                  zones=[{'rect': None, 'zone': 'zw_marsh_lotus'}], links={}, npcs=[])
    return a


def m_bog():
    """鐘沈みの沼の縁: the edge of the Bell-Sunk Bog, south of the fen. A wall of drowned black dead trees on the west with a narrow
    gap where the path enters the bog (thick mist there before the assembly); an old stone stele carved with the bell song beside the
    path; wooden bell frames standing in the dark water; a stone bell tower sunk to its belfry in a pool on the east, reached by a
    short plank walk; the road runs north-south (south: to the tide bridge and the ash lands)."""
    a = Area('m_bog', 52, 44, 1606, base=',')
    W, H = a.W, a.H
    marsh_ground(a, 3, 4, 5, flowers=0.82, mud=0.62)
    # the drowned dead wood (W) and a band of it along the south-west
    a.region([(-3, 4), (6, 5), (10, 12), (9.5, 19.5), (8.5, 25), (11, 31), (8, 40), (-3, 42)], 'F', rough=1.0, seed=1, force=True)
    a.region([(40, -3), (55, -3), (55, 10), (46, 9), (42, 4)], 'F', rough=1.0, seed=2, force=True)
    # dark water: the bog's pools
    pools = np.zeros((H, W), bool)
    for (x, y, rx, ry, s_) in [(15, 9, 4.0, 2.6, 11), (14, 36, 4.4, 2.8, 12), (45, 30, 5.0, 3.4, 13), (35, 12, 3.0, 2.0, 14), (41, 40, 3.2, 2.0, 15)]:
        pools |= a.blob(x, y, rx, ry, 'w', rough=0.35, seed=s_, force=True)
    tower_pool = a.blob(42, 21, 5.2, 3.8, 'w', rough=0.3, seed=16, force=True)
    reeds_along(a, pools | tower_pool, 1, seed=3, thr=0.45)
    # the bog mouth: a gap in the dead wood (row 22)
    a.rect(6, 21, 5, 3, ',', force=True)
    door(a, 6, 22, 1, 'a dark narrow GAP between black dead trees where a path disappears into the bog')
    # the sunken bell tower in the east pool, and the plank walk to it
    tw = [(x, y) for x in (42, 43) for y in (20, 21)]
    a.mark('belltower', tw, 'an old square STONE BELL TOWER sunk into the bog to its belfry: only the mossy top with its open arches and a rusted tilted BELL shows above the dark water', STONE)
    a.stroke([(31, 21), (37, 21), (40.5, 21)], 1.2, '=', seed=4)
    # the song stele by the path
    a.mark('stele', [(18, 26)], 'an old weathered STONE STELE (upright slab) carved with lines of text, moss on its top', STONE)
    # roads: N -> S; the path west into the bog mouth; the path to the stele
    a.stroke([(26, -1), (25.5, 6), (22.5, 12), (24, 18), (27, 24), (28, 30), (26.5, 36), (26.5, 44.5)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(24, 20), (17, 21.5), (11, 22), (7, 22)], 1.6, ':', wobble=0.1, seed=7)
    a.stroke([(26, 25), (21, 27), (18.5, 27.5)], 1.2, ':', seed=8)
    a.stroke([(27, 21), (31, 21)], 1.2, ':', seed=9)
    wet(a, 56, 0.68)
    a.scatter('T', 0.016, only=',;', seed=31, clear=1)
    a.scatter('r', 0.005, only=',;s', seed=32, clear=1)
    a.tidy()
    a.exit('n', 25, 27, {'map': 'm_fen', 'spawn': 'south'}, 'north')
    a.exit('s', 25, 27, {'map': 'world', 'spawn': 'marsh_s'}, 'south')['cond'] = {'not': {'slice': True}}
    a.spawns['bog'] = dict(x=7, y=22, dir='e')
    a.objects.append(dict(type='door', x=6, y=22, w=1, look='none', to={'map': 'marsh_bog', 'spawn': 'entrance'}, cond='marsh_assembly_done'))   # 霧の壁が晴れてから
    a.objects += [
        dict(type='examine', x=6, y=22, event='marsh_mistwall', cond={'not': 'marsh_assembly_done'}),
        dict(type='examine', x=18, y=26, event='marsh_songstone'),
        dict(type='examine', x=41, y=21, event='world_poi_marsh_bell'),
        dict(type='sign', x=15, y=20, text='鐘沈みの沼\n――霧の来る所'),
        dict(type='sign', x=29, y=40, text='南 → 潮見橋・灰の荒野'),
        dict(type='prop', id='bell_frame', x=35, y=12), dict(type='prop', id='bell_frame', x=14, y=36), dict(type='prop', id='bell_frame', x=46, y=31),
        dict(type='waylamp', id='wl_m_bog_1', x=23, y=8, lit=True),
        dict(type='waylamp', id='wl_m_bog_2', x=29, y=36, lit=True),
    ]
    a.meta = dict(name='鐘沈みの沼の縁', sub='霧の来る所', region='r_marsh', worldRect=[523, 283, 56, 59], outside='marsh_water',
                  zones=[{'rect': None, 'zone': 'zw_marsh'}],
                  links={'bog': {'map': 'm_bog', 'spawn': 'bog'}}, npcs=[])
    return a


AREAS = {k: v for k, v in globals().items() if k.startswith('m_') and callable(v)}

if __name__ == '__main__':
    for aid in sys.argv[1:]:
        a = AREAS[aid]()
        a.save(aid)
        print(a.ascii())
        sp = list(a.spawns.values())
        seen = a.reach(sp[0]['x'], sp[0]['y'])
        for k, s in a.spawns.items(): print('spawn', k, s, 'reach', bool(seen[s['y'], s['x']]))
        for o in a.objects + [dict(type='exit', **e) for e in a.exits] + a.meta.get('npcs', []):
            x, y = o['x'], o['y']
            nb = [(x + dx, y + dy) for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)) if a.inb(x + dx, y + dy)]
            r = any(seen[j, i] for i, j in nb)
            if not r or '-v' in sys.argv: print('obj', o.get('type', 'npc'), o.get('id') or o.get('event') or o.get('to', ''), (x, y), a.g[y, x], 'reach', r)
        print('walkable', int(a.walk().sum()), 'reached', int(seen.sum()))
