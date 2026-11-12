"""Blockout of F02 草の高原 (the second field): a bare, wind-blown grass plateau between the wheat hills and the capital.
   The plateau is z 0.  The highway crosses it from the east edge (to F01) and bends north to the capital's gate in the
   north-west corner (a long town wall with the roofs behind it: scenery; the gate is the way in).
   In the middle, north of the road: the white gate of 楔の遺跡 on a low paved forecourt, set into a grassy barrow.
   South: the plateau breaks off; under the cliff lies the great forest (z -7).  One track goes down a ramp to it.
   Under the cliff, a shelf where a chest will stand that is entered from the forest map (nothing is placed there yet).
   North-east: the great boulder with a hidden nook behind it.
   The road and the open grass are wide and empty; rocks, standing stones and wind-bent trees make the edges.
usage: python3 f02_world.py out_dir"""
import sys, os, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vox
from vox import World, bake, MAT, VPU

for name, idx, col in (('wheat', 26, (214, 186, 96)), ('thatch', 27, (150, 124, 70)), ('plaster', 28, (222, 208, 180)), ('soil', 29, (120, 88, 62)),
                       ('leaf', 30, (64, 122, 58)), ('hay', 31, (226, 196, 110)), ('sheep', 32, (240, 236, 226)), ('timber', 33, (92, 64, 44)),
                       ('cloth', 34, (150, 70, 60)), ('bush', 35, (86, 140, 70)), ('yard', 36, (186, 166, 132)),
                       ('white', 37, (236, 232, 218)), ('tile', 38, (158, 84, 62)), ('canopy', 39, (44, 96, 60)), ('under', 40, (58, 84, 52))):
    MAT[name] = idx; vox.COLOR[idx] = col
SOFT = ('leaf', 'bush', 'conifer', 'canopy', 'under', 'water', 'trunk', 'cloth')      # for solids.py
CAPS = ('roof', 'tile')

w = World(x=(0, 72), y=(-8, 58), z=(-9, 27)); XX, YY = w.XX, w.YY
rng = np.random.default_rng(33)
MAP = dict(W=2304, H=1728, SY0=1392)
n1 = ndi.gaussian_filter(rng.standard_normal(XX.shape), 10); n1 /= np.abs(n1).max()
n2 = ndi.gaussian_filter(rng.standard_normal(XX.shape), 4); n2 /= np.abs(n2).max()

# =========================================================================== ground
RX0, RX1 = 49.5, 55.5                                                   # the ramp down to the forest
EDGE = 9.0 + 1.6 * n1 + .5 * np.sin(XX * .6)                             # the plateau's southern rim
EDGE = np.where((XX > RX0 - 3) & (XX < RX1 + 3), 9.0, EDGE)
LOW = YY < EDGE
RAMP = (XX >= RX0) & (XX < RX1) & (YY >= -3.0) & (YY < 13.0)
SHELF = (XX >= 13.0) & (XX < 21.0) & (YY >= 4.4) & LOW                   # the shelf under the cliff (its chest comes with the forest map)
LEVEL = np.zeros(XX.shape)
LEVEL[LOW] = -7.0
LEVEL[SHELF] = -3.5
t = np.clip((13.0 - YY) / 16.0, 0, 1)
LEVEL[RAMP] = (np.round(-7.0 * t * VPU) / VPU)[RAMP]
for lv in np.unique(LEVEL):
    m = LEVEL == lv
    w.col(m, w.Z0, lv, 'rock'); w.col(m, lv - 1 / VPU, lv, 'grass')
for k in range(w.iz(-7), w.iz(0)):                                       # the cliff leans back and breaks into ledges
    z = w.ZC[k]
    inset = 0.16 * (z + 7) + 0.4 * (np.floor(z / 1.8) % 2) + 0.3 * np.sin(XX * 1.3 + np.floor(z / 1.3) * 1.9)
    cut = ~LOW & ~RAMP & (YY < EDGE + 1.4 - inset) & (YY >= EDGE) & (w.V[:, :, k] > 0) & ~((XX > RX0 - 1.2) & (XX < RX1 + 1.2))
    w.V[cut, k] = 0
# the ramp's flanks: rock banks so that one cannot step off it
for x0, x1 in ((RX0 - 1.0, RX0), (RX1, RX1 + 1.0)):
    m = (XX >= x0) & (XX < x1) & (YY >= -3.0) & (YY < 9.0)
    for lv in np.unique(LEVEL[RAMP]):
        mm = m & (np.round(-7.0 * t * VPU) / VPU == lv); w.col(mm, w.Z0, lv + .8, 'rock')

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

# =========================================================================== the highway and the tracks (wide, empty)
GX = 11.0                                                               # the capital's gate
path([(72, 30), (58, 29), (46, 31.2), (36, 30.6), (24, 29.4), (15, 30.4), (GX, 34), (GX, 41.5)], 4.6)
path([(36, 30.6), (36, 37.6)], 3.6)                                     # to the white gate
path([(52.5, 29.6), (52.5, 13.0)], 3.2)                                 # to the ramp
m = RAMP & (XX >= RX0 + .6) & (XX < RX1 - .6); top(m, 'path'); PATHS |= m
path([(52.5, -3.0), (52.5, -8.0)], 3.6)                                 # on, into the forest
path([(58, 29), (60, 38), (58.5, 42.0)], 2.6)                           # a faint track to the great boulder
# the forest floor under the cliff is undergrowth: only the track is a way
m = LOW & ~SHELF & ~PATHS & ~RAMP; w.col(m, -7.0 - 1 / VPU, -7.0 + .25, 'under')
# a small tarn in the south-east
PX, PY, PA, PB = 64.0, 19.0, 4.2, 2.5
pond = ((XX - PX) / PA) ** 2 + ((YY - PY) / PB) ** 2
w.col(pond <= 1.0, -.25, 0, 0); w.col(pond <= 1.0, -.375, -.25, 'water')

# =========================================================================== the white gate of the ruin (楔の遺跡)
FX0, FX1, FY0, FY1, FZ = 30.0, 42.0, 38.6, 45.4, .75                    # paved forecourt, two steps up
w.box(FX0, FX1, FY0, FY1, 0, FZ - 1 / VPU, 'white'); w.box(FX0, FX1, FY0, FY1, FZ - 1 / VPU, FZ, 'floor')
w.stairs_n(34.0, 38.0, FY0, 0.0, FZ, side=0, side_h=0)
# the barrow the gate is set into: a long grassy mound behind the forecourt
for k in range(w.iz(0), w.iz(6.4)):
    z = w.ZC[k]; s = np.sqrt(max(0.0, 1 - (z / 6.4) ** 2))
    m = (((XX - 36.0) / (9.5 * s + .01)) ** 2 + ((YY - 50.6) / (5.4 * s + .01)) ** 2) <= 1
    w.V[m & (YY >= FY1) & (w.V[:, :, k] == 0), k] = MAT['grass'] if z > .3 else MAT['rock']
# the gate itself: two heavy pylons, a lintel, a pediment stone, the dark way down between them
for x0, x1 in ((32.6, 34.6), (37.4, 39.4)): w.box(x0, x1, FY1 - 1.2, FY1 + .6, FZ, FZ + 6.6, 'white')
w.box(32.2, 39.8, FY1 - 1.4, FY1 + .6, FZ + 6.6, FZ + 8.0, 'white'); w.box(33.6, 38.4, FY1 - 1.2, FY1 + .4, FZ + 8.0, FZ + 8.8, 'white')
w.box(34.6, 37.4, FY1 - .6, FY1 + .6, FZ, FZ + 6.6, 'dark')
# columns along the forecourt, some broken; fallen drums
for x, y, h in ((30.8, 39.6, 5.2), (30.8, 43.6, 2.2), (41.2, 39.6, 1.4), (41.2, 43.6, 5.2), (28.0, 41.0, 3.4), (44.0, 42.0, .9)):
    z0 = FZ if FX0 <= x < FX1 else 0
    w.cyl(x, y, .62, z0, z0 + h, 'white'); w.cyl(x, y, .8, z0, z0 + .4, 'white')
    if h > 5: w.box(x - .85, x + .85, y - .85, y + .85, z0 + h, z0 + h + .45, 'white')
for x, y in ((43.4, 38.0), (27.2, 38.2), (45.6, 44.6)): w.ball(x, y, .45, .7, 'white', squash=.8)
# what is left of an adventurer, at the foot of the steps: a pack and a sword stuck in the ground (no body is drawn)
w.ball(33.0, 36.6, .3, .5, 'cloth', squash=.8); w.box(32.2, 32.32, 36.5, 36.62, 0, 1.3, 'iron'); w.box(32.0, 32.52, 36.5, 36.62, .95, 1.05, 'iron')

# =========================================================================== the capital: wall, gate and roofs in the north-west corner (scenery)
WY = 42.0; WH = 7.0
w.box(0, 26.0, WY, WY + 1.6, 0, WH, 'wall')
for x in np.arange(0.2, 26.0, 1.4): w.box(x, x + .8, WY, WY + .5, WH, WH + .7, 'wall')          # battlements
w.box(25.0, 26.6, WY, 58, 0, WH, 'wall')
for x in (GX - 4.2, GX + 2.2, 24.4):                                     # gate towers and the corner tower
    w.box(x, x + (2.0 if x < 20 else 2.6), WY - .6, WY + 2.2, 0, WH + 3.0, 'wall')
    w.pyramid(x - .3, x + (2.3 if x < 20 else 2.9), WY - .9, WY + 2.5, WH + 3.0, WH + 5.4, 'tile')
w.arch_y(GX, 4.0, WY - .1, WY + 1.7, 0, 3.4, MAT['dark'])
w.box(GX - 2.0, GX + 2.0, WY - 1.0, WY + 1.7, 0 - 1 / VPU, 0, 'floor')
def town_house(x0, x1, y0, y1, wall=8.6, rise=3.4, ridge='x'):
    w.box(x0, x1, y0, y1, 0, wall, 'plaster')
    cx, cy, hx, hy = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + .5, (y1 - y0) / 2 + .5
    for k in range(w.iz(wall), w.iz(wall + rise)):
        tt = 1 - (w.ZC[k] - wall) / rise
        m = (np.abs(XX - cx) <= hx) & (np.abs(YY - cy) <= hy * tt) if ridge == 'x' else (np.abs(XX - cx) <= hx * tt) & (np.abs(YY - cy) <= hy)
        w.V[m, k] = MAT['tile']
town_house(1.0, 8.0, 46.0, 51.0); town_house(9.6, 16.0, 47.0, 52.0, wall=9.6, ridge='y'); town_house(17.2, 24.0, 46.0, 51.4, wall=8.0)
town_house(2.0, 10.0, 53.0, 57.6, wall=10.4); town_house(12.0, 23.6, 53.6, 57.8, wall=11.0)
w.box(19.0, 21.6, 54.2, 56.8, 0, 17.0, 'wall'); w.pyramid(18.6, 22.0, 53.8, 57.2, 17.0, 20.6, 'tile')      # the clock tower, far off

# =========================================================================== rocks, standing stones, wind-bent trees
def tree(cx, cy, z, h=4.6, r=3.0, mat='leaf', lean=0.0):
    cs = r * .62; sl = lambda x, y, zz: (x + lean, y + cs, zz - cs * .75 / .66)
    w.limb((cx, cy, z), (cx + lean, cy, z + h + 1.0), .55, .34, 'trunk')
    w.ball(*sl(cx, cy, z + h + r * .95), r, mat, squash=.78); w.ball(*sl(cx - r * .55, cy + .2, z + h + r * .55), r * .62, mat, squash=.8); w.ball(*sl(cx + r * .6, cy - .1, z + h + r * .6), r * .58, mat, squash=.8)
def bush(x, y, z=0.0, r=.8): w.ball(x, y, z + r * .45, r, 'bush', squash=.7)
def rock(x, y, z=0.0, r=.9): w.ball(x, y, z + r * .35, r, 'rock', squash=.75)
def stone(x, y, h=2.6, th=.8): w.box(x - th / 2, x + th / 2, y - .3, y + .3, 0, h, 'tomb')
# the great boulder and the nook behind it (rocks close its sides: the way in is round the east end)
BX, BY = 57.0, 47.0
w.ball(BX, BY, 1.4, 4.2, 'rock', squash=.8); w.ball(BX - 3.4, BY + .6, .9, 2.4, 'rock', squash=.8); w.ball(BX + 3.6, BY - .4, .6, 1.5, 'rock', squash=.8)
for x, y, r in ((BX - 5.6, BY + 3.0, 1.5), (BX - 4.6, BY + 5.4, 1.3), (BX - 2.2, BY + 6.6, 1.2), (BX + .6, BY + 6.8, 1.3)): rock(x, y, r=r)
# the north rim: low rock outcrops, boulders
for x in np.arange(28.0, 72.0, 3.4):
    xx_ = x + rng.uniform(-.8, .8); yy_ = 55.6 + rng.uniform(-.8, 1.2)
    if abs(xx_ - 36) < 9.0: yy_ = 57.2
    w.ball(xx_, yy_, .6, rng.uniform(1.4, 2.4), 'rock', squash=.8)
# standing stones on the rim above the forest (a lookout)
for x, y, h in ((18.6, 13.4, 3.0), (21.4, 14.2, 2.4), (15.8, 14.0, 1.6), (23.4, 12.6, 1.1)): stone(x, y, h)
# a milestone by the fork, a cairn by the ramp
w.box(38.6, 39.3, 32.9, 33.5, 0, 1.5, 'tomb'); w.cone(55.6, 15.6, .9, 0, 1.5, 'tomb', r1=.25)
for x, y, h, r, ln in ((46.0, 40.6, 3.6, 2.2, 1.0), (68.6, 22.6, 3.4, 2.1, 1.1), (5.6, 20.4, 3.6, 2.3, .9), (68.0, 43.0, 3.2, 2.0, 1.0), (27.6, 20.6, 3.0, 1.9, 1.0),
                      (2.6, 34.6, 3.6, 2.2, .7), (40.6, 14.4, 3.2, 2.0, 1.1)):
    tree(x, y, 0, h=h, r=r, lean=ln)
for x, y, r in ((6.4, 12.6, 1.1), (30.0, 12.4, .9), (44.6, 11.6, 1.2), (62.6, 12.2, 1.0), (69.6, 14.0, .8), (10.0, 25.0, .8), (20.4, 35.6, .9), (26.4, 37.0, .7),
                (48.0, 24.4, .9), (64.0, 34.0, 1.0), (70.0, 36.6, .9), (41.6, 23.6, .7), (16.0, 22.6, .7), (59.0, 21.0, .8), (33.0, 24.6, .6), (50.6, 37.4, .8),
                (66.4, 50.0, 1.1), (47.6, 50.6, 1.0), (4.4, 28.0, .8), (17.4, 38.6, .9), (58.6, 13.4, .7), (36.0, 12.6, .8)):
    rock(x, y, r=r)
for x, y in ((8.6, 14.0), (12.4, 21.0), (25.0, 14.6), (33.4, 21.4), (46.4, 17.0), (68.0, 16.4), (68.4, 25.4), (64.6, 40.0), (44.0, 36.0), (23.0, 24.4), (6.0, 38.6),
             (70.4, 46.6), (49.0, 44.6), (28.6, 34.4), (42.4, 27.0)):
    bush(x, y, r=rng.uniform(.6, .9))
# the forest under the cliff: a roof of crowns just below the rim
for x in np.arange(1.5, 72.0, 3.3):
    for y in np.arange(-7.0, 7.0, 3.0):
        xx_, yy_ = x + rng.uniform(-.9, .9), y + rng.uniform(-.8, .8)
        if RX0 - 3.6 < xx_ < RX1 + 3.6: continue
        if 11.0 < xx_ < 23.0 and yy_ > 1.5: continue
        if yy_ > 9.0 + 1.6 * n1[w.ix(xx_) - 1, w.iy(yy_)] - 3.2: continue
        r = rng.uniform(2.1, 2.7); h = rng.uniform(2.2, 3.0)
        w.cyl(xx_, yy_, .4, -7.0, -7.0 + h + 1, 'trunk'); w.ball(xx_, yy_ + r * .5, -7.0 + h + r * .55, r, 'canopy', squash=.75)
rock(14.2, 7.8, -3.5, r=.8); bush(19.8, 8.0, -3.5)

# =========================================================================== places the game needs
w.mark('exit_east', 71.0, 30, 0, title='麦の丘へ'); w.mark('spawn_east', 68.0, 30, 0)
w.mark('exit_capital', GX, 42.2, 0, title='王都へ'); w.mark('spawn_capital', GX, 39.0, 0)
w.mark('exit_south', 52.5, -6.6, -7.0, title='大樹の森へ'); w.mark('spawn_south', 52.5, -3.4, -7.0)
w.mark('ruin', 36.0, 44.2, FZ, title='白い門'); w.mark('remains', 32.8, 35.8, 0, title='倒れた冒険者の荷物')
w.mark('hide_rock', BX - 1.6, BY + 4.2, 0, title='大岩の裏'); w.mark('rock_front', BX, BY - 5.2, 0, title='大岩')
w.mark('lookout', 19.6, 12.2, 0, title='崖のふち'); w.mark('milestone', 39.0, 32.2, 0, title='道しるべ'); w.mark('ramp_top', 52.5, 14.0, 0, title='森への下り坂')
w.mark('shelf', 17.0, 6.6, -3.5)
w.mark('pond', PX, PY, 0)
w.marks['pond']['poly'] = [(PX + PA * np.cos(a), PY + PB * np.sin(a), -.25) for a in np.linspace(0, 2 * np.pi, 28, endpoint=False)]
w.mark('fx_ruin', 36, 41, FZ); w.mark('fx_road', 30, 30, 0); w.mark('fx_east', 60, 30, 0); w.mark('fx_rim', 30, 14, 0); w.mark('fx_gate', 11, 38, 0)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    info = bake(w, out, spawn=(68.0, 30.0), also=((17.0, 6.6),), **MAP)
    print('marks not on walkable ground:', [k for k, v in info['marks'].items() if not k.startswith(('win', 'fx')) and not v['on_ground']])
