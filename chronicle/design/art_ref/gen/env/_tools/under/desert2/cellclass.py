"""ascii per-cell class of an aligned outdoor painting: '#' rock top (dark), 'f' face (mid, low sat), '~' dune (saturated orange), '.' sand/clay (bright). next to the data row.
usage: python3 cellclass.py <map> <aligned.png>"""
import sys, json, numpy as np
from PIL import Image
m, src = sys.argv[1], sys.argv[2]
d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'], d['h']; T = 32
A = np.asarray(Image.open(src).convert('RGB')).astype(float)
l = A @ np.array([0.299, 0.587, 0.114]); mx, mn = A.max(-1), A.min(-1); sat = (mx - mn) / np.maximum(mx, 1)
def cls(x, y):
    L = l[y*T:(y+1)*T, x*T:(x+1)*T].mean(); S = sat[y*T:(y+1)*T, x*T:(x+1)*T].mean()
    if L < 118: return '#'
    if S > 0.62: return '~'
    if L < 150: return 'f'
    return '.'
for y in range(H): print('%2d %s   %s' % (y, ''.join(cls(x, y) for x in range(W)), d['rows'][y]))
