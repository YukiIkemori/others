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
    ((120, 505, 292, 702), 765),         # maple canopy
]
base = np.zeros((H, W), np.int32)        # ground-contact y of each class-1 pixel (0 = none)
for (x0, y0, x1, y1), b in C1:
    sub = raised0[y0:y1, x0:x1]
    cur = base[y0:y1, x0:x1]
    cur[sub] = np.maximum(cur[sub], b)
for (x0, y0, x1, y1) in [(314, 622, 345, 700), (366, 622, 399, 700)]: base[y0:y1, x0:x1] = 0   # plants seen through the arches are behind
yy = np.arange(H)[:, None].repeat(W, 1)
height = np.where(base > 0, np.clip(base - yy, 0, 65535), 0)
c1 = base > 0

# ---------- walkable
raised2 = raised0 & ~walk0 & ~c1
n, lab, st, _ = cv2.connectedComponentsWithStats(raised2.astype(np.uint8), connectivity=8)
small = np.isin(lab, [i for i in range(1, n) if st[i, 4] < 120])           # flower specks do not block
raised2 &= ~small
MX, UP, DN = 12, 3, 7
k = np.ones((UP + DN + 1, 2 * MX + 1), np.uint8)
blocked = cv2.dilate(raised2.astype(np.uint8), k, anchor=(MX, UP)) > 0     # raised px within dx<=MX, dy in [-UP, +DN]
walk = walk0 & ~blocked & ~c1
def rect(m, x0, y0, x1, y1, v): m[y0:y1, x0:x1] = v
FORCE_ON = [
    (612, 1226, 692, 1445),   # through the gate (hidden strip behind the lintel + the opening)
    (641, 726, 684, 905),     # through the nave doorway
    (322, 578, 398, 630),     # behind the arcade top
    (484, 1198, 552, 1230),
    (226, 706, 302, 723),     # between the arcade flowers and the pond rim   # left graveyard path joins the gate junction
    (316, 622, 343, 712), (368, 622, 397, 712),   # through two arcade arches
    # floor hidden behind the nave columns (the shaft area above each footprint)
    (548, 560, 584, 632), (536, 618, 578, 698), (746, 560, 784, 642), (766, 620, 798, 698), (786, 690, 816, 742),
]
FORCE_OFF = [
    (300, 330, 400, 404),     # the tower door itself
    # column footprints
    (544, 632, 588, 658), (532, 698, 582, 726), (742, 642, 788, 670), (762, 698, 802, 726), (782, 742, 820, 770),
]
for r in FORCE_ON: rect(walk, *r, True)
for r in FORCE_OFF: rect(walk, *r, False)
SPAWN = (650, 1572)
n, lab, st, ce = cv2.connectedComponentsWithStats(walk.astype(np.uint8), connectivity=8)
pre = walk.copy()
for i in np.argsort(-st[1:,4])[:14]+1: print('comp', i, st[i].tolist(), ce[i].round().tolist(), '<- spawn' if i==lab[SPAWN[1], SPAWN[0]] else '')
walk = lab == lab[SPAWN[1], SPAWN[0]]
Image.fromarray((walk * 255).astype(np.uint8)).save(f'{OUT}/walk.png')
hp = np.zeros((H, W, 3), np.uint8); hp[..., 0] = height & 255; hp[..., 1] = height >> 8
Image.fromarray(hp).save(f'{OUT}/height.png')
np.save('map/walk.npy', walk); np.save('map/height.npy', height)
print('walkable px', int(walk.sum()))

# ---------- check image
o = art.astype(float)
o[walk] = o[walk] * 0.55 + np.array([0, 255, 120]) * 0.45
lost = pre & ~walk; o[lost] = o[lost]*0.5 + np.array([255,60,0])*0.5
hh = height > 0
o[hh] = o[hh] * 0.6 + np.array([80, 120, 255]) * 0.4
Image.fromarray(o.astype(np.uint8)).save('map/chk_build2.png')
Image.fromarray(o.astype(np.uint8)).resize((960, 1200), Image.LANCZOS).save('map/chk_build2_s.jpg', quality=88)
