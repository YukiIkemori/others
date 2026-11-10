"""Size / placement guide at 7 image px per art px: grey mannequins 80 art px tall (3.3 heads) on magenta.
4 rows x 3 cols, art cell 92x100 (644x700 px), canvas padded to 1936x2800. Feet line at art y=92.
usage: python3 make_guide7.py <out.png> <main|diag>"""
import sys
from PIL import Image, ImageDraw
out, kind = sys.argv[1], sys.argv[2]
P, CW, CH, ROWS, COLS = 7, 92, 100, 4, 3
FEET, TOP = 92, 12
im = Image.new('RGB', (COLS * CW, ROWS * CH), (255, 0, 255))
d = ImageDraw.Draw(im)
G1, G2, G3 = (150, 150, 158), (110, 110, 120), (80, 80, 92)

def man(cx, oy, view, step):
    top = oy + TOP + (0 if step == 0 else 1); feet = oy + FEET
    ly = feet - 30
    if view == 'f':
        lift = [0, 0] if step == 0 else ([3, 0] if step == 1 else [0, 3])
        for (a, b), up in zip([(cx - 8, cx - 2), (cx + 1, cx + 7)], lift):
            d.rectangle([a, ly, b, feet - 1 - up], fill=G3)
    else:
        spread = 0 if step == 0 else 7
        for sgn in (1, -1):
            x0 = cx - 3 + sgn * spread
            d.polygon([(cx - 4, ly), (cx + 3, ly), (x0 + 5, feet - 1), (x0 - 2, feet - 1)], fill=G3)
    w = 12 if view == 'f' else 8
    d.polygon([(cx - w + 2, top + 24), (cx + w - 2, top + 24), (cx + w + 1, ly + 6), (cx - w - 1, ly + 6)], fill=G2)
    d.ellipse([cx - 10, top, cx + 10, top + 24], fill=G1)

for r in range(ROWS):
    for c in range(COLS):
        view = 'f' if (kind == 'diag' or r < 2) else 's'
        man(c * CW + CW // 2, r * CH, view, c)
im = im.resize((im.size[0] * P, im.size[1] * P), Image.NEAREST)
cv = Image.new('RGB', (1936, 2800), (255, 0, 255)); cv.paste(im, (0, 0))
cv.save(out); print(out, cv.size)
