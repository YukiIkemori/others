"""Brings a hero sprite sheet into the game and measures where its lantern is in every frame.

  python3 hero_import.py /path/to/hero_sheet.png /path/to/hero_sheet.json

The sheet is 4 columns (stand, left foot, passing, right foot) by 4 rows (facing down, left, right, up).
The json next to it gives the frame size, the foot anchor and the time per frame.
Writes site/hero.png and site/hero.json; the game reads everything it needs about the sprite from those two.
"""
import os, sys, json
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.environ.get('SITE', os.path.join(HERE, '..', 'site'))
WORK = os.environ.get('WORK', os.path.join(HERE, 'work'))
# roughly where the lantern's flame sits when standing, measured from the foot anchor: (right, up) per facing
HINT = json.loads(os.environ.get('LANTERN_HINT', '[[-17, 32], [-12, 30], [12, 29], [15, 32]]'))

src, spec = sys.argv[1], json.load(open(sys.argv[2]))
im = np.asarray(Image.open(src).convert('RGBA'))
FW, FH = spec['frame']
AX, AY = spec['foot_anchor']
assert im.shape[:2] == (FH * 4, FW * 4), im.shape
r, g, b, a = [im[..., k].astype(int) for k in range(4)]
flame = (a > 0) & (r >= 225) & (g >= 120) & (b <= 150) & (r - b >= 110)       # the lit glass: orange to pale yellow

lantern = []
for row in range(4):
    out = []
    for col in range(4):
        hx, hy = AX + HINT[row][0], AY - HINT[row][1]
        f = flame[row * FH:(row + 1) * FH, col * FW:(col + 1) * FW]
        ys, xs = np.nonzero(f)
        near = (np.abs(xs - hx) <= 9) & (np.abs(ys - hy) <= 9)
        if near.sum() >= 2:
            out.append([int(round(xs[near].mean())), int(round(ys[near].mean()))])
        else:
            out.append([hx, hy])
    lantern.append(out)

os.makedirs(SITE, exist_ok=True)
Image.fromarray(im, 'RGBA').save(os.path.join(SITE, 'hero.png'), optimize=True)
json.dump({'frame': [FW, FH], 'foot': [AX, AY], 'ms': spec.get('walk_ms_per_frame', round(1000 / spec.get('walk_fps', 6))),
           'lantern': lantern}, open(os.path.join(SITE, 'hero.json'), 'w'))
# a check picture: every frame enlarged, with the measured lantern point marked in green
chk = np.zeros((FH * 4, FW * 4, 3), np.uint8) + np.array([93, 74, 102], np.uint8)
m = im[..., 3] > 0
chk[m] = im[..., :3][m]
for row in range(4):
    for col in range(4):
        x, y = lantern[row][col]
        chk[row * FH + y, col * FW + x] = (0, 255, 0)
os.makedirs(WORK, exist_ok=True)
Image.fromarray(chk).resize((FW * 16, FH * 16), Image.NEAREST).save(os.path.join(WORK, 'hero_check.png'))
print('hero imported', (FW, FH), 'foot', (AX, AY), 'lantern', lantern)
