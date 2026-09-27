import sys, numpy as np
from PIL import Image
o = sys.argv[1]
b = Image.open(o + '/fern@32.png').convert('RGB'); e = Image.open(o + '/fern_emit@32.png'); om = np.asarray(Image.open(o + '/fern_over@32.png'))[..., 3] > 0
a = np.asarray(b).astype(float) * 0.3
em = np.asarray(e).astype(float); al = em[..., 3:4] / 255
a = a * (1 - al) + em[..., :3] * al
a[om] = a[om] * 0.5 + np.array([255, 0, 255]) * 0.5
im = Image.fromarray(a.astype(np.uint8))
if len(sys.argv) > 3:
    x0, y0, x1, y1 = map(int, sys.argv[3].split(',')); im = im.crop((x0 * 32, y0 * 32, x1 * 32, y1 * 32))
else: im = im.resize((960, 896), Image.BOX)
im.save(sys.argv[2])
