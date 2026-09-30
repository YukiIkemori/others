"""(2026-09-29 見直し) 炎の町カルデラの下絵の描き直し（段の輪の縁が階段状に角ばっていたのを、なめらかな丸い輪に）。
usage: python3 caldera.py guide | job | fit <gen.png> | process <gen.png>
  guide   : caldera/guide_48.png。建物・闘技場・湯・石段・橋・門は今の絵をそのまま貼り、輪（外の岩・縁の道・段の崖・家の段・溶岩の堀・敷石）は
            ash_caldera.js と同じ半径のなめらかな円で色分けする（ぼかした縁）。
  job     : caldera/genN.job.json（gen.sh で 1 枚）。
  fit     : 描いた絵から輪のマスの当たりを読み、ash_caldera.js の FIT（' ' = 円のまま）を caldera/fit.txt に書く ＋ caldera/check.png。
  process : 下絵 caldera@24/@32、溶岩と窓の emit、caldera.json（戸口 doors32 は前のまま＝建物は動かさない）を v2/assets/env/ash/under/ へ。
地図のデータは caldera/map_dump.json（node で R.DB.maps.caldera を書き出した物）。"""
import sys, json, os, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = '/home/user/others/chronicle/v2'
UNDER = os.path.join(V2, 'assets/env/ash/under')
D = os.path.join(HERE, 'caldera')
W = H = 54; CX = CY = 27; RAD = 26
dump = json.load(open(os.path.join(D, 'map_dump.json')))
blds = [o for o in dump['objects'] if o['type'] == 'building']


def ring_char(r):
    if r <= 0.3: return 'X'
    if r <= 0.43: return 'c'
    if r <= 0.5: return '%'
    if r <= 0.78: return 'a'
    if r <= 0.84: return 'F'
    if r <= 0.96: return 'a'
    return 'M'


def base_rows():
    """ash_caldera.js の円の輪（FIT の前）。建物・石段・橋・湯・門は今の地図の字"""
    cur = dump['rows']; g = []
    for y in range(H):
        row = ''
        for x in range(W):
            r = np.hypot(x + 0.5 - (CX + 0.5), y + 0.5 - (CY + 0.5)) / RAD
            c = cur[y][x]
            row += c if c in 'ebhc' and ring_char(r) != 'c' or c == 'b' or c == 'h' or c == 'e' else ring_char(r)
        g.append(row)
    return g


def keep_mask(T):
    """今の絵をそのまま貼る所（1 マス T px）: 建物（大卵殻・神殿は絵の大きさ）・闘技場・湯・石段・橋・門"""
    m = np.zeros((H * T, W * T), bool)
    def box(x0, y0, x1, y1): m[int(y0 * T):int(y1 * T), int(x0 * T):int(x1 * T)] = True
    for b in blds:
        if b['id'] == 'caldera_arena': continue
        box(b['x'] - 0.4, b['y'] - 0.6, b['x'] + b['w'] + 0.4, b['y'] + b['h'] + 0.5)
    box(18.6, 5.4, 35.4, 13.4)            # 大卵殻（殻の上は家の段にかかる）
    box(21.2, 0, 32.8, 4.6)               # 火の神殿
    yy, xx = np.mgrid[0:H * T, 0:W * T] / T
    rr = np.hypot(xx - (CX + 0.5), yy - (CY + 0.5)) / RAD
    m |= rr <= 0.31                        # 闘技場
    m |= ((xx - 27.5) / 7.6) ** 2 + ((yy - 45.5) / 2.9) ** 2 <= 1   # 湯
    cur = dump['rows']
    for y in range(H):
        for x in range(W):
            if cur[y][x] in 'eb': box(x - 0.25, y - 0.25, x + 1.25, y + 1.25)   # 石段・橋
    box(0, 25.6, 4.6, 28.4); box(49.4, 25.6, 54, 28.4)   # 門
    return m


COL = {'M': (60, 54, 52), 'a': (132, 122, 110), 'F': (86, 74, 66), '%': (236, 112, 30), 'c': (92, 92, 100), 'X': (150, 140, 120)}


def guide():
    T = 48
    cur = Image.open(os.path.join(UNDER, 'caldera@32.png')).convert('RGB').resize((W * T, H * T), Image.LANCZOS)
    cur = np.asarray(cur).astype(np.float32)
    yy, xx = np.mgrid[0:H * T, 0:W * T]
    rr = np.hypot((xx + 0.5) / T - (CX + 0.5), (yy + 0.5) / T - (CY + 0.5)) / RAD
    g = np.zeros((H * T, W * T, 3), np.float32)
    for lo, hi, c in ((0.96, 9, 'M'), (0.84, 0.96, 'a'), (0.78, 0.84, 'F'), (0.5, 0.78, 'a'), (0.43, 0.5, '%'), (0.3, 0.43, 'c'), (0, 0.3, 'X')):
        g[(rr > lo) & (rr <= hi)] = COL[c]
    # 北の神殿へ上る道（縁の岩を切る）
    g[(yy < 5 * T) & (xx >= 22 * T) & (xx < 32 * T) & (rr > 0.96)] = COL['a']
    # 段の崖の面: 下（南）向きの面が見えるよう、崖の帯の外側半分を少し明るく
    g = np.asarray(Image.fromarray(g.astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32)
    k = keep_mask(T)
    ks = ndimage.gaussian_filter(k.astype(np.float32), 7)[..., None]
    out = cur * ks + g * (1 - ks)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(D, 'guide_48.png'))
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((W * 16, H * 16), Image.LANCZOS).save(os.path.join(D, 'guide_16.png'))
    print('guide', out.shape)


def job(name):
    T = 48
    P = f"""Paint the COMPLETE top-down map of a fantasy JRPG TOWN as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (buildings and cliffs seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no perspective).

THE PLACE: CALDERA, a town of fire-worshipping fighters built in rings inside an old cold volcanic crater. From the outside in: the dark jagged crater rock all around (outside the town, not walkable); a wide ROUND RIM ROAD of packed grey-brown ash running around the crater's inner edge, with the town gates west and east and, in the north, the fire temple carved into the rock; a ROUND CLIFF STEP (a low ring-shaped cliff of layered grey-brown rock, its sheer face turned toward the centre) with three flights of stone stairs (west, east, north-east) leading down to the HOUSE TERRACE, a wide round ring of ash ground where the houses stand: in the north a gigantic cracked WHITE-GOLD EGGSHELL (hatched by the firebird a century ago) that houses three shops, a red-domed inn in the west, a black stone tower house in the east, small stone houses with red tile roofs, a steaming turquoise HOT SPRING in the south; inside the terrace a ROUND MOAT OF GLOWING MOLTEN LAVA crossed by four stone bridges (north, south, west, east); inside the moat a round ring of dark basalt flagstones, and in the very centre a round stone ARENA with a sand floor and its gate to the south. Small flat details on the ash: cinders, pebbles, ruts, a few dry tufts, scattered barrels and crates only right against house walls.

The FIRST attached image is an exact LAYOUT GUIDE on a {W} x {H} tile grid (each tile = {T} x {T} px; the output is {W * T} x {H * T} px). Your painting is laid pixel-for-pixel on top of it and used directly as the game map. Where the guide already shows finished painted pixel art (the eggshell, the temple, every house, the arena, the hot spring, the stairs, the bridges and the gates), keep that art EXACTLY as it is: same place, same size, same shape, same doors in the same spots, same colours (you may only re-render it crisply). Everywhere else the guide is soft colour-coding of perfectly ROUND rings; paint them as real materials whose edges follow those smooth circles:
- very dark grey-brown = the crater ROCK outside the town (not walkable): jagged dark volcanic rock seen from above.
- grey-brown = walkable ASH GROUND of the rim road and the house terrace (flat).
- darker brown ring = the CLIFF STEP between the rim road and the house terrace (not walkable): layered grey-brown rock, sheer face toward the centre.
- orange = the molten LAVA MOAT (not walkable): glowing orange-yellow molten rock with dark crust plates, thin dark cooled lip along both banks.
- slate grey = BASALT FLAGSTONES around the arena (walkable).
MOST IMPORTANT: every ring edge (the outer crater edge, both edges of the cliff step, both banks of the lava moat, the flagstone ring) must be a SMOOTH, ROUND, ORGANIC curve that follows the guide's circles closely (within a quarter of a tile), with only small natural irregularities. ABSOLUTELY NO stair-stepped, staircase-shaped, jagged-square, pixel-block or tile-grid edges anywhere, no straight segments, no right angles.
The second attached image is only a STYLE REFERENCE from the same game: match its rendering; do not copy its layout.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly strokes, clear clusters, hue-shifted ramps. Characters are about {T * 48 // 32} output px tall.
Lighting: this is the ALBEDO base layer (the game adds night and lamp light at runtime). Neutral, even daylight-like light; NO darkness, NO night tint, NO long shadows, NO light pools, NO glow halo (lava is bright orange as a material, casting no light), NO vignette, NO fog.
Do NOT paint any characters, people, animals, treasure chests, lanterns, lamp posts, braziers, torches, signs, text, letters, numbers, grid lines, borders, frames or UI; keep the walkable ash ground open (no boulders or objects on it).
"""
    j = {"out": os.path.join(D, name + '.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
         "refs": [os.path.join(D, 'guide_48.png'), os.path.join(HERE, 'style_ash.png')], "tag": "caldera_under"}
    json.dump(j, open(os.path.join(D, name + '.job.json'), 'w'), ensure_ascii=False, indent=1)
    print(j['out'], j['size'], len(P))




def js_base():
    """ash_caldera.js の FIT の前の grid（輪・門・石段・橋・湯・建物）を同じ手順で"""
    g = [['M'] * W for _ in range(H)]
    rr = lambda x, y: np.hypot(x + 0.5 - (CX + 0.5), y + 0.5 - (CY + 0.5)) / RAD
    for y in range(H):
        for x in range(W):
            r = rr(x, y); ch = 'M'
            if r <= 0.3: ch = 'X'
            elif r <= 0.43: ch = 'c'
            elif r <= 0.5: ch = '%'
            elif r <= 0.78: ch = 'a'
            elif r <= 0.84: ch = 'F'
            elif r <= 0.96: ch = 'a'
            g[y][x] = ch
    for y in (26, 27):
        for x in list(range(0, 4)) + list(range(50, 54)): g[y][x] = 'c'
    ang = lambda x, y: np.arctan2(y + 0.5 - (CY + 0.5), x + 0.5 - (CX + 0.5))
    near = lambda a, b, w: abs(np.arctan2(np.sin(a - b), np.cos(a - b))) <= w
    for y in range(H):
        for x in range(W):
            if g[y][x] == 'F':
                a = ang(x, y)
                if near(a, np.pi, 0.05) or near(a, 0, 0.05) or near(a, -np.pi / 4, 0.05): g[y][x] = 'e'
    for y in range(H):
        for x in range(W):
            if g[y][x] == '%' and (x in (26, 27) or y in (26, 27)): g[y][x] = 'b'
    for y in range(43, 48):
        for x in range(20, 35):
            if ((x - 27) / 6.4) ** 2 + ((y - 45) / 2.3) ** 2 < 1 and g[y][x] == 'a': g[y][x] = 'h'
    for b in blds:
        for j in range(b['h']):
            for i in range(b['w']): g[b['y'] + j][b['x'] + i] = 'a'
        q = b['door']; g[q['y']][q['x']] = 'c'
        if g[q['y'] + 1][q['x']] in 'FM%': g[q['y'] + 1][q['x']] = 'a'
    for b in blds:
        q = b['door']
        if g[q['y'] + 1][q['x']] in 'FMX%h': g[q['y'] + 1][q['x']] = 'a'
    return g


def fit(src):
    from collections import deque
    T = 32
    A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(np.float32)
    L = A @ np.array([.299, .587, .114], np.float32)
    g0 = js_base(); G = np.array(g0)
    Q = (A // 16).astype(int); qi = Q[..., 0] * 256 + Q[..., 1] * 16 + Q[..., 2]
    kr = lambda m: np.kron(m, np.ones((T, T), bool))
    bmask = np.zeros((H, W), bool)
    for b in blds: bmask[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']] = True
    CLS = ['M', 'a', '%', 'c', 'X', 'h']
    ll = {}
    for c in CLS:
        m = (G == c) & ~bmask
        mi = ndimage.binary_erosion(m, iterations=1 if c != 'M' else 2)
        h = np.bincount(qi[kr(mi)], minlength=4096).astype(float) + 0.3
        ll[c] = np.log(h / h.sum())[qi].reshape(H, T, W, T).mean((1, 3))
    stack = np.stack([ll[c] for c in CLS]); cls = np.array(CLS)[stack.argmax(0)]
    # 段の崖: 家の段と縁の道の間の暗い線（明るさ < 45 の画素が 1/4 以上）
    yy, xx = np.mgrid[0:H, 0:W]
    rr = np.hypot(xx + 0.5 - (CX + 0.5), yy + 0.5 - (CY + 0.5)) / RAD
    dark = (L < 45).reshape(H, T, W, T).mean((1, 3))
    rows = [r[:] for r in g0]
    prot = set()
    for b in blds:
        for j in range(b['h']):
            for i in range(b['w']): prot.add((b['x'] + i, b['y'] + j))
        q = b['door']; prot |= {(q['x'], q['y']), (q['x'], q['y'] + 1), (q['x'], q['y'] + 2)}
    for y in range(H):
        for x in range(W):
            if (x, y) in prot or g0[y][x] in 'eb' or (y in (26, 27) and (x < 4 or x > 49)): continue
            c = cls[y, x]
            if 0.72 <= rr[y, x] <= 0.9 and dark[y, x] >= 0.25 and c != 'M': c = 'F'
            if c == 'X' and rr[y, x] > 0.36: c = 'a' if rr[y, x] > 0.5 else 'c'
            if c == 'h' and not (40 <= y <= 51): c = 'a'
            if c == 'c' and rr[y, x] > 0.56: c = 'a'
            if c == '%' and not (0.36 <= rr[y, x] <= 0.62): c = 'a'
            if c == 'a' and rr[y, x] <= 0.3: c = 'X'          # 闘技場の壁（石の色が灰に似る）
            elif c == 'a' and rr[y, x] < 0.42: c = 'c'
            rows[y][x] = c
    for o in dump['npcs'] + [o for o in dump['objects'] if o.get('type') in ('chest',)]:
        x, y = o['x'], o['y']
        if rows[y][x] not in 'ac' and (x, y) not in prot: rows[y][x] = 'a' if rr[y, x] > 0.5 else 'c'
    fx = json.load(open(os.path.join(D, 'fix.json'))) if os.path.exists(os.path.join(D, 'fix.json')) else {}
    for q in fx.get('set', []): rows[q[1]][q[0]] = q[2]
    # つながりの直し: 絵の道が斜めに細くなって切れた所（とどかない歩けるかたまり）は、両側に接する岩のマスのうち
    #   いちばん地面らしい 1 マスを開ける（くり返す）。石段・橋を通らずに輪をまたぐ開け方はしない（半径の帯が同じ所だけ）
    bl = set(prot)
    bcell = {(b['x'] + i, b['y'] + j) for b in blds for i in range(b['w']) for j in range(b['h'])} - {(b['door']['x'], b['door']['y']) for b in blds}
    WALKC = 'aceb'
    def reach():
        seen = np.zeros((H, W), bool); q = deque([(2, 26)]); seen[26, 2] = True
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                u, v = x + dx, y + dy
                if 0 <= u < W and 0 <= v < H and not seen[v, u] and rows[v][u] in WALKC and (u, v) not in bcell:
                    seen[v, u] = True; q.append((u, v))
        return seen
    band = lambda r: 0 if r > 0.84 else (1 if r > 0.5 else 2)
    for it in range(40):
        seen = reach()
        miss = np.array([[rows[y][x] in WALKC and not seen[y, x] and (x, y) not in bcell for x in range(W)] for y in range(H)])
        lab, n = ndimage.label(miss)
        if not n: break
        best = None
        for y in range(H):
            for x in range(W):
                if rows[y][x] not in 'MF' or (x, y) in set(tuple(q[:2]) for q in fx.get('set', [])): continue
                nb = [(x + a, y + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + a < W and 0 <= y + b < H]
                if any(seen[v, u] for u, v in nb) and any(lab[v, u] for u, v in nb):
                    bs = {band(rr[v, u]) for u, v in nb if rows[v][u] in WALKC and (u, v) not in bcell}
                    if len(bs) != 1: continue
                    sc = ll['a'][y, x] - ll['M'][y, x]
                    if best is None or sc > best[0]: best = (sc, x, y)
        if best is None: break
        rows[best[2]][best[1]] = 'a'; print('open', best[1], best[2], round(best[0], 2))
    json.dump([''.join(r) for r in rows], open(os.path.join(D, 'rows_fit.json'), 'w'))
    FIT = [''.join(rows[y][x] if rows[y][x] != g0[y][x] else ' ' for x in range(W)) for y in range(H)]
    open(os.path.join(D, 'fit.txt'), 'w').write('\n'.join('      ' + json.dumps(r) + ',' for r in FIT) + '\n')
    for y, r in enumerate(rows): print('%2d %s' % (y, ''.join(r)))


def process(src):
    """下絵（1 マス 48 px の絵）→ caldera@24/@32 ＋ emit（溶岩・窓）＋ caldera.json。明るさは前の下絵の歩ける地面に合わせる（町の夜の調子を保つ）"""
    T = 32
    rows = json.load(open(os.path.join(D, 'rows_fit.json')))
    g = np.array([list(r) for r in rows])
    A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(np.float32)
    A0 = A.copy()
    lum = lambda v: v @ np.array([.299, .587, .114], np.float32)
    kr = lambda m: np.kron(m, np.ones((T, T), bool))
    old = np.asarray(Image.open(os.environ.get('OLDREF', os.path.join(UNDER, 'caldera@32.png'))).convert('RGB')).astype(np.float32)   # 前の下絵（明るさの基準）
    oldrows = np.array([list(r) for r in dump['rows']])
    bm = np.zeros((H, W), bool)
    for b in blds: bm[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']] = True
    wo = float(lum(old)[kr((oldrows == 'a') & ~bm)].mean()); wn = float(lum(A)[kr((g == 'a') & ~bm)].mean())
    gain = float(np.clip(float(os.environ.get('TARGET', wo)) / wn, 0.8, 1.25))
    A = np.clip(A * gain, 0, 255)
    print('walk lum old %.1f new %.1f gain %.3f' % (wo, wn, gain))
    # 溶岩の emit（夜の光の後に描く）: 溶岩のマスとその近くの溶けた画素、溶岩のマスの殻も少し
    R_, G_, B_ = A0[..., 0], A0[..., 1], A0[..., 2]
    lava = ndimage.binary_dilation(kr(g == '%'), iterations=10)
    hot = lava & (R_ > 170) & (R_ - B_ > 90) & (G_ > 50)
    crust = kr(g == '%') & ~hot
    e = np.zeros((H * T, W * T, 4), np.float32); e[..., :3] = A; e[..., 3] = hot * 235 + crust * 150
    # 窓: 建物の壁の暖かい色のガラス
    fp = np.zeros((H * T, W * T), bool)
    for b in blds: fp[max(0, (b['y'] + b['h'] - 3) * T - 6):(b['y'] + b['h']) * T - 2, max(0, b['x'] * T - 12):(b['x'] + b['w']) * T + 12] = True
    pane = (R_ > 165) & (G_ > 115) & (B_ < 0.62 * R_) & (R_ - B_ > 75) & fp & ~lava
    lab, n = ndimage.label(ndimage.binary_closing(pane, iterations=2))
    wins = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        ys, xs = sl; h, w = ys.stop - ys.start, xs.stop - xs.start
        comp = lab[sl] == i + 1
        if comp.sum() < 30 or w < 6 or h < 6 or w > 24 or h > 24 or comp.sum() < 0.35 * w * h: continue
        wins.append(dict(kind='win', x=int(xs.start), y=int(ys.start), w=int(w), h=int(h)))
        m = comp & pane[sl]; es = e[sl]
        px = np.clip(A[sl] * 1.12 + np.array([22, 14, 0]), 0, 255)
        es[m, :3] = px[m]; es[m, 3] = 255
    e[..., :3] *= (e[..., 3:4] > 0)
    print('windows', len(wins), 'lava px', int(hot.sum()))

    def save_set(name, arr, rgba=False):
        im = Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), 'RGBA' if rgba else 'RGB')
        im.save(os.path.join(UNDER, name + '@32.png'), optimize=True)
        im.resize((W * 24, H * 24), Image.NEAREST if rgba else Image.LANCZOS).save(os.path.join(UNDER, name + '@24.png'), optimize=True)
    # 冷えた灯籠（町の灯りを守る依頼の 3 か所。ともすと上に鉄のかがり火 iron_brazier が出る）: 灰の道しるべの柱の「消えた」絵を下絵に描きこむ
    fx = json.load(open(os.path.join(D, 'fix.json'))) if os.path.exists(os.path.join(D, 'fix.json')) else {}
    spr = Image.open(os.path.join(V2, 'assets/env/ash/props/waylamp__ash@32.png')).convert('RGBA').crop((0, 0, 32, 57))
    base = Image.fromarray(np.clip(np.rint(A), 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    for x, y in fx.get('cold_lanterns', []):
        base.alpha_composite(spr, (x * T, (y + 1) * T - 57 - 2))
    A = np.asarray(base.convert('RGB')).astype(np.float32)
    save_set('caldera', A)
    save_set('caldera_emit', e, True)
    meta = json.load(open(os.path.join(UNDER, 'caldera.json')))
    meta.update(windows32=wins, gain=round(gain, 3), src='generated', files={'24': 'caldera@24.png', '32': 'caldera@32.png'})
    json.dump(meta, open(os.path.join(UNDER, 'caldera.json'), 'w'), indent=1)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'guide': guide()
    elif cmd == 'job': job(sys.argv[2] if len(sys.argv) > 2 else 'gen1')
    elif cmd == 'fit': fit(sys.argv[2])
    elif cmd == 'process': process(sys.argv[2])
