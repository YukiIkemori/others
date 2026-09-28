"""Local alignment (block matching of floor masks) of a 1x painting onto the guide's walkable grid -> smooth displacement field.
usage: python3 flow.py <map> <img@32 (already coarse-warped)> [out.npz]
The painting floor mask is a luminance/colour threshold whose area matches the guide's floor area; each control point (every 32 px)
takes the shift (±MAXS px) that best matches a 7x7-tile window; the field is median- and gaussian-smoothed."""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
m, src = sys.argv[1], sys.argv[2]; out = sys.argv[3] if len(sys.argv) > 3 else 'maps/%s/flow.npz' % m
d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'], d['h']; T = 32
o = json.load(open('maps/%s/open.json' % m))
floor = np.array([[not (d['legend'].get(o['rows'][y][x], {'solid': True}).get('solid')) for x in range(W)] for y in range(H)], float)
# face cells count as non-floor already (they are solid); guide mask at 1x
G = np.kron(floor, np.ones((T, T)))
A = np.asarray(Image.open(src).convert('RGB')).astype(float)
l = A @ np.array([0.299, 0.587, 0.114])
MODE = os.environ.get('MASK', 'lum')
thr = np.quantile(l, 1 - G.mean())
P = (l >= thr).astype(float)
P = ndimage.binary_opening(ndimage.binary_closing(P, iterations=2), iterations=2).astype(float)
MAXS = int(os.environ.get('MAXS', 24)); WIN = int(os.environ.get('WIN', 7)) * T // 2; STEP = T
Gs = ndimage.gaussian_filter(G, 2); Ps = ndimage.gaussian_filter(P, 2)
ys = np.arange(STEP // 2, H * T, STEP); xs = np.arange(STEP // 2, W * T, STEP)
dx = np.zeros((len(ys), len(xs))); dy = np.zeros_like(dx); conf = np.zeros_like(dx)
shifts = [(sy, sx) for sy in range(-MAXS, MAXS + 1, 2) for sx in range(-MAXS, MAXS + 1, 2)]
Pp = np.pad(Ps, MAXS + WIN, mode='edge'); Gp = np.pad(Gs, WIN, mode='edge')
for i, y in enumerate(ys):
    for j, x in enumerate(xs):
        g = Gp[y:y + 2 * WIN, x:x + 2 * WIN]
        if g.std() < 0.05: continue   # uniform window: no information
        best, bs, errs = 1e18, (0, 0), []
        for sy, sx in shifts:
            p = Pp[y + MAXS + sy:y + MAXS + sy + 2 * WIN, x + MAXS + sx:x + MAXS + sx + 2 * WIN]
            e = np.abs(p - g).mean() + 0.0004 * (sy * sy + sx * sx) ** 0.5
            errs.append(e)
            if e < best: best, bs = e, (sy, sx)
        dy[i, j], dx[i, j] = bs; conf[i, j] = np.median(errs) - best
# fill no-information points from neighbours, smooth
mask = conf > 0.01
for F in (dx, dy):
    F[~mask] = np.nan
    idx = ndimage.distance_transform_edt(np.isnan(F), return_distances=False, return_indices=True)
    F[:] = F[tuple(idx)]
dx = ndimage.gaussian_filter(ndimage.median_filter(dx, 3), 1.2); dy = ndimage.gaussian_filter(ndimage.median_filter(dy, 3), 1.2)
print('flow px: dx %.1f..%.1f  dy %.1f..%.1f  (mean |d| %.1f)' % (dx.min(), dx.max(), dy.min(), dy.max(), np.hypot(dx, dy).mean()))
np.savez(out, dx=dx, dy=dy, ys=ys, xs=xs)
# score: floor mask agreement before / after
def warp(M, dx, dy):
    YY, XX = np.mgrid[0:H * T, 0:W * T].astype(float)
    fdx = ndimage.map_coordinates(dx, [(YY - STEP // 2) / STEP, (XX - STEP // 2) / STEP], order=1, mode='nearest')
    fdy = ndimage.map_coordinates(dy, [(YY - STEP // 2) / STEP, (XX - STEP // 2) / STEP], order=1, mode='nearest')
    return ndimage.map_coordinates(M, [YY + fdy, XX + fdx], order=1, mode='nearest')
Pw = warp(P, dx, dy)
print('mask mismatch before %.3f after %.3f' % (np.abs(P - G).mean(), np.abs((Pw > 0.5) - G).mean()))
