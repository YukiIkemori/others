"""Size / placement guide for the hero RUN sheets: 4 rows x 5 cols on magenta, 2880x2800.
Column 1 = the approved standing figure of that direction, cut from the hero's chosen raw sheet (scale and identity anchor).
Columns 2-5 = grey run mannequins (lean, stride, flight height) that mark where each run frame goes and how big it is.
usage: python3 make_run_guide.py <main|diag> <chosen_raw.png> <out.png>
  main rows: down, up, left, right (raw p7b)      diag rows: down_left, down_right, up_left, up_right (raw q7a)"""
import sys, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

kind, raw_p, out = sys.argv[1:4]
W, H = 2880, 2800
STAND_W, RUN_W, ROW_H = 480, 600, 700
FEET = 610                      # feet line inside a row
U = 6.3                         # image px per art px of the figures (505 px / 80)
MAG = (255, 0, 255)
G1, G2, G3, G4 = (150, 150, 158), (112, 112, 122), (84, 84, 96), (66, 66, 78)

raw = Image.open(raw_p).convert('RGB')
a = np.array(raw).astype(int)
fg = ~((np.minimum(a[..., 0], a[..., 2]) - a[..., 1] > 60) & (np.abs(a[..., 0] - a[..., 2]) < 90))
fg = nd.binary_opening(fg, iterations=1)
rh, rw = raw.size[1] / 4.0, raw.size[0] / 3.0


lab_all, n_all = nd.label(fg, structure=np.ones((3, 3)))
sz_all = nd.sum(fg, lab_all, range(1, n_all + 1))
cen_all = nd.center_of_mass(fg, lab_all, range(1, n_all + 1))


def stand(r):
    """the standing figure (col 0) of raw row r, as RGBA crop (components assigned to cells by their centroid)"""
    ids = [i + 1 for i, (s_, c) in enumerate(zip(sz_all, cen_all))
           if s_ >= 60 and min(3, int(c[0] // rh)) == r and int(c[1] // rw) == 0]
    keep = np.isin(lab_all, ids)
    ys, xs = np.where(keep)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    im = raw.crop(box).convert('RGBA')
    al = Image.fromarray((keep[box[1]:box[3], box[0]:box[2]] * 255).astype(np.uint8))
    im.putalpha(al)
    return im


cv = Image.new('RGB', (W, H), MAG)
d = ImageDraw.Draw(cv)


def P(cx, fy, pts):
    return [(cx + x * U, fy + y * U) for x, y in pts]


def limb(cx, fy, pts, w, fill):
    """a thick poly-line limb in art units"""
    q = P(cx, fy, pts)
    d.line(q, fill=fill, width=int(w * U), joint='curve')
    for x, y in q:
        d.ellipse([x - w * U / 2, y - w * U / 2, x + w * U / 2, y + w * U / 2], fill=fill)


def side(cx, fy, face, phase):
    """profile runner. face=-1 looks left, +1 right. phase 0 contact (near leg), 1 flight, 2 contact (far leg), 3 flight"""
    s = face
    up = -3 if phase in (1, 3) else 0
    hip = (0, -31 + up)
    neck = (s * 6, -56 + up)
    head = (s * 9, -67 + up)
    near, far = (G3, G4) if phase in (0, 1) else (G4, G3)
    # cape streaming behind
    d.polygon(P(cx, fy, [(s * 3, -58 + up), (-s * 4, -57 + up), (-s * 24, -44 + up), (-s * 22, -36 + up), (-s * 6, -40 + up)]), fill=G2)
    if phase in (0, 2):     # contact: front leg reaches the ground ahead, rear leg folded up behind
        limb(cx, fy, [hip, (-s * 7, -17), (-s * 15, -9), (-s * 20, -11)], 6, far)
        limb(cx, fy, [hip, (s * 7, -15), (s * 10, -1), (s * 14, -1)], 6, near)
    else:                   # flight: front knee driven up, rear leg stretched out behind, nothing touches the ground
        limb(cx, fy, [hip, (-s * 9, -19 + up), (-s * 19, -12 + up), (-s * 23, -15 + up)], 6, near)
        limb(cx, fy, [hip, (s * 10, -22 + up), (s * 9, -9 + up), (s * 13, -8 + up)], 6, far)
    d.polygon(P(cx, fy, [(s * 1, -58 + up), (s * 10, -54 + up), (s * 5, -29 + up), (-s * 5, -30 + up)]), fill=G2)
    limb(cx, fy, [(s * 5, -52 + up), (s * 3, -43 + up), (s * 11, -41 + up)], 4, G1)        # bent arm
    hx, hy = cx + head[0] * U, fy + head[1] * U
    d.ellipse([hx - 10.5 * U, hy - 12 * U, hx + 10.5 * U, hy + 12 * U], fill=G1)


def front(cx, fy, lean_x, phase, back):
    """front / back / three-quarter runner. lean_x: sideways head offset in art px (the running direction, 0 = straight).
    phase as in side(); the landing leg is the character's LEFT in phase 0: viewer's right in a front view, viewer's left
    in a back view"""
    up = -3 if phase in (1, 3) else 0
    L = 1 if not back else -1          # viewer-side sign of the character's left leg
    land = L if phase in (0, 1) else -L
    hip_y = -30 + up
    k = lean_x * 1.4                    # the stride also goes sideways in a three-quarter view
    if lean_x:                          # cape streams to the side the runner comes from
        sg = -1 if lean_x > 0 else 1
        d.polygon(P(cx, fy, [(lean_x - 8, -57 + up), (lean_x + 8, -56 + up), (sg * 24, -42 + up), (sg * 22, -33 + up), (sg * 6, -36 + up)]), fill=G2)
    else:
        d.polygon(P(cx, fy, [(-9, -56 + up), (9, -56 + up), (21, -37 + up), (-21, -37 + up)]), fill=G2)
    if phase in (0, 2):
        limb(cx, fy, [(land * 4, hip_y), (land * 5 + k * 0.6, -14), (land * 4 + k, -2)], 6.5, G3)        # landing leg: long, on the ground
        limb(cx, fy, [(-land * 4, hip_y), (-land * 6 - k * 0.5, -19), (-land * 5 - k, -13)], 6, G4)      # other leg: folded, foot up
    else:
        limb(cx, fy, [(land * 4, hip_y), (land * 5 - k * 0.5, -17 + up), (land * 5 - k, -10 + up)], 6, G4)       # just pushed off: trailing
        limb(cx, fy, [(-land * 4, hip_y), (-land * 5 + k * 0.6, -15 + up), (-land * 4 + k, -6 + up)], 6.5, G3)   # swinging forward
    d.polygon(P(cx, fy, [(lean_x - 8, -55 + up), (lean_x + 8, -55 + up), (8, hip_y + 2), (-8, hip_y + 2)]), fill=G2)
    for sg in (-1, 1):
        limb(cx, fy, [(lean_x + sg * 10, -52 + up), (lean_x + sg * 13, -44 + up), (lean_x + sg * 8, -40 + up)], 4, G1)
    hx, hy = cx + lean_x * 1.3 * U, fy + (-65 + up) * U
    d.ellipse([hx - 10.5 * U, hy - 12 * U, hx + 10.5 * U, hy + 12 * U], fill=G1)


ROWS = {'main': [('front', 0, False), ('front', 0, True), ('side', -1), ('side', 1)],
        'diag': [('front', -5, False), ('front', 5, False), ('front', -5, True), ('front', 5, True)]}[kind]
for r, spec in enumerate(ROWS):
    fy = r * ROW_H + FEET
    st = stand(r)
    cv.paste(st, (STAND_W // 2 - st.size[0] // 2, fy - st.size[1]), st)
    for c in range(4):
        cx = STAND_W + c * RUN_W + RUN_W // 2
        if spec[0] == 'side':
            side(cx - spec[1] * 12, fy, spec[1], c)
        else:
            front(cx, fy, spec[1], c, spec[2])
cv.save(out)
print(out, cv.size)
