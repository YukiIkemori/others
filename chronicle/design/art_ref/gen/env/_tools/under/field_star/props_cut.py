"""Cut ../../../props/star_b.png into the star set props (v2/assets/env/star/props/<id>__star@24/32/40.png + json):
waylamp__star (off/on, same canvas: the marble pillar star-lamp), signboard__star (stone post with a marble plaque),
lantern__star (the lit bronze star lantern), board__star (the notice board). Used by the star maps (map.propSet 'star').
Order on the sheet: 1 lamp off, 2 lamp on, 3 signpost, 4 lantern (unlit, not used), 5 notice board, 6 lantern lit."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import numpy as np
from proc import load, write_sprite_set
from proc_props import grouped, reading_order
raw = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'props', 'star_b.png'))
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
print(write_sprite_set(cans, 'star', 'props', 'waylamp__star', ['off', 'on'], (W, H), (W / 2, H - 1), dict(src, set='star', base='waylamp', light32=[0, -40]))['cell'])
for c, sid, h, ex in ((parts[2], 'signboard__star', 28, {}), (parts[5], 'lantern__star', 18, dict(light32=[0, -9])), (parts[4], 'board__star', 38, {})):
    a = crop(c); w = max(1, round(a.shape[1] * h / a.shape[0]))
    print(write_sprite_set([a], 'star', 'props', sid, ['default'], (w, h), (w / 2, h - 1), dict(src, set='star', base=sid[:-7], **ex))['cell'])
