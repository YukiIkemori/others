"""Companion sheets (design/art_ref/COMPANIONS_REQUEST.md, companion_sheets.json) for tools/sheets.py.

  python3 tools/sheets.py <folder> --companion selma [--out out/comp_selma] [--check] [--arun out/arun_v1]

Files: comp_<id>_s1.png … comp_<id>_s5.png (+ optional comp_<id>_s4b.png; redraws comp_<id>_s3_v2.png; the newest
take wins). A folder may hold several companions' sheets: files named comp_<other id>_… are skipped.

  sheet  layout (companion_sheets.json)   pipeline                                   packed into
  s1     design 2x4 (cell 112x96)          reference only: facing refs + palette      <out>/design, <out>/refs
  s2     walk 4x3 (cell 80x64)             Arun sheet 1 ids, no lantern               field
  s3     battle_base 2x5 (cell 104x96)     Arun sheet 5 ids                           battle
  s4     battle_action_bare 3x5 (112x80)   rows 1-2 = sheet 6 ids, row 3 = sheet 7    battle + battle_bare
         row 1 ids (weapon-less poses)
  s4     (split) 2x5 (cell 104x80)         when comp_<id>_s4b.png is there            battle
  s4b    1x5 (cell 112x80)                 the weapon-less row                        battle_bare
  s5     face4 1x4 (cell 96x96)            face_neutral face_smile face_surprise face_pain   face

Sizes: each companion's height comes from companion_sheets.json. The size check measures measureH (head to feet,
hat included: what a bounding box sees); the packed JSON's target_height is heightDots (the body, what the engine
uses). So a short or tall companion keeps the height it was drawn at instead of being resampled to 64 / 48.
Weapons are shared: the weapons set is copied from Arun's run (--arun). Weapon-less poses with no armed twin
(windup / slash / thrust of a non-sword companion: generic one-handed sword grips drawn after Arun sheet 7 row 1)
get their grip from Arun's same pose, scaled to the companion's pose, and are marked generic.
"""
import copy
import json
import os
import re

import numpy as np
from PIL import Image

import pixlib as P
from brief_spec import SHEETS, use_profile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC_JSON = os.path.normpath(os.path.join(HERE, '..', 'art_ref', 'companion_sheets.json'))
ARUN = {k: copy.deepcopy(v) for k, v in SHEETS.items()}    # Arun's layouts, taken before any profile swap
S4B = 45            # internal key of the split weapon-less sheet (label '4b')
DESIGN = 1

JA4 = [['振りかぶり', '振り抜き', '突きの構え', '突き', '大技のため'],
       ['大技の一撃', '術の詠唱A', '術の詠唱B', '道具を使う', '身をかわす'],
       ['武器なし・待機', '武器なし・振りかぶり', '武器なし・振り抜き', '武器なし・突き', '武器なし・詠唱A']]


def load(cid, path=SPEC_JSON):
    js = json.load(open(path))
    for c in js['companions']:
        if c['id'] == cid:
            return js, c
    raise SystemExit('companion "%s" is not in %s (ids: %s)' % (cid, path, ' '.join(c['id'] for c in js['companions'])))


def build_specs(js, c, split4=False):
    """-> {sheet key: spec} in brief_spec's form, keyed by the companion's own sheet numbers (4b -> 45)."""
    L = js['layouts']
    hb, hf = c['heightDots']['battle'], c['heightDots']['field']
    mb, mf = c.get('measureH', {}).get('battle', hb), c.get('measureH', {}).get('field', hf)
    fh = c['heightDots'].get('face', 80)
    out = {}
    d = L['design']
    out[DESIGN] = dict(name='design', title='設定画', kind='design', rows=2, cols=4, target_h=mb, body_h=hb, required=True,
                       ids=d['ids'], ja=[['正面', '斜め前', '側面（左向き）', '背面'], ['戦闘の待機', '顔', '配色見本', None]],
                       face=[None, None], row_kind=[None, None], row_set=['design', 'design'],
                       stand=['ref_front', 'ref_34', 'ref_side_left', 'ref_back', 'ref_idle_left'],
                       air=[], no_facing=[], register={}, lantern=False, register_mode='upper', label='1', cell_dots=d['cellDots'])
    w = copy.deepcopy(ARUN[1])
    w.update(title='フィールドの歩き', target_h=mf, body_h=hf, lantern=False, label='2', cell_dots=L['walk']['cellDots'])
    out[2] = w
    b = copy.deepcopy(ARUN[5])
    b.update(target_h=mb, body_h=hb, label='3', cell_dots=L['battle_base']['cellDots'])
    out[3] = b
    a6, a7 = ARUN[6], ARUN[7]
    lay = L['battle_action_bare']
    armed = dict(lay['armed']['sword' if c['weaponType'] == 'sword' else 'other'])
    if split4:
        s4 = copy.deepcopy(a6)
        s4.update(title='戦闘の行動ポーズ（行1・2）', ja=[JA4[0], JA4[1]], target_h=mb, body_h=hb, label='4', cell_dots=[104, 80])
        out[4] = s4
        out[S4B] = dict(name='battle_bare', title='武器なし版（行3）', kind='battle', rows=1, cols=5, target_h=mb, body_h=hb,
                        required=True, ids=[list(a7['ids'][0])], ja=[JA4[2]], face=['left'], row_kind=[None],
                        row_set=['battle_bare'], stand=list(a7['stand']), air=[], no_facing=[], register={},
                        armed=armed, lantern=False, register_mode='upper', label='4b', cell_dots=[112, 80])
    else:
        out[4] = dict(name='battle_action_bare', title='戦闘の行動ポーズ＋武器なし版', kind='battle', rows=3, cols=5,
                      target_h=mb, body_h=hb, required=True, ids=[list(r) for r in lay['ids']], ja=JA4,
                      face=['left'] * 3, row_kind=[None] * 3, row_set=list(lay['rowSets']),
                      stand=list(a6['stand']) + list(a7['stand']), air=list(a6['air']), no_facing=[], register={},
                      armed=armed, lantern=False, register_mode='upper', label='4', cell_dots=lay['cellDots'])
    f = L['face4']
    out[5] = dict(name='face', title='顔の表情', kind='face', rows=1, cols=4, target_h=fh, body_h=fh, required=True,
                  ids=f['ids'], ja=[['通常', '笑顔', '驚き', '苦しい']], face=['right'], row_kind=[None], row_set=['face'],
                  stand=list(f['ids'][0]), air=[], no_facing=[], register=dict(f['register']), lantern=False,
                  register_mode='all', label='5', cell_dots=f['cellDots'])
    order = [DESIGN, 2, 3, 4] + ([S4B] if split4 else []) + [5]
    return out, order


# ------------------------------------------------------------------ files
FILE_RE = re.compile(r'(?:^|[_\-\s])(?:s|sheet|シート)0?([1-5])(b?)(?![0-9a-z])', re.I)
VER_RE = re.compile(r'[_\-\s]v(\d+)(?![0-9])', re.I)
OWNER_RE = re.compile(r'comp_([a-z]+)_', re.I)


def scan(folder, cid):
    """-> ({(n, 'b'|''): [paths]}, [skipped names], [unreadable names]); other companions' files are skipped"""
    by, other, unknown = {}, [], []
    for p in sorted(os.listdir(folder)):
        if not p.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            continue
        base = os.path.splitext(p)[0]
        m = OWNER_RE.search(base)
        if m and m.group(1).lower() != cid:
            other.append(p)
            continue
        m = FILE_RE.search(base)
        if not m:
            unknown.append(p)
            continue
        by.setdefault((int(m.group(1)), m.group(2).lower()), []).append(os.path.join(folder, p))
    return by, other, unknown


def newest(ps):
    def key(p):
        v = VER_RE.search(os.path.splitext(os.path.basename(p))[0])
        return (int(v.group(1)) if v else 1, os.path.getmtime(p))
    return sorted(ps, key=key)


def setup(cid, folder):
    """Swap brief_spec to this companion's layouts. -> companion dict (with 'scan' for find())."""
    js, c = load(cid)
    by, other, unknown = scan(folder, cid) if os.path.isdir(folder) else ({}, [], [])
    split4 = (4, 'b') in by
    sheets, order = build_specs(js, c, split4)
    who = '仲間%s（%s）' % (c['name'], c['id'])
    use_profile(sheets, order, dict(char=c['id'], name=c['name'], ask_prefix=who + 'の', title=who,
                                    weapon=c['weaponType'], companion=c))
    c = dict(c, scan=(by, other, unknown), split4=split4, who=who)
    return c


def find(comp, rep):
    """sheets.find_sheets for a companion: {sheet key: path}. Missing s2-s5 -> redo; missing s1 -> check (the run works
    without it, but the facing check then has no reference of this person)."""
    by, other, unknown = comp['scan']
    if other:
        rep.add(None, 'info', 'other_files', 'ほかの仲間のファイル %d 枚は使わない（%s …）' % (len(other), other[0]))
    for p in unknown:
        rep.add(None, 'info', 'unknown_file', '%s はシート番号が読めないので使わない（comp_%s_s1〜s5 の名前にする）' % (p, comp['id']))
    out = {}
    for (n, b), ps in by.items():
        key = S4B if (n, b) == (4, 'b') else n
        if b and n != 4:
            rep.add(None, 'info', 'unknown_file', '%s: 「b」の付くシートは s4b だけ。使わない' % os.path.basename(ps[0]))
            continue
        ps = newest(ps)
        if len(ps) > 1:
            rep.add(key, 'info', 'takes', '%d 枚あるので一番新しい %s を使う' % (len(ps), os.path.basename(ps[-1])))
        out[key] = ps[-1]
    for n in [k for k in SHEETS]:
        s = SHEETS[n]
        if n in out:
            continue
        if n == DESIGN:
            rep.add(n, 'check', 'missing_design', 'シート1（設定画）がない。向きの見本が作れないので、向きの検査は同じ回の多数決だけ'
                    '（行ごと全部が逆だと気づけない）。配色の検査もしない。承認済みの設定画があれば同じフォルダに置く')
        else:
            rep.add(n, 'redo', 'missing_sheet', 'シート%d（%s）がない' % (n, s['title']), ask='シート%d（%s）を作って' % (n, s['title']))
    return out


# ------------------------------------------------------------------ design sheet -> facing refs + palette
REF_OF = {'ref_front': [('fld', 'down')], 'ref_back': [('fld', 'up')], 'ref_side_left': [('fld', 'left'), ('btl', 'left')],
          'ref_idle_left': [('btl', 'left')], 'ref_face': [('face', 'face_right')]}


def design(comp, path, rep, args, od, fc, process_sheet, review):
    """Process s1 (never packed). Its turnaround / idle / face become facing references (added to fc and written to
    <out>/refs/ in the configs/refs/<char>/ naming); all its colours become the reference palette.
    -> (state, sprites, ref_palette or None)"""
    st, sp = process_sheet(DESIGN, path, rep, args)
    # the design sheet is approved by eye; slicing trouble here is a note, not a redraw
    for i in rep.items:
        if i['sheet'] == DESIGN and i['level'] == 'redo':
            i['level'], i['ask'] = 'check', None
    dd = os.path.join(od, 'design')
    rd = os.path.join(od, 'refs')
    for d in (dd, rd):
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.endswith('.png'):
                os.remove(os.path.join(d, f))
    n = 0
    for sid, v in sp.items():
        Image.fromarray(v['img']).save(os.path.join(dd, sid + '.png'))
        for g, d in REF_OF.get(sid, []):
            fc.add(g, d, v['img'], sid)
            Image.fromarray(v['img']).save(os.path.join(rd, '%s_%s_%s.png' % (d, g, sid)))
            n += 1
    pal = None
    if sp:
        pal = P.build_palette([v['img'] for v in sp.values()], k=52, merge_de=3.0)
        json.dump(['#%02x%02x%02x' % tuple(int(x) for x in c) for c in pal], open(os.path.join(rd, 'palette.json'), 'w'), indent=0)
    missing = [k for k in REF_OF if k not in sp]
    rep.add(DESIGN, 'info', 'design_refs', '設定画から向きの見本 %d 枚と配色（%d 色）を取った%s。<out>/refs に保存（承認後は tools/refs.py %s <out> で configs/refs に）' % (
        n, 0 if pal is None else len(pal), '（取れなかった: %s）' % '・'.join(missing) if missing else '', comp['id']))
    review(DESIGN, path, st, sp, rep, od)
    return st, sp, pal


def add_run_refs(fc, runs):
    """The run's own sprites join the design references (leave-one-out by id), so a single design pose never decides
    alone: the same majority the pipeline uses when there are no references, anchored by the design sheet."""
    from facing import group_of
    for n, sp in runs.items():
        spec = SHEETS[n]
        g = group_of(n)
        for sid, v in sp.items():
            d = spec['face'][v['row']]
            if d is None or sid in spec['no_facing'] or g is None:
                continue
            fc.add(g, 'face_' + d if spec['kind'] == 'face' else d, v['img'], sid)


# ------------------------------------------------------------------ after pack: shared weapons, generic grips, meta
def _cell_offset(sheet_png, fr):
    a = np.asarray(Image.open(sheet_png).convert('RGBA'))[fr['y']:fr['y'] + fr['h'], fr['x']:fr['x'] + fr['w'], 3] > 0
    ys, xs = np.where(a)
    return (int(xs.min()), int(ys.min())) if len(xs) else (0, 0)


def after_pack(comp, od, rep, arun_dir):
    """Companion additions to what pack.py wrote."""
    import pack
    cid = comp['id']
    bare_n = next((n for n in SHEETS if 'battle_bare' in SHEETS[n]['row_set']), None)
    arun_dir = os.path.abspath(arun_dir) if arun_dir else None
    used = {}
    # ---- shared weapons (Arun sheet 7 row 2)
    wpn, wimg = {}, {}
    wj = os.path.join(arun_dir or '', 'weapons', 'arun_weapons.json')
    if arun_dir and os.path.exists(wj):
        js = json.load(open(wj))
        src_png = os.path.join(arun_dir, 'weapons', js['image'])
        os.makedirs(os.path.join(od, 'weapons'), exist_ok=True)
        dst_png = os.path.join(od, 'weapons', '%s_weapons.png' % cid)
        Image.open(src_png).save(dst_png)
        js.update(character=cid, image=os.path.basename(dst_png), copied_from=os.path.relpath(wj, HERE),
                  note='shared weapons (Arun sheet 7 row 2), copied unchanged')
        json.dump(js, open(os.path.join(od, 'weapons', '%s_weapons.json' % cid), 'w'), indent=1)
        wpn = js.get('weapons', {})
        for k in wpn:
            p = os.path.join(arun_dir, 'sprites', k + '.png')
            if os.path.exists(p):
                wimg[k] = np.asarray(Image.open(p).convert('RGBA')).copy()
        used['weapons'] = os.path.relpath(wj, HERE)
    else:
        rep.add(None, 'check', 'no_weapons', '共通の武器の絵（アルンの出力 %s/weapons）が無いので、weapons は書かない。--arun でアルンの出力を指定する' % (arun_dir or '?'))
    # ---- battle_bare: generic sword grips for weapon-less poses without an armed twin (or without a usable one)
    bj = os.path.join(od, 'battle_bare', '%s_battle_bare.json' % cid)
    aj = os.path.join(arun_dir or '', 'battle_bare', 'arun_battle_bare.json')
    attach = {}
    if os.path.exists(bj):
        bs = json.load(open(bj))
        attach = bs.get('attach', {})
        arun_at = json.load(open(aj)).get('attach', {}) if os.path.exists(aj) else {}
        spec = SHEETS[bare_n]
        r3 = next(r for r, rs in enumerate(spec['row_set']) if rs == 'battle_bare')
        armed = spec.get('armed', {})
        png = os.path.join(od, 'battle_bare', bs['image'])
        for c_, sid in enumerate(spec['ids'][r3]):
            if sid not in bs['frames'] or sid in attach:      # measured from the armed twin, or set by hand
                continue
            name = '%s' % spec['ja'][r3][c_]
            num = r3 * spec['cols'] + c_ + 1
            A = arun_at.get(sid)
            me = os.path.join(od, 'sprites', sid + '.png')
            ar = os.path.join(arun_dir or '', 'sprites', sid + '.png')
            if not A or not os.path.exists(me) or not os.path.exists(ar):
                rep.add(bare_n, 'check', 'attach', 'シート%dの%d番（%s）の手の位置が無い（武器ありの絵も、アルンの同じポーズも無い）。configs/overrides/%s.json で入れる' % (
                    bare_n, num, name, cid), slot=sid)
                continue
            hc, wc = np.asarray(Image.open(me)).shape[:2]
            ha, wa = np.asarray(Image.open(ar)).shape[:2]
            kx, ky = wc / float(wa), hc / float(ha)
            g = [int(round(A['grip'][0] * kx)), int(round(A['grip'][1] * ky))]
            ang = A['angle']
            ln = A.get('length', 30) * ky
            t = [int(round(g[0] + ln * np.cos(np.radians(ang)))), int(round(g[1] + ln * np.sin(np.radians(ang))))]
            why = 'no_twin' if armed.get(sid) is None else 'twin_unusable'
            attach[sid] = dict(grip=g, tip=t, angle=ang, length=int(round(ln)), generic=True, method='arun_scaled', why=why,
                               **({'unreliable': True} if A.get('unreliable') else {}))
            ox, oy = _cell_offset(png, bs['frames'][sid])
            bs['frames'][sid].setdefault('points', {}).update(grip=[g[0] + ox, g[1] + oy], tip=[t[0] + ox, t[1] + oy])
            rep.add(bare_n, 'check', 'attach_generic', 'シート%dの%d番（%s）の手の位置は、アルンの同じポーズから大きさを合わせて写した（%s）。review/weapons_tryon.png で見て、ずれていれば configs/overrides/%s.json で直す' % (
                bare_n, num, name, '武器ありの絵が無い形' if why == 'no_twin' else '武器ありの絵から取れなかった', cid), slot=sid)
        bs.update(attach=attach, weapon=comp['weaponType'], target_height=comp['heightDots']['battle'])
        json.dump(bs, open(bj, 'w'), indent=1)
        used['grip_from'] = os.path.relpath(aj, HERE) if os.path.exists(aj) else None
    # ---- meta of the other sets
    meta = {'battle': dict(weapon=comp['weaponType'], weapon_drawn=comp.get('weaponDrawn'), target_height=comp['heightDots']['battle']),
            'field': dict(target_height=comp['heightDots']['field'], lantern_drawn=False,
                          lantern_note='no lantern drawn: the engine adds it when this companion leads'),
            'face': dict(target_height=comp['heightDots'].get('face', 80))}
    for s, m in meta.items():
        p = os.path.join(od, s, '%s_%s.json' % (cid, s))
        if os.path.exists(p):
            js = json.load(open(p))
            js.update(m)
            json.dump(js, open(p, 'w'), indent=1)
    # ---- try-on review with the shared weapons
    fin, anc = {}, {}
    for sid in list(attach) + list(wimg):
        p = os.path.join(od, 'sprites', sid + '.png')
        if sid in wimg:
            fin[sid] = wimg[sid]
        elif os.path.exists(p):
            fin[sid] = np.asarray(Image.open(p).convert('RGBA')).copy()
    if attach and wpn and all(k in fin for k in attach):
        pack.tryon(od, cid, fin, attach, wpn, anc)
    pj = os.path.join(od, 'pack.json')
    if os.path.exists(pj):
        js = json.load(open(pj))
        js['attach'] = attach
        js['weapons'] = wpn
        js['sets'] = sorted(set(js.get('sets', [])) | ({'weapons'} if wpn else set()))
        json.dump(js, open(pj, 'w'), indent=1)
    info = {k: comp[k] for k in ('id', 'name', 'look', 'weaponType', 'weaponDrawn', 'heightDots', 'measureH', 'row') if k in comp}
    info.update(split4=comp['split4'], sheets={SHEETS[n]['label']: os.path.basename(p) for n, p in comp.get('found', {}).items()},
                used=used, expr=json.load(open(SPEC_JSON))['layouts']['face4']['engineExpr'])
    json.dump(info, open(os.path.join(od, 'companion.json'), 'w'), indent=1, ensure_ascii=False)
