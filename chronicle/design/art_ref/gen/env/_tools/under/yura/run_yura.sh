#!/bin/bash
# final processing of gen1 -> v2/assets/env/moss_village/under
cd "$(dirname "$0")"
export SHIFT='{"yura_hut_inn":-2,"yura_hut_elder":-3,"yura_hut_h1":-2,"yura_hut_h2":-3,"yura_hut_h3":-3,"yura_hut_h4":2}' CAL=0.5
python3 yprocess.py gen1.png out1 && python3 ydoorsheet.py out1/yura@32.png doors_fix.png && cp out1/* /home/user/others/chronicle/v2/assets/env/moss_village/under/
