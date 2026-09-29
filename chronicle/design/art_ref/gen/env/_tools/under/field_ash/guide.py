"""(ash copy of ../field_desert/guide.py: ash ground colours, charred trees, crags, black lava crust, LAVA) Layout guide for a painted FIELD area, from <id>/layout.json (areas.py).
usage: python3 guide.py <id> [T=48]  -> <id>/guide_<T>.png (sent to the model) and <id>/guide_16.png (small preview)
Flat colour-coding the model traces: symbols (circles for tree crowns, strata for cliff faces, block lines for stone) tell it the material.
Landmarks (marks) are drawn as their own colour blocks and described in the prompt (mkjob.py)."""
import json, sys, random, math
from PIL import Image, ImageDraw

aid = sys.argv[1]; T = int(sys.argv[2]) if len(sys.argv) > 2 else 48
d = json.load(open(aid + '/layout.json'))
W, H, rows = d['w'], d['h'], d['rows']
C = {',': (98, 132, 72), ';': (128, 126, 98), '"': (98, 132, 72), '.': (158, 138, 112), ':': (124, 106, 88), 's': (140, 136, 132),
     '_': (96, 150, 150), '=': (150, 98, 54), 'c': (112, 110, 118), '~': (20, 48, 86), 'w': (70, 190, 188), 'T': (140, 136, 132),
     'F': (40, 40, 40), 'b': (140, 136, 132), 'r': (140, 136, 132), 'R': (96, 84, 80), 'X': (150, 150, 150),
     'u': (172, 168, 162), 'k': (84, 78, 86), 'l': (238, 108, 28)}


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
                for gc in 'suk,;':
                    if nb.count(gc) >= 2: base = C[gc]; break
            g.rectangle(R(x, y), fill=markc.get((x, y), base))
    if not sym: return im
    # 砂漠: 地面・水・崖の境を丸める（マスの段々をなぞらせない）。目印（marks）の塊だけはくっきり残す
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
            elif c == 'T':   # charred dead tree: a black trunk with bare forked branches
                g.line([cx, cy + T // 3, cx, cy - T // 4], fill=(24, 20, 20), width=max(2, T // 9))
                for k in range(5):
                    a_ = -math.pi / 2 + (k - 2) * 0.55
                    r = int(T * (0.42 + 0.08 * (k % 2)))
                    g.line([cx, cy - T // 8, cx + r * math.cos(a_), cy - T // 8 + r * math.sin(a_)], fill=(24, 20, 20), width=max(2, T // 14))
            elif c == 'u' and False:   # 砂丘は色の濃淡だけ（ぼかした塊で）
                for q in range(T // 5, T, T // 3): g.arc([x * T - T // 4, y * T + q - T // 4, x * T + T + T // 4, y * T + q + T // 4], 200, 340, fill=(200, 150, 80), width=max(2, lw * 2))
            elif c == 'k':   # ropey cooled lava crust
                for q in range(T // 5, T, T // 3):
                    g.arc([x * T - T // 5, y * T + q - T // 5, x * T + T + T // 5, y * T + q + T // 5], 200, 340, fill=(86, 80, 88), width=lw)
            elif c == 'l':   # molten lava: bright cracks between dark crust plates
                for _ in range(3):
                    px, py = x * T + rnd.randint(0, T), y * T + rnd.randint(0, T)
                    g.line([px, py, px + rnd.randint(-T // 3, T // 3), py + rnd.randint(-T // 3, T // 3)], fill=(255, 214, 90), width=max(2, lw * 2))
            elif c == 'w':
                if rnd.random() < 0.4: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(200, 240, 236), width=lw)
            elif c == 'F':
                r = int(T * 0.72)
                ox, oy = rnd.randint(-T // 8, T // 8), rnd.randint(-T // 8, T // 8)
                g.ellipse([cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy], fill=(34, 90, 48), outline=(10, 36, 18), width=lw)
            elif c == 'b':
                r = int(T * 0.40); g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(112, 116, 96), outline=(56, 58, 46), width=lw)
            elif c == 'r':
                r = int(T * 0.42); g.ellipse([cx - r, cy - r + T // 10, cx + r, cy + r], fill=(84, 80, 82), outline=(34, 30, 32), width=lw)
            elif c == 'R':
                up = ch(x, y - 1)
                for q in range(T // 4, T, T // 3): g.line([x * T, y * T + q + rnd.randint(-2, 2), x * T + T, y * T + q + rnd.randint(-2, 2)], fill=(62, 54, 52), width=lw)
                if up is not None and up not in 'R~wl':   # lit lip where the crag meets the ground above
                    g.rectangle([x * T, y * T, x * T + T - 1, y * T + max(2, T // 10)], fill=(150, 140, 130))
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
                if rnd.random() < 0.25: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(50, 90, 140), width=lw)
    # door marks (black) for entrances painted into the scenery
    for m in d['marks']:
        if m['kind'] == 'door':
            for x, y in m['cells']:
                g.rectangle([x * T + T // 6, y * T + T // 8, (x + 1) * T - 1 - T // 6, (y + 1) * T - 1], fill=(40, 26, 16))
    return im


im = draw(T); im.save(aid + '/guide_%d.png' % T)
draw(16, True).save(aid + '/guide_16.png')
print(aid, im.size)
