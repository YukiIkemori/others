"""Turns the Blender render and the baked data into the files the game loads.

  site/map.webp   the field, finished as a painting: mist in the low ground, dusk colours, a light brush filter
  site/geo.png    per data pixel: height (R,G = 16 bit) and what kind of thing it is (B)
  site/nrm.png    per data pixel: which way the surface faces
  site/alb.png    per data pixel: the surface's own colour
  site/walk.png   ground grid: walkable (R) and floor height (G,B = 16 bit)
  site/front.png  data pixels that can end up in front of someone standing on the floor (only for the check overlay)
  site/map.json   camera numbers, start, exits, lights

The picture is `scale` pixels per world unit (48), the per-pixel data `dscale` (24): two picture pixels per data pixel.
"""
import os, json
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get('WORK', os.path.join(HERE, 'work'))
SITE = os.environ.get('SITE', os.path.join(HERE, '..', 'site'))
os.makedirs(SITE, exist_ok=True)
PAINT = float(os.environ.get('PAINT', '0.62'))        # how much of the brush filter to mix in (0 = none)

meta = json.load(open(os.path.join(WORK, 'meta.json')))
S, SIN, COS, W, H, X0, SY0 = meta['scale'], meta['sin'], meta['cos'], meta['w'], meta['h'], meta['x0'], meta['sy0']
DS, DW, DH = meta['dscale'], meta['dw'], meta['dh']
K = S / 16.0                                          # picture pixels per pixel of the original 16-per-unit layout
SY0D = SY0 * DS / S
bk = np.load(os.path.join(WORK, 'bake.npz'))
zmap, nrm, alb, kind, floor, walk = bk['zmap'], bk['nrm'], bk['alb'], bk['kind'], bk['floor'], bk['walk']
assert zmap.shape == (DH, DW), (zmap.shape, DW, DH)
GX0, GY0, CELL, NX, NY = bk['grid']
NX, NY = int(NX), int(NY)

src = Image.open(os.path.join(WORK, os.environ.get('BEAUTY', 'beauty.png')))
assert src.size == (W, H), (src.size, W, H)
im = np.asarray(src.convert('RGBA')).astype(np.float32) / 255.0
rgb, a = im[..., :3].copy(), im[..., 3].copy()
del im

# ---- what every data pixel is looking at
hit = ~np.isnan(zmap)
z = np.where(hit, zmap, 0.0)
jj, ii = np.mgrid[0:DH, 0:DW].astype(np.float32)
wx = X0 + (ii + 0.5) / DS
wy = ((SY0D - (jj + 0.5)) / DS - z * COS) / SIN
depth = wy * COS - z * SIN
LUM = np.array([0.299, 0.587, 0.114], np.float32)


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


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def up(arr):
    """A data-sized map stretched smoothly to the size of the picture."""
    if arr.ndim == 3:
        return np.stack([up(arr[..., k]) for k in range(arr.shape[-1])], -1)
    return np.asarray(Image.fromarray(arr.astype(np.float32), 'F').resize((W, H), Image.BILINEAR))


def blur(arr, r, shrink=4):
    """Gaussian blur of a picture-sized array, worked out on a smaller copy since the result is soft anyway."""
    if arr.ndim == 3:
        return np.stack([blur(arr[..., k], r, shrink) for k in range(arr.shape[-1])], -1)
    small = np.asarray(Image.fromarray(arr.astype(np.float32), 'F').resize((W // shrink, H // shrink), Image.BOX))
    return np.asarray(Image.fromarray(gauss(small, r / shrink), 'F').resize((W, H), Image.BILINEAR))


def gauss(x, sigma):
    """Three passes of a running average in each direction come very close to a Gaussian blur."""
    w = max(1, int(round(sigma * 1.02)))          # half-width of each running average
    for axis in (0, 1):
        for _ in range(3):
            pad = [(0, 0), (0, 0)]
            pad[axis] = (w + 1, w)
            c = np.pad(x, pad, mode='edge').astype(np.float64).cumsum(axis)
            n = x.shape[axis]
            hi = np.take(c, np.arange(2 * w + 1, 2 * w + 1 + n), axis)
            lo = np.take(c, np.arange(0, n), axis)
            x = ((hi - lo) / (2 * w + 1)).astype(np.float32)
    return x


def hexc(s):
    return np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


# ---------------------------------------------------------------- 1. mist
# Mist lies in the low ground: thin and patchy on the hilltop, thick on the slopes that fall away.
n = fbm(wx, wy * 1.25, 7.0, 3.0)
patch = smooth(0.38, 0.72, n)
low = np.clip((1.0 - z) / 1.5, 0, 1) * (0.10 + 0.9 * patch) * 0.30
slope = np.clip((-0.5 - z) / 4.6, 0, 1) ** 0.75 * 0.93
flank = smooth(27.2, 31.0, np.abs(wx)) * np.clip((4.0 - z) / 6.0, 0, 1) * 0.55
fog = np.clip(np.maximum(low, np.maximum(slope, flank)), 0, 0.94) * hit
FOG = hexc('#8f6f84')
FOG_WARM = hexc('#e2ae92')
warm = smooth(0.3, 0.9, fbm(wx, wy, 13.0, 8.0)) * 0.7
fogU = up(fog)[..., None]
fc = FOG + (FOG_WARM - FOG) * up(warm)[..., None]
rgb = rgb * (1 - fogU) + fc * fogU
del fc

# ---------------------------------------------------------------- 2. glow around flames, glass and sunlit stone
lum = rgb @ LUM
hot = np.clip((lum - 0.78) * 4.0, 0, 1)[..., None] * rgb
glow = blur(hot, 2.4 * K, 2) * 0.55 + blur(hot, 7.0 * K) * 0.5 + blur(hot, 22.0 * K, 8) * 0.35
rgb = 1 - (1 - rgb) * (1 - np.clip(glow, 0, 1) * np.array([1.0, 0.80, 0.58], np.float32))
del hot, glow
# the low moon rakes across everything: a soft warm veil where lit surfaces gather, the way haze catches light
lit = np.clip((lum - 0.42) * 2.2, 0, 1)
veil = blur(lit, 30.0 * K, 8)[..., None]
rgb = rgb + (hexc('#f0c29c') - rgb) * veil * 0.16
del lit, veil, lum

# ---------------------------------------------------------------- 3. dusk grade: plum shadows, rose middles, amber lights
lum = (rgb @ LUM)[..., None]
SH = hexc('#2b2843') * 0.9
HI = hexc('#f6d7ad')
rgb = rgb + (SH - rgb) * 0.26 * (1 - lum) ** 2.2
rgb = rgb + (HI - rgb) * 0.20 * lum ** 2
# pull the greens toward the stone so the grass sits in the same evening
g = rgb[..., 1]
exc = np.clip(g - np.maximum(rgb[..., 0], rgb[..., 2]), 0, 1)
rgb[..., 1] = g - exc * 0.38
rgb[..., 0] += exc * 0.14
rgb[..., 2] += exc * 0.12
# a share of the sketch's own colour scale, so every tone belongs to the same five colours
lum = np.clip(rgb @ LUM, 0, 1)
stops = [(0.0, '#150f1c'), (0.16, '#2b2843'), (0.38, '#5d4a66'), (0.60, '#a9747a'), (0.84, '#ecc79a'), (1.0, '#fff3dc')]
ramp = np.zeros_like(rgb)
for (t0, c0), (t1, c1) in zip(stops[:-1], stops[1:]):
    m = (lum >= t0) & (lum <= t1)
    f = ((lum - t0) / (t1 - t0))[..., None]
    ramp = np.where(m[..., None], hexc(c0) + (hexc(c1) - hexc(c0)) * f, ramp)
rgb = rgb + (ramp - rgb) * 0.24
del ramp
# contrast, and a lift in the middle so the shadow side of things stays readable in play
rgb = np.clip(rgb, 0, 1)
rgb = rgb * rgb * (3 - 2 * rgb) * 0.5 + rgb * 0.5
mean = rgb.mean(-1, keepdims=True)
rgb = np.clip(mean + (rgb - mean) * 1.16, 0, 1)
rgb = rgb ** 0.79

# ---------------------------------------------------------------- 4. a soft dark line where a nearer thing ends
d = np.where(hit, depth, 1e3)
far = np.zeros((DH, DW), np.float32)
for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
    nb = np.roll(d, (dy, dx), (0, 1))
    far = np.maximum(far, np.clip((nb - d - 0.55) / 0.6, 0, 1))
far[(kind == 3) | (kind == 0)] *= 0.25
far *= (1 - fog) ** 2
farU = up(far)[..., None]
rgb = rgb * (1 - 0.22 * farU) + SH * 0.5 * 0.22 * farU
del farU


# ---------------------------------------------------------------- 5. brush filter
# In each of the four squares that meet at a pixel, take the average colour; keep the one from the calmest square.
# Flat areas turn into strokes, edges stay sharp.  (A Kuwahara filter.)
def box_tl(arr, n):
    """Mean over the n x n square whose top-left corner is each pixel (edges repeat)."""
    p = np.pad(arr.astype(np.float64), ((1, n - 1), (1, n - 1)), mode='edge')
    p[0, :] = 0
    p[:, 0] = 0
    c = p.cumsum(0).cumsum(1)
    return ((c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / (n * n)).astype(np.float32)


def kuwahara(img, r):
    n = r + 1
    L = img @ LUM
    mL, mL2 = box_tl(L, n), box_tl(L * L, n)
    var = mL2 - mL * mL
    ch = [box_tl(img[..., k], n) for k in range(3)]
    best = np.full(L.shape, np.inf, np.float32)
    out = np.zeros_like(img)
    for sy in (0, r):
        for sx in (0, r):
            sh = lambda q: np.roll(q, (sy, sx), (0, 1))       # the square that ends (or starts) at this pixel
            v = sh(var)
            better = v < best
            best = np.where(better, v, best)
            for k in range(3):
                out[..., k] = np.where(better, sh(ch[k]), out[..., k])
    return out


if PAINT > 0:
    r = max(2, int(round(1.0 * K)))
    rgb = rgb + (kuwahara(rgb, r) - rgb) * PAINT

# ---------------------------------------------------------------- save the picture
out = np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)[..., None]], -1)
big = Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')
big.save(os.path.join(SITE, 'map.webp'), quality=int(os.environ.get('Q', '92')), method=5)
del out

# ---------------------------------------------------------------- data images
ZMIN, ZMAX = -14.0, 42.0
zq = np.clip((z - ZMIN) / (ZMAX - ZMIN) * 65535, 0, 65535).astype(np.uint32)
k2 = kind.astype(np.uint8)
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
meta.update({'zmin': ZMIN, 'zmax': ZMAX, 'fmin': FMIN, 'fmax': FMAX,
             'grid': {'x0': float(GX0), 'y1': float(GY0 + NY * CELL), 'cell': float(CELL), 'nx': NX, 'ny': NY},
             'step': 0.45, 'view': [int(480 * K), int(270 * K)]})
json.dump(meta, open(os.path.join(SITE, 'map.json'), 'w'), ensure_ascii=False)

# ---------------------------------------------------------------- previews for checking
sky_p = os.path.join(SITE, 'sky.jpg')
bg = Image.new('RGBA', (W, H), (93, 74, 102, 255))
if os.path.exists(sky_p):
    sk = Image.open(sky_p).convert('RGBA')
    bg.paste(sk.resize((int(sk.width * 1.6), int(sk.height * 1.6)), Image.BILINEAR), (-int(84 * K), -int(20 * K)))
bg.alpha_composite(big)
bg.convert('RGB').save(os.path.join(WORK, 'map_full.jpg'), quality=90)
bg.convert('RGB').resize((960, 1024), Image.LANCZOS).save(os.path.join(WORK, 'map_preview.png'))
# overlay: walkable ground in teal, and pixels that can stand in front of someone in amber
ov = np.asarray(bg.convert('RGB').resize((DW, DH), Image.BILINEAR)).astype(np.float32)
gi = np.clip(((wx - GX0) / CELL).astype(int), 0, NX - 1)
gj = np.clip(((wy - GY0) / CELL).astype(int), 0, NY - 1)
wpix = walk[gj, gi] & (kind == 1) & (np.abs(z - np.nan_to_num(floor[gj, gi], nan=99)) < 0.3)
front = np.zeros((DH, DW), bool)
ys_, xs_ = np.nonzero(walk)
cx_ = GX0 + (xs_ + 0.5) * CELL
cy_ = GY0 + (ys_ + 0.5) * CELL
cz_ = floor[ys_, xs_]
for hh in np.arange(0.2, 2.9, 0.3):
    sx_ = np.clip(((cx_ - X0) * DS).astype(int), 0, DW - 1)
    sy_ = np.clip((SY0D - (cy_ * SIN + (cz_ + hh) * COS) * DS).astype(int), 0, DH - 1)
    ds = cy_ * COS - (cz_ + hh) * SIN
    occ = hit[sy_, sx_] & (depth[sy_, sx_] < ds - 0.35) & (kind[sy_, sx_] != 4)
    front[sy_[occ], sx_[occ]] = True
front = np.asarray(Image.fromarray(front).filter(ImageFilter.MaxFilter(5))) & hit & ~wpix
ov[wpix] = ov[wpix] * 0.55 + np.array([60, 220, 200]) * 0.45
ov[front] = ov[front] * 0.5 + np.array([255, 170, 60]) * 0.5
Image.fromarray(ov.astype(np.uint8)).save(os.path.join(WORK, 'overlay_preview.png'))
Image.fromarray(front).save(os.path.join(SITE, 'front.png'), optimize=True)
print('post ok', (W, H), 'data', (DW, DH), 'walkable px', int(wpix.sum()), 'front px', int(front.sum()))
for f in sorted(os.listdir(SITE)):
    print('  ', f, os.path.getsize(os.path.join(SITE, f)) // 1024, 'KB')
