"""Brings a hero sprite sheet into the game and measures where its lantern is in every frame.

  python3 hero_import.py /path/to/hero_sheet.png /path/to/hero_sheet.json [name]

The sheet is 4 columns (stand, left foot, passing, right foot) by 4 rows (facing down, left, right, up).
The json next to it gives the frame size, the foot anchor, the body height in dots and the time per frame.
The game draws the body 3 world units tall whatever its height in dots, so a finer sheet simply looks finer.
Writes site/<name>.png and site/<name>.json (name defaults to hero); the game reads everything it needs about the
sprite from those two.
"""
import os, sys, json
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.environ.get('SITE', os.path.join(HERE, '..', 'site'))
WORK = os.environ.get('WORK', os.path.join(HERE, 'work'))
# roughly where the lantern's flame sits when standing, measured from the foot anchor on a 48-dot body: (right, up) per facing
HINT = json.loads(os.environ.get('LANTERN_HINT', '[[-17, 32], [-12, 30], [12, 29], [15, 32]]'))

src, spec = sys.argv[1], json.load(open(sys.argv[2]))
NAME = sys.argv[3] if len(sys.argv) > 3 else 'hero'
BODY = spec.get('height_px', 48)
HS = BODY / 48.0                    # how much finer than a 48-dot body this sheet is
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
        hx, hy = int(round(AX + HINT[row][0] * HS)), int(round(AY - HINT[row][1] * HS))
        f = flame[row * FH:(row + 1) * FH, col * FW:(col + 1) * FW]
        ys, xs = np.nonzero(f)
        near = (np.abs(xs - hx) <= 9 * HS) & (np.abs(ys - hy) <= 9 * HS)
        if near.sum() >= 2:
            out.append([int(round(xs[near].mean())), int(round(ys[near].mean()))])
        else:
            out.append([hx, hy])
    lantern.append(out)

os.makedirs(SITE, exist_ok=True)
Image.fromarray(im, 'RGBA').save(os.path.join(SITE, NAME + '.png'), optimize=True)
json.dump({'frame': [FW, FH], 'foot': [AX, AY], 'body': BODY, 'ms': spec.get('walk_ms_per_frame', round(1000 / spec.get('walk_fps', 6))),
           'lantern': lantern}, open(os.path.join(SITE, NAME + '.json'), 'w'))
# a check picture: every frame enlarged, with the measured lantern point marked in green
chk = np.zeros((FH * 4, FW * 4, 3), np.uint8) + np.array([93, 74, 102], np.uint8)
m = im[..., 3] > 0
chk[m] = im[..., :3][m]
for row in range(4):
    for col in range(4):
        x, y = lantern[row][col]
        chk[row * FH + y, col * FW + x] = (0, 255, 0)
os.makedirs(WORK, exist_ok=True)
Image.fromarray(chk).resize((FW * 4 * max(1, round(4 / HS)), FH * 4 * max(1, round(4 / HS))), Image.NEAREST).save(os.path.join(WORK, NAME + '_check.png'))
print('hero imported', (FW, FH), 'foot', (AX, AY), 'lantern', lantern)
