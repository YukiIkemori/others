#!/usr/bin/env python3
"""Mock companion sheets (comp_<id>_s1..s5.png) for testing `sheets.py --companion`: Arun's finished sprites,
recoloured and resized to the companion's height (companion_sheets.json), laid out in the companion layouts and
rendered the way an image AI delivers them (tools/mock_sheets.py: irregular grid, soft edges, colour noise,
off-magenta background).

  python3 tools/mock_companions.py [--src out/arun_v1/sprites] [--dst out/mock_companions]

Default set (one folder per companion, truth.json = what the pipeline should find):
  selma  sword, 64/48      all five sheets, s4 as one 3x5 sheet                      -> no redo expected
  hagen  greatsword, 68/51 all five sheets, s4 split into s4 + s4b; s3 #3 faces right -> 1 facing redo
  dokka  greatsword, 52/39 no design sheet (s1) and no face sheet (s5)                -> missing s5 redo, s1 note
"""
import argparse
import colorsys
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixlib as P  # noqa: E402
import companion_spec as CS  # noqa: E402
import mock_sheets as M  # noqa: E402
from brief_spec import use_profile  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# id -> (hue shift, saturation factor, dot px, sheets to write, split s4, mistakes)
PLAN = {
    'selma': dict(hue=-8, sat=0.8, p=6.0, sheets=[1, 2, 3, 4, 5], split4=False, mistakes=[]),
    'hagen': dict(hue=0, sat=0.25, p=5.0, sheets=[1, 2, 3, 4, 5], split4=True, mistakes=['s3_step_right']),
    'dokka': dict(hue=140, sat=1.0, p=7.0, sheets=[2, 3, 4], split4=False, mistakes=[]),
}


def recolour(im, dh, sf):
    """hue shift (degrees) + saturation factor on the coloured pixels; hues that would land in the magenta band
    (285-335, keyed out with the background) are pushed to blue-violet."""
    out = im.copy()
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    cache = {}
    for y, x in zip(ys, xs):
        k = tuple(int(v) for v in im[y, x, :3])
        if k not in cache:
            h, s, v = colorsys.rgb_to_hsv(*[c / 255.0 for c in k])
            if s > 0.18:
                h = ((h * 360 + dh) % 360)
                if 280 <= h <= 335:
                    h = 262.0
                h /= 360.0
                s = min(1.0, s * sf)
            cache[k] = tuple(int(round(c * 255)) for c in colorsys.hsv_to_rgb(h, s, v))
        out[y, x, :3] = cache[k]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(HERE, 'out', 'arun_v1', 'sprites'))
    ap.add_argument('--dst', default=os.path.join(HERE, 'out', 'mock_companions'))
    ap.add_argument('--only', default=None, help='comma list of ids')
    a = ap.parse_args()
    js = json.load(open(CS.SPEC_JSON))
    for cid, plan in PLAN.items():
        if a.only and cid not in a.only.split(','):
            continue
        c = next(x for x in js['companions'] if x['id'] == cid)
        sheets, order = CS.build_specs(js, c, plan['split4'])
        use_profile(sheets, order, {})
        hb, hf = c['heightDots']['battle'], c['heightDots']['field']
        cache = {}

        def S(sid, k=1.0):
            if (sid, k) not in cache:
                im = M.crop(M.ld(a.src, sid))
                im = recolour(im, plan['hue'], plan['sat'])
                if abs(k - 1) > 1e-3:
                    im = P.rescale_pixel(im, k)
                cache[(sid, k)] = M.crop(im)
            return cache[(sid, k)]
        kb, kf = hb / 64.0, hf / 48.0
        B = lambda sid: S(sid, kb)
        F = lambda sid: S(sid, kf)
        d = os.path.join(a.dst, cid)
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.endswith('.png'):
                os.remove(os.path.join(d, f))
        truth = dict(id=cid, heights=c['heightDots'], weapon=c['weaponType'], sheets=plan['sheets'], split4=plan['split4'],
                     mistakes=list(plan['mistakes']), expect=[])
        p = plan['p']
        name = lambda n, sfx='': os.path.join(d, 'comp_%s_s%d%s.png' % (cid, n, sfx))
        if 1 in plan['sheets']:
            # design: turnaround at battle height, idle, face bust, 4x2 palette swatches of 6x6 dots
            kfb = hb / 48.0
            pal = [S('idle_a')[..., :3][S('idle_a')[..., 3] > 0]]
            u, cnt = np.unique(pal[0], axis=0, return_counts=True)
            top = u[np.argsort(-cnt)[:8]]
            sw = np.zeros((12, 24, 4), np.uint8)
            for i, col in enumerate(top):
                sw[(i // 4) * 6:(i // 4) * 6 + 6, (i % 4) * 6:(i % 4) * 6 + 6, :3] = col
                sw[(i // 4) * 6:(i // 4) * 6 + 6, (i % 4) * 6:(i % 4) * 6 + 6, 3] = 255
            rows = [[S('walk_down_0', kfb), B('idle_a')[:, ::-1], S('walk_left_0', kfb), S('walk_up_0', kfb)],
                    [B('idle_a'), S('face_neutral'), sw, None]]
            M.compose(1, rows, p)[0].save(name(1))
        if 2 in plan['sheets']:
            rows = [[F('walk_%s_%d' % (dd, i)) for i in range(3)] for dd in ('down', 'up', 'left', 'right')]
            M.compose(2, rows, p)[0].save(name(2))
        if 3 in plan['sheets']:
            ids = [['idle_a', 'idle_b', 'step', 'guard', 'hit'], ['weak', 'ko', 'victory_a', 'victory_b', 'glimmer']]
            rows = [[B(s) for s in r] for r in ids]
            if 's3_step_right' in plan['mistakes']:
                rows[0][2] = rows[0][2][:, ::-1]
                truth['expect'].append('redo facing: シート3の3番（一歩前に踏み出す）')
            M.compose(3, rows, p)[0].save(name(3))
        if 4 in plan['sheets']:
            a1 = [['windup', 'slash', 'thrust_ready', 'thrust', 'charge'], ['smash', 'cast_a', 'cast_b', 'item', 'evade']]
            bare = ['bare_idle', 'bare_windup', 'bare_slash', 'bare_thrust', 'bare_cast']
            if plan['split4']:
                M.compose(4, [[B(s) for s in r] for r in a1], p)[0].save(name(4))
                M.compose(CS.S4B, [[B(s) for s in bare]], p)[0].save(name(4, 'b'))
            else:
                M.compose(4, [[B(s) for s in r] for r in a1 + [bare]], p)[0].save(name(4))
        if 5 in plan['sheets']:
            fs = ['face_neutral', 'face_smile', 'face_surprise', 'face_sad']     # face_sad stands in for 苦しい
            M.compose(5, [[S(s) for s in fs]], p)[0].save(name(5))
        if 1 not in plan['sheets']:
            truth['expect'].append('check: シート1（設定画）がない')
        for n in (2, 3, 4, 5):
            if n not in plan['sheets']:
                truth['expect'].append('redo: シート%d がない' % n)
        json.dump(truth, open(os.path.join(d, 'truth.json'), 'w'), indent=1, ensure_ascii=False)
        print(cid, '->', d, sorted(os.listdir(d)))


if __name__ == '__main__':
    main()
