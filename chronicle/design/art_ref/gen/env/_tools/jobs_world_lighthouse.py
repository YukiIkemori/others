"""World-map lighthouse (w_lighthouse in v2/tools/gen_world.js): a tall painted tower sprite.

   python3 jobs_world_lighthouse.py guide        -> guide png + job json (scratch)
   python3 gen_env.py <job json>                  -> raw generations (bld/harbor/w_lighthouse_gN.png)
   python3 jobs_world_lighthouse.py build <raw>   -> v2/assets/env/harbor/bld/w_lighthouse@24|32|40.png, _emit, .json

Geometry (art px at tile 32): footprint 3x3 tiles (x 105..107, y 122..124), door on the middle column (106,124).
The sprite is 112 x 208 (8 px margin left/right, 3.5 tiles above the footprint): rocky cape base, a red-and-white
banded round tower, an iron gallery, a glass lantern room and a dark dome. Everything above the footprint's top row
is drawn over characters by TERRAIN (layer 'split'), so the hero walks behind the upper tower.
The emission layer is only the lantern glass (props_light.js turns it on after the lighthouse is relit)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from style import PIXEL
G = '/home/user/others/chronicle/design/art_ref/gen/env/'
ROOT = '/home/user/others/chronicle/v2/assets/env'
SCR = '/tmp/claude-0/-home-user-others/00503990-4adc-574c-b37a-87d13f1cb58c/scratchpad/world_lighthouse/'
ID = 'w_lighthouse'
W, H, OV, SC = 112, 208, 8, 7
FOOT = (3, 3)
# regions (art px, sprite coordinates)
ROCK = (0, 150, 112, 208)
TOWER = [(26, 196), (86, 196), (79, 62), (33, 62)]    # tapering body (bottom wider)
GALLERY = (24, 54, 88, 64)
LANTERN = (37, 28, 75, 54)
DOME = (33, 12, 79, 30)
DOOR = (56 - 11, 208 - 32, 56 + 11, 208)
LANTERN_C = (56, 40)


def guide():
    im = Image.new('RGB', (W * SC, H * SC), (255, 0, 255))
    d = ImageDraw.Draw(im)
    S = lambda r: tuple(v * SC for v in r)
    # rocks: lumpy blob
    d.ellipse(S((-4, 150, 116, 214)), fill=(96, 86, 80))
    for cx, cy, r in [(12, 176, 14), (100, 178, 14), (30, 160, 12), (84, 160, 12), (56, 200, 18)]:
        d.ellipse(S((cx - r, cy - r, cx + r, cy + r)), fill=(104, 94, 86))
    # tower with bands
    d.polygon([(x * SC, y * SC) for x, y in TOWER], fill=(236, 232, 222))
    for (y0, y1) in ((70, 88), (106, 124), (142, 160)):
        l0 = 26 + (y0 - 196) / (62 - 196) * 7; r0 = 86 - (y0 - 196) / (62 - 196) * 7
        l1 = 26 + (y1 - 196) / (62 - 196) * 7; r1 = 86 - (y1 - 196) / (62 - 196) * 7
        d.polygon([(l0 * SC, y0 * SC), (r0 * SC, y0 * SC), (r1 * SC, y1 * SC), (l1 * SC, y1 * SC)], fill=(178, 52, 44))
    d.rectangle(S(GALLERY), fill=(48, 44, 56))
    d.rectangle(S(LANTERN), fill=(250, 214, 110), outline=(40, 36, 44), width=SC * 2)
    for x in (47, 56, 65):
        d.rectangle(S((x - 1, LANTERN[1], x + 1, LANTERN[3])), fill=(40, 36, 44))
    d.pieslice(S((DOME[0], DOME[1], DOME[2], DOME[3] + 18)), 180, 360, fill=(52, 60, 96))
    d.rectangle(S((54, 2, 58, 14)), fill=(40, 36, 44))
    # small slit windows (dark)
    for y in (96, 132):
        d.rectangle(S((52, y, 60, y + 10)), fill=(50, 40, 44))
    d.rectangle(S(DOOR), fill=(70, 40, 24), outline=(30, 18, 12), width=SC)
    return im


PROMPT = (
    "Paint ONE lighthouse for a top-down pixel-art JRPG world map (overworld), in the classic 3/4 top-down RPG view: "
    "the tall tower is seen from the front and slightly above, standing on a small cluster of dark sea-worn cape rocks. "
    "The first attached image is an exact layout guide at the final proportions: keep the outer silhouette, the rocks at the bottom, "
    "the round tapering tower with three broad red bands on white (like a classic painted lighthouse), the dark iron gallery ring with a railing, "
    "the glass lantern room (the yellow block, with thin dark iron mullions), the dark blue-slate domed cap with a small iron finial and weather vane, "
    "and the arched wooden door at the base (dark brown rectangle: it must stay exactly there, same size, at ground level, a real door you can walk through). "
    "Two tiny dark slit windows on the tower. A few stone steps and a little moss and sea-salt stains on the rocks. "
    "The second attached image shows the painted look of the harbour town nearby (its small red-and-white lighthouse on a rock is the model for this one): match that palette and rendering, but at the size and layout of the guide. "
    "The lantern glass is a warm pale amber (the lamp inside), the rest is plain base colour. "
    "The whole image is %d x %d art pixels (each art pixel %dx%d image pixels).\n" % (W, H, SC, SC)
    + PIXEL + "\n"
    "Lighting: neutral, soft, even light from the upper left, like a calm overcast evening; NO cast shadows, NO night darkness, NO light beams, "
    "NO glow halos, NO light pools, NO vignette. (The game engine adds the night lighting and the lamp glow on top later, so this must be the clean base colours.)\n"
    "Background: fully transparent (the magenta in the guide is background). No sea, no grass, no ground outside the rocks, no shadow, no people, no birds, no text, no letters.")


def job(n=2):
    os.makedirs(SCR, exist_ok=True)
    gp = G + 'bld/guide/%s.png' % ID
    guide().save(gp)
    ref = SCR + 'ref_pharos_lighthouse.png'
    Image.open(G + '_tools/under/pharos/out2/pharos@32.png').crop((1700, 1060, 2040, 1500)).resize((680, 880), Image.NEAREST).save(ref)
    jobs = [dict(out=G + 'bld/harbor/%s_g%d.png' % (ID, i + 1), tag='env_bld_' + ID, size='%dx%d' % (W * SC, H * SC), quality='high',
                 background='transparent', refs=[gp, ref], prompt=PROMPT) for i in range(n)]
    json.dump(jobs, open(SCR + 'jobs_lighthouse.json', 'w'), indent=1)
    print(SCR + 'jobs_lighthouse.json', gp)


def build(raw):
    from envlib import load, save, key_bg, pixelize_sprite, calibrate
    rgba = load(raw, 'RGBA')
    if rgba[..., 3].min() > 250:
        rgba = key_bg(rgba)
    dd = os.path.join(ROOT, 'harbor', 'bld'); os.makedirs(dd, exist_ok=True)
    files, efiles = {}, {}
    for t in (24, 32, 40):
        k = t / 32
        w, h = int(round(W * k)), int(round(H * k))
        s = pixelize_sprite(rgba, w, h, ncol=48, outline=True, seed=2)
        m = s[..., 3] > 0
        s[..., :3] = np.where(m[..., None], calibrate(s[..., :3], None, None, 0.9) * 0.9, s[..., :3])
        # emission: bright warm pixels inside the lantern box (the glass), not the iron frame
        x0, y0, x1, y1 = [int(round(v * k)) for v in LANTERN]
        box = np.zeros(m.shape, bool); box[y0:y1, x0:x1] = True
        r, g, b = s[..., 0], s[..., 1], s[..., 2]
        lit = box & m & (r > 150) & (g > 0.6 * r) & (r - b > 30)
        if lit.sum() < 12:
            lit = box & m & ((r + g + b) / 3 > 110)
        from scipy import ndimage   # drop stray rust-orange specks on the gallery
        lab, n = ndimage.label(lit)
        for i, sl in enumerate(ndimage.find_objects(lab)):
            if (lab[sl] == i + 1).sum() < 4: lit[lab == i + 1] = False
        fn = '%s@%d.png' % (ID, t)
        save(s, os.path.join(dd, fn)); files[t] = fn
        e = s.copy()
        e[..., :3] = np.where(lit[..., None], np.clip(e[..., :3] * 1.25 + np.array([30, 20, 0]), 0, 255), e[..., :3])
        e[..., 3] = np.where(lit, 255, 0)
        efn = '%s_emit@%d.png' % (ID, t)
        save(e, os.path.join(dd, efn)); efiles[t] = efn
        print(t, 'lit px', int(lit.sum()))
    meta = dict(id=ID, kind='building', theme='harbor', footprint=list(FOOT), wall=3, files=files, emitFiles=efiles,
                size={t: [int(round(W * t / 32)), int(round(H * t / 32))] for t in (24, 32, 40)},
                anchor32=[OV, H], door32=dict(x=(DOOR[0] + DOOR[2]) / 2 - OV, y=0, w=DOOR[2] - DOOR[0], h=DOOR[3] - DOOR[1]),
                # the lantern (props_light.js kind 'beacon': the lamp, its pool on the cape and the sweeping beam)
                emit32=[dict(kind='beacon', x=LANTERN_C[0] - OV, y=LANTERN_C[1] - H)],
                roof32=[DOME[0] - OV, DOME[1] - H, DOME[2] - OV, GALLERY[3] - H], wallTop32=GALLERY[3] - H,
                src=os.path.relpath(raw, '/home/user/others/chronicle'),
                def_=dict(type='building', id=ID, x=105, y=122, w=3, h=3, door=dict(x=106, y=124)))
    json.dump(meta, open(os.path.join(dd, ID + '.json'), 'w'), indent=1)
    print('ok', meta['size'])


if __name__ == '__main__':
    if sys.argv[1] == 'guide': job(int(sys.argv[2]) if len(sys.argv) > 2 else 2)
    elif sys.argv[1] == 'build': build(sys.argv[2])
