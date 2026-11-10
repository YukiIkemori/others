"""Game data taken from the same solid model the picture was rendered from.

Two passes of ray casts:
  1. through every pixel of the picture, along the camera direction: height, facing and base colour of what is
     visible there.  The game uses height to decide what stands in front of the character, and facing and colour
     to let the hero's lantern light the surroundings.
  2. straight down on a grid over the ground: where is there a floor, how high is it, and is there room to stand.

Pass 1 also notes what the pixel-art finish needs to colour the picture by hand instead of rendering it: for the
first thing seen through each pixel (grass tufts and flowers included) which material it is, its colour and facing,
whether the key light reaches it, and how hemmed in it is by its surroundings.
"""
import os, time
from collections import deque
import numpy as np
import bpy
from mathutils import Vector

CELL = 0.125          # ground grid: 8 cells per unit (2 pixels across)
GX0, GX1, GY0, GY1 = -30.0, 30.0, -4.0, 64.0
HEAD = 2.7            # room needed above a floor
STEP = 0.45           # tallest step that can be walked up
KIND = {'floor': 1, 'solid': 2, 'soft': 3, 'cover': 4}
SKIP = {'moonrefl', 'moonblack'}          # only there to be mirrored in the pool
KEY = Vector((-0.55, -0.45, 0.70)).normalized()   # where the key light comes from: front left, above


def run(sc, OBJ, FACECOL, meta, WORK, P):
    S, SIN, COS, W, H, X0, SY0 = P['S'], P['SIN'], P['COS'], P['W'], P['H'], P['X0'], P['SY0']
    t0 = time.time()

    def hide(kinds):
        for o in OBJ.values():
            o.hide_viewport = o['kind'] in kinds
        bpy.context.view_layer.update()
        return bpy.context.evaluated_depsgraph_get()

    # ---- pass 1: per pixel
    dg = hide(set())
    view = Vector((0, COS, -SIN))
    zmap = np.full((H, W), np.nan, np.float32)
    nrm = np.zeros((H, W, 3), np.float32)
    alb = np.zeros((H, W, 3), np.float32)
    kind = np.zeros((H, W), np.uint8)
    names = sorted(OBJ.keys())
    MAT = {n: k + 1 for k, n in enumerate(names)}
    vz = np.full((H, W), np.nan, np.float32)     # the same for the first thing seen, cover included
    vnrm = np.zeros((H, W, 3), np.float32)
    vcol = np.zeros((H, W, 3), np.float32)
    vmat = np.zeros((H, W), np.uint8)
    lit = np.zeros((H, W), np.uint8)             # 1 where the key light arrives
    AOS = 2                                      # how hemmed in, worked out for every second pixel
    ao = np.ones(((H + 1) // AOS, (W + 1) // AOS), np.float32)
    cast = sc.ray_cast
    back = view * 220
    eps = view * 0.002
    X_, Y_ = Vector((1, 0, 0)), Vector((0, 1, 0))
    for j in range(H):
        gy = (SY0 - (j + 0.5)) / S / SIN
        zr, nr, ar, kr = zmap[j], nrm[j], alb[j], kind[j]
        for i in range(W):
            org = Vector((X0 + (i + 0.5) / S, gy, 0.0)) - back
            seen = False
            for _ in range(8):
                hit, loc, n, idx, ob, _m = cast(dg, org, view)
                if not hit:
                    break
                nm = ob.name
                k = KIND[ob['kind']]
                if not seen and nm not in SKIP:
                    seen = True
                    fn = -n if n.dot(view) > 0 else n
                    vz[j, i] = loc.z
                    vnrm[j, i] = fn
                    vcol[j, i] = FACECOL[nm][idx]
                    vmat[j, i] = MAT[nm]
                    # does the key light reach it?  Grass and flowers throw no shadow.
                    so = loc + fn * 0.03
                    reach = True
                    for _s in range(4):
                        h2, l2, n2, i2, o2, _m2 = cast(dg, so, KEY, distance=70.0)
                        if not h2:
                            break
                        if o2['kind'] != 'cover':
                            reach = False
                            break
                        so = l2 + KEY * 0.01
                    lit[j, i] = 1 if reach else 0
                    if j % AOS == 0 and i % AOS == 0:
                        t = fn.cross(X_ if abs(fn.x) < 0.9 else Y_).normalized()
                        b_ = fn.cross(t)
                        occ = 0.0
                        for d_, w_ in ((fn, 1.0), (fn * 0.57 + t * 0.82, 0.75), (fn * 0.57 - t * 0.82, 0.75),
                                       (fn * 0.57 + b_ * 0.82, 0.75), (fn * 0.57 - b_ * 0.82, 0.75)):
                            h2, l2, n2, i2, o2, _m2 = cast(dg, loc + fn * 0.03, d_, distance=1.5)
                            if h2 and o2['kind'] != 'cover':
                                occ += w_
                        ao[j // AOS, i // AOS] = 1.0 - occ / 4.0
                if k != 4:
                    zr[i] = loc.z
                    nr[i] = n
                    ar[i] = FACECOL[nm][idx]
                    kr[i] = k
                    break
                org = loc + eps
    print('  pixel pass', round(time.time() - t0, 1), 's')

    # ---- pass 2: the ground grid
    t1 = time.time()
    dg = hide({'cover', 'soft'})
    nx, ny = int(round((GX1 - GX0) / CELL)), int(round((GY1 - GY0) / CELL))
    floor = np.full((ny, nx), np.nan, np.float32)
    free = np.zeros((ny, nx), bool)       # a floor with headroom
    blocked = np.zeros((ny, nx), bool)    # a floor with something standing on it
    down = Vector((0, 0, -1))
    for j in range(ny):
        y = GY0 + (j + 0.5) * CELL
        for i in range(nx):
            x = GX0 + (i + 0.5) * CELL
            z = 60.0
            inside = 0
            last_exit = None
            for it in range(14):
                hit, loc, n, idx, ob, _ = cast(dg, Vector((x, y, z)), down)
                if not hit:
                    break
                if ob['kind'] == 'floor' and inside <= 0:
                    if n.z > 0.9:
                        floor[j, i] = loc.z
                        if last_exit is None or last_exit - loc.z > HEAD:
                            free[j, i] = True
                        else:
                            blocked[j, i] = True
                    break
                if ob['kind'] == 'floor':
                    floor[j, i] = loc.z
                    blocked[j, i] = True
                    break
                if n.z >= 0:
                    inside += 1
                else:
                    inside -= 1
                    last_exit = loc.z
                z = loc.z - 0.002
    print('  ground pass', round(time.time() - t1, 1), 's')

    # keep a body's width away from things that stand on the floor (more sideways than in depth)
    grow = np.zeros_like(blocked)
    bp = np.pad(blocked, 4)
    for dy in range(-2, 3):
        for dx in range(-3, 4):
            if (dx / 2.9) ** 2 + (dy / 1.9) ** 2 <= 1.0:
                grow |= bp[4 + dy:4 + dy + ny, 4 + dx:4 + dx + nx]
    walk0 = free & ~grow
    # what can actually be reached from the start without climbing more than a step
    sx, sy = P['SPAWN']
    si, sj = int((sx - GX0) / CELL), int((sy - GY0) / CELL)
    assert walk0[sj, si], 'spawn is not on walkable ground'
    reach = np.zeros_like(walk0)
    reach[sj, si] = True
    dq = deque([(sj, si)])
    while dq:
        j, i = dq.popleft()
        h = floor[j, i]
        for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b = j + dj, i + di
            if 0 <= a < ny and 0 <= b < nx and walk0[a, b] and not reach[a, b] and abs(floor[a, b] - h) <= STEP:
                reach[a, b] = True
                dq.append((a, b))
    print('  walkable cells', int(reach.sum()), 'of', nx * ny, '| bake', round(time.time() - t0, 1), 's')
    for o in OBJ.values():
        o.hide_viewport = False
    np.savez_compressed(os.path.join(WORK, 'bake.npz'), zmap=zmap, nrm=nrm, alb=alb, kind=kind, floor=floor, walk=reach,
                        grid=np.array([GX0, GY0, CELL, nx, ny], np.float32),
                        vz=vz, vnrm=vnrm, vcol=vcol, vmat=vmat, lit=lit, ao=ao, names=np.array(names), key=np.array(KEY[:], np.float32))
