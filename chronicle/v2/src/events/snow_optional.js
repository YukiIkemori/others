// 雪原の寄り道の場所のイベント（WORLD_REDESIGN §2.7 #11〜#14・§2.8・§4.11、V2_PLAN §2.6.1）
//   #11 つららの回廊: 氷に閉じこめられた宝箱（火のつぼ 1 つか、冬至の火の火種でとかす）・つらら番（暗がりの奥）・封じの扉（宝の地図 その2。縦切りの外）
//   #14 峠の宿: 宿・売店・うわさの 3 人（ほかの地方の事件）・湯の番の依頼（q_pass_bath）
//   #12 オーロラの崖: 景色（オーロラ）・前の世の伝説の書き付け・氷尾ギツネとオーロラ鳥の巣
//   #13 氷に閉じた帆船: 隠しボス 氷の船団長（強さ固定。看板とうわさで「危険」）→ 凍えの羅針盤
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Snow.ev;
  const objAt = (ctx, event) => { const m = R.DB.maps[ctx && ctx.map]; return m && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };

  // ================================================================ #11 つららの回廊
  E('icicle_arrive', async (ev) => {
    await ev.caption('つららの回廊。\n天井から、青い氷の刃が\n無数に垂れ下がっている。', { ms: 2400 });
    ev.leadDone('l_opt_icicle');
  });
  E('icicle_2_arrive', async (ev) => {
    await ev.caption('暗い。\n火皿に火をともせば、\nあたりが見えるはずだ。', { ms: 2200 });
  });
  E('icicle_frozen', async (ev, ctx) => {
    const o = objAt(ctx, 'icicle_frozen');
    const n = (o && o.box) || 1;
    const f = 'snow_icicle_box_' + n;
    if (ev.flag(f)) { await ev.say(null, 'とけた氷の向こうに、\n宝箱が見える。'); return; }
    await ev.say(null, '分厚い氷の中に、宝箱が\n閉じこめられている。');
    const fire = ev.has('k_winter_flame') || ev.has('k_yule_ember');
    if (fire) {
      await ev.say(null, '冬至の火をかざすと、\n氷はみるみるとけていった。');
    } else if (ev.has('i_firepot')) {
      const i = await ev.choose(['火のつぼを使う', 'やめておく'], { cancel: 1, text: '火のつぼでとかす？' });
      if (i !== 0) return;
      ev.take('i_firepot', 1);
      await ev.say(null, '火のつぼを投げつけた。\n炎が氷をなめ、とかしていく。');
    } else {
      await ev.say(null, '火がなければ、\nとかせそうにない。\n（火のつぼなら、どうだろう）');
      return;
    }
    ev.sfx('fire');
    ev.setFlag(f);
  }, { meta: { needs: [], gives: ['flag:snow_icicle_box_1', 'flag:snow_icicle_box_2'] } });
  E('icicle_guard', async (ev) => {
    if (ev.flag('snow_icicle_guard')) return;
    ev.bgm('omen');
    await ev.say(null, '天井のつららが、ひとりでに\n落ちてきた。……いや、\n動いている！');
    const r = await ev.battle('tr_icicle_guard', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('snow_icicle_guard');
    await ev.say(null, 'つらら番たちは、砕けて\n床に散らばった。');
  }, { meta: { needs: [], gives: ['flag:snow_icicle_guard'] } });
  E('icicle_seal', async (ev) => {
    await ev.say(null, ['古い紋の扉。羽ペンの形の紋が\n彫られている。', '押しても引いても、開かない。\n……何かの鍵が要るのだろうか。']);
  });

  // ================================================================ #14 峠の宿
  E('pass_inn_arrive', async (ev) => {
    ev.leadDone('l_opt_pass_inn');
    if (ev.flag('pass_inn_seen')) return;
    ev.setFlag('pass_inn_seen');
    await ev.caption('峠の宿。\n湯気が、夜空に白く立ちのぼっている。', { ms: 2200 });
  });
  E('pass_inn_innkeeper', async (ev) => {
    await ev.say('pass_inn_innkeeper', 'いらっしゃいませ。\n峠の宿へようこそ。\n湯と寝床は、どちらも温かいよ。');
    await ev.inn();
  });
  E('pass_inn_shopkeeper', async (ev) => {
    await ev.say('pass_shop', '峠越えの支度なら、\nここでそろうよ。');
    await ev.shop('shop_pass_inn');
  });
  E('pass_inn_board', async (ev) => {
    await ev.say(null, ['宿の掲示板。', '「湯のくみ口、凍結中。\n火のつぼを求む。――湯の番」\n「山の町への峠、崖崩れで不通」']);
    ev.lead('q_pass_bath');
  }, { meta: { needs: [], gives: ['lead:q_pass_bath'] } });
  E('pass_inn_bath_keeper', async (ev) => {
    if (ev.flag('pass_inn_bath_done')) { await ev.say('bath_keeper', '湯殿は、いつでも入れるよ。\n峠の湯は、よくあったまる。'); return; }
    await ev.say('bath_keeper', ['湯殿のくみ口が凍っちまってな。\n湯が引けないんだ。', '火のつぼがひとつあれば、\nとかせるんだが……。']);
    ev.lead('q_pass_bath');
    if (!ev.has('i_firepot')) return;
    const i = await ev.choose(['火のつぼを渡す', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    ev.take('i_firepot', 1);
    ev.setFlag('pass_inn_bath_done');
    ev.leadDone('q_pass_bath');
    await ev.say('bath_keeper', ['助かった！　これで湯が引ける。', '礼だ。湯殿の奥にしまってた\n霜よけのお守りさ。']);
    ev.item('ac_ward_freeze', 1);
    X().small(ev, [['i_ether', 1], ['i_ether', 2], ['i_ether2', 1], ['i_ether2', 2]]);
  }, { meta: { needs: [], gives: ['flag:pass_inn_bath_done', 'lead:q_pass_bath'] } });
  E('pass_inn_bath_pool', async (ev) => {
    if (!ev.flag('pass_inn_bath_done')) { await ev.say(null, '湯殿のくみ口。\n氷でふさがっている。'); return; }
    await ev.say(null, '湯殿の湯に、肩までつかった。\n……体の芯まで、あたたまる。');
    ev.rest();
    ev.sfx('spring');
  });
  E('pass_inn_scout', async (ev) => {
    // ⑦ 近況（山地の峠は閉じている）
    await ev.say('pass_inn_scout', ['この先の峠は、崖崩れで\n山の町へ抜けられない。', 'ユールの冬至の火が戻ったら、\n雪もゆるむんだがな。']);
  });
  E('pass_inn_fox_man', async (ev) => {
    // ④ レア魔物の巣のほのめかし
    await ev.say('pass_inn_fox_man', ['氷尾ギツネの毛皮を\n探してるんだが、なかなかでね。', 'あいつらの巣は、北の流氷原の\nオーロラの崖らしい。\n凍った湖の向こうさ。']);
    ev.lead('l_opt_aurora');
  }, { meta: { needs: [], gives: ['lead:l_opt_aurora'] } });
  // 峠の宿のうわさの 3 人（WORLD §3.3。ほかの地方の事件を 2〜3 件。雪原の近い地方ほど詳しく）
  E('pass_inn_rumor_gossip', async (ev) => {
    await ev.say('rumor_gossip', ['西の森の村フェルンで、\nきこりが三人帰らなかったんだって。', '……もう見つかったって\n話も聞いたけどね。']);
    ev.lead('l_rumor_forest');
    await ev.say('rumor_gossip', '東の湿原の町では、霧の中で\n子どもが消えるそうよ。\nこわいわねえ。');
    ev.lead('l_rumor_marsh');
  }, { meta: { needs: [], gives: ['lead:l_rumor_forest', 'lead:l_rumor_marsh'] } });
  E('pass_inn_rumor_bard', async (ev) => {
    await ev.say('rumor_bard', ['流氷原の氷の中に、帆柱が\n立っているのを見たかい？', '百年帰らぬ船団の長が、\nいまも港を探しているそうだ。\n……近づかないほうがいい。']);
    ev.lead('l_opt_frost_ship');
    await ev.say('rumor_bard', '南の灰の荒野では、火の鳥の\n卵が冷えていくってさ。');
    ev.lead('l_rumor_ash');
  }, { meta: { needs: [], gives: ['lead:l_opt_frost_ship', 'lead:l_rumor_ash'] } });
  E('pass_inn_rumor_merchant', async (ev) => {
    await ev.say('rumor_merchant', ['峠の向こうの鉱山町ドヴァンじゃ、\n坑道の奥から鉄の番人が\n出たそうだ。', '崖崩れがなければ、\n品を運べるんだがなあ。']);
    ev.lead('l_rumor_mine');
    await ev.say('rumor_merchant', '南の砂漠のカシムでは、\n隊商の護衛を探してるとか。');
    ev.lead('l_rumor_desert');
  }, { meta: { needs: [], gives: ['lead:l_rumor_mine', 'lead:l_rumor_desert'] } });

  // ================================================================ #12 オーロラの崖
  E('aurora_arrive', async (ev) => {
    ev.leadDone('l_opt_aurora');
    await ev.caption('北の流氷原、オーロラの崖。\n氷の海が、どこまでも続いている。', { ms: 2400 });
  });
  E('aurora_view', async (ev) => {
    if (X().cleared(ev)) {
      await ev.caption('空いっぱいに、オーロラが揺れる。\n緑と、薄紅と、青。\n冬至の火が、峰で燃えている。', { ms: 3200 });
    } else {
      await ev.caption('吹雪の切れ間に、\nほんの一瞬、空が七色に揺れた。', { ms: 2600 });
    }
    if (!ev.flag('snow_aurora_seen')) { ev.setFlag('snow_aurora_seen'); await ev.caption('崖のあたりで、光る鳥の\n羽ばたきが聞こえた気がした。', { ms: 2000 }); }
  }, { meta: { needs: [], gives: ['flag:snow_aurora_seen'] } });
  E('aurora_legend', async (ev) => {
    await ev.say(null, ['崖の石に、古い書き付けが\n彫られている。', '「光の紋章を掲げた三人が、\n北の果ての空の下を越えていった」', '……ずっと昔の、\n別の大陸の話らしい。']);
    await X().lore(ev, 'lo_aurora_legend');
  }, { meta: { needs: [], gives: ['flag:lo_aurora_legend'] } });

  // ================================================================ #13 氷に閉じた帆船
  E('frost_ship_arrive', async (ev) => {
    if (ev.flag('snow_admiral')) return;
    await ev.caption('氷に閉じこめられた帆船。\n甲板に、凍りついた水兵の\n影が並んでいる。', { ms: 2600 });
    await ev.caption('――強い魔物の気配がする。\n無理をせず、引き返してもいい。', { ms: 2400 });
  });
  E('frost_ship_log', async (ev) => {
    await ev.say(null, ['凍った航海日誌。', '「北の港へ帰る。冬至までに。\n……氷が来る。帆を下ろせ」', '日付の欄は、百年前だ。']);
  });
  E('frost_ship_chart', async (ev) => {
    await ev.say(null, ['船長室の卓に、海図。\n北の果ての港に、丸がつけてある。', ev.flag('snow_admiral') ? '海図の上に、凍えの羅針盤の\n跡が残っている。' : '羅針盤の置き場が、空いている。']);
  });
  E('frost_ship_boss', async (ev) => {
    if (ev.flag('snow_admiral')) return;
    ev.bgm('omen');
    await ev.say(null, ['船長室の氷が、きしんだ。', '霜をまとった船長が、\nゆっくりと立ち上がる。']);
    await ev.say('admiral', ['……港は、まだか。\n帰らねば……冬至までに……。', '邪魔をするな。\nこの船は、誰にも渡さん！'], { name: '氷の船団長', face: false });
    const i = await ev.choose(['戦う', '引き返す'], { cancel: 1, text: '――強い魔物だ。戦う？' });
    if (i !== 0) { ev.mapBgm(); await ev.say(null, '{hero}たちは、そっと\n船長室から離れた。'); return; }
    const r = await ev.battle('tr_b_frost_admiral', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('snow_admiral');
    ev.leadDone('l_opt_frost_ship');
    await ev.say(null, ['船団長の体から、氷がはがれ落ちた。', '「……ああ。港の灯が、\n見える……」', '男は、灯りの中に\n溶けるように消えた。']);
  }, { meta: { needs: [], gives: ['flag:snow_admiral'] } });
})(window.RPG);
