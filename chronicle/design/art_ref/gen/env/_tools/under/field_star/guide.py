"""(star copy of ../field_isles/guide.py: highland colours — silver-green grass, heather, grey rock cliffs, dark pines; town: pale marble
walls and flagstones; int (academy / tower): marble floors, wooden floors, stone walls) Layout guide for a painted area / town / dungeon floor, from <id>/layout.json.
usage: python3 guide.py <id> [T=48]  -> <id>/guide_<T>.png (sent to the model) and <id>/guide_16.png (small preview)
The look set is layout meta 'look': field (default) | cave | ship | town."""
import json, sys, random, math
from PIL import Image, ImageDraw, ImageFilter

aid = sys.argv[1]; T = int(sys.argv[2]) if len(sys.argv) > 2 else 48
d = json.load(open(aid + '/layout.json'))
W, H, rows = d['w'], d['h'], d['rows']
LOOK = (d.get('meta') or {}).get('look', 'field')
C = {',': (98, 140, 92), ';': (116, 130, 84), '"': (98, 140, 92), '.': (196, 186, 160), ':': (160, 140, 110), 's': (170, 168, 160),
     '_': (120, 204, 200), '=': (150, 104, 60), 'c': (206, 204, 196), 'u': (128, 92, 60), 'k': (86, 88, 100), '~': (20, 24, 44),
     'w': (60, 110, 160), 'T': (98, 140, 92), 'F': (34, 70, 56), 'b': (98, 140, 92), 'r': (98, 140, 92), 'R': (112, 110, 114),
     'X': (236, 234, 226), 'l': (40, 30, 30)}
if LOOK == 'cave':
    C.update({'R': (58, 56, 64), 'k': (104, 110, 116), 's': (196, 186, 160), 'w': (40, 120, 140), '~': (24, 70, 100), 'r': (104, 110, 116)})
if LOOK == 'int':
    C.update({'R': (52, 50, 58), 'X': (150, 146, 140), 'c': (214, 212, 204), 'u': (140, 100, 64), 'k': (120, 60, 64), '~': (14, 16, 30), 'r': (110, 80, 56)})
if LOOK == 'town':
    C.update({'R': (128, 124, 122), 'X': (226, 224, 216)})
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
    SM = (d.get('meta') or {}).get('smooth')
    GROUND = None
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
                    gch[y][x] = next((gc for gc in ',;sk_u' if nb.count(gc) >= 2), ',')
        # 目印のマスの下の地面 = いちばん近い目印でないマスの地面（なめらかな目印の角から地面がのぞく）
        mkm = np.zeros((H, W), bool)
        for (mx, my) in markc: mkm[my, mx] = True
        if mkm.any():
            _, (iy, ix) = ndimage.distance_transform_edt(mkm, return_indices=True)
            gch = [[gch[iy[y, x]][ix[y, x]] for x in range(W)] for y in range(H)]
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
        GROUND = base
    # 境を丸める（マスの段々をなぞらせない）。目印（marks）の塊と船の床・壁だけはくっきり残す
    soft = im.filter(ImageFilter.GaussianBlur(T * (0.2 if LOOK in ('ship', 'int') else 0.12 if SM else 0.45)))
    keep = Image.new('L', im.size, 0); kd = ImageDraw.Draw(keep)
    for (mx, my) in markc: kd.rectangle(R(mx, my), fill=255)
    im = Image.composite(im, soft, keep); g = ImageDraw.Draw(im)
    # 目印の形（mark 'shape'）: round = 丸い塔・岩（外接の四角の角を海・地面の色に戻して楕円に）
    for m in d['marks']:
        if m.get('shape') == 'smooth' and m['cells']:
            # smooth = 塊をぼかして半分で切った、角の丸いなめらかな形（船体・塔）
            import numpy as np
            from scipy import ndimage
            mm = np.zeros((H * T, W * T))
            for (mx, my) in m['cells']: mm[my * T:(my + 1) * T, mx * T:(mx + 1) * T] = 1
            sm = ndimage.gaussian_filter(mm, T * 0.6) > 0.5
            col = Image.new('RGB', im.size, tuple(m['color']))
            gr = (GROUND or soft).filter(ImageFilter.GaussianBlur(T * 0.12))
            cur = Image.composite(gr, im, Image.fromarray((mm * 255).astype('uint8')))   # 塊のマスはいったん地面に
            im = Image.composite(col, cur, Image.fromarray((sm * 255).astype('uint8')))
            continue
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
                    g.ellipse([px - T // 16, py - T // 16, px + T // 16, py + T // 16], fill=rnd.choice([(150, 190, 250), (250, 240, 240), (200, 170, 240)]))
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
            elif c == 'R' and LOOK in ('ship', 'int'):
                pass
            elif c == 'R':
                up = ch(x, y - 1)
                strat = (70, 68, 74) if LOOK in ('cave', 'int') else (104, 100, 98)
                for q in range(T // 4, T, T // 3): g.line([x * T, y * T + q + rnd.randint(-2, 2), x * T + T, y * T + q + rnd.randint(-2, 2)], fill=strat, width=lw)
                if up is not None and up not in 'R~wX':   # lit lip where the cliff meets the ground above
                    g.rectangle([x * T, y * T, x * T + T - 1, y * T + max(2, T // 10)], fill=(110, 140, 96) if LOOK == 'field' else (140, 140, 146))
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
