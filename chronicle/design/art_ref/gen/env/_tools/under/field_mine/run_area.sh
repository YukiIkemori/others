#!/bin/sh
# 描いた絵 → 当たり（fit）→ 下絵 → マップのファイル。usage: sh run_area.sh <id> <gen.png>
#   （山地は rocks.py を使わない: 草地の灰色の地肌を岩と取り違える。岩は fit.py と fix.json で合わせる）
set -e
cd "$(dirname "$0")"
python3 fit.py $1 $2 --apply | tail -1
python3 check.py $1 $2 $1/check.png
python3 process.py $1 $2 | tail -1
python3 tomap.py $1
