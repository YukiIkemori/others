"""Tiny voxel blockout kit: build a field out of simple solids, then bake everything the 2D engine needs.

World axes: x east, y north, z up, in "units" (32 game pixels wide).  Camera is a fixed parallel projection:
    sx = (x - X0) * S            sy = SY0 - (y * A + z * B) * S
Along one line of sight, a point that is higher is also nearer to the camera.  Two facts follow and the bake uses both:
  * an upright thing (wall, tree, the hero) is in front of another exactly when it is further SOUTH (smaller y);
  * so occlusion needs only one number per picture pixel: the world y of what is drawn there.
The bake stores that number as H = Yb - sy with Yb = SY0 - y*A*S (screen row of the same y at the datum height ZD),
and for the ground the hero stands on F = (floor z - ZD) * B * S.  A hero pixel at screen row r is hidden when
r + H(pixel) > feetRow + F(feet).  On flat ground this is the old "height above ground contact" rule."""
import json, numpy as np

VPU = 8                      # voxels per unit
MAT = dict(grass=1, path=2, floor=3, stair=4, wall=5, rock=6, roof=7, trunk=8, conifer=9, maple=10, water=11, wood=12,
           tomb=13, lantern=14, carpet=15, statue=16, iron=17, glass=18, bell=19, dark=20,
           crystal=21, glowleaf=22, rune=23, whitebark=24, fall=25)
WALKABLE = (1, 2, 3, 4, 15, 23)
COLOR = {1: (96, 150, 70), 2: (200, 178, 140), 3: (176, 172, 186), 4: (214, 208, 214), 5: (148, 140, 156), 6: (112, 98, 104),
         7: (74, 86, 128), 8: (110, 76, 52), 9: (38, 92, 60), 10: (196, 70, 48), 11: (70, 120, 200), 12: (150, 100, 60),
         13: (206, 204, 210), 14: (255, 214, 96), 15: (170, 44, 52), 16: (226, 224, 232), 17: (60, 60, 76), 18: (255, 176, 80),
         19: (220, 180, 70), 20: (44, 38, 56),
         21: (70, 225, 240), 22: (196, 230, 255), 23: (110, 150, 255), 24: (232, 220, 204), 25: (170, 215, 255)}


class World:
    def __init__(s, x=(0, 40), y=(-8, 40), z=(-12, 28)):
        s.X0, s.X1 = x; s.Y0, s.Y1 = y; s.Z0, s.Z1 = z
        s.NX, s.NY, s.NZ = [int(round((b - a) * VPU)) for a, b in (x, y, z)]
        s.V = np.zeros((s.NX, s.NY, s.NZ), np.uint8)
        s.XX, s.YY = np.meshgrid(s.X0 + (np.arange(s.NX) + .5) / VPU, s.Y0 + (np.arange(s.NY) + .5) / VPU, indexing='ij')
        s.ZC = s.Z0 + (np.arange(s.NZ) + .5) / VPU
        s.lights = []; s.marks = {}

    def ix(s, x): return int(np.clip(round((x - s.X0) * VPU), 0, s.NX))
    def iy(s, y): return int(np.clip(round((y - s.Y0) * VPU), 0, s.NY))
    def iz(s, z): return int(np.clip(round((z - s.Z0) * VPU), 0, s.NZ))

    # ---- solids
    def box(s, x0, x1, y0, y1, z0, z1, m):
        s.V[s.ix(x0):s.ix(x1), s.iy(y0):s.iy(y1), s.iz(z0):s.iz(z1)] = m if isinstance(m, int) else MAT[m]

    def col(s, mask, z0, z1, m):
        """fill the columns of a 2D mask between two heights"""
        s.V[mask, s.iz(z0):s.iz(z1)] = m if isinstance(m, int) else MAT[m]

    def cyl(s, cx, cy, r, z0, z1, m):
        s.col((s.XX - cx) ** 2 + (s.YY - cy) ** 2 <= r * r, z0, z1, m)

    def cone(s, cx, cy, r, z0, z1, m, r1=0.0):
        d2 = (s.XX - cx) ** 2 + (s.YY - cy) ** 2
        for k in range(s.iz(z0), s.iz(z1)):
            t = (s.ZC[k] - z0) / (z1 - z0); rr = r + (r1 - r) * t
            s.V[d2 <= rr * rr, k] = MAT[m]

    def pyramid(s, x0, x1, y0, y1, z0, z1, m):
        cx, cy, hx, hy = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        for k in range(s.iz(z0), s.iz(z1)):
            t = 1 - (s.ZC[k] - z0) / (z1 - z0)
            s.V[(np.abs(s.XX - cx) <= hx * t) & (np.abs(s.YY - cy) <= hy * t), k] = MAT[m]

    def ball(s, cx, cy, cz, r, m, squash=1.0):
        d2 = (s.XX - cx) ** 2 + (s.YY - cy) ** 2
        for k in range(s.iz(cz - r * squash), s.iz(cz + r * squash)):
            rr2 = r * r - ((s.ZC[k] - cz) / squash) ** 2
            if rr2 > 0: s.V[d2 <= rr2, k] = MAT[m]

    def limb(s, p0, p1, r0, r1, m):
        p0, p1 = np.array(p0, float), np.array(p1, float); n = int(np.linalg.norm(p1 - p0) * VPU * 1.5) + 2
        for t in np.linspace(0, 1, n):
            p = p0 + (p1 - p0) * t; s.ball(p[0], p[1], p[2], r0 + (r1 - r0) * t, m)

    def arch_y(s, xc, w, y0, y1, zb, straight, m=0):
        """opening you walk through northwards: width w, straight sides, round top"""
        r = w / 2
        s.box(xc - r, xc + r, y0, y1, zb, zb + straight, m)
        for k in range(s.iz(zb + straight), s.iz(zb + straight + r)):
            hw = np.sqrt(max(0.0, r * r - (s.ZC[k] - zb - straight) ** 2))
            s.V[s.ix(xc - hw):s.ix(xc + hw), s.iy(y0):s.iy(y1), k] = m

    def stairs_n(s, xa, xb, ytop, zlow, zhigh, rise=0.375, run=0.5, side=0.4, side_h=0.7, carve=False, clear=3.2):
        """steps climbing northwards, reaching zhigh at y = ytop.  carve=False: built out on the lower ground."""
        n = int(round((zhigh - zlow) / rise)); ybot = ytop - n * run
        for i in range(n):
            ya, yb, h = ybot + i * run, ybot + (i + 1) * run, zlow + (i + 1) * rise
            if carve: s.box(xa - side, xb + side, ya, yb, h, zhigh + clear, 0)
            s.box(xa, xb, ya, yb, s.Z0 if carve else zlow - 0.5, h - 1 / VPU, 'wall'); s.box(xa, xb, ya, yb, h - 1 / VPU, h, 'stair')
            for x0, x1 in ((xa - side, xa), (xb, xb + side)):
                s.box(x0, x1, ya, yb, zlow - 0.5 if not carve else h - 1, h + side_h, 'wall')
        s.box(xa, xb, ytop, ytop + 1.0, zhigh, zhigh + clear, 0)                 # gap in whatever parapet stands at the top
        s.box(xa, xb, ytop, ytop + 1.0, zhigh - 1 / VPU, zhigh, 'stair')
        for x0, x1 in ((xa - side - .1, xa), (xb, xb + side + .1)):               # end posts
            s.box(x0, x1, ybot - .5, ybot, zlow if not carve else zlow, zlow + rise + 1.3, 'wall')
        return ybot

    def lantern(s, x, y, z, glow_z=None, r=130, post=None):
        """a lantern voxel plus a light entry.  post = ground height if it stands on a post"""
        if post is not None: s.box(x - .19, x + .19, y - .19, y + .19, post, z - .19, 'iron')
        s.box(x - .25, x + .25, y - .25, y + .25, z - .25, z + .25, 'lantern')
        s.lights.append(dict(x=x, y=y, z=z, gz=post if post is not None else glow_z, r=r))

    def mark(s, name, x, y, z, **kw): s.marks[name] = dict(x=x, y=y, z=z, **kw)


def bake(w, out, W=1280, H=1600, S=32, A=0.75, B=0.66, SY0=1350, clearance=2.5, step=0.45, spawn=None):
    import cv2
    from PIL import Image
    V, VP = w.V, VPU
    ZD = w.Z0
    px = np.arange(W) + .5; py = np.arange(H) + .5
    ixs = np.clip((px / S * VP).astype(int), 0, w.NX - 1)[None, :].repeat(H, 0)
    hit = np.zeros((H, W), np.uint8); hk = np.zeros((H, W), np.int32); hj = np.zeros((H, W), np.int32)
    # the second surface on the same line of sight (after the first thing has been passed and air was crossed): what lies BEHIND a near thing
    stt = np.zeros((H, W), np.uint8); hit2 = np.zeros((H, W), np.uint8); hk2 = np.zeros((H, W), np.int32); hj2 = np.zeros((H, W), np.int32)
    sub = 6
    for q in range(w.NZ * sub - 1, -1, -1):
        zc = w.Z0 + (q + .5) / (VP * sub); k = q // sub
        y = ((SY0 - py) / S - zc * B) / A
        iy = np.floor((y - w.Y0) * VP).astype(int); ok = (iy >= 0) & (iy < w.NY)
        if not ok.any(): continue
        m = V[ixs[ok], iy[ok][:, None], k]
        new = (m > 0) & (hit[ok] == 0)
        ss = stt[ok]; jrow = np.broadcast_to(iy[ok][:, None], m.shape)
        if new.any():
            hh = hit[ok]; kk = hk[ok]; jj = hj[ok]
            hh[new] = m[new]; kk[new] = k; jj[new] = jrow[new]
            hit[ok] = hh; hk[ok] = kk; hj[ok] = jj
        sec = (m > 0) & (ss == 2)
        if sec.any():
            hh = hit2[ok]; kk = hk2[ok]; jj = hj2[ok]
            hh[sec] = m[sec]; kk[sec] = k; jj[sec] = jrow[sec]
            hit2[ok] = hh; hk2[ok] = kk; hj2[ok] = jj
        ss = np.where(new, 1, np.where((ss == 1) & (m == 0), 2, np.where(sec, 3, ss))).astype(np.uint8); stt[ok] = ss
    def surface(hit, hk, hj):
        solid = hit > 0
        ztop = w.Z0 + (hk + 1) / VP; ysouth = w.Y0 + hj / VP
        y_at_top = ((SY0 - py[:, None]) / S - ztop * B) / A            # where this line of sight crosses the voxel's top plane
        # top face when the sight line crosses the top plane over a solid voxel with air above it (that voxel is the one really hit)
        jt = np.clip(np.floor((y_at_top - w.Y0) * VP).astype(int), 0, w.NY - 1); ka = np.clip(hk + 1, 0, w.NZ - 1)
        mt = V[ixs, jt, hk]
        top = solid & (mt > 0) & ((V[ixs, jt, ka] == 0) | (hk + 1 >= w.NZ))
        hit = np.where(top, mt, hit)
        # H = Yb - sy ; for a top face Yb - sy = (z - ZD)*B*S exactly, for a south face y is the face plane
        Hh = np.where(top, (ztop - ZD) * B * S, SY0 - ysouth * A * S - py[:, None] - ZD * B * S)
        return solid, top, hit, np.where(solid, np.clip(np.round(Hh), 1, 65535), 0).astype(np.uint16)
    solid, top, hit, Hh = surface(hit, hk, hj)
    Hb = surface(hit2, hk2, hj2)[3]
    standing = solid & ~(top & np.isin(hit, WALKABLE + (MAT['water'],)))
    # ---- guide picture
    lut = np.zeros((256, 3), np.float32)
    for k_, c in COLOR.items(): lut[k_] = c
    g = lut[hit] * np.where(top, 1.0, 0.66)[..., None]
    # light from the upper left: faces whose western neighbour column is open get a little brighter, treads darker at the back
    yb = (Hh.astype(np.float32) + py[:, None])
    e = np.zeros((H, W), bool)
    e[1:, :] |= np.abs(yb[1:, :] - yb[:-1, :]) > 5; e[:, 1:] |= np.abs(yb[:, 1:] - yb[:, :-1]) > 5
    e[:, 1:] |= hit[:, 1:] != hit[:, :-1]; e[1:, :] |= hit[1:, :] != hit[:-1, :]
    g[e & solid] *= 0.72
    g[~solid] = (255, 0, 255)
    Image.fromarray(g.clip(0, 255).astype(np.uint8)).save(f'{out}/guide.png')
    # ---- floors: per column, the highest walkable-material top with head room
    NX, NY, NZ = V.shape
    walkmat = np.isin(V, WALKABLE)
    floor_k = np.full((NX, NY), -1, np.int32)
    need = int(round(clearance * VP))
    free_above = np.zeros((NX, NY), np.int32)                      # empty voxels directly above level k
    for k in range(NZ - 1, -1, -1):
        cand = walkmat[:, :, k] & (free_above >= need) & (floor_k < 0)
        floor_k[cand] = k
        free_above = np.where(V[:, :, k] == 0, free_above + 1, 0)
    fz = np.where(floor_k >= 0, w.Z0 + (floor_k + 1) / VP, np.nan)
    # ---- reachable cells from the spawn, never climbing more than one step
    sx_, sy_ = spawn; si, sj = int((sx_ - w.X0) * VP), int((sy_ - w.Y0) * VP)
    assert floor_k[si, sj] >= 0, 'spawn is not on walkable ground'
    from scipy import ndimage as ndi
    can = floor_k >= 0; core = ndi.binary_erosion(can, np.ones((3, 3), bool))          # the hero is not a point: one-voxel gaps do not count
    reach = np.zeros((NX, NY), bool); reach[si, sj] = True
    fzz = np.nan_to_num(fz, nan=-1e9)
    while True:
        add = np.zeros_like(reach)
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            src = np.roll(reach, (di, dj), (0, 1)); zs = np.roll(fzz, (di, dj), (0, 1))
            add |= src & core & (np.abs(fzz - zs) <= step + 1e-6)
        add &= ~reach
        if not add.any(): break
        reach |= add
    reach = ndi.binary_dilation(reach, np.ones((3, 3), bool)) & can
    # ---- screen-space walk mask and floor map (forward splat, the nearest surface wins)
    Fm = np.full((H, W), -1e9, np.float32)
    def splat(xw, yw, zw):
        sx = np.round((xw - w.X0) * S - .5).astype(int); sy = np.round(SY0 - (yw * A + zw * B) * S - .5).astype(int)
        ok_ = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H)
        np.maximum.at(Fm, (sy[ok_], sx[ok_]), zw[ok_].astype(np.float32))
    ii, jj = np.nonzero(reach); zc_ = fz[ii, jj]
    offs = (np.arange(6) + .5) / 6
    for ox in offs:
        for oy in offs: splat(w.X0 + (ii + ox) / VP, w.Y0 + (jj + oy) / VP, zc_)
    for di, dj in ((1, 0), (0, 1)):                                 # treads of a stair are joined across the riser
        a = reach[:NX - di, :NY - dj] & reach[di:, dj:]
        i1, j1 = np.nonzero(a); z1, z2 = fz[i1, j1], fz[i1 + di, j1 + dj]
        b = (np.abs(z1 - z2) > 0.02) & (np.abs(z1 - z2) <= step + 1e-6); i1, j1, z1, z2 = i1[b], j1[b], z1[b], z2[b]
        for t in np.linspace(0, 1, 13):
            for o in offs:
                if di: splat(w.X0 + (i1 + .5 + t) / VP, w.Y0 + (j1 + o) / VP, z1 + (z2 - z1) * t)
                else: splat(w.X0 + (i1 + o) / VP, w.Y0 + (j1 + .5 + t) / VP, z1 + (z2 - z1) * t)
    walk = (Fm > -1e8).astype(np.uint8) * 255
    walk = cv2.morphologyEx(walk, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    idx = None
    if (walk > 0).any():
        idx = ndi.distance_transform_edt(Fm < -1e8, return_distances=False, return_indices=True)
        Fz = Fm[idx[0], idx[1]]
    # a jump in floor height between neighbouring walkable pixels is not a way through
    jump = np.zeros((H, W), bool)
    d = np.abs(Fz[1:, :] - Fz[:-1, :]) > 0.6; jump[1:, :] |= d; jump[:-1, :] |= d
    d = np.abs(Fz[:, 1:] - Fz[:, :-1]) > 0.6; jump[:, 1:] |= d; jump[:, :-1] |= d
    walk[jump] = 0
    F = np.where(walk > 0, np.clip(np.round((Fz - ZD) * B * S), 0, 65535), 0).astype(np.uint16)
    def pack(a):
        p = np.zeros((H, W, 3), np.uint8); p[..., 0] = a & 255; p[..., 1] = a >> 8; return p
    Image.fromarray(walk).save(f'{out}/walk.png'); Image.fromarray(pack(Hh)).save(f'{out}/height.png'); Image.fromarray(pack(F)).save(f'{out}/floor.png'); Image.fromarray(pack(Hb)).save(f'{out}/behind.png')
    np.save(f'{out}/h.npy', Hh); np.save(f'{out}/standing.npy', standing); np.save(f'{out}/hit.npy', hit)
    def scr(x, y, z): return [round((x - w.X0) * S), round(SY0 - (y * A + z * B) * S)]
    def ground(x, y):
        i, j = int((x - w.X0) * VP), int((y - w.Y0) * VP); return float(fzz[i, j]) if floor_k[i, j] >= 0 else None
    info = dict(w=W, h=H, S=S, A=A, B=B, SY0=SY0, ZD=ZD, spawn=scr(spawn[0], spawn[1], ground(*spawn)), lights=[], marks={})
    for L in w.lights:
        gz = L['gz'] if L['gz'] is not None else ground(L['x'], L['y'] - .6)
        info['lights'].append(dict(p=scr(L['x'], L['y'] - .25, L['z']), g=scr(L['x'], L['y'] - .5, gz if gz is not None else L['z'] - 2), r=L['r']))
    for k_, m_ in w.marks.items():
        gz = ground(m_['x'], m_['y']); e_ = dict(p=scr(m_['x'], m_['y'], m_['z'] if gz is None else gz), air=scr(m_['x'], m_['y'], m_['z']), on_ground=gz is not None)
        if 'poly' in m_: e_['poly'] = [scr(*q) for q in m_['poly']]
        for k2 in m_:
            if k2 not in ('x', 'y', 'z', 'poly'): e_[k2] = m_[k2]
        info['marks'][k_] = e_
    json.dump(info, open(f'{out}/info.json', 'w'), ensure_ascii=False, indent=1)
    print('solid px %d, walk px %d, standing px %d, reachable cells %d' % (solid.sum(), (walk > 0).sum(), standing.sum(), reach.sum()))
    return info
