#!/bin/sh
# 描いた絵 → 当たり（fit ＋ 岩）→ 下絵 → マップのファイル → 文の表（i18n）。usage: sh run_area.sh <id> <gen.png>
set -e
cd "$(dirname "$0")"
V2=/home/user/others/chronicle/v2
python3 fit.py $1 $2 --apply | tail -2
python3 rocks.py $1 $2 0.2 --write | tail -1
python3 fit.py $1 $2 --apply | tail -1
python3 check.py $1 $2 $1/check.png
python3 process.py $1 $2 | tail -1
python3 tomap.py $1
# tomap.py は名前・副題を日本語のまま書く → すぐに R.T('key') へ移す（key は前と同じ。表に同じ key があれば足さない）
SHORT=$(echo "$1" | sed 's/^s_//')
NODE_PATH=/opt/node22/lib/node_modules node $V2/tools/i18n_extract.js --write $V2/src/maps/field_star_$SHORT.js | tail -1
