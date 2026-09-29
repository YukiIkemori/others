# PV 30 秒版の台本（本編と同じカットから）。compose.py と audio.py が読む。
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import edit_lib as L  # noqa: E402
L.reset()
cut, sub, cap, tag, big = L.cut, L.sub, L.cap, L.tag, L.big

# つかみ: 灯台の光 ＋ 一行
cut('nf_cape_pan', 0.0, 3.2, src=3.2, zoom=(1.1, 1.0))
L.SFX.append(dict(id='bell', at=0.05, gain=-3))
tag('この世界は、朝を知らない。', 0.25, 3.0)
# 題字
L.FLASH.append((3.2, 0.2, 0.6, 0.9))
L.SFX.append(dict(id='light', at=3.15, gain=-4))
cut('title_screen', 3.2, 2.8, src=1.1)
# 探索（半小節ごと）
X0 = 6.0
H = L.BAR_OW / 2
for i, (c, src, br) in enumerate([('ex_windhill', 0.4, 1.18), ('ex_fern', 0.6, 1.0), ('ex_verda_stone', 0.4, 1.15), ('ex_elder2', 0.4, 1.1)]):
    cut(c, X0 + i * H, H, src=src, zoom=(1.0, 1.05), grade=dict(bright=br))
cap('FIELD', '一枚絵のフィールド', X0 + 0.15, X0 + 4 * H - 0.1)
# 仲間
T1 = X0 + 4 * H
cut('tavern', T1, 4.3, src=1.0)
cap('COMPANIONS', '20人から、自分だけの仲間を。', T1 + 0.2, T1 + 4.2, band=260)
L.VOICE.append(dict(file='b_selma_bigtech_1', at=T1 + 0.5))
sub('セルマ「この剣、曲げはしない！」', T1 + 0.5, T1 + 2.6, y=80)
# 戦闘: 閃き → 合成術 → 強敵
B1 = T1 + 4.3
L.SFX.append(dict(id='crit', at=B1 - 0.03, gain=-5))
cut('bt_glimmer', B1, 1.15, src=6.6, gamesfx=-7)
cut('bt_glimmer', B1 + 1.15, 1.4, src=7.75, freeze=True, grade=dict(sat=0.75, bright=0.8))
L.FLASH.append((B1 + 1.15, 0.05, 0.3, 0.5))
big('閃き', B1 + 1.17, B1 + 2.55, y=520, band=420)
L.VOICE.append(dict(file='v_hero_m_glimmer_1', at=B1 + 1.2))
L.SFX.append(dict(id='glimmer', at=B1 + 1.15, gain=-5))
S1 = B1 + 2.55
cut('bt_spell', S1, 2.6, src=5.8, gamesfx=-6)   # 戦闘は固定の画面
T_ = S1 + 0.4
L.T.append(dict(kind='big_sub', text='属性を重ねて', t0=T_, t1=S1 + 2.55, x=960, y=720, anim='rise', fin=0.25, fout=0.3, band=330))
big('合成術', T_ + 0.15, S1 + 2.55, y=840, size=150)
K1 = S1 + 2.6
cut('bt_boss', K1, 1.9, src=2.6, gamesfx=-6)
L.SFX.append(dict(id='roar', at=K1 + 0.05, gain=-5))
cut('bt_boss_kill', K1 + 1.9, 3.0, src=17.2, gamesfx=-5)
# 終わりの札
E1 = K1 + 4.9
L.FLASH.append((E1, 0.15, 0.6, 0.8))
L.end_card(E1, 30.0 - E1)
L.DIP.append((30.0, 0.5))
DURATION = 30.0
L.MUSIC += [
    dict(file='title', at=0.0, src=48.9, dur=6.1, fin=0.05, fout=0.3, gain=0),
    dict(file='overworld', at=X0 - 0.05, src=23.57, dur=B1 - X0 + 0.05, fin=0.05, fout=0.3, gain=-1),
    dict(file='battle', at=B1 - 0.02, src=16.184, dur=E1 - B1 + 0.2, fin=0.02, fout=0.3, gain=-1),
    dict(file='title', at=E1 - 0.1, src=62.6, dur=DURATION - E1 + 0.1, fin=0.2, fout=1.6, gain=0),
]
V, T, SFX, VOICE, MUSIC, BARS, FLASH, DIP = L.V, L.T, L.SFX, L.VOICE, L.MUSIC, L.BARS, L.FLASH, L.DIP
