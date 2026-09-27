"""Vertical drift of the painting vs the guide (DTW over per-row class profiles) -> warp.json [painted y for guide y] (1x px)"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
src = sys.argv[1]
W, H, T = 56, 50, 32
P = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
G = np.asarray(Image.open('guide_1x.png').convert('RGB')).astype(float)
def classes(A, guide):
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    if guide:
        face = (np.abs(r - 112) < 6) & (np.abs(g - 136) < 6) & (np.abs(b - 184) < 6)
    else:
        face = (b > r + 45) & (b > 120) & (r < 150)
    tan = (r > 140) & (r - b > 25) & (r - b < 110) & (r >= g) & (g > b)
    ice = (b > r + 30) & (g > r + 20) & (g > 150) & ~face
    grey = (np.abs(r - g) < 14) & (np.abs(g - b) < 14) & (r < 150) & (r > 60)
    wood = (r > g + 15) & (g > b) & (r < 150) & ~tan
    return np.stack([face, tan, ice, grey, wood], -1).astype(float)
def prof(A, guide):
    c = classes(A, guide); nb = 14; bw = A.shape[1] // nb
    return np.concatenate([c[:, i * bw:(i + 1) * bw].mean(1) for i in range(nb)], 1)
pp, pg = prof(P, False), prof(G, True)
pp = ndimage.uniform_filter1d(pp, 7, axis=0); pg = ndimage.uniform_filter1d(pg, 7, axis=0)
n = len(pg); BAND = 110; INF = 1e18
D = np.full((n, 2 * BAND + 1), INF)
for i in range(n):
    js = np.arange(max(0, i - BAND), min(n, i + BAND + 1))
    cst = np.abs(pg[i][None, :] - pp[js]).sum(1)
    for k, j in enumerate(js):
        jj = j - i + BAND
        if i == 0 and j == 0: D[i, jj] = cst[k]; continue
        best = INF
        if i > 0 and jj + 1 <= 2 * BAND: best = min(best, D[i - 1, jj + 1] + 0.02)
        if jj - 1 >= 0: best = min(best, D[i, jj - 1] + 0.02)
        if i > 0: best = min(best, D[i - 1, jj])
        D[i, jj] = cst[k] + best
i, jj = n - 1, BAND
path = [(i, i + jj - BAND)]
while i > 0 or jj != BAND:
    c = []
    if i > 0: c.append((D[i - 1, jj], i - 1, jj))
    if i > 0 and jj + 1 <= 2 * BAND: c.append((D[i - 1, jj + 1], i - 1, jj + 1))
    if jj - 1 >= 0 and i + jj - 1 - BAND >= 0: c.append((D[i, jj - 1], i, jj - 1))
    _, i, jj = min(c); path.append((i, i + jj - BAND))
m = np.zeros(n); cnt = np.zeros(n)
for a, b in path: m[a] += b; cnt[a] += 1
m = m / cnt
ms = ndimage.gaussian_filter1d(m - np.arange(n), 30) + np.arange(n)
ms = np.maximum.accumulate(np.clip(ms, 0, n - 1))
for y in range(0, H, 2): print(y, round((ms[y * T + 16] - (y * T + 16)), 1))
json.dump([float(v) for v in ms], open('warp.json', 'w'))
