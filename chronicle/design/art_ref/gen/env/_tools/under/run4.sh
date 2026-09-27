#!/bin/bash
# final processing of gen4 -> v2/assets/env/hill_village/under
cd "$(dirname "$0")"
export SHIFT='{"roa_h1":-18,"roa_hall":-13,"roa_h4":16,"roa_h5":-21,"roa_h3":8,"roa_h2":-3,"roa_berna":3}' CAL=0 WEST=12 DROPWIN='700,968'
python3 process.py gen4.png out4 && python3 doorsheet.py out4/roa@32.png doors_fix.png
