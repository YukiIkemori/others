"""Size / placement guide for the priestess at 7 image px per art px: grey mannequins 76 art px tall in a long robe,
with a thin staff on the side of the character's own RIGHT hand. Art cell 92x100 (644x700 px), feet line at art y=92.
usage: python3 make_guide.py <out.png> <walk|run|walk_diag|run_diag> """
import sys
from PIL import Image, ImageDraw
out, kind = sys.argv[1], sys.argv[2]
P, CW, CH, ROWS = 7, 92, 100, 4
DIAG = kind.endswith('_diag'); kind = kind.split('_')[0]
COLS = 3 if kind == 'walk' else 4
FEET, HT = 92, 76
im = Image.new('RGB', (COLS * CW, ROWS * CH), (255, 0, 255))
d = ImageDraw.Draw(im)
G1, G2, G3, G4 = (150, 150, 158), (110, 110, 120), (80, 80, 92), (190, 190, 196)
VIEWS = ['dl', 'dr', 'ul', 'ur'] if DIAG else ['f', 'b', 'l', 'r']


def man(cx, oy, view, col):
    feet = oy + FEET
    if kind == 'walk':
        top = feet - HT + (0 if col == 0 else 1)
        w = 12 if view in 'fb' else (8 if view in 'lr' else 10)
        sway = 0 if col == 0 else (2 if col == 1 else -2)
        # robe: shoulders -> ankle hem
        d.polygon([(cx - w + 2, top + 24), (cx + w - 2, top + 24), (cx + w + 3 + max(sway, 0), feet - 4), (cx - w - 3 + min(sway, 0), feet - 4)], fill=G2)
        d.rectangle([cx - 6, feet - 4, cx - 1, feet - 1], fill=G3); d.rectangle([cx + 1, feet - 4, cx + 6, feet - 1], fill=G3)
        d.ellipse([cx - 10, top, cx + 10, top + 24], fill=G1)
        sx = {'f': cx - 16, 'b': cx + 15, 'l': cx - 13, 'r': cx + 12, 'dl': cx - 15, 'dr': cx - 13, 'ul': cx + 12, 'ur': cx + 14}[view]
        d.rectangle([sx, top - 5, sx + 1, feet - 2], fill=G4)
    else:
        air = col in (1, 3)
        lift = 3 if air else 0
        top = feet - HT + 4 - lift
        if view in ('f', 'b', 'dl', 'dr', 'ul', 'ur'):
            ln = {'dl': -5, 'ul': -5, 'dr': 5, 'ur': 5}.get(view, 0)
            d.polygon([(cx + ln - 10, top + 24), (cx + ln + 10, top + 24), (cx + 16 - ln, feet - 8 - lift), (cx - 16 - ln, feet - 8 - lift)], fill=G2)
            a, b = (0, 5) if col in (0, 1) else (5, 0)
            d.rectangle([cx - 8, feet - 12 - lift, cx - 2, feet - 1 - lift - a], fill=G3)
            d.rectangle([cx + 2, feet - 12 - lift, cx + 8, feet - 1 - lift - b], fill=G3)
            d.ellipse([cx + ln - 10, top + 1, cx + ln + 10, top + 25], fill=G1)
            sx = cx + ln + (-17 if view in ('f', 'dl', 'dr') else 16)
            tilt = {'dl': -5, 'ur': 5, 'dr': 2, 'ul': -2}.get(view, 0)
            d.line([(sx + tilt, top - 2), (sx - tilt // 2, feet - 10 - lift)], fill=G4, width=2)
        else:
            s = -1 if view == 'l' else 1          # facing direction
            lean = 9
            hx = cx + s * lean                     # head ahead of the hips
            d.polygon([(hx - 7, top + 22), (hx + 7, top + 22), (cx + 9 - s * 8, feet - 9 - lift), (cx - 9 - s * 8, feet - 9 - lift)], fill=G2)
            spread = 12 if not air else 7
            for sgn in (1, -1):
                x0 = cx + sgn * spread
                d.polygon([(cx - 4, feet - 22 - lift), (cx + 4, feet - 22 - lift), (x0 + 4, feet - 1 - lift - (0 if sgn * s * (1 if col < 2 else -1) > 0 else 5)), (x0 - 3, feet - 1 - lift - (0 if sgn * s * (1 if col < 2 else -1) > 0 else 5))], fill=G3)
            d.ellipse([hx - 10, top, hx + 10, top + 24], fill=G1)
            d.line([(hx + s * 14, top - 2), (cx + s * 4, feet - 12 - lift)], fill=G4, width=2)


for r in range(ROWS):
    for c in range(COLS):
        man(c * CW + CW // 2, r * CH, VIEWS[r], c)
im = im.resize((im.size[0] * P, im.size[1] * P), Image.NEAREST)
W = (im.size[0] + 15) // 16 * 16
cv = Image.new('RGB', (W, 2800), (255, 0, 255)); cv.paste(im, (0, 0))
cv.save(out); print(out, cv.size)
