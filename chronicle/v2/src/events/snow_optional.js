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
    await ev.caption(R.T('events.icicle_arrive.caption'), { ms: 2400 });
    ev.leadDone('l_opt_icicle');
  });
  E('icicle_2_arrive', async (ev) => {
    await ev.caption(R.T('events.icicle_2_arrive.caption'), { ms: 2200 });
  });
  E('icicle_frozen', async (ev, ctx) => {
    const o = objAt(ctx, 'icicle_frozen');
    const n = (o && o.box) || 1;
    const f = 'snow_icicle_box_' + n;
    if (ev.flag(f)) { await ev.say(null, R.T('events.icicle_frozen.say')); return; }
    await ev.say(null, R.T('events.icicle_frozen.say_2'));
    const fire = ev.has('k_winter_flame') || ev.has('k_yule_ember');
    if (fire) {
      await ev.say(null, R.T('events.icicle_frozen.say_3'));
    } else if (ev.has('i_firepot')) {
      const i = await ev.choose(R.T('events.icicle_frozen.i.choose'), { cancel: 1, text: R.T('events.icicle_frozen.i.choose.text') });
      if (i !== 0) return;
      ev.take('i_firepot', 1);
      await ev.say(null, R.T('events.icicle_frozen.say_4'));
    } else {
      await ev.say(null, R.T('events.icicle_frozen.say_5'));
      return;
    }
    ev.sfx('fire');
    ev.setFlag(f);
  }, { meta: { needs: [], gives: ['flag:snow_icicle_box_1', 'flag:snow_icicle_box_2'] } });
  E('icicle_guard', async (ev) => {
    if (ev.flag('snow_icicle_guard')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.icicle_guard.say'));
    const r = await ev.battle('tr_icicle_guard', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('snow_icicle_guard');
    await ev.say(null, R.T('events.icicle_guard.say_2'));
  }, { meta: { needs: [], gives: ['flag:snow_icicle_guard'] } });
  E('icicle_seal', async (ev) => {
    await ev.say(null, R.T('events.icicle_seal.say'));
  });

  // ================================================================ #14 峠の宿
  E('pass_inn_arrive', async (ev) => {
    ev.leadDone('l_opt_pass_inn');
    if (ev.flag('pass_inn_seen')) return;
    ev.setFlag('pass_inn_seen');
    await ev.caption(R.T('events.pass_inn_arrive.caption'), { ms: 2200 });
  });
  E('pass_inn_innkeeper', async (ev) => {
    await ev.say('pass_inn_innkeeper', R.T('events.pass_inn_innkeeper.say'));
    await ev.inn();
  });
  E('pass_inn_shopkeeper', async (ev) => {
    await ev.say('pass_shop', R.T('events.pass_inn_shopkeeper.say'));
    await ev.shop('shop_pass_inn');
  });
  E('pass_inn_board', async (ev) => {
    await ev.say(null, R.T('events.pass_inn_board.say'));
    ev.lead('q_pass_bath');
  }, { meta: { needs: [], gives: ['lead:q_pass_bath'] } });
  E('pass_inn_bath_keeper', async (ev) => {
    if (ev.flag('pass_inn_bath_done')) { await ev.say('bath_keeper', R.T('events.pass_inn_bath_keeper.say')); return; }
    await ev.say('bath_keeper', R.T('events.pass_inn_bath_keeper.say_2'));
    ev.lead('q_pass_bath');
    if (!ev.has('i_firepot')) return;
    const i = await ev.choose(R.T('events.pass_inn_bath_keeper.i.choose'), { cancel: 1 });
    if (i !== 0) return;
    ev.take('i_firepot', 1);
    ev.setFlag('pass_inn_bath_done');
    ev.leadDone('q_pass_bath');
    await ev.say('bath_keeper', R.T('events.pass_inn_bath_keeper.say_3'));
    ev.item('ac_ward_freeze', 1);
    X().small(ev, [['i_ether', 1], ['i_ether', 2], ['i_ether2', 1], ['i_ether2', 2]]);
  }, { meta: { needs: [], gives: ['flag:pass_inn_bath_done', 'lead:q_pass_bath'] } });
  E('pass_inn_bath_pool', async (ev) => {
    if (!ev.flag('pass_inn_bath_done')) { await ev.say(null, R.T('events.pass_inn_bath_pool.say')); return; }
    await ev.say(null, R.T('events.pass_inn_bath_pool.say_2'));
    ev.rest();
    ev.sfx('spring');
  });
  E('pass_inn_scout', async (ev) => {
    // ⑦ 近況（山地の峠は閉じている）
    await ev.say('pass_inn_scout', R.T('events.pass_inn_scout.say'));
  });
  E('pass_inn_fox_man', async (ev) => {
    // ④ レア魔物の巣のほのめかし
    await ev.say('pass_inn_fox_man', R.T('events.pass_inn_fox_man.say'));
    ev.lead('l_opt_aurora');
  }, { meta: { needs: [], gives: ['lead:l_opt_aurora'] } });
  // 峠の宿のうわさの 3 人（WORLD §3.3。ほかの地方の事件を 2〜3 件。雪原の近い地方ほど詳しく）
  E('pass_inn_rumor_gossip', async (ev) => {
    await ev.say('rumor_gossip', R.T('events.pass_inn_rumor_gossip.say'));
    ev.lead('l_rumor_forest');
    await ev.say('rumor_gossip', R.T('events.pass_inn_rumor_gossip.say_2'));
    ev.lead('l_rumor_marsh');
  }, { meta: { needs: [], gives: ['lead:l_rumor_forest', 'lead:l_rumor_marsh'] } });
  E('pass_inn_rumor_bard', async (ev) => {
    await ev.say('rumor_bard', R.T('events.pass_inn_rumor_bard.say'));
    ev.lead('l_opt_frost_ship');
    await ev.say('rumor_bard', R.T('events.pass_inn_rumor_bard.say_2'));
    ev.lead('l_rumor_ash');
  }, { meta: { needs: [], gives: ['lead:l_opt_frost_ship', 'lead:l_rumor_ash'] } });
  E('pass_inn_rumor_merchant', async (ev) => {
    await ev.say('rumor_merchant', R.T('events.pass_inn_rumor_merchant.say'));
    ev.lead('l_rumor_mine');
    await ev.say('rumor_merchant', R.T('events.pass_inn_rumor_merchant.say_2'));
    ev.lead('l_rumor_desert');
  }, { meta: { needs: [], gives: ['lead:l_rumor_mine', 'lead:l_rumor_desert'] } });

  // ================================================================ #12 オーロラの崖
  E('aurora_arrive', async (ev) => {
    ev.leadDone('l_opt_aurora');
    await ev.caption(R.T('events.aurora_arrive.caption'), { ms: 2400 });
  });
  E('aurora_view', async (ev) => {
    if (X().cleared(ev)) {
      await ev.caption(R.T('events.aurora_view.caption'), { ms: 3200 });
    } else {
      await ev.caption(R.T('events.aurora_view.caption_2'), { ms: 2600 });
    }
    if (!ev.flag('snow_aurora_seen')) { ev.setFlag('snow_aurora_seen'); await ev.caption(R.T('events.aurora_view.caption_3'), { ms: 2000 }); }
  }, { meta: { needs: [], gives: ['flag:snow_aurora_seen'] } });
  E('aurora_legend', async (ev) => {
    await ev.say(null, R.T('events.aurora_legend.say'));
    await X().lore(ev, 'lo_aurora_legend');
  }, { meta: { needs: [], gives: ['flag:lo_aurora_legend'] } });

  // ================================================================ #13 氷に閉じた帆船
  E('frost_ship_arrive', async (ev) => {
    if (ev.flag('snow_admiral')) return;
    await ev.caption(R.T('events.frost_ship_arrive.caption'), { ms: 2600 });
    await ev.caption(R.T('events.frost_ship_arrive.caption_2'), { ms: 2400 });
  });
  E('frost_ship_log', async (ev) => {
    await ev.say(null, R.T('events.frost_ship_log.say'));
  });
  E('frost_ship_chart', async (ev) => {
    await ev.say(null, [R.T('events.frost_ship_chart.say.0'), ev.flag('snow_admiral') ? R.T('events.frost_ship_chart.say.1') : R.T('events.frost_ship_chart.say.1_2')]);
  });
  E('frost_ship_boss', async (ev) => {
    if (ev.flag('snow_admiral')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.frost_ship_boss.say'));
    await ev.say('admiral', R.T('events.frost_ship_boss.say_2'), { name: R.T('events.frost_ship_boss.say.name'), face: false });
    const i = await ev.choose(R.T('events.frost_ship_boss.i.choose'), { cancel: 1, text: R.T('events.frost_ship_boss.i.choose.text') });
    if (i !== 0) { ev.mapBgm(); await ev.say(null, R.T('events.frost_ship_boss.say_3')); return; }
    const r = await ev.battle('tr_b_frost_admiral', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('snow_admiral');
    ev.leadDone('l_opt_frost_ship');
    await ev.say(null, R.T('events.frost_ship_boss.say_4'));
  }, { meta: { needs: [], gives: ['flag:snow_admiral'] } });
})(window.RPG);
