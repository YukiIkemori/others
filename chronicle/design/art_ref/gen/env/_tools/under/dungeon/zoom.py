"""zoom.py <img> <x0> <y0> <w> <h> <out> [scale] : tile-grid crop (tiles), red grid, labels every tile"""
import sys
from PIL import Image, ImageDraw
im, x0, y0, w, h, out = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
sc = int(sys.argv[7]) if len(sys.argv) > 7 else 2
a = Image.open(im).convert('RGB').crop((x0 * 32, y0 * 32, (x0 + w) * 32, (y0 + h) * 32)).resize((w * 32 * sc, h * 32 * sc), Image.NEAREST)
g = ImageDraw.Draw(a)
for i in range(w + 1): g.line([(i * 32 * sc, 0), (i * 32 * sc, a.height)], fill=(255, 0, 0))
for j in range(h + 1): g.line([(0, j * 32 * sc), (a.width, j * 32 * sc)], fill=(255, 0, 0))
for i in range(w):
    for j in range(h): g.text((i * 32 * sc + 2, j * 32 * sc + 1), '%d,%d' % (x0 + i, y0 + j), fill=(255, 255, 0))
a.save(out)
