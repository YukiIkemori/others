"""Painted desert dungeon underlay: generation -> 1x map image (tile 32) + @24 (+ @40 when it fits 2048) + meta.
usage: python3 process.py <map> <src.png> <outdir>
env: WARP = warp.json from warp2.py ({rows, cols}: painted 1x coordinate for each guide 1x coordinate); GAIN = brightness gain override
     PATCH = [[x0, y0, x1, y1, sx, sy], ...] 1x px: copy the rectangle at (sx, sy) over (x0, y0)-(x1, y1) (erase a stray painted mark)"""
import sys, json, os, numpy as np
from PIL import Image
m, src, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(outdir, exist_ok=True)
NAME = m.replace('desert_', 'd_') if False else m
d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'], d['h']; T = 32
from scipy import ndimage
S = Image.open(src).convert('RGB')
P1 = np.asarray(S.resize((W * T, H * T), Image.BOX)).astype(np.float32)
YY, XX = np.mgrid[0:H * T, 0:W * T].astype(np.float32)
if os.environ.get('FLOW'):   # flow.py field (defined in the coarse-warped space)
    f = np.load(os.environ['FLOW']); st = float(f['ys'][1] - f['ys'][0]); o0 = float(f['ys'][0])
    cy, cx = (YY - o0) / st, (XX - o0) / st
    fdx = ndimage.map_coordinates(f['dx'], [cy, cx], order=1, mode='nearest'); fdy = ndimage.map_coordinates(f['dy'], [cy, cx], order=1, mode='nearest')
    YY, XX = YY + fdy, XX + fdx
if os.environ.get('WARP'):
    wj = json.load(open(os.environ['WARP']))
    YY = np.interp(YY, np.arange(len(wj['rows'])), wj['rows']).astype(np.float32); XX = np.interp(XX, np.arange(len(wj['cols'])), wj['cols']).astype(np.float32)
A = np.stack([ndimage.map_coordinates(P1[..., c], [YY, XX], order=1, mode='nearest') for c in range(3)], -1)
for x0, y0, x1, y1, sx, sy in json.loads(os.environ.get('PATCH', '[]')):
    A[y0:y1, x0:x1] = A[sy:sy + (y1 - y0), sx:sx + (x1 - x0)]
old = np.asarray(Image.open('maps/%s/layout_albedo.png' % m).convert('RGB')).astype(np.float32)
lum = lambda v: v @ np.array([0.299, 0.587, 0.114], np.float32)
walk = np.array([[c == '.' for c in r] for r in d['walk']])
mk = np.kron(walk, np.ones((T, T), bool))
gain = float(np.clip(lum(old[mk]).mean() / lum(A[mk]).mean(), 0.75, 1.05))
gain = float(os.environ.get('GAIN', gain))
A = np.clip(A * gain, 0, 255)
print(m, 'gain', round(gain, 3))
base = np.rint(A).astype(np.uint8)
im = Image.fromarray(base)
im.save(os.path.join(outdir, m + '@32.png'), optimize=True)
im.resize((W * 24, H * 24), Image.LANCZOS).save(os.path.join(outdir, m + '@24.png'), optimize=True)
files = {24: m + '@24.png', 32: m + '@32.png'}
if W * 40 <= 2048 and H * 40 <= 2048:
    im.resize((W * 40, H * 40), Image.NEAREST).save(os.path.join(outdir, m + '@40.png'), optimize=True); files[40] = m + '@40.png'
json.dump(dict(id=m, kind='under', map=m, tile=32, size32=[W * T, H * T], windows32=[], painted=[], files=files), open(os.path.join(outdir, m + '.json'), 'w'), indent=1)
