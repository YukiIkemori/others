"""Piecewise-linear warp from hand-measured guide->painted points (1x px). usage: python3 mkwarp.py <map> '<rows [[g,p],..]>' '<cols [[g,p],..]>' <out.json>"""
import sys, json, numpy as np
m = sys.argv[1]; d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'] * 32, d['h'] * 32
def f(pts, n):
    pts = sorted([[0, 0]] + json.loads(pts) + [[n - 1, n - 1]]); g, p = zip(*pts); return np.interp(np.arange(n), g, p).tolist()
json.dump({'rows': f(sys.argv[2], H), 'cols': f(sys.argv[3], W)}, open(sys.argv[4], 'w'))
