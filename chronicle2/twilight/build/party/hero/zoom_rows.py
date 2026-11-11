"""python3 zoom_rows.py <run_sheet.png> <prefix> [scale]: one image per row pair (walk stand + 4 run frames), big"""
import sys
from PIL import Image, ImageDraw
run = Image.open(sys.argv[1]).convert('RGBA'); pre = sys.argv[2]; S = int(sys.argv[3]) if len(sys.argv) > 3 else 5
walk = Image.open('/home/user/others/chronicle2/twilight/site/hero.png').convert('RGBA')
for k in range(4):
    cv = Image.new('RGBA', (48 + 4 * 84, 2 * 92), (86, 84, 104, 255))
    d = ImageDraw.Draw(cv)
    for j, r in enumerate((2 * k, 2 * k + 1)):
        y = j * 92
        d.line([0, y + 87, cv.size[0], y + 87], fill=(120, 116, 140, 255))
        cv.alpha_composite(walk.crop((24, r * 128 + 34, 72, r * 128 + 126)), (0, y))
        for c in range(4):
            cv.alpha_composite(run.crop((c * 96 + 6, r * 128 + 34, c * 96 + 90, r * 128 + 126)), (48 + c * 84, y))
    cv.resize((cv.size[0] * S, cv.size[1] * S), Image.NEAREST).convert('RGB').save('%s_%d.png' % (pre, k))
