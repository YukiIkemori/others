"""Stage 7 of tools/sheets.py — checked native sprites -> palette, cleanup, anchors, weapon attach points,
game sheets + JSON.  (Called by sheets.py; not a command of its own.)

Sets written to <out>/<set>/<char>_<set>.png/.json (one uniform cell per set, anchor at the same pixel):
  field        walk_<dir>_0..2, run_<dir>_0..3, act_*                       (sheets 1–4)
  battle       idle_a idle_b step guard hit weak ko victory_a victory_b glimmer,
               windup slash thrust_ready thrust charge smash cast_a cast_b item evade, flee sleep confuse cover
  battle_bare  bare_idle bare_windup bare_slash bare_thrust bare_cast   (+ points.grip, attach angle)
  weapons      wpn_sword wpn_greatsword wpn_dagger wpn_bow wpn_staff    (anchor = grip, points.tip)
  face         face_neutral … face_tired                                  (own palette)
"""
import json
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage as nd

import pixlib as P
import build as B
from brief_spec import SHEETS

LYING = {'act_lie', 'ko', 'sleep'}


def finish(img, pal, cfg=None):
    f = P.remap(img, pal)
    f = P.mode_filter(f, pal, de_max=10.0, passes=1)
    f = P.cleanup(f, pal, orphan_de=12.0)
    f = P.selout(f, pal, max_L=42.0)
    f = P.remap(f, pal)
    bb = P.bbox(f[..., 3] > 0)
    return f[bb[0]:bb[1], bb[2]:bb[3]]


# ------------------------------------------------------------------ registration
def _canvas(im, ox, oy, W, H):
    c = np.zeros((H, W, 4), np.uint8)
    h, w = im.shape[:2]
    x0, y0 = max(0, ox), max(0, oy)
    x1, y1 = min(W, ox + w), min(H, oy + h)
    if x1 > x0 and y1 > y0:
        c[y0:y1, x0:x1] = im[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return c


def register(img, base, mode='upper', search=6, face=False):
    """Offset (dx, dy): img local (x, y) = base local (x - dx, y - dy + hi - hb) — i.e. img placed bottom-aligned
    and dx to the right of base. The search starts from the feet (or centres for faces) lining up.
    mode: 'upper' | 'lower' (rows of base compared, dy = 0) | 'all' (whole, dy searched too)."""
    if face:
        x0 = int(round(base.shape[1] / 2 - img.shape[1] / 2))
    else:
        x0 = B.foot_anchor(base)[0] - B.foot_anchor(img)[0]
    M = search + abs(x0) + 2
    W = max(img.shape[1], base.shape[1]) + 2 * M
    H = max(img.shape[0], base.shape[0]) + 2 * search + 2
    by = H - search - base.shape[0]
    bc = _canvas(base, M, by, W, H)
    ba = bc[..., 3] > 0
    hb = base.shape[0]
    rows = np.zeros(H, bool)
    if mode == 'upper':
        rows[by:by + int(hb * 0.55)] = True
    elif mode == 'lower':
        rows[by + int(hb * 0.55):] = True
    else:
        rows[:] = True
    best = (-1e9, 0, 0)
    dys = range(-search, search + 1) if mode == 'all' else [0]
    for dy in dys:
        for dx in range(x0 - search, x0 + search + 1):
            ic = _canvas(img, M + dx, H - search - img.shape[0] + dy, W, H)
            ia = ic[..., 3] > 0
            inter = (ia & ba)[rows].sum()
            uni = (ia | ba)[rows].sum() + 1e-9
            same = ((np.abs(ic[..., :3].astype(int) - bc[..., :3].astype(int)).sum(-1) < 40) & ia & ba)[rows].sum()
            sc = inter / uni + 0.5 * same / uni
            if sc > best[0]:
                best = (sc, dx, dy)
    return best[1], best[2], float(best[0])


# ------------------------------------------------------------------ weapons
def weapon_axis(im, kind):
    """-> grip (x, y), tip (x, y), angle_deg (image coords, 180 = tip to the left)."""
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    pts = np.stack([xs, ys], 1).astype(float)
    c = pts.mean(0)
    u, s, vt = np.linalg.svd(pts - c, full_matrices=False)
    d = vt[0]
    if d[0] > 0:
        d = -d                      # d points toward the tip (left)
    t = (pts - c) @ d
    n = (pts - c) @ np.array([-d[1], d[0]])
    tmin, tmax = t.min(), t.max()   # tmax = tip end
    L = tmax - tmin
    if kind == 'bow':
        g = c
    elif kind == 'staff':
        g = c + d * (tmax - 0.62 * L)
    else:
        # guard = widest cross-section in the hilt half
        bins = np.round(t).astype(int)
        hilt = bins < (tmin + 0.5 * L)
        widths = {}
        for b in np.unique(bins[hilt]):
            nn = n[bins == b]
            widths[b] = nn.max() - nn.min()
        gb = max(widths, key=lambda b: (widths[b], -b)) if widths else tmin + 0.2 * L
        g = c + d * ((gb + tmin) / 2.0)
    tip = c + d * tmax
    ang = math.degrees(math.atan2(tip[1] - g[1], tip[0] - g[0]))
    return [int(round(g[0])), int(round(g[1]))], [int(round(tip[0])), int(round(tip[1]))], round(ang, 1), int(round(L)) + 1


def attach_from_diff(bare, armed):
    """Weapon pixels = armed minus bare (after registration). -> dict(grip, tip, angle) in bare coords, or None."""
    dx, dy, sc = register(bare, armed, mode='all', search=6)
    # put both on one canvas: armed at the origin, bare shifted by (dx, dy) with bottom alignment
    M = 8 + abs(dx)
    W = max(bare.shape[1], armed.shape[1]) + 2 * M
    H = max(bare.shape[0], armed.shape[0]) + 20
    ay = H - 8 - armed.shape[0]
    A = _canvas(armed, M, ay, W, H)
    Bc = _canvas(bare, M + dx, H - 8 - bare.shape[0] + dy, W, H)
    aa, ba = A[..., 3] > 0, Bc[..., 3] > 0
    labA = P.srgb_to_lab(A[..., :3].astype(float))
    labB = P.srgb_to_lab(Bc[..., :3].astype(float))
    de = np.linalg.norm(labA - labB, axis=-1)
    cand = aa & (~ba | (de > 28))
    cand = nd.binary_opening(cand, structure=np.ones((2, 2))) | (cand & nd.binary_dilation(nd.binary_opening(cand, structure=np.ones((2, 2))), iterations=1))
    lab, k = nd.label(cand, structure=np.ones((3, 3)))
    if k == 0:
        return None
    sizes = nd.sum(cand, lab, range(1, k + 1))
    w = lab == (sizes.argmax() + 1)
    if w.sum() < 10:
        return None
    ys, xs = np.where(w)
    pts = np.stack([xs, ys], 1).astype(float)
    body = ba & ~w
    near = w & nd.binary_dilation(body, iterations=1)
    if near.sum() == 0:
        near = w
    c = pts.mean(0)
    _, _, vt = np.linalg.svd(pts - c, full_matrices=False)
    d = vt[0]
    t = (pts - c) @ d
    gy, gx = np.where(near)
    tc = (np.stack([gx, gy], 1) - c) @ d
    # the hilt is the end of the weapon where it touches the body
    hilt_hi = abs(tc.mean() - t.max()) < abs(tc.mean() - t.min())
    L = t.max() - t.min()
    keep = (tc >= t.max() - 0.3 * L) if hilt_hi else (tc <= t.min() + 0.3 * L)
    if keep.any():
        gx, gy = gx[keep], gy[keep]
    g = np.array([gx.mean(), gy.mean()])
    tip = c + d * (t.min() if hilt_hi else t.max())
    ang = math.degrees(math.atan2(tip[1] - g[1], tip[0] - g[0]))
    # back to bare-local coords
    ox, oy = M + dx, H - 8 - bare.shape[0] + dy
    return dict(grip=[int(round(g[0] - ox)), int(round(g[1] - oy))], tip=[int(round(tip[0] - ox)), int(round(tip[1] - oy))],
                angle=round(ang, 1), length=int(round(L)) + 1, weapon_px=int(w.sum()), fit=round(sc, 3))


# ------------------------------------------------------------------ sets
def write_rows(od, char, name, rows, pal, meta, anims, margin=2):
    """rows: list of lists of (fid, img, (ax, ay), points)."""
    flat = [f for r in rows for f in r]
    L = max(ax for _, _, (ax, ay), _ in flat)
    R = max(im.shape[1] - ax for _, im, (ax, ay), _ in flat)
    U = max(ay for _, _, (ax, ay), _ in flat)
    D = max(im.shape[0] - ay for _, im, (ax, ay), _ in flat)
    cw, ch = L + R + 2 * margin, U + D + 2 * margin
    anchor = [L + margin, U + margin]
    cols = max(len(r) for r in rows)
    sheet = np.zeros((ch * len(rows), cw * cols, 4), np.uint8)
    frames = {}
    for j, r in enumerate(rows):
        for i, (fid, im, (ax, ay), pts) in enumerate(r):
            ox, oy = anchor[0] - ax, anchor[1] - ay
            x, y = i * cw, j * ch
            sheet[y + oy:y + oy + im.shape[0], x + ox:x + ox + im.shape[1]] = im
            frames[fid] = dict(x=x, y=y, w=cw, h=ch, anchor=anchor,
                               points={k: [v[0] + ox, v[1] + oy] for k, v in pts.items()})
    d = os.path.join(od, name)
    os.makedirs(d, exist_ok=True)
    Image.fromarray(sheet).save(os.path.join(d, '%s_%s.png' % (char, name)))
    js = dict(character=char, set=name, image='%s_%s.png' % (char, name), cell=[cw, ch], anchor=anchor,
              anchor_note='anchor = ground contact point (x between the feet, y = the ground row); weapons: the grip',
              frames=frames, anims=anims, palette=['#%02x%02x%02x' % tuple(int(v) for v in c) for c in pal], **meta)
    with open(os.path.join(d, '%s_%s.json' % (char, name)), 'w') as f:
        json.dump(js, f, indent=1)
    return sheet


def pack(char, od, runs, rep, colors=52):
    spr = {}
    for n, sp in runs.items():
        for sid, v in sp.items():
            spr[sid] = dict(v, sheet=n)
    if not spr:
        return
    body = [v['img'] for v in spr.values() if v['sheet'] != 9]
    faces = [v['img'] for v in spr.values() if v['sheet'] == 9]
    pal = P.build_palette(body, k=colors, merge_de=3.0) if body else None
    fpal = P.build_palette(faces, k=48, merge_de=3.0) if faces else None
    os.makedirs(os.path.join(od, 'sprites'), exist_ok=True)
    fin = {}
    for sid, v in spr.items():
        fin[sid] = finish(v['img'], fpal if v['sheet'] == 9 else pal)
        Image.fromarray(fin[sid]).save(os.path.join(od, 'sprites', sid + '.png'))
    with open(os.path.join(od, 'palette.json'), 'w') as f:
        json.dump(dict(shared=['#%02x%02x%02x' % tuple(int(x) for x in c) for c in (pal if pal is not None else [])],
                       face=['#%02x%02x%02x' % tuple(int(x) for x in c) for c in (fpal if fpal is not None else [])]), f, indent=1)
    if pal is not None:
        sw = Image.new('RGB', (16 * 16, 16 * ((len(pal) + 15) // 16)))
        for i, c in enumerate(pal):
            sw.paste(tuple(int(x) for x in c), ((i % 16) * 16, (i // 16) * 16, (i % 16) * 16 + 16, (i // 16) * 16 + 16))
        sw.save(os.path.join(od, 'palette.png'))
    # ---- anchors
    anc = {}
    for sid, im in fin.items():
        if spr[sid]['sheet'] == 9:
            anc[sid] = (im.shape[1] // 2, im.shape[0] - 1)
        elif sid.startswith('wpn_'):
            continue
        else:
            ax, ay = B.foot_anchor(im, lying=sid in LYING)
            anc[sid] = (ax, ay + spr[sid].get('air', 0))
    regs = {}
    for n, sp in runs.items():
        mode = 'all' if n == 9 else 'lower' if n == 5 else 'upper'
        for sid, base in SHEETS[n]['register'].items():
            if sid in fin and base in fin:
                dx, dy, s = register(fin[sid], fin[base], mode=mode, face=n == 9)
                bax, bay = anc[base]
                hb, hi = fin[base].shape[0], fin[sid].shape[0]
                # base anchor measured from the bottom, carried over with the found offset
                anc[sid] = (bax - dx, hi - (hb - bay) - dy + spr[sid].get('air', 0) * 0)
                regs[sid] = dict(to=base, dx=dx, dy=dy, fit=round(s, 3))
    # ---- weapon attach (sheet 7 row 1 vs the armed poses of sheets 5/6)
    attach = {}
    arm = SHEETS[7]['armed']
    for bare, armed in arm.items():
        if bare in fin and armed in fin:
            at = attach_from_diff(fin[bare], fin[armed])
            if at is not None and at['fit'] < 1.1:
                rep.add(7, 'check', 'attach_fit', '%s と %s の体が重ならない（大きさ・位置・ポーズが違う）。武器の位置はあてにならない' % (bare, armed), slot=bare)
                at['unreliable'] = True
            if at is None:
                rep.add(7, 'check', 'attach', '%s と %s の差から武器の位置が取れない（武器ありと武器なしがほぼ同じ）。手の位置を手で入れる' % (bare, armed), slot=bare)
            else:
                attach[bare] = at
                # the bare pose sits where the armed one does: same anchor offset
                if bare in anc and armed in anc:
                    dx, dy, _ = register(fin[bare], fin[armed], mode='all')
                    anc[bare] = (anc[armed][0] - dx, fin[bare].shape[0] - (fin[armed].shape[0] - anc[armed][1]) - dy)
        elif bare in fin:
            rep.add(7, 'check', 'attach', '%s の武器ありの絵（%s）が無いので、武器の位置が取れない' % (bare, armed), slot=bare)
    wpn = {}
    for sid in ('wpn_sword', 'wpn_greatsword', 'wpn_dagger', 'wpn_bow', 'wpn_staff'):
        if sid in fin:
            g, t, a, ln = weapon_axis(fin[sid], sid[4:])
            wpn[sid] = dict(grip=g, tip=t, angle=a, length=ln)
            anc[sid] = tuple(g)
    if 'wpn_sword' in wpn and 'bare_idle' in attach:
        ls, la = wpn['wpn_sword']['length'], attach['bare_idle']['length']
        if la > 0 and abs(ls / la - 1) > 0.2:
            rep.add(7, 'check', 'weapon_scale', '武器だけの片手剣（長さ %.0f）と、待機Aの剣（長さ %.0f）の縮尺が違う' % (ls, la))

    # ---- manual overrides: configs/overrides/<char>.json  {"anchors": {id: [x, y]}, "attach": {bare_id: {grip, angle}}}
    ov_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'configs', 'overrides', char + '.json')
    if os.path.exists(ov_path):
        ov = json.load(open(ov_path))
        for k, v in ov.get('anchors', {}).items():
            if k in anc:
                anc[k] = tuple(v)
        for k, v in ov.get('attach', {}).items():
            if k in fin:
                attach[k] = dict(attach.get(k, {}), **v, manual=True)
                attach[k].pop('unreliable', None)
        for k, v in ov.get('weapons', {}).items():
            if k in wpn:
                wpn[k].update(v)
                anc[k] = tuple(wpn[k]['grip'])

    def pts(sid):
        p = B.points(fin[sid], sid)
        if sid in attach:
            p['grip'] = attach[sid]['grip']
            p['tip'] = attach[sid]['tip']
        if sid in wpn:
            p = dict(grip=wpn[sid]['grip'], tip=wpn[sid]['tip'])
        return p

    def row(ids):
        return [(s, fin[s], anc[s], pts(s)) for s in ids if s in fin]

    # ---- field
    frows = []
    for n in (1, 2, 3, 4):
        if n in runs:
            frows += [row(r) for r in SHEETS[n]['ids']]
    frows = [r for r in frows if r]
    written = {}
    if frows:
        an = {}
        for d in ('down', 'up', 'left', 'right'):
            if 'walk_%s_0' % d in fin:
                an['walk_' + d] = {'frames': ['walk_%s_%d' % (d, i) for i in (0, 1, 0, 2)], 'ms': [160] * 4, 'loop': True}
                an['stand_' + d] = {'frames': ['walk_%s_0' % d], 'ms': [0]}
            if 'run_%s_0' % d in fin:
                an['run_' + d] = {'frames': ['run_%s_%d' % (d, i) for i in range(4)], 'ms': [100] * 4, 'loop': True}
        for s in fin:
            if s.startswith('act_'):
                an[s] = {'frames': [s], 'ms': [0]}
        written['field'] = write_rows(od, char, 'field', frows, pal, dict(directions=['down', 'up', 'left', 'right'], target_height=48), an)
    # ---- battle
    brows = []
    for n in (5, 6, 8):
        if n in runs:
            brows += [row(r) for r in SHEETS[n]['ids']]
    brows = [r for r in brows if r]
    if brows:
        an = {}
        if 'idle_a' in fin:
            an['idle'] = {'frames': ['idle_a', 'idle_b'] if 'idle_b' in fin else ['idle_a'], 'ms': [520, 520], 'loop': True}
        seqs = {'attack_sword': ['windup', 'slash'], 'attack_thrust': ['thrust_ready', 'thrust'], 'attack_smash': ['charge', 'smash'],
                'cast': ['cast_a', 'cast_b'], 'victory': ['victory_a', 'victory_b']}
        for k, fs in seqs.items():
            fs = [f for f in fs if f in fin]
            if fs:
                an[k] = {'keys': [{'frame': 'step' if 'step' in fin else 'idle_a', 'ms': 140, 'dx': -24, 'ease': 'out'}] * (k.startswith('attack')) +
                         [{'frame': f, 'ms': 110 if i == 0 else 220, 'dx': -24 if k.startswith('attack') else 0, 'hit': i == len(fs) - 1 and k.startswith('attack'),
                           'fx_at': 'front'} for i, f in enumerate(fs)] +
                         [{'frame': 'idle_a', 'ms': 200, 'dx': 0, 'ease': 'in_out'}] * (k.startswith('attack'))}
        for s in ('guard', 'hit', 'weak', 'ko', 'glimmer', 'item', 'evade', 'flee', 'sleep', 'confuse', 'cover', 'step'):
            if s in fin:
                an[s] = {'frames': [s], 'ms': [0]}
        written['battle'] = write_rows(od, char, 'battle', brows, pal, dict(facing='left', target_height=64), an)
    if 7 in runs:
        r1 = row(SHEETS[7]['ids'][0])
        if r1:
            written['battle_bare'] = write_rows(od, char, 'battle_bare', [r1], pal, dict(
                facing='left', attach={k: v for k, v in attach.items()},
                attach_note='draw a weapon on a bare pose: rotate the weapon image about its grip by (attach.angle - weapon.angle) '
                            'and put its grip on points.grip. Angles in image coords (0 = +x, 90 = +y, 180 = pointing left).'), {})
        r2 = [(s, fin[s], anc[s], pts(s)) for s in SHEETS[7]['ids'][1] if s in fin]
        if r2:
            written['weapons'] = write_rows(od, char, 'weapons', [r2], pal, dict(weapons=wpn), {})
    if 9 in runs:
        r = [row(x) for x in SHEETS[9]['ids']]
        r = [x for x in r if x]
        if r:
            written['face'] = write_rows(od, char, 'face', r, fpal, dict(facing='slightly right', target_height=80), {})
    # ---- weapon try-on (review only): every weapon on every bare pose
    if attach and wpn:
        tryon(od, char, fin, attach, wpn, anc)
    review_all(od, char, written)
    with open(os.path.join(od, 'pack.json'), 'w') as f:
        json.dump(dict(registration=regs, attach=attach, weapons=wpn, sets=list(written),
                       colors=int(len(pal)) if pal is not None else 0, face_colors=int(len(fpal)) if fpal is not None else 0), f, indent=1)
    print('packed', ', '.join('%s %dx%d' % (k, v.shape[1], v.shape[0]) for k, v in written.items()),
          '| palette', len(pal) if pal is not None else 0, '+ face', len(fpal) if fpal is not None else 0)


def rotate_about(im, grip, ang):
    """Nearest-neighbour rotation by ang degrees (image coords) about grip; returns (img, new_grip)."""
    pad = int(max(im.shape) * 1.5) + 4
    c = np.zeros((pad * 2, pad * 2, 4), np.uint8)
    c[pad - grip[1]:pad - grip[1] + im.shape[0], pad - grip[0]:pad - grip[0] + im.shape[1]] = im
    r = np.asarray(Image.fromarray(c).rotate(-ang, resample=Image.NEAREST, center=(pad, pad)))
    b = P.bbox(r[..., 3] > 0)
    return r[b[0]:b[1], b[2]:b[3]], (pad - b[2], pad - b[0])


def tryon(od, char, fin, attach, wpn, anc):
    tiles = []
    for bare, at in attach.items():
        row_t = []
        for wid, w in wpn.items():
            im, g = rotate_about(fin[wid], w['grip'], at['angle'] - w['angle'])
            body = fin[bare]
            pad = 40
            c = np.zeros((body.shape[0] + 2 * pad, body.shape[1] + 2 * pad, 4), np.uint8)
            c[pad:pad + body.shape[0], pad:pad + body.shape[1]] = body
            x, y = pad + at['grip'][0] - g[0], pad + at['grip'][1] - g[1]
            a = im[..., 3:] > 0
            sub = c[y:y + im.shape[0], x:x + im.shape[1]]
            c[y:y + im.shape[0], x:x + im.shape[1]] = np.where(a, im, sub)
            row_t.append(c)
        tiles.append(row_t)
    cw = max(t.shape[1] for r in tiles for t in r)
    ch = max(t.shape[0] for r in tiles for t in r)
    out = Image.new('RGBA', (cw * len(tiles[0]), ch * len(tiles)), (92, 92, 104, 255))
    for j, r in enumerate(tiles):
        for i, t in enumerate(r):
            out.alpha_composite(Image.fromarray(t), (i * cw, j * ch))
    os.makedirs(os.path.join(od, 'review'), exist_ok=True)
    out.resize((out.width * 3, out.height * 3), Image.NEAREST).save(os.path.join(od, 'review', 'weapons_tryon.png'))


def review_all(od, char, written):
    parts = [B.on_grey(s) for s in written.values()]
    if not parts:
        return
    W = max(p.width for p in parts)
    H = sum(p.height + 6 for p in parts)
    sheet = Image.new('RGBA', (W, H), (40, 40, 48, 255))
    y = 0
    for p in parts:
        sheet.paste(p, (0, y))
        y += p.height + 6
    sheet.save(os.path.join(od, '%s_all_1x.png' % char))
    sheet.resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(od, '%s_all_3x.png' % char))
