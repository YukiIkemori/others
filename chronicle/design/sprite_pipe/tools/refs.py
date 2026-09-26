#!/usr/bin/env python3
"""Facing / colour references for the validator: configs/refs/<char>/.

  python3 tools/refs.py arun out/arun            # from a finished run (sheets.py or extract.py output)

Copies known-facing sprites under the names the facing check reads:
  left_*.png (battle poses + field side view), down_*.png, up_*.png, face_right_*.png
and the shared palette (palette.json, a list of #rrggbb) for the colour-drift check.
Owner sheet ids (btl_*, fld_*, face_*) and brief ids (idle_a …, walk_down_0 …, face_neutral …) are both understood.
"""
import json, os, shutil, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
char, od = sys.argv[1], os.path.abspath(sys.argv[2])
dst = os.path.join(HERE, 'configs', 'refs', char)
os.makedirs(dst, exist_ok=True)
MAP = {'btl_idle': 'left', 'btl_attack': 'left', 'btl_skill': 'left', 'btl_damage': 'left', 'btl_victory': 'left',
       'fld_side': 'left', 'fld_down': 'down', 'fld_up': 'up', 'face_normal': 'face_right', 'face_big': 'face_right',
       'face_smile': 'face_right', 'face_serious': 'face_right',
       'idle_a': 'left', 'step': 'left', 'hit': 'left', 'windup': 'left', 'thrust': 'left', 'cast_a': 'left',
       'walk_left_0': 'left', 'walk_down_0': 'down', 'walk_up_0': 'up', 'face_neutral': 'face_right'}
src = os.path.join(od, 'sprites')
n = 0
for sid, d in MAP.items():
    p = os.path.join(src, sid + '.png')
    if os.path.exists(p):
        shutil.copy(p, os.path.join(dst, '%s_%s.png' % (d, sid))); n += 1
pal = json.load(open(os.path.join(od, 'palette.json')))
json.dump(pal['shared'], open(os.path.join(dst, 'palette.json'), 'w'), indent=0)
print(n, 'references + palette ->', dst)
