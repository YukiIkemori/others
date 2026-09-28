"""Painted FIELD areas (area-switching field, 2026-09-28): layout primitives shared by areas.py.
A layout is a W x H char grid (legend below) plus lists of marks (landmarks, doors, spawns, exits) that areas.py writes to <id>/layout.json.
Legend (collision is derived from it; the painting is traced from the guide drawn from it):
  walkable  ,  grass          ;  tall meadow grass     "  wild flowers     .  road (packed earth)   :  footpath
            s  sand / beach   _  shallow ford / tidal flat   =  wooden bridge   c  flagstones (ruin floor, plaza)
  blocked   ~  sea            w  river / pond          T  tree / grove     F  dense forest     b  bushes / hedge
            r  boulders       R  cliff / rock wall     X  built stone (ruin walls, tower, well, gate posts)
"""
import math, random, json, os
import numpy as np

WALK = set(',;".:s_=c')
SOLID = set('~wTFbrRX')


def vnoise(seed, W, H, scale):
    """smooth value noise 0..1 on a W x H grid, feature size ~scale cells"""
    rnd = np.random.RandomState(seed)
    gw, gh = int(W / scale) + 3, int(H / scale) + 3
    g = rnd.rand(gh, gw)
    ys, xs = np.mgrid[0:H, 0:W] / float(scale)
    x0, y0 = xs.astype(int), ys.astype(int)
    fx, fy = xs - x0, ys - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = g[y0, x0] * (1 - fx) + g[y0, x0 + 1] * fx
    b = g[y0 + 1, x0] * (1 - fx) + g[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


def fbm(seed, W, H, scale, oct=3):
    t, amp, s = np.zeros((H, W)), 1.0, scale
    tot = 0
    for i in range(oct):
        t += amp * vnoise(seed + i * 97, W, H, max(1.0, s)); tot += amp; amp *= 0.5; s /= 2
    return t / tot


def spline(pts, step=0.25):
    """Catmull-Rom through the points -> dense list of (x, y)"""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = [np.array(p, float) for p in P[i - 1:i + 3]]
        n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for k in range(n):
            t = k / n
            q = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
            out.append((q[0], q[1]))
    out.append(tuple(map(float, pts[-1])))
    return out


class Area:
    def __init__(self, aid, W, H, seed, base=','):
        self.id, self.W, self.H, self.seed = aid, W, H, seed
        self.g = np.full((H, W), base, dtype='<U1')
        self.marks = []      # landmarks for the guide/prompt: {kind, cells:[[x,y]..], color, text}
        self.objects = []    # data objects (sprites/examines/doors/exits etc., written to the map file by hand from these)
        self.spawns, self.exits, self.notes = {}, [], []
        self.keep = np.zeros((H, W), bool)   # cells that later passes must not overwrite (roads, bridges, marks)

    # ------------------------------------------------------------ painting helpers
    def inb(self, x, y): return 0 <= x < self.W and 0 <= y < self.H

    def put(self, x, y, ch, force=False):
        x, y = int(x), int(y)
        if self.inb(x, y) and (force or not self.keep[y, x]): self.g[y, x] = ch

    def rect(self, x, y, w, h, ch, force=False, keep=False):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.put(i, j, ch, force)
                if keep and self.inb(i, j): self.keep[j, i] = True

    def mask_fill(self, m, ch, only=None, force=False):
        ys, xs = np.nonzero(m)
        for y, x in zip(ys, xs):
            if only is None or self.g[y, x] in only: self.put(x, y, ch, force)

    def blob(self, cx, cy, rx, ry, ch, rough=0.3, seed=0, only=None, force=False):
        n = fbm(self.seed * 31 + seed, self.W, self.H, max(2, min(rx, ry) * 0.8), 2)
        ys, xs = np.mgrid[0:self.H, 0:self.W]
        d = np.sqrt(((xs - cx) / max(rx, .5)) ** 2 + ((ys - cy) / max(ry, .5)) ** 2)
        m = d < 1 + rough * (n - 0.5) * 2
        self.mask_fill(m, ch, only, force)
        return m

    def stroke(self, pts, width, ch, keep=True, force=True, wobble=0.0, seed=0, only=None):
        """a road / river along a spline, width in cells (float); wobble varies the width"""
        n = fbm(self.seed * 17 + seed, self.W, self.H, 6, 2) if wobble else None
        cells = set()
        for (x, y) in spline(pts):
            wv = width + (wobble * (n[min(self.H - 1, max(0, int(y))), min(self.W - 1, max(0, int(x)))] - 0.5) * 2 if wobble else 0)
            r = wv / 2.0
            for j in range(int(math.floor(y - r - 1)), int(math.ceil(y + r + 1))):
                for i in range(int(math.floor(x - r - 1)), int(math.ceil(x + r + 1))):
                    if (i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2 <= r * r + 0.05: cells.add((i, j))
        for (i, j) in cells:
            if not self.inb(i, j): continue
            if only is not None and self.g[j, i] not in only: continue
            self.put(i, j, ch, force)
            if keep: self.keep[j, i] = True
        return cells

    def region(self, poly, ch, rough=1.5, seed=0, force=False, only=None):
        """fill a polygon (list of (x, y)) whose edge is displaced by noise of amplitude rough cells"""
        n = fbm(self.seed * 13 + seed, self.W, self.H, 5, 3)
        ys, xs = np.mgrid[0:self.H, 0:self.W] + 0.5
        inside = np.zeros((self.H, self.W), bool)
        P = np.array(poly, float); nP = len(P)
        # signed distance to the polygon edge
        dmin = np.full((self.H, self.W), 1e9)
        for i in range(nP):
            a, b = P[i], P[(i + 1) % nP]
            ab = b - a; L2 = max(1e-9, ab @ ab)
            t = np.clip(((xs - a[0]) * ab[0] + (ys - a[1]) * ab[1]) / L2, 0, 1)
            px, py = a[0] + t * ab[0], a[1] + t * ab[1]
            dmin = np.minimum(dmin, np.hypot(xs - px, ys - py))
            cond = ((a[1] > ys) != (b[1] > ys)) & (xs < (b[0] - a[0]) * (ys - a[1]) / (b[1] - a[1] + 1e-12) + a[0])
            inside ^= cond
        sd = np.where(inside, dmin, -dmin)
        m = sd + rough * (n - 0.5) * 2 > 0
        self.mask_fill(m, ch, only, force)
        return m

    def scatter(self, ch, density, only=',', seed=0, clear=1, avoid=None):
        rnd = random.Random(self.seed * 7 + seed)
        n = 0
        for y in range(self.H):
            for x in range(self.W):
                if self.g[y, x] not in only or self.keep[y, x] or rnd.random() > density: continue
                ok = True
                for j in range(y - clear, y + clear + 1):
                    for i in range(x - clear, x + clear + 1):
                        if self.inb(i, j) and (self.keep[j, i] or (avoid and self.g[j, i] in avoid)): ok = False
                if ok: self.g[y, x] = ch; n += 1
        return n

    def ring(self, m, ch, width=1, only=None, outside=True):
        """cells within `width` of mask m (outside it) -> ch"""
        from scipy import ndimage
        d = ndimage.binary_dilation(m, iterations=width) & (~m if outside else True)
        self.mask_fill(d, ch, only)
        return d

    def mark(self, kind, cells, text, color, solid=True, ch='X'):
        cells = [list(map(int, c)) for c in cells]
        for x, y in cells:
            if solid: self.put(x, y, ch, True)
            if self.inb(x, y): self.keep[y, x] = True
        self.marks.append(dict(kind=kind, cells=cells, text=text, color=color, solid=solid))

    def exit(self, edge, a, b, to, spawn, name=None):
        """edge exit over cells a..b (inclusive) along the edge; spawn = the spawn name placed 1 cell inside"""
        W, H = self.W, self.H
        if edge in 'we':
            x = 0 if edge == 'w' else W - 1
            e = dict(x=x, y=a, w=1, h=b - a + 1, to=to)
            sx, sy, d = (1 if edge == 'w' else W - 2), (a + b) // 2, 'e' if edge == 'w' else 'w'
        else:
            y = 0 if edge == 'n' else H - 1
            e = dict(x=a, y=y, w=b - a + 1, h=1, to=to)
            sx, sy, d = (a + b) // 2, (1 if edge == 'n' else H - 2), 's' if edge == 'n' else 'n'
        e['edge'] = edge
        self.exits.append(e)
        self.spawns[spawn] = dict(x=sx, y=sy, dir=d)
        return e

    # ------------------------------------------------------------ checks
    def walk(self):
        return np.isin(self.g, list(WALK))

    def reach(self, sx, sy):
        from collections import deque
        wk = self.walk(); seen = np.zeros_like(wk)
        q = deque([(sx, sy)]); seen[sy, sx] = True
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                i, j = x + dx, y + dy
                if self.inb(i, j) and wk[j, i] and not seen[j, i]: seen[j, i] = True; q.append((i, j))
        return seen

    def tidy(self, passes=2):
        """remove 1-cell specks: a lone walkable cell enclosed by solids becomes the majority solid; a lone solid in open grass becomes grass
        (except marks, trees, rocks and bushes which may stand alone)"""
        for _ in range(passes):
            g = self.g.copy()
            for y in range(self.H):
                for x in range(self.W):
                    if self.keep[y, x]: continue
                    nb = [self.g[j, i] for i, j in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if self.inb(i, j)]
                    c = self.g[y, x]
                    if c in WALK and sum(n in SOLID for n in nb) >= 4:
                        g[y, x] = max(set(nb), key=nb.count)
                    elif c in '~wRF' and sum(n in WALK for n in nb) >= 3:
                        g[y, x] = max((n for n in nb if n in WALK), key=nb.count)
            self.g = g

    def save(self, d):
        os.makedirs(d, exist_ok=True)
        json.dump(dict(id=self.id, w=self.W, h=self.H, rows=[''.join(r) for r in self.g], marks=self.marks, objects=self.objects,
                       spawns=self.spawns, exits=self.exits, notes=self.notes), open(os.path.join(d, 'layout.json'), 'w'), ensure_ascii=False, indent=0)

    def ascii(self):
        return '\n'.join('%2d %s' % (y, ''.join(r)) for y, r in enumerate(self.g))
