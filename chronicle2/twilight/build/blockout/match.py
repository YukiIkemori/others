"""Dense registration between the 3D guide render and the AI repaint.
Finds, for a grid of windows in the guide, where the same structure sits in the paint (NCC on two
style-independent feature maps), then fits a smooth displacement field.  field[y,x] = (dx,dy) such that
guide pixel (x,y) appears in the paint at (x+dx, y+dy)."""
import numpy as np, cv2, sys, json
from PIL import Image
G = sys.argv[1]; P = sys.argv[2]; OUT = sys.argv[3]
WIN = int(sys.argv[4]) if len(sys.argv) > 4 else 160; STEP = WIN // 2; R = 56
g = cv2.imread(G).astype(np.float32); p = cv2.imread(P).astype(np.float32)
H, W = g.shape[:2]
def key(im):  # magenta mask
    return (im[..., 2] > 180) & (im[..., 0] > 180) & (im[..., 1] < 110)
def feats(im):
    k = key(im)
    lum = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
    lum[k] = 0
    b = cv2.GaussianBlur(lum, (0, 0), 3)
    # local contrast normalisation: removes the global tone difference between render and paint
    mu = cv2.GaussianBlur(b, (0, 0), 24); sd = np.sqrt(cv2.GaussianBlur((b - mu) ** 2, (0, 0), 24)) + 4
    f1 = (b - mu) / sd
    gx = cv2.Sobel(b, cv2.CV_32F, 1, 0); gy = cv2.Sobel(b, cv2.CV_32F, 0, 1)
    f2 = cv2.GaussianBlur(np.sqrt(gx * gx + gy * gy), (0, 0), 2)
    f2 = f2 / (cv2.GaussianBlur(f2, (0, 0), 32) + 2)
    return f1, f2
fg = feats(g); fp = feats(p)
pts = []
for cy in range(WIN // 2, H - WIN // 2 + 1, STEP):
    for cx in range(WIN // 2, W - WIN // 2 + 1, STEP):
        y0, x0 = cy - WIN // 2, cx - WIN // 2
        if key(g[y0:y0 + WIN, x0:x0 + WIN]).mean() > 0.6: continue
        sy0, sx0 = max(0, y0 - R), max(0, x0 - R); sy1, sx1 = min(H, y0 + WIN + R), min(W, x0 + WIN + R)
        acc = None
        for a, b in zip(fg, fp):
            t = a[y0:y0 + WIN, x0:x0 + WIN]
            if t.std() < 1e-3: continue
            r = cv2.matchTemplate(b[sy0:sy1, sx0:sx1], t, cv2.TM_CCOEFF_NORMED)
            acc = r if acc is None else acc + r
        if acc is None: continue
        acc /= 2
        _, mx, _, loc = cv2.minMaxLoc(acc)
        dx = loc[0] + sx0 - x0; dy = loc[1] + sy0 - y0
        # second peak outside a 12 px neighbourhood
        a2 = acc.copy(); cv2.circle(a2, loc, 14, -1, -1); m2 = float(a2.max())
        pts.append((cx, cy, dx, dy, float(mx), m2))
pts = np.array(pts)
np.save(OUT, pts)
good = pts[(pts[:, 4] > 0.35) & (pts[:, 4] - pts[:, 5] > 0.04)]
print('windows', len(pts), 'good', len(good))
print('score median', np.median(pts[:, 4]))
for nm, a in (('dx', good[:, 2]), ('dy', good[:, 3])):
    print(nm, 'median %.1f p10 %.1f p90 %.1f min %.0f max %.0f' % (np.median(a), np.percentile(a, 10), np.percentile(a, 90), a.min(), a.max()))
# affine fit
A = np.c_[good[:, 0], good[:, 1], np.ones(len(good))]
for nm, col in (('dx', 2), ('dy', 3)):
    co, *_ = np.linalg.lstsq(A, good[:, col], rcond=None); res = good[:, col] - A @ co
    print(nm, 'affine', np.round(co, 4), 'residual rms %.1f' % np.sqrt((res ** 2).mean()))
