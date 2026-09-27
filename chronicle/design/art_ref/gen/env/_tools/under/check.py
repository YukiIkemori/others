import sys, json, os
from PIL import Image, ImageDraw
src = sys.argv[1]; out = sys.argv[2]
im = Image.open(src).convert('RGB').resize((1408, 1152), Image.BOX)
gd = Image.open('guide_1x.png').convert('RGB')
bl = Image.blend(im, gd, 0.35)
g = ImageDraw.Draw(bl)
d = json.load(open(os.environ.get('MAPDUMP', 'before_data.json')))
# walk grid outline: red = solid
for y, r in enumerate(d['walk']):
    for x, c in enumerate(r):
        if c == '#': g.rectangle([x*32+1, y*32+1, x*32+30, y*32+30], outline=(255, 0, 0))
for b in json.load(open('blds.json')):
    dx, dy = b['door']; g.rectangle([dx*32, dy*32, dx*32+31, dy*32+31], outline=(0, 255, 255), width=2)
bl.save(out)
