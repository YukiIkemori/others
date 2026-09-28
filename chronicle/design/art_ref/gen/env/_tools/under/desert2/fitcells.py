"""Per-cell 'solid-looking' fraction of an aligned painting (rock/stone: low saturation or dark; sand/dune/clay: warm saturated)
and an ascii comparison with the map's walk grid. usage: python3 fitcells.py <map> <aligned.png> [thr]
prints: '#' solid both, '.' floor both, 'X' data solid but painted floor, 'o' data floor but painted solid"""
import sys, json, numpy as np
from PIL import Image
m, src = sys.argv[1], sys.argv[2]; thr = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'], d['h']; T = 32
A = np.asarray(Image.open(src).convert('RGB')).astype(float)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
mx, mn = A.max(-1), A.min(-1); sat = (mx - mn) / np.maximum(mx, 1); l = A @ np.array([0.299, 0.587, 0.114])
warm = (r > g) & (g > b)
LT = float(__import__('os').environ.get('LT', 145)); solid = l < LT
f = solid.reshape(H, T, W, T).mean((1, 3))
json.dump(f.tolist(), open('maps/%s/solidfrac.json' % m, 'w'))
op = json.load(open('maps/%s/open.json' % m))
for y in range(H):
    s = ''
    for x in range(W):
        ds = bool(d['legend'].get(op['rows'][y][x], {'solid': True}).get('solid'))
        ps = f[y, x] >= thr
        s += '#' if ds and ps else '.' if not ds and not ps else 'X' if ds else 'o'
    print('%2d %s' % (y, s))
