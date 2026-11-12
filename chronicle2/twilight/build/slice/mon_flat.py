"""Monsters, third pass: flat like the party ("点描画みたい" was the complaint, twice).
usage: mon_flat.py raw_dir [name ...]        (needs OPENAI_API_KEY; writes raw/<name>_cel.png and raw/<name>_flat2.png)
The second pass (gen_art.py flat) still came back with fur strokes and speckle, because the image model was shown a
textured picture.  So here the picture is first made flat by hand (cel(): averaged down to screen dots, a handful of flat
shades, lonely dots joined, a dark ring), blown up to big square dots, and only then given to the image model, whose
job is small: make the face readable and the edges clean, in the heroes' technique.  Starting from a flat picture keeps
it flat.  make_sprites.py takes raw/<name>_flat2.png when it is there (dots())."""
import sys, os, numpy as np
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from scipy import ndimage as nd
from scipy.cluster.vq import kmeans2
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..'))
MON = dict(mn001=50, mn005=64, mn009=66, mn025=90, mn045=70, mn033=66, mn013=58, mn029=86, mn021=84)

def figures(path, n, min_px=400):
    rgb = np.array(Image.open(path).convert('RGB')); r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    fg = ~((np.minimum(r, b) - g > 60) & (np.abs(r - b) < 90))
    fg = nd.binary_opening(fg, iterations=1)
    fg &= ~((np.minimum(r, b) - g > 28) & nd.binary_dilation(~fg, iterations=3))
    lab, k = nd.label(nd.binary_dilation(fg, iterations=6))
    sizes = nd.sum(fg, lab, range(1, k + 1)); keep = [i + 1 for i in np.argsort(-sizes)[:n] if sizes[i] >= min_px]
    out = []
    for i in keep:
        m = (lab == i) & fg; ys, xs = np.where(m)
        out.append((xs.min(), rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
    return [(a, b) for _, a, b in sorted(out, key=lambda t: t[0])]

def cel(sub, m, th, k=7, modes=3, seed=3):
    """Flat cel shading: the figure is averaged down to screen dots (which melts fur strokes and speckle), its colours are
    gathered into a handful of flat shades, lonely dots join their surroundings, and one dark closed outline is drawn."""
    h, w = m.shape; tw = max(1, int(round(w * th / h)))
    ys = np.round(np.linspace(0, h, th + 1)).astype(int); xs = np.round(np.linspace(0, w, tw + 1)).astype(int)
    lumr = sub.astype(float) @ np.array([.3, .59, .11]); med = np.median(lumr[m])
    small = np.zeros((th, tw, 3)); cov = np.zeros((th, tw)); dk = np.zeros((th, tw)); dcol = np.zeros((th, tw, 3))
    for j in range(th):
        for i in range(tw):
            mm = m[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]
            if not mm.size or not mm.any(): continue
            px = sub[ys[j]:ys[j + 1], xs[i]:xs[i + 1]][mm].astype(float); lm = lumr[ys[j]:ys[j + 1], xs[i]:xs[i + 1]][mm]
            cov[j, i] = mm.mean(); d = lm < .5 * med; dk[j, i] = d.sum() / mm.size
            small[j, i] = px[~d].mean(0) if (~d).sum() >= max(1, .3 * len(px)) else px.mean(0)        # the cell's colour without the painted dark lines
            dcol[j, i] = px[d].mean(0) if d.any() else px.mean(0)
    core = cov >= .5
    core &= nd.convolve(core.astype(int), np.ones((3, 3)), mode='constant') > 1
    core |= (~core) & (nd.convolve(core.astype(int), np.ones((3, 3)), mode='constant') >= 7)
    # calm the surface before gathering shades: a median over the dot's neighbours inside the figure
    sm = small.copy()
    for _ in range(1):
        p = np.pad(sm, ((1, 1), (1, 1), (0, 0)), mode='edge'); pc = np.pad(core, 1); new = sm.copy()
        for j, i in zip(*np.nonzero(core)):
            nb = p[j:j + 3, i:i + 3][pc[j:j + 3, i:i + 3]]
            if len(nb) >= 4: new[j, i] = np.median(nb, 0) * .6 + sm[j, i] * .4
        sm = new
    pts = sm[core]
    np.random.seed(seed); cen, lab = kmeans2(pts, k, minit='++', seed=seed, iter=30)
    key = np.full((th, tw), -1); key[core] = lab
    for _ in range(modes):
        p = np.pad(key, 1, constant_values=-1); new = key.copy()
        for j, i in zip(*np.nonzero(core)):
            nb = p[j:j + 3, i:i + 3].ravel(); nb = nb[nb >= 0]
            if (nb == key[j, i]).sum() - 1 <= 1 and len(nb) > 4:
                vals, c = np.unique(nb, return_counts=True); new[j, i] = vals[c.argmax()]
        key = new
    for c in range(k):
        if (key == c).any(): cen[c] = np.median(sm[key == c], 0)
    # painted dark lines inside (eyes, a mouth, the gap between two legs): kept as runs, and single dots where really dark
    inner = core & nd.binary_erosion(core, structure=np.ones((3, 3)), border_value=0)
    line = inner & (dk >= .42); lb, n = nd.label(line, structure=np.ones((3, 3)))
    if n: sz = nd.sum(line, lb, range(1, n + 1)); line &= np.isin(lb, np.nonzero(sz >= 2)[0] + 1) | (dk >= .7)
    # small strong features (an eye, a tooth, a claw's glint) that the averaging melted away come back as one or two dots:
    # a compact part of the cell that is far from the cell's shade in brightness or colour, and no long stroke
    feat = np.zeros((th, tw), bool); fcol = np.zeros((th, tw, 3))
    for j, i in zip(*np.nonzero(inner)):
        mm = m[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]; px = sub[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].astype(float); c = cen[key[j, i]]
        df = px - c; far = mm & ((np.abs(df @ np.array([.3, .59, .11])) > 62) | (np.abs(df - df.mean(-1, keepdims=True)).sum(-1) > 70))
        if far.sum() >= .34 * mm.size: feat[j, i] = True; fcol[j, i] = px[far].mean(0)
    fl, fn = nd.label(feat, structure=np.ones((3, 3)))
    if fn: fs = nd.sum(feat, fl, range(1, fn + 1)); feat &= np.isin(fl, np.nonzero(fs <= 5)[0] + 1)
    body = np.median(pts, 0); oc = body * .27 + np.array([12, 7, 11])          # the outline: a very dark shade of the body's own colour
    out = np.zeros((th + 2, tw + 2, 4), np.uint8); pc = np.pad(core, 1); pl = np.pad(line, 1)
    ring = nd.binary_dilation(pc, structure=nd.generate_binary_structure(2, 1)) & ~pc
    out[pc, :3] = np.clip(cen[np.pad(key, 1)[pc]], 0, 255); out[pc, 3] = 255
    out[pl, :3] = np.clip(np.pad(dcol, ((1, 1), (1, 1), (0, 0)))[pl] * .8, 0, 255)
    pf = np.pad(feat, 1); out[pf, :3] = np.clip(np.pad(fcol, ((1, 1), (1, 1), (0, 0)))[pf], 0, 255)
    out[ring, :3] = np.clip(oc, 0, 255); out[ring, 3] = 255
    ys_, xs_ = np.nonzero(out[..., 3]); return out[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]

WHAT = dict(mn001='a green slime with leaves and pebbles inside', mn005='a horned hare', mn009='a lean wild dog', mn025='a walking mushroom', mn045='a small goblin with a club',
            mn033='a grey crow', mn013='a bat with torn reddish wings', mn029='a man-eating flower bud on a root foot', mn021='a long-legged spider')
P = """Image 1 shows the four heroes of an HD-2D RPG as game sprites, enlarged: every dot of a hero is a clean square block, shaded with only a few FLAT colours in large calm areas, with a firm dark outline.
Image 2 is a rough block-in of a monster for the same game (%s), facing right, already on the right grid of big square dots and already in flat colours, but mushy: its face is unreadable and its edges are ragged.
Finish image 2 as a clean game sprite in EXACTLY the technique of the heroes:
- Keep the grid: the same big square dots (about %d by %d pixels of this picture each), the same size, pose, silhouette and muted earthy colours as image 2.
- FLAT cel shading only: each material has just 3 flat shades (light, middle, shadow) in large, calm, connected areas with clean stepped edges. No dithering, no stippling, no speckle, no hair-by-hair strokes, no noise, no gradients, no single stray dots.
- Make the creature READABLE: a clear eye (one or two dots with a tiny highlight), a clear mouth or beak, clear feet or claws, a few bold shapes that tell fur, feathers, slime or bark by their outline, not by texture.
- One continuous outline exactly one dot wide all around the creature, in a very dark shade of the body's own colour (dark brown, dark olive, dark slate; never pure black).
Background: perfectly flat pure magenta #FF00FF everywhere. No ground, no cast shadow, no glow, no text, no frame."""
def one(RAW, n):
    from img import gen
    th = MON[n]; (sub, m), = figures(f'{RAW}/{n}_flat.png', 1); a = cel(sub, m, th, k=8)
    S = max(6, min(10, 760 // max(a.shape[0], a.shape[1])))
    im = Image.fromarray(a).resize((a.shape[1] * S, a.shape[0] * S), Image.NEAREST)
    c = Image.new('RGB', (1024, 1024), (255, 0, 255)); c.paste(im, ((1024 - im.width) // 2, (1024 - im.height) // 2), im); c.save(f'{RAW}/{n}_cel.png')
    open(f'{RAW}/{n}_flat2_prompt.txt', 'w').write(P % (WHAT[n], S, S))
    gen(P % (WHAT[n], S, S), f'{RAW}/{n}_flat2.png', '1024x1024', 'high', images=[f'{RAW}/ref_party.png', f'{RAW}/{n}_cel.png'], tag='slice_flat2_' + n)
    return n

if __name__ == '__main__':
    RAW = sys.argv[1]; names = sys.argv[2:] or list(MON)
    with ThreadPoolExecutor(9) as ex:
        for n in ex.map(lambda n: one(RAW, n), names): print('done', n, flush=True)
