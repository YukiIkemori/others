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


def cap(kicker, text, t0, t1):
    """機能の見出し（左下）: 小さい金の英字 ＋ 大きい白"""
    T.append(dict(kind='cap_k', text=kicker, style=dict(font=FONT_EN_PATH), t0=t0, t1=t1, x=110, y=838, anchor=(0, 0.5), anim='slide', fin=0.35, fout=0.3))
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
cut('title_screen', 31.3, 2.6, src=0.25, speed=0.6)
cut('title_screen', 33.9, 3.3, src=1.82, freeze=True, zoom=(1.0, 1.05), center=(0.3, 0.3))
SFX.append(dict(id='light', at=31.25, gain=-3))
SFX.append(dict(id='glimmer', at=34.2, gain=-10))

DURATION = 37.2
