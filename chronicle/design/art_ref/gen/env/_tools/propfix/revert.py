"""Undo one painted prop after review: copy the untouched painting back around it (all tile sizes, feathered) and move it to 'kept' (it stays a sprite).
usage: python3 revert.py <map> <id> <x> <y> [...more id x y]"""
import sys, json, os
import numpy as np
from PIL import Image, ImageFilter
import lib, apply
HERE = os.path.dirname(os.path.abspath(__file__))
mid = sys.argv[1]; args = sys.argv[2:]
rec = os.path.join(HERE, 'applied.json'); A = json.load(open(rec))
img = lib.MAPS[mid]['art']['image']
for j in range(0, len(args), 3):
    pid, x, y = args[j], int(args[j + 1]), int(args[j + 2])
    o = next(o for o in lib.MAPS[mid]['objects'] if o['type'] == 'prop' and o['id'] == pid and o['x'] == x and o['y'] == y)
    for T in apply.sizes(mid):
        f = '%s/%s@%d.png' % (lib.ENV, img, T); cur = Image.open(f); mode = cur.mode; cur = np.asarray(cur.convert('RGBA')).astype(np.float32)
        org = np.asarray(Image.open(os.path.join(HERE, 'work/orig/%s@%d.png' % (mid, T))).convert('RGBA')).astype(np.float32)
        b = apply.prop_box(dict(o, v=o.get('variant', 0) or 0), T); m = np.zeros(cur.shape[:2], np.float32)
        mg = round(8 * T / 32); m[max(0, int(b[1]) - mg):int(b[3]) + mg + 3, max(0, int(b[0]) - mg):int(b[2]) + mg + 2] = 1
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3 * T / 32))).astype(np.float32)[..., None] / 255
        m = np.minimum(m * 1.6, 1)
        cur[..., :3] = cur[..., :3] * (1 - m) + org[..., :3] * m
        Image.fromarray(np.clip(cur + 0.5, 0, 255).astype(np.uint8), 'RGBA').convert(mode).save(f, optimize=True)
    for k, v in A.items():
        if k.rsplit('_w', 1)[0] == mid and [pid, x, y] in v['painted']:
            v['painted'].remove([pid, x, y]); v['kept'].append([pid, x, y]); v.setdefault('reverted', []).append([pid, x, y])
    print('reverted', mid, pid, x, y)
json.dump(A, open(rec, 'w'), indent=1)
