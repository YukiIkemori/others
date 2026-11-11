# 最初の一区切り（始まりの村 → F01 麦の丘 → 崖の修道院の浅い所）

量産前に絵の基準を決めるための、遊べる一区切りです。3 つのマップ、敵 9 体、村人 10 人、戦闘（エフェクト、リピート、倍速、ぬすむ、弱点）、
メニュー、店、宿、宝箱、セーブ、曲が入っています。

- `index.html` … 画面と UI の見た目（文字の大きさはオクトパストラベラーII に合わせた。1080p で 1 単位 = 1px の `--u`）。
- `data.js` … 人、技、道具、魔物、遭遇、村人のせりふ、店、宝箱（シナリオの表から）。
- `rpg.js` … フィールドの上のゲーム（状態、メニュー、店、宿、宝箱、セーブ、遭遇）。`RPG.debug` に試し用の入口。
- `battle.js` … 横から見た戦闘。絵は 960x540（フィールドと同じドットの大きさ）、エフェクトと数字は上のなめらかなキャンバス。
- `sound.js` … 曲（`bgm/<id>.ogg` と、ループ位置の `<id>.json`）と、合成の効果音。
- `game.js`, `hd.js`, `party/` … `../site/` への symlink（フィールドのエンジンと HD-2D 表示、4 人の絵）。
- `village/`, `f01/`, `abbey/` … マップ。`map.json` は `build/slice/make_maps.py` が `places.json` から書く。

## 作り方

1. 骨組み: `build/blockout/village_world.py | field01_world.py | cliff_world.py <bake_dir>`
2. 塗り: `build/img.py build/blockout/prompts/paint_<map>.txt p.png --size <1.5倍> --quality high --image guide_15.png --image styleref.png`
   （`guide_15.png` = `guide.png` を最近傍で 1.5 倍、`styleref.png` = 村の絵）。1x へは BOX で縮小。
3. 位置合わせと配置: `match.py <bake>/guide.png paint_1x.png pts.npy 128` → `stage.py <bake> paint_1x.png pts.npy slice/<map>`
4. 自動チェック: `prompts/mask_<map>.txt` でマスクを作り 1x に縮小 → `match.py slice/<map>/st_paint.png m_1x.png pts_mask.npy 128`
   → `check.py slice/<map> paint_1x.png m_1x.png pts_mask.npy report.jpg adopt` → `build/slice/fix_raised.py slice/<map>`
5. `build/slice/make_maps.py [village] [f01] [abbey]`
6. 絵の部品: `build/slice/gen_art.py`（魔物、村人、宝箱、結晶、戦闘の背景）→ `build/slice/make_sprites.py raw_dir slice`

## 試し方

`python3 -m http.server` を `slice/` で起動して `index.html` を開く。`?hd=0&q=low` で軽い 2D 表示、`?enc=0` で遭遇なし、`?map=f01/map.json` で始めるマップ。
自動の通し確認は `build/slice/test/`（`node play.js <url> walkthrough.js` など。Playwright）。

## 公開

`python3 build/publish.py slice/index.html <out>/index.html` のあと、`slice/` の中身（`.npy`, `st_paint.png`, `places.json`, `check.json` 以外。symlink は実体）を
同じフォルダにコピーして、そのフォルダを root にして Artifact に出す。
