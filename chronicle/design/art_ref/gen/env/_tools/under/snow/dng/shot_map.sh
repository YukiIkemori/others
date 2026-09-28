#!/bin/bash
# in-game screenshot of a map at a cell (v2/tools/shot.js). usage: shot_map.sh <map> <x> <y> <out.png> [js run before entering, e.g. flags]
M=$1; X=$2; Y=$3; OUT=$4; PRE=${5:-0}
cd /home/user/others/chronicle/v2
V2_OPEN_TIMEOUT=120000 timeout 300 node tools/shot.js --query "fixture=content_s_pass_inn" --size 1280x720 \
  --until "(RPG.Engine.top()||{}).id==='field' && RPG.Engine.fade.a < 0.01" \
  --eval "(async () => { RPG.Events.run = () => Promise.resolve(); RPG.Mon.encounter = () => null; RPG.Game.flags.prologue_done = true; ${PRE}; RPG.Field.chunks.reset(); await RPG.Field.enter('$M', {x: $X, y: $Y, dir: 's'}, { fade: 0, noAutosave: true }); return RPG.Field._s.map.id; })()" \
  --wait 3500 --out "$OUT" 2>&1 | grep -v "^$" | tail -2
