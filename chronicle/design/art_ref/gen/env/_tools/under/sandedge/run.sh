#!/bin/bash
# final processing of gen1 -> v2/assets/env/desert/under (sandedge). Drift is small (<= 0.12 tile, rowwarp.py -> warp1.json); the door already sits on its tile.
cd "$(dirname "$0")"
export WARP=warp1.json
python3 process.py gen1.png out1 && python3 doorsheet.py out1/sandedge@32.png doors_fix.png && cp out1/* /home/user/others/chronicle/v2/assets/env/desert/under/
