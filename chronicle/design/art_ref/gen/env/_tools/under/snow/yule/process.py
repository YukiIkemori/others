"""Painted Yule underlay: generation (1.5x) -> vertical warp (warp.json) -> door surgery (SHIFT) -> 1x map image + emit + meta (@24/@32).
usage: python3 process.py <src.png> <outdir>   env SHIFT=[[x0,y0,x1,y1,dx,dy],...] in 1x px"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
d = json.load(open('layout_data.json')); W, H = d['w'], d['h']; T = 32
blds = json.load(open('blds.json'))
S = np.asarray(Image.open(src).convert('RGB'))
k = S.shape[1] / (W * T)
# ---- vertical warp (the model drifts rows downwards in the lower half)
wp = np.array(json.load(open('warp.json')))
tail = int(os.environ.get('TAIL', 1480))
wp[tail:] = np.linspace(wp[tail], H * T - 1, H * T - tail)
Hs = S.shape[0]
py = np.interp(np.arange(Hs) / k, np.arange(H * T), wp) * k
S = S[np.clip(np.rint(py).astype(int), 0, Hs - 1)]
# ---- door surgery
SHIFT = json.loads(os.environ.get('SHIFT', '[]'))
a = S.copy(); orig = S.copy()
for sh in SHIFT:
    x0, y0, x1, y1, dx, dy = [int(round(v * k)) for v in sh[:6]]
    seg = orig[y0:y1, x0:x1].copy()
    a[y0 + dy:y1 + dy, x0 + dx:x1 + dx] = seg
    if dx > 0: a[y0:y1, x0:x0 + dx] = orig[y0:y1, x0 - dx:x0]
    elif dx < 0: a[y0:y1, x1 + dx:x1] = orig[y0:y1, x1:x1 - dx]
    if dy > 0: a[y0:y0 + dy, x0:x1] = orig[y0 - dy:y0, x0:x1]
    elif dy < 0: a[y1 + dy:y1, x0:x1] = orig[y1:y1 - dy, x0:x1]
    F = int(round(8 * k))
    X0, X1, Y0, Y1 = min(x0, x0 + dx), max(x1, x1 + dx), min(y0, y0 + dy), max(y1, y1 + dy)
    yy, xx = np.mgrid[Y0:Y1, X0:X1]
    al = np.clip(np.minimum.reduce([xx - X0, X1 - 1 - xx, yy - Y0, Y1 - 1 - yy]) / F, 0, 1)[..., None]
    a[Y0:Y1, X0:X1] = np.rint(orig[Y0:Y1, X0:X1] * (1 - al) + a[Y0:Y1, X0:X1] * al).astype(np.uint8)
    orig = a.copy()
Image.fromarray(a).save('surgery_last.png')
A = np.asarray(Image.fromarray(a).resize((W * T, H * T), Image.BOX)).astype(np.float32)
A0 = A.copy()
# ---- brightness: luminance gain towards the tile render on walkable ground (keeps the night lighting tuning), clipped
old = np.asarray(Image.open('layout_albedo.png').convert('RGB')).astype(np.float32)
lum = lambda v: v @ np.array([0.299, 0.587, 0.114], np.float32)
walk = np.array([[c == '.' for c in r] for r in d['walk']])
m = np.kron(walk, np.ones((T, T), bool))
gain = float(np.clip(lum(old[m]).mean() / lum(A[m]).mean(), 0.8, 1.05))
gain = float(os.environ.get('GAIN', gain))
A = np.clip(A * gain, 0, 255)
print('gain', round(gain, 3))
# ---- windows (emit): warm panes inside the building fronts glow at night
fp = np.zeros(A.shape[:2], bool)
for b in blds: fp[(b['y']) * T:(b['y'] + b['h']) * T + 12, b['x'] * T - 12:(b['x'] + b['w']) * T + 12] = True
R_, G_, B_ = A0[..., 0], A0[..., 1], A0[..., 2]
pane = (R_ > 170) & (G_ > 120) & (B_ < 0.62 * R_) & (R_ - B_ > 75) & fp
lab, n = ndimage.label(ndimage.binary_closing(pane, iterations=3))
wins = []
emit = np.zeros(A.shape[:2] + (4,), np.uint8)
for i, sl in enumerate(ndimage.find_objects(lab)):
    ys, xs = sl; h, w = ys.stop - ys.start, xs.stop - xs.start
    comp = lab[sl] == i + 1
    if comp.sum() < 20 or w < 5 or h < 5 or w > 30 or h > 30 or comp.sum() < 0.3 * w * h: continue
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
    if W * 40 <= 2048 and H * 40 <= 2048:
        im.resize((W * 40, H * 40), Image.NEAREST).save(os.path.join(outdir, name + '@40.png'), optimize=True)
save_set('yule', base)
save_set('yule_emit', emit, True)
doors = [dict(x=b['door'][0] * T + 16, y=b['door'][1] * T + 30, id=b['id']) for b in blds if b.get('door')]
sizes = (24, 32, 40) if W * 40 <= 2048 and H * 40 <= 2048 else (24, 32)
json.dump(dict(id='yule', kind='under', map='yule', tile=32, size32=[W * T, H * T], windows32=wins, doors32=doors,
               painted=[], files={t: 'yule@%d.png' % t for t in sizes}), open(os.path.join(outdir, 'yule.json'), 'w'), indent=1)
Image.fromarray(base).save('proc_last.png')
