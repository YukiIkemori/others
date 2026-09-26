#!/usr/bin/env python3
"""sprite_pipe の出力 → v2 のスプライト（V2_PLAN §2.11「キャラの絵」、CAST）

  python3 tools/to_v2.py out/arun --look hero_m_warrior            # → chronicle/v2/assets/sprites/hero_m_warrior/*.png + .json
  python3 tools/to_v2.py out/arun_v1 --look hero_m_warrior --dst /tmp/x   # 置き場を変える（試し）

読む物（どちらの形でもよい）
  - 設定資料から作った仮の形（tools/build.py）: battle/<c>_battle.*, field/<c>_field.*, portrait/<c>_face_*.png
  - シートの束の形（tools/sheets.py → pack.py）: battle/ battle_bare/ weapons/ face/ field/ の各 .png + .json

書く物（1 人 = 1 フォルダ。ビルドが RPG_MEDIA.sprites['<look>:<kind>'] にする）
  <kind>.png   元の画像のまま（face だけは 1 枚ずつの画像を同じ大きさのマスに並べ直す）
  <kind>.json  {cell:[w,h], anchor:[x,y], poses:{<コマの名前>:[i]…, <動きの名前>:[i…]}, fps:{}, frames:[{id,x,y,w,h,anchor,points}],
                anims, facing, set, character, source, weapon?, attach?, weapons?, expr?}
  kind = field / battle / face / bare（武器なしの戦闘ポーズ）/ weapons（武器 5 つ）
ゲームの側（v2/src/art/cast/sprites.js）がコマの名前から §2.5.7 のポーズ（stand_s … / idle step slash …）を組み、足りない動きは画像の補間で作る。
"""
import argparse
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2_SPRITES = os.path.normpath(os.path.join(HERE, '..', '..', 'v2', 'assets', 'sprites'))
KINDS = {'battle': 'battle', 'field': 'field', 'face': 'face', 'battle_bare': 'bare', 'weapons': 'weapons'}
# 設定資料の顔 → v2 の表情（README の対応: normal→neutral・smile→smile・serious→angry・big→surprise。sad は neutral）
FACE_MAP = {'normal': 'neutral', 'smile': 'smile', 'serious': 'angry', 'big': 'surprise', 'neutral': 'neutral', 'sad': 'sad',
            'angry': 'angry', 'surprise': 'surprise', 'laugh': 'laugh', 'tired': 'tired'}


def fps_of(anim):
    """{frames, ms} → (コマの並び, fps)。ms がばらばらなら、短い方の ms を 1 コマにして繰り返しで長さを表す"""
    fr, ms = anim.get('frames') or [], anim.get('ms') or []
    if not fr:
        return [], 8
    ms = [m for m in ms if m] or [125]
    base = max(40, min(ms))
    seq = []
    for i, f in enumerate(fr):
        m = (anim.get('ms') or [base] * len(fr))[i] or base
        seq += [f] * max(1, int(round(m / base)))
    return seq, round(1000.0 / base, 2)


def convert_set(src_json, kind, look, dst, source):
    d = json.load(open(src_json))
    img = os.path.join(os.path.dirname(src_json), d['image'])
    frames, poses, fps = [], {}, {}
    for i, (fid, f) in enumerate(d.get('frames', {}).items()):
        frames.append({'id': fid, 'x': f['x'], 'y': f['y'], 'w': f['w'], 'h': f['h'], 'anchor': f.get('anchor', d['anchor']),
                       'points': f.get('points', {})})
        poses[fid] = [i]
    idx = {f['id']: i for i, f in enumerate(frames)}
    for name, a in (d.get('anims') or {}).items():
        if 'frames' in a:
            seq, f = fps_of(a)
            if seq and all(s in idx for s in seq):
                poses['anim_' + name] = [idx[s] for s in seq]
                fps['anim_' + name] = f
    out = {'character': d.get('character'), 'set': d.get('set'), 'look': look, 'source': source, 'cell': d['cell'], 'anchor': d['anchor'],
           'frames': frames, 'poses': poses, 'fps': fps, 'anims': d.get('anims') or {}, 'facing': d.get('facing'),
           'target_height': d.get('target_height')}
    for k in ('attach', 'weapons', 'directions', 'walk_note', 'palette'):
        if k in d:
            out[k] = d[k]
    if kind == 'face':
        out['expr'] = expr_map([f['id'] for f in frames])
    if kind == 'battle' and 'bare' not in source:
        out['weapon'] = 'sword'   # 設定資料・シート5/6 の武器あり版は剣を持って描かれている
    shutil.copyfile(img, os.path.join(dst, kind + '.png'))
    json.dump(out, open(os.path.join(dst, kind + '.json'), 'w'), ensure_ascii=False, indent=1)
    return len(frames)


def clean_specks(a, keep_min=6):
    """顔の画像の端に残った小さな点（シートの枠や文字のかけら）を消す。本体から離れた keep_min 画素未満のかたまり"""
    m = a[..., 3] > 0
    lab, n = nd.label(m, structure=np.ones((3, 3)))
    if n <= 1:
        return a
    sizes = nd.sum(m, lab, range(1, n + 1))
    big = int(np.argmax(sizes)) + 1
    for i, s in enumerate(sizes, 1):
        if i != big and s < keep_min:
            a[lab == i] = 0
    # 白に近い 1〜2 画素の縦線（枠のかけら）も、本体の外周から 1 画素だけ出ているものは消す
    return a


def expr_map(names):
    """コマの名前の並び → {表情: コマの番号}（§2.5.7 の 5 つ。無い表情は neutral）"""
    expr = {}
    bare = [n.replace('face_', '') for n in names]
    for i, n in enumerate(bare):   # 同じ名前の表情が先
        if n in ('neutral', 'smile', 'sad', 'angry', 'surprise') and n not in expr:
            expr[n] = i
    for i, n in enumerate(bare):
        e = FACE_MAP.get(n)
        if e and e not in expr:
            expr[e] = i
    if 'neutral' in expr:
        for e in ('smile', 'sad', 'angry', 'surprise'):
            expr.setdefault(e, expr['neutral'])
    return expr


def pack_faces(files, look, dst, source):
    """1 枚ずつの顔の画像 → 同じ大きさのマスに下揃え・中央揃えで並べる（face.png）"""
    ims = []
    for name, path in files:
        a = np.asarray(Image.open(path).convert('RGBA')).copy()
        a = clean_specks(a)
        ys, xs = np.where(a[..., 3] > 0)
        a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        ims.append((name, a))
    cw = max(a.shape[1] for _, a in ims) + 2
    ch = max(a.shape[0] for _, a in ims) + 1
    sheet = np.zeros((ch, cw * len(ims), 4), np.uint8)
    frames, poses = [], {}
    for i, (name, a) in enumerate(ims):
        h, w = a.shape[:2]
        x0, y0 = i * cw + (cw - w) // 2, ch - h
        sheet[y0:y0 + h, x0:x0 + w] = a
        frames.append({'id': name, 'x': i * cw, 'y': 0, 'w': cw, 'h': ch, 'anchor': [cw // 2, ch - 1],
                       'points': {'bbox': [(cw - w) // 2, y0, w, h]}})
        poses[name] = [i]
    expr = expr_map([n for n, _ in ims])
    Image.fromarray(sheet).save(os.path.join(dst, 'face.png'))
    out = {'look': look, 'set': 'face', 'source': source, 'cell': [cw, ch], 'anchor': [cw // 2, ch - 1], 'frames': frames,
           'poses': poses, 'fps': {}, 'expr': expr}
    json.dump(out, open(os.path.join(dst, 'face.json'), 'w'), ensure_ascii=False, indent=1)
    return len(frames)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src', help='sprite_pipe の出力のフォルダ（out/<char>）')
    ap.add_argument('--look', required=True, help='v2 の look の id（アルンは hero_m_warrior）')
    ap.add_argument('--dst', default=None, help=f'置き場（既定 {V2_SPRITES}/<look>）')
    o = ap.parse_args()
    src = os.path.abspath(o.src)
    dst = os.path.abspath(o.dst or os.path.join(V2_SPRITES, o.look))
    os.makedirs(dst, exist_ok=True)
    rel = os.path.relpath(src, HERE)
    done = []
    for sub, kind in KINDS.items():
        d = os.path.join(src, sub)
        if not os.path.isdir(d):
            continue
        js = [f for f in os.listdir(d) if f.endswith('.json')]
        if kind == 'face' and not js:
            continue
        for f in js:
            n = convert_set(os.path.join(d, f), kind, o.look, dst, rel + '/' + sub)
            done.append(f'{kind}: {n} frames')
    if not os.path.exists(os.path.join(dst, 'face.png')):
        pd = os.path.join(src, 'portrait')
        if os.path.isdir(pd):
            order = ['normal', 'smile', 'serious', 'big', 'sad', 'surprise', 'angry', 'laugh', 'tired']
            files = []
            for nm in order:
                for f in sorted(os.listdir(pd)):
                    if f.endswith(f'_face_{nm}.png'):
                        files.append(('face_' + nm, os.path.join(pd, f)))
            if files:
                n = pack_faces(files, o.look, dst, rel + '/portrait')
                done.append(f'face: {n} frames')
    if not done:
        print('nothing converted (no battle/field/face sets found)', file=sys.stderr)
        sys.exit(1)
    print(f'{o.look} → {dst}\n  ' + '\n  '.join(done))


if __name__ == '__main__':
    main()
