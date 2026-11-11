"""Blockout of F01 麦の丘 (the first field): wheat fields and low stone walls around the hill the village stands on.
   Lowland z 0 (west and south).  The village hill z 3 (east), its gate facing west at the head of a ramp.
   North: a rock face.  A path climbs it in two flights (shelf z 4, top z 8) to the abbey.  Under the shelf, a ledge with a chest
   that cannot be reached from here (it is entered from the abbey map).  South-east: the great lone cedar.
   The road, the tracks and the grass between the fields are wide and empty; fields, walls, trees and rocks make the edges dense.
usage: python3 field01_world.py out_dir"""
import sys, os, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vox
from vox import World, bake, MAT, VPU

for name, idx, col in (('wheat', 26, (214, 186, 96)), ('thatch', 27, (150, 124, 70)), ('plaster', 28, (222, 208, 180)), ('soil', 29, (120, 88, 62)),
                       ('leaf', 30, (64, 122, 58)), ('hay', 31, (226, 196, 110)), ('sheep', 32, (240, 236, 226)), ('timber', 33, (92, 64, 44)),
                       ('cloth', 34, (150, 70, 60)), ('bush', 35, (86, 140, 70)), ('yard', 36, (186, 166, 132))):
    MAT[name] = idx; vox.COLOR[idx] = col

w = World(x=(0, 68), y=(-5, 66), z=(-6, 28)); XX, YY = w.XX, w.YY
rng = np.random.default_rng(21)
MAP = dict(W=2176, H=1664, SY0=1592)
n1 = ndi.gaussian_filter(rng.standard_normal(XX.shape), 10); n1 /= np.abs(n1).max()
n2 = ndi.gaussian_filter(rng.standard_normal(XX.shape), 4); n2 /= np.abs(n2).max()

# =========================================================================== ground
EDGE = 46.0 + (0.9 * n1 + 0.4 * np.sin(XX * .8)) * (1 - np.exp(-((XX - 27.5) / 5) ** 2))   # foot of the rock face (straight where the stairs meet it)
SHELF = (YY >= EDGE) & (XX >= 20) & (XX < 58.5) & (YY < 52.0)           # the shelf the cliff path runs along
TOPL = (YY >= EDGE) & ~SHELF                                            # the top of the cliff
HILL = (XX >= 40.0) & (YY >= 22.0 + .6 * np.sin(XX * .5)) & (YY < EDGE)  # the village hill
RAMP = (XX >= 29.0) & (XX < 40.0) & (YY >= 26.5) & (YY < 39.5)
LEVEL = np.zeros(XX.shape)
LEVEL[HILL] = 3.0
t = np.clip((XX - 29.0) / 11.0, 0, 1); t = t * t * (3 - 2 * t)
side = np.clip(np.minimum(YY - 26.5, 39.5 - YY) / 2.5, 0, 1)             # the ramp's flanks fall back to the lowland
LEVEL[RAMP] = (np.round(3.0 * t * side * VPU) / VPU)[RAMP]
LEVEL[SHELF] = 4.125; LEVEL[TOPL] = 8.25
LEVEL[(YY < -2.6 + .5 * np.sin(XX * .4))] = -1.5
for lv in np.unique(LEVEL):
    m = LEVEL == lv
    w.col(m, w.Z0, lv, 'rock'); w.col(m, lv - 1 / VPU, lv, 'grass')
for k in range(w.iz(0), w.iz(9.6)):                                    # the cliff leans back and breaks into ledges
    z = w.ZC[k]
    for mask, z0 in ((TOPL, 0.0), (SHELF, 0.0)):
        inset = 0.2 * (z - z0) + 0.5 * (np.floor(z / 2.0) % 2) + 0.35 * np.sin(XX * 1.3 + np.floor(z / 1.3) * 1.9)
        cut = mask & (YY < EDGE + inset) & (w.V[:, :, k] > 0) & ~(SHELF & (z > 3.5))
        w.V[cut, k] = 0
top2 = (YY >= 52.0) & (XX >= 20) & (XX < 58.5)                          # the upper face, behind the shelf
for k in range(w.iz(4.125), w.iz(9.6)):
    z = w.ZC[k]; inset = 0.2 * (z - 4) + 0.5 * (np.floor(z / 2.0) % 2) + 0.35 * np.sin(XX * 1.3 + np.floor(z / 1.3) * 1.9)
    w.V[top2 & (YY < 52.0 + inset) & (w.V[:, :, k] > 0), k] = 0

def top(mask, mat):
    for lv in np.unique(LEVEL[mask]): w.col(mask & (LEVEL == lv), lv - 1 / VPU, lv, mat)
def seg_d(ax, ay, bx, by):
    vx, vy = bx - ax, by - ay; tt = np.clip(((XX - ax) * vx + (YY - ay) * vy) / (vx * vx + vy * vy), 0, 1)
    return np.hypot(XX - ax - tt * vx, YY - ay - tt * vy)
PATHS = np.zeros(XX.shape, bool)
def path(pts, width=4.0, mat='path'):
    global PATHS
    m = np.zeros(XX.shape, bool)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]): m |= seg_d(ax, ay, bx, by) <= width / 2
    top(m, mat); PATHS |= m; return m
def rect(x0, x1, y0, y1): return (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1)

# =========================================================================== roads and tracks (wide, empty)
path([(0, 33), (20, 33.4), (29, 33), (43.4, 33)], 4.6)                 # the highway: west edge to the village gate
path([(27.5, 33), (27.5, 41.2)], 3.4)                                  # to the cliff path
path([(22, 33), (21.5, 22), (27, 14), (40, 10.5), (56, 8.5)], 3.0)     # the track to the lone cedar
path([(27.5, 46.6), (27.5, 48.6), (40, 49.2), (53.5, 49.0), (53.5, 50.2)], 3.0)   # along the shelf
path([(53.5, 55.6), (53.5, 59.4)], 3.2)                                # on top, to the abbey
ST1 = w.stairs_n(26.0, 29.0, 46.4, 0.0, 4.125)
ST2 = w.stairs_n(52.0, 55.0, 55.5, 4.125, 8.25, carve=True)

# =========================================================================== the ledge with the chest (entered from the abbey map)
# a paved stone platform on a rock foot, clear of trees so that its south face shows
LZ = 2.25
PX1 = 42.5                                                             # (the painter drew the platform out to the stair remains: the blocks follow the picture)
w.box(33.6, PX1, 41.6, 46.8, w.Z0, LZ - 1 / VPU, 'rock'); w.box(33.6, PX1, 41.6, 46.8, LZ - 1 / VPU, LZ, 'floor')
w.box(33.6, 34.0, 41.6, 46.8, LZ, LZ + .7, 'wall'); w.box(33.6, 36.4, 41.6, 42.0, LZ, LZ + .7, 'wall'); w.box(38.6, 40.0, 41.6, 42.0, LZ, LZ + .45, 'wall')   # a low broken parapet
w.box(PX1 - .4, PX1, 41.6, 46.8, LZ, LZ + .6, 'wall')
for i in range(5):                                                     # what is left of a stair that once came down from the shelf
    w.box(40.0 + i * .5, 40.5 + i * .5, 45.4, 46.8, LZ, LZ + .4 + i * .36, 'wall')

# =========================================================================== the village on its hill (scenery; the gate is the way in)
VX0, VX1, VY0, VY1 = 44.0, 66.4, 25.6, 44.4
top(rect(VX0, VX1, VY0, VY1), 'yard')
def wall_x(x0, x1, y, z=0.0, h=1.15, th=.55): w.box(x0, x1, y - th / 2, y + th / 2, z, z + h, 'wall')
def wall_y(x, y0, y1, z=0.0, h=1.15, th=.55): w.box(x - th / 2, x + th / 2, y0, y1, z, z + h, 'wall')
wall_x(VX0, VX1, VY0, 3.0, 1.3); wall_y(VX0, VY0, 30.6, 3.0, 1.3); wall_y(VX0, 35.4, VY1, 3.0, 1.3); wall_y(VX1, VY0, VY1, 3.0, 1.3)
for y in (30.6, 35.4): w.box(VX0 - .6, VX0 + .6, y - .6, y + .6, 3.0, 8.2, 'wall')
w.box(VX0 - .4, VX0 + .4, 30.6, 35.4, 8.2, 9.0, 'timber')
def house(x0, x1, y0, y1, z=3.0, wall=5.4, rise=4.2, ridge='x', over=.7):
    w.box(x0, x1, y0, y1, z, z + 1.3, 'wall'); w.box(x0, x1, y0, y1, z + 1.3, z + wall, 'plaster')
    cx, cy, hx, hy = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + over, (y1 - y0) / 2 + over
    for k in range(w.iz(z + wall), w.iz(z + wall + rise)):
        tt = 1 - (w.ZC[k] - z - wall) / rise
        m = (np.abs(XX - cx) <= hx) & (np.abs(YY - cy) <= hy * tt) if ridge == 'x' else (np.abs(XX - cx) <= hx * tt) & (np.abs(YY - cy) <= hy)
        w.V[m, k] = MAT['thatch']
        if ridge == 'y':
            w.V[(np.abs(XX - cx) <= hx * tt - .45) & (YY >= y0 - .1) & (YY < y0 + .3), k] = MAT['plaster']; w.V[(np.abs(XX - cx) <= hx * tt) & (YY < y0 - .1) & (YY > y0 - over - .2), k] = 0
    w.box(x0 + 1.4, x0 + 2.9, y0 - .13, y0 + .1, z + 2.0, z + 3.5, 'glass'); return (x0 + 2.15, y0 - .2, z + 2.7)
WIN = [house(47.0, 56.0, 27.6, 33.4), house(58.2, 65.6, 28.0, 34.0, ridge='y'), house(48.0, 57.0, 37.6, 43.4, ridge='y', rise=4.8), house(59.4, 65.6, 38.6, 43.6)]

# =========================================================================== fields, walls, trees, rocks
def tree(cx, cy, z, h=4.6, r=3.0, mat='leaf'):
    cs = r * .62; sl = lambda x, y, zz: (x, y + cs, zz - cs * .75 / .66)
    w.cone(cx, cy, .55, z, z + h + 1.0, 'trunk', r1=.34)
    w.ball(*sl(cx, cy, z + h + r * .95), r, mat, squash=.78); w.ball(*sl(cx - r * .55, cy + .2, z + h + r * .55), r * .62, mat, squash=.8); w.ball(*sl(cx + r * .6, cy - .1, z + h + r * .6), r * .58, mat, squash=.8)
def fir(cx, cy, z, h=6.5, r=1.6): w.cone(cx, cy, r, z + .7, z + h, 'conifer'); w.cyl(cx, cy, .3, z, z + .7, 'trunk')
def bush(x, y, z=0.0, r=.8): w.ball(x, y, z + r * .45, r, 'bush', squash=.7)
def rock(x, y, z=0.0, r=.9): w.ball(x, y, z + r * .35, r, 'rock', squash=.75)
def haystack(x, y, z=0.0, r=1.5, h=2.6): w.cone(x, y, r, z, z + h, 'hay', r1=.25)
def sheep(x, y, z=0.0): w.ball(x, y, z + .55, .62, 'sheep', squash=.8); w.ball(x + .55, y - .1, z + .75, .3, 'dark')
def wheat(x0, x1, y0, y1, walls='swne', gap=None):
    m = rect(x0, x1, y0, y1) & (LEVEL == 0) & ~ndi.binary_dilation(PATHS, iterations=6)
    w.col(m, 0, .8, 'wheat')
    if 's' in walls: wall_x(x0 - .5, x1 + .5, y0 - .5)
    if 'n' in walls: wall_x(x0 - .5, x1 + .5, y1 + .5)
    if 'w' in walls: wall_y(x0 - .5, y0 - .5, y1 + .5)
    if 'e' in walls: wall_y(x1 + .5, y0 - .5, y1 + .5)
wheat(3.5, 15.5, 19.5, 28.0, 'swn'); wheat(4.0, 16.0, 6.0, 15.0, 'sne'); wheat(30.5, 44.0, 14.5, 20.0, 'sw'); wheat(44.5, 54.0, 12.5, 19.0, 'se')
wheat(5.0, 19.0, 37.4, 41.0, 'sw'); wheat(32.5, 39.5, 1.0, 6.5, 'nw'); wheat(8.0, 26.0, -2.4, 1.6, 'n')
# the broken wall in the north-west and the gap behind it
wall_x(2.0, 13.6, 42.6, h=1.6); wall_x(15.4, 23.0, 42.6, h=1.6)
for x, h in ((13.0, .9), (13.5, .5), (15.5, .6), (16.0, 1.0)): w.box(x, x + .5, 42.3, 42.9, 0, h, 'wall')
rock(14.0, 41.4, r=.5); rock(15.9, 41.3, r=.45)
# the lone cedar
CX_, CY_ = 60.5, 8.6; cs = 3.0
w.cone(CX_, CY_, 1.3, 0, 7.5, 'trunk', r1=.7)
for zc, r in ((6.5, 5.2), (10.0, 4.4), (13.2, 3.4), (16.0, 2.3)): w.cone(CX_, CY_ + cs, r, zc - cs * 1.136, zc + 5.0 - cs * 1.136, 'conifer', r1=.3)
for a, ln in ((-2.6, 3.0), (-.5, 3.4), (.9, 2.6), (2.4, 2.8)): w.limb((CX_ + 1.0 * np.cos(a), CY_ + .8 * np.sin(a), .8), (CX_ + ln * np.cos(a), CY_ + ln * np.sin(a) * .8, .05), .5, .22, 'trunk')
# signpost at the fork, a wayside shrine, a hay cart, haystacks
w.box(25.0, 25.25, 36.2, 36.45, 0, 2.6, 'timber'); w.box(24.2, 26.1, 36.2, 36.45, 1.9, 2.4, 'wood')
w.box(18.0, 19.4, 35.9, 37.0, 0, 1.5, 'tomb'); w.pyramid(17.8, 19.6, 35.7, 37.2, 1.5, 2.3, 'roof')
w.box(34.0, 36.6, 23.0, 24.2, .5, 1.3, 'wood'); w.cyl(34.3, 22.9, .55, 0, 1.1, 'timber'); w.cyl(36.3, 22.9, .55, 0, 1.1, 'timber'); w.ball(35.3, 23.6, 1.7, .9, 'hay', squash=.7)
for x, y in ((18.6, 17.4), (20.0, 5.4), (46.0, 21.0), (56.8, 20.4), (10.4, 30.6)): haystack(x, y, r=rng.uniform(1.2, 1.6), h=rng.uniform(2.0, 2.7))
for x, y in ((6.0, 3.4), (9.4, 4.4), (12.6, 2.8), (40.6, 4.6), (43.6, 2.6), (47.0, 5.0), (24.0, 24.6)): sheep(x, y)
# trees and rocks at the edges of the map and of the fields
for x, y, h, r in ((2.6, 30.0, 4.6, 2.8), (2.4, 16.6, 4.4, 2.6), (21.6, 44.0, 4.2, 2.4), (31.3, 38.2, 4.0, 2.3), (25.0, 8.4, 4.4, 2.7), (50.6, 2.6, 4.6, 2.8), (66.0, 18.4, 4.2, 2.5),
                   (40.6, 23.4, 3.8, 2.1), (2.8, 44.4, 4.0, 2.3), (66.2, 2.4, 4.0, 2.4), (30.6, 8.2, 3.6, 2.0), (17.2, 30.2, 3.8, 2.1)):
    tree(x, y, 0, h=h, r=r)
for x, y, r in ((23.6, 38.6, .9), (31.0, 39.6, 1.1), (24.4, 43.4, .8), (42.4, 40.6, 1.2), (30.6, 44.6, .9), (44.6, 6.4, .8), (57.0, 13.4, 1.0), (64.6, 12.6, .9), (26.0, 20.4, .7), (19.0, 46.0, 1.0)):
    rock(x, y, r=r)
for x, y in ((17.6, 20.6), (17.4, 26.4), (20.2, 9.6), (29.0, 21.0), (42.4, 8.4), (58.4, 16.0), (2.4, 36.6), (9.0, 35.4), (36.4, 9.2), (54.6, 21.4), (1.6, 8.6)): bush(x, y)
for x in np.arange(42.0, 67.5, 2.3):                                    # bushes under the hill's south bank
    if rng.uniform() < .6: bush(x + rng.uniform(-.5, .5), 21.0 + .6 * np.sin(x * .5), r=rng.uniform(.6, .95))
for x in np.arange(1.5, 67.5, 3.2):                                     # firs on top of the cliff (not in front of the path to the abbey)
    xx_ = x + rng.uniform(-.8, .8)
    if 49.5 < xx_ < 57.5 or 20 <= xx_ < 58.5 and rng.uniform() < .35: continue
    fir(xx_, 57.6 + rng.uniform(-.6, 1.6), float(LEVEL[w.ix(min(xx_, 67.9)) - 1, w.iy(58.5)]), h=rng.uniform(5.5, 7.5), r=rng.uniform(1.4, 1.9))
for x, y in ((23.0, 49.6), (33.4, 51.0), (45.6, 50.8), (57.0, 49.4)): rock(x, y, 4.125, r=.8)
bush(31.0, 50.9, 4.125); bush(48.6, 51.0, 4.125)

# =========================================================================== places the game needs
w.mark('exit_village', 43.0, 33, 3.0, title='始まりの村へ'); w.mark('spawn_village', 39.0, 33, 3.0)
w.mark('exit_west', 1.0, 33, 0, title='草の高原へ'); w.mark('spawn_west', 4.0, 33, 0)
w.mark('exit_abbey', 53.5, 58.3, 8.25, title='崖の修道院へ'); w.mark('spawn_abbey', 53.5, 56.6, 8.25)
w.mark('spawn_ledge', 38.6, 45.0, LZ); w.mark('chest_ledge', 35.4, 44.8, LZ)
w.mark('hide_wall', 9.0, 44.4, 0, title='崩れた石垣の裏'); w.mark('cedar', 59.4, 6.6, 0, title='一本杉の根もと')
w.mark('sign', 25.1, 35.4, 0, title='道しるべ'); w.mark('shrine', 18.7, 35.0, 0, title='道ばたのほこら')
for i, (x, y, z) in enumerate(WIN): w.mark('win%d' % i, x, y, z, light=dict(color='#ffb26a', r=110, intensity=.7))
w.mark('fx_cedar', 60, 9, 0); w.mark('fx_road', 20, 33, 0); w.mark('fx_shelf', 40, 49, 4.125); w.mark('fx_fields', 12, 12, 0)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    info = bake(w, out, spawn=(4.0, 33.0), also=((38.6, 45.0),), **MAP)
    print('marks not on walkable ground:', [k for k, v in info['marks'].items() if not k.startswith(('win', 'fx')) and not v['on_ground']])
