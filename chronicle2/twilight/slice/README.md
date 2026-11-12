# 最初の一区切り（始まりの村 → F01 麦の丘 → 崖の修道院の浅い所）

量産前に絵の基準を決めるための、遊べる一区切りです。3 つのマップ、敵 9 体、村人 10 人、戦闘（エフェクト、リピート、倍速、ぬすむ、弱点）、
メニュー、店、宿、宝箱、セーブ、曲が入っています。

- `index.html` … 画面と UI の見た目（文字の大きさはオクトパストラベラーII に合わせた。1080p で 1 単位 = 1px の `--u`）。
- `data.js` … 人、技、道具、魔物、遭遇、村人のせりふ、店、宝箱（シナリオの表から）。
- `rpg.js` … フィールドの上のゲーム（状態、メニュー、店、宿、宝箱、セーブ、遭遇）。`RPG.debug` に試し用の入口。
- `battle.js` … 横から見た戦闘。絵は 1152x648（960x540 を 1.2 倍引いた広さ。ドットの大きさはフィールドと同じ）、エフェクトと数字は上のなめらかなキャンバス。
- `pad.js` … コントローラー。割り当ては前作（`chronicle/v2/src/core/input.js`）と同じ: 右ボタン = 決定、下ボタン = もどる（押しながら移動で走る）、
  上ボタン / Start = メニュー、L = リピートの入り切り、R = 戦闘の速さ（通常 → ＋1 → ＋2 → ＋4）。キー入力に変換するだけ。
  キーボードも前作と同じ: Z / Enter 決定、X / Backspace もどる（押しながら走る。Shift でも走る）、C / Tab メニュー、Q / E = L / R。
  設定メニューに「常にダッシュ」（オンだと押している間だけ歩く）と「決定ボタンの位置」（右 / 下）。使っている間は画面のキー表示もボタン名になる。
- 買い物、装備、道具、満タンは前作（`chronicle/v2/src/screens/shop.js`, `equip.js`, `items.js`, `systems/party.js`）と同じ流れと言葉:
  店は L / R でタブ（武器 / 防具 / 道具 / 売る）、右に数値と「仲間が付けると」（▲▼）、個数の窓、買った直後の「今すぐ装備する？」。
  装備は候補を強い順、「いまの装備と比べる」、X ボタン（キーは V）で「いちばん強く」。メニューで X ボタン = 「満タン」（術が先、足りなければ確認して道具）。
  まだ無いもの: 並べ替え、「装備できる物だけ」、まとめ売り。
- `sound.js` … 曲（`bgm/<id>.ogg` と、ループ位置の `<id>.json`）と、合成の効果音。
- `game.js`, `hd.js`, `party/` … `../site/` への symlink（フィールドのエンジンと HD-2D 表示、4 人の絵）。
- `village/`, `f01/`, `abbey/` … マップ。`map.json` は `build/slice/make_maps.py` が `places.json` から書く。

## 作り方

1. 骨組み: `build/blockout/village_world.py | field01_world.py | cliff_world.py <bake_dir>`
2. 塗り: `build/img.py build/blockout/prompts/paint_<map>.txt p.png --size <1.5倍> --quality high --image guide_15.png --image styleref.png`
   （`guide_15.png` = `guide.png` を最近傍で 1.5 倍、`styleref.png` = 村の絵）。1x へは BOX で縮小。
3. 位置合わせと配置: `match.py <bake>/guide.png paint_1x.png pts.npy 128` → `stage.py <bake> paint_1x.png pts.npy slice/<map>`
4. 自動チェック: `prompts/mask_<map>.txt` でマスクを作り 1x に縮小 → `match.py slice/<map>/st_paint.png m_1x.png pts_mask.npy 128`
   → `check.py slice/<map> paint_1x.png m_1x.png pts_mask.npy report.jpg adopt` → `build/slice/fix_raised.py slice/<map> tops`
   （`tops` は立っている物の上の縁を絵の輪郭まで上げ、煙突の口などの暗い欠けを閉じる。重ねがけしない。一度だけ）
5. 横の面と屋根の裏: `build/blockout/solids.py <world_module> <bake_dir> pts.npy slice/<map>` → `slice/<map>/solid.txt`
   （絵は南から見た面しか持たないので、家や塀の東西の面と、屋根の向こう側の斜面をブロックから起こす。これが無いと、
   横に回ったとき家が立て看板に見える。中身は base64 のテキスト。公開先がバイナリのファイルを配らないため）
6. `build/slice/make_maps.py [village] [f01] [abbey]`（`solid.txt` があれば `hd.solid` と `hd.grow` を書く。`PULL = 1.2` が画面の引き）
7. 絵の部品: `build/slice/gen_art.py`（魔物、村人、宝箱、結晶、戦闘の背景）→ `build/slice/make_sprites.py raw_dir slice`
   魔物は一度描いたあと `gen_art.py` の `flat()` で 4 人の絵を手本に描き直す（面で塗り、輪郭をはっきり。点描にしない）。
   `make_sprites.py` は `<name>_flat.png` があればそちらを使う。
   魔物は `crisp()` を通す（体を先に決め、輪郭を 1 ドットの閉じた線で引き直す。生成画は画面のドットより細かいので、そのまま縮めると輪郭が点々になる）。
8. 目立たせたい物（宝箱、セーブ結晶）は prop に `glow: {c, r, a, sparks, up}` と `bob`（`make_maps.py` の `CHEST`、`abbey_map.py` の結晶）。開けた宝箱は光らない。
   敵に会うまでの歩数は `map.json` の `encounter.steps`（平均。毎回 0.6〜1.4 倍、歩きは 0.8 歩ぶん。前作と同じ決め方。1 歩 = 36 ドット）。

## 試し方

`python3 -m http.server` を `slice/` で起動して `index.html` を開く。`?hd=0&q=low` で軽い 2D 表示、`?enc=0` で遭遇なし、`?map=f01/map.json` で始めるマップ、
`?solid=0` で横の面なし、`?hdshow=solid` で横の面だけ、`?dof=0` でぼかしなし。
自動の通し確認は `build/slice/test/`（`node play.js <url> walkthrough.js` など。Playwright）。`shop_equip.js` = 店、装備、満タン。`reach.js` = 歩いて届く宝箱と人の一覧
（麦の丘の岩棚の宝箱 ch015 だけは下から届かないのが正しい。修道院の崩れた階段から降りる）。

## 公開

`python3 build/publish.py slice/index.html <out>/index.html` のあと、`slice/` の中身（`.npy`, `st_paint.png`, `places.json`, `check.json` 以外。symlink は実体）を
同じフォルダにコピーして、そのフォルダを root にして Artifact に出す。配られるのは画像、音、`.js`、`.json`、`.txt` などだけ（`.bin` は出せない）。
