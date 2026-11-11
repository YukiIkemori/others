"""Owner previews of the rogue: <id>_preview.png (walk + run sheets at 4x on the painted map's stone path, the hero's
standing frame of each direction on the left for size) and <id>_walk.gif / <id>_run.gif (down, left, up, down_left).
usage: python3 preview.py <dir with rogue.png, rogue_run.png> <out dir> [copy-to dir]"""
import sys, os, shutil
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
dst = sys.argv[3] if len(sys.argv) > 3 else None
ID = 'rogue'
CW, CH, AX, AY = 96, 128, 48, 120
HERO = '/home/user/others/chronicle2/twilight/site/hero.png'
MAP = '/home/user/others/chronicle2/twilight/site/map.webp'
FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf'
JA = ['下', '左', '右', '上', '左下', '右下', '左上', '右上']
os.makedirs(out, exist_ok=True)
W = Image.open(os.path.join(src, ID + '.png')).convert('RGBA')
R = Image.open(os.path.join(src, ID + '_run.png')).convert('RGBA')
H = Image.open(HERO).convert('RGBA')
mp = Image.open(MAP).convert('RGBA')
tile = mp.crop((618, 1062, 702, 1202))                      # the stone path between the graves


def ground(w, h):
    """the path crop, mirror-tiled so that no seam shows"""
    tw, th = tile.size
    big = Image.new('RGBA', (tw * 2, th * 2))
    big.paste(tile, (0, 0)); big.paste(tile.transpose(Image.FLIP_LEFT_RIGHT), (tw, 0))
    big.paste(big.crop((0, 0, tw * 2, th)).transpose(Image.FLIP_TOP_BOTTOM), (0, th))
    g = Image.new('RGBA', (w, h))
    for y in range(0, h, th * 2):
        for x in range(0, w, tw * 2):
            g.paste(big, (x, y))
    return g


def put(im, sheet, r, c, fx, fy):
    """one 96x128 frame with its foot anchor at (fx, fy) and a soft contact shadow"""
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([fx - 14, fy - 4, fx + 14, fy + 4], fill=(18, 10, 28, 80))
    im.alpha_composite(sh)
    fr = sheet.crop((c * CW, r * CH, c * CW + CW, r * CH + CH))
    im.alpha_composite(fr, (fx - AX, fy - AY))


# ---- preview sheet
RH = 100                                                     # row pitch in art px
cols = [(H, 0, 'hero')] + [(W, c, 'walk') for c in range(4)] + [(R, c, 'run') for c in range(4)]
XS = [52]
for i in range(1, 9):
    XS.append(XS[-1] + (88 if i in (1, 5) else 76))
gw, gh = XS[-1] + 52, 8 * RH + 8
g = ground(gw, gh)
for r in range(8):
    for (sheet, c, kind), x in zip(cols, XS):
        put(g, sheet, r, c, x, r * RH + 94)
S = 4
f1 = ImageFont.truetype(FONT, 40); f2 = ImageFont.truetype(FONT, 26)
pv = Image.new('RGBA', (gw * S + 120, gh * S + 170), '#17131f')
d = ImageDraw.Draw(pv)
d.text((20, 16), '仲間「ローグ」　歩き と 走り（8方向）　身長82ドット　／　マップの石畳の上に4倍で置いたところ', font=f1, fill='#eadfce')
big = g.resize((gw * S, gh * S), Image.NEAREST)
pv.alpha_composite(big, (100, 150))
heads = [(XS[0], '主人公（比べ用）'), ((XS[1] + XS[4]) / 2, '歩き：立ち・左足・立ち・右足'), ((XS[5] + XS[8]) / 2, '走り：左足着地・空中・右足着地・空中')]
for x, t in heads:
    w = d.textlength(t, font=f2)
    d.text((100 + x * S - w / 2, 106), t, font=f2, fill='#c9b8a8')
for r in range(8):
    d.text((20, 150 + (r * RH + 52) * S), JA[r], font=f2, fill='#c9b8a8')
pv.convert('RGB').save(os.path.join(out, ID + '_preview.png'))


# ---- gifs: down, left, up, down_left side by side, the hero walking / standing next to the first one for size
def gif(sheet, order, ms, name, hero_cols):
    DIRS = [0, 1, 3, 4]
    frames = []
    for i, c in enumerate(order):
        im = ground(4 * 104 + 70, 112)
        put(im, H, 0, hero_cols[i % len(hero_cols)], 36, 100)
        for k, r in enumerate(DIRS):
            put(im, sheet, r, c, 70 + 52 + k * 104, 100)
        frames.append(im.resize((im.size[0] * 3, im.size[1] * 3), Image.NEAREST).convert('P', palette=Image.ADAPTIVE, colors=255))
    frames[0].save(os.path.join(out, name), save_all=True, append_images=frames[1:], duration=ms, loop=0, disposal=1)


gif(W, [1, 2, 3, 0], 170, ID + '_walk.gif', [1, 2, 3, 0])
gif(R, [0, 1, 2, 3], 105, ID + '_run.gif', [0])
print('previews in', out)
if dst:
    os.makedirs(dst, exist_ok=True)
    for n in (ID + '_preview.png', ID + '_walk.gif', ID + '_run.gif'):
        shutil.copyfile(os.path.join(out, n), os.path.join(dst, n))
    print('copied to', dst)
