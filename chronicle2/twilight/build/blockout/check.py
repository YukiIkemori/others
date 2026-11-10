"""Automatic check that replaces walking around the map by hand.
Compares the warped 3D data with the image model's own "what stands up" mask of the repaint:
  - prints agreement figures,
  - drops low 3D props the painter did not draw (they would be invisible obstacles),
  - writes an overview picture (green = agree, red = only in 3D, blue = only in the paint).
usage: check.py stage_dir paint.png m_raised.png pts_mask.npy(from match.py st_paint.png m_raised.png) report.jpg"""
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ni
from warp import fit
STAGE, PAINT, MASK, PTS, REPORT = sys.argv[1:6]
h = np.load(f'{STAGE}/h_paint.npy'); H, W = h.shape; st = h > 0
walk = np.array(Image.open(f'{STAGE}/walk.png').convert('L'))
DX, DY, _ = fit(np.load(PTS), H, W)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
mp = cv2.remap(np.array(Image.open(MASK).convert('L')), xx + DX, yy + DY, cv2.INTER_NEAREST) > 127
inside = np.array(Image.open(f'{STAGE}/map.webp').convert('RGBA'))[..., 3] > 0
# only the part of the map a player can get near matters
near = ni.binary_dilation(walk > 127, iterations=40) & inside
d_st = ni.distance_transform_edt(~st); d_m = ni.distance_transform_edt(~mp)
a = ((d_m <= 4) & st & near).sum() / max(1, (st & near).sum()); b = ((d_st <= 4) & mp & near).sum() / max(1, (mp & near).sum())
print('3D objects that are also painted (within 4 px): %.1f %%' % (100 * a))
print('painted objects that exist in 3D (within 4 px): %.1f %%' % (100 * b))
lab, n = ni.label(st); idx = np.arange(1, n + 1)
area = ni.sum(st, lab, idx); cov = ni.sum(ni.binary_dilation(mp, iterations=4) & st, lab, idx) / np.maximum(area, 1); hmax = ni.maximum(h, lab, idx)
drop = np.zeros(n + 1, bool); drop[1:] = (area >= 120) & (cov < 0.3) & (hmax <= 60)
dm = drop[lab]
print('3D props the painter did not draw, removed:', int(drop.sum()), [tuple(int(v) for v in ni.center_of_mass(dm, lab, i)[::-1]) for i in np.nonzero(drop)[0]])
h[dm] = 0
# their footprint becomes walkable only where it is enclosed by walkable ground
opened = ni.binary_dilation(dm, iterations=2) & (walk == 0) & ni.binary_dilation(walk > 127, iterations=30)
lab2, n2 = ni.label(walk == 0)
for i in np.unique(lab2[opened]):
    comp = lab2 == i
    if comp.sum() < 3000 and (dm & comp).sum() > 0.2 * comp.sum(): walk[comp] = 255
hp = np.zeros((H, W, 3), np.uint8); hp[..., 0] = h & 255; hp[..., 1] = h >> 8
Image.fromarray(hp).save(f'{STAGE}/height.png'); Image.fromarray(walk).save(f'{STAGE}/walk.png'); np.save(f'{STAGE}/h_paint.npy', h)
st = h > 0
rgb = np.array(Image.open(PAINT).convert('RGB')).astype(float) * 0.6
rgb[st & mp] += (0, 70, 0); rgb[st & ~mp] += (130, 0, 0); rgb[mp & ~st] += (0, 0, 140)
Image.fromarray(rgb.clip(0, 255).astype('uint8')).resize((W // 2, H // 2)).save(REPORT, quality=88)
json.dump(dict(painted_of_3d=round(float(a), 4), in3d_of_painted=round(float(b), 4), removed=int(drop.sum())), open(f'{STAGE}/check.json', 'w'))
