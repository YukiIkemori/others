#!/bin/sh
# 描いた絵 → 当たり（fit ＋ 岩）→ 下絵 → マップのファイル。usage: sh run_area.sh <id> <gen.png>
set -e
cd "$(dirname "$0")"
python3 fit.py $1 $2 --apply | tail -2
python3 rocks.py $1 $2 --write | tail -1
python3 fit.py $1 $2 --apply | tail -1
python3 check.py $1 $2 $1/check.png
python3 process.py $1 $2 | tail -1
python3 tomap.py $1
