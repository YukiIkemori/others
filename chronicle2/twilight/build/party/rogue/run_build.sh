#!/bin/sh
# the chosen raws -> work/final (walk_raw.png, run_raw.png)
# d2a drew the two back diagonals in the other order (row 3 looks up-right, row 4 up-left): --swap diag:2,3
cd /home/user/tw/party/rogue && python3 build.py work/final --walk raw/w1a.png --diag raw/d2a.png --run raw/r3b.png --rundiag raw/x2b.png \
  --cols run:1=3,4,1,2 --swap diag:2,3 --keep e6d0b8 --ncol 28 "$@"
