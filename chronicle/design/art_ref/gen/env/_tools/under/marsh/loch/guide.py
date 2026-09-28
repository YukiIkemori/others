"""Layout guide for the painted Loch underlay (lake town on stilts, the great fallen bell). usage: python3 guide.py [T] -> guide_<T>.png, guide_1x.png, blds.json"""
import json, sys, math, random
from PIL import Image, ImageDraw
d = json.load(open('layout_data.json'))
W, H = d['w'], d['h']; rows = d['rows']
KIND = {'loch_bell_items': 'bell', 'loch_bell_tavern': 'bell', 'loch_bell_arms': 'bell', 'loch_hall': 'heron', 'loch_tower': 'tower',
        'loch_inn': 'barges', 'loch_mayor': 'willowhouse', 'loch_emma': 'hut', 'loch_beppo': 'leaning', 'loch_klaus': 'stonebox', 'loch_s_netshed': 'shed'}
COL = {'~': (72, 122, 118), '=': (30, 66, 104), 'r': (128, 140, 64), 'p': (168, 116, 66), 'g': (96, 132, 70), 'm': (120, 96, 70),
       'c': (172, 168, 158), 'b': (196, 188, 172), 'T': (96, 132, 70), 'X': (72, 122, 118)}
def at(x, y): return rows[y][x] if 0 <= x < W and 0 <= y < H else 'r'
BELL = lambda x, y: y <= 8 and 18 <= x <= 37
def draw(T):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
    R = lambda x, y, w=1, h=1: [x * T, y * T, (x + w) * T - 1, (y + h) * T - 1]
    lw = max(1, T // 24)
    for y in range(H):
        for x in range(W):
            c = at(x, y)
            g.rectangle(R(x, y), fill=COL.get(c, (255, 0, 255)))
    rnd = random.Random(5)
    for y in range(H):
        for x in range(W):
            c = at(x, y)
            if c == '~' and rnd.random() < 0.25:
                yy = y * T + rnd.randint(T // 4, 3 * T // 4)
                g.line([x * T + T // 5, yy, x * T + 3 * T // 5, yy], fill=(96, 146, 140), width=lw)
            elif c == '=':
                for k in range(2):
                    yy = y * T + (k + 0.5) * T / 2
                    pts = [(x * T + i, yy + math.sin((x * T + i) / (T * 0.7)) * T / 12) for i in range(0, T + 1, max(2, T // 8))]
                    g.line(pts, fill=(52, 96, 140), width=lw)
            elif c == 'r':
                for k in range(4):
                    xx = x * T + (k + 0.5) * T / 4 + rnd.randint(-2, 2)
                    g.line([xx, y * T + T - 2, xx + rnd.randint(-3, 3), y * T + rnd.randint(1, T // 3)], fill=(84, 100, 36), width=lw)
            elif c == 'p':
                horiz = at(x - 1, y) in 'pcb' or at(x + 1, y) in 'pcb'
                vert = at(x, y - 1) in 'pcb' or at(x, y + 1) in 'pcb'
                if horiz and not vert:
                    for k in range(0, T, max(3, T // 5)): g.line([x * T + k, y * T, x * T + k, y * T + T - 1], fill=(120, 80, 44), width=lw)
                else:
                    for k in range(0, T, max(3, T // 5)): g.line([x * T, y * T + k, x * T + T - 1, y * T + k], fill=(120, 80, 44), width=lw)
                # the dark water edge under the boardwalk (posts)
                if at(x, y + 1) in '~=r':
                    g.rectangle([x * T, y * T + T - max(2, T // 10), x * T + T - 1, y * T + T - 1], fill=(70, 46, 30))
            elif c == 'c':
                g.rectangle(R(x, y), outline=(140, 136, 126), width=lw)
            elif c == 'b':
                g.line([x * T, y * T + T // 2, x * T + T - 1, y * T + T // 2], fill=(160, 152, 140), width=lw)
                if at(x - 1, y) not in 'b': g.rectangle([x * T, y * T, x * T + max(3, T // 6), y * T + T - 1], fill=(120, 114, 104))
                if at(x + 1, y) not in 'b': g.rectangle([x * T + T - max(3, T // 6), y * T, x * T + T - 1, y * T + T - 1], fill=(120, 114, 104))
    # willows: big drooping crowns
    for y in range(H):
        for x in range(W):
            if at(x, y) == 'T':
                cx, cy = x * T + T // 2, y * T + T // 2; r = int(T * 0.95)
                g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(70, 110, 60), outline=(30, 56, 30), width=lw)
                for k in range(10):
                    a = k * math.pi / 5
                    g.line([cx, cy, cx + math.cos(a) * r, cy + math.sin(a) * r * 1.1], fill=(110, 150, 80), width=lw)
    # the six small stilt bell towers in the lake (X outside the bell)
    for y in range(H):
        for x in range(W):
            if at(x, y) == 'X' and not BELL(x, y) and at(x - 1, y) != 'X' and at(x, y - 1) != 'X':
                x0, y0 = x * T, y * T
                g.rectangle([x0 + T // 6, y0 + T // 6, x0 + 2 * T - T // 6, y0 + 2 * T - T // 6], fill=(92, 64, 42), outline=(30, 20, 14), width=lw * 2)
                g.polygon([(x0 + T // 6, y0 + T // 6), (x0 + T, y0 - T // 3), (x0 + 2 * T - T // 6, y0 + T // 6)], fill=(60, 70, 86), outline=(24, 24, 30))
                g.ellipse([x0 + T // 2, y0 + T // 2, x0 + 3 * T // 2, y0 + 3 * T // 2], fill=(196, 150, 60) if (x, y) != (51, 44) else (232, 196, 110), outline=(80, 56, 20), width=lw)
    # the great fallen bell body (verdigris), narrowing to the north, crown loop at the top
    pts = []
    for yy in range(1, 9):
        hw = 6.5 + (yy - 1) * 0.35
        pts.append(((27.5 - hw + 0.5) * T, yy * T))
    right = [((27.5 + (6.5 + (yy - 1) * 0.35) + 0.5) * T, yy * T) for yy in range(8, 0, -1)]
    poly = [(20 * T, 1 * T)] + pts + [(18 * T, 8 * T), (38 * T, 8 * T)] + right + [(36 * T, 1 * T)]
    g.polygon(poly, fill=(88, 156, 138), outline=(24, 60, 52))
    for yy in (3, 5, 7):
        hw = 6.5 + (yy - 1) * 0.35
        g.line([((27.5 - hw + 0.8) * T, yy * T), ((28.5 + hw - 0.8) * T, yy * T)], fill=(58, 118, 100), width=lw * 2)   # raised rings on the bell
    g.rectangle([25 * T, 0, 31 * T - 1, 2 * T - 1], fill=(70, 128, 112), outline=(24, 60, 52), width=lw * 2)            # the crown loop
    g.ellipse([26 * T, int(0.2 * T), 30 * T, int(1.8 * T)], outline=(40, 90, 76), width=lw * 3)
    blds = []
    for o in d['blds']:
        k = KIND.get(o['id'], 'hut')
        x0, y0, w, h = o['x'] * T, o['y'] * T, o['w'] * T, o['h'] * T
        wall = (o.get('wall') or 2) * T
        roofb = y0 + h - wall
        if k == 'bell':
            # the rim of the bell's mouth: a thick bronze lip boarded over with planks, doors cut into it
            g.rectangle([x0, y0, x0 + w - 1, roofb], fill=(88, 156, 138), outline=(24, 60, 52), width=lw)
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(150, 104, 58), outline=(40, 26, 16), width=lw)
            g.rectangle([x0, roofb, x0 + w - 1, roofb + T // 3], fill=(176, 132, 64))
            for k2 in range(0, w, max(4, T // 3)): g.line([x0 + k2, roofb + T // 3, x0 + k2, y0 + h - 1], fill=(112, 76, 42), width=lw)
        elif k == 'heron':
            g.polygon([(x0 - T // 3, roofb), (x0 + w // 2, y0 - T // 3), (x0 + w + T // 3, roofb)], fill=(200, 176, 112), outline=(90, 70, 40))
            g.line([x0 + w // 2, y0 - T // 3, x0 + w // 2, roofb], fill=(150, 120, 70), width=lw * 2)
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(104, 72, 46), outline=(40, 26, 16), width=lw)
            for k2 in range(1, o['w']): g.line([x0 + k2 * T, y0 + h - T // 4, x0 + k2 * T, y0 + h - 1], fill=(50, 32, 20), width=lw * 2)
        elif k == 'tower':
            g.rectangle([x0, y0, x0 + w - 1, roofb], fill=(92, 96, 110), outline=(30, 30, 40), width=lw)
            g.polygon([(x0, y0), (x0 + w // 2, y0 + (roofb - y0) // 2), (x0 + w, y0)], fill=(72, 76, 92))
            g.ellipse([x0 + w // 2 - T, y0 + T, x0 + w // 2 + T, y0 + 3 * T], fill=(200, 156, 64), outline=(80, 56, 20), width=lw)
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(150, 146, 138), outline=(40, 40, 44), width=lw)
        elif k == 'barges':
            g.ellipse([x0, y0, x0 + w - 1, roofb + T], fill=(120, 84, 52), outline=(40, 26, 16), width=lw * 2)
            g.ellipse([x0 + T * 2, y0 + T, x0 + w - 1 - T * 2, roofb], fill=(80, 60, 44))
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(140, 96, 58), outline=(40, 26, 16), width=lw)
        elif k == 'willowhouse':
            g.rectangle([x0, y0, x0 + w - 1, roofb], fill=(150, 90, 60), outline=(50, 30, 20), width=lw)
            g.ellipse([x0 - T // 2, y0 - T, x0 + w // 2, roofb], fill=(80, 120, 64), outline=(30, 56, 30), width=lw)
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(126, 98, 70), outline=(40, 26, 16), width=lw)
        elif k == 'leaning':
            g.polygon([(x0 + T // 3, y0), (x0 + w - 1, y0 + T // 4), (x0 + w - 1 - T // 4, roofb), (x0, roofb)], fill=(126, 76, 110), outline=(40, 20, 34))
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(170, 130, 96), outline=(40, 26, 16), width=lw)
        elif k == 'stonebox':
            g.rectangle([x0, y0, x0 + w - 1, roofb], fill=(120, 122, 128), outline=(40, 40, 44), width=lw)
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(156, 156, 162), outline=(40, 40, 44), width=lw)
        elif k == 'shed':
            g.rectangle([x0, y0, x0 + w - 1, y0 + h - 1], fill=(120, 90, 60), outline=(40, 26, 16), width=lw)
        else:  # hut on stilts with nets
            g.polygon([(x0, roofb), (x0 + w // 2, y0), (x0 + w, roofb)], fill=(170, 150, 96), outline=(70, 56, 30))
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(126, 90, 58), outline=(40, 26, 16), width=lw)
        if o.get('door'):
            dx, dy = o['door'][0] * T, o['door'][1] * T
            g.rectangle([dx + T * 5 // 32, dy + T // 16, dx + T - 1 - T * 5 // 32, dy + T - 1], fill=(16, 8, 8))
            nwin = max(1, o['w'] // 3)
            for i in range(nwin):
                sx = x0 + int((i + 0.5) * w / nwin)
                if abs(sx - (dx + T // 2)) < T: sx += int(T * 1.3) if sx >= dx + T // 2 else -int(T * 1.3)
                if sx < x0 + T // 2 or sx > x0 + w - T // 2: continue
                wy = roofb + T // 4
                g.rectangle([sx - T * 7 // 32, wy, sx + T * 7 // 32, wy + T * 12 // 32], fill=(255, 220, 120), outline=(40, 30, 30))
        blds.append(dict(id=o['id'], kind=k, x=o['x'], y=o['y'], w=o['w'], h=o['h'], wall=o.get('wall'), door=o.get('door')))
    return im, blds
T = int(sys.argv[1]) if len(sys.argv) > 1 else 36
im, blds = draw(T); im.save('guide_%d.png' % T)
im1, _ = draw(32); im1.save('guide_1x.png')
json.dump(blds, open('blds.json', 'w'), indent=1)
print(len(blds), 'buildings', im.size)
