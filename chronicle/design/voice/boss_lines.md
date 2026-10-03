# ルミナス・クロニクル　ボスの声（戦闘）

持ち主 2026-10-03。戦闘の始め・暴走（怒り狂った／本気になった）・必殺技（技ごとに 1 つ）・倒れた時の短い一言。正は `design/voice/boss_lines.csv`（このファイルは `node tools/boss_voice.js` が作る。手で直さない）。

- ゲーム: `v2/src/data/boss_voice.js`（R.DB.bossVoice）・字幕 `v2/src/i18n/<言語>/boss_voice.js`・鳴らし方 `v2/src/systems/battle/voice_boss.js`
- 鳴らし方: 待たない。新しい声が前の声を止める（仲間の戦闘ボイスと同じ口）。倍速・リピート中は始めと暴走を出さず、必殺技はその戦闘で初めての技だけ。設定「戦闘ボイス」なしなら出さない。
- 声の無いボス（言葉を持たない獣）: ページ食らい・ダストウィング・根食らい・砂もぐり・狼の群れ頭・吹雪の大狼・深みの大ダコ・岩食らい・炎の番犬・溶岩の巨獣・星食らい・人形の楽団・本の巨人・鉱脈の主
- 作り直し: `node tools/voice_tts.js --boss --only <id> --force`

## 配役

| ボス | 声 | 物語の声を使う | 演出 |
|---|---|---|---|
| 名なき砂の王 `b_sandking` | `ja-jp-advisor-3` fx spirit | `hazal` | regal male voice, hoarse and dry; in battle a mad, hollow menace |
| 氷壁の巨人 `b_icegiant` | `ja-jp-concierge-12` fx giant | `giant` | deep booming male voice, heavy and threatening |
| 白竜ネーヴェ `b_whitedragon` | `ja-jp-training-10` fx spirit | `neve` | low, majestic mature female voice, cold and commanding in battle |
| 霧食らい `b_mistbeast` | `ja-jp-tutor-1` fx mist | `mistwitch` | eerie, whispering, broken syllables with unnatural pauses |
| 亡霊船長グレン `b_captain` | `ja-jp-podcaster-4` fx ghost | `glen` | rough male voice of a seaman; in battle confused fury |
| 鉄の番人 `b_ironwarden` | `ja-jp-advisor-8` fx guardian | `guardian` | deep stern male voice, heavy, mechanical weight |
| 天球の番人 `b_orrery` | `ja-jp-training-11` fx sentinel | `sentinel` | flat, monotone, robotic, evenly spaced syllables |
| ロウェル `b_rowell1` | `ja-jp-tutor-4` | `rowell` | young male voice, crisp and cool, clipped battle lines |
| ロウェル `b_rowell2` | `ja-jp-tutor-4` | `rowell` | young male voice, crisp, strained with doubt, fierce in battle |
| 剣の勇者の影 `b_shade_sword` | `ja-jp-storyteller-5` fx ghost | 新 | 遠くから響く若い勇者。夢の中のように |
| 祈りの勇者の影 `b_shade_prayer` | `ja-jp-csagent-11` fx spirit | 新 | やさしい神殿の娘。祈るように |
| 杖の勇者の影 `b_shade_star` | `ja-jp-techagent-7` fx spirit | 新 | 気の強い術師の娘。最後は泣きそうに |
| 大書記ラザロ `b_lazaro` | `ja-jp-podcaster-1` | `lazaro` | mature male voice, soft-spoken, very polite, chilling calm; grief underneath |
| 虚ろの王 `b_nemrea1` | `ja-jp-storyteller-4` fx king | `king` | deep, inhuman male voice full of contempt; heavy and resonant, unhurried but never slow |
| ネムレア `b_nemrea2` | `ja-jp-assistant-9` fx spirit | `nemrea` | soft androgynous voice, breathy, sleepy and childlike, unsettling |
| 魔王の残影 `b_valzard_echo` | `algenib` fx valzard | `valzard` | deep gravelly male voice, heavy, weary dread |
| 円環竜オウロボラ `b_ouroboros` | `ja-jp-storyteller-9` fx p0.8 | 新 | 太古の竜。ゆったりと、楽しむように |
| 獣使いのガロ `b_tamer` | `ja-jp-csagent-1` | 新 | 陽気な獣使い。威勢よく |
| 術師の姉ヒノエ `b_sister_elder` | `ja-jp-concierge-1` | 新 | 落ち着いた姉。品よく |
| 鉄鎧のバルガ `b_armorman` | `ja-jp-podcaster-8` ×0.9 | 新 | 鎧の中の大男。豪快に |
| ザクロ `b_zakuro` | `ja-jp-advisor-10` | `zakuro` | low, dry adult male voice, about thirty-five; blunt and terse, quietly honourable; standard Tokyo Japanese |
| 鷹団の頭ラシード `b_hawk_chief` | `ja-jp-tutor-9` | `rashid` | low, rough male voice around forty, terse and guarded; a soldier-turned-bandit, quiet menace, weary underneath |
| 氷の船団長 `b_frost_admiral` | `ja-jp-techagent-12` fx ghost | 新 | 百年凍った船団長。号令は固く、最後は哀しく |

## 名なき砂の王

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_sandking_start_1` | 戦闘の始め |  | 名を持つ者よ……砂に還れ。 | a mad nameless king rising from his throne; hollow, hostile, slow and dry |
| `bv_sandking_enrage_1` | 暴走 |  | 返せ……わが名を、返せ！ | bandages coming loose, rage and anguish breaking out; hoarse shout at the end |
| `bv_sandking_ult_1` | 必殺技 | 砂の審判 | 砂の審判を受けよ！ | raising his sand staff, a royal judgement pronounced with terrible authority |
| `bv_sandking_defeat_1` | 倒れた時 |  | わが名は……どこに……。 | collapsing, sand pouring out; lost and pitiful, fading |

## 氷壁の巨人

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_icegiant_start_1` | 戦闘の始め |  | 峰を荒らす者は、つぶす……。 | slow menacing rumble, an ice wall standing up |
| `bv_icegiant_enrage_1` | 暴走 |  | ぬうう……許さぬ……！ | deep growl swelling into fury |
| `bv_icegiant_ult_1` | 必殺技 | 雪崩落とし | 雪に、埋もれよ……！ | tearing down the snow wall; heavy, crushing command |
| `bv_icegiant_defeat_1` | 倒れた時 |  | 峰を……守れ、なんだ……。 | toppling over, a slow heavy dying groan, old-fashioned speech |

## 白竜ネーヴェ

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_whitedragon_start_1` | 戦闘の始め |  | 凍てつくがよい。何もかも。 | cold majestic dragon, contempt and grief frozen together; low and resonant |
| `bv_whitedragon_enrage_1` | 暴走 |  | この胸の痛みは……何だ……！ | the ice in her chest cracking; confused pain turning into rage |
| `bv_whitedragon_ult_1` | 必殺技 | 氷河落とし | 氷河よ、落ちよ！ | calling down a glacier from the sky; grand, commanding |
| `bv_whitedragon_defeat_1` | 倒れた時 |  | わたしは……何を守っていた……？ | kneeling, the frost leaving her voice; bewildered, almost gentle |

## 霧食らい

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_mistbeast_start_1` | 戦闘の始め |  | ……アソボウ……キリノ……ナカデ……。 | a broken imitation of a kind woman luring children; eerie sing-song whisper |
| `bv_mistbeast_enrage_1` | 暴走 |  | ……カエサナイ……カエサナイ……！ | the mask slipping; hissing, greedy, getting louder |
| `bv_mistbeast_defeat_1` | 倒れた時 |  | ……カネ……ノ……オト……。 | dissolving into the bog at the sound of a bell; a fading, frightened rasp |

## 亡霊船長グレン

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_captain_start_1` | 戦闘の始め |  | おれの船から、出ていけ！ | a confused ghost captain roaring at intruders on his ship |
| `bv_captain_enrage_1` | 暴走 |  | 帰るんだ……邪魔をするな！ | desperate and furious, clinging to the one thing he remembers |
| `bv_captain_ult_1` | 必殺技 | 大砲の嵐 | 撃て、撃てぇ！ | bellowing a fire order to a ghost crew, wild |
| `bv_captain_defeat_1` | 倒れた時 |  | おれは……どこへ、帰るんだった……。 | sinking down, lost and sad, fading |

## 鉄の番人

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_ironwarden_start_1` | 戦闘の始め |  | 誓いなき者は、打ち砕く。 | an ancient iron guardian pronouncing a sentence; slow, stern, metallic |
| `bv_ironwarden_enrage_1` | 暴走 |  | 炉よ、燃え上がれ。 | his furnace heart flaring; a low command, heat rising |
| `bv_ironwarden_ult_1` | 必殺技 | 金床落とし | 砕けよ。 | one heavy word as the anvil arm falls |
| `bv_ironwarden_defeat_1` | 倒れた時 |  | 鍛冶神よ……約束は……。 | grinding to a halt, a faithful old machine's last words |

## 天球の番人

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_orrery_start_1` | 戦闘の始め |  | ……シンニュウシャ、ハイジョ……。 | a broken star-orrery automaton; flat mechanical syllables |
| `bv_orrery_enrage_1` | 暴走 |  | ……ケイカイ、サイダイ……。 | mechanical alarm, faster and harsher syllables |
| `bv_orrery_ult_1` | 必殺技 | 日食 | ……ニッショク、カイシ……。 | cold mechanical announcement of an eclipse |
| `bv_orrery_defeat_1` | 倒れた時 |  | ……ホシノナ……オモイダセ……ナイ……。 | winding down, syllables slowing and dropping in pitch |

## ロウェル

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_rowell1_start_1` | 戦闘の始め |  | 記録官として、手加減はしない。 | cool and proud, drawing his silver pen like a rapier |
| `bv_rowell1_enrage_1` | 暴走 |  | ……少しは、やるようだな。 | annoyed, getting serious, a thin sarcastic edge |
| `bv_rowell1_ult_1` | 必殺技 | 記録の断罪 | この一行で、終わりだ！ | a decisive strike, sharp and confident |
| `bv_rowell1_defeat_1` | 倒れた時 |  | ばかな……おれが、押し負ける……？ | stumbling back, shocked and offended |

## ロウェル

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_rowell2_start_1` | 戦闘の始め |  | 行くぞ、語り部！ | no hesitation this time, fierce and determined |
| `bv_rowell2_enrage_1` | 暴走 |  | おれは……負けられないんだ！ | pushing away his doubt with a shout, strained |
| `bv_rowell2_ult_1` | 必殺技 | 抹消 | 抹消する！ | striking out a line with all his strength, sharp |
| `bv_rowell2_defeat_1` | 倒れた時 |  | ……どうして、だ……。 | beaten, breathless and lost, quiet |

## 剣の勇者の影

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_shade_sword_start_1` | 戦闘の始め |  | ……魔王は、どこだ……。 | a white shadow of a legendary swordsman; distant, dreamlike, searching |
| `bv_shade_sword_enrage_1` | 暴走 |  | まだ……倒れるわけには……！ | a hero's stubborn will, echoing from far away |
| `bv_shade_sword_defeat_1` | 倒れた時 |  | ……ようやく、眠れる……。 | relieved, fading into light |

## 祈りの勇者の影

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_shade_prayer_enrage_1` | 暴走 |  | 祈りは……絶えません……！ | a temple maiden's shadow; gentle but unyielding prayer |
| `bv_shade_prayer_defeat_1` | 倒れた時 |  | ……ありがとう……。 | a soft grateful whisper, fading into light |

## 杖の勇者の影

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_shade_star_enrage_1` | 暴走 |  | わたしたちの名を……呼んで……！ | a mage girl's shadow pleading, almost crying |
| `bv_shade_star_defeat_1` | 倒れた時 |  | ……覚えていて、くれたのね……。 | surprised and happy, fading into light |

## 大書記ラザロ

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_lazaro_start_1` | 戦闘の始め |  | 静かに、終わらせてあげましょう。 | polite, chillingly calm, like a kind teacher |
| `bv_lazaro_enrage_1` | 暴走 |  | なぜ……忘れさせてくれないのです！ | the calm breaking; grief and anger rising |
| `bv_lazaro_ult_1` | 必殺技 | 削除 | この行は、いらない。 | cold and quiet, erasing a line with his red pen |
| `bv_lazaro_ult_2` | 必殺技 | 書き換え | わたしの記録を、書き直します。 | calm and precise, rewriting his own page |
| `bv_lazaro_defeat_1` | 倒れた時 |  | ミラ……わたしは……。 | falling to his knees, calling his lost daughter's name, broken |

## 虚ろの王

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_nemrea1_start_1` | 戦闘の始め |  | 抗うな。忘れれば、楽になる。 | primordial oblivion; vast, cold, contemptuous and slow |
| `bv_nemrea1_enrage_1` | 暴走 |  | なぜ……消えぬ……！ | the vast voice shaking with fury for the first time |
| `bv_nemrea1_ult_1` | 必殺技 | 白紙に還す | 白紙に還れ。 | an absolute command, heavy and final |
| `bv_nemrea1_defeat_1` | 倒れた時 |  | この器は……もう、いらぬ。 | discarding the body it had taken; cold, unbroken |

## ネムレア

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_nemrea2_start_1` | 戦闘の始め |  | ……眠い……。もう、閉じようよ……。 | sleepy and childlike, unsettlingly gentle |
| `bv_nemrea2_enrage_1` | 暴走 |  | どうして……閉じさせてくれないの……。 | sleepy whine turning into a sad tantrum |
| `bv_nemrea2_ult_1` | 必殺技 | 物語を閉じる | この人の話は、ここでおしまい。 | closing a book like putting a child to bed; soft and terrible |
| `bv_nemrea2_ult_2` | 必殺技 | 八つの伝承 | 八つの伝承も、白紙に……。 | dreamy and slow, letting the legends go |
| `bv_nemrea2_ult_3` | 必殺技 | 物語の書き直し | わたしを……書き直す……。 | murmuring, half asleep, rewriting itself |
| `bv_nemrea2_defeat_1` | 倒れた時 |  | ……名前……あたたかい……。 | falling asleep in wonder, very soft |

## 魔王の残影

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_valzard_echo_start_1` | 戦闘の始め |  | 恐れよ。それが、われのすべてだ。 | the echo of a demon lord; deep, slow, weary dread |
| `bv_valzard_echo_enrage_1` | 暴走 |  | 光の……紋章……！ | recognising the crest that once destroyed him; dread and rage |
| `bv_valzard_echo_ult_1` | 必殺技 | 絶望の残響 | 絶望に、沈め！ | a crushing roar of despair |
| `bv_valzard_echo_defeat_1` | 倒れた時 |  | 忘れられ……恐れも、消える……。 | dissolving, almost relieved, fading echo |

## 円環竜オウロボラ

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_ouroboros_start_1` | 戦闘の始め |  | おまえたちの結末、いただこう。 | an ancient ring dragon that eats the ends of stories; vast, amused, hungry |
| `bv_ouroboros_enrage_1` | 暴走 |  | 輪を……ほどかせはせぬ！ | the ring loosening; furious, booming |
| `bv_ouroboros_ult_1` | 必殺技 | 輪の終わり | 輪の終わりだ。 | final and heavy, savouring it |
| `bv_ouroboros_ult_2` | 必殺技 | 巻き戻し | 時よ、戻れ。 | calm, ancient command over time |
| `bv_ouroboros_ult_3` | 必殺技 | 尾をのむ | わが尾よ、力となれ。 | devouring its own tail, a deep satisfied rumble |
| `bv_ouroboros_defeat_1` | 倒れた時 |  | 終わらぬ物語など……ない、か……。 | uncoiling and fading; quiet, almost wistful |

## 獣使いのガロ

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_tamer_start_1` | 戦闘の始め |  | 行くぜ、相棒たち！ | a cheerful arena beast tamer whistling his beasts forward |
| `bv_tamer_enrage_1` | 暴走 |  | 本気で行くぞ、おまえら！ | grinning, getting serious, rallying his beasts |
| `bv_tamer_defeat_1` | 倒れた時 |  | ……参った。いい腕だ。 | good loser, out of breath, a sporting laugh |

## 術師の姉ヒノエ

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_sister_elder_start_1` | 戦闘の始め |  | 姉妹の火、受けてごらんなさい。 | composed elder sister mage, elegant challenge |
| `bv_sister_elder_enrage_1` | 暴走 |  | スミ、気を抜かないで！ | sharp and focused, calling to her younger sister |
| `bv_sister_elder_defeat_1` | 倒れた時 |  | ……ここまで、ね。 | kneeling, graceful acceptance, a small sigh |

## 鉄鎧のバルガ

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_armorman_start_1` | 戦闘の始め |  | ぐはは！　この鎧、破れるか？ | a huge armoured man laughing inside his helmet, boastful |
| `bv_armorman_enrage_1` | 暴走 |  | ぐぬう……やるではないか！ | hurt but delighted, booming |
| `bv_armorman_ult_1` | 必殺技 | 盾打ち | ぶっ飛べぇ！ | charging with his shield, a huge shout |
| `bv_armorman_defeat_1` | 倒れた時 |  | 鎧が……重い……。 | toppling over, a comic heavy groan |

## ザクロ

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_zakuro_start_1` | 戦闘の始め |  | 手は抜かねえ。行くぞ。 | laconic hired fighter, hand on his sword hilt; low and blunt |
| `bv_zakuro_enrage_1` | 暴走 |  | ……ここからは、本気で行く。 | drawing his second sword; quiet and dangerous |
| `bv_zakuro_ult_1` | 必殺技 | 居合 | まずは癒やし手からだ。 | cold professional judgement before a quick-draw strike |
| `bv_zakuro_defeat_1` | 倒れた時 |  | ……見事だ。おれの負けだ。 | lowering his sword, honest respect, calm |

## 鷹団の頭ラシード

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_hawk_chief_start_1` | 戦闘の始め |  | 砂の上で、鷹に勝てると思うな。 | masked bandit chief, low quiet menace |
| `bv_hawk_chief_enrage_1` | 暴走 |  | ……面白い。少しは骨がある。 | a soldier's grim interest, tightening his grip |
| `bv_hawk_chief_ult_1` | 必殺技 | 砂けむりの舞 | 砂に、のまれろ！ | kicking up a sandstorm, fierce shout |
| `bv_hawk_chief_defeat_1` | 倒れた時 |  | ……くそ、ここまでか。 | beaten, bitter and tired |

## 氷の船団長

| id | 場面 | 技 | 台詞 | 演技 |
|---|---|---|---|---|
| `bv_frost_admiral_start_1` | 戦闘の始め |  | 総員、配置につけ！ | a frozen ghost admiral barking orders to a dead crew |
| `bv_frost_admiral_enrage_1` | 暴走 |  | 帰るのだ……港へ……！ | the ice cracking off; desperate longing turned to fury |
| `bv_frost_admiral_ult_1` | 必殺技 | 氷の砲撃 | 撃ち方、始め！ | a formal naval fire order, ringing |
| `bv_frost_admiral_defeat_1` | 倒れた時 |  | 冬至には……間に合わなんだか……。 | thawing and fading; old-fashioned, sad and gentle |
