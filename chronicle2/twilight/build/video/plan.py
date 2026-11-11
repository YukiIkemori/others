# plans an 8-direction route with few turns over the walk mask: python3 plan.py walk.png x0,y0 x1,y1 ... > legs.json
import sys, json, heapq, numpy as np
from PIL import Image
from scipy import ndimage as ndi
walk = np.array(Image.open(sys.argv[1]).convert('L')) > 127
pts = [tuple(map(int, a.split(','))) for a in sys.argv[2:]]
G = 4
dist = ndi.distance_transform_edt(walk)
H, W = walk.shape; gh, gw = H // G, W // G
dg = dist[G // 2::G, G // 2::G][:gh, :gw]
ok = dg >= 9
D8 = [(1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1),(0,-1),(1,-1)]
def plan(a, b):
    sa = (a[1] // G, a[0] // G); sb = (b[1] // G, b[0] // G)
    for s in (sa, sb):
        if not ok[s]: print('not clear', s[1]*G, s[0]*G, dg[s], file=sys.stderr)
    best = {}; pq = []
    for d in range(8): heapq.heappush(pq, (0, sa[0], sa[1], d)); best[(sa[0], sa[1], d)] = 0
    prev = {}
    while pq:
        c, y, x, d = heapq.heappop(pq)
        if best.get((y, x, d), 1e18) < c: continue
        if (y, x) == sb: end = (y, x, d); break
        for nd in (d, (d+1) % 8, (d+7) % 8, (d+2) % 8, (d+6) % 8):
            dx, dy = D8[nd]; ny, nx = y + dy, x + dx
            if not (0 <= ny < gh and 0 <= nx < gw and ok[ny, nx]): continue
            step = (1.414 if dx and dy else 1) * (1 + 6 / max(1, dg[ny, nx] - 6))
            nc = c + step + (0 if nd == d else 14)
            k = (ny, nx, nd)
            if nc < best.get(k, 1e18): best[k] = nc; prev[k] = (y, x, d); heapq.heappush(pq, (nc, ny, nx, nd))
    path = [end]
    while path[-1] in prev: path.append(prev[path[-1]])
    path = path[::-1]
    legs = []; cur = None
    for (y, x, d) in path[1:]:
        if d != cur: legs.append([d, x * G + G // 2, y * G + G // 2]); cur = d
        else: legs[-1][1:] = [x * G + G // 2, y * G + G // 2]
    return legs
out = []
for a, b in zip(pts, pts[1:]): out.append(plan(a, b))
json.dump(out, sys.stdout)
for L in out: print(len(L), 'legs', L, file=sys.stderr)
