#!/bin/bash
# bog: gen1 -> v2/assets/env/forest_dungeon/under (bog + bog_closed). live.json = the map's meta.live (tilePatches 0 and 1). No shift (align.py: within 4 px).
cd "$(dirname "$0")"
LIVE=live.json WATER=160,1152,416,1408 python3 ../process_dun.py layout_data.json gen1.png bog out1 && cp out1/* /home/user/others/chronicle/v2/assets/env/forest_dungeon/under/
