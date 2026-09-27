"""Rebuild every engine asset under v2/assets/env from the raw generations (idempotent).
   python3 build_all.py [mat|face|props|bld|bbg|all] [filter]"""
import sys, os, json, glob
sys.path.insert(0, os.path.dirname(__file__))
from proc import *
from proc_props import cut_sheet
import guides
G = '/home/user/others/chronicle/design/art_ref/gen/env/'
TG = json.load(open(os.path.join(os.path.dirname(__file__), 'proc_targets.json')))
what = sys.argv[1] if len(sys.argv) > 1 else 'all'
flt = sys.argv[2] if len(sys.argv) > 2 else ''

def tgt(mid, own=None, k=1.6, lo=12, hi=40):
    m, s, _ = TG['out'].get(mid, [80, 20, None])
    return m, max(lo, min(hi, s * k))

# raw file, theme, id, (mean, std) override, sat, derive
MATS = [
 ('common/grass', 'common', 'grass', None, 0.8), ('common/tall_grass', 'common', 'tall_grass', None, 0.8), ('common/flowers', 'common', 'flowers', None, 0.85),
 ('common/dirt', 'common', 'dirt', None, 0.9), ('common/road', 'common', 'road', None, 0.85), ('common/moss_earth', 'common', 'moss_earth', None, 0.85),
 ('common/sand', 'common', 'sand', None, 0.8), ('harbor/cobble', 'common', 'cobble', (88, 30), 0.85), ('common/stone_floor', 'common', 'stone_floor', (92, 26), 0.85),
 ('common/plank', 'common', 'plank', (74, 26), 0.85), ('common/wood_floor', 'common', 'wood_floor', (80, 26), 0.9), ('common/carpet', 'common', 'carpet', (70, 20), 0.9),
 ('common/cave_floor', 'common', 'cave_floor', (64, 18), 0.9), ('common/bark_floor', 'common', 'bark_floor', (74, 18), 0.9), ('common/root_floor', 'common', 'root_floor', (62, 20), 0.9),
 ('common/water', 'common', 'water', (40, 12), 0.95), ('common/sea', 'common', 'sea', (38, 12), 0.95), ('common/shallow', 'common', 'shallow', (68, 16), 0.9),
 ('common/forest_dark', 'common', 'forest_dark', (50, 16), 0.85), ('common/rock', 'common', 'rock', (40, 12), 0.8), ('common/wall_cave', 'common', 'wall_cave', (34, 9), 0.9),
 ('common/wall_bark', 'common', 'wall_bark', (38, 9), 0.9), ('common/wall_stone', 'common', 'wall_stone', (44, 10), 0.8), ('common/wall_moss', 'common', 'wall_moss', (38, 9), 0.85),
 ('common/wall_wood', 'common', 'wall_wood', (36, 8), 0.85),
]
RM = {'desert': [('dune_sand', 112, 22), ('cracked_clay', 92, 22), ('sandstone_floor', 104, 24), ('wall_sandstone', 50, 12)],
      'snow': [('snow', 176, 20), ('snow_path', 132, 22), ('ice', 118, 22), ('wall_snow', 70, 16)],
      'marsh': [('mud', 58, 16), ('marsh_water', 40, 12), ('peat_grass', 60, 16), ('wall_marsh', 40, 10)],
      'isles': [('white_paving', 150, 22), ('coral_sand', 140, 20), ('tide_rock', 60, 18), ('glow_sea', 40, 16)],
      'mine': [('mine_floor', 60, 16), ('scaffold', 72, 24), ('ore_rock', 36, 12), ('iron_grate', 56, 20)],
      'ash': [('ash', 88, 18), ('basalt_floor', 56, 18), ('lava', 150, 40), ('obsidian', 36, 14)],
      'star': [('marble_floor', 140, 22), ('star_mosaic', 70, 22), ('garden_hedge_top', 52, 14), ('wall_marble', 60, 12)]}
for th, lst in RM.items():
    for mid, m, sd in lst: MATS.append(('%s/%s' % (th, mid), th, mid, (m, sd), 0.9))
RF = {'desert': ('sandstone', 96), 'snow': ('snow_cliff', 110), 'marsh': ('mud_bank', 52), 'isles': ('white_wall', 150), 'mine': ('mine_wall', 52), 'ash': ('basalt', 48), 'star': ('marble', 130)}
DERIVED = [  # new id, from id, transform
 ('pier', 'plank', 'rot'), ('bridge', 'plank', 'rot+'), ('deck', 'plank', '+'), ('ladder', 'plank', '-'), ('deep_water', 'sea', 'dark'), ('cliff', 'grass', 'cliff'), ('wall_brick', 'wall_stone', 'brick'),
]
FACES = [('rock', (60, 22)), ('cliff', (54, 20)), ('stone', (80, 24)), ('brick', (58, 20)), ('wood', (46, 16)), ('moss', (62, 20)), ('bark', (46, 16)), ('cave', (54, 18))]

def do_mats():
    for raw, th, mid, ov, sat in MATS:
        if flt and flt not in mid: continue
        p = G + 'mat/' + raw + '.png'
        if not os.path.exists(p): print('missing', p); continue
        m, s = ov if ov else tgt(mid)
        print(mat(p, th, mid, mean=m, std=s, sat=sat)['id'])
    for nid, src, tr in DERIVED:
        if flt and flt not in nid: continue
        d = ROOT + '/common/mat/'
        if not os.path.exists(d + src + '.json'): continue
        sj = json.load(open(d + src + '.json'))
        files = {}
        for t in TILES:
            a = load(d + sj['files'][str(t)] if str(t) in sj['files'] else d + sj['files'][t], 'RGB')
            if tr.startswith('rot'): a = np.ascontiguousarray(np.rot90(a))
            if tr.endswith('+'): a = a * 1.08
            if tr == '-': a = a * 0.9
            if tr == 'dark': a = a * 0.62
            if tr == 'cliff': a = calibrate(a, 42, 12, 0.75)
            if tr == 'brick': a = a * np.array([1.12, 0.92, 0.85])
            fn = '%s@%d.png' % (nid, t); save(a, d + fn); files[t] = fn
        j = dict(sj, id=nid, files=files, derived_from=src, transform=tr)
        json.dump(j, open(d + nid + '.json', 'w'), indent=1)
        print('derived', nid)

def do_faces():
    for st, (m, s) in FACES:
        if flt and flt not in st: continue
        p = G + 'mat/common/face_%s.png' % st
        if not os.path.exists(p): print('missing', p); continue
        print(face(p, 'common', st, mean=m, std=s, sat=0.85)['id'])
    for th, (st, m) in RF.items():
        if flt and flt not in st and flt not in th: continue
        p = G + 'mat/%s/face_%s.png' % (th, st)
        if not os.path.exists(p): print('missing', p); continue
        print(face(p, th, st, mean=m, std=22, sat=0.9)['id'])

PROPS = {
 'harbor_a': ('harbor', [['barrel', 26], ['crate', 24], ['sack', 19], ['bench', ('w', 32)], ['lamp_post', 62, {'light32': [0, -52]}], ['well', 52], ['stall', ('w', 46)], ['board', 38],
              ['net', ('w', 30)], ['bollard', 19], ['rowboat', ('w', 62)], ['flower_pot', 20]]),
 'town_a': ('common', [['chair', 22], ['table', 24, {'light32': [0, -14]}], ['hay', 24], ['planter', ('w', 30)], ['signboard', 30], ['fence', ('w', 38)], ['lantern', 20, {'light32': [0, -9]}],
              ['grave', 24], ['tent', 34], ['log', ('w', 40)], ['stump', 24], ['rock_small', 16]]),
 'interior_a': ('common', [['bed', 36], ['bookshelf', 42], ['counter', ('w', 44)], ['stove', 38, {'light32': [0, -8]}], ['cupboard', 40], ['dresser', 30], ['stool', 14], ['house_plant', 24],
              ['shelf_jars', 32], ['wash_tub', 16], ['rug_roll', ('w', 28)], ['weapon_rack', 34]]),
 'dungeon_b': ('common', [['stairs_up', ('w', 34)], ['stairs_down', ('w', 34)], ['door', 36], ['lever_off', 22], ['lever_on', 22], ['ladder_prop', 40], ['rope_bridge', ('w', 36)],
              ['spring', ('w', 62), {'light32': [0, -20]}], ['crystal', 30, {'light32': [0, -12]}], ['songstone', 46, {'light32': [0, -18]}], ['mushroom_glow', 18, {'light32': [0, -5]}], ['beacon', 44, {'light32': [0, -30]}]]),
 'trees_broad': ('common', [['tree_v0', 68], ['tree_v1', 70], ['tree_v2', 64], ['tree_v3', 48], ['tree_v4', 66], ['tree_v5', 62]]),
 'trees_conifer': ('common', [['pine_v0', 74], ['pine_v1', 72], ['pine_v2', 76], ['pine_v3', 48], ['pine_v4', 70], ['pine_v5', 72]]),
 'trees_forest': ('common', [['tree_giant_v0', 120], ['tree_giant_v1', 116], ['tree_moss_v0', 68], ['tree_moss_v1', 66], ['tree_dead_v0', 64], ['tree_glow_v0', 66]]),
 'nature_a': ('common', [['bush_v0', ('w', 30)], ['bush_v1', ('w', 30)], ['fern', ('w', 22)], ['roots_v0', ('w', 46)], ['roots_v1', ('w', 46)], ['rock', ('w', 28)], ['rock_v1', ('w', 26)],
              ['log_moss', ('w', 40)], ['dec_tuft', ('w', 12)], ['dec_tuft_v1', ('w', 12)], ['dec_flowers', ('w', 12)], ['dec_pebbles', ('w', 13)], ['dec_leaves', ('w', 14)], ['dec_mush', ('w', 12)], ['reeds', ('w', 16)]]),
 'ship': ('harbor', [['ship', ('w', 160), {'light32': [-60, -70]}]]),
}
RP = {
 'desert': ['desert_palm_v0', 'desert_palm_v1', 'cactus', 'desert_stall', 'clay_jars', 'carpet_rack', 'obelisk', 'broken_pillar', 'tomb_urn', 'bones', 'thorn_bush', 'dry_well', 'copper_brazier', 'cart_barrels', 'sand_mound'],
 'snow': ['snow_fir_v0', 'snow_fir_v1', 'snow_rock', 'firewood', 'sled', 'frozen_well', 'snow_bank', 'ice_crystal', 'stove_pipe', 'ice_hole', 'snow_fence', 'snow_barrel', 'snow_lamp', 'hay_sled', 'snow_sign'],
 'marsh': ['willow', 'swamp_tree', 'reeds_tall', 'lily_pads', 'stilt_posts', 'bell_frame', 'grave_moss', 'wisp_lamp', 'rotten_stump', 'board_steps', 'mangrove_roots', 'fish_trap', 'mud_boat', 'crooked_sign', 'pale_mushrooms'],
 'isles': ['coco_palm', 'palm_small', 'coral', 'anchor', 'buoys', 'net_frame', 'white_pot', 'blue_bench', 'shells', 'fish_barrel', 'rope_bollard', 'lamp_pillar', 'driftwood', 'palm_umbrella', 'map_sign'],
 'mine': ['mine_cart_ore', 'mine_cart', 'rail', 'ore_blue', 'ore_copper', 'timber_frame', 'anvil', 'forge', 'tool_rack', 'hook_lamp', 'tool_crate', 'oath_stone', 'bellows', 'coal_barrel', 'lift_cage'],
 'ash': ['charred_tree', 'charred_stump', 'steam_vent', 'obsidian_shards', 'lava_rock', 'hot_spring', 'iron_brazier', 'arena_banner', 'phoenix_statue', 'volcanic_rocks', 'sulphur', 'rope_post', 'ash_weapon_rack', 'water_urn', 'ash_bush'],
 'star': ['telescope', 'orrery', 'lectern', 'scholar_statue', 'star_lamp', 'marble_bench', 'fountain', 'topiary', 'book_stack', 'globe', 'book_cart', 'star_dial', 'star_banner', 'blue_flowers', 'iron_gate'],
}
TALL = ('palm', 'fir', 'willow', 'tree', 'obelisk', 'pillar', 'statue', 'lamp', 'banner', 'telescope', 'orrery', 'gate', 'frame', 'cage', 'topiary', 'fountain', 'forge')
for th, ids in RP.items():
    PROPS['%s_a' % th] = (th, [[i, 66 if any(k in i for k in ('palm', 'fir', 'willow', 'tree')) else 44 if any(k in i for k in TALL) else 24] for i in ids])
PAIRS = {  # multi-frame props assembled from single cut frames: id -> (frame names, parts)
 'dungeon_a': ('common', [['chest', 'closed'], ['chest', 'open'], ['chest', 'rare_closed'], ['chest', 'rare_open'], ['brazier', 'off'], ['brazier', 'on'],
                          ['waylamp', 'off'], ['waylamp', 'on'], ['torch', 'off'], ['torch', 'on'], ['switch', 'off'], ['switch', 'on']]),
}
PAIR_SIZE = {'chest': ('w', 26), 'brazier': 34, 'waylamp': 52, 'torch': 26, 'switch': ('w', 24)}
PAIR_LIGHT = {'brazier': [0, -24], 'waylamp': [0, -36], 'torch': [0, -20], 'switch': [0, -4], 'chest': None}

def do_props():
    for sheet, (th, spec) in PROPS.items():
        if flt and flt not in sheet: continue
        p = G + 'props/%s.png' % sheet
        if not os.path.exists(p): print('missing', p); continue
        for m in cut_sheet(p, th, spec): print(sheet, m['id'], m['cell'][32])
    for sheet, (th, spec) in PAIRS.items():
        if flt and flt not in sheet: continue
        p = G + 'props/%s.png' % sheet
        if not os.path.exists(p): print('missing', p); continue
        cut_pairs(p, th, spec)

def cut_pairs(raw, th, spec):
    from proc_props import grouped, reading_order
    rgba = load(raw, 'RGBA')
    ordered = reading_order(grouped(rgba, len(spec)))
    print('pairs: found', len(ordered))
    groups = {}
    for c, (pid, fr) in zip(ordered, spec):
        x0, y0, x1, y1, msk = c
        crop = rgba[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(msk, crop[..., 3], 0)
        groups.setdefault(pid, []).append((fr, crop))
    for pid, frs in groups.items():
        # common canvas: every frame scaled by the same factor (from the first frame), bottom-centre aligned
        sz = PAIR_SIZE[pid]
        h0, w0 = frs[0][1].shape[:2]
        f = (sz[1] / w0) if isinstance(sz, tuple) else (sz / h0)
        W = max(int(round(c.shape[1] * f)) for _, c in frs) + 2
        H = max(int(round(c.shape[0] * f)) for _, c in frs) + 1
        hiW, hiH = int(W / f), int(H / f)
        crops = []
        for _, c in frs:
            can = np.zeros((hiH, hiW, 4), np.float32)
            ox = (hiW - c.shape[1]) // 2; oy = hiH - c.shape[0]
            can[oy:oy + c.shape[0], ox:ox + c.shape[1]] = c
            crops.append(can)
        lt = PAIR_LIGHT.get(pid)
        extra = dict(src=os.path.relpath(raw, '/home/user/others/chronicle'))
        if lt: extra['light32'] = lt
        m = write_sprite_set(crops, th, 'props', pid, [n for n, _ in frs], (W, H), (W / 2, H - 1), extra)
        print('pair', pid, m['frames'], m['cell'][32])

def do_bld():
    defs = json.load(open(os.path.join(os.path.dirname(__file__), 'bld_defs.json')))
    for th in RP:
        for bid, w, h, wall_n in [('house_s', 5, 4, 2), ('shop_m', 6, 5, 2), ('hall_l', 8, 6, 3)]:
            d = dict(id='%s_%s' % (th, bid), x=0, y=0, w=w, h=h, wall=wall_n, door=dict(x=w // 2, y=h - 1), windows=2 if w < 8 else 3)
            g = guides.layout(d)
            defs[d['id']] = dict(d=d, theme=th, W=g['W'], H=g['H'], img=[(g['W'] * 7 + 15) // 16 * 16, (g['H'] * 7 + 15) // 16 * 16])
    for bid, e in defs.items():
        if flt and flt not in bid: continue
        p = G + 'bld/%s/%s.png' % (e['theme'], bid)
        if not os.path.exists(p): print('missing', p); continue
        d = e['d']
        im, g = guides.draw_guide(d)
        # generated at padded 16-multiple size: crop to the guide area
        rgba = load(p, 'RGBA')
        tmp = '/tmp/claude-0/-home-user-others/00503990-4adc-574c-b37a-87d13f1cb58c/scratchpad/_bld.png'
        save(rgba[:g['H'] * 7 * rgba.shape[0] // e['img'][1], :g['W'] * 7 * rgba.shape[1] // e['img'][0]], tmp)
        m = building(tmp, e['theme'], d, g, tone=dict(mul=0.88, sat=0.88))
        m['src'] = os.path.relpath(p, '/home/user/others/chronicle')
        json.dump(m, open(os.path.join(ROOT, e['theme'], 'bld', bid + '.json'), 'w'), indent=1, default=str)
        print('bld', bid, len(m['emit32']), 'windows')

if what in ('mat', 'all'): do_mats()
if what in ('face', 'all'): do_faces()
if what in ('props', 'all'): do_props()
if what in ('bld', 'all'): do_bld()

def combine(theme, new, parts, names):
    """join single-frame props into one multi-frame strip (bottom-centre aligned)"""
    d = ROOT + '/%s/props/' % theme
    js = [json.load(open(d + p + '.json')) for p in parts]
    files = {}; cells = {}; feet = {}
    for t in TILES:
        ims = [load(d + j['files'][str(t)]) for j in js]
        W = max(i.shape[1] for i in ims); H = max(i.shape[0] for i in ims)
        fr = []
        for im in ims:
            c = np.zeros((H, W, 4), np.float32); ox = (W - im.shape[1]) // 2; c[H - im.shape[0]:, ox:ox + im.shape[1]] = im; fr.append(c)
        fn = '%s@%d.png' % (new, t); save(np.concatenate(fr, 1), d + fn); files[t] = fn; cells[t] = [W, H]; feet[t] = [W / 2, H - 1]
    for p in parts:
        for t in TILES:
            try: os.remove(d + '%s@%d.png' % (p, t))
            except OSError: pass
        os.remove(d + p + '.json')
    json.dump(dict(js[0], id=new, frames=names, files=files, cell=cells, feet=feet), open(d + new + '.json', 'w'), indent=1)
    print('combined', new)

if what in ('props', 'all') and os.path.exists(ROOT + '/common/props/lever_off.json'):
    combine('common', 'lever', ['lever_off', 'lever_on'], ['off', 'on'])

def brighten(theme, pid, k):
    d = ROOT + '/%s/props/' % theme
    j = json.load(open(d + pid + '.json'))
    for t, fn in j['files'].items():
        a = load(d + fn); a[..., :3] = np.clip(a[..., :3] * k + 6, 0, 255); save(a, d + fn)
    print('brightened', pid, k)

if what in ('props', 'all') and (not flt or flt in 'dungeon_a'):
    brighten('common', 'chest', 1.22)
