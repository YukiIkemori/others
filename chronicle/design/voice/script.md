# ルミナス・クロニクル　ボイス収録台本

`node tools/voice_script.js` が src/ の台詞（`ev.say(…, { voice: '<id>' })`）から作る表。手で直さない。

- 収録する台詞：**140 行**（18 人）、合計 3401 字、目安 約 9.8 分
- 収録済み：140 / 140
- 主人公（プレイヤーが名前を付ける・しゃべらない）と仲間 20 人は声なし。`{hero}` を含む台詞は収録しない。

## 納品の形
- ファイル名は **id そのまま**：`assets/voice/<id>.ogg`（`.m4a` `.mp3` `.wav` も可。同じ id が複数あれば ogg → m4a → mp3 → wav の順で 1 つ）。
- 1 行 = 1 ファイル。前後の無音は 0.1 秒以内に切る。モノラル、44.1/48 kHz。ピーク −3 dBFS、行どうしの音量をそろえる（目安 −18 LUFS）。
- 置いたら `node tools/build.js` で dist/index.html に入る（無い行は文字だけで進む）。台詞を送ると声は止まる。声のあいだ BGM は少し下がる。
- 「文字数」は読む字数（かっこを除く）、「秒」は目安。

## 話者ごとの量

| 話者 | 行 | 字 | 目安（秒） |
|---|---:|---:|---:|
| フィーネ（灰色のマントの少女） | 29 | 628 | 108 |
| ロウェル | 35 | 843 | 144 |
| ベルナ（師匠） | 16 | 447 | 73 |
| ラザロ（大書記） | 8 | 178 | 31 |
| 虚ろの王（ラスボス） | 6 | 119 | 21 |
| ネムレア（名を得た虚ろの王） | 2 | 31 | 7 |
| ノア | 7 | 226 | 38 |
| ヴァルザード（魔王の残影） | 3 | 57 | 11 |
| 森の主エルム | 6 | 167 | 28 |
| ハザル王（砂の王） | 4 | 71 | 14 |
| 氷の巨人 | 1 | 18 | 4 |
| 白竜ネーヴェ | 3 | 86 | 15 |
| メルダ（霧の館の魔女） | 6 | 193 | 31 |
| 霧食らい（魔女の姿） | 1 | 32 | 6 |
| マリナ | 4 | 54 | 11 |
| グレン船長 | 5 | 134 | 24 |
| 鉄の番人 | 3 | 85 | 14 |
| 天球の番人 | 1 | 32 | 6 |

## フィーネ（灰色のマントの少女）　`fine`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_fine_lighthouse_01` | lighthouse_3_fine (events/prologue_lighthouse.js:82) | 言葉を失った灯は、<br>言葉で取り戻すの。 | 18 | 3 | ✓ |
| `v_fine_lighthouse_02` | lighthouse_3_fine (events/prologue_lighthouse.js:83) | ……あなたなら、できるわ。 | 13 | 2.6 | ✓ |
| `v_fine_forest_01` | elder_tree_2_fine (events/region1_forest.js:281) | この根の奥に、伝承の核があるわ。<br>……根を食べているものがいる。 | 31 | 5.2 | ✓ |
| `v_fine_snow_01` | frost_peak_3_fine (events/region3_frost_peak.js:79) | 凍っているのは、竜の体じゃない。<br>心のほうよ。 | 22 | 3.8 | ✓ |
| `v_fine_marsh_01` | bell_marsh_1_fine (events/region4_dungeons.js:157) | 霧は形を持たないから、<br>誰の姿にでもなれるの。 | 22 | 3.6 | ✓ |
| `v_fine_isles_01` | fineFallback (events/region5_isles.js:303) | 待っている人がいる限り、<br>物語は終わらない。 | 21 | 3.4 | ✓ |
| `v_fine_ash_01` | ash_volcano_3_fine (events/region7_volcano.js:108) | 燃え尽きることと、<br>忘れられることは、違うわ。 | 22 | 3.6 | ✓ |
| `v_fine_t1_01` | t1 (events/story.js:66) | 一つ目……。<br>あと、七つね。 | 13 | 2.8 | ✓ |
| `v_fine_t1_02` | t1 (events/story.js:67) | わたし？　ただの、<br>通りすがりよ。 | 16 | 2.9 | ✓ |
| `v_fine_t3_01` | t3 (events/story.js:107) | 三つ目。よくやったわ。 | 11 | 2.3 | ✓ |
| `v_fine_t3_02` | t3 (events/story.js:108) | ……わたしはフィーネ。<br>名前くらいは、覚えておいて。 | 25 | 4.4 | ✓ |
| `v_fine_t6_01` | t6 (events/story.js:165) | 六つ目……。 | 6 | 1.7 | ✓ |
| `v_fine_t6_02` | t6 (events/story.js:167) | あなたの師匠は、もう……。 | 13 | 2.6 | ✓ |
| `v_fine_t8_01` | t8 (events/story.js:201) | 今なら話せるわ。わたしは<br>フィーネ。千年前、始まりの<br>年代記を書いた語り部。 | 36 | 5.9 | ✓ |
| `v_fine_t8_02` | t8 (events/story.js:202) | 世界がまだ白い闇だったころ、<br>わたしは最初の物語を語って、<br>その闇を眠らせた。 | 37 | 5.6 | ✓ |
| `v_fine_t8_03` | t8 (events/story.js:203) | 海の向こうでは、紋章が<br>魔王を封じたという。<br>この大陸では、物語が<br>封印になったの。 | 39 | 6.1 | ✓ |
| `v_fine_t8_04` | t8 (events/story.js:204) | その闇――虚ろの王が、<br>いま目を覚ましかけている。 | 24 | 4.1 | ✓ |
| `v_fine_t8_05` | t8 (events/story.js:205) | 八枚がそろった今なら、<br>内海の霧を払える。 | 20 | 3.3 | ✓ |
| `v_fine_t8_06` | t8 (events/story.js:206) | ロアの里へ。すべてが<br>始まった場所へ、帰りましょう。 | 25 | 4.2 | ✓ |
| `v_fine_roa_01` | story_final_roa (events/final_roa.js:70) | ベルナさん。<br>あなたの弟子の物語を、<br>聞いてくれる？ | 24 | 4.1 | ✓ |
| `v_fine_roa_02` | story_final_roa (events/final_roa.js:72) | ……いいの。わたしのことは、<br>いつか思い出してくれれば。 | 27 | 4.7 | ✓ |
| `v_fine_roa_03` | story_final_roa (events/final_roa.js:108) | ……先に、島で待っているわ。 | 14 | 2.7 | ✓ |
| `v_fine_shades_01` | archive_4_boss (events/final_archive.js:136) | 三百年前、東の大陸で魔王を<br>討った勇者たちの影……。 | 25 | 4.2 | ✓ |
| `v_fine_shades_02` | archive_4_boss (events/final_archive.js:137) | 名は忘れられても、物語は<br>残っていたのね。 | 20 | 3.3 | ✓ |
| `v_fine_naming_01` | naming (events/final_archive.js:250) | わたしの最後の光を、<br>あなたたちに。 | 17 | 2.9 | ✓ |
| `v_fine_ending_01` | voidHall (systems/ending.js:289) | わたしも、物語に還る時間。 | 13 | 2.4 | ✓ |
| `v_fine_ending_02` | voidHall (systems/ending.js:290) | ……語り継いでね。<br>わたしのことも、<br>あなたの旅のことも。 | 27 | 4.7 | ✓ |
| `v_fine_oblivion_01` | oblivion_5_ouroboros (events/oblivion.js:154) | ここは、終わらない物語が<br>沈む場所。 | 17 | 2.9 | ✓ |
| `v_fine_oblivion_02` | oblivion_5_ouroboros (events/oblivion.js:155) | その竜は物語の終わりを食べて、<br>同じ話を永遠にくり返させるの。 | 30 | 4.6 | ✓ |

## ロウェル　`rowell`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_rowell_prologue_01` | lute_rowell (events/prologue_lute.js:45) | ……語り部の見習いか。灯台の伝承なら、<br>きのう記録院が写し取った。 | 32 | 5.4 | ✓ |
| `v_rowell_prologue_02` | lute_rowell (events/prologue_lute.js:46) | 伝承は記録院が責任をもって保管する。<br>語り部の出る幕じゃない。 | 30 | 4.8 | ✓ |
| `v_rowell_t2_01` | t2 (events/story.js:77) | また会ったな、語り部。 | 11 | 2.1 | ✓ |
| `v_rowell_t2_02` | t2 (events/story.js:78) | 伝承を言いふらして回るのは、<br>もうやめろ。記録院が写して<br>保管すれば、それで十分だ。 | 40 | 6.2 | ✓ |
| `v_rowell_t2_03` | t2 (events/story.js:79) | 口で言っても分からない<br>なら、力ずくで止める。 | 22 | 3.6 | ✓ |
| `v_rowell_t2_04` | t2 (events/story.js:83) | ……くっ。その筆、<br>まぐれではないようだな。 | 21 | 3.9 | ✓ |
| `v_rowell_t2_05` | t2 (events/story.js:84) | 覚えておけ。伝承は、<br>人を縛る鎖にもなる。 | 20 | 3.5 | ✓ |
| `v_rowell_t2_06` | t2 (events/story.js:88) | 受け取っておけ。<br>借りを作るのは好かない。 | 20 | 3.5 | ✓ |
| `v_rowell_t2_07` | t2 (events/story.js:90) | これが力の差だ。<br>……頭を冷やせ、語り部。 | 20 | 3.7 | ✓ |
| `v_rowell_t4_01` | t4 (events/story.js:125) | ……また会ったな。<br>この前の借りは、まだ<br>返していないぞ。 | 27 | 4.7 | ✓ |
| `v_rowell_t4_02` | t4 (events/story.js:126) | ……聞いたか。<br>院長は本気だ。 | 14 | 2.9 | ✓ |
| `v_rowell_t4_03` | t4 (events/story.js:127) | 院長は、悲しみのない世界を<br>作ろうとしている。<br>おまえには分からないだろうが。 | 37 | 5.8 | ✓ |
| `v_rowell_t5_01` | t5 (events/story.js:138) | 今度は、まぐれとは言わせない。 | 15 | 2.6 | ✓ |
| `v_rowell_t5_02` | t5 (events/story.js:139) | なぜだ……。おまえが語り直した<br>伝承は、また人の口にのぼる。 | 29 | 5 | ✓ |
| `v_rowell_t5_03` | t5 (events/story.js:140) | それが争いの種になると、<br>なぜ分からない！ | 20 | 3.3 | ✓ |
| `v_rowell_t5_04` | t5 (events/story.js:144) | ……おれは……本当に、<br>正しいのか……。 | 19 | 3.9 | ✓ |
| `v_rowell_t5_05` | t5 (events/story.js:149) | ……勝ったのに、どうしてだ。<br>少しも、すっきりしない。 | 26 | 4.6 | ✓ |
| `v_rowell_t7_01` | t7 (events/story.js:180) | ……待ってくれ。話がある。 | 13 | 2.8 | ✓ |
| `v_rowell_t7_02` | t7 (events/story.js:181) | おまえに負けてから、ずっと<br>考えていた。……答えが出た。 | 27 | 4.7 | ✓ |
| `v_rowell_t7_03` | t7 (events/story.js:182) | 院長は、白の書に伝承を写すと、<br>その伝承が人の心から消えると<br>知っていた。 | 35 | 5.3 | ✓ |
| `v_rowell_t7_04` | t7 (events/story.js:183) | 知っていて、おれたちに<br>写させていたんだ。 | 20 | 3.3 | ✓ |
| `v_rowell_t7_05` | t7 (events/story.js:184) | おれは、自分の母の顔を<br>思い出せない。自分の日記を、<br>白の書に写したからだ。 | 36 | 5.7 | ✓ |
| `v_rowell_t7_06` | t7 (events/story.js:185) | これを持っていけ。大書庫の<br>封印の扉を開ける言葉が<br>書いてある。 | 30 | 4.8 | ✓ |
| `v_rowell_t7_07` | t7 (events/story.js:188) | おれは、もう記録院には<br>戻らない。 | 16 | 2.8 | ✓ |
| `v_rowell_roa_01` | story_final_roa (events/final_roa.js:90) | 島へは、ファロスの港から<br>船を出させる。……おれも行く。 | 27 | 4.7 | ✓ |
| `v_rowell_roa_02` | story_final_roa (events/final_roa.js:116) | おれは先に港へ行って、<br>船を用意させておく。<br>ファロスで会おう。 | 30 | 4.9 | ✓ |
| `v_rowell_biblia_01` | biblia_arrival (events/final_biblia.js:48) | ……ひどいな。町じゅうが、<br>白紙になりかけている。 | 24 | 4.3 | ✓ |
| `v_rowell_biblia_02` | biblia_arrival (events/final_biblia.js:57) | ノアさん。あんたは、<br>覚えているのか。 | 18 | 3.3 | ✓ |
| `v_rowell_biblia_03` | biblia_arrival (events/final_biblia.js:61) | 大書庫の中は、院長の書記たちで<br>いっぱいだ。3階の封印の扉は、<br>おれの手帳の言葉で開く。 | 42 | 6.5 | ✓ |
| `v_rowell_biblia_04` | biblia_arrival (events/final_biblia.js:62) | おれは、町の北の門で待つ。<br>支度ができたら、来てくれ。 | 26 | 4.3 | ✓ |
| `v_rowell_seal_01` | archive_3_rowell (events/final_archive.js:85) | 待たせたな。……ここが、<br>封印の扉だ。 | 18 | 3.5 | ✓ |
| `v_rowell_seal_02` | archive_3_rowell (events/final_archive.js:89) | 「白き書の扉よ、<br>名を持つ者のために開け」 | 18 | 2.8 | ✓ |
| `v_rowell_seal_03` | archive_3_rowell (events/final_archive.js:103) | 院長の書記たちか……。 | 11 | 2.3 | ✓ |
| `v_rowell_seal_04` | archive_3_rowell (events/final_archive.js:104) | ここは、おれが引き受ける。<br>行け、語り部！ | 20 | 3.5 | ✓ |
| `v_rowell_ending_01` | archiveGate (systems/ending.js:313) | 帰りましょう、院長。<br>……ミラさんの話を、<br>聞かせてください。 | 29 | 5 | ✓ |

## ベルナ（師匠）　`berna`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_berna_prologue_01` | roa_house_intro (events/prologue_roa.js:30) | おはよう。今日は大事な日だよ。 | 15 | 2.8 | ✓ |
| `v_berna_prologue_02` | roa_house_intro (events/prologue_roa.js:31) | 語り部の名簿に、<br>あなたのことを書いておかないとね。 | 25 | 4 | ✓ |
| `v_berna_prologue_03` | roa_house_intro (events/prologue_roa.js:32) | さあ、見習いさん。<br>あなたがどんな子だったか、<br>もう一度聞かせておくれ。 | 34 | 5.4 | ✓ |
| `v_berna_prologue_04` | roa_house_intro (events/prologue_roa.js:35) | 支度ができたら、<br>わたしの書見台までおいで。<br>話しておきたいことがあるんだ。 | 36 | 5.7 | ✓ |
| `v_berna_lute_01` | lute_departure (events/prologue_lute.js:148) | これは、あなたの年代記だよ。<br>語り部はみんな、自分の<br>年代記を持って旅に出るんだ。 | 39 | 6.1 | ✓ |
| `v_berna_lute_02` | lute_departure (events/prologue_lute.js:150) | それから、これもお持ち。<br>語り部の羽ペンと、<br>帰り道の鈴だよ。 | 29 | 4.7 | ✓ |
| `v_berna_lute_03` | lute_departure (events/prologue_lute.js:163) | この大陸には八つの大きな伝承がある。<br>その全部が、いま白紙になりかけている。 | 37 | 5.8 | ✓ |
| `v_berna_lute_04` | lute_departure (events/prologue_lute.js:164) | 全部を語り直して、<br>年代記を書き上げなさい。それが、<br>あなたの修業の仕上げだよ。 | 38 | 5.9 | ✓ |
| `v_berna_lute_05` | lute_departure (events/prologue_lute.js:170) | どこから回ってもいい。<br>あなたの足で、あなたの順番で<br>語り直していけばいいのさ。 | 38 | 5.9 | ✓ |
| `v_berna_roa_01` | story_final_roa (events/final_roa.js:71) | そちらのお嬢さんは……<br>どこかで……。 | 18 | 3.5 | ✓ |
| `v_berna_roa_02` | story_final_roa (events/final_roa.js:86) | おかえり。……よく、<br>ここまで書いたね。 | 19 | 3.6 | ✓ |
| `v_berna_roa_03` | story_final_roa (events/final_roa.js:89) | 始まりの年代記は、<br>ビブリアの大書庫の頂にある。<br>わたしの師匠が、<br>そう言っていた。 | 39 | 6.1 | ✓ |
| `v_berna_roa_04` | story_final_roa (events/final_roa.js:103) | これを持ってお行き。<br>わたしが若いころ、師匠から<br>もらった首飾りだよ。 | 33 | 5.3 | ✓ |
| `v_berna_ending_01` | roaTale (systems/ending.js:349) | これは、ある語り部の物語。 | 13 | 2.4 | ✓ |
| `v_berna_ending_02` | roaTale (systems/ending.js:359) | あるとも。三人の勇者が、<br>魔王を倒したお話がね。 | 23 | 3.9 | ✓ |
| `v_berna_ending_03` | someDaysLater (systems/ending.js:374) | それは、また別のお話。 | 11 | 2.1 | ✓ |

## ラザロ（大書記）　`lazaro`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_lazaro_archive_01` | archive_5_lazaro (events/final_archive.js:170) | よく来ましたね、語り部。 | 12 | 2.2 | ✓ |
| `v_lazaro_archive_02` | archive_5_lazaro (events/final_archive.js:171) | 二十年前、伝承戦争で<br>娘のミラを失いました。 | 21 | 3.4 | ✓ |
| `v_lazaro_archive_03` | archive_5_lazaro (events/final_archive.js:172) | どちらの伝承が正しいか……<br>そんなことのために。 | 23 | 3.9 | ✓ |
| `v_lazaro_archive_04` | archive_5_lazaro (events/final_archive.js:173) | 忘れてしまえば、争いも<br>悲しみも、初めから<br>無かったことになる。 | 30 | 4.7 | ✓ |
| `v_lazaro_archive_05` | archive_5_lazaro (events/final_archive.js:174) | それが救いなのですよ。<br>……それでも、あなたは<br>書くのですね。 | 29 | 5 | ✓ |
| `v_lazaro_archive_06` | archive_5_lazaro (events/final_archive.js:175) | ならば、その筆を<br>折らせていただきましょう。 | 21 | 3.4 | ✓ |
| `v_lazaro_archive_07` | archive_5_lazaro (events/final_archive.js:179) | ……なぜだ。忘れたはずの<br>あの子の笑顔が……<br>今になって……。 | 29 | 5.4 | ✓ |
| `v_lazaro_ending_01` | archiveGate (systems/ending.js:309) | ……ミラ。<br>ああ、ミラ……。 | 13 | 3.1 | ✓ |

## 虚ろの王（ラスボス）　`king`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_king_shades_01` | archive_4_boss (events/final_archive.js:124) | 海の向こうの、名を忘れられた<br>勇者たちよ……。 | 22 | 3.8 | ✓ |
| `v_king_archive_01` | archive_5_lazaro (events/final_archive.js:183) | よくやった、ラザロ。<br>おまえの悲しみは、じつに<br>美味であった。 | 29 | 4.7 | ✓ |
| `v_king_naming_01` | naming (events/final_archive.js:240) | 名を……呼んだな……！ | 11 | 2.6 | ✓ |
| `v_king_altar_01` | archive_6_boss (events/final_archive.js:270) | 名もなく、形もなく、<br>われはすべてを白紙に還す。 | 23 | 3.7 | ✓ |
| `v_king_altar_02` | archive_6_boss (events/final_archive.js:278) | 無駄だ。名なきものは、<br>消えぬ。 | 15 | 2.9 | ✓ |
| `v_king_altar_03` | archive_6_boss (events/final_archive.js:281) | また来たか……。<br>名なきものは、消えぬ。 | 19 | 3.6 | ✓ |

## ネムレア（名を得た虚ろの王）　`nemrea`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_nemrea_ending_01` | voidHall (systems/ending.js:270) | 名を……呼ばれたのは……<br>はじめてだ……。 | 20 | 4 | ✓ |
| `v_nemrea_ending_02` | voidHall (systems/ending.js:271) | ……ああ……<br>眠い……。 | 11 | 2.8 | ✓ |

## ノア　`noa`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_noa_biblia_01` | biblia_arrival (events/final_biblia.js:56) | あなたたち、この町の人じゃ<br>ないわね。……ロウェル？ | 25 | 4.4 | ✓ |
| `v_noa_biblia_02` | biblia_arrival (events/final_biblia.js:58) | ミラに教わった歌を、<br>毎晩歌っていたから……<br>わたしだけ、忘れずにいるの。 | 35 | 5.6 | ✓ |
| `v_noa_biblia_03` | biblia_arrival (events/final_biblia.js:59) | ここは記録院の町、ビブリア。<br>でも、みんな大事なことを<br>忘れてしまったの。 | 35 | 5.5 | ✓ |
| `v_noa_biblia_04` | biblia_arrival (events/final_biblia.js:60) | 院長さまのお嬢さん……<br>ミラは、わたしの友だちだった。<br>二十年前の戦争で……。 | 37 | 6.3 | ✓ |
| `v_noa_biblia_05` | biblia_noa (events/final_biblia.js:111) | 院長さまに……会ったの？<br>……そう。ミラのことを、<br>思い出してくれたのね。 | 35 | 6.2 | ✓ |
| `v_noa_biblia_06` | biblia_noa (events/final_biblia.js:113) | ミラはね、歌が好きな子だった。<br>「名前は、呼ばれるために<br>あるのよ」って、よく言ってたわ。 | 41 | 6.4 | ✓ |
| `v_noa_ending_01` | bibliaMorning (systems/ending.js:333) | ミラ。あなたの歌、<br>みんなに届いたよ。 | 18 | 3.3 | ✓ |

## ヴァルザード（魔王の残影）　`valzard`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_valzard_oblivion_01` | oblivion_3_echo (events/oblivion.js:85) | ……ヴァルザード……<br>それが、われの名であったか。 | 24 | 4.3 | ✓ |
| `v_valzard_oblivion_02` | oblivion_3_echo (events/oblivion.js:86) | 三百年……忘れられてなお、<br>恐れだけが残った……。 | 24 | 4.3 | ✓ |
| `v_valzard_oblivion_03` | oblivion_3_echo (events/oblivion.js:93) | 光の……紋章……。 | 9 | 2.3 | ✓ |

## 森の主エルム　`elm`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_elm_forest_01` | elder_tree_2_boss (events/region1_forest.js:340) | ……思い出した。わたしは、<br>この森を守ると誓ったのだった。 | 28 | 4.8 | ✓ |
| `v_elm_forest_02` | elder_tree_2_boss (events/region1_forest.js:341) | 千年前の火の夜……。<br>燃える森を前に、わたしは<br>この木に宿り、火を封じた。 | 35 | 5.8 | ✓ |
| `v_elm_forest_03` | elder_tree_2_boss (events/region1_forest.js:342) | 村の者たちは、歌で<br>わたしの眠りを守ると<br>約束してくれた。 | 27 | 4.2 | ✓ |
| `v_elm_forest_04` | elder_tree_2_boss (events/region1_forest.js:343) | 歌が絶えて、わたしは約束を<br>忘れた。森を閉ざし、<br>人を迷わせてしまった……。 | 36 | 5.9 | ✓ |
| `v_elm_forest_05` | elder_tree_2_boss (events/region1_forest.js:344) | 語り部よ、礼を言う。 | 10 | 2 | ✓ |
| `v_elm_forest_06` | elder_tree_2_boss (events/region1_forest.js:345) | 森の道は、もう閉ざさぬ。<br>木こりたちも、じきに<br>村へ帰れるだろう。 | 31 | 5 | ✓ |

## ハザル王（砂の王）　`hazal`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_hazal_tomb_01` | sand_tomb_3_boss (events/region2_tomb.js:143) | ……わが名を……<br>わが名を、返せ……！ | 18 | 3.7 | ✓ |
| `v_hazal_tomb_02` | sand_tomb_3_boss (events/region2_tomb.js:153) | ……わが名を……だれか……。 | 14 | 3.2 | ✓ |
| `v_hazal_tomb_03` | sand_tomb_3_boss (events/region2_tomb.js:161) | ハザル……そうだ、<br>それがわたしの名だ。 | 19 | 3.4 | ✓ |
| `v_hazal_tomb_04` | sand_tomb_3_boss (events/region2_tomb.js:162) | 民は、約束を覚えていて<br>くれたのだな……。 | 20 | 3.5 | ✓ |

## 氷の巨人　`giant`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_giant_peak_01` | frost_peak_2_boss (events/region3_frost_peak.js:51) | ……ここより上へは、<br>誰も通さぬ……。 | 18 | 3.5 | ✓ |

## 白竜ネーヴェ　`neve`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_neve_peak_01` | frost_peak_3_boss (events/region3_frost_peak.js:106) | ……去れ……人の子よ……。<br>この峰に、もはや<br>語るべき物語はない……！ | 33 | 6.2 | ✓ |
| `v_neve_peak_02` | frost_peak_3_boss (events/region3_frost_peak.js:121) | ……あたたかい。人の子らは、<br>わたしを忘れてはいなかったのか。 | 30 | 5.1 | ✓ |
| `v_neve_peak_03` | frost_peak_3_boss (events/region3_frost_peak.js:122) | 吹雪は、わたしが鎮めよう。語り部よ、<br>礼を言う。 | 23 | 3.9 | ✓ |

## メルダ（霧の館の魔女）　`melda`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_melda_manor_01` | mist_manor_2_melda (events/region4_dungeons.js:82) | ……驚かせてしまったわね。<br>わたしはメルダ。<br>この館の、昔の主よ。 | 31 | 5.4 | ✓ |
| `v_melda_manor_02` | mist_manor_2_melda (events/region4_dungeons.js:83) | わたしは子どもたちをさらってなどいない。<br>霧が、わたしの姿をまねているの。 | 36 | 5.7 | ✓ |
| `v_melda_manor_03` | mist_manor_2_melda (events/region4_dungeons.js:84) | 昔、沼の霧から魔物が<br>あふれたとき、わたしは<br>七つの鐘を沈めて、<br>鐘の音で霧を封じたの。 | 41 | 6.1 | ✓ |
| `v_melda_manor_04` | mist_manor_2_melda (events/region4_dungeons.js:85) | でも、町の人たちが<br>鐘の歌を忘れて、<br>鐘は鳴らなくなった……。 | 29 | 4.8 | ✓ |
| `v_melda_manor_05` | mist_manor_2_melda (events/region4_dungeons.js:86) | 沼の鐘を鳴らして。これは鐘の鍵。そして、<br>これが鐘の歌よ。 | 28 | 4.8 | ✓ |
| `v_melda_marsh_01` | bell_marsh_1_boss (events/region4_dungeons.js:208) | ありがとう、語り部さん。これでまた、<br>町の朝に鐘が鳴るわ。 | 28 | 4.6 | ✓ |

## 霧食らい（魔女の姿）　`mistwitch`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_mistwitch_marsh_01` | bell_marsh_1_boss (events/region4_dungeons.js:187) | ……オイデ……コドモタチ……<br>ワスレラレタ……<br>カネノ……ウタ……。 | 32 | 6.3 | ✓ |

## マリナ　`marina`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_marina_nerei_01` | nerei_marina_song (events/region5_isles.js:138) | ……ああ、この歌だよ。 | 11 | 2.3 | ✓ |
| `v_marina_pier_01` | nerei_marina_song (events/region5_isles.js:171) | あの人の船だ……。 | 9 | 2.1 | ✓ |
| `v_marina_dawn_01` | ghost_ship_3_boss (events/region5_isles.js:369) | おかえりなさい、グレン。 | 12 | 2.2 | ✓ |
| `v_marina_dawn_02` | ghost_ship_3_boss (events/region5_isles.js:386) | ……ありがとう。<br>あの人は、やっと帰ってきた。 | 22 | 4 | ✓ |

## グレン船長　`glen`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_glen_ship_01` | ghost_ship_3_boss (events/region5_isles.js:332) | ♪　霧の海でも……迷い……<br>……続きが、出てこない……。 | 27 | 4.9 | ✓ |
| `v_glen_ship_02` | ghost_ship_3_boss (events/region5_isles.js:333) | おれは……どこへ帰るんだった？<br>誰が、待っていた……？<br>思い出せない……思い出せない！ | 41 | 7.2 | ✓ |
| `v_glen_ship_03` | ghost_ship_3_boss (events/region5_isles.js:351) | ……マリナ。そうだ、<br>おれは帰ると約束したんだ。 | 23 | 4.2 | ✓ |
| `v_glen_ship_04` | ghost_ship_3_boss (events/region5_isles.js:352) | 岬の灯は、あいつだったのか。<br>六十年も、待たせちまったな。<br>……帰ろう。 | 34 | 5.9 | ✓ |
| `v_glen_dawn_01` | ghost_ship_3_boss (events/region5_isles.js:371) | ただいま、マリナ。 | 9 | 1.8 | ✓ |

## 鉄の番人　`guardian`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_guardian_mine_01` | deep_mine_3_boss (events/region6_mine.js:177) | ……誓いを忘れた者よ。<br>七の層より下を掘った者よ。 | 24 | 4.3 | ✓ |
| `v_guardian_mine_02` | deep_mine_3_boss (events/region6_mine.js:178) | 鍛冶神との約束により、<br>われは、この山を守る。<br>去らぬなら、打ち砕くのみ。 | 35 | 5.6 | ✓ |
| `v_guardian_mine_03` | deep_mine_3_boss (events/region6_mine.js:190) | ……誓いは、まだ生きていたか。ならば、<br>われは眠ろう。 | 26 | 4.6 | ✓ |

## 天球の番人　`sentinel`

| id | 場面 | 台詞 | 字 | 秒 | 済 |
|---|---|---|---:|---:|:-:|
| `v_sentinel_star_01` | stargaze_3_boss (events/region8_star.js:152) | ……タチイリ、キンシ。<br>ホシノナヲ、モタヌモノハ、<br>トオサナイ……。 | 32 | 5.6 | ✓ |
