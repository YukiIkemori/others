# BGM の変更（縦切りの音の手直し、2026-09-27）

- 作ったもの: `chronicle/assets/bgm/<id>.ogg` + `<id>.json`（ループ点 `loopStart/loopEnd`、`omen` だけ `loop:false`）。どれも Ogg Vorbis 96 kbps・−18 LUFS（`omen` は −17）、ループの継ぎ目にクロスフェードを焼き込み済み。前の版は `chronicle/design/bgm/prev/` にある（聞き比べ: `chronicle/design/story_audio_preview.html`）。
- 生成の元: `chronicle/design/bgm/prompts_v2.json`（BGM 生成ツールを prompts_v2.json で実行）。`prompts.json`（v1 の 32 曲の一覧）は変えていない。
- 継ぎ目の聞き取り（聞き取りの係が 2 回聞いた平均、10 = 気づかない）と、スペクトルの似かた。

## 1. 同じ id のまま作り直した曲（v2/src の変更は要らない）

| id | どこで鳴るか | 前の版 | 新しい版 | 継ぎ目 |
|---|---|---|---|---|
| `forest` | 迷いの森 verda_1・verda_2 | 59.1 s、ループ 41.7 s | 121.7 s、ループ 118.1 s（3.6→121.7） | 9/10 |
| `town` | ファロス（町と屋内） | 46.9 s、ループ 43.3 s。「昼下がりの市場」の曲 | 87.9 s、ループ 69.8 s。灯りの港町の夜のワルツ（アコーディオン・マンドリン） | 10/10 |
| `tower` | ファロス灯台 | 51.4 s、ループ 36.2 s、継ぎ目のスペクトルが合わない（0.40） | 102.4 s、ループ 87.3 s | 10/10 |
| `tavern` | 潮風亭 | 55.0 s、ループ 48.0 s、継ぎ目が合わない（0.42） | 94.0 s、ループ 64.1 s（ジグに C の部分を足した） | 10/10 |
| `tension` | 救出・予告の場面（今はラザロ戦だけ） | 46.1 s、ループ 29.5 s、同じ小節のくり返しが多い | 85.4 s、ループ 56.8 s | 10/10 |
| `home` | ロアの里・ベルナの家 | 52.1 s、ループ 44.3 s | 78.8 s、ループ 63.2 s（同じ「峡谷の里」の響き、第 2 の旋律を足した） | 9/10 |

気に入らなければ `design/bgm/prev/<id>.ogg|json` を `assets/bgm/` へ戻すだけで元に戻る。
そのままの曲: `title` `overworld` `battle` `boss` `boss2` `rarebattle` `village` `shrine` `cave` `sorrow` `legend`（長さ・継ぎ目とも問題なし。`village` `home` `cave` はオーナーが選んだ響き）。

## 2. 新しい id（鳴らすには v2/src の変更が要る）

| id | 長さ | 何の曲 | つなぐ所（案） |
|---|---|---|---|
| `lostwood` | 88.3 s、ループ 58.4 s（29.9→88.3）、9/10 | 迷いの森の霧・不穏（オルゴールの切れ端、ガラスの響き、遠い笛） | `forest_verda.js` の `verda_mist`（白い霧がわき上がった）で `ev.bgm('lostwood', {fade: 800})`、歌の石が 3 つそろったら（`forest_verses >= 3`）マップの `forest` に戻す。または `maps/verda_2.js` の `bgm: 'forest'` → `'lostwood'`（奥ほど不穏に） |
| `eldertree` | 85.4 s、ループ 60.0 s（25.4→85.4）、8/10 | 千年樹の中のダンジョン（ダルシマーの刻み、チェロ、言葉のない合唱） | `maps/elder_1.js`・`maps/elder_2.js` の `bgm: 'shrine'` → `'eldertree'`（`shrine` は神殿用に残す） |
| `dawn` | 70.8 s、ループ 45.2 s（25.6→70.8）、10+9 | 灯がともる・地方の解決（タイトルと同じワルツのきざしの主題） | ① `prologue_lighthouse.js` `lighthouse_3_boss` の「灯台に、火がともった！」の前で `ev.bgm('dawn')` ② `pharos_story.js` `pharos_departure` の頭（朝の鐘）で `ev.bgm('dawn')`（最後の `R.Audio.bgm('town')` はそのまま） ③ `forest_elder.js` の「千年樹のこずえに、歌の灯がともった」の前で `ev.bgm('dawn')`（広場の場面の `ev.bgm('village')` はそのまま） |
| `omen` | 10.4 s、ループしない（`loop:false`） | ボスの予告のスティング（低い打撃 → 不協和の弦のうねり → 響きが消える） | ボス戦の前の「音がする」地の文の所で `ev.bgm('omen')`: `lighthouse_3_boss`（シャリ、シャリ）・`elder_boss`（ガリッ……ガリッ）・ダストウィング（バサッ……バサッ）・狼の群れ（低いうなり声）。**注意**: 戦闘は pushBgm/popBgm なので、戦闘のあとは `omen`（鳴り終わり＝無音）に戻る。勝ったあとの最初の行で `ev.bgm(<マップの曲 か dawn>)` を呼ぶ |
| `fine_theme` | 78.1 s、ループ 63.9 s（14.2→78.1）、10+9 | 灰色のマントの少女（フィーネ）の場面（チェレスタ・ハープ・ソロのバイオリン、とても静か） | `lighthouse_3_fine`・`elder_fine`・`story_t1`・`windhill_notes` の頭で `R.Audio.pushBgm('fine_theme')`、少女が消えた地の文のあとで `R.Audio.popBgm()`。任意（無くても困らない） |

戦闘中のボスの「構え」の予告音（`sfx('telegraph')`）は合成の効果音のまま（録音の効果音を鳴らす仕組みは無い）。勝利・宿・章はジングル（合成）のまま。

## 3. ビルド（v2/tools/build.js）

- ボイス: `scanMedia` は `assets/voice/` を全部入れるので、新しい 48 本はそのまま入る（変更なし）。
- BGM: `SLICE_BGM`（§3.10 の 17 曲）に無い id は、既定のビルド（`--slice`）では**外される**。新しい 5 曲を使うなら、`v2/tools/build.js` 37 行目の `SLICE_BGM` に足す（**コードの変更が要る**。この作業ではしていない）:
  ```js
  const SLICE_BGM = ['title', 'home', 'town', 'tavern', 'overworld', 'tower', 'battle', 'boss', 'boss2', 'rarebattle', 'village', 'forest',
    'shrine', 'cave', 'sorrow', 'legend', 'tension', 'lostwood', 'eldertree', 'dawn', 'omen', 'fine_theme'];
  ```
  それまでは `node v2/tools/build.js --all-bgm` で入る。作り直した 6 曲は同じ id なので、今のビルドのままで入る。
- 大きさ: 新しい 5 曲 ≈ 3.5 MB、作り直しの 6 曲で +2.6 MB（3.4 → 6.0 MB）、ボイス 48 本 ≈ 1.9 MB（`--single` は base64 で約 1.33 倍）。
- `V2_PLAN.md` §3.10 の BGM の一覧（17 曲）にも 5 曲を足すこと（リード）。

## 4. 砂漠（desert_*.js、2026-09-27）
新しい 3 曲（BGM 生成の道具、design/bgm/prompts.json の kasim・desert・caravan）と、前からある `pyramid`。build.js・validate.js の SLICE_BGM に足した。
| id | 鳴る所 | 曲 |
|---|---|---|
| `kasim` | オアシスの町カシム・屋内・宿場「砂の縁」 | D の短調（フリギア属）104、ウード・ネイ・ダルブッカ。ループ 28.8→75.0 s |
| `desert` | ワールドの砂漠の範囲（desert_00_common.js が 'step' で overworld と切り替える）・金剛トカゲの岩場・蜃気楼の市 | 73.7 s、ループ 7.4→ |
| `caravan` | 野営地 3 つ・隊商と出発したとき・古い野営跡・井戸の小屋 | 80.8 s、ループ 10.2→ |
| `pyramid` | 砂の王墓・砂に沈んだ神殿 | 前からある曲 |
録音の曲が無いときの代わり（R.Audio.FALLBACK）: kasim → town、desert → overworld、caravan → sorrow、pyramid → dungeon。

## 5. 雪原（snow_*.js、2026-09-27）
新しい 3 曲（BGM 生成の道具、design/bgm/prompts_snow.json の yule・bonfire・siege。各 2 本録って聞き比べ、ループの良い方）と、前からある `ice`・`ghost`。
build.js・validate.js の SLICE_BGM に足した（`ice`・`ghost`・`yule`・`bonfire`・`siege`）。
| id | 鳴る所 | 曲 |
|---|---|---|
| `yule` | 雪の村ユール・屋内（酒場の宿は `tavern`） | 75.6 s、ループ 15.6→75.6 s。祭の支度の、温かい北の村（フィドル・ハーディ・ガーディ・鈴） |
| `bonfire` | 大火祭の火入れ（snow_festival）・二日目の祭（snow_day2） | 79.7 s、ループ 27.3→79.7 s。焚き火を囲む踊り（聞き取りの判定: 継ぎ目の違和感なし） |
| `siege` | 籠城の夜のユール（yule_night）・門の戦い（troops_snow.js の bgm） | 70.1 s、ループ 15.3→70.1 s。低い太鼓とホルンの緊張 |
| `ice` | ワールドの雪原の範囲（snow_00_common.js が 'step' で overworld と切り替える）・雪の林・白竜の峰・つららの回廊・流氷原 | 前からある曲 |
| `ghost` | 氷に閉じた帆船 | 前からある曲 |
ボス: 吹雪の大狼・氷壁の巨人は `boss`、白竜ネーヴェ・氷の船団長は `boss2`。予告のスティングは `omen`、夜明け・解決は `dawn`、昔話の語りは `legend`。
録音の曲が無いときの代わり（R.Audio.FALLBACK）: yule → village、bonfire → legend、siege → tension、ice → overworld、ghost → cave。
`yule` の聞き取りは「拍の飛び」の指摘が 1 つ残った（3 本目の候補のループ）。気になるなら `--only yule --takes 3` で録り直す。

## 6. ボスの曲の 3 分け（2026-10-03、持ち主の決め事 1）
新しい 4 曲（BGM 生成の道具、`chronicle/design/bgm/prompts_regions.json`。1 本ずつ録り、継ぎ目の聞き取り・音量・ループの小節で確かめた）。
ボスの 4 曲はループの終わりの後ろに 1.5 s の「続きの尾」（ループの頭の音）を付けた（道具の `--tail`・prompts の `tail`）: 暴走で速めた曲は `<audio>`（preservesPitch）で鳴り、25 ms ごとの見回りで loopEnd を越えるので、尾があればファイルの終わりで切れない（Chromium で 1.13 倍の時に loopEnd → loopStart へ戻り、ended にならないことを確かめた）。
| id | 何の曲 | 長さ | ループ | 継ぎ目 |
|---|---|---|---|---|
| `lastboss`（作り直し） | 最後の戦い・第一形態（虚ろの王）。厳かで荘厳: オルガン・言葉のない合唱・低い金管のコラール・鐘、120 | 115.3 s | 17.8→113.8 s（96.0 s = 48 小節） | 7/10（片方が「拍の飛び」、継ぎ目は頭へ戻る盛り上がり） |
| `lastboss2` | 最後の形（ネムレア）。荘厳で前へ進む、山場で長調のコラールが開く、150 | 108.3 s | 30.0→106.8 s（76.8 s = 48 小節） | 9.5/10 |
| `regionboss` | 地方のボス（地方を解く戦い）。大灯火を呑んだ古い獣との決戦、金管の英雄的な旋律、約 150 | 78.2 s | 25.5→76.7 s（51.2 s = 32 小節） | 5.5/10（「楽器が急に変わる」= 節の頭へ戻る所。音量の段差 1.2 dB） |
| `chapterboss` | 章のボス（物語の山場）。弦とホルンの斉奏・ピアノの刻み、劇的で情のある 164 | 84.0 s | 27.0→82.5 s | 10/10 |
前の `lastboss` は `chronicle/design/bgm/prev/lastboss.ogg|json`（戻すならそれを assets/bgm へ）。

| 分け | 編成（troop） | 曲 |
|---|---|---|
| 最後 | 虚ろの王 tr_b_nemrea1 | `lastboss`（前は troops.js の後処理で `hollowking`。`hollowking` は大書庫 6 階のマップの曲に残す） |
| 最後 | ネムレア tr_b_nemrea2 | `lastboss2`（前は `lastboss`） |
| 地方 | ページ食らい（序章）・根食らい・名なき砂の王・白竜ネーヴェ・霧食らい・亡霊船長グレン・鉄の番人・溶岩の巨獣・星食らい（regions.js の bossTroop） | `regionboss`（前は boss／boss2） |
| 章 | 鷹団の頭ラシード tr_b_hawkchief（隊商）・吹雪の大狼 tr_b_blizzardwolf_0/1/2（籠城）・ザクロ tr_b_zakuro（闘技の決勝）・大書記ラザロ tr_b_lazaro | `chapterboss`（前は boss、ラザロは tension。戦いの前の場面の tension はそのまま） |
| そのまま | ロウェル 2 回 `rival`・円環竜 `superboss`・魔王の残影 `valzard`（前は boss2。曲は前からあった） | |
| そのまま（中ボス） | ダストウィング・砂もぐり・氷壁の巨人・人形楽団・大ダコ・岩食らい・炎の番犬・天球の番人・狼の群れ・鷹の砦・闘技 4 回戦・つららの番 `boss`／太陽の番兵・本の巨人・勇者の影・鉱脈の主・氷の船団長 `boss2` | |
通常の戦闘は `battle` 1 曲のまま。

## 7. 地方の曲（2026-10-03、持ち主の決め事 3）
新しい 5 曲（同じ prompts_regions.json）。地方の町・屋内・エリア（フィールド）に。酒場は `tavern`、ダンジョン・洞窟・ワールドは共通のまま（ロッホとカルデラの酒場は前は `town` だったので `tavern` に揃えた）。
| id | 地方 | 曲 | 長さ・ループ | 鳴る所 |
|---|---|---|---|---|
| `marsh` | グレイモア湿原 | 霧と七つの鐘楼の町、6/8 の民謡のバラード（ロー・ホイッスル・フィドル・ハープ・遠い鐘）、92 | 68.7 s、13.2→68.7 | ロッホ・屋内・m_* 6 枚 |
| `isles` | マレア諸島 | 灯の港と舟歌（ナイロン弦のギター・マリンバ・笛・アコーディオン）、96 | 95.4 s、6.1→95.4 | コーラル・ネレイ・屋内・i_cape i_cliff i_cove |
| `sea`（前からある曲） | 同 | 船で渡る沖の島 | — | i_light i_siren i_crab i_wreck・灯台島の灯室 |
| `mine` | ガルド山地 | 鍛冶の町の行進の仕事歌（低い金管・ダルシマー・金床）、100 | 71.0 s、24.8→71.0 | ドヴァン・ヴォルク・屋内・隠者の小屋・g_* 3 枚 |
| `ash` | 灰の荒野 | 火の番の町、フラメンコ風（ラスゲアードのギター・手拍子・カホン・トランペット）、108 | 80.8 s、19.7→80.8 | カルデラ・闘技場・屋内・ハイミの宿・a_* 7 枚 |
| `volcano`（前からある曲） | 同 | 火山の中 | — | ash_volcano_1・2（前は cave） |
| `star` | オルビス高原 | 星読みの学院の町、3/4 のワルツ（チェレスタ・ハープ・クラリネット）、84 | 74.9 s、9.5→74.9 | オルビス・屋内・s_* 4 枚 |
どれも −18 LUFS、ピーク −4〜−7 dBFS（クリップなし）、継ぎ目の聞き取り 9.5〜10/10。森（f_*）と序章のエリアは `overworld` のまま（最初の地方なので主題の曲を聞かせる）。
録音の曲が無いときの代わり（R.Audio.FALLBACK、core/audio.js）: lastboss2 → lastboss、regionboss → boss2、chapterboss → boss、marsh・isles・mine・ash・star → town、sea → overworld。

## 8. ビルド（2026-10-03）
`build.js` の SLICE_BGM に無い曲は既定のビルドに入らず、合成の曲で鳴っていた: `lastdungeon` `hollowking` `lastboss` `rival` `superboss` `valzard` `ending`（大書庫・最後の戦い・ロウェル・エンディング）。新しい 9 曲・`sea`・`volcano` といっしょに足した（validate.js にも）。
dist/bgm は 25.4 → 40.7 MB（+15.3 MB: 新しい 9 曲 8.6 MB、入っていなかった前からの 8 曲 6.7 MB）。
