"""Pass inn layout (34x26): the inn inside the ruined border gatehouse + hot-spring terraces."""
import json, sys
sys.path.insert(0, '../yule')
W, H = 34, 26
g = [['#'] * W for _ in range(H)]
def put(x, y, c):
    if 0 <= x < W and 0 <= y < H: g[y][x] = c
def rect(x, y, w, h, c):
    for j in range(h):
        for i in range(w): put(x + i, y + j, c)
def ell(cx, cy, rx, ry, c, only=None):
    for y in range(H):
        for x in range(W):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0 and (only is None or g[y][x] in only): put(x, y, c)
def path(pts, c, wd, only=None):
    r = wd / 2.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 4) + 1
        for k in range(n + 1):
            t = k / n; px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for y in range(int(py - r) - 1, int(py + r) + 2):
                for x in range(int(px - r) - 1, int(px + r) + 2):
                    if abs(x - px) <= r - 0.01 and abs(y - py) <= r - 0.01 and (only is None or (0 <= y < H and 0 <= x < W and g[y][x] in only)):
                        put(x, y, c)
# open snow of the saddle
ell(16, 15, 15, 9.5, '.')
ell(7.5, 16.5, 5.5, 4.5, '.')          # travellers' yard
ell(26, 16, 6.5, 6, '.')               # hot-spring side
rect(3, 8, 26, 3, 'c')                  # the old gate court (flagstones)
# hot-spring terraces: stone decks and steaming pools (the pools are not walkable)
ell(26.5, 13, 4.2, 2.2, 'c')
ell(27, 13, 3, 1.3, '~')
ell(25, 17.2, 3.2, 1.8, 'c')
ell(25.3, 17.3, 2.2, 1.0, '~')
ell(28.5, 20, 2.6, 1.5, 'c')
ell(28.8, 20.2, 1.6, 0.8, '~')
rect(21, 12, 3, 3, 'c')                 # the deck round the healing pool (spring object 2x2 at 22,12)
# the pass road: up from the south exit, winding to the gate court
path([(16, 25), (16, 22), (14.5, 18.5), (15.5, 14), (15.5, 10)], ',', 3)
path([(15.5, 16), (20.5, 16), (22, 15)], ',', 2)            # -> the springs
path([(14.5, 18), (10, 17)], ',', 2)                        # -> the travellers' yard
B = [
    dict(id='pass_gate_inn', x=4, y=1, w=6, h=7, wall=3, door=(7, 7), to='pass_inn_in', kind='tower', sign='inn'),
    dict(id='pass_gate_wall', x=10, y=2, w=12, h=5, wall=3, door=None, kind='gate'),
    dict(id='pass_gate_shop', x=22, y=1, w=6, h=7, wall=3, door=(25, 7), to='pass_inn_shop', kind='tower', sign='item'),
    dict(id='pass_bath_screen', x=29, y=10, w=3, h=2, wall=1, door=None, kind='screen'),
]
for b in B:
    rect(b['x'], b['y'], b['w'], b['h'], '.')
    if b['door']:
        dx, dy = b['door']
        if g[dy + 1][dx] == '#': put(dx, dy + 1, 'c')
rect(10, 7, 12, 1, 'c')
put(31, 12, 'c')
# border
for y in range(H):
    for x in range(W):
        if x in (0, W - 1) or y == H - 1:
            if g[y][x] != ',': put(x, y, '#')
json.dump(dict(w=W, h=H, rows=[''.join(r) for r in g], blds=B, body=[]), open('layout.json', 'w'), indent=1)
occ = {}
for b in B:
    for j in range(b['h']):
        for i in range(b['w']): occ[(b['x'] + i, b['y'] + j)] = 'B'
    if b['door']: occ[b['door']] = 'D'
print('    ' + ''.join(str(x % 10) for x in range(W)))
for y in range(H): print('%3d ' % y + ''.join(occ.get((x, y), g[y][x]) for x in range(W)))
