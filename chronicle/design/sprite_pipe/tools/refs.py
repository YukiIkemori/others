#!/usr/bin/env python3
"""Facing / colour references for the validator: configs/refs/<char>/.

  python3 tools/refs.py arun out/arun_v1          # from a finished run whose facings were checked by eye

Copies known-facing sprites under the names the facing check reads: <dir>_<group>_<id>.png
  dir = left | right | down | up | face_right,  group = btl (battle) | fld (field) | face
and the shared palette (palette.json, a list of #rrggbb) for the colour-drift check.
Brief ids (idle_a …, walk_down_0 …, face_neutral …) and owner-sheet ids (btl_*, fld_*, face_*) are both understood.
Old reference sets: configs/refs/arun_owner (from the owner's design sheet, the placeholder art).
"""
import json, os, shutil, sys, glob
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
char, od = sys.argv[1], os.path.abspath(sys.argv[2])
dst = os.path.join(HERE, 'configs', 'refs', char)
os.makedirs(dst, exist_ok=True)
for p in glob.glob(os.path.join(dst, '*.png')):
    os.remove(p)
MAP = {  # brief sheets (sheets.py): sheet 5 idle A is the canonical left-facing battle pose, sheet 1 the field rows
    'idle_a': ('left', 'btl'), 'step': ('left', 'btl'), 'hit': ('left', 'btl'), 'windup': ('left', 'btl'),
    'thrust': ('left', 'btl'), 'cast_a': ('left', 'btl'), 'glimmer': ('left', 'btl'),
    'face_neutral': ('face_right', 'face'), 'face_serious': ('face_right', 'face'), 'face_smile': ('face_right', 'face'),
    # owner design sheet (extract.py / build.py)
    'btl_idle': ('left', 'btl'), 'btl_attack': ('left', 'btl'), 'btl_skill': ('left', 'btl'), 'btl_damage': ('left', 'btl'),
    'btl_victory': ('left', 'btl'), 'fld_side': ('left', 'fld'), 'fld_down': ('down', 'fld'), 'fld_up': ('up', 'fld'),
    'face_normal': ('face_right', 'face'), 'face_big': ('face_right', 'face'),
}
for d in ('down', 'up', 'left', 'right'):   # sheet 1 (walk) and sheet 2 (run) rows, the acting poses of sheets 3 / 4
    for i in range(3):
        MAP['walk_%s_%d' % (d, i)] = (d, 'fld')
    for i in range(4):
        MAP['run_%s_%d' % (d, i)] = (d, 'fld')
for sid in ('act_nod', 'act_think', 'act_resolve', 'act_call'):
    MAP[sid] = ('down', 'fld')
for sid in ('act_up_nod', 'act_up_call'):
    MAP[sid] = ('up', 'fld')
MAP['act_left_nod'] = ('left', 'fld')
src = os.path.join(od, 'sprites')
n = 0
for sid, (d, g) in MAP.items():
    p = os.path.join(src, sid + '.png')
    if os.path.exists(p):
        shutil.copy(p, os.path.join(dst, '%s_%s_%s.png' % (d, g, sid))); n += 1
pal = json.load(open(os.path.join(od, 'palette.json')))
json.dump(pal['shared'], open(os.path.join(dst, 'palette.json'), 'w'), indent=0)
print(n, 'references + palette ->', dst)
