#!/usr/bin/env python3
"""Monster battle art: generate the sheets of design/art_ref/MONSTER_REQUEST.md with the image API, normalise every
monster to clean art pixels and export it for v2 (v2/assets/monsters/<sprite>.png + .json).

Needs python3 + numpy + scipy + Pillow. API settings come from the environment (tools/gen_api.py):
  set -a; . <owner's env file>; set +a        # OPENAI_API_KEY, OPENAI_MODEL, OPENAI_USAGE_LOG
  MON_IMAGE_CAP     images for this task (tag mon_*, counted from the usage log; default 350)
  MON_STYLE_HINT    optional one-line style hint put at the top of the live prompt (never written to any file)

Commands (run anywhere):
  python3 tools/mon_pack.py gen 1 2 3                 # generate sheets (skips sheets that already have a raw) -> normalise -> export
  python3 tools/mon_pack.py gen 3 --redo "cell 2 faced left"   # a new attempt with notes
  python3 tools/mon_pack.py norm 3 [--raw <png>]      # re-normalise the chosen raw (default: state.json 'use' or the newest)
  python3 tools/mon_pack.py variant boss_pageeater tele "prompt…"   # boss pose / phase graphic as an EDIT of the base raw
  python3 tools/mon_pack.py cellredo 3 2 "notes"      # redraw one monster alone (single-cell image), pasted as that cell
  python3 tools/mon_pack.py check                     # checks over v2/assets/monsters (facing flag, tier size, strays, colours)
  python3 tools/mon_pack.py contact 1-9 --out x.png   # contact sheet of the exported monsters (x3, with the hero for scale)
  python3 tools/mon_pack.py prompt 3                  # print the prompt (no call)

Files: design/art_ref/gen/mon/s<NN>/raw/ (raw images + prompts, gitignored), s<NN>/state.json, s<NN>/review.png;
v2/assets/monsters/<sprite>.png (tight crop, 1 art px = 1 px, transparent) + <sprite>.json:
  {sprite, id, name, sheet, cell, size, tier, fly, w, h, anchor:[x,y] (draw point = feet centre; flyers: below the body),
   points:{head, center, fx, top, …} (image px), long, colors, alsoMakes, variants, pose?}
Boss poses / phases: <sprite>@<pose>.png + .json, aligned to the base (same anchor meaning).
"""
import argparse
import glob
import json
import math
import os
import re
import sys
import time

import numpy as np
from PIL import Image
from scipy import ndimage

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
import gen_api  # noqa: E402
import gen_sheets as G  # noqa: E402

PIPE = os.path.dirname(TOOLS)
DESIGN = os.path.dirname(PIPE)
CHRON = os.path.dirname(DESIGN)
ART = os.path.join(DESIGN, 'art_ref')
REQ = os.path.join(ART, 'MONSTER_REQUEST.md')
SPEC = os.path.join(ART, 'monster_sheets.json')
GEN = os.path.join(ART, 'gen', 'mon')
V2 = os.path.join(CHRON, 'v2')
OUT = os.path.join(V2, 'assets', 'monsters')
SPRITES = os.path.join(V2, 'assets', 'sprites')
OVR = os.path.join(PIPE, 'configs', 'mon_overrides.json')
MAGENTA = (255, 0, 255)

gen_api.OWN_TAGS = ('mon_',)      # this task's cap counts only its own images


def cap():
    try:
        return int(os.environ.get('MON_IMAGE_CAP') or 350)
    except ValueError:
        return 350


# ------------------------------------------------------------------------------------------ spec / text
def spec():
    return json.load(open(SPEC, encoding='utf-8'))


def sheet(n):
    return next(s for s in spec()['sheets'] if s['sheet'] == n)


def brief_section(n):
    t = open(REQ, encoding='utf-8').read()
    m = re.search(r'^#### シート%d .*$' % n, t, re.M)
    rest = t[m.end():]
    e = re.search(r'^#{2,4} ', rest, re.M)
    return (m.group(0) + rest[:e.start()]).strip()


def common_rules():
    return G.md_section(REQ, r'2\. 全シート共通の決まり', level=2)


def cell_rects(s, W, H):
    """[(x0, y0, x1, y1)] of the cells in reading order, in raw image px"""
    cols, rows = s['grid']
    out = []
    for r in range(rows):
        for c in range(cols):
            out.append((W * c // cols, H * r // rows, W * (c + 1) // cols, H * (r + 1) // rows))
    return out


CELL_EN = {(2, 2): ['top-left', 'top-right', 'bottom-left', 'bottom-right'], (2, 1): ['left half', 'right half'], (1, 1): ['the whole image']}

STYLE_EN = """STYLE: premium modern hi-bit 2D pixel-art RPG battle sprites (the "HD pixel art" JRPG look), hand-placed pixels, the same quality as the attached party sprites.
- Real pixel art: every art pixel is a crisp square of the SAME size across the whole image (the size given below). No anti-aliasing, no blur, no gradients, no soft brushes, no noise or paper texture, no semi-transparency, no dithering.
- A 1-art-pixel dark outline around each monster, never pure black: a near-black purple/brown mixed with the darkest shade of the local material. Interior lines only between big parts.
- Shading: neutral white key light from the upper front. Each material 4-6 flat shade steps. Hue-shifted shading: shadows shift toward red-purple / blue-purple and get MORE saturated (green leaves shade to red-purple, grey fur to blue-purple), highlights shift toward yellow. Never grey or black shadows. Calm, earthy overall saturation; at most one vivid focal point (eye / core) where the brief says.
- 32-48 colours per monster. Read as a few big light/dark masses, not fine noise. Eyes get a 1-art-pixel white catch-light.
- Weighty, solid creatures (not chibi), same world and finish as the party. Paint at normal daylight brightness (the game adds the night).
- Idle battle stance, ready to pounce; limbs, wings and tails held a little away from the body so the silhouette reads.
- FACING: every monster faces RIGHT (toward the heroes on the right), three-quarter side view turned slightly toward the viewer. Face, eyes, mouth, claws, stingers, horn tips all point RIGHT. Never front view, never back view, never facing left.
- Each monster is ONE connected shape: no detached floating bits (drops, sparks, paper scraps, crowns floating above).
- Background: one flat solid magenta #FF00FF everywhere. NO text, labels, numbers, names, frames, grid lines, ground, floor shadows, water, glow, aura, smoke, breath, magic light, sparkles, motion lines, rim light."""


def party_ref(p, flip=True):
    """the party's idle battle frames at p image px per art px on magenta (mirrored to face right)"""
    looks = ['hero_m_warrior', 'bartolo', 'marta', 'sylvain']
    ims = []
    for lk in looks:
        mp = os.path.join(SPRITES, lk, 'battle.json')
        if not os.path.exists(mp):
            continue
        m = json.load(open(mp))
        fr = m['frames'][0] if isinstance(m['frames'], list) else list(m['frames'].values())[0]
        im = Image.open(os.path.join(SPRITES, lk, 'battle.png')).convert('RGBA').crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h']))
        bb = im.getbbox()
        im = im.crop(bb)
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        ims.append(im)
    gap = 8
    W = sum(i.width for i in ims) + gap * (len(ims) + 1)
    H = max(i.height for i in ims) + 2 * gap
    base = Image.new('RGBA', (W, H), MAGENTA + (255,))
    x = gap
    for i in ims:
        base.alpha_composite(i, (x, H - gap - i.height))
        x += i.width + gap
    return base.convert('RGB').resize((W * p, H * p), Image.NEAREST)


def sheet_prompt(n, extra=''):
    s = sheet(n)
    W, H = s['canvas']
    p = s['pxPerDot']
    cols, rows = s['grid']
    names = CELL_EN.get((cols, rows), ['cell %d' % (i + 1) for i in range(cols * rows)])
    lines = []
    for c in s['cells']:
        td = c['targetDots']
        pos = names[c['cell'] - 1]
        where = ('FLYING: floats at the vertical middle of its cell' if c.get('flying') else
                 'stands on the ground: its lowest pixel about 6 art px above the bottom edge of its cell')
        lines.append('- %s: %s (id %s) — about %d art px wide x %d art px tall (= %dx%d image px); its longer side about %d art px. %s.'
                     % (pos, c['name'], c['id'], td['w'], td['h'], td['w'] * p, td['h'] * p, td['long'], where))
    empty = ''
    if len(s['cells']) < cols * rows:
        empty = 'Cells without a monster stay completely empty magenta.'
    if s['class'] == 'B':
        layout = ('ONE monster only, centred in the image, at least 8 art px (%d image px) from every edge.' % (8 * p))
    else:
        layout = ('The image is an invisible grid of %d column(s) x %d row(s) (cells of %dx%d image px = %dx%d art px); ONE monster centred in each cell, '
                  'never crossing into a neighbour cell; at least 12 art px between monsters. All monsters of this sheet share the same size class. %s'
                  % (cols, rows, W // cols, H // rows, W // cols // p, H // rows // p, empty))
    head = (os.environ.get('MON_STYLE_HINT', '').strip() + '\n\n') if os.environ.get('MON_STYLE_HINT') else ''
    txt = [head + STYLE_EN, '',
           'You are the pixel artist of a 2D fantasy RPG set in an endless night. Draw ONE monster sheet: sheet %d of the brief.' % n, '',
           'ATTACHED IMAGE: the player\'s party (battle idle), drawn at EXACTLY the pixel size of this sheet (1 art pixel = %dx%d image px) and '
           'shown mirrored. Match their pixel density, outline and shading language and finish. The heroes are about 64 art px tall; use them to judge '
           'the monster sizes below. Do not copy them into the sheet.' % (p, p), '',
           'CANVAS: %dx%d px, flat #FF00FF. One art pixel = %dx%d image px for every monster on the sheet. %s' % (W, H, p, p, layout), '',
           'MONSTERS:', *lines, '',
           'SHEET BRIEF (Japanese, authoritative for the design of each monster):', brief_section(n), '',
           'COMMON RULES (Japanese):', common_rules()]
    if extra:
        txt += ['', 'EXTRA INSTRUCTIONS FOR THIS ATTEMPT (most important):', extra]
    return '\n'.join(txt), (W, H)


# ------------------------------------------------------------------------------------------ state
def sdir(n):
    d = os.path.join(GEN, 's%02d' % n)
    os.makedirs(os.path.join(d, 'raw'), exist_ok=True)
    return d


def load_state(n):
    p = os.path.join(sdir(n), 'state.json')
    return json.load(open(p)) if os.path.exists(p) else {'attempts': []}


def save_state(n, st):
    json.dump(st, open(os.path.join(sdir(n), 'state.json'), 'w'), ensure_ascii=False, indent=1)


def call(prompt, refs, size, tag, quality='medium'):
    used = gen_api.images_used()
    if used + 1 > cap():
        raise gen_api.GenError('mon image cap reached (%d / %d)' % (used, cap()))
    os.environ['GEN_IMAGE_CAP'] = str(cap())
    png, info = gen_api.generate(prompt, refs, size='%dx%d' % size, quality=quality, background='opaque', tag=tag)
    return png, info


def clean_prompt(t):
    """the text saved next to raw images: without the live-only style hint"""
    h = os.environ.get('MON_STYLE_HINT', '').strip()
    return t.replace(h, '[style hint]') if h else t


def cmd_gen(a):
    for n in a.sheets:
        st = load_state(n)
        if st['attempts'] and not a.redo and not a.force:
            print('sheet %d: already has %d attempt(s); skip (use --redo / --force)' % (n, len(st['attempts'])))
            continue
        s = sheet(n)
        prompt, size = sheet_prompt(n, a.redo or '')
        k = len(st['attempts']) + 1
        base = os.path.join(sdir(n), 'raw', 'mon_s%02d_a%d' % (n, k))
        open(base + '_prompt.txt', 'w', encoding='utf-8').write(clean_prompt(prompt))
        q = a.quality or ('high' if (s['class'] == 'B' and a.high) else 'medium')
        t0 = time.time()
        try:
            png, info = call(prompt, [party_ref(s['pxPerDot'])], size, 'mon_s%02d_a%d' % (n, k), q)
        except gen_api.GenError as e:
            print('sheet %d: GEN ERROR %s' % (n, str(e)[:300]))
            if 'credit_balance' in str(e) or 'cap reached' in str(e) or 'insufficient_quota' in str(e):
                raise SystemExit(3)
            continue
        open(base + '.png', 'wb').write(png)
        st['attempts'].append({'file': os.path.basename(base) + '.png', 'notes': a.redo or '', 'quality': q, 'secs': round(time.time() - t0)})
        st['use'] = os.path.basename(base) + '.png'
        save_state(n, st)
        print('sheet %d: raw %s (%ds)' % (n, base + '.png', time.time() - t0), flush=True)
        normalise_sheet(n)


# ------------------------------------------------------------------------------------------ normalise
def fg_mask(img):
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # background = close to the sheet's own magenta (median of the border), not "any purple": purple monsters
    # (octopus, tentacle, ghosts) share the hue family of the key colour
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    ref = np.median(border, axis=0)
    d = np.abs(a - ref).sum(axis=2)
    mn = np.minimum(r, b)
    bg = ((mn - g) > 60) & (np.abs(r - b) < 90) & ((d < 200) | (g * 4 < mn))
    # pink fringe: strongly magenta-tinted light pixels next to the background
    return ~bg


def pieces(mask, s_img):
    """connected parts (8-conn) of the mask after closing small gaps (~1 art px)"""
    k = max(1, int(round(s_img * 0.6)))
    closed = ndimage.binary_closing(mask, structure=np.ones((3, 3)), iterations=k)
    lab, n = ndimage.label(closed, structure=np.ones((3, 3)))
    return lab, n


def normalise_cell(img, mask, rect, c, s, notes):
    """one cell of the raw image -> RGBA art pixels (tight) and info"""
    x0, y0, x1, y1 = rect
    m = mask[y0:y1, x0:x1]
    p_nom = s['pxPerDot'] * img.size[0] / s['canvas'][0]
    lab, n = pieces(m, p_nom)
    if n == 0:
        notes.append('%s: EMPTY cell' % c['sprite'])
        return None, {}
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    objs = ndimage.find_objects(lab)
    mb = objs[main - 1]
    keep = [main]
    dropped = []
    near = 3 * p_nom
    for i in range(1, n + 1):
        if i == main:
            continue
        sl = objs[i - 1]
        # distance between boxes
        dy = max(0, mb[0].start - sl[0].stop, sl[0].start - mb[0].stop)
        dx = max(0, mb[1].start - sl[1].stop, sl[1].start - mb[1].stop)
        if (sizes[i - 1] > 0.02 * sizes[main - 1] and max(dx, dy) < 2 * near) or (sizes[i - 1] > 4 * p_nom * p_nom and max(dx, dy) < near):
            keep.append(i)
        else:
            dropped.append(int(sizes[i - 1]))
    if dropped:
        notes.append('%s: dropped %d stray part(s) (%s px)' % (c['sprite'], len(dropped), ','.join(str(d) for d in dropped[:6])))
    km = np.isin(lab, keep) & m
    ys, xs = np.nonzero(km)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    edge = 2
    if bx0 < edge or by0 < edge or bx1 > m.shape[1] - edge or by1 > m.shape[0] - edge:
        notes.append('%s: touches the cell edge (may be cut)' % c['sprite'])
    # pitch
    td = c['targetDots']
    Lpx = max(bx1 - bx0, by1 - by0)
    W_, H_ = bx1 - bx0, by1 - by0
    long_axis_h = H_ >= W_
    crop = img.crop((x0 + bx0, y0 + by0, x0 + bx1, y0 + by1))
    cls = spec()['classes'][s['class']] if s['class'] in ('S', 'M', 'L') else None
    lo, hi = (cls['longSide'] if cls else (td['long'] * 0.92, td['long'] * 1.08))
    # size from the "core" (thin tails, whiskers, antennae and stingers opened away) so appendages do not shrink the body
    rad = max(1, int(round(p_nom * 2.2)))
    core = ndimage.binary_opening(km[by0:by1, bx0:bx1], structure=np.ones((3, 3)), iterations=rad)
    cy_, cx_ = np.nonzero(core)
    if len(cx_) > 50:
        cW, cH = cx_.max() - cx_.min() + 1, cy_.max() - cy_.min() + 1
    else:
        cW, cH = W_, H_
    s_use = max(cW, cH) / td['long']
    how = 'core %dx%d px -> %d art px' % (cW, cH, td['long'])
    # never let the whole sprite run far past the tier (long tails): cap at hi * 1.3
    if Lpx / s_use > hi * 1.3:
        s_use = Lpx / (hi * 1.3)
        how += ', capped'
    mimg = Image.fromarray((km * 255).astype(np.uint8), 'L')
    full = Image.new('L', img.size, 0)
    full.paste(mimg, (x0, y0))
    dots = majority_dots(img, full, (x0 + bx0, y0 + by0, x0 + bx1, y0 + by1), s_use)
    if dots is None:
        notes.append('%s: sampling failed' % c['sprite'])
        return None, {}
    info = {'pitch': round(s_use, 3), 'how': how, 'core_long': round(max(cW, cH) / s_use, 1), 'raw_box': [int(x0 + bx0), int(y0 + by0), int(x0 + bx1), int(y0 + by1)]}
    return dots, info


def sample_dots_cov(img, mask, box, s, cov=0.4):
    """(copy of gen_sheets.sample_dots: majority sampling always, coverage threshold cov) RGBA art-pixel image of the region box of a raw image, pitch s, grid phase fitted to the drawn edges"""
    x0, y0, x1, y1 = box
    crop = img.crop(box)
    mk = mask.crop(box)
    W, H = crop.size
    phx = G.best_phase(G.profile(crop, 0), s)
    phy = G.best_phase(G.profile(crop, 1), s)
    # neutralise background, then a fine working palette
    base = Image.new('RGB', crop.size, MAGENTA)
    base.paste(crop, (0, 0), mk)
    q = base.quantize(colors=256, method=Image.Quantize.MEDIANCUT, kmeans=2, dither=Image.Dither.NONE)
    pal = q.getpalette()[:256 * 3]
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
            if hist[255] < cov * area:
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


def majority_dots(img, mask, box, s):
    return sample_dots_cov(img, mask, box, s, 0.4)


def clean_dots(d, maxc):
    """strays, holes, magenta fringe, pure black, palette"""
    a = np.array(d.convert('RGBA'))
    al = a[..., 3] > 127
    rgb = a[..., :3].astype(np.int16)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    pink = al & (np.minimum(r, b) - g > 70) & (np.abs(r - b) < 70) & (np.minimum(r, b) > 150)
    # fringe pink on the silhouette edge -> transparent; inside -> neighbour colour
    er = ndimage.binary_erosion(al, structure=np.ones((3, 3)))
    al[pink & ~er] = False
    # keep the largest 8-connected body (+ parts >= 6 px touching within 1 px after dilation)
    lab, n = ndimage.label(al, structure=np.ones((3, 3)))
    strays = 0
    if n > 1:
        sizes = ndimage.sum(al, lab, range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        for i in range(1, n + 1):
            if i != main and sizes[i - 1] < max(6, 0.025 * sizes[main - 1]):
                al[lab == i] = False
                strays += 1
    # single-pixel holes
    holes = ~al & ndimage.binary_erosion(ndimage.binary_fill_holes(al), structure=np.ones((3, 3)))
    hole_small = holes & (ndimage.convolve(al.astype(np.uint8), np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]]), mode='constant') >= 4)
    al |= hole_small
    # colours for filled holes / inner pink: median of opaque neighbours
    fix = hole_small | (pink & al)
    if fix.any():
        for y, x in zip(*np.nonzero(fix)):
            ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
            nb = a[ys, xs][(a[ys, xs][..., 3] > 127) & ~fix[ys, xs]]
            if len(nb):
                a[y, x, :3] = np.median(nb[:, :3], axis=0)
    # pure black -> dark violet
    blk = al & (a[..., 0] < 12) & (a[..., 1] < 12) & (a[..., 2] < 16)
    a[blk, 0] = np.maximum(a[blk, 0], 16)
    a[blk, 1] = np.maximum(a[blk, 1], 10)
    a[blk, 2] = np.maximum(a[blk, 2], 24)
    a[..., 3] = np.where(al, 255, 0)
    im = Image.fromarray(a, 'RGBA')
    # palette (opaque pixels only)
    rgbim = Image.new('RGB', im.size, MAGENTA)
    rgbim.paste(im, (0, 0), im)
    ops = np.array(rgbim)[al]
    ncol = len(np.unique(ops.reshape(-1, 3), axis=0)) if len(ops) else 0
    if ncol > maxc:
        strip = Image.fromarray(ops.reshape(1, -1, 3).astype(np.uint8), 'RGB')
        spare = 6       # colours kept for small vivid spots (the focal eye / core) that the median cut would merge away
        q = strip.quantize(colors=maxc - spare, method=Image.Quantize.MEDIANCUT, kmeans=4, dither=Image.Dither.NONE)
        qa = np.array(q.convert('RGB')).reshape(-1, 3).astype(np.int32)
        err = np.abs(qa - ops.reshape(-1, 3).astype(np.int32)).sum(axis=1)
        bad = err > 70
        if bad.sum() >= 2:
            s2 = Image.fromarray(ops.reshape(-1, 3)[bad].reshape(1, -1, 3).astype(np.uint8), 'RGB')
            q2 = s2.quantize(colors=min(spare, int(bad.sum())), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            qa[bad] = np.array(q2.convert('RGB')).reshape(-1, 3)
        b2 = np.array(im)
        b2[al, :3] = qa
        im = Image.fromarray(b2, 'RGBA')
        ncol = maxc
    bb = im.getbbox()
    return im.crop(bb), {'strays_removed': strays, 'colors': int(ncol)}


def measure(im, fly, size):
    """anchor (draw point) and points in image px"""
    a = np.array(im)[..., 3] > 127
    H, W = a.shape
    ys, xs = np.nonzero(a)
    bottom = ys.max()
    cy, cx = ys.mean(), xs.mean()
    if fly:
        gap = max(6, int(round(0.28 * H)))
        anchor = [int(round(cx)), int(bottom + gap)]
    else:
        band = ys >= bottom - max(2, H // 12)
        anchor = [int(round((xs[band].min() + xs[band].max()) / 2)), int(bottom)]
    # head: front-top score on the body core (thin wings, antennae, tails opened away), front weighted more
    core = ndimage.binary_opening(a, structure=np.ones((3, 3)), iterations=max(1, min(W, H) // 14))
    if core.sum() > 30:
        ys, xs = np.nonzero(core)
    sc = xs / max(1, W) * 1.0 - ys / max(1, H) * 0.6
    k = max(8, len(xs) // 40)
    idx = np.argsort(-sc)[:k]
    head = [int(round(xs[idx].mean())), int(round(ys[idx].mean()))]
    top_i = np.argmin(ys + np.abs(xs - head[0]) * 0.25)
    top = [int(xs[top_i]), int(ys[top_i])]
    cy, cx = ys.mean(), xs.mean()
    center = [int(round(cx)), int(round(cy))]
    fx = [int(round(cx + (head[0] - cx) * 0.3)), int(round(cy + (head[1] - cy) * 0.3))]
    sx, sy = xs.std(), ys.std()
    body = [int(round(cx)), int(round(cy)), int(round(sx * 1.5)), int(round(sy * 1.5))]
    return anchor, {'head': head, 'center': center, 'fx': fx, 'top': top, 'body': body}


def max_colors(c):
    """palette size of one monster: 32 (S) / 48, or the cell's maxColors (the final boss is larger and gets more)"""
    return int(c.get('maxColors') or (32 if c['size'] == 'S' else 48))


def overrides():
    return json.load(open(OVR, encoding='utf-8')) if os.path.exists(OVR) else {}


def export(im, c, s, info, pose=None, anchor_override=None, pts_override=None):
    os.makedirs(OUT, exist_ok=True)
    fly = bool(c.get('flying')) or bool(overrides().get(c['sprite'], {}).get('fly'))
    anchor, pts = measure(im, fly, c['size'])
    if anchor_override:
        anchor = anchor_override
    ov = overrides().get(c['sprite'] + ('@' + pose if pose else ''), {})
    if 'anchor' in ov:
        anchor = ov['anchor']
    pts.update(ov.get('points', {}))
    if pts_override:
        pts.update(pts_override)
    name = c['sprite'] + ('@' + pose if pose else '')
    lift = overrides().get(c['sprite'], {}).get('lift')
    if lift:      # a very dark design that disappears in the night scene: gamma lift (same for every pose of the sprite)
        a = np.array(im.convert('RGBA')).astype(np.float32)
        a[..., :3] = 255.0 * (a[..., :3] / 255.0) ** float(lift)
        im = Image.fromarray(a.round().clip(0, 255).astype(np.uint8), 'RGBA')
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    sp = spec()
    variants = {v: {'recolor': sp['engineVariants'][v].get('recolor', {}), 'addons': sp['engineVariants'][v].get('addons', []),
                    'filter': sp['engineVariants'][v].get('filter'), 'name': sp['engineVariants'][v].get('name')}
                for v in c.get('alsoMakes', []) if v in sp['engineVariants']}
    meta = {'sprite': c['sprite'], 'id': c['id'], 'name': c['name'], 'sheet': s['sheet'], 'cell': c['cell'], 'size': c['size'],
            'kind': c.get('kind'), 'fly': fly, 'w': im.width, 'h': im.height, 'anchor': anchor, 'points': pts, 'facing': 'right',
            'long': max(im.width, im.height), 'core_long': info.get('core_long'), 'target': c['targetDots'], 'colors': info.get('colors'), 'pitch': info.get('pitch')}
    if c.get('battleCap'):     # the final boss: drawn larger than the boss tier (actors.js scaleOf reads it)
        meta['battleCap'] = c['battleCap']
    if pose:
        meta['pose'] = pose
    if variants and not pose:
        meta['alsoMakes'] = c.get('alsoMakes', [])
        meta['variants'] = variants
    json.dump(meta, open(os.path.join(OUT, name + '.json'), 'w'), ensure_ascii=False, indent=1)
    return meta


def raw_path(n, st, raw=None):
    if raw:
        return raw
    if st.get('use'):
        return os.path.join(sdir(n), 'raw', st['use'])
    fs = sorted(glob.glob(os.path.join(sdir(n), 'raw', 'mon_s%02d_a*.png' % n)), key=os.path.getmtime)
    return fs[-1] if fs else None


def normalise_sheet(n, raw=None, only=None, export_it=True):
    s = sheet(n)
    st = load_state(n)
    rp = raw_path(n, st, raw)
    if not rp or not os.path.exists(rp):
        print('sheet %d: no raw' % n)
        return
    img = Image.open(rp).convert('RGB')
    mask = fg_mask(img)
    rects = cell_rects(s, *img.size)
    notes = []
    res = {}
    cell_masks = {}
    if len(s['cells']) == 1:
        cell_masks[s['cells'][0]['cell']] = mask
    else:
        lab, nl = pieces(mask, s['pxPerDot'] * img.size[0] / s['canvas'][0])
        if nl:
            cents = ndimage.center_of_mass(mask, lab, range(1, nl + 1))
            owner = np.zeros(nl + 1, dtype=np.int32)
            for i, (cy, cx) in enumerate(cents, 1):
                for k, (x0, y0, x1, y1) in enumerate(rects):
                    if x0 <= cx < x1 and y0 <= cy < y1:
                        owner[i] = k + 1
            for c0 in s['cells']:
                cell_masks[c0['cell']] = mask & (owner[lab] == c0['cell'])
    for c in s['cells']:
        if only and c['cell'] not in only:
            continue
        cr = dict(st.get('cellraw', {})).get(str(c['cell']))
        if cr:      # this cell was redrawn alone: use that image (whole image = the cell)
            cimg = Image.open(os.path.join(sdir(n), 'raw', cr)).convert('RGB')
            cmask = fg_mask(cimg)
            cs = dict(s)
            cs['canvas'] = list(cimg.size)
            dots, info = normalise_cell(cimg, cmask, (0, 0) + cimg.size, c, cs, notes)
        else:
            # each connected part goes to the cell holding its centre, so a monster that crosses the cell line
            # (a long neck or tail) stays whole and does not leave a fragment in its neighbour
            cm = cell_masks.get(c['cell'])
            dots, info = normalise_cell(img, cm, (0, 0) + img.size, c, s, notes)
        if dots is None:
            continue
        im, ci = clean_dots(dots, max_colors(c))
        info.update(ci)
        L = max(im.size)
        cls = spec()['classes'].get(s['class'])
        lo, hi = (cls['longSide'] if cls and 'longSide' in cls else (c['targetDots']['long'] * 0.9, c['targetDots']['long'] * 1.1))
        if not (lo * 0.95 <= L <= hi * 1.05):
            notes.append('%s: long side %d outside the tier %s' % (c['sprite'], L, [lo, hi]))
        if ci['strays_removed']:
            notes.append('%s: removed %d stray pixel group(s)' % (c['sprite'], ci['strays_removed']))
        info['long'] = L
        res[c['sprite']] = (im, info)
        if export_it and not overrides().get(c['sprite'], {}).get('fromEdit'):   # fromEdit: redrawn as an edit of another sprite
            export(im, c, s, info)
    st['norm'] = {k: v[1] for k, v in res.items()}
    st['notes'] = notes
    save_state(n, st)
    review(n, img, res)
    print('sheet %d normalised: %s' % (n, ', '.join('%s %dx%d (%s)' % (k, v[0].width, v[0].height, v[1]['how']) for k, v in res.items())))
    for t in notes:
        print('  note:', t)


def review(n, raw, res):
    """raw (small) | the exported sprites x3 on a dark night colour and on magenta"""
    rw = raw.resize((raw.width * 600 // raw.height, 600), Image.LANCZOS)
    sprites = [v[0] for v in res.values()]
    sc = 3
    W = sum(i.width * sc + 20 for i in sprites) + 20
    H = max([i.height * sc for i in sprites] + [10]) + 40
    pane = Image.new('RGB', (max(W, 10), H), (38, 36, 56))
    x = 20
    for i in sprites:
        big = i.resize((i.width * sc, i.height * sc), Image.NEAREST)
        pane.paste(big, (x, H - 20 - big.height), big)
        x += big.width + 20
    out = Image.new('RGB', (rw.width + pane.width + 10, max(rw.height, pane.height)), (20, 20, 28))
    out.paste(rw, (0, 0))
    out.paste(pane, (rw.width + 10, 0))
    out.save(os.path.join(sdir(n), 'review.png'))


def cmd_norm(a):
    for n in a.sheets:
        normalise_sheet(n, a.raw, a.only)


# ------------------------------------------------------------------------------------------ one cell alone
def cmd_cellredo(a):
    n, cell = a.sheet, a.cell
    s = sheet(n)
    c = next(x for x in s['cells'] if x['cell'] == cell)
    st = load_state(n)
    cw, ch = s['canvas'][0] // s['grid'][0], s['canvas'][1] // s['grid'][1]
    size = (1024, 1024) if s['class'] in ('S', 'M') else (1024, 1536) if ch > cw else (1024, 1024)
    p = s['pxPerDot']
    td = c['targetDots']
    # render the cell at a size where the art pitch stays p image px
    prompt_base, _ = sheet_prompt(n)
    brief = brief_section(n)
    head = (os.environ.get('MON_STYLE_HINT', '').strip() + '\n\n') if os.environ.get('MON_STYLE_HINT') else ''
    prompt = '\n'.join([head + STYLE_EN, '',
                        'Draw ONE monster alone, centred: %s (id %s) from the brief below. CANVAS %dx%d px flat #FF00FF. One art pixel = %dx%d image px. '
                        'Size: about %d x %d art px (%dx%d image px). %s' % (c['name'], c['id'], size[0], size[1], p, p, td['w'], td['h'], td['w'] * p, td['h'] * p,
                                                                             'It flies (floats in the middle).' if c.get('flying') else 'It stands; lowest pixel ~48 px above the bottom.'),
                        'ATTACHED IMAGE 1: the party, at the same pixel size (mirrored). ' + ('ATTACHED IMAGE 2: the previous sheet — keep the same style; fix the problem.' if a.withsheet else ''),
                        '', 'EXTRA INSTRUCTIONS (most important): ' + a.notes, '', 'SHEET BRIEF (Japanese):', brief, '', 'COMMON RULES (Japanese):', common_rules()])
    k = len(st.get('cellattempts', [])) + 1
    base = os.path.join(sdir(n), 'raw', 'mon_s%02d_c%d_a%d' % (n, cell, k))
    open(base + '_prompt.txt', 'w', encoding='utf-8').write(clean_prompt(prompt))
    refs = [party_ref(p)]
    if a.withsheet:
        refs.append(Image.open(raw_path(n, st)).convert('RGB'))
    png, info = call(prompt, refs, size, 'mon_s%02d_c%d_a%d' % (n, cell, k))
    open(base + '.png', 'wb').write(png)
    st.setdefault('cellattempts', []).append({'cell': cell, 'file': os.path.basename(base) + '.png', 'notes': a.notes})
    st.setdefault('cellraw', {})[str(cell)] = os.path.basename(base) + '.png'
    save_state(n, st)
    normalise_sheet(n)


# ------------------------------------------------------------------------------------------ boss poses / phases (edits)
def find_cell(sprite):
    for s in spec()['sheets']:
        for c in s['cells']:
            if c['sprite'] == sprite:
                return s, c
    raise SystemExit('unknown sprite ' + sprite)


def cmd_variant(a):
    s, c = find_cell(a.sprite)
    n = s['sheet']
    st = load_state(n)
    base_raw = Image.open(raw_path(n, st)).convert('RGB')
    head = (os.environ.get('MON_STYLE_HINT', '').strip() + '\n\n') if os.environ.get('MON_STYLE_HINT') else ''
    prompt = '\n'.join([head + 'EDIT THE ATTACHED IMAGE: it is an approved pixel-art battle sprite of the boss "%s" on flat magenta #FF00FF.' % c['name'],
                        'Return the SAME canvas size, the SAME flat magenta background, the SAME monster design, colours, pixel size (%dx%d image px per art pixel), '
                        'outline and shading, the SAME scale and the SAME position (its body centre and its lowest point stay where they are). Keep facing RIGHT.' % (s['pxPerDot'], s['pxPerDot']),
                        'Change ONLY this: ' + a.prompt,
                        'Still no text, no ground, no shadow, no glow, no aura, no sparkles, no motion lines, no detached floating bits. Real crisp pixel art, no anti-aliasing.'])
    k = len([x for x in st.get('variants', []) if x['pose'] == a.pose]) + 1
    base = os.path.join(sdir(n), 'raw', 'mon_s%02d_%s_a%d' % (n, a.pose, k))
    open(base + '_prompt.txt', 'w', encoding='utf-8').write(clean_prompt(prompt))
    q = a.quality or 'medium'
    png, info = call(prompt, [base_raw], base_raw.size, 'mon_s%02d_%s_a%d' % (n, a.pose, k), q)
    open(base + '.png', 'wb').write(png)
    st.setdefault('variants', []).append({'pose': a.pose, 'file': os.path.basename(base) + '.png', 'prompt': a.prompt})
    st.setdefault('posesUse', {})[a.pose] = os.path.basename(base) + '.png'
    save_state(n, st)
    normalise_variant(a.sprite, a.pose)


def normalise_variant(sprite, pose, raw=None):
    """sample the pose image at the base pitch and align it to the base by the body (best overlap of the lower half)"""
    s, c = find_cell(sprite)
    n = s['sheet']
    st = load_state(n)
    rp = raw or os.path.join(sdir(n), 'raw', st['posesUse'][pose])
    img = Image.open(rp).convert('RGB')
    base_raw = Image.open(raw_path(n, st)).convert('RGB')
    if img.size != base_raw.size:
        img = img.resize(base_raw.size, Image.NEAREST)
    info0 = st['norm'][sprite]
    pitch = info0['pitch']
    mask = fg_mask(img)
    # only the sprite's own cell (an edit of a 2-cell sheet repaints the neighbour too)
    x0, y0, x1, y1 = cell_rects(s, *img.size)[c['cell'] - 1] if len(s['cells']) > 1 else (0, 0) + img.size
    keep_rect = np.zeros_like(mask)
    keep_rect[y0:y1, x0:x1] = True
    mask &= keep_rect
    notes = []
    # force the base pitch: long side in art px = raw long / pitch
    lab, nn = pieces(mask, pitch)
    sizes = ndimage.sum(mask, lab, range(1, nn + 1))
    main = int(np.argmax(sizes)) + 1
    objs = ndimage.find_objects(lab)
    keep = [main] + [i for i in range(1, nn + 1) if i != main and sizes[i - 1] > 0.02 * sizes[main - 1]]
    km = np.isin(lab, keep) & mask
    ys, xs = np.nonzero(km)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    full = Image.fromarray((km * 255).astype(np.uint8), 'L')
    dots = majority_dots(img, full, box, pitch)
    im, ci = clean_dots(dots, max_colors(c))
    # alignment: raw boxes in raw px -> art px offset relative to the base
    b0 = info0['raw_box']
    base_png = Image.open(os.path.join(OUT, sprite + '.png'))
    bm = json.load(open(os.path.join(OUT, sprite + '.json')))
    # position of the new crop's top-left in base art coords (raw px / pitch), then best local shift by overlap of opaque masks
    ox0 = (box[0] - b0[0]) / pitch
    oy0 = (box[1] - b0[1]) / pitch
    A = np.array(base_png)[..., 3] > 127
    B = np.array(im)[..., 3] > 127
    best, bo = -1, (0, 0)
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            X, Y = int(round(ox0)) + dx, int(round(oy0)) + dy
            # overlap count of B placed at (X, Y) over A
            ax0, ay0 = max(0, X), max(0, Y)
            ax1, ay1 = min(A.shape[1], X + B.shape[1]), min(A.shape[0], Y + B.shape[0])
            if ax1 <= ax0 or ay1 <= ay0:
                continue
            ov = (A[ay0:ay1, ax0:ax1] & B[ay0 - Y:ay1 - Y, ax0 - X:ax1 - X]).sum()
            if ov > best:
                best, bo = ov, (X, Y)
    X, Y = bo
    anchor = [bm['anchor'][0] - X, bm['anchor'][1] - Y]
    shift = lambda p: [p[0] - X, p[1] - Y] if isinstance(p, list) and len(p) == 2 else p
    pts = {k: shift(v) for k, v in bm['points'].items() if isinstance(v, list) and len(v) == 2}
    info = {'pitch': pitch, 'colors': ci['colors']}
    meta = export(im, c, s, info, pose=pose, anchor_override=anchor, pts_override=pts)
    st.setdefault('poseNorm', {})[pose] = {'offset': [X, Y], 'overlap': int(best), 'size': [im.width, im.height]}
    save_state(n, st)
    print('%s@%s: %dx%d, offset %s, overlap %.2f' % (sprite, pose, im.width, im.height, bo, best / max(1, A.sum())))
    return meta


def cmd_varnorm(a):
    normalise_variant(a.sprite, a.pose, a.raw)


# ------------------------------------------------------------------------------------------ checks / contact
def cmd_check(a):
    sp = spec()
    bad = 0
    tiers = sp['classes']
    for s in sp['sheets']:
        for c in s['cells']:
            p = os.path.join(OUT, c['sprite'] + '.json')
            if not os.path.exists(p):
                continue
            m = json.load(open(p))
            im = Image.open(os.path.join(OUT, c['sprite'] + '.png'))
            al = np.array(im.convert('RGBA'))[..., 3] > 127
            lab, nlab = ndimage.label(al, structure=np.ones((3, 3)))
            L = max(im.size)
            cl = tiers.get(s['class'], {})
            lo, hi = cl.get('longSide', [c['targetDots']['long'] * 0.9, c['targetDots']['long'] * 1.1])
            probs = []
            core = m.get('core_long') or L      # the body without thin wings / tails / antennae (MONSTER_REQUEST §2.4)
            if not (lo * 0.95 <= core <= hi * 1.05) or L > hi * 1.35:
                probs.append('size %d (body %s) not in %s' % (L, core, [lo, hi]))
            if nlab > 1:
                probs.append('%d separate parts' % nlab)
            if m.get('facing') != 'right':
                probs.append('facing')
            ov = overrides().get(c['sprite'], {})
            if ov.get('facing') == 'left':
                probs.append('FACING LEFT (eye check)')
            if (m.get('colors') or 0) > max_colors(c):
                probs.append('colours %s' % m.get('colors'))
            rgba = np.array(im.convert('RGBA'))
            blk = ((rgba[..., 3] > 127) & (rgba[..., :3].max(axis=2) < 8)).sum()
            if blk:
                probs.append('%d pure black px' % blk)
            if probs:
                bad += 1
            print('%-22s s%02d %-2s %3dx%-3d %s' % (c['sprite'], s['sheet'], c['size'], im.width, im.height, '; '.join(probs) or 'ok'))
    print('problems:', bad)


def parse_range(t):
    out = []
    for part in t.split(','):
        if '-' in part:
            a, b = part.split('-')
            out += list(range(int(a), int(b) + 1))
        elif part:
            out.append(int(part))
    return out


def cmd_contact(a):
    sp = spec()
    ns = parse_range(a.sheets)
    items = []
    for s in sp['sheets']:
        if s['sheet'] not in ns:
            continue
        for c in s['cells']:
            p = os.path.join(OUT, c['sprite'] + '.png')
            if os.path.exists(p):
                items.append((s['sheet'], c['sprite'], Image.open(p).convert('RGBA'), json.load(open(p[:-4] + '.json'))))
            for vp in sorted(glob.glob(os.path.join(OUT, c['sprite'] + '@*.png'))):
                items.append((s['sheet'], os.path.basename(vp)[:-4], Image.open(vp).convert('RGBA'), json.load(open(vp[:-4] + '.json'))))
    hero = None
    hp = os.path.join(SPRITES, 'hero_m_warrior', 'battle.png')
    if os.path.exists(hp):
        m = json.load(open(hp[:-4] + '.json'))
        fr = m['frames'][0]
        hero = Image.open(hp).convert('RGBA').crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h']))
        hero = hero.crop(hero.getbbox())
    sc = a.scale
    rows, row, x, rowh = [], [], 0, 0
    maxw = a.width
    for it in items:
        w = it[2].width * sc + 16
        if row and x + w > maxw:
            rows.append(row)
            row, x = [], 0
        row.append(it)
        x += w
    if row:
        rows.append(row)
    heights = [max(max(i[2].height, i[3]['anchor'][1] if i[3].get('fly') else 0) for i in r) * sc + 30 for r in rows]
    W = maxw + (hero.width * sc + 30 if hero else 0)
    H = sum(heights) + 10
    out = Image.new('RGB', (W, H), (34, 32, 50))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(out)
    y = 5
    for r, h in zip(rows, heights):
        x = 10
        base_y = y + h - 18
        if hero:
            hb = hero.resize((hero.width * sc, hero.height * sc), Image.NEAREST)
            out.paste(hb, (W - hb.width - 10, base_y - hb.height), hb)
        for sn, name, im, m in r:
            big = im.resize((im.width * sc, im.height * sc), Image.NEAREST)
            ax, ay = m['anchor']
            px, py = x + 8, base_y - ay * sc
            out.paste(big, (px, py), big)
            dr.line([(px + ax * sc - 4, base_y), (px + ax * sc + 4, base_y)], fill=(255, 200, 80))
            dr.text((x + 8, base_y + 2), '%d %s' % (sn, name), fill=(200, 200, 220))
            x += big.width + 16
        dr.line([(0, base_y), (maxw, base_y)], fill=(70, 66, 96))
        y += h
    out.save(a.out)
    print(a.out, out.size)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    g = sub.add_parser('gen'); g.add_argument('sheets', type=int, nargs='+'); g.add_argument('--redo', default=''); g.add_argument('--force', action='store_true')
    g.add_argument('--quality', default=None); g.add_argument('--high', action='store_true')
    nm = sub.add_parser('norm'); nm.add_argument('sheets', type=int, nargs='+'); nm.add_argument('--raw', default=None); nm.add_argument('--only', type=int, nargs='*')
    cr = sub.add_parser('cellredo'); cr.add_argument('sheet', type=int); cr.add_argument('cell', type=int); cr.add_argument('notes'); cr.add_argument('--withsheet', action='store_true')
    v = sub.add_parser('variant'); v.add_argument('sprite'); v.add_argument('pose'); v.add_argument('prompt'); v.add_argument('--quality', default=None)
    vn = sub.add_parser('varnorm'); vn.add_argument('sprite'); vn.add_argument('pose'); vn.add_argument('--raw', default=None)
    sub.add_parser('check')
    ct = sub.add_parser('contact'); ct.add_argument('sheets'); ct.add_argument('--out', required=True); ct.add_argument('--scale', type=int, default=3); ct.add_argument('--width', type=int, default=2400)
    pr = sub.add_parser('prompt'); pr.add_argument('sheet', type=int)
    a = ap.parse_args()
    if a.cmd == 'gen':
        cmd_gen(a)
    elif a.cmd == 'norm':
        cmd_norm(a)
    elif a.cmd == 'cellredo':
        cmd_cellredo(a)
    elif a.cmd == 'variant':
        cmd_variant(a)
    elif a.cmd == 'varnorm':
        cmd_varnorm(a)
    elif a.cmd == 'check':
        cmd_check(a)
    elif a.cmd == 'contact':
        cmd_contact(a)
    elif a.cmd == 'prompt':
        print(clean_prompt(sheet_prompt(a.sheet)[0]))


if __name__ == '__main__':
    main()
