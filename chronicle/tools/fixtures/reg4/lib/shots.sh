#!/bin/bash
# usage: shots.sh <out.png> <map> <spawn-or-json> [zoom normal|wide|wider] [extra js] [html]
# Screenshots one region-4 map with the field zoom set (node tools/shot.js; one browser per call).
cd "$(dirname "$0")/../../../.."
OUT=$1; MAP=$2; SP=$3; Z=${4:-wide}; EXTRA=${5:-}; HTML=${6:-dist/index.html}
case "$SP" in \{*) SPJ="$SP";; *) SPJ="'$SP'";; esac
timeout 120 node tools/shot.js --html "$HTML" --wait 800 \
  --eval "(async()=>{R=RPG; await R.debug.quickStart({map:'lute', spawn:'inn', noEncounter:true}); R.Settings.fieldZoom='$Z'; R.debug.flag('marsh_start', true); $EXTRA; await R.debug.warp('$MAP', $SPJ); return R.debug.pos();})()" \
  --wait 900 --out "$OUT" 2>&1 | grep -v "^\[console.warning\].*story_rumor" | tail -6
