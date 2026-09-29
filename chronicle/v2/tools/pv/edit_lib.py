# 短い版（30 秒・15 秒）の台本の道具。edit_main.py と同じ書き方（cut・sub・cap・big）を、名前の表を空にして使う。
#   import edit_lib as L; L.reset(); L.cut(...); ...; V, T, ... = L.V, L.T, ...
import os

FONT_EN_PATH = os.path.join(os.environ.get('PV_FONTS', ''), 'cinzel-700.ttf')
BAR_TITLE, BAR_OW, BAR_BT, BAR_BOSS, BAR_DAWN = 60 / 92 * 3, 60 / 112 * 4, 60 / 164 * 4, 60 / 150 * 4, 60 / 84 * 3
V, T, SFX, VOICE, MUSIC, BARS, FLASH, DIP = [], [], [], [], [], [], [], []


def reset():
    for x in (V, T, SFX, VOICE, MUSIC, BARS, FLASH, DIP):
        x.clear()


def cut(clip, at, dur, src=0.0, **k):
    V.append(dict(clip=clip, at=at, dur=dur, src=src, **k))


def sub(text, t0, t1, y=1015):
    T.append(dict(kind='sub', text=text, t0=t0, t1=t1, x=960, y=y, fin=0.2, fout=0.25))


def cap(kicker, text, t0, t1, band=None):
    T.append(dict(kind='cap_k', text=kicker, style=dict(font=FONT_EN_PATH), t0=t0, t1=t1, x=110, y=838, anchor=(0, 0.5), anim='slide', fin=0.3, fout=0.25, band=band, band_k=0.75))
    T.append(dict(kind='cap', text=text, t0=t0 + 0.06, t1=t1, x=104, y=915, anchor=(0, 0.5), anim='slide', fin=0.3, fout=0.25))


def tag(text, t0, t1, y=540, size=None):
    st = dict(size=size) if size else {}
    T.append(dict(kind='tag', text=text, style=st, t0=t0, t1=t1, x=960, y=y, anim='rise', fin=0.6, fout=0.4))


def big(text, t0, t1, y=500, size=None, subtext=None, band=None):
    st = dict(size=size) if size else {}
    T.append(dict(kind='big', text=text, style=st, t0=t0, t1=t1, x=960, y=y, anim='pop', move=0.3, fin=0.18, fout=0.3, sweep=0.8, sweep_at=0.2, band=band))
    if subtext:
        T.append(dict(kind='big_sub', text=subtext, t0=t0 + 0.2, t1=t1, x=960, y=y + (size or 210) * 0.5 + 60, anim='rise', fin=0.25, fout=0.3))


def end_card(e0, dur):
    """終わりの札（題字の絵の上に、左下へ）"""
    cut('title_screen', e0, dur, src=2.4, xin=0.5)
    T.append(dict(kind='end_main', text='体験版テスター募集中', t0=e0 + 0.5, t1=e0 + dur - 0.2, x=478, y=640, anim='rise', fin=0.5, fout=0.5, sweep=1.0, sweep_at=0.5))
    T.append(dict(kind='end_sub', text='Steamにて配信予定', t0=e0 + 0.9, t1=e0 + dur - 0.2, x=478, y=760, anim='rise', fin=0.5, fout=0.5))
    T.append(dict(kind='end_credit', text='Studio Metem', style=dict(font=FONT_EN_PATH), t0=e0 + 1.3, t1=e0 + dur - 0.2, x=478, y=960, anim='fade', fin=0.6, fout=0.5))
