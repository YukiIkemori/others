"""Head measures per frame of a built sheet: dome width 6 rows under the hair top (staff excluded), eye distance.
usage: python3 measure.py <dir with walk_raw.png / run_raw.png or final sheets> [walk.png run.png]"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools')
import pixlib as P
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shape
d = sys.argv[1]
names = sys.argv[2:] or ['walk_raw.png', 'run_raw.png']
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
for n in names:
    S = np.array(Image.open(d + '/' + n).convert('RGBA'))
    print(n)
    for R in range(8):
        out = []
        for C in range(4):
            fr = S[R * 128:(R + 1) * 128, C * 96:(C + 1) * 96]
            a = fr[..., 3] > 0
            top, hcx = shape.head(a)
            b = shape.open_disc(a, 5.0)
            w = [int(b[top + k].sum()) for k in (3, 6, 9)]
            bot = shape.sole(a) - 1
            L = P.srgb_to_lab(fr[..., :3].astype(np.float64))[..., 0]
            dark = a & (L < 14); dark[:top + 8] = False; dark[top + 24:] = False
            lab, k = nd.label(dark)
            cx = sorted([nd.center_of_mass(lab == i + 1)[1] for i in range(k) if (lab == i + 1).sum() <= 12])
            ed = round(cx[-1] - cx[0], 1) if len(cx) >= 2 else '-'
            out.append('top%d h%d w%s eyes%s' % (top, bot - top + 1, w, ed))
        print('  %-10s' % NAMES[R], ' | '.join(out))
