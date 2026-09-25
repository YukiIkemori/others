# 01 エンジン・アーキテクチャ・API・状態スキーマ・担当表（DESIGN.md 用ドラフト）

この章は、約20人の実装担当が話し合わずに並列で作業するための**共通の約束**を決める。
中身の数値（成長曲線、ダメージ式、閃き確率、ドロップ率、ティア倍率など）と、コンテンツ（キャラ・技・術・装備・魔物・地方・物語）は各章が決める。
この章が決めるのは、**それらを載せる器**（ファイル・ロード順・API・状態の形・ID・担当）である。

- 「実装済み」と書いた項目は、`chronicle/src` の実コードを読んで確認した事実。行番号は現時点のフォークのもの。
- 「既定値」と書いた数値は仮置き。担当章が別の値を決めたらそちらを正とする（APIの形は変えない）。
- 「Phase 0」と書いた項目は、並列作業の開始前に lead（コア担当）が入れる小さな変更。

---------------------------------------------------------------------------------------------------
## 0. Part B からの変更・具体化（理由つき）

| # | 決定 | 理由 |
|---|---|---|
| 0.1 | 仲間は `R.Game.party`（出撃中の CharState 配列、先頭から隊列順、主人公を必ず含む、1〜4人）と `R.Game.reserve`（控えの CharState 配列）に分けて持つ。未加入の候補は状態を持たない。 | クレスト由来のコード（戦闘・フィールド・メニュー・セーブ）は `R.Game.party` の配列を前提にしている。オブジェクトは必ずどちらか一方の配列にだけ入れるので、JSON 複製しても同一性が崩れない。 |
| 0.2 | 技・術・敵の行動は、1つのレジストリ `R.DB.actions` に入れる。id の接頭辞で区別する（技 `t_`、術 `s_`、敵 `e_`/`eb_`）。 | 戦闘エンジンはクレストの `DB.abilities` 1本を前提に書かれているので、置き換えが機械的に済む。技の書・術の書・AI・検証ツールも1か所を見ればよい。 |
| 0.3 | ティアは `R.Game.regionsCleared`（クリア順の配列）から導く。`R.Game.tier` はその長さのキャッシュで、読み込み時に計算し直す。 | 二重管理による食い違いを防ぐ。 |
| 0.4 | 雑魚は「系統参照 `@<lineageId>`」で書き、戦闘開始時にティアからその系統の段階を選ぶ。ボス・レア魔物・イベント敵は `scale:'tier'` で能力値をティア倍率で伸ばす。 | どの順番で地方を回っても強さが崩れない（Part A）。魔物の定義数も増やさずに済む。 |
| 0.5 | 閃きは RS2 と同じく「その行動の置き換え」とする。閃いた技・術をその場で、WP/MP を消費せずに使う。 | ピコーン → 技名 → 実際の効果、とつながるので手応えが出る。 |
| 0.6 | 主人公の作成はプロローグのイベント内で行う（`ev.createHero()`）。タイトルで「はじめから」を選ぶと、既定の主人公で新規ゲームが始まり、オープニングの語り → 作成画面、の順に進む。 | 語り部の導入を作成画面より先に見せられる。タイトル側の処理は単純なまま。 |
| 0.7 | データの後処理フック `R.onData(fn)` を新設する（Phase 0）。 | node ツール（tools/lib/load.js）では `R.onBoot` が実行されない。派生データを onBoot で作ると、ツールとゲームで中身が食い違う。 |
| 0.8 | 全滅したときの戻り先「直前の町」: 町・城・村のマップに入るたびに、フィールドが自動で `R.Game.respawn` を更新する。 | クレストではコンテンツ側（story.js）でやっていて、書き忘れが起きやすかった。 |
| 0.9 | 復活の呪文の接頭辞を `LC1:` から `CH1:` に変える（Phase 0）。 | 現状はクレストと同じ接頭辞なので、クレストの呪文が読めてしまい、壊れたデータになる。 |
| 0.10 | 酒場（入れ替え画面）で出撃メンバーに入った仲間は全回復する（既定値）。 | 「管理はシンプルに」。控えの HP 管理をなくす。 |

---------------------------------------------------------------------------------------------------
## 1. 技術規約

### 1.1 実行環境
- 素の JavaScript。依存なし、実行時の通信なし。ES2020 まで使ってよい（`?.` `??` 可）。ES modules・`import`/`export`・トップレベル await は使わない。
- 対象ブラウザ: Chrome/Edge、Safari（iOS 15 以降）、Firefox。PC・スマホ（タッチ）・ゲームパッド。
- 論理画面 256×224（`R.W`/`R.H`）、`R.SCALE = 3`（実キャンバス 768×672）、60fps 固定ステップ。
- タイル 16×16。フィールドの人物 16×24（足元をタイルにそろえ、上の 8px は上のマスにはみ出す）。
- フォントは DotGothic16（OFL）。`R.Gfx.FS = 32/3 ≈ 10.67px`、行の高さ `R.Gfx.LH = 14`。全角1文字 ≈ 10.67px、半角 ≈ 5.33px。

### 1.2 ファイル規約（全員に適用）
1. すべてのファイルを IIFE で包む: `(function (R) { 'use strict'; … })(window.RPG);`
2. **読み込み時にしてよいのは「登録」だけ**:
   `Object.assign(R.DB.items, {...})`、`R.Gfx.def(key, factory)`、`R.MySystem = {...}`（または `Object.assign(R.X = R.X || {}, …)`）、`R.onData(fn)`、`R.onBoot(fn)`。
   次のことは禁止する: DOM に触れる、他モジュールの実行時状態を読む、他ファイルのデータを読む、同じディレクトリ内のロード順に頼る。
3. 他ファイルのデータから作る派生データ（例: 全魔物の金色版の登録、宝箱プールの自動生成）は `R.onData(fn)` の中で作る（§2.9 C3）。
   onData はブラウザでもノードでも、全ファイルを読み込んだ後に一度だけ実行される。DOM を使ってはいけない。
   実行時の結線（イベントバスの購読など）は `R.onBoot(fn)` に書く（ブラウザのみ、フォント読み込み後、タイトル表示の前に実行）。
4. `R.DB.<registry>` は ns.js が作る（§2.1）。自分の担当の id だけを Object.assign で登録し、他人の id を上書きしない。
5. **他モジュールが未完成でも落ちない**ように書く。`R.Glimmer && R.Glimmer.roll(...)` のように存在を確かめてから呼ぶ。未知の id は `R.warn` して読み飛ばす。並列開発中は他人のデータが空のことがある。
6. DOM に触れてよいのは次のファイルだけ: `core/input.js`（タッチパッド）、`core/audio.js`、`core/gfx.js`（canvas）、`main.js`、`systems/menu_save.js`（呪文入力のオーバーレイ）、`systems/nameentry.js`（キーボード入力のオーバーレイ）。それ以外は node ツールから読まれるので DOM 禁止。
7. 乱数は `R.U` の関数だけを使う（`Math.random` の直接呼び出しは禁止）。`R.U.seed(n)` で再現できるようにするため。
8. 待ち時間はフレーム単位（`await R.Engine.wait(n)`）で書く。`setTimeout` はコア以外で使わない。
9. スタイル: インデント2スペース、セミコロンあり、シングルクォート、小さな関数。コメントは必要な所だけ書く（日本語でも英語でもよい）。
10. id は ASCII の `snake_case`。表示名は日本語。表記は STYLE_JA（漢字かなまじり、難しい漢字はひらく、DQ 式の分かち書きはしない）。
11. 画面に出す日本語は**ソースに直接書く**。ビルドはソース中に現れる文字だけをフォントに埋め込むので、文字コード計算で作った文字は表示されない。
12. 名前の直書き禁止: 主人公の名前は `{hero}`。その場の先頭の人は `{leader}`。仲間の名前は固定なので直書きしてよいが、「出撃中とは限らない」ことに注意する（§2.5）。

### 1.3 ロード順（tools/build.js と tools/lib/load.js で確認）
```
src/core → src/ui → src/data → src/art → src/audio → src/maps → src/events → src/systems → src/main.js
```
- core の中は `ns.js, input.js, gfx.js, engine.js, save.js` の順（CORE_FIRST）、残り（`audio.js`）はアルファベット順。
- 各ディレクトリはサブディレクトリまで再帰し、パスの `localeCompare` 順に読む（例: `src/maps/region1_town.js` < `src/maps/region2_…`）。
- `main.js` は最後。**node ローダーは main.js を読まない**ので、`R.boot()` も onBoot も node では実行されない。
- ロード順に頼るコードは書かない（1.2-2）。

### 1.4 ビルド
- `node tools/build.js` → `dist/index.html`（1ファイルにまとまった完成品）と `debug.html`（ファイルごとに読み込むので、エラーの行番号が読める）。
  `node tools/build.js --check` は構文チェックだけを行う（エラーがあれば exit 1）。
- 構文エラーのあるファイルは警告を出して**除外**される（他人が編集中の壊れたファイルで全員のビルドが止まらないように）。各ファイルは try/catch で包まれ、読み込み時の例外は `RPG.loadErrors` に記録される。
- フォント: `pyftsubset`（fonttools）で、ソース中に出てくる文字だけの woff2 を作って埋め込む。
  **現在の環境には fonttools が入っていない**ので、Google Fonts へのリンクに落ちている。これは「実行時通信なし」に反し、オフラインのスクショでは字形も変わる。
  → Phase 0 で lead が `pip install fonttools brotli` を行う（pip で取得できることは確認済み）。
- `dist/` と `debug.html` は生成物で、誰の担当でもない（誰が作り直してもよい）。
- Phase 0（lead）: build.js の HTML タイトルが `'ルミナス・クレスト'` に固定されているので直す。オプション `--with <dir>` を足す（§2.9 C6）。

### 1.5 スクショ（tools/shot.js、実装済み）
Playwright + Chromium で `file://` のページを開き、キャンバスだけを PNG に保存する。オプションは書いた順に実行される。
```
--html <file>   読むページ（既定 dist/index.html。行番号つきのエラーが欲しいときは debug.html）
--query <qs>    ?qs を付ける（debug=1 でマップ id と座標を表示）
--wait <ms>     待つ（ページ読み込み後、最初に 1500ms 待つ）
--eval <js>     ページ内で JS を評価する（await 可、結果を表示）
--keys <seq>    キー列。カンマ区切り: up/down/left/right/a/b/dash（約2フレーム押す）、hold:<btn>:<ms>、wait:<ms>、<btn>*<n>
--shot <file>   その時点で撮る   --out <file>  最後に撮る   --full  ページ全体   --size WxH（既定 800x700）   --touch  スマホ縦画面
```
- キーの割り当ては a=Z、b=X、dash=Shift。1回の押下は 50ms 押して、90ms 待つ。
- console.error、pageerror、`RPG.loadErrors` があると exit 1。**撮った PNG は必ず Read ツールで目で見て確かめる。**
- 定番の手順:
  `node tools/build.js && node tools/shot.js --html debug.html --eval "RPG.debug.quickStart({tier:3})" --wait 600 --keys "b,wait:300" --out /tmp/menu.png`
- フレーム単位で制御したいとき: `RPG.Engine.paused = true; RPG.Engine.step(); RPG.Engine.render();`。
  早送りは `RPG.Engine.speed = 4`（1描画あたりのシミュレーション回数）。ボタンを直接押すには `RPG.Input._set('a', true)`。

### 1.6 node ローダー（tools/lib/load.js、実装済み）
```js
const R = require('./tools/lib/load')({ quiet: true });            // extra:[path…] は Phase 0 で追加（fixture の読み込み）
```
- core〜systems をブラウザと同じ順に vm で読み込む。window = サンドボックスで、document は無い。localStorage と getGamepads はスタブ。
- art の factory は登録されるが、呼ぶと落ちる（canvas が無いため）。`R.Gfx.textWidth` も使えない。幅の見積もりには `R.Text.approxWidth(s)` を使う（Phase 0 で追加）。
- 読み込み時のエラーは `R._nodeLoadErrors` に入る。Phase 0 以降は、最後に `R.runDataHooks()` が実行される。
- テストは `tools/test_<area>.js`（失敗なら exit 1）。テスト用のデータは `tools/fixtures/<area>/` に置く。**src/ にテスト用のデータを置かない。**

### 1.7 表示名の長さ上限（validate が検査する）
全角1文字 ≈ 10.67px で計算する（半角は 0.5 文字分）。

| 対象 | 上限（全角換算） | 根拠 |
|---|---|---|
| 主人公の名前 | 5 | 戦闘ステータス窓（幅61px、名前は枠の上に載せる） |
| 仲間の名前 | 5 | 同上 |
| 技・術の名前 | 8 | 戦闘の2列リスト（名前＋消費量） |
| アイテムの名前 | 9 | 装備・店のリスト |
| 魔物の名前 | 8（「金色の」で +3、Ａ〜Ｈの記号で +1 になる） | 戦闘の敵リスト。はみ出す分は横に縮めて描く |
| 地方・町・ダンジョンの名前 | 10 | 入ったときの名前表示、セーブ欄 |
| 技・術・アイテムの `desc` | 技・術 20、アイテム 40（2行） | 戦闘のヘルプ欄は1行、メニューは2行 |
| メッセージの1行 | 20 | メッセージ窓の文字領域は 220px（§2.5） |

---------------------------------------------------------------------------------------------------
## 2. コアランタイム API（実装済み・lead 担当）

### 2.1 名前空間 `R`（src/core/ns.js）
- 定数: `R.VERSION`、`R.TITLE`、`R.W=256`、`R.H=224`、`R.TILE=16`、`R.SCALE=3`、`R.FPS=60`。
- `R.DB.*`: データレジストリ。ns.js が作る。
- `R.U`（ユーティリティ）:
  - 乱数: `rng`、`seed(n)`、`unseed()`、`r()`（[0,1)）、`rf(a,b)`、`ri(a,b)`（両端を含む）、`chance(p)`、`oneIn(n)`、`pick(arr)`、`shuffle(arr)`、`weighted(arr, key='w')`
  - 数値・複製: `clamp`、`lerp`、`clone`（JSON）
  - 向き: `DIRS`、`DX`、`DY`、`opposite(d)`
  - 表示: `padL`、`num`、`playTime(frames)`（"h:mm"）
- イベントバス: `R.on(name, fn)`、`R.off`、`R.emit(name, ...args)`（リスナーの例外は握りつぶして console.error に出す）。
- `R.warn(...)`。
- 音の安全ラッパー: `R.sfx(id)`、`R.bgm(id, opts)`、`await R.jingle(id)`。音のモジュールが無くても動く。
- `R.onBoot(fn)`、`R.loadErrors`。

**Phase 0 の変更（C1）**
- `R.TITLE = 'ルミナス・クロニクル'`。追加: `R.SUBTITLE`（物語章で確定。案は「〜八つの伝承〜」）、`R.COPYRIGHT = '© Studio Metem'`、`R.VERSION = '0.1.0'`、`R.PARTY_MAX = 4`。
- `R.onData(fn)` と `R.runDataHooks()` を追加する（1回だけ実行。各 fn の例外は `R.loadErrors` に記録）。
- レジストリの一覧を差し替える（`jobs`、`abilities`、`chars` は削除）:
  `tiles legends themes decor config heroTypes companions weaponTypes elements statuses actions items pools shops monsters lineages encounters troops rareEncounters regions locations objectives maps events music sfx battlebg`

### 2.2 Engine と Layer（src/core/engine.js）
画面に出るものはすべて `R.Layer` で、`R.Engine.layers` に下から積む。
- `update()`: **一番上のレイヤーだけ**、毎フレーム呼ばれる。入力はここで読む。
- `tick()`: **全レイヤー**で毎フレーム呼ばれる。背景アニメ専用で、入力は読まない。
- `draw()`: `opaque = true` の最も上のレイヤーから上へ順に描く。
- `onPush()` / `onRemove()`。
- `close(value)`: レイヤーを外し、`R.Input.consume()`（押したボタンが下のレイヤーに漏れないように）を呼び、`await R.Engine.run(layer)` を value で解決する。

`R.Engine` の API:
- レイヤー操作: `push(layer)`、`remove(layer)`、`top()`、`run(layer)` → Promise、`clear()`
- 待ち・画面効果: `wait(frames)`、`fade(to, frames=20, color='#000')`、`fadeOut(f)`、`fadeIn(f)`、`shake(frames, mag)`、`flashScreen(color, frames)`
- 状態: `frame`（起動からのフレーム数）、`speed`（テスト用の早送り）、`paused`、`error`
- テストと手動制御: `step()` と `render()`（テストから呼べる）、`reportError(e)`（画面の隅に 10 秒表示して続行する）
- 描画順: 背景 → 各レイヤー → フラッシュ → フェード → エラー表示。

### 2.3 入力（src/core/input.js）
仮想ボタンは `up down left right a b dash` の7つ。
- キーボード: 矢印/WASD、**A = Z / Enter / Space**、**B = X / Esc / Backspace**、dash = Shift（押している間だけ、「常にダッシュ」を反転する）。
- ゲームパッド（標準マッピング）:
  - 方向: 十字キー（ボタン 12〜15）と左スティック（しきい値 0.5）
  - **決定は右のボタン（ボタン1 = ○ / 任天堂 A）が初期値**。`R.Settings.padConfirm = 'bottom'` にすると下のボタン（ボタン0）が決定になる。もう一方のボタンとスタート（ボタン9）がキャンセル。
  - dash: ボタン2 または R1（ボタン5）
- タッチ: DOM のタッチパッド（十字キーと A/B）。十字キーは中心からの角度で判定するので、指を滑らせて使える。A/B は離すまで押しっぱなし扱い。キャンバスをタップすると音の初期化だけが行われる（A ボタン扱いにはならない）。表示の有無は `Settings.touchPad`（auto/on/off）と `R.applyTouchSetting()` で決まる。
- API: `down(b)`、`pressed(b)`（押した瞬間）、`repeat(b)`（押した瞬間と押しっぱなしのリピート: 16フレーム後から4フレームごと）、`released(b)`、`dir()`（最後に押した方向）、`dirRepeat()`、`consume()`、`enabled`、`onAnyPress(cb)`、`_set(b, v)`（テスト用）。
- DOM の入力欄（名前入力・呪文入力）でのキー入力はゲームに届かない。
- 操作の約束: **フィールド**は A = 話す・調べる・開ける、B = メニュー。**メニュー**は A = 決定、B = 戻る。**戦闘**は、オート中に B でオート解除。
- 変更なし。

### 2.4 グラフィックス（src/core/gfx.js）
座標はすべて論理ピクセル。
- 描画プリミティブ: `clear`、`rect`、`strokeRect`、`draw(img, x, y, {flip, alpha, sx, sy, sw, sh, w, h})`、`drawTinted(img, x, y, color, amount)`
- 文字: `text(str, x, y, {color, size, align, shadow, alpha})`（左上基準。str には `R.Text.fmt` が自動でかかる）、`textWidth(str, size)`、`wrap(str, width, size)`（1文字単位で折り返し、行頭の禁則あり）、`font(size)`
- 窓と飾り: `window(x, y, w, h, {theme, alpha, title})`、`cursor(x, y, blink)`、`moreArrow`、`bar`
- 定数: 色 `C`（`white gray dark black red orange yellow green cyan blue purple pink gold hpLow dead`）、`WINDOW_THEMES`（black/blue/green/red）
- スプライト登録: `def(key, factory)`、`has(key)`、`get(key)`（遅延生成してキャッシュ。未登録ならマゼンタの仮画像を出し、警告は1回だけ）、`variant(key, {hue, sat, bri, pal})`（色違いをキャッシュ）
- 絵を作る道具:
  - `fromGrid(rows, pal)`
  - `pix(w, h)` → Pix: `set rect hline vline ellipse circle shadeEllipse line poly grid mirrorX outline replace each blit toCanvas`
  - 色操作: `recolor`、`mapColors`、`hsvShift`、`flipH`、`shade`、`ramp`、`mix`、`hexToRgb`、`rgbToHex`
  - その他: `makeCanvas`、`placeholder`

**Phase 0 の変更（C4）**
- `variant(key, {tint:'#rrggbb', tintAmt:0..1})` を追加する。明るさを保ったまま単色に寄せる。金色の個体に `tint:'#ffd24a'` で使う。
- `C.rare = '#ffd24a'` と `C.super = '#ff9cf0'` を追加する（レア・超レアの表示色）。

### 2.5 UI（src/ui/ui.js）
**メッセージ窓**: `MSG = {x:8, y:148, w:240, h:72, lines:4, pad:10}` なので、文字の幅は 220px（全角約20文字）× 4行で1ページになる。
- `await R.UI.say(text, {keep, noWait, pos:'bottom'|'top'|'middle', auto:frames, speed:0..3})`
  - `\n` で改行、`\f` で改ページ。長い文は自動で折り返し、ページを分ける。
  - `keep:true` なら窓を開いたままにして、次の say に続ける。`R.UI.closeMessage()` で閉じる。
- `await R.UI.choose(items, {x, y, w, cols, rows, title, initial, cancel, onChange})` → 選んだ番号。キャンセルなら −1。既定の位置はメッセージ窓の右上。
- `await R.UI.yesno(text, opts)` → bool（窓は開いたまま残る）。
- `await R.UI.number({min, max, initial, label, price, x, y, w})` → 数値、または −1。
- `await R.UI.notice(text, frames=70)`。
- `new R.UI.List({x, y, w, items, rows, cols, lineH=14, cancel, window, title, wrap, padX, padY, colW, onChange, drawItem})`
  - `update()` は `'select' | 'cancel' | 'move' | null` を返す。`draw()`。
  - items は文字列、または `{label, disabled, right, color}`。1列のリストでは左右キーでページ送りになる。

**文字の置き換え `R.Text`（Phase 0 で差し替え、C5）**
`R.Gfx.text`、`textWidth`、`wrap`、すべてのメッセージ窓と戦闘メッセージに自動でかかる。
| 書き方 | 置き換え後 |
|---|---|
| `{hero}` | 主人公の名前（`R.State.hero().name`。ゲームが無いときは `DB.config.defaultHero.name`） |
| `{leader}` | 出撃中で生きている先頭の人の名前（全滅中なら主人公） |
| `{g:男形\|女形}` | 主人公の性別で選ぶ（例: `{g:坊や\|お嬢さん}`） |
- クレストの `{yuki}` `{non}` `{metem}` は削除する。
- 追加: `R.Text.approxWidth(s)`（canvas 不要の幅見積もり。全角 32/3px、半角 16/3px。node ツール用）。

### 2.6 セーブと設定（src/core/save.js）
**スロット**: 3つ。localStorage の接頭辞は `luminous_chronicle_`（設定済み）。保存先は差し替えられる（既定は localStorage で、メモリにも写す）。
- `R.Save.list()` → `[{slot, summary} | null, …]`
- `load(slot)`、`save(slot, data)`、`remove(slot)`、`lastSlot`
- `exportCode(data)`、`importCode(str)`（復活の呪文。deflate-raw ＋ base64）
- すべて async。

**`R.Settings`**（`R.Save.loadSettings()` / `saveSettings()`。`R.DEFAULT_SETTINGS` あり）:
| キー | 既定値 | 意味 |
|---|---|---|
| `msgSpeed` | 2 | 文字の速さ 0 遅い / 1 ふつう / 2 速い / 3 一瞬 |
| `battleSpeed` | 1 | 戦闘の速さ 0 / 1 / 2 |
| `bgmVolume` | 0.6 | BGM の音量 |
| `sfxVolume` | 0.7 | 効果音の音量 |
| `alwaysDash` | true | 常にダッシュ（Shift で反転） |
| `windowColor` | `'black'` | 窓の色 black / blue / green / red |
| `touchPad` | `'auto'` | タッチパッド auto / on / off |
| `cursorMemory` | true | 戦闘コマンドのカーソルを記憶する |
| `padConfirm` | `'right'` | ゲームパッドの決定ボタン 右 / 下 |
| `autoKeep` | true | オート継続: 一度オートにしたら、次のランダム戦闘もオートで始まる |

**Phase 0 の変更（C2）**: 呪文の接頭辞を `CH1:`（圧縮）/ `CH0:` にする。`LC0/LC1` は読まない（クレスト用なので）。

### 2.7 音（src/core/audio.js、担当は audio）
- `R.Audio.init()`: 最初のユーザー操作で AudioContext を作る。main.js が呼ぶ。
- BGM: `playBGM(id, {fade})`（同じ id が鳴っていれば何もしない）、`stopBGM(f)`、`pushBGM(id)` / `popBGM()`（戦闘用。元の曲を途中から再開する）、`current`。
- `await playJingle(id)`: BGM を止めて単発で鳴らし、終わったら BGM に戻る。
- `sfx(id)`、`setVolumes(bgm, sfx)`。
- ツール用: `debug()`、`info(id)`、`renderTrack`、`renderSfx`、`renderNote`（tools/render_audio.js が使う）。
- 曲のデータは `R.DB.music`、効果音は `R.DB.sfx`。それ以外の担当は安全ラッパー `R.sfx` / `R.bgm` / `R.jingle` だけを使う。id の一覧は §3.3。

### 2.8 起動（src/main.js）
起動の順番:
1. 設定を読む
2. 入力を初期化する（タッチパッドもここで作る）
3. 画面を合わせる（fit）
4. `Engine.start`
5. フォントを最大 2.5 秒待つ
6. 最初の操作で音を初期化するよう登録する
7. **（Phase 0 で追加）`R.runDataHooks()`**
8. onBoot の各フックを順に await する
9. `R.Title.start()`（タイトルが無ければ仮の画面）
10. `R.emit('booted')`

### 2.9 Phase 0 のコア変更の一覧（lead が並列作業の前に入れる）
| # | ファイル | 変更 |
|---|---|---|
| C1 | ns.js | タイトル・定数・レジストリ一覧・`onData`/`runDataHooks`（§2.1） |
| C2 | save.js | 呪文の接頭辞を `CH1:`/`CH0:` に（§2.6） |
| C3 | main.js、tools/lib/load.js | `R.runDataHooks()` を呼ぶ（ブラウザでは起動時、ノードでは読み込み後） |
| C4 | gfx.js | `variant` の `tint` と、色 `C.rare`/`C.super`（§2.4） |
| C5 | ui.js | `R.Text` の置き換え（§2.5）と `approxWidth` |
| C6 | build.js | HTML タイトル、`--with <dir>` オプション（`<dir>/*.js` を src の後、main.js の前に足した `debug_<dirの名前>.html` を出す） |
| C7 | tools/lib/load.js | `opts.extra: [paths]`（fixture を最後に読む）と `runDataHooks` |
| C8 | 環境 | `pip install fonttools brotli`（フォントの埋め込みを有効にする） |
| C9 | DESIGN.md | この章の ID 一覧（§3）を DESIGN.md に写す。各章の ID 一覧（技・術・装備・魔物・地方）も並列作業の前に確定させる |

---------------------------------------------------------------------------------------------------
## 3. 共有 ID・グラフィックスのキー・音の id・命名規約

### 3.1 全章で共通の ID（この表が正）
| 種類 | id（この順番を正式な並び順とする） | 表示名 |
|---|---|---|
| 能力値（固定、装備で増える） | `str vit dex agi int mnd` | 腕力 体力 器用さ 素早さ 知力 精神 |
| 成長する最大値 | `hp mp wp` | 最大HP 最大MP 最大WP |
| 装備枠 | `weapon1 weapon2 shield head body hands feet acc1 acc2` | 武器1 武器2 盾 頭 体 手 足 アクセ1 アクセ2 |
| アイテムの種別 `type` | `weapon shield head body hands feet acc consumable key` | 武器 盾 頭 体 手 足 アクセサリ 道具 大事なもの |
| 武器系統 `wtype`（11） | `sword greatsword dagger axe spear bow club staff katana fist whip` | 剣 大剣 短剣 斧 槍 弓 棍棒 杖 刀 体術 鞭 |
| 両手持ちの既定 | `greatsword spear bow` が両手。ほかは片手（アイテム個別の `twoHanded` で上書きできる） | |
| 中列から届く系統 | `spear bow whip`（技ごとの `reach` で上書きできる） | |
| 術の属性（6） | `fire water wind earth light dark` | 火 水 風 土 光 闇 |
| 2属性の組の id | 正式な並び順で小さい方を先にして `_` でつなぐ（例: `fire_wind`、`water_light`）。全15組 | |
| 3属性の組の id | 同様に3つ（例: `fire_wind_light`）。全20組 | |
| レア度 `grade` | `normal rare super` | 通常 レア 超レア |
| 隊列 `row` | `front middle` | 前列 中列 |
| 行動の種類 `kind` | `tech spell enemy` | 技 術 （敵の行動） |
| 状態異常（案。戦闘章・術章で確定） | `poison sleep paralyze confuse silence blind freeze burn death` と、良い状態の `regen` | 毒 眠り 麻痺 混乱 沈黙 暗闇 凍結 やけど 即死 再生 |
| 強化・弱体の対象（案） | `atk def mag mdef agi`（段階は −2〜+2） | 攻撃 守り 術の威力 術の守り 素早さ |
| 対象 `target` | `enemy enemies group random ally allies self ally_dead ally_any`（クレストと同じ。戦闘章で追加してよい） | |
| 効果 `effects[].type` | `damage heal healMp healWp revive cure status buff dispel steal scan escape regen grow teleport exit encounter special` | |

- 戦闘での消費は、技が WP、術が MP。術には `magic:true` を付ける（沈黙で封じられる）。
- `grow` は `hp mp wp` の上限ボーナスにだけ使える（能力値は固定なので、上がる道具は作らない）。
- `encounter` はクレストの `repel` を置き換えるもので、`{pct:-100|-50|+100, steps}`（魔除け・誘い寄せ）。

### 3.2 グラフィックスのキー（`R.Gfx.get(key)`）
| キー | 返すもの | 担当 |
|---|---|---|
| `tile:<id>` / `tile:<theme>:<id>` | 16×16 の canvas。アニメするタイルは canvas の配列 | art-tiles |
| `decor:<id>` | 16×16（`tall` なら 16×32 まで、足元そろえ） | art-tiles |
| `bbg:<id>` | 256×144 の戦闘背景。魔物の足元は y≈124〜132 | art-tiles |
| `party:<spriteId>` | `{down:[f0,f1], up, left, right}`。各コマ 16×24 | art-chars |
| `face:<spriteId>` | 32×32 の顔（任意）。無ければ UI は `party:` を2倍で描く | art-chars |
| `npc:<type>` | party と同じ形式 | art-chars |
| `obj:<name>` | `chest`（[閉, 開]）、`chest_rare`（[閉, 開]）、`sparkle`（4コマ）、`shadow`、`glimmer`（閃きの電球 16×16×2コマ）、`quill`（語り部の羽ペン 16×16）、`ship`（使う場合だけ） | art-chars |
| `icon:<id>` | 8×8。武器系統11種（`icon:<wtype>`）、`shield head body hands feet acc herb potion key`、属性 `el_fire el_water el_wind el_earth el_light el_dark` | art-chars |
| `mon:<spriteId>` | 魔物の canvas（32/48/64 の正方形、ボスは〜128×112）。中央に置いて、下の行を足元とする | art-mons / art-boss |

**spriteId の規則**
- 主人公は `hero_<m|f>_<heroTypeId>`。仲間は companion の id（`DB.companions[id].sprite` で上書きできる）。
- キーは `R.Party.spriteKey(c)` で作る。自分で組み立てない。

**魔物の絵**
- 系統ごとの色違いは、魔物データの `hue/sat/bri/pal` で指定し、`R.Gfx.variant` で描く。
- パーツ替えの派生は、art-mons が**別の spriteId として登録**する（例: `goblin_helm`）。登録する spriteId の一覧は、モンスター章の系統表に書き、データ担当と絵担当の両方がそれに従う。
- 金色の個体は `variant(key, {tint:'#ffd24a'})` で描く。

### 3.3 BGM・ジングル・効果音の id
**BGM**
- クレストから持ち越す（曲調は作り直してよい）: `title overworld sea town village castle shrine dungeon cave tower pyramid ice volcano lastdungeon battle boss lastboss ending`
- 新しく作る（必須）: `tavern`（酒場）、`home`（故郷）、`rival`（ライバル）、`tension`（緊迫した場面）、`sorrow`（悲しい場面）、`boss2`（地方ボス用のもう1曲）、`rarebattle`（レア魔物・金色の個体との戦闘）、`superboss`（裏ボス）、`postgame`（裏ダンジョン）
- 地方ごとの町やダンジョンの曲は、上の id から選ぶ（新しい id を増やす場合は audio 担当に依頼する）。

**ジングル**
- 持ち越し: `victory levelup item keyitem inn save gameover rare`（`jobup` は使わない）
- 新しく作る: `superrare`（超レアを手に入れた）、`chapter`（年代記に章が記される＝地方クリア）、`recruit`（仲間が加わる）

**効果音**
- 持ち越し: `cursor confirm confirm_soft cancel buzzer menu_open attack hit crit miss enemy_attack hurt magic fire ice thunder wind holy dark earth water heal revive buff debuff status poison sleep death enemy_die boss_die escape stairs door locked chest item gold step_damage ship bump warp teleport steal jump breath roar shake`
- 新しく作る: `glimmer`（ピコーン）、`light`（光の術。無ければ `holy` で代用）、`freeze`、`burn`、`quill`（ペンで書く音）、`page`（本をめくる音）、`swap`（入れ替え）、`golden`（金色の個体の出現）

### 3.4 命名規約（id）
| 対象 | 規則 | 例 |
|---|---|---|
| 技 | `t_<wtype>_<名前>` | `t_sword_rising` |
| 術 | `s_<名前>`。合成術も同じ | `s_fire_1`、`s_blizzard` |
| 敵の行動 | 雑魚用は `e_<名前>`（担当 mons）、ボス・レア魔物専用は `eb_<名前>`（担当 boss） | `e_bite`、`eb_quake` |
| アイテム | 武器 `w_<wtype>_<名前>`、盾 `sh_`、頭 `hd_`、体 `bd_`、手 `hn_`、足 `ft_`、アクセサリ `ac_`、道具 `i_`、大事なもの `k_` | `w_katana_moon`、`i_herb` |
| 魔物 | 雑魚は `<lineage>_<段階番号 1..5>`、レア魔物は `rm_<名前>`、ボスは `b_<名前>` | `wolf_3`、`rm_prism`、`b_rival1` |
| 系統 | `<名前>`（snake_case） | `wolf` |
| 敵の編成 | `tr_<名前>` | `tr_b_rival1` |
| 出現ゾーン | `z_<regionId>_<名前>`、ワールドは `zw_<名前>` | `z_r3_cave1` |
| 宝箱のプール | `p_<名前>` | `p_weapon`、`p_heal` |
| 店 | `<locationId>_<item|weapon|armor|magic>` | `r3town_weapon` |
| 地方 | `<名前>`（ワールド章が決める） | |
| マップ | 町は場所の名前、ダンジョンの階は `<ダンジョン>_<n>`、ワールドは `world` | |
| イベント | `<マップid>_<名前>`、物語の共通イベントは `story_<名前>` | |
| 宝箱 | **必ず明示的に一意な id を付ける**（`<マップid>_c<n>`）。マーク文字の自動採番はセーブを壊すので使わない | `r3cave_1_c2` |
| フラグ | snake_case。自動で立つもの: `cleared_<regionId>`（R.Tier.clear）、`joined_<companionId>`（R.Party.recruit）、`game_clear`（エンディング）、`hero_created`（ev.createHero） | |
| 変数（vars） | `<地方か担当>_<名前>` | |
| 目的 | `obj_<名前>` | |

---------------------------------------------------------------------------------------------------
## 4. 状態スキーマ `R.Game`

### 4.1 トップレベル（R.State.newGame が作る。セーブは `R.U.clone(R.Game)`）
| キー | 型・既定値 | 意味 |
|---|---|---|
| `game` | `'chronicle'` | セーブの目印 |
| `version` | `R.VERSION` | |
| `party` | CharState[]（1〜4人） | 出撃メンバー。隊列順で、主人公（`id:'hero'`）を必ず含む |
| `reserve` | CharState[] | 控え（加入した順） |
| `tier` | 0 | = `regionsCleared.length`（0〜8）。キャッシュ |
| `regionsCleared` | `[]` | クリアした地方の id（クリア順） |
| `gameClear` | false | エンディングを見た（クリア後の要素が解放される）。同時にフラグ `game_clear` も立つ |
| `clearCount` | 0 | クリアした回数 |
| `flags` | `{}` | name → true |
| `vars` | `{}` | name → number |
| `objective` | `DB.config.startObjective` | 全体の「次の目的」（`DB.objectives` の id） |
| `regionObj` | `{}` | regionId → objectiveId（年代記の画面に出す、地方ごとの目的） |
| `gold` | `DB.config.startGold` | 所持金 |
| `inv` | `{}` | itemId → 個数（1〜99）。**装備中の品は含まない** |
| `chests` | `{}` | chestId → `{item, n}` または `{gold}`（開けた時点の中身） |
| `visited` | `{}` | locationId → true（ワープ先の一覧） |
| `book` | `{mon:{}, tech:{}, spell:{}}` | 図鑑・技の書・術の書（下の表） |
| `pos` | `{map, x, y, dir, spawn}` | 現在地 |
| `respawn` | `{map, spawn}` または `{map, x, y, dir}` | 全滅したときの戻り先 |
| `encItem` | `null` または `{id, pct, steps}` | 魔除け・誘い寄せ（出現率の倍率と残り歩数） |
| `ship`, `onShip` | `null`, false | クレストの船。エンジンに残すが、ワールド章が使うと決めない限り使わない |
| `steps`, `playFrames`, `battles`, `wins`, `escapes` | 0 | 記録。`playFrames` はフィールドのレイヤーが存在する間に加算される |
| `records` | `{glimmers, rareDrops, superDrops, goldens, rareMons}` 全部 0 | 記録の画面用 |
| `title` | `''` | 称号（クリア後の要素で使う場合） |

**`book`（図鑑・技の書・術の書）**
```
book.mon[monId]   = { seen:n, kills:n, gold:n (倒した金色の個体の数), drop:bool, rare:bool, sr:bool (超レア) }
book.tech[techId]  = [charId, …]   // 閃いた人（パーティを離れても残る）
book.spell[spellId]= [charId, …]
```
- 未発見の技・術・ドロップは「？？？」と表示する。
- 金色の個体は、元の魔物の id で記録する。

### 4.2 CharState（主人公と、加入した仲間）
```js
{
  id: 'hero' | '<companionId>',
  name: '…',               // 主人公はプレイヤーが決めた名前、仲間は DB の名前を写したもの（表示には必ず c.name を使う）
  gender: 'm' | 'f',
  heroType: '<heroTypeId>',            // 主人公だけ
  favor: { kind: 'weapon' | 'element', id: '<wtype|element>' },   // 主人公だけ（得意な武器系統・得意な属性）
  level: 1, exp: 0,
  hp, mp, wp,              // 現在値。最大値は R.Rules.stats(c).hp/mp/wp（level とボーナスから導く）
  bonus: { hp: 0, mp: 0, wp: 0 },     // 道具（grow）で増えた上限
  status: {},              // 戦闘の外まで持ち越す状態だけ（既定では poison だけ）。hp=0 が戦闘不能
  equip: { weapon1, weapon2, shield, head, body, hands, feet, acc1, acc2 },   // itemId | null。9つのキーは常にある
  wprof: { sword: 0, …11系統すべて },   // 武器系統の熟練度（ポイント。段階は R.Rules.profRank）
  eprof: { fire: 0, …6属性すべて },     // 属性の熟練度（同上）
  techs: [ '<t_…>', … ],   // 覚えた技（閃いた順）
  spells: [ '<s_…>', … ],  // 覚えた術（閃いた順）
  row: 'front' | 'middle',
  mem: { cmd: 0, list: {}, item: 0, target: null },   // 戦闘コマンドの記憶（list のキー: 'weapon1' 'weapon2' 'spell'）
  joined: { tier: 0, frame: 0 },   // 加入した時点（主人公は 0）
  counts: { battles: 0, kills: 0, glimmers: 0 },
}
```
- 能力値（`str…mnd`）と得手不得手は**保存しない**。毎回 `DB.heroTypes`/`DB.companions` から導く（バランス調整が古いセーブにも反映されるように）。
  主人公だけは、`heroType` と `favor` から導く。
- 最大 HP/MP/WP も保存しない（level から導く）。レベルアップの増分は、上がる前と後の `stats()` の差で出す。

### 4.3 条件式 `R.State.check(cond)`（NPC・宝箱・tilePatches・イベントの `cond`）
クレストと同じ書き方: `'flag'`、`'!flag'`、配列（すべて満たす）、`{flag, notFlag, item, notItem, all:[…], any:[…]}`。
**新しく加えるキー**（1つのオブジェクトに複数書くと、すべてを満たすときに真）:
| キー | 真になる条件 |
|---|---|
| `tier: n` | `R.Game.tier >= n` |
| `tierBelow: n` | `R.Game.tier < n` |
| `cleared: regionId` / `notCleared: regionId` | その地方をクリアした / していない |
| `member: companionId` | その仲間が出撃中 |
| `recruited: companionId` | その仲間が加入済み（出撃中か控え） |
| `hero: 'm' \| 'f'` | 主人公の性別 |
| `heroType: id` | 主人公のタイプ |
| `var: name, gte?: n, lt?: n, eq?: n` | 変数の比較 |
| `postgame: true` | `R.Game.gameClear` |
- tools/progress.js と各 check ツールの中の check のコピーも、同じ規則で実装する。tools/lib に共有の実装を置く（担当 qa）。

### 4.4 NPC の台詞をティアで変える（データだけで書ける）
`npc.text` と `sign.text` には次のどれかを書ける（R.Events.talk が解釈する。担当 field）:
- 文字列: `\f` でページを区切る
- 文字列の配列: 順にページとして表示する
- **`{cond, text}` の配列**: 上から見て、最初に cond を満たしたものの text を表示する。cond を書かないものは常に真なので、最後に置くと既定の台詞になる
```js
text: [
  { cond: { tier: 6 }, text: '伝承が戻ってきている。{hero}のおかげだね。' },
  { cond: { cleared: 'r_desert' }, text: '砂漠の道がまた通れるようになったそうだ。' },
  { text: '近ごろ、昔話を思い出せないんだ。' },
]
```
配列の最初の要素の型（文字列か、オブジェクトか）で、どちらの形かを判断する。

### 4.5 保存と読み込み（R.State.serialize / deserialize）
```js
serialize() → { v: 1, kind: 'chronicle',
  summary: { hero, level, names: ['名前 Lv', …(出撃中)], place, time, gold, tier, clear },
  game: R.U.clone(R.Game) }
```
`deserialize(data)` の処理:
1. `kind !== 'chronicle'` なら拒否して false を返す。
2. 足りないトップレベルのキーは、**R.Game を変えずに作った**新しいひな形から補う。
3. 存在しない id を掃除する: `inv`、装備、`techs`/`spells`、`book`。
4. 各 CharState の装備9枠と熟練度のキーを補う。
5. `tier = regionsCleared.length` を計算し直す。
6. hp/mp/wp を最大値の範囲に収める。
7. `R.Battle.autoCarry = false`。

### 4.6 いつも成り立つこと（不変条件）
- `party` は1〜4人で、`id:'hero'` を必ず1人含む。同じ id が `party` と `reserve` の両方に入ることはない。
- 装備中の品は `inv` に含まれない。装備を外すと `inv` に戻る（99個を超える分は捨てずに、外す操作そのものを断る）。
- `tier === regionsCleared.length`、`gameClear === flags.game_clear`。
- 戦闘の外では、`status` に残る状態は `poison` だけ。

---------------------------------------------------------------------------------------------------
## 5. モジュール API（各担当はこの形で実装し、この形で呼ぶ）

### 5.1 誰が何をするか（呼び出しの流れ）
```
Title ─はじめから→ State.newGame() → Field.start(DB.config.start) → プロローグのイベント → ev.createHero() → CharCreate / NameEntry
                                                                       └→ ev.chooseCompanions() → Tavern.chooseStart → Party.recruit×3
Field ─歩数→ Battle.start({zone}) ─→ Mon.buildList（ティアで系統を解決、金色の抽選） → Battle.Engine（戦闘の計算。閃きは Glimmer、熟練度は Rules.train）
                                  └→ 勝ったら Party.award（経験値。控えは6割）→ Party.afterBattle（戦闘後の回復の方針）
地方のボスイベント → ev.clearRegion(id) → Tier.clear（ティア+1、フラグ、年代記の章）→ 地方クリアの演出
宝箱 → Tier.chest(def)   店 → Tier.shopItems(id)   NPC の台詞 → State.check / §4.4
```

### 5.2 `R.State`（src/systems/state.js、担当 rules）
```
newGame(heroSpec?)        → R.Game を作り直す。heroSpec = {name, gender, type, favor:{kind,id}}。省略時は DB.config.defaultHero
                            DB.config の start/startGold/startItems/startObjective を使う。R.Battle.autoCarry = false
flag(n) setFlag(n, v=true) getVar(n) setVar(n, v) check(cond)           // setFlag は R.emit('flag', n, v)
count(id) hasItem(id, n=1)  // hasItem は出撃中と控えの装備品も数える
addItem(id, n=1) → bool (上限99)   removeItem(id, n=1) → bool   items(pred) → [{id, count, item}]（種別・sort・値段の順）
addGold(n)   takeGold(n) → bool   // 所持金の上限は 9999999
hero() → CharState   party() → R.Game.party   alive() → 出撃中で生きている人   leader() → 生きている先頭（全滅なら主人公）
char(id) → 出撃中か控えの CharState | null   all() → party.concat(reserve)
healAll({reserve = true}) → HP/MP/WP を全快、状態異常を治す、戦闘不能から戻す
wipeRecover()             → 所持金を半分にして healAll()   // 経験値は失わない
seen(monId) killed(monId, {golden}) noteDrop(monId, grade)   // grade: 'normal'|'rare'|'super' → book.mon の drop/rare/sr
noteLearned(charId, actionId)                                 // book.tech / book.spell に記録
serialize() deserialize(data) → bool
```

### 5.3 `R.Rules`（src/systems/rules.js、担当 rules。数値は成長章が決める）
**定数**: `STATS`、`MAXES`（`['hp','mp','wp']`）、`SLOTS`、`SLOT_NAMES`、`WTYPES`、`ELEMENTS`、`MAX_LEVEL`（既定 99）、`CAPS`

**キャラクター**
```
newChar(spec) → CharState       // spec: {id:'hero', heroSpec} または {id:companionId, level?}
baseStats(c) → {str,vit,dex,agi,int,mnd}           // 固定値（主人公はタイプと得意分野から）
aptitude(c) → { w:{sword:1.0,…}, e:{fire:1.0,…} }  // 得手不得手の倍率（閃きやすさ・熟練度の伸び）。§成長章・閃き章
stats(c) → {
  hp, mp, wp,                          // 最大値
  str, vit, dex, agi, int, mnd,        // 固定値＋装備（％の補正を含む）
  def, mdef, hit, eva, crit, spd,      // 導かれる値（式は成長章・戦闘章）
  w: { weapon1: W|null, weapon2: W|null, fist: W },   // W = {id, wtype, atk, hit, element, onHit, reach, twoHanded}（atk は能力値を足し込んだ最終値）
  elemResist: {fire:1,…}, statusImmune: [...], mods }
mods(c) → 装備の mods をまとめたもの（§5.16）
isAlive(c)   clampHpMp(c)
```

**経験値と成長**（HP/MP/WP だけが伸びる。伸びは逓減する）
```
expForLevel(L)  expToNext(c)
gainExp(c, n) → { levels, gains:{hp,mp,wp} }       // HP は増えた分だけ現在値も増やす（戦闘不能の人は増やさない）
battleExp(c, killed:[monDef]) → n                  // レベル差で減らす（自分が高いほど減る。式は成長章）
maxAt(c, key, level) → n                           // 成長曲線
```

**熟練度**
```
prof(c, kind:'w'|'e', id) → ポイント     profRank(points) → 段階（0〜。境目は成長章）
addProf(c, kind, id, pts) → {rank, up:bool}
train(c, info) → [{kind, id, rank}]    // 戦闘が、味方の行動のたびに呼ぶ。
                                       // info = {kind:'attack'|'tech'|'spell'（コマンドの type と同じ）, slot?, wtype?, elements?:[…], actionId, mon:{lv, rank, boss}, killed:bool}
```

**装備**
```
slotGroup(itemId) → 'weapon'|'shield'|'head'|'body'|'hands'|'feet'|'acc'|null     slotsFor(itemId) → ['weapon1','weapon2'] など
isTwoHanded(itemId)   reach(itemId|null) → 'front'|'any'
canEquip(c, itemId, slot) → bool     equipIssue(c, itemId, slot) → null | '理由の文'（メニューに出す）
equip(c, slot, itemId|null) → { ok, removed:[itemId] }   // inv との間で出し入れする
unequipAll(c)
preview(c, slot, itemId) → 装備した場合の stats（メニューの ↑↓ 表示用。c は変えない）
optimize(c, mode = 'auto') → bool      // mode: 'auto'|'phys'|'magic'|'guard'
```
装備の規則（normative）:
1. 枠の種類が合わない品は付けられない（`weapon` → weapon1/weapon2、`acc` → acc1/acc2、ほかは同じ名前の枠）。
2. **weapon1 か weapon2 に両手持ちの武器があるときは、盾の枠は空でなければならない**。
   - 両手武器を付けると、付いていた盾は自動で外れ、`removed` に入る。メニューは「盾を外した」と表示する。
   - 両手武器を持っている間は盾を付けられない（`canEquip` が false、`equipIssue` は「両手持ちの武器を装備している」）。
3. 武器1・武器2はそれぞれ空でもよい。両方空のときは素手で、体術（`fist`）として扱う。
4. **すべての装備品の `stats` と `mods` が効く**（武器2のものも含む）。武器の `atk/hit/element/onHit` は、その武器の枠を使う行動にだけ効く。
5. キャラごとの装備の制限は原則なし。例外として、アイテムに `only:[charId]` または `gender:'m'|'f'` を付けられる。
6. 同じ品を2つの枠に付けるには、2個持っている必要がある。
7. `optimize` の決め方:
   - 武器1・武器2は**今付けている系統を変えない**（同じ系統の中で一番良い物を選ぶ）。空の枠には、得意な系統か、熟練度が最も高い系統を入れる。
   - 両手武器＋盾なしと、片手武器＋盾の両方を点数で比べる。
   - 他の人の装備は取らない。点数の付け方は成長章が決める（`auto` はタイプや役割から phys/magic を選ぶ）。

**戦闘コマンド**
```
commands(c) → [
  {type:'weapon', slot:'weapon1', wtype, name:'剣'},     // 装備している武器の枠ごとに1つ。両方空なら {slot:null, wtype:'fist', name:'体術'}
  {type:'weapon', slot:'weapon2', wtype, name:'槍'},
  {type:'spell', name:'術'},                              // 術を1つ以上覚えているときだけ
  {type:'defend', name:'防御'}, {type:'item', name:'道具'} ]
techList(c, wtype) → その系統で覚えている技（技データの並び順）   spellList(c) → 覚えている術（属性の並び → 段階の順）
wpCost(c, actionId)  mpCost(c, actionId)                  // mods の wpCostPct / mpCostPct を反映
fieldSpells(c) → フィールドで使える術（action.field === true）
effectiveRow(c, party) → 'front'|'middle'                  // 生きている前列が1人もいなければ、中列を前列として扱う（既定値）
```
武器のコマンドを選ぶと、「攻撃」（通常攻撃）と、その系統の覚えた技が並ぶ。

### 5.4 `R.Party`（src/systems/party.js、担当 rules）
```
MAX = 4
candidates() → 候補の companion id（DB.companions の並び順）     isRecruited(id)
recruit(id, {toParty = true}) → CharState    // 加入時のレベルは joinLevel()。熟練度は def.startProf＋追いつき分（成長章）。
                                             // 初期装備は装備済みで加わる。フラグ joined_<id>、R.emit('recruit', c)。出撃枠に空きがなければ控えへ
joinLevel() → n                              // 既定値: max(1, floor(主人公のレベル × 0.9))
setParty(ids) → bool                         // 主人公を含む1〜4人（加入済みの人だけ）。外れた人は控えの先頭へ、控えから入った人は全快（既定値）
swap(activeId, reserveId) → bool   setOrder(ids)（出撃中の並び）   setRow(id, row)
canSwapHere() → bool                         // 入れ替えできる場所: 町・城・村のマップ（map.def.partySwap で上書きできる）
award({killed:[{def, golden}]}) → [{c, exp, levels, gains, reserve:bool}]
                                             // 出撃中は R.Rules.battleExp。戦闘不能の人と控えは、その 60%（CONST RESERVE_RATE = 0.6）
afterBattle(result) → void                   // 戦闘後の回復の方針。既定値: 勝ったら生存者の HP を全快。MP/WP と戦闘不能はそのまま（成長章・戦闘章で確定）
mod(key) → 出撃中で生きている人の mods[key] の合計（金・ドロップ・レア・出現率など、パーティ全体に効く補正。上限は戦利品の章）
fieldMods() → {encounterPct（絶対値が最大のもの）, walkHeal（最大）, noFloorDamage}
spriteKey(c) → 'party:<spriteId>'    faceKey(c) → 'face:<spriteId>'
```

### 5.5 `R.Tier`（src/systems/tier.js、担当 rules）
```
MAX = 8
current() → R.Game.tier（ゲームが無ければ 0）       isCleared(regionId)       clearedList() → [regionId]
clear(regionId) → {tier, first:bool}   // 状態だけを変える: regionsCleared に追加、tier の計算し直し、フラグ cleared_<id>、
                                       // R.emit('tier', tier, regionId)。演出は ev.clearRegion が行う
pick(table, tier?) → 値                // 配列なら table[min(tier, 長さ−1)]、オブジェクト {0:a, 3:b} なら tier 以下で最大のキーの値
chest(def) → {item, n} | {gold}        // def.pool があれば DB.pools[pool] をティアで引き、なければ def.item/def.gold。
                                       // 結果は R.Game.chests[id] に記録する（宝箱を開ける処理は field が行う）
shopItems(shopId) → [itemId]           // DB.shops[id].items（固定品）＋ stock のうち tier 以下の段（下の書き方）
innPrice() → pick(DB.config.innPrice)
```
- 店の書き方: `{name?, items:[固定品], stock:[{tier:0, items:[…]}, {tier:3, items:[…]}], keepOld:true}`。
  `keepOld:false` のときは、tier 以下で最も高い段の品だけを出す。
- プールの書き方: `DB.pools[id] = {tiers:[[{item, w, n?}|{gold, w}], …9段（ティア 0〜8）]}`。
  中身は装備の章が決める。9段より短い配列なら最後の段を使う。

### 5.6 `R.Mon`（src/systems/mon.js、担当 battle。数値はモンスター章・戦利品の章）
```
resolve(ref, tier?) → monId|null       // '@wolf' → DB.lineages.wolf.stages のうち tier 以下で最大の段の mon。普通の id はそのまま
def(id, {tier, golden}) → 魔物の定義    // DB を書き換えない。scale:'tier' なら倍率をかけた複製、golden なら金色版（名前「金色の〜」、能力・経験値・レア率を上げる）。(id, tier, golden) ごとにキャッシュする
buildList(spec, tier) → [monId]        // spec: [['@wolf',1,3], ['bat_2',2]] など。8体まで、同じ種類を並べてまとめる（クレストの buildMons と同じ）
rollGolden(ids, mods) → 金色にする位置 | -1   // ゾーンでのランダム戦闘だけ（1戦につき最大1体）
rollDrops(def, {golden, mods}) → [{item, grade}]   // 通常・レア・超レアを独立に抽選する
healAmount(user, target, eff, {item, field})       // ← 戦闘とメニューで回復量の式を1つにする（メニューが既に呼んでいるのに、クレストには無い関数。R.Battle.healAmount と同じもの）
```

### 5.7 `R.Glimmer`（src/systems/glimmer.js、担当 spells。確率の式は閃き章）
```
roll(c, ctx) → {id, kind:'tech'|'spell'} | null     // c を変えない（純粋な関数）
   ctx = { kind:'tech'|'spell', wtype?, elements?:[…], actionId, slot?, mon:{id, lv, rank, boss, flags}, tier, rng? }
   // tech: 武器の攻撃か技を使ったとき（wtype = その枠の系統）。spell: 術を使ったとき（elements = その術の属性）
learn(c, id) → bool   // c.techs / c.spells に加え、R.State.noteLearned、c.counts.glimmers++、R.Game.records.glimmers++、R.emit('glimmer', c, id, kind)
chance(c, id, ctx) → p        candidates(c, ctx) → [{id, p}]   // シミュレーションとデバッグ用
```
- 戦闘での順番（normative）: 行動の直前に `roll` → 当たれば `{t:'glimmer'}` のイベントを出す → `learn` → その技・術で**行動を置き換えて**実行する（消費なし）。対象の決め方はその技・術の `target` に従う。
- シミュレーション（`R.Battle.simulate`）は複製した CharState に learn するので、ゲームの状態を汚さない。

### 5.8 `R.Battle`（battle.js・mon.js は担当 battle、battle_scene.js・battle_fx.js は担当 bui）
**入口**
```js
const res = await R.Battle.start({
  zone | troop | mons,        // どれか1つ。mons: [['@wolf',2], ['bat_1',1,3]]（テスト用）
  bg, bgm,                    // 省略時: bg = troop.bg / zone.bg / フィールドの背景、bgm = troop.bgm / ボスがいれば 'boss' / 'battle'
  canLose, noEscape,          // 負けても続くイベント戦 / 逃げられない
  surprise,                   // 'pre' | null（強制。省略時はゾーン戦だけ抽選）
  noRare, noGolden,           // レア魔物への差し替え・金色の抽選をしない
  tier,                       // テスト用（省略時は R.Tier.current()）
});                           // → 'win' | 'lose' | 'escape'
R.Battle.last = { result, rounds, zone, troop, killed:[{id, golden}], exp, gold,
                  drops:[{item, grade, mon}], glimmers:[{char, id, kind}], levelUps:[{char, level}] };
```
- **ゾーンでのランダム戦闘の順番**:
  1. レア魔物への差し替え（`DB.rareEncounters[zone] = {mon, rate}`。確率に `R.Party.mod('rareEncPct')` をかける）
  2. `R.Mon.buildList`
  3. 金色の抽選
- **オートで始まる条件**: `zone` の戦闘で、`troop` も `mons` も指定がなく、`canLose` でも `noEscape` でもなく、ボス・レア魔物・金色の個体がいなくて、`Settings.autoKeep` が真で、`R.Battle.autoCarry` が真のとき。
  - これ以外（ボス戦・イベント戦・レア魔物戦・金色の個体の戦闘）は**手動で始まる**。
  - オート中に B を押すと、次のコマンド入力のときに解除され、`autoCarry = false` になる。`autoCarry` はセーブしない。
- **負けたとき**: `'lose'` を返し、パーティはそのままにする。呼んだ側（field / ev.battle）が `R.GameOver.run()` を行う（`canLose` のときは戦闘不能の人を HP1 にして続ける）。
- レイアウト（担当 bui。案）: 4人分のステータス窓 `WIN = {xs:[3,66,129,192], y:4, w:61, h:48}`。名前は枠の上に載せ、その下に H / M / W の3行、隊列の印（前・中）を付ける。
  ほかのレイアウト定数（`52` = 窓の下端、など）は `WIN` から計算する。`R.Battle.WIN` と `R.Battle.BOX` を公開する。

**戦闘エンジン**（`new R.Battle.Engine(o)`。ジェネレーターがイベントを出し、画面はそれを描くだけ。simulate も同じコードで動く）
- o の形: `{party:[CharState], reserve:[CharState], mons:[{id, golden}] | [monId], inv, live, noEscape, surprise, noSurprise, tier}`
- **味方のコマンド**（`playRound(cmds)`。cmds は party の番号ごと）:
  ```
  {type:'attack', slot:'weapon1'|'weapon2'|null, target}   {type:'tech', id, slot, target}   {type:'spell', id, target}
  {type:'item', id, target}   {type:'defend'}   // 全員で逃げるときは cmds.flee = true
  ```
- 行動できない理由 `unusable(u, id, slot)`: `'mp' | 'wp' | 'silence' | 'reach'（中列から届かない）| 'field'（戦闘では使えない）| null`
- **出すイベント**（クレストの一覧に追加・変更するもの）:
  | イベント | 中身 | 意味 |
  |---|---|---|
  | `glimmer` | `{u, id, kind}` | 閃いた。画面は `sfx('glimmer')`、その人の窓を光らせ、技名を大きく出す |
  | `drop` | `{mon, item, grade}` | ドロップ（`gain`/`rare` の置き換え）。`rare` はジングル `rare`、`super` はジングル `superrare` と専用の演出 |
  | `golden` | `{u}` | 金色の個体が現れた（戦闘の始め）。キラキラと `sfx('golden')` |
  | `levelup` | `{c, level, gains}` | メッセージは別に出る |
  | `prof` | `{u, kind, id, rank}` | 熟練度の段階が上がった（表示するかどうかは bui が決める） |
  | `gain` | `{item}` | 盗んだ品だけに使う |
  - 削除するもの: `jobup` 系、JP のメッセージ、二刀流、リアクションの枠。
- **ごほうび**（`rewards()`）の順番:
  1. `victory`
  2. やっつけたメッセージ
  3. 経験値（人ごとに違えば1人ずつ）
  4. お金
  5. `pause`
  6. レベルアップ（上がった最大 HP/MP/WP だけを表示）
  7. ドロップ（1つずつ `pause`）
  8. 控えの経験値（「控えの仲間も経験値を得た」の1行）
- **simulate**: `R.Battle.simulate(o)` → クレストの結果の項目 ＋ `glimmers:[{char,id}]`、`drops:[{item,grade}]`、`profUps`、`partyWpPct`。
  - o の項目: `party, inv, mons|troop|zone, tier, maxRounds, seed, items, rewards, surprise, log, golden`
  - 複製した状態で動かし、R.Game は変えない。

### 5.9 `R.BattleAI`（src/systems/battle_ai.js、担当 battle）
- `monster(eng, u)`、`monCommand`、`condOk`
- `pickPartyTarget(eng)`: **隊列で重みを付ける**（前列 ×3、中列 ×1 を既定値とする。戦闘章で確定）
- `partyCommands(eng, {items})`、`partyAction`: オート戦闘とシミュレーション用。技と術を使い、WP と MP の両方の消費を考える。届かないときは防御する

### 5.10 `R.Field` と `R.FieldMap`（担当 field）
**実装済みの API**（そのまま残す）:
- 開始と移動: `start(map, spawn)`、`resume()`、`warp(map, spawn|{x,y,dir}, {dir, fade, frames})`、`teleport(locId)`、`teleportList()`、`canTeleport()`、`canExit()`、`exitDungeon()`
- 全滅と復帰: `setRespawnHere()`、`respawn()`
- 状態: `refresh()`、`isBusy()`、`pos()`、`front()`、`map`、`layer`、`noEncounter`、`showCoords`
- 戦闘: `battleBg(zone)`、`encounter(zone)`、`gameOver()`
- イベント用: `npc(id)`、`walkNpc`、`walkParty`、`facePlayer`、`setPlayerPos`、`parsePath`

**変える点**:
1. 隊列の後ろに付いてくる人数を `R.Game.party.length`（最大4）にする（今は 3 に固定: field.js:141、:188）。
2. 人物の絵のキーは `R.Party.spriteKey(c)` を使う（field.js:580 の `party:<id>:<job>` を置き換える）。
3. 宝箱: `pool` のある宝箱は `R.Tier.chest(def)` で中身を決め、`R.Game.chests[id]` に記録する。99個の上限と、大事なもののジングルは、決まった中身で判断する。
4. 出現率: `R.Game.encItem`（pct、steps）と `R.Party.fieldMods().encounterPct` をかける。歩くたびに steps を1減らし、0 になったら「効果が切れた」と表示する。
5. **町・城・村のマップに入ったら `R.Game.respawn = {map, spawn: def.respawnSpawn || 'entrance'}` にする**（`def.noRespawn` で止められる）。
6. **ワープにも実行時の `cond` を効かせる**（tools/progress.js はすでに cond を見ているのに、ゲームは見ていない）。
7. NPC の台詞の形（§4.4）。立ち止まっているときに足踏みさせない（RS1 風。field.js:445 と :570）。
8. `over:true` の飾り（屋根のひさし・木の葉・アーチ）を人物の後に描く層を加える（任意。art-tiles と相談の上で報告する）。
9. お金の単位の語「ゴールド」を1か所の定数にする（物語章で名前を変える可能性があるため）。

マップの形式はクレストの §7.1 と同じ。追加するキー:
- `respawnSpawn`、`noRespawn`、`partySwap`（酒場の入れ替えを許す・禁じる）
- 宝箱の `pool`
- ワープの `cond`
- 地方の `region`（そのマップが属する地方の id。年代記・目的・検証ツール用）

### 5.11 `R.Events` と `ev`（src/systems/events_runtime.js、担当 field）
**実装済み**（そのまま残す）:
- `R.Events.run(id|fn, ctx)`: 1つずつ順番に実行する。イベントの中から呼ぶとその場で実行し、`ctx.defer` なら後ろに並べる。
- `reset()`、`busy()`、`talk(npc)`、`lines(...)`、`gotPhrases`。
- `once` フラグ: 正常に終わったときだけ立つ。false を返したとき・逃げた戦闘があったとき・全滅したときは立たない。
- イベントの定義: `R.DB.events[id] = { meta:{needs:[…], gives:[…], warp?}, run: async (ev) => {…} }`。
- meta のトークン: `flag:<n>`、`item:<id>`、`region:<id>`（クリア）、`recruit:<id>`。progress.js が読む。

**`ev` の API（クレストから持ち越すもの）**
- 文章: `say(text|pages[], opts)`（続けて say すると同じ窓を使う）、`ask(text, choices)` → 番号 / −1、`yesno(text)` → bool、`gotItem`、`closeMessage`
- 状態（同期）: `flag`、`setFlag`、`check`、`var`、`setVar`、`has`、`take`、`gold`、`takeGold`
- 物とお金: `give(item, n=1, {silent})`（大事なものはジングル `keyitem`）、`giveGold(n)`
- 戦闘: `battle(troopId|opts, {canLose, noEscape, bgm, bg})` → `'win'|'lose'|'escape'`。負けたら（canLose でなければ）ゲームオーバーにして、イベントを終わらせる
- 移動と画面: `warp(map, spawn|{x,y}, {dir, fade})`、`wait`、`fadeOut`、`fadeIn`、`shake`、`flash`
- 音: `sfx`、`bgm(id?)`、`jingle`
- 人物: `npc(id)` → `{x, y, dir, visible, face(dir|'player'), walk('U3L2'), hide(), show(), setPos()}`、`player` → `{x, y, dir, face, walk, setPos}`
- 施設: `heal()`、`inn(price?)`（省略時の値段は `R.Tier.innPrice()`）、`shop(shopId)`、`church()`、`saveMenu()`
- 目的: `setObjective(id, {region}?)`（region を付けると `R.Game.regionObj[region]` に入れる）
- その他: `giveShip(spawn)`（使う場合）、`refresh()`、`ending()`、`call(id)`、`map`、`self`、`ctx`、`leader`

**`ev` の API（新しく加えるもの）**
| 呼び方 | 戻り値 | すること |
|---|---|---|
| `ev.createHero()` | CharState \| null | `R.CharCreate.run({cancel:false})` で主人公を作り直す（名前・性別・タイプ・得意分野。進み具合はそのまま）。フラグ `hero_created` |
| `ev.chooseCompanions({count = 3})` | companionId[] | `R.Tavern.chooseStart` → 選ばれた3人を `R.Party.recruit` する（プロフィール・加入の台詞・ジングル `recruit` を含む） |
| `ev.tavern({recruit = true})` | void | `R.Tavern.open`（入れ替え・加入・隊列） |
| `ev.recruit(id, {silent})` | CharState | 加入させる（加入の台詞 `def.joinLine` と、ジングル `recruit`） |
| `ev.inParty(id)` / `ev.recruited(id)` | bool | 同期 |
| `ev.hero` | CharState | 読み取り専用 |
| `ev.g(male, female)` | string | 主人公の性別で選ぶ |
| `ev.tier()` | number | 同期 |
| `ev.cleared(regionId)` | bool | 同期 |
| `ev.clearRegion(regionId)` | Promise\<number\>（新しいティア） | `R.Tier.clear` → 演出: 羽ペンの音、「年代記に第N章『<章の題>』が記された。」、ジングル `chapter`、`DB.regions[id].fragment` を渡す、`R.Field.refresh()`。すでにクリア済みなら何もしない |
| `ev.caption(text, {frames = 150, pos:'middle'})` | Promise | 画面の中央に大きな字幕を出す（章の題など）。A で先に進める |
| `ev.chronicle()` | Promise | 年代記の画面（`R.Menu.chronicleScreen`）を開く |
| `ev.setRespawn(map?, spawn?)` | void | 戻り先を明示する（省略時は今いる場所） |
| `ev.lastBattle` | object | `R.Battle.last` |

### 5.12 画面を持つシステム
| API | 担当 | 仕様 |
|---|---|---|
| `R.Title.start()` | newgame | タイトル画面（ロゴ・副題・`R.COPYRIGHT`）→ はじめから（確認してから `R.State.newGame()` → `R.Field.start(DB.config.start.map, …)`）/ つづきから / 復活の呪文 / 設定 |
| `R.CharCreate.run({cancel = true})` | newgame | 性別 → タイプ（`DB.heroTypes`）→ 得意分野（タイプの `favorKind` に合わせて、武器系統か属性を選ぶ）→ 名前（`R.NameEntry.run`）→ 確認。heroSpec を返す（キャンセルなら null） |
| `R.NameEntry.run({initial, max = 5, spriteKey, title})` | newgame | 五十音表（ひらがな・カタカナ・英数字）と DOM キーボード。1〜5文字。漢字は使えない。名前の文字列を返す（キャンセルなら null）。`check(name)`、`normalize(s)`、`VALID` |
| `R.Tavern.chooseStart({count = 3})` | newgame | 20人の候補から選ぶ画面（絵・プロフィール・得手不得手・加入の台詞）。id の配列を返す |
| `R.Tavern.open({recruit = true})` | newgame | 出撃と控えの入れ替え、未加入の候補の加入、並び・隊列。`R.Party` の API だけで状態を変える |
| `R.Menu.open()` | menu | フィールドのメニュー（B）。コマンド（案）: 道具 / 術 / 装備 / 強さ / 並び替え / 技の書 / 図鑑 / 年代記 / 地図 / セーブ / 設定（入れ替えできる場所では「仲間」→ `R.Tavern.open({recruit:false})`） |
| `R.Menu.*Screen` | menu | `itemScreen`、`spellScreen`、`equipScreen(o)`、`statusScreen(o)`、`orderScreen`（並びと隊列）、`skillBookScreen`（技の書と術の書）、`bookScreen`（図鑑。通常・レア・超レアの3枠）、`chronicleScreen`（年代記。章・断片・地方ごとの目的）、`saveScreen`/`saveMenu`、`settings`、`pickMember(o)`、`applyFieldEffect(def, user, targets)`、`useItem(id)`、`kit` |
| `R.Shop.open(shopId)` / `R.Shop.inn(price)` / `R.Shop.church()` | menu | 品ぞろえは `R.Tier.shopItems`。出撃中の4人それぞれについて、装備できるかと能力の増減を見せる。宿屋は出撃と控えの全員を全快・復活させる |
| `R.GameOver.run()` | menu | 全滅の画面 → `R.State.wipeRecover()` → `R.Field.respawn()` →「{leader}たちは目を覚ました。」とお金が減った表示 |
| `R.Ending.start()` | story | エンディング → 出撃中の仲間それぞれの後日談（`DB.companions[id].epilogue`）→ クレジット（`R.COPYRIGHT` を入れる）→ `gameClear`・`clearCount`・クリア後の位置と目的（`DB.config.postgameStart`）→ セーブを勧める → タイトル |
| `R.Minimap.open()` | field | ワールドマップの画面。キャッシュのキーはクレストの `barrier_broken` ではなく `map.version` を使う |

### 5.13 `R.debug`（src/systems/debug.js、担当 field。全員がスクショとテストで使う）
```
quickStart({hero:{name,gender,type,favor}, companions:[ids], tier, level, map, spawn, gear:'start'|'tier'}) → Promise
   // タイトルを飛ばして、すぐに遊べる状態にする。省略時: 主人公 'テスト'（男・最初のタイプ）、DB.companions の最初の3人、tier 0、level 1、DB.config.start
newGameAt(map, spawn)   warp(map, spawn|{x,y})   give(item, n)   giveAll(kind)   gold(n)   flag(name, v)
level(n, charId?)   tier(n)   clearRegion(id)   recruit(id)   party([ids])   prof(charId, 'w'|'e', id, pts)
learn(charId, actionId)   learnAll(charId?)   heal()   noEncounter(v)   battle(zone|troop|{mons})   event(id)
visitAll()   teleport(loc)   pos()   maps()
```
`?debug=1` を付けると、マップの id と座標を表示する。

### 5.14 イベントバス（`R.on` / `R.emit`）
- 実装済み: `flag`(name, v)、`mapload`(mapId)、`step`(map, x, y)、`objective`(id)、`battleEnd`(res, o)、`error`(e)、`booted`
- 新しく加える: `tier`(tier, regionId)、`glimmer`(c, id, kind)、`recruit`(c)、`partyChange`()、`levelup`(c, level)、`drop`(item, grade, monId)

### 5.15 データレジストリ（エンジンが読む最小限の項目。詳しい形は各章）
| レジストリ | 担当 | エンジンが読む項目 |
|---|---|---|
| `config` | world | `start:{map, spawn, dir}`、`startGold`、`startItems:{id:n}`、`startObjective`、`defaultHero:{name, gender, type, favor}`、`innPrice:[9段]`、`postgameStart:{map, spawn}` |
| `heroTypes[id]` | newgame | `name, desc, stats{6}, growth{hp,mp,wp}, favorKind:'weapon'|'element'|'any', favorOptions?, apt{w,e}, startEquip{slot:item}, startTechs[], startSpells[], row` |
| `companions[id]` | newgame | `name, gender, title（肩書）, profile, joinLine, epilogue, stats{6}, growth{hp,mp,wp}, apt{w:{wtype:倍率}, e:{el:倍率}}, startEquip, startProf{w,e}, startTechs, startSpells, row, sprite?` |
| `weaponTypes[wtype]` | techs | `name, twoHanded, reach, icon, fx` |
| `elements[el]` | spells | `name, color, fx, sfx` |
| `statuses[s]` | spells | `name, bad, persists, turns:[min,max], icon`（どう働くかは戦闘章の表に従い、battle が実装する） |
| `actions[id]` | techs（`t_`）、spells（`s_`）、mons（`e_`）、boss（`eb_`） | `kind, name, desc, wtype?, elements?:[…], rank, wp?, mp?, magic?, reach?, target, effects[], fx, field?, msg?`。閃きの項目（`glim`）は閃き章 |
| `items[id]` | weapons、gear | `name, type, price (0 なら売れない), desc, grade, tier, icon?, sort?`、武器は `wtype, atk, hit?, element?, onHit?, twoHanded?`、防具は `def, mdef?, eva?`、共通で `stats?{…6, hp, mp, wp}, mods?, only?, gender?, unique?`、道具は `use:{target, effects, fx, battle, field}` |
| `pools[id]` | gear | §5.5 |
| `shops[id]` | gear（id は店を置く担当が DESIGN の店の表から使う） | §5.5 |
| `monsters[id]` | mons（雑魚）、boss（ボス・レア魔物） | `name, sprite, hue?, sat?, bri?, pal?, lineage?, stage?, lv, rank?, hp, mp, atk, def, mag, mdef, agi, dex?, eva?, hit?, exp, gold, elem{}, statusRes{}, actions[{id, w, cond}], actsPerTurn?, drops:{normal:{item, rate}, rare:{item, rate}, super:{item, rate}}, steal?, flags[], fleeRate?, appear?, scale?:'tier', desc` |
| `lineages[id]` | mons | `name, stages:[{mon, tier}]`（tier は、その段が出始めるティア） |
| `encounters[zone]` | mons | `region, bg, groups:[{w, mons:[[ref, min, max]], tierMin?, tierMax?}]` |
| `troops[id]` | boss | `mons, bg, bgm, noEscape, scale?` |
| `rareEncounters[zone]` | boss | `{mon, rate}` |
| `regions[id]` | world | `name, chapter:{no, title, summary}, fragment（大事なものの id）, locations[], bossTroop, hint` |
| `locations[id]` | world | `name, map, spawn, region?, dock?` |
| `objectives[id]` | world（物語の目的は story が書いてもよい。id の接頭辞で分ける: `obj_s_…`） | `text`（`{cleared}` と `{left}` をクリア数・残り数に置き換える） |
| `maps`、`events` | world、story、reg-a、reg-b | クレスト §7.1・§7.3 と、この章 §5.10・§5.11 の追加分 |
| `tiles`、`legends`、`themes`、`decor` | art-tiles | クレストと同じ |
| `music`、`sfx` | audio | |

### 5.16 補正（`mods`）のキー（装備が持ち、rules・battle・field が読む。数値は装備の章）
- 同じキーが複数あるときの合わせ方: 数値は足し算、配列はつなげる、`elemResist` は最小値、ほかのマップ型はキーごとに足し算。
- パーティ全体に効くもの（*印）は、出撃中で生きている人の合計（`R.Party.mod`）を使う。上限は戦利品の章が決める。

| 分類 | キー |
|---|---|
| 導かれる値に足す | `atk def mdef hit eva crit spd` |
| ％ | `hpPct mpPct wpPct physPct magicPct healPct itemPct mpCostPct wpCostPct` |
| 属性 | `elemBoost:{el:+%}`（その属性の攻撃が強くなる）、`elemResist:{el:倍率}`（0 なら無効、負なら吸収） |
| 状態異常 | `statusImmune:[…]`、`statusResist:{s:0〜1}` |
| 成長・閃き | `profPct:{<wtype か 属性>:+%}`（熟練度の伸び）、`glimPct:{<wtype か 属性 か 'tech' か 'spell'>:+%}`（閃きやすさ） |
| ごほうび* | `expPct`（これだけは個人ごと）、`goldPct* dropPct* rarePct* superPct* stealPct` |
| 出会い* | `encounterPct`（フィールドでは絶対値が最大のもの）、`rareEncPct* goldenPct* preemptPct* escapePct*` |
| ターンごと | `regen:true`、`mpRegen:n`、`wpRegen:n`、`startBuffs:{stat:段階}` |
| フィールド | `walkHeal:n`、`noFloorDamage:true` |
- ここに無いキーは validate が警告する。キーを増やすときは、rules と battle の両方の担当に依頼する（最後の報告に書く）。

---------------------------------------------------------------------------------------------------
## 6. 参考エンジンの systems/*.js の扱い

| ファイル（行数） | 扱い | 担当 | 主な変更点 |
|---|---|---|---|
| state.js（159） | **作り直す** | rules | §4 のスキーマ。party と reserve。条件式の拡張。book |
| rules.js（402） | **作り直す** | rules | ジョブ・アビリティ・JP・二刀流・運を削除。6つの能力値、9つの枠、熟練度、成長、コマンド |
| （新）party.js、tier.js | 新しく作る | rules | §5.4、§5.5 |
| battle.js（1230） | **作り替える** | battle | ジェネレーター式のエンジンは残す。WP、隊列（受けるダメージ・届く範囲）、閃きのフック（execute の中）、熟練度（train）、行動の出どころを `DB.actions` に、3段階のドロップ、金色の個体、`R.Mon.def`、経験値は `R.Party.award`。削除するもの: JP・ジョブ・リアクションの枠・二刀流（`OFFHAND_MULT`、`atk2`）・運。追加の属性（配列の属性）と新しい状態異常 |
| （新）mon.js | 新しく作る | battle | §5.6（クレストの buildMons と computeRewards のドロップ部分をここに移す） |
| battle_ai.js（250） | 作り替える | battle | 狙う相手の重みを隊列で決める（今は並び順で 5/3/2）。オートで技と術を使う。WP も考える |
| battle_scene.js（893） | 作り替える | bui | 4人分の窓（今は3人に固定: :16、`pickAlly` の `%3`: :586）、コマンド（武器1 / 武器2 / 術 / 防御 / 道具）、閃きの演出、ドロップ・超レア・金色の演出、オートの条件 |
| battle_fx.js（944） | ほぼ残す | bui | 光（`light` → holy の見た目）、合成術（2つの fx を続けて出す）、凍結・やけど。fx はキーワードの部分一致で誤爆するので（`jump` → `mp` など）、**データは fx の id を正確に書く** |
| field.js（936） | 作り替える | field | §5.10 の1〜9 |
| field_map.js（373） | ほぼ残す | field | ワープの cond、宝箱の pool、隠しアイテム（`hidden`）を削除 |
| events_runtime.js（378） | 作り替える | field | §5.11 の新しい API、`fmt` を `R.Text.fmt` に任せる、お金の単位の語を定数に |
| minimap.js（174） | 作り替える | field | キャッシュのキー、新しいワールドのタイルと町の印 |
| debug.js（96） | **作り直す** | field | §5.13 |
| menu.js（620） | 作り替える | menu | コマンドの一覧、4人分の窓（H/M/W）、`applyFieldEffect` の回復量を `R.Mon.healAmount` で計算する |
| menu_equip.js（194） | **作り直す** | menu | 9つの枠、トレードオフが分かる比べ方（↑緑 ↓赤、すべての能力値）、最強装備の4つのモード、両手武器と盾の説明 |
| menu_items.js（229） | 作り替える | menu | 道具・大事なもの（使える大事なもの＝ワープ・脱出）、アビリティを術に置き換える |
| menu_jobs.js（462） | **削除** | menu | 技の書と術の書は新しい `menu_book.js` で作る |
| menu_status.js（370） | 作り替える | menu | 強さ（能力値・熟練度 11＋6・技と術）、並び替え（隊列も）、図鑑（3段階のドロップ） |
| （新）menu_book.js、menu_chronicle.js | 新しく作る | menu | 技の書と術の書、年代記 |
| menu_save.js（282） | ほぼ残す | menu | セーブ欄の要約（主人公・4人・ティア） |
| shop.js（327） | 作り替える | menu | 9つの枠、ティアの品ぞろえ、宿屋が控えも回復する |
| gameover.js（93） | ほぼ残す | menu | 文言だけ |
| title.js（380） | 作り替える | newgame | ロゴ・副題・© Studio Metem。はじめからの流れ（§5.12） |
| nameentry.js（312） | 作り替える | newgame | 主人公1人・5文字まで、ジョブの絵を使わない |
| （新）charcreate.js、tavern.js | 新しく作る | newgame | §5.12 |
| ending.js（301） | **作り直す** | story | 中身がクレスト専用（玉座の間・3人の後日談）。舞台を回す部分（EndingLayer）は流用してよい |
| postgame_scene.js（547） | **削除**（作り直すなら story） | story | クレスト専用の一枚絵 |
| （新）glimmer.js | 新しく作る | spells | §5.7 |

- **art/**: tiles*・decor*・battlebg はそのまま使い、足していく。
  - chars*.js は、仲間と主人公の絵を id から作る形に作り替える（`JOB_IDS`/`CHAR_IDS` と `R.DB.jobs` を参照している部分）。
  - 魔物・ボス・レア魔物の絵は、そのまま使い、足していく。
- **audio/**: そのまま使い、§3.3 の新しい曲を足す。
- **data/tiles.js** はそのまま使い、足していく（担当 art-tiles）。

---------------------------------------------------------------------------------------------------
## 7. ビルド期間のファイル担当表

規則:
1. **ファイル（またはグロブ）の担当はちょうど1人**。担当していないファイルは編集しない。
   ほかの担当のファイルに変更が必要なときは、自分の側で回避策を取り、**最後の報告に「ファイル・何を・なぜ」を書く**（lead がまとめて振り分ける）。
2. 新しいファイルは、自分のグロブに合う名前でだけ作る。テストとツールは `tools/test_<area>.js`、`tools/check_<area>.js`、`tools/fixtures/<area>/**` を自由に作ってよい（`<area>` は下の表の略称）。
3. 共有レジストリには自分の id（§3.4 の接頭辞）だけを登録する。
4. 誰かのファイルのせいでビルドや起動が壊れても、そのファイルは直さない。自分の部分を単独で確かめる（`build.js` は構文エラーのファイルを除外する。`--with` で fixture を使う）。
5. 絵・画面を作った担当は、shot.js で**自分の画面を撮って目で確かめる**（1.5）。

| # | 略称 | 範囲 | 担当するファイル |
|---|---|---|---|
| A0 | core（lead） | コア・ビルド・設計書 | `src/core/{ns,input,gfx,engine,save}.js`、`src/ui/ui.js`、`src/main.js`、`tools/build.js`、`tools/shot.js`、`tools/lib/load.js`、`assets/**`、`DESIGN.md`、`STYLE_JA.md`、`design/**` |
| A1 | rules | 状態・能力・成長・装備の規則・仲間・ティア | `src/systems/{state,rules,party,tier}.js`、`tools/test_rules.js`、`tools/sim_growth.js`（HP/MP/WP の曲線・経験値の減り方・控えの追いつき） |
| A2 | battle | 戦闘の計算・AI・魔物の解決・ドロップ | `src/systems/{battle,battle_ai,mon}.js`、`tools/test_battle.js`、`tools/fixtures/battle/**`（クレストの test_battle 1173件を移植して、新しい仕様に合わせる） |
| A3 | bui | 戦闘画面・エフェクト | `src/systems/{battle_scene,battle_fx}.js`、`tools/battle_gallery.js`、`tools/fixtures/bui/**` |
| A4 | field | フィールド・マップの読み込み・イベントの実行・地図・デバッグ | `src/systems/{field,field_map,events_runtime,minimap,debug}.js`、`tools/test_field.js`、`tools/fixtures/field/**` |
| A5 | menu | メニュー・店・宿屋・ゲームオーバー | `src/systems/menu*.js`（menu_jobs.js の削除を含む）、`src/systems/{shop,gameover}.js` |
| A6 | newgame | タイトル・主人公作成・名前入力・酒場・キャラのデータ | `src/systems/{title,charcreate,nameentry,tavern}.js`、`src/data/herotypes.js`、`src/data/companions*.js` |
| A7 | techs | 武器系統・技 110 以上 | `src/data/weapontypes.js`、`src/data/techs_*.js` |
| A8 | spells | 属性・状態異常・術約77・閃きのエンジン | `src/data/{elements,statuses}.js`、`src/data/spells_*.js`、`src/systems/glimmer.js`、`tools/sim_glimmer.js`（閃きの頻度）、`tools/sim_spells.js`（合成術の強さ・知力の効き方） |
| A9 | weapons | 武器 160 以上 | `src/data/items_weapons*.js` |
| A10 | gear | 防具・アクセサリ 160 以上・道具・大事なもの・店・宝箱のプール | `src/data/items_armor*.js`、`items_acc*.js`、`items_use*.js`、`items_key*.js`、`shops*.js`、`pools*.js` |
| A11 | mons | 系統・雑魚 約200・敵の行動・出現表 | `src/data/lineages*.js`、`src/data/monsters_*.js`、`src/data/enemy_actions*.js`、`src/data/encounters*.js`、`tools/sim_zones.js`（地方の難しさを、ティア × クリア順ごとに） |
| A12 | boss | ボス 24〜28・レア魔物 22 以上・金色・はぐれ枠・編成 | `src/data/bosses*.js`、`src/data/troops*.js`、`src/data/rare*.js`、`tools/sim_bosses.js`、`tools/sim_loot.js`（レア率・超レア率・金色） |
| A13 | art-chars | 主人公・仲間・NPC の絵、顔、物、アイコン | `src/art/chars*.js`、`src/art/faces*.js`、`src/art/objects.js`、`tools/sheet_chars.js` |
| A14 | art-mons | 雑魚の絵（新しい元絵・パーツ替え） | `src/art/monsters_*.js`、`tools/sheet_monsters*.js` |
| A15 | art-boss | ボス・レア魔物の絵 | `src/art/bosses*.js`、`src/art/rare_monsters*.js`、`src/art/postgame.js`、`tools/{sheet_bosses,sheet_rare,sheet_postgame}.js` |
| A16 | art-tiles | タイルの定義と絵、ワールド、町の飾り、戦闘背景 | `src/data/tiles.js`、`src/art/tiles*.js`、`src/art/decor*.js`、`src/art/battlebg*.js`、`tools/sheet_tiles.js`、`tools/sheet_decor*.js` |
| A17 | audio | 音の仕組み・曲・効果音 | `src/core/audio.js`、`src/audio/*.js`、`tools/render_audio.js` |
| A18 | world | ワールドマップ・プロローグ・地方と目的のデータ | `src/maps/world*.js`、`src/maps/prologue*.js`、`src/events/prologue*.js`、`src/events/world*.js`、`src/data/{regions,locations,objectives,config}.js`、`tools/gen_world.js`、`tools/check_world.js` |
| A19 | story | 地方をまたぐ物語（ライバル・謎の人物・師匠）・終盤・裏ダンジョン・エンディング | `src/events/story*.js`、`src/maps/final*.js`、`src/events/final*.js`、`src/maps/postgame*.js`、`src/events/postgame*.js`、`src/systems/{ending,postgame_scene}.js` |
| A20 | reg-a | 地方 1〜4（DESIGN の地方表の 1〜4 行目）の町・ダンジョン・イベント | `src/maps/region{1,2,3,4}*.js`、`src/events/region{1,2,3,4}*.js` |
| A21 | reg-b | 地方 5〜8 | `src/maps/region{5,6,7,8}*.js`、`src/events/region{5,6,7,8}*.js` |
| A22 | qa | 検証・到達性・通しテスト・スクショ一式・シミュレーションの共有部分 | `tools/lib/maps.js`、`tools/lib/cond.js`（§4.3 の条件式の共有実装）、`tools/lib/party_model.js`、`tools/{validate,progress,check_text,smoke,playthrough,shots}.js` |

補足:
- 地方 N のマップの置き方: `src/maps/regionN_<場所>.js`（例: `region3_town.js`、`region3_cave.js`）。
  地方の id・名前・並び順は、ワールド章の地方表で決める。地方の中の出現ゾーンの id は、モンスター章の表で決める。地方の担当はそれを参照するだけ。
- **物語をまたぐ人物**（ライバルなど）が各地方の町に出るときの分担:
  - NPC の置き場所（マップ）は地方の担当。
  - イベントの台本（`story_<名前>`）は story の担当。
  - id の一覧は物語章に書く。
- **超レアのドロップ品**（魔物ごとの一品物）は、モンスター章の表に「魔物の id → 品の id」を先に書き、定義は種別に応じて weapons と gear が書く。
- **シミュレーションの共有部分** `tools/lib/party_model.js`（担当 qa）の形は下の通り。各担当のシミュレーションはこれを使う（ほかの部分がまだできていないうちは、自分のシミュレーションの中に仮の実装を置いてよい）:
  ```js
  const PM = require('./lib/party_model');
  PM.build(R, { tier, members: ['hero', '<compId>'…], heroType, favor, build: 'phys'|'magic'|'balanced',
                gear: 'none'|'shop'|'rare'|'super', level? }) → { party: [CharState], inv }
  PM.levelAt(tier) → 想定レベル   PM.profAt(tier, apt) → 想定の熟練度   PM.withGame(R, {tier}, fn)   // 仮の R.Game で fn を実行
  ```
- 生成物（`dist/`、`debug*.html`）と `design/drafts/**` は、上の表の外にある。

**作業の順番（依存関係の目安）**
1. Phase 0（lead）: §2.9 の変更と、全章の ID 一覧の確定。
2. rules と battle が最初に API の空の形（スタブ）を入れる（関数はあるが、中身は最低限）。
3. ほかの担当は、それに向けて並列で作業する。
4. 最初にそろえる縦の一本道:
   1. タイトル
   2. はじめから
   3. プロローグの町
   4. 主人公作成
   5. 酒場で3人を選ぶ
   6. 最初のダンジョンでの戦闘（閃き・ドロップを含む）
   7. メニュー
   8. セーブ

   これを A22 の smoke.js で毎日通す。

---------------------------------------------------------------------------------------------------
## 8. QA ツールと完了の条件

| ツール | 担当 | 確かめること |
|---|---|---|
| `validate.js` | qa | すべての参照が解決する（アイテム・行動・魔物・系統・ゾーン・編成・店・プール・地方・場所・目的・イベント・マップ・出現位置・ワープ先・絵のキー・曲・効果音）。id の接頭辞（§3.4）、名前の長さ（§1.7）、mods のキー（§5.16）、マップの形（行の長さ・マーク・NPC や宝箱の位置・宝箱の id が一意か・隠しアイテムが無いか）。エラーがあれば exit 1 |
| `progress.js` | qa | 新規ゲームから `game_clear` まで行けるか（BFS。ティアと地方クリアを含む）。8地方を**どの順番でも**クリアできるか（順番を強制する門が無いか）。裏ダンジョンに入れるか |
| `check_text.js` | qa | 使ってはいけない名前（サガ・RS2 の技名・DQ/FF の呪文名や魔物名の一覧）、名前の直書き（`{hero}` を使っているか）、1行の幅、「！」「？」の後の全角スペース、DQ 式の分かち書き |
| `smoke.js` | qa | ブラウザで §7 の縦の一本道を操作し、主要な画面を撮る。console.error がないこと |
| `playthrough.js` | qa | node で、主要なイベントを仮の `ev` で順に実行する（戦闘は simulate で勝たせる）。途中で例外が出ないこと、meta と実際に渡した物が一致すること |
| `shots.js` | qa | 主要な画面のスクショ一式（タイトル・作成・酒場・フィールド・戦闘・閃き・超レア・メニュー各画面・年代記・図鑑・エンディング）を `design/shots/` に出す（最後に施主へ見せる用） |
| `sim_glimmer.js`・`sim_spells.js` | spells | 閃きの頻度（何戦に1回か、強い敵での頻度、覚えた数が少ない人の追いつき、得手不得手の差）、合成術の強さ、知力をレア・超レア装備で固めたときの伸び |
| `sim_loot.js`・`sim_bosses.js` | boss | 実際の抽選でのレア率・超レア率、金色の出る率と効果、ドロップ率アップの装備の効き。各ボスの勝率をティアごとに |
| `sim_zones.js` | mons | 各地方の雑魚を、ティア 0〜8 × その地方のクリア順で。勝率・ターン数・受けたダメージ |
| `sim_growth.js` | rules | レベルと HP/MP/WP、稼いでも伸びにくいこと、控えが6割でどれだけ追いつけるか |
| `test_*.js` | 各担当 | 単体テスト（node、exit 1） |

**各担当の完了の条件**
1. `node tools/build.js --check` が通る。
2. `node tools/validate.js` で自分の id のエラーが 0。
3. 自分のテストとシミュレーションが目標の範囲に入っている（目標は各章）。
4. 画面・絵の担当は、スクショを撮って目で確かめた。
5. 最後の報告に次を書く:
   - 他の担当への依頼（ファイル・何を・なぜ）
   - 他の担当に使ってほしい id の一覧
   - 残っている問題

---------------------------------------------------------------------------------------------------
## 9. 未決事項と他の章への依頼

1. **成長章**: `stats()` の式（攻撃に効くのは腕力か器用さか、系統ごとに決めるか）、`battleExp` のレベル差による減り方、HP/MP/WP の曲線、熟練度の段階の境目、`joinLevel`、戦闘後の回復の方針（B5 では「要検討」）。
2. **戦闘章**: 状態異常の最終的な一覧と、それぞれの働き（凍結・やけどを含む）。中列が受ける物理ダメージの倍率、狙われやすさの重み、全員が中列のときの扱い。
   「バックアタックなし」に合わせて、魔物の不意打ち（`ambush`）は無くすことを勧める。
3. **閃き章**: `R.Glimmer.roll` の確率の式と、技・術のデータに持たせる閃きの項目（`glim`）の形。閃いたときに消費なしで行動を置き換えること（§0.5）を確定させる。
4. **ワールド章**: 地方の id・並び（region1〜8 のファイル名に使う）、ワールドの大きさ（地図の画面は 128×112 で1マス2ピクセル。それより大きければ縮尺を変える）、船を使うかどうか、`DB.config`。
5. **キャラ章**: 主人公のタイプの id（絵のキー `hero_<m|f>_<type>` に使う。案: `warrior`（得意な武器を選ぶ）、`mage`（得意な属性を選ぶ）、`all`（どちらかを選ぶ）の3つ）。仲間 20 人の id。
6. **装備章**: ワープ・ダンジョン脱出を、何度でも使える大事なもの（例: `k_quill` 語り部の羽ペン＝ワープ、`k_bell` 脱出の鈴）にするかどうか。「管理はシンプルに」という点からは、大事なものにすることを勧める。
7. **モンスター章**: 系統の表（系統の id・段階ごとの魔物の id・その段が出始めるティア・spriteId）を並列作業の前に DESIGN に確定させる。絵とデータが同時に進められるように。

以下は今のコードで見つけた問題で、該当する担当が直す:
- `menu.js:221` が `R.Battle.healAmount` を呼んでいるが、その関数は存在しない → §5.6 の `R.Mon.healAmount`。
- tools/lib/maps.js の `parseMap` と、ゲームの `FieldMap.compile` で、解釈が違う（`under` の書き方、id の採番）→ qa は検証ツールでも `R.FieldMap.compile` を使う。
- 同じ宝箱のマークを使い回すと、id が並び順で変わり、セーブが壊れる → 宝箱には必ず明示的な id を付ける（§3.4）。
