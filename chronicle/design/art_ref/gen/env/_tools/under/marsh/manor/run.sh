#!/bin/bash
# manor floors: m1_gen1 / m2_gen1 -> v2/assets/env/marsh/under (manor_1, manor_2). The paintings sit ~8 px low (align.py): DY=-8.
cd "$(dirname "$0")"
DY=-8 python3 ../process_dun.py layout_1.json m1_gen1.png manor_1 out1 && DY=-8 python3 ../process_dun.py layout_2.json m2_gen1.png manor_2 out2 && cp out1/* out2/* /home/user/others/chronicle/v2/assets/env/marsh/under/
