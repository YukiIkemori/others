#!/usr/bin/env python3
"""v2 の公開用の写し（ファイルの数と大きさを、静的な置き場の決まりに収める）

  python3 v2/tools/pack_web.py [--dist v2/dist] --out <dir> [--page 2048] [--voice-pack-mb 2.5]

dist（node v2/tools/build.js の外置きの版）から、次の形の写しを作る:
  index.html               遊ぶ版（RPG_MEDIA をまとめた版に書き換える）
  bgm/<id>.ogg             BGM はそのまま（1 曲 1 ファイル）
  title/<id>.webp|png      タイトルの一枚絵はそのまま（webp。png は読めないときの代わり）
  env/atlas_NN.webp        地形・戦闘背景の画像を地図帳にまとめる（WebP 可逆・exact。{url, rect, meta}）
  sprites/atlas_NN.webp    CAST の原画も同じ
  voice/pack_NN.ogg        ボイスは Ogg をつないだ（chained Ogg）ファイルにまとめる（{url, off, len}）
  publish_batches.json     ファイルと大きさの一覧と、1 回の公開（64 MB・255 本まで）ごとの組
切り出し・範囲の読み方は src/core/media.js（image() と bytes()）。
"""
import argparse
import hashlib
import json
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


def pack_images(kind, table, dist, out, page):
    """table: {id: {url, meta}} → 新しい table（{url, rect, meta}）"""
    os.makedirs(os.path.join(out, kind), exist_ok=True)
    imgs = {}
    for k, e in table.items():
        im = Image.open(os.path.join(dist, bare(e['url'])))
        im.load()
        imgs[k] = im.convert('RGBA')
    pages = shelf_pack([(k, im.width, im.height) for k, im in imgs.items()], page)
    new, names = {}, []
    for i, pg in enumerate(pages):
        pw = max(x + w for _, x, _, w, _ in pg)
        ph = max(y + h for _, _, y, _, h in pg)
        sheet = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        for k, x, y, w, h in pg:
            sheet.paste(imgs[k], (x, y))
        tmp = os.path.join(out, f'{kind}/atlas_{i:02d}.tmp.webp')
        sheet.save(tmp, 'WEBP', lossless=True, exact=True, quality=100, method=4)
        name = hashed_name(f'{kind}/atlas_{i:02d}.webp', open(tmp, 'rb').read())
        os.replace(tmp, os.path.join(out, name))
        names.append(name)
        for k, x, y, w, h in pg:
            e = dict(table[k])
            e['url'] = name
            e['rect'] = [x, y, w, h]
            new[k] = e
    # 切り出しが元の画像と 1 画素も違わないこと（exact: 透明な画素の色も残す）
    for i in range(len(pages)):
        sheet = Image.open(os.path.join(out, names[i])).convert('RGBA')
        for k, x, y, w, h in pages[i]:
            a = sheet.crop((x, y, x + w, y + h))
            b = imgs[k]
            if a.tobytes() != b.tobytes():
                raise SystemExit(f'{kind} {k}: pixels differ after packing')
    return new, len(pages)


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
    ap.add_argument('--voice-pack-mb', type=float, default=2.5)
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
    for kind in ('env', 'sprites', 'monsters'):
        if media.get(kind):
            new[kind], counts[kind] = pack_images(kind, media[kind], dist, out, a.page)
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
        if f['bytes'] > (MAX_TEXT if text else MAX_BIN):
            bad.append(f"{f['path']}: {f['bytes']} bytes is over the per-file limit")
    batches, cur = [], None
    for f in files:
        if cur is None or len(cur['files']) + 1 > BATCH_FILES or cur['bytes'] + f['bytes'] > BATCH_BYTES:
            cur = {'batch': len(batches) + 1, 'files': [], 'bytes': 0}
            batches.append(cur)
        cur['files'].append(f['path'])
        cur['bytes'] += f['bytes']
    total = sum(f['bytes'] for f in files)
    if len(files) > VERSION_FILES:
        bad.append(f'{len(files)} files is over the {VERSION_FILES} per version')
    if total > VERSION_BYTES:
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
                '<= 511 files and 256 MB per version.',
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
