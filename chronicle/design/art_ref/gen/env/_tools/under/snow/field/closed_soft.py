"""Snow field: rebuild the closed layer (<id>_closed) of a water tilePatch with an organic edge (after ../../field/process.py).
process.py closes a patch cell by cell (whole 32 px squares of cloned water), so a painted ice road that does not follow the tile grid
shows a stair-stepped dark strip with bits of the ice left beside it. Here the closed look is the painted ice itself: the pale ice strip
around the patch cells (connected, cleaned of drifting plates) is masked pixel by pixel and filled with the lake water beside it.
usage: python3 closed_soft.py <id>   (no water patch -> nothing to do)"""
import json, sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

V2 = '/home/user/others/chronicle/v2'
OUT = os.path.join(V2, 'assets/env/field/under')
aid = sys.argv[1]; T = 32
d = json.load(open(aid + '/layout.json'))
pats = d['meta'].get('tilePatches', [])
J = json.load(open(os.path.join(OUT, aid + '.json')))
if not J.get('live') or not any(set(''.join(p['rows'])) & set('~w') for p in pats):
    print(aid, 'no water patch'); sys.exit(0)
A = np.asarray(Image.open(os.path.join(OUT, aid + '@32.png')).convert('RGB')).astype(np.int32)
Hp, Wp = A.shape[:2]
lum = A.mean(-1)
icy = (lum > 118) & (A[..., 2] >= A[..., 0])          # pale blue-white ice (the dark water and its plates' shadows are below)
live = []
CL = np.zeros((Hp, Wp, 4), np.uint8)
for pi, p in enumerate(pats):
    px, py = p['rect'][:2]
    cells = [(px + dx, py + dy) for dy, r in enumerate(p['rows']) for dx, c in enumerate(r) if c in '~w']
    if not cells: continue
    # the painted strip: ice pixels connected to the patch cells' centres, within 2 tiles of them
    near = np.zeros((Hp, Wp), bool)
    for x, y in cells: near[max(0, y * T - T // 2):(y + 1) * T + T // 2, max(0, (x - 2) * T):(x + 3) * T] = True
    ice = ndimage.binary_opening(icy & near, np.ones((5, 5)))          # drop the small drifting plates
    lab, n = ndimage.label(ice)
    keep = set()
    for x, y in cells:
        sub = lab[y * T:(y + 1) * T, x * T:(x + 1) * T]
        keep |= set(np.unique(sub[sub > 0]).tolist())
    m = np.isin(lab, list(keep))
    # the strip as one solid band per pixel row (fills the cracks), grown a little over its white rim
    band = np.zeros_like(m)
    ys = np.nonzero(m.any(1))[0]
    for yy in ys:
        xs = np.nonzero(m[yy])[0]
        # the longest run of ice columns in this row (gaps up to 6 px bridged)
        runs, s0 = [], xs[0]
        for a, b in zip(xs[:-1], xs[1:]):
            if b - a > 6: runs.append((s0, a)); s0 = b
        runs.append((s0, xs[-1]))
        a, b = max(runs, key=lambda r: r[1] - r[0])
        band[yy, a:b + 1] = True
    band = ndimage.binary_closing(band, np.ones((9, 3)))
    band = ndimage.binary_dilation(band, np.ones((9, 25)))   # over the white rim on both sides
    # only the rows the patch closes: the strip's end on the shore stays (a stub of shore ice)
    y0, y1 = min(y for _, y in cells) * T, (max(y for _, y in cells) + 1) * T
    band[:y0] = False; band[y1:] = False
    # the strip's end: in the last tile the ice comes out of the water as a rounded tip (0 wide at its top, full width at the patch's end)
    for k in range(T):
        yy = y1 - T + k; xs = np.nonzero(m[yy])[0] if m[yy].any() else np.nonzero(band[yy])[0]
        if not len(xs): continue
        c, hw = (xs[0] + xs[-1]) / 2, (xs[-1] - xs[0]) / 2 + 2
        w = hw * np.sqrt(k / (T - 1))
        band[yy, max(0, int(round(c - w))):int(round(c + w)) + 1] = False
    # fill: the lake beside the strip (4 tiles to the side where it is water), pixel for pixel
    #   one shift for the whole strip (row by row shifts would shear the plates into streaks)
    F = A.copy(); by, bx = np.nonzero(band)
    def bad(sh):
        sx = bx + sh
        if sx.min() < 0 or sx.max() >= Wp: return 9.0
        return float((icy[by, sx] & ~ndimage.binary_opening(icy, np.ones((5, 5)))[by, sx]).mean() + 3 * band[by, sx].mean() + (lum[by, sx] > 170).mean())
    sh = min((-5 * T, 5 * T, -4 * T, 4 * T, -6 * T, 6 * T, -3 * T, 3 * T), key=bad)
    F[by, bx] = A[by, bx + sh]
    CL[band, :3] = F[band]; CL[band, 3] = 255
    cl = sorted({(int(x) // T, int(y) // T) for y, x in zip(*np.nonzero(band))}, key=lambda q: (q[1], q[0]))
    live.append({'cells': [[x, y] for x, y in cl], 'cond': {'not': p['cond']}})
    print(aid, 'patch', pi, 'px', int(band.sum()), 'cells', len(cl))

im = Image.fromarray(CL, 'RGBA')
for f in os.listdir(OUT):
    if f.startswith(aid + '_closed@') and f.endswith('.png'):
        t = int(f.split('@')[1][:-4])
        (im if t == 32 else im.resize((Wp * t // T, Hp * t // T), Image.NEAREST)).save(os.path.join(OUT, f), optimize=True)
J['live'] = live
json.dump(J, open(os.path.join(OUT, aid + '.json'), 'w'), indent=1)
