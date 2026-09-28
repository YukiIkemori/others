"""Plan the edit windows (windows.py), write plan.json, the model inputs and the gen_env jobs.
usage: python3 mkjob.py [map ...]      (writes work/<map>_w<i>_in.png and jobs.json; nothing is sent)"""
import json, os, sys
from collections import Counter
from PIL import Image
import lib, windows
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, 'work'); os.makedirs(WORK, exist_ok=True)
RAW = '/home/user/others/chronicle/design/art_ref/gen/env/propfix'
SCALE = 1.5          # 32 px/tile crop -> 48 px/tile for the model (the paintings were generated at 48)
MIN_PROPS = 3        # a window with fewer props is not worth a call: those props stay sprites
# natural size of each object in tiles (w x h as seen on the map), told to the model
SIZE = dict(barrel='0.6 wide, 0.8 tall', crate='0.7 wide, 0.7 tall', sack='0.6 wide, 0.5 tall', flower_pot='0.45 wide, 0.6 tall with the plant',
            planter='0.9 wide, 0.6 tall', net='a heap of fishing net about 0.9 wide lying on the ground', hay='0.9 wide, 0.8 tall', stump='0.6 wide, 0.5 tall',
            log='a fallen log about 1 tile long lying on the ground', rock_small='a small stone about 0.35 wide', rock='a boulder about 0.9 wide, 0.7 tall',
            fern='a fern clump about 0.8 wide', reeds='a reed clump about 0.6 wide, 1 tall', bench='a wooden bench 1 tile wide, 0.5 tall',
            table='a small round table 0.8 wide', chair='a chair 0.5 wide, 0.7 tall', bush='a bush 0.9 wide', bollard='a short iron mooring bollard 0.35 wide, 0.4 tall',
            rowboat='a small rowing boat about 1.8 long', grave='a weathered grave stone 0.5 wide, 0.7 tall', tent='a small canvas tent about 1.2 wide, 1 tall',
            bookshelf='a wooden shelf 0.9 wide, 1.2 tall', tree_giant='a huge old tree, trunk about 1 tile wide, crown up to 3 tiles', well='a stone well about 1 tile wide')
NAME = dict(rock_small='small stone', flower_pot='flower pot', tree_giant='giant tree')
def worth(objs):
    # fewer than MIN_PROPS, or only tiny stones: not worth a call (they stay sprites)
    return len(objs) >= MIN_PROPS and any(o['id'] != 'rock_small' for o in objs)
def plan_all(maps):
    P = {}
    for mid in maps:
        ws = windows.plan(mid)
        P[mid] = [dict(rect=list(r), props=[dict(i=o['i'], id=o['id'], x=o['x'], y=o['y'], v=o.get('variant', 0) or 0) for o in objs]) for r, objs in ws if worth(objs)]
        left = [dict(i=o['i'], id=o['id'], x=o['x'], y=o['y']) for r, objs in ws if not worth(objs) for o in objs]
        P[mid] = dict(windows=P[mid], leftover=left)
    return P
def crop_input(mid, win):
    x0, y0, ww, wh = win['rect']; t = 32
    objs = [o for o in lib.MAPS[mid]['objects'] if o['i'] in {p['i'] for p in win['props']}]
    comp = lib.composite(mid, t, objs)
    im = Image.new('RGBA', (ww * t, wh * t)); im.paste(comp, (-x0 * t, -y0 * t))
    if x0 < 0 or y0 < 0 or x0 + ww > lib.MAPS[mid]['w'] or y0 + wh > lib.MAPS[mid]['h']:
        # outside the map: repeat the edge (the model gets no transparent area)
        import numpy as np
        a = np.array(im); X0, Y0 = max(0, -x0) * t, max(0, -y0) * t; X1 = min(ww, lib.MAPS[mid]['w'] - x0) * t; Y1 = min(wh, lib.MAPS[mid]['h'] - y0) * t
        a = np.pad(a[Y0:Y1, X0:X1], ((Y0, wh * t - Y1), (X0, ww * t - X1), (0, 0)), mode='edge'); im = Image.fromarray(a)
    return im.convert('RGB').resize((int(ww * t * SCALE), int(wh * t * SCALE)), Image.LANCZOS)
PROMPT = ("Edit this image. It is a crop of a finished hand-painted top-down JRPG map (rich hi-bit pixel-art painting, classic steep 3/4 top-down view). "
          "Scale: 48 image pixels = one map tile; a standing person would be about 1.5 tiles (72 px) tall. "
          "Some small objects were pasted on top of the painting as separate flat sprites, and they look stuck on: flat lighting, a different pixel style, "
          "the wrong size and no shadow. The pasted objects are: %s.\n"
          "Repaint ONLY those objects so they become part of the painting. Every one of them must still be there and clearly visible after the edit (do not remove any, not even the small ones):\n"
          "- the same place: each object stays exactly where its sprite is, standing on the same spot, its base where the sprite's base is, inside its own tile;\n"
          "- a natural size for the tile scale: %s;\n"
          "- the same soft light from the upper left as the rest of the painting, the same palette, textures and brushwork, crisp pixel clusters like the surroundings;\n"
          "- a soft contact shadow on the ground right under and slightly to the lower right of each object.\n"
          "Keep EVERYTHING else exactly as it is, pixel for pixel: ground, paths, buildings, walls, cliffs, water, plants and their edges must not move, change colour or be redrawn. "
          "Do not add any other objects, people, animals, lamps or light effects. No text. "
          "Even albedo lighting as in the input: no night, no glow, no light pools, no vignette.")
def job(mid, k, win):
    c = Counter(p['id'] for p in win['props'])
    lst = ', '.join('%d %s%s' % (n, NAME.get(i, i).replace('_', ' '), '' if n == 1 else ('es' if i in ('bench','bush') else 's')) for i, n in c.items())
    sizes = '; '.join('%s: %s' % (NAME.get(i, i).replace('_', ' '), SIZE[i]) for i in c)
    x0, y0, ww, wh = win['rect']
    return dict(out='%s/%s_w%d.png' % (RAW, mid, k), tag='propfix_%s_w%d' % (mid, k), size='%dx%d' % (int(ww * 32 * SCALE), int(wh * 32 * SCALE)),
                quality='high', background='opaque', refs=['%s/%s_w%d_in.png' % (WORK, mid, k)], prompt=PROMPT % (lst, sizes))
if __name__ == '__main__':
    maps = sys.argv[1:] or list(lib.MAPS)
    pf = os.path.join(HERE, 'plan.json')
    P = json.load(open(pf)) if os.path.exists(pf) else {}
    for mid in maps:
        if mid not in P: P.update(plan_all([mid]))
    json.dump(P, open(pf, 'w'), indent=1)
    jobs = []
    for mid in maps:
        for k, w in enumerate(P[mid]['windows']):
            crop_input(mid, w).save('%s/%s_w%d_in.png' % (WORK, mid, k)); jobs.append(job(mid, k, w))
        print(mid, 'windows', len(P[mid]['windows']), 'painted', sum(len(w['props']) for w in P[mid]['windows']), 'leftover', len(P[mid]['leftover']))
    json.dump(jobs, open(os.path.join(WORK, 'jobs.json'), 'w'), indent=1)
    print(len(jobs), 'jobs')
