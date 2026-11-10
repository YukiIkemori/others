"""Size / placement guide: grey mannequins, 80 art px tall, 3.3 heads, on a magenta canvas at 4 image px per art px.
usage: python3 make_guide.py <out.png> <cols 3|6>   (cells 640x512 = 160x128 art px, feet line at art y=108)"""
import sys
from PIL import Image, ImageDraw
out, cols = sys.argv[1], int(sys.argv[2])
P, CW, CH, ROWS = 4, 160, 128, 4
FEET, TOP = 108, 28
im = Image.new('RGB', (cols * CW, ROWS * CH), (255, 0, 255))
d = ImageDraw.Draw(im)
G1, G2, G3 = (150, 150, 158), (110, 110, 120), (80, 80, 92)

def man(cx, oy, view, step):
    """view: f front/back, s side(+1 right / -1 left); step 0 stand, 1, 2"""
    top = oy + TOP; feet = oy + FEET
    bob = 0 if step == 0 else 1
    top += bob
    # legs (30 px): y feet-30 .. feet
    ly = feet - 30
    if view == 'f':
        l = [(cx - 8, cx - 2), (cx + 1, cx + 7)]
        lift = [0, 0] if step == 0 else ([3, 0] if step == 1 else [0, 3])
        for (a, b), up in zip(l, lift):
            d.rectangle([a, ly, b, feet - 1 - up], fill=G3)
    else:
        s = view
        spread = 0 if step == 0 else 9
        for k, sgn in enumerate((1, -1)):
            x0 = cx - 3 + sgn * spread * (1 if step == 1 else -1) * (1 if k == 0 else 1)
            d.polygon([(cx - 4, ly), (cx + 3, ly), (x0 + 4 + 2 * s, feet - 1), (x0 - 3, feet - 1)], fill=G3)
    # torso + short cape: y top+25 .. ly+4
    w = 12 if view == 'f' else 8
    d.polygon([(cx - w + 2, top + 24), (cx + w - 2, top + 24), (cx + w + 1, ly + 6), (cx - w - 1, ly + 6)], fill=G2)
    # head 21 wide x 24 high
    hw = 10 if view == 'f' else 10
    d.ellipse([cx - hw, top, cx + hw, top + 24], fill=G1)

for r in range(ROWS):
    for c in range(cols):
        half = c // 3
        step = c % 3
        view = 'f' if (half == 1 or r < 2) else (-1 if r == 2 else 1)
        man(c * CW + CW // 2, r * CH, view, step)
im = im.resize((im.size[0] * P, im.size[1] * P), Image.NEAREST)
im.save(out); print(out, im.size)
