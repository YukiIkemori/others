"""Chimney heads (and other narrow things that stand up above a roof) that the painter's mask stops short of.

fix_raised.py 'tops' moves a top edge up to a dark painted outline.  A chimney's cap is often light stone with no dark
line under the sky side, so its top dozen dots stayed "ground": in the HD-2D view the cap lay flat in the lane behind the
house and slid away from its chimney.  Here every narrow top (8..56 dots wide, the edge drops away on both sides) grows
upwards while the dots look like the thing below them and not like the ground to the left and right of it.
usage: fix_heads.py slice/<map> [preview.png]      (safe to run again: it only adds)"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ni
d = sys.argv[1]
m = np.array(Image.open(f'{d}/raised.png').convert('L')) > 127
rgb = np.array(Image.open(f'{d}/map.webp').convert('RGB')).astype(np.float32)
H, W = m.shape
REACH, DROP = 22, 8
add = np.zeros_like(m); found = []
narrow = m & ~ni.binary_opening(m, structure=np.ones((1, 61), bool))          # what is narrower than 60 dots: chimneys, posts, trunks
lab, n = ni.label(narrow, structure=np.ones((3, 3)))
for i, sl in enumerate(ni.find_objects(lab)):
    part = lab[sl] == i + 1; h, w = part.shape
    if h < 16 or w < 8 or w > 60: continue
    xs = np.nonzero(part[:10].any(0))[0]; x0, x1 = sl[1].start + int(xs.min()), sl[1].start + int(xs.max())
    full = np.nonzero(m[sl[0].start:sl[0].start + 12, x0:x1 + 1].mean(1) > .8)[0]          # the mask's top is ragged: start under the ragged rows
    if not len(full): continue
    y0 = sl[0].start + int(full[0])
    if x1 - x0 < 6 or x0 < 16 or x1 > W - 17 or y0 < REACH + 2: continue
    if m[sl[0].start - 4:sl[0].start, x0:x1 + 1].mean() > .7: continue                                   # something raised right above: not a free top
    if m[y0 + 1:y0 + DROP, x0 - 10:x0 - 6].any() or m[y0 + 1:y0 + DROP, x1 + 7:x1 + 11].any(): continue     # level with its neighbours: a wall's crest, not a head
    if m[y0 + 3:y0 + 16, x0 + 2:x1 - 1].mean() < .85: continue                          # a solid shaft under it
    bm = np.median(rgb[y0 + 2:y0 + 16, x0 + 2:x1 - 1].reshape(-1, 3), 0)
    ch = lambda c: c - c.mean(-1, keepdims=True)
    grown = 0
    for k in range(1, REACH + 1):
        y = y0 - k
        if m[y, x0:x1 + 1].mean() > .8 and y < sl[0].start: break                        # ran into the next thing
        sd = np.concatenate([rgb[y, x0 - 14:x0 - 5], rgb[y, x1 + 6:x1 + 15]])[~np.concatenate([m[y, x0 - 14:x0 - 5], m[y, x1 + 6:x1 + 15]])]
        if len(sd) < 4: break
        row = rgb[y, x0:x1 + 1]; sm = np.median(sd, 0)
        db = np.abs(ch(row) - ch(bm)).sum(-1); ds = np.abs(ch(row) - ch(sm)).sum(-1)
        like = (db + 6 < ds) | (np.abs(row - sm).sum(-1) > 90)                          # nearer the shaft's colour (grey over brown or green), or far from the ground's
        if like.mean() < .45: break
        add[y, x0 - 2:x1 + 3] |= np.pad(like, 2, mode='edge'); grown = k
    if grown >= 3:
        found.append((x0, x1, y0, grown))
        for k in range(grown + 1, grown + 4):                                             # the painter's dark line over the head, often dashed
            y = y0 - k; row = rgb[y, x0 - 2:x1 + 3]; lum = row @ np.array([.3, .59, .11], np.float32)
            sd = np.concatenate([rgb[y, x0 - 14:x0 - 5], rgb[y, x1 + 6:x1 + 15]]); sl_ = float(np.median(sd @ np.array([.3, .59, .11], np.float32)))
            dark = (lum < 85) & (lum < sl_ - 25)
            if dark.mean() < .12: break
            add[y, x0 - 2:x1 + 3] |= dark
add = ni.binary_closing(add, structure=np.ones((3, 3)), iterations=1) | add
# keep only what hangs together with the old mask
l2, _ = ni.label(add | m); keep = np.unique(l2[m]); add &= np.isin(l2, keep)
out = m | add
# a narrow notch open to the outside (the slot in a chimney's cap) is closed the same way, and the painter's dark line two
# dots outside the mask joins its thing: left as ground, both are copied onto the ground behind as grey or dark smudges
notch = ni.binary_closing(out, structure=np.ones((3, 3), bool), iterations=3) & ~out; notch[:8] = notch[-8:] = False; notch[:, :8] = notch[:, -8:] = False
lum = rgb @ np.array([.3, .59, .11], np.float32); g = (~out).astype(np.float32)
gl = ni.gaussian_filter(lum * g, 5) / np.maximum(ni.gaussian_filter(g, 5), 1e-3)
line = ni.binary_dilation(out, iterations=2) & ~out & (lum < 80) & (lum < gl - 28)
print('notches closed: %d dots, outline dots joined: %d' % (int(notch.sum()), int(line.sum()))); out |= notch | line; add |= notch | line
# a small hole inside a thing (a few dark dots of a chimney's mouth the mask missed) is "ground in plain view" for the HD-2D
# view, and its colour is then laid on the ground behind the thing as a dark blot: close holes up to 90 dots
holes = ni.binary_fill_holes(out) & ~out; hl, hn = ni.label(holes)
if hn:
    sz = ni.sum(holes, hl, np.arange(1, hn + 1)); small = np.isin(hl, 1 + np.nonzero(sz <= 90)[0])
    print('small holes closed: %d holes, %d dots' % (int((sz <= 90).sum()), int(small.sum()))); out |= small; add |= small
print(d, 'heads grown: %d things, %d dots' % (len(found), int(add.sum())))
for f in found: print('  x %d..%d  top y %d  +%d rows' % f)
Image.fromarray(out.astype(np.uint8) * 255).convert('1').save(f'{d}/raised.png')
if len(sys.argv) > 2:
    o = rgb.copy(); o[m] = o[m] * .6 + np.array([255, 0, 255]) * .4; o[add] = o[add] * .4 + np.array([0, 255, 255]) * .6
    Image.fromarray(o.astype(np.uint8)).save(sys.argv[2])
