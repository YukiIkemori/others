"""Generic staging: puts a repainted map and its baked 3D data together (any blockout-first map).
usage: stage.py bake_dir paint_1x.png pts.npy stage_dir
Writes map.webp, walk.png, height.png, floor.png, behind.png, under.png, st_paint.png, standing_paint.npy and places.json
(every mark and light of the world file, moved onto the painting).  The game data (map.json) is written from places.json
by the game's own build script, so the content can change without staging again."""
import sys, os, json, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from warp import fit, inverse
OUT, PAINT, PTS, STAGE = sys.argv[1:5]
os.makedirs(STAGE, exist_ok=True)
info = json.load(open(f'{OUT}/info.json')); W, H = info['w'], info['h']
DX, DY, sy = fit(np.load(PTS), H, W)
px, py = inverse(DX, DY)
def unpack(p): a = np.array(Image.open(p).convert('RGB')).astype(np.uint16); return a[..., 0] + 256 * a[..., 1]
def pack(a): p = np.zeros((H, W, 3), np.uint8); p[..., 0] = a & 255; p[..., 1] = a >> 8; return p
remap = lambda a: cv2.remap(a, px, py, cv2.INTER_NEAREST, borderMode=cv2.BORDER_REPLICATE)
walk = remap(np.array(Image.open(f'{OUT}/walk.png').convert('L')))
hh = np.round(remap(unpack(f'{OUT}/height.png').astype(np.float32)) * sy).astype(np.uint16)
ff = np.round(remap(unpack(f'{OUT}/floor.png').astype(np.float32)) * sy).astype(np.uint16)
ff[walk == 0] = 0
far = [n for n in ('behind', 'under') if os.path.exists(f'{OUT}/{n}.png')]
for n in far: Image.fromarray(pack(np.round(remap(unpack(f'{OUT}/{n}.png').astype(np.float32)) * sy).astype(np.uint16))).save(f'{STAGE}/{n}.png')
standing = remap(np.load(f'{OUT}/standing.npy').astype(np.uint8)) > 0
np.save(f'{STAGE}/standing_paint.npy', standing)
Image.fromarray(standing.astype(np.uint8) * 255).save(f'{STAGE}/st_paint.png')
# ---- picture: sky is cut where the painter kept the magenta key (maps without sky have none)
rgb = np.array(Image.open(PAINT).convert('RGB')); r, g, b = [rgb[..., i].astype(int) for i in range(3)]
key = (r > 150) & (b > 150) & (g < 115) & (np.abs(r - b) < 80)
lab, n = ndi.label(key); big = np.zeros(n + 1, bool); big[1:] = ndi.sum(key, lab, np.arange(1, n + 1)) >= 600
sky = big[lab]
if sky.any():
    sky = ndi.binary_dilation(sky, iterations=1)
    pink = (np.minimum(r, b) - g > 45) & (r > 110) & (b > 110) & ndi.binary_dilation(sky, iterations=4) & ~sky
    bad = pink | (key & ~sky)
    idx = ndi.distance_transform_edt(bad | sky, return_distances=False, return_indices=True)
    fix = rgb[idx[0], idx[1]]; rgb[bad] = (fix[bad] * 0.8).astype(np.uint8)
    lost = (walk > 127) & ndi.binary_dilation(sky, iterations=2); walk[lost] = 0; ff[lost] = 0
    print('walkable ground that the painter left as sky (made unwalkable): %d px' % int(lost.sum()))
rgba = np.dstack([rgb, np.where(sky, 0, 255).astype(np.uint8)])
Image.fromarray(rgba).save(f'{STAGE}/map.webp', lossless=True, quality=90, method=4)
Image.fromarray(walk).save(f'{STAGE}/walk.png'); Image.fromarray(pack(hh)).save(f'{STAGE}/height.png'); Image.fromarray(pack(ff)).save(f'{STAGE}/floor.png')
# ---- places
def mv(p):
    x, y = float(p[0]), float(p[1]); xi, yi = int(np.clip(round(x), 0, W - 1)), int(np.clip(round(y), 0, H - 1))
    return [int(round(x + float(DX[yi, xi]))), int(round(y + float(DY[yi, xi])))]
marks = {}
for nm, v in info['marks'].items():
    q = dict(v); q['p'] = mv(v['p']); q['air'] = mv(v['air'])
    if 'poly' in v: q['poly'] = [mv(c) for c in v['poly']]
    q['walkable'] = bool(walk[np.clip(q['p'][1], 0, H - 1), np.clip(q['p'][0], 0, W - 1)] > 127)
    marks[nm] = q
lights = [dict(p=mv(L['p']), g=mv(L['g']), r=L['r']) for L in info['lights']]
json.dump(dict(w=W, h=H, S=info.get('S', 32), A=info.get('A', .75), B=info.get('B', .66), sy=float(sy), spawn=mv(info['spawn']), marks=marks, lights=lights, far=far, sky=bool(sky.any())),
          open(f'{STAGE}/places.json', 'w'), ensure_ascii=False, indent=1)
bad = [nm for nm, q in marks.items() if q.get('on_ground') and not q['walkable'] and not nm.startswith(('win', 'fx_', 'door_', 'chest_'))]
print('staged', W, H, 'marks', len(marks), 'not on walkable ground:', bad)
