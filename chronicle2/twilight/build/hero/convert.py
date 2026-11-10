"""raw magenta sheet (grid of 640x512 cells, any rows x cols) -> native 1-px-per-dot RGBA frames (.npz) + a report.
Own simple cutter: no assumptions about proportions.
usage: python3 convert.py <sprite_pipe/tools dir> <raw.png> <out prefix> <rows> <cols> [p_hint]"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
tools, raw_p, out, rows, cols = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
p_hint = float(sys.argv[6]) if len(sys.argv) > 6 else None
uniform = len(sys.argv) > 7 and sys.argv[7] == 'u'
sys.path.insert(0, tools)
import pixlib as P

rgb = np.array(Image.open(raw_p).convert('RGB'))
H, W = rgb.shape[:2]
ch, cw = H // rows, W // cols
r, g, b = [rgb[..., i].astype(int) for i in range(3)]
bg = (np.minimum(r, b) - g > 60) & (np.abs(r - b) < 90)
fg = ~bg
fg = nd.binary_opening(fg, iterations=1)
lab, n = nd.label(fg, structure=np.ones((3, 3)))
sizes = nd.sum(fg, lab, range(1, n + 1))
cents = nd.center_of_mass(fg, lab, range(1, n + 1))
cellmask = {}
for i, (s, c) in enumerate(zip(sizes, cents)):
    if s < 40:
        continue
    key = (min(rows - 1, int(c[0] // ch)), min(cols - 1, int(c[1] // cw)))
    cellmask.setdefault(key, np.zeros_like(fg))
    cellmask[key] |= lab == i + 1
# pixel size: one estimate for the whole sheet
profs = []
boxes = {}
for key, m in cellmask.items():
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    boxes[key] = (y0, y1, x0, x1)
    gx, gy = P.edge_profiles(rgb[y0:y1, x0:x1], m[y0:y1, x0:x1])
    profs += [gx, gy]
p_est, p_peak = P.estimate_period(profs, lo=2.5, hi=8.0)
p = p_hint or p_est
print('pixel size: estimate %.2f (peak %.2f), using %.2f' % (p_est, p_peak, p))
frames = {}
for key in sorted(boxes):
    y0, y1, x0, x1 = boxes[key]
    sub, m = rgb[y0:y1, x0:x1], cellmask[key][y0:y1, x0:x1]
    xs, ys, _ = P.fit_grid(sub, m, p_hint=p)
    if uniform:
        xs = np.round(np.arange(0, sub.shape[1] + p, p)).astype(int).clip(0, sub.shape[1]); ys = np.round(np.arange(0, sub.shape[0] + p, p)).astype(int).clip(0, sub.shape[0])
        xs = np.unique(xs); ys = np.unique(ys)
    nat = P.sample_grid_avg(sub, m, xs, ys, alpha_min=0.5, dark_L=22.0, dark_frac=0.45, trim=0.3)
    a = nat[..., 3] > 0
    yy, xx = np.where(a)
    nat = nat[yy.min():yy.max() + 1, xx.min():xx.max() + 1]
    frames['%d_%d' % key] = nat
    print(key, 'src %dx%d px -> %dx%d dots' % (x1 - x0, y1 - y0, nat.shape[1], nat.shape[0]))
np.savez(out + '.npz', **frames)
# contact sheet at 4x on dusk grey
cs = np.zeros((rows * 128, cols * 96, 4), np.uint8); cs[...] = (70, 62, 84, 255)
for k, nat in frames.items():
    rr, cc = map(int, k.split('_'))
    h, w = nat.shape[:2]
    if h > 124 or w > 94:
        print('TOO BIG', k, w, h); continue
    y0 = rr * 128 + 124 - h; x0 = cc * 96 + 48 - w // 2
    m = nat[..., 3] > 0
    cs[y0:y0 + h, x0:x0 + w][m] = nat[m]
Image.fromarray(cs).resize((cs.shape[1] * 4, cs.shape[0] * 4), Image.NEAREST).save(out + '_4x.png')
