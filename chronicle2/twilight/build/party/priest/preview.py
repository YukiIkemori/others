"""Preview sheet and gifs for the owner: the priestess next to the hero on the painted map, all walk and run frames at 4x.
usage: python3 preview.py <dir with priest.png, priest_run.png> <out dir>"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1:3]
SITE = '/home/user/others/chronicle2/twilight/site'
CW, CH, AX, AY = 96, 128, 48, 120
K = 4
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
JA = ['下', '左', '右', '上', '左下', '右下', '左上', '右上']
os.makedirs(out, exist_ok=True)
walk = Image.open(os.path.join(src, 'priest.png')).convert('RGBA')
run = Image.open(os.path.join(src, 'priest_run.png')).convert('RGBA')
hero = Image.open(os.path.join(SITE, 'hero.png')).convert('RGBA')
mp = Image.open(os.path.join(SITE, 'map.webp')).convert('RGBA')
FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf'
f1 = ImageFont.truetype(FONT, 30); f2 = ImageFont.truetype(FONT, 20); f3 = ImageFont.truetype(FONT, 18)
fr = lambda S, r, c: S.crop((c * CW, r * CH, c * CW + CW, r * CH + CH))


def put(im, sprite, fx, fy):
    """paste a 96x128 frame with its foot anchor at (fx, fy), with the game's soft contact shadow"""
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([fx - 13, fy - 4, fx + 13, fy + 4], fill=(18, 10, 28, 80))
    im.alpha_composite(sh)
    im.alpha_composite(sprite, (fx - AX, fy - AY))


def up(im):
    return im.resize((im.size[0] * K, im.size[1] * K), Image.NEAREST)


# ---- A: on the real map, beside the hero
A = mp.crop((440, 1020, 440 + 430, 1020 + 176))
order = [0, 1, 2, 3]
for i, r in enumerate(order):
    put(A, fr(hero, r, 0), 34 + i * 104, 150)
    put(A, fr(walk, r, 0), 34 + i * 104 + 46, 150)
# ---- B: every frame on a tiled patch of the map's paved path
patch = mp.crop((604, 1050, 704, 1215)).convert('RGB')
pw, ph = patch.size
RH, WW, RW, LB = 100, 58, 96, 34
BW, BH = LB + 4 * WW + 10 + 4 * RW, 8 * RH
B = Image.new('RGBA', (BW, BH))
tiles = [patch, patch.transpose(Image.FLIP_LEFT_RIGHT)]
for ty in range(0, BH, ph):
    for tx in range(0, BW, pw):
        t = tiles[(tx // pw) % 2]
        if (ty // ph) % 2:
            t = t.transpose(Image.FLIP_TOP_BOTTOM)
        B.paste(t, (tx, ty))
for r in range(8):
    for c in range(4):
        put(B, fr(walk, r, c), LB + c * WW + WW // 2 + (-3 if r in (0, 1, 4, 5) else 3) * 0, r * RH + 92)
        put(B, fr(run, r, c), LB + 4 * WW + 10 + c * RW + RW // 2, r * RH + 92)
A4, B4 = up(A), up(B)
d = ImageDraw.Draw(B4)
for r in range(8):
    d.text((8, r * RH * K + 12), JA[r], font=f2, fill='#fff3dc', stroke_width=3, stroke_fill='#201828')
W = max(A4.size[0], B4.size[0]) + 40
pv = Image.new('RGBA', (W, 90 + A4.size[1] + 70 + B4.size[1] + 20), '#17131f')
d = ImageDraw.Draw(pv)
ncol = len(np.unique(np.concatenate([np.array(S)[np.array(S)[..., 3] > 0][:, :3] for S in (walk, run)]), axis=0))
d.text((20, 14), '僧侶（神官の少女）　身長76ドット・8方向・歩き4コマ＋走り4コマ・%d色' % ncol, font=f1, fill='#eadfce')
d.text((20, 56), '上：マップの上で主人公（左・身長80）と並べたところ（4倍）　　下：全コマ　左4列＝歩き、右4列＝走り', font=f3, fill='#a898a8')
pv.alpha_composite(A4, (20, 90))
y = 90 + A4.size[1] + 20
d.text((20 + LB * K, y), '歩き（立ち・左足・立ち・右足）', font=f2, fill='#eadfce')
d.text((20 + (LB + 4 * WW + 10) * K, y), '走り（左足着地・空中・右足着地・空中）', font=f2, fill='#eadfce')
pv.alpha_composite(B4, (20, y + 36))
pv.convert('RGB').save(os.path.join(out, 'priest_preview.png'), optimize=True)

# ---- gifs: down, left, up, down_left on the map
G = mp.crop((476, 1052, 476 + 4 * 88, 1052 + 118))
for name, S, ms in (('walk', walk, 170), ('run', run, 105)):
    frames = []
    for c in range(4):
        im = G.copy()
        for i, r in enumerate([0, 1, 3, 4]):
            put(im, fr(S, r, c), i * 88 + 44, 104)
        frames.append(up(im).convert('RGB').quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE))
    frames[0].save(os.path.join(out, 'priest_%s.gif' % name), save_all=True, append_images=frames[1:], duration=ms, loop=0, disposal=1)
print('ok', pv.size)
