#!/bin/bash
# closed layer / live / json from an aligned 1x painting, then copy to v2/assets/env/desert/under.  usage: ./finalize.sh <map> <aligned png in maps/<map>/>
set -e
cd "$(dirname "$0")"
m=$1; A=${2:-aligned.png}; NAME=${m#desert_}
rm -rf maps/$m/out
(cd maps && EMIT=none python3 ../process_dg.py $m $m/$A desert $NAME | tail -1)
python3 check.py $m maps/$m/out/$NAME@32.png maps/$m/check.png
cp maps/$m/out/* /home/user/others/chronicle/v2/assets/env/desert/under/
