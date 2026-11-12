"""Raw generations (flat magenta background) -> game sprites of the slice.
usage: make_sprites.py raw_dir slice_dir
Each figure is cut from the magenta, its colours are reduced to a small palette, and it is brought to its size on screen by
taking, for every dot of the result, the palette colour most of the raw pixels under it have (the image model draws its
'pixels' on a grid of its own, so a plain resize would smear them)."""
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as nd
RAW, OUT = sys.argv[1:3]
for d in ('mon', 'npc', 'prop', 'bg'): os.makedirs(f'{OUT}/{d}', exist_ok=True)

def figures(path, n, min_px=400):
    rgb = np.array(Image.open(path).convert('RGB')); r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    fg = ~((np.minimum(r, b) - g > 60) & (np.abs(r - b) < 90))
    fg = nd.binary_opening(fg, iterations=1)
    fg &= ~((np.minimum(r, b) - g > 28) & nd.binary_dilation(~fg, iterations=3))          # magenta-blended rim
    lab, k = nd.label(nd.binary_dilation(fg, iterations=6))                              # loose parts (a crook, a strand of web) stay with their figure
    sizes = nd.sum(fg, lab, range(1, k + 1)); keep = [i + 1 for i in np.argsort(-sizes)[:n] if sizes[i] >= min_px]
    out = []
    for i in keep:
        m = (lab == i) & fg; ys, xs = np.where(m)
        out.append((xs.min(), rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
    return [(a, b) for _, a, b in sorted(out, key=lambda t: t[0])]

def shrink(sub, m, th, ncol=40, tw=None, calm=False):
    """-> RGBA array th tall"""
    h, w = m.shape; tw = tw or max(1, int(round(w * th / h)))
    pal_img = Image.fromarray(sub).quantize(ncol, method=Image.MEDIANCUT, dither=Image.NONE)
    idx = np.array(pal_img); pal = np.array(pal_img.getpalette()[:ncol * 3]).reshape(-1, 3)
    ys = np.round(np.linspace(0, h, th + 1)).astype(int); xs = np.round(np.linspace(0, w, tw + 1)).astype(int)
    out = np.zeros((th, tw, 4), np.uint8)
    lum = pal @ np.array([.3, .59, .11]); used = np.bincount(idx[m], minlength=ncol) > 0
    dark = np.nonzero(used & (lum < .55 * np.median(lum[idx[m]])))[0] if calm else None
    if dark is not None and not len(dark): dark = None
    for j in range(th):
        for i in range(tw):
            mm = m[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]
            if mm.size == 0 or mm.mean() < .5: continue
            cnt = np.bincount(idx[ys[j]:ys[j + 1], xs[i]:xs[i + 1]][mm], minlength=ncol); c = cnt.argmax()
            if calm and dark is not None and cnt[dark].sum() >= .34 * cnt.sum(): c = dark[cnt[dark].argmax()]       # the outline survives: a line one raw dot wide never has the majority
            out[j, i, :3] = pal[c]; out[j, i, 3] = 255
    # no lonely dots: a figure's rim dot with no neighbour goes, and (calm=True, the monsters) a dot inside the figure that has
    # no neighbour of its own colour takes the colour most of its neighbours have, so that shades lie in clusters as
    # they do on the party's sprites and not as a sprinkle
    a = out[..., 3] > 0; lone = a & (nd.convolve(a.astype(int), np.ones((3, 3)), mode='constant') <= 1); out[lone] = 0
    if calm:
        key = out[..., 0].astype(np.int32) * 65536 + out[..., 1].astype(np.int32) * 256 + out[..., 2]; a = out[..., 3] > 0
        for _ in range(1):
            p = np.pad(key, 1, constant_values=-1); pa = np.pad(a, 1); new = key.copy()
            for j, i in zip(*np.nonzero(a)):
                nb = p[j:j + 3, i:i + 3][pa[j:j + 3, i:i + 3]]
                if (nb == key[j, i]).sum() - 1 <= 0 and len(nb) > 4:
                    vals, cnt = np.unique(nb[nb != key[j, i]], return_counts=True); new[j, i] = vals[cnt.argmax()]
            key = new
        out[..., 0], out[..., 1], out[..., 2] = key >> 16, (key >> 8) & 255, key & 255; out[~a] = 0
    return out

def crisp(sub, m, th, ncol=20, P=None):
    """-> RGBA array about th + 2 tall, for the monsters.  The image model draws them about twice as fine as a dot of the screen,
    so a painted outline is half a dot wide and comes out of any resampling as a dotted line ("点描っぽい").  Here the body is
    taken first (cells mostly filled with body colours, shades gathered in clusters), then ONE closed outline, one dot
    wide, is drawn around it in the dark the painter used; painted lines inside the body stay only as runs."""
    P = dict(dark=.6, core=.5, thin=.3, line=.38, minline=2, modes=2, lone=0, **(P or {}))
    h, w = m.shape; tw = max(1, int(round(w * th / h)))
    fill = sub[m].mean(axis=0).astype(np.uint8); s2 = sub.copy(); s2[~m] = fill
    pal_img = Image.fromarray(s2).quantize(ncol, method=Image.MEDIANCUT, dither=Image.NONE)
    idx = np.array(pal_img); pal = np.array(pal_img.getpalette()[:ncol * 3]).reshape(-1, 3).astype(float)
    lum = pal @ np.array([.3, .59, .11]); med = np.median(lum[idx[m]])
    isdark = lum < P['dark'] * med
    ys = np.round(np.linspace(0, h, th + 1)).astype(int); xs = np.round(np.linspace(0, w, tw + 1)).astype(int)
    cov = np.zeros((th, tw)); body = np.zeros((th, tw)); dk = np.zeros((th, tw)); col = np.zeros((th, tw), int); dcol = np.zeros((th, tw), int)
    for j in range(th):
        for i in range(tw):
            mm = m[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]; n = mm.size
            if not n or not mm.any(): continue
            cnt = np.bincount(idx[ys[j]:ys[j + 1], xs[i]:xs[i + 1]][mm], minlength=ncol).astype(float)
            cov[j, i] = mm.mean(); dk[j, i] = cnt[isdark].sum() / n; body[j, i] = cnt[~isdark].sum() / n
            cb = cnt.copy(); cb[isdark] = 0; col[j, i] = cb.argmax() if cb.sum() > 0 else cnt.argmax()
            cd = cnt.copy(); cd[~isdark] = 0; dcol[j, i] = cd.argmax() if cd.sum() > 0 else cnt.argmax()
    # the body: cells mostly filled with body colours; thin limbs (thinner than a dot) are kept where the figure covers the cell
    core = (body >= P['core']) | ((cov >= .5) & (body >= P['thin']))
    core &= nd.convolve(core.astype(int), np.ones((3, 3)), mode='constant') > 1                 # no lonely dots
    core |= (~core) & (nd.convolve(core.astype(int), np.ones((3, 3)), mode='constant') >= 7)   # no pinholes
    # shades in clusters
    key = col.copy()
    for _ in range(P['modes']):
        p = np.pad(key, 1, constant_values=-1); pc = np.pad(core, 1); new = key.copy()
        for j, i in zip(*np.nonzero(core)):
            nb = p[j:j + 3, i:i + 3][pc[j:j + 3, i:i + 3]]
            if (nb == key[j, i]).sum() - 1 <= P['lone'] and len(nb) > 4:
                vals, c = np.unique(nb, return_counts=True); new[j, i] = vals[c.argmax()]
        key = new
    # drawn lines inside the body (between the legs, a mouth): only runs, never single dots
    inner = core & nd.binary_erosion(core, structure=np.ones((3, 3)), border_value=0)
    line = inner & (dk >= P['line'])
    lab, k = nd.label(line, structure=np.ones((3, 3)))
    if k: sz = nd.sum(line, lab, range(1, k + 1)); line &= np.isin(lab, np.nonzero(sz >= P['minline'])[0] + 1)
    # one outline colour for the figure: the dark the painter used most
    dpix = idx[m & ~nd.binary_erosion(m, iterations=4)]; dc = np.bincount(dpix[isdark[dpix]], minlength=ncol) if isdark[dpix].any() else None
    oc = pal[dc.argmax()] if dc is not None else pal[lum.argmin()]
    oc = oc * .8
    out = np.zeros((th + 2, tw + 2, 4), np.uint8)
    pc = np.pad(core, 1); pl = np.pad(line, 1)
    pr = nd.binary_dilation(pc, structure=nd.generate_binary_structure(2, 1)) & ~pc
    out[pc, :3] = pal[np.pad(key, 1)[pc]]; out[pc, 3] = 255
    out[pl, :3] = pal[np.pad(dcol, 1)[pl]]
    out[pr, :3] = oc; out[pr, 3] = 255
    ys_, xs_ = np.nonzero(out[..., 3]); return out[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]

def dots(sub, m, th, ncol=16):
    """-> RGBA array about th + 2 tall, for a monster redrawn flat (mon_flat.py, raw/<name>_flat2.png).  That drawing is
    already made of big flat dots, so each screen dot simply takes the colour most of its cell has (a cell counts as body
    when half of it is covered).  The outline is closed: drawn dark rim dots are kept in one colour, and where the dark
    line was lost a dot is added outside."""
    h, w = m.shape; tw = max(1, int(round(w * th / h)))
    fill = np.median(sub[m], 0).astype(np.uint8); s2 = sub.copy(); s2[~m] = fill
    q = Image.fromarray(s2).quantize(ncol, method=Image.MEDIANCUT, dither=Image.NONE); idx = np.array(q); pal = np.array(q.getpalette()[:ncol * 3]).reshape(-1, 3)
    ys = np.round(np.linspace(0, h, th + 1)).astype(int); xs = np.round(np.linspace(0, w, tw + 1)).astype(int)
    key = np.full((th, tw), -1)
    for j in range(th):
        for i in range(tw):
            mm = m[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]
            if mm.size and mm.mean() >= .5: key[j, i] = np.bincount(idx[ys[j]:ys[j + 1], xs[i]:xs[i + 1]][mm], minlength=ncol).argmax()
    core = key >= 0
    core &= nd.convolve(core.astype(int), np.ones((3, 3)), mode='constant') > 1; key[~core] = -1
    # one closed outline: where the drawn dark line is there it is kept (in one colour); where it was lost a dot is added outside
    lum = pal @ np.array([.3, .59, .11]); med = np.median(lum[key[core]]); dark = core & (lum[np.clip(key, 0, None)] < .46 * med)
    four = nd.generate_binary_structure(2, 1); rim = core & ~nd.binary_erosion(core, structure=four, border_value=0)
    painted = rim & dark; oc = np.median(pal[key[painted]], 0) * .9 if painted.sum() > 8 else np.median(pal[key[core]], 0) * .3
    out = np.zeros((th + 2, tw + 2, 4), np.uint8); pc = np.pad(core, 1); pk = np.pad(key, 1, constant_values=-1)
    out[pc, :3] = pal[pk[pc]]; out[pc, 3] = 255
    pp = np.pad(painted, 1); out[pp, :3] = oc
    lost = np.pad(rim & ~dark, 1); ring = nd.binary_dilation(lost, structure=four) & ~pc
    out[ring, :3] = oc; out[ring, 3] = 255
    ys_, xs_ = np.nonzero(out[..., 3]); return out[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]

# ---- monsters: height on screen in dots (the heroes are 80)
MON = dict(mn001=50, mn005=64, mn009=66, mn025=90, mn045=70, mn033=66, mn013=58, mn029=86, mn021=84,
           mn006=74, mn017=62, mn037=44, mn046=70, mn049=88, mn053=88, mn097=40, mn101=40, bs01=124)
meta = {}
for n, th in MON.items():
    f2, src = f'{RAW}/{n}_flat2.png', f'{RAW}/{n}_flat.png'               # the flat redraw (mon_flat.py), else the redraw in the party's technique (gen_art.py), else the first pass
    if os.path.exists(f2): (sub, m), = figures(f2, 1); im = dots(sub, m, th + 2)
    else: (sub, m), = figures(src if os.path.exists(src) else f'{RAW}/{n}.png', 1); im = crisp(sub, m, th)
    Image.fromarray(im).save(f'{OUT}/mon/{n}.png'); meta[n] = [im.shape[1], im.shape[0]]
# 灯り玉 comes in two colours (its weakness depends on the colour): the milk-white flame is tinted by code
def tint(src, dst, col):
    a = np.array(Image.open(src).convert('RGBA')).astype(float); lum = a[..., :3] @ np.array([.3, .59, .11]) / 255
    c = np.array(col, float); out = a.copy()
    out[..., :3] = np.clip(c * (lum[..., None] ** 1.5) * 1.15 + 255 * np.clip(lum[..., None] - .82, 0, 1) * 3, 0, 255); Image.fromarray(out.astype(np.uint8)).save(dst)
if os.path.exists(f'{OUT}/mon/mn097.png'):
    tint(f'{OUT}/mon/mn097.png', f'{OUT}/mon/mn097r.png', (214, 104, 70)); tint(f'{OUT}/mon/mn097.png', f'{OUT}/mon/mn097b.png', (96, 140, 210))
    for k in ('mn097r', 'mn097b'): meta[k] = meta['mn097']
json.dump(meta, open(f'{OUT}/mon/sizes.json', 'w'))
# ---- villagers: 96x128 frames, feet at (48,120) like the party
NPC = dict(npc_a=[('moku', 70), ('mother', 78), ('yomo', 66), ('dorgo', 82), ('hanna', 76)], npc_b=[('oz', 78), ('sem', 78), ('pico', 70), ('mil', 58), ('bart', 80)],
           npc_c=[('garam', 84), ('ryuka', 78), ('nezu', 80), ('hash', 80), ('bren', 78)], npc_d=[('sara', 76), ('marg', 80), ('jino', 78), ('guard', 100), ('toto', 68)],
           npc_e=[('elma', 76), ('armorer', 80), ('itemman', 78), ('townwoman', 76), ('merchant', 80)])
# heights include what a figure holds above its head (ジノ's lighting pole, the guard's spear)
for sheet, people in NPC.items():
    if not os.path.exists(f'{RAW}/{sheet}.png'): continue
    figs = figures(f'{RAW}/{sheet}.png', 5); assert len(figs) == 5, len(figs)
    for (name, th), (sub, m) in zip(people, figs):
        im = shrink(sub, m, th, 30); fr = np.zeros((128, 96, 4), np.uint8); h, w = im.shape[:2]
        x0 = 48 - w // 2; fr[120 - h:120, x0:x0 + w] = im; Image.fromarray(fr).save(f'{OUT}/npc/{name}.png')
# ---- chest (two frames of 64x64, foot (32,54)) and the save crystal.  Both are things the player must not walk past:
# the chest is about half a person tall, the crystal nearly a whole one (and the game lights them, see hd.js "glow")
figs = figures(f'{RAW}/props.png', 3); assert len(figs) == 3
sheet = np.zeros((64, 128, 4), np.uint8)
for k, (sub, m) in enumerate(figs[:2]):
    im = shrink(sub, m, 38 if k == 0 else 50, 32, tw=43 if k == 0 else None); h, w = im.shape[:2]; x0 = k * 64 + 32 - w // 2; sheet[56 - h:56, x0:x0 + w] = im
Image.fromarray(sheet).save(f'{OUT}/prop/chest.png')
im = shrink(*figs[2], 68, 24); Image.fromarray(im).save(f'{OUT}/prop/crystal.png')
# ---- battle backgrounds: 1152x648 (the battle view is pulled back by 1.2, see battle.js)
for n in ('bg_f01', 'bg_abbey', 'bg_f02', 'bg_abbey2'):
    if not os.path.exists(f'{RAW}/{n}.png'): continue
    b = Image.open(f'{RAW}/{n}.png').convert('RGB').resize((1152, 653), Image.LANCZOS).crop((0, 2, 1152, 650)); b.save(f'{OUT}/bg/{n}.webp', lossless=True, quality=90, method=4)
# ---- a look at everything
c = Image.new('RGBA', (1700, 300), (70, 74, 60, 255)); x = 10
for n in MON: im = Image.open(f'{OUT}/mon/{n}.png'); c.alpha_composite(im, (x, 140 - im.height)); x += im.width + 12
x = 10
for sk, sheet in NPC.items():
    if not os.path.exists(f'{RAW}/{sk}.png'): continue
    for name, _ in sheet: im = Image.open(f'{OUT}/npc/{name}.png'); c.alpha_composite(im, (x - 20, 160)); x += 62
hero = Image.open(os.path.join(OUT, '../site/party/hero.png')).convert('RGBA').crop((0, 0, 96, 128)); c.alpha_composite(hero, (x - 10, 160)); x += 70
c.alpha_composite(Image.open(f'{OUT}/prop/chest.png'), (x, 226)); c.alpha_composite(Image.open(f'{OUT}/prop/crystal.png'), (x + 140, 216))
c.resize((3400, 600), Image.NEAREST).save(sys.argv[3] if len(sys.argv) > 3 else f'{OUT}/sprites_preview.png')
print('ok', meta)
