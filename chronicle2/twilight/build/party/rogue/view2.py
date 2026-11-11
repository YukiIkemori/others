"""full frames of chosen rows at Nx on dusk grey, with the anchor line. usage: view2.py <sheet> <out> <rows> [scale=5] [line=1]"""
import sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert('RGBA')
rows = [int(v) for v in sys.argv[3].split(',')]
S = int(sys.argv[4]) if len(sys.argv) > 4 else 5
line = (sys.argv[5] != '0') if len(sys.argv) > 5 else True
cv = Image.new('RGBA', (96 * 4, 100 * len(rows)), (70, 62, 84, 255))
d = ImageDraw.Draw(cv)
for j, r in enumerate(rows):
    if line:
        d.line([(0, j * 100 + 121 - 26), (96 * 4, j * 100 + 121 - 26)], fill=(110, 100, 130, 255))
        for c in range(4):
            d.line([(c * 96 + 48, j * 100 + 96), (c * 96 + 48, j * 100 + 99)], fill=(200, 190, 220, 255))
    cv.alpha_composite(im.crop((0, r * 128 + 26, 384, r * 128 + 126)), (0, j * 100))
cv.resize((cv.size[0] * S, cv.size[1] * S), Image.NEAREST).save(sys.argv[2])
