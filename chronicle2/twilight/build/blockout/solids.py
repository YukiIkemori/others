"""The faces of the blocks that the painting cannot show, for the HD-2D view.

The picture is a parallel projection from the south: it shows south faces and tops.  The HD-2D camera has perspective, so
towards the screen's edges it also looks at the EAST and WEST faces of things (a house's side wall, the flank of a stone wall,
a chimney's side), and low on the screen it looks over a ridge onto the roof's far slope.  The relief made from the picture
has nothing there: a house reads as a signboard with a lid.  This step takes those faces straight from the blocks:

  sides   every east/west face that the relief leaves open (a run of 5 voxels or more to the north), any material but
          the soft ones (leaves, bushes, wheat, water: the painter's shapes differ too much from the blocks there)
  caps    the tops of roofs (and haystacks) that the picture's own line of sight does not reach

They have no paint of their own, so each takes the paint of the face next to it, mirrored at the edge they share (a side
wall continues its front wall around the corner, the far slope mirrors the near slope at the ridge), a little darker.

usage: solids.py world_module bake_dir pts.npy stage_dir      -> stage_dir/solid.txt
       (base64 of: uint32 nVerts, nIndex; float32 nVerts x 6: x, y, h (painting space, as height.png), u, v (painting dot), shade;
        uint32 index.  Text, because the page host serves no raw binary files.)"""
import sys, os, json, base64, importlib, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from warp import fit
import vox
from vox import VPU, MAT

MIN_RUN = 5            # voxels: shorter steps are bridged by the relief itself (hd.js JUMP = 14 dots = 4.7 voxels of depth)
MIN_TALL = 6           # voxels: lower faces are steps of a slope or an eave's rim, which the relief bridges (5 voxels of height = 13 dots)
STRETCH = 2.0          # a side wall is seen at a flat angle: its borrowed paint is laid out this much longer than life
SOFT = ('leaf', 'bush', 'conifer', 'maple', 'glowleaf', 'hay', 'sheep', 'wheat', 'water', 'fall', 'trunk', 'whitebark', 'crystal', 'cloth')
CAPS = ('roof', 'thatch', 'hay')
SHADE_SIDE, SHADE_CAP = .74, .8


def build(w, info, soft=SOFT, caps=CAPS):
    V = w.V; NX, NY, NZ = V.shape
    S, A, B, SY0, ZD = info['S'], info['A'], info['B'], info['SY0'], info['ZD']
    def pic(x, y, z): return (x - w.X0) * S, SY0 - (y * A + z * B) * S, (z - ZD) * B * S       # world -> picture x, y and the relief's height
    X = lambda i: w.X0 + i / VPU
    Y = lambda j: w.Y0 + j / VPU
    Z = lambda k: w.Z0 + k / VPU
    verts, index = [], []
    def quad(p, t, shade):
        n = len(verts)
        for (x, y, z), (u, v) in zip(p, t): px, py, h = pic(x, y, z); verts.append((px, py, h, u, v, shade))
        index.extend((n, n + 1, n + 2, n + 2, n + 1, n + 3))
    soft_id = np.zeros(256, bool); soft_id[[MAT[m] for m in soft if m in MAT]] = True
    solid = V > 0; hard = solid & ~soft_id[V]
    front = solid.copy(); front[:, 1:, :] &= ~solid[:, :-1, :]            # voxels with air to the south: what the painting shows of a wall
    nq = 0
    # ---- sides
    for sgn in (-1, 1):                                                   # -1: faces that look west, +1: faces that look east
        for i in range(1, NX - 1):
            e = hard[i] & ~solid[i + sgn]                                 # [j, k]
            if not e.any(): continue
            # a face lower than MIN_TALL is a step of a slope or the rim of an eave: the relief has those already
            d = np.diff(np.concatenate([np.zeros((e.shape[0], 1), np.int8), e.astype(np.int8), np.zeros((e.shape[0], 1), np.int8)], axis=1), axis=1)
            for j, k0 in zip(*np.nonzero(d == 1)):
                k1 = k0 + int(np.argmax(d[j, k0 + 1:] == -1)) + 1
                if k1 - k0 < MIN_TALL: e[j, k0:k1] = False
            if not e.any(): continue
            xf = X(i) if sgn < 0 else X(i + 1)
            runs = {}                                                     # (j0, j1, jf, L) -> list of k
            for k in np.nonzero(e.any(axis=0))[0]:
                col = e[:, k]; d = np.diff(np.r_[0, col.astype(np.int8), 0]); st, en = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
                for j0, j1 in zip(st, en):
                    if j1 - j0 < MIN_RUN: continue
                    jf = j0
                    while jf > 0 and solid[i, jf - 1, k]: jf -= 1         # the south end of this block at this height
                    L, ii, jq = 0, i, jf                                  # how far its front face goes on, away from the corner
                    while 0 <= ii < NX and L < 400:                       # (a corner post that stands a finger proud of the wall is still that front)
                        cand = [q for q in (jq, jq - 1, jq + 1, jq - 2, jq + 2) if 0 <= q < NY and front[ii, q, k]]
                        if not cand: break
                        jq = cand[0]; L += 1; ii -= sgn
                    runs.setdefault((int(j0), int(j1), int(jf), max(2, L)), []).append(int(k))
            for (j0, j1, jf, L), ks in runs.items():
                ks.sort(); a = 0
                while a < len(ks):
                    b = a
                    while b + 1 < len(ks) and ks[b + 1] == ks[b] + 1: b += 1
                    k0, k1 = ks[a], ks[b] + 1; a = b + 1
                    seg = L * STRETCH                                     # voxels of depth that one pass over the front face covers
                    c = j0
                    while c < j1:
                        m = int((c - jf) // seg); c1 = min(j1, jf + (m + 1) * seg)
                        def u_at(j):
                            t = (j - jf) / seg - m; t = 1 - t if m % 2 else t           # there and back again
                            return (xf - w.X0) * S - sgn * (1.5 + t * (L / VPU * S - 3))
                        yf = Y(jf)
                        v0, v1 = SY0 - (yf * A + Z(k0) * B) * S, SY0 - (yf * A + Z(k1) * B) * S
                        quad([(xf, Y(c), Z(k0)), (xf, Y(c1), Z(k0)), (xf, Y(c), Z(k1)), (xf, Y(c1), Z(k1))],
                             [(u_at(c), v0 - .5), (u_at(c1), v0 - .5), (u_at(c), v1 + .5), (u_at(c1), v1 + .5)], SHADE_SIDE); nq += 1
                        c = c1
    ns = nq
    # ---- caps: tops that the picture's own sight line does not reach
    cap_id = np.zeros(256, bool); cap_id[[MAT[m] for m in caps if m in MAT]] = True
    ktop = NZ - 1 - np.argmax(solid[:, :, ::-1], axis=2); has = solid.any(axis=2)
    mtop = np.where(has, np.take_along_axis(V, ktop[..., None], axis=2)[..., 0], 0)
    isc = cap_id[mtop] & has
    if isc.any():
        Hh = np.load(info['_h']); Hp, Wp = Hh.shape
        ii, jj = np.nonzero(isc)
        xc, yc, zc = X(ii + .5), Y(jj + .5), Z(ktop[ii, jj] + 1)
        px, py, hh = pic(xc, yc, zc)
        xi, yi = np.clip(px.astype(int), 0, Wp - 1), np.clip(py.astype(int), 0, Hp - 1)
        inside = (px >= 0) & (px < Wp) & (py >= 0) & (py < Hp)
        hid = np.zeros(isc.shape, bool); hid[ii, jj] = inside & (Hh[yi, xi].astype(np.float32) > hh + 4)
        # the paint for a hidden top: the visible top of the same height on the same north-south line, beyond the ridge
        # a slope is a stair of voxels here: its height is evened out along the north-south line, or the borrowed paint zigzags
        zt = np.where(isc, Z(ktop + 1), 0.).astype(np.float64); num = np.zeros_like(zt); den = np.zeros_like(zt)
        for o in range(-4, 5):
            a_ = np.roll(zt, o, axis=1); m_ = np.roll(isc, o, axis=1)
            if o > 0: m_[:, :o] = False
            if o < 0: m_[:, o:] = False
            num += np.where(m_, a_, 0); den += m_
        zs = np.where(isc, np.minimum(num / np.maximum(den, 1), zt + 1e-9), 0)          # never above the roof itself (the ridge keeps its place)
        U = np.zeros(isc.shape, np.float32); Vv = np.zeros(isc.shape, np.float32)
        P = np.zeros(isc.shape + (3,), np.float32)
        for i in np.nonzero(isc.any(axis=1))[0]:
            for j in np.nonzero(isc[i])[0]:
                k = ktop[i, j]; x, y, z = X(i + .5), Y(j + .5), (zs[i, j] if hid[i, j] else Z(k + 1))
                P[i, j] = pic(x, y, z)
                if not hid[i, j]: U[i, j], Vv[i, j] = P[i, j, 0], P[i, j, 1]; continue
                # mirrored at the ridge: the middle of the highest part of this roof on the same north-south line
                ja = j
                while ja > 0 and isc[i, ja - 1]: ja -= 1
                jb = j
                while jb < NY - 1 and isc[i, jb + 1]: jb += 1
                kk = ktop[i, ja:jb + 1]; top_j = np.nonzero(kk == kk.max())[0] + ja; jr = (top_j[0] + top_j[-1] + 1) / 2
                ym = 2 * Y(jr) - y
                if ym < Y(ja): ym = Y(ja) + (Y(ja) - ym)                                  # (a lean-to: no near slope that long; there and back)
                uu, vv, _ = pic(x, ym, z); U[i, j], Vv[i, j] = uu, vv
        vid = -np.ones(isc.shape, np.int64)
        for i in range(NX - 1):
            for j in np.nonzero(isc[i, :-1] & isc[i + 1, :-1] & isc[i, 1:] & isc[i + 1, 1:])[0]:
                c4 = ((i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1))
                if not any(hid[c] for c in c4): continue
                ks = [ktop[c] for c in c4]
                if max(ks) - min(ks) > 3: continue
                ids = []
                for c in c4:
                    if vid[c] < 0: vid[c] = len(verts); verts.append((P[c][0], P[c][1], P[c][2], U[c], Vv[c], SHADE_CAP))
                    ids.append(int(vid[c]))
                index.extend((ids[0], ids[1], ids[2], ids[2], ids[1], ids[3])); nq += 1
    print('side quads %d, cap quads %d, vertices %d' % (ns, nq - ns, len(verts)))
    return np.array(verts, np.float32).reshape(-1, 6), np.array(index, np.uint32)


if __name__ == '__main__':
    name, OUT, PTS, STAGE = sys.argv[1:5]
    mod = importlib.import_module(name)
    info = json.load(open(f'{OUT}/info.json')); info['_h'] = f'{OUT}/h.npy'
    W, H = info['w'], info['h']
    v, ix = build(mod.w, info, getattr(mod, 'SOFT', SOFT), getattr(mod, 'CAPS', CAPS))
    DX, DY, sy = fit(np.load(PTS), H, W, quiet=True)
    def mv(x, y):                                                         # guide space -> the painting (the same field stage.py uses)
        xi, yi = np.clip(np.round(x).astype(int), 0, W - 1), np.clip(np.round(y).astype(int), 0, H - 1)
        return x + DX[yi, xi], y + DY[yi, xi]
    if len(v):
        v[:, 0], v[:, 1] = mv(v[:, 0], v[:, 1]); v[:, 2] *= sy
        v[:, 3], v[:, 4] = mv(v[:, 3], v[:, 4])
    with open(f'{STAGE}/solid.txt', 'wb') as f:
        f.write(base64.b64encode(np.array([len(v), len(ix)], np.uint32).tobytes() + v.tobytes() + ix.tobytes()))
    print('solid.txt: %d KB' % (os.path.getsize(f'{STAGE}/solid.txt') // 1024))
