"""Raw generations -> walk sheet and run sheet of one party character (96x128 frames, foot anchor 48,120).
Adapted from /home/user/tw/hero/build.py: cut on magenta, per-row uniform resample to the target height, shared palette.
  walk raws: main 4x3 (down, up, left, right) + diag 4x3 (down_left, down_right, up_left, up_right); cols stand, L, R
  run  raws: main 4x4 + diag 4x4, same row order; cols L contact, flight, R contact, flight
usage: python3 build.py <config.json> <out_dir>
config keys: target (sole to skull top of the standing frames), ncol, walk_main, walk_diag, run_main, run_diag,
  run_rows {"right": ["other_raw.png", 3]} (take one run row from another generation: file, raw row index),
  run_scale {"<file>": factor} (overrides the measured run/walk scale of a raw), row_target {"main_2": 76},
  lean {"left": -7}, lift {"left": [0,3,0,3]}, run_dx {"left": [0,1,0,0]}, run_order {"left": [0,1,2,3]}"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixlib as P
from headlib import head_circle, head_fit
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]
os.makedirs(out, exist_ok=True)
TARGET = cfg.get('target', 77)
NCOL = cfg.get('ncol', 28)
CW, CH, AX, AY = 96, 128, 48, 120
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
SRC = [('main', 0), ('main', 2), ('main', 3), ('main', 1), ('diag', 0), ('diag', 1), ('diag', 2), ('diag', 3)]
DIRX = {'left': -1, 'right': 1, 'down_left': -1, 'down_right': 1, 'up_left': -1, 'up_right': 1, 'down': 0, 'up': 0}
_cut = {}


def cut(path, rows, cols):
    if path in _cut:
        return _cut[path]
    rgb = np.array(Image.open(path).convert('RGB'))
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    fg = ~((np.minimum(r, b) - g > 60) & (np.abs(r - b) < 90))
    fg = nd.binary_opening(fg, iterations=1)
    spill = (np.minimum(r, b) - g > 28) & nd.binary_dilation(~fg, iterations=3)      # magenta-blended rim pixels
    fg &= ~spill
    lab, n = nd.label(fg, structure=np.ones((3, 3)))
    sizes = nd.sum(fg, lab, range(1, n + 1)); cents = nd.center_of_mass(fg, lab, range(1, n + 1))
    big = [(i, s, c) for i, (s, c) in enumerate(zip(sizes, cents)) if s >= 60]
    # the grid is where the model drew it: rows / cols from the centres of the big bodies
    main = [(i, s, c) for i, s, c in big if s > 0.25 * max(sizes)]
    assert len(main) == rows * cols, (path, len(main))
    ycs = sorted(c[0] for _, _, c in main); xcs = sorted(c[1] for _, _, c in main)
    rowc = [np.mean(ycs[k * cols:(k + 1) * cols]) for k in range(rows)]
    colc = [np.mean(xcs[k * rows:(k + 1) * rows]) for k in range(cols)]
    cells = {}
    for i, s, c in big:
        key = (int(np.argmin([abs(c[0] - v) for v in rowc])), int(np.argmin([abs(c[1] - v) for v in colc])))
        cells.setdefault(key, np.zeros_like(fg)); cells[key] |= lab == i + 1
    figs = {}
    for key, m in cells.items():
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        figs[key] = (rgb[y0:y1, x0:x1], m[y0:y1, x0:x1], (y0, y1, x0, x1))
    assert len(figs) == rows * cols, sorted(figs)
    _cut[path] = figs
    return figs


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r + r


def skull_top(m, r):
    """top row of the head without a ponytail bump: opening of the upper half with a disk of radius r"""
    h = m.shape[0]
    up = np.pad(m[:int(h * 0.55)], r + 1)
    op = nd.binary_opening(up, structure=disk(r))
    return int(np.where(op.any(1))[0].min()) - (r + 1)


def native(figs):
    profs = []
    for sub, m, _ in figs.values():
        profs += list(P.edge_profiles(sub, m))
    p = P.estimate_period(profs, lo=3.0, hi=12.0)[1]
    res = {}
    for k, (sub, m, _) in figs.items():
        xs, ys, _ = P.fit_grid(sub, m, p_hint=p)
        res[k] = P.sample_grid_avg(sub, m, xs, ys, alpha_min=0.5, dark_L=22.0, dark_frac=0.45, trim=0.3)
    return res, p


def uniform(fig, pal_lab, cell):
    sub, m, _ = fig
    h, w = m.shape
    ny = int(round(h / cell)); nx = int(np.ceil(w / cell))
    ys = np.round(h - cell * np.arange(ny, -1, -1)).astype(int).clip(0, h)          # cuts counted from the feet
    off = (w - nx * cell) / 2.0
    xs = np.round(off + cell * np.arange(0, nx + 1)).astype(int).clip(0, w)
    ys, xs = np.unique(ys), np.unique(xs)
    return P.sample_grid(sub, m, xs, ys, ref_lab=pal_lab, alpha_min=0.5)


def trim(im):
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


# ---- sources: every final row = (file, raw row)
walk_src, run_src = {}, {}
for R, (part, r) in enumerate(SRC):
    walk_src[R] = (cfg['walk_' + part], r)
    if cfg.get('run_' + part):
        run_src[R] = (cfg['run_' + part], r)
for name, (path, r) in cfg.get('run_rows', {}).items():
    run_src[NAMES.index(name)] = (path, r)
HAVE_RUN = len(run_src) == 8
files = sorted(set(p for p, _ in walk_src.values())) + sorted(set(p for p, _ in run_src.values()))
for p in files:
    cut(p, 4, 3 if p in [v[0] for v in walk_src.values()] else 4)

# ---- palette over everything that is used
imgs = []
for p in files:
    used = set(r for q, r in list(walk_src.values()) + list(run_src.values()) if q == p)
    figs = {k: v for k, v in _cut[p].items() if k[0] in used}
    nat, per = native(figs)
    print(p, 'drawn pixel size %.2f px' % per)
    imgs += [trim(v) for v in nat.values()]
pal = P.build_palette(imgs, k=48, merge_de=2.5)
while len(pal) > NCOL:
    cnt = np.zeros(len(pal))
    pl = P.srgb_to_lab(pal.astype(np.float64))
    for im in imgs:
        lab = P.srgb_to_lab(im[..., :3][im[..., 3] > 0].astype(np.float64))
        idx = ((lab[:, None] - pl[None]) ** 2).sum(-1).argmin(1)
        cnt += np.bincount(idx, minlength=len(pal))
    d = np.sqrt(((pl[:, None] - pl[None]) ** 2).sum(-1)); np.fill_diagonal(d, 1e9)
    cost = (cnt + 20) ** 0.5 * d.min(1) ** 2          # few pixels AND a close neighbour -> cheap to drop
    pal = np.delete(pal, cost.argmin(), axis=0)
pal = P.sort_palette(pal)
pal_lab = P.srgb_to_lab(pal.astype(np.float64))
print('palette', len(pal))
for c, l in zip(pal, pal_lab):
    print('  #%02x%02x%02x L=%.0f' % (c[0], c[1], c[2], l[0]))

# ---- scale. walk rows: the standing frame, sole to skull top = TARGET. run rows: walk row's scale x (run raw / walk raw)
ROW_T = cfg.get('row_target', {})
cellw, rawR = {}, {}
for R in range(8):
    path, r = walk_src[R]
    figs = _cut[path]
    m = figs[(r, 0)][1]
    t = skull_top(m, 40)
    tgt = ROW_T.get(NAMES[R], TARGET)
    cellw[R] = (m.shape[0] - t) / float(tgt)
    rawR[R] = float(np.median([head_circle(figs[(r, c)][1])[2] for c in range(3)]))
    print('walk %-10s standing %d px, skull top at %d, cell %.2f px, head radius %.1f px = %.1f art px'
          % (NAMES[R], m.shape[0], t, cellw[R], rawR[R], rawR[R] / cellw[R]))
cellr = {}
if HAVE_RUN:
    # head-normalised: a run row is scaled so that its head is as big as the walk row's head. Trusted where the head
    # circle is a clean measure (front and side views); the back views (ponytail / shield merge into the circle) take
    # the median scale of their file. config run_cell {"up_left": 6.2} overrides (raw px per art px).
    TRUST = ('down', 'left', 'right', 'down_left', 'down_right')
    per = {}
    for R in range(8):
        path, r = run_src[R]
        rr = [head_circle(_cut[path][(r, c)][1])[2] for c in range(4)]
        q = float(np.median(rr)) / rawR[R]
        print('run  %-10s head radius %s -> ratio %.3f -> cell %.2f' % (NAMES[R], ['%.0f' % v for v in rr], q, cellw[R] * q))
        if NAMES[R] in TRUST:
            cellr[R] = cellw[R] * q
            per.setdefault(path, []).append(cellr[R])
    for R in range(8):
        path, r = run_src[R]
        if R not in cellr:
            cellr[R] = float(np.median(per[path]))
        cellr[R] = cfg.get('run_cell', {}).get(NAMES[R], cellr[R])
    print('run cells', {NAMES[R]: round(cellr[R], 2) for R in range(8)})


def make(fig, cell):
    return P.cleanup(P.remap(trim(uniform(fig, pal_lab, cell)), pal), pal)


meta = {'walk': {}, 'run': {}}
sheets = {}
Rart = {}
sheet = np.zeros((8 * CH, 4 * CW, 4), np.uint8)
for R in range(8):
    path, r = walk_src[R]
    fr = [make(_cut[path][(r, c)], cellw[R]) for c in range(3)]
    Rart[R] = float(np.median([head_circle(f[..., 3] > 0)[2] for f in fr]))
    hd = [head_fit(f[..., 3] > 0, Rart[R]) for f in fr]
    for C, c in enumerate([0, 1, 0, 2]):
        im = fr[c]; h, w = im.shape[:2]; a = im[..., 3] > 0
        cx, top, rad = hd[c]
        x0, y0 = C * CW + AX - int(round(cx)), R * CH + AY - (h - 1)
        assert x0 >= C * CW and x0 + w <= (C + 1) * CW and y0 >= R * CH, (NAMES[R], C, w, h, cx)
        sheet[y0:y0 + h, x0:x0 + w][a] = im[a]
        meta['walk']['%d_%d' % (R, C)] = dict(x=x0 - C * CW, y=y0 - R * CH, w=w, h=h, head_top=y0 - R * CH + top, head_r=rad,
                                              head_cx=x0 - C * CW + cx)
    print(' walk %-10s' % NAMES[R], 'head r %.1f' % Rart[R], [(meta['walk']['%d_%d' % (R, C)]['h'], AY - meta['walk']['%d_%d' % (R, C)]['head_top'])
                                                              for C in range(4)])
sheets['walk'] = sheet
if HAVE_RUN:
    sheet = np.zeros((8 * CH, 4 * CW, 4), np.uint8)
    LEAN, LIFT, DX, ORDER = cfg.get('lean', {}), cfg.get('lift', {}), cfg.get('run_dx', {}), cfg.get('run_order', {})
    for R in range(8):
        path, r = run_src[R]
        cell = cellr[R]
        order = ORDER.get(NAMES[R], [0, 1, 2, 3])
        fr = [make(_cut[path][(r, c)], cell) for c in order]
        hd = [head_fit(f[..., 3] > 0, Rart[R]) for f in fr]
        offs = []
        for f, (cx, top, rad) in zip(fr, hd):
            a = f[..., 3] > 0; h = a.shape[0]
            xs = np.where(a[int(h * 0.72):].any(0))[0]
            offs.append(cx - (xs.min() + xs.max() + 1) / 2.0)
        lean = LEAN.get(NAMES[R], float(np.mean(offs)) if DIRX[NAMES[R]] else 0.0)
        # contact frames stand on the ground line; flight frames carry the head 2 px above the contact frames' head
        htop = [f.shape[0] - top for f, (cx, top, rad) in zip(fr, hd)]          # sole to head top
        base = (htop[0] + htop[2]) / 2.0 + 2
        lifts = [0, int(np.clip(round(base - htop[1]), 2, 4)), 0, int(np.clip(round(base - htop[3]), 2, 4))]
        lifts = LIFT.get(NAMES[R], lifts)
        for C in range(4):
            im = fr[C]; h, w = im.shape[:2]; a = im[..., 3] > 0
            cx, top, rad = hd[C]
            dx = DX.get(NAMES[R], [0, 0, 0, 0])[C]
            x0, y0 = C * CW + AX - int(round(cx - lean)) + dx, R * CH + AY - (h - 1) - lifts[C]
            assert x0 >= C * CW and x0 + w <= (C + 1) * CW and y0 >= R * CH, (NAMES[R], C, w, h, cx)
            sheet[y0:y0 + h, x0:x0 + w][a] = im[a]
            meta['run']['%d_%d' % (R, C)] = dict(x=x0 - C * CW, y=y0 - R * CH, w=w, h=h, head_top=y0 - R * CH + top, head_r=rad,
                                                 head_cx=x0 - C * CW + cx, lift=lifts[C])
        print(' run  %-10s' % NAMES[R], 'lean %.1f %s' % (lean, [round(float(o), 1) for o in offs]), 'lifts', lifts,
              'head r', ['%.1f' % h[2] for h in hd], 'sole-to-head', [round(float(v), 1) for v in htop])
    sheets['run'] = sheet
for k, s in sheets.items():
    Image.fromarray(s).save(os.path.join(out, k + '_raw.png'))
    print(k, 'sheet', len(np.unique(s[s[..., 3] > 0][:, :3], axis=0)), 'colours')
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'))
