"""Painted dungeon floor: generation -> global shift (DX, DY in 1x px) -> 1x map image (+@24/@32/@40) + meta json.
Optional closed image for the live cells (bog): LIVE=<json [{cells:[[x,y]..], patch:i}]> -> <name>_closed: the live cells repainted as water sampled from the painting.
usage: python3 process_dun.py <layout.json> <gen.png> <name> <outdir>   env DX DY GAIN WALKLIFT WALKCH LIVE WATER=<x0,y0,x1,y1 1x px water sample box>"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
lay, src, NAME, outdir = sys.argv[1:5]
os.makedirs(outdir, exist_ok=True)
d = json.load(open(lay)); W, H = d['w'], d['h']; T = 32
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(np.float32)
DX, DY = int(os.environ.get('DX', 0)), int(os.environ.get('DY', 0))
if DY: A = np.roll(A, DY, 0); (A.__setitem__(slice(DY, None) if DY < 0 else slice(0, DY), A[DY - 1:DY] if DY < 0 else A[DY:DY + 1]))
if DX: A = np.roll(A, DX, 1)
gain = float(os.environ.get('GAIN', 0.92))
A = np.clip(A * gain, 0, 255)
# 歩ける所を持ち上げる（2026-09-30: 沼の床・道が暗い水と見分けにくかった）。WALKLIFT=<倍率> WALKCH=<歩ける字>（layout.json の rows_fit）。境はぼかす
WL = float(os.environ.get('WALKLIFT', 1.0))
if WL != 1.0:
    rows = d.get('rows_fit') or d['rows']
    wm = np.kron(np.array([[c in os.environ.get('WALKCH', 'gp=') for c in r] for r in rows], np.float32), np.ones((T, T), np.float32))
    wm = np.clip(ndimage.gaussian_filter(wm, 6.0) * 1.3, 0, 1)[..., None]
    A = np.clip(A * (1 + (WL - 1) * wm), 0, 255)
base = np.rint(A).astype(np.uint8)
def save_set(name, arr, rgba=False):
    im = Image.fromarray(arr.astype(np.uint8), 'RGBA' if rgba else 'RGB')
    im.save(os.path.join(outdir, name + '@32.png'), optimize=True)
    im.resize((W * 24, H * 24), Image.LANCZOS if not rgba else Image.NEAREST).save(os.path.join(outdir, name + '@24.png'), optimize=True)
    if W * 40 <= 2048 and H * 40 <= 2048:
        im.resize((W * 40, H * 40), Image.NEAREST).save(os.path.join(outdir, name + '@40.png'), optimize=True)
save_set(NAME, base)
sizes = (24, 32, 40) if W * 40 <= 2048 and H * 40 <= 2048 else (24, 32)
meta = dict(id=NAME, kind='under', map=NAME, tile=32, size32=[W * T, H * T], windows32=[], doors32=[], painted=[], files={t: '%s@%d.png' % (NAME, t) for t in sizes})
LIVE = os.environ.get('LIVE')
if LIVE:
    live = json.load(open(LIVE))
    wx0, wy0, wx1, wy1 = [int(v) for v in os.environ['WATER'].split(',')]
    tex = base[wy0:wy1, wx0:wx1].astype(np.float32)
    th, tw = tex.shape[:2]
    closed = base.astype(np.float32).copy()
    mask = np.zeros((H * T, W * T), bool)
    for L in live:
        for x, y in L['cells']: mask[y * T:(y + 1) * T, x * T:(x + 1) * T] = True
    # tiled water texture with random offsets per 64 px block (no visible repeat), feathered 6 px into the neighbours
    rng = np.random.RandomState(3)
    water = np.zeros_like(closed)
    for by in range(0, H * T, 64):
        for bx in range(0, W * T, 64):
            ox, oy = rng.randint(0, max(1, tw - 64)), rng.randint(0, max(1, th - 64))
            blk = tex[oy:oy + 64, ox:ox + 64]
            if rng.rand() < 0.5: blk = blk[:, ::-1]
            if rng.rand() < 0.5: blk = blk[::-1]
            water[by:by + blk.shape[0], bx:bx + blk.shape[1]] = blk[:min(64, H * T - by), :min(64, W * T - bx)]
    dist = ndimage.distance_transform_edt(~mask)
    al = np.clip(1 - dist / 10.0, 0, 1)[..., None]
    closed = closed * (1 - al) + water * al
    # RGBA, opaque only on the live cells (ENV_ASSETS.md §8: the engine draws whole live cells from it)
    rgba = np.zeros((H * T, W * T, 4), np.uint8)
    rgba[..., :3] = np.rint(np.clip(closed, 0, 255)).astype(np.uint8)
    rgba[..., 3] = np.where(mask, 255, 0).astype(np.uint8)
    rgba[~mask] = 0
    save_set(NAME + '_closed', rgba, True)
    meta['live'] = live
    meta['closedFiles'] = {t: '%s_closed@%d.png' % (NAME, t) for t in sizes}
json.dump(meta, open(os.path.join(outdir, NAME + '.json'), 'w'), indent=1)
Image.fromarray(base).save(os.path.join(outdir, '..', NAME + '_proc_last.png'))
print('ok', NAME, base.shape, 'live' if LIVE else '')
