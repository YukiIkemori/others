"""Pixel-art normalisation helpers for generated environment art (numpy + PIL + scipy)."""
import numpy as np
from PIL import Image
from scipy import ndimage

def load(p, mode='RGBA'):
    return np.asarray(Image.open(p).convert(mode)).astype(np.float32)

def save(a, p):
    a = np.clip(np.rint(a), 0, 255).astype(np.uint8)
    Image.fromarray(a).save(p, optimize=True)

def lum(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114

# ---------------------------------------------------------------- native grid
def _profile(rgb, axis):
    d = np.abs(np.diff(rgb, axis=axis)).sum(2)
    if axis == 1:
        m = d.sum(0)
    else:
        m = d.sum(1)
    return m - m.mean()

def detect_period(rgb, lo=3.0, hi=12.0):
    """-> (period, phase_x, phase_y). period in image px per art px."""
    best = None
    px_, py_ = _profile(rgb, 1), _profile(rgb, 0)
    for p in np.arange(lo, hi, 0.02):
        sc = 0
        ph = []
        for prof in (px_, py_):
            n = len(prof)
            bestph = (-1e18, 0)
            for phi in np.arange(0, p, 0.25):
                idx = np.floor(phi + np.arange(0, (n - phi) / p) * p).astype(int)
                idx = idx[idx < n]
                s = prof[idx].mean()
                if s > bestph[0]:
                    bestph = (s, phi)
            sc += bestph[0]
            ph.append(bestph[1])
        if best is None or sc > best[0]:
            best = (sc, p, ph[0], ph[1])
    # prefer the fundamental: if half the period scores nearly as well keep the smaller
    return best[1], best[2], best[3]

def sample_grid(img, p, phx=0.0, phy=0.0, nx=None, ny=None):
    """Average the inner part of each art-pixel cell (cells start at phase + k*p boundary)."""
    H, W = img.shape[:2]
    if nx is None: nx = int((W - phx) // p)
    if ny is None: ny = int((H - phy) // p)
    out = np.zeros((ny, nx, img.shape[2]), np.float32)
    ii = ndimage.uniform_filter(img, size=(max(1, int(p * 0.5)), max(1, int(p * 0.5)), 1))
    ys = np.clip((phy + (np.arange(ny) + 0.5) * p).astype(int), 0, H - 1)
    xs = np.clip((phx + (np.arange(nx) + 0.5) * p).astype(int), 0, W - 1)
    return ii[ys][:, xs]

def box(img, w, h):
    """Area-average resize (float RGBA/RGB array)."""
    ch = img.shape[2]
    mode = 'RGBA' if ch == 4 else 'RGB'
    out = []
    for c in range(ch):
        out.append(np.asarray(Image.fromarray(img[..., c].astype(np.float32), 'F').resize((w, h), Image.BOX)))
    return np.stack(out, -1)

# ---------------------------------------------------------------- palette
def quantize(rgb, n=32, mask=None, seed=1):
    """k-means in a perceptual-ish space; returns rgb snapped to n colours."""
    from scipy.cluster.vq import kmeans2
    X = rgb.reshape(-1, 3)
    sel = X if mask is None else X[mask.reshape(-1)]
    if len(sel) == 0:
        return rgb
    rs = np.random.RandomState(seed)
    samp = sel[rs.choice(len(sel), min(len(sel), 40000), replace=False)]
    w = np.array([0.8, 1.0, 0.7], np.float32)
    cent, _ = kmeans2(samp * w, min(n, len(np.unique(samp, axis=0))), minit='++', iter=20, seed=seed)
    d = ((X[:, None, :] * w - cent[None]) ** 2).sum(2)
    lab = d.argmin(1)
    return (cent[lab] / w).reshape(rgb.shape)

# ---------------------------------------------------------------- seamless (wrap quilting, pixel level)
def _cut_path(cost):
    """min-cost top->bottom path through cost (h, w); returns x per row."""
    h, w = cost.shape
    acc = cost.copy()
    back = np.zeros((h, w), int)
    for y in range(1, h):
        prev = acc[y - 1]
        l = np.r_[np.inf, prev[:-1]]
        r = np.r_[prev[1:], np.inf]
        st = np.stack([l, prev, r])
        k = st.argmin(0)
        acc[y] += st[k, np.arange(w)]
        back[y] = np.arange(w) + k - 1
    x = np.zeros(h, int)
    x[-1] = acc[-1].argmin()
    for y in range(h - 1, 0, -1):
        x[y - 1] = back[y, x[y]]
    return x

def _wrap_x(a, band=(0.18, 0.38)):
    h, w = a.shape[:2]
    b = np.roll(a, w // 2, axis=1)
    cost = np.abs(a[..., :3] - b[..., :3]).sum(2)
    x0, x1 = int(w * band[0]), int(w * band[1])
    left = _cut_path(cost[:, x0:x1]) + x0
    x2, x3 = int(w * (1 - band[1])), int(w * (1 - band[0]))
    right = _cut_path(cost[:, x2:x3]) + x2
    out = b.copy()
    for y in range(h):
        out[y, left[y]:right[y]] = a[y, left[y]:right[y]]
    return out

def make_seamless(a):
    a = _wrap_x(a)
    a = np.transpose(_wrap_x(np.transpose(a, (1, 0, 2))), (1, 0, 2))
    return a

def seam_error(a):
    return float(np.abs(a[:, 0, :3] - a[:, -1, :3]).mean() + np.abs(a[0, :, :3] - a[-1, :, :3]).mean())

# ---------------------------------------------------------------- tone calibration
def calibrate(rgb, mean=None, std=None, sat=None):
    L = lum(rgb)
    m, s = L.mean(), L.std() + 1e-6
    out = rgb.copy()
    if mean is not None:
        tm = mean; ts = std if std is not None else s
        Ln = (L - m) / s * ts + tm
        k = (Ln + 1) / (L + 1)
        out = rgb * k[..., None]
    if sat is not None:
        g = lum(out)[..., None]
        out = g + (out - g) * sat
    return np.clip(out, 0, 255)

# ---------------------------------------------------------------- sprites
def components(alpha, thr=128, min_area=60, merge=6):
    m = alpha > thr
    if merge:
        m2 = ndimage.binary_dilation(m, iterations=merge)
    else:
        m2 = m
    lab, n = ndimage.label(m2)
    objs = ndimage.find_objects(lab)
    res = []
    for i, sl in enumerate(objs):
        sub = (lab[sl] == i + 1) & m[sl]
        if sub.sum() < min_area:
            continue
        ys, xs = np.nonzero(sub)
        res.append((sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1, i + 1, lab))
    return res

def key_bg(rgba, key=(255, 0, 255), tol=90):
    """Magenta or transparent background -> alpha."""
    a = rgba.copy()
    d = np.abs(a[..., :3] - np.array(key, np.float32)).sum(2)
    a[..., 3] = np.where(d < tol, 0, a[..., 3])
    return a

def pixelize_sprite(rgba, w, h, ncol=24, alpha_thr=110, outline=True, seed=1):
    """hi-res RGBA crop -> w x h crisp sprite (hard alpha, quantised, optional dark outline fix)."""
    A = rgba.copy()
    A[..., :3] *= (A[..., 3:4] / 255.0)
    s = box(A, w, h)
    al = s[..., 3]
    rgb = s[..., :3] / np.maximum(al[..., None] / 255.0, 1e-3)
    m = al > alpha_thr
    rgb = quantize(np.clip(rgb, 0, 255), ncol, mask=m, seed=seed)
    out = np.zeros((h, w, 4), np.float32)
    out[..., :3] = rgb
    out[..., 3] = np.where(m, 255, 0)
    if outline:
        # make sure boundary pixels are dark enough to read on night backgrounds
        er = ndimage.binary_erosion(m)
        edge = m & ~er
        L = lum(out[..., :3])
        dk = edge & (L > 70)
        out[dk, :3] = out[dk, :3] * 0.55 + np.array([28, 20, 24]) * 0.45
    return out
