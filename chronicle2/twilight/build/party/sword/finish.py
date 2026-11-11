"""work/walk_raw.png + run_raw.png (from build.py) -> final sheets: repairs, dot eyes, own-colour outline (no near-black),
json. Adapted from /home/user/tw/hero/finish.py.
usage: python3 finish.py <config.json> <work dir> <out dir>
config: id, body, repairs: [{"sheet":"run","row":"up_right","col":0,"poly":[[x,y],...],"mode":"erase"}]
  mode erase: every pixel inside the polygon takes the nearest pixel outside it (opaque or transparent)
  mode set  : {"px": [[x, y, "#rrggbb" | null], ...]} single pixels"""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
sys.path.insert(0, '/home/user/others/chronicle/design/sprite_pipe/tools')
import pixlib as P
cfg = json.load(open(sys.argv[1])); work, out = sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
CW, CH, AX, AY = 96, 128, 48, 120
NAMES = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right']
meta = json.load(open(os.path.join(work, 'meta.json')))
L = lambda rgb: P.srgb_to_lab(np.asarray(rgb, np.float64).reshape(1, 1, 3))[0, 0]
EYE = np.array([34, 26, 30], np.uint8)          # eye dots: the hero's eye colour, the darkest thing on the sprite
INDIGO = np.array([40, 36, 48], np.uint8)       # the hero's outline shade for charcoal / indigo materials
SKIN = np.array([249, 205, 158], np.uint8)
EYE_H = 2
N8 = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
WANT = {'down': 2, 'down_left': 2, 'down_right': 2, 'left': 1, 'right': 1}


def is_skin(c):
    r, g, b = [int(v) for v in c]
    return r > 200 and g > 135 and b > 85 and r - b > 50 and g - b > 15


def repair(sheet, kind):
    for rp in cfg.get('repairs', []):
        if rp['sheet'] != kind:
            continue
        R = NAMES.index(rp['row'])
        for C in ([rp['col']] if isinstance(rp['col'], int) else rp['col']):
            fr = sheet[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]
            if rp.get('mode', 'erase') == 'erase':
                m = Image.new('L', (CW, CH), 0)
                ImageDraw.Draw(m).polygon([tuple(p) for p in rp['poly']], fill=255)
                m = np.array(m) > 0
                if rp.get('only'):                       # restrict to some colours (hex list)
                    cols = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in rp['only']]
                    sel = np.zeros(m.shape, bool)
                    for c in cols:
                        sel |= (fr[..., :3] == c).all(-1)
                    m &= sel
                idx = nd.distance_transform_edt(m, return_distances=False, return_indices=True)
                src = fr.copy()
                fr[m] = src[idx[0][m], idx[1][m]]
            else:
                for x, y, c in rp['px']:
                    if c is None:
                        fr[y, x] = 0
                    else:
                        fr[y, x] = [int(c[i:i + 2], 16) for i in (1, 3, 5)] + [255]


def finish(sheet, kind):
    alpha = sheet[..., 3] > 0
    pal = np.unique(sheet[alpha][:, :3], axis=0)
    pal_lab = P.srgb_to_lab(pal.astype(np.float64))
    dark_pal = {tuple(c): bool(l[0] < 13.0) for c, l in zip(pal, pal_lab)}
    eye_log = {}
    for R in range(8):
        sp_row = None
        for C in range(4):
            fr = sheet[R * CH:(R + 1) * CH, C * CW:(C + 1) * CW]
            a = fr[..., 3] > 0
            mt = meta[kind]['%d_%d' % (R, C)]
            top, hcx = mt['head_top'], mt['head_cx']
            dark = np.zeros(a.shape, bool); skin = np.zeros(a.shape, bool)
            for y, x in zip(*np.where(a)):
                c = tuple(fr[y, x, :3])
                dark[y, x] = dark_pal[c]; skin[y, x] = is_skin(c)
            # ---- eyes: small dark blobs inside the head that touch skin and do not touch the outside
            lab, n = nd.label(dark, structure=np.ones((3, 3)))
            outside = nd.binary_dilation(~a, structure=np.ones((3, 3)))
            eyes = []
            want = WANT.get(NAMES[R], 0)
            for i in range(1, n + 1):
                m = lab == i
                yy, xx = np.where(m)
                if yy.min() < top + 5 or yy.max() > top + 27 or abs(xx.mean() - hcx) > 13 or m.sum() > 16 or (m & outside).any():
                    continue
                ring = nd.binary_dilation(m, structure=np.ones((3, 3))) & ~m
                frac = (ring & skin).sum() / float(ring.sum())
                if frac >= 0.3:
                    eyes.append((frac, m))
            eyes = [m for f, m in sorted(eyes, key=lambda t: -t[0])[:want]]
            keep = np.zeros(a.shape, bool)
            Lf = P.srgb_to_lab(fr[..., :3].astype(np.float64))[..., 0]
            semi = a & (Lf < 24)
            spots = []
            for m in eyes:
                yy, xx = np.where(m)
                win = np.zeros(a.shape, bool)
                win[yy.min():yy.max() + 4, max(0, xx.min() - 1):xx.max() + 2] = True
                lab2, _ = nd.label(semi & win, structure=np.ones((3, 3)))
                ids = np.unique(lab2[m]); ids = ids[ids > 0]
                reg = np.isin(lab2, ids) & ~outside
                ry, rx = np.where(reg)
                low = {x: ry[rx == x].max() for x in np.unique(rx)}
                mx = max(low.values())
                cand = [x for x, v in low.items() if v == mx]
                cx = min(cand, key=lambda x: abs(x - hcx))
                cy = int(round((ry.min() + ry.max()) / 2.0))
                spots.append((cx, cy, reg))
            if len(spots) == 2:                                   # both eyes on the same rows
                cy = int(round((spots[0][1] + spots[1][1]) / 2.0))
                spots = sorted([(x, cy, r) for x, _, r in spots], key=lambda t: t[0])
                if sp_row is None:
                    sp_row = spots[1][0] - spots[0][0]
                else:                                              # same eye spacing as the first frame of this row
                    mid = (spots[0][0] + spots[1][0]) / 2.0
                    x1 = int(round(mid - sp_row / 2.0))
                    spots = [(x1, cy, spots[0][2]), (x1 + sp_row, cy, spots[1][2])]
            for cx, cy, reg in spots:
                for y, x in zip(*np.where(reg)):
                    nb = [tuple(fr[y + dy, x + dx, :3]) for dy, dx in N8
                          if 0 <= y + dy < CH and 0 <= x + dx < CW and a[y + dy, x + dx] and not reg[y + dy, x + dx]
                          and is_skin(fr[y + dy, x + dx, :3])]
                    if nb:
                        vals, cn = np.unique(np.array(nb), axis=0, return_counts=True)
                        fr[y, x, :3] = vals[cn.argmax()]
                    else:
                        fr[y, x, :3] = SKIN
                    dark[y, x] = False
                for y in range(cy - (EYE_H - 1) // 2, cy - (EYE_H - 1) // 2 + EYE_H):
                    keep[y, cx] = True
            fr[keep, :3] = EYE
            eye_log[(R, C)] = len(eyes)
            # ---- outline: remaining near-black pixels take a dark shade of the darkest material they border
            rest = dark & ~keep
            src = fr.copy()
            for y, x in zip(*np.where(rest)):
                cand = []
                for dy, dx in N8:
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < CH and 0 <= xx < CW and a[yy, xx] and not dark[yy, xx] and not keep[yy, xx]:
                        cand.append(src[yy, xx, :3])
                if not cand:
                    fr[y, x, :3] = INDIGO; continue
                cl = [L(c) for c in cand]
                k = int(np.argmin([c[0] for c in cl]))
                base = cl[k]
                if base[0] < 40 and abs(base[1]) < 9 and base[2] < 9:      # charcoal / slate cloth
                    fr[y, x, :3] = INDIGO; continue
                t = np.array([max(15.0, base[0] * 0.55), base[1] * 0.9, base[2] * 0.9])
                ok = pal_lab[:, 0] >= 13.5
                d = ((pal_lab - t) ** 2).sum(1); d[~ok] = 1e9
                fr[y, x, :3] = pal[d.argmin()]
    print(kind, 'eyes found per frame:')
    for R in range(8):
        print('   %-10s' % NAMES[R], [eye_log[(R, C)] for C in range(4)], '(want %d)' % WANT.get(NAMES[R], 0))
    return sheet


res = {}
for kind in ('walk', 'run'):
    p = os.path.join(work, kind + '_raw.png')
    if not os.path.exists(p):
        continue
    sheet = np.array(Image.open(p).convert('RGBA'))
    repair(sheet, kind)
    res[kind] = finish(sheet, kind)
allpx = np.concatenate([s[s[..., 3] > 0][:, :3] for s in res.values()])
print('colours: all', len(np.unique(allpx, axis=0)), {k: len(np.unique(s[s[..., 3] > 0][:, :3], axis=0)) for k, s in res.items()})
cid = cfg['id']
Image.fromarray(res['walk']).save(os.path.join(out, cid + '.png'))
js = {'frame': [CW, CH], 'foot': [AX, AY], 'body': cfg.get('body', 78), 'ms': 170}
if 'run' in res:
    Image.fromarray(res['run']).save(os.path.join(out, cid + '_run.png'))
    js['run'] = {'src': cid + '_run.png', 'cols': 4, 'ms': 105}
open(os.path.join(out, cid + '.json'), 'w').write(json.dumps(js))
print(json.dumps(js))
