#!/bin/bash
# final processing of full3 (gpt-6-sol, 2880x2688 = 48 px/tile) -> v2/assets/env/treetop/under/fern*
# (the map dump fern_data.json and new_albedo.png = the tile bake of the same layout, fullmap.js fern new, without map.art)
cd "$(dirname "$0")"   # needs full3.png (= ../../../under/fern_gen3_raw.png) and new_albedo.png (fullmap.js fern new, map.art removed) here
node dump.js fern fern_data.json && python3 guide_fern.py >/dev/null
export WARP=warp3.json CAL=0.2 ARCHES='1,6;45,49'
export SHIFT='{"fern_u_inn":8,"fern_u_shop":-2,"fern_u_search":7,"fern_u_gord":13,"fern_u_rita":3,"fern_u_house1":3,"fern_u_house2":9,"fern_u_house3":-7,"fern_u_shed":3}'
python3 process_fern.py full3.png out3 && mkdir -p /home/user/others/chronicle/v2/assets/env/treetop/under && rm -f /home/user/others/chronicle/v2/assets/env/treetop/under/fern* && cp out3/* /home/user/others/chronicle/v2/assets/env/treetop/under/
