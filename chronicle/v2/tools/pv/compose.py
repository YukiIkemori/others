# PV の合成（映像）: 撮ったカット（clips/<id>.mp4）を台本（edit_*.py の V・T・BARS・FLASH）どおりに並べ、
# 文字・帯（レターボックス）・光のフラッシュ・ゆっくりしたズームを重ねて、1 本の映像（音なし）にする。
#   python3 v2/tools/pv/compose.py <edit.py> <clips のディレクトリ> <出力.mp4> [--from 秒 --to 秒] [--stills <dir> 秒,秒,...]
# 1 コマずつ numpy で重ね、そのまま ffmpeg の標準入力へ流す（コマの連番をディスクに書かない）。
# 文字はゲームの書体（Zen Maru Gothic・Cinzel）で描く。字の中身は台本の側に書く（ここは描き方だけ）。
import math
import os
import runpy
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FF = os.environ.get('FFMPEG', '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2')
W, H, FPS = 1920, 1080, 60
HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.abspath(os.path.join(HERE, '..', '..'))
FONT_JA = os.path.join(V2, 'assets', 'fonts', 'ZenMaruGothic-Bold.ttf')
FONT_JA_M = os.path.join(V2, 'assets', 'fonts', 'ZenMaruGothic-Medium.ttf')
# Cinzel は woff2 しか無いので、合成の前に ttf へ直した物を使う（環境変数 PV_FONTS のディレクトリ）
FONT_EN = os.path.join(os.environ.get('PV_FONTS', ''), 'cinzel-700.ttf')

GOLD = [(255, 246, 214), (246, 214, 138), (214, 162, 72), (160, 104, 40)]


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


# ------------------------------------------------------------------ 文字の絵（RGBA の numpy、前もって 1 回だけ描く）
_fonts = {}


def font(path, size):
    k = (path, size)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(path, size)
    return _fonts[k]


def text_mask(text, f, track=0, line_gap=1.25):
    """文字の形（L）。複数行は中央ぞろえ。track は字の間（px）"""
    lines = text.split('\n')
    asc, desc = f.getmetrics()
    lh = int((asc + desc) * line_gap)

    def lw(s):
        if not track:
            return int(f.getlength(s))
        return int(sum(f.getlength(c) for c in s) + track * max(0, len(s) - 1))
    w = max(lw(s) for s in lines) + 8
    h = lh * len(lines) + 8
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    for i, s in enumerate(lines):
        x = (w - lw(s)) // 2
        y = 4 + i * lh
        if not track:
            d.text((x, y), s, font=f, fill=255)
        else:
            for c in s:
                d.text((x, y), c, font=f, fill=255)
                x += f.getlength(c) + track
    return m


def pad(img, p):
    w, h = img.size
    out = Image.new(img.mode, (w + 2 * p, h + 2 * p), 0)
    out.paste(img, (p, p))
    return out


def styled(text, style):
    """→ (RGBA の numpy float32 0..1、字の形の numpy 0..1)。style: dict(size, font, color|gold, stroke, glow, track, shadow)"""
    f = font(style.get('font', FONT_JA), style['size'])
    m = text_mask(text, f, style.get('track', 0), style.get('line_gap', 1.25))
    P = int(style.get('glow', 0) * 2.5 + style.get('stroke', 0) + 12)
    m = pad(m, P)
    w, h = m.size
    A = np.asarray(m, np.float32) / 255.0
    rgb = np.zeros((h, w, 3), np.float32)
    alpha = np.zeros((h, w), np.float32)
    # 影（下にずらしたぼかし）
    if style.get('shadow', True):
        sh = np.asarray(m.filter(ImageFilter.GaussianBlur(max(2, style['size'] // 14))), np.float32) / 255.0
        sh = np.roll(sh, max(2, style['size'] // 24), axis=0)
        a = sh * style.get('shadow_k', 0.85)
        rgb = rgb * (1 - a[..., None])
        alpha = a + alpha * (1 - a)
    # 光のにじみ
    if style.get('glow'):
        gl = np.asarray(m.filter(ImageFilter.GaussianBlur(style['glow'])), np.float32) / 255.0
        gc = np.array(style.get('glow_color', (255, 200, 110)), np.float32) / 255.0
        a = np.clip(gl * style.get('glow_k', 1.4), 0, 1) * 0.8
        rgb = rgb * (1 - a[..., None]) + gc * a[..., None]
        alpha = a + alpha * (1 - a)
    # 縁取り
    if style.get('stroke'):
        st = np.asarray(m.filter(ImageFilter.MaxFilter(style['stroke'] * 2 + 1)), np.float32) / 255.0
        sc = np.array(style.get('stroke_color', (20, 14, 10)), np.float32) / 255.0
        a = st * style.get('stroke_k', 0.9)
        rgb = rgb * (1 - a[..., None]) + sc * a[..., None]
        alpha = a + alpha * (1 - a)
    # 字の色（金は上から下へのグラデーション）
    if style.get('gold'):
        ys = np.nonzero(A.max(axis=1) > 0.1)[0]
        y0, y1 = (ys[0], ys[-1]) if len(ys) else (0, h)
        t = np.clip((np.arange(h) - y0) / max(1, (y1 - y0)), 0, 1)
        stops = np.array(GOLD, np.float32) / 255.0
        k = t * (len(stops) - 1)
        i = np.minimum(len(stops) - 2, k.astype(int))
        fr = (k - i)[:, None]
        col = stops[i] * (1 - fr) + stops[i + 1] * fr
        fc = np.broadcast_to(col[:, None, :], (h, w, 3))
    else:
        fc = np.broadcast_to(np.array(style.get('color', (250, 244, 232)), np.float32) / 255.0, (h, w, 3))
    rgb = rgb * (1 - A[..., None]) + fc * A[..., None]
    alpha = A + alpha * (1 - A)
    return np.dstack([rgb, alpha]).astype(np.float32), A


def image_rgba(path, width):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    im = im.resize((int(width), int(h * width / w)), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255.0
    return a, a[..., 3].copy()


# ------------------------------------------------------------------ 台本の文字の種類
STYLES = {
    # 画面の中ほどの一行（つかみ・物語の言葉）
    'tag': dict(size=76, color=(248, 240, 222), glow=16, glow_color=(255, 196, 120), glow_k=0.55, track=6, stroke=0),
    # 声の字幕（帯の中、または画面の下）
    'sub': dict(size=50, color=(250, 246, 236), stroke=4, stroke_k=0.75, track=2),
    # 機能の見出し（左下の札）: 上の小さい金と、下の大きい白
    'cap_k': dict(size=34, gold=True, stroke=2, track=6, glow=0),
    'cap': dict(size=72, color=(255, 252, 244), stroke=5, stroke_k=0.8, track=3, glow=10, glow_color=(0, 0, 0), glow_k=0.5),
    # 大きな一語（閃き・合成術）
    'big': dict(size=210, gold=True, stroke=8, glow=26, glow_color=(255, 180, 80), glow_k=0.9, track=18),
    'big_sub': dict(size=58, color=(255, 250, 238), stroke=5, stroke_k=0.8, track=4),
    # 終わりの札
    'end_main': dict(size=72, gold=True, stroke=5, glow=20, glow_color=(255, 190, 90), glow_k=0.8, track=4),   # 左右とも画面の 5% より内側（中心 x=478）
    'end_sub': dict(size=54, color=(246, 238, 220), stroke=3, stroke_k=0.7, track=6),
    'end_credit': dict(size=40, color=(222, 210, 186), font=FONT_EN, stroke=0, track=6, glow=0),
    'center_mid': dict(size=64, color=(255, 252, 244), stroke=5, stroke_k=0.8, track=4, glow=12, glow_color=(0, 0, 0), glow_k=0.6),
}


class Item:
    """文字・画像の 1 つ。t0〜t1 に出す。anim: fade（既定）| rise | slide | pop。sweep=秒 で光の帯を走らせる"""

    def __init__(self, d):
        self.d = d
        self.t0, self.t1 = d['t0'], d['t1']
        if d.get('image'):
            self.rgba, self.mask = image_rgba(d['image'], d.get('width', 900))
        else:
            st = dict(STYLES[d['kind']])
            st.update(d.get('style', {}))
            self.rgba, self.mask = styled(d['text'], st)
        self.h, self.w = self.rgba.shape[:2]

    def draw(self, frame, t):
        d = self.d
        if t < self.t0 or t >= self.t1:
            return
        fi, fo = d.get('fin', 0.45), d.get('fout', 0.4)
        a = min(1.0, (t - self.t0) / fi if fi > 0 else 1.0, (self.t1 - t) / fo if fo > 0 else 1.0)
        a = ease(a) * d.get('alpha', 1.0)
        if a <= 0.003:
            return
        anim = d.get('anim', 'fade')
        dx = dy = 0.0
        scale = 1.0
        k_in = ease_out((t - self.t0) / max(0.001, d.get('move', 0.7)))
        if anim == 'rise':
            dy = (1 - k_in) * 26
        elif anim == 'slide':
            dx = -(1 - k_in) * 60
        elif anim == 'pop':
            scale = 1 + (1 - k_in) * 0.25
        elif anim == 'drift':   # ゆっくり大きく（終わりの札・題字）
            scale = 1 + 0.04 * ((t - self.t0) / max(0.001, self.t1 - self.t0))
        img = self.rgba
        mask = self.mask
        if abs(scale - 1) > 0.002:
            nw, nh = max(2, int(self.w * scale)), max(2, int(self.h * scale))
            img = np.asarray(Image.fromarray((self.rgba * 255).astype(np.uint8), 'RGBA').resize((nw, nh), Image.BILINEAR), np.float32) / 255.0
            mask = np.asarray(Image.fromarray((self.mask * 255).astype(np.uint8), 'L').resize((nw, nh), Image.BILINEAR), np.float32) / 255.0
        h, w = img.shape[:2]
        ax, ay = d.get('anchor', (0.5, 0.5))
        x = int(round(d['x'] - w * ax + dx))
        y = int(round(d['y'] - h * ay + dy))
        if d.get('band'):   # 文字の後ろの横長の暗い帯（読みやすく）
            bh = d['band']
            by0 = int(d['y'] - bh / 2)
            ys = np.arange(bh, dtype=np.float32)
            prof = np.clip(np.minimum(ys, bh - 1 - ys) / (bh * 0.3), 0, 1)
            band_a = (prof * d.get('band_k', 0.6) * a)[:, None]
            y0c, y1c = max(0, by0), min(frame.shape[0], by0 + bh)
            frame[y0c:y1c] *= (1 - band_a[y0c - by0:y1c - by0])[..., None] if band_a.ndim == 2 else 1
        rgb = img[..., :3].copy()
        al = img[..., 3] * a
        # 光の帯（左から右へ、斜めに）
        if d.get('sweep'):
            s0 = self.t0 + d.get('sweep_at', 0.35)
            p = (t - s0) / d['sweep']
            if 0 <= p <= 1:
                yy, xx = np.mgrid[0:h, 0:w]
                u = xx + yy * 0.45
                c = -0.25 * w + p * (1.5 * w + h * 0.45)
                band = np.exp(-((u - c) / (w * 0.07 + 18)) ** 2) * mask
                rgb = np.clip(rgb + band[..., None] * np.array([1.0, 0.95, 0.8], np.float32) * 0.85, 0, 1)
                if d.get('sweep_only'):   # 下の絵（ゲームの題字）の上を光だけが走る
                    al = band * a * d.get('sweep_k', 0.8)
                    rgb = np.broadcast_to(np.array([1.0, 0.96, 0.84], np.float32), rgb.shape)
            elif d.get('sweep_only'):
                return
        blend(frame, rgb, al, x, y)


def blend(frame, rgb, al, x, y):
    H0, W0 = frame.shape[:2]
    h, w = al.shape
    sx0, sy0 = max(0, -x), max(0, -y)
    dx0, dy0 = max(0, x), max(0, y)
    ww, hh = min(w - sx0, W0 - dx0), min(h - sy0, H0 - dy0)
    if ww <= 0 or hh <= 0:
        return
    a = al[sy0:sy0 + hh, sx0:sx0 + ww, None]
    reg = frame[dy0:dy0 + hh, dx0:dx0 + ww]
    reg[:] = reg * (1 - a) + rgb[sy0:sy0 + hh, sx0:sx0 + ww] * a


# ------------------------------------------------------------------ 映像のカット（ffmpeg で読む）
class Reader:
    def __init__(self, path, src, nframes, speed=1.0):
        self.n = nframes
        self.i = 0
        vf = 'setpts=(PTS-STARTPTS)/%g,fps=%d' % (speed, FPS) if speed != 1 else 'null'
        self.p = subprocess.Popen([FF, '-v', 'error', '-ss', '%.3f' % src, '-i', path, '-vf', vf, '-frames:v', str(nframes + 2),
                                   '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE, bufsize=W * H * 3 * 2)
        self.last = None

    def next(self):
        buf = self.p.stdout.read(W * H * 3)
        if len(buf) == W * H * 3:
            self.last = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        self.i += 1
        return self.last

    def close(self):
        try:
            self.p.stdout.close()
            self.p.kill()
            self.p.wait()
        except Exception:
            pass


class Seg:
    """映像の 1 カット: clip・at（台本の秒）・dur・src（カットの中の秒）・speed・zoom=(始め, 終わり)・center=(x, y)（0..1）・
    freeze=True（src の 1 コマを止める）・xin=秒（前のカットから溶ける）・grade=dict(bright, sat)"""

    def __init__(self, d, clips):
        self.d = d
        self.path = os.path.join(clips, d['clip'] + '.mp4')
        self.at, self.dur = d['at'], d['dur']
        self.n = int(round(self.dur * FPS))
        self.f0 = int(round(self.at * FPS))
        self.reader = None
        self.hold = None

    def frame(self, fi):
        d = self.d
        k = fi - self.f0
        if self.reader is None and self.hold is None:
            if d.get('freeze'):
                r = Reader(self.path, d.get('src', 0), 1)
                self.hold = r.next().copy()
                r.close()
            else:
                self.reader = Reader(self.path, d.get('src', 0), self.n, d.get('speed', 1.0))
                self.rk = 0
        if self.hold is not None:
            img = self.hold
        else:
            while self.rk <= k:
                img = self.reader.next()
                self.rk += 1
            img = self.reader.last
        if img is None:
            return np.zeros((H, W, 3), np.float32)
        z = d.get('zoom')
        out = img
        if z:
            p = k / max(1, self.n - 1)
            zz = z[0] + (z[1] - z[0]) * (ease(p) if d.get('zease', True) else p)
            if abs(zz - 1) > 1e-4:
                cx, cy = d.get('center', (0.5, 0.5))
                cw, ch = W / zz, H / zz
                x0 = min(max(0.0, cx * W - cw / 2), W - cw)
                y0 = min(max(0.0, cy * H - ch / 2), H - ch)
                out = np.asarray(Image.fromarray(img).resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch)))
        f = out.astype(np.float32) / 255.0
        g = d.get('grade')
        if g:
            if 'sat' in g:
                lum = f @ np.array([0.299, 0.587, 0.114], np.float32)
                f = lum[..., None] + (f - lum[..., None]) * g['sat']
            if 'bright' in g:
                f = f * g['bright']
            f = np.clip(f, 0, 1)
        return f

    def close(self):
        if self.reader:
            self.reader.close()
            self.reader = None


# ------------------------------------------------------------------ 組み立て
def lerp_keys(keys, t):
    if not keys:
        return 0.0
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            return v0 + (v1 - v0) * ease((t - t0) / max(1e-6, t1 - t0))
    return keys[-1][1]


def render(edit, clips, out, t_from=None, t_to=None, stills=None, stills_dir=None):
    E = runpy.run_path(edit)
    total = E['DURATION']
    segs = [Seg(d, clips) for d in E['V']]
    items = [Item(d) for d in E.get('T', [])]
    bars = E.get('BARS', [])
    flashes = E.get('FLASH', [])
    dips = E.get('DIP', [])
    split = E.get('SPLIT', [])
    f_from = int((t_from or 0) * FPS)
    f_to = int((t_to if t_to is not None else total) * FPS)
    enc = None
    if out:
        enc = subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-framerate', str(FPS), '-i', '-',
                                '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    still_frames = set(int(round(s * FPS)) for s in (stills or []))
    prev_base = None
    for fi in range(f_from, f_to):
        if not enc and fi not in still_frames:
            continue
        t = fi / FPS
        frame = np.zeros((H, W, 3), np.float32)
        active = [s for s in segs if s.f0 <= fi < s.f0 + s.n]
        for j, s in enumerate(active):
            x = s.d.get('xin', 0)
            img = s.frame(fi)
            # 溶けの下地: 前のカットがもう終わっていれば、直前のコマ（黒ではなく）から溶かす
            if j == 0 and x and prev_base is not None:
                frame = prev_base
            if s.d.get('box'):   # 分割の画面の 1 枠（x, y, w, h）
                bx, by, bw, bh = s.d['box']
                small = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).resize((bw, bh), Image.BILINEAR), np.float32) / 255.0
                a = min(1.0, (fi - s.f0) / (x * FPS)) if x else 1.0
                frame[by:by + bh, bx:bx + bw] = frame[by:by + bh, bx:bx + bw] * (1 - a) + small * a
                continue
            if x and fi - s.f0 < x * FPS:
                a = ease((fi - s.f0) / (x * FPS))
                frame = frame * (1 - a) + img * a
            else:
                frame = img.copy() if isinstance(img, np.ndarray) else img
        prev_base = frame.copy() if isinstance(frame, np.ndarray) and not any(s.d.get('box') for s in active) else prev_base
        for s in segs:   # 終わったカットの読み手を閉じる
            if s.reader and fi >= s.f0 + s.n:
                s.close()
        # 帯（レターボックス）
        bh = int(round(lerp_keys(bars, t))) if bars else 0
        if bh > 0:
            frame[:bh] = 0
            frame[H - bh:] = 0
        # 暗転（dip: (中心の秒, 幅の秒)）
        for c, wdt in dips:
            if abs(t - c) < wdt / 2:
                k = 1 - abs(t - c) / (wdt / 2)
                frame *= (1 - ease(k))
        for it in items:
            it.draw(frame, t)
        # 光のフラッシュ（(ピークの秒, 入り, 抜け, 強さ)）
        for fl in flashes:
            c, a_in, a_out, kmax = fl[:4]
            if c - a_in <= t <= c + a_out:
                k = (t - (c - a_in)) / a_in if t < c else 1 - (t - c) / a_out
                k = ease(k) * kmax
                col = np.array(fl[4] if len(fl) > 4 else (1.0, 0.97, 0.9), np.float32)
                frame = frame * (1 - k) + col * k
        out8 = (np.clip(frame, 0, 1) * 255 + 0.5).astype(np.uint8)
        if fi in still_frames and stills_dir:
            Image.fromarray(out8).save(os.path.join(stills_dir, 'still_%07.2f.jpg' % t), quality=90)
        if enc:
            enc.stdin.write(out8.tobytes())
        if fi % 600 == 0:
            print('[compose] %.1f / %.1f s' % (t, total), flush=True)
    for s in segs:
        s.close()
    if enc:
        enc.stdin.close()
        enc.wait()


if __name__ == '__main__':
    a = sys.argv[1:]
    edit, clips, out = a[0], a[1], a[2] if len(a) > 2 and not a[2].startswith('--') else None
    tf = tt = None
    stills, sdir = None, None
    for i, v in enumerate(a):
        if v == '--from':
            tf = float(a[i + 1])
        if v == '--to':
            tt = float(a[i + 1])
        if v == '--stills':
            sdir = a[i + 1]
            stills = [float(x) for x in a[i + 2].split(',')]
    if out == '-':
        out = None
    render(edit, clips, out, tf, tt, stills, sdir)
