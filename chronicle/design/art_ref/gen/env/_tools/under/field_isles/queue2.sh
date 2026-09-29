#!/bin/sh
cd "$(dirname "$0")"
while ! grep -q "done i_cape" queue1.log; do sleep 20; done
sh queue.sh i_light/gen1.job.json i_siren/gen1.job.json i_crab/gen1.job.json i_wreck/gen1.job.json coral/gen1.job.json nerei/gen1.job.json isles_cave_1/gen1.job.json isles_cave_2/gen1.job.json ghost_ship_1/gen1.job.json ghost_ship_2/gen1.job.json ghost_ship_3/gen1.job.json
