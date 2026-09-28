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
| zaid `zaid` | `ja-jp-concierge-6` | Zaid, the caravan master of the oasis town Kasim, in his fifties: sun-dried, steady and responsible; sings the old star songs at the campfire; speaks a plain older man's Japanese (わし). |
| rashid `rashid` | `ja-jp-tutor-9` | Rashid, the masked chief of the Sand Hawks bandits, about forty; a deserter of the Sun League army; hard and terse, but not cruel, and haunted by a night he cannot remember. |
| hazal `hazal` | `ja-jp-advisor-3` fx spirit | Hazal, a desert king sealed in his tomb whose name was forgotten; anguished, then relieved when the name returns. |
| nadia `nadia` | `ja-jp-training-5` | Nadia, a dancer of the oasis town Kasim, about eighteen; lively and warm, sings the song of the forgotten king every night in the square. |
| jorn `jorn` | `ja-jp-podcaster-11` ×0.93 | Jorn, the chief of the snow village Yule, about sixty; broad, weathered and dependable, carries the village through the midwinter fire festival and the siege; speaks older-man Japanese (わし). |
| hald `hald` | `ja-jp-techagent-11` ×0.9 | Hald, the old watchman of the snow village Yule, about seventy, missing two fingers; gruff and watchful, remembers the night the north gate burned. |
| sonja `sonja` | `ja-jp-advisor-5` | Sonja, about sixteen, the daughter of the fire-keepers of the snow village Yule who guards the great hearth; earnest, quiet and a little lonely; keeps a board counting the nights. |
| neve `neve` | `ja-jp-training-10` fx spirit | Neve, the noble white dragon (female) of the frozen peak. Majestic and cold at first, then warm and grateful. |
| mayor `mayor` | `ja-jp-concierge-2` ×0.92 | Oswald, the mayor of the lake town Loch, about sixty; stern and careful, presides over the town assembly; speaks older-man Japanese (わし). |
| melda `melda` | `ja-jp-tutor-1` fx spirit | Melda, the ghost of the kind witch who once owned the misty manor. Elegant mature woman, gentle and melancholic. |
| dorga `dorga` | `ja-jp-advisor-1` ×0.9 | Dorga, the chief of the crater town Caldera, about sixty; a former proxy fighter of the Firebird League, broad and scarred; grave, few words; speaks older-man Japanese (わし). |
| kaya `kaya` | `ja-jp-podcaster-2` | Kaya, the young fire priestess of the crater town Caldera, about twenty; earnest and gentle, frightened because she cannot remember the firebird's story she must tell the cooling egg. |
| zakuro `zakuro` | `ja-jp-advisor-10` | Zakuro, a hired fighter attached to the Archive, in his thirties; laconic and blunt but strictly honourable (never reads other people's letters); rough-spoken (俺, ねえ). |

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
| `v_otto_reward_05` | story | `pharos_otto_reward` first time say 1 (the name shows first; the voice skips {hero}) | 灯台に火が戻ったぞ！<br>守り歌も、思い出せた。 | overjoyed and moved, an old man almost laughing with relief; the lighthouse is lit again and the song came back |

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
| `v_berna_home_01` | retired | `roa_berna` after prologue pick (default) | おかえり。年代記は、<br>ちゃんと書いているかい？ | welcoming someone home, teasing a little |
| `v_berna_home_02` | retired | `roa_berna` after prologue pick cleared_r_forest | 森の灯が戻ったそうだね。<br>語り石の文字が、ほんの少し<br>読めるようになった気がするよ。 | proud and moved, quietly happy |
| `v_berna_home_03` | retired | `roa_berna` stay morning (E.stay o.morning) | よく眠れたかい？<br>……さあ、いってらっしゃい。 | soft morning voice, gentle send-off |
| `v_berna_intro_01` | story | `roa_house_intro` E.say after ev.createHero (the name shows first; the voice skips {hero}) | ……うん、いい名前だ。 | after hearing the new apprentice's name: a short, clear, affirmative nod-word うん (yes — not a hesitant hmm), then warm fond approval like a grandmother, a small smile in the voice |
| `v_berna_p2_10` | story | `roa_berna` P2[7] (the name shows first; the voice skips {hero}) | 行っておくれ。<br>語り部の見習いとしての、<br>最初の仕事だよ。 | sending her apprentice off on the first real job: gentle but firm, proud and a little moved, unhurried |

## フィーネ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_fine_forest_02` | story | `elder_fine` say 2 (after v_fine_forest_01) | ……気をつけて。 | barely above a whisper, sincere, as she turns to go |
| `v_fine_windhill_01` | story | `windhill_notes` say (grey-cloaked girl) | ……風も、歌を覚えているのね。 | wistful and faintly amused, like talking to herself on a windy hill |
| `v_fine_opening_01` | story | `roa_house_intro` caption 1 (ev.caption voice; owner 2026-09-27) | ……ねえ、聞こえる？ | the opening of the game over black: an intimate whisper to the player, a voice from very far away |
| `v_fine_opening_02` | story | `roa_house_intro` caption 2 | これは、忘れられかけた物語。 | soft storyteller's narration, slow |
| `v_fine_opening_03` | story | `roa_house_intro` caption 3 | そして、それを語り直した、<br>ひとりの語り部の物語。 | narration, a quiet warmth and hope on the last words |
| `v_fine_song_01` | story | `roa_house_intro` caption after 「……ねえ、聞こえる？」 (the lighthouse song over black; ev.caption voice) | ♪　海の果てまで、灯よ届け<br>帰る舟に、道を照らせ | the very start of the game, over black: she softly sings-speaks the old lighthouse lullaby like someone rocking a cradle, very slow, a gentle rise and fall on each phrase, a long tender pause between the two lines, warm and hushed; a plain chanted folk lullaby, not a performed song |
| `v_fine_song_02` | story | `lighthouse_3_boss` caption after the Page Eater (the song comes back on the paper; ev.caption voice) | ♪　海の果てまで、灯よ届け<br>帰る舟に、道を照らせ | the lost words slowly reappear on a slip of paper and she reads the lighthouse song back to life as a lullaby: slow chant-like cadence, soft wonder and quiet relief, each phrase lingering and fading, hushed like singing a child to sleep; not a performed song |

## ロウェル

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_rowell_pharos_01` | retired | `pharos_rowell` repeat talk pick prologue_done | 灯台に火が戻っただと？<br>……写し取ったはずの歌が、<br>どうして。 | stunned disbelief, then a shaken half-whisper; the first crack in his certainty |
| `v_rowell_pharos_02` | retired | `pharos_rowell` repeat talk pick prologue_key | 灯台守から鍵を借りたそうだな。<br>……火をともせるものなら、<br>ともしてみるがいい。 | cool and sarcastic, a challenge |
| `v_rowell_pharos_03` | retired | `pharos_rowell` repeat talk pick default | まだいたのか。<br>写し取った伝承は、本院で<br>大切に保管される。 | curt and dismissive, bureaucratic pride |

## エルム

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_elm_forest_07` | retired | `elder_elm` say array page 1 | 森の道は、もう閉ざさぬ。<br>夏至の歌も、村の者たちが<br>また歌ってくれるだろう。 | calm and grateful, slow and resonant |
| `v_elm_forest_08` | retired | `elder_elm` say array page 2 | ただ、迷いの森の魔物は、<br>わたしにも鎮められぬ。<br>腕を磨くには、よいだろう。 | wise, a faint dry humour at the end |

## タデオ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_tadeo_greet_01` | retired | `pharos_tadeo` bark: when the talk opens | よい灯りを。 | the world's everyday greeting in the endless night; a businesslike oil merchant, friendly, brief |

## 漁師のおかみ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_fishwife_greet_01` | retired | `pharos_fishwife` bark: when the talk opens | よい灯りを。 | brisk, cheerful harbour woman greeting a passer-by |

## 門番

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_gateguard_greet_01` | retired | `pharos_gateguard` bark: when the talk opens | よい灯りを、旅の方。 | a town gate guard, polite and a bit formal |

## 潮風亭のマスター

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_master_greet_01` | retired | `pharos_tavern_master` bark: when the talk opens | いらっしゃい。 | a tavern keeper welcoming a guest, warm and easygoing |

## ゴード

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_gord_greet_01` | retired | `gord (fern)` bark: when the talk opens | おう、あんたか。 | a gruff woodcutter chief, tired but glad to see someone |

## ハンナ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_hanna_greet_01` | retired | `hanna (fern)` bark: when the talk opens | おや、旅の方。 | a kind old village woman, gentle surprise |

## リタ

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_rita_greet_01` | retired | `rita (fern)` bark: when the talk opens | あ、語り部さん。 | a young village singer, clear and bright, a little shy |
| `v_rita_forest_01` | story | `fern_rita` first talk page 1 (sings the first verse, then stops) | ♪　眠れ森の主、千の年輪に……。<br>だめ。この先が、<br>どうしても出てこないの。 | sings the first line softly and slowly as a melody, then breaks off; frustrated and sad that the rest will not come |
| `v_rita_forest_02` | story | `fern_rita` first talk page 2 (introduces herself) | わたしはリタ。この村の歌い手。<br>千年樹の歌は、最初の一節しか<br>思い出せないの。 | introduces herself shyly and earnestly; a little ashamed that the village singer has forgotten the song |
| `v_rita_forest_03` | story | `forest_finale` the song night in the plaza (before the song) | みんな、聞いて。<br>千年樹の歌よ。 | calls the gathered village to listen, happy and a little nervous; she can sing the whole song again |

## ピム

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_pim_greet_01` | retired | `pim_after (fern)` bark: when the talk opens (after the rescue) | あっ、語り部さん！ | a ten-year-old boy, excited and happy |

## zaid

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_zaid_desert_01` | story | `kasim_zaid` first meeting page 1 | わしは隊商の長ザイード。<br>掲示を見てくれたか。 | first meeting; introduces himself plainly, a caravan master sizing up the travellers |
| `v_zaid_desert_02` | story | `kasim_zaid` first meeting page 2 | 王墓のオアシスへ、供え物を運ぶ。<br>昔からの習わしでな。泉の水の源が、<br>そこの古い泉なんだ。 | explains the old custom calmly, with quiet respect for the tradition |
| `v_zaid_desert_03` | story | `kasim_zaid` first meeting page 3 (the request) | 砂嵐と盗賊で、隊が出せずにいる。<br>護衛を頼めないか。<br>野営を三晩、オアシスまでだ。 | worried but steady; asks for help as a serious request |
| `v_zaid_desert_04` | story | `desert_camp3_scene` third night page 1 (the dawn star) | 地の果ての、白む星……。<br>祖母は、あれを「夜明けの星」と<br>呼んでいた。 | at the campfire, looking at a star low on the horizon; soft and nostalgic, remembering his grandmother |
| `v_zaid_desert_05` | story | `desert_camp3_scene` third night page 2 (what is dawn?) | ……夜明け。<br>ふしぎな言葉だな。<br>夜が、明ける？　何が明けるんだ？ | puzzled and wondering, almost to himself; he does not know what the word dawn means |
| `v_zaid_desert_06` | story | `desert_finale` the spring fills page 1 | 泉が……泉が満ちていく！ | astonished, overjoyed, his voice rising as the water wells up |
| `v_zaid_desert_07` | story | `desert_finale` the spring fills page 2 | ……この光、祖母の歌の<br>「夜明けの星」の色だ。 | hushed and moved, recognising the colour from his grandmother's song |
| `v_zaid_song_01` | story | `desert_camp1_scene` star song 1 (caption, X.STARS[0]) | ♪　北のくぎ星　動かぬ星よ<br>♪　迷う隊商の　くいとなれ | sings a slow, simple caravan song at the campfire, low and steady, like an old folk melody |
| `v_zaid_song_02` | story | `desert_camp2_scene` star song 2 (caption, X.STARS[1]) | ♪　七つの泉星　ひしゃくを傾け<br>♪　夜のしずくを　砂にまけ | sings a slow, simple caravan song at the campfire, warm and steady |
| `v_zaid_song_03` | story | `desert_camp3_scene` star song 3 (caption, X.STARS[2]) | ♪　地の果ての　白む星よ<br>♪　……祖母は　「夜明けの星」と呼んだ | sings softly, the last line spoken more than sung, wistful |

## rashid

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_rashid_desert_01` | story | `desert_camp1_scene` the ambush page 1 (before the boss) | 動くな。命まではもらわん。 | a masked bandit on a rock with bows drawn: cold, low and commanding |
| `v_rashid_desert_02` | story | `desert_camp1_scene` the ambush page 2 | おれたちは「砂の鷹」。<br>欲しいのは水だ。水がめを<br>半分置いていけ。 | names his band and makes the demand; hard, businesslike, not cruel |
| `v_rashid_desert_03` | story | `desert_camp1_scene` after the boss (fight) page 1 | ……いい腕だ。おれはラシード。<br>昔は、日輪同盟の兵だった。 | beaten, kneeling, breathing hard; grudging respect as he gives his name and his past |
| `v_rashid_desert_04` | story | `desert_camp1_scene` after the boss (fight) page 2 | 二十年前の代理試合の夜……<br>歌が聞こえた。敵も味方も、<br>手を止めた。 | quiet and faraway, remembering a night when a song stopped a battle |
| `v_rashid_desert_05` | story | `desert_camp1_scene` after the boss (fight) page 3 | ……そのあとのことは、<br>なぜか思い出せん。気づけば、<br>砂の上で盗賊をしていた。 | troubled and bitter; he cannot remember what came after |
| `v_rashid_desert_06` | story | `desert_camp1_scene` after the boss (fight) page 4 | 行け。おれたちは台地の洞へ帰る。<br>……次は、こうはいかんぞ。 | gets up and leaves; gruff warning with a trace of respect |
| `v_rashid_hawks_01` | story | `desert_hawks_boss` before the boss page 1 | ……来たか。隊商の犬め。<br>ここは、おれたちの最後の巣だ。 | in his last hideout, hostile and cornered; spits the insult |
| `v_rashid_hawks_02` | story | `desert_hawks_boss` before the boss page 2 | 今度は、手加減せんぞ！ | draws his blade, fierce battle resolve |
| `v_rashid_hawks_03` | story | `desert_hawks_boss` after the boss page 1 | ……まいった。<br>おれたちの負けだ。 | defeated and out of breath; admits it plainly |
| `v_rashid_hawks_04` | story | `desert_hawks_boss` after the boss page 2 | この手袋を持っていけ。<br>……もう、盗みはやめる。<br>洞の者を食わせる道を探すさ。 | hands over his gloves; tired, resolved to give up stealing, quietly decent |

## hazal

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_hazal_tomb_05` | story | `desert_tomb_king` after the name page 1 | 水と引き換えに、わたしは名を<br>砂の精霊に差し出した。 | the king with his name back: slow, grave, confessing an old bargain |
| `v_hazal_tomb_06` | story | `desert_tomb_king` after the name page 2 | 名を呼ぶかぎり、日輪の火は消えぬ。<br>……その約束も、石から写されて<br>消えてしまったのだ。 | sorrowful: the promise was copied from the stone and lost |
| `v_hazal_tomb_07` | story | `desert_tomb_king` after the name page 3 | 語り部よ。<br>わたしの名を、もう一度<br>泉の民に返してくれ。 | a solemn, gentle plea to the storyteller |

## nadia

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_nadia_desert_01` | story | `kasim_nadia` first meeting (before the song) | わたしはナディア。踊り子よ。<br>毎晩、広場で王さまの歌を<br>歌って踊るの。聞いて。 | bright and friendly, introduces herself and invites them to listen |
| `v_nadia_desert_02` | story | `kasim_nadia` after the song page 1 | ……名前の所だけ、<br>どうしても歌えないの。<br>母さんも、おばあちゃんも。 | sad and a little embarrassed; the name will not come to anyone |
| `v_nadia_desert_03` | story | `kasim_nadia` after the song page 2 | 王さまの名前、王墓の石に<br>刻まれてたって聞いたわ。<br>誰も、読みに行けないけど。 | thoughtful, with a hint of longing |
| `v_nadia_desert_04` | story | `desert_finale` the square, page 1 (asks the name) | 王さまの名前、わかったんでしょう？<br>……教えて。 | eager and hopeful, then quietly asking |
| `v_nadia_desert_05` | story | `desert_finale` the square, page 2 (the name fits) | ハザル……。うん、ぴったり。<br>歌ってみるね。 | tries the name, delighted, then ready to sing |
| `v_nadia_song_01` | story | `kasim_nadia` the king's song with the name missing (caption, X.SONG_BLANK) | ♪　砂の海に　水を招いた王よ<br>♪　その名は――　……<br>♪　夕べの祈りに　とこしえに | sings a graceful dancer's song; at the missing name she falters into a silent pause, then finishes the last line |
| `v_nadia_song_02` | story | `desert_finale` the king's song in full (caption, X.SONG_FULL) | ♪　砂の海に　水を招いた王よ<br>♪　その名はハザル　日輪の友<br>♪　夕べの祈りに　とこしえに | sings the whole song joyfully and clearly, the name ringing out |

## jorn

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_jorn_snow_01` | story | `yule_jorn` first talk say 1 page 1 | よい灯りを、旅の人。<br>わしはヨルン。ユールの村長だ。 | first meeting; a warm, grave village chief greeting a traveller |
| `v_jorn_snow_02` | story | `yule_jorn` first talk say 1 page 2 | 今夜は冬至。大火祭の夜だ。<br>大かまどで冬至の火を燃やし、<br>昔話を語って、峰へ運ぶ。 | explains the festival with pride and a little solemnity |
| `v_jorn_snow_03` | story | `yule_jorn` first talk say 2 page 1 (the promise) | 峰の白竜に火と物語を届け、<br>竜は吹雪を鎮める。<br>……それが村と竜の約束だ。 | solemn, telling the old pact between the village and the dragon |
| `v_jorn_snow_04` | story | `yule_jorn` first talk say 2 page 2 | ところが今年は、秋から<br>一日も吹雪がやまん。<br>竜に物語が届いておらんのだ。 | worried and heavy; the blizzard has not stopped since autumn |
| `v_jorn_snow_05` | story | `snow_festival` the festival: asks for the tale page 1 | 語り部よ。<br>今年の物語を、火の前で<br>語ってくれ。 | before the great fire, formal and hopeful, asking the storyteller |
| `v_jorn_snow_06` | story | `snow_festival` the festival page 2 | 峰の竜に届くように。 | quiet, a wish sent toward the peak |
| `v_jorn_snow_07` | story | `snow_festival` the wolves: three gates page 1 | 門は三つ。北、東、西。<br>わしらの手では、<br>二つしか守りきれん。 | urgent, commanding over the howling; grim about the odds |
| `v_jorn_snow_08` | story | `snow_festival` the wolves page 2 (the name shows first; the voice skips {hero}) | 力を貸してくれ。<br>守る門を、選んでくれ。 | urgent, asking for help and trusting the storyteller |

## hald

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_hald_snow_01` | story | `snow_festival` the wolves: alarm page 1 | 狼の群れだ！<br>村を囲んでおる！ | a shouted alarm through the blizzard, urgent |
| `v_hald_snow_02` | story | `snow_festival` the wolves: alarm page 2 | 門を閉めろ！<br>男たちは門へ！ | shouting orders, commanding |

## sonja

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_sonja_snow_01` | story | `yule_sonja` first talk say 1 page 1 | ……火が細いの。<br>脂を足しても、足しても。 | worried, murmuring by the weak fire |
| `v_sonja_snow_02` | story | `yule_sonja` first talk say 1 page 2 | わたしはソーニャ。<br>火守りの家の娘よ。<br>大かまどの火を守ってるの。 | introduces herself quietly and earnestly |
| `v_sonja_snow_03` | story | `yule_sonja` first talk say 2 page 1 (the book) | 祭ではね、火の前で<br>物語の本を読むの。<br>毎年、同じ本を。 | explains the custom gently |
| `v_sonja_snow_04` | story | `yule_sonja` first talk say 2 page 2 (the blank book) | でも今年、本を開いたら……<br>真っ白だったの。<br>一文字も、残ってなかった。 | shaken, almost whispering; the book was completely blank |
| `v_sonja_snow_05` | story | `snow_finale` the square page 1 (the name shows first; the voice skips {hero}) | おかえりなさい。 | relieved and happy to see them back |
| `v_sonja_snow_06` | story | `snow_finale` the square page 2 (the night board) | 夜数えの板に、今夜の刻みを<br>入れようとしたの。<br>……でも、手が止まっちゃった。 | thoughtful and puzzled, her hand stopped over the board |
| `v_sonja_snow_07` | story | `snow_finale` the square page 3 | ……今夜は、いつもより<br>空が明るい。 | soft wonder, looking up at a sky that is a little brighter |

## neve

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_neve_peak_04` | story | `snow_finale` the scale (after v_neve_peak_02・03) | ……これを持っていくがよい。<br>わたしの、うろこの一枚だ。 | calm and gracious, the dragon giving one of her scales |

## mayor

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_mayor_marsh_01` | story | `loch_assembly` the assembly: asks for the name | では、名指しを聞こう。<br>子どもたちを、誰がさらった？ | grave, formal, chairing a tense assembly |
| `v_mayor_marsh_02` | story | `loch_assembly` the mist is named page 1 | 霧……だと？<br>霧が、子どもをさらうというのか。 | taken aback, sceptical |
| `v_mayor_marsh_03` | story | `loch_assembly` the mist is named page 2 | 証拠を示しなさい。 | stern, demanding proof |
| `v_mayor_marsh_04` | story | `loch_assembly_right` the proof holds page 1 | 霧が、魔女の姿をまねて<br>子どもを連れていった……。 | slowly realising the truth, shaken |
| `v_mayor_marsh_05` | story | `loch_assembly_right` the proof holds page 2 | ……わしらは、あやうく<br>無実の館に火をかけるところだった。 | ashamed and relieved; the town nearly burned an innocent house |

## melda

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_melda_song_01` | story | `manor_melda` the bell song (caption, X.SONG, after v_melda_manor_05) | ♪　鳴れよ、七つの鐘<br>♪　霧は沼の底へ、<br>♪　朝は町の窓へ | sings the old bell song softly, a ghostly lullaby |

## dorga

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_dorga_ash_01` | story | `caldera_dorga` the singers' night (lo_war_ash) page 1 | 試合の最中に、娘が二人、<br>砂の上に下りてきて歌った。<br>敵も味方も、剣を止めた。 | quiet and faraway, an old fighter remembering the night two girls sang in the middle of the last proxy match |
| `v_dorga_ash_02` | story | `caldera_dorga` the singers' night page 2 | ……何を歌っていたのか、<br>思い出せん。あの夜から、わしは<br>この大会を『試練』と呼ぶことにした。 | troubled that he cannot remember the song; slow, grave, a vow made long ago |
| `v_dorga_ash_03` | story | `ash_finale` the plaque, the painful chronicle chosen | ……歌い手の席を、空けておこう。<br>いつか、二人の名を<br>彫れる日が来るまで。 | moved and resolved, standing before the old plaque; gentle and firm |

## kaya

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_kaya_ash_01` | story | `caldera_kaya` first meeting page 2 | 卵が、冷えていくの。<br>火の鳥の物語を、語ってあげなきゃ<br>いけないのに……。 | worried and close to tears, a young priestess who has failed her duty |
| `v_kaya_ash_02` | story | `caldera_kaya` first meeting page 3 | 去年、記録院の人に語ったら、<br>それきり……声に出そうとしても、<br>出てこないの。 | bewildered and afraid; the words have gone since she told them to the Archive |

## zakuro

| id | 種類 | 場面 | 台詞 | 演技 |
|---|---|---|---|---|
| `v_zakuro_ash_01` | story | `arena_zakuro` after the final page 2 | ……写す仕事は降りる。<br>後味が悪い。 | beaten, calm and blunt; decides to quit a job that tastes bad |
| `v_zakuro_ash_02` | story | `arena_zakuro` after the final: the letter | 人の手紙は読まねえ。<br>そういう決まりで生きてる。 | terse and matter-of-fact about his own rule; quietly proud |
