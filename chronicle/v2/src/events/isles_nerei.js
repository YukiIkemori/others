// CONTENT（マレア諸島）: 岬の村ネレイ（WORLD_REDESIGN §4.5 の流れ 5・6・§5.9、STORY_BIBLE §7.5・§8.6・§11.8）。
//   マリナ（待つ人。本物の朝の証人）: 舟歌の前半しか覚えていない。朝日の色の話（lo_time_isles、3 行）。
//     人魚の歌う岩で後半の節を聞いていれば、その場で最後まで歌える（v_marina_nerei_01・待つ人のくし）。
//     聞いていなければ、マリナが思い出すまで一晩（村の宿で 1 泊）→ 翌朝、思い出す（v_marina_nerei_01）。
//   岬の先: マリナが歌う前に行くと、灰色のマントの少女（v_fine_isles_01、録音の文のまま）。
//   夜の桟橋: 海図の海域が絞れていて、外洋船があれば、マリナが歌う（v_marina_pier_01）→ 霧 → 自分の船で霧の中へ（幽霊船）。
//   灯り守り: 岬の灯と灯台島の灯（【灯りを守る】灯台の油）・記録官の小舟の話（本筋の手がかり）。雑貨屋（組合の配達の届け先）・宿（一晩）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Isles.ev;
  const cleared = (ev) => ev.flag('cleared_r_isles');
  const MARINA = { name: R.T('ev.isles_nerei.MARINA.name') }, FINE = { name: R.T('ev.isles_nerei.FINE.name') };

  E('nerei_arrival', async (ev) => {
    if (ev.flag('isles_nerei_seen')) return;
    ev.setFlag('isles_nerei_seen');
    await ev.caption(R.T('events.nerei_arrival.caption'), { ms: 2600 });
  });

  // ---------------------------------------------------------------- マリナ
  E('nerei_marina', async (ev) => {
    const x = X();
    if (cleared(ev)) { await ev.call('nerei_marina_after'); return; }
    if (!ev.flag('isles_marina_met')) {
      ev.setFlag('isles_marina_met');
      await ev.say('marina', R.T('events.nerei_marina.say'), MARINA);
      await ev.say('marina', R.T('events.nerei_marina.say_2'), MARINA);
      await ev.say('marina', R.T('events.nerei_marina.say_3'), MARINA);
      await ev.say('marina', R.T('events.nerei_marina.say_4'), MARINA);
      await ev.say('marina', R.T('events.nerei_marina.say_5'), MARINA);
      await x.lore(ev, 'lo_time_isles');
      await ev.say('marina', R.T('events.nerei_marina.say_6'), MARINA);
      await ev.caption(x.SHANTY_A, { ms: 3200 });
      await ev.say('marina', R.T('events.nerei_marina.say_7'), MARINA);
      ev.leadDone('l_isles_song');
      ev.lead('l_isles_fog');
    }
    if (!ev.flag('isles_song_ready')) {
      if (ev.flag('isles_siren_heard')) { await ev.call('isles_marina_remember_siren'); return; }
      if (ev.flag('isles_marina_night')) { await ev.call('isles_marina_remember'); return; }
      await ev.say('marina', R.T('events.nerei_marina.say_8'), MARINA);
      return;
    }
    if (!ev.flag('isles_song_done')) {
      if (ev.flag('isles_fog_found') && ev.flag('isles_ship')) { await ev.call('isles_night_pier'); return; }
      await ev.say('marina', R.T('events.nerei_marina.say_9'), MARINA);
      return;
    }
    await ev.say('marina', R.T('events.nerei_marina.say_10'), MARINA);
  }, { meta: { needs: [], gives: ['flag:isles_marina_met', 'lore:lo_time_isles', 'lead:l_isles_fog'], calls: ['isles_marina_remember_siren', 'isles_marina_remember', 'isles_night_pier', 'nerei_marina_after'] } });
  // 岩の節を聞いていた → その場で最後まで歌える（対の品: 待つ人のくし）
  E('isles_marina_remember_siren', async (ev) => {
    if (ev.flag('isles_song_ready')) return;
    await ev.say(null, R.T('events.isles_marina_remember_siren.say'));
    await ev.caption(X().SHANTY_B, { ms: 3200 });
    await ev.call('isles_marina_this_song');
    await ev.say('marina', R.T('events.isles_marina_remember_siren.say_3'), MARINA);
    await ev.say('marina', R.T('events.isles_marina_remember_siren.say_4'), MARINA);
    ev.item('u_shore_comb', 1);
    ev.setFlag('isles_song_ready');
    await X().lore(ev, 'lo_isles_shanty');
  }, { meta: { needs: ['flag:isles_siren_heard', 'flag:isles_marina_met'], gives: ['flag:isles_song_ready', 'item:u_shore_comb', 'lore:lo_isles_shanty'], calls: ['isles_marina_this_song'] } });
  // 「……ああ、この歌だよ。」（録音の 1 行。岩の節の道と一晩の道のどちらからも、ここ 1 か所で流す）
  E('isles_marina_this_song', async (ev) => {
    await ev.say('marina', R.T('events.isles_marina_remember.say_2'), Object.assign({ voice: 'v_marina_nerei_01' }, MARINA));
  });
  // 一晩待った → 翌朝、思い出す
  E('isles_marina_remember', async (ev) => {
    if (ev.flag('isles_song_ready')) return;
    await ev.say('marina', R.T('events.isles_marina_remember.say'), MARINA);
    await ev.caption(X().SHANTY_B, { ms: 3200 });
    await ev.call('isles_marina_this_song');
    ev.setFlag('isles_song_ready');
    await X().lore(ev, 'lo_isles_shanty');
  }, { meta: { needs: ['flag:isles_marina_night'], gives: ['flag:isles_song_ready', 'lore:lo_isles_shanty'], calls: ['isles_marina_this_song'] } });

  // ---------------------------------------------------------------- 夜の桟橋（マリナが歌う → 霧 → 自分の船で霧の中へ）
  E('isles_night_pier', async (ev) => {
    if (ev.flag('isles_song_done')) return;
    await ev.say('marina', R.T('events.isles_night_pier.say'), MARINA);
    await ev.fade('out', 700);
    await ev.caption(R.T('events.isles_night_pier.caption'), { ms: 1800 });
    ev.setFlag('isles_song_scene');
    await ev.warp('nerei', 'pier');
    ev.bgm('ghost');
    await ev.say(null, R.T('events.isles_night_pier.say_2'));
    ev.sfx('bell');
    await ev.caption(X().SHANTY_A, { ms: 3200 });
    await ev.caption(X().SHANTY_B, { ms: 3200 });
    try { R.Field.flash && R.Field.flash('#9fc8ff', 500); } catch (e) { /* */ }
    await ev.say(null, R.T('events.isles_night_pier.say_3'));
    await ev.say('marina_pier', R.T('events.isles_night_pier.say_4'), Object.assign({ voice: 'v_marina_pier_01' }, MARINA));
    await ev.say('marina_pier', R.T('events.isles_night_pier.say_5'), MARINA);
    ev.setFlag('isles_song_done');
    ev.setFlag('isles_fog_open');
    await ev.fade('out', 600);
    ev.sfx('ship');
    await ev.caption(R.T('events.isles_night_pier.caption_2'), { ms: 2600 });
    ev.setFlag('isles_song_scene', false);
    await ev.warp('ghost_ship_1', 'board');
  }, { meta: { needs: ['flag:isles_song_ready', 'flag:isles_fog_found', 'flag:isles_ship'], gives: ['flag:isles_song_done', 'flag:isles_fog_open'], warp: { to: 'ghost_ship_1', spawn: 'board' } } });

  // ---------------------------------------------------------------- 岬の先（灰色のマントの少女。マリナが歌う前）
  E('isles_fine_cape', async (ev) => {
    if (ev.flag('isles_fine_seen') || ev.flag('isles_song_done') || !ev.flag('isles_marina_met')) return;
    R.Audio && R.Audio.pushBgm && R.Audio.pushBgm('fine_theme');
    try {
      await ev.say(null, R.T('events.isles_fine_cape.say'));
      await ev.say('fine', R.T('events.isles_fine_cape.say_2'), Object.assign({ voice: 'v_fine_isles_01' }, FINE));
      const t = Math.min(7, X().tier());
      if (t >= 3) await ev.caption(R.T('events.isles_fine_cape.caption'), { ms: 1800 });
      ev.sfx('magic');
      ev.setFlag('isles_fine_seen');
      try { await ev.leave('fine', { ms: 900 }); } catch (e) { /* */ }
      await ev.caption(R.T('events.isles_fine_cape.caption_2'), { ms: 2000 });
    } finally { R.Audio && R.Audio.popBgm && R.Audio.popBgm(); }
  }, { meta: { needs: ['flag:isles_marina_met'], gives: ['flag:isles_fine_seen'] } });
  E('nerei_cape_lamp', async (ev) => {
    if (cleared(ev)) { await ev.say(null, R.T('events.nerei_cape_lamp.say')); return; }
    await ev.say(null, R.T('events.nerei_cape_lamp.say_2'));
  });

  // ---------------------------------------------------------------- 解決の後のマリナ（潮騒の耳飾り）
  E('nerei_marina_after', async (ev) => {
    if (!ev.flag('isles_reward_given')) {
      ev.setFlag('isles_reward_given');
      await ev.say('marina', R.T('events.nerei_marina_after.say'), MARINA);
      await ev.say('marina', R.T('events.nerei_marina_after.say_2'), MARINA);
      ev.item('ac_tale_isles', 1);
      return;
    }
    const t = X().tier();
    await ev.say('marina', t >= 6 ? R.T('events.nerei_marina_after.say_3')
      : R.T('events.nerei_marina_after.say_4'), MARINA);
  }, { meta: { needs: ['flag:cleared_r_isles'], gives: ['flag:isles_reward_given', 'item:ac_tale_isles'] } });
  E('nerei_marina_shelf', async (ev) => {
    await ev.say(null, ev.flag('isles_ink_given') ? R.T('events.nerei_marina_shelf.say')
      : R.T('events.nerei_marina_shelf.say_2'));
  });

  // ---------------------------------------------------------------- 灯り守り（岬の灯・灯台島の灯・記録官の小舟）
  E('nerei_lampkeeper', async (ev) => {
    if (cleared(ev)) { await ev.say('lampkeeper', R.T('events.nerei_lampkeeper.say')); return; }
    if (!ev.flag('isles_light_on')) {
      ev.setFlag('isles_light_on');
      await ev.say('lampkeeper', R.T('events.nerei_lampkeeper.say_2'));
      await ev.say('lampkeeper', R.T('events.nerei_lampkeeper.say_3'));
      ev.item('k_lamp_oil', 1);
      ev.lead('q_isles_light');
      await ev.say('lampkeeper', R.T('events.nerei_lampkeeper.say_4'));
      ev.lead('l_main_recorder_isles');
      return;
    }
    await ev.say('lampkeeper', ev.flag('isles_light_lit') ? R.T('events.nerei_lampkeeper.say_5') : R.T('events.nerei_lampkeeper.say_6'));
  }, { meta: { needs: [], gives: ['item:k_lamp_oil', 'lead:q_isles_light', 'lead:l_main_recorder_isles'] } });

  // ---------------------------------------------------------------- 雑貨屋（組合の配達の届け先）・宿（一晩）
  E('nerei_store_keeper', async (ev) => {
    if (ev.has('k_guild_parcel')) {
      await ev.say('store_keeper', R.T('events.nerei_store_keeper.say'));
      ev.take('k_guild_parcel', 1);
      ev.setFlag('isles_delivery_done');
      ev.leadDone('q_isles_delivery');
      ev.gold(150 + 50 * X().tier());
      await ev.say('store_keeper', R.T('events.nerei_store_keeper.say_2'));
    }
    await ev.say('store_keeper', R.T('events.nerei_store_keeper.say_3'));
    await ev.shop('shop_nerei');
  }, { meta: { needs: ['item:k_guild_parcel'], gives: ['flag:isles_delivery_done'] } });
  E('nerei_inn_keeper', async (ev) => {
    await ev.say('nerei_inn_keeper', R.T('events.nerei_inn_keeper.say'));
    const i = await ev.choose(R.T('events.nerei_inn_keeper.i.choose'), { text: R.T('events.nerei_inn_keeper.i.choose.text') });
    if (i !== 0) return;
    const ok = await ev.inn();
    if (ok === false) return;
    if (ev.flag('isles_marina_met') && !ev.flag('isles_marina_night') && !ev.flag('isles_song_ready')) await ev.call('isles_marina_night');
  }, { meta: { needs: [], gives: [], calls: ['isles_marina_night'] } });
  E('isles_marina_night', async (ev) => {
    if (ev.flag('isles_marina_night')) return;
    ev.setFlag('isles_marina_night');
    await ev.caption(R.T('events.isles_marina_night.caption'), { ms: 2400 });
  }, { meta: { needs: ['flag:isles_marina_met'], gives: ['flag:isles_marina_night'] } });
  E('nerei_inn_guest', async (ev) => {
    await ev.say('nerei_inn_guest', R.T('events.nerei_inn_guest.say'));
    ev.lead('l_opt_siren');
  }, { meta: { needs: [], gives: ['lead:l_opt_siren'] } });

  // ---------------------------------------------------------------- 村の人
  E('nerei_fisher', async (ev) => {
    if (cleared(ev)) { await ev.say('nerei_fisher', R.T('events.nerei_fisher.say')); return; }
    await ev.say('nerei_fisher', R.T('events.nerei_fisher.say_2'));
  });
  E('nerei_child', async (ev) => {
    await ev.say('nerei_child', cleared(ev) ? R.T('events.nerei_child.say') : R.T('events.nerei_child.say_2'));
  });
  E('nerei_oldman', async (ev) => {
    const s = X().skyLine();
    await ev.say('nerei_oldman', s || R.T('events.nerei_oldman.say'));
  }, { meta: { needs: [], gives: [] } });
  E('nerei_house_wife', async (ev) => {
    await ev.say('house_wife', R.T('events.nerei_house_wife.say'));
  });
})(window.RPG);
