"""Local 2D alignment of a generation to its guide (the model drifts areas by up to ~1.5 tiles, differently in different parts).
Block matching (normalised cross-correlation of blurred luminance) on a grid of blocks -> smooth displacement field -> warped
generation (same size, nearest resampling so the pixels stay crisp) + mismatch report per cell.
usage: python3 align.py <map> <gen.png> <out.png> [search_tiles=1.5] [block_tiles=6]"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
m, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
SR = float(sys.argv[4]) if len(sys.argv) > 4 else 1.5
BT = int(sys.argv[5]) if len(sys.argv) > 5 else 6
d = json.load(open(m + '/layout_data.json')); W, H = d['w'], d['h']
q = 8   # analysis scale: 8 px per tile
lum = lambda a: a[..., :3] @ np.array([0.299, 0.587, 0.114])
S = Image.open(src).convert('RGB')
P = lum(np.asarray(S.resize((W * q, H * q), Image.BOX)).astype(float))
G = lum(np.asarray(Image.open(m + '/guide_1x.png').convert('RGB').resize((W * q, H * q), Image.BOX)).astype(float))
P = ndimage.gaussian_filter(P, 1.2); G = ndimage.gaussian_filter(G, 1.2)
r = int(round(SR * q)); b = BT * q; st = max(1, BT // 2) * q
cx, cy, dxs, dys, ws = [], [], [], [], []
for y0 in range(0, H * q - b + 1, st):
    for x0 in range(0, W * q - b + 1, st):
        g = G[y0:y0 + b, x0:x0 + b]
        if g.std() < 12: continue
        gz = (g - g.mean()) / g.std()
        best = (-2, 0, 0); scores = {}
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                ys, xs = y0 + dy, x0 + dx
                if ys < 0 or xs < 0 or ys + b > H * q or xs + b > W * q: continue
                p = P[ys:ys + b, xs:xs + b]
                if p.std() < 1: continue
                s = float(((p - p.mean()) / p.std() * gz).mean())
                scores[(dx, dy)] = s
                if s > best[0]: best = (s, dx, dy)
        if best[0] < 0.35: continue
        # confidence: how much the best beats the zero shift
        conf = max(0.05, best[0] - 0.5 * scores.get((0, 0), best[0]) + 0.1) * best[0]
        cx.append(x0 + b / 2); cy.append(y0 + b / 2); dxs.append(best[1]); dys.append(best[2]); ws.append(conf)
cx, cy, dxs, dys, ws = map(np.array, (cx, cy, dxs, dys, ws))
print(m, 'blocks', len(cx), 'dx', np.round(np.percentile(dxs, [5, 50, 95]) / q, 2), 'dy', np.round(np.percentile(dys, [5, 50, 95]) / q, 2))
# dense field by Gaussian-weighted interpolation (at analysis scale), then smooth
yy, xx = np.mgrid[0:H * q, 0:W * q]
sig = BT * q * 0.8
FX = np.zeros(yy.shape); FY = np.zeros(yy.shape); SW = np.zeros(yy.shape) + 1e-6
for x, y, a, c, w in zip(cx, cy, dxs, dys, ws):
    k = w * np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * sig ** 2))
    FX += k * a; FY += k * c; SW += k
FX /= SW; FY /= SW
FX = ndimage.gaussian_filter(FX, q); FY = ndimage.gaussian_filter(FY, q)
# taper to no shift at the image border (2 tiles), so the warp never pulls pixels from outside the painting
tp = np.clip(np.minimum.reduce([xx, W * q - 1 - xx, yy, H * q - 1 - yy]) / (2.0 * q), 0, 1)
FX *= tp; FY *= tp
# apply at generation scale: output pixel (X, Y) takes source pixel (X + fx, Y + fy)
A = np.asarray(S); Hs, Ws = A.shape[:2]; kx, ky = Ws / (W * q), Hs / (H * q)
fx = np.asarray(Image.fromarray(FX.astype(np.float32)).resize((Ws, Hs), Image.BILINEAR)) * kx
fy = np.asarray(Image.fromarray(FY.astype(np.float32)).resize((Ws, Hs), Image.BILINEAR)) * ky
Y, X = np.mgrid[0:Hs, 0:Ws]
sx = np.clip(np.rint(X + fx).astype(int), 0, Ws - 1); sy = np.clip(np.rint(Y + fy).astype(int), 0, Hs - 1)
Image.fromarray(A[sy, sx]).save(out)
json.dump({'fx_tiles': np.round(FX[::q, ::q] / q, 2).tolist(), 'fy_tiles': np.round(FY[::q, ::q] / q, 2).tolist()}, open(out[:-4] + '_field.json', 'w'))
print('max |shift| tiles', round(float(np.abs(FX).max() / q), 2), round(float(np.abs(FY).max() / q), 2), '->', out)
