"""Layout guide for the painted Yura underlay (tile 32), drawn from the map dump."""
import json, random, os, math
from PIL import Image, ImageDraw
d = json.load(open(os.environ.get('MAPDUMP', 'lay_data.json')))
T = 32; W, H = d['w'], d['h']
rows = d['rows']
COL = {',': (86, 140, 70), 'e': (190, 150, 100), '~': (50, 110, 200), 's': (50, 110, 200), 'F': (20, 52, 30), 'T': (86, 140, 70),
       'h': (70, 104, 52), 'p': (205, 196, 170), 'g': (150, 200, 120)}
im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
ch = lambda x, y: rows[y][x] if 0 <= x < W and 0 <= y < H else 'F'
for y in range(H):
    for x in range(W):
        g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=COL[ch(x, y)])
# hill slope: contour hatching so it reads as a raised mound (not a wall)
for y in range(H):
    for x in range(W):
        if ch(x, y) == 'h':
            for k in range(0, T, 8): g.line([x * T, y * T + k + 3, x * T + T - 1, y * T + k + 3], fill=(58, 88, 44), width=2)
# spiral path: stone slabs outline
for y in range(H):
    for x in range(W):
        if ch(x, y) == 'p':
            g.rectangle([x * T + 3, y * T + 3, x * T + T - 4, y * T + T - 4], outline=(160, 150, 125))
# stepping stones: two round flat stones per tile
for y in range(H):
    for x in range(W):
        if ch(x, y) == 's':
            g.ellipse([x * T + 3, y * T + 3, x * T + T - 4, y * T + T - 4], fill=(185, 185, 190), outline=(90, 90, 100), width=2)
rnd = random.Random(5)
for y in range(H):
    for x in range(W):
        c = ch(x, y)
        if c in 'FT':
            cx, cy = x * T + 16 + rnd.randint(-4, 4), y * T + 14 + rnd.randint(-3, 3)
            r = 19 if c == 'T' else 20
            g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(40, 96, 48) if c == 'T' else (30, 72, 40), outline=(16, 44, 22))
blds = []
for o in d['objects']:
    if o['type'] != 'building': continue
    x0, y0, w, h = o['x'] * T, o['y'] * T, o['w'] * T, o['h'] * T
    wall = o.get('wall', 2) * T
    mill = o['id'] == 'yura_mill'
    if mill:   # house part x17..21 (5 tiles), wheel east
        hw = 5 * T
        g.rounded_rectangle([x0, y0 + 4, x0 + hw - 1, y0 + h - wall + 6], 26, fill=(150, 175, 70), outline=(40, 30, 30), width=2)
        g.rounded_rectangle([x0 + 2, y0 + h - wall, x0 + hw - 3, y0 + h - 1], 14, fill=(165, 160, 150), outline=(40, 30, 30), width=2)
        for sx in (x0 + 40, x0 + 112):
            wy = y0 + h - wall + 20; g.rectangle([sx - 7, wy, sx + 7, wy + 12], fill=(255, 220, 120), outline=(40, 30, 30))
        cx, cy, r = 23.5 * T, 5.5 * T - 2, 70
        g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(140, 90, 40), outline=(60, 35, 15), width=4)
        g.ellipse([cx - r + 14, cy - r + 14, cx + r - 14, cy + r - 14], outline=(60, 35, 15), width=3)
        for k in range(12):
            a = k * math.pi / 6
            g.line([cx, cy, cx + math.cos(a) * r, cy + math.sin(a) * r], fill=(90, 55, 25), width=3)
        g.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(60, 40, 30))
        blds.append(dict(id=o['id'], x=o['x'], y=o['y'], w=o['w'], h=o['h'], wall=o.get('wall', 2), door=None))
        continue
    # round hut: domed turf roof (upper part) over a curved fieldstone wall (lower part)
    g.rounded_rectangle([x0 + 1, y0 + 2, x0 + w - 2, y0 + h - wall + 8], min(40, (h - wall) // 2 + 6), fill=(150, 175, 70), outline=(40, 30, 30), width=2)
    g.rounded_rectangle([x0 + 3, y0 + h - wall, x0 + w - 4, y0 + h - 1], 18, fill=(165, 160, 150), outline=(40, 30, 30), width=2)
    g.rounded_rectangle([x0 + 1, y0 + 2, x0 + w - 2, y0 + h - wall + 8], min(40, (h - wall) // 2 + 6), outline=(40, 30, 30), width=2)
    dx, dy = o['door']['x'] * T, o['door']['y'] * T
    g.rectangle([dx + 5, dy + 2, dx + T - 6, dy + T - 1], fill=(20, 10, 10))
    nw = o.get('windows', 1)
    cand = [x0 + int((i + 0.5) * w / (nw + 1)) for i in range(nw + 1)]
    slots = sorted(cand, key=lambda sx: -abs(sx - (dx + 16)))[:nw]
    for sx in slots:
        if abs(sx - (dx + 16)) < 26: sx += 32 if sx >= dx + 16 else -32
        wy = y0 + h - wall + 12
        g.rectangle([sx - 7, wy, sx + 7, wy + 12], fill=(255, 220, 120), outline=(40, 30, 30))
    blds.append(dict(id=o['id'], x=o['x'], y=o['y'], w=o['w'], h=o['h'], wall=o.get('wall', 2), door=[o['door']['x'], o['door']['y']]))
im.save('guide_1x.png')
im.resize((W * T * 2, H * T * 2), Image.NEAREST).save('guide_2x.png')
json.dump(blds, open('blds.json', 'w'), indent=1)
print(len(blds), 'buildings')
