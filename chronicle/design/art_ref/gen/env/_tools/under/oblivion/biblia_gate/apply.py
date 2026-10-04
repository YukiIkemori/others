"""Paste the stairway to 忘却の底 (gen1.png, a repaint of crop.png) into the Biblia town painting: only the stairway's box (feathered),
box-downscaled to 32 px/tile; @24 is re-made from @32 like process.py. usage: python3 apply.py  (biblia@32.orig.png = the town painting before the patch: git show HEAD:v2/assets/env/finale/under/biblia@32.png > biblia@32.orig.png)"""
import numpy as np, json
from PIL import Image, ImageFilter
V = '/home/user/others/chronicle/v2/assets/env/finale/under/'
T = 32; x0, y0 = 27, 21
base = Image.open('biblia@32.orig.png').convert('RGB')
W, H = base.size
gen = Image.open('gen1.png').convert('RGB').resize((12 * T, 11 * T), Image.BOX)
m = Image.new('L', gen.size, 0)
from PIL import ImageDraw
ImageDraw.Draw(m).rectangle([int(400 / 3), int(458 / 3), int(782 / 3), int(792 / 3)], fill=255)
m = m.filter(ImageFilter.GaussianBlur(2.5))
crop = base.crop((x0 * T, y0 * T, (x0 + 12) * T, (y0 + 11) * T))
out = base.copy(); out.paste(Image.composite(gen, crop, m), (x0 * T, y0 * T))
out.save(V + 'biblia@32.png', optimize=True)
out.resize((W * 24 // 32, H * 24 // 32), Image.LANCZOS).save(V + 'biblia@24.png', optimize=True)
print('ok', out.size)
