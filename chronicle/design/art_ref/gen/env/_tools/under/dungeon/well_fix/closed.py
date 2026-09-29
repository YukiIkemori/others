"""旅人の古井戸（well）の隠し通路の closed の層を作り直す（2026-09-29 持ち主「左下の隠し通路が半分見えている」）。
隠し通路の gate は (2, 23)（西の間の南西の隅）。見つける前は、その先（x 2 の細い道・小部屋）と岩の柱を、描いた岩の面で塗る:
  壁の縁のマス（2, 23）（3, 23）（4, 23）= 西の間の南の壁の縁（描いた (7〜9, 25)）の写し、ほかのマス = 描いた岩の面（(6〜9, 27〜28)）の写し。
usage: python3 closed.py   -> out/well_closed@24/32/40.png と out/well.json の live、v2/assets/env/cave/under/ にも写す"""
import json, os, numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(D, '..', 'well', 'out'); ASSET = '/home/user/others/chronicle/v2/assets/env/cave/under/'
A = np.asarray(Image.open(os.path.join(OUT, 'well@32.png')).convert('RGB'))
H, W = A.shape[0] // 32, A.shape[1] // 32; T = 32
C = np.zeros((H * T, W * T, 4), np.uint8)
cell = lambda a, x, y: a[y * T:(y + 1) * T, x * T:(x + 1) * T]
rim = {(2, 23): (7, 25), (3, 23): (8, 25), (4, 23): (9, 25)}
rock = [(x, y) for y in range(24, 30) for x in range(1, 6) if (x, y) != (5, 24)] + [(1, 23)]
cells = []
for (x, y), (sx, sy) in rim.items():
    cell(C, x, y)[..., :3] = cell(A, sx, sy); cell(C, x, y)[..., 3] = 255; cells.append((x, y))
for (x, y) in rock:
    sx, sy = 6 + (x * 3 + y) % 4, 27 + (x + y) % 2
    cell(C, x, y)[..., :3] = cell(A, sx, sy); cell(C, x, y)[..., 3] = 255; cells.append((x, y))
im = Image.fromarray(C, 'RGBA')
for t in (24, 32, 40):
    o = im if t == 32 else im.resize((W * t, H * t), Image.NEAREST if t > 32 else Image.LANCZOS)
    if t == 24:   # 縮めた色（LANCZOS）と、マスの形のままの不透明（NEAREST）
        a = np.asarray(im.resize((W * t, H * t), Image.NEAREST))[..., 3]
        o = np.asarray(o).copy(); o[..., 3] = a; o = Image.fromarray(o, 'RGBA')
    for d in (OUT, ASSET): o.save(os.path.join(d, 'well_closed@%d.png' % t), optimize=True)
for d in (OUT, ASSET):
    f = os.path.join(d, 'well.json'); j = json.load(open(f))
    j['live'] = [{'cells': [[x, y] for x, y in sorted(cells)], 'secret': '2,23'}]
    json.dump(j, open(f, 'w'), indent=1)
print('closed cells', len(cells))
