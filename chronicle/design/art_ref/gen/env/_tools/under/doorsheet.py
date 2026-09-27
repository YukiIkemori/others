import sys, json
from PIL import Image, ImageDraw
a = Image.open(sys.argv[1]).convert('RGB')
if a.width > 1408: a = a.resize((1408, 1152), Image.BOX)
tiles = []
for b in json.load(open('blds.json')):
    dx, dy = b['door']; x0, y0 = dx * 32 - 64, dy * 32 - 48
    c = a.crop((x0, y0, x0 + 160, y0 + 96)).resize((480, 288), Image.NEAREST); g = ImageDraw.Draw(c)
    for k in range(6): g.line([(k * 96, 0), (k * 96, 288)], fill=(255, 0, 255))
    g.rectangle([192, 144, 287, 239], outline=(0, 255, 255), width=2)
    g.text((4, 4), b['id'], fill=(255, 255, 255))
    tiles.append(c)
sheet = Image.new('RGB', (480 * 4, 288 * 2))
for i, c in enumerate(tiles): sheet.paste(c, ((i % 4) * 480, (i // 4) * 288))
sheet.save(sys.argv[2])
