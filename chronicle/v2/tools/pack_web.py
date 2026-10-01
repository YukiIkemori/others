#!/usr/bin/env python3
"""v2 の公開用の写し（ファイルの数と大きさを、静的な置き場の決まりに収める）

  python3 v2/tools/pack_web.py [--dist v2/dist] --out <dir> [--page 2048] [--voice-pack-mb 2.5] [--scope demo|all] [--under-quality 94]

  --scope demo（既定）: 縦切りで閉じた地方（regions.js の slice: 'locked'）の env のテーマと戦闘背景を入れない
  --under-quality Q（既定 94）: 描いた下絵の本体（不透明）だけ非可逆の WebP（PSNR ≥ 30 dB を確かめる）。0 で可逆。層（_over・_emit・_closed）は可逆のまま

dist（node v2/tools/build.js の外置きの版）から、次の形の写しを作る:
  index.html               遊ぶ版（RPG_MEDIA をまとめた版に書き換える）
  bgm/<id>.ogg             BGM はそのまま（1 曲 1 ファイル）
  title/<id>.webp|png      タイトルの一枚絵はそのまま（webp。png は読めないときの代わり）
  env/<group>_NN.webp      地形・戦闘背景の画像を組ごとの地図帳にまとめる（WebP 可逆・exact。{url, rect, meta}）。
                           組 = 下絵はマップ 1 枚×マスの大きさ、戦闘背景は 1 つ、ほかはテーマ×マスの大きさ（env_group。使う時に組だけ読む）
  sprites/atlas_NN.webp    CAST の原画も同じ
  voice/pack_NN.ogg        ボイスは Ogg をつないだ（chained Ogg）ファイルにまとめる（{url, off, len}）
  publish_batches.json     ファイルと大きさの一覧と、1 回の公開（64 MB・255 本まで）ごとの組
切り出し・範囲の読み方は src/core/media.js（image() と bytes()）。
テスト用メニュー（src/tester/、?tester=1 と F9）は dist の index.html にあればそのまま入る（公開のテスト版用）。
製品版の写しには build.js --release で作った dist を使う（テスト用メニューが入らない）。
"""
import argparse
import hashlib
import json
import io
import os
import re
import shutil
import sys

from PIL import Image

SERVABLE = {'.html', '.css', '.js', '.json', '.png', '.jpg', '.webp', '.svg', '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.otf', '.txt'}
BATCH_BYTES = 64 * 1000 * 1000      # 64 MB（10 進で数えて余裕を持たせる）
BATCH_FILES = 255
MAX_TEXT = 16 * 1000 * 1000
MAX_BIN = 15 * 1000 * 1000
VERSION_FILES = 511
VERSION_BYTES = 256 * 1000 * 1000


def bare(url):
    """'sprites/x.png?v=abc' → 'sprites/x.png'（build.js の ?v=<hash> を外してファイルを読む）"""
    return url.split('?', 1)[0]


def hashed_name(path_rel, data):
    """'sprites/atlas_00.webp' → 'sprites/atlas_00.<sha1 10 字>.webp'（中身で名前を変える: 公開し直しても古いキャッシュの絵が出ない）"""
    h = hashlib.sha1(data).hexdigest()[:10]
    root, ext = os.path.splitext(path_rel)
    return f'{root}.{h}{ext}'


def shelf_pack(items, page):
    """items: [(key, w, h)] → pages: [[(key, x, y, w, h)]]（高さの順に棚へ並べる）"""
    items = sorted(items, key=lambda t: (-t[2], -t[1], t[0]))
    pages = []
    cur, x, y, shelf_h = [], 0, 0, 0
    for key, w, h in items:
        if w > page or h > page:
            raise SystemExit(f'{key}: {w}x{h} is larger than the atlas page {page}')
        if x + w > page:
            x, y, shelf_h = 0, y + shelf_h, 0
        if y + h > page:
            pages.append(cur)
            cur, x, y, shelf_h = [], 0, 0, 0
        cur.append((key, x, y, w, h))
        x += w
        shelf_h = max(shelf_h, h)
    if cur:
        pages.append(cur)
    return pages


MIN_PSNR = 30.0   # 細かい @24 の絵は q94 で 32 dB 前後（色の細部が少し鈍る。見た目はほぼ同じ）


def psnr(a, b):
    """8 bit RGB の 2 枚の PSNR（dB。間引いて数える）"""
    import math
    x, y = a.tobytes()[::31], b.tobytes()[::31]
    mse = sum((p - r) * (p - r) for p, r in zip(x, y)) / max(1, len(x))
    return 99.0 if mse == 0 else 10 * math.log10(255 * 255 / mse)


def under_lossy(quality):
    """下絵の本体（<theme>/under/<name>@<tile>、_over・_emit・_closed でない）で不透明な物だけを非可逆に（quality 0 = しない）"""
    def f(key, im):
        if not quality or '/under/' not in key or re.search(r'_(over|emit|closed)@\d+$', key):
            return None
        return quality if im.getextrema()[3][0] == 255 else None
    return f


def locked_themes(v2):
    """縦切りで閉じた地方（src/data/regions.js の slice: 'locked'）の short = env のテーマと戦闘背景の名前"""
    try:
        src = open(os.path.join(v2, 'src', 'data', 'regions.js'), encoding='utf-8').read()
    except OSError:
        return set()
    return {m.group(1) for line in src.splitlines() if "slice: 'locked'" in line for m in [re.search(r"short: '([a-z_]+)'", line)] if m}


def env_group(key):
    """env の画像の組（1 つの組 = 1 つ以上の地図帳のファイル。組ごとに別々に読める）
    下絵（<theme>/under/<name>[_over|_emit|_closed]@<tile>）: マップ 1 枚・マスの大きさ 1 つごと（入るときにその組だけ読む）
    戦闘背景（bbg/<id>/<layer>）: 背景 1 つごと（使う時に読む）
    ほか（素材・物・建物）: テーマとマスの大きさごと（起動では今のマスの大きさの分だけ読む）"""
    parts = key.split('/')
    if parts[0] == 'bbg':
        return 'bbg_' + parts[1]
    m = re.match(r'^(.*?)(?:_(?:over|emit|closed))?@(\d+)$', parts[-1])
    if len(parts) >= 3 and parts[1] == 'under' and m:
        return f'u_{parts[0]}_{m.group(1)}_{m.group(2)}'
    t = re.search(r'@(\d+)$', key)
    return f'{parts[0]}_{t.group(1) if t else "x"}'


def lossy_ok(im, q):
    """その画像だけを q の非可逆 WebP にして PSNR が MIN_PSNR 以上か（細かい絵は可逆のまま地図帳に入れる）"""
    buf = io.BytesIO()
    im.convert('RGB').save(buf, 'WEBP', quality=q, method=6)
    buf.seek(0)
    b = Image.open(buf)
    b.load()
    return psnr(im.convert('RGB'), b.convert('RGB')) >= MIN_PSNR


def pack_images(kind, table, dist, out, page, group=None, lossy=None):
    """table: {id: {url, meta}} → 新しい table（{url, rect, meta}）。group(key) を渡すと組ごとに別の地図帳（名前に組の名前）。
    lossy(key, im) → quality | None: その画像を非可逆の WebP の地図帳に入れる（組の名前に _q。切り出しは PSNR で確かめる）"""
    os.makedirs(os.path.join(out, kind), exist_ok=True)
    imgs = {}
    for k, e in table.items():
        im = Image.open(os.path.join(dist, bare(e['url'])))
        im.load()
        imgs[k] = im.convert('RGBA')
    groups, gq = {}, {}
    for k in imgs:
        q = lossy(k, imgs[k]) if lossy else None
        if q and not lossy_ok(imgs[k], q):
            print(f'[pack_web] {kind} {k}: lossy q{q} below {MIN_PSNR} dB, kept lossless')
            q = None
        g = (group(k) if group else 'atlas') + ('_q' if q else '')
        groups.setdefault(g, []).append(k)
        if q:
            gq[g] = q
    new, sheets = {}, []
    for gname in sorted(groups):
        ks = groups[gname]
        q = gq.get(gname)
        pg_size = max([page] + [max(imgs[k].width, imgs[k].height) for k in ks])
        pages = shelf_pack([(k, imgs[k].width, imgs[k].height) for k in ks], pg_size)
        for i, pg in enumerate(pages):
            pw = max(x + w for _, x, _, w, _ in pg)
            ph = max(y + h for _, _, y, _, h in pg)
            sheet = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
            for k, x, y, w, h in pg:
                sheet.paste(imgs[k], (x, y))
            base = f'{kind}/{gname}_{i:02d}.webp' if group else f'{kind}/atlas_{len(sheets):02d}.webp'
            tmp = os.path.join(out, base + '.tmp')
            if q:
                sheet.convert('RGB').save(tmp, 'WEBP', quality=q, method=6)
            else:
                sheet.save(tmp, 'WEBP', lossless=True, exact=True, quality=100, method=4)
            name = hashed_name(base, open(tmp, 'rb').read())
            os.replace(tmp, os.path.join(out, name))
            sheets.append((name, pg, q))
            for k, x, y, w, h in pg:
                e = dict(table[k])
                e['url'] = name
                e['rect'] = [x, y, w, h]
                new[k] = e
    # 切り出しが元の画像と 1 画素も違わないこと（exact: 透明な画素の色も残す）
    # 非可逆の地図帳（不透明な下絵だけ）は PSNR が MIN_PSNR 以上で、不透明のままであること
    for name, pg, q in sheets:
        sheet = Image.open(os.path.join(out, name)).convert('RGBA')
        for k, x, y, w, h in pg:
            a = sheet.crop((x, y, x + w, y + h))
            b = imgs[k]
            if q:
                p = psnr(a.convert('RGB'), b.convert('RGB'))
                if p < MIN_PSNR or a.getextrema()[3][0] != 255:
                    raise SystemExit(f'{kind} {k}: lossy copy too far from the source (PSNR {p:.1f} dB)')
            elif a.tobytes() != b.tobytes():
                raise SystemExit(f'{kind} {k}: pixels differ after packing')
    return new, len(sheets)


def pack_voice(table, dist, out, chunk):
    """voice: {id: url} → {id: {url, off, len}}。名前の順につなぎ、chunk バイトを越えたら次のファイル"""
    os.makedirs(os.path.join(out, 'voice'), exist_ok=True)
    new, n, buf = {}, 0, bytearray()
    parts = []

    def flush():
        nonlocal n, buf
        if not buf:
            return
        name = hashed_name(f'voice/pack_{n:02d}.ogg', bytes(buf))
        with open(os.path.join(out, name), 'wb') as f:
            f.write(buf)
        for k, off, ln in parts:
            new[k] = {'url': name, 'off': off, 'len': ln}
        parts.clear()
        n += 1
        buf = bytearray()

    for k in sorted(table):
        url = table[k] if isinstance(table[k], str) else table[k]['url']
        data = open(os.path.join(dist, bare(url)), 'rb').read()
        if not data.startswith(b'OggS'):
            raise SystemExit(f'voice {k}: not an Ogg file ({url})')
        if buf and len(buf) + len(data) > chunk:
            flush()
        parts.append((k, len(buf), len(data)))
        buf += data
    flush()
    return new, n


def main():
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument('--dist', default=os.path.join(here, '..', 'dist'))
    ap.add_argument('--out', required=True)
    ap.add_argument('--page', type=int, default=2048)
    ap.add_argument('--no-size-limits', action='store_true',
                    help='Firebase などに出すとき: 1 ファイル・1 版の大きさと数の上限（成果物ページの上限）を確かめない（形式の確認はする）')
    ap.add_argument('--voice-pack-mb', type=float, default=2.5)
    ap.add_argument('--scope', choices=('demo', 'all'), default='demo',
                    help="demo: leave out the env themes and battle backgrounds of regions locked in the slice (regions.js slice: 'locked')")
    ap.add_argument('--under-quality', type=int, default=94,
                    help='WebP quality for the opaque painted map underlays (0 = lossless). Layers with alpha stay lossless')
    a = ap.parse_args()
    dist, out = os.path.abspath(a.dist), os.path.abspath(a.out)
    html = open(os.path.join(dist, 'index.html'), encoding='utf-8').read()
    m = re.search(r'<script>window\.RPG_MEDIA=(.*?);</script>', html, re.S)
    if not m:
        raise SystemExit('dist/index.html has no RPG_MEDIA (build without --single)')
    media = json.loads(m.group(1))
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)

    new = dict(media)
    for kind in ('bgm', 'title', 'portraits'):
        t = media.get(kind) or {}
        for k, e in t.items():
            urls = [e] if isinstance(e, str) else [e['url']] + ([e['png']] if isinstance(e, dict) and e.get('png') else [])
            for u in urls:
                u = bare(u)   # 表の url の ?v=<hash> はそのまま残す（HTTP キャッシュの鍵）
                os.makedirs(os.path.join(out, os.path.dirname(u)), exist_ok=True)
                shutil.copyfile(os.path.join(dist, u), os.path.join(out, u))
    counts = {}
    if a.scope == 'demo' and media.get('env'):
        locked = locked_themes(os.path.join(here, '..'))
        drop = [k for k in media['env'] if k.split('/')[0] in locked or (k.startswith('bbg/') and k.split('/')[1] in locked)]
        new['env'] = media['env'] = {k: e for k, e in media['env'].items() if k not in set(drop)}
        counts['env_dropped'] = len(drop)
        print(f'[pack_web] scope demo: left out {len(drop)} env images of locked regions {sorted(locked)}')
    for kind in ('env', 'sprites', 'monsters'):
        if media.get(kind):
            new[kind], counts[kind] = pack_images(kind, media[kind], dist, out, a.page, env_group if kind == 'env' else None,
                                                  under_lossy(a.under_quality) if kind == 'env' else None)
    if media.get('voice'):
        new['voice'], counts['voice'] = pack_voice(media['voice'], dist, out, int(a.voice_pack_mb * 1000 * 1000))
    table = json.dumps(new, ensure_ascii=False, separators=(',', ':'))
    html = html[:m.start()] + '<script>window.RPG_MEDIA=' + table + ';</script>' + html[m.end():]
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)

    # 一覧と公開の組
    files = []
    for root, _, fs in os.walk(out):
        for f in fs:
            p = os.path.relpath(os.path.join(root, f), out).replace(os.sep, '/')
            if p == 'publish_batches.json':
                continue
            files.append({'path': p, 'bytes': os.path.getsize(os.path.join(out, p))})
    files.sort(key=lambda x: (x['path'] != 'index.html', x['path']))
    bad = []
    for f in files:
        ext = os.path.splitext(f['path'])[1].lower()
        text = ext in ('.html', '.css', '.js', '.json', '.svg', '.txt')
        if ext not in SERVABLE:
            bad.append(f"{f['path']}: type {ext} is not servable")
        if not a.no_size_limits and f['bytes'] > (MAX_TEXT if text else MAX_BIN):
            bad.append(f"{f['path']}: {f['bytes']} bytes is over the per-file limit")
    batches, cur = [], None
    for f in files:
        if cur is None or len(cur['files']) + 1 > BATCH_FILES or cur['bytes'] + f['bytes'] > BATCH_BYTES:
            cur = {'batch': len(batches) + 1, 'files': [], 'bytes': 0}
            batches.append(cur)
        cur['files'].append(f['path'])
        cur['bytes'] += f['bytes']
    total = sum(f['bytes'] for f in files)
    if not a.no_size_limits and len(files) > VERSION_FILES:
        bad.append(f'{len(files)} files is over the {VERSION_FILES} per version')
    if not a.no_size_limits and total > VERSION_BYTES:
        bad.append(f'{total} bytes is over the per-version limit')
    folders = {}
    for f in files:
        d = f['path'].split('/')[0] if '/' in f['path'] else '.'
        folders.setdefault(d, {'files': 0, 'bytes': 0})
        folders[d]['files'] += 1
        folders[d]['bytes'] += f['bytes']
    manifest = {
        'note': 'Play-ready copy of the v2 slice. Publish the batches in order to the same artifact (batch 1 holds index.html). '
                'Sizes are bytes; limits used: <= 64,000,000 bytes and <= 255 files per publish, <= 15 MB per binary / 16 MB per text file, '
                '<= 511 files and 256 MB per version. Atlas and voice pack names carry a content hash (and copied media a ?v=<hash> '
                'in the table) so browsers never reuse an old cached image after a republish; when republishing to the same artifact, '
                'remove the previous version\'s atlas_*/pack_* paths that are not in this list (files: {path: null}).',
        'entry': 'index.html',
        'total_files': len(files),
        'total_bytes': total,
        'folders': folders,
        'packed': {'env_atlases': counts.get('env', 0), 'sprite_atlases': counts.get('sprites', 0), 'monster_atlases': counts.get('monsters', 0), 'monster_images': len(media.get('monsters') or {}), 'voice_packs': counts.get('voice', 0),
                   'env_images': len(media.get('env') or {}), 'sprite_sheets': len(media.get('sprites') or {}), 'voice_clips': len(media.get('voice') or {})},
        'files': files,
        'batches': batches,
        'problems': bad,
    }
    with open(os.path.join(out, 'publish_batches.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f'[pack_web] {len(files)} files, {total / 1e6:.1f} MB → {out}')
    for d, v in sorted(folders.items()):
        print(f'[pack_web]   {d:8s} {v["files"]:4d} files {v["bytes"] / 1e6:7.1f} MB')
    for b in batches:
        print(f'[pack_web]   batch {b["batch"]}: {len(b["files"])} files, {b["bytes"] / 1e6:.1f} MB')
    for p in bad:
        print('[pack_web] PROBLEM ' + p)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
