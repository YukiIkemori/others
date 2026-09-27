"""Normalise raw generations into engine assets under v2/assets/env/.
   python3 proc.py mat <raw.png> <theme> <id> [mean std sat]
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from envlib import *
from envlib import _wrap_x
from scipy.cluster.vq import vq

ROOT = '/home/user/others/chronicle/v2/assets/env'
TILES = (24, 32, 40)

def palette_of(rgb, n, mask=None):
    from scipy.cluster.vq import kmeans2
    X = rgb.reshape(-1, 3)
    if mask is not None: X = X[mask.reshape(-1)]
    rs = np.random.RandomState(3)
    X = X[rs.choice(len(X), min(len(X), 50000), replace=False)]
    c, _ = kmeans2(X, n, minit='++', iter=25, seed=3)
    return c

def snap(rgb, pal):
    X = rgb.reshape(-1, 3)
    d = ((X[:, None, :] - pal[None]) ** 2).sum(2)
    return pal[d.argmin(1)].reshape(rgb.shape)

def grid_resample(img, p_native, ph, target_p, n):
    """Sample n x n art px with art pixel size target_p (hi-res px) starting at the native phase."""
    if abs(target_p - p_native) < 0.35:
        return sample_grid(img, p_native, ph[0], ph[1], n, n)
    size = int(round(target_p * n))
    x0, y0 = int(ph[0]), int(ph[1])
    crop = img[y0:y0 + size, x0:x0 + size]
    return box(crop, n, n)

def mat(raw, theme, mid, period=256, mean=None, std=None, sat=None, ncol=40, extra=None):
    img = load(raw, 'RGB')
    p, phx, phy = detect_period(img)
    N = min(img.shape[0], img.shape[1]) / p
    out = {}
    pal = None
    base_p = min(p, (min(img.shape[:2]) - 8) / (period * 1.0))   # native if it fits, else finer
    for t in (32, 24, 40):
        P = int(period * t / 32)
        tp = base_p * 32 / t
        a = grid_resample(img, p, (phx, phy), tp, P)
        a = calibrate(a, mean, std, sat)
        a = make_seamless(a)
        if pal is None:
            pal = palette_of(a, ncol)
        a = snap(a, pal)
        d = os.path.join(ROOT, theme, 'mat'); os.makedirs(d, exist_ok=True)
        fn = '%s@%d.png' % (mid, t)
        save(a, os.path.join(d, fn))
        out[t] = fn
    meta = dict(id=mid, kind='material', theme=theme, period={t: int(period * t / 32) for t in TILES}, files=out,
                src=os.path.relpath(raw, '/home/user/others/chronicle'), native_px=round(p, 2), colours=int(ncol))
    if extra: meta.update(extra)
    json.dump(meta, open(os.path.join(ROOT, theme, 'mat', mid + '.json'), 'w'), indent=1)
    return meta

if __name__ == '__main__':
    if sys.argv[1] == 'mat':
        args = [float(v) for v in sys.argv[5:]] + [None] * 3
        print(mat(sys.argv[2], sys.argv[3], sys.argv[4], mean=args[0], std=args[1], sat=args[2]))

# ---------------------------------------------------------------- sprites
def _hard(rgba, thr=110):
    return rgba

def sprite_sizes(w32, h32):
    return {t: (max(1, int(round(w32 * t / 32))), max(1, int(round(h32 * t / 32)))) for t in TILES}

def write_sprite_set(crops, theme, sub, sid, frame_names, size32, feet32, extra=None, ncol=28, outline=True, pal_from=0):
    """crops: list of hi-res RGBA arrays (one per frame, same size). Writes <sid>@<t>.png strips + json."""
    d = os.path.join(ROOT, theme, sub); os.makedirs(d, exist_ok=True)
    files = {}
    w32, h32 = size32
    for t, (w, h) in sprite_sizes(w32, h32).items():
        frames = [pixelize_sprite(c, w, h, ncol=ncol, outline=outline, seed=1) for c in crops]
        strip = np.concatenate(frames, 1)
        fn = '%s@%d.png' % (sid, t)
        save(strip, os.path.join(d, fn)); files[t] = fn
    meta = dict(id=sid, kind=sub, theme=theme, frames=frame_names, cell={t: list(v) for t, v in sprite_sizes(w32, h32).items()},
                feet={t: [round(feet32[0] * t / 32), round(feet32[1] * t / 32)] for t in TILES}, files=files)
    if extra: meta.update(extra)
    json.dump(meta, open(os.path.join(d, sid + '.json'), 'w'), indent=1)
    return meta

def crop_alpha(rgba, pad=0):
    ys, xs = np.nonzero(rgba[..., 3] > 100)
    return rgba[max(0, ys.min() - pad):ys.max() + 1 + pad, max(0, xs.min() - pad):xs.max() + 1 + pad]

# ---------------------------------------------------------------- buildings
def lit_mask(s):
    r, g, b = s[..., 0], s[..., 1], s[..., 2]
    m = (s[..., 3] > 0) & (r > 180) & (g > 0.72 * r) & (b < 0.72 * r) & (r - b > 60)
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=1))
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, 1 + np.nonzero(sizes >= 6)[0])
        m = m & keep
    return m

def find_windows(rgb32, alpha32):
    lit = lit_mask(np.concatenate([rgb32, alpha32[..., None]], 2))
    lab, n = ndimage.label(ndimage.binary_dilation(lit, iterations=2))
    lab = lab * lit
    out = []
    for sl in ndimage.find_objects(lab):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if w * h < 6: continue
        out.append(dict(kind='win', x=int(sl[1].start), y=int(sl[0].start), w=int(w), h=int(h)))
    return out

def building(raw, theme, d, g, ncol=48, mean=None, std=None, sat=None, tone=None):
    """d: building def (map), g: guide layout (art px at tile 32)."""
    import guides
    rgba = load(raw, 'RGBA')
    if rgba[..., 3].min() > 250:
        rgba = key_bg(rgba)
    dd = os.path.join(ROOT, theme, 'bld'); os.makedirs(dd, exist_ok=True)
    files, efiles, emit32 = {}, {}, None
    for t in TILES:
        k = t / 32
        W, H = int(round(g['W'] * k)), int(round(g['H'] * k))
        s = pixelize_sprite(rgba, W, H, ncol=ncol, outline=True, seed=2)
        if tone:
            m = s[..., 3] > 0
            s[..., :3] = np.where(m[..., None], calibrate(s[..., :3], None, None, tone.get('sat')) * tone.get('mul', 1.0), s[..., :3])
        if t == 32:
            emit32 = find_windows(s[..., :3], s[..., 3])
        fn = '%s@%d.png' % (d['id'], t)
        save(s, os.path.join(dd, fn)); files[t] = fn
        lit = lit_mask(s)
        e = s.copy(); e[..., 3] = np.where(lit, 255, 0)
        efn = '%s_emit@%d.png' % (d['id'], t)
        save(e, os.path.join(dd, efn)); efiles[t] = efn
    door = None
    if g['door']:
        door = dict(x=(g['door'][0] + g['door'][2]) / 2 - g['OV'], y=0, w=g['door'][2] - g['door'][0], h=g['door'][3] - g['door'][1])
    meta = dict(id=d['id'], kind='building', theme=theme, footprint=[d['w'], d['h']], wall=g['wall'], files=files, emitFiles=efiles,
                size={t: [int(round(g['W'] * t / 32)), int(round(g['H'] * t / 32))] for t in TILES},
                anchor32=[g['OV'], g['H']], door32=door, emit32=[dict(e, x=e['x'] - g['OV'], y=e['y'] - g['H']) for e in emit32],
                roof32=[g['roof'][0] - g['OV'], g['roof'][1] - g['H'], g['roof'][2] - g['OV'], g['roof'][3] - g['H']],
                wallTop32=g['wallr'][1] - g['H'], src=os.path.relpath(raw, '/home/user/others/chronicle'), def_=dict(d))
    json.dump(meta, open(os.path.join(dd, d['id'] + '.json'), 'w'), indent=1, default=str)
    return meta

# ---------------------------------------------------------------- rise faces
def face(raw, theme, style, width=256, height=128, foot=10, mean=None, std=None, sat=None, ncol=36):
    img = load(raw, 'RGB')
    p, phx, phy = detect_period(img)
    out = {}
    pal = None
    for t in (32, 24, 40):
        Wt, Ht = int(width * t / 32), int(height * t / 32)
        tp = min(p, img.shape[1] / (width * 1.02)) * 32 / t
        x0, y0 = int(phx), int(phy)
        crop = img[y0:y0 + int(Ht * tp * (img.shape[0] / (img.shape[0]))), x0:x0 + int(Wt * tp)]
        # vertically: squeeze the whole strip height into Ht (keeps lip at top and contact band at bottom)
        full_h = img.shape[0] - y0
        crop = img[y0:, x0:x0 + int(Wt * tp)]
        a = box(crop, Wt, Ht)
        a = calibrate(a, mean, std, sat)
        a = _wrap_x(a)
        if pal is None: pal = palette_of(a, ncol)
        a = snap(a, pal)
        d = os.path.join(ROOT, theme, 'mat'); os.makedirs(d, exist_ok=True)
        fn = 'face_%s@%d.png' % (style, t)
        save(a, os.path.join(d, fn)); out[t] = fn
    meta = dict(id='face_' + style, style=style, kind='face', theme=theme, files=out, period={t: int(width * t / 32) for t in TILES},
                height={t: int(height * t / 32) for t in TILES}, foot32=foot, src=os.path.relpath(raw, '/home/user/others/chronicle'))
    json.dump(meta, open(os.path.join(ROOT, theme, 'mat', 'face_' + style + '.json'), 'w'), indent=1)
    return meta

# ---------------------------------------------------------------- battle backgrounds
def _soft(a, r):
    return ndimage.gaussian_filter(a, (r, r, 0)) if a.ndim == 3 else ndimage.gaussian_filter(a, r)

def bbg(raw, bid, horizon, front_raw=None, ncol=72, lit_gain=2.2, glow_thr=0.72):
    img = load(raw, 'RGB')
    d = os.path.join(ROOT, 'bbg', bid); os.makedirs(d, exist_ok=True)
    meta = dict(id=bid, kind='bbg', src=os.path.relpath(raw, '/home/user/others/chronicle'), prelit=True, layers={}, horizon={})
    H0, W0 = img.shape[:2]
    for name, (W, H, crop) in {'wide': (960, 540, None), 'tall': (540, 643, 'tall')}.items():
        src = img
        if crop == 'tall':
            cw = int(H0 * W / H); cx = int(W0 * 0.52 - cw / 2); cx = max(0, min(W0 - cw, cx))
            src = img[:, cx:cx + cw]
        a = box(src, W, H)
        pal = palette_of(a, ncol)
        a = snap(a, pal)
        gt = int(round(horizon * H))
        sfx = '' if name == 'wide' else '_tall'
        save(a, os.path.join(d, 'back%s.png' % sfx))
        al = np.clip((np.arange(H) - (gt - 24)) / 30.0, 0, 1)[:, None] * np.ones((1, W))
        g = np.concatenate([a, al[..., None] * 255], 2)
        save(g, os.path.join(d, 'ground%s.png' % sfx))
        # lamp-lit version of the ground: what the ground looks like inside a warm light pool
        L = lum(a)[..., None]
        lit = a * lit_gain * np.array([1.4, 1.02, 0.62]) + np.array([14, 6, 0])
        lit = np.clip(lit, 0, 255)
        lit = snap(lit, palette_of(lit, ncol))
        save(np.concatenate([lit, al[..., None] * 255], 2), os.path.join(d, 'ground_lit%s.png' % sfx))
        # post: additive glow from luminous colours (crystals, glowing moss, moon, stars)
        hsv_s = (a.max(2) - a.min(2)) / (a.max(2) + 1)
        Ln = lum(a) / 255.0
        m = ((Ln > glow_thr) | ((Ln > 0.45) & (hsv_s > 0.45) & (a[..., 2] > a[..., 0]))).astype(np.float32)
        glow = a * m[..., None]
        post = _soft(glow, 6) * 1.4 + _soft(glow, 2) * 0.6
        pa = np.clip(post.max(2), 0, 255)
        save(np.concatenate([np.clip(post, 0, 255), pa[..., None]], 2), os.path.join(d, 'post%s.png' % sfx))
        if front_raw and os.path.exists(front_raw):
            f = load(front_raw, 'RGBA')
            if crop == 'tall':
                fh, fw = f.shape[:2]; cw = int(fh * W / H); cx = max(0, min(fw - cw, int(fw * 0.52 - cw / 2)))
                f = f[:, cx:cx + cw]
            f[..., :3] *= f[..., 3:4] / 255.0
            fs = box(f, W, H)
            al2 = fs[..., 3]
            rgb = fs[..., :3] / np.maximum(al2[..., None] / 255.0, 1e-3)
            fs = np.concatenate([np.clip(rgb, 0, 255), np.where(al2 > 90, 255, 0)[..., None]], 2)
            save(fs, os.path.join(d, 'front%s.png' % sfx))
            meta['layers']['front' + sfx] = 'front%s.png' % sfx
        for k in ('back', 'ground', 'ground_lit', 'post'):
            meta['layers'][k + sfx] = '%s%s.png' % (k, sfx)
        meta['horizon'][name] = gt
    meta['blend'] = dict(back='source-over (no light)', ground='source-over (prelit; do NOT multiply by the ambient)', ground_lit='source-over through a radial mask at the lantern (and other pools)', front='source-over, soften r=3.5 like K.softenG', post="'lighter'")
    json.dump(meta, open(os.path.join(d, bid + '.json'), 'w'), indent=1)
    return meta
