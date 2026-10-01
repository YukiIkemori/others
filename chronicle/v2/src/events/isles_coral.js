// CONTENT（マレア諸島）: 港町コーラルの人と物（WORLD_REDESIGN §4.5・§5.8、STORY_BIBLE §7.5・§8.6）。
//   着く（港に出られない船・腕を組むドレイク）→ 手がかり 3 つ（港の親方「港が閉じた」・ドレイク「乗り手のいない船」・酒場の老水夫「岬の村の歌」）
//   → 潮鳴りの洞窟の光る貝がら → ドレイクが船首に付ける（外洋船 isles_ship）→ 港の親方の海図（空白 4 つ）→ 島々（isles_sea.js）。
//   依頼: 旗信号の見習い試験（組合の旗手）・組合の配達（組合長）・光る貝がら集め（貝がら好きの子）。後家の壁（lo_war_isles）。
//   定期船: T 字の桟橋の先からファロスへ戻る（行きはファロスの桟橋。maps/field_isles_00_kit.js）。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。仲間の名前は出さない（A36）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Isles.ev;
  const cleared = (ev) => ev.flag('cleared_r_isles');
  const DRAKE = { name: R.T('ev.isles_coral.DRAKE.name') };

  // ---------------------------------------------------------------- 町に入る
  E('coral_arrival', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('isles_arrived_after')) { ev.setFlag('isles_arrived_after'); await ev.caption(R.T('events.coral_arrival.caption'), { ms: 2600 }); }
      return;
    }
    if (ev.flag('isles_arrived')) return;
    ev.setFlag('isles_arrived');
    await ev.caption(R.T('events.coral_arrival.caption_2'), { ms: 2600 });
    await ev.caption(R.T('events.coral_arrival.caption_3'), { ms: 2600 });
  }, { meta: { needs: [], gives: ['flag:isles_arrived'] } });

  // ---------------------------------------------------------------- 造船所の親方ドレイク（岸壁。外洋船）
  E('coral_drake', async (ev) => {
    if (cleared(ev)) {
      const t = X().tier();
      await ev.say('drake', t >= 5 ? R.T('events.coral_drake.say')
        : R.T('events.coral_drake.say_2'), DRAKE);
      return;
    }
    if (ev.flag('isles_ship')) {
      await ev.say('drake', R.T('events.coral_drake.say_3'), DRAKE);
      return;
    }
    if (ev.has('k_glow_shell')) { await ev.call('isles_ship_launch'); return; }
    if (!ev.flag('isles_drake_met')) {
      ev.setFlag('isles_drake_met');
      await ev.say(null, R.T('events.coral_drake.say_4'));
      await ev.say('drake', R.T('events.coral_drake.say_5'), DRAKE);
      await ev.say('drake', R.T('events.coral_drake.say_6'), DRAKE);
      await ev.say('drake', R.T('events.coral_drake.say_7'), DRAKE);
      ev.lead('l_isles_ship');
      ev.lead('l_isles_shell');
      return;
    }
    await ev.say('drake', R.T('events.coral_drake.say_8'), DRAKE);
  }, { meta: { needs: [], gives: ['flag:isles_drake_met', 'lead:l_isles_ship', 'lead:l_isles_shell'], calls: ['isles_ship_launch'] } });
  // 光る貝がらを船首に → 外洋船（ここからは島々へ船で渡れる。isles_sea.js の舵）
  E('isles_ship_launch', async (ev) => {
    if (ev.flag('isles_ship')) return;
    await ev.say('drake', R.T('events.isles_ship_launch.say'), DRAKE);
    ev.take('k_glow_shell', 1);
    await ev.fade('out', 500);
    ev.sfx('ship');
    await ev.caption(R.T('events.isles_ship_launch.caption'), { ms: 2600 });
    ev.setFlag('isles_ship');
    await ev.fade('in', 500);
    await ev.say('drake', R.T('events.isles_ship_launch.say_2'), DRAKE);
    ev.leadDone('l_isles_ship');
    ev.lead('l_isles_chart');
  }, { meta: { needs: ['flag:isles_shell'], gives: ['flag:isles_ship', 'lead:l_isles_chart'] } });

  // ---------------------------------------------------------------- 港の親方（上の段の家。港が閉じた・海図）
  E('coral_harbormaster', async (ev) => {
    if (cleared(ev)) {
      await ev.say('harbormaster', R.T('events.coral_harbormaster.say'));
      return;
    }
    if (ev.flag('isles_ship') && !ev.flag('isles_chart_got')) { await ev.call('coral_harbormaster_chart'); return; }
    if (ev.flag('isles_chart_got')) {
      const n = X().charted(ev);
      await ev.say('harbormaster', n >= 3 ? R.T('events.coral_harbormaster.say_2')
        : R.T('events.coral_harbormaster.say_3', { p0: 4 - n }));
      return;
    }
    await ev.say('harbormaster', R.T('events.coral_harbormaster.say_4'));
    await ev.say('harbormaster', R.T('events.coral_harbormaster.say_5'));
    ev.lead('l_isles_harbor');
  }, { meta: { needs: [], gives: ['lead:l_isles_harbor'], calls: ['coral_harbormaster_chart'] } });
  E('coral_harbormaster_chart', async (ev) => {
    if (ev.flag('isles_chart_got')) return;
    ev.setFlag('isles_chart_got');
    await ev.say('harbormaster', R.T('events.coral_harbormaster_chart.say'));
    ev.item('k_sea_chart', 1);
    await ev.say('harbormaster', R.T('events.coral_harbormaster_chart.say_2'));
    ev.lead('l_isles_chart');
    // 空白を先に（海図より前に）見てきた所は、ここで書きこむ
    const n = X().charted(ev);
    if (n > 0) {
      await ev.say('harbormaster', R.T('events.coral_harbormaster_chart.say_3', { n }));
      if (n >= 3 && !ev.flag('isles_fog_found')) {
        ev.setFlag('isles_fog_found');
        ev.leadDone('l_isles_chart');
        ev.lead('l_isles_fog');
        await ev.say('harbormaster', R.T('events.coral_harbormaster_chart.say_4'));
      }
    }
  }, { meta: { needs: ['flag:isles_ship'], gives: ['flag:isles_chart_got', 'item:k_sea_chart', 'lead:l_isles_chart'] } });
  E('coral_harbormaster_chart_table', async (ev) => {
    await ev.say(null, R.T('events.coral_harbormaster_chart_table.say'));
  });
  E('coral_hm_wife', async (ev) => {
    const s = X().skyLine();
    await ev.say('hm_wife', s || R.T('events.coral_hm_wife.say'));
  });

  // ---------------------------------------------------------------- 酒場（老水夫「岬の村の歌」・亭主・水夫・商船の船長）
  E('coral_old_sailor', async (ev) => {
    if (cleared(ev)) { await ev.say('old_sailor', R.T('events.coral_old_sailor.say')); return; }
    await ev.say('old_sailor', R.T('events.coral_old_sailor.say_2'));
    await ev.say('old_sailor', R.T('events.coral_old_sailor.say_3'));
    await ev.say('old_sailor', R.T('events.coral_old_sailor.say_4'));
    ev.lead('l_isles_song');
  }, { meta: { needs: [], gives: ['lead:l_isles_song'] } });
  E('coral_barkeep', async (ev) => {
    const s = X().skyLine();
    if (s) { await ev.say('barkeep', s); return; }
    await ev.say('barkeep', R.T('events.coral_barkeep.say'));
  });
  E('coral_tav_sailor', async (ev) => {
    if (cleared(ev)) { await ev.say('tav_sailor', R.T('events.coral_tav_sailor.say')); return; }
    await ev.say('tav_sailor', R.T('events.coral_tav_sailor.say_2'));
  }, { meta: { needs: [], gives: [] } });
  // 座礁した商船の船長（選んだ後、酒場に来る）
  E('coral_merchant', async (ev) => {
    const w = ev.choiceOf('ch_isles_wreck');
    if (w === 'help') {
      if (!ev.flag('isles_tmap_given')) {
        ev.setFlag('isles_tmap_given');
        await ev.say('merchant', R.T('events.coral_merchant.say'));
        await ev.say('merchant', R.T('events.coral_merchant.say_2'));
        ev.item('k_tmap_4', 1);
        return;
      }
      await ev.say('merchant', R.T('events.coral_merchant.say_3'));
      return;
    }
    await ev.say('merchant', R.T('events.coral_merchant.say_4'));
  }, { meta: { needs: ['flag:isles_wreck_done'], gives: ['item:k_tmap_4'] } });

  // ---------------------------------------------------------------- 宿・店
  E('coral_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? R.T('events.coral_inn_keeper.say') : R.T('events.coral_inn_keeper.say_2'));
    const i = await ev.choose(R.T('events.coral_inn_keeper.i.choose'), { who: 'inn_keeper', text: R.T('events.coral_inn_keeper.i.choose.text') });
    if (i !== 0) return;
    await ev.inn();
  });
  E('coral_inn_guest', async (ev) => {
    await ev.say('inn_guest', R.T('events.coral_inn_guest.say'));
    ev.lead('l_opt_crab');
  }, { meta: { needs: [], gives: ['lead:l_opt_crab'] } });
  E('coral_item_keeper', async (ev) => {
    await ev.say('item_keeper', R.T('events.coral_item_keeper.say'));
    await ev.shop('shop_coral_items');
  });
  E('coral_smith', async (ev) => {
    await ev.say('smith', R.T('events.coral_smith.say'));
    await ev.shop('shop_coral_arms');
  });

  // ---------------------------------------------------------------- 船乗り組合（組合長・旗手・売り台）
  E('coral_guild_master', async (ev) => {
    if (ev.flag('isles_delivery_done')) {
      await ev.say('guild_master', R.T('events.coral_guild_master.say'));
      await ev.shop('shop_coral_guild');
      return;
    }
    if (ev.has('k_guild_parcel')) {
      await ev.say('guild_master', R.T('events.coral_guild_master.say_2'));
      await ev.shop('shop_coral_guild');
      return;
    }
    if (!ev.flag('isles_delivery_on')) {
      await ev.say('guild_master', R.T('events.coral_guild_master.say_3'));
      const i = await ev.choose(R.T('events.coral_guild_master.i.choose'), { text: R.T('events.coral_guild_master.i.choose.text') });
      if (i === 0) {
        ev.setFlag('isles_delivery_on');
        ev.item('k_guild_parcel', 1);
        ev.lead('q_isles_delivery');
        await ev.say('guild_master', R.T('events.coral_guild_master.say_4'));
        return;
      }
    }
    await ev.shop('shop_coral_guild');
  }, { meta: { needs: [], gives: ['lead:q_isles_delivery', 'item:k_guild_parcel'] } });
  // 旗信号の見習い試験（mini.sequence。3 段。段ごとに品。3 段目で信号旗の襟巻き）
  const FLAG_STAGES = [
    { label: R.T('ev.isles_coral.FLAG_STAGES.0.label'), rounds: 2, tempo: 640, reward: ['i_potion', 2] },
    { label: R.T('ev.isles_coral.FLAG_STAGES.1.label'), rounds: 3, tempo: 560, reward: ['i_ether', 2] },
    { label: R.T('ev.isles_coral.FLAG_STAGES.2.label'), rounds: 4, tempo: 480, reward: ['u_flag_scarf', 1] },
  ];
  const RANK_OK = { S: true, A: true, B: true };
  E('coral_flags', async (ev) => {
    if (!ev.flag('isles_flags_met')) {
      ev.setFlag('isles_flags_met');
      await ev.say('flag_officer', R.T('events.coral_flags.say'));
      ev.lead('q_isles_flags');
    }
    const next = FLAG_STAGES.findIndex((s, i) => !ev.flag('isles_flags_' + (i + 1)));
    const labels = FLAG_STAGES.map((s, i) => s.label + (ev.flag('isles_flags_' + (i + 1)) ? R.T('events.coral_flags.labels') : ''));
    const i = await ev.choose(labels.concat([R.T('events.coral_flags.i.choose.0')]), { cancel: FLAG_STAGES.length, text: next < 0 ? R.T('events.coral_flags.i.choose.text') : R.T('events.coral_flags.i.choose.text_2') });
    if (i >= FLAG_STAGES.length) return;
    if (i > 0 && !ev.flag('isles_flags_' + i)) { await ev.say('flag_officer', R.T('events.coral_flags.say_2')); return; }
    const st = FLAG_STAGES[i];
    const r = (await ev.mini.sequence({ title: R.T('events.coral_flags.r.title', { label: st.label }), symbols: R.T('events.coral_flags.r.symbols').slice(0, 3 + i), rounds: st.rounds, tempo: st.tempo, theme: 'harbor' })) || {};
    if (!RANK_OK[r.rank]) { await ev.say('flag_officer', R.T('events.coral_flags.say_3')); return; }
    const key = 'isles_flags_' + (i + 1);
    if (ev.flag(key)) { await ev.say('flag_officer', R.T('events.coral_flags.say_4')); return; }
    ev.setFlag(key);
    await ev.say('flag_officer', R.T('events.coral_flags.say_5', { label: st.label }));
    ev.item(st.reward[0], st.reward[1]);
    if (i === 2) {
      ev.setFlag('isles_flags_done');
      ev.leadDone('q_isles_flags');
      await ev.say('flag_officer', R.T('events.coral_flags.say_6'));
    }
  }, { meta: { needs: [], gives: ['lead:q_isles_flags', 'flag:isles_flags_1', 'flag:isles_flags_2', 'flag:isles_flags_3', 'flag:isles_flags_done', 'item:u_flag_scarf'] } });
  E('coral_guild_board', async (ev) => {
    await ev.say(null, cleared(ev) ? R.T('events.coral_guild_board.say')
      : R.T('events.coral_guild_board.say_2'));
  });

  // ---------------------------------------------------------------- 後家の壁（lo_war_isles）と、そのそばの人
  E('coral_widows_wall', async (ev) => {
    const x = X();
    if (ev.flag('isles_wall_names')) {
      await ev.say(null, R.T('events.coral_widows_wall.say'));
      return;
    }
    await ev.say(null, R.T('events.coral_widows_wall.say_2'));
    await x.lore(ev, 'lo_war_isles');
    await ev.say(null, R.T('events.coral_widows_wall.say_3'));
  }, { meta: { needs: [], gives: ['lore:lo_war_isles'] } });
  E('coral_widow', async (ev) => {
    if (ev.flag('isles_wall_names')) { await ev.say('widow', R.T('events.coral_widow.say')); return; }
    await ev.say('widow', R.T('events.coral_widow.say_2'));
  }, { meta: { needs: [], gives: [] } });

  // ---------------------------------------------------------------- 町の人（見返り: 近況・ほのめかし・ボスの癖・うわさ）
  E('coral_gate_sailor', async (ev) => {
    if (cleared(ev)) { await ev.say('gate_sailor', R.T('events.coral_gate_sailor.say')); return; }
    await ev.say('gate_sailor', R.T('events.coral_gate_sailor.say_2'));
  });
  E('coral_child', async (ev) => {
    await ev.say('child', cleared(ev) ? R.T('events.coral_child.say') : R.T('events.coral_child.say_2'));
  });
  E('coral_idle_sailor', async (ev) => {
    if (cleared(ev)) { await ev.say('idle_sailor', R.T('events.coral_idle_sailor.say')); return; }
    await ev.say('idle_sailor', R.T('events.coral_idle_sailor.say_2'));
  }, { meta: { needs: [], gives: [] } });
  E('coral_lookout', async (ev) => {
    await ev.say(null, R.T('events.coral_lookout.say'));
  });
  E('coral_house1_widow', async (ev) => {
    await ev.say('house1_widow', ev.flag('isles_wall_names') ? R.T('events.coral_house1_widow.say')
      : R.T('events.coral_house1_widow.say_2'));
  });
  E('coral_house1_kid', async (ev) => {
    await ev.say('house1_kid', R.T('events.coral_house1_kid.say'));
  });
  E('coral_sailor_wife', async (ev) => {
    await ev.say('sailor_wife', R.T('events.coral_sailor_wife.say'));
  });
  E('coral_fisher', async (ev) => {
    await ev.say('fisher', R.T('events.coral_fisher.say'));
    ev.lead('l_opt_siren');
  }, { meta: { needs: [], gives: ['lead:l_opt_siren'] } });

  // ---------------------------------------------------------------- 光る貝がら集め（12 種。町の浜・入り江の洞・潮鳴りの洞窟の中）
  E('coral_shell_kid', async (ev) => {
    const n = ev.var('isles_shells');
    if (ev.flag('isles_shells_done')) { await ev.say('shell_kid', R.T('events.coral_shell_kid.say')); return; }
    if (!ev.flag('isles_shells_on')) {
      ev.setFlag('isles_shells_on');
      await ev.say('shell_kid', R.T('events.coral_shell_kid.say_2'));
      ev.lead('q_isles_shells');
      return;
    }
    if (n >= 12) {
      ev.setFlag('isles_shells_done');
      ev.leadDone('q_isles_shells');
      await ev.say('shell_kid', R.T('events.coral_shell_kid.say_3'));
      ev.item('u_shell_charm', 1);
      return;
    }
    await ev.say('shell_kid', R.T('events.coral_shell_kid.say_4', { n, p1: 12 - n }));
  }, { meta: { needs: [], gives: ['lead:q_isles_shells', 'flag:isles_shells_done', 'item:u_shell_charm'] } });
  E('isles_shell', async (ev, ctx) => {
    const m = R.DB.maps[ctx && ctx.map] || (R.Field && R.Field.pos && R.DB.maps[R.Field.pos.map]);
    const o = m && ctx && (m.objects || []).find((q) => q.type === 'examine' && q.event === 'isles_shell' && q.x === ctx.x && q.y === ctx.y);
    const key = 'isles_shell_' + ((o && o.shell) || 0);
    if (ev.flag(key)) { await ev.say(null, R.T('events.isles_shell.say')); return; }
    ev.setFlag(key);
    const n = ev.addVar('isles_shells', 1);
    ev.sfx('item');
    await ev.say(null, R.T('events.isles_shell.say_2', { n }));
  });

  // ---------------------------------------------------------------- 桟橋（外洋船がまだ無いとき・定期船）
  E('isles_pier_empty', async (ev) => {
    await ev.say(null, R.T('events.isles_pier_empty.say'));
  });
  E('coral_ferry_hand', async (ev) => {
    await ev.say('ferry_hand', cleared(ev) ? R.T('events.coral_ferry_hand.say') : R.T('events.coral_ferry_hand.say_2'));
  });
  E('isles_ferry_hand', async (ev) => {
    await ev.say('ferry_hand', R.T('events.isles_ferry_hand.say'));
    ev.lead('l_rumor_isles');
  }, { meta: { needs: [], gives: ['lead:l_rumor_isles'] } });
  E('isles_ferry_closed', async (ev) => {
    await ev.say(null, R.T('events.isles_ferry_closed.say'));
  });
})(window.RPG);
