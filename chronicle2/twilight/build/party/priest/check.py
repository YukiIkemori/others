"""Checks of the brief on the finished sheets. usage: python3 check.py <dir>"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools'); import pixlib as P
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import shape
d = sys.argv[1]
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
EYE = (34, 26, 30)
for n in ('priest.png', 'priest_run.png'):
    im = Image.open(os.path.join(d, n)); S = np.array(im.convert('RGBA'))
    a = S[..., 3] > 0
    print(n, im.size, im.mode, 'alpha values', np.unique(S[..., 3]).tolist())
    r, g, b = [S[..., i].astype(int) for i in range(3)]
    print('  magenta-cast pixels:', int((a & (np.minimum(r, b) - g > 70) & (r > 150)).sum()))
    L = P.srgb_to_lab(S[..., :3].astype(float))[..., 0]
    eye = (S[..., :3] == EYE).all(-1) & a
    print('  near-black (L<12.5) non-eye pixels:', int((a & (L < 12.5) & ~eye).sum()), ' darkest non-eye L %.1f' % L[a & ~eye].min())
    print('  colours:', len(np.unique(S[a][:, :3], axis=0)))
    for R in range(8):
        row = []
        for C in range(4):
            fr = S[R * 128:(R + 1) * 128, C * 96:(C + 1) * 96]; fa = fr[..., 3] > 0
            lab, k = nd.label(fa, structure=np.ones((3, 3)))
            sizes = nd.sum(fa, lab, range(1, k + 1))
            top, hcx = shape.head(fa); sole = shape.sole(fa) - 1
            ys, xs = np.where(fa)
            ne = int(((fr[..., :3] == EYE).all(-1) & fa).sum())
            row.append('h%d sole%d hx%.0f eye_px%d parts%s x%d-%d y%d-%d' % (sole - top + 1, sole, hcx, ne, [int(v) for v in sizes if v < 40], xs.min(), xs.max(), ys.min(), ys.max()))
        print('  %-10s' % NAMES[R], ' | '.join(row))
print(json.load(open(os.path.join(d, 'priest.json'))))
