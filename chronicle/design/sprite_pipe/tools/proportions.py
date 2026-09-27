#!/usr/bin/env python3
"""Body-proportion check of a battle / field frame against the hero's (the owner's rule: every character is chunky,
about 2.6-2.8 heads tall with a big head, whatever the overall height).

Measured on the alpha of one frame (thin things sticking up, e.g. a raised blade, are cut off first):
  H       body height (first row with a run >= 4 px wide -> bottom)
  head_h  crown -> neck (the narrowest row between 22% and 48% of H, from the top)
  head_w  widest row of the head band (crown -> neck)
  mass    opaque area / H^2 (bulk)
  heads   H / head_h
Ratios compared with the hero's same frame: head_h/H, head_w/H, mass; outside +-tol -> FAIL.

  python3 tools/proportions.py out/comp_selma [--set battle --frame idle_a] [--ref out/arun_v2] [--tol 0.08]
"""
import argparse
import glob
import json
import os
import sys

import numpy as np
from PIL import Image


def load_frame(out_dir, set_, fid):
    js_p = glob.glob(os.path.join(out_dir, set_, '*_%s.json' % set_))[0]
    js = json.load(open(js_p))
    im = Image.open(os.path.join(os.path.dirname(js_p), js['image'])).convert('RGBA')
    f = js['frames'][fid]
    return np.array(im.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])))


def runs_max(row):
    best = run = 0
    for v in row:
        run = run + 1 if v else 0
        best = max(best, run)
    return best


def measure(rgba, min_run=4):
    a = rgba[..., 3] > 0
    ys = np.where(a.any(1))[0]
    if not len(ys):
        return None
    bot = ys.max()
    top = next(y for y in range(ys.min(), bot + 1) if runs_max(a[y]) >= min_run)
    H = bot - top + 1
    widths = []
    for y in range(top, bot + 1):
        xs = np.where(a[y])[0]
        widths.append(xs.max() - xs.min() + 1 if len(xs) else 0)
    lo, hi = int(0.22 * H), int(0.48 * H)
    # neck: narrowest "core" row (the longest run, so an arm or blade beside the neck does not count)
    core = [runs_max(a[top + i]) for i in range(H)]
    neck = min(range(lo, hi + 1), key=lambda i: (core[i], i))
    head_w = max(core[:neck + 1])
    mass = a[top:bot + 1].sum() / float(H * H)
    return dict(H=int(H), head_h=int(neck), head_w=int(head_w), mass=round(float(mass), 3),
                heads=round(H / max(1, neck), 2), r_head_h=round(neck / H, 3), r_head_w=round(head_w / H, 3))


def compare(m, r, tol):
    bad = []
    for k in ('r_head_h', 'r_head_w', 'mass'):
        d = m[k] / r[k] - 1
        if abs(d) > tol:
            bad.append('%s %.3f vs hero %.3f (%+.0f%%)' % (k, m[k], r[k], 100 * d))
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--ref', default=None)
    ap.add_argument('--set', default='battle')
    ap.add_argument('--frames', default=None)
    ap.add_argument('--tol', type=float, default=0.08)
    a = ap.parse_args()
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ref = a.ref or os.path.join(here, 'out', 'arun_v2')
    frames = (a.frames or ('idle_a,cast_a' if a.set == 'battle' else 'walk_down_0,walk_left_0')).split(',')
    ok = True
    for fid in frames:
        m = measure(load_frame(a.out, a.set, fid))
        r = measure(load_frame(ref, a.set, fid))
        bad = compare(m, r, a.tol)
        ok = ok and not bad
        print('%-12s %s' % (fid, m))
        print('%-12s %s' % ('  hero', r))
        print('  ' + ('FAIL: ' + '; '.join(bad) if bad else 'ok'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
