"""Layout guide for the painted Yule underlay. usage: python3 guide.py [T] -> guide_<T>.png, blds.json"""
import json, sys, math
from PIL import Image, ImageDraw
d = json.load(open('layout.json'))
W, H = d['w'], d['h']; rows = d['rows']; B = d['blds']
def at(x, y): return rows[y][x] if 0 <= x < W and 0 <= y < H else '#'
WALK = set('.,cip')
COL = {'.': (238, 238, 232), ',': (206, 186, 150), 'c': (128, 122, 118), 'i': (120, 196, 226), 'p': (168, 116, 66), '#': (156, 180, 218), 'F': (84, 74, 70), 'Z': (205, 214, 232)}
def draw(T):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
    R = lambda x, y, w=1, h=1: [x * T, y * T, (x + w) * T - 1, (y + h) * T - 1]
    lw = max(1, T // 24)
    for y in range(H):
        for x in range(W):
            ch = at(x, y)
            g.rectangle(R(x, y), fill=COL.get(ch, COL['#']))
            if ch == '#' and at(x, y + 1) in WALK:   # the drift's shadowed front bank facing the walkable ground below
                g.rectangle([x * T, y * T + T // 2, x * T + T - 1, y * T + T - 1], fill=(112, 136, 184))
            if ch == 'c' and (x + y) % 2 == 0:
                g.ellipse([x * T + T // 4, y * T + T // 4, x * T + 3 * T // 4, y * T + 3 * T // 4], outline=(96, 90, 88), width=lw)
            if ch == 'p':
                for k in range(0, T, T // 4): g.line([x * T + k, y * T, x * T + k, y * T + T - 1], fill=(120, 80, 44), width=lw)
            if ch == ',' and (x * 7 + y * 3) % 5 == 0:
                g.ellipse([x * T + T // 3, y * T + T // 3, x * T + T // 3 + T // 6, y * T + T // 3 + T // 8], fill=(170, 150, 120))
    # the great hearth: a round stone fire ring in the middle of the plaza (3x2 cells), glowing embers
    hx0, hy0 = 27 * T, 25 * T
    g.ellipse([hx0 - T // 4, hy0 - T // 4, hx0 + 3 * T + T // 4, hy0 + 2 * T + T // 4], fill=(84, 74, 70), outline=(40, 30, 28), width=lw * 2)
    g.ellipse([hx0 + T // 2, hy0 + T // 3, hx0 + 5 * T // 2, hy0 + 5 * T // 3], fill=(236, 120, 40))
    # longhouse body (Z): roof, with the front wall where the ground is open below
    for y in range(H):
        for x in range(W):
            if at(x, y) == 'Z':
                g.rectangle(R(x, y), fill=(205, 214, 232))
                if at(x, y + 1) in WALK or at(x, y + 1) == '#':
                    pass
    # kids' secret base: a small round tunnel mouth dug into the drift (the door object at 36,40)
    bx, by = 36 * T, 40 * T
    g.pieslice([bx + T // 8, by, bx + T - T // 8, by + 2 * T - T // 4], 180, 360, fill=(20, 14, 20))
    g.rectangle([bx + T // 8, by + T - T // 8, bx + T - T // 8, by + T - 1], fill=(20, 14, 20))
    blds = []
    for b in B:
        x0, y0, w, h = b['x'] * T, b['y'] * T, b['w'] * T, b['h'] * T
        wall = b['wall'] * T; k = b['kind']
        roofb = y0 + h - wall
        if k == 'long':
            # snow-laden humped roof (a hump per segment, like a dragon's back) + dark tarred log front wall
            g.rectangle([x0, y0, x0 + w - 1, roofb], fill=(205, 214, 232))
            g.line([x0 + T // 2, y0 + (roofb - y0) // 2, x0 + w - T // 2, y0 + (roofb - y0) // 2], fill=(60, 64, 80), width=max(2, T // 8))   # ridge
            for i in range(1, w // T):
                g.line([x0 + i * T, y0 + (roofb - y0) // 2 - T // 3, x0 + i * T + T // 3, y0 + (roofb - y0) // 2], fill=(90, 96, 120), width=lw)   # ridge 'scales'
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(104, 68, 44), outline=(40, 24, 16), width=lw)
        elif k == 'tower':
            g.ellipse([x0 + T // 4, y0, x0 + w - 1 - T // 4, roofb + T // 2], fill=(84, 96, 132), outline=(30, 30, 44), width=lw * 2)
            g.rectangle([x0 + T // 2, roofb, x0 + w - 1 - T // 2, y0 + h - 1], fill=(160, 158, 162), outline=(40, 34, 34), width=lw)
        elif k == 'icedome':
            g.ellipse([x0, y0, x0 + w - 1, y0 + h - 1 + T // 2], fill=(176, 226, 244), outline=(60, 110, 150), width=lw * 2)
            for i in range(1, 4): g.arc([x0 + i * T // 2, y0 + i * T // 3, x0 + w - 1 - i * T // 2, y0 + h - 1], 180, 360, fill=(110, 170, 200), width=lw)
            g.rectangle([x0 + T, roofb + T // 2, x0 + w - 1 - T, y0 + h - 1], fill=(150, 206, 230), outline=(60, 110, 150), width=lw)
        elif k == 'pit':
            g.ellipse([x0, y0, x0 + w - 1, y0 + h - 1], fill=(228, 232, 242), outline=(140, 150, 180), width=lw * 2)
            g.rectangle([x0 + 3 * T // 2, y0 + h - T, x0 + w - 1 - 3 * T // 2, y0 + h - 1], fill=(132, 122, 112), outline=(50, 40, 34), width=lw)
            g.ellipse([x0 + w - 2 * T, y0 + T // 2, x0 + w - 2 * T + T // 2, y0 + T], fill=(60, 50, 44))   # stovepipe
        elif k == 'tusk':
            g.ellipse([x0, y0, x0 + w - 1, roofb + T // 2], fill=(150, 108, 68), outline=(50, 30, 18), width=lw * 2)
            for i in range(3):
                cx = x0 + T + i * (w - 2 * T) // 2
                g.arc([cx - T, y0 - T // 2, cx + T, roofb + T // 2], 200, 340, fill=(242, 232, 204), width=max(3, T // 6))   # great tusks
            g.rectangle([x0 + T // 2, roofb, x0 + w - 1 - T // 2, y0 + h - 1], fill=(126, 86, 54), outline=(40, 24, 16), width=lw)
        elif k == 'stone':
            g.rectangle([x0, y0, x0 + w - 1, roofb], fill=(118, 120, 126), outline=(40, 40, 44), width=lw)
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(150, 150, 156), outline=(40, 40, 44), width=lw)
        elif k == 'hut':
            g.rectangle([x0, y0, x0 + w - 1, roofb], fill=(120, 80, 50), outline=(40, 24, 16), width=lw)
            g.rectangle([x0, roofb, x0 + w - 1, y0 + h - 1], fill=(150, 100, 60), outline=(40, 24, 16), width=lw)
            g.line([x0 - T // 4, y0 + h - 2, x0 + w + T // 4, y0 + h - 2], fill=(60, 40, 30), width=max(2, T // 10))   # sled runners
        elif k == 'watch':
            g.rectangle([x0 + T // 4, y0, x0 + w - 1 - T // 4, y0 + h - 1], fill=(126, 88, 56), outline=(40, 24, 16), width=lw)
            g.line([x0 + T // 4, y0, x0 + w - T // 4, y0 + h], fill=(80, 54, 34), width=lw * 2); g.line([x0 + w - T // 4, y0, x0 + T // 4, y0 + h], fill=(80, 54, 34), width=lw * 2)
            g.ellipse([x0 + w // 2 - T // 3, y0 + T // 3, x0 + w // 2 + T // 3, y0 + T], fill=(200, 160, 60))   # the bell
        elif k == 'cache':
            g.rectangle([x0, y0, x0 + w - 1, y0 + h - T // 2], fill=(120, 84, 54), outline=(40, 24, 16), width=lw)
            for i in (0, w - T // 4): g.rectangle([x0 + i, y0 + h - T // 2, x0 + i + T // 5, y0 + h - 1], fill=(70, 46, 30))
        elif k == 'shed':
            g.rectangle([x0, y0, x0 + w - 1, y0 + h - 1], fill=(132, 94, 60), outline=(40, 24, 16), width=lw)
            g.rectangle([x0 + T // 4, roofb + T // 2, x0 + w - 1 - T // 4, y0 + h - 1], fill=(60, 44, 34))   # open front
        if b.get('door'):
            dx, dy = b['door'][0] * T, b['door'][1] * T
            g.rectangle([dx + T * 5 // 32, dy + T // 16, dx + T - 1 - T * 5 // 32, dy + T - 1], fill=(20, 10, 10))
            # windows on the front band, away from the door
            if k in ('long', 'tower', 'stone', 'tusk', 'hut', 'icedome', 'pit'):
                nw = max(1, b['w'] // 3) if k == 'long' else 1 if b['w'] <= 4 else 2
                for i in range(nw):
                    sx = x0 + int((i + 0.5) * w / nw)
                    if abs(sx - (dx + T // 2)) < T: sx += int(T * 1.3) if sx >= dx + T // 2 else -int(T * 1.3)
                    if sx < x0 + T // 2 or sx > x0 + w - T // 2: continue
                    wy = y0 + h - T + T // 8 if b['wall'] <= 1 else roofb + T // 4
                    g.rectangle([sx - T * 7 // 32, wy, sx + T * 7 // 32, wy + T * 12 // 32], fill=(255, 220, 120), outline=(40, 30, 30))
        blds.append(dict(id=b['id'], kind=k, x=b['x'], y=b['y'], w=b['w'], h=b['h'], wall=b['wall'], door=b.get('door')))
    return im, blds
T = int(sys.argv[1]) if len(sys.argv) > 1 else 48
im, blds = draw(T); im.save('guide_%d.png' % T)
im1, _ = draw(32); im1.save('guide_1x.png')
json.dump(blds, open('blds.json', 'w'), indent=1)
print(len(blds), 'buildings', im.size)
