#!/bin/bash
# dump layout + tile renders for every snow dungeon (fullmap.js)
cd "$(dirname "$0")"
for m in ${@:-snow_woods peak_1 peak_top icicle_1 icicle_2 aurora frost_ship_1 frost_ship_2}; do
  mkdir -p $m; V2_OPEN_TIMEOUT=120000 timeout 400 node fullmap.js $m $m/layout 2>&1 | tail -2; echo "done $m"
done
