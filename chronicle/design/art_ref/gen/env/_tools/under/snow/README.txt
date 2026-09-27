Painted Yule and pass inn underlays (2026-09-27). Each folder: design.py (layout grid + buildings -> layout.json), guide.py (guide_48.png),
mkjob.py -> gen_env.py (OPENAI_MODEL=gpt-6-sol), fullmap.js (tile render layout_albedo.png + layout_data.json for the gain),
yule only: rowwarp.py (DTW vertical drift -> warp.json; the model drew the lower half ~2 tiles low), then process.py with
SHIFT (door surgery) -> out/<map>@24/@32(@40).png + _emit + json -> v2/assets/env/snow/under/.
Yule:     SHIFT='[[900,535,965,612,12,0],[1212,580,1266,648,-7,0],[1360,70,1552,275,-14,0],[1520,330,1712,560,-18,0],[425,990,650,1200,-20,-20],[1150,950,1400,1185,-12,-12],[1420,1190,1650,1400,-23,0],[200,150,360,275,-5,0],[1135,1265,1190,1325,8,0]]' GAIN=0.86 python3 process.py gen1.png out1
Pass inn: SHIFT='[[110,30,910,300,0,-18],[212,205,255,262,7,0],[778,205,822,262,18,0]]' GAIN=0.86 python3 process.py gen2.png out2
Raw chosen generations: ../../under/yule_gen1_raw.png, ../../under/pass_inn_gen2_raw.png (guides next to them).
