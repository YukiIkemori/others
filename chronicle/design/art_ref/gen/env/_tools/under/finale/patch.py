"""Small repairs of a painting by copying pixel blocks (cells of the layout grid, T = image px per cell).
usage: python3 patch.py <src.png> <out.png> <W> "sx,sy,w,h->dx,dy" ...   (all in fractional CELLS; blocks copied in order)"""
import sys
from PIL import Image
src, out, W = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
T = im.size[0] / W
for spec in sys.argv[4:]:
    a, b = spec.split('->')
    sx, sy, w, h = map(float, a.split(',')); dx, dy = map(float, b.split(','))
    box = tuple(int(round(v * T)) for v in (sx, sy, sx + w, sy + h))
    blk = im.crop(box)
    im.paste(blk, (int(round(dx * T)), int(round(dy * T))))
im.save(out)
print(out, im.size)
