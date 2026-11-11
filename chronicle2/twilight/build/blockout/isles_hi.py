"""Cut a region of the isles map and make a 2x-finer map from it (data upscaled; picture given).
usage: mk2x.py SRC_SITE PAINT_2X.png OUTDIR [pts.npy]"""
import sys, json, numpy as np, cv2, os, shutil
from PIL import Image
sys.path.insert(0, '/home/user/others/chronicle2/twilight/build/blockout')
SRC, PAINT, OUT = sys.argv[1:4]; PTS = sys.argv[4] if len(sys.argv) > 4 else None
X0, Y0, CW, CH, K = 416, 990, 1088, 800, 2
W, H = CW * K, CH * K
os.makedirs(OUT, exist_ok=True)
def un16(p): a = np.array(Image.open(p).convert('RGB')).astype(np.int32); return a[..., 0] + 256 * a[..., 1]
def pk16(a): a = np.clip(a, 0, 65535).astype(np.uint32); o = np.zeros(a.shape + (3,), np.uint8); o[..., 0] = a & 255; o[..., 1] = a >> 8; return o
def crop(a): return a[Y0:Y0 + CH, X0:X0 + CW]
def up(a): return cv2.resize(a, (W, H), interpolation=cv2.INTER_NEAREST)
# displacement: data pixel (x,y) of the old picture appears in the new picture at (x+dx, y+dy)
if PTS:
    from warp import fit, inverse
    DX, DY, sy = fit(np.load(PTS), H, W); px, py = inverse(DX, DY)
    def wp(a): return cv2.remap(a, px, py, cv2.INTER_NEAREST, borderValue=0)
    def mv(x, y):
        xi, yi = int(np.clip(round(x), 0, W - 1)), int(np.clip(round(y), 0, H - 1)); return round(x + float(DX[yi, xi])), round(y + float(DY[yi, xi]))
else:
    def wp(a): return a
    def mv(x, y): return round(x), round(y)
for n in ['height', 'floor', 'under', 'behind']:
    a = up(crop(un16(f'{SRC}/{n}.png')).astype(np.float32)) * K
    Image.fromarray(pk16(np.round(wp(a)))).save(f'{OUT}/{n}.png')
for n in ['walk', 'raised']:
    a = up(crop(np.array(Image.open(f'{SRC}/{n}.png').convert('L'))))
    a = wp(a)
    if n == 'walk': a[:, :140] = 0; a[:, -140:] = 0; a[:24] = 0
    Image.fromarray(a).save(f'{OUT}/{n}.png')
# picture: magenta -> transparent
p = np.array(Image.open(PAINT).convert('RGB')).astype(np.int32)
key = (p[..., 0] > 180) & (p[..., 2] > 180) & (p[..., 1] < 110)
key = cv2.morphologyEx(key.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
# magenta fringe: strongly magenta-tinted dots right next to the sky go too
near = cv2.dilate(key.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
r_, g_, b_ = p[..., 0], p[..., 1], p[..., 2]
tint = (r_ - g_ > 70) & (b_ - g_ > 70) & (r_ > 120) & (b_ > 120)
key |= near & tint

rgba = np.dstack([p.astype(np.uint8), np.where(key, 0, 255).astype(np.uint8)])
Image.fromarray(rgba, 'RGBA').save(f'{OUT}/map.webp', lossless=True)
m = json.load(open(f'{SRC}/map.json'))
def inR(x, y, pad=0): return X0 - pad <= x < X0 + CW + pad and Y0 - pad <= y < Y0 + CH + pad
def tr(x, y): return mv((x - X0) * K, (y - Y0) * K)
m['w'], m['h'], m['view'] = W, H, K
m['title'] = '月光樹の浮き島（描き込み2倍の見本）'
m['heightBias'] = m.get('heightBias', 2) * K
sx, sy_ = tr(m['spawn']['x'], m['spawn']['y']); m['spawn'].update(x=sx, y=sy_)
L2 = []
for L in m['lights']:
    if L.get('layer') == 'sky': L2.append(L); continue
    if not inR(L['x'], L['y'], 60): continue
    L['x'], L['y'] = tr(L['x'], L['y'])
    if 'gx' in L: L['gx'], L['gy'] = tr(L['gx'], L['gy'])
    L['r'] = L.get('r', 160) * K; L2.append(L)
m['lights'] = L2
m['water'] = [{'poly': [list(tr(*q)) for q in w['poly']]} for w in m['water'] if any(inR(*q) for q in w['poly'])]
T2 = []
for t in m['triggers']:
    if not inR(t['x'], t['y']): continue
    t['x'], t['y'] = tr(t['x'], t['y']); t['r'] = round(t.get('r', 40) * 1.5)
    if 'pan' in t: t['pan'] = [v * K for v in t['pan']]
    T2.append(t)
for t in T2:
    if t['title'] == 'この版について':
        t['text'] = ['描き込みを2倍にした見本です。月光樹の浮き島のうち、石の環の島と船着きだけを切り出しています。',
                     '背景の絵を2倍の細かさで描き直し、キャラの大きさはそのままでカメラを引きました。\nキャラは画面の高さの7%ほどになります。',
                     'ぼかし、光のにじみ、舞う光の粒も強めています。\nShiftキーを押しながら動くと走ります。']
m['triggers'] = T2
m['hero'] = dict(m.get('hero', {}), speed=210, run=360)
E2 = []
for e in m['emitters']:
    x0, y0, x1, y1 = max(e['x'], X0), max(e['y'], Y0), min(e['x'] + e['w'], X0 + CW), min(e['y'] + e['h'], Y0 + CH)
    if x1 <= x0 or y1 <= y0: continue
    f = (x1 - x0) * (y1 - y0) / (e['w'] * e['h'])
    e['x'], e['y'] = (x0 - X0) * K, (y0 - Y0) * K; e['w'], e['h'] = (x1 - x0) * K, (y1 - y0) * K
    e['n'] = max(4, round(e['n'] * f * K * K * 0.8)); E2.append(e)
m['emitters'] = E2
m['hd'] = dict(m['hd'], S=m['hd']['S'] * K, cutSides=1, dofScale=1.3, range=10, band=.2, bloom=1.25, bloomTh=.55, bloomWide=1)
# more drifting light: pale motes over the whole field and warm sparks around the lanterns
m['emitters'].append(dict(kind='fireflies', x=140, y=40, w=W - 280, h=H - 120, n=150, color='#bcd8ff'))
for L in m['lights']:
    if L.get('kind') == 'lantern' and 'gx' in L: m['emitters'].append(dict(kind='fireflies', x=L['x'] - 60, y=L['y'] - 80, w=120, h=120, n=5, color='#ffc27a'))
m['layers']['sky'] = dict(m['layers']['sky'], scale=K)
json.dump(m, open(f'{OUT}/map.json', 'w'), ensure_ascii=False, indent=1)
print('spawn', m['spawn'], 'lights', len(L2), 'triggers', len(T2), 'emitters', len(E2))
