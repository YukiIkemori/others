#!/usr/bin/env python3
"""Key-frame strip of the prototype hero animation: art_anim_strip.py FRAMES_DIR OUT.png (see tools/art_mock.js --anim)"""
import sys, os
from PIL import Image, ImageDraw
src, dst = sys.argv[1], sys.argv[2]
rows = [('attack', [0, 8, 12, 15, 17, 18, 20, 23, 27, 33, 38], (200, 180, 880, 620)),
        ('hurt', [0, 3, 5, 7, 10, 14, 20, 29], (620, 180, 1000, 620)), ('idle', [0, 12, 24, 36], (620, 180, 1000, 620))]
W = 2000
out = Image.new('RGB', (W, 2000), (20, 20, 24)); d = ImageDraw.Draw(out)
y = 0
for clip, fr, box in rows:
    x = 0; hh = 0
    for f in fr:
        p = os.path.join(src, f'{clip}_{f:03d}.png')
        if not os.path.exists(p):
            continue
        c = Image.open(p).crop(box)
        s = 300 / c.height; c = c.resize((round(c.width * s), 300), Image.LANCZOS)
        if x + c.width > W:
            x = 0; y += hh + 6; hh = 0
        out.paste(c, (x, y)); d.text((x + 6, y + 6), f'{clip}  t={f / 30:.2f}s', fill=(255, 255, 0)); x += c.width + 6; hh = max(hh, c.height)
    y += hh + 14
out.crop((0, 0, W, y)).save(dst)
print(dst)
