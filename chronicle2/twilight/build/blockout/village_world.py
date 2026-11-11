"""Blockout of the starting village (M01 始まりの村): a small farming village on a hilltop.
   North: a rock face rising towards the abbey.  South: wheat terraces falling away.  One way out: the west gate (to F01).
   Buildings are sized for the 80-dot party: a door is 4.3 units tall on the picture (about 90 dots), a house front 10-12 units wide.
   Lanes and the plaza are kept wide and empty; everything dense sits at their edges and in the places nobody walks.
usage: python3 village_world.py out_dir"""
import sys, os, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vox
from vox import World, bake, MAT, VPU

# materials this map adds (guide colours only tell the painter what is what)
for name, idx, col in (('wheat', 26, (214, 186, 96)), ('thatch', 27, (150, 124, 70)), ('plaster', 28, (222, 208, 180)), ('soil', 29, (120, 88, 62)),
                       ('leaf', 30, (64, 122, 58)), ('hay', 31, (226, 196, 110)), ('sheep', 32, (240, 236, 226)), ('timber', 33, (92, 64, 44)),
                       ('cloth', 34, (150, 70, 60)), ('bush', 35, (86, 140, 70))):
    MAT[name] = idx; vox.COLOR[idx] = col

w = World(x=(0, 64), y=(-6, 66), z=(-8, 26)); XX, YY = w.XX, w.YY
rng = np.random.default_rng(5)
MAP = dict(W=2048, H=1792, SY0=1648)
n1 = ndi.gaussian_filter(rng.standard_normal(XX.shape), 10); n1 /= np.abs(n1).max()

# =========================================================================== ground levels
CLIFF = YY >= 56.0 + 1.2 * n1 + 0.5 * np.sin(XX * .7)                 # the rock face behind the village
CHAP = (XX < 23.5) & (YY >= 40.0) & ~CLIFF                              # chapel terrace
PAST = (((XX >= 44.0) & (YY >= 44.0)) | ((XX >= 57.5) & (YY >= 30.0))) & ~CLIFF   # sheep pasture
S1 = YY < 5.0 + .5 * np.sin(XX * .45); S2 = YY < 1.5 + .6 * np.sin(XX * .3 + 1); S3 = YY < -2.2 + .5 * np.sin(XX * .5 + 2)
LEVEL = np.zeros(XX.shape)
LEVEL[CHAP] = 3.0; LEVEL[PAST] = 2.25; LEVEL[S1] = -1.5; LEVEL[S2] = -3.0; LEVEL[S3] = -4.5
LEVEL[CLIFF] = 10.0 + np.round(2.0 * np.clip((YY[CLIFF] - 58) / 5, 0, 1) * 2) / 2
for lv in np.unique(LEVEL):
    m = LEVEL == lv
    w.col(m, w.Z0, lv, 'rock'); w.col(m, lv - 1 / VPU, lv, 'grass')
# built retaining walls in front of the two terraces, rough rock in front of the cliff
def face(mask, z0, z1, mat, th=.6):
    edge = mask & ~np.roll(mask, VPU // 2 + int(th * VPU), 1) & (YY > w.Y0 + 2)
    w.col(ndi.binary_dilation(edge, iterations=1) & mask, z0, z1 - 1 / VPU, mat)
face(CHAP, 0, 3.0, 'wall'); face(PAST, 0, 2.25, 'wall')
for k in range(w.iz(0), w.iz(12)):                                    # the cliff leans back a little and breaks into ledges
    z = w.ZC[k]; inset = 0.22 * z + 0.6 * (np.floor(z / 2.2) % 2) + 0.4 * np.sin(XX * 1.3 + np.floor(z / 1.4) * 1.9)
    cut = CLIFF & (YY < 56.0 + 1.2 * n1 + 0.5 * np.sin(XX * .7) + inset) & (w.V[:, :, k] > 0)
    w.V[cut, k] = 0
for m, lv in ((S1 & ~S2, -1.5), (S2 & ~S3, -3.0), (S3, -4.5)):        # wheat on the southern terraces
    w.col(m, lv, lv + .7, 'wheat')
w.col(S1 & ~np.roll(S1, 3, 1), -1.5, 0.0 - 1 / VPU, 'wall')

def top(mask, mat):
    for lv in np.unique(LEVEL[mask]): w.col(mask & (LEVEL == lv), lv - 1 / VPU, lv, mat)
def seg_d(ax, ay, bx, by):
    vx, vy = bx - ax, by - ay; t = np.clip(((XX - ax) * vx + (YY - ay) * vy) / (vx * vx + vy * vy), 0, 1)
    return np.hypot(XX - ax - t * vx, YY - ay - t * vy)
PATHS = np.zeros(XX.shape, bool)
def path(pts, width=4.0, mat='path'):
    global PATHS
    m = np.zeros(XX.shape, bool)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]): m |= seg_d(ax, ay, bx, by) <= width / 2
    m &= (LEVEL == 0) | (LEVEL == 3.0) | (LEVEL == 2.25)
    top(m, mat); PATHS |= m; return m
def rect(x0, x1, y0, y1): return (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1)

# =========================================================================== lanes and the plaza (wide, nothing stands in them)
path([(0, 28), (26, 28)], 4.4)                                        # village road from the west gate
plaza = ((np.abs(XX - 32) / 8.6) ** 3 + (np.abs(YY - 30.0) / 6.6) ** 3) <= 1
top(plaza, 'path'); PATHS |= plaza
path([(40.3, 30), (40.3, 21), (40.3, 9.4)], 3.8)                      # east lane: shop, herbalist
path([(35.4, 35.5), (37.6, 39.4)], 3.4)                               # smithy yard, north of the plaza
path([(8, 9.4), (56, 9.4)], 3.8)                                      # south lane in front of the three houses
path([(21.6, 9.4), (21.6, 24), (24, 27)], 3.6)                        # west connector
path([(12.5, 28), (12.5, 35.4)], 3.4)                                 # to the chapel stairs
path([(40.3, 24.6), (60.5, 24.6), (60.5, 27.2)], 3.0)                 # shop front, and on to the pasture stairs
path([(12.5, 40.6), (12.5, 42.6)], 3.2, 'floor'); path([(7, 42.4), (21, 42.4)], 2.6, 'floor')   # chapel forecourt
path([(19.6, 42.4), (19.6, 52.6), (8.5, 52.6)], 2.0, 'grass')        # the way round behind the chapel stays clear

# =========================================================================== stairs
CH_ST = w.stairs_n(11.0, 14.0, 40.0, 0.0, 3.0)                        # to the chapel terrace
PA_ST = w.stairs_n(59.0, 62.0, 30.0, 0.0, 2.25)                       # to the pasture

# =========================================================================== buildings
WIN = []                                                              # lit windows: (x, y, z)
def house(x0, x1, y0, y1, z=0.0, wall=5.6, rise=4.4, ridge='x', door=None, wins=(), chimney=None, base=1.3, over=.7, roof='thatch', upper=()):
    w.box(x0, x1, y0, y1, z, z + base, 'wall'); w.box(x0, x1, y0, y1, z + base, z + wall, 'plaster')
    for x in (x0, x1 - .35): w.box(x, x + .35, y0 - .06, y0 + .3, z + base, z + wall, 'timber')
    w.box(x0, x1, y0 - .06, y0 + .3, z + wall - .4, z + wall, 'timber')
    cx, cy, hx, hy = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + over, (y1 - y0) / 2 + over
    for k in range(w.iz(z + wall), w.iz(z + wall + rise)):
        t = 1 - (w.ZC[k] - z - wall) / rise
        if ridge == 'x': m = (np.abs(XX - cx) <= hx) & (np.abs(YY - cy) <= hy * t)
        else: m = (np.abs(XX - cx) <= hx * t) & (np.abs(YY - cy) <= hy)
        w.V[m, k] = MAT[roof]
        if ridge == 'y':                                              # the gable end that faces the camera is wall, not thatch
            w.V[(np.abs(XX - cx) <= hx * t - .45) & (YY >= y0 - .1) & (YY < y0 + .3), k] = MAT['plaster']
            w.V[(np.abs(XX - cx) <= hx * t) & (YY < y0 - .1) & (YY > y0 - over - .2), k] = 0
    if door is not None:
        w.arch_y(door, 2.3, y0 - .14, y0 + .1, z, 3.15, MAT['wood']); w.box(door - 1.5, door + 1.5, y0 - .7, y0 - .14, z, z + .2, 'floor')
    for wx_, wz in list(wins):
        w.box(wx_ - .75, wx_ + .75, y0 - .13, y0 + .1, z + wz, z + wz + 1.5, 'glass'); WIN.append((wx_, y0 - .2, z + wz + .7))
    for wx_, wz in upper:                                             # a window in the gable
        w.box(wx_ - .6, wx_ + .6, y0 - .2, y0 + .1, z + wz, z + wz + 1.2, 'glass'); WIN.append((wx_, y0 - .25, z + wz + .6))
    if chimney: w.box(chimney[0] - .55, chimney[0] + .55, chimney[1] - .55, chimney[1] + .55, z + wall, z + wall + rise + 1.4, 'wall')

house(5.5, 17.5, 12.2, 19.2, door=12.4, wins=((8.0, 2.0), (15.6, 2.0)), chimney=(7.4, 16.6))                         # the elder's house
house(25.5, 36.5, 12.2, 19.4, ridge='y', wall=5.2, rise=4.2, door=31.0, wins=((27.8, 2.0), (34.2, 2.0)), upper=((31.0, 6.0),), chimney=(34.6, 17.0))   # Teto's house (the inn)
house(44.2, 54.8, 12.2, 19.0, wall=5.0, rise=3.8, door=47.2, wins=((51.4, 2.0),), chimney=(53.2, 16.4))                                  # the herbalist
house(44.2, 55.6, 27.4, 34.0, wall=6.0, door=47.0, wins=((51.0, 2.1), (53.6, 2.1)), chimney=(45.6, 32.0))            # the general shop
house(30.5, 40.0, 40.5, 47.5, ridge='y', rise=5.0, door=37.6, wins=((33.0, 2.0),), upper=((35.25, 6.6),))                 # the smithy, north of the plaza
w.box(31.4, 33.2, 44.6, 46.4, 0, 13.6, 'wall')                                                                       # its big forge chimney
# the smithy's stone store: a flat roof at the pasture's height (the chest stands here, reached only from the pasture)
w.box(40.0, 44.0, 42.0, 47.0, 0, 2.25 - 1 / VPU, 'wall'); w.box(40.0, 44.0, 42.0, 47.0, 2.25 - 1 / VPU, 2.25, 'floor')
w.box(40.7, 44.0, 42.0, 42.3, 2.25, 2.8, 'wall')
w.arch_y(42.0, 1.6, 41.86, 42.1, 0, 1.2, MAT['wood'])
# the chapel on its terrace: taller walls, a steep roof, a little bell gable
house(6.0, 17.0, 44.4, 51.0, z=3.0, wall=6.6, rise=5.6, ridge='y', door=11.5, wins=((8.0, 2.4), (15.0, 2.4)), upper=((11.5, 7.4),), roof='roof', base=6.6)
w.box(10.6, 12.4, 44.3, 45.3, 3 + 12.2, 3 + 14.6, 'wall'); w.box(11.2, 11.8, 44.2, 44.5, 3 + 12.8, 3 + 13.8, 'bell')
w.pyramid(10.3, 12.7, 44.0, 45.6, 3 + 14.6, 3 + 16.6, 'roof')

# =========================================================================== the village wall and the gate
def wall_x(x0, x1, y, z=0.0, h=1.15, th=.55): w.box(x0, x1, y - th / 2, y + th / 2, z, z + h, 'wall')
def wall_y(x, y0, y1, z=0.0, h=1.15, th=.55): w.box(x - th / 2, x + th / 2, y0, y1, z, z + h, 'wall')
wall_x(2.6, 62.2, 5.6); wall_y(2.6, 5.6, 25.4); wall_y(2.6, 30.6, 55.0); wall_y(62.2, 5.6, 24.0)
for y in (25.4, 30.6):                                                # gate posts and the beam across
    w.box(2.0, 3.2, y - .6, y + .6, 0, 5.2, 'wall')
w.box(2.2, 3.0, 25.4, 30.6, 5.2, 6.0, 'timber')
wall_x(0.0, 23.2, 40.0, z=3.0, h=.9); w.box(10.6, 14.4, 39.6, 40.5, 3.0, 4.2, 0)                 # parapets on the terraces (open at the stairs)
wall_x(44.0, 57.5, 44.0, z=2.25, h=.9); wall_y(57.5, 30.0, 44.0, z=2.25, h=.9); wall_y(44.0, 47.0, 55.5, z=2.25, h=.9)
wall_x(57.5, 58.6, 30.0, z=2.25, h=.9); wall_x(62.4, 64, 30.0, z=2.25, h=.9)
wall_y(23.3, 40.0, 55.5, z=3.0, h=.9)

# =========================================================================== things at the edges
def tree(cx, cy, z, h=4.6, r=3.0, mat='leaf'):
    cs = r * .62; sl = lambda x, y, zz: (x, y + cs, zz - cs * .75 / .66)          # crowns never hang out in front of their trunks
    w.cone(cx, cy, .55, z, z + h + 1.0, 'trunk', r1=.34)
    w.ball(*sl(cx, cy, z + h + r * .95), r, mat, squash=.78); w.ball(*sl(cx - r * .55, cy + .2, z + h + r * .55), r * .62, mat, squash=.8); w.ball(*sl(cx + r * .6, cy - .1, z + h + r * .6), r * .58, mat, squash=.8)
def fir(cx, cy, z, h=6.5, r=1.6): w.cone(cx, cy, r, z + .7, z + h, 'conifer'); w.cyl(cx, cy, .3, z, z + .7, 'trunk')
def barrel(x, y, z=0.0, h=1.15): w.cyl(x, y, .5, z, z + h, 'wood')
def crate(x, y, z=0.0, s=.55, h=.9): w.box(x - s, x + s, y - s, y + s, z, z + h, 'wood')
def fence_x(x0, x1, y, z=0.0, h=1.0):
    w.box(x0, x1, y - .1, y + .1, z + .45, z + .6, 'timber'); w.box(x0, x1, y - .1, y + .1, z + .85, z + h, 'timber')
    for x in np.arange(x0, x1 + .01, 1.6): w.box(x - .14, x + .14, y - .14, y + .14, z, z + h + .15, 'timber')
def fence_y(x, y0, y1, z=0.0, h=1.0):
    w.box(x - .1, x + .1, y0, y1, z + .45, z + .6, 'timber'); w.box(x - .1, x + .1, y0, y1, z + .85, z + h, 'timber')
    for y in np.arange(y0, y1 + .01, 1.6): w.box(x - .14, x + .14, y - .14, y + .14, z, z + h + .15, 'timber')
def plot(x0, x1, y0, y1, z=0.0, crop=True):
    top(rect(x0, x1, y0, y1), 'soil')
    if crop:
        for y in np.arange(y0 + .5, y1 - .2, 1.0): w.box(x0 + .3, x1 - .3, y - .22, y + .22, z, z + .35, 'bush')
def haystack(x, y, z=0.0, r=1.5, h=2.6): w.cone(x, y, r, z, z + h, 'hay', r1=.25)
def sheep(x, y, z): w.ball(x, y, z + .55, .62, 'sheep', squash=.8); w.ball(x + .55, y - .1, z + .75, .3, 'dark')
def bush(x, y, z=0.0, r=.8): w.ball(x, y, z + r * .45, r, 'bush', squash=.7)
def bench(x, y, z=0.0): w.box(x - 1.0, x + 1.0, y - .3, y + .3, z, z + .5, 'wood')

# the plaza: the well, the barrels of the rumour seller, a big tree with a bench, a cart, a notice board
w.cyl(32.0, 32.6, 1.25, 0, 1.1, 'wall'); w.cyl(32.0, 32.6, .85, .5, 1.1, 0); w.cyl(32.0, 32.6, .85, .3, .5, 'water')
for x in (30.9, 33.1): w.box(x - .16, x + .16, 32.45, 32.75, 0, 3.4, 'timber')
w.box(30.5, 33.5, 32.0, 33.2, 3.4, 3.6, 'timber'); w.pyramid(30.3, 33.7, 31.8, 33.4, 3.6, 4.7, 'thatch')
for x, y in ((37.0, 34.4), (38.0, 34.0), (37.6, 35.4)): barrel(x, y)
crate(38.9, 35.0)
tree(25.6, 38.4, 0, h=5.2, r=3.4); bench(25.6, 36.9)
w.box(41.6, 44.2, 37.6, 38.8, .5, 1.3, 'wood'); w.cyl(41.9, 37.5, .55, 0, 1.1, 'timber'); w.cyl(43.9, 37.5, .55, 0, 1.1, 'timber'); w.box(40.2, 41.6, 38.1, 38.3, .8, .95, 'timber')
w.box(27.0, 27.2, 24.3, 24.5, 0, 2.2, 'timber'); w.box(28.6, 28.8, 24.3, 24.5, 0, 2.2, 'timber'); w.box(26.9, 28.9, 24.25, 24.55, 1.2, 2.3, 'wood')
# the elder's house: a long bench by the door, a fenced kitchen garden, firewood
bench(9.6, 11.3); plot(3.4, 5.0, 12.4, 18.6); fence_x(3.2, 5.4, 19.6); haystack(4.3, 22.3)
for i in range(4): w.box(14.4 + i * .8, 15.0 + i * .8, 11.1, 11.7, 0, .7 + .1 * (i % 2), 'wood')
tree(19.3, 22.4, 0, h=4.4, r=2.6); bush(18.6, 12.6); bush(4.0, 10.6)
# Teto's house: back garden towards the plaza, washing line, flower tubs by the door
fence_x(25.4, 36.6, 21.6); plot(26.2, 30.2, 19.9, 21.2); plot(31.6, 35.8, 19.9, 21.2)
for x in (27.4, 34.8): barrel(x, 11.4, h=.8)
w.box(37.2, 37.4, 13.0, 13.2, 0, 2.6, 'timber'); w.box(37.2, 37.4, 17.6, 17.8, 0, 2.6, 'timber'); w.box(37.22, 37.38, 13.2, 17.6, 1.6, 2.5, 'cloth')
# the herbalist: drying racks in front, herb beds beside
for x in (50.0, 52.6): w.box(x - 1.0, x + 1.0, 10.9, 11.1, 1.4, 1.55, 'timber'); w.box(x - 1.0, x - .85, 10.9, 11.1, 0, 1.55, 'timber'); w.box(x + .85, x + 1.0, 10.9, 11.1, 0, 1.55, 'timber'); w.box(x - .8, x + .8, 10.93, 11.07, .5, 1.4, 'bush')
plot(55.6, 60.6, 12.6, 18.6); fence_x(55.4, 61.0, 19.4); bush(56.6, 10.9); tree(59.6, 21.6, 0, h=4.0, r=2.4)
# the shop: a stall with an awning, crates, sacks, barrels
w.box(49.6, 53.8, 26.2, 27.0, 0, 1.2, 'wood')
for x in (49.6, 53.6): w.box(x, x + .2, 26.2, 26.4, 1.2, 3.5, 'timber')
w.box(49.3, 54.1, 25.9, 27.25, 3.5, 3.75, 'cloth')
for x, y in ((55.2, 26.7), (56.1, 26.5), (56.4, 27.5)): crate(x, y)
barrel(44.9, 26.7); barrel(57.2, 26.7)
# the smithy yard: anvil, quench trough, coal, grindstone, a rack of tools
w.box(34.4, 35.3, 38.9, 39.5, 0, .9, 'iron'); w.box(32.2, 33.4, 39.2, 39.9, 0, .7, 'wood'); w.cyl(31.4, 38.6, .7, 0, .6, 'dark')
w.box(39.2, 39.9, 39.4, 39.7, 0, 1.9, 'timber'); w.cyl(40.6, 40.4, .6, .3, 1.4, 'wall')
# north-west of the smithy: orchard, haystacks, hives, firewood (grass stays walkable between them)
for x, y, h, r in ((27.2, 46.6, 4.4, 2.8), (25.8, 52.6, 4.2, 2.5), (29.4, 53.4, 3.8, 2.2)): tree(x, y, 0, h=h, r=r)
haystack(26.4, 42.8, r=1.3, h=2.2); haystack(28.6, 49.6, r=1.2, h=2.0)
for x in (24.6, 25.5): w.box(x - .35, x + .35, 48.6, 49.3, 0, .9, 'wood'); w.box(x - .45, x + .45, 48.5, 49.4, .9, 1.1, 'thatch')
for i in range(5): w.box(41.0 + i * .7, 41.5 + i * .7, 48.6, 49.3, 0, .8 + .1 * (i % 2), 'wood')
# the pasture: fence, sheep, a hay rack, a small byre
fence_x(45.0, 57.0, 44.7, z=2.25); fence_y(58.3, 31.0, 44.0, z=2.25)
for x, y in ((47.6, 48.4), (50.8, 51.6), (53.4, 47.2), (56.6, 50.6), (60.6, 46.4), (61.0, 38.6), (59.8, 52.6)): sheep(x, y, 2.25)
w.box(48.6, 52.4, 53.0, 55.2, 2.25, 4.6, 'wood'); w.box(48.3, 52.7, 52.7, 55.5, 4.6, 5.4, 'thatch')
haystack(55.4, 53.6, z=2.25, r=1.2, h=2.0); tree(61.4, 54.0, 2.25, h=4.0, r=2.4); w.box(60.2, 61.8, 42.2, 42.7, 2.25, 3.0, 'wood')
# the chapel terrace: a tree, a few old stones, flower beds; the hidden gap lies behind the chapel
tree(20.6, 47.6, 3.0, h=4.6, r=2.8)
for x, y in ((4.0, 44.0), (4.4, 46.6), (3.8, 49.0)): w.box(x - .4, x + .4, y - .15, y + .15, 3.0, 4.1, 'tomb')
bush(7.4, 43.4, 3.0); bush(15.6, 43.4, 3.0); bench(17.6, 43.3, 3.0)
# firs on top of the cliff, bushes along the village wall, a scarecrow in the wheat
for x in np.arange(2.5, 63, 3.4):
    j = rng.uniform(-.8, .8); fir(x + j, 60.5 + rng.uniform(-1.2, 2.2), LEVEL[w.ix(min(x + j, 63.9)) - 1, w.iy(61)], h=rng.uniform(5.5, 8.0), r=rng.uniform(1.4, 2.0))
for x in np.arange(6, 60, 2.6):
    if rng.uniform() < .55 and abs(x - 21.6) > 3 and abs(x - 40.3) > 3: bush(x + rng.uniform(-.6, .6), 6.5, r=rng.uniform(.6, .9))
w.box(30.0, 30.2, 2.6, 2.8, -1.5, 1.3, 'timber'); w.box(29.2, 31.0, 2.6, 2.8, .4, .6, 'timber'); w.ball(30.1, 2.7, 1.5, .4, 'hay')
haystack(12.0, 2.9, z=-1.5, r=1.3, h=2.2); haystack(50.6, 3.1, z=-1.5, r=1.4, h=2.4)

# =========================================================================== places the game needs
w.mark('exit_gate', 1.0, 28, 0, title='麦の丘へ')
w.mark('spawn_gate', 6.0, 28, 0)
w.mark('well', 32.0, 30.6, 0, title='井戸')
w.mark('door_elder', 12.4, 11.2, 0, title='村長の家'); w.mark('door_teto', 31.0, 11.2, 0, title='テトの家')
w.mark('door_herb', 47.2, 11.2, 0, title='薬師の家'); w.mark('door_shop', 47.0, 26.4, 0, title='よろず屋')
w.mark('door_smith', 37.6, 39.5, 0, title='鍛冶屋'); w.mark('door_chapel', 11.5, 43.3, 3.0, title='小さな礼拝堂')
w.mark('chest_roof', 42.0, 44.8, 2.25); w.mark('hide_chapel', 9.5, 52.6, 3.0)
for nm, x, y, z in (('npc_moku', 36.4, 33.2, 0), ('npc_mother', 32.9, 11.3, 0), ('npc_yomo', 51.3, 9.9, 0), ('npc_dorgo', 35.6, 38.0, 0), ('npc_hanna', 51.6, 25.4, 0),
                    ('npc_oz', 9.6, 10.4, 0), ('npc_sem', 13.4, 43.2, 3.0), ('npc_pico', 59.6, 33.6, 2.25), ('npc_mil', 30.0, 26.4, 0), ('npc_bart', 6.4, 31.4, 0)):
    w.mark(nm, x, y, z)
for i, (x, y, z) in enumerate(WIN): w.mark('win%d' % i, x, y, z, light=dict(color='#ffb26a', r=120, intensity=.8))
w.mark('fx_plaza', 32, 30, 0); w.mark('fx_orchard', 27, 48, 0); w.mark('fx_chapel', 12, 46, 3.0); w.mark('fx_pasture', 54, 49, 2.25)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    info = bake(w, out, spawn=(6.0, 28.0), **MAP)
    bad = [k for k, v in info['marks'].items() if (k.startswith(('npc', 'door', 'exit', 'spawn', 'chest', 'hide', 'well'))) and not v['on_ground']]
    print('marks not on walkable ground:', bad)
