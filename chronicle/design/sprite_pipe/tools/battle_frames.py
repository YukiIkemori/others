#!/usr/bin/env python3
"""More drawn frames for the key battle actions (attack / cast / victory) of a finished battle sheet.

Adds the anims attack8 / cast8 / victory8 (about 6-8 frames each) to v2/assets/sprites/<look>/battle.{png,json}.
The old frames and anims are left as they are; the engine prefers <action>8 when present.

How (one image generation per action, edit mode):
  1. the character's own key poses (idle_a, windup, slash, cast_a, …) are laid on a grid of cells, all registered to the
     same head x and feet line (one camera), at p image px per art px; the in-between cells are left empty and the
     prompt says what to draw in each one (weapon-specific plans below).
  2. the result is calibrated on the untouched key cells (pitch + offset), each new cell is sampled back to art pixels,
     snapped to the sheet's own palette, cleaned, put on the feet line and registered by the head (head x follows the
     drawn motion, smoothed); key cells keep their original pixels.
  3. checks per frame: head scale vs idle (+-3 %), feet line, head path (no jumps), stray parts.
  4. apply: frames atk8_NN / cst8_NN / vic8_NN appended below the sheet (own anchor per frame) + the anims.

Commands (run in design/sprite_pipe/, API env sourced as for gen_sheets.py):
  python3 tools/battle_frames.py gen hero_m_warrior attack [--quality high] [--extra '...']
  python3 tools/battle_frames.py norm hero_m_warrior attack [--raw <png>]   # re-normalise a saved raw image (no call)
  python3 tools/battle_frames.py apply hero_m_warrior                        # write battle.png/json (idempotent)
  python3 tools/battle_frames.py preview hero_m_warrior --out <dir>          # GIFs + contact sheet
  python3 tools/battle_frames.py count                                       # images used by this tool
Store: design/art_ref/gen/battle8/<look>/  (raw/, <action>/NN.png, state.json)
"""
import argparse
import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
import bodyscale  # noqa: E402
import gen_api  # noqa: E402
import pixlib as P  # noqa: E402
from gen_sheets import key_mask, components, sample_dots, style_block  # noqa: E402

PIPE = os.path.dirname(TOOLS)
DESIGN = os.path.dirname(PIPE)
ART = os.path.join(DESIGN, 'art_ref')
STORE = os.path.join(ART, 'gen', 'battle8')
V2S = os.path.normpath(os.path.join(DESIGN, '..', 'v2', 'assets', 'sprites'))
MAGENTA = (255, 0, 255)
TAG = 'bf8'
PREFIX = {'attack': 'atk8', 'cast': 'cst8', 'victory': 'vic8'}
ANIM = {'attack': 'attack8', 'cast': 'cast8', 'victory': 'victory8'}

# ------------------------------------------------------------------------------------------------ plans
# slot = ('keep', frame id) | ('new', what to draw). The grid is filled in reading order.
# anim: slot indices used by the anim (1-based), ms per frame, extra keys.
WEAPON_EN = {'sword': 'one-handed sword', 'greatsword': 'big two-handed weapon', 'dagger': 'dagger', 'bow': 'bow',
             'staff': 'staff'}


def attack_plan(wt):
    if wt in ('sword', 'greatsword', 'staff'):
        two = wt != 'sword'
        w = {'sword': 'sword', 'greatsword': 'weapon', 'staff': 'staff'}[wt]
        hands = 'both hands on the %s' % w if two else 'the sword in the sword hand'
        slots = [
            ('keep', 'idle_a'),
            ('new', 'ANTICIPATION (between frame 1 and frame 3): knees bend and the body sinks a little, %s starts to lift '
                    'backward and up from the idle angle, halfway to the wind-up of frame 3. Feet where they are in frame 1.' % hands),
            ('keep', 'windup'),
            ('new', 'LUNGE (between frame 3 and frame 6): the front (left) foot steps forward to the left, the torso leans forward, '
                    'the %s is still high above/behind the head and is just starting to come down. Weight moving forward.' % w),
            ('new', 'STRIKE, the moment of impact (between frame 4 and frame 6): the %s is swung down in front of the body, level '
                    'and pointing forward-left at chest height, arms reaching out forward, deep lunge like frame 6. The %s is fully '
                    'drawn, no motion blur, no trail.' % (w, w)),
            ('keep', 'slash'),
            ('new', 'FOLLOW-THROUGH SETTLE (between frame 6 and frame 8): same low lunge as frame 6, %s still low, the torso '
                    'starts to rise, the back foot drags a little forward.' % w),
            ('new', 'RECOVER (between frame 7 and frame 9): standing up, feet coming back under the body, the %s lifting back '
                    'to the idle angle, almost the ready stance of frame 9.' % w),
            ('keep', 'idle_a'),
        ]
        anim = dict(slots=[2, 3, 4, 5, 6, 7, 8], ms=[80, 100, 60, 60, 110, 80, 80], hit=3)
        pre = {2: 'idle_a', 4: 'windup', 5: 'slash', 7: 'slash', 8: 'idle_a'}
    elif wt == 'dagger':
        slots = [
            ('keep', 'idle_a'),
            ('new', 'ANTICIPATION (between frame 1 and frame 3): crouching a little lower, the dagger hand drawing back toward '
                    'the hip, eyes on the enemy to the left. Feet where they are in frame 1.'),
            ('keep', 'thrust_ready'),
            ('new', 'LAUNCH (between frame 3 and frame 6): pushing off the back foot, the body springs forward to the left, '
                    'front foot stepping out, dagger arm starting to come forward at waist height.'),
            ('new', 'STAB (between frame 4 and frame 6): almost the full lunge of frame 6, dagger arm nearly extended toward the '
                    'enemy on the left, dagger point forward. The dagger is fully drawn, no motion blur.'),
            ('keep', 'thrust'),
            ('new', 'WITHDRAW (between frame 6 and frame 8): pulling the dagger back toward the chest, still low, weight shifting '
                    'back onto the back foot.'),
            ('new', 'RECOVER (between frame 7 and frame 9): hopping back into the ready stance, dagger back at the idle angle, '
                    'almost frame 9.'),
            ('keep', 'idle_a'),
        ]
        anim = dict(slots=[2, 3, 4, 5, 6, 7, 8], ms=[80, 80, 60, 50, 120, 80, 80], hit=4)
        pre = {2: 'idle_a', 4: 'thrust_ready', 5: 'thrust', 7: 'thrust', 8: 'idle_a'}
    elif wt == 'bow':
        slots = [
            ('keep', 'idle_a'),
            ('new', 'REACH (between frame 1 and frame 3): the bow comes up in front of the body while the string hand reaches '
                    'back over the shoulder toward the quiver. Feet where they are in frame 1.'),
            ('keep', 'windup'),
            ('new', 'RAISE AND DRAW (between frame 3 and frame 5): the bow arm lifts to point left, arrow on the string, the '
                    'string pulled halfway back.'),
            ('keep', 'thrust_ready'),
            ('keep', 'thrust'),
            ('new', 'FOLLOW-THROUGH (after frame 6): bow arm still pointing left, the string hand drifting back and down, the '
                    'string straight again, NO arrow on the bow (it has flown).'),
            ('new', 'LOWER (between frame 7 and frame 9): the bow coming down back to the idle angle, almost the ready stance.'),
            ('keep', 'idle_a'),
        ]
        anim = dict(slots=[2, 3, 4, 5, 6, 7, 8], ms=[80, 90, 70, 140, 70, 90, 80], hit=4)
        pre = {2: 'idle_a', 4: 'thrust_ready', 7: 'thrust', 8: 'idle_a'}
    else:
        raise SystemExit('no attack plan for weapon %s' % wt)
    return dict(grid=(3, 3), slots=slots, anim=anim, prefill=pre)


def cast_plan(wt):
    slots = [
        ('keep', 'idle_a'),
        ('new', 'GATHER (between frame 1 and frame 4): the weapon lowered and tucked to the side as in frame 4, the free hand '
                'rising to the chest, knees bending a little, a focused look.'),
        ('new', 'CHANNEL: the free hand held in front of the chest, fingers curled around a SMALL spot of pale light (3-5 bright '
                'art pixels only, no big glow), hair and cloth ends lifting slightly upward.'),
        ('keep', 'cast_b'),
        ('new', 'PEAK: like frame 4 (hand raised high, palm open) but the body leaning back a little more, hair and cloth '
                'lifting, the small light spot in the raised palm.'),
        ('new', 'SWING (between frame 5 and frame 7): the raised hand sweeping forward and down toward the enemy on the left, '
                'the arm at about 45 degrees up, body leaning forward.'),
        ('keep', 'cast_a'),
        ('new', 'RELEASE HOLD (after frame 7): the arm fully extended to the left, fingers spread wide, torso leaning forward, '
                'cloth and hair blown backward (to the right).'),
        ('new', 'RECOVER (between frame 8 and idle): lowering the hand, standing up into the ready stance of frame 1.'),
    ]
    return dict(grid=(3, 3), slots=slots, anim=dict(slots=[2, 3, 4, 5, 6, 7, 8, 9], ms=[80, 80, 90, 90, 60, 100, 90, 80],
                                                    release=5),
                prefill={2: 'idle_a', 3: 'cast_a', 5: 'cast_b', 6: 'cast_a', 8: 'cast_a', 9: 'idle_a'})


def victory_plan(wt):
    slots = [
        ('keep', 'idle_a'),
        ('new', 'TRANSITION 1 (one third of the way from frame 1 to frame 4): the body straightens and relaxes out of the '
                'fighting stance, the weapon and arms starting to move toward the victory pose of frame 4.'),
        ('new', 'TRANSITION 2 (two thirds of the way from frame 1 to frame 4): nearly the victory pose, the weapon/arm almost '
                'where it is in frame 4, a small anticipation dip before the final pose.'),
        ('keep', 'victory_a'),
        ('new', 'LOOP A: exactly the victory pose of frame 4, but breathing in: chest and shoulders 1 art px higher, hair, '
                'cloth ends, scarf/cape swaying a little (2-3 px). Same weapon, same hands, same feet.'),
        ('new', 'LOOP B: exactly the victory pose of frame 4, but breathing out: shoulders 1 art px lower, cloth ends swaying '
                'the other way (2-3 px). Same weapon, same hands, same feet.'),
    ]
    return dict(grid=(2, 3), slots=slots, anim=dict(slots=[2, 3, 4, 5, 4, 6], ms=[80, 80, 240, 180, 240, 180],
                                                    loop_from=2),
                prefill={2: 'idle_a', 3: 'victory_a', 5: 'victory_a', 6: 'victory_a'})


PLANS = {'attack': attack_plan, 'cast': cast_plan, 'victory': victory_plan}


# ------------------------------------------------------------------------------------------------ character data
def char_info(look):
    if look == 'hero_m_warrior':
        return dict(id='arun', name='Arun', look=look, weaponType='sword', weaponDrawn='plain one-handed sword',
                    brief='the hero: a young swordsman with ash-brown messy hair, a long red scarf, a dark leather coat '
                          'over cream cloth, brown leather boots')
    cs = json.load(open(os.path.join(ART, 'companion_sheets.json')))['companions']
    for c in cs:
        if c['look'] == look:
            return dict(id=c['id'], name=c['id'].capitalize(), look=look, weaponType=c['weaponType'],
                        weaponDrawn=c.get('weaponDrawn', ''), brief='%s, %s' % (c.get('title', ''), c.get('signature', '')))
    raise SystemExit('unknown look %s' % look)


def v2_paths(look):
    d = os.path.join(V2S, look)
    return os.path.join(d, 'battle.png'), os.path.join(d, 'battle.json')


def base_sheet(look):
    """(RGBA array of the sheet without our added rows, meta without our frames/anims)"""
    pp, jp = v2_paths(look)
    m = json.load(open(jp))
    a = np.asarray(Image.open(pp).convert('RGBA')).copy()
    ours = tuple(PREFIX.values())
    m['frames'] = [f for f in m['frames'] if not f['id'].startswith(ours)]
    for k in ANIM.values():
        m['anims'].pop(k, None)
    for k in list(m.get('poses', {})):
        if k.startswith(ours) or k in ('anim_' + v for v in ANIM.values()):
            m['poses'].pop(k)
    for k in list(m.get('fps', {})):
        if k in ('anim_' + v for v in ANIM.values()):
            m['fps'].pop(k)
    hmax = max(f['y'] + f['h'] for f in m['frames'])
    return a[:hmax], m


def frame_px(a, m, fid):
    f = next(f for f in m['frames'] if f['id'] == fid)
    return a[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w']].copy(), f


def trim(a):
    ys, xs = np.where(a[..., 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (int(xs.min()), int(ys.min()))


def head_ref(idle):
    t, _ = trim(idle)
    return bodyscale.head_crop(t)


def head_of(fr, href):
    """(scale, head centre x, head centre y) of a frame (cell coords) by matching the idle head"""
    t, (ox, oy) = trim(fr)
    s, err, (y, x), mir, rot = bodyscale.match(t, href)
    hh, hw = href.shape[:2]
    return s, ox + x + hw * s / 2.0, oy + y + hh * s / 2.0, err


# ------------------------------------------------------------------------------------------------ job
class Job:
    def __init__(self, look, action):
        self.look, self.action = look, action
        self.char = char_info(look)
        self.dir = os.path.join(STORE, look)
        self.raw = os.path.join(self.dir, 'raw')
        self.out = os.path.join(self.dir, action)
        os.makedirs(self.raw, exist_ok=True)
        os.makedirs(self.out, exist_ok=True)
        self.sp = os.path.join(self.dir, 'state.json')
        self.state = json.load(open(self.sp)) if os.path.exists(self.sp) else {}
        self.a, self.m = base_sheet(look)
        self.plan = PLANS[action](self.char['weaponType'])
        self.idle, fi = frame_px(self.a, self.m, 'idle_a')
        self.anchor0 = fi['anchor']
        self.href = head_ref(self.idle)
        s, hx, hy, _ = head_of(self.idle, self.href)
        self.idle_head = (hx, hy)

    def st(self):
        return self.state.setdefault(self.action, {'attempts': []})

    def save(self):
        json.dump(self.state, open(self.sp, 'w'), indent=1, ensure_ascii=False)

    def log(self, msg):
        line = time.strftime('%H:%M:%S ') + msg
        print(line, flush=True)
        open(os.path.join(self.dir, 'log.txt'), 'a').write(line + '\n')

    # ---- layout: every kept frame registered to one head x and one feet line
    def layout(self):
        keeps = {}
        want = [v for kind, v in self.plan['slots'] if kind == 'keep'] + list(self.plan.get('prefill', {}).values())
        for v in want:
            if v not in keeps:
                fr, f = frame_px(self.a, self.m, v)
                s, hx, hy, _ = head_of(fr, self.href)
                if v == 'idle_a':
                    hx = self.idle_head[0]
                t, (ox, oy) = trim(fr)
                keeps[v] = dict(img=t, ox=ox - hx, oy=oy - f['anchor'][1], hx=hx, scale=s)
        # extents relative to (head x, feet line)
        L = max(-k['ox'] for k in keeps.values())
        R = max(k['ox'] + k['img'].shape[1] for k in keeps.values())
        T = max(-k['oy'] for k in keeps.values())
        mx = 18
        HX = int(max(L, 40) + mx)
        W = int(HX + max(R, 40) + mx)
        G = int(T + 12)           # feet line (the row just below the feet)
        H = G + 3
        return dict(keeps=keeps, HX=HX, G=G, W=W, H=H)

    def canvas(self, lay):
        rows, cols = self.plan['grid']
        W, H = lay['W'], lay['H']
        cv = np.zeros((rows * H, cols * W, 4), np.uint8)
        rects = []
        for i, (kind, v) in enumerate(self.plan['slots']):
            r, c = divmod(i, cols)
            x0, y0 = c * W, r * H
            rects.append((x0, y0))
            src = v if kind == 'keep' else self.plan.get('prefill', {}).get(i + 1)
            if src:
                k = lay['keeps'][src]
                img = k['img']
                px = int(round(x0 + lay['HX'] + k['ox']))
                py = int(y0 + lay['G'] + k['oy'])
                h, w = img.shape[:2]
                sub = cv[py:py + h, px:px + w]
                msk = img[..., 3] > 0
                sub[msk] = img[msk]
        return cv, rects


def pick_pitch(wd, hd):
    for p in range(8, 2, -1):
        W, H = wd * p, hd * p
        if max(W, H) <= 3840 and W * H <= 8_300_000:
            return p
    return 3


def render(cv, p):
    h, w = cv.shape[:2]
    im = Image.new('RGBA', (w, h), MAGENTA + (255,))
    im.alpha_composite(Image.fromarray(cv))
    im = im.convert('RGB').resize((w * p, h * p), Image.NEAREST)
    W2, H2 = (im.size[0] + 15) // 16 * 16, (im.size[1] + 15) // 16 * 16
    out = Image.new('RGB', (W2, H2), MAGENTA)
    out.paste(im, (0, 0))
    return out


def ref_sheet(job, p):
    """image 2: the character's whole existing battle sheet (identity reference)"""
    a = job.a
    im = Image.new('RGBA', (a.shape[1], a.shape[0]), MAGENTA + (255,))
    im.alpha_composite(Image.fromarray(a))
    q = max(2, min(p, 3840 // a.shape[1], 3840 // a.shape[0]))
    return im.convert('RGB').resize((a.shape[1] * q, a.shape[0] * q), Image.NEAREST)


ACTION_EN = {
    'attack': 'a smooth basic ATTACK with the %s',
    'cast': 'a smooth spell CAST (raise, channel, release)',
    'victory': 'a smooth VICTORY: transition from the ready stance into the victory pose, then a short idle loop in that pose',
}


def prompt_for(job, p, W, H, extra=''):
    rows, cols = job.plan['grid']
    c = job.char
    wt = c['weaponType']
    lines = [style_block(), '',
             'TASK: EDIT image 1. It is an animation strip of the pixel-art battle sprite of one character (%s) laid out as a '
             '%d-row x %d-column grid of equal cells, read left to right, top to bottom. One art pixel = exactly %d x %d image px. '
             'Output the same %dx%d canvas, same grid, same pixel size, flat #FF00FF background.' % (c['brief'], rows, cols, p, p, W, H),
             'The animation is %s. All frames face LEFT (the enemy is to the left). The camera never moves: in every cell the feet '
             'stand on the same ground line (the bottom of the feet of the drawn frames) and the head stays near the same x as in the '
             'drawn frames.' % (ACTION_EN[job.action] % WEAPON_EN.get(wt, wt) if '%s' in ACTION_EN[job.action] else ACTION_EN[job.action]),
             'Image 2 = the same character\'s complete existing battle sheet: the identity reference (face, hair, outfit, colours, '
             'weapon). Do not copy its layout.', '',
             'Some cells are KEY FRAMES: keep them exactly as they are, pixel-identical. The other cells hold a COPY of a neighbouring key '
             'frame only as a size and position guide: REDRAW the figure in each of those cells into the new in-between pose asked '
             'below, keeping exactly its size (same head size, same height when standing, same feet line), so that all frames play as '
             'one smooth continuous motion. Every REDRAW cell must end up clearly different from the copy it started from:']
    for i, (kind, v) in enumerate(job.plan['slots']):
        r, cc = divmod(i, cols)
        if kind == 'keep':
            lines.append('- Frame %d (row %d, column %d): KEY FRAME, already drawn (%s). Keep it.' % (i + 1, r + 1, cc + 1, v))
        else:
            pf = job.plan.get('prefill', {}).get(i + 1)
            if pf:
                lines.append('- Frame %d (row %d, column %d): REDRAW (now a copy of %s) -> %s' % (i + 1, r + 1, cc + 1, pf, v))
            else:
                lines.append('- Frame %d (row %d, column %d): EMPTY -> draw: %s' % (i + 1, r + 1, cc + 1, v))
    lines += ['',
              'CONSISTENCY RULES for every new frame:',
              '- exactly the same character, same size: the same head size, head shape, body proportions, limb thickness and height '
              'as the key frames (compare with the head of frame 1). No shrinking, no stretching.',
              '- exactly the same colours as the key frames (reuse their palette; no new hues).',
              '- the weapon is ALWAYS the same %s as in the key frames (%s): same shape, same length, same colours, held in the same '
              'hand(s). It never turns into another object, never disappears, never duplicates.' % (WEAPON_EN.get(wt, wt), c['weaponDrawn']),
              '- the feet stand on the ground line of the key frames (no jumping, no floating); the figure stays inside its own cell.',
              '- in-between poses are really in between their neighbours: small, even steps of the limbs, the torso and the cloth, so '
              'the motion reads smoothly when played at 12 frames per second.',
              '- crisp pixel art at the same pixel size, 1-px dark outline, no motion blur, no smear, no speed lines, no slash trails, '
              'no effects except where a frame asks for a few bright pixels, no text, no numbers, no grid lines.']
    if extra:
        lines += ['', 'EXTRA INSTRUCTIONS FOR THIS ATTEMPT:', extra]
    return '\n'.join(lines)


# ------------------------------------------------------------------------------------------------ generate / normalise
def cmd_gen(o):
    job = Job(o.look, o.action)
    lay = job.layout()
    cv, rects = job.canvas(lay)
    p = o.pitch or pick_pitch(cv.shape[1], cv.shape[0])
    img1 = render(cv, p)
    W, H = img1.size
    img2 = ref_sheet(job, p)
    prompt = prompt_for(job, p, W, H, o.extra)
    st = job.st()
    k = len(st['attempts']) + 1
    base = os.path.join(job.raw, '%s_a%d' % (o.action, k))
    img1.save(base + '_in.png')
    open(base + '_prompt.txt', 'w').write(prompt)
    if o.dry:
        print(prompt)
        print('canvas %dx%d pitch %d' % (W, H, p))
        return
    used = images_used()
    cap = int(os.environ.get('BF8_CAP', '130'))
    if used + 1 > cap:
        raise SystemExit('bf8 image cap reached (%d / %d)' % (used, cap))
    job.log('%s %s attempt %d: generating %dx%d (pitch %d, quality %s)' % (o.look, o.action, k, W, H, p, o.quality))
    png, info = gen_api.generate(prompt, [img1, img2], size='%dx%d' % (W, H), quality=o.quality, background='opaque',
                                 tag='%s_%s_%s_a%d' % (TAG, o.look, o.action, k))
    open(base + '.png', 'wb').write(png)
    st['attempts'].append(dict(raw=os.path.relpath(base + '.png', job.dir), pitch=p, lay=dict(HX=lay['HX'], G=lay['G'], W=lay['W'],
                               H=lay['H']), quality=o.quality, extra=o.extra, t=time.strftime('%Y-%m-%dT%H:%M:%S'),
                               secs=info.get('secs')))
    job.save()
    normalise(job, base + '.png', p, lay)


def cmd_norm(o):
    job = Job(o.look, o.action)
    lay = job.layout()
    st = job.st()
    att = st['attempts'][-1] if not o.raw else next(a for a in st['attempts'] if a['raw'].endswith(os.path.basename(o.raw)))
    normalise(job, os.path.join(job.dir, att['raw']), att['pitch'], lay)


def calibrate(mask, job, lay, rects, p):
    """fit raw = o + s * dots on the bboxes of the kept cells -> (sx, ox, sy, oy)"""
    X, Y = [], []
    for i, (kind, v) in enumerate(job.plan['slots']):
        if kind != 'keep':
            continue
        k = lay['keeps'][v]
        x0, y0 = rects[i]
        dx0 = x0 + lay['HX'] + k['ox']
        dx0 = int(round(dx0))
        dy0 = y0 + lay['G'] + k['oy']
        h, w = k['img'].shape[:2]
        box = (int((x0 + 2) * p), int((y0 + 1) * p), int((x0 + lay['W'] - 2) * p), int((y0 + lay['H']) * p))
        bb = mask.crop(box).getbbox()
        if not bb:
            continue
        X += [(dx0, box[0] + bb[0]), (dx0 + w, box[0] + bb[2])]
        Y += [(dy0, box[1] + bb[1]), (dy0 + h, box[1] + bb[3])]
    fx = np.polyfit([a for a, b in X], [b for a, b in X], 1)
    fy = np.polyfit([a for a, b in Y], [b for a, b in Y], 1)
    return fx[0], fx[1], fy[0], fy[1]


def clean_parts(a, min_keep=6, near=3):
    """drop small opaque islands away from the main body"""
    m = a[..., 3] > 0
    lab, n = nd.label(m, structure=np.ones((3, 3)))
    if n <= 1:
        return a
    sizes = nd.sum(m, lab, range(1, n + 1))
    big = int(np.argmax(sizes)) + 1
    body = nd.binary_dilation(lab == big, iterations=near)
    for i, s in enumerate(sizes, 1):
        if i == big:
            continue
        if s < min_keep or not (body & (lab == i)).any():
            if s < 25:
                a[lab == i] = 0
    return a


def normalise(job, raw_path, p, lay):
    raw = Image.open(raw_path).convert('RGB')
    rows, cols = job.plan['grid']
    Wd, Hd = cols * lay['W'], rows * lay['H']
    exp = render(np.zeros((Hd, Wd, 4), np.uint8), p).size
    if raw.size != exp:
        job.log('raw size %s != requested %s: resizing' % (raw.size, exp))
        raw = raw.resize(exp, Image.LANCZOS)
    mask = key_mask(raw)
    _, rects = job.canvas(lay)
    sx, ox, sy, oy = calibrate(mask, job, lay, rects, p)
    s = (sx + sy) / 2
    job.log('calibrated pitch %.2f / %.2f px (requested %d), offset %.1f, %.1f' % (sx, sy, p, ox, oy))
    pal = np.array([[int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)] for h in job.m['palette']], np.uint8)
    frames = []
    for i, (kind, v) in enumerate(job.plan['slots']):
        x0, y0 = rects[i]
        W, H = lay['W'], lay['H']
        if kind == 'keep':
            k = lay['keeps'][v]
            cell = np.zeros((H, W, 4), np.uint8)
            img = k['img']
            px = int(round(lay['HX'] + k['ox']))
            py = lay['G'] + k['oy']
            h, w = img.shape[:2]
            cell[py:py + h, px:px + w] = img
            frames.append(dict(slot=i + 1, kind='keep', src=v, img=cell))
            continue
        # the raw region of this cell (a little inset from the neighbours)
        rx0, rx1 = ox + sx * (x0 + 1), ox + sx * (x0 + W - 1)
        ry0, ry1 = oy + sy * y0, oy + sy * (y0 + H)
        cbox = (int(rx0), int(max(0, ry0)), int(rx1), int(min(raw.size[1], ry1)))
        parts = components(mask.crop(cbox), f=4, min_area_px=int(4 * s * s))
        if not parts:
            job.log('frame %d: nothing drawn' % (i + 1))
            frames.append(dict(slot=i + 1, kind='new', img=None))
            continue
        big = max(parts, key=lambda q: q['area'])['box']
        keep = [q['box'] for q in parts if q['area'] >= 0.02 * max(pp['area'] for pp in parts)
                or (q['box'][0] < big[2] + 3 * s and q['box'][2] > big[0] - 3 * s and q['box'][1] < big[3] + 3 * s and q['box'][3] > big[1] - 3 * s)]
        ub = (min(b[0] for b in keep), min(b[1] for b in keep), max(b[2] for b in keep), max(b[3] for b in keep))
        box = (cbox[0] + ub[0], cbox[1] + ub[1], cbox[0] + ub[2], cbox[1] + ub[3])
        # grid phase anchored on the calibrated lattice: extend the box to lattice lines
        gx0 = np.floor((box[0] - ox) / sx)
        gy0 = np.floor((box[1] - oy) / sy)
        gx1 = np.ceil((box[2] - ox) / sx)
        gy1 = np.ceil((box[3] - oy) / sy)
        lbox = (int(round(ox + gx0 * sx)), int(round(oy + gy0 * sy)), int(round(ox + gx1 * sx)), int(round(oy + gy1 * sy)))
        dots = lattice_sample(raw, mask, lbox, int(gx1 - gx0), int(gy1 - gy0))
        a = P.remap(dots, pal)
        a = P.cleanup(a, pal, passes=1)
        a = clean_parts(a)
        cell = np.zeros((H, W, 4), np.uint8)
        dx, dy = int(gx0 - x0), int(gy0 - y0)
        h, w = a.shape[:2]
        # paste with clipping
        cx0, cy0 = max(0, dx), max(0, dy)
        cx1, cy1 = min(W, dx + w), min(H, dy + h)
        cell[cy0:cy1, cx0:cx1] = a[cy0 - dy:cy1 - dy, cx0 - dx:cx1 - dx]
        pf = job.plan.get('prefill', {}).get(i + 1)
        pre = None
        if pf:
            k = lay['keeps'][pf]
            pre = np.zeros((H, W, 4), np.uint8)
            px = int(round(lay['HX'] + k['ox']))
            py = lay['G'] + k['oy']
            pre[py:py + k['img'].shape[0], px:px + k['img'].shape[1]] = k['img']
        frames.append(dict(slot=i + 1, kind='new', img=cell, pre=pre))
    register(job, lay, frames)
    # save
    for f in frames:
        if f['img'] is not None:
            Image.fromarray(f['img']).save(os.path.join(job.out, '%02d.png' % f['slot']))
    st = job.st()
    st['frames'] = [dict(slot=f['slot'], kind=f['kind'], src=f.get('src'), checks=f.get('checks')) for f in frames]
    st['lay'] = dict(HX=lay['HX'], G=lay['G'], W=lay['W'], H=lay['H'])
    st['from_raw'] = os.path.relpath(raw_path, job.dir)
    job.save()
    report(job, frames)


def lattice_sample(raw, mask, box, nx, ny):
    """sample the region box of the raw image on an nx x ny lattice: per art pixel the majority colour of the inner part
    (dark outline wins at the silhouette edge), alpha from the key mask coverage"""
    crop = np.asarray(raw.crop(box)).astype(np.int32)
    mk = np.asarray(mask.crop(box)) > 127
    H, W = mk.shape
    out = np.zeros((ny, nx, 4), np.uint8)
    for j in range(ny):
        y0, y1 = int(round(j * H / ny)), int(round((j + 1) * H / ny))
        for i in range(nx):
            x0, x1 = int(round(i * W / nx)), int(round((i + 1) * W / nx))
            m = mk[y0:y1, x0:x1]
            if m.size == 0 or m.mean() < 0.5:
                continue
            iy0, iy1 = y0 + (y1 - y0) // 4, y1 - (y1 - y0) // 4
            ix0, ix1 = x0 + (x1 - x0) // 4, x1 - (x1 - x0) // 4
            sub = crop[iy0:max(iy1, iy0 + 1), ix0:max(ix1, ix0 + 1)].reshape(-1, 3)
            sm = mk[iy0:max(iy1, iy0 + 1), ix0:max(ix1, ix0 + 1)].reshape(-1)
            sub = sub[sm] if sm.any() else crop[y0:y1, x0:x1].reshape(-1, 3)[m.reshape(-1)]
            if len(sub) == 0:
                continue
            q = (sub // 8)
            keys = q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2]
            vals, cnt = np.unique(keys, return_counts=True)
            kk = vals[cnt.argmax()]
            col = sub[keys == kk].mean(0)
            lum = 0.299 * sub[:, 0] + 0.587 * sub[:, 1] + 0.114 * sub[:, 2]
            if m.mean() < 0.97 and (lum < 55).mean() >= 0.35:
                col = sub[lum < 55].mean(0)
            out[j, i, :3] = np.clip(col, 0, 255).astype(np.uint8)
            out[j, i, 3] = 255
    return out


def register(job, lay, frames):
    """feet on the ground line, head x along a smooth path; checks"""
    G = lay['G']
    hs = []
    for f in frames:
        a = f['img']
        if a is None:
            hs.append(None)
            continue
        ys = np.where(a[..., 3].any(1))[0]
        if f['kind'] == 'new':
            dy = G - ys.max()
            if dy:
                a = np.roll(a, dy, axis=0)
                if dy > 0:
                    a[:dy] = 0
                else:
                    a[dy:] = 0
                f['img'] = a
            f['dy'] = int(dy)
        s, hx, hy, err = head_of(a, job.href)
        f['head'] = (hx, hy, s, err)
        hs.append(hx)
    # smooth head path: a new frame's head x may not jump more than JUMP px away from the line between its
    # nearest kept neighbours (+ its drawn offset, which follows the motion); larger -> shift the frame
    idx = [i for i, f in enumerate(frames) if f['img'] is not None]
    for i in idx:
        f = frames[i]
        if f['kind'] != 'new':
            continue
        prev = next((j for j in range(i - 1, -1, -1) if frames[j]['img'] is not None), None)
        nxt = next((j for j in range(i + 1, len(frames)) if frames[j]['img'] is not None), None)
        nb = [hs[j] for j in (prev, nxt) if j is not None]
        if not nb:
            continue
        lo, hi = min(nb) - 4, max(nb) + 4
        hx = hs[i]
        tgt = min(max(hx, lo), hi)
        sh = int(round(tgt - hx))
        if sh:
            f['img'] = np.roll(f['img'], sh, axis=1)
            hs[i] = hx + sh
            f['head'] = (f['head'][0] + sh,) + f['head'][1:]
        f['dx'] = sh
    s0 = frames[0]['head'][2] if frames[0]['img'] is not None else 1.0
    for f in frames:
        if f['img'] is None:
            f['checks'] = dict(ok=False, why='empty')
            continue
        hx, hy, s, err = f['head']
        rel = s / s0
        ys = np.where(f['img'][..., 3].any(1))[0]
        xs = np.where(f['img'][..., 3].any(0))[0]
        why = []
        if abs(rel - 1) > 0.03:
            why.append('head scale %.3f' % rel)
        if ys.max() != G:
            why.append('feet %d' % (ys.max() - G))
        if xs.min() == 0 or xs.max() == f['img'].shape[1] - 1 or ys.min() == 0:
            why.append('touches the cell edge')
        sim = None
        if f.get('pre') is not None:
            A, B = f['img'], f['pre']
            both = (A[..., 3] > 0) & (B[..., 3] > 0)
            same = both & (np.abs(A[..., :3].astype(int) - B[..., :3].astype(int)).sum(-1) < 30)
            sim = float(same.sum()) / max(1, (A[..., 3] > 0).sum())
            if sim > 0.75:
                why.append('still a copy of the guide (%.2f)' % sim)
        f['checks'] = dict(ok=not why, why=', '.join(why), head_scale=round(rel, 3), head=[round(hx, 1), round(hy, 1)],
                           height=int(ys.max() - ys.min() + 1), copy=None if sim is None else round(sim, 2), shift=[f.get('dx', 0), f.get('dy', 0)], err=round(err, 1))


def report(job, frames):
    for f in frames:
        c = f['checks']
        job.log('  %s frame %d %-5s %s' % (job.action, f['slot'], f['kind'], json.dumps(c)))


# ------------------------------------------------------------------------------------------------ apply to v2
def cmd_apply(o):
    look = o.look
    a, m = base_sheet(look)
    sdir = os.path.join(STORE, look)
    state = json.load(open(os.path.join(sdir, 'state.json')))
    info = char_info(look)
    ai, fi = frame_px(a, m, 'idle_a')
    href = head_ref(ai)
    _, ihx, ihy, _ = head_of(ai, href)
    anc0 = fi['anchor']
    blocks = []
    for action in ('attack', 'cast', 'victory'):
        st = state.get(action)
        if not st or not st.get('frames') or not st.get('accepted', True):
            continue
        plan = PLANS[action](info['weaponType'])
        lay = st['lay']
        # anchor of our cells: the idle head sits at the same offset from the anchor as in the original sheet
        ax = int(round(lay['HX'] - (ihx - anc0[0])))
        ay = lay['G']
        imgs = {}
        for f in st['frames']:
            pth = os.path.join(sdir, action, '%02d.png' % f['slot'])
            imgs[f['slot']] = np.asarray(Image.open(pth).convert('RGBA'))
        used = []
        for sl in plan['anim']['slots']:
            if sl not in used:
                used.append(sl)
        blocks.append((action, plan, lay, ax, ay, imgs, used))
    # pack: one row per action below the sheet
    y = a.shape[0]
    W = max([a.shape[1]] + [len(b[6]) * b[2]['W'] for b in blocks])
    H = y + sum(b[2]['H'] for b in blocks)
    sheet = np.zeros((H, W, 4), np.uint8)
    sheet[:a.shape[0], :a.shape[1]] = a
    for action, plan, lay, ax, ay, imgs, used in blocks:
        ids = {}
        for n, sl in enumerate(used):
            fid = '%s_%02d' % (PREFIX[action], n + 1)
            ids[sl] = fid
            x = n * lay['W']
            img = imgs[sl]
            sheet[y:y + lay['H'], x:x + lay['W']] = img
            m['frames'].append(dict(id=fid, x=x, y=y, w=lay['W'], h=lay['H'], anchor=[ax, ay], points=points_of(img, href)))
            m['poses'][fid] = [len(m['frames']) - 1]
        an = plan['anim']
        ent = dict(frames=[ids[s] for s in an['slots']], ms=list(an['ms']), loop=action == 'victory')
        for k in ('hit', 'release', 'loop_from'):
            if k in an:
                ent[k] = an[k]
        if action == 'attack':
            ent['weapon'] = info['weaponType']
            ent['fx_at'] = 'front'
        m['anims'][ANIM[action]] = ent
        y += lay['H']
    pp, jp = v2_paths(look)
    Image.fromarray(sheet).save(pp, optimize=True)
    json.dump(m, open(jp, 'w'), ensure_ascii=False, indent=1)
    print('%s: %s' % (look, ', '.join('%s %d frames' % (ANIM[b[0]], len(b[1]['anim']['slots'])) for b in blocks)))


def points_of(img, href):
    al = img[..., 3] > 0
    ys, xs = np.where(al)
    s, hx, hy, _ = head_of(img, href)
    fy = ys[xs == xs.min()]
    return dict(head=[int(round(hx)), int(round(hy))], center=[int(round(xs.mean())), int(round(ys.mean()))],
                front=[int(xs.min()), int(np.median(fy))])


# ------------------------------------------------------------------------------------------------ previews
def load_anim(look, action):
    pp, jp = v2_paths(look)
    m = json.load(open(jp))
    a = np.asarray(Image.open(pp).convert('RGBA'))
    an = m['anims'].get(ANIM[action])
    if not an:
        return None
    F = {f['id']: f for f in m['frames']}
    out = []
    for fid, ms in zip(an['frames'], an['ms']):
        f = F[fid]
        out.append((a[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w']], f['anchor'], ms, fid))
    return out, m, a, F


def cmd_preview(o):
    os.makedirs(o.out, exist_ok=True)
    k = o.scale
    rows = []
    for action in ('attack', 'cast', 'victory'):
        r = load_anim(o.look, action)
        if not r:
            continue
        seq, m, a, F = r
        idle = F['idle_a']
        ia = a[idle['y']:idle['y'] + idle['h'], idle['x']:idle['x'] + idle['w']]
        # common canvas: anchor-aligned
        L = max([f[1][0] for f in seq] + [idle['anchor'][0]])
        R = max([f[0].shape[1] - f[1][0] for f in seq] + [idle['w'] - idle['anchor'][0]])
        T = max([f[1][1] for f in seq] + [idle['anchor'][1]])
        Wc, Hc = L + R, T + 4
        bg = (58, 62, 74, 255)

        def put(img, anc):
            c = Image.new('RGBA', (Wc, Hc), bg)
            c.alpha_composite(Image.fromarray(img), (L - anc[0], T - anc[1]))
            d = ImageDraw.Draw(c)
            d.line([(0, T + 1), (Wc, T + 1)], fill=(90, 96, 110, 255))
            return c.resize((Wc * k, Hc * k), Image.NEAREST)
        frames = [put(ia, idle['anchor'])] + [put(img, anc) for img, anc, ms, fid in seq]
        durs = [400] + [ms for _, _, ms, _ in seq]
        if action == 'victory':
            lf = m['anims'][ANIM[action]].get('loop_from', 0)
            loop = seq[lf:]
            for _ in range(2):
                frames += [put(img, anc) for img, anc, ms, fid in loop]
                durs += [ms for _, _, ms, _ in loop]
        else:
            frames.append(put(ia, idle['anchor']))
            durs.append(500)
        gif = os.path.join(o.out, '%s_%s.gif' % (o.look, action))
        frames[0].save(gif, save_all=True, append_images=frames[1:], duration=durs, loop=0, disposal=2)
        # contact row (1x frames at k) with labels
        strip = Image.new('RGBA', (Wc * k * (len(seq) + 1), Hc * k + 14), bg)
        for i, fr in enumerate([put(ia, idle['anchor'])] + [put(img, anc) for img, anc, _, _ in seq]):
            strip.alpha_composite(fr, (i * Wc * k, 14))
            lab = 'idle_a' if i == 0 else seq[i - 1][3]
            ImageDraw.Draw(strip).text((i * Wc * k + 3, 1), lab, fill=(230, 230, 230, 255))
        rows.append(strip)
        print(gif)
    if rows:
        W = max(r.size[0] for r in rows)
        H = sum(r.size[1] for r in rows)
        cs = Image.new('RGBA', (W, H), (40, 42, 50, 255))
        y = 0
        for r in rows:
            cs.alpha_composite(r, (0, y))
            y += r.size[1]
        p = os.path.join(o.out, '%s_contact.png' % o.look)
        cs.save(p)
        print(p)


def images_used():
    p = os.environ.get('OPENAI_USAGE_LOG', '')
    n = 0
    if p and os.path.exists(p):
        for line in open(p):
            try:
                e = json.loads(line)
            except Exception:
                continue
            if str(e.get('tag', '')).startswith(TAG + '_'):
                n += int(e.get('images', 0))
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('gen')
    s.add_argument('look')
    s.add_argument('action', choices=list(PLANS))
    s.add_argument('--quality', default='high', choices=['low', 'medium', 'high'])
    s.add_argument('--extra', default='')
    s.add_argument('--pitch', type=int, default=None)
    s.add_argument('--dry', action='store_true')
    s = sub.add_parser('norm')
    s.add_argument('look')
    s.add_argument('action', choices=list(PLANS))
    s.add_argument('--raw', default=None)
    s = sub.add_parser('apply')
    s.add_argument('look')
    s = sub.add_parser('preview')
    s.add_argument('look')
    s.add_argument('--out', required=True)
    s.add_argument('--scale', type=int, default=3)
    sub.add_parser('count')
    o = ap.parse_args()
    if o.cmd == 'gen':
        cmd_gen(o)
    elif o.cmd == 'norm':
        cmd_norm(o)
    elif o.cmd == 'apply':
        cmd_apply(o)
    elif o.cmd == 'preview':
        cmd_preview(o)
    elif o.cmd == 'count':
        print(images_used())


if __name__ == '__main__':
    main()
