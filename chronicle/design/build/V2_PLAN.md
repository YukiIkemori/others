# V2_PLAN — ルミナス・クロニクル 〜八つの灯火〜 v2 マスタープラン（ほぼゼロベースの作り直し）

作成 2026-09-26（リード）。対象: BRIEF Part A24（ほぼゼロベース・まず縦切り）と、それまでの指示のすべて（A2〜A33。後の指示が前の指示より優先）。
この文書は **v2 を複数の担当で並列に作るための正本** で、置き場所・設計・縦切りの範囲・担当の分け方・契約（関数の形とデータの形）・完了の条件を決める。
中身の仕様は次の文書が正で、この文書はそれらを「どこに・誰が・どの順で」に落とす。食い違いは §0.2 の表で決着させる。

| 文書 | 役割 | 状態 |
|---|---|---|
| `design/BRIEF.md` | オーナーの指示（Part A と A2〜A33） | 正（後の指示が優先） |
| `design/build/WORLD_REDESIGN.md` | 世界・物語の型・町・ダンジョン・手がかり帳・ボスの考えどころ | 第 3 版をオーナー了承（A31） |
| `design/build/MODERN_UI.md` | 16:9・UI の部品・画面ごとの配置・夜の光・フィールドの絵 | 見本をオーナー了承（A33） |
| `design/build/ART_REWORK.md` | 絵の作り（焼く・層・図書館・検査） | MODERN_UI と食い違う所は MODERN_UI |
| `design/build/STYLE_REFERENCE.md` | 参考作の分析と数値の目標・チェックリスト | R1〜R6 採用 |
| `design/build/STATS_REWORK.md` | 能力値 0〜25・武器 5 系統・武器枠 1・レベルなし・盗み専用 | リードの決定つき |
| `design/build/SYSTEMS_REWORK.md` | 熟練度 1〜100・WP 廃止 | 7 系統の部分は A29 で 5 系統に、レベルの部分は A30 で廃止 |
| `design/build/LEAD_DECISIONS.md`・`DESIGN.md`・`STYLE_JA.md` | 旧版の決定と表記 | 物語の核・人物・表記の規則として参照 |

作業の約束（全員）: **`/home/user/others/rpg/` は触らない。git は使わない（コミット・ブランチ・差分の取得もしない）。API キーをファイルに書かない。モデルの識別子（モデル名）をファイルに書かない。文章は日本語、識別子は英語。** テスト用 URL（Artifact）の**更新も新しい公開も**、オーナーの指示があったときだけ（A17。オーナーは遊んでいる途中なので、勝手に公開・更新しない）。他社の作品名・固有の名前は v2 の木（コード・データ・指示文・スクショの名前）に書かない（A16 追記・A32。`check_text` が検査）。

改訂 2026-09-26（リードの見直し）: 契約の穴・仕様との食い違い・性能の作り・完了の条件を直した。直した所の一覧は §8。

---------------------------------------------------------------------------------------------------
> **リードの追記（2026-09-26、BRIEF A34）**: キャラ（主人公・仲間・NPC）の絵は外部の画像 AI の原画を元にする。CAST の仕事は「原画 → ドットの格子に揃える・減色・背景抜き・足元と大きさ合わせ・スプライトシート化・ポーズ間の補間 → `hd:field:*`・`hd:btl:*`・`hd:face:*` に登録」の工程（`tools/sprite_pipe/*`）と、キーが届くまでの仮の絵（試作の骨組みの絵）。最初の実物は、オーナーが示した主人公の設定資料 `chronicle/design/art_ref/hero_sheet_owner.png`（三面図と戦闘ポーズ 6 つ）から切り出す。

## 0. 要約

### 0.1 決定の一覧

| # | 決定 |
|---|---|
| 0.1 | v2 は **新しいディレクトリ `chronicle/v2/`** に作る（自前の `src/`・`tools/`・`dist/`）。今のゲーム（`chronicle/src` → `chronicle/dist`）は縦切りをオーナーが了承するまで**そのまま動く状態で残す**。v2 は今の木を**読むだけ**（移植の元・BGM・ボイス）。 |
| 0.2 | 残すもの: 物語の核と人物（夜の世界に合わせて見せ方を変える）、BGM とボイス（`chronicle/assets/` からビルドで読む。1 本も捨てない）、戦闘・閃き・熟練度の計算（STATS_REWORK・A29・A30 を当てて移す）、データの考え方（ティア・系統・プール・図鑑）。**絵・UI・フィールド・世界・イベントはすべて新しく書く**。 |
| 0.3 | 画面は論理 **960×540（16:9）**、幅は 720〜1260 で可変、縦持ちは 540×約 1170。1 art px = 1 論理 px、`R.SCALE` 2／4（MODERN_UI §1）。フィールドは 1 マス 32 art px、既定の広さ「ふつう」（A33 ①「今のまま」）。 |
| 0.4 | 名前空間は今と同じ `window.RPG`（`R`）。セーブの接頭辞は **`luminous_chronicle_v2_`**、`R.Game.ver = 2`。旧セーブは読まない（A24）。 |
| 0.5 | すべてのファイルは「登録だけ」の IIFE。ほかのファイルの物は関数の中でだけ読む（読み込み順に依らない）。例外は `core/` の先頭 5 ファイル（§2.4）。 |
| 0.6 | 縦切り = **序章＋森の地方（ヴェルダの森）を全部入り**（A31 ④）。完成の定義は §3.16。オーナーが了承したら残り 7 地方・終盤・クリア後を v2 の上で作る（この文書の外、次の計画）。 |
| 0.7 | 担当は **14**（リード＝CORE を含む。§4.1）。ファイルは 1 つにつき担当 1 人。担当どうしは §2.5 の契約だけで話す。 |
| 0.8 | 段階: **P0 骨組みと契約**（リード）→ **P1 並列**（14 担当）→ **P2 組み込み**（通しで遊べる）→ **P3 仕上げと QA**（性能・見た目・釣り合い・文）。各段の関門は §4.3。 |
| 0.9 | 顔絵（会話・メニュー）は A33 ② で OpenAI の画像 API を使う。**キーはオーナーが後で渡す（「帰宅したら渡すから待ってて」）。それまで API は呼ばない**。キーが届くまでは **骨組みから焼いた仮の顔** を使い、あとで差し替える口（`R.Portrait`）と道具（`v2/tools/portraits.js`、`--dry-run` まで）を先に作る（§6）。縦切りは仮の顔でも完成とし、顔絵を待って止めない。それ以外の絵はすべてコードで描く（ART_REWORK 0.1 のまま）。 |
| 0.10 | 性能は「焼いて使い回す」を全員の約束にする（§2.10）。チャンク・人・魔物・背景の焼く時間と持つ量に上限を決め、P1 の中間の関門 G1 から毎日測る。 |

### 0.2 文書どうしの食い違いの決着（後の指示が優先）

| 所 | 古い記述 | v2 での扱い | 根拠 |
|---|---|---|---|
| MODERN_UI §6.4・6.6・6.7・6.15・6.18、§6.1 の札 | Lv・次のレベルまで・経験値、装備 9 枠（武器1・武器2） | **Lv・経験値は一切出さない**（HP/MP の伸びだけ）。装備は **8 枠**（武器・盾・頭・体・手・足・アクセ1・アクセ2） | A29・A30・A33 |
| MODERN_UI §6.17 の行動の一覧 | 武器1 の系統名・武器2 の系統名 | 行動は「攻撃（持っている武器の系統の技）／術／防御／道具」。技は持っている武器の系統だけ | A29、STATS_REWORK §8.6 |
| SYSTEMS_REWORK §3 | 武器 7 系統 | **5 系統**（剣・大剣・短剣・弓・杖）。後列から届くのは弓・杖と一部の技 | A29 |
| SYSTEMS_REWORK・DESIGN の成長 | レベル・経験値 | **成長の点 `c.gl`**（画面に出さない）。`R.Growth`（STATS_REWORK §9） | A30 |
| WORLD_REDESIGN §4.10・§4.11 | ボスの盗み専用は 1 戦 1 回・1/8〜1/16、sim は「地方の目安のレベル」 | 盗み専用は **1/16〜1/32（ボスも同じ）、戦闘中は成功のたびに判定してよい**。sim は gl（`glAt(tier, kind)`） | A31 ⑥、STATS_REWORK のリードの決定 5 |
| DESIGN §10.7 P7（オットーの心得） | 「槍・弓・鞭のほかは前に届かない」「武器は 2 つ」「オート」 | 3 行を書き直す（後列から届くのは弓と杖／武器は 1 つ／リピートと倍速）。ボイスは無い台詞なので文を変えてよい | A26・A29 |
| DESIGN §10.7 P10 | ベルナが 8 地方の噂を読み上げる | ボイス 5 行はそのまま、読み上げはやめて手がかり帳を渡す（WORLD_REDESIGN §3.4） | A21 |
| DESIGN §10.8.0 | 地方のあと「その夜は、町の宿で眠った」→ 翌朝ティアの場面 | ティアの場面は **次に宿に泊まるか町に入ったとき**（`R.Game.pendingTier`、E17） | WORLD_REDESIGN §3.4 |
| ART_REWORK §0.2・§1.1・§1.6・§1.7 | 256×224、art px = 0.5 論理 px、タイル 16 | MODERN_UI §1・§2・§7 の数値 | MODERN_UI §8.1 |
| ART_REWORK §0.1 | 画像生成 API は使わない | **顔絵だけ** OpenAI の画像 API（A33 ②）。ほかは今のまま | A33 |
| MODERN_UI §10 U1〜U8 | 未決 | U1 見本どおり（32 px、A33 ①）、U2 → §6、U3 顔の枠のある人は常に名前、U4 品の値の差は出す、U5 地方ごとに空が明るくなる（A33 ③）、U6 直前の戦闘から（A33 ⑤）、U7 → §3.11、U8 この方向で作る | A33 とリードの判断 |
| WORLD_REDESIGN §8 の ⑥（泉から泉へ飛ぶ）・⑩（ボイスの追加） | 未回答 | 縦切りでは**入れない・足さない**。§7 でオーナーに聞く | — |
| 仲間の色 | 見本の 4 人 | セルマ＝赤茶、ヴィオラ＝薄紫（A33 ④） | A33 |
| WORLD_REDESIGN §4.11 の品の名前・id、§6.6 E23 の `stealOnly:{item, rate}` | 根食らい「千年樹の芽の杖」、データの項目 `stealOnly` | **STATS_REWORK §7 のデータの形と id が正**: 魔物の `drops.steal = {item, rate}`、品の id は `<枠>_st_<名>`（縦切りでは `ac_st_rooteater`「千年樹の若芽」・`ft_st_jewel_hare`「宝石ウサギの靴」）。率は 32（通常）・16（レア魔物・ボス）。WORLD の「盗んだときのティアで数値」は使わず、STATS_REWORK の固定のティアの値 | STATS_REWORK（実装の仕様）とリードの決定 5 |
| WORLD_REDESIGN §1.3 の空の表（ティア 0〜1 は同じ「深い夜」） | 2 ティアごとに一段 | **ティアごとに一段**明るくする（`R.Sky.at(0..8)` の 9 段。0 と 1 は同じ「深い夜」の範囲の中で 1 の方が少し明るい） | A33 ③、MODERN_UI U5 |
| MODERN_UI §4.2「光の輪 約 3 マス（E6 と同じ）」と WORLD E6「半径 4 マス」 | 2 つの値 | **暗がりの階で見える半径は 4 マス**（遊びの値、WORLD E6）。ふつうの階の光の輪の絵は 88 art px（約 2.75 マス、STYLE_REFERENCE R4）。燭台・泉の周りの明るさは 3 マス | WORLD E6・E11 |
| MODERN_UI §5.4「会話のオート（Y）」、§5.1「オートセーブ」と、§8.8 の「オートの文字を出さない」 | 画面の言葉が食い違う | 戦闘の「オート」（A26）だけを禁じる。**会話の自動送りは「自動送り」と書く**（「オート」の字を使わない）。「オートセーブ」はそのまま使ってよい | A26 |
| DESIGN §4.12.2「全滅は所持金半分で直前の町へ」と MODERN_UI §6.19「失う物なし」 | 決まっていない | **「直前の戦闘からやり直す」（既定）は失う物なし**。「最後に泊まった宿から」は所持金半分（Part A の規則をこちらに残す）。§2.5.3・§3.13。オーナーに確かめる（§7 の 8） | A33 ⑤、Part A |
| WORLD_REDESIGN §5.4 フェルン「地面の層と樹上の層を 1 枚のマップで、はしごで行き来」 | 仕組みが無い | マップの **2 つの高さ（`lv` 0/1）** を FIELD に足す（§2.6.1 の `deck`・`ladder`）。フェルンだけで使う | WORLD §5.4 |
| A11「メニューの表示：コンパクト／大きく」 | 設定の行 | MODERN_UI の窓が既定でコンパクトなので設定の行は作らない。大きくしたい人は「字の大きさ」で | A23・MODERN_UI §3.3 |
| A4「一度見つけた隠し通路は以後見分けやすい表示」と A15「見つけるまで見分けがつかない」 | 両立の書き方が無い | 見つけるまでは周りの壁と同じ画素（`check_secrets` が画素で比べる）。見つけた後は床の素材で描き直し、壁の縁に細い印（`R.Game.secrets`） | A4・A15 |

---------------------------------------------------------------------------------------------------
## 1. 置き場所と、移すもの・新しく書くもの

### 1.1 置き場所

```
chronicle/
  src/ tools/ dist/ …        今のゲーム（v2 の作業中は誰も編集しない。v2 は読むだけ）
  assets/bgm/ assets/voice/  録音済みの BGM 32 曲・ボイス 164 本（v2 のビルドが読む。書き換えない）
  assets/portraits/          新設（顔絵の差し替え先。§6。最初は空）
  design/build/V2_PLAN.md    この文書
  design/portraits/          新設（顔絵の指示文・一覧・API の記録。§6）
  v2/                        ← v2 のすべて
    src/  tools/  dist/  assets/fonts/  design/shots/  README.md
```

- v2 の作業で `chronicle/v2/` の外に書いてよいのは **`chronicle/assets/portraits/`・`chronicle/design/portraits/`・`chronicle/design/build/*.md`（リードだけ）** だけ。
- 今の木（`chronicle/src`・`chronicle/tools`・`chronicle/DESIGN.md`）は v2 の担当は編集しない。今の木では SR Phase 2 などの作業がまだ動いているので、移植は **P0 の時点の写し** から行い、写した元のファイルのハッシュを `v2/tools/port/manifest.json` に残す（あとで元が直ったとき、`node v2/tools/port/diff.js` で「写した後に元が変わったファイル」を一覧にして取り込みを判断する）。
- 今のビルド（`node tools/build.js`）は `src/` だけを読むので、`v2/` があっても今のゲームは影響を受けない。v2 のビルドは `node v2/tools/build.js`。

### 1.2 移すもの・新しく書くもの（パスつき）

凡例: **そのまま**＝形を合わせる程度の小さな直し／**移して直す**＝中身を仕様に合わせて書き換える／**参考**＝読んで作り方をまねるだけ（コードは新しく書く）／**新規**。

| 元 | v2 の先 | 扱い | 担当 | 直す中身 |
|---|---|---|---|---|
| `src/core/audio.js` | `v2/src/core/audio.js` | そのまま | CORE | 媒体の一覧 `RPG_MEDIA` の読み方（外部フォルダ・埋め込みの両方）、ボイスの間の BGM を下げる |
| `src/audio/*.js`（合成 BGM・効果音・ジングル 9 ファイル） | `v2/src/audio/` | そのまま | CORE | `levelup` のジングルを HP/MP の伸びの音として使う（A30）。新しい効果音（泉・手がかり・隠し通路・灯籠・予告）を足す |
| `src/core/input.js` | `v2/src/core/input.js` | 移して直す | CORE | 論理座標のポインタ、`lastDevice`、`prompt()`、縦持ちのスティック（MODERN_UI §8.4） |
| `src/core/save.js` | `v2/src/core/save.js` | 移して直す | CORE | 記録 3 枠＋オート＋中断、版 2、冒険の合言葉（A2）、新しい設定の項目 |
| `src/core/ns.js`・`engine.js`・`gfx.js`・`src/main.js` | `v2/src/core/*`・`v2/src/main.js` | 参考 | CORE | 新しい座標（960×540・可変・SCALE）、場面の積み上げ、`R.fit` |
| `src/systems/rules.js` | `v2/src/systems/rules.js` | 移して直す | RULES | STATS_REWORK §2・§3.1・§5.2・§8.1・§8.2（`abilMul`・`K.WA`・枠 8・5 系統・`K.ABIL_GEAR`）、`XPct`・`bonus`・`grow` の削除 |
| （新規） | `v2/src/systems/growth.js` | 新規 | RULES | STATS_REWORK §9（`R.Growth`） |
| `src/systems/glimmer.js` | `v2/src/systems/glimmer.js` | 移して直す | RULES | GF の式（§2.2）、技の候補は今の武器の系統だけ（§8.6）、熟練度 §5.2 |
| `src/systems/party.js`・`tier.js` | 同名 | 移して直す | RULES（party）・EVENTS（tier） | 経験値 → `R.Growth.afterBattle`、途中加入の gl |
| `src/systems/state.js` | `v2/src/systems/state.js` | 移して直す（形は新しく） | EVENTS | §2.6.3 の `R.Game` の形。`check(cond)` の書き方は今のまま＋新しい条件 |
| `tools/lib/cond.js` | `v2/tools/lib/cond.js` | 移して直す | EVENTS | 新しい条件（§2.5.10） |
| `tools/lib/maps.js` | `v2/tools/lib/maps.js` | 移して直す | QA | 新しいマップの形（§2.6.1）。歩数・到達の計算は progress と sim_zones の区間が共有する |
| `src/systems/mon.js`・`battle.js`・`battle_ai.js` | 同名 | 移して直す | BATTLE | STATS_REWORK §2（battle/mon の分）・§7.3 盗み・§8.2・§9.4・§10.2、ボスの予告（E18）、オートの AI は sim 専用として残す（A26） |
| `src/data/elements.js`・`statuses.js`・`spells_*.js` | `v2/src/data/` | そのまま | RULES | 熟練度の境目（SYSTEMS_REWORK §1.4）、MP の値 |
| `src/data/weapontypes.js`・`techs_*.js`（7 ファイル） | `weapontypes.js`・`techs_{sword,greatsword,dagger,bow,staff}.js` | 移して直す | RULES | STATS_REWORK §8.1・§8.5（99 技）。斧・槍のファイルは作らない |
| `src/data/items_*.js`（武器 4・防具 4・アクセ 6・使う物・大事な物） | 同名＋`items_steal.js`（新）＋`items_unique.js`（新） | 移して直す | RULES | 付録 A の能力値とクセ、§8.3 の品の対応、§10 の枠の削り・実の削除。**機械的な変換は `v2/tools/port/port_items.js` で行い**、結果のファイルを以後の正にする |
| `src/data/shops.js`・`pools.js` | 同名 | 移して直す | RULES | 縦切りの店（§3.7）。プールはティア 0〜2 を確かめる |
| `src/data/companions.js`・`herotypes.js` | 同名 | 移して直す | RULES | STATS_REWORK §1.2・§8.4（能力値 0〜25、5 系統）。見た目（look）は CAST の `looks_*.js` に分ける |
| `src/data/monsters_*.js`・`lineages.js`・`enemy_actions.js`・`encounters.js`・`troops.js`・`bosses.js`・`bosses_actions.js`・`rare.js`・`rare_encounters.js` | 同名 | 移して直す | BATTLE | `exp` の削除、`drops` の枠（§10.1）・`drops.steal`（§7.2）、ボスの予告（E18）、縦切りの出現表（§3.6）。**全部の魔物のデータを移す**（絵は縦切りの分だけ） |
| `src/data/items_key.js`・`config.js`・`regions.js`・`locations.js` | 同名 | 移して直す | EVENTS（key・config）・CONTENT-P（regions・locations） | 地名 `lute` → `pharos` などの新しい id（§3.2）、`DB.config.slice` |
| `src/events/prologue_*.js`・`region1_forest.js`・`story.js`（T1）・`story_rumors.js` | `v2/src/events/` | 参考（**文だけを移す**） | CONTENT-P・CONTENT-F | 台詞は流用、流れは WORLD_REDESIGN §3・§4.1 で新しく書く。ボイスの id の付いた文は 1 字も変えない |
| `design/voice/script.csv` | 読むだけ | 参考 | QA | ボイスの id と文面の検査（§3.16） |
| `design/art_proto/code/raster.js` | `v2/src/render/rz.js` | 移して直す | RENDER | `window.RZ` → `R.Hd.RZ`、`ctx.filter` を使わない（ART_REWORK 0.4） |
| `design/art_proto/code/rig.js` | `v2/src/art/rig/{rig,poses,hair}.js` | 移して直す | CAST | 髪の殻・`headScale 0.88`・4 方向・演技のポーズ（STYLE_REFERENCE R6） |
| `design/art_proto/code/env.js`・`scenes2.js`・`ui/art_battle.js` | `v2/src/art/bbg/` | 移して直す | BEAST | 夜の戦場（月・オーロラ・ランタンの光だまり）、配置は MODERN_UI §2.3 |
| `design/art_proto/code/monsters.js` | `v2/src/art/mons/` | 参考 | BEAST | 右向きの土台（スライム・狼・小鬼）の作り方 |
| `design/art_proto/code/places.js`・`ui/art_town.js`・`ui/art_world.js` | `v2/src/art/terrain/` | 移して直す | TERRAIN | 素材の生成器・dual grid・建物の生成器・物・光の地図・発光・水面を、チャンクで焼く形に分ける |
| `design/art_proto/ui/art_chars.js` | `v2/src/art/cast/fieldchar.js` | 移して直す | CAST | 4 方向×3 コマ＋先頭のランタン |
| `design/art_proto/ui/kit.js` | `v2/src/uik/*.js` | 移して直す | UIK | 状態を持たない描画関数と、状態を持つ `List`・`Message`・`Layer` に分ける（MODERN_UI §8.3） |
| `design/art_proto/ui/screens*.js`・`art_title.js` | 各画面のファイル | 参考 | MENUS・FIELD・BSCENE | 配置の値は MODERN_UI §6 が正 |
| `design/art_proto/fonts/ZenMaruGothic-{Medium,Bold}.ttf`・`ui/fonts/cinzel-*.woff2`（と OFL の文） | `v2/assets/fonts/` | そのまま（写す） | CORE | ビルドで使う字だけ切り出す（`pyftsubset`、今の仕組みを流用） |
| `tools/build.js`・`tools/lib/load.js`・`tools/shot.js` | `v2/tools/` | 移して直す | CORE | 下の §2.7〜§2.9 |
| `tools/art_ui_measure.js` | `v2/tools/measure_night.js` | そのまま | QA | 夜の目標値（STYLE_REFERENCE §5.2） |
| `tools/sim_*.js`・`tools/lib/party_model.js`・`validate.js`・`check_text.js`・`voice_script.js` | `v2/tools/`（`validate`・`check_text`・`voice_script` は `v2/tools/qa/`） | 移して直す | RULES（sim_growth・sim_glimmer・sim_spells・party_model）・BATTLE（sim_zones・sim_bosses・sim_loot）・QA（残り） | gl・5 系統・枠 8・ボスの 3 本立て（WORLD_REDESIGN §4.10）。`party_model.glAt/profAt` は **ゲームの中の `R.Growth.glAt`・`R.Rules.profAt` を呼ぶだけ**にする（dev.html のフィクスチャと sim が同じ値を使うため） |

**移さないもの**: `src/art/*.js`（前作の画素の絵）・`src/ui/ui.js`・`src/systems/{field,field_map,minimap,menu*,shop,tavern,title,charcreate,nameentry,gameover,ending,postgame_scene,battle_scene,battle_fx,debug,events_runtime}.js`・`src/maps/*`・`src/events/*` のコード・`tools/sheet_*`・`test_art-*`・`check_reg*`・`gen_world.js`（世界は新しい生成器）。見た目・画面・フィールド・イベントの流れはすべて新規。

---------------------------------------------------------------------------------------------------
## 2. 設計

### 2.1 座標・時間・絵の約束（全員）
- 論理座標で書く（`R.W × R.H`、既定 960×540）。絵は整数の論理座標に置く（ぼかした層だけ例外）。文字は実キャンバスの解像度で描く。
- 1 フレームは `R.Engine` が回す（`requestAnimationFrame`、目標 60 fps）。**時間は `R.Engine.time`（ミリ秒）で数え**、`setTimeout` を使わない（倍速・一時停止・スクショの固定の時刻に従うため）。イベントの待ちは `R.wait(ms)`。
- 乱数は `R.rng(seed)`（種つき）。絵を焼くときは必ずキーから決まる種を使う（同じキーなら同じ画素）。戦闘の乱数は `R.Game.seed` から。
- ぼかしに `ctx.filter` を使わない（`R.Hd.blur`）。純粋な黒 `#000` を絵に使わない。

### 2.2 モジュール一覧

| モジュール | 名前空間 | 中身 | 担当 |
|---|---|---|---|
| 土台 | `R`・`R.Engine`・`R.fit`・`R.Gfx`・`R.on/emit`・`R.U` | 名前空間・場面の積み上げ・画面合わせ（幅可変・縦持ち・uiScale・セーフエリア）・キャンバス・イベントバス・小道具 | CORE |
| 入力と表示 | `R.Input` | パッド・キーボード・タッチ・マウス、ボタン表示、タッチの操作パッド | CORE |
| セーブと設定 | `R.Save`・`R.Settings` | 3 枠＋オート＋中断、合言葉、設定の保存 | CORE |
| 音 | `R.Audio` | BGM（録音優先・合成の予備）・効果音・ジングル・ボイス | CORE |
| 描画の土台 | `R.Hd`・`R.Light`・`R.Post`・`R.Sky` | ラスタライザ・登録簿・焼く列・キャッシュ・ぼかし・場面の光（mood）・光の地図・仕上げ・ティアの空 | RENDER |
| UI の部品 | `R.UIK` | トークン・文字・窓・フォーカス・ゲージ・アイコン・`List`・`Layer`・`Message`・ボタン表示の行・通知・吹き出し・顔の枠 | UIK |
| 人物の絵 | `R.Art.rig`・`R.DB.looks` | 骨組み・ポーズ・4 方向・髪・服・かぶり物・武器の形、主人公 10・仲間 20・NPC の見た目、戦闘とフィールドの絵、仮の顔 | CAST |
| 魔物と戦場の絵 | `hd:mon:*`・`hd:boss:*`・`hd:bbg:*` | 右向きの魔物の土台と部品・レア・ボス・戦闘背景 | BEAST |
| 地形・建物・物の絵 | `R.Terrain` | 素材の生成器・dual grid・立ち上がりの面・建物・物（宝箱・泉・燭台・灯籠…）・ワールドのタイル・光の出どころ | TERRAIN |
| フィールドの動き | `R.Field` | マップに入る・動き（8 方向・壁沿い・角を切らない）・当たり・隊列のなぞり・NPC（歩き・押してどかす）・カメラ・チャンクの焼きと描画の順・光の層・暗がり・HUD・小地図 | FIELD |
| イベントと状態 | `R.State`・`R.Events`・`ev`・`R.Leads`・`R.Mini`・`R.Tier` | 状態の形・条件・フラグ・イベントの実行・手がかり帳・小さな遊び・ティアとティアの場面の保留 | EVENTS |
| 規則 | `R.Rules`・`R.Growth`・`R.Glimmer`・`R.Party` | 能力値・装備・最強装備・熟練度・閃き・成長・隊列 | RULES |
| 戦闘の計算 | `R.BattleCore`・`R.Mon`・`R.BattleAI` | 1 ラウンドの解決・ダメージ・状態・盗み・ドロップ・予告の予約・敵の AI（とシミュレーター用の味方の AI） | BATTLE |
| 戦闘の画面 | `R.Battle`・`R.BFX` | 戦闘の場面（配置・コマンド・技の一覧・ねらい・予告の表示・閃き・数字・勝利・全滅）と効果の絵 | BSCENE |
| 画面 | `R.Screens` | タイトル・作成・名前・仲間選び・ハブ・道具・技術・装備・強さ・隊列・図鑑・年代記と手がかり・地図・セーブ・設定・店・宿・酒場・全滅・合言葉・説明の札・詳しい表示 | MENUS |
| 顔絵 | `R.Portrait` | 顔絵の解決（差し替えの画像 → 仮の顔） | CAST（口）・CORE（ビルドの埋め込み） |
| 中身（序章・世界） | `R.DB.maps/events/leads`（序章・世界の分） | 世界の生成器（縦切りの範囲）・ロア・ファロス・灯台・寄り道 #3・本筋の手がかり・酒場の噂・T1・ベルナ | CONTENT-P |
| 中身（森） | 同上（森の分） | フェルン・迷いの森・千年樹・ユラ・樵の休み小屋・森の手がかりと依頼・歌あわせの中身 | CONTENT-F |
| 検査 | `v2/tools/qa/*` | validate・progress・playthrough・画面の一覧撮り・性能・夜の測定・文・ボイス | QA |

### 2.3 ファイルの配置

```
v2/
  README.md                      動かし方（ビルド・スクショ・テスト・フィクスチャ）
  assets/fonts/                  ZenMaru Medium/Bold（TTF）、Cinzel（woff2）、OFL の文
  src/
    core/     ns.js util.js bus.js engine.js fit.js gfx.js input.js save.js audio.js media.js     (CORE)
    render/   rz.js hd.js bake.js cache.js blur.js mood.js light.js post.js sky.js style.js     (RENDER)
    uik/      tokens.js text.js panel.js focus.js gauge.js icons.js list.js layer.js message.js prompts.js toast.js portrait_frame.js   (UIK)
    art/
      rig/      rig.js poses.js dirs.js hair.js outfit.js headwear.js weapons.js acting.js      (CAST)
      cast/     looks_hero.js looks_party.js looks_npc.js battler.js fieldchar.js faces.js animals.js portrait.js   (CAST)
      mons/     core.js parts.js compose.js bases_a.js bases_b.js rare.js                       (BEAST)
      boss/     boss_pageeater.js boss_moth.js boss_rooteater.js boss_wolflord.js               (BEAST)
      bbg/      kit.js bbg_coast.js bbg_tower.js bbg_forest.js bbg_tree.js bbg_cave.js          (BEAST)
      terrain/  materials.js dualgrid.js rise.js water.js world.js buildings.js props.js props_light.js chunks.js   (TERRAIN)
      fx/       fx_core.js fx_weapon.js fx_spell.js fx_status.js                                 (BSCENE)
    audio/    （今の合成の BGM・効果音・ジングル）                                               (CORE)
    data/     （規則・品・技・術・魔物・出現・編成…。§1.2）                                      (RULES・BATTLE・EVENTS)
    maps/     world.js（生成物）prologue_*.js pharos_*.js forest_*.js optional_*.js              (CONTENT-P・CONTENT-F)
    events/   prologue_*.js world_*.js story_*.js leads_main.js forest_*.js optional_*.js        (CONTENT-P・CONTENT-F)
    systems/
      state.js events_runtime.js leads.js minigame.js tier.js                                    (EVENTS)
      rules.js growth.js glimmer.js party.js                                                     (RULES)
      battle_core.js mon.js battle_ai.js                                                         (BATTLE)
      field/    field.js move.js collide.js trail.js npc.js camera.js chunks.js layers.js dark.js hud.js minimap.js   (FIELD)
      battle/   scene.js layout.js command.js targeting.js playback.js hud.js glimmer_fx.js result.js gameover.js   (BSCENE)
    screens/  title.js charcreate.js nameentry.js party_select.js hub.js items.js skills.js equip.js status.js order.js
              bestiary.js chronicle.js map.js saveload.js settings.js shop.js inn.js tavern.js passphrase.js
              detail.js tips.js warp.js                                                          (MENUS)
    dev/      dev.js fixtures.js                                                                 (CORE。dev.html だけに入る)
    main.js                                                                                      (CORE)
  tools/
    build.js lib/load.js shot.js                                                                 (CORE)
    port/     manifest.json diff.js port_items.js port_techs.js port_mons.js                     (RULES・BATTLE。manifest と diff は CORE)
    fixtures/ states/*.json scenes/*.json                                                        (各担当が自分の分を足す。ファイル名に担当の接頭辞)
    hd_sheet.js hd_check.js hd_check_hair.js hd_perf.js                                          (RENDER。各図書館の担当は --area で使う)
    uik_sheet.js                                                                                 (UIK)
    gen_world.js                                                                                 (CONTENT-P)
    portraits.js                                                                                 (CAST)
    test_<担当>*.js                                                                              (各担当)
    sim_growth.js sim_glimmer.js sim_spells.js                                                   (RULES)
    sim_zones.js sim_bosses.js sim_loot.js                                                       (BATTLE)
    lib/ load.js (CORE)  cond.js (EVENTS)  party_model.js (RULES)  maps.js (QA)
    qa/  validate.js progress.js playthrough.js shots_slice.js check_ui.js check_text.js check_voice.js voice_script.js
         check_leads.js check_chests.js check_secrets.js check_springs.js check_density.js check_world.js check_stubs.js
         slice_scope.js compare.js measure_night.js perf.js check_all.js   (QA)
  dist/        index.html dev.html bgm/ voice/ portraits/   （ビルドの出力）
  design/shots/  スクショの置き場（担当ごとのフォルダ。slice/ は QA の一覧）
```

### 2.4 読み込みの順番と約束
- ビルドの順: `core`（`ns.js util.js bus.js engine.js fit.js gfx.js` の順に固定、残りは名前順）→ `render` → `uik` → `data` → `art` → `audio` → `maps` → `events` → `systems` → `screens` → （dev.html だけ `dev`）→ `main.js`。各ディレクトリの中は名前順（再帰）。
- すべてのファイルは IIFE で `R.DB.*` か名前空間に**登録するだけ**。ほかのファイルの関数・データは関数の中でだけ読む。読み込み時に `document` に触れない（node のローダーで読めること）。
- 名前の重なり: `R.Hd.def`・`R.DB` への登録で同じキーを 2 回登録したら警告（上書きしない）。`R.loadErrors` に集める。
- 数値の定数は 1 か所: 規則は `R.Rules.K`、絵の決まりは `R.Hd.STYLE`（`render/style.js`）、UI は `R.UIK.T`、性能の予算は `R.Hd.BUDGET`（§2.10）。ほかのファイルで数字を書き直さない。
- **id の付け方**（全員。`validate` が検査）: 地方 `r_<rs>`（縦切りは `r_forest`、序章は `prologue`、`rs` は `forest`）／マップ §3.2 の id／イベント `<マップか地方>_<名>`／フラグ `<rs>_<名>`（ボスを倒した `<rs>_boss`、序章の終わり `prologue_done`）／地方の解決は `R.Game.cleared[rid]`（条件では `'cleared_<rid>'` と書ける）／変数 `<rs>_<名>`（`forest_verses`）／選択 `ch_<rs>_<名>`／手がかり `l_<種類>_<名>`／依頼 `q_<町>_<名>`（依頼の手がかりの id は依頼と同じ `q_*` を使う）／編成 `tr_<名>`（ボス `tr_b_<名>`、今の `tr_a21_*` はそのまま）／出現表 `z_<場所>`（ワールドは `zw_<場所>`）／伸びる一品物 `u_<名>`／盗み専用 `<枠>_st_<名>`（STATS_REWORK §7）／ほかの品は今の接頭辞（`w_` `sh_` `hd_` `bd_` `hn_` `ft_` `ac_` `i_` `k_`）／見た目 §2.6.2／絵のキー §2.5.7。
- **ファイルを書き換えるのは持ち主だけ**。`v2/design/requests.jsonl`・`reports.jsonl` は全員が**1 行を足すだけ**（書き直さない、消さない）。

### 2.5 契約（担当どうしの受け渡し。P0 でリードが `v2/src/core/contracts.js` に JSDoc の型と形の検査 `R.Contract.check(kind, obj)` を置き、各担当はこの形で作り、この形で呼ぶ）

#### 2.5.1 土台（CORE）
```js
// 場面（Scene）: 積み上げて使う。上の場面だけが入力を受ける
R.Engine.push(scene, params)            // scene = {id, enter(params, from), exit(to), update(dt), draw(g), onLayout?(), opaque?:bool}
R.Engine.pop(result)                    // いちばん上を閉じる。await の相手に result を返す
R.Engine.replace(scene, params)
R.Engine.await(scene, params) → Promise<result>
R.Engine.time / R.Engine.dt / R.Engine.frame
R.wait(ms) → Promise                    // Engine.time で数える（倍速・一時停止に従う）
R.until(pred) → Promise
R.fit()                                 // R.W, R.H, R.SCALE, R.layout ('wide'|'tall'), R.uiScale, R.safe {l,t,r,b} を決め、変わったら R.emit('layout')
                                        // SCALE は 2 か 4 だけ（MODERN_UI §1.2）。スマホは 2。4 は実画面の短い辺が 1600 px 以上のときだけ
R.Gfx.g                                 // 論理座標の 2D コンテキスト（setTransform(SCALE…) 済み）。R.Gfx.reset()
R.on(name, fn) / R.off(name, fn) / R.emit(name, data)
R.rng(seed) → {next(), int(a,b), pick(arr), chance(p)}
```

#### 2.5.2 入力（CORE）
```js
R.Input.BTN = ['a','b','x','y','l','r','start','up','down','left','right']
R.Input.down(btn) / pressed(btn) / released(btn) / repeat(btn)     // repeat: 260 ms 後 70 ms ごと
R.Input.dir8() → {dx, dy}               // -1/0/1。十字・スティック・タッチのスティック
R.Input.pointer → {x, y, down, pressed, released, longPress, wheel}  // 論理座標
R.Input.lastDevice → 'pad'|'kb'|'touch'|'mouse'                     // 変わったら R.emit('device')
R.Input.prompt(btn) → {kind, label}     // パッドは決定ボタンの設定で A/B の文字を入れ替える
R.Input.consume(btn)
R.Input.touchLayout(name)               // 'field'|'menu'|'battle'|'none'（縦持ちのスティック＋A/B＋メニュー）
```
キーボード: Z＝A、X＝B、C/Tab＝Y（メニュー）、V＝X、Q/E＝L/R、Esc＝B、矢印・WASD＝十字、Shift＝ダッシュ（B を押しながら移動も可、A2）。パッド: 決定ボタンは右が既定（Part A）、Y＝ボタン 3、L/R＝ボタン 4/5（A2）。

#### 2.5.3 セーブ・設定（CORE）
```js
R.Save.cards() → [{slot:'auto'|'suspend'|'s1'|'s2'|'s3', card:{place, chapter, playMs, date, faces:[look×4]} | {bad:'old'} | null}]
R.Save.save(slot) / R.Save.load(slot) → bool / R.Save.remove(slot)
R.Save.autosave(reason)                 // 'map'|'battle'|'inn'|'boss'。左下に 2.4 秒の通知
R.Save.suspend()                        // 読み込むと消える
R.Save.passphrase() → string / R.Save.fromPassphrase(s) → bool      // 冒険の合言葉（A2）
R.Save.checkpoint(tag) / R.Save.restore(tag) → bool   // メモリの中だけの写し（ファイルに書かない）。tag 'battle' は戦闘の直前
R.Settings.get(key) / set(key, v) / defaults   // 変えたら R.emit('settings', {key, v})
```
保存するのは `R.State.serialize()` の結果だけ。接頭辞 `luminous_chronicle_v2_`。版が違うものは札に「前の版のセーブのため読めません」と出して読まない（止まらない・壊れない）。セーブは戦闘の外ならどこでも（Part A）。セーブの札・タイトルの札に Lv を出さない（章＝クリアした地方の数）。

**全滅とやり直し**（CORE・BSCENE・EVENTS・FIELD の共通の約束。A6 の「復活したあと固まる」を二度と起こさない）
- `R.Battle.start` の最初に BSCENE が `R.Save.checkpoint('battle')`（状態＋`setup`＋戦闘の種）を取る。
- 全滅の選択（BSCENE の画面、既定は設定 `wipe`）:
  1. **直前の戦闘からやり直す**（既定、A33 ⑤）: `restore('battle')` → 同じ `setup` で戦闘をやり直す（種は `seed + retry` で変える）。失う物なし。`R.Battle.start` の Promise はまだ解決しない（勝つか逃げるか、下の 2・3 を選ぶまで続く）。
  2. **最後に泊まった宿から**: `R.State.wipeRecover()`（所持金半分、全員全快）→ `R.Game.lastInn` へ。`R.Battle.start` は `{result: 'abort', to: 'inn'}` で解決し、EVENTS は走っているイベントを `R.Events.abort()` で打ち切る。
  3. **タイトルへ**: 同じく `{result: 'abort', to: 'title'}`。
- `canLose` の戦闘（チュートリアルなど）は全滅の画面を出さず `'lose'` を返す。
- 終わったときの不変条件（DESIGN §4.12.2 を v2 に移す。`test_field`・playthrough が毎回確かめる）: 場面の一番上がフィールド、`R.Field` の lock 0、`R.Events.busy()` false、暗転なし、入力が有効、開いた会話の窓なし（新しい `say` は前の `say` を先に解決する）、戻り先の onEnter は 1 回だけ。

#### 2.5.4 音（CORE）
```js
R.Audio.bgm(id, {fade: 600}) / pushBgm(id) / popBgm() / stopBgm(fade)
R.Audio.sfx(id, {vol, pan}) / jingle(id) → Promise
R.Audio.voice(id) → Promise             // 無ければすぐ解決（エラーにしない）。鳴っている間は BGM を 0.6 倍
R.Audio.stopVoice()                     // 会話を送ったら Message が呼ぶ（A9）
window.RPG_MEDIA = {bgm: {id: {url, loopStart, loopEnd, gain}}, voice: {id: url}, portraits: {key: url}}
```
- 録音の BGM・ボイスは**初めて鳴らすときに読み込んで解く**（起動時にすべてを解かない。`--single` の埋め込みも同じ。§2.10）。ループ点は `assets/bgm/<id>.json`（A10）。

#### 2.5.5 描画の土台（RENDER）
```js
R.Hd.def(key, factory, meta)            // factory(opts) → Sheet。キー: hd:<種類>:<id>
R.Hd.get(key, opts) → Sheet|null        // 焼けていなければ null を返して列に積む
R.Hd.now(key, opts) → Sheet             // 同期で焼く（暗転中・戦闘の開始だけ）
R.Hd.want(key, opts, prio) / R.Hd.pump(ms) / R.Hd.ready(key, opts)
R.Hd.draw(g, frame, x, y, {flip, alpha, tint, tintAmt})   // 整数に丸めて描く
R.Hd.blur(canvas, r) → canvas
R.Hd.mood(id) → {ambient, lightDir, shadow, grade:{sh, hi, lift, sat}, vignette, bloom}   // 'night','town_night','cave','forest_night','tower','tree'…
R.Hd.grade(canvas, moodId) → canvas
R.Hd.quality() → 'high'|'low'|'off'     // 設定「効果」。最初の戦闘の 120 フレームの平均が 14 ms を超えたら自動で low
R.Hd.STYLE                              // 色の上限・縁（olMix 0.82）・リム・段の数（style.js）
R.Hd.BUDGET                             // 性能の予算（§2.10 の表の値）
R.Hd.stats() → {bytes, byKind:{field, btl, mon, boss, bbg, chunk, prop, face, fx}, queue, bakedMs:{kind: [avg, max]}}  // perf.js と hd_perf.js が読む
R.Hd.pin(key) / unpin(key)              // LRU で消さない（出撃中の 4 人の戦闘の絵など）
R.Hd.has(key) → bool                    // 登録があるか（無ければ呼ぶ側は仮の箱。dev だけ色の箱、index.html では何も描かない）
// Sheet（論理 px。1 art px = 1 論理 px）
{frames:[{c, ox, oy}], poses:{name:[i…]}, fps:{name:n}, anchors:{feet, head, hand, center, fx, lantern}, w, h, shadow?:[i…], meta}
R.Light.compose(ctx, rect, {ambient, k, lights:[{x, y, r, color, k, kind}], moon:[rects]})   // 掛け算の環境光＋足し算の光だまり
R.Light.glow(g, x, y, {r, color, core, halo}, t)     // 発光の描き直し（芯＋にじみ）
R.Light.ring(g, x, y, r, t)                          // 先頭の人のランタンの光の輪（STYLE_REFERENCE R4。r = 88 art px、暗がりの階は 4 マス）
R.Post.frame(g, {vignette, bloom, grade, brightness})  // 毎フレームの軽い仕上げ（焼いた膜 1 枚＋1/4 解像度のブルーム、高のときだけ）。設定「明るさ」はここで掛ける（焼き直さない）
R.Sky.at(tier) → {ambientMul, horizon, tint}         // 0〜8 の 9 段（§0.2）。R.on('tier') で引き直す
```

#### 2.5.6 UI の部品（UIK）— MODERN_UI §3・§8.3 のとおり
```js
R.UIK.T                                   // トークン（大きさ・色・動き）
R.UIK.text(g, s, x, y, o) / measure(s, o) / fit(s, w, o)       // o = {size, weight, color, align, shadow}
R.UIK.panel(g, rect, o) / fadePanel / card / chip / toast(text, {icon}) / bubble(g, x, y, prompts)
R.UIK.focus(g, rect, t) / gauge(g, rect, cur, max, kind) / icon(g, name, x, y, size, color) / stars(g, grade, x, y)
R.UIK.snapshot()                          // メニューを開いたとき 1 回だけ、後ろの画面を 1/4 でぼかした写しを作る
new R.UIK.List({rows, rowH, cols, render(g, row, rect, focused), onSelect, onCancel, tall})   // 入力・マウス・タッチ・スクロール・uiScale
new R.UIK.Layer({anchor, open(), close()})
R.UIK.Message.say({name, title, face, text, voice, choices}) → Promise<choiceIndex|undefined>   // 文字の速さ・早送り（R）・ログ（X）・自動送り（Y）
    // face: 'look' か 'look:expr'（expr は neutral smile sad angry surprise）か false（枠を出さない）。name は顔の枠がある人は常に出す（MODERN_UI U3）
    // 送り: A・B・下キー（A3）。送ったら R.Audio.stopVoice()（A9）。選択肢の前では自動送り・早送りでも止まる
    // 前の say がまだ開いているときに新しい say が来たら、前を先に解決する（A6 の固まりの原因）
R.UIK.Message.busy() → bool / close()
R.UIK.prompts(g, list, anchor)            // [{btn:'a', label:'決定'}…]
R.UIK.portraitFrame(g, rect, key, o)      // 顔の枠（中身は R.Portrait）
```

#### 2.5.7 絵のキー（CAST・BEAST・TERRAIN・BSCENE が登録し、FIELD・BSCENE・MENUS が呼ぶ）

| キー | 中身 | ポーズ |
|---|---|---|
| `hd:field:<look>` | フィールドの人（全高 約 50、scale 1.15。「ちかい」1.4・「ひろい」0.9 は opts.scale）。先頭のときのランタンは opts.lantern | `stand_s/n/e/w`、`walk_*`（3 コマ）、演技 `nod shake surprise laugh sad point kneel sit bow raise_lantern think`（R6 の 11 種、南向きだけ。ほかの向きは stand で代える） |
| `hd:btl:<look>:<wtype>` | 戦闘の味方（全高 約 70、scale 1.3、左向き）。**焼くのは出撃中の 4 人の今の武器だけ**（控え・他の系統は入れ替え・装備の変更のときに列の先頭へ） | `idle step slash thrust smash shoot cast item guard hit weak ko victory`（系統ごとに攻撃 1 種: 剣 slash・大剣 smash・短剣 thrust・弓 shoot・杖 smash。`step` は踏み込みとコマンド中に一歩前へ、A8） |
| `hd:face:<look>` | 仮の顔（胸から上。表情 `neutral smile sad angry surprise`） | 表情ごとの 1 コマ |
| `hd:mon:<sprite>` | 右向きの魔物（待機 2・攻撃 1・被弾 1）。金色は opts.golden | `idle attack hit` |
| `hd:boss:<sprite>` | ボス（部位の動き 2〜6、予告の構え `tele`） | `idle attack hit tele phase2?` |
| `hd:bbg:<id>` | 戦闘背景の層 `{back, ground, front, post}` と meta `{mood, lantern:{x,y}}` | — |
| `hd:bld:<hash>` | 建物（屋根＋正面の壁を 1 枚。窓の発光の位置、扉の位置） | 1 コマ（`R.Terrain.building(def)` が登録） |
| `hd:prop:<id>` | 物（樽・木箱・灯り・宝箱・泉・燭台・灯籠・スイッチ・歌の石・足あと・光の柱…）。meta `{solid, soft, light, glow, shadow, footprint, frames, overChars}` | 物ごと（宝箱 `closed open`・`rare_closed rare_open`、泉 4 コマ、燭台 `off on`、灯籠 `off on`、スイッチ `off on`） |
| `hd:secret:<mat>` | 見つけた後の隠し通路（床の素材＋壁の縁の細い印） | 1 コマ |
| `hd:bfx:<id>` | 戦闘の効果の絵（右向きで描き、呼ぶ側が反転） | 効果ごと |

#### 2.5.8 地形（TERRAIN → FIELD）
```js
R.Terrain.CHUNK = 8                       // マス。1 マス 32 art px（広さの設定で 40/24）
R.Terrain.bakeChunk(map, cx, cy, {tile, tier, state}) → Job   // 焼く仕事。Job.step(ms) を 1 フレーム 3 ms 以内で何度も呼ぶ。終われば Job.result:
    // {base, over, lights:[…], glows:[…], props:[{key, x, y, sortY, frame, lv}]}
    // base = 地面＋境目＋立ち上がり＋影＋環境光と止まった灯りの光（掛け算まで焼き込み）を 1 枚。over = 人より上に描く物（屋根の張り出し・つり橋・木の葉）を 1 枚
    // state は宝箱・燭台・灯籠・隠し通路・tilePatches の今の値。変わったらそのチャンクだけ焼き直す（R.Terrain.dirty(map, x, y)）
R.Terrain.dirty(map, x, y) / R.Terrain.prewarm(map, {tile}) → Job   // prewarm = そのマップの素材のタイルと物を先に焼く（暗転中）
R.Terrain.building(def) → key              // def は §2.6.1 の objects[type:'building']
R.Terrain.material(id) → {bake(ctx, rect, rng, tile), edge:'soft'|'hard', walk:true|false}
R.Terrain.ambient(map, tier) → {ambient, k, mood}   // map.light と R.Sky から
R.Terrain.worldThumb(tier) → canvas        // 地図の一枚絵（MENUS・FIELD の小地図が使う。1 マス 3〜4 論理 px）
```
- チャンクは **素材のタイル（素材 × 変化 8 種）と境目のかたち（dual grid の 16 通り × 素材の組）を先に焼いて、組み立てるだけ**にする（試作の「画素ごとに生成」を毎チャンクやらない）。目標は §2.10。

#### 2.5.9 フィールド（FIELD）
```js
R.Field.enter(mapId, spawn | {x, y, dir}, {fade: 260}) → Promise   // 暗転の間に見える範囲を焼く。入ったら R.emit('map:enter', {map, from})
R.Field.pos → {map, x, y, dir}
R.Field.lock(reason) / unlock(reason)
R.Field.npc(id) → {move(path, {speed}), face(dir), act(pose), hide(), show(), setPos(x, y)} (Promise を返す)
R.Field.setGuest({id, look} | null)       // E8 ついてくる人（隊列の最後）
R.Field.camera.focus(x, y, {ms}) / follow()
R.Field.flash(color, ms) / shake(px, ms)
R.Field.hud.toast(text, {icon}) / refresh()   // 目印の札・新しい話の人数・小地図
R.Field.encounter.suppress(steps)          // イベントの後の猶予（全部の魔物を止める）
R.Field.encounter.ward(steps = 100)        // 魔除けの香（A3）: パーティより弱い出現表（平均 gl ≥ Lb + 3、R.Growth.equivLevel）の戦闘だけを避ける
R.Field.passable(map, x, y, fromDir, lv = 0) → bool
R.Field.warpList() → [{id, name, region, kind:'town'|'dungeon'}]   // 行った町＋行ったダンジョンの入口（A6）。R.DB.locations から
R.Field.warp(locId) / R.Field.escape() → Promise                   // ワープと脱出は誰でも使えるフィールドの命令（A2）。脱出はダンジョンの中だけ
// 出来事: 'map:enter' 'map:leave' 'step' {map,x,y} 'chest:open' {map,id} 'spring:use' 'secret:found' 'switch' {map,id,on} 'lamp:lit' {id} 'encounter' {zone} 'talk' {npc}
```
動きの規則: 1 歩 1 マス、8 方向、押した最初のフレームから動く、連続歩行、補間描画、斜めは両隣が通れるときだけ、通れない斜めは空いた軸へ壁沿いに滑る（A7）。隊列は先頭の歩いたマスをなぞる。タイルに入った瞬間に 1 回だけ判定（A3）。出現と毒は歩数。NPC は押し続けると 1 歩よける・動けなければ入れ替わる・しばらくして戻る、`pushable:false` は動かない、歩き回る NPC は逃げ場を 2 マス未満にしない（A3）。椅子・木・柔らかい小物は通り抜け（A2）。一方通行（E5）。
- **暗がり（E6）**: `map.dark` の範囲では、一行の周り 4 マス・ともした燭台の周り 3 マス・泉の周り 3 マスの外を暗い膜で覆う（宝箱と泉のきらめきは膜の上に描く、WORLD §6.3）。範囲に入ったとき場所の名前の横に「暗い」。灯りの外で始まった戦闘は `setup.dark = true`（BATTLE が先制の確率と闇の魔物を 1 割上げる。フィールドと町では付けない）。
- **2 つの高さ（フェルンだけ）**: セルの `deck`（樹上の足場、`lv` 1 で歩ける）と `ladder`（`lv` 0 と 1 を行き来する）。`lv` 0 の人は足場の下を歩ける（足場は `over` に描く）。一行・NPC・物・トリガーは `lv` を持つ（無ければ 0）。隊列は先頭の `lv` をなぞる。
- **出現しない所**: 泉の周り 3 マス、ともした道しるべの灯籠の周り 5 マス（E21）、町・屋内。
- **泉**: 2×2 マスの物。調べると `ev.rest()` と同じ（全快・蘇生・控えも）、何度でも。見つけた泉は小地図と地図に印。
- **宝箱**: 開けたら `R.Game.chests` に書き、`p_T` の中身は開けた時のティアで `R.Rules.fillItem`。階の名前の横に「宝箱 開けた数/総数」（ダンジョンは常に。隠し通路の先の箱も数に入れる）。
- **隠し通路**: `secret` のセルに入った瞬間に「隠し通路を見つけた！」と効果音、`R.Game.secrets` に書き、そのチャンクを焼き直す。

#### 2.5.10 イベント（EVENTS。中身は CONTENT が書く）
```js
R.DB.events[id] = {run: async (ev, ctx) => any, once?: bool, cond?: Cond, meta?: {needs:[], gives:[], calls:[]}}
// ctx = {map, x, y, npc?, trigger?}。meta は progress.js が到達を調べるのに使う（今の考え方のまま）
ev.say(who, text | [text…], {voice, face, name, title})    // who = NPC id か look か null（地の文）
ev.choose([label…], {cancel}) → index
ev.caption(text, {ms}) / ev.fade('out'|'in', ms) / ev.wait(ms)
ev.flag(id) → bool / ev.setFlag(id, v = true) / ev.var(name) / ev.addVar(name, n)
ev.item(id, n = 1) / ev.take(id, n) / ev.gold(n) / ev.has(id)
ev.battle(troop | setup, opts) → 'win'|'lose'|'escape'   // 全滅して宿／タイトルを選んだときは戻らない（R.Events.abort、§2.5.3）
ev.warp(map, spawn) / ev.heal() / ev.rest()                 // rest = 泉・無料の寝床（全快・蘇生・控えも）
ev.inn(price) / ev.shop(shopId) / ev.tavern({swap}) / ev.chooseCompanions({count: 3}) / ev.createHero()
ev.lead(id) / ev.leadDone(id)                              // 手がかり帳（WORLD_REDESIGN §3.2）
ev.choice(key, value) / ev.choiceOf(key)                   // 選択の記録 ch_<rs>_<名>（E14）
ev.clearRegion(rid)                                        // ページ・ティア+1・pendingTier・大灯火の演出（E20）
ev.npc(id) = R.Field.npc(id) / ev.guest(look | null) / ev.camera(x, y, ms)
ev.mini.sequence(opts) → {score, rank} / ev.mini.timing(opts)
ev.letter(id)                                              // 宿で受け取る手紙（紙の札）
ev.call(eventId, args) / ev.g(male, female) / ev.bgm(id) / ev.sfx(id) / ev.jingle(id)
```
条件 `Cond`（`R.State.check`）: `'flag'`・`'!flag'`・`'cleared_<rid>'`（`R.Game.cleared` を読む）・`{item}`・`{var, gte|lte|eq}`・`{tier: {gte|lte}}`・`{lead: id, state: 'got'|'done'}`・`{choice: key, is}`・`{heard: key}`・`{guest: look}`・`{slice: true}`（`DB.config.slice`）・配列（すべて）・`{any: […]}`。
```js
// 実行（EVENTS。FIELD・MENUS・BSCENE が呼ぶ）
R.Events.run(id, ctx) → Promise          // 同時に 1 本だけ。走っている間は R.Field が lock
R.Events.busy() → bool / R.Events.abort()  // abort は全滅の宿・タイトル（§2.5.3）。開いた会話を閉じ、lock を外し、暗転を戻す
R.Events.talk(map, npc) → Promise        // npc.talk が文字列ならそのイベント、{lines} なら cond の合う最後の行を say し、R.Game.heard を書く
R.State.newGame({hero, seed}) / serialize() / deserialize(obj) → bool / wipeRecover()
```

#### 2.5.11 状態の形（EVENTS が持ち、RULES が人の中身を持つ）→ §2.6.3

#### 2.5.12 規則（RULES）
```js
R.Rules.K                               // 定数（STATS_REWORK §2.1・§5.2・§8.1・§9.3 の K.GROW を含む）
R.Rules.abilMul(a, k) / stats(c) / preview(c, slot, itemId) → diff / optimize(c) / applyLoadout(c, plan)
R.Rules.profRank(pts) / train(c, kind, key, n) / commandList(c) / canEquip(c, item) / fillItem(item)
R.Growth.init(c, {tier, joinFrom}) / baseMax(c, 'hp'|'mp') / afterBattle(party, reserve, info) → [{c, hp, mp}] / equivLevel(c) / cap(T)
R.Growth.glAt(tier, kind) / R.Rules.profAt(tier, kind)   // 標準の進み方の gl・熟練度（フィクスチャと sim が共有。画面には出さない）
R.Glimmer.roll(unit, action, ctx) → null | {kind:'tech'|'spell', id}   // 今の API の形のまま
R.Party.members() / reserve() / swap(a, b) / setRow(id, 'front'|'back') / join(id) / heal(all) / fullHeal()   // 満タン（A2）
```

#### 2.5.13 戦闘（BATTLE → BSCENE）
```js
// 準備
setup = {troop | mons:[[id, n]], zone, tier, lvOff, bg, bgm, noEscape, canLose, noRare, noGolden, glimmerForce, members:[ids], dark, boss}
    // lvOff は魔物の戦闘レベル Lb の補正（魔物にはレベルが残る。STATS_REWORK §9.5）。味方のレベルではない
R.Mon.encounter(zoneId, {tier, dark, steps}) → setup | null   // FIELD が歩数ごとに呼ぶ（出現の率・組・レア・金色）
// 計算（BATTLE）
const B = R.BattleCore.create(setup)            // R.Game を読む
B.units → [{uid, side:'party'|'enemy', id, name, hp, mp, maxHp, maxMp, row, status:[…], sprite, size, alive, wtype}]
B.options(uid) → [{cmd:'attack'|'skill'|'spell'|'defend'|'item', list?:[{id, name, mp, usable, reason, isNew}], target:'enemy'|'enemies'|'ally'|'allies'|'self'}]
    // 'skill' の list は今の武器の系統の技だけ（A29）。後列から届かない物は usable:false, reason:'reach'。MP 0 の術は mp:0（画面で青緑）
B.partyOptions() → ['fight', 'repeat'?, 'escape'?]   // ラウンドの初めの一行の命令（MODERN_UI §6.17）。逃げるは一行でだけ選ぶ
B.submit(uid, {cmd, id, target}) / B.repeat()   // リピート: 前のラウンドの全員の行動（相手が倒れていたら同じ列の次）
B.repeatOn / B.setRepeat(bool)                   // A6: 一度オンにしたら B で止めるまで毎ラウンド続く。その戦闘の中だけ（次の戦闘へは持ち越さない。オートの持ち越しは A26 で無い）
B.round() → Event[]                              // 1 ラウンドを解決して、見せる順の出来事の列を返す
B.over → null | 'win' | 'lose' | 'escape' / B.rewards() → {gold, drops:[{item, grade}], grow:[…], prof:[…], glimmers:[…]}
// 出来事（BSCENE が順に演出する）
{t:'turn', uid} {t:'act', uid, cmd, id, name, targets} {t:'dmg', uid, n, crit, weak, kind} {t:'heal', uid, n, mp?}
{t:'miss', uid} {t:'status', uid, id, on} {t:'ko', uid} {t:'revive', uid} {t:'glimmer', uid, kind, id, name}
{t:'telegraph', uid, text, pose, tint, next}     // E18。次の手番の大技の予告（画面の端の文と構え）
{t:'summon', uid, mon} {t:'flee', uid} {t:'steal', uid, target, item, grade, stealOnly} {t:'gain', item, grade, stolen?, stealOnly?}
    // レア以上を盗んだ・落としたときは BSCENE が中央の札を約 1.5 秒（早送りでも 0.6 秒以上、A12）
{t:'grow', c, hp, mp} {t:'prof', c, key} {t:'msg', text} {t:'end', result}
// 画面（BSCENE）
R.Battle.start(setup) → Promise<{result:'win'|'lose'|'escape'|'abort', to?, rewards}>   // 場面を積み、終わったら結果を返す。全滅の選択は §2.5.3
R.BattleAI.enemyCommand(B, uid) / R.BattleAI.partyCommand(B, uid, style)   // style は sim の台本（'fight'|'repeat'|'script'）。partyCommand は sim と tools だけが呼ぶ（画面にオートは無い、A26）
```

#### 2.5.14 手がかり帳・小さな遊び・ティア（EVENTS）
```js
R.Leads.add(id) / pin(id) / unpin() / list() → [{region, items:[{id, state:'new'|'open'|'done', pinned}]}] / done(id) / pinned()
R.Mini.sequence({title, symbols, rounds, tempo, theme}) → Promise<{score, rank}>   // 歌あわせ（フェルン）
R.Mini.timing({title, speed, zones}) → Promise<{hits, rank}>                        // 縦切りでは部品だけ（使う町は無い）
R.Tier.get() / effective() / pending() / consumePending()                           // E17: 宿に泊まる・町に入るときに story_after_clear を起こす
R.Tier.celebrate(rid) → Promise   // 大灯火の演出の共通の筋（EVENTS）: 暗転 → R.Sky の引き直し（R.emit('tier')）→ FIELD のカメラと光の柱の物（TERRAIN の hd:prop:beacon）→ 章の札（MENUS の tip の形）
```
- 地方の解決の中身の順（`ev.clearRegion(rid)`）: ページの大事な物 → `R.Game.cleared[rid] = true`・`tier + 1`・`pendingTier` → その地方の目印を外す → `R.Tier.celebrate(rid)` → 光の柱が立った状態でチャンクを焼き直す（空の段が変わるので、見えている範囲は暗転の中で）。

#### 2.5.15 画面（MENUS）
```js
R.Screens.open(id, params) → Promise<result>
// id: 'title' 'charcreate' 'nameentry' 'partySelect' 'menu'(ハブ) 'items' 'skills' 'equip' 'status' 'order' 'bestiary'
//     'chronicle'（年代記・手がかり） 'map' 'save' 'load' 'settings' 'shop' 'inn' 'tavern' 'passphrase' 'detail' 'tip' 'warp'
R.Screens.tip(id)                       // 初めての仕組みの説明の札（1 回だけ。設定 › 遊び方 から読み直せる）
R.Screens.detail(itemOrSkill)           // Y／長押しの詳しい表示（A6）
```
画面の決まり（MENUS。BRIEF から、画面を作るときに落としやすいもの）:
- ハブの命令: 道具／技・術／装備／並びと隊列／図鑑／年代記・手がかり／地図／セーブ／設定（＋ワープ、ダンジョンでは脱出）。**「強さ」は置かない**（人の札を選ぶと開く、A15）。**「技の書・術の書」は置かない**（覚えた物だけを「技・術」で見せる、A15）。人の札は HP・MP の 現在/最大（A15）。X で満タン（A2: 覚えている回復の術を MP の効率のよい順に → 足りなければ確かめてから安い回復の道具（レアと全体回復は使わない）→ 結果をまとめて 1 枚）。
- 回復の道具・術は使った後も相手の選択が開いたまま（A で続けて使う、B で戻る、カーソルは使った物に残る。A2）。
- 装備の候補は強い順（A6）、いまの装備に印、Y で詳しく。最強装備（X）はアクセ 2 枠を変えない（A3）。
- 店: 人の切り替えの操作なし（A17）、4 人の ▲▼ の数字（A20）。Y で詳しく（A6）。
- 図鑑: 1 ページ目に 通常・レア・超レア・盗める物・盗み専用（`drops.steal` のある魔物だけ「盗み ？？？」）。ドロップでも盗みでも入手で埋まる（A5・A28）。弱点の印は出さない。
- 仲間選び・酒場の札: 名前・肩書き・得意武器/得意属性の名前・能力値だけ（A14・A17）。↑↓ で行・←→ で列（A15）。入れ替えはファロスの潮風亭だけ（A17）。
- 隊列の文字は「前列／後列」（A15）。
- タイトル: 左下に「© Studio Metem」と版（Part A）、副題「〜八つの灯火〜」（A31）。

#### 2.5.16 顔絵（CAST・CORE）
```js
R.Portrait.key(look, expr = 'neutral') → 'portrait:<look>:<expr>'
R.Portrait.has(look, expr) → 'painted'|'placeholder'|null
R.Portrait.draw(g, look, rect, {expr, dim})   // RPG_MEDIA.portraits に画像があればそれ、無ければ hd:face:<look> の表情、それも無ければ何も描かない
R.Portrait.parse('berna:smile') → {look, expr}   // ev.say・Message の face の文字列を読む（無い表情は neutral）
```
- 描いた顔の画像は初めて使うときに読み込む（`Image` の decode を待つ間は仮の顔）。

#### 2.5.17 出来事の名前（`R.emit`。全員が同じ名前を使う）
`layout` `device` `settings` `scene:push` `scene:pop` `map:enter` `map:leave` `step` `talk` `chest:open` `spring:use` `secret:found` `switch` `lamp:lit` `encounter` `battle:start` `battle:end` `flag` `var` `item:gain` `lead:add` `lead:pin` `lead:done` `tier` `region:clear` `glimmer` `grow` `save` `autosave`

#### 2.5.18 設定の項目（`R.Settings` のキー。CORE が既定値を持ち、MENUS が画面、各担当が読む）
| キー | 値（既定を太字） | 読む担当 |
|---|---|---|
| `textSpeed` | slow / **normal** / fast / instant | UIK |
| `battleSpeed` | **1** / 2 / 3 | BSCENE（`R.Game` には持たない） |
| `alwaysDash` | **false** / true | FIELD |
| `cursorMemory` | **true** / false | BSCENE・MENUS |
| `fieldZoom` | near / **normal** / far（1 マス 40 / 32 / 24） | FIELD・TERRAIN・CAST |
| `wipe` | **retry** / inn | BSCENE |
| `uiSize` | **1** / 1.15 / 1.3 | CORE（`uiScale` に掛ける） |
| `panel` | **normal** / dense | UIK |
| `brightness` | 0.85 / **1** / 1.25 | RENDER（`R.Post`） |
| `fx` | **high** / low / off | RENDER |
| `prompts` | always / **first2h** / never | UIK・FIELD |
| `vol.bgm` `vol.sfx` `vol.voice` | 0〜10（**7** / **7** / **8**） | CORE |
| `confirmButton` | **right** / down | CORE |
| `touchPad` | **auto** / on / off | CORE |
| `colorAssist` `lessFlash` `reduceMotion` `ruby` | **false** / true | UIK・BSCENE・RENDER |
| `shake` | **on** / weak / off | BSCENE・FIELD |

### 2.6 データの形

#### 2.6.1 マップ `R.DB.maps[id]`（CONTENT が書き、FIELD と TERRAIN が読む）
```js
{
  id: 'fern', name: '森の村フェルン', kind: 'town'|'interior'|'dungeon'|'world', optional: false,   // 寄り道の場所は optional: true（種類は中身で town/interior/dungeon）
  region: 'r_forest'|'prologue', location: 'fern',                    // location = R.DB.locations の id（ワープ・地図の名前）
  w: 60, h: 56,
  legend: { '.': {mat: 'moss_earth'}, ',': {mat: 'grass'}, '~': {mat: 'water', walk: false},
            '#': {mat: 'rock', solid: true, rise: 1}, '=': {mat: 'plank', deck: true}, ':': {mat: 'ladder', ladder: true},
            'S': {mat: 'wall_moss', solid: true, secret: true} },   // secret = 隠し通路（kind 'dungeon' だけ。見た目は周りの壁と同じ、A15・A27）
            // deck = 樹上の足場（lv 1 で歩ける。lv 0 は下をくぐれる）、ladder = lv 0 と 1 の行き来（§2.5.9。フェルンだけ）
  rows: ['########…', …],              // 地面の素材の格子（h 行 × w 字）
  outside: 'forest_dark',               // マップの外を埋める素材（黒い余白を出さない）
  objects: [
    {type: 'building', id: 'fern_inn', x, y, w, h, wall: 2, roof: 'thatch', mat: 'log', door: {x, y, to: {map: 'fern_inn', spawn: 'door'}}, windows: 2, sign: 'inn', lamp: true},
    {type: 'prop', id: 'barrel', x, y, variant: 0},            // soft な物は通り抜け
    {type: 'chest', id: 'verda_1_c3', x, y, item: 'i_potion', n: 2} | {…, pool: 'p_T'} | {…, gold: 120} | {…, pool: 'p_rare'},   // p_rare はレアの箱の絵
    {type: 'spring', id: 'verda_1_s1', x, y},                    // 2×2 マス（x, y は左上）
    {type: 'brazier', id: 'verda_2_b1', x, y},
    {type: 'waylamp', id: 'wl_forest_1', x, y, lit: 'q_forest_fireflies_1'},   // lit = ともった条件（Cond）。ともると周り 5 マスは出現なし
    {type: 'switch', id: 'elder_1_sw1', x, y, flag: 'forest_sw1', look: 'hole'|'lever'|'plate', color: 'teal', by: 'any'|'guest'},  // 同じ色の印を開く扉にも付ける
    {type: 'trail', id: 'verda_1_pim', path: [[x, y]…], cond: {item: 'k_pim_hat'}},   // 光る足あと（cond が真の間だけ見える）
    {type: 'sign', x, y, text: '…'},
    {type: 'stairs', x, y, to: {map, spawn}}, {type: 'door', x, y, to: {map, spawn}, cond},
    {type: 'examine', x, y, event: 'verda_1_stone_a'},
  ],   // どの物も lv を持てる（無ければ 0）
  npcs: [{id: 'rita', look: 'npc_rita', x, y, dir: 's', move: 'still'|'wander'|{route: [[x, y]…], wait},
          pushable: true, talk: 'fern_rita' | {lines: [{cond, text, face, voice}]}, cond, reward: 'lead'|'side'|'discount'|'hint'|'item'|'boss'|'news'|null, key: 'fern_rita'}],
  spawns: {gate_s: {x, y, dir}, …},
  exits: [{x, y, w, h, to: {map, spawn}, cond}],               // 上から順に最初に cond の合う出口。迷いの森の「出口の入れ替え」はこの cond の組で書く（新しい仕組みを作らない）
  triggers: [{id, x, y, w, h, on: 'step'|'enter', event, cond, once}],
  tilePatches: [{cond, x, y, ch} | {cond, rect: [x, y, w, h], rows: […]}],   // 倒木・つるの壁・スイッチの扉
  zones: [{rect: [x, y, w, h] | null, zone: 'z_verda'}],        // null = マップ全体
  light: {ambient: '#5c5aa0', k: 0.45, mood: 'forest_night'},
  dark: false | true | [{rect: [x, y, w, h], cond}],            // E6。true = 全体。配列 = その範囲だけ（迷いの森 2 階の奥の広場）
  bgm: 'forest', bbg: 'forest', oneway: [{x, y, dir}],
  meta: {chestsInfo: true}                                      // 階の名前の横に「宝箱 3/5」（ダンジョンは既定で true）
}
```
- 置き場所の決まり（`validate` が検査）: `kind:'world'` に `chest`・`secret` を置かない（A27）。`secret` は `kind:'dungeon'` だけ。町・屋内の宝箱は置いてよい（WORLD §5.1）。宝箱は上に重なる物（`overChars`）の下に置かない。
- `R.DB.locations[id] = {name, region, kind: 'town'|'dungeon'|'place', map, spawn, warp: Cond}`（C-P。ワープの一覧と地図の名前）。縦切り: `roa pharos fern yura`（町）、`lighthouse verda elder well`（ダンジョンの入口）、`hut`（場所）。序章の間（`!prologue_done`）はワープを出さない。
- `reward` は「話す見返り」（WORLD_REDESIGN §3.3 の ①〜⑦）の種類。`check_leads` が町ごとの数と種類を数える。
- `key` は「新しい話の印」（E19）。台詞が `cond` で変わると印がまた出る（`R.Game.heard[key]` と台詞の中身のハッシュを比べる）。

#### 2.6.2 見た目 `R.DB.looks[id]`（CAST）
```js
{ name, body: {sex: 'm'|'f', build: 'slim'|'normal'|'sturdy', age: 'adult'|'youth'|'short'|'old'},
  skin, eyes, hair: {style, color, ears: 'hidden'|'show'|'elf'},
  outfit: {type: 'tunic'|'armor'|'robe'|'coat'|'gi'|'light'|'dwarf'|'hakama', main, sub, trim},
  mantle, headwear, extras: [], hue: 10,                // 主色の色相（仲間どうし 45° 以上。STYLE_REFERENCE §0.7）
  silhouette: 'braid'|'spiky'|'hood'|'bob'|…            // 頭の輪郭で見分ける }
```
id: 主人公 `hero_<m|f>_<type>`（5 タイプ × 2）、仲間 20（`selma` … `noela`、今の `companions.js` の id）、物語の人 `berna rowell fine otto elm`、名前のある町の人 `npc_<名>`（縦切り: `npc_hanna npc_rita npc_gord npc_pim_mother npc_pim npc_hans npc_ben npc_roy npc_yura_elder`）、町の人の型 `npc_<型>_<n>`（型: `man woman old_m old_f child sailor merchant woodcutter guard keeper bard yura_folk`、`<n>` は色の組 1〜4）、動物 `ani_<cat|dog|hen|fawn>`。CONTENT はこの一覧から選び、足りない物は CAST に依頼する。

#### 2.6.3 状態 `R.Game`（EVENTS。人の中身は RULES）
```js
{ ver: 2, seed, playMs, chapter,
  hero: 'hero', chars: {id: CharState}, party: [id×4], reserve: [id…], joined: [id…],
  gold, items: {id: n}, flags: {}, vars: {}, choices: {key: value},
  tier, pendingTier, cleared: {r_forest: true},
  pos: {map, x, y, dir}, lastTown, lastInn, visited: {mapId: true}, warps: {id: true},
  chests: {mapId: [id…]}, secrets: {mapId: [xy…]}, springs: {mapId: [id…]}, lit: {mapId: [id…]}, lamps: {id: true},
  leads: {id: {got, pin, seen}}, heard: {key: hash}, seenSkill: {c: {id: true}},
  book: {mon: {id: {seen, kills, normal, rare, super, steal}}},
  chronicle: {chapters: [{id, summaryKey}]}, guest: null | {id, look},
  battle: {cursor: {c: {cmd, list, target}}, lastRound: […]} }       // 倍速は設定 battleSpeed（§2.5.18）
CharState = { id, name, look, type?, gl, hp, mp, equip: {weapon1, shield, head, body, hands, feet, acc1, acc2},   // 武器の枠は 1 つ。内部の id は weapon1 のまま（STATS_REWORK §8.2、表示は「武器」）。weapon2 は無い
              wprof: {sword…}, eprof: {fire…}, techs: [], spells: [], status: [], row: 'front'|'back' }
```

#### 2.6.4 手がかり `R.DB.leads[id]`（WORLD_REDESIGN §3.2 のまま）
`{title, text, region, from, place, dir, done, hideWhen, kind: 'main'|'region'|'side'|'rumor'|'map', slice?: 'locked'}`。`slice:'locked'` は縦切りで行けない地方の噂（帳には入るが「この先は、まだ語られていない」と薄く出す）。

#### 2.6.5 ボスの予告（BATTLE）
`R.DB.bossActions[id].telegraph = {text: '根が地面にもぐった……', pose: 'tele', tint: '#8fd6d8', next: '<actionId>', guard: 'defend'|'back'|'element:fire'|…}`。`guard` は sim の台本（正しい対処）が読む答えで、画面には出さない。

#### 2.6.6 品の追加の項目（RULES）
- 伸びる一品物 `u_*`: `{…, grow: 'tier', base: {atk, mag, def…の係数}, fixed: {mods}}` — 数値は **宝箱を開けた（もらった）ときのティア** で `fillItem` が決め、その場で `R.Game.items` の個体に写す（WORLD_REDESIGN §2.7）。
- 盗み専用 `items_steal.js`: `{grade: 'super', src: 'steal', stealOnly: true}`、id は `<枠>_st_<名>`（STATS_REWORK §7.2）。魔物の `drops.steal = {item, rate}`、rate は通常の魔物 32・レア魔物 16・ボス 16（A31 ⑥とリードの決定 5。STATS_REWORK §7.2 の「ボス 8」は使わない）。盗みが成功するたびに判定（ボスも。取れたらその戦闘では終わり）。倒しても落ちない。
- ドロップの枠（A30、STATS_REWORK §10.1）: レア枠は各系統の最後の段だけ（全体の約 25%）、超レア枠は約 9%、能力値を上げる実は無い。`validate` が割合を数える。

#### 2.6.7 フィクスチャ（全員。`v2/tools/fixtures/states/<担当>_<名前>.json`）
`{desc, hero: {type, sex, name}, party: [ids], reserve, tier, gl: {id: n} | 'auto', prof: 'auto', flags: {}, vars: {}, items: {}, gold, leads: [], map: {id, spawn}}` — `R.Dev.fixture(name)` が新しいゲームから組み立てる（`'auto'` は `R.Growth.glAt`・`R.Rules.profAt`。dev.html の中で動くので tools の関数は使わない）。場面のフィクスチャ（`scenes/*.json`）は `{scene: 'battle'|'screen'|'map'|'event', …}` で、戦闘・画面・マップ・イベントの 1 場面をすぐ開く。

### 2.7 ビルド（CORE、`node v2/tools/build.js`）
- `v2/src/**` を §2.4 の順につなぎ、`v2/dist/index.html`（遊ぶ用）と `v2/dist/dev.html`（`dev/` と `?fixture=` を含む、スクショ・テスト用）を作る。構文の壊れたファイルは警告して外す（今と同じ。誰かの作業中の壊れでほかの人が止まらない）。
- 書体: 使う字を `src/**` と `data` の文から集めて ZenMaru（Medium・Bold）と Cinzel（英字）を切り出し、woff2 を埋め込む（目安 1 MB）。
- 媒体: 既定は **外に置く** — `chronicle/assets/bgm` → `v2/dist/bgm/`、`assets/voice` → `dist/voice/`、`assets/portraits` → `dist/portraits/`（写す。`--media <dir>` で読む元を変えられる）。`--single` で全部を base64 で埋め込んだ 1 枚の HTML（Part A の「ビルドで 1 つの HTML」。オーナーに渡す版はこちら）。どちらも実行時の外部通信はしない。
- `--single` の媒体（今の BGM 23 MB・ボイス 6.4 MB → base64 で約 40 MB）は `<script type="application/octet-stream">` の文字として置き、**起動時には解かない**（初めて鳴らすときに Blob にする）。縦切りで使わない BGM（§3.10 の 17 曲の外）は `--slice` で外せる（既定は外す）。
- 顔絵は `--portraits approved`（既定）で `manifest.json` の approved だけを入れる（§6.2）。
- `--check`（構文だけ）、`--out <dir>`（テスト）、`--with <dir>`（フィクスチャを足した dev.html）。

### 2.8 検査・シミュレーター・道具（担当は §2.3）
- **node で読む**: `const R = require('./v2/tools/lib/load')()`（DOM なし。絵のファイルは登録だけなので読める）。
- **各担当のテスト** `test_<担当>*.js`: 自分の契約（§2.5）の形と中身。`R.Contract.check` を必ず通す。
- **一括** `node v2/tools/qa/check_all.js`: ビルド → 全テスト → validate → progress → 文・ボイス・手がかり・宝箱・泉・密度・世界 → sim（速い版）→ 失敗の一覧。P2 以降は毎回これを通してから報告する。
- **絵の図書館** `node v2/tools/hd_sheet.js --area <cast|mons|boss|bbg|terrain|props|fx> [--only …] --out <dir>`: 1:1 と ×4 の一覧表。`hd_check.js`（純粋な黒 0、段の数、彩度、向き、同じキーで同じ画素、大きさの段）、`hd_check_hair.js`（後頭部の肌 8% 以下）。
- **UI の部品表** `node v2/tools/uik_sheet.js`（kit.png と同じ内容を実装で撮る）。
- **性能** `node v2/tools/qa/perf.js`（CPU 4 倍遅くした場合も）。**夜の測定** `measure_night.js`。

### 2.9 開発用のフィクスチャとスクショ
- `node v2/tools/shot.js --html v2/dist/dev.html --query "fixture=<名前>" --size 1920x1080 --out x.png`。大きさは `--size 1920x1080`（16:9）／`--phone`（390×844、DPR 3、縦持ち、タッチ）／`--phone-land`（844×390）。`--keys`・`--eval`・`--wait`・`--shot` は今の shot.js と同じ。`--time <ms>` で `R.Engine.time` を固定（きらめき・ゆらぎを止めて比べられる）。コンソールのエラー・`R.loadErrors` があれば終了コード 1。
- `node v2/tools/qa/shots_slice.js`: §3.11 の全画面 × 2 つの大きさを撮り、`v2/design/shots/slice/index.html`（一覧の HTML）を作る。
- 撮った PNG は**必ず Read で見る**（全担当。見ていない絵は「できた」と言わない）。
- タッチの操作は `--phone` と `--touch "stick:right:600,tap:a"` のような台本で真似る（縦持ちの手の確認は、実機をオーナーが見るまでこれで代える）。

### 2.10 性能の作り（全員が守る。数値は `R.Hd.BUDGET`、測るのは `perf.js`・`hd_perf.js`）

**考え方**: 毎フレームは「焼いた絵を置くだけ」。画素を作る仕事は焼く列（`R.Hd.pump`）か暗転の中でだけ行い、1 フレームの焼く仕事は 3 ms まで（スマホの見込みでも 60 fps を割らない）。

| 何 | 決まり | 予算（デスクトップ ／ CPU 4 倍遅いスマホの見込み） |
|---|---|---|
| フィールドのチャンク | 8×8 マスを `base`・`over` の 2 枚に焼く（§2.5.8）。素材のタイルと境目のかたちは先に焼いて組み立てる。仕事は 3 ms 以内の切れ端に分ける（`Job.step`） | 1 チャンク 4 ms ／ 16 ms（素材が焼けた後）。試作の 60 ms（町）・250 ms（ワールド）のままでは通らないので、G1 で TERRAIN が測って報告する |
| 持つチャンク | **見えている範囲＋周り 1 チャンク**。進む向きには 2 チャンク先まで先に焼く。範囲は広さの設定と縦持ちで変わる（例: 16:9・ふつう 6×5、縦持ち・ひろい 5×9）。外れたチャンクは LRU で捨てる | 合計 40 MB 以下 |
| マップに入る | 暗転 260 ms の中で `prewarm`（素材・物・NPC の絵）と見える範囲のチャンクを焼く。足りなければ暗転を延ばして灯りの印（MODERN_UI §5.15） | 150 ms ／ 500 ms |
| 灯り | 止まった灯りの光だまりはチャンクに焼き込む。毎フレームはランタンの光の輪（1 枚の加算の絵）と発光の描き直し（芯とにじみの焼いた絵、画面に 30 個まで）だけ | フィールド 1 フレーム §3.16 |
| 仕上げ | 周辺減光と色調は焼いた膜 1 枚。ブルームは高のときだけ 1/4 解像度。設定「明るさ」も膜で掛ける（チャンクを焼き直さない） | 0.5 ms ／ 2 ms |
| ティアが変わる | 空の段が変わるのは地方の解決の演出の中だけ。暗転の中で見える範囲だけ焼き直し、残りは列で | — |
| 人の絵 | フィールドの絵はそのマップにいる人だけ。戦闘の絵は出撃中の 4 人の今の武器だけを焼いて `pin`（控え・ほかの系統は焼かない） | 1 人 12 コマ 25 ms ／ 100 ms |
| 戦闘 | 歩いている間に列で: 4 人の戦闘の絵 → その出現表の魔物 → 戦闘背景。戦闘の開始で足りない物だけ `R.Hd.now`（背景 → 敵の待機 → 味方の待機） | §3.16 |
| 文字 | `UIK.measure` は結果をキャッシュ。動かない文字（一覧の行・札）は開いたときに焼いて使い回す | メニュー 1 フレーム 1 ms ／ 4 ms |
| すりガラス | メニューを開いたときに 1 回だけ後ろを 1/4 でぼかす（毎フレームぼかさない） | 開く瞬間 8 ms ／ 30 ms |
| 焼いた絵の合計 | `R.Hd.stats().bytes`（幅 × 高さ × 4）。種類ごとに上限（チャンク 40・人 30・魔物とボス 30・背景 20・物と効果 20・顔 10 MB）で LRU | 150 MB 以下 |
| ごみ集め | 毎フレームの処理で配列・関数・文字列を作らない（出来事の列・当たりの計算は使い回す） | 600 フレームで 33 ms を超えるフレーム 1 つ以下 |
| 音 | 録音は初めて鳴らすときに解く。ボイスは鳴らした後に捨ててよい | 起動からタイトルまでに解く音 0 |

- **測り方**: `node v2/tools/qa/perf.js` は Playwright の Chromium で dev.html を開き、CDP の `Emulation.setCPUThrottlingRate`（1 と 4）で決まった台本（町を 600 フレーム歩く・ワールドを走る・迷いの森の暗がり・効果の多い術の戦闘・メニューの開け閉め・マップの出入り 10 回）を流す。3 回の中央値を `v2/design/perf/<日付>.json` に残し、前の日より 20% 悪くなった項目を一覧に出す。ヘッドレスの数字は実機と違うので、**実機の確認はオーナーの端末で縦切りを見せるとき**（§7 の 9）。
- **関門**: G1 でチャンク・人・魔物の焼く時間を各担当が報告（予算の 2 倍を超えたら P1 の中で作り直す）。P2 から毎日 `perf.js`。超えたら ART_REWORK §7.5 の順（効果の自動の下げ → 背景の層を 1 枚に → 影を半分の解像度 → コマ数を減らす）で削る。

---------------------------------------------------------------------------------------------------
## 3. 縦切りの範囲（序章＋ヴェルダの森、A31 ④）

### 3.1 通しの筋（プレイヤーの体験。目安 序章 1 時間 45 分・森 本筋 2.5〜3.5 時間／依頼込み 3.5〜4.5 時間）
1. タイトル（夜の海・灯台・4 人の後ろ姿）→ はじめから → ロアの里、ベルナの家で目を覚ます（P1、ボイス 4）→ 主人公の作成（性別・タイプ・得意・名前）。
2. ロアの里（語り石の広場。石の文字が白く抜けている）→ ベルナから回復の品と 50 G（P2）→ 半島の街道（主人公 1 人、弱い魔物、道しるべの灯籠が続く夜道）。
3. 港町ファロス（桟橋の上の町、灯台の火が消えて三晩。P4）→ 記録院の出張所でロウェル（任意、ボイス 2）→ 潮風亭で 20 人から 3 人を選ぶ（P6）→ 港でオットー、灯台の鍵と心得（P7、書き直した 3 行）。
4. ファロス灯台 1〜3 階（チュートリアルの戦闘で必ず閃く、泉、隠し通路 1）→ 灯室でフィーネ（ボイス 2）→ ページ食らい（小さな考えどころ）→ 守り歌が戻り、**灯台の灯がともる**（夜の世界で最初の灯り）。
5. 翌朝の鐘のファロス（P10）→ ベルナが年代記・羽ペン・鈴を渡す（ボイス 5）→「噂は酒場に集まるものさ」→ **手がかり帳** を受け取る → 潮風亭の噂の 3 人から 8 地方の噂（森以外は「まだ語られていない」）→ 跳ね橋が下りて半島の外へ。
6. 街道を西へ（道しるべの灯籠・樵の休み小屋・旅人の古井戸）→ 森の村フェルン（樹上の村。捜索隊が相談している。掲示板「捜索隊、求む」）→ 町の人から手がかり 3 本（ピム・樵の三人・森の歌）と依頼。
7. 迷いの森 1〜2 階（足あと・出口の入れ替え・一方通行の段差・暗がりの奥の広場・泉・隠し通路）で 4 人を探す（順番自由）→ 狼の群れ頭（救出の戦い）→ ピムの選択（送る＝母から弁当と「秘密のうろ」＝迷いの森の隠し通路のほのめかし／連れる＝千年樹の近道 2 か所）・小鹿の選択 → 歌の石 3 つ → ダストウィング（歌の石を守る）。
8. 千年樹 1〜2 階（入口でフィーネ、ボイス 1。ピムの抜け穴のスイッチ・根の一方通行）→ 根食らい（考えどころ・盗み専用の超レア）→ エルムが目覚める（ボイス 6）→ `ev.clearRegion('r_forest')` → 千年樹の梢に歌の灯、森じゅうの苔と蛍が光る → フェルンの広場で歌。
9. ティア 1: 空がわずかに明るくなる（「深い夜」の範囲の中の一段、§0.2）、ワールドの森の地方に光の柱、森の色調が少し暖かく。次に宿に泊まるか町に入ると T1 の場面（フィーネ、ボイス 2）。ユラで村人が 1 人名前を思い出す（連作の始まり）。ピムの語り部修行の始まり。
10. 縦切りの終わり: 年代記に「千年樹の歌」の章（選択で文が変わる）。以後も森と半島を歩き回れる（依頼・寄り道・図鑑の続き）。

### 3.2 マップの一覧（必須 28 枚＋あとで足してよい 6 枚とワールドの出来事 1）

| id | 名前 | 種類・大きさ | 担当 | 中身の要点 | 泉 | 宝箱 | 隠し通路 | BGM | 戦闘背景 | 出現 |
|---|---|---|---|---|---|---|---|---|---|---|
| `roa` | ロアの里 | 町 44×36 | C-P | 丘の上の里、語り石の広場（語り石の間）、ベルナの家への坂 | — | 1 | — | `home` | — | — |
| `roa_house` | ベルナの家 | 屋内 16×12 | C-P | 寝台・書見台（手がかり帳の短い本） | — | — | — | `home` | — | — |
| `world` | ワールド（縦切りの範囲） | 224×192 の生成物のうち、ファロス半島と森の地方（歩ける 約 3,500 マス）を仕上げる | C-P | 道しるべの灯籠、見晴らし台、樵の休み小屋・古井戸・ユラの入口、千年樹の梢、フェルンの灯り。他の地方への街道は「崖崩れ」と番人（縦切りだけの出来事）で閉じる | — | — | — | `overworld` | `coast`・`forest` | `zw_prologue`・`zw_peninsula`・`zw_forest`・`zw_forest_road` |
| `pharos` | 港町ファロス | 町 64×48 | C-P | 陸の坂の町＋海の桟橋（WORLD_REDESIGN §5.3）、灯台の光が町を掃く（序章の後）、定期船の桟橋（縦切りでは出ない） | — | 2 | — | `town` | — | — |
| `pharos_inn`・`pharos_tavern`・`pharos_shop`・`pharos_smith`・`pharos_record`・`pharos_shipyard` | 宿・潮風亭・道具屋・武具屋・記録院出張所・造船所の小屋 | 屋内 各 12×10〜20×14 | C-P | 潮風亭は仲間の入れ替え（ファロスだけ、A17）と噂の 3 人。造船所は小舟の話の入口（縦切りでは看板と職人の一言だけ） | — | 各 0〜1 | — | `town`・`tavern` | — | — |
| `lighthouse_1`〜`_3` | ファロス灯台 | ダンジョン（今の大きさ） | C-P | 1 階 倉庫（チュートリアル）、2 階 らせん階段、3 階 灯室 | 1 階中ほど（新）・2 階・3 階の手前 | 2〜3 ずつ | 2 階に 1 | `tower` | `tower` | `z_lighthouse` |
| `fern` | 森の村フェルン | 町 60×56（地面の層＋樹上の層） | C-F | 大木の幹の家とつり橋、リタの歌の家、薬草園、捜索隊の詰所（事件の間）、行商人（武器） | — | 2 | — | `village` | — | — |
| `fern_inn`・`fern_shop`・`fern_rita`・`fern_search`・`fern_gord`・`fern_pim_home` | 宿・道具屋・歌の家・詰所・ゴードの家・ピムの家（母） | 屋内 各 12×10〜16×12 | C-F | 歌の家で歌あわせ（`R.Mini.sequence`） | — | 各 0〜1 | — | `village` | — | — |
| `verda_1`・`verda_2` | 迷いの森 | 屋外のダンジョン 60×52 ×2 | C-F | 広場と小道、足あと（ピムの帽子で光る）、歌の石まで出口が入れ替わる、一方通行の段差、2 階の奥の広場が暗がり（E6、燭台 3）、救出の 4 人 | 1 階中ほど（蛍だまり）・2 階の蛾の手前 | 5〜7 ずつ | 1 階・2 階に各 1 | `forest` | `forest` | `z_verda` |
| `elder_1`・`elder_2` | 千年樹 | ダンジョン 52×48 ×2 | C-F | 幹の中のらせん → 根の間、ピムの抜け穴（スイッチ 2）、根の一方通行 | 1 階の奥・根食らいの手前 | 3〜5 ずつ | 1 階に 1 | `shrine`（無ければ `forest`） | `tree` | `z_elder` |
| `yura` | 隠れ里ユラ（#4） | 寄り道 30×28 | C-F | 苔むした家の円、名前を忘れた人々（役目で呼び合う）、宿・珍しいアクセサリの店 | — | 1 | — | `sorrow` | — | — |
| `yura_inn` | ユラの宿 | 屋内 12×10 | C-F | | — | — | — | `sorrow` | — | — |
| `hut` | 樵の休み小屋（#1） | 寄り道 屋内 16×12 | C-F | 無料の寝床（全快）、途切れた樵の日誌（手がかり）、記録官の帳面（本筋の証拠） | 寝床 | 1 | — | `village` | — | — |
| `well` | 旅人の古井戸（#3） | 寄り道の洞窟 36×30 | C-P | 宝石ウサギの巣、宝箱 3、宝の地図 その1 の封じの扉は**置かない**（小舟が要るため縦切りの外） | 中ほど 1 | 3 | 1 | `cave` | `cave` | `z_well` |
| （あとで）`twin_a1..3`・`twin_b1..3` | 双子の見張り塔（#5） | 塔 2 本 × 3 階 各 20×20 | C-F | 片方にだけ火、両方ともすと つり橋 → `u_twin_bow` | 各塔 1 | 各階 1〜2 | 1 | `tower` | `tower` | `z_twin` |
| （あとで）`windhill` | 風鳴りの丘（#2） | ワールドの出来事（マップなし） | C-P | 語り部の書き付け・フィーネの一言（ボイスなし）・`u_windchime` | — | — | — | — | — | — |

- 「あとで」の分は P2 の関門でリードが入れるか決める（§4.3）。入れないときは、入口に「立ち入り禁止」の看板だけ置く。
- ダンジョンの規則（WORLD_REDESIGN §6）: 入口から次の階段まで 80〜140 歩、いちばん遠いマス 200 歩以下、何もない行き止まり 1 フロア 3 つまで、泉の置き方（§6.2 の 1〜6）、宝箱の見え方（§6.3・E12）、隠し通路は見つけるまで周りの壁と区別がつかない（A15）。**物語に必須の物を隠し通路・遊び・寄り道の先に置かない**（progress が検査）。
- ワールドの空白の決まり: 街道でも原野でも 30 歩歩くあいだに何か 1 つ目に入る（`check_world`、縦切りの範囲で 0 件）。フィールドに宝箱・隠し通路を置かない（A27）。
- 縦切りだけの閉じ方: 他の地方への街道・定期船・小舟の受け取りは、**見えない壁ではなく** 番人・崖崩れ・止まった船の出来事で止める（`DB.config.slice = true` のときだけ置く `tilePatches` と NPC。了承後に外す）。

### 3.3 イベントと会話

**序章（C-P。DESIGN §10.7 の文を流用し、WORLD_REDESIGN と §0.2 の直しを当てる）**

| # | 場所 | id | 変える所 |
|---|---|---|---|
| P1 | `roa_house` | `roa_house_intro` | 暗転のキャプション 3 枚 → ベルナ（v_berna_prologue_01〜04）→ `ev.createHero()`。夜の窓明かりの中で目を覚ます見せ方 |
| P2 | `roa` | `roa_stone`・`roa_berna`・`roa_gate` | 灯台の火が三晩消えている話。回復の品 3・50 G。「あいさつしていかないのかい？」で押し戻す |
| P3 | `world` | — | 主人公 1 人の夜道。消えた灯籠が 1 つ（序章の後の依頼へのつなぎ） |
| P4 | `pharos` | `pharos_arrival`（onEnter、門で話しかけてくる人は置かない） | 町の人の台詞として「灯台の火が消えて三晩」「跳ね橋を上げさせた」「定期船も止まった」を散らす |
| P5 | `pharos_record` | `pharos_rowell` | v_rowell_prologue_01・02 |
| P6 | `pharos_tavern` | `pharos_tavern_start` | `ev.chooseCompanions({count: 3})`（↑↓で行・←→で列、A15。表示は 名前・肩書き・得意武器/属性・能力値だけ、A14・A17） |
| P7 | `pharos`（港） | `pharos_otto` | 鍵。心得の 3 行を書き直す:「仲間は前列と後列に並ぶんじゃ。\n後列は狙われにくいが、弓と杖の\nほかは、前まで届かんぞ。」「迷ったら『リピート』じゃ。\nさっきと同じ手を、みなで\nくり返してくれる。」「急ぐときは倍速にすればよい。\nただし、敵の構えには\n目を離すでないぞ。」 |
| P8 | `lighthouse_1` | `lighthouse_1_tutorial` | 野ネズミ 2 匹、主人公だけ、必ず閃く、負けても続く（今のまま）→「閃いた技は、メニューの『技・術』で見られるぞ」 |
| P9 | `lighthouse_3` | `lighthouse_3_fine`・`lighthouse_3_boss` | v_fine_lighthouse_01・02 → ページ食らい → 守り歌 → **灯がともる**（暗い灯室が白く満ち、光が海を掃く） |
| P10 | `pharos`（朝の鐘） | `pharos_departure` | v_berna_lute_01〜05 → 「噂は酒場に集まるものさ。まずは港の酒場で聞いてごらん。」→ 手がかり帳（`l_main_rumors`）→ オットーの礼 `ac_keeper_lantern`「灯台守のランタン」（`pharos_otto_reward`）→ 跳ね橋が下りる → `prologue_done` |

**森（C-F。WORLD_REDESIGN §4.1 の流れのまま）**

| # | 場所 | id | 中身 |
|---|---|---|---|
| F1 | `fern` onEnter | `fern_arrival` | 話しかけてこない。広場の人だかり・掲示板の張り紙（`l_forest_board`）|
| F2 | `fern_pim_home` | `fern_pim_mother` | ピムの母（WORLD では「マルタ」だが仲間の `marta` と名前が重なるので CONTENT-F が別の名前を付ける）がピムの帽子の片方（大事な物 `k_pim_hat`、持つと足あとが光る）→ `l_forest_pim` |
| F3 | `fern_gord` | `fern_gord` | 3 人の持ち物（斧・弁当箱・笛）→ `l_forest_woodcutters` |
| F4 | `fern_rita` | `fern_rita` | 歌の石 3 つの話 → `l_forest_song`、ロウェルの痕跡の台詞 |
| F5 | `verda_1/2` | `verda_hans`・`verda_ben`・`verda_roy`・`verda_pim` | 倒木の下（斧で開く道）・狼の群れ（戦闘 `tr_a21_forest_wolves`）・木のうろ（ベンの笛）・小鹿をかばうピム。見つけた人は村へ帰る |
| F6 | `verda_2` | `verda_pim_choice` | 送る／連れて進む（`ch_forest_pim`）。送ると母の礼（弁当＝回復の品と、迷いの森の隠し通路のほのめかし）。連れると `ev.guest('npc_pim')`、抜け穴のスイッチ（`by:'guest'`）を押してくれる（千年樹で 2 か所）、敵には狙われない（戦闘に出ない）、千年樹の前で帰る |
| F7 | `verda_2` | `verda_fawn_choice` | 手当て（回復の品 1）／そっとしておく（`ch_forest_fawn`）。手当てすると抜け道を案内 |
| F8 | `verda_1/2` | `verda_stone_a/b/c` | 歌の石（キャプションの歌）。3 つで出口の入れ替えが止まり、つるの壁が消える（`forest_verses` = 3） |
| F9 | `verda_2` | `verda_moth` | ダストウィング（歌の石 c を守る） |
| F10 | `elder_1` 入口 | `elder_fine` | v_fine_forest_01（根の奥を見て一言、去る） |
| F11 | `elder_2` | `elder_boss` | 根食らい → エルム（v_elm_forest_01〜06）→ `ev.clearRegion('r_forest')` → 大灯火の演出 → フェルンの広場で歌（ピムを連れたときだけピムの自慢） |
| F12 | `fern` | `fern_after`・`fern_hanna_reward` | 最後に見つけた人が一品物を渡す（`u_hans_axe`＝樵の大斧（大剣）・`u_ben_whistle`・`u_roy_charm`・`u_pim_cap`、どれも同じ強さ）、ハンナの `ac_tale_forest` |
| F13 | `hut` | `hut_journal`・`hut_notes` | 樵の日誌（`l_forest_hut`）、記録官の帳面（`l_main_recorder_forest`、本筋の証拠「写すと忘れる」） |
| T1 | 次の宿・町 | `story_t1` | 今の T1 の中身（v_fine_t1_01・02）、場所は宿の前か広場（E17）。ベルナの手紙（ボイスなし）|

**話す見返りのある人**（WORLD_REDESIGN §3.3）: ファロス 8 人以上・フェルン 8 人以上・ユラ 6 人以上、種類はそれぞれ 4 種以上（手がかり・依頼・値引き・ダンジョンの隠し場所のほのめかし・一度だけの品・ボスの癖・近況）。空気だけの人は各町 4 人まで。新しい話の「…」と「新しい話 ◯人」（E19）。

### 3.4 小さな依頼（`side`）

| id | 町 | 中身 | 報酬 |
|---|---|---|---|
| `q_fern_letters` | フェルン | 樹上の家 5 軒への手紙配り（つり橋） | お金・木登りの靴（アクセサリ） |
| `q_fern_herbs` | フェルン | 薬草 5 種（迷いの森の広場ごとに 1 種） | 薬の詰め合わせ |
| `q_fern_song` | フェルン | 歌あわせ（`R.Mini.sequence`、3 段）| 段ごとに品（1 回だけ） |
| `q_forest_fireflies` | フェルン | 【灯りを守る】消えた道しるべの灯籠 3 つに光る苔の火種（E21。以後その周り 5 マスは魔物が出ない） | 灯籠の安全地帯・少しのお金 |
| `q_forest_acorn` | フェルン | どんぐり王子の噂（森の南の広場、レア魔物） | 図鑑・レアの品 |
| `q_pharos_well` | ファロス | 「枯れ井戸の底から、きらきらした音がする」→ 旅人の古井戸（#3） | 宝箱・宝石ウサギ |
| `q_pharos_lamp` | ファロス | 【灯りを守る】半島の見晴らし台の古い灯籠に火を戻す | 半島の安全地帯 |
| `q_pharos_delivery` | ファロス | 造船所の見習いの届け物をフェルンの樵頭ゴードへ（町どうしをつなぐ） | お金・手がかり |
| `q_yura_names` | ユラ | 連作「名前を忘れた人々」の 1 人目（森の解決で名前を思い出し、フェルンへ帰る） | 小さな品（ティアで量が変わる） |
| `q_pim_poet` | フェルン | 連作「ピムの語り部修行」の始まり（森の解決後。手紙は他の地方が要るので縦切りでは始まりだけ） | — |

ファロスの 3 つは縦切りのための案（WORLD_REDESIGN には細目が無い）。文は CONTENT-P が詰め、P2 でリードが確かめる。

### 3.5 手がかり帳の項目（`R.DB.leads`。本筋・世界＝`leads_main.js`（C-P）、地方・依頼＝各地方のイベントのファイル（C-F）が足す）

| 種類 | id |
|---|---|
| 本筋 `main` | `l_main_rumors`（噂は酒場に）・`l_main_recorder_forest`（記録官の帳面） |
| 酒場の噂 `rumor`（潮風亭の 3 人、ティア 0） | `l_rumor_forest`（森で人が消える）・`l_rumor_snow`・`l_rumor_desert`・`l_rumor_marsh`・`l_rumor_isles`・`l_rumor_mine`・`l_rumor_ash`・`l_rumor_star`（森以外は `slice:'locked'`） |
| 地方 `region` | `l_forest_board`・`l_forest_pim`・`l_forest_woodcutters`・`l_forest_song`・`l_forest_hut` |
| 依頼 `side` | §3.4 の 10 件 |
| 寄り道の噂 `rumor` | `l_opt_hut`・`l_opt_well`・`l_opt_yura`（＋あとで `l_opt_twin`・`l_opt_windhill`） |

合計 約 28 件。聞いた瞬間に「Y で目印を付ける」を 1 度だけ出す。目印の札（フィールドの右上）と地図の羽ペンの印。森を解決したら森の目印は自動で外れる。

### 3.6 魔物・ボス

**出現表**（BATTLE。ティアは 0 と 1。`tier: 'dyn'` の段の選び方は今のまま）

| 出現表 | 場所 | 魔物（系統の段 1〜2） | レア魔物 |
|---|---|---|---|
| `zw_prologue` | 半島（仲間を選ぶ前） | jelly・rat・seabird・crab（主人公 1 人で勝てる組だけ） | 宝石ウサギ（まれ） |
| `zw_peninsula` | 半島（仲間の後） | 同じ系統の 2〜3 匹の組 | 宝石ウサギ |
| `z_lighthouse` | 灯台 | bat・rat・jelly・crab・seabird | — |
| `zw_forest`・`zw_forest_road` | 森の原野・街道（街道は出現率 0.3、WORLD_REDESIGN §2.2） | bee・mushroom・plant・fairy・jelly | どんぐり王子 |
| `z_verda` | 迷いの森（暗がりの広場では闇の強まり E6） | bee・mushroom・plant・fairy・wolf | どんぐり王子・花角の小鹿（解決後の巣） |
| `z_elder` | 千年樹 | plant・fairy・mushroom・（ティア 1 で treant） | — |
| `z_well` | 古井戸 | rat・bat・crab・jelly | 宝石ウサギ（巣） |

- 金色の個体は全系統に自動（tint）。鋼の魔物は出さない。
- 絵が要る土台（右向き、BEAST）: **jelly rat seabird crab bat bee mushroom plant fairy wolf treant** の 11（段 1〜2 の部品替え・色替え）、レア 3（宝石ウサギ・花角の小鹿・どんぐり王子）。

**ボスと考えどころ**（WORLD_REDESIGN §4.10。予告はすべて `telegraph` と画面の端の文と構え）

| 編成 | 相手 | 考えどころ（予告 → 対処） | sim の合格（「たたかうだけ」／「リピートだけ」／台本） | 盗み専用 |
|---|---|---|---|---|
| `tr_tutorial` | 野ネズミ 2 | なし（閃きの教え） | 台本 100%（負けても続く） | — |
| `tr_b_pageeater` | ページ食らい（序章） | 紙をため込む（予告「ページ食らいが 紙を吸いこんでいる……」）→ 次の手番に全体の「紙吹雪」→ 防御で半分。**教える戦い**なので罰は軽く | ≤ 50％ ／ ≤ 50％ ／ ≥ 95％（リードの案。§7 で確かめる） | — |
| `tr_a21_forest_wolves` | 狼の群れ頭＋狼 2 | 遠吠えで狼が 1 匹増える → 頭を先に倒すと群れが逃げる | 中ボスの基準 ≤ 35％ ／ ≤ 30％ ／ ≥ 90％、差 ≥ 50 | — |
| `tr_b_moth` | ダストウィング | 羽が光る → 次の手番に全員へ眠りのりん粉 → 眠りを防ぐ品・目覚ましの道具で備えるか、風の術で吹き飛ばす（その手番のりん粉が消える。WORLD §4.10） | ≤ 35％ ／ ≤ 30％ ／ ≥ 90％、差 ≥ 50 | — |
| `tr_b_rooteater` | 根食らい＋根 2 | 「根が地面にもぐった……」→ 次の手番に前列へ根の全体攻撃 → 後列へ下げるか防御。火で根を焼くと再生（`eb_regrow`）が止まる | ≤ 20％ ／ ≤ 30％ ／ ≥ 90％、差 ≥ 50 | 千年樹の若芽（`ac_st_rooteater`、1/16、成功のたびに判定） |

- ラウンド数の目安（STATS_REWORK §6.5 B1）: 中ボス 5〜7、地方ボス 8〜11、倒れる人 ≤ 1.0。sim の味方は gl（`glAt(tier, kind)`）とそのティアの店の品。
- ボスの前には泉。負けたら「直前の戦闘からやり直す」が既定（A33 ⑤）。町の人の見返り ⑥ と、ボスの前の書き付けで答えのほのめかし。
- 絵（BEAST）: `boss_pageeater`・`boss_moth`・`boss_rooteater`（根の追加 `b_root` を含む）・`boss_wolflord`（狼の土台の大きい変化形）。地方ボスの高さ 90〜120 論理 px（STYLE_REFERENCE R1、MODERN_UI §2.1 の 1.2 倍の読み替え込み）。

### 3.7 品・装備（RULES。データは全部移し、縦切りで確かめるのはティア 0〜2）
- **店**: ファロス 道具屋（薬・毒消し・目覚まし・目薬・魔除けの香・松明）、ファロス 武具屋（5 系統の T0 武器・盾・頭・体・手・足）、フェルン 道具屋、フェルン 広場の行商（T0〜T1 の武器）、ユラ（ティアで入れ替わる珍しいアクセサリ 3 品）。値段と品ぞろえは今の `shops.js` をティア 0〜1 に絞って移す。店の id（`ev.shop`）: `shop_pharos_items`・`shop_pharos_arms`・`shop_fern_items`・`shop_fern_peddler`・`shop_yura`。
- **宝箱**: ティア宝箱（`p_T`：開けたときのティア）、レアの箱（`p_rare`、各ダンジョン 1〜2）。灯台 2 階の隠し通路の先にレアの箱。
- **一品物**: `ac_keeper_lantern` 灯台守のランタン（オットー、アクセサリ、固定の値）、`u_hans_axe`（樵の大斧＝大剣）・`u_ben_whistle`・`u_roy_charm`・`u_pim_cap`（伸びる一品物、どれも同じ強さ）、`ac_tale_forest`（ハンナ）、あとで `u_twin_bow`・`u_windchime`。
- **盗み専用**: `ac_st_rooteater` 千年樹の若芽（根食らい、1/16）、`ft_st_jewel_hare` 宝石ウサギの靴（宝石ウサギ、1/16）。どちらも STATS_REWORK §7.2 の値のまま（T5・T3 の品が縦切りで取れるのは「盗みの当たり」のご褒美として認める）。
- **大事な物**: `k_lighthouse_key`・`k_chronicle`・`k_quill`・`k_bell`・`k_pim_hat`・`k_page_forest`。
- 能力値の +1 以上の品は縦切りでは出さない（A22。T5 未満のレアに +1 は無い）。レアのクセは STATS_REWORK §4 の 36 品だけ（縦切りの範囲には無い見込み）。

### 3.8 仲間・主人公
- 主人公: 性別 2 × タイプ 5（warrior・ranger・mage・spellblade・wanderer）× 得意（5 系統か 6 属性）、名前は五十音表（4〜5 字）。
- 仲間: **20 人全員**を潮風亭で選べる（Part A）。入れ替えはファロスの潮風亭だけ（A17）。控えは HP/MP の伸びの確率 0.6（STATS_REWORK §9.3）。
- 絵（CAST）: 30 人の見た目 × フィールド（4 方向＋演技）× 戦闘（どの人もどの系統でも焼ける作り。ゲームで焼くのは出撃中の今の武器だけ、§2.10）× 仮の顔。NPC の型: ベルナ・ロウェル・フィーネ・オットー・ハンナ・リタ・ゴード・ピムの母・ピム・ハンス・ベン・ロイ・エルム（霊）・ユラの村人（役目の 4 型）・町の人（男女・年寄り・子ども・船乗り・商人・樵・兵）・動物（猫・犬・鶏）。

### 3.9 技・術
- データは全部を移す（技 99・術 約 77）。
- **縦切りで絵と演出を仕上げ、確かめる範囲** は `node v2/tools/qa/slice_scope.js` が決める: sim_glimmer の模型（序章 35 戦＋森 95 戦＋ボス 4）で、どれかの仲間が閃く確率が 5% 以上の技・術（見込み: 5 系統の lv1〜3 の技 約 20 と入門技、6 属性の 1〜2 段の術 12、合成術はたぶん 0）。この一覧が BSCENE の効果の絵・MENUS の説明・QA の文の検査の範囲になる。
- 熟練度の目安: 序章の終わりに主な武器 5〜8、森の千年樹の頃に 9 前後（A22・STATS_REWORK §5.3）。

### 3.10 BGM・効果音・ボイス
- **BGM**（録音済み、`chronicle/assets/bgm`）: `title` `home` `town` `tavern` `overworld` `tower` `battle` `boss` `boss2` `rarebattle` `village` `forest` `shrine` `cave` `sorrow` `legend`（伝承の語り直し）`tension`（救出・予告の場面）。17 曲（すべて `assets/bgm` にある）。無い場合は合成 BGM。
- **ジングル・効果音**（合成）: 閃き（ピコーン）・レア・超レア・宝箱・隠し通路・泉・宿・章（年代記）・HP/MP の伸び・手がかり帳に書いた・灯籠がともる・予告・ページがめくれる・扉・つり橋。新しい物は CORE が `src/audio` に足す。
- **ボイス 22 本**（文面は 1 字も変えない）: `v_berna_prologue_01〜04`・`v_rowell_prologue_01〜02`・`v_fine_lighthouse_01〜02`・`v_berna_lute_01〜05`・`v_fine_forest_01`（場所を千年樹 1 階の入口へ移す）・`v_elm_forest_01〜06`・`v_fine_t1_01〜02`（宿か町の場面へ移す）。戦闘中の主人公の声は鳴らさない（A20）。

### 3.11 画面の一覧（MENUS・BSCENE・FIELD。すべて 1920×1080 と スマホ縦 390×844 で撮る）

| 画面 | 縦持ちの配置 | 担当 |
|---|---|---|
| タイトル（つづきから の札（場所・章・時間・顔 4 つ、Lv なし）、冒険の合言葉、© Studio Metem と版） | 専用 | MENUS |
| 主人公の作成（性別・タイプ・得意）・名前の入力 | 専用 | MENUS |
| 仲間選び（20 人の札、↑↓ 行・←→ 列） | 専用 | MENUS |
| フィールドの HUD（町・ワールド・ダンジョン、場所の名前、目印の札、小地図、吹き出し、通知、「新しい話 ◯人」、光の輪） | 専用（スティック・A/B・メニュー） | FIELD |
| 会話（羊皮紙の札・顔の枠・話者名・選択肢・ログ・自動送り・早送り）・キャプション・手紙 | 専用 | UIK（`Message`）・MENUS（手紙） |
| メインメニュー（ハブ） | 専用 | MENUS |
| 道具・技と術・装備（8 枠）・強さ・並びと隊列・図鑑・年代記と手がかり・地図・セーブ／ロード・設定 | 16:9 を上に置く形でよい（字は 12 CSS px 以上）。装備・手がかりは専用が望ましい | MENUS |
| 店（買う／売る、4 人の ▲▼）・宿（泊まる → 灯りの暗転 → 手紙）・酒場（噂・入れ替え） | 店は専用 | MENUS |
| 詳しい表示（Y／長押し）・初めての説明の札・ワープ／脱出の一覧・満タン（X）の結果 | 16:9 を上 | MENUS |
| 宝箱を開けた・レアを盗んだ（A12 の 1.5 秒）・隠し通路を見つけた・泉で休んだ | 共通の通知 | FIELD・BSCENE |
| 歌あわせ（`R.Mini.sequence`） | 専用 | EVENTS |
| 戦闘（コマンド・技の一覧と NEW・ねらい・予告の文・閃きの瞬間・ダメージの数字・状態の印・倍速とリピートの札）・勝利と報酬（HP/MP の伸び・熟練は名前だけ）・全滅（灯が消える → 直前の戦闘から／宿から／タイトル） | 専用 | BSCENE |
| 地方の解決（大灯火の演出・章の札）・ティアの場面 | — | EVENTS・CONTENT |

表示してはいけないもの（`check_ui` が画面の文字列で検査）: WP、S〜D の得意の文字、特性の名前と説明、役割（前衛・重）、紹介文、熟練の補正の数字、Lv・経験値・次のレベル、「オート」（戦闘のオート・オート継続。「オートセーブ」は可、会話は「自動送り」と書く）、「中列」、他社作品の名前、未入手の技・術の名前（技の書・術の書は無い）、盗み専用の品の入手の手がかり（図鑑の「？？？」だけ）。

### 3.12 設定（MODERN_UI §6.16 に、ART_REWORK の「効果」と A33 の既定を足す）
- 遊び方: 文字の速さ（ゆっくり／ふつう／速い／一瞬）、戦闘の速さ（×1／×2／×3）、常にダッシュ、カーソル記憶、フィールドの広さ（ちかい／**ふつう**／ひろい）、全滅したとき（**直前の戦闘から**／宿から）。
- 画面: 字の大きさ（標準／大／特大）、窓の濃さ（ふつう／濃い）、明るさ（−／ふつう／＋）、効果（高／低／切）、操作の表示（出す／最初の 2 時間／出さない）。
- 音: BGM・効果音・ボイス（0 でオフ）。
- 操作: 決定ボタンの位置（右／下）、タッチの操作パッド（出す／出さない）。キーの割り当ての変更は縦切りの外（P3 で余裕があれば）。
- 読みやすさ: 色覚の補助、点滅を減らす、画面の揺れ（あり／弱い／なし）、動きを減らす、ふりがな（人名・地名の初出）。
- 変えたらすぐ後ろの画面に反映（字の大きさはその場で並べ直す）。

### 3.13 セーブ
- 記録 3 枠＋オートセーブ（町・ダンジョンの階・ワールドに入ったとき、戦闘に勝ったとき、宿、ボスの直前）＋中断。冒険の合言葉（タイトルとセーブの画面）。
- 札: 場所・章（クリアした地方の数）・プレイ時間・日時・4 人の顔（Lv は出さない）。
- 旧セーブ（v1）は読まない。v2 の中でも形が変わったら `ver` を上げ、読めない札を出す（P2 までは版を上げてよい）。
- 全滅の 3 つの選択と不変条件は §2.5.3。直前の戦闘から＝失う物なし、宿から＝所持金半分。どちらのあとも 60 フレーム以内に歩ける・メニューが開ける（A6。playthrough と test_field に入れる）。

### 3.14 エンジンの追加（WORLD_REDESIGN §6.6 の E 番号）

| 縦切りに入れる | 入れない（残り 7 地方で） |
|---|---|
| E1 手がかり帳・E5 一方通行・E6 暗がりとランタン（迷いの森 2 階の奥の広場）・E7 スイッチ（千年樹）・E8 ついてくる人（ピム）・E11 回復の泉・E12 宝箱の見え方と残り数・E13 地図の一枚絵（縦切りの範囲を描き、外は「まだ知らない土地」）・E14 選択の記録と年代記の文の分岐・E16 小さな遊び（順番）・E17 ティアの場面の遅らせ・E18 ボスの予告・E19 新しい話の印・E20 空の明るさと大灯火の光の柱・E21 道しるべの灯籠・E22 戦闘の快適機能（リピート・倍速・カーソル記憶・NEW）・E23 盗み専用（形は STATS_REWORK の `drops.steal`）・（足す）フェルンの 2 つの高さ（§2.5.9）・ワープと脱出・魔除けの香 | E2 船の段階・E3 固定の行き先・E4 滑る床・E9 灯りの刻と消灯の刻・E10 見回りの視線・E15 連戦（`R.Mini.timing` は部品だけ作る） |

### 3.15 範囲の外（はっきり外すもの）
残り 7 地方・終盤・クリア後・小舟と外洋船・宝の地図・隠しボス・鋼の魔物・定期船・ワープ先の宿場。API で描いた顔絵（キーが届いてオーナーが「描いてよい」と言えば P3 で差し替える。届かなければ仮の顔のまま見せる。§6）。泉から泉へ飛ぶ石碑（WORLD §8 ⑥、未回答）。キーの割り当ての変更。IndexedDB への焼いた絵の持ち越しと WebGL の後処理（P3 の任意）。

### 3.16 完了の条件（縦切りの「できた」）

**遊べること**
1. `node v2/tools/qa/playthrough.js --route all` が、タイトル → 作成 → 序章 → 森の解決（`R.Game.cleared.r_forest`）→ T1 の場面 まで、次の **5 本** をエラーなく通す（台本はフィクスチャではなく入力の真似で、画面の場面を順に進める）:

   | 本 | 主人公 | ピム | 小鹿 | 救出の順 | 途中の全滅 |
   |---|---|---|---|---|---|
   | R1 | warrior・男 | 送る | 手当て | ハンス → ベン → ロイ → ピム | ページ食らいで全滅 → 直前の戦闘から |
   | R2 | ranger・女 | 連れる | しない | ピム → ロイ → ベン → ハンス | 迷いの森の雑魚で全滅 → 宿から（所持金半分を確かめる） |
   | R3 | mage・女 | 送る | しない | 任意 | — |
   | R4 | spellblade・男 | 連れる | 手当て | 任意 | 根食らいで全滅 → 直前の戦闘から |
   | R5 | wanderer・女 | 任意 | 任意 | 任意 | セーブ → 読み込み → 中断 → 再開 を途中で 1 回ずつ |

   各本の終わりに: §2.5.3 の不変条件、手がかり帳の森の目印が外れている、年代記の章の文が選択どおり、最後に見つけた人の一品物が手に入っている。
2. `node v2/tools/qa/progress.js`: 全マップの到達、必須の物が隠し通路・遊び・寄り道の先に無い、どの道でも `clearRegion` に着く、閉じた道の条件がそろう、`DB.config.slice` の閉じ方（番人・崖崩れ・止まった船）が見えない壁でない。
3. `validate.js`（データの参照・id の付け方 §2.4・数・文の長さ・置き場所の決まり §2.6.1・ドロップの枠の割合・盗み専用 30〜40 品と率）、`check_text.js`（STYLE_JA の規則・他社の名前が無い）、`check_voice.js`（22 本の id と文面が `design/voice/script.csv` と一致、ファイルがある）、`check_leads.js`（町ごとの見返りの人数と種類、手がかりの参照）、`check_chests.js`（宝箱と焼いた床の色の差、上に重なる物の下の宝箱 0、ワールドに宝箱 0）、`check_secrets.js`（見つける前の隠し通路が周りの壁と同じ画素、ワールド・町に 0）、`check_springs.js`（泉の置き方の 1〜6）、`check_density.js`（町の 1 画面に飾り 25〜40・通りの中央の空き）、`check_world.js`（30 歩の空白 0、ループのつなぎ目）、`check_ui.js`（はみ出し・最小の文字 12 CSS px・押せる大きさ 44 CSS px・コントラスト 4.5／3・表示してはいけない文字 §3.11・どの画面にも「戻る」の表示）、`check_stubs.js`（仮の実装が 1 回も呼ばれない）がすべて通る。
4. 手で遊ぶ確認（リードと QA）: キーボード・パッド（Playwright のパッドの真似）・タッチ（`--phone` の台本、§2.9）の 3 通りで、序章を通しと、森の中で 30 分ぶんの台本。実機のタッチと手触りは、オーナーに見せるときに確かめてもらう（§5.2）。

**エラーがないこと**
5. `R.loadErrors` 0、スクショと playthrough の間のコンソールのエラー 0、`hd_check.js`・`hd_check_hair.js` の失敗 0、`R.Contract.check` の失敗 0、`index.html` に dev の物（`R.Dev`・フィクスチャ）が入っていない。

**釣り合い（sim）**
6. 雑魚（sim_zones、全出現表）: 勝率 ≥ 99.5%、2.5〜3.5 ラウンド、HP の減り平均 8〜12%（どの表も 5〜15%）、p95 ≤ 20%、誰か倒れる ≤ 3%、全滅 ≤ 0.1%。泉から泉（または入口）の区間を MP 3 割以上残して抜けられる（WORLD_REDESIGN §6.2。`sim_zones --segments` が `tools/lib/maps.js` の歩数と出現率から区間ごとの戦闘数を出して測る）。
7. ボス（sim_bosses、§3.6 の表）: 3 本立ての合格、ラウンドの範囲。
8. 成長（sim_growth）: 森のボスのときの gl が LZ(T)+2〜+5、同じ強さの雑魚で伸びる率 25〜35%、稼ぎ 100 戦で gl +3 以下（STATS_REWORK §9.7）。
9. 閃き・熟練度（sim_glimmer）: 序章の終わりの主な武器 5〜8、千年樹の頃 9 前後。
10. 盗み（sim_loot）: 盗み専用の当たりが式の ±10%、倒して落ちない（H4・H5）。
11. 時間の見積もり: 序章 1.5〜2 時間、森の本筋 2.5〜3.5 時間。式は `歩数 × 0.25 秒 ＋ 戦闘数 × 40 秒（ボスは sim のラウンド数 × 12 秒）＋ 会話の字数 × 0.08 秒 ＋ 画面の操作 1 回 1 秒` を R1 の本で数える（式の係数は手で遊んだ 30 分で 1 回合わせ、報告に書く）。

**見た目**
12. `node v2/tools/qa/shots_slice.js` が §3.11 の全画面を **1920×1080 とスマホ縦（390×844、DPR 3）** で撮り（町・ワールド・ダンジョン・戦闘はスマホ横 844×390 も）、一覧の HTML を作る。担当と QA が全部を Read で見て、STYLE_REFERENCE §9 のチェックリストと MODERN_UI の見本に合うことを報告に書く。
13. 夜の測定（`measure_night.js`）: 町・街道・洞窟・迷いの森・戦闘で STYLE_REFERENCE §5.2 の目標（平均 0.14〜0.22、明るい画素 1〜7%、暗部の色相 250〜295°、四隅/中央 町 0.25〜0.40・ダンジョン 0.12〜0.30）。チャンクの平均輝度 0.12 未満のマップ 0（`dark` の範囲は数えない）。ティア 0 と 1 の同じ場面を並べ、1 の方が明るい。
14. 今のゲームの同じ場面（ファロス・迷いの森・戦闘）との並べた比較（`compare.js`）。

**性能**（`perf.js`、デスクトップ ／ CPU 4 倍遅くしたスマホの見込み）

| 項目 | 目標 |
|---|---|
| フィールドの 1 フレーム（効果 高、灯り 10 個、町とワールド） | 平均 2 ms ／ 8 ms、95% 4 ms ／ 12 ms |
| 戦闘の 1 フレーム（高、効果の多い術を含む 600 フレーム） | 平均 3 ms ／ 10 ms、95% 5 ms ／ 14 ms |
| メニューの 1 フレーム | 1 ms ／ 4 ms |
| マップに入るときの待ち | 150 ms ／ 500 ms（暗転 260 ms の中に隠す） |
| 戦闘の開始の待ち（列で焼き終えた後 ／ 何も焼けていない最悪） | 50 ms ／ 200 ms ｜ 400 ms ／ 1.5 s |
| チャンク 1 つの焼き（素材が焼けた後） | 4 ms ／ 16 ms。ダッシュで走り続けても焼けていないチャンクが画面に出ない |
| 起動からタイトルまで | 1.5 s ／ 4 s（`--single` は 3 s ／ 8 s） |
| 焼いた絵の合計 | 150 MB 以下（縦持ちの「ひろい」を含む） |
| 33 ms を超えるフレーム | 600 フレームに 1 つ以下（マップの出入りの暗転を除く） |
| `dist/index.html`（媒体を外に置いた版） | 6 MB 以下（書体 約 1 MB 込み） |
| `--single`（縦切りの BGM 17 曲・ボイス・approved の顔絵を埋め込み） | 45 MB 以下 |

効果の自動の下げ（最初の戦闘で 14 ms を超えたら「低」）が動くことも確かめる。

---------------------------------------------------------------------------------------------------
## 4. 並列の作業分け

### 4.1 担当表（14。ファイルは重ならない）

パスは `chronicle/v2/` からの相対（`v2/src/…` と `src/…` は同じ所）。`chronicle/` で始まるものだけ v2 の外。

| # | 担当 | 持つファイル（これ以外は作らない・触らない） | 仕事 | 大きさ |
|---|---|---|---|---|
| 1 | **CORE**（リード） | `v2/src/core/*`・`v2/src/audio/*`・`v2/src/dev/*`・`v2/src/main.js`・`v2/tools/build.js`・`tools/lib/load.js`・`tools/shot.js`・`tools/port/{manifest.json,diff.js}`・`v2/assets/fonts/*`・`v2/README.md`・`design/build/V2_PLAN.md` | P0 の骨組みと契約、土台・入力・セーブ・音・ビルド・スクショの道具・フィクスチャの仕組み、P2 の組み込みの順番 | L |
| 2 | **RENDER** | `v2/src/render/*`・`tools/hd_sheet.js`・`hd_check.js`・`hd_check_hair.js`・`hd_perf.js` | `R.Hd`・焼く列・キャッシュ・ぼかし・mood・光の地図・仕上げ・`R.Sky`・図書館の検査の道具 | M |
| 3 | **UIK** | `v2/src/uik/*`・`tools/uik_sheet.js`・`tools/test_uik*.js` | 部品のすべて、`Message`（会話）、アイコン、ボタン表示の行 | M |
| 4 | **CAST** | `v2/src/art/rig/*`・`v2/src/art/cast/*`・`tools/portraits.js`・`chronicle/design/portraits/*`・`chronicle/assets/portraits/*`・`tools/test_cast*.js` | 骨組み・4 方向・演技・30 人と NPC の見た目・戦闘とフィールドの絵・仮の顔・`R.Portrait`・顔絵の道具（§6） | L |
| 5 | **BEAST** | `v2/src/art/mons/*`・`v2/src/art/boss/*`・`v2/src/art/bbg/*`・`tools/test_beast*.js` | 土台 11・部品・組み立て表の読み取り・レア 3・ボス 4・戦闘背景 5（coast tower forest tree cave） | L |
| 6 | **TERRAIN** | `v2/src/art/terrain/*`・`tools/test_terrain*.js` | 素材・dual grid・立ち上がりの面・水・建物・物（宝箱・泉・燭台・灯籠・スイッチ・歌の石…）・ワールドのタイル・光の出どころの表・テーマ（港町・樹上の村・苔の里・森のダンジョン・樹の中・灯台・洞窟） | L |
| 7 | **FIELD** | `v2/src/systems/field/*`・`tools/test_field*.js` | 動き・当たり・隊列・NPC・カメラ・チャンクの焼きと描く順・光の層と発光と光の輪・暗がり・一方通行・ついてくる人・宝箱と泉と燭台と灯籠の働き・HUD・小地図・出現の判定 | L |
| 8 | **EVENTS** | `v2/src/systems/{state,events_runtime,leads,minigame,tier}.js`・`v2/src/data/{items_key,config}.js`・`tools/lib/cond.js`・`tools/test_events*.js` | 状態の形・条件・`ev` の全部・手がかり帳・小さな遊び・ティアとティアの場面の保留・地方の解決の共通の演出の呼び出し | M |
| 9 | **RULES** | `v2/src/systems/{rules,growth,glimmer,party}.js`・`v2/src/data/{elements,statuses,spells_*,weapontypes,techs_*,items_*(key を除く),shops,pools,companions,herotypes}.js`・`tools/port/{port_items,port_techs}.js`・`tools/lib/party_model.js`・`tools/sim_{growth,glimmer,spells}.js`・`tools/test_rules*.js` | STATS_REWORK・SYSTEMS_REWORK を当てた規則とデータの移植、縦切りの店、`slice_scope` の元の数値 | L |
| 10 | **BATTLE** | `v2/src/systems/{battle_core,mon,battle_ai}.js`・`v2/src/data/{monsters_*,lineages,enemy_actions,encounters,troops,bosses,bosses_actions,rare,rare_encounters}.js`・`tools/port/port_mons.js`・`tools/sim_{zones,bosses,loot}.js`・`tools/test_battle*.js` | 戦闘の計算の移植（盗み専用・予告・gl・5 系統・枠 1）、出現表と編成、ボスの考えどころ、sim の 3 本立て | L |
| 11 | **BSCENE** | `v2/src/systems/battle/*`・`v2/src/art/fx/*`・`tools/test_bscene*.js` | 戦闘の場面（MODERN_UI §2.3・§6.17・§6.18・§6.19）、効果の絵、閃き・予告・数字・倍速・リピート・カーソル記憶・NEW・レアの通知・勝利・全滅 | L |
| 12 | **MENUS** | `v2/src/screens/*`・`tools/test_screens*.js` | §3.11 の画面（フィールド・戦闘・会話の部品以外すべて） | L |
| 13 | **CONTENT-P** | `v2/src/maps/{world,prologue_*,pharos_*,optional_well,optional_windhill}.js`・`v2/src/events/{prologue_*,pharos_*,world_*,story_*,leads_main,optional_well,optional_windhill}.js`・`v2/src/data/{regions,locations}.js`・`tools/gen_world.js`・`tools/test_content_p*.js` | 世界の生成（縦切りの範囲を仕上げ）、ロア・ファロス・灯台・古井戸、序章の P1〜P10、本筋の手がかり・酒場の噂、T1、縦切りの閉じ方 | L |
| 14 | **CONTENT-F** | `v2/src/maps/{fern_*,verda_*,elder_*,yura_*,optional_hut,optional_twin*}.js`・`v2/src/events/{forest_*,yura_*,optional_hut,optional_twin*}.js`・`tools/test_content_f*.js` | フェルン・迷いの森・千年樹・ユラ・樵の休み小屋（・双子の見張り塔）、森の筋と選択、依頼、手がかり、歌あわせの中身 | L |
| — | **QA** | `v2/tools/qa/*`・`v2/tools/lib/maps.js`・`v2/design/shots/slice/*`・`v2/design/perf/*` | 検査・到達・通し・全画面の撮影・性能・夜の測定・文とボイス・一括の検査 | M |

- QA は 14 担当と別の役だが、持つファイルは `tools/qa/` だけなので重ならない（QA が足りなければリードが兼ねる）。
- 担当が他の担当のファイルを直したいときは、相手に依頼する（`v2/design/requests.jsonl` に 1 行: `{from, to, file, what, why}`）。リードが毎日まとめて見る。
- 契約（§2.5・§2.6）の変更はリードだけが `contracts.js` の `R.Contract.VERSION` を上げて行う。P1 の間は**足すだけ**（名前を変える・消すのは P2 の後）。変わったらリードが `requests.jsonl` に `{from:'lead', to:'all', what:'contract', ver}` を書く。
- 新しい編成・魔物の出現は BATTLE、新しい品・店は RULES、新しい条件の書き方は EVENTS、新しい見た目は CAST、新しい物・素材は TERRAIN に依頼する（中身の担当はデータのファイルを持たない）。id の付け方は §2.4。**依頼した id は、出す側が P1 の 1 日目のうちに空の登録を置く**（§4.2 の最後）。

### 4.2 受け渡し（誰の何を誰が使うか）

| 使う側 ↓ ／ 出す側 → | CORE | RENDER | UIK | CAST | BEAST | TERRAIN | EVENTS | RULES | BATTLE |
|---|---|---|---|---|---|---|---|---|---|
| RENDER | Engine・Gfx | | | | | | | | |
| UIK | Gfx・Input.prompt・fit | blur（snapshot） | | | | | | | |
| CAST・BEAST・TERRAIN | — | Hd・RZ・STYLE・mood | | | | | | | |
| FIELD | Engine・Input・Save.autosave | Hd・Light・Post・Sky | toast・bubble・panel | `hd:field:*` | — | bakeChunk・building・prop | State・Events（トリガーを渡す） | Party（隊列） | encounter の開始（`R.Battle.start` は BSCENE） |
| BSCENE | Engine・Input・Audio | Hd・mood・Post | 部品・Message（戦闘の文は使わない） | `hd:btl:*`・`hd:face:*` | `hd:mon/boss/bbg:*` | — | — | — | BattleCore・出来事の列 |
| MENUS | Save・Settings・Input | snapshot | すべて | `hd:field/face`・Portrait | `hd:mon`（図鑑） | 地図の一枚絵（`R.Terrain.worldThumb`） | State・Leads | Rules・Party・Growth | 図鑑のデータ |
| EVENTS | Engine・Audio | Sky | Message | — | — | — | | Party（加入・全快） | — |
| CONTENT | — | — | — | looks の id | — | 素材・建物・物の id | ev・Cond・Leads | 品の id | 編成の id |

- **P0 で決まらない名前が要ったとき**は、出す側が先に「空の登録」を置く（例: `R.Hd.def('hd:prop:songstone', stubFactory)`）。受け取る側はそれで作り始め、出す側は同じキーで中身を差し替える。

### 4.3 段階と関門

| 段 | 期間の目安 | 中身 | 関門（次へ進む条件） |
|---|---|---|---|
| **P0 骨組みと契約** | 1 日（リード） | v2 の木、`build.js`・`load.js`・`shot.js`（大きさ・`--time`・`--touch` の台本）、`qa/perf.js` の骨組み（CPU を遅くする口と台本の形。QA が P1 で中身を足す）、`core/*` の実物（Engine・fit・Gfx・Input・Save・Audio の移植）、`contracts.js`（§2.5・§2.6 の型と検査）、**全契約の仮の実装**（色の箱の絵・素の文字・一本道のマップ・1 行で勝つ戦闘）＝ 起動 → タイトル → マップを歩く → 話す → 戦う → メニュー → セーブ が色の箱で通る。`port/manifest.json`。フォントの切り出し。フィクスチャの仕組みと例 3 つ | 14 担当が P0 の木を読み、自分の契約に質問がないことを `requests.jsonl` に書く（あれば半日で直す） |
| **P1 並列** | 3〜4 日 | 各担当が自分の仕事（§4.1）を仮の実装の差し替えとして作る。毎日: ビルドが通る・自分のテスト・自分の一覧表とスクショを Read で見る・報告 | **中間の関門 G1（P1 の 2 日目の終わり）**: RENDER の API と焼く列、UIK の部品表、CAST の 4 人の戦闘とフィールドの絵、TERRAIN のファロスの 1 画面、BEAST のスライムと狼、FIELD でファロスを歩ける、RULES と BATTLE の移植で sim が動く。リードが並べて見て、絵の方向（MODERN_UI の見本と同じ見た目か）を確かめる。ずれていたらここで直す。**性能も G1 で見る**: TERRAIN のチャンク 1 つの焼き時間、CAST の 1 人 12 コマ、BEAST の土台 1 体、RENDER の光の地図を、デスクトップと CPU 4 倍で報告（§2.10 の予算の 2 倍を超えたら P1 の中で作り直す） |
| **P2 組み込み** | 1.5 日 | リードが順に組み込む: CORE → RENDER・UIK → TERRAIN・CAST → FIELD → RULES・BATTLE → EVENTS → BSCENE → MENUS → CONTENT-P → CONTENT-F（序章は仲間選び・戦闘・メニューが要るので、中身は最後に載せる）。各段で `check_all.js` と playthrough の途中まで | 通しで遊べる（§3.16 の 1・2・5）。「あとで」のマップを入れるかを決める（残りの日数と P1 の遅れで） |
| **P3 仕上げと QA** | 1.5〜2 日 | 性能（スマホの見込み）、見た目の一覧を全員で見て直す、sim を目標に合わせる（調整の順: 敵の数値 → 出現の組 → 品の値 → K の定数。STATS_REWORK §6.2 の順を逆にしない）、文の検査、手で遊ぶ、顔絵はキーが届き、オーナーが描いてよいと言ったときだけ優先 1 の 4 人から（§6.3。届かなければ仮の顔のまま完成とする） | §3.16 のすべて → オーナーへ（§5.2） |

- P1 の間、**他の担当のファイルが未完成でも動く**よう、仮の実装は P3 まで残す（`R.Hd.has(key)` が false のときは仮の箱、など）。仮の箱が画面に残っていないことは QA の `check_stubs`（仮の実装が呼ばれた回数を数える）で確かめる。
- 期間は並列の担当が集中した場合の目安。延びたときは「あとで」のマップ → 縦持ちの専用の配置（16:9 を上に置く形に戻す）→ 演技のポーズの数、の順に削る。§3.16 の条件そのものは削らない。

### 4.4 各担当の確かめ方

| 担当 | テスト（node） | 必ず見るスクショ・一覧表 | STYLE_REFERENCE §9 の項目 |
|---|---|---|---|
| CORE | fit の表（MODERN_UI §1.2 の全行）、入力の割り当て、セーブの往復・版違い・合言葉、音の欠けた媒体でエラーにならない、ビルドの `--single` | 3 つの大きさでタイトルの仮の画面（帯・セーフエリア） | — |
| RENDER | 同じキーで同じ画素、キャッシュの上限と固定、焼く列の予算（1 フレーム 3 ms を超えない）、mood の値の表 | 光の地図の見本（灯り 10 個）、夜の色調の 3 つの mood、仕上げの有無 | 夜の目標値・灯りの 3 点セット・周辺減光 |
| UIK | `measure` のはみ出し（最長の名前・999/999・250/250）、List のスクロールとフォーカス、Message の早送り・ログ・選択肢、uiScale 1.0/1.3 | `uik_sheet`（kit.png と並べる）、会話 16:9・縦 | UI の項目（地の不透明度・ゲージの太さ・数字 > 名前・選択行の明るさ） |
| CAST | `hd_check`・`hd_check_hair`、30 人の主色の色相の差（並ぶ 4 人の組で 45° 以上、全員では似た色の組の一覧）、頭の輪郭の違い、ポーズの数 | 30 人 × 4 方向（1:1 と ×4）、戦闘の 15 ポーズ × 5 系統（4 人分）、仮の顔 30 × 表情 | 人物のすべて |
| BEAST | `hd_check`（右向き・純黒 0・段）、大きさの段（S 22〜30・M 30〜45・L・ボス 90〜120）、同じ系統の段が色だけの違いでない | 11 土台 × 段 × 3 つの mood、ボス 4 の待機と予告の構え、戦闘背景 5 に 4 人と敵を置いた見本 | 魔物・ボスのすべて |
| TERRAIN | 素材の境（dual grid の 16 通り）、チャンクの境で模様がずれない、`Job.step` が 3 ms を超えない、チャンク 1 つの焼き時間（§2.10）、`dirty` で 1 チャンクだけ焼き直る、物の meta（solid・soft・light）、宝箱と床の色の差 | テーマ 7 × 1 画面、宝箱を 8 種の床に並べた見本（開けた箱も）、泉・燭台（消えた／ともった）・灯籠 | 町・ダンジョンのすべて、窓は暖色・戸口が最も明るい |
| FIELD | 8 方向・壁沿い・角を切らない・隊列・NPC を押す・一方通行・2 つの高さ（足場の下をくぐる・はしご・隊列が高さをなぞる）・隠し通路を見つけたときだけ表示・魔除けの香は弱い表だけ・ワープと脱出・全滅のあとの不変条件・ダッシュで走り続けて焼けていないチャンクが出ない・タイル進入で 1 回・歩数の出現・暗がりの半径・灯籠の安全地帯・カメラが端で止まる | ファロス・フェルン・迷いの森（暗がり）・ワールド・灯台を 3 つの大きさで。広さの設定 3 段 | 先頭の光の輪、通れる道が明るい、人物の縁と背景の差 |
| EVENTS | `ev` の全関数、条件式、手がかり帳（add・pin・done・hideWhen）、pendingTier、clearRegion、セーブの往復で状態が同じ | 手がかり帳の通知、歌あわせ、地方の解決の演出 | — |
| RULES | STATS_REWORK §6.4 のテスト（abilMul・K.WA・枠 8・optimize・growth・熟練度の表）、移したデータの数と参照 | 装備の画面と店の数字（MENUS の画面を使う） | — |
| BATTLE | STATS_REWORK §7.6・§8.7・§9.7 のテスト（ボスの率は 16 に読み替え）、予告の予約、盗み専用の順番、リピートが B まで続く・次の戦闘へ持ち越さない、`setup.dark` の強まり、`R.Mon.encounter` の率、sim の 3 本立て | 戦闘の出来事の列の書き出し（文字）、BSCENE の画面で 4 ボス | — |
| BSCENE | 出来事の列を全種類流して止まらない、倍速で最短の表示時間（A12・閃き 0.9 秒）、リピート・カーソル記憶・NEW | 通常戦闘・ボス 4・閃きの瞬間・術の詠唱・全員の勝利・後列の配置・瀕死と戦闘不能・予告・レアを盗んだ・勝利の報酬・全滅（A8 の 7 枚＋4）を 16:9・縦・横で | 戦闘の UI、ダメージの数字 |
| MENUS | 画面ごとの開く・閉じる・戻る（B）・L/R で人の切り替え・タッチの当たり、表示してはいけない文字 | §3.11 の全画面 × 2 つの大きさ、見本（MODERN_UI の out/*.png）と並べる | UI の項目 |
| CONTENT-P・F | progress の自分の範囲、`meta` の needs/gives、手がかり・見返りの人の数、泉・宝箱・隠し通路の規則、文の検査、ボイスの id | 自分の全マップを 1 画面ずつ（町は 4 か所以上）、全イベントの会話の 1 枚目 | 町の飾りの密度・通りの空き |
| QA | §3.16 のすべて | 一覧の HTML の全枚 | すべて（最後に 1 回、別の目で） |

### 4.5 報告の形
`v2/design/reports.jsonl` に 1 行ずつ: `{owner, phase, date, done:[…], files:[…], tests:{name: 'pass'|'fail'}, shots:[パス], looked: true, open:[…], requests:[…]}`。`looked: true` はスクショを Read で見たという意味で、見ていないときは書かない。

---------------------------------------------------------------------------------------------------
## 5. リスクと対策、オーナーが見るもの

### 5.1 リスクと対策

| リスク | 中身 | 対策 |
|---|---|---|
| スマホの性能 | 夜の光（光の地図・発光・仕上げ）とチャンクの焼きが重い。縦持ちは見えるマスが縦に 2 倍。試作の焼き時間（町のチャンク 60 ms・ワールド 250 ms）は予算の 15 倍 | §2.10 の作り（素材のタイルを先に焼いて組み立てる・仕事を 3 ms の切れ端に・見えている範囲＋1 チャンク・止まった灯りは焼き込み・仕上げは膜 1 枚）。G1 で焼き時間を測って報告、P2 から毎日 `perf.js`（CPU 4 倍遅く）。目標を超えたら ART_REWORK §7.5 の順で削る |
| 範囲が広がる | 「全部入り」の縦切りに寄り道・連作・演技・縦持ちが重なる | §3.2 の「必須」と「あとで」を分けた。E 番号の出し入れを §3.14 で固定。新しい案は `requests.jsonl` に書き、リードが P2 の関門でだけ入れる。オーナーの新しい指示は BRIEF に足してから担当に配る |
| 絵のばらつき | 14 人のうち 4 人（CAST・BEAST・TERRAIN・BSCENE）が絵を描き、色・縁・光がずれる | 数値は `R.Hd.STYLE` と `R.Hd.mood` だけ（自分で数字を書かない）。`hd_check` を全員が通す。G1 でリードが並べて見る。見本（MODERN_UI の out/*.png）と同じ場面を撮って並べる。夜の測定を数値で合わせる |
| レベルなしの釣り合い | gl の伸び・熟練度・店の品だけで強さが決まり、稼ぎが効かない分、詰まる人が出る | ボスの前の泉・直前の戦闘からやり直し・町の人のほのめかし・予告は 1〜2 回で気づける強さ。sim の台本 ≥ 90%。gl の上限（`cap(T)`）で稼ぎの効きは +3 まで、の範囲で「少し稼げば楽になる」を残す。手で遊んでボスごとの負け回数を記録 |
| 教える戦いが難しすぎる／易しすぎる | ページ食らいの予告が最初の考えどころ | 罰を軽く（防御で半分）、予告の文を大きく、負けても続く、の 3 つで様子を見る。§7 でオーナーに確かめる |
| 移植のずれ | 今の木で SR Phase 2 の直しが進んでいる | `port/manifest.json` のハッシュと `diff.js` で、写した後に直った元のファイルを毎日一覧にし、取り込むかをリードが決める |
| 夜が暗すぎる | 目が疲れる・道や宝箱が見えない | 「暗い」ではなく「夜の色」。通れる所・扉・宝箱・階段は必ず光で見分けられる（MODERN_UI §4.2）。明るさの設定。測定の下限（平均 0.14、チャンク 0.12） |
| 同じ名前の人 | 仲間の `marta`（マルタ）とピムの母（WORLD の「マルタ」）のように、仲間 20 人と町の人の名前が重なる | `check_text` が仲間・主人公の型の名前と町の人の名前の重なりを出す。ピムの母は別の名前にする（§3.3 F2） |
| 契約の変更 | P1 の途中で形が変わると並列が止まる | 契約の変更はリードだけが行い、`contracts.js` の版を上げ、`R.Contract.check` がずれを知らせる。変更は足すだけにし、消すのは P2 の後 |
| 顔絵の差し替え | 仮の顔と描いた顔で印象が変わる、キーが遅れる | 顔の枠の大きさ・位置・表情の名前は先に固定（§6）。仮の顔でも縦切りは完成とする。描いた顔は 1 人ずつ差し替えられる |
| キーの扱い | API キーの漏れ | §6.3。リポジトリの外の環境ファイルからだけ読み、記録に残さない、リポジトリの中の置き場所を拒む |

### 5.2 縦切りの終わりにオーナーが見るもの
1. **遊べる版**: `v2/dist/index.html`（`--single` の 1 枚の HTML）をファイルで渡す。テスト用 URL への公開（新しく作るのも、今の URL の更新も）は、オーナーの指示があったときだけ（A17。今の URL はオーナーが今のゲームを遊んでいるので、v2 で上書きしない）。
2. **画面の一覧**: `v2/design/shots/slice/index.html`（§3.11 の全画面 × 1920×1080 とスマホ縦、今のゲームとの並べた比較）。
3. **遊び方の 1 枚**: 操作、目安の時間、見てほしい所（夜の町と光、フィールドの手触り、手がかり帳で自分で追う感じ、話す見返り、考えるボス 4 体、迷子さがしの選択、仮の顔絵、スマホ縦）。
4. **数字の報告**: sim の結果（雑魚・ボス 3 本立て・成長・閃き・盗み）、性能（デスクトップとスマホの見込み）、夜の測定、プレイ時間の見積もり。
5. **決めてほしいこと**（§7）。
6. 了承のあと: 残り 7 地方・終盤・クリア後を v2 で作る計画（次の文書）と、今のゲーム（`chronicle/src`）を退かせる時期（v2 が今のゲームの範囲をすべて越えるまで残す）。

---------------------------------------------------------------------------------------------------
## 6. 顔絵（A33 ②: OpenAI の画像 API で描く。キーはオーナーが後で渡す）

### 6.1 それまでの仮の顔
- CAST が骨組みの頭から **胸より上を大きく焼いた顔**（`hd:face:<look>`）を作る（ART_REWORK §4.2 の「顔 34」の作り方、scale 3、夜の光・背中のリム）。表情 5 つ（`neutral smile sad angry surprise`）は骨組みの目・口・眉の切り替えで出す。
- 顔の枠は UIK の `portraitFrame`（会話 118×118 論理 px、メニューの札 64×64、強さの画面 180×220、店の人 72×72）。**枠の大きさと位置は描いた顔でも変えない**。
- イベントの台詞は最初から `face: 'berna:smile'` の形で表情を書いておく（仮の顔でも表情が変わり、描いた顔に替えても台詞を直さない）。
- 顔の枠を出す人: 物語の人（ベルナ・ロウェル・フィーネ・オットー）、名前のある町の人（ハンナ・リタ・ゴード・ピムの母・ピム・ユラの長老）、仲間 20・主人公 10（メニュー・強さ・仲間選び・戦闘の結果）。顔の無い人は枠ごと出さない（MODERN_UI §6.3）。

### 6.2 差し替えの口
- 画像の置き場: `chronicle/assets/portraits/<look>_<expr>.webp`（生成した画像から作った 768×768 の正方形、背景は透明か暗い紺の単色。強さの画面の枠 180×220 論理 px が 4K（SCALE 4）でも大きく伸びない大きさ。1 枚 80 KB 前後を目安）。ビルドが `dist/portraits/` に写す（`--single` なら埋め込む）。`RPG_MEDIA.portraits['portrait:<look>:<expr>'] = url`。
- `R.Portrait.draw` は「描いた顔 → 仮の顔 → 無し」の順に探す。表情が無い描いた顔は `neutral` を使う。
- 一覧 `chronicle/design/portraits/manifest.json`: `[{look, name, exprs: [...], priority: 1|2|3, status: 'todo'|'generated'|'approved'|'rejected', note}]`。優先 1 = ベルナ・フィーネ・ロウェル・オットー、優先 2 = 仲間 20・主人公 10、優先 3 = 町の人。**オーナーが「approved」にした物だけ** をビルドに入れる（`--portraits approved`、既定）。オーナーの返事（一覧表を見て「これで」「これは直して」）をリードが `manifest.json` に写す。

### 6.3 道具 `v2/tools/portraits.js`（ゲームの実行時には通信しない。道具を動かすときだけ）
- **キーが届くまで**（オーナー「帰宅したら渡すから待ってて」）: 道具は `--list`・`--export-refs`・`--dry-run` まで作って確かめる。API を呼ぶ処理は書いてよいが、動かすのはキーが届き、オーナーが描いてよいと言ってから。最初は優先 1 の 4 人 × `neutral` だけを描き、`--sheet` をオーナーに見せて方向の了承を得てから残りを描く（見た目の方向が外れたまま 150 枚を描かない）。1 回の実行は `--max <枚数>`（既定 8）までで、描く前に枚数を表示する。
- 使い方: `node v2/tools/portraits.js --list`（一覧と状態）／`--export-refs`（仮の顔と全身の絵を参考画像として `design/portraits/refs/` に書き出す）／`--dry-run --only berna`（指示文を表示するだけ）／`--only berna,fine --expr neutral,smile`（描く）／`--sheet`（描いた顔の一覧表を作る。オーナーに見せる用）。
- **キーの読み方**: 環境変数 `OPENAI_API_KEY` があればそれを使う。無ければ、環境変数 `LUMINOUS_SECRETS` が指す環境ファイル、それも無ければ `~/.config/luminous/secrets.env` を読む（`KEY=value` の行）。**そのファイルのパスがリポジトリ（`/home/user/others`）の中なら読まずに止まる**。キーを置くのはオーナー（環境変数か、リポジトリの外のそのファイル）。会話に貼られたときも、リードはどのファイルにも書かず、道具を動かすその 1 回の環境変数としてだけ渡す。キーが無ければ何もせず、置き場所の案内を出して終了コード 0（A10 の BGM の道具と同じ振る舞い）。
- **モデルの名前もリポジトリに書かない**: 使うモデルは同じ環境ファイルの `PORTRAIT_IMAGE_MODEL` から読む（無ければ案内を出して止まる）。
- キーはリクエストの見出しにだけ使い、ログ・エラー・ファイルに出さない（エラーの文は `redact()` を通す。今の BGM の API の道具（`tools/lib/` の音声の補助）と同じ作り）。呼び出しの記録は `chronicle/design/portraits/api_log.jsonl` に `{t, look, expr, ok, ms, bytes}` だけ。
- 指示文 `chronicle/design/portraits/prompts.json`: 共通の絵の決まり（夜の世界・暖かい灯りと月の青・落ち着いた彩度・2.6〜2.8 頭身のキャラの顔を描いた一枚絵・胸より上・少し斜め・暗い紺の単色の背景・文字や署名なし）＋人ごとの見た目（`R.DB.looks` から作る: 髪型と色・目・肌・服の色・年齢・かぶり物・持ち物）＋表情。**作品名・他社の固有の名前を入れない**（A16）。参考画像として `--export-refs` の仮の顔を付け、髪型と色を合わせる。
- 仕上げ（道具の中で。画像の加工は手元の python3 と Pillow を道具から呼ぶ。ゲームの実行時の依存にはしない）: 背景を抜く（単色の紺をしきい値で透明に）、胸より上に切り出して 768×768、夜の色調に合わせる軽い色の補正、`webp` で保存、`manifest.json` を `generated` に。オーナーが一覧表を見て `approved` / `rejected`（理由）を付ける。
- 生の出力はリポジトリの外（`~/.cache/luminous/portraits_raw/`）に置き、リポジトリには仕上げた webp だけを入れる。`.gitignore`（P0 で CORE が `chronicle/v2/.gitignore` に置く）: `*.env`・`secrets*`。git の操作はしない。
- ART_REWORK 0.1（画像生成 API を使わない）の例外は **顔絵だけ**。ほかの絵をこの道具で作らない。

---------------------------------------------------------------------------------------------------
## 7. オーナーに確かめること（縦切りを見せるときにまとめて聞く。答えを待たずに既定で作る）

| # | 問い | 縦切りの既定 |
|---|---|---|
| 1 | ダンジョンの入口の石碑から「最後に触れた泉」へ飛べるようにするか（WORLD_REDESIGN §8 ⑥） | 入れない |
| 2 | 新しいボイスを足すか（フィーネの風鳴りの丘、ザクロの決勝。§8 ⑩） | 足さない |
| 3 | 序章のボス（ページ食らい）の考えどころは「防御で半分」の軽い予告でよいか | 軽い予告 |
| 4 | ファロスの依頼 3 つ（古井戸・見晴らし台の灯籠・フェルンへの届け物）でよいか | この 3 つ |
| 5 | 顔絵: 描く順（物語の 4 人 → 仲間と主人公 → 町の人）と、1 人あたりの表情の数（5） | この順・5 |
| 6 | 縦持ちで専用の配置を作る画面の範囲（§3.11）。残りは 16:9 を上に置く形でよいか | §3.11 のとおり |
| 7 | 双子の見張り塔・風鳴りの丘（「あとで」）を縦切りに入れるか | P2 の関門でリードが決め、入らなければ全体の制作で作る |
| 8 | 全滅して「最後に泊まった宿から」を選んだときの所持金（Part A の「半分」を残すか。「直前の戦闘から」は失う物なし） | 宿からは半分 |
| 9 | 実機での確認: 縦切りを見せるとき、ふだん遊ぶスマホ（機種）で手触りと重さを見てもらえるか（ヘッドレスの測定は実機と違う） | 見せるときにお願いする |
| 10 | ボスの盗み専用: 1/16 で「盗みが成功するたびに判定」（1 戦で取れる率はティッタがいて 4 割前後）。A31 ⑥の「甘くしない」に合うか。1 戦 1 回にするなら率を上げる必要がある | 成功のたびに 1/16 |
| 11 | リピート: 一度押したら B で止めるまで続く（A6）のを、その戦闘の中だけにする（次の戦闘は手で選ぶところから） | その戦闘の中だけ |

---------------------------------------------------------------------------------------------------
## 8. 見直しの記録（2026-09-26、リード）

並列で作り始める前に、BRIEF A2〜A33 と 6 つの仕様書に照らして直した所。

| # | 直した所 | 理由 |
|---|---|---|
| 1 | §0.2 に 8 行を足した（盗み専用の id と率・空の段・暗がりの半径・「オート」の文字・全滅の所持金・フェルンの 2 つの高さ・A11 の設定の行・隠し通路の見え方） | 仕様書どうしの食い違いが決着していなかった |
| 2 | 盗み専用の id を `st_rooteater_staff`・`st_jewel_hare` から `ac_st_rooteater`・`ft_st_jewel_hare` に、id の付け方を `<枠>_st_<名>` に。ボスの率 16 を明記 | STATS_REWORK §7 のデータと食い違っていた |
| 3 | id の付け方の一覧（§2.4）、見た目の id の一覧（§2.6.2）、店の id（§3.7）、`ac_keeper_lantern`、`R.DB.locations` の形 | 中身の担当が他の担当の id を当て推量で書くことになっていた |
| 4 | 全滅とやり直しの契約（§2.5.3: `checkpoint`・3 つの選択・`abort`・不変条件）、`R.Events.run/busy/abort/talk`、`R.State.newGame/serialize/wipeRecover` | A33 ⑤の「直前の戦闘から」と A6 の固まりの対策が、どの担当の仕事か決まっていなかった |
| 5 | `Message` の約束（face の書き方・下キーで送る A3・送るとボイスを止める A9・前の say を先に解決・「自動送り」） | A3・A9・A6 が抜けていた。「オート」の字が check_ui と食い違っていた |
| 6 | 設定のキーの表（§2.5.18）。倍速を `R.Game` から設定へ | 5 担当が読む値の名前が決まっていなかった |
| 7 | FIELD の契約: 魔除けの香（A3）・ワープと脱出（A2・A6）・暗がりの範囲と半径・2 つの高さ・出現しない所・泉・宝箱の数・隠し通路 | E6・E11・E12・A2・A3・A6 の決まりが契約に無かった |
| 8 | マップの形: `kind` から `optional` を分けた、`location`・`deck`・`ladder`・`switch`・`trail`・`waylamp.lit`・`dark` の範囲・出口の入れ替えは cond で書く、置き場所の決まり（ワールドに宝箱・隠し通路なし、隠し通路はダンジョンだけ） | E7・E6・A27 と、迷いの森・フェルンの仕掛けを書く形が無かった |
| 9 | 戦闘の契約: `partyOptions`・リピートの続き方（A6）・`skill` は今の武器の系統だけ（A29）・`lvOff` は魔物の補正と明記・`R.Mon.encounter`・結果に `abort`・レアの札 1.5 秒（A12） | レベル廃止（A30）と紛らわしい名前、A6・A12 の抜け |
| 10 | 戦闘の絵は出撃中の 4 人の今の武器だけ焼く（`pin`）。`step` のポーズ（A8 の一歩前へ）。演技のポーズは南向きだけ | 30 人 × 5 系統を焼くと上限 150 MB を超える |
| 11 | §2.10 性能の作りを新設（チャンクの焼き方と予算・持つ範囲・灯りの焼き込み・仕上げ・文字・ごみ集め・音の遅い読み込み・測り方）、`R.Hd.BUDGET/stats/pin`、`Terrain.bakeChunk` を仕事の切れ端に | 試作の焼き時間（チャンク 60〜250 ms）では 3 ms の列の予算と「マップに入る 150 ms」が両立しなかった。測り方が決まっていなかった |
| 12 | 完了の条件: playthrough を 5 本の表に（選択 4 通り・救出の順 2 通り・タイプ 5・全滅 3 種・セーブ）、`check_secrets`・`check_stubs`・dev の物が index.html に無い、区間の MP の測り方、時間の見積もりの式、ティア 0 と 1 の明るさの比較、性能にチャンク・長いフレーム・`--single` の大きさ | 「4 通り」と書いて中身が 20 通り以上あり、測り方の無い項目があった |
| 13 | 画面の決まり（ハブに「強さ」「技の書」を置かない・満タン・連続使用・装備は強い順・最強装備はアクセを変えない・店の比較・図鑑の盗みの枠・仲間選びの表示・前列/後列・© Studio Metem と副題） | A2・A3・A5・A6・A14・A15・A17・A20・A28・A31 と Part A が画面の担当に届いていなかった |
| 14 | 表示してはいけない文字に「中列」・未入手の技と術・盗み専用の手がかりを足した | A15・A28 |
| 15 | 顔絵: キーが届くまで API を呼ばない、最初は 4 人の neutral だけで方向を確かめる、1 回の枚数の上限、会話に貼られたキーの扱い、768 px、生の出力はリポジトリの外、モデル名に触れる参照を消した | A33 ②とオーナーの「帰宅したら渡すから待ってて」、キーとモデル名の約束 |
| 16 | ピムの母の名前（WORLD の「マルタ」）が仲間の `marta` と重なるので、id を `npc_pim_mother`・`fern_pim_home` にし、名前を付け直す | 同じ名前の別人が出る |
| 17 | ピムを送ったときの母の礼、ダストウィングの対処（眠り対策か風の術）を WORLD §4.1・§4.10 に合わせた。BGM は 17 曲 | 仕様書と食い違っていた |
| 18 | `tools/lib/maps.js` の持ち主を QA 1 人に。`party_model` はゲームの中の `glAt/profAt` を呼ぶだけに | 1 ファイル 2 担当・dev.html から tools の関数を呼ぶ形になっていた |
| 19 | 組み込みの順を RULES・BATTLE → EVENTS → BSCENE → MENUS → 中身、に | 序章に仲間選び・戦闘・メニューが要る |
| 20 | 公開は新しい URL も含めてオーナーの指示のときだけ、`--single` の媒体は起動時に解かない・縦切りの曲だけ入れる | A17、起動の速さ |
| 21 | §7 に問い 8〜11（宿からの所持金・実機の確認・ボスの盗みの機会・リピートの続き方） | 既定で作るが、オーナーの好みが分かれる所 |
