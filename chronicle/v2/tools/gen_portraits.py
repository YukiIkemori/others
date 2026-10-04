#!/usr/bin/env python3
"""会話の窓の顔絵（胸から上の描いた一枚絵）を画像生成の API で描き、ゲームの絵にする（numpy・PIL・stdlib）。

オーナーの決定（2026-10-04）で、会話の窓の顔は描いた一枚絵にする（前の BRIEF A38 を置き換え）。
指示文は chronicle/design/portraits/prompts.json の painted（共通の描き方・人ごとの見た目・表情）。
  1. gen       1 枚ずつ描く（並べて投げない）。原画は chronicle/design/art_ref/gen/portraits/raw/<look>_<expr>.webp（可逆。付随の情報なし）
               参考の画像: その人の原画のシートの表情（v2/assets/sprites/<look>/face.png を拡大）。
               表情（neutral 以外）は、その人の描いた neutral を「同じ絵の表情だけ変える」参考に付ける（同じ顔を保つ）。
               --style <look> で、ほかの人の描いた neutral を「描き方だけ」の参考に付ける（人ごとの絵柄をそろえる）。
  2. process   原画（neutral だけ）→ assets/portraits/<look>_neutral.webp（512×512、非可逆 WebP。manifest の frame で切り出し。ビルドが dist/portraits に写す）
               描いた顔は一人 1 枚（オーナー 2026-10-04）。ほかの表情の原画（試しのベルナ）は raw に残すが入れない
  3. sheet     描いた顔の一覧の画像（確かめ用。--out に書く）

  python3 v2/tools/gen_portraits.py gen <look> <expr> [--style <look>] [--note "<足す文>"] [--force]
  python3 v2/tools/gen_portraits.py process [<look>_<expr> ...]
  python3 v2/tools/gen_portraits.py sheet --out <file.jpg>
  python3 v2/tools/gen_portraits.py prompt <look> <expr> [--style <look>]      （文を見るだけ。API を呼ばない）

アカウントの設定は環境変数だけから読む（持ち主の env ファイルをシェルで source してから。ここには書かない・表示しない）:
  OPENAI_API_KEY, OPENAI_MODEL
使った回数の記録はリポジトリの外: OPENAI_USAGE_LOG（無ければ /tmp/claude-0/secrets/openai_usage.jsonl）、kind 'portrait'。
原画の横の <id>.gen.json には文と設定だけを書く（使ったモデルの名前は書かない）。
ゲームに入れるのは manifest.json の status が approved の人（build.js）。
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

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.abspath(os.path.join(HERE, '..'))
CHRONICLE = os.path.abspath(os.path.join(V2, '..'))
PROMPTS = os.path.join(CHRONICLE, 'design', 'portraits', 'prompts.json')
MANIFEST = os.path.join(CHRONICLE, 'design', 'portraits', 'manifest.json')
RAW = os.path.join(CHRONICLE, 'design', 'art_ref', 'gen', 'portraits', 'raw')
OUT = os.path.join(CHRONICLE, 'assets', 'portraits')
SPRITES = os.path.join(V2, 'assets', 'sprites')
URL = 'https://api.openai.com/v1/responses'
LOG = os.environ.get('OPENAI_USAGE_LOG') or '/tmp/claude-0/secrets/openai_usage.jsonl'
EXPRS = ['neutral', 'smile', 'sad', 'angry', 'surprise']
SIZE = 512          # ゲームの絵の一辺（会話の窓の顔の枠は 4K で 472 px）
NAVY = (20, 26, 44)

sys.path.insert(0, os.path.join(CHRONICLE, 'design', 'sprite_pipe', 'tools'))
from pngclean import strip_png   # noqa: E402  IHDR/PLTE/IDAT/IEND/tRNS/gAMA/sRGB/iCCP/pHYs だけ残す


def prompts():
    return json.load(open(PROMPTS, encoding='utf-8'))['painted']


# ---------------------------------------------------------------- 参考の画像
def pixel_ref(look, expr):
    """原画のシートの表情のコマ → 8 倍に拡大（ぼかさない）して紺の地に置いた PNG のバイト列"""
    j = json.load(open(os.path.join(SPRITES, look, 'face.json'), encoding='utf-8'))
    sheet = Image.open(os.path.join(SPRITES, look, 'face.png')).convert('RGBA')
    fr = j['frames'][(j.get('expr') or {}).get(expr, 0)]
    c = sheet.crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h']))
    k = 8
    bg = Image.new('RGBA', (c.width * k + 64, c.height * k + 64), NAVY + (255,))
    bg.alpha_composite(c.resize((c.width * k, c.height * k), Image.NEAREST), (32, 32))
    b = io.BytesIO()
    bg.convert('RGB').save(b, 'PNG')
    return b.getvalue()


def painted_ref(look, expr):
    p = os.path.join(RAW, f'{look}_{expr}.webp')
    if not os.path.exists(p):
        sys.exit(f'no painted {look}_{expr} yet (draw it first)')
    b = io.BytesIO()
    Image.open(p).convert('RGB').save(b, 'PNG')
    return b.getvalue()


def job_of(look, expr, style=None, note=None):
    """→ (文, [(名前, PNG バイト列)])"""
    P = prompts()
    if look not in P['looks']:
        sys.exit(f'no painted.looks.{look} in prompts.json')
    s = [P['style'], 'Character: ' + P['looks'][look], P['exprs'][expr]]
    refs = []
    if expr != 'neutral':
        s.append('Reference image 1: ' + P['exprRef'])
        refs.append((f'painted:{look}_neutral', painted_ref(look, 'neutral')))
        s.append('Reference image 2: the pixel-art face of the same character with this expression (use it only for the expression and identity). ' + P['identity'])
        refs.append((f'pixel:{look}_{expr}', pixel_ref(look, expr)))
    elif look in P.get('variants', {}):   # 主人公のタイプ違い: 同じ人の描いた顔（剣士）から服と道具だけ変える
        base = P['variants'][look]
        s.append('Reference image 1: ' + P['variantRef'])
        refs.append((f'painted:{base}_neutral', painted_ref(base, 'neutral')))
        s.append('Reference image 2: the pixel-art face of the same hero (identity only). ' + P['identity'])
        refs.append((f'pixel:{base}_{expr}', pixel_ref(base, expr)))
    else:
        s.append('Reference image 1: ' + P['identity'])
        refs.append((f'pixel:{look}_{expr}', pixel_ref(look, expr)))
        if style:
            s.append('Reference image 2: ' + P['styleRef'])
            refs.append((f'painted:{style}_neutral', painted_ref(style, 'neutral')))
    if note:
        s.append(note)
    return ' '.join(s), refs


# ---------------------------------------------------------------- 1. 描く
def model():
    m = os.environ.get('OPENAI_MODEL', '').strip()
    if not m:
        sys.exit('OPENAI_MODEL not set')
    if 'astra' in m.lower():
        sys.exit('forbidden model family')
    return m


def log(e):
    e['kind'] = 'portrait'
    try:
        with open(LOG, 'a') as f:
            f.write(json.dumps(e, ensure_ascii=False) + '\n')
    except OSError:
        pass


def gen(look, expr, style=None, note=None, force=False):
    os.makedirs(RAW, exist_ok=True)
    out = os.path.join(RAW, f'{look}_{expr}.webp')
    if os.path.exists(out) and not force:
        print('skip (exists)', out)
        return True
    key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not key:
        sys.exit('OPENAI_API_KEY not set')
    prompt, refs = job_of(look, expr, style, note)
    tool = {'type': 'image_generation', 'size': '1024x1024', 'quality': 'high', 'background': 'opaque'}
    content = [{'type': 'input_text', 'text': prompt}]
    for _, png in refs:
        content.append({'type': 'input_image', 'image_url': 'data:image/png;base64,' + base64.b64encode(png).decode()})
    body = {'model': model(), 'input': [{'role': 'user', 'content': content}], 'tools': [tool], 'tool_choice': {'type': 'image_generation'}}
    data = json.dumps(body).encode()
    tag = f'portrait_{look}_{expr}'
    for attempt in range(6):
        t0 = time.time()
        req = urllib.request.Request(URL, data=data, method='POST', headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                js = json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:400]
            log(dict(t=time.strftime('%Y-%m-%dT%H:%M:%S'), tag=tag, images=0, error='HTTP %d: %s' % (e.code, msg), settings=tool))
            if e.code == 429 or e.code >= 500:
                w = min(240, 15 * 2 ** attempt) * (0.7 + 0.6 * random.random())
                print('HTTP', e.code, 'backoff', int(w)); time.sleep(w); continue
            print('FAIL', e.code, msg[:300]); return False
        except Exception as e:   # 回線の切れ
            print('net err', type(e).__name__, str(e)[:160]); time.sleep(20 * (attempt + 1)); continue
        outs = [o for o in js.get('output', []) if o.get('type') == 'image_generation_call' and o.get('result')]
        log(dict(t=time.strftime('%Y-%m-%dT%H:%M:%S'), tag=tag, model=body['model'], images=len(outs), secs=round(time.time() - t0, 1),
                 settings=tool, n_refs=len(refs), usage=js.get('usage')))
        if not outs:
            print('no image', [o.get('type') for o in js.get('output', [])]); time.sleep(5); continue
        png = strip_png(base64.b64decode(outs[0]['result']))
        im = Image.open(io.BytesIO(png)).convert('RGB')
        # 原画は可逆の WebP（付随の情報は書かない。PIL は exif・xmp を渡さなければ書かない）
        im.save(out, 'WEBP', lossless=True, quality=100, method=4)
        meta = {'id': f'{look}_{expr}', 'size': tool['size'], 'quality': tool['quality'], 'prompt': prompt, 'refs': [n for n, _ in refs],
                'revised_prompt': outs[0].get('revised_prompt'), 'secs': round(time.time() - t0, 1)}
        json.dump(meta, open(os.path.join(RAW, f'{look}_{expr}.gen.json'), 'w'), ensure_ascii=False, indent=1)
        print('ok', out, im.size, round(time.time() - t0, 1), 's')
        return True
    return False


# ---------------------------------------------------------------- 2. ゲームの絵にする（決まった手順）
def frames():
    """manifest.json の frame: [x, y, size]（原画の一辺に対する割合の正方形。頭の大きさを人どうしでそろえる）"""
    try:
        return {m['look']: m['frame'] for m in json.load(open(MANIFEST, encoding='utf-8')) if m.get('frame')}
    except (OSError, ValueError):
        return {}


def process(ids=None):
    """一人 neutral 1 枚だけをゲームの絵にする（オーナー 2026-10-04。ほかの表情の原画は raw に残すが入れない）"""
    os.makedirs(OUT, exist_ok=True)
    fr = frames()
    names = sorted(f[:-5] for f in os.listdir(RAW) if f.endswith('_neutral.webp')) if os.path.isdir(RAW) else []
    for n in names:
        if ids and n not in ids and n[:-8] not in ids:
            continue
        im = Image.open(os.path.join(RAW, n + '.webp')).convert('RGB')
        w, h = im.size
        x, y, sz = fr.get(n[:-8], [0, 0, 1])
        box = [round(x * w), round(y * h), round((x + sz) * w), round((y + sz) * h)]
        if box[0] < 0 or box[1] < 0 or box[2] > w or box[3] > h:   # はみ出す分は地の紺で埋める
            bg = Image.new('RGB', (box[2] - box[0], box[3] - box[1]), im.getpixel((4, 4)))
            bg.paste(im, (-box[0], -box[1]))
            im = bg
        else:
            im = im.crop(box)
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
        p = os.path.join(OUT, n + '.webp')
        im.save(p, 'WEBP', quality=86, method=6)
        print('ok', os.path.relpath(p, CHRONICLE), os.path.getsize(p), 'bytes')


# ---------------------------------------------------------------- 3. 一覧の画像
def sheet(out, cols=8):
    """描いた顔（neutral）の一覧。ゲームの枠の切り出しに近い見え方（上を合わせて少し寄る）も下に添える"""
    man = json.load(open(MANIFEST, encoding='utf-8'))
    rows = [m for m in man if os.path.exists(os.path.join(OUT, f"{m['look']}_neutral.webp"))]
    cw, lab = 200, 22
    n = len(rows)
    W, H = cols * (cw + 8) + 8, ((n + cols - 1) // cols) * (cw + lab + 8) + 8
    sh = Image.new('RGB', (W, H), (12, 14, 22))
    d = ImageDraw.Draw(sh)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
    except OSError:
        font = ImageFont.load_default()
    for i, m in enumerate(rows):
        x, y = 8 + (i % cols) * (cw + 8), 8 + (i // cols) * (cw + lab + 8)
        d.text((x, y), m['look'], fill=(200, 200, 210), font=font)
        sh.paste(Image.open(os.path.join(OUT, f"{m['look']}_neutral.webp")).convert('RGB').resize((cw, cw), Image.LANCZOS), (x, y + lab))
    sh.save(out, quality=90)
    print('sheet →', out, sh.size, n, 'portraits')


def opt(argv, name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


if __name__ == '__main__':
    a = sys.argv[1:]
    cmd = a[0] if a else ''
    if cmd in ('gen', 'prompt'):
        look, expr = a[1], a[2]
        if expr not in EXPRS:
            sys.exit('expr must be one of ' + ' '.join(EXPRS))
        if cmd == 'prompt':
            p, refs = job_of(look, expr, opt(a, '--style'), opt(a, '--note'))
            print(p, '\nrefs:', [n for n, _ in refs])
        else:
            sys.exit(0 if gen(look, expr, opt(a, '--style'), opt(a, '--note'), '--force' in a) else 1)
    elif cmd == 'process':
        process([x for x in a[1:] if not x.startswith('--')] or None)
    elif cmd == 'sheet':
        sheet(opt(a, '--out') or sys.exit('--out <file.jpg>'))
    else:
        print(__doc__)
