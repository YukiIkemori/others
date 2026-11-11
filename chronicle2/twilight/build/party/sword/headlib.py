"""Head finder that ignores ponytail, arms and shield: big circles inscribed in the silhouette, from the top."""
import numpy as np
from scipy import ndimage as nd


def _edt(m):
    return nd.distance_transform_edt(np.pad(m, 1))[1:-1, 1:-1]


def head_circle(m, min_frac=0.11):
    """m: bool mask of one figure (tight bbox). returns (cx, cy, r) of the first big inscribed circle from the top:
    follow the row maximum of the distance transform down to its first peak (radius >= min_frac * height)."""
    h, w = m.shape
    edt = _edt(m)
    rowmax = edt.max(1)
    min_r = min_frac * h
    best, by = 0.0, 0
    for y in range(int(h * 0.6)):
        if rowmax[y] > best:
            best, by = rowmax[y], y
        elif best >= min_r and rowmax[y] < best * 0.93:
            break
    y0, y1 = max(0, by - 3), min(h, by + 4)
    ys, xs = np.where(edt[y0:y1] >= best - 0.75)
    return float(xs.mean()) + 0.5, float(ys.mean()) + y0 + 0.5, float(best)


def head_fit(m, r_expect, depth=0.36):
    """where a head-sized circle first fits, scanning from the top: returns (cx, top_y, r).
    r = min(r_expect, the biggest circle in the top `depth` of the figure); robust when the head runs into the
    shoulders (front run), the shield (back views) or a streaming ponytail."""
    h, w = m.shape
    edt = _edt(m)
    lim = max(4, int(h * depth))
    rowmax = edt[:lim].max(1)
    r = min(float(r_expect), float(rowmax.max()))
    by = int(np.argmax(rowmax >= 0.94 * r))
    sub = edt[by:by + 3]
    ys, xs = np.where(sub >= 0.94 * r - 0.4)
    cx = float(xs.mean()) + 0.5
    cy = by + 0.5
    return cx, int(round(cy - r)), r
