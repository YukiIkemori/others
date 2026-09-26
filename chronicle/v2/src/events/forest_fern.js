// CONTENT-F: フェルンのイベント（V2_PLAN §3.3 F1〜F4・F12、WORLD_REDESIGN §4.1・§3.3、STORY_BIBLE §7.1・§8.2）
//   fern_arrival（F1、onEnter）・fern_board・fern_gord（F3）・fern_rita（F4）・fern_pim_mother（F2）・fern_hanna（＋一品物 ac_tale_forest）
//   町の人（話す見返り: 手がかり・依頼・一度だけの品・ボスの癖・ほのめかし・近況）と屋内の人・調べる物。
//   向こうから寄ってきて事件を話す人は置かない（WORLD §3.1 の 1）。台詞は 1 行 全角 16 字前後・3 行まで。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const F = () => R.ContentF.forest;
  const cleared = (ev) => ev.flag('cleared_r_forest');

  // ---------------------------------------------------------------- F1 着いたとき（話しかけてこない。広場の人だかりと張り紙）
  E('fern_arrival', async (ev) => {
    if (ev.flag('forest_start')) return;
    ev.setFlag('forest_start');
    await ev.caption('樹上の家々に、蛍の籠が灯っている。\n……けれど、村は静まりかえっていた。', { ms: 2600 });
    await ev.caption('広場に、捜索隊の男たちが\n集まっている。', { ms: 2000 });
  }, { meta: { needs: [], gives: ['flag:forest_start'] } });

  // 掲示板（l_forest_board）
  E('fern_board', async (ev) => {
    if (cleared(ev)) {
      await ev.say(null, '掲示板に、新しい張り紙。\n「夏至の祭り、今年は開きます。\n――村の衆」');
      await ev.say(null, 'その下に、へたな字で一枚。\n「ぼくの詩を読みたい人は\nピムまで」');
      return;
    }
    await ev.say(null, ['掲示板に、大きな張り紙がある。', '「捜索隊、求む。\n樵のハンス・ベン・ロイが\n森から戻らない。」', '「迷いの森に入れる腕のある者は、\n樵頭ゴードの家まで。\n――樵頭ゴード」']);
    await ev.say(null, 'その下に、小さな張り紙が\nいくつか重ねてある。\n（依頼は、村の人に聞いてみよう）');
    ev.setFlag('forest_board');
    ev.lead('l_forest_board');
  }, { meta: { needs: [], gives: ['lead:l_forest_board', 'flag:forest_board'] } });

  E('fern_search_lead', async (ev) => {
    if (ev.flag('forest_found_hans') && ev.flag('forest_found_ben') && ev.flag('forest_found_roy')) {
      await ev.say('search_lead', '三人とも見つかったって！？\n野営地で待ってる？\n……あんた、たいしたもんだ。');
      return;
    }
    await ev.say('search_lead', ['森が道を変えちまって、\n捜索隊は入口の広場から\n先へ進めねえんだ。', '腕に覚えがあるなら、\n掲示板を見てくれ。\n親方のゴードが頼んでる。']);
    ev.lead('l_forest_board');
  }, { meta: { needs: [], gives: ['lead:l_forest_board'] } });

  // ---------------------------------------------------------------- F3 樵頭ゴード（l_forest_woodcutters）
  E('fern_gord', async (ev) => {
    const f = F();
    // ファロスからの届け物（q_pharos_delivery、依頼の中身は CONTENT-P）
    if (ev.flag('q_pharos_delivery_got') && !ev.flag('q_pharos_delivery_done')) {
      await ev.say('gord', ['造船所の見習いからの届け物？\n……ああ、頼んでおいた\n斧の柄の木型だ。', 'わざわざ森まで、すまねえ。\nほら、駄賃だ。とっといてくれ。']);
      ev.gold(150);
      ev.setFlag('q_pharos_delivery_done');
      ev.leadDone('q_pharos_delivery');
    }
    if (cleared(ev)) {
      if (ev.choiceOf('ch_forest_write') === 'pain') {
        await ev.say('gord', ['伐り跡の原に、苗を植えはじめた。\n親父の運んだ木の代わりにな。', '何を燃やすための木だったか、\n今も分からねえ。……だから、\n植えるのさ。']);
      } else {
        await ev.say('gord', ['仲間たちも、みんな帰ってきた。\n{hero}、本当にありがとうな。', 'これからは、女房と坊主の\nそばにいてやるさ。\n……森の主さまに誓ってな。']);
      }
      return;
    }
    if (!ev.flag('forest_gord_talked')) {
      await ev.say('gord', ['あんたが、張り紙を見て\n来てくれたのか。おれはゴード。\n樵頭だ。', '樵のハンス、ベン、ロイの三人が、\n森から三日も帰らねえ。\nおまけに、うちの坊主まで……。', '親方のおれがこのざまだ。\n足をくじいて、森へ\n探しに行けねえ。']);
      await ev.say('gord', ['三人の持ち物を教えておく。\nハンスは斧、ベンは呼び笛、\nロイは弁当箱だ。', '樵は迷ったら、持ち物を\n置いて目印にする。\n落ちてたら、近くにいるはずだ。', '坊主のことは、女房のカトリに\n聞いてくれ。……頼む。']);
      ev.setFlag('forest_gord_talked');
      ev.lead('l_forest_woodcutters');
      ev.lead('l_forest_board');
      return;
    }
    const n = f.count(ev);
    if (n > 0) await ev.say('gord', `野営地で ${n} 人が待ってるって？\n……森の中で、よく無事で。\n残りも、頼む。`);
    else await ev.say('gord', ['ハンスは斧、ベンは呼び笛、\nロイは弁当箱だ。', '坊主のことは、女房のカトリに\n聞いてくれ。']);
  }, { meta: { needs: [], gives: ['lead:l_forest_woodcutters', 'flag:forest_gord_talked'] } });

  // ---------------------------------------------------------------- F2 ピムの母カトリ（帽子の片方 k_pim_hat → l_forest_pim）
  E('fern_pim_mother', async (ev) => {
    if (cleared(ev)) {
      await ev.say('katri', ['あの子ったら、帰るなり\n「語り部になる」だって。', '……でも、よかった。\n本当に、よかった。']);
      return;
    }
    if (ev.flag('forest_found_pim')) {
      if (ev.choiceOf('ch_forest_pim') === 'send' && !ev.flag('forest_katri_thanks')) {
        await ev.say('katri', ['ピムが見つかったのね！\n野営地で、樵のみんなと\n待ってるって……。', 'これ、あの子に持たせるはずだった\nお弁当なの。あなたが持っていって。']);
        R.ContentF.forest.give(ev, 'i_potion', 3);
        await ev.say('katri', ['それからね。あの子、よく\n「秘密のうろ」の話をしてたの。', '迷いの森の、南西の広場。\nいちばん大きな木のうろの奥に、\n壁の抜けた所があるって。']);
        ev.setFlag('forest_katri_thanks');
        return;
      }
      await ev.say('katri', 'ピムを見つけてくれて、\nありがとう。……あの子の\nそばに、いてあげてね。');
      return;
    }
    if (!ev.has('k_pim_hat')) {
      await ev.say('katri', ['わたしはカトリ。ピムの母です。\nあの子、父親を探すって、\nひとりで森へ入ったの。', 'ゆうべ、帽子の片方だけが\n戸口に落ちてて……。']);
      await ev.say('katri', ['これ、あの子の帽子の片方。\n森の苔の粉が、ついているでしょう。', '同じ粉が、あの子の足あとにも\nついているはず。これを持てば、\n光って見えるかもしれない。']);
      R.ContentF.forest.give(ev, 'k_pim_hat', 1);
      ev.lead('l_forest_pim');
      return;
    }
    await ev.say('katri', '帽子を持っていれば、\nあの子の足あとが光るはず。\n……どうか、お願い。');
  }, { meta: { needs: [], gives: ['item:k_pim_hat', 'lead:l_forest_pim', 'flag:forest_katri_thanks'] } });

  E('fern_pim_bed', async (ev) => {
    await ev.say(null, ['ピムの寝床。枕の下から、\n書きかけの紙がはみ出している。', '「森の主は ねぼすけで……」\n……続きは、線で消してある。']);
  });

  // ---------------------------------------------------------------- F4 リタ（l_forest_song）
  E('fern_rita', async (ev) => {
    const f = F();
    const n = ev.var('forest_verses');
    if (cleared(ev)) {
      await ev.say('rita', '{hero}！　聞いて。\n歌を、最後まで歌えるの！');
      await ev.caption(ev.choiceOf('ch_forest_write') === 'pain' ? f.SONG + '\n' + f.EXTRA : f.SONG, { ms: 5200 });
      if (ev.choiceOf('ch_forest_write') === 'pain') await ev.say('rita', ['三つ目の石の一節も、\n歌に足したの。', '森を焼いた火のことも、\n歌っていいと思うの。\n……忘れたら、また迷うから。']);
      else await ev.say('rita', '夏至の祭りでは、わたしが\n歌うことになったの。\nおばあちゃんみたいにね。');
      return;
    }
    if (n >= 3) { await ev.say('rita', ['三つの石の歌が、\nつながったのね！', '千年樹へ行って、\n森の主さまに届けて。\n……お願い。']); return; }
    if (n > 0) { await ev.say('rita', ['歌の石を見つけたのね！\n……ねえ、聞かせて。', `残りは ${3 - n} つ。\nきっと迷いの森のどこかに\nあるはずよ。`]); return; }
    if (!ev.flag('forest_rita_talked')) {
      await ev.say('rita', ['♪　眠れ森の主、千の年輪に……。\nだめ。この先が、\nどうしても出てこないの。', 'わたしはリタ。この村の歌い手。\n千年樹の歌は、最初の一節しか\n思い出せないの。']);
      await ev.say('rita', ['森の道しるべの石に、歌が\n刻まれてるって、おばあちゃんが\n言ってた。石は全部で三つ。', '歌がそろえば、森は道を\n変えなくなるって。']);
      await ev.say('rita', ['……去年の春、記録院の人が来て、\n歌を書き写していったの。', 'それから、村の子どもたちが\n歌えなくなって……\nわたしも、続きが出てこない。']);
      ev.setFlag('forest_rita_talked');
      ev.lead('l_forest_song');
      return;
    }
    await ev.say('rita', '森の道しるべの石を探して。\n迷いの森の中に、\n三つあるはずよ。');
  }, { meta: { needs: [], gives: ['lead:l_forest_song', 'flag:forest_rita_talked'] } });

  E('fern_rita_stone', async (ev) => {
    await ev.say(null, ['歌の家の祭壇に、小さな石が\n祭ってある。', '歌の石の、かけらだろうか。\n表に、音符のような刻みがある。']);
  });

  // ---------------------------------------------------------------- 村の年寄りハンナ（解決の後に ac_tale_forest。ロアの出で「おはよう」を知っている）
  E('fern_hanna', async (ev) => {
    if (ev.flag('forest_finale_done') && !ev.flag('fern_hanna_reward')) { await ev.call('fern_hanna_reward'); return; }
    if (cleared(ev)) {
      await ev.say('hanna', ['夏至の祭りには、また\n千年樹の歌を歌うわ。\n今度は、決して忘れない。', '……おはよう。\nそう言ってくれる人が、\nこの村にも増えるといいね。']);
      return;
    }
    if (!ev.flag('forest_hanna_talked')) {
      await ev.say('hanna', ['おや、旅の方。\nわたしはハンナ。若いころに、\nロアの里から嫁いできたの。', 'ロアじゃ、朝のあいさつに\n「おはよう」って言うのよ。\n……もう、意味は誰も知らないけど。']);
      await ev.say('hanna', ['森の奥の千年樹には、森の主\nエルムさまが眠っているの。', '昔は夏至の祭りに、主さまへ\n歌をささげたものよ。\n……その歌を、誰も思い出せない。']);
      ev.setFlag('forest_hanna_talked');
      return;
    }
    await ev.say('hanna', '歌い手のリタにも、\n話を聞いてあげて。\n北東の、いちばん高い木のそばよ。');
  }, { meta: { needs: [], gives: ['flag:forest_hanna_talked'], calls: ['fern_hanna_reward'] } });

  E('fern_hanna_reward', async (ev) => {
    if (ev.flag('fern_hanna_reward')) return;
    await ev.say('hanna', ['{hero}、本当にありがとう。\n森が、また歌っているわ。', 'これは、村に伝わる首飾り。\n木霊が宿っていると\n言われているの。']);
    R.ContentF.forest.give(ev, 'ac_tale_forest', 1);
    ev.setFlag('fern_hanna_reward');
    await ev.say('hanna', '森の主さまの加護が、\nあなたの旅を守りますように。');
  }, { meta: { needs: ['flag:forest_finale_done'], gives: ['item:ac_tale_forest', 'flag:fern_hanna_reward'] } });

  // ---------------------------------------------------------------- 町の人（見返り）
  E('fern_hunter', async (ev) => {
    // ⑥ ボスの癖（WORLD §4.10 の考えどころを先に）
    if (cleared(ev)) { await ev.say('hunter', '森が静かになった。\n狩りも、少しは\n楽になりそうだ。'); return; }
    const i = ev.var('forest_hunter_tip') % 3;
    ev.addVar('forest_hunter_tip', 1);
    const tips = [
      ['狼の群れには頭がいる。\n遠吠えで仲間を呼ぶんだ。', '頭を先に倒せば、\n群れは散っていくさ。'],
      ['森の奥の大きな羽虫な。\n羽が光ったら、次は\n眠りの粉をまく。', '目覚まし草を持っていくか、\n風の術で吹き飛ばすんだな。'],
      ['千年樹の根を食う化け物の話を\n聞いたことがある。根が地面に\nもぐったら、前に立つ者を打つ。', '前の者を後ろへ下げるか、\n身を守れ。……それと、根は\n火をいやがるそうだ。'],
    ];
    await ev.say('hunter', tips[i]);
  }, { meta: { needs: [], gives: [] } });

  E('fern_kid', async (ev) => {
    // ④ ダンジョンの中の隠し通路のほのめかし（場所まで言う）
    if (cleared(ev)) { await ev.say('kid', 'ピムがね、語り部に\nなるんだって！　へんなの！'); return; }
    await ev.say('kid', ['ピムがね、言ってたよ。\n迷いの森の奥の、東の広場。', 'その北東の森の壁から、\n風が抜けてくるんだって！\n……ひみつだよ？']);
  });

  E('fern_traveler', async (ev) => {
    // ① 寄り道の噂（手がかり）
    await ev.say('traveler', ['森を抜けて商いに行くつもりが、\n道が毎日変わるんだとさ。\n足止めを食ってるよ。', '街道の脇に、樵の休み小屋がある。\n寝床は、誰が使ってもいいそうだ。']);
    ev.lead('l_opt_hut');
    await ev.say('traveler', ['それから、森の北のほうに\n名を持たない人たちの里が\nあるって噂だ。', '珍しい飾りを売ってるとか。\n……おれは、こわくて\n行けないがね。']);
    ev.lead('l_opt_yura');
  }, { meta: { needs: [], gives: ['lead:l_opt_hut', 'lead:l_opt_yura'] } });

  E('fern_old_woodcutter', async (ev) => {
    // ⑦ 近況・戦の傷（伐り跡の原）
    if (cleared(ev)) {
      await ev.say('elder_m', ev.choiceOf('ch_forest_write') === 'pain'
        ? ['ゴードの坊主が、伐り跡に\n苗を植えはじめたよ。', '二十年かかって、やっとだ。']
        : ['森が歌っとる。\nわしの若いころと同じ音じゃ。']);
      return;
    }
    await ev.say('elder_m', ['この先は、伐り跡の原じゃ。\n二十年前、森の東半分が\n伐られた。', '戦の烽火のためじゃと。\n……何を燃やして、何を\n知らせたのかは、もう分からん。', 'ゴードの親父も、その木を運ぶ\n途中で死んだ。']);
  });

  E('fern_cutover', async (ev) => {
    await ev.say(null, ['切り株が、どこまでも並んでいる。\nどれも、同じ高さで切られている。']);
    if (ev.choiceOf('ch_forest_write') === 'pain') await ev.say(null, '切り株のあいだに、\n小さな苗が植わっている。');
    await R.ContentF.forest.lore(ev, 'lo_war_forest');
  }, { meta: { needs: [], gives: ['flag:lore_lo_war_forest'] } });

  E('fern_peddler', async (ev) => {
    await ev.say('peddler', cleared(ev) ? '森の道が、元に戻ったそうだ。\nやっと荷を運べるよ。' : 'いらっしゃい。森の道が\n閉じちまって、品が\nあまってるんだ。');
    await ev.shop('shop_fern_peddler');
  });

  E('fern_yura_miller', async (ev) => {
    // 連作「名前を忘れた人々」の 1 人目（WORLD §4.9）: ユラで名を思い出し、フェルンへ帰った粉ひきのエダ
    if (!ev.flag('yura_miller_thanked')) {
      await ev.say('yura_miller', ['ここが、わたしの家のある村。\n……エダ。わたしの名前は、エダ。', 'ユラで、あなたに会ったわね。\n思い出したとき、真っ先に\nあなたの顔が浮かんだの。']);
      await ev.say('yura_miller', 'これ、粉ひきの小屋に\nしまってあったの。\nよかったら、持っていって。');
      R.ContentF.forest.small(ev, [['i_potion', 2], ['i_potion', 3], ['i_elixir', 1], ['i_elixir', 2]]);
      ev.setFlag('yura_miller_thanked');
      ev.leadDone('q_yura_names');
      return;
    }
    await ev.say('yura_miller', ['名前を呼ばれるって、\nこんなに温かいのね。', 'ユラのみんなにも、\nいつか……。']);
  }, { meta: { needs: ['flag:yura_miller_home'], gives: ['flag:yura_miller_thanked'] } });

  // ---------------------------------------------------------------- 屋内の人
  E('fern_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? '祭りのお客さんで、\n宿は大にぎわいよ！' : 'いらっしゃい。木漏れ日亭へ\nようこそ。森の夜は冷えるから、\nゆっくり休んでいって。');
    await ev.inn();
  });
  E('fern_inn_guest', async (ev) => {
    if (cleared(ev)) { await ev.say('inn_guest', '千年樹の梢が光ってるの、\n見たかい？　宿の窓からでも\nよく見えるんだ。'); return; }
    await ev.say('inn_guest', ['港町ファロスから来たんだ。\n灯台に火が戻ったって、\n港じゃ大騒ぎさ。', 'この村も、早く明るく\nなるといいね。']);
  });
  E('fern_shop_keeper', async (ev) => {
    await ev.say('shop_keeper', '森で迷ったら、まず\n目覚まし草と傷薬だ。\n……いらっしゃい。');
    await ev.shop('shop_fern_items');
  });
  E('fern_search_chief', async (ev) => {
    if (cleared(ev)) { await ev.say('search_chief', '捜索隊は、今夜でおしまいだ。\nあんたのおかげだよ。'); return; }
    await ev.say('search_chief', ['森が道を変えるのは、\n決まった道だけらしい。', '野営地から東へ抜ける道と、\n西の広場から北へ抜ける道。\nそこを通ると、別の所へ出る。', 'ほかの道を回れば、\n奥へは行けるはずだ。']);
  });
  E('fern_search_map', async (ev) => {
    await ev.say(null, ['詰所の壁に、迷いの森の地図が\n張ってある。', '入口の広場の北に「蛍だまり」。\nそこから先は、線が何度も\n書き直されている。']);
  });

  // ---------------------------------------------------------------- 締めのあとのピム（連作「ピムの語り部修行」の始まり）
  E('fern_pim_after', async (ev) => {
    if (!ev.flag('forest_pim_poet')) {
      await ev.say('pim_after', ['{hero}！　ぼくね、決めたんだ。\n語り部になる！', 'でも、ぼく、森の外の話を\nなんにも知らないから……。']);
      await ev.say('pim_after', ['旅をしたら、その話を\n手紙で送ってよ。\nぼくが、詩にするから！', 'ほら、これ。ぼくの\nはじめての詩。']);
      await ev.letter('letter_forest_pim_poem');
      ev.setFlag('forest_pim_poet');
      ev.lead('q_pim_poet');
      return;
    }
    await ev.say('pim_after', ev.choiceOf('ch_forest_pim') === 'take'
      ? '千年樹の抜け穴、ぼくが\n開けたんだからね！\nみんなに言ってるんだ。'
      : 'ぼく、ほんとは最後まで\n行きたかったんだ。\n……つぎは、ついていくからね！');
  }, { meta: { needs: ['region:r_forest'], gives: ['lead:q_pim_poet', 'flag:forest_pim_poet'] } });
})(window.RPG);
