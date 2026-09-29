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


if __name__ == '__main__':
    for mid in sys.argv[1:]:
        a = globals()[mid]()
        a.save(mid)
        print(a.ascii())
        sp = list(a.spawns.values()); seen = a.reach(sp[0]['x'], sp[0]['y'])
        print({k: bool(seen[s['y'], s['x']]) for k, s in a.spawns.items()}, 'walk', int(a.walk().sum()), 'reached', int(seen.sum()))
