#!/usr/bin/env python3
"""R3 drafting helper for 白竜の峰 frost_peak_1..3. Carves rooms and corridors into a wall grid and
prints / splices the rows+decor blocks of src/maps/region3_frost_peak.js (between `// @rows <id>` and
`// @end <id>`).   python3 tools/fixtures/reg3/gen_peak.py [--write] [id]"""
import sys, re

class Floor:
    def __init__(self, w, h, wall='#', floor='.'):
        self.w, self.h, self.fl = w, h, floor
        self.g = [[wall] * w for _ in range(h)]
        self.d = [['.'] * w for _ in range(h)]
    def rect(self, x0, y0, x1, y1, ch=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.g[y][x] = ch or self.fl
    def room(self, x0, y0, x1, y1, cut=1):
        """a cave room: rectangle with its corners cut (cut = size of the diagonal cut)"""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = min(x - x0, x1 - x); dy = min(y - y0, y1 - y)
                if dx + dy >= cut:
                    self.g[y][x] = self.fl
    def at(self, pts, ch):
        for x, y in pts:
            self.g[y][x] = ch
    def put(self, x, y, s):
        for i, ch in enumerate(s):
            if ch != ' ':
                self.g[y][x + i] = ch
    def roughen(self, seed, prob, keep=(), ch=None, only=None):
        """cave edges: floor cells touching the rock turn into rock (or `ch`) with probability prob
        (a position hash, so the result is stable). Cells in keep, and cells whose removal would
        leave a neighbour with fewer than 2 floor neighbours, stay floor."""
        import hashlib
        keep = set(keep)
        fl = self.fl
        def isfl(x, y): return 0 <= x < self.w and 0 <= y < self.h and self.g[y][x] in (fl, 'e', '*')
        cand = []
        for y in range(1, self.h - 1):
            for x in range(1, self.w - 1):
                if (x, y) in keep or self.g[y][x] != fl: continue
                if only and not only(x, y): continue
                walls = sum(1 for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)) if self.g[y+dy][x+dx] == '#')
                fls = sum(1 for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)) if isfl(x+dx, y+dy))
                if walls >= 1 and fls >= 3 and (ch or self.g[y-1][x] != '#'):
                    h = int(hashlib.md5(('%d:%d:%d' % (seed, x, y)).encode()).hexdigest()[:8], 16) / 0xffffffff
                    if h < prob: cand.append((x, y))
        for x, y in cand:
            # keep corridors 2 wide: never cut a cell whose opposite neighbours are both walls
            W = ('#', 'r', 'I', 'l')
            if (self.g[y][x-1] in W and self.g[y][x+1] in W) or (self.g[y-1][x] in W and self.g[y+1][x] in W): continue
            # nor one that closes a diagonal gap (two blocked cells meeting at a corner)
            if any(self.g[y+dy][x+dx] in W and self.g[y+dy][x] not in W and self.g[y][x+dx] not in W for dx, dy in ((1,1),(1,-1),(-1,1),(-1,-1))): continue
            self.g[y][x] = ch or '#'
    def rim(self, seed, prob, ch='r'):
        """outdoor crags: rock cells beside or below the floor (not the cliff faces above it) become
        boulders, so the edge of a snow ledge reads against the snow-covered rock"""
        import hashlib
        fl = set((self.fl, 'e', '*', 's', 'S'))
        out = []
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != '#': continue
                below = y + 1 < self.h and self.g[y + 1][x] in fl
                if below: continue  # the cliff face drawn above a ledge stays rock
                near = any(0 <= x + dx < self.w and 0 <= y + dy < self.h and self.g[y + dy][x + dx] in fl
                           for dx, dy in ((1, 0), (-1, 0), (0, -1), (1, -1), (-1, -1)))
                if not near: continue
                h = int(hashlib.md5(('%d:%d:%d' % (seed, x, y)).encode()).hexdigest()[:8], 16) / 0xffffffff
                if h < prob: out.append((x, y))
        for x, y in out: self.g[y][x] = ch
    def dec(self, pts, ch):
        for x, y in pts:
            self.d[y][x] = ch
    def rows(self):
        return [''.join(r) for r in self.g], [''.join(r) for r in self.d]

def box(x0, y0, x1, y1):
    return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]

KEEP1 = set(box(21, 28, 24, 35) + box(21, 18, 24, 23) + box(38, 2, 40, 5) + [(4, 24), (3, 3), (41, 27), (13, 5), (41, 21)] + box(22, 13, 24, 15))
KEEP2 = set(box(4, 30, 8, 33) + box(38, 1, 41, 7) + [(4, 4), (41, 25), (14, 24), (27, 5), (27, 32), (41, 12)] + box(34, 8, 42, 8) + box(3, 24, 16, 25) + box(12, 22, 15, 26) + box(13, 28, 18, 31) + box(21, 17, 24, 25))
KEEP3 = set(box(18, 31, 22, 34) + [(26, 14), (35, 12), (4, 19), (35, 25)] + box(22, 2, 24, 12) + box(20, 10, 20, 18) + box(13, 5, 33, 5) + box(15, 11, 20, 14))
F = {}
# ================================================================== 1F  (ice cave, 46x36)
f = Floor(46, 36)
f.rect(22, 30, 23, 35)                      # the cave mouth (to the world)
f.room(15, 23, 30, 31, 2)                   # A: entrance hall
f.rect(12, 27, 15, 28)                      # A -> B
f.room(3, 23, 12, 32, 2)                    # B: west chamber (no flame needed)
f.rect(22, 18, 23, 23)                      # A -> C, ice wall at y=22
f.room(15, 11, 31, 19, 2)                   # C: the statue chamber
f.rect(9, 14, 15, 15)                       # C -> W
f.room(3, 6, 10, 20, 1)                     # W: west cavern
f.rect(5, 3, 6, 6)
f.room(2, 2, 9, 4, 1)                       # W2: dead end (p_gear)
f.rect(31, 14, 35, 15)                      # C -> E
f.room(35, 9, 42, 22, 1)                    # E: east cavern
f.rect(38, 22, 39, 25)
f.room(35, 25, 43, 31, 2)                   # E2: dead end (p_gold)
f.rect(22, 7, 23, 11)                       # C -> N
f.room(12, 2, 33, 7, 2)                     # N: north gallery
f.rect(33, 3, 36, 4)                        # N -> stairs
f.room(35, 2, 42, 6, 1)                     # the stairs nook
f.at([(22, 20), (23, 20), (22, 21), (23, 21)], 'I')   # 氷の壁 (k_winter_flame)
f.at([(39, 3)], 'S')
# floor texture: snow blown in at the mouth, glossy ice, boulders, pillars
f.roughen(1, 0.34, KEEP1)
f.at([(8, 26), (9, 27), (7, 27), (26, 13), (27, 13), (27, 14), (19, 16), (20, 16), (6, 11), (6, 12), (39, 16), (40, 17), (40, 16), (17, 4), (18, 4), (29, 5)], 'e')
f.at([(5, 29), (10, 24), (17, 25), (28, 25), (16, 13), (30, 17), (4, 8), (9, 18), (41, 10), (36, 20), (14, 3), (31, 6), (42, 29), (36, 30)], 'r')
f.at([(19, 14), (27, 16), (19, 17)], 'l')
f.dec([(16, 24), (29, 24), (8, 23), (19, 11), (27, 11), (6, 6), (38, 9), (14, 2), (30, 2), (38, 25), (5, 2)], '^')   # icicles on the wall faces
f.dec([(16, 30), (29, 29), (4, 31), (11, 30), (3, 16), (41, 21), (34, 5), (21, 31), (24, 31), (20, 30), (25, 30), (18, 29), (27, 28), (23, 34), (22, 32)], ';')
f.dec([(20, 27), (12, 17), (25, 18), (37, 13), (24, 5), (8, 9)], 'z')
F['frost_peak_1'] = f

# ================================================================== 2F  (ice cave, 46x36)
f = Floor(46, 36)
f.room(3, 27, 13, 33, 2)                    # A: arrival (stairs down)
f.at([(5, 32)], 's')
f.rect(13, 29, 17, 30)                      # A -> B (ice wall at x=16)
f.at([(15, 29), (16, 29), (15, 30), (16, 30)], 'I')
f.room(17, 24, 29, 33, 2)                   # B: the frozen falls chamber
f.rect(22, 18, 23, 24)                      # B -> C
f.room(15, 10, 30, 18, 2)                   # C: crossroads hall
f.rect(9, 13, 15, 14)                       # C -> W
f.room(3, 3, 9, 22, 1)                      # W: west gallery (long)
f.rect(4, 22, 5, 24)                        # W -> dead end with the secret
f.room(3, 24, 9, 25, 0)                     # the "nothing" dead end (secret wall at the end)
f.at([(10, 24), (11, 24)], '%')             # 隠し通路 (2 cells)
f.room(12, 22, 15, 26, 0)                   # the hidden nook (p_gold)
f.rect(30, 26, 34, 27)                      # B -> E2
f.room(34, 23, 42, 32, 2)                   # E2: dead end (p_rare)
f.rect(30, 13, 34, 14)                      # C -> E
f.room(34, 6, 42, 18, 1)                    # E: the rest hollow and the giant's gallery
f.rect(10, 5, 14, 6)                        # W -> N
f.room(14, 2, 28, 7, 2)                     # N: north gallery (dead end)
f.room(35, 1, 42, 2, 0)                     # the ledge with the stairs up
f.rect(38, 3, 39, 5)                        # E -> ledge, through the giant's wall
f.at([(38, 4), (39, 4)], 'I')               # the giant's wall (opens with snow_mid)
f.at([(40, 1)], 'S')
f.roughen(2, 0.34, KEEP2)
f.at([(19, 13), (26, 13), (19, 16), (26, 16)], 'l')
f.at([(20, 24), (20, 25), (21, 24), (19, 24), (20, 26)], 'e')   # the frozen falls
f.at([(20, 27), (21, 28), (26, 27), (27, 26), (8, 8), (7, 9), (37, 12), (38, 13), (18, 4), (19, 5)], 'e')
f.at([(4, 17), (8, 5), (18, 31), (28, 31), (17, 12), (29, 17), (41, 30), (35, 31), (41, 16), (27, 3)], 'r')
f.dec([(20, 23), (21, 23), (19, 23), (27, 24), (17, 10), (28, 10), (5, 3), (36, 3), (20, 2), (25, 2), (37, 23), (5, 27)], '^')
f.dec([(12, 32), (4, 20), (29, 12), (40, 31), (22, 6), (36, 16)], ';')
f.dec([(10, 28), (21, 21), (8, 14), (38, 26), (16, 5)], 'z')
F['frost_peak_2'] = f

# ================================================================== 3F  (the summit, outdoors, 40x36)
f = Floor(40, 36)
f.room(15, 30, 25, 34, 1)                   # arrival ledge (the cave mouth 's')
f.at([(20, 34)], 's')
f.rect(24, 29, 34, 30)                      # east switchback
f.room(29, 22, 36, 29, 1)
f.rect(12, 21, 30, 22)                      # back west
f.room(3, 17, 13, 26, 2)                    # west shelf
f.rect(6, 12, 7, 17)
f.room(3, 8, 16, 13, 1)                     # upper west terrace
f.rect(16, 12, 19, 13)                      # terrace -> the col
f.room(19, 10, 27, 18, 1)                   # the col (fine, the lamp)
f.rect(22, 6, 24, 10)                       # up to the summit
f.room(12, 1, 34, 6, 2)                     # the summit plateau (the dragon)
f.put(20, 1, '#######')                     # the dragon's crag
f.put(20, 2, '##r#r##')
f.room(31, 10, 37, 18, 1)                   # a side shelf (chest)
f.rect(27, 14, 31, 15)
f.at([(21, 3), (22, 3), (24, 3), (25, 3)], 'r')     # the crag around the dragon's perch
f.roughen(3, 0.28, KEEP3)
f.roughen(4, 0.12, KEEP3, 'r')
f.rim(5, 0.8)
f.at([(18, 30), (23, 32), (31, 25), (34, 27), (7, 20), (11, 24), (9, 10), (14, 12), (33, 12), (36, 16)], 'r')
f.at([(20, 32), (21, 31), (32, 24), (5, 22), (6, 23), (25, 13), (15, 5), (30, 5), (31, 4)], 'e')
f.dec([(16, 31), (24, 33), (30, 28), (35, 23), (4, 18), (12, 25), (4, 9), (15, 11), (21, 12), (26, 17), (32, 11), (36, 17), (13, 3), (33, 3), (15, 6), (31, 6)], ';')
F['frost_peak_3'] = f

def block(fid):
    rows, decor = F[fid].rows()
    out = ['    // @rows ' + fid, '    rows: [']
    out += ["      '%s'," % r for r in rows]
    out += ['    ],', '    decor: [']
    out += ["      '%s'," % r for r in decor]
    out += ['    ],', '    // @end ' + fid]
    return '\n'.join(out)

ids = [a for a in sys.argv[1:] if not a.startswith('--')] or list(F)
if '--write' in sys.argv:
    path = 'src/maps/region3_frost_peak.js'
    src = open(path).read()
    for fid in ids:
        src, n = re.subn(r'    // @rows %s\n.*?    // @end %s' % (fid, fid), lambda m: block(fid), src, flags=re.S)
        assert n == 1, fid
    open(path, 'w').write(src)
    print('written', path, ids)
else:
    for fid in ids:
        rows, decor = F[fid].rows()
        print(fid)
        for y, (r, dr) in enumerate(zip(rows, decor)):
            print('%2d %s  %s' % (y, r, dr))
