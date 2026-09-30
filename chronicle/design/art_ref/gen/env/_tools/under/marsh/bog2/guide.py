"""なめらかな沼の下書き（layout.py → cls_34.png + layout.json）。水・淵・葦・小島・泥の道はぼかした色の面（自然な岸、マスの段にしない）、
板の道は歩く向きに横切る板、枯れ木・沈んだ鐘楼の頭・歌の石はくっきり。開いた形（泥の道が出た形）。
usage: python3 guide.py → guide_34.png（生成用）"""
import json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
L = json.load(open('layout.json')); W, H = L['w'], L['h']
CLS = np.asarray(Image.open('cls_34.png')); T = 34
CH = '~=rTgpAB'
COL = {'~': (70, 110, 100), '=': (34, 60, 80), 'r': (128, 140, 64), 'T': (70, 60, 50), 'g': (92, 118, 64), 'p': (160, 112, 66), 'A': (110, 86, 60), 'B': (110, 86, 60)}
rows = L['rows']
cls = CLS
pal = np.array([COL[c] for c in CH], np.uint8)
base = Image.fromarray(pal[cls])
soft = base.filter(ImageFilter.GaussianBlur(T * 0.22))
crisp = cls == CH.index('p')
im = Image.composite(base, soft, Image.fromarray((crisp * 255).astype(np.uint8)))
g = ImageDraw.Draw(im); lw = max(1, T // 24); rnd = random.Random(7)
for y in range(H):
    for x in range(W):
        c = CH[cls[y * T + T // 2, x * T + T // 2]]
        if c == '~' and rnd.random() < 0.2:
            yy = y * T + rnd.randint(T // 4, 3 * T // 4); g.line([x * T + T // 5, yy, x * T + 3 * T // 5, yy], fill=(96, 136, 124), width=lw)
        elif c == 'r':
            for k in range(4):
                xx = x * T + (k + 0.5) * T / 4 + rnd.randint(-2, 2); g.line([xx, y * T + T - 2, xx + rnd.randint(-3, 3), y * T + rnd.randint(1, T // 3)], fill=(84, 100, 36), width=lw)
        elif c in 'AB' and rnd.random() < 0.4:
            g.ellipse([x * T + T // 4, y * T + T // 3, x * T + T // 2, y * T + T // 2], fill=(84, 66, 48))
# 板（歩く向きに横切る）
lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); lg = ImageDraw.Draw(lay)
for pl in L['planks']:
    if pl['ch'] != 'p': continue
    w = pl['w']; acc = 0.0; prev = None
    for (x, y, a) in pl['pts']:
        if prev is not None: acc += math.hypot(x - prev[0], y - prev[1])
        prev = (x, y)
        if acc < 0.2: continue
        acc = 0.0; nx, ny = -math.sin(a), math.cos(a)
        lg.line([(x - nx * w / 2) * T, (y - ny * w / 2) * T, (x + nx * w / 2) * T, (y + ny * w / 2) * T], fill=(120, 80, 44, 255), width=lw)
la = np.asarray(lay).copy(); la[..., 3] = np.where(crisp, la[..., 3], 0)
L2 = Image.fromarray(la); im.paste(L2, (0, 0), L2); g = ImageDraw.Draw(im)
# 枯れ木（行の 'T'）: 外の林はまとまりの中にいくつか、小島の縁は 1 本ずつ
for y in range(H):
    for x in range(W):
        if rows[y][x] == 'T' and (rnd.random() < 0.35 or 3 <= x <= W - 4 and 3 <= y <= H - 4):
            cx, cy = x * T + T // 2, y * T + T // 2
            for k in range(6):
                a = k * math.pi / 3 + 0.4; g.line([cx, cy, cx + math.cos(a) * T * 0.8, cy + math.sin(a) * T * 0.8], fill=(50, 40, 34), width=lw * 2)
            g.ellipse([cx - T // 4, cy - T // 4, cx + T // 4, cy + T // 4], fill=(60, 48, 40))
for (bx, by) in [(9, 27), (51, 27), (30, 6)]:   # 沈んだ鐘楼の頭（崩れた石の鐘室と青銅の鐘）
    x0, y0 = bx * T, by * T
    g.rectangle([x0 - T // 3, y0 - T // 2, x0 + T + T // 3, y0 + T], fill=(120, 116, 110), outline=(40, 38, 36), width=lw * 2)
    g.ellipse([x0, y0 - T // 4, x0 + T, y0 + T - T // 4], fill=(90, 150, 130), outline=(30, 60, 50), width=lw)
g.rectangle([33 * T + T // 4, 7 * T, 34 * T - T // 4, 8 * T - 1], fill=(150, 150, 140), outline=(60, 60, 56), width=lw)   # 歌の石
im.save('guide_34.png'); im.resize((W * 32, H * 32), Image.BOX).save('guide_1x.png')
print('ok', im.size)
