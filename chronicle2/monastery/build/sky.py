"""The view beyond the cliff at the changing of the moons: the white moon going down, the black moon coming up.

Drawn directly as pixel art (648x320).  The game slides it more slowly than the field, so it reads as far away.
"""
import os, math
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.environ.get('SITE', os.path.join(HERE, '..', 'site'))
os.makedirs(SITE, exist_ok=True)
W, H = 648, 320
WM = (396.0, 128.0, 31.0)     # white moon: x, y, radius
BM = (566.0, 84.0, 23.0)      # black moon
HORIZON = 190.0

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


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

# ---- stars, thinning toward the light
rs = np.random.default_rng(4)
for k in range(260):
    x, y = rs.integers(0, W), int(rs.random() ** 1.7 * 150)
    b = rs.random() ** 2 * (1 - np.exp(-(np.hypot(x - WM[0], y - WM[1]) / 170) ** 2))
    if b < 0.08:
        continue
    c = hx('#e8dcff') if rs.random() < 0.7 else hx('#ffe6c0')
    img[y, x] += (c - img[y, x]) * min(1, b * 1.3)
    if b > 0.6:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + dx < W and 0 <= y + dy < H:
                img[y + dy, x + dx] += (c - img[y + dy, x + dx]) * 0.35

# ---- the white moon, sinking into the haze
dm = np.hypot(xx - WM[0], yy - WM[1])
halo = np.exp(-(dm / 78) ** 2) * 0.30 + np.exp(-(dm / 40) ** 2) * 0.22
img += (hx('#ffe4b8') - img) * np.clip(halo, 0, 1)[..., None]
disc = dm < WM[2]
mar = fbm((xx - WM[0]) / 17 + 5, (yy - WM[1]) / 17 + 3, 9.0)
moon = ramp(mar, [(0, '#fffaec'), (0.42, '#fff4dc'), (0.55, '#f0dcba'), (0.7, '#e2c6a2'), (1, '#fff0d4')])
limb = sm(WM[2] * 0.55, WM[2], dm)
moon = moon * (1 - 0.08 * limb[..., None])
sink = sm(HORIZON - 30, HORIZON + 2, yy)          # lower part dissolves into the horizon haze
moon = moon + (img - moon) * (sink * 0.8)[..., None]
img = np.where(disc[..., None], moon, img)

# ---- the black moon: a hole in the sky with a thin lit edge and a faint crown
ring = np.exp(-((db - BM[2] - 1.5) / 4.5) ** 2) * 0.55 + np.exp(-((db - BM[2]) / 16) ** 2) * 0.22
img += (hx('#b9a4ff') - img) * np.clip(ring, 0, 1)[..., None]
bdisc = db < BM[2]
img = np.where(bdisc[..., None], hx('#0d0a18') + (hx('#1a1530') - hx('#0d0a18')) * sm(0, BM[2], db)[..., None] * 0.6, img)
ang = np.arctan2(yy - BM[1], xx - BM[0])
toward = np.cos(ang - math.atan2(WM[1] - BM[1] + 30, WM[0] - BM[0]))     # the side facing the white moon
edge = bdisc & (db > BM[2] - 1.6) & (toward > 0.25)
img = np.where(edge[..., None], hx('#d9c8ff') * 0.9, img)

# ---- long evening clouds
def clouds(y0, thick, scale, seed, dens, body, lit, dark):
    global img
    n = fbm(xx / scale + seed, (yy - y0) / (scale * 0.16) + seed * 2, seed, 4)
    band = np.exp(-((yy - y0) / thick) ** 2)
    m = n * band
    mask = m > dens
    under = (np.roll(m, -2, 0) < dens) & mask            # lit from below-left by the afterglow
    top = (np.roll(m, 2, 0) < dens) & mask
    glow = np.exp(-(np.hypot((xx - WM[0]) / 2.2, yy - WM[1]) / 150) ** 2)[..., None]
    c = hx(body) + (hx('#b98490') - hx(body)) * glow * 0.6
    c = np.where(under[..., None], hx(lit) + (hx('#ffd9a0') - hx(lit)) * glow, c)
    c = np.where(top[..., None], hx(dark), c)
    img = np.where(mask[..., None], c, img)

clouds(50, 22, 95, 2.0, 0.47, '#3a3355', '#5d4a66', '#2a2742')
clouds(100, 20, 80, 7.0, 0.44, '#6b5373', '#d59a8c', '#4a3d5e')
clouds(152, 16, 70, 11.0, 0.42, '#8f6a7c', '#f6cc98', '#5d4a66')
# the moons stay in front of the highest, farthest cloud only where it is thin: redraw their cores
img = np.where((dm < WM[2] - 9)[..., None] & (yy < HORIZON - 60)[..., None], moon, img)
img = np.where((db < BM[2] - 1.6)[..., None], hx('#0d0a18') + (hx('#1a1530') - hx('#0d0a18')) * sm(0, BM[2], db)[..., None] * 0.6, img)

# ---- far ridges, then the sea of mist
def ridge(base, amp, scale, seed, colr, haze):
    global img
    prof = base - amp * fbm(xx[0] / scale + seed, np.zeros(W, np.float32), seed, 5) - amp * 0.35 * np.abs(np.sin(xx[0] / (scale * 0.9) + seed))
    m = yy > prof[None, :]
    c = hx(colr) + (hx('#e9b596') - hx(colr)) * haze
    c = c + (hx('#f0c8a0') - c) * (np.exp(-((xx - WM[0]) / 200) ** 2) * 0.25)[..., None]
    img = np.where(m[..., None], c, img)

ridge(HORIZON + 2, 26, 120, 3.0, '#8a6a82', 0.55)
ridge(HORIZON + 14, 30, 80, 8.0, '#6c5373', 0.32)
ridge(HORIZON + 30, 26, 60, 15.0, '#4d3f5c', 0.12)
mist = sm(HORIZON + 12, HORIZON + 70, yy + 14 * fbm(xx / 60, yy / 14, 21.0))
mc = ramp((yy - HORIZON) / (H - HORIZON), [(0, '#d6a596'), (0.35, '#a98392'), (0.7, '#7a6180'), (1, '#5d4a66')])
streak = fbm(xx / 70 + 3, yy / 7, 31.0)
mc = mc * (0.93 + 0.14 * streak[..., None])
img = img + (mc - img) * mist[..., None]

# ---- to a small palette, with ordered dither so the gradients turn into pixels
img = np.clip(img, 0, 1)
bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16 - 0.47
img = np.clip(img + np.tile(bayer, (H // 4 + 1, W // 4 + 1))[:H, :W, None] * 0.05, 0, 1)
im = Image.fromarray((img * 255).astype(np.uint8))
q = im.quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
q.save(os.path.join(SITE, 'sky.png'), optimize=True)
q.convert('RGB').resize((W * 2, H * 2), Image.NEAREST).save(os.path.join(os.environ.get('WORK', os.path.join(HERE, 'work')), 'sky_preview.png'))
print('sky ok', os.path.getsize(os.path.join(SITE, 'sky.png')) // 1024, 'KB')
