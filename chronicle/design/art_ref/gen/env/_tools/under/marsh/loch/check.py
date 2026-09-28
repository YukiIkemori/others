import json, sys
from PIL import Image, ImageDraw
src = sys.argv[1]; out = sys.argv[2]
d = json.load(open('layout_data.json')); W, H = d['w'], d['h']; T = 32
im = Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)
ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); g = ImageDraw.Draw(ov)
for y in range(H):
    for x in range(W):
        if d['walk'][y][x] != '.': g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=(255, 0, 0, 60))
for b in json.load(open('blds.json')):
    if b['door']:
        dx, dy = b['door']; g.rectangle([dx * T, dy * T, dx * T + T - 1, dy * T + T - 1], outline=(0, 255, 0, 255), width=2)
im = Image.alpha_composite(im.convert('RGBA'), ov)
im.save(out)
