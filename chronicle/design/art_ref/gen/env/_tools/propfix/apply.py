"""Composite one edited window back into the painting (all tile sizes) with a feathered mask around the painted props.
usage: python3 apply.py <map> <k> [--dry]     (reads plan.json and design/art_ref/gen/env/propfix/<map>_w<k>.png)
- aligns the edit to the painting (integer shift search at 32 px/tile), matches colour (per-channel linear fit outside the masks),
- per prop: checks the model actually painted something there (mean change in the sprite box); if not, the prop stays a sprite,
- writes <image>@24/32/40.png in place (a backup of the untouched painting is kept once in work/orig/), appends to applied.json."""
import json, os, sys, shutil
import numpy as np
from PIL import Image, ImageFilter
import lib
HERE = os.path.dirname(os.path.abspath(__file__)); WORK = os.path.join(HERE, 'work')
RAW = '/home/user/others/chronicle/design/art_ref/gen/env/propfix'
ALL = '--all' in sys.argv
SKIP = set(a for a in sys.argv if '@' in a)   # id@x,y: the review found the model removed it -> stays a sprite   # after a visual check: every prop of the window counts as painted
MIN_CHANGE = 1.6   # box change / ring change: below this the model left the spot empty (removed the object)
def sizes(mid):
    a = lib.MAPS[mid]['art']['image']
    return [t for t in (24, 32, 40) if os.path.exists('%s/%s@%d.png' % (lib.ENV, a, t))]
def backup(mid):
    a = lib.MAPS[mid]['art']['image']; d = os.path.join(WORK, 'orig'); os.makedirs(d, exist_ok=True)
    for t in sizes(mid):
        src = '%s/%s@%d.png' % (lib.ENV, a, t); dst = os.path.join(d, '%s@%d.png' % (mid, t))
        if not os.path.exists(dst): shutil.copy(src, dst)
_pre = {}
def warp(gen, ww, wh, T, s, ox, oy):
    """edit (48 px/tile) -> window at T px/tile; window point p32 maps to gen point k*(s*(p32 - c) + c + o), k = gen px per 32-px"""
    k = gen.width / (ww * 32.0); cx, cy = ww * 16.0, wh * 16.0; a = k * s * 32.0 / T
    key = (id(gen), T)
    if key not in _pre:   # box-like pre-scale to about the target density once, then a small bilinear affine
        a0 = k * 32.0 / T
        _pre[key] = gen.resize((max(1, round(gen.width / a0)), max(1, round(gen.height / a0))), Image.LANCZOS) if a0 > 1.01 else gen
    pre = _pre[key]; f = gen.width / pre.width
    return pre.transform((ww * T, wh * T), Image.AFFINE, (a / f, 0, k * ((1 - s) * cx + ox) / f, 0, a / f, k * ((1 - s) * cy + oy) / f), Image.BILINEAR)
def prop_box(o, t):
    s = lib.sprite(o['id'], o.get('v', 0), t)
    fx, fy = lib.feetpos(o, t)
    if not s: return (fx - t / 2, fy - t, fx + t / 2, fy)
    fr, feet = s[0], s[1]
    bb = fr.getbbox() or (0, 0, fr.width, fr.height)
    x0 = fx - feet[0]; y0 = fy - feet[1]
    return (x0 + bb[0], y0 + bb[1], x0 + bb[2], y0 + bb[3])
def main(mid, k, dry=False):
    P = json.load(open(os.path.join(HERE, 'plan.json')))[mid]; win = P['windows'][k]
    x0, y0, ww, wh = win['rect']; t = 32
    gen = Image.open('%s/%s_w%d.png' % (RAW, mid, k)).convert('RGB')
    backup(mid)
    base32 = np.asarray(Image.open(os.path.join(WORK, 'orig', '%s@32.png' % mid)).convert('RGB')).astype(np.float32)
    H, W = base32.shape[:2]
    # window in map px (may reach outside the map)
    X0, Y0 = x0 * t, y0 * t
    ref = np.zeros((wh * t, ww * t, 3), np.float32); valid = np.zeros((wh * t, ww * t), bool)
    sx0, sy0 = max(0, -X0), max(0, -Y0); sx1, sy1 = min(ww * t, W - X0), min(wh * t, H - Y0)
    ref[sy0:sy1, sx0:sx1] = base32[Y0 + sy0:Y0 + sy1, X0 + sx0:X0 + sx1]; valid[sy0:sy1, sx0:sx1] = True
    # masks (window coords): prop boxes + margin; 'far' = away from every prop, used for alignment and colour
    boxes = []
    for p in win['props']:
        bx = prop_box(p, t); boxes.append((bx[0] - X0, bx[1] - Y0, bx[2] - X0, bx[3] - Y0))
    near = np.zeros((wh * t, ww * t), bool)
    for b in boxes: near[max(0, int(b[1]) - 12):int(b[3]) + 12, max(0, int(b[0]) - 12):int(b[2]) + 12] = True
    edge = 24; far = valid & ~near; far[:edge] = far[-edge:] = False; far[:, :edge] = far[:, -edge:] = False
    # 1. the model sometimes reframes the crop a little (zoom + shift): fit scale s and offset (ox, oy) in 32 px/tile window coords
    nz = lambda v: (v - v[far].mean()) / max(1e-3, v[far].std())
    ry = nz(ref.mean(2))
    def err(s_, ox, oy):
        g = nz(np.asarray(warp(gen, ww, wh, 32, s_, ox, oy)).astype(np.float32).mean(2))
        return np.abs(g - ry)[far].mean() * 40
    best = min((err(s_, 0, 0), s_) for s_ in np.arange(0.86, 1.141, 0.02))
    sc = best[1]; ox = oy = 0.0
    for step in (8, 4, 2, 1, 0.5):
        for _ in range(6):
            cand = [(err(sc + ds, ox + dx, oy + dy), sc + ds, ox + dx, oy + dy) for ds in (0, -step / 400, step / 400) for dx in (-step, 0, step) for dy in (-step, 0, step)]
            e, sc2, ox2, oy2 = min(cand)
            if (sc2, ox2, oy2) == (sc, ox, oy): break
            sc, ox, oy = sc2, ox2, oy2
    e0 = err(sc, ox, oy); dx, dy = ox, oy
    g32 = np.asarray(warp(gen, ww, wh, 32, sc, ox, oy)).astype(np.float32)
    # 2. colour: per channel a*x+b fitted on far pixels
    fit = []
    for c in range(3):   # moment matching (a least-squares fit on re-rendered texture regresses the gain toward 0)
        gv, rv = g32[..., c][far], ref[..., c][far]
        a_ = float(np.clip(rv.std() / max(1e-3, gv.std()), 0.7, 1.4)); b_ = float(rv.mean() - a_ * gv.mean())
        fit.append((a_, b_)); g32[..., c] = g32[..., c] * a_ + b_
    g32 = np.clip(g32, 0, 255)
    # 3. per prop: did the model paint an object there?
    painted, kept = [], []
    mask = np.zeros(g32.shape[:2], np.float32)
    for p, b in zip(win['props'], boxes):
        xa, ya, xb, yb = int(max(0, b[0])), int(max(0, b[1])), int(min(ww * t, b[2] + 1)), int(min(wh * t, b[3] + 1))
        d = np.abs(g32 - ref).mean(2)
        box = d[ya:yb, xa:xb].mean() if xb > xa and yb > ya else 0
        ring = np.concatenate([d[max(0, ya - 10):max(0, ya - 3), max(0, xa - 10):xb + 10].ravel(), d[yb + 4:yb + 10, max(0, xa - 10):xb + 10].ravel(),
                               d[ya:yb, max(0, xa - 10):max(0, xa - 3)].ravel(), d[ya:yb, xb + 3:xb + 10].ravel()])
        ch = box / max(1.0, ring.mean() if ring.size else e0)
        p['change'] = round(float(ch), 2)
        if (ch < MIN_CHANGE and not ALL) or '%s@%d,%d' % (p['id'], p['x'], p['y']) in SKIP: kept.append(p); continue
        painted.append(p)
        mx, my = 5, 5
        mask[max(0, ya - my):min(wh * t, yb + my + 3), max(0, xa - mx):min(ww * t, xb + mx + 2)] = 1
    mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255
    mask = np.minimum(mask * 1.6, 1) * valid
    print('%s w%d scale %.3f shift %+.1f,%+.1f err %.1f colour %s painted %d kept %d' % (mid, k, sc, dx, dy, e0, [(round(a, 2), round(b, 1)) for a, b in fit], len(painted), len(kept)),
          [(p['id'], p['x'], p['y'], p['change']) for p in kept])
    if dry: return painted, kept, g32, ref, mask
    # 4. every tile size: resample the corrected edit and the mask, composite in place
    gfull = gen.copy()
    garr = np.asarray(gfull).astype(np.float32)
    for c in range(3): garr[..., c] = garr[..., c] * fit[c][0] + fit[c][1]
    gfull = Image.fromarray(np.clip(garr, 0, 255).astype(np.uint8))
    a = lib.MAPS[mid]['art']['image']
    for T in sizes(mid):
        f = '%s/%s@%d.png' % (lib.ENV, a, T); cur = Image.open(f); mode = cur.mode
        cur = np.asarray(cur.convert('RGBA')).astype(np.float32)
        gT = np.asarray(warp(gfull, ww, wh, T, sc, ox, oy)).astype(np.float32)
        mT = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize((ww * T, wh * T), Image.BILINEAR)).astype(np.float32)[..., None] / 255
        HX, WX = cur.shape[:2]; XT, YT = x0 * T, y0 * T
        a0, b0 = max(0, -YT), max(0, -XT); a1, b1 = min(wh * T, HX - YT), min(ww * T, WX - XT)
        reg = cur[YT + a0:YT + a1, XT + b0:XT + b1, :3]
        cur[YT + a0:YT + a1, XT + b0:XT + b1, :3] = reg * (1 - mT[a0:a1, b0:b1]) + gT[a0:a1, b0:b1] * mT[a0:a1, b0:b1]
        Image.fromarray(np.clip(cur + 0.5, 0, 255).astype(np.uint8), 'RGBA').convert(mode).save(f, optimize=True)
    rec = os.path.join(HERE, 'applied.json'); R = json.load(open(rec)) if os.path.exists(rec) else {}
    R['%s_w%d' % (mid, k)] = dict(scale=round(sc, 4), shift=[dx, dy], painted=[[p['id'], p['x'], p['y']] for p in painted], kept=[[p['id'], p['x'], p['y']] for p in kept])
    json.dump(R, open(rec, 'w'), indent=1)
if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]), '--dry' in sys.argv)
