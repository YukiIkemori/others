"""Layout guide for the painted Pharos underlay (cliff port), drawn from the map dump.
usage: python3 guide.py [T]   -> guide_<T>.png (default T=48 = generation scale) and guide_1x.png (T=32), blds.json"""
import json, sys
from PIL import Image, ImageDraw
d = json.load(open('layout_data.json'))
W, H = d['w'], d['h']; rows = d['rows']
KIND = {'ph_inn': 'cave', 'ph_record': 'cave', 'ph_house1': 'cave', 'ph_smith': 'cave', 'ph_house2': 'cave', 'ph_house3': 'cave',
        'ph_house5': 'cave', 'ph_house6': 'cave', 'ph_tavern': 'hull', 'ph_shop': 'hull', 'ph_house4': 'hull', 'ph_shipyard': 'yard'}
COL = {'k': (196, 184, 160), 'c': (140, 140, 150), 'g': (90, 140, 70), 'e': (230, 230, 232), 'p': (168, 116, 66), 'b': (214, 176, 112),
       '~': (40, 92, 170)}
FACE, TOP, CREST = (128, 92, 68), (84, 76, 72), (80, 128, 64)


def at(x, y):
    return rows[y][x] if 0 <= x < W and 0 <= y < H else '~'


def draw(T):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
    R = lambda x, y, w=1, h=1: [x * T, y * T, (x + w) * T - 1, (y + h) * T - 1]
    for y in range(H):
        for x in range(W):
            ch = at(x, y)
            if ch != '#':
                g.rectangle(R(x, y), fill=COL[ch]); continue
            # rock: face = the lowest rows of a rock mass (seen from the front), top = rock seen from above
            n = 0
            while at(x, y + n + 1) == '#': n += 1
            north = x < 42 and y < 9
            face_rows = 6 if north else (5 if (44 <= x <= 55 and y < 8) else 2)
            if north and y <= 2: g.rectangle(R(x, y), fill=CREST)
            elif n < face_rows and at(x, y + n + 1) != '~' or (n < 2):
                g.rectangle(R(x, y), fill=FACE)
                for k in range(1, 4): g.line([x * T, y * T + k * T // 4, x * T + T - 1, y * T + k * T // 4], fill=(104, 74, 54), width=max(1, T // 24))
            else:
                g.rectangle(R(x, y), fill=TOP)
    # pier planks, bridge ropes, stairs
    for y in range(H):
        for x in range(W):
            ch = at(x, y)
            if ch == 'p':
                for k in range(0, T, T // 4): g.line([x * T + k, y * T, x * T + k, y * T + T - 1], fill=(120, 80, 44), width=max(1, T // 24))
            if ch == 'b':
                hx = 1; i = x - 1
                while at(i, y) == 'b': hx += 1; i -= 1
                i = x + 1
                while at(i, y) == 'b': hx += 1; i += 1
                vy = 1; j = y - 1
                while at(x, j) == 'b': vy += 1; j -= 1
                j = y + 1
                while at(x, j) == 'b': vy += 1; j += 1
                horiz = hx >= vy
                for k in range(0, T, T // 4):
                    if horiz: g.line([x * T + k, y * T, x * T + k, y * T + T - 1], fill=(150, 110, 60), width=max(1, T // 16))
                    else: g.line([x * T, y * T + k, x * T + T - 1, y * T + k], fill=(150, 110, 60), width=max(1, T // 16))
                # rope rails on the outer sides
                if horiz:
                    if at(x, y - 1) != 'b': g.line([x * T, y * T + 2, x * T + T, y * T + 2], fill=(60, 40, 20), width=max(2, T // 10))
                    if at(x, y + 1) != 'b': g.line([x * T, y * T + T - 3, x * T + T, y * T + T - 3], fill=(60, 40, 20), width=max(2, T // 10))
                else:
                    if at(x - 1, y) != 'b': g.line([x * T + 2, y * T, x * T + 2, y * T + T], fill=(60, 40, 20), width=max(2, T // 10))
                    if at(x + 1, y) != 'b': g.line([x * T + T - 3, y * T, x * T + T - 3, y * T + T], fill=(60, 40, 20), width=max(2, T // 10))
            if ch == 'e':
                for k in range(4): g.rectangle([x * T, y * T + k * T // 4, x * T + T - 1, y * T + k * T // 4 + T // 6], fill=(170, 165, 160))
            if ch == 'c' and (x + y) % 2 == 0:
                g.ellipse([x * T + T // 4, y * T + T // 4, x * T + 3 * T // 4, y * T + 3 * T // 4], outline=(120, 120, 130))
    # lighthouse on the far islet (SE)
    lx, ly = 59 * T, 38 * T
    g.rectangle([lx - T // 2, ly + T // 2, lx + T + T // 2, ly + 6 * T], fill=(236, 232, 220), outline=(40, 30, 30))
    for k in range(3): g.rectangle([lx - T // 2, ly + (2 + 2 * k) * T - T // 3, lx + T + T // 2, ly + (2 + 2 * k) * T], fill=(190, 50, 40))
    g.rectangle([lx - T // 4, ly - T // 2, lx + T + T // 4, ly + T // 2], fill=(255, 230, 140), outline=(40, 30, 30))
    g.polygon([(lx - T // 2, ly - T // 2), (lx + T // 2, ly - T * 3 // 2), (lx + T + T // 2, ly - T // 2)], fill=(60, 60, 70))
    blds = []
    for o in d['objects']:
        if o['type'] != 'building': continue
        kind = KIND[o['id']]
        x0, y0, w, h = o['x'] * T, o['y'] * T, o['w'] * T, o['h'] * T
        wall = o.get('wall', 2) * T
        if kind == 'cave':
            # carved facade: dressed-stone front cut into the cliff, arched top, the rock above is cliff
            g.rectangle([x0 + T // 6, y0 + h - wall, x0 + w - 1 - T // 6, y0 + h - 1], fill=(222, 200, 158), outline=(50, 34, 26), width=max(1, T // 16))
            g.pieslice([x0 + T // 6, y0 + h - wall - T, x0 + w - 1 - T // 6, y0 + h - wall + T], 180, 360, fill=(222, 200, 158), outline=(50, 34, 26), width=max(1, T // 16))
        elif kind == 'hull':
            # upturned boat hull: tarred planked keel side seen from above + planked stern wall with the door
            g.ellipse([x0, y0, x0 + w - 1, y0 + (h - wall) + T // 2], fill=(92, 58, 40), outline=(30, 18, 12), width=max(1, T // 12))
            g.line([x0 + T // 2, y0 + (h - wall) // 2 + T // 4, x0 + w - T // 2, y0 + (h - wall) // 2 + T // 4], fill=(40, 24, 16), width=max(2, T // 8))
            g.rectangle([x0 + T // 4, y0 + h - wall, x0 + w - 1 - T // 4, y0 + h - 1], fill=(170, 110, 64), outline=(40, 24, 16), width=max(1, T // 16))
        else:
            # shipyard: steep sailcloth A-frame boat shed on stilts
            g.polygon([(x0, y0 + h - wall), (x0 + w // 2, y0), (x0 + w - 1, y0 + h - wall)], fill=(200, 188, 150), outline=(40, 30, 24))
            g.line([x0 + w // 2, y0, x0 + w // 2, y0 + h - wall], fill=(120, 100, 70), width=max(1, T // 12))
            g.rectangle([x0, y0 + h - wall, x0 + w - 1, y0 + h - 1], fill=(140, 96, 60), outline=(40, 24, 16), width=max(1, T // 16))
        dx, dy = o['door']['x'] * T, o['door']['y'] * T
        g.rectangle([dx + T * 5 // 32, dy + T // 16, dx + T - 1 - T * 5 // 32, dy + T - 1], fill=(20, 10, 10))
        nw = o.get('windows', 2); nw = len(nw) if isinstance(nw, list) else nw
        slots = [x0 + int((i + 0.5) * w / nw) for i in range(nw)] if nw else []
        for sx in slots:
            if abs(sx - (dx + T // 2)) < T * 0.85: sx += int(T * 1.25) if sx >= dx + T // 2 else -int(T * 1.25)
            if sx < x0 + T // 3 or sx > x0 + w - T // 3: continue
            wy = y0 + h - wall + (wall - T) // 2 + T // 8 if wall > T else y0 + h - wall + T // 8
            g.rectangle([sx - T * 7 // 32, wy, sx + T * 7 // 32, wy + T * 12 // 32], fill=(255, 220, 120), outline=(40, 30, 30))
        blds.append(dict(id=o['id'], kind=kind, x=o['x'], y=o['y'], w=o['w'], h=o['h'], wall=o.get('wall', 2), door=[o['door']['x'], o['door']['y']]))
    return im, blds


T = int(sys.argv[1]) if len(sys.argv) > 1 else 48
im, blds = draw(T); im.save('guide_%d.png' % T)
im1, _ = draw(32); im1.save('guide_1x.png')
json.dump(blds, open('blds.json', 'w'), indent=1)
print(len(blds), 'buildings', im.size)
