"""Layouts of the painted maps of the Marea isles (マレア諸島 r_isles): the field areas of the main island (i_cliff, i_cove, i_cape),
the islets reached by the own ship (i_light, i_siren, i_crab, i_wreck), the towns (coral, nerei) and the dungeon floors (isles_cave_1/2,
ghost_ship_1/2/3). Area switching like the demo's ../field/areas.py and the ash's ../field_ash/areas_ash.py.
usage: python3 areas_isles.py <id> [...]   -> <id>/layout.json + ascii on stdout (then guide.py <id>)
Field areas and islets -> tomap.py (v2/src/maps/field_isles_*.js); towns and dungeons -> put_rows.py (v2/src/maps/isles_painted_rows.js,
read by the hand-written map files isles_coral.js, isles_nerei.js, isles_cave.js, isles_ghostship.js).
Chars: lib.py (isles copy)."""
import sys, math
import numpy as np
from lib import Area, fbm, WALK

WHITE = (236, 234, 226)
STONE = (170, 166, 156)
DARK = (40, 26, 16)
WOOD = (120, 84, 52)
ZONE = 'zw_isles'


def door(a, x, y, w=1, ch=':'):
    a.mark('door', [(x + i, y) for i in range(w)], 'a dark ENTRANCE', DARK, solid=False)
    a.rect(x, y, w, 1, ch, force=True, keep=True)


def band(pts, pad=2):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0 = int(max(0, min(xs) - pad)), int(max(0, min(ys) - pad))
    return [x0, y0, int(max(xs) + pad) - x0 + 1, int(max(ys) + pad) - y0 + 1]


def meadow(a, s1, s2):
    """grass with patches of wind-bent meadow grass and sea pinks"""
    a.mask_fill(fbm(s1, a.W, a.H, 8) > 0.58, ';', only=',')
    a.mask_fill(fbm(s2, a.W, a.H, 5) > 0.72, '"', only=',;')


def jetty(a, x0, y0, length, edge='s', w=2):
    """a wooden jetty from the shore out into the sea (the own ship moors at its end)"""
    cells = []
    for i in range(length):
        for j in range(w):
            x, y = (x0 + j, y0 + i) if edge == 's' else (x0 + j, y0 - i) if edge == 'n' else (x0 + i, y0 + j) if edge == 'e' else (x0 - i, y0 + j)
            a.put(x, y, '=', True); a.keep[y, x] = True; cells.append((x, y))
    a.mark('jetty', cells, 'a simple WOODEN JETTY of weathered grey planks on posts running out into the water (walkable deck)', (150, 104, 60), solid=False)
    return cells


# ======================================================================== field areas of the main island
def i_cliff():
    """白崖の道: north of Coral. The white stone bridge from the town's north gate comes in at the south edge; the road climbs onto a green
    cliff-top plateau above WHITE CHALK CLIFFS that fall to the blue sea along the north and west; wind-bent pines, sea pinks; on a
    headland in the north a ruined round WATCHTOWER of white stone (the lookout, the islets seen from it); the road runs on east."""
    a = Area('i_cliff', 52, 38, 5101, base=',')
    W, H = a.W, a.H
    meadow(a, 3, 4)
    # the sea (N and W) and the white cliffs between it and the plateau
    sea = a.region([(-3, -3), (55, -3), (55, 3), (44, 4.5), (36, 3.5), (30, 5.5), (26, 10), (20, 11.5), (15, 9), (9, 10), (5, 14), (3, 22), (1.5, 30), (-3, 31)], '~', rough=1.2, seed=1, force=True)
    a.ring(sea, 'R', width=2, only=',;"')
    # the headland of the watchtower (N middle) reaching into the sea
    a.region([(18, 11.5), (19, 6), (23, 4.5), (27, 6), (27, 11)], ',', rough=0.6, seed=2, force=True)
    a.region([(16.5, 11.8), (17.5, 5), (23, 3), (28.5, 5), (28.5, 12)], 'R', rough=0.5, seed=3, only='~')
    tower = [(x, y) for x in range(21, 25) for y in range(6, 9) if not (x == 22 and y == 8)]
    a.mark('tower', tower, 'a ruined round WATCHTOWER of whitewashed stone, roofless, its upper wall broken, a dark doorway facing south (the dark block)', WHITE)
    door(a, 22, 8)
    # the ravine along the south-west (the town lies below it): the stone bridge crosses it
    a.region([(-3, 33), (8, 32), (13, 34.5), (20, 33), (30, 35), (55, 34), (55, 41), (-3, 41)], 'R', rough=0.7, seed=5, force=True)
    for y in range(32, 38):
        a.put(12, y, '=', True); a.put(13, y, '=', True); a.keep[y, 12] = a.keep[y, 13] = True
    a.mark('bridge', [(x, y) for x in (12, 13) for y in range(32, 38)], 'an old arched STONE BRIDGE of white blocks with low parapets crossing a deep ravine (walkable deck)', (200, 196, 186), solid=False)
    # pines in wind-bent groups, bushes, rocks
    for (x, y, rx, ry, s_) in [(8, 20, 2.4, 1.8, 11), (34, 14, 2.2, 1.6, 12), (44, 26, 3.0, 2.0, 13), (26, 28, 2.0, 1.4, 14), (40, 9, 1.8, 1.3, 15)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',;"')
    # the road: bridge -> north -> east edge; the path to the tower
    road = [(12.5, 38.5), (12.5, 30), (14, 24), (20, 20), (30, 19.5), (40, 19), (52.5, 19.5)]
    a.stroke(road, 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(21, 20), (22, 14), (22.5, 9)], 1.3, ':', seed=7, force=True)
    a.scatter('b', 0.012, only=',;', seed=41, clear=1)
    a.scatter('r', 0.006, only=',;', seed=42, clear=1)
    a.tidy()
    a.exit('s', 12, 13, {'map': 'coral', 'spawn': 'north'}, 'south')
    a.exit('e', 19, 20, {'map': 'i_cove', 'spawn': 'west'}, 'east')
    a.objects += [
        dict(type='examine', x=22, y=9, event='isles_watchtower'),
        dict(type='sign', x=15, y=27, text='白崖の道\n南 → 港町コーラル\n東 → 夜光虫の入り江・岬の村ネレイ'),
        dict(type='chest', id='i_cliff_c1', x=45, y=23, item='i_potion', n=2),
        dict(type='waylamp', id='wl_i_cliff_1', x=16, y=28, lit=True),
        dict(type='waylamp', id='wl_i_cliff_2', x=38, y=22, lit=True),
    ]
    a.meta = dict(name='白崖の道', sub='港町コーラルの北の崖の上', region='r_isles', worldRect=[596, 468, 50, 36], outside='sea',
                  zones=[{'rect': None, 'zone': ZONE}], links={}, npcs=[])
    return a


def i_cove():
    """夜光虫の入り江: a crescent of WHITE SAND around a turquoise cove in the south; low white cliffs arc behind the beach; the road runs
    along the cliff top in the north; a gully path goes down to the sand; at the foot of the east cliff the dark mouth of the sea cave
    潮鳴りの洞窟; reefs of dark rock in the shallows, tide pools, a few palms."""
    a = Area('i_cove', 56, 40, 5202, base=',')
    W, H = a.W, a.H
    meadow(a, 5, 6)
    # the cove: sea in the south, the beach crescent, shallows
    a.region([(-3, 30), (8, 31), (14, 36), (22, 34.5), (30, 36), (40, 35), (48, 31), (59, 29), (59, 43), (-3, 43)], '~', rough=1.2, seed=1, force=True)
    a.region([(6, 28.5), (10, 31.5), (16, 33.5), (24, 32.5), (32, 34), (40, 33), (46, 29.5), (46, 34), (32, 37), (16, 36.5), (6, 32)], '_', rough=0.8, seed=2, only='~,;"')
    beach = a.region([(4, 27), (8, 22), (16, 20), (28, 19.5), (40, 20), (47, 23), (48, 28.5), (40, 31.5), (30, 32.5), (18, 31.5), (9, 30)], 's', rough=1.0, seed=3, force=True)
    # the low white cliffs arcing behind the beach (a gap for the gully path at x 21-22), the cliff top in the north stays grass
    cl = a.region([(2, 26), (6, 19.5), (15, 16.5), (28, 16), (41, 16.5), (50, 20), (53, 28), (49.5, 29), (46.5, 22.5), (39, 18.8), (28, 18.3), (16, 18.8), (8, 21.5), (4.5, 27.5)], 'R', rough=0.6, seed=4, force=True)
    for y in range(15, 21): a.rect(21, y, 2, 1, ':', force=True, keep=True)
    # the sea cave's mouth in the east cliff (door at 47, 24)
    a.rect(46, 23, 3, 3, 'R', force=True)
    door(a, 47, 25, 1, 's')
    a.rect(46, 26, 3, 2, 's', force=True, keep=True)
    a.mark('cave', [(46, 24), (47, 24), (48, 24)], 'the dark jagged MOUTH OF A SEA CAVE in the white cliff, wet black rock around it, sea spray', DARK)
    # reefs and tide pools
    for (x, y, rx, ry, s_) in [(12, 34, 2.0, 1.0, 11), (36, 36, 2.6, 1.2, 12), (26, 38, 1.6, 0.9, 13)]:
        a.blob(x, y, rx, ry, 'r', rough=0.3, seed=s_, only='~_')
    for (x, y, rx, ry, s_) in [(15, 27, 1.8, 1.0, 21), (35, 28, 1.6, 0.9, 22)]:
        a.blob(x, y, rx, ry, 'w', rough=0.2, seed=s_, only='s')
    # the sand runs down to the surf (no strip of grass between the beach and the water)
    for y in range(24, H):
        for x in range(4, 50):
            if a.g[y, x] in ',;"' and not a.keep[y, x]: a.g[y, x] = 's' if y < 33 else '_'
    # palms on the beach, pines on the top
    for (x, y) in [(10, 25), (30, 23), (41, 25), (19, 24)]:
        if a.g[y, x] == 's': a.put(x, y, 'T')
    for (x, y, rx, ry, s_) in [(6, 8, 2.6, 1.8, 31), (34, 7, 2.2, 1.6, 32), (50, 10, 2.0, 1.4, 33)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',;"')
    # the road along the top, the gully path down
    road = [(-1, 10.5), (10, 11), (20, 12), (32, 11.5), (44, 12), (56.5, 11.5)]
    a.stroke(road, 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(21.5, 12.5), (21.5, 21), (24, 24), (34, 25.5), (43, 26.5), (47, 26)], 1.4, ':', seed=7, force=True, only='s,;":')
    a.scatter('b', 0.010, only=',;', seed=41, clear=1)
    a.scatter('r', 0.006, only=',;', seed=42, clear=1)
    a.tidy()
    a.exit('w', 10, 11, {'map': 'i_cliff', 'spawn': 'east'}, 'west')
    a.exit('e', 11, 12, {'map': 'i_cape', 'spawn': 'west'}, 'east')
    a.spawns['cave'] = dict(x=47, y=26, dir='s')
    a.objects += [
        dict(type='stairs', x=47, y=25, to={'map': 'isles_cave_1', 'spawn': 'entrance'}, look='none'),
        dict(type='sign', x=24, y=14, text='夜光虫の入り江\n下の浜の東に、潮鳴りの洞窟。'),
        dict(type='examine', x=26, y=30, event='isles_cove_glow'),
        dict(type='chest', id='i_cove_c1', x=8, y=28, item='i_ether', n=1),
        dict(type='waylamp', id='wl_i_cove_1', x=18, y=14, lit=True),
        dict(type='waylamp', id='wl_i_cove_2', x=44, y=26, lit=True),
    ]
    a.meta = dict(name='夜光虫の入り江', sub='白い砂の入り江と潮鳴りの洞窟', region='r_isles', worldRect=[630, 470, 56, 40], outside='sea',
                  zones=[{'rect': None, 'zone': ZONE}], links={'tidecave': {'map': 'i_cove', 'spawn': 'cave'}}, npcs=[])
    return a


def i_cape():
    """ネレイの岬道: the neck of the long cape: a narrow ridge of green meadow between two seas (west and east), white rocks at the shore,
    stone cairns along the way, an old wooden SIGNAL MAST with its yard; the road from the west edge winds north-east along the ridge to
    the village gate of Nerei at the north edge."""
    a = Area('i_cape', 48, 40, 5303, base=',')
    W, H = a.W, a.H
    meadow(a, 7, 8)
    # the seas either side of the ridge (the ridge runs from SW to N)
    a.region([(-3, -3), (12, -3), (14, 6), (11, 14), (6, 19), (-3, 20)], '~', rough=1.3, seed=1, force=True)
    a.region([(30, -3), (51, -3), (51, 43), (26, 43), (30, 36), (36, 28), (34, 18), (30, 8)], '~', rough=1.3, seed=2, force=True)
    a.region([(-3, 30), (8, 31), (14, 36), (18, 43), (-3, 43)], '~', rough=1.2, seed=3, force=True)
    # white rocky shore
    land = ~np.isin(a.g, ['~'])
    from scipy import ndimage
    shore = land & ndimage.binary_dilation(~land, iterations=2)
    a.mask_fill(shore, 'R', only=',;"')
    # cairns and the signal mast
    a.mark('mast', [(24, 17)], 'an old wooden SIGNAL MAST with a crossed yard and frayed rope, standing on a low heap of white stones', WOOD)
    for (x, y) in [(15, 27), (26, 9)]:
        a.mark('cairn%d' % x, [(x, y)], 'a small CAIRN of piled white stones', STONE)
    for (x, y, rx, ry, s_) in [(18, 22, 2.0, 1.4, 11), (27, 26, 1.8, 1.3, 12)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',;"')
    road = [(-1, 25.5), (8, 25), (15, 23), (20, 19), (22, 12), (21, 5), (21.5, -1)]
    a.stroke(road, 2.0, '.', wobble=0.2, seed=6)
    a.scatter('b', 0.012, only=',;', seed=41, clear=1)
    a.scatter('r', 0.008, only=',;', seed=42, clear=1)
    a.tidy()
    a.exit('w', 25, 26, {'map': 'i_cove', 'spawn': 'east'}, 'west')
    a.exit('n', 21, 22, {'map': 'nerei', 'spawn': 'gate'}, 'north')
    a.objects += [
        dict(type='examine', x=24, y=18, event='isles_signal_mast'),
        dict(type='sign', x=11, y=28, text='ネレイの岬道\n北 → 岬の村ネレイ'),
        dict(type='chest', id='i_cape_c1', x=28, y=22, item='i_clear', n=2),
        dict(type='waylamp', id='wl_i_cape_1', x=12, y=22, lit=True),
        dict(type='waylamp', id='wl_i_cape_2', x=24, y=8, lit=True),
    ]
    a.meta = dict(name='ネレイの岬道', sub='二つの海にはさまれた細い尾根', region='r_isles', worldRect=[660, 480, 48, 40], outside='sea',
                  zones=[{'rect': None, 'zone': ZONE}], links={}, npcs=[])
    return a


# ======================================================================== islets (the own ship moors at a jetty; spawn 'boat')
def islet(aid, W, H, seed, poly, rough=1.2):
    a = Area(aid, W, H, seed, base='~')
    isl = a.region(poly, ',', rough=rough, seed=1, force=True)
    return a, isl


def shore_ring(a, isl, sand=True):
    from scipy import ndimage
    ring = ndimage.binary_dilation(isl, iterations=1) & ~ndimage.binary_erosion(isl, iterations=1)
    a.mask_fill(ring & isl, 's' if sand else 'R')
    a.mask_fill(ndimage.binary_dilation(isl, iterations=2) & ~isl, '_', only='~')


def organic(a, cx, cy, rx, ry, seed, harm=0.13, bays=(), capes=()):
    """(2026-09-30 見直し) 自然な島の形: 楕円の半径を、いくつかの波（2〜7 周）と入り江（bays）・岬（capes）でゆがめる。
    bays/capes = [(角度 度（東 0・南 90）, 幅 度, 深さ（半径の割合）)]。多角形の島のような大きな角が出ない"""
    rnd = np.random.RandomState(seed)
    ys, xs = np.mgrid[0:a.H, 0:a.W] + 0.5
    th = np.arctan2((ys - cy) / ry, (xs - cx) / rx)
    rr = np.hypot((xs - cx) / rx, (ys - cy) / ry)
    lim = np.ones_like(th)
    for k in range(2, 8):
        lim += harm / (k ** 0.8) * rnd.uniform(0.5, 1.0) * np.cos(k * th + rnd.uniform(0, 2 * math.pi))
    def bump(deg, wdeg):
        dd = np.angle(np.exp(1j * (th - math.radians(deg))))
        return np.exp(-(dd / math.radians(wdeg)) ** 2)
    lim += 0.16 * (fbm(seed + 5, a.W, a.H, 3.5, 2) - 0.5)   # 小さな出入り
    for (deg, wdeg, depth) in bays: lim -= depth * bump(deg, wdeg)
    for (deg, wdeg, depth) in capes: lim += depth * bump(deg, wdeg)
    return rr < lim


def shallows(a, isl, dist=2.3):
    """島のまわりの浅瀬（ユークリッドの距離で。十字のふくらましだと 45° の角ができる）"""
    from scipy import ndimage
    dd = ndimage.distance_transform_edt(~isl)
    n = fbm(a.seed + 77, a.W, a.H, 3, 2)
    a.mask_fill((dd > 0) & (dd <= dist + (n - 0.5) * 1.2), '_', only='~')


def islet2(aid, W, H, seed, cx, cy, rx, ry, **kw):
    a = Area(aid, W, H, seed, base='~')
    isl = organic(a, cx, cy, rx, ry, seed, **kw)
    a.mask_fill(isl, ',', force=True)
    a.meta['smooth'] = 0.55
    return a, isl


def i_light():
    """灯台島（2026-09-30 描き直し）: 岩がちの小島。北の岩山の上に、白い石に赤い帯 2 本の高い丸い灯台（戸口は南、灯室は暗い）と、
    その足もとの白い敷石の広場。東に屋根の落ちた灯台守の小屋。西の入り江に白い砂浜、北の岸は岩と波。南の桟橋から小道が灯台へ登る。"""
    a, isl = islet2('i_light', 40, 32, 5404, 20.5, 15.2, 14.2, 11.6, harm=0.12,
                    bays=[(180, 16, 0.26), (60, 12, 0.10), (-150, 10, 0.08)], capes=[(-40, 14, 0.12), (120, 12, 0.08), (-95, 16, 0.06)])
    from scipy import ndimage
    ring = isl & ~ndimage.binary_erosion(isl, iterations=1)
    a.mask_fill(ring, 'k')
    shallows(a, isl)
    # 北の岩山（灯台の立つ平らな岩棚）
    a.blob(20.5, 6.5, 8.5, 4.2, 'k', rough=0.35, seed=4, only=',')
    a.mask_fill(isl & (fbm(3, a.W, a.H, 6) > 0.6), ';', only=',')
    a.mask_fill(isl & (fbm(13, a.W, a.H, 4) > 0.74), '"', only=',')
    # 西の入り江の砂浜
    a.blob(7.6, 15.5, 2.6, 4.2, 's', rough=0.3, seed=7, only=',;"k')
    # 灯台（高い丸い塔、戸口 20,9）と足もとの敷石の広場
    lh = [(x, y) for x in range(18, 23) for y in range(2, 10) if (x, y) != (20, 9)]
    a.mark('lighthouse', lh, 'a TALL ROUND LIGHTHOUSE TOWER, the landmark of the island, seen from above with its south side visible: a whitewashed stone cylinder with two broad faded red bands, a black iron gallery with a railing near the top and a glass lamp room with a domed dark-copper roof (the lamp is dark, unlit); a small arched wooden door at its foot facing south (the dark block)', (230, 226, 220))
    a.marks[-1]['shape'] = 'smooth'
    a.blob(20.5, 10.6, 4.6, 1.5, 'c', rough=0.25, seed=5, only=',;"k')
    door(a, 20, 9, 1, 'c')
    a.mark('cottage', [(x, y) for x in range(26, 30) for y in range(10, 13)], "the roofless RUIN of a small keeper's cottage of white stone: broken walls, collapsed grey rafters and weeds inside, a fallen chimney", STONE)
    jetty(a, 18, 27, 5, 's')
    a.stroke([(18.5, 27), (17.5, 23), (19.5, 18), (19.2, 14), (20.5, 11.2)], 1.4, ':', seed=6, force=True)
    # 北の岸の岩・波、東の岩の岬、松
    for (x, y, rx, ry, s_) in [(10, 18.5, 1.3, 1.0, 11), (31, 19, 1.5, 1.1, 12), (13, 5.6, 1.4, 1.0, 13), (28, 5.8, 1.5, 1.0, 14), (33.5, 11, 1.2, 1.0, 15)]:
        a.blob(x, y, rx, ry, 'r', rough=0.3, seed=s_, only=',;"k')
    for (x, y) in [(11, 11), (27, 22), (13, 23), (31, 15)]:
        a.put(x, y, 'T', True)
    a.blob(24.5, 21.5, 1.5, 1.0, 'w', rough=0.2, seed=16, only=',;"k')
    a.tidy()
    a.spawns = {'boat': dict(x=18, y=28, dir='n')}
    a.objects += [
        dict(type='examine', x=19, y=31, event='isles_boat'),
        dict(type='examine', x=22, y=10, event='isles_light_plaque'),
        dict(type='chest', id='i_light_c1', x=28, y=15, item='i_ether', n=1),
    ]
    for o in a.objects:
        if a.g[o['y'], o['x']] not in WALK: a.put(o['x'], o['y'], ',', True)
        a.keep[o['y'], o['x']] = True
    a.exits.append(dict(x=20, y=9, w=1, h=1, to={'map': 'isles_lamproom', 'spawn': 'door'}))
    a.spawns['lamproom'] = dict(x=20, y=10, dir='s')
    a.meta.update(name='灯台島', sub='灯台守のいない灯台', region='r_isles', worldRect=[560, 540, 40, 32], outside='sea', look='field',
                  zones=[{'rect': None, 'zone': ZONE, 'cond': '!isles_light_lit'}], links={}, npcs=[])
    return a


def i_siren():
    """人魚の歌う岩（2026-09-30 描き直し）: 小島のまん中に、風の穴のあいた高い岩の柱（歌う岩）。まわりは濡れた黒い岩棚と潮だまり、
    南に三日月の白い砂浜、北東に少しの草。東の桟橋から小道が岩の前へ。"""
    a, isl = islet2('i_siren', 36, 28, 5505, 17.6, 14.0, 12.4, 10.0, harm=0.2,
                    bays=[(150, 14, 0.14), (-60, 10, 0.10)], capes=[(0, 10, 0.12), (-150, 14, 0.10), (95, 12, 0.08)])
    from scipy import ndimage
    ring = isl & ~ndimage.binary_erosion(isl, iterations=1)
    a.mask_fill(ring, 'k')
    shallows(a, isl)
    a.mask_fill(isl & (fbm(5, a.W, a.H, 5) > 0.47), 'k', only=',')
    a.blob(18.0, 20.5, 7.5, 2.8, 's', rough=0.3, seed=9, only=',k')
    a.blob(24.5, 8.5, 4.0, 3.0, ';', rough=0.35, seed=10, only=',k')
    a.mask_fill(isl & (fbm(15, a.W, a.H, 4) > 0.7), '"', only=',;')
    st = [(x, y) for x in range(14, 20) for y in range(5, 13)]
    a.mark('stack', st, 'the SINGING ROCK: one tall, striking sea stack of dark slate-grey rock rising high above the islet, seen from above with its south face visible: smooth wind-carved curves, pierced right through by five or six round holes and a narrow arch like the pipes of an organ, streaks of pale salt and green weed, white shells, pale coral and mother-of-pearl clinging to its foot', (96, 100, 110))
    a.marks[-1]['shape'] = 'smooth'
    for (x, y, rx, ry, s_) in [(10.5, 12, 1.6, 1.2, 21), (23.5, 15.5, 1.4, 1.0, 22), (12.5, 17.5, 1.0, 0.8, 23)]:
        a.blob(x, y, rx, ry, 'w', rough=0.2, seed=s_, only=',ks;')
    for (x, y, rx, ry, s_) in [(8.5, 8.5, 1.2, 1.0, 31), (26.5, 19.5, 1.2, 0.9, 32), (21.5, 5.2, 1.0, 0.8, 33)]:
        a.blob(x, y, rx, ry, 'r', rough=0.3, seed=s_, only=',ks;')
    jetty(a, 29, 14, 5, 'e')
    a.stroke([(29, 14.5), (24, 14.2), (20, 13.6), (17.5, 13.5)], 1.3, ':', seed=6, force=True)
    a.tidy()
    a.spawns = {'boat': dict(x=29, y=14, dir='w')}
    a.objects += [dict(type='examine', x=17, y=13, event='isles_siren_rock'), dict(type='examine', x=33, y=15, event='isles_boat')]
    for o in a.objects:
        if a.g[o['y'], o['x']] not in WALK: a.put(o['x'], o['y'], ':', True)
        a.keep[o['y'], o['x']] = True
    a.meta.update(name='人魚の歌う岩', sub='風が歌う岩の小島', region='r_isles', worldRect=[570, 450, 36, 28], outside='sea', look='field',
                  zones=[{'rect': None, 'zone': ZONE}], links={}, npcs=[])
    return a


def i_crab():
    """財宝ヤドカリの島: a sandy islet ringed by turquoise shallows; coconut palms; a big MOUND OF SHELLS and old coins in the middle (the
    treasure crab's nest); a small lagoon; a jetty on the west."""
    a, isl = islet('i_crab', 40, 30, 5606, [(6, 16), (10, 8), (20, 5), (31, 7), (35, 15), (30, 24), (18, 25)])
    shore_ring(a, isl)
    a.mask_fill(isl, 's', only=',')
    a.mask_fill(isl & (fbm(7, a.W, a.H, 6) > 0.55), ',', only='s')
    a.blob(27, 17, 3.0, 2.0, 'w', rough=0.2, seed=8)
    a.mark('nest', [(19, 13), (20, 13), (19, 14), (20, 14)], 'a big glittering MOUND OF SEASHELLS, old gold coins and bits of coral (a giant hermit crab\'s nest)', (224, 196, 120))
    for (x, y) in [(12, 10), (15, 20), (25, 9), (31, 12), (22, 21)]:
        a.put(x, y, 'T', True)
    jetty(a, 7, 15, 5, 'w')
    a.stroke([(7, 15.5), (13, 15.5), (18, 14.5)], 1.3, ':', seed=6, force=True)
    a.tidy()
    a.spawns = {'boat': dict(x=7, y=15, dir='e')}
    a.objects += [dict(type='examine', x=19, y=15, event='isles_crab_nest'), dict(type='examine', x=3, y=16, event='isles_boat'),
                  dict(type='chest', id='i_crab_c1', x=30, y=11, pool='p_T')]
    a.meta = dict(name='財宝ヤドカリの島', sub='貝がらの光る小島', region='r_isles', worldRect=[676, 530, 40, 30], outside='sea', look='field',
                  zones=[{'rect': None, 'zone': ZONE}], links={}, npcs=[])
    return a


def i_wreck():
    """座礁した商船（2026-09-30 描き直し）: 黒い岩礁と長い白い砂州。岩礁に乗り上げて傾いた大きな二本マストの商船（船首は東、
    船腹に穴、帆は裂けて垂れる）。南の砂に散った木箱と、折れて倒れた帆桁。南の流木の桟橋に自分の船。"""
    a, isl = islet2('i_wreck', 44, 32, 5707, 22.0, 14.6, 17.8, 9.8, harm=0.16,
                    bays=[(90, 10, 0.06), (-120, 12, 0.12), (40, 12, 0.10), (165, 10, 0.12)], capes=[(0, 12, 0.08), (130, 12, 0.08)])
    from scipy import ndimage
    ring = isl & ~ndimage.binary_erosion(isl, iterations=1)
    a.mask_fill(isl, 's', only=',')
    a.mask_fill(ring, 'k')
    shallows(a, isl)
    a.mask_fill(isl & (fbm(9, a.W, a.H, 5) > 0.52), 'k', only='s')
    # 南の砂州は歩ける白い砂（難破船の前）
    a.blob(23.0, 19.5, 11.0, 3.2, 's', rough=0.25, seed=17, only='k')
    ship = [(x, y) for x in range(8, 37) for y in range(5, 17)
            if abs(y + 0.5 - 11.6) <= 4.6 * math.sqrt(max(0.0, 1 - ((x + 0.5 - 22.5) / 14.2) ** 2)) * (1.0 if x < 30 else max(0.25, (37 - x) / 7.0))]
    a.mark('wreck', ship, 'a BIG two-masted wooden MERCHANT SHIP, clearly a ship, run aground on the reef and heeled over to the south, seen from above: a long curved hull of weathered brown planks with a pointed bow to the east and a squared stern castle with windows to the west, its deck and hatches visible, two masts (one snapped off halfway), yards and rigging, torn off-white sails hanging and draped over the rail, a big splintered hole in the side of the hull with cargo spilling out, barnacles and seaweed along the waterline', (130, 92, 58))
    a.marks[-1]['shape'] = 'smooth'
    a.mark('mast', [(x, 20) for x in range(33, 38)], 'a broken MAST lying on the sand with its yard, tangled ropes and a torn sail', (96, 70, 50))
    for (x, y, rx, ry, s_) in [(15.5, 18.2, 1.0, 0.8, 11), (31.2, 17.3, 1.0, 0.7, 12)]:
        a.blob(x, y, rx, ry, 'r', rough=0.2, seed=s_, only='sk')
    for (x, y, rx, ry, s_) in [(6.5, 16, 1.4, 1.1, 21), (39, 13, 1.3, 1.0, 22), (12, 21.5, 1.2, 0.9, 23), (35, 22.5, 1.2, 0.9, 24)]:
        a.blob(x, y, rx, ry, 'r', rough=0.3, seed=s_, only='sk')
    jetty(a, 22, 25, 5, 's')
    a.stroke([(22.5, 25), (22.5, 18)], 1.3, ':', seed=6, force=True)
    a.tidy()
    a.spawns = {'boat': dict(x=22, y=26, dir='n')}
    a.objects += [dict(type='examine', x=23, y=17, event='isles_wreck'), dict(type='examine', x=23, y=30, event='isles_boat')]
    # 船長（22,18）と積荷の宝箱 3（18,19 / 27,18 / 29,19）は field_isles_00_kit.js が足す: そのマスを砂で空けておく
    for (x, y) in [(22, 18), (18, 19), (27, 18), (29, 19), (23, 17)]:
        if a.g[y, x] not in WALK: a.put(x, y, 's', True)
        a.keep[y, x] = True
        if (x, y) != (23, 17): a.objects.append(dict(type='none_removed', x=x, y=y))   # fit.py が空けておく（地図には書かない）
    a.meta.update(name='座礁した商船', sub='岩礁に乗り上げた船', region='r_isles', worldRect=[612, 540, 44, 32], outside='sea', look='field',
                  zones=[{'rect': None, 'zone': ZONE}], links={}, npcs=[])
    return a


AREAS = {k: v for k, v in globals().items() if k.startswith('i_') and callable(v)}

if __name__ == '__main__':
    import json
    import dng_isles
    AREAS.update(dng_isles.MAPS)
    for aid in sys.argv[1:]:
        a = AREAS[aid]()
        seen0 = np.zeros((a.H, a.W), bool)
        for s_ in a.spawns.values(): seen0 |= a.reach(s_['x'], s_['y'])
        pk = a.walk() & ~seen0
        a.g[pk] = 'X' if a.meta.get('look') == 'ship' else 'R'
        print('closed pockets', int(pk.sum()))
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
