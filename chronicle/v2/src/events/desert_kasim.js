// CONTENT（砂漠）: オアシスの町カシムの人と物（WORLD_REDESIGN §5.5・§4.2、STORY_BIBLE §7.2・§8.3）。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。解決の後とティアで台詞が変わる。
//   依頼の人（ナディアの足鈴・井戸掘り・迷子のラクダ・のろし・塩・地図屋・占い・値切り・藍染め）は desert_quests.js。
//   仲間の名前は出さない（A36）。ボイスは使わない。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const cleared = (ev) => ev.flag('cleared_r_desert');
  const T = () => X().tier();

  // ---------------------------------------------------------------- 町に入る
  E('kasim_arrival', async (ev) => {
    if (!ev.flag('desert_arrived')) {
      ev.setFlag('desert_arrived');
      await ev.caption('オアシスの町カシム。\n砂丘に半ば埋もれた、\n顔のない王の巨像の足もとの町。', { ms: 2600 });
      await ev.caption('巨像の前の市場の屋台は、\n半分が布をおろしていた。', { ms: 2200 });
      await ev.caption('隊商が出られず、品が届かない。\n泉の水も、日に日に細っている。', { ms: 2200 });
      ev.lead('l_rumor_desert');
      return;
    }
    if (cleared(ev) && !ev.flag('desert_arrived_after')) {
      ev.setFlag('desert_arrived_after');
      await ev.caption('泉の水面が、金色の火を映している。\n市場の屋台が、ひとつ残らず\n布を上げていた。', { ms: 2400 });
    }
  }, { meta: { needs: [], gives: ['flag:desert_arrived', 'lead:l_rumor_desert'] } });

  // ---------------------------------------------------------------- 広場
  E('kasim_fara', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'fara';
    if (cleared(ev)) {
      await ev.say(id, T() >= 3 ? ['泉の底の字、毎晩読んでるの。\n「名を呼ぶかぎり、火は消えず」', 'ほかの土地の灯も、\nきっと誰かの名で\n燃えてるのね。'] : ['泉が戻ったの！\n父さんがね、泣きながら\n水をくんでたわ。', '底の字の意味、やっとわかった。\n名を呼ぶかぎり、火は消えない。']);
      return;
    }
    if (!ev.flag('desert_fara_met')) {
      ev.setFlag('desert_fara_met');
      await ev.say(id, ['わたしはファラ。父さんが\nこの泉の番人なの。', '泉が、毎年少しずつ\n浅くなってるの。今年は、\nとうとう底が見えてしまった。', '底の石に、古い字が彫ってあるわ。\n誰にも読めないけど……\n石の手の、指のあいだから見てみて。']);
      ev.lead('l_desert_spring');
      return;
    }
    await ev.say(id, ev.flag('lo_desert_spring_letters') ? ['「名を呼ぶかぎり、火は消えず」……？', '王墓のそばの古い泉が、\nこの泉の水の源なんですって。\nそこにも、何かあるのかしら。'] : '泉の底の字、見てくれた？\n石の手の指のあいだから、\nのぞけるわ。');
  }, { meta: { needs: [], gives: ['lead:l_desert_spring'] } });

  E('kasim_spring_letters', async (ev) => {
    if (cleared(ev)) { await ev.say(null, ['泉の底の古い字が、\n水の下で金色に光っている。', '「ハザルの火を、泉に預く。\n名を呼ぶかぎり、火は消えず」']); return; }
    await ev.say(null, ['石の手の指のあいだから、\n乾いた泉の底をのぞきこむ。\n底の石に、古い字が彫ってある。', '「……の火を、泉に預く。\n名を呼ぶかぎり、火は消えず」', '最初の所だけ、字が\nすっかり消えている。']);
    await X().lore(ev, 'lo_desert_spring_letters');
  }, { meta: { needs: [], gives: ['flag:lo_desert_spring_letters'] } });

  E('kasim_sundial', async (ev) => {
    await ev.say(null, ['広場のすみの、古い日時計だ。\n影を落とす針が、天を指している。', '影の刻みの溝に、\n砂がびっしりたまっている。\n何年分……いや、何十年分か。']);
    ev.setFlag('desert_sundial_seen');
    if (ev.flag('desert_ledger_seen')) await X().lore(ev, 'lo_time_desert');
    else await ev.say(null, '……影が落ちない日時計。\nいつから、使われていないのだろう。');
  }, { meta: { needs: [], gives: ['flag:desert_sundial_seen', 'flag:lo_time_desert'] } });
  // 巨像の台座（名の削れた王。王墓の名なき王と同じ）
  E('kasim_colossus', async (ev) => {
    await ev.say(null, ['巨像の台座だ。ラクダを連れた\n隊商の列が、浮き彫りにされている。', 'まん中の、名を刻む枠だけが\nのみで削り取られていた。\n見上げた顔も、風ですり減っている。']);
    if (cleared(ev)) await ev.say(null, '削られた枠の下に、\n誰かが小さく彫り足していた。\n「ハザル」と。');
    else if (ev.flag('desert_abul_met')) await ev.say(null, '……アブルの話では、王墓の\n王の名も、石から消えていたという。');
  });
  E('kasim_guild_ledger', async (ev) => {
    await ev.say(null, ['隊商ギルドの古い帳面だ。\n「日の出の祈り」という欄がある。', '毎朝、隊が出る前に\n祈った印らしい。……印は、\n光暦二九二年の冬で終わっている。']);
    ev.setFlag('desert_ledger_seen');
    if (ev.flag('desert_sundial_seen')) await X().lore(ev, 'lo_time_desert');
    else await ev.say(null, '二十年前の冬……。\n市場の日時計と、関係があるのだろうか。');
  }, { meta: { needs: [], gives: ['flag:desert_ledger_seen', 'flag:lo_time_desert'] } });
  E('kasim_old_man', async (ev) => {
    if (cleared(ev)) { await ev.say('sundial_old', ['日輪の火は太陽のかけら。\nわしは、今でもそう思うとる。', '……じゃが、ハザル王は\n空から取ったんじゃない。\n名と取り替えたんじゃな。']); return; }
    await ev.say('sundial_old', ['この日時計はな、わしの\nじいさまの、じいさまの代から\nここにある。', 'ところが、わしが若いころ、\nある冬を境に、影が\nぱったり落ちんようになった。', '影が落ちんのに、時を刻む道具……。\n笑えるじゃろう。\n誰も、砂を掃かんようになった。']);
    ev.lead('l_desert_sundial');
  }, { meta: { needs: [], gives: ['lead:l_desert_sundial'] } });

  E('kasim_board', async (ev) => {
    const lines = [];
    if (!ev.flag('desert_camp3_done')) lines.push('「護衛を求む。王墓のオアシスまで、\n供え物を運ぶ隊。腕に覚えのある者は\n隊商ギルドのザイードまで」');
    else if (!cleared(ev)) lines.push('「隊商、王墓のオアシスに着く。\n隊は泉のほとりで待機」');
    else lines.push('「祝・泉の水、戻る。\n今宵、広場にて王の歌を歌う。\n――隊商ギルド」');
    lines.push(ev.flag('desert_camel_done') ? '「迷子のラクダ、戻る。礼」' : '「ギルドのラクダ一頭、迷子。\n見つけた者は帳場まで」');
    if (T() >= 2) lines.push('「北の雪原より、毛皮の荷。\n南の灰の荒野への峠、崩れのため不通」');
    await ev.say(null, lines);
  });
  E('kasim_memorial', async (ev) => {
    if (cleared(ev) && ev.choiceOf('ch_desert_write') === 'pain') { await ev.say(null, ['日輪同盟の戦没者の碑だ。\n削れた名の横に、新しい名が\nいくつも彫り直されている。', '刃物で、ていねいに。\n砂の鷹団の手だろう。']); return; }
    await ev.say(null, ['日輪同盟の戦没者の碑だ。\n「日輪は王の火なり」と刻まれている。', '名は、二十年の砂風で\nほとんど読めない。']);
  });
  E('kasim_well', async (ev) => {
    await ev.say(null, cleared(ev) ? '町の井戸だ。水面が、\n手の届く所まで上がってきている。' : ['町の井戸だ。つるべを下ろすと、\n長い長い時間のあとで、\nかすかに水の音がした。', '「一杯十ゴールド」の札が\n掛かっている。']);
  });

  // 日焼けした男（沈んだ神殿のうわさ・鷹団の話）
  E('kasim_hawk_friend', async (ev) => {
    if (!ev.flag('desert_hawk_met')) {
      await ev.say('hawk_friend', ['おれは南の浜で塩を拾ってる。\n……変なもんを見たぜ。', '砂嵐が晴れた晩、月明かりの浜に\n見たことのない柱の先が\n何本も突き出してたんだ。', '次の晩には、もう砂の下さ。\n満月の晩の、消灯の刻だけ\n見えるのかもしれねえ。']);
      ev.lead('l_opt_temple');
      return;
    }
    const c = X().hawk(ev);
    await ev.say('hawk_friend', c === 'fight' ? ['砂の鷹とやりあったって？\nあいつら、洞に帰って\n守りを固めてるらしいぜ。', '頭は、弓手を盾にする。\n弓手を先に黙らせれば、\n頭の守りも解けるって話だ。'] : ['砂の鷹の頭と話したのか。\n……あいつら、根っからの\n悪党じゃねえんだ。', '台地の洞には、年寄りや\nガキもいる。気が向いたら\n寄ってやってくれ。']);
    ev.lead('l_opt_temple');
  }, { meta: { needs: [], gives: ['lead:l_opt_temple'] } });

  // 門番（西: 鷹団のうわさ・ボスの癖／東: 灰の荒野への峠）
  E('kasim_gate_w', async (ev) => {
    if (cleared(ev)) { await ev.say('guard_w', '隊商路に、のろしの火が\n戻りつつある。見回りも楽になった。'); return; }
    if (!ev.flag('desert_hawk_met')) {
      await ev.say('guard_w', ['西の門を出て南が、隊商路だ。\n王墓のオアシスまで、三晩かかる。', '気をつけろ。隊商路には\n「砂の鷹」という盗賊が出る。\n夜、鷹の笛が聞こえたら用心だ。', 'やつらの頭は、砂をまき上げてから\n大きく斬りかかってくる。\n砂が舞ったら、身を守れ。']);
      ev.lead('l_desert_hawks');
      ev.lead('l_opt_hawknest');
      return;
    }
    await ev.say('guard_w', ['砂の鷹に会ったか。\n……無事でなによりだ。', '西の岩の台地から、\n夜ごと鷹の笛が聞こえる。\nやつらのねぐらだろうな。']);
  }, { meta: { needs: [], gives: ['lead:l_desert_hawks', 'lead:l_opt_hawknest'] } });
  E('kasim_gate_e', async (ev) => {
    await ev.say('guard_e', ['東の門の先は、灰の荒野への峠だ。\n……が、灰の崩れで通れない。', '向こうのカルデラでは、\n火の鳥の卵が冷えていくとか。\n灰まみれの旅人が、そう言ってた。']);
    ev.lead('l_rumor_ash');
  }, { meta: { needs: [], gives: ['lead:l_rumor_ash'] } });

  E('kasim_water_woman', async (ev) => {
    if (!ev.flag('desert_water_gift_' + T())) {
      ev.setFlag('desert_water_gift_' + T());
      await ev.say('woman_mid', cleared(ev) ? ['泉が戻ったお祝いよ！\n一杯どうぞ。……ただで！'] : ['水売りのマリカよ。\n泉の水は細る一方。', '……あら、旅の人？\nのどが渇いてるでしょう。\n一杯だけ、おまけしてあげる。']);
      X().small(ev, [['i_salve', 2], ['i_potion', 2], ['i_potion', 3], ['i_ether', 2], ['i_ether', 3]]);
      return;
    }
    await ev.say('woman_mid', cleared(ev) ? '水の値が半分になったの。\n商売あがったりだけど、\nみんな笑ってるから、いいわ。' : '泉が枯れたら、町は終わり。\n……そうならないように、\n毎晩祈ってるのよ。');
  }, { meta: { needs: [], gives: [] } });

  E('kasim_kid', async (ev) => {
    if (cleared(ev)) { await ev.say('pilgrim_kid', '泉で泳いだら、\nしかられちゃった！'); return; }
    await ev.say('pilgrim_kid', ev.flag('desert_dig_asked') && !ev.flag('desert_dig_found') ? ['井戸掘りのオマルじいちゃんが\n言ってたよ。', '水の上の砂は、\nほかより少しだけ\n冷たいんだって！'] : ['ぼく、泉の底まで降りたこと\nあるんだ！　底の石が、\nほんのり温かかったよ。', 'ギルドのラクダが一頭、\n南東の砂丘に行っちゃったって。\nおじさんたち、困ってた。']);
  });

  E('kasim_rashid_memorial', async (ev) => {
    await ev.say('rashid_memorial', ['……年代記に、おれたちのことを\n書いてくれたそうだな。', '碑に、死んだ仲間の名を彫り直した。\n覚えているかぎり、全部。', '何のための戦だったのかは、\nまだ思い出せん。だが、\n誰が死んだかは、もう忘れん。']);
  });

  // ---------------------------------------------------------------- ザイード（ギルド・広場・解決の後）
  E('kasim_zaid', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'zaid_guild';
    if (cleared(ev)) {
      if (ev.flag('desert_cart')) {
        await ev.say(id, ['よう、語り部の。\n隊商路の荷車に乗るかい？\n宿場「砂の縁」まで、ひと晩だ。']);
        const i = await ev.choose(['乗る（砂の縁へ）', 'やめておく'], { cancel: 1 });
        if (i === 0) {
          await ev.fade('out', 400);
          await ev.warp('sandedge', 'warp');
          await ev.fade('in', 400);
          await ev.caption('荷車にゆられて、ひと晩。\n宿場「砂の縁」に着いた。', { ms: 1800 });
        }
        return;
      }
      await ev.say(id, '隊商路は、また動きだした。\nあんたたちのおかげだ。');
      return;
    }
    if (!ev.flag('desert_zaid_met')) {
      ev.setFlag('desert_zaid_met');
      await ev.say(id, ['わしは隊商の長ザイード。\n掲示を見てくれたか。', '王墓のオアシスへ、供え物を運ぶ。\n昔からの習わしでな。泉の水の源が、\nそこの古い泉なんだ。', '砂嵐と盗賊で、隊が出せずにいる。\n護衛を頼めないか。\n野営を三晩、オアシスまでだ。']);
      ev.lead('l_desert_caravan');
    } else {
      await ev.say(id, '支度はいいか？\n隊は、西の門の外で待っている。');
    }
    const i = await ev.choose(['出発する', 'まだ支度がある'], { cancel: 1, text: '隊商と出発する？' });
    if (i !== 0) { await ev.say(id, 'わかった。支度ができたら、\nまた声をかけてくれ。'); return; }
    await ev.say(id, 'よし、出発だ！\n……頼りにしてるぞ。');
    await ev.call('desert_caravan_depart');
  }, { meta: { needs: [], gives: ['flag:desert_zaid_met', 'lead:l_desert_caravan'], calls: ['desert_caravan_depart'] } });

  // ---------------------------------------------------------------- 市場
  E('kasim_arms', async (ev) => {
    await ev.say('arms_vendor', cleared(ev) ? '隊商が戻って、いい鋼が\n入ったぜ。見ていきな。' : ['武具売りのハミドだ。\n隊商が来ないんで、品は\n古い物ばかりだがな。', '砂漠の魔物は、硬い殻の\nやつが多い。打つ武器も\nひとつ持っておくといい。']);
    await ev.shop('shop_kasim_arms');
  });
  E('kasim_shop_keeper', async (ev) => {
    await ev.say('shop_keeper', cleared(ev) ? 'いらっしゃい。\nギルドのお客さんは一割引きだ。' : 'いらっしゃい。\n砂漠を歩くなら、薬と\n土の石は多めにな。');
    await ev.shop('shop_kasim_items');
  });

  // ---------------------------------------------------------------- 宿・酒場
  E('kasim_inn_keeper', async (ev) => {
    const price = R.Tier && R.Tier.innPrice ? R.Tier.innPrice() : 20;
    await ev.say('inn_keeper', ['「泉の星亭」へようこそ。', '朝の鐘まで休むかい？\nそれとも、消灯の刻まで？\n……消灯の刻の砂漠は、\n不思議なものが見えるよ。']);
    const i = await ev.choose([`泊まる（${price} G）`, `消灯の刻まで休む（${price} G）`, 'やめておく'], { cancel: 2 });
    if (i === 2) return;
    const ok = await ev.inn(price);
    if (!ok) return;
    if (i === 1) {
      ev.setFlag('desert_night');
      const n = ev.addVar('desert_nights', 1);
      await ev.caption(n === 3 ? '消灯の刻。窓の外で、\n大きな月が砂を白く照らしている。\n……今夜は満月だ。' : '消灯の刻。町の灯が落ちた。\n窓の外の砂漠の真ん中に、\n灯りの列が揺れている……。', { ms: 2600 });
      ev.lead('l_opt_mirage');
    } else {
      ev.setFlag('desert_night', false);
      await ev.say('inn_keeper', 'おはよう。……と言っても、\n空はいつもの色だけどね。');
    }
  }, { meta: { needs: [], gives: ['flag:desert_night', 'var:desert_nights+1', 'lead:l_opt_mirage'] } });
  E('kasim_inn_guest', async (ev) => {
    await ev.say('inn_guest', ['森からの街道を来たんだ。\n途中に宿場「砂の縁」がある。\n泉の水が甘くてね。', '行商人のロッタって娘が、\nおもしろい品を背負ってたよ。']);
    ev.lead('l_opt_sandedge');
  }, { meta: { needs: [], gives: ['lead:l_opt_sandedge'] } });
  E('kasim_inn_window', async (ev) => {
    if (ev.flag('desert_night')) { await ev.say(null, ['窓の外は、消灯の刻の砂漠。\n西の門の外、砂の真ん中に\n灯りの列が揺れている。', '……市のにぎわいの音が、\nかすかに聞こえる。']); return; }
    await ev.say(null, cleared(ev) ? '窓から、広場の泉が見える。\n水面に、金色の火が\nゆらゆらと映っている。' : '窓から、広場の泉が見える。\n水は、底がすけるほど浅い。');
  });
  E('kasim_tavern_master', async (ev) => {
    const news = [
      ['酒場「砂時計」へようこそ。\n砂時計は、ここじゃ時を計る\nただひとつの道具さ。', '日時計？　あれは飾りだよ。\n影が落ちねえんだから。'],
      ['港町の灯台が、また灯ったそうだ。\n森の千年樹も光ったとか。', '……次は、うちの泉の番だと\nいいんだがな。'],
      ['北の雪原の村じゃ、大火祭の火を\n峰へ運ぶらしい。', '東の湿原では、霧の中で\n鐘が鳴るとか。……世の中、\n変わりはじめてるのかね。'],
    ];
    if (cleared(ev)) { await ev.say('tavern_master', ['泉が戻った祝いだ。\n今夜は一杯目がただだ！', '……ハザル王に、乾杯。\nいい名だ。忘れねえよ。']); return; }
    await ev.say('tavern_master', news[Math.min(T(), news.length - 1)]);
  });
  E('kasim_tavern_poster', async (ev) => {
    await ev.say(null, ev.flag('desert_hawk_met') ? ['「砂の鷹団の頭に懸賞金」の貼り紙だ。', '誰かが、すみに小さく\n「もう少し待ってやれ」と\n書き足している。'] : ['「砂の鷹団の頭に懸賞金」の貼り紙だ。\n顔を布で覆った男の絵。', '「曲刀の使い手。弓手を連れる」']);
  });
  E('kasim_rumor_a', async (ev) => {
    await ev.say('rumor_a', ['北の岩場でね、隊商の人が\n岩が動いたのを見たんだって！', 'うろこが虹色に光ってたって。\nそんなトカゲ、見てみたいわあ。\n……いえ、やっぱりこわい。']);
    ev.lead('l_opt_rocks');
  }, { meta: { needs: [], gives: ['lead:l_opt_rocks'] } });
  E('kasim_rumor_b', async (ev) => {
    if (cleared(ev)) { await ev.say('rumor_b', ['ナディアの歌を聞いたかい。\n名の入った王の歌。', 'ぼくのたて琴でも、いっしょに\n弾けるようになったよ。']); return; }
    await ev.say('rumor_b', ['ぼくは旅の楽士。\nナディアの王の歌は、\nこの町の宝だよ。', '……名の所だけ、どうしても\n歌えないんだ。ぼくにも。\n楽譜には、何も書いてない。', '南の灰の荒野では、火の鳥の卵が\n冷えていくって話も聞いた。\n世の中、冷えていくばかりさ。']);
    ev.lead('l_rumor_ash');
  }, { meta: { needs: [], gives: ['lead:l_rumor_ash'] } });
  E('kasim_rumor_c', async (ev) => {
    await ev.say('rumor_c', ['北の雪の村ユールから来た。\n大火祭の支度で大忙しさ。', 'ただ、今年は冬至の火が\n細いって、村の者が\n心配してた。']);
    ev.lead('l_rumor_snow');
  }, { meta: { needs: [], gives: ['lead:l_rumor_snow'] } });

  // ---------------------------------------------------------------- ギルド
  E('kasim_caravan_man', async (ev) => {
    if (cleared(ev)) { await ev.say('caravan_man', 'のろしが戻れば、夜でも\n隊商路を走れる。\nタデオさんに、礼を言わなきゃな。'); return; }
    await ev.say('caravan_man', ['隊と歩くと、魔物が\n寄ってきやすい。水と荷の\n匂いがするからな。', '砂嵐のくぼ地には、宝石みたいな\nうろこのトカゲがいるって話だ。\n逃げ足が速くて、誰も捕まえられねえ。', '……盗むなら、話は別だがな。']);
  });

  // ---------------------------------------------------------------- アブル（王墓の番。名の文字・ボスの癖）
  E('kasim_abul', async (ev) => {
    if (cleared(ev)) { await ev.say('abul', ['夕べの祈りに、王の名が戻った。\n墓の番の、長いつとめも\nこれで報われる。', '砂王の印章は、大事にしておくれ。']); return; }
    ev.setFlag('desert_abul_met');
    await ev.say('abul', ['わしはアブル。王墓の番じゃ。\n名なき王の墓を、代々守っておる。', '去年、都から記録官が来てな。\n王の間の石板を、紙に写していった。\nそれから、王の名が思い出せん。', '墓守の像の台座に、王の名が\n一文字ずつ刻まれておる。\n三つそろえれば、名になる。']);
    ev.lead('l_desert_glyphs');
    await ev.say('abul', ['王は、日と月の灯を従えておる。\n灯がある間、王の体は\n光の膜に守られるという。', '灯を先に消すのじゃ。\n……そして、王の包帯がほどけたら、\n名を呼んでやっておくれ。']);
  }, { meta: { needs: [], gives: ['flag:desert_abul_met', 'lead:l_desert_glyphs'] } });
  E('kasim_abul_altar', async (ev) => {
    await ev.say(null, ['小さな祭壇だ。\n干した花と、水の入った杯。', cleared(ev) ? '祈りの札に、新しい字で\n「ハザル王に」と書き足されている。' : '祈りの札には「――王に」とだけ\n書いてある。名の所が、空いている。']);
  });
})(window.RPG);
