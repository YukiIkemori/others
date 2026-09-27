import json, sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
T = 32
im = Image.open(src).convert('RGB')
bl = [b for b in json.load(open('blds.json')) if b.get('door')] + [dict(id='base', door=[36, 40])]
S = 4
tiles = []
for b in bl:
    dx, dy = b['door']
    c = im.crop(((dx - 2) * T, (dy - 3) * T, (dx + 3) * T, (dy + 2) * T)).resize((5 * T * S // 2, 5 * T * S // 2), Image.NEAREST)
    g = ImageDraw.Draw(c); u = T * S // 2
    for i in range(6): g.line([i * u, 0, i * u, 5 * u], fill=(255, 0, 255)); g.line([0, i * u, 5 * u, i * u], fill=(255, 0, 255))
    g.rectangle([2 * u, 3 * u, 3 * u - 1, 4 * u - 1], outline=(0, 255, 0), width=3)
    g.text((4, 4), b['id'], fill=(255, 255, 0))
    tiles.append(c)
n = len(tiles); cols = 4; w, h = tiles[0].size
sheet = Image.new('RGB', (cols * w, ((n + cols - 1) // cols) * h))
for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
