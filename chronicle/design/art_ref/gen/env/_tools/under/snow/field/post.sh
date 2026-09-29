#!/bin/sh
# after one generation: fit the collision (layout-seeded classifier), process to the game's underlays, add the painted rocks/edges
# the fit missed (blobs.py), refit, write the map file. usage: sh post.sh <id> <gen.png>
set -e
A=$1; G=$2
[ -f $A/fix.json ] || echo '{"fit": {"SEED": "layout"}}' > $A/fix.json
python3 ../../field/fit.py $A $G --apply | tail -3
GAIN=$(python3 gain.py $A $G) python3 ../../field/process.py $A $G | tail -3
python3 blobs.py $A 0.1 --apply | tail -1
python3 ../../field/fit.py $A $G --apply | tail -2
rm -f $A/fit.png
python3 tomap.py $A | tail -1
