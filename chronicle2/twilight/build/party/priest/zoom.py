"""python3 zoom.py <sheet.png> <out.png> <scale> R,C R,C ...   (frames side by side, cropped to x 8..88, y 28..126)"""
import sys
from PIL import Image
S = Image.open(sys.argv[1]).convert('RGBA'); k = int(sys.argv[3])
cells = [tuple(int(v) for v in s.split(',')) for s in sys.argv[4:]]
cv = Image.new('RGBA', (80 * len(cells), 98), (70, 62, 84, 255))
for i, (R, C) in enumerate(cells):
    cv.alpha_composite(S.crop((C * 96 + 8, R * 128 + 28, C * 96 + 88, R * 128 + 126)), (i * 80, 0))
cv.resize((cv.size[0] * k, cv.size[1] * k), Image.NEAREST).save(sys.argv[2])
