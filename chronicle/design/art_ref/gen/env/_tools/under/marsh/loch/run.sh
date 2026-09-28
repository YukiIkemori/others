#!/bin/bash
# final processing of gen1 -> v2/assets/env/marsh/under (loch). The painting sits ~8 px (1x) low: DY=-8. Doors are within 12 px of the data; the bell tower's data
# was moved 1 tile west to match the painting (no door surgery).
cd "$(dirname "$0")"
DY=-8 NAME=loch python3 process.py gen1.png out1 && python3 doorsheet.py proc_last.png doors_fix.png && cp out1/* /home/user/others/chronicle/v2/assets/env/marsh/under/
