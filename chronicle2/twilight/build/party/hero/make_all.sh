#!/bin/sh
# Hero run cycle, start to finish (needs OPENAI_API_KEY in the environment for the gen_* steps).
# The published sheet uses: main rows down/up/left from raw/m3.png, right from raw/e1.png (m3 with the lantern taken
# out of the right row), all four diagonal rows from raw/d3.png (see pick_final.json).
set -e
cd "$(dirname "$0")"
python3 make_run_guide.py main /home/user/tw/hero/raw/p7b.png guide_main.png
python3 make_run_guide.py diag /home/user/tw/hero/raw/q7a.png guide_diag.png
# python3 gen_run.py main guide_main.png raw/m3.png high "$(cat extra_main.txt)"
# python3 gen_run.py diag guide_diag.png raw/d3.png high "$(cat extra_diag.txt)"
# python3 gen_fix.py raw/m3.png raw/e1.png fix_right.txt high
python3 build_run.py raw/m3.png raw/d3.png final pick_final.json
python3 publish_run.py final
