"""(desert copy of ../dungeon/process.py: run from maps/, src = align.py output; adds the quicksand closed look) Painted DUNGEON underlay: generation -> 1x map image (tile 32) + closed layer + live regions + emit + meta, @24/@32(/@40 when <= 2048 px).
usage: python3 process.py <map> <gen.png> <theme> [name]      -> <map>/out/<name>@t.png, <name>_closed@t.png, <name>_emit@t.png, <name>.json
The painting shows the OPEN state (guide.py). Everything that can change is rebuilt here as the CLOSED look, per live region:
  secret area  (MapUtil.secretAreas: gate cells + the hidden cells behind): wall top cloned from painted rock/wall mass nearby, or a wall face
               cloned from a painted face with the same rise row when the cell below stays open; plus the open-state faces above the hidden floor.
  tilePatch i  (cells whose char differs between the base rows and the patched rows): the base char's look: 'roots'/'bush' tall materials are the
               engine's prop sprites (roots_v*/bush_v*) composited at the cell's feet; solid canopy (forest_dark) is cloned from painted forest.
  The region's cells are every cell where its closed image differs from the painting (so sprite tops reaching into the cell above are included).
env: GAIN=<f> (override the brightness gain)  EMIT=cyan|none (glowing crystal / fungus pixels inside solid cells -> emit layer)
     WARP=<warp.json> (vertical warp from rowwarp.py when the model drifted rows)"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage

m, src, theme = sys.argv[1], sys.argv[2], sys.argv[3]
NAME = sys.argv[4] if len(sys.argv) > 4 else m
outdir = os.path.join(m, os.environ.get('OUT', 'out')); os.makedirs(outdir, exist_ok=True)
d = json.load(open(m + '/layout_data.json')); W, H = d['w'], d['h']; T = 32
L, MI = d['legend'], d['mats']
op = json.load(open(m + '/open.json')); OPEN = op['rows']
FACE = {(x, y): (j, r) for x, y, j, r in op['face']}
BASE = d['rows']   # current rows of the dump (no patches applied unless their cond held at dump time)
# base rows without any tilePatch: rebuild from the map rows = open rows with patch cells reverted is not possible here,
# so take the dump rows (the dump runs on a fresh prologue save: every patch cond is false there)
PROPS = '/home/user/others/chronicle/v2/assets/env/common/props/'
QS = {'Q'}   # quicksand chars (legend name 'quicksand')

S = Image.open(src).convert('RGB')
if os.environ.get('WARP'):
    k = S.height / (H * T)
    wm = np.array(json.load(open(os.environ['WARP'])))
    a2 = np.asarray(S).astype(np.float32); Hs = a2.shape[0]
    ys = np.clip(np.interp(np.arange(Hs) / k, np.arange(len(wm)), wm) * k, 0, Hs - 1.001); y0i = np.floor(ys).astype(int); f = (ys - y0i)[:, None, None]
    S = Image.fromarray(np.clip(np.rint(a2[y0i] * (1 - f) + a2[np.minimum(y0i + 1, Hs - 1)] * f), 0, 255).astype(np.uint8))
A = np.asarray(S.resize((W * T, H * T), Image.BOX)).astype(np.float32)
A0 = A.copy()


def ent(rows, x, y):
    if 0 <= x < W and 0 <= y < H: return L.get(rows[y][x], {'mat': d['outside'], 'solid': True})
    return {'mat': d['outside'], 'solid': True}


def walk(e):
    mi = MI.get(e.get('mat'), {})
    return (not e.get('solid') or e.get('secret')) and e.get('walk') is not False and mi.get('walk') is not False


def raised(e):
    mi = MI.get(e.get('mat'), {})
    return bool(mi.get('face') and (e.get('solid') or e.get('rise')) and e.get('rise', 1) != 0)


# ---- brightness: luminance gain towards the tile render on walkable cells (keeps the night-light tuning)
old = np.asarray(Image.open(m + '/layout_albedo.png').convert('RGB')).astype(np.float32)
lum = lambda v: v @ np.array([0.299, 0.587, 0.114], np.float32)
wm_ = np.array([[c == '.' for c in r] for r in d['walk']])
msk = np.kron(wm_, np.ones((T, T), bool))
gain = float(np.clip(lum(old[msk]).mean() / lum(A[msk]).mean(), 0.7, 1.1))
gain = float(os.environ.get('GAIN', gain))
A = np.clip(A * gain, 0, 255)
print('gain', round(gain, 3))

# ---- cell classes in the open painting
top = np.zeros((H, W), bool); canopy = np.zeros((H, W), bool)
for y in range(H):
    for x in range(W):
        e = ent(OPEN, x, y)
        if (x, y) in FACE: continue
        if raised(e) and not e.get('secret'): top[y, x] = True
        if MI.get(e.get('mat'), {}).get('tall') == 'canopy': canopy[y, x] = True
# ---- wall-top contrast: keep the old top/floor luminance ratio (the painted rock tops come out close to the floor), soft 6 px mask edge
tm = ndimage.gaussian_filter(np.kron(top, np.ones((T, T))).astype(np.float32), 3)
oldr = lum(old[np.kron(top, np.ones((T, T), bool))]).mean() / lum(old[msk]).mean()
newr = lum(A[np.kron(top, np.ones((T, T), bool))]).mean() / lum(A[msk]).mean()
tg = float(np.clip(oldr / newr, 0.6, 1.0)) if top.any() else 1.0
tg = float(os.environ.get('TOPGAIN', tg))
A = A * (1 - tm[..., None] * (1 - tg))
print('top gain', round(tg, 3), 'old ratio', round(float(oldr), 2), 'new ratio', round(float(newr), 2))
# interior cells (all 8 neighbours of the same class) make clean clone sources
interior = lambda c: ndimage.binary_erosion(c, np.ones((3, 3)), border_value=1)
topI, canI = interior(top), interior(canopy)


def cell(a, x, y): return a[y * T:(y + 1) * T, x * T:(x + 1) * T]


def find_offset(cells, ok):
    """nearest (dx, dy) that moves every cell onto an ok[] cell"""
    best = None
    for r in range(1, 30):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r: continue
                if all(0 <= x + dx < W and 0 <= y + dy < H and ok[y + dy, x + dx] for x, y in cells):
                    return dx, dy
    return best


def face_source(j, r, avoid):
    """a painted face cell with the same (j, r), with face neighbours left and right"""
    c = [(x, y) for (x, y), v in FACE.items() if v == (j, r) and (x - 1, y) in FACE and (x + 1, y) in FACE and (x, y) not in avoid]
    return c[len(c) // 2] if c else None


def sprite(name):
    im = Image.open(PROPS + name + '@32.png').convert('RGBA'); j = json.load(open(PROPS + name + '.json'))
    return np.asarray(im).astype(np.float32), j['feet']['32']


def paste_sprite(C, name, fx, fy):
    sp, (ax, ay) = sprite(name)
    x0, y0 = int(round(fx - ax)), int(round(fy - ay)); h, w = sp.shape[:2]
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W * T, x0 + w), min(H * T, y0 + h)
    s = sp[ya - y0:yb - y0, xa - x0:xb - x0]; al = s[..., 3:4] / 255
    C[ya:yb, xa:xb] = C[ya:yb, xa:xb] * (1 - al) + s[..., :3] * al


def quicksand(C, cells, x, y):
    """closed look of a quicksand cell: the painted sand, darker and wetter, with slow sink rings round a few vortex points (pixel-quantised)"""
    cs = set(cells); vort = quicksand.v = getattr(quicksand, 'v', None) or [((cx + 0.5) * T, (cy + 0.5) * T) for i, (cx, cy) in enumerate(sorted(cells)) if i % 5 == 2]
    yy, xx = np.mgrid[y * T:(y + 1) * T, x * T:(x + 1) * T].astype(np.float32)
    dd = np.min([np.hypot(xx - vx, yy - vy) for vx, vy in vort], 0)
    ring = (np.floor(dd / 5) % 2).astype(np.float32)
    # edge fade: cells whose neighbour is not quicksand keep a 5 px rim of dry sand
    ex = np.ones_like(dd)
    for dx, dy, sl in ((-1, 0, (slice(None), slice(0, 5))), (1, 0, (slice(None), slice(T - 5, T))), (0, -1, (slice(0, 5), slice(None))), (0, 1, (slice(T - 5, T), slice(None)))):
        if (x + dx, y + dy) not in cs: ex[sl] = 0.35
    base = cell(C, x, y)
    tone = np.array([0.78, 0.66, 0.52], np.float32) * (0.86 + 0.08 * ring)[..., None] + np.array([0, 0, 0.04])
    k = np.clip(0.25 + 0.75 * np.minimum(1, dd / 40), 0, 1)[..., None] * 0 + ex[..., None]
    cell(C, x, y)[:] = base * (1 - k) + base * tone * k


live = []
CL = A.copy()   # the closed layer (painting + closed looks); drawn per live cell only
# ---- secret areas
for ai, ar in enumerate(d['areas']):
    xy = lambda k: tuple(map(int, k.split(',')))
    gate = [xy(k) for k in ar['gate']]; hid = [xy(k) for k in ar['cells']]
    closed = set(gate) | set(hid)
    faces_above = [(x, y) for (x, y), (j, r) in FACE.items() if (x, y + j) in closed]
    C = A.copy()
    # closed look per cell: face when the cell below (closed state) is open floor within the wall's rise, else wall top
    wall = next((L[c] for c in L if L[c].get('secret')), {})
    rr = max(1, wall.get('rise') or 1)
    tops, fcs = [], []
    rc = lambda x, y: (x, y) in closed or not (0 <= y < H) or raised(ent(OPEN, x, y))
    for (x, y) in sorted(closed):
        j = 1
        while j <= rr and rc(x, y + j): j += 1
        if j <= rr: fcs.append((x, y, j))
        else: tops.append((x, y))
    tops += faces_above
    # a ring of plain wall-top cells around them (the painting's room edge may bleed a few px into its neighbours)
    ring = {(x + dx, y + dy) for (x, y) in closed | set(faces_above) for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    tops += [q for q in sorted(ring) if 0 <= q[0] < W and 0 <= q[1] < H and top[q[1], q[0]] and q not in tops]
    off = find_offset(tops, topI) or find_offset(tops, top)
    for (x, y) in tops: cell(C, x, y)[:] = cell(A, x + off[0], y + off[1])
    for (x, y, j) in fcs:
        s = face_source(j, rr, closed)
        if s: cell(C, x, y)[:] = cell(A, *s)
        else: cell(C, x, y)[:] = cell(A, x + off[0], y + off[1])
    cells = sorted(set(tops) | {(x, y) for x, y, _ in fcs})
    for (x, y) in cells: cell(CL, x, y)[:] = cell(C, x, y)
    live.append({'cells': [[x, y] for x, y in cells], 'secret': ar['gate'][0]})
    print('secret', ar['gate'], 'cells', len(cells), 'clone', off, 'faces', len(fcs))
# ---- tilePatches
for pi, p in enumerate(d['tilePatches']):
    if not (p.get('rows') and p.get('rect')): continue
    px, py = p['rect'][:2]; ch = []
    for dy, r in enumerate(p['rows']):
        for dx, c in enumerate(r):
            x, y = px + dx, py + dy
            if c != ' ' and BASE[y][x] != c: ch.append((x, y))
    if not ch: continue
    C = A.copy()
    can = [(x, y) for x, y in ch if MI.get(ent(BASE, x, y)['mat'], {}).get('tall') in ('canopy',) or BASE[y][x] in 'b']
    if can:
        off = find_offset(can, canI) or find_offset(can, canopy)
        for (x, y) in can: cell(C, x, y)[:] = cell(A, x + off[0], y + off[1])
    for (x, y) in sorted(ch, key=lambda q: q[1]):
        tall = MI.get(ent(BASE, x, y)['mat'], {}).get('tall')
        v = (x * 7 + y * 3) % 2
        if tall == 'roots': paste_sprite(C, 'roots_v%d' % v, (x + 0.5) * T, (y + 0.86) * T)
        elif tall == 'bush': paste_sprite(C, 'bush_v%d' % v, (x + 0.5) * T, (y + 0.86) * T)
        elif ent(BASE, x, y).get('name') == 'quicksand': quicksand(C, ch, x, y)
    diff = np.abs(C - A).sum(-1) > 1
    cells = [(x, y) for y in range(H) for x in range(W) if cell(diff, x, y).any()]
    for (x, y) in cells: cell(CL, x, y)[:] = cell(C, x, y)
    live.append({'cells': [[x, y] for x, y in cells], 'patch': pi})
    print('patch', pi, p.get('cond'), 'cells', len(cells))

# ---- emit: glowing crystal / fungus pixels inside solid cells
emit = np.zeros(A.shape[:2] + (4,), np.uint8)
if os.environ.get('EMIT', 'cyan') == 'cyan':
    sol = np.kron(np.array([[not walk(ent(OPEN, x, y)) for x in range(W)] for y in range(H)]), np.ones((T, T), bool))
    R_, G_, B_ = A0[..., 0], A0[..., 1], A0[..., 2]
    glow = (B_ > 150) & (G_ > 130) & (R_ < 0.8 * B_) & (B_ - R_ > 50) & sol
    glow = ndimage.binary_opening(glow, iterations=1) | (glow & ndimage.binary_dilation(ndimage.binary_opening(glow), iterations=1))
    px = np.clip(A0 * 1.1 + np.array([10, 20, 30]), 0, 255)
    emit[glow, :3] = px[glow]; emit[glow, 3] = 230
    print('emit px', int(glow.sum()))

sizes = [24, 32] + ([40] if max(W, H) * 40 <= 2048 else [])


def save_set(name, arr, rgba=False):
    im = Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), 'RGBA' if rgba else 'RGB')
    for t in sizes:
        (im if t == 32 else im.resize((W * t, H * t), Image.NEAREST if rgba or t > 32 else Image.LANCZOS)).save(os.path.join(outdir, '%s@%d.png' % (name, t)), optimize=True)


save_set(NAME, A)
if live:   # only the live cells are kept (transparent elsewhere: small files; the engine draws the closed layer per live cell)
    am = np.zeros((H * T, W * T), np.uint8)
    for Lr in live:
        for x, y in Lr['cells']: am[y * T:(y + 1) * T, x * T:(x + 1) * T] = 255
    save_set(NAME + '_closed', np.dstack([CL * (am[..., None] > 0), am]), True)
if emit[..., 3].any(): save_set(NAME + '_emit', emit, True)
json.dump(dict(id=NAME, kind='under', map=m, tile=32, size32=[W * T, H * T], windows32=[], painted=[], live=live, gain=round(gain, 3),
               files={t: NAME + '@%d.png' % t for t in sizes}), open(os.path.join(outdir, NAME + '.json'), 'w'), indent=1)
Image.fromarray(np.clip(np.rint(CL), 0, 255).astype(np.uint8)).save(m + '/proc_closed.png')
Image.fromarray(np.clip(np.rint(A), 0, 255).astype(np.uint8)).save(m + '/proc_open.png')
print('live', len(live), 'sizes', sizes, '->', outdir)
