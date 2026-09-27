"""Layout guide for the painted Kasim underlay (desert oasis town at the feet of a colossal nameless-king statue), from the map dump.
usage: python3 guide.py [T]   -> guide_<T>.png (default T=48 = generation scale), guide_1x.png (T=32), blds.json"""
import json, sys, math, random
from PIL import Image, ImageDraw
d = json.load(open('layout_data.json'))
W, H = d['w'], d['h']; rows = d['rows']
KIND = {'kasim_b_shop': 'plinth', 'kasim_b_fortune': 'plinth', 'kasim_b_mapshop': 'plinth', 'kasim_b_inn': 'inn', 'kasim_b_tavern': 'jar',
        'kasim_b_digger': 'dome', 'kasim_b_guild': 'ribs', 'kasim_b_abul': 'rock', 'kasim_s_cistern': 'cistern', 'kasim_s_dove': 'dove',
        'kasim_s_granary': 'granary', 'kasim_s_wind': 'wind'}
COL = {'s': (226, 196, 140), 'k': (170, 98, 62), 'Q': (206, 202, 190), 'c': (206, 202, 190), 'w': (40, 110, 190), 'g': (110, 150, 70),
       'D': (236, 160, 84), 'P': (226, 196, 140), 'X': (150, 118, 84), 'x': (190, 170, 140), 'u': (236, 160, 84), '_': (80, 150, 200)}


def at(x, y):
    return rows[y][x] if 0 <= x < W and 0 <= y < H else 'D'


def draw(T):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
    R = lambda x, y, w=1, h=1: [x * T, y * T, (x + w) * T - 1, (y + h) * T - 1]
    lw = max(1, T // 24)
    for y in range(H):
        for x in range(W):
            g.rectangle(R(x, y), fill=COL.get(at(x, y), (255, 0, 255)))
    # dunes: wavy contour lines (tall rolling dunes, not walkable)
    for y in range(H):
        for x in range(W):
            if at(x, y) == 'D':
                for k in range(3):
                    yy = y * T + (k + 0.5) * T / 3
                    pts = [(x * T + i, yy + math.sin((x * T + i) / (T * 0.9) + y) * T / 10) for i in range(0, T + 1, max(2, T // 8))]
                    g.line(pts, fill=(206, 128, 64), width=lw)
    # paving: slab joints; clay lanes: cracks
    for y in range(H):
        for x in range(W):
            c = at(x, y)
            if c == 'Q':
                g.rectangle(R(x, y), outline=(170, 164, 150), width=lw)
            elif c == 'k':
                g.line([x * T + T // 4, y * T + T // 3, x * T + T * 3 // 4, y * T + T // 2], fill=(140, 76, 48), width=lw)
    # palm groves: crowns
    rnd = random.Random(3)
    for y in range(H):
        for x in range(W):
            if at(x, y) == 'P':
                cx, cy = x * T + T // 2 + rnd.randint(-T // 8, T // 8), y * T + T // 2 + rnd.randint(-T // 8, T // 8)
                r = int(T * 0.62)
                g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(56, 120, 60), outline=(24, 60, 30), width=lw)
                for k in range(6):
                    a = k * math.pi / 3 + 0.3
                    g.line([cx, cy, cx + math.cos(a) * r, cy + math.sin(a) * r], fill=(30, 84, 40), width=lw)
    # the colossus: sandstone mass; featureless worn face oval, striped head-cloth, shoulders; plinth top band
    g.ellipse([(31 - 3.2) * T, 1.3 * T, (32 + 3.2) * T, 8.3 * T], fill=(214, 184, 140), outline=(90, 60, 40), width=lw * 2)   # the worn, blank face
    for k in range(7):   # head-cloth stripes on both sides of the face
        yk = (3.4 + k) * T
        g.line([26.2 * T, yk, 28 * T, yk + T * 0.3], fill=(110, 80, 58), width=lw * 2)
        g.line([35 * T, yk + T * 0.3, 36.8 * T, yk], fill=(110, 80, 58), width=lw * 2)
    g.rectangle([21 * T, 13 * T, 42 * T - 1, 14 * T - 1], fill=(176, 146, 108), outline=(90, 60, 40), width=lw)   # plinth top ledge
    # stone hand: rim pale stone, fingers; the palm hollow (cracked dry clay) with the last puddle
    for y in range(H):
        for x in range(W):
            if at(x, y) == 'x':
                g.rectangle(R(x, y), fill=(200, 184, 156), outline=(120, 100, 80), width=lw)
    blds = []
    for o in d['objects']:
        if o['type'] != 'building': continue
        kind = KIND[o['id']]
        x0, y0, w, h = o['x'] * T, o['y'] * T, o['w'] * T, o['h'] * T
        wall = o.get('wall', 2) * T
        top = (y0, y0 + h - wall)            # roof band (seen from above)
        fr = [x0, y0 + h - wall, x0 + w - 1, y0 + h - 1]   # front wall band
        OUT = (50, 30, 20)
        if kind == 'plinth':
            g.rectangle(fr, fill=(196, 160, 112), outline=OUT, width=lw * 2)   # carved sandstone front of the plinth
        elif kind == 'inn':
            for cx, cy, r in ((x0 + w * 0.2, y0 + T * 1.6, T * 1.4), (x0 + w * 0.5, y0 + T * 1.2, T * 1.7), (x0 + w * 0.8, y0 + T * 1.7, T * 1.3)):
                g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(232, 220, 196), outline=OUT, width=lw)
            g.rectangle([x0 + w * 0.62, y0 - T * 0.2, x0 + w * 0.62 + T * 1.4, y0 + T * 2.6], fill=(214, 170, 120), outline=OUT, width=lw)   # wind tower
            g.regular_polygon((x0 + w * 0.62 + T * 0.7, y0 + T * 0.5, T * 0.45), 5, fill=(255, 230, 120), outline=OUT)   # star lantern
            g.rounded_rectangle(fr, T // 2, fill=(222, 196, 156), outline=OUT, width=lw * 2)
        elif kind == 'jar':
            g.ellipse([x0, y0 + T * 0.2, x0 + w - 1, y0 + h - 1], fill=(188, 98, 60), outline=OUT, width=lw * 2)   # toppled clay jar body
            g.rectangle([x0 + w - T * 1.2, y0 + h * 0.3, x0 + w - 1, y0 + h * 0.62], fill=(160, 80, 50), outline=OUT, width=lw)   # its neck and mouth (east)
            g.rectangle([x0 + T, fr[1], x0 + w - T * 2, fr[3]], fill=(200, 110, 70), outline=OUT, width=lw)
        elif kind == 'dome':
            g.ellipse([x0 + T * 0.3, y0, x0 + w - 1 - T * 0.3, y0 + (h - wall) * 2], fill=(232, 216, 186), outline=OUT, width=lw)
            g.rounded_rectangle([x0 + T * 0.3, fr[1], x0 + w - 1 - T * 0.3, fr[3]], T // 2, fill=(220, 196, 156), outline=OUT, width=lw * 2)
            wx, wy, wr = x0 + w - T * 0.2, y0 + T * 1.2, T * 1.3   # wooden water-lifting wheel against the east side
            g.ellipse([wx - wr, wy - wr, wx + wr, wy + wr], outline=(110, 70, 36), width=lw * 3)
            for k in range(8):
                a = k * math.pi / 4; g.line([wx, wy, wx + math.cos(a) * wr, wy + math.sin(a) * wr], fill=(110, 70, 36), width=lw)
        elif kind == 'ribs':
            g.rounded_rectangle([x0, y0, x0 + w - 1, y0 + h - wall + T // 2], T, fill=(60, 70, 150), outline=OUT, width=lw * 2)   # indigo and madder cloth
            for i in range(1, 7):
                xx = x0 + i * w / 7
                g.arc([xx - T * 0.8, y0 - T * 0.2, xx + T * 0.8, y0 + (h - wall) + T * 0.4], 200, 340, fill=(240, 232, 214), width=lw * 4)   # rib bones
            g.line([x0 + T // 2, y0 + T * 0.4, x0 + w - T // 2, y0 + T * 0.4], fill=(240, 232, 214), width=lw * 5)   # spine
            g.rectangle(fr, fill=(170, 60, 50), outline=OUT, width=lw * 2)
        elif kind == 'rock':
            g.polygon([(x0 + T * 0.2, y0 + h - wall), (x0 + T * 0.8, y0 + T * 0.4), (x0 + w * 0.5, y0), (x0 + w - T * 0.6, y0 + T * 0.5), (x0 + w - 1, y0 + h - wall)], fill=(176, 130, 90), outline=OUT)
            g.rectangle(fr, fill=(196, 150, 104), outline=OUT, width=lw * 2)
        elif kind in ('cistern', 'granary'):
            n = 1 if kind == 'cistern' else 3
            for i in range(n):
                cx = x0 + w * (i + 0.5) / n; r = w / n / 2 * 0.95
                g.ellipse([cx - r, y0, cx + r, y0 + h - wall + r * 0.4], fill=(232, 220, 196), outline=OUT, width=lw)
            g.rounded_rectangle(fr, T // 3, fill=(214, 192, 152), outline=OUT, width=lw * 2)
        elif kind == 'dove':
            g.ellipse([x0, y0, x0 + w - 1, y0 + h - wall + T // 2], fill=(222, 206, 176), outline=OUT, width=lw)
            for i in range(3):
                for j in range(2):
                    g.ellipse([x0 + T * (0.6 + i * 0.7), y0 + h - wall + T * (0.3 + j * 0.7), x0 + T * (0.9 + i * 0.7), y0 + h - wall + T * (0.6 + j * 0.7)], fill=(60, 40, 30))
            g.rectangle(fr, outline=OUT, width=lw * 2)
        elif kind == 'wind':
            g.rectangle([x0, y0, x0 + w - 1, y0 + h - wall], fill=(214, 170, 120), outline=OUT, width=lw)
            for i in range(3): g.rectangle([x0 + T * (0.3 + i * 0.9), y0 + T * 0.2, x0 + T * (0.6 + i * 0.9), y0 + T * 0.9], fill=(60, 40, 30))
            g.rectangle(fr, fill=(206, 166, 118), outline=OUT, width=lw * 2)
        door = o.get('door')
        if door:
            dx, dy = door['x'] * T, door['y'] * T
            g.rectangle([dx + T * 5 // 32, dy + T // 16, dx + T - 1 - T * 5 // 32, dy + T - 1], fill=(20, 10, 10))
        nw = o.get('windows', 0)
        if nw and door:
            dcx = door['x'] * T + T // 2
            cand = [x0 + int((i + 0.5) * w / (nw + 1)) for i in range(nw + 1)]
            slots = sorted(cand, key=lambda sx: -abs(sx - dcx))[:nw]
            for sx in slots:
                if abs(sx - dcx) < T * 0.85: sx += int(T * 1.25) if sx >= dcx else -int(T * 1.25)
                if sx < x0 + T // 3 or sx > x0 + w - T // 3: continue
                wy = fr[1] + (wall - T) // 2 + T // 8 if wall > T else fr[1] + T // 8
                g.rectangle([sx - T * 7 // 32, wy, sx + T * 7 // 32, wy + T * 12 // 32], fill=(255, 220, 120), outline=(40, 30, 30))
        blds.append(dict(id=o['id'], kind=kind, x=o['x'], y=o['y'], w=o['w'], h=o['h'], wall=o.get('wall', 2), door=[door['x'], door['y']] if door else None))
    return im, blds


T = int(sys.argv[1]) if len(sys.argv) > 1 else 48
im, blds = draw(T); im.save('guide_%d.png' % T)
im1, _ = draw(32); im1.save('guide_1x.png')
json.dump(blds, open('blds.json', 'w'), indent=1)
print(len(blds), 'buildings', im.size)
