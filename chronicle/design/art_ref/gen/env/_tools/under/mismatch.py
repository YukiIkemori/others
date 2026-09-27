import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
d = json.load(open(os.environ.get('MAPDUMP', 'before_data.json'))); rows, leg = d['rows'], d['legend']; W, H, T = 44, 36, 32
A = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
if A.shape[1] > 1408: A = np.asarray(Image.open(sys.argv[1]).convert('RGB').resize((1408, 1152), Image.BOX)).astype(float)
mat = np.array([[leg[rows[y][x]]['mat'] for x in range(W)] for y in range(H)])
solid_t = mat == 'tree'
K = np.ones((T, T), bool)
inner = ndimage.binary_erosion(np.kron(solid_t, K), iterations=20)
farg = ~ndimage.binary_dilation(np.kron(solid_t, K), iterations=40) & np.kron(mat == 'grass', K)
Q = (np.clip(A, 0, 255) // 16).astype(int); qi = Q[..., 0] * 256 + Q[..., 1] * 16 + Q[..., 2]
hc = np.bincount(qi[inner], minlength=4096) + 0.5; hg = np.bincount(qi[farg], minlength=4096) + 0.5
llr = np.log(hc / hc.sum()) - np.log(hg / hg.sum())
sc = ndimage.uniform_filter(llr[qi], 7) > 0.4
frac = sc.reshape(H, T, W, T).mean((1, 3))
for y in range(H):
    line = ''
    for x in range(W):
        t = solid_t[y, x]; f = frac[y, x]
        line += ('T' if f > 0.5 else 't') if t else ('!' if f > 0.5 else ('?' if f > 0.25 else '.'))
    print('%2d %s' % (y, line))
