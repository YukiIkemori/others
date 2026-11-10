"""Paints the field as pixel art, by hand so to speak, from what the bake step knows about the model.

Nothing here comes from a rendered picture.  For every pixel the bake says which material is seen, which way it
faces, whether the key light reaches it and how hemmed in it is.  From that each pixel gets one of eight tones of
its material's colour ramp.  The ramps are built the way the hero sprite is coloured: shadows lean toward navy,
lights toward warm cream, with a near-black outline, so the field and the characters share one palette logic.

  paint(bk, meta, P) -> rgb (H, W, 3) 0..1, alpha (H, W) 0/1, mid (H, W, 3) uint8: the middle tone of each pixel's ramp
"""
import numpy as np
from PIL import Image

LUM = np.array([0.299, 0.587, 0.114], np.float32)


def hexs(*cs):
    return np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in cs], np.float32) / 255


# Eight tones per material, darkest first.  Tone 0 doubles as the coloured outline.
RAMP = {
    'stone':  hexs('#14131f', '#24273a', '#393f58', '#565c76', '#7c7c8e', '#a8a09f', '#d4c5b0', '#f4e6c8'),
    'pale':   hexs('#1a1a29', '#30344a', '#4d526b', '#727489', '#9c98a0', '#c6bbb0', '#e8d9bd', '#fdf2d6'),
    'grass':  hexs('#0a1620', '#0f2a2a', '#17422d', '#255d30', '#3d7a35', '#629a3d', '#93b94c', '#c9d66b'),
    'dirt':   hexs('#1d0f0d', '#331c17', '#4e2d21', '#6e442c', '#8f5f3a', '#b08050', '#d0a36c', '#edc892'),
    'wood':   hexs('#170b0b', '#2d1913', '#44261a', '#5d3722', '#7c4c2f', '#9a603a', '#ba7e4c', '#dba266'),
    'roof':   hexs('#080d18', '#0f1a30', '#172543', '#213256', '#30446c', '#465d8a', '#6a82aa', '#9db0cc'),
    'leaf':   hexs('#07121a', '#0b2226', '#11342a', '#1a4a2e', '#2a6434', '#44803c', '#6c9c48', '#9bb85c'),
    'autumn': hexs('#2a0f12', '#4a1510', '#752012', '#a32e18', '#c9431c', '#e5641f', '#f48a2a', '#fcb648'),
    'iron':   hexs('#040305', '#0b0e13', '#141a1e', '#1c2026', '#2a2e36', '#3d4048', '#565a66', '#7d8194'),
    'cloth':  hexs('#1e0a10', '#3a0f15', '#5f141a', '#881b1f', '#b02823', '#d0412a', '#e7683b', '#f5985b'),
    'gold':   hexs('#32180d', '#5a3014', '#8a5524', '#b47632', '#d69343', '#ecb155', '#fecb57', '#fde98c'),
    'wax':    hexs('#3a2a22', '#5d4735', '#84694d', '#a98b66', '#c9ab82', '#e3c9a0', '#f4e2bd', '#fff6dc'),
    'water':  hexs('#060a15', '#0a1120', '#0f1b33', '#152745', '#1d3558', '#2b4770', '#42608e', '#6c8ab6'),
    'bell':   hexs('#140f0c', '#2b1f14', '#4a361b', '#6e5324', '#937330', '#b59643', '#d6bb62', '#f2dc90'),
}
ORDER = list(RAMP)
CID = {k: i for i, k in enumerate(ORDER)}
TONES = np.stack([RAMP[k] for k in ORDER])          # (classes, 8, 3)
# how many tones a material sits below plain stone in the same light
SHIFT = np.array([{'stone': -0.2, 'pale': 0.4, 'grass': -1.6, 'leaf': -1.3, 'dirt': -1.0, 'roof': -0.8, 'wood': -0.5, 'water': -2.0,
                   'autumn': -0.3, 'cloth': -0.4, 'iron': -1.0, 'bell': -0.4}.get(k, 0.0) for k in ORDER], np.float32)
OUTLINE = hexs('#0b0a12')[0]
FLAME = hexs('#fff3ac', '#fcdb3b', '#f6ac20', '#ed621f')
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16.0


def hash01(a, b, seed=0.0):
    h = np.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453
    return h - np.floor(h)


def vnoise(x, y, scale, seed=0.0):
    xs, ys = x / scale, y / scale
    xi, yi = np.floor(xs), np.floor(ys)
    fx, fy = xs - xi, ys - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    l = lambda p, q, t: p + (q - p) * t
    return l(l(hash01(xi, yi, seed), hash01(xi + 1, yi, seed), fx), l(hash01(xi, yi + 1, seed), hash01(xi + 1, yi + 1, seed), fx), fy)


def fbm(x, y, scale, seed=0.0):
    return 0.55 * vnoise(x, y, scale, seed) + 0.3 * vnoise(x, y, scale / 2.1, seed + 1) + 0.15 * vnoise(x, y, scale / 4.3, seed + 2)


def path_dist(x, y, paths):
    best = np.full(x.shape, 1e9, np.float32)
    for pts, w in paths:
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            dx, dy = bx - ax, by - ay
            t = np.clip(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
            best = np.minimum(best, np.hypot(x - (ax + t * dx), y - (ay + t * dy)) / w)
    return best


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def paint(bk, meta, P):
    S, SIN, COS, W, H, X0, SY0 = P['S'], P['SIN'], P['COS'], P['W'], P['H'], P['X0'], P['SY0']
    names = [str(n) for n in bk['names']]
    vz, vn, vc, vm, lit = bk['vz'], bk['vnrm'], bk['vcol'], bk['vmat'], bk['lit'].astype(np.float32)
    zmap, kind = bk['zmap'], bk['kind']
    KEY = bk['key']
    seen = vm > 0
    z = np.where(seen, np.nan_to_num(vz), 0.0)
    jj, ii = np.mgrid[0:H, 0:W].astype(np.float32)
    wx = X0 + (ii + 0.5) / S
    wy = ((SY0 - (jj + 0.5)) / S - z * COS) / SIN
    ao = np.asarray(Image.fromarray(bk['ao']).resize((W, H), Image.BILINEAR))
    r, g, b = vc[..., 0], vc[..., 1], vc[..., 2]
    lum = vc @ LUM
    MID = {n: k + 1 for k, n in enumerate(names)}
    is_ = lambda *ns: np.isin(vm, [MID[n] for n in ns if n in MID])

    # ---------------------------------------------------------------- which ramp
    cls = np.full((H, W), CID['stone'], np.uint8)
    ref = np.full((H, W), 0.335, np.float32)        # the usual brightness of that material's own colour in the model
    def put(m, name, rf):
        cls[m] = CID[name]
        ref[m] = rf
    stone = is_('stone', 'stone_round', 'pebble', 'floor')
    put(stone & (lum > 0.395), 'pale', 0.45)
    put(stone & (lum < 0.11) & (r > b * 1.4), 'wood', 0.07)
    put(stone & (lum < 0.11) & (g > r * 1.2), 'leaf', 0.05)
    put(stone & (lum < 0.02), 'iron', 0.02)
    ter = is_('terrain')
    dirt = ter & (r > g * 1.12)
    if 'paths' in meta:      # the model colours the ground in squares; the edge of a path is drawn afresh, ragged and to the pixel
        pd = path_dist(wx, wy, meta['paths']) + (fbm(wx, wy, 1.6, 5.0) - 0.5) * 0.55 + (hash01(ii, jj, 2.0) - 0.5) * 0.12
        dirt = ter & (pd < 1.0)
    put(ter, 'grass', 0.085)
    put(dirt, 'dirt', 0.115)
    put(is_('wood', 'trunk', 'twig'), 'wood', 0.07)
    fol = is_('leaf', 'core')
    put(fol, 'leaf', 0.07)
    cov = is_('cover')
    put(cov, 'grass', 0.105)
    red = (fol | cov) & (r > g * 1.3)
    put(red, 'autumn', 0.16)
    put(is_('roof'), 'roof', 0.09)
    put(is_('metal', 'iron'), 'iron', 0.03)
    put(is_('bell'), 'bell', 0.17)
    cl = is_('cloth', 'carpet')
    put(cl, 'wax', 0.6)
    put(cl & (r > g * 2.2), 'cloth', 0.09)
    put(cl & (r > b * 2.2) & (r <= g * 2.2), 'gold', 0.27)
    put(is_('water'), 'water', 0.03)
    lamp = is_('lampglass') & (lum > 0.1)
    put(is_('lampglass') & ~lamp, 'iron', 0.03)
    flame = is_('flame')
    flower = is_('flower')
    glass = is_('glass')
    soft = fol | cov                      # leaves and blades: lit as a mass, not by each card's own facing

    # ---------------------------------------------------------------- how much light
    ndl = np.clip(vn @ KEY, 0, 1)
    nz = np.clip(vn[..., 2], 0, 1)
    val = (0.30 + 0.12 * nz) * (0.45 + 0.55 * ao) + 0.70 * ndl * lit
    tone = np.clip(np.log2(np.maximum(lum, 1e-4) / ref), -1.2, 1.2)        # this face against its material: block to block
    val = val + 0.10 * tone
    val = np.where(soft, 0.50 + 0.36 * lit + 0.22 * tone + 0.35 * (ao - 0.75), val)
    patchy = (fbm(wx, wy, 5.0, 1.0) - 0.5) * 2.4 + (fbm(wx, wy, 1.3, 7.0) - 0.5) * 1.2      # lighter and darker drifts in the grass
    val = np.where(ter, val - 0.10 * tone + 0.075 * np.round(patchy), val)
    lv = (val - 0.08) / 0.15 + SHIFT[cls]

    # small marks drawn into flat ground: blades in the grass, grit on the paths, pits in old stone
    tick = hash01(ii, np.floor(jj / 2), 3.0)
    spk = hash01(np.floor(ii / 2), jj, 5.0)
    grass_t = ter & ~dirt
    lv = lv + np.where(grass_t & (tick < 0.075), 1.0, 0.0) - np.where(grass_t & (tick > 0.94), 1.0, 0.0)
    lv = lv + np.where(dirt & (spk < 0.05), 1.0, 0.0) - np.where(dirt & (spk > 0.955), 1.0, 0.0)
    roof = is_('roof')                          # slates: a dark line under each course, and joints that break bond
    course = np.floor(z * 2.3)
    lv = lv - np.where(roof & ((z * 2.3) % 1.0 < 0.2), 1.0, 0.0) - np.where(roof & (((wx + wy) * 1.5 + course * 0.5) % 1.0 < 0.1), 1.0, 0.0)
    lv = lv + np.where(roof, np.round((hash01(course, np.floor((wx + wy) * 1.5 + course * 0.5), 4.0) - 0.5) * 1.6), 0.0)
    flat_stone = stone & (nz > 0.9)
    lv = lv - np.where(flat_stone & (hash01(ii, jj, 7.0) > 0.975), 1.0, 0.0)

    # ---------------------------------------------------------------- lanterns and candles: pools of warm light, in steps
    glow = np.zeros((H, W), np.float32)
    for l in meta['lights']:
        if l['kind'] == 'bell':
            continue
        rad = float(l['r']) * 0.95
        sx, sy = (l['x'] - X0) * S, SY0 - (l['y'] * SIN + l['z'] * COS) * S
        x0, x1 = int(max(0, sx - rad * S)), int(min(W, sx + rad * S))
        y0, y1 = int(max(0, sy - rad * S * 1.4)), int(min(H, sy + rad * S * 1.4))
        if x1 <= x0 or y1 <= y0:
            continue
        sl = (slice(y0, y1), slice(x0, x1))
        dx, dy, dz = l['x'] - wx[sl], l['y'] - wy[sl], l['z'] - z[sl]
        d = np.sqrt(dx * dx + dy * dy + dz * dz) + 1e-4
        n = vn[sl]
        f = np.clip((n[..., 0] * dx + n[..., 1] * dy + n[..., 2] * dz) / d, 0, 1) * 0.75 + 0.25
        f = np.where(soft[sl], 0.7, f)
        w = np.clip(1 - d / rad, 0, 1) ** 2 * f
        glow[sl] = np.maximum(glow[sl], w)
    glow = glow + (BAYER[(jj.astype(int) % 4), (ii.astype(int) % 4)] - 0.5) * 0.035 * (glow > 0.03)     # a dithered rim to each step
    lv = lv + np.where(glow > 0.09, 1.0, 0.0) + np.where(glow > 0.26, 1.0, 0.0) + np.where(glow > 0.55, 1.0, 0.0)
    warm = np.where(glow > 0.5, 2, np.where(glow > 0.16, 1, 0))

    # ---------------------------------------------------------------- the slopes fall away into the dark
    fall = np.clip((-0.7 - z) / 1.5, 0, 6) + np.clip((np.abs(wx) - 28.3) / 0.9, 0, 6)
    lv = lv - np.floor(fall + BAYER[(jj.astype(int) % 4), (ii.astype(int) % 4)] * 0.9)

    # ---------------------------------------------------------------- outlines and edge lights
    hit = ~np.isnan(zmap)
    zg = np.where(hit, zmap, 0.0)
    yg = ((SY0 - (jj + 0.5)) / S - zg * COS) / SIN
    dep = np.where(hit, yg * COS - zg * SIN, 1e3)
    jump = np.zeros((H, W), np.float32)
    for dy_, dx_ in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        jump = np.maximum(jump, np.roll(dep, (dy_, dx_), (0, 1)) - dep)
    vis_cover = cov | flower
    gnz = bk['nrm'][..., 2]
    gnz = np.where(gnz * 0 == 0, np.abs(gnz), 0)
    below, nzb = np.roll(dep, -1, 0), np.roll(gnz, -1, 0)
    above, nza = np.roll(dep, 1, 0), np.roll(gnz, 1, 0)
    hard = (kind == 1) | (kind == 2)
    toplight = hard & (np.abs(below - dep) < 0.3) & (gnz > 0.75) & (nzb < 0.35) & ~vis_cover      # the lip of a top face
    foot = hard & (np.abs(above - dep) < 0.3) & (gnz > 0.75) & (nza < 0.35) & ~vis_cover           # ground meeting a wall
    lv = lv + np.where(toplight, 1.0, 0.0) - np.where(foot, 1.0, 0.0)
    thr = np.where(kind == 3, 1.1, 0.3)
    inner = (jump > thr) & (jump <= 1.4) & ~vis_cover
    outer = (jump > 1.4) & ~vis_cover
    lv = np.where(inner, np.minimum(lv - 2.5, 1.0), lv)

    # ---------------------------------------------------------------- tones to colours
    idx = np.clip(np.floor(lv), 0, 7).astype(np.int64)
    rgb = TONES[cls, idx]
    WARM1 = np.clip(TONES * np.array([1.10, 0.99, 0.80], np.float32) + np.array([0.03, 0.01, 0.0], np.float32), 0, 1)
    WARM2 = np.clip(TONES * np.array([1.18, 1.0, 0.66], np.float32) + np.array([0.07, 0.03, 0.0], np.float32), 0, 1)
    rgb = np.where((warm == 1)[..., None], WARM1[cls, idx], rgb)
    rgb = np.where((warm == 2)[..., None], WARM2[cls, idx], rgb)
    rgb = np.where(outer[..., None], TONES[cls, 0] * 0.55 + OUTLINE * 0.45, rgb)
    # things that give light or are painted flat
    if glass.any():
        # a short list of glass colours from the same family as the sprites, with dark leading between the panes
        GLASS = hexs('#2b4a8c', '#3f74b8', '#8a2a3c', '#d0412a', '#ecb155', '#fde98c', '#3d7a6a', '#7a4a8a', '#f3ead6')
        key = vc[..., 0] * 3.1 + vc[..., 1] * 7.3 + vc[..., 2] * 13.7
        pick = (hash01(np.round(key * 40), 3.0, 5.0) * len(GLASS)).astype(int) % len(GLASS)
        gc = GLASS[pick]
        lead = np.zeros_like(glass)
        lead[:, 1:] |= np.abs(key[:, 1:] - key[:, :-1]) > 1e-3
        lead[1:, :] |= np.abs(key[1:, :] - key[:-1, :]) > 1e-3
        gc = np.where(((jj + ii) % 8 < 2)[..., None], np.clip(gc * 1.12 + 0.04, 0, 1), gc)      # a glint across each pane
        gc = np.where(lead[..., None], hexs('#15141f')[0], gc)
        rgb = np.where(glass[..., None], gc, rgb)
    rgb = np.where(lamp[..., None], np.where((hash01(ii, jj, 1.0) < 0.35)[..., None], FLAME[0], FLAME[1]), rgb)
    rgb = np.where(flame[..., None], FLAME[1], rgb)
    rgb = np.where(flower[..., None], np.where((tick < 0.5)[..., None], hexs('#e9f3ff')[0], hexs('#b7cdea')[0]), rgb)

    # ---------------------------------------------------------------- the pool: dark water, a few ripples, the two moons
    water = is_('water')
    if water.any() and 'pool' in meta:
        px_, py_ = meta['pool']
        rip = (hash01(np.floor(ii / 5), jj, 9.0) < 0.10) & (np.floor(jj) % 3 == 0)
        rgb = np.where((water & rip)[..., None], RAMP['water'][5], rgb)
        def disc(qx, qy, rad):
            return water & (((wx - qx) / rad) ** 2 + ((wy - qy) / rad) ** 2 < 1.0)
        m1 = disc(px_ - 0.95, py_ - 0.55, 0.56)
        rgb = np.where(m1[..., None], hexs('#fbf0c9')[0], rgb)
        rgb = np.where(disc(px_ - 0.95, py_ - 0.55, 0.36)[..., None], hexs('#fffbe9')[0], rgb)
        m2 = disc(px_ + 0.85, py_ + 0.75, 0.60)
        rgb = np.where(m2[..., None], hexs('#8a6fe0')[0], rgb)
        rgb = np.where(disc(px_ + 0.85, py_ + 0.75, 0.47)[..., None], hexs('#05040c')[0], rgb)

    alpha = seen.astype(np.float32)
    mid = (TONES[cls, 4] * 255 + 0.5).astype(np.uint8)
    mid[~seen] = 0
    return rgb.astype(np.float32), alpha, mid
