# ルミナス・クロニクル v2 縦切り　物語ボイス（ティア A）と町のあいさつ

正は `design/voice/story_v2_lines.csv`（このファイルは `node tools/story_voice.js` が作る。手で直さない）。文面は v2 のイベントと 1 字も違わない（違えば check が落ちる）。
主人公は物語ではしゃべらない（STORY_BIBLE 冒頭）ので、主人公の台詞は無い。ラザロは 5 階より前に声で出さない（§5.1）ので縦切りには無い。ノアは縦切りに出ない。

- 種類: story = 物語の要の台詞／optional = 設計では声なしの所（使うかはオーナーとリード）／bark = 話しかけたときの 1〜2 秒のあいさつ
- 作り方: `node tools/voice_tts.js --story2`（無いファイルだけ。`--only <id> --force` で作り直し）。つなぎ方: `v2/design/voice_story_map.json`

## 配役（新しく足した人）

| 話者 | 声 | 役 |
|---|---|---|
| オットー `otto` | `ja-jp-csagent-7` ×0.94 | Otto, the old lighthouse keeper of the harbour town Pharos, about 70: broad-shouldered, short white beard, skin weathered by the sea wind. Warm, gruff and grandfatherly; speaks old-man Japanese (…じゃ, …のう). |
| ベルナ `berna` | `ja-jp-assistant-6` | Berna, a storyteller woman of about 70, the hero's mentor who raised the hero. Soft, warm and a little mischievous grandmother. |
| フィーネ `fine` | `ja-jp-csagent-8` | Fine, a girl who looks about 15 in a grey hooded cloak; in truth the first storyteller from a thousand years ago. Quiet, clear, gentle, a little old-fashioned; her body is fading. |
| ロウェル `rowell` | `ja-jp-tutor-4` | Rowell, a 20-year-old male archivist of the Archive and the hero's rival. Stiff, proud and sarcastic at first; later full of doubt, then a loyal ally. |
| エルム `elm` | `ja-jp-advisor-9` fx spirit | Elm, the ancient lord of the forest who dwells in a thousand-year-old tree. Calm, old and wise; remorseful, then grateful. |
| タデオ `tadeo` | `ja-jp-assistant-12` | Tadeo, a man in his forties, an oil seller of the lamp-keepers' guild in the harbour town; practical, dry, decent. |
| 漁師のおかみ `fishwife` | `ja-jp-podcaster-6` | A fisherman's wife of the harbour town, about forty; brisk, cheerful and generous. |
| 門番 `gateguard` | `ja-jp-concierge-8` | The gate guard of the harbour town, a man in his thirties; polite, a little formal, dutiful. |
| 潮風亭のマスター `master` | `ja-jp-csagent-3` | The master of the harbour tavern 'Shiokaze-tei', a man around forty who has seen many adventurers; easygoing and welcoming. |
| ゴード `gord` | `ja-jp-advisor-6` | Gord, the woodcutter chief of the forest village Fern, in his forties, Pim's father; gruff, strong, worn out by worry. |
| ハンナ `hanna` | `ja-jp-csagent-4` | Hanna, an old woman in her seventies in the forest village Fern who married in from the storytellers' village long ago; kind and gentle. |
| リタ `rita` | `ja-jp-tutor-3` | Rita, about twenty, the singer of the forest village Fern who lives in a treetop house; clear-voiced, earnest, a little shy. |
| ピム `pim` | `ja-jp-csagent-2` ×1.06 | Pim, a ten-year-old boy of the forest village Fern, the woodcutter's son; lively, brave, wants to become a storyteller. Performed by a female voice actress, as is usual for boys in anime. |

## オットー

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_otto_pharos_01` | story | `pharos_otto` first meeting (before party) say 1 | わしは灯台守のオットー。<br>灯台の火が消えてしまって、<br>ゆうべは眠れんかった。 | first meeting; tired and worried, a sleepless old man introducing himself with a heavy sigh |
| `v_otto_pharos_02` | story | `pharos_otto` first meeting (before party) say 2 | ……なに、灯台へ行くと？<br>ひとりで？ とんでもない。<br>酒場「潮風亭」で仲間を見つけておいで。 | surprised, then protective and scolding like a grandfather; firm but kind at the end |
| `v_otto_pharos_03` | story | `pharos_otto` with party say 1 | おお、仲間を連れてきたか。<br>それなら話は別じゃ。 | pleasantly surprised, relieved, a warm chuckle in the voice |
| `v_otto_pharos_04` | story | `pharos_otto` with party say 2 | 灯台の守り歌が、<br>どうしても思い出せんのじゃ。<br>あの歌がなけりゃ、火はつかん。 | quietly distressed, ashamed that his memory fails him; slow |
| `v_otto_pharos_05` | story | `pharos_otto` with party say 3 | ……頼む。<br>これが灯台の鍵じゃ。 | a heartfelt plea after a pause, handing over something precious; low and sincere |
| `v_otto_pharos_06` | story | `pharos_otto` after the key say 1 | 灯台は、町を出て南の<br>岬の先じゃ。行く前に、<br>戦いの心得を教えておこう。 | practical and steady, an old hand giving directions, a little proud to teach |
| `v_otto_tower_01` | story | `lighthouse_1_tutorial` say 1 | 中から、ネズミの鳴き声が……<br>気をつけるんじゃ！ | hushed alarm, listening at the door, then a sharp warning |
| `v_otto_tower_02` | story | `lighthouse_1_tutorial` after a lost tutorial battle | ……危なかったのう。<br>ひと息ついて、もう一度じゃ。 | relieved and encouraging, gentle |
| `v_otto_tower_03` | story | `lighthouse_1_tutorial` glimmer explained (technique; spell=false) | 今のは……『閃き』じゃな。<br>戦いの中で、ふいに<br>新しい技を思いつくことがある。 | impressed and delighted, an old man recognising something he has seen before |
| `v_otto_tower_04` | story | `lighthouse_1_tutorial` glimmer explained (spell; spell=true) | 今のは……『閃き』じゃな。<br>戦いの中で、ふいに<br>新しい術を思いつくことがある。 | impressed and delighted, an old man recognising something he has seen before |
| `v_otto_tower_05` | story | `lighthouse_1_tutorial` last say before leaving | わしは港へ戻っておる。<br>上の灯室を、頼んだぞ。 | trusting, entrusting the task; warm and firm |
| `v_otto_reward_01` | story | `pharos_otto_reward` first time say 2 (the song) | ♪　海の果てまで、灯よ届け<br>帰る舟に、道を照らせ……。 | he half-sings, half-hums the old lighthouse song he just got back, slow and a little shaky, full of emotion; a plain folk melody, not performed |
| `v_otto_reward_02` | story | `pharos_otto_reward` first time say 3 | これは、わしが若いころから<br>使ってきたランタンじゃ。<br>持っていっておくれ。 | tender and grateful, giving a treasured keepsake |
| `v_otto_reward_03` | story | `pharos_otto_reward` first time say 4 | 若いころ、灯台には<br>『朝番』というのがあってな。<br>火が戻ったら、また立てるつもりじゃ。 | fond reminiscence, smiling, looking forward |
| `v_otto_reward_04` | story | `pharos_otto_reward` first time say 5 | ……はて。何を見張る番<br>じゃったかのう。<br>どうしても思い出せん。 | the smile fades into puzzlement; quiet, a little lost, unsettling in its gentleness |

## ベルナ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_berna_p2_01` | story | `roa_berna` P2[0] | そうそう、大事な話があるんだ。 | remembering something important, gently turning serious |
| `v_berna_p2_02` | story | `roa_berna` P2[1] | 近ごろ、あちこちで<br>伝承が消えていくんだよ。 | worried, lowering her voice |
| `v_berna_p2_03` | story | `roa_berna` P2[2] | 歌の続きが出てこない。<br>祭りの由来が分からない。<br>そんな話ばかりさ。 | listing the signs with quiet sadness, unhurried |
| `v_berna_p2_04` | story | `roa_berna` P2[3] | わたしたち語り部は、それを<br>『白紙』と呼んでいる。 | grave, naming something ominous with care |
| `v_berna_p2_05` | story | `roa_berna` P2[4] | 里の語り石の文字も、<br>半分が白く抜けてしまった。 | sad, looking toward the village stone |
| `v_berna_p2_06` | story | `roa_berna` P2[5] | それにね、港町ファロスの<br>灯台の火が、細りはじめて三晩。<br>きのう、とうとう消えたそうだ。 | telling news she has heard, concern growing to the last sentence |
| `v_berna_p2_07` | story | `roa_berna` P2[6] | あの灯台には、守り歌という<br>古い伝承があってね。<br>それも、白紙になりかけている。 | a storyteller's voice, fond of the old tale, then worried |
| `v_berna_p2_08` | story | `roa_berna` P2[8] | ただし、ひとりで行っちゃ<br>だめだよ。ファロスの酒場<br>「潮風亭」で、仲間を探しなさい。 | a mentor's gentle warning, slightly stern then warm |
| `v_berna_p2_09` | story | `roa_berna` P2[9] | それから、これを持って<br>お行き。 | kind, handing over a small parcel |
| `v_berna_seat_01` | story | `roa_seat` say (berna_desk) | 昔からの習わしさ。<br>誰の席かは……忘れちまったよ。 | light and matter-of-fact at first, then a small puzzled pause; a hint of sadness she does not notice |
| `v_berna_depart_01` | story | `pharos_departure` say after the chapter caption (rumours) | うわさは酒場に集まるものさ。<br>まずは港の酒場で<br>聞いてごらん。 | cheerful advice, a knowing smile |
| `v_berna_depart_02` | story | `pharos_departure` farewell (the first forgetting) | わたしは里へ帰るよ。<br>……いってらっしゃい、 | warm farewell; after いってらっしゃい she starts to say the apprentice's name and cannot find it: the line trails off unfinished, a tiny stall |
| `v_berna_home_01` | story | `roa_berna` after prologue pick (default) | おかえり。年代記は、<br>ちゃんと書いているかい？ | welcoming someone home, teasing a little |
| `v_berna_home_02` | story | `roa_berna` after prologue pick cleared_r_forest | 森の灯が戻ったそうだね。<br>語り石の文字が、ほんの少し<br>読めるようになった気がするよ。 | proud and moved, quietly happy |
| `v_berna_home_03` | story | `roa_berna` stay morning (E.stay o.morning) | よく眠れたかい？<br>……さあ、いってらっしゃい。 | soft morning voice, gentle send-off |

## フィーネ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_fine_forest_02` | story | `elder_fine` say 2 (after v_fine_forest_01) | ……気をつけて。 | barely above a whisper, sincere, as she turns to go |
| `v_fine_windhill_01` | story | `windhill_notes` say (grey-cloaked girl) | ……風も、歌を覚えているのね。 | wistful and faintly amused, like talking to herself on a windy hill |
| `v_fine_opening_01` | optional | `roa_house_intro` caption 1 (ev.caption: no voice option yet) | ……ねえ、聞こえる？ | the opening of the game over black: an intimate whisper to the player, a voice from very far away |
| `v_fine_opening_02` | optional | `roa_house_intro` caption 2 | これは、忘れられかけた物語。 | soft storyteller's narration, slow |
| `v_fine_opening_03` | optional | `roa_house_intro` caption 3 | そして、それを語り直した、<br>ひとりの語り部の物語。 | narration, a quiet warmth and hope on the last words |
| `v_fine_song_01` | story | `roa_house_intro` caption after 「……ねえ、聞こえる？」 (the lighthouse song over black; ev.caption voice) | ♪　海の果てまで、灯よ届け<br>帰る舟に、道を照らせ | the very start of the game, over black: she softly sings-speaks the old lighthouse lullaby like someone rocking a cradle, very slow, a gentle rise and fall on each phrase, a long tender pause between the two lines, warm and hushed; a plain chanted folk lullaby, not a performed song |
| `v_fine_song_02` | story | `lighthouse_3_boss` caption after the Page Eater (the song comes back on the paper; ev.caption voice) | ♪　海の果てまで、灯よ届け<br>帰る舟に、道を照らせ | the lost words slowly reappear on a slip of paper and she reads the lighthouse song back to life as a lullaby: slow chant-like cadence, soft wonder and quiet relief, each phrase lingering and fading, hushed like singing a child to sleep; not a performed song |

## ロウェル

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_rowell_pharos_01` | story | `pharos_rowell` repeat talk pick prologue_done | 灯台に火が戻っただと？<br>……写し取ったはずの歌が、<br>どうして。 | stunned disbelief, then a shaken half-whisper; the first crack in his certainty |
| `v_rowell_pharos_02` | story | `pharos_rowell` repeat talk pick prologue_key | 灯台守から鍵を借りたそうだな。<br>……火をともせるものなら、<br>ともしてみるがいい。 | cool and sarcastic, a challenge |
| `v_rowell_pharos_03` | story | `pharos_rowell` repeat talk pick default | まだいたのか。<br>写し取った伝承は、本院で<br>大切に保管される。 | curt and dismissive, bureaucratic pride |

## エルム

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_elm_forest_07` | story | `elder_elm` say array page 1 | 森の道は、もう閉ざさぬ。<br>夏至の歌も、村の者たちが<br>また歌ってくれるだろう。 | calm and grateful, slow and resonant |
| `v_elm_forest_08` | story | `elder_elm` say array page 2 | ただ、迷いの森の魔物は、<br>わたしにも鎮められぬ。<br>腕を磨くには、よいだろう。 | wise, a faint dry humour at the end |

## タデオ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_tadeo_greet_01` | bark | `pharos_tadeo` bark: when the talk opens | よい灯りを。 | the world's everyday greeting in the endless night; a businesslike oil merchant, friendly, brief |

## 漁師のおかみ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_fishwife_greet_01` | bark | `pharos_fishwife` bark: when the talk opens | よい灯りを。 | brisk, cheerful harbour woman greeting a passer-by |

## 門番

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_gateguard_greet_01` | bark | `pharos_gateguard` bark: when the talk opens | よい灯りを、旅の方。 | a town gate guard, polite and a bit formal |

## 潮風亭のマスター

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_master_greet_01` | bark | `pharos_tavern_master` bark: when the talk opens | いらっしゃい。 | a tavern keeper welcoming a guest, warm and easygoing |

## ゴード

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_gord_greet_01` | bark | `gord (fern)` bark: when the talk opens | おう、あんたか。 | a gruff woodcutter chief, tired but glad to see someone |

## ハンナ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_hanna_greet_01` | bark | `hanna (fern)` bark: when the talk opens | おや、旅の方。 | a kind old village woman, gentle surprise |

## リタ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_rita_greet_01` | bark | `rita (fern)` bark: when the talk opens | あ、語り部さん。 | a young village singer, clear and bright, a little shy |

## ピム

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_pim_greet_01` | bark | `pim_after (fern)` bark: when the talk opens (after the rescue) | あっ、語り部さん！ | a ten-year-old boy, excited and happy |
