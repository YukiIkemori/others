"""Painted Pharos underlay: 1.5x generation -> 1x map image (tile 32) + emit + overlay + meta, and 24/40 variants.
usage: python3 process.py <src.png> <outdir>
env: SHIFT = [[x0, y0, x1, y1, dx, dy, fillx0?], ...] in 1x px (region moved by dx, dy; a horizontal gap is filled from the
     original columns starting at fillx0, or from the neighbouring columns; a vertical gap from the rows above/below)."""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
d = json.load(open('layout_data.json'))
rows = d['rows']; W, H = d['w'], d['h']; T = 32
blds = json.load(open('blds.json'))
S = Image.open(src).convert('RGB')
k = S.width / (W * T)
# ---- door surgery / patch shifts on the generation-scale image
SHIFT = json.loads(os.environ.get('SHIFT', '[]'))
if SHIFT:
    a = np.asarray(S).copy(); orig = a.copy()
    for sh in SHIFT:
        x0, y0, x1, y1, dx, dy = [int(round(v * k)) for v in sh[:6]]
        seg = orig[y0:y1, x0:x1].copy()
        a[y0 + dy:y1 + dy, x0 + dx:x1 + dx] = seg
        if dx > 0:
            fx = int(round(sh[6] * k)) if len(sh) > 6 else x0 - dx
            a[y0:y1, x0:x0 + dx] = orig[y0:y1, fx:fx + dx]
        elif dx < 0:
            fx = int(round(sh[6] * k)) if len(sh) > 6 else x1
            a[y0:y1, x1 + dx:x1] = orig[y0:y1, fx:fx - dx]
        if dy > 0: a[y0:y0 + dy, x0:x1] = orig[y0 - dy:y0, x0:x1]
        elif dy < 0: a[y1 + dy:y1, x0:x1] = orig[y1:y1 - dy, x0:x1]
        # feather the edges of the moved rectangle into the untouched painting (no hard seams in the rock and paving)
        F = int(round(10 * k))
        X0, X1, Y0, Y1 = min(x0, x0 + dx), max(x1, x1 + dx), min(y0, y0 + dy), max(y1, y1 + dy)
        yy, xx = np.mgrid[Y0:Y1, X0:X1]
        al = np.clip(np.minimum.reduce([xx - X0, X1 - 1 - xx, yy - Y0, Y1 - 1 - yy]) / F, 0, 1)[..., None]
        a[Y0:Y1, X0:X1] = np.rint(orig[Y0:Y1, X0:X1] * (1 - al) + a[Y0:Y1, X0:X1] * al).astype(np.uint8)
    S = Image.fromarray(a)
A = np.asarray(S.resize((W * T, H * T), Image.BOX)).astype(np.float32)
A0 = A.copy()
# ---- brightness: plain luminance gain towards the tile render (keeps the night lighting tuning), clipped
old = np.asarray(Image.open('layout_albedo.png').convert('RGB')).astype(np.float32)
lum = lambda v: v @ np.array([0.299, 0.587, 0.114], np.float32)
walk = np.array([[c == '.' for c in r] for r in d['walk']])
m = np.kron(walk, np.ones((T, T), bool))
gain = float(np.clip(lum(old[m]).mean() / lum(A[m]).mean(), 0.85, 1.1))
gain = float(os.environ.get('GAIN', gain))
A = np.clip(A * gain, 0, 255)
print('gain', round(gain, 3))
# ---- windows (emit): warm panes inside the building fronts (and the lighthouse lantern) glow at night
fp = np.zeros(A.shape[:2], bool)
for b in blds: fp[(b['y'] + b['h'] - b['wall']) * T - 6:(b['y'] + b['h']) * T - 2, b['x'] * T - 12:(b['x'] + b['w']) * T + 12] = True
fp[36 * T:40 * T, 58 * T:61 * T] = True   # lighthouse lantern room
R_, G_, B_ = A0[..., 0], A0[..., 1], A0[..., 2]
pane = (R_ > 165) & (G_ > 115) & (B_ < 0.62 * R_) & (R_ - B_ > 75) & fp
lab, n = ndimage.label(ndimage.binary_closing(pane, iterations=5))
wins = []
emit = np.zeros(A.shape[:2] + (4,), np.uint8)
for i, sl in enumerate(ndimage.find_objects(lab)):
    ys, xs = sl; h, w = ys.stop - ys.start, xs.stop - xs.start
    comp = lab[sl] == i + 1
    if comp.sum() < 40 or w < 8 or h < 8 or w > 30 or h > 30 or comp.sum() < 0.3 * w * h: continue
    wins.append(dict(kind='win', x=int(xs.start), y=int(ys.start), w=int(w), h=int(h)))
    mm = comp & pane[sl]
    e = emit[sl]
    px = np.clip(A[sl] * 1.12 + np.array([22, 14, 0]), 0, 255)
    e[mm, :3] = px[mm]; e[mm, 3] = 255
print('windows', len(wins))
base = np.rint(A).astype(np.uint8)
# ---- overlay (walk-behind): the front rope rails and posts of the east-west rope bridges (drawn above people on the bridge)
ov = np.zeros(A.shape[:2], bool)
BR = json.loads(os.environ.get('RAILS', '[]'))   # [[x0, x1, yRope], ...] 1x px: the painted front rope line
for x0, x1, yr in BR:
    band = A0[yr - 9:yr + 14, x0:x1]
    L = lum(band)
    # the rope line: per column the brightest warm row in the band (smoothed), kept 3 px above and below it
    score = L + (band[..., 0] - band[..., 2]) * 0.5
    ry = np.argmax(ndimage.uniform_filter(score, (3, 1)), axis=0).astype(float)
    xs_ = np.arange(len(ry)); keep = np.ones(len(ry), bool)
    for _ in range(4):   # the rope sags like a parabola: robust fit
        cf = np.polyfit(xs_[keep], ry[keep], 2); res = np.abs(np.polyval(cf, xs_) - ry); keep = res < max(2.0, np.percentile(res, 60))
    ry = np.polyval(cf, xs_)
    for i, r in enumerate(ry):
        r = int(round(r)) + yr - 9
        ov[r - 3:r + 4, x0 + i] = True
print('overlay px', int(ov.sum()))


def save_set(name, arr, rgba=False):
    im = Image.fromarray(arr.astype(np.uint8), 'RGBA' if rgba else 'RGB')
    im.save(os.path.join(outdir, name + '@32.png'), optimize=True)
    im.resize((W * 24, H * 24), Image.LANCZOS if not rgba else Image.NEAREST).save(os.path.join(outdir, name + '@24.png'), optimize=True)
    im.resize((W * 40, H * 40), Image.NEAREST).save(os.path.join(outdir, name + '@40.png'), optimize=True)


save_set('pharos', base)
save_set('pharos_emit', emit, True)
o = np.zeros(A.shape[:2] + (4,), np.uint8); o[..., :3] = base; o[..., 3] = ov * 255
save_set('pharos_over', o, True)
doors = [dict(x=b['door'][0] * T + 16, y=b['door'][1] * T + 30, id=b['id']) for b in blds]   # checked with doorsheet.py after the surgery
json.dump(dict(id='pharos', kind='under', map='pharos', tile=32, size32=[W * T, H * T], windows32=wins, doors32=doors,
               painted=[], files={t: 'pharos@%d.png' % t for t in (24, 32, 40)}), open(os.path.join(outdir, 'pharos.json'), 'w'), indent=1)
Image.fromarray(base).save('proc_last.png')
