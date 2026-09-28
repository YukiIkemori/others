"""B: themed functional sprites, one sheet per set (the region's edited painting window is the style reference).
usage: python3 sheets.py jobs            -> work/sheet_jobs.json (then gen_env.py)
       python3 sheets.py cut <set>       -> v2/assets/env/<folder>/props/<id>__<set>@24/32/40.png + .json"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
HERE = os.path.dirname(os.path.abspath(__file__)); WORK = os.path.join(HERE, 'work')
RAW = '/home/user/others/chronicle/design/art_ref/gen/env/propfix'
ENV = '/home/user/others/chronicle/v2/assets/env'
# set: (asset folder, style ref window, grid, size, [(id, description, h32 or ('w', w32), solid?)])
SETS = {
 'harbor': ('harbor', 'pharos_w0', (3, 3), '1024x1024', [
   ('lamp_post', 'tall black iron harbour street lamp post with a glass lantern head (unlit, dark glass)', 62),
   ('lantern', 'small iron and glass lantern standing on the ground (unlit)', 20),
   ('board', 'wooden notice board on two posts with pinned paper notices and a small roof', 38),
   ('stall', 'fish-and-fruit market stall with a red-and-white striped cloth awning on poles', 49),
   ('signboard', 'small wooden signpost with a blank plank sign', 30),
   ('flower_pot', 'terracotta pot with red flowers', 20), ('barrel', 'weathered oak barrel with iron hoops', 26),
   ('crate', 'wooden cargo crate', 24), ('bollard', 'short black iron mooring bollard', 19)]),
 'village': ('hill_village', 'roa_w0', (2, 2), '1024x1024', [
   ('lamp_post', 'village street lamp: dark wooden post with a small iron lantern hanging from an arm (unlit)', 62),
   ('lantern', 'small iron lantern standing on the ground (unlit)', 20),
   ('signboard', 'small wooden signpost with a blank plank sign', 30),
   ('mushroom_glow', 'small cluster of pale teal glowing mushrooms', 18)]),
 'forest': ('treetop', 'fern_w0', (2, 3), '1536x1024', [
   ('lantern', 'small forest lantern: a paper-and-wood lantern on a short wooden stake (unlit)', 22),
   ('mushroom_glow', 'small cluster of pale teal glowing mushrooms', 18),
   ('board', 'rustic notice board made of rough planks and branches with pinned leaves of paper', 38),
   ('signboard', 'rustic wooden signpost made of a branch with a blank plank', 30),
   ('stall', 'small forest market stall with a green leaf-patterned cloth awning and baskets', 49),
   ('reeds', 'clump of tall reeds', 19)]),
 'cave': ('cave', 'well_w0', (2, 3), '1536x1024', [
   ('crystal', 'cluster of pale blue crystals growing from the rock', 30),
   ('mushroom_glow', 'small cluster of pale teal glowing cave mushrooms', 18),
   ('stairs_up', 'rough stone steps going up toward the top of the image, cut into cave rock', 38),
   ('grave', 'old worn stone grave marker', 24),
   ('signboard', 'old wooden signpost with a blank plank', 30)]),
 'lighthouse': ('lighthouse', 'lighthouse_1_w0', (3, 3), '1024x1024', [
   ('lantern', 'small brass ship lantern standing on the floor (unlit)', 20),
   ('lamp_post', 'tall black iron lamp post with a glass lantern head (unlit)', 62),
   ('stairs_up', 'stone stair steps going up toward the top of the image', 38),
   ('stairs_down', 'square opening in a stone floor with steps descending into darkness', 27),
   ('crate', 'wooden supply crate', 24), ('barrel', 'oak barrel with iron hoops', 26), ('sack', 'tied burlap sack', 19),
   ('table', 'small square wooden table', 24), ('signboard', 'small wooden signpost with a blank plank sign', 30)]),
 'wood': ('forest_dungeon', 'verda_1_w0', (2, 4), '1536x1024', [
   ('mushroom_glow', 'small cluster of pale teal glowing mushrooms', 18),
   ('crystal', 'cluster of pale green-blue crystals growing from mossy rock', 30),
   ('lantern', 'small old iron lantern standing on the ground (unlit)', 20),
   ('stump', 'mossy tree stump', 24), ('log', 'fallen mossy log lying on the ground', ('w', 40)),
   ('rock_small', 'small mossy stone', 16), ('signboard', 'rustic wooden signpost with a blank plank', 30)]),
}
def job(set_):
    folder, ref, (r, c), size, items = SETS[set_]
    lst = '; '.join('%d) %s' % (i + 1, d) for i, (_, d, _h) in enumerate(items))
    prompt = ("A sprite sheet of %d separate objects for a top-down JRPG map, to be placed on top of the painted map shown in the reference image. "
              "Match the reference exactly: the same hi-bit pixel-painting style and brushwork, the same palette and material textures, the same soft light from the upper left "
              "(lit tops and left sides, shaded right sides), the same classic steep 3/4 top-down view (you see the top surface and the front face; objects stand upright, base at the bottom). "
              "Arrange them in a %d x %d grid in reading order (left to right, top to bottom) with wide empty space between them; every object fully separate, nothing touching, nothing cut off. "
              "Draw each object large, filling most of its grid cell. The objects, in order: %s.\n"
              "Background: fully transparent. No ground, no floor, no shadows, no text, no labels, no numbers. "
              "Even albedo lighting: no night, no glow halos and no light spilling around the objects (lamps unlit).") % (len(items), r, c, lst)
    return dict(out='%s/sheet_%s.png' % (RAW, set_), tag='propfix_sheet_%s' % set_, size=size, quality='high', background='transparent',
                refs=['%s/%s.png' % (RAW, ref)], prompt=prompt)
def shadowed(spr, solid):
    """add a soft contact shadow under the base (light from the upper left -> shadow a little to the lower right)"""
    h, w = spr.shape[:2]; pad_b, pad_r = 3, 3
    out = np.zeros((h + pad_b, w + pad_r, 4), np.float32); out[:h, :w] = spr
    m = spr[..., 3] > 0
    ys, xs = np.nonzero(m)
    base = ys.max(); cols = xs[ys >= base - max(2, h // 8)]
    x0, x1 = cols.min(), cols.max()
    cx, cy = (x0 + x1) / 2 + 1.2, base + 0.5; rx, ry = max(3, (x1 - x0) / 2 + 2), max(1.5, (x1 - x0) / 7 + 1)
    Y, X = np.mgrid[0:h + pad_b, 0:w + pad_r]
    d = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2
    a = np.clip(1 - d, 0, 1) ** 0.8 * (0.28 if solid else 0.45) * 255
    sh = np.zeros_like(out); sh[..., 0] = 20; sh[..., 1] = 14; sh[..., 2] = 30; sh[..., 3] = a
    # object over shadow
    ao = out[..., 3:4] / 255
    res = out.copy(); res[..., :3] = out[..., :3] * ao + sh[..., :3] * (1 - ao); res[..., 3] = np.maximum(out[..., 3], sh[..., 3] * (1 - ao[..., 0]))
    return res
def cut(set_):
    import proc_props as PP
    from proc import sprite_sizes, TILES
    from envlib import pixelize_sprite, save
    folder, ref, grid, size, items = SETS[set_]
    raw = '%s/sheet_%s.png' % (RAW, set_)
    rgba = PP.load(raw, 'RGBA')
    if rgba[..., 3].min() > 250: rgba = PP.key_bg(rgba)
    comps = [(c[0], c[1], c[2], c[3], 1, None, c[4]) for c in PP.grouped(rgba, len(items))]
    ordered = PP.reading_order(comps)
    assert len(ordered) == len(items), (len(ordered), len(items))
    d = os.path.join(ENV, folder, 'props'); os.makedirs(d, exist_ok=True)
    SOLID = {'lamp_post', 'board', 'stall', 'signboard', 'barrel', 'crate', 'bollard', 'crystal', 'grave', 'table', 'stump', 'log'}
    for c, (pid, desc, hs) in zip(ordered, items):
        x0, y0, x1, y1, _, _, m = c
        crop = rgba[y0:y1, x0:x1].astype(np.float32).copy(); crop[..., 3] = np.where(m[y0:y1, x0:x1] if m.shape[:2] == rgba.shape[:2] else m, crop[..., 3], 0)
        hh, ww = crop.shape[:2]
        base = json.load(open([os.path.join(ENV, f, 'props', pid + '.json') for f in ('common', 'harbor') if os.path.exists(os.path.join(ENV, f, 'props', pid + '.json'))][0]))
        if isinstance(hs, tuple): w32 = hs[1]; h32 = max(1, round(hh * w32 / ww))
        else: h32 = hs; w32 = max(1, round(ww * h32 / hh))
        bw = base['cell']['32'][0]
        if w32 > bw * 1.15 and pid != 'lamp_post':   # (a lamp arm may reach past the tile)   # keep the footprint: no wider than the old sprite (+15 %)
            w32 = round(bw * 1.15); h32 = max(1, round(hh * w32 / ww))
        sid = '%s__%s' % (pid, set_); files = {}; cells = {}; feet = {}
        base_light = round(base['light32'][1] * h32 / base['cell']['32'][1]) if base.get('light32') else None; light = None
        for t in TILES:
            w, h = sprite_sizes(w32, h32)[t]
            spr = pixelize_sprite(crop, w, h, ncol=32, outline=False, seed=1)
            if not pid.startswith('stairs'): spr = shadowed(spr, pid in SOLID)   # stairs lie in the floor: no shadow
            fn = '%s@%d.png' % (sid, t); save(spr, os.path.join(d, fn)); files[t] = fn
            al = spr[:h, :w, 3] > 200; ys = np.nonzero(al.any(1))[0]; base = al[max(0, ys.max() - max(2, h // 10)):ys.max() + 1]
            fx = int(round(np.nonzero(base.any(0))[0].mean()))   # feet under the base (a lamp post's arm makes the box off-centre)
            cells[t] = [spr.shape[1], spr.shape[0]]; feet[t] = [fx, h - 1]
            if t == 32 and base_light is not None:
                ly = h - 1 + base_light; row = al[max(0, ly - 3):ly + 4]; xs = np.nonzero(row.any(0))[0]
                far = xs[np.abs(xs - fx) > 3]; lx = int(round(far.mean())) - fx if far.size and pid == 'lamp_post' else 0
                light = [lx, base_light]
                if pid == 'lamp_post' and lx:   # a hanging lantern: the light is the middle of the part off the post
                    off = al.copy(); off[:, max(0, fx - 4):fx + 5] = False; rows = np.nonzero(off.sum(1) >= 4)[0]
                    if rows.size: light = [lx, int(round(rows.mean())) - (h - 1)]
        meta = dict(id=sid, kind='props', theme=folder, set=set_, base=pid, frames=['default'], cell=cells, feet=feet, files=files,
                    src=os.path.relpath(raw, '/home/user/others/chronicle'))
        if light: meta['light32'] = light
        json.dump(meta, open(os.path.join(d, sid + '.json'), 'w'), indent=1)
        print(sid, w32, h32, meta.get('light32'))
if __name__ == '__main__':
    if sys.argv[1] == 'jobs':
        sets = sys.argv[2:] or list(SETS)
        json.dump([job(s) for s in sets], open(os.path.join(WORK, 'sheet_jobs.json'), 'w'), indent=1); print(len(sets), 'sheet jobs')
    else:
        cut(sys.argv[2])
