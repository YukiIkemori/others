"""Turns the Blender render and the baked data into the files the game loads.

  site/map.png    the field, finished as pixel art: mist in the low ground, dusk colours, a limited palette
  site/sky.png    the view beyond the cliff: both moons, drawn here
  site/geo.png    per pixel: height (R,G = 16 bit) and what kind of thing it is (B)
  site/nrm.png    per pixel: which way the surface faces
  site/alb.png    per pixel: the surface's own colour
  site/walk.png   ground grid: walkable (R) and floor height (G,B = 16 bit)
  site/front.png  pixels that can end up in front of someone standing on the floor (only for the check overlay)
  site/map.json   camera numbers, start, exits, lights
"""
import os, json, math, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get('WORK', os.path.join(HERE, 'work'))
SITE = os.environ.get('SITE', os.path.join(HERE, '..', 'site'))
os.makedirs(SITE, exist_ok=True)
NCOL = int(os.environ.get('NCOL', '72'))

meta = json.load(open(os.path.join(WORK, 'meta.json')))
S, SIN, COS, W, H, X0, SY0 = meta['scale'], meta['sin'], meta['cos'], meta['w'], meta['h'], meta['x0'], meta['sy0']
bk = np.load(os.path.join(WORK, 'bake.npz'))
zmap, nrm, alb, kind, floor, walk = bk['zmap'], bk['nrm'], bk['alb'], bk['kind'], bk['floor'], bk['walk']
GX0, GY0, CELL, NX, NY = bk['grid']
NX, NY = int(NX), int(NY)

im = np.asarray(Image.open(os.path.join(WORK, 'beauty.png')).convert('RGBA')).astype(np.float32) / 255.0
rgb, a = im[..., :3].copy(), im[..., 3].copy()
hit = ~np.isnan(zmap)
z = np.where(hit, zmap, 0.0)
jj, ii = np.mgrid[0:H, 0:W].astype(np.float32)
wx = X0 + (ii + 0.5) / S
wy = ((SY0 - (jj + 0.5)) / S - z * COS) / SIN
depth = wy * COS - z * SIN


def hash01(a_, b_, seed=0.0):
    h = np.sin(a_ * 127.1 + b_ * 311.7 + seed * 74.7) * 43758.5453
    return h - np.floor(h)


def vnoise(x, y, scale, seed=0.0):
    xs, ys = x / scale, y / scale
    xi, yi = np.floor(xs), np.floor(ys)
    fx, fy = xs - xi, ys - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    l = lambda p, q, t: p + (q - p) * t
    return l(l(hash01(xi, yi, seed), hash01(xi + 1, yi, seed), fx), l(hash01(xi, yi + 1, seed), hash01(xi + 1, yi + 1, seed), fx), fy)


def fbm(x, y, scale, seed=0.0):
    return 0.55 * vnoise(x, y, scale, seed) + 0.3 * vnoise(x, y, scale / 2.1, seed + 1) + 0.15 * vnoise(x, y, scale / 4.3, seed + 2)


def blur(arr, r):
    if arr.ndim == 2:
        return np.asarray(Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255
    return np.stack([blur(arr[..., k], r) for k in range(arr.shape[-1])], -1)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- 1. mist
# Mist lies in the low ground: thin and patchy on the hilltop, thick on the slopes that fall away.
n = fbm(wx, wy * 1.25, 7.0, 3.0)
patch = smooth(0.38, 0.72, n)
low = np.clip((1.0 - z) / 1.5, 0, 1) * (0.10 + 0.9 * patch) * 0.34
slope = np.clip((-0.5 - z) / 4.6, 0, 1) ** 0.75 * 0.93
flank = smooth(27.2, 31.0, np.abs(wx)) * np.clip((4.0 - z) / 6.0, 0, 1) * 0.55
fog = np.clip(np.maximum(low, np.maximum(slope, flank)), 0, 0.94) * hit
fog[kind == 0] = 0
FOG = np.array([0.52, 0.40, 0.54], np.float32)
FOG_WARM = np.array([0.74, 0.52, 0.50], np.float32)
fc = FOG + (FOG_WARM - FOG) * smooth(0.3, 0.9, fbm(wx, wy, 13.0, 8.0))[..., None] * 0.6
rgb = rgb * (1 - fog[..., None]) + fc * fog[..., None]

# ---------------------------------------------------------------- 2. glow around flames and glass
lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
hot = np.clip((lum - 0.80) * 4.0, 0, 1)[..., None] * rgb
glow = blur(hot, 2.2) * 0.55 + blur(hot, 6.0) * 0.5
rgb = 1 - (1 - rgb) * (1 - np.clip(glow, 0, 1) * np.array([1.0, 0.82, 0.6], np.float32))

# ---------------------------------------------------------------- 3. dusk grade: shadows to indigo, lights to amber
lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
SH = np.array([0.150, 0.120, 0.245], np.float32)
HI = np.array([1.0, 0.86, 0.66], np.float32)
rgb = rgb + (SH - rgb) * 0.30 * (1 - lum) ** 2.2
rgb = rgb + (HI - rgb) * 0.16 * lum ** 2
# pull the greens toward the stone so the grass sits in the same evening
g = rgb[..., 1]
exc = np.clip(g - np.maximum(rgb[..., 0], rgb[..., 2]), 0, 1)
rgb[..., 1] = g - exc * 0.42
rgb[..., 0] += exc * 0.10
rgb[..., 2] += exc * 0.16
# contrast
rgb = np.clip(rgb, 0, 1)
rgb = rgb * rgb * (3 - 2 * rgb) * 0.55 + rgb * 0.45
mean = rgb.mean(-1, keepdims=True)
rgb = np.clip(mean + (rgb - mean) * 1.14, 0, 1)
rgb = rgb ** 0.86            # lift the middle so the dark side of things stays readable in play

# ---------------------------------------------------------------- 4. a darker line where a nearer thing ends
d = np.where(hit, depth, 1e3)
far = np.zeros((H, W), np.float32)
for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
    nb = np.roll(d, (dy, dx), (0, 1))
    far = np.maximum(far, np.clip((nb - d - 0.55) / 0.6, 0, 1))
far[(kind == 3) | (kind == 0)] *= 0.25
far *= (1 - fog) ** 2
rgb = rgb * (1 - 0.34 * far[..., None]) + SH * 0.5 * 0.34 * far[..., None]

# ---------------------------------------------------------------- 5. limited palette
def to_lab(c):
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = 0.4122214708 * c[..., 0] + 0.5363325363 * c[..., 1] + 0.0514459929 * c[..., 2]
    m = 0.2119034982 * c[..., 0] + 0.6806995451 * c[..., 1] + 0.1073969566 * c[..., 2]
    s = 0.0883024619 * c[..., 0] + 0.2817188376 * c[..., 1] + 0.6299787005 * c[..., 2]
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


opaque = a > 0.35
lab = to_lab(rgb)
# a whisper of ordered dither so slow gradients break into pixels instead of bands
bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16 - 0.47
lab[..., 0] += np.tile(bayer, (H // 4 + 1, W // 4 + 1))[:H, :W] * 0.012
rng = np.random.default_rng(1)
px = lab[opaque]
pc = rgb[opaque]
sel = rng.choice(len(px), min(len(px), 90000), replace=False)
samp = px[sel]
# k-means++ style start, then Lloyd
cent = [samp[rng.integers(len(samp))]]
d2 = ((samp - cent[0]) ** 2).sum(1)
for k in range(NCOL - 1):
    cent.append(samp[rng.choice(len(samp), p=d2 / d2.sum())])
    d2 = np.minimum(d2, ((samp - cent[-1]) ** 2).sum(1))
cent = np.array(cent)
def assign(p):
    out = np.empty(len(p), np.int32)
    for s0 in range(0, len(p), 200000):
        q = p[s0:s0 + 200000]
        out[s0:s0 + 200000] = ((q[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
    return out
for it in range(14):
    lbl = assign(samp)
    for k in range(NCOL):
        m = lbl == k
        if m.any():
            cent[k] = samp[m].mean(0)
lbl = assign(px)
pal = np.zeros((NCOL, 3), np.float32)
for k in range(NCOL):
    m = lbl == k
    if m.any():
        pal[k] = pc[m].mean(0)
out = np.zeros((H, W, 4), np.uint8)
q = np.zeros((H, W, 3), np.float32)
q[opaque] = pal[lbl]
out[..., :3] = (np.clip(q, 0, 1) * 255 + 0.5).astype(np.uint8)
out[..., 3] = np.where(opaque, 255, 0)
# saved with its palette (the last entry is "nothing here"), which keeps the file small
idx = np.full((H, W), NCOL, np.uint8)
idx[opaque] = lbl
pim = Image.fromarray(idx, 'P')
pim.putpalette([int(v) for v in (np.clip(pal, 0, 1) * 255 + 0.5).astype(np.uint8).ravel()] + [0, 0, 0])
pim.save(os.path.join(SITE, 'map.png'), optimize=True, transparency=bytes([255] * NCOL + [0]))
Image.fromarray((np.clip(pal, 0, 1) * 255).astype(np.uint8)[None].repeat(12, 0).repeat(12, 1)).save(os.path.join(WORK, 'palette.png'))

# ---------------------------------------------------------------- data images
ZMIN, ZMAX = -14.0, 42.0
zq = np.clip((z - ZMIN) / (ZMAX - ZMIN) * 65535, 0, 65535).astype(np.uint32)
k2 = np.where(opaque, kind, 0).astype(np.uint8)
geo = np.stack([(zq >> 8).astype(np.uint8), (zq & 255).astype(np.uint8), k2 * 40], -1)
geo[k2 == 0] = 0
Image.fromarray(geo, 'RGB').save(os.path.join(SITE, 'geo.png'), optimize=True)
nq = np.clip(nrm * 127 + 128, 0, 255).astype(np.uint8)
nq[k2 == 0] = 128
Image.fromarray(nq, 'RGB').save(os.path.join(SITE, 'nrm.png'), optimize=True)
al = np.clip(alb, 0, 1)
al = np.where(al <= 0.0031308, al * 12.92, 1.055 * al ** (1 / 2.4) - 0.055)
aq = (np.round(al * 255 / 8) * 8).clip(0, 255).astype(np.uint8)
aq[k2 == 0] = 0
Image.fromarray(aq, 'RGB').save(os.path.join(SITE, 'alb.png'), optimize=True)
FMIN, FMAX = -14.0, 18.0
fq = np.clip((np.nan_to_num(floor, nan=FMIN) - FMIN) / (FMAX - FMIN) * 65535, 0, 65535).astype(np.uint32)
wk = np.stack([np.where(walk, 255, 0).astype(np.uint8), (fq >> 8).astype(np.uint8), (fq & 255).astype(np.uint8)], -1)
Image.fromarray(wk[::-1].copy(), 'RGB').save(os.path.join(SITE, 'walk.png'), optimize=True)   # row 0 = north

def scr(x, y, zz):
    return [round((x - X0) * S, 1), round(SY0 - (y * SIN + zz * COS) * S, 1)]
def floor_at(x, y):
    i, j = int((x - GX0) / CELL), int((y - GY0) / CELL)
    v = floor[j, i]
    return 0.0 if np.isnan(v) else float(v)
for e in meta['exits']:
    e['z'] = round(floor_at(e['x'], e['y']), 2)
for l in meta['lights']:
    l['sx'], l['sy'] = scr(l['x'], l['y'], l['z'])
meta.update({'zmin': ZMIN, 'zmax': ZMAX, 'fmin': FMIN, 'fmax': FMAX, 'grid': {'x0': float(GX0), 'y1': float(GY0 + NY * CELL), 'cell': float(CELL), 'nx': NX, 'ny': NY},
             'step': 0.45, 'view': [480, 270], 'fog': [float(v) for v in FOG]})
json.dump(meta, open(os.path.join(SITE, 'map.json'), 'w'), ensure_ascii=False)

# ---------------------------------------------------------------- previews for checking
big = Image.fromarray(out, 'RGBA')
sky = Image.open(os.path.join(SITE, 'sky.png')).convert('RGBA') if os.path.exists(os.path.join(SITE, 'sky.png')) else None
bg = Image.new('RGBA', (W, H), (93, 74, 102, 255))
if sky is not None:
    bg.paste(sky.crop((84, 20, 84 + 480, 20 + 300)).resize((960, 600), Image.NEAREST), (0, 0))
bg.alpha_composite(big)
bg.convert('RGB').save(os.path.join(WORK, 'map_preview.png'))
# overlay: walkable ground in teal, and pixels that can stand in front of someone in amber
ov = np.asarray(bg.convert('RGB')).astype(np.float32)
gi = np.clip(((wx - GX0) / CELL).astype(int), 0, NX - 1)
gj = np.clip(((wy - GY0) / CELL).astype(int), 0, NY - 1)
wpix = walk[gj, gi] & (kind == 1) & (np.abs(z - np.nan_to_num(floor[gj, gi], nan=99)) < 0.3)
front = np.zeros((H, W), bool)
ys_, xs_ = np.nonzero(walk)
cx_ = GX0 + (xs_ + 0.5) * CELL
cy_ = GY0 + (ys_ + 0.5) * CELL
cz_ = floor[ys_, xs_]
for hh in np.arange(0.2, 2.6, 0.4):
    sx_ = np.clip(((cx_ - X0) * S).astype(int), 0, W - 1)
    sy_ = np.clip((SY0 - (cy_ * SIN + (cz_ + hh) * COS) * S).astype(int), 0, H - 1)
    ds = cy_ * COS - (cz_ + hh) * SIN
    occ = hit[sy_, sx_] & (depth[sy_, sx_] < ds - 0.35) & (kind[sy_, sx_] != 4)
    front[sy_[occ], sx_[occ]] = True
front = np.asarray(Image.fromarray(front).filter(ImageFilter.MaxFilter(3))) & hit & ~wpix
ov[wpix] = ov[wpix] * 0.55 + np.array([60, 220, 200]) * 0.45
ov[front] = ov[front] * 0.5 + np.array([255, 170, 60]) * 0.5
Image.fromarray(ov.astype(np.uint8)).save(os.path.join(WORK, 'overlay_preview.png'))
Image.fromarray(front).save(os.path.join(SITE, 'front.png'), optimize=True)
print('post ok', out.shape, 'colours', NCOL, 'walkable px', int(wpix.sum()), 'front px', int(front.sum()))
for f in sorted(os.listdir(SITE)):
    print('  ', f, os.path.getsize(os.path.join(SITE, f)) // 1024, 'KB')
