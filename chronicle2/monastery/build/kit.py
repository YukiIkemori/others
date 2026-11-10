"""Mesh kit for the abbey: every shape is appended to a mesh builder with a flat colour per face.

Objects come in three kinds, which the bake step relies on:
  floor  -- can be walked on
  solid  -- blocks walking and hides the character when in front
  soft   -- foliage and ground cover: drawn, hides the character, but ignored when working out where one can walk
  cover  -- grass tufts and the like: drawn only
"""
import bpy, bmesh, math, random
import numpy as np

DETAIL = 1.0   # the scene raises this for a high-resolution render: leaves, grass and masonry edges get finer
BUILDERS = {}
FACECOL = {}   # object name -> (n_faces, 3) float32, the flat colour of every polygon


class MB:
    def __init__(self, name, mat, kind='solid', smooth=False):
        self.name, self.mat, self.kind, self.smooth = name, mat, kind, smooth
        self.V, self.Q, self.T, self.CQ, self.CT, self.n = [], [], [], [], [], 0
        BUILDERS[name] = self

    def add(self, verts, quads=None, tris=None, col=(1, 1, 1), vcol=None):
        """col: one colour, or one per face.  vcol: one colour per vertex (blended across faces)."""
        verts = np.asarray(verts, np.float32).reshape(-1, 3)
        base = self.n
        self.V.append(verts)
        self.n += len(verts)
        col = np.asarray(col, np.float32)
        if quads is not None and len(quads):
            q = np.asarray(quads, np.int64).reshape(-1, 4)
            if vcol is not None:
                self.CQ.append(np.asarray(vcol, np.float32)[q])
            else:
                c = np.broadcast_to(col, (len(q), 3)) if col.ndim == 1 else col.reshape(-1, 3)
                self.CQ.append(np.repeat(c[:, None, :], 4, 1))
            self.Q.append(q + base)
        if tris is not None and len(tris):
            t = np.asarray(tris, np.int64).reshape(-1, 3)
            if vcol is not None:
                self.CT.append(np.asarray(vcol, np.float32)[t])
            else:
                c = np.broadcast_to(col, (len(t), 3)) if col.ndim == 1 else col.reshape(-1, 3)
                self.CT.append(np.repeat(c[:, None, :], 3, 1))
            self.T.append(t + base)
        return base

    def build(self, collection):
        if not self.V:
            return None
        V = np.concatenate(self.V)
        Q = np.concatenate(self.Q) if self.Q else np.zeros((0, 4), np.int64)
        T = np.concatenate(self.T) if self.T else np.zeros((0, 3), np.int64)
        CQ = np.concatenate(self.CQ) if self.CQ else np.zeros((0, 4, 3), np.float32)
        CT = np.concatenate(self.CT) if self.CT else np.zeros((0, 3, 3), np.float32)
        me = bpy.data.meshes.new(self.name)
        nq, nt = len(Q), len(T)
        me.vertices.add(len(V))
        me.vertices.foreach_set('co', V.ravel())
        me.loops.add(nq * 4 + nt * 3)
        me.loops.foreach_set('vertex_index', np.concatenate([Q.ravel(), T.ravel()]).astype(np.int32))
        me.polygons.add(nq + nt)
        ls = np.concatenate([np.arange(nq) * 4, nq * 4 + np.arange(nt) * 3]).astype(np.int32)
        me.polygons.foreach_set('loop_start', ls)
        me.polygons.foreach_set('loop_total', np.concatenate([np.full(nq, 4), np.full(nt, 3)]).astype(np.int32))
        me.update(calc_edges=True)
        fc = np.concatenate([CQ.mean(1), CT.mean(1)]).astype(np.float32)
        lc = np.concatenate([CQ.reshape(-1, 3), CT.reshape(-1, 3)])
        lc = np.concatenate([lc, np.ones((len(lc), 1), np.float32)], 1)
        attr = me.color_attributes.new('col', 'FLOAT_COLOR', 'CORNER')
        attr.data.foreach_set('color', lc.ravel())
        if self.smooth:
            me.polygons.foreach_set('use_smooth', np.ones(nq + nt, bool))
            me.set_sharp_from_angle(angle=math.radians(50))
        me.materials.append(self.mat)
        ob = bpy.data.objects.new(self.name, me)
        ob['kind'] = self.kind
        collection.objects.link(ob)
        FACECOL[self.name] = fc
        return ob


# ---------------------------------------------------------------- primitives
_BOXQ = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]


def rotz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], np.float32)


def rotx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], np.float32)


def roty(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], np.float32)


def box(mb, c, s, col, rot=None, pivot_bottom=False):
    """Box of full size s centred at c (or standing on c when pivot_bottom)."""
    hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
    v = np.array([[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
                  [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], np.float32)
    if pivot_bottom:
        v[:, 2] += hz
    if rot is not None:
        v = v @ np.asarray(rot, np.float32).T
    v = v + np.asarray(c, np.float32)
    mb.add(v, quads=_BOXQ, col=col)


def box2(mb, x0, x1, y0, y1, z0, z1, col):
    box(mb, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), col)


def frustum(mb, p0, p1, r0, r1, n, col, cap0=True, cap1=True):
    p0 = np.asarray(p0, np.float64)
    p1 = np.asarray(p1, np.float64)
    ax = p1 - p0
    L = np.linalg.norm(ax)
    if L < 1e-6:
        return
    ax /= L
    a = np.array([1.0, 0, 0]) if abs(ax[0]) < 0.9 else np.array([0, 1.0, 0])
    u = np.cross(ax, a)
    u /= np.linalg.norm(u)
    w = np.cross(ax, u)
    ang = np.arange(n) * 2 * np.pi / n
    ring = np.cos(ang)[:, None] * u + np.sin(ang)[:, None] * w
    v = np.concatenate([p0 + ring * r0, p1 + ring * r1, [p0], [p1]])
    quads = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    tris = []
    if cap0:
        tris += [[2 * n, (i + 1) % n, i] for i in range(n)]
    if cap1:
        tris += [[2 * n + 1, n + i, n + (i + 1) % n] for i in range(n)]
    mb.add(v, quads=quads, tris=tris, col=col)


def lathe(mb, c, profile, n, col, rot=None, scale=(1, 1, 1), caps=True):
    """Revolve (r, z) points around the vertical through c. Rings are shared so it shades smooth."""
    ang = np.arange(n) * 2 * np.pi / n
    cs, sn = np.cos(ang), np.sin(ang)
    vs = []
    for r, z in profile:
        vs.append(np.stack([cs * r * scale[0], sn * r * scale[1], np.full(n, z * scale[2])], 1))
    v = np.concatenate(vs).astype(np.float32)
    if rot is not None:
        v = v @ np.asarray(rot, np.float32).T
    v = v + np.asarray(c, np.float32)
    m = len(profile)
    quads = [[k * n + i, k * n + (i + 1) % n, (k + 1) * n + (i + 1) % n, (k + 1) * n + i] for k in range(m - 1) for i in range(n)]
    base = mb.add(v, quads=quads, col=col)
    # caps
    for k, flip in ((0, True), (m - 1, False)):
        if caps and profile[k][0] > 1e-4:
            ctr = v[k * n:(k + 1) * n].mean(0)
            ring = v[k * n:(k + 1) * n]
            tr = [[n, (i + 1) % n, i] if flip else [n, i, (i + 1) % n] for i in range(n)]
            mb.add(np.concatenate([ring, [ctr]]), tris=tr, col=col)


_ICO = {}


def _ico(sub):
    if sub not in _ICO:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
        bm.verts.ensure_lookup_table()
        v = np.array([x.co[:] for x in bm.verts], np.float32)
        t = np.array([[x.index for x in f.verts] for f in bm.faces], np.int64)
        bm.free()
        _ICO[sub] = (v, t)
    return _ICO[sub]


def blob(mb, c, radii, col, sub=2, rough=0.15, rng=None, rot=None, flat_bottom=None):
    v, t = _ico(sub)
    rng = rng or np.random.default_rng(0)
    v = v * (1 + rng.uniform(-rough, rough, (len(v), 1)).astype(np.float32))
    v = v * np.asarray(radii, np.float32)
    if flat_bottom is not None:
        v[:, 2] = np.maximum(v[:, 2], flat_bottom)
    if rot is not None:
        v = v @ np.asarray(rot, np.float32).T
    mb.add(v + np.asarray(c, np.float32), tris=t, col=col)


def cards(mb, centers, size, cols, rng, droop=0.0, split=None):
    """Small randomly turned leaves (pointed, twice as long as wide): the building block of foliage.

    With DETAIL above 1 every requested leaf becomes a little spray of smaller ones around the same spot.
    """
    centers = np.asarray(centers, np.float32).reshape(-1, 3)
    if len(centers) == 0:
        return
    k = split if split is not None else max(1, int(round(DETAIL * DETAIL * 0.65)))
    size = np.broadcast_to(np.asarray(size, np.float32), (len(centers),))
    if k > 1:
        centers = np.repeat(centers, k, 0)
        size = np.repeat(size, k) / math.sqrt(k) * 1.2
        centers = centers + rng.normal(0, 1, centers.shape).astype(np.float32) * size[:, None] * 1.3
    n = len(centers)
    u = rng.normal(0, 1, (n, 3)).astype(np.float32)
    u /= np.linalg.norm(u, axis=1, keepdims=True)
    w = rng.normal(0, 1, (n, 3)).astype(np.float32)
    w -= u * (w * u).sum(1, keepdims=True)
    w /= np.linalg.norm(w, axis=1, keepdims=True)
    s = (size * rng.uniform(0.6, 1.25, n).astype(np.float32))[:, None]
    u = u * s * 1.45
    w = w * s * 0.7
    if droop:
        centers = centers + np.array([0, 0, -droop], np.float32) * rng.uniform(0, 1, (n, 1)).astype(np.float32)
    v = np.stack([centers - u, centers + w - u * 0.15, centers + u, centers - w - u * 0.15], 1).reshape(-1, 3)
    q = np.arange(n * 4).reshape(n, 4)
    cols = np.asarray(cols, np.float32)
    c = cols[rng.integers(0, len(cols), n)] * rng.uniform(0.72, 1.25, (n, 1)).astype(np.float32)
    mb.add(v, quads=q, col=c)


def hash01(a, b, seed=0.0):
    h = np.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453
    return h - np.floor(h)


# ---------------------------------------------------------------- masonry
def wall(mb, p0, p1, thick, mask_fn, zmax, col, z0=0.0, res=0.125, block=(1.35, 0.7), seed=0.0,
         var=0.22, joint=0.74, tint2=None, col_fn=None, relief=0.07, groove=0.045, chip=0.24):
    """A wall as a 2D mask in its own plane (t along the wall, z up), extruded to `thick`.

    mask_fn(T, Z, tc, zc, r) -> bool array.  T, Z are cell centres; tc, zc the centre and the base of the masonry
    block a cell belongs to; r a random number per block.  Deciding from tc/zc removes whole blocks, which is
    what gives a ruined edge; deciding from T/Z cuts stone cleanly, which is what windows need.

    The face is not flat: every block sits a little proud or shy of its neighbours and is slightly tilted (`relief`),
    the joints between blocks are cut in (`groove`), and free edges are nibbled away here and there (`chip`).
    """
    p0 = np.asarray(p0, np.float64)
    p1 = np.asarray(p1, np.float64)
    d = p1 - p0
    L = float(np.hypot(d[0], d[1]))
    d = d / L
    nrm = np.array([d[1], -d[0]])
    if DETAIL > 1.5:
        res = res / 2          # arches and broken edges are cut twice as finely
    nt = max(1, int(round(L / res)))
    nz = max(1, int(round((zmax - z0) / res)))
    rt, rz = L / nt, (zmax - z0) / nz
    tt = (np.arange(nt) + 0.5) * rt
    zz = z0 + (np.arange(nz) + 0.5) * rz
    T, Z = np.meshgrid(tt, zz)
    bl, bh = block
    course = np.floor((Z - z0) / bh)
    off = hash01(course, 7.0, seed) * bl
    bi = np.floor((T + off) / bl)
    r = hash01(course, bi, seed)
    tc = (bi + 0.5) * bl - off
    zc = z0 + course * bh
    m = np.asarray(mask_fn(T, Z, tc, zc, r), bool)
    if not m.any():
        return
    if chip > 0:
        # worn edges: bites out of the top and the ends, and most outer corners knocked off
        mp = np.pad(m, 1)
        up_, lf, rg = mp[2:, 1:-1], mp[1:-1, :-2], mp[1:-1, 2:]
        free = m & ~(up_ & lf & rg)
        corner = m & ~up_ & ~(lf & rg)
        bite = hash01(np.floor(T / (rt * 2)), np.floor(Z / (rz * 2)), seed + 9.9)
        m = m & ~(free & (bite < chip)) & ~(corner & (bite < 0.75))
        if not m.any():
            return
    # colour: per-block variation, darker joints
    fr_t = ((T + off) / bl) % 1.0
    fr_z = ((Z - z0) / bh) % 1.0
    jt = np.where((fr_t < rt / bl * 0.9) | (fr_z < rz / bh * 0.9), joint, 1.0)
    r2 = hash01(bi, course, seed + 3.1)
    base = np.asarray(col, np.float32)
    shade = (1 - var + 2 * var * r)[..., None] * jt[..., None]
    C = base[None, None, :] * shade
    if tint2 is not None:
        C = C * (1 + (np.asarray(tint2, np.float32) - 1)[None, None, :] * r2[..., None])
    if col_fn is not None:
        C = np.asarray(col_fn(r, r2, T, Z), np.float32)
    # vertices: (nz+1, nt+1) lattice on the front (+nrm) and the back (-nrm)
    gt = np.arange(nt + 1) * rt
    gz = z0 + np.arange(nz + 1) * rz
    GT, GZ = np.meshgrid(gt, gz)
    def pts(s):
        return np.stack([p0[0] + d[0] * GT + nrm[0] * s, p0[1] + d[1] * GT + nrm[1] * s, GZ], -1).reshape(-1, 3)
    OFF = 0.0
    if relief > 0 or groove > 0:
        cv = np.clip(np.floor((GZ - z0) / bh - 1e-6), 0, None)
        offv = hash01(cv, 7.0, seed) * bl
        biv = np.floor((GT + offv) / bl)
        rv = hash01(cv, biv, seed + 5.7)
        ft, fz = ((GT + offv) / bl) % 1.0, ((GZ - z0) / bh) % 1.0
        jw = max(rt, rz) * 0.55
        inj = (np.minimum(ft, 1 - ft) * bl < jw) | (np.minimum(fz, 1 - fz) * bh < jw)
        tilt = (hash01(biv, cv, seed + 1.3) - 0.5) * (ft - 0.5) + (hash01(biv, cv, seed + 2.9) - 0.5) * (fz - 0.5)
        OFF = relief * (rv - 0.4) + relief * 1.1 * tilt
        OFF = np.where(rv < 0.06, -relief * 1.5, OFF)             # here and there a stone has gone
        OFF = np.where(inj, -groove, OFF)
    V = np.concatenate([pts(thick / 2 + OFF), pts(-thick / 2 - OFF)])
    nb = (nz + 1) * (nt + 1)
    idx = lambda k, i: k * (nt + 1) + i
    K, I = np.nonzero(m)
    a, b, c_, e = idx(K, I), idx(K, I + 1), idx(K + 1, I + 1), idx(K + 1, I)
    quads = [np.stack([a, b, c_, e], 1), np.stack([b + nb, a + nb, e + nb, c_ + nb], 1)]
    cols = [C[K, I], C[K, I]]
    mp = np.pad(m, 1)
    def side(sel, q):
        k, i = K[sel], I[sel]
        A, B, Cc, E = idx(k, i), idx(k, i + 1), idx(k + 1, i + 1), idx(k + 1, i)
        quads.append(q(A, B, Cc, E))
        cols.append(C[k, i])
    side(~mp[K + 2, I + 1], lambda A, B, Cc, E: np.stack([E, Cc, Cc + nb, E + nb], 1))        # top
    side(~mp[K, I + 1], lambda A, B, Cc, E: np.stack([A + nb, B + nb, B, A], 1))              # bottom
    side(~mp[K + 1, I], lambda A, B, Cc, E: np.stack([A + nb, A, E, E + nb], 1))              # t0 end
    side(~mp[K + 1, I + 2], lambda A, B, Cc, E: np.stack([B, B + nb, Cc + nb, Cc], 1))        # t1 end
    mb.add(V, quads=np.concatenate(quads), col=np.concatenate(cols))


def lancet(T, Z, tc, w, z_sill, z_spring, k=1.0):
    """Pointed arch opening centred at tc.  k=1 is the tall equilateral arch; smaller k gives a lower one."""
    u = T - tc
    R = k * w
    c = w / 2 - R
    dz2 = (Z - z_spring) ** 2
    rect = (np.abs(u) < w / 2) & (Z >= z_sill) & (Z <= z_spring)
    arch = (Z > z_spring) & ((u - c) ** 2 + dz2 < R * R) & ((u + c) ** 2 + dz2 < R * R)
    return rect | arch


def ruin_profile(seed, lo, hi, scale=5.0, rough=0.6):
    """Height of a broken wall top as a function of position along the wall."""
    rng = np.random.default_rng(int(seed * 1000) % (2 ** 31))
    ph = rng.uniform(0, 6.28, 4)
    def f(t):
        n = 0.5 + 0.5 * (0.55 * np.sin(t / scale + ph[0]) + 0.3 * np.sin(t / scale * 2.3 + ph[1]) + 0.15 * np.sin(t / scale * 5.1 + ph[2]))
        return lo + (hi - lo) * np.clip(n, 0, 1) ** (1 / max(rough, 1e-3))
    return f


# ---------------------------------------------------------------- trees and plants
def tree(wood, leaf, base, height, seed, trunk_r=0.35, depth=4, spread=0.75, lean=(0, 0), leaf_cols=None,
         leaf_n=0, leaf_size=0.22, leaf_r=1.2, wood_col=(0.10, 0.075, 0.07), tips_out=None, gnarl=0.28):
    rng = random.Random(seed)
    nrng = np.random.default_rng(seed)
    tips = []

    def norm(v):
        return v / (np.linalg.norm(v) + 1e-9)

    def branch(p, d, length, r, lvl):
        nseg = 3 if lvl > 0 else 2
        for k in range(nseg):
            d = norm(d + np.array([rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.5, 0.7)]) * gnarl)
            p1 = p + d * length / nseg
            r1 = r * (0.86 if lvl > 0 else 0.6)
            shade = rng.uniform(0.8, 1.15)
            frustum(wood, p, p1, r, r1, 6 if r > 0.12 else 4, np.array(wood_col) * shade, cap0=False, cap1=(lvl == 0 and k == nseg - 1))
            p, r = p1, r1
        if lvl > 0:
            for k in range(rng.randint(2, 3)):
                side = norm(np.cross(d, np.array([rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)])))
                nd = norm(d * (1 - spread * 0.5) + side * spread + np.array([0, 0, 0.18]))
                branch(p, nd, length * rng.uniform(0.62, 0.82), r * rng.uniform(0.6, 0.75), lvl - 1)
        else:
            tips.append(p)

    b = np.asarray(base, np.float64)
    # root flare
    frustum(wood, b + np.array([0, 0, -0.3]), b + np.array([0, 0, 0.5]), trunk_r * 1.7, trunk_r, 7, np.array(wood_col) * 0.9, cap0=False, cap1=False)
    branch(b + np.array([0, 0, 0.5]), norm(np.array([lean[0], lean[1], 1.0])), height * 0.42, trunk_r, depth)
    if leaf is not None and leaf_n and leaf_cols is not None:
        tp = np.array(tips)
        k = nrng.integers(0, len(tp), leaf_n)
        dirs = nrng.normal(0, 1, (leaf_n, 3))
        dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
        pts = tp[k] + dirs * (nrng.uniform(0, 1, (leaf_n, 1)) ** 0.5) * leaf_r * np.array([1, 1, 0.7])
        cards(leaf, pts, leaf_size, leaf_cols, nrng, droop=0.15)
    if tips_out is not None:
        tips_out.extend(tips)
    return tips


def conifer(wood, leaf, core, base, height, radius, seed, cols, wood_col=(0.08, 0.06, 0.06)):
    """Dark yew or fir: a solid dark cone wrapped in drooping leaf cards."""
    rng = np.random.default_rng(seed)
    b = np.asarray(base, np.float64)
    frustum(wood, b + [0, 0, -0.4], b + [0, 0, height * 0.35], radius * 0.14, radius * 0.08, 5, wood_col, cap0=False)
    z0 = height * 0.14
    lathe(core, b, [(radius * 0.72, z0), (radius * 0.80, z0 + height * 0.12), (radius * 0.42, height * 0.62), (0.02, height * 0.98)], 9,
          np.array(cols[0]) * 0.45)
    n = int(140 * radius * height / 4)
    t = rng.uniform(0, 1, n) ** 0.75
    z = z0 + t * (height - z0)
    rr = radius * (1 - t) ** 0.85 * rng.uniform(0.8, 1.12, n) + 0.05
    a = rng.uniform(0, 6.283, n)
    pts = np.stack([b[0] + np.cos(a) * rr, b[1] + np.sin(a) * rr, b[2] + z], 1)
    cards(leaf, pts, 0.26 * (0.7 + 0.5 * (1 - t.mean())), cols, rng, droop=0.25)


def bush(leaf, core, c, r, seed, cols, flat=0.7):
    rng = np.random.default_rng(seed)
    blob(core, (c[0], c[1], c[2] + r * flat * 0.45), (r * 0.8, r * 0.8, r * flat * 0.8), np.array(cols[0]) * 0.4, sub=1, rough=0.2, rng=rng)
    n = int(60 * r * r) + 12
    d = rng.normal(0, 1, (n, 3))
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    d[:, 2] = np.abs(d[:, 2])
    pts = np.asarray(c) + d * np.array([r, r, r * flat]) * rng.uniform(0.8, 1.05, (n, 1)) + [0, 0, r * flat * 0.25]
    cards(leaf, pts, 0.2, cols, rng, droop=0.05)


def tufts(mb, pts, rng, cols, h=(0.18, 0.42), w=0.07, blades=4):
    """Grass: a few thin blades per point, each bent once, darker at the root and lighter at the tip."""
    pts = np.asarray(pts, np.float32).reshape(-1, 3)
    n = len(pts)
    if n == 0:
        return
    fine = DETAIL > 1.5
    if fine:
        blades, w = blades * 3, w * 0.42
    P = np.repeat(pts, blades, 0)
    m = len(P)
    jit = 0.22 if fine else 0.12
    P = P + np.concatenate([rng.uniform(-jit, jit, (m, 2)), np.zeros((m, 1))], 1).astype(np.float32)
    a = rng.uniform(0, 6.283, m)
    hh = (rng.uniform(h[0], h[1], m) * (rng.uniform(0.55, 1.25, m) if fine else 1.0)).astype(np.float32)
    side = np.stack([np.cos(a), np.sin(a), np.zeros(m)], 1).astype(np.float32) * w
    lean = np.stack([rng.uniform(-0.16, 0.16, m), rng.uniform(-0.16, 0.16, m), np.zeros(m)], 1).astype(np.float32)
    up = np.stack([np.zeros(m), np.zeros(m), hh], 1).astype(np.float32)
    mid = P + up * 0.55 + lean * 0.35
    tip = P + up + lean * (1.0 + hh[:, None] * 1.5)
    v = np.stack([P - side, P + side, mid + side * 0.7, mid - side * 0.7, tip], 1).reshape(-1, 3)
    cols = np.asarray(cols, np.float32)
    c = cols[rng.integers(0, len(cols), m)] * rng.uniform(0.7, 1.25, (m, 1)).astype(np.float32)
    vc = np.stack([c * 0.6, c * 0.6, c, c, c * 1.35], 1).reshape(-1, 3)
    b = np.arange(m)[:, None] * 5
    mb.add(v, quads=b + np.array([[0, 1, 2, 3]]), tris=b + np.array([[3, 2, 4]]), vcol=vc)
