"""Placeholder assets for developing the twilight engine before the real art exists.

Writes into ../site (never touches hero.png / hero.json if they are already there):
  map_placeholder.webp     the old pixel-finish abbey map (input: old map.webp)
  walk_placeholder.png     walk mask at 1/4 scale, projected from the old world-grid walk mask
  height_placeholder.png   height map (R + 256*G) that only covers three nave columns, to exercise occlusion by height
  sky_placeholder.webp     procedural dusk sky with two moons
  far_placeholder.webp     procedural far mountain ridges (alpha)
  clouds_placeholder.webp  procedural cloud bands that tile in x (alpha)
  fg_placeholder.webp      procedural dark pine silhouettes for the foreground layer (alpha)
  map.json                 a complete example of the data contract, pointing at the placeholders

usage: python3 placeholder.py <old map.webp> <old map.json> <old walk.png> <hero sheet png> <hero json> [site dir]
"""
import json
import math
import os
import random
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

old_map, old_json, old_walk, hero_png, hero_json = sys.argv[1:6]
SITE = sys.argv[6] if len(sys.argv) > 6 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
M = json.load(open(old_json))
W, H = M['w'], M['h']
S, SIN, COS, X0, SY0 = M['scale'], M['sin'], M['cos'], M['x0'], M['sy0']
rnd = random.Random(7)


def to_screen(x, y, z=0.0):
    return (x - X0) * S, SY0 - (y * SIN + z * COS) * S


# ---- map
Image.open(old_map).save(os.path.join(SITE, 'map_placeholder.webp'), lossless=True, quality=80)

# ---- walk mask (1/4 scale): splat every walkable world-grid cell at its floor height
G = M['grid']
wk = np.asarray(Image.open(old_walk).convert('RGB')).astype(np.float64)
walk = wk[..., 0] > 127
floor = (wk[..., 1] * 256 + wk[..., 2]) / 65535 * (M['fmax'] - M['fmin']) + M['fmin']
K = 4
mask = np.zeros((H // K, W // K), np.uint8)
jj, ii = np.nonzero(walk)
xs = G['x0'] + (ii + .5) * G['cell']
ys = G['y1'] - (jj + .5) * G['cell']
sx = (xs - X0) * S
sy = SY0 - (ys * SIN + floor[jj, ii] * COS) * S
px = np.clip((sx / K).astype(int), 0, W // K - 1)
py = np.clip((sy / K).astype(int), 0, H // K - 1)
mask[py, px] = 255
mi = Image.fromarray(mask).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
mi.save(os.path.join(SITE, 'walk_placeholder.png'), optimize=True)


# ---- sky: dusk gradient, stars, a gold moon and a dark moon with a rim (pixel-crisp, banded)
def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


SW, SH = 1100, 700
stops = [(0, (22, 18, 58)), (.35, (52, 36, 98)), (.6, (118, 64, 128)), (.78, (206, 110, 120)), (.9, (246, 170, 120)), (1, (252, 214, 150))]
sky = Image.new('RGB', (SW, SH))
d = ImageDraw.Draw(sky)
BAND = 10
for y in range(0, SH, BAND):
    t = y / (SH - 1)
    for k in range(len(stops) - 1):
        if stops[k][0] <= t <= stops[k + 1][0]:
            c = lerp(stops[k][1], stops[k + 1][1], (t - stops[k][0]) / (stops[k + 1][0] - stops[k][0]))
            break
    d.rectangle([0, y, SW, y + BAND], fill=c)
for _ in range(260):
    x, y = rnd.randrange(SW), int(rnd.random() ** 1.6 * SH * .6)
    b = rnd.choice([150, 190, 230, 255])
    d.point((x, y), fill=(b, b, min(255, b + 20)))
    if rnd.random() < .08:
        d.point([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=(b // 2 + 40, b // 2 + 40, b // 2 + 70))
GOLD = (300, 250, 58)
DARK = (800, 170, 40)
for r, c in [(GOLD[2] + 14, (255, 196, 140)), (GOLD[2] + 6, (255, 220, 160)), (GOLD[2], (255, 240, 200)), (GOLD[2] - 8, (255, 248, 224))]:
    d.ellipse([GOLD[0] - r, GOLD[1] - r, GOLD[0] + r, GOLD[1] + r], fill=c)
for (cx, cy, r) in [(-18, -10, 12), (14, 16, 9), (20, -22, 6)]:
    d.ellipse([GOLD[0] + cx - r, GOLD[1] + cy - r, GOLD[0] + cx + r, GOLD[1] + cy + r], fill=(246, 226, 180))
d.ellipse([DARK[0] - DARK[2] - 3, DARK[1] - DARK[2] - 3, DARK[0] + DARK[2] + 3, DARK[1] + DARK[2] + 3], fill=(232, 170, 230))
d.ellipse([DARK[0] - DARK[2], DARK[1] - DARK[2], DARK[0] + DARK[2], DARK[1] + DARK[2]], fill=(14, 10, 32))
# long thin cloud streaks
for _ in range(26):
    y = int(SH * (.25 + rnd.random() * .6))
    x = rnd.randrange(-100, SW)
    w = rnd.randrange(90, 420)
    t = y / SH
    c = lerp((70, 50, 120), (255, 190, 150), min(1, max(0, (t - .3) / .6)))
    for k in range(rnd.randrange(2, 5)):
        ww = int(w * (1 - k * .22))
        d.rectangle([x + k * 14, y - k * 3, x + k * 14 + ww, y - k * 3 + 2], fill=c)
sky.save(os.path.join(SITE, 'sky_placeholder.webp'), lossless=True)

# ---- far ridges (alpha)
FW_, FH_ = 1300, 420
far = Image.new('RGBA', (FW_, FH_), (0, 0, 0, 0))
d = ImageDraw.Draw(far)
for layer, (col, base, amp) in enumerate([((92, 66, 130, 255), 150, 60), ((66, 50, 110, 255), 215, 70), ((40, 34, 84, 255), 290, 80)]):
    ph = [rnd.random() * 6.28 for _ in range(4)]
    pts = [(0, FH_)]
    for x in range(0, FW_ + 4, 4):
        h = base - amp * (.5 * math.sin(x * .006 + ph[0]) + .3 * math.sin(x * .017 + ph[1]) + .14 * math.sin(x * .041 + ph[2]) + .06 * math.sin(x * .11 + ph[3]))
        pts.append((x, int(h / 2) * 2))
    pts.append((FW_, FH_))
    d.polygon(pts, fill=col)
far.save(os.path.join(SITE, 'far_placeholder.webp'), lossless=True)

# ---- clouds that tile in x (alpha)
CW, CH = 1024, 300
cl = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
d = ImageDraw.Draw(cl)
for _ in range(16):
    cx, cy = rnd.randrange(CW), rnd.randrange(60, CH - 40)
    n = rnd.randrange(4, 9)
    for dxw in (-CW, 0, CW):
        for k in range(n):
            w = rnd.randrange(60, 200)
            ox = (k - n / 2) * 34 + rnd.randrange(-10, 10)
            oy = rnd.randrange(-8, 8)
            d.rectangle([cx + ox + dxw, cy + oy, cx + ox + w + dxw, cy + oy + rnd.choice([3, 4, 6])], fill=(255, 214, 190, 120))
            d.rectangle([cx + ox + 8 + dxw, cy + oy + 6, cx + ox + w - 12 + dxw, cy + oy + 9], fill=(150, 100, 160, 110))
cl.save(os.path.join(SITE, 'clouds_placeholder.webp'), lossless=True)

# ---- foreground: dark pine silhouettes along the bottom corners (alpha)
FGW, FGH = 1400, 700
fg = Image.new('RGBA', (FGW, FGH), (0, 0, 0, 0))
d = ImageDraw.Draw(fg)


def pine(cx, base, h, col):
    w = h * .42
    tiers = 7
    for k in range(tiers):
        t0, t1 = k / tiers, (k + 1.6) / tiers
        y0, y1 = base - h + h * t0, min(base, base - h + h * t1)
        ww = w * (t1 * .9 + .08)
        d.polygon([(cx, y0), (cx - ww, y1), (cx + ww, y1)], fill=col)
    d.rectangle([cx - 4, base - h * .2, cx + 4, base], fill=col)


for cx in list(range(-40, 330, 62)) + list(range(FGW - 320, FGW + 60, 62)):
    edge = min(cx + 40, FGW - cx + 40) / 360.0
    pine(cx + rnd.randrange(-14, 14), FGH + rnd.randrange(0, 60), rnd.randrange(300, 470) * (1.15 - edge * .5), (10, 8, 26, 255))
fg.save(os.path.join(SITE, 'fg_placeholder.webp'), lossless=True)

# ---- hero placeholder (only if the real one has not been delivered)
hp, hj = os.path.join(SITE, 'hero.png'), os.path.join(SITE, 'hero.json')
if not os.path.exists(hp) and not os.path.exists(hj):
    shutil.copy(hero_png, hp)
    shutil.copy(hero_json, hj)
    print('hero placeholder copied')
else:
    print('hero.png / hero.json already present: left alone')

# ---- map.json
lights = []
for L in M['lights']:
    gx, gy = to_screen(L['x'], L['y'], 0)
    if L['kind'] == 'lantern':
        lights.append(dict(kind='lantern', x=round(L['sx']), y=round(L['sy']), gx=round(L['sx']), gy=round(L['sy'] + L['z'] * COS * S * .8),
                           r=round(L['r'] * S * .9), color=L['color'], intensity=1, flicker=.16))
    elif L['kind'] == 'candle':
        lights.append(dict(kind='lantern', x=round(L['sx']), y=round(L['sy']), r=round(L['r'] * S * 1.2), color=L['color'], intensity=.7, flicker=.3))
    else:
        lights.append(dict(kind='window', x=round(L['sx']), y=round(L['sy']), r=round(L['r'] * S), color=L['color'], intensity=.6, flicker=.04))
lights.append(dict(kind='moon', layer='sky', x=GOLD[0], y=GOLD[1], r=260, color='#ffd9a0', intensity=.7))
lights.append(dict(kind='moon', layer='sky', x=DARK[0], y=DARK[1], r=150, color='#c890ff', intensity=.5))

px_, py_ = to_screen(*M['pool'])
water = [dict(poly=[[round(px_ + 84 * math.cos(a)), round(py_ + 62 * math.sin(a))] for a in [i * math.pi / 8 for i in range(16)]])]


def rect(x, y, w, h):
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]


occluders = [
    dict(poly=[[905, 1560], [1010, 1560], [1045, 1620], [1045, 1700], [1015, 1700], [1015, 1650], [985, 1615], [935, 1615], [905, 1650], [905, 1700], [880, 1700], [880, 1620]], base=1700),
    dict(poly=rect(836, 828, 68, 104), base=932),
    dict(poly=rect(836, 1008, 68, 128), base=1136),
    dict(poly=rect(1098, 925, 70, 172), base=1097),
]
# ---- height placeholder: the three nave columns stand as tall as their rectangles (h = base - y), stored as R + 256*G
hm = np.zeros((H, W, 3), np.uint8)
for o in occluders[1:]:
    xs = [p[0] for p in o['poly']]
    ys = [p[1] for p in o['poly']]
    for y in range(min(ys), o['base']):
        hm[y, min(xs):max(xs), 0] = (o['base'] - y) % 256
        hm[y, min(xs):max(xs), 1] = (o['base'] - y) // 256
Image.fromarray(hm).save(os.path.join(SITE, 'height_placeholder.png'), optimize=True)
occluders = occluders[:1]          # the gate arch stays a polygon cut-out, so both methods are exercised

ex = {e['id']: to_screen(e['x'], e['y'], e.get('z', 0)) for e in M['exits']}
triggers = [
    dict(x=round(ex['tower'][0]), y=round(ex['tower'][1]) + 6, r=46, title='鐘楼の扉', label='調べる',
         text=['扉は内側から閂がかけられている。', '見上げると、青銅の鐘が\n音もなく夕闇に揺れていた。']),
    dict(x=round(ex['lookout'][0]), y=round(ex['lookout'][1]), r=70, title='見晴らし台', label='月を眺める', pan=[0, -260],
         text=['金の月が沈み、影の月が昇る。', '……鐘は、今夜も鳴らない。'], action='mood'),
    dict(x=round(ex['stairs'][0]), y=round(ex['stairs'][1]) - 30, r=50, title='ふもとへの石段', label='見下ろす',
         text=['石段は深い森の底へ続いている。\nいまは、まだ戻れない。']),
]
sp = to_screen(M['spawn'][0], M['spawn'][1], 0)
out = dict(
    placeholder=True,
    title='鐘のならない修道院', w=W, h=H, image='map_placeholder.webp', walk='walk_placeholder.png',
    height='height_placeholder.png',
    spawn=dict(x=round(sp[0]), y=round(sp[1]), dir='up'),
    occluders=occluders, lights=lights, water=water, triggers=triggers,
    emitters=[
        dict(kind='leaves', x=40, y=640, w=300, h=330, n=14),
        dict(kind='fireflies', x=120, y=1150, w=1650, h=520, n=26),
        dict(kind='fireflies', x=1380, y=560, w=420, h=520, n=10),
        dict(kind='mist', x=60, y=1100, w=1800, h=620, n=9),
        dict(kind='motes', x=780, y=560, w=440, h=620, n=24),
    ],
    layers=dict(
        sky=dict(src='sky_placeholder.webp', parallax=.08, x=-30, y=-10),
        far=dict(src='far_placeholder.webp', parallax=.2, x=-80, y=250),
        clouds=dict(src='clouds_placeholder.webp', parallax=.12, y=120, drift=5, alpha=.8),
        fg=dict(src='fg_placeholder.webp', parallax=1.25, anchorX='center', anchorY='bottom', y=60, alpha=.92),
    ),
)
json.dump(out, open(os.path.join(SITE, 'map.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', [f for f in sorted(os.listdir(SITE))])
