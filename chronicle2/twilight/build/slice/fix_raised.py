"""The painter's mask of what stands up has holes (dark doors and windows) and calls cliff faces flat.
Inside the 3D outline the bake knows better: raised = mask OR (standing shrunk by a few dots).

With 'tops' the upper edge of every raised thing is also moved up to the painted outline when that lies within 14 dots
above it (run this once per staging).  The mask often stops short of a chimney's head or a roof's crest; in the HD-2D view
the part left out lies on the ground and slides away from its thing as the camera moves (a chimney head in the lane).
usage: fix_raised.py slice/<map> [shrink=7] [tops]"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ni
d = sys.argv[1]; k = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 7
m = np.array(Image.open(f'{d}/raised.png').convert('L')) > 127
st = np.load(f'{d}/standing_paint.npy').astype(bool)
out = m | ni.binary_erosion(st, iterations=k)
print(d, 'raised %.1f %% -> %.1f %%' % (100 * m.mean(), 100 * out.mean()))
if 'tops' in sys.argv:
    REACH = 14
    rgb = np.array(Image.open(f'{d}/map.webp').convert('RGB')).astype(np.float32); lum = rgb @ np.array([.3, .59, .11], np.float32)
    H, W = out.shape
    K = np.zeros((H, W), np.int16)                                     # for a top-edge dot: how many dots above it the outline lies
    top = out.copy(); top[1:] &= ~out[:-1]; top[:REACH + 4] = False
    ys, xs = np.nonzero(top)
    for y, x in zip(ys, xs):
        col = lum[y - REACH - 3:y, x][::-1]                            # col[0] is the dot just above the edge
        if out[y - REACH:y, x].any(): continue                          # another raised thing right above: nothing to guess
        for kk in range(REACH, 1, -1):                                  # the farthest dark dot that has clearly lighter dots beyond it
            if col[kk - 1] < 70 and col[kk:kk + 3].min() > col[kk - 1] + 22: K[y, x] = kk; break
    add = np.zeros_like(out); n = 0
    for y, x in zip(ys, xs):
        kk = K[y, x]
        if not kk: continue
        near = [K[yy, xx] for xx in range(max(0, x - 3), min(W, x + 4)) for yy in range(max(0, y - 3), min(H, y + 4)) if K[yy, xx]]
        if len(near) >= 4 and abs(np.median(near) - kk) <= 3: add[y - kk:y, x] = True; n += 1      # neighbours agree: an edge, not a speck
    out |= add
    dark = ni.binary_closing(out, iterations=4) & ~out & (lum < 62)       # a dark notch in a thing's top (a chimney's mouth) belongs to it
    out |= dark; print('dark notches closed: %d dots' % int(dark.sum()))
    print('tops moved up to the painted outline: %d columns, %d dots' % (n, int(add.sum())))
Image.fromarray(out.astype(np.uint8) * 255).convert('1').save(f'{d}/raised.png')
