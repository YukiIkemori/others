#!/usr/bin/env python3
"""Cut-out rig from ONE illustration (BRIEF Part A16 prototype, design/art_proto/PLAN.md §3).

  python3 tools/art_rig.py IN.png OUTDIR --poly "x,y x,y ..." --pivot x,y [--fill-x0 80] [--scale 1]

Splits a keyed sprite into two layers:
  arm.png   the pixels inside the polygon (front arm + weapon), to be rotated around the pivot (the shoulder)
  body.png  everything else; where the arm covered the torso (polygon ∩ x ≥ fill-x0 ∩ inside the silhouette) the
            hole is filled by diffusion from the surrounding pixels, so that raising the arm shows cloth, not a gap
  rig.json  {w, h, pivot:[x,y], feet:[x,y]} in the output pixel scale
"""
import sys, json, argparse, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('out')
    ap.add_argument('--poly', required=True); ap.add_argument('--pivot', required=True)
    ap.add_argument('--fill-x0', type=float, default=0); ap.add_argument('--scale', type=float, default=1)
    o = ap.parse_args()
    os.makedirs(o.out, exist_ok=True)
    im = Image.open(o.inp).convert('RGBA')
    W, H = im.size
    pts = [tuple(float(v) for v in p.split(',')) for p in o.poly.split()]
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    mask = np.asarray(m) > 127
    a = np.asarray(im).astype(np.float32)
    alpha = a[..., 3] / 255
    arm = a.copy(); arm[..., 3] *= mask
    body = a.copy(); body[..., 3] *= ~mask
    # hole inside the torso: mask ∩ (x ≥ fill_x0) ∩ torso silhouette (the alpha of the original, closed)
    xs = np.arange(W)[None, :].repeat(H, 0)
    sil = ndimage.binary_closing(alpha > 0.5, iterations=6)
    hole = mask & (xs >= o.fill_x0) & sil
    lum = a[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
    known = (~mask) & (alpha > 0.9) & (lum > 70)  # ignore the dark outlines as fill sources
    rgb = body[..., :3].copy()
    rgb[~known] = 0
    wgt = known.astype(np.float32)
    # diffusion fill (normalised convolution, a few scales)
    acc = rgb * wgt[..., None]
    for sig in (2, 4, 8, 16):
        num = np.dstack([ndimage.gaussian_filter(acc[..., c], sig) for c in range(3)])
        den = ndimage.gaussian_filter(wgt, sig)[..., None]
        est = num / np.maximum(den, 1e-4)
        take = hole & (den[..., 0] > 0.05) & (wgt < 0.5)
        rgb[take] = est[take]
        wgt = np.where(take, 1.0, wgt)
        acc = rgb * wgt[..., None]
    # a soft shade so the filled cloth reads as "behind the arm"
    body[..., :3] = np.where(hole[..., None], rgb * 0.82, body[..., :3])
    body[..., 3] = np.where(hole, 255, body[..., 3])
    s = o.scale
    def save(arr, name):
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
        if s != 1:
            img = img.resize((round(W * s), round(H * s)), Image.LANCZOS)
        img.save(os.path.join(o.out, name), optimize=True)
    save(arm, 'arm.png'); save(body, 'body.png')
    ys = np.where(alpha.max(1) > 0.5)[0]
    px, py = (float(v) for v in o.pivot.split(','))
    json.dump({'w': round(W * s), 'h': round(H * s), 'pivot': [px * s, py * s], 'feet': [W / 2 * s, float(ys.max()) * s]},
              open(os.path.join(o.out, 'rig.json'), 'w'))
    print('ok', o.out)


if __name__ == '__main__':
    main()
