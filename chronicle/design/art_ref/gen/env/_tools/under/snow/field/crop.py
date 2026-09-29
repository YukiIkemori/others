"""crop.py <id> x0 y0 x1 y1 out.png : the processed @32 underlay of a field area, cells x0..x1 / y0..y1 with a grid, numbers and the
collision (rows_fit) as red hatching"""
import sys, json
from PIL import Image, ImageDraw
aid = sys.argv[1]; x0, y0, x1, y1 = map(int, sys.argv[2:6]); out = sys.argv[6]
d = json.load(open(aid + '/layout.json')); rows = d.get('rows_fit') or d['rows']; T = 32
im = Image.open('/home/user/others/chronicle/v2/assets/env/field/under/%s@32.png' % aid).convert('RGBA').crop((x0 * T, y0 * T, (x1 + 1) * T, (y1 + 1) * T))
ov = Image.new('RGBA', im.size); g = ImageDraw.Draw(ov)
for y in range(y0, y1 + 1):
    for x in range(x0, x1 + 1):
        X, Y = (x - x0) * T, (y - y0) * T
        if rows[y][x] in '~wTFbrRX': g.line([X, Y, X + T - 1, Y + T - 1], fill=(255, 0, 0, 200), width=2); g.rectangle([X, Y, X + T - 1, Y + T - 1], outline=(255, 0, 0, 90))
        g.rectangle([X, Y, X + T - 1, Y + T - 1], outline=(0, 0, 0, 40))
        if x % 5 == 0 or y % 5 == 0: g.text((X + 2, Y + 2), '%d,%d' % (x, y), fill=(0, 0, 90, 255))
im = Image.alpha_composite(im, ov).resize((im.size[0] * 2, im.size[1] * 2), Image.NEAREST); im.save(out)
