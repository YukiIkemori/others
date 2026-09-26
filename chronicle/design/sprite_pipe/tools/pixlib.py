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
        px, _ = period(gx)
        py, _ = period(gy)
        p = (px + py) / 2          # pixels are square: share the estimate
        px = py = p
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
def remove_floor_shadow(rgb, fg, band=0.10, chroma_max=10.0, L_min=34.0):
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


def auto_slice(fg, rows, cols, min_area=0.004, join=6):
    """Split one panel / whole sheet into rows×cols sprite boxes from its foreground.
    Components closer than `join` px are merged (detached hair tufts, scarf ends, sword tips).
    Returns list of (y0, y1, x0, x1) in reading order, len may differ from rows*cols (caller warns)."""
    H, W = fg.shape
    m = nd.binary_dilation(fg, iterations=join)
    lab, n = nd.label(m)
    objs = nd.find_objects(lab)
    boxes = []
    for i, o in enumerate(objs):
        area = (lab[o] == i + 1).sum()
        if area < min_area * H * W / max(1, rows * cols) * rows * cols / 4 and area < 400:
            continue
        y0, y1 = o[0].start + join, o[0].stop - join
        x0, x1 = o[1].start + join, o[1].stop - join
        boxes.append([max(0, y0), min(H, y1), max(0, x0), min(W, x1), area])
    if not boxes:
        return []
    boxes.sort(key=lambda b: -b[4])
    boxes = boxes[: rows * cols * 2]
    # drop tiny ones relative to the biggest
    big = boxes[0][4]
    boxes = [b for b in boxes if b[4] > big * 0.08]
    # group into rows by vertical centre (1-D k-means with `rows` centres)
    cy = np.array([(b[0] + b[1]) / 2 for b in boxes])
    if rows > 1:
        cen = np.quantile(cy, np.linspace(0.1, 0.9, rows))
        for _ in range(20):
            a = np.abs(cy[:, None] - cen[None]).argmin(1)
            cen = np.array([cy[a == r].mean() if (a == r).any() else cen[r] for r in range(rows)])
    else:
        a = np.zeros(len(boxes), int)
    out = []
    for r in np.argsort(cen) if rows > 1 else [0]:
        rb = [boxes[i] for i in range(len(boxes)) if a[i] == r]
        rb.sort(key=lambda b: b[2])
        out.extend([tuple(b[:4]) for b in rb])
    return out


def bbox(mask):
    ys = np.where(mask.any(1))[0]
    xs = np.where(mask.any(0))[0]
    if len(ys) == 0:
        return None
    return ys[0], ys[-1] + 1, xs[0], xs[-1] + 1
