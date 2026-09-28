# ロアの里の下絵（v2/assets/env/hill_village/under/roa@24/32/40.png）の戸口に、閉じた木の戸を描き入れる。
#   下絵を作ったとき、案内図（guide）の黒い戸の印を絵が「黒い穴」のまま描いた（語り石の間だけ木の戸）。下絵のマップでは建物の絵を
#   描かないので、戸口が真っ黒な穴に見えていた（持ち主 2026-09-28「家に扉がない」）。
#   戸の木目は同じ下絵の語り石の間の戸から取り、穴の四角に合わせて伸ばし、鉄の帯 2 本・取っ手の輪・上の影を足す。
#   穴の見つけ方: 戸のマスのまわりで、暗い画素の多い列のいちばん長い続き → その列で暗い行のいちばん長い続き。穴がもう無ければ（描き済み）何もしない。
#   使い方: python3 roa_doors.py [under のフォルダ]（既定 v2/assets/env/hill_village/under）
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
UNDER = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(os.path.join(HERE, '../../../../../../v2/assets/env/hill_village/under'))
# 戸のマス（prologue_roa.js の建物の door）。語り石の間（21,9）は絵に木の戸があるので木目の元にする
DOORS = {'roa_h1': (7, 9), 'roa_h2': (14, 9), 'roa_h3': (30, 9), 'roa_h4': (37, 9), 'roa_h5': (5, 21), 'roa_h6': (32, 19), 'roa_berna': (20, 30)}
SRC32 = (675, 266, 702, 300)   # 語り石の間の戸の板（アーチより下の四角、32 px の絵の px）
DARK = 30


def longest(ok):
    """ok が続くいちばん長い所 [a, b]（無ければ None）"""
    best, a = None, None
    for i, v in enumerate(list(ok) + [False]):
        if v and a is None:
            a = i
        elif not v and a is not None:
            if best is None or i - 1 - a > best[1] - best[0]:
                best = (a, i - 1)
            a = None
    return best


def hole(L, T, tx, ty):
    x0, y0 = int((tx - 0.5) * T), int((ty - 1.5) * T)
    x1, y1 = int((tx + 1.5) * T), int((ty + 1.0) * T)
    m = L[y0:y1, x0:x1] < DARK
    col = m.sum(0)
    c = longest(col >= T * 0.7)   # 丸太の継ぎ目・花の影の暗い列は 1〜2 本で切れる。戸の穴は幅のある続き
    if c is None:
        return None
    r = longest(m[:, c[0]:c[1] + 1].mean(1) >= 0.5)
    if r is None:
        return None
    w, h = c[1] - c[0] + 1, r[1] - r[0] + 1
    if w < T * 0.4 or w > T * 1.1 or h < T * 0.6 or h > T * 1.6:
        return None
    return x0 + c[0], y0 + r[0], w, h


def door(src, w, h, k):
    """w×h の閉じた木の戸（k = T/32）"""
    d = np.asarray(src.resize((w, h), Image.LANCZOS)).astype(float)
    iron, hi = np.array([34, 30, 32]), np.array([92, 84, 80])
    bw = max(1, round(2 * k))
    for fy in (0.2, 0.74):   # 鉄の帯（左右の端は少し空ける）
        y = int(h * fy)
        d[y:y + bw, 1:w - 1] = iron
        d[y, 1:w - 1] = d[y, 1:w - 1] * 0.4 + hi * 0.6
    # 取っ手の輪（戸の右寄り、まん中の少し下）
    cx, cy, rr = int(w * 0.74), int(h * 0.5), max(1.5, 2.2 * k)
    yy, xx = np.mgrid[0:h, 0:w]
    ring = np.abs(np.hypot(xx - cx, yy - cy) - rr) < 0.75
    d[ring] = iron
    d[max(0, int(cy - rr)), cx] = hi
    # 縁の暗がり（枠との合わせ目）と、まぐさの下の影
    d[:, 0] *= 0.45; d[:, -1] *= 0.5
    for i in range(max(2, round(4 * k))):
        d[i] *= 0.35 + 0.65 * i / max(2, round(4 * k))
    d[-1] *= 0.6
    return Image.fromarray(np.clip(d, 0, 255).astype(np.uint8))


def main():
    for T in (24, 32, 40):
        p = os.path.join(UNDER, 'roa@%d.png' % T)
        if not os.path.exists(p):
            continue
        im0 = Image.open(p)
        mode = im0.mode
        im = im0.convert('RGBA')
        L = np.asarray(im.convert('RGB')).astype(int).sum(2) / 3
        k = T / 32
        src = im.convert('RGB').crop(tuple(round(v * k) for v in SRC32))
        n = 0
        for bid, (tx, ty) in DOORS.items():
            r = hole(L, T, tx, ty)
            if not r:
                print(T, bid, 'no hole (already painted?)')
                continue
            x, y, w, h = r
            im.paste(door(src, w, h, k), (x, y))
            print(T, bid, 'door', x, y, w, h)
            n += 1
        if n:
            im.convert(mode).save(p, optimize=True)   # 元の色の形（RGB）のまま


if __name__ == '__main__':
    main()
