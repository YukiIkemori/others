"""Blockout of the abbey on a cliff above the sea of clouds (three terraces, five stairs, gate, nave, tower, lookout).
usage: python3 cliff_world.py out_dir"""
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vox import World, bake, MAT, VPU

w = World(); XX, YY = w.XX, w.YY
rng = np.random.default_rng(7)
CX, CY, RX, RY = 20.0, 15.5, 18.5, 21.0

def island(grow=0.0):
    th = np.arctan2(YY - CY, XX - CX); wob = 1 + 0.02 * np.sin(3 * th + 1.0) + 0.012 * np.sin(7 * th + 0.3)
    return (np.abs((XX - CX) / ((RX + grow) * wob)) ** 3 + np.abs((YY - CY) / ((RY + grow) * wob)) ** 3) <= 1
ISL = island()
yb1 = 13.5 - 0.008 * (XX - CX) ** 2            # retaining wall between the graveyard (z 0) and the abbey terrace (z 3)
yb2 = 29.0 - 0.006 * (XX - CX) ** 2            # between the abbey terrace and the upper terrace (z 6)
LV = np.where(YY >= yb2, 6.0, np.where(YY >= yb1, 3.0, 0.0))

# ---- ground: rock body, stone retaining faces, grass on top
for lv in (0.0, 3.0, 6.0):
    m = ISL & (LV == lv)
    w.col(m, w.Z0, lv, 'rock'); w.col(m, lv - 1 / VPU, lv, 'grass')
w.col(ISL & (YY >= yb1) & (YY < yb1 + 0.6), 0.0, 3.0 - 1 / VPU, 'wall')
w.col(ISL & (YY >= yb2) & (YY < yb2 + 0.6), 3.0, 6.0 - 1 / VPU, 'wall')
# lower rock shelves with firs, left and right of the entrance (never reachable)
shelf = island(3.2) & ~island(0.3) & (YY < 7) & (np.abs(XX - CX) > 5)
w.col(shelf, w.Z0, -6.5, 'rock'); w.col(shelf, -6.5 - 1 / VPU, -6.5, 'grass')

def top(mask, mat):
    """repaint the top voxel of ground columns"""
    for lv in (0.0, 3.0, 6.0):
        w.col(mask & ISL & (LV == lv), lv - 1 / VPU, lv, mat)

def seg_d(ax, ay, bx, by):
    vx, vy = bx - ax, by - ay; t = np.clip(((XX - ax) * vx + (YY - ay) * vy) / (vx * vx + vy * vy), 0, 1)
    return np.hypot(XX - ax - t * vx, YY - ay - t * vy)
def path(pts, width=2.0, mat='path'):
    m = np.zeros(XX.shape, bool)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]): m |= seg_d(ax, ay, bx, by) <= width / 2
    top(m, mat); return m
PATHS = np.zeros(XX.shape, bool)

# ---- rim walls and parapets (before stairs, which cut their own gaps)
from scipy import ndimage as ndi
rim = ISL & ~ndi.binary_erosion(ISL, iterations=4)
for lv in (0.0, 3.0, 6.0): w.col(rim & (LV == lv) & (YY > 1.0), lv, lv + 0.9, 'wall')
w.col(ISL & (YY >= yb1) & (YY < yb1 + 0.4), 3.0, 3.8, 'wall')
w.col(ISL & (YY >= yb2) & (YY < yb2 + 0.4), 6.0, 6.8, 'wall')

# ---- stairs
def ytop_of(yb, xa, xb): return float(yb[(XX >= xa) & (XX <= xb)].min())
ST = {}
for name, xa, xb, yb, zl in (('left', 7.25, 9.75, yb1, 0.0), ('centre', 18.5, 21.5, yb1, 0.0), ('right', 30.25, 32.75, yb1, 0.0),
                             ('upleft', 10.25, 12.75, yb2, 3.0), ('upright', 30.0, 32.5, yb2, 3.0)):
    yt = ytop_of(yb, xa - .5, xb + .5)
    ST[name] = dict(xa=xa, xb=xb, yt=yt, yb=w.stairs_n(xa, xb, yt, zl, zl + 3.0), z=zl)
# entrance stairs, cut into the south tip of the island
w.stairs_n(18.5, 21.5, 0.25, -4.125, 0.0, carve=True)
ENTRY_BOTTOM = 0.25 - 11 * 0.5
w.box(18.0, 22.0, w.Y0, ENTRY_BOTTOM, -4.125, 4.0, 0)                            # open the tip of the island in front of the steps

# ---- gate and the wall beside it
w.box(4, 16.6, 0.5, 1.1, 0.0, 1.5, 'wall'); w.box(23.4, 36, 0.5, 1.1, 0.0, 1.5, 'wall')
w.box(4, 16.6, 0.7, 0.9, 1.5, 2.3, 'iron'); w.box(23.4, 36, 0.7, 0.9, 1.5, 2.3, 'iron')
w.V[~ISL] = np.where(np.broadcast_to((w.ZC > -6.4)[None, :], w.V[~ISL].shape), 0, w.V[~ISL])       # nothing hangs over the edge
w.box(16.6, 23.4, 0.2, 2.2, 0.0, 5.2, 'wall')
for x0 in np.arange(16.6, 23.3, 1.0): w.box(x0, x0 + .5, 0.2, 2.2, 5.2, 5.7, 'wall')
w.arch_y(20, 3.0, 0.1, 2.3, 0.0, 2.0)
w.box(18.5, 21.5, 0.25, 2.3, -1 / VPU, 0.0, 'path')
w.lantern(17.6, 0.1, 2.5, glow_z=0.0); w.lantern(22.4, 0.1, 2.5, glow_z=0.0)

# ---- graveyard (z 0)
PATHS |= path([(20, 2.2), (20, ST['centre']['yb'] - .4)], 2.4)
PATHS |= path([(20, 5.5), (14, 6.6), (8.5, ST['left']['yb'] - .5)], 1.9)
PATHS |= path([(20, 5.5), (26, 6.6), (31.5, ST['right']['yb'] - .5)], 1.9)
for nm in ('left', 'centre', 'right'):
    s_ = ST[nm]
    for x in (s_['xa'] - .25, s_['xb'] + .25): w.lantern(x, s_['yb'] - .25, 2.1, post=0.0)
placed = []
tries = 0
while len(placed) < 30 and tries < 4000:
    tries += 1
    x, y = rng.uniform(4, 36), rng.uniform(2.6, 12.3)
    i, j = int((x - w.X0) * VPU), int((y - w.Y0) * VPU)
    if not ISL[i, j] or LV[i, j] != 0 or y > yb1[i, j] - 1.6: continue
    if ndi.binary_dilation(PATHS, iterations=10)[i, j]: continue
    if not ndi.binary_erosion(ISL, iterations=16)[i, j]: continue
    if any(abs(x - s_['xa']) < 2 or abs(x - s_['xb']) < 2 for s_ in (ST['left'], ST['centre'], ST['right'])) and y > 7.2: continue
    if any(np.hypot(x - a, y - b) < 2.3 for a, b, _ in placed): continue
    placed.append((x, y, rng.choice(['head', 'head', 'cross', 'cross', 'tomb'])))
for x, y, kind in placed:
    if kind == 'head': w.box(x - .4, x + .4, y - .15, y + .15, 0, 1.1, 'tomb')
    elif kind == 'cross':
        w.box(x - .45, x + .45, y - .3, y + .3, 0, .3, 'tomb'); w.box(x - .14, x + .14, y - .14, y + .14, .3, 1.7, 'tomb'); w.box(x - .5, x + .5, y - .14, y + .14, 1.05, 1.3, 'tomb')
    else: w.box(x - .6, x + .6, y - .9, y + .9, 0, .55, 'tomb'); w.box(x - .5, x + .5, y + .6, y + .9, .55, 1.2, 'tomb')
# dead tree
w.cone(33.6, 4.2, .6, 0, 4.6, 'trunk', r1=.34)
for p0, p1 in (((33.6, 4.2, 4.2), (36.0, 4.4, 8.6)), ((33.6, 4.2, 4.2), (31.6, 4.0, 9.2)), ((33.6, 4.2, 3.6), (34.6, 5.2, 10.4)), ((33.6, 4.2, 3.0), (32.2, 3.4, 6.4)),
               ((35.2, 4.4, 7.2), (37.0, 4.2, 9.6)), ((32.4, 4.1, 7.4), (30.6, 4.3, 8.0)), ((34.3, 4.9, 8.0), (33.2, 4.6, 11.2)), ((33.6, 4.2, 3.2), (35.4, 3.6, 5.6))):
    w.limb(p0, p1, .26, .1, 'trunk')

# ---- abbey terrace (z 3)
front = [(8.5, ST['left']['yt'] + .9), (14, 14.4), (20, 14.9), (26, 14.4), (31.5, ST['right']['yt'] + .9)]
PATHS |= path(front, 2.0)
PATHS |= path([(8.5, ST['left']['yt'] + .5), (11.6, 17.5), (11.5, ST['upleft']['yb'] - .3)], 1.9)
PATHS |= path([(31.5, ST['right']['yt'] + .5), (31.25, ST['upright']['yb'] - .3)], 2.0)
# nave
NX0, NX1, NY0, NY1, T = 13.5, 26.5, 16.5, 29.3, 0.75
w.box(NX0 + T, NX1 - T, NY0 + T, NY1 - T, 3 - 1 / VPU, 3, 'floor')
w.box(19.25, 20.75, NY0 - .2, 26.0, 3 - 1 / VPU, 3, 'carpet')
w.box(17.4, 22.6, 26.0, NY1 - T, 3, 3.25, 'floor'); w.box(19.25, 20.75, 26.0, 26.5, 3.125, 3.25, 'carpet')
for (x0, x1), hs in (((NX0, NX0 + T), [2.4, 3.4, 2.2, 1.4, 2.6, 3.6, 4.6, 5.6]), ((NX1 - T, NX1), [2.6, 2.0, 1.2, 2.4, 3.6, 3.0, 4.4, 5.6])):
    seg = (NY1 - NY0) / len(hs)
    for q, hh in enumerate(hs): w.box(x0, x1, NY0 + q * seg, NY0 + (q + 1) * seg, 3, 3 + hh, 'wall')
w.box(NX0, NX1, NY0, NY0 + T, 3, 5.3, 'wall')                                    # low, broken front wall: the floor stays in view
w.box(NX0, 15.2, NY0, NY0 + T, 4.4, 5.3, 0); w.box(23.6, NX1, NY0, NY0 + T, 4.9, 5.3, 0); w.box(16.4, 17.4, NY0, NY0 + T, 4.7, 5.3, 0)
for hw, hz in ((2.6, 6.6), (2.0, 7.1), (1.2, 7.6)): w.box(20 - hw, 20 + hw, NY0, NY0 + T, 5.3, hz, 'wall')
w.arch_y(20, 2.6, NY0 - .1, NY0 + T + .1, 3, 2.2)
w.lantern(18.0, NY0 - .1, 5.0, glow_z=3.0); w.lantern(22.0, NY0 - .1, 5.0, glow_z=3.0)
w.box(NX0, NX1, NY1 - T, NY1, 3, 9.6, 'wall')
for hw, hz in ((4.0, 10.4), (2.8, 11.2), (1.5, 12.0)): w.box(20 - hw, 20 + hw, NY1 - T, NY1, 9.6, hz, 'wall')
w.arch_y(20, 2.4, NY1 - T - .13, NY1 - T, 5.2, 3.0, MAT['glass'])
for xc in (16.4, 23.6): w.arch_y(xc, 1.2, NY1 - T - .13, NY1 - T, 5.4, 1.8, MAT['glass'])
for (cx, hs) in ((16.7, [4.4, 1.8, 3.6]), (23.3, [1.3, 4.4, 2.6])):
    for cy, hh in zip((19.6, 22.4, 25.2), hs):
        w.cyl(cx, cy, .7, 3, 3.3, 'wall'); w.cyl(cx, cy, .52, 3.3, 3 + hh, 'wall')
        if hh > 4: w.cyl(cx, cy, .75, 3 + hh - .4, 3 + hh, 'wall')
w.box(18.8, 21.2, 27.0, 27.9, 3.25, 4.3, 'tomb')
w.box(15.0, 15.9, 20.6, 21.4, 3, 3.7, 'wall'); w.box(24.3, 25.3, 23.6, 24.3, 3, 3.6, 'wall'); w.box(22.0, 22.9, 18.0, 18.6, 3, 3.5, 'wall')
# pond court
pond = ((XX - 8.2) / 2.6) ** 2 + ((YY - 18.6) / 1.9) ** 2
w.col(pond <= 1.35, 3, 3.3, 'wall'); w.col(pond <= 1.0, 3 - .25, 3.3, 0); w.col(pond <= 1.0, 3 - .375, 3 - .25, 'water')
w.cone(4.9, 23.2, .5, 3, 5.6, 'trunk', r1=.35); w.ball(4.9, 23.2, 7.2, 2.5, 'maple', squash=.8); w.ball(6.3, 22.4, 6.6, 1.6, 'maple', squash=.8)
w.box(4.6, 6.4, 15.9, 16.4, 3, 3.5, 'wood')
# arcade and the walk behind it
AY0, AY1 = 26.0, 26.6
w.box(3.0, 9.85, AY0, AY1, 3, 6.5, 'wall')
for xc in (4.85, 6.95, 9.05): w.arch_y(xc, 1.5, AY0 - .1, AY1 + .1, 3, 1.8)
top((XX > 3) & (XX < 10.25) & (YY > AY1) & (YY < yb2), 'floor')
w.V[~ISL] = np.where(np.broadcast_to((w.ZC > -6.4)[None, :], w.V[~ISL].shape), 0, w.V[~ISL])
# right side: a fir, two old stones, lanterns
w.cone(34.6, 20.5, 1.3, 3.6, 9.0, 'conifer'); w.cyl(34.6, 20.5, .3, 3, 3.6, 'trunk')
w.box(28.4, 29.2, 19.85, 20.15, 3, 4.1, 'tomb'); w.box(28.6, 29.4, 22.85, 23.15, 3, 4.0, 'tomb')
for nm in ('upleft', 'upright'):
    s_ = ST[nm]
    for x in (s_['xa'] - .25, s_['xb'] + .25): w.lantern(x, s_['yb'] - .25, 5.1, post=3.0)

# ---- upper terrace (z 6)
TX0, TX1, TY0, TY1 = 7.4, 12.4, 30.1, 33.6
w.box(TX0, TX1, TY0, TY1, 6, 17, 'wall')
for x0 in (TX0 - .25, TX1 - .45):
    for y0 in (TY0 - .25, TY1 - .45): w.box(x0, x0 + .7, y0, y0 + .7, 6, 17.6, 'wall')
w.box(TX0 - .3, TX1 + .3, TY0 - .3, TY1 + .3, 16.4, 17.0, 'wall')
w.pyramid(TX0 - .5, TX1 + .5, TY0 - .5, TY1 + .5, 17.0, 25.5, 'roof')
w.arch_y(9.9, 1.5, TY0 - .01, TY0 + .13, 6, 1.7, MAT['wood'])                    # door (closed)
w.arch_y(9.9, 2.0, TY0 - .01, TY0 + .4, 13.0, 1.6, MAT['dark']); w.box(9.5, 10.3, TY0 + .1, TY0 + .4, 13.5, 14.6, 'bell')
w.box(9.6, 10.2, TY0 - .01, TY0 + .13, 10.2, 11.4, 'dark')
w.lantern(11.2, TY0 - .15, 8.2, glow_z=6.0)
plaza = (XX > 21.5) & (YY > yb2 + .4)
top(plaza, 'floor')
PATHS |= path([(10.0, 29.6), (16, 30.5), (22, 30.6)], 1.7)
w.box(28.9, 30.1, 34.2, 35.4, 6, 7.1, 'tomb'); w.cyl(29.5, 34.8, .42, 7.1, 9.2, 'statue'); w.ball(29.5, 34.8, 9.5, .42, 'statue')
w.box(32.2, 34.0, 32.3, 32.8, 6, 6.5, 'wood')
for cx, cy in ((14.4, 34.2), (16.6, 35.0), (18.8, 34.8)): w.cone(cx, cy, 1.25, 6.6, 12.0, 'conifer'); w.cyl(cx, cy, .3, 6, 6.6, 'trunk')
w.lantern(23.0, 34.9, 8.0, post=6.0); w.lantern(34.4, 30.6, 8.0, post=6.0)
# firs on the lower shelves
for cx, cy in ((7.0, -3.4), (10.6, -5.6), (4.2, 0.6), (33.0, -3.4), (29.6, -5.8), (36.0, 0.8), (13.6, -6.8), (26.6, -6.9)):
    i, j = int((cx - w.X0) * VPU), int((cy - w.Y0) * VPU)
    if shelf[i, j]: w.cone(cx, cy, 1.5, -5.9, 0.6, 'conifer'); w.cyl(cx, cy, .3, -6.5, -5.9, 'trunk')

# ---- landing at the foot of the entrance stairs (outside the island outline, so it is built last)
w.box(18.1, 21.9, ENTRY_BOTTOM - 2.0, ENTRY_BOTTOM, w.Z0, -4.125 - 1 / VPU, 'wall'); w.box(18.1, 21.9, ENTRY_BOTTOM - 2.0, ENTRY_BOTTOM, -4.125 - 1 / VPU, -4.125, 'stair')
for x0 in (18.1, 21.5): w.box(x0, x0 + .4, ENTRY_BOTTOM - 2.0, ENTRY_BOTTOM - .5, -4.125, -3.4, 'wall')

# ---- the cliff narrows downwards, in rough ledges
for k in range(w.iz(5.0)):
    z = w.ZC[k]
    for lv in (0.0, 3.0, 6.0):
        d = lv - 0.6 - z
        if d <= 0: continue
        inset = 0.16 * d + 0.5 * (np.floor(d / 1.7) % 2) + 0.35 * np.sin(XX * 1.9 + np.floor(d / 1.1) * 2.1)
        keep = np.abs((XX - CX) / np.maximum(RX - inset, 1)) ** 3 + np.abs((YY - CY) / np.maximum(RY - inset, 1)) ** 3 <= 1
        cut = (LV == lv) & ISL & ~keep & (w.V[:, :, k] == MAT['rock'])
        w.V[cut, k] = 0

# ---- places the game needs
w.mark('exit', 20, ENTRY_BOTTOM - 1.6, 0, title='丘のふもとへ')
w.mark('about', 20, 3.6, 0, title='この版について')
w.mark('tower', 9.9, 29.5, 6, title='鐘楼の扉')
w.mark('lookout', 29.5, 32.6, 6, title='二つの月を眺める')
w.mark('altar', 20, 25.6, 3, title='祭壇')
w.mark('pond', 8.2, 18.6, 3)
for nm, (x, z) in (('win_c', (20, 9.5)), ('win_l', (16.4, 8.6)), ('win_r', (23.6, 8.6))): w.mark(nm, x, NY1 - T - .1, z)
w.marks['pond']['poly'] = [(8.2 + 2.6 * np.cos(a), 18.6 + 1.9 * np.sin(a), 2.75) for a in np.linspace(0, 2 * np.pi, 28, endpoint=False)]
w.mark('maple', 4.9, 23.2, 7.0); w.mark('nave', 20, 22, 3); w.mark('graves', 20, 7, 0)
for nm, s_ in ST.items(): w.mark('stairs_' + nm, (s_['xa'] + s_['xb']) / 2, s_['yt'] + .5, s_['z'] + 3)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    info = bake(w, out, spawn=(20, ENTRY_BOTTOM - 0.8))
    print({k: v['on_ground'] for k, v in info['marks'].items()})
