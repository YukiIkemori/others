import json, glob, os, re
from PIL import Image
V2 = '/home/user/others/chronicle/v2'
ENV = V2 + '/assets/env'
MAPS = json.load(open(os.path.join(os.path.dirname(__file__), 'maps.json')))
_idx = None
def pidx():
    global _idx
    if _idx: return _idx
    idx = {}
    for j in glob.glob(ENV + '/*/props/*.json'):
        th = j.split('/')[-3]; id_ = os.path.basename(j)[:-5]
        idx.setdefault(id_, []).append((th, j))
    var = {}
    for id_ in idx:
        m = re.match(r'^(.*)_v(\d+)$', id_); base, v = (m.group(1), int(m.group(2))) if m else (id_, 0)
        var.setdefault(base, {})[v] = id_
    _idx = (idx, {b: [var[b][k] for k in sorted(var[b])] for b in var})
    return _idx
def sprite(pid, v=0, t=32, theme=None):
    idx, var = pidx()
    lst = var.get(pid)
    if not lst: return None
    id_ = lst[v % len(lst)]
    ent = idx[id_]
    th, jp = ent[-1]
    for e in ent:
        if theme and e[0] == theme: th, jp = e
    j = json.load(open(jp)); d = os.path.dirname(jp)
    f = os.path.join(d, '%s@%d.png' % (id_, t))
    if not os.path.exists(f): f = os.path.join(d, '%s@32.png' % id_)
    im = Image.open(f).convert('RGBA')
    names = j.get('frames', ['default']); cell = j.get('cell', {}).get(str(t)) or [im.width // len(names), im.height]
    feet = j.get('feet', {}).get(str(t)) or [cell[0] / 2, cell[1] - 1]
    fr = im.crop((0, 0, cell[0], im.height))
    return fr, feet, id_, th
def painting(mid, t=32, suffix=''):
    a = MAPS[mid]['art']
    return Image.open('%s/%s%s@%d.png' % (ENV, a['image'], suffix, t)).convert('RGBA')
def feetpos(o, t):
    return ((o['x'] + 0.5) * t, (o['y'] + 0.84) * t)
def composite(mid, t=32, objs=None, base=None):
    m = MAPS[mid]; im = (base or painting(mid, t)).copy()
    objs = objs if objs is not None else [o for o in m['objects'] if o['type'] == 'prop']
    for o in sorted(objs, key=lambda o: o['y']):
        s = sprite(o['id'], o.get('variant', 0) or 0, t)
        if not s: continue
        fr, feet, _, _ = s
        if o.get('flip'): fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
        fx, fy = feetpos(o, t)
        im.alpha_composite(fr, (int(round(fx - feet[0])), int(round(fy - feet[1]))))
    return im
