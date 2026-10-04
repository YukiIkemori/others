"""Layouts of the painted maps of the Orbis plateau (オルビス高原 r_star): the field areas (s_steps, s_plateau, s_crater, s_ridge),
the town (orbis) and the dungeon floors (star_academy_1/2, star_tower_1, star_tower_top; dng_star.py).
Area switching like ../field_isles/areas_isles.py.
usage: python3 areas_star.py <id> [...]   -> <id>/layout.json + ascii on stdout (then guide.py <id>)
Field areas -> tomap.py (v2/src/maps/field_star_*.js); town and dungeons -> put_rows.py (v2/src/maps/star_painted_rows.js,
read by the hand-written map files star_orbis.js, star_academy.js, star_tower.js).
Chars: lib.py (star copy)."""
import sys, math
import numpy as np
from lib import Area, fbm, WALK

MARBLE = (226, 224, 216)
STONE = (170, 166, 156)
DARK = (40, 26, 16)
CRYSTAL = (140, 200, 250)
ZONE = 'zw_star'


def door(a, x, y, w=1, ch=':'):
    a.mark('door', [(x + i, y) for i in range(w)], 'a dark ENTRANCE', DARK, solid=False)
    a.rect(x, y, w, 1, ch, force=True, keep=True)


def meadow(a, s1, s2):
    """short silver-blue highland grass with patches of heather and small blue star flowers"""
    a.mask_fill(fbm(s1, a.W, a.H, 8) > 0.63, ';', only=',')
    a.mask_fill(fbm(s2, a.W, a.H, 5) > 0.72, '"', only=',;')


def column(a, x, y, text='a single weathered STANDING COLUMN of pale marble, broken at the top, seen from above (a round pale disc with a shadow)'):
    a.mark('col%d_%d' % (x, y), [(x, y)], text, MARBLE)


def fallen(a, cells):
    a.mark('fallen%d_%d' % cells[0], cells, 'a FALLEN MARBLE COLUMN lying in the grass, broken into drums, moss on it', MARBLE)


# ======================================================================== field areas
def s_steps():
    """星見の坂: the old road from the lowlands (W edge, low) climbs in switchbacks through a band of grey rock cliffs onto the plateau
    (NE, high). Stone steps cut into the rock at the steep turns; heather and dark pines below; fallen marble columns along the upper road."""
    a = Area('s_steps', 52, 38, 7101, base=',')
    W, H = a.W, a.H
    meadow(a, 3, 4)
    # the cliff band running from SW-top to NE-bottom: the plateau (north-east) is above it
    band = a.region([(-3, 20), (10, 17), (20, 15.5), (30, 13.5), (40, 14.5), (55, 13), (55, 18), (41, 19.5), (30, 19), (20, 21), (10, 23), (-3, 25)], 'R', rough=0.9, seed=1, force=True)
    # the northern plateau rim (mountains beyond) and the southern valley edge
    a.region([(-3, -3), (55, -3), (55, 2), (40, 3.5), (25, 2.5), (12, 4), (-3, 3)], 'R', rough=1.0, seed=2, force=True)
    a.region([(-3, 34), (12, 35), (24, 33.5), (36, 35.5), (55, 34), (55, 41), (-3, 41)], 'F', rough=1.2, seed=3, force=True)
    # pines below the cliffs, some on the plateau
    for (x, y, rx, ry, s_) in [(6, 29, 2.6, 1.8, 11), (18, 30, 2.4, 1.6, 12), (44, 26, 3.0, 2.0, 13), (33, 29, 2.0, 1.4, 14), (40, 7, 2.0, 1.4, 15), (8, 9, 2.4, 1.6, 16)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',;"')
    # the road: W edge (row 27-28) -> east along the foot -> switchback up the cliff band (steps) -> west on the plateau -> east edge (row 9-10)
    road = [(-1, 27.5), (8, 27), (16, 26), (24, 24.5), (28, 22), (29, 19), (27, 16.5), (22, 14), (18, 11), (22, 9), (32, 9), (42, 9.5), (52.5, 9.5)]
    a.stroke(road, 2.0, '.', wobble=0.2, seed=6)
    steps = [(x, y) for (x, y) in a.stroke([(28.5, 21.5), (29, 19), (27, 16.5), (23.5, 14.5)], 2.0, 'c', seed=7, force=True)]
    a.mark('steps', [list(c) for c in steps if a.inb(*c)], 'worn STONE STEPS cut into the grey rock, climbing the cliff (walkable)', (190, 186, 176), solid=False)
    # fallen columns and the old milestone along the upper road
    fallen(a, [(34, 11), (35, 11), (36, 11)])
    column(a, 30, 7); column(a, 38, 7); column(a, 46, 7)
    a.scatter('b', 0.012, only=',;', seed=41, clear=1)
    a.scatter('r', 0.007, only=',;', seed=42, clear=1)
    a.tidy()
    a.exit('w', 27, 28, {'map': 'world', 'spawn': 'star_w'}, 'west')
    a.exit('e', 9, 10, {'map': 's_plateau', 'spawn': 'west'}, 'east')
    a.objects += [
        dict(type='sign', x=11, y=25, text='星見の坂\n東へ上る → 列柱の高原・学術都市オルビス'),
        dict(type='examine', x=35, y=12, event='star_fallen_column'),
        dict(type='chest', id='s_steps_c1', x=42, y=28, item='i_potion', n=2),
        dict(type='waylamp', id='wl_s_steps_1', x=14, y=24, lit=True),
        dict(type='waylamp', id='wl_s_steps_2', x=26, y=7, lit=True),
        dict(type='waylamp', id='wl_s_steps_3', x=44, y=12, lit=True),
    ]
    a.meta = dict(name='星見の坂', sub='高原へ上る古い石段の道', region='r_star', worldRect=[548, 92, 52, 38], outside='rock',
                  zones=[{'rect': None, 'zone': ZONE}], links={}, npcs=[])
    return a


def s_plateau():
    """列柱の高原: the flat top of the plateau: short silver grass, heather, blue star flowers; a great RING of twelve standing marble
    columns round a flat stone disc in the middle; along the north edge the pale walls of Orbis with the arched south gate; the road from
    the west edge forks to the gate (north) and to the crater (east edge)."""
    a = Area('s_plateau', 56, 40, 7202, base=',')
    W, H = a.W, a.H
    meadow(a, 5, 6)
    # the city wall across the north (rows 0-4) with the gate passage at x 27-28
    a.rect(0, 0, W, 5, 'X', force=True)
    a.mark('wall', [(x, y) for x in range(W) for y in range(0, 5) if not (27 <= x <= 28)],
           'the tall pale MARBLE CITY WALL of Orbis seen from above: a thick wall with battlements along its top and its sheer south face, a round tower at intervals', MARBLE)
    a.rect(27, 0, 2, 5, 'c', force=True, keep=True)
    a.mark('gate', [(x, y) for x in (27, 28) for y in range(0, 5)], 'the arched SOUTH GATE passage through the wall, open, paved with pale flagstones (walkable)', (200, 196, 186), solid=False)
    # the plateau edges: cliffs dropping away in the south and the south-west, rocky edge in the east
    a.region([(-3, 33), (10, 34.5), (22, 33), (34, 35), (46, 33.5), (59, 34), (59, 43), (-3, 43)], 'R', rough=1.0, seed=1, force=True)
    a.region([(-3, 12), (3, 13), (5, 20), (3, 28), (-3, 30)], 'R', rough=0.8, seed=2, force=True)
    # the ring of columns (centre 20, 20, radius 5.5) around a flat stone disc
    cx, cy, rr = 20.0, 20.0, 5.6
    a.blob(cx, cy, 2.6, 2.2, 'c', rough=0.1, seed=3, force=True)
    for k in range(12):
        ang = k * math.pi / 6
        x, y = int(round(cx + rr * math.cos(ang))), int(round(cy + rr * 0.85 * math.sin(ang)))
        column(a, x, y, 'one of the twelve tall STANDING MARBLE COLUMNS of an ancient ring, carved with star signs, seen from above')
    a.mark('disc', [(19, 20), (20, 20), (21, 20)], 'a flat round STONE ALTAR DISC inlaid with a compass rose of stars, level with the ground', (180, 176, 190), solid=True)
    # pines and rocks, a small pond
    for (x, y, rx, ry, s_) in [(44, 12, 2.6, 1.8, 11), (8, 30, 2.4, 1.6, 12), (48, 27, 2.4, 1.6, 13), (36, 29, 1.8, 1.3, 14)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',;"')
    a.blob(10, 9, 2.0, 1.3, 'w', rough=0.2, seed=21, only=',;"')
    # the road: W edge (rows 9-10) -> junction (28, 12) -> gate (N); junction -> south-east -> E edge (rows 22-23)
    a.stroke([(-1, 9.5), (8, 12), (18, 12.5), (27.5, 12)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(27.5, 13), (27.5, 5)], 2.0, '.', wobble=0.1, seed=7)
    a.stroke([(28, 12.5), (36, 17), (46, 21), (56.5, 22.5)], 2.0, '.', wobble=0.2, seed=8)
    a.stroke([(24, 13), (22, 16)], 1.2, ':', seed=9, force=True)
    a.scatter('b', 0.010, only=',;', seed=41, clear=1)
    a.scatter('r', 0.006, only=',;', seed=42, clear=1)
    a.tidy()
    a.exit('w', 9, 10, {'map': 's_steps', 'spawn': 'east'}, 'west')
    a.exit('n', 27, 28, {'map': 'orbis', 'spawn': 'gate_s'}, 'north')
    a.exit('e', 22, 23, {'map': 's_crater', 'spawn': 'west'}, 'east')
    a.objects += [
        dict(type='sign', x=31, y=14, text='列柱の高原\n北 → 学術都市オルビス\n東 → 星降りのくぼ地・星読みの尾根'),
        dict(type='examine', x=20, y=21, event='star_column_ring'),
        dict(type='chest', id='s_plateau_c1', x=48, y=30, item='i_ether', n=1),
        dict(type='waylamp', id='wl_s_plateau_1', x=10, y=14, lit=True),
        dict(type='waylamp', id='wl_s_plateau_2', x=30, y=8, lit=True),
        dict(type='waylamp', id='wl_s_plateau_3', x=42, y=22, lit=True),
    ]
    a.meta = dict(name='列柱の高原', sub='学術都市オルビスの南の台地', region='r_star', worldRect=[596, 62, 56, 40], outside='rock',
                  zones=[{'rect': None, 'zone': ZONE}], links={}, npcs=[])
    return a


def s_crater():
    """星降りのくぼ地: a great round METEOR CRATER sunk in the plateau: a rim of grey rock, steep inner slopes, a floor of dark flat rock
    with clusters of glowing pale-blue CRYSTALS; a path goes down into it from the west rim to a small ruined altar at the bottom; the road
    runs round the crater's north rim from the west edge to the north edge."""
    a = Area('s_crater', 52, 40, 7303, base=',')
    W, H = a.W, a.H
    meadow(a, 7, 8)
    # the crater (centre 28, 25): rim ring R, floor k
    cx, cy = 28.0, 25.5
    floor = a.blob(cx, cy + 0.5, 10.2, 7.0, 'k', rough=0.2, seed=2, force=True)
    from scipy import ndimage
    a.mask_fill(ndimage.binary_dilation(floor, iterations=2) & ~floor, 'R', force=True)   # 縁の岩（切れ目なし。下りる道だけ）
    # the ramp down from the west rim (x 15-18, rows 24-25) into the floor
    ramp = a.stroke([(13, 24.5), (16, 24.8), (19, 25)], 2.0, ':', seed=3, force=True)
    # crystal clusters on the floor (solid, glowing)
    crys = []
    for (x, y) in [(22, 21), (23, 21), (33, 21), (34, 22), (36, 27), (36, 28), (24, 29), (25, 30), (30, 30), (31, 20), (20, 27)]:
        crys.append((x, y))
    a.mark('crystals', crys, 'clusters of glowing pale BLUE CRYSTALS growing from the dark rock, sharp and faceted', CRYSTAL)
    a.mark('altar', [(28, 25), (29, 25)], 'a small RUINED ALTAR of pale stone at the crater bottom, cracked, a star carved on its top', (180, 176, 190))
    # the outer edges: cliffs in the south, rocks in the east
    a.region([(-3, 36), (14, 37), (30, 36), (44, 37.5), (55, 36), (55, 43), (-3, 43)], 'R', rough=1.0, seed=4, force=True)
    a.region([(46, -3), (55, -3), (55, 43), (47, 43), (48, 30), (46, 18), (47, 8)], 'R', rough=1.0, seed=5, force=True)
    for (x, y, rx, ry, s_) in [(8, 8, 2.8, 1.8, 11), (10, 32, 2.4, 1.5, 12), (38, 6, 2.2, 1.5, 13)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',;"')
    # the road round the north rim: W edge (rows 20-21) -> north-east -> N edge (x 25-26)
    a.stroke([(-1, 20.5), (6, 19), (12, 14), (18, 12), (25.5, 9), (25.5, -1)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(8, 19.5), (12, 23), (14, 24.5)], 1.4, ':', seed=9, force=True)
    a.scatter('b', 0.010, only=',;', seed=41, clear=1)
    a.scatter('r', 0.007, only=',;', seed=42, clear=1)
    a.tidy()
    a.exit('w', 20, 21, {'map': 's_plateau', 'spawn': 'east'}, 'west')
    a.exit('n', 25, 26, {'map': 's_ridge', 'spawn': 'south'}, 'north')
    a.objects += [
        dict(type='sign', x=15, y=17, text='星降りのくぼ地\nくぼ地の底へ下りる道'),
        dict(type='examine', x=28, y=26, event='star_crater_altar'),
        dict(type='chest', id='s_crater_c1', x=34, y=25, item='i_clear', n=2),
        dict(type='chest', id='s_crater_c2', x=21, y=24, gold=160),
        dict(type='waylamp', id='wl_s_crater_1', x=9, y=16, lit=True),
        dict(type='waylamp', id='wl_s_crater_2', x=22, y=8, lit=True),
    ]
    a.meta = dict(name='星降りのくぼ地', sub='高原に落ちた星の跡', region='r_star', worldRect=[640, 78, 52, 40], outside='rock',
                  zones=[{'rect': None, 'zone': ZONE}], links={'starfall': {'map': 's_crater', 'spawn': 'west'}}, npcs=[])
    return a


def s_ridge():
    """星読みの尾根: a narrow rocky ridge running north; steep cliffs on both sides drop to dark pine valleys; the ridge path climbs from the
    south edge, meets the road from Orbis's east gate (west edge) and ends before the ROUND TOWER of star reading (north), a tall tower of
    pale stone whose door is barred by the academy's seal."""
    a = Area('s_ridge', 50, 38, 7404, base='F')
    W, H = a.W, a.H
    # the ridge land (a band from S to N, widening at the tower and at the junction)
    land = a.region([(18, 40), (17, 30), (4, 28), (-3, 27.5), (-3, 23), (6, 22.5), (16, 21), (17, 12), (14, 6), (16, 0.5), (34, 0.5), (36, 6), (32, 12), (33, 22), (34, 30), (32, 40)],
                    ',', rough=1.0, seed=1, force=True)
    meadow(a, 11, 12)
    from scipy import ndimage
    edge = land & ~ndimage.binary_erosion(land, iterations=2)
    a.mask_fill(edge, 'R', only=',;"')
    # the tower (round, 8 x 6) with its door facing south
    tower = [(x, y) for x in range(21, 29) for y in range(1, 7)]
    a.mark('tower', tower, 'the base of a tall ROUND TOWER of pale grey stone seen from above: a round stone roof ringed by a parapet with a brass dome, its door facing south', (190, 188, 196))
    a.marks[-1]['shape'] = 'round'
    door(a, 24, 6, 2, 'c')
    a.rect(23, 7, 4, 2, 'c', force=True, keep=True)
    # the path: S edge (x 24-25) -> north -> tower; the road from the west edge (rows 25-26) joins at (24, 25)
    a.stroke([(24.5, 38.5), (24, 30), (25, 22), (24.5, 14), (24.5, 8)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(-1, 25.5), (8, 25), (16, 24.5), (24, 24)], 2.0, '.', wobble=0.2, seed=7)
    for (x, y, rx, ry, s_) in [(20, 15, 1.4, 1.2, 11), (29, 18, 1.6, 1.2, 12), (28, 31, 1.6, 1.3, 13), (8, 24, 1.3, 1.0, 14)]:
        a.blob(x, y, rx, ry, 'T', rough=0.3, seed=s_, only=',;"')
    a.scatter('r', 0.012, only=',;', seed=42, clear=1)
    a.tidy()
    a.exit('s', 24, 25, {'map': 's_crater', 'spawn': 'north'}, 'south')
    a.exit('w', 24, 25, {'map': 'orbis', 'spawn': 'gate_e'}, 'west')
    a.spawns['tower'] = dict(x=24, y=7, dir='s')
    a.objects += [
        dict(type='sign', x=20, y=27, text='星読みの尾根\n北 → 星読みの塔\n西 → 学術都市オルビスの東門'),
        dict(type='examine', x=25, y=8, event='star_tower_seal'),
        dict(type='waylamp', id='wl_s_ridge_1', x=28, y=26, lit=True),
        dict(type='waylamp', id='wl_s_ridge_2', x=21, y=10, lit=True),
    ]
    a.meta = dict(name='星読みの尾根', sub='星読みの塔へ続く細い尾根', region='r_star', worldRect=[636, 30, 50, 38], outside='forest_dark',
                  zones=[{'rect': None, 'zone': ZONE}], links={'startower': {'map': 's_ridge', 'spawn': 'tower'}}, npcs=[])
    return a


def s_road():
    """山あいの街道 (2026-10-04, replaces the walk over the old tile world between 北の野 and the marsh): a quiet mountain valley road.
    The road comes in from the west edge (北の野), runs east along a grassy valley floor between a band of grey rock cliffs (north,
    the rim of the plateau) and a dark pine wood (south). At a fork in the east a branch climbs NORTH up worn stone steps cut through a
    gap in the cliffs (星見の坂, the way to the plateau); the other branch goes SOUTH through a notch in a grey rock ridge, down to the marsh
    (霧の入口). A traveller's camp by the fork. Clean, readable shapes (owner 2026-10-04: no fussy small details)."""
    a = Area('s_road', 60, 40, 7501, base=',')
    W, H = a.W, a.H
    # the plateau rim: grey cliffs along the top, open where the steps climb (x 45-48)
    a.region([(-3, -3), (46.6, -3), (46.6, 7.5), (36, 8.5), (24, 7.0), (12, 8.0), (-3, 6.5)], 'R', rough=0.6, seed=1, force=True)
    a.region([(48.4, -3), (63, -3), (63, 9.5), (55, 9.0), (48.4, 8.0)], 'R', rough=0.6, seed=2, force=True)
    # the pine wood along the bottom (west and middle) and the grey ridge (south-east) with the notch for the road to the marsh
    a.region([(-3, 33.5), (8, 32.0), (18, 33.5), (30, 32.5), (40, 33.5), (43, 43), (-3, 43)], 'F', rough=1.0, seed=3, force=True)
    a.region([(40, 33.5), (44, 31.5), (48.6, 31.0), (48.6, 43), (40, 43)], 'R', rough=0.5, seed=4, force=True)
    a.region([(53.4, 31.0), (58, 30.5), (63, 31.5), (63, 43), (53.4, 43)], 'R', rough=0.5, seed=5, force=True)
    # a few groups of pines on the valley floor (groups, not single scattered trees), one small pond
    for (x, y, rx, ry, s_) in [(6, 12, 3.0, 2.0, 11), (22, 27, 3.4, 2.2, 12), (30, 12, 2.6, 1.8, 13), (56, 20, 2.6, 3.4, 14), (8, 28, 2.4, 1.8, 15)]:
        a.blob(x, y, rx, ry, 'T', rough=0.25, seed=s_, only=',')
    a.blob(15, 13, 2.6, 1.6, 'w', rough=0.15, seed=21, only=',')
    # the road: W edge (rows 19-20) -> east -> fork (42, 21); N branch -> steps -> top edge (x 46-47); S branch -> notch -> bottom edge (x 50-52)
    a.stroke([(-1, 20), (8, 20), (18, 20.5), (28, 21.0), (36, 20.5), (42, 20.5)], 1.9, '.', seed=6)
    for (x, y, rx, ry, s_) in [(26, 15, 7, 3.0, 31), (12, 25, 6, 2.6, 32)]:
        a.blob(x, y, rx, ry, ';', rough=0.2, seed=s_, only=',')
    a.stroke([(42, 20.5), (45.5, 17), (48, 13), (48, 9.5)], 1.9, '.', seed=7)   # the painting (gen1) put the steps one tile east of gen1's guide
    steps = a.stroke([(48, 10), (48, 4), (48, -1)], 1.9, 'c', seed=8, force=True)
    a.mark('steps', [list(c) for c in steps if a.inb(*c)], 'worn pale STONE STEPS cut into the grey rock, climbing north through a narrow gap in the cliffs (walkable)', (190, 186, 176), solid=False)
    a.stroke([(42, 20.5), (46, 24), (50, 27.5), (51.5, 32), (51.5, 40.5)], 2.4, '.', wobble=0.1, seed=9)
    # a short footpath to the traveller's camp
    a.stroke([(36, 20.5), (36.5, 17.5)], 1.2, ':', seed=10)
    a.rect(35, 15, 4, 3, ',', force=True, keep=True)
    a.tidy()
    a.exit('w', 19, 20, {'map': 'f_cross', 'spawn': 'east'}, 'west')
    a.exit('n', 47, 48, {'map': 's_steps', 'spawn': 'west'}, 'star')['cond'] = {'not': {'slice': True}}
    a.exit('s', 50, 52, {'map': 'm_north', 'spawn': 'north'}, 'south')['cond'] = {'not': {'slice': True}}   # 体験版の間は湿原へ行けない
    a.objects += [
        dict(type='sign', x=40, y=18, text='山あいの街道\n北 → 星見の坂\n南 → グレイモア湿原'),
        dict(type='prop', id='tent', x=37, y=16),
        dict(type='waylamp', id='wl_s_road_1', x=12, y=17, lit=True),
        dict(type='waylamp', id='wl_s_road_2', x=44, y=24, lit=True),
        dict(type='waylamp', id='wl_s_road_3', x=49, y=14, lit=True),
    ]
    a.meta = dict(name='山あいの街道', sub='北の野と湿原をつなぐ道', region='r_marsh', worldRect=[338, 128, 140, 48], outside='rock', bbg='marsh',
                  smooth=0.6, clean=True,
                  zones=[{'rect': None, 'zone': 'zw_marsh_road'}], links={},
                  npcs=[{'id': 'marsh_traveler', 'look': 'npc_traveler', 'name': '湿原の旅人', 'x': 36, 'y': 18, 'dir': 's', 'move': 'still',
                         'talk': 'marsh_world_traveler', 'reward': 'news', 'key': 'world_marsh_traveler'}])
    return a


AREAS = {k: v for k, v in globals().items() if k.startswith('s_') and callable(v)}

if __name__ == '__main__':
    import json
    try:
        import dng_star
        AREAS.update(dng_star.MAPS)
    except ImportError:
        pass
    for aid in [v for v in sys.argv[1:] if not v.startswith('-')]:
        a = AREAS[aid]()
        for o in a.objects:   # 物の置き場は歩ける地面に（木・岩の上に宝箱を置かない）
            if o.get('type') in ('chest', 'sign', 'waylamp') and a.g[o['y'], o['x']] not in WALK: a.put(o['x'], o['y'], ',', True)
        seen0 = np.zeros((a.H, a.W), bool)
        for s_ in a.spawns.values(): seen0 |= a.reach(s_['x'], s_['y'])
        pk = a.walk() & ~seen0
        a.g[pk] = 'X' if a.meta.get('look') in ('int', 'town') else 'R'
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
