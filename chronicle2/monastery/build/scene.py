"""鐘のならない修道院 -- builds the abbey in Blender, renders it from the fixed game camera, and bakes game data.

Run:  python scene.py            (needs the `bpy` module: pip install bpy)
Env:  SAMPLES=..  render quality (default 160)     QUICK=1  skip the data bake
Out:  work/beauty.png  work/bake.npz  work/meta.json   (post.py turns these into the game files)
"""
import bpy, math, os, sys, json, random, time
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import kit
from kit import (MB, box, box2, frustum, lathe, blob, cards, wall, lancet, ruin_profile, tree, conifer, bush, tufts,
                 rotz, rotx, roty, hash01)

WORK = os.environ.get('WORK', os.path.join(HERE, 'work'))
os.makedirs(WORK, exist_ok=True)
SAMPLES = int(os.environ.get('SAMPLES', '160'))
QUICK = os.environ.get('QUICK') == '1'
T0 = time.time()

# ---------------------------------------------------------------- the game camera
# The layout is measured on a base grid of 16 pixels per world unit.  The camera looks north and down so that one
# unit of ground depth is 12 base pixels and one unit of height is ~10.6.  The picture is rendered RES times finer
# than that grid (3 -> 48 pixels per unit), and the per-pixel game data DRES times finer (1.5 -> 24 per unit).
RES = int(os.environ.get('RES', '3'))
DRES = float(os.environ.get('DRES', '1.5'))
S = 16.0
kit.DETAIL = float(os.environ.get('DETAIL', '2.5' if RES > 1 else '1'))
SIN = 0.75
COS = math.sqrt(1 - SIN * SIN)
W, H = 960, 1024
X0 = -30.0          # world x at the left edge of the picture
SY0 = 975.0         # picture y of the world origin (y=0, z=0)


def to_screen(x, y, z):
    return (x - X0) * S, SY0 - (y * SIN + z * COS) * S


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
col = sc.collection
RNG = np.random.default_rng(11)


# ---------------------------------------------------------------- materials
def mk_mat(name, rough=0.92, grain=0.10, gscale=7.0, stain=0.2, sscale=0.55, bump=0.2, moss=0.0,
           moss_col=(0.085, 0.12, 0.045), emit=0.0, metallic=0.0, spec=0.25, dirt=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    bs = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    at = N.new('ShaderNodeAttribute')
    at.attribute_name = 'col'
    geo = N.new('ShaderNodeNewGeometry')

    def noise(scale, detail):
        n = N.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        L.new(geo.outputs['Position'], n.inputs['Vector'])
        return n

    def maprange(src, f0, f1, t0, t1):
        mr = N.new('ShaderNodeMapRange')
        mr.inputs[1].default_value, mr.inputs[2].default_value = f0, f1
        mr.inputs[3].default_value, mr.inputs[4].default_value = t0, t1
        L.new(src, mr.inputs[0])
        return mr

    n1, n2 = noise(gscale, 4), noise(sscale, 3)
    a = maprange(n1.outputs[0], 0.25, 0.75, 1 - grain, 1 + grain)
    b = maprange(n2.outputs[0], 0.3, 0.7, 1 - stain, 1 + stain)
    mul = N.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    L.new(a.outputs[0], mul.inputs[0])
    L.new(b.outputs[0], mul.inputs[1])
    hsv = N.new('ShaderNodeHueSaturation')
    L.new(at.outputs['Color'], hsv.inputs['Color'])
    L.new(mul.outputs[0], hsv.inputs['Value'])
    out_col = hsv.outputs['Color']
    if moss > 0:
        sep = N.new('ShaderNodeSeparateXYZ')
        L.new(geo.outputs['Normal'], sep.inputs[0])
        up = maprange(sep.outputs['Z'], 0.35, 0.9, 0.0, 1.0)
        n3 = noise(1.1, 4)
        pt = maprange(n3.outputs[0], 0.40, 0.60, 0.0, moss)
        mm = N.new('ShaderNodeMath')
        mm.operation = 'MULTIPLY'
        L.new(up.outputs[0], mm.inputs[0])
        L.new(pt.outputs[0], mm.inputs[1])
        mix = N.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        L.new(mm.outputs[0], mix.inputs[0])
        L.new(out_col, mix.inputs[6])
        mix.inputs[7].default_value = (*moss_col, 1)
        out_col = mix.outputs[2]
    if dirt > 0:            # grime where surfaces meet: corners, joints, the foot of a wall
        ao = N.new('ShaderNodeAmbientOcclusion')
        ao.samples = 6
        ao.inputs['Distance'].default_value = 0.45
        dk = maprange(ao.outputs['AO'], 0.35, 0.95, 1 - dirt, 1.0)
        dm = N.new('ShaderNodeMix')
        dm.data_type = 'RGBA'
        dm.blend_type = 'MULTIPLY'
        dm.inputs[0].default_value = 1.0
        L.new(out_col, dm.inputs[6])
        L.new(dk.outputs[0], dm.inputs[7])
        out_col = dm.outputs[2]
    L.new(out_col, bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Specular IOR Level'].default_value = spec
    if bump > 0:
        bp = N.new('ShaderNodeBump')
        bp.inputs['Strength'].default_value = bump
        bp.inputs['Distance'].default_value = 0.06
        nb = noise(gscale * 3.1, 5)          # fine pitting on top of the broad grain
        hb = N.new('ShaderNodeMath')
        hb.operation = 'ADD'
        L.new(n1.outputs[0], hb.inputs[0])
        L.new(nb.outputs[0], hb.inputs[1])
        L.new(hb.outputs[0], bp.inputs['Height'])
        L.new(bp.outputs[0], bs.inputs['Normal'])
    if emit > 0:
        L.new(at.outputs['Color'], bs.inputs['Emission Color'])
        bs.inputs['Emission Strength'].default_value = emit
    return m


def mk_emit(name, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    for n in list(N):
        if n.type != 'OUTPUT_MATERIAL':
            N.remove(n)
    out = next(n for n in N if n.type == 'OUTPUT_MATERIAL')
    at = N.new('ShaderNodeAttribute')
    at.attribute_name = 'col'
    em = N.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    L.new(at.outputs['Color'], em.inputs['Color'])
    L.new(em.outputs[0], out.inputs['Surface'])
    return m


def mk_glass(name, strength):
    """Stained glass: tints the light that passes through, and glows a little so it reads from the front."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    for n in list(N):
        if n.type != 'OUTPUT_MATERIAL':
            N.remove(n)
    out = next(n for n in N if n.type == 'OUTPUT_MATERIAL')
    at = N.new('ShaderNodeAttribute')
    at.attribute_name = 'col'
    tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    mx = N.new('ShaderNodeMixShader')
    mx.inputs[0].default_value = 0.45
    L.new(at.outputs['Color'], tr.inputs['Color'])
    L.new(at.outputs['Color'], em.inputs['Color'])
    L.new(tr.outputs[0], mx.inputs[1])
    L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    return m


def mk_water(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    bs = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value = (0.015, 0.02, 0.04, 1)
    bs.inputs['Roughness'].default_value = 0.06
    bs.inputs['Specular IOR Level'].default_value = 1.0
    geo = N.new('ShaderNodeNewGeometry')
    n = N.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 2.2
    n.inputs['Detail'].default_value = 2
    L.new(geo.outputs['Position'], n.inputs['Vector'])
    bp = N.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = 0.06
    bp.inputs['Distance'].default_value = 0.05
    L.new(n.outputs[0], bp.inputs['Height'])
    L.new(bp.outputs[0], bs.inputs['Normal'])
    return m


M_STONE = mk_mat('stone', rough=0.95, grain=0.16, gscale=9, stain=0.26, sscale=0.5, bump=0.6, moss=0.75, dirt=0.5)
M_SLAB = mk_mat('slab', rough=0.9, grain=0.13, gscale=9, stain=0.22, sscale=0.7, bump=0.45, moss=0.35, dirt=0.55)
M_GROUND = mk_mat('ground', rough=1.0, grain=0.22, gscale=6, stain=0.24, sscale=0.35, bump=0.6, dirt=0.35)
M_WOOD = mk_mat('wood', rough=0.85, grain=0.2, gscale=14, stain=0.15, bump=0.3)
M_LEAF = mk_mat('leaf', rough=0.8, grain=0.0, stain=0.12, sscale=0.8, bump=0.0)
M_ROOF = mk_mat('roof', rough=0.7, grain=0.2, gscale=5, stain=0.25, sscale=0.9, bump=0.5, moss=0.5, dirt=0.4)
M_METAL = mk_mat('metal', rough=0.45, grain=0.15, gscale=10, stain=0.2, bump=0.15, metallic=0.85, spec=0.5)
M_IRON = mk_mat('iron', rough=0.6, grain=0.1, stain=0.1, bump=0.0, metallic=0.6)
M_CLOTH = mk_mat('cloth', rough=1.0, grain=0.12, gscale=12, stain=0.2, bump=0.1)
M_FLAME = mk_emit('flame', 60.0)
M_LAMP = mk_emit('lampglass', 14.0)
M_FLOWER = mk_emit('flower', 0.9)
M_MOON = mk_emit('moonrefl', 3.0)
M_BELLGLOW = mk_mat('bell', rough=0.4, grain=0.15, gscale=6, stain=0.3, sscale=1.5, bump=0.2, metallic=0.8, spec=0.6, emit=0.12)
M_GLASS = mk_glass('glass', 1.6)
M_WATER = mk_water('water')

# builders: one mesh per material and kind
B = {
    'stone': MB('stone', M_STONE, 'solid'),
    'stone_r': MB('stone_round', M_STONE, 'solid', smooth=True),
    'floor': MB('floor', M_SLAB, 'floor'),
    'wood': MB('wood', M_WOOD, 'solid'),
    'trunk': MB('trunk', M_WOOD, 'solid', smooth=True),
    'twig': MB('twig', M_WOOD, 'soft', smooth=True),
    'leaf': MB('leaf', M_LEAF, 'soft'),
    'core': MB('core', M_LEAF, 'soft', smooth=True),
    'cover': MB('cover', M_LEAF, 'cover'),
    'pebble': MB('pebble', M_STONE, 'cover'),
    'roof': MB('roof', M_ROOF, 'solid'),
    'metal': MB('metal', M_METAL, 'solid', smooth=True),
    'bell': MB('bell', M_BELLGLOW, 'solid', smooth=True),
    'iron': MB('iron', M_IRON, 'solid'),
    'cloth': MB('cloth', M_CLOTH, 'solid'),
    'carpet': MB('carpet', M_CLOTH, 'floor'),
    'flame': MB('flame', M_FLAME, 'soft'),
    'lamp': MB('lampglass', M_LAMP, 'solid'),
    'flower': MB('flower', M_FLOWER, 'cover'),
    'glass': MB('glass', M_GLASS, 'solid'),
    'water': MB('water', M_WATER, 'solid'),
    'moon': MB('moonrefl', M_MOON, 'cover'),
    'moonk': MB('moonblack', mk_emit('black', 0.0), 'cover'),
}

# linear colours
STONE = np.array([0.36, 0.33, 0.32])
STONE_L = np.array([0.50, 0.46, 0.41])
STONE_D = np.array([0.22, 0.20, 0.22])
STONE_W = np.array([1.10, 0.98, 0.86])      # warm/cool drift between blocks
WOOD = np.array([0.10, 0.065, 0.05])
SLATE = np.array([0.085, 0.085, 0.115])
GRASS = [np.array([0.055, 0.09, 0.05]), np.array([0.08, 0.105, 0.045]), np.array([0.14, 0.125, 0.065])]
DIRT = np.array([0.15, 0.11, 0.08])
YEW = [(0.03, 0.07, 0.05), (0.045, 0.09, 0.055), (0.07, 0.10, 0.045), (0.10, 0.09, 0.04)]
AUTUMN = [(0.42, 0.07, 0.07), (0.55, 0.16, 0.05), (0.62, 0.30, 0.06), (0.30, 0.04, 0.08)]
IVY = [(0.03, 0.08, 0.03), (0.05, 0.10, 0.03), (0.30, 0.04, 0.05), (0.38, 0.09, 0.04)]

LIGHTS = []      # things that glow, for the game to animate
EXITS = []
SOLIDS_XY = []   # rough footprints, so scattered grass keeps off them


def lerp(a, b, t):
    return a + (b - a) * t


def vnoise(x, y, scale, seed=0.0):
    xs, ys = np.asarray(x) / scale, np.asarray(y) / scale
    xi, yi = np.floor(xs), np.floor(ys)
    fx, fy = xs - xi, ys - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    h = lambda a, b: hash01(a, b, seed)
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), fx), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), fx), fy)


def fbm(x, y, scale, seed=0.0):
    return 0.55 * vnoise(x, y, scale, seed) + 0.3 * vnoise(x, y, scale / 2.1, seed + 1) + 0.15 * vnoise(x, y, scale / 4.3, seed + 2)


# ---------------------------------------------------------------- layout constants
GATE_Y = 10.0
CH_X0, CH_X1, CH_Y0, CH_Y1 = -10.0, 10.0, 29.6, 57.0   # church walls (centre lines)
FL = 0.6                                               # church floor height
COLX = 4.2
COL_Y = [33.0, 37.0, 41.0, 45.0]
TW_X0, TW_X1, TW_Y0, TW_Y1 = -18.6, -10.6, 50.0, 58.0  # bell tower footprint
POOL = (-19.0, 40.0)
CLIFF_Y = 62.2

PATHS = [
    ([(0, 8.0), (0, 13), (0.4, 20), (0, 28.6)], 1.5),
    ([(0, 22), (-7, 23.6), (-14, 26.5), (-19, 31.5), (-19, 34.5)], 1.0),
    ([(0, 18), (8, 19), (15, 23.5), (19, 31), (19.5, 44), (18, 57.5)], 1.0),
    ([(-16, 36), (-13.5, 40), (-10.8, 40)], 0.9),
    ([(-19, 34.5), (-23.5, 37), (-24, 44.5), (-21, 48.6), (-14.6, 48.9)], 0.9),
]


def path_dist(x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    best = np.full(np.broadcast(x, y).shape, 1e9)
    for pts, w in PATHS:
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            dx, dy = bx - ax, by - ay
            t = np.clip(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
            d = np.hypot(x - (ax + t * dx), y - (ay + t * dy)) / w
            best = np.minimum(best, d)
    return best


def Hf(x, y):
    """Ground height."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    und = 0.10 * np.sin(x * 0.33 + 1.3) * np.cos(y * 0.25 + 0.4) + 0.05 * np.sin(x * 0.8 + y * 0.6)
    # keep the ground level where things are built or walked
    flat = np.clip(1.2 - path_dist(x, y), 0, 1)
    und = und * (1 - flat)
    s = np.clip(8.4 - y, 0, None)
    e = np.clip(np.abs(x) - 27.6, 0, None)
    h = und - 0.66 * s - 0.03 * s * s - 0.8 * e - 0.06 * e * e
    return h


# ---------------------------------------------------------------- terrain
def build_terrain():
    g = 0.25
    xs = np.arange(-31.5, 31.5 + 1e-6, g)
    ys = np.arange(-13.0, 63.0 + 1e-6, g)
    X, Y = np.meshgrid(xs, ys)
    Z = Hf(X, Y)
    V = np.stack([X, Y, Z], -1).reshape(-1, 3)
    ny, nx = X.shape
    # colour
    n1 = fbm(X, Y, 5.0, 1.0)
    n2 = fbm(X, Y, 1.6, 5.0)
    n3 = fbm(X, Y, 11.0, 9.0)
    c = lerp(GRASS[0], GRASS[1], np.clip((n1 - 0.3) * 2.2, 0, 1)[..., None])
    c = lerp(c, GRASS[2], np.clip((n3 - 0.55) * 4, 0, 1)[..., None] * 0.8)
    pd = path_dist(X, Y) + (n2 - 0.5) * 0.5
    pm = np.clip((1.05 - pd) * 3.0, 0, 1)[..., None]
    c = lerp(c, DIRT * (0.8 + 0.5 * n2[..., None]), pm)
    # bare earth close to the church and tower walls
    near = np.clip(1.0 - np.maximum(np.maximum(CH_X0 - 1.6 - X, X - CH_X1 - 1.6), np.maximum(CH_Y0 - 1.8 - Y, Y - CH_Y1 - 1.5)) * -1.0, 0, 1)
    slope = np.clip((8.4 - Y) * 0.25, 0, 1)[..., None]
    c = lerp(c, np.array([0.03, 0.045, 0.03]), slope * 0.7)
    edge = np.clip((np.abs(X) - 27.6) * 0.5, 0, 1)[..., None]
    c = lerp(c, np.array([0.03, 0.045, 0.03]), edge * 0.7)
    VC = c.reshape(-1, 3)
    # cells, cut along a ragged cliff to the north
    cliff = CLIFF_Y + 0.5 * np.sin(xs * 0.45) + 0.35 * np.sin(xs * 1.3 + 1.0)
    I, J = np.meshgrid(np.arange(nx - 1), np.arange(ny - 1))
    keep = (ys[J] + g / 2) < cliff[I]
    keep &= ~((np.abs(xs[I] + g / 2) < 2.4) & (ys[J] < 8.45))      # the stair cutting
    I, J = I[keep], J[keep]
    a = J * nx + I
    q = np.stack([a, a + 1, a + nx + 1, a + nx], 1)
    mb = MB('terrain', M_GROUND, 'floor', smooth=True)
    mb.add(V, quads=q, vcol=VC)


# ---------------------------------------------------------------- small props
def headstone(x, y, rng, big=1.0):
    z = float(Hf(x, y)) - 0.15
    w, d, h = rng.uniform(0.7, 0.95) * big, rng.uniform(0.2, 0.28), rng.uniform(1.0, 1.5) * big
    R = rotz(rng.uniform(-0.25, 0.25)) @ rotx(rng.uniform(-0.16, 0.12)) @ roty(rng.uniform(-0.14, 0.14))
    c = STONE * rng.uniform(0.7, 1.15) * np.array([1, rng.uniform(0.95, 1.05), rng.uniform(0.92, 1.08)])
    box(B['stone'], (x, y, z), (w, d, h), c, rot=R, pivot_bottom=True)
    top = np.array([0, 0, h]) @ R.T + (x, y, z)
    ax = np.array([0, d / 2, 0]) @ R.T
    kind = rng.integers(0, 3)
    if kind == 0:   # rounded head
        frustum(B['stone_r'], top - ax, top + ax, w / 2, w / 2, 10, c)
    elif kind == 1:  # pointed
        tip = np.array([0, 0, h + w * 0.55]) @ R.T + (x, y, z)
        l = np.array([-w / 2, 0, h]) @ R.T + (x, y, z)
        r = np.array([w / 2, 0, h]) @ R.T + (x, y, z)
        v = [l - ax, r - ax, tip - ax, l + ax, r + ax, tip + ax]
        B['stone'].add(v, quads=[[0, 2, 5, 3], [1, 4, 5, 2]], tris=[[0, 1, 2], [4, 3, 5]], col=c)
    SOLIDS_XY.append((x, y, 0.7))
    # a low mound in front
    if rng.random() < 0.6:
        blob(B['cover'], (x, y - 0.95, z + 0.12), (0.5, 0.85, 0.16), GRASS[1] * 0.9, sub=1, rough=0.1, rng=rng)


def cross(x, y, rng, h=2.3, ringed=True, plinth=1):
    z = float(Hf(x, y)) - 0.1
    R = rotz(rng.uniform(-0.18, 0.18)) @ rotx(rng.uniform(-0.1, 0.08)) @ roty(rng.uniform(-0.1, 0.1))
    c = STONE * rng.uniform(0.8, 1.15)
    zz = 0.0
    for k in range(plinth):
        s = 1.2 - 0.3 * k if plinth == 1 else 2.6 - 0.6 * k
        box(B['stone'], (x, y, z + zz), (s, s * 0.8, 0.3), c * 0.9, rot=R, pivot_bottom=True)
        zz += 0.3
    P = lambda v: np.asarray(v) @ R.T + (x, y, z)
    sw = 0.13 * h + 0.02
    box(B['stone'], P((0, 0, zz + h / 2)), (sw, sw * 0.8, h), c, rot=R)
    arm_z = zz + h * 0.74
    box(B['stone'], P((0, 0, arm_z)), (h * 0.5, sw * 0.75, sw * 0.95), c, rot=R)
    if ringed:
        r0, r1 = h * 0.135, h * 0.19
        t = sw * 0.3
        lathe(B['stone_r'], P((0, 0, arm_z)), [(r0, -t), (r1, -t), (r1, t), (r0, t), (r0, -t)], 14, c * 0.95, rot=R @ rotx(math.pi / 2))
    SOLIDS_XY.append((x, y, 0.9 if plinth == 1 else 1.6))


def table_tomb(x, y, rng):
    z = float(Hf(x, y)) - 0.1
    R = rotz(rng.uniform(-0.12, 0.12))
    c = STONE * rng.uniform(0.75, 1.05)
    box(B['stone'], (x, y, z), (1.2, 2.2, 0.75), c * 0.85, rot=R, pivot_bottom=True)
    box(B['stone'], (x, y, z + 0.75), (1.45, 2.45, 0.16), c * 1.1, rot=R @ rotx(rng.uniform(-0.03, 0.03)), pivot_bottom=True)
    SOLIDS_XY.append((x, y, 1.5))


def lantern(x, y, z, lit=True, power=70.0, hang=False, post=None, color=(1.0, 0.56, 0.22)):
    """Iron lantern with amber glass.  post=(height) stands it on a post, hang=True adds a chain above."""
    b = np.array([x, y, z])
    if post:
        zb = float(Hf(x, y))
        frustum(B['iron'], (x, y, zb - 0.2), (x, y, z - 0.25), 0.09, 0.06, 5, (0.03, 0.03, 0.035))
        box(B['iron'], (x, y, z - 0.25), (0.34, 0.34, 0.06), (0.03, 0.03, 0.035))
        SOLIDS_XY.append((x, y, 0.4))
    if hang:
        frustum(B['iron'], b + (0, 0, 0.3), b + (0, 0, hang), 0.03, 0.03, 4, (0.03, 0.03, 0.035))
    glass = np.array(color) if lit else np.array([0.02, 0.02, 0.025])
    box((B['lamp'] if lit else B['iron']), b, (0.3, 0.3, 0.42), glass)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(B['iron'], b + (sx * 0.16, sy * 0.16, 0), (0.05, 0.05, 0.5), (0.03, 0.03, 0.035))
    lathe(B['iron'], b + (0, 0, 0.22), [(0.26, 0.0), (0.05, 0.22)], 4, (0.03, 0.03, 0.035), rot=rotz(math.pi / 4))
    if lit:
        ld = bpy.data.lights.new('lantern', 'POINT')
        ld.energy = power
        ld.color = color
        ld.shadow_soft_size = 0.18
        lo = bpy.data.objects.new('lantern', ld)
        lo.location = (x, y - 0.05, z)
        col.objects.link(lo)
        LIGHTS.append({'kind': 'lantern', 'x': x, 'y': y, 'z': z, 'r': 5.5 * math.sqrt(power / 70.0), 'color': '#ffb060'})


def candle(x, y, z, h=0.4, light=None):
    frustum(B['cloth'], (x, y, z), (x, y, z + h), 0.055, 0.045, 5, (0.75, 0.68, 0.5))
    blob(B['flame'], (x, y, z + h + 0.1), (0.05, 0.05, 0.1), (1.0, 0.62, 0.22), sub=1, rough=0.0)
    if light:
        ld = bpy.data.lights.new('candle', 'POINT')
        ld.energy = light
        ld.color = (1.0, 0.6, 0.26)
        ld.shadow_soft_size = 0.1
        lo = bpy.data.objects.new('candle', ld)
        lo.location = (x, y, z + h + 0.25)
        col.objects.link(lo)
    LIGHTS.append({'kind': 'candle', 'x': x, 'y': y, 'z': z + h + 0.1, 'r': 1.6 if not light else 3.6 * math.sqrt(light / 30.0), 'color': '#ffc070'})


def column(x, y, z, h, broken=False, seed=0, r=0.46, cap=True):
    """A clustered pier: a round core with four slender shafts against it, on a moulded eight-sided base,
    under a capital carved with leaves."""
    rng = np.random.default_rng(abs(int(seed)) + 1000)
    c = STONE_L * rng.uniform(0.85, 1.0)
    lathe(B['stone'], (x, y, z), [(1.02, 0), (1.02, 0.2), (0.9, 0.3)], 8, c * 0.82, rot=rotz(math.pi / 8))
    lathe(B['stone_r'], (x, y, z + 0.3), [(0.8, 0), (0.82, 0.07), (0.7, 0.16), (0.73, 0.22), (r + 0.1, 0.34), (r + 0.02, 0.4)], 16, c)
    top = z + h
    zb = z + 0.7
    sh = r * 0.36
    offs = [(r * 0.98, 0), (-r * 0.98, 0), (0, r * 0.98), (0, -r * 0.98)]
    for (ox, oy) in offs:
        lathe(B['stone_r'], (x + ox, y + oy, z + 0.3), [(sh * 1.6, 0), (sh * 1.6, 0.1), (sh * 1.1, 0.42)], 8, c * 0.92)
    if broken:
        zz = zb
        while zz < top - 0.01:          # drums, the last one sheared
            dh = min(rng.uniform(0.7, 1.1), top - zz)
            frustum(B['stone_r'], (x, y, zz), (x, y, zz + dh), r, r, 14, c * rng.uniform(0.85, 1.08))
            zz += dh
        for (ox, oy) in offs:
            hh = rng.uniform(0.25, 1.0) * (top - zb)
            frustum(B['stone_r'], (x + ox, y + oy, zb), (x + ox, y + oy, zb + hh), sh, sh, 8, c * 0.92)
        tilt = rotx(rng.uniform(-0.35, 0.35)) @ roty(rng.uniform(-0.35, 0.35))
        lathe(B['stone_r'], (x, y, top - 0.02), [(r, 0), (r * 0.95, 0.12), (0.02, 0.2)], 10, c * 0.8, rot=tilt)
    else:
        frustum(B['stone_r'], (x, y, zb), (x, y, top - 0.9), r, r * 0.96, 16, c)
        for (ox, oy) in offs:
            frustum(B['stone_r'], (x + ox, y + oy, zb), (x + ox, y + oy, top - 0.9), sh, sh, 8, c * 0.95)
        for k in range(2):              # shaft rings
            zz = zb + (top - 0.9 - zb) * (k + 1) / 3
            lathe(B['stone_r'], (x, y, zz), [(r + sh * 1.5, 0), (r + sh * 1.85, 0.05), (r + sh * 1.5, 0.1)], 16, c * 0.8)
        if cap:
            lathe(B['stone_r'], (x, y, top - 0.9), [(r + 0.2, 0), (r + 0.27, 0.07), (r + 0.16, 0.14), (r + 0.24, 0.3), (0.9, 0.62)], 16, c * 1.05)
            for a in range(8):          # leaves curling out under the abacus
                ang = a * math.pi / 4 + math.pi / 8
                blob(B['stone_r'], (x + math.cos(ang) * 0.76, y + math.sin(ang) * 0.76, top - 0.44), (0.17, 0.17, 0.2), c * 1.1, sub=1, rough=0.1, rng=rng)
            lathe(B['stone'], (x, y, top - 0.28), [(1.02, 0), (1.08, 0.1), (1.08, 0.28)], 8, c * 1.05, rot=rotz(math.pi / 8))
    SOLIDS_XY.append((x, y, 1.0))


def rubble(cx, cy, z, n, spread, rng, big=0.6, kind='stone'):
    for k in range(n):
        a, d = rng.uniform(0, 6.283), abs(rng.normal(0, spread))
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.8
        s = rng.uniform(0.25, big) * (1.2 - min(1.0, d / (spread * 2.5)) * 0.6)
        R = rotz(rng.uniform(0, 3.14)) @ rotx(rng.uniform(-0.5, 0.5)) @ roty(rng.uniform(-0.5, 0.5))
        zz = z if z is not None else float(Hf(x, y))
        mb = B[kind] if s > 0.42 else B['pebble']
        box(mb, (x, y, zz + s * 0.25), (s * rng.uniform(1.0, 1.9), s * rng.uniform(0.8, 1.2), s * rng.uniform(0.6, 0.9)),
            STONE * rng.uniform(0.7, 1.15), rot=R)


def ivy(x0, x1, y_face, z0, z1, n, rng, side=-1, cols=IVY, patches=3, nrm_axis='y'):
    """Leaf cards hugging a wall face, in clumps."""
    for p in range(patches):
        cx, cz = rng.uniform(x0, x1), rng.uniform(z0, z0 + (z1 - z0) * 0.5)
        m = n // patches
        t = np.clip(rng.normal(cx, (x1 - x0) * 0.22, m), x0, x1)
        z = np.clip(cz + np.abs(rng.normal(0, (z1 - z0) * 0.45, m)) * rng.choice([1, 1, -0.4], m), z0, z1)
        off = y_face + side * rng.uniform(0.03, 0.14, m)
        pts = np.stack([t, off, z], 1) if nrm_axis == 'y' else np.stack([off, t, z], 1)
        cards(B['leaf'], pts, 0.15, cols, rng)


def stone_bench(x, y, rot=0.0):
    z = float(Hf(x, y))
    R = rotz(rot)
    for s in (-0.8, 0.8):
        p = np.array([s, 0, 0]) @ R.T + (x, y, z - 0.1)
        box(B['stone'], p, (0.3, 0.6, 0.55), STONE * 0.9, rot=R, pivot_bottom=True)
    box(B['stone'], (x, y, z + 0.45), (2.2, 0.7, 0.16), STONE_L * 0.9, rot=R, pivot_bottom=True)
    SOLIDS_XY.append((x, y, 1.3))


# ---------------------------------------------------------------- ornament: what makes masonry read as architecture
IRON = (0.03, 0.03, 0.035)


class Loc:
    """A little frame standing against a wall face: x runs along the wall, -y points out of it, z is up.
    theta 0 faces south (toward the camera), +90 degrees faces east, -90 west, 180 north."""
    def __init__(self, x, y, theta=0.0):
        self.o = np.array([x, y, 0.0], np.float32)
        self.R = rotz(theta)
        self.theta = theta

    def P(self, v):
        return np.asarray(v, np.float32) @ self.R.T + self.o

    def box(self, mb, x0, x1, y0, y1, z0, z1, col, slope=0.0):
        """slope lowers the top along the outer edge (y0), which makes a weathering."""
        v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1 - slope], [x1, y0, z1 - slope], [x1, y1, z1], [x0, y1, z1]]
        mb.add(self.P(v), quads=kit._BOXQ, col=col)

    def gable(self, mb, x0, x1, y0, y1, z0, h, col):
        """A little roof whose ridge runs in and out of the wall."""
        xm = (x0 + x1) / 2
        v = [[x0, y0, z0], [xm, y0, z0 + h], [x1, y0, z0], [x0, y1, z0], [xm, y1, z0 + h], [x1, y1, z0]]
        mb.add(self.P(v), quads=[[0, 1, 4, 3], [1, 2, 5, 4], [0, 3, 5, 2]], tris=[[0, 2, 1], [3, 4, 5]], col=col)


def courses(L, x0, x1, y0, y1, z0, z1, col, seed=0.0, h=0.78):
    """A pier laid in courses: each course a touch different in tone and size, with the dark of the joints between."""
    n = max(1, int(round((z1 - z0) / h)))
    for k in range(n):
        r = float(hash01(k * 1.0, seed, 3.3))
        j = 0.03 * (r - 0.5)
        L.box(B['stone'], x0 - j, x1 + j, y0 - j, y1, z0 + (z1 - z0) * k / n + 0.02, z0 + (z1 - z0) * (k + 1) / n, col * (0.86 + 0.26 * r))
    L.box(B['stone'], x0 + 0.04, x1 - 0.04, y0 + 0.04, y1, z0, z1, col * 0.62)


def pinnacle(x, y, z, s=0.8, h=2.6, col=None, theta=0.0):
    """Square shaft, a gablet on each face, a spire with crockets up its edges and a knob on top."""
    col = STONE_L * 0.9 if col is None else col
    L = Loc(x, y, theta)
    hs = h * 0.36
    courses(L, -s / 2, s / 2, -s / 2, s / 2, z, z + hs, col * 0.92, seed=x + y, h=0.45)
    L.box(B['stone'], -s / 2 - 0.07, s / 2 + 0.07, -s / 2 - 0.07, s / 2 + 0.07, z + hs, z + hs + 0.1, col)
    zs = z + hs + 0.1
    for a in range(4):
        Loc(x, y, theta + a * math.pi / 2).gable(B['stone'], -s / 2, s / 2, -s / 2 - 0.06, 0.0, zs, s * 0.62, col * 1.05)
    lathe(B['stone'], (x, y, zs), [(s * 0.6, 0), (0.05, h - hs - 0.1)], 4, col, rot=rotz(theta + math.pi / 4))
    for k in range(1, 4):
        f = k / 4.3
        rr = s * 0.6 * (1 - f) + 0.03
        for a in range(4):
            ang = theta + math.pi / 4 + a * math.pi / 2
            box(B['stone'], (x + math.cos(ang) * rr, y + math.sin(ang) * rr, zs + (h - hs - 0.1) * f), (0.13, 0.13, 0.13), col * 1.08, rot=rotz(ang))
    blob(B['stone_r'], (x, y, z + h + 0.06), (0.11, 0.11, 0.13), col * 1.05, sub=1, rough=0.0)


def buttress(L, w, stages, col=None, z0=-0.4, seed=0.0):
    """A stepped buttress: each stage (depth, top) ends in a drip course and a sloped weathering."""
    col = STONE * 0.93 if col is None else col
    zb = z0
    for i, (d, zt) in enumerate(stages):
        dn = stages[i + 1][0] if i + 1 < len(stages) else 0.0
        courses(L, -w / 2, w / 2, -d, 0.1, zb, zt - 0.4, col, seed=seed + i)
        L.box(B['stone'], -w / 2 - 0.07, w / 2 + 0.07, -d - 0.08, 0.1, zt - 0.4, zt - 0.27, STONE_L * 0.85)
        L.box(B['stone'], -w / 2, w / 2, -d, (-dn + 0.02) if dn else 0.1, zt - 0.27, zt + 0.35, STONE_L * 0.9, slope=0.6)
        zb = zt - 0.27


def shaft(x, y, z0, z1, r=0.11, col=None, n=8):
    """A slender column with a moulded base and a bell capital."""
    col = STONE_L * 0.95 if col is None else col
    lathe(B['stone_r'], (x, y, z0), [(r * 1.9, 0), (r * 1.9, 0.08), (r * 1.25, 0.2)], n, col * 0.9)
    frustum(B['stone_r'], (x, y, z0 + 0.2), (x, y, z1 - 0.34), r, r * 0.95, n, col)
    lathe(B['stone_r'], (x, y, z1 - 0.34), [(r, 0), (r * 1.3, 0.05), (r * 1.1, 0.1), (r * 2.0, 0.27), (r * 2.0, 0.34)], n, col * 1.05)


def statue(x, y, z, h=1.7, theta=0.0, col=None):
    """A hooded figure in a long robe, hands folded."""
    col = STONE_L * 0.82 if col is None else col
    k = h / 1.42
    prof = [(0.27, 0), (0.25, 0.06), (0.19, 0.5), (0.2, 0.9), (0.22, 1.0), (0.12, 1.1), (0.13, 1.16), (0.15, 1.28), (0.11, 1.38), (0.02, 1.42)]
    lathe(B['stone_r'], (x, y, z), [(r * k, zz * k) for r, zz in prof], 10, col, rot=rotz(theta), scale=(1, 0.72, 1))
    Loc(x, y, theta).box(B['stone'], -0.08 * k, 0.08 * k, -0.2 * k, -0.08 * k, z + 0.76 * k, z + 0.9 * k, col * 0.95)


def niche_statue(L, z, h=1.8):
    """A figure on a corbel under a small canopy."""
    L.box(B['stone'], -0.42, 0.42, -0.46, 0.05, z - 0.3, z - 0.1, STONE_L * 0.85)
    L.box(B['stone'], -0.28, 0.28, -0.32, 0.05, z - 0.55, z - 0.3, STONE_L * 0.75)
    L.box(B['stone'], -0.16, 0.16, -0.2, 0.05, z - 0.75, z - 0.55, STONE_L * 0.7)
    p = L.P([0, -0.22, 0])
    statue(float(p[0]), float(p[1]), z - 0.1, h, L.theta)
    L.box(B['stone'], -0.48, 0.48, -0.52, 0.05, z + h, z + h + 0.1, STONE_L * 0.8)
    L.gable(B['stone'], -0.48, 0.48, -0.52, 0.05, z + h + 0.1, 0.55, STONE_L * 0.9)


def finial_cross(x, y, z, h=1.1, theta=0.0, col=None):
    col = STONE_L * 0.9 if col is None else col
    L = Loc(x, y, theta)
    L.box(B['stone'], -0.3, 0.3, -0.3, 0.3, z, z + 0.28, col * 0.9, slope=0.0)
    L.box(B['stone'], -0.09, 0.09, -0.08, 0.08, z + 0.28, z + 0.28 + h, col)
    L.box(B['stone'], -0.34 * h, 0.34 * h, -0.07, 0.07, z + 0.28 + h * 0.6, z + 0.28 + h * 0.76, col)


def urn(x, y, z, k=1.0, col=None):
    col = STONE_L * 0.85 if col is None else col
    prof = [(0.12, 0), (0.2, 0.08), (0.1, 0.16), (0.24, 0.4), (0.2, 0.52), (0.12, 0.56), (0.17, 0.62), (0.02, 0.7)]
    lathe(B['stone_r'], (x, y, z), [(r * k, zz * k) for r, zz in prof], 8, col)


def drum_tower(x, y, z0, z1, r, col, n=8):
    """A many-sided turret with its courses marked."""
    lathe(B['stone'], (x, y, z0), [(r, 0), (r, z1 - z0)], n, col, rot=rotz(math.pi / n))
    zz = z0 + 0.7
    while zz < z1 - 0.2:
        lathe(B['stone'], (x, y, zz), [(r + 0.012, 0), (r + 0.012, 0.035)], n, col * 0.5, rot=rotz(math.pi / n), caps=False)
        zz += 0.7


def iron_bars(p0, p1, z, h, step=0.24, spear=True):
    """Railings: upright bars with spear heads between two rails."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    Lg = float(np.hypot(d[0], d[1]))
    ang = math.atan2(d[1], d[0])
    n = max(2, int(Lg / step))
    for k in range(n + 1):
        q = p0 + d * k / n
        hh = h + (0.14 if k % 2 == 0 else 0.0)
        frustum(B['iron'], (q[0], q[1], z), (q[0], q[1], z + hh), 0.03, 0.03, 4, IRON, cap0=False)
        if spear:
            lathe(B['iron'], (q[0], q[1], z + hh), [(0.065, 0), (0.005, 0.17)], 4, IRON)
    m = (p0 + p1) / 2
    for zz in (z + 0.2, z + h - 0.22):
        box(B['iron'], (m[0], m[1], zz), (Lg, 0.05, 0.07), IRON, rot=rotz(ang))


def orders(p0, p1, tc, w, z_sill, z_spring, wall_t, seed, k=1.0, zmax=None, z0=-0.4, extra=None, floor_z=None, hood=True):
    """Dress an arched opening of width w in a wall of thickness wall_t: a hood mould standing proud above it, then two
    orders stepping back into the wall, the inner one shy of the wall face, and a slender shaft in each jamb.
    The clear opening that is left is w - 0.8."""
    zmax = zmax or (z_spring + w * k + 1.4)
    ok = extra or (lambda T, Z, tcc, zc, r: True)
    def ring(wo, wi, more=None):
        def f(T, Z, tcc, zc, r):
            m = lancet(T, Z, tc, wo, z_sill, z_spring, k) & ~lancet(T, Z, tc, wi, z_sill, z_spring, k) & ok(T, Z, tcc, zc, r)
            return m & more(T, Z) if more else m
        return f
    if hood:
        wall(B['stone'], p0, p1, wall_t + 0.5, ring(w + 0.78, w + 0.3, lambda T, Z: Z > z_spring - 0.25), zmax + 0.8, STONE_L * 0.95,
             z0=z0, seed=seed, block=(0.7, 0.7), var=0.08, chip=0.04, relief=0.0, groove=0.03)
    wall(B['stone'], p0, p1, wall_t + 0.28, ring(w + 0.02, w - 0.42), zmax, STONE_L, z0=z0, seed=seed + 1, block=(0.62, 0.62), var=0.1,
         chip=0.05, relief=0.02, groove=0.035)
    wall(B['stone'], p0, p1, max(0.3, wall_t - 0.3), ring(w - 0.42, w - 0.8), zmax, STONE_L * 0.86, z0=z0, seed=seed + 2, block=(0.62, 0.62),
         var=0.1, chip=0.04, relief=0.02, groove=0.035)
    if floor_z is not None:
        p0a, p1a = np.array(p0, float), np.array(p1, float)
        d = (p1a - p0a) / np.hypot(*(p1a - p0a))
        nr = np.array([d[1], -d[0]])
        for sg in (-1, 1):
            q = p0a + d * (tc + sg * (w / 2 - 0.2)) + nr * (wall_t / 2 + 0.2)
            shaft(float(q[0]), float(q[1]), floor_z, z_spring + 0.05, r=0.1)


# ---------------------------------------------------------------- the place itself
def build_stairs_and_gate():
    st = B['floor']
    n = 24
    for k in range(n):
        y1 = 8.5 - k * 0.5
        zt = -0.25 * (k + 1)
        tone = STONE * (0.95 + 0.12 * math.sin(k * 2.3)) * (1.0 if k % 2 else 0.93)
        box2(st, -1.75, 1.75, y1 - 0.5, y1, zt - 6.5, zt, tone)
    box2(st, -1.75, 1.75, -12.0, 8.5 - n * 0.5, -0.25 * n - 6.75, -0.25 * (n + 1), STONE * 0.9)
    box2(st, -2.6, 2.6, 8.5, 9.3, -3.0, 0.02, STONE * 0.95)     # top landing
    # stepped parapets with cap stones
    for sx in (-1, 1):
        for k in range(0, n, 3):
            y1 = 8.5 - k * 0.5
            zt = -0.25 * (k + 1)
            box2(B['stone'], sx * 2.05 - 0.32, sx * 2.05 + 0.32, y1 - 1.5, y1, zt - 7.0, zt + 0.85, STONE * (0.9 + 0.1 * math.sin(k)))
            box2(B['stone'], sx * 2.05 - 0.4, sx * 2.05 + 0.4, y1 - 1.5, y1, zt + 0.85, zt + 1.0, STONE_L * 0.9)
        box2(B['stone'], sx * 2.05 - 0.55, sx * 2.05 + 0.55, 8.5, 9.35, -2.0, 1.5, STONE_L * 0.85)   # newel
        lathe(B['stone'], (sx * 2.05, 8.92, 1.5), [(0.82, 0), (0.05, 0.55)], 4, STONE_L * 0.9, rot=rotz(math.pi / 4))

    # boundary wall with the gate arch
    for a, b_, sd in ((-27.4, -3.0, 1.7), (3.0, 27.4, 4.2)):
        prof = ruin_profile(sd, -0.9, 2.9, scale=3.5, rough=0.8)
        wall(B['stone'], (a, GATE_Y), (b_, GATE_Y), 0.9, lambda T, Z, tc, zc, r, p=prof: zc + 0.35 < p(tc) + r * 0.5, 3.6, STONE,
             z0=-0.4, seed=sd, tint2=STONE_W)
    gate_w = 6.4
    def gate_mask(T, Z, tc, zc, r):
        u = T - gate_w / 2
        ub = tc - gate_w / 2
        gable = 7.3 - 0.62 * np.abs(ub) - np.where(ub > 0.6, (ub - 0.6) * 0.55 + r * 1.3, r * 0.3)
        return (zc + 0.35 < gable) & ~lancet(T, Z, gate_w / 2, 3.9, -1, 2.9)
    def gate_trim(T, Z):
        return lancet(T, Z, gate_w / 2, 3.9, -1, 2.9) & ~lancet(T, Z, gate_w / 2, 3.3, -1, 2.9)
    wall(B['stone'], (-gate_w / 2, GATE_Y), (gate_w / 2, GATE_Y), 1.3, gate_mask, 7.6, STONE * 1.02, z0=-0.4, seed=8.8, tint2=STONE_W)
    orders((-gate_w / 2, GATE_Y), (gate_w / 2, GATE_Y), gate_w / 2, 3.9, -1, 2.9, 1.3, 2.1, zmax=6.9, floor_z=0.0)
    for sx in (-1, 1):   # buttresses in front of the piers, and the iron leaves of the gate standing open
        buttress(Loc(sx * 2.9, GATE_Y - 0.65), 0.9, [(0.6, 2.9), (0.35, 4.3)] if sx < 0 else [(0.6, 2.7)], seed=sx)
        iron_bars((sx * 1.55, GATE_Y + 0.75), (sx * 1.7, GATE_Y + 2.2), 0.0, 2.3)
    finial_cross(-0.2, GATE_Y, 6.75, h=1.0)
    for a, b_, sd in ((-27.4, -3.0, 1.7), (3.0, 27.4, 4.2)):    # piers along the boundary wall
        prof = ruin_profile(sd, -0.9, 2.9, scale=3.5, rough=0.8)
        t = 2.6
        while t < b_ - a - 1.5:
            ht = float(prof(np.array(t)))
            if ht > 0.9 and abs(a + t) > 4.5:
                buttress(Loc(a + t, GATE_Y - 0.45), 0.9, [(0.38, min(ht, 2.5) + 0.25)], seed=t)
            t += 5.4
    lantern(0.0, GATE_Y - 0.35, 4.35, lit=True, power=90, hang=1.35)
    SOLIDS_XY.extend([(-2.5, GATE_Y, 1.4), (2.5, GATE_Y, 1.4)])
    ivy(-3.1, -1.8, GATE_Y - 0.67, 0.2, 5.5, 260, RNG)
    ivy(4.5, 9.5, GATE_Y - 0.47, 0.0, 2.2, 240, RNG)
    ivy(-16, -9, GATE_Y - 0.47, 0.0, 2.0, 260, RNG)


def build_path_slabs():
    rng = np.random.default_rng(5)
    pts, w = PATHS[0]
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        L = math.hypot(bx - ax, by - ay)
        nseg = int(L / 0.85)
        for k in range(nseg):
            t = (k + 0.5) / nseg
            cx, cy = ax + (bx - ax) * t, ay + (by - ay) * t
            for j in range(3):
                if rng.random() < 0.13:
                    continue
                x = cx + (j - 1) * 0.95 + rng.uniform(-0.08, 0.08)
                y = cy + rng.uniform(-0.1, 0.1) + (0.4 if j == 1 else 0)
                if y > 28.2 or y < 9.4:
                    continue
                s = (rng.uniform(0.75, 0.95), rng.uniform(0.62, 0.82), 0.1)
                box(B['floor'], (x, y, float(Hf(x, y)) - 0.03), s, STONE * rng.uniform(0.8, 1.15) * STONE_W ** rng.uniform(-1, 1),
                    rot=rotz(rng.uniform(-0.12, 0.12)), pivot_bottom=True)


def build_graveyard():
    rng = np.random.default_rng(21)
    reserved = [(-17.5, 18.5, 2.6), (22.5, 23.5, 1.8), (19.0, 16.5, 4.3), (19.0, 38.0, 2.6), (-22.5, 14.5, 2.2), (23.5, 13.5, 2.2)]
    def ok(x, y):
        if path_dist(x, y) < 1.9:
            return False
        return all(math.hypot(x - a, y - b) > r for a, b, r in reserved)
    for row, y in enumerate([13.3, 16.4, 19.5, 22.6, 25.6]):
        x = -24.5 + rng.uniform(0, 1)
        while x < 24.8:
            xx, yy = x + rng.uniform(-0.3, 0.3), y + rng.uniform(-0.45, 0.45)
            if ok(xx, yy) and rng.random() < 0.8:
                k = rng.random()
                if k < 0.62:
                    headstone(xx, yy, rng)
                elif k < 0.84:
                    cross(xx, yy, rng, h=rng.uniform(1.7, 2.4), ringed=rng.random() < 0.7)
                else:
                    table_tomb(xx, yy, rng)
            x += rng.uniform(2.3, 3.4)
    # the monks' plot east of the church: small plain crosses in rows
    for y in (33.0, 36.0, 42.0, 45.5, 49.0, 52.5):
        for x in (13.2, 15.8, 22.2, 24.6):
            if ok(x, y) and rng.random() < 0.85:
                if rng.random() < 0.7:
                    cross(x + rng.uniform(-0.2, 0.2), y + rng.uniform(-0.3, 0.3), rng, h=rng.uniform(1.3, 1.7), ringed=False)
                else:
                    headstone(x, y, rng, big=0.85)
    cross(19.0, 38.0, rng, h=4.6, ringed=True, plinth=3)       # the high cross
    candle(4.55, 16.05, float(Hf(4.55, 16.05)) + 0.02, h=0.3, light=9)
    candle(4.8, 16.2, float(Hf(4.8, 16.2)) + 0.02, h=0.22)

    # mausoleum, south-east
    mx0, mx1, my0, my1 = 16.2, 21.8, 14.4, 18.8
    mw = mx1 - mx0
    def front(T, Z, tc, zc, r):
        u = T - mw / 2
        return (Z < 3.1 + (mw / 2 - np.abs(u)) * 0.62) & ~lancet(T, Z, mw / 2, 1.9, -1, 1.7)
    wall(B['stone'], (mx0, my0), (mx1, my0), 0.6, front, 5.0, STONE * 0.95, z0=-0.3, seed=3.3, tint2=STONE_W)
    wall(B['stone'], (mx0, my0), (mx1, my0), 0.8, lambda T, Z, tc, zc, r: lancet(T, Z, mw / 2, 1.9, -1, 1.7) & ~lancet(T, Z, mw / 2, 1.4, -1, 1.7),
         4.0, STONE_L, z0=-0.3, seed=1.0, block=(0.62, 0.62), var=0.1, chip=0.05, relief=0.02, groove=0.035)
    box2(B['stone'], mx0, mx0 + 0.6, my0, my1, -0.3, 3.1, STONE * 0.9)
    box2(B['stone'], mx1 - 0.6, mx1, my0, my1, -0.3, 3.1, STONE * 0.9)
    box2(B['stone'], mx0, mx1, my1 - 0.6, my1, -0.3, 3.1, STONE * 0.9)
    box2(B['iron'], mx0 + 0.6, mx1 - 0.6, my0 + 0.5, my1 - 0.6, -0.2, 0.05, (0.01, 0.01, 0.015))
    xm = (mx0 + mx1) / 2
    v = []
    for y in (my0 - 0.35, my1 + 0.2):
        v += [(mx0 - 0.35, y, 3.0), (xm, y, 3.0 + (mw / 2 + 0.35) * 0.62), (mx1 + 0.35, y, 3.0)]
    B['roof'].add(v, quads=[[0, 1, 4, 3], [1, 2, 5, 4], [0, 3, 5, 2]], tris=[[0, 2, 1], [3, 4, 5]], col=SLATE * 1.1)
    box2(B['floor'], xm - 1.3, xm + 1.3, my0 - 0.9, my0 - 0.3, -0.3, 0.14, STONE * 0.9)
    box2(B['floor'], xm - 1.75, xm + 1.75, my0 - 1.35, my0 - 0.9, -0.3, 0.02, STONE * 0.85)
    ML = Loc(xm, my0 - 0.3)
    for sx in (-1, 1):                  # corner pilasters with caps, urns above them
        courses(ML, sx * (mw / 2 - 0.3) - 0.32, sx * (mw / 2 - 0.3) + 0.32, -0.16, 0.05, -0.3, 2.85, STONE_L * 0.85, seed=sx + 5.0)
        ML.box(B['stone'], sx * (mw / 2 - 0.3) - 0.4, sx * (mw / 2 - 0.3) + 0.4, -0.24, 0.05, 2.85, 3.02, STONE_L * 0.95)
        urn(xm + sx * (mw / 2 + 0.05), my0 - 0.2, 3.3, k=1.1)
    ML.box(B['stone'], -mw / 2 - 0.3, mw / 2 + 0.3, -0.34, 0.05, 3.02, 3.14, STONE_L * 0.9)          # cornice
    ML.box(B['stone'], -mw / 2 - 0.22, mw / 2 + 0.22, -0.26, 0.05, 3.14, 3.26, STONE_L * 0.8)
    ML.box(B['stone'], -mw / 2 - 0.12, mw / 2 + 0.12, -0.2, 0.05, -0.3, 0.42, STONE_L * 0.75, slope=0.12)   # plinth
    q0, q1 = ML.P([0, -0.09, 4.0]), ML.P([0, 0.05, 4.0])                    # round window in the gable
    frustum(B['stone_r'], q0 + (0, 0.03, 0), q1, 0.52, 0.52, 12, STONE_L * 0.95)
    frustum(B['iron'], q0, q1, 0.36, 0.36, 12, (0.01, 0.01, 0.015))
    finial_cross(xm, my0 - 0.2, 3.0 + (mw / 2 + 0.35) * 0.62 - 0.12, h=0.9)
    iron_bars((xm - 0.68, my0 - 0.28), (xm - 0.4, my0 - 0.95), 0.14, 2.0, step=0.17)        # one leaf ajar
    iron_bars((xm + 0.02, my0 - 0.26), (xm + 0.68, my0 - 0.26), 0.14, 2.0, step=0.17)
    SOLIDS_XY.append((xm, (my0 + my1) / 2, 4.0))
    ivy(mx0, mx0 + 1.8, my0 - 0.33, 0.0, 3.4, 200, RNG)

    # trees
    tree(B['trunk'], None, (-17.5, 18.5, float(Hf(-17.5, 18.5))), 9.5, 4, trunk_r=0.5, depth=5, spread=0.8, lean=(0.12, -0.05), gnarl=0.3)
    tree(B['trunk'], None, (22.5, 23.5, float(Hf(22.5, 23.5))), 6.5, 9, trunk_r=0.34, depth=4, spread=0.85, lean=(-0.15, 0.0), gnarl=0.34)
    SOLIDS_XY.extend([(-17.5, 18.5, 1.0), (22.5, 23.5, 0.8)])
    for (x, y, h, r, sd) in [(-22.8, 14.2, 7.5, 2.1, 1), (23.6, 13.6, 6.8, 1.9, 2), (-24.6, 25.5, 6.0, 1.7, 3), (25.0, 47.5, 7.2, 2.0, 4)]:
        conifer(B['trunk'], B['leaf'], B['core'], (x, y, float(Hf(x, y))), h, r, sd, YEW)
        SOLIDS_XY.append((x, y, 1.0))
        box(B['stone'], (x, y, float(Hf(x, y)) - 0.5), (0.5, 0.5, 1.6), WOOD, pivot_bottom=True)   # so the trunk blocks walking


def build_church():
    st, fl = B['stone'], B['floor']
    rng = np.random.default_rng(31)
    # plinth and floor
    box2(fl, CH_X0 - 0.75, CH_X1 + 0.75, CH_Y0 - 0.6, CH_Y1 + 0.9, -1.2, FL, STONE_D * 0.9 + np.array([0.02, 0.03, 0.0]))
    box2(fl, -2.6, 2.6, CH_Y0 - 1.3, CH_Y0 - 0.6, -0.5, 0.3, STONE * 0.95)        # door step
    box2(fl, CH_X0 - 1.5, CH_X0 - 0.75, 38.3, 41.7, -0.5, 0.3, STONE * 0.9)       # step from the cloister
    # small pavers: two-tone in the aisle, plain and worn in the side aisles, lost in patches along the walls
    ts = 0.75
    for j in range(26):
        for i in range(26):
            x = -9.75 + (i + 0.5) * ts
            y = 30.2 + (j + 0.5) * ts
            if y > 49.4:
                continue
            patch = 0.6 * hash01(i // 3 * 1.0, j // 3 * 1.0, 4.4) + 0.4 * hash01(i * 1.0, j * 1.0, 5.1)
            edge = (abs(x) > 7.2 or y < 31.8)
            if patch < (0.36 if edge else 0.17):
                continue
            aisle = abs(x) < 3.0
            tone = hash01(i * 1.0, j * 1.0, 7.7)
            worn = hash01(i // 4 * 1.0, j // 4 * 1.0, 8.8)
            if aisle:
                c = (STONE_L * 0.95 if (i + j) % 2 else np.array([0.34, 0.25, 0.26])) * (0.9 + 0.16 * tone) * (0.9 + 0.16 * worn)
            else:
                c = STONE * (0.9 + 0.16 * tone) * (0.86 + 0.24 * worn) * STONE_W ** (tone * 1.2 - 0.6)
            sink = 0.02 * hash01(i * 1.0, j * 1.0, 6.3)
            box(fl, (x, y, FL - sink), (ts - 0.05, ts - 0.05, 0.07), c, rot=rotz((tone - 0.5) * 0.05), pivot_bottom=True)
    # faded runner up the aisle
    for k in range(38):
        y = 30.4 + k * 0.48
        r = hash01(k * 1.0, 3.0, 1.0)
        if r < 0.16 or (22 < k < 26):
            continue
        wv = 0.78 - 0.12 * hash01(k * 1.0, 9.0, 2.0)
        box2(B['carpet'], -wv, wv - 0.1 * hash01(k * 1.0, 1.0, 5.0), y, y + 0.5, FL + 0.07, FL + 0.095, np.array([0.20, 0.035, 0.05]) * (0.7 + 0.5 * r))
        for sx in (-1, 1):
            box2(B['carpet'], sx * wv - 0.06, sx * wv + 0.06, y, y + 0.5, FL + 0.07, FL + 0.1, np.array([0.42, 0.27, 0.09]) * (0.7 + 0.4 * r))

    # chancel
    DZ = FL + 0.6
    box2(fl, -6.4, 6.4, 49.6, CH_Y1 - 0.6, 0.0, DZ, STONE * 0.92)
    box2(fl, -3.2, 3.2, 48.95, 49.6, 0.0, FL + 0.3, STONE_L * 0.9)
    for j in range(7):
        for i in range(12):
            x, y = -5.9 + (i + 0.5) * 0.98, 49.75 + (j + 0.5) * 0.98
            tone = hash01(i * 1.0, j * 1.0, 2.2)
            c = (STONE_L if (i + j) % 2 else STONE_D * 1.15 + np.array([0.03, 0.0, 0.02])) * (0.9 + 0.2 * tone)
            box(fl, (x, y, DZ), (0.94, 0.94, 0.05), c, pivot_bottom=True)
    AZ = DZ + 0.3
    box2(fl, -2.9, 2.9, 52.6, 55.4, DZ, AZ, STONE_L * 0.95)
    box2(st, -1.8, 1.8, 53.3, 54.5, AZ, AZ + 1.05, STONE_L * 0.9)
    box2(st, -2.05, 2.05, 53.15, 54.65, AZ + 1.05, AZ + 1.22, STONE_L * 1.05)
    box2(B['cloth'], -1.15, 1.15, 53.08, 53.16, AZ + 0.35, AZ + 1.26, np.array([0.30, 0.05, 0.07]))
    box2(B['cloth'], -1.15, 1.15, 53.1, 54.7, AZ + 1.22, AZ + 1.26, np.array([0.34, 0.06, 0.08]))
    for k, x in enumerate((-1.55, -0.8, 0.8, 1.55)):
        candle(x, 53.9, AZ + 1.26, h=0.35 + 0.18 * hash01(k, 1.0, 3.0), light=(16 if k in (1, 2) else None))
    for sx in (-1, 1):   # standing candelabra
        x, y = sx * 3.9, 52.4
        frustum(B['iron'], (x, y, DZ), (x, y, DZ + 2.1), 0.07, 0.05, 5, (0.03, 0.03, 0.035))
        lathe(B['iron'], (x, y, DZ), [(0.35, 0), (0.1, 0.18)], 6, (0.03, 0.03, 0.035))
        box(B['iron'], (x, y, DZ + 2.1), (0.9, 0.08, 0.06), (0.03, 0.03, 0.035))
        for k, dx in enumerate((-0.4, 0, 0.4)):
            candle(x + dx, y, DZ + 2.13 + (0.1 if dx == 0 else 0), h=0.28, light=(22 if dx == 0 else None))
        SOLIDS_XY.append((x, y, 0.6))

    # north wall with the great window
    Lw = CH_X1 - CH_X0
    c0 = Lw / 2
    def great(T, Z):
        outer = lancet(T, Z, c0, 5.0, 3.4, 8.3)
        subs = lancet(T, Z, c0 - 1.62, 1.28, 3.4, 6.9) | lancet(T, Z, c0, 1.28, 3.4, 7.7) | lancet(T, Z, c0 + 1.62, 1.28, 3.4, 6.9)
        ocu = ((T - c0) ** 2 + (Z - 10.35) ** 2 < 0.95 ** 2) | ((T - c0 + 1.45) ** 2 + (Z - 8.95) ** 2 < 0.52 ** 2) | ((T - c0 - 1.45) ** 2 + (Z - 8.95) ** 2 < 0.52 ** 2)
        return outer & (subs | ocu)
    def sidew(T, Z):
        return lancet(T, Z, c0 - 6.7, 1.3, 3.8, 6.6) | lancet(T, Z, c0 + 6.7, 1.3, 3.8, 6.6)
    def north(T, Z, tc, zc, r):
        ub = tc - c0
        gable = 14.6 - 0.60 * np.abs(ub)
        gable = gable - np.where(ub > 3.2, (ub - 3.2) * 0.75 + r * 1.6, 0) - np.where(ub < -7.5, r * 1.0, 0)
        whole = (ub <= 3.2) & (ub >= -7.5)          # where the gable still stands it is cut to a clean rake under its coping
        return np.where(whole, Z < 14.55 - 0.60 * np.abs(T - c0), zc + 0.35 < gable) & ~ntrim_all(T, Z)
    def ntrim_all(T, Z):
        return lancet(T, Z, c0, 5.8, 2.95, 8.3) | lancet(T, Z, c0 - 6.7, 1.9, 3.45, 6.6) | lancet(T, Z, c0 + 6.7, 1.9, 3.45, 6.6)
    wall(st, (CH_X0, CH_Y1), (CH_X1, CH_Y1), 1.3, north, 15.0, STONE, z0=FL - 0.1, seed=5.5, tint2=STONE_W)
    wall(st, (CH_X0, CH_Y1), (CH_X1, CH_Y1), 1.6, lambda T, Z, tc, zc, r: ntrim_all(T, Z) & ~great(T, Z) & ~sidew(T, Z),
         14.0, STONE_L, z0=FL - 0.1, seed=6.1, block=(0.62, 0.62), var=0.1, chip=0.05, relief=0.02, groove=0.035)
    wall(st, (CH_X0, CH_Y1), (CH_X1, CH_Y1), 2.1,                      # hood mould over the great window
         lambda T, Z, tc, zc, r: lancet(T, Z, c0, 6.65, 2.95, 8.3) & ~lancet(T, Z, c0, 6.15, 2.95, 8.3) & (Z > 8.0) & (tc - c0 < 3.4),
         14.4, STONE_L * 0.95, z0=FL - 0.1, seed=6.6, block=(0.7, 0.7), var=0.08, chip=0.04, relief=0.0, groove=0.03)
    def blind(T, Z, tc, zc, r):                                        # blind arcade behind the altar
        pan = np.zeros_like(T, bool)
        for i in range(-7, 7):
            pan |= lancet(T, Z, c0 + (i + 0.5) * 1.22, 0.82, 1.62, 2.1)
        return (Z > 1.42) & (Z < 2.92) & (np.abs(T - c0) < 8.7) & ~pan
    wall(st, (CH_X0, CH_Y1), (CH_X1, CH_Y1), 1.62, blind, 3.0, STONE_L * 0.9, z0=1.3, seed=6.9, block=(0.6, 0.5), var=0.08, chip=0.0)
    rk = math.atan(0.60)
    u = -7.2
    while u < 3.1:                                                      # coping stones up the rake, a saddle stone and a cross on top
        if abs(u) > 0.45:
            box(st, (u, CH_Y1, 14.58 - 0.60 * abs(u)), (1.07, 1.56, 0.2), STONE_L * (0.82 + 0.12 * float(hash01(u, 1.0, 2.0))),
                rot=roty(-rk if u < 0 else rk))
        u += 0.9
    box2(st, -0.5, 0.5, CH_Y1 - 0.9, CH_Y1 + 0.9, 14.25, 14.75, STONE_L * 0.9)
    finial_cross(0.0, CH_Y1, 14.75, h=1.5)
    for sx in (-1, 1):
        niche_statue(Loc(sx * 4.55, CH_Y1 - 0.65), 4.9, h=1.9)
    JEWEL = np.array([[0.70, 0.07, 0.12], [0.90, 0.42, 0.06], [0.06, 0.30, 0.42], [0.22, 0.10, 0.50], [0.85, 0.70, 0.36], [0.50, 0.05, 0.22]])
    def glass_mask(T, Z, tc, zc, r):
        n = fbm(T * 1.0, Z * 1.0, 1.6, 3.0)
        keep = (Z > 8.55) | ((n > 0.60) & (Z > 5.2)) | ((np.abs(T - c0) > 6) & (n > 0.50))
        return (great(T, Z) | sidew(T, Z)) & keep
    wall(B['glass'], (CH_X0, CH_Y1), (CH_X1, CH_Y1), 0.08, glass_mask, 12.6, (1, 1, 1), z0=3.3, seed=7.0, block=(0.25, 0.25), joint=1.0, relief=0.0, groove=0.0, chip=0.0,
         col_fn=lambda r, r2, T, Z: JEWEL[(r * 5.999).astype(int)] * (0.6 + 0.6 * r2[..., None]))
    for sx in (-1, 1):   # eight-sided corner turrets: the west one whole under a stone cap, the east one snapped off
        x = sx * 10.0
        zt = 10.6 if sx < 0 else 8.0
        drum_tower(x, CH_Y1, 0.0, zt, 1.15, STONE * 0.93)
        for zz in (3.4, 7.0):
            lathe(st, (x, CH_Y1, zz), [(1.2, 0), (1.3, 0.08), (1.3, 0.2), (1.2, 0.28)], 8, STONE_L * 0.85, rot=rotz(math.pi / 8))
        TL = Loc(x, CH_Y1 - 1.06)
        for zz in (4.6, 8.2) if sx < 0 else (4.6,):
            TL.box(B['iron'], -0.09, 0.09, -0.03, 0.05, zz, zz + 1.1, (0.01, 0.01, 0.015))
            TL.box(st, -0.26, 0.26, -0.1, 0.05, zz - 0.14, zz, STONE_L * 0.85)
        if sx < 0:
            lathe(st, (x, CH_Y1, zt), [(1.2, 0), (1.42, 0.1), (1.42, 0.3), (1.25, 0.42), (0.1, 3.0)], 8, STONE_L * 0.82, rot=rotz(math.pi / 8))
            blob(B['stone_r'], (x, CH_Y1, zt + 3.08), (0.15, 0.15, 0.18), STONE_L * 0.9, sub=1, rough=0.0)
        else:
            lathe(st, (x, CH_Y1, zt), [(1.15, 0), (1.0, 0.45), (0.5, 0.8)], 8, STONE * 0.8, rot=rotz(0.2) @ rotx(0.18))
    ivy(-9.2, -4.0, CH_Y1 - 0.67, FL + 0.6, 7.5, 520, RNG, patches=4)
    ivy(4.2, 9.4, CH_Y1 - 0.67, FL + 0.6, 6.0, 420, RNG, patches=3)

    # south front: the portal still stands, the rest is down to stubs
    pw = ruin_profile(2.6, 1.0, 3.6, scale=2.6, rough=0.7)
    def south(T, Z, tc, zc, r):
        ub = tc - c0
        mid = 8.4 - 0.8 * np.abs(ub) - r * 0.9 - np.where(ub > 1.0, (ub - 1.0) * 0.9, 0)
        sides = pw(tc) + np.where(ub < -6.6, 3.4 - r * 1.0, 0)
        prof = np.where(np.abs(ub) < 4.6, np.maximum(mid, sides), sides)
        return (zc + 0.35 < prof + FL) & ~lancet(T, Z, c0, 3.8, 0, 3.9) & ~lancet(T, Z, c0 - 8.3, 1.1, 3.0, 4.6)
    wall(st, (CH_X0, CH_Y0), (CH_X1, CH_Y0), 1.15, south, 9.6, STONE, z0=FL - 0.1, seed=9.1, tint2=STONE_W)
    orders((CH_X0, CH_Y0), (CH_X1, CH_Y0), c0, 3.8, 0, 3.9, 1.15, 4.2, zmax=7.6, z0=FL - 0.1, floor_z=FL,
           extra=lambda T, Z, tc, zc, r: zc < 6.6 - np.where(tc - c0 > 1.2, 1.5, 0))
    SL = Loc(0.0, CH_Y0 - 0.575)
    buttress(Loc(-4.1, CH_Y0 - 0.575), 1.1, [(0.9, 3.0), (0.55, 4.5)], z0=-0.3, seed=11.0)
    buttress(Loc(4.1, CH_Y0 - 0.575), 1.1, [(0.9, 2.3)], z0=-0.3, seed=12.0)
    for xa, xb in ((CH_X0 - 0.6, -4.65), (-3.55, -2.35), (2.35, 3.55), (4.65, CH_X1 + 0.6)):       # plinth course
        SL.box(st, xa, xb, -0.17, 0.05, -0.3, FL + 0.5, STONE_L * 0.78, slope=0.13)
    for sx in (-1, 1):
        lantern(sx * 2.45, CH_Y0 - 0.85, 3.5, lit=True, power=60)
        box(B['iron'], (sx * 2.45, CH_Y0 - 0.72, 3.78), (0.06, 0.3, 0.06), (0.03, 0.03, 0.035))
    ivy(-9.6, -6.9, CH_Y0 - 0.6, FL + 0.2, 5.6, 300, RNG)
    ivy(1.9, 4.2, CH_Y0 - 0.6, FL + 0.2, 4.6, 200, RNG)

    # side walls (seen end-on): low on the east, rising toward the tower on the west
    Ls = CH_Y1 - CH_Y0
    pe = ruin_profile(7.7, 0.9, 5.2, scale=3.4, rough=0.75)
    def east(T, Z, tc, zc, r):
        win = np.zeros_like(T, bool)
        for t in (6.0, 11.0, 16.0, 21.5):
            win |= lancet(T, Z, t, 1.2, 2.8, 4.6)
        return (zc + 0.35 < pe(tc) + FL + np.clip(tc - 21, 0, 4) * 0.9) & ~win
    wall(st, (CH_X1, CH_Y0), (CH_X1, CH_Y1), 1.1, east, 10.0, STONE * 0.97, z0=FL - 0.1, seed=12.3, tint2=STONE_W)
    pwst = ruin_profile(3.9, 1.2, 4.4, scale=2.9, rough=0.8)
    def west(T, Z, tc, zc, r):
        prof = np.where(tc < 8.2, pwst(tc), np.where(tc < 12.6, -5.0, 3.4 + np.clip(tc - 12.6, 0, 9) * 0.62 - r * 1.2))
        win = lancet(T, Z, 17.0, 1.2, 3.2, 5.2) | lancet(T, Z, 22.5, 1.2, 3.2, 5.6)
        return (zc + 0.35 < prof + FL) & ~win
    wall(st, (CH_X0, CH_Y0), (CH_X0, CH_Y1), 1.1, west, 10.5, STONE * 0.97, z0=FL - 0.1, seed=14.9, tint2=STONE_W)
    for y in (33.5, 44.0, 50.5):   # what is left of the buttresses outside
        buttress(Loc(CH_X1 + 0.55, y, math.pi / 2), 1.0, [(0.95, 1.9 + (y - 30) * 0.09)], z0=-0.3, seed=y)
    buttress(Loc(CH_X0 - 0.55, 33.5, -math.pi / 2), 1.0, [(0.95, 2.6)], z0=-0.3, seed=1.0)
    buttress(Loc(CH_X0 - 0.55, 45.7, -math.pi / 2), 1.0, [(0.95, 2.6), (0.6, 3.9)], z0=-0.3, seed=2.0)

    # columns
    spec = {(-1, 0): 6.6, (-1, 1): 2.3, (-1, 2): 6.6, (-1, 3): 6.6, (1, 0): 1.1, (1, 1): 6.6, (1, 2): 6.6, (1, 3): 3.6}
    for (sx, k), h in spec.items():
        column(sx * COLX, COL_Y[k], FL, h, broken=h < 6, seed=k * 7 + sx)
    for sx in (-1, 1):   # responds against the chancel
        column(sx * 6.0, 49.2, FL, 4.2 if sx > 0 else 6.6, broken=sx > 0, seed=40 + sx, r=0.38)
    CT = FL + 6.6
    # the one rib still spanning the nave
    wall(st, (-COLX - 0.7, 41.0), (COLX + 0.7, 41.0), 0.85,
         lambda T, Z, tc, zc, r: lancet(T, Z, COLX + 0.7, 9.8, CT, CT, k=0.62) & ~lancet(T, Z, COLX + 0.7, 8.4, CT, CT, k=0.6),
         CT + 6.6, STONE_L * 0.92, z0=CT, seed=17.0, block=(0.6, 0.6), var=0.14)
    # arcade arches along the nave, west side whole, east side half fallen
    wall(st, (-COLX, 41.0), (-COLX, 45.0), 0.85,
         lambda T, Z, tc, zc, r: (zc + 0.3 < CT + 3.7 - r * 0.8) & ~lancet(T, Z, 2.0, 3.0, 0, CT),
         CT + 4.0, STONE, z0=CT, seed=18.0, tint2=STONE_W)
    wall(st, (COLX, 37.0), (COLX, 41.0), 0.85,
         lambda T, Z, tc, zc, r: (zc + 0.3 < CT + 2.4 + (tc - 2.0) * 0.9 - r * 0.6) & ~lancet(T, Z, 2.0, 3.0, 0, CT) & (T > 1.2),
         CT + 4.0, STONE, z0=CT, seed=19.0, tint2=STONE_W)
    # fallen drums and rubble
    for (x, y, a, L) in [(6.1, 34.4, 0.5, 1.3), (7.3, 33.0, 1.9, 1.0), (5.6, 46.6, 2.5, 1.5), (-5.8, 36.0, 1.1, 1.1)]:
        d = np.array([math.cos(a), math.sin(a), 0]) * L / 2
        c = np.array([x, y, FL + 0.46])
        frustum(B['stone_r'], c - d, c + d, 0.46, 0.46, 10, STONE_L * 0.85)
        SOLIDS_XY.append((x, y, 0.8))
    rubble(-10.4, 40.0, None, 16, 1.5, rng, big=0.7)
    rubble(7.6, 31.4, FL, 12, 1.2, rng)
    rubble(8.0, 47.0, FL, 10, 1.0, rng)
    rubble(-7.8, 31.6, FL, 9, 1.0, rng)
    rubble(13.0, 38.5, None, 10, 1.3, rng)
    rubble(6.0, 28.0, None, 9, 1.4, rng)
    rubble(-6.5, 27.9, None, 8, 1.2, rng)

    # pews
    for row, y in enumerate((34.2, 36.2, 38.2)):
        for sx in (-1, 1):
            r = hash01(row * 1.0, sx * 1.0, 6.0)
            if r < 0.18:
                continue
            x = sx * 2.35
            R = rotz((r - 0.5) * (0.5 if r > 0.75 else 0.08))
            c = WOOD * (0.8 + 0.5 * r)
            P = lambda v: np.asarray(v) @ R.T + (x, y, FL + 0.07)
            box(B['wood'], P((0, 0, 0.45)), (2.5, 0.55, 0.1), c * 1.15, rot=R)
            box(B['wood'], P((0, 0.25, 0.75)), (2.5, 0.1, 0.9), c, rot=R)
            for e in (-1.2, 1.2):
                box(B['wood'], P((e, 0.02, 0.5)), (0.12, 0.6, 1.0), c * 0.9, rot=R)
            SOLIDS_XY.append((x, y, 1.4))


def build_tower():
    st = B['stone']
    cx, cy = (TW_X0 + TW_X1) / 2, (TW_Y0 + TW_Y1) / 2
    Wd = TW_X1 - TW_X0
    th = 1.4
    BZ = 2.4                 # lifts the belfry stage
    TOP = 19.2 + BZ
    def belfry(T, Z, c):
        return lancet(T, Z, c, 3.6, 13.9 + BZ, 15.9 + BZ, k=0.75)
    def btrim(T, Z, c):
        return lancet(T, Z, c, 4.3, 13.55 + BZ, 15.9 + BZ, k=0.75)
    def face(T, Z, tc, zc, r, c=Wd / 2, door=False, trim=False):
        m = ~belfry(T, Z, c)
        for z in (6.8, 10.4, 14.2):
            m &= ~((np.abs(T - c) < 0.26) & (Z > z) & (Z < z + 1.9))
        if trim:
            m &= ~btrim(T, Z, c) & ~lancet(T, Z, c, 3.0, -1, 3.3)
        return m
    ys, yn = TW_Y0 + th / 2, TW_Y1 - th / 2
    xw, xe = TW_X0 + th / 2, TW_X1 - th / 2
    Ls = Wd - 2 * th
    wall(st, (TW_X0, ys), (TW_X1, ys), th, lambda *a: face(*a, trim=True), TOP, STONE * 0.98, z0=-0.4, seed=21.0, tint2=STONE_W)
    wall(st, (TW_X0, yn), (TW_X1, yn), th, face, TOP, STONE * 0.98, z0=-0.4, seed=22.0, tint2=STONE_W)
    wall(st, (xw, TW_Y0 + th), (xw, TW_Y1 - th), th, lambda *a: face(*a, c=Ls / 2), TOP, STONE * 0.98, z0=-0.4, seed=23.0, tint2=STONE_W)
    wall(st, (xe, TW_Y0 + th), (xe, TW_Y1 - th), th, lambda *a: face(*a, c=Ls / 2), TOP, STONE * 0.98, z0=-0.4, seed=24.0, tint2=STONE_W)
    wall(st, (TW_X0, ys), (TW_X1, ys), th + 0.3,
         lambda T, Z, tc, zc, r: btrim(T, Z, Wd / 2) & ~belfry(T, Z, Wd / 2),
         TOP, STONE_L, z0=-0.4, seed=25.0, block=(0.62, 0.62), var=0.1, chip=0.05, relief=0.02, groove=0.035)
    wall(st, (TW_X0, ys), (TW_X1, ys), th + 0.75,                                         # hood mould over the belfry opening
         lambda T, Z, tc, zc, r: lancet(T, Z, Wd / 2, 5.1, 13.55 + BZ, 15.9 + BZ, k=0.75) & ~lancet(T, Z, Wd / 2, 4.62, 13.55 + BZ, 15.9 + BZ, k=0.75)
         & (Z > 15.6 + BZ), TOP - 0.4, STONE_L * 0.95, z0=15.0 + BZ, seed=25.5, block=(0.7, 0.7), var=0.08, chip=0.04, relief=0.0, groove=0.03)
    orders((TW_X0, ys), (TW_X1, ys), Wd / 2, 3.0, -1, 3.3, th, 26.0, zmax=6.6, floor_z=0.22)
    for z in (5.7, 9.4, 13.0 + BZ):   # string courses, each with a chamfered drip below
        box2(st, TW_X0 - 0.2, TW_X1 + 0.2, TW_Y0 - 0.2, TW_Y1 + 0.2, z, z + 0.24, STONE_L * 0.88)
        box2(st, TW_X0 - 0.1, TW_X1 + 0.1, TW_Y0 - 0.1, TW_Y1 + 0.1, z - 0.14, z, STONE_L * 0.72)
    PT = 13.6 + BZ
    for sx in (-1, 1):                     # corner piers in courses, with stepped buttresses and a pinnacle on each
        for sy in (-1, 1):
            x, y = cx + sx * (Wd / 2 - 0.2), cy + sy * (Wd / 2 - 0.2)
            courses(Loc(x, y), -0.72, 0.72, -0.72, 0.72, -0.4, PT, STONE * 0.92, seed=sx * 3.0 + sy)
            pinnacle(x, y, PT, s=1.15, h=3.7)
            buttress(Loc(x + sx * 0.72, y, sx * math.pi / 2), 1.44, [(1.0, 5.7), (0.65, 9.4), (0.35, 13.3)], seed=sx + sy * 2.0)
            if sy < 0:
                buttress(Loc(x, y - 0.72), 1.44, [(1.0, 5.7), (0.65, 9.4), (0.35, 13.3)], seed=sx * 5.0)
    TS = Loc(cx, TW_Y0)
    for xa, xb in ((-Wd / 2 + 0.55, -1.95), (1.95, Wd / 2 - 0.55)):                       # plinth course
        TS.box(st, xa, xb, -0.2, 0.05, -0.4, 0.8, STONE_L * 0.78, slope=0.15)
    for k, z in enumerate((6.8, 10.4)):                                                    # dressings of the slit windows
        TS.box(st, -0.56, 0.56, -0.16, 0.05, z - 0.17, z, STONE_L * 0.88, slope=0.07)
        for sg in (-1, 1):
            TS.box(st, sg * 0.37 - 0.1, sg * 0.37 + 0.1, -0.09, 0.05, z, z + 1.9, STONE_L * 0.92)
        TS.gable(st, -0.6, 0.6, -0.17, 0.05, z + 1.9, 0.42, STONE_L * 0.88)
    TS.box(st, -2.6, 2.6, -0.34, 0.05, 13.33 + BZ, 13.55 + BZ, STONE_L * 0.9)             # belfry sill on corbels
    for u in (-2.1, -0.7, 0.7, 2.1):
        TS.box(st, u - 0.16, u + 0.16, -0.26, 0.05, 13.0 + BZ, 13.33 + BZ, STONE_L * 0.78)
    def pierced(T, Z, tc, zc, r):                                                          # pierced parapet across the opening
        return ((T % 0.62 - 0.31) ** 2 + (Z - 14.22 - BZ) ** 2) > 0.2 ** 2
    wall(st, (cx - 1.86, TW_Y0 + 0.22), (cx + 1.86, TW_Y0 + 0.22), 0.22, pierced, 14.55 + BZ, STONE_L * 0.9, z0=13.9 + BZ, seed=27.0,
         block=(0.62, 0.7), var=0.06, chip=0.0, relief=0.0, groove=0.0)
    for a in range(4):                                                                     # corbel table and cornice under the eaves
        CL = Loc(cx + math.sin(a * math.pi / 2) * Wd / 2, cy - math.cos(a * math.pi / 2) * Wd / 2, a * math.pi / 2)
        u = -Wd / 2 + 0.25
        while u < Wd / 2 - 0.1:
            CL.box(st, u - 0.13, u + 0.13, -0.2, 0.05, TOP - 0.86, TOP - 0.6, STONE_L * 0.74)
            CL.box(st, u - 0.15, u + 0.15, -0.4, 0.05, TOP - 0.6, TOP - 0.3, STONE_L * 0.84)
            u += 0.6
    box2(st, TW_X0 - 0.5, TW_X1 + 0.5, TW_Y0 - 0.5, TW_Y1 + 0.5, TOP - 0.3, TOP - 0.06, STONE_L * 0.9)
    for sx in (-1, 1):                                                                     # water spouts at the corners
        for sy in (-1, 1):
            ang = math.atan2(sy, sx)
            gx, gy = cx + sx * (Wd / 2 + 0.75), cy + sy * (Wd / 2 + 0.75)
            box(st, (gx, gy, TOP - 0.5), (1.3, 0.28, 0.3), STONE * 0.8, rot=rotz(ang))
            blob(B['stone_r'], (gx + sx * 0.5, gy + sy * 0.5, TOP - 0.44), (0.24, 0.24, 0.22), STONE * 0.85, sub=1, rough=0.2)
    box2(st, TW_X0 + th, TW_X1 - th, TW_Y0 + th, TW_Y1 - th, 12.7 + BZ, 13.1 + BZ, STONE_D)       # belfry floor
    for i in range(6):                                                                     # door of six planks
        rr = float(hash01(i * 1.0, 4.0, 9.0))
        box2(B['wood'], cx - 1.2 + i * 0.4 + 0.015, cx - 1.2 + (i + 1) * 0.4 - 0.015, ys + 0.1 - 0.03 * (i % 2), ys + 0.3, -0.2, 5.3, WOOD * (0.95 + 0.4 * rr))
    box(B['iron'], (cx + 0.75, ys + 0.03, 2.3), (0.16, 0.08, 0.16), IRON, rot=roty(math.pi / 4))
    for k in range(3):
        box2(B['iron'], cx - 1.2, cx + 1.2, ys + 0.02, ys + 0.12, 0.6 + k * 1.25, 0.72 + k * 1.25, (0.03, 0.03, 0.035))
    box2(B['floor'], cx - 1.6, cx + 1.6, TW_Y0 - 0.75, TW_Y0 + 0.1, -0.4, 0.22, STONE_L * 0.9)
    # slate roof, laid in courses
    n, RH = 13, 5.4
    r0 = (Wd / 2 + 0.55) * math.sqrt(2)
    for k in range(n):
        ra, rb = r0 * (1 - k / n) + 0.1, r0 * (1 - (k + 1) / n) + 0.02
        lathe(B['roof'], (cx, cy, TOP + RH * k / n), [(ra, 0.0), (rb, RH / n)], 4, SLATE * (0.8 + 0.4 * hash01(k * 1.0, 2.0, 5.0)), rot=rotz(math.pi / 4))
    for a in (0,):                                                                         # a dormer on the south slope
        DL = Loc(cx + math.sin(a * math.pi / 2) * 3.62, cy - math.cos(a * math.pi / 2) * 3.62, a * math.pi / 2)
        DL.box(st, -0.6, 0.6, -0.55, 0.9, TOP + 0.9, TOP + 2.0, STONE_L * 0.85)
        DL.gable(B['roof'], -0.78, 0.78, -0.72, 1.5, TOP + 2.0, 0.72, SLATE * 1.15)
        DL.box(B['iron'], -0.3, 0.3, -0.58, -0.5, TOP + 1.1, TOP + 1.85, (0.01, 0.01, 0.015))
        DL.box(st, -0.42, 0.42, -0.66, -0.5, TOP + 0.96, TOP + 1.1, STONE_L * 0.95)
    frustum(B['iron'], (cx, cy, TOP + RH - 0.1), (cx, cy, TOP + RH + 1.6), 0.07, 0.04, 4, (0.03, 0.03, 0.035))
    box(B['iron'], (cx, cy, TOP + RH + 1.05), (0.9, 0.08, 0.1), (0.03, 0.03, 0.035))
    # the bell, hung in the south opening so the camera can see it
    by = ys
    prof = [(1.27, 14.25), (1.22, 14.4), (1.02, 14.8), (0.84, 15.4), (0.74, 16.0), (0.66, 16.45), (0.45, 16.75), (0.16, 16.86)]
    lathe(B['bell'], (cx, by, BZ), prof, 18, np.array([0.20, 0.17, 0.09]))
    lathe(B['bell'], (cx, by, BZ), [(1.3, 14.22), (1.3, 14.36)], 18, np.array([0.26, 0.22, 0.12]))
    box2(B['wood'], cx - 1.75, cx + 1.75, by - 0.2, by + 0.2, 16.86 + BZ, 17.25 + BZ, WOOD * 1.2)
    LIGHTS.append({'kind': 'bell', 'x': cx, 'y': by, 'z': 15.4 + BZ, 'r': 4.0, 'color': '#8fe6d6'})
    lantern(cx + 2.0, TW_Y0 - 0.3, 3.5, lit=True, power=55)
    box(B['iron'], (cx + 1.75, TW_Y0 - 0.15, 3.58), (0.06, 0.3, 0.06), (0.03, 0.03, 0.035))
    ivy(TW_X0 + 0.2, TW_X0 + 2.6, TW_Y0 - 0.05, 0.0, 9.0, 520, RNG, patches=4)
    ivy(TW_X1 - 2.0, TW_X1, TW_Y0 - 0.05, 4.5, 11.0, 260, RNG, patches=2)
    SOLIDS_XY.append((cx, cy, 5.8))
    EXITS.append({'id': 'tower', 'label': '鐘楼の中へ', 'x': cx, 'y': TW_Y0 - 0.55, 'r': 0.9})


def build_cloister():
    st = B['stone']
    rng = np.random.default_rng(41)
    # north arcade
    pa = ruin_profile(5.1, 2.6, 5.2, scale=3.0, rough=0.5)
    a0, a1, ay = -26.6, -17.0, 47.4
    def arc(T, Z, tc, zc, r):
        op = np.zeros_like(T, bool)
        for i in range(4):
            op |= lancet(T, Z, 1.3 + 2.33 * i, 1.75, 0.75, 2.45)
        return (zc + 0.3 < np.minimum(pa(tc), 4.5)) & ~op
    wall(st, (a0, ay), (a1, ay), 0.7, arc, 4.6, STONE_L * 0.86, z0=-0.3, seed=31.0, block=(0.9, 0.55), tint2=STONE_W)
    for k in range(5):                    # a slender shaft in front of each pier that still stands
        t = 0.135 + 2.33 * k
        if float(pa(np.array(t))) > 2.7:
            shaft(a0 + t, ay - 0.5, -0.2, 2.55, r=0.12)
    # dwarf wall and column stubs, south side
    for (xa, xb, sd) in ((-26.6, -20.3, 1.0), (-17.7, -11.6, 2.0)):
        pd_ = ruin_profile(sd + 9, 0.35, 1.0, scale=2.0)
        wall(st, (xa, 32.2), (xb, 32.2), 0.6, lambda T, Z, tc, zc, r, p=pd_: zc + 0.2 < p(tc), 1.3, STONE_L * 0.8, z0=-0.3, seed=33.0 + sd,
             block=(0.9, 0.45))
        x = xa + 0.8
        while x < xb - 0.3:
            h = rng.uniform(0.5, 2.3)
            frustum(B['stone_r'], (x, 32.2, 0.5), (x, 32.2, 0.5 + h), 0.17, 0.16, 8, STONE_L * rng.uniform(0.8, 1.0))
            x += 1.75
    # pool
    px, py = POOL
    lathe(B['stone_r'], (px, py, -0.4), [(3.1, 0.0), (3.1, 0.75), (3.02, 0.86), (2.62, 0.86), (2.5, 0.75), (2.5, 0.0)], 28, STONE_L * 0.82, caps=False)
    lathe(B['water'], (px, py, 0.0), [(2.55, 0.12), (0.0, 0.12)], 28, (0.02, 0.03, 0.05), caps=False)
    SOLIDS_XY.append((px, py, 3.4))
    # the two moons, seen only as reflections in the pool
    rdir = np.array([0.0, COS, SIN])
    def refl_disc(mb, qx, qy, rad, c, ring=None):
        ctr = np.array([qx, qy, 0.12]) + rdir * 70
        u = np.array([1.0, 0, 0])
        w = np.cross(rdir, u)
        ang = np.linspace(0, 2 * np.pi, 28, endpoint=False)
        v = [ctr + (np.cos(a) * u + np.sin(a) * w) * rad for a in ang] + [ctr]
        mb.add(v, tris=[[28, (i + 1) % 28, i] for i in range(28)], col=c)
        if ring:
            v2 = [ctr - rdir * 0.5 + (np.cos(a) * u + np.sin(a) * w) * (rad + ring) for a in ang] + [ctr - rdir * 0.5]
            B['moon'].add(v2, tris=[[28, (i + 1) % 28, i] for i in range(28)], col=(0.55, 0.42, 0.95))
    refl_disc(B['moon'], px - 0.95, py - 0.55, 0.52, (1.0, 0.86, 0.66))
    refl_disc(B['moonk'], px + 0.85, py + 0.75, 0.50, (0, 0, 0), ring=0.09)
    # the old tree that still turns red
    tx, ty = -23.6, 43.6
    tree(B['trunk'], B['leaf'], (tx, ty, float(Hf(tx, ty))), 8.2, 3, trunk_r=0.5, depth=4, spread=0.7, lean=(0.1, -0.1),
         leaf_cols=AUTUMN, leaf_n=5200, leaf_size=0.2, leaf_r=1.45)
    SOLIDS_XY.append((tx, ty, 1.0))
    box(st, (tx, ty, -0.5), (0.7, 0.7, 2.0), WOOD, pivot_bottom=True)
    # fallen leaves on the grass and on the water
    n = 900
    a, d = rng.uniform(0, 6.283, n), np.abs(rng.normal(0, 3.4, n))
    lx, ly = tx + np.cos(a) * d + 1.0, ty + np.sin(a) * d - 1.5
    okm = (lx > -26.4) & (ly < 47.0) & (ly > 32.8) & (lx < -11.5)
    lx, ly = lx[okm], ly[okm]
    inpool = np.hypot(lx - px, ly - py) < 2.5
    onrim = (np.hypot(lx - px, ly - py) < 3.1) & ~inpool
    lz = np.where(inpool, 0.13, np.where(onrim, 0.47, Hf(lx, ly) + 0.03))
    m = len(lx)
    ang = rng.uniform(0, 6.283, m)
    s = rng.uniform(0.07, 0.12, m)
    v = np.stack([np.stack([lx + np.cos(ang + k * 1.5708) * s, ly + np.sin(ang + k * 1.5708) * s, lz], 1) for k in range(4)], 1).reshape(-1, 3)
    cc = np.array(AUTUMN)[rng.integers(0, 4, m)] * rng.uniform(0.8, 1.3, (m, 1))
    B['cover'].add(v, quads=np.arange(m * 4).reshape(m, 4), col=cc)
    stone_bench(-14.2, 36.0, rot=0.5)
    stone_bench(-23.8, 37.2, rot=1.2)
    lantern(-16.4, 47.0, 2.6, lit=False, post=True)
    ivy(a0 + 0.3, a0 + 3.5, ay - 0.37, 0.0, 4.0, 300, RNG)
    # west and east boundary walls (end-on)
    pw_ = ruin_profile(8.2, 0.6, 3.2, scale=4.0, rough=0.8)
    wall(st, (-27.4, GATE_Y), (-27.4, 50.0), 0.9, lambda T, Z, tc, zc, r: zc + 0.35 < pw_(tc), 3.4, STONE, z0=-0.5, seed=36.0, tint2=STONE_W)
    pe_ = ruin_profile(2.9, 0.5, 2.8, scale=4.5, rough=0.8)
    wall(st, (27.4, GATE_Y), (27.4, 56.0), 0.9, lambda T, Z, tc, zc, r: zc + 0.35 < pe_(tc), 3.2, STONE, z0=-0.5, seed=37.0, tint2=STONE_W)
    # wall closing the cloister to the north-west, behind the arcade
    pn = ruin_profile(6.6, 2.0, 4.8, scale=3.0, rough=0.7)
    wall(st, (-27.4, 50.2), (TW_X0, 50.2), 0.9, lambda T, Z, tc, zc, r: zc + 0.35 < pn(tc), 5.0, STONE * 0.95, z0=-0.5, seed=38.0, tint2=STONE_W)
    ivy(-27.0, -19.2, 49.72, 0.0, 3.6, 420, RNG, patches=4)


def build_terrace_and_cliff():
    st = B['stone']
    rng = np.random.default_rng(51)
    # flagged lookout in the north-east
    for j in range(5):
        for i in range(15):
            x, y = 11.9 + i * 1.0 + rng.uniform(-0.05, 0.05), 57.3 + j * 0.95 + (0.3 if i % 2 else 0)
            if y > 61.2 or rng.random() < 0.12:
                continue
            box(B['floor'], (x, y, float(Hf(x, y)) - 0.04), (0.93, 0.88, 0.1), STONE * rng.uniform(0.8, 1.15), rot=rotz(rng.uniform(-0.06, 0.06)), pivot_bottom=True)
    def bal(T, Z, tc, zc, r):
        gap = (tc > 5.2) & (tc < 7.4)
        return ((Z < 0.3) | (Z > 0.95) | ((T % 0.62) < 0.26)) & ~(gap & (Z > 0.3)) & ~((tc > 7.4) & (tc < 8.0) & (Z > 0.7))
    wall(st, (11.4, 61.75), (27.0, 61.75), 0.45, bal, 1.22, STONE_L * 0.85, z0=-0.2, seed=41.0, block=(1.2, 0.3), var=0.12, chip=0.06, relief=0.03)
    for x in (11.6, 16.5, 19.0, 23.0, 26.8):
        box2(st, x - 0.35, x + 0.35, 61.4, 62.1, -0.3, 1.5, STONE_L * 0.8)
        lathe(st, (x, 61.75, 1.5), [(0.52, 0), (0.05, 0.35)], 4, STONE_L * 0.85, rot=rotz(math.pi / 4))
    rubble(17.8, 61.0, None, 7, 0.7, rng, big=0.5)
    lantern(24.9, 60.6, 2.5, lit=True, power=60, post=True)
    stone_bench(14.6, 60.4)
    # low wall shutting off the ledge behind the church
    wall(st, (11.2, 57.8), (11.2, 62.4), 0.8, lambda T, Z, tc, zc, r: zc + 0.3 < 2.4 - r * 0.8, 2.6, STONE, z0=-0.4, seed=43.0)
    EXITS.append({'id': 'lookout', 'label': '二つの月を眺める', 'x': 18.3, 'y': 60.6, 'r': 1.6, 'kind': 'look'})
    # trees along the northern edge, silhouettes against the sky
    for (x, y, h, r, sd) in [(-25.5, 58.5, 8.0, 2.2, 61), (-21.8, 60.2, 6.0, 1.7, 62), (-29.0, 55.0, 7.0, 2.0, 63), (28.6, 59.5, 6.0, 1.8, 64)]:
        conifer(B['trunk'], B['leaf'], B['core'], (x, y, float(Hf(x, y))), h, r, sd, YEW)
    tree(B['twig'], None, (-9.0, 60.6, 0.0), 5.0, 77, trunk_r=0.22, depth=4, spread=0.9, gnarl=0.35)


def build_woods():
    """Dark trees on the slopes that fall away on three sides."""
    rng = np.random.default_rng(71)
    pts = []
    for x in np.arange(-31, 31.1, 1.9):          # southern slope, rows going down
        for y in (6.6, 3.6, 0.4, -3.0, -6.4):
            if abs(x) < 3.9:
                continue
            pts.append((x + rng.uniform(-0.8, 0.8), y + rng.uniform(-1.0, 1.0)))
    for y in np.arange(9.0, 63, 2.3):            # east and west flanks
        for xo in (29.2, 31.2):
            for sx in (-1, 1):
                if sx < 0 and y > 51 and xo < 30:
                    continue
                pts.append((sx * (xo + rng.uniform(-0.5, 0.5)), y + rng.uniform(-0.9, 0.9)))
    for (x, y) in pts:
        if y > CLIFF_Y - 1.0:
            continue
        h, r = rng.uniform(4.8, 8.5), rng.uniform(1.5, 2.3)
        conifer(B['twig'], B['leaf'], B['core'], (x, y, float(Hf(x, y))), h, r, int(rng.integers(1e6)), YEW)
    for k in range(70):                          # undergrowth on the slopes
        x, y = rng.uniform(-31, 31), rng.uniform(-8, 7.6)
        if abs(x) < 3.2:
            continue
        bush(B['leaf'], B['core'], (x, y, float(Hf(x, y))), rng.uniform(0.6, 1.2), int(rng.integers(1e6)), YEW)
    # shrubs on the plateau, hugging walls
    for (x, y, r) in [(-26.0, 12.0, 1.0), (-11.5, 11.4, 0.8), (12.6, 11.5, 0.9), (26.0, 28.0, 1.0), (11.8, 30.6, 0.8), (-25.9, 33.6, 0.8),
                      (25.9, 40.0, 0.9), (12.0, 55.6, 0.8), (-12.2, 30.3, 0.75), (7.0, 11.3, 0.7), (-20.5, 11.5, 0.8), (26.2, 20.0, 0.9)]:
        bush(B['leaf'], B['core'], (x, y, float(Hf(x, y))), r, int(x * 31 + y * 7) % 9999, [(0.03, 0.07, 0.035), (0.05, 0.09, 0.03), (0.07, 0.10, 0.035)])
        SOLIDS_XY.append((x, y, r))
        box(B['stone'], (x, y, float(Hf(x, y)) - 0.3), (r * 1.1, r * 0.9, 0.8), (0.03, 0.05, 0.03), pivot_bottom=True)


def scatter_ground_cover():
    rng = np.random.default_rng(81)
    n = 26000
    x, y = rng.uniform(-28.5, 28.5, n), rng.uniform(8.6, CLIFF_Y - 0.5, n)
    keep = path_dist(x, y) > 1.15 + rng.uniform(-0.2, 0.3, n)
    keep &= ~((x > CH_X0 - 0.9) & (x < CH_X1 + 0.9) & (y > CH_Y0 - 0.7) & (y < CH_Y1 + 1.0))
    keep &= ~((x > TW_X0 - 0.2) & (x < TW_X1 + 0.2) & (y > TW_Y0 - 0.9) & (y < TW_Y1 + 0.2))
    keep &= np.hypot(x - POOL[0], y - POOL[1]) > 3.2
    keep &= ~((x > 11.3) & (y > 57.0))
    keep &= ~((x > 15.6) & (x < 22.4) & (y > 13.4) & (y < 19.2))
    keep &= fbm(x, y, 3.0, 4.0) > 0.36
    x, y = x[keep], y[keep]
    z = Hf(x, y)
    cols = [GRASS[0] * 1.3, GRASS[1] * 1.4, GRASS[2] * 1.1, GRASS[1] * 0.9]
    tufts(B['cover'], np.stack([x, y, z], 1), rng, cols)
    # grass pushing up between the church floor slabs
    n = 900
    x, y = rng.uniform(CH_X0 + 0.7, CH_X1 - 0.7, n), rng.uniform(CH_Y0 + 0.7, 49.2, n)
    k = (hash01(np.floor((x + 9.75) / 1.5), np.floor((y - 30.2) / 1.5), 4.4) < 0.2) & (np.abs(x) > 1.0)
    tufts(B['cover'], np.stack([x[k], y[k], np.full(k.sum(), FL)], 1), rng, cols, h=(0.12, 0.3))
    # pale moon-flowers in drifts
    n = 1500
    x, y = rng.uniform(-27, 27, n), rng.uniform(10.5, CLIFF_Y - 1, n)
    k = (fbm(x, y, 4.0, 17.0) > 0.62) & (path_dist(x, y) > 1.3)
    k &= ~((x > CH_X0 - 1) & (x < CH_X1 + 1) & (y > CH_Y0 - 1) & (y < CH_Y1 + 1)) & (np.hypot(x - POOL[0], y - POOL[1]) > 3.2)
    k &= ~((x > TW_X0) & (x < TW_X1) & (y > TW_Y0 - 1))
    x, y = x[k], y[k]
    pts = np.stack([x, y, Hf(x, y) + rng.uniform(0.18, 0.32, len(x))], 1)
    cards(B['flower'], pts, 0.055, [(0.75, 0.9, 1.0), (0.9, 0.95, 0.85), (0.7, 0.8, 1.0)], rng)
    # pebbles along the paths
    n = 500
    x, y = rng.uniform(-26, 26, n), rng.uniform(9, 58, n)
    k = (np.abs(path_dist(x, y) - 1.0) < 0.35)
    for xx, yy in zip(x[k], y[k]):
        s = rng.uniform(0.08, 0.2)
        box(B['pebble'], (xx, yy, float(Hf(xx, yy)) + s * 0.2), (s * 1.4, s, s * 0.7), STONE * rng.uniform(0.7, 1.2), rot=rotz(rng.uniform(0, 3)))


# ---------------------------------------------------------------- build
build_terrain()
build_stairs_and_gate()
build_path_slabs()
build_graveyard()
build_church()
build_tower()
build_cloister()
build_terrace_and_cliff()
build_woods()
scatter_ground_cover()
EXITS.append({'id': 'stairs', 'label': '丘のふもとへ', 'x': 0.0, 'y': 1.2, 'r': 1.3})
SPAWN = (0.0, 5.0)

OBJ = {}
for name, mb in kit.BUILDERS.items():
    ob = mb.build(col)
    if ob is not None:
        OBJ[name] = ob
for nm in ('moonrefl', 'moonblack'):
    if nm in OBJ:
        o = OBJ[nm]
        o.visible_camera = False
        o.visible_diffuse = False
        o.visible_shadow = False
        o.visible_volume_scatter = False
print('built', sum(len(o.data.polygons) for o in OBJ.values()), 'faces in', round(time.time() - T0, 1), 's')

# ---------------------------------------------------------------- light
def sun(name, direction, color, strength, angle_deg, shadow=True):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = strength
    ld.color = color
    ld.angle = math.radians(angle_deg)
    ld.use_shadow = shadow
    lo = bpy.data.objects.new(name, ld)
    lo.rotation_euler = Vector(direction).normalized().to_track_quat('-Z', 'Y').to_euler()
    col.objects.link(lo)
    return lo

# the white moon is going down in the north-north-west: low, warm, and behind everything we look at
KEY_DIR = (0.36, -0.78, -0.50)
TUNE = json.loads(os.environ.get('TUNE', '{}'))     # for trying other light settings without editing this file
sun('white_moon', KEY_DIR, tuple(TUNE.get('key_col', (1.0, 0.60, 0.33))), TUNE.get('key', 5.6), 2.5)
# the black moon is coming up in the south-east: a cold, weak light on the faces turned to the camera
sun('black_moon', (-0.55, 0.50, -0.62), tuple(TUNE.get('fill_col', (0.80, 0.56, 0.86))), TUNE.get('fill', 1.5), 30.0)

world = bpy.data.worlds.new('dusk')
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = tuple(TUNE.get('world_col', (0.44, 0.26, 0.33))) + (1,)
bg.inputs[1].default_value = TUNE.get('world', 0.8)
sc.world = world

# ---------------------------------------------------------------- camera and render
cam = bpy.data.cameras.new('cam')
cam.type = 'ORTHO'
cam.ortho_scale = max(W, H) / S
cam.clip_start, cam.clip_end = 1.0, 500.0
co = bpy.data.objects.new('cam', cam)
VIEW = Vector((0, COS, -SIN))
cy_ground = (SY0 - H / 2) / S / SIN
co.location = Vector((X0 + W / 2 / S, cy_ground, 0)) - VIEW * 150
co.rotation_euler = (math.pi / 2 - math.asin(SIN), 0, 0)
col.objects.link(co)
sc.camera = co

sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 5
sc.cycles.diffuse_bounces = 3
sc.cycles.transparent_max_bounces = 8
sc.cycles.sample_clamp_indirect = 6.0
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = float(os.environ.get('NOISE', '0.02'))
sc.cycles.pixel_filter_type = 'BLACKMAN_HARRIS'
sc.cycles.filter_width = float(os.environ.get('FILTER', '1.5'))
sc.render.resolution_x, sc.render.resolution_y = W * RES, H * RES
if os.environ.get('CROP'):          # x0,y0,x1,y1 in base pixels from the top left: render only that part, for a quick look
    cx0, cy0, cx1, cy1 = [float(v) for v in os.environ['CROP'].split(',')]
    sc.render.use_border = True
    sc.render.use_crop_to_border = True
    sc.render.border_min_x, sc.render.border_max_x = cx0 / W, cx1 / W
    sc.render.border_min_y, sc.render.border_max_y = 1 - cy1 / H, 1 - cy0 / H
sc.render.resolution_percentage = 100
sc.render.film_transparent = True
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.image_settings.color_depth = '16'
sc.view_settings.view_transform = TUNE.get('view', 'Standard')
try:
    sc.view_settings.look = TUNE.get('look', 'None')
except Exception as e:
    print('look not set', e)
sc.view_settings.exposure = float(os.environ.get('EXPOSURE', '0.0'))
sc.render.threads_mode = 'AUTO'
if os.environ.get('NORENDER') != '1':
    sc.render.filepath = os.path.join(WORK, os.environ.get('BEAUTY', 'beauty.png'))
    bpy.ops.render.render(write_still=True)
    print('rendered in', round(time.time() - T0, 1), 's')

meta = {
    'w': W * RES, 'h': H * RES, 'scale': S * RES, 'sin': SIN, 'cos': COS, 'x0': X0, 'sy0': SY0 * RES,
    'dw': int(W * DRES), 'dh': int(H * DRES), 'dscale': S * DRES,
    'spawn': list(SPAWN), 'exits': EXITS, 'lights': LIGHTS, 'key_dir': list(KEY_DIR), 'pool': list(POOL),
    'paths': [[[list(map(float, q)) for q in pts], w] for pts, w in PATHS],
    'name': '鐘のならない修道院', 'sub': '月替わりの刻',
}
json.dump(meta, open(os.path.join(WORK, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
if QUICK:
    sys.exit(0)

# ---------------------------------------------------------------- bake: what the game needs besides the picture
import bake
bake.run(sc, OBJ, kit.FACECOL, meta, WORK, dict(S=S * DRES, SIN=SIN, COS=COS, W=int(W * DRES), H=int(H * DRES), X0=X0, SY0=SY0 * DRES, SPAWN=SPAWN))
print('done in', round(time.time() - T0, 1), 's')
