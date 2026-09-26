#!/bin/sh
# usage: shots.sh <zoom> <tier> <outprefix> map:x:y [map:x:y ...]   (R6 visual checks; one browser run)
Z=$1; T=$2; P=$3; shift 3
ARGS=""
i=0
FIRST=1
for s in "$@"; do
  m=$(echo $s | cut -d: -f1); x=$(echo $s | cut -d: -f2); y=$(echo $s | cut -d: -f3)
  if [ $FIRST = 1 ]; then
    ARGS="$ARGS --eval (RPG.Settings.fieldZoom='$Z',RPG.debug.quickStart({map:'$m',spawn:{x:$x,y:$y},tier:$T})) --wait 1600"
    FIRST=0
  else
    ARGS="$ARGS --eval RPG.debug.warp('$m',{x:$x,y:$y}) --wait 900"
  fi
  ARGS="$ARGS --shot ${P}_$i.png"
  i=$((i+1))
done
cd "$(dirname "$0")/../../.." && node tools/shot.js --html debug.html --query debug=1 $ARGS 2>&1 | grep -v "console.warning" | grep -v "^screenshot\|^eval →" 
