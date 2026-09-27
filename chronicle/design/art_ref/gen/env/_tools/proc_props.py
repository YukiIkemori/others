"""Cut a generated prop sheet into prop sprites.  spec: list of [id, target_h32 or ('w', target_w32), frames?] in reading order."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from proc import *

def grouped(rgba, n, min_area=30):
    """connected parts (alpha>100) merged greedily by bbox gap until n groups remain -> [(x0,y0,x1,y1,mask_full)]"""
    m = rgba[..., 3] > 100
    lab, k = ndimage.label(m)
    objs = ndimage.find_objects(lab)
    G = []
    for i, sl in enumerate(objs):
        area = (lab[sl] == i + 1).sum()
        if area < min_area: continue
        G.append([sl[1].start, sl[0].start, sl[1].stop, sl[0].stop, [i + 1], area])
    def gap(a, b):
        dx = max(0, max(a[0], b[0]) - min(a[2], b[2])); dy = max(0, max(a[1], b[1]) - min(a[3], b[3]))
        return (dx * dx + dy * dy) ** 0.5 / (1 + min(a[5], b[5]) ** 0.25)
    while len(G) > n:
        best = None
        for i in range(len(G)):
            for j in range(i + 1, len(G)):
                gg = gap(G[i], G[j])
                if best is None or gg < best[0]: best = (gg, i, j)
        _, i, j = best
        a, b = G[i], G[j]
        G[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]), a[4] + b[4], a[5] + b[5]]
        del G[j]
    out = []
    for g in G:
        msk = np.isin(lab[g[1]:g[3], g[0]:g[2]], g[4])
        out.append((g[0], g[1], g[2], g[3], msk))
    return out

def reading_order(comps):
    comps = sorted(comps, key=lambda c: (c[1] + c[3]) / 2)
    rows = []
    for c in comps:
        cy = (c[1] + c[3]) / 2
        if rows and abs(cy - rows[-1][0]) < max(40, (rows[-1][2]) * 0.45):
            rows[-1][1].append(c)
        else:
            rows.append([cy, [c], c[3] - c[1]])
    return [c for r in rows for c in sorted(r[1], key=lambda c: c[0])]

def cut_sheet(raw, theme, spec, key_magenta=False, merge=10, min_area=400, order='rows', debug=None, sub='props', lightmap=None):
    rgba = load(raw, 'RGBA')
    if key_magenta or rgba[..., 3].min() > 250:
        rgba = key_bg(rgba)
    comps = [(c[0], c[1], c[2], c[3], 1, None, c[4]) for c in grouped(rgba, len(spec))]
    # reading order: rows by centre y (cluster by overlap), then x
    ordered = reading_order(comps)
    print('found', len(ordered), 'components; spec', len(spec))
    out = []
    for c, sp in zip(ordered, spec):
        if sp is None: continue
        sid, size = sp[0], sp[1]
        x0, y0, x1, y1, _, _, m = c
        crop = rgba[y0:y1, x0:x1].copy()
        crop[..., 3] = np.where(m, crop[..., 3], 0)
        hh, ww = crop.shape[:2]
        if isinstance(size, (list, tuple)) and size[0] == 'w':
            w32 = size[1]; h32 = max(1, round(hh * w32 / ww))
        else:
            h32 = size; w32 = max(1, round(ww * h32 / hh))
        feet = [w32 / 2, h32 - (sp[2].get('feet_up', 1) if len(sp) > 2 else 1)]
        extra = dict(src=os.path.relpath(raw, '/home/user/others/chronicle'))
        if len(sp) > 2: extra.update({k: v for k, v in sp[2].items() if k != 'feet_up'})
        out.append(write_sprite_set([crop], theme, sub, sid, ['default'], (w32, h32), feet, extra))
    return out
