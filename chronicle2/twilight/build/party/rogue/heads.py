"""head close-ups (8x) of every frame of a sheet, to check the eye dots. usage: heads.py <sheet> <out> [rows]"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA')
rows = [int(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 else list(range(8))
S = 7
cv = Image.new('RGBA', (4 * 56, len(rows) * 40), (70, 62, 84, 255))
for j, r in enumerate(rows):
    for c in range(4):
        fr = im.crop((c * 96, r * 128, c * 96 + 96, r * 128 + 128))
        bb = fr.getbbox()
        cx = (bb[0] + bb[2]) // 2
        # the head: top 40 rows of the figure, centred on the top rows
        top = fr.crop((0, bb[1], 96, bb[1] + 12)).getbbox()
        hx = (top[0] + top[2]) // 2
        cv.alpha_composite(fr.crop((hx - 28, bb[1] - 2, hx + 28, bb[1] + 38)), (c * 56, j * 40))
cv.resize((cv.size[0] * S, cv.size[1] * S), Image.NEAREST).save(sys.argv[2])
