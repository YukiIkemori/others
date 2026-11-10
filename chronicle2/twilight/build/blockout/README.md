# 骨組み先行方式（3D blockout first, painted after）

当たり判定と「物の前後関係」を絵から推定するのをやめて、先に作った簡単な3Dの骨組みからそのまま取り出す方式の試作です。
絵は、骨組みを描画した画像を画像モデルに渡して「形は動かさず、この画風で塗り直す」ことで作ります。

遊べる版のデータは `../../site3d/`（`game.js` などは `../site/` への symlink）。

## 手順

作業フォルダに 3D 側の出力（`site/px/map.json, geo.png, walk.png`。`chronicle2/monastery` の bake 出力）を置いて実行します。

1. `conv.py out` … 3D データをエンジン形式に変換（`out/walk.png, h.npy, height.png, info.json`）。絵は一切見ません。
2. 塗り: `python3 ../img.py prompts/paint.txt gen/out_1x.png --size 1920x2048 --quality high --image guide_1x.png --image styleref.png`
   - `guide_1x.png` = 骨組みの描画（空はマゼンタ）、`styleref.png` = 仕上がりの見本（気に入っているマップの切り抜き）。
3. `match.py guide_1x.png gen/out_1x.png pts.npy` … 骨組みと塗った絵のずれを窓ごとに測る。
4. `warp.py pts.npy out map_base.json stage` … 3D 側のデータを絵に合わせて動かす（絵は動かさない）。光や出入口の座標も同じ変換を通す。
5. 確認用マスク: `python3 ../img.py prompts/mask_raised.txt gen/m_raised.png --size 1920x2048 --image gen/out_1x.png`、
   `match.py st_paint.png gen/m_raised.png pts_mask.npy`、`check.py stage gen/out_1x.png gen/m_raised.png pts_mask.npy report.jpg`
   … 歩き回る代わりの自動チェック。絵に描かれなかった低い小物を外し、食い違いを色分けした全体図を出します。

## 2026-11-10 の試作でわかったこと

- 画像モデルは配置を守るが、絵全体をわずかに拡大する（今回は横 +0.7 %、縦 +1.9 %。端では 20〜40 px のずれ）。
  そのまま重ねると当たり判定がずれるので、手順 3〜4 が必須。補正後の残りのずれは平均 1.3〜1.5 px（95 % が 3.7 px 以内）。
- 3D にある立体物の 92 % は絵にも描かれていた。描かれなかったのは低い茂み 7 個だけで、自動で外した。
- 補正後、ランダム歩行 400 回で引っかかり 0。
- `gpt-image-2` の制限: 両辺 16 の倍数、長辺 3840 以下、総画素は約 829 万まで。`input_fidelity` は使えない。
- 未対応: 段差のある地形では、物の前後を「画面上の高さ」だけで決める今のエンジン形式（height.png）では足りず、奥行きそのものを持たせる必要がある。
