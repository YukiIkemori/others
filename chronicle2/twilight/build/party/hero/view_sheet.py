"""quick look: python3 view_sheet.py <run_sheet.png> <out_prefix>  -> <prefix>_a.png (rows 0-3), <prefix>_b.png (rows 4-7):
walk standing frame + the 4 run frames at 3x on a grey-violet ground with the foot line drawn"""
import sys
from PIL import Image, ImageDraw
run = Image.open(sys.argv[1]).convert('RGBA'); pre = sys.argv[2]
walk = Image.open('/home/user/others/chronicle2/twilight/site/hero.png').convert('RGBA')
Y0, Y1, S = 34, 126, 3
for part, rows in (('a', range(0, 4)), ('b', range(4, 8))):
    cv = Image.new('RGBA', (5 * 96, 4 * (Y1 - Y0)), (86, 84, 104, 255))
    d = ImageDraw.Draw(cv)
    for j, r in enumerate(rows):
        y = j * (Y1 - Y0)
        d.line([0, y + 120 - Y0 + 1, 5 * 96, y + 120 - Y0 + 1], fill=(120, 116, 140, 255))
        d.line([0, y + 41 - Y0, 5 * 96, y + 41 - Y0], fill=(100, 96, 120, 255))
        for c in range(5):
            d.line([c * 96 + 48, y, c * 96 + 48, y + 3], fill=(200, 200, 60, 255))
        cv.alpha_composite(walk.crop((0, r * 128 + Y0, 96, r * 128 + Y1)), (0, y))
        for c in range(4):
            cv.alpha_composite(run.crop((c * 96, r * 128 + Y0, c * 96 + 96, r * 128 + Y1)), ((c + 1) * 96, y))
    cv.resize((cv.size[0] * S, cv.size[1] * S), Image.NEAREST).convert('RGB').save('%s_%s.png' % (pre, part))
