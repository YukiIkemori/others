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
            its = [i for i in self.items if i['level'] == L]
            if not its:
                continue
            out.append('■ %s（%d 件）' % (LEVEL_JA[L], len(its)))
            for n in ORDER + [None]:
                for i in its:
                    if i['sheet'] == n:
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
    dark = mag & (np.maximum(rgb[..., 0], rgb[..., 2]) < 200)
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


def check_facing(runs, fc, rep):
    """runs: {n: sprites}. Uses library refs + leave-one-out refs of the run."""
    # collect run refs per expected direction
    run_refs = {}
    for n, sp in runs.items():
        spec = SHEETS[n]
        for sid, v in sp.items():
            d = spec['face'][v['row']]
            if d is None or sid in spec['no_facing']:
                continue
            key = 'face_' + d if spec['kind'] == 'face' else d
            run_refs.setdefault(key, []).append((n, sid, v['img']))
    from facing import head
    heads = {(n, sid): head(img, face=n == 9) for key, lst in run_refs.items() for (n, sid, img) in lst}
    hm = {(n, sid): head(img[:, ::-1], face=n == 9) for key, lst in run_refs.items() for (n, sid, img) in lst}
    def mscore(h0, h1, refs):
        return float(np.mean([-np.abs(h0 - r).mean() + np.abs(h1 - r).mean() for r in refs])) if refs else None
    # pass 1: library only -> sprites that look mirrored are not used as references for the others
    suspect = set()
    for key, lst in run_refs.items():
        if key in ('left', 'right', 'face_left', 'face_right') and fc.lib.get(key):
            for (n, sid, img) in lst:
                if mscore(heads[(n, sid)], hm[(n, sid)], fc.lib[key]) < -0.3:
                    suspect.add((n, sid))
    ja = {'down': '下（手前）', 'up': '上（奥）', 'left': '左', 'right': '右'}
    for key, lst in run_refs.items():
        for (n, sid, img) in lst:
            spec = SHEETS[n]
            v = runs[n][sid]
            others = [heads[(m, s)] for (m, s, _) in lst if (m, s) != (n, sid) and (m, s) not in suspect]
            lib = fc.lib.get(key, [])
            num = v['row'] * spec['cols'] + v['col'] + 1
            if key in ('left', 'right', 'face_left', 'face_right'):
                h0, h1 = heads[(n, sid)], hm[(n, sid)]
                s_run, s_lib = mscore(h0, h1, others), mscore(h0, h1, lib)
                parts = [x for x in (s_run, s_lib) if x is not None]
                score = float(np.mean(parts)) if parts else 0.0
                v['facing_score'] = round(score, 2)
                want = key.replace('face_', '')
                other = {'left': '右', 'right': '左'}[want]
                if score < -0.6:
                    rep.add(n, 'redo', 'facing', '%s が%sを向いている（%s向きのはず）' % (slot_name(n, v['row'], v['col']), other, '左' if want == 'left' else '右'),
                            slot=sid, score=score,
                            ask='シート%dの%d番（%s）が%sを向いている。%sにして、同じ条件で描き直して' % (
                                n, num, spec['ja'][v['row']][v['col']], other,
                                '全部左向き' if spec['kind'] == 'battle' else ('少し右向き' if spec['kind'] == 'face' else ja[want] + '向き')))
                elif score < 0.15:
                    rep.add(n, 'check', 'facing_unsure', '%s の向きがはっきりしない（点数 %.2f）' % (slot_name(n, v['row'], v['col']), score), slot=sid)
            else:
                # down / up rows: which class fits best, and does it fit that class as well as its real members?
                sc, typ = {}, {}
                for d in ('down', 'up', 'left', 'right'):
                    rs = list(fc.lib.get(d, [])) + [heads[(m, s)] for (m, s, _) in run_refs.get(d, []) if (m, s) != (n, sid) and (m, s) not in suspect]
                    if rs:
                        sc[d] = float(np.mean([-np.abs(heads[(n, sid)] - r).mean() for r in rs]))
                        typ[d] = float(np.median([np.mean([-np.abs(a - b).mean() for b in rs if b is not a]) for a in rs])) if len(rs) > 1 else sc[d]
                v['facing_class'] = {k: round(x, 2) for k, x in sc.items()}
                if sc and key in sc:
                    best = max(sc, key=sc.get)
                    if best != key and sc[best] - sc[key] > 0.8:
                        fits = sc[best] >= typ[best] - 1.0
                        if fits:
                            rep.add(n, 'redo', 'facing', '%s が%sを向いて見える（%sのはず）' % (slot_name(n, v['row'], v['col']), ja[best], ja[key]),
                                    slot=sid, ask='シート%dの%d番（%s）の向きが違う。%s向きにして、同じ条件で描き直して' % (
                                        n, num, spec['ja'][v['row']][v['col']], ja[key]))
                        else:
                            rep.add(n, 'check', 'facing_unsure', '%s の向きが%sに見えない（%sに近い）。顔の向きを見る' % (
                                slot_name(n, v['row'], v['col']), ja[key], ja[best]), slot=sid)


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
    args = ap.parse_args()
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
    if not fc.lib:
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
    check_palette(runs, ref_pal, rep)
    check_breath(runs, rep)
    check_faces(runs, rep)
    for n in runs:
        review(n, found[n], states[n], runs[n], rep, od)
    # facing scores into the state
    for n, sp in runs.items():
        for sid, v in sp.items():
            for k in ('facing_score', 'facing_class'):
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
