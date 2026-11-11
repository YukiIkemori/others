"""Contact view of sheets on a neutral backdrop. usage: python3 viewsheet.py <out.png> <scale> <rows a-b> <sheet.png> [sheet2.png ...]
The hero's standing frame of each row is put first for size comparison."""
import sys
from PIL import Image, ImageDraw
out, sc, rows = sys.argv[1], int(sys.argv[2]), sys.argv[3]
r0, r1 = [int(v) for v in rows.split('-')]
sh = [Image.open(p).convert('RGBA') for p in sys.argv[4:]]
hero = Image.open('/home/user/others/chronicle2/twilight/site/hero.png').convert('RGBA')
CW, CH = 96, 128
n = 1 + 4 * len(sh)
im = Image.new('RGBA', (n * CW, (r1 - r0 + 1) * CH), (96, 100, 96, 255))
d = ImageDraw.Draw(im)
for i, r in enumerate(range(r0, r1 + 1)):
    d.line([(0, i * CH + 120), (n * CW, i * CH + 120)], fill=(70, 74, 70, 255))
    d.line([(0, i * CH + 120 - 80), (n * CW, i * CH + 120 - 80)], fill=(110, 114, 110, 255))
    for k in range(n):
        d.line([(k * CW + 48, i * CH), (k * CW + 48, i * CH + CH)], fill=(104, 108, 104, 255))
    im.alpha_composite(hero.crop((0, r * CH, CW, r * CH + CH)), (0, i * CH))
    for s, S in enumerate(sh):
        im.alpha_composite(S.crop((0, r * CH, 4 * CW, r * CH + CH)), (CW + s * 4 * CW, i * CH))
im.resize((im.size[0] * sc, im.size[1] * sc), Image.NEAREST).convert('RGB').save(out)
print(out, im.size)
