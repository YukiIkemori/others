import sys, json
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
d = json.load(open('layout_data.json')); W, H = d['w'], d['h']
im = Image.open(src).convert('RGB')
if im.width != W * 32: im = im.resize((W * 32, H * 32), Image.BOX)
bl = Image.blend(im, Image.open('guide_1x.png').convert('RGB'), float(sys.argv[3]) if len(sys.argv) > 3 else 0.0)
g = ImageDraw.Draw(bl)
for y, r in enumerate(d['walk']):
    for x, c in enumerate(r):
        if c == '#': g.rectangle([x*32+2, y*32+2, x*32+29, y*32+29], outline=(255, 0, 0))
for b in json.load(open('blds.json')):
    dx, dy = b['door']; g.rectangle([dx*32, dy*32, dx*32+31, dy*32+31], outline=(0, 255, 255), width=2)
if len(sys.argv) > 4:
    x0, y0, x1, y1 = map(int, sys.argv[4].split(',')); bl = bl.crop((x0*32, y0*32, x1*32, y1*32))
bl.save(out)
