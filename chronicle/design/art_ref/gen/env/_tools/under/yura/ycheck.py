import sys, json
from PIL import Image, ImageDraw
src = sys.argv[1]; out = sys.argv[2]
im = Image.open(src).convert('RGB').resize((960, 896), Image.BOX)
gd = Image.open('guide_1x.png').convert('RGB')
bl = Image.blend(im, gd, float(sys.argv[3]) if len(sys.argv) > 3 else 0.3)
g = ImageDraw.Draw(bl)
d = json.load(open('lay_data.json'))
for y, r in enumerate(d['walk']):
    for x, c in enumerate(r):
        if c == '#': g.rectangle([x*32+1, y*32+1, x*32+30, y*32+30], outline=(255, 0, 0))
for b in json.load(open('blds.json')):
    if b['door']: dx, dy = b['door']; g.rectangle([dx*32, dy*32, dx*32+31, dy*32+31], outline=(0, 255, 255), width=2)
bl.save(out)
