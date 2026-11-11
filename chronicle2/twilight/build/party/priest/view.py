"""quick look: python3 view.py <sheet.png> <out.png> [scale] [rows a-b]"""
import sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert('RGBA')
k = int(sys.argv[3]) if len(sys.argv) > 3 else 3
r0, r1 = (int(v) for v in sys.argv[4].split('-')) if len(sys.argv) > 4 else (0, 8)
bg = Image.new('RGBA', im.size, (70, 62, 84, 255))
d = ImageDraw.Draw(bg)
for R in range(8):
    d.line([(0, R * 128 + 120), (384, R * 128 + 120)], fill=(96, 86, 110, 255))
    for C in range(4):
        d.line([(C * 96 + 48, R * 128 + 116), (C * 96 + 48, R * 128 + 124)], fill=(120, 108, 136, 255))
bg.alpha_composite(im)
bg = bg.crop((0, r0 * 128, 384, r1 * 128))
bg.resize((bg.size[0] * k, bg.size[1] * k), Image.NEAREST).save(sys.argv[2])
