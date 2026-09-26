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
from brief_spec import SHEETS, rows_of, armed_map

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


def blade_axis(im, min_len=10):
    """The sword blade in an armed pose: the longest elongated run of light, low-chroma (steel) pixels.
    -> dict(hilt, tip, angle, length) in im coords (tip = the end farther from the body), or None."""
    lab = P.srgb_to_lab(im[..., :3].astype(np.float64))
    a = im[..., 3] > 0
    L, A, Bb = lab[..., 0], lab[..., 1], lab[..., 2]
    m = a & (L > 50) & (np.hypot(A, Bb) < 16)
    lb, k = nd.label(m, structure=np.ones((3, 3)))
    best = None
    for i in range(1, k + 1):
        ys, xs = np.where(lb == i)
        if len(xs) < 8:
            continue
        pts = np.stack([xs, ys], 1).astype(float)
        c = pts.mean(0)
        _, s, vt = np.linalg.svd(pts - c, full_matrices=False)
        if s[0] / (s[1] + 1e-6) < 4:
            continue
        d = vt[0]
        t = (pts - c) @ d
        ln = t.max() - t.min()
        if ln >= min_len and (best is None or ln > best[0]):
            best = (ln, c, d, t.min(), t.max(), lb == i)
    if best is None:
        return None
    ln, c, d, t0, t1, mask = best
    body = a & ~mask
    by, bx = np.where(body)
    bc = np.array([bx.mean(), by.mean()]) if len(bx) else c
    e0, e1 = c + d * t0, c + d * t1
    tip, hilt = (e0, e1) if np.linalg.norm(e0 - bc) > np.linalg.norm(e1 - bc) else (e1, e0)
    ang = math.degrees(math.atan2(tip[1] - hilt[1], tip[0] - hilt[0]))
    return dict(hilt=hilt, tip=tip, angle=ang, length=float(ln) + 1)


def attach_from_blade(bare, armed, handle_off):
    """Weapon attach for a bare pose from the blade of its armed twin: the blade gives the angle exactly; the hand
    (grip) is handle_off px behind the blade's hilt end; both are carried into bare coords by body registration.
    Works when the bare and armed bodies differ a little (the diff method needs them to overlap)."""
    b = blade_axis(armed)
    if b is None:
        return None
    dx, dy, sc = register(bare, armed, mode='all', search=6)
    d = (b['tip'] - b['hilt']) / max(1e-6, np.linalg.norm(b['tip'] - b['hilt']))
    g = b['hilt'] - d * handle_off
    # armed local -> bare local (both bottom-aligned; bare shifted by dx, dy)
    ox = -dx
    oy = (bare.shape[0] - armed.shape[0]) - dy
    grip = [int(round(g[0] + ox)), int(round(g[1] + oy))]
    tip = [int(round(b['tip'][0] + ox)), int(round(b['tip'][1] + oy))]
    # snap the grip onto the bare body (the fist) when it landed in the air
    a = bare[..., 3] > 0
    if not (0 <= grip[1] < a.shape[0] and 0 <= grip[0] < a.shape[1] and a[grip[1], grip[0]]):
        dist, (iy, ix) = nd.distance_transform_edt(~a, return_indices=True)
        gy, gx = min(max(grip[1], 0), a.shape[0] - 1), min(max(grip[0], 0), a.shape[1] - 1)
        if dist[gy, gx] <= 4:
            grip = [int(ix[gy, gx]), int(iy[gy, gx])]
    return dict(grip=grip, tip=tip, angle=round(b['angle'], 1), length=int(round(b['length'] + handle_off)),
                blade=round(b['length'], 1), fit=round(sc, 3), method='blade')


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
    isface = lambda n: SHEETS[n]['kind'] == 'face'      # faces get their own palette
    body = [v['img'] for v in spr.values() if not isface(v['sheet'])]
    faces = [v['img'] for v in spr.values() if isface(v['sheet'])]
    pal = P.build_palette(body, k=colors, merge_de=3.0) if body else None
    fpal = P.build_palette(faces, k=48, merge_de=3.0) if faces else None
    os.makedirs(os.path.join(od, 'sprites'), exist_ok=True)
    fin = {}
    for sid, v in spr.items():
        fin[sid] = finish(v['img'], fpal if isface(v['sheet']) else pal)
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
        if isface(spr[sid]['sheet']):
            anc[sid] = (im.shape[1] // 2, im.shape[0] - 1)
        elif sid.startswith('wpn_'):
            continue
        else:
            ax, ay = B.foot_anchor(im, lying=sid in LYING)
            anc[sid] = (ax, ay + spr[sid].get('air', 0))
    regs = {}
    for n, sp in runs.items():
        mode = SHEETS[n].get('register_mode', 'upper')
        for sid, base in SHEETS[n]['register'].items():
            if sid in fin and base in fin:
                dx, dy, s = register(fin[sid], fin[base], mode=mode, face=isface(n))
                bax, bay = anc[base]
                hb, hi = fin[base].shape[0], fin[sid].shape[0]
                # base anchor measured from the bottom, carried over with the found offset
                anc[sid] = (bax - dx, hi - (hb - bay) - dy + spr[sid].get('air', 0) * 0)
                regs[sid] = dict(to=base, dx=dx, dy=dy, fit=round(s, 3))
    # ---- weapon attach (sheet 7 row 1 vs the armed poses of sheets 5/6)
    # ---- weapons first: scale to the sword the character holds (sheet 7 row 2 is often drawn larger)
    wids = [s for s in ('wpn_sword', 'wpn_greatsword', 'wpn_dagger', 'wpn_bow', 'wpn_staff') if s in fin]
    held = [b['length'] for b in (blade_axis(fin[s]) for s in ('step', 'guard', 'hit', 'windup', 'slash', 'thrust_ready', 'thrust') if s in fin) if b]
    wscale = 1.0
    if 'wpn_sword' in fin and len(held) >= 3:
        bw = blade_axis(fin['wpn_sword'])
        if bw:
            r = float(np.median(held)) / bw['length']
            if abs(np.log(r)) > np.log(1.12):
                wscale = r
                for s in wids:
                    fin[s] = finish(P.rescale_pixel(fin[s], r), pal)
                    Image.fromarray(fin[s]).save(os.path.join(od, 'sprites', s + '.png'))
                rep.add(7, 'auto', 'weapon_scale', '武器だけの5つが、手に持った剣より約 %d%% の大きさで描かれていた（刃 %.0f / %.0f ドット）。体に合わせて %d%% に縮めた' % (
                    round(100 / r), bw['length'], np.median(held), round(100 * r)))
    wpn = {}
    for sid in wids:
        g, t, a, ln = weapon_axis(fin[sid], sid[4:])
        wpn[sid] = dict(grip=g, tip=t, angle=a, length=ln)
        if wscale != 1.0:
            wpn[sid]['scaled'] = round(wscale, 3)
        anc[sid] = tuple(g)
    # hand position behind the blade: the sword's grip (handle centre) minus the blade end, in weapon px
    handle_off = 8.0
    if 'wpn_sword' in wpn:
        bw = blade_axis(fin['wpn_sword'])
        if bw:
            handle_off = float(np.hypot(*(np.array(wpn['wpn_sword']['grip']) - bw['hilt'])))
    attach = {}
    bare_n, arm = armed_map()        # Arun: sheet 7; a companion: its sheet 4 (or 4b)
    for bare, armed in arm.items():
        if armed is None:            # generic sword grip with no armed twin (companions): tools/companion_spec.py
            continue
        if bare in fin and armed in fin:
            at = attach_from_blade(fin[bare], fin[armed], handle_off)
            if at is None:              # blade hidden (sheathed / behind the body): the difference of the two
                at = attach_from_diff(fin[bare], fin[armed])
                if at is not None:
                    at['method'] = 'diff'
            if at is None:
                rep.add(bare_n, 'check', 'attach', '%s と %s から武器の位置が取れない。手の位置を configs/overrides で入れる' % (bare, armed), slot=bare)
                continue
            if at['fit'] < 0.35:
                rep.add(bare_n, 'check', 'attach_fit', '%s と %s の体の形がかなり違う。武器の持ち手の位置を review/weapons_tryon.png で見る' % (bare, armed), slot=bare)
                at['unreliable'] = True
            attach[bare] = at
            # the bare pose sits where the armed one does: same anchor offset
            if bare in anc and armed in anc:
                dx, dy, _ = register(fin[bare], fin[armed], mode='all')
                anc[bare] = (anc[armed][0] - dx, fin[bare].shape[0] - (fin[armed].shape[0] - anc[armed][1]) - dy)
        elif bare in fin:
            rep.add(bare_n, 'check', 'attach', '%s の武器ありの絵（%s）が無いので、武器の位置が取れない' % (bare, armed), slot=bare)
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
                if 'tip' not in v:     # tip = the held sword's length along the set angle
                    Ls = wpn.get('wpn_sword', {}).get('length', attach[k].get('length', 30))
                    ga = math.radians(attach[k]['angle'])
                    attach[k]['tip'] = [int(round(attach[k]['grip'][0] + Ls * math.cos(ga))), int(round(attach[k]['grip'][1] + Ls * math.sin(ga)))]
                # a hand-set grip settles the 'look at the grip' notes for that pose
                rep.items = [i for i in rep.items if not (i['code'] in ('attach', 'attach_fit') and i['slot'] == k)]
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

    def rows_for(set_name):
        return [x for x in (row(SHEETS[n]['ids'][r]) for n, r in rows_of(set_name, runs)) if x]

    def body_h(set_name, default):
        rs = rows_of(set_name, runs)
        return SHEETS[rs[0][0]].get('body_h', default) if rs else default

    # ---- field
    frows = rows_for('field')
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
        written['field'] = write_rows(od, char, 'field', frows, pal, dict(directions=['down', 'up', 'left', 'right'], target_height=body_h('field', 48)), an)
    # ---- battle
    brows = rows_for('battle')
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
        if 'hit' in fin:
            an['hurt'] = {'keys': [{'frame': 'hit', 'ms': 80, 'dx': 6, 'ease': 'out'}, {'frame': 'hit', 'ms': 240, 'dx': 6},
                                   {'frame': 'idle_a' if 'idle_a' in fin else 'hit', 'ms': 200, 'dx': 0, 'ease': 'in_out'}]}
        if 'ko' in fin:
            an['ko_fall'] = {'keys': [{'frame': f, 'ms': m, 'dx': 6} for f, m in (('hit', 160), ('weak', 320), ('ko', 900)) if f in fin]}
        for s in ('guard', 'hit', 'weak', 'ko', 'glimmer', 'item', 'evade', 'flee', 'sleep', 'confuse', 'cover', 'step'):
            if s in fin:
                an[s] = {'frames': [s], 'ms': [0]}
        written['battle'] = write_rows(od, char, 'battle', brows, pal, dict(facing='left', target_height=body_h('battle', 64)), an)
    bare_rows = rows_for('battle_bare')
    if bare_rows:
        written['battle_bare'] = write_rows(od, char, 'battle_bare', bare_rows, pal, dict(
            facing='left', attach={k: v for k, v in attach.items()},
            attach_note='draw a weapon on a bare pose: rotate the weapon image (as drawn on sheet 7, tip to the left) about its grip '
                        'by (attach.angle - 180) degrees and put its grip on points.grip. Angles in image coords '
                        '(0 = +x, 90 = +y, 180 = pointing left); positive = clockwise on screen.'), {})
    wrows = [[(s, fin[s], anc[s], pts(s)) for s in SHEETS[n]['ids'][r] if s in fin] for n, r in rows_of('weapons', runs)]
    wrows = [x for x in wrows if x]
    if wrows:
        written['weapons'] = write_rows(od, char, 'weapons', wrows, pal, dict(weapons=wpn), {})
    r = rows_for('face')
    if r:
        written['face'] = write_rows(od, char, 'face', r, fpal, dict(facing='slightly right', target_height=body_h('face', 80)), {})
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


def paste(dst, im, x, y):
    """alpha-paste im onto dst at (x, y), clipped to dst (the weapon may reach past the canvas)"""
    H, W = dst.shape[:2]
    h, w = im.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return dst
    src = im[y0 - y:y1 - y, x0 - x:x1 - x]
    a = src[..., 3:] > 0
    dst[y0:y1, x0:x1] = np.where(a, src, dst[y0:y1, x0:x1])
    return dst


def tryon(od, char, fin, attach, wpn, anc):
    """review/weapons_tryon.png: every weapon on every bare pose (rows = poses, columns = weapons)"""
    tiles = []
    for bare, at in attach.items():
        row_t = []
        for wid, w in wpn.items():
            im, g = rotate_about(fin[wid], w['grip'], at['angle'] - 180.0)
            body = fin[bare]
            if im.size == 0 or body.size == 0:
                continue
            # canvas big enough for the body and the rotated weapon wherever the grip puts it
            gx, gy = at['grip']
            L = max(0, g[0] - gx) + 2
            T = max(0, g[1] - gy) + 2
            R = max(0, (im.shape[1] - g[0]) - (body.shape[1] - gx)) + 2
            B = max(0, (im.shape[0] - g[1]) - (body.shape[0] - gy)) + 2
            c = np.zeros((body.shape[0] + T + B, body.shape[1] + L + R, 4), np.uint8)
            paste(c, body, L, T)
            paste(c, im, L + gx - g[0], T + gy - g[1])
            row_t.append(c)
        if row_t:
            tiles.append(row_t)
    if not tiles:
        return
    cw = max(t.shape[1] for r in tiles for t in r) + 4
    ch = max(t.shape[0] for r in tiles for t in r) + 4
    out = Image.new('RGBA', (cw * max(len(r) for r in tiles), ch * len(tiles)), (92, 92, 104, 255))
    for j, r in enumerate(tiles):
        for i, t in enumerate(r):
            out.alpha_composite(Image.fromarray(t), (i * cw + (cw - t.shape[1]) // 2, j * ch + (ch - t.shape[0]) // 2))
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
