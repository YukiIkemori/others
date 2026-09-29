"""(desert copy of ../field/fit.py: sand/dune/clay grounds, classifier seeded from the layout) Fit the collision to the painting of a FIELD area.
usage: python3 fit.py <id> <gen.png> [--apply]
1. Box-downscale the painting to 32 px/tile and classify every cell with colour likelihoods learnt from the painting itself: for each class
   the pixels of the layout cells deep inside that class's regions (eroded) give a colour histogram; each cell gets the class with the
   highest mean log-likelihood (open ground, road/path, sand, water, tree/forest, rock/cliff).
2. Compare with the layout rows and print an ascii map: '.' / '#' agree, 'o' layout walkable but painted solid, 'X' layout solid but
   painted open. Writes <id>/fit.png (painting with solid cells outlined red, disagreements yellow).
3. With --apply, write layout.json 'rows_fit': cells the painting shows clearly different (margin) take the painted class
   (open -> ',' / '.' / 's', solid -> 'T' / 'w' / '~' / 'r'); landmark cells, bridge/flagstone cells, exits, spawns and objects' cells
   (and the cell in front of them) are kept; walkable pockets not reachable from the spawns are closed with the neighbouring solid.
"""
import sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from collections import deque

aid, src = sys.argv[1], sys.argv[2]
import os as _os
_fx = json.load(open(aid + '/fix.json')) if _os.path.exists(aid + '/fix.json') else {}
for _k, _v in (_fx.get('fit') or {}).items(): _os.environ.setdefault(_k, str(_v))   # per-area classifier settings (SEED, EM, MARGIN)
APPLY = '--apply' in sys.argv
MARGIN = float(__import__('os').environ.get('MARGIN', 0.6))   # |ground fraction - 0.5| * 4: 0.6 = below 0.35 or above 0.65
d = json.load(open(aid + '/layout.json'))
W, H, T = d['w'], d['h'], 32
rows = [list(r) for r in d['rows']]
A = np.asarray(Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX)).astype(np.int32)
CLS = {'open': ',;"', 'road': '.:', 'sand': 's_uk', 'water': '~w', 'tree': 'TFb', 'rock': 'rR'}
WALKC = {'open', 'road', 'sand'}
g = np.array(rows)
Q = (A // 16); qi = Q[..., 0] * 256 + Q[..., 1] * 16 + Q[..., 2]
hist = {}
for c, chars in CLS.items():
    m = np.isin(g, list(chars))
    if not m.any(): continue
    mi = ndimage.binary_erosion(m, iterations=1) if ndimage.binary_erosion(m, iterations=1).sum() > 8 else m
    pm = np.kron(mi, np.ones((T, T), bool))
    h = np.bincount(qi[pm], minlength=4096).astype(float) + 0.3
    hist[c] = np.log(h / h.sum())
names = list(hist)
# per-cell features and a regularised Gaussian classifier trained on the layout's own cells (eroded: away from class edges)
lum = A @ np.array([0.299, 0.587, 0.114])
C4 = lambda a: a.reshape(H, T, W, T)
gx = np.abs(np.diff(lum, axis=1, append=lum[:, -1:])); gy = np.abs(np.diff(lum, axis=0, append=lum[-1:, :]))
hsvmax, hsvmin = A.max(-1), A.min(-1)
feat = np.stack([C4(A[..., 0]).mean((1, 3)), C4(A[..., 1]).mean((1, 3)), C4(A[..., 2]).mean((1, 3)),
                 C4(lum).std((1, 3)), C4(gx + gy).mean((1, 3)), C4((lum < 55).astype(float)).mean((1, 3)) * 100,
                 C4(((A[..., 2] > A[..., 1] + 8) & (A[..., 2] > A[..., 0] + 20)).astype(float)).mean((1, 3)) * 100,
                 C4((hsvmax - hsvmin).astype(float)).mean((1, 3))], -1)
GROUPS = {'ground': ',;".:s_uk', 'tree': 'TFb', 'water': '~w', 'rock': 'rR'}
models = {}
SEED = __import__('os').environ.get('SEED', 'layout')   # rules = seed the classes from the painting itself (rules.py), layout = from the layout cells
if SEED == 'rules':
    from rules import labels as _rl
    RL, _ = _rl(A.astype(float), W, H)
for c, chars in GROUPS.items():
    m = (RL == c) if SEED == 'rules' else np.isin(g, list(chars))
    if SEED == 'rules' and m.sum() < 6: m = np.isin(g, list(chars))
    me = ndimage.binary_erosion(m, iterations=1)
    if me.sum() < 6: me = m
    if me.sum() < 3: continue
    X = feat[me]
    mu = X.mean(0); cov = np.cov(X.T) + np.eye(X.shape[1]) * 4.0
    models[c] = (mu, np.linalg.inv(cov), np.linalg.slogdet(cov)[1], np.log(me.sum()))
cn = list(models)


def posterior(models):
    ll = np.stack([-0.5 * (np.einsum('hwi,ij,hwj->hw', feat - models[c][0], models[c][1], feat - models[c][0]) + models[c][2]) + 0.3 * models[c][3] for c in cn], -1)
    p = np.exp(ll - ll.max(-1, keepdims=True)); return p / p.sum(-1, keepdims=True)


post = posterior(models)
# re-train on the painting's own confident cells (the layout labels are only a start: the model may paint far less forest than the guide)
for it in range(int(__import__('os').environ.get('EM', 1))):
    lab = post.argmax(-1); conf = post.max(-1) > 0.9
    nm = {}
    for k, c in enumerate(cn):
        m = (lab == k) & conf
        if m.sum() < 8: nm[c] = models[c]; continue
        X = feat[m]; mu = X.mean(0); cov = np.cov(X.T) + np.eye(X.shape[1]) * 4.0
        nm[c] = (mu, np.linalg.inv(cov), np.linalg.slogdet(cov)[1], np.log(m.sum()))
    models = nm
    post = posterior(models)
ground = post[..., cn.index('ground')]
solidc = [c for c in cn if c != 'ground']
bestsolid = np.array(solidc)[np.stack([post[..., cn.index(c)] for c in solidc], -1).argmax(-1)]
# the painted ground kind: road/sand/open by the pixel histograms
gk = [k for k, c in enumerate(names) if c in ('open', 'road', 'sand')]
pix = np.stack([ndimage.uniform_filter(hist[c][qi], 3) for c in names], -1).argmax(-1)
frac = np.stack([(pix == k).reshape(H, T, W, T).mean((1, 3)) for k in range(len(names))], -1)
bestground = np.array(names)[np.array(gk)[frac[..., gk].argmax(-1)]]
pc = np.where(ground >= 0.5, bestground, bestsolid)
margin = np.abs(ground - 0.5) * 2     # 0.6 = P(ground) below 0.2 or above 0.8
lay = np.full((H, W), '', dtype=object)
for c, chars in CLS.items(): lay[np.isin(g, list(chars))] = c
marks = set((x, y) for m in d['marks'] for x, y in m['cells'] if m['kind'] in ('door',))
protect = set(marks)
for e in d['exits']:
    for j in range(e['h']):
        for i in range(e['w']): protect.add((e['x'] + i, e['y'] + j))
for s in d['spawns'].values(): protect.add((s['x'], s['y']))
for o in d['objects']:
    x, y = o['x'], o['y']
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): protect.add((x + dx, y + dy))
lines, fit = [], [r[:] for r in rows]
nchg = 0
for y in range(H):
    s = ''
    for x in range(W):
        lc, p = lay[y, x], pc[y, x]
        lw = lc in WALKC; pw = p in WALKC
        if lc == '' or (x, y) in marks: s += 'm'; continue
        if lw == pw: s += '.' if lw else '#'; continue
        if lw and p == 'tree' and y + 1 < H and g[y + 1, x] in 'TFb': s += '^'; continue   # crown hanging over the row north of a tree (overlay)
        s += 'o' if lw else 'X'
        if APPLY and margin[y, x] >= MARGIN and (x, y) not in protect and g[y, x] not in '=':
            fit[y][x] = {'open': ',', 'road': '.', 'sand': 's', 'water': ('~' if '~' in g else 'w'), 'tree': 'T', 'rock': 'r'}[p] if g[y, x] not in 'X' or pw else g[y, x]; nchg += 1
    lines.append('%2d %s' % (y, s))
print('\n'.join(lines))
print('disagree', sum(l.count('o') + l.count('X') for l in lines), 'changed', nchg)
if APPLY:
    # hand fits read off check.png (<id>/fix.json: solid [[x, y, ch?]], open [[x, y, ch?]])
    import os
    fx = json.load(open(aid + '/fix.json')) if os.path.exists(aid + '/fix.json') else {}
    for r in fx.get('open_rect', []):
        for j in range(r[1], r[1] + r[3]):
            for i in range(r[0], r[0] + r[2]): fit[j][i] = r[4] if len(r) > 4 else ','
    for q in fx.get('solid', []): fit[q[1]][q[0]] = q[2] if len(q) > 2 else 'X'
    for q in fx.get('open', []): fit[q[1]][q[0]] = q[2] if len(q) > 2 else ','
    for r in fx.get('solid_rect', []):
        for j in range(r[1], r[1] + r[3]):
            for i in range(r[0], r[0] + r[2]): fit[j][i] = r[4] if len(r) > 4 else 'X'
    # close unreachable walkable pockets (from the first spawn)
    WALK = set(',;".:s_=cuk')
    seen = np.zeros((H, W), bool); q = deque()
    for sp in d['spawns'].values():
        fit[sp['y']][sp['x']] = fit[sp['y']][sp['x']] if fit[sp['y']][sp['x']] in WALK else '.'
        seen[sp['y'], sp['x']] = True; q.append((sp['x'], sp['y']))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            i, j = x + dx, y + dy
            if 0 <= i < W and 0 <= j < H and not seen[j, i] and fit[j][i] in WALK: seen[j, i] = True; q.append((i, j))
    miss = [(x, y) for y in range(H) for x in range(W) if fit[y][x] in WALK and not seen[y, x]]
    print('unreachable before fixes', len(miss))
    for (x, y) in miss:
        nb = [fit[j][i] for i, j in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= i < W and 0 <= j < H and fit[j][i] not in WALK]
        fit[y][x] = max(set(nb), key=nb.count) if nb else 'T'
    print('closed unreachable walkable cells', len(miss), 'spawns reached', all(seen[s['y'], s['x']] for s in d['spawns'].values()))
    d['rows_fit'] = [''.join(r) for r in fit]
    json.dump(d, open(aid + '/layout.json', 'w'), ensure_ascii=False, indent=0)
# picture
rf = d.get('rows_fit') or d['rows']
im = Image.fromarray(A.astype(np.uint8)).convert('RGBA'); ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
for y in range(H):
    for x in range(W):
        c = rf[y][x]
        if c in '~wTFbrRX': dr.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(255, 40, 40, 150))
        l = lines[y][3 + x]
        if l in 'oX': dr.rectangle([x * T + 3, y * T + 3, x * T + T - 4, y * T + T - 4], outline=(255, 230, 0, 230), width=2)
Image.alpha_composite(im, ov).save(aid + '/fit.png')
if __import__('os').environ.get('DBG'):
    for q in __import__('os').environ['DBG'].split(';'):
        x, y = map(int, q.split(','))
        print(q, g[y, x], 'P', {c: round(float(post[y, x, cn.index(c)]), 2) for c in cn}, 'feat', np.round(feat[y, x], 1))
