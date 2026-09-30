"""(mine copy of ../field_isles/guide.py: mountain colours — alpine grass, heather, grey-brown cliffs, gravel roads, old snow, conifers;
mine / cavern town: packed-earth floors, dark rock walls, timber, rails, dark water, chasms) Layout guide for a painted area / town / floor,
from <id>/layout.json. usage: python3 guide.py <id> [T=48]  -> <id>/guide_<T>.png (sent to the model) and <id>/guide_16.png (preview)
The look set is layout meta 'look': field (default) | cave | town (the cavern town)."""
import json, sys, random, math
from PIL import Image, ImageDraw, ImageFilter

aid = sys.argv[1]; T = int(sys.argv[2]) if len(sys.argv) > 2 else 48
d = json.load(open(aid + '/layout.json'))
W, H, rows = d['w'], d['h'], d['rows']
LOOK = (d.get('meta') or {}).get('look', 'field')
C = {',': (104, 140, 80), ';': (126, 124, 96), '"': (104, 140, 80), '.': (184, 172, 150), ':': (150, 124, 96), 's': (232, 236, 242),
     '_': (120, 170, 190), '=': (150, 104, 60), 'c': (170, 162, 150), 'u': (122, 100, 78), 'k': (128, 120, 110), '~': (34, 70, 110),
     'w': (70, 130, 160), 'T': (104, 140, 80), 'F': (36, 70, 54), 'b': (104, 140, 80), 'r': (104, 140, 80), 'R': (118, 110, 102),
     'X': (150, 116, 84), 'l': (18, 16, 20)}
if LOOK in ('cave', 'town'):
    C.update({'k': (136, 112, 84), 'R': (58, 52, 50), 'r': (136, 112, 84), 's': (150, 140, 124), 'w': (36, 96, 116), '~': (24, 60, 84),
              'c': (158, 146, 128), 'X': (156, 122, 86), ',': (88, 110, 70), '.': (150, 130, 104)})


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
                for gc in ',;skc.:':
                    if nb.count(gc) >= 2: base = C[gc]; break
            g.rectangle(R(x, y), fill=markc.get((x, y), base))
    if not sym: return im
    SM = (d.get('meta') or {}).get('smooth')
    if SM:
        # (2026-09-30 見直し) 境をなめらかな曲線に: 地面の字ごとの塊をぼかして、いちばん濃い字をその画素の地面にする
        # （マスの段々も、ぼかしの段々も残らない。岸・岩棚・砂浜が自然な曲線でくっきり分かれる）。目印の塊は後でそのまま重ねる
        import numpy as np
        from scipy import ndimage
        gch = [[ch(x, y) for x in range(W)] for y in range(H)]
        for y in range(H):
            for x in range(W):
                if gch[y][x] in 'rTb':
                    nb = [ch(i, j) for i, j in ((x - 1, y), (x + 1, y), (x, y + 1), (x, y - 1))]
                    gch[y][x] = next((gc for gc in ',;skc.:' if nb.count(gc) >= 2), 'k' if LOOK != 'field' else ',')
        keys = sorted(set(c for r in gch for c in r))
        stack = []
        for kk in keys:
            m = np.kron(np.array([[1.0 if c == kk else 0.0 for c in r] for r in gch]), np.ones((T, T)))
            stack.append(ndimage.gaussian_filter(m, T * float(SM), mode='nearest'))
        am = np.argmax(np.stack(stack), 0)
        pal = np.array([C.get(kk, (255, 0, 255)) for kk in keys], np.uint8)
        base = Image.fromarray(pal[am], 'RGB')
        mk = Image.new('L', im.size, 0); mkd = ImageDraw.Draw(mk)
        for (mx, my) in markc: mkd.rectangle(R(mx, my), fill=255)
        im = Image.composite(im, base, mk)
    # 境を丸める（マスの段々をなぞらせない）。目印（marks）の塊と船の床・壁だけはくっきり残す
    soft = im.filter(ImageFilter.GaussianBlur(T * (0.2 if LOOK == 'ship' else 0.12 if SM else 0.45)))
    keep = Image.new('L', im.size, 0); kd = ImageDraw.Draw(keep)
    for (mx, my) in markc: kd.rectangle(R(mx, my), fill=255)
    im = Image.composite(im, soft, keep); g = ImageDraw.Draw(im)
    # 目印の形（mark 'shape'）: round = 丸い塔・岩（外接の四角の角を海・地面の色に戻して楕円に）
    for m in d['marks']:
        if m.get('shape') != 'round' or not m['cells']: continue
        xs_ = [c_[0] for c_ in m['cells']]; ys_ = [c_[1] for c_ in m['cells']]
        bx0, by0, bx1, by1 = min(xs_) * T, min(ys_) * T, (max(xs_) + 1) * T - 1, (max(ys_) + 1) * T - 1
        box = (bx0, by0, bx1 + 1, by1 + 1)
        el = Image.new('L', (bx1 - bx0 + 1, by1 - by0 + 1), 0); ImageDraw.Draw(el).ellipse([0, 0, bx1 - bx0, by1 - by0], fill=255)
        under = soft.crop(box); cur = im.crop(box)
        im.paste(Image.composite(cur, under, el), box[:2])
    g = ImageDraw.Draw(im)
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
            elif c == 'T':   # conifer seen from above (a dark pointed crown)
                r = int(T * 0.58)
                g.polygon([(cx, cy - r - T // 4), (cx + r, cy + r // 2), (cx - r, cy + r // 2)], fill=(38, 84, 62), outline=(16, 40, 30))
            elif c == 'F':
                r = int(T * 0.72)
                ox, oy = rnd.randint(-T // 8, T // 8), rnd.randint(-T // 8, T // 8)
                g.ellipse([cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy], fill=(34, 90, 48), outline=(10, 36, 18), width=lw)
            elif c == 'b':
                r = int(T * 0.40); g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(78, 128, 64), outline=(36, 62, 30), width=lw)
            elif c == 'r':
                nr = sum(ch(i, j) == 'r' for i, j in ((x - 1, y), (x + 1, y), (x, y + 1), (x, y - 1)))
                if nr >= 2:   # a heap (ore, slag, rubble): one merged mound, not a row of round stones
                    rr = int(T * 0.72)
                    g.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(112, 112, 116))
                    for _ in range(3):
                        px, py = x * T + rnd.randint(4, T - 5), y * T + rnd.randint(4, T - 5)
                        g.ellipse([px - T // 8, py - T // 10, px + T // 8, py + T // 10], fill=(90, 90, 96))
                else:
                    r = int(T * 0.42); g.ellipse([cx - r, cy - r + T // 10, cx + r, cy + r], fill=(118, 120, 124), outline=(50, 50, 56), width=lw)
            elif c == 'R' and LOOK == 'ship':
                pass
            elif c == 'R':
                up = ch(x, y - 1)
                strat = (40, 36, 34) if LOOK in ('cave', 'town') else (92, 86, 80)
                for q in range(T // 4, T, T // 3): g.line([x * T, y * T + q + rnd.randint(-2, 2), x * T + T, y * T + q + rnd.randint(-2, 2)], fill=strat, width=lw)
                if up is not None and up not in 'R~wX':   # lit lip where the cliff meets the ground above
                    g.rectangle([x * T, y * T, x * T + T - 1, y * T + max(2, T // 10)], fill=(120, 150, 90) if LOOK == 'field' else (92, 84, 78))
            elif c == 'X':
                col = (98, 70, 46)
                for q in range(0, T, T // 3): g.line([x * T + q, y * T, x * T + q, y * T + T], fill=col, width=lw)
            elif c == 'c':
                col = (150, 80, 70) if LOOK == 'ship' else (176, 174, 166)
                for q in range(0, T, T // 2):
                    g.line([x * T, y * T + q, x * T + T, y * T + q], fill=col, width=lw)
                    o = T // 4 if (y * 2 + q // (T // 2)) % 2 else 0
                    g.line([x * T + q + o, y * T, x * T + q + o, y * T + T], fill=col, width=lw)
            elif c == 'u':   # rail track: dark sleepers across, two steel rails along the line
                horiz = ch(x - 1, y) == 'u' or ch(x + 1, y) == 'u'
                vert = ch(x, y - 1) == 'u' or ch(x, y + 1) == 'u'
                if vert and not horiz:
                    for q in range(T // 8, T, T // 4): g.rectangle([x * T + T // 8, y * T + q, x * T + T - T // 8, y * T + q + T // 10], fill=(84, 60, 40))
                    for rx in (x * T + T // 4, x * T + T - T // 4): g.line([rx, y * T, rx, y * T + T], fill=(170, 170, 176), width=max(2, T // 16))
                else:
                    for q in range(T // 8, T, T // 4): g.rectangle([x * T + q, y * T + T // 8, x * T + q + T // 10, y * T + T - T // 8], fill=(84, 60, 40))
                    for ry in (y * T + T // 4, y * T + T - T // 4): g.line([x * T, ry, x * T + T, ry], fill=(170, 170, 176), width=max(2, T // 16))
            elif c == 'l':
                pass
            elif c in '=':
                horiz = ch(x - 1, y) in ('=', '.', ':', 'u') and ch(x + 1, y) in ('=', '.', ':', 'u')
                vert = ch(x, y - 1) in ('=', '.', ':', 'u') and ch(x, y + 1) in ('=', '.', ':', 'u')
                col = (100, 66, 36) if c == '=' else (92, 66, 44)
                for q in range(0, T, T // 4):
                    if (vert and not horiz) or (c == 'u'): g.line([x * T + q, y * T, x * T + q, y * T + T], fill=col, width=lw)
                    else: g.line([x * T, y * T + q, x * T + T, y * T + q], fill=col, width=lw)
            elif c == 'k':
                if rnd.random() < 0.4: g.arc([cx - T // 3, cy - T // 5, cx + T // 3, cy + T // 5], 200, 340, fill=(104, 86, 64) if LOOK != 'field' else (98, 94, 88), width=lw)
            elif c == 's':
                if rnd.random() < 0.3: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(200, 210, 224) if LOOK == 'field' else (120, 112, 100), width=lw)
            elif c == 'w':
                if rnd.random() < 0.4: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(190, 236, 236), width=lw)
            elif c == '_':
                if rnd.random() < 0.3: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(230, 250, 250), width=lw)
            elif c == '~':
                if rnd.random() < 0.25: g.arc([cx - T // 3, cy - T // 6, cx + T // 3, cy + T // 6], 200, 340, fill=(60, 120, 170), width=lw)
    # rail lines (meta 'rails': polylines in cell units): smooth curves with sleepers and two steel rails (walkable like the ground under them)
    import math as _m
    from lib import spline as _spline
    for pl in (d.get('meta') or {}).get('rails', []):
        pts = [(px * T, py * T) for px, py in _spline(pl, 0.05)]
        acc = 0.0
        for i in range(1, len(pts)):
            (x0_, y0_), (x1_, y1_) = pts[i - 1], pts[i]
            L = _m.hypot(x1_ - x0_, y1_ - y0_)
            if L == 0: continue
            acc += L
            if acc >= T / 3.2:
                acc = 0.0
                nx_, ny_ = -(y1_ - y0_) / L, (x1_ - x0_) / L
                h = T * 0.34
                g.line([(x1_ - nx_ * h, y1_ - ny_ * h), (x1_ + nx_ * h, y1_ + ny_ * h)], fill=(84, 60, 40), width=max(2, T // 9))
        for off in (-0.2, 0.2):
            line = []
            for i in range(len(pts)):
                a_, b_ = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
                L = _m.hypot(b_[0] - a_[0], b_[1] - a_[1]) or 1
                nx_, ny_ = -(b_[1] - a_[1]) / L, (b_[0] - a_[0]) / L
                line.append((pts[i][0] + nx_ * off * T, pts[i][1] + ny_ * off * T))
            g.line(line, fill=(176, 176, 184), width=max(2, T // 14))
    # door marks (black) for entrances painted into the scenery
    for m in d['marks']:
        if m['kind'] == 'door':
            for x, y in m['cells']:
                g.rectangle([x * T + T // 6, y * T + T // 8, (x + 1) * T - 1 - T // 6, (y + 1) * T - 1], fill=(40, 26, 16))
    return im


im = draw(T); im.save(aid + '/guide_%d.png' % T)
draw(16, True).save(aid + '/guide_16.png')
print(aid, im.size)
