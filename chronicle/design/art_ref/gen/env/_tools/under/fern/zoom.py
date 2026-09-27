"""zoom sheet of door / ladder cells on the tile grid: python3 zoom.py img.png out.png x,y[,label] ..."""
import sys
from PIL import Image, ImageDraw
a = Image.open(sys.argv[1]).convert('RGB')
if a.width != 1920: a = a.resize((1920, 1792), Image.BOX)
tiles = []
for spec in sys.argv[3:]:
    p = spec.split(','); x, y = int(p[0]), int(p[1]); lab = p[2] if len(p) > 2 else spec
    x0, y0 = x * 32 - 64, y * 32 - 64
    c = a.crop((x0, y0, x0 + 160, y0 + 128)).resize((480, 384), Image.NEAREST); g = ImageDraw.Draw(c)
    for k in range(6): g.line([(k * 96, 0), (k * 96, 384)], fill=(255, 0, 255))
    for k in range(5): g.line([(0, k * 96), (480, k * 96)], fill=(255, 0, 255))
    for k in range(0, 160, 8): g.line([(k * 3, 0), (k * 3, 6)], fill=(0, 255, 255))
    g.rectangle([192, 192, 287, 287], outline=(0, 255, 255), width=2)
    g.text((4, 4), lab, fill=(255, 255, 255))
    tiles.append(c)
n = len(tiles); cols = 4
sheet = Image.new('RGB', (480 * cols, 384 * ((n + cols - 1) // cols)))
for i, c in enumerate(tiles): sheet.paste(c, ((i % cols) * 480, (i // cols) * 384))
sheet.save(sys.argv[2])
