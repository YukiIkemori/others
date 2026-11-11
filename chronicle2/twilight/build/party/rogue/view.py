"""quick look: frames of a sheet next to the hero's at Nx on dusk grey.
usage: python3 view.py <sheet.png> <out.png> <row,row,..> [scale=6] [cols=0,1,3] [hero=1]"""
import sys
from PIL import Image
sheet, out = sys.argv[1], sys.argv[2]
rows = [int(v) for v in sys.argv[3].split(',')]
S = int(sys.argv[4]) if len(sys.argv) > 4 else 6
cols = [int(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else [0, 1, 3]
hero = (sys.argv[6] != '0') if len(sys.argv) > 6 else True
im = Image.open(sheet).convert('RGBA')
H = Image.open('/home/user/others/chronicle2/twilight/site/hero.png').convert('RGBA')
W = 64
n = len(cols) + (1 if hero else 0)
cv = Image.new('RGBA', (W * n, 96 * len(rows)), (70, 62, 84, 255))
for j, r in enumerate(rows):
    k = 0
    if hero:
        cv.alpha_composite(H.crop((16, r * 128 + 30, 80, r * 128 + 126)), (0, j * 96)); k = 1
    for i, c in enumerate(cols):
        cv.alpha_composite(im.crop((c * 96 + 16, r * 128 + 30, c * 96 + 80, r * 128 + 126)), ((i + k) * W, j * 96))
cv.resize((cv.size[0] * S, cv.size[1] * S), Image.NEAREST).save(out)
