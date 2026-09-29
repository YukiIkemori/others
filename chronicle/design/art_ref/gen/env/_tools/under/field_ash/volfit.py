"""Collision of the repainted crater (ash_volcano_2/gen1.png) straight from the painting's colours: the ledge ring and the obsidian are
cool grey / blue-black (blue >= red), the lava is inside the ring, the crater walls outside it are warm grey. Walkable = cells whose mean
(blue - red) > 1.5, closed by one step, the component reached from the stairs; enclosed rest -> lava, outer rest -> wall.
Writes layout.json rows_fit (lib chars: s ledge, k obsidian, l lava, R wall, X egg). usage: python3 volfit.py"""
import json, numpy as np
from PIL import Image
from scipy import ndimage
mid = 'ash_volcano_2'
d = json.load(open(mid + '/layout.json')); W, H, T = d['w'], d['h'], 32
A = np.asarray(Image.open(mid + '/gen1.png').convert('RGB').resize((W * T, H * T), Image.BOX)).astype(float)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
C = lambda m: m.reshape(H, T, W, T).mean((1, 3))
br = C(b - r); lum = C(A @ np.array([.299, .587, .114]))
lavaf = C(((r > 150) & (r - b > 80)).astype(float))
walk = br > 1.5
walk |= (br > -1.5) & ndimage.binary_dilation(walk) & (lavaf < 0.15)   # neutral cells joining diagonal steps of the ring
walk &= lavaf < 0.3
for (x, y) in [(x, y) for x in (21, 22, 23) for y in (32, 33, 34)]: walk[y, x] = True   # the painted stairs
walk[[0, -1], :] = False; walk[:, [0, -1]] = False
lab, n = ndimage.label(walk)
walk = lab == lab[33, 22]
inside = ndimage.binary_fill_holes(walk) & ~walk
rows = []
for y in range(H):
    s = ''
    for x in range(W):
        if walk[y, x]: s += 'k' if (lum[y, x] < 52 and br[y, x] > 6) else 's'
        elif inside[y, x]: s += 'l'
        else: s += 'R'
    rows.append(list(s))
rows[31][19] = 's'
for (x, y) in [(21, 16), (22, 16), (21, 17), (22, 17)]: rows[y][x] = 'X'
d['rows_fit'] = [''.join(q) for q in rows]
json.dump(d, open(mid + '/layout.json', 'w'), ensure_ascii=False, indent=0)
for i, q in enumerate(d['rows_fit']): print('%2d' % i, q)
