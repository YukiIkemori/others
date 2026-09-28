"""Layout guide for the painted manor floors. usage: python3 guide.py <floor 1|2> [T] -> guide_<f>_<T>.png, guide_<f>_1x.png"""
import json, sys, math, random
from PIL import Image, ImageDraw
F = sys.argv[1]
d = json.load(open('layout_%s.json' % F))
W, H = d['w'], d['h']; rows = d['rows']
FLOOR = set('.wcg')
COL = {'.': (150, 150, 158), 'w': (140, 96, 60), 'c': (140, 40, 46), 'g': (90, 124, 64), '~': (60, 110, 120), 'h': (40, 76, 40), 'X': (190, 186, 176), '#': (46, 44, 56)}
def at(x, y): return rows[y][x] if 0 <= x < W and 0 <= y < H else '#'
def draw(T):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
    R = lambda x, y, w=1, h=1: [x * T, y * T, (x + w) * T - 1, (y + h) * T - 1]
    lw = max(1, T // 24)
    for y in range(H):
        for x in range(W):
            c = at(x, y)
            g.rectangle(R(x, y), fill=COL.get(c, (255, 0, 255)))
            if c == '.':
                g.rectangle(R(x, y), outline=(120, 120, 130), width=lw)
            elif c == 'w':
                for k in range(0, T, max(3, T // 4)): g.line([x * T, y * T + k, x * T + T - 1, y * T + k], fill=(104, 70, 42), width=lw)
            elif c == 'c':
                gold = (196, 156, 72); m = max(2, T // 8)
                if at(x - 1, y) != 'c': g.line([x * T + m, y * T, x * T + m, y * T + T - 1], fill=gold, width=lw * 2)
                if at(x + 1, y) != 'c': g.line([x * T + T - 1 - m, y * T, x * T + T - 1 - m, y * T + T - 1], fill=gold, width=lw * 2)
                if at(x, y - 1) != 'c': g.line([x * T, y * T + m, x * T + T - 1, y * T + m], fill=gold, width=lw * 2)
                if at(x, y + 1) != 'c': g.line([x * T, y * T + T - 1 - m, x * T + T - 1, y * T + T - 1 - m], fill=gold, width=lw * 2)
            elif c == 'h':
                g.ellipse(R(x, y), fill=(52, 96, 48), outline=(20, 44, 20))
    # wall faces: the two wall cells right above a floor cell are the wall's front face (light stone with a dark foot), the rest is the dark wall top
    for y in range(H):
        for x in range(W):
            if at(x, y) != '#': continue
            if at(x, y + 1) in FLOOR or at(x, y + 1) in '~X':
                g.rectangle(R(x, y), fill=(122, 116, 128)); g.line([x * T, y * T + T - 2, x * T + T - 1, y * T + T - 2], fill=(40, 36, 44), width=lw * 2)
            elif at(x, y + 2) in FLOOR and at(x, y + 1) == '#':
                g.rectangle(R(x, y), fill=(104, 98, 112)); g.line([x * T, y * T + 1, x * T + T - 1, y * T + 1], fill=(170, 166, 176), width=lw)
    # the dry fountain (1F courtyard): round basin with a statue of a woman holding a bell
    if F == '1':
        cx, cy = 24 * T, 21 * T
        g.ellipse([22 * T, 19 * T, 26 * T - 1, 23 * T - 1], fill=(190, 186, 176), outline=(90, 86, 80), width=lw * 2)
        g.ellipse([22 * T + T // 2, 19 * T + T // 2, 26 * T - T // 2, 23 * T - T // 2], fill=(120, 110, 96))
        g.ellipse([cx - T // 2, cy - T, cx + T // 2, cy + T // 3], fill=(210, 206, 196), outline=(90, 86, 80), width=lw)
        # grand staircase (north hall, going up)
        for k in range(4): g.rectangle([23 * T, 3 * T + k * T // 4, 25 * T - 1, 3 * T + (k + 1) * T // 4 - 1], fill=(200 - k * 18, 190 - k * 18, 180 - k * 18), outline=(70, 60, 60))
    else:
        for k in range(4): g.rectangle([23 * T, 33 * T + k * T // 4, 24 * T - 1, 33 * T + (k + 1) * T // 4 - 1], fill=(120 - k * 18, 110 - k * 18, 104 - k * 18), outline=(40, 34, 34))
        # the band's stage (music room) is the carpet band; Melda's room: a faded rose carpet
    return im
T = int(sys.argv[2]) if len(sys.argv) > 2 else 40
draw(T).save('guide_%s_%d.png' % (F, T)); draw(32).save('guide_%s_1x.png' % F)
print('ok', W * T, H * T)
