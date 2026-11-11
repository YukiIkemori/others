"""Size / placement guide at 7 image px per art px: grey mannequins on magenta, 4 rows, art cell 92x100 (644x700 px).
  walk: 3 cols (stand, left step, right step), canvas 1936x2800
  run : 4 cols (contact, air, contact, air), canvas 2576x2800; side rows lean 12 degrees forward
usage: python3 make_guide.py <out.png> <walk|run> <main|diag> [height art px = 78]"""
import sys, math
from PIL import Image, ImageDraw
out, mode, kind = sys.argv[1], sys.argv[2], sys.argv[3]
HT = int(sys.argv[4]) if len(sys.argv) > 4 else 78
P, CW, CH, ROWS = 7, 92, 100, 4
COLS = 3 if mode == 'walk' else 4
FEET = 92
TOP = FEET - HT
im = Image.new('RGB', (COLS * CW, ROWS * CH), (255, 0, 255))
d = ImageDraw.Draw(im)
G1, G2, G3 = (150, 150, 158), (110, 110, 120), (80, 80, 92)


def man_walk(cx, oy, view, step):
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


def man_run(cx, oy, view, col, face):
    """face: -1 = runs to the left, +1 = to the right, 0 = front / back"""
    air = col in (1, 3)
    feet = oy + FEET - (3 if air else 0)
    top = oy + TOP + 3 - (3 if air else 0)          # a run is lower than the standing height
    ly = feet - 28
    if view == 'f':
        lift = [9, 0] if col == 0 else ([0, 9] if col == 2 else [5, 5])
        for (a, b), up in zip([(cx - 8, cx - 2), (cx + 1, cx + 7)], lift):
            d.rectangle([a, ly, b, feet - 1 - up], fill=G3)
        d.polygon([(cx - 10, top + 23), (cx + 10, top + 23), (cx + 12, ly + 6), (cx - 12, ly + 6)], fill=G2)
        d.ellipse([cx - 10, top + 1, cx + 10, top + 25], fill=G1)
        return
    lean = math.tan(math.radians(13)) * face
    hipx = cx - face * 2
    spread = 12 if not air else 9
    for sgn in (1, -1):
        fx = hipx + sgn * spread
        fy = feet - 1 - (0 if (sgn * face > 0 and not air) else 6)
        d.polygon([(hipx - 4, ly), (hipx + 3, ly), (fx + 4, fy), (fx - 3, fy)], fill=G3)
    sh = hipx + lean * (ly - (top + 24))             # shoulder x
    d.polygon([(sh - 7, top + 24), (sh + 7, top + 24), (hipx + 8, ly + 6), (hipx - 8, ly + 6)], fill=G2)
    hx = hipx + lean * (ly - (top + 12))
    d.ellipse([hx - 10, top, hx + 10, top + 24], fill=G1)


for r in range(ROWS):
    for c in range(COLS):
        cx, oy = c * CW + CW // 2, r * CH
        side = (kind == 'main' and r >= 2)
        if mode == 'walk':
            man_walk(cx, oy, 's' if side else 'f', c)
        else:
            face = 0
            if side:
                face = -1 if r == 2 else 1
            man_run(cx, oy, 's' if side else 'f', c, face)
im = im.resize((im.size[0] * P, im.size[1] * P), Image.NEAREST)
W = 1936 if mode == 'walk' else 2576
cv = Image.new('RGB', (W, 2800), (255, 0, 255)); cv.paste(im, (0, 0))
cv.save(out); print(out, cv.size)
