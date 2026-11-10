"""Move the exact 3D collision data onto the AI repaint.
The image model keeps the layout but rescales it slightly (about 1-2 % here), so the 3D data is warped with the
displacement field measured by match.py.  The art itself is never resampled.
usage: warp.py pts.npy out_dir(guide space: walk.png,h.npy,info.json) map_base.json stage_dir"""
import numpy as np, cv2, json, sys
from PIL import Image

def fit(pts, H, W, quiet=False):
    """affine + smooth residual field from match.py points -> DX, DY (float32, guide space) and the y scale."""
    good = pts[(pts[:, 4] > 0.35) & (pts[:, 4] - pts[:, 5] > 0.04)]
    A = lambda P: np.c_[P[:, 0], P[:, 1], np.ones(len(P))]
    co = []
    for col in (2, 3):
        g = good
        for _ in range(3):  # robust refit
            c, *_ = np.linalg.lstsq(A(g), g[:, col], rcond=None); r = good[:, col] - A(good) @ c
            g = good[np.abs(r) < max(4, 3 * np.median(np.abs(r)) * 1.48)]
        co.append(c)
    res = np.c_[good[:, 2] - A(good) @ co[0], good[:, 3] - A(good) @ co[1]]
    ok = (np.abs(res) < 8).all(axis=1)
    if not quiet:
        print('affine dx', np.round(co[0], 5), 'dy', np.round(co[1], 5), 'kept', int(ok.sum()), 'of', len(good), 'of', len(pts), 'windows;',
              'residual rms %.2f %.2f px' % tuple(np.sqrt((res[ok] ** 2).mean(axis=0))), 'p95 %.1f' % np.percentile(np.hypot(*res[ok].T), 95))
    SC = 16; gh, gw = H // SC, W // SC
    num = np.zeros((gh, gw, 2), np.float32); den = np.zeros((gh, gw), np.float32)
    for (cx, cy, *_), r in zip(good[ok], res[ok]):
        j, i = min(gh - 1, int(cy / SC)), min(gw - 1, int(cx / SC)); num[j, i] += r; den[j, i] += 1
    sg = 160 / SC
    num = cv2.GaussianBlur(num, (0, 0), sg); den = cv2.GaussianBlur(den, (0, 0), sg)[..., None]
    rf = cv2.resize(num / np.maximum(den, 1e-6), (W, H), interpolation=cv2.INTER_CUBIC)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    DX = (co[0][0] * xx + co[0][1] * yy + co[0][2] + rf[..., 0]).astype(np.float32)
    DY = (co[1][0] * xx + co[1][1] * yy + co[1][2] + rf[..., 1]).astype(np.float32)
    return DX, DY, 1 + co[1][1]

def inverse(DX, DY):
    """for every target pixel q, the guide pixel p with p + D(p) = q (maps for cv2.remap)."""
    H, W = DX.shape; yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    px, py = xx - DX, yy - DY
    for _ in range(3):
        px = xx - cv2.remap(DX, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        py = yy - cv2.remap(DY, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return px, py

if __name__ == '__main__':
    PTS, OUT, BASE, STAGE = sys.argv[1:5]
    h = np.load(f'{OUT}/h.npy'); walk = np.array(Image.open(f'{OUT}/walk.png').convert('L'))
    H, W = h.shape
    DX, DY, sy = fit(np.load(PTS), H, W)
    px, py = inverse(DX, DY)
    walk2 = cv2.remap(walk, px, py, cv2.INTER_NEAREST, borderValue=0)
    h2 = cv2.remap(h.astype(np.float32), px, py, cv2.INTER_NEAREST, borderValue=0)
    h2 = np.round(h2 * sy).astype(np.uint16)
    hp = np.zeros((H, W, 3), np.uint8); hp[..., 0] = h2 & 255; hp[..., 1] = h2 >> 8
    Image.fromarray(walk2).save(f'{STAGE}/walk.png'); Image.fromarray(hp).save(f'{STAGE}/height.png'); np.save(f'{STAGE}/h_paint.npy', h2)
    def mv(x, y):
        x, y = float(x), float(y); xi, yi = int(np.clip(round(x), 0, W - 1)), int(np.clip(round(y), 0, H - 1))
        return round(x + float(DX[yi, xi])), round(y + float(DY[yi, xi]))
    m = json.load(open(BASE))
    m['spawn']['x'], m['spawn']['y'] = mv(m['spawn']['x'], m['spawn']['y'])
    for L in m['lights']:
        if L.get('layer') == 'sky': continue
        gx, gy = mv(L.get('gx', L['x']), L.get('gy', L['y'])); x, y = mv(L['x'], L['y'])
        L['x'], L['y'] = x, y
        if 'gx' in L: L['gx'], L['gy'] = gx, gy
    for wtr in m['water']: wtr['poly'] = [list(mv(*p)) for p in wtr['poly']]
    for t in m['triggers']: t['x'], t['y'] = mv(t['x'], t['y'])
    json.dump(m, open(f'{STAGE}/map.json', 'w'), ensure_ascii=False, indent=1)
    print('spawn', m['spawn'], 'walkable there', bool(walk2[m['spawn']['y'], m['spawn']['x']]))
