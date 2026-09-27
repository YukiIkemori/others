"""Layout guide for the painted Roa underlay, drawn from the map dump (tile 32)."""
import json, random, os
from PIL import Image, ImageDraw
d = json.load(open(os.environ.get('MAPDUMP', 'before_data.json')))
T = 32; W, H = d['w'], d['h']
rows = d['rows']; leg = d['legend']
COL = {'grass': (86, 140, 70), 'road': (190, 150, 100), 'cobble': (150, 150, 158), 'dirt': (125, 88, 58), 'flowers': (200, 120, 190),
       'tree': (28, 70, 36), 'water': (50, 110, 200), 'cliff': (95, 70, 55), 'stone_floor': (205, 205, 210)}
im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
for y in range(H):
    for x in range(W):
        m = leg[rows[y][x]]['mat']
        g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=COL[m])
rnd = random.Random(3)
# trees: blobs of canopy circles, trunks at the south edge of the tree area
for y in range(H):
    for x in range(W):
        if leg[rows[y][x]]['mat'] == 'tree':
            cx, cy = x * T + 16 + rnd.randint(-5, 5), y * T + 14 + rnd.randint(-4, 4)
            g.ellipse([cx - 19, cy - 19, cx + 19, cy + 19], fill=(40, 96, 48), outline=(16, 44, 22))
# cliff: the ledge top (dark band) + south face
for y in range(H):
    for x in range(W):
        if leg[rows[y][x]]['mat'] == 'cliff':
            g.rectangle([x * T, y * T, x * T + T - 1, y * T + 7], fill=(70, 110, 60))
            g.rectangle([x * T, y * T + 8, x * T + T - 1, y * T + T - 1], fill=(92, 66, 50))
        if leg[rows[y][x]]['mat'] == 'stone_floor':
            for k in range(4):
                g.rectangle([x * T, y * T + k * 8, x * T + T - 1, y * T + k * 8 + 5], fill=(200, 200, 206))
ROOF = {'thatch': (215, 180, 90), 'shingle': (150, 70, 55), 'moss': (95, 140, 70), 'slate': (90, 100, 130)}
WALL = {'plaster': (235, 225, 200), 'log': (130, 85, 50), 'stone': (160, 160, 165)}
blds = []
for o in d['objects']:
    if o['type'] == 'building':
        x0, y0, w, h = o['x'] * T, o['y'] * T, o['w'] * T, o['h'] * T
        wall = o.get('wall', 2) * T
        g.rectangle([x0, y0, x0 + w - 1, y0 + h - wall - 1], fill=ROOF[o.get('roof', 'slate')], outline=(40, 30, 30))
        g.line([x0 + 4, y0 + (h - wall) // 2, x0 + w - 5, y0 + (h - wall) // 2], fill=(60, 40, 30), width=3)   # ridge
        g.rectangle([x0, y0 + h - wall, x0 + w - 1, y0 + h - 1], fill=WALL[o.get('mat', 'plaster')], outline=(40, 30, 30))
        dx, dy = o['door']['x'] * T, o['door']['y'] * T
        g.rectangle([dx + 5, dy + 2, dx + T - 6, dy + T - 1], fill=(20, 10, 10))   # door: 22x30 at the door tile
        nw = o.get('windows', 2); nw = len(nw) if isinstance(nw, list) else nw
        # windows spread over the wall, away from the door
        slots = [x0 + int((i + 0.5) * w / nw) for i in range(nw)] if nw else []
        for sx in slots:
            if abs(sx - (dx + 16)) < 26: sx += 40 if sx >= dx + 16 else -40
            wy = y0 + h - wall + (wall - T) // 2 + 4 if wall > T else y0 + h - wall + 4
            g.rectangle([sx - 7, wy, sx + 7, wy + 12], fill=(255, 220, 120), outline=(40, 30, 30))
        blds.append(dict(id=o['id'], x=o['x'], y=o['y'], w=o['w'], h=o['h'], wall=o.get('wall', 2), door=[o['door']['x'], o['door']['y']], roof=o.get('roof'), mat=o.get('mat')))
# fences (solid)
for o in d['objects']:
    if o['type'] == 'prop' and o['id'] == 'fence':
        x, y = o['x'] * T, o['y'] * T
        g.rectangle([x, y + 12, x + T - 1, y + 20], fill=(110, 70, 40))
        g.rectangle([x + 13, y + 4, x + 19, y + 28], fill=(80, 50, 28))
im.save('guide_1x.png')
im.resize((W * T * 2, H * T * 2), Image.NEAREST).save('guide_2x.png')
json.dump(blds, open('blds.json', 'w'), indent=1)
print(blds)
