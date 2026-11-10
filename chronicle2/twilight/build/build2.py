"""Builds the game data for the abbey map from the chosen art and the model-made masks.
out: map/out/{map.png (RGBA), walk.png, height.png, sky.png} + check images."""
from PIL import Image, ImageDraw
import numpy as np, cv2, json, os
OUT = 'map/out'; os.makedirs(OUT, exist_ok=True)
art = np.array(Image.open('map/map_art.png').convert('RGB'))
H, W = art.shape[:2]
walk0 = np.load('map/walk0.npy'); walk0 = cv2.morphologyEx(walk0.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7,7),np.uint8))>0; raised0 = np.load('map/raised0.npy'); sky = np.load('map/sky_green.npy')

# ---------- alpha: sky and cloud sea become transparent (bottom forest stays solid)
skym = sky.copy(); skym[1180:] = False
skym = cv2.dilate(skym.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0     # eat the 1px fringe
n, lab, st, _ = cv2.connectedComponentsWithStats(skym.astype(np.uint8), connectivity=8)
for i in range(1, n):                                                      # drop specks inside the island
    if st[i, 4] < 40: skym[lab == i] = False
rgba = np.dstack([art, np.where(skym, 0, 255).astype(np.uint8)])
Image.fromarray(rgba).save(f'{OUT}/map.png')

# ---------- class-1 objects: things the hero can walk BEHIND. (box, base_y)
C1 = [  # nave columns: capital box + shaft box
    ((538, 510, 592, 545), 650), ((546, 545, 586, 656), 650),
    ((528, 570, 584, 604), 716), ((534, 604, 580, 724), 716),
    ((733, 490, 792, 545), 660), ((744, 545, 786, 668), 660),
    ((756, 572, 804, 604), 716), ((764, 604, 800, 724), 716),
    ((780, 650, 820, 682), 760), ((784, 682, 818, 768), 760),
    ((505, 1225, 790, 1446), 1440),      # gate front wall + arch
    ((596, 728, 726, 908), 903),         # nave doorway wall + arch
    ((236, 585, 446, 708), 703),         # cloister arcade
]
base = np.zeros((H, W), np.int32)        # ground-contact y of each class-1 pixel (0 = none)
for (x0, y0, x1, y1), b in C1:
    sub = raised0[y0:y1, x0:x1]
    cur = base[y0:y1, x0:x1]
    cur[sub] = np.maximum(cur[sub], b)
# the nave's north gable and wall tops stand in front of the upper-terrace path
x0, y0, x1, y1 = 590, 340, 765, 420
n_, lab_ = cv2.connectedComponents(raised0[y0:y1, x0:x1].astype(np.uint8), connectivity=8)
keep = np.isin(lab_, [v for v in np.unique(lab_[-1]) if v > 0])
sub = base[y0:y1, x0:x1]; sub[keep] = np.maximum(sub[keep], 520)
# maple canopy: only the red leaves inside its box (the arcade stones behind keep their own base)
x0, y0, x1, y1 = 120, 505, 300, 702
a = art[y0:y1, x0:x1].astype(int)
red = ((a[..., 0] - a[..., 1] > 22) & (a[..., 0] > a[..., 2] + 8)).astype(np.uint8)
red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
red = cv2.morphologyEx(red, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
sub = base[y0:y1, x0:x1]; sub[red & raised0[y0:y1, x0:x1]] = 765
for (x0, y0, x1, y1) in [(314, 622, 345, 700), (366, 622, 399, 700)]: base[y0:y1, x0:x1] = 0   # plants seen through the arches are behind
c1 = base > 0

# ---------- walkable: every piece of flat ground you can see (paths, grass, floors, stairs); things that stand up block
# the standing-object mask draws stair risers as thin lines: a vertical opening removes them (and nothing that really stands up)
raisedo = cv2.morphologyEx(raised0.astype(np.uint8), cv2.MORPH_OPEN, np.ones((6, 1), np.uint8)) > 0
nv = raisedo[440:780, 500:830]                                           # the carpet's edge lines inside the nave are not walls
nv[:] = cv2.morphologyEx(nv.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, 6), np.uint8)) > 0
raised2 = raisedo & ~c1
n, lab, st, _ = cv2.connectedComponentsWithStats(raised2.astype(np.uint8), connectivity=8)
small = np.isin(lab, [i for i in range(1, n) if st[i, 4] < 120])           # flower specks do not block
raised2 &= ~small
# props: small free-standing things (headstones, crosses, tombs, posts). The hero can step behind them:
# only a band at their foot blocks, the rest of the silhouette is ground hidden behind the prop (height map hides the hero there).
n, lab, st, _ = cv2.connectedComponentsWithStats(raised2.astype(np.uint8), connectivity=8)
foot = np.zeros((H, W), bool); behind = np.zeros((H, W), bool); nprops = 0
for i in range(1, n):
    x, y, w, h, a = st[i]
    if not (w <= 110 and 26 <= h <= 125 and a <= 7000 and y > 925): continue   # graveyard props only
    m = lab[y:y + h, x:x + w] == i
    rows = np.arange(h)[:, None]
    yb = np.where(m.any(0), (m * rows).max(0), -1)                         # bottom row of the prop in each column
    ybs = yb.copy()
    for c in range(w):                                                     # smooth: use the lowest bottom within +-4 columns
        ybs[c] = yb[max(0, c - 4):c + 5].max()
    d = int(round(h * 0.75)) if w > 1.15 * h else int(np.clip(round(h * 0.3), 8, 16))   # flat tombs block almost whole
    f = m & (rows > (ybs[None, :] - d))
    foot[y:y + h, x:x + w] |= f
    bh = m & ~f
    behind[y:y + h, x:x + w] |= bh
    sub = base[y:y + h, x:x + w]; bb = (y + ybs)[None, :].repeat(h, 0)
    sub[m] = np.maximum(sub[m], bb[m])
    nprops += 1
print('props with walk-behind:', nprops)
# everything else that stands up (walls, parapets, ruins, posts): the hero can tuck in behind its top edge, legs hidden.
# In each column, a vertical run of standing pixels with ground just above it gives up its top TUCK px (never its foot).
TUCK = 20
propm = foot | behind
big = raised2 & ~propm
okabove = ~cv2.dilate(sky.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool) & ~raised2
tuck = np.zeros((H, W), bool)
for x in range(W):
    col = big[:, x]
    if not col.any(): continue
    d_ = np.diff(np.concatenate([[0], col.view(np.int8), [0]]))
    tops = np.where(d_ == 1)[0]; bots = np.where(d_ == -1)[0] - 1
    for t, b in zip(tops, bots):
        n_ = b - t + 1
        base[t:b + 1, x] = np.maximum(base[t:b + 1, x], b)
        if n_ < 14 or t < 2 or not okabove[t - 1, x]: continue
        ft = int(np.clip(round(n_ * 0.3), 6, 14))
        e = min(t + TUCK, b - ft)
        if e > t: tuck[t:e + 1, x] = True
tuck = cv2.morphologyEx(tuck.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, 5), np.uint8)) > 0   # no one-column slivers
behind |= tuck
print('tuck-behind px:', int(tuck.sum()))
yy = np.arange(H)[:, None].repeat(W, 1)
height = np.where(base > 0, np.clip(base - yy, 0, 65535), 0)
solid = (raised2 & ~behind)                                                # walls, cliffs, trees, prop feet
MX, UP, DN = 5, 1, 3
k = np.ones((UP + DN + 1, 2 * MX + 1), np.uint8)
blocked = cv2.dilate(solid.astype(np.uint8), k, anchor=(MX, UP)) > 0
void = cv2.dilate(sky.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0     # sky and cloud sea, with a safety rim
ground = (~raised2 | behind) & ~void
walk = ground & ~blocked & ~c1
def rect(m, x0, y0, x1, y1, v): m[y0:y1, x0:x1] = v
FORCE_ON = [
    (612, 1204, 692, 1445),   # through the gate (hidden strip behind the lintel + the opening)
    (641, 726, 684, 905),     # through the nave doorway
    (322, 578, 398, 630),     # behind the arcade top
    (484, 1198, 552, 1230),
    (205, 702, 400, 730),     # between the arcade and the pond rim
    (188, 730, 242, 780), (203, 718, 242, 762),     # round the pond's west side
    (540, 358, 600, 386), (455, 404, 500, 428),     # north path, west of the gable
    (745, 1196, 812, 1228),   # right graveyard path joins the gate junction
    (585, 352, 722, 388),     # upper terrace path behind the nave's north gable   # left graveyard path joins the gate junction
    (316, 622, 343, 712), (368, 622, 397, 712),   # through two arcade arches
    # floor hidden behind the nave columns (the shaft area above each footprint)
    (548, 560, 584, 632), (536, 618, 578, 698), (746, 560, 784, 642), (766, 620, 798, 698), (786, 690, 816, 742),
]
FORCE_OFF = [
    (300, 330, 400, 404),     # the tower door itself
    (948, 346, 1040, 400),    # the overlook bench
    # column footprints
    (544, 632, 588, 658), (532, 698, 582, 726), (742, 642, 788, 670), (762, 698, 802, 726), (782, 742, 820, 770),
]
for r in FORCE_ON: rect(walk, *r, True)
FUNNELS = [  # ground hidden behind a wall that has an opening: the full width behind the wall top, narrowing to the doorway
    [(520, 1222), (780, 1222), (780, 1296), (694, 1360), (694, 1445), (610, 1445), (610, 1360), (520, 1296)],   # south gate
    [(566, 722), (764, 722), (764, 768), (690, 802), (690, 905), (636, 905), (636, 802), (566, 768)],           # nave doorway
]
fm = np.zeros((H, W), np.uint8)
for poly in FUNNELS: cv2.fillPoly(fm, [np.array(poly, np.int32)], 1)
walk |= fm > 0
for r in FORCE_OFF: rect(walk, *r, False)
walk[1300:, :606] = False; walk[1300:, 699:] = False                       # south of the wall line only the gate passage and the entry stairs
pm = np.zeros((H, W), np.uint8); cv2.ellipse(pm, (307, 774), (76, 37), 0, 0, 360, 1, -1); walk &= pm == 0   # the pond and its rim
SPAWN = (650, 1572)
n, lab, st, ce = cv2.connectedComponentsWithStats(walk.astype(np.uint8), connectivity=8)
pre = walk.copy()
for i in np.argsort(-st[1:,4])[:14]+1: print('comp', i, st[i].tolist(), ce[i].round().tolist(), '<- spawn' if i==lab[SPAWN[1], SPAWN[0]] else '')
walk = lab == lab[SPAWN[1], SPAWN[0]]
Image.fromarray((walk * 255).astype(np.uint8)).save(f'{OUT}/walk.png')
hp = np.zeros((H, W, 3), np.uint8); hp[..., 0] = height & 255; hp[..., 1] = height >> 8
Image.fromarray(hp).save(f'{OUT}/height.png')
np.save('map/walk.npy', walk); np.save('map/height.npy', height)
# keep only what the hero's body can really reach: erode by the body radius, take the spawn's region, grow it back
_el = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
_er = cv2.erode(walk.astype(np.uint8), _el)
_n, _lab = cv2.connectedComponents(_er, connectivity=8)
walk &= cv2.dilate((_lab == _lab[SPAWN[1], SPAWN[0]]).astype(np.uint8), _el) > 0
Image.fromarray((walk * 255).astype(np.uint8)).save(f'{OUT}/walk.png'); np.save('map/walk.npy', walk)
print('walkable px', int(walk.sum()))
er = cv2.erode(walk.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
n_, lab_, st_, _c = cv2.connectedComponentsWithStats(er, connectivity=8)
sp = lab_[SPAWN[1], SPAWN[0]]
print('reachable by the hero (radius 6):', int(st_[sp, 4]), 'px; unreachable islands:', [st_[i].tolist() for i in range(1, n_) if i != sp and st_[i, 4] > 600])
np.save('map/reach.npy', lab_ == sp)

# ---------- check image
o = art.astype(float)
o[walk] = o[walk] * 0.55 + np.array([0, 255, 120]) * 0.45
lost = pre & ~walk; o[lost] = o[lost]*0.5 + np.array([255,60,0])*0.5
hh = height > 0
o[hh] = o[hh] * 0.6 + np.array([80, 120, 255]) * 0.4
Image.fromarray(o.astype(np.uint8)).save('map/chk_build2.png')
Image.fromarray(o.astype(np.uint8)).resize((960, 1200), Image.LANCZOS).save('map/chk_build2_s.jpg', quality=88)
