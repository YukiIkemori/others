"""Layouts of the painted desert CAMPS and the mirage market (small outdoor town maps drawn by src/maps/desert_camps.js / desert_optional.js).
The collision is the maps' own rows (dumped by dump_rows.js into camps_rows.json), converted to the field chars of lib.py; the painting is
traced from it (guide.py), fitted (fit.py), and the fitted rows go back into the map file as literal rows (put_rows.py).
Props, NPCs, chests and doors of the maps are sprites drawn over the painting (not painted).
usage: python3 camps.py <map id> [...]   -> <map id>/layout.json"""
import sys, json
import numpy as np
from lib import Area

MUD = (196, 150, 104)
SAND = (214, 150, 100)
CONV = {'u': 'u', 's': 's', 'k': 'k', 'd': '.', 'm': 'R', 'X': 'R', 'x': 'R', 'w': 'w', 'g': ',', 'Q': 'c', 'c': 'c', '_': '_'}
SRC = json.load(open('camps_rows.json'))


def base(mid, seed):
    d = SRC[mid]
    a = Area(mid, d['w'], d['h'], seed, base='u')
    for y, r in enumerate(d['rows']):
        for x, ch in enumerate(r): a.g[y, x] = CONV[ch]
    a.keep[:] = True     # the rows are the map's collision: later passes do not change them
    for k, s in d['spawns'].items(): a.spawns[k] = dict(s)
    for e in d['exits']: a.exits.append(dict(x=e['x'], y=e['y'], w=e['w'], h=e['h'], to=e['to'], edge='s'))
    a.objects = [dict(type=t, id=i, x=x, y=y) for t, i, x, y in d['objects'] if t in ('examine', 'stairs', 'spring', 'brazier', 'chest')]
    a.meta = dict(name=mid, region='r_desert', worldRect=[0, 0, 1, 1], zones=[], links={})
    return a


def desert_camp1():
    a = base('desert_camp1', 811)
    a.notes.append('camp 1 "the rock well": a hollow among red rock outcrops, a dry well and a memorial pillar (sprites)')
    return a


def desert_camp2():
    a = base('desert_camp2', 812)
    return a


def desert_camp3():
    a = base('desert_camp3', 813)
    a.meta['tilePatches'] = SRC['desert_camp3']['tilePatches']   # the old spring fills after the region is cleared (closed layer)
    a.g[0:2, :] = 'R'; a.g[0:8, 28:] = 'R'                      # the cliff runs along the whole top (frames the oasis)
    cells = [(x, y) for y in range(1, 8) for x in range(16, 28) if a.g[y, x] == 'R']
    a.mark('tomb', cells, "the carved FACADE OF A ROYAL TOMB cut into a sheer red sandstone cliff: a great rock wall with a tall recessed doorway framed by colossal carved pillars and a sun-disc lintel, the king's face chiselled away; the dark tomb doorway at the foot of the recess (the paved gap in this block) leads inside", SAND)
    a.mark('door', [(21, 3), (22, 3)], 'the dark tomb DOORWAY', (40, 26, 16), solid=False)
    return a


def desert_mirage():
    a = base('desert_mirage', 814)
    return a


AREAS = {'desert_camp1': desert_camp1, 'desert_camp2': desert_camp2, 'desert_camp3': desert_camp3, 'desert_mirage': desert_mirage}

if __name__ == '__main__':
    for mid in sys.argv[1:]:
        a = AREAS[mid]()
        a.save(mid)
        print(a.ascii())
