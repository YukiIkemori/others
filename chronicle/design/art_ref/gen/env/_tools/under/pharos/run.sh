#!/bin/bash
# final processing of gen2 -> v2/assets/env/harbor/under (pharos). Measured with doorsheet.py on gen2.png:
# record tower +13, house3 -7, house5 +10 (whole building), smith/shop door +7 and shipyard door +8 (door patch on the plank wall)
cd "$(dirname "$0")"
export SHIFT='[[785,30,988,268,13,0],[1462,140,1660,300,-7,0],[362,800,570,940,10,0],[938,572,1012,656,7,0],[1066,700,1142,784,7,0],[1386,928,1462,1004,8,0]]'
export RAILS='[[1292,1418,412],[1372,1586,812]]'
python3 process.py gen2.png out2 && python3 doorsheet.py out2/pharos@32.png doors_fix.png
