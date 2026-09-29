"""Organic layouts of the ash volcano floors for a repaint (the first paintings followed tile-stepped rows: square lava pools, a stepped lava
lake, rectangular ledges). Same tools as the field areas: layout.json -> guide.py -> mkjob (DSCENE) -> gen.sh -> fit.py -> process (OUT ash) ->
torows.py (the rows for v2/src/maps/ash_volcano.js, VOLCANO legend: R '#', s/: '.', k 'o', l '%', X 'X').
Object cells of the map (stairs, egg, chests, triggers, the NPC, spawns) are kept where ash_volcano.js puts them.
usage: python3 dng_ash.py ash_volcano_2"""
import sys, json
import numpy as np
from lib import Area, fbm

DARK = (40, 26, 16)


def ash_volcano_2():
    """火口: the crater's floor is a lake of molten lava; a ledge path runs round the inner wall from the south stairs, west and north to the
    wide obsidian rim (Fine), on to an east ledge; a causeway of black stone runs from the rim south to the island of the egg."""
    a = Area('ash_volcano_2', 44, 36, 2101, base='R')
    W, H = a.W, a.H
    # the lava lake
    a.blob(22, 17.5, 16.8, 12.2, 'l', rough=0.12, seed=1, force=True)
    # the ledge ring (south stairs landing -> west -> north rim -> east ledge) and the south-east ledge
    a.stroke([(21.5, 33.5), (21, 31), (14, 30.8), (8, 29.5), (5.2, 24), (5, 15), (6, 9), (10, 6), (16, 5.3), (22, 5)], 3.0, 's', wobble=0.6, seed=2)
    a.stroke([(22, 5), (27, 4.5), (32, 5), (36, 7), (38.5, 10.5), (39, 14)], 3.0, 's', wobble=0.6, seed=3)
    a.stroke([(21.5, 31), (27, 31), (31.5, 30.5), (34, 30.5)], 2.6, 's', wobble=0.5, seed=4)
    a.blob(21.5, 32.5, 3.2, 2.2, 's', rough=0.2, seed=5, force=True)
    # the wide obsidian rim where Fine stands
    a.blob(27, 4.6, 6.0, 2.0, 'k', rough=0.25, seed=6, force=True)
    a.blob(21.5, 5, 2.4, 1.4, 'k', rough=0.2, seed=7, force=True)
    # the causeway and the island
    a.stroke([(21.5, 6), (21.5, 10), (21.8, 14)], 2.2, 'k', wobble=0.3, seed=8)
    a.blob(22, 17, 4.4, 3.3, 'k', rough=0.2, seed=9, force=True)
    a.mark('egg', [(21, 16), (22, 16), (21, 17), (22, 17)], 'a huge smooth EGG of glowing red-bronze shell, as big as a cart, resting in a nest of black obsidian shards', (170, 70, 50))
    a.mark('stairs', [(21, 34)], 'rough STONE STEPS going down south out of the crater (the only way out)', (150, 146, 140), solid=False)
    a.rect(20, 34, 3, 1, 's', force=True, keep=True)
    a.scatter('r', 0.03, only='s', seed=41, clear=1)
    a.tidy()
    # keep the cells the map data uses walkable
    keep = [(21, 34), (21, 32), (22, 5), (22, 15), (27, 4), (33, 30), (39, 12), (5, 9)] + [(21 + i, 9 + j) for i in range(2) for j in range(3)]
    for (x, y) in keep:
        if a.g[y, x] not in 'sk': a.g[y, x] = 's'
        a.keep[y, x] = True
    a.spawns = {'stairs': dict(x=21, y=32, dir='n'), 'rim': dict(x=22, y=5, dir='s'), 'egg': dict(x=22, y=15, dir='s')}
    a.exits = []
    a.objects = [dict(type='stairs', x=21, y=34), dict(type='chest', x=33, y=30), dict(type='chest', x=39, y=12), dict(type='chest', x=5, y=9),
                 dict(type='npc', x=27, y=4)] + [dict(type='trigger', x=21 + i, y=9 + j) for i in range(2) for j in range(3)]
    a.meta = dict(name='火口', region='r_ash', zones=[], worldRect=[0, 0, 1, 1])
    return a


def ash_volcano_1():
    """灰の火山 1 階: the same rooms, crossings and object cells as before (ash_volcano.js), drawn as organic caves: the entrance hall (S),
    the west mural room beyond lava river A (crossing A at x 16-18, y 39-41), the lava crevasse B (crossing B at x 27-28, y 31-32), the big
    north cave with its east (hound, mural 2) and west (mural 3) rooms, the passage north to the carved rock door."""
    a = Area('ash_volcano_1', 56, 48, 2202, base='R')
    S = lambda pts, w, ch='s', seed=0, wob=0.5: a.stroke(pts, w, ch, wobble=wob, seed=seed, keep=False, force=True)
    B = lambda cx, cy, rx, ry, ch='s', seed=0: a.blob(cx, cy, rx, ry, ch, rough=0.22, seed=seed, force=True)
    B(28, 39.5, 8.5, 5.0, seed=1); S([(28, 40), (28, 48.5)], 4.2, seed=2, wob=0.3)
    B(9.8, 38.5, 5.6, 4.6, seed=3)
    B(28, 23, 9.5, 5.6, seed=4); S([(28, 37), (28, 27)], 4.0, seed=5, wob=0.3)
    B(10.3, 17.8, 6.8, 6.0, seed=6); S([(20, 21), (14, 20.5)], 3.2, seed=7)
    B(46.5, 17.5, 6.2, 5.8, seed=8); S([(36, 21), (42, 20.5)], 3.2, seed=9)
    S([(28, 19), (28, 7)], 4.0, seed=10, wob=0.3); B(28.5, 5.3, 4.8, 2.4, 'k', seed=11)
    B(48, 15, 3.0, 2.4, 'k', seed=12)
    # lava: river A (N-S, x 16-18), crevasse B (E-W, y 31-32), pools
    S([(17.2, 28.5), (16.6, 33), (17.4, 38), (17, 43), (17.3, 48.5)], 3.0, 'l', seed=16, wob=0.6)
    S([(11.5, 31.6), (18, 31.2), (24, 31.9), (32, 31.3), (40, 31.8), (47, 31.4)], 2.2, 'l', seed=17, wob=0.5)
    for (cx, cy, rx, ry, s_) in [(28, 22, 3.0, 1.9, 13), (44, 22, 2.4, 1.6, 14), (35, 41, 2.0, 1.6, 15)]: B(cx, cy, rx, ry, 'l', s_)
    # the crossings (the painting shows both cooled; the flowing one gets the closed layer) and their banks
    for x in range(16, 19):
        for y in range(39, 42): a.put(x, y, 'k', True); a.keep[y, x] = True
    for x in (27, 28):
        for y in (31, 32): a.put(x, y, 'k', True); a.keep[y, x] = True
    a.rect(13, 39, 3, 3, 's', force=True, keep=True); a.rect(19, 39, 2, 3, 's', force=True, keep=True)
    a.rect(26, 29, 4, 2, 's', force=True, keep=True); a.rect(26, 33, 4, 3, 's', force=True, keep=True)
    # murals on the north walls (read from the floor below), the carved rock door (N)
    for (cells, n) in [([(9, 33), (10, 33)], 'a flaming firebird rising from a burning egg'), ([(47, 11), (48, 11)], 'a great firebird with spread wings over a mountain'),
                       ([(10, 11), (11, 11)], 'people bowing before a sleeping firebird')]:
        a.mark('mural' + str(cells[0][0]), cells, 'a MURAL carved and painted in red and gold ochre on the rock wall: ' + n, (190, 120, 60))
    a.mark('rockdoor', [(27, 2), (28, 2), (29, 2)], 'a round carved ROCK DOOR slab of black stone in the north wall with three bird-shaped hollows', (60, 56, 62))
    keep = [(28, 3), (28, 4), (28, 5), (27, 45), (5, 42), (13, 35), (51, 23), (5, 22), (22, 42), (51, 12), (32, 37), (33, 25), (30, 44), (9, 13), (12, 13),
            (9, 34), (10, 34), (47, 12), (48, 12), (10, 12), (11, 12)] + [(x, y) for x in (39, 40, 16, 17) for y in (20, 21, 22)] + [(x, 47) for x in range(26, 30)]
    for (x, y) in keep:
        if a.g[y, x] not in 'sk': a.g[y, x] = 's'
        a.keep[y, x] = True
    a.scatter('r', 0.012, only='s', seed=41, clear=1)
    a.tidy()
    a.spawns = {'entrance': dict(x=27, y=45, dir='n'), 'stairs': dict(x=28, y=5, dir='s')}
    a.exits = [dict(x=26, y=47, w=4, h=1, to={}, edge='s')]
    a.objects = [dict(type='o', x=x, y=y) for (x, y) in keep]
    a.meta = dict(name='灰の火山', region='r_ash', zones=[], worldRect=[0, 0, 1, 1])
    return a


if __name__ == '__main__':
    for mid in sys.argv[1:]:
        a = globals()[mid]()
        a.save(mid)
        print(a.ascii())
        sp = list(a.spawns.values()); seen = a.reach(sp[0]['x'], sp[0]['y'])
        print({k: bool(seen[s['y'], s['x']]) for k, s in a.spawns.items()}, 'walk', int(a.walk().sum()), 'reached', int(seen.sum()))
