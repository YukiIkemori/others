# BGM の変更（縦切りの音の手直し、2026-09-27）

- 作ったもの: `chronicle/assets/bgm/<id>.ogg` + `<id>.json`（ループ点 `loopStart/loopEnd`、`omen` だけ `loop:false`）。どれも Ogg Vorbis 96 kbps・−18 LUFS（`omen` は −17）、ループの継ぎ目にクロスフェードを焼き込み済み。前の版は `chronicle/design/bgm/prev/` にある（聞き比べ: `chronicle/design/story_audio_preview.html`）。
- 生成の元: `chronicle/design/bgm/prompts_v2.json`（BGM 生成ツールを prompts_v2.json で実行）。`prompts.json`（v1 の 32 曲の一覧）は変えていない。
- 継ぎ目の聞き取り（聞く係のモデルが 2 回聞いた平均、10 = 気づかない）と、スペクトルの似かた。

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
