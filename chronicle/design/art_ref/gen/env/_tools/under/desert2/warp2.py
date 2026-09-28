"""Separable row/column warp of a painting onto its guide (DTW over per-row / per-column class profiles; desert dungeon classes).
usage: python3 warp2.py <map> <gen.png> [out.json]  -> {'rows': [painted 1x y for each guide 1x y], 'cols': [...]} (1x = tile 32)
classes: floor (light), wall top (dark), face (mid warm) -- measured on the painting and on guide_1x.png."""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
m, src = sys.argv[1], sys.argv[2]; out = sys.argv[3] if len(sys.argv) > 3 else 'maps/%s/warp.json' % m
d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'], d['h']; T = 32
P = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
G = np.asarray(Image.open('maps/%s/guide_1x.png' % m).convert('RGB')).astype(float)
def classes(A):
    l = A @ np.array([0.299, 0.587, 0.114])
    # per-image thresholds: dark = lowest ~, floor = brightest
    lo, hi = np.percentile(l, 25), np.percentile(l, 75)
    t1 = np.percentile(l, 100 * float(np.mean(G_dark))) if False else None
    return l
lg = G @ np.array([0.299, 0.587, 0.114]); lp = P @ np.array([0.299, 0.587, 0.114])
# guide: dark = solid top (lum < 80), floor = walkable colours; painting: match the dark fraction by quantile
fd = float((lg < 80).mean())
td = np.quantile(lp, fd)
dg, dp = (lg < 80).astype(float), (lp < td).astype(float)
def prof(M, axis, nb=16):
    if axis == 0:   # rows: profile over column bands
        bw = M.shape[1] // nb; return np.stack([M[:, i * bw:(i + 1) * bw].mean(1) for i in range(nb)], 1)
    bh = M.shape[0] // nb; return np.stack([M[i * bh:(i + 1) * bh, :].mean(0) for i in range(nb)], 1)
def dtw(pg, pp, BAND=70):
    pg = ndimage.uniform_filter1d(pg, 5, axis=0); pp = ndimage.uniform_filter1d(pp, 5, axis=0)
    n = len(pg); INF = 1e18; D = np.full((n, 2 * BAND + 1), INF)
    for i in range(n):
        for jj in range(2 * BAND + 1):
            j = i + jj - BAND
            if j < 0 or j >= n: continue
            c = np.abs(pg[i] - pp[j]).sum()
            if i == 0 and j == 0: D[i, jj] = c; continue
            b = INF
            if i > 0 and jj + 1 <= 2 * BAND: b = min(b, D[i - 1, jj + 1])
            if jj - 1 >= 0: b = min(b, D[i, jj - 1])
            if i > 0: b = min(b, D[i - 1, jj])
            D[i, jj] = c + b
    i, jj = n - 1, BAND; path = [(i, i)]
    while i > 0 or jj != BAND:
        c = []
        if i > 0: c.append((D[i - 1, jj], i - 1, jj))
        if i > 0 and jj + 1 <= 2 * BAND: c.append((D[i - 1, jj + 1], i - 1, jj + 1))
        if jj - 1 >= 0 and i + jj - 1 - BAND >= 0: c.append((D[i, jj - 1], i, jj - 1))
        _, i, jj = min(c); path.append((i, i + jj - BAND))
    mm = np.zeros(n); cnt = np.zeros(n)
    for a, b in path: mm[a] += b; cnt[a] += 1
    mm = mm / cnt
    ms = ndimage.gaussian_filter1d(mm - np.arange(n), 30) + np.arange(n)
    return np.maximum.accumulate(ms)
rows = dtw(prof(dg, 0), prof(dp, 0)); cols = dtw(prof(dg, 1), prof(dp, 1))
print('rows (tiles):', ' '.join('%d:%+.2f' % (y, (rows[y * T + 16] - y * T - 16) / T) for y in range(0, H, 3)))
print('cols (tiles):', ' '.join('%d:%+.2f' % (x, (cols[x * T + 16] - x * T - 16) / T) for x in range(0, W, 3)))
json.dump({'rows': [float(v) for v in rows], 'cols': [float(v) for v in cols]}, open(out, 'w'))
