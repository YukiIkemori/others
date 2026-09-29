"""Layout guide for a painted SNOW FIELD area (copy of ../../field/guide.py with the snow palette), from <id>/layout.json (areas.py).
usage: python3 guide.py <id> [T=48]  -> <id>/guide_<T>.png (sent to the model) and <id>/guide_16.png (small preview)
Flat colour-coding the model traces: symbols (circles for tree crowns, strata for cliff faces, block lines for stone) tell it the material.
Landmarks (marks) are drawn as their own colour blocks and described in the prompt (mkjob.py)."""
import json, sys, random, math
from PIL import Image, ImageDraw

aid = sys.argv[1]; T = int(sys.argv[2]) if len(sys.argv) > 2 else 48
d = json.load(open(aid + '/layout.json'))
W, H, rows = d['w'], d['h'], d['rows']
C = {',': (238, 242, 250), ';': (220, 228, 242), '"': (232, 236, 242), '.': (200, 168, 116), ':': (168, 140, 110), 's': (150, 206, 236),
     '_': (150, 206, 236), '=': (150, 98, 54), 'c': (172, 170, 160), '~': (16, 40, 84), 'w': (40, 76, 118), 'T': (238, 242, 250),
     'F': (30, 70, 56), 'b': (238, 242, 250), 'r': (238, 242, 250), 'R': (120, 150, 196), 'X': (150, 150, 150)}


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
            if c in 'rTb':   # objects standing on snow/ice: the ground under them follows the neighbours
                nb = [ch(i, j) for i, j in ((x - 1, y), (x + 1, y), (x, y + 1), (x, y - 1))]
                if nb.count('s') >= 2: base = C['s']
                if nb.count('~') >= 2: base = C['~']
            g.rectangle(R(x, y), fill=markc.get((x, y), base))
    if not sym: return im
    for y in range(H):
        for x in range(W):
            c = ch(x, y); cx, cy = x * T + T // 2, y * T + T // 2
            if (x, y) in markc:
                continue
            if c == ';':
                for q in range(T // 6, T, T // 3): g.arc([x * T + q - T // 5, y * T + T // 3, x * T + q + T // 5, y * T + T // 3 + T // 3], 200, 340, fill=(170, 186, 214), width=lw)
            elif c == '"':
                for _ in range(3):
                    px, py = x * T + rnd.randint(4, T - 5), y * T + rnd.randint(4, T - 5)
                    g.line([px, py, px + rnd.randint(-3, 3), py - T // 6], fill=(170, 150, 100), width=lw)
            elif c == 's':
                if rnd.random() < 0.3: g.line([x * T + rnd.randint(2, T // 2), y * T + rnd.randint(2, T - 3), x * T + rnd.randint(T // 2, T - 2), y * T + rnd.randint(2, T - 3)], fill=(220, 240, 255), width=lw)
            elif c == 'w':
                if rnd.random() < 0.3:
                    px, py = x * T + rnd.randint(T // 4, 3 * T // 4), y * T + rnd.randint(T // 4, 3 * T // 4)
                    g.polygon([(px - T // 5, py), (px, py - T // 8), (px + T // 5, py + T // 10), (px, py + T // 6)], fill=(200, 222, 238))
            elif c == 'T':   # a snow-laden fir seen from above: a dark green star-like crown with white snow on it
                r = int(T * 0.58)
                pts = [(cx + (r if k % 2 == 0 else r * 0.55) * math.cos(k * math.pi / 6), cy - T // 6 + (r if k % 2 == 0 else r * 0.55) * math.sin(k * math.pi / 6)) for k in range(12)]
                g.polygon(pts, fill=(36, 86, 62), outline=(12, 40, 28))
                g.ellipse([cx - r // 2, cy - T // 6 - r // 2, cx + r // 3, cy - T // 6 + r // 3], fill=(240, 244, 252))
            elif c == 'F':
                r = int(T * 0.72)
                ox, oy = rnd.randint(-T // 8, T // 8), rnd.randint(-T // 8, T // 8)
                g.ellipse([cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy], fill=(30, 74, 56), outline=(10, 34, 24), width=lw)
                g.ellipse([cx - r // 2 + ox, cy - r // 2 + oy, cx + r // 4 + ox, cy + r // 4 + oy], fill=(228, 236, 246))
            elif c == 'b':
                r = int(T * 0.40); g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(120, 110, 80), outline=(60, 50, 30), width=lw)
                g.ellipse([cx - r // 2, cy - r, cx + r // 2, cy], fill=(240, 244, 252))
            elif c == 'r' and all(ch(i, j) in ('r', 'R', None) for i in (x - 1, x, x + 1) for j in (y - 1, y, y + 1)):   # inside a crag mass
                g.rectangle(R(x, y), fill=(118, 126, 146))
                for _ in range(2):
                    px, py = x * T + rnd.randint(0, T - T // 3), y * T + rnd.randint(0, T - T // 4)
                    g.polygon([(px, py + T // 4), (px + T // 6, py), (px + T // 3, py + T // 4)], fill=(236, 240, 250))
            elif c == 'r':
                r = int(T * 0.44); g.ellipse([cx - r, cy - r + T // 10, cx + r, cy + r], fill=(112, 118, 132), outline=(46, 50, 62), width=lw)
                g.ellipse([cx - r + 2, cy - r + T // 10, cx + r - 2, cy], fill=(236, 240, 250))
            elif c == 'R':
                up = ch(x, y - 1)
                for q in range(T // 4, T, T // 3): g.line([x * T, y * T + q + rnd.randint(-2, 2), x * T + T, y * T + q + rnd.randint(-2, 2)], fill=(80, 104, 150), width=lw)
                if up is not None and up not in 'R~w':   # snowy lip where the cliff meets the ground above
                    g.rectangle([x * T, y * T, x * T + T - 1, y * T + max(2, T // 6)], fill=(240, 244, 252))
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
                if rnd.random() < 0.25: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(50, 80, 130), width=lw)
    # door marks (black) for entrances painted into the scenery
    for m in d['marks']:
        if m['kind'] == 'door':
            for x, y in m['cells']:
                g.rectangle([x * T + T // 6, y * T + T // 8, (x + 1) * T - 1 - T // 6, (y + 1) * T - 1], fill=(40, 26, 16))
    return im


im = draw(T); im.save(aid + '/guide_%d.png' % T)
draw(16, True).save(aid + '/guide_16.png')
print(aid, im.size)
