"""(isles copy of ../field_ash/guide.py: island colours — white chalk cliffs, white sand, turquoise shallows, deep blue sea, pines;
caves: dark wet rock; ships: dark wood decks and hull) Layout guide for a painted area / town / dungeon floor, from <id>/layout.json.
usage: python3 guide.py <id> [T=48]  -> <id>/guide_<T>.png (sent to the model) and <id>/guide_16.png (small preview)
The look set is layout meta 'look': field (default) | cave | ship | town."""
import json, sys, random, math
from PIL import Image, ImageDraw, ImageFilter

aid = sys.argv[1]; T = int(sys.argv[2]) if len(sys.argv) > 2 else 48
d = json.load(open(aid + '/layout.json'))
W, H, rows = d['w'], d['h'], d['rows']
LOOK = (d.get('meta') or {}).get('look', 'field')
C = {',': (104, 150, 76), ';': (130, 156, 92), '"': (104, 150, 76), '.': (196, 176, 136), ':': (160, 134, 100), 's': (232, 220, 186),
     '_': (120, 204, 200), '=': (150, 104, 60), 'c': (206, 204, 196), 'u': (128, 92, 60), 'k': (112, 116, 120), '~': (28, 84, 136),
     'w': (70, 176, 190), 'T': (104, 150, 76), 'F': (40, 86, 52), 'b': (104, 150, 76), 'r': (104, 150, 76), 'R': (214, 208, 192),
     'X': (236, 234, 226), 'l': (40, 30, 30)}
if LOOK == 'cave':
    C.update({'R': (58, 56, 64), 'k': (104, 110, 116), 's': (196, 186, 160), 'w': (40, 120, 140), '~': (24, 70, 100), 'r': (104, 110, 116)})
if LOOK == 'ship':
    C.update({'R': (44, 36, 34), 'X': (70, 50, 38), 'u': (118, 90, 64), 'c': (120, 60, 56), '~': (26, 50, 70), 'k': (90, 84, 80)})


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
            if c in 'rTb':   # objects standing on the ground: the ground under them follows the neighbours
                nb = [ch(i, j) for i, j in ((x - 1, y), (x + 1, y), (x, y + 1), (x, y - 1))]
                for gc in ',;sk_u':
                    if nb.count(gc) >= 2: base = C[gc]; break
            g.rectangle(R(x, y), fill=markc.get((x, y), base))
    if not sym: return im
    # 境を丸める（マスの段々をなぞらせない）。目印（marks）の塊と船の床・壁だけはくっきり残す
    soft = im.filter(ImageFilter.GaussianBlur(T * (0.2 if LOOK == 'ship' else 0.45)))
    keep = Image.new('L', im.size, 0); kd = ImageDraw.Draw(keep)
    for (mx, my) in markc: kd.rectangle(R(mx, my), fill=255)
    im = Image.composite(im, soft, keep); g = ImageDraw.Draw(im)
    for y in range(H):
        for x in range(W):
            c = ch(x, y); cx, cy = x * T + T // 2, y * T + T // 2
            if (x, y) in markc:
                continue
            if c == ';':
                for q in range(T // 6, T, T // 4): g.line([x * T + q, y * T + T - T // 6, x * T + q + T // 12, y * T + T // 2], fill=(76, 118, 56), width=lw)
            elif c == '"':
                for _ in range(4):
                    px, py = x * T + rnd.randint(4, T - 5), y * T + rnd.randint(4, T - 5)
                    g.ellipse([px - T // 16, py - T // 16, px + T // 16, py + T // 16], fill=rnd.choice([(236, 150, 190), (250, 240, 240), (200, 170, 240)]))
            elif c == 'T':   # pine crown seen from above
                r = int(T * 0.62)
                g.ellipse([cx - r, cy - r - T // 6, cx + r, cy + r - T // 6], fill=(46, 104, 70), outline=(20, 50, 34), width=lw)
            elif c == 'F':
                r = int(T * 0.72)
                ox, oy = rnd.randint(-T // 8, T // 8), rnd.randint(-T // 8, T // 8)
                g.ellipse([cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy], fill=(34, 90, 48), outline=(10, 36, 18), width=lw)
            elif c == 'b':
                r = int(T * 0.40); g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(78, 128, 64), outline=(36, 62, 30), width=lw)
            elif c == 'r':
                r = int(T * 0.42); g.ellipse([cx - r, cy - r + T // 10, cx + r, cy + r], fill=(118, 120, 124), outline=(50, 50, 56), width=lw)
            elif c == 'R' and LOOK == 'ship':
                pass
            elif c == 'R':
                up = ch(x, y - 1)
                strat = (70, 68, 74) if LOOK == 'cave' else (176, 170, 156)
                for q in range(T // 4, T, T // 3): g.line([x * T, y * T + q + rnd.randint(-2, 2), x * T + T, y * T + q + rnd.randint(-2, 2)], fill=strat, width=lw)
                if up is not None and up not in 'R~wX':   # lit lip where the cliff meets the ground above
                    g.rectangle([x * T, y * T, x * T + T - 1, y * T + max(2, T // 10)], fill=(120, 150, 90) if LOOK == 'field' else (140, 140, 146))
            elif c == 'X':
                col = (96, 70, 50) if LOOK == 'ship' else (200, 198, 188)
                for q in range(0, T, T // 2): g.line([x * T, y * T + q, x * T + T, y * T + q], fill=col, width=lw)
            elif c == 'c':
                col = (150, 80, 70) if LOOK == 'ship' else (176, 174, 166)
                for q in range(0, T, T // 2):
                    g.line([x * T, y * T + q, x * T + T, y * T + q], fill=col, width=lw)
                    o = T // 4 if (y * 2 + q // (T // 2)) % 2 else 0
                    g.line([x * T + q + o, y * T, x * T + q + o, y * T + T], fill=col, width=lw)
            elif c in '=u':
                horiz = ch(x - 1, y) in ('=', '.', ':', 'u') and ch(x + 1, y) in ('=', '.', ':', 'u')
                vert = ch(x, y - 1) in ('=', '.', ':', 'u') and ch(x, y + 1) in ('=', '.', ':', 'u')
                col = (100, 66, 36) if c == '=' else (92, 66, 44)
                for q in range(0, T, T // 4):
                    if (vert and not horiz) or (c == 'u'): g.line([x * T + q, y * T, x * T + q, y * T + T], fill=col, width=lw)
                    else: g.line([x * T, y * T + q, x * T + T, y * T + q], fill=col, width=lw)
            elif c == 'k':
                if rnd.random() < 0.5: g.arc([cx - T // 3, cy - T // 5, cx + T // 3, cy + T // 5], 200, 340, fill=(84, 88, 92), width=lw)
            elif c == 'w':
                if rnd.random() < 0.4: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(190, 236, 236), width=lw)
            elif c == '_':
                if rnd.random() < 0.3: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(230, 250, 250), width=lw)
            elif c == '~':
                if rnd.random() < 0.25: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(60, 120, 170), width=lw)
    # door marks (black) for entrances painted into the scenery
    for m in d['marks']:
        if m['kind'] == 'door':
            for x, y in m['cells']:
                g.rectangle([x * T + T // 6, y * T + T // 8, (x + 1) * T - 1 - T // 6, (y + 1) * T - 1], fill=(40, 26, 16))
    return im


im = draw(T); im.save(aid + '/guide_%d.png' % T)
draw(16, True).save(aid + '/guide_16.png')
print(aid, im.size)
