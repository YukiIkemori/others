"""(desert copy of ../dungeon/guide.py: sandstone walls, desert floors) Layout guide for a painted DUNGEON underlay (generic), from <map>/layout_data.json (fullmap.js).
The guide shows the OPEN state: every tilePatch applied, every secret cell as its floor (the closed look is a separate layer, see live.py).
Wall faces: a solid cell whose material has a face and rise r shows its vertical face on the r wall cells above a lower cell (same rule as rise.js).
usage: python3 guide.py <mapdir> <T>   -> <mapdir>/guide_<T>.png, guide_1x.png, open.json"""
import json, sys, math, random
from PIL import Image, ImageDraw

md, T = sys.argv[1], int(sys.argv[2])
d = json.load(open(md + '/layout_data.json'))
W, H = d['w'], d['h']
L, MI = d['legend'], d['mats']
rows = [list(r) for r in d['rows']]
# ---- open state: apply every tilePatch, secrets -> floor
for p in d['tilePatches']:
    if p.get('rows') and p.get('rect'):
        px, py = p['rect'][:2]
        for dy, r in enumerate(p['rows']):
            for dx, ch in enumerate(r):
                if ch != ' ' and 0 <= py + dy < H and 0 <= px + dx < W: rows[py + dy][px + dx] = ch
    elif p.get('ch') is not None: rows[p['y']][p['x']] = p['ch']
OUT = {'mat': d['outside'], 'solid': True}


def ent(x, y):
    if 0 <= x < W and 0 <= y < H:
        e = L.get(rows[y][x], OUT)
        if e.get('secret'): return {'mat': e.get('floor') or 'cave_floor'}
        return e
    return OUT


def raised(x, y):
    e = ent(x, y); m = MI.get(e['mat'], {})
    return bool(m.get('face') and (e.get('solid') or e.get('rise')) and e.get('rise', 1) != 0)


def rise(x, y): return max(1, ent(x, y).get('rise') or 1)


# face cells: (x, y) -> (j of rise, rise)   j = 1 bottom row of the face
face = {}
for y in range(H):
    for x in range(W):
        if y >= H or raised(x, y): continue
        if not raised(x, y - 1): continue
        r = rise(x, y - 1)
        for j in range(1, r + 1):
            if y - j < 0 or not raised(x, y - j): break
            face[(x, y - j)] = (j, r)

# colours
WALLTOP = {'wall_cave': (58, 48, 66), 'wall_stone': (52, 56, 70), 'wall_bark': (66, 42, 28), 'rock': (96, 96, 90), 'wall_sandstone': (74, 54, 40)}
if d['id'].startswith('desert_hawks'): WALLTOP['rock'] = (62, 50, 56)
FACE = {'cave': (128, 104, 92), 'stone': (160, 160, 164), 'bark': (140, 92, 58), 'rock': (140, 136, 124), 'sandstone': (178, 132, 84)}
if d['id'].startswith('desert_hawks') or d['id'] == 'desert_rocks': FACE['rock'] = (150, 104, 74)
FLOOR = {'cave_floor': (112, 112, 132), 'moss_earth': (78, 124, 62), 'flowers': (96, 150, 80), 'water': (40, 110, 190), 'sea': (22, 64, 140),
         'wood_floor': (176, 122, 72), 'carpet': (170, 40, 44), 'grass': (100, 160, 70), 'bark_floor': (184, 126, 76), 'root_floor': (132, 112, 84),
         'roots': (86, 56, 36), 'forest_dark': (22, 66, 40), 'tree': (40, 110, 50), 'bush': (70, 140, 60), 'tall_grass': (80, 146, 64),
         'road': (196, 164, 112), 'dirt': (150, 102, 62), 'shallow': (110, 180, 214),
         'sandstone_floor': (214, 196, 150), 'sand': (238, 204, 132), 'cracked_clay': (176, 100, 62), 'dune_sand': (236, 170, 96), 'cobble': (180, 176, 168)}
if d['id'] == 'desert_hawks_2': FLOOR['sandstone_floor'] = (206, 202, 190)


def draw(T):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
    R = lambda x, y: [x * T, y * T, (x + 1) * T - 1, (y + 1) * T - 1]
    lw = max(1, T // 24); rnd = random.Random(7)
    for y in range(H):
        for x in range(W):
            e = ent(x, y); m = e['mat']
            if (x, y) in face:
                j, r = face[(x, y)]
                st = MI.get(m, {}).get('face') or 'rock'
                c = FACE.get(st, (150, 130, 110)); k = 0.8 + 0.2 * (r - j) / max(1, r)   # lighter at the top lip
                g.rectangle(R(x, y), fill=tuple(int(v * (1.25 - 0.35 * (j - 1) / max(1, r))) for v in c))
                if st == 'stone':
                    for q in range(0, T, T // 3): g.line([x * T, y * T + q, x * T + T, y * T + q], fill=(110, 110, 116), width=lw)
                    for q in range(0, T, T // 2): g.line([x * T + q + (T // 4 if (y * 3) % 2 else 0), y * T, x * T + q + (T // 4 if (y * 3) % 2 else 0), y * T + T], fill=(110, 110, 116), width=lw)
                else:
                    for q in range(3, T, max(3, T // 6)): g.line([x * T + q, y * T, x * T + q + rnd.randint(-2, 2), y * T + T], fill=tuple(int(v * 0.72) for v in c), width=lw)
                if j == r or (x, y - 1) not in face:   # the lit lip where the face meets the top
                    g.rectangle([x * T, y * T, x * T + T - 1, y * T + max(2, T // 10)], fill=tuple(min(255, int(v * 1.35)) for v in c))
            elif m in WALLTOP and (e.get('solid')):
                g.rectangle(R(x, y), fill=WALLTOP[m])
            else:
                g.rectangle(R(x, y), fill=FLOOR.get(m, (255, 0, 255)))
    # textures / symbols on top
    for y in range(H):
        for x in range(W):
            if (x, y) in face: continue
            m = ent(x, y)['mat']; cx, cy = x * T + T // 2, y * T + T // 2
            if m == 'sandstone_floor' and not ent(x, y).get('solid'):
                g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(186, 168, 126), width=lw)
            elif m == 'sand':
                for _ in range(3): px, py = x * T + rnd.randint(3, T - 4), y * T + rnd.randint(3, T - 4); g.point((px, py), fill=(200, 160, 96))
            elif m == 'dune_sand':
                for k in range(2):
                    yy = y * T + (k + 0.5) * T / 2
                    g.line([(x * T + i, yy + math.sin((x * T + i) / (T * 0.9) + y) * T / 10) for i in range(0, T + 1, max(2, T // 8))], fill=(210, 140, 76), width=lw)
            elif m == 'cracked_clay':
                g.line([x * T + T // 4, y * T + T // 3, x * T + T * 3 // 4, y * T + T // 2], fill=(140, 76, 48), width=lw)
            elif m == 'carpet':
                g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(214, 170, 60), width=lw)
            elif m == 'wood_floor':
                for q in range(0, T, T // 3): g.line([x * T, y * T + q, x * T + T, y * T + q], fill=(130, 88, 50), width=lw)
            elif m == 'flowers':
                for _ in range(3):
                    px, py = x * T + rnd.randint(3, T - 4), y * T + rnd.randint(3, T - 4); g.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(236, 150, 190))
            elif m in ('forest_dark', 'tree'):
                r = int(T * (0.7 if m == 'forest_dark' else 0.6))
                g.ellipse([cx - r + rnd.randint(-2, 2), cy - r + rnd.randint(-2, 2), cx + r, cy + r], fill=(30, 84, 46) if m == 'forest_dark' else (52, 130, 60), outline=(12, 40, 20), width=lw)
            elif m == 'bush':
                r = int(T * 0.45); g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(84, 156, 66), outline=(30, 70, 30), width=lw)
            elif m == 'roots':
                for k in range(4):
                    a = rnd.random() * math.pi
                    g.line([cx - math.cos(a) * T * 0.5, cy - math.sin(a) * T * 0.5, cx + math.cos(a) * T * 0.5, cy + math.sin(a) * T * 0.5], fill=(60, 36, 20), width=lw * 3)
            elif m == 'rock' and ent(x, y).get('solid') and d['id'] == 'desert_rocks':
                r = int(T * 0.45); g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(120, 118, 110), outline=(50, 48, 44), width=lw)
            elif m == 'root_floor':
                g.line([x * T, cy + rnd.randint(-T // 4, T // 4), x * T + T, cy + rnd.randint(-T // 4, T // 4)], fill=(100, 80, 58), width=lw * 2)
            elif m == 'tall_grass':
                for q in range(4, T, T // 4): g.line([x * T + q, y * T + T - 3, x * T + q + 2, y * T + T // 2], fill=(50, 110, 44), width=lw)
    # buildings (painted: the engine does not draw buildings on a painted map) and marked doors (door props are drawn over the painting)
    for o in d['objects']:
        if o.get('type') == 'building':
            x0, y0, w, h, wall = o['x'] * T, o['y'] * T, o['w'] * T, o['h'] * T, o.get('wall', 2) * T
            g.rectangle([x0, y0, x0 + w - 1, y0 + h - wall - 1 + T // 3], fill=(92, 120, 60), outline=(40, 30, 20), width=lw * 2)   # mossy roof
            g.rectangle([x0, y0 + h - wall, x0 + w - 1, y0 + h - 1], fill=(120, 80, 48), outline=(40, 30, 20), width=lw * 2)       # log front wall
            for q in range(1, 4): g.line([x0, y0 + h - wall + q * wall // 4, x0 + w, y0 + h - wall + q * wall // 4], fill=(80, 52, 30), width=lw)
        elif o.get('type') == 'door' and o.get('look') != 'none':
            dw = o.get('w', 1)
            g.rectangle([o['x'] * T + T // 8, o['y'] * T - T // 3, (o['x'] + dw) * T - 1 - T // 8, (o['y'] + 1) * T - 1], fill=(20, 10, 10))
    return im


im = draw(T); im.save(md + '/guide_%d.png' % T)
draw(32).save(md + '/guide_1x.png')
json.dump({'rows': [''.join(r) for r in rows], 'face': [[x, y, j, r] for (x, y), (j, r) in face.items()]}, open(md + '/open.json', 'w'))
print(md, im.size)
