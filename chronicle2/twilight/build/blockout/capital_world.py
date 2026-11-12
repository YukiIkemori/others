"""Blockout of 王都 南の大通り (M02): the shop streets of the stone capital.
   Two paved streets cross in the middle.  Gates: east (to F02 草の高原), west (F06), south (F09); in the north a broad
   stone stair climbs to the upper town (z 3) and on to 城門前の広場.
   North of the main street: weapon shop and armour shop (west), the big tavern 三つ樽 with tables and three great casks (east).
   South of it, fronting the south lane (their backs to the main street, behind a garden wall): the item shop with the narrow alley beside it (west), the inn 灯守り亭 (east, near the east gate).
   Streets and lanes are wide and empty; stalls, casks, crates, planters and lamp posts stand at their edges.
usage: python3 capital_world.py out_dir"""
import sys, os, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vox
from vox import World, bake, MAT, VPU

for name, idx, col in (('plaster', 28, (222, 208, 180)), ('leaf', 30, (64, 122, 58)), ('timber', 33, (92, 64, 44)), ('cloth', 34, (150, 70, 60)),
                       ('bush', 35, (86, 140, 70)), ('yard', 36, (186, 166, 132)), ('white', 37, (236, 232, 218)), ('tile', 38, (158, 84, 62)),
                       ('cobble', 41, (150, 146, 150)), ('cloth2', 42, (70, 96, 130))):
    MAT[name] = idx; vox.COLOR[idx] = col
vox.WALKABLE = tuple(vox.WALKABLE) + (MAT['yard'], MAT['cobble'])
SOFT = ('leaf', 'bush', 'water', 'trunk', 'cloth', 'cloth2')            # for solids.py
CAPS = ('roof', 'tile')

w = World(x=(0, 72), y=(-7, 62), z=(-4, 28)); XX, YY = w.XX, w.YY
rng = np.random.default_rng(8)
MAP = dict(W=2304, H=1904, SY0=1736)
UP = 3.0                                                                # the upper town
TY = 54.0                                                               # where the upper town begins
LEVEL = np.zeros(XX.shape); LEVEL[YY >= TY] = UP
for lv in np.unique(LEVEL):
    m = LEVEL == lv
    w.col(m, w.Z0, lv, 'rock'); w.col(m, lv - 1 / VPU, lv, 'cobble')
m = (YY >= TY) & (YY < TY + .7); w.col(m, 0, UP - 1 / VPU, 'wall')         # the retaining wall of the upper town

def top(mask, mat):
    for lv in np.unique(LEVEL[mask]): w.col(mask & (LEVEL == lv), lv - 1 / VPU, lv, mat)
def rect(x0, x1, y0, y1): return (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1)

# =========================================================================== streets (flagstones; wide, nothing stands in them)
top(rect(0, 72, 26, 32), 'floor')                                       # the main street, west gate to east gate
top(rect(33, 39, -7, 50), 'floor')                                      # the cross street, south gate to the stairs
top(rect(30, 42, 24.4, 33.6), 'floor')                                  # the crossing
top(rect(31.5, 40.5, 46, 50), 'floor')
top(rect(6, 66, 5, 10), 'floor')                                        # the south lane
top(rect(31.5, 40.5, TY, 62), 'floor')                                  # the upper landing, on to the castle square
ST = w.stairs_n(31.5, 40.5, TY, 0.0, UP)
m = (YY < -2.2) & ~rect(33, 39, -7, 0); w.col(m, -1 / VPU, 0, 'grass')      # outside the south wall

# =========================================================================== buildings
WIN = []
def house(x0, x1, y0, y1, z=0.0, wall=8.4, rise=3.6, ridge='x', door=None, wins=(), upper=(), chimney=None, base=1.3, over=.6, body='plaster', dw=2.3):
    w.box(x0, x1, y0, y1, z, z + base, 'wall'); w.box(x0, x1, y0, y1, z + base, z + wall, body)
    for x in (x0, x1 - .35): w.box(x, x + .35, y0 - .06, y0 + .3, z + base, z + wall, 'timber')
    w.box(x0, x1, y0 - .06, y0 + .3, z + wall - .4, z + wall, 'timber'); w.box(x0, x1, y0 - .06, y0 + .3, z + 4.5, z + 4.8, 'timber')
    cx, cy, hx, hy = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + over, (y1 - y0) / 2 + over
    for k in range(w.iz(z + wall), w.iz(z + wall + rise)):
        t = 1 - (w.ZC[k] - z - wall) / rise
        if ridge == 'x': m = (np.abs(XX - cx) <= hx) & (np.abs(YY - cy) <= hy * t)
        else: m = (np.abs(XX - cx) <= hx * t) & (np.abs(YY - cy) <= hy)
        w.V[m, k] = MAT['tile']
        if ridge == 'y':
            w.V[(np.abs(XX - cx) <= hx * t - .45) & (YY >= y0 - .1) & (YY < y0 + .3), k] = MAT[body]
            w.V[(np.abs(XX - cx) <= hx * t) & (YY < y0 - .1) & (YY > y0 - over - .2), k] = 0
    if door is not None:
        w.arch_y(door, dw, y0 - .14, y0 + .1, z, 3.15, MAT['wood']); w.box(door - dw / 2 - .4, door + dw / 2 + .4, y0 - .7, y0 - .14, z, z + .2, 'floor')
    for wx_, wz in list(wins) + [(x_, 5.4) for x_ in upper]:
        w.box(wx_ - .7, wx_ + .7, y0 - .13, y0 + .1, z + wz, z + wz + 1.6, 'glass'); WIN.append((wx_, y0 - .2, z + wz + .8))
    if chimney: w.box(chimney[0] - .5, chimney[0] + .5, chimney[1] - .5, chimney[1] + .5, z + wall, z + wall + rise + 1.2, 'wall')

# A two-storey house hides about ten units of ground behind it.  So the rows are: south lane 5..10, south block 12..18,
# (hidden strip), main street 26..32, shops 37..44, (hidden strip), the big stair 50..54, the upper town from 54.
# north block: weapon shop, armour shop
house(5.0, 16.0, 37.0, 44.0, door=10.5, wins=((7.2, 2.0), (13.8, 2.0)), upper=(7.2, 10.5, 13.8), chimney=(14.4, 42.0))
house(18.5, 30.0, 37.0, 44.0, ridge='y', wall=8.0, rise=4.4, door=24.2, wins=((20.8, 2.0), (27.6, 2.0)), upper=(21.0, 27.4), chimney=(28.6, 42.0))
w.box(16.0, 18.5, 39.0, 43.0, 0, 3.6, 'wall'); w.box(15.9, 18.6, 38.8, 43.2, 3.6, 4.0, 'tile')         # a lean-to store between them
# the tavern 三つ樽
house(43.0, 60.0, 38.0, 45.4, wall=9.0, rise=4.2, door=51.5, dw=2.8, wins=((45.4, 2.0), (48.2, 2.0), (54.8, 2.0), (57.6, 2.0)), upper=(45.4, 48.4, 51.5, 54.6, 57.6), chimney=(58.2, 43.0))
house(61.6, 68.4, 39.6, 45.0, ridge='y', wall=7.6, rise=4.0, wins=((65.0, 2.0),), upper=(65.0,))
# south block: the item shop, the alley, a town house | a town house, the inn 灯守り亭
house(7.0, 19.5, 12.0, 18.0, door=13.2, wins=((9.4, 2.0), (17.0, 2.0)), upper=(9.4, 13.2, 17.0), chimney=(8.6, 16.4))
house(22.2, 30.5, 12.0, 18.0, ridge='y', wall=8.0, rise=4.2, door=None, wins=((24.4, 2.0), (28.2, 2.0)), upper=(24.6, 28.0))
w.box(19.5, 22.2, 17.4, 18.0, 0, 4.2, 'wall')                           # the alley is closed at its far end
house(41.5, 49.0, 12.0, 18.0, ridge='y', wall=8.0, rise=4.2, wins=((43.6, 2.0), (46.8, 2.0)), upper=(43.8, 46.6))
house(51.0, 65.0, 12.0, 18.4, wall=9.2, rise=4.0, door=58.0, dw=2.6, wins=((53.4, 2.0), (55.8, 2.0), (60.4, 2.0), (62.8, 2.0)), upper=(53.4, 56.4, 59.6, 62.8), chimney=(63.4, 16.8))
# the upper town, either side of the landing
house(5.0, 17.0, 56.6, 61.4, z=UP, wall=8.0, upper=(8.0, 11.0, 14.0), wins=((8.0, 2.0), (14.0, 2.0)), door=11.0)
house(19.0, 29.4, 57.0, 61.4, z=UP, wall=8.6, ridge='y', upper=(22.0, 26.4), wins=((22.0, 2.0), (26.4, 2.0)))
house(42.6, 53.0, 57.0, 61.4, z=UP, wall=8.6, ridge='y', upper=(45.6, 50.0), wins=((45.6, 2.0), (50.0, 2.0)))
house(55.0, 67.0, 56.6, 61.4, z=UP, wall=8.0, upper=(58.0, 61.0, 64.0), wins=((58.0, 2.0), (64.0, 2.0)), door=61.0)
# the rest of the upper city closes the top edge: tall house fronts with roofs, right at the edge of the map
for x0, x1 in ((0, 31.0), (41.0, 72)):
    w.box(x0, x1, 61.6, 62, UP, UP + 12.0, 'plaster'); w.box(x0, x1, 61.6, 62, UP + 12.0, 27.5, 'tile')
w.box(31.0, 41.0, 61.6, 62, UP, 27.5, 'wall'); w.arch_y(36.0, 6.4, 61.5, 62, UP, 4.6, MAT['dark'])      # the gate arch to the castle square
# low garden walls: along the south side of the main street (the strip behind the south block is hidden by its roofs:
# nobody walks there), and across the ends of the strip behind the shops
def wall_x(x0, x1, y, z=0.0, h=1.0, th=.5): w.box(x0, x1, y - th / 2, y + th / 2, z, z + h, 'wall')
def wall_y(x, y0, y1, z=0.0, h=1.0, th=.5): w.box(x - th / 2, x + th / 2, y0, y1, z, z + h, 'wall')
wall_x(2.6, 30.0, 25.5, h=1.3); wall_x(42.0, 69.4, 25.5, h=1.3)
wall_y(30.0, 18.6, 25.7, h=1.3); wall_y(42.0, 18.6, 25.7, h=1.3); wall_x(30.0, 30.6, 18.8, h=1.3); wall_x(41.4, 42.0, 18.8, h=1.3)
for x0, x1, y in ((2.6, 5.0, 45.0), (29.6, 31.5, 44.8), (40.5, 43.0, 45.6), (68.4, 69.4, 45.0), (60.0, 61.6, 41.2)): w.box(x0, x1, y, y + .6, 0, 2.6, 'wall')
wall_y(31.2, 45.4, 50.0, h=1.3); wall_y(40.8, 46.2, 50.0, h=1.3)

# =========================================================================== the town wall and the gates
SH = 5.0                                                                # the south wall is the lowest: it stands in front of the picture
w.box(0, 33.0, -2.2, -.6, 0, SH, 'wall'); w.box(39.0, 72, -2.2, -.6, 0, SH, 'wall')
for x in np.arange(0.3, 72, 1.4):
    if not 32.0 < x < 39.4: w.box(x, x + .8, -2.2, -1.7, SH, SH + .6, 'wall')
for x in (30.4, 39.0): w.box(x, x + 2.6, -2.8, -.2, 0, SH + 2.6, 'wall'); w.pyramid(x - .3, x + 2.9, -3.1, .1, SH + 2.6, SH + 4.6, 'tile')
w.box(33.0, 39.0, -2.0, -.8, 4.6, SH + 1.4, 'wall')                      # the arch over the south gate
WH = 7.0
for x0, x1, ex in ((1.0, 2.6, 0), (69.4, 71.0, 1)):
    w.box(x0, x1, -2.2, 26.0, 0, WH, 'wall'); w.box(x0, x1, 32.0, 62, 0, WH, 'wall')
    for y in np.arange(-.4, 62, 1.4):
        if not 25.0 < y < 32.4: w.box(x0 if ex == 0 else x1 - .5, (x0 + .5) if ex == 0 else x1, y, y + .8, WH, WH + .6, 'wall')
    for y in (23.4, 32.0):
        w.box(x0 - .6, x1 + .6, y, y + 2.6, 0, WH + 3.0, 'wall'); w.pyramid(x0 - .9, x1 + .9, y - .3, y + 2.9, WH + 3.0, WH + 5.2, 'tile')
    w.box(x0, x1, 26.0, 32.0, 5.2, WH + .6, 'wall')                      # the arch over the gate
wall_x(2.6, 31.0, TY + .3, z=UP, h=.9); wall_x(41.0, 69.4, TY + .3, z=UP, h=.9)   # the balustrade of the upper town
for x in (31.0, 41.0): w.box(x - .45, x + .45, TY - .1, TY + .8, UP, UP + 1.6, 'wall')

# =========================================================================== street lamps (iron post, round glass), at equal steps along the streets
for x in (8.0, 16.0, 27.0, 45.0, 54.0, 66.6): w.lantern(x, 32.7, 3.5, post=0, r=150)
for y in (14.0, 20.0, 39.0, 45.0):
    for x in (32.3, 39.7): w.lantern(x, y, 3.5, post=0, r=150)
for x, y in ((30.6, 26.3), (41.4, 26.3), (30.6, 33.0), (41.4, 33.0)): w.lantern(x, y, 3.9, post=0, r=170)   # the four at the crossing
for x in (5.6, 20.8, 31.6, 40.4, 50.0, 66.0): w.lantern(x, 10.7, 3.5, post=0, r=140)
for x in (31.0, 41.0): w.lantern(x, TY + .35, UP + 2.4, post=UP + 1.6, r=150)

# =========================================================================== things at the edges
def tree(cx, cy, z, h=4.6, r=3.0, mat='leaf'):
    cs = r * .62; sl = lambda x, y, zz: (x, y + cs, zz - cs * .75 / .66)
    w.cone(cx, cy, .55, z, z + h + 1.0, 'trunk', r1=.34)
    w.ball(*sl(cx, cy, z + h + r * .95), r, mat, squash=.78); w.ball(*sl(cx - r * .55, cy + .2, z + h + r * .55), r * .62, mat, squash=.8); w.ball(*sl(cx + r * .6, cy - .1, z + h + r * .6), r * .58, mat, squash=.8)
def barrel(x, y, z=0.0, h=1.15, r=.5): w.cyl(x, y, r, z, z + h, 'wood')
def crate(x, y, z=0.0, s=.55, h=.9): w.box(x - s, x + s, y - s, y + s, z, z + h, 'wood')
def bush(x, y, z=0.0, r=.8): w.ball(x, y, z + r * .45, r, 'bush', squash=.7)
def planter(x, y, z=0.0, l=1.6): w.box(x - l / 2, x + l / 2, y - .4, y + .4, z, z + .6, 'wall'); w.box(x - l / 2 + .1, x + l / 2 - .1, y - .3, y + .3, z + .6, z + 1.1, 'bush')
def bench(x, y, z=0.0): w.box(x - 1.0, x + 1.0, y - .3, y + .3, z, z + .5, 'wood')
def table(x, y): w.box(x - .9, x + .9, y - .55, y + .55, .55, .75, 'wood'); w.box(x - .12, x + .12, y - .12, y + .12, 0, .55, 'timber')
def stool(x, y): w.cyl(x, y, .28, 0, .45, 'timber')
def stall(x0, x1, y, mat='cloth'):
    w.box(x0, x1, y - .5, y + .5, 0, 1.1, 'wood')
    for x in (x0, x1 - .2): w.box(x, x + .2, y - .5, y - .3, 1.1, 3.3, 'timber'); w.box(x, x + .2, y + .3, y + .5, 1.1, 3.3, 'timber')
    w.box(x0 - .3, x1 + .3, y - .8, y + .8, 3.3, 3.55, mat)
# the tavern front: tables and stools outside, the three great casks that are its sign
for x, y in ((45.2, 34.4), (48.8, 35.8), (55.0, 34.4), (58.2, 35.8)):
    table(x, y)
    for dx, dy in ((-1.3, 0), (1.3, 0), (0, .95)): stool(x + dx, y + dy)
for x, y, r, h in ((63.4, 36.8, 1.25, 2.7), (65.6, 35.6, 1.05, 2.3), (64.4, 33.9, .95, 2.0)): w.cyl(x, y, r, 0, h, 'wood'); w.cyl(x, y, r + .06, h * .25, h * .25 + .15, 'iron'); w.cyl(x, y, r + .06, h * .75, h * .75 + .15, 'iron')
barrel(42.2, 37.0); barrel(60.9, 37.2); crate(61.9, 38.4)
# weapon shop: a rack of spears and a display bench; armour shop: an armour stand and a bench of shields; a stall between them
w.box(13.2, 15.4, 36.0, 36.5, 0, 1.0, 'wood'); w.box(13.3, 13.45, 36.2, 36.35, 0, 2.6, 'iron'); w.box(14.2, 14.35, 36.2, 36.35, 0, 2.9, 'iron'); w.box(15.1, 15.25, 36.2, 36.35, 0, 2.5, 'iron')
w.box(6.0, 8.2, 35.8, 36.5, 0, .8, 'wood')
w.box(20.2, 20.5, 36.1, 36.4, 0, 1.5, 'timber'); w.box(19.7, 21.0, 36.1, 36.4, 1.5, 2.6, 'iron'); w.box(27.0, 29.4, 36.0, 36.5, 0, 1.2, 'wood')
planter(17.2, 37.8); barrel(4.2, 35.6); crate(4.4, 37.0); crate(30.9, 37.6)
# item shop: a stall with an awning beside the door, sacks and crates; the alley with its casks
stall(8.0, 11.6, 10.9, 'cloth2'); crate(16.6, 11.2); crate(17.7, 11.3); barrel(18.7, 11.3)
barrel(20.2, 14.2); barrel(21.6, 15.6, h=1.3, r=.55); crate(20.1, 11.6, s=.45)
stall(23.6, 27.4, 10.9); planter(29.2, 11.3)
# the inn: benches and planters by the door, a cart; a stall before the town house
planter(53.6, 11.3); planter(62.6, 11.3); bench(55.6, 11.2); barrel(60.4, 11.3)
w.box(66.2, 68.6, 12.6, 13.8, .5, 1.3, 'wood'); w.cyl(66.5, 12.5, .55, 0, 1.1, 'timber'); w.cyl(68.3, 12.5, .55, 0, 1.1, 'timber')
stall(43.2, 47.0, 10.9, 'cloth2'); planter(48.4, 11.3)
# a notice board and a water trough at the crossing's corners
w.box(28.0, 28.2, 34.3, 34.5, 0, 2.3, 'timber'); w.box(29.6, 29.8, 34.3, 34.5, 0, 2.3, 'timber'); w.box(27.9, 29.9, 34.25, 34.55, 1.2, 2.4, 'wood')
w.box(42.8, 45.0, 32.6, 33.4, 0, .7, 'wall'); w.box(43.0, 44.8, 32.75, 33.25, .45, .7, 0); w.box(43.0, 44.8, 32.75, 33.25, .35, .45, 'water')
# trees in the corners and yards, bushes along the walls
for x, y, h, r in ((4.4, 14.6, 4.2, 2.4), (67.6, 17.0, 4.0, 2.3), (4.6, 3.0, 3.4, 1.9), (67.4, 3.0, 3.4, 1.9), (31.4, 14.6, 3.8, 2.1), (40.8, 41.6, 3.8, 2.1), (31.6, 41.0, 3.6, 2.0), (40.6, 21.6, 3.4, 1.9)):
    tree(x, y, 0, h=h, r=r)
for x in np.arange(8.0, 66, 3.1):
    if abs(x - 36) > 5 and rng.uniform() < .7: bush(x + rng.uniform(-.5, .5), 3.9, r=rng.uniform(.6, .9))
for x in (4.0, 68.0):
    for y in (8.0, 34.6, 40.0): bush(x, y, r=.8)
tree(30.2, 57.6, UP, h=3.6, r=2.0); tree(41.8, 57.6, UP, h=3.6, r=2.0); planter(18.0, 55.6, UP); planter(54.0, 55.6, UP); bench(23.0, 55.6, UP); bench(48.0, 55.6, UP)

# =========================================================================== places the game needs
w.mark('exit_east', 70.6, 29, 0, title='草の高原へ'); w.mark('spawn_east', 66.0, 29, 0)
w.mark('exit_west', 1.4, 29, 0, title='西の街道へ'); w.mark('spawn_west', 6.0, 29, 0)
w.mark('exit_south', 36, -5.6, 0, title='南の街道へ'); w.mark('spawn_south', 36, 1.6, 0)
w.mark('exit_north', 36, 61.0, UP, title='城門前の広場へ'); w.mark('spawn_north', 36, 57.4, UP)
w.mark('door_weapon', 10.5, 35.9, 0, title='武器屋'); w.mark('door_armor', 24.2, 35.9, 0, title='防具屋'); w.mark('door_tavern', 51.5, 36.9, 0, title='大酒場「三つ樽」')
w.mark('door_item', 13.2, 10.9, 0, title='道具屋'); w.mark('door_inn', 58.0, 10.9, 0, title='宿「灯守り亭」')
w.mark('hide_alley', 20.9, 16.5, 0, title='路地の奥'); w.mark('board', 28.9, 33.4, 0, title='立て札'); w.mark('casks', 63.2, 33.6, 0, title='三つの大樽')
for nm, x, y in (('npc_garam', 61.6, 34.6), ('npc_ryuka', 47.0, 33.2), ('npc_nezu', 52.0, 34.8), ('npc_hash', 59.8, 34.0), ('npc_bren', 12.2, 35.0), ('npc_sara', 59.9, 10.3),
                 ('npc_marg', 25.6, 30.6), ('npc_jino', 31.4, 31.8)):
    w.mark(nm, x, y, 0)
for i, (x, y, z) in enumerate(WIN): w.mark('win%d' % i, x, y, z, light=dict(color='#ffb26a', r=110, intensity=.7))
w.mark('fx_cross', 36, 29, 0); w.mark('fx_tavern', 52, 34, 0); w.mark('fx_lane', 36, 7.5, 0); w.mark('fx_west', 14, 29, 0)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    info = bake(w, out, spawn=(66.0, 29.0), **MAP)
    bad = [k for k, v in info['marks'].items() if (k.startswith(('npc', 'door', 'exit', 'spawn', 'chest', 'hide', 'board', 'casks'))) and not v['on_ground']]
    print('marks not on walkable ground:', bad)
