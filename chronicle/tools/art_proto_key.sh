#!/usr/bin/env bash
# Hi-res art prototype (BRIEF Part A16): cut every generated sheet in design/art_proto/raw/<style>/ into
# design/art_proto/assets/<style>/ (keyed sprites, seamless ground textures, fitted battle backdrop) and rebuild the
# hero cut-out rig. Tool-time only; needs python3 + numpy + pillow + scipy. Then: node tools/art_mock.js [--anim]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/design/art_proto"
K="python3 $ROOT/tools/art_key.py"
for s in anime chibi storybook; do
  rm -rf assets/$s; mkdir -p assets/$s
  P=raw/$s/party.jpg; [ -f raw/$s/party.v2.jpg ] && P=raw/$s/party.v2.jpg
  M=raw/$s/mons.jpg; [ -f raw/$s/mons.v2.jpg ] && M=raw/$s/mons.v2.jpg
  $K sprites $P assets/$s/party --scale 0.4 --order x >/dev/null
  $K sprites $M assets/$s/mons --scale 0.4 --order x --min-area 0.01 >/dev/null
  for j in town world dungeon field; do J=10; [ $j = field ] && J=3; $K sprites raw/$s/$j.jpg assets/$s/$j --scale 0.4 --order rows --bands 2 --min-area 0.002 --join $J $([ $j = town -o $j = dungeon ] && echo --glow-kill) >/dev/null; done
  $K grid raw/$s/ground.jpg assets/$s/ground --size 256 --inset 0.07 >/dev/null
  $K fit raw/$s/bbg.jpg assets/$s/bbg.jpg --w 1024 --h 608 --ay 0.35 >/dev/null
done
# hero cut-out rig (anime): the keyed hero at 0.5 of the raw sheet, arm+sword polygon, shoulder pivot (PLAN §3)
T=$(mktemp -d)
$K sprites raw/anime/party.jpg $T/p --scale 0.5 >/dev/null
cp $T/p_3.png ref/anime_hero_keyed.png
python3 $ROOT/tools/art_rig.py ref/anime_hero_keyed.png assets/anime/rig_hero --poly "108,183 135,194 150,235 150,281 100,292 84,301 59,304 60,340 92,342 92,366 68,369 90,655 78,666 61,666 29,372 2,366 2,342 32,338 33,306 13,302 10,259 28,246 59,231 79,208" --pivot 117,205 --fill-x0 96 --scale 0.5 >/dev/null
rm -rf $T
