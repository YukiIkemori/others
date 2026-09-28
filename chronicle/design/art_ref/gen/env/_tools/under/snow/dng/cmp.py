"""Check a generation against the layout: the painting at 1x with the walkable-cell boundary (magenta) drawn on top, next to the guide.
usage: python3 cmp.py <map> <gen.png> <out.png> [width]"""
import sys, json
from PIL import Image, ImageDraw
m, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
wd = int(sys.argv[4]) if len(sys.argv) > 4 else 1400
d = json.load(open(m + '/layout_data.json')); W, H = d['w'], d['h']; T = 32
im = Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)
g = ImageDraw.Draw(im)
wk = lambda x, y: 0 <= x < W and 0 <= y < H and d['walk'][y][x] == '.'
for y in range(H):
    for x in range(W):
        if not wk(x, y): continue
        if not wk(x, y - 1): g.line([x * T, y * T, x * T + T, y * T], fill=(255, 0, 255), width=2)
        if not wk(x, y + 1): g.line([x * T, y * T + T - 1, x * T + T, y * T + T - 1], fill=(255, 0, 255), width=2)
        if not wk(x - 1, y): g.line([x * T, y * T, x * T, y * T + T], fill=(255, 0, 255), width=2)
        if not wk(x + 1, y): g.line([x * T + T - 1, y * T, x * T + T - 1, y * T + T], fill=(255, 0, 255), width=2)
k = wd / im.size[0]
im.resize((wd, int(im.size[1] * k)), Image.LANCZOS).save(out)
