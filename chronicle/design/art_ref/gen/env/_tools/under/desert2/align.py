"""Align a painted desert dungeon generation onto the tile grid -> 1x image (tile 32), no brightness change (process_dg.py does the rest).
usage: python3 align.py <map> <src.png> <out.png>
env: WARP = warp.json from warp2.py ({rows, cols}: painted 1x coordinate for each guide 1x coordinate); GAIN = brightness gain override
     PATCH = [[x0, y0, x1, y1, sx, sy], ...] 1x px: copy the rectangle at (sx, sy) over (x0, y0)-(x1, y1) (erase a stray painted mark)"""
import sys, json, os, numpy as np
from PIL import Image
m, src, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
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
Image.fromarray(np.clip(np.rint(A), 0, 255).astype(np.uint8)).save(outdir)
print(m, 'aligned ->', outdir)
