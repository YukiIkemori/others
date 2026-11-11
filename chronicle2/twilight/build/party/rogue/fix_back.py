"""Back views of the rogue: the generator left a near-black band with two skin dots under the headband, which reads as a masked face.
The inside of that band becomes ordinary hair, the dots become headband.   usage: fix_back.py sheet.png [more sheets]"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
DARK, MID, LIGHT, BAND, DOT = (0x33, 0x24, 0x1d), (0x4d, 0x37, 0x2a), (0x63, 0x3a, 0x25), (0x73, 0x55, 0x28), (0xdf, 0x9a, 0x6b)
FW, FH, ROWS = 96, 128, (3, 6, 7)                      # up, up_left, up_right
for path in sys.argv[1:]:
    a = np.array(Image.open(path).convert('RGBA')); n = 0
    for r in ROWS:
        for c in range(a.shape[1] // FW):
            f = a[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW]; op = f[..., 3] > 0
            if not op.any(): continue
            eq = lambda col: op & (f[..., :3] == col).all(-1)
            hair = eq(DARK) | eq(MID) | eq(LIGHT)
            top = np.nonzero(op.any(1))[0][0]; head = np.zeros_like(op); head[top:top + 27] = True
            cols = np.nonzero(hair[top:top + 12].any(0))[0]; head[:, :cols.min() + 1] = False; head[:, cols.max():] = False
            inner = ndi.binary_erosion(op, np.ones((3, 3), bool))
            lab, k = ndi.label(eq(DARK) & head & inner)
            for i in range(1, k + 1):
                blob = lab == i
                if blob.sum() < 12: continue                # strands stay
                ys, xs = np.nonzero(blob)
                keep = ((ys * 3 + xs * 5) % 7 == 0)          # a few dark dots stay as hair texture
                f[ys[~keep], xs[~keep], :3] = MID; n += int((~keep).sum())
            d = eq(DOT) & head & inner
            f[d, :3] = BAND; n += int(d.sum())
    Image.fromarray(a).save(path); print(path, 'pixels changed', n)
