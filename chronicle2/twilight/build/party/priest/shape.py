"""Body measures that ignore the staff: disc openings (the staff and its crescent are thinner than the head and the shoes)."""
import numpy as np
from scipy import ndimage as nd


def disc(r):
    R = int(np.ceil(r))
    yy, xx = np.ogrid[-R:R + 1, -R:R + 1]
    return xx * xx + yy * yy <= r * r


def open_disc(m, r):
    return nd.binary_opening(m, structure=disc(r))


def head(a, r=5.0, rows=18):
    """(top row of the hair, x centre of the head) of an art-resolution mask"""
    b = open_disc(a, r)
    ys = np.where(b.any(1))[0]
    top = int(ys.min())
    xs = np.where(b[top:top + rows].any(0))[0]
    return top, (xs.min() + xs.max()) / 2.0


def sole(a, r=2.2):
    """row just under the lowest sole (exclusive) of an art-resolution mask"""
    b = open_disc(a, r)
    return int(np.where(b.any(1))[0].max()) + 1


def span_raw(m, cell, k=3):
    """(hair top, sole line) in a raw crop; cell = raw px per art px. Works on a k-times reduced mask."""
    s = m[::k, ::k]
    c = cell / float(k)
    top = np.where(open_disc(s, 5.0 * c).any(1))[0].min() * k
    bot = (np.where(open_disc(s, 2.2 * c).any(1))[0].max() + 1) * k
    return int(top), int(min(bot, m.shape[0]))
