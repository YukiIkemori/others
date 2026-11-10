"""The view beyond the cliff at the changing of the moons: the white moon going down, the black moon coming up.

Painted directly with numpy, K times finer than the 648x320 layout it was designed on.  The game slides it more
slowly than the field, so it reads as far away.
"""
import os, math
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.environ.get('SITE', os.path.join(HERE, '..', 'site'))
os.makedirs(SITE, exist_ok=True)
W, H = 648, 320
K = int(os.environ.get('RES', '3'))
WM = (396.0, 128.0, 31.0)     # white moon: x, y, radius
BM = (566.0, 84.0, 23.0)      # black moon
HORIZON = 190.0

yy, xx = (np.mgrid[0:H * K, 0:W * K].astype(np.float32) + 0.5) / K       # layout coordinates of every pixel


def hx(s):
    return np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


def hash01(a, b, seed=0.0):
    h = np.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453
    return h - np.floor(h)


def vnoise(x, y, seed=0.0):
    xi, yi = np.floor(x), np.floor(y)
    fx, fy = x - xi, y - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    l = lambda p, q, t: p + (q - p) * t
    return l(l(hash01(xi, yi, seed), hash01(xi + 1, yi, seed), fx), l(hash01(xi, yi + 1, seed), hash01(xi + 1, yi + 1, seed), fx), fy)


def fbm(x, y, seed=0.0, oct=4):
    v, amp, tot = 0, 1.0, 0
    for k in range(oct):
        v = v + vnoise(x * 2 ** k, y * 2 ** k, seed + k) * amp
        tot += amp
        amp *= 0.5
    return v / tot


def ramp(t, stops):
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,), np.float32)
    for (t0, c0), (t1, c1) in zip(stops[:-1], stops[1:]):
        m = (t >= t0) & (t <= t1)
        f = ((t - t0) / max(t1 - t0, 1e-6))[..., None]
        out = np.where(m[..., None], hx(c0) + (hx(c1) - hx(c0)) * f, out)
    return out


def sm(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---- sky gradient: indigo above, rose and amber toward the horizon
t = yy / HORIZON
img = ramp(t, [(0, '#191730'), (0.30, '#2b2843'), (0.56, '#5d4a66'), (0.78, '#a9747a'), (0.93, '#e0ab8c'), (1.0, '#f0cc9c')])
# the west (left of the white moon) holds the afterglow; the east is already night
dw = np.hypot((xx - WM[0]) / 1.5, yy - (WM[1] + 30))
img += (hx('#f7a777') - img) * (np.exp(-(dw / 150) ** 2) * 0.36)[..., None]
db = np.hypot(xx - BM[0], yy - BM[1])
img += (hx('#15122a') - img) * (np.exp(-(db / 120) ** 2) * 0.55)[..., None]

# ---- stars, thinning toward the light: small soft points, a few with a cross of rays
rs = np.random.default_rng(4)
for k in range(520):
    x, y = rs.uniform(0, W), rs.random() ** 1.7 * 150
    b = rs.random() ** 2 * (1 - np.exp(-(np.hypot(x - WM[0], y - WM[1]) / 170) ** 2))
    if b < 0.06:
        continue
    c = hx('#e8dcff') if rs.random() < 0.7 else hx('#ffe6c0')
    r = 0.28 + 0.5 * b
    px, py, R = int(x * K), int(y * K), int(4 * K)
    x0, x1, y0, y1 = max(0, px - R), min(W * K, px + R + 1), max(0, py - R), min(H * K, py + R + 1)
    dx, dy = xx[y0:y1, x0:x1] - x, yy[y0:y1, x0:x1] - y
    a = np.exp(-(dx * dx + dy * dy) / (r * r)) * min(1, b * 1.4)
    if b > 0.55:
        a = a + 0.35 * b * (np.exp(-np.abs(dx) / 1.6 - (dy / 0.22) ** 2) + np.exp(-np.abs(dy) / 1.6 - (dx / 0.22) ** 2))
    img[y0:y1, x0:x1] += (c - img[y0:y1, x0:x1]) * np.clip(a, 0, 1)[..., None]

# ---- the white moon, sinking into the haze
dm = np.hypot(xx - WM[0], yy - WM[1])
halo = np.exp(-(dm / 78) ** 2) * 0.30 + np.exp(-(dm / 40) ** 2) * 0.22
img += (hx('#ffe4b8') - img) * np.clip(halo, 0, 1)[..., None]
disc = sm(WM[2] + 0.45, WM[2] - 0.45, dm)
mar = fbm((xx - WM[0]) / 17 + 5, (yy - WM[1]) / 17 + 3, 9.0)
moon = ramp(mar, [(0, '#fffaec'), (0.42, '#fff4dc'), (0.55, '#f0dcba'), (0.7, '#e2c6a2'), (1, '#fff0d4')])
limb = sm(WM[2] * 0.55, WM[2], dm)
moon = moon * (1 - 0.08 * limb[..., None])
sink = sm(HORIZON - 30, HORIZON + 2, yy)          # lower part dissolves into the horizon haze
moon = moon + (img - moon) * (sink * 0.8)[..., None]
img = img + (moon - img) * disc[..., None]

# ---- the black moon: a hole in the sky with a thin lit edge and a faint crown
ring = np.exp(-((db - BM[2] - 1.5) / 4.5) ** 2) * 0.55 + np.exp(-((db - BM[2]) / 16) ** 2) * 0.22
img += (hx('#b9a4ff') - img) * np.clip(ring, 0, 1)[..., None]
bdisc = sm(BM[2] + 0.45, BM[2] - 0.45, db)
bcol = hx('#0d0a18') + (hx('#1a1530') - hx('#0d0a18')) * sm(0, BM[2], db)[..., None] * 0.6
img = img + (bcol - img) * bdisc[..., None]
ang = np.arctan2(yy - BM[1], xx - BM[0])
toward = np.cos(ang - math.atan2(WM[1] - BM[1] + 30, WM[0] - BM[0]))     # the side facing the white moon
edge = bdisc * sm(BM[2] - 2.0, BM[2] - 0.8, db) * sm(0.1, 0.5, toward)
img = img + (hx('#d9c8ff') * 0.9 - img) * edge[..., None]

# ---- long evening clouds
def clouds(y0, thick, scale, seed, dens, body, lit, dark):
    global img
    n = fbm(xx / scale + seed, (yy - y0) / (scale * 0.16) + seed * 2, seed, 6)
    band = np.exp(-((yy - y0) / thick) ** 2)
    m = n * band
    a = sm(dens - 0.022, dens + 0.03, m)
    below = np.roll(m, -int(2.2 * K), 0)                 # what lies a little lower: the lit underside is where that is sky
    above = np.roll(m, int(2.2 * K), 0)
    under = a * sm(dens + 0.03, dens - 0.02, below)
    top = a * sm(dens + 0.035, dens - 0.02, above)
    glow = np.exp(-(np.hypot((xx - WM[0]) / 2.2, yy - WM[1]) / 150) ** 2)[..., None]
    c = hx(body) + (hx('#b98490') - hx(body)) * glow * 0.6
    c = c * (0.94 + 0.12 * fbm(xx / 9 + seed, yy / 3, seed + 40, 3)[..., None])       # brushy streaks inside the cloud
    c = c + (hx(lit) + (hx('#ffd9a0') - hx(lit)) * glow - c) * under[..., None]
    c = c + (hx(dark) - c) * (top * 0.8)[..., None]
    img = img + (c - img) * a[..., None]

clouds(50, 22, 95, 2.0, 0.47, '#3a3355', '#5d4a66', '#2a2742')
clouds(100, 20, 80, 7.0, 0.44, '#6b5373', '#d59a8c', '#4a3d5e')
clouds(152, 16, 70, 11.0, 0.42, '#8f6a7c', '#f6cc98', '#5d4a66')
# the moons stay in front of the highest, farthest cloud only where it is thin: redraw their cores
core = sm(WM[2] - 7, WM[2] - 11, dm) * sm(HORIZON - 56, HORIZON - 64, yy)
img = img + (moon - img) * core[..., None]
img = img + (bcol - img) * sm(BM[2] - 1.2, BM[2] - 2.0, db)[..., None]

# ---- far ridges, then the sea of mist
def ridge(base, amp, scale, seed, colr, haze):
    global img
    x1 = xx[0]
    prof = base - amp * fbm(x1 / scale + seed, np.zeros_like(x1), seed, 6) - amp * 0.35 * np.abs(np.sin(x1 / (scale * 0.9) + seed))
    m = sm(-0.4, 0.4, yy - prof[None, :])
    c = hx(colr) + (hx('#e9b596') - hx(colr)) * haze
    c = c + (hx('#f0c8a0') - c) * (np.exp(-((xx - WM[0]) / 200) ** 2) * 0.25)[..., None]
    c = c + (hx('#f6d2a8') - c) * (np.exp(-np.clip(yy - prof[None, :], 0, None) / 2.5) * 0.22)[..., None]   # a lit edge along the crest
    img = img + (c - img) * m[..., None]

ridge(HORIZON + 2, 26, 120, 3.0, '#8a6a82', 0.55)
ridge(HORIZON + 14, 30, 80, 8.0, '#6c5373', 0.32)
ridge(HORIZON + 30, 26, 60, 15.0, '#4d3f5c', 0.12)
mist = sm(HORIZON + 12, HORIZON + 70, yy + 14 * fbm(xx / 60, yy / 14, 21.0))
mc = ramp((yy - HORIZON) / (H - HORIZON), [(0, '#d6a596'), (0.35, '#a98392'), (0.7, '#7a6180'), (1, '#5d4a66')])
streak = fbm(xx / 70 + 3, yy / 7, 31.0)
mc = mc * (0.93 + 0.14 * streak[..., None])
img = img + (mc - img) * mist[..., None]

# ---- a little canvas grain so the wide gradients do not band, then save
img = np.clip(img, 0, 1)
PIX = os.environ.get('STYLE') == 'pixel'      # pixel style: a few flat bands of colour instead of a smooth gradient
OUT = 'sky.png' if PIX else 'sky.jpg'
if PIX:
    # the same sky, recoloured on the scale the sprites use: navy in the dark, through violet, to warm cream in the light
    stops = [(0.0, '#070a16'), (0.13, '#0e1730'), (0.26, '#1a2a4f'), (0.38, '#2f4274'), (0.50, '#565a94'), (0.62, '#8a6f9c'),
             (0.74, '#c98a8a'), (0.87, '#f2b97c'), (1.0, '#fff1c4')]
    hx = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
    lum = np.clip(img @ np.array([0.299, 0.587, 0.114], np.float32), 0, 1)
    lum = np.clip((lum - 0.06) / 0.80, 0, 1)
    out = np.zeros_like(img)
    for (t0, c0), (t1, c1) in zip(stops[:-1], stops[1:]):
        m = (lum >= t0) & (lum <= t1)
        out = np.where(m[..., None], hx(c0) + (hx(c1) - hx(c0)) * ((lum - t0) / (t1 - t0))[..., None], out)
    img = out
    im = Image.fromarray((img * 255 + 0.5).astype(np.uint8)).quantize(28, method=Image.Quantize.MEDIANCUT, kmeans=3, dither=Image.Dither.NONE)
    im.save(os.path.join(SITE, OUT), optimize=True)
    im = im.convert('RGB')
else:
    g = np.random.default_rng(2).normal(0, 1, (H * K, W * K)).astype(np.float32)
    img = np.clip(img + g[..., None] * 0.006, 0, 1)
    im = Image.fromarray((img * 255 + 0.5).astype(np.uint8))
    im.save(os.path.join(SITE, OUT), quality=90, optimize=True)
im.resize((W * 2, H * 2), Image.LANCZOS).save(os.path.join(os.environ.get('WORK', os.path.join(HERE, 'work')), 'sky_preview.png'))
print('sky ok', im.size, os.path.getsize(os.path.join(SITE, OUT)) // 1024, 'KB')
