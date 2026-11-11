"""Automatic check that replaces walking around the map by hand.
Compares the warped 3D data with the image model's own "what stands up" mask of the repaint:
  - prints agreement figures,
  - drops low 3D props the painter did not draw (they would be invisible obstacles),
  - writes an overview picture (green = agree, red = only in 3D, blue = only in the paint).
usage: check.py stage_dir paint.png m_raised.png pts_mask.npy(from match.py st_paint.png m_raised.png) report.jpg [adopt]"""
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ni
from warp import fit
STAGE, PAINT, MASK, PTS, REPORT = sys.argv[1:6]
ADOPT = len(sys.argv) > 6 and sys.argv[6] == 'adopt'       # multi-level maps: give collision to upright things only the painter drew
MULTI = os.path.exists(f'{STAGE}/standing_paint.npy')          # multi-level maps: the bake says what stands; nothing is edited, report only
if MULTI: st = np.load(f'{STAGE}/standing_paint.npy'); H, W = st.shape; h = st.astype(np.uint16) * 100
else: h = np.load(f'{STAGE}/h_paint.npy'); H, W = h.shape; st = h > 0
walk = np.array(Image.open(f'{STAGE}/walk.png').convert('L'))
DX, DY, _ = fit(np.load(PTS), H, W)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
mp = cv2.remap(np.array(Image.open(MASK).convert('L')), xx + DX, yy + DY, cv2.INTER_NEAREST) > 127
inside = np.array(Image.open(f'{STAGE}/map.webp').convert('RGBA'))[..., 3] > 0
Image.fromarray((mp & inside).astype(np.uint8) * 255).convert('1').save(f'{STAGE}/raised.png')   # the painter's own outline of what stands up; the HD-2D view trims the relief with it
# only the part of the map a player can get near matters
near = ni.binary_dilation(walk > 127, iterations=40) & inside
d_st = ni.distance_transform_edt(~st); d_m = ni.distance_transform_edt(~mp)
a = ((d_m <= 4) & st & near).sum() / max(1, (st & near).sum()); b = ((d_st <= 4) & mp & near).sum() / max(1, (mp & near).sum())
print('3D objects that are also painted (within 4 px): %.1f %%' % (100 * a))
print('painted objects that exist in 3D (within 4 px): %.1f %%' % (100 * b))
lab, n = ni.label(st); idx = np.arange(1, n + 1)
area = ni.sum(st, lab, idx); cov = ni.sum(ni.binary_dilation(mp, iterations=4) & st, lab, idx) / np.maximum(area, 1); hmax = ni.maximum(h, lab, idx)
drop = np.zeros(n + 1, bool); drop[1:] = (area >= 120) & (cov < 0.3) & ((hmax <= 60) | MULTI)
dm = drop[lab]
print('3D props the painter did not draw (removed on single-level maps, listed only on multi-level ones):', int(drop.sum()), [tuple(int(v) for v in ni.center_of_mass(dm, lab, i)[::-1]) for i in np.nonzero(drop)[0]])
if MULTI:
    lab3, n3 = ni.label(mp & ~ni.binary_dilation(st, iterations=6) & near); a3 = ni.sum(np.ones_like(lab3), lab3, np.arange(1, n3 + 1))
    big = [(int(a3[i]), tuple(int(v) for v in ni.center_of_mass(lab3 == i + 1)[::-1])) for i in np.argsort(-a3)[:8] if a3[i] >= 400]
    print('painted as standing but flat in 3D (largest areas, px and centre):', big)
    # upright things the painter added on walkable ground (standing stones …) are adopted: they get collision at their foot and stand as a
    # flat card on the ground they rise from, so actors pass behind them.  Wide low shapes (glowing circles on the ground) are left alone.
    adopted = []
    if ADOPT:
        st0 = st.copy(); raised = mp & inside
        unpack = lambda p: (lambda q: q[..., 0] + 256 * q[..., 1])(np.array(Image.open(p).convert('RGB')).astype(np.uint16))
        hh = unpack(f'{STAGE}/height.png'); ff = unpack(f'{STAGE}/floor.png'); wk = walk > 127
        # what lies behind a near thing (HD-2D view): the first surface behind it, and the ground behind it
        bb = unpack(f'{STAGE}/behind.png') if os.path.exists(f'{STAGE}/behind.png') else None
        uu = unpack(f'{STAGE}/under.png') if os.path.exists(f'{STAGE}/under.png') else None
        lab4, n4 = ni.label(ni.binary_dilation(ni.binary_erosion(lab3 > 0, iterations=5), iterations=5) & (lab3 > 0))   # opening: rim lines and root tips fall away
        a4 = ni.sum(np.ones_like(lab4), lab4, np.arange(1, n4 + 1))
        for i, sl in enumerate(ni.find_objects(lab4)):
            if a4[i] < 400: continue
            blob = lab4[sl] == i + 1; bh, bw = blob.shape
            ys, xs = np.nonzero(blob); foot = sl[0].start + int(np.percentile(ys, 98)); x0 = sl[1].start
            if bh < 1.25 * bw or bh < 40 or (blob & wk[sl]).sum() < .5 * blob.sum(): continue
            base = wk[max(0, foot - 6):foot + 10, x0:x0 + bw]; fl = ff[max(0, foot - 6):foot + 10, x0:x0 + bw][base]
            if not fl.size: continue
            F0 = int(np.median(fl)); rows = np.arange(sl[0].start, sl[0].stop)[:, None]
            # the card is cut 5 dots fatter than the mask: the painted dark rim must stand with the thing, or it stays behind on the ground
            big = (slice(max(0, sl[0].start - 6), sl[0].stop), slice(max(0, sl[1].start - 6), min(W, sl[1].stop + 6)))
            fat = np.zeros((big[0].stop - big[0].start, big[1].stop - big[1].start), bool); fat[sl[0].start - big[0].start:, sl[1].start - big[1].start:][:bh, :bw] = blob
            rows_b = np.arange(big[0].start, big[0].stop)[:, None]
            card = ni.binary_dilation(fat, iterations=5) & (rows_b <= foot) & ~st0[big]
            for far in (bb, uu):                                                    # behind an adopted thing lies the ground it was painted on
                if far is not None: far[big][card] = hh[big][card]
            hh[big][card] = np.broadcast_to(np.clip(foot + F0 - rows_b, 0, 65535), card.shape)[card].astype(np.uint16)
            raised[big] |= card
            fp = blob & (rows > foot - max(8, int(.34 * bw)))                       # footprint: the lowest part of the shape
            fp = ni.binary_dilation(fp, iterations=2)
            walk[sl][fp] = 0; ff[sl][fp] = 0; st[sl] |= blob
            adopted.append((int(x0 + bw / 2), int(foot), int(a4[i])))
        pk = lambda v: np.dstack([v & 255, v >> 8, np.zeros_like(v)]).astype(np.uint8)
        Image.fromarray(pk(hh)).save(f'{STAGE}/height.png'); Image.fromarray(pk(ff)).save(f'{STAGE}/floor.png'); Image.fromarray(walk).save(f'{STAGE}/walk.png')
        np.save(f'{STAGE}/standing_paint.npy', st)
        if bb is not None: Image.fromarray(pk(bb)).save(f'{STAGE}/behind.png')
        if uu is not None: Image.fromarray(pk(uu)).save(f'{STAGE}/under.png')
        Image.fromarray(raised.astype(np.uint8) * 255).convert('1').save(f'{STAGE}/raised.png')
        print('painter additions adopted (x, foot y, px):', adopted)
    rgb = np.array(Image.open(PAINT).convert('RGB')).astype(float) * 0.6
    rgb[st & mp] += (0, 70, 0); rgb[st & ~mp] += (130, 0, 0); rgb[mp & ~st] += (0, 0, 140)
    Image.fromarray(rgb.clip(0, 255).astype('uint8')).save(REPORT, quality=88)
    json.dump(dict(painted_of_3d=round(float(a), 4), in3d_of_painted=round(float(b), 4), unpainted=int(drop.sum()), adopted=adopted), open(f'{STAGE}/check.json', 'w'))
    sys.exit(0)
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
