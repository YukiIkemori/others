// CONTENT-F: 隠れ里ユラ（#4）のイベント（WORLD_REDESIGN §5.14・§4.9 の連作「名前を忘れた人々」、STORY_BIBLE §8.10）
//   村人は自分の名前が言えず、役目で呼び合う。地方を 1 つ解決するたびに 1 人が名前を思い出し、故郷へ帰る。
//   縦切りでは 1 人目（粉ひき → エダ、フェルンへ帰る）まで。話す見返り 6 人以上（依頼・ほのめかし・近況・一度だけの品・店・宿）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const cleared = (ev) => ev.flag('cleared_r_forest');

  E('yura_arrival', async (ev) => {
    await ev.caption(R.T('events.yura_arrival.caption'), { ms: 2200 });
    await ev.caption(R.T('events.yura_arrival.caption_2'), { ms: 1800 });
  });

  E('yura_elder', async (ev) => {
    if (!ev.flag('yura_elder_talked')) {
      await ev.say('yura_elder', R.T('events.yura_elder.say'));
      await ev.say('yura_elder', R.T('events.yura_elder.say_2'));
      ev.setFlag('yura_elder_talked');
      ev.lead('q_yura_names');
      return;
    }
    if (cleared(ev) && !ev.flag('yura_miller_home')) {
      await ev.say('yura_elder', R.T('events.yura_elder.say_3'));
      return;
    }
    if (ev.flag('yura_miller_home')) {
      await ev.say('yura_elder', R.T('events.yura_elder.say_4'));
      return;
    }
    await ev.say('yura_elder', R.T('events.yura_elder.say_5'));
  }, { meta: { needs: [], gives: ['lead:q_yura_names', 'flag:yura_elder_talked'] } });

  E('yura_miller', async (ev) => {
    if (cleared(ev) && !ev.flag('yura_miller_home')) {
      await ev.say('yura_miller', R.T('events.yura_miller.say'));
      await ev.say('yura_miller', R.T('events.yura_miller.say_2'));
      ev.setFlag('yura_miller_home');
      await ev.fade('out', 300);
      try { await ev.npc('yura_miller').hide(); } catch (e) { /* */ }
      await ev.fade('in', 300);
      await ev.caption(R.T('events.yura_miller.caption'), { ms: 2200 });
      return;
    }
    await ev.say('yura_miller', R.T('events.yura_miller.say_3'));
  }, { meta: { needs: ['region:r_forest'], gives: ['flag:yura_miller_home'] } });

  E('yura_nanny', async (ev) => {
    // ② ほのめかし（寄り道で先に知れること、STORY_BIBLE §4.5）
    await ev.say('yura_nanny', R.T('events.yura_nanny.say'));
  });

  E('yura_gravekeeper', async (ev) => {
    // ⑦ 近況
    await ev.say('yura_gravekeeper', cleared(ev)
      ? [R.T('events.yura_gravekeeper.say.0')]
      : R.T('events.yura_gravekeeper.say'));
  });

  E('yura_lampkeeper', async (ev) => {
    // ⑤ 一度だけの品（ティアで量が変わる）
    if (!ev.flag('yura_lamp_gift')) {
      await ev.say('yura_lampkeeper', R.T('events.yura_lampkeeper.say'));
      R.ContentF.forest.small(ev, [['i_ether', 1], ['i_ether', 2], ['i_ether2', 1], ['i_ether2', 2]]);
      ev.setFlag('yura_lamp_gift');
      return;
    }
    await ev.say('yura_lampkeeper', R.T('events.yura_lampkeeper.say_2'));
  }, { meta: { needs: [], gives: ['flag:yura_lamp_gift'] } });

  E('yura_child', async (ev) => {
    // ④ ダンジョンの中の隠し通路のほのめかし（千年樹 1 階）
    await ev.say('yura_child', R.T('events.yura_child.say'));
  });

  E('yura_seller', async (ev) => {
    await ev.say('yura_seller', R.T('events.yura_seller.say'));
    await ev.shop('shop_yura');
  });

  E('yura_inn_keeper', async (ev) => {
    await ev.say('yura_innkeeper', R.T('events.yura_inn_keeper.say'));
    await ev.inn();
  });

  E('yura_stone', async (ev) => {
    await ev.say(null, R.T('events.yura_stone.say'));
  });
})(window.RPG);
