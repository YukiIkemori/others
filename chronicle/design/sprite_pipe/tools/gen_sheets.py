#!/usr/bin/env python3
"""Generate character sprite sheets with the image API and normalise them for the sprite pipeline.

Needs: python3 + Pillow (stdlib otherwise). The API settings come from the environment (tools/gen_api.py):
  set -a; . <owner's env file>; set +a        # OPENAI_API_KEY, OPENAI_MODEL, OPENAI_USAGE_LOG, GEN_IMAGE_CAP

Commands (run in design/sprite_pipe/):
  python3 tools/gen_sheets.py companion selma --sheets 1            # one sheet (resumes: skips sheets already made)
  python3 tools/gen_sheets.py companion selma --sheets 2,3,4,5 --quality medium
  python3 tools/gen_sheets.py companion selma --fix                 # pipeline check -> redo lines -> cell / sheet redraws
  python3 tools/gen_sheets.py arun-fix                              # Arun: the redo lines of out/arun_v1/report.json
  python3 tools/gen_sheets.py prompt companion selma 3              # print the prompt only (no call)
  python3 tools/gen_sheets.py normalize <raw.png> companion selma 3  # re-normalise a saved raw image (no call)

Outputs: design/art_ref/gen/<kind>/<id>/
  <sheet files>          exact canvas of the layout, 1 art px = 8x8 image px, background #FF00FF (what sheets.py reads)
  manifest.json          [{sheet, file, layout 'RxC', logical_cell, image_px, frames}] (sheets.py slices by it)
  raw/                   every raw image the API returned (<sheet>_a<N>.png) + the prompt text
  state.json             attempts per sheet (resume, the 3-attempt limit)

How a raw image becomes a sheet (normalise):
  key the magenta -> connected parts -> each part to the layout cell holding its centre -> art pixel size s =
  (median height of the upright poses in the image) / target height (or, for edits, the height of the untouched
  reference poses) -> per pose: fit the grid phase at pitch s, one colour per art pixel (majority of the inner part of
  the cell, dark outline wins ties) -> paste on the layout's canvas (centred, feet on the row's ground line, air poses
  keep their height above it) -> x8 nearest.

Edits (fix a few cells of an existing sheet): the sheet region around the bad cells is sent back with the problem
(the pipeline's paste-ready redo line + an English instruction); only the bad cells of the result are taken, sampled at
the pitch measured on the untouched cells, and pasted back into the sheet. Scale problems are pre-scaled first (the
model only redraws the pose cleanly at the size it is given).
"""
import argparse
import copy
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
from collections import Counter, deque

from PIL import Image, ImageChops, ImageFilter

import gen_api

TOOLS = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(TOOLS)
DESIGN = os.path.dirname(PIPE)
ART = os.path.join(DESIGN, 'art_ref')
GEN = os.path.join(ART, 'gen')
ARUN_SHEETS = os.path.join(ART, 'arun_sheets')
HERO_REF = os.path.join(ART, 'hero_sheet_owner.png')
STYLE_MD = os.path.join(ART, 'STYLE_PROMPT.md')
MAGENTA = (255, 0, 255)
DOT = 8
MAX_EDGE = 3840
MAX_ASPECT = 3.0
MAX_ATTEMPTS = 3

sys.path.insert(0, TOOLS)
import brief_spec  # noqa: E402  (pure python: Arun's layouts)

# ----------------------------------------------------------------------------------------------- text
POSE_EN = {
    'walk_down_0': 'facing the viewer, standing', 'walk_down_1': 'facing the viewer, right foot forward',
    'walk_down_2': 'facing the viewer, left foot forward', 'walk_up_0': 'back view, standing',
    'walk_up_1': 'back view, right foot forward', 'walk_up_2': 'back view, left foot forward',
    'walk_left_0': 'facing left (profile), standing', 'walk_left_1': 'facing left, front leg forward',
    'walk_left_2': 'facing left, back leg forward', 'walk_right_0': 'facing right (profile), standing',
    'walk_right_1': 'facing right, front leg forward', 'walk_right_2': 'facing right, back leg forward',
    'idle_a': 'battle idle A (ready stance)', 'idle_b': 'battle idle B (breathing: shoulders and weapon tip 2-3 px lower than idle A, otherwise identical)',
    'step': 'one step forward', 'guard': 'guard / defend', 'hit': 'taking damage (recoiling back)',
    'weak': 'near death: down on one knee, leaning on the weapon', 'ko': 'knocked out, lying on the ground',
    'victory_a': 'victory A (weapon raised high)', 'victory_b': 'victory B (weapon lowered, turning, character-specific gesture)',
    'glimmer': 'sudden insight (head snaps up)',
    'windup': 'wind-up before a slash', 'slash': 'follow-through after the slash (blade swung all the way down)',
    'thrust_ready': 'thrust ready stance', 'thrust': 'thrust (arm fully extended forward)',
    'charge': 'charging a special move (weapon pulled back, body low)', 'smash': 'special strike (leaping, swinging down, mid-air)',
    'cast_a': 'casting A (one hand held out forward)', 'cast_b': 'casting B (one hand raised high)',
    'item': 'using an item (raising a small bottle)', 'evade': 'evading (jumping backward)',
    'bare_idle': 'NO WEAPON: idle A with the weapon removed (hand still closed as if gripping a one-handed sword hilt)',
    'bare_windup': 'NO WEAPON: one-handed sword wind-up shape, empty closed hand', 'bare_slash': 'NO WEAPON: one-handed sword follow-through shape, empty closed hand',
    'bare_thrust': 'NO WEAPON: one-handed sword thrust shape, empty closed hand', 'bare_cast': 'NO WEAPON: casting A with the weapon removed',
    'face_neutral': 'face bust, neutral', 'face_smile': 'face bust, smiling', 'face_surprise': 'face bust, surprised',
    'face_pain': 'face bust, in pain (gritted teeth, one eye shut, sweat)',
    'ref_front': 'turnaround: front view', 'ref_34': 'turnaround: three-quarter front view',
    'ref_side_left': 'turnaround: side view facing left', 'ref_back': 'turnaround: back view',
    'ref_idle_left': 'battle idle A facing left (same as sheet 3 pose 1)', 'ref_face': 'face bust, neutral, turned slightly right (~80 px tall)',
    'ref_palette': 'colour swatches: 8 squares of 6x6 art px in 4 columns x 2 rows (main light, main, main shadow, secondary, hair, skin, leather, metal)',
    'act_nod': 'nodding', 'act_surprise': 'surprised', 'act_think': 'head tilted, thinking', 'act_bow': 'bowing',
    'act_kneel': 'kneeling on one knee', 'act_sit': 'sitting on the ground', 'act_call': 'raising a hand and calling out',
    'act_look': 'looking around to the side', 'act_lie': 'lying on the ground', 'act_draw': 'drawing the sword, ready',
    'act_resolve': 'hand on chest (resolve)', 'act_sad': 'head down (dejected)',
}
FACING_EN = {'down': 'facing the viewer', 'up': 'back view (walking away)', 'left': 'facing LEFT', 'right': 'facing RIGHT'}


def style_block():
    t = open(STYLE_MD, encoding='utf-8').read()
    m = re.search(r'<!-- PROMPT:BEGIN -->(.*?)<!-- PROMPT:END -->', t, re.S)
    return m.group(1).strip()


def md_section(path, start_pat, level=3):
    """text of the markdown section whose heading matches start_pat, up to the next heading of <= level"""
    t = open(path, encoding='utf-8').read()
    m = re.search(r'^(#{2,%d}) ' % level + start_pat + r'.*$', t, re.M)
    if not m:
        return ''
    lv = len(m.group(1))
    rest = t[m.end():]
    n = re.search(r'^#{2,%d} ' % lv, rest, re.M)
    return (m.group(0) + rest[:n.start()] if n else m.group(0) + rest).strip()


# ----------------------------------------------------------------------------------------------- specs
class Kind:
    """One character's sheet specs: sheet number -> dict(file, layout name, rows, cols, cell, ids, target, stand, air,
    face rows, gen grid, template builder, brief text)."""


def comp_specs(cid):
    js = json.load(open(os.path.join(ART, 'companion_sheets.json'), encoding='utf-8'))
    c = next((x for x in js['companions'] if x['id'] == cid), None)
    if c is None:
        raise SystemExit('unknown companion %s' % cid)
    L = js['layouts']
    mb = c.get('measureH', {}).get('battle', c['heightDots']['battle'])
    mf = c.get('measureH', {}).get('field', c['heightDots']['field'])
    out = {}
    for s in c['sheets']:
        lay = L[s['layout']]
        rows, cols = lay['grid']
        ids = lay['ids']
        n = s['n']
        if s['layout'] == 'design':
            target, stand, air = mb, ['ref_front', 'ref_34', 'ref_side_left', 'ref_back', 'ref_idle_left'], []
        elif s['layout'] == 'walk':
            target, stand, air = mf, [i for r in ids for i in r], []
        elif s['layout'] == 'face4':
            target, stand, air = c['heightDots'].get('face', 80), [i for r in ids for i in r], []
        else:
            target = mb
            stand = ['idle_a', 'idle_b', 'step', 'glimmer', 'cast_a', 'cast_b', 'item', 'bare_idle', 'bare_cast']
            air = ['smash', 'evade']
        out[n] = dict(n=n, file='comp_%s_s%d.png' % (cid, n), layout=s['layout'], rows=rows, cols=cols,
                      cell=lay['cellDots'], ids=ids, target=target, stand=stand, air=air,
                      face=lay.get('face') or [None] * rows,
                      gen_grid=(2, 2) if s['layout'] == 'face4' else (rows, cols))
    return js, c, out


def arun_specs():
    man = {e['sheet']: e for e in json.load(open(os.path.join(ARUN_SHEETS, 'manifest.json')))}
    out = {}
    for n, s in brief_spec.SHEETS.items():
        e = man[n]
        out[n] = dict(n=n, file=e['file'], layout='arun%d' % n, rows=s['rows'], cols=s['cols'], cell=e['logical_cell'],
                      ids=s['ids'], target=s['target_h'], stand=s['stand'], air=s['air'], face=s['face'],
                      gen_grid=(s['rows'], s['cols']))
    return out


# ----------------------------------------------------------------------------------------------- image utils
def load_rgb(p):
    return Image.open(p).convert('RGB')


def key_mask(img):
    """foreground mask ('L', 255 = art) of a magenta-keyed image: magenta-like = min(R,B) - G large and R ~ B"""
    r, g, b = img.split()
    mn = ImageChops.darker(r, b)
    d = ImageChops.subtract(mn, g)
    bg1 = d.point(lambda v: 255 if v > 60 else 0)
    rb = ImageChops.difference(r, b).point(lambda v: 255 if v < 90 else 0)
    bg = ImageChops.multiply(bg1, rb)
    fg = ImageChops.invert(bg)
    # opening: drop 1-2 px speckle
    return fg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))


def components(mask, f=4, min_area_px=0):
    """connected parts of a mask on a 1/f grid -> list of dict(box=(x0,y0,x1,y1) in full px, area in full px)"""
    W, H = mask.size
    w, h = max(1, W // f), max(1, H // f)
    small = mask.resize((w, h), Image.BOX).point(lambda v: 255 if v > 40 else 0)
    px = small.tobytes()
    seen = bytearray(w * h)
    out = []
    for start in range(w * h):
        if px[start] == 0 or seen[start]:
            continue
        q = deque([start])
        seen[start] = 1
        x0 = y0 = 10 ** 9
        x1 = y1 = -1
        area = 0
        while q:
            i = q.popleft()
            y, x = divmod(i, w)
            area += 1
            x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
            for dy in (-1, 0, 1):
                yy = y + dy
                if yy < 0 or yy >= h:
                    continue
                for dx in (-1, 0, 1):
                    xx = x + dx
                    if xx < 0 or xx >= w:
                        continue
                    j = yy * w + xx
                    if px[j] and not seen[j]:
                        seen[j] = 1
                        q.append(j)
        a = area * f * f
        if a >= min_area_px:
            out.append(dict(box=(x0 * f, y0 * f, (x1 + 1) * f, (y1 + 1) * f), area=a))
    return out


def union_box(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def tight_box(mask, box):
    """exact bbox of mask pixels inside box"""
    bb = mask.crop(box).getbbox()
    if not bb:
        return None
    return (box[0] + bb[0], box[1] + bb[1], box[0] + bb[2], box[1] + bb[3])


def profile(img, axis):
    """mean |difference| between neighbouring columns (axis 0) / rows (axis 1): value at c = edge between c-1 and c"""
    L = img.convert('L')
    sh = ImageChops.offset(L, 1, 0) if axis == 0 else ImageChops.offset(L, 0, 1)
    d = ImageChops.difference(L, sh)
    W, H = d.size
    p = d.resize((W, 1), Image.BOX) if axis == 0 else d.resize((1, H), Image.BOX)
    v = list(p.tobytes())
    v[0] = 0
    return v


def grid_contrast(img, s, step=0.5):
    """how well a grid of pitch s fits the drawn edges: best phase score / mean phase score (x and y, the lower).
    ~1 = the drawing has no grid at this pitch (the model drew finer / irregular pixels); > 1.5 = a clean grid"""
    out = []
    for ax in (0, 1):
        prof = profile(img, ax)
        n = len(prof)
        sc = []
        ph = 0.0
        while ph < s:
            tot = k = 0
            x = ph
            while x < n:
                i = int(round(x))
                if 0 < i < n:
                    tot += prof[i]
                    k += 1
                x += s
            sc.append(tot / max(1, k))
            ph += step
        out.append(max(sc) / (sum(sc) / len(sc) + 1e-9))
    return min(out)


def best_phase(prof, s, step=0.5):
    n = len(prof)
    best, bp = -1, 0.0
    ph = 0.0
    while ph < s:
        tot, k = 0.0, 0
        x = ph
        while x < n:
            i = int(round(x))
            if 0 < i < n:
                tot += prof[i]
                k += 1
            x += s
        sc = tot / max(1, k)
        if sc > best:
            best, bp = sc, ph
        ph += step
    return bp


def drawn_pitch(img, lo=2, hi=14):
    """the pixel size the model actually drew at: strongest autocorrelation lag of the edge profiles"""
    best = None
    for axis in (0, 1):
        v = profile(img, axis)
        n = len(v)
        m = sum(v) / max(1, n)
        d = [x - m for x in v]
        sc = []
        for lag in range(lo, hi + 1):
            sc.append((sum(d[i] * d[i + lag] for i in range(n - lag)) / max(1, n - lag), lag))
        sc.sort(reverse=True)
        best = (best or []) + [sc[0][1]]
    return sum(best) / len(best)


def downscale_dots(crop, mk, s, colors=40):
    """art drawn much finer than the target grid: area-average onto the grid (alpha-weighted, no magenta bleed),
    then snap to the crop's own palette and a hard alpha"""
    W, H = crop.size
    nx, ny = max(1, int(round(W / s))), max(1, int(round(H / s)))
    rgba = crop.convert('RGBA')
    rgba.putalpha(mk)
    # premultiply: average colour of the art pixels only
    black = Image.new('RGBA', rgba.size, (0, 0, 0, 0))
    pm = Image.composite(rgba, black, mk).convert('RGB')
    col = pm.resize((nx, ny), Image.BOX)
    al = mk.resize((nx, ny), Image.BOX)
    colp = col.load()
    alp = al.load()
    out = Image.new('RGB', (nx, ny))
    op = out.load()
    for j in range(ny):
        for i in range(nx):
            a = alp[i, j]
            if a < 8:
                op[i, j] = (0, 0, 0)
                continue
            r, g, b = colp[i, j]
            k = 255.0 / a
            op[i, j] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)))
    # no palette snap here: snapping averaged colours to the fine drawing's palette speckles the result; the
    # pipeline builds the character's palette (~50 colours) and tightens the outline afterwards
    res = out.convert('RGBA')
    res.putalpha(al.point(lambda v: 255 if v >= 128 else 0))
    return res


def sample_dots(img, mask, box, s):
    """RGBA art-pixel image of the region box of a raw image, pitch s, grid phase fitted to the drawn edges"""
    x0, y0, x1, y1 = box
    crop = img.crop(box)
    mk = mask.crop(box)
    W, H = crop.size
    if grid_contrast(crop, s) < 1.5:     # no clean grid at this pitch: majority sampling would be noise
        out = downscale_dots(crop, mk, s)
        bb = out.getbbox()
        return out.crop(bb) if bb else None
    phx = best_phase(profile(crop, 0), s)
    phy = best_phase(profile(crop, 1), s)
    # neutralise background, then a fine working palette
    base = Image.new('RGB', crop.size, MAGENTA)
    base.paste(crop, (0, 0), mk)
    q = base.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[:128 * 3]
    cols = [tuple(pal[i * 3:i * 3 + 3]) for i in range(len(pal) // 3)]
    bgi = {i for i, c in enumerate(cols) if abs(c[0] - 255) + c[1] + abs(c[2] - 255) < 60}
    lum = [0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] for c in cols]
    # start one pitch before the phase so the first partial column is covered
    sx = phx - s if phx > 0.5 else phx
    sy = phy - s if phy > 0.5 else phy
    nx = int(math.ceil((W - sx) / s))
    ny = int(math.ceil((H - sy) / s))
    out = Image.new('RGBA', (nx, ny), (0, 0, 0, 0))
    opx = out.load()
    inset = 0.22 * s
    for j in range(ny):
        fy0, fy1 = sy + j * s, sy + (j + 1) * s
        by0, by1 = max(0, int(fy0)), min(H, int(math.ceil(fy1)))
        if by1 <= by0:
            continue
        for i in range(nx):
            fx0, fx1 = sx + i * s, sx + (i + 1) * s
            bx0, bx1 = max(0, int(fx0)), min(W, int(math.ceil(fx1)))
            if bx1 <= bx0:
                continue
            hist = mk.crop((bx0, by0, bx1, by1)).histogram()
            area = (bx1 - bx0) * (by1 - by0)
            if hist[255] < 0.5 * area:
                continue
            ib = (max(0, int(fx0 + inset)), max(0, int(fy0 + inset)), min(W, int(math.ceil(fx1 - inset))), min(H, int(math.ceil(fy1 - inset))))
            cs = q.crop(ib).getcolors(4096) if ib[2] > ib[0] and ib[3] > ib[1] else None
            cs = [(n, k) for n, k in (cs or []) if k not in bgi]
            if not cs:
                cs = [(n, k) for n, k in (q.crop((bx0, by0, bx1, by1)).getcolors(4096) or []) if k not in bgi]
            if not cs:
                continue
            tot = sum(n for n, _ in cs)
            dark = [(n, k) for n, k in cs if lum[k] < 55]
            edge = hist[255] < 0.97 * area          # silhouette border: keep the dark outline
            if dark and edge and sum(n for n, _ in dark) >= 0.35 * tot:
                k = max(dark)[1]
            else:
                k = max(cs)[1]
            opx[i, j] = cols[k] + (255,)
    bb = out.getbbox()
    return out.crop(bb) if bb else None


def to_sheet(dots, bg=MAGENTA, dot=DOT):
    """RGBA art-pixel canvas -> RGB sheet at dot px per art pixel on the flat background"""
    base = Image.new('RGBA', dots.size, bg + (255,))
    base.alpha_composite(dots)
    return base.convert('RGB').resize((dots.size[0] * dot, dots.size[1] * dot), Image.NEAREST)


def sheet_dots(sheet_rgb, dot=DOT):
    """exact 8 px sheet -> RGBA art pixels (centre sampling; magenta -> transparent)"""
    W, H = sheet_rgb.size
    small = sheet_rgb.resize((W // dot, H // dot), Image.NEAREST)
    m = key_mask_raw(small)
    rgba = small.convert('RGBA')
    rgba.putalpha(m)
    return rgba


def key_mask_raw(img):
    r, g, b = img.split()
    d = ImageChops.subtract(ImageChops.darker(r, b), g).point(lambda v: 255 if v > 60 else 0)
    rb = ImageChops.difference(r, b).point(lambda v: 255 if v < 90 else 0)
    return ImageChops.invert(ImageChops.multiply(d, rb))


def render_pitch(dots_rgba, p, bg=MAGENTA, pad16=True):
    """art pixels -> image at p px per art pixel on the background (sizes padded to a multiple of 16)"""
    im = to_sheet(dots_rgba, bg, p)
    if pad16:
        W, H = im.size
        W2, H2 = (W + 15) // 16 * 16, (H + 15) // 16 * 16
        if (W2, H2) != (W, H):
            c = Image.new('RGB', (W2, H2), bg)
            c.paste(im, (0, 0))
            im = c
    return im


def pick_pitch(w_dots, h_dots, want=DOT):
    for p in range(want, 2, -1):
        if max(w_dots, h_dots) * p <= MAX_EDGE:
            return p
    return 3


# ----------------------------------------------------------------------------------------------- layout <-> raw
def ground_of(spec):
    ch = spec['cell'][1]
    return ch - max(4, (ch - spec['target']) // 4)


def assign_parts(mask, rows, cols, W, H, min_area):
    parts = components(mask, f=4, min_area_px=min_area)
    cw, ch = W / float(cols), H / float(rows)
    cells = {}
    for pt in parts:
        b = pt['box']
        cx, cy = (b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0
        r, c = min(rows - 1, int(cy // ch)), min(cols - 1, int(cx // cw))
        cells.setdefault((r, c), []).append(pt)
    return cells


def gen_to_final_map(spec):
    """gen grid cell (r, c) -> final (r, c) (reading order kept)"""
    gr, gc = spec['gen_grid']
    fr, fc = spec['rows'], spec['cols']
    m = {}
    for k in range(gr * gc):
        if k >= fr * fc:
            break
        m[(k // gc, k % gc)] = (k // fc, k % fc)
    return m


def normalize_full(raw, spec, log):
    """raw generated sheet (gen grid) -> (final 8 px sheet, frames, notes)"""
    W, H = raw.size
    gr, gc = spec['gen_grid']
    mask = key_mask(raw)
    cw_px = W / float(gc)
    s_guess = cw_px / spec['cell'][0]
    cells = assign_parts(mask, gr, gc, W, H, min_area=int((1.5 * s_guess) ** 2))
    fmap = gen_to_final_map(spec)
    ids = spec['ids']
    boxes = {}
    for (r, c), pts in cells.items():
        if (r, c) not in fmap:
            continue
        fr, fc = fmap[(r, c)]
        sid = ids[fr][fc] if fr < len(ids) and fc < len(ids[fr]) else None
        if sid is None:
            continue
        main = max(pts, key=lambda p: p['area'])
        keep = [p for p in pts if p['area'] >= 0.02 * main['area'] or _near(p['box'], main['box'], 3 * s_guess)]
        tb = tight_box(mask, union_box([p['box'] for p in keep]))
        if tb:
            boxes[sid] = dict(box=tb, gen=(r, c), fin=(fr, fc))
    notes = []
    hs = [body_height(mask, b['box'], s_guess) for sid, b in boxes.items() if sid in spec['stand']]
    if not hs:
        hs = [body_height(mask, b['box'], s_guess) for b in boxes.values()]
    hs.sort()
    if not hs:
        raise RuntimeError('no poses found in the raw image')
    s = hs[len(hs) // 2] / float(spec['target'])
    log('  pitch in raw image: %.2f px per art pixel (upright median %d px / %d)' % (s, hs[len(hs) // 2], spec['target']))
    # ground per gen row (raw px): median bottom of the non-air poses
    grounds = {}
    for sid, b in boxes.items():
        if sid not in spec['air'] and not sid.startswith('ref_palette'):
            grounds.setdefault(b['gen'][0], []).append(b['box'][3])
    grounds = {r: sorted(v)[len(v) // 2] for r, v in grounds.items()}
    cwd, chd = spec['cell']
    canvas = Image.new('RGBA', (spec['cols'] * cwd, spec['rows'] * chd), (0, 0, 0, 0))
    gline = ground_of(spec)
    frames = {}
    for sid, b in boxes.items():
        box = b['box']
        pad = int(2 * s)
        pbox = (max(0, box[0] - pad), max(0, box[1] - pad), min(W, box[2] + pad), min(H, box[3] + pad))
        dots = sample_dots(raw, mask, pbox, s)
        if dots is None:
            continue
        fr, fc = b['fin']
        w, h = dots.size
        air = 0
        if sid in spec['air'] and b['gen'][0] in grounds:
            air = max(0, int(round((grounds[b['gen'][0]] - box[3]) / s)))
        if sid.startswith('ref_face') or sid.startswith('face_'):
            y = fr * chd + (chd - h) // 2 if spec['layout'] != 'face4' else fr * chd + chd - 4 - h
        elif sid == 'ref_palette':
            y = fr * chd + (chd - h) // 2
        else:
            y = fr * chd + gline - h - air
        x = fc * cwd + (cwd - w) // 2
        if w > cwd - 2 or h > chd - 2:
            notes.append('%s is %dx%d art px, larger than its cell %dx%d (clipped)' % (sid, w, h, cwd, chd))
        y = max(fr * chd + 1, y)
        cell_img = Image.new('RGBA', (cwd, chd), (0, 0, 0, 0))
        cell_img.alpha_composite(dots, (max(0, x - fc * cwd), y - fr * chd) if y - fr * chd + h <= chd else (max(0, x - fc * cwd), max(0, chd - h)))
        canvas.alpha_composite(cell_img, (fc * cwd, fr * chd))
        frames[sid] = dict(row=fr + 1, column=fc + 1, logical_bbox=[w, h], air=air)
    missing = [i for row in ids for i in row if i and i not in frames]
    if missing:
        notes.append('missing poses: ' + ' '.join(missing))
    return to_sheet(canvas), frames, notes, s


def body_height(mask, box, s_guess, min_run=3.5):
    """height of a pose without thin things sticking up (a raised blade, a staff, an antenna of hair): the top is the
    first row holding a run of art at least min_run art px wide (at the requested pitch). A raised sword otherwise
    makes the bbox the target height and the body comes out small."""
    crop = mask.crop(box)
    W, H = crop.size
    px = crop.tobytes()
    need = max(3, int(min_run * s_guess))
    for y in range(H):
        row = px[y * W:(y + 1) * W]
        run = best = 0
        for v in row:
            run = run + 1 if v else 0
            if run > best:
                best = run
        if best >= need:
            return H - y
    return H


def _near(a, b, d):
    return not (a[2] + d < b[0] or b[2] + d < a[0] or a[3] + d < b[1] or b[3] + d < a[1])


# ----------------------------------------------------------------------------------------------- templates
def cell_sprite(dots, spec_cell, r, c):
    cw, ch = spec_cell
    im = dots.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
    bb = im.getbbox()
    return im.crop(bb) if bb else None


def compose(cells, rows, cols, cell, ground):
    """[(r, c, sprite RGBA)] -> RGBA art-pixel canvas (centred, feet on the ground line)"""
    cw, ch = cell
    cv = Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0))
    for r, c, sp in cells:
        if sp is None:
            continue
        w, h = sp.size
        y = r * ch + max(1, min(ground - h, ch - h - 1))
        cv.alpha_composite(sp, (c * cw + max(0, (cw - w) // 2), y))
    return cv


def arun_dots(n):
    e = arun_specs()[n]
    fixed = os.path.join(GEN, 'arun', 'arun', e['file'])      # the hero's sheets after the redo edits, when there
    return sheet_dots(load_rgb(fixed if os.path.exists(fixed) else os.path.join(ARUN_SHEETS, e['file']))), e


def template_for(spec):
    """RGBA art-pixel layout template in the GEN grid, drawn with the hero's delivered sheets (or None)"""
    lay = spec['layout']
    gr, gc = spec['gen_grid']
    if lay in ('walk', 'battle_base'):
        n = 1 if lay == 'walk' else 5
        d, e = arun_dots(n)
        cells = [(r, c, cell_sprite(d, e['cell'], r, c)) for r in range(e['rows']) for c in range(e['cols'])]
        return compose(cells, gr, gc, spec['cell'], ground_of(spec))
    if lay == 'battle_action_bare':
        d6, e6 = arun_dots(6)
        d7, e7 = arun_dots(7)
        cells = [(r, c, cell_sprite(d6, e6['cell'], r, c)) for r in range(2) for c in range(5)]
        cells += [(2, c, cell_sprite(d7, e7['cell'], 0, c)) for c in range(5)]
        return compose(cells, 3, 5, spec['cell'], ground_of(spec))
    if lay == 'face4':
        d9, e9 = arun_dots(9)
        pick = [(0, 0), (0, 2), (1, 0), (1, 1)]     # neutral, smile, surprise, sad (closest to pain)
        cells = [(k // 2, k % 2, cell_sprite(d9, e9['cell'], r, c)) for k, (r, c) in enumerate(pick)]
        return compose(cells, 2, 2, spec['cell'], spec['cell'][1] - 4)
    return None


# ----------------------------------------------------------------------------------------------- prompts
GEN_SHEET_JA = {1: 'シート1 設定画', 2: 'シート2 フィールドの歩き', 3: 'シート3 戦闘の基本ポーズ',
                4: 'シート4 戦闘の行動ポーズ＋武器なし版', 5: 'シート5 顔の表情'}


def comp_prompt(c, spec, p, W, H, refs_desc, extra=''):
    req = os.path.join(ART, 'COMPANIONS_REQUEST.md')
    char = md_section(req, r'4\.\d+ %s（%s）' % (re.escape(c['name']), re.escape(c['id'])))
    rules = md_section(req, r'2\. 全シート共通の決まり', level=2)
    sheet = md_section(req, re.escape(GEN_SHEET_JA[spec['n']]))
    if spec['n'] in (3, 4):
        sheet = md_section(req, r'戦闘用（シート3・4）の共通の決まり') + '\n\n' + sheet
    gr, gc = spec['gen_grid']
    fmap = gen_to_final_map(spec)
    order = []
    for (r, c_), (fr, fc) in sorted(fmap.items()):
        sid = spec['ids'][fr][fc]
        if sid:
            order.append('row %d col %d: %s' % (r + 1, c_ + 1, POSE_EN.get(sid, sid)))
    cw, ch = spec['cell']
    face_rows = ''
    if spec['layout'] in ('battle_base', 'battle_action_bare'):
        face_rows = 'Every battle pose faces LEFT (three-quarter view turned slightly toward the viewer), like the template.'
    elif spec['layout'] == 'walk':
        face_rows = ('Rows: 1 = facing the viewer (walking toward us), 2 = back view, 3 = facing LEFT, 4 = facing RIGHT. '
                     'Slight top-down angle like the template. BOTH HANDS EMPTY (no lantern, nothing in the hands); weapons stowed as the brief says.')
    elif spec['layout'] == 'face4':
        face_rows = ('Chest-up bust portraits turned slightly to the RIGHT, each filling its cell (~80 art px tall). Everything except the facial '
                     'expression (hair, headgear, clothes, angle, size, position) is identical in all four.')
    elif spec['layout'] == 'design':
        face_rows = ('Row 1: four standing turnaround figures (front, three-quarter front, side facing LEFT, back). Row 2: the battle idle facing LEFT, '
                     'then a chest-up face bust turned slightly RIGHT (~80 art px tall), then 8 colour swatch squares (6x6 art px each, 4 across x 2 down). '
                     'Row 2 column 4 stays EMPTY. No text anywhere.')
    tgt = spec['target']
    key_look = ('KEY LOOK: main colour %s (hue %d deg, %s value) on about half of the clothing — match this hex closely, do not drift to a brighter or more '
                'saturated colour. Head shape: %s. Signature item: %s. Proportions exactly like the hero\'s sheets: about 2.7 heads tall, big head, '
                'NOT realistic tall proportions.' % (c.get('mainHex'), c.get('mainHue', 0), c.get('value', ''), c.get('headShape'), c.get('signature')))
    if spec['layout'] != 'face4':
        body = c['heightDots']['field' if spec['layout'] == 'walk' else 'battle']
        hh = int(round(body / 2.7))
        key_look += (' HEAD SIZE: the head (top of hair to chin, not counting a hat) is about %d art px (%d image px) tall and about as wide as the '
                     'shoulders, exactly like the template figures; chunky readable clusters, never finer detail than one %d px art pixel.' % (hh, hh * p, p))
        key_look += (' BUILD (the owner\'s rule for every character): CHUNKY, not slim — 2.6-2.8 heads tall, big head, broad shoulders about as wide '
                     'as the head, thick short arms and legs, big hands and big boots, a low centre of gravity; the legs are only about one third of the '
                     'body height. The figure must look as big and as heavy on screen as the hero in the template (same head size and bulk); only the '
                     'overall height differs by the numbers above. Even a slender or elderly personality is drawn with these chunky proportions.')
        if spec['layout'] in ('battle_base', 'battle_action_bare', 'design'):
            key_look += (' In the standing poses (idle A/B, step, glimmer, casting, item, turnaround) the weapon is held LOW or level — never raised '
                         'above the head — so the top of the head (or hat) is the top of the figure.')
    head = ('You are the pixel artist of a 2D RPG. Draw ONE sprite sheet: companion %s (%s), %s.\n' % (c['name'], c['id'], GEN_SHEET_JA[spec['n']]))
    txt = [style_block(), '', head,
           'ATTACHED IMAGES:', refs_desc, '',
           'CANVAS: %dx%d px, flat #FF00FF. Grid of %d rows x %d columns, each cell %dx%d px (%dx%d art px); one art pixel = %d x %d image px everywhere (this overrides the 8 px of the Japanese rules). '
           'One pose centred in each cell, never crossing into a neighbour cell or the image edge. Feet of all poses in a row on one line near the bottom of the cells.'
           % (W, H, gr, gc, cw * p, ch * p, cw, ch, p, p),
           'SIZE: the character is %d art px tall head to feet (%d image px) in every upright pose (hair/headgear may add a little). Kneeling, crouching, '
           'jumping or lying poses keep the SAME body scale (same head size) — only the pose changes.' % (tgt, tgt * p) if spec['layout'] != 'face4' else
           'SIZE: each bust is about 80 art px (%d image px) wide and tall.' % (80 * p),
           face_rows, key_look,
           'POSES in reading order:\n' + '\n'.join(order),
           '',
           'CHARACTER BRIEF (Japanese, authoritative):\n' + char,
           '',
           'SHEET BRIEF (Japanese, authoritative; follow its pose table for this character\'s weapon type):\n' + sheet,
           '',
           'COMMON RULES (Japanese):\n' + rules]
    if extra:
        txt += ['', 'EXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + extra]
    return '\n'.join(txt)


# ----------------------------------------------------------------------------------------------- state / files
class Job:
    def __init__(self, kind, cid, specs, char=None):
        self.kind, self.id, self.specs, self.char = kind, cid, specs, char
        self.dir = os.path.join(GEN, kind, cid)
        self.raw = os.path.join(self.dir, 'raw')
        os.makedirs(self.raw, exist_ok=True)
        self.state_path = os.path.join(self.dir, 'state.json')
        self.state = json.load(open(self.state_path)) if os.path.exists(self.state_path) else {'sheets': {}}
        for k, v in self.state['sheets'].items():       # cells grown by an edit
            if v.get('cell') and int(k) in self.specs:
                self.specs[int(k)]['cell'] = list(v['cell'])

    def save(self):
        json.dump(self.state, open(self.state_path, 'w'), ensure_ascii=False, indent=1)

    def st(self, n):
        return self.state['sheets'].setdefault(str(n), {'attempts': []})

    def log(self, msg):
        print(msg, flush=True)
        with open(os.path.join(self.dir, 'gen_log.txt'), 'a', encoding='utf-8') as f:
            f.write(time.strftime('%H:%M:%S ') + msg + '\n')

    def write_manifest(self):
        ents = []
        for n, spec in sorted(self.specs.items()):
            p = os.path.join(self.dir, spec['file'])
            if not os.path.exists(p):
                continue
            im = Image.open(p)
            fr = self.st(n).get('frames')
            if fr is None:
                continue
            ents.append(dict(sheet=n, file=spec['file'], layout='%dx%d' % (spec['rows'], spec['cols']),
                             logical_cell=spec['cell'], image_px=list(im.size),
                             frames=[dict(id=k, row=v['row'], column=v['column'], logical_bbox=v['logical_bbox'])
                                     for k, v in sorted(fr.items(), key=lambda kv: (kv[1]['row'], kv[1]['column']))]))
        json.dump(ents, open(os.path.join(self.dir, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)


def attempt_count(job, n):
    return len([a for a in job.st(n)['attempts'] if a.get('images', 1)])


# ----------------------------------------------------------------------------------------------- companion sheets
def comp_refs(job, spec, p, quality):
    """-> (images, description) attached to a companion sheet request"""
    imgs, desc = [], []
    tpl = template_for(spec)
    if tpl is not None:
        imgs.append(render_pitch(tpl, p))
        desc.append('Image %d = LAYOUT TEMPLATE drawn with ANOTHER character (the hero). Copy only its grid, cell positions, pixel size, figure size, '
                    'facing and the kind of each pose. Do NOT copy the hero himself (no red scarf, no ash-brown messy hair, no black coat + cream cloth + '
                    'brown leather combination). Draw the companion described below instead, with the companion\'s own stance and personality.' % len(imgs))
    if spec['layout'] == 'design':
        a5 = load_rgb(os.path.join(ARUN_SHEETS, 'arun_sheet_05.png'))
        imgs.append(a5.resize((a5.size[0] // 2, a5.size[1] // 2), Image.NEAREST))
        desc.append('Image %d = the hero\'s delivered BATTLE SHEET (another character, shown at half size). Your figures must have the SAME '
                    'proportions and pixel density: big head (about 22-24 art px of the 64), slim neck, chunky hands and boots, about 2.7 heads '
                    'tall. Do not copy the hero himself.' % len(imgs))
    imgs.append(load_rgb(HERE_REF()))
    desc.append('Image %d = QUALITY BAR (the hero\'s design sheet). Match its pixel density, shading, hue-shifted colour ramps, outline treatment and '
                'overall finish. Do not copy the character, the text or the paper layout.' % len(imgs))
    s1 = os.path.join(job.dir, job.specs[1]['file']) if 1 in job.specs else None
    if spec['n'] != 1 and s1 and os.path.exists(s1):
        raw1 = job.st(1).get('from_raw')     # the model's own full-resolution drawing is the better reference
        imgs.append(load_rgb(os.path.join(job.dir, raw1) if raw1 and os.path.exists(os.path.join(job.dir, raw1)) else s1))
        desc.append('Image %d = %s\'s APPROVED DESIGN SHEET: this is exactly how %s looks. Same person, same outfit, same colours, same proportions '
                    'and the same pixel size in every pose.' % (len(imgs), job.char['name'], job.char['name']))
    return imgs, '\n'.join(desc)


def HERE_REF():
    return HERO_REF


PITCH_OVERRIDE = {}


def gen_size(spec):
    gr, gc = spec['gen_grid']
    w, h = gc * spec['cell'][0], gr * spec['cell'][1]
    p = PITCH_OVERRIDE.get(spec['n']) or pick_pitch(w, h)
    W, H = (w * p + 15) // 16 * 16, (h * p + 15) // 16 * 16
    return p, W, H


def run_comp_sheet(job, n, quality, force=False, extra='', tag_suffix=''):
    spec = job.specs[n]
    st = job.st(n)
    out = os.path.join(job.dir, spec['file'])
    if os.path.exists(out) and not force:
        job.log('sheet %d: %s exists (resume: skipped; --force to redraw)' % (n, spec['file']))
        return out
    if attempt_count(job, n) >= MAX_ATTEMPTS and not force:
        job.log('sheet %d: %d attempts used; stop' % (n, MAX_ATTEMPTS))
        return None
    p, W, H = gen_size(spec)
    imgs, desc = comp_refs(job, spec, p, quality)
    prompt = comp_prompt(job.char, spec, p, W, H, desc, extra)
    k = len(st['attempts']) + 1
    base = os.path.join(job.raw, 's%d_a%d%s' % (n, k, tag_suffix))
    open(base + '_prompt.txt', 'w', encoding='utf-8').write(prompt)
    if os.path.exists(base + '.png'):
        job.log('sheet %d attempt %d: raw image already saved, reusing it' % (n, k))
    else:
        job.log('sheet %d attempt %d: generating %dx%d (pitch %d, quality %s, %d refs)' % (n, k, W, H, p, quality, len(imgs)))
        png, info = gen_api.generate(prompt, imgs, size='%dx%d' % (W, H), quality=quality, background='opaque',
                                     tag='%s_%s_s%d_a%d%s' % (job.kind, job.id, n, k, tag_suffix))
        open(base + '.png', 'wb').write(png)
        st.setdefault('usage', []).append(info.get('tool_usage'))
    st['attempts'].append(dict(raw=os.path.relpath(base + '.png', job.dir), quality=quality, t=time.strftime('%Y-%m-%dT%H:%M:%S')))
    job.save()
    return finish_comp_sheet(job, n, base + '.png')


def finish_comp_sheet(job, n, raw_path):
    spec = job.specs[n]
    raw = load_rgb(raw_path)
    sheet, frames, notes, s = normalize_full(raw, spec, job.log)
    out = os.path.join(job.dir, spec['file'])
    sheet.save(out, optimize=True)
    st = job.st(n)
    st.update(frames=frames, notes=notes, pitch=round(s, 3), from_raw=os.path.relpath(raw_path, job.dir))
    job.save()
    job.write_manifest()
    for m in notes:
        job.log('  note: ' + m)
    job.log('sheet %d -> %s (%d poses)' % (n, os.path.relpath(out, DESIGN), len(frames)))
    return out


# ----------------------------------------------------------------------------------------------- cell edits
def cell_rect_dots(spec, r, c):
    cw, ch = spec['cell']
    return (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)


def choose_window(spec, targets):
    """rows / cols of the sheet region sent for an edit: the rows holding the targets (plus a neighbour row when a
    single row would be too wide), all columns unless too wide; always with at least one untouched upright pose."""
    rows = sorted({r for r, c in targets})
    r0, r1 = rows[0], rows[-1]
    c0, c1 = 0, spec['cols'] - 1
    cw, ch = spec['cell']

    def aspect():
        return ((c1 - c0 + 1) * cw) / float((r1 - r0 + 1) * ch)
    while aspect() > MAX_ASPECT and (r1 - r0 + 1) < spec['rows']:
        if r1 + 1 < spec['rows']:
            r1 += 1
        else:
            r0 -= 1
    tc = [c for r, c in targets]
    while aspect() > MAX_ASPECT:
        if c1 > max(tc) and (c1 - max(tc) >= min(tc) - c0):
            c1 -= 1
        elif c0 < min(tc):
            c0 += 1
        elif c1 > max(tc):
            c1 -= 1
        else:
            return None, None          # the targets are too far apart for one image: edit them one by one
    refs = [(r, c) for r in range(r0, r1 + 1) for c in range(c0, c1 + 1) if (r, c) not in targets]
    return (r0, r1, c0, c1), refs


def edit_cells(job, n, sheet_path, items, quality, attempt_tag):
    """items: [dict(slot, code, ask, msg, scale?)] of one sheet -> edits the sheet file in place (after a backup)"""
    spec = job.specs[n]
    sheet = load_rgb(sheet_path)
    dots = sheet_dots(sheet)
    pos = {sid: (r, c) for r, row in enumerate(spec['ids']) for c, sid in enumerate(row) if sid}
    targets = {}
    for it in items:
        if it['slot'] in pos:
            targets[pos[it['slot']]] = it
    if not targets:
        return False
    win_rc, refs = choose_window(spec, set(targets))
    if win_rc is None:
        ok = False
        for k, it in enumerate(items):
            ok = edit_cells(job, n, sheet_path, [it], quality, '%s%s' % (attempt_tag, 'abcdefgh'[k])) or ok
        return ok
    (r0, r1, c0, c1) = win_rc
    cw, ch = spec['cell']
    win = (c0 * cw, r0 * ch, (c1 + 1) * cw, (r1 + 1) * ch)
    wd = dots.crop(win)
    # pre-scale the poses with a scale problem (the model then redraws them at the size it is given)
    for (r, c), it in targets.items():
        k = it.get('prescale')
        if not k:
            continue
        rc = cell_rect_dots(spec, r, c)
        loc = (rc[0] - win[0], rc[1] - win[1], rc[2] - win[0], rc[3] - win[1])
        cell = wd.crop(loc)
        bb = cell.getbbox()
        if not bb:
            continue
        sp = cell.crop(bb)
        big = sp.resize((sp.size[0] * 8, sp.size[1] * 8), Image.NEAREST)
        nw, nh = max(1, int(round(sp.size[0] * k))), max(1, int(round(sp.size[1] * k)))
        small = big.resize((nw * 8, nh * 8), Image.BOX)
        # hard alpha
        a = small.split()[3].point(lambda v: 255 if v >= 128 else 0)
        small.putalpha(a)
        blank = Image.new('RGBA', cell.size, (0, 0, 0, 0))
        wd.paste(blank, loc[:2])
        cx = (bb[0] + bb[2]) / 2.0
        bottom = bb[3]
        tmp = Image.new('RGBA', (cell.size[0] * 8, cell.size[1] * 8), (0, 0, 0, 0))
        tmp.alpha_composite(small, (int(round(cx * 8 - small.size[0] / 2)), max(0, bottom * 8 - small.size[1])))
        it['_prescaled_hi'] = (loc, tmp)
    p = pick_pitch(wd.size[0], wd.size[1])
    img = render_pitch(wd, p)
    for (r, c), it in targets.items():
        if '_prescaled_hi' in it:
            loc, tmp = it.pop('_prescaled_hi')
            hi = Image.new('RGB', tmp.size, MAGENTA)
            hi.paste(tmp, (0, 0), tmp)
            hi = hi.resize(((loc[2] - loc[0]) * p, (loc[3] - loc[1]) * p), Image.NEAREST if p == 8 else Image.BOX)
            img.paste(hi, (loc[0] * p, loc[1] * p))
    W, H = img.size
    names = {}
    for (r, c), it in targets.items():
        k = (r - r0) * (c1 - c0 + 1) + (c - c0) + 1
        names[(r, c)] = k
    lines = []
    for (r, c), it in sorted(targets.items()):
        k = names[(r, c)]
        sid = spec['ids'][r][c]
        what = POSE_EN.get(sid, sid)
        fix = it.get('en') or ''
        lines.append('- Frame %d (row %d, column %d of this image; pose: %s). %s Problem as reported (Japanese): %s' % (
            k, r - r0 + 1, c - c0 + 1, what, fix, it.get('ask') or it.get('msg')))
    keep = ', '.join(str((r - r0) * (c1 - c0 + 1) + (c - c0) + 1) for r, c in refs)
    rows_desc = []
    for r in range(r0, r1 + 1):
        f = spec['face'][r] if r < len(spec['face']) else None
        rows_desc.append('row %d = %s' % (r - r0 + 1, ', '.join(POSE_EN.get(spec['ids'][r][c], str(spec['ids'][r][c])) for c in range(c0, c1 + 1))))
    who = job.char['name'] if job.char else 'the hero Arun'
    prompt = '\n'.join([
        style_block(), '',
        'TASK: EDIT the attached sprite sheet (image 1). It is a %d-row x %d-column grid of poses of %s; every art pixel is exactly %dx%d image px. '
        'Output the same %dx%d canvas with the same grid, the same pixel size, the same character, outfit, colours and palette, and the same feet line per row.'
        % (r1 - r0 + 1, c1 - c0 + 1, who, p, p, W, H),
        'Frames are numbered in reading order. ' + '; '.join(rows_desc) + '.',
        'Redraw ONLY these frames:', *lines,
        'Keep frames %s exactly as they are (pixel-identical).' % (keep or 'the others'),
        'Each redrawn pose stays inside its own cell, same body scale (same head size) as the untouched frames. Solid #FF00FF background, no text, no effects.',
    ] + (['Image 2 = the hero\'s design sheet for reference (quality bar only).'] if job.kind == 'arun' else []))
    base = os.path.join(job.raw, 's%d_%s' % (n, attempt_tag))
    img.save(base + '_in.png')
    open(base + '_prompt.txt', 'w', encoding='utf-8').write(prompt)
    if os.path.exists(base + '.png'):
        job.log('sheet %d %s: reusing saved raw' % (n, attempt_tag))
    else:
        refs_img = [img] + ([load_rgb(HERO_REF)] if job.kind == 'arun' else [])
        job.log('sheet %d %s: edit %s (window rows %d-%d cols %d-%d, %dx%d, pitch %d, quality %s)' % (
            n, attempt_tag, ','.join(spec['ids'][r][c] for r, c in sorted(targets)), r0 + 1, r1 + 1, c0 + 1, c1 + 1, W, H, p, quality))
        png, info = gen_api.generate(prompt, refs_img, size='%dx%d' % (W, H), quality=quality, background='opaque',
                                     tag='%s_%s_s%d_%s' % (job.kind, job.id, n, attempt_tag))
        open(base + '.png', 'wb').write(png)
    raw = load_rgb(base + '.png')
    if raw.size != (W, H):
        raw = raw.resize((W, H), Image.LANCZOS)
    mask = key_mask(raw)
    # calibrate the pitch on the untouched upright poses
    ratios = []
    for r, c in refs:
        sid = spec['ids'][r][c]
        if sid is None or sid in spec['air']:
            continue
        rc = cell_rect_dots(spec, r, c)
        ob = dots.crop(rc).getbbox()
        if not ob:
            continue
        box = ((rc[0] - win[0]) * p, (rc[1] - win[1]) * p, (rc[2] - win[0]) * p, (rc[3] - win[1]) * p)
        nb = tight_box(mask, box)
        if not nb:
            continue
        ratios.append((nb[3] - nb[1]) / float(ob[3] - ob[1]))
    ratios.sort()
    s = ratios[len(ratios) // 2] if ratios else float(p)
    job.log('  calibrated pitch %.2f px (requested %d; %d reference poses)' % (s, p, len(ratios)))
    backup = os.path.join(job.raw, os.path.basename(sheet_path).replace('.png', '_before_%s.png' % attempt_tag))
    if not os.path.exists(backup):
        shutil.copy(sheet_path, backup)
    news = []
    for (r, c), it in targets.items():
        rc = cell_rect_dots(spec, r, c)
        box = ((rc[0] - win[0]) * p, (rc[1] - win[1]) * p, (rc[2] - win[0]) * p, (rc[3] - win[1]) * p)
        parts = [pt for pt in components(mask.crop(box), f=4, min_area_px=int((1.5 * s) ** 2))]
        if not parts:
            job.log('  %s: nothing drawn in the cell' % spec['ids'][r][c])
            continue
        main = max(parts, key=lambda q: q['area'])
        keep_p = [q for q in parts if q['area'] >= 0.02 * main['area'] or _near(q['box'], main['box'], 3 * s)]
        ub = union_box([q['box'] for q in keep_p])
        ub = (box[0] + ub[0], box[1] + ub[1], box[0] + ub[2], box[1] + ub[3])
        tb = tight_box(mask, ub)
        pad = int(2 * s)
        pb = (max(0, tb[0] - pad), max(0, tb[1] - pad), min(W, tb[2] + pad), min(H, tb[3] + pad))
        sp = sample_dots(raw, mask, pb, s)
        if sp is None:
            continue
        ob = dots.crop(rc).getbbox() or (0, 0, rc[2] - rc[0], rc[3] - rc[1])
        news.append((r, c, sp, (ob[0] + ob[2]) / 2.0, ob[3]))
    # a redrawn pose taller than the room above its feet: give every cell of the sheet more room on top
    need = max([sp.size[1] - min(bottom, spec['cell'][1] - 2) + 1 for r, c, sp, cx, bottom in news] + [0])
    new_dots = dots
    if need > 0:
        dg = (need + 7) // 8 * 8
        new_dots = grow_cells(dots, spec, dg)
        news = [(r, c, sp, cx, bottom + dg) for r, c, sp, cx, bottom in news]
        persist_cell(job, n, spec)
        job.log('  cells grown by %d art px on top (now %dx%d) so the pose fits' % (dg, spec['cell'][0], spec['cell'][1]))
    new_dots = new_dots.copy()
    done = []
    for r, c, sp, cx, bottom in news:
        rc = cell_rect_dots(spec, r, c)
        blank = Image.new('RGBA', (rc[2] - rc[0], rc[3] - rc[1]), (0, 0, 0, 0))
        w, h = sp.size
        x = max(0, min(blank.size[0] - w, int(round(cx - w / 2.0))))
        y = max(0, min(blank.size[1] - 2 - h, bottom - h))      # keep 2 art px off the cell bottom (the pipeline's edge check)
        blank.alpha_composite(sp, (x, y))
        new_dots.paste(blank, rc[:2])
        done.append('%s %dx%d' % (spec['ids'][r][c], w, h))
    to_sheet(new_dots).save(sheet_path, optimize=True)
    job.log('  pasted: ' + ', '.join(done))
    return True


def grow_cells(dots, spec, dg):
    """every cell dg art px taller, the extra room on top (feet keep their distance to the cell bottom)"""
    cw, ch = spec['cell']
    out = Image.new('RGBA', (spec['cols'] * cw, spec['rows'] * (ch + dg)), (0, 0, 0, 0))
    for r in range(spec['rows']):
        out.paste(dots.crop((0, r * ch, spec['cols'] * cw, (r + 1) * ch)), (0, r * (ch + dg) + dg))
    spec['cell'] = [cw, ch + dg]
    return out


def persist_cell(job, n, spec):
    job.st(n)['cell'] = list(spec['cell'])
    job.save()
    mp = os.path.join(job.dir, 'manifest.json')
    if os.path.exists(mp):
        man = json.load(open(mp))
        for e in man:
            if e.get('sheet') == n:
                e['logical_cell'] = list(spec['cell'])
                e['image_px'] = [spec['cols'] * spec['cell'][0] * DOT, spec['rows'] * spec['cell'][1] * DOT]
        json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)


# ----------------------------------------------------------------------------------------------- pipeline
def run_pipeline(args_list, log):
    cmd = [sys.executable, os.path.join(TOOLS, 'sheets.py')] + args_list
    log('pipeline: sheets.py ' + ' '.join(os.path.relpath(a, PIPE) if a.startswith('/') else a for a in args_list))
    r = subprocess.run(cmd, cwd=PIPE, capture_output=True, text=True)
    tail = (r.stdout + r.stderr).strip().splitlines()[-6:]
    for t in tail:
        log('  | ' + t)
    return r.returncode


def redo_items(report_json):
    js = json.load(open(report_json, encoding='utf-8'))
    out = []
    for it in js.get('items', []):
        if it.get('level') != 'redo':
            continue
        out.append(dict(sheet=it['sheet'], code=it.get('code'), slot=it.get('slot'), msg=it.get('msg'), ask=it.get('ask'),
                        data=it.get('data') or {}))
    return out


def enrich(items, spec_face):
    """English help + pre-scale per redo item"""
    for it in items:
        code = it['code'] or ''
        if code.startswith('lantern'):
            it['en'] = ('The brass lantern must be in the character\'s LEFT hand: in the front view it hangs on the IMAGE-RIGHT side of the body, '
                        'in the back view on the IMAGE-LEFT side, exactly like the standing frame of the same row. The other arm swings empty, '
                        'the sword stays sheathed at the hip, the legs keep this walking step.')
        elif code == 'scale':
            sc = it['data'].get('scale')
            if sc:
                it['prescale'] = 1.0 / sc
            it['en'] = ('This pose was drawn at the wrong scale and has already been resized to the correct size in the attached image, so it looks '
                        'soft/blocky. Redraw it as clean crisp pixel art at EXACTLY this size and position (same silhouette, same pose, same head '
                        'size as it is now), with proper outline, hue-shifted shading and highlights like the untouched frames.')
        elif code in ('facing', 'facing_row'):
            it['en'] = 'The pose faces the wrong way. Redraw it facing the correct direction (battle poses face LEFT).'
        elif code in ('height',):
            it['en'] = 'The pose has the wrong height. Redraw it with the same body height as the upright poses of the same row.'
    return items


def fix_loop(job, n_items, quality, pipe_args, report, max_rounds=MAX_ATTEMPTS, only=None):
    """n_items: {sheet: [items]} -> edits until the pipeline has no redo line for those sheets or attempts run out"""
    left = n_items
    for rnd in range(1, max_rounds + 1):
        if not n_items:
            job.log('no redo lines left' if not left else 'redo lines left but no edit rounds left for them: %s' % ' '.join(map(str, left)))
            return not left
        for n, items in sorted(n_items.items()):
            st = job.st(n)
            used = st.get('edit_rounds', 0)
            if used >= MAX_ATTEMPTS:
                job.log('sheet %s: %d edit rounds used; leave it for a person' % (n, used))
                continue
            enrich(items, None)
            path = os.path.join(job.dir, job.specs[n]['file'])
            edit_cells(job, n, path, items, quality, 'fix%d' % (used + 1))
            st['edit_rounds'] = used + 1
            st.setdefault('fixed_slots', []).extend(sorted({i['slot'] for i in items if i.get('slot')}))
            job.save()
        run_pipeline(pipe_args + ['--check'], job.log)
        left = {}
        for it in redo_items(report):
            if it['slot'] and it['sheet'] in job.specs and (not only or it['sheet'] in only):
                left.setdefault(it['sheet'], []).append(it)
        job.log('round %d: %d redo lines left %s' % (rnd, sum(len(v) for v in left.values()),
                                                    ' '.join('%s:%s' % (k, ','.join(sorted({i["slot"] for i in v}))) for k, v in left.items())))
        n_items = {k: v for k, v in left.items() if job.st(k).get('edit_rounds', 0) < MAX_ATTEMPTS}
        if not left:
            return True
    return False


# ----------------------------------------------------------------------------------------------- commands
def cmd_arun_fix(a):
    specs = arun_specs()
    job = Job('arun', 'arun', specs)
    # the working folder: the delivered sheets + manifest (only copied the first time: the edits live here)
    for n, s in specs.items():
        dst = os.path.join(job.dir, s['file'])
        if not os.path.exists(dst):
            shutil.copy(os.path.join(ARUN_SHEETS, s['file']), dst)
    if not os.path.exists(os.path.join(job.dir, 'manifest.json')):
        shutil.copy(os.path.join(ARUN_SHEETS, 'manifest.json'), os.path.join(job.dir, 'manifest.json'))
    out = os.path.join(PIPE, 'out', a.out)
    pipe_args = [job.dir, '--char', 'arun', '--out', out]
    report = os.path.join(out, 'report.json')
    src_report = a.report or os.path.join(PIPE, 'out', 'arun_v1', 'report.json')
    if job.state.get('started') and not a.report:
        run_pipeline(pipe_args + ['--check'], job.log)     # resume: check the working folder as it is now
        src_report = report
    job.state['started'] = True
    job.save()
    items = {}
    for it in redo_items(src_report):
        if it['slot'] and (not a.sheets or it['sheet'] in a.sheets):
            items.setdefault(it['sheet'], []).append(it)
    job.log('arun-fix: %d redo lines from %s' % (sum(len(v) for v in items.values()), os.path.relpath(src_report, PIPE)))
    ok = fix_loop(job, items, a.quality, pipe_args, report, only=a.sheets)
    run_pipeline(pipe_args, job.log)
    # manifest: refresh the edited sheets' frame boxes is not needed (cells unchanged); keep the delivered one
    job.log('done (%s). pipeline output: %s' % ('clean' if ok else 'redo lines remain', os.path.relpath(out, PIPE)))


NOLANTERN_EN = {
    1: 'walking (4 rows: toward the viewer, away from the viewer, facing left, facing right; 3 frames each: stand, one foot forward, the other foot forward)',
    2: 'running (4 rows: toward the viewer, away, left, right; 4 frames each: right foot lands, both feet off the ground, left foot lands, both feet off the ground)',
}


def cmd_arun_alt(a):
    """Arun's field sheets without the lantern (the engine draws the lantern itself when he leads the party):
    edits of the delivered (redo-fixed) sheets 1 / 2 -> gen/arun/arun_nolantern/arun_sheet_0<N>b.png + a pipeline pass"""
    specs = arun_specs()
    job = Job('arun', 'arun_nolantern', {n: dict(specs[n], file='arun_sheet_%02db.png' % n) for n in (1, 2)})
    src_dir = os.path.join(GEN, 'arun', 'arun')
    for n in a.sheets:
        spec = job.specs[n]
        out = os.path.join(job.dir, spec['file'])
        if os.path.exists(out) and not a.force:
            job.log('sheet %db exists (resume: skipped)' % n)
            continue
        src = os.path.join(src_dir, specs[n]['file'])
        if not os.path.exists(src):
            src = os.path.join(ARUN_SHEETS, specs[n]['file'])
        sheet = load_rgb(src)
        W, H = sheet.size
        st = job.st(n)
        k = len(st['attempts']) + 1
        base = os.path.join(job.raw, 's%db_a%d' % (n, k))
        prompt = '\n'.join([
            style_block(), '',
            'TASK: EDIT the attached sprite sheet (image 1) of the young swordsman (the hero): %s. Every art pixel is exactly 8x8 image px. '
            'Output the same %dx%d canvas with the same grid, the same pixel size, the same character, outfit, colours, poses, feet lines and '
            'frame positions.' % (NOLANTERN_EN[n], W, H),
            'CHANGE ONLY THIS: REMOVE THE BRASS LANTERN from every frame. His LEFT hand is now EMPTY (a loosely closed fist), and that arm swings '
            'naturally with the walk/run exactly like the other arm does, mirrored in rhythm. Nothing is held in either hand; the sword stays sheathed '
            'at the hip. Fill the space where the lantern was with the body/clothes that were behind it, or the flat background.',
            'Keep everything else pixel-identical where possible: hair, red scarf, coat, boots, leg positions, body height (48 art px).',
            'Solid #FF00FF background, no lantern, no light, no glow, no text.',
        ])
        open(base + '_prompt.txt', 'w', encoding='utf-8').write(prompt)
        if not os.path.exists(base + '.png'):
            job.log('sheet %db attempt %d: edit %s (%dx%d, quality %s)' % (n, k, os.path.basename(src), W, H, a.quality))
            png, info = gen_api.generate(prompt, [sheet], size='%dx%d' % (W, H), quality=a.quality, background='opaque',
                                         tag='arun_nolantern_s%d_a%d' % (n, k))
            open(base + '.png', 'wb').write(png)
        st['attempts'].append(dict(raw=os.path.relpath(base + '.png', job.dir), quality=a.quality, t=time.strftime('%Y-%m-%dT%H:%M:%S')))
        job.save()
        raw = load_rgb(base + '.png')
        if raw.size != (W, H):
            raw = raw.resize((W, H), Image.LANCZOS)
        img, frames, notes, s = normalize_full(raw, spec, job.log)
        img.save(out, optimize=True)
        st.update(frames=frames, notes=notes, pitch=round(s, 3), from_raw=os.path.relpath(base + '.png', job.dir))
        job.save()
        job.write_manifest()
        for m in notes:
            job.log('  note: ' + m)
        job.log('sheet %db -> %s' % (n, os.path.relpath(out, DESIGN)))
    outp = os.path.join(PIPE, 'out', a.out)
    run_pipeline([job.dir, '--char', 'arun', '--only', ','.join(str(n) for n in sorted(job.specs)), '--out', outp], job.log)
    job.log('pipeline output: %s (field set = walk_* / run_* without the lantern)' % os.path.relpath(outp, PIPE))


def cmd_companion(a):
    js, c, specs = comp_specs(a.id)
    job = Job('companion', a.id, specs, char=c)
    out = os.path.join(PIPE, 'out', 'comp_%s' % a.id)
    pipe_args = [job.dir, '--companion', a.id, '--out', out]
    sheets = a.sheets or sorted(specs)
    if a.pitch:
        for n in sheets:
            PITCH_OVERRIDE[n] = a.pitch
    for n in sheets:
        if n != 1 and not os.path.exists(os.path.join(job.dir, specs[1]['file'])):
            job.log('sheet 1 (design) is not there yet: make and approve it first')
            return
        run_comp_sheet(job, n, a.quality, force=a.force, extra=a.extra or '', tag_suffix=a.tag or '')
    if a.fix:
        run_pipeline(pipe_args + ['--check'], job.log)
        report = os.path.join(out, 'report.json')
        items = {}
        whole = []
        for it in redo_items(report):
            if it['sheet'] not in specs:
                continue
            if it['code'] in ('missing_sheet',) or not it['slot']:
                whole.append(it)
            else:
                items.setdefault(it['sheet'], []).append(it)
        for it in whole:
            job.log('sheet-level redo (needs a full redraw): %s' % it['msg'])
        # many bad cells in one sheet: redraw the sheet instead of patching
        for n in list(items):
            if len({i['slot'] for i in items[n]}) >= max(4, len([x for r in specs[n]['ids'] for x in r if x]) // 2):
                bad = items.pop(n)
                job.log('sheet %d: %d bad cells -> full redraw' % (n, len(bad)))
                run_comp_sheet(job, n, a.quality, force=True,
                               extra='Previous attempt problems (fix them): ' + ' / '.join(i['ask'] or i['msg'] for i in bad))
        fix_loop(job, items, a.quality, pipe_args, report)
    if a.pack:
        run_pipeline(pipe_args, job.log)


def cmd_prompt(a):
    js, c, specs = comp_specs(a.id)
    job = Job('companion', a.id, specs, char=c)
    spec = specs[a.sheet]
    p, W, H = gen_size(spec)
    imgs, desc = comp_refs(job, spec, p, 'medium')
    print(comp_prompt(c, spec, p, W, H, desc))
    print('\n[size %dx%d, pitch %d, %d reference images]' % (W, H, p, len(imgs)))
    if a.save_refs:
        for i, im in enumerate(imgs):
            im.save(os.path.join(a.save_refs, 'ref%d.png' % (i + 1)))


def cmd_normalize(a):
    js, c, specs = comp_specs(a.id)
    job = Job('companion', a.id, specs, char=c)
    finish_comp_sheet(job, a.sheet, a.raw)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('arun-fix')
    s.add_argument('--report', default=None)
    s.add_argument('--out', default='arun_v2')
    s.add_argument('--sheets', type=lambda t: [int(x) for x in t.split(',')], default=None)
    s.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'])
    s = sub.add_parser('companion')
    s.add_argument('id')
    s.add_argument('--sheets', type=lambda t: [int(x) for x in t.split(',')], default=None)
    s.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'])
    s.add_argument('--force', action='store_true')
    s.add_argument('--fix', action='store_true', help='run the pipeline check and redraw the redo cells')
    s.add_argument('--pack', action='store_true', help='run the full pipeline at the end')
    s.add_argument('--extra', default='', help='extra instruction appended to the prompt')
    s.add_argument('--tag', default='', help='suffix for the raw file name (quality comparisons)')
    s.add_argument('--pitch', type=int, default=None, help='image px per art pixel of the request (the model draws finer '
                   'than asked on small figures: a smaller canvas brings its pixels onto the grid)')
    s = sub.add_parser('arun-alt', help="Arun's field sheets 1 / 2 without the lantern (arun_sheet_01b / 02b)")
    s.add_argument('--sheets', type=lambda t: [int(x) for x in t.split(',')], default=[1, 2])
    s.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'])
    s.add_argument('--force', action='store_true')
    s.add_argument('--out', default='arun_v2_nolantern')
    s = sub.add_parser('prompt')
    s.add_argument('kind', choices=['companion'])
    s.add_argument('id')
    s.add_argument('sheet', type=int)
    s.add_argument('--save-refs', default=None)
    s = sub.add_parser('normalize')
    s.add_argument('raw')
    s.add_argument('kind', choices=['companion'])
    s.add_argument('id')
    s.add_argument('sheet', type=int)
    a = ap.parse_args()
    try:
        {'arun-fix': cmd_arun_fix, 'arun-alt': cmd_arun_alt, 'companion': cmd_companion, 'prompt': cmd_prompt, 'normalize': cmd_normalize}[a.cmd](a)
    except gen_api.GenError as e:
        print('STOP: %s' % e)
        sys.exit(2)


if __name__ == '__main__':
    main()
