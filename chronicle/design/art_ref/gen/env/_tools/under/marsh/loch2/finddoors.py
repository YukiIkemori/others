import json, sys, numpy as np
from PIL import Image
from scipy import ndimage
src = sys.argv[1]
d = json.load(open('layout.json')); W, H = d['w'], d['h']; T = 32
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
L = A.mean(2)
dark = ndimage.uniform_filter((L < 40).astype(float), (22, 14))
extra = []
out = {}
for b in json.load(open('blds.json')) + extra:
    if not b.get('door'): continue
    dx, dy = b['door']; cx, cy = dx * T + 16, dy * T + 16
    y0, y1, x0, x1 = max(0, cy - 4 * T), min(H * T, cy + 4 * T), max(0, cx - 3 * T), min(W * T, cx + 3 * T)
    sub = dark[y0:y1, x0:x1]
    iy, ix = np.unravel_index(np.argmax(sub), sub.shape)
    py, px = iy + y0, ix + x0
    # bottom of the dark region below the centre
    col = L[py:py + 40, px - 3:px + 4].mean(1)
    bot = py + int(np.argmax(col > 70)) if (col > 70).any() else py + 12
    out[b['id']] = dict(expect=[cx, dy * T + 30], found=[int(px), int(bot)], dxy=[int(px - cx), int(bot - (dy * T + 30))], score=round(float(sub.max()), 2))
    print('%-18s expect x %4d bottom %4d | found x %4d bottom %4d | dx %+4d dy %+4d  (%.2f)' % (b['id'], cx, dy * T + 30, px, bot, px - cx, bot - (dy * T + 30), sub.max()))
json.dump(out, open(src.replace('.png', '_doors.json'), 'w'), indent=1)
