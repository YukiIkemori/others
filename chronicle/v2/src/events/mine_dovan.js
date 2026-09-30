// CONTENT（ガルド山地）: 鉱山都市ドヴァンの人と物（WORLD_REDESIGN §4.6・§5.10、STORY_BIBLE §7.6・§8.7）。
//   着く（昇降機の前で組合と鍛冶衆がにらみ合い、どちらも話しかけてこない）→ 手がかり 4 つ（坑道の見張り「閉じ込められた鉱夫」・ボルグ「組合の言い分」・
//   ヘルガ「鍛冶衆の言い分」・誓いの碑）→ 深き坑道で 3 人を救う（mine_deep.js）→ 七の層の岩戸の前で番人が目を覚ましかける → 町へ戻る →
//   両方の言い分を聞く小さな仕事（どちらも受けてよい）:
//     組合: 救い出した鉱夫の無事を家族に知らせる（ダグの家・ロルフの家）／組合の出納帳を見る（lo_war_mine。冬を越せない家の数）
//     鍛冶衆: 誓いの碑の消えた文字を、山の隠者の古い写しと照らす（k_oath_copy）／鍛冶場の鍛冶神の石像で祈りの文句を読む
//   → 集会所で選ぶ（A 組合・B 鍛冶衆・C 仲裁 = 四つの仕事をみな済ませると出る）→ 七の層へ（mine_deep.js）。
//   依頼: 坑夫のカンテラ（タデオ）・落盤の子猫（広場の子）・鍛冶場の火起こし（見習い。R.Mini.timing）・坑道の幽霊（酒場の古い坑夫のうわさ）。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。仲間の名前は出さない（A36）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Mine.ev;
  const cleared = (ev) => ev.flag('cleared_r_mine');
  const objAt = (ctx, event) => { const m = ctx && R.DB.maps[ctx.map]; return m && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const BORG = { name: R.T('ev.mine_dovan.BORG.name') }, HELGA = { name: R.T('ev.mine_dovan.HELGA.name') };

  // ---------------------------------------------------------------- 町に入る
  E('dovan_arrival', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('mine_arrived_after')) { ev.setFlag('mine_arrived_after'); await ev.caption(R.T('events.dovan_arrival.caption'), { ms: 2600 }); }
      return;
    }
    if (ev.flag('mine_arrived')) return;
    ev.setFlag('mine_arrived');
    await ev.caption(R.T('events.dovan_arrival.caption_2'), { ms: 2600 });
    await ev.caption(R.T('events.dovan_arrival.caption_3'), { ms: 2800 });
  }, { meta: { needs: [], gives: ['flag:mine_arrived'] } });

  // ---------------------------------------------------------------- 坑道の見張り（閉じ込められた鉱夫）
  E('dovan_mouth_watch', async (ev) => {
    if (cleared(ev)) { await ev.say('mouth_watch', R.T('events.dovan_mouth_watch.say')); return; }
    if (ev.flag('mine_rescued_all')) { await ev.say('mouth_watch', R.T('events.dovan_mouth_watch.say_2')); return; }
    if (!ev.flag('mine_watch_met')) {
      ev.setFlag('mine_watch_met');
      await ev.say('mouth_watch', R.T('events.dovan_mouth_watch.say_3'));
      await ev.say('mouth_watch', R.T('events.dovan_mouth_watch.say_4'));
      await ev.say('mouth_watch', R.T('events.dovan_mouth_watch.say_5'));
      ev.lead('l_mine_trapped');
      return;
    }
    const n = X().rescued(ev);
    await ev.say('mouth_watch', n ? R.T('events.dovan_mouth_watch.say_6', { p0: 3 - n }) : R.T('events.dovan_mouth_watch.say_7'));
  }, { meta: { needs: [], gives: ['flag:mine_watch_met', 'lead:l_mine_trapped'] } });

  // ---------------------------------------------------------------- 昇降機の前のにらみ合い（選ぶまで）・選んだあとの広場
  E('dovan_glare_guild', async (ev) => {
    await ev.say('glare_guild', R.T('events.dovan_glare_guild.say'));
  });
  E('dovan_glare_smith', async (ev) => {
    await ev.say('glare_smith', R.T('events.dovan_glare_smith.say'));
  });
  E('dovan_after_guild', async (ev) => {
    const s = X().side(ev);
    if (s === 'guild') { await ev.say('toast_guild', R.T('events.dovan_after_guild.say')); return; }
    if (s === 'smiths') { await ev.say('toast_guild', R.T('events.dovan_after_guild.say_2')); return; }
    await ev.say('toast_guild', R.T('events.dovan_after_guild.say_3'));
  });

  // ---------------------------------------------------------------- 誓いの碑（下の段。文字が半分消えている）
  E('dovan_oath_stone', async (ev) => {
    const x = X();
    await ev.say(null, R.T('events.dovan_oath_stone.say'));
    if (ev.flag('mine_job_s1') || ev.has('k_oath_copy')) {
      await ev.say(null, R.T('events.dovan_oath_stone.say_2'));
      await ev.caption(x.OATH_FULL, { ms: 3200 });
      await x.lore(ev, 'lo_mine_oath');
      return;
    }
    await ev.caption(x.OATH_WORN, { ms: 3000 });
    await ev.say(null, R.T('events.dovan_oath_stone.say_3'));
    if (!ev.flag('mine_stone_read')) { ev.setFlag('mine_stone_read'); ev.lead('l_mine_stone'); }
  }, { meta: { needs: [], gives: ['flag:mine_stone_read', 'lead:l_mine_stone', 'lore:lo_mine_oath'] } });

  // ---------------------------------------------------------------- 昇降機（上の段 ⇔ 中の段）・トロッコ乗り場
  E('dovan_lift', async (ev, ctx) => {
    const m = R.DB.maps[ctx && ctx.map];
    const o = m && (m.objects || []).find((q) => q.event === 'dovan_lift' && q.x === ctx.x && q.y === ctx.y);
    const up = !o || o.stop === 'u';
    const i = await ev.choose(R.T('events.dovan_lift.i.choose'), { text: up ? R.T('events.dovan_lift.i.choose.text') : R.T('events.dovan_lift.i.choose.text_2') });
    if (i !== 0) return;
    ev.sfx('stairs');
    await ev.fade('out', 400);
    await ev.warp('dovan', up ? 'lift_m' : 'lift_u');
    await ev.fade('in', 400);
  });
  E('dovan_cart_station', async (ev) => {
    if (!ev.flag('mine_cartline')) {
      await ev.say(null, R.T('events.dovan_cart_station.say'));
      await ev.say(null, R.T('events.dovan_cart_station.say_2'));
      return;
    }
    const i = await ev.choose(R.T('events.dovan_cart_station.i.choose'), { text: R.T('events.dovan_cart_station.i.choose.text') });
    if (i !== 0) return;
    ev.sfx('earth');
    await ev.fade('out', 500);
    await ev.caption(R.T('events.dovan_cart_station.caption'), { ms: 1800 });
    await ev.warp('g_rail', 'railend');
    await ev.fade('in', 500);
  }, { meta: { needs: [], gives: [], warp: { to: 'g_rail', spawn: 'railend' } } });
  E('dovan_melt_notice', async (ev) => {
    await ev.say(null, R.T('events.dovan_melt_notice.say'));
  });

  // ---------------------------------------------------------------- 町の人（近況・うわさ）
  E('dovan_station_old', async (ev) => {
    if (cleared(ev)) { await ev.say('station_old', R.T('events.dovan_station_old.say')); return; }
    if (!ev.flag('mine_hedgehog_heard')) {
      ev.setFlag('mine_hedgehog_heard');
      await ev.say('station_old', R.T('events.dovan_station_old.say_2'));
      await ev.say('station_old', R.T('events.dovan_station_old.say_3'));
      return;
    }
    const s = X().skyLine();
    await ev.say('station_old', s || R.T('events.dovan_station_old.say_4'));
    // (2026-09-30) 寄り道 #17 のうわさ（七の層の下の光る鉱脈）
    if (!ev.flag('vein_seen')) ev.lead('l_opt_vein');
  }, { meta: { needs: [], gives: ['lead:l_opt_vein'] } });
  E('dovan_street_woman', async (ev) => {
    if (cleared(ev)) await ev.say('street_woman', R.T('events.dovan_street_woman.say'));
    else await ev.say('street_woman', R.T('events.dovan_street_woman.say_2'));
    // (2026-09-30) 寄り道 #16 のうわさ（鉱石の谷の古い吊り橋の下の鍛冶衆の村）
    if (!ev.flag('volk_seen')) {
      await ev.say('street_woman', R.T('events.dovan_street_woman.say_3'));
      ev.lead('l_opt_volk');
    }
  }, { meta: { needs: [], gives: ['lead:l_opt_volk'] } });
  E('dovan_hall_old', async (ev) => {
    if (cleared(ev)) { await ev.say('hall_old', R.T('events.dovan_hall_old.say')); return; }
    await ev.say('hall_old', R.T('events.dovan_hall_old.say_2'));
    await ev.say('hall_old', R.T('events.dovan_hall_old.say_3'));
  });

  // ---------------------------------------------------------------- タデオ（坑夫のカンテラ。灯りを守る）
  E('dovan_tadeo', async (ev) => {
    if (ev.flag('mine_lamps_done')) { await ev.say('tadeo', cleared(ev) ? R.T('events.dovan_tadeo.say') : R.T('events.dovan_tadeo.say_2')); return; }
    const n = ev.var('mine_lamps') || 0;
    if (n >= 3) {
      await ev.say('tadeo', R.T('events.dovan_tadeo.say_3'));
      ev.item('u_miner_lamp', 1);
      ev.setFlag('mine_lamps_done');
      ev.leadDone('q_mine_lamps');
      return;
    }
    if (ev.flag('mine_lamps_asked')) { await ev.say('tadeo', R.T('events.dovan_tadeo.say_4', { p0: 3 - n })); return; }
    await ev.say('tadeo', R.T('events.dovan_tadeo.say_5'));
    await ev.say('tadeo', R.T('events.dovan_tadeo.say_6'));
    await ev.say('tadeo', R.T('events.dovan_tadeo.say_7'));
    ev.setFlag('mine_lamps_asked');
    ev.item('k_mine_oil', 1);
    ev.lead('q_mine_lamps');
  }, { meta: { needs: [], gives: ['lead:q_mine_lamps', 'item:k_mine_oil', 'flag:mine_lamps_asked', 'flag:mine_lamps_done', 'item:u_miner_lamp'] } });

  // ---------------------------------------------------------------- 落盤の子猫（広場の子）
  E('dovan_cat_kid', async (ev) => {
    if (ev.flag('mine_kitten_home')) { await ev.say('cat_kid', R.T('events.dovan_cat_kid.say')); return; }
    if (ev.flag('mine_kitten_found')) {
      ev.guest(null);
      ev.setFlag('mine_kitten_home');
      ev.leadDone('q_mine_kitten');
      await ev.say('cat_kid', R.T('events.dovan_cat_kid.say_2'));
      ev.item('i_potion2', 2);
      return;
    }
    if (ev.flag('mine_kitten_asked')) { await ev.say('cat_kid', R.T('events.dovan_cat_kid.say_3')); return; }
    await ev.say('cat_kid', R.T('events.dovan_cat_kid.say_4'));
    await ev.say('cat_kid', R.T('events.dovan_cat_kid.say_5'));
    ev.setFlag('mine_kitten_asked');
    ev.lead('q_mine_kitten');
  }, { meta: { needs: [], gives: ['lead:q_mine_kitten', 'flag:mine_kitten_asked', 'flag:mine_kitten_home', 'item:i_potion2'] } });

  // ================================================================ 屋内
  // ---------------------------------------------------------------- 鉱夫組合の事務所（ボルグ・帳場・出納帳）
  E('dovan_borg', async (ev) => {
    const x = X();
    if (cleared(ev)) {
      const s = x.side(ev);
      await ev.say('borg', s === 'guild' ? R.T('events.dovan_borg.say')
        : s === 'smiths' ? R.T('events.dovan_borg.say_2')
          : R.T('events.dovan_borg.say_3'));
      return;
    }
    if (ev.flag('mine_choice')) { await ev.say('borg', R.T('events.dovan_borg.say_4')); return; }
    if (!ev.flag('mine_borg_met')) {
      ev.setFlag('mine_borg_met');
      await ev.say('borg', R.T('events.dovan_borg.say_5'));
      await ev.say('borg', R.T('events.dovan_borg.say_6'));
      await ev.say('borg', R.T('events.dovan_borg.say_7'));
      ev.lead('l_mine_guild');
      return;
    }
    if (!ev.flag('mine_door_seen')) { await ev.say('borg', R.T('events.dovan_borg.say_8')); return; }
    // 岩戸の前から戻った: 組合の仕事
    if (!ev.flag('mine_borg_jobs')) {
      ev.setFlag('mine_borg_jobs');
      await ev.say('borg', R.T('events.dovan_borg.say_9'));
      await ev.say('borg', R.T('events.dovan_borg.say_10'));
      await ev.say('borg', R.T('events.dovan_borg.say_11'));
      return;
    }
    const j = x.jobs(ev);
    await ev.say('borg', j.g >= 2 ? R.T('events.dovan_borg.say_12') : R.T('events.dovan_borg.say_13'));
  }, { meta: { needs: [], gives: ['flag:mine_borg_met', 'lead:l_mine_guild', 'flag:mine_borg_jobs'] } });
  E('dovan_guild_clerk', async (ev) => {
    const s = X().side(ev);
    await ev.say('guild_clerk', s === 'guild' || s === 'accord' ? R.T('events.dovan_guild_clerk.say') : R.T('events.dovan_guild_clerk.say_2'));
    await ev.shop('shop_dovan_guild');
  });
  E('dovan_ledger', async (ev) => {
    const x = X();
    await ev.say(null, R.T('events.dovan_ledger.say'));
    await ev.say(null, R.T('events.dovan_ledger.say_2'));
    await x.lore(ev, 'lo_war_mine');
    if (ev.flag('mine_borg_jobs') && !ev.flag('mine_job_g2')) {
      await ev.say(null, R.T('events.dovan_ledger.say_3'));
      ev.setFlag('mine_job_g2');
      await ev.caption(R.T('events.dovan_ledger.caption'), { ms: 1600 });
    }
  }, { meta: { needs: [], gives: ['lore:lo_war_mine', 'flag:mine_job_g2'] } });

  // ---------------------------------------------------------------- 酒場「つるはし亭」
  E('dovan_barkeep', async (ev) => {
    const s = X().skyLine();
    if (s) { await ev.say('barkeep', s); return; }
    await ev.say('barkeep', R.T('events.dovan_barkeep.say'));
  });
  E('dovan_tav_miner', async (ev) => {
    if (cleared(ev)) { await ev.say('tav_miner', R.T('events.dovan_tav_miner.say')); return; }
    await ev.say('tav_miner', R.T('events.dovan_tav_miner.say_2'));
    await ev.say('tav_miner', R.T('events.dovan_tav_miner.say_3'));
  });
  // 組合の年寄り: 出納帳を誇らしげに（戦の傷。鍛冶衆の年寄りは恥じて語る）
  E('dovan_tav_old', async (ev) => {
    if (!ev.flag('mine_ghost_heard')) {
      ev.setFlag('mine_ghost_heard');
      await ev.say('tav_old', R.T('events.dovan_tav_old.say'));
      await ev.say('tav_old', R.T('events.dovan_tav_old.say_2'));
      ev.lead('q_mine_ghost');
      return;
    }
    await ev.say('tav_old', R.T('events.dovan_tav_old.say_3'));
    await ev.say('tav_old', R.T('events.dovan_tav_old.say_4'));
  }, { meta: { needs: [], gives: ['flag:mine_ghost_heard', 'lead:q_mine_ghost'] } });

  // ---------------------------------------------------------------- 鉱夫の家（ダグ）・ロルフの家（組合の仕事: 無事を知らせる）
  const tell = async (ev, flag) => {
    ev.setFlag(flag);
    if (ev.flag('mine_told_dag') && ev.flag('mine_told_rolf') && !ev.flag('mine_job_g1')) {
      ev.setFlag('mine_job_g1');
      await ev.caption(R.T('ev.mine_dovan.tell.caption'), { ms: 1600 });
    }
  };
  E('dovan_dag_wife', async (ev) => {
    if (ev.flag('mine_told_dag')) { await ev.say('dag_wife', R.T('events.dovan_dag_wife.say')); return; }
    if (ev.flag('mine_miner1') && ev.flag('mine_borg_jobs')) {
      await ev.say('dag_wife', R.T('events.dovan_dag_wife.say_2'));
      await ev.say('dag_wife', R.T('events.dovan_dag_wife.say_3'));
      await tell(ev, 'mine_told_dag');
      return;
    }
    await ev.say('dag_wife', R.T('events.dovan_dag_wife.say_4'));
  }, { meta: { needs: [], gives: ['flag:mine_told_dag', 'flag:mine_job_g1'] } });
  E('dovan_dag_kid', async (ev) => {
    await ev.say('dag_kid', ev.flag('mine_miner1') ? R.T('events.dovan_dag_kid.say') : R.T('events.dovan_dag_kid.say_2'));
  });
  E('dovan_dag', async (ev) => {
    await ev.say('dag', cleared(ev) ? R.T('events.dovan_dag.say') : R.T('events.dovan_dag.say_2'));
  });
  E('dovan_rolf_mother', async (ev) => {
    if (ev.flag('mine_told_rolf')) { await ev.say('rolf_mother', R.T('events.dovan_rolf_mother.say')); return; }
    if (ev.flag('mine_miner2') && ev.flag('mine_borg_jobs')) {
      await ev.say('rolf_mother', R.T('events.dovan_rolf_mother.say_2'));
      await ev.say('rolf_mother', R.T('events.dovan_rolf_mother.say_3'));
      await tell(ev, 'mine_told_rolf');
      return;
    }
    await ev.say('rolf_mother', R.T('events.dovan_rolf_mother.say_4'));
  }, { meta: { needs: [], gives: ['flag:mine_told_rolf', 'flag:mine_job_g1'] } });
  E('dovan_rolf', async (ev) => {
    await ev.say('rolf', R.T('events.dovan_rolf.say'));
  });

  // ---------------------------------------------------------------- 道具屋・宿
  E('dovan_item_keeper', async (ev) => {
    await ev.say('item_keeper', R.T('events.dovan_item_keeper.say'));
    await ev.shop('shop_dovan_items');
  });
  E('dovan_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? R.T('events.dovan_inn_keeper.say') : R.T('events.dovan_inn_keeper.say_2'));
    const i = await ev.choose(R.T('events.dovan_inn_keeper.i.choose'), { text: R.T('events.dovan_inn_keeper.i.choose.text') });
    if (i !== 0) return;
    await ev.inn();
  });
  E('dovan_inn_guest', async (ev) => {
    await ev.say('inn_guest', R.T('events.dovan_inn_guest.say'));
    await ev.say('inn_guest', R.T('events.dovan_inn_guest.say_2'));
    ev.lead('l_opt_hermit');
  }, { meta: { needs: [], gives: ['lead:l_opt_hermit'] } });

  // ---------------------------------------------------------------- 鍛冶場（ヘルガ・売り手・見習い・受け取り書・石像）
  E('dovan_helga', async (ev) => {
    const x = X();
    if (cleared(ev)) {
      const s = x.side(ev);
      await ev.say('helga', s === 'guild' ? R.T('events.dovan_helga.say')
        : s === 'smiths' ? R.T('events.dovan_helga.say_2')
          : R.T('events.dovan_helga.say_3'));
      return;
    }
    if (ev.flag('mine_choice')) { await ev.say('helga', R.T('events.dovan_helga.say_4')); return; }
    if (!ev.flag('mine_helga_met')) {
      ev.setFlag('mine_helga_met');
      await ev.say('helga', R.T('events.dovan_helga.say_5'));
      await ev.say('helga', R.T('events.dovan_helga.say_6'));
      await ev.say('helga', R.T('events.dovan_helga.say_7'));
      await ev.say('helga', R.T('events.dovan_helga.say_8'));
      ev.lead('l_mine_smiths');
      return;
    }
    if (!ev.flag('mine_door_seen')) { await ev.say('helga', R.T('events.dovan_helga.say_9')); return; }
    if (!ev.flag('mine_helga_jobs')) {
      ev.setFlag('mine_helga_jobs');
      await ev.say('helga', R.T('events.dovan_helga.say_10'));
      await ev.say('helga', R.T('events.dovan_helga.say_11'));
      await ev.say('helga', R.T('events.dovan_helga.say_12'));
      return;
    }
    if (ev.has('k_oath_copy') && !ev.flag('mine_job_s1')) {
      await ev.say('helga', R.T('events.dovan_helga.say_13'));
      await ev.caption(x.OATH_FULL, { ms: 3200 });
      await ev.say('helga', R.T('events.dovan_helga.say_14'));
      ev.setFlag('mine_job_s1');
      ev.leadDone('l_mine_stone');
      await x.lore(ev, 'lo_mine_oath');
      await ev.caption(R.T('events.dovan_helga.caption'), { ms: 1600 });
      return;
    }
    const j = x.jobs(ev);
    await ev.say('helga', j.s >= 2 ? R.T('events.dovan_helga.say_15') : R.T('events.dovan_helga.say_16'));
  }, { meta: { needs: [], gives: ['flag:mine_helga_met', 'lead:l_mine_smiths', 'flag:mine_helga_jobs', 'flag:mine_job_s1', 'lore:lo_mine_oath'] } });
  E('dovan_forge_seller', async (ev) => {
    const s = X().side(ev);
    if (s === 'guild' && cleared(ev)) { await ev.say('forge_seller', R.T('events.dovan_forge_seller.say')); return; }
    await ev.say('forge_seller', s === 'smiths' || s === 'accord' ? R.T('events.dovan_forge_seller.say_2') : R.T('events.dovan_forge_seller.say_3'));
    await ev.shop('shop_dovan_forge');
  });
  // 拓本の受け取り書（lo_ev_mine。ティア 4 以上なら主人公が名前に反応する）
  E('dovan_receipt', async (ev) => {
    const x = X();
    await ev.say(null, R.T('events.dovan_receipt.say'));
    await ev.caption(R.T('events.dovan_receipt.caption'), { ms: 3400 });
    const first = await x.lore(ev, 'lo_ev_mine');
    if (x.tier() >= 4) await ev.say(null, R.T('events.dovan_receipt.say_2'));
    if (first) ev.lead('l_main_recorder_mine');
  }, { meta: { needs: [], gives: ['lore:lo_ev_mine', 'lead:l_main_recorder_mine'] } });
  // 鍛冶神の小さな石像（鍛冶衆の仕事: 祈りの文句を読む）
  E('dovan_forge_statue', async (ev) => {
    const x = X();
    await ev.say(null, R.T('events.dovan_forge_statue.say'));
    await ev.caption(x.SONG[0], { ms: 2400 });
    await ev.caption(x.SONG[1], { ms: 2400 });
    if (ev.flag('mine_helga_jobs') && !ev.flag('mine_job_s2')) {
      ev.setFlag('mine_job_s2');
      await ev.say(null, R.T('events.dovan_forge_statue.say_2'));
      await ev.caption(R.T('events.dovan_forge_statue.caption'), { ms: 1600 });
    }
  }, { meta: { needs: [], gives: ['flag:mine_job_s2'] } });
  // 見習い（ふいごの依頼・選んだあとの鍛冶の抜け道）
  E('dovan_forge_boy', async (ev) => {
    if (ev.flag('mine_smithpath')) {
      const i = await ev.choose(R.T('events.dovan_forge_boy.i.choose'), { text: R.T('events.dovan_forge_boy.i.choose.text') });
      if (i !== 0) return;
      await ev.fade('out', 500);
      await ev.caption(R.T('events.dovan_forge_boy.caption'), { ms: 1800 });
      await ev.warp('g_pass', 'tunnel');
      await ev.fade('in', 500);
      return;
    }
    if (ev.flag('mine_bellows_done')) { await ev.say('forge_boy', R.T('events.dovan_forge_boy.say')); return; }
    if (!ev.flag('mine_bellows_asked')) {
      ev.setFlag('mine_bellows_asked');
      ev.lead('q_mine_bellows');
    }
    await ev.say('forge_boy', R.T('events.dovan_forge_boy.say_2'));
    await ev.say('forge_boy', R.T('events.dovan_forge_boy.say_3'));
  }, { meta: { needs: [], gives: ['lead:q_mine_bellows', 'flag:mine_bellows_asked'], warp: { to: 'g_pass', spawn: 'tunnel' } } });
  E('dovan_bellows', async (ev) => {
    if (!ev.flag('mine_bellows_asked') || ev.flag('mine_bellows_done')) { await ev.say(null, R.T('events.dovan_bellows.say')); return; }
    const r = (await ev.mini.timing({ title: R.T('events.dovan_bellows.r.title'), tries: 3, speed: 1400, zones: [[0.42, 0.58]], theme: 'night' })) || { hits: 3 };
    if ((r.hits || 0) >= 2) {
      ev.setFlag('mine_bellows_done');
      ev.leadDone('q_mine_bellows');
      ev.sfx('fire');
      await ev.say('forge_boy', R.T('events.dovan_bellows.say_2'));
      ev.item('i_stone_fire', 2);
      return;
    }
    await ev.say('forge_boy', R.T('events.dovan_bellows.say_3'));
  }, { meta: { needs: ['flag:mine_bellows_asked'], gives: ['flag:mine_bellows_done', 'item:i_stone_fire'] } });

  // ---------------------------------------------------------------- 集会所（寄り合い。選ぶ）
  E('dovan_hall_chair', async (ev) => {
    if (cleared(ev)) { await ev.say('hall_chair', R.T('events.dovan_hall_chair.say')); return; }
    if (ev.flag('mine_choice')) { await ev.say('hall_chair', R.T('events.dovan_hall_chair.say_2')); return; }
    if (!ev.flag('mine_door_seen')) {
      await ev.say('hall_chair', R.T('events.dovan_hall_chair.say_3'));
      return;
    }
    await ev.call('dovan_assembly');
  }, { meta: { needs: [], gives: [], calls: ['dovan_assembly'] } });
  E('dovan_hall_borg', async (ev) => {
    await ev.say('hall_borg', ev.flag('mine_ledger_closed') ? R.T('events.dovan_hall_borg.say') : R.T('events.dovan_hall_borg.say_2'));
  });
  E('dovan_hall_helga', async (ev) => {
    await ev.say('hall_helga', ev.flag('mine_ledger_closed') ? R.T('events.dovan_hall_helga.say') : R.T('events.dovan_hall_helga.say_2'));
  });
  E('dovan_assembly', async (ev) => {
    const x = X();
    if (ev.flag('mine_choice') || !ev.flag('mine_door_seen')) return;
    await ev.say('hall_chair', R.T('events.dovan_assembly.say'));
    const j = x.jobs(ev);
    if (j.g < 2 || j.s < 2) await ev.say('hall_chair', R.T('events.dovan_assembly.say_2'));
    const labels = R.T('events.dovan_assembly.labels').concat(x.accordOk(ev) ? [R.T('events.dovan_assembly.labels.0')] : []).concat([R.T('events.dovan_assembly.labels.0_2')]);
    const i = await ev.choose(labels, { text: R.T('events.dovan_assembly.i.choose.text') });
    const pick = labels[i];
    if (!pick || pick === R.T('events.dovan_assembly.labels.0_2')) { await ev.say('hall_chair', R.T('events.dovan_assembly.say_3')); return; }
    const side = i === 0 ? 'guild' : i === 1 ? 'smiths' : 'accord';
    ev.choice('ch_mine_side', side);
    ev.setFlag('mine_choice');
    ev.leadDone('l_mine_guild');
    ev.leadDone('l_mine_smiths');
    ev.leadDone('l_mine_door');
    ev.lead('l_mine_warden');
    if (side === 'guild') {
      await ev.say(null, R.T('events.dovan_assembly.say_4'));
      await ev.say('hall_chair', R.T('events.dovan_assembly.say_5'));
    } else if (side === 'smiths') {
      await ev.say(null, R.T('events.dovan_assembly.say_6'));
      await ev.say('hall_chair', R.T('events.dovan_assembly.say_7'));
    } else {
      await ev.say(null, R.T('events.dovan_assembly.say_8'));
      await ev.say('hall_chair', R.T('events.dovan_assembly.say_9'));
    }
    await ev.say('hall_chair', R.T('events.dovan_assembly.say_10'));
  }, { meta: { needs: ['flag:mine_door_seen'], gives: ['choice:ch_mine_side', 'flag:mine_choice', 'lead:l_mine_warden'] } });

  // ---------------------------------------------------------------- 隠者の庵（#15。碑文の古い写し・問答 3 問 → 隠者の数珠）
  const QUIZ = [
    { q: R.T('ev.mine_dovan.QUIZ.0.q'), a: R.T('ev.mine_dovan.QUIZ.0.a'), ok: 0 },
    { q: R.T('ev.mine_dovan.QUIZ.1.q'), a: R.T('ev.mine_dovan.QUIZ.1.a'), ok: 1 },
    { q: R.T('ev.mine_dovan.QUIZ.2.q'), a: R.T('ev.mine_dovan.QUIZ.2.a'), ok: 1 },
  ];
  E('mine_hermit', async (ev) => {
    if (!ev.flag('mine_hermit_met')) {
      ev.setFlag('mine_hermit_met');
      ev.leadDone('l_opt_hermit');
      await ev.say('hermit', R.T('events.mine_hermit.say'));
    }
    if (ev.flag('mine_helga_jobs') && !ev.has('k_oath_copy') && !ev.flag('mine_job_s1')) {
      await ev.say('hermit', R.T('events.mine_hermit.say_2'));
      ev.item('k_oath_copy', 1);
      await ev.say('hermit', R.T('events.mine_hermit.say_3'));
      return;
    }
    if (ev.flag('mine_hermit_quiz')) { await ev.say('hermit', R.T('events.mine_hermit.say_4')); return; }
    const i = await ev.choose(R.T('events.mine_hermit.i.choose'), { text: R.T('events.mine_hermit.i.choose.text') });
    if (i !== 0) return;
    for (const q of QUIZ) {
      const k = await ev.choose(q.a, { text: q.q });
      if (k !== q.ok) { await ev.say('hermit', R.T('events.mine_hermit.say_5')); return; }
    }
    ev.setFlag('mine_hermit_quiz');
    await ev.say('hermit', R.T('events.mine_hermit.say_6'));
    ev.item('u_hermit_beads', 1);
  }, { meta: { needs: [], gives: ['flag:mine_hermit_met', 'item:k_oath_copy', 'flag:mine_hermit_quiz', 'item:u_hermit_beads'] } });
  void objAt; void BORG; void HELGA;
})(window.RPG);
