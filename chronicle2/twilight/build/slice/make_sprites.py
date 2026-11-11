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

def shrink(sub, m, th, ncol=40, tw=None):
    """-> RGBA array th tall"""
    h, w = m.shape; tw = tw or max(1, int(round(w * th / h)))
    pal_img = Image.fromarray(sub).quantize(ncol, method=Image.MEDIANCUT, dither=Image.NONE)
    idx = np.array(pal_img); pal = np.array(pal_img.getpalette()[:ncol * 3]).reshape(-1, 3)
    ys = np.round(np.linspace(0, h, th + 1)).astype(int); xs = np.round(np.linspace(0, w, tw + 1)).astype(int)
    out = np.zeros((th, tw, 4), np.uint8)
    for j in range(th):
        for i in range(tw):
            mm = m[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]
            if mm.size == 0 or mm.mean() < .5: continue
            c = np.bincount(idx[ys[j]:ys[j + 1], xs[i]:xs[i + 1]][mm], minlength=ncol).argmax()
            out[j, i, :3] = pal[c]; out[j, i, 3] = 255
    # no near-black dots and no lonely dots
    a = out[..., 3] > 0; lone = a & (nd.convolve(a.astype(int), np.ones((3, 3)), mode='constant') <= 1); out[lone] = 0
    return out

# ---- monsters: height on screen in dots (the heroes are 80)
MON = dict(mn001=50, mn005=64, mn009=66, mn025=90, mn045=70, mn033=66, mn013=58, mn029=86, mn021=84)
meta = {}
for n, th in MON.items():
    (sub, m), = figures(f'{RAW}/{n}.png', 1)
    im = shrink(sub, m, th, 48); Image.fromarray(im).save(f'{OUT}/mon/{n}.png'); meta[n] = [im.shape[1], im.shape[0]]
json.dump(meta, open(f'{OUT}/mon/sizes.json', 'w'))
# ---- villagers: 96x128 frames, feet at (48,120) like the party
NPC = dict(npc_a=[('moku', 70), ('mother', 78), ('yomo', 66), ('dorgo', 82), ('hanna', 76)], npc_b=[('oz', 78), ('sem', 78), ('pico', 70), ('mil', 58), ('bart', 80)])
for sheet, people in NPC.items():
    figs = figures(f'{RAW}/{sheet}.png', 5); assert len(figs) == 5, len(figs)
    for (name, th), (sub, m) in zip(people, figs):
        im = shrink(sub, m, th, 30); fr = np.zeros((128, 96, 4), np.uint8); h, w = im.shape[:2]
        x0 = 48 - w // 2; fr[120 - h:120, x0:x0 + w] = im; Image.fromarray(fr).save(f'{OUT}/npc/{name}.png')
# ---- chest (two frames of 48x48, foot (24,40)) and the save crystal
figs = figures(f'{RAW}/props.png', 3); assert len(figs) == 3
sheet = np.zeros((48, 96, 4), np.uint8)
for k, (sub, m) in enumerate(figs[:2]):
    im = shrink(sub, m, 30 if k == 0 else 40, 32, tw=34 if k == 0 else None); h, w = im.shape[:2]; x0 = k * 48 + 24 - w // 2; sheet[42 - h:42, x0:x0 + w] = im
Image.fromarray(sheet).save(f'{OUT}/prop/chest.png')
im = shrink(*figs[2], 44, 24); Image.fromarray(im).save(f'{OUT}/prop/crystal.png')
# ---- battle backgrounds: 960x540
for n in ('bg_f01', 'bg_abbey'):
    b = Image.open(f'{RAW}/{n}.png').convert('RGB').resize((960, 544), Image.BOX).crop((0, 2, 960, 542)); b.save(f'{OUT}/bg/{n}.webp', lossless=True, quality=90, method=4)
# ---- a look at everything
c = Image.new('RGBA', (960, 300), (70, 74, 60, 255)); x = 10
for n in MON: im = Image.open(f'{OUT}/mon/{n}.png'); c.alpha_composite(im, (x, 140 - im.height)); x += im.width + 12
x = 10
for sheet in NPC.values():
    for name, _ in sheet: im = Image.open(f'{OUT}/npc/{name}.png'); c.alpha_composite(im, (x - 20, 160)); x += 62
hero = Image.open(os.path.join(OUT, '../site/party/hero.png')).convert('RGBA').crop((0, 0, 96, 128)); c.alpha_composite(hero, (x - 10, 160)); x += 70
c.alpha_composite(Image.open(f'{OUT}/prop/chest.png'), (x, 230)); c.alpha_composite(Image.open(f'{OUT}/prop/crystal.png'), (x + 110, 220))
c.resize((1920, 600), Image.NEAREST).save(sys.argv[3] if len(sys.argv) > 3 else f'{OUT}/sprites_preview.png')
print('ok', meta)
