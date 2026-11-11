"""Previews for the owner: <id>_preview.png (hero stand | walk x4 | run x4 for the 8 directions, 4x, on a crop of the
painted map) and <id>_walk.gif / <id>_run.gif (down, left, up, down_left).
usage: python3 preview.py <site/party dir> <id> <out dir> [label]"""
import sys, os, json
from PIL import Image, ImageDraw, ImageFont
src, cid, out = sys.argv[1], sys.argv[2], sys.argv[3]
label = sys.argv[4] if len(sys.argv) > 4 else cid
os.makedirs(out, exist_ok=True)
SITE = '/home/user/others/chronicle2/twilight/site/'
CW, CH, AX, AY = 96, 128, 48, 120
js = json.load(open(os.path.join(src, cid + '.json')))
walk = Image.open(os.path.join(src, cid + '.png')).convert('RGBA')
run = Image.open(os.path.join(src, js['run']['src'])).convert('RGBA')
hero = Image.open(SITE + 'hero.png').convert('RGBA')
mp = Image.open(SITE + 'map.webp').convert('RGBA')
bgc = Image.new('RGBA', mp.size, (30, 22, 40, 255)); bgc.alpha_composite(mp); mp = bgc
FONT = '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf'
f1 = ImageFont.truetype(FONT, 30); f2 = ImageFont.truetype(FONT, 20); f3 = ImageFont.truetype(FONT, 22)
JA = ['下', '左', '右', '上', '左下', '右下', '左上', '右上']
fr = lambda S, r, c: S.crop((c * CW, r * CH, c * CW + CW, r * CH + CH))


def put(im, sprite, fx, fy):
    """paste a 96x128 frame with its foot anchor at (fx, fy), with a soft contact shadow"""
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([fx - 13, fy - 4, fx + 13, fy + 4], fill=(18, 10, 28, 80))
    im.alpha_composite(sh)
    im.alpha_composite(sprite, (fx - AX, fy - AY))


# ---- preview: 8 rows; hero | walk x4 | run x4
S = 4
PITCH = 92
XH, XW, XR = 44, [112, 172, 232, 292], [376, 454, 532, 610]
W, H = 664, 8 * PITCH + 12
# the graveyard and the path to the nave
bg = Image.new('RGBA', (W, H), (30, 22, 40, 255))
bg.alpha_composite(mp.crop((308, 850, 308 + W, 850 + H)), (0, 0))
for r in range(8):
    fy = r * PITCH + 90
    put(bg, fr(hero, r, 0), XH, fy)
    for c in range(4):
        put(bg, fr(walk, r, c), XW[c], fy)
        put(bg, fr(run, r, c), XR[c], fy)
big = bg.resize((W * S, H * S), Image.NEAREST)
HEAD = 118
pv = Image.new('RGBA', (W * S, H * S + HEAD), '#17131f')
pv.alpha_composite(big, (0, HEAD))
d = ImageDraw.Draw(pv)
d.text((24, 16), '%s　歩き・走り（各8方向×4コマ）　身長%dドット　マップの絵の上に4倍で置いたところ' % (label, js['body']), font=f1, fill='#eadfce')
d.text((24, 64), '左の列：主人公（大きさ比べ用・身長80ドット）　／　まん中4コマ：歩き　／　右4コマ：走り（左足着地・空中・右足着地・空中）', font=f2, fill='#a898a8')
for r in range(8):
    y = HEAD + (r * PITCH + 14) * S
    d.text((10, y), JA[r], font=f3, fill='#fff4dc', stroke_width=3, stroke_fill='#17131f')
for x, t in [(XH, '主人公'), (XW[0], '歩き'), (XR[0], '走り')]:
    d.text((x * S - 40, HEAD + 6), t, font=f3, fill='#fff4dc', stroke_width=3, stroke_fill='#17131f')
pv.convert('RGB').save(os.path.join(out, cid + '_preview.png'))
print(os.path.join(out, cid + '_preview.png'), pv.size)

# ---- gifs: down, left, up, down_left, standing on the paved upper terrace
ROWS = [0, 1, 3, 4]
GP = 72
GW, GH = 4 * GP + 8, 112
gbg = mp.crop((760, 342, 760 + GW, 342 + GH))
for name, sheet, ms in (('walk', walk, js['ms']), ('run', run, js['run']['ms'])):
    frames = []
    for c in range(4):
        im = gbg.copy()
        for i, r in enumerate(ROWS):
            put(im, fr(sheet, r, c), 4 + i * GP + GP // 2, 100)
        frames.append(im.resize((GW * 4, GH * 4), Image.NEAREST).convert('P', palette=Image.ADAPTIVE, colors=255))
    p = os.path.join(out, '%s_%s.gif' % (cid, name))
    frames[0].save(p, save_all=True, append_images=frames[1:], duration=ms, loop=0, disposal=1)
    print(p, frames[0].size, ms, 'ms')
