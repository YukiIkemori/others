"""The collision of the White Archive's floors, re-measured by hand on the paintings (<id>/gen1e.png when a repaired copy exists,
else gen1.png; the painter drew thin walls and moved a few rooms from the guide). Writes layout.json rows_fit and the spawns.
usage: python3 fit_archive.py <id> [...]
Chars: 'c' marble floor, 'k' carpet, 'X' walls / furniture, '~' outside."""
import json, sys
import numpy as np
from collections import deque

WALK = set('ck')


def grid(W, H):
    g = np.full((H, W), 'X', dtype='<U1')
    g[0, :] = '~'; g[-1, :] = '~'; g[:, 0] = '~'; g[:, -1] = '~'
    return g


def R(g, x0, y0, x1, y1, ch='c'):
    g[y0:y1 + 1, x0:x1 + 1] = ch


def P(g, cells, ch='X'):
    for (x, y) in cells: g[y, x] = ch


# ---------------------------------------------------------------- 1 階 閲覧の間
def archive_1():
    W, H = 44, 36
    g = grid(W, H)
    R(g, 4, 3, 39, 20)                       # the reading hall (its bottom wall is the painted line at row 21)
    R(g, 19, 3, 25, 4, 'k'); R(g, 21, 2, 22, 2, 'k')   # the dais with the stairs up (rail x 18 / x 26 and along row 5)
    P(g, [(18, y) for y in range(3, 6)] + [(26, y) for y in range(3, 6)] + [(19, 5), (24, 5), (25, 5)])
    R(g, 20, 5, 23, 5, 'k')                  # the opening in the dais rail (repaired painting)
    R(g, 5, 6, 12, 6, 'X'); R(g, 31, 6, 37, 6, 'X'); R(g, 13, 7, 30, 7, 'X')
    for y in (10, 13, 17):
        R(g, 5, y, 12, y, 'X'); R(g, 16, y, 20, y, 'X'); R(g, 23, y, 27, y, 'X'); R(g, 30, y, 37, y, 'X')
    P(g, [(7, 20)])                          # the reading table (the sealed letter)
    R(g, 20, 21, 23, 22)                     # the way down to the entrance hall
    R(g, 15, 23, 28, 32)                     # the entrance hall
    R(g, 21, 33, 22, 34)                     # the great door
    R(g, 6, 26, 12, 31)                      # the west alcove (spring)
    R(g, 13, 28, 14, 28)
    R(g, 30, 26, 34, 31)                     # the east alcove (the closed stair down behind a rail)
    R(g, 29, 28, 29, 28)
    R(g, 31, 29, 35, 29, 'X')
    sp = {'entrance': dict(x=21, y=32, dir='n'), 'from2': dict(x=21, y=3, dir='s')}
    return g, sp


def from_intfit(aid):
    """the rows read from the painting alone (intfit2.py), '~' outside the building kept, as the start of the hand fit"""
    rows = json.load(open(aid + '/intfit.json'))['rows']
    g = np.array([list(r) for r in rows], dtype='<U1')
    H, W = g.shape
    g[0, :] = '~'; g[-1, :] = '~'; g[:, 0] = '~'; g[:, -1] = '~'
    g[(g == '~')] = 'X'
    g[0, :] = '~'; g[-1, :] = '~'; g[:, 0] = '~'; g[:, -1] = '~'
    return g


# ---------------------------------------------------------------- 2 階 写本の間（repaired: the stairs up pasted into the NE corner）
def archive_2():
    g = grid(44, 36)
    R(g, 4, 3, 39, 9)                        # the north room
    R(g, 37, 2, 38, 2)                       # the stairs up (pasted niche)
    R(g, 5, 10, 6, 12)                       # the west doorway (north <-> middle)
    R(g, 4, 13, 39, 19)                      # the middle room
    R(g, 38, 20, 39, 21)                     # the east doorway (middle <-> south)
    R(g, 4, 22, 39, 30)                      # the south room
    for y in (4, 5, 7, 8):
        R(g, 12, y, 21, y, 'X'); R(g, 23, y, 31, y, 'X')
    for y in (14, 15, 17):
        R(g, 10, y, 21, y, 'X'); R(g, 23, y, 33, y, 'X')
    for y in (24, 25, 27, 28):
        R(g, 10, y, 21, y, 'X'); R(g, 23, y, 33, y, 'X')
    R(g, 4, 24, 4, 30, 'X'); R(g, 7, 24, 7, 30, 'X')   # the walls of the long stair down
    R(g, 5, 27, 6, 30, 'X')                  # the stair going down (the lower flight)
    sp = {'from1': dict(x=6, y=23, dir='n'), 'from3': dict(x=37, y=3, dir='s')}
    return g, sp


# ---------------------------------------------------------------- 3 階 記憶の回廊（封印の扉 (21-22, 5) は tilePatch で閉じる）
def archive_3():
    g = grid(44, 36)
    R(g, 21, 2, 22, 4)                       # behind the sealed door: the stairs up
    R(g, 21, 5, 22, 5)                       # the sealed door (closed by the map's tilePatch until final_rowell)
    R(g, 17, 5, 26, 6)                       # the hall before the door
    R(g, 7, 7, 36, 10)                       # the ring: north
    R(g, 7, 7, 10, 28); R(g, 33, 7, 36, 28)  # west / east
    R(g, 7, 24, 36, 28)                      # south
    R(g, 18, 29, 26, 32)                     # the resting place
    R(g, 9, 29, 9, 31)                       # the stairs down (one cell wide)
    for (y0, y1, ly) in ((8, 10, 9), (14, 15, 14), (19, 21, 20), (24, 26, 25)):
        R(g, 4, y0, 6, y1); P(g, [(4, ly)])
        R(g, 37, y0, 38, y1); P(g, [(39, ly)])
    sp = {'from2': dict(x=9, y=29, dir='n'), 'from4': dict(x=21, y=3, dir='s')}
    return g, sp


# ---------------------------------------------------------------- 4 階 伝説の間
def archive_4():
    g = grid(44, 36)
    R(g, 19, 2, 24, 6)                       # the stair alcove (stairs up at (21-22, 2))
    R(g, 12, 7, 38, 19)                      # the Hall of Legends
    R(g, 20, 6, 23, 19, 'k')                 # the red carpet
    R(g, 4, 5, 11, 31)                       # the west hall of statues
    R(g, 12, 27, 39, 31)                     # the painted corridor
    for x0, x1 in ((13, 15), (19, 21), (26, 28), (33, 36)): R(g, x0, 27, x1, 27, 'X')   # the four paintings on the wall
    for (x, y) in ((5, 8), (5, 9), (9, 8), (9, 9), (5, 13), (5, 14), (9, 13), (9, 14), (5, 17), (5, 18), (9, 17), (9, 18)): P(g, [(x, y)])   # statues
    P(g, [(15, 9), (15, 17), (19, 13), (24, 13), (34, 9), (34, 17)])   # pillars
    R(g, 38, 31, 39, 31)                     # the stairs down
    sp = {'from3': dict(x=37, y=30, dir='w'), 'from5': dict(x=21, y=3, dir='s')}
    return g, sp


# ---------------------------------------------------------------- 5 階 白紙の写字室（階段の口 (19-20, 4) は tilePatch で白い紙に閉じる）
def archive_5():
    g = grid(40, 34)
    R(g, 19, 2, 20, 4)                       # the stairs up (wrapped in white paper until the Grand Scribe falls)
    R(g, 5, 5, 34, 20)                       # the great copying hall
    R(g, 18, 9, 21, 20, 'k')                 # the red carpet
    R(g, 18, 6, 21, 7, 'X')                  # the Grand Scribe's desk
    for y in (6, 9, 12, 14, 17):
        R(g, 6, y, 13, y, 'X'); R(g, 26, y, 33, y, 'X')
    R(g, 19, 21, 20, 22)                     # the passage
    R(g, 15, 23, 24, 29); P(g, [(15, 23), (24, 23), (15, 29), (24, 29)])   # the antechamber (stepped corners)
    R(g, 19, 30, 20, 31)                     # the stairs down
    sp = {'from4': dict(x=19, y=29, dir='n'), 'from6': dict(x=19, y=5, dir='s')}
    return g, sp


# ---------------------------------------------------------------- 6 階 虚ろの間（gen2: 丸い壁を描き直した）
def archive_6():
    g = from_intfit('archive_6')
    R(g, 15, 4, 20, 5)                       # the dais steps (walkable)
    P(g, [(17, 2), (18, 2), (17, 3), (18, 3)])   # the altar with the Chronicle of Beginnings
    R(g, 17, 29, 18, 29)                     # the stairs down
    sp = {'from5': dict(x=17, y=27, dir='n'), 'altar': dict(x=17, y=6, dir='n')}
    return g, sp

MAPS = {'archive_1': archive_1, 'archive_2': archive_2, 'archive_3': archive_3, 'archive_4': archive_4, 'archive_5': archive_5, 'archive_6': archive_6}

if __name__ == '__main__':
    for aid in sys.argv[1:]:
        g, sp = MAPS[aid]()
        H, W = g.shape
        rows = [''.join(r) for r in g]
        d = json.load(open(aid + '/layout.json'))
        assert (d['w'], d['h']) == (W, H), (d['w'], d['h'], W, H)
        d['rows_fit'] = rows
        d['spawns'] = sp
        json.dump(d, open(aid + '/layout.json', 'w'), ensure_ascii=False, indent=0)
        s0 = list(sp.values())[0]
        seen = {(s0['x'], s0['y'])}; q = deque(seen)
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                i, j = x + dx, y + dy
                if 0 <= i < W and 0 <= j < H and (i, j) not in seen and rows[j][i] in WALK: seen.add((i, j)); q.append((i, j))
        un = [(x, y) for y in range(H) for x in range(W) if rows[y][x] in WALK and (x, y) not in seen]
        print(aid, 'walkable', sum(r.count('c') + r.count('k') for r in rows), 'unreached', un[:20])
        for k, s in sp.items(): print(' spawn', k, (s['x'], s['y']) in seen)
        print('   ' + ''.join(str(i % 10) for i in range(W)))
        for y, r in enumerate(rows): print('%2d %s' % (y, r.replace('c', '.').replace('X', '#')))
