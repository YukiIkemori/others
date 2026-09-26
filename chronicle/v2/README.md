# ルミナス・クロニクル 〜八つの灯火〜 v2

v2 はほぼゼロからの作り直し（BRIEF A24）。正本は `chronicle/design/build/V2_PLAN.md`。今のゲーム（`chronicle/src` → `chronicle/dist`）はそのまま残り、v2 はそれを**読むだけ**。

## 段階の状態
- **P0（骨組みと契約）**: 済み。`core/*` は本物、ほかの担当の契約はすべて `src/core/stubs/*` の**仮の実装**（色の箱・素の文字・一本道のマップ・1 行で勝つ戦闘）で埋まっている。
  起動 → タイトル → 歩く → 話す → 戦う → メニュー → セーブ → つづきから が仮の実装だけで通る（`tools/test_core_flow.js`）。
- 仮の実装は `R.Stubs.install()` が「本物がまだ無い名前だけ」を埋める。本物のファイルを置けば同じ名前の仮は使われなくなる（一部だけ本物でもよい）。どの仮が呼ばれたかは `R.Stubs.report()`。

## 動かし方（`chronicle/` から）
```sh
node v2/tools/build.js                 # v2/dist/index.html（遊ぶ用）と dev.html（dev とフィクスチャ入り）。媒体は dist/bgm・voice・portraits に写す
node v2/tools/build.js --single        # 媒体を全部埋め込んだ 1 枚の index.html（オーナーに渡す版。約 24 MB）
node v2/tools/build.js --check         # 構文だけ
node v2/tools/test_core.js [--single]  # CORE の node のテスト（fit の表・入力・セーブ・合言葉・音・契約・ビルド）
node v2/tools/test_core_flow.js --build   # ブラウザで通し（16:9 とスマホ縦）。スクショは v2/design/shots/core/
node v2/tools/qa/perf.js               # 性能（CPU 1 倍と 4 倍、3 回の中央値 → v2/design/perf/<日付>.json）
node v2/tools/port/diff.js             # 移植の元（今の木）が P0 の写しから変わったか
```
- 外に置いた媒体は `file://` では読めない（ブラウザの制限）。`shot.js` と `test_core_flow.js` は手元だけの http（127.0.0.1）で開く。`--single` の版は `file://` でもそのまま鳴る。どの版も実行時に外へ通信しない。
- 書体: Zen Maru Gothic（Medium/Bold）を使う字だけ `pyftsubset` で切り出して埋め込み、Cinzel（英字）はそのまま埋め込む。どちらも OFL（`assets/fonts/OFL_*.txt`）。
- BGM は既定で縦切りの 17 曲だけ（`--all-bgm` で全部）。顔絵は `chronicle/design/portraits/manifest.json` で approved の物だけ（`--portraits all|none`）。

## node で読む
```js
const R = require('./v2/tools/lib/load')({quiet: true});        // DOM なし。仮の実装を埋め、データの後処理まで
const R2 = require('./v2/tools/lib/load')({dev: true, fixtures: true});   // R.Dev とフィクスチャも
R.Contract.check('map', R.DB.maps.stub_road)                        // → {ok, errors}
R.Contract.checkAll()                                               // §2.5 の全部の名前がそろっているか
```

## スクショ（`v2/tools/shot.js`）
```sh
node v2/tools/shot.js --query "fixture=core_stub_road" --out x.png                 # 1920x1080（既定）
node v2/tools/shot.js --phone --query "fixture=core_stub_road" --touch "stick:right:600,tap:y" --out p.png
node v2/tools/shot.js --html v2/dist/index.html --keys "a,wait:300,a" --time 1000 --out t.png
```
`--size WxH`・`--phone`（390×844 DPR 3）・`--phone-land`・`--keys`（a b x y l r start up down left right dash、`hold:<b>:<ms>`、`wait:<ms>`、`<b>*<n>`）・
`--touch`（`tap:a|b|y`、`tap:<x>:<y>`（論理座標）、`long:<x>:<y>`、`stick:<dir>:<ms>`、`hold:<b>:<ms>`、`wait:<ms>`）・`--until <式>`・`--eval <式>`・`--wait <ms>`・`--shot`/`--out`・`--canvas`・`--time <ms>`（撮るときだけ `R.Engine.time` を固定）・`--cpu <倍>`。
コンソールのエラー・`R.loadErrors`・`R.Engine.error`・外への通信があれば終了コード 1。**撮った PNG は必ず見る**（§2.9）。

## フィクスチャ（§2.6.7）
- 状態: `tools/fixtures/states/<担当>_<名前>.json` = `{desc, hero:{type,sex,name}, party, reserve, tier, gl:{id:n}|'auto', prof:'auto', flags, vars, items, gold, leads, map:{id, spawn}}`
  → `dev.html?fixture=<名前>`（`R.Dev.fixture(name)`。'auto' は `R.Growth.glAt`・`R.Rules.profAt`）
- 場面: `tools/fixtures/scenes/<担当>_<名前>.json` = `{scene:'battle'|'screen'|'map'|'event', state?, setup?, id?, params?, map?, spawn?, event?}` → `dev.html?scene=<名前>`
- 例: `core_stub_road`（状態）、`core_battle`・`core_menu`（場面）。ファイル名は担当の接頭辞で始める（`field_`・`menus_`…）。
- `node v2/tools/build.js --with <dir>` で `<dir>/states|scenes/*.json` と `<dir>/*.js` を足した `dev_<dir>.html` を作る。

## 約束（全員）
- ファイルは「登録だけ」の IIFE。読み込み時に `document` に触れない。ほかのファイルの物は関数の中でだけ読む。
- 時間は `R.Engine.time`・`R.wait(ms)`（`setTimeout` を使わない）。乱数は `R.rng(seed)`（文字列のキーでもよい）。
- 契約（`src/core/contracts.js`、`R.Contract.VERSION`）を変えるのはリードだけ。P1 の間は足すだけ。
- 自分のファイルだけを書く。ほかの担当への依頼は `design/requests.jsonl` に 1 行、報告は `design/reports.jsonl` に 1 行（書き直さない・消さない）。
- API キー・モデルの識別子をファイルに書かない。`chronicle/src`・`chronicle/tools` と `/home/user/others/rpg/` は編集しない。git は使わない。
