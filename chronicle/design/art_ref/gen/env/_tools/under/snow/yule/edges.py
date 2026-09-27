import json, sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
d = json.load(open('layout_data.json')); W, H = d['w'], d['h']; T = 32
im = Image.open(src).convert('RGB')
if im.size != (W * T, H * T): im = im.resize((W * T, H * T), Image.BOX)
g = ImageDraw.Draw(im)
wk = lambda x, y: 0 <= x < W and 0 <= y < H and d['walk'][y][x] == '.'
for y in range(H):
    for x in range(W):
        if not wk(x, y): continue
        if not wk(x, y - 1): g.line([x * T, y * T, x * T + T, y * T], fill=(255, 0, 255), width=2)
        if not wk(x, y + 1): g.line([x * T, y * T + T - 1, x * T + T, y * T + T - 1], fill=(255, 0, 255), width=2)
        if not wk(x - 1, y): g.line([x * T, y * T, x * T, y * T + T], fill=(255, 0, 255), width=2)
        if not wk(x + 1, y): g.line([x * T + T - 1, y * T, x * T + T - 1, y * T + T], fill=(255, 0, 255), width=2)
for b in json.load(open('blds.json')):
    g.rectangle([b['x'] * T, b['y'] * T, (b['x'] + b['w']) * T - 1, (b['y'] + b['h']) * T - 1], outline=(0, 255, 0), width=2)
im.save(out)
