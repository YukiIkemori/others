"""crop of a painting with the tile grid and numbers: python3 grid.py <id> <gen.png> x0 y0 x1 y1 out.png [px=40]"""
import sys, json
from PIL import Image, ImageDraw
aid, src = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7]); out = sys.argv[7]; P = int(sys.argv[8]) if len(sys.argv) > 8 else 40
d = json.load(open(aid + '/layout.json')); W, H = d['w'], d['h']
im = Image.open(src).convert('RGB').resize((W * P, H * P), Image.BOX).crop((x0 * P, y0 * P, x1 * P, y1 * P))
g = ImageDraw.Draw(im)
rows = d.get('rows_fit') or d['rows']
for i in range(x1 - x0 + 1): g.line([(i * P, 0), (i * P, (y1 - y0) * P)], fill=(255, 0, 0), width=1)
for j in range(y1 - y0 + 1): g.line([(0, j * P), ((x1 - x0) * P, j * P)], fill=(255, 0, 0), width=1)
for i in range(x1 - x0): g.text((i * P + 2, 1), str(x0 + i), fill=(255, 255, 0))
for j in range(y1 - y0): g.text((1, j * P + 12), str(y0 + j), fill=(0, 255, 255))
for j in range(y0, y1):
    for i in range(x0, x1):
        if rows[j][i] not in 'cs,:_=k': g.line([((i - x0) * P + P - 8, (j - y0) * P + P - 8), ((i - x0) * P + P - 2, (j - y0) * P + P - 2)], fill=(255, 0, 255), width=2)
im.save(out)
