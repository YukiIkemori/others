"""(2026-10-01 見直し) 炎の町カルデラの下絵の描き直し: 丸い輪の町を、縦横にまっすぐな四角い段の町に（前の絵は丸い輪を地図へ
薄板スプラインで引きのばしていたので、全体が歪み建物が斜めに見えた。caldera_warp.py は使わない）。
usage: python3 caldera.py guide | job | fit <gen.png> | process <gen.png>
  guide   : caldera/guide_48.png。地図の字（map_dump.json の rows）をマスごとに色分けし、建物・闘技場は前に描いた gen1.png（引きのばす前）から
            縦横の拡大と平行移動だけで切り貼りする（回さない・曲げない）。
  job     : caldera/genN.job.json（gen.sh で 1 枚）。
  fit     : 描いた絵から段の縁の 1 マスのずれを読み、ash_caldera.js の FIT（' ' = そのまま）を caldera/fit.txt に書く。
  align   : python3 caldera.py align <gen.png> <out.png>: 描いた絵の段の縦・横のずれを、縦横別々の引きのばしだけで地図へ戻す（caldera/align.json）。
  process : 下絵 caldera@24/@32、溶岩と窓の emit、caldera.json（戸口 doors32 は前のまま＝建物は動かさない）を v2/assets/env/ash/under/ へ。
地図のデータは caldera/map_dump.json（node で R.DB.maps.caldera を書き出した物。FIT を空にして書き出す）。"""
import sys, json, os, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = '/home/user/others/chronicle/v2'
UNDER = os.path.join(V2, 'assets/env/ash/under')
D = os.path.join(HERE, 'caldera')
W = H = 54
dump = json.load(open(os.path.join(D, 'map_dump.json')))
blds = [o for o in dump['objects'] if o['type'] == 'building']
BASE = dump['rows']          # ash_caldera.js の FIT の前の grid（node で書き出す。FIT が空の時の dump）
G1 = os.path.join(D, 'gen1.png')   # 前に描いた丸い輪の町（引きのばす前の絵）。建物・闘技場はここから切って、まっすぐ貼る

# 建物の絵の切り出し（gen1 のマス）→ 地図のマス: 切る箱 (x0, y0, x1, y1)、合わせる点（gen1 の戸の中・下 → 地図の door.x+0.5, door.y+1）、拡大 sx, sy。
#   どれも縦横の拡大だけ（回したり曲げたりしない = 建物はまっすぐのまま）。大卵殻は縁の道にかからないよう縦を少しだけ詰める
PASTE = [
    ('egg', (17.6, 6.2, 36.2, 15.5), (26.3, 15.0), (26.5, 13.0), 0.873, 0.84),
    ('temple', (20.8, 0.0, 33.1, 4.8), (26.9, 4.5), (27.5, 4.0), 0.83, 0.83),
    ('inn', (3.85, 18.9, 11.4, 26.9), (7.6, 26.5), (9.5, 25.0), 0.96, 0.96),
    ('dorga', (41.8, 18.9, 48.9, 26.9), (45.1, 26.5), (43.5, 24.0), 0.94, 0.94),
    ('house', (7.7, 34.3, 14.3, 39.5), (10.56, 38.95), (11.5, 37.0), 0.93, 0.93),
    ('forge', (40.7, 30.6, 47.0, 35.6), (43.7, 35.0), (42.5, 34.0), 0.88, 0.88),
    ('store', (12.0, 13.0, 17.3, 18.0), (14.6, 17.4), (16.5, 15.0), 0.85, 0.85),
    ('hut', (36.9, 38.6, 41.6, 43.4), (39.3, 43.0), (41.5, 45.0), 0.98, 0.98),
    ('arena', (18.8, 20.6, 35.3, 37.3), (27.04, 36.6), (27.5, 35.0), 1.0, 1.0),
]


def pasted(T):
    """gen1 の建物を地図の位置へ（縦横の拡大と平行移動だけ）→ (RGB float, 重み 0..1)"""
    A = Image.open(G1).convert('RGB'); S = A.size[0] / W
    out = np.zeros((H * T, W * T, 3), np.float32); wt = np.zeros((H * T, W * T), np.float32)
    for name, (x0, y0, x1, y1), (ax, ay), (bx, by), sx, sy in PASTE:
        c = A.crop((round(x0 * S), round(y0 * S), round(x1 * S), round(y1 * S)))
        X0, Y0 = bx + (x0 - ax) * sx, by + (y0 - ay) * sy
        w, h = round((x1 - x0) * sx * T), round((y1 - y0) * sy * T)
        c = np.asarray(c.resize((w, h), Image.LANCZOS)).astype(np.float32)
        m = np.ones((h, w), np.float32)
        if name == 'arena':
            yy, xx = np.mgrid[0:h, 0:w]
            cx, cy = (27.5 - X0) * T, (27.5 - Y0) * T
            m = (np.hypot(xx - cx, (yy - cy)) <= 8.55 * T).astype(np.float32)
        if name == 'egg':   # 殻の丸い頭（上の角の岩は貼らない）＋ 下の石の台
            yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
            xg, yg = x0 + xx / (sx * T), y0 + yy / (sy * T)   # gen1 のマス
            m = ((((xg - 26.9) / 9.3) ** 2 + ((yg - 11.8) / 5.5) ** 2 <= 1) | (yg >= 11.6)).astype(np.float32)
        m = ndimage.gaussian_filter(m, 3)
        px, py = round(X0 * T), round(Y0 * T)
        ys, xs = slice(max(0, py), min(H * T, py + h)), slice(max(0, px), min(W * T, px + w))
        cs = (slice(ys.start - py, ys.stop - py), slice(xs.start - px, xs.stop - px))
        mm = m[cs]
        out[ys, xs] = out[ys, xs] * (1 - mm[..., None]) + c[cs] * mm[..., None]
        wt[ys, xs] = np.maximum(wt[ys, xs], mm)
    return out, wt


COL = {'M': (60, 54, 52), 'a': (132, 122, 110), 'F': (78, 66, 60), '%': (236, 112, 30), 'c': (92, 92, 100), 'X': (150, 140, 120),
       'h': (70, 200, 200), 'e': (170, 165, 155), 'b': (175, 168, 155)}


def guide():
    T = 48
    g = np.zeros((H * T, W * T, 3), np.float32)
    for y in range(H):
        for x in range(W):
            c = BASE[y][x]
            if c == 'h': c = 'a'   # 湯は下でなめらかな楕円に
            g[y * T:(y + 1) * T, x * T:(x + 1) * T] = COL.get(c, COL['a'])
            if c == 'e':   # 石段の段の線（北の石段は横の線、西・東は縦の線）
                for k in range(0, T, 8):
                    if y == 6: g[y * T + k:y * T + k + 2, x * T:(x + 1) * T] = (110, 104, 96)
                    else: g[y * T:(y + 1) * T, x * T + k:x * T + k + 2] = (110, 104, 96)
            if c == 'b':   # 橋の欄干（橋の向きの両側）
                v = x in (26, 27)
                if v: g[y * T:(y + 1) * T, x * T + (0 if x == 26 else T - 5):x * T + (5 if x == 26 else T)] = (120, 112, 100)
                else: g[y * T + (0 if y == 26 else T - 5):y * T + (5 if y == 26 else T), x * T:(x + 1) * T] = (120, 112, 100)
    # 湯（温泉）: 地図の湯のマスと同じ楕円（マスの階段にしない）
    yy, xx = np.mgrid[0:H * T, 0:W * T]
    g[(((xx + 0.5) / T - 27.5) / 6.6) ** 2 + (((yy + 0.5) / T - 45.4) / 2.35) ** 2 <= 1] = COL['h']
    # 崖の面: 北の崖（南向きの面が見える）は下半分を明るく
    for x in range(W):
        if BASE[6][x] == 'F': g[6 * T + T // 2:7 * T, x * T:(x + 1) * T] = (104, 92, 82)
    g = np.asarray(Image.fromarray(g.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32)
    p, wt = pasted(T)
    out = g * (1 - wt[..., None]) + p * wt[..., None]
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(D, 'guide_48.png'))
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((W * 16, H * 16), Image.LANCZOS).save(os.path.join(D, 'guide_16.png'))
    print('guide', out.shape)


def job(name):
    T = 48
    P = f"""Paint the COMPLETE top-down map of a fantasy JRPG TOWN as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (buildings and cliffs seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no perspective, no fisheye, no lens distortion).

THE PLACE: CALDERA, a town of fire-worshipping fighters built in stepped terraces inside an old cold volcanic crater. It is laid out on a strict square grid like a normal RPG town: every road, terrace edge, cliff, moat, bridge and stair runs perfectly HORIZONTAL or VERTICAL. From the outside in: dark jagged crater rock all around (not walkable); a RIM ROAD of packed grey-brown ash that runs around the town as a rectangle, with the town gates in the west and east and, in the north, the fire temple carved into the rock; a low STRAIGHT CLIFF STEP (one tile wide, layered grey-brown rock; along the north side its south-facing rock face is visible) with three flights of stone stairs (west, east and north-east) leading down to the HOUSE TERRACE, a wide square terrace of ash ground where the houses stand: in the north a gigantic cracked WHITE-GOLD EGGSHELL that houses three shops, a red-domed inn in the west, a black stone tower house in the east, small stone houses with red tile roofs, a forge, a steaming turquoise HOT SPRING pool in the south; in the middle a SQUARE MOAT OF GLOWING MOLTEN LAVA, two tiles wide, with straight banks and square corners, crossed by four straight stone bridges (north, south, west, east); inside the moat a square plaza of dark basalt flagstones, and in the very centre the round stone ARENA with a sand floor and its gate to the south. Small flat details on the ash: cinders, pebbles, ruts, a few dry tufts, scattered barrels and crates only right against house walls.

The FIRST attached image is an exact LAYOUT GUIDE on a {W} x {H} tile grid (each tile = {T} x {T} px; the output is {W * T} x {H * T} px). Your painting is laid pixel-for-pixel on top of it and used directly as the game map. Where the guide already shows finished painted pixel art (the eggshell, the temple, every house, the arena), keep that art EXACTLY as it is: same place, same size, same shape, same doors in the same spots, same colours, perfectly upright (you may only re-render it crisply). Everywhere else the guide is flat colour-coding on the tile grid; paint each area as real material that fills exactly its area:
- very dark grey-brown = the crater ROCK outside the town (not walkable): jagged dark volcanic rock seen from above.
- grey-brown = walkable ASH GROUND of the rim road and the house terrace (flat).
- darker brown one-tile bands = the CLIFF STEP between the rim road and the house terrace (not walkable): layered grey-brown rock wall; straight.
- light grey striped tiles in the cliff bands = STONE STAIRS (the stripes show the direction of the steps).
- orange = the molten LAVA MOAT (not walkable): glowing orange-yellow molten rock with dark crust plates, with a thin dark cooled stone lip along both banks.
- light stone tiles crossing the lava = STONE BRIDGES with low parapets on both sides, straight.
- slate grey = BASALT FLAGSTONES of the plaza around the arena and of the two gate passages (walkable).
- turquoise = the HOT SPRING: a natural steaming pool with a rim of rounded stones.
MOST IMPORTANT: every boundary between these areas is a STRAIGHT horizontal or vertical line exactly on the guide's tile edges, with crisp square corners (only the arena and the hot spring are round). No curves, no rings, no diagonal walls, no slanted or tilted buildings, no warped or bent shapes anywhere. All buildings stand perfectly upright with vertical walls.
The second attached image is only a STYLE REFERENCE from the same game: match its rendering; do not copy its layout.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly strokes, clear clusters, hue-shifted ramps. Characters are about {T * 48 // 32} output px tall.
Lighting: this is the ALBEDO base layer (the game adds night and lamp light at runtime). Neutral, even daylight-like light; NO darkness, NO night tint, NO long shadows, NO light pools, NO glow halo (lava is bright orange as a material, casting no light), NO vignette, NO fog.
Do NOT paint any characters, people, animals, treasure chests, lanterns, lamp posts, braziers, torches, signs, text, letters, numbers, grid lines, borders, frames or UI; keep the walkable ash ground open (no boulders or objects on it).
"""
    j = {"out": os.path.join(D, name + '.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
         "refs": [os.path.join(D, 'guide_48.png'), os.path.join(HERE, 'style_ash.png')], "tag": "caldera_under"}
    json.dump(j, open(os.path.join(D, name + '.job.json'), 'w'), ensure_ascii=False, indent=1)
    print(j['out'], j['size'], len(P))


def fit(src):
    """描いた絵から、段の縁（崖・岩・溶岩・湯・闘技場）の 1 マスのずれだけを当たりに写す。縁から離れたマス・建物・戸口・石段・橋・門は動かさない"""
    from collections import deque
    T = 32
    A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(np.float32)
    G = np.array([list(r) for r in BASE])
    Q = (A // 16).astype(int); qi = Q[..., 0] * 256 + Q[..., 1] * 16 + Q[..., 2]
    kr = lambda m: np.kron(m, np.ones((T, T), bool))
    bmask = np.zeros((H, W), bool)
    for b in blds: bmask[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']] = True
    CLS = ['M', 'a', 'F', '%', 'c', 'X', 'h']
    ll = {}
    for c in CLS:
        m = (G == c) & ~bmask
        mi = ndimage.binary_erosion(m, iterations=1) if c not in 'F' else m
        h = np.bincount(qi[kr(mi)], minlength=4096).astype(float) + 0.3
        ll[c] = np.log(h / h.sum())[qi].reshape(H, T, W, T).mean((1, 3))
    stack = np.stack([ll[c] for c in CLS]); cls = np.array(CLS)[stack.argmax(0)]
    rows = [list(r) for r in BASE]
    prot = set()
    for b in blds:
        for j in range(b['h']):
            for i in range(b['w']): prot.add((b['x'] + i, b['y'] + j))
        q = b['door']; prot |= {(q['x'], q['y']), (q['x'], q['y'] + 1)}
    for o in dump['npcs'] + [o for o in dump['objects'] if o['type'] != 'building']: prot.add((o['x'], o['y']))
    # 変えてよい組（縁のとなりだけ）: 歩ける ↔ 歩けない
    PAIR = {('a', 'F'), ('F', 'a'), ('a', 'M'), ('M', 'a'), ('a', '%'), ('%', 'a'), ('c', '%'), ('%', 'c'), ('a', 'h'), ('h', 'a'), ('c', 'X'), ('X', 'c')}
    for y in range(H):
        for x in range(W):
            b0 = BASE[y][x]
            if (x, y) in prot or b0 in 'ebd' or (y in (26, 27) and (x < 2 or x > 51)): continue
            nb = {BASE[v][u] for u, v in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= u < W and 0 <= v < H}
            c = str(cls[y, x])
            if c != b0 and (b0, c) in PAIR and c in nb and ll[c][y, x] - ll[b0][y, x] > 0.6: rows[y][x] = c
    fx = json.load(open(os.path.join(D, 'fix.json'))) if os.path.exists(os.path.join(D, 'fix.json')) else {}
    for q in fx.get('set', []): rows[q[1]][q[0]] = q[2]
    bcell = {(b['x'] + i, b['y'] + j) for b in blds for i in range(b['w']) for j in range(b['h'])} - {(b['door']['x'], b['door']['y']) for b in blds}
    WALKC = 'aceb'
    def reach():
        seen = np.zeros((H, W), bool); q = deque([(1, 26)]); seen[26, 1] = True
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                u, v = x + dx, y + dy
                if 0 <= u < W and 0 <= v < H and not seen[v, u] and rows[v][u] in WALKC and (u, v) not in bcell:
                    seen[v, u] = True; q.append((u, v))
        return seen
    # 閉じて届かなくなった歩ける所は、もとの字へ戻す（くり返す）
    for it in range(20):
        seen = reach(); n = 0
        for y in range(H):
            for x in range(W):
                if rows[y][x] in WALKC and not seen[y, x] and (x, y) not in bcell:
                    for u, v in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= u < W and 0 <= v < H and rows[v][u] != BASE[v][u] and BASE[v][u] in WALKC: rows[v][u] = BASE[v][u]; n += 1
        if not n: break
    json.dump([''.join(r) for r in rows], open(os.path.join(D, 'rows_fit.json'), 'w'))
    FIT = [''.join(rows[y][x] if rows[y][x] != BASE[y][x] else ' ' for x in range(W)) for y in range(H)]
    open(os.path.join(D, 'fit.txt'), 'w').write('\n'.join('      ' + json.dumps(r) + ',' for r in FIT) + '\n')
    print('changed', sum(c != ' ' for r in FIT for c in r))
    for y, r in enumerate(rows): print('%2d %s' % (y, ''.join(r)))


def align(src, out):
    """描いた絵の縦・横のずれ（描く道具が段をすこし上下にずらして描く）を、行と列ごとの 1 次元の対応（DTW）で地図へ戻す。
    out(y, x) = 絵(fy(y), fx(x)) の縦横別々の引きのばしだけ（縦の線は縦、横の線は横のまま = 建物は傾かない）。
    行の対応は「その行の地図の字」と「絵の画素の種類」の一致で決める（建物の所は数えない）"""
    t = 16; N = W * t
    A = np.asarray(Image.open(src).convert('RGB').resize((N, N), Image.BOX)).astype(np.float32)
    Q = (A // 16).astype(int); qi = Q[..., 0] * 256 + Q[..., 1] * 16 + Q[..., 2]
    G = np.array([list(r) for r in BASE]); G[G == 'e'] = 'F'; G[G == 'b'] = '%'
    bm = np.zeros((H, W), bool)
    for b in blds: bm[max(0, b['y'] - 2):b['y'] + b['h'], max(0, b['x'] - 1):b['x'] + b['w'] + 1] = True
    bm[5:14, 18:36] = True                       # 大卵殻の頭
    CLS = ['M', 'a', 'F', '%', 'c', 'X', 'h']
    kr = lambda m: np.kron(m, np.ones((t, t), bool))
    lab = np.zeros((N, N), int) - 1
    ll = []
    for i, c in enumerate(CLS):
        m = (G == c) & ~bm
        mi = ndimage.binary_erosion(m, iterations=2) if c not in 'F' else m
        h = np.bincount(qi[kr(mi)], minlength=4096).astype(float) + 0.5
        ll.append(np.log(h / h.sum())[qi])
        lab[kr(m)] = i
    P = np.argmax(np.stack(ll), 0)                # 絵の画素の種類
    valid = lab >= 0
    def dtw(gl, pl, vm):
        # gl[i] = 地図の i 行目の字の並び、pl[j] = 絵の j 行目の種類の並び。i → j の単調な対応（傾き 0.6..1.6）
        n = gl.shape[0]
        C = np.zeros((n, n), np.float32)
        for i in range(n):
            v = vm[i]
            C[i] = (pl[:, v] != gl[i, v][None, :]).mean(1) if v.any() else 0.5
        D = np.full((n, n), np.inf, np.float32); Bk = np.zeros((n, n), np.int8)
        D[0, 0] = C[0, 0]
        for i in range(n):
            for j in range(max(0, i - 4 * t), min(n, i + 4 * t)):   # ずれは 4 マスまで
                if i == 0 and j == 0: continue
                c = [D[i - 1, j - 1] if i and j else np.inf, D[i - 1, j] + 0.05 if i else np.inf, D[i, j - 1] + 0.05 if j else np.inf]
                k = int(np.argmin(c)); D[i, j] = C[i, j] + c[k]; Bk[i, j] = k
        i, j = n - 1, n - 1; path = [(i, j)]
        while i or j:
            k = Bk[i, j]
            if k == 0: i, j = i - 1, j - 1
            elif k == 1: i -= 1
            else: j -= 1
            path.append((i, j))
        f = np.zeros(n, np.float32); cnt = np.zeros(n, np.float32)
        for i, j in path: f[i] += j; cnt[i] += 1
        f = f / cnt
        f = ndimage.gaussian_filter1d(f, 1.5 * t)       # なめらかに（1 マス半）
        f = np.maximum.accumulate(f)
        return f
    fy = dtw(lab, P, valid)
    fx = dtw(lab.T, P.T, valid.T)
    for k in range(0, W + 1, 3): print('y %2d -> %.2f   x %2d -> %.2f' % (k, fy[min(N - 1, k * t)] / t, k, fx[min(N - 1, k * t)] / t))
    json.dump(dict(fy=(fy / t).tolist(), fx=(fx / t).tolist(), t=t), open(os.path.join(D, 'align.json'), 'w'))
    B = np.asarray(Image.open(src).convert('RGB')).astype(np.float32); S = B.shape[0] / W
    M = B.shape[0]
    ty = np.interp((np.arange(M) + 0.5) / S * t - 0.5, np.arange(N), fy) / t * S
    tx = np.interp((np.arange(M) + 0.5) / S * t - 0.5, np.arange(N), fx) / t * S
    # 縦横別々の引きのばし（行を選んでから列を選ぶ。最近傍 = 画素の角を保つ）
    iy = np.clip(np.rint(ty).astype(int), 0, M - 1); ix = np.clip(np.rint(tx).astype(int), 0, M - 1)
    R = B[iy][:, ix]
    Image.fromarray(np.clip(R, 0, 255).astype(np.uint8)).save(out)
    print('aligned ->', out)


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
    elif cmd == 'align': align(sys.argv[2], sys.argv[3])
    elif cmd == 'process': process(sys.argv[2])
