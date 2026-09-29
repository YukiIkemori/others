"""砂漠のかがり火（道しるべの灯籠 waylamp・置き灯籠 lantern の砂漠の描き直し）を propfix/sheet_desert.png から切り出す。
usage: python3 braziers.py
  -> v2/assets/env/desert/props/waylamp__desert@24/32/40.png + .json（コマ off on0 on1 on2。on1 on2 は炎だけを揺らした絵）
     v2/assets/env/desert/props/lantern__desert・copper_brazier__desert @24/32/40.png + .json（灯った 1 コマ）
json の fire: true = 火（props.js が炎の画素に夜の環境光を掛けない・props_light.js が火の色でゆらぐ光にする）、fps = on のコマの速さ。"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'propfix'))
import proc_props as PP
from proc import TILES
from envlib import pixelize_sprite, save
from sheets import shadowed

RAW = '/home/user/others/chronicle/design/art_ref/gen/env/propfix/sheet_desert.png'
OUT = '/home/user/others/chronicle/v2/assets/env/desert/props'
BODY32 = 44     # 柱＋鉢の高さ（炎を除く、32 px のマス）。石の灯籠（53）と同じくらいの背丈に炎が乗る
POT32 = 13      # 置きかがり火の鉢と脚の高さ（炎を除く）。置き灯籠（20）と同じくらいの背丈に炎が乗る
COPPER32 = 18   # 銅のかがり火（copper_brazier の描き直し、前の絵の高さ 24）
HEAD = 4        # 揺らした炎が伸びる分の上の余白（32 px）


def flame(a):
    """炎の画素（鮮やかな暖色: 赤・橙・黄。青がほとんど無い）"""
    r, g, b, al = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float), a[..., 3]
    return (al > 100) & (r > 180) & (b < 60) & (r - g > 40)   # 砂岩（青 70 以上）と分ける。props.js の hot と同じ


def widest(a):
    """いちばん幅のある行の幅（鉢と取っ手。炎は鉢より細い）"""
    al = a[..., 3] > 100
    xs = [np.nonzero(r)[0] for r in al]
    return max((x.max() - x.min() + 1) for x in xs if x.size)


def body_top(a):
    """鉢の縁の行 = 不透明な幅が鉢の幅の 6 割を超えるいちばん上の行（そこより上は炎だけ）"""
    al = a[..., 3] > 100
    wmax = widest(a)
    for y, r in enumerate(al):
        x = np.nonzero(r)[0]
        if x.size and x.max() - x.min() + 1 >= 0.6 * wmax: return y
    return 0


def feet_x(spr):
    al = spr[..., 3] > 200
    ys = np.nonzero(al.any(1))[0]
    base = al[max(0, ys.max() - max(2, spr.shape[0] // 10)):ys.max() + 1]
    return int(round(np.nonzero(base.any(0))[0].mean())), ys.max()


def sway(spr, rim, sc, dx):
    """炎（rim より上の行）だけを縦に sc 倍、上ほど横に dx ずらした絵（最近傍）。rim から下はそのまま"""
    out = spr.copy()
    h, w = spr.shape[:2]
    top = np.nonzero((spr[:rim, :, 3] > 0).any(1))[0]
    if not top.size: return out
    fh = max(1, rim - top.min())
    out[:rim] = 0
    for y in range(rim):
        up = rim - y
        sy = int(round(rim - up / sc))
        if sy < 0 or sy >= rim: continue
        sh = int(round(dx * min(1.0, up / fh)))
        row = spr[sy]
        if sh > 0: out[y, sh:] = row[:w - sh]
        elif sh < 0: out[y, :w + sh] = row[-sh:]
        else: out[y] = row
    return out


def sprite(crop, body_px, body32, t):
    """hi-res の切り抜き → t px のマスの絵（炎を除いた高さが body32 になる倍率）。上に HEAD の余白"""
    k = body32 * t / 32 / body_px
    hh, ww = crop.shape[:2]
    w, h = max(1, int(round(ww * k))), max(1, int(round(hh * k)))
    spr = pixelize_sprite(crop, w, h, ncol=32, outline=False, seed=1)
    pad = int(round(HEAD * t / 32))
    return np.concatenate([np.zeros((pad, w, 4), spr.dtype), spr], 0)


def place(frames, feet):
    """足もと（台の下の中央）をそろえて同じ大きさのコマにする → (strip, cell, feet)"""
    L = max(fx for fx, _ in feet); Rr = max(f.shape[1] - fx for f, (fx, _) in zip(frames, feet))
    H = max(f.shape[0] for f in frames)
    W = L + Rr
    out = []
    for f, (fx, fy) in zip(frames, feet):
        c = np.zeros((H, W, 4), np.float32)
        ox, oy = L - fx, H - f.shape[0]
        c[oy:oy + f.shape[0], ox:ox + f.shape[1]] = f
        out.append(c)
    return np.concatenate(out, 1), [int(W), int(H)], [int(L), int(H - frames[0].shape[0] + feet[0][1])]


def light_of(spr, fx, fy):
    """灯りの芯 = 炎の画素の重心（足もとからの相対）"""
    f = flame(spr)
    al = spr[..., 3] > 100
    wd = [(np.ptp(np.nonzero(r)[0]) + 1) if r.any() else 0 for r in al]
    f[int(np.argmax(wd[:len(wd) // 2])) + 3:] = False   # 鉢（上半分でいちばん幅のある行）より下の柱の赤い帯の模様は炎ではない
    ys, xs = np.nonzero(f)
    if not ys.size: return None
    return [int(round(xs.mean())) - int(fx), int(round(ys.mean() + (ys.max() - ys.mean()) * 0.35)) - int(fy)]


def main():
    rgba = PP.load(RAW, 'RGBA').astype(np.float32)
    comps = [(c[0], c[1], c[2], c[3], 1, None, c[4]) for c in PP.grouped(rgba, 3)]
    ordered = PP.reading_order(comps)
    assert len(ordered) == 3, len(ordered)
    crops = []
    for x0, y0, x1, y1, _, _, m in ordered:
        c = rgba[y0:y1, x0:x1].copy(); c[..., 3] = np.where(m, c[..., 3], 0); crops.append(c)
    off, on, pot = crops
    bottom = lambda a: np.nonzero((a[..., 3] > 100).any(1))[0].max()
    # 灯った絵の倍率は消えた絵の鉢の幅に合わせる（同じ物。炎の縁で高さを測ると狂う）
    b_off = bottom(off) - body_top(off); b_on = b_off * widest(on) / widest(off); b_pot = bottom(pot) - body_top(pot)
    print('body px off/on/pot', b_off, b_on, b_pot)
    os.makedirs(OUT, exist_ok=True)
    src = os.path.relpath(RAW, '/home/user/others/chronicle')
    # --- waylamp__desert: off on0 on1 on2
    meta = dict(id='waylamp__desert', kind='props', theme='desert', set='desert', base='waylamp', frames=['off', 'on0', 'on1', 'on2'],
                fire=True, fps=7, cell={}, feet={}, files={}, src=src)
    for t in TILES:
        s_off = shadowed(sprite(off, b_off, BODY32, t), True); s_on = shadowed(sprite(on, b_on, BODY32, t), True)
        rim = body_top(s_on)
        amp = max(1, round(t / 32))
        s1 = sway(s_on, rim, 0.86, -amp); s2 = sway(s_on, rim, 1.12, amp)
        fr = [s_off, s_on, s1, s2]
        ft = [feet_x(s_off), feet_x(s_on), feet_x(s_on), feet_x(s_on)]
        strip, cell, feet = place(fr, ft)
        fn = 'waylamp__desert@%d.png' % t; save(strip, os.path.join(OUT, fn))
        meta['files'][t] = fn; meta['cell'][t] = cell; meta['feet'][t] = feet
        if t == 32:
            on_c = strip[:, cell[0]:cell[0] * 2]
            meta['light32'] = light_of(on_c, feet[0], feet[1])
    json.dump(meta, open(os.path.join(OUT, 'waylamp__desert.json'), 'w'), indent=1)
    print('waylamp__desert', meta['cell'], meta.get('light32'))
    # --- lantern__desert（置き灯籠）・copper_brazier__desert（銅のかがり火。前の絵は火の無い鉢だった）: 灯った 1 コマ
    for base, h32 in (('lantern', POT32), ('copper_brazier', COPPER32)):
        sid = base + '__desert'
        meta = dict(id=sid, kind='props', theme='desert', set='desert', base=base, frames=['default'],
                    fire=True, cell={}, feet={}, files={}, src=src)
        for t in TILES:
            s = shadowed(sprite(pot, b_pot, h32, t), base == 'copper_brazier')
            strip, cell, feet = place([s], [feet_x(s)])
            fn = '%s@%d.png' % (sid, t); save(strip, os.path.join(OUT, fn))
            meta['files'][t] = fn; meta['cell'][t] = cell; meta['feet'][t] = feet
            if t == 32: meta['light32'] = light_of(strip, feet[0], feet[1])
        json.dump(meta, open(os.path.join(OUT, sid + '.json'), 'w'), indent=1)
        print(sid, meta['cell'], meta.get('light32'))


if __name__ == '__main__':
    main()
