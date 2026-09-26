"""Facing check — several independent cues, references from a known-good delivery.

Cues (each signed: > 0 = faces the expected way, < 0 = mirrored)
  head     head thumbnail (Lab + alpha) vs known-facing references:  mean_R [sim(S, R) - sim(mirror(S), R)]
  upper    the same on the upper half of the body (head + shoulders + scarf + arms)
  scarf    side of the red scarf tail relative to the head centre (battle / field side views: tail behind)
  lantern  side of the lantern relative to the body (field sheets 1-2: left hand -> screen right when facing down,
           screen left facing up; in front of the body in side views)
For front / back rows (down / up) the class is the one whose references are most alike (head + upper),
with the lantern side as a second vote.

References: configs/refs/<char>/<dir>_<group>_<id>.png   dir = left | down | up | right | face_right,
group = btl | fld | face.  'right' refs are also made by mirroring 'left' ones and vice versa.
Old names (<dir>_<anything>.png) still load; their group is guessed from the name.
"""
import glob
import os

import numpy as np
from PIL import Image
from scipy import ndimage as nd
from scipy.ndimage import zoom

import pixlib as P

SIZE = (14, 12)
USIZE = (16, 16)
OPP = {'left': 'right', 'right': 'left', 'face_left': 'face_right', 'face_right': 'face_left'}


def _thumb(im, r0, r1, c0, c1, size):
    crop = im[r0:r1, c0:c1].astype(np.float64)
    if crop.size == 0:
        return None
    lab = P.srgb_to_lab(crop[..., :3])
    al = crop[..., 3:] / 255.0
    f = np.concatenate([lab * al, al * 60], -1)
    return np.stack([zoom(f[..., i], (size[1] / f.shape[0], size[0] / f.shape[1]), order=1) for i in range(4)], -1)


def head_box(im, frac=0.36, face=False):
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    if len(ys) == 0:
        return None
    t, b = ys.min(), ys.max()
    H = b - t + 1
    if face:
        r0, r1 = t, t + int(H * 0.62)
        cx = np.where(a[r0:r1].any(0))[0]
        return r0, r1, cx.min(), cx.max() + 1
    w = a.sum(1)
    # skip thin things sticking up (a raised sword / hand): rows narrower than ~12 % of the height
    r0 = t
    while w[r0] < max(4, int(0.12 * H)) and r0 < b:
        r0 += 1
    r1 = min(b + 1, r0 + max(4, int(H * frac)))
    # head = the widest run of occupied columns in the band (drops a raised arm / sword beside the head)
    band = a[r0:r1]
    colw = band.sum(0)
    occ = colw >= max(1, 0.25 * (r1 - r0))
    lab, n = nd.label(occ)
    if n == 0:
        cx = np.where(band.any(0))[0]
        return r0, r1, cx.min(), cx.max() + 1
    sums = nd.sum(colw, lab, range(1, n + 1))
    k = int(np.argmax(sums)) + 1
    cx = np.where(lab == k)[0]
    return r0, r1, cx.min(), cx.max() + 1


def head(im, frac=0.36, face=False):
    bx = head_box(im, frac, face)
    return None if bx is None else _thumb(im, *bx, SIZE)


def upper(im, face=False):
    a = im[..., 3] > 0
    ys, xs = np.where(a)
    if len(ys) == 0:
        return None
    t, b = ys.min(), ys.max()
    r1 = t + max(4, int((b - t + 1) * (0.9 if face else 0.5)))
    cx = np.where(a[t:r1].any(0))[0]
    return _thumb(im, t, r1, cx.min(), cx.max() + 1, USIZE)


def colour_masks(im):
    lab = P.srgb_to_lab(im[..., :3].astype(np.float64))
    a = im[..., 3] > 0
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    red = a & (A > 28) & (L > 20) & (L < 62) & (A > 0.6 * B)
    lantern = a & (L > 68) & (B > 45)
    return red, lantern


def side_cues(im, face=False):
    """Scarf / lantern side cues, in units of the head width (+ = to the right)."""
    a = im[..., 3] > 0
    bx = head_box(im, face=face)
    if bx is None:
        return None, None
    r0, r1, c0, c1 = bx
    hc, hw = (c0 + c1) / 2.0, max(4.0, c1 - c0)
    red, lan = colour_masks(im)
    ys, xs = np.where(a)
    t, b = ys.min(), ys.max()
    # scarf: red pixels in the upper 60 % (tail and knot), outside the head column band counts most
    ry, rx = np.where(red[: t + int(0.6 * (b - t + 1))])
    scarf = None
    if len(rx) >= 6:
        d = rx - hc
        scarf = float(np.clip(d.mean() / hw, -1.5, 1.5))
    lantern = None
    ly, lx = np.where(lan)
    if len(lx) >= 3:
        bc = (xs.min() + xs.max()) / 2.0
        lantern = float(np.clip((lx.mean() - bc) / hw, -1.5, 1.5))
    return scarf, lantern


def sim(a, b):
    return -float(np.abs(a - b).mean())


def mirror_score(f, fm, refs):
    if f is None or not refs:
        return None
    return float(np.mean([sim(f, r) - sim(fm, r) for r in refs]))


def group_of(n):
    """reference group of a sheet, by its kind (brief_spec): face | btl | fld; None for a design sheet"""
    from brief_spec import SHEETS
    k = SHEETS[n]['kind'] if n in SHEETS else None
    return {'face': 'face', 'battle': 'btl', 'field': 'fld'}.get(k)


class Feat:
    """All cues of one sprite (and its mirror)."""
    def __init__(self, im, group):
        face = group == 'face'
        self.im = im
        self.sig = (im.shape, int(im[..., 3].astype(np.int64).sum()), int(im[..., :3].astype(np.int64).sum()))
        self.h, self.hm = head(im, face=face), head(im[:, ::-1], face=face)
        self.u, self.um = upper(im, face=face), upper(im[:, ::-1], face=face)
        self.scarf, self.lantern = side_cues(im, face=face)


class Facing:
    def __init__(self, ref_dir=None):
        self.lib = {}   # (group, dir) -> [Feat]
        if ref_dir and os.path.isdir(ref_dir):
            for p in sorted(glob.glob(os.path.join(ref_dir, '*.png'))):
                base = os.path.basename(p)[:-4]
                parts = base.split('_')
                if parts[0] == 'face':
                    d, rest = 'face_' + parts[1], parts[2:]
                    g = 'face'
                else:
                    d, rest = parts[0], parts[1:]
                    g = rest[0] if rest and rest[0] in ('btl', 'fld', 'face') else ('fld' if d in ('down', 'up') else 'btl')
                rid = '_'.join(rest[1:]) if rest and rest[0] in ('btl', 'fld', 'face') else base
                im = np.asarray(Image.open(p).convert('RGBA'))
                self.add(g, d, im, rid)

    def add(self, g, d, im, rid=None):
        f = Feat(im, g)
        f.id = rid
        if f.h is None:
            return
        self.lib.setdefault((g, d), []).append(f)
        if d in OPP:
            fm = Feat(np.ascontiguousarray(im[:, ::-1]), g)
            fm.id = rid
            self.lib.setdefault((g, OPP[d]), []).append(fm)

    def refs(self, g, d, exclude_id=None):
        """references of a class; the sprite being checked is left out (leave-one-out when the refs came from this run)"""
        return [f for f in self.lib.get((g, d), []) if exclude_id is None or f.id != exclude_id]

    def has(self, g, d):
        return bool(self.lib.get((g, d)))

    @property
    def empty(self):
        return not self.lib
