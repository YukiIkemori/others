"""Mechanical checks of the delivered sheets. usage: python3 check.py <dir with id.png, id_run.png, id.json> <id>"""
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools')
import pixlib as P
d, cid = sys.argv[1], sys.argv[2]
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
js = json.load(open(os.path.join(d, cid + '.json'))); print(js)
for name in (cid + '.png', js['run']['src']):
    s = np.array(Image.open(os.path.join(d, name)).convert('RGBA'))
    a = s[..., 3] > 0
    print(name, s.shape, 'alpha values', np.unique(s[..., 3]).tolist())
    cols, cnt = np.unique(s[a][:, :3], axis=0, return_counts=True)
    lab = P.srgb_to_lab(cols.astype(float))
    print('  colours', len(cols), ' near-black (L<13):', [('#%02x%02x%02x' % tuple(c), int(n)) for c, n, l in zip(cols, cnt, lab) if l[0] < 13])
    r, g, b = [s[..., i].astype(int) for i in range(3)]
    mag = a & (np.minimum(r, b) - g > 40) & (np.abs(r - b) < 80)
    print('  magenta-ish pixels', int(mag.sum()), [('#%02x%02x%02x' % tuple(c)) for c in np.unique(s[mag][:, :3], axis=0)][:6])
    for R in range(8):
        row = []
        for C in range(4):
            f = a[R * 128:(R + 1) * 128, C * 96:(C + 1) * 96]
            ys, xs = np.where(f)
            lab_, n = nd.label(f, structure=np.ones((3, 3)))
            sizes = nd.sum(f, lab_, range(1, n + 1))
            stray = int((np.array(sizes) < 0.5 * max(sizes)).sum())
            edge = bool(f[0].any() or f[-1].any() or f[:, 0].any() or f[:, -1].any())
            row.append('h%2d bot%3d x%2d-%2d%s%s' % (ys.max() - ys.min() + 1, ys.max(), xs.min(), xs.max(), ' STRAY%d' % stray if stray else '', ' EDGE' if edge else ''))
        print('  %-10s' % NAMES[R], ' | '.join(row))
