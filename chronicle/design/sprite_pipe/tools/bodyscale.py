"""Drawn-scale check: how big is a pose drawn compared with the reference pose of its sheet group?

Image AIs sometimes draw one pose of a sheet smaller or larger (a raised sword keeps the bounding box at the
target height, so the bbox height does not catch it). The head is the part of the body whose size does not
change with the pose, so the scale is measured by matching the reference head (idle A for battle, the stand
frame for field) at scales 0.55…1.4 anywhere in the upper part of the pose (mirrored too) and taking the scale
of the best match; several references -> the median.
Squared Lab+alpha difference, evaluated for every offset at once with FFT correlation.
"""
import numpy as np
from scipy.ndimage import zoom
from scipy.signal import fftconvolve

import pixlib as P

SCALES = np.round(np.arange(0.55, 1.401, 0.025), 3)


def _feat(im):
    f = im.astype(np.float64)
    lab = P.srgb_to_lab(f[..., :3])
    al = f[..., 3:] / 255.0
    return np.concatenate([lab * al, al * 60], -1)


def head_crop(im, frac=0.36):
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    t = ys.min()
    H = ys.max() - t + 1
    r1 = t + max(4, int(H * frac))
    w = a[t:r1].sum(0)
    cols = np.where(w >= 0.25 * (r1 - t))[0]
    if len(cols) == 0:
        cols = np.where(w > 0)[0]
    return im[t:r1, cols.min():cols.max() + 1]


def match(im, ref, scales=SCALES, top=0.6):
    """-> (scale, rms error, (y, x), mirrored) of the best placement of ref (resized by scale) inside im."""
    F = _feat(im)
    H = F.shape[0]
    F = F[:max(8, int(H * top) + ref.shape[0])]
    F2 = (F ** 2).sum(-1)
    R0 = _feat(ref)
    best = (1e18, 1.0, (0, 0), False)
    for mir in (False, True):
        Rm = R0[:, ::-1] if mir else R0
        for s in scales:
            R = np.stack([zoom(Rm[..., i], s, order=1) for i in range(4)], -1)
            h, w = R.shape[:2]
            if h > F.shape[0] or w > F.shape[1] or h < 3 or w < 3:
                continue
            box = fftconvolve(F2, np.ones((h, w)), mode='valid')
            corr = sum(fftconvolve(F[..., i], R[::-1, ::-1, i], mode='valid') for i in range(4))
            ssd = box - 2 * corr + (R ** 2).sum()
            k = np.unravel_index(np.argmin(ssd), ssd.shape)
            e = float(np.sqrt(max(ssd[k], 0) / (h * w)))
            # normalise so small and large templates compare fairly; tiny bias to scale 1 on ties
            e *= 1 + 0.02 * abs(np.log(s))
            if e < best[0]:
                best = (e, float(s), (int(k[0]), int(k[1])), mir)
    return best[1], best[0], best[2], best[3]


def scale_of(im, refs):
    """median scale over several reference heads -> (scale, [per-ref scales])"""
    ss = [match(im, r)[0] for r in refs]
    return float(np.median(ss)), ss
