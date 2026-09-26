# ルミナス・クロニクル　戦闘ボイス台本（仲間 20 人＋主人公）

BRIEF A36 / A37。物語に絡まない短い戦闘用の台詞だけ。仲間の個別の話は作らない。正は `design/voice/battle_lines.csv`（このファイルは `node tools/battle_voice.js` が作る。手で直さない）。

- 仲間 20 人 × 10 本 = **200 本**＋主人公 男女 × 14 本
- 種類: 通常攻撃 3（短い掛け声・6 字以内）／大技・閃き 2（個性のある一言・20 字以内）／術 1／被弾 2／戦闘不能 1／勝利 1
- ファイル: `assets/voice/b_<仲間id>_<種類>_<n>.ogg`（主人公は `v_hero_<m|f>_<種類>_<n>.ogg`）。鳴らし方は design/notes/audio.md §13.2。
- 声: Gemini TTS の既製の声（物語の登場人物・主人公の声とは重ねない）。作り直し: `node tools/voice_tts.js --battle --only <id> --force`

## 配役

| 仲間 | 性別・年齢 | 肩書 | 声 | 演出 |
|---|---|---|---|---|
| セルマ `selma` | 女 20 | 元衛兵 | `ja-jp-training-6` | 凛々しく、まっすぐに |
| ハーゲン `hagen` | 男 38 | 傭兵 | `ja-jp-csagent-9` | 低く太く、豪快に |
| ドッカ `dokka` | 男 52 | 山の鍛冶屋 | `ja-jp-techagent-2` | 野太く、職人気質で豪快に |
| バジル `basil` | 男 44 | 修道士 | `ja-jp-techagent-4` | 穏やかで厚みのある声、丁寧に |
| バルトロ `bartolo` | 男 63 | 老騎士 | `ja-jp-training-4` | 老練に、しゃがれ気味で威厳 |
| ヴィオラ `viola` | 女 24 | 没落貴族 | `ja-jp-commercial-6` | 上品に、気位高く |
| シグレ `shigure` | 男 31 | 刀使い | `ja-jp-tutor-2` | 低く静かに、ぼそっと |
| ロウガ `rouga` | 男 26 | 拳法家 | `ja-jp-commercial-4` | 熱く元気に |
| ティッタ `titta` | 女 16 | 下町の子 | `ja-jp-assistant-7` | 生意気に、すばしこく |
| ブリギッタ `brigitta` | 女 23 | 国境の兵 | `ja-jp-concierge-7` | 落ち着いて頼もしく、きびきび |
| シルヴァン `sylvain` | 男 119 | 森の狩人 | `ja-jp-storyteller-12` | 静かで澄んだ、浮世離れ |
| ザフィラ `zafira` | 女 22 | 踊り子 | `ja-jp-commercial-1` | 艶っぽく、楽しげに |
| フェルノ `ferno` | 男 33 | 吟遊詩人 | `ja-jp-concierge-4` | 芝居がかって朗々と |
| ベラドナ `belladonna` | 女 36 | 薬売り | `ja-jp-advisor-2` | ハスキーに、したたかに余裕 |
| ボーデン `boden` | 男 61 | 鉱山技師 | `ja-jp-podcaster-7` | 年配で元気、自慢好き |
| テオ `teo` | 男 15 | 見習い術師 | `ja-jp-tutor-11`（ピッチ ×1.06） | 少年らしく、得意げに |
| イルゼ `ilse` | 女 29 | 星読み | `ja-jp-storyteller-1` | ふんわり夢見がち、少し眠たげ |
| モルガ `morga` | 女 47 | 墓守 | `ja-jp-techagent-9` | 妖しく低く、含み笑い |
| マルタ `marta` | 女 34 | 町医者 | `ja-jp-advisor-7` | きびきび頼もしく、少し厳しめ |
| ノエラ `noela` | 女 18 | 見習い巫女 | `ja-jp-commercial-3` | 素直で一生懸命、少しあわてんぼう |

## セルマ（元衛兵）

声 `ja-jp-training-6` — 凛々しく、まっすぐに

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_selma_attack_1` | 通常攻撃 | はっ！ | crisp sharp breath-shout on a straight sword thrust |
| `b_selma_attack_2` | 通常攻撃 | せやっ！ | firm disciplined strike cry |
| `b_selma_attack_3` | 通常攻撃 | 通さない！ | stepping forward to block the way, resolute |
| `b_selma_bigtech_1` | 大技・閃き | この剣、曲げはしない！ | proud and upright, full of conviction, ringing |
| `b_selma_bigtech_2` | 大技・閃き | 正面から、断つ！ | steady focus then a decisive cut, strong |
| `b_selma_spell_1` | 術 | 力を貸して！ | calling on magic, earnest and clear |
| `b_selma_hurt_1` | 被弾 | くっ！ | short clenched grunt of pain |
| `b_selma_hurt_2` | 被弾 | まだっ……！ | hurt but refusing to give ground, strained |
| `b_selma_ko_1` | 戦闘不能 | ごめん……持ち場を…… | collapsing, weak and regretful, fading |
| `b_selma_victory_1` | 勝利 | 異常なし。先へ進みましょう。 | brisk report like a guard, a small satisfied smile |

## ハーゲン（傭兵）

声 `ja-jp-csagent-9` — 低く太く、豪快に

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_hagen_attack_1` | 通常攻撃 | おらぁ！ | rough heavy swing, gruff shout |
| `b_hagen_attack_2` | 通常攻撃 | ふんっ！ | short heavy grunt with a big blow |
| `b_hagen_attack_3` | 通常攻撃 | どけぇ！ | bellowing, barging through |
| `b_hagen_bigtech_1` | 大技・閃き | 割増料金だ、受け取れ！ | wry grin, then a full-power swing, booming |
| `b_hagen_bigtech_2` | 大技・閃き | まとめて片づける！ | confident veteran, heavy and loud |
| `b_hagen_spell_1` | 術 | 柄じゃねえがな！ | awkward about magic, gruff and a little embarrassed |
| `b_hagen_hurt_1` | 被弾 | ぐおっ！ | deep pained grunt |
| `b_hagen_hurt_2` | 被弾 | ちっ……！ | annoyed click of the tongue, hurt |
| `b_hagen_ko_1` | 戦闘不能 | 割に……合わねえ…… | collapsing, bitter wry mutter, fading |
| `b_hagen_victory_1` | 勝利 | さて、取り分の話をしようか。 | relaxed, smug, rubbing his hands about the pay |

## ドッカ（山の鍛冶屋）

声 `ja-jp-techagent-2` — 野太く、職人気質で豪快に

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_dokka_attack_1` | 通常攻撃 | ぬんっ！ | stocky old dwarf-like smith, heavy grunt |
| `b_dokka_attack_2` | 通常攻撃 | そりゃあ！ | hearty swing, loud |
| `b_dokka_attack_3` | 通常攻撃 | 砕けい！ | old-fashioned command, crushing blow |
| `b_dokka_bigtech_1` | 大技・閃き | 鉄より硬いか、試してやる！ | gruff challenge with relish, loud |
| `b_dokka_bigtech_2` | 大技・閃き | 岩をも割る一撃じゃ！ | proud craftsman's boast, booming |
| `b_dokka_spell_1` | 術 | 大地よ、応えい！ | rumbling old-fashioned call to the earth |
| `b_dokka_hurt_1` | 被弾 | ぬうっ！ | stubborn low grunt |
| `b_dokka_hurt_2` | 被弾 | なんの！ | brushing off the hit, tough |
| `b_dokka_ko_1` | 戦闘不能 | 無念……じゃ…… | collapsing, heavy regret, fading |
| `b_dokka_victory_1` | 勝利 | ふむ、いい汗をかいたわい。 | satisfied old smith, chuckling |

## バジル（修道士）

声 `ja-jp-techagent-4` — 穏やかで厚みのある声、丁寧に

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_basil_attack_1` | 通常攻撃 | えいっ！ | big gentle monk, earnest strike |
| `b_basil_attack_2` | 通常攻撃 | はあっ！ | deep powerful exhale with a blow |
| `b_basil_attack_3` | 通常攻撃 | 参ります！ | polite, then firm as he strikes |
| `b_basil_bigtech_1` | 大技・閃き | 神よ、お許しを！ | apologetic to his god, then a mighty blow |
| `b_basil_bigtech_2` | 大技・閃き | 祈りと共に、参ります！ | calm solemn resolve, rising to full power |
| `b_basil_spell_1` | 術 | 慈しみの光を！ | warm devout prayer, clear |
| `b_basil_hurt_1` | 被弾 | うぐっ！ | deep grunt of pain |
| `b_basil_hurt_2` | 被弾 | 耐えます……！ | enduring, polite even in pain |
| `b_basil_ko_1` | 戦闘不能 | 神よ……皆を…… | falling, a faint prayer for the others |
| `b_basil_victory_1` | 勝利 | 皆さん、お怪我はありませんか。 | kind, caring, relieved |

## バルトロ（老騎士）

声 `ja-jp-training-4` — 老練に、しゃがれ気味で威厳

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_bartolo_attack_1` | 通常攻撃 | 甘いわ！ | old knight, scornful and sharp |
| `b_bartolo_attack_2` | 通常攻撃 | そこじゃ！ | experienced eye, precise thrust |
| `b_bartolo_attack_3` | 通常攻撃 | せいやっ！ | old-school battle cry, vigorous |
| `b_bartolo_bigtech_1` | 大技・閃き | 若造には、まだ負けんぞ！ | proud veteran, spirited and loud |
| `b_bartolo_bigtech_2` | 大技・閃き | 老骨の意地、見せてくれよう！ | dignified old knight, grand and resolute |
| `b_bartolo_spell_1` | 術 | 古き誓いにかけて！ | knightly solemn oath |
| `b_bartolo_hurt_1` | 被弾 | ぐぬっ！ | old man's grunt of pain |
| `b_bartolo_hurt_2` | 被弾 | 腰が……っ！ | comic pained groan, his back hurts |
| `b_bartolo_ko_1` | 戦闘不能 | ここらが……潮時か…… | collapsing, calm wistful acceptance |
| `b_bartolo_victory_1` | 勝利 | うむ。……少し、腰に響いたわい。 | satisfied nod, then a wry groan about his back |

## ヴィオラ（没落貴族）

声 `ja-jp-commercial-6` — 上品に、気位高く

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_viola_attack_1` | 通常攻撃 | やあっ！ | elegant fencer, crisp high cry |
| `b_viola_attack_2` | 通常攻撃 | 下がりなさい！ | haughty noble command |
| `b_viola_attack_3` | 通常攻撃 | 優雅に！ | light and graceful, confident |
| `b_viola_bigtech_1` | 大技・閃き | 炎よ、風よ、舞いなさい！ | noble lady commanding flame and wind, grand |
| `b_viola_bigtech_2` | 大技・閃き | とくとご覧なさい！ | proud, showing off, dazzling |
| `b_viola_spell_1` | 術 | 風よ、従いなさい！ | aristocratic command, cool |
| `b_viola_hurt_1` | 被弾 | きゃっ！ | short sharp startled cry |
| `b_viola_hurt_2` | 被弾 | 無礼者っ！ | indignant, offended by the hit |
| `b_viola_ko_1` | 戦闘不能 | こんな……無様な…… | collapsing, wounded pride, fading |
| `b_viola_victory_1` | 勝利 | 当然ね。服は……無事かしら。 | haughty, then checking her clothes with worry |

## シグレ（刀使い）

声 `ja-jp-tutor-2` — 低く静かに、ぼそっと

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_shigure_attack_1` | 通常攻撃 | ふっ！ | quiet swordsman, sharp short exhale |
| `b_shigure_attack_2` | 通常攻撃 | 遅い。 | cool, low, almost bored |
| `b_shigure_attack_3` | 通常攻撃 | ……そこ。 | calm, low, precise |
| `b_shigure_bigtech_1` | 大技・閃き | ……雨の音が、聞こえる。 | deep calm focus, quiet and low, then stillness |
| `b_shigure_bigtech_2` | 大技・閃き | 一太刀で、足りる。 | cold certainty, low and steady |
| `b_shigure_spell_1` | 術 | 散れ。 | short low command |
| `b_shigure_hurt_1` | 被弾 | ……ぬかった。 | low self-reproach, restrained pain |
| `b_shigure_hurt_2` | 被弾 | 浅い。 | unshaken, dismissing the wound |
| `b_shigure_ko_1` | 戦闘不能 | 不覚…… | collapsing, a single low word |
| `b_shigure_victory_1` | 勝利 | ……他愛ない。 | quiet, sheathing his blade, cool |

## ロウガ（拳法家）

声 `ja-jp-commercial-4` — 熱く元気に

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_rouga_attack_1` | 通常攻撃 | おりゃあ！ | hot-blooded martial artist, energetic |
| `b_rouga_attack_2` | 通常攻撃 | せいっ！ | sharp punch kiai |
| `b_rouga_attack_3` | 通常攻撃 | でりゃっ！ | fast combo shout |
| `b_rouga_bigtech_1` | 大技・閃き | 燃えてきたぜ！ | fired up, thrilled, loud |
| `b_rouga_bigtech_2` | 大技・閃き | この一撃に、全部のせる！ | all-out, passionate, powerful |
| `b_rouga_spell_1` | 術 | 気合いだぁっ！ | forcing magic out with sheer spirit |
| `b_rouga_hurt_1` | 被弾 | ぐはっ！ | winded grunt |
| `b_rouga_hurt_2` | 被弾 | 効かねえ！ | grinning through the pain, defiant |
| `b_rouga_ko_1` | 戦闘不能 | まだ……やれる……のに…… | collapsing, frustrated, fading |
| `b_rouga_victory_1` | 勝利 | よっしゃあ！次はもっと強いやつだ！ | excited, pumped, eager |

## ティッタ（下町の子）

声 `ja-jp-assistant-7` — 生意気に、すばしこく

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_titta_attack_1` | 通常攻撃 | もらいっ！ | cheeky street kid, quick and playful |
| `b_titta_attack_2` | 通常攻撃 | すきあり！ | nimble, teasing |
| `b_titta_attack_3` | 通常攻撃 | ていっ！ | light quick stab |
| `b_titta_bigtech_1` | 大技・閃き | 見えてるよ、そのすき！ | sly grin, confident, quick |
| `b_titta_bigtech_2` | 大技・閃き | ちょろいちょろい！ | cocky and playful |
| `b_titta_spell_1` | 術 | えーい、なんとかなれ！ | not good at magic, trying anyway, energetic |
| `b_titta_hurt_1` | 被弾 | いったぁ！ | young girl's pained yelp |
| `b_titta_hurt_2` | 被弾 | うわっ！ | startled cry |
| `b_titta_ko_1` | 戦闘不能 | ずるいよ……もう…… | collapsing, sulky and weak |
| `b_titta_victory_1` | 勝利 | やった！戦利品、戦利品っと！ | gleeful, bouncing, greedy for loot |

## ブリギッタ（国境の兵）

声 `ja-jp-concierge-7` — 落ち着いて頼もしく、きびきび

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_brigitta_attack_1` | 通常攻撃 | たあっ！ | disciplined soldier, clean shout |
| `b_brigitta_attack_2` | 通常攻撃 | 仕留める！ | focused, calm determination |
| `b_brigitta_attack_3` | 通常攻撃 | 狙い通り！ | cool satisfaction on a precise hit |
| `b_brigitta_bigtech_1` | 大技・閃き | 一点、貫く！ | steady aim, then a powerful thrust |
| `b_brigitta_bigtech_2` | 大技・閃き | 動かないで。……今！ | quiet aiming, then a sharp release |
| `b_brigitta_spell_1` | 術 | 願いを、力に！ | earnest, steady |
| `b_brigitta_hurt_1` | 被弾 | くうっ！ | short restrained cry |
| `b_brigitta_hurt_2` | 被弾 | まだ立てる！ | tough, reassuring the others |
| `b_brigitta_ko_1` | 戦闘不能 | 持ちこたえ……られない…… | collapsing, apologetic, fading |
| `b_brigitta_victory_1` | 勝利 | 周囲、よし。……甘い物、食べたいな。 | crisp soldier's report, then a soft girlish wish |

## シルヴァン（森の狩人）

声 `ja-jp-storyteller-12` — 静かで澄んだ、浮世離れ

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_sylvain_attack_1` | 通常攻撃 | 射抜く。 | ageless forest archer, calm and clear |
| `b_sylvain_attack_2` | 通常攻撃 | 風を読む。 | quiet, measured |
| `b_sylvain_attack_3` | 通常攻撃 | ……ここだ。 | soft, precise |
| `b_sylvain_bigtech_1` | 大技・閃き | 百年の弓、受けてみよ。 | serene pride, calm authority |
| `b_sylvain_bigtech_2` | 大技・閃き | 森の風よ、矢に宿れ。 | gentle incantation, clear and airy |
| `b_sylvain_spell_1` | 術 | 森よ、目覚めよ。 | calm, resonant |
| `b_sylvain_hurt_1` | 被弾 | む……っ | restrained soft grunt |
| `b_sylvain_hurt_2` | 被弾 | 少し、効いた。 | calm understatement |
| `b_sylvain_ko_1` | 戦闘不能 | 森へ……還る……のか…… | collapsing, quiet wonder, fading |
| `b_sylvain_victory_1` | 勝利 | 静かになったな。……やはり、この方がいい。 | peaceful, relieved at the quiet |

## ザフィラ（踊り子）

声 `ja-jp-commercial-1` — 艶っぽく、楽しげに

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_zafira_attack_1` | 通常攻撃 | はいっ！ | dancer, light rhythmic cry |
| `b_zafira_attack_2` | 通常攻撃 | ステップ！ | playful, on the beat |
| `b_zafira_attack_3` | 通常攻撃 | ほらほらっ！ | teasing, spinning |
| `b_zafira_bigtech_1` | 大技・閃き | さあ、踊りましょ！ | alluring, playful invitation, lively |
| `b_zafira_bigtech_2` | 大技・閃き | 見とれてる場合？ | teasing smirk, confident |
| `b_zafira_spell_1` | 術 | 舞えば、届くわ！ | graceful, singing tone |
| `b_zafira_hurt_1` | 被弾 | 痛っ！ | short sharp yelp |
| `b_zafira_hurt_2` | 被弾 | もうっ！ | annoyed pout |
| `b_zafira_ko_1` | 戦闘不能 | 最後まで……踊りたかった…… | collapsing, wistful, fading |
| `b_zafira_victory_1` | 勝利 | 拍手はいらないわ。光る物なら歓迎よ。 | playful bow, cheeky smile |

## フェルノ（吟遊詩人）

声 `ja-jp-concierge-4` — 芝居がかって朗々と

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_ferno_attack_1` | 通常攻撃 | それっ！ | light-hearted bard, airy |
| `b_ferno_attack_2` | 通常攻撃 | ほいっと！ | casual, playful |
| `b_ferno_attack_3` | 通常攻撃 | 一曲いこう！ | cheerful, theatrical |
| `b_ferno_bigtech_1` | 大技・閃き | 英雄譚の一節を、君に！ | theatrical, grand declamation |
| `b_ferno_bigtech_2` | 大技・閃き | 旋律よ、矢となれ！ | lyrical, rising |
| `b_ferno_spell_1` | 術 | 古き歌よ、響け！ | sonorous, melodic |
| `b_ferno_hurt_1` | 被弾 | おっと！ | surprised, light |
| `b_ferno_hurt_2` | 被弾 | 痛いなあ！ | complaining playfully |
| `b_ferno_ko_1` | 戦闘不能 | 歌の……続きは…… | collapsing, wistful, fading |
| `b_ferno_victory_1` | 勝利 | いい戦いだった。一曲書けそうだ。 | pleased, inspired, warm |

## ベラドナ（薬売り）

声 `ja-jp-advisor-2` — ハスキーに、したたかに余裕

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_belladonna_attack_1` | 通常攻撃 | そらっ！ | sly peddler woman, quick |
| `b_belladonna_attack_2` | 通常攻撃 | 効くわよ！ | knowing smirk |
| `b_belladonna_attack_3` | 通常攻撃 | ちくっとね！ | teasing, amused |
| `b_belladonna_bigtech_1` | 大技・閃き | 特製の一服、お代は結構！ | shrewd merchant's grin, confident |
| `b_belladonna_bigtech_2` | 大技・閃き | 毒も薬も、使いよう！ | sly, knowing |
| `b_belladonna_spell_1` | 術 | よく効く一滴を！ | practical, confident |
| `b_belladonna_hurt_1` | 被弾 | いたっ！ | short pained yelp |
| `b_belladonna_hurt_2` | 被弾 | 高くつくわよ！ | annoyed, threatening payback |
| `b_belladonna_ko_1` | 戦闘不能 | 薬……もう一本…… | collapsing, reaching for a potion, fading |
| `b_belladonna_victory_1` | 勝利 | 毎度あり。……なんてね。 | merchant's thanks, then a playful laugh |

## ボーデン（鉱山技師）

声 `ja-jp-podcaster-7` — 年配で元気、自慢好き

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_boden_attack_1` | 通常攻撃 | ほれっ！ | spry old miner, brisk |
| `b_boden_attack_2` | 通常攻撃 | どっこい！ | old man's heave |
| `b_boden_attack_3` | 通常攻撃 | 掘るぞ！ | gleeful, like swinging a pick |
| `b_boden_bigtech_1` | 大技・閃き | 四十年の腕、見せてやる！ | proud old craftsman, loud |
| `b_boden_bigtech_2` | 大技・閃き | 若い頃なら、もっといけた！ | boastful old man, cheerful |
| `b_boden_spell_1` | 術 | 岩よ、砕けろ！ | gruff old-man command |
| `b_boden_hurt_1` | 被弾 | おうっ！ | old man's grunt |
| `b_boden_hurt_2` | 被弾 | あいたた…… | old man's groan |
| `b_boden_ko_1` | 戦闘不能 | 落盤……か…… | collapsing, confused, fading |
| `b_boden_victory_1` | 勝利 | どうじゃ、まだまだ現役じゃろ！ | proud and cheerful old man |

## テオ（見習い術師）

声 `ja-jp-tutor-11` — 少年らしく、得意げに

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_teo_attack_1` | 通常攻撃 | とりゃっ！ | cocky young boy, energetic |
| `b_teo_attack_2` | 通常攻撃 | 当たれ！ | eager boy |
| `b_teo_attack_3` | 通常攻撃 | いっけー！ | excited boy |
| `b_teo_bigtech_1` | 大技・閃き | 見たか、天才の実力！ | boastful young boy, very excited |
| `b_teo_bigtech_2` | 大技・閃き | 教科書どおり、完璧！ | smug, proud little genius |
| `b_teo_spell_1` | 術 | 燃えちゃえ！ | excited boy casting fire |
| `b_teo_hurt_1` | 被弾 | いてっ！ | boy's yelp |
| `b_teo_hurt_2` | 被弾 | うわあっ！ | boy's startled cry |
| `b_teo_ko_1` | 戦闘不能 | こんなの……習って……ない…… | collapsing, whining, fading |
| `b_teo_victory_1` | 勝利 | ふふん、ぼくが天才でよかったね！ | smug little boy, cheerful |

## イルゼ（星読み）

声 `ja-jp-storyteller-1` — ふんわり夢見がち、少し眠たげ

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_ilse_attack_1` | 通常攻撃 | やっ。 | dreamy stargazer, soft cry |
| `b_ilse_attack_2` | 通常攻撃 | 当たって。 | gentle, hopeful |
| `b_ilse_attack_3` | 通常攻撃 | そこ、かな。 | airy, slightly unsure |
| `b_ilse_bigtech_1` | 大技・閃き | 星の巡りは、こちらに味方。 | mysterious calm smile |
| `b_ilse_bigtech_2` | 大技・閃き | 今夜の星なら……いける。 | dreamy, then quietly sure |
| `b_ilse_spell_1` | 術 | 星よ、導いて。 | soft, reverent |
| `b_ilse_hurt_1` | 被弾 | ひゃっ！ | startled little cry |
| `b_ilse_hurt_2` | 被弾 | うう…… | soft whimper |
| `b_ilse_ko_1` | 戦闘不能 | まだ……夜は……明けないのに…… | collapsing, sleepy and fading |
| `b_ilse_victory_1` | 勝利 | 吉と出たわね。……ふわぁ、眠い。 | pleased, then a sleepy yawn |

## モルガ（墓守）

声 `ja-jp-techagent-9` — 妖しく低く、含み笑い

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_morga_attack_1` | 通常攻撃 | ふふっ。 | eerie graveyard witch, amused low chuckle |
| `b_morga_attack_2` | 通常攻撃 | お眠り。 | soft, eerie, low |
| `b_morga_attack_3` | 通常攻撃 | 奪うわよ。 | calm, sinister smile |
| `b_morga_bigtech_1` | 大技・閃き | その力、少しいただくわ。 | silky, amused, eerie |
| `b_morga_bigtech_2` | 大技・閃き | 闇は、優しいのよ？ | soft, teasing, slightly creepy |
| `b_morga_spell_1` | 術 | 暗き影よ、おいで。 | low incantation, eerie |
| `b_morga_hurt_1` | 被弾 | あら、痛い。 | unbothered, dry |
| `b_morga_hurt_2` | 被弾 | ……やるわね。 | low, amused respect |
| `b_morga_ko_1` | 戦闘不能 | ふふ……わたしの番……かしら…… | collapsing, faint wry laugh |
| `b_morga_victory_1` | 勝利 | 静かになったわね。……お墓は要るかしら？ | dark humor, calm smile |

## マルタ（町医者）

声 `ja-jp-advisor-7` — きびきび頼もしく、少し厳しめ

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_marta_attack_1` | 通常攻撃 | このっ！ | brisk doctor, firm |
| `b_marta_attack_2` | 通常攻撃 | そこよ！ | decisive |
| `b_marta_attack_3` | 通常攻撃 | じっとして！ | stern, like to a patient |
| `b_marta_bigtech_1` | 大技・閃き | 無茶はさせないわよ！ | strict and caring, strong |
| `b_marta_bigtech_2` | 大技・閃き | 手早く済ませるわ！ | efficient, confident |
| `b_marta_spell_1` | 術 | 癒やしの水よ！ | calm and warm |
| `b_marta_hurt_1` | 被弾 | つっ……！ | short hiss of pain |
| `b_marta_hurt_2` | 被弾 | 平気、かすり傷！ | brushing it off, professional |
| `b_marta_ko_1` | 戦闘不能 | 誰か……手当てを…… | collapsing, fading |
| `b_marta_victory_1` | 勝利 | はい、みんな並んで。傷を見せなさい。 | brisk, caring, a little bossy |

## ノエラ（見習い巫女）

声 `ja-jp-commercial-3` — 素直で一生懸命、少しあわてんぼう

| id | 種類 | 台詞 | 演技 |
|---|---|---|---|
| `b_noela_attack_1` | 通常攻撃 | えいやっ！ | young shrine maiden, earnest |
| `b_noela_attack_2` | 通常攻撃 | とうっ！ | energetic, trying hard |
| `b_noela_attack_3` | 通常攻撃 | お覚悟を！ | polite but determined |
| `b_noela_bigtech_1` | 大技・閃き | 泉の神さま、お力を！ | earnest prayer, rising |
| `b_noela_bigtech_2` | 大技・閃き | いきます、全力です！ | eager, a bit flustered, loud |
| `b_noela_spell_1` | 術 | 光よ、みんなを！ | sincere, bright |
| `b_noela_hurt_1` | 被弾 | きゃあっ！ | high startled cry |
| `b_noela_hurt_2` | 被弾 | あわわっ！ | flustered |
| `b_noela_ko_1` | 戦闘不能 | すみません……もう…… | collapsing, apologetic |
| `b_noela_victory_1` | 勝利 | やりました！……あれ、今のわたしですか？ | joyful, then surprised at herself |

## 主人公（男女共通の台詞）

男 `voice_akrep1z0wngp`（Signature Voice）／女 `ja-jp-assistant-4`

| 種類 | n | 台詞 | 演技 |
|---|---|---|---|
| 通常攻撃 | 1 | はあっ！ | sharp attack shout on a sword swing, short and powerful |
| 通常攻撃 | 2 | せいっ！ | quick crisp strike cry, energetic |
| 通常攻撃 | 3 | くらえっ！ | fierce shout, putting full strength into the blow |
| 閃き | 1 | ……見えた！ | a sharp inhale, then sudden inspiration: a new technique flashes into mind; excited, bright |
| 閃き | 2 | 今だ……そこっ！ | a flash of insight in battle, focused then decisive |
| 術 | 1 | 言の葉よ、力を！ | casting a spell, calling on the power of words, confident and ringing |
| 術 | 2 | 届けっ！ | releasing a spell with conviction, strong |
| 被弾 | 1 | ぐっ……！ | taking a hit, short pained grunt |
| 被弾 | 2 | うあっ！ | struck hard, short pained cry |
| 戦闘不能 | 1 | ここまで……か…… | collapsing in battle, weak, fading breath |
| 勝利 | 1 | よし、勝った！ | relieved and happy after winning a battle, bright |
| 勝利 | 2 | この物語は、まだ続く。 | calm confident smile after victory |
| 大技・閃き | 1 | これで決める！ | unleashing a big special technique, decisive and powerful, ringing |
| 大技・閃き | 2 | 全力で、いく！ | gathering all strength for a finishing move, determined, loud |
