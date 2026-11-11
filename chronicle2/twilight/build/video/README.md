# プレイ動画の作り方（X 用、1920×1080・30 fps）

ブラウザの描画を 1 コマずつ読み出すので、実機より遅いこの環境でもカクつかない動画になる。

1. 道順: `python3 plan.py <site>/walk.png 959,1609 1472,262 500,300 > legs.json`
   （歩ける所の真ん中を通り、曲がる回数が少ない 8 方向の道を探す。点はスタート、月の門、泉）
2. 録画: マップのフォルダを `python3 -m http.server 8769` で出し、
   `PORT=8769 node rec.js legs.json frames 0 192` のように範囲を分けて並べて走らせる（1 コマ約 1.5 秒）。
   ページは `?rec=1` で開く: 時計は `__game.sim()` でしか進まず、乱数も固定なので、どの範囲も同じ動きになる。
   止まる時間や向きは `rec.js` の予定表（`wait` / `face` / `leg`）で変える。
3. 表紙: 好きな場面の静止画に `python3 cover.py base.png cover.png`（題名は左下、2 行）。
4. 書き出し: 表紙 2.2 秒 → 0.6 秒で溶けて本編 → 最後 0.8 秒で暗転。
   `ffmpeg -loop 1 -framerate 30 -t 2.8 -i cover.png -framerate 30 -i frames/f%05d.png -filter_complex "[0:v]format=rgb24,setsar=1,fps=30[a];[1:v]format=rgb24,setsar=1,fps=30[b];[a][b]xfade=transition=fade:duration=0.6:offset=2.2,fade=t=out:st=<長さ-0.8>:d=0.8,format=yuv420p[v]" -map "[v]" -c:v libx264 -preset slow -crf 16 -profile:v high -level 4.2 -movflags +faststart out.mp4`
