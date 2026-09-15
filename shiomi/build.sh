#!/bin/sh
# サイト一式を書き出し直す。上から順に流すこと。
#
# HTMLを手で直したあとにこれを流すと、その手直しは消える。
# 文言を直すときは、生成スクリプト側（make-*.py）か
# content/seo.json を直してから流すこと。
set -e
cd "$(dirname "$0")"

python3 make-core-pages.py      # トップ以外の主要ページ
python3 make-stories.py         # 読み物（ロバート汐見・島の暮らし・目次類）
python3 split-renovation.py     # 古民家再生の記録を1記事1ページに
python3 make-reserve.py         # ご予約ページと send.php
python3 make-funnels.py         # サイクリング・学校・よくあるご質問

python3 apply-seo.py            # タイトルと説明文を当てる
python3 add-structured-data.py  # 構造化データ・sitemap.xml・robots.txt
python3 add-head-meta.py        # ファビコンとOGP

python3 verify.py               # 点検
