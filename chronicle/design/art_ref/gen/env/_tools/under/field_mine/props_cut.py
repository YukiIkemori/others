"""Cut ../../../props/mine_b.png into the mine set props (v2/assets/env/mine/props/<id>__mine@24/32/40.png + json):
waylamp__mine (off/on, same canvas: the timber post with a miner's cage lantern), signboard__mine (timber post with a plank),
lantern__mine (the lit iron miner's lantern), board__mine (the mining town's notice board). Used by the mine maps (map.propSet 'mine').
Order on the sheet: 1 lamp off, 2 lamp on, 3 signpost, 4 lantern (unlit, not used), 5 notice board, 6 lantern lit."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import numpy as np
from proc import load, write_sprite_set
from proc_props import grouped, reading_order
raw = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'props', 'mine_b.png'))
rgba = load(raw, 'RGBA')
parts = reading_order(grouped(rgba, 6))
print('found', len(parts), [(p[2] - p[0], p[3] - p[1]) for p in parts])
src = dict(src=os.path.relpath(raw, '/home/user/others/chronicle'))
def crop(c):
    x0, y0, x1, y1, m = c; a = rgba[y0:y1, x0:x1].copy(); a[..., 3] = np.where(m, a[..., 3], 0); return a
off, on = crop(parts[0]), crop(parts[1])
f = 52 / off.shape[0]
W = int(round(max(off.shape[1], on.shape[1]) * f)) + 2; H = int(round(max(off.shape[0], on.shape[0]) * f)) + 1
hw, hh = int(W / f), int(H / f)
cans = []
for c in (off, on):
    can = np.zeros((hh, hw, 4), np.float32); ox = (hw - c.shape[1]) // 2; oy = hh - c.shape[0]
    can[oy:oy + c.shape[0], ox:ox + c.shape[1]] = c; cans.append(can)
# 灯りの芯: 書き出した 32 px の灯った絵の、明るい黄の画素の重心（足もとから。下で書き直す）
lx, ly = 0, -40
print(write_sprite_set(cans, 'mine', 'props', 'waylamp__mine', ['off', 'on'], (W, H), (W / 2, H - 1), dict(src, set='mine', base='waylamp', light32=[round(lx), round(ly)]))['cell'])
import json as _json
_d = os.path.join('/home/user/others/chronicle/v2/assets/env/mine/props/')
_j = _json.load(open(_d + 'waylamp__mine.json')); _w = _j['cell']['32'][0]
_on = np.asarray(__import__('PIL.Image', fromlist=['Image']).open(_d + 'waylamp__mine@32.png').convert('RGBA')).astype(int)[:, _w:2 * _w]
_m = (_on[..., 0] > 220) & (_on[..., 1] > 150) & (_on[..., 3] > 0); _ys, _xs = np.nonzero(_m)
if len(_xs): lx, ly = _xs.mean() - _j['feet']['32'][0], _ys.mean() - _j['feet']['32'][1]
_j['light32'] = [round(lx), round(ly)]; _json.dump(_j, open(_d + 'waylamp__mine.json', 'w'), indent=1)
print('light', _j['light32'])
# しょく台（暗がりで火をともす物）も同じ坑夫のカンテラの柱（少し小さく）
g2 = 42 / 52; W2, H2 = int(round(W * g2)), int(round(H * g2))
print(write_sprite_set(cans, 'mine', 'props', 'brazier__mine', ['off', 'on'], (W2, H2), (W2 / 2, H2 - 1), dict(src, set='mine', base='brazier', light32=[round(lx * g2), round(ly * g2)]))['cell'])
for c, sid, h, ex in ((parts[2], 'signboard__mine', 28, {}), (parts[5], 'lantern__mine', 18, dict(light32=[0, -9])), (parts[4], 'board__mine', 38, {})):
    a = crop(c); w = max(1, round(a.shape[1] * h / a.shape[0]))
    print(write_sprite_set([a], 'mine', 'props', sid, ['default'], (w, h), (w / 2, h - 1), dict(src, set='mine', base=sid.split('__')[0], **ex))['cell'])
