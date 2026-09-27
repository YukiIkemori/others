#!/usr/bin/env python3
"""Lineup of battle frames (the hero first) on one ground line, x scale, with a 4-px ruler.
  python3 tools/lineup.py <out.png> out/arun_v2 out/comp_selma ... [--frame idle_a] [--scale 4] [--set battle]"""
import argparse
import glob
import json
import os

from PIL import Image, ImageDraw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dst')
    ap.add_argument('dirs', nargs='+')
    ap.add_argument('--frame', default='idle_a')
    ap.add_argument('--set', default='battle')
    ap.add_argument('--scale', type=int, default=4)
    a = ap.parse_args()
    ims = []
    for d in a.dirs:
        js_p = glob.glob(os.path.join(d, a.set, '*_%s.json' % a.set))[0]
        js = json.load(open(js_p))
        im = Image.open(os.path.join(os.path.dirname(js_p), js['image'])).convert('RGBA')
        f = js['frames'][a.frame]
        cr = im.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
        bb = cr.getbbox()
        ims.append((cr.crop(bb), f['anchor'][1] - bb[1], js.get('character') or os.path.basename(d)))
    gap = 8
    W = sum(i.size[0] for i, _, _ in ims) + gap * (len(ims) + 1)
    top = max(h for _, h, _ in ims) + 6
    H = top + 14
    cv = Image.new('RGBA', (W, H), (46, 48, 64, 255))
    d = ImageDraw.Draw(cv)
    for y in range(top, 0, -8):
        d.line([(0, y), (W, y)], fill=(70, 72, 92, 255))
    x = gap
    labels = []
    for im, h, name in ims:
        cv.alpha_composite(im, (x, top - h))
        labels.append((x, name))
        x += im.size[0] + gap
    k = a.scale
    big = cv.resize((W * k, H * k), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for x, name in labels:
        d.text((x * k, (top + 3) * k), name, fill=(255, 255, 255, 255))
    big.save(a.dst)
    print(a.dst, big.size)


if __name__ == '__main__':
    main()
