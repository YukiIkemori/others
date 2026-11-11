"""Puts the repainted floating-island map and the baked 3D data together as a playable map.
usage: isles_stage.py bake_dir paint_1x.png pts.npy stage_dir
The bake dir may be a cropped copy of the bake (the painter stretched this map by 3 % and lost the lowest rows)."""
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
far = [n for n in ('behind', 'under') if os.path.exists(f'{OUT}/{n}.png')]          # what lies behind near things (HD-2D view), see vox.py
for n in far: Image.fromarray(pack(np.round(cv2.remap(unpack(f'{OUT}/{n}.png').astype(np.float32), px, py, cv2.INTER_NEAREST, borderValue=0) * sy).astype(np.uint16))).save(f'{STAGE}/{n}.png')
standing = cv2.remap(np.load(f'{OUT}/standing.npy').astype(np.uint8), px, py, cv2.INTER_NEAREST, borderValue=0) > 0
solid3d = hh > 0
Image.fromarray(walk).save(f'{STAGE}/walk.png'); Image.fromarray(pack(hh)).save(f'{STAGE}/height.png'); Image.fromarray(pack(ff)).save(f'{STAGE}/floor.png')
np.save(f'{STAGE}/standing_paint.npy', standing)
Image.fromarray(standing.astype(np.uint8) * 255).save(f'{STAGE}/st_paint.png')      # for registering the image model's mask (check.py)
# ---- picture: the sky is cut where the painter kept the magenta key (large areas only); stray key pixels are repaired
rgb = np.array(Image.open(PAINT).convert('RGB')); r, g, b = [rgb[..., i].astype(int) for i in range(3)]
key = (r > 150) & (b > 150) & (g < 115) & (np.abs(r - b) < 80)
lab, n = ndi.label(key); big = np.zeros(n + 1, bool); big[1:] = ndi.sum(key, lab, np.arange(1, n + 1)) >= 600
sky = big[lab]
sky = ndi.binary_dilation(sky, iterations=1)
pink = (np.minimum(r, b) - g > 45) & (r > 110) & (b > 110) & ndi.binary_dilation(sky, iterations=4) & ~sky
bad = pink | (key & ~sky)
idx = ndi.distance_transform_edt(bad | sky, return_distances=False, return_indices=True)
fix = rgb[idx[0], idx[1]]; rgb2 = rgb.copy(); rgb2[bad] = (fix[bad] * 0.8).astype(np.uint8)
rgba = np.dstack([rgb2, np.where(sky, 0, 255).astype(np.uint8)])
Image.fromarray(rgba).save(f'{STAGE}/map.webp', lossless=True, quality=90, method=4)
lost = (walk > 127) & ndi.binary_dilation(sky, iterations=2)          # the painter drew the north rims a few dots smaller: nobody may stand on sky
walk[lost] = 0; ff[lost] = 0
Image.fromarray(walk).save(f'{STAGE}/walk.png'); Image.fromarray(pack(ff)).save(f'{STAGE}/floor.png')
print('sky agreement with the 3D outline: %.1f %% of pixels' % (100 * (sky == ~solid3d).mean()))
print('walkable ground that the painter left as sky (made unwalkable): %d px' % int(lost.sum()))
# ---- places
def mv(p):
    x, y = float(p[0]), float(p[1]); xi, yi = int(np.clip(round(x), 0, W - 1)), int(np.clip(round(y), 0, H - 1))
    return [round(x + float(DX[yi, xi])), round(y + float(DY[yi, xi]))]
mk = info['marks']; sp = mv(info['spawn']); sp[1] -= 96          # room behind the leader for the three companions
lights = []
for L in info['lights']:
    p, gp = mv(L['p']), mv(L['g'])
    lights.append(dict(kind='lantern', x=p[0], y=p[1], gx=gp[0], gy=gp[1], r=L['r'], color='#ffb060', intensity=.9, flicker=.16))
for nm, v in mk.items():                                    # glowing things: crystals, the moon tree, rune circles, the moon gate
    if 'light' not in v: continue
    p, gp = mv(v['air']), mv(v['p']); L = v['light']
    lights.append(dict(kind='glow', x=p[0], y=p[1], gx=gp[0], gy=gp[1], r=L['r'], color=L['color'], intensity=L['intensity'], flicker=.04))
base = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../site/map.json')))
lights += [L for L in base['lights'] if L.get('layer') == 'sky' or L.get('kind') == 'moon']
T = lambda nm, r, text, title=None: dict(x=mv(mk[nm]['p'])[0], y=mv(mk[nm]['p'])[1], r=r, title=title or mk[nm]['title'], text=text)
triggers = [
    T('about', 44, ['雲海に浮かぶ島々の試作です。前の崖の修道院より、ひとまわり大きくしました。', '作り方は同じで、先に3Dの骨組みで地形と当たり判定を作り、\nその絵をAIが塗っています。', 'Shiftキーを押しながら動くと走ります。\n仲間の3人は、うしろをついてきます。']),
    T('circle', 46, ['足もとの紋が、歩くたびにかすかに脈を打つ。', '石柱の文字は、どれも月の満ち欠けを数えているらしい。']),
    T('pool', 44, ['水鏡。のぞきこむと、空にはない三つめの月が映っている。', '……顔を上げると、もう消えていた。']),
    T('shard', 40, ['台座の結晶に触れると、指先が冷たく、音がひとつ鳴った。', '島を浮かせているのは、この石の歌だという。']),
    T('altar', 46, ['月光樹の祭壇。根もとに、だれかの古い祈りが刻まれている。', '「金の月が沈むとき、影の月が昇る。\n　樹はそのどちらも、葉にためておく」', '（Mキー、または左上の月のしるしで「月の刻」が替わります）']),
    T('gate', 48, ['月の門。輪の向こうには、まだ何も見えない。', '門がひらくのは、ふたつの月が重なる夜だけだという。']),
    T('spring', 40, ['泉の水は、縁からこぼれて雲の海へ落ちていく。', 'どこから湧いているのかは、だれも知らない。']),
]
def box(nm, w_, h_, kind, n, **kw): p = mv(mk[nm]['p']); return dict(kind=kind, x=p[0] - w_ // 2, y=p[1] - h_ // 2, w=w_, h=h_, n=n, **kw)
MOON, CRY, VIO = '#cfeaff', '#7fe9ff', '#cbb9ff'
emitters = [box('fx_tree', 760, 420, 'fireflies', 30, color=MOON), box('fx_tree', 520, 360, 'motes', 34),
            box('fx_circle', 420, 300, 'fireflies', 14, color=MOON), box('fx_d', 420, 300, 'fireflies', 14, color=CRY),
            box('fx_g', 420, 280, 'fireflies', 12, color=CRY), box('fx_f', 400, 300, 'fireflies', 12, color=VIO),
            box('fx_c', 420, 280, 'fireflies', 12, color=MOON), box('about', 360, 220, 'fireflies', 8, color=MOON),
            dict(kind='mist', x=0, y=0, w=W, h=H, n=9)]
skyL = dict(base['layers']['sky']); skyL['parallax'] = [0.2, 0.42]       # the map is taller than the sky picture can follow at 0.5
m = dict(title='月光樹の浮き島', titleEn='Isles of the Moonlit Tree', w=W, h=H, image='map.webp', walk='walk.png', height='height.png', floor='floor.png',
         heightBias=3, spawn=dict(x=sp[0], y=sp[1], dir='up'), occluders=[], lights=lights,
         water=[dict(poly=[mv(q) for q in mk[nm]['poly']]) for nm in ('pond_c', 'pond_g')],
         triggers=triggers, emitters=emitters, layers=dict(sky=skyL),
         hero=dict(sheet='party/hero.png', spec='party/hero.json'), party=['party/sword', 'party/rogue', 'party/priest'],
         # HD-2D view (site/hd.js): the picture laid over the relief that height.png describes; raised.png comes from check.py
         hd=dict(S=info.get('S', 32), A=info.get('A', .75), B=info.get('B', .66), depth=3, dof=2, fogTop=8.0, fogBottom=1.0, raised='raised.png', **{n: n + '.png' for n in far}))
json.dump(m, open(f'{STAGE}/map.json', 'w'), ensure_ascii=False, indent=1)
print('spawn', m['spawn'], 'walkable there', bool(walk[sp[1], sp[0]]), 'lights', len(lights))
for t in triggers: print(' ', t['title'], (t['x'], t['y']), 'on walkable', bool(walk[t['y'], t['x']]))
