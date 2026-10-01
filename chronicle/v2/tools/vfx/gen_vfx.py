#!/usr/bin/env python3
"""戦闘の効果の部品（assets/fx/<id>.webp ＋ <id>.json）を、画像生成の API で描いて切り出す（numpy・PIL・stdlib）。

部品の表は tools/vfx/vfx_parts.json（id ごとに 描き方の文・コマの並び・切り出しの値）。
  1. gen       描く（1 枚ずつ順に。並べて投げない）。原画は chronicle/design/art_ref/gen/vfx/raw/<id>.webp（可逆。付随チャンク無し）
  2. process   原画 → コマの帯（決まった手順。同じ原画からは同じ帯）: assets/fx/<id>.webp（非可逆 WebP・α つき）と <id>.json（meta）
  3. sheet     全部の部品の見本（確かめ用。--out に書く）

  python3 tools/vfx/gen_vfx.py gen <id> [<id> ...] [--force]
  python3 tools/vfx/gen_vfx.py process [<id> ...]          （id を省くと全部）
  python3 tools/vfx/gen_vfx.py sheet --out <file.jpg> [<id> ...]
  python3 tools/vfx/gen_vfx.py list

アカウントの設定は環境変数だけから読む（持ち主の env ファイルをシェルで source してから。ここには書かない・表示しない）:
  OPENAI_API_KEY, OPENAI_MODEL
使った回数の記録はリポジトリの外: OPENAI_USAGE_LOG（無ければ /tmp/claude-0/secrets/openai_usage.jsonl）、kind 'vfx'。
原画の横の <id>.gen.json には文と設定だけを書く（使ったモデルの名前は書かない）。

切り出しの決まり（vfx_parts.json の各部品の値）:
  grid [cols, rows]   原画を等分したマス。左上から右へ、行の順にコマ
  n                   使うコマの数（マスの数以下）
  bg 'black' | 'key' | 'clear'  black = 黒地に光る物（明るさ → α。加算で描く。blend 'source-over' なら煙のようにふつうに重ねる）。
                      key = マゼンタの地を抜く（岩・葉など不透明な物）。clear = 透明の地（使えるモデルの時だけ）
  tint true           白黒で描いた物（明るさだけを残す。実行時に技・術の色の 3 色に塗り分ける）
  out [w, h]          1 コマの大きさ（px。戦闘の論理 1 px = 2 px で見る）
  anchor 'center' | 'bottom' | 'left'   コマの中の基準の点（center = 真ん中、bottom = 下の真ん中、left = 左の真ん中）
  fit                 全部のコマを合わせた外形が、基準から見てコマの何割に収まるか（既定 0.92）
  fps, loop, blend    実行時の再生（blend は既定 black → 'lighter'、clear → 'source-over'）
"""
import base64
import io
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.abspath(os.path.join(HERE, '..', '..'))
CHRONICLE = os.path.abspath(os.path.join(V2, '..'))
PARTS = os.path.join(HERE, 'vfx_parts.json')
RAW = os.path.join(CHRONICLE, 'design', 'art_ref', 'gen', 'vfx', 'raw')
OUT = os.path.join(V2, 'assets', 'fx')
URL = 'https://api.openai.com/v1/responses'
LOG = os.environ.get('OPENAI_USAGE_LOG') or '/tmp/claude-0/secrets/openai_usage.jsonl'

sys.path.insert(0, os.path.join(CHRONICLE, 'design', 'sprite_pipe', 'tools'))
from pngclean import strip_png   # noqa: E402  IHDR/PLTE/IDAT/IEND/tRNS/gAMA/sRGB/iCCP/pHYs だけ残す


def load_parts():
    d = json.load(open(PARTS, encoding='utf-8'))
    return d['style'], {p['id']: p for p in d['parts']}


# ---------------------------------------------------------------- 描く文
def prompt_of(style, p):
    cols, rows = p['grid']
    n = p['n']
    s = [style['look']]
    if cols * rows == 1:
        s.append('A single isolated game effect element, centred in the image with a wide empty margin on every side; it must not touch the image edges.')
    else:
        cell = 'square' if p.get('cell', 'square') == 'square' else p['cell']
        s.append(f'A sprite sheet of exactly {n} animation frames of the SAME effect, laid out as a grid of {cols} columns x {rows} rows '
                 f'of equal {cell} cells, read left to right, then top to bottom. Frame 1 is the start; each next frame advances the '
                 f'animation{"; the last frame flows back into frame 1 (seamless loop)" if p.get("loop") else "; the last frame is the faint fading end"}. '
                 'Every frame sits centred in its own cell, fully inside it with a clear empty margin; nothing crosses into a neighbouring cell. '
                 'Same design, scale, palette and lighting in every frame; only the motion progresses.')
    s.append(p['prompt'])
    if p.get('tint'):
        s.append(style['mono'])
    s.append({'black': style['black'], 'clear': style['clear'], 'key': style.get('key', '')}[p.get('bg', 'black')])
    s.append(style['neg'])
    return ' '.join(s)


# ---------------------------------------------------------------- 1. 描く
def model():
    m = os.environ.get('OPENAI_MODEL', '').strip()
    if not m:
        sys.exit('OPENAI_MODEL not set')
    if 'astra' in m.lower():
        sys.exit('forbidden model family')
    return m


def log(e):
    e['kind'] = 'vfx'
    try:
        with open(LOG, 'a') as f:
            f.write(json.dumps(e, ensure_ascii=False) + '\n')
    except OSError:
        pass


def gen(style, p, force=False):
    os.makedirs(RAW, exist_ok=True)
    out = os.path.join(RAW, p['id'] + '.webp')
    if os.path.exists(out) and not force:
        print('skip (exists)', out)
        return True
    key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not key:
        sys.exit('OPENAI_API_KEY not set')
    prompt = prompt_of(style, p)
    tool = {'type': 'image_generation', 'size': p['size'], 'quality': p.get('quality', 'high'),
            'background': 'transparent' if p.get('bg') == 'clear' else 'opaque'}   # 透明の地は使えないモデルがある → 'key'（マゼンタの地を抜く）
    body = {'model': model(), 'input': [{'role': 'user', 'content': [{'type': 'input_text', 'text': prompt}]}],
            'tools': [tool], 'tool_choice': {'type': 'image_generation'}}
    data = json.dumps(body).encode()
    for attempt in range(6):
        t0 = time.time()
        req = urllib.request.Request(URL, data=data, method='POST', headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                js = json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:400]
            log(dict(t=time.strftime('%Y-%m-%dT%H:%M:%S'), tag='vfx_' + p['id'], images=0, error='HTTP %d: %s' % (e.code, msg), settings=tool))
            if e.code == 429 or e.code >= 500:
                w = min(240, 15 * 2 ** attempt) * (0.7 + 0.6 * random.random())
                print('HTTP', e.code, 'backoff', int(w)); time.sleep(w); continue
            print('FAIL', e.code, msg[:300]); return False
        except Exception as e:   # 回線の切れ
            print('net err', type(e).__name__, str(e)[:160]); time.sleep(20 * (attempt + 1)); continue
        outs = [o for o in js.get('output', []) if o.get('type') == 'image_generation_call' and o.get('result')]
        log(dict(t=time.strftime('%Y-%m-%dT%H:%M:%S'), tag='vfx_' + p['id'], model=body['model'], images=len(outs), secs=round(time.time() - t0, 1),
                 settings=tool, usage=js.get('usage')))
        if not outs:
            print('no image', [o.get('type') for o in js.get('output', [])]); time.sleep(5); continue
        png = strip_png(base64.b64decode(outs[0]['result']))
        im = Image.open(io.BytesIO(png)).convert('RGBA')
        # 原画は可逆の WebP（付随の情報は書かない。PIL は exif・xmp を渡さなければ書かない）
        im.save(out, 'WEBP', lossless=True, exact=True, quality=100, method=4)
        meta = {'id': p['id'], 'size': p['size'], 'quality': tool['quality'], 'background': tool['background'], 'prompt': prompt,
                'revised_prompt': outs[0].get('revised_prompt'), 'secs': round(time.time() - t0, 1)}
        json.dump(meta, open(os.path.join(RAW, p['id'] + '.gen.json'), 'w'), ensure_ascii=False, indent=1)
        print('ok', out, im.size, round(time.time() - t0, 1), 's')
        return True
    return False


# ---------------------------------------------------------------- 2. 切り出す（決まった手順）
def lum(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def cell_alpha(c, p):
    """マス（float RGBA 0..255）→ (rgb, a 0..1)。black: 明るさから α、clear: そのまま（地が残っていれば縁の色で抜く）"""
    rgb = c[..., :3]
    if p.get('bg', 'black') == 'black':
        b0 = p.get('black_level', 14.0)
        m = rgb.max(2)
        a = np.clip((m - b0) / (255.0 - b0), 0, 1)
        # 光の物は芯ほど濃い: 弱い光をやや残す（γ）
        a = a ** p.get('alpha_gamma', 0.9)
        un = rgb / np.maximum(m[..., None], 1e-3) * 255.0
        un = np.clip(un, 0, 255)
        return un, a
    if p.get('bg') == 'key':
        # マゼンタの地を抜く: 地の色（縁の中央値）からの色の差 → α、縁に残ったマゼンタの混ざりを落とす（despill）
        edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        bg = np.median(edge, 0)
        d = np.sqrt(((rgb - bg) ** 2).sum(2))
        a = np.clip((d - 60) / 90, 0, 1)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        spill = np.clip(np.minimum(r, b) - g, 0, None)          # マゼンタ = 赤と青が緑より強い分
        out = rgb.copy()
        out[..., 0] = r - spill * (1 - a) * 0.9 - spill * 0.35
        out[..., 2] = b - spill * (1 - a) * 0.9 - spill * 0.35
        from scipy import ndimage
        a = ndimage.grey_erosion(a, size=(2, 2)) * 0.5 + a * 0.5   # 縁を 1 px 締める
        a = np.where(a < 0.06, 0, a)
        return np.clip(out, 0, 255), a
    a = c[..., 3] / 255.0
    if a.min() > 0.98:
        # 透明の地にならなかった: 縁の色（中央値）からの色の差で抜く
        h, w = a.shape
        edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        bg = np.median(edge, 0)
        d = np.sqrt(((rgb - bg) ** 2).sum(2))
        a = np.clip((d - 30) / 50, 0, 1)
    a = np.where(a < 0.04, 0, a)
    return rgb, a


def edge_fade(h, w, frac):
    """マスの縁で α を 0 へ（隣のマスのはみ出し・格子の線を消す）"""
    m = max(2, int(min(h, w) * frac))
    y = np.minimum(np.arange(h), np.arange(h)[::-1]).astype(np.float32)
    x = np.minimum(np.arange(w), np.arange(w)[::-1]).astype(np.float32)
    fy = np.clip((y - m * 0.3) / m, 0, 1)
    fx = np.clip((x - m * 0.3) / m, 0, 1)
    return np.outer(fy, fx)


def resize_premul(rgb, a, w, h):
    pre = np.dstack([rgb * a[..., None], a * 255.0]).astype(np.float32)
    chans = [np.asarray(Image.fromarray(pre[..., i], 'F').resize((w, h), Image.LANCZOS)) for i in range(4)]
    out = np.stack(chans, -1)
    al = np.clip(out[..., 3], 0, 255)
    col = out[..., :3] / np.maximum(al[..., None] / 255.0, 1e-3)
    return np.clip(col, 0, 255), al / 255.0


def process(style, p):
    raw = os.path.join(RAW, p['id'] + '.webp')
    if not os.path.exists(raw):
        print('no raw', p['id']); return None
    im = np.asarray(Image.open(raw).convert('RGBA')).astype(np.float32)
    H, W = im.shape[:2]
    cols, rows = p['grid']
    n = p['n']
    order = p.get('order') or list(range(n))
    cw, ch = W / cols, H / rows
    cells = []
    for k in order:
        r, c = divmod(k, cols)
        x0, y0, x1, y1 = int(round(c * cw)), int(round(r * ch)), int(round((c + 1) * cw)), int(round((r + 1) * ch))
        rgb, a = cell_alpha(im[y0:y1, x0:x1], p)
        a = a * edge_fade(a.shape[0], a.shape[1], p.get('edge', 0.045 if cols * rows > 1 else 0.015))
        a = np.where(a < p.get('alpha_floor', 0.02), 0, a)
        cells.append((rgb, a))
    # 全部のコマで同じずらし（コマごとに合わせるとがたつく）: 基準の点 = 重心の平均（anchor で軸を決める）
    mh = min(c[1].shape[0] for c in cells); mw = min(c[1].shape[1] for c in cells)
    cells = [(rgb[:mh, :mw], a[:mh, :mw]) for rgb, a in cells]
    acc = sum(a for _, a in cells)
    ys, xs = np.nonzero(acc > 0.02 * acc.max())
    if not len(xs):
        print('empty', p['id']); return None
    wsum = acc[ys, xs]
    cx = float((xs * wsum).sum() / wsum.sum()); cy = float((ys * wsum).sum() / wsum.sum())
    anchor = p.get('anchor', 'center')
    if anchor == 'bottom':
        ay = float(ys.max()); ax = cx
    elif anchor == 'left':
        ax = float(xs.min()); ay = cy
    else:
        ax, ay = cx, cy
    if p.get('anchor_cell'):   # マスの真ん中を基準に（動く物: 飛んでいく・広がる中心が決まっている物）
        ax, ay = mw / 2.0, (mh / 2.0 if anchor != 'bottom' else ay)
    # 外形（基準から見た広がり）→ 縮める割合
    ow, oh = p['out']
    fit = p.get('fit', 0.92)
    ex_l = ax - xs.min(); ex_r = xs.max() - ax; ex_t = ay - ys.min(); ex_b = ys.max() - ay
    tx = {'center': ow / 2.0, 'bottom': ow / 2.0, 'left': ow * 0.04}[anchor]
    ty = {'center': oh / 2.0, 'bottom': oh * 0.96, 'left': oh / 2.0}[anchor]
    sx = min(tx / max(ex_l, 1), (ow - tx) / max(ex_r, 1))
    sy = min(ty / max(ex_t, 1), (oh - ty) / max(ex_b, 1))
    s = min(sx, sy) * fit
    frames = []
    for rgb, a in cells:
        # 拡大・縮小してから置く（PIL の affine で一度に: 出力の点 → 原画の点）
        nw, nh = max(1, int(round(mw * s))), max(1, int(round(mh * s)))
        col, al = resize_premul(rgb, a, nw, nh)
        canvas = np.zeros((oh, ow, 4), np.float32)
        ox = int(round(tx - ax * s)); oy = int(round(ty - ay * s))
        sx0, sy0 = max(0, -ox), max(0, -oy)
        dx0, dy0 = max(0, ox), max(0, oy)
        cw2 = min(nw - sx0, ow - dx0); ch2 = min(nh - sy0, oh - dy0)
        if cw2 > 0 and ch2 > 0:
            canvas[dy0:dy0 + ch2, dx0:dx0 + cw2, :3] = col[sy0:sy0 + ch2, sx0:sx0 + cw2]
            canvas[dy0:dy0 + ch2, dx0:dx0 + cw2, 3] = al[sy0:sy0 + ch2, sx0:sx0 + cw2] * 255.0
        if p.get('tint'):
            # 白黒の部品: 明るさだけ（実行時に 3 色に塗り分ける）。光の物は α に明るさが入っているので、色は芯の白さ
            L = lum(canvas[..., :3])
            canvas[..., :3] = L[..., None]
        frames.append(canvas)
    # 時間の整え: 原画のコマが少ない時は間を足さない（そのまま）。強さの正規化: 一番明るいコマの α の最大を 1 に
    amax = max(f[..., 3].max() for f in frames)
    if amax > 0 and p.get('bg', 'black') == 'black' and not p.get('blend'):
        k = 255.0 / amax
        for f in frames:
            f[..., 3] = np.clip(f[..., 3] * k, 0, 255)
    strip = np.concatenate(frames, 1)
    strip[..., 3] = np.where(strip[..., 3] < 2, 0, strip[..., 3])
    strip[strip[..., 3] == 0, :3] = 0
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, p['id'] + '.webp')
    Image.fromarray(np.clip(np.rint(strip), 0, 255).astype(np.uint8), 'RGBA').save(dst, 'WEBP', quality=p.get('q', 86), alpha_quality=90, method=6)
    # 山（一番濃いコマ）: 実行時は山まで速く進めて、山を保ってから消す（fx_seq_img.js の DEFSEG）
    energy = [float((f[..., 3] / 255.0 * (lum(f[..., :3]) / 255.0 + 0.3)).sum()) for f in frames]
    peak = int(np.argmax(energy)) if p.get('peak') is None else int(p['peak'])
    meta = {'n': len(frames), 'peak': peak, 'w': ow, 'h': oh, 'fps': p.get('fps', 24), 'loop': bool(p.get('loop')), 'tint': bool(p.get('tint')),
            'blend': p.get('blend') or ('lighter' if p.get('bg', 'black') == 'black' else 'source-over'),
            'anchor': [round(tx, 1), round(ty, 1)], 'scale': p.get('scale', 0.5), 'group': p.get('group', '')}
    json.dump(meta, open(os.path.join(OUT, p['id'] + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('->', dst, f'{len(frames)}x{ow}x{oh}', os.path.getsize(dst) // 1024, 'KB')
    return dst


# ---------------------------------------------------------------- 3. 見本
def sheet(ids, out):
    rows = []
    for i in ids:
        f = os.path.join(OUT, i + '.webp')
        if not os.path.exists(f):
            continue
        meta = json.load(open(os.path.join(OUT, i + '.json')))
        im = Image.open(f).convert('RGBA')
        h = 128
        im = im.resize((max(1, int(im.width * h / im.height)), h), Image.LANCZOS)
        bg = Image.new('RGBA', im.size, (24, 26, 40, 255))
        if meta.get('tint'):
            # 見本は既定の色（水色）で塗る
            a = np.asarray(im).astype(np.float32)
            L = a[..., 0:1] / 255.0
            col = np.clip(np.array([60, 120, 255]) * (1 - L) * 2 * (L < 0.5) + (L >= 0.5) * (np.array([120, 200, 255]) + (np.array([255, 255, 255]) - np.array([120, 200, 255])) * (L - 0.5) * 2), 0, 255)
            a[..., :3] = col
            im = Image.fromarray(a.astype(np.uint8), 'RGBA')
        if meta['blend'] == 'lighter':
            b = np.asarray(bg).astype(np.float32); a = np.asarray(im).astype(np.float32)
            b[..., :3] = np.clip(b[..., :3] + a[..., :3] * a[..., 3:4] / 255.0, 0, 255)
            bg = Image.fromarray(b.astype(np.uint8), 'RGBA')
        else:
            bg.alpha_composite(im)
        rows.append((i, bg))
    if not rows:
        return
    W = min(4096, max(r[1].width for r in rows) + 160)
    H = sum(r[1].height + 6 for r in rows)
    S = Image.new('RGB', (W, H), (10, 10, 16))
    from PIL import ImageDraw
    d = ImageDraw.Draw(S)
    y = 0
    for i, im in rows:
        S.paste(im.convert('RGB').crop((0, 0, min(im.width, W - 160), im.height)), (160, y))
        d.text((6, y + 6), i, fill=(230, 230, 240))
        y += im.height + 6
    S.save(out, quality=88)
    print('sheet ->', out)


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__); return
    style, parts = load_parts()
    cmd, rest = a[0], [x for x in a[1:] if not x.startswith('--')]
    if cmd == 'list':
        for k, p in parts.items():
            raw = os.path.exists(os.path.join(RAW, k + '.webp'))
            print(f"{k:22s} {'raw' if raw else '---'} {p['grid']} n={p['n']} {p.get('bg', 'black')} {'tint' if p.get('tint') else ''}")
    elif cmd == 'gen':
        for k in rest:   # 1 枚ずつ順に
            if k not in parts:
                print('unknown', k); continue
            gen(style, parts[k], force='--force' in a)
    elif cmd == 'prompt':
        for k in rest:
            print(prompt_of(style, parts[k]))
    elif cmd == 'process':
        for k in (rest or list(parts)):
            if os.path.exists(os.path.join(RAW, k + '.webp')):
                process(style, parts[k])
    elif cmd == 'sheet':
        out = a[a.index('--out') + 1]
        rest = [k for k in rest if k != out]
        sheet(rest or list(parts), out)
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
