"""Layouts of the painted maps of the Gard mountains (ガルド山地 r_mine): the field areas (g_pass, g_valley, g_rail), the cavern town
(dovan) and the floors of the deep mine (mine_1/2/3). Area switching like the isles' ../field_isles/areas_isles.py.
usage: python3 areas_mine.py <id> [...]   -> <id>/layout.json + ascii on stdout (then guide.py <id>)
Field areas -> tomap.py (v2/src/maps/field_mine_*.js); the town and the floors -> put_rows.py (v2/src/maps/mine_painted_rows.js,
read by the hand-written map files mine_dovan.js, mine_deep.js).
Chars: lib.py (mine copy)."""
import sys, math
import numpy as np
from lib import Area, fbm, WALK, rail

STONE = (150, 144, 136)
DARK = (40, 26, 16)
WOOD = (120, 84, 52)
TIMBER = (140, 100, 62)
ZONE = 'zw_mine'


def door(a, x, y, w=1, ch=':'):
    a.mark('door', [(x + i, y) for i in range(w)], 'a dark ENTRANCE', DARK, solid=False)
    a.rect(x, y, w, 1, ch, force=True, keep=True)


def meadow(a, s1, s2):
    """alpine grass with patches of heather and mountain flowers"""
    a.mask_fill(fbm(s1, a.W, a.H, 8) > 0.58, ';', only=',')
    a.mask_fill(fbm(s2, a.W, a.H, 5) > 0.74, '"', only=',;')


# ======================================================================== field areas
def g_pass():
    """ガルドの峠道: the pass from the snow field's hot-spring pass (west) into the Gard mountains. The last patches of old snow lie in the
    west among dark firs; a gravel road climbs east between a wall of grey-brown CLIFFS in the north and a deep GORGE in the south with a
    torrent far below; a boulder field of fallen rock on a slope; a stone CAIRN with an iron marker; in the north cliff the boarded-up mouth
    of an old smiths' TUNNEL (the smiths' shortcut to Dovan, opened after the choice); the road leaves by the east edge towards the valley."""
    a = Area('g_pass', 50, 36, 7101, base=',')
    W, H = a.W, a.H
    meadow(a, 3, 4)
    # old snow in the west (fading east)
    sn = fbm(5, W, H, 6)
    ys, xs = np.mgrid[0:H, 0:W]
    a.mask_fill((sn + (14 - xs) * 0.05) > 0.62, 's', only=',;"')
    # the north cliff wall and the south gorge
    cl = a.region([(-3, -3), (53, -3), (53, 7), (44, 8.5), (38, 7), (30, 9.5), (22, 8), (14, 10), (8, 8.5), (-3, 9)], 'R', rough=1.0, seed=1, force=True)
    a.region([(-3, 31), (6, 30), (14, 32.5), (24, 30.5), (34, 31.5), (44, 29.5), (53, 30.5), (53, 39), (-3, 39)], 'R', rough=0.9, seed=2, force=True)
    a.region([(-3, 34), (10, 33.6), (24, 34.2), (40, 33.4), (53, 33.8), (53, 39), (-3, 39)], 'l', rough=0.5, seed=3, force=True)
    # conifer groves (west and on the slopes)
    for (x, y, rx, ry, s_) in [(4, 12, 3.2, 2.2, 11), (7, 26, 3.4, 2.4, 12), (18, 13, 2.2, 1.6, 13), (30, 26, 2.6, 1.8, 14), (43, 12, 2.6, 1.8, 15), (46, 25, 2.2, 1.6, 16)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',;"s')
    # boulder field on the slope (south-middle)
    for (x, y) in [(22, 25), (24, 27), (21, 28), (26, 24), (27, 28), (19, 26)]:
        a.put(x, y, 'r')
    # the old smiths' tunnel in the north cliff (door at 33, 9; closed by boards until the choice)
    a.rect(32, 7, 3, 3, 'R', force=True)
    a.mark('tunnel', [(32, 8), (33, 8), (34, 8)], "the boarded-up MOUTH OF AN OLD TUNNEL cut into the cliff: a heavy timber frame, planks nailed across the dark opening, a rusty lantern hook above it", DARK)
    door(a, 33, 9, 1, ':')
    # the cairn
    a.mark('cairn', [(15, 21)], 'a tall stone CAIRN of piled grey stones with a rusty iron marker plate on top', STONE)
    # the road (west edge -> east edge), the path to the tunnel
    road = [(-1, 18.5), (8, 18.5), (16, 17.5), (24, 19.5), (34, 18), (42, 19.5), (50.5, 19.5)]
    a.stroke(road, 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(33, 17.5), (33.5, 13), (33.5, 10)], 1.3, ':', seed=7, force=True)
    a.scatter('b', 0.010, only=',;', seed=41, clear=1)
    a.scatter('r', 0.006, only=',;s', seed=42, clear=1)
    a.tidy()
    a.exit('w', 18, 19, {'map': 'f_passinn', 'spawn': 'east'}, 'west')
    a.exit('e', 19, 20, {'map': 'g_valley', 'spawn': 'west'}, 'east')
    a.spawns['tunnel'] = dict(x=33, y=10, dir='s')
    a.objects += [
        dict(type='examine', x=15, y=22, event='mine_pass_cairn'),
        dict(type='sign', x=10, y=21, text='ガルドの峠道\n西 → 湯けむりの峠\n東 → 鉱石の谷・鉱山都市ドヴァン'),
        dict(type='chest', id='g_pass_c1', x=44, y=24, item='i_potion', n=2),
        dict(type='waylamp', id='wl_g_pass_1', x=20, y=16, lit=True),
        dict(type='waylamp', id='wl_g_pass_2', x=40, y=22, lit=True),
    ]
    a.meta.update(name='ガルドの峠道', sub='雪原から山地へ越える峠', region='r_mine', worldRect=[284, 78, 50, 36], outside='rock',
                  zones=[{'rect': None, 'zone': ZONE}], links={}, npcs=[], smooth=0.6)
    return a


def g_valley():
    """鉱石の谷: a wide valley between high cliffs. In the middle of the north cliff the SURFACE GATE of the cavern town Dovan: a great door
    of dark timber and iron cut into the rock, flanked by two tall timber WATCHTOWERS with little roofs. A cold stream comes down from the
    north-east and runs south-west under a timber bridge; grey SLAG HEAPS and heaps of ore; an open ORE-SORTING SHED with a slate roof;
    a rail track comes out beside the gate and runs east along the valley towards the cliff line. Firs on the slopes, heather."""
    a = Area('g_valley', 54, 40, 7202, base=',')
    W, H = a.W, a.H
    meadow(a, 5, 6)
    # the cliffs: north (with the gate), south, the corners
    a.region([(-3, -3), (57, -3), (57, 6), (46, 7.5), (38, 6), (32, 8.5), (22, 8.5), (16, 6.5), (8, 8), (-3, 7)], 'R', rough=0.9, seed=1, force=True)
    a.region([(-3, 34), (8, 33), (18, 35.5), (28, 34), (40, 36), (57, 33), (57, 43), (-3, 43)], 'R', rough=0.9, seed=2, force=True)
    # the gate of Dovan (door at 27, 8) and its towers
    a.rect(24, 5, 7, 4, 'R', force=True)
    a.mark('gate', [(x, y) for x in range(25, 30) for y in range(5, 8)], 'the great GATE of the cavern town: a tall arched opening cut into the cliff, closed by huge double doors of dark timber bound with iron, a carved stone lintel with an anvil emblem above', (92, 70, 52))
    door(a, 27, 8, 1, 'c')
    a.rect(26, 9, 3, 2, 'c', force=True, keep=True)
    a.mark('tower_w', [(22, 7), (23, 7), (22, 8), (23, 8)], 'a tall square timber WATCHTOWER on stone footings with a small shingled roof', TIMBER)
    a.mark('tower_e', [(31, 7), (32, 7), (31, 8), (32, 8)], 'a tall square timber WATCHTOWER on stone footings with a small shingled roof', TIMBER)
    # the stream NE -> SW with a bridge on the road
    st = a.stroke([(56, 9), (46, 13), (40, 18), (35, 22), (30, 27), (22, 30), (12, 33), (6, 36), (3, 41)], 2.2, 'w', keep=False, wobble=0.5, seed=4, only=',;"R')
    # slag heaps and ore heaps, the sorting shed
    for (x, y, rx, ry, s_) in [(10, 14, 2.6, 1.8, 21), (44, 27, 3.0, 2.0, 22), (15, 26, 2.2, 1.6, 23)]:
        a.blob(x, y, rx, ry, 'r', rough=0.3, seed=s_, only=',;"')
    a.mark('shed', [(x, y) for x in range(36, 42) for y in range(10, 13)], 'an open ORE-SORTING SHED: a slate roof on thick timber posts over wooden sorting tables and heaps of grey ore', (104, 96, 92))
    # firs on the slopes
    for (x, y, rx, ry, s_) in [(4, 20, 2.6, 3.4, 31), (50, 20, 2.4, 3.0, 32), (48, 32, 2.6, 1.6, 33), (19, 12, 1.8, 1.3, 34)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',;"')
    # the road: west edge -> the gate; the branch east; the rail from the gate east
    wet = a.g == 'w'
    a.stroke([(-1, 20.5), (8, 20.5), (16, 19), (24, 17), (27.5, 13), (27.5, 9)], 2.0, '.', wobble=0.2, seed=6)
    a.stroke([(28, 16), (36, 20), (44, 22), (54.5, 22.5)], 2.0, '.', wobble=0.2, seed=7)
    # timber bridges where the road crosses the stream (the planks, a little wider than the road)
    for y, x in zip(*np.nonzero(wet & np.isin(a.g, ['.']))):
        a.g[y, x] = '='
    rail(a, [(30.6, 8.9), (32.5, 10.4), (34, 13.6), (38, 15.4), (46, 15.9), (54.8, 16)])
    a.tidy()
    a.exit('w', 20, 21, {'map': 'g_pass', 'spawn': 'east'}, 'west')
    a.exit('e', 22, 23, {'map': 'g_rail', 'spawn': 'west'}, 'east')
    a.spawns['gate'] = dict(x=27, y=9, dir='s')
    a.objects += [
        dict(type='door', x=27, y=8, to={'map': 'dovan', 'spawn': 'gate'}),
        dict(type='sign', x=24, y=12, text='鉱山都市ドヴァン\n地の底の町。門の奥へ。'),
        dict(type='examine', x=38, y=13, event='mine_sorting_shed'),
        dict(type='chest', id='g_valley_c1', x=8, y=16, item='i_ether', n=1),
        dict(type='waylamp', id='wl_g_valley_1', x=14, y=22, lit=True),
        dict(type='waylamp', id='wl_g_valley_2', x=24, y=12, lit=True),
        dict(type='waylamp', id='wl_g_valley_3', x=44, y=24, lit=True),
    ]
    a.meta.update(name='鉱石の谷', sub='鉱山都市ドヴァンの門の谷', region='r_mine', worldRect=[334, 76, 54, 40], outside='rock',
                  zones=[{'rect': None, 'zone': ZONE}], links={'dovan': {'map': 'g_valley', 'spawn': 'gate'}}, npcs=[], smooth=0.6)
    return a


def g_rail():
    """トロッコ線の崖: the cart line runs along a shelf cut into the cliffs above a deep chasm; a timber TRESTLE BRIDGE carries the rails
    and a plank walk over a side ravine; a CLIFF LIFT (a timber frame with a winch and a hanging cage) stands at the shelf's edge; a
    switchback footpath climbs to the ridge top in the north where the HERMIT'S HUT stands among dwarf pines (door facing south); the
    rails end in the east at the mouth of a TUNNEL closed by a timber barrier (the line to the highlands, still blocked)."""
    a = Area('g_rail', 50, 36, 7303, base='R')
    W, H = a.W, a.H
    S = lambda pts, w, ch, seed=0, wob=0.3: a.stroke(pts, w, ch, wobble=wob, seed=seed, keep=False, force=True)
    # the ridge top (north): grass and dwarf pines
    top = a.region([(12, -3), (53, -3), (53, 9), (44, 11), (34, 10.5), (24, 11.5), (16, 9)], ',', rough=1.0, seed=1, force=True)
    meadow(a, 7, 8)
    # the higher crags close the ridge top in the north
    a.region([(-3, -3), (53, -3), (53, 1.5), (40, 2.2), (30, 1.2), (20, 2.4), (-3, 2)], 'R', rough=0.9, seed=16, force=True)
    # the shelf (middle band) with the road and the rails
    shelf = a.region([(-3, 14.5), (10, 14), (22, 16), (34, 15), (46, 15.5), (53, 15), (53, 25), (44, 24.5), (34, 25.5), (22, 25), (10, 24), (-3, 24.5)], ',', rough=0.8, seed=2, force=True)
    a.mask_fill(shelf & (fbm(9, W, H, 5) > 0.5), 'k', only=',')
    # the chasm below (south)
    a.region([(-3, 29), (12, 28), (26, 30), (40, 28.5), (53, 29.5), (53, 39), (-3, 39)], 'l', rough=0.8, seed=3, force=True)
    # the side ravine across the shelf (x 20-24), bridged by the trestle
    a.region([(19.5, 14), (24.5, 14), (24, 30), (20, 30)], 'l', rough=0.3, seed=4, force=True)
    # the road and the rail along the shelf
    a.stroke([(-1, 20.5), (10, 20.5), (20, 20), (30, 20.5), (40, 20), (46, 20)], 2.0, '.', wobble=0.15, seed=5)
    rail(a, [(-0.5, 17.5), (12, 17.3), (30, 17.6), (44, 17.5), (48.6, 17.5)], ground='k')
    # the trestle bridge (planks over the ravine for the road; rails on it)
    a.rect(19, 19, 7, 3, '=', force=True, keep=True)
    a.mark('trestle', [(x, y) for x in range(19, 26) for y in (18,)], 'the timber TRESTLE of the bridge: a lattice of heavy beams under the deck, the rails on top', TIMBER)
    # the cliff lift at the shelf's south edge (x 36-38, y 23-24)
    a.mark('lift', [(36, 23), (37, 23), (38, 23)], 'a CLIFF LIFT: a tall timber frame with a winch drum and ropes, an iron cage hanging over the drop', TIMBER)
    # the tunnel mouth at the east end of the rails (the rails run in at row 17)
    a.rect(47, 13, 3, 7, 'R', force=True)
    a.mark('tunnel', [(48, 16), (49, 16), (48, 17), (49, 17), (48, 18), (49, 18)], 'the MOUTH OF A RAIL TUNNEL in the east cliff: a timber portal, the rails run into it; a barrier of crossed beams closes it', DARK)
    a.put(47, 17, 'k', True); a.keep[17, 47] = True
    a.region([(53, 12), (47.5, 18.5), (46.5, 21), (47.5, 25), (53, 26)], 'R', rough=0.6, seed=17, force=True)
    # the switchback up to the hermit's hut (north-east)
    S([(33, 18.5), (31, 15), (34, 12.5), (38, 11.5), (41, 9)], 1.3, ':', seed=7)
    a.mark('hut', [(x, y) for x in range(39, 44) for y in range(4, 8) if (x, y) != (41, 7)], "a small HERMIT'S HUT of fieldstone and timber with a mossy turf roof and a crooked chimney, a bench and herb pots beside the door", (118, 96, 72))
    door(a, 41, 7, 1, ':')
    for (x, y, rx, ry, s_) in [(18, 4, 2.6, 1.8, 11), (30, 5, 2.0, 1.4, 12), (47, 8, 1.6, 1.2, 13)]:
        a.blob(x, y, rx, ry, 'b', rough=0.4, seed=s_, only=',;"')
    for (x, y, rx, ry, s_) in [(26, 3, 2.0, 1.4, 14), (35, 2, 1.8, 1.2, 15)]:
        a.blob(x, y, rx, ry, 'T', rough=0.4, seed=s_, only=',;"')
    a.scatter('r', 0.008, only=',;k', seed=42, clear=1)
    a.tidy()
    a.exit('w', 20, 21, {'map': 'g_valley', 'spawn': 'east'}, 'west')
    a.spawns['hut'] = dict(x=41, y=8, dir='s')
    a.spawns['railend'] = dict(x=46, y=18, dir='w')
    a.objects += [
        dict(type='door', x=41, y=7, to={'map': 'mine_hermit', 'spawn': 'door'}),
        dict(type='examine', x=47, y=17, event='mine_rail_tunnel'),
        dict(type='examine', x=37, y=22, event='mine_cliff_lift'),
        dict(type='sign', x=8, y=22, text='トロッコ線\n東の果ては、高原への古いトンネル。\n尾根の上に、隠者の庵。'),
        dict(type='chest', id='g_rail_c1', x=14, y=6, pool='p_T'),
        dict(type='waylamp', id='wl_g_rail_1', x=12, y=23, lit=True),
        dict(type='waylamp', id='wl_g_rail_2', x=30, y=23, lit=True),
    ]
    a.meta.update(name='トロッコ線の崖', sub='崖の棚を走る古いトロッコの線', region='r_mine', worldRect=[388, 80, 50, 36], outside='rock',
                  zones=[{'rect': None, 'zone': ZONE}], links={}, npcs=[], smooth=0.6)
    return a


AREAS = {k: v for k, v in globals().items() if k.startswith('g_') and callable(v)}

if __name__ == '__main__':
    import json
    import dng_mine
    AREAS.update(dng_mine.MAPS)
    for aid in sys.argv[1:]:
        a = AREAS[aid]()
        seen0 = np.zeros((a.H, a.W), bool)
        for s_ in a.spawns.values(): seen0 |= a.reach(s_['x'], s_['y'])
        pk = a.walk() & ~seen0
        a.g[pk] = 'R'
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
