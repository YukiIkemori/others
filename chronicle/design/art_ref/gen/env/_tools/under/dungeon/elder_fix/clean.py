"""千年樹（elder_1・elder_2）の下絵から、通り道に描かれた根のこぶ（桃色の根の絵・十字の木箱・年輪の輪）を消す（2026-09-29 持ち主「通路をふさぐ変な茶色の歯車みたいな物」）。
usage: python3 clean.py <map> <boxes.json> [--apply]
boxes.json = [[x0, y0, x1, y1, (dx, dy)], ...]（マス。小数可。dx, dy を足すとそのずらし（マス）で写す）。箱ごとに、まわりの輪（8〜24 px）がいちばん合う近くのずらし（±3 マス、4 px 刻み）の絵を写し、
6 px ぼかして重ねる（写し元に消す箱が重ならない物だけ）。入力は out/<map>@32.png の最初の版（out/<map>@32.orig.png に残す）、
--apply で out/ と v2/assets/env/tree_inside/under/ の @32・@24（@32 を LANCZOS で縮める）を書き換える。確かめの絵 → <map>_clean.png"""
import sys, json, os, shutil, numpy as np
from PIL import Image
from scipy import ndimage
m, bf = sys.argv[1], sys.argv[2]
D = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(D, '..', m, 'out'); ASSET = '/home/user/others/chronicle/v2/assets/env/tree_inside/under/'
orig = os.path.join(OUT, m + '@32.orig.png')
if not os.path.exists(orig): shutil.copy(os.path.join(OUT, m + '@32.png'), orig)
A = np.asarray(Image.open(orig).convert('RGB')).astype(np.float32); H, W = A.shape[:2]; T = 32
boxes = json.load(open(bf))
kill = np.zeros((H, W), bool)
for b in boxes: kill[int(b[1] * T):int(np.ceil(b[3] * T)), int(b[0] * T):int(np.ceil(b[2] * T))] = True
C = A.copy()
for b in boxes:
    y0, y1, x0, x1 = int(b[1] * T), int(np.ceil(b[3] * T)), int(b[0] * T), int(np.ceil(b[2] * T))
    box = np.zeros((H, W), bool); box[y0:y1, x0:x1] = True
    ring = ndimage.binary_dilation(box, iterations=16) & ~ndimage.binary_dilation(box, iterations=4) & ~kill
    ys, xs = np.nonzero(ring)
    best = None
    if len(b) > 4: best = (0.0, int(round(b[4] * T)), int(round(b[5] * T)))
    for dy in (range(-3 * T, 3 * T + 1, 4) if best is None else []):
        for dx in range(-3 * T, 3 * T + 1, 4):
            if abs(dx) < 20 and abs(dy) < 20: continue
            sy0, sy1, sx0, sx1 = y0 - 10 + dy, y1 + 10 + dy, x0 - 10 + dx, x1 + 10 + dx
            if sy0 < 0 or sx0 < 0 or sy1 > H or sx1 > W: continue
            if kill[sy0:sy1, sx0:sx1].any(): continue
            yy, xx = ys + dy, xs + dx
            if yy.min() < 0 or xx.min() < 0 or yy.max() >= H or xx.max() >= W: continue
            d = np.abs(A[yy, xx] - A[ys, xs]).mean()
            if best is None or d < best[0]: best = (d, dx, dy)
    d, dx, dy = best
    al = ndimage.gaussian_filter(ndimage.binary_dilation(box, iterations=4).astype(np.float32), 3)
    src = np.roll(np.roll(C, -dy, 0), -dx, 1)   # 前の箱を消した後の絵から写す
    C = C * (1 - al[..., None]) + src * al[..., None]
    print('box', b, 'from', (dx / T, dy / T), 'ring diff', round(float(d), 1))
im = Image.fromarray(np.clip(np.rint(C), 0, 255).astype(np.uint8))
im.save(os.path.join(D, m + '_clean.png'))
if '--apply' in sys.argv:
    for p in (os.path.join(OUT, m + '@32.png'), os.path.join(ASSET, m + '@32.png')): im.save(p, optimize=True)
    small = im.resize((W * 24 // 32, H * 24 // 32), Image.LANCZOS)
    for p in (os.path.join(OUT, m + '@24.png'), os.path.join(ASSET, m + '@24.png')): small.save(p, optimize=True)
    print('written', m)
