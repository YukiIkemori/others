// ユールのイベント（町の人・屋内・調べる物）。WORLD_REDESIGN §4.3・§3.3（話す見返り）・§5.6、STORY_BIBLE §7.3・§8.4・§3.5・§10
//   yule_arrival（着いたとき。話しかけてこない）・掲示板・ヨルン（支度）・ソーニャ（白紙の本）・ハルド（遠吠え・焼けた北門）
//   町の人: 見返り ①手がかり ②依頼 ③品ぞろえ ④ダンジョンの隠し場所のほのめかし ⑤一度だけの品 ⑥ボスの癖 ⑦近況 をそろえる。
//   台詞は 1 行 全角 16 字前後・3 行まで。解決の後・ティアで台詞が変わる。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Snow.ev;
  const cleared = (ev) => ev.flag('cleared_r_snow');

  // ---------------------------------------------------------------- 着いたとき（祭の飾りつけの最中。話しかけてこない）
  E('yule_arrival', async (ev) => {
    if (ev.flag('snow_festival_lit') && !ev.flag('snow_siege_done')) { await ev.call('yule_siege_resume'); return; }
    if (ev.flag('snow_finale_done') && !ev.flag('snow_day2')) { await ev.call('snow_day2'); return; }
    if (ev.flag('snow_start')) return;
    ev.setFlag('snow_start');
    await ev.caption('雪に埋もれた家々を、\n雪のトンネルがつないでいる。', { ms: 2400 });
    await ev.caption('トンネルの入口ごとに、\n氷の灯籠が並べられていた。\n――大火祭の支度の最中らしい。', { ms: 2800 });
    await ev.caption('広場の大かまどの火は、\nひどく細かった。', { ms: 2000 });
  }, { meta: { needs: [], gives: ['flag:snow_start'], calls: ['snow_day2', 'yule_siege_resume'] } });

  // ---------------------------------------------------------------- 掲示板（依頼の張り紙）
  E('yule_board', async (ev) => {
    if (cleared(ev)) {
      await ev.say(null, ['掲示板に、新しい張り紙。\n「大火祭、二日目をやります。\n――村長ヨルン」', 'その下に、子どもの字で一枚。\n「雪合戦、参加者つのる」']);
      return;
    }
    await ev.say(null, ['掲示板に、祭の張り紙がある。', '「冬至の大火祭。支度の手を\n求む。薪・氷の灯籠・語り。\n――村長ヨルン」']);
    await ev.say(null, ['その下に、小さな張り紙が\nいくつか重ねてある。', '「氷上の釣り大会。祭の間。」\n「そり犬ゆくえ知れず。ニルス」\n「雪像の飾り、求む。リーサ」']);
    ev.setFlag('snow_board');
    ev.lead('l_snow_prep'); ev.lead('q_snow_fishing'); ev.lead('q_snow_dog'); ev.lead('q_snow_statue');
  }, { meta: { needs: [], gives: ['flag:snow_board', 'lead:l_snow_prep', 'lead:q_snow_fishing', 'lead:q_snow_dog', 'lead:q_snow_statue'] } });

  // ---------------------------------------------------------------- 村長ヨルン（支度 → 祭の始まり）
  E('yule_jorn', async (ev) => {
    const x = X();
    if (ev.flag('snow_finale_done')) {
      if (!ev.flag('snow_jorn_reward')) { await ev.call('snow_jorn_reward'); return; }
      await ev.say('jorn', ev.choiceOf('ch_snow_write') === 'pain'
        ? ['壊れた門のそばで、家の名を\n読み上げた。……書いてくれて、\nありがとう。', '忘れていいことと、\nいけないことがある。']
        : ['二日目の祭は、にぎやかだ。\n{hero}、あんたのおかげだ。', '峰の竜にも、今年の物語は\n届いたろう。']);
      return;
    }
    if (ev.flag('snow_siege_done')) { await ev.say('jorn', ['籠城は明けた。……だが、\n吹雪はまだやまん。', '冬至の火を、峰の竜へ\n届けてくれ。頼む。']); return; }
    if (ev.flag('snow_festival_lit')) return;
    if (!ev.flag('snow_jorn_talked')) {
      await ev.say('jorn', ['よい灯りを、旅の人。\nわしはヨルン。ユールの村長だ。', '今夜は冬至。大火祭の夜だ。\n大かまどで冬至の火を燃やし、\n昔話を語って、峰へ運ぶ。']);
      await ev.say('jorn', ['峰の白竜に火と物語を届け、\n竜は吹雪を鎮める。\n……それが村と竜の約束だ。', 'ところが今年は、秋から\n一日も吹雪がやまん。\n竜に物語が届いておらんのだ。']);
      await ev.say('jorn', ['支度の手が足りん。\n頼めるか。仕事は三つだ。', '雪の林で薪を三本。\n凍った池で灯籠の氷。\nそれと、祭で語る昔話だ。']);
      await ev.say('jorn', ['昔話は、村の年寄りが知っとる。\n集会所のイングリッド、\n狩人のオラフ、ブレンダばあさん。', '祭の本があれば、それを\n読むだけで済んだんだがな……。\nソーニャに聞いてみてくれ。']);
      ev.setFlag('snow_jorn_talked');
      ev.lead('l_snow_prep'); ev.lead('q_snow_ingrid');
      return;
    }
    const logs = ev.flag('snow_logs_done'), ice = ev.flag('snow_ice_done'), tales = ev.flag('snow_tales_done');
    if (logs && tales) {
      if (!ice) {
        const i = await ev.choose(['祭を始める', 'まだ支度をする'], { cancel: 1, text: '氷の灯籠がまだだが、始めるか？' });
        if (i !== 0) { await ev.say('jorn', '凍った池の釣り小屋の\nトーレに、のこぎりを\n借りるといい。'); return; }
      } else {
        const i = await ev.choose(['祭を始める', 'もう少し待つ'], { cancel: 1, text: '支度はそろった。祭を始めるか？' });
        if (i !== 0) { await ev.say('jorn', '支度ができたら、\nいつでも声をかけてくれ。'); return; }
      }
      await ev.call('snow_festival');
      return;
    }
    const left = [];
    if (!logs) left.push(`雪の林の薪（${ev.var('snow_logs')}/3）`);
    if (!ice) left.push('凍った池の氷');
    if (!tales) left.push(`昔話（${['snow_tale_dragon', 'snow_tale_hunter', 'snow_tale_fire_child'].filter((f) => ev.flag(f)).length}/3）`);
    await ev.say('jorn', ['残りの支度は、\n' + left.join('・') + '。', x.prep(ev) >= 2 ? 'あと少しだ。\n今夜のうちに、火を入れたい。' : '雪の林は、東の門を出て\n南へ下った所だ。']);
  }, { meta: { needs: [], gives: ['flag:snow_jorn_talked', 'lead:l_snow_prep', 'lead:q_snow_ingrid'], calls: ['snow_festival', 'snow_jorn_reward'] } });

  E('snow_jorn_reward', async (ev) => {
    if (ev.flag('snow_jorn_reward')) return;
    await ev.say('jorn', ['{hero}、ユールの礼だ。\n村に伝わる冬至の火の守り。', '火を運んだ娘が、峰から\n持ち帰ったものだと言われとる。']);
    ev.item('ac_tale_snow', 1);
    ev.setFlag('snow_jorn_reward');
    await ev.say('jorn', '寒い夜には、胸に当てるといい。\n……あったかいぞ。');
  }, { meta: { needs: ['flag:snow_finale_done'], gives: ['item:ac_tale_snow', 'flag:snow_jorn_reward'] } });

  // ---------------------------------------------------------------- 火守りの娘ソーニャ（白紙の本・夜数えの板）
  E('yule_sonja', async (ev) => {
    if (ev.flag('snow_finale_done')) {
      await ev.say('sonja', ev.flag('snow_board_stop')
        ? ['夜数えの板にね、今夜は\n刻みを入れなかったの。', '……いつもより、\n空が明るかったから。']
        : ['冬至の火が、峰で燃えてる。\nここからでも見えるの。', '祖母がね、「朝が来るまで\n数えなさい」って。\n朝って、何だろうね。']);
      return;
    }
    if (ev.flag('snow_siege_done')) { await ev.say('sonja', ['冬至の火の火種、なくさないでね。', '峰の氷の壁も、\nこの火ならとけるはず。']); return; }
    if (!ev.flag('snow_sonja_talked')) {
      await ev.say('sonja', ['……火が細いの。\n脂を足しても、足しても。', 'わたしはソーニャ。\n火守りの家の娘よ。\n大かまどの火を守ってるの。']);
      await ev.say('sonja', ['祭ではね、火の前で\n物語の本を読むの。\n毎年、同じ本を。', 'でも今年、本を開いたら……\n真っ白だったの。\n一文字も、残ってなかった。']);
      await ev.say('sonja', '本は、集会所の書見台にあるわ。\n見てみて。……何か、\n分かるかもしれない。');
      ev.setFlag('snow_sonja_talked');
      ev.lead('l_snow_book');
      return;
    }
    await ev.say('sonja', ev.flag('lo_ev_snow')
      ? ['「写本・記録院ノルデン分室」……？\n去年の秋、白い服の人が来て、\n本を借りていったわ。', '返ってきたら、真っ白。\n村はずれの空き家が、\nその人たちの宿だったの。']
      : '本は、集会所の書見台よ。\n大かまどの集会所。');
    if (ev.flag('lo_ev_snow')) ev.lead('l_main_recorder_snow');
  }, { meta: { needs: [], gives: ['flag:snow_sonja_talked', 'lead:l_snow_book', 'lead:l_main_recorder_snow'] } });

  // ---------------------------------------------------------------- 見張りの老人ハルド（遠吠え・焼けた北門・戦の傷）
  E('yule_hald', async (ev) => {
    if (cleared(ev)) {
      await ev.say('hald', ['吹雪がやんだ。\n……峰が、こんなにはっきり\n見えるのは何年ぶりか。', 'わしの指の話か？\n……もう、いい。']);
      return;
    }
    if (ev.flag('snow_siege_done')) { await ev.say('hald', ['よく守った。\n……峰へ行くなら、北の門を出て\nまっすぐだ。', '巨人がおる。\n火を持っていけ。']); return; }
    if (!ev.flag('snow_hald_talked')) {
      await ev.say('hald', ['……聞こえるか。\n吹雪の奥の、遠吠えが。', '夜ごと、近づいてくる。\n狼どもは、群れの頭に\n率いられておる。']);
      await ev.say('hald', ['祭の火が燃え上がれば、\n村は明るくなる。\n……狼は、明るい所を嫌わん。', '門は三つ。北、東、西。\n守りを考えておかねばならん。']);
      ev.setFlag('snow_hald_talked');
      ev.lead('l_snow_howl');
      return;
    }
    const i = ev.var('snow_hald_tip') % 3;
    ev.addVar('snow_hald_tip', 1);
    const tips = [
      ['群れは、いちばん声の大きい\n方角から押してくる。', '遠吠えの方角を\n聞き分けることだ。'],
      ['頭は賢い。守りの手薄な門を\n狙ってくる。……一度も\n守らなかった門をな。', '読み合いだ。'],
      ['……この指か。\n北門が焼けた夜に、な。', '何と戦ったのか、\nわしにも分からん。\n門は、あのあと建て直した。'],
    ];
    await ev.say('hald', tips[i]);
  }, { meta: { needs: [], gives: ['flag:snow_hald_talked', 'lead:l_snow_howl'] } });

  E('yule_burnt_gate', async (ev) => {
    await ev.say(null, ['北門の柱は、ほかより新しい。\n根もとの石だけが、黒く焦げている。']);
    if (ev.flag('snow_hald_talked')) await ev.say(null, 'ハルドの手袋の、縫い閉じた指を\n思い出した。');
    await X().lore(ev, 'lo_war_snow');
  }, { meta: { needs: [], gives: ['flag:lo_war_snow'] } });

  // ---------------------------------------------------------------- 町の人（見返り）
  E('yule_watch_e', async (ev) => {
    // ⑥ ボスの癖（吹雪の大狼・氷壁の巨人）
    if (cleared(ev)) { await ev.say('watch_e', '見張り番も、今夜は\n星を数えるだけだ。'); return; }
    const i = ev.var('snow_watch_tip') % 2;
    ev.addVar('snow_watch_tip', 1);
    await ev.say('watch_e', [
      ['群れの頭の大狼は、\n遠吠えのあとに吹雪をまとって\n飛びかかってくるそうだ。', '遠吠えを聞いたら、\nみんなで身を固めろ。……親父の話さ。'],
      ['峰の巨人は、体が白く光ると\n氷の鎧を着る。刃が通らなくなる。', '火を見せれば、鎧は張れん。\n張っても、火で砕けるらしい。'],
    ][i]);
  });

  E('yule_soup', async (ev) => {
    // ⑤ 一度だけの品
    if (!ev.flag('snow_soup_given')) {
      await ev.say('soup_woman', ['寒かったでしょう。\n獣脂の火で煮たスープよ。\n……あったまるわ。', '瓶に分けておくから、\n旅に持っていって。']);
      X().small(ev, [['i_potion', 2], ['i_potion', 3], ['i_elixir', 1], ['i_elixir', 2]]);
      ev.setFlag('snow_soup_given');
      return;
    }
    await ev.say('soup_woman', cleared(ev) ? '冬至の火のおかげで、\n脂を分け合えるようになったの。\nスープも濃くなったわ。' : '脂は配り切りで、\n大かまどに集めてるの。\n……今年の火は、細いのよね。');
  }, { meta: { needs: [], gives: ['flag:snow_soup_given'] } });

  E('yule_traveler', async (ev) => {
    // ① 寄り道のうわさ
    await ev.say('traveler', ['東の峠の上に、湯気の立つ\n宿があるんだ。「峠の宿」さ。', '山の町への道は崖崩れだが、\n宿までは行ける。']);
    ev.lead('l_opt_pass_inn');
    if (X().skyLine()) await ev.say('traveler', X().skyLine());
  }, { meta: { needs: [], gives: ['lead:l_opt_pass_inn'] } });

  E('yule_tadeo', async (ev) => {
    // ⑦ 近況（地方をまたぐ人物タデオ。STORY_BIBLE §8.10）
    const t = X().tier();
    await ev.say('tadeo', t >= 6 ? ['油が売れなくなってきた。\n……いいことなんだろうな、たぶん。']
      : t >= 4 ? ['灯札？　もらっとくが、\n近ごろ紙の値打ちが怪しくてね。']
        : ['よい灯りを。灯守組合のタデオだ。\nここの灯りは獣脂でね。\n配り切りなんだ。', '油が高いのは、\n大灯火が細ったからさ。']);
  });

  E('yule_woodsman', async (ev) => {
    // ① 手がかり（薪集めの場所）・④ 雪の林の宝箱
    if (cleared(ev)) { await ev.say('villager_m', '倒木を運んでくれて\n助かったよ。今年の薪は\nよく燃える。'); return; }
    await ev.say('villager_m', ['薪なら、雪の林の倒木がいい。\n東の門を出て、峠の道を\n南へ下った所だ。', '倒木は三つの広場に\nひとつずつ。北の広場のは、\n雪男が寝ぐらにしてる。']);
    await ev.say('villager_m', '林の東の小川の先に、\n行商が落とした木箱が\nあるって話もある。');
    ev.lead('l_snow_prep');
  }, { meta: { needs: [], gives: ['lead:l_snow_prep'] } });

  E('yule_oldman', async (ev) => {
    // ⑦ 世代で分かれる記憶（STORY_BIBLE §3.5）・④ 峰の隠し通路のほのめかし
    if (cleared(ev)) { await ev.say('old_m', ['冬至の火が、峰で燃えとる。\nわしの子どものころと\n同じ色じゃ。']); return; }
    await ev.say('old_m', ['わしの祖父の代から、\nずっと夜じゃったよ。', '……いや、戦のころまでは、\nもう少し……。\nはて、何の戦じゃったか。']);
    await ev.say('old_m', ['峰の入口の台地の、西のくぼみ。\n若いころ、あそこの雪の壁を\n抜けたことがある。', '奥に、猟師の隠し倉があった。\n……まだあるかのう。']);
  });

  E('yule_scribe', async (ev) => {
    await ev.say('scribe', ['記録院の布告により、\nこの村の伝承を保護のため\n写し取ります。', '……ご心配なく。写したものは、\n大書庫で大切に保管されます。']);
  });

  E('yule_kid_a', async (ev) => {
    // 秘密基地の合言葉のほのめかし（1）
    if (ev.flag('snow_base_open')) { await ev.say('kid_a', 'ペッカの基地、入れたの？\nいいなあ。'); return; }
    await ev.say('kid_a', ['ペッカの秘密基地に\n入りたいの？　合言葉がいるよ。', '合言葉はね、竜のいちばん\n好きなもの。……あとは、\nナイショ！']);
    ev.lead('q_snow_base');
  }, { meta: { needs: [], gives: ['lead:q_snow_base'] } });
  E('yule_kid_b', async (ev) => {
    // 秘密基地の合言葉のほのめかし（2）・⑦
    if (ev.flag('snow_base_open')) { await ev.say('kid_b', '雪像の庭で、雪合戦しよう！'); return; }
    await ev.say('kid_b', ['竜のいちばん好きなもの？\n火じゃないよ。\n火は、おまけなんだって。', 'イングリッドばあちゃんが、\nそう言ってた！']);
    ev.lead('q_snow_base');
  }, { meta: { needs: [], gives: ['lead:q_snow_base'] } });

  // ---------------------------------------------------------------- 調べる物（町）
  E('yule_hearth', async (ev) => {
    if (cleared(ev)) { await ev.say(null, ['大かまどに、冬至の火が\n高く燃えている。', '火の粉が、峰の方へ\n吸いこまれていく。']); return; }
    if (ev.flag('snow_siege_done')) { await ev.say(null, '大かまどの火は、\n籠城の夜を越えて\nまだ燃えている。'); return; }
    await ev.say(null, ['広場の大かまど。\n獣脂の火が、細く揺れている。', '石の縁に、竜と娘の姿が\n彫りこまれている。']);
  });
  E('yule_pond', async (ev) => {
    if (ev.flag('snow_saw') && !ev.flag('snow_ice_done')) { await ev.call('yule_pond_ice'); return; }
    await ev.say(null, ['凍った池。氷に、\n釣りの穴がいくつも開いている。', '釣り小屋は、池の南の岸だ。']);
  });
  E('yule_north_gate', async (ev) => {
    await ev.say(null, cleared(ev) ? '北の門の先に、白竜の峰が\nくっきりと見える。' : ['北の門。この先の道は、\n白竜の峰へ続いている。', '吹雪の向こうに、峰の影が\nかすかに見える。']);
  });
  E('yule_snowman', async (ev) => {
    const c = ev.choiceOf('ch_snow_statue');
    if (c) { await ev.say(null, { dragon: '雪と氷でできた、竜の像。\n翼が月の光に光っている。', wolf: '雪でできた、狼と猟師の像。\n狼の目に、石がはめてある。', hearth: '雪でできた、大かまどの像。\n中に灯りがともしてある。' }[c]); return; }
    await ev.call('yule_sculptor');
  }, { meta: { calls: ['yule_sculptor'] } });

  // ---------------------------------------------------------------- 屋内: 集会所
  E('yule_hall_hearth', async (ev) => {
    await ev.say(null, cleared(ev) ? '集会所のかまどに、峰から分けた\n火が燃えている。' : ['集会所のかまど。\n大火祭の夜には、ここから\n広場へ火を移すという。']);
  });
  E('yule_nightboard', async (ev) => {
    // 時の証（lo_time_snow）
    await ev.say(null, ['壁に、長い板が掛けてある。\n小さな刻みが、びっしりと\n並んでいる。']);
    await ev.say(null, ['ひと晩にひとつずつ、\n火守りの家が刻んできたらしい。', '……数えると、\n七千三百あまり。\n二十年ぶんだ。']);
    if (ev.flag('snow_finale_done')) await ev.say(null, 'いちばん新しい刻みの横は、\nまだ空いている。');
    await X().lore(ev, 'lo_time_snow');
  }, { meta: { needs: [], gives: ['flag:lo_time_snow'] } });
  E('yule_blank_book', async (ev) => {
    // 記録院の物証（lo_ev_snow）
    await ev.say(null, ['書見台に、革の表紙の本。\n大火祭の物語の本だ。', 'ページをめくる。\n……白い。どのページも、\n真っ白だ。']);
    await ev.say(null, ['最後のページに、薄い字が\n残っている。', '「写本・記録院ノルデン分室」']);
    ev.item('k_blank_book', 1);
    await X().lore(ev, 'lo_ev_snow');
    ev.leadDone('l_snow_book');
    ev.lead('l_main_recorder_snow');
  }, { meta: { needs: [], gives: ['flag:lo_ev_snow', 'item:k_blank_book', 'lead:l_main_recorder_snow'] } });
  E('yule_hall_helper', async (ev) => {
    // ③ 品ぞろえ（祭の間の毛皮の行商）・⑦
    await ev.say('hall_helper', cleared(ev) ? '二日目の祭の料理よ。\nあなたも食べていって！' : ['広場の毛皮の行商、\n祭の間だけ店を出してるの。', '峰へ行くなら、厚い毛皮が\nあると助かるわよ。']);
  });
  E('yule_hall_kid', async (ev) => {
    await ev.say('hall_kid', X().skyLine() || ['朝の鐘って、なんで\n『朝』っていうの？', '……だれも知らないんだって。']);
  });

  // ---------------------------------------------------------------- 屋内: 宿・店・家
  E('yule_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? 'いらっしゃいませ。\n二日目の祭のお客さんで、\n宿は満員よ！' : 'いらっしゃいませ。\n雪あかり亭へようこそ。\n吹雪の夜は、泊まっていって。');
    await ev.inn();
  });
  E('yule_inn_guest', async (ev) => {
    // ① 寄り道のうわさ（つららの回廊）
    await ev.say('inn_guest', ['西の崖に、氷の洞がある。\n「つららの回廊」ってな。', '奥の氷の中に、宝箱が\n閉じこめられてるのが見えた。\n……火でもなけりゃ、取れん。']);
    ev.lead('l_opt_icicle');
  }, { meta: { needs: [], gives: ['lead:l_opt_icicle'] } });
  E('yule_inn_bard', async (ev) => {
    // ① 寄り道のうわさ（オーロラの崖）・近況
    await ev.say('inn_bard', ['凍った湖の向こう、北の流氷原に、\n空が七色に揺れる崖がある。', '今年は湖の氷が薄くて、\n渡れないがね。そり犬なら、\n薄い氷もすべって行けるかも。']);
    ev.lead('l_opt_aurora');
  }, { meta: { needs: [], gives: ['lead:l_opt_aurora'] } });
  E('yule_inn_desk', async (ev) => {
    // 地方をまたぐ連作「ピムの語り部修行」（WORLD §4.9）: 解決した地方の話をピムへ手紙で
    if (ev.flag('forest_pim_poet') && cleared(ev) && !ev.flag('forest_pim_letter_snow')) {
      const i = await ev.choose(['ピムに手紙を書く', 'やめておく'], { cancel: 1, text: '机に、紙と羽ペンがある。' });
      if (i !== 0) return;
      await ev.say(null, ['{hero}は、雪の村の大火祭と、\n峰の白竜のことを書いた。', '宿のおかみが、郵便のそりに\n手紙をのせてくれた。']);
      ev.setFlag('forest_pim_letter_snow');
      ev.addVar('forest_pim_letters', 1);
      return;
    }
    await ev.say(null, '宿の机。紙と羽ペンが\n置いてある。');
  }, { meta: { needs: [], gives: [] } });
  E('yule_item_keeper', async (ev) => {
    await ev.say('item_keeper', '峰へ行くなら、火のつぼを\n持っていくといい。……いらっしゃい。');
    await ev.shop('shop_yule_items');
  });
  E('yule_smith', async (ev) => {
    const low = ev.flag('snow_gate_e_broken');
    await ev.say('smith', low ? ['籠城の夜に、東の倉を\n荒らされてな。いい品が\n残っとらん。', '……それでも、見ていってくれ。'] : 'いらっしゃい。雪原の鍛冶場だ。\n毛皮の裏打ちは、寒さに強いぞ。');
    await ev.shop(low ? 'shop_yule_arms_low' : 'shop_yule_arms');
  });
  E('yule_fur', async (ev) => {
    await ev.say('fur_peddler', '祭の間だけの店だよ。\n雪男の毛皮は、あったかいぞ。');
    await ev.shop('shop_yule_fur');
  });
  E('yule_jorn_ledger', async (ev) => {
    await ev.say(null, ['村長の帳面。\n家ごとの獣脂の割り当てが、\n細かく書いてある。', '「今年は冬至まで、\nどの家も灯りを半分に」']);
  });
  E('yule_jorn_wife', async (ev) => {
    // ⑤ 一度だけの品
    if (!ev.flag('snow_jorn_wife_given')) {
      await ev.say('jorn_wife', ['うちの人が、無理を言ってごめんなさいね。\n……これ、持っていって。', '凍えたときの、とけ薬よ。']);
      ev.item('i_thaw', 2);
      ev.setFlag('snow_jorn_wife_given');
      return;
    }
    await ev.say('jorn_wife', cleared(ev) ? 'あの人、二日目の祭で\n張りきりすぎなのよ。' : '祭の支度で、あの人は\n一睡もしていないの。');
  }, { meta: { needs: [], gives: ['flag:snow_jorn_wife_given'] } });
  E('yule_sonja_fire', async (ev) => {
    await ev.say(null, ['火守りの家のかまど。\n火は、祭の火と同じ種から\n分けられているという。']);
  });
  E('yule_sonja_note', async (ev) => {
    await ev.say(null, ['棚に、古い紙が一枚。\nおばあさんの字だ。', '「朝が来るまで、数えなさい」']);
  });
  E('yule_sonja_gran', async (ev) => {
    // ⑦ 世代で分かれる記憶・ティアの近況
    if (cleared(ev)) { await ev.say('sonja_gran', ['峰の火が、戻ったねえ。\n……あの子に、朝のことを\n話してやらなくちゃ。', 'わたしも、よく\n覚えていないのだけれど。']); return; }
    await ev.say('sonja_gran', ['わたしの母が、板に刻みを\n入れはじめたの。', '「朝が来るまで」と言ってね。\n……朝って、何だったかしら。\nとても明るいものよ、きっと。']);
  });
  E('yule_hunter_bow', async (ev) => {
    await ev.say(null, ['壁に古い弓が掛けてある。\n弦は、狼の毛でよってある。']);
  });
  E('yule_base_in', async (ev) => {
    await ev.say('pekka_in', ['ここは、ぼくたちの基地！\nおとなには、ないしょだよ。', '奥の箱？\n……あげる！　合言葉を\n当てたごほうび！']);
  });
  E('yule_base_drawing', async (ev) => {
    await ev.say(null, ['壁に、炭で描いた絵。\n白い竜と、火を運ぶ娘と、\n本を読む人。', 'その下に、下手な字で\n「ものがたり」と書いてある。']);
  });

  // ---------------------------------------------------------------- ノルデン分室の空き家（記録院の物証の続き・くべられなかった手紙）
  E('yule_branch_desk', async (ev) => {
    if (ev.var('snow_lz')) { await ev.say(null, '机の引き出しは、空だ。'); return; }
    await ev.say(null, ['机の引き出しに、封の切れた\n手紙がひとつ、残っていた。', '宛名は「ミラへ」。\n差出人の名は、ない。']);
    await R.Snow.ev.lz(ev);
  }, { meta: { needs: [], gives: ['var:snow_lz'] } });
  E('yule_branch_shelf', async (ev) => {
    await ev.say(null, ['棚に、写しの帳面が並んでいる。\nどれも表紙だけで、中は白い。', '一冊だけ、書きかけのページがある。\n「祭の本を写した。……村の子に、\n話を聞かせてやれなくなった」']);
    ev.leadDone('l_main_recorder_snow');
  });
})(window.RPG);
