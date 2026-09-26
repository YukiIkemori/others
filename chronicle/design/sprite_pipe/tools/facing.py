"""Facing check by head appearance.

A sprite's head (top ~26 % below any thin thing sticking up, e.g. a raised sword) is reduced to a small
Lab+alpha thumbnail. Heads of the same character in the same facing look alike across very different
body poses, and a mirrored head looks alike a head facing the other way — so
    score(S, refs) = mean_R [ sim(S, R) - sim(mirror(S), R) ]
is positive when S faces like the references and negative when it is mirrored.
For front / back rows the class (down / up / side) is the one whose references are most similar.

References come from two places: a library of known-facing sprites of the character
(configs/refs/<char>/<dir>_*.png, dir = left | down | up | face_right …; 'right' = mirrored 'left')
and the other sprites of the run that should face the same way (leave-one-out).
"""
import glob
import os

import numpy as np
from PIL import Image
from scipy.ndimage import zoom

import pixlib as P

SIZE = (14, 12)


def head(im, frac=0.26, face=False):
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    if len(ys) == 0:
        return None
    t, b = ys.min(), ys.max()
    H = b - t + 1
    if face:              # bust: the head is the upper ~60 %
        r0, r1 = t, t + int(H * 0.62)
    else:
        w = a.sum(1)
        r0 = t
        while w[r0] < max(4, int(0.12 * H)) and r0 < b:
            r0 += 1
        r1 = r0 + max(4, int(H * frac))
    sub = a[r0:r1]
    cx = np.where(sub.any(0))[0]
    crop = im[r0:r1, cx.min():cx.max() + 1].astype(np.float64)
    lab = P.srgb_to_lab(crop[..., :3])
    al = crop[..., 3:] / 255.0
    f = np.concatenate([lab * al, al * 60], -1)
    return np.stack([zoom(f[..., i], (SIZE[1] / f.shape[0], SIZE[0] / f.shape[1]), order=1) for i in range(4)], -1)


def sim(a, b):
    return -float(np.abs(a - b).mean())


class Facing:
    def __init__(self, ref_dir=None):
        self.lib = {}   # dir -> [head]
        if ref_dir and os.path.isdir(ref_dir):
            for p in sorted(glob.glob(os.path.join(ref_dir, '*.png'))):
                d = os.path.basename(p).split('_')[0]
                if d == 'face':
                    d = 'face_' + os.path.basename(p).split('_')[1]
                im = np.asarray(Image.open(p).convert('RGBA'))
                isface = d.startswith('face')
                self.add(d, im, isface)

    def add(self, d, im, isface=False):
        h, hm = head(im, face=isface), head(im[:, ::-1], face=isface)
        if h is None:
            return
        self.lib.setdefault(d, []).append(h)
        opp = {'left': 'right', 'right': 'left', 'face_left': 'face_right', 'face_right': 'face_left'}.get(d)
        if opp:
            self.lib.setdefault(opp, []).append(hm)

    def has(self, d):
        return bool(self.lib.get(d))

    # ------------------------------------------------------------------
    def mirror_score(self, im, refs, isface=False):
        """>0: faces like refs, <0: mirrored."""
        h, hm = head(im, face=isface), head(im[:, ::-1], face=isface)
        if h is None or not refs:
            return None
        return float(np.mean([sim(h, r) - sim(hm, r) for r in refs]))

    def class_scores(self, im, run_refs):
        """{dir: mean similarity} over down / up / left / right."""
        h = head(im)
        out = {}
        for d in ('down', 'up', 'left', 'right'):
            rs = self.lib.get(d, []) + run_refs.get(d, [])
            if rs:
                out[d] = float(np.mean([sim(h, r) for r in rs]))
        return out
