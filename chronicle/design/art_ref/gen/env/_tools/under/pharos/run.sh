#!/bin/bash
# final processing of gen1 -> v2/assets/env/harbor/under (pharos)
cd "$(dirname "$0")"
# door surgery (record +16, smith +10, tavern -6, shop+house4 +9) and the upper rope bridge moved down 16 px onto its tiles
export SHIFT='[[334,130,548,300,16,0,775],[772,130,1006,300,10,0,775],[84,524,432,748,-6,0],[1008,524,1356,718,9,0,1000],[1246,290,1450,432,0,16]]'
export RAILS='[[1282,1440,406],[1362,1636,728]]'
python3 process.py gen1.png out1 && python3 doorsheet.py out1/pharos@32.png doors_fix.png
