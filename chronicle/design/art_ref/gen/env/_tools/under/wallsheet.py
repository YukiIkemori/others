import sys, json
from PIL import Image, ImageDraw
a = Image.open(sys.argv[1]).convert('RGB')
if a.width > 1408: a = a.resize((1408, 1152), Image.BOX)
ids = sys.argv[3].split(',')
out = []
for b in json.load(open('blds.json')):
    if b['id'] not in ids: continue
    x0, x1 = b['x'] * 32 - 8, (b['x'] + b['w']) * 32 + 8
    y1 = (b['y'] + b['h']) * 32 + 24; y0 = (b['y'] + b['h'] - b['wall']) * 32 - 8
    K = 4
    c = a.crop((x0, y0, x1, y1)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.NEAREST)
    cc = Image.new('RGB', (c.width, c.height + 20), (0, 0, 0)); cc.paste(c, (0, 20)); g = ImageDraw.Draw(cc)
    for x in range((x0 // 8 + 1) * 8, x1, 8):
        col = (255, 0, 255) if x % 32 == 0 else (0, 200, 255)
        g.line([((x - x0) * K, 20), ((x - x0) * K, 30)], fill=col, width=2)
        if x % 16 == 0: g.text(((x - x0) * K - 8, 2), str(x), fill=col)
    b2 = b['door'][0] * 32
    g.rectangle([(b2 - x0) * K, 20 + ((b['door'][1] * 32) - y0) * K, (b2 + 32 - x0) * K, 20 + ((b['door'][1] + 1) * 32 - y0) * K], outline=(0, 255, 0), width=2)
    g.text((4, 22), b['id'], fill=(255, 255, 255))
    out.append(cc)
W = max(c.width for c in out); H = sum(c.height for c in out)
s = Image.new('RGB', (W, H)); y = 0
for c in out: s.paste(c, (0, y)); y += c.height
s.save(sys.argv[2])
