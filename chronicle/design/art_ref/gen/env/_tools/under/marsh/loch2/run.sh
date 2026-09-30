#!/bin/bash
# ロッホの描き直し（2026-09-29、なめらかな形）: layout.py → guide.py → mkjob.py → gen.sh → warp.py（縦のずれ 1.025 倍）→ 下絵（塔と武具屋の戸を少し東へ）→ refit.py（当たり）
# → v2/assets/env/moss_village/under/loch*、行は marsh_loch.js の ROWS（layout.json の rows_fit）
cd "$(dirname "$0")"
python3 warp.py && SHIFT='[[1404,530,1476,578,14,0],[1098,340,1156,384,12,0]]' NAME=loch python3 process.py gen1w.png out1 && python3 refit.py | cut -c1-200 && python3 finddoors.py proc_last.png && cp out1/* /home/user/others/chronicle/v2/assets/env/moss_village/under/
