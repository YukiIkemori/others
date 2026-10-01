#!/usr/bin/env python3
"""前後の見比べ: tools/fx_gallery.js --strip の 2 枚（前 = --noimg、後）を行ごとに交互に並べ、左に「前」「後」と技・術の id を書く。
  python3 tools/vfx/compare_sheet.py <before.jpg> <after.jpg> <out.jpg> id id …（--strip に渡した順）"""
import sys
from PIL import Image, ImageDraw

b, a, out, ids = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
B, A = Image.open(b).convert('RGB'), Image.open(a).convert('RGB')
n = len(ids)
rh = (B.height + 3) // n            # 1 行の高さ（tile の padding 3 を含む）
lab = 150
S = Image.new('RGB', (B.width + lab, rh * n * 2 + 6 * n), (12, 12, 20))
d = ImageDraw.Draw(S)
y = 0
for i, k in enumerate(ids):
    for tag, im, col in (('before', B, (170, 170, 190)), ('after', A, (255, 220, 140))):
        S.paste(im.crop((0, i * rh, im.width, min(im.height, (i + 1) * rh))), (lab, y))
        d.text((8, y + 8), tag, fill=col)
        d.text((8, y + 26), k, fill=(220, 225, 240))
        y += rh
    y += 6
S.save(out, quality=86)
print('->', out, S.size)
