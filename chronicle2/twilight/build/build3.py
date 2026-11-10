"""Stage the real map assets + map.json for the engine (run after build2.py)."""
from PIL import Image
import numpy as np, json, math, os, shutil
S = 'stage'; os.makedirs(S, exist_ok=True)
Image.open('map/out/map.png').save(f'{S}/map.webp', lossless=True, quality=100, method=6)
shutil.copy('map/out/walk.png', f'{S}/walk.png'); shutil.copy('map/out/height.png', f'{S}/height.png')
Image.open(f'{S}/sky.png').save(f'{S}/sky.webp', lossless=True, quality=100, method=6)
lan = [(540,1358,150),(765,1360,150),(575,993,135),(738,994,135),(585,843,140),(734,845,140),(984,613,120),(1065,617,120),(1122,823,125),(305,366,135)]
win = [(663,462,130,'#ffb866'),(528,477,80,'#ff9a5a'),(798,503,80,'#ff9a5a'),(478,768,85,'#ff9a5a'),(877,758,85,'#ff9a5a')]
lights = [dict(kind='lantern', x=x, y=y, gx=x, gy=y+46, r=r, color='#ffb060', intensity=1.0, flicker=0.16) for x,y,r in lan]
lights += [dict(kind='moon', layer='sky', x=460, y=100, r=210, color='#ffd9a0', intensity=0.45), dict(kind='moon', layer='sky', x=900, y=111, r=120, color='#b99cff', intensity=0.55)]
lights += [dict(kind='window', x=x, y=y, r=r, color=c, intensity=0.55, flicker=0.05) for x,y,r,c in win]
pond = [[round(307+63*math.cos(a)), round(773+30*math.sin(a))] for a in [i*math.pi/14 for i in range(28)]]
m = dict(
  title='鐘のならない修道院', titleEn='The Abbey of the Silent Bell', w=1280, h=1600, image='map.webp', walk='walk.png', height='height.png',
  spawn=dict(x=650, y=1572, dir='up'),
  occluders=[], lights=lights, water=[dict(poly=pond)],
  triggers=[
    dict(x=652, y=1262, r=44, title='崩れた門', text=['門柱に、古い文字が彫られている。', '「鐘が鳴らぬかぎり、夜は明けない」']),
    dict(x=663, y=612, r=40, title='祭壇', text=['埃をかぶった祭壇。', '燭台の蝋だけが、まだ新しい。……誰かが、ここへ通っている。']),
    dict(x=348, y=418, r=38, title='鐘楼の扉', text=['扉は内側から閉ざされている。', '見上げると、大きな鐘が黙ったまま月を映していた。']),
    dict(x=985, y=392, r=64, title='見晴らし台', text=['雲の海のうえに、月がふたつ。', '金の月が沈むとき、影の月が昇る。', '（Mキー、または左上の月のしるしで「月の刻」が替わります）']),
    dict(x=318, y=716, r=40, title='回廊の泉', text=['水面に、月がふたつ映っている。', '片方は、空にあるものより少し欠けて見えた。']),
    dict(x=590, y=1118, r=46, title='苔むした墓標', text=['名前は、もう読めない。', '花だけが、きのう手向けられたように白い。']),
  ],
  emitters=[
    dict(kind='leaves', x=120, y=520, w=190, h=170, n=12),
    dict(kind='leaves', x=470, y=640, w=60, h=120, n=3),
    dict(kind='fireflies', x=240, y=1000, w=820, h=230, n=18),
    dict(kind='fireflies', x=190, y=690, w=260, h=130, n=8),
    dict(kind='fireflies', x=880, y=640, w=220, h=260, n=6),
    dict(kind='motes', x=540, y=480, w=260, h=270, n=22),
    dict(kind='mist', x=0, y=0, w=1280, h=1600, n=6),
  ],
  layers=dict(sky=dict(src='sky.webp', parallax=[0.2, 0.5], y=0)),
)
if os.path.exists(f'{S}/fg.webp'):
    m['layers']['fg'] = json.load(open(f'{S}/fg.json'))
json.dump(m, open(f'{S}/map.json', 'w'), ensure_ascii=False, indent=1)
for f in sorted(os.listdir(S)): pass
reach = np.load('map/reach.npy'); ys, xs = np.where(reach)
for t in m['triggers']:
    d = float(np.hypot(xs - t['x'], ys - t['y']).min()); print(t['title'], round(d, 1), 'OK' if d < t['r'] - 8 else 'TOO FAR')
for f in []: print(f, os.path.getsize(f'{S}/{f}'))
