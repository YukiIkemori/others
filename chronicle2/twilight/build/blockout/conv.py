"""3D bake data (geo.png, walk.png from the Blender abbey) -> the twilight engine's screen-space walk.png and height.png.
Nothing here is inferred from the painting: collision and occlusion come straight from the 3D blockout."""
import json, numpy as np, cv2, sys, os
from PIL import Image
from scipy import ndimage as ndi
SRC, OUT = 'site/px', sys.argv[1] if len(sys.argv) > 1 else 'out'
os.makedirs(OUT, exist_ok=True)
M = json.load(open(f'{SRC}/map.json'))
W, H, S, SIN, COS, X0, SY0 = M['w'], M['h'], M['scale'], M['sin'], M['cos'], M['x0'], M['sy0']
G = M['grid']; CELL, NX, NY, GX0, GY1 = G['cell'], G['nx'], G['ny'], G['x0'], G['y1']
geo = np.array(Image.open(f'{SRC}/geo.png').convert('RGB')).astype(np.float64)
z = M['zmin'] + (geo[..., 0] * 256 + geo[..., 1]) / 65535 * (M['zmax'] - M['zmin'])
kind = np.round(geo[..., 2] / 40).astype(int)
wk = np.array(Image.open(f'{SRC}/walk.png').convert('RGB')).astype(np.float64)
walk_g = wk[..., 0] > 127                                                    # row 0 = north
floor_g = M['fmin'] + (wk[..., 1] * 256 + wk[..., 2]) / 65535 * (M['fmax'] - M['fmin'])
valid = walk_g                                                               # floor heights are trusted where walkable
idx = ndi.distance_transform_edt(~valid, return_distances=False, return_indices=True)
floor_f = floor_g[idx[0], idx[1]]                                            # nearest walkable floor height everywhere
# ---- screen-space walk mask: splat every walkable ground cell at its own floor height
jj, ii = np.where(walk_g)
x = GX0 + (ii + .5) * CELL; y = GY1 - (jj + .5) * CELL; zf = floor_g[jj, ii]
sx = (x - X0) * S; sy = SY0 - (y * SIN + zf * COS) * S
walk = np.zeros((H, W), np.uint8)
hx, hy = CELL * S / 2 + .6, CELL * SIN * S / 2 + .6
for dx in np.arange(-hx, hx + .01, 1.0):
    for dy in np.arange(-hy, hy + .01, 1.0):
        px = np.round(sx + dx).astype(int); py = np.round(sy + dy).astype(int)
        ok = (px >= 0) & (px < W) & (py >= 0) & (py < H); walk[py[ok], px[ok]] = 255
# stairs: neighbouring walkable cells whose floors differ by no more than one step are joined on screen too
def splat(sxa, sya):
    for dx in np.arange(-hx, hx + .01, 1.0):
        for dy in np.arange(-hy, hy + .01, 1.0):
            px = np.round(sxa + dx).astype(int); py = np.round(sya + dy).astype(int)
            ok = (px >= 0) & (px < W) & (py >= 0) & (py < H); walk[py[ok], px[ok]] = 255
def scr_of(jj_, ii_):
    xx_ = GX0 + (ii_ + .5) * CELL; yy_ = GY1 - (jj_ + .5) * CELL; zz_ = floor_g[jj_, ii_]
    return (xx_ - X0) * S, SY0 - (yy_ * SIN + zz_ * COS) * S
for dj, di in ((1, 0), (0, 1)):
    a = walk_g[:NY - dj, :NX - di] & walk_g[dj:, di:] & (np.abs(floor_g[:NY - dj, :NX - di] - floor_g[dj:, di:]) <= M['step'] + 1e-6) & (np.abs(floor_g[:NY - dj, :NX - di] - floor_g[dj:, di:]) > 0.02)
    j1, i1 = np.where(a); ax, ay = scr_of(j1, i1); bx, by = scr_of(j1 + dj, i1 + di)
    for t in np.linspace(0, 1, 9): splat(ax * (1 - t) + bx * t, ay * (1 - t) + by * t)
walk = cv2.morphologyEx(walk, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
# ---- height above the ground-contact line, per picture pixel
syy, sxx = np.mgrid[0:H, 0:W].astype(np.float64)
wy = ((SY0 - syy) / S - z * COS) / SIN; wx = sxx / S + X0
gi = np.clip(((wx - GX0) / CELL).astype(int), 0, NX - 1); gj = np.clip(((GY1 - wy) / CELL).astype(int), 0, NY - 1)
zf_p = floor_f[gj, gi]
up = np.where(kind > 0, z - zf_p, 0)
h = np.where(up > 0.3, up * COS * S, 0)
h = np.clip(np.round(h), 0, 65535).astype(np.uint16)
hp = np.zeros((H, W, 3), np.uint8); hp[..., 0] = h & 255; hp[..., 1] = h >> 8
n_, lab_, st_, _c = cv2.connectedComponentsWithStats((walk == 0).astype(np.uint8), connectivity=4)
filled = 0
for i_ in range(1, n_):
    x_, y_, w_, h_, a_ = st_[i_]
    if a_ > 1500 or x_ == 0 or y_ == 0 or x_ + w_ >= W or y_ + h_ >= H: continue
    comp = lab_[y_:y_ + h_, x_:x_ + w_] == i_
    if (h[y_:y_ + h_, x_:x_ + w_][comp] > 0).mean() < 0.1 and (kind[y_:y_ + h_, x_:x_ + w_][comp] == 1).mean() > 0.8:
        walk[y_:y_ + h_, x_:x_ + w_][comp] = 255; filled += 1
print('blocked islands with nothing standing on them, opened:', filled)
Image.fromarray(walk).save(f'{OUT}/walk.png')
Image.fromarray(hp).save(f'{OUT}/height.png'); np.save(f'{OUT}/h.npy', h); np.save(f'{OUT}/walk.npy', walk > 0)
def scr(xw, yw):
    i, j = int((xw - GX0) / CELL), int((GY1 - yw) / CELL); zz = float(floor_f[j, i])
    return [round((xw - X0) * S), round(SY0 - (yw * SIN + zz * COS) * S)]
info = dict(spawn=scr(*M['spawn']), pool=scr(*M['pool']), exits=[dict(id=e['id'], label=e['label'], p=scr(e['x'], e['y'])) for e in M['exits']])
json.dump(info, open(f'{OUT}/info.json', 'w'), ensure_ascii=False)
print(info, 'walk px', int((walk > 0).sum()), 'standing px', int((h > 0).sum()), 'kinds', np.unique(kind).tolist())
