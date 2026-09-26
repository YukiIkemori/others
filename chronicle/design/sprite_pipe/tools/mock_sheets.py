#!/usr/bin/env python3
"""Test sheets in the brief's layouts, made from the placeholder sprites (out/<char>/sprites) the way an
image AI tends to deliver them: irregular upscaled pixel grid, soft anti-aliased edges, colour noise,
off-magenta background with noise — plus deliberate mistakes the validator must catch.

  python3 tools/mock_sheets.py [--src out/arun/sprites] [--dst work/mock_sheets] [--clean]

--clean  : no deliberate mistakes (the validator should report no 'redo')
Writes <dst>/sheet<N>.png and <dst>/truth.json (the mistakes that were injected).
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brief_spec import SHEETS  # noqa: E402
import build as B  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(7)


def ld(src, sid):
    return np.asarray(Image.open(os.path.join(src, sid + '.png')).convert('RGBA')).copy()


def crop(im):
    b = np.where(im[..., 3] > 0)
    return im[b[0].min():b[0].max() + 1, b[1].min():b[1].max() + 1]


def nn_scale(im, k):
    h, w = im.shape[:2]
    ys = (np.arange(int(round(h * k))) / k).astype(int).clip(0, h - 1)
    xs = (np.arange(int(round(w * k))) / k).astype(int).clip(0, w - 1)
    return im[ys][:, xs]


def weapon(kind):
    """Tiny pixel-art weapons pointing left (tip at x=0)."""
    O, S1, S2, S3 = (24, 20, 26, 255), (206, 210, 218, 255), (150, 156, 170, 255), (98, 100, 116, 255)
    BR, BR2, WD, WD2, GEM = (196, 150, 64, 255), (130, 92, 40, 255), (122, 84, 52, 255), (84, 56, 36, 255), (90, 200, 220, 255)
    if kind in ('sword', 'greatsword', 'dagger'):
        L, T = {'sword': (22, 3), 'greatsword': (30, 5), 'dagger': (11, 3)}[kind]
        g = 7 if kind == 'greatsword' else 5
        W = L + 2 + 6
        H = g + 2
        im = np.zeros((H, W, 4), np.uint8)
        cy = H // 2
        for x in range(L):
            for t in range(T):
                y = cy - T // 2 + t
                im[y, x + 1] = S1 if t < T // 2 else S2 if t < T - 1 else S3
            im[cy - T // 2 - 1, x + 1] = O
            im[cy - T // 2 + T, x + 1] = O
        im[cy, 0] = O
        gx = L + 1
        im[cy - g // 2:cy - g // 2 + g, gx] = BR
        im[cy - g // 2:cy - g // 2 + g, gx + 1] = BR2
        im[cy, gx + 2:gx + 5] = WD
        im[cy - 1, gx + 2:gx + 5] = WD2
        im[cy - 1:cy + 1, gx + 5] = BR
        return im, (gx + 3, cy)
    if kind == 'bow':
        H, W = 28, 9
        im = np.zeros((H, W, 4), np.uint8)
        for y in range(H):
            t = (y - H / 2) / (H / 2)
            x = int(round(1 + 6 * t * t))
            im[y, x] = WD
            im[y, min(W - 1, x + 1)] = WD2
            im[y, W - 1 if abs(t) < 0.98 else x] = (220, 220, 200, 255)
        return im, (W // 2 + 1, H // 2)
    L = 34
    im = np.zeros((6, L, 4), np.uint8)
    im[2:4, 4:] = WD
    im[3, 4:] = WD2
    im[1:5, 0:4] = GEM
    im[0, 1:3] = GEM
    im[5, 1:3] = GEM
    return im, (int(L * 0.62), 3)


def paste(dst, im, x, y):
    h, w = im.shape[:2]
    a = im[..., 3:] / 255.0
    dst[y:y + h, x:x + w] = (dst[y:y + h, x:x + w] * (1 - a) + im[..., :4] * a).astype(np.uint8)


def with_weapon(body, kind, hand, angle=0):
    """body + a synthetic weapon whose grip sits at `hand` (native px, rotated by 90° steps only)."""
    w, grip = weapon(kind)
    k = int(round(angle / 90)) % 4
    for _ in range(k):
        w = np.rot90(w)
        grip = (grip[1], w.shape[0] - 1 - grip[0]) if False else (grip[1], w.shape[0] - 1 - grip[0])
    pad = 40
    c = np.zeros((body.shape[0] + 2 * pad, body.shape[1] + 2 * pad, 4), np.uint8)
    paste(c, body, pad, pad)
    paste(c, w, pad + hand[0] - grip[0], pad + hand[1] - grip[1])
    return crop(c)


def render(nat, p, jitter=0.18, soft=0.6):
    """native RGBA -> upscaled RGBA on an irregular grid with soft edges."""
    h, w = nat.shape[:2]
    cw = np.maximum(1, np.round(p * (1 + rng.uniform(-jitter, jitter, w)))).astype(int)
    ch = np.maximum(1, np.round(p * (1 + rng.uniform(-jitter, jitter, h)))).astype(int)
    big = np.repeat(np.repeat(nat, ch, 0), cw, 1).astype(np.float64)
    if soft:
        rgbA = big[..., :3] * big[..., 3:] / 255.0
        s = [nd.gaussian_filter(rgbA[..., i], soft) for i in range(3)]
        al = nd.gaussian_filter(big[..., 3], soft)
        rgb = np.stack(s, -1) / np.maximum(al[..., None] / 255.0, 1e-3)
        big = np.concatenate([np.clip(rgb, 0, 255), al[..., None]], -1)
    big[..., :3] += rng.normal(0, 3.5, big[..., :3].shape)
    return np.clip(big, 0, 255).astype(np.uint8)


def compose(n, poses, p, gap_art=14, bg=(252, 6, 250), bg_noise=5.0, shadows=None, grey_shadows=None, text=None, blur_extra=0):
    """poses[r][c] = native RGBA or None. Equal grid, feet on one line per row."""
    spec = SHEETS[n]
    R, C = spec['rows'], spec['cols']
    cell_w = max(im.shape[1] for row in poses for im in row if im is not None) + gap_art
    cell_h = max(im.shape[0] for row in poses for im in row if im is not None) + gap_art
    Wp, Hp = int(C * cell_w * p + 2 * gap_art * p), int(R * cell_h * p + 2 * gap_art * p)
    sheet = np.zeros((Hp, Wp, 3), np.float64) + np.array(bg, float)
    sheet += rng.normal(0, bg_noise, sheet.shape)
    truth = {}
    for r in range(R):
        for c in range(C):
            im = poses[r][c]
            if im is None:
                continue
            big = render(im, p, soft=0.6 + blur_extra)
            cx = int((gap_art + (c + 0.5) * cell_w) * p)
            base = int((gap_art + (r + 1) * cell_h - gap_art * 0.5) * p)
            air = getattr(im, 'air', 0)
            x0, y0 = cx - big.shape[1] // 2, base - big.shape[0]
            if shadows and (r, c) in shadows:
                yy, xx = np.mgrid[0:Hp, 0:Wp]
                e = ((xx - cx) / (big.shape[1] * 0.45)) ** 2 + ((yy - base) / (p * 2.2)) ** 2 < 1
                sheet[e] *= 0.55
            if grey_shadows and (r, c) in grey_shadows:
                yy, xx = np.mgrid[0:Hp, 0:Wp]
                e = ((xx - cx) / (big.shape[1] * 0.42)) ** 2 + ((yy - base) / (p * 1.6)) ** 2 < 1
                sheet[e] = sheet[e] * 0.25 + np.array([120, 116, 120]) * 0.75
            a = big[..., 3:] / 255.0
            sheet[y0:y0 + big.shape[0], x0:x0 + big.shape[1]] = sheet[y0:y0 + big.shape[0], x0:x0 + big.shape[1]] * (1 - a) + big[..., :3] * a
            truth[spec['ids'][r][c]] = dict(x=cx, base=base, h_native=im.shape[0])
    out = Image.fromarray(np.clip(sheet, 0, 255).astype(np.uint8))
    if text:
        d = ImageDraw.Draw(out)
        try:
            f = ImageFont.truetype(os.path.join(HERE, '..', 'art_proto', 'fonts', 'ZenMaruGothic-Bold.ttf'), int(8 * p))
        except Exception:
            f = None
        d.text((int(gap_art * p * 0.3), int(gap_art * p * 0.1)), text, fill=(30, 30, 30), font=f)
    return out, truth


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(HERE, 'out', 'arun', 'sprites'))
    ap.add_argument('--dst', default=os.path.join(HERE, 'work', 'mock_sheets'))
    ap.add_argument('--clean', action='store_true')
    a = ap.parse_args()
    os.makedirs(a.dst, exist_ok=True)
    for f in os.listdir(a.dst):
        if f.endswith('.png'):
            os.remove(os.path.join(a.dst, f))
    S = lambda sid: crop(ld(a.src, sid))
    mis = not a.clean
    truth = dict(mistakes=[])
    down, up, side = S('fld_down'), S('fld_up'), S('fld_side')
    tq = S('fld_3q')

    def walk(im, view):
        f = B.walk_frames(im, view)
        return [crop(f[0]), crop(f[1]), crop(f[3])]
    # ---- sheet 1: walk (row 4 drawn facing left by mistake)
    rows1 = [walk(down, 'front'), walk(up, 'back'), walk(side, 'side'), [x[:, ::-1] for x in walk(side, 'side')]]
    if mis:
        rows1[3] = walk(side, 'side')
        truth['mistakes'].append('sheet1 row 4 faces left (should be right)')
        truth['mistakes'].append('sheet1 has a text label and dark magenta floor shadows under row 1')
    im, _ = compose(1, rows1, 8.0, shadows={(0, 0), (0, 1), (0, 2)} if mis else None, text='シート1 歩き' if mis else None)
    im.save(os.path.join(a.dst, 'sheet1_walk.png'))
    # ---- sheet 2: run at a realistic image-AI size (3.6 px per art px), grey shadows
    rows2 = [walk(down, 'front') + [walk(down, 'front')[1]], walk(up, 'back') + [walk(up, 'back')[2]],
             walk(side, 'side') + [walk(side, 'side')[1]], [x[:, ::-1] for x in walk(side, 'side') + [walk(side, 'side')[2]]]]
    im, _ = compose(2, rows2, 3.6, grey_shadows={(0, 0), (2, 1)} if mis else None)
    im.save(os.path.join(a.dst, 'sheet2_run.png'))
    if mis:
        truth['mistakes'].append('sheet2 grey floor shadows under #1 and #10 (auto)')
    # ---- sheet 3: acting (pose 12 missing)
    lie = crop(nn_scale(S('btl_defeat'), 0.75))
    rows3 = [[down, tq, tq[:, ::-1], down], [down, down, tq, tq], [lie, down, tq, None if mis else down]]
    im, _ = compose(3, rows3, 6.0)
    im.save(os.path.join(a.dst, 'sheet3_act.png'))
    if mis:
        truth['mistakes'].append('sheet3 pose 12 missing')
    # ---- battle sprites: bare bodies + synthetic armed versions
    idle, att, skl, dmg, dft, vic = [S(x) for x in ('btl_idle', 'btl_attack', 'btl_skill', 'btl_damage', 'btl_defeat', 'btl_victory')]
    br, _ = B.breathing(B.pad(idle))
    idle_b = crop(br[2])
    hand = (12, 36)
    armed_idle = with_weapon(idle, 'sword', hand)
    truth['attach'] = {'bare_idle': dict(hand_body=hand, note='weapon grip at body-local hand of the weapon-less sprite')}
    rows5 = [[idle, idle_b, att, dmg, dmg], [dmg, dft, vic, vic, idle]]
    rows5[0][0] = armed_idle
    rows5[0][1] = with_weapon(idle_b, 'sword', (hand[0], hand[1] + 1))
    if mis:
        rows5[0][2] = att[:, ::-1]
        truth['mistakes'].append('sheet5 pose 3 (step) faces right')
    im, _ = compose(5, rows5, 8.0)
    im.save(os.path.join(a.dst, 'sheet5_battle.png'))
    rows6 = [[skl, skl, att, att, dmg], [skl, idle, idle, idle, att]]
    if mis:
        rows6[1][1] = crop(nn_scale(idle, 1.22))
        truth['mistakes'].append('sheet6 pose 7 (cast A) is 22% too tall')
    im, _ = compose(6, rows6, 5.0, blur_extra=0.6)
    im.save(os.path.join(a.dst, 'sheet6_action.png'))
    ws = [weapon(k)[0] for k in ('sword', 'greatsword', 'dagger', 'bow', 'staff')]
    rows7 = [[idle, skl, skl, att, idle], ws]
    im, _ = compose(7, rows7, 8.0)
    im.save(os.path.join(a.dst, 'sheet7_bare.png'))
    # ---- sheet 9: faces (big face ×2), #6 drawn larger
    fb = crop(nn_scale(S('face_big'), 2.0))
    fs = [fb] * 8
    if mis:
        fs = list(fs)
        fs[5] = crop(nn_scale(fb, 1.12))
        truth['mistakes'].append('sheet9 face 6 (sad) 12% larger')
    im, _ = compose(9, [fs[:4], fs[4:]], 4.0)
    im.save(os.path.join(a.dst, 'sheet9_face.png'))
    truth['mistakes'].append('sheet4 and sheet8 not delivered (optional)')
    json.dump(truth, open(os.path.join(a.dst, 'truth.json'), 'w'), indent=1, ensure_ascii=False)
    print('mock sheets ->', a.dst)
    for m in truth['mistakes']:
        print(' -', m)


if __name__ == '__main__':
    main()
