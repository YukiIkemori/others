# PV 本編（約 2 分）の台本。compose.py（映像）と audio.py（音）が読む。秒は台本の時刻。
#   V: 映像のカット  T: 文字  BARS: 帯の高さ（[(秒, px)]）  FLASH: 光（(ピーク, 入り, 抜け, 強さ)）  DIP: 暗転（(中心, 幅)）
#   MUSIC / VOICE / SFX: 音（audio.py）
# 台詞はすべてゲームの中の文そのまま（src/events/*.js）。「」の外の見出しは宣伝の言葉（本当のことだけ）。

# 曲の小節（秒）: title 92BPM 3/4・overworld 112BPM 4/4・battle 164BPM 4/4・boss 150BPM 4/4・dawn 84BPM 3/4
BAR_TITLE, BAR_OW, BAR_BT, BAR_BOSS, BAR_DAWN = 60 / 92 * 3, 60 / 112 * 4, 60 / 164 * 4, 60 / 150 * 4, 60 / 84 * 3

V, T, SFX, VOICE, MUSIC = [], [], [], [], []
BARS, FLASH, DIP = [], [], []


def cut(clip, at, dur, src=0.0, **k):
    V.append(dict(clip=clip, at=at, dur=dur, src=src, **k))


def sub(text, t0, t1, who=None, y=1015):
    """声の字幕（帯の中）"""
    T.append(dict(kind='sub', text=text, t0=t0, t1=t1, x=960, y=y, fin=0.25, fout=0.3))


def cap(kicker, text, t0, t1, band=None):
    """機能の見出し（左下）: 小さい金の英字 ＋ 大きい白。band=高さ で後ろに暗い帯"""
    T.append(dict(kind='cap_k', text=kicker, style=dict(font=FONT_EN_PATH), t0=t0, t1=t1, x=110, y=838, anchor=(0, 0.5), anim='slide', fin=0.35, fout=0.3, band=band, band_k=0.75))
    T.append(dict(kind='cap', text=text, t0=t0 + 0.08, t1=t1, x=104, y=915, anchor=(0, 0.5), anim='slide', fin=0.35, fout=0.3))


import os
FONT_EN_PATH = os.path.join(os.environ.get('PV_FONTS', ''), 'cinzel-700.ttf')

# ================================================================== 1 つかみ（0:00〜）
SFX.append(dict(id='bell', at=0.25, gain=-2))
T.append(dict(kind='tag', text='この世界は、朝を知らない。', t0=0.7, t1=3.5, x=960, y=540, anim='rise', fin=0.8, fout=0.5))
# ロアの年寄り（本物の会話の窓。E.AGE.old）
cut('hook_elder', 3.6, 3.9, src=0.15, zoom=(1.18, 1.24), center=(0.5, 0.8))
# ワールドの灯台の光が夜の海を掃く ＋ フィーネの声「……ねえ、聞こえる？」
cut('hook_beam', 7.5, 4.7, src=1.8, zoom=(1.12, 1.0), xin=0.5)
VOICE.append(dict(file='v_fine_opening_01', at=8.1))
sub('……ねえ、聞こえる？', 8.15, 11.6)
BARS += [(7.4, 0), (8.6, 130)]

# ================================================================== 2 旅立ち（帯のある映画の画面）
cut('roa_pan', 12.2, 3.9, src=0.6, xin=0.35)
VOICE.append(dict(file='v_fine_opening_02', at=12.5))
sub('これは、忘れられかけた物語。', 12.55, 15.9)
cut('roa_hill_run', 16.1, 4.0, src=0.6)
VOICE.append(dict(file='v_fine_opening_03', at=16.3))
sub('そして、それを語り直した、ひとりの語り部の物語。', 16.45, 21.7)
cut('pharos_pan', 20.1, 2.7, src=1.2, xin=0.3)
# ベルナ（本物の会話の窓）「この大陸には八つの大きな伝承がある。その全部が、いま白紙になりかけている。」v_berna_lute_03
VOICE.append(dict(file='v_berna_lute_03', at=22.2))
cut('berna_lute', 22.8, 3.6, src=0.35, zoom=(1.18, 1.24), center=(0.5, 0.8))
cut('lh_climb', 26.4, 1.9, src=1.2)
# 灯室: 灯台に火がともる（カットの 8.52 秒で光る）
cut('lamp_lit', 28.3, 3.0, src=7.2, zoom=(1.0, 1.1), center=(0.5, 0.45), gamesfx=-4)

# ================================================================== 3 題字
FLASH.append((31.3, 0.35, 0.9, 1.0))
BARS += [(31.2, 130), (31.5, 0)]
cut('title_screen', 31.3, 3.3, src=0.25, speed=0.6)
cut('title_screen', 34.6, 2.6, src=2.23, zoom=(1.0, 1.03), center=(0.3, 0.3))
SFX.append(dict(id='light', at=31.25, gain=-3))
SFX.append(dict(id='glimmer', at=34.2, gain=-10))


# ================================================================== 4 探索（overworld の小節ごとに切る）
T0_OW = 37.2
EXP = [  # (カット, src, 明るさ)
    ('ex_windhill', 0.3, 1.18), ('ex_cape', 0.6, 1.2), ('ex_pharos_run', 0.4, 1.05), ('ex_fern', 0.4, 1.0),
    ('ex_verda_stone', 0.2, 1.15), ('ex_verda_dark', 0.6, 1.3), ('ex_elder', 0.0, 1.1), ('ex_elder2', 0.2, 1.1),
    ('ex_lh2', 0.3, 1.05), ('ex_world', 0.3, 1.15),
]
for i, (c, src, br) in enumerate(EXP):
    at = T0_OW + i * BAR_OW
    dur = BAR_OW if c != 'ex_elder' else BAR_OW * 0.75   # 千年樹の入口は会話が出る前まで
    cut(c, at, dur, src=src, zoom=(1.0, 1.07) if i % 2 == 0 else (1.07, 1.0), grade=dict(bright=br))
    if c == 'ex_elder':
        cut('ex_well', at + dur, BAR_OW - dur, src=0.1, grade=dict(bright=1.1))
cap('FIELD', '一枚絵のフィールド', T0_OW + 0.3, T0_OW + 2 * BAR_OW - 0.15)
cap('TOWN', '夜の街並み', T0_OW + 2 * BAR_OW + 0.15, T0_OW + 4 * BAR_OW - 0.15)
cap('DUNGEON', 'ダンジョン探索', T0_OW + 4 * BAR_OW + 0.15, T0_OW + 9 * BAR_OW - 0.15)
T_TAV = T0_OW + 10 * BAR_OW

# ================================================================== 5 仲間（潮風亭の 20 人）
cut('tavern', T_TAV, 8.8, src=0.3, zoom=(1.0, 1.04), center=(0.3, 0.4))
cap('COMPANIONS', '20人から、自分だけの仲間を。', T_TAV + 0.3, T_TAV + 4.3, band=260)
cap('VOICE', 'ボイス対応', T_TAV + 4.5, T_TAV + 8.6, band=260)
VOICE.append(dict(file='b_selma_bigtech_1', at=T_TAV + 0.8))
sub('セルマ「この剣、曲げはしない！」', T_TAV + 0.8, T_TAV + 3.0, y=80)
VOICE.append(dict(file='b_titta_bigtech_2', at=T_TAV + 3.6))
sub('ティッタ「ちょろいちょろい！」', T_TAV + 3.6, T_TAV + 5.4, y=80)
VOICE.append(dict(file='b_teo_bigtech_1', at=T_TAV + 6.0))
sub('テオ「見たか、天才の実力！」', T_TAV + 6.0, T_TAV + 8.6, y=80)
T_ENC = T_TAV + 8.8


def big(text, t0, t1, y=500, size=None, subtext=None, band=None):
    """大きな一語（金・光の帯）＋ 下に小さい説明"""
    st = dict(size=size) if size else {}
    T.append(dict(kind='big', text=text, style=st, t0=t0, t1=t1, x=960, y=y, anim='pop', move=0.35, fin=0.2, fout=0.35, sweep=0.9, sweep_at=0.25, band=band))
    if subtext:
        T.append(dict(kind='big_sub', text=subtext, t0=t0 + 0.25, t1=t1, x=960, y=y + (size or 210) * 0.5 + 60, anim='rise', fin=0.3, fout=0.35))


# ================================================================== 6 戦闘（迷いの森）
cut('bt_enc', T_ENC, 2.8, src=0.3, gamesfx=-6)
T_SHATTER = T_ENC + 0.6          # カットの 0.9 秒で画面が砕ける
SFX.append(dict(id='crit', at=T_SHATTER - 0.05, gain=-4))
# 閃き: 主人公の頭に電球 → 止めて大きく「閃き」
G0 = T_ENC + 2.8
cut('bt_glimmer', G0, 1.55, src=6.2, zoom=(1.0, 1.06), center=(0.62, 0.55), gamesfx=-6)
T_FRZ = G0 + 1.55
cut('bt_glimmer', T_FRZ, 1.4, src=7.75, freeze=True, zoom=(1.06, 1.14), center=(0.62, 0.5), grade=dict(sat=0.75, bright=0.8))
FLASH.append((T_FRZ, 0.06, 0.35, 0.55))
big('閃き', T_FRZ + 0.02, T_FRZ + 1.9, y=520, subtext='戦いの中で、技がひらめく。', band=420)
VOICE.append(dict(file='v_hero_m_glimmer_1', at=T_FRZ + 0.05))
SFX.append(dict(id='glimmer', at=T_FRZ, gain=-4))
cut('bt_glimmer', T_FRZ + 1.4, 1.7, src=7.75, gamesfx=-6)
# 派生技:「連ね斬りから、返し刃を編み出した！」（カットの 18.8 秒ごろ）
D0 = T_FRZ + 3.1
cut('bt_derive', D0, 4.9, src=15.3, zoom=(1.0, 1.05), center=(0.5, 0.45), gamesfx=-6)
big('技は、派生する。', D0 + 3.3, D0 + 4.85, y=870, size=120, band=250)
# 合成術（2 属性）: ヴィオラの 野を焼く風
S0 = D0 + 4.9
SPELL_SRC = 4.9   # カットの 5.2 秒で「ヴィオラは野を焼く風を唱えた！」、6.0〜8.0 秒で術の光
cut('bt_spell', S0, 4.6, src=SPELL_SRC, zoom=(1.0, 1.22), center=(0.36, 0.62), gamesfx=-5)
FLASH.append((S0 + 1.15, 0.08, 0.4, 0.35, (1.0, 0.8, 0.55)))
VOICE.append(dict(file='b_viola_bigtech_1', at=S0 + 0.2))
sub('ヴィオラ「炎よ、風よ、舞いなさい！」', S0 + 0.2, S0 + 2.9, y=990)
T.append(dict(kind='big_sub', text='属性を重ねて', t0=S0 + 2.2, t1=S0 + 4.55, x=960, y=720, anim='rise', fin=0.3, fout=0.35, band=330))
big('合成術', S0 + 2.4, S0 + 4.55, y=840, size=150)
# 速さ（戦闘の速さを切り替える）
P0 = S0 + 4.6
cut('bt_speed', P0, 3.2, src=0.35, gamesfx=-7)
cap('SPEED', '速さも自由に', P0 + 0.2, P0 + 3.1)

# ================================================================== 7 寄り道（4 分割）
X0 = P0 + 3.2
BOX = [(0, 0), (964, 0), (0, 544), (964, 544)]
EXTRA = [('ex_golden', 1.4, '金色の魔物'), ('ex_steal', 8.0, '盗む'), ('ex_shop', 0.9, 'まとめ買い'), ('ex_bestiary', 0.3, '図鑑')]
for i, (c, src, label) in enumerate(EXTRA):
    bx, by = BOX[i]
    cut(c, X0 + i * 0.2, 7.8 - i * 0.2, src=src, box=(bx, by, 956, 536), xin=0.3, gamesfx=-9 if i < 2 else None)
    T.append(dict(kind='cap_k', text=label, style=dict(size=40, track=4), t0=X0 + i * 0.2 + 0.2, t1=X0 + 7.7, x=bx + 40, y=by + 60, anchor=(0, 0.5), anim='slide', fin=0.3, band=None))
big('寄り道も、たっぷり。', X0 + 1.2, X0 + 7.6, y=540, size=100, band=230)

# ================================================================== 6' 強敵（狼の群れ頭）
B0 = X0 + 8.0
BOSS_SUMMON = 40.2   # bt_boss: 40〜44 秒「群れの遠吠え」→ 狼 C・D が現れる
BOSS_KILL = 16.4     # bt_boss_kill: 18 秒ごろ炎の旋風で倒れる → 21 秒「勝利」
cut('bt_boss', B0, 3.0, src=2.0, gamesfx=-6)
SFX.append(dict(id='roar', at=B0 + 0.1, gain=-4))
cut('bt_boss', B0 + 3.0, 3.8, src=BOSS_SUMMON, zoom=(1.0, 1.12), center=(0.3, 0.6), gamesfx=-6)
cap('BOSS', '仲間を呼ぶ強敵', B0 + 3.2, B0 + 6.6)
cut('bt_boss_kill', B0 + 6.8, 5.4, src=BOSS_KILL, gamesfx=-4)
C0 = B0 + 12.2

# ================================================================== 8 山場: 千年樹のこずえに歌の灯
FLASH.append((C0, 0.25, 0.8, 0.9))
cut('fin_beacon', C0, 3.6, src=2.5, zoom=(1.0, 1.08), center=(0.5, 0.35))
SFX.append(dict(id='light', at=C0 + 0.3, gain=-3))
cut('fin_beacon', C0 + 3.6, 3.0, src=5.6, zoom=(1.12, 1.16), center=(0.5, 0.42), xin=0.3)
cut('fin_beacon', C0 + 6.6, 3.0, src=12.9, zoom=(1.1, 1.14), center=(0.5, 0.8), xin=0.3)
L0 = C0 + 9.6
cut('fin_lights', L0, 5.6, src=0.2, zoom=(1.6, 1.72), center=(0.5, 0.24), xin=0.6)
T.append(dict(kind='tag', text='峠の向こうで、残る七つの灯が\n語り部を待っている。', style=dict(size=66), t0=L0 + 1.4, t1=L0 + 5.4, x=960, y=700, anim='rise', fin=0.7, fout=0.5))

# ================================================================== 9 終わりの札
E0 = L0 + 5.6
cut('title_screen', E0, 11.0, src=2.4, xin=0.8)
T.append(dict(kind='end_main', text='体験版テスター募集中', t0=E0 + 1.2, t1=E0 + 10.6, x=478, y=640, anim='rise', fin=0.6, fout=0.8, sweep=1.1, sweep_at=0.6))
T.append(dict(kind='end_sub', text='Steamにて配信予定', t0=E0 + 1.8, t1=E0 + 10.6, x=478, y=760, anim='rise', fin=0.6, fout=0.8))
T.append(dict(kind='end_credit', text='Studio Metem', style=dict(font=FONT_EN_PATH), t0=E0 + 2.4, t1=E0 + 10.6, x=478, y=960, anim='fade', fin=0.8, fout=0.8))
DIP.append((E0 + 11.0, 0.9))
DURATION = E0 + 11.0

# ================================================================== 音
MUSIC += [
    dict(file='title', at=0.0, src=0.0, dur=31.4, fout=0.4, gain=0),
    dict(file='title', at=31.1, src=48.9, dur=6.4, fin=0.25, fout=0.6, gain=0),
    dict(file='overworld', at=T0_OW - 0.05, src=0.0, dur=T_SHATTER - T0_OW + 0.1, fin=0.1, fout=0.5, gain=-1),
    dict(file='battle', at=T_SHATTER, src=0.711, dur=B0 - T_SHATTER + 0.3, fout=0.4, gain=-1),
    dict(file='boss', at=B0, src=0.03, dur=C0 - B0 + 0.2, fin=0.05, fout=0.4, gain=-1),
    dict(file='dawn', at=C0 - 0.1, src=21.375, dur=DURATION - C0 + 0.1, fin=0.3, fout=3.0, gain=0),
]
