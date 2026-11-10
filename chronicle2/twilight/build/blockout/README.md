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

## 崖と雲海の版（2026-11-11、段差のある地形）

平らな旧マップでは方式の良さが分かりにくかったので、気に入られている「崖の上の修道院」の構図を骨組みから作り直した版です。
遊べるデータは `../../site_cliff/`。

- `vox.py` … 箱・円柱・円すい・アーチ・階段などを積んで地形を作る小さな道具と、エンジン用データを焼く `bake()`。Blender は使いません。
  見た目用の下絵（`guide.png`）、当たり判定（`walk.png`）、前後関係（`height.png`）、足元の高さ（`floor.png`）が同じ立体から出ます。
- `cliff_world.py out` … 3 段の台地、階段 5 本、門、屋根のない身廊、鐘楼、見晴らし台、池、楓、枯れ木、墓地の配置。
- 塗り: `python3 ../img.py prompts/paint_cliff.txt paint.png --size 2560x3200 --quality high --image guide_2x.png --image styleref_full.png`
  （`guide_2x.png` は `guide.png` を最近傍で 2 倍、`styleref_full.png` は気に入られている最初のマップ全体）。
- `prep.py paint.png paint_1x.png` → `match.py out/guide.png paint_1x.png pts.npy 128` → `cliff_stage.py out paint_1x.png pts.npy stage`
- 自動チェック: `mask_raised.txt` で作ったマスクを 1/2 にして `match.py st_paint.png m_1x.png pts_mask.npy 128` → `check.py stage paint_1x.png m_1x.png pts_mask.npy report.jpg`

結果（採用した 4 枚目の生成）: 補正後のずれ 平均 1.7〜2.6 px、骨組みの立体物の 97 % が絵にも描かれ、絵の立体物の 99 % が骨組みにある。
ランダム歩行 800 回（32 地点から）で引っかかり 0。

わかったこと:
- 段差があっても前後関係は「どちらが南にあるか」だけで決まるので、絵の 1 ドットごとに「南北の位置」を 1 つ持たせれば足りる（`vox.py` 冒頭）。
- 画家（画像モデル）は細い枝や木の大きさを盛りがち。最初の骨組みでは枯れ木を小さく作ったため、塗りで倍の高さに描かれ、枝の前後関係が合わなかった。
  骨組み側の木を大きく作り直して塗り直すと合った。「絵で目立たせたい物は骨組みでも同じ大きさに作る」。
- 4 枚生成して 1 枚は中段に木を 1 本描き足した。自動チェックの全体図（青＝絵にだけある立体物）で見つけられる。
- 未対応: 橋の上と下を両方歩くような立体交差（同じ画面の位置に歩ける場所が 2 つある場合）。いまは手前を優先して奥を通行不可にしている。
