"""Painted underlay for Yura: 2x generation -> 1x map image (tile 32) + emit + overlay + meta, and 24/40 variants.
usage: python3 yprocess.py <src2x.png> <outdir>   env: SHIFT (json {bld id: 1x px}), CAL (0..1 or 'off'), DROPWIN, ADDWIN"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
src, outdir = sys.argv[1], sys.argv[2]
NAME = 'yura'
os.makedirs(outdir, exist_ok=True)
d = json.load(open(os.environ.get('MAPDUMP', 'lay_data.json')))
rows, leg = d['rows'], d['legend']; W, H = d['w'], d['h']; T = 32
blds = json.load(open('blds.json'))
S2 = Image.open(src).convert('RGB')
if S2.size != (W * T * 2, H * T * 2): S2 = S2.resize((W * T * 2, H * T * 2), Image.LANCZOS)
# ---- door surgery: slide a hut (roof + wall) sideways so its painted door sits on the door tile
SHIFT = json.loads(os.environ.get('SHIFT', '{}'))
if SHIFT:
    a2 = np.asarray(S2).copy(); orig = a2.copy(); k = 2
    for b in blds:
        o = int(round(SHIFT.get(b['id'], 0) * k))
        if not o: continue
        x0, x1 = (b['x'] * T - 10) * k, ((b['x'] + b['w']) * T + 10) * k
        y0 = (b['y'] * T - 10) * k; y1 = ((b['y'] + b['h']) * T + 10) * k
        seg = orig[y0:y1, x0:x1].copy()
        a2[y0:y1, x0 + o:x1 + o] = seg
        if o < 0: a2[y0:y1, x1 + o:x1] = orig[y0:y1, x1:x1 - o]
        else: a2[y0:y1, x0:x0 + o] = orig[y0:y1, x0 - o:x0]
    S2 = Image.fromarray(a2)
A = np.asarray(S2.resize((W * T, H * T), Image.BOX)).astype(np.float32)
A0 = A.copy()
mat = np.array([[leg[rows[y][x]]['mat'] for x in range(W)] for y in range(H)])
chr_ = np.array([[rows[y][x] for x in range(W)] for y in range(H)])
bmask = np.zeros((H, W), bool)
for b in blds: bmask[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']] = True
# ---- brightness: plain luminance gain towards the tile render so the night lighting keeps its tuning
CAL = os.environ.get('CAL', '0.5')
if CAL != 'off':
    old = np.asarray(Image.open('lay_albedo.png').convert('RGB')).astype(np.float32)
    X, Y = [], []
    for (y, x) in zip(*np.where(np.isin(mat, ['grass', 'dirt', 'moss_earth']) & ~bmask)):
        X.append(A[y*T+6:y*T+26, x*T+6:x*T+26].reshape(-1, 3).mean(0)); Y.append(old[y*T+6:y*T+26, x*T+6:x*T+26].reshape(-1, 3).mean(0))
    lumA = (np.array(X) @ [0.299, 0.587, 0.114]).mean(); lumO = (np.array(Y) @ [0.299, 0.587, 0.114]).mean()
    gk = 1 + (lumO / lumA - 1) * float(CAL)
    A = np.clip(A * gk, 0, 255)
    print('lum', round(lumA, 1), '->', round(lumO, 1), 'gain', round(gk, 3))
# ---- windows (emit): warm painted panes inside the hut walls
R_, G_, B_ = A0[..., 0], A0[..., 1], A0[..., 2]
fp = np.zeros(A.shape[:2], bool)
for b in blds:
    x0 = b['x'] * T - 6; x1 = (b['x'] + b['w']) * T + 6
    if b['id'] == 'yura_mill': x1 = (b['x'] + 5) * T
    fp[(b['y'] + b['h'] - b['wall']) * T - 10:(b['y'] + b['h']) * T - 2, x0:x1] = True
pane = (R_ > 165) & (G_ > 115) & (B_ < 0.62 * R_) & (R_ - B_ > 75) & fp
lab, n = ndimage.label(ndimage.binary_closing(pane, iterations=2))
wins = []
emit = np.zeros(A.shape[:2] + (4,), np.uint8)
drop = [s for s in os.environ.get('DROPWIN', '').split(';') if s]
for i, sl in enumerate(ndimage.find_objects(lab)):
    ys, xs = sl; h, w = ys.stop - ys.start, xs.stop - xs.start
    comp = lab[sl] == i + 1
    if comp.sum() < 30 or w < 7 or h < 8 or w > 26 or h > 26 or comp.sum() < 0.3 * w * h: continue
    if '%d,%d' % (xs.start, ys.start) in drop: continue
    wins.append(dict(kind='win', x=int(xs.start), y=int(ys.start), w=int(w), h=int(h)))
    m = comp & pane[sl]
    e = emit[sl]
    px = np.clip(A[sl] * 1.12 + np.array([22, 14, 0]), 0, 255)
    e[m, :3] = px[m]; e[m, 3] = 255
print('windows', len(wins), [(w['x'], w['y'], w['w'], w['h']) for w in wins])

def save_set(name, arr, rgba=False):
    im = Image.fromarray(arr.astype(np.uint8), 'RGBA' if rgba else 'RGB')
    im.save(os.path.join(outdir, name + '@32.png'), optimize=True)
    im.resize((W * 24, H * 24), Image.LANCZOS if not rgba else Image.NEAREST).save(os.path.join(outdir, name + '@24.png'), optimize=True)
    im.resize((W * 40, H * 40), Image.NEAREST).save(os.path.join(outdir, name + '@40.png'), optimize=True)
base = np.rint(A).astype(np.uint8)
save_set(NAME, base)
save_set(NAME + '_emit', emit, True)
# ---- overlay: pixels of a solid mass (tree canopy, hut roof, the wheel) that hang over the walkable row just north of it (drawn above people)
K = np.ones((T, T), bool)
walk_t = np.array([[not leg[rows[y][x]].get('solid') and leg[rows[y][x]].get('walk', True) is not False for x in range(W)] for y in range(H)])
Q = (np.clip(A0, 0, 255) // 16).astype(int); qi = Q[..., 0] * 256 + Q[..., 1] * 16 + Q[..., 2]
ground = ~ndimage.binary_dilation(np.kron(~walk_t | bmask, K), iterations=10) & np.kron(walk_t & ~bmask, K)
hg = np.bincount(qi[ground], minlength=4096) + 0.5
def mass_overlay(solid_t, depth):
    inner = ndimage.binary_erosion(np.kron(solid_t, K), iterations=8)
    hc = np.bincount(qi[inner], minlength=4096) + 0.5
    llr = np.log(hc / hc.sum()) - np.log(hg / hg.sum())
    score = ndimage.uniform_filter(llr[qi], 5)
    band = np.zeros(A.shape[:2], bool)
    for y in range(H - 1):
        for x in range(W):
            if walk_t[y, x] and not bmask[y, x] and solid_t[y + 1, x]: band[(y + 1) * T - depth:(y + 1) * T, x * T:(x + 1) * T] = True
    can = band & (score > 0.4)
    can = ndimage.binary_opening(can, iterations=1)
    S = np.kron(solid_t, K)
    lab, n = ndimage.label(can | (S & ndimage.binary_dilation(band, iterations=6)))
    keep = set(np.unique(lab[S])) - {0}
    can = can & np.isin(lab, list(keep))
    return ndimage.binary_fill_holes(ndimage.binary_closing(can, iterations=2)) & band
treeT = np.isin(mat, ['tree', 'forest_dark'])
ov = mass_overlay(treeT, 28) | mass_overlay(bmask, 14)
print('overlay px', int(ov.sum()))
Image.fromarray((ov * 255).astype(np.uint8)).save('over_mask.png')
o = np.zeros(A.shape[:2] + (4,), np.uint8); o[..., :3] = base * ov[..., None]; o[..., 3] = ov * 255
save_set(NAME + '_over', o, True)
doors = [dict(id=b['id'], x=b['door'][0] * T + 16, y=b['door'][1] * T + 16) for b in blds if b.get('door')]
json.dump(dict(id=NAME, kind='under', map=NAME, tile=32, size32=[W * T, H * T], windows32=wins, doors32=doors,
               painted=[], files={t: NAME + '@%d.png' % t for t in (24, 32, 40)}), open(os.path.join(outdir, NAME + '.json'), 'w'), indent=1)
Image.fromarray(base).save('proc_last.png')
