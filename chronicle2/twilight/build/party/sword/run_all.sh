#!/bin/sh
# Party character `sword`: the steps that produced the delivered files (generations are commented: they cost money).
# Chosen raws: walk main raw/w1a.png, walk diagonals raw/d1b.png, run left/right raw/r2b.png, run down/up raw/r1b.png
# (front row re-ordered so that col 1 = her left foot), run diagonals raw/s1b.png. Prompts sit beside each raw (*_prompt.txt).
set -e
cd "$(dirname "$0")"
# python3 make_guide.py guide_walk.png walk main; python3 make_guide.py guide_run_main.png run main
# python3 gen.py walk_main raw/w1a.png
# python3 gen.py walk_diag raw/d1b.png --ref raw/w1a.png
# python3 gen.py run_main  raw/r1b.png --ref raw/w1a.png
# python3 gen.py run_main  raw/r2b.png --ref raw/w1a.png --extra "ROW 4 ... no sword at all (see raw/r2b_prompt.txt)"
# python3 gen.py run_diag  raw/s1b.png --ref raw/r1a.png --ref2 raw/d1b.png --extra "... (see raw/s1b_prompt.txt)"
SITE=/home/user/others/chronicle2/twilight/site/party
python3 build.py cfg.json work
python3 finish.py cfg.json work final
cp final/sword.png final/sword_run.png final/sword.json $SITE/
python3 check.py $SITE sword
python3 preview.py $SITE sword final "剣士の幼なじみ"
mkdir -p /mnt/project-files/twilight-rpg/party/
cp final/sword_preview.png final/sword_walk.gif final/sword_run.gif /mnt/project-files/twilight-rpg/party/
