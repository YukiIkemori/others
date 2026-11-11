# cover.py base.png out.png : the title over a still of the field (lower left, on a soft dark veil)
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
im = Image.open(sys.argv[1]).convert('RGB'); W, H = im.size
a = np.asarray(im).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W]
veil = np.clip(1.25 - np.hypot((xx - 0) / (W * .62), (yy - H) / (H * .62)), 0, 1) ** 1.6 * .78     # darkest in the lower-left corner
veil = np.maximum(veil, np.clip((yy - H * .62) / (H * .38), 0, 1) ** 2 * .35)
a = a * (1 - veil[..., None]) + np.array([14, 10, 30]) * veil[..., None]
base = Image.fromarray(a.clip(0, 255).astype(np.uint8))
JP = '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf'; EN = '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf'
f_big, f_small, f_en = ImageFont.truetype(JP, 118), ImageFont.truetype(JP, 34), ImageFont.truetype(EN, 46)
txt = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(txt)
def spaced(d, xy, s, font, fill, sp):
    x, y = xy
    for ch in s: d.text((x, y), ch, font=font, fill=fill); x += d.textlength(ch, font=font) + sp
    return x
X, Y = 92, H - 430
spaced(d, (X + 4, Y), '開発中の試作画面', f_small, (230, 220, 255, 230), 6)
spaced(d, (X, Y + 50), '月光樹の', f_big, (255, 246, 228, 255), 8)
x1 = spaced(d, (X + 118, Y + 178), '浮き島', f_big, (255, 246, 228, 255), 8)
d.line((X + 4, Y + 322, x1 - 6, Y + 322), fill=(255, 214, 150, 200), width=2)
spaced(d, (X + 6, Y + 338), 'Isles of the Moonlit Tree', f_en, (226, 214, 255, 235), 2)
glow = txt.split()[3].filter(ImageFilter.GaussianBlur(14)); sh = Image.new('RGBA', (W, H), (8, 4, 24, 0)); sh.putalpha(glow.point(lambda v: int(v * .85)))
out = Image.alpha_composite(Image.alpha_composite(base.convert('RGBA'), sh), txt).convert('RGB')
out.save(sys.argv[2])
