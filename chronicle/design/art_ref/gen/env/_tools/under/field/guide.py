"""Layout guide for a painted FIELD area, from <id>/layout.json (areas.py).
usage: python3 guide.py <id> [T=48]  -> <id>/guide_<T>.png (sent to the model) and <id>/guide_16.png (small preview)
Flat colour-coding the model traces: symbols (circles for tree crowns, strata for cliff faces, block lines for stone) tell it the material.
Landmarks (marks) are drawn as their own colour blocks and described in the prompt (mkjob.py)."""
import json, sys, random, math
from PIL import Image, ImageDraw

aid = sys.argv[1]; T = int(sys.argv[2]) if len(sys.argv) > 2 else 48
d = json.load(open(aid + '/layout.json'))
W, H, rows = d['w'], d['h'], d['rows']
C = {',': (100, 160, 70), ';': (78, 136, 56), '"': (104, 160, 74), '.': (200, 168, 116), ':': (150, 108, 68), 's': (228, 208, 150),
     '_': (120, 188, 212), '=': (150, 98, 54), 'c': (172, 170, 160), '~': (22, 62, 138), 'w': (44, 112, 192), 'T': (100, 160, 70),
     'F': (24, 70, 40), 'b': (100, 160, 70), 'r': (100, 160, 70), 'R': (128, 108, 88), 'X': (150, 150, 150)}


def ch(x, y):
    return rows[y][x] if 0 <= x < W and 0 <= y < H else None


def draw(T, sym=True):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
    rnd = random.Random(5); lw = max(1, T // 24)
    R = lambda x, y: [x * T, y * T, (x + 1) * T - 1, (y + 1) * T - 1]
    markc = {}
    for m in d['marks']:
        for x, y in m['cells']: markc[(x, y)] = tuple(m['color'])
    for y in range(H):
        for x in range(W):
            c = ch(x, y)
            base = C.get(c, (255, 0, 255))
            if c in 'rTb':   # objects standing on grass/sand: the ground under them follows the neighbours
                nb = [ch(i, j) for i, j in ((x - 1, y), (x + 1, y), (x, y + 1), (x, y - 1))]
                if nb.count('s') >= 2: base = C['s']
            g.rectangle(R(x, y), fill=markc.get((x, y), base))
    if not sym: return im
    for y in range(H):
        for x in range(W):
            c = ch(x, y); cx, cy = x * T + T // 2, y * T + T // 2
            if (x, y) in markc:
                continue
            if c == ';':
                for q in range(T // 6, T, T // 4): g.line([x * T + q, y * T + T - T // 6, x * T + q + T // 12, y * T + T // 2], fill=(50, 104, 40), width=lw)
            elif c == '"':
                for _ in range(4):
                    px, py = x * T + rnd.randint(4, T - 5), y * T + rnd.randint(4, T - 5)
                    g.ellipse([px - T // 16, py - T // 16, px + T // 16, py + T // 16], fill=rnd.choice([(236, 150, 190), (240, 220, 110), (200, 170, 240)]))
            elif c == 'T':
                r = int(T * 0.62)
                g.ellipse([cx - r, cy - r - T // 5, cx + r, cy + r - T // 5], fill=(52, 128, 58), outline=(16, 50, 22), width=lw)
            elif c == 'F':
                r = int(T * 0.72)
                ox, oy = rnd.randint(-T // 8, T // 8), rnd.randint(-T // 8, T // 8)
                g.ellipse([cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy], fill=(34, 90, 48), outline=(10, 36, 18), width=lw)
            elif c == 'b':
                r = int(T * 0.44); g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(92, 170, 70), outline=(30, 76, 30), width=lw)
            elif c == 'r':
                r = int(T * 0.42); g.ellipse([cx - r, cy - r + T // 10, cx + r, cy + r], fill=(140, 136, 126), outline=(60, 56, 50), width=lw)
            elif c == 'R':
                up = ch(x, y - 1)
                for q in range(T // 4, T, T // 3): g.line([x * T, y * T + q + rnd.randint(-2, 2), x * T + T, y * T + q + rnd.randint(-2, 2)], fill=(96, 80, 64), width=lw)
                if up is not None and up not in 'R~w':   # lit lip where the cliff meets the ground above
                    g.rectangle([x * T, y * T, x * T + T - 1, y * T + max(2, T // 10)], fill=(176, 156, 128))
            elif c == 'X':
                for q in range(0, T, T // 2): g.line([x * T, y * T + q, x * T + T, y * T + q], fill=(100, 100, 100), width=lw)
            elif c == 'c':
                for q in range(0, T, T // 2):
                    g.line([x * T, y * T + q, x * T + T, y * T + q], fill=(130, 128, 120), width=lw)
                    o = T // 4 if (y * 2 + q // (T // 2)) % 2 else 0
                    g.line([x * T + q + o, y * T, x * T + q + o, y * T + T], fill=(130, 128, 120), width=lw)
            elif c == '=':
                horiz = ch(x - 1, y) in ('=', '.', ':') or ch(x + 1, y) in ('=', '.', ':')
                vert = ch(x, y - 1) in ('=', '.', ':') or ch(x, y + 1) in ('=', '.', ':')
                for q in range(0, T, T // 4):
                    if horiz and not vert: g.line([x * T + q, y * T, x * T + q, y * T + T], fill=(100, 62, 30), width=lw)
                    else: g.line([x * T, y * T + q, x * T + T, y * T + q], fill=(100, 62, 30), width=lw)
            elif c == '~':
                if rnd.random() < 0.25: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(60, 110, 180), width=lw)
    # door marks (black) for entrances painted into the scenery
    for m in d['marks']:
        if m['kind'] == 'door':
            for x, y in m['cells']:
                g.rectangle([x * T + T // 6, y * T + T // 8, (x + 1) * T - 1 - T // 6, (y + 1) * T - 1], fill=(40, 26, 16))
    return im


im = draw(T); im.save(aid + '/guide_%d.png' % T)
draw(16, True).save(aid + '/guide_16.png')
print(aid, im.size)
