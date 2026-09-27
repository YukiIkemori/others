"""Painted underlay: 2x generation -> 1x map image (tile 32) + emit + overlay + meta, and 24/40 variants.
usage: python3 process.py <src2x.png> <outdir> [--nocal]"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
d = json.load(open(os.environ.get('MAPDUMP', 'before_data.json')))
rows, leg = d['rows'], d['legend']; W, H = d['w'], d['h']; T = 32
blds = json.load(open('blds.json'))
S2 = Image.open(src).convert('RGB')
# ---- west forest: its canopy leans ~12 px into the walkable x=3 column; shear it back (0 at the corners)
WEST = int(os.environ.get('WEST', '0'))
if WEST:
    a2 = np.asarray(S2).copy(); k = a2.shape[1] // (W * T); o = WEST * k
    for y in range(a2.shape[0]):
        yy = y / k
        f = np.clip((yy - 64) / 64, 0, 1) * np.clip((1100 - yy) / 44, 0, 1)
        sh = int(round(o * f))
        if sh: a2[y, 0:128 * k - sh] = a2[y, sh:128 * k].copy(); a2[y, 128 * k - sh:128 * k] = a2[y, 128 * k:128 * k + sh]
    S2 = Image.fromarray(a2)
# ---- door surgery: slide each building (roof + wall + door path) sideways so its painted door sits on the map's door tile.
# SHIFT = {building id: 1x px (+ right)}; measured with wallsheet.py. Extra rows: h5's steps down through the ledge move with it.
SHIFT = json.loads(os.environ.get('SHIFT', '{}'))
if SHIFT:
    a2 = np.asarray(S2).copy(); orig = a2.copy(); k = a2.shape[1] // (W * T)
    for b in blds:
        o = int(round(SHIFT.get(b['id'], 0) * k))
        if not o: continue
        x0, x1 = (b['x'] * T - 10) * k, ((b['x'] + b['w']) * T + 10) * k
        y0 = (b['y'] * T - (4 if b['y'] <= 3 else 14)) * k
        y1 = ((b['y'] + b['h']) * T + (70 if b['id'] == 'roa_h5' else 14)) * k
        seg = orig[y0:y1, x0:x1].copy()
        a2[y0:y1, x0 + o:x1 + o] = seg
        if o < 0: a2[y0:y1, x1 + o:x1] = orig[y0:y1, x1:x1 - o]
        else: a2[y0:y1, x0:x0 + o] = orig[y0:y1, x0 - o:x0]
    S2 = Image.fromarray(a2)
A = np.asarray(S2.resize((W * T, H * T), Image.BOX)).astype(np.float32)
A0 = A.copy()
old = np.asarray(Image.open('before_albedo.png').convert('RGB')).astype(np.float32)
mat = np.array([[leg[rows[y][x]]['mat'] for x in range(W)] for y in range(H)])
bmask = np.zeros((H, W), bool)
for b in blds: bmask[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']] = True

# ---- colour calibration: affine colour map fitted on ground materials so the night lighting keeps its tuning
if '--nocal' not in sys.argv:
    X, Y, Wt = [], [], []
    for m, w in (('grass', 1.0), ('road', 1.0), ('cobble', 1.0), ('tree', 0.6), ('dirt', 0.5), ('cliff', 0.5)):
        for (y, x) in zip(*np.where((mat == m) & ~bmask)):
            a = A[y*T+6:y*T+26, x*T+6:x*T+26].reshape(-1, 3).mean(0); o = old[y*T+6:y*T+26, x*T+6:x*T+26].reshape(-1, 3).mean(0)
            X.append(np.r_[a, 1]); Y.append(o); Wt.append(w)
    X, Y, Wt = np.array(X), np.array(Y), np.sqrt(np.array(Wt))[:, None]
    M, *_ = np.linalg.lstsq(X * Wt, Y * Wt, rcond=None)
    # keep saturation/contrast of the painting: blend the fitted map with a plain luminance gain
    lumA = (X[:, :3] @ [0.299, 0.587, 0.114]).mean(); lumO = (Y @ [0.299, 0.587, 0.114]).mean()
    flat = A.reshape(-1, 3)
    fit = np.c_[flat, np.ones(len(flat))] @ M
    gain = flat * (lumO / lumA)
    CAL = float(os.environ.get('CAL', '0.5'))
    A = np.clip(fit * CAL + gain * (1 - CAL), 0, 255).reshape(A.shape)
    print('lum', lumA, '->', lumO)

# ---- windows (emit): warm painted panes inside the building walls glow at night (the engine draws this layer after the light map)
R, G, B = A0[..., 0], A0[..., 1], A0[..., 2]
fp = np.zeros(A.shape[:2], bool)
for b in blds: fp[(b['y'] + b['h'] - b['wall']) * T - 6:(b['y'] + b['h']) * T - 2, b['x'] * T - 12:(b['x'] + b['w']) * T + 12] = True
pane = (R > 165) & (G > 115) & (B < 0.62 * R) & (R - B > 75) & fp
lab, n = ndimage.label(ndimage.binary_closing(pane, iterations=2))
wins = []
emit = np.zeros(A.shape[:2] + (4,), np.uint8)
for i, sl in enumerate(ndimage.find_objects(lab)):
    ys, xs = sl; h, w = ys.stop - ys.start, xs.stop - xs.start
    comp = lab[sl] == i + 1
    if comp.sum() < 50 or w < 10 or h < 12 or w > 24 or h > 24 or comp.sum() < 0.35 * w * h: continue
    if '%d,%d' % (xs.start, ys.start) in os.environ.get('DROPWIN', '').split(';'): continue   # hand-checked false hits (flowers)
    wins.append(dict(kind='win', x=int(xs.start), y=int(ys.start), w=int(w), h=int(h)))
    m = comp & pane[sl]
    e = emit[sl]
    px = np.clip(A[sl] * 1.12 + np.array([22, 14, 0]), 0, 255)
    e[m, :3] = px[m]; e[m, 3] = 255
print('windows', len(wins))

# ---- save
def save_set(name, arr, rgba=False):
    im = Image.fromarray(arr.astype(np.uint8), 'RGBA' if rgba else 'RGB')
    im.save(os.path.join(outdir, name + '@32.png'), optimize=True)
    im.resize((W * 24, H * 24), Image.LANCZOS if not rgba else Image.NEAREST).save(os.path.join(outdir, name + '@24.png'), optimize=True)
    im.resize((W * 40, H * 40), Image.NEAREST).save(os.path.join(outdir, name + '@40.png'), optimize=True)
base = np.rint(A).astype(np.uint8)
save_set('roa', base)
save_set('roa_emit', emit, True)
# ---- overlay: canopy pixels that hang over walkable cells just north of a tree mass (drawn above people)
solid_t = (mat == 'tree')
walk_t = np.array([[not leg[rows[y][x]].get('solid') and leg[rows[y][x]].get('walk', True) is not False for x in range(W)] for y in range(H)])
band = np.zeros(A.shape[:2], bool)
for y in range(H - 1):
    for x in range(W):
        if walk_t[y, x] and not bmask[y, x] and solid_t[y + 1, x]: band[y * T + 4:(y + 1) * T, x * T:(x + 1) * T] = True
# colour likelihoods: canopy = deep inside tree masses, ground = grass far from trees
inner = ndimage.binary_erosion(np.kron(solid_t, np.ones((T, T), bool)), iterations=20)
farg = ~ndimage.binary_dilation(np.kron(solid_t | bmask, np.ones((T, T), bool)), iterations=40) & np.kron(mat == 'grass', np.ones((T, T), bool))
Q = (np.clip(A0, 0, 255) // 16).astype(int); qi = Q[..., 0] * 256 + Q[..., 1] * 16 + Q[..., 2]
hc = np.bincount(qi[inner], minlength=4096) + 0.5; hg = np.bincount(qi[farg], minlength=4096) + 0.5
llr = np.log(hc / hc.sum()) - np.log(hg / hg.sum())
score = ndimage.uniform_filter(llr[qi], 5)
can = band & (score > 0.4)
can = ndimage.binary_opening(can, iterations=1)
# keep only pixels connected to the tree mass below
lab, n = ndimage.label(can | (np.kron(solid_t, np.ones((T, T), bool)) & ndimage.binary_dilation(band, iterations=6)))
keep = set(np.unique(lab[np.kron(solid_t, np.ones((T, T), bool))])) - {0}
can = can & np.isin(lab, list(keep))
can = ndimage.binary_fill_holes(ndimage.binary_closing(can, iterations=2)) & band
print('overlay px', int(can.sum()))
Image.fromarray((can * 255).astype(np.uint8)).save('over_mask.png')
os.environ.setdefault('OVER', 'over_mask.png')
ov_path = os.environ.get('OVER')
if ov_path and os.path.exists(ov_path):
    ov = np.asarray(Image.open(ov_path).convert('L')) > 127
    o = np.zeros(A.shape[:2] + (4,), np.uint8); o[..., :3] = base; o[..., 3] = ov * 255
    save_set('roa_over', o, True)
json.dump(dict(id='roa', kind='under', map='roa', tile=32, size32=[W * T, H * T], windows32=wins,
               painted=['fence'], files={t: 'roa@%d.png' % t for t in (24, 32, 40)}), open(os.path.join(outdir, 'roa.json'), 'w'), indent=1)
Image.fromarray(base).save('proc_last.png')
