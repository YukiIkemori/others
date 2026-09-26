set -e
cd /home/user/others/chronicle/design/art_proto
K="python3 /home/user/others/chronicle/tools/art_key.py"
for s in anime chibi storybook; do
  rm -rf assets/$s; mkdir -p assets/$s
  P=raw/$s/party.jpg; [ -f raw/$s/party.v2.jpg ] && P=raw/$s/party.v2.jpg
  M=raw/$s/mons.jpg; [ -f raw/$s/mons.v2.jpg ] && M=raw/$s/mons.v2.jpg
  $K sprites $P assets/$s/party --scale 0.4 --order x >/dev/null
  $K sprites $M assets/$s/mons --scale 0.4 --order x --min-area 0.01 >/dev/null
  for j in town world dungeon field; do J=10; [ $j = field ] && J=3; $K sprites raw/$s/$j.jpg assets/$s/$j --scale 0.4 --order rows --bands 2 --min-area 0.002 --join $J >/dev/null; done
  $K grid raw/$s/ground.jpg assets/$s/ground --size 256 --inset 0.07 >/dev/null
  $K fit raw/$s/bbg.jpg assets/$s/bbg.jpg --w 1024 --h 608 --ay 0.35 >/dev/null
done
