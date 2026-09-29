"""Cut ../../../../props/snow_b.png into the snow set props (v2/assets/env/snow/props/<id>__snow@24/32/40.png + json):
waylamp__snow (off/on, same canvas), tent__snow, lantern__snow. The set is used by the snow field areas (map.propSet 'snow')."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
import numpy as np
from proc import load, write_sprite_set
from proc_props import grouped, reading_order
raw = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'props', 'snow_b.png'))
rgba = load(raw, 'RGBA')
parts = reading_order(grouped(rgba, 4))
print('found', len(parts))
src = dict(src=os.path.relpath(raw, '/home/user/others/chronicle'))
def crop(c):
    x0, y0, x1, y1, m = c; a = rgba[y0:y1, x0:x1].copy(); a[..., 3] = np.where(m, a[..., 3], 0); return a
# the pair on one canvas (bottom-centre aligned, the scale of the first frame)
off, on = crop(parts[0]), crop(parts[1])
f = 52 / off.shape[0]
W = int(round(max(off.shape[1], on.shape[1]) * f)) + 2; H = int(round(max(off.shape[0], on.shape[0]) * f)) + 1
hw, hh = int(W / f), int(H / f)
cans = []
for c in (off, on):
    can = np.zeros((hh, hw, 4), np.float32); ox = (hw - c.shape[1]) // 2; oy = hh - c.shape[0]
    can[oy:oy + c.shape[0], ox:ox + c.shape[1]] = c; cans.append(can)
print(write_sprite_set(cans, 'snow', 'props', 'waylamp__snow', ['off', 'on'], (W, H), (W / 2, H - 1), dict(src, light32=[0, -40]))['cell'])
for c, sid, h, lt in ((parts[2], 'tent__snow', 46, None), (parts[3], 'lantern__snow', 14, [0, -6])):
    a = crop(c); w = max(1, round(a.shape[1] * h / a.shape[0]))
    ex = dict(src)
    if lt: ex['light32'] = lt
    print(write_sprite_set([a], 'snow', 'props', sid, ['default'], (w, h), (w / 2, h - 1), ex)['cell'])
