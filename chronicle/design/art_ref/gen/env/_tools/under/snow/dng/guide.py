"""Layout guide for a painted SNOW dungeon underlay, from <map>/layout_data.json (fullmap.js).
Adapted from ../../dungeon/guide.py (the demo-dungeon pilot) with the snow materials.
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
for p in d['tilePatches']:
    if p.get('rows') and p.get('rect'):
        px, py = p['rect'][:2]
        for dy, r in enumerate(p['rows']):
            for dx, ch in enumerate(r):
                if ch != ' ' and 0 <= py + dy < H and 0 <= px + dx < W: rows[py + dy][px + dx] = ch
    elif p.get('ch') is not None: rows[p['y']][p['x']] = p['ch']
OUT = {'mat': d['outside'], 'solid': d['outside'] in ('wall_snow', 'wall_wood')}


def ent(x, y):
    if 0 <= x < W and 0 <= y < H:
        e = L.get(rows[y][x], OUT)
        if e.get('secret'): return {'mat': e.get('floor') or 'snow'}
        return e
    return OUT


def raised(x, y):
    e = ent(x, y); m = MI.get(e['mat'], {})
    return bool(m.get('face') and (e.get('solid') or e.get('rise')) and e.get('rise', 1) != 0)


def rise(x, y): return max(1, ent(x, y).get('rise') or 1)


face = {}
for y in range(H):
    for x in range(W):
        if raised(x, y) or not raised(x, y - 1): continue
        r = rise(x, y - 1)
        for j in range(1, r + 1):
            if y - j < 0 or not raised(x, y - j): break
            face[(x, y - j)] = (j, r)

WALLTOP = {'wall_snow': (74, 80, 100), 'wall_wood': (70, 46, 30)}
FACE = {'snow_cliff': (150, 176, 214), 'wood': (140, 92, 58)}
FLOOR = {'snow': (238, 240, 246), 'snow_path': (204, 186, 150), 'ice': (156, 210, 236), 'water': (40, 110, 190), 'cobble': (150, 146, 140),
         'plank': (176, 122, 72), 'wood_floor': (176, 122, 72), 'carpet': (150, 36, 44), 'tree': (238, 240, 246), 'road': (196, 164, 112), 'dirt': (150, 102, 62)}


def draw(T):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
    R = lambda x, y: [x * T, y * T, (x + 1) * T - 1, (y + 1) * T - 1]
    lw = max(1, T // 24); rnd = random.Random(7)
    for y in range(H):
        for x in range(W):
            e = ent(x, y); m = e['mat']
            if (x, y) in face:
                j, r = face[(x, y)]
                st = MI.get(m, {}).get('face') or 'snow_cliff'
                c = FACE.get(st, (150, 130, 110))
                g.rectangle(R(x, y), fill=tuple(int(v * (1.1 - 0.3 * (j - 1) / max(1, r))) for v in c))
                if st == 'wood':
                    for q in range(0, T, T // 3): g.line([x * T, y * T + q, x * T + T, y * T + q], fill=(96, 62, 38), width=lw)
                else:
                    for q in range(3, T, max(3, T // 6)): g.line([x * T + q, y * T, x * T + q + rnd.randint(-2, 2), y * T + T], fill=tuple(int(v * 0.75) for v in c), width=lw)
                if j == r or (x, y - 1) not in face:
                    g.rectangle([x * T, y * T, x * T + T - 1, y * T + max(2, T // 8)], fill=(250, 252, 255) if st == 'snow_cliff' else tuple(min(255, int(v * 1.35)) for v in c))
            elif m in WALLTOP and e.get('solid'):
                g.rectangle(R(x, y), fill=WALLTOP[m])
            else:
                g.rectangle(R(x, y), fill=FLOOR.get(m, (255, 0, 255)))
    for y in range(H):
        for x in range(W):
            if (x, y) in face: continue
            e = ent(x, y); m = e['mat']; cx, cy = x * T + T // 2, y * T + T // 2
            if m in ('plank', 'wood_floor') and not e.get('solid'):
                for q in range(0, T, T // 3): g.line([x * T, y * T + q, x * T + T, y * T + q], fill=(130, 88, 50), width=lw)
            elif m == 'cobble':
                if (x + y) % 2 == 0: g.rectangle([x * T + T // 6, y * T + T // 6, x * T + T - T // 6, y * T + T - T // 6], outline=(116, 112, 108), width=lw)
            elif m == 'ice' and not e.get('solid'):
                if (x * 5 + y * 3) % 4 == 0: g.line([x * T + T // 5, y * T + T // 3, x * T + T * 4 // 5, y * T + T * 2 // 3], fill=(230, 246, 255), width=lw)
            elif m == 'ice' and e.get('solid'):
                g.rectangle(R(x, y), fill=(120, 190, 230)); g.polygon([(cx, y * T + 2), (x * T + T - 3, y * T + T - 2), (x * T + 3, y * T + T - 2)], fill=(200, 240, 255), outline=(60, 120, 170))
            elif m == 'water':
                g.ellipse([x * T + T // 4, y * T + T // 4, x * T + T // 2, y * T + T // 2], outline=(230, 250, 255), width=lw)
            elif m == 'snow_path' and (x * 7 + y * 3) % 5 == 0:
                g.ellipse([x * T + T // 3, y * T + T // 3, x * T + T // 2, y * T + T // 2], fill=(170, 150, 120))
            elif m == 'tree':
                g.polygon([(cx, y * T - T // 3), (x * T + T - 2, y * T + T - T // 5), (x * T + 2, y * T + T - T // 5)], fill=(40, 96, 70), outline=(14, 40, 28))
                g.rectangle([cx - T // 12, y * T + T - T // 5, cx + T // 12, y * T + T - 2], fill=(90, 60, 40))
    return im


im = draw(T); im.save(md + '/guide_%d.png' % T)
draw(32).save(md + '/guide_1x.png')
json.dump({'rows': [''.join(r) for r in rows], 'face': [[x, y, j, r] for (x, y), (j, r) in face.items()]}, open(md + '/open.json', 'w'))
print(md, im.size)
