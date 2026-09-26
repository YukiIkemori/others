#!/usr/bin/env python3
"""R3 map drafting helper for yule (雪の村ユール). Prints the rows/decor block
that src/maps/region3_yule.js carries between `// @rows yule` and `// @end yule`.
  python3 tools/fixtures/reg3/gen_yule.py --write   splices it into the map file
"""
import sys, re
W, H = 52, 42
g = [['*'] * W for _ in range(H)]
d = [['.'] * W for _ in range(H)]

def fill(x0, y0, x1, y1, ch, grid=None):
    grid = grid or g
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = ch

def put(x, y, s, grid=None):
    grid = grid or g
    for i, ch in enumerate(s):
        if ch != ' ':
            grid[y][x + i] = ch

def dec(x, y, s):
    for i, ch in enumerate(s):
        if ch not in ' .':
            d[y][x + i] = ch

def house(x0, y0, w, h, doors, interior):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            edge = y < y0 + 2 or y == y0 + h - 1 or x == x0 or x == x0 + w - 1
            g[y][x] = 'B' if edge else '_'
    for dx in doors:
        g[y0 + h - 1][dx] = 'D'
    for i, row in enumerate(interior):
        assert len(row) == w - 2, (x0, y0, i, row)
        put(x0 + 1, y0 + 2 + i, row)

# ---------------------------------------------------------------- the forest ring
fill(0, 0, W - 1, 1, 'T')
fill(0, 0, 1, H - 1, 'T')
fill(W - 2, 0, W - 1, H - 1, 'T')
fill(0, H - 2, W - 1, H - 1, 'T')
for x, y in [(2, 2), (3, 2), (2, 3), (15, 2), (16, 2), (17, 2), (36, 2), (37, 2), (48, 2), (49, 2), (49, 3),
             (2, 14), (2, 15), (2, 24), (2, 25), (2, 26), (2, 27), (2, 37), (2, 38), (2, 39), (3, 39),
             (49, 13), (49, 14), (49, 15), (49, 24), (49, 25), (49, 26), (49, 27), (49, 35), (49, 36), (49, 37), (49, 38), (49, 39),
             (14, 38), (15, 39), (22, 39), (23, 39), (28, 39), (29, 39), (36, 39), (37, 38)]:
    g[y][x] = 'T'
# ---------------------------------------------------------------- streets (cobble under the snow)
fill(3, 13, 48, 14, '.')      # main street
fill(3, 25, 48, 26, '.')      # lower street
fill(25, 13, 26, 41, '.')     # the road to the gate
fill(19, 15, 32, 22, '.')     # the plaza
fill(24, 38, 27, 41, '.')     # gate path
g[40][23] = g[40][28] = '*'
# ---------------------------------------------------------------- 宿屋 (inn)
house(3, 3, 12, 9, [8], [
    'b_b____c__',
    'b_b____c__',
    '_______c__',
    '__________',
    'b_b___hth_',
    'b_b_______',
])
# ---------------------------------------------------------------- 集会所 (the meeting hall, the great hearth)
house(18, 2, 17, 11, [26], [
    '_u____ccc____u_',
    '_______________',
    '__h_h_____h_h__',
    '__tttt___tttt__',
    '___h_h_____h_h_',
    '_______________',
    '___t_______t___',
    'p_____________p',
])
# ---------------------------------------------------------------- 酒場 (tavern)
house(38, 3, 12, 9, [43], [
    'o_________',
    '_ccccc____',
    '__________',
    '_hth__hth_',
    '__________',
    '_hth____p_',
])
# ---------------------------------------------------------------- 道具屋 (item shop)
house(3, 16, 10, 8, [7], [
    'uu____uu',
    '__ccc___',
    '________',
    'o______p',
    '________',
])
# ---------------------------------------------------------------- 武器と防具の店 (the smithy)
house(37, 16, 13, 8, [43], [
    '___________',
    '_ccc___ccc_',
    '___________',
    '___________',
    'o_________o',
])
# ---------------------------------------------------------------- 村長の家 (Jorn's house)
house(3, 28, 11, 9, [8], [
    'b______kk',
    'b________',
    '___hth___',
    '_________',
    '_______b_',
    'p______b_',
])
# ---------------------------------------------------------------- 猟師ベックの小屋 (Beck's lodge)
house(16, 29, 8, 8, [19], [
    'b____o',
    'b_____',
    '______',
    '____t_',
    'j_____',
])
# ---------------------------------------------------------------- 家族の家 (a family home)
house(29, 29, 9, 8, [33], [
    'b_b___k',
    'b_b____',
    '_______',
    '_th____',
    '_______',
])
# ---------------------------------------------------------------- the frozen pond (ice fishing)
fill(40, 28, 48, 33, 'e')
for x, y in [(40, 28), (48, 28), (40, 33), (48, 33), (41, 33), (47, 33), (48, 32)]:
    g[y][x] = '*'
g[30][44] = '~'
# ---------------------------------------------------------------- the sheep pen (fence)
for x in range(40, 48):
    g[35][x] = 'F'
    g[39][x] = 'F'
for y in range(35, 40):
    g[y][40] = 'F'
    g[y][47] = 'F'
g[35][43] = '*'   # the gate gap
g[35][44] = '*'
# ---------------------------------------------------------------- the woodshed (roofed, closed)
fill(14, 17, 17, 19, 'R')
fill(14, 20, 17, 20, 'B')
# ---------------------------------------------------------------- plaza pieces
# 白竜の像 (NPC obj:r3_dragon_statue at 25,18) · the frozen well (decor u at 21,16)
# notice board spot (tier 1 patch) and trees by the gate
# ---------------------------------------------------------------- decor
# inn: wall face y4, furniture
dec(3, 4, '.w.^.p.^.w.^')
dec(4, 5, '.....F...C')
dec(4, 7, '....&.')
dec(4, 5, '.y')
dec(4, 10, '.........Z')
dec(4, 12, '...;..7')
# hall
dec(18, 3, '.w..^.w.b...b.w.^')
dec(19, 5, '....%.....%....')
dec(19, 5, '.......r.......')
dec(19, 6, '.......r.......')
dec(19, 7, '.......r.......')
dec(19, 8, '.......r.......')
dec(19, 9, '.e.....r.....e.')
dec(19, 10, '.......r.......')
dec(19, 11, '..?....r....!..')
dec(18, 12, '...^..........^...')
# tavern
dec(38, 4, '...H.H...w..')
dec(39, 5, '.......NN.')
dec(39, 7, '.........Z')
dec(39, 9, '.....&&...')
dec(40, 12, '.....j...')
dec(40, 11, '..^.....^')
# item shop
dec(3, 17, '..$..k.w..')
dec(4, 20, '.......Z')
dec(4, 21, '...&&...')
dec(3, 24, '.....4')
# smithy
dec(37, 17, '..x.x.w.c.c..')
dec(38, 18, 'X....|....Y')
dec(38, 21, 'X.........Y')
dec(38, 20, 'n....&....n')
dec(38, 21, '..n..&...n.')
dec(40, 24, '.5...6')
# jorn
dec(3, 29, '.w...p...w.')
dec(4, 30, '..F..A...')
dec(4, 33, '.&&......')
dec(4, 34, 'V........')
dec(4, 35, '.Z')
dec(4, 34, '....&')
dec(12, 32, 'y')
# beck
dec(16, 30, '.w...^..')
dec(17, 31, '...X..')
dec(17, 33, '.s....')
dec(17, 35, '.....%')
dec(17, 32, '....s.')
# family
dec(29, 30, '.w...p...')
dec(30, 31, '....K..')
dec(30, 33, '.....:.')
dec(30, 35, '.&&....')
# streets & plaza
dec(19, 15, '3............3')
dec(19, 22, '3............3')
dec(20, 17, '...........;')
dec(22, 19, 'e.......e')
dec(29, 16, ';')
dec(31, 20, ';;')
dec(19, 20, ';')
# snow drifts, woodpiles, carts
for x, y in [(4, 15), (15, 15), (16, 16), (34, 16), (35, 17), (14, 27), (15, 27), (35, 27), (36, 26), (5, 38), (6, 38),
             (22, 37), (29, 37), (38, 34), (39, 27), (36, 14), (17, 24), (33, 24)]:
    d[y][x] = ';'
for x, y in [(34, 20), (4, 37), (12, 37), (13, 37), (24, 34), (38, 30)]:
    d[y][x] = '%'
d[38][11] = 'E'   # cart
d[38][7] = '#'    # chopping stump
d[27][23] = ']'   # signpost toward the hall
d[37][28] = ']'   # signpost by the gate
d[16][21] = 'u'   # the frozen well
d[38][24] = '3'
d[38][27] = '3'
# street lamps, laundry, crates, firs on the open snow
for x, y in [(11, 15), (35, 12), (48, 12), (3, 12), (17, 24), (35, 24), (13, 27), (38, 27), (28, 34), (24, 31)]:
    d[y][x] = '3'
for x, y in [(15, 21), (16, 21)]:
    d[y][x] = '%'
d[20][13] = 'U'; d[21][14] = 'q'
for x, y in [(35, 18), (35, 21)]:
    d[y][x] = '('
d[23][34] = 'U'
d[12][16] = 'M'
d[27][4] = 'E'
for x, y in [(16, 5), (15, 8), (16, 9), (36, 6), (35, 9), (36, 10), (2, 20), (2, 21), (14, 33), (15, 34), (27, 30), (28, 31), (38, 29), (35, 38), (47, 27)]:
    g[y][x] = 'T'

rows = [''.join(r) for r in g]
decor = [''.join(r) for r in d]

def block():
    out = ['    // @rows yule', '    rows: [']
    out += ["      '%s'," % r for r in rows]
    out += ['    ],', '    decor: [']
    out += ["      '%s'," % r for r in decor]
    out += ['    ],', '    // @end yule']
    return '\n'.join(out)

if '--write' in sys.argv:
    path = 'src/maps/region3_yule.js'
    src = open(path).read()
    src = re.sub(r'    // @rows yule\n.*?    // @end yule', lambda m: block(), src, flags=re.S)
    open(path, 'w').write(src)
    print('written', path)
else:
    for r, dr in zip(rows, decor):
        print(r, ' ', dr)
