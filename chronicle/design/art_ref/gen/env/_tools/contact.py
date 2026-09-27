import sys, glob, json, os
from PIL import Image, ImageDraw
out = sys.argv[1]; pats = sys.argv[2:]
fs = []
for p in pats: fs += sorted(glob.glob(p))
ims = [(os.path.basename(f), Image.open(f).convert('RGBA')) for f in fs]
W = 1900; x = y = 0; rowh = 0; S = 3
pos = []
for n, im in ims:
    w, h = im.width * S, im.height * S
    if x + w > W: x = 0; y += rowh + 16; rowh = 0
    pos.append((x, y, n, im)); x += w + 10; rowh = max(rowh, h)
c = Image.new('RGBA', (W, y + rowh + 16), (46, 50, 78, 255)); d = ImageDraw.Draw(c)
for x, y, n, im in pos:
    c.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, y)); d.text((x, y + im.height * S), n.replace('@32.png', ''), fill=(255, 255, 255))
c.save(out)
