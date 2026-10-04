"""Hand-measured collision of the painted floors whose painting moved away from the guide (fit.py cannot read it):
oblivion_4 (the painter put the corridors at rows 6-7 / 17-18 and the shelves at rows 4-5). usage: python3 handfit.py oblivion_4
-> layout.json rows_fit + spawns."""
import json, sys
import numpy as np


def R(g, x0, y0, x1, y1, ch='c'):
    g[y0:y1 + 1, x0:x1 + 1] = ch


def oblivion_4():
    g = np.full((26, 48), '~', dtype='<U1')
    R(g, 1, 3, 46, 20, 'X')
    for (x0, x1) in ((3, 12), (18, 25), (32, 39)): R(g, x0, 6, x1, 18)          # the three rooms
    for (x0, x1) in ((13, 17), (26, 31), (40, 42)):
        R(g, x0, 6, x1, 7); R(g, x0, 17, x1, 18)                                 # their corridors (north / south)
    g[6, 43] = 'c'; g[17, 43] = 'c'                                             # the doorways into the stair hall
    R(g, 44, 5, 45, 19)                                                          # the stair hall (stairs down at rows 18-19)
    R(g, 2, 12, 2, 13)                                                           # the stairs up (west niche)
    for x in (7, 21, 35): R(g, x, 11, x + 1, 12, 'X')                            # the reading tables
    sp = {'from3': dict(x=3, y=12, dir='e'), 'from5': dict(x=44, y=17, dir='n'), 'loop': dict(x=4, y=13, dir='e')}
    return g, sp


MAPS = {'oblivion_4': oblivion_4}
if __name__ == '__main__':
    for aid in sys.argv[1:]:
        g, sp = MAPS[aid]()
        d = json.load(open(aid + '/layout.json'))
        assert (d['w'], d['h']) == (g.shape[1], g.shape[0])
        d['rows_fit'] = [''.join(r) for r in g]; d['spawns'] = sp
        json.dump(d, open(aid + '/layout.json', 'w'), ensure_ascii=False, indent=0)
        print('   ' + ''.join(str(i % 10) for i in range(g.shape[1])))
        for y, r in enumerate(d['rows_fit']): print('%2d %s' % (y, r.replace('c', '.')))
