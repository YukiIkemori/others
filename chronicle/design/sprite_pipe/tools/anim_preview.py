#!/usr/bin/env python3
"""Animated GIFs of a set's animations (frames/ms loops and keyed moves with dx), to look at timing and jitter.

  python3 tools/anim_preview.py <out dir> [set=battle] [--scale 4]
Writes <out dir>/preview/anim_<set>_<anim>.gif  (anchor fixed on a ground line, dark night-grey backdrop)
"""
import json
import os
import sys

from PIL import Image, ImageDraw

args = sys.argv[1:]
scale = 4
if '--scale' in args:
    i = args.index('--scale'); scale = int(args[i + 1]); del args[i:i + 2]
od = os.path.abspath(args[0])
sets = args[1:] or ['battle', 'field']
char = os.path.basename(od)
for st in sets:
    import glob
    jps = glob.glob(os.path.join(od, st, '*_%s.json' % st))
    if not jps:
        continue
    jp = jps[0]
    js = json.load(open(jp))
    sheet = Image.open(os.path.join(od, st, js['image'])).convert('RGBA')
    cw, ch = js['cell']
    ax, ay = js['anchor']

    def cut(fid):
        f = js['frames'][fid]
        return sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))

    for name, an in js.get('anims', {}).items():
        seq = []
        if 'keys' in an:
            prev_dx = 0
            for k in an['keys']:
                steps = max(1, k['ms'] // 40)
                for s in range(steps):
                    t = (s + 1) / steps
                    dx = prev_dx + (k.get('dx', 0) - prev_dx) * t
                    seq.append((k['frame'], int(round(dx)), 40))
                prev_dx = k.get('dx', 0)
        else:
            seq = [(f, 0, max(60, m or 600)) for f, m in zip(an['frames'], an.get('ms', [0] * len(an['frames'])))]
        if len(seq) < 2 and 'keys' not in an:
            continue
        span = min(0, min(d for _, d, _ in seq)), max(0, max(d for _, d, _ in seq))
        W = cw + span[1] - span[0] + 8
        H = ch + 6
        out = []
        for fid, dx, ms in seq:
            if fid not in js['frames']:
                continue
            c = Image.new('RGBA', (W, H), (38, 40, 56, 255))
            d = ImageDraw.Draw(c)
            d.line([(0, ay + 3), (W, ay + 3)], fill=(70, 70, 92, 255))
            c.alpha_composite(cut(fid), (4 - span[0] + dx, 3))
            out.append((c.resize((W * scale, H * scale), Image.NEAREST).convert('P', palette=Image.ADAPTIVE, colors=255), ms))
        if not out:
            continue
        os.makedirs(os.path.join(od, 'preview'), exist_ok=True)
        p = os.path.join(od, 'preview', 'anim_%s_%s.gif' % (st, name))
        out[0][0].save(p, save_all=True, append_images=[o for o, _ in out[1:]], duration=[m for _, m in out], loop=0, disposal=2)
        print('→', p)
