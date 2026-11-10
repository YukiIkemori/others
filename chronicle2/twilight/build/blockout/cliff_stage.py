"""Puts the repainted cliff map and the baked 3D data together as a playable map.
usage: cliff_stage.py bake_dir paint_1x.png pts.npy stage_dir"""
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
walk = cv2.remap(np.array(Image.open(f'{OUT}/walk.png').convert('L')), px, py, cv2.INTER_NEAREST, borderValue=0)
hh = np.round(cv2.remap(unpack(f'{OUT}/height.png').astype(np.float32), px, py, cv2.INTER_NEAREST, borderValue=0) * sy).astype(np.uint16)
ff = np.round(cv2.remap(unpack(f'{OUT}/floor.png').astype(np.float32), px, py, cv2.INTER_NEAREST, borderValue=0) * sy).astype(np.uint16)
ff[walk == 0] = 0
standing = cv2.remap(np.load(f'{OUT}/standing.npy').astype(np.uint8), px, py, cv2.INTER_NEAREST, borderValue=0) > 0
solid3d = hh > 0
Image.fromarray(walk).save(f'{STAGE}/walk.png'); Image.fromarray(pack(hh)).save(f'{STAGE}/height.png'); Image.fromarray(pack(ff)).save(f'{STAGE}/floor.png')
np.save(f'{STAGE}/standing_paint.npy', standing)
# ---- picture: the sky is cut where the painter kept the magenta key (large areas only); stray key pixels are repaired
rgb = np.array(Image.open(PAINT).convert('RGB')); r, g, b = [rgb[..., i].astype(int) for i in range(3)]
key = (r > 150) & (b > 150) & (g < 115) & (np.abs(r - b) < 80)
lab, n = ndi.label(key); big = np.zeros(n + 1, bool); big[1:] = ndi.sum(key, lab, np.arange(1, n + 1)) >= 1500
sky = big[lab]
sky = ndi.binary_dilation(sky, iterations=1)
pink = (np.minimum(r, b) - g > 45) & (r > 110) & (b > 110) & ndi.binary_dilation(sky, iterations=4) & ~sky
bad = pink | (key & ~sky)
idx = ndi.distance_transform_edt(bad | sky, return_distances=False, return_indices=True)
fix = rgb[idx[0], idx[1]]; rgb2 = rgb.copy(); rgb2[bad] = (fix[bad] * 0.8).astype(np.uint8)
rgba = np.dstack([rgb2, np.where(sky, 0, 255).astype(np.uint8)])
Image.fromarray(rgba).save(f'{STAGE}/map.webp', lossless=True, quality=90, method=4)
print('sky agreement with the 3D outline: %.1f %% of pixels' % (100 * (sky == ~solid3d).mean()))
# ---- places
def mv(p):
    x, y = float(p[0]), float(p[1]); xi, yi = int(np.clip(round(x), 0, W - 1)), int(np.clip(round(y), 0, H - 1))
    return [round(x + float(DX[yi, xi])), round(y + float(DY[yi, xi]))]
mk = info['marks']; sp = mv(info['spawn'])
lights = []
for L in info['lights']:
    p, gp = mv(L['p']), mv(L['g'])
    lights.append(dict(kind='lantern', x=p[0], y=p[1], gx=gp[0], gy=gp[1], r=L['r'], color='#ffb060', intensity=1.0, flicker=.16))
for nm, rr in (('win_c', 95), ('win_l', 70), ('win_r', 70)):
    p = mv(mk[nm]['air']); lights.append(dict(kind='window', x=p[0], y=p[1], r=rr, color='#ff9a5a', intensity=.55, flicker=.05))
base = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../site/map.json')))
lights += [L for L in base['lights'] if L.get('layer') == 'sky' or L.get('kind') == 'moon']
T = lambda nm, r, text, title=None: dict(x=mv(mk[nm]['p'])[0], y=mv(mk[nm]['p'])[1], r=r, title=title or mk[nm]['title'], text=text)
triggers = [
    T('about', 44, ['この版は「先に3Dの骨組みで地形と当たり判定を作り、\nその絵をAIが塗る」方式の試作です。', '当たり判定と物の前後関係は、絵からの推定ではなく\n骨組みからそのまま出しています。', 'Cキーで、入れない場所が赤く表示されます。']),
    T('altar', 40, ['埃をかぶった祭壇。', '燭台の蝋だけが、まだ新しい。……誰かが、ここへ通っている。']),
    T('tower', 38, ['扉は内側から閉ざされている。', '見上げると、大きな鐘が黙ったまま月を映していた。']),
    T('lookout', 64, ['雲の海のうえに、月がふたつ。', '金の月が沈むとき、影の月が昇る。', '（Mキー、または左上の月のしるしで「月の刻」が替わります）'], '見晴らし台'),
]
def box(nm, w_, h_, kind, n): p = mv(mk[nm]['p']); return dict(kind=kind, x=p[0] - w_ // 2, y=p[1] - h_ // 2, w=w_, h=h_, n=n)
emitters = [box('maple', 240, 200, 'leaves', 12), box('graves', 900, 230, 'fireflies', 18), box('pond', 280, 150, 'fireflies', 8),
            box('nave', 300, 280, 'motes', 22), dict(kind='mist', x=0, y=0, w=W, h=H, n=6)]
m = dict(title='鐘のならない修道院', titleEn='Blockout first, painted after', w=W, h=H, image='map.webp', walk='walk.png', height='height.png', floor='floor.png',
         heightBias=3, spawn=dict(x=sp[0], y=sp[1], dir='up'), occluders=[], lights=lights, water=[dict(poly=[mv(q) for q in mk['pond']['poly']])],
         triggers=triggers, emitters=emitters, layers=dict(sky=base['layers']['sky']),
         # HD-2D view (site/hd.js): the picture laid over the relief that height.png describes; raised.png comes from check.py
         hd=dict(S=info.get('S', 32), A=info.get('A', .75), B=info.get('B', .66), depth=2, dof=1, fogTop=7.6, fogBottom=1.0, raised='raised.png'))
json.dump(m, open(f'{STAGE}/map.json', 'w'), ensure_ascii=False, indent=1)
print('spawn', m['spawn'], 'walkable there', bool(walk[sp[1], sp[0]]), 'lights', len(lights))
