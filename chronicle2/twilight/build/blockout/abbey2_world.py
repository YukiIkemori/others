"""Blockout of 崖の修道院 マップ2 身廊と回廊の泉: the inner abbey behind the ruined nave of map 1.
   West: the long nave, its roof fallen in (so one looks into it from above): pillars, pews, a carpet up the aisle.
   Its north end is the raised chancel with the altar, where the mid-boss 鐘守りの大烏 waits; behind it a chest, the save
   crystal and the door to the bell tower (map 3).
   East: the cloister, a square garden with a spring, a paved walk round it behind rows of pillars.  Over its north walk
   runs a gallery (the "second floor") with a chest that is reached only from map 3.
   South: the forecourt and the small door back to map 1 (behind its altar).  The front walls are broken low so that
   nothing hides the floor.  Aisles and walks are wide and empty.
usage: python3 abbey2_world.py out_dir"""
import sys, os, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vox
from vox import World, bake, MAT, VPU

for name, idx, col in (('leaf', 30, (64, 122, 58)), ('timber', 33, (92, 64, 44)), ('bush', 35, (86, 140, 70)), ('white', 37, (236, 232, 218)), ('pew', 45, (120, 84, 56)),
                       ('ivy', 46, (70, 110, 66)), ('candle', 47, (250, 226, 150))):
    MAT[name] = idx; vox.COLOR[idx] = col
SOFT = ('leaf', 'bush', 'water', 'trunk', 'ivy', 'conifer')              # for solids.py
CAPS = ('roof',)

w = World(x=(0, 48), y=(-4, 56), z=(-4, 26)); XX, YY = w.XX, w.YY
rng = np.random.default_rng(17)
MAP = dict(W=1536, H=1552, SY0=1456)
def rect(x0, x1, y0, y1): return (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1)
ALL = np.ones(XX.shape, bool)
w.col(ALL, w.Z0, 0, 'rock'); w.col(ALL, -1 / VPU, 0, 'grass')
def top(mask, mat, z=0.0): w.col(mask, z - 1 / VPU, z, mat)

# =========================================================================== the rock behind the abbey closes the top of the picture
n1 = ndi.gaussian_filter(rng.standard_normal(XX.shape), 8); n1 /= np.abs(n1).max()
CL = 50.0 + .8 * n1
for k in range(w.iz(0), w.iz(13)):
    z = w.ZC[k]; inset = 0.2 * z + 0.5 * (np.floor(z / 2.2) % 2) + 0.35 * np.sin(XX * 1.3 + np.floor(z / 1.4) * 1.9)
    w.V[(YY >= CL + inset), k] = MAT['rock']

# =========================================================================== the nave
NX0, NX1, NY0, NY1 = 6.0, 24.0, 4.0, 46.0
TH, WH = 1.2, 7.0
top(rect(NX0, NX1, NY0, NY1), 'floor')
w.box(NX0 - TH, NX0, NY0 - TH, NY1 + TH, 0, WH, 'wall'); w.box(NX1, NX1 + TH, NY0 - TH, NY1 + TH, 0, WH, 'wall')          # west and east walls
w.box(NX0 - TH, NX1 + TH, NY1, NY1 + TH, 0, WH + 3.0, 'wall')                                                             # the north wall, with the great window
for k in range(w.iz(WH + 3.0), w.iz(WH + 7.0)):                                                                            # its gable
    hw = (NX1 - NX0 + 2 * TH) / 2 * (1 - (w.ZC[k] - WH - 3.0) / 4.0); w.V[w.ix(15 - hw):w.ix(15 + hw), w.iy(NY1):w.iy(NY1 + TH), k] = MAT['wall']
for k in range(w.iz(4.6), w.iz(9.4)):                                                                                      # the round window
    hw = np.sqrt(max(0.0, 2.4 ** 2 - (w.ZC[k] - 7.0) ** 2)); w.V[w.ix(15 - hw):w.ix(15 + hw), w.iy(NY1 - .12):w.iy(NY1), k] = MAT['glass']
for x in (9.0, 21.0): w.box(x - .7, x + .7, NY1 - .12, NY1, 2.6, 6.2, 'glass')
# the south wall is broken down to a low stump; the doorway in its middle
for x0, x1, h in ((NX0 - TH, 9.0, 2.2), (9.0, 12.6, 1.1), (17.4, 21.0, .9), (21.0, NX1 + TH, 1.9)): w.box(x0, x1, NY0 - TH, NY0, 0, h, 'wall')
for x in (12.6, 16.6): w.box(x, x + .8, NY0 - TH - .1, NY0 + .1, 0, 3.2, 'wall')
top(rect(13.4, 16.6, NY0 - TH, NY0), 'floor')
# the door in the east wall to the cloister
DY0, DY1 = 18.0, 21.4
w.box(NX1, NX1 + TH, DY0, DY1, 0, WH, 0); top(rect(NX1, NX1 + TH + 2.8, DY0, DY1), 'floor')
w.box(NX1, NX1 + TH, DY0, DY1, 4.4, WH, 'wall')
# the carpet up the aisle, the chancel (two steps up) with the altar
top(rect(13.6, 16.4, NY0, 35.0), 'carpet')
CZ = .75
w.box(NX0, NX1, 36.0, NY1, 0, CZ - 1 / VPU, 'wall'); w.box(NX0, NX1, 36.0, NY1, CZ - 1 / VPU, CZ, 'floor')
w.stairs_n(11.0, 19.0, 36.0, 0.0, CZ, side=0, side_h=0)
top(rect(13.6, 16.4, 36.0, 41.0), 'carpet', CZ)
w.box(12.4, 17.6, 43.2, 44.8, CZ, CZ + 1.3, 'white'); w.box(12.0, 18.0, 43.0, 45.0, CZ + 1.3, CZ + 1.5, 'white')
for x in (11.0, 19.0): w.box(x - .15, x + .15, 43.6, 43.9, CZ, CZ + 2.2, 'iron'); w.box(x - .2, x + .2, 43.55, 43.95, CZ + 2.2, CZ + 2.7, 'candle')
# the door to the bell tower, in the north wall's east end
w.arch_y(21.6, 2.2, NY1 - .14, NY1 + .1, CZ, 2.9, MAT['dark'])
# pillars (some broken) and pews
for i, y in enumerate((9.0, 16.0, 23.0, 30.0)):
    for j, x in enumerate((10.0, 20.0)):
        h = (6.4, 6.4, 2.6, 6.4, 6.4, 3.4, 6.4, 1.4)[i * 2 + j]
        w.cyl(x, y, .8, 0, h, 'tomb'); w.box(x - 1.0, x + 1.0, y - 1.0, y + 1.0, 0, .45, 'tomb')
        if h > 6: w.box(x - 1.0, x + 1.0, y - 1.0, y + 1.0, h, h + .5, 'tomb')
for y in (7.0, 11.2, 13.4, 18.4, 20.6, 25.4, 27.6, 32.2):
    for x0, x1 in ((7.0, 12.4), (17.6, 23.0)):
        if rng.uniform() < .82: w.box(x0, x1, y - .35, y + .35, 0, .55, 'pew'); w.box(x0, x1, y + .2, y + .35, .55, 1.15, 'pew')
w.box(21.0, 22.6, 33.4, 34.2, 0, .5, 'pew')                               # a pew knocked askew, rubble
for x, y, r in ((8.0, 33.8, .7), (9.2, 34.4, .45), (22.6, 9.2, .6), (7.6, 22.0, .5)): w.ball(x, y, r * .35, r, 'tomb', squash=.75)
for x, y in ((7.0, 5.0), (23.0, 5.0), (7.0, 35.0), (23.0, 35.0)): w.lantern(x, y, 2.6, post=0, r=150)      # candle stands

# =========================================================================== the cloister
CX0, CX1, CY0, CY1 = 28.0, 46.0, 9.0, 34.0
top(rect(CX0, CX1, CY0, CY1), 'floor')
GX0, GX1, GY0, GY1 = 31.6, 42.4, 13.0, 27.4                               # the garden
top(rect(GX0, GX1, GY0, GY1), 'grass')
for x0, x1, y0, y1 in ((GX0 - .5, GX1 + .5, GY0 - .5, GY0), (GX0 - .5, GX1 + .5, GY1, GY1 + .5), (GX0 - .5, GX0, GY0, GY1), (GX1, GX1 + .5, GY0, GY1)):
    w.box(x0, x1, y0, y1, 0, .6, 'wall')                                 # the low wall the pillars stand on
for x0, x1 in ((36.0, 38.0),): w.box(x0, x1, GY0 - .5, GY0, 0, .6, 0); w.box(x0, x1, GY1, GY1 + .5, 0, .6, 0)   # ways into the garden (south and north)
w.box(GX0 - .5, GX0, 19.0, 21.0, 0, .6, 0)
top(rect(36.0, 38.0, GY0 - .5, GY0), 'floor'); top(rect(36.0, 38.0, GY1, GY1 + .5), 'floor'); top(rect(GX0 - .5, GX0, 19.0, 21.0), 'floor')
for x in np.arange(GX0 - .25, GX1 + .5, 2.7):                             # pillars of the arcade (ruined: no roof over the walks)
    for y in (GY0 - .25, GY1 + .25):
        if 35.6 < x < 38.4: continue
        w.cyl(x, y, .42, .6, 3.6 if rng.uniform() < .7 else 1.6, 'tomb')
for y in np.arange(GY0 + 2.4, GY1 - 1, 2.7):
    for x in (GX0 - .25, GX1 + .25):
        if x < 32 and 18.6 < y < 21.4: continue
        w.cyl(x, y, .42, .6, 3.6 if rng.uniform() < .7 else 1.6, 'tomb')
SPX, SPY = 37.0, 20.2                                                     # the spring
w.cyl(SPX, SPY, 2.3, 0, .8, 'wall'); w.cyl(SPX, SPY, 1.8, .4, .8, 0); w.cyl(SPX, SPY, 1.8, .25, .4, 'water')
w.cyl(SPX, SPY, .4, .25, 1.9, 'white'); w.cyl(SPX, SPY, .9, 1.9, 2.1, 'white')
top(rect(36.0, 38.0, GY0, SPY - 2.3), 'path'); top(rect(36.0, 38.0, SPY + 2.3, GY1), 'path'); top(rect(GX0, SPX - 2.3, 19.0, 21.0), 'path')
# walls round the cloister: west (towards the nave, with the door), north (tall, carries the gallery), east; the south one is a stump
w.box(CX0 - 1.6, CX0 - .4, CY0, DY0, 0, 5.0, 'wall'); w.box(CX0 - 1.6, CX0 - .4, DY1, CY1 + TH, 0, 5.0, 'wall')
w.box(CX0 - 1.6, CX1 + TH, CY1, CY1 + TH, 0, 9.0, 'wall')
w.box(CX1, CX1 + TH, CY0 - TH, CY1 + TH, 0, 6.0, 'wall')
for x0, x1, h in ((CX0 - 1.6, 33.0, 1.6), (33.0, 39.0, .8), (39.0, CX1 + TH, 2.0)): w.box(x0, x1, CY0 - TH, CY0, 0, h, 'wall')
# the gallery over the north walk: a stone floor on pillars, with a low parapet; its stair fell long ago
GZ = 4.5
w.box(CX0 - .4, CX1, 31.0, CY1, GZ - .5, GZ - 1 / VPU, 'wall'); w.box(CX0 - .4, CX1, 31.0, CY1, GZ - 1 / VPU, GZ, 'floor')
w.box(CX0 - .4, CX1, 31.0, 31.3, GZ, GZ + .7, 'wall'); w.box(38.6, 41.6, 31.0, 31.3, GZ, GZ + .7, 0)       # a gap in the parapet: the chest shows through it
for x in np.arange(CX0 + .4, CX1, 3.5): w.cyl(x, 31.2, .42, 0, GZ - .5, 'tomb')
for i in range(4): w.box(CX1 - 2.4, CX1, 28.6 - i * .6, 29.2 - i * .6, 0, 2.6 - i * .7, 'wall')            # what is left of the gallery stair
for x in (30.0, 34.0, 40.0, 44.0): w.box(x - .7, x + .7, CY1 - .12, CY1, GZ + 1.2, GZ + 3.8, 'glass')
# benches, a desk with the watchman's journal, dead leaves, ivy
w.box(40.0, 41.8, 21.6, 22.4, 0, .8, 'pew'); w.box(40.3, 41.5, 21.75, 22.25, .8, .9, 'white')
for x, y in ((29.4, 12.0), (29.4, 26.0), (44.6, 15.0)): w.box(x - .35, x + .35, y - 1.0, y + 1.0, 0, .5, 'pew')
for x, y, r in ((33.4, 15.0, 1.0), (40.8, 25.4, .9), (33.6, 25.6, .7), (41.0, 14.6, .8)): w.ball(x, y, r * .45, r, 'bush', squash=.7)
w.cone(34.4, 23.2, .4, 0, 4.4, 'trunk', r1=.2)
for a, ln in ((-2.4, 1.6), (-.6, 1.8), (.8, 1.4), (2.3, 1.5)): w.limb((34.4, 23.2, 3.2), (34.4 + ln * np.cos(a), 23.2 + .4 * np.sin(a), 4.6 + .5 * ln), .22, .1, 'trunk')

# =========================================================================== outside: forecourt, graves, the precinct wall
top(rect(13.0, 17.0, -4, NY0 - TH), 'path'); top(rect(9.0, 21.0, -1.0, NY0 - TH), 'path')
w.box(0, .8, -4, 56, 0, 3.2, 'wall'); w.box(47.2, 48, -4, 56, 0, 3.2, 'wall')
for x0, x1 in ((0, 13.0), (17.0, 48)): w.box(x0, x1, -3.6, -2.8, 0, 1.6, 'wall')
def fir(cx, cy, z, h=6.5, r=1.6): w.cone(cx, cy, r, z + .7, z + h, 'conifer'); w.cyl(cx, cy, .3, z, z + .7, 'trunk')
for x, y in ((2.2, 8.0), (3.4, 12.0), (2.0, 16.4), (3.2, 21.0), (2.4, 30.0)): w.box(x - .4, x + .4, y - .15, y + .15, 0, 1.1, 'tomb')
for x, y, h, r in ((2.6, 38.0, 6.0, 1.5), (3.0, 44.6, 6.6, 1.6), (27.0, 41.0, 5.6, 1.4), (33.0, 43.6, 6.4, 1.6), (39.6, 40.6, 5.8, 1.5), (44.6, 44.0, 6.2, 1.5), (26.6, 2.0, 5.0, 1.3), (44.8, 3.0, 5.4, 1.4)):
    fir(x, y, 0, h=h, r=r)
for x, y, r in ((3.0, 2.0, .9), (23.0, .6, .7), (30.6, 5.0, 1.0), (40.0, 5.6, .8), (36.0, 38.6, 1.1), (42.6, 37.6, .8), (29.6, 37.4, .7), (3.2, 26.0, .7), (2.2, 34.0, .9)):
    w.ball(x, y, r * .35, r, 'rock', squash=.75)
for x, y in ((8.0, 1.0), (22.0, 1.6), (35.0, 4.0), (3.4, 5.0)): w.ball(x, y, .36, .8, 'bush', squash=.7)

# =========================================================================== places the game needs
w.mark('exit_south', 15, -3.4, 0, title='礼拝堂へ'); w.mark('spawn_south', 15, 0.6, 0)
w.mark('boss', 15, 38.6, CZ, title='鐘守りの大烏'); w.mark('boss_line', 15, 33.0, 0)
w.mark('altar', 15, 42.2, CZ, title='祭壇'); w.mark('chest_boss', 9.0, 43.6, CZ); w.mark('crystal', 19.4, 40.4, CZ); w.mark('tower_door', 21.6, 45.0, CZ, title='鐘楼への扉')
w.mark('journal', 40.9, 20.8, 0, title='見張りの日誌'); w.mark('spring', SPX, SPY - 3.0, 0, title='回廊の泉')
w.mark('chest_gallery', 40.0, 32.6, GZ); w.mark('gallery_below', 40.0, 29.6, 0, title='回廊の2階'); w.mark('stair_ruin', 44.6, 26.2, 0, title='崩れた階段')
w.mark('chest_cloister', 44.6, 11.0, 0); w.mark('hide_pew', 7.6, 31.0, 0)
w.marks['spring']['poly'] = [(SPX + 1.8 * np.cos(a), SPY + 1.8 * np.sin(a), .4) for a in np.linspace(0, 2 * np.pi, 24, endpoint=False)]
for nm, x, y, z in (('win_n', 15, NY1 - .2, 7.0), ('win_l', 9, NY1 - .2, 4.4), ('win_r', 21, NY1 - .2, 4.4)): w.mark(nm, x, y, z, light=dict(color='#ffb46a', r=150, intensity=.6))
w.mark('fx_nave', 15, 22, 0); w.mark('fx_chancel', 15, 40, CZ); w.mark('fx_garden', 37, 20, 0); w.mark('fx_court', 15, 0, 0)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    info = bake(w, out, spawn=(15.0, 0.6), also=((40.0, 32.6),), **MAP)
    bad = [k for k, v in info['marks'].items() if (k.startswith(('exit', 'spawn', 'chest', 'boss', 'altar', 'crystal', 'journal', 'hide', 'stair', 'gallery', 'tower'))) and not v['on_ground']]
    print('marks not on walkable ground:', bad)
