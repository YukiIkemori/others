"""overlay walk grid (red = blocked) on a painting resized to 1x; optional shift. usage: python3 overlay.py layout.json gen.png out.png [dx dy] [crop x0 y0 x1 y1]"""
import json, sys, numpy as np
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); W, H = d['w'], d['h']; T = 32
im = Image.open(sys.argv[2]).convert('RGB').resize((W * T, H * T), Image.BOX)
dx, dy = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (0, 0)
if dx or dy: im = Image.fromarray(np.roll(np.roll(np.asarray(im), dy, 0), dx, 1))
ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); g = ImageDraw.Draw(ov)
for y in range(H):
    for x in range(W):
        if d['walk'][y][x] != '.': g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(255, 0, 0, 160), width=1)
out = Image.alpha_composite(im.convert('RGBA'), ov)
if len(sys.argv) > 9: out = out.crop(tuple(int(v) for v in sys.argv[6:10]))
out.save(sys.argv[3])
