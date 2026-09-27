"""Estimate the vertical drift of a painting against the guide (DTW over per-row class profiles) -> warp.json [painted 1x row for each guide 1x row].
Adapted from ../fern/rowwarp.py with desert classes (dune orange, pale sand, red clay lane, grey paving). usage: python3 rowwarp.py <gen.png> [out.json]"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'warp.json'
d = json.load(open('layout_data.json')); W, H = d['w'], d['h']; T = 32
P = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
G = np.asarray(Image.open('guide_1x.png').convert('RGB')).astype(float)
def classes(A):
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    sat = (np.max(A, -1) - np.min(A, -1))
    dune = (r > 195) & (g > 115) & (g < 185) & (b < 110) & (r - g > 45)
    lane = (r > 120) & (r < 215) & (g < 130) & (b < 100) & (r - g > 45) & ~dune
    pave = (sat < 45) & (r > 160)
    sand = (r > 180) & (g > 150) & (b > 90) & (r - b > 45) & ~dune & ~pave
    green = (g > r) & (g > b)
    return np.stack([dune, lane, pave, sand, green], -1).astype(float)
def prof(A):
    c = classes(A)
    nb = 16; bw = A.shape[1] // nb
    return np.concatenate([c[:, i * bw:(i + 1) * bw].mean(1) for i in range(nb)], 1)
pp, pg = prof(P), prof(G)
pp = ndimage.uniform_filter1d(pp, 5, axis=0); pg = ndimage.uniform_filter1d(pg, 5, axis=0)
n = len(pg); BAND = 90
INF = 1e18
D = np.full((n, 2 * BAND + 1), INF)
for i in range(n):
    for jj in range(2 * BAND + 1):
        j = i + jj - BAND
        if j < 0 or j >= n: continue
        c = np.abs(pg[i] - pp[j]).sum()
        if i == 0 and j == 0: D[i, jj] = c; continue
        best = INF
        if i > 0 and jj + 1 <= 2 * BAND: best = min(best, D[i - 1, jj + 1])
        if jj - 1 >= 0: best = min(best, D[i, jj - 1])
        if i > 0: best = min(best, D[i - 1, jj])
        D[i, jj] = c + best
i, jj = n - 1, BAND
path = [(i, i + jj - BAND)]
while i > 0 or jj != BAND:
    cands = []
    if i > 0: cands.append((D[i - 1, jj], i - 1, jj))
    if i > 0 and jj + 1 <= 2 * BAND: cands.append((D[i - 1, jj + 1], i - 1, jj + 1))
    if jj - 1 >= 0 and i + jj - 1 - BAND >= 0: cands.append((D[i, jj - 1], i, jj - 1))
    _, i, jj = min(cands)
    path.append((i, i + jj - BAND))
path = path[::-1]
m = np.zeros(n); cnt = np.zeros(n)
for a, b in path: m[a] += b; cnt[a] += 1
m = m / cnt
ms = ndimage.gaussian_filter1d(m - np.arange(n), 40) + np.arange(n)
ms = np.maximum.accumulate(ms)
for y in range(0, H, 2): print(y, round((ms[y * T + 16] - (y * T + 16)) / T, 2), end='  ')
print()
json.dump([float(v) for v in ms], open(out, 'w'))
