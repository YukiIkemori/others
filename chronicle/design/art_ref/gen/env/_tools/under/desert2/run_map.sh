#!/bin/bash
# painted desert dungeon: gen -> coarse warp (warp2.py) -> local flow (flow.py) -> aligned 1x (align.py) -> closed layer / live / json (process_dg.py)
# usage: ./run_map.sh <map> <gen name>     env: EXTRA_PATCH (align.py PATCH), GAIN, TOPTEX=<k> (texture flat painted wall tops, toptex.py)
# output: maps/<map>/out/<map without desert_>{@24,@32,@40,_closed@*,.json} -> v2/assets/env/desert/under/
set -e
cd "$(dirname "$0")"
m=$1; g=$2
python3 warp2.py $m maps/$m/$g.png maps/$m/warp.json
WARP=maps/$m/warp.json python3 align.py $m maps/$m/$g.png maps/$m/coarse.png
python3 flow.py $m maps/$m/coarse.png maps/$m/flow.npz
WARP=maps/$m/warp.json FLOW=maps/$m/flow.npz PATCH="${EXTRA_PATCH:-[]}" python3 align.py $m maps/$m/$g.png maps/$m/aligned.png
A=aligned.png
if [ -n "$TOPTEX" ]; then python3 toptex.py $m maps/$m/aligned.png maps/$m/aligned_t.png $TOPTEX; A=aligned_t.png; fi
NAME=${m#desert_}
cd maps && EMIT=none python3 ../process_dg.py $m $m/$A desert $NAME
cd .. && python3 check.py $m maps/$m/out/$NAME@32.png maps/$m/check.png
