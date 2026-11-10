"""sheet_raw.png (from build.py) -> final hero sheet: dot eyes, soft own-colour outline (no near-black), muted wine,
lantern anchor points, json, preview on the map, gif.
usage: python3 finish.py <sprite_pipe/tools dir> <work dir> <map_art.png> <out dir> [eye_h=2]"""
import sys, os, json, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd
tools, work, map_p, out = sys.argv[1:5]
EYE_H = int(sys.argv[5]) if len(sys.argv) > 5 else 2
sys.path.insert(0, tools)
import pixlib as P
CW, CH, AX, AY = 96, 128, 48, 120
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
os.makedirs(out, exist_ok=True)
sheet = np.array(Image.open(os.path.join(work, 'sheet_raw.png')).convert('RGBA'))
L = lambda rgb: P.srgb_to_lab(np.asarray(rgb, np.float64).reshape(1, 1, 3))[0, 0]
labimg = P.srgb_to_lab(sheet[..., :3].astype(np.float64))
alpha = sheet[..., 3] > 0
pal = np.unique(sheet[alpha][:, :3], axis=0)
pal_lab = P.srgb_to_lab(pal.astype(np.float64))
EYE = np.array([34, 26, 30], np.uint8)          # eye dots: a very dark warm brown, the darkest thing on the sprite
INDIGO = np.array([40, 36, 48], np.uint8)       # outline shade for the charcoal / indigo materials


def is_skin(c):
    r, g, b = [int(v) for v in c]
    return r > 200 and g > 140 and b > 90 and r - b > 50 and g - b > 15


def is_dark(c):
    return L(c)[0] < 12.5

N8 = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
eye_log = {}
for R in range(8):
    for C in range(4):
        fr = sheet[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]
        a = fr[..., 3] > 0
        ys = np.where(a.any(1))[0]
        top = ys.min()
        dark = np.zeros(a.shape, bool); skin = np.zeros(a.shape, bool)
        for y, x in zip(*np.where(a)):
            dark[y, x] = is_dark(fr[y, x, :3]); skin[y, x] = is_skin(fr[y, x, :3])
        # ---- eyes: small dark blobs inside the head that touch skin and do not touch the outside
        lab, n = nd.label(dark, structure=np.ones((3, 3)))
        outside = nd.binary_dilation(~a, structure=np.ones((3, 3)))
        eyes = []
        want = {'down': 2, 'down_left': 2, 'down_right': 2, 'left': 1, 'right': 1}.get(NAMES[R], 0)
        for i in range(1, n + 1):
            m = lab == i
            yy, xx = np.where(m)
            if yy.min() < top + 9 or yy.max() > top + 23 or m.sum() > 14 or (m & outside).any():
                continue
            ring = nd.binary_dilation(m, structure=np.ones((3, 3))) & ~m
            frac = (ring & skin).sum() / float(ring.sum())
            if frac >= 0.3:
                eyes.append((frac, m))
        eyes = [m for f, m in sorted(eyes, key=lambda t: -t[0])[:want]]
        keep = np.zeros(a.shape, bool)
        Lf = P.srgb_to_lab(fr[..., :3].astype(np.float64))[..., 0]
        semi = a & (Lf < 24)
        spots = []
        for m in eyes:
            yy, xx = np.where(m)
            win = np.zeros(a.shape, bool)
            win[yy.min():yy.max() + 4, max(0, xx.min() - 1):xx.max() + 2] = True
            lab2, _ = nd.label(semi & win, structure=np.ones((3, 3)))
            ids = np.unique(lab2[m]); ids = ids[ids > 0]
            reg = np.isin(lab2, ids) & ~outside
            ry, rx = np.where(reg)
            # the stroke column: the column that reaches lowest (the tail); ties -> nearer the face centre
            low = {x: ry[rx == x].max() for x in np.unique(rx)}
            mx = max(low.values())
            cand = [x for x, v in low.items() if v == mx]
            cx = min(cand, key=lambda x: abs(x - AX))
            cy = int(round((ry.min() + ry.max()) / 2.0))
            spots.append((cx, cy, reg))
        if len(spots) == 2:                                   # both eyes on the same rows
            cy = int(round((spots[0][1] + spots[1][1]) / 2.0))
            spots = sorted([(x, cy, r) for x, _, r in spots], key=lambda t: t[0])
            if C == 0:
                sp_row = spots[1][0] - spots[0][0]
            else:                                              # same eye spacing as the standing frame of this row
                mid = (spots[0][0] + spots[1][0]) / 2.0
                x1 = int(round(mid - sp_row / 2.0))
                spots = [(x1, cy, spots[0][2]), (x1 + sp_row, cy, spots[1][2])]
        SKIN = np.array([250, 207, 166], np.uint8)
        for cx, cy, reg in spots:
            for y, x in zip(*np.where(reg)):
                nb = [tuple(fr[y + dy, x + dx, :3]) for dy, dx in N8
                      if 0 <= y + dy < CH and 0 <= x + dx < CW and a[y + dy, x + dx] and not reg[y + dy, x + dx] and is_skin(fr[y + dy, x + dx, :3])]
                if nb:
                    vals, cn = np.unique(np.array(nb), axis=0, return_counts=True)
                    fr[y, x, :3] = vals[cn.argmax()]
                else:
                    fr[y, x, :3] = SKIN
                dark[y, x] = False
            for y in range(cy - (EYE_H - 1) // 2, cy - (EYE_H - 1) // 2 + EYE_H):
                keep[y, cx] = True
        fr[keep, :3] = EYE
        eye_log[(R, C)] = int(len(eyes))
        # ---- outline: remaining near-black pixels take a dark shade of the darkest material they border
        rest = dark & ~keep
        src = fr.copy()
        for y, x in zip(*np.where(rest)):
            cand = []
            for dy, dx in N8:
                yy, xx = y + dy, x + dx
                if 0 <= yy < CH and 0 <= xx < CW and a[yy, xx] and not dark[yy, xx]:
                    cand.append(src[yy, xx, :3])
            if not cand:
                fr[y, x, :3] = INDIGO; continue
            cl = [L(c) for c in cand]
            k = int(np.argmin([c[0] for c in cl]))
            base = cl[k]
            if base[0] < 36 and abs(base[1]) < 9 and base[2] < 9:      # charcoal / indigo cloth
                fr[y, x, :3] = INDIGO; continue
            t = np.array([max(15.0, base[0] * 0.55), base[1] * 0.9, base[2] * 0.9])
            ok = pal_lab[:, 0] >= 14
            d = ((pal_lab - t) ** 2).sum(1); d[~ok] = 1e9
            fr[y, x, :3] = pal[d.argmin()]
print('eyes found per frame:', {NAMES[r] + str(c): v for (r, c), v in eye_log.items()})

# ---- mute the wine reds a little (palette only)
alpha = sheet[..., 3] > 0
cols = np.unique(sheet[alpha][:, :3], axis=0)
for c in cols:
    h, s, v = colorsys.rgb_to_hsv(*(c / 255.0))
    if (h > 0.93 or h < 0.02) and s > 0.45:
        n = np.array(colorsys.hsv_to_rgb(h, s * 0.78, v * 0.95)) * 255
        sheet[(sheet[..., :3] == c).all(-1) & alpha, :3] = np.round(n).astype(np.uint8)
ncol = len(np.unique(sheet[alpha][:, :3], axis=0))
print('colours', ncol)

# ---- lantern anchors (glass centre; hidden -> the hip it hangs on)
HIP = {'right': (49, 90), 'down_right': (55, 90), 'up_right': (42, 90)}
lantern = []
for R in range(8):
    row = []
    for C in range(4):
        fr = sheet[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]
        r, g, b = [fr[..., i].astype(int) for i in range(3)]
        hsv = np.array(Image.fromarray(fr[..., :3]).convert('HSV')).astype(int)
        amber = (fr[..., 3] > 0) & (hsv[..., 0] >= 24) & (hsv[..., 0] <= 36) & (hsv[..., 1] > 140) & (hsv[..., 2] > 150)
        amber[:AY - 46] = False                      # below the chest only (not the brass dot at the throat)
        lab, n = nd.label(amber, structure=np.ones((3, 3)))
        if n:
            sz = nd.sum(amber, lab, range(1, n + 1)); i = int(np.argmax(sz))
        if n and sz[i] >= 6 and NAMES[R] not in HIP:
            cy, cx = nd.center_of_mass(lab == i + 1)
            row.append([int(round(cx)), int(round(cy))])
        else:
            row.append(list(HIP.get(NAMES[R], (AX, 90))))
    lantern.append(row)
Image.fromarray(sheet).save(os.path.join(out, 'hero_sheet.png'))
meta = {'file': 'hero_sheet.png', 'frame': [CW, CH], 'foot': [AX, AY], 'body': 80, 'ms': 170, 'cols': 4, 'rows': 8,
        'row_order': NAMES, 'col_order': ['stand', 'left_foot', 'passing', 'right_foot'], 'idle_col': 0,
        'colors': ncol, 'lantern': lantern,
        'note': 'figure 80 art px tall, 1 hero dot = 1 map dot; no floor shadow; lantern = glass centre per row/col in frame '
                'coordinates (hidden behind the body in right, down_right, up_right: the hip position)'}
json.dump(meta, open(os.path.join(out, 'hero_sheet.json'), 'w'), ensure_ascii=False, indent=1)
print('lantern', lantern)

# ---- preview on the map (2x) + gif
S = Image.fromarray(sheet)
fr = lambda r, c: S.crop((c * CW, r * CH, c * CW + CW, r * CH + CH))
mp = Image.open(map_p).convert('RGBA')
FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf'
f1 = ImageFont.truetype(FONT, 22); f2 = ImageFont.truetype(FONT, 15)
COMP = {(0, 0): 6, (1, 0): 3, (2, 0): 7, (0, 1): 1, (2, 1): 2, (0, 2): 4, (1, 2): 0, (2, 2): 5}
JA = {6: '左上', 3: '上', 7: '右上', 1: '左', 2: '右', 4: '左下', 0: '下', 5: '右下'}
OLD = '/mnt/project-files/monastery-test/hero/hero_sheet_hd8.png'


def put(im, sprite, fx, fy):
    """paste a 96x128 frame with its foot anchor at (fx, fy), with a soft contact shadow"""
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([fx - 13, fy - 4, fx + 13, fy + 4], fill=(18, 10, 28, 80))
    im.alpha_composite(sh)
    im.alpha_composite(sprite, (fx - AX, fy - AY))


def compass(col, old=False):
    im = mp.crop((480, 955, 480 + 300, 955 + 300))
    for (gx, gy), r in sorted(COMP.items(), key=lambda t: t[0][1]):
        put(im, fr(r, col), 62 + gx * 88, 100 + gy * 92)
    if old and os.path.exists(OLD):
        o = Image.open(OLD).convert('RGBA').crop((0, 0, 96, 128))
        put(im, o, 150, 192)
    return im


def strip():
    im = mp.crop((400, 890, 400 + 8 * 60, 890 + 4 * 96))
    for r in range(8):
        for c in range(4):
            put(im, fr(r, c), (r % 2) * 240 + c * 60 + 30, (r // 2) * 96 + 90)
    return im

A, B = compass(0, old=True), strip()
pv = Image.new('RGBA', (20 + A.size[0] * 2 + 30 + B.size[0] * 2 + 20, 86 + max(A.size[1], B.size[1]) * 2 + 20), '#17131f')
d = ImageDraw.Draw(pv)
d.text((20, 14), '主人公（作り直し）　身長80ドット・8方向・%d色　／　マップの絵の上に2倍で置いたところ' % ncol, font=f1, fill='#eadfce')
d.text((20, 48), '左：8方向の立ち姿（まん中は前の主人公・大きさ比べ用）　　右：歩きの全コマ（下｜左、右｜上、左下｜右下、左上｜右上）', font=f2, fill='#a898a8')
pv.alpha_composite(A.resize((A.size[0] * 2, A.size[1] * 2), Image.NEAREST), (20, 86))
pv.alpha_composite(B.resize((B.size[0] * 2, B.size[1] * 2), Image.NEAREST), (20 + A.size[0] * 2 + 30, 86))
pv.convert('RGB').save(os.path.join(out, 'hero_preview.png'))
frames = [compass(c).resize((600, 600), Image.NEAREST).convert('P', palette=Image.ADAPTIVE, colors=255) for c in range(4)]
frames[0].save(os.path.join(out, 'hero_walk.gif'), save_all=True, append_images=frames[1:], duration=170, loop=0, disposal=1)
print('ok')
