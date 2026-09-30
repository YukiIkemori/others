"""幽霊船のしょく台（type 'brazier' の物の絵、組 'ship'）: 船の甲板・船倉に立つ木の柱と腕木に吊った船のランタン。
brazier__ship@24/32/40.png + brazier__ship.json（コマ off / on）を v2/assets/env/isles/props へ。
石のかがり火（common の brazier）の代わりに、船に合う物（持ち主 2026-09-29「地方に合う小道具」）。
ランタンは諸島の置き灯（lantern__isles）の絵をそのまま吊る。消えている時はガラスを暗く。usage: python3 ship_lantern.py"""
import json, os
from PIL import Image, ImageDraw
V2 = '/home/user/others/chronicle/v2'
OUT = os.path.join(V2, 'assets/env/isles/props')
LAN = os.path.join(OUT, 'lantern__isles@%d.png')
OL, D0, D1, D2, D3 = (26, 17, 13, 255), (52, 36, 27, 255), (80, 56, 39, 255), (108, 78, 52, 255), (136, 102, 68, 255)
IRON, IRON2 = (54, 54, 64, 255), (92, 92, 104, 255)


def frame(tile, on):
    u = tile / 40.0
    W, H = int(round(30 * u)), int(round(60 * u))
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); g = ImageDraw.Draw(im)
    R = lambda x0, y0, x1, y1, c: g.rectangle([int(round(x0 * u)), int(round(y0 * u)), max(int(round(x0 * u)), int(round(x1 * u)) - 1), max(int(round(y0 * u)), int(round(y1 * u)) - 1)], fill=c)
    # 足もとの台（甲板に打ちつけた厚い板）
    R(4, 53, 20, 59, OL); R(5, 54, 19, 58, D1); R(5, 54, 19, 55, D3); R(6, 57, 18, 58, D0)
    # 柱
    R(8, 11, 16, 54, OL); R(9, 12, 15, 54, D1); R(9, 12, 10, 54, D0); R(12, 12, 13, 54, D2); R(13, 12, 14, 54, D3)
    for y in (20, 38):   # 鉄の輪
        R(8, y, 16, y + 3, OL); R(9, y + 1, 15, y + 2, IRON2)
    # 腕木と支え
    R(8, 9, 29, 14, OL); R(9, 10, 28, 13, D2); R(9, 10, 28, 11, D3)
    for k in range(7):
        R(15 + k, 21 - k, 17 + k, 23 - k, OL)
        R(15 + k, 21 - k, 16 + k, 22 - k, D2)
    # 鉤
    R(23, 13, 25, 17, IRON)
    # 吊ったランタン（lantern__isles の絵）
    lan = Image.open(LAN % tile).convert('RGBA')
    px = lan.load()
    for y in range(lan.height):
        for x in range(lan.width):
            r, gg, b, a = px[x, y]
            if a < 128: continue
            glass = r > 170 and gg > 130
            if glass and not on: px[x, y] = (46, 50, 68, a)
            elif glass and on: px[x, y] = (255, 226, 150, a) if (r + gg) < 470 else (255, 246, 214, a)
    lx, ly = int(round(24 * u - lan.width / 2)), int(round(16 * u))
    im.alpha_composite(lan, (max(0, min(W - lan.width, lx)), ly))
    return im


meta = {"id": "brazier__ship", "kind": "props", "theme": "isles", "frames": ["off", "on"], "cell": {}, "feet": {}, "files": {},
        "src": "design/art_ref/gen/env/_tools/under/field_isles/props_ship/ship_lantern.py", "set": "ship", "base": "brazier", "fire": True}
for t in (24, 32, 40):
    a, b = frame(t, False), frame(t, True)
    sh = Image.new('RGBA', (a.width * 2, a.height), (0, 0, 0, 0)); sh.alpha_composite(a, (0, 0)); sh.alpha_composite(b, (a.width, 0))
    sh.save(os.path.join(OUT, 'brazier__ship@%d.png' % t), optimize=True)
    meta['cell'][str(t)] = [a.width, a.height]
    meta['feet'][str(t)] = [int(round(12 * t / 40)), a.height - 1]
    meta['files'][str(t)] = 'brazier__ship@%d.png' % t
u32 = 32 / 40
meta["light32"] = [round((24 - 12) * u32), round((16 + 14 - 59) * u32)]
json.dump(meta, open(os.path.join(OUT, 'brazier__ship.json'), 'w'), indent=1)
print('brazier__ship', meta['cell'], meta['light32'])
