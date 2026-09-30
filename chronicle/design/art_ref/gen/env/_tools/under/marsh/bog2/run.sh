#!/bin/bash
# 沼の描き直し（2026-09-29、なめらかな形）: layout.py → guide.py → mkjob.py → gen.sh → prep.py（縦のずれ・水の色）→ refit.py（当たり）→ 下絵（bog + bog_closed。2026-09-30: 歩ける所を WALKLIFT で持ち上げ）
cd "$(dirname "$0")"
python3 prep.py && python3 refit.py | tail -1 && python3 -c "
import json
L=json.load(open('layout.json')); r=L['rows_fit']
json.dump([dict(cells=[[x,y] for y,row in enumerate(r) for x,c in enumerate(row) if c==k],patch=i) for i,k in enumerate('AB')],open('live.json','w'))" &&
LIVE=live.json WATER=160,1152,416,1408 GAIN=1.25 WALKLIFT=1.4 WALKCH='gp=AB' python3 ../process_dun.py layout.json gen1p.png bog out1 && cp out1/* /home/user/others/chronicle/v2/assets/env/forest_dungeon/under/
