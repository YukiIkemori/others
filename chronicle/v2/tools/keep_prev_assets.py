#!/usr/bin/env python3
"""公開し直しても、遊んでいる途中の人の画面が壊れないように: 今公開中の版が使う「中身で名前の変わるファイル」
（地図帳 *_NN.<hash>.webp・声のまとめ pack_NN.<hash>.ogg など）のうち、新しい版に無いものを公開中の所から取って来て、
新しい public に足す（1 つ前の版の分だけ残す）。

  python3 tools/keep_prev_assets.py <public の dir> <公開中の URL（例 https://luminous-chronicle.web.app）>
"""
import os, re, sys, urllib.request

pub, base = sys.argv[1], sys.argv[2].rstrip('/')
idx = urllib.request.urlopen(base + '/?keep=' + str(os.getpid()), timeout=120).read().decode('utf8', 'replace')
# 中身の hash を名前に持つファイル（pack_web.hashed_name）だけ。?v= の付く写しは名前が変わらないので要らない
# （英語・中国語・韓国語のボイスのまとめは voice/en|zh|ko/pack_NN.<hash>.ogg）
paths = sorted(set(re.findall(r'(?<![\w/.-])((?:env|sprites|monsters|voice|sfx|bgm)/(?:(?:en|zh|ko)/)?[\w-]+\.[0-9a-f]{10}\.(?:webp|png|ogg))', idx)))
missing = [p for p in paths if not os.path.exists(os.path.join(pub, p))]
got = 0
for p in missing:
    dst = os.path.join(pub, p)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with urllib.request.urlopen(base + '/' + p, timeout=300) as r, open(dst + '.part', 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    os.replace(dst + '.part', dst)
    got += os.path.getsize(dst)
print(f'[keep_prev] live uses {len(paths)} hashed files; {len(missing)} not in the new build were kept ({got / 1e6:.1f} MB)')
