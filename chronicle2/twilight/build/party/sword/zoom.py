"""Zoom one frame with pixel coordinates. usage: python3 zoom.py <sheet.png> <row> <col> <out.png> [x0 y0 x1 y1] [scale]"""
import sys
from PIL import Image, ImageDraw
s = Image.open(sys.argv[1]).convert('RGBA'); R, C = int(sys.argv[2]), int(sys.argv[3])
box = [int(v) for v in sys.argv[5:9]] if len(sys.argv) > 8 else [16, 30, 80, 124]
sc = int(sys.argv[9]) if len(sys.argv) > 9 else 14
f = s.crop((C * 96, R * 128, C * 96 + 96, R * 128 + 128)).crop(box)
bg = Image.new('RGBA', f.size, (96, 100, 96, 255)); bg.alpha_composite(f)
im = bg.resize((f.size[0] * sc, f.size[1] * sc), Image.NEAREST)
pad = 22
cv = Image.new('RGB', (im.size[0] + pad, im.size[1] + pad), (20, 20, 20)); cv.paste(im.convert('RGB'), (pad, pad))
d = ImageDraw.Draw(cv)
for x in range(box[0], box[2]):
    X = pad + (x - box[0]) * sc
    d.line([(X, pad), (X, cv.size[1])], fill=(60, 60, 60) if x % 5 else (150, 150, 150))
    if x % 5 == 0:
        d.text((X + 1, 4), str(x), fill=(255, 255, 255))
for y in range(box[1], box[3]):
    Y = pad + (y - box[1]) * sc
    d.line([(pad, Y), (cv.size[0], Y)], fill=(60, 60, 60) if y % 5 else (150, 150, 150))
    if y % 5 == 0:
        d.text((2, Y + 1), str(y), fill=(255, 255, 255))
cv.save(sys.argv[4]); print(cv.size)
