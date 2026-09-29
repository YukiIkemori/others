"""(marsh copy of ../field_desert/guide.py: peat, sedge, reeds, teal water, willows) Layout guide for a painted FIELD area, from <id>/layout.json (areas.py).
usage: python3 guide.py <id> [T=48]  -> <id>/guide_<T>.png (sent to the model) and <id>/guide_16.png (small preview)
Flat colour-coding the model traces: symbols (circles for tree crowns, strata for cliff faces, block lines for stone) tell it the material.
Landmarks (marks) are drawn as their own colour blocks and described in the prompt (mkjob.py)."""
import json, sys, random, math
from PIL import Image, ImageDraw

aid = sys.argv[1]; T = int(sys.argv[2]) if len(sys.argv) > 2 else 48
d = json.load(open(aid + '/layout.json'))
W, H, rows = d['w'], d['h'], d['rows']
C = {',': (104, 128, 64), ';': (138, 136, 74), '"': (110, 134, 70), '.': (116, 86, 56), ':': (98, 74, 50), 's': (122, 104, 74),
     '_': (90, 140, 130), '=': (150, 102, 60), 'c': (156, 154, 144), '~': (44, 104, 112), 'w': (24, 50, 58), 'T': (104, 128, 64),
     'F': (38, 56, 34), 'b': (178, 154, 88), 'r': (104, 128, 64), 'R': (112, 110, 102), 'X': (150, 150, 150),
     'u': (222, 172, 96), 'k': (200, 178, 150)}


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
                for gc in ',;s':
                    if nb.count(gc) >= 2: base = C[gc]; break
            g.rectangle(R(x, y), fill=markc.get((x, y), base))
    if not sym: return im
    # 湿原: 地面・水・崖の境を丸める（マスの段々をなぞらせない）。目印（marks）の塊だけはくっきり残す
    from PIL import ImageFilter
    soft = im.filter(ImageFilter.GaussianBlur(T * 0.45))
    keep = Image.new('L', im.size, 0); kd = ImageDraw.Draw(keep)
    for (mx, my) in markc: kd.rectangle(R(mx, my), fill=255)
    im = Image.composite(im, soft, keep); g = ImageDraw.Draw(im)
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
            elif c == 'T':   # willow / swamp tree: a round drooping crown
                r = int(T * 0.62)
                g.ellipse([cx - r, cy - r - T // 6, cx + r, cy + r - T // 6], fill=(74, 100, 46), outline=(30, 44, 20), width=lw)
                for k in range(5):
                    px = cx - r + (k + 1) * 2 * r // 6
                    g.line([px, cy - T // 6, px, cy + r - T // 10], fill=(52, 76, 34), width=lw)
            elif c == 'u' and False:   # 砂丘は色の濃淡だけ（ぼかした塊で）
                for q in range(T // 5, T, T // 3): g.arc([x * T - T // 4, y * T + q - T // 4, x * T + T + T // 4, y * T + q + T // 4], 200, 340, fill=(200, 150, 80), width=max(2, lw * 2))
            elif c == 'k':
                for _ in range(3):
                    px, py = x * T + rnd.randint(0, T), y * T + rnd.randint(0, T)
                    g.line([px, py, px + rnd.randint(-T // 3, T // 3), py + rnd.randint(-T // 3, T // 3)], fill=(150, 126, 100), width=lw)
            elif c == 'F':   # drowned dead wood: dark crowns and bare branches
                r = int(T * 0.66)
                ox, oy = rnd.randint(-T // 8, T // 8), rnd.randint(-T // 8, T // 8)
                g.ellipse([cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy], fill=(46, 58, 36), outline=(16, 22, 12), width=lw)
                g.line([cx + ox - r // 2, cy + oy - r // 2, cx + ox + r // 2, cy + oy + r // 2], fill=(70, 60, 44), width=lw)
            elif c == 'b':   # reed bed: tall vertical stalks
                for q in range(T // 8, T, T // 5):
                    g.line([x * T + q, y * T + T - 2, x * T + q + rnd.randint(-2, 2), y * T + T // 6], fill=(120, 100, 50), width=max(1, lw))
                    g.ellipse([x * T + q - 2, y * T + T // 6 - 3, x * T + q + 2, y * T + T // 6 + 5], fill=(96, 64, 34))
            elif c == 'r':
                r = int(T * 0.40); g.ellipse([cx - r, cy - r + T // 10, cx + r, cy + r], fill=(108, 100, 88), outline=(52, 48, 40), width=lw)
            elif c == 'R':
                up = ch(x, y - 1)
                for q in range(T // 4, T, T // 3): g.line([x * T, y * T + q + rnd.randint(-2, 2), x * T + T, y * T + q + rnd.randint(-2, 2)], fill=(80, 78, 72), width=lw)
                if up is not None and up not in 'R~w':   # lit lip where the rock meets the ground above
                    g.rectangle([x * T, y * T, x * T + T - 1, y * T + max(2, T // 10)], fill=(160, 158, 146))
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
                if rnd.random() < 0.25: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(70, 130, 136), width=lw)
    # door marks (black) for entrances painted into the scenery
    for m in d['marks']:
        if m['kind'] == 'door':
            for x, y in m['cells']:
                g.rectangle([x * T + T // 6, y * T + T // 8, (x + 1) * T - 1 - T // 6, (y + 1) * T - 1], fill=(40, 26, 16))
    return im


im = draw(T); im.save(aid + '/guide_%d.png' % T)
draw(16, True).save(aid + '/guide_16.png')
print(aid, im.size)
