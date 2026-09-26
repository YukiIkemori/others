#!/usr/bin/env python3
"""Brief sheets (ARUN_REQUEST.md, シート1〜9) -> checked native sprites -> game sheets.

  python3 tools/sheets.py <folder of sheet PNGs> [--char arun] [--out out/arun] [--check] [--refs configs/refs/arun]

Stages
  1. find      sheet<N>*.png / シート<N>*.png / s<N>.png  (newest file wins when a sheet has several takes)
  2. key       flat magenta #FF00FF (tolerant to off-magenta, colour noise, dark-magenta floor shadows,
               pink anti-aliased fringes); any other background -> border flood fallback + a 'redo' message
  3. slice     connected parts -> rows (1-D k-means on centres) -> columns (x-overlap groups) -> the
               brief's slots (order-preserving assignment, so a missing pose leaves its slot empty)
  4. grid      the art-pixel size is measured per sheet (edge spectrum of all poses); kept when the sheet's
               upright poses land within 10 % of the target height (48 field / 64 battle / ~80 face),
               otherwise the sheet is resampled to the target; per-pose cut lines snap to the drawn edges
  5. sample    one colour per art pixel (trimmed Lab mean; dark lines win), pink fringe excluded
  6. check     counts, facing, heights, ground lines, extras (text / shadows / effects), clipping,
               background, colour drift vs the reference palette, breathing A/B difference, face overlays
  7. pack      (skipped with --check) shared palette (~50 colours, faces separate), cleanup, anchors,
               registration, weapon attach points, sheets + JSON           -> tools/pack.py

Writes  <out>/report.txt  (Japanese, grouped: 作り直しを頼む / 目で確かめる / 自動で直した)
        <out>/report.json
        <out>/review/sheet<N>.png   source slot | native ×4, frame colour = status, per sheet
        <out>/native/<id>.png  and, unless --check, everything pack.py writes
"""
import argparse
import glob
import json
import os
import re
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixlib as P  # noqa: E402
from brief_spec import SHEETS, ORDER, slot_name  # noqa: E402
from facing import Facing  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(HERE, '..', 'art_proto', 'fonts', 'ZenMaruGothic-Medium.ttf')
LEVELS = ('redo', 'check', 'auto', 'info')
LEVEL_JA = {'redo': '作り直しを頼む', 'check': '目で確かめる', 'auto': '自動で直した', 'info': 'メモ'}


# ============================================================ report
class Report:
    def __init__(self):
        self.items = []

    def add(self, sheet, level, code, msg, slot=None, ask=None, **data):
        self.items.append(dict(sheet=sheet, level=level, code=code, msg=msg, slot=slot, ask=ask, data=data))

    def level_of(self, sheet, slot):
        lv = [i['level'] for i in self.items if i['sheet'] == sheet and i['slot'] == slot]
        for L in LEVELS:
            if L in lv:
                return L
        return 'ok'

    def text(self, found):
        out = ['スプライトの検査結果（%s）' % time.strftime('%Y-%m-%d %H:%M'), '']
        for L in LEVELS:
            its = [i for i in self.items if i['level'] == L and not i['data'].get('hidden')]
            if not its:
                continue
            out.append('■ %s（%d 件）' % (LEVEL_JA[L], len(its)))
            for n in ORDER + [None]:
                for i in its:
                    if i['sheet'] == n and not i['data'].get('hidden'):
                        out.append('  - ' + ('シート%d: ' % n if n else '') + i['msg'])
            out.append('')
        asks = [i['ask'] for i in self.items if i['level'] == 'redo' and i['ask']]
        if asks:
            out.append('■ 画像 AI にそのまま送れる文')
            seen = set()
            for a in asks:
                if a not in seen:
                    out.append('  「%s」' % a)
                    seen.add(a)
            out.append('')
        out.append('■ シートの状態')
        for n in ORDER:
            s = SHEETS[n]
            st = found.get(n)
            if not st:
                out.append('  シート%d %s: %s' % (n, s['title'], 'なし（必須）' if s['required'] else 'なし（任意）'))
                continue
            lv = [i['level'] for i in self.items if i['sheet'] == n]
            tag = '要作り直し' if 'redo' in lv else '確認あり' if 'check' in lv else 'OK'
            out.append('  シート%d %s: %s  %s  ドット %.2fpx → %s' % (n, s['title'], tag, os.path.basename(st['file']),
                                                              st.get('period', 0), st.get('scale_note', '')))
        return '\n'.join(out) + '\n'


# ============================================================ find
PAT = re.compile(r'(?:sheet|シート|s)[ _-]?0?([1-9])(?![0-9])', re.I)


def find_sheets(folder, rep):
    files = [p for p in glob.glob(os.path.join(folder, '*')) if p.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
    by = {}
    for p in files:
        m = PAT.search(os.path.splitext(os.path.basename(p))[0])
        if not m:
            rep.add(None, 'info', 'unknown_file', '%s はシート番号が読めないので使わない（名前に sheet1〜sheet9 を入れる）' % os.path.basename(p))
            continue
        by.setdefault(int(m.group(1)), []).append(p)
    out = {}
    for n, ps in by.items():
        ps.sort(key=os.path.getmtime)
        if len(ps) > 1:
            rep.add(n, 'info', 'takes', '%d 枚あるので一番新しい %s を使う' % (len(ps), os.path.basename(ps[-1])))
        out[n] = ps[-1]
    for n in ORDER:
        if n not in out:
            s = SHEETS[n]
            rep.add(n, 'redo' if s['required'] else 'info', 'missing_sheet',
                    'シート%d（%s）がない' % (n, s['title']) + ('' if s['required'] else '（任意なので無くてもよい）'),
                    ask=('シート%d（%s）を作って' % (n, s['title'])) if s['required'] else None)
    return out


# ============================================================ manifest (the generator's own layout, when delivered)
def load_manifest(folder):
    """manifest.json next to the sheets: [{sheet, file, layout 'RxC', logical_cell [w, h], image_px [W, H], frames}]
    -> {basename: entry}. Missing / unreadable -> {}."""
    p = os.path.join(folder, 'manifest.json')
    try:
        js = json.load(open(p))
    except Exception:
        return {}
    if isinstance(js, dict):
        js = js.get('sheets', [])
    out = {}
    for e in js:
        try:
            r, c = [int(x) for x in str(e['layout']).lower().split('x')]
            out[os.path.basename(e['file'])] = dict(e, rows=r, cols=c)
        except Exception:
            continue
    return out


def slice_manifest(fg, n, spec, ent, rep):
    """Cells from the manifest: cell (r, c) = [c*cw, (c+1)*cw) x [r*ch, (r+1)*ch) in image px, cw = logical_cell * dot.
    Every connected part goes to the cell holding its centre. -> (slots, extras, dot) or None when the manifest does
    not fit the sheet (layout differs from the brief, or the image size does not match)."""
    H, W = fg.shape
    if (ent['rows'], ent['cols']) != (spec['rows'], spec['cols']):
        rep.add(n, 'check', 'manifest_layout', 'manifest の並べ方（%s）が指示書（%d×%d）と違う。自動の切り分けを使う' % (ent['layout'], spec['rows'], spec['cols']))
        return None
    lw, lh = ent['logical_cell']
    dot = W / float(ent['cols'] * lw)
    if abs(H / float(ent['rows'] * lh) - dot) > 0.05 or (ent.get('image_px') and list(ent['image_px']) != [W, H]):
        rep.add(n, 'check', 'manifest_size', 'manifest の大きさ（%s）が画像（%d×%d）と合わない。自動の切り分けを使う' % (ent.get('image_px'), W, H))
        return None
    cw, ch = lw * dot, lh * dot
    lab, k = nd.label(fg, structure=np.ones((3, 3)))
    if k == 0:
        return {}, [], dot
    objs = nd.find_objects(lab)
    areas = nd.sum(fg, lab, range(1, k + 1))
    slots, parts = {}, {}
    for i, sl in enumerate(objs):
        if areas[i] < (0.75 * dot) ** 2:        # below one art pixel: noise
            continue
        cy, cx = (sl[0].start + sl[0].stop) / 2.0, (sl[1].start + sl[1].stop) / 2.0
        r, c = min(ent['rows'] - 1, int(cy // ch)), min(ent['cols'] - 1, int(cx // cw))
        parts.setdefault((r, c), []).append(i)
    extras = []
    for (r, c), idx in parts.items():
        main = max(idx, key=lambda i: areas[i])
        m = np.zeros_like(fg)
        mm = lab[objs[main]] == main + 1
        m[objs[main]] |= mm
        body = m.copy()
        dist = nd.distance_transform_edt(~body)
        for i in idx:
            if i == main:
                continue
            sl = objs[i]
            sub = lab[sl] == i + 1
            near = dist[sl][sub].min()
            # far & small = text / sparkle / stray mark; near = part of the pose (tuft, sword tip, marks: see drop_marks)
            if near > 12 * dot and areas[i] < 0.08 * areas[main]:
                extras.append(dict(box=[sl[1].start, sl[0].start, sl[1].stop, sl[0].stop], area=int(areas[i])))
                continue
            m[sl] |= sub
        slots[(r, c)] = m
    return slots, extras, dot


def drop_marks(mask, dot, top_frac=0.45, max_frac=0.03):
    """Emote marks baked into a pose (surprise lines, sweat drops, '!' strokes): small parts NOT touching the body,
    in the upper part of the pose (around the head). -> (mask, n_removed, removed_px)"""
    lab, k = nd.label(mask, structure=np.ones((3, 3)))
    if k <= 1:
        return mask, 0, 0
    sizes = nd.sum(mask, lab, range(1, k + 1))
    big = int(np.argmax(sizes)) + 1
    ys = np.where(mask.any(1))[0]
    t, b = ys.min(), ys.max()
    lim = t + top_frac * (b - t + 1)
    out, n, px = mask.copy(), 0, 0
    for i, sl in enumerate(nd.find_objects(lab), 1):
        if i == big or sizes[i - 1] > max_frac * sizes[big - 1]:
            continue
        if (sl[0].start + sl[0].stop) / 2.0 <= lim:
            out[sl] &= lab[sl] != i
            n += 1
            px += int(sizes[i - 1])
    return out, n, px


# ============================================================ key
def load_rgb(path):
    im = Image.open(path)
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        a = np.asarray(im)
        rgb = a[..., :3].copy()
        rgb[a[..., 3] < 128] = (255, 0, 255)
        return rgb
    return np.asarray(im.convert('RGB')).copy()


def magenta_like(rgb):
    a = rgb.astype(np.int16)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    ex = np.minimum(R, B) - G
    return ex, np.abs(R - B)


def key_sheet(rgb, n, rep):
    ex, rb = magenta_like(rgb)
    mag = (ex > 60) & (rb < 90)
    bw = 6
    border = np.concatenate([mag[:bw].ravel(), mag[-bw:].ravel(), mag[:, :bw].ravel(), mag[:, -bw:].ravel()])
    info = dict(border_magenta=float(border.mean()))
    if border.mean() < 0.6:
        rep.add(n, 'redo', 'bg_not_magenta', '背景がマゼンタ単色になっていない（縁の %.0f%% だけマゼンタ）。紙の色で抜いたが、縁が汚れやすい' % (100 * border.mean()),
                ask='シート%dの背景をマゼンタ #FF00FF の単色にして、影・模様・文字・枠を消して、同じ条件で描き直して' % n)
        fg, _ = P.key_out(rgb, tol=16.0)
        return fg, fg.copy(), info
    bpx = np.concatenate([rgb[:bw].reshape(-1, 3), rgb[-bw:].reshape(-1, 3), rgb[:, :bw].reshape(-1, 3), rgb[:, -bw:].reshape(-1, 3)])
    bmask = np.concatenate([mag[:bw].ravel(), mag[-bw:].ravel(), mag[:, :bw].ravel(), mag[:, -bw:].ravel()])
    bcol = np.median(bpx[bmask], 0)
    sd = float(bpx[bmask].astype(float).std(0).mean())
    info.update(bg=[int(v) for v in bcol], bg_std=round(sd, 1))
    if np.abs(bcol - np.array([255, 0, 255])).max() > 30:
        rep.add(n, 'info', 'bg_off', '背景の色が #FF00FF から少しずれている（%s）。自動で抜いた' % ('#%02x%02x%02x' % tuple(int(v) for v in bcol)))
    if sd > 10:
        rep.add(n, 'auto', 'bg_noise', '背景に色むら・ノイズがある（ばらつき %.0f）。自動で抜いた' % sd)
    near = np.linalg.norm(rgb.astype(np.float64) - bcol, axis=-1) < 60
    bg = mag | near
    fg = nd.binary_opening(~bg, structure=np.ones((2, 2)))
    # colour mask: drop pink fringe pixels next to the key
    fringe = nd.binary_dilation(bg, iterations=1) & (ex > 22)
    cmask = fg & ~fringe
    # dark magenta = drawn floor shadow / glow on the key colour
    dark = mag & (np.maximum(rgb[..., 0], rgb[..., 2]) < 200) & ~nd.binary_dilation(fg, iterations=3)
    info['dark_magenta_px'] = int(dark.sum())
    if dark.sum() > 0.002 * dark.size:
        rep.add(n, 'auto', 'dark_key', '暗いマゼンタ（床の影・光のにじみ）があった。背景として抜いた')
    return fg, cmask, info


# ============================================================ slice
def kmeans1d(v, w, k, iters=30):
    c = np.quantile(v, np.linspace(0.5 / k, 1 - 0.5 / k, k)) if len(v) >= k else np.linspace(v.min(), v.max(), k)
    for _ in range(iters):
        a = np.abs(v[:, None] - c[None]).argmin(1)
        c = np.array([np.average(v[a == j], weights=w[a == j]) if (a == j).any() else c[j] for j in range(k)])
    return np.abs(v[:, None] - c[None]).argmin(1), c


def assign_ordered(centres, slots):
    """Order-preserving assignment of sorted group centres to sorted slot centres (DP, min |d|).
    Returns slot index per group (or -1 for a group left over)."""
    g, s = len(centres), len(slots)
    INF = 1e18
    # dp[i][j] = best cost using the first i groups and the first j slots
    dp = np.full((g + 1, s + 1), INF)
    dp[0, :] = 0
    choice = {}
    skip_cost = 1e6   # dropping a group is expensive: only when there are more groups than slots
    for i in range(1, g + 1):
        for j in range(0, s + 1):
            best, how = dp[i - 1, j] + skip_cost, ('skip',)
            if j > 0:
                v = dp[i - 1, j - 1] + abs(centres[i - 1] - slots[j - 1])
                if v < best:
                    best, how = v, ('take',)
                v = dp[i, j - 1]            # leave slot j empty
                if v < best:
                    best, how = v, ('empty',)
            dp[i, j] = best
            choice[(i, j)] = how
    out = [-1] * g
    i, j = g, s
    while i > 0:
        how = choice[(i, j)][0]
        if how == 'take':
            out[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif how == 'skip':
            i -= 1
        else:
            j -= 1
    return out


def slice_sheet(fg, n, spec, p_guess, rep):
    """-> {(r, c): mask}, extras (list of dropped parts), row_ranges"""
    rows, cols = spec['rows'], spec['cols']
    H, W = fg.shape
    join = max(3, int(round(p_guess * 1.5)))
    lab, k = nd.label(nd.binary_dilation(fg, iterations=join))
    if k == 0:
        return {}, [], []
    lab = lab * fg
    areas = nd.sum(fg, lab, range(1, k + 1))
    objs = nd.find_objects(lab)
    top = np.sort(areas)[::-1][:rows * cols]
    ref = np.median(top) if len(top) else areas.max()
    # a row of small things (sheet 7: weapons) needs a lower bar for 'a pose of its own'
    bar = 0.015 if any(rk == 'weapon_row' for rk in spec['row_kind']) else 0.12
    main = [i for i in range(k) if areas[i] >= bar * ref]
    small = [i for i in range(k) if areas[i] < bar * ref and areas[i] > 0]
    # centres of main parts
    cy = np.array([(objs[i][0].start + objs[i][0].stop) / 2 for i in main])
    cx = np.array([(objs[i][1].start + objs[i][1].stop) / 2 for i in main])
    wts = np.array([areas[i] for i in main], float)
    # small parts: glue to the nearest main part when close (hair tuft, sword tip), else extra
    extras = []
    glue = {}
    if small:
        mm =np.zeros_like(lab)
        for idx, i in enumerate(main):
            mm[lab == i + 1] = idx + 1
        d, (iy, ix) = nd.distance_transform_edt(mm == 0, return_indices=True)
        for i in small:
            sl = objs[i]
            sub = lab[sl] == i + 1
            dd = d[sl][sub]
            j = int(dd.argmin())
            near = mm[iy[sl][sub][j], ix[sl][sub][j]] - 1
            if dd.min() <= 4 * p_guess:
                glue.setdefault(near, []).append(i)
            else:
                extras.append(dict(box=[sl[1].start, sl[0].start, sl[1].stop, sl[0].stop], area=int(areas[i])))
    # rows
    if rows > 1:
        ra, rc = kmeans1d(cy, wts, rows)
        order = np.argsort(rc)
        rank = np.empty(rows, int)
        rank[order] = np.arange(rows)
        ra = rank[ra]
        rc = rc[order]
        pitch = np.diff(rc)
        if len(pitch) and (pitch.min() < 0.45 * np.median(pitch) or (len(pitch) == 1 and pitch[0] < 0.2 * H)):
            rep.add(n, 'check', 'rows', '行の数が %d 行に見えない（行どうしが近すぎる）。並べ方を確かめる' % rows)
    else:
        ra = np.zeros(len(main), int)
    # columns: per row, merge parts that overlap in x (a pose split into pieces) into groups
    groups = {}
    for r in range(rows):
        idx = [t for t in range(len(main)) if ra[t] == r]
        idx.sort(key=lambda t: objs[main[t]][1].start)
        gs = []
        for t in idx:
            x0, x1 = objs[main[t]][1].start, objs[main[t]][1].stop
            if gs and x0 < gs[-1]['x1'] - 0.25 * (x1 - x0):
                gs[-1]['parts'].append(t)
                gs[-1]['x1'] = max(gs[-1]['x1'], x1)
            else:
                gs.append(dict(parts=[t], x0=x0, x1=x1))
        for g in gs:
            m = np.zeros_like(fg)
            for t in g['parts']:
                for i in [main[t]] + glue.get(t, []):
                    sl = objs[i]
                    m[sl] |= lab[sl] == i + 1
            ys, xs = np.where(m)
            g['mask'] = m
            g['cx'] = float(np.average(xs))
            g['area'] = int(m.sum())
        groups[r] = gs
    # expected column centres: rows that have exactly `cols` groups vote; otherwise equal spacing
    full = [np.array([g['cx'] for g in groups[r]]) for r in groups if len(groups[r]) == cols]
    if full:
        slots = np.median(np.stack(full), 0)
    else:
        allx = np.where(fg.any(0))[0]
        x0, x1 = (allx.min(), allx.max()) if len(allx) else (0, W)
        slots = x0 + (np.arange(cols) + 0.5) * (x1 - x0) / cols
    out = {}
    for r in range(rows):
        gs = groups.get(r, [])
        a = assign_ordered([g['cx'] for g in gs], list(slots))
        for g, c in zip(gs, a):
            if c < 0:
                extras.append(dict(box=list(map(int, P.bbox(g['mask'])[2:] + P.bbox(g['mask'])[:2])), area=g['area'], extra_pose=True))
                rep.add(n, 'check', 'extra_pose', '%d 行目にポーズが多い（%d 個）。余りは使わない' % (r + 1, len(gs)))
                continue
            out[(r, c)] = g['mask']
    return out, extras, groups


# ============================================================ grid + sample
def sample_cells(rgb, cov, col, xs, ys, alpha_min=0.5, dark_L=20.0, dark_frac=0.42, trim=0.25):
    Hc, Wc = len(ys) - 1, len(xs) - 1
    out = np.zeros((Hc, Wc, 4), np.uint8)
    lab = P.srgb_to_lab(rgb)
    blur = np.zeros((Hc, Wc))
    for j in range(Hc):
        y0, y1 = ys[j], ys[j + 1]
        for i in range(Wc):
            x0, x1 = xs[i], xs[i + 1]
            m = cov[y0:y1, x0:x1]
            if m.mean() < alpha_min:
                continue
            mc = col[y0:y1, x0:x1] & m
            if mc.sum() == 0:
                mc = m
            px = rgb[y0:y1, x0:x1][mc].astype(np.float64)
            pl = lab[y0:y1, x0:x1][mc]
            dark = pl[:, 0] < dark_L
            if dark.mean() >= dark_frac and not dark.all():
                sel = dark
            else:
                med = np.median(pl, 0)
                d = ((pl - med) ** 2).sum(1)
                k = max(1, int(round(len(pl) * (1 - trim))))
                sel = np.argsort(d)[:k]
            out[j, i, :3] = np.clip(np.mean(px[sel], 0), 0, 255)
            out[j, i, 3] = 255
            # spread inside the cell (drawn-pixel crispness): mean dE of the kept pixels
            blur[j, i] = float(np.sqrt(((pl[sel] - pl[sel].mean(0)) ** 2).sum(1)).mean()) if len(pl) > 1 else 0
    return out, blur


def sheet_period(slots, rgb, lo, hi):
    profs = []
    for m in slots.values():
        b = P.bbox(m)
        y0, y1, x0, x1 = b
        profs.extend(P.edge_profiles(rgb[y0:y1, x0:x1], m[y0:y1, x0:x1]))
    ps = np.arange(lo, hi, 0.01)
    pw = np.zeros(len(ps))
    for g in profs:
        g = g - g.mean()
        nn = np.arange(len(g))
        Z = np.exp(2j * np.pi * nn[None, :] / ps[:, None]) @ g
        pw += np.abs(Z) ** 2 / max(1, len(g))
    k = pw.argmax()
    p0 = ps[k]
    sel = (ps >= p0 * 0.9) & (ps <= p0 * 1.1)
    w = pw[sel] ** 2
    p = float((ps[sel] * w).sum() / w.sum())
    clarity = float(pw[k] / (np.median(pw) + 1e-9))
    return p, clarity


# ============================================================ one sheet
def process_sheet(n, path, rep, args):
    spec = SHEETS[n]
    rgb = load_rgb(path)
    H, W = rgb.shape[:2]
    st = dict(file=path, size=[W, H])
    if path.lower().endswith(('.jpg', '.jpeg')):
        rep.add(n, 'check', 'jpeg', 'JPG で保存されている。色のにじみが出るので、できれば PNG で出し直す')
    fg, cmask, kinfo = key_sheet(rgb, n, rep)
    st['key'] = kinfo
    # first guess of the art pixel: the brief's 8 px, corrected by the sheet size
    tall = fg.any(1).sum()
    p_guess = max(2.0, min(10.0, tall / (spec['rows'] * spec['target_h'] * 1.35)))
    ms = None
    ent = (args.manifest or {}).get(os.path.basename(path))
    if ent:
        ms = slice_manifest(fg, n, spec, ent, rep)
    if ms is not None:
        slots, extras, p_guess = ms
        st['manifest'] = dict(layout=ent['layout'], logical_cell=ent['logical_cell'], dot=round(p_guess, 3))
    else:
        slots, extras, _ = slice_sheet(fg, n, spec, p_guess, rep)
    for e in extras:
        if e.get('extra_pose'):
            continue
        if e['area'] > (2 * p_guess) ** 2:
            rep.add(n, 'auto', 'extra', '余計な物（文字・影・エフェクトなど、%d×%d px）を消した' % (e['box'][2] - e['box'][0], e['box'][3] - e['box'][1]),
                    box=e['box'])
    st['extras'] = extras
    # missing / clipped poses
    for r in range(spec['rows']):
        for c in range(spec['cols']):
            sid = spec['ids'][r][c]
            if (r, c) not in slots:
                rep.add(n, 'redo', 'missing', '%s が見つからない' % slot_name(n, r, c), slot=sid,
                        ask='シート%dの%d番（%s）が無い。%d行×%d列の並べ方で、全部のポーズを同じ条件で描き直して' % (
                            n, r * spec['cols'] + c + 1, spec['ja'][r][c], spec['rows'], spec['cols']))
                continue
            b = P.bbox(slots[(r, c)])
            if b[0] <= 1 or b[2] <= 1 or b[1] >= H - 1 or b[3] >= W - 1:
                rep.add(n, 'redo', 'clipped', '%s が画像の端で切れている' % slot_name(n, r, c), slot=sid,
                        ask='シート%dの%d番（%s）が画像の端で切れている。全部が画像に入るよう並べ直して、同じ条件で描き直して' % (
                            n, r * spec['cols'] + c + 1, spec['ja'][r][c]))
    # touching poses (slot masks of one row closer than 10 art px)
    for r in range(spec['rows']):
        cs = sorted(c for (rr, c) in slots if rr == r)
        for a, b_ in zip(cs, cs[1:]):
            ba, bb = P.bbox(slots[(r, a)]), P.bbox(slots[(r, b_)])
            gap = bb[2] - ba[3]
            if gap < 3 * p_guess:
                rep.add(n, 'check', 'touching', '%s と %s の間が狭い（%d px）。切り分けを確かめる' % (
                    slot_name(n, r, a), slot_name(n, r, b_), gap))
    if not slots:
        return st, {}
    # ---- floor shadows (neutral grey under the feet): removed per slot
    ex, _ = magenta_like(rgb)
    # ---- art pixel size
    upright = {k: m for k, m in slots.items() if spec['ids'][k[0]][k[1]] in spec['stand'] and spec['row_kind'][k[0]] is None}
    if not upright:
        upright = {k: m for k, m in slots.items() if spec['row_kind'][k[0]] is None} or slots
    hs = [P.bbox(m)[1] - P.bbox(m)[0] for m in upright.values()]
    h_src = float(np.median(hs))
    p_exp = h_src / spec['target_h']
    if ms is not None:     # the manifest states the dot: image px / (cols * logical cell)
        p, clarity = float(p_guess), 99.0
    else:
        p, clarity = sheet_period(slots, rgb, max(1.5, p_exp * 0.55), p_exp * 1.8)
    nat_h = h_src / p
    st.update(period=round(p, 3), clarity=round(clarity, 1), src_height=h_src, native_height_at_period=round(nat_h, 1))
    tol = args.size_tol
    if abs(nat_h - spec['target_h']) / spec['target_h'] <= tol and clarity >= 3:
        cell = p
        st['scale_note'] = '描かれた格子のまま（%.1f ドット）' % nat_h
    else:
        cell = h_src / spec['target_h']
        st['scale_note'] = '%d ドットに合わせて作り直し（描かれた格子では %.1f ドット）' % (spec['target_h'], nat_h)
        if clarity < 3:
            rep.add(n, 'check', 'grid_unclear', 'ドットの格子がはっきりしない（ぼかし・アンチエイリアス）。%d ドットの格子で取り直した。細部がつぶれていないか見る' % spec['target_h'])
        else:
            rep.add(n, 'auto', 'size', '身長が %.1f ドットで、指定の %d ドットと違う。%d ドットに合わせた（少しぼやける）' % (nat_h, spec['target_h'], spec['target_h']))
    if abs(p - 8) > 1.0:
        rep.add(n, 'info', 'dot_size', '1 ドットが画像上 %.2f px（指定は 8 px）' % p)
    st['cell'] = round(cell, 3)
    # ---- ground line per row (source px), for baselines
    ground = {}
    for r in range(spec['rows']):
        bots = [P.bbox(m)[1] for (rr, c), m in slots.items() if rr == r and spec['ids'][r][c] not in spec['air']]
        if bots:
            ground[r] = float(np.median(bots))
            spread = (max(bots) - min(bots)) / cell
            if spread > 2.5 and spec['row_kind'][r] is None:
                rep.add(n, 'auto', 'ground', '%d 行目の足元の高さが最大 %.0f ドットずれている。足元で揃えた' % (r + 1, spread))
    # ---- per slot: crop, grid, sample
    sprites = {}
    for (r, c), m in sorted(slots.items()):
        sid = spec['ids'][r][c]
        y0, y1, x0, x1 = P.bbox(m)
        pad = int(np.ceil(cell * 2))
        y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
        y1, x1 = min(H, y1 + pad), min(W, x1 + pad)
        crgb = rgb[y0:y1, x0:x1]
        mm = m[y0:y1, x0:x1].copy()
        cm = cmask[y0:y1, x0:x1] & mm
        if spec['row_kind'][r] is None and spec['kind'] != 'face':
            before = mm.sum()
            mm = P.remove_floor_shadow(crgb, mm, band=0.08, chroma_max=7.0, L_min=35.0)
            if before - mm.sum() > (2 * cell) ** 2:
                rep.add(n, 'auto', 'shadow', '%s の足元の影を消した' % slot_name(n, r, c), slot=sid)
            if spec['kind'] == 'battle':
                b0 = mm.sum()
                mm = drop_effects(crgb, mm)
                if b0 - mm.sum() > (3 * cell) ** 2:
                    rep.add(n, 'auto', 'effect', '%s の光・軌跡らしい物を消した。消えすぎていないか見る' % slot_name(n, r, c), slot=sid)
        if spec['kind'] == 'field' or n == 8:
            mm, nmk, pxk = drop_marks(mm, cell)
            if nmk:
                rep.add(n, 'auto', 'marks', '%s の感情マーク（驚きの線・汗など %d 個）を消した' % (slot_name(n, r, c), nmk), slot=sid)
        mm = P.largest_components(mm, min_frac=0.01, max_n=8)
        xs, ys, _ = P.fit_grid(crgb, mm, p_hint=cell)
        nat, blur = sample_cells(crgb, mm, cm, xs, ys)
        a = nat[..., 3] > 0
        if not a.any():
            continue
        bb = P.bbox(a)
        nat = nat[bb[0]:bb[1], bb[2]:bb[3]]
        bot_src = P.bbox(m)[1]
        air = 0
        if r in ground:
            air = int(round((ground[r] - bot_src) / cell))    # >0: floats above the ground line
            if sid not in spec['air']:
                air = 0
            air = max(0, min(air, 12))
        sprites[sid] = dict(img=nat, row=r, col=c, box=[int(x0), int(y0), int(x1), int(y1)], air=air,
                            blur=float(np.median(blur[a])), src_h=int(P.bbox(m)[1] - P.bbox(m)[0]))
    st['sprites'] = {k: dict(size=[int(v['img'].shape[1]), int(v['img'].shape[0])], box=v['box'], air=v['air'],
                             blur=round(v['blur'], 1)) for k, v in sprites.items()}
    return st, sprites


def drop_effects(rgb, fg, min_L=78.0, max_chroma=14.0):
    lab = P.srgb_to_lab(rgb)
    light = (lab[..., 0] > min_L) & (np.hypot(lab[..., 1], lab[..., 2]) < max_chroma)
    lid, k = nd.label(fg, structure=np.ones((3, 3)))
    for i in range(1, k + 1):
        s = lid == i
        if light[s].mean() > 0.55 and s.sum() > 40:
            fg = fg & ~s
    return fg


# ============================================================ checks across the run
def check_heights(n, spec, sprites, rep):
    hs = {k: v['img'].shape[0] for k, v in sprites.items() if k in spec['stand']}
    if len(hs) < 2:
        return
    med = float(np.median(list(hs.values())))
    for k, h in hs.items():
        if abs(h - med) > max(2.5, 0.06 * med):
            r, c = sprites[k]['row'], sprites[k]['col']
            lvl = 'check' if abs(h - med) <= 0.15 * med else 'redo'
            rep.add(n, lvl, 'height', '%s の身長が %d ドット（ほかは %.0f）' % (slot_name(n, r, c), h, med), slot=k,
                    ask='シート%dの%d番（%s）だけ大きさが違う。ほかのポーズと同じ身長にして、同じ条件で描き直して' % (
                        n, r * spec['cols'] + c + 1, spec['ja'][r][c]) if lvl == 'redo' else None)


SCALE_REFS = {'btl': ['idle_a', 'step', 'bare_idle', 'thrust_ready'], 'fld': ['walk_down_0', 'walk_left_0', 'walk_right_0', 'run_down_0']}
SCALE_SKIP = {'ko', 'act_lie', 'sleep_lie'}      # lying: the head is turned 90 degrees, the match is not reliable


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


def check_scale(runs, rep, tol_redo=0.2, tol_check=0.15, fix=True):
    """Drawn scale of each pose (head size vs the reference poses, tools/bodyscale.py). The bounding box misses a pose
    drawn smaller with a raised sword (the sword keeps the box at the target height). Poses off by more than ~18 %
    are rescaled as a fallback (Scale2x + majority sampling) and a redraw is asked for."""
    from bodyscale import head_crop, scale_of
    from facing import group_of
    allsp = {sid: (n, v) for n, sp in runs.items() for sid, v in sp.items()}
    for g in ('btl', 'fld'):
        refs = [(r, head_crop(allsp[r][1]['img'])) for r in SCALE_REFS[g] if r in allsp]
        if len(refs) < 2:
            continue
        for n, sp in runs.items():
            if group_of(n) != g:
                continue
            spec = SHEETS[n]
            for sid, v in sp.items():
                if sid.startswith('wpn_') or sid in SCALE_SKIP or sid in spec.get('no_scale', []):
                    continue
                rr = [h for r, h in refs if r != sid]
                sc, per = scale_of(v['img'], rr)
                v['scale'] = round(sc, 3)
                name = slot_name(n, v['row'], v['col'])
                num = v['row'] * spec['cols'] + v['col'] + 1
                pct = int(round(100 * sc))
                if abs(np.log(sc)) > np.log(1 + tol_redo):
                    big = sc > 1
                    k = 1.0 / sc
                    if fix:
                        v['img'] = rescale_pixel(v['img'], k)
                        v['fixed'] = v.get('fixed', []) + ['rescaled %.2f' % k]
                    rep.add(n, 'redo', 'scale', '%s がほかのポーズより%s描かれている（頭の大きさで約 %d%%）。仮に %d%% に拡大縮小して使う' % (
                        name, '大きく' if big else '小さく', pct, int(round(100 * k))), slot=sid, scale=sc, per_ref=per,
                        ask='シート%dの%d番（%s）だけ%s描かれている（ほかの約 %d%%）。ほかのポーズと同じ縮尺（頭の大きさをそろえる）にして、同じ条件で描き直して' % (
                            n, num, spec['ja'][v['row']][v['col']], '大きく' if big else '小さく', pct))
                elif abs(np.log(sc)) > np.log(1 + tol_check):
                    rep.add(n, 'check', 'scale_small', '%s の縮尺が少し違う（頭の大きさで約 %d%%）。並べて見て気になるなら描き直し' % (name, pct), slot=sid, scale=sc, per_ref=per)


def check_facing(runs, fc, rep):
    """Facing by several cues (tools/facing.py): head and upper-body likeness to known-facing references
    (mirror test), the side the scarf tail streams to, and — for front / back rows — a down-vs-up projection of
    the mirror-symmetric head. References: configs/refs/<char>/ (leave-one-out by id), plus, for a class the
    library lacks, the run's own sprites of that class (majority)."""
    from facing import Feat, mirror_score, group_of

    def clip(v, a):
        return max(-a, min(a, v))

    feats, members = {}, {}
    for n, sp in runs.items():
        spec, g = SHEETS[n], group_of(n)
        for sid, v in sp.items():
            d = spec['face'][v['row']]
            if d is None or sid in spec['no_facing']:
                continue
            key = 'face_' + d if spec['kind'] == 'face' else d
            feats[(n, sid)] = Feat(v['img'], g)
            members.setdefault((g, key), []).append((n, sid))

    def refs(g, key, n, sid):
        lib = fc.refs(g, key, sid)
        if lib:
            return lib
        out = [feats[m] for m in members.get((g, key), []) if m != (n, sid)]
        if key in ('left', 'right', 'face_left', 'face_right'):
            opp = {'left': 'right', 'right': 'left', 'face_left': 'face_right', 'face_right': 'face_left'}[key]
            for m in members.get((g, opp), []):     # a mirrored member of the opposite class also shows the way
                f = feats[m]
                out.append(type(f).__new__(type(f)))
                out[-1].h, out[-1].u = f.hm, f.um
        return out

    ja = {'down': '下（手前）', 'up': '上（奥）', 'left': '左', 'right': '右'}
    for (g, key), lst in members.items():
        for (n, sid) in lst:
            spec, v, f = SHEETS[n], runs[n][sid], feats[(n, sid)]
            num = v['row'] * spec['cols'] + v['col'] + 1
            name = slot_name(n, v['row'], v['col'])
            rs = refs(g, key, n, sid)
            if key in ('left', 'right', 'face_left', 'face_right'):
                want = key.replace('face_', '')
                th = mirror_score(f.h, f.hm, [r.h for r in rs]) if rs else None
                tu = mirror_score(f.u, f.um, [r.u for r in rs]) if rs else None
                cues = {}
                if th is not None:
                    cues['head'] = clip(th / (1.0 if g != 'face' else 2.0), 1.5) * (0.6 if g == 'btl' else 1.0)
                if tu is not None:
                    cues['upper'] = clip(tu / 2.5, 2.0)
                if f.scarf is not None and g != 'face':
                    # the scarf tail streams behind: to the right when facing left
                    cues['scarf'] = clip((f.scarf if want == 'left' else -f.scarf) / 0.25, 2.0)
                z = float(sum(cues.values()))
                neg = sum(1 for c in cues.values() if c < -0.2)
                v['facing_score'] = round(z, 2)
                v['facing_cues'] = {k: round(c, 2) for k, c in cues.items()}
                other = {'left': '右', 'right': '左'}[want]
                if z < -1.2 and neg >= 2:
                    rep.add(n, 'redo', 'facing', '%s が%sを向いている（%s向きのはず。点数 %.1f）' % (name, other, '左' if want == 'left' else '右', z),
                            slot=sid, score=z, cues=v['facing_cues'],
                            ask='シート%dの%d番（%s）が%sを向いている。%sにして、同じ条件で描き直して' % (
                                n, num, spec['ja'][v['row']][v['col']], other,
                                '全部左向き' if spec['kind'] == 'battle' else ('少し右向き' if spec['kind'] == 'face' else ja[want] + '向き')))
                elif z < -0.5:
                    rep.add(n, 'check', 'facing_unsure', '%s の向きがはっきりしない（点数 %.1f）' % (name, z), slot=sid, cues=v['facing_cues'])
            else:
                # front / back: project the mirror-symmetric head on the down-up axis of the references
                D = [((r.h + r.hm) / 2).ravel() for r in refs(g, 'down', n, sid) if getattr(r, 'hm', None) is not None]
                U = [((r.h + r.hm) / 2).ravel() for r in refs(g, 'up', n, sid) if getattr(r, 'hm', None) is not None]
                if not D or not U:
                    continue
                md, mu = np.mean(D, 0), np.mean(U, 0)
                w = md - mu
                x = ((f.h + f.hm) / 2).ravel()
                z = float((x - (md + mu) / 2) @ w / (w @ w) * 2)      # +1 at the down centre, -1 at the up centre
                if key == 'up':
                    z = -z
                v['facing_score'] = round(z, 2)
                if z < -0.7:
                    rep.add(n, 'redo', 'facing', '%s が%sを向いて見える（%sのはず。点数 %.1f）' % (name, ja['up' if key == 'down' else 'down'], ja[key], z),
                            slot=sid, score=z, ask='シート%dの%d番（%s）の向きが違う。%s向きにして、同じ条件で描き直して' % (
                                n, num, spec['ja'][v['row']][v['col']], ja[key]))
                elif z < -0.35:
                    rep.add(n, 'check', 'facing_unsure', '%s の向きが%sに見えにくい（点数 %.1f）。顔の向きを見る' % (name, ja[key], z), slot=sid)


LANTERN_SIDE = {'down': 1, 'up': -1, 'left': -1, 'right': 1}   # left hand: screen right facing down, in front in side views


def check_lantern(runs, rep, fix=True):
    """Sheets 1 / 2: the lantern is in the LEFT hand in every frame. A frame with the lantern on the other side
    (e.g. a step frame drawn mirrored) makes the lantern jump hands in the walk cycle.
    Auto fix for front / back rows: the frame is mirrored (a front view mirrors cleanly; the stepping foot swaps,
    so the two step frames swap places too)."""
    from facing import side_cues
    for n in (1, 2):
        sp = runs.get(n)
        if not sp:
            continue
        spec = SHEETS[n]
        for r, d in enumerate(spec['face']):
            ids = [i for i in spec['ids'][r] if i in sp]
            bad, missing = [], []
            for sid in ids:
                _, lan = side_cues(sp[sid]['img'])
                sp[sid]['lantern'] = lan
                if lan is None:
                    missing.append(sid)
                elif lan * LANTERN_SIDE[d] < -0.15:
                    bad.append(sid)
            for sid in missing:
                v = sp[sid]
                rep.add(n, 'check', 'lantern_missing', '%s にランタンが見えない（左手に持つはず）' % slot_name(n, v['row'], v['col']), slot=sid)
            if not bad:
                continue
            nums = '・'.join('%d番' % (sp[s]['row'] * spec['cols'] + sp[s]['col'] + 1) for s in bad)
            names = '、'.join(spec['ja'][sp[s]['row']][sp[s]['col']] for s in bad)
            fixable = fix and d in ('down', 'up') and len(bad) < len(ids)
            rep.add(n, 'redo', 'lantern', 'シート%dの %s（%s）はランタンを右手に持っている（左手のはず）。歩くたびに持ち手が入れ替わって見える' % (n, nums, names)
                    + ('。仮に左右反転して使う' if fixable else ''), slot=bad[0],
                    ask='シート%dの%s（%s）でランタンが右手になっている。12コマすべて左手にランタンを持たせて（下向きでは画面の右側、上向きでは画面の左側）、同じ条件で描き直して' % (n, nums, names))
            for s in bad[1:]:
                rep.add(n, 'redo', 'lantern_frame', '%s: ランタンが右手' % slot_name(n, sp[s]['row'], sp[s]['col']), slot=s, hidden=True)
            if fixable:
                mir = {s: np.ascontiguousarray(sp[s]['img'][:, ::-1]) for s in bad}
                # stepping foot swaps in a mirror -> swap the two step frames when both were mirrored
                steps = [s for s in ids[1:] if s in bad]
                if n == 1 and len(steps) == 2:
                    mir[steps[0]], mir[steps[1]] = mir[steps[1]], mir[steps[0]]
                elif n == 2 and len(steps) >= 2:
                    pass   # run frames: the stride order is kept (mirroring a landing frame keeps it a landing frame)
                for s, im in mir.items():
                    sp[s]['img'] = im
                    sp[s]['fixed'] = sp[s].get('fixed', []) + ['mirrored_lantern']
                rep.add(n, 'auto', 'lantern_mirror', 'シート%dの %s を左右反転して、ランタンを左手にした（仮。描き直しが届くまで）' % (n, nums))


def check_palette(runs, ref_pal, rep):
    if ref_pal is None:
        return
    pl = P.srgb_to_lab(ref_pal.astype(np.float64))
    for n, sp in runs.items():
        px = np.concatenate([v['img'][..., :3][v['img'][..., 3] > 0] for v in sp.values()]).astype(np.float64)
        if len(px) > 20000:
            px = px[np.random.default_rng(0).choice(len(px), 20000, replace=False)]
        lab = P.srgb_to_lab(px)
        d = np.sqrt(((lab[:, None] - pl[None]) ** 2).sum(-1)).min(1)
        far = float((d > 16).mean())
        if far > 0.2:
            rep.add(n, 'check', 'colors', '設定資料の配色から外れた色が %.0f%% ある。人物・服の色が資料とずれていないか見る' % (100 * far), far=far)
        mag = ((px[:, 0] > 150) & (px[:, 2] > 150) & (px[:, 1] < 110)).sum()
        if mag > 3:
            rep.add(n, 'check', 'leak', '背景のマゼンタが絵の中に %d ドット残っている' % mag)


def check_breath(runs, rep):
    sp = runs.get(5, {})
    if 'idle_a' in sp and 'idle_b' in sp:
        a, b = sp['idle_a']['img'], sp['idle_b']['img']
        H = max(a.shape[0], b.shape[0]); W = max(a.shape[1], b.shape[1])
        A = np.zeros((H, W, 4), np.uint8); B = A.copy()
        A[H - a.shape[0]:, :a.shape[1]] = a; B[H - b.shape[0]:, :b.shape[1]] = b
        best = None
        for dx in range(-4, 5):
            Bs = np.roll(B, dx, 1)
            diff = ((A[..., 3] > 0) != (Bs[..., 3] > 0)).sum()
            if best is None or diff < best[0]:
                best = (diff, dx)
        frac = best[0] / max(1, (A[..., 3] > 0).sum())
        dh = abs(a.shape[0] - b.shape[0])
        if best[0] == 0 and dh == 0:
            rep.add(5, 'check', 'breath_same', '待機AとBが同じ絵。呼吸に見えない（ゲームで 1 ドットの呼吸を足す）')
        elif frac > 0.12 or dh > 4:
            rep.add(5, 'check', 'breath_big', '待機AとBの差が大きい（輪郭の %.0f%%、身長差 %d ドット）。交互に出すと跳ねて見えないか見る' % (100 * frac, dh))


def check_faces(runs, rep):
    sp = runs.get(9, {})
    if 'face_neutral' not in sp:
        return
    base = sp['face_neutral']['img']
    for k, v in sp.items():
        if k == 'face_neutral':
            continue
        im = v['img']
        if abs(im.shape[0] - base.shape[0]) > 3 or abs(im.shape[1] - base.shape[1]) > 4:
            rep.add(9, 'check', 'face_size', '%s の大きさが通常と違う（%d×%d / 通常 %d×%d）。重ねたときずれる' % (
                slot_name(9, v['row'], v['col']), im.shape[1], im.shape[0], base.shape[1], base.shape[0]), slot=k)


# ============================================================ review image
def review(n, path, st, sprites, rep, od):
    spec = SHEETS[n]
    try:
        font = ImageFont.truetype(FONT, 22)
        small = ImageFont.truetype(FONT, 16)
    except Exception:
        font = small = ImageFont.load_default()
    src = Image.open(path).convert('RGB')
    Z = 4 if spec['kind'] != 'face' else 3
    tiles = []
    for r in range(spec['rows']):
        for c in range(spec['cols']):
            sid = spec['ids'][r][c]
            lv = rep.level_of(n, sid)
            col = {'redo': (220, 60, 60), 'check': (230, 180, 40), 'auto': (90, 170, 230), 'info': (120, 200, 120), 'ok': (120, 200, 120)}[lv]
            if sid in sprites:
                v = sprites[sid]
                nat = Image.fromarray(v['img'])
                big = nat.resize((nat.width * Z, nat.height * Z), Image.NEAREST)
                s = src.crop(tuple(v['box']))
                k = big.height / s.height
                s = s.resize((max(1, int(s.width * k)), big.height), Image.LANCZOS)
                t = Image.new('RGB', (s.width + big.width + 18, big.height + 40), (60, 60, 70))
                t.paste(s, (4, 36))
                g = Image.new('RGBA', big.size, (92, 92, 104, 255)); g.alpha_composite(big)
                t.paste(g, (s.width + 12, 36))
            else:
                t = Image.new('RGB', (200, 120), (60, 60, 70))
            d = ImageDraw.Draw(t)
            d.rectangle([0, 0, t.width - 1, t.height - 1], outline=col, width=4)
            d.text((8, 6), '%d %s  %s' % (r * spec['cols'] + c + 1, spec['ja'][r][c], sid), fill=col, font=small)
            tiles.append(t)
    cw = max(t.width for t in tiles); ch = max(t.height for t in tiles)
    cols = spec['cols']
    rows = (len(tiles) + cols - 1) // cols
    msgs = [i for i in rep.items if i['sheet'] == n]
    head_h = 40 + 24 * min(len(msgs), 14)
    out = Image.new('RGB', (cw * cols + 8 * (cols + 1), ch * rows + 8 * (rows + 1) + head_h), (36, 36, 44))
    d = ImageDraw.Draw(out)
    d.text((10, 8), 'シート%d %s — %s  (ドット %.2f px, %s)' % (n, spec['title'], os.path.basename(path), st.get('period', 0), st.get('scale_note', '')),
           fill=(235, 235, 235), font=font)
    for i, m in enumerate(msgs[:14]):
        colr = {'redo': (240, 90, 90), 'check': (240, 200, 70), 'auto': (120, 190, 240), 'info': (170, 170, 170)}[m['level']]
        d.text((14, 40 + 24 * i), '[%s] %s' % (LEVEL_JA[m['level']], m['msg']), fill=colr, font=small)
    for i, t in enumerate(tiles):
        out.paste(t, (8 + (i % cols) * (cw + 8), head_h + 8 + (i // cols) * (ch + 8)))
    os.makedirs(os.path.join(od, 'review'), exist_ok=True)
    out.save(os.path.join(od, 'review', 'sheet%d.png' % n))


# ============================================================ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('folder')
    ap.add_argument('--char', default='arun')
    ap.add_argument('--out', default=None)
    ap.add_argument('--refs', default=None, help='known-facing reference sprites (default configs/refs/<char>)')
    ap.add_argument('--check', action='store_true', help='validate only (no palette / packing)')
    ap.add_argument('--size-tol', type=float, default=0.10)
    ap.add_argument('--colors', type=int, default=52)
    ap.add_argument('--only', default=None, help='comma list of sheet numbers')
    ap.add_argument('--repack', action='store_true',
                    help='skip stages 1-6: re-pack from <out>/native/*.png and report.json (after fixing natives by hand)')
    ap.add_argument('--no-autofix', action='store_true', help='report only: do not mirror lantern frames / rescale off-scale poses')
    ap.add_argument('--no-manifest', action='store_true', help='ignore <folder>/manifest.json (slice automatically)')
    args = ap.parse_args()
    args.manifest = {} if args.no_manifest else load_manifest(args.folder)
    od = os.path.abspath(args.out or os.path.join(HERE, 'out', args.char))
    if args.repack:
        return repack(args, od)
    os.makedirs(os.path.join(od, 'native'), exist_ok=True)
    rep = Report()
    found = find_sheets(args.folder, rep)
    if args.only:
        keep = {int(x) for x in args.only.split(',')}
        found = {k: v for k, v in found.items() if k in keep}
        rep.items = [i for i in rep.items if i['sheet'] is None or i['sheet'] in keep]
    ref_dir = args.refs or os.path.join(HERE, 'configs', 'refs', args.char)
    fc = Facing(ref_dir)
    if fc.empty:
        rep.add(None, 'info', 'no_refs', '向きの見本（%s）が無い。向きの検査はシートどうしの多数決だけ（行ごと全部が逆だと気づけない）' % os.path.relpath(ref_dir, HERE))
    ref_pal = None
    pj = os.path.join(ref_dir, 'palette.json')
    if os.path.exists(pj):
        ref_pal = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in json.load(open(pj))], np.uint8)
    runs, states = {}, {}
    for n in ORDER:
        if n not in found:
            continue
        t0 = time.time()
        st, sp = process_sheet(n, found[n], rep, args)
        check_heights(n, SHEETS[n], sp, rep)
        states[n], runs[n] = st, sp
        for sid, v in sp.items():
            Image.fromarray(v['img']).save(os.path.join(od, 'native', sid + '.png'))
        print('sheet%d  %-24s dot %.2f px  %s  %d poses  %.1fs' % (n, os.path.basename(found[n]), st.get('period', 0),
                                                              st.get('scale_note', ''), len(sp), time.time() - t0))
    check_facing(runs, fc, rep)
    check_lantern(runs, rep, fix=not args.no_autofix)
    check_scale(runs, rep, fix=not args.no_autofix)
    check_palette(runs, ref_pal, rep)
    check_breath(runs, rep)
    check_faces(runs, rep)
    # natives again: the checks may have fixed some (lantern mirror, rescale) — native/ is what --repack reads
    for n, sp in runs.items():
        for sid, v in sp.items():
            if v.get('fixed'):
                Image.fromarray(v['img']).save(os.path.join(od, 'native', sid + '.png'))
    for n in runs:
        review(n, found[n], states[n], runs[n], rep, od)
    # facing scores into the state
    for n, sp in runs.items():
        for sid, v in sp.items():
            for k in ('facing_score', 'facing_cues', 'scale', 'lantern', 'fixed'):
                if k in v:
                    states[n]['sprites'][sid][k] = v[k]
    txt = rep.text(states)
    with open(os.path.join(od, 'report.txt'), 'w') as f:
        f.write(txt)
    with open(os.path.join(od, 'report.json'), 'w') as f:
        json.dump(dict(char=args.char, folder=os.path.abspath(args.folder), sheets={str(k): v for k, v in states.items()},
                       items=rep.items), f, indent=1, ensure_ascii=False, default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))
    print(txt)
    if not args.check:
        import pack
        pack.pack(args.char, od, runs, rep, colors=args.colors)
        with open(os.path.join(od, 'report.txt'), 'w') as f:
            f.write(rep.text(states))
    return 1 if any(i['level'] == 'redo' for i in rep.items) else 0


def repack(args, od):
    import pack
    js = json.load(open(os.path.join(od, 'report.json')))
    rep = Report()
    rep.items = js['items']
    runs = {}
    for n, st in js['sheets'].items():
        n = int(n)
        spec = SHEETS[n]
        pos = {spec['ids'][r][c]: (r, c) for r in range(spec['rows']) for c in range(spec['cols'])}
        for sid, v in st.get('sprites', {}).items():
            p = os.path.join(od, 'native', sid + '.png')
            if os.path.exists(p):
                r, c = pos[sid]
                runs.setdefault(n, {})[sid] = dict(img=np.asarray(Image.open(p).convert('RGBA')).copy(), row=r, col=c, air=v.get('air', 0))
    pack.pack(args.char, od, runs, rep, colors=args.colors)
    with open(os.path.join(od, 'report.txt'), 'w') as f:
        f.write(rep.text({int(k): v for k, v in js['sheets'].items()}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
