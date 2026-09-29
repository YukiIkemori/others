# PV 15 秒版の台本（本編と同じカットから）。compose.py と audio.py が読む。
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import edit_lib as L  # noqa: E402
L.reset()
cut, sub, cap, tag, big = L.cut, L.sub, L.cap, L.tag, L.big

cut('nf_cape_pan', 0.0, 3.7, src=2.7, zoom=(1.08, 1.0))
L.SFX.append(dict(id='bell', at=0.05, gain=-3))
L.VOICE.append(dict(file=os.path.join(os.environ.get('PV_VO', ''), 'pv_hook_01'), at=0.0, tempo=1.12))   # つかみの一行の声（PV だけ。題字の前に収める）
tag('この世界は、朝を知らない。', 0.15, 3.6)   # 声（0〜2.6）の後も 1 秒ほど残す
L.FLASH.append((3.7, 0.15, 0.5, 0.9))
L.SFX.append(dict(id='light', at=3.65, gain=-4))
cut('title_screen', 3.7, 1.3, src=1.3)   # 一行を長く出したぶん短く
X0 = 5.0
H = L.BAR_TITLE / 2
for i, (c, src, br) in enumerate([('ex_windhill', 0.4, 1.18), ('ex_verda_stone', 0.4, 1.15), ('ex_fern', 0.6, 1.0)]):
    cut(c, X0 + i * 0.867, 0.867, src=src, zoom=(1.0, 1.05), grade=dict(bright=br))
cap('FIELD', '一枚絵のフィールド', X0 + 0.1, X0 + 2.55)
B1 = 7.6   # ここから後ろは前と同じ時刻
L.SFX.append(dict(id='crit', at=B1 - 0.03, gain=-5))
cut('bt_glimmer', B1, 0.8, src=6.95, gamesfx=-7)
cut('bt_glimmer', B1 + 0.8, 1.4, src=7.75, freeze=True, grade=dict(sat=0.75, bright=0.8))
L.FLASH.append((B1 + 0.8, 0.05, 0.3, 0.5))
big('閃き', B1 + 0.82, B1 + 2.2, y=520, band=420)
L.VOICE.append(dict(file='v_hero_m_glimmer_1', at=B1 + 0.85))
L.SFX.append(dict(id='glimmer', at=B1 + 0.8, gain=-5))
K1 = B1 + 2.2
cut('bt_boss_kill', K1, 1.6, src=17.4, gamesfx=-5)
E1 = K1 + 1.6
L.FLASH.append((E1, 0.12, 0.5, 0.8))
L.end_card(E1, 15.0 - E1)
L.DIP.append((15.0, 0.4))
DURATION = 15.0
L.MUSIC += [
    dict(file='title', at=0.0, src=48.9, dur=E1 + 0.1, fin=0.05, fout=0.2, gain=0),
    dict(file='title', at=E1 - 0.1, src=62.6, dur=DURATION - E1 + 0.1, fin=0.15, fout=1.2, gain=0),
]
V, T, SFX, VOICE, MUSIC, BARS, FLASH, DIP = L.V, L.T, L.SFX, L.VOICE, L.MUSIC, L.BARS, L.FLASH, L.DIP
