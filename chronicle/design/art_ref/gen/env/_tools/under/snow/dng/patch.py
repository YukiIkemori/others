"""Copy painted patches over spots the model got wrong (e.g. a beam painted across a walkable floor).
usage: python3 patch.py <map> <src.png> <out.png> '[[sx0, sy0, sx1, sy1, dx0, dy0], ...]'   (tiles; copies src rect to dest at dx0, dy0, 3 px feather)"""
import sys, json, numpy as np
from PIL import Image
m, src, out, jobs = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
d = json.load(open(m + '/layout_data.json')); W = d['w']
A = np.asarray(Image.open(src).convert('RGB')).astype(float); k = A.shape[1] / W
B = A.copy()
for sx0, sy0, sx1, sy1, dx0, dy0 in jobs:
    X0, Y0, X1, Y1 = [int(round(v * k)) for v in (sx0, sy0, sx1, sy1)]; DX, DY = int(round(dx0 * k)), int(round(dy0 * k))
    seg = A[Y0:Y1, X0:X1]; h, w = seg.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]; F = 3
    al = np.clip(np.minimum.reduce([yy + 1, h - yy, xx + 1, w - xx]) / F, 0, 1)[..., None]
    B[DY:DY + h, DX:DX + w] = B[DY:DY + h, DX:DX + w] * (1 - al) + seg * al
Image.fromarray(np.rint(B).astype(np.uint8)).save(out); print('patched', out)
