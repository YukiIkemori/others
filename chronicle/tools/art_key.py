#!/usr/bin/env python3
"""Hi-res art tooling (BRIEF Part A16): chroma-key cut-out, sprite splitting, seamless textures.

  python3 tools/art_key.py sprites IN OUT_PREFIX [--h 180] [--order x|rows] [--min-area 0.004] [--flip]
      Key the flat background (colour estimated from the border, usually #FF00FF) with a soft, edge-aware matte,
      un-mix the background from semi-transparent edge pixels (no magenta fringe), split the sheet into its
      separate objects (connected components after a small dilation), crop each with padding and write
      OUT_PREFIX_<n>.png (RGBA). --h resizes every sprite to that many pixels tall (Lanczos) — the device-pixel
      size it is drawn at, so the game never downsamples at runtime. --hs gives a list of heights per sprite.
  python3 tools/art_key.py grid IN OUT_PREFIX --cols 3 --rows 3 [--size 256] [--inset 0.06]
      Cut a texture sheet into cells and make each one seamlessly tileable (offset + cross-fade), size px square.
  python3 tools/art_key.py fit IN OUT --w 1024 --h 608
      Cover-crop a full picture (battle background) to exactly WxH.

Tool-time only (needs numpy, pillow, scipy). Nothing here runs in the game.
"""
import sys, argparse
import numpy as np
from PIL import Image
from scipy import ndimage


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)


def bg_color(a):
    b = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    return np.median(b, axis=0)


def matte(a, bg, d0=None, d1=None):
    """soft alpha from the colour distance to bg; (d0,d1) adapt to the noise of the background"""
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    # background noise level (jpeg): distance percentile of border pixels
    border = np.concatenate([d[:6].ravel(), d[-6:].ravel(), d[:, :6].ravel(), d[:, -6:].ravel()])
    border = border[border < 70]  # subjects touching the edge are not noise
    noise = float(np.percentile(border, 99)) if border.size else 20.0
    d0 = d0 if d0 is not None else max(28.0, noise * 1.6)
    d1 = d1 if d1 is not None else d0 + 70.0
    al = np.clip((d - d0) / (d1 - d0), 0, 1)
    # magenta-ness: strong min(R,B)-G means background even at a larger RGB distance (dark / shaded spill)
    if bg[0] > 150 and bg[2] > 150 and bg[1] < 110:
        m = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) / max(1.0, min(bg[0], bg[2]) - bg[1])
        al = np.minimum(al, np.clip((0.92 - m) / 0.45, 0, 1))
    # tiny speckles out, holes in solid areas kept as they are (they are real gaps between arm and body)
    al = ndimage.median_filter(al, size=3)
    # only a thin band along the silhouette may be semi-transparent: deep inside the subject everything is opaque
    # (textured / watercolor subjects otherwise get a partial alpha and a background-coloured cast after un-mixing)
    inner = ndimage.binary_erosion(al > 0.5, iterations=3)
    al[inner] = 1.0
    if bg[0] > 150 and bg[2] > 150 and bg[1] < 110:
        # glows / soft shadows painted over the key colour: strongly magenta pixels stay see-through even inside
        al = np.minimum(al, np.clip((0.85 - m) / 0.45, 0, 1))
    return al


def unmix(a, bg, al):
    """foreground colour of semi-transparent pixels: F = (I - (1-a) bg) / a, then kill the remaining spill"""
    aa = np.maximum(al, 1e-3)[..., None]
    f = (a - (1 - aa) * bg) / aa
    f = np.where(al[..., None] > 0.98, a, f)
    f = np.clip(f, 0, 255)
    if bg[0] > 150 and bg[2] > 150 and bg[1] < 110:
        # magenta spill: limit min(R,B) to G + slack near the edge
        edge = np.maximum(ndimage.binary_dilation(al < 0.98, iterations=3), 0.5)
        mn = np.minimum(f[..., 0], f[..., 2])
        excess = np.clip(mn - f[..., 1] - 18, 0, None) * edge
        f[..., 0] -= excess * 0.8
        f[..., 2] -= excess * 0.8
    return np.clip(f, 0, 255)


def rgba(f, al):
    return np.dstack([f, al * 255]).astype(np.uint8)


def grid_pitch(a, lo=3.0, hi=24.0):
    """estimate the pixel-art grid (pitch, phase_x, phase_y, score) of a generated 'pixel art' image from where its
    colour edges fall (circular mean of edge positions modulo the pitch). A generated image often has sub-cells
    (half-pitch) that score about as well: the largest multiple that keeps ≥ 80 % of the best score wins."""
    g = a.mean(-1)
    ex = np.abs(np.diff(g, axis=1)).sum(0)
    ey = np.abs(np.diff(g, axis=0)).sum(1)

    def score(p):
        sc, ph = 0, []
        for e in (ex, ey):
            ang = 2 * np.pi * (np.arange(len(e)) + 0.5) / p
            c, s_ = (e * np.cos(ang)).sum(), (e * np.sin(ang)).sum()
            sc += np.hypot(c, s_) / e.sum()
            ph.append((np.arctan2(s_, c) / (2 * np.pi) * p) % p)
        return sc, ph[0], ph[1]
    best = max(((score(p)[0], p) for p in np.arange(lo, hi, 0.02)))
    p = best[1]
    for m in (3, 2):
        q = p * m
        if q < hi * 1.5:
            # refine around the multiple
            cand = max(((score(r)[0], r) for r in np.arange(q - 0.3, q + 0.3, 0.01)))
            if cand[0] >= 0.8 * best[0]:
                p = cand[1]
                break
    sc, phx, phy = score(p)
    return p, phx, phy, sc


def pixelize(rgb, al, pitch, phx, phy, up):
    """resample onto the detected grid: each output pixel = median colour of the inner half of its cell, alpha
    thresholded (crisp pixel edges), then nearest-neighbour ×up"""
    H, W = al.shape
    xs = np.arange(phx + 0.5 - pitch, W, pitch); ys = np.arange(phy + 0.5 - pitch, H, pitch)
    xs = xs[(xs + pitch > 0)]; ys = ys[(ys + pitch > 0)]
    nx, ny = len(xs) - 1, len(ys) - 1
    out = np.zeros((ny, nx, 4), np.float32)
    q = pitch * 0.25
    for j in range(ny):
        y0, y1 = int(max(0, ys[j] + q)), int(min(H, ys[j + 1] - q)) + 1
        for i in range(nx):
            x0, x1 = int(max(0, xs[i] + q)), int(min(W, xs[i + 1] - q)) + 1
            if x1 <= x0 or y1 <= y0:
                continue
            aa = al[y0:y1, x0:x1]
            A = aa.mean()
            if A < 0.5:
                continue
            m = aa > 0.5
            out[j, i, :3] = np.median(rgb[y0:y1, x0:x1][m], axis=0)
            out[j, i, 3] = 1
    img = Image.fromarray(np.dstack([out[..., :3], out[..., 3] * 255]).astype(np.uint8), 'RGBA')
    if up > 1:
        img = img.resize((img.width * up, img.height * up), Image.NEAREST)
    return img


def cmd_sprites(o):
    a = load(o.inp)
    bg = bg_color(a)
    al = matte(a, bg)
    if o.glow_kill and bg[0] > 150 and bg[2] > 150 and bg[1] < 110:
        # glows baked over the key colour (lamps, torches, magic): pink = mix of light and magenta → fade them out
        pink = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1] - 30) / 110
        al = al * (1 - np.clip(pink, 0, 1))
    f = unmix(a, bg, al)
    solid = al > 0.5
    grown = ndimage.binary_dilation(solid, iterations=o.join)
    lab, n = ndimage.label(grown)
    H, W = al.shape
    objs = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sl is None:
            continue
        area = (solid[sl] & (lab[sl] == i + 1)).sum()
        if area < o.min_area * H * W:
            continue
        objs.append((sl, i + 1))
    if o.order == 'x':
        objs.sort(key=lambda t: t[0][1].start)
    else:  # reading order: rows of similar top
        objs.sort(key=lambda t: (round((t[0][0].start + t[0][0].stop) / 2 / (H / o.bands)), t[0][1].start))
    hs = [int(x) for x in o.hs.split(',')] if o.hs else None
    pix = None
    if o.pixel:
        pitch, phx, phy, sc = grid_pitch(a) if o.pixel == 'auto' else (float(o.pixel), 0.0, 0.0, 0)
        pitch *= o.pitch_mult  # sample coarser than the drawn grid (e.g. 2 → one output pixel per 2×2 drawn pixels)
        pix = (pitch, phx, phy)
        print(f'pixel grid: pitch {pitch:.2f}px phase ({phx:.1f},{phy:.1f}) score {sc:.3f}')
    for k, (sl, lb) in enumerate(objs):
        pad = 6
        y0, y1 = max(0, sl[0].start - pad), min(H, sl[0].stop + pad)
        x0, x1 = max(0, sl[1].start - pad), min(W, sl[1].stop + pad)
        m = (lab[y0:y1, x0:x1] == lb)
        m = ndimage.binary_dilation(m, iterations=2)
        if pix:
            p_, px_, py_ = pix
            th_ = (hs[k] if hs and k < len(hs) else 0)
            if th_:  # resample the drawn art so this sprite ends up th_ device px tall (th_/up output pixels)
                p_ = (sl[0].stop - sl[0].start) / (th_ / o.up)
            # snap the crop to the grid so the cells stay aligned
            x0 = int(max(0, px_ + p_ * np.floor((x0 - px_) / p_))); y0 = int(max(0, py_ + p_ * np.floor((y0 - py_) / p_)))
            m = (lab[y0:y1, x0:x1] == lb); m = ndimage.binary_dilation(m, iterations=2)
            img = pixelize(f[y0:y1, x0:x1], al[y0:y1, x0:x1] * m, p_, (px_ - x0) % p_, (py_ - y0) % p_, o.up)
            if o.flip_idx and str(k) in o.flip_idx.split(','):
                img = img.transpose(Image.FLIP_LEFT_RIGHT)
            p = f'{o.out}_{k}.png'
            __import__("os").makedirs(__import__("os").path.dirname(p) or ".", exist_ok=True)
            img.save(p, optimize=True); print(p, img.size)
            continue
        img = Image.fromarray(rgba(f[y0:y1, x0:x1], al[y0:y1, x0:x1] * m), 'RGBA')
        th = (hs[k] if hs and k < len(hs) else o.h)
        if o.scale:
            img = resize_rgba(img, max(1, round(img.width * o.scale)), max(1, round(img.height * o.scale)))
        elif th:
            s = th / img.height
            # premultiplied resize so transparent pixels do not bleed colour into the edge
            img = resize_rgba(img, max(1, round(img.width * s)), th)
        if o.flip or (o.flip_idx and str(k) in o.flip_idx.split(',')):
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        p = f'{o.out}_{k}.png'
        __import__("os").makedirs(__import__("os").path.dirname(p) or ".", exist_ok=True)
        img.save(p, optimize=True)
        print(p, img.size)


def resize_rgba(img, w, h):
    a = np.asarray(img).astype(np.float32) / 255
    pm = a.copy()
    pm[..., :3] *= pm[..., 3:4]
    r = np.dstack([np.asarray(Image.fromarray(pm[..., c], 'F').resize((w, h), Image.LANCZOS)) for c in range(4)])
    r = np.clip(r, 0, 1)
    al = np.clip(r[..., 3:4], 1e-4, 1)
    rgb = np.clip(r[..., :3] / al, 0, 1)
    out = np.dstack([rgb, r[..., 3:4]])
    out[..., 3] = np.where(r[..., 3] < 2 / 255, 0, r[..., 3])
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')


def _seam_cols(cost):
    """min-cost top-to-bottom path through cost[h, w] (x moves at most 1 per row) → x per row"""
    h, w = cost.shape
    acc = cost.copy()
    back = np.zeros((h, w), np.int8)
    for y in range(1, h):
        prev = acc[y - 1]
        l = np.concatenate([[np.inf], prev[:-1]]); r = np.concatenate([prev[1:], [np.inf]])
        stack = np.stack([l, prev, r])
        k = stack.argmin(0)
        acc[y] += stack[k, np.arange(w)]
        back[y] = k - 1
    xs = np.zeros(h, int); xs[-1] = int(acc[-1].argmin())
    for y in range(h - 1, 0, -1):
        xs[y - 1] = np.clip(xs[y] + back[y, xs[y]], 0, w - 1)
    return xs


def _pass_x(t, b0, b1, feather):
    """make t tileable along x: near both edges take the half-rolled copy r, switching to t along min-error seams"""
    n = t.shape[1]
    r = np.roll(t, n // 2, 1)
    diff = np.abs(t - r).sum(-1)
    wL = np.zeros(t.shape[:2]); wR = np.zeros(t.shape[:2])
    xl = _seam_cols(diff[:, b0:b1]) + b0
    xr = _seam_cols(diff[:, n - b1:n - b0]) + n - b1
    xs = np.arange(n)[None, :]
    useR = 1 - np.clip((xs - xl[:, None] + feather) / (2 * feather), 0, 1)  # 1 left of the left seam
    useR = np.maximum(useR, np.clip((xs - xr[:, None] + feather) / (2 * feather), 0, 1))  # 1 right of the right seam
    return t * (1 - useR[..., None]) + r * useR[..., None]


def seamless(t, flatten=True):
    """tileable texture by quilting: the half-offset copy covers the borders and is cut in along minimum-error
    seams (x pass, then y pass), so bricks and planks stay whole instead of ghosting; large-scale light
    variation is flattened first so the repeat is not obvious"""
    n = t.shape[0]
    if flatten:
        low = np.dstack([ndimage.gaussian_filter(t[..., c], n / 6, mode='wrap') for c in range(3)])
        t = t - low * 0.55 + low.reshape(-1, 3).mean(0) * 0.55
    b0, b1, f = int(n * 0.06), int(n * 0.3), 2.5
    t = _pass_x(t, b0, b1, f)
    t = np.transpose(_pass_x(np.transpose(t, (1, 0, 2)), b0, b1, f), (1, 0, 2))
    return t


def cmd_grid(o):
    img = Image.open(o.inp).convert('RGB')
    W, H = img.size
    cw, ch = W / o.cols, H / o.rows
    k = 0
    for j in range(o.rows):
        for i in range(o.cols):
            ix, iy = cw * o.inset, ch * o.inset
            box = (int(i * cw + ix), int(j * ch + iy), int((i + 1) * cw - ix), int((j + 1) * ch - iy))
            c = img.crop(box)
            s = min(c.size)
            n = o.size // o.up if o.up > 1 else o.size
            c = c.crop((0, 0, s, s)).resize((n, n), Image.LANCZOS)
            t = Image.fromarray(np.clip(seamless(np.asarray(c).astype(np.float32)), 0, 255).astype(np.uint8))
            if o.up > 1:
                t = t.resize((o.size, o.size), Image.NEAREST)
            p = f'{o.out}_{k}.png'
            t.save(p, optimize=True)
            print(p)
            k += 1


def cmd_fit(o):
    img = Image.open(o.inp).convert('RGB')
    s = max(o.w / img.width, o.h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (img.width - o.w) // 2
    y = int((img.height - o.h) * o.ay)
    img = img.crop((x, y, x + o.w, y + o.h))
    if o.up > 1:  # pixel look: 1 art pixel = up×up output pixels
        img = img.resize((o.w // o.up, o.h // o.up), Image.LANCZOS).resize((o.w, o.h), Image.NEAREST)
    img.save(o.out, quality=92)
    print(o.out)


def cmd_preview(o):
    ims = [Image.open(p).convert('RGBA') for p in o.files]
    W = sum(i.width for i in ims) + 20 * (len(ims) + 1)
    H = max(i.height for i in ims) + 40
    out = Image.new('RGBA', (W, H), (70, 90, 70, 255))
    # half the strip light, half dark, to show fringes on both
    out.paste((200, 205, 190, 255), (0, H // 2, W, H))
    x = 20
    for i in ims:
        out.alpha_composite(i, (x, 20)); x += i.width + 20
    out.convert('RGB').save(o.out)
    print(o.out)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd')
    s = sp.add_parser('sprites'); s.add_argument('inp'); s.add_argument('out')
    s.add_argument('--h', type=int, default=0); s.add_argument('--hs', default='')
    s.add_argument('--order', default='x'); s.add_argument('--bands', type=float, default=3)
    s.add_argument('--min-area', type=float, default=0.004); s.add_argument('--join', type=int, default=10)
    s.add_argument('--flip', action='store_true'); s.add_argument('--scale', type=float, default=0); s.add_argument('--glow-kill', action='store_true')
    s.add_argument('--pixel', default=''); s.add_argument('--up', type=int, default=2); s.add_argument('--flip-idx', default=''); s.add_argument('--pitch-mult', type=float, default=1)
    g = sp.add_parser('grid'); g.add_argument('inp'); g.add_argument('out')
    g.add_argument('--cols', type=int, default=3); g.add_argument('--rows', type=int, default=3)
    g.add_argument('--size', type=int, default=256); g.add_argument('--up', type=int, default=1); g.add_argument('--inset', type=float, default=0.06)
    f = sp.add_parser('fit'); f.add_argument('inp'); f.add_argument('out')
    f.add_argument('--w', type=int, default=1024); f.add_argument('--h', type=int, default=608); f.add_argument('--ay', type=float, default=0.5); f.add_argument('--up', type=int, default=1)
    pv = sp.add_parser('preview'); pv.add_argument('out'); pv.add_argument('files', nargs='+')
    o = ap.parse_args()
    {'sprites': cmd_sprites, 'grid': cmd_grid, 'fit': cmd_fit, 'preview': cmd_preview}[o.cmd](o)


if __name__ == '__main__':
    main()
