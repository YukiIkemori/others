"""NPC sheets (design/art_ref/NPC_REQUEST.md, npc_sheets.json) for tools/sheets.py.

  python3 tools/sheets.py <folder> --npc berna          [--out out/npc_berna] [--check]   # tier A / B person
  python3 tools/sheets.py <folder> --npc npc_pen_man    [--out out/npc_npc_pen_man]       # one half of a tier C pair sheet

Files (the layout comes from the file name; redraws _v2, _v3 …, the highest version wins, then the newest file):
  npc_<id>_s1.png     tier A: walk 4x3 (cell 80x64)         tier B: walk_act 4x4 (cell 80x64: cols 1-3 walk, col 4
                                                                     act_nod / act_surprise / act_call / act_sig, all facing down)
  npc_<id>_s2.png     tier A: act12 3x4 (cell 96x64)  = Arun sheet 3 with act_draw -> act_sig
  npc_<id>_s3.png     tier A: face6 2x3 (cell 96x96)  face_neutral smile sad / angry surprise closed
  npc_grp_<group>.png tier C: walk_pair 4x6 — columns 1-3 = people[0] (slot A), 4-6 = people[1] (slot B). The run for
                      one look crops its half into <out>/src/ and reads it as a normal walk sheet (4x3).
  npc_<id>_btl.png    optional battle sheet: not read here (MONSTER_REQUEST human-boss path)

Sizes: each look's measureH.field (hats / packs included) is what the size check measures; the packed JSON's
target_height is heightDots.field (the body). Never rescaled to 48. Animals (kind=animal) skip the facing, head-scale and
proportion checks (their 'head' is not a human head).

Proportions (the owner's rule: chunky like Arun, about 2.7 heads): measured on Arun's delivered walk sheet
(arun_sheet_01, 12 frames, body 48): neck row / body = 0.29 (head incl. chin ~ 1/3), head width / body = 0.43, shoulder
width / body = 0.40. A person's walk frames are measured the same way against the person's own body height (children
and short / tall people scale the whole figure, not the head ratio). Head height AND width more than PROP_TOL under
Arun's (or the width more than WIDTH_TOL under) -> redo line; other deviations over PROP_TOL -> a check.
"""
import copy
import json
import os
import re

import numpy as np
from PIL import Image

from brief_spec import SHEETS, use_profile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC_JSON = os.path.normpath(os.path.join(HERE, '..', 'art_ref', 'npc_sheets.json'))
ARUN = {k: copy.deepcopy(v) for k, v in SHEETS.items()}    # Arun's layouts, taken before any profile swap

# Arun's walk proportions (median of the 12 frames of arun_sheet_01; see measure()).
ARUN_PROP = dict(neck=0.292, head_w=0.427, shoulder=0.396)
PROP_TOL = 0.08          # owner: within 8 % of Arun's ratios (the heads-tall ratio)
WIDTH_TOL = 0.20         # head width: hair volume / headgear change it at the same head size

# Head-scale check (tools/bodyscale.py via sheets.check_scale) on NPC sheets. Shared by tools/npc_gen.py (what is never
# redrawn for 'scale') and tools/sheets.py --npc (what is never auto-rescaled on the head match alone).
# acting poses whose head reads ~125-130 % in the head-scale check on Arun's own sheet 3 as well (crouched head):
# not a drawing problem, never redrawn / rescaled for 'scale' below this bound
SCALE_FALSE = {'act_kneel': 1.42, 'act_sit': 1.42}
# upright poses: the head-template match reads caps, hoods, beards, back views (walk_up) and raised arms / tilted heads
# as a smaller or bigger head (tadeo: every pose 50-51 art px tall, three flagged at 75 %; katri act_call 72 % with the
# same body height). Their size is covered by the bbox height check; sheets.py rescales them only when the body height
# (head top to feet, raised arms left out: bodyscale.body_height) is off as well
UPRIGHT_SCALE_SKIP = {'walk_%s_%d' % (d, i) for d in ('down', 'up', 'left', 'right') for i in range(3)} | {
    'act_nod', 'act_surprise', 'act_think', 'act_call', 'act_resolve', 'act_sig'}

WALK_JA = ARUN[1]['ja']
ACT4_JA = ['うなずく', '驚く', '手を挙げて呼びかける', 'その人のしぐさ']
FACE6_JA = [['通常', '笑顔', '悲しみ'], ['怒り', '驚き', '目を閉じる']]


def load_json(path=SPEC_JSON):
    return json.load(open(path, encoding='utf-8'))


def lookup(js, target):
    """target: a tier A/B npc id, or a tier C look id (npc_pen_man, ani_cat) -> dict describing one look"""
    for n in js['npcs']:
        if n['id'] == target or n['look'] == target:
            return dict(n, kind='person', look=n['look'], group=None, slot=None)
    for g in js['groups']:
        for i, p in enumerate(g['people']):
            if p['look'] == target:
                return dict(p, id=p['look'], tier='C', group=g['id'], slot=p['slot'], half=i, groupNo=g['no'],
                            region=g.get('region'), culture=g.get('culture'), sheets=[dict(n=1, file=g['file'], layout='walk_pair')],
                            headgearExtraDots=p['measureH']['field'] - p['heightDots']['field'])
    ids = [n['id'] for n in js['npcs']] + [p['look'] for g in js['groups'] for p in g['people']]
    raise SystemExit('npc "%s" is not in %s (ids: %s …)' % (target, SPEC_JSON, ' '.join(ids[:20])))


def _walk(npc, label='1'):
    w = copy.deepcopy(ARUN[1])
    mh, bh = npc['measureH']['field'], npc['heightDots']['field']
    w.update(title='歩き', target_h=mh, body_h=bh, lantern=bool(npc.get('lantern')), label=label, cell_dots=[80, 64])
    if npc.get('kind') == 'animal':
        w.update(kind='animal', no_facing=[i for r in w['ids'] for i in r], row_set=['field'] * 4)
    return w


def build_specs(js, npc):
    """-> ({sheet key: spec in brief_spec form}, order). Keys are the file's _s number (tier C: 1)."""
    L = js['layouts']
    mh, bh = npc['measureH']['field'], npc['heightDots']['field']
    out = {}
    for s in npc['sheets']:
        lay = s['layout']
        n = s.get('n', 1)
        if lay in ('walk', 'walk_pair'):
            out[n] = _walk(npc)
        elif lay == 'walk_act':
            a = L['walk_act']
            ids = [list(r) for r in a['ids']]
            walk_ids = [i for r in ids for i in r[:3]]
            reg = {'walk_%s_%d' % (d, i): 'walk_%s_0' % d for d in ('down', 'up', 'left', 'right') for i in (1, 2)}
            out[n] = dict(name='walk_act', title='歩き＋演技4', kind='field', rows=4, cols=4, target_h=mh, body_h=bh, required=True,
                          ids=ids, ja=[list(WALK_JA[r]) + [ACT4_JA[r]] for r in range(4)], face=list(a['face']),
                          col_face={3: 'down'}, row_kind=[None] * 4, row_set=['field'] * 4,
                          stand=walk_ids + ['act_nod', 'act_call', 'act_sig'], air=[], no_facing=[], register=reg,
                          lantern=bool(npc.get('lantern')), lantern_ids=walk_ids, register_mode='upper', label=str(n),
                          cell_dots=a['cellDots'])
        elif lay == 'act12':
            a = copy.deepcopy(ARUN[3])
            ids = [list(r) for r in L['act12']['ids']]
            ja = [list(r) for r in a['ja']]
            ja[2][1] = 'その人のしぐさ'
            a.update(title='演技12（下向き）', ids=ids, ja=ja, target_h=mh, body_h=bh, lantern=False, label=str(n),
                     stand=list(L['act12']['stand']), no_facing=list(L['act12']['no_facing']), cell_dots=L['act12']['cellDots'])
            out[n] = a
        elif lay == 'face6':
            f = L['face6']
            fh = npc['heightDots'].get('face', 80)
            out[n] = dict(name='face', title='顔6', kind='face', rows=2, cols=3, target_h=fh, body_h=fh, required=True,
                          ids=[list(r) for r in f['ids']], ja=FACE6_JA, face=['right', 'right'], row_kind=[None, None],
                          row_set=['face', 'face'], stand=[i for r in f['ids'] for i in r], air=[], no_facing=[],
                          register=dict(f['register']), lantern=False, register_mode='all', label=str(n), cell_dots=f['cellDots'])
        # battle_single (_btl): not a field sheet; handled by the monster pipeline
    order = sorted(out)
    return out, order


# ------------------------------------------------------------------ files
VER_RE = re.compile(r'_v(\d+)$', re.I)


def _ver(p):
    m = VER_RE.search(os.path.splitext(os.path.basename(p))[0])
    return (int(m.group(1)) if m else 1, os.path.getmtime(p))


def scan(folder, npc):
    """-> ({sheet key: [paths]}, [unknown names]). Tier C: the pair sheet under key 1."""
    by, unknown = {}, []
    if not os.path.isdir(folder):
        return by, unknown
    if npc['tier'] == 'C':
        pat = re.compile(r'^npc_grp_%s(?:_v\d+)?$' % re.escape(npc['group']), re.I)
    else:
        pat = re.compile(r'^npc_%s_s([1-3])(?:_v\d+)?$' % re.escape(npc['id']), re.I)
    for p in sorted(os.listdir(folder)):
        if not p.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            continue
        base = os.path.splitext(p)[0]
        m = pat.match(base)
        if not m:
            if base.startswith('npc_'):
                continue             # another NPC's sheet in the same folder
            unknown.append(p)
            continue
        key = 1 if npc['tier'] == 'C' else int(m.group(1))
        by.setdefault(key, []).append(os.path.join(folder, p))
    return by, unknown


def setup(target, folder):
    js = load_json()
    npc = lookup(js, target)
    sheets, order = build_specs(js, npc)
    who = '%s（%s）' % (npc['name'], npc['look'])
    use_profile(sheets, order, dict(char=npc['look'], name=npc['name'], ask_prefix=who + 'の', title='NPC ' + who,
                                    weapon=None, companion=None, scarf=False))
    npc = dict(npc, scan=scan(folder, npc), who=who, js_about=js['version'])
    return npc


def find(npc, rep, args, od):
    """{sheet key: path}. Tier C: the half of the pair sheet is cropped into <od>/src/ (and given a manifest entry)."""
    by, unknown = npc['scan']
    for p in unknown:
        rep.add(None, 'info', 'unknown_file', '%s は NPC のシートの名前でないので使わない' % p)
    out = {}
    for k, ps in by.items():
        ps = sorted(ps, key=_ver)
        if len(ps) > 1:
            rep.add(k, 'info', 'takes', '%d 枚あるので一番新しい %s を使う' % (len(ps), os.path.basename(ps[-1])))
        out[k] = ps[-1]
    if npc['tier'] == 'C' and 1 in out:
        src = out[1]
        im = Image.open(src).convert('RGB')
        W, H = im.size
        half = W // 2
        x0 = 0 if npc['half'] == 0 else W - half
        d = os.path.join(od, 'src')
        os.makedirs(d, exist_ok=True)
        dst = os.path.join(d, '%s_s1.png' % npc['look'])      # e.g. npc_pen_man_s1.png / ani_cat_s1.png
        im.crop((x0, 0, x0 + half, H)).save(dst)
        ent = (args.manifest or {}).get(os.path.basename(src))
        if ent:
            args.manifest[os.path.basename(dst)] = dict(sheet=1, file=os.path.basename(dst), layout='4x3', rows=4, cols=3,
                                                        logical_cell=ent['logical_cell'], image_px=[half, H])
        rep.add(1, 'info', 'pair_half', '%s の%s半分（人物%s）を使う' % (os.path.basename(src), '左' if npc['half'] == 0 else '右', npc['slot']))
        npc['pair_file'] = src
        out[1] = dst
    for n in SHEETS:
        if n not in out:
            s = SHEETS[n]
            fn = npc['sheets'][0]['file'] if npc['tier'] == 'C' else 'npc_%s_s%d.png' % (npc['id'], n)
            rep.add(n, 'redo', 'missing_sheet', 'シート%d（%s, %s）がない' % (n, s['title'], fn), ask='シート%d（%s）を作って' % (n, s['title']))
    return out


# ------------------------------------------------------------------ proportions
def measure(img, body_h, extra=0):
    """-> dict(neck, head_w, shoulder, neck_clear) as fractions of the body height, or None.
    neck = first row of the narrowest band between 20 % and 45 % of the body below the headgear (the chin / neck),
    head_w = widest row above it, shoulder = median width 2-5 rows below it."""
    m = img[..., 3] > 0
    ys = np.where(m.any(1))[0]
    if len(ys) < 10:
        return None
    t, b = ys.min(), ys.max()
    w = m.sum(1)[t:b + 1]
    top = int(round(extra))
    lo, hi = int(top + 0.20 * body_h), min(len(w) - 1, int(top + 0.45 * body_h))
    if hi <= lo:
        return None
    nk = lo + int(np.argmin(w[lo:hi + 1]))
    hw = float(w[top:nk].max()) if nk > top else float(w[:nk].max())
    sh = float(np.median(w[nk + 2:nk + 6])) if nk + 6 <= len(w) else float('nan')
    return dict(neck=(nk - top) / float(body_h), head_w=hw / body_h, shoulder=sh / body_h, neck_clear=float(w[nk]) / max(1.0, hw))


def check_proportions(npc, runs, rep, tol=PROP_TOL):
    """Walk frames vs Arun's ratios (median of the 12 walk frames). A head too small by both measures -> redo; any other
    ratio more than tol off -> check (see the comment below)."""
    if npc.get('kind') == 'animal':
        return
    extra = npc.get('headgearExtraDots') or 0
    bh = npc['heightDots']['field']
    for n, sp in runs.items():
        vals = []
        for sid, v in sp.items():
            if sid.startswith('walk_'):          # all 12 walk frames (the median is steadier than the 4 stand frames)
                r = measure(v['img'], bh, extra)
                if r:
                    vals.append(r)
        if not vals:
            continue
        med = {k: float(np.nanmedian([x[k] for x in vals])) for k in ('neck', 'head_w', 'shoulder', 'neck_clear')}
        SHEETS[n]['prop'] = med
        rep.add(n, 'info', 'proportion', '頭身の比（歩き12コマの中央値、体 %d ドットあたり）: 首 %.2f（アルン %.2f）・頭の幅 %.2f（%.2f）・肩 %.2f（%.2f）' % (
            bh, med['neck'], ARUN_PROP['neck'], med['head_w'], ARUN_PROP['head_w'], med['shoulder'], ARUN_PROP['shoulder']), **med)
        # Two measures of the head: its height (the neck / chin row) and its width. Each alone is fooled by the costume: a
        # beard or a high collar hides the neck (hans: neck 68 % with a normal head), a braid / bun or a child's big head
        # moves it down, bushy hair or a hat widens the head row (Arun's own hair is bushy). A head that is really too
        # small (the realistic-proportion failure) is small by BOTH, so: redo when both are more than tol under Arun's, or
        # the width alone more than WIDTH_TOL under it. Anything else outside +-tol is a 'check' (look at the lineup).
        qn = med['neck'] / ARUN_PROP['neck'] if med['neck_clear'] < 0.95 else None
        qw = med['head_w'] / ARUN_PROP['head_w']
        small = (qw < 1 - WIDTH_TOL) or (qn is not None and qn < 1 - tol and qw < 1 - tol)
        pct = '頭の高さ %s・頭の幅 %.0f%%' % ('%.0f%%' % (100 * qn) if qn is not None else '（首が見えない）', 100 * qw)
        if small:
            rep.add(n, 'redo', 'proportion', '頭がアルンより小さい（%s）。頭身が高すぎる' % pct, slot='walk_down_0', ratio=qw, neck=qn,
                    ask='シート%dの人物の頭がアルンより小さく、頭身が高すぎる（%s）。アルンの歩きと同じ約2.7頭身・大きな頭・低い重心にして、同じ条件で描き直して' % (n, pct))
        elif (qn is not None and abs(qn - 1) > tol) or abs(qw - 1) > tol:
            rep.add(n, 'check', 'proportion_off', '頭の比がアルンと %d%% 以上違う（%s）。ひげ・髪・帽子のせいでないか、並べて見る' % (int(100 * tol), pct),
                    ratio=qw, neck=qn)


# ------------------------------------------------------------------ after pack: meta for the engine
def after_pack(npc, od, rep):
    look = npc['look']
    info = {k: npc[k] for k in ('id', 'look', 'name', 'tier', 'kind', 'region', 'group', 'slot', 'heightDots', 'measureH',
                                'headgearExtraDots', 'mainHex', 'mainHue', 'mainName', 'lantern', 'spirit', 'recolor',
                                'recolorSets', 'variants', 'face') if k in npc}
    meta = dict(tier=npc['tier'], lantern=bool(npc.get('lantern')), spirit=bool(npc.get('spirit')),
                recolor=bool(npc.get('recolor')), mainHex=npc.get('mainHex'), recolorSets=npc.get('recolorSets'),
                variants=npc.get('variants'), kind=npc.get('kind', 'person'))
    for s, m in (('field', dict(target_height=npc['heightDots']['field'], lantern_drawn=bool(npc.get('lantern')), npc=meta)),
                 ('face', dict(target_height=npc['heightDots'].get('face', 80), npc=meta))):
        p = os.path.join(od, s, '%s_%s.json' % (look, s))
        if os.path.exists(p):
            js = json.load(open(p))
            js.update(m)
            json.dump(js, open(p, 'w'), indent=1)
    info['sheets'] = {SHEETS[n]['label']: os.path.basename(p) for n, p in npc.get('found', {}).items()}
    if npc.get('pair_file'):
        info['pair_file'] = os.path.basename(npc['pair_file'])
    info['proportion'] = {SHEETS[n]['label']: SHEETS[n]['prop'] for n in SHEETS if SHEETS[n].get('prop')}
    info['arun_proportion'] = ARUN_PROP
    info['expr'] = load_json()['layouts']['face6']['engineExpr']
    json.dump(info, open(os.path.join(od, 'npc.json'), 'w'), indent=1, ensure_ascii=False)
