"""Size / placement guides for the rogue (grey mannequins on magenta, 7 image px per art px, figure 82 art px tall,
head 24 art px like the hero).
  walk: 4 rows x 3 cols, art cell 92x100 -> 1936x2800 (the hero's canvas). rows front, back, left, right.
  run : 4 rows x 5 cols, art cell 82x98  -> 2880x2752. col 1 standing, cols 2-5 running (side rows lean forward).
usage: python3 make_guide.py <out.png> <walk|diag|run|rundiag>"""
import sys, math
from PIL import Image, ImageDraw
out, kind = sys.argv[1], sys.argv[2]
P = 7
RUN = kind.startswith('run')
CW, CH, ROWS, COLS = (82, 98, 4, 5) if RUN else (92, 100, 4, 3)
FEET, H = (92, 82)
im = Image.new('RGB', (COLS * CW, ROWS * CH), (255, 0, 255))
d = ImageDraw.Draw(im)
G1, G2, G3 = (150, 150, 158), (110, 110, 120), (80, 80, 92)


def man(cx, oy, view, step):
    """standing / walking mannequin. view f (front/back) or s (side)"""
    feet = oy + FEET
    top = feet - H + (0 if step == 0 else 1)
    ly = feet - 31
    if view == 'f':
        lift = [0, 0] if step == 0 else ([3, 0] if step == 1 else [0, 3])
        for (a, b), up in zip([(cx - 7, cx - 2), (cx + 1, cx + 6)], lift):
            d.rectangle([a, ly, b, feet - 1 - up], fill=G3)
    else:
        spread = 0 if step == 0 else 7
        for sgn in (1, -1):
            x0 = cx - 3 + sgn * spread
            d.polygon([(cx - 4, ly), (cx + 3, ly), (x0 + 5, feet - 1), (x0 - 2, feet - 1)], fill=G3)
    w = 11 if view == 'f' else 7
    d.polygon([(cx - w + 2, top + 24), (cx + w - 2, top + 24), (cx + w + 1, ly + 6), (cx - w - 1, ly + 6)], fill=G2)
    d.ellipse([cx - 10, top, cx + 10, top + 24], fill=G1)


NEAR, FAR = (196, 196, 206), (58, 58, 70)                  # run guides: near (front) limbs light, far limbs dark


def limb(pts, col, w=6, foot=True):
    d.line(pts, fill=col, width=w, joint='curve')
    x, y = pts[-1]
    if foot:
        d.rectangle([x - 3, y - 2, x + 3, y + 1], fill=col)
    else:
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=col)


def runner(cx, oy, view, ph, face=1):
    """running mannequin. ph 0 landing on the LEFT foot, 1 flight (right knee forward), 2 landing on the RIGHT foot,
    3 flight (left knee forward). The arm opposite to the forward leg is forward.
    landing = one upright leg under the body, the other folded behind, body low; flight = wide split, body 3 px up.
    side views: face -1 = facing left (left limbs near), +1 = facing right (right limbs near).
    front view face=1 (own left on the viewer's right), back view face=-1 (own left on the viewer's left)."""
    air = ph % 2 == 1
    G = oy + FEET - 1
    rise = 3 if air else 0
    top = G - H + 7 - rise                                  # head top: the run is a little crouched
    hy = G - 30 - rise + (2 if not air else 0)             # hip height
    fwd_leg = 'L' if ph in (0, 3) else 'R'
    fwd_arm = 'R' if fwd_leg == 'L' else 'L'
    if view == 'f':
        side = {'L': face, 'R': -face}                      # viewer side (+1 right) of each own limb
        sy = top + 27
        for k in ('L', 'R'):
            x = cx + side[k] * 4
            if k == fwd_leg:
                if not air:
                    limb([(x, hy), (x, G - 1)], NEAR)                     # planted leg
                else:
                    limb([(x, hy), (x, hy + 19)], NEAR)                   # knee lifted, boot hanging
            else:
                limb([(x, hy), (x + side[k], hy + 12)], FAR)              # folded / trailing leg: short
        d.polygon([(cx - 9, top + 23), (cx + 9, top + 23), (cx + 11, hy + 4), (cx - 11, hy + 4)], fill=G2)
        d.ellipse([cx - 10, top + 1, cx + 10, top + 25], fill=G1)
        for k in ('L', 'R'):
            x = cx + side[k] * 11
            front = (k == fwd_arm) == (face == 1)           # front view: the forward arm is toward us; back view: the back arm
            if front:
                limb([(x, sy), (x + side[k] * 2, sy + 8), (x - side[k] * 4, sy + 9)], NEAR, w=5, foot=False)
            else:
                limb([(x, sy), (x + side[k] * 4, sy + 7), (x + side[k] * 3, sy + 12)], FAR, w=5, foot=False)
    else:
        f = face
        near = 'L' if f == -1 else 'R'
        lean = 8 * f                                        # head 8 px ahead of the hips = about 13 degrees
        hx = cx - 4 * f
        sx, sy = hx + int(lean * 0.8), top + 28

        def legs(k):
            col = NEAR if k == near else FAR
            if k == fwd_leg:
                if not air:
                    limb([(hx, hy), (hx + 4 * f, hy + 14), (hx + 3 * f, G - 1)], col)
                else:
                    limb([(hx, hy), (hx + 12 * f, hy + 8), (hx + 14 * f, hy + 21)], col)
            else:
                if not air:
                    limb([(hx, hy), (hx - 5 * f, hy + 13), (hx - 16 * f, hy + 9)], col)
                else:
                    limb([(hx, hy), (hx - 9 * f, hy + 10), (hx - 20 * f, hy + 17)], col)

        def arms(k):
            col = NEAR if k == near else FAR
            if k == fwd_arm:
                limb([(sx, sy), (sx + 4 * f, sy + 8), (sx + 12 * f, sy + 4)], col, w=5, foot=False)
            else:
                limb([(sx, sy), (sx - 7 * f, sy + 6), (sx - 10 * f, sy + 13)], col, w=5, foot=False)
        far = 'R' if near == 'L' else 'L'
        legs(far); arms(far)
        d.polygon([(hx + lean - 6, top + 24), (hx + lean + 6, top + 24), (hx + 7, hy + 4), (hx - 7, hy + 4)], fill=G2)
        d.ellipse([hx + lean + f - 10, top, hx + lean + f + 10, top + 24], fill=G1)
        legs(near); arms(near)


for r in range(ROWS):
    for c in range(COLS):
        cx, oy = c * CW + CW // 2, r * CH
        side = (kind in ('walk', 'run')) and r >= 2
        if not RUN:
            man(cx, oy, 's' if side else 'f', c)
        elif c == 0:
            man(cx, oy, 's' if side else 'f', 0)
        else:
            if side:
                runner(cx, oy, 's', c - 1, face=-1 if r == 2 else 1)
            elif kind == 'rundiag':
                runner(cx, oy, 's', c - 1, face=-1 if r in (0, 2) else 1)
            else:
                runner(cx, oy, 'f', c - 1, face=1 if r == 0 else -1)
im = im.resize((im.size[0] * P, im.size[1] * P), Image.NEAREST)
W = (im.size[0] + 15) // 16 * 16; Hh = (im.size[1] + 15) // 16 * 16
cv = Image.new('RGB', (W, Hh), (255, 0, 255)); cv.paste(im, (0, 0))
cv.save(out); print(out, cv.size)
