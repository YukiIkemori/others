"""Previews for the owner: hero_preview.png (walk and run frames at 4x on crops of the painted map, row by row, with the
standing figure in front for size comparison) and hero_walk.gif / hero_run.gif (down, left, up, down_left).
usage: python3 preview_run.py <walk.png> <run.png> <out_dir>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
walk_p, run_p, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
CW, CH, AX, AY = 96, 128, 48, 120
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
JA = ['下', '左', '右', '上', '左下', '右下', '左上', '右上']
MAP = Image.open('/home/user/tw/map/map_art.png').convert('RGBA')
W = Image.open(walk_p).convert('RGBA'); R = Image.open(run_p).convert('RGBA')
FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf'
f1 = ImageFont.truetype(FONT, 30); f2 = ImageFont.truetype(FONT, 20); f3 = ImageFont.truetype(FONT, 18)
S = 4


def fr(sheet, r, c):
    return sheet.crop((c * CW, r * CH, c * CW + CW, r * CH + CH))


def put(im, sprite, fx, fy, shadow=True):
    """paste a 96x128 frame with its foot anchor at (fx, fy), with the soft contact shadow of the game"""
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([fx - 13, fy - 4, fx + 13, fy + 4], fill=(18, 10, 28, 80))
        im.alpha_composite(sh)
    im.alpha_composite(sprite, (fx - AX, fy - AY))


# ---- preview sheet: per direction one strip of paved map ground; 4 walk frames | 4 run frames
PW, PR, ROWH = 52, 78, 100                 # pitch of walk frames, pitch of run frames, strip height (art px)
SW = 4 * PW + 26 + 4 * PR + 8
# a calm paved piece of the map (the upper terrace), repeated mirrored, so the sprites read clearly
def ground(w, h, dy=0):
    tile = MAP.crop((772, 336 + dy, 772 + 132, 336 + dy + h))
    bg = Image.new('RGBA', (w, h))
    for i in range(0, w // 132 + 1):
        bg.paste(tile if i % 2 == 0 else tile.transpose(Image.FLIP_LEFT_RIGHT), (i * 132, 0))
    return bg

strips = []
for r in range(8):
    bg = ground(SW, ROWH, (r % 4) * 4)
    for c in range(4):
        put(bg, fr(W, r, c), 4 + PW // 2 + c * PW, ROWH - 8)
    for c in range(4):
        put(bg, fr(R, r, c), 4 * PW + 26 + PR // 2 + c * PR, ROWH - 8)
    strips.append(bg)
LBL = 70
pv = Image.new('RGBA', (20 + LBL + SW * S + 20, 120 + 8 * (ROWH * S + 14) + 10), '#17131f')
d = ImageDraw.Draw(pv)
d.text((20, 16), '主人公　歩き（今までのまま）と　走り（新しく追加）　／　マップの絵の上に4倍で置いたところ', font=f1, fill='#eadfce')
d.text((20, 62), '各段：左4コマ＝歩き（立ち・左足・立ち・右足）　右4コマ＝走り（左足が着く・宙に浮く・右足が着く・宙に浮く）　色は歩きと同じ28色', font=f2, fill='#a898a8')
d.text((20 + LBL + 10, 92), '歩き', font=f2, fill='#d8c8a8'); d.text((20 + LBL + (4 * PW + 26) * S, 92), '走り', font=f2, fill='#d8c8a8')
for r, st in enumerate(strips):
    y = 120 + r * (ROWH * S + 14)
    pv.alpha_composite(st.resize((SW * S, ROWH * S), Image.NEAREST), (20 + LBL, y))
    d.text((24, y + ROWH * S // 2 - 12), JA[r], font=f1, fill='#eadfce')
pv.convert('RGB').save(os.path.join(out, 'hero_preview.png'))

# ---- gifs: down, left, up, down_left side by side on the map, 4x
ROWS = [0, 1, 3, 4]
GP = 84
def gif(sheet, name, ms, label):
    frames = []
    for c in range(4):
        bg = ground(4 * GP, 112)
        for i, r in enumerate(ROWS):
            put(bg, fr(sheet, r, c), GP // 2 + i * GP, 100)
        im = bg.resize((bg.size[0] * S, bg.size[1] * S), Image.NEAREST)
        dd = ImageDraw.Draw(im)
        dd.text((10, 8), label, font=f3, fill='#eadfce')
        frames.append(im.convert('RGB'))
    # one palette for all frames (no flicker): the sprite's own colours exactly + 220 colours of the map crop
    bgq = ground(4 * GP, 112).convert('RGB').quantize(colors=220, method=Image.MEDIANCUT, dither=Image.NONE)
    cols = bgq.getpalette()[:220 * 3]
    for _, c in (sheet.convert('RGBA').getcolors(1 << 16) or []):
        if c[3]:
            cols += list(c[:3])
    cols += [0xea, 0xdf, 0xce, 26, 16, 34]
    cols = cols[:768] + [0] * (768 - len(cols))
    pal = Image.new('P', (1, 1)); pal.putpalette(cols)
    q = [f.quantize(palette=pal, dither=Image.NONE) for f in frames]
    q[0].save(os.path.join(out, name), save_all=True, append_images=q[1:], duration=ms, loop=0, disposal=1)

gif(W, 'hero_walk.gif', 170, '歩き（下・左・上・左下）')
gif(R, 'hero_run.gif', 105, '走り（下・左・上・左下）')
print('ok', pv.size)
