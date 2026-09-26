#!/usr/bin/env python3
"""Stage 1 — sheet -> clean native sprites + shared palette.

  python3 tools/extract.py configs/arun_owner_sheet.json

For every group in the config:
  crop the group box -> key out the background (paper or magenta) -> slice into rows×cols sprites
  -> per sprite: key again (tight), drop floor shadow / effects -> fit the pixel grid at the group's
  cell size -> majority vote per cell -> flip to the game facing.
Then a palette is built from all sprites of the character (k-means in Lab), every sprite is remapped,
orphan pixels are cleaned and the outer contour repaired.
Writes  out/<char>/native/<id>.png   (grid-sampled, before palette; for debugging)
        out/<char>/sprites/<id>.png  (final native sprite, transparent bg)
        out/<char>/extract.json      (per sprite: source box, cell size, native size, flips, warnings)
        out/<char>/palette.json/.png
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

sys.path.insert(0, os.path.dirname(__file__))
import pixlib as P  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_cfg(path):
    with open(path) as f:
        cfg = json.load(f)
    cfg['_dir'] = os.path.dirname(os.path.abspath(path))
    return cfg


def key(rgb, cfg, g):
    mode = g.get('bg', cfg.get('bg', 'paper'))
    if mode == 'magenta':
        fg, _ = P.key_magenta(rgb, tol=g.get('key_tol', 90))
    elif mode == 'none':
        fg = np.ones(rgb.shape[:2], bool)
    else:
        fg, _ = P.key_out(rgb, tol=g.get('key_tol', 16.0))
    return fg


def drop_effects(rgb, fg, min_L=78.0, max_chroma=14.0):
    """Remove big light, low-saturation components (slash arcs, sparkles) that are not enclosed by
    the outline. A component is 'effect' if >70% of its pixels are light and neutral."""
    lab = P.srgb_to_lab(rgb)
    light = (lab[..., 0] > min_L) & (np.hypot(lab[..., 1], lab[..., 2]) < max_chroma)
    lid, n = nd.label(fg, structure=np.ones((3, 3)))
    for i in range(1, n + 1):
        s = lid == i
        if light[s].mean() > 0.55 and s.sum() > 40:
            fg &= ~s
    return fg


def extract_group(img, cfg, g, report):
    x0, y0, x1, y1 = g['box']
    panel = img[y0:y1, x0:x1]
    fg = key(panel, cfg, g)
    ids = g['ids']
    rows, cols = g.get('rows', 1), g.get('cols', len(ids))
    if g.get('boxes'):
        masks = []
        for bx in g['boxes']:
            mm = np.zeros_like(fg); mm[bx[1] - y0:bx[3] - y0, bx[0] - x0:bx[2] - x0] = True
            masks.append(mm & fg if g.get('bg', cfg.get('bg')) != 'none' else mm)
    else:
        fgc = fg.copy()
        if g.get('effects') == 'drop':
            fgc = drop_effects(panel, fgc)
        masks = P.auto_slice(fgc, rows, cols, join=g.get('join', 6))
    if len(masks) != len(ids):
        report['warnings'].append('%s: found %d sprites, expected %d — check the box/rows/cols' % (g['name'], len(masks), len(ids)))
    pad = g.get('pad', 4)
    sprites = {}
    for sid, sm in zip(ids, masks):
        by0, by1, bx0, bx1 = P.bbox(sm)
        by0, bx0 = max(0, by0 - pad), max(0, bx0 - pad)
        by1, bx1 = min(panel.shape[0], by1 + pad), min(panel.shape[1], bx1 + pad)
        c = panel[by0:by1, bx0:bx1]
        m = sm[by0:by1, bx0:bx1].copy()
        if g.get('floor_shadow', True) and g.get('bg', cfg.get('bg', 'paper')) == 'paper':
            m = P.remove_floor_shadow(c, m, band=g.get('shadow_band', 0.10))
        if g.get('bg', cfg.get('bg', 'paper')) == 'paper' and g.get('pockets', True):
            b0 = P.bbox(m)
            if b0:
                band = np.zeros_like(m); band[int(b0[1] - 0.22 * (b0[1] - b0[0])):] = True
                m = m & ~(band & ~P.fill_pockets(c, m, cfg.get('paper_rgb', [243, 240, 235]), tol=g.get('pocket_tol', 7.0), min_px=4))
        if g.get('bg', cfg.get('bg', 'paper')) != 'none':
            m = P.largest_components(m, min_frac=g.get('min_frac', 0.01))
        sprites[sid] = dict(rgb=c, mask=m, box=[int(bx0 + x0), int(by0 + y0), int(bx1 + x0), int(by1 + y0)])
    # cell size: from the reference sprite's height (scale:'fit') or the detected period (scale:'native')
    ref = sprites.get(g.get('ref', ids[0]))
    b = P.bbox(ref['mask'])
    ref_h = b[1] - b[0]
    profs = []
    for s_ in sprites.values():
        profs.extend(P.edge_profiles(s_['rgb'], s_['mask']))
    p_det = P.estimate_period(profs)[0]
    scale = g.get('scale', 'fit')
    if scale == 'auto' and g.get('target_h'):
        # keep the sheet's own grid when it already lands near the target height (crisper), else refit
        nat_h = ref_h / p_det
        cell = p_det if abs(nat_h - g['target_h']) / g['target_h'] <= g.get('auto_tol', 0.08) else ref_h / float(g['target_h'])
    elif scale == 'fit' and g.get('target_h'):
        cell = ref_h / float(g['target_h'])
    elif isinstance(scale, (int, float)):
        cell = float(scale)
    else:
        cell = p_det
    report['groups'][g['name']] = dict(detected_period=round(float(p_det), 3), cell=round(float(cell), 3),
                                       ref_src_height=int(ref_h), native_height_at_detected=round(ref_h / p_det, 1),
                                       target_h=g.get('target_h'))
    out = {}
    for sid, s in sprites.items():
        xs, ys, _ = P.fit_grid(s['rgb'], s['mask'], p_hint=cell)
        rgb = s['rgb']
        if g.get('smooth', 0):
            rgb = P.kuwahara(rgb, r=int(g.get('smooth', 0)))
        if g.get('sampler', 'avg') == 'avg':
            nat = P.sample_grid_avg(rgb, s['mask'], xs, ys, alpha_min=g.get('alpha_min', 0.5), dark_L=g.get("dark_L", 20.0), dark_frac=g.get("dark_frac", 0.42))
        else:
            nat = P.sample_grid(rgb, s['mask'], xs, ys, alpha_min=g.get('alpha_min', 0.5))
        bb = P.bbox(nat[..., 3] > 0)
        nat = nat[bb[0]:bb[1], bb[2]:bb[3]]
        flip = bool(g.get('flip', False)) ^ bool(g.get('flip_ids', {}).get(sid, False))
        if flip:
            nat = nat[:, ::-1].copy()
        out[sid] = nat
        report['sprites'][sid] = dict(group=g['name'], kind=g.get('kind'), src_box=s['box'], cell=round(float(cell), 3),
                                      size=[int(nat.shape[1]), int(nat.shape[0])], flipped=flip)
    return out


def main():
    cfg = load_cfg(sys.argv[1])
    char = cfg['character']
    od = os.path.join(HERE, 'out', char)
    for sub in ('native', 'sprites'):
        os.makedirs(os.path.join(od, sub), exist_ok=True)
    # one sheet ("sheet" + "groups") or several ("sheets": [{sheet, bg, groups}, …]); missing files are skipped
    sheets = cfg.get('sheets') or [dict(sheet=cfg['sheet'], groups=cfg['groups'])]
    report = dict(sheet=sheets[0]['sheet'], sheets=[], warnings=[], groups={}, sprites={})
    natives = {}
    for sh in sheets:
        src = os.path.join(cfg['_dir'], sh['sheet'])
        if not os.path.exists(src):
            report['warnings'].append('missing sheet %s — skipped' % sh['sheet'])
            continue
        img = np.asarray(Image.open(src).convert('RGB'))
        scfg = dict(cfg, **{k: v for k, v in sh.items() if k not in ('groups',)})
        report['sheets'].append(sh['sheet'])
        for g in sh['groups']:
            g = dict(g)
            if 'box' not in g:
                g['box'] = [0, 0, img.shape[1], img.shape[0]]
            got = extract_group(img, scfg, g, report)
            for sid in got:
                report['sprites'][sid]['sheet'] = sh['sheet']
            natives.update(got)
            print('group', g['name'], report['groups'][g['name']])
    for sid, n in natives.items():
        Image.fromarray(n).save(os.path.join(od, 'native', sid + '.png'))
    # shared palette (sprites that opt out — e.g. portraits — get their own)
    pal_cfg = cfg.get('palette', {})
    shared = [sid for sid in natives if report['sprites'][sid]['kind'] in pal_cfg.get('kinds', ['battle', 'field'])]
    pal = P.build_palette([natives[s] for s in shared], k=pal_cfg.get('k', 56), merge_de=pal_cfg.get('merge_de', 3.0))
    pals = {'shared': pal}
    for sid in natives:
        if sid not in shared:
            pals[sid] = P.build_palette([natives[sid]], k=pal_cfg.get('k_other', 48), merge_de=pal_cfg.get('merge_de', 3.0))
    finals = {}
    for sid, n in natives.items():
        pl = pals['shared'] if sid in shared else pals[sid]
        f = P.remap(n, pl)
        f = P.mode_filter(f, pl, de_max=pal_cfg.get('mode_de', 10.0), passes=pal_cfg.get('mode_passes', 1))
        f = P.cleanup(f, pl, orphan_de=pal_cfg.get('orphan_de', 12.0))
        if pal_cfg.get('selout', True):
            f = P.selout(f, pl, max_L=pal_cfg.get('selout_L', 42.0))
        f = P.fix_outline(f, pl, None, paper=cfg.get('paper_rgb', [243, 240, 235]) if cfg.get('bg', 'paper') == 'paper' else None)
        f = P.remap(f, pl)
        bb = P.bbox(f[..., 3] > 0)
        f = f[bb[0]:bb[1], bb[2]:bb[3]]
        finals[sid] = f
        report['sprites'][sid]['size'] = [int(f.shape[1]), int(f.shape[0])]
        report['sprites'][sid]['colors'] = int(len(np.unique(f[..., :3][f[..., 3] > 0], axis=0)))
        Image.fromarray(f).save(os.path.join(od, 'sprites', sid + '.png'))
    # palette files
    with open(os.path.join(od, 'palette.json'), 'w') as fp:
        json.dump({k: ['#%02x%02x%02x' % tuple(int(v) for v in c) for c in p] for k, p in pals.items()}, fp, indent=1)
    sw = Image.new('RGB', (16 * 16, 16 * ((len(pal) + 15) // 16)), (0, 0, 0))
    for i, c in enumerate(pal):
        sw.paste(tuple(int(v) for v in c), ((i % 16) * 16, (i // 16) * 16, (i % 16) * 16 + 16, (i // 16) * 16 + 16))
    sw.save(os.path.join(od, 'palette.png'))
    report['palette_shared_colors'] = int(len(pal))
    with open(os.path.join(od, 'extract.json'), 'w') as fp:
        json.dump(report, fp, indent=1)
    for w in report['warnings']:
        print('WARN', w)
    print('shared palette', len(pal), 'colours;', len(finals), 'sprites ->', od)


if __name__ == '__main__':
    main()
