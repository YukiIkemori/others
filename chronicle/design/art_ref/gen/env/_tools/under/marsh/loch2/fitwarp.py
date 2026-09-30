"""絵と下書きの合わせ: 水（湖・運河）の形で、縦横の拡大と平行移動を探す。out(y, x) = 絵(ay*y + by, ax*x + bx)（36 px/マス）"""
import numpy as np, json
from PIL import Image
from scipy import ndimage
A = np.asarray(Image.open('gen1.png').convert('RGB')).astype(float)
C = np.asarray(Image.open('cls_36.png'))
k = 4
wp = ((A[..., 2] > A[..., 0] + 30) & (A[..., 2] > 90))[::k, ::k].astype(float)
wg = np.isin(C, [0, 1])[::k, ::k]
m = np.ones_like(wg); m[:6] = m[-6:] = 0; m[:, :6] = m[:, -6:] = 0
res = []
for ay in np.arange(0.98, 1.08, 0.005):
    for ax in np.arange(0.97, 1.04, 0.01):
        for by in range(-14, 6):
            for bx in range(-8, 9, 2):
                o = ndimage.affine_transform(wp, [ay, ax], offset=[by, bx], order=0, mode='nearest')
                res.append((((o > 0.5) == wg)[m > 0].mean(), ay, ax, by * k, bx * k))
res.sort(reverse=True)
for r in res[:5]: print('match %.4f ay %.3f ax %.3f by %d bx %d (px @36)' % r)
json.dump(dict(ay=res[0][1], ax=res[0][2], by=res[0][3], bx=res[0][4]), open('warp.json', 'w'))
