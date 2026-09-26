"""pixlib — core image operations for the sprite pipeline (numpy + scipy + Pillow only).

key_out()      edge-aware background removal (flood from the crop border, blocked by the dark outline)
fit_grid()     detect the irregular upscaled pixel grid (period by Fourier, lines by dynamic programming)
sample_grid()  majority vote per grid cell -> native RGBA
kmeans_lab()   shared palette (weighted k-means in CIE Lab)
remap/cleanup  palette mapping, orphan-pixel removal, outline repair
"""
import numpy as np
from scipy import ndimage as nd

# ------------------------------------------------------------------ colour
def srgb_to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)


def lum(rgb):
    rgb = np.asarray(rgb, dtype=np.float64)
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


# ------------------------------------------------------------------ keying
def key_out(rgb, bg=None, tol=16.0, shadow_chroma=9.0, shadow_L=60.0, protect_L=40.0, keep=None):
    """Return a boolean foreground mask.

    Background = pixels connected to the crop border through 'paper-like' pixels:
      - Lab distance to the paper colour < tol, or
      - neutral (chroma < shadow_chroma) and lighter than shadow_L (soft floor shadows / paper grain).
    The sprite's dark outline (L < protect_L) is never background, so the flood cannot leak into
    light cloth or the blade as long as the outline is closed. Pixels enclosed by the outline stay.
    `keep` : optional boolean mask forced to foreground.
    """
    lab = srgb_to_lab(rgb)
    H, W = rgb.shape[:2]
    if bg is None:
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        bg = np.median(border, 0)
    bgl = srgb_to_lab(np.array(bg, dtype=np.float64)[None])[0]
    d = np.linalg.norm(lab - bgl, axis=-1)
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    paper = (d < tol) | ((chroma < shadow_chroma) & (lab[..., 0] > shadow_L))
    paper &= lab[..., 0] > protect_L
    lab_id, n = nd.label(paper)
    edge = np.unique(np.concatenate([lab_id[0], lab_id[-1], lab_id[:, 0], lab_id[:, -1]]))
    edge = edge[edge > 0]
    bgmask = np.isin(lab_id, edge)
    fg = ~bgmask
    if keep is not None:
        fg |= keep
    return fg, bg


def largest_components(mask, min_frac=0.02, max_n=6):
    lab, n = nd.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return mask
    sizes = nd.sum(mask, lab, range(1, n + 1))
    order = np.argsort(-sizes)
    keep = np.zeros(n + 1, bool)
    for i in order[:max_n]:
        if sizes[i] >= sizes[order[0]] * min_frac:
            keep[i + 1] = True
    return keep[lab]


# ------------------------------------------------------------------ grid
def period(profile, lo=1.6, hi=9.0):
    g = profile - profile.mean()
    best = (0, 0, 0)
    n = np.arange(len(g))
    for p in np.arange(lo, hi, 0.02):
        z = (g * np.exp(2j * np.pi * n / p)).sum()
        s = abs(z) / len(g)
        # prefer the fundamental: a period that is a multiple of a stronger harmonic is penalised
        if s > best[0]:
            best = (s, p, np.angle(z))
    return best[1], best[2]


def edge_profiles(rgb, mask):
    a = rgb.astype(np.float64)
    m = nd.binary_dilation(mask, iterations=2)
    gx = np.abs(np.diff(a, axis=1)).sum(2) * (m[:, 1:] | m[:, :-1])
    gy = np.abs(np.diff(a, axis=0)).sum(2) * (m[1:] | m[:-1])
    return gx.sum(0), gy.sum(1)   # gx[i] = edge between column i and i+1


def fit_lines(prof, p, span, slack=0.36, lam=1.5, cut_cost=1.0):
    """Cut positions 0 = c0 < c1 < … <= span (cut at c means boundary between pixel c-1 and c).
    Maximise edge energy at cuts, penalise gaps away from the period p."""
    e = np.zeros(span + 1)
    e[1:span] = prof[: span - 1]            # boundary before pixel c = diff index c-1
    e = e / (e.mean() + 1e-9)
    gmin = max(1, int(np.floor(p * (1 - slack))))
    gmax = int(np.ceil(p * (1 + slack)))
    NEG = -1e18
    best = np.full(span + 1, NEG)
    prev = np.full(span + 1, -1)
    best[0] = 0
    # allow the first cell to be partial
    for c in range(1, min(span + 1, gmax + 1)):
        best[c] = e[c] - 0.2
        prev[c] = 0
    for c in range(1, span + 1):
        for g in range(gmin, gmax + 1):
            q = c - g
            if q <= 0 or best[q] == NEG:
                continue
            v = best[q] + e[c] - cut_cost - lam * ((g - p) / p) ** 2 * 4
            if v > best[c]:
                best[c] = v
                prev[c] = q
    # end: last cut anywhere within gmax of span
    end = max(range(max(1, span - gmax), span + 1), key=lambda c: best[c])
    cuts = [span] if end != span else []
    c = end
    while c > 0:
        cuts.append(c)
        c = prev[c]
    cuts.append(0)
    return np.array(sorted(set(cuts)))


def fit_grid(rgb, mask, p_hint=None):
    gx, gy = edge_profiles(rgb, mask)
    if p_hint:
        px = py = p_hint
    else:
        px = py = estimate_period([gx, gy])[0]   # pixels are square: one estimate for both axes
    xs = fit_lines(gx, px, rgb.shape[1])
    ys = fit_lines(gy, py, rgb.shape[0])
    return xs, ys, px


def sample_grid(rgb, mask, xs, ys, ref_lab=None, alpha_min=0.5):
    """Majority vote per cell. rgb is first mapped to a fine working palette (ref) if given,
    the winning palette index's mean colour becomes the cell colour."""
    H, W = len(ys) - 1, len(xs) - 1
    out = np.zeros((H, W, 4), np.uint8)
    lab = srgb_to_lab(rgb)
    for j in range(H):
        y0, y1 = ys[j], ys[j + 1]
        for i in range(W):
            x0, x1 = xs[i], xs[i + 1]
            # inner part of the cell (drop the soft border row/col when the cell is big enough)
            iy0, iy1 = (y0 + 1, y1 - 1) if y1 - y0 >= 4 else (y0, y1)
            ix0, ix1 = (x0 + 1, x1 - 1) if x1 - x0 >= 4 else (x0, x1)
            m = mask[y0:y1, x0:x1]
            if m.mean() < alpha_min:
                continue
            mi = mask[iy0:iy1, ix0:ix1]
            px = rgb[iy0:iy1, ix0:ix1][mi]
            pl = lab[iy0:iy1, ix0:ix1][mi]
            if len(px) == 0:
                px = rgb[y0:y1, x0:x1][m]
                pl = lab[y0:y1, x0:x1][m]
            if ref_lab is not None:
                d = ((pl[:, None, :] - ref_lab[None]) ** 2).sum(-1)
                idx = d.argmin(1)
                vals, cnt = np.unique(idx, return_counts=True)
                win = vals[cnt.argmax()]
                sel = px[idx == win]
                out[j, i, :3] = np.median(sel, 0)
            else:
                # medoid in Lab
                d = ((pl[:, None, :] - pl[None]) ** 2).sum(-1).sum(1)
                out[j, i, :3] = px[d.argmin()]
            out[j, i, 3] = 255
    return out


# ------------------------------------------------------------------ palette
def kmeans_lab(lab, w, k, iters=40, seed=1):
    rng = np.random.default_rng(seed)
    # k-means++ init
    idx = [rng.choice(len(lab), p=w / w.sum())]
    d2 = ((lab - lab[idx[0]]) ** 2).sum(1)
    for _ in range(1, k):
        pr = d2 * w
        if pr.sum() <= 0:
            break
        idx.append(rng.choice(len(lab), p=pr / pr.sum()))
        d2 = np.minimum(d2, ((lab - lab[idx[-1]]) ** 2).sum(1))
    C = lab[idx].copy()
    for _ in range(iters):
        a = ((lab[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        for c in range(len(C)):
            s = a == c
            if s.any():
                C[c] = (lab[s] * w[s, None]).sum(0) / w[s].sum()
    a = ((lab[:, None] - C[None]) ** 2).sum(-1).argmin(1)
    return C, a


def build_palette(images, k=56, merge_de=3.2):
    """images: list of RGBA uint8 native sprites. Returns palette (N,3) uint8 sorted by hue/lum.
    Colours are weighted by pixel count, but rare saturated accents (eyes, scarf highlights)
    get a floor weight so k-means does not swallow them."""
    px = np.concatenate([im[..., :3][im[..., 3] > 0] for im in images]).astype(np.float64)
    uq, cnt = np.unique(px.astype(np.uint8), axis=0, return_counts=True)
    lab = srgb_to_lab(uq.astype(np.float64))
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    w = cnt.astype(np.float64) ** 0.7 * (1 + chroma / 40)
    C, a = kmeans_lab(lab, w, k)
    # use the weighted-median real colour of each cluster (keeps the sheet's own hues)
    pal = []
    for c in range(len(C)):
        s = a == c
        if not s.any():
            continue
        d = ((lab[s] - C[c]) ** 2).sum(1)
        pal.append(uq[s][np.argmin(d - 0.0 * cnt[s])])
    pal = np.array(pal, np.uint8)
    # merge near duplicates
    pl = srgb_to_lab(pal.astype(np.float64))
    keep = []
    for i in np.argsort(lum(pal)):
        if all(np.linalg.norm(pl[i] - pl[j]) > merge_de for j in keep):
            keep.append(i)
    pal = pal[keep]
    return sort_palette(pal)


def sort_palette(pal):
    lab = srgb_to_lab(pal.astype(np.float64))
    hue = np.degrees(np.arctan2(lab[:, 2], lab[:, 1])) % 360
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    grp = np.where(chroma < 10, -1, (hue // 45))
    order = np.lexsort((lab[:, 0], grp))
    return pal[order]


def remap(img, pal):
    out = img.copy()
    m = img[..., 3] > 0
    lab = srgb_to_lab(img[..., :3][m].astype(np.float64))
    pl = srgb_to_lab(pal.astype(np.float64))
    idx = ((lab[:, None] - pl[None]) ** 2).sum(-1).argmin(1)
    out[..., :3][m] = pal[idx]
    return out


# ------------------------------------------------------------------ cleanup
N4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
N8 = N4 + [(-1, -1), (-1, 1), (1, -1), (1, 1)]


def _get(img, y, x):
    H, W = img.shape[:2]
    if 0 <= y < H and 0 <= x < W:
        return img[y, x]
    return None


def cleanup(img, pal, orphan_de=14.0, passes=2):
    """1) orphan pixels: an opaque pixel whose colour appears in none of its 8 neighbours and is
          close (dE < orphan_de) to the dominant neighbour colour takes that colour
          (noise); high-contrast singles (eye glints, buckles) are kept.
       2) single transparent holes inside the sprite are filled; single opaque specks outside removed.
    """
    img = img.copy()
    H, W = img.shape[:2]
    for _ in range(passes):
        a = img[..., 3] > 0
        src = img.copy()
        for y in range(H):
            for x in range(W):
                nb = [_get(src, y + dy, x + dx) for dy, dx in N8]
                nb = [n for n in nb if n is not None]
                opq = [n for n in nb if n[3] > 0]
                if a[y, x]:
                    if len(opq) <= 1:           # speck
                        img[y, x] = 0
                        continue
                    c = tuple(src[y, x, :3])
                    cols = [tuple(n[:3]) for n in opq]
                    if c in cols:
                        continue
                    vals, cnt = np.unique(np.array(cols), axis=0, return_counts=True)
                    dom = vals[cnt.argmax()]
                    if cnt.max() >= 4:
                        de = np.linalg.norm(srgb_to_lab(np.array(c, float)) - srgb_to_lab(dom.astype(float)))
                        if de < orphan_de:
                            img[y, x, :3] = dom
                else:
                    n4 = [_get(src, y + dy, x + dx) for dy, dx in N4]
                    if all(n is not None and n[3] > 0 for n in n4):
                        cols = [tuple(n[:3]) for n in n4]
                        vals, cnt = np.unique(np.array(cols), axis=0, return_counts=True)
                        img[y, x, :3] = vals[cnt.argmax()]
                        img[y, x, 3] = 255
    return img


def fix_outline(img, pal, outline_rgb, light_L=62.0, fringe_de=10.0, paper=None):
    """Outer contour: pixels next to transparency that are paper-like are dropped; pixels that are
    too light for a contour (a keying fringe) become the outline colour, unless they are part of a
    light cluster that reaches the edge on purpose (blade, cloth) — tested by having >=2 same-colour
    opaque neighbours."""
    img = img.copy()
    H, W = img.shape[:2]
    a = img[..., 3] > 0
    if paper is not None:
        pl = srgb_to_lab(np.array(paper, float))
    for y in range(H):
        for x in range(W):
            if not a[y, x]:
                continue
            n4 = [_get(img, y + dy, x + dx) for dy, dx in N4]
            edge = any(n is None or n[3] == 0 for n in n4)
            if not edge:
                continue
            c = img[y, x, :3].astype(float)
            L = srgb_to_lab(c)
            if paper is not None and np.linalg.norm(L - pl) < fringe_de:
                img[y, x] = 0
    return img


# ------------------------------------------------------------------ keying (extra modes)
def remove_floor_shadow(rgb, fg, band=0.10, chroma_max=12.0, L_min=28.0):
    """Soft floor shadows under the feet are neutral grey and touch the boots. Inside the bottom
    `band` of the sprite's bbox, flood from the background through neutral, not-too-dark pixels."""
    lab = srgb_to_lab(rgb)
    ys = np.where(fg.any(1))[0]
    if len(ys) == 0:
        return fg
    y_top = int(ys[-1] - band * (ys[-1] - ys[0] + 1))
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    cand = (chroma < chroma_max) & (lab[..., 0] > L_min)
    cand[:y_top] = False
    seed = ~fg
    grow = cand | seed
    lab_id, _ = nd.label(grow)
    ids = np.unique(lab_id[seed])
    ids = ids[ids > 0]
    shadow = np.isin(lab_id, ids) & cand
    return fg & ~shadow


def key_magenta(rgb, key=(255, 0, 255), tol=90.0, spill=0.35):
    """Flat chroma-key background (#FF00FF). Pixels close to the key are background; pixels that
    are a blend of the key and the sprite (anti-aliased fringe) are dropped when their 'magenta
    excess' (min(R,B)-G) is large relative to their brightness."""
    a = rgb.astype(np.float64)
    d = np.linalg.norm(a - np.array(key, float), axis=-1)
    fg = d > tol
    mag = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) / 255.0
    fringe = mag > spill
    fg &= ~fringe
    fg = nd.binary_opening(fg, structure=np.ones((2, 2)))
    return fg, key


def auto_slice(fg, rows, cols, join=6, min_rel=0.08):
    """Split one panel / whole sheet into rows×cols sprites from its foreground.
    Components closer than `join` px are merged (detached hair tufts, scarf ends, sword tips).
    Returns a list of boolean masks (panel-sized) in reading order — masks, not boxes, so sprites
    whose bounding boxes overlap (a sword reaching over the neighbour) stay separate.
    The count may differ from rows*cols (the caller warns)."""
    H, W = fg.shape
    m = nd.binary_dilation(fg, iterations=join)
    lab, n = nd.label(m)
    if n == 0:
        return []
    areas = nd.sum(fg, lab, range(1, n + 1))
    big = areas.max()
    keep = [i + 1 for i in range(n) if areas[i] > big * min_rel]
    objs = nd.find_objects(lab)
    cy = np.array([(objs[k - 1][0].start + objs[k - 1][0].stop) / 2 for k in keep])
    cx = np.array([(objs[k - 1][1].start + objs[k - 1][1].stop) / 2 for k in keep])
    if rows > 1 and len(keep) >= rows:
        cen = np.quantile(cy, np.linspace(0.1, 0.9, rows))
        for _ in range(20):
            a = np.abs(cy[:, None] - cen[None]).argmin(1)
            cen = np.array([cy[a == r].mean() if (a == r).any() else cen[r] for r in range(rows)])
        order_rows = np.argsort(cen)
    else:
        a = np.zeros(len(keep), int)
        order_rows = [0]
    out = []
    for r in order_rows:
        idx = [i for i in range(len(keep)) if a[i] == r]
        idx.sort(key=lambda i: cx[i])
        out.extend([fg & (lab == keep[i]) for i in idx])
    return out


def bbox(mask):
    ys = np.where(mask.any(1))[0]
    xs = np.where(mask.any(0))[0]
    if len(ys) == 0:
        return None
    return ys[0], ys[-1] + 1, xs[0], xs[-1] + 1


# ------------------------------------------------------------------ resampling v2 (default)
def kuwahara(rgb, r=1):
    """Edge-preserving smoothing: each pixel takes the mean of the least-varied of its 4 quadrant
    windows ((r+1)×(r+1)). Flattens the AI's texture noise, keeps hard edges and dark lines."""
    a = rgb.astype(np.float64)
    L = lum(a)
    k = r + 1
    means, vars_ = [], []
    mean_c = np.stack([nd.uniform_filter(a[..., i], size=k, mode='nearest') for i in range(3)], -1)
    mL = nd.uniform_filter(L, size=k, mode='nearest')
    vL = nd.uniform_filter(L * L, size=k, mode='nearest') - mL * mL
    # uniform_filter window of size k is centred at offset floor(k/2); quadrant = shift so window is
    # anchored at the pixel
    o = k // 2
    for dy, dx in ((-o, -o), (-o, r - o), (r - o, -o), (r - o, r - o)):
        means.append(shift2(mean_c, dy, dx))
        vars_.append(shift2(vL, dy, dx))
    V = np.stack(vars_, 0)
    M = np.stack(means, 0)
    idx = V.argmin(0)
    out = np.take_along_axis(M, idx[None, ..., None].repeat(3, -1), 0)[0]
    return np.clip(out, 0, 255)


def shift2(a, dy, dx):
    """value at (y, x) = a[y+dy, x+dx] with edge clamping"""
    H, W = a.shape[:2]
    yi = np.clip(np.arange(H) + dy, 0, H - 1)
    xi = np.clip(np.arange(W) + dx, 0, W - 1)
    return a[yi][:, xi]


def sample_grid_avg(rgb, mask, xs, ys, alpha_min=0.5, dark_L=24.0, dark_frac=0.3, trim=0.25):
    """Per cell: Lab trimmed mean of the (masked) pixels — except when enough of the cell is very
    dark (outline, eyes, lashes), then the dark pixels win. Thin dark lines survive the downscale,
    light texture noise averages out."""
    H, W = len(ys) - 1, len(xs) - 1
    out = np.zeros((H, W, 4), np.uint8)
    lab = srgb_to_lab(rgb)
    for j in range(H):
        y0, y1 = ys[j], ys[j + 1]
        for i in range(W):
            x0, x1 = xs[i], xs[i + 1]
            m = mask[y0:y1, x0:x1]
            if m.mean() < alpha_min:
                continue
            px = rgb[y0:y1, x0:x1][m].astype(np.float64)
            pl = lab[y0:y1, x0:x1][m]
            dark = pl[:, 0] < dark_L
            if dark.mean() >= dark_frac and not dark.all():
                sel = dark
            else:
                # trim the pixels farthest from the cell's median (soft cell borders)
                med = np.median(pl, 0)
                d = ((pl - med) ** 2).sum(1)
                n = max(1, int(round(len(pl) * (1 - trim))))
                sel = np.argsort(d)[:n]
            out[j, i, :3] = np.clip(np.mean(px[sel], 0), 0, 255)
            out[j, i, 3] = 255
    return out


def mode_filter(img, pal, de_max=10.0, passes=1):
    """Cluster cleanup: a pixel whose 3×3 neighbourhood is dominated (>=5 of 8) by one other colour
    within de_max takes that colour. Unifies ragged clusters without touching real edges."""
    img = img.copy()
    H, W = img.shape[:2]
    for _ in range(passes):
        src = img.copy()
        a = src[..., 3] > 0
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if not a[y, x]:
                    continue
                win = src[y - 1:y + 2, x - 1:x + 2].reshape(-1, 4)
                win = np.delete(win, 4, 0)
                win = win[win[:, 3] > 0]
                if len(win) < 6:
                    continue
                vals, cnt = np.unique(win[:, :3], axis=0, return_counts=True)
                k = cnt.argmax()
                if cnt[k] >= 5 and not (vals[k] == src[y, x, :3]).all():
                    de = np.linalg.norm(srgb_to_lab(vals[k].astype(float)) - srgb_to_lab(src[y, x, :3].astype(float)))
                    if de < de_max:
                        img[y, x, :3] = vals[k]
    return img


def selout(img, pal, max_L=42.0, factor=0.45):
    """Selective outline: silhouette pixels lighter than max_L are replaced by the palette colour
    nearest to a darkened, slightly warm-shifted version of themselves (keeps hue, reads as a line)."""
    img = img.copy()
    H, W = img.shape[:2]
    a = img[..., 3] > 0
    er = nd.binary_erosion(a, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]), border_value=0)
    edge = a & ~er
    pl = srgb_to_lab(pal.astype(np.float64))
    for y, x in zip(*np.where(edge)):
        c = srgb_to_lab(img[y, x, :3].astype(float))
        if c[0] <= max_L:
            continue
        t = np.array([c[0] * factor, c[1] * 0.8, c[2] * 0.8 + 2])
        k = ((pl - t) ** 2).sum(1).argmin()
        img[y, x, :3] = pal[k]
    return img


def fill_pockets(rgb, fg, paper, tol=12.0, min_px=3):
    """Paper-coloured pockets enclosed by the sprite (gaps between the legs, under the arm) —
    not reachable by the border flood — are background too."""
    lab = srgb_to_lab(rgb)
    pl = srgb_to_lab(np.array(paper, float))
    pap = np.linalg.norm(lab - pl, axis=-1) < tol
    lid, n = nd.label(pap & fg)
    for i in range(1, n + 1):
        s = lid == i
        if s.sum() >= min_px:
            fg = fg & ~s
    return fg


def period_by_cuts(gx, gy, lo=1.8, hi=9.0, step=0.05, keep=0.9):
    """Robust pixel-size estimate: for each candidate p fit the cut lines (DP) on both axes and score
    the mean edge energy at the cuts (normalised). Harmonics (2p, 3p) score about as well as p, so
    the smallest p within `keep` of the best score wins."""
    res = []
    for p in np.arange(lo, hi, step):
        sc = []
        for prof in (gx, gy):
            span = len(prof) + 1
            cuts = fit_lines(prof, p, span)
            e = np.zeros(span + 1); e[1:span] = prof[:span - 1]; e /= e.mean() + 1e-9
            inner = cuts[(cuts > 0) & (cuts < span)]
            sc.append(e[inner].mean() if len(inner) else 0)
        res.append((np.mean(sc), p))
    best = max(r[0] for r in res)
    for s, p in res:
        if s >= best * keep:
            return float(p), res
    return float(res[0][1]), res


def estimate_period(profiles, lo=1.8, hi=12.0, step=0.01, band=(0.8, 1.25)):
    """Pixel size from the summed power spectrum of edge profiles (x and y, one or many sprites).
    AI sheets are not on an exact grid, so the answer is the power-weighted centroid of the band
    around the strongest peak rather than the peak itself."""
    ps = np.arange(lo, hi, step)
    pw = np.zeros(len(ps))
    for g in profiles:
        g = g - g.mean()
        n = np.arange(len(g))
        Z = np.exp(2j * np.pi * n[None, :] / ps[:, None]) @ g
        pw += np.abs(Z) ** 2 / max(1, len(g))
    k = pw.argmax()
    p0 = ps[k]
    sel = (ps >= p0 * band[0]) & (ps <= p0 * band[1])
    w = pw[sel] ** 2
    return float((ps[sel] * w).sum() / w.sum()), float(p0)


# ------------------------------------------------------------------ resize (pixel art)
def scale2x(img):
    """EPX / Scale2x on RGBA pixel art (edges stay crisp, diagonals get smoothed by one pixel)"""
    H, W = img.shape[:2]
    p = np.pad(img, ((1, 1), (1, 1), (0, 0)), mode='edge')
    E = p[1:-1, 1:-1]
    B, D, F, Hh = p[:-2, 1:-1], p[1:-1, :-2], p[1:-1, 2:], p[2:, 1:-1]
    eq = lambda a, b: (a == b).all(-1)
    c = ~eq(B, Hh) & ~eq(D, F)
    out = np.zeros((H * 2, W * 2, 4), img.dtype)
    out[0::2, 0::2] = np.where((c & eq(D, B))[..., None], D, E)
    out[0::2, 1::2] = np.where((c & eq(B, F))[..., None], F, E)
    out[1::2, 0::2] = np.where((c & eq(D, Hh))[..., None], D, E)
    out[1::2, 1::2] = np.where((c & eq(Hh, F))[..., None], F, E)
    return out


def rescale_pixel(img, k):
    """Resize pixel art by k: Scale2x up to >= 2k, then each target pixel takes the most common colour of its
    source block (alpha by majority; dark outline colours win ties). Keeps 1-pixel outlines better than nearest."""
    src, f = img, 1
    while f < 2 * k:
        src, f = scale2x(src), f * 2
    H, W = img.shape[:2]
    th, tw = max(1, int(round(H * k))), max(1, int(round(W * k)))
    ys = np.linspace(0, src.shape[0], th + 1)
    xs = np.linspace(0, src.shape[1], tw + 1)
    out = np.zeros((th, tw, 4), np.uint8)
    for j in range(th):
        for i in range(tw):
            blk = src[int(ys[j]):max(int(ys[j]) + 1, int(ys[j + 1])), int(xs[i]):max(int(xs[i]) + 1, int(xs[i + 1]))].reshape(-1, 4)
            op = blk[blk[:, 3] > 0]
            if len(op) * 2 < len(blk):
                continue
            u, cnt = np.unique(op, axis=0, return_counts=True)
            lum = u[:, :3].astype(int).sum(1)
            out[j, i] = u[np.lexsort((lum, -cnt))[0]]
    return out
