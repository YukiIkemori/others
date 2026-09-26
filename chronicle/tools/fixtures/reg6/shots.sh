#!/bin/sh
# R6 visual checks in one browser run.
# usage: [PRE='js-without-spaces'] shots.sh <zoom normal|wide|wider> <tier> <outprefix> map:x:y [map:x:y ...]
# quickStart lands in lute first (PRE runs there), then each map:x:y is a debug.warp + screenshot.
Z=$1; T=$2; P=$3; shift 3
ARGS="--eval (RPG.Settings.fieldZoom='$Z',RPG.debug.quickStart({map:'lute',spawn:'inn',tier:$T}).then(()=>{${PRE:-0}})) --wait 1500"
i=0
for s in "$@"; do
  m=$(echo $s | cut -d: -f1); x=$(echo $s | cut -d: -f2); y=$(echo $s | cut -d: -f3)
  ARGS="$ARGS --eval RPG.debug.warp('$m',{x:$x,y:$y}) --wait 1100 --shot ${P}_$i.png"
  i=$((i+1))
done
cd "$(dirname "$0")/../../.." && node tools/shot.js --html debug.html --query debug=1 $ARGS 2>&1 | grep -v "console.warning" | grep -v "^screenshot\|^eval →" ; true
