# Terrain stamp for pharos_town.js (the rows were pasted into the map file; rerun and paste to change the ground).
import math, random, json
W, H = 64, 48
g = [['~'] * W for _ in range(H)]
def put(x, y, c):
    if 0 <= x < W and 0 <= y < H: g[y][x] = c
def rect(x, y, w, h, c):
    for j in range(y, y + h):
        for i in range(x, x + w): put(i, j, c)
def row(y, x0, x1, c):
    for x in range(x0, x1 + 1): put(x, y, c)
def ell(cx, cy, rx, ry, c, seed=0, wob=0.12, only=None):
    r = random.Random(seed); ph = [r.random() * 6.28 for _ in range(3)]
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            dx, dy = (x - cx) / rx, (y - cy) / ry; a = math.atan2(dy, dx)
            rr = 1 + wob * (math.sin(2 * a + ph[0]) * 0.5 + math.sin(3 * a + ph[1]) * 0.35 + math.sin(5 * a + ph[2]) * 0.15)
            if dx * dx + dy * dy <= rr * rr and (only is None or (0 <= y < H and 0 <= x < W and g[y][x] in only)): put(x, y, c)

# ---- the cliff mass (rock) with an irregular east coast; headland grass above
for y in range(0, 29):
    xe = 41 + int(round(1.6 * math.sin(y * 0.55) + 0.8 * math.sin(y * 1.7)))
    if y >= 22: xe = 42
    row(y, 0, xe, '#')
for x in range(0, 44):
    d = 2 + int(round(0.9 * math.sin(x * 0.42) + 0.6 * math.sin(x * 1.21 + 1)))
    for y in range(0, d): put(x, y, 'G')
# ---- L3 inn landing + west gate
row(9, 3, 10, '.'); row(10, 0, 12, '.'); row(11, 0, 18, '.'); row(12, 2, 18, '.'); row(13, 4, 9, '.')
rect(4, 12, 2, 2, 'g'); put(13, 12, 'g')
# ---- stairs up the spur to the high ledge (L4): house1 cave, record tower
rect(17, 9, 2, 2, 'e')
row(7, 16, 32, '.'); row(8, 16, 33, '.'); row(6, 23, 24, '.')
rect(32, 9, 2, 2, 'e')
# ---- L3 east terrace (to stack A) east of the galleon's stern
row(11, 29, 38, '.'); row(12, 29, 40, '.'); row(13, 30, 39, '.')
rect(41, 12, 5, 2, 'b')
# ---- winding path down the west: landing -> stairs -> ledge path -> stern ledge (tavern door)
rect(5, 14, 2, 2, 'e')
row(16, 5, 14, '.'); row(17, 5, 26, '.'); row(18, 12, 25, '.'); put(15, 16, '.')
# ---- stern ledge -> middle shelf stairs
rect(15, 19, 2, 2, 'e')
# ---- L2 middle shelf with the round net plaza, east arm to the smith door
ell(15, 23.2, 11.2, 3.4, '.', seed=8, wob=0.1)
row(21, 4, 31, '.'); row(20, 17, 31, '.')
ell(16, 23, 5.2, 2.5, 'c', seed=9, wob=0.06)
# ---- bow platform (shop door), linking the east arm, stairs down
row(22, 29, 31, '.'); row(23, 29, 31, '.')
row(24, 29, 41, '.'); row(25, 30, 41, '.'); row(26, 33, 40, '.')
rect(38, 27, 2, 2, 'e')
# ---- shelf -> boardwalk stairs
rect(10, 27, 2, 2, 'e'); rect(22, 27, 2, 2, 'e'); row(26, 10, 23, '.')
# ---- L1 boardwalk along the cliff foot (planks over water), wavy south edge
for x in range(3, 44):
    y1 = 32 + int(round(0.8 * math.sin(x * 0.21 + 0.5)))
    for y in range(29, y1 + 1): put(x, y, 'p')
row(29, 0, 2, '#'); row(30, 0, 2, '#')
for x in range(40, 60):
    for y in range(30, 33): put(x, y, 'p')
# piers: west dog-leg, the ferry pier with a T head, east pier, and a crooked pier to the stilt hull
rect(9, 31, 2, 7, 'p'); rect(9, 37, 5, 2, 'p'); rect(12, 39, 2, 4, 'p')
rect(22, 31, 3, 11, 'p'); rect(19, 41, 9, 2, 'p')
rect(34, 31, 2, 5, 'p'); rect(29, 36, 7, 2, 'p')
rect(28, 32, 5, 4, 'p')                     # under the stilt hull (house6)
rect(46, 31, 2, 8, 'p'); rect(46, 38, 4, 2, 'p')
# ---- east: stack A (house3 cave) and stack B (lookout), rope bridges
ell(50, 7.5, 6.3, 6.3, '#', seed=11, wob=0.1)
row(9, 46, 54, '.'); row(10, 46, 55, '.'); row(11, 46, 55, '.'); row(12, 46, 54, '.'); row(13, 47, 53, '.')
rect(51, 14, 2, 2, 'e'); rect(51, 16, 2, 3, 'b')
ell(56.5, 22.5, 6.3, 5, '#', seed=13, wob=0.1)
row(19, 51, 60, '.'); row(20, 51, 61, '.'); row(21, 51, 61, '.'); row(22, 51, 61, '.'); row(23, 51, 61, '.'); row(24, 51, 60, '.'); row(25, 52, 59, '.')
rect(42, 24, 9, 2, 'b')
rect(55, 26, 2, 2, 'e'); rect(55, 28, 2, 2, 'p')
# ---- lighthouse islet
ell(59, 41, 3.6, 4.6, '#', seed=15, wob=0.1)
rows = [''.join(r) for r in g]
print('\n'.join('%2d ' % i + r for i, r in enumerate(rows)))
json.dump(rows, open('rows.json', 'w'))
