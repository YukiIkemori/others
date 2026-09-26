#!/usr/bin/env python3
"""Stage 2 — native sprites -> game sprite sheets + JSON (frames, anchors, sizes, palette, animations).

  python3 tools/build.py configs/arun_owner_sheet.json

Reads  out/<char>/sprites/*.png  (from extract.py) and the config's "build" block.
Writes out/<char>/<set>/<char>_<set>.png   transparent sheet, one row per set, uniform cells
       out/<char>/<set>/<char>_<set>.json  {cell, anchor, frames{id:{x,y,w,h,anchor,points}}, anims, palette}
       out/<char>/<char>_all_1x.png / _4x.png  review sheets (on a mid-grey, with baselines)

Normalising rules
  - every frame of a set sits in the same cell size with its foot anchor on the same pixel
    (baseline = lowest opaque row; anchor x = middle of the feet, or bbox centre for lying poses)
  - battle frames face LEFT, field frames: down / up / left (side) / right (= mirrored left)
Generated animation (from single poses, when the sheet has no real frames)
  - idle breathing: rows above the waist / neck move down 1 px (seam row picked where it is least visible)
  - walk: leg split below the hip — front/back views lift one boot, side view strides the legs; 1 px bob
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

sys.path.insert(0, os.path.dirname(__file__))
import pixlib as P  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(od, sid):
    return np.asarray(Image.open(os.path.join(od, 'sprites', sid + '.png')).convert('RGBA')).copy()


# ------------------------------------------------------------------ anchors
def foot_anchor(img, lying=False):
    a = img[..., 3] > 0
    ys, xs = np.where(a)
    base = ys.max()
    if lying:
        return int(round((xs.min() + xs.max()) / 2)), int(base)
    # boots: opaque pixels in the lowest rows (up to 12% of the height)
    h = base - ys.min() + 1
    band = a[max(0, base - max(2, int(h * 0.12))):base + 1]
    cols = np.where(band.any(0))[0]
    # the feet are the two largest runs of columns; anchor = middle between their outer edges
    lab, n = nd.label(band.any(0))
    if n >= 2:
        sizes = nd.sum(np.ones_like(lab), lab, range(1, n + 1))
        big = np.argsort(-sizes)[:2] + 1
        cs = np.where(np.isin(lab, big))[0]
        return int(round((cs.min() + cs.max()) / 2)), int(base)
    return int(round((cols.min() + cols.max()) / 2)), int(base)


def points(img, sid, extra=None):
    """Named points (sprite-local px) that game code / tweens can use."""
    a = img[..., 3] > 0
    ys, xs = np.where(a)
    top = ys.min()
    head_cols = xs[ys <= top + 3]
    p = {'head': [int(round(head_cols.mean())), int(top)],
         'center': [int(round(xs.mean())), int(round(ys.mean()))]}
    # 'front' = the leftmost opaque pixel (battle frames face left): weapon tip / hit spark position
    i = xs.argmin()
    p['front'] = [int(xs[i]), int(ys[i])]
    if extra:
        p.update({k: list(v) for k, v in extra.items()})
    return p


# ------------------------------------------------------------------ generated motion
def seam_row(img, lo, hi):
    """Row in [lo, hi) whose removal changes the picture least (most similar to the row above)."""
    best, br = 1e18, lo
    f = img.astype(np.float64)
    for y in range(max(1, lo), hi):
        d = np.abs(f[y] - f[y - 1]).sum()
        if d < best:
            best, br = d, y
    return br


def drop_row(img, y):
    """Delete row y and move everything above it down by 1 (top row becomes transparent)."""
    out = img.copy()
    out[1:y + 1] = img[0:y]
    out[0] = 0
    return out


def breathing(img):
    h = img.shape[0]
    ys = np.where((img[..., 3] > 0).any(1))[0]
    t, b = ys.min(), ys.max()
    H = b - t + 1
    waist = seam_row(img, t + int(H * 0.46), t + int(H * 0.62))
    neck = seam_row(img, t + int(H * 0.30), t + int(H * 0.40))
    f_in = drop_row(img, waist)                 # chest + head 1 px down (exhale)
    f_mid = drop_row(img, neck)                 # head only (in-between)
    return [img, f_mid, f_in, f_mid], dict(waist=int(waist), neck=int(neck))


def shift_region(img, mask, dx, dy):
    """Move the masked pixels by (dx, dy); vacated pixels become transparent; moved pixels overwrite."""
    out = img.copy()
    out[mask] = 0
    ys, xs = np.where(mask)
    ny, nx = ys + dy, xs + dx
    ok = (ny >= 0) & (ny < img.shape[0]) & (nx >= 0) & (nx < img.shape[1])
    out[ny[ok], nx[ok]] = img[ys[ok], xs[ok]]
    return out


def pad(img, n=3):
    return np.pad(img, ((n, n), (n, n), (0, 0)))


def walk_frames(img, view, leg_frac=0.20):
    """stand, step A, stand, step B.  view: 'front' / 'back' / 'side' (facing left)."""
    img = pad(img)
    a = img[..., 3] > 0
    ys, xs = np.where(a)
    t, b = ys.min(), ys.max()
    H = b - t + 1
    leg_top = b - int(round(H * leg_frac))
    ax, _ = foot_anchor(img)
    Y, X = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    legs = a & (Y > leg_top)
    upper = a & (Y <= leg_top)
    frames = []
    if view in ('front', 'back'):
        for side in (0, 1):
            f = img.copy()
            leg = legs & ((X < ax) if side == 0 else (X >= ax))
            f = shift_region(f, upper, 0, 1)                    # bob: body down 1 px
            f = shift_region(f, leg & (f[..., 3] > 0) & (Y > leg_top), 0, -1)   # lift that boot 1 px
            frames.append(f)
    else:
        for side in (0, 1):
            f = img.copy()
            f = shift_region(f, upper, 0, 1)
            lower = legs & (Y > leg_top + (b - leg_top) // 2)   # knees down stride further
            fr = (X < ax)
            f = shift_region(f, (legs & fr) & (f[..., 3] > 0), -1, 0)
            f = shift_region(f, (legs & ~fr) & (f[..., 3] > 0), 1, 0)
            f = shift_region(f, (lower & fr) & (f[..., 3] > 0), -1 if side == 0 else 0, 0)
            f = shift_region(f, (lower & ~fr) & (f[..., 3] > 0), 1 if side == 1 else 0, 0)
            frames.append(f)
    crop = lambda im: im
    return [img, frames[0], img, frames[1]]


def repair_outline(img, outline):
    """After pixel moves: fill 1-px transparent notches inside the silhouette with the outline colour."""
    a = img[..., 3] > 0
    filled = nd.binary_closing(a, structure=np.ones((1, 3))) | nd.binary_closing(a, structure=np.ones((3, 1)))
    holes = filled & ~a
    out = img.copy()
    out[holes, :3] = outline
    out[holes, 3] = 255
    return out


# ------------------------------------------------------------------ sheet layout
def layout(frames, margin=2):
    """frames: list of (id, img, (ax, ay)). Uniform cell, anchor at the same place in every cell."""
    L = max(ax for _, _, (ax, ay) in frames)
    R = max(im.shape[1] - ax for _, im, (ax, ay) in frames)
    U = max(ay for _, _, (ax, ay) in frames)
    D = max(im.shape[0] - ay for _, im, (ax, ay) in frames)
    cw, ch = L + R + margin * 2, U + D + margin * 2
    anchor = (L + margin, U + margin)
    cells = []
    for fid, im, (ax, ay) in frames:
        c = np.zeros((ch, cw, 4), np.uint8)
        ox, oy = anchor[0] - ax, anchor[1] - ay
        c[oy:oy + im.shape[0], ox:ox + im.shape[1]] = im
        cells.append((fid, c, (ox, oy)))
    return cells, (cw, ch), anchor


def write_set(od, char, name, cells, cell, anchor, anims, pal, meta, extra_pts, cols=None):
    cw, ch = cell
    n = len(cells)
    cols = cols or n
    rows = (n + cols - 1) // cols
    sheet = np.zeros((rows * ch, cols * cw, 4), np.uint8)
    frames = {}
    for i, (fid, c, (ox, oy)) in enumerate(cells):
        x, y = (i % cols) * cw, (i // cols) * ch
        sheet[y:y + ch, x:x + cw] = c
        pts = extra_pts.get(fid, {})
        frames[fid] = dict(x=x, y=y, w=cw, h=ch, anchor=list(anchor),
                           points={k: [v[0] + ox, v[1] + oy] for k, v in pts.items()})
    d = os.path.join(od, name)
    os.makedirs(d, exist_ok=True)
    Image.fromarray(sheet).save(os.path.join(d, '%s_%s.png' % (char, name)))
    js = dict(character=char, set=name, image='%s_%s.png' % (char, name), cell=[cw, ch], anchor=list(anchor),
              anchor_note='anchor = foot contact point (x = between the feet, y = lowest opaque row); place it on the ground point',
              frames=frames, anims=anims, palette=pal, **meta)
    with open(os.path.join(d, '%s_%s.json' % (char, name)), 'w') as f:
        json.dump(js, f, indent=1)
    return sheet


def main():
    cfg = json.load(open(sys.argv[1]))
    char = cfg['character']
    od = os.path.join(HERE, 'out', char)
    B = cfg.get('build', {})
    pal = json.load(open(os.path.join(od, 'palette.json')))
    shared = pal['shared']
    outline = np.array([int(shared[0][i:i + 2], 16) for i in (1, 3, 5)], np.uint8)
    # darkest palette colour = outline for repairs
    darkest = min(shared, key=lambda h: sum(int(h[i:i + 2], 16) for i in (1, 3, 5)))
    outline = np.array([int(darkest[i:i + 2], 16) for i in (1, 3, 5)], np.uint8)
    report = {}

    # ---------------- battle
    bt = B.get('battle', {})
    poses = bt.get('poses', ['btl_idle', 'btl_attack', 'btl_skill', 'btl_damage', 'btl_defeat', 'btl_victory'])
    lying = set(bt.get('lying', ['btl_defeat']))
    imgs = {p: load(od, p) for p in poses}
    br, seams = breathing(imgs[poses[0]])
    frames, pts = [], {}
    for i, f in enumerate(br):
        fid = 'idle_%d' % i
        frames.append((fid, f, foot_anchor(imgs[poses[0]])))
        pts[fid] = points(f, fid)
    for p in poses[1:]:
        fid = p.replace('btl_', '')
        frames.append((fid, imgs[p], foot_anchor(imgs[p], lying=p in lying)))
        pts[fid] = points(imgs[p], fid)
    cells, cell, anchor = layout(frames)
    anims = {
        'idle': {'frames': ['idle_0', 'idle_1', 'idle_2', 'idle_1'], 'ms': [420, 160, 420, 160], 'loop': True},
        # tween-friendly: each key has an offset (art px, relative to the home position) the engine
        # interpolates between; the sprite swaps at the key
        'attack': {'keys': [
            {'frame': 'idle_0', 'ms': 80, 'dx': 0, 'dy': 0, 'ease': 'out'},
            {'frame': 'attack', 'ms': 180, 'dx': -46, 'dy': 0, 'ease': 'in_out', 'note': 'dash toward the target'},
            {'frame': 'skill', 'ms': 140, 'dx': -52, 'dy': 0, 'ease': 'out', 'hit': True, 'fx_at': 'front', 'note': 'slash; the arc is drawn by the game'},
            {'frame': 'skill', 'ms': 120, 'dx': -52, 'dy': 0},
            {'frame': 'idle_0', 'ms': 220, 'dx': 0, 'dy': 0, 'ease': 'in_out', 'note': 'return'}]},
        'damage': {'keys': [{'frame': 'damage', 'ms': 60, 'dx': 3, 'flash': True}, {'frame': 'damage', 'ms': 240, 'dx': 3},
                            {'frame': 'idle_0', 'ms': 120, 'dx': 0}]},
        'defeat': {'frames': ['damage', 'defeat'], 'ms': [160, 0], 'loop': False},
        'victory': {'frames': ['victory'], 'ms': [0], 'loop': False},
    }
    report['battle'] = dict(cell=cell, anchor=anchor, height=int(imgs[poses[0]].shape[0]), seams=seams)
    bsheet = write_set(od, char, 'battle', cells, cell, anchor, anims, shared,
                       dict(facing='left', art_px_per_sprite_px=1, target_height=bt.get('target_h', 64)), pts)

    # ---------------- field
    fl = B.get('field', {})
    views = fl.get('views', {'down': 'fld_down', 'up': 'fld_up', 'left': 'fld_side', 'threeq': 'fld_3q'})
    fr, fpts = [], {}
    for d, sid in views.items():
        if d == 'threeq':
            continue
        im = load(od, sid)
        kind = 'front' if d == 'down' else 'back' if d == 'up' else 'side'
        wf = walk_frames(im, kind, leg_frac=fl.get('leg_frac', 0.20))
        wf = [repair_outline(f, outline) if i % 2 else f for i, f in enumerate(wf)]
        for i, f in enumerate([wf[0], wf[1], wf[3]]):
            fid = '%s_%d' % (d, i)
            fr.append((fid, f, foot_anchor(wf[0])))
            fpts[fid] = points(f, fid)
    # right = mirrored left
    for i in range(3):
        fid, f, (ax, ay) = [x for x in fr if x[0] == 'left_%d' % i][0]
        m = f[:, ::-1].copy()
        fr.append(('right_%d' % i, m, (f.shape[1] - 1 - ax, ay)))
        fpts['right_%d' % i] = points(m, 'right_%d' % i)
    if 'threeq' in views:
        im = load(od, views['threeq'])
        fr.append(('threeq_0', im, foot_anchor(im)))
        fpts['threeq_0'] = points(im, 'threeq_0')
    cells, cell, anchor = layout(fr)
    fanims = {d: {'frames': ['%s_0' % d, '%s_1' % d, '%s_0' % d, '%s_2' % d], 'ms': [150] * 4, 'loop': True}
              for d in ('down', 'up', 'left', 'right')}
    fanims.update({'stand_' + d: {'frames': ['%s_0' % d], 'ms': [0]} for d in ('down', 'up', 'left', 'right')})
    report['field'] = dict(cell=cell, anchor=anchor)
    fsheet = write_set(od, char, 'field', cells, cell, anchor, fanims, shared,
                       dict(directions=['down', 'up', 'left', 'right'], target_height=fl.get('target_h', 48),
                            walk_note='generated from the turnaround (leg split + 1 px bob) until real walk frames exist'),
                       fpts, cols=3)

    # ---------------- portraits / stand
    pt = B.get('portrait', {'ids': ['face_big', 'face_normal', 'face_serious', 'face_smile', 'stand_main']})
    pd = os.path.join(od, 'portrait')
    os.makedirs(pd, exist_ok=True)
    pj = {}
    for sid in pt['ids']:
        im = load(od, sid)
        Image.fromarray(im).save(os.path.join(pd, '%s_%s.png' % (char, sid)))
        pj[sid] = dict(w=int(im.shape[1]), h=int(im.shape[0]), palette=pal.get(sid, shared))
    with open(os.path.join(pd, '%s_portrait.json' % char), 'w') as f:
        json.dump(dict(character=char, images=pj, note='portraits keep their own palette; scale ×3 for the 118 px dialogue frame'), f, indent=1)

    # ---------------- review sheets
    review(od, char, bsheet, fsheet, pd, pt['ids'])
    with open(os.path.join(od, 'build.json'), 'w') as f:
        json.dump(report, f, indent=1, default=int)
    print(json.dumps(report, default=int))


def on_grey(sheet, grey=(92, 92, 104)):
    im = Image.fromarray(sheet)
    c = Image.new('RGBA', im.size, grey + (255,))
    c.alpha_composite(im)
    return c


def review(od, char, bsheet, fsheet, pd, pids):
    parts = [on_grey(bsheet), on_grey(fsheet)]
    for sid in pids:
        parts.append(on_grey(np.asarray(Image.open(os.path.join(pd, '%s_%s.png' % (char, sid))).convert('RGBA'))))
    W = max(p.width for p in parts[:2])
    row3 = parts[2:]
    W = max(W, sum(p.width + 4 for p in row3))
    H = parts[0].height + parts[1].height + max(p.height for p in row3) + 12
    sheet = Image.new('RGBA', (W, H), (40, 40, 48, 255))
    y = 0
    for p in parts[:2]:
        sheet.paste(p, (0, y)); y += p.height + 6
    x = 0
    for p in row3:
        sheet.paste(p, (x, y)); x += p.width + 4
    sheet.save(os.path.join(od, '%s_all_1x.png' % char))
    sheet.resize((W * 4, H * 4), Image.NEAREST).save(os.path.join(od, '%s_all_4x.png' % char))


if __name__ == '__main__':
    main()
