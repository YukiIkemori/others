#!/usr/bin/env bash
# Hi-res art prototype, round 2 (BRIEF A16 追記): raw/<hdpix|hdpaint>/ → assets/<hdpix|hdpaint>/.
#   hdpix  : the generated "pixel art" is re-sampled onto a clean grid (tools/art_key.py --pixel auto): one art pixel =
#            2×2 device px (half a logical pixel, twice as fine as the current sprites); --hs gives each sprite's
#            height in device px as drawn (battle 4 device px per logical px, field 3 per map px).
#   hdpaint: smooth cut-outs at 0.35 of the raw sheet, scaled with smoothing when drawn.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/design/art_proto"
K="python3 $ROOT/tools/art_key.py"
pick(){ for t in v3 v2 ""; do f=raw/$1/$2${t:+.$t}.jpg; [ -f $f ] && { echo $f; return; }; done; }
rm -rf assets/hdpix assets/hdpaint; mkdir -p assets/hdpix assets/hdpaint
P="--pixel auto --up 2"
S="sprites"
# ---- V1 hdpix
$K $S $(pick hdpix party)   assets/hdpix/party   $P --pitch-mult 2 --join 4 --flip-idx 0 &
$K $S $(pick hdpix mons)    assets/hdpix/mons    $P --hs 92,156,180 --min-area 0.01 &
$K $S $(pick hdpix fg)      assets/hdpix/fg      $P --pitch-mult 2 --order rows --bands 2 --min-area 0.002 &
$K $S $(pick hdpix town)    assets/hdpix/town    $P --hs 96,276,276,186,42,51,108,60,51,36 --order rows --bands 2 --min-area 0.002 --glow-kill &
$K $S $(pick hdpix world)   assets/hdpix/world   $P --hs 156,132,108,156,60,114,66,60,102,96 --order rows --bands 2 --min-area 0.002 --glow-kill &
$K $S $(pick hdpix dungeon) assets/hdpix/dungeon $P --hs 120,132,90,102,54,54,66,42 --order rows --bands 2 --min-area 0.002 --glow-kill &
$K $S $(pick hdpix field)   assets/hdpix/field   $P --hs 96,96,96,90,93,84,90,96 --order rows --bands 2 --min-area 0.002 --join 3 &
$K grid $(pick hdpix ground) assets/hdpix/ground --size 160 --up 2 --inset 0.07 &
$K fit $(pick hdpix bbg) assets/hdpix/bbg.jpg --w 1024 --h 608 --ay 0.45 --up 2 &
# ---- V2 hdpaint
Q="--scale 0.35 --order rows --bands 2 --min-area 0.002"
$K $S $(pick hdpaint party)   assets/hdpaint/party   --scale 0.35 --join 4 &
$K $S $(pick hdpaint mons)    assets/hdpaint/mons    --scale 0.35 --min-area 0.01 &
$K $S $(pick hdpaint fg)      assets/hdpaint/fg      $Q &
$K $S $(pick hdpaint town)    assets/hdpaint/town    $Q --glow-kill &
$K $S $(pick hdpaint world)   assets/hdpaint/world   $Q --glow-kill &
$K $S $(pick hdpaint dungeon) assets/hdpaint/dungeon $Q --glow-kill &
$K $S $(pick hdpaint field)   assets/hdpaint/field   $Q --join 3 &
$K grid $(pick hdpaint ground) assets/hdpaint/ground --size 256 --inset 0.07 &
$K fit $(pick hdpaint bbg) assets/hdpaint/bbg.jpg --w 1024 --h 608 --ay 0.45 &
wait
echo ok
