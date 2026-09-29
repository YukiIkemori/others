#!/bin/sh
# (2026-09-29 見直し) 描きこみの多い明るい絵: fit → 小物の当たり（objfit.py）→ 確かめ → 下絵 → マップ。usage: sh run_area2.sh <id> <gen.png> [THR]
set -e
cd "$(dirname "$0")"
python3 fit.py $1 $2 --apply | tail -1
python3 objfit.py $1 $2 $3
python3 check.py $1 $2 $1/check.png
python3 process.py $1 $2 | tail -3
python3 tomap.py $1
