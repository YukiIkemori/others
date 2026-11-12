"""Blockout of 王都 城門前の広場 (M03): the square in front of the castle gate, the second map of the capital.
   South: the landing of the big stairs from 南の大通り.  Middle: the paved square with its fountain.
   North: the city wall with the north gate (to F03).  North-east: the castle's own wall with its great gate (never opens).
   North-west: the clock tower; an outer stair beside it climbs to the walk on top of the city wall, where a chest stands
   (seen from the square, reached only by the stair).  South-west: the way down to the sewers (王都の地下水路).
   The square is wide and empty; lamps, benches, planters and trees stand at its edges.
usage: python3 plaza_world.py out_dir"""
import sys, os, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vox
from vox import World, bake, MAT, VPU

for name, idx, col in (('plaster', 28, (222, 208, 180)), ('leaf', 30, (64, 122, 58)), ('timber', 33, (92, 64, 44)), ('cloth', 34, (150, 70, 60)),
                       ('bush', 35, (86, 140, 70)), ('yard', 36, (186, 166, 132)), ('white', 37, (236, 232, 218)), ('tile', 38, (158, 84, 62)),
                       ('cobble', 41, (150, 146, 150)), ('cloth2', 42, (70, 96, 130)), ('slate', 43, (84, 92, 124)), ('keep', 44, (170, 164, 172))):
    MAT[name] = idx; vox.COLOR[idx] = col
vox.WALKABLE = tuple(vox.WALKABLE) + (MAT['yard'], MAT['cobble'])
SOFT = ('leaf', 'bush', 'water', 'trunk', 'cloth', 'cloth2')            # for solids.py
CAPS = ('roof', 'tile', 'slate')

w = World(x=(0, 64), y=(-6, 58), z=(-4, 30)); XX, YY = w.XX, w.YY
rng = np.random.default_rng(12)
MAP = dict(W=2048, H=1600, SY0=1450)      # the top edge of the picture is the top of the city wall's parapet: no sky
w.col(np.ones(XX.shape, bool), w.Z0, 0, 'rock'); w.col(np.ones(XX.shape, bool), -1 / VPU, 0, 'cobble')
def top(mask, mat): w.col(mask, -1 / VPU, 0, mat)
def rect(x0, x1, y0, y1): return (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1)

# =========================================================================== the square (flagstones; wide, empty)
top(rect(12, 52, 10, 40), 'floor'); top(rect(27.5, 36.5, -6, 10), 'floor'); top(rect(29, 35, 40, 50), 'floor')
FX, FY = 32.0, 25.0                                                     # the fountain
w.cyl(FX, FY, 3.6, 0, .9, 'wall'); w.cyl(FX, FY, 3.0, .45, .9, 0); w.cyl(FX, FY, 3.0, .3, .45, 'water')
w.cyl(FX, FY, .7, .3, 2.6, 'white'); w.cyl(FX, FY, 1.5, 2.6, 2.9, 'white'); w.cyl(FX, FY, .35, 2.9, 4.0, 'white'); w.ball(FX, FY, 4.2, .5, 'white')

# =========================================================================== walls
WY, WH, WT = 50.0, 6.75, 2.6                                            # the city wall: its top is a walk
w.box(0, 64, WY, WY + WT, 0, WH - 1 / VPU, 'wall'); w.box(0, 64, WY, WY + WT, WH - 1 / VPU, WH, 'floor')
w.box(0, 64, WY + WT - .5, WY + WT, WH, WH + 2.0, 'wall')                # the parapet on the outer side
for x in np.arange(0.2, 64, 1.4): w.box(x, x + .8, WY + WT - .5, WY + WT, WH + 2.0, WH + 2.7, 'wall')
GX = 32.0                                                               # the north gate
for x in (GX - 5.4, GX + 2.8):
    w.box(x, x + 2.6, WY - .7, WY + WT + .4, 0, WH + 2.2, 'wall'); w.pyramid(x - .3, x + 2.9, WY - 1.0, WY + WT + .7, WH + 2.2, WH + 3.8, 'tile')
w.arch_y(GX, 4.4, WY - .1, WY + WT + .1, 0, 3.4, MAT['dark']); w.box(GX - 2.8, GX + 2.8, WY - .2, WY + WT, WH, WH + 1.6, 'wall')
w.box(1.0, 2.6, -6, WY, 0, WH, 'wall')                                  # west wall (seen from the side)
for y in np.arange(-5.6, WY, 1.4): w.box(1.0, 1.5, y, y + .8, WH, WH + .6, 'wall')
# the castle: its wall closes the north-east, the great gate faces the square
CY, CH = 41.0, 10.0
w.box(41.0, 64, CY, CY + 2.0, 0, CH, 'keep')
for x in np.arange(41.2, 64, 1.5): w.box(x, x + .9, CY, CY + .5, CH, CH + .8, 'keep')
CGX = 51.5
for x in (CGX - 6.2, CGX + 3.2):
    w.box(x, x + 3.0, CY - .9, CY + 2.6, 0, CH + 3.0, 'keep'); w.cone(x + 1.5, CY + .85, 2.3, CH + 3.0, CH + 6.4, 'slate')
w.arch_y(CGX, 5.2, CY - .14, CY + .2, 0, 4.2, MAT['wood']); w.box(CGX - 3.4, CGX + 3.4, CY - 1.0, CY - .14, 0, .25, 'floor')
w.box(41.0, 43.0, CY, WY, 0, CH, 'keep')
w.box(47.0, 60.0, 45.0, 49.6, 0, 11.0, 'keep'); w.pyramid(46.6, 60.4, 44.6, 50.0, 11.0, 14.0, 'slate')        # the keep behind the wall
for x in (45.2, 58.8): w.cyl(x + 1.5, 47.4, 1.7, 0, 12.0, 'keep'); w.cone(x + 1.5, 47.4, 2.1, 12.0, 14.8, 'slate')
top(rect(43.0, 64, CY + 2.0, WY), 'yard')

# =========================================================================== the clock tower and the stair to the wall walk
TX0, TX1, TY0, TY1 = 4.0, 10.4, 41.0, 47.4
w.box(TX0, TX1, TY0, TY1, 0, 14.0, 'wall'); w.box(TX0 - .3, TX1 + .3, TY0 - .3, TY1 + .3, 14.0, 14.6, 'wall')
w.pyramid(TX0 - .5, TX1 + .5, TY0 - .5, TY1 + .5, 14.6, 18.0, 'slate')
for k in range(w.iz(9.9), w.iz(13.3)):                                   # the clock face
    hw = np.sqrt(max(0.0, 1.7 ** 2 - (w.ZC[k] - 11.6) ** 2)); w.V[w.ix(7.2 - hw):w.ix(7.2 + hw), w.iy(TY0 - .14):w.iy(TY0), k] = MAT['white']
w.arch_y(7.2, 1.9, TY0 - .14, TY0 + .1, 0, 2.9, MAT['wood'])
SX0, SX1 = 11.4, 14.2
w.stairs_n(SX0, SX1, WY, 0.0, WH)
w.box(SX0, SX1, WY, WY + 1.0, WH, WH + 3, 0)
# the top of the stair, beside the tower's belfry window: the "crown" of the rumour
w.box(TX1 - .1, TX1 + .05, 44.0, 45.4, 8.6, 10.2, 'dark')

# =========================================================================== houses round the square
WIN = []
def house(x0, x1, y0, y1, z=0.0, wall=8.4, rise=3.6, ridge='x', door=None, wins=(), upper=(), chimney=None, base=1.3, over=.6, body='plaster', dw=2.3):
    w.box(x0, x1, y0, y1, z, z + base, 'wall'); w.box(x0, x1, y0, y1, z + base, z + wall, body)
    for x in (x0, x1 - .35): w.box(x, x + .35, y0 - .06, y0 + .3, z + base, z + wall, 'timber')
    w.box(x0, x1, y0 - .06, y0 + .3, z + wall - .4, z + wall, 'timber')
    if wall >= 7.6: w.box(x0, x1, y0 - .06, y0 + .3, z + 4.5, z + 4.8, 'timber')
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
    for wx_, wz in list(wins) + [(x_, 5.4) for x_ in upper if wall >= 7.6]:
        w.box(wx_ - .7, wx_ + .7, y0 - .13, y0 + .1, z + wz, z + wz + 1.6, 'glass'); WIN.append((wx_, y0 - .2, z + wz + .8))
    if chimney: w.box(chimney[0] - .5, chimney[0] + .5, chimney[1] - .5, chimney[1] + .5, z + wall, z + wall + rise + 1.2, 'wall')
house(16.0, 27.0, 42.4, 48.0, wall=7.0, rise=3.0, door=21.5, wins=((18.2, 2.0), (24.8, 2.0)), upper=(18.2, 21.5, 24.8), chimney=(25.4, 46.6))     # north side, between the stair and the gate
house(3.4, 10.6, 26.0, 33.0, ridge='y', wall=8.0, rise=4.2, wins=((5.6, 2.0), (8.6, 2.0)), upper=(5.6, 8.6))                           # west side
house(3.4, 10.6, 12.0, 20.0, wall=8.6, door=7.0, wins=((5.0, 2.0), (9.2, 2.0)), upper=(5.0, 7.0, 9.2))
house(53.6, 62.4, 26.0, 33.4, ridge='y', wall=8.4, rise=4.2, door=58.0, wins=((55.6, 2.0), (60.4, 2.0)), upper=(55.8, 60.2))            # east side
house(53.6, 62.4, 12.0, 20.0, wall=9.0, wins=((55.8, 2.0), (60.2, 2.0)), upper=(55.8, 58.0, 60.2), chimney=(61.0, 18.0))
house(3.4, 13.0, -3.0, 4.4, wall=6.0, rise=3.0, wins=((5.6, 2.0), (10.8, 2.0)), upper=(5.6, 8.2, 10.8))                                          # south-west and south-east corners
house(38.6, 49.4, -3.0, 4.4, ridge='y', wall=5.6, rise=3.4, door=44.0, wins=((40.8, 2.0), (47.2, 2.0)), upper=(41.0, 47.0))
house(51.4, 62.4, -3.0, 4.4, wall=6.0, rise=3.0, wins=((53.8, 2.0), (60.0, 2.0)), upper=(53.8, 56.9, 60.0))
w.box(62.9, 64, -6, CY, 0, 3.0, 'wall')                                  # a garden wall closes the east edge

# =========================================================================== the way down to the sewers (south-west)
DX0, DX1, DY0, DY1 = 17.0, 21.4, 2.0, 6.4
w.box(DX0 - .5, DX1 + .5, DY0, DY1 + .5, 0, 1.1, 'wall'); w.box(DX0, DX1, DY0 - .1, DY1, 0, 1.2, 0)
w.box(DX0, DX1, DY0 + .4, DY1, -3, -.05, 'dark'); w.box(DX0, DX1, DY0 - .1, DY0 + .4, -1 / VPU, 0, 'stair')
for i in range(5): w.box(DX0, DX1, DY0 + .4 + i * .5, DY0 + .9 + i * .5, -3, -.3 - i * .45, 'stair')
for x in (DX0 - .25, DX1 + .25): w.box(x - .08, x + .08, DY0 - .1, DY0 + .06, 0, 1.9, 'iron')
w.box(DX0 - .25, DX1 + .25, DY0 - .1, DY0 + .06, 1.8, 1.95, 'iron')

# =========================================================================== lamps, benches, planters, trees
def tree(cx, cy, z, h=4.6, r=3.0, mat='leaf'):
    cs = r * .62; sl = lambda x, y, zz: (x, y + cs, zz - cs * .75 / .66)
    w.cone(cx, cy, .55, z, z + h + 1.0, 'trunk', r1=.34)
    w.ball(*sl(cx, cy, z + h + r * .95), r, mat, squash=.78); w.ball(*sl(cx - r * .55, cy + .2, z + h + r * .55), r * .62, mat, squash=.8); w.ball(*sl(cx + r * .6, cy - .1, z + h + r * .6), r * .58, mat, squash=.8)
def barrel(x, y, z=0.0, h=1.15, r=.5): w.cyl(x, y, r, z, z + h, 'wood')
def crate(x, y, z=0.0, s=.55, h=.9): w.box(x - s, x + s, y - s, y + s, z, z + h, 'wood')
def bush(x, y, z=0.0, r=.8): w.ball(x, y, z + r * .45, r, 'bush', squash=.7)
def planter(x, y, z=0.0, l=1.6): w.box(x - l / 2, x + l / 2, y - .4, y + .4, z, z + .6, 'wall'); w.box(x - l / 2 + .1, x + l / 2 - .1, y - .3, y + .3, z + .6, z + 1.1, 'bush')
def bench(x, y, z=0.0): w.box(x - 1.0, x + 1.0, y - .3, y + .3, z, z + .5, 'wood')
for x, y in ((13.0, 11.0), (13.0, 39.0), (51.0, 11.0), (51.0, 39.0), (13.0, 25.0), (51.0, 25.0), (27.0, 39.6), (37.0, 39.6), (27.0, 10.4), (37.0, 10.4), (26.6, 2.0), (37.4, 2.0)):
    w.lantern(x, y, 3.7, post=0, r=160)
for x, y in ((CGX - 4.4, CY - 1.4), (CGX + 4.4, CY - 1.4)): w.lantern(x, y, 4.2, post=0, r=170)
for x, y in ((20.0, 40.6), (44.0, 9.4), (20.0, 9.4), (40.0, 40.4)): bench(x, y)
for x, y in ((16.0, 40.8), (24.0, 40.8), (16.0, 9.2), (24.0, 9.2), (40.0, 9.2), (48.0, 9.2), (11.4, 17.0), (11.4, 30.0), (52.6, 17.0), (52.6, 30.0)): planter(x, y)
for x, y, h, r in ((7.0, 36.6, 4.0, 2.4), (57.6, 37.0, 4.0, 2.3), (15.0, 5.0, 3.6, 2.0), (24.4, 4.4, 3.6, 2.1), (36.6, 45.4, 3.4, 1.9), (12.6, 22.6, 3.6, 2.0), (51.6, 22.4, 3.6, 2.0)):
    tree(x, y, 0, h=h, r=r)
for x, y in ((4.0, 8.4), (4.0, 23.4), (60.6, 8.6), (60.6, 23.0), (28.0, 46.0), (38.6, 48.6), (15.4, 47.6)): bush(x, y)
barrel(11.6, 11.6); crate(10.9, 13.0); barrel(27.8, 43.0); crate(53.0, 34.6); barrel(52.8, 36.0)
for x in (18.0, 21.0): crate(x, WY + 1.6, WH, s=.5, h=.8)                # on the wall walk, behind which the chest stands
barrel(60.0, WY + 1.5, WH)

# =========================================================================== places the game needs
w.mark('exit_south', 32, -5.2, 0, title='南の大通りへ'); w.mark('spawn_south', 32, -1.6, 0)
w.mark('exit_north', GX, WY + .4, 0, title='北の街道へ'); w.mark('spawn_north', GX, 47.0, 0)
w.mark('castle', CGX, CY - 1.6, 0, title='お城の門'); w.mark('sewer', (DX0 + DX1) / 2, DY0 - 1.0, 0, title='水路の降り口')
w.mark('fountain', FX, FY - 4.4, 0, title='噴水')
w.marks['fountain']['poly'] = [(FX + 3.0 * np.cos(a), FY + 3.0 * np.sin(a), .45) for a in np.linspace(0, 2 * np.pi, 28, endpoint=False)]
w.mark('nest', SX0 + .6, WY + 1.3, WH, title='時計塔のてっぺん'); w.mark('chest_wall', 24.0, WY + 1.3, WH)
w.mark('wall_below', 24.0, WY - 1.2, 0, title='城壁の下')
for nm, x, y in (('npc_guard', CGX - 3.6, CY - 2.4), ('npc_toto', DX1 + 1.8, DY0 - .6), ('npc_elma', FX + 2.6, FY - 4.2)): w.mark(nm, x, y, 0)
for i, (x, y, z) in enumerate(WIN): w.mark('win%d' % i, x, y, z, light=dict(color='#ffb26a', r=110, intensity=.7))
w.mark('fx_square', 32, 25, 0); w.mark('fx_gate', 51, 36, 0); w.mark('fx_south', 32, 4, 0); w.mark('fx_wall', 30, WY + 1, WH)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    info = bake(w, out, spawn=(32.0, -1.6), **MAP)
    bad = [k for k, v in info['marks'].items() if (k.startswith(('npc', 'exit', 'spawn', 'chest', 'nest', 'castle', 'sewer', 'fountain', 'clock'))) and not v['on_ground']]
    print('marks not on walkable ground:', bad)
