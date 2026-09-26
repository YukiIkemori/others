#!/usr/bin/env python3
"""Promo trailer composer: game footage (promo/frames/<scene>/*.png from capture.js) + captions
in the game's pixel font + the game's own music / SFX  →  promo/luminas_trailer.mp4

    python3 promo/compose.py                 full render (video + audio → mp4)
    python3 promo/compose.py --stills        also write promo/stills/*.png
    python3 promo/compose.py --preview 12.5  write one frame at t=12.5 s to promo/preview.png

Needs: Pillow, numpy, ffmpeg (imageio_ffmpeg's static binary is used when present), and the
WAVs rendered by `node tools/render_audio.js render … --wav` in /tmp/claude-0/audio (see README).
"""
import json
import math
import os
import random
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FRAMES = os.path.join(HERE, 'frames')
AUDIO = os.environ.get('RPG_AUDIO', '/tmp/claude-0/audio')
FONT = os.path.join(ROOT, 'assets', 'fonts', 'DotGothic16-Regular.ttf')
OUT = os.path.join(HERE, 'luminas_trailer.mp4')
W, H, FPS = 1920, 1080, 30
SR = 32000  # the game's renders; ffmpeg resamples to 48 kHz

GOLD = (245, 197, 66)
WHITE = (255, 255, 255)
NAVY = (8, 10, 32)


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


# ------------------------------------------------------------------ storyboard
# A section = one theme (caption panel side, tag, captions) and a run of shots.
# shot: (scene, first_frame, last_frame_exclusive, speed)   (source frames are 30 fps)
# caption: (seconds_from_section_start, [lines], sub)  — *text* is drawn gold
SECTIONS = [
    dict(name='open', side='L', tag='BROWSER RPG', music='title',
         shots=[('title', 14, 92, 1.0)],
         caps=[(0.25, ['ブラウザで遊べる', '*本格*コマンドRPG'], 'インストール不要・無料')]),
    dict(name='story', side='R', tag='STORY',
         shots=[('intro', 100, 176, 1.0)],
         caps=[(0.0, ['*五つの紋章*を集め', '魔王を討て'], '光の紋章と三人の勇者の物語')]),
    dict(name='world', side='L', tag='WORLD',
         shots=[('town2', 2, 44, 1.0), ('ship', 18, 96, 1.2)],
         caps=[(0.0, ['*個性あふれる*', '町と人々'], None), ('@1', ['*船*で世界を', '駆けめぐる'], None)]),
    dict(name='battle', side='R', tag='BATTLE', music='battle',
         shots=[('battle', 0, 36, 1.0), ('battle', 70, 100, 1.0), ('battle', 186, 232, 1.0),
                ('battle', 256, 300, 1.0), ('auto', 62, 194, 2.0), ('boss', 262, 348, 1.1)],
         caps=[(0.0, ['王道', '*コマンドバトル*'], '技と魔法が炸裂する'),
               ('@4', ['*オート*・*リピート*', 'で快適'], 'サクサク進む戦闘'),
               ('@5', ['強敵との', '*死闘*'], None)]),
    dict(name='jobs', side='L', tag='JOB SYSTEM',
         shots=[('jobs', 16, 176, 1.6), ('jobs', 284, 352, 1.0), ('jobs', 506, 556, 1.0)],
         caps=[(0.0, ['*19*のジョブ', '×*214*のアビリティ'], '育てたジョブを自由に組み合わせ'),
               ('@1', ['極めれば', '*マスター特典*'], '能力アップ＆特性が常時発動')]),
    dict(name='rare', side='R', tag='RARE',
         shots=[('rare', 20, 80, 1.0), ('rare', 682, 750, 1.0)],
         caps=[(0.0, ['めったに', '出会えない*魔物*'], None), ('@1', ['*★レアドロップ*', '*★レア盗み*'], 'ここでしか手に入らない装備')]),
    dict(name='book', side='L', tag='MONSTER BOOK',
         shots=[('book', 14, 104, 1.5), ('book', 110, 212, 1.2)],
         caps=[(0.0, ['*127種*の', '魔物図鑑を', 'コンプせよ'], None)]),
    dict(name='abyss', side='R', tag='POST GAME', music='abyss',
         shots=[('abyss_walk', 0, 72, 1.0), ('abyss_walk', 88, 120, 1.0)],
         caps=[(0.0, ['クリア後には', '*深淵の迷宮*'], None)]),
    dict(name='lord', side='R', tag='POST GAME', music='lastboss',
         shots=[('lord', 14, 50, 1.0), ('lord', 188, 300, 1.4), ('lord', 414, 452, 1.0)],
         caps=[(0.0, ['レベルだけでは', '勝てない*裏ボス*'], '最強の敵が待ち受ける')]),
    dict(name='end', side=None, tag=None, music='end', seconds=7.0, shots=[], caps=[]),
]


def shot_len(s):
    scene, a, b, sp = s
    return int(round((b - a) / sp))


def build_timeline():
    """→ list of per-frame dicts, section start frames"""
    tl, starts = [], {}
    for si, sec in enumerate(SECTIONS):
        # caption times given as '@k' = start of shot k
        caps = []
        for (ct, lines, sub) in sec['caps']:
            if isinstance(ct, str):
                k = int(ct[1:])
                ct = sum(shot_len(x) for x in sec['shots'][:k]) / FPS
            caps.append((ct, lines, sub))
        sec['caps'] = caps
        starts[sec['name']] = len(tl)
        if sec['name'] == 'end':
            n = int(sec['seconds'] * FPS)
            for i in range(n):
                tl.append(dict(sec=si, kind='end', t=i))
            continue
        for shi, sh in enumerate(sec['shots']):
            scene, a, b, sp = sh
            n = shot_len(sh)
            for i in range(n):
                src = min(b - 1, a + int(i * sp))
                tl.append(dict(sec=si, kind='game', scene=scene, src=src, shot=shi, i=i, n=n, a=a, sp=sp))
    return tl, starts


# ------------------------------------------------------------------ drawing helpers
_fonts = {}


def font(size):
    if size not in _fonts:
        _fonts[size] = ImageFont.truetype(FONT, size)
    return _fonts[size]


def parse_markup(line):
    """'*gold* white' → [(text, gold?)]"""
    out, gold, buf = [], False, ''
    for ch in line:
        if ch == '*':
            if buf:
                out.append((buf, gold))
            buf, gold = '', not gold
        else:
            buf += ch
    if buf:
        out.append((buf, gold))
    return out


def text_width(segs, f):
    return sum(f.getlength(t) for t, _ in segs)


def render_text_block(lines, sub, max_w, size=84, sub_size=40):
    """caption block (RGBA): big lines + optional sub line, auto-shrunk to max_w"""
    parsed = [parse_markup(l) for l in lines]
    sz = size
    while sz > 40 and max(text_width(p, font(sz)) for p in parsed) > max_w:
        sz -= 2
    f = font(sz)
    lh = int(sz * 1.28)
    sub_f = font(sub_size)
    sub_w = sub_f.getlength(sub) if sub else 0
    ssz = sub_size
    while sub and sub_w > max_w and ssz > 24:
        ssz -= 2
        sub_f = font(ssz)
        sub_w = sub_f.getlength(sub)
    h = lh * len(lines) + (int(ssz * 1.9) if sub else 0) + 24
    w = max_w + 24
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y = 6
    for p in parsed:
        x = 6
        for t, g in p:
            d.text((x, y), t, font=f, fill=GOLD if g else WHITE, stroke_width=max(4, sz // 14), stroke_fill=(10, 8, 30))
            x += f.getlength(t)
        y += lh
    if sub:
        y += int(ssz * 0.35)
        # thin gold rule then the sub line
        d.rectangle([8, y, 8 + 120, y + 3], fill=GOLD)
        y += int(ssz * 0.45)
        d.text((8, y), sub, font=sub_f, fill=(214, 220, 255), stroke_width=3, stroke_fill=(10, 8, 30))
    return img


def dq_frame(w, h, pad=10, border=6, radius=14):
    """DQ-style window frame (RGBA) sized to surround a w×h picture"""
    fw, fh = w + 2 * (pad + border), h + 2 * (pad + border)
    img = Image.new('RGBA', (fw + 40, fh + 40), (0, 0, 0, 0))
    # soft glow / shadow
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([20, 26, 20 + fw, 26 + fh], radius=radius + 6, fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(12))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([20, 20, 20 + fw, 20 + fh], radius=radius, fill=(0, 0, 0, 255))
    d.rounded_rectangle([20 + 3, 20 + 3, 20 + fw - 3, 20 + fh - 3], radius=radius - 2, outline=(255, 255, 255, 255), width=border)
    return img, 20 + pad + border  # image, picture offset inside it


def make_background():
    """deep indigo gradient + faint diamond lattice (static part)"""
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    top = np.array([6, 8, 30], float)
    bot = np.array([34, 18, 64], float)
    t = np.clip(y * 0.85 + x * 0.15, 0, 1)[..., None]
    arr = top * (1 - t) + bot * t
    # vignette glow in the centre-left
    g = np.exp(-(((x - 0.35) / 0.55) ** 2 + ((y - 0.45) / 0.6) ** 2))[..., None]
    arr = arr + g * np.array([18, 14, 40])
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')
    d = ImageDraw.Draw(img, 'RGBA')
    for k in range(-H, W, 90):
        d.line([(k, 0), (k + H, H)], fill=(255, 255, 255, 7), width=2)
        d.line([(k + H, 0), (k, H)], fill=(255, 255, 255, 5), width=2)
    return img


class Stars:
    def __init__(self, n=90, seed=3):
        rnd = random.Random(seed)
        self.s = [(rnd.random() * W, rnd.random() * H, rnd.choice([2, 3, 3, 4, 6]), rnd.random() * 6.28, 0.2 + rnd.random() * 0.9) for _ in range(n)]

    def draw(self, img, f):
        d = ImageDraw.Draw(img, 'RGBA')
        for (x, y, s, ph, sp) in self.s:
            xx = (x - f * sp * 0.6) % W
            yy = (y + f * sp * 0.25) % H
            a = int(70 + 110 * (0.5 + 0.5 * math.sin(ph + f * 0.08 * sp)))
            col = (255, 230, 150, a) if s >= 4 else (200, 210, 255, a)
            d.rectangle([xx, yy, xx + s - 1, yy + s - 1], fill=col)
            if s >= 6:
                d.rectangle([xx - 4, yy + 2, xx + s + 3, yy + 3], fill=(255, 230, 150, a // 3))
                d.rectangle([xx + 2, yy - 4, xx + 3, yy + s + 3], fill=(255, 230, 150, a // 3))


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


# ------------------------------------------------------------------ layout
GAME_W, GAME_H = 1152, 1008  # 1024x896 canvas × 1.125
MARGIN_Y = (H - GAME_H) // 2
LAYOUT = {
    'L': dict(game_x=52, panel_x=1256, panel_w=620),
    'R': dict(game_x=W - 52 - GAME_W, panel_x=44, panel_w=620),
}


class Composer:
    def __init__(self):
        self.tl, self.starts = build_timeline()
        self.bg = make_background()
        self.stars = Stars()
        self.frame_img, self.frame_off = dq_frame(GAME_W, GAME_H)
        self.cache = {}
        self.caps = {}
        self.tags = {}
        self.logo_small = self.render_small_logo()
        self.end_assets = None

    # -- assets
    def src(self, scene, i):
        key = (scene, i)
        if key not in self.cache:
            if len(self.cache) > 64:
                self.cache.clear()
            p = os.path.join(FRAMES, scene, '%05d.png' % i)
            self.cache[key] = Image.open(p).convert('RGB')
        return self.cache[key]

    def caption(self, si, ci):
        key = (si, ci)
        if key not in self.caps:
            t, lines, sub = SECTIONS[si]['caps'][ci]
            lay = LAYOUT[SECTIONS[si]['side']]
            self.caps[key] = render_text_block(lines, sub, lay['panel_w'] - 30)
        return self.caps[key]

    def tag(self, text):
        if text not in self.tags:
            f = font(40)
            w = int(f.getlength(text)) + 60
            img = Image.new('RGBA', (w + 20, 70), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            d.polygon([(6, 34), (18, 22), (30, 34), (18, 46)], fill=GOLD)  # diamond bullet
            d.text((44, 12), text, font=f, fill=GOLD, stroke_width=3, stroke_fill=(10, 8, 30))
            self.tags[text] = img
        return self.tags[text]

    def render_small_logo(self):
        f = font(34)
        t = 'ルミナス・クレスト'
        img = Image.new('RGBA', (int(f.getlength(t)) + 20, 56), (0, 0, 0, 0))
        ImageDraw.Draw(img).text((6, 6), t, font=f, fill=(200, 190, 150), stroke_width=3, stroke_fill=(10, 8, 30))
        return img

    # -- frames
    def game_picture(self, fr):
        im = self.src(fr['scene'], fr['src'])
        # slow push-in over the shot (1.00 → 1.035), centred slightly above the middle
        k = fr['i'] / max(1, fr['n'] - 1)
        z = 1.0 + 0.035 * k
        cw, ch = 1024 / z, 896 / z
        cx, cy = 512, 448 - 10 * k
        box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
        return im.resize((GAME_W, GAME_H), Image.LANCZOS, box=box)

    def render(self, f):
        fr = self.tl[f]
        sec = SECTIONS[fr['sec']]
        if fr['kind'] == 'end':
            img = self.render_end(fr['t'])
        else:
            img = self.bg.copy()
            self.stars.draw(img, f)
            lay = LAYOUT[sec['side']]
            pic = self.game_picture(fr)
            gx, gy = lay['game_x'], MARGIN_Y
            img.paste(self.frame_img, (gx - self.frame_off, gy - self.frame_off), self.frame_img)
            img.paste(pic, (gx, gy))
            self.draw_panel(img, f, fr, sec, lay)
        # section-start flash (white) and the opening fade from black
        s0 = self.starts[sec['name']]
        dt = f - s0
        if fr['sec'] > 0 and dt < 7 and sec['name'] != 'lord':
            a = (1 - dt / 7) * 0.85
            img = Image.blend(img, Image.new('RGB', (W, H), WHITE), a)
        if f < 12:
            img = Image.blend(Image.new('RGB', (W, H), (0, 0, 0)), img, f / 12)
        n = len(self.tl)
        if f > n - 20:
            img = Image.blend(img, Image.new('RGB', (W, H), (0, 0, 0)), (f - (n - 20)) / 20)
        return img

    def draw_panel(self, img, f, fr, sec, lay):
        s0 = self.starts[sec['name']]
        t = (f - s0) / FPS
        px, pw = lay['panel_x'], lay['panel_w']
        # tag (slides in with the section)
        if sec.get('tag'):
            tg = self.tag(sec['tag'])
            a = ease((f - s0) / 8)
            x = int(px + (1 - a) * 40)
            layer = tg.copy()
            if a < 1:
                layer.putalpha(layer.getchannel('A').point(lambda v: int(v * a)))
            img.paste(layer, (x, 300), layer)
        # current caption (last one whose time has come) with slide/fade in; previous fades out
        caps = sec['caps']
        cur = None
        for ci, (ct, _, _) in enumerate(caps):
            if t >= ct:
                cur = ci
        if cur is not None:
            ct = caps[cur][0]
            k = (t - ct) * FPS
            a = ease(k / 9)
            cap = self.caption(fr['sec'], cur)
            y = 392 + int((1 - a) * 30)
            layer = cap
            if a < 1:
                layer = cap.copy()
                layer.putalpha(layer.getchannel('A').point(lambda v: int(v * a)))
            img.paste(layer, (px + int((1 - a) * 50), y), layer)
        # small logo at the bottom of the panel
        img.paste(self.logo_small, (px + 4, H - 120), self.logo_small)

    # -- end card
    def end_setup(self):
        title = self.src('title', 140)
        # emblem + logo + subtitle from the real title screen (logical 32..224 × 4..100)
        logo = title.crop((12 * 4, 2 * 4, 244 * 4, 118 * 4))
        mask = Image.fromarray((np.asarray(logo.convert('L')) > 0).astype(np.uint8) * 255)
        # keep the night-sky look: use the crop as is, with feathered edges
        fe = Image.new('L', logo.size, 0)
        ImageDraw.Draw(fe).rounded_rectangle([50, 30, logo.size[0] - 51, logo.size[1] - 31], radius=120, fill=255)
        fe = fe.filter(ImageFilter.GaussianBlur(34))
        sc = 0.92
        logo = logo.resize((int(logo.size[0] * sc), int(logo.size[1] * sc)), Image.LANCZOS)
        fe = fe.resize(logo.size)
        heroes = []
        for group in (['yuki_hero', 'yuki_ninja', 'yuki_paladin', 'yuki_warrior'],
                      ['non_sage', 'non_whitemage', 'non_priest', 'non_bard'],
                      ['metem_blackmage', 'metem_timemage', 'metem_spellblade', 'metem_mage']):
            frames = []
            for g in group:
                p = os.path.join(ROOT, 'lp', 'img', g + '.png')
                im = Image.open(p).convert('RGBA')
                im = im.resize((im.size[0] * 3, im.size[1] * 3), Image.NEAREST)
                frames.append(im)
            heroes.append(frames)
        self.end_assets = dict(logo=logo, fe=fe, heroes=heroes,
                               t1=render_text_block(['今すぐ*ブラウザ*でプレイ！'], None, 1500, size=92),
                               t2=render_text_block(['無料・インストール不要・スマホ対応'], None, 1400, size=52))

    def render_end(self, t):
        if not self.end_assets:
            self.end_setup()
        A = self.end_assets
        img = self.bg.copy()
        self.stars.draw(img, 2000 + t)
        # logo (fades/zooms in)
        a = ease(t / 14)
        lg = A['logo']
        s = 0.92 + 0.08 * a
        lw, lh = int(lg.size[0] * s), int(lg.size[1] * s)
        lgs = lg.resize((lw, lh), Image.LANCZOS)
        m = A['fe'].resize((lw, lh)).point(lambda v: int(v * a))
        img.paste(lgs, ((W - lw) // 2, 40), m)
        # heroes: cycle through their job outfits
        y0 = 40 + lh - 20
        for i, frames in enumerate(A['heroes']):
            k = (t // 12 + i) % len(frames)
            im = frames[k]
            ha = ease((t - 8 - i * 4) / 10)
            if ha <= 0:
                continue
            x = W // 2 + (i - 1) * 260 - im.size[0] // 2
            y = y0 + int((1 - ha) * 40)
            layer = im.copy()
            layer.putalpha(layer.getchannel('A').point(lambda v: int(v * ha)))
            img.paste(layer, (x, y), layer)
        # call to action
        for key, ty, t0 in (('t1', 800, 20), ('t2', 925, 30)):
            ca = ease((t - t0) / 10)
            if ca <= 0:
                continue
            tx = A[key]
            tx = tx.crop(tx.getbbox())
            layer = tx.copy()
            layer.putalpha(layer.getchannel('A').point(lambda v: int(v * ca)))
            img.paste(layer, ((W - tx.size[0]) // 2, ty + int((1 - ca) * 20)), layer)
        return img


# ------------------------------------------------------------------ audio
def read_wav(name):
    p = os.path.join(AUDIO, name + '.wav')
    with wave.open(p) as w:
        assert w.getframerate() == SR and w.getsampwidth() == 2
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 1:
            a = np.repeat(a[:, None], 2, axis=1)
        else:
            a = a.reshape(-1, 2)
    return a


def build_audio(comp, path):
    tl, starts = comp.tl, comp.starts
    total = len(tl) / FPS
    n = int(total * SR) + SR
    music = np.zeros((n, 2), np.float32)
    fx = np.zeros((n, 2), np.float32)
    duck = np.ones(n, np.float32)

    def put(buf, a, t, gain=1.0):
        i = int(t * SR)
        if i >= n:
            return
        m = min(len(a), n - i)
        buf[i:i + m] += a[:m] * gain

    def env(a, fade_in, fade_out):
        a = a.copy()
        fi, fo = int(fade_in * SR), int(fade_out * SR)
        if fi:
            a[:fi] *= np.linspace(0, 1, fi)[:, None]
        if fo:
            a[-fo:] *= np.linspace(1, 0, fo)[:, None]
        return a

    sec_t = lambda name: starts[name] / FPS
    # music bed: title → battle → abyss → lastboss → victory fanfare + ending theme
    plan = [('bgm_title', 0.0, sec_t('battle'), 0.0, 0.8, 1.0),
            ('bgm_battle', sec_t('battle'), sec_t('abyss'), 0.0, 0.25, 1.0),
            ('bgm_abyss', sec_t('abyss'), sec_t('lord'), 0.0, 0.3, 1.0),
            ('bgm_lastboss', sec_t('lord'), sec_t('end'), 0.0, 0.2, 1.0)]
    for name, t0, t1, off, fo, g in plan:
        a = read_wav(name)
        seg = a[int(off * SR): int(off * SR) + int((t1 - t0 + fo) * SR)]
        put(music, env(seg, 0.02, fo), t0, g)
    te = sec_t('end')
    vic = read_wav('jingle_victory')
    put(music, env(vic, 0.0, 0.3), te + 0.05, 1.0)
    ending = read_wav('bgm_ending')
    tail = total - (te + len(vic) / SR - 0.4)
    seg = ending[:int((tail + 0.2) * SR)]
    put(music, env(seg, 0.5, 1.8), te + len(vic) / SR - 0.4, 0.9)

    # the game's own SFX / jingles, on the frames where the game played them
    by_scene = {}
    for sc in set(fr.get('scene') for fr in tl if fr['kind'] == 'game'):
        p = os.path.join(FRAMES, sc, 'sounds.json')
        by_scene[sc] = json.load(open(p)) if os.path.exists(p) else []
    wav_cache = {}

    def snd(kind, sid):
        key = ('sfx_' if kind == 'sfx' else 'jingle_') + sid
        if key not in wav_cache:
            try:
                wav_cache[key] = read_wav(key)
            except FileNotFoundError:
                wav_cache[key] = None
        return wav_cache[key]

    SFX_GAIN = {'cursor': 0.35, 'confirm': 0.45, 'confirm_soft': 0.45}
    used = []
    for f, fr in enumerate(tl):
        if fr['kind'] != 'game':
            continue
        # sounds logged for the source frames this video frame covers
        prev_src = tl[f - 1]['src'] if f > 0 and tl[f - 1].get('scene') == fr['scene'] and tl[f - 1].get('shot') == fr['shot'] and tl[f - 1]['sec'] == fr['sec'] else fr['src'] - 1
        for (sf, kind, sid) in by_scene[fr['scene']]:
            if prev_src < sf <= fr['src'] or (fr['i'] == 0 and sf == fr['src']):
                if kind == 'bgm':
                    continue
                if kind == 'jingle' and sid not in ('rare', 'jobup'):
                    continue
                a = snd(kind, sid)
                if a is None:
                    continue
                t = f / FPS
                if kind == 'jingle':
                    put(fx, a, t, 0.95)
                    i0, i1 = int(t * SR), min(n, int((t + len(a) / SR) * SR))
                    duck[i0:i1] = np.minimum(duck[i0:i1], 0.18)
                else:
                    put(fx, a, t, SFX_GAIN.get(sid, 0.7))
                used.append((round(t, 2), sid))
    # smooth the duck envelope (≈60 ms)
    k = int(0.06 * SR)
    duck = np.convolve(duck, np.ones(k) / k, mode='same').astype(np.float32)
    mix = music * duck[:, None] + fx
    mix = mix[:int(total * SR)]
    # fade the very end
    fo = int(1.2 * SR)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    peak = float(np.max(np.abs(mix)))
    if peak > 0.98:
        mix *= 0.98 / peak
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
    return used


def loudnorm_filter(ff, wav):
    """two-pass EBU R128 loudness normalisation to -14 LUFS / -1.5 dBTP"""
    r = subprocess.run([ff, '-hide_banner', '-nostats', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    txt = r.stderr[r.stderr.rfind('{'):r.stderr.rfind('}') + 1]
    m = json.loads(txt)
    return ('loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:'
            'measured_thresh={input_thresh}:offset={target_offset}:linear=true,aresample=48000').format(**m)


# ------------------------------------------------------------------ main
def main():
    args = sys.argv[1:]
    comp = Composer()
    n = len(comp.tl)
    print('timeline: %d frames = %.2f s' % (n, n / FPS))
    for s in SECTIONS:
        print('  %-7s %6.2f s' % (s['name'], comp.starts[s['name']] / FPS))
    if '--preview' in args:
        t = float(args[args.index('--preview') + 1])
        comp.render(min(n - 1, int(t * FPS))).save(os.path.join(HERE, 'preview.png'))
        return
    if '--stills' in args or '--stills-only' in args:
        os.makedirs(os.path.join(HERE, 'stills'), exist_ok=True)
        for name, t in (('01_title', 2.2), ('02_boss', 17.0), ('03_jobs', 23.0), ('04_rare', 29.0), ('05_abyss_lord', 41.0), ('06_endcard', n / FPS - 1.6)):
            comp.render(min(n - 1, int(t * FPS))).save(os.path.join(HERE, 'stills', name + '.png'))
        if '--stills-only' in args:
            return
    ff = ffmpeg()
    wav = os.path.join(HERE, 'frames', 'soundtrack.wav')
    used = build_audio(comp, wav)
    print('sfx/jingles placed:', len(used))
    af = loudnorm_filter(ff, wav)
    cmd = [ff, '-hide_banner', '-loglevel', 'error', '-y',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
           '-i', wav,
           '-map', '0:v', '-map', '1:a',
           '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
           '-tune', 'animation', '-g', '60', '-bf', '2',
           '-af', af, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
           '-movflags', '+faststart', '-shortest', OUT]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(n):
        p.stdin.write(comp.render(f).tobytes())
        if f % 150 == 0:
            print('  frame %d/%d' % (f, n), flush=True)
    p.stdin.close()
    p.wait()
    print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
