"""幽霊船 甲板: 描いた絵（ghost_ship_1/gen3.png）の海の上に霧の帯を重ねた ghost_ship_1/gen3_fog.png を作る（甲板の上は晴れたまま）。
絵の決まり（下地に霧を描かない）は町や野のためで、霧の海に浮かぶ船は霧そのものが場所の顔（リードの見直し 2026-09-30）。
霧: 大きさの違う 2 つの波の揺らぎ。船べりから 1 マスは薄く、マップの縁ほど濃い。色は冷たい灰青、濃さは 4 段に量子化（画素絵に合わせる）。
usage: python3 gs1_fog.py -> ghost_ship_1/gen3_fog.png（process.py の入力）"""
import json, numpy as np
from PIL import Image
from scipy import ndimage
from lib import fbm
d = json.load(open('ghost_ship_1/layout.json')); W, H = d['w'], d['h']
rows = d['rows_fit']
src = Image.open('ghost_ship_1/gen3.png').convert('RGB'); PW, PH = src.size; T = PW / W
A = np.asarray(src).astype(np.float32)
ship = np.array([[c != '~' for c in r] for r in rows])
dist = ndimage.distance_transform_edt(~ship)                     # マス: 船からの距離
dist = np.asarray(Image.fromarray(dist.astype(np.float32)).resize((PW, PH), Image.BILINEAR))
n1 = np.asarray(Image.fromarray(fbm(11, W, H * 3, 4, 3).astype(np.float32)).resize((PW, PH), Image.BICUBIC))   # 横に長い霧の帯
n2 = np.asarray(Image.fromarray(fbm(23, W * 4, H * 4, 3, 2).astype(np.float32)).resize((PW, PH), Image.BICUBIC))
ys, xs = np.mgrid[0:PH, 0:PW]
edge = np.minimum.reduce([xs / PW, 1 - xs / PW, ys / PH * 1.6, (1 - ys / PH) * 1.6])   # マップの縁ほど濃い
dens = np.clip((n1 * 0.8 + n2 * 0.3) - 0.62 + np.clip(0.22 - edge, 0, 0.22) * 1.8, 0, 1)
dens *= np.clip((dist - 0.9) / 1.6, 0, 1)                         # 船べりのすぐ外は薄く
a = np.clip(dens * 1.6, 0, 0.42)
a = np.floor(a / 0.42 * 4 + (((xs // 3 + ys // 3) % 2) * 0.35)) / 4 * 0.42   # 4 段（粗い市松でならす）
fogc = np.array([176, 188, 200], np.float32)
out = A * (1 - a[..., None]) + fogc * a[..., None]
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save('ghost_ship_1/gen3_fog.png')
print('fog cover', round(float((a > 0.1).mean()), 3))
