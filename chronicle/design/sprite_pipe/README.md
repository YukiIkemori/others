# sprite_pipe — キャラの原画シート → ゲームのスプライト

画像 AI（ChatGPT など）が `design/art_ref/ARUN_REQUEST.md` の指示書どおりに描いたシート（シート1〜9、背景マゼンタ #FF00FF）を受け取り、
ドットの格子に揃えたきれいなスプライトと、コマの位置・足元・武器の持ち手を書いた JSON にする道具。
あわせて、シートの問題（向き違い・大きさのずれ・ポーズの抜け・背景の残り）を一覧にして、画像 AI に送る直しの文まで出す。

仮の絵として、オーナーの設定資料 `design/art_ref/hero_sheet_owner.png` から切り出したアルンのスプライトも同じ形で出してある（下の「仮の絵」）。

必要な物: `python3`（numpy・scipy・Pillow）。プレビューだけ `node` と playwright（`/opt/node22/lib/node_modules/playwright`）。
コマンドはすべて `chronicle/design/sprite_pipe/` で動かす。

---

## 1. 使い方（シートの束から）

```sh
# 1) シートを 1 つのフォルダに置く。ファイル名に番号を入れる: sheet1.png … sheet9.png
#    （sheet5_v2.png・シート5.png・s5.png も可。同じ番号が複数あれば一番新しいファイルを使う）
# 2) まず検査だけ（速い。パレットや書き出しはしない）
python3 tools/sheets.py ~/Downloads/arun_sheets --char arun --out out/arun_v1 --check
#    → out/arun_v1/report.txt と out/arun_v1/review/sheet<N>.png を見る
# 3) 「作り直しを頼む」が無くなったら全部を通す
python3 tools/sheets.py ~/Downloads/arun_sheets --char arun --out out/arun_v1
# 4) 見た目の確認
python3 tools/anim_preview.py out/arun_v1            # 動きの GIF
node tools/preview.js arun_v1                         # UI の見本（戦闘・町）に入れた 1920×1080
# 5) 良ければ、このキャラの見本（向きと配色の検査に使う）を更新する
python3 tools/refs.py arun out/arun_v1
```

- 仲間のシートは §7（`--companion <id>`）。
- `--out` を省くと `out/<char>/` に書く。`out/arun/` には今は仮の絵が入っているので、本番のシートは別の名前（`out/arun_v1` など）に出して、
  良ければ差し替える。
- 終了コードは「作り直しを頼む」があれば 1、無ければ 0。
- 任意のシート（4・8）は無くても通る。必須のシート（1・2・3・5・6・7・9）が無いと「作り直しを頼む」に出る（あるシートだけで書き出しはする）。
- `--only 5,6` で一部のシートだけ。`--size-tol 0.1`（身長の許容。既定 10%）、`--colors 52`（共通パレットの色数）。
- シートのフォルダに画像 AI の `manifest.json`（`[{sheet, file, layout:"RxC", logical_cell:[w,h], image_px:[W,H], frames}]`）があれば、
  マスの位置（`logical_cell × ドット`）で切り分け、ドットの大きさも manifest から取る（シートごとにマスの大きさが違ってよい。例: シート5 は 104×96）。
  並べ方や画像の大きさが指示書と合わなければ自動の切り分けに戻る。使わないときは `--no-manifest`。
- `--no-autofix`: 検査だけで、下の「仮の直し」（ランタンの反転・縮尺の拡大縮小）をしない。

### 処理の流れ（`tools/sheets.py` → `tools/pack.py`）

| 段 | すること |
|---|---|
| 背景を抜く | 縁の色からマゼンタを推定（#FF00FF からずれていても、色むら・ノイズがあっても可）。マゼンタらしい色（min(R,B)−G が大きく R≈B）はすべて背景＝暗いマゼンタの床の影やにじみも背景。絵とマゼンタが混ざった縁（ピンクのにじみ）は色の計算に使わない（**縁の色が紫に濁らない**）。背景がマゼンタでなければ紙の色として縁から塗りつぶして抜く |
| 切り分け | つながった部分 → 行（中心の高さで分ける）→ 列（横に重なる部分をまとめる）→ 指示書の枠へ順番を保って当てはめる。**ポーズが抜けた枠は空のまま**なので、何番が無いかが分かる。遠くの小さな物（文字・キラキラ・影）は捨てて報告。近くの小さな物（はねた髪・剣先）はそのポーズに付ける |
| ドットの大きさ | シートの全ポーズの輪郭の周期から 1 ドットの大きさを測る（指示は 8 px だが、画像 AI は 3〜6 px で描くことが多い）。立ちポーズの身長が指定（フィールド 48・戦闘 64・顔 80）の 10% 以内なら**描かれた格子のまま**（一番くっきり）、外れていれば指定の身長に合わせて取り直す |
| 1 ドット 1 色 | ポーズごとに格子の線を描かれた境目に合わせ（少しゆがんだ格子も追える）、マスごとに色を 1 つにする（外れ値を除いた平均。暗い線は残す） |
| 検査 | §3 の一覧。向き（頭・上半身の見本との鏡像比較＋マフラーの流れる側）、ランタンの手（シート1・2）、描かれた縮尺（頭の大きさ、`tools/bodyscale.py`）、感情マークの除去（シート3・4・8） |
| 仮の直し | ランタンが右手のコマ（下・上向き）は左右反転して足のコマを入れ替え、縮尺が 20% 以上違うポーズは Scale2x＋多数決で拡大縮小（どちらも「作り直しを頼む」にも出す） |
| パレット | 体のシート（1〜8）で共通の約 50 色、顔（9）は別の約 48 色。孤立したドットの掃除、輪郭の色の締め |
| 足元・位置合わせ | 足元（両足の真ん中・一番下の行）を基準点に。歩き・走りの足を出したコマは立ちコマに、待機Bは待機Aに、表情は通常の顔に、武器なし版は武器ありの絵に**体の位置で重ね合わせて**基準点を決める（コマを替えても体が跳ねない）。走りの浮くコマ・跳ぶコマは地面からの高さを保つ |
| 武器の持ち手 | シート7の武器なし 5 ポーズと、シート5・6の同じポーズ（武器あり）の差から、手の位置（grip）・剣先（tip）・角度を出す。武器 5 つはそれぞれの持ち手と先端を出す |
| 書き出し | セットごとに 1 枚の PNG（同じ大きさのマス、どのマスでも基準点は同じ位置）＋ JSON |

## 2. 出力

`<out>/` の中:

| ファイル | 中身 |
|---|---|
| `report.txt` | 検査の結果（日本語）。「作り直しを頼む／目で確かめる／自動で直した／メモ」、画像 AI にそのまま送れる文、シートごとの状態とドットの大きさ |
| `report.json` | 同じ内容と、ポーズごとの元の位置・大きさ・向きの点数 |
| `review/sheet<N>.png` | シートごとの確認表。左が元の絵、右が取り出したドット ×4。枠の色: 緑=OK、青=自動で直した、黄=目で確かめる、赤=作り直し |
| `review/weapons_tryon.png` | 武器なしのポーズに 5 つの武器を持たせた試し（持ち手の位置と角度の確認） |
| `native/<id>.png` | パレット前のドット（手で直すときはこれを直して `--repack`） |
| `sprites/<id>.png` | 仕上がったドット（1 枚ずつ、透明背景） |
| `field/<char>_field.png/.json` | `walk_<dir>_0..2`、`run_<dir>_0..3`、`act_*`（dir = down up left right） |
| `battle/<char>_battle.png/.json` | 左向き。`idle_a idle_b step guard hit weak ko victory_a victory_b glimmer windup slash thrust_ready thrust charge smash cast_a cast_b item evade flee sleep confuse cover` |
| `battle_bare/…` | `bare_idle bare_windup bare_slash bare_thrust bare_cast`（`points.grip`・`points.tip`、`attach`） |
| `weapons/…` | `wpn_sword wpn_greatsword wpn_dagger wpn_bow wpn_staff`（基準点 = 持ち手、`points.tip`） |
| `face/…` | `face_neutral face_serious face_smile face_laugh face_surprise face_sad face_angry face_tired`（少し右向き、別パレット） |
| `palette.json/.png`、`pack.json` | パレット、位置合わせの量・武器の値 |
| `<char>_all_1x.png / _3x.png` | 全セットの一覧 |
| `preview/anim_*.gif`、`preview/*.png` | `anim_preview.py`・`preview.js` の出力 |

### JSON の形（全セット共通）

```js
{ character, set, image, cell: [w, h], anchor: [x, y],       // どのマスでも基準点は同じ位置
  frames: { <id>: { x, y, w, h, anchor, points: { head, center, front, grip?, tip? } } },   // points はマスの中の座標
  anims: { idle: {frames, ms, loop}, attack_sword: {keys: [{frame, ms, dx, ease, hit, fx_at}]}, walk_left: {...}, ... },
  palette: ['#rrggbb', ...], ...セットごとの追加（facing, attach, weapons, target_height） }
```
- 置き方: 画面の地面の点に `anchor` が来るようにマスを描く（`x - anchor[0]`, `y - anchor[1]`）。1 ドット = 1 論理 px。
- 戦闘の `keys` の `dx` は元の位置からのずれ（論理 px、左がマイナス）。エンジンが間をつなぎ、キーでコマを替える。`fx_at: 'front'` は斬撃の光を出す点（`points.front` = 一番左のドット）。
- 武器の持たせ方: 武器の絵（シート7のまま、先端が左）を持ち手 `grip` を中心に `(attach.angle − 180)` 度回し（画面で時計回りが正）、
  武器の `grip` を体の `points.grip` に置く。角度は画像の座標（0 = 右、90 = 下、180 = 左）。回したドット絵は崩れやすいので、
  ゲームでは系統ごとに**焼いて**使う（V2_PLAN §2.10）。弓・杖など向きの違う物も同じ式で、描かれた向きのまま回る。

## 3. 検査のメッセージ

| 区分 | 内容 | どうする |
|---|---|---|
| 作り直しを頼む | シートが無い（必須）／ポーズが見つからない／画像の端で切れている／**向きが逆**（戦闘は左、顔は少し右、フィールドは行ごとの向き）／**身長が他より 15% 以上違う**／背景がマゼンタでない | `report.txt` の「画像 AI にそのまま送れる文」を送る（例:「シート5の3番（一歩前に踏み出す）が右を向いている。全部左向きにして、同じ条件で描き直して」） |
| 目で確かめる | 向きがはっきりしない（点数が 0 に近い）／身長が 6〜15% 違う／行の数が合わない・ポーズが多い／ポーズどうしが近すぎる／ドットの格子がはっきりしない（ぼかし）／配色が資料から外れた色が多い（人物が違って見えないか）／マゼンタが絵に残った／待機AとBが同じ・差が大きすぎる／表情の大きさが通常と違う／武器の位置が取れない・武器の縮尺が違う／JPG | `review/sheet<N>.png` を見て、許せるならそのまま、だめなら作り直しを頼むか §4 で手で直す |
| 自動で直した | 背景の色むら・ノイズ／暗いマゼンタの床の影・にじみ／灰色の床の影／余計な物（文字・影・エフェクト）／光や軌跡らしい物（戦闘）／身長が指定と違うので合わせた／行の足元のずれを揃えた | 基本はそのまま。消えすぎていないかだけ見る |
| メモ | 1 ドットの大きさ（指定 8 px との違い）、任意のシートが無い、同じ番号のファイルが複数、名前の読めないファイル、向きの見本が無い | 読むだけ |

- 向きの検査（`tools/facing.py`）は 3 つの手がかりの合計: 頭と上半身の見た目を向きの分かっている見本（`configs/refs/<char>/<向き>_<btl|fld|face>_<id>.png`）と比べる鏡像テスト、
  マフラーの端が流れる側（左向きなら右）。下・上向きの行は、左右対称にした頭を見本の「下」と「上」の平均の軸に投影する。
  見本は同じ id を除いて使う（見本と同じ回を検査しても自分とは比べない）。「作り直し」は合計が大きく負で、2 つ以上の手がかりが逆を指すときだけ。
  見本が無いキャラ（仲間など）は、同じ回の多数決だけになるので、**行ごと全部が逆**だと気づけない。最初の 1 回を目で確かめて `tools/refs.py` で見本を作る。
- アルンの見本は 2026-09-26 に届いた本番のシート（`design/art_ref/arun_sheets`）から作った: 戦闘はシート5の待機A（基準）ほか、フィールドはシート1・2 の全行とシート3・4 の一部、顔は通常・真剣・微笑み。
  仮の絵（設定資料）から作った古い見本は `configs/refs/arun_owner/`（`tools/mock_sheets.py` の試験用）。
- 縮尺の検査（`tools/bodyscale.py`）: 剣を掲げたポーズは外枠の高さが変わらないので、頭の大きさで比べる。見本の頭（戦闘は待機A・一歩前・武器なし待機・突きの構え、
  フィールドは各向きの立ち）を 0.55〜1.45 倍で当てはめ、組（戦闘・フィールド）の中央値を 100% とする。20% 以上は作り直し＋仮の拡大縮小、12〜20% は目で確かめる。
  横たわるポーズ（`ko`・`act_lie`）は頭が 90 度回っているので測らない。
- 武器（シート7 行2）: 手に持った剣の刃（シート5・6 の鋼色の細長い部分）と武器だけの片手剣の刃の長さを比べ、12% 以上違えば 5 つとも体に合わせて縮める（自動で直した）。
  武器なしのポーズの持ち手は、武器ありのポーズの刃の向きと柄の位置から出す（刃が見えない詠唱は差分から）。体の形が違って当たらないポーズは `configs/overrides/<char>.json` で直す
  （アルンは振りかぶりと振り抜き）。
- 人物が違って見えるかは機械では決めきれない。配色の外れ（`colors`）は手がかりの一つ。`review` の元の絵と並べて必ず目で見る。
- 指示書 §6 のとおり、ドットのにじみ・数ドットの大きさの誤差・背景の色むらは作り直さなくてよい（自動で直る）。

## 4. 手で直す

1. **ドットを直す**: `<out>/native/<id>.png` を画像エディタで直し（1 ドット = 1 px、透明背景）、
   `python3 tools/sheets.py <folder> --char arun --out <out> --repack`（切り分けと検査を飛ばして、パレット・位置合わせ・書き出しだけやり直す）。
   もう一度 `sheets.py` を普通に通すと `native/` は上書きされるので、直した物は別に取っておく。
2. **基準点・武器の持ち手を直す**: `configs/overrides/<char>.json` を作る。`--repack` で反映。
   ```json
   { "anchors": { "act_lie": [30, 26], "evade": [22, 60] },
     "attach":  { "bare_windup": { "grip": [14, 30], "angle": 250 } },
     "weapons": { "wpn_staff": { "grip": [20, 2] } } }
   ```
3. **1 ポーズだけ差し替える**: 画像 AI に描き直させたシートを同じ番号の新しいファイルとして置けば、新しい方が使われる。
   1 ポーズだけ別に描かせた場合は、元のシートの同じ枠に貼り込んでから通す（枠の位置で何番かを決めているため）。
4. **向きだけ逆**: 左右反転しただけで済む絵（戦闘の左右）は、`native/<id>.png` を反転して `--repack` でもよい（剣を持つ手が逆になるので、目で確かめる）。

## 5. 仮の絵（オーナーの設定資料から）

```sh
python3 tools/extract.py configs/arun_owner_sheet.json     # 切り出し → out/arun/native, sprites, palette（50 色）
python3 tools/build.py configs/arun_owner_sheet.json       # セット → out/arun/battle, field, portrait
python3 tools/compare.py arun --out out/arun/compare_source.png   # 元の絵と並べる
python3 tools/anim_preview.py out/arun                     # 待機・攻撃・歩きの GIF
node tools/preview.js arun                                 # 戦闘・閃き・勝利・町の見本（1920×1080）
python3 tools/refs.py arun_owner out/arun                  # 向きと配色の見本（configs/refs/arun_owner。本番の見本 configs/refs/arun は out/arun_v1 から）
```

- 設定資料は紙の色の背景・場所がばらばらなので、切り出す箱を `configs/arun_owner_sheet.json` に書いてある（シートの形式とは別の道）。
- 大きさ: 戦闘 6 ポーズを身長 64（元は 43 ドット相当で描かれているので、格子を合わせて 64 に取り直し）、フィールド 4 方向は描かれた格子のまま身長 50（指定 48 の範囲内）。
  立ち絵 65×87、顔 39×40 と 24×27（各自のパレット）。
- 出力の id はシートの形式と同じ名前: 戦闘 `idle_a idle_m idle_b thrust slash hit ko victory_a`（待機の呼吸は 1 行ずらしで作った 3 コマ）、
  フィールド `walk_<dir>_0..2`（足の動きは三面図から作った仮の物、右は左の反転）、`stand_threeq`。
- 動き: `idle`（呼吸）、`attack_sword`（踏み込み → 突き → 斬り → 戻る。`dx` で前に出る）、`hit`、`ko`、`victory`。
- `preview/hero_patch.js` が UI の見本（`design/art_proto/ui`）の主人公をこのセットに差し替える（`?hero_btl=<id>`・`?hero_fld=<id>`・`?hero_light=0`）。

## 6. 試験用のシート

```sh
python3 tools/mock_sheets.py                 # work/mock_sheets/: 仮の絵からシート1〜3・5〜7・9を「画像 AI らしく」作る
python3 tools/sheets.py work/mock_sheets --char arun_mock --refs configs/refs/arun_owner
python3 tools/mock_sheets.py --clean --dst work/mock_sheets_clean   # わざとの間違いなし → 作り直しが 0 件になるはず
```
ゆがんだ格子（1 ドット 3.6〜8 px、±18%）、柔らかい縁、色のノイズ、#FF00FF から少しずれた背景に、わざとの間違い（行ごと向きが逆・1 ポーズだけ右向き・
1 ポーズ抜け・1 ポーズだけ大きい・文字・床の影）を入れてある。入れた間違いは `work/mock_sheets/truth.json`。
今の結果: わざとの間違いは全部「作り直しを頼む／目で確かめる」に出る。間違いなしのシートでは作り直し 0 件
（シート3の 3 番は試験のために斜めの絵を反転して置いているので「目で確かめる」が 1 件出る）。

## 7. 仲間のシート（`design/art_ref/COMPANIONS_REQUEST.md`）

仲間 20 人は 1 人 5 枚（`comp_<id>_s1.png` 〜 `s5.png`）。並べ方と身長は `design/art_ref/companion_sheets.json`。
同じ `sheets.py` に `--companion <id>` を付けて通す（中身は `tools/companion_spec.py`）。検査・切り分け・パレット・位置合わせはアルンと同じ。

```sh
python3 tools/sheets.py ~/Downloads/selma --companion selma --check     # まず検査だけ → out/comp_selma/report.txt
python3 tools/sheets.py ~/Downloads/selma --companion selma             # 全部 → out/comp_selma/
python3 tools/to_v2.py out/comp_selma --dst /tmp/v2_selma               # v2 の形（look は companion.json から。--dst を省くと v2/assets/sprites/selma）
python3 tools/refs.py selma out/comp_selma                              # 目で確かめて良ければ、向きと配色の見本 configs/refs/selma を作る
```

| ファイル | 並べ方 | 使い方 | 書き出す先 |
|---|---|---|---|
| s1 設定画 | 2×4（三面図 4 ＋ 待機・顔・配色） | **見本だけ。ゲームには入れない。** 正面→下・背面→上・側面→左（フィールド）、側面と待機→左（戦闘）、顔→少し右 の向きの見本と、配色の見本にする | `design/`、`refs/`、`review/sheet1.png` |
| s2 歩き | 4×3（アルンのシート1と同じ id） | ランタンなし（ランタンの検査はしない） | `field` |
| s3 戦闘の基本 | 2×5（シート5と同じ id） | 待機A/B の呼吸の検査 | `battle` |
| s4 行動＋武器なし | 3×5（行1・2 = シート6、行3 = シート7 の行1） | `s4b` があれば s4 は 2×5・s4b は 1×5 として読む | `battle`、`battle_bare` |
| s5 顔 | 1×4 `face_neutral face_smile face_surprise face_pain` | `face_pain`（苦しい）は新しい表情 | `face` |

- **ファイル**: 名前の `s1`〜`s5`・`s4b` で決める。作り直し `comp_selma_s3_v2.png` は番号の大きい方（同じなら新しい方）を使う。
  1 つのフォルダにほかの仲間のファイル（`comp_<別の id>_…`）があっても、そのファイルは使わない。
- **身長**: 仲間ごとに `companion_sheets.json` の値で検査する（`measureH` = 帽子を含む見た目の高さで大きさを測り、書き出す JSON の `target_height` は
  `heightDots` = 体の高さ）。背の低いドッカ（戦闘 52・フィールド 39）や高いハーゲン（68・51）は、描かれた高さのまま使い、64/48 に直さない。
- **シートが無いとき**: s2〜s5 が無ければ「作り直しを頼む」に「仲間◯◯（id）のシート◯（…）を作って」と出て、あるシートだけで書き出す。
  **s1 が無くても通る**（「目で確かめる」に出る）。そのときは向きの見本が無いので、向きの検査は同じ回の多数決だけになる（行ごと全部が逆だと気づけない）。
  `configs/refs/<id>/` があればそれも使う。
- **画像 AI に送る文**: 「仲間セルマ（selma）のシート3の2番（待機B）が右を向いている。全部左向きにして、同じ条件で描き直して」のように、仲間の名前と id が付く。
  s4b の中の番号は「シート4bの 1〜5 番」。
- **武器**: 仲間は武器だけの絵を描かない。`weapons` は `--arun`（既定 `out/arun_v1`）のアルンの武器 5 つをそのまま写す。
  武器なしのポーズの持ち手: 剣の仲間は武器ありの同じポーズ（行1・2）から取る（アルンと同じ）。剣以外の仲間の 12〜14 番（振りかぶり・振り抜き・突き）は
  「片手剣の握りの形」なので武器ありの絵が無い。アルンの同じポーズの持ち手と角度を、ポーズの大きさに合わせて写す（`attach.<id>.generic = true`）。
  「目で確かめる」に出るので `review/weapons_tryon.png` を見て、ずれていれば `configs/overrides/<id>.json` で直す。
- **書き出し**: `battle` の JSON の `weapon` はその人の得意武器（sword / greatsword / dagger / bow / staff）。エンジンは装備がそれと違うときだけ
  武器なし版＋武器の絵を使う。`field` には `lantern_drawn: false`。`companion.json` に id・名前・身長・使ったファイル。
- **v2**: `to_v2.py` は顔の `face_pain` を `sad` にする（`angry` は無いので `neutral`）。`look` は `companion.json` の `look`（= id）。
- **試験**: `python3 tools/mock_companions.py` が `out/mock_companions/<id>/` にアルンの絵を色替え・大きさ替えした仮のシートを作る
  （selma 64/48 剣・全 5 枚／hagen 68/51 大剣・s4 と s4b に分割・シート3の3番だけ右向き／dokka 52/39 大剣・s1 と s5 なし）。期待する結果は各フォルダの `truth.json`。
  今の結果: selma 作り直し 0 件（剣の振り抜きの持ち手 1 件を目で確かめる）、hagen は入れた右向きの 1 件だけ作り直し、dokka はシート5がない 1 件と s1 なしの注意。
  身長は描かれたまま（selma 63.8・hagen 68.4・dokka 50.9 ドット）。

## 8. 限界・気をつけること

- 切り分けは「行ごとに並んでいる」前提。画像 AI が行と列を入れ替えた（4×3 を 3×4 で描いた）ときは「ポーズが多い／行の数が合わない」で気づくが、自動では並べ替えない。
- 武器の持ち手は、武器ありと武器なしの絵が同じポーズ・同じ大きさで描かれているときだけ正しい（体が重ならなければ「あてにならない」と出る）。
  持ち手の位置は数ドットずれることがあるので、`review/weapons_tryon.png` で確かめ、必要なら overrides で直す。
- ランタン（シート1・2の左手）があるかは検査していない。目で見る。
- 顔は「少し右向き」の見本で向きを比べる。8 枚の重なり（表情以外がずれない）は大きさだけ検査している。
- 仮の絵の戦闘ポーズは元の絵が小さい（43 ドット相当）ので、64 に取り直した分だけ細部が甘い。スキルの剣は元の絵で斬撃の光に隠れていて、刃が短い。
- `work/` には試作中の中間画像が残っている（消してよい）。

## 9. NPC のシート（`design/art_ref/NPC_REQUEST.md`・`npc_sheets.json`）

同じ `sheets.py` に `--npc <id>` を付けて通す（中身は `tools/npc_spec.py`）。画像 AI で作るのは `tools/gen_sheets.py npc …`（中身は `tools/npc_gen.py`）。

```sh
python3 tools/sheets.py ../art_ref/gen/npc/berna --npc berna --out out/npc/berna --check     # 段A・段B は NPC の id
python3 tools/sheets.py ../art_ref/gen/npc/grp_pen_1 --npc npc_pen_man --out out/npc/npc_pen_man   # 段C は人の look（二人のシートの半分）
python3 tools/to_v2.py out/npc/berna                                                        # look は npc.json から → v2/assets/sprites/<look>
python3 tools/gen_sheets.py npc berna --sheets 1        # 作る（アルンの絵を NPC の身長に縮めた型を塗り替える edit）→ 検査 → 直し（1 枚 3 回まで）
python3 tools/gen_sheets.py npc berna --approve 1       # 目で見て良ければ、s1 を見本として承認（段A の s2・s3 は承認の後）
python3 tools/gen_sheets.py npc-batch --tier B --export # 段ごとに npc_sheets.json の順で
python3 tools/gen_sheets.py npc-lineup berna fine grp_pen_1 --out /tmp/lineup.png   # アルンと並べた町の並び（1 ドット = 4 px）
```

| ファイル | 並べ方 | 行き先 |
|---|---|---|
| `npc_<id>_s1`（段A） | walk 4×3（マス 80×64、アルンのシート1と同じ id） | `field` |
| `npc_<id>_s1`（段B） | walk_act 4×4：列1〜3 = 歩き、列4 = `act_nod act_surprise act_call act_sig`（どの行も手前向き。向きの検査は列ごと `col_face`） | `field` |
| `npc_<id>_s2`（段A） | act12 3×4（アルンのシート3、`act_draw` → `act_sig`） | `field` |
| `npc_<id>_s3`（段A） | face6 2×3（マス 96×96）`face_neutral smile sad / angry surprise closed` | `face` |
| `npc_grp_<group>`（段C） | walk_pair 4×6：列1〜3 = 人物A、列4〜6 = 人物B。look ごとに半分を `<out>/src/` に切り出して walk として通す | `field`（look ごと） |

- 作り直しは `_v2`・`_v3`（番号の大きい方、同じなら新しい方）。
- **身長**: look ごとに `measureH.field`（帽子・荷物を含む）で大きさを検査し、JSON の `target_height` は `heightDots.field`。48 に直さない。
- **頭身の検査**（`npc_spec.check_proportions`）: 歩きの立ち 4 コマで、首の行・頭の幅・肩の幅を体の高さで割り、アルン（シート1 の 12 コマの中央値：首 0.29・頭の幅 0.43・肩 0.40）と比べる。
  頭が 8% 以上小さい＝作り直し。大きすぎるのは帽子・頭巾の無い人だけ作り直し（帽子のある人は目で確かめる）。フードや長い髪で首が見えないときは頭の幅だけ。子どもも同じ比（全体の高さだけ変える）。動物は検査しない。
- **ランタン**は `lantern: true` の人だけ検査（段B の列4 は除く）。`field` の JSON に `lantern_drawn` と `npc`（段・霊・色替えの主色と variants）を書く。`npc.json` に look・身長・使ったファイル・頭身の比。
- 演技12 の 5 番（片ひざ）・6 番（座る）は、アルンのシート3 でも頭の縮尺の検査が 127〜130% と出る（しゃがんだ頭の読み違い）。`npc_gen` はこの 2 つの 142% 未満の「縮尺」は直さない。
