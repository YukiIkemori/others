#!/bin/bash
# final processing of gen1 -> v2/assets/env/desert/under (kasim). Drift from rowwarp.py (warp1.json, up to ~0.65 tile in the south);
# door surgery measured with doorsheet.py; PATCH erases a stray door-like mark the model painted at the south edge of the square.
cd "$(dirname "$0")"
export WARP=warp1.json SHIFT='{"kasim_b_shop":4,"kasim_b_fortune":11,"kasim_b_tavern":12,"kasim_b_digger":15,"kasim_b_guild":8}'
export PATCH='[[986,1110,1020,1140,1030,1110]]'
python3 process.py gen1.png out1 && python3 doorsheet.py out1/kasim@32.png doors_fix.png && cp out1/* /home/user/others/chronicle/v2/assets/env/desert/under/
