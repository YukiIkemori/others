"""Zoom a tile region of the processed image with a labelled tile grid; red = solid in the data. usage: python3 zoom.py <img@32> x0 y0 x1 y1 out.png [scale]"""
import sys, json
from PIL import Image, ImageDraw
d = json.load(open('layout_data.json'))
a = Image.open(sys.argv[1]).convert('RGB')
x0, y0, x1, y1 = map(int, sys.argv[2:6]); s = int(sys.argv[7]) if len(sys.argv) > 7 else 3
c = a.crop((x0 * 32, y0 * 32, x1 * 32, y1 * 32)).resize(((x1 - x0) * 32 * s, (y1 - y0) * 32 * s), Image.NEAREST)
g = ImageDraw.Draw(c)
for y in range(y0, y1):
    for x in range(x0, x1):
        X, Y = (x - x0) * 32 * s, (y - y0) * 32 * s
        solid = d['walk'][y][x] == '#'
        g.rectangle([X, Y, X + 32 * s - 1, Y + 32 * s - 1], outline=(255, 0, 0) if solid else (0, 0, 0), width=2 if solid else 1)
        g.text((X + 3, Y + 2), '%d,%d' % (x, y), fill=(255, 255, 255))
c.save(sys.argv[6])
