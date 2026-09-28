Painted Yule and pass inn underlays (2026-09-27). Each folder: design.py (layout grid + buildings -> layout.json), guide.py (guide_48.png),
mkjob.py -> gen_env.py (OPENAI_MODEL from the environment), fullmap.js (tile render layout_albedo.png + layout_data.json for the gain),
yule only: rowwarp.py (DTW vertical drift -> warp.json; the model drew the lower half ~2 tiles low), then process.py with
SHIFT (door surgery) -> out/<map>@24/@32(@40).png + _emit + json -> v2/assets/env/snow/under/.
Yule:     SHIFT='[[900,535,965,612,12,0],[1212,580,1266,648,-7,0],[1360,70,1552,275,-14,0],[1520,330,1712,560,-18,0],[425,990,650,1200,-20,-20],[1150,950,1400,1185,-12,-12],[1420,1190,1650,1400,-23,0],[200,150,360,275,-5,0],[1135,1265,1190,1325,8,0]]' GAIN=0.86 python3 process.py gen1.png out1
Pass inn: SHIFT='[[110,30,910,300,0,-18],[212,205,255,262,7,0],[778,205,822,262,18,0]]' GAIN=0.86 python3 process.py gen2.png out2
Raw chosen generations: ../../under/yule_gen1_raw.png, ../../under/pass_inn_gen2_raw.png (guides next to them).

Snow dungeons and the Yule / pass-inn interiors (2026-09-28), folder dng/ (generic, run with a map id):
  dump_all.sh [maps]            fullmap.js (copied from ../../dungeon) -> <map>/layout_*.png, layout_data.json
  guide.py <map> <T>            snow guide (open state; cliff faces as rock strata + icicle ticks under the lip; hull band for the ship)
                                interiors: GUIDE_FLOOR/GUIDE_WALL/GUIDE_FACE=r,g,b recolour the room guide
  mkjob.py <map> <T> genN [extra]   dungeons: guide + style_snow.png (crop of the painted Yule)
  mkjob_in.py <map> <T> genN        interiors: guide + style_yule_bld.png / style_pass.png
  gen_env.py (OPENAI_MODEL from the environment, one job at a time)
  align.py <map> gen.png out.png    local 2D block-matching warp to the guide (the model drifts areas by up to ~1.5 tiles)
  fitcheck.py <map> aligned.png out.png   red = walkable but painted blocked, cyan = solid but painted open -> collision fits in the map data
  patch.py / fillflat.py            copy painted patches over a wrong spot; fill areas left as flat guide colour (from a patch or another aligned painting)
  process.py <map> img.png          gain, tree-canopy overlay (OVER=1), PAD=r,g,b for interiors (pad to whole 8-tile chunks), @24/@32/@40 + json
  peak_1's closed layer + live come from ../../dungeon/process.py (peak_1/out/peak_1_closed@*, live copied into peak_1.json).
  shot_map.sh <map> x y out.png     in-game screenshot
Chosen: snow_woods g1, peak_1 g1, peak_top g1, icicle_1 g2, icicle_2 g1, aurora g2 (flat outer area filled from aligned g1),
frost_ship_1 g2 (g1 was on the old jagged deck; the deck is now a hull shape in the data), frost_ship_2 g2 (g1 had a beam across the floor),
yule_sonja g1 (fire ring moved +0.45 tile), the other interiors g1. Raw paintings: ../../../under/<map>_genN_raw.png, guides <map>_guide.png.
