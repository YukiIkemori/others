"""Blockout of the moon-tree sanctuary: seven floating islands above the sea of clouds, joined by bridges and floating stairs.
   A landing (z 0) -> stone circle B (z 3) with the crystal isle D to the west and the mirror pool C to the east
   -> long stairs to the great tree E (z 9) -> the spring G (north-west) and the moon gate F (north-east), both z 12.
usage: python3 isles_world.py out_dir"""
import sys, os, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vox import World, bake, MAT, VPU

w = World(x=(0, 60), y=(-4, 58), z=(-14, 30)); XX, YY = w.XX, w.YY
rng = np.random.default_rng(11)
MAP = dict(W=1920, H=1840, SY0=1706)

def blob(cx, cy, rx, ry, p=2.6, wob=.05, ph=0.):
    th = np.arctan2((YY - cy) / ry, (XX - cx) / rx)
    k = 1 + wob * np.sin(3 * th + ph) + wob * .6 * np.sin(5 * th + 2 * ph + 1.) + wob * .4 * np.sin(9 * th + 3 * ph)
    return (np.abs((XX - cx) / (rx * k)) ** p + np.abs((YY - cy) / (ry * k)) ** p) <= 1

n1 = ndi.gaussian_filter(rng.standard_normal(XX.shape), 6); n1 /= np.abs(n1).max()
n2 = ndi.gaussian_filter(rng.standard_normal(XX.shape), 2.4); n2 /= np.abs(n2).max()
LEVEL = np.full(XX.shape, np.nan)

def island(mask, z, tmax=7.0):
    """a floating island: grass on top, a rock body that hangs deeper towards the middle, in rough spikes"""
    e = ndi.distance_transform_edt(mask) / VPU
    T = np.clip(1.2 + 2.6 * e, 0, tmax) * (0.85 + 0.4 * n1) + 2.2 * np.maximum(n2, 0) * np.minimum(e, 2.5)
    T = np.maximum(T, 0.8)
    for k in range(w.iz(z - tmax * 1.5 - 4.5), w.iz(z)):
        w.V[mask & (w.ZC[k] > z - T), k] = MAT['rock']
    w.col(mask, z - 1 / VPU, z, 'grass'); LEVEL[mask] = z
    return mask

def top(mask, mat):
    for lv in np.unique(LEVEL[mask & ~np.isnan(LEVEL)]): w.col(mask & (LEVEL == lv), lv - 1 / VPU, lv, mat)

def seg_d(ax, ay, bx, by):
    vx, vy = bx - ax, by - ay; t = np.clip(((XX - ax) * vx + (YY - ay) * vy) / (vx * vx + vy * vy), 0, 1)
    return np.hypot(XX - ax - t * vx, YY - ay - t * vy)
PATHS = np.zeros(XX.shape, bool)
def path(pts, width=2.0, mat='path'):
    global PATHS
    m = np.zeros(XX.shape, bool)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]): m |= seg_d(ax, ay, bx, by) <= width / 2
    top(m, mat); PATHS |= m; return m
def disc(cx, cy, r): return (XX - cx) ** 2 + (YY - cy) ** 2 <= r * r

def rim_south(mask, xa, xb):
    """the first y from which every column between xa and xb is inside the island"""
    cols = mask[w.ix(xa):w.ix(xb)]; return float(max(w.Y0 + np.argmax(c) / VPU for c in cols))
def rim_north(mask, xa, xb):
    cols = mask[w.ix(xa):w.ix(xb)]; return float(min(w.Y0 + (len(c) - np.argmax(c[::-1])) / VPU for c in cols))

def stair_bridge(xa, xb, yend, z0, n, rise=0.375, run=0.5, side=0.35):
    """floating steps that climb northwards and arrive at height z0 + n * rise at y = yend"""
    y0 = yend - n * run
    for i in range(n):
        ya, yb, h = y0 + i * run, y0 + (i + 1) * run, z0 + (i + 1) * rise
        w.box(xa - side, xb + side, ya, yb, h, h + 4.0, 0)
        w.box(xa, xb, ya, yb, h - 0.9, h - 1 / VPU, 'wall'); w.box(xa, xb, ya, yb, h - 1 / VPU, h, 'stair')
        for x0, x1 in ((xa - side, xa), (xb, xb + side)): w.box(x0, x1, ya, yb, h - 0.9, h + 0.55, 'wall')
    for x0, x1 in ((xa - side - .1, xa), (xb, xb + side + .1)): w.box(x0, x1, y0 - .5, y0, z0, z0 + 1.5, 'wall')
    return y0

def bridge_x(x0, x1, yc, z, width=2.2):
    w.box(x0, x1, yc - width / 2, yc + width / 2, z - .8, z - 1 / VPU, 'wall'); w.box(x0, x1, yc - width / 2, yc + width / 2, z - 1 / VPU, z, 'path')
    for ya, yb in ((yc - width / 2 - .3, yc - width / 2), (yc + width / 2, yc + width / 2 + .3)): w.box(x0, x1, ya, yb, z - .8, z + .5, 'wall')
    for x in (x0, x1 - .5):
        for ya in (yc - width / 2 - .4, yc + width / 2 - .1): w.box(x, x + .5, ya, ya + .5, z - .8, z + 1.2, 'wall')

def crystals(cx, cy, z, n=6, spread=1.4, hmax=4.5, seed=0):
    r = np.random.default_rng(seed)
    for i in range(n):
        a, d = r.uniform(0, 6.283), r.uniform(0, spread) * (0 if i == 0 else 1)
        h = hmax * (1 if i == 0 else r.uniform(.3, .75)); rad = .28 + .1 * h
        w.cone(cx + d * np.cos(a), cy + d * np.sin(a) * .7, rad, z, z + h * .55, 'crystal', r1=rad * .85)
        w.cone(cx + d * np.cos(a), cy + d * np.sin(a) * .7, rad * .85, z + h * .55, z + h, 'crystal', r1=.04)

def glowtree(cx, cy, z, h=3.2, r=1.7):
    w.cone(cx, cy, .32, z, z + h, 'whitebark', r1=.2); w.ball(cx, cy, z + h + r * .55, r, 'glowleaf', squash=.8)
    w.ball(cx + r * .6, cy - .2, z + h + r * .2, r * .62, 'glowleaf', squash=.8)

def stone(x, y, z, h, wx=.55, wy=.4): w.box(x - wx, x + wx, y - wy, y + wy, z, z + h, 'tomb')
def column(x, y, z, h, cap=True):
    w.cyl(x, y, .62, z, z + .3, 'wall'); w.cyl(x, y, .45, z + .3, z + h, 'wall')
    if cap: w.cyl(x, y, .66, z + h - .35, z + h, 'wall')
def post(x, y, z, r=120): w.lantern(x, y, z + 2.1, post=z, r=r)

# =========================================================================== islands
A = island(blob(30, 3.5, 6.5, 4.6, ph=.4), 0.0, tmax=4.5)
B = island(blob(30, 17, 10.5, 7.0, ph=1.3), 3.0, tmax=7.5)
C = island(blob(50, 15.5, 7.5, 6.0, ph=2.2), 3.0, tmax=6.5)
D = island(blob(10.5, 15, 7.5, 6.0, ph=3.1), 3.0, tmax=6.5)
Em = blob(30, 38.5, 12, 8.5, ph=.9) | blob(18.5, 38, 6, 4.8, ph=1.7) | blob(41.5, 38, 6, 4.8, ph=2.9)
E_ = island(Em, 9.0, tmax=9.0)
F = island(blob(46, 50, 6.5, 4.6, ph=.2), 12.0, tmax=6.0)
G = island(blob(13.5, 49, 6.5, 4.6, ph=2.0), 12.0, tmax=6.0)
# small rocks adrift, never reachable
for cx, cy, rx, ry, z, ph in ((7.5, 29.5, 2.6, 1.8, 6.0, .3), (53.5, 30, 3.0, 2.0, 5.0, 1.1), (55.5, 3.0, 2.6, 1.8, -1.0, 2.0), (5.0, 2.5, 2.8, 1.9, -2.0, .7),
                              (44, 27.5, 1.6, 1.2, 4.0, 2.4), (17.5, 27.5, 1.5, 1.1, 4.5, 1.9), (56, 42, 2.0, 1.5, 9.0, .5), (3.5, 38, 1.8, 1.3, 8.0, 1.4)):
    island(blob(cx, cy, rx, ry, ph=ph, wob=.08), z, tmax=3.6)

# =========================================================================== ways between the islands
SX = (28.6, 31.4)
y_ab = stair_bridge(*SX, rim_south(B, SX[0] - .4, SX[1] + .4) + .25, 0.0, 8)
y_be = stair_bridge(*SX, rim_south(E_, SX[0] - .4, SX[1] + .4) + .25, 3.0, 16)
bn = rim_north(B, SX[0] - .4, SX[1] + .4)
if y_be > bn - .6:                                            # a short deck from the island's edge to the first step
    w.box(SX[0], SX[1], bn - .8, y_be, 3 - .8, 3 - 1 / VPU, 'wall'); w.box(SX[0], SX[1], bn - .8, y_be, 3 - 1 / VPU, 3, 'path')
FX = (43.8, 46.2); y_ef = stair_bridge(*FX, rim_south(F, FX[0] - .4, FX[1] + .4) + .25, 9.0, 8)
GX = (13.8, 16.2); y_eg = stair_bridge(*GX, rim_south(G, GX[0] - .4, GX[1] + .4) + .25, 9.0, 8)
bridge_x(39.6, 43.6, 16.5, 3.0); bridge_x(17.0, 20.6, 16.0, 3.0)
print('stairs start at y: A-B %.2f  B-E %.2f (B north rim %.2f)  E-F %.2f  E-G %.2f' % (y_ab, y_be, bn, y_ef, y_eg))

# =========================================================================== A: the landing
path([(30, -0.4), (30, y_ab + .2)], 2.6)
for x in (27.0, 33.0):                                        # a broken gate: two piers, one still carries the start of an arch
    w.box(x - .6, x + .6, 2.4, 3.4, 0, 3.6 if x < 30 else 2.4, 'wall')
w.box(27.6, 28.8, 2.5, 3.3, 3.0, 3.6, 'wall')
post(27.6, y_ab - .3, 0); post(32.4, y_ab - .3, 0)
glowtree(34.6, 4.6, 0, h=2.6, r=1.4)

# =========================================================================== B: the stone circle
CB = (30, 16.6)
path([(30, rim_south(B, *SX) + .2), (30, y_be + .3)], 2.4)
path([(20.2, 16.0), (26, 16.4), (34, 16.6), (40.0, 16.5)], 2.0)
top(disc(*CB, 3.3), 'floor'); top(disc(*CB, 1.9), 'rune')
for k in range(8):
    a = np.pi / 8 + k * np.pi / 4; x, y = CB[0] + 4.7 * np.cos(a), CB[1] + 4.0 * np.sin(a)
    stone(x, y, 3, (3.4, 2.6, 3.0, 3.6, 2.2, 3.2, 2.8, 3.5)[k], .5, .38)
post(27.4, 22.0, 3); post(32.6, 22.0, 3)
glowtree(22.6, 20.2, 3, h=3.0, r=1.6); glowtree(37.4, 12.6, 3, h=2.6, r=1.4)
stone(36.6, 20.6, 3, 1.2, .7, .5); stone(23.4, 12.4, 3, .9, .8, .5)

# =========================================================================== C: the mirror pool
pc = ((XX - 50.5) / 3.4) ** 2 + ((YY - 16.6) / 2.4) ** 2
w.col(C & (pc <= 1.3), 3, 3.3, 'wall'); w.col(C & (pc <= 1.0), 3 - .3, 3.3, 0); w.col(C & (pc <= 1.0), 3 - .45, 3 - .3, 'water')
cs = rim_south(C, 51.6, 52.8)
w.box(51.7, 52.7, cs - .6, 14.6, 3 - .3, 3.3, 0); w.box(51.7, 52.7, cs - .6, 14.6, 3 - .45, 3 - .3, 'water')      # the outflow
w.box(51.7, 52.7, cs - .75, cs - .45, w.Z0, 2.7, 'fall')
path([(43.2, 16.5), (45.6, 16.4)], 2.0); path([(45.6, 16.4), (46.4, 13.0), (50, 11.6)], 1.7); path([(45.6, 16.4), (46.6, 19.6), (51, 20.6), (55, 18.4)], 1.7)
crystals(55.2, 14.4, 3, n=6, hmax=3.6, seed=3); crystals(47.6, 20.6, 3, n=3, spread=.8, hmax=2.0, seed=4)
w.box(48.6, 50.4, 12.3, 12.8, 3, 3.5, 'wood'); post(45.2, 14.6, 3); glowtree(54.6, 19.4, 3, h=2.8, r=1.5)

# =========================================================================== D: the crystal isle
path([(17.2, 16.0), (13.5, 15.6), (10.5, 14.2)], 1.9)
top(disc(10.0, 13.8, 2.3), 'floor')
crystals(8.6, 17.6, 3, n=9, spread=2.3, hmax=6.2, seed=1); crystals(5.6, 13.4, 3, n=4, spread=1.0, hmax=2.6, seed=2); crystals(14.6, 18.8, 3, n=3, spread=.8, hmax=2.2, seed=5)
w.box(9.4, 10.6, 13.3, 14.3, 3, 3.9, 'tomb'); w.box(9.75, 10.25, 13.55, 14.05, 3.9, 4.3, 'crystal')              # a pedestal with a shard
post(15.4, 14.4, 3); glowtree(13.2, 11.2, 3, h=2.6, r=1.4)

# =========================================================================== E: the great tree
TX, TY = 30.0, 43.0
path([(30, rim_south(E_, *SX) + .2), (30, 38.2)], 2.6)
top(disc(30, 39.2, 3.6), 'floor'); top(disc(30, 39.2, 2.1), 'rune')
path([(26.6, 38.6), (21, 38.2), (15.0, 39.4), (15.0, y_eg + .3)], 1.9); path([(33.4, 38.6), (39, 38.2), (45.0, 39.4), (45.0, y_ef + .3)], 1.9)
for y, hs in ((32.2, (3.6, 2.2)), (34.6, (1.4, 3.6)), (37.0, (3.6, 3.0))):
    column(27.4, y, 9, hs[0], cap=hs[0] > 3); column(32.6, y, 9, hs[1], cap=hs[1] > 3)
w.box(29.0, 31.0, 40.3, 41.0, 9, 10.0, 'tomb')                                                                     # the altar under the tree
w.cone(TX, TY, 2.5, 9, 13, 'whitebark', r1=1.7); w.cone(TX, TY, 1.7, 13, 18.5, 'whitebark', r1=1.2)
for a, ln in ((-2.5, 4.2), (-.6, 4.6), (.5, 3.4), (2.3, 3.8), (3.4, 3.2), (-1.5, 3.0)):                              # roots
    w.limb((TX + 1.6 * np.cos(a), TY + 1.4 * np.sin(a), 9.9), (TX + ln * np.cos(a), TY + ln * np.sin(a) * .8, 9.05), .62, .28, 'whitebark')
for p1 in ((24.0, 42.6, 21.0), (36.0, 42.8, 21.2), (27.2, 44.6, 23.2), (33.0, 44.2, 23.4), (30.0, 41.4, 22.4)):      # boughs
    w.limb((TX, TY, 17.2), p1, .8, .42, 'whitebark')
for cx, cy, cz, r in ((30, 43.2, 24.4, 5.2), (24.0, 42.8, 22.6, 4.0), (36.0, 43.0, 22.8, 4.0), (27.0, 45.4, 24.6, 3.6), (33.4, 45.0, 24.8, 3.6), (30, 41.2, 22.6, 3.2),
                      (21.6, 43.6, 21.4, 2.6), (38.4, 43.6, 21.4, 2.6)):
    w.ball(cx, cy, cz, r, 'glowleaf', squash=.72)
# the sanctuary gate at the head of the long stairs
w.box(27.3, 32.7, 31.0, 31.7, 9, 13.4, 'wall'); w.box(26.9, 28.2, 30.9, 31.8, 9, 14.0, 'wall'); w.box(31.8, 33.1, 30.9, 31.8, 9, 14.0, 'wall')
w.arch_y(30, 2.9, 30.9, 31.8, 9, 2.4)
w.box(28.55, 31.45, 30.9, 31.8, 9 - 1 / VPU, 9, 'path')
w.lantern(27.7, 30.8, 11.4, glow_z=9.0); w.lantern(32.3, 30.8, 11.4, glow_z=9.0)
post(22.6, 36.6, 9, r=110); post(37.4, 36.6, 9, r=110)
crystals(38.6, 33.4, 9, n=4, spread=1.0, hmax=2.8, seed=6); crystals(21.2, 33.6, 9, n=3, spread=.9, hmax=2.2, seed=7)
glowtree(20.2, 41.4, 9, h=2.6, r=1.4); glowtree(40.2, 41.6, 9, h=2.6, r=1.4)
stone(24.6, 34.4, 9, 1.0, .8, .5); stone(35.6, 35.0, 9, .8, .7, .5)

# =========================================================================== F: the moon gate
top(F & (YY > 46.2) & disc(46, 50.2, 5.2), 'floor')
path([(45.0, rim_south(F, *FX) + .2), (45.6, 48.0)], 2.0)
RX_, RY_, RZ, RO, RI = 46.0, 52.6, 12.2 + 3.3, 3.3, 2.35
w.box(RX_ - 2.2, RX_ + 2.2, RY_ - .5, RY_ + .5, 12, 12.5, 'wall')
dz = w.ZC[None, :] - RZ; dx = (w.X0 + (np.arange(w.NX) + .5) / VPU)[:, None] - RX_; rr = np.hypot(dx, dz)
ring = (rr <= RO) & (rr >= RI)
w.V[:, w.iy(RY_ - .4):w.iy(RY_ + .4), :][np.broadcast_to(ring[:, None, :], w.V[:, w.iy(RY_ - .4):w.iy(RY_ + .4), :].shape)] = MAT['wall']
post(42.4, 48.6, 12); post(49.8, 48.6, 12)
w.box(49.6, 51.2, 50.6, 51.1, 12, 12.5, 'wood'); crystals(41.6, 51.4, 12, n=3, spread=.7, hmax=2.4, seed=8)

# =========================================================================== G: the spring
pg = ((XX - 11.6) / 2.6) ** 2 + ((YY - 50.0) / 1.9) ** 2
w.col(G & (pg <= 1.35), 12, 12.3, 'wall'); w.col(G & (pg <= 1.0), 12 - .3, 12.3, 0); w.col(G & (pg <= 1.0), 12 - .45, 12 - .3, 'water')
gs = rim_south(G, 9.6, 10.8)
w.box(9.7, 10.7, gs - .6, 48.4, 12 - .3, 12.3, 0); w.box(9.7, 10.7, gs - .6, 48.4, 12 - .45, 12 - .3, 'water')
w.box(9.7, 10.7, gs - .75, gs - .45, w.Z0, 11.7, 'fall')
path([(15.0, rim_south(G, *GX) + .2), (15.4, 47.6), (16.6, 50.4)], 1.9); top(disc(16.4, 50.6, 1.9), 'floor')
crystals(8.4, 52.0, 12, n=7, spread=1.7, hmax=5.0, seed=9); crystals(18.6, 51.8, 12, n=3, spread=.7, hmax=2.2, seed=10)
w.box(15.9, 16.9, 51.6, 52.3, 12, 13.6, 'tomb'); post(13.2, 46.4, 12); glowtree(17.6, 47.0, 12, h=2.4, r=1.3)

# =========================================================================== boulders on the rims, firs on the drifting rocks
allm = ~np.isnan(LEVEL)
rimm = allm & ~ndi.binary_erosion(allm, iterations=5)
for _ in range(900):
    x, y = rng.uniform(1, 59), rng.uniform(-3, 57); i, j = w.ix(x), w.iy(y)
    if not rimm[min(i, w.NX - 1), min(j, w.NY - 1)] or ndi.binary_dilation(PATHS, iterations=8)[min(i, w.NX - 1), min(j, w.NY - 1)]: continue
    if rng.uniform() < .42:
        z = LEVEL[min(i, w.NX - 1), min(j, w.NY - 1)]; r = rng.uniform(.3, .6)
        w.ball(x, y, z + r * .3, r, 'rock', squash=.8)
for cx, cy, z in ((7.5, 29.7, 6.0), (53.8, 30.2, 5.0), (55.6, 3.2, -1.0), (5.0, 2.7, -2.0), (56, 42.2, 9.0)):
    w.cone(cx, cy, 1.15, z + .5, z + 4.6, 'conifer'); w.cyl(cx, cy, .28, z, z + .5, 'trunk')
crystals(44, 27.5, 4.0, n=3, spread=.5, hmax=2.2, seed=12); crystals(17.5, 27.5, 4.5, n=3, spread=.5, hmax=2.0, seed=13); crystals(3.5, 38, 8.0, n=3, spread=.6, hmax=2.4, seed=14)

# =========================================================================== places the game needs
BL, CY_, WA, GR = '#a8dcff', '#6fe6ff', '#ffb060', '#c8f0ff'
w.mark('about', 30, 2.0, 0, title='この版について')
w.mark('circle', CB[0], CB[1], 3, title='石の環', light=dict(color=BL, r=150, intensity=.55))
w.mark('pool', 50.5, 13.4, 3, title='水鏡', light=dict(color=BL, r=170, intensity=.5))
w.mark('shard', 10.0, 12.6, 3, title='結晶の台座', light=dict(color=CY_, r=120, intensity=.7))
w.mark('altar', 30, 39.6, 9, title='月光樹の祭壇', light=dict(color=GR, r=190, intensity=.6))
w.mark('gate', 46.0, 51.0, 12, title='月の門')
w.mark('spring', 15.6, 49.4, 12, title='泉')
w.mark('ringlight', RX_, RY_ - .5, RZ, light=dict(color='#c9b8ff', r=170, intensity=.6))
for i, (x, y, z, r, it) in enumerate(((30, 42.4, 22.5, 260, .7), (24.2, 42.4, 21.5, 200, .55), (35.8, 42.4, 21.5, 200, .55), (30, 41.6, 11.5, 170, .5))):
    w.mark('tree%d' % i, x, y, z, light=dict(color=GR, r=r, intensity=it))
for i, (x, y, z, r) in enumerate(((8.6, 17.2, 6.0, 190), (5.6, 13.2, 4.4, 110), (55.2, 14.2, 5.0, 150), (8.4, 51.6, 15.0, 170), (38.6, 33.2, 10.6, 120), (21.2, 33.4, 10.4, 110),
                                  (41.6, 51.2, 13.4, 110), (47.6, 20.4, 4.2, 100), (14.6, 18.6, 4.4, 100), (18.6, 51.6, 13.3, 100), (44, 27.4, 5.2, 100), (17.5, 27.4, 5.6, 100), (3.5, 37.9, 9.4, 100))):
    w.mark('cry%d' % i, x, y - .3, z, light=dict(color=CY_, r=r, intensity=.75))
for nm, (cx, cy, rx, ry, z) in (('pond_c', (50.5, 16.6, 3.4, 2.4, 2.7)), ('pond_g', (11.6, 50.0, 2.6, 1.9, 11.7))):
    w.mark(nm, cx, cy, z); w.marks[nm]['poly'] = [(cx + rx * np.cos(a), cy + ry * np.sin(a), z) for a in np.linspace(0, 2 * np.pi, 28, endpoint=False)]
w.mark('fx_tree', TX, 40.5, 9); w.mark('fx_circle', *CB, 3); w.mark('fx_d', 9.5, 15.5, 3); w.mark('fx_g', 12.5, 50, 12); w.mark('fx_f', 46, 50, 12); w.mark('fx_c', 50.5, 16, 3)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    info = bake(w, out, spawn=(30, 0.2), **MAP)
    print({k: v['on_ground'] for k, v in info['marks'].items() if 'title' in v})
