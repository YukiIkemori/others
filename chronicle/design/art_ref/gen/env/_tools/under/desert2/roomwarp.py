"""Row + column warp for a painted K.room interior (rectangle, 2-row back wall, 1-tile side/bottom walls, optional rugs).
Finds in the painting (1x, raw): the back wall foot (floor start), the bottom wall top, the left/right wall inner edges and each rug's
top/bottom/left/right edge (red-ness), and maps the guide's edges onto them piecewise-linearly -> warp json for align.py.
usage: python3 roomwarp.py <map> <aligned_raw.png> <out.json>"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
m, src, out = sys.argv[1:4]
d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'], d['h']; T = 32; rows = d['rows']
A = np.asarray(Image.open(src).convert('RGB')).astype(float)
l = A @ np.array([0.299, 0.587, 0.114]); r, g, b = A[..., 0], A[..., 1], A[..., 2]
red = ((r - g) > 45) & ((r - b) > 45) & (g < 120)
# guide edges
fy0 = min(y for y in range(H) if 'f' in rows[y] or 'c' in rows[y]) * T; fy1 = (max(y for y in range(H - 1) if 'f' in rows[y] or 'c' in rows[y]) + 1) * T
fx0 = min(x for x in range(W) if any(rows[y][x] in 'fc' for y in range(H))) * T; fx1 = (max(x for x in range(W) if any(rows[y][x] in 'fc' for y in range(H))) + 1) * T
cy = [y for y in range(H) if 'c' in rows[y]]; cx = [x for x in range(W) if any(rows[y][x] == 'c' for y in range(H))]
# painting edges: floor = bright region in the middle columns / rows
mid = l[:, W * T // 4:W * T * 3 // 4].mean(1); midc = l[H * T // 3:H * T * 2 // 3, :].mean(0)
def edge(profile, lo, hi, rising):
    p = ndimage.gaussian_filter1d(profile, 2); dp = np.diff(p)
    seg = dp[lo:hi]; i = int(np.argmax(seg) if rising else np.argmin(seg)); return lo + i + 1
py0 = edge(mid, fy0 - 40, fy0 + 40, True); py1 = edge(mid, fy1 - 40, fy1 + 30, False)
px0 = edge(midc, max(0, fx0 - 30), fx0 + 30, True); px1 = edge(midc, fx1 - 30, min(W * T - 2, fx1 + 30), False)
gy, pyv, gx, pxv = [0, fy0, fy1, H * T - 1], [0, py0, py1, H * T - 1], [0, fx0, fx1, W * T - 1], [0, px0, px1, W * T - 1]
if cy and cx:   # rug edges: the strongest luminance steps near the guide's rug edges (the rug is darker than the floor)
    cy0, cy1, cx0, cx1 = cy[0] * T, (cy[-1] + 1) * T, cx[0] * T, (cx[-1] + 1) * T
    rp = l[:, cx0 + 8:cx1 - 8].mean(1); cp = l[cy0 + 8:cy1 - 8, :].mean(0)
    gy += [cy0, cy1]; pyv += [edge(rp, cy0 - 40, cy0 + 40, False), edge(rp, cy1 - 40, cy1 + 40, True)]
    gx += [cx0, cx1]; pxv += [edge(cp, cx0 - 40, cx0 + 40, False), edge(cp, cx1 - 40, cx1 + 40, True)]
oy = np.argsort(gy); ox = np.argsort(gx)
gy, pyv = np.array(gy)[oy], np.array(pyv)[oy]; gx, pxv = np.array(gx)[ox], np.array(pxv)[ox]
print('rows guide', gy.tolist(), '-> painted', pyv.tolist()); print('cols guide', gx.tolist(), '-> painted', pxv.tolist())
json.dump({'rows': np.interp(np.arange(H * T), gy, pyv).tolist(), 'cols': np.interp(np.arange(W * T), gx, pxv).tolist()}, open(out, 'w'))
