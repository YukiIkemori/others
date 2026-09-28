"""Layout guide for the painted bog (open state: every bell rung, the mud causeways out of the water). usage: python3 guide.py [T]"""
import json, sys, math, random
from PIL import Image, ImageDraw
d = json.load(open('layout_data.json'))
W, H = d['w'], d['h']; rows = d['rows']
COL = {'~': (70, 110, 100), '=': (34, 60, 80), 'g': (92, 118, 64), 'm': (110, 86, 60), 'p': (160, 112, 66), 'r': (128, 140, 64), 'T': (70, 60, 50), 'X': (90, 90, 90)}
def at(x, y): return rows[y][x] if 0 <= x < W and 0 <= y < H else 'r'
BELLS = [(9, 27), (51, 27), (30, 6)]
def draw(T):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
    R = lambda x, y, w=1, h=1: [x * T, y * T, (x + w) * T - 1, (y + h) * T - 1]
    lw = max(1, T // 24); rnd = random.Random(7)
    for y in range(H):
        for x in range(W):
            c = at(x, y); g.rectangle(R(x, y), fill=COL.get(c, (255, 0, 255)))
            if c == '~' and rnd.random() < 0.2:
                yy = y * T + rnd.randint(T // 4, 3 * T // 4); g.line([x * T + T // 5, yy, x * T + 3 * T // 5, yy], fill=(96, 136, 124), width=lw)
            elif c == 'r':
                for k in range(4):
                    xx = x * T + (k + 0.5) * T / 4 + rnd.randint(-2, 2); g.line([xx, y * T + T - 2, xx + rnd.randint(-3, 3), y * T + rnd.randint(1, T // 3)], fill=(84, 100, 36), width=lw)
            elif c == 'p':
                horiz = at(x - 1, y) == 'p' or at(x + 1, y) == 'p'; vert = at(x, y - 1) == 'p' or at(x, y + 1) == 'p'
                if horiz and not vert:
                    for k in range(0, T, max(3, T // 5)): g.line([x * T + k, y * T, x * T + k, y * T + T - 1], fill=(120, 80, 44), width=lw)
                else:
                    for k in range(0, T, max(3, T // 5)): g.line([x * T, y * T + k, x * T + T - 1, y * T + k], fill=(120, 80, 44), width=lw)
            elif c == 'm':
                if rnd.random() < 0.4: g.ellipse([x * T + T // 4, y * T + T // 3, x * T + T // 2, y * T + T // 2], fill=(84, 66, 48))
    for y in range(H):
        for x in range(W):
            if at(x, y) == 'T':
                cx, cy = x * T + T // 2, y * T + T // 2
                for k in range(6):
                    a = k * math.pi / 3 + 0.4; g.line([cx, cy, cx + math.cos(a) * T * 0.8, cy + math.sin(a) * T * 0.8], fill=(50, 40, 34), width=lw * 2)
                g.ellipse([cx - T // 4, cy - T // 4, cx + T // 4, cy + T // 4], fill=(60, 48, 40))
    for (bx, by) in BELLS:   # the sunken bell tower tops: a green bronze bell hanging in a broken stone belfry rising out of the ground
        x0, y0 = bx * T, by * T
        g.rectangle([x0 - T // 3, y0 - T // 2, x0 + T + T // 3, y0 + T], fill=(120, 116, 110), outline=(40, 38, 36), width=lw * 2)
        g.ellipse([x0, y0 - T // 4, x0 + T, y0 + T - T // 4], fill=(90, 150, 130), outline=(30, 60, 50), width=lw)
    # the bell-song stone (north islet) and the glowing pale mushrooms of the mist heart
    g.rectangle([33 * T + T // 4, 7 * T, 34 * T - T // 4, 8 * T - 1], fill=(150, 150, 140), outline=(60, 60, 56), width=lw)
    return im
T = int(sys.argv[1]) if len(sys.argv) > 1 else 34
draw(T).save('guide_%d.png' % T); draw(32).save('guide_1x.png'); print('ok', W * T, H * T)
