"""Raw sheets (main 4x3: down, up, left, right; diag 4x3: down_left, down_right, up_left, up_right; cols stand, L, R)
-> hero sheet 384x1024 (96x128 frames, foot anchor 48,120), figure 80 art px tall, <= 28 colours, soft outline.
usage: python3 build.py <sprite_pipe/tools dir> <main_raw.png> <diag_raw.png> <out_dir> [mode a|b] [ncolors]
  mode a: sample the raw directly on a uniform grid of (figure px / 80), majority of palette colours per cell
  mode b: sample on the drawn grid, then pixlib.rescale_pixel to 80"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
tools, main_p, diag_p, out = sys.argv[1:5]
mode = sys.argv[5] if len(sys.argv) > 5 else 'a'
NCOL = int(sys.argv[6]) if len(sys.argv) > 6 else 26
sys.path.insert(0, tools)
import pixlib as P
TARGET = 80
CW, CH, AX, AY = 96, 128, 48, 120
os.makedirs(out, exist_ok=True)


def cut(path, rows=4, cols=3):
    rgb = np.array(Image.open(path).convert('RGB'))
    H, W = rgb.shape[:2]
    ch, cw = H / rows, W / cols
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    fg = ~((np.minimum(r, b) - g > 60) & (np.abs(r - b) < 90))
    fg = nd.binary_opening(fg, iterations=1)
    spill = (np.minimum(r, b) - g > 28) & nd.binary_dilation(~fg, iterations=3)      # magenta-blended rim pixels
    fg &= ~spill
    lab, n = nd.label(fg, structure=np.ones((3, 3)))
    sizes = nd.sum(fg, lab, range(1, n + 1)); cents = nd.center_of_mass(fg, lab, range(1, n + 1))
    cells = {}
    for i, (s, c) in enumerate(zip(sizes, cents)):
        if s < 60:
            continue
        key = (min(rows - 1, int(c[0] // ch)), min(cols - 1, int(c[1] // cw)))
        cells.setdefault(key, np.zeros_like(fg)); cells[key] |= lab == i + 1
    figs = {}
    for key, m in cells.items():
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        figs[key] = (rgb[y0:y1, x0:x1], m[y0:y1, x0:x1])
    assert len(figs) == rows * cols, sorted(figs)
    return figs


def native(figs):
    profs = []
    for sub, m in figs.values():
        profs += list(P.edge_profiles(sub, m))
    p = P.estimate_period(profs, lo=3.0, hi=12.0)[1]
    res = {}
    for k, (sub, m) in figs.items():
        xs, ys, _ = P.fit_grid(sub, m, p_hint=p)
        res[k] = P.sample_grid_avg(sub, m, xs, ys, alpha_min=0.5, dark_L=22.0, dark_frac=0.45, trim=0.3)
    return res, p


def uniform(figs, pal, cell):
    pl = P.srgb_to_lab(pal.astype(np.float64))
    res = {}
    for k, (sub, m) in figs.items():
        h, w = m.shape
        ny = int(round(h / cell)); nx = int(np.ceil(w / cell))
        ys = np.round(h - cell * np.arange(ny, -1, -1)).astype(int).clip(0, h)          # cuts counted from the feet
        off = (w - nx * cell) / 2.0
        xs = np.round(off + cell * np.arange(0, nx + 1)).astype(int).clip(0, w)
        ys, xs = np.unique(ys), np.unique(xs)
        res[k] = P.sample_grid(sub, m, xs, ys, ref_lab=pl, alpha_min=0.5)
    return res


def trim(im):
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


sheets = {'main': cut(main_p), 'diag': cut(diag_p)}
nat = {}
for name, figs in sheets.items():
    nat[name], p = native(figs)
    hs = [figs[(r, 0)][0].shape[0] for r in range(4)]
    print(name, 'drawn pixel size %.2f px; standing figures %s px tall' % (p, hs))
imgs = [trim(v) for d in nat.values() for v in d.values()]
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
print('palette', len(pal))

ROW_T = {'main': [80, 80, 78, 78], 'diag': [80, 80, 80, 80]}   # standing height per raw row (profiles are drawn a little shorter)
frames = {}
pl_lab = P.srgb_to_lab(pal.astype(np.float64))
for name, figs in sheets.items():
    for r in range(4):
        cell = figs[(r, 0)][0].shape[0] / float(ROW_T[name][r])
        res = uniform({(r, c): figs[(r, c)] for c in range(3)}, pal, cell)
        for k, v in res.items():
            frames[(name,) + k] = P.cleanup(P.remap(trim(v), pal), pal)
np.savez(os.path.join(out, 'frames.npz'), pal=pal, **{'%s_%d_%d' % k: v for k, v in frames.items()})

# ---- sheet: rows down, left, right, up, down_left, down_right, up_left, up_right; cols stand, left foot, stand, right foot
SRC = [('main', 0), ('main', 2), ('main', 3), ('main', 1), ('diag', 0), ('diag', 1), ('diag', 2), ('diag', 3)]
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
sheet = np.zeros((8 * CH, 4 * CW, 4), np.uint8)
place = {}
for R, (name, r) in enumerate(SRC):
    for C, c in enumerate([0, 1, 0, 2]):
        im = frames[(name, r, c)]
        h, w = im.shape[:2]
        a = im[..., 3] > 0
        xs = np.where(a[:20].any(0))[0]
        hx = int(round((xs.min() + xs.max()) / 2.0))          # head centre = anchor column
        x0, y0 = C * CW + AX - hx, R * CH + AY - (h - 1)
        assert x0 >= C * CW and x0 + w <= (C + 1) * CW and y0 >= R * CH, (NAMES[R], C, w, h, hx)
        sheet[y0:y0 + h, x0:x0 + w][a] = im[a]
        place[(R, C)] = (x0 - C * CW, y0 - R * CH, w, h)
Image.fromarray(sheet).save(os.path.join(out, 'sheet_raw.png'))
ncol = len(np.unique(sheet[sheet[..., 3] > 0][:, :3], axis=0))
print('sheet', sheet.shape, ncol, 'colours')
for R in range(8):
    print(' ', NAMES[R], [place[(R, C)] for C in range(4)])
lab = P.srgb_to_lab(pal.astype(np.float64))
for c, l in zip(pal, lab):
    print('  #%02x%02x%02x L=%.0f' % (c[0], c[1], c[2], l[0]))
