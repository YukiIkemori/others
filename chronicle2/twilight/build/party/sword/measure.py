"""Print per frame: bbox, shield rim bbox (grey ring), skin bbox. usage: python3 measure.py <sheet.png> [rows]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools')
import pixlib as P
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
s = np.array(Image.open(sys.argv[1]).convert('RGBA'))
lab = P.srgb_to_lab(s[..., :3].astype(np.float64))
a = s[..., 3] > 0
grey = a & (np.abs(lab[..., 1]) < 5) & (np.abs(lab[..., 2]) < 9) & (lab[..., 0] > 36)
for R in range(8):
    out = []
    for C in range(4):
        g = grey[R * 128:(R + 1) * 128, C * 96:(C + 1) * 96]
        g = nd.binary_closing(g, structure=np.ones((3, 3)))
        l, n = nd.label(g, structure=np.ones((3, 3)))
        if not n:
            out.append('  -  '); continue
        sz = nd.sum(g, l, range(1, n + 1)); i = int(np.argmax(sz))
        ys, xs = np.where(l == i + 1)
        out.append('%2dx%2d(%3d)' % (xs.max() - xs.min() + 1, ys.max() - ys.min() + 1, sz[i]))
    print('%-10s' % NAMES[R], ' '.join(out))
