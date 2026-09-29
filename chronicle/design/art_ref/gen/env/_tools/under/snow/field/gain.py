"""Brightness gain for a snow field painting: the bright snow luminance (85th percentile over its open snow cells ',;"')
-> that of the painted Yule (85th percentile of the whole underlay, which is mostly snow), so the night light holds the same on both. usage: python3 gain.py <id> <gen.png>  -> prints the gain"""
import sys, json, numpy as np
from PIL import Image
aid, src = sys.argv[1], sys.argv[2]
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
rows = d.get('rows_fit') or d['rows']
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(np.float32)
lum = A @ np.array([0.299, 0.587, 0.114], np.float32)
m = np.kron(np.isin(np.array([list(r) for r in rows]), list(',;"')), np.ones((T, T), bool))
Y = np.asarray(Image.open('/home/user/others/chronicle/v2/assets/env/snow/under/yule@32.png').convert('RGB')).astype(np.float32)
ty = np.percentile(Y @ np.array([0.299, 0.587, 0.114], np.float32), 85)
print(round(float(np.clip(ty / np.percentile(lum[m], 85), 0.7, 1.15)), 3))
