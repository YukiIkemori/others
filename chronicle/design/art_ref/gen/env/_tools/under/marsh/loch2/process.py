"""Painted Loch underlay: generation (2016x1872 = 36 px/tile) -> global vertical shift (DY) -> door surgery (SHIFT, 1x px) -> 1x map image + emit + meta (@24/@32).
usage: python3 process.py <src.png> <outdir>   env DY=<1x px, negative = up>  SHIFT=[[x0,y0,x1,y1,dx,dy],...] in 1x px  GAIN=<f>  NAME=loch"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
src, outdir = sys.argv[1], sys.argv[2]
NAME = os.environ.get('NAME', 'loch')
os.makedirs(outdir, exist_ok=True)
d = json.load(open('layout.json')); W, H = d['w'], d['h']; T = 32
blds = json.load(open('blds.json'))
S = np.asarray(Image.open(src).convert('RGB'))
k = S.shape[1] / (W * T)
DY = float(os.environ.get('DY', 0))
if DY:
    n = int(round(-DY * k))
    if n > 0: S = np.concatenate([S[n:], np.repeat(S[-1:], n, 0)], 0)
    elif n < 0: S = np.concatenate([np.repeat(S[:1], -n, 0), S[:n]], 0)
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
A = np.asarray(Image.fromarray(a).resize((W * T, H * T), Image.BOX)).astype(np.float32)
# 描かれた看板を板壁で塗りつぶす（2026-09-30: 町の吊り看板（道具・酒場・武具の印）と二重になっていた。絵の看板は魚・鐘・花で店の印として読めない）
#   PAINTOUT=[[x0,y0,x1,y1,wx0,wx1],...]（1x px）: 看板の四角を、同じ行の板壁（wx0..wx1 の中、板の周期ずらし）の列で埋める。灯りの列は使わない
PO = json.loads(os.environ.get('PAINTOUT', '[]'))
if PO:
    Lw = A @ np.array([0.299, 0.587, 0.114], np.float32)
    for x0, y0, x1, y1, wx0, wx1 in PO:
        row = Lw[y1 + 2:y1 + 8, wx0:wx1].mean(0); row = row - row.mean()
        P = min(range(8, 25), key=lambda s_: np.mean((row[s_:] - row[:-s_]) ** 2))   # 板の周期
        warm = (A[..., 0] > 190) & (A[..., 1] > 160) & (A[..., 2] < 140)   # 灯り（明るい黄）。金具の暗い縁ごと避ける
        warm = ndimage.binary_dilation(warm, np.ones((9, 13), bool))
        for x in range(x0, x1):
            cand = [x + sg * P * n for n in range(1, 12) for sg in (-1, 1)]
            cand = [c for c in sorted(cand, key=lambda c: abs(c - x)) if wx0 <= c < wx1 and not (x0 - 2 <= c < x1 + 2) and not warm[y0:y1, max(0, c - 2):c + 3].any()]
            if cand: A[y0:y1, x] = A[y0:y1, cand[0]]
    print('paintout', len(PO), 'period', P)
A0 = A.copy()
gain = float(os.environ.get('GAIN', 0.9))
A = np.clip(A * gain, 0, 255)
# windows (emit): warm panes inside the building fronts
fp = np.zeros(A.shape[:2], bool)
for b in blds: fp[max(0, b['y'] * T - 12):(b['y'] + b['h']) * T + 12, max(0, b['x'] * T - 12):(b['x'] + b['w']) * T + 12] = True
R_, G_, B_ = A0[..., 0], A0[..., 1], A0[..., 2]
pane = (R_ > 170) & (G_ > 120) & (B_ < 0.62 * R_) & (R_ - B_ > 75) & fp
lab, n = ndimage.label(ndimage.binary_closing(pane, iterations=2))
wins = []
emit = np.zeros(A.shape[:2] + (4,), np.uint8)
for i, sl in enumerate(ndimage.find_objects(lab)):
    ys, xs = sl; h, w = ys.stop - ys.start, xs.stop - xs.start
    comp = lab[sl] == i + 1
    if comp.sum() < 12 or w < 4 or h < 4 or w > 30 or h > 30 or comp.sum() < 0.3 * w * h: continue
    wins.append(dict(kind='win', x=int(xs.start), y=int(ys.start), w=int(w), h=int(h)))
    mm = comp & pane[sl]
    e = emit[sl]
    px = np.clip(A[sl] * 1.12 + np.array([22, 14, 0]), 0, 255)
    e[mm, :3] = px[mm]; e[mm, 3] = 255
print('windows', len(wins), 'gain', gain)
base = np.rint(A).astype(np.uint8)
def save_set(name, arr, rgba=False):
    im = Image.fromarray(arr.astype(np.uint8), 'RGBA' if rgba else 'RGB')
    im.save(os.path.join(outdir, name + '@32.png'), optimize=True)
    im.resize((W * 24, H * 24), Image.LANCZOS if not rgba else Image.NEAREST).save(os.path.join(outdir, name + '@24.png'), optimize=True)
    if W * 40 <= 2048 and H * 40 <= 2048:
        im.resize((W * 40, H * 40), Image.NEAREST).save(os.path.join(outdir, name + '@40.png'), optimize=True)
save_set(NAME, base)
save_set(NAME + '_emit', emit, True)
doors = [dict(x=b['door'][0] * T + 16, y=b['door'][1] * T + 30, id=b['id']) for b in blds if b.get('door')]
sizes = (24, 32, 40) if W * 40 <= 2048 and H * 40 <= 2048 else (24, 32)
meta = dict(id=NAME, kind='under', map=NAME, tile=32, size32=[W * T, H * T], windows32=wins, doors32=doors, painted=[], files={t: '%s@%d.png' % (NAME, t) for t in sizes})
extra = os.environ.get('META')
if extra: meta.update(json.loads(open(extra).read()))
json.dump(meta, open(os.path.join(outdir, NAME + '.json'), 'w'), indent=1)
Image.fromarray(base).save('proc_last.png')
