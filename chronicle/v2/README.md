# ルミナス・クロニクル 〜八つの灯火〜 v2

v2 はほぼゼロからの作り直し（BRIEF A24）。正本は `chronicle/design/build/V2_PLAN.md`。今のゲーム（`chronicle/src` → `chronicle/dist`）はそのまま残り、v2 はそれを**読むだけ**。

## 段階の状態
- **P0（骨組みと契約）**: 済み。`core/*` は本物、ほかの担当の契約はすべて `src/core/stubs/*` の**仮の実装**（色の箱・素の文字・一本道のマップ・1 行で勝つ戦闘）で埋まっている。
  起動 → タイトル → 歩く → 話す → 戦う → メニュー → セーブ → つづきから が仮の実装だけで通る（`tools/test_core_flow.js`）。
- 仮の実装は `R.Stubs.install()` が「本物がまだ無い名前だけ」を埋める。本物のファイルを置けば同じ名前の仮は使われなくなる（一部だけ本物でもよい）。どの仮が呼ばれたかは `R.Stubs.report()`。
  名前空間を**全部**本物にしたら、そのファイルの先頭で `R.Stubs.claim('<名前空間>')`（仮の関数どうしは中の状態を共有するので、混ぜたままにしない）。
- **P0 のレビュー（契約の版 2）**: 済み。14 担当の質問を先に決めて契約に足した（名前は 1 つも変えていない）。決めたことの一覧は `V2_PLAN.md` §2.11、形は `src/core/contracts.js`、
  確かめは `tools/test_core_contract.js`（node）と `tools/test_core_wipe.js`（ブラウザ）。**下の「担当ごとの ここから始める」から読む**。

- **P2（組み込み）**: 進行中。全部の名前空間が本物（`R.Stubs.claim` 済み。仮で残るのは id が `stub_` のデータだけ）。契約は**版 3**（ICONS `water`・`K.setup` の `retry/seed`・`K.lore`・`K.chronicleEntry`・`zones[].cond`）。
  `test_core_flow.js` は本物の序章（幕 → ベルナ → 主人公の作成 → 書見台のベルナ → 本物の戦闘 → セーブ → つづきから）を通し、仮の関数が 1 回も呼ばれないことも確かめる。

## 動かし方（`chronicle/` から）
```sh
node v2/tools/build.js                 # v2/dist/index.html（遊ぶ用）と dev.html（dev とフィクスチャ入り）。媒体は dist/bgm・voice・portraits に写す
node v2/tools/build.js --single        # 媒体を全部埋め込んだ 1 枚の index.html（オーナーに渡す版。約 24 MB）
node v2/tools/build.js --check         # 構文だけ
node v2/tools/test_core.js [--single]  # CORE の node のテスト（fit の表・入力・セーブ・合言葉・音・契約・ビルド）
node v2/tools/test_core_flow.js --build   # ブラウザで通し（16:9 とスマホ縦）。スクショは v2/design/shots/core/
node v2/tools/test_core_contract.js    # 契約の版 2 で足した物（MapUtil・claim・全快の 3 つ・gain・isNew・finish・焼く列・セーブの拒否）
node v2/tools/test_core_wipe.js        # 全滅の「宿から」「タイトルへ」の片付けと不変条件（ブラウザ。lib/browser.js の見本）
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

## 担当ごとの ここから始める（P1。V2_PLAN §4.1・§4.4・§2.11）

### 全員の手順（最初の 1 時間）
1. `V2_PLAN.md` の §2（とくに §2.5 の自分の契約・§2.11 の決定）と §4.1 の自分の行、§4.4 の自分の行を読む。
2. `src/core/contracts.js` の自分の名前（`R.Contract.API` の名前空間、`K.*` の形）と、自分の仮の実装（下の表）を読む。**仮の実装が「今の答え」**: 形・呼ばれ方・引数は仮と同じにする。
3. `node v2/tools/build.js && node v2/tools/test_core_contract.js && node v2/tools/test_core_flow.js` が通ることを確かめてから始める。
4. ファイルは §4.1 の自分の持ち分だけに作る。1 つの名前空間を複数のファイルで作るときは `const X = (R.X = R.X || {})`。全部本物にしたら `R.Stubs.claim('X')`。
5. テストは `tools/test_<担当>*.js`（node は `lib/load.js`＋`lib/testkit.js`、ブラウザは `lib/browser.js`）。自分の返す物は必ず `R.Contract.check(kind, obj)` を通す。
6. フィクスチャは `tools/fixtures/states|scenes/<担当>_<名前>.json`、スクショは `design/shots/<担当>/`（1920×1080 と `--phone`）。**撮った PNG は必ず Read で見る**。
7. 質問・依頼は `design/requests.jsonl` に 1 行（`{from, to, file, what, why}`）、毎日の報告は `design/reports.jsonl` に 1 行（§4.5）。ほかの担当が「空の登録」を頼んだ id は、その日のうちに置く。
8. G1（P1 の 2 日目の終わり）の性能の報告は `R.Hd.BUDGET` の値と比べる（desk ／ CPU 4 倍）。

| 担当 | 置き換える仮の実装 | 名前空間（`R.Contract.API`） |
|---|---|---|
| RENDER | `stubs/stub_render.js` | `Hd` `Light` `Post` `Sky` |
| UIK | `stubs/stub_uik.js` | `UIK` `UIK.Message` |
| CAST | `stubs/stub_art.js` の `Portrait`（絵のキーは仮なし＝`R.Hd.has` が false のとき呼ぶ側が箱） | `Portrait`、キー `hd:field/btl/face` |
| BEAST | （仮なし。`R.Hd.has` false で呼ぶ側が箱） | キー `hd:mon/boss/bbg` |
| TERRAIN | `stubs/stub_art.js` の `Terrain`・素材と物の仮の一覧 | `Terrain`、キー `hd:bld/prop/secret`、`R.DB.materials/props` |
| FIELD | `stubs/stub_field.js` | `Field` `Field.camera` `Field.hud` `Field.encounter` |
| EVENTS | `stubs/stub_events.js`（と `stub_data.js` の `config`） | `State` `Events` `Leads` `Mini` `Tier`、`ev` |
| RULES | `stubs/stub_rules.js` | `Rules` `Growth` `Glimmer` `Party` |
| BATTLE | `stubs/stub_battle.js` の `Mon` `BattleCore` `BattleAI`（と `stub_data.js` の `tr_stub` など） | `Mon` `BattleCore` `BattleAI`、戦闘の 1 回（`battle`） |
| BSCENE | `stubs/stub_battle.js` の `Battle` | `Battle`、キー `hd:bfx` |
| MENUS | `stubs/stub_screens.js` | `Screens`（`SCREEN_IDS`・`SCREEN_RESULTS`） |
| CONTENT-P・F | `stubs/stub_data.js` の `stub_road` など（id が `stub_` の物は使わない） | `R.DB.maps/events/leads/locations/regions/letters` |

### RENDER（`src/render/*`、`tools/hd_*.js`）
- **作る**: `rz.js`（`design/art_proto/code/raster.js` から、`R.Hd.RZ`、`ctx.filter` なし）`hd.js`（def/get/now/want/has/draw/pin/stats/kindOf/track）`bake.js`（焼く列: `pump`・`schedule`、1 フレーム 3 ms）`cache.js`（種類ごとの上限と LRU、`BUDGET.mb`）`blur.js` `mood.js`（`R.Contract.MOODS` の 9 つすべて）`light.js` `post.js` `sky.js`（`at(0..8)`）`style.js`（`STYLE`・`BUDGET`。仮の `BUDGET` の値を写して始める）。
- **決まり**: `get` は焼けていなければ null を返して列へ。`factory` が null を返したら覚えずに後でまた（原画の画像待ち）。`pump` は CORE が毎フレーム呼ぶ（自分で呼ばない）。`quality()` は設定 `fx` と自動の下げの低い方（設定は書き換えない）。`draw` の `(x, y)` は描く点、`(ox, oy)` はコマの中の描く点、`flip` は描く点を軸に。
- **テスト**: `test_render*.js` — 同じキーで同じ画素、上限と `pin`、`pump` が 3 ms を超えない、`schedule` の仕事が prio の順、`kindOf`・`track`・`stats` の形（`K.hdStats`）、`mood` がすべて `K.mood`。
- **撮る**: 光の地図（灯り 10 個）、3 つの mood、仕上げの有無（`design/shots/render/`）。`hd_sheet.js --area <…>` は dev.html を `lib/browser.js` で開いて撮る形でよい。

### UIK（`src/uik/*`、`tools/uik_sheet.js`）
- **作る**: §2.3 の 12 ファイル（`design/art_proto/ui/kit.js` から。DOM に触るのはキャンバスを作る所だけ）。`T` は `K.uikTokens` の名前を残す（値は変えてよい）。アイコンは `R.Contract.ICONS` の全部。
- **決まり**: uiScale の掛け方は §2.11（primitive は掛けた後の px、`List`・`Message`・`toast`・`bubble`・`prompts`・`chip` は中で掛ける。`R.UIK.u(v)`）。`List({rows:[{label, disabled?, value}], rowH, cols, render, onSelect(row,i), onCancel, onFocus, onDetail, tall})`、cols > 1 は ←→。`Layer` は `open()/close()`（Promise）と `k`（0〜1）。`Message.say` は `K.say`、前の say を先に解決、送ると `R.Audio.stopVoice()`、下キーでも送る、`caption(text, {ms})`、ログ（X）・自動送り（Y、「オート」と書かない）・早送り（R）。`toast` の anchor は `'bl'`（システム）と `'tr'`（入手）。`snapshot()` はメニューを開いた時に 1 回、1/4 のぼかし（`R.Hd.blur`）の canvas か null。場面の id は `message`・`caption`。
- **テスト**: `test_uik*.js` — `measure` のはみ出し（最長の名前・999/999）、List のスクロール・cols・マウスとタッチの当たり、Message の早送り・選択肢・cancel・連続 say、uiScale 1.0/1.3。
- **撮る**: `uik_sheet.js`（kit.png と並べる）、会話の 16:9 とスマホ縦。

### CAST（`src/art/rig/*`・`src/art/cast/*`・`tools/portraits.js`・`v2/assets/sprites/*`・`chronicle/design/sprite_pipe/*`）
- **作る**: `looks_hero.js`・`looks_party.js`・`looks_npc.js`（`R.DB.looks`、`K.look`、§2.6.2 の id の一覧すべて）、`portrait.js`（`R.Portrait`。仮の `stub_art.js` の `Portrait` と同じ順: 描いた顔 → `hd:face` → 無し）、`battler.js`・`fieldchar.js`・`faces.js`（`hd:btl:<look>:<wtype>`・`hd:field:<look>`・`hd:face:<look>`）、仮の絵の骨組み（`rig/*`）、`tools/portraits.js`（§6.3、`--dry-run` まで）。
- **キャラの絵（A34・A35）**: 原画はオーナーが用意する。取り込み工程の出力を `v2/assets/sprites/<look>/{field,battle,face}.png`＋同じ名前の `.json`（`{cell:[w,h], anchor:[x,y], poses:{name:[i…]}, fps:{}}`）に置くと、ビルドが `RPG_MEDIA.sprites['<look>:<kind>']` にする。`R.onBoot(async () => { await R.Media.preload('sprites'); … })` で読み終えてから、その look の `hd:*` を画像から登録。原画の無い look は仮の絵。アルンの設定資料は `hero_m_warrior`、今ある `design/sprite_pipe/out/arun/` から最初の 1 人を作る。表情の対応: normal→neutral・smile→smile・serious→angry・big→surprise（sad は neutral）。
- **決まり**: 戦闘の絵は出撃中の 4 人の今の武器だけ焼いて `R.Hd.pin`。ポーズの名前は §2.5.7 の表のとおり。
- **テスト**: `test_cast*.js` — 全 look が `K.look`、主色の色相の差、`R.Portrait.parse`、原画のある look の `hd:*` が `K.sheet`（ブラウザ）。**撮る**: 30 人 × 4 方向、戦闘のポーズ、仮の顔（`design/shots/cast/`）。

### BEAST（`src/art/mons/*`・`src/art/boss/*`・`src/art/bbg/*`）
- **作る**: 縦切りの sprite の id（魔物データの `sprite` のまま）: `jelly_1 jelly_2 rat_1 rat_2 seabird_1 seabird_2 crab_1 crab_2 bat_1 bat_2 bee_1 bee_2 mushroom_1 mushroom_2 plant_1 plant_2 fairy_1 fairy_2 wolf_1 wolf_2 treant_1 treant_2`、レア `rare_hare rare_fawn rare_acorn`、ボス `hd:boss:boss_pageeater`・`boss_moth`・`boss_rooteater`・`boss_wolflord`、根の子分 `hd:mon:b_root`、背景 `hd:bbg:coast tower forest tree cave`。
- **決まり**: 右向き。`opts {golden}` で金色を焼く。描く点は足元の中央、`anchors` に `center` `fx`（当たる所）`head`。背景は opts `{w, h}` で焼き `K.bbgSheet`（meta.mood は `MOODS` から）。
- **テスト**: `test_beast*.js`（ブラウザで焼いて `K.sheet`・`K.bbgSheet`、純黒 0、大きさの段）。**撮る**: 11 土台 × 段 × 3 mood、ボスの待機と `tele`、背景 5 に 4 人と敵を置いた見本。

### TERRAIN（`src/art/terrain/*`）
- **作る**: `materials.js`（`R.Terrain.material(id)` と `R.DB.materials[id]`（`K.materialDef`）。**仮の一覧の id（`stub_art.js` の `MATS`）を 1 日目に全部本物で登録**）、`props.js`（`hd:prop:<id>` と `R.DB.props[id]` = meta（`K.propDef`）。仮の `PROPS` の id を全部）、`dualgrid.js` `rise.js` `water.js` `world.js`（`worldThumb`）`buildings.js`（`building(def) → key`）`props_light.js` `chunks.js`（`bakeChunk` → `K.bakeJob`、`result` は `K.chunkResult`）。
- **決まり**: マスは `R.MapUtil.cell/grid` で読む（tilePatches も隠し通路も）。`state = {grid, chests, lit, lamps, secrets}`。座標はマップの論理 px、`base/over` は `CHUNK × tile` 四方。テーマは `map.theme`（`THEMES`）か、無ければ kind と素材から決める。見つける前の隠し通路は周りの壁と同じ画素（`check_secrets`）。
- **テスト**: `test_terrain*.js` — 16 通りの境、チャンクの境、`Job.step` ≤ 3 ms、チャンク 1 つの焼き時間、`dirty` で 1 つだけ、meta。**撮る**: テーマ 7 × 1 画面、宝箱 × 8 種の床、泉・燭台・灯籠（`design/shots/terrain/`）。

### FIELD（`src/systems/field/*`）
- **作る**: §2.3 の 11 ファイル。`R.Field.scene`（id `field`、opaque）を持つ。
- **決まり**: マスの読み方は `R.MapUtil`（自前で読まない。フラグが変わったら `invalidate`）。チャンクは `R.Hd.schedule` に積み、量は `R.Hd.track('chunk', …)`。`R.Post.frame` は draw の最後・HUD の前。ハブの結果 `{warp}/{escape}/{title}` は閉じた後に動く。`on:'enter'` のトリガーは入るたび（once で 1 回）。`lastTown` は `K.place`。`R.Game.steps` を数える。`R.Mon.encounter(zone, {tier, dark: R.MapUtil.darkAt(…), steps, ward})`。戦闘の `'abort'` では何もしない（片付けは `R.Flow.wipe`）。宝箱 `R.Rules.chestLoot`＋`R.State.gain`、泉 `R.Party.restoreAll`、隠し通路は入った瞬間、ワープの一覧 `R.Game.warps`、新しい話 `R.Events.isNew`。仮の `stub_field.js` がこの順番の見本。
- **テスト**: `test_field*.js`（§4.4 の全項目。不変条件は `lib/browser.js` の `invariants`）。**撮る**: ファロス・フェルン・迷いの森（暗がり）・ワールド・灯台 × 3 つの大きさ × 広さ 3 段（地図ができるまでは自分のフィクスチャのマップで）。

### EVENTS（`src/systems/{state,events_runtime,leads,minigame,tier}.js`・`src/data/{items_key,config}.js`・`tools/lib/cond.js`）
- **作る**: `R.State`（`newGame/serialize/deserialize/wipeRecover/check/setHero/blankChar/gain`、`K.game`）、`R.Events`（`run/busy/abort/talk/isNew/makeEv`）と `ev` の全部（`OBJ_API.ev`）、`R.Leads`（`K.leadState`、`got` は playMs）、`R.Mini`、`R.Tier`（`effective()` は縦切りでは `get()` と同じ）、`config.js`（`start = {map:'roa_house', spawn:<C-P が決める>, event:'roa_house_intro'}`・`slice:true`）。
- **決まり**: `ev.inn`・`ev.letter`・`ev.caption`・話者の名前と顔の決め方・`ev.battle` の abort は §2.11 と仮の `stub_events.js` のとおり。E17: `'inn'` と町の `'map:enter'` で `R.Tier.pending()` があれば `story_t<N>` を走らせる（走っているイベントがあれば終わった後）。once の記録は `flags['ev_<id>']`、トリガーの once は `flags['tr_<map>_<id>']`（FIELD）。`tools/lib/cond.js` は `R.State.check` と同じ答え（node で同じ関数を読む形がよい）。
- **テスト**: `test_events*.js` — `ev` の全関数、条件、手がかり帳、pendingTier、clearRegion、セーブの往復。**撮る**: 手がかり帳の通知・歌あわせ・地方の解決の演出。

### RULES（`src/systems/{rules,growth,glimmer,party}.js`・`src/data/*`（§4.1）・`tools/port/*`・`tools/sim_*`）
- **作る**: 移植の元は `tools/port/manifest.json` の自分の行（P0 のハッシュ）。`port_items.js` で品を移し、**`slot`（weapon/shield/head/body/hands/feet/acc/use/key）と `wtype` に分ける**（`K.item`。`icon` は `R.Contract.ICONS` の名前へ）。`R.Rules.stats` は `K.stats` の名前、`K` に `SLOTS WTYPES ELEMENTS ABILS`。`R.Party.makeChar/restoreAll/heal/fullHeal`（§2.11 の全快の 3 つ）、`R.Rules.chestLoot`（`p_T` は開けた時のティア、`p_rare` はレアの箱）、`fillItem(item, {tier})`、店 `R.DB.shops`（`K.shop`、§3.7 の 5 つの id）。
- **テスト**: `test_rules*.js`（STATS_REWORK §6.4、全品が `K.item`、全店の品が有る）、sim は `lib/party_model.js` からゲームの `R.Growth.glAt`・`R.Rules.profAt` を呼ぶ。**撮る**: 装備と店の数字（MENUS の画面ができてから）。

### BATTLE（`src/systems/{battle_core,mon,battle_ai}.js`・`src/data/{monsters_*,…}.js`・`tools/sim_{zones,bosses,loot}.js`）
- **作る**: `R.Mon.encounter(zone, {tier, dark, steps, ward})` → `K.setup` | null（`ward` の判断はここ）。`R.BattleCore.create(setup)` の戦闘の 1 回（`OBJ_API.battle`: `escape`・`finish` を含む）。魔物のデータは `K.monster`（`size` は `'s'|'m'|'l'` のまま、`sprite` は BEAST のキー）、ボス `K.boss`、編成 `K.troop`、unit は `K.unit`（敵の `boss`・`golden`、味方の `look`）。出来事は `R.Contract.BATTLE_EVENTS`。
- **決まり**: `B.finish()` が 1 回だけ `R.Game` に写す（お金・`R.State.gain`・図鑑・`R.Growth.afterBattle`・熟練・HP/MP）。NEW は `R.Game.seenSkill`。乱数は `R.Game.seed`（戦闘は `seed + retry`）。
- **テスト**: `test_battle*.js`（STATS_REWORK §7.6・§8.7・§9.7、全出来事が `check('battleEvent')`）、sim の 3 本立て。**見る**: 出来事の列の書き出し。

### BSCENE（`src/systems/battle/*`・`src/art/fx/*`）
- **作る**: `R.Battle.start(setup)`（場面 id `battle`、opaque）。順番は仮の `stub_battle.js` の `start` と同じ: `setup.boss` なら `autosave('boss')` → `checkpoint('battle', {setup, seed})` → `'battle:start'` → `pushBgm` → `touchLayout('battle')` → …… → over で `B.finish()` → 場面を外す → `popBgm` → `'battle:end'` → 勝ちは `autosave('battle')` → 全滅の宿は `wipeRecover()`＋`await R.Flow.wipe('inn')`、タイトルは `await R.Flow.wipe('title')` → 解決。直前の戦闘からは `R.Save.restore('battle')` と同じ setup・`seed + retry`。`canLose` は全滅の画面なしで `'lose'`。
- **決まり**: 絵のキーは unit から（味方 `hd:btl:<look>:<wtype>`、敵 `boss ? hd:boss : hd:mon`）。`R.Post.frame` を draw の最後に。倍速は設定 `battleSpeed`、カーソル記憶は `R.Game.battle.cursor`。
- **テスト**: `test_bscene*.js`（全出来事の種類を流して止まらない、最短の表示時間、全滅の 3 択の後の不変条件を `lib/browser.js` で）。**撮る**: §4.4 の BSCENE の行 × 16:9・縦・横。

### MENUS（`src/screens/*`）
- **作る**: `R.Screens.open(id, params)` の全画面（`R.Contract.SCREEN_IDS`、`'letter'` を含む）。結果の形は `R.Contract.SCREEN_RESULTS`。場面の id は `screen:<id>`、開くとき `R.Input.touchLayout('menu')`。説明の札の中身は `R.DB.tips`（`K.tip`、MENUS が書く）。
- **決まり**: ハブはワープ・脱出・タイトルを自分で呼ばず結果で返す。宿は `{stay}` だけ。満タンは `R.Party.fullHeal({dry:true})` で見込み → 確かめ → `fullHeal()` → `K.fullHealResult` を 1 枚に。仲間選びは id の配列を返す（加入は `ev.chooseCompanions`）。設定は `R.Settings.CHOICES`。表示してはいけない文字（§3.11）。
- **テスト**: `test_screens*.js`（開く・閉じる・B・L/R・タッチの当たり・結果の形）。**撮る**: §3.11 の全画面 × 2 つの大きさ（`scene` のフィクスチャ `menus_<画面>.json` で 1 枚ずつ開ける）。

### CONTENT-P・CONTENT-F（`src/maps/*`・`src/events/*`・`src/data/{regions,locations}.js`（P）・`tools/gen_world.js`（P））
- **作る**: §3.2 の自分のマップ（`R.def('maps', id, {…})` で `K.map`。legend は `K.legendEntry`、素材の id は `R.DB.materials`、物は `R.DB.props`、隠し通路は `{mat:<壁>, solid:true, secret:true, floor:<床>}`、`theme` は `THEMES`）、§3.3 のイベント（`K.event`、`meta.needs/gives`）、手がかり `R.DB.leads`（`K.lead`）、手紙 `R.DB.letters`（`K.letter`）。C-P は `story_t1`（E17 で EVENTS が呼ぶ）と `roa_house_intro`（`ev.createHero()` を呼ぶ）と `config.start` の spawn の名前を EVENTS に知らせる。
- **決まり**: onEnter は `triggers: [{id, on:'enter', event, once}]`（範囲なし）。NPC の名前は `npc.name`（無ければ look の名前）、顔は `face:'look:expr'`（書かなければ顔のある look は自動）。ボイスは `ev.say(who, text, {voice:'v_…'})`（文面は 1 字も変えない）。見た目・素材・物・編成・品が足りなければ出す側に依頼し、返事を待たずに id で書いてよい（仮の実装は知らない id でも色の箱で動く）。
- **テスト**: `test_content_p*.js`・`test_content_f*.js`（全マップ・全イベントが `check`、自分の範囲の到達）。**撮る**: 自分の全マップを 1 画面ずつ（`states/content_p_<名前>.json` で好きな場所から開く）、全イベントの会話の 1 枚目。
