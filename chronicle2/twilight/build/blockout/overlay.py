"""overlay.py bake_dir paint_1x.png pts.npy out.jpg : warped outline of standing things (red) and walk border (cyan) on the paint"""
import sys, numpy as np, cv2
sys.path.insert(0, '/home/user/others/chronicle2/twilight/build/blockout')
from warp import fit, inverse
from PIL import Image
OUT, PAINT, PTS, DST = sys.argv[1:5]
p = np.array(Image.open(PAINT).convert('RGB')); H, W = p.shape[:2]
DX, DY, sy = fit(np.load(PTS), H, W); px, py = inverse(DX, DY)
st = cv2.remap(np.load(f'{OUT}/standing.npy').astype(np.uint8), px, py, cv2.INTER_NEAREST) > 0
wk = cv2.remap(np.array(Image.open(f'{OUT}/walk.png').convert('L')), px, py, cv2.INTER_NEAREST) > 127
e = lambda m: m ^ cv2.erode(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
p[e(st)] = (255, 40, 40); p[e(wk)] = (40, 255, 255)
Image.fromarray(p).save(DST, quality=90)
print('scale y', sy, 'DX range', DX.min(), DX.max(), 'DY range', DY.min(), DY.max())
