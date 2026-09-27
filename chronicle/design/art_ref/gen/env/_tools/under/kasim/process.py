"""Painted Kasim underlay: 1.5x generation -> 1x map image (tile 32) + emit + meta, and the @24 variant (62 x 40 = 2480 px > 2048: no @40).
usage: python3 process.py <src.png> <outdir>
env: WARP = warp.json from rowwarp.py (painted 1x row for each guide row; the model drifts rows down in the south)
     SHIFT = {"<building id>": dx 1x px}: slide a building box sideways so its painted door sits on the door tile (door surgery)
     PATCH = [[x0, y0, x1, y1, sx, sy], ...] 1x px: copy the rectangle at (sx, sy) over (x0, y0)-(x1, y1) (erase a stray painted mark)"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
NAME = 'kasim'
d = json.load(open('layout_data.json'))
W, H = d['w'], d['h']; T = 32
blds = json.load(open('blds.json'))
S = Image.open(src).convert('RGB')
k = S.width / (W * T)
# ---- vertical warp
if os.environ.get('WARP'):
    wm = np.array(json.load(open(os.environ['WARP'])))
    a2 = np.asarray(S).astype(np.float32); Hs = a2.shape[0]
    yt = np.arange(Hs) / k
    ys = np.interp(yt, np.arange(len(wm)), wm) * k
    ys = np.clip(ys, 0, Hs - 1.001); y0i = np.floor(ys).astype(int); f = (ys - y0i)[:, None, None]
    a2 = a2[y0i] * (1 - f) + a2[np.minimum(y0i + 1, Hs - 1)] * f
    S = Image.fromarray(np.clip(np.rint(a2), 0, 255).astype(np.uint8))
# ---- door surgery: slide each listed building sideways (feathered into the painting)
SHIFT = json.loads(os.environ.get('SHIFT', '{}'))
if SHIFT:
    a = np.asarray(S).copy(); orig = a.copy()
    for b in blds:
        o = int(round(SHIFT.get(b['id'], 0) * k))
        if not o: continue
        x0, x1 = int((b['x'] * T - 12) * k), int(((b['x'] + b['w']) * T + 12) * k)
        y0, y1 = int((b['y'] * T - 14) * k), int(((b['y'] + b['h']) * T + 16) * k)
        a[y0:y1, x0 + o:x1 + o] = orig[y0:y1, x0:x1]
        if o < 0: a[y0:y1, x1 + o:x1] = orig[y0:y1, x1:x1 - o]
        else: a[y0:y1, x0:x0 + o] = orig[y0:y1, x0 - o:x0]
        F = int(round(8 * k))
        X0, X1 = min(x0, x0 + o), max(x1, x1 + o)
        yy, xx = np.mgrid[y0:y1, X0:X1]
        al = np.clip(np.minimum.reduce([xx - X0, X1 - 1 - xx, yy - y0, y1 - 1 - yy]) / F, 0, 1)[..., None]
        a[y0:y1, X0:X1] = np.rint(orig[y0:y1, X0:X1] * (1 - al) + a[y0:y1, X0:X1] * al).astype(np.uint8)
    S = Image.fromarray(a)
A = np.asarray(S.resize((W * T, H * T), Image.BOX)).astype(np.float32)
# ---- patches (1x px)
for x0, y0, x1, y1, sx, sy in json.loads(os.environ.get('PATCH', '[]')):
    A[y0:y1, x0:x1] = A[sy:sy + (y1 - y0), sx:sx + (x1 - x0)]
A0 = A.copy()
# ---- brightness: luminance gain towards the tile render (keeps the night lighting tuning), clipped
old = np.asarray(Image.open('layout_albedo.png').convert('RGB')).astype(np.float32)
lum = lambda v: v @ np.array([0.299, 0.587, 0.114], np.float32)
walk = np.array([[c == '.' for c in r] for r in d['walk']])
m = np.kron(walk, np.ones((T, T), bool))
gain = float(np.clip(lum(old[m]).mean() / lum(A[m]).mean(), 0.8, 1.05))
gain = float(os.environ.get('GAIN', gain))
A = np.clip(A * gain, 0, 255)
print('gain', round(gain, 3))
# ---- windows (emit): warm panes inside the building front bands and the inn's star lantern glow at night
fp = np.zeros(A.shape[:2], bool)
for b in blds: fp[(b['y'] + b['h'] - b['wall']) * T - 8:(b['y'] + b['h']) * T + 6, b['x'] * T - 12:(b['x'] + b['w']) * T + 12] = True
fp[8 * T:11 * T, 12 * T:14 * T] = True   # the inn's star lantern on the wind tower
R_, G_, B_ = A0[..., 0], A0[..., 1], A0[..., 2]
pane = (R_ > 190) & (G_ > 140) & (B_ < 0.55 * R_) & (R_ - B_ > 90) & fp
lab, n = ndimage.label(ndimage.binary_closing(pane, iterations=3))
wins = []
emit = np.zeros(A.shape[:2] + (4,), np.uint8)
for i, sl in enumerate(ndimage.find_objects(lab)):
    ys, xs = sl; h, w = ys.stop - ys.start, xs.stop - xs.start
    comp = lab[sl] == i + 1
    if comp.sum() < 25 or w < 5 or h < 6 or w > 28 or h > 30 or comp.sum() < 0.3 * w * h: continue
    wins.append(dict(kind='win', x=int(xs.start), y=int(ys.start), w=int(w), h=int(h)))
    mm = comp & pane[sl]
    e = emit[sl]
    px = np.clip(A[sl] * 1.12 + np.array([22, 14, 0]), 0, 255)
    e[mm, :3] = px[mm]; e[mm, 3] = 255
print('windows', len(wins))
base = np.rint(A).astype(np.uint8)


def save_set(name, arr, rgba=False):
    im = Image.fromarray(arr.astype(np.uint8), 'RGBA' if rgba else 'RGB')
    im.save(os.path.join(outdir, name + '@32.png'), optimize=True)
    im.resize((W * 24, H * 24), Image.LANCZOS if not rgba else Image.NEAREST).save(os.path.join(outdir, name + '@24.png'), optimize=True)


save_set(NAME, base)
save_set(NAME + '_emit', emit, True)
doors = [dict(x=b['door'][0] * T + 16, y=b['door'][1] * T + 30, id=b['id']) for b in blds if b['door']]   # checked with doorsheet.py after the surgery
json.dump(dict(id=NAME, kind='under', map=NAME, tile=32, size32=[W * T, H * T], windows32=wins, doors32=doors, painted=[],
               files={t: NAME + '@%d.png' % t for t in (24, 32)}), open(os.path.join(outdir, NAME + '.json'), 'w'), indent=1)
Image.fromarray(base).save('proc_last.png')
