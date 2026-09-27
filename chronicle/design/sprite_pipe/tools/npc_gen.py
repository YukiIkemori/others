"""NPC sheets with the image API (NPC_REQUEST.md, npc_sheets.json) — the `npc` subcommand of tools/gen_sheets.py.

  python3 tools/gen_sheets.py npc berna --sheets 1                 # one unit (resumes: sheets already made are skipped)
  python3 tools/gen_sheets.py npc grp_pen_1                        # a tier C pair sheet (unit id = grp_<group>)
  python3 tools/gen_sheets.py npc berna --sheets 1 --redo "..."    # a new full attempt with notes (after a look by eye)
  python3 tools/gen_sheets.py npc berna --approve 1                # the design reference (_s1) is approved by eye
  python3 tools/gen_sheets.py npc-batch --tier A --sheets 1        # every unit of a tier, in npc_sheets.json order
  python3 tools/gen_sheets.py npc-export berna grp_pen_1           # full pipeline + tools/to_v2.py (v2/assets/sprites/<look>)
  python3 tools/gen_sheets.py npc-lineup berna fine … --out x.png  # town lineup next to Arun at field scale (1 art px = 4 px)
  python3 tools/gen_sheets.py npc-contact berna fine … --out x.png # the normalised sheets side by side (eye review)
  python3 tools/gen_sheets.py npc-prompt berna 1                   # print the prompt only

How a sheet is made: an EDIT of a layout template drawn with Arun's delivered sheets (walk = sheet 1, acting = sheet 3,
faces = sheet 9), every figure uniformly scaled to the NPC's body height. The model repaints costume, hair, face and
props and keeps the body proportions and poses (the owner's rule: chunky, about 2.7 heads, like Arun). Then the raw
image is normalised onto the exact 8 px layout canvas (gen_sheets.normalize_full; a pair sheet per half, each at its
person's height), the pipeline checks it (tools/sheets.py --npc, including the proportion check of tools/npc_spec.py),
and redo lines are fixed: few bad cells -> cell edit, many / sheet-level (proportion, missing) -> a full redraw with the
problems listed. At most 3 images per sheet.

Outputs: design/art_ref/gen/npc/<unit>/ (sheets, manifest.json, state.json, gen_log.txt, raw/ = raw images, gitignored)
         design/sprite_pipe/out/npc/<look>/ (pipeline) and, on export, chronicle/v2/assets/sprites/<look>/.
Budget: images tagged npc_* in the shared usage log; this tool stops at NPC_IMAGE_CAP (env, default 400).
"""
import copy
import json
import os
import re
import shutil
import subprocess
import sys
import time

from PIL import Image, ImageDraw, ImageFont

import gen_api
import gen_sheets as G
from npc_spec import ARUN_PROP, SPEC_JSON

NPC_MD = os.path.join(G.ART, 'NPC_REQUEST.md')
OUT = os.path.join(G.PIPE, 'out', 'npc')
MAX_IMAGES_PER_SHEET = 3
PITCH = {'walk': 6, 'walk_act': 6, 'act12': 6, 'face6': 6, 'walk_pair': 5}
FONT = os.path.join(G.DESIGN, 'art_proto', 'fonts', 'ZenMaruGothic-Medium.ttf')
# acting poses whose head reads ~125-130 % in the head-scale check on Arun's own sheet 3 as well (crouched head):
# not a drawing problem, never redrawn for 'scale' below this bound
SCALE_FALSE = {'act_kneel': 1.42, 'act_sit': 1.42}
# upright poses: the pipeline's head-template scale check reads caps, hoods and beards as a smaller head (tadeo: every
# pose 50-51 art px tall, three flagged at 75 %). Their size is covered by the bbox height check, so 'scale' is not redrawn
UPRIGHT_SCALE_SKIP = {'walk_%s_%d' % (d, i) for d in ('down', 'up', 'left', 'right') for i in range(3)} | {
    'act_nod', 'act_surprise', 'act_think', 'act_call', 'act_resolve', 'act_sig'}

G.POSE_EN.update({
    'act_sig': "the person's SIGNATURE GESTURE (see the brief)",
    'face_sad': 'face bust, sad', 'face_angry': 'face bust, angry / stern', 'face_closed': 'face bust, eyes gently closed (prayer, memory, singing)',
})
for _k in list(G.POSE_EN):
    if _k.startswith('walk_'):
        G.POSE_EN['A:' + _k] = 'person A (left half), ' + G.POSE_EN[_k]
        G.POSE_EN['B:' + _k] = 'person B (right half), ' + G.POSE_EN[_k]


# ------------------------------------------------------------------------------------------ specs
def load():
    return json.load(open(SPEC_JSON, encoding='utf-8'))


def units(js=None, tier=None):
    """[(unit id, tier, [sheet n …])] in npc_sheets.json order (tier A/B: npc id; tier C: grp_<group>)"""
    js = js or load()
    out, seen = [], {}
    for o in js['order']:
        if o['no'] > js['totals']['sheets']:          # 101 / 102: optional battle sheets
            continue
        uid = o['id'] if o['tier'] != 'C' else 'grp_' + o['id'].replace('grp_', '')
        if o['tier'] == 'C':
            uid = 'grp_' + next(g['id'] for g in js['groups'] if g['file'] == o['file'])
        if uid not in seen:
            seen[uid] = (uid, o['tier'], [])
            out.append(seen[uid])
        n = 1
        if o['tier'] == 'A':
            n = int(o['file'].split('_s')[-1][0])
        seen[uid][2].append(n)
    return [u for u in out if tier is None or u[1] in tier]


def unit_info(uid, js=None):
    """-> dict(uid, tier, name, looks=[person dicts], npc=tier A/B dict or None, group=dict or None, specs={n: spec})"""
    js = js or load()
    if uid.startswith('grp_'):
        g = next((x for x in js['groups'] if x['id'] == uid[4:]), None)
        if g is None:
            raise SystemExit('unknown group %s' % uid)
        people = [dict(p, tier='C', headgearExtraDots=p['measureH']['field'] - p['heightDots']['field']) for p in g['people']]
        ids = [[s + ':walk_%s_%d' % (d, i) for s in ('A', 'B') for i in range(3)] for d in ('down', 'up', 'left', 'right')]
        spec = dict(n=1, file=g['file'], layout='walk_pair', rows=4, cols=6, cell=[80, 64], ids=ids,
                    target=max(p['measureH']['field'] for p in people), stand=[i for r in ids for i in r], air=[],
                    face=['down', 'up', 'left', 'right'], gen_grid=(4, 6), people=people)
        return dict(uid=uid, tier='C', name=' + '.join(p['name'] for p in people), looks=people, npc=None, group=g,
                    specs={1: spec}, char=dict(name=' and '.join(p['name'] for p in people), id=uid))
    n = next((x for x in js['npcs'] if x['id'] == uid), None)
    if n is None:
        raise SystemExit('unknown npc %s' % uid)
    L = js['layouts']
    specs = {}
    mh = n['measureH']['field']
    for s in n['sheets']:
        lay = s['layout']
        if lay == 'battle_single':
            continue
        a = L[lay]
        rows, cols = a['grid']
        ids = [list(r) for r in a['ids']]
        if lay == 'walk':
            stand, target = [i for r in ids for i in r], mh
        elif lay == 'walk_act':
            stand, target = [i for r in ids for i in r[:3]] + ['act_nod', 'act_call', 'act_sig'], mh
        elif lay == 'act12':
            stand, target = list(a['stand']), mh
        else:
            stand, target = [i for r in ids for i in r], n['heightDots'].get('face', 80)
        specs[s['n']] = dict(n=s['n'], file=s['file'], layout=lay, rows=rows, cols=cols, cell=list(a['cellDots']), ids=ids,
                             target=target, stand=stand, air=[], face=list(a['face']), gen_grid=(rows, cols))
    return dict(uid=uid, tier=n['tier'], name=n['name'], looks=[n], npc=n, group=None, specs=specs, char=dict(name=n['name'], id=uid))


# ------------------------------------------------------------------------------------------ templates (Arun, scaled)
_ARUN = {}


def arun_cells(n):
    if n not in _ARUN:
        d, e = G.arun_dots(n)
        _ARUN[n] = {(r, c): G.cell_sprite(d, e['cell'], r, c) for r in range(e['rows']) for c in range(e['cols'])}
    return _ARUN[n]


def scaled(sp, k):
    if sp is None or abs(k - 1) < 0.02:
        return sp
    return sp.resize((max(1, int(round(sp.size[0] * k))), max(1, int(round(sp.size[1] * k)))), Image.NEAREST)


def template(u, spec):
    """RGBA art-px canvas of the layout, drawn with Arun scaled to the NPC's body height (None: no usable template)"""
    lay = spec['layout']
    cw, ch = spec['cell']
    if lay in ('walk', 'walk_act'):
        p = u['looks'][0]
        k = p['heightDots']['field'] / 48.0
        w = arun_cells(1)
        cells = [(r, c, scaled(w[(r, c)], k)) for r in range(4) for c in range(3)]
        if lay == 'walk_act':
            a = arun_cells(3)
            for r, rc in enumerate([(0, 0), (0, 1), (1, 2), (2, 2)]):     # nod, surprise, call, resolve (base of the signature)
                cells.append((r, 3, scaled(a[rc], k)))
        return G.compose(cells, spec['rows'], spec['cols'], spec['cell'], G.ground_of(spec))
    if lay == 'act12':
        k = u['looks'][0]['heightDots']['field'] / 48.0
        a = arun_cells(3)
        cells = [(r, c, scaled(a[(r, c)], k)) for r in range(3) for c in range(4)]
        return G.compose(cells, 3, 4, spec['cell'], G.ground_of(spec))
    if lay == 'face6':
        f = arun_cells(9)
        pick = [(0, 0), (0, 2), (1, 1), (1, 2), (1, 0), (0, 1)]   # neutral smile sad angry surprise, serious (-> eyes closed)
        cells = [(k // 3, k % 3, f[rc]) for k, rc in enumerate(pick)]
        return G.compose(cells, 2, 3, spec['cell'], ch - 4)
    if lay == 'walk_pair':
        w = arun_cells(1)
        cells = []
        for h, p in enumerate(spec['people']):
            if p.get('kind') == 'animal':
                continue
            k = p['heightDots']['field'] / 48.0
            cells += [(r, 3 * h + c, scaled(w[(r, c)], k)) for r in range(4) for c in range(3)]
        if not cells:
            return None
        return G.compose(cells, 4, 6, spec['cell'], G.ground_of(spec))
    return None


# ------------------------------------------------------------------------------------------ prompt
LAYOUT_JA = {'walk': '形A 歩き', 'act12': '形B 演技12', 'face6': '形C 顔6', 'walk_act': '形D 歩き＋演技4', 'walk_pair': '形E 二人の歩き'}


def person_section(u):
    if u['tier'] == 'C':
        g = u['group']
        return G.md_section(NPC_MD, r'通し番号 %d　' % g['no'], level=4)
    n = u['npc']
    if n['tier'] == 'A':
        return G.md_section(NPC_MD, r'%s（%s）' % (n['name'], n['id']), level=4)
    no = next(s['no'] for s in n['sheets'])
    return G.md_section(NPC_MD, r'通し番号 %d　' % no, level=4)


def culture_text(u, js):
    reg = (u['group'] or {}).get('culture') or (u['npc'] or {}).get('region')
    c = js['cultures'].get(reg) if reg else None
    if not c:
        return ''
    return 'REGIONAL COSTUME CULTURE (%s): light %s / clothes %s / colours %s / head %s / avoid %s' % (
        c['name'], c['light'], c['clothes'], c['colors'], c['head'], c['avoid'])


def prop_text(bh):
    return ('PROPORTIONS (hard rule, the same as the hero Arun): about 2.7 heads tall, BIG head, slim neck, short sturdy body, LOW centre '
            'of gravity. For this %d art px body: head (top of hair to chin) about %d art px (a third of the body), head width about %d art px '
            '(%.2f x height), shoulders about %d art px wide. NOT realistic or slender adult proportions, no long legs, no small head. '
            'Children and short or tall people change only their overall height; the head stays this big relative to the body.'
            % (bh, round(bh / 3.0), round(ARUN_PROP['head_w'] * bh), ARUN_PROP['head_w'], round(ARUN_PROP['shoulder'] * bh)))


def key_look(p):
    t = ['%s (%s): %s' % (p['name'], p.get('look'), p.get('look_ja', ''))]
    if p.get('headShape'):
        t.append('head silhouette: ' + p['headShape'])
    t.append('MAIN colour %s (%s, hue %s deg) on about half of the clothing, one hue ramp only; do not drift to a brighter or more saturated colour'
             % (p.get('mainHex'), p.get('mainName'), p.get('mainHue')))
    if p.get('sub'):
        t.append('secondary / props: ' + p['sub'])
    if p.get('carry'):
        t.append('carries: ' + p['carry'])
    t.append('LANTERN: %s' % ('YES, an unlit brass lantern in the LEFT hand in every walk frame (like the template)' if p.get('lantern')
                               else 'NO lantern (remove the template\'s lantern; the left hand is empty or holds the listed prop)'))
    if p.get('spirit'):
        t.append('SPIRIT: drawn fully opaque, NO FEET: the robe hem tapers to a point at the ground; walk frames = small sway/bob of body and hem')
    if p.get('sigPose'):
        t.append('signature gesture: ' + p['sigPose'])
    if p.get('avoid'):
        t.append('must NOT look like: ' + p['avoid'])
    t.append('body height: %d art px head to soles (headgear/packs may add about %d more)' % (p['heightDots']['field'], p.get('headgearExtraDots') or 0))
    return '\n'.join('- ' + x for x in t)


def npc_prompt(u, spec, p, W, H, desc, extra='', has_tpl=True):
    js = load()
    lay = spec['layout']
    gr, gc = spec['gen_grid']
    cw, ch = spec['cell']
    order = []
    for r in range(spec['rows']):
        order.append('row %d: %s' % (r + 1, ' | '.join(G.POSE_EN.get(s, s) for s in spec['ids'][r])))
    rules = G.md_section(NPC_MD, r'2\. 全シート共通の決まり', level=2)
    sheet = G.md_section(NPC_MD, r'歩きの共通の決まり', level=3) if lay in ('walk', 'walk_act', 'walk_pair') else ''
    sheet = (sheet + '\n\n' if sheet else '') + G.md_section(NPC_MD, re.escape(LAYOUT_JA[lay]))
    looks = u['looks']
    if lay == 'walk_pair':
        who = 'two townsfolk archetypes: LEFT three columns = person A, RIGHT three columns = person B (never mix them)'
    else:
        who = '%s (%s)' % (u['npc']['name'], u['npc']['id'])
    task = []
    if has_tpl:
        task.append('TASK: EDIT image 1. It is a finished pixel-art sprite sheet whose figures are the hero Arun, already scaled to the '
                    'right size. REPAINT EVERY FIGURE AS THE NPC(S) DESCRIBED BELOW: new hair, face, costume, colours and props. KEEP from image 1: '
                    'the canvas size, the grid and cell positions, every pose, the facing of every frame, the feet line of each row, the '
                    'figure height and the BODY PROPORTIONS (head size and width, neck, shoulders, torso and leg length). Long robes, capes, '
                    'hunched backs, beards, hats and packs may change the silhouette below the neck / above the head, but the head stays the '
                    'same size. NOTHING of Arun may remain: no ash-brown messy hair, no red scarf, no black coat + cream cloth + brown leather, '
                    'no sword at the hip.')
    else:
        task.append('TASK: draw one pixel-art sprite sheet on the canvas below (animals / creatures: no human template).')
    if lay == 'act12':
        task.append('Frame 10 (row 3, column 2) becomes the NPC\'s signature gesture (see below), not a sword pose.')
    if lay == 'walk_act':
        task.append('Column 4 = acting poses, ALL facing the viewer on every row: nod, surprised, raise a hand and call, and (row 4) the NPC\'s '
                    'signature gesture (repaint the hand-on-chest base into that gesture).')
    if lay == 'face6':
        task.append('Chest-up busts turned slightly to the RIGHT, all six identical except the facial expression: neutral, smile, sad / '
                    'angry (stern), surprised, eyes gently closed. Frame 6 (the template\'s serious face) becomes EYES CLOSED.')
    txt = [G.style_block(), '',
           'You are the pixel artist of a 2D RPG. ONE sprite sheet of %s, sheet layout %s.' % (who, LAYOUT_JA[lay]),
           ' '.join(task), '',
           'ATTACHED IMAGES:', desc, '',
           'CANVAS: %dx%d px, flat #FF00FF. %d rows x %d columns, each cell %dx%d px (%dx%d art px); one art pixel = %dx%d image px '
           'everywhere (this overrides the 8 px of the Japanese rules). One pose centred in each cell, never crossing into a neighbour '
           'cell or the image edge.' % (W, H, gr, gc, cw * p, ch * p, cw, ch, p, p),
           'POSES (reading order):\n' + '\n'.join(order)]
    if lay != 'face6':
        txt += ['', '\n'.join(prop_text(x['heightDots']['field']) if x.get('kind') != 'animal' else
                              'ANIMAL %s: about %d art px tall at the back/shoulder, four legs, 3-frame walk per direction.' % (x['name'], x['heightDots']['field'])
                              for x in looks)]
    for i, x in enumerate(looks):
        txt += ['', ('PERSON %s (%s three columns):\n' % ('AB'[i], ('left', 'right')[i]) if lay == 'walk_pair' else 'THE NPC:\n') + key_look(x)]
    cul = culture_text(u, js)
    if cul:
        txt += ['', cul, 'The regional costume must read at a glance (silhouette and colours); never a generic medieval outfit.']
    if u['tier'] != 'A':
        txt.append('Townsfolk / named NPC palette: one step LESS saturated than the party (calm, worn colours).')
    txt += ['', 'NPC BRIEF (Japanese, authoritative):\n' + person_section(u), '',
            'SHEET BRIEF (Japanese):\n' + sheet, '', 'COMMON RULES (Japanese):\n' + rules]
    if extra:
        txt += ['', 'EXTRA INSTRUCTIONS FOR THIS ATTEMPT (fix these):\n' + extra]
    return '\n'.join(txt)



# ------------------------------------------------------------------------------------------ budget
def npc_images_used():
    p = gen_api.usage_log_path()
    n = 0
    if os.path.exists(p):
        for line in open(p):
            try:
                e = json.loads(line)
            except Exception:
                continue
            if str(e.get('tag', '')).startswith('npc_'):
                n += int(e.get('images', 0))
    return n


def npc_cap():
    try:
        return int(os.environ.get('NPC_IMAGE_CAP') or 400)
    except ValueError:
        return 400


def generate(prompt, imgs, W, H, quality, tag):
    used = npc_images_used()
    if used + 1 > npc_cap():
        raise gen_api.GenError('NPC image cap reached (%d / %d); stop and report' % (used, npc_cap()))
    # the shared GEN_IMAGE_CAP counts every tool's images; the NPC task has its own cap (above)
    os.environ['GEN_IMAGE_CAP'] = str(gen_api.images_used() + 10)
    # (no input_fidelity: the image tool behind the model rejects that parameter)
    return gen_api.generate(prompt, imgs, size='%dx%d' % (W, H), quality=quality, background='opaque', tag=tag)


# ------------------------------------------------------------------------------------------ one sheet
def job_of(u):
    return G.Job('npc', u['uid'], copy.deepcopy(u['specs']), char=u['char'])


def images_of(job, n):
    return len([a for a in job.st(n)['attempts'] if a.get('images', 1)])


def gen_size(spec):
    p = PITCH[spec['layout']]
    W, H = spec['gen_grid'][1] * spec['cell'][0] * p, spec['gen_grid'][0] * spec['cell'][1] * p
    return p, (W + 15) // 16 * 16, (H + 15) // 16 * 16


def refs_for(u, job, spec, p):
    imgs, desc = [], []
    tpl = template(u, spec)
    if tpl is not None:
        imgs.append(G.render_pitch(tpl, p))
        desc.append('Image 1 = THE SHEET TO EDIT (the hero Arun as a stand-in, already at this NPC\'s size). Keep its grid, poses, facing, '
                    'feet lines, figure size and body proportions; repaint the characters.')
    else:
        a1 = G.load_rgb(os.path.join(G.ARUN_SHEETS, 'arun_sheet_01.png'))
        imgs.append(a1.resize((a1.size[0] // 2, a1.size[1] // 2), Image.NEAREST))
        desc.append('Image 1 = the hero\'s walk sheet (half size): the grid, pixel density and shading to match. Do not draw the hero.')
    imgs.append(G.load_rgb(G.HERO_REF))
    desc.append('Image %d = QUALITY BAR (the hero\'s design sheet): match its pixel density, hue-shifted shading and outline. Do not copy '
                'the character, the text or the paper layout.' % len(imgs))
    if spec['n'] != 1 and 1 in job.specs:
        st1 = job.st(1)
        raw1 = st1.get('from_raw')
        s1 = os.path.join(job.dir, job.specs[1]['file'])
        src = os.path.join(job.dir, raw1) if raw1 and os.path.exists(os.path.join(job.dir, raw1)) else s1
        if os.path.exists(src):
            imgs.append(G.load_rgb(src))
            desc.append('Image %d = %s\'s APPROVED WALK SHEET: exactly how this person looks (same hair, face, outfit, colours, props, '
                        'proportions). Every figure you draw is this person.' % (len(imgs), u['name']))
    return imgs, '\n'.join(desc), tpl is not None


def normalize(u, spec, raw, log):
    """raw -> (8 px sheet, frames, notes, pitch). A pair sheet: each half at its own person's height."""
    if spec['layout'] != 'walk_pair':
        return G.normalize_full(raw, spec, log)
    W, H = raw.size
    half = W // 2
    canvas = Image.new('RGB', (6 * 80 * G.DOT, 4 * 64 * G.DOT), G.MAGENTA)
    frames, notes, ss = {}, [], []
    for h, p in enumerate(spec['people']):
        sub = dict(n=1, layout='walk', rows=4, cols=3, cell=[80, 64], ids=[[x.split(':')[1] for x in r[3 * h:3 * h + 3]] for r in spec['ids']],
                   target=p['measureH']['field'], stand=[], air=[], face=spec['face'], gen_grid=(4, 3))
        sub['stand'] = [i for r in sub['ids'] for i in r]
        log('  half %s (%s, target %d):' % ('AB'[h], p['look'], sub['target']))
        sh, fr, nt, s = G.normalize_full(raw.crop((h * half, 0, (h + 1) * half, H)), sub, log)
        canvas.paste(sh, (h * 3 * 80 * G.DOT, 0))
        for k, v in fr.items():
            frames['%s:%s' % ('AB'[h], k)] = dict(v, column=v['column'] + 3 * h)
        notes += ['%s: %s' % ('AB'[h], x) for x in nt]
        ss.append(s)
    return canvas, frames, notes, sum(ss) / len(ss)


def full_attempt(u, job, n, quality, extra='', log=None):
    spec = job.specs[n]
    st = job.st(n)
    if images_of(job, n) >= MAX_IMAGES_PER_SHEET:
        job.log('sheet %d: %d images used; leave it for a person' % (n, MAX_IMAGES_PER_SHEET))
        return None
    p, W, H = gen_size(spec)
    imgs, desc, has_tpl = refs_for(u, job, spec, p)
    prompt = npc_prompt(u, spec, p, W, H, desc, extra, has_tpl)
    k = len(st['attempts']) + 1
    base = os.path.join(job.raw, 's%d_a%d' % (n, k))
    open(base + '_prompt.txt', 'w', encoding='utf-8').write(prompt)
    imgs[0].save(base + '_in.png')
    if os.path.exists(base + '.png'):
        job.log('sheet %d attempt %d: raw image already saved, reusing it' % (n, k))
    else:
        job.log('sheet %d attempt %d: %s %dx%d (pitch %d, quality %s, %d refs)%s' % (
            n, k, 'edit of the Arun template' if has_tpl else 'generation', W, H, p, quality, len(imgs), ' + notes' if extra else ''))
        png, info = generate(prompt, imgs, W, H, quality, 'npc_%s_s%d_a%d' % (u['uid'], n, k))
        open(base + '.png', 'wb').write(png)
    st['attempts'].append(dict(raw=os.path.relpath(base + '.png', job.dir), quality=quality, kind='full', extra=extra[:400],
                               t=time.strftime('%Y-%m-%dT%H:%M:%S')))
    job.save()
    return finish(u, job, n, base + '.png')


def finish(u, job, n, raw_path):
    spec = job.specs[n]
    raw = G.load_rgb(raw_path)
    p, W, H = gen_size(spec)
    if raw.size != (W, H):
        raw = raw.resize((W, H), Image.LANCZOS)
    sheet, frames, notes, s = normalize(u, spec, raw, job.log)
    out = os.path.join(job.dir, spec['file'])
    sheet.save(out, optimize=True)
    st = job.st(n)
    st.update(frames=frames, notes=notes, pitch=round(s, 3), from_raw=os.path.relpath(raw_path, job.dir))
    st.pop('approved', None)
    job.save()
    job.write_manifest()
    for m in notes:
        job.log('  note: ' + m)
    job.log('sheet %d -> %s (%d poses)' % (n, os.path.relpath(out, G.DESIGN), len(frames)))
    return out


# ------------------------------------------------------------------------------------------ pipeline
def out_dir(look):
    return os.path.join(OUT, look)


def pipe(u, job, check=True, only=None):
    """run tools/sheets.py for every look of the unit -> {look: report.json path}"""
    res = {}
    for x in u['looks']:
        look = x['look']
        args = [job.dir, '--npc', look if u['tier'] == 'C' else u['npc']['id'], '--out', out_dir(look)]
        if check:
            args.append('--check')
        if only:
            args += ['--only', ','.join(map(str, only))]
        G.run_pipeline(args, job.log)
        res[look] = os.path.join(out_dir(look), 'report.json')
    return res


def redo_lines(u, job, reports, sheets):
    """{sheet n: [items]} of the redo lines that concern the sheets asked for (missing other sheets and the known
    crouch false positives left out). Pair sheets: slots get the A: / B: prefix."""
    out = {}
    for h, (look, rp) in enumerate(reports.items()):
        if not os.path.exists(rp):
            continue
        for it in G.redo_items(rp):
            n = it['sheet'] if u['tier'] != 'C' else 1
            if n not in sheets or it['code'] == 'missing_sheet':
                continue
            sc = (it.get('data') or {}).get('scale')
            if it['code'] == 'scale' and it['slot'] in SCALE_FALSE and sc and sc < SCALE_FALSE[it['slot']]:
                continue
            if it['code'] == 'scale' and it['slot'] in UPRIGHT_SCALE_SKIP:
                continue      # upright pose: its size is checked by the bbox height ('height'); the head match misreads hats / beards
            if u['tier'] == 'C' and it.get('slot'):
                it['slot'] = '%s:%s' % ('AB'[h], it['slot'])
            out.setdefault(n, []).append(it)
    return out


def en_for(it):
    code = it.get('code') or ''
    if code == 'proportion':
        return ('PROPORTIONS WRONG: the head is too small / the figure too slender. Use exactly the hero\'s proportions from the template: '
                'about 2.7 heads tall, big head (a third of the body height), short sturdy body, low centre of gravity.')
    if code in ('facing', 'facing_row'):
        return 'A pose faces the wrong way: walk rows are down / up / left / right; acting poses face the viewer.'
    if code in ('missing', 'clipped'):
        return 'A pose is missing or cut off: draw every pose of the grid, each fully inside its own cell.'
    if code in ('height', 'scale'):
        return 'A pose has the wrong size: every pose keeps the same body scale (same head size) as the others.'
    return ''


def fix(u, job, n, quality, items):
    """one fix step for sheet n: many bad cells / sheet-level problems -> full redraw with notes; else cell edits"""
    spec = job.specs[n]
    slots = {i['slot'] for i in items if i.get('slot')}
    n_cells = len([x for r in spec['ids'] for x in r if x])
    sheet_level = any(i['code'] in ('proportion', 'bg_not_magenta') or not i.get('slot') for i in items)
    if sheet_level or len(slots) >= max(4, n_cells // 3):
        notes = []
        for i in items:
            t = en_for(i)
            notes.append((t + ' ' if t else '') + '(%s)' % (i.get('ask') or i.get('msg')))
        return full_attempt(u, job, n, quality, extra='\n'.join('- ' + x for x in dict.fromkeys(notes)))
    if images_of(job, n) >= MAX_IMAGES_PER_SHEET:
        return None
    G.enrich(items, None)
    for i in items:
        i['en'] = (i.get('en') or '') + ' ' + en_for(i)
    path = os.path.join(job.dir, spec['file'])
    k = len(job.st(n)['attempts']) + 1
    tag = 'fix%d' % k
    before = gen_api.images_used()
    G.edit_cells(job, n, path, items, quality, tag)
    got = gen_api.images_used() - before
    job.st(n)['attempts'].append(dict(kind='edit', slots=sorted(slots), images=max(1, got), t=time.strftime('%Y-%m-%dT%H:%M:%S')))
    job.save()
    job.write_manifest()
    return path


def run_unit(uid, sheets=None, quality='medium', force=False, redo=None, max_images=MAX_IMAGES_PER_SHEET, check=True):
    u = unit_info(uid)
    job = job_of(u)
    sheets = sheets or sorted(u['specs'])
    for n in sheets:
        if n not in job.specs:
            continue
        spec = job.specs[n]
        out = os.path.join(job.dir, spec['file'])
        if n != 1 and u['tier'] == 'A' and not job.st(1).get('approved'):
            job.log('sheet %d: the walk sheet (s1) is not approved yet (npc %s --approve 1 after looking at it)' % (n, uid))
            continue
        if redo is not None:
            if full_attempt(u, job, n, quality, extra=redo) is None:
                continue
        elif not os.path.exists(out) or force:
            if full_attempt(u, job, n, quality) is None:
                continue
        else:
            job.log('sheet %d: %s exists (resume)' % (n, spec['file']))
        if not check:
            continue
        # check -> fix, while images are left for this sheet
        while True:
            reps = pipe(u, job, check=True)
            items = redo_lines(u, job, reps, [n]).get(n, [])
            st = job.st(n)
            st['redo_left'] = [dict(code=i['code'], slot=i.get('slot'), msg=i.get('msg')) for i in items]
            job.save()
            job.log('sheet %d: %d redo lines%s' % (n, len(items), (': ' + ' / '.join(i['msg'] for i in items))[:600] if items else ''))
            keep_candidate(job, n, items)
            if not items or images_of(job, n) >= min(max_images, MAX_IMAGES_PER_SHEET):
                break
            if fix(u, job, n, quality, items) is None:
                break
        if items and restore_best(job, n):
            reps = pipe(u, job, check=True)
            items = redo_lines(u, job, reps, [n]).get(n, [])
            job.st(n)['redo_left'] = [dict(code=i['code'], slot=i.get('slot'), msg=i.get('msg')) for i in items]
            job.save()
            job.log('sheet %d (best take restored): %d redo lines' % (n, len(items)))
    return job


def score(items):
    return sum(3 if i.get('code') == 'proportion' else 1 for i in items)


def keep_candidate(job, n, items):
    """every checked take of a sheet is kept (raw/s<n>_take<k>.png) with its score, so a later attempt that came out
    worse never replaces a better one"""
    st = job.st(n)
    c = st.setdefault('takes', [])
    src = os.path.join(job.dir, job.specs[n]['file'])
    dst = os.path.join(job.raw, 's%d_take%d.png' % (n, len(c) + 1))
    shutil.copy(src, dst)
    c.append(dict(file=os.path.relpath(dst, job.dir), score=score(items), frames=st.get('frames'), from_raw=st.get('from_raw'),
                  cell=list(job.specs[n]['cell'])))
    job.save()


def restore_best(job, n):
    st = job.st(n)
    c = st.get('takes') or []
    if len(c) < 2:
        return False
    best = min(range(len(c)), key=lambda k: (c[k]['score'], -k))
    if best == len(c) - 1:
        return False
    t = c[best]
    shutil.copy(os.path.join(job.dir, t['file']), os.path.join(job.dir, job.specs[n]['file']))
    st.update(frames=t['frames'], from_raw=t['from_raw'], restored_take=best + 1)
    if t.get('cell'):
        job.specs[n]['cell'] = list(t['cell'])
        st['cell'] = list(t['cell'])
    job.save()
    job.write_manifest()
    job.log('sheet %d: take %d (score %d) is better than the last take (score %d): restored' % (n, best + 1, t['score'], c[-1]['score']))
    return True


# ------------------------------------------------------------------------------------------ export / review images
def export(uid):
    u = unit_info(uid)
    job = job_of(u)
    pipe(u, job, check=False)
    done = []
    for x in u['looks']:
        od = out_dir(x['look'])
        if not os.path.exists(os.path.join(od, 'npc.json')):
            continue
        r = subprocess.run([sys.executable, os.path.join(G.TOOLS, 'to_v2.py'), od], cwd=G.PIPE, capture_output=True, text=True)
        job.log('to_v2 %s: %s' % (x['look'], (r.stdout + r.stderr).strip().replace('\n', ' | ')[:300]))
        done.append(x['look'])
    return done


def _font(sz):
    try:
        return ImageFont.truetype(FONT, sz)
    except Exception:
        return ImageFont.load_default()


def field_sprite(look, sid='walk_down_0'):
    for d in (os.path.join(OUT, look, 'sprites'), os.path.join(OUT, look, 'native'), os.path.join(G.PIPE, 'out', look, 'sprites')):
        p = os.path.join(d, sid + '.png')
        if os.path.exists(p):
            return Image.open(p).convert('RGBA')
    return None


def lineup(uids, out, z=4, sid='walk_down_0', companions=True):
    """Arun first, then the NPCs' looks (and the companions made so far), feet on one line, 1 art px = z px"""
    items = [('アルン', Image.open(os.path.join(G.PIPE, 'out', 'arun_v1', 'sprites', sid + '.png')).convert('RGBA'))]
    js = load()
    for uid in uids:
        u = unit_info(uid, js)
        for x in u['looks']:
            im = field_sprite(x['look'], sid)
            if im is not None:
                items.append(('%s %d' % (x['name'], x['heightDots']['field']), im))
    if companions:
        for d in sorted(os.listdir(os.path.join(G.PIPE, 'out'))):
            if d.startswith('comp_') and not d.startswith('comp_mock'):
                p = os.path.join(G.PIPE, 'out', d, 'sprites', sid + '.png')
                if os.path.exists(p):
                    items.append(('仲間 ' + d[5:], Image.open(p).convert('RGBA')))
    per_row = 14
    rows = [items[i:i + per_row] for i in range(0, len(items), per_row)]
    cellw = max(im.size[0] for _, im in items) + 6
    maxh = max(im.size[1] for _, im in items)
    rh = (maxh + 14) * z
    W = per_row * cellw * z
    img = Image.new('RGB', (W, rh * len(rows)), (58, 62, 74))
    d = ImageDraw.Draw(img)
    f = _font(max(12, 3 * z + 2))
    for ri, row in enumerate(rows):
        base = ri * rh + (maxh + 4) * z
        for y in range(0, 60, 12):                        # height guides: 36 / 48 / 54 art px above the feet
            pass
        for gy, col in ((48, (120, 90, 90)), (36, (90, 90, 120))):
            d.line([(0, base - gy * z), (W, base - gy * z)], fill=col, width=1)
        for i, (name, im) in enumerate(row):
            big = im.resize((im.size[0] * z, im.size[1] * z), Image.NEAREST)
            x = i * cellw * z + (cellw * z - big.size[0]) // 2
            img.paste(big, (x, base - big.size[1]), big)
            d.text((i * cellw * z + 4, base + 4), name, fill=(235, 235, 235), font=f)
    img.save(out)
    return out, len(items)


def contact(uids, out, scale=0.25):
    """the normalised sheets (8 px) of the units, scaled down, side by side with names"""
    tiles = []
    for uid in uids:
        u = unit_info(uid)
        job = job_of(u)
        for n, spec in sorted(job.specs.items()):
            p = os.path.join(job.dir, spec['file'])
            if os.path.exists(p):
                im = Image.open(p).convert('RGB')
                im = im.resize((int(im.size[0] * scale), int(im.size[1] * scale)), Image.NEAREST)
                tiles.append(('%s s%d (%d img)' % (uid, n, images_of(job, n)), im))
    if not tiles:
        return None
    W = sum(t.size[0] for _, t in tiles) + 10 * (len(tiles) + 1)
    H = max(t.size[1] for _, t in tiles) + 40
    img = Image.new('RGB', (W, H), (40, 40, 48))
    d = ImageDraw.Draw(img)
    x = 10
    for name, t in tiles:
        img.paste(t, (x, 34))
        d.text((x, 6), name, fill=(240, 240, 240), font=_font(20))
        x += t.size[0] + 10
    img.save(out)
    return out


# ------------------------------------------------------------------------------------------ commands
def add_parsers(sub):
    s = sub.add_parser('npc', help='NPC sheets: generate / check / fix one unit (npc id or grp_<group>)')
    s.add_argument('id')
    s.add_argument('--sheets', type=lambda t: [int(x) for x in t.split(',')], default=None)
    s.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'])
    s.add_argument('--force', action='store_true')
    s.add_argument('--redo', default=None, help='a new full attempt with these notes (English)')
    s.add_argument('--approve', type=int, default=None, help='mark this sheet as approved by eye (design reference)')
    s.add_argument('--no-check', action='store_true')
    s = sub.add_parser('npc-batch', help='every unit of the tiers, in npc_sheets.json order')
    s.add_argument('--tier', default='A')
    s.add_argument('--sheets', type=lambda t: [int(x) for x in t.split(',')], default=None)
    s.add_argument('--only', default=None, help='comma list of unit ids')
    s.add_argument('--skip', default=None, help='comma list of unit ids to leave out')
    s.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'])
    s.add_argument('--export', action='store_true')
    s = sub.add_parser('npc-export')
    s.add_argument('ids', nargs='+')
    s = sub.add_parser('npc-lineup')
    s.add_argument('ids', nargs='+')
    s.add_argument('--out', required=True)
    s.add_argument('--pose', default='walk_down_0')
    s = sub.add_parser('npc-contact')
    s.add_argument('ids', nargs='+')
    s.add_argument('--out', required=True)
    s.add_argument('--scale', type=float, default=0.25)
    s = sub.add_parser('npc-prompt')
    s.add_argument('id')
    s.add_argument('sheet', type=int)
    s.add_argument('--save-refs', default=None)
    return {'npc': cmd_npc, 'npc-batch': cmd_batch, 'npc-export': cmd_export, 'npc-lineup': cmd_lineup,
            'npc-contact': cmd_contact, 'npc-prompt': cmd_prompt}


def cmd_npc(a):
    if a.approve:
        u = unit_info(a.id)
        job = job_of(u)
        job.st(a.approve)['approved'] = time.strftime('%Y-%m-%dT%H:%M:%S')
        job.save()
        job.log('sheet %d approved by eye' % a.approve)
        return
    run_unit(a.id, a.sheets, a.quality, a.force, a.redo, check=not a.no_check)


def cmd_batch(a):
    tiers = a.tier.upper()
    only = set(a.only.split(',')) if a.only else None
    skip = set(a.skip.split(',')) if a.skip else set()
    for uid, tier, ns in units(tier=tiers):
        if (only and uid not in only) or uid in skip:
            continue
        sheets = [n for n in (a.sheets or ns) if n in ns]
        print('=== %s (tier %s) sheets %s' % (uid, tier, sheets), flush=True)
        try:
            run_unit(uid, sheets, a.quality)
            if a.export:
                print('exported', export(uid), flush=True)
        except gen_api.GenError as e:
            print('STOP: %s' % e, flush=True)
            if 'credit_balance' in str(e) or 'insufficient_quota' in str(e) or 'cap reached' in str(e):
                raise
        except Exception as e:           # one bad unit does not stop the batch
            print('ERROR %s: %s: %s' % (uid, type(e).__name__, e), flush=True)


def cmd_export(a):
    for uid in a.ids:
        print(uid, export(uid))


def cmd_lineup(a):
    print(lineup(a.ids, a.out, sid=a.pose))


def cmd_contact(a):
    print(contact(a.ids, a.out, a.scale))


def cmd_prompt(a):
    u = unit_info(a.id)
    job = job_of(u)
    spec = job.specs[a.sheet]
    p, W, H = gen_size(spec)
    imgs, desc, has_tpl = refs_for(u, job, spec, p)
    print(npc_prompt(u, spec, p, W, H, desc, '', has_tpl))
    print('\n[size %dx%d, pitch %d, %d reference images, template %s]' % (W, H, p, len(imgs), has_tpl))
    if a.save_refs:
        os.makedirs(a.save_refs, exist_ok=True)
        for i, im in enumerate(imgs):
            im.save(os.path.join(a.save_refs, 'ref%d.png' % (i + 1)))
