// CONTENT-F: 隠れ里ユラ（#4）のイベント（WORLD_REDESIGN §5.14・§4.9 の連作「名前を忘れた人々」、STORY_BIBLE §8.10）
//   村人は自分の名前が言えず、役目で呼び合う。地方を 1 つ解決するたびに 1 人が名前を思い出し、故郷へ帰る。
//   縦切りでは 1 人目（粉ひき → エダ、フェルンへ帰る）まで。話す見返り 6 人以上（依頼・ほのめかし・近況・一度だけの品・店・宿）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const cleared = (ev) => ev.flag('cleared_r_forest');

  E('yura_arrival', async (ev) => {
    await ev.caption('苔むした家々が、\n池を囲んで円を描いている。', { ms: 2200 });
    await ev.caption('……誰も、名を呼び合っていない。', { ms: 1800 });
  });

  E('yura_elder', async (ev) => {
    if (!ev.flag('yura_elder_talked')) {
      await ev.say('yura_elder', ['旅の方か。ここはユラ。\n名を置いてきた者の里じゃ。', 'わしらは皆、自分の名を\n思い出せん。だから役目で\n呼び合っておる。']);
      await ev.say('yura_elder', ['この地の灯りが戻るたび、\n誰かが名を思い出すという\n言い伝えがある。', '……もし、どこかの大灯火を\n灯したなら、また来ておくれ。']);
      ev.setFlag('yura_elder_talked');
      ev.lead('q_yura_names');
      return;
    }
    if (cleared(ev) && !ev.flag('yura_miller_home')) {
      await ev.say('yura_elder', ['森の歌が戻ったな。\n風の匂いでわかる。', '粉ひきが、何か思い出しかけて\nおるようじゃ。話してやっておくれ。']);
      return;
    }
    if (ev.flag('yura_miller_home')) {
      await ev.say('yura_elder', ['粉ひきは、名を思い出して\n森の村へ帰っていった。', '……次は誰かのう。\nわしの番は、いちばん最後で\nよいのじゃが。']);
      return;
    }
    await ev.say('yura_elder', '灯りが戻るたび、\n誰かが名を思い出す。\n……言い伝えじゃよ。');
  }, { meta: { needs: [], gives: ['lead:q_yura_names', 'flag:yura_elder_talked'] } });

  E('yura_miller', async (ev) => {
    if (cleared(ev) && !ev.flag('yura_miller_home')) {
      await ev.say('yura_miller', ['……森の歌が、聞こえたの。\n木の上の家、つり橋、\n粉ひきの小屋……。', 'フェルン。わたし、フェルンの\n粉ひきだった。名前は……\nエダ。そう、エダ！']);
      await ev.say('yura_miller', '帰らなきゃ。\n待ってる人がいるかもしれない。\n……ありがとう、旅の方。');
      ev.setFlag('yura_miller_home');
      await ev.fade('out', 300);
      try { await ev.npc('yura_miller').hide(); } catch (e) { /* */ }
      await ev.fade('in', 300);
      await ev.caption('粉ひきのエダは、\n森の村フェルンへ帰っていった。', { ms: 2200 });
      return;
    }
    await ev.say('yura_miller', ['粉を挽く音を聞くと、\nどこか懐かしいの。', '木の上に家があって……\nつり橋が揺れて……。\n……だめ、思い出せない。']);
  }, { meta: { needs: ['region:r_forest'], gives: ['flag:yura_miller_home'] } });

  E('yura_nanny', async (ev) => {
    // ② ほのめかし（寄り道で先に知れること、STORY_BIBLE §4.5）
    await ev.say('yura_nanny', ['子守唄を歌うとね、\nいつも灰色のマントの\n女の子が聞きに来るの。', '名前を聞くと、笑って\n「わたしは、古いお話よ」って。\n……へんな子。']);
  });

  E('yura_gravekeeper', async (ev) => {
    // ⑦ 近況
    await ev.say('yura_gravekeeper', cleared(ev)
      ? ['森の歌が戻ったそうだね。\n墓の苔まで、光って見えるよ。']
      : ['墓守をしている。\n墓石には、名前が無いんだ。', '名を置いてきた者は、\n名の無いまま眠る。\n……さびしいことさ。']);
  });

  E('yura_lampkeeper', async (ev) => {
    // ⑤ 一度だけの品（ティアで量が変わる）
    if (!ev.flag('yura_lamp_gift')) {
      await ev.say('yura_lampkeeper', ['灯守だよ。池のまわりの灯籠を\n守ってる。', '旅の人が来るのは久しぶりだ。\nこれ、持っておいき。']);
      R.ContentF.forest.small(ev, [['i_ether', 1], ['i_ether', 2], ['i_ether2', 1], ['i_ether2', 2]]);
      ev.setFlag('yura_lamp_gift');
      return;
    }
    await ev.say('yura_lampkeeper', '灯りを絶やさないこと。\nそれだけは、忘れずに\n覚えていられるんだ。');
  }, { meta: { needs: [], gives: ['flag:yura_lamp_gift'] } });

  E('yura_child', async (ev) => {
    // ④ ダンジョンの中の隠し通路のほのめかし（千年樹 1 階）
    await ev.say('yura_child', ['千年樹の中にね、\n風の鳴る壁があるんだって。', '西の回廊の、いちばん西。\n……だれに聞いたか、\nわすれちゃった。']);
  });

  E('yura_seller', async (ev) => {
    await ev.say('yura_seller', '森の灯りで、品が変わるの。\n……どこで仕入れたのかは、\n覚えていないけれど。');
    await ev.shop('shop_yura');
  });

  E('yura_inn_keeper', async (ev) => {
    await ev.say('yura_innkeeper', 'ようこそ。名は聞かないよ。\nここは、そういう宿だから。');
    await ev.inn();
  });

  E('yura_stone', async (ev) => {
    await ev.say(null, ['池のほとりの、苔むした石。\n表面が、名前を削り取った\nように平らになっている。', 'そばに、小さな字で\n「名は、呼ばれるためにある」\nと刻まれている。']);
  });
})(window.RPG);
