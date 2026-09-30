"""沼の絵の前処理 → gen1p.png（32 px/マス、1920x1664）:
- 縦のずれ: 描いた絵は下書きより 16 px（34 px/マス）上 → 15 px 下げる（上の端は葦原を写して埋める）
- 水の色: 描いた沼の水が小島と同じ暗い緑で、歩ける所と見分けにくい → 下書きの水の所（岸を半マス広げた中）で、暗い緑の画素を青緑へ寄せる（淵・板・泥炭は変えない）"""
import numpy as np
from PIL import Image
from scipy import ndimage
W, H, T = 60, 52, 32
A = np.asarray(Image.open('gen1.png').convert('RGB').resize((W * T, H * T), Image.BOX)).astype(np.float32)
DY = 15
A = np.concatenate([A[:DY][::-1], A[:-DY]], 0)
C = np.asarray(Image.fromarray(np.asarray(Image.open('cls_34.png'))).resize((W * T, H * T), Image.NEAREST))
water = ndimage.binary_dilation(C == 0, iterations=T // 2)
L = A.mean(2)
pix = water & (L < 58) & (A[..., 2] < A[..., 1]) & (A[..., 0] < A[..., 1] + 12)
m = ndimage.gaussian_filter(pix.astype(np.float32), 2.0)[..., None] * 0.85
tint = np.clip(A * np.array([0.8, 1.08, 1.6], np.float32) + np.array([0, 2, 4], np.float32), 0, 255)
A = A * (1 - m) + tint * m
Image.fromarray(np.rint(np.clip(A, 0, 255)).astype(np.uint8)).save('gen1p.png')
print('ok water px', int(pix.sum()))
