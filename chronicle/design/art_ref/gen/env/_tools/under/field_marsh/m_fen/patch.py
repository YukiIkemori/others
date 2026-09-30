"""m_fen: 板の道のまん中に描かれた礼拝堂の柱の根もと（23, 16〜17。通れるのに柱に見えた）を、同じ板の道の西の板で描き直す → gen1e.png"""
import numpy as np
from PIL import Image
A = np.asarray(Image.open('gen1.png').convert('RGB')).copy()
k = A.shape[1] / (56 * 32)
X0, X1, Y0, Y1, DX = 22.3, 23.9, 16.05, 17.95, -3.0      # マスの座標（西へ 3 マスの板を写す: 板は横向きなので継ぎ目が合う）
x0, x1, y0, y1, dx = [int(round(v * 32 * k)) for v in (X0, X1, Y0, Y1, DX)]
src = A[y0:y1, x0 + dx:x1 + dx].astype(np.float32); dst = A[y0:y1, x0:x1].astype(np.float32)
h, w = dst.shape[:2]; F = max(2, int(4 * k))
yy, xx = np.mgrid[0:h, 0:w]
al = np.clip(np.minimum(xx, w - 1 - xx) / F, 0, 1)[..., None]     # 左右だけぼかす（上下は板の縁のまま）
A[y0:y1, x0:x1] = np.rint(dst * (1 - al) + src * al).astype(np.uint8)
Image.fromarray(A).save('gen1e.png')
print('ok', (x0, y0, x1, y1))
