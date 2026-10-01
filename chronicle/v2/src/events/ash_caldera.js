// CONTENT（灰の荒野）: 炎の町カルデラの人と物・炎の試練（闘技大会）（WORLD_REDESIGN §5.11・§4.7、STORY_BIBLE §7.7・§8.8）。
//   流れ: 着く（闘技場の歓声・受付の列）→ 受付で出場（名簿 = lo_ev_ash）→ 5 回戦（回ごとに控え室で全快、負けたらその回から）
//         → 4 回戦のあと宿で休むと、決勝の前夜の使い（八百長の誘い ch_ash_bribe）→ 決勝ザクロ → 優勝（ash_champion。族長が火山の岩戸を開ける）
//         → 火山（ash_volcano.js）。巫女カヤ（卵・壁画）と族長ドルガ（歌い手の夜 = lo_war_ash）は好きな時に。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。仲間の名前は出さない（A36）。
//   ボイスは本筋の要の台詞だけ（ドルガ・カヤ・ザクロ。design/voice/story_v2_lines.csv）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Ash.ev;
  const cleared = (ev) => ev.flag('cleared_r_ash');
  const champ = (ev) => ev.flag('ash_champion');
  const KAYA = { name: R.T('ev.ash_caldera.KAYA.name') }, DORGA = { name: R.T('ev.ash_caldera.DORGA.name') }, ZAKURO = { name: R.T('ev.ash_caldera.ZAKURO.name') };

  // ---------------------------------------------------------------- 町に入る・闘技場に入る
  E('caldera_arrival', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('ash_arrived_after')) { ev.setFlag('ash_arrived_after'); await ev.caption(R.T('events.caldera_arrival.caption'), { ms: 2400 }); }
      return;
    }
    if (ev.flag('ash_arrived')) return;
    ev.setFlag('ash_arrived');
    await ev.caption(R.T('events.caldera_arrival.caption_2'), { ms: 2600 });
    await ev.caption(R.T('events.caldera_arrival.caption_3'), { ms: 2000 });
    ev.lead('l_ash_trial');
  }, { meta: { needs: [], gives: ['flag:ash_arrived', 'lead:l_ash_trial'] } });
  E('caldera_arena_arrive', async (ev) => {
    if (ev.flag('ash_arena_seen')) return;
    ev.setFlag('ash_arena_seen');
    await ev.caption(cleared(ev) ? R.T('events.caldera_arena_arrive.caption') : R.T('events.caldera_arena_arrive.caption_2'), { ms: 2200 });
  });

  // ---------------------------------------------------------------- 受付（出場・次の回・決勝の前夜・挑戦者の間）
  E('caldera_arena_reception', async (ev) => {
    const x = X();
    if (cleared(ev)) { await ev.call('caldera_arena_challenge'); return; }
    if (champ(ev)) { await ev.say('receptionist', R.T('events.caldera_arena_reception.say')); await ev.shop('shop_arena'); return; }
    if (!ev.flag('ash_entered')) {
      await ev.say('receptionist', R.T('events.caldera_arena_reception.say_2'));
      const i = await ev.choose(R.T('events.caldera_arena_reception.i.choose'), { text: R.T('events.caldera_arena_reception.i.choose.text') });
      if (i !== 0) return;
      ev.setFlag('ash_entered');
      ev.item('k_arena_token', 1);
      await ev.say('receptionist', R.T('events.caldera_arena_reception.say_3'));
      ev.lead('l_ash_stranger');
      ev.leadDone('l_ash_trial');
      ev.lead('l_ash_trial');
      return;
    }
    const n = x.round(ev) + 1;
    if (n > 5) return;
    if (n === 5 && !ev.flag('ash_eve_done')) {
      await ev.say('receptionist', R.T('events.caldera_arena_reception.say_4'));
      return;
    }
    const b = x.BOUTS[n];
    const i = await ev.choose([R.T('events.caldera_arena_reception.i.choose.0', { name: b.name }), R.T('events.caldera_arena_reception.i.choose.1')], { text: R.T('events.caldera_arena_reception.i.choose.text_2', { name: b.name, foe: b.foe }) });
    if (i !== 0) return;
    await ev.call('caldera_arena_bout', { n });
  }, { meta: { needs: [], gives: ['flag:ash_entered', 'item:k_arena_token', 'lead:l_ash_stranger'], calls: ['caldera_arena_bout', 'caldera_arena_challenge'] } });

  // 1 回戦ぶん: 砂の場へ → 相手が現れる → 戦い → 勝てば控え室で全快（負けてもその回から）
  E('caldera_arena_bout', async (ev, ctx) => {
    const x = X();
    const n = (ctx && ctx.n) || x.round(ev) + 1;
    const b = x.BOUTS[n];
    if (!b) return;
    await ev.fade('out', 500);
    await ev.warp('caldera_arena', 'sand');
    ev.setVar('ash_bout', n);
    ev.sfx('cheer');
    await ev.caption(R.T('events.caldera_arena_bout.caption', { name: b.name }), { ms: 2000 });
    await ev.say(null, b.intro);
    if (n === 5) await ev.call('caldera_arena_final_words');
    const r = await ev.battle(b.troop, { canLose: true, boss: n >= 4 });
    ev.setVar('ash_bout', 0);
    if (r !== 'win') {
      ev.addVar('ash_losses', 1);
      await ev.fade('out', 500);
      await ev.warp('caldera_arena', 'waiting');
      ev.rest();
      await ev.caption(R.T('events.caldera_arena_bout.caption_2'), { ms: 2000 });
      await ev.say('receptionist', R.T('events.caldera_arena_bout.say', { name: b.name }));
      return;
    }
    ev.setVar('ash_round', n);
    ev.setFlag('ash_round_' + n);
    if (n === 5) { await ev.call('caldera_arena_champion'); return; }
    await ev.caption(R.T('events.caldera_arena_bout.caption_3', { name: b.name }), { ms: 2200 });
    await ev.fade('out', 400);
    await ev.warp('caldera_arena', 'waiting');
    ev.rest();
    await ev.caption(R.T('events.caldera_arena_bout.caption_4'), { ms: 1800 });
  }, { meta: { needs: ['flag:ash_entered'], gives: ['var:ash_round+5', 'flag:ash_round_4'], calls: ['caldera_arena_champion', 'caldera_arena_final_words'] } });

  // 決勝の前のザクロ（律儀）
  E('caldera_arena_final_words', async (ev) => {
    await ev.say('opp_5', R.T('events.caldera_arena_final_words.say'), ZAKURO);
    if (ev.choiceOf('ch_ash_bribe') === 'accept') await ev.say('opp_5', R.T('events.caldera_arena_final_words.say_2'), ZAKURO);
  });

  // 優勝: 族長が砂に下りてくる → 火口の岩戸を開ける（ash_champion）
  E('caldera_arena_champion', async (ev) => {
    if (champ(ev)) return;
    ev.setFlag('ash_champion');
    if (!ev.var('ash_losses')) ev.setFlag('ash_unbeaten');
    ev.bgm('dawn');
    await ev.caption(R.T('events.caldera_arena_champion.caption'), { ms: 2800 });
    await ev.say(null, R.T('events.caldera_arena_champion.say'));
    await ev.say('dorga', R.T('events.caldera_arena_champion.say_2'), DORGA);
    if (ev.choiceOf('ch_ash_bribe') === 'accept') await ev.say('dorga', R.T('events.caldera_arena_champion.say_3'), DORGA);
    if (ev.flag('ash_unbeaten')) await ev.caption(R.T('events.caldera_arena_champion.caption_2'), { ms: 2600 });
    ev.leadDone('l_ash_trial');
    ev.leadDone('l_ash_stranger');
    ev.lead('l_ash_volcano');
    ev.lead('l_ash_egg');
    ev.take('k_arena_token', 1);
    await ev.fade('out', 400);
    await ev.warp('caldera_arena', 'waiting');
    ev.rest();
    ev.mapBgm();
  }, { meta: { needs: ['var:ash_round>=5'], gives: ['flag:ash_champion', 'lead:l_ash_volcano', 'lead:l_ash_egg'], warp: { to: 'caldera_arena', spawn: 'waiting' } } });

  // ---------------------------------------------------------------- 決勝の前夜（宿で休むと使いが来る。八百長の誘い）
  E('ash_eve', async (ev) => {
    if (ev.flag('ash_eve_done') || X().round(ev) < 4) return;
    ev.setFlag('ash_eve_on');
    await ev.caption(R.T('events.ash_eve.caption'), { ms: 2000 });
    try { await ev.appear('messenger', { ms: 700 }); } catch (e) { /* */ }
    await ev.say('messenger', R.T('events.ash_eve.say'));
    const i = await ev.choose(R.T('events.ash_eve.i.choose'), { text: R.T('events.ash_eve.i.choose.text') });
    if (i === 1) {
      ev.choice('ch_ash_bribe', 'accept');
      await ev.say('messenger', R.T('events.ash_eve.say_2'));
      await ev.say(null, R.T('events.ash_eve.say_3'));
    } else {
      ev.choice('ch_ash_bribe', 'refuse');
      await ev.say('messenger', R.T('events.ash_eve.say_4'));
    }
    try { await ev.leave('messenger', { ms: 700 }); } catch (e) { /* */ }
    ev.setFlag('ash_eve_on', false);
    ev.setFlag('ash_eve_done');
  }, { meta: { needs: ['flag:ash_round_4'], gives: ['flag:ash_eve_done', 'choice:ch_ash_bribe'] } });

  // ---------------------------------------------------------------- 宿「湯けむり亭」
  E('caldera_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? R.T('events.caldera_inn_keeper.say') : R.T('events.caldera_inn_keeper.say_2'));
    const i = await ev.choose(R.T('events.caldera_inn_keeper.i.choose'), { who: 'inn_keeper', text: R.T('events.caldera_inn_keeper.i.choose.text') });
    if (i !== 0) return;
    const ok = await ev.inn();
    if (!ok) return;
    if (X().round(ev) >= 4 && !ev.flag('ash_eve_done')) await ev.call('ash_eve');
  }, { meta: { needs: [], gives: [], calls: ['ash_eve'] } });
  E('caldera_inn_guest', async (ev) => {
    await ev.say('inn_guest', R.T('events.caldera_inn_guest.say'));
    ev.lead('l_opt_spa');
    ev.lead('l_opt_battlefield');
  }, { meta: { needs: [], gives: ['lead:l_opt_spa', 'lead:l_opt_battlefield'] } });

  // ---------------------------------------------------------------- 火の神殿（巫女カヤ・種火・火の鳥の巡りの記録）
  E('caldera_kaya', async (ev) => {
    if (cleared(ev)) { await ev.call('caldera_kaya_after'); return; }
    if (!ev.flag('ash_kaya_met')) {
      ev.setFlag('ash_kaya_met');
      await ev.say('kaya', R.T('events.caldera_kaya.say'), KAYA);
      await ev.say('kaya', R.T('events.caldera_kaya.say_2'), Object.assign({ voice: 'v_kaya_ash_01' }, KAYA));
      await ev.say('kaya', R.T('events.caldera_kaya.say_3'), Object.assign({ voice: 'v_kaya_ash_02' }, KAYA));
      await ev.say('kaya', R.T('events.caldera_kaya.say_4'), KAYA);
      ev.lead('l_ash_egg');
      ev.lead('l_ash_murals');
      ev.lead('l_ash_trial');
      ev.lead('l_main_recorder_ash');
      return;
    }
    const k = X().murals(ev);
    if (ev.flag('ash_lavabeast')) await ev.say('kaya', R.T('events.caldera_kaya.say_5'), KAYA);
    else if (k >= 3) await ev.say('kaya', R.T('events.caldera_kaya.say_6'), KAYA);
    else if (k > 0) await ev.say('kaya', R.T('events.caldera_kaya.say_7'), KAYA);
    else if (champ(ev)) await ev.say('kaya', R.T('events.caldera_kaya.say_8'), KAYA);
    else await ev.say('kaya', R.T('events.caldera_kaya.say_9'), KAYA);
  }, { meta: { needs: [], gives: ['flag:ash_kaya_met', 'lead:l_ash_egg', 'lead:l_ash_murals', 'lead:l_main_recorder_ash'], calls: ['caldera_kaya_after'] } });
  // 解決の後: 残り火の宝珠（ac_tale_ash）と、火の鳥の背（止まり木）
  E('caldera_kaya_after', async (ev) => {
    if (!ev.flag('ash_kaya_reward')) {
      ev.setFlag('ash_kaya_reward');
      await ev.say('kaya', R.T('events.caldera_kaya_after.say'), KAYA);
      await ev.say('kaya', R.T('events.caldera_kaya_after.say_2'), KAYA);
      ev.item('ac_tale_ash', 1);
      await ev.say('kaya', R.T('events.caldera_kaya_after.say_3'), KAYA);
      ev.item('k_phoenix_plume', 1);
      return;
    }
    const i = await ev.choose(R.T('events.caldera_kaya_after.i.choose'), { text: R.T('events.caldera_kaya_after.i.choose.text') });
    if (i === 0) { await ev.call('caldera_phoenix'); return; }
    const t = X().tier();
    await ev.say('kaya', t >= 6 ? R.T('events.caldera_kaya_after.say_4') : t >= 4 ? R.T('events.caldera_kaya_after.say_5') : R.T('events.caldera_kaya_after.say_6'), KAYA);
  }, { meta: { needs: ['flag:cleared_r_ash'], gives: ['flag:ash_kaya_reward', 'item:ac_tale_ash', 'item:k_phoenix_plume'] } });
  // 火の鳥の背（WORLD §2.5）: 行ったことのある町へ飛ぶ。天空の石舞台などの止まり木は、あとの工程で足す
  E('caldera_phoenix', async (ev) => {
    if (!ev.has('k_phoenix_plume')) return;
    const list = (R.Field && R.Field.warpList ? R.Field.warpList() : []).filter((l) => l.kind === 'town' && l.id !== 'caldera');
    if (!list.length) { await ev.say(null, R.T('events.caldera_phoenix.say')); return; }
    const i = await ev.choose(list.map((l) => l.name).concat([R.T('events.caldera_phoenix.i.choose.0')]), { text: R.T('events.caldera_phoenix.i.choose.text') });
    if (i < 0 || i >= list.length) return;
    await ev.caption(R.T('events.caldera_phoenix.caption'), { ms: 2200 });
    await ev.fade('out', 600);
    const loc = R.DB.locations[list[i].id];
    await ev.warp(loc.map, loc.spawn);
  }, { meta: { needs: ['item:k_phoenix_plume'], gives: [] } });
  E('caldera_acolyte_in', async (ev) => {
    await ev.say('acolyte_in', cleared(ev) ? R.T('events.caldera_acolyte_in.say') : R.T('events.caldera_acolyte_in.say_2'));
  });
  E('caldera_temple_record', async (ev) => {
    await ev.say(null, R.T('events.caldera_temple_record.say'));
    await X().lore(ev, 'lo_time_ash');
  }, { meta: { needs: [], gives: ['lore:lo_time_ash'] } });
  // 【灯りを守る】火守りの見習い: 神殿の種火を、崖の上の灯籠 3 つへ
  E('caldera_seed_fire', async (ev) => {
    if (ev.flag('q_ash_lanterns_on') && !ev.has('k_seed_fire') && !ev.flag('ash_lanterns_done')) {
      await ev.say(null, R.T('events.caldera_seed_fire.say'));
      ev.item('k_seed_fire', 1);
      return;
    }
    await ev.say(null, [R.T('events.caldera_seed_fire.say.0'), cleared(ev) ? R.T('events.caldera_seed_fire.say.1') : R.T('events.caldera_seed_fire.say.1_2')]);
  }, { meta: { needs: ['flag:q_ash_lanterns_on'], gives: ['item:k_seed_fire'] } });
  E('caldera_apprentice', async (ev) => {
    if (ev.flag('ash_lanterns_done')) { await ev.say('apprentice', R.T('events.caldera_apprentice.say')); return; }
    const lit = [1, 2, 3].filter((n) => ev.flag('ash_lantern_' + n)).length;
    if (lit >= 3) {
      ev.setFlag('ash_lanterns_done');
      ev.leadDone('q_ash_lanterns');
      ev.take('k_seed_fire', 1);
      await ev.say('apprentice', R.T('events.caldera_apprentice.say_2'));
      X().small(ev, [['gold', 200], ['gold', 300], ['gold', 450], ['gold', 600], ['gold', 800]]);
      return;
    }
    if (ev.flag('q_ash_lanterns_on')) { await ev.say('apprentice', R.T('events.caldera_apprentice.say_3', { p0: 3 - lit })); return; }
    await ev.say('apprentice', R.T('events.caldera_apprentice.say_4'));
    ev.setFlag('q_ash_lanterns_on');
    ev.lead('q_ash_lanterns');
  }, { meta: { needs: [], gives: ['flag:q_ash_lanterns_on', 'lead:q_ash_lanterns', 'flag:ash_lanterns_done'] } });
  E('caldera_lantern', async (ev, ctx) => {
    const o = ctx && R.DB.maps.caldera && (R.DB.maps.caldera.objects || []).find((q) => q.type === 'examine' && q.event === 'caldera_lantern' && q.x === ctx.x && q.y === ctx.y);
    const n = (o && o.lamp) || 1;
    if (ev.flag('ash_lantern_' + n)) { await ev.say(null, R.T('events.caldera_lantern.say')); return; }
    if (!ev.has('k_seed_fire')) { await ev.say(null, R.T('events.caldera_lantern.say_2')); return; }
    ev.setFlag('ash_lantern_' + n);
    ev.sfx('fire');
    await ev.say(null, R.T('events.caldera_lantern.say_3'));
  }, { meta: { needs: ['item:k_seed_fire'], gives: ['flag:ash_lantern_1', 'flag:ash_lantern_2', 'flag:ash_lantern_3'] } });

  // ---------------------------------------------------------------- 族長ドルガ（歌い手の夜 = lo_war_ash）
  E('caldera_dorga', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'dorga';
    if (ev.flag('ash_finale_done')) {
      await ev.say(id, ev.choiceOf('ch_ash_write') === 'pain' ? R.T('events.caldera_dorga.say') : R.T('events.caldera_dorga.say_2'), DORGA);
      return;
    }
    if (!ev.flag('ash_dorga_met')) {
      ev.setFlag('ash_dorga_met');
      await ev.say(id, R.T('events.caldera_dorga.say_3'), DORGA);
      ev.lead('l_ash_trial');
      return;
    }
    if (!ev.flag('lo_war_ash')) {
      await ev.say(id, R.T('events.caldera_dorga.say_4'), DORGA);
      await ev.say(id, R.T('events.caldera_dorga.say_5'), Object.assign({ voice: 'v_dorga_ash_01' }, DORGA));
      await ev.say(id, R.T('events.caldera_dorga.say_6'), Object.assign({ voice: 'v_dorga_ash_02' }, DORGA));
      await X().lore(ev, 'lo_war_ash');
      return;
    }
    await ev.say(id, champ(ev) ? R.T('events.caldera_dorga.say_7') : R.T('events.caldera_dorga.say_8'), DORGA);
  }, { meta: { needs: [], gives: ['flag:ash_dorga_met', 'lead:l_ash_trial', 'lore:lo_war_ash'] } });
  E('caldera_dorga_blade', async (ev) => {
    await ev.say(null, R.T('events.caldera_dorga_blade.say'));
  });

  // ---------------------------------------------------------------- 闘技場の人と物（名簿・銘板・立会人の席・賭け・ザクロ）
  E('caldera_arena_roster', async (ev) => {
    await ev.say(null, R.T('events.caldera_arena_roster.say'));
    await X().lore(ev, 'lo_ev_ash');
    ev.lead('l_main_recorder_ash');
    ev.lead('l_ash_stranger');
  }, { meta: { needs: [], gives: ['lore:lo_ev_ash', 'lead:l_main_recorder_ash', 'lead:l_ash_stranger'] } });
  E('caldera_arena_plaque', async (ev) => {
    const lines = R.T('events.caldera_arena_plaque.lines');
    if (ev.flag('ash_singer_board')) lines.push(R.T('events.caldera_arena_plaque'));
    await ev.say(null, lines);
    await X().lore(ev, 'lo_time_ash');
  }, { meta: { needs: [], gives: ['lore:lo_time_ash'] } });
  E('caldera_arena_witness_seat', async (ev) => {
    await ev.say(null, R.T('events.caldera_arena_witness_seat.say'));
  });
  E('caldera_arena_board', async (ev) => {
    const lines = [R.T('events.caldera_arena_board.lines.0')];
    if (ev.flag('ash_unbeaten')) lines.push(R.T('events.caldera_arena_board'));
    else if (champ(ev)) lines.push(R.T('events.caldera_arena_board_2'));
    await ev.say(null, lines);
  });
  E('caldera_arena_rest', async (ev) => {
    if (!ev.flag('ash_entered') || champ(ev)) { await ev.say(null, R.T('events.caldera_arena_rest.say')); return; }
    const i = await ev.choose(R.T('events.caldera_arena_rest.i.choose'), { text: R.T('events.caldera_arena_rest.i.choose.text') });
    if (i !== 0) return;
    await ev.fade('out', 400);
    ev.rest();
    await ev.fade('in', 400);
    await ev.caption(R.T('events.caldera_arena_rest.caption'), { ms: 1600 });
  });
  E('caldera_arena_zakuro_bag', async (ev) => {
    if (!champ(ev)) { await ev.say(null, [R.T('events.caldera_arena_zakuro_bag.say.0')]); return; }
    await ev.say(null, ev.flag('ash_zakuro_letter') ? R.T('events.caldera_arena_zakuro_bag.say') : [R.T('events.caldera_arena_zakuro_bag.say.0_2')]);
  });
  E('caldera_arena_zakuro', async (ev) => {
    if (ev.flag('ash_zakuro_letter')) { await ev.say('zakuro', R.T('events.caldera_arena_zakuro.say'), ZAKURO); return; }
    await ev.say('zakuro', R.T('events.caldera_arena_zakuro.say_2'), ZAKURO);
    await ev.say('zakuro', R.T('events.caldera_arena_zakuro.say_3'), Object.assign({ voice: 'v_zakuro_ash_01' }, ZAKURO));
    await ev.say('zakuro', R.T('events.caldera_arena_zakuro.say_4'), ZAKURO);
    await ev.say('zakuro', R.T('events.caldera_arena_zakuro.say_5'), Object.assign({ voice: 'v_zakuro_ash_02' }, ZAKURO));
    ev.setFlag('ash_zakuro_letter');
    await X().lz(ev);
    try { await ev.leave('zakuro'); } catch (e) { /* */ }
    ev.setFlag('ash_zakuro_gone');
  }, { meta: { needs: ['flag:ash_champion'], gives: ['flag:ash_zakuro_letter', 'flag:ash_zakuro_gone'] } });
  E('caldera_arena_dorga', async (ev) => { await ev.call('caldera_dorga', { npc: 'dorga_plaque' }); });
  E('caldera_arena_fan', async (ev) => {
    await ev.say('caldera_arena_fan', cleared(ev) ? (X().skyLine() || [R.T('events.caldera_arena_fan.say.0')]) : champ(ev) ? R.T('events.caldera_arena_fan.say') : R.T('events.caldera_arena_fan.say_2'));
  });
  E('caldera_arena_vet', async (ev) => {
    await ev.say('caldera_arena_vet', R.T('events.caldera_arena_vet.say'));
    ev.lead('l_opt_turtle');
  }, { meta: { needs: [], gives: ['lead:l_opt_turtle'] } });
  // 賭け（順番・選択: ほかの試合の勝ちを当てる。段位ごとに 1 回だけ品）
  E('caldera_arena_bookie', async (ev) => {
    const x = X();
    await ev.say('bookie', ev.flag('ash_bet_done') ? R.T('events.caldera_arena_bookie.say') : R.T('events.caldera_arena_bookie.say_2'));
    ev.lead('q_ash_bet');
    const MATCHES = [
      { a: R.T('events.caldera_arena_bookie.MATCHES.0.a'), b: R.T('events.caldera_arena_bookie.MATCHES.0.b'), odds: 2, hint: R.T('events.caldera_arena_bookie.MATCHES.0.hint') },
      { a: R.T('events.caldera_arena_bookie.MATCHES.1.a'), b: R.T('events.caldera_arena_bookie.MATCHES.1.b'), odds: 2, hint: R.T('events.caldera_arena_bookie.MATCHES.1.hint') },
      { a: R.T('events.caldera_arena_bookie.MATCHES.2.a'), b: R.T('events.caldera_arena_bookie.MATCHES.2.b'), odds: 3, hint: R.T('events.caldera_arena_bookie.MATCHES.2.hint') },
    ];
    const step = Math.min(ev.var('ash_bet_step'), 2);
    const m = MATCHES[step];
    const stake = [100, 200, 300][step];
    const i = await ev.choose([R.T('events.caldera_arena_bookie.i.choose.0', { a: m.a }), R.T('events.caldera_arena_bookie.i.choose.1', { b: m.b }), R.T('events.caldera_arena_bookie.i.choose.2')], { text: R.T('events.caldera_arena_bookie.i.choose.text', { a: m.a, b: m.b, stake }) });
    if (i === 2 || i < 0) return;
    if ((R.Game.gold || 0) < stake) { await ev.say('bookie', R.T('events.caldera_arena_bookie.say_3')); return; }
    ev.gold(-stake, { silent: true });
    await ev.caption(R.T('events.caldera_arena_bookie.caption', { a: m.a, b: m.b }), { ms: 2000 });
    // 勝つのは、ほのめかしのとおり（前の賭けで聞ける）。はじめの一口は運
    const seed = (R.Game.seed || 1) + ':ash_bet:' + step + ':' + (ev.var('ash_bet_tries') || 0);
    ev.addVar('ash_bet_tries', 1);
    const heard = ev.flag('ash_bet_hint_' + step);
    const winner = heard ? (step === 0 ? 1 : step === 1 ? 0 : 0) : (R.rng(seed).next() < 0.5 ? 0 : 1);
    if (i === winner) {
      ev.gold(stake * m.odds);
      ev.setVar('ash_bet_step', step + 1);
      await ev.say('bookie', step + 1 >= 3 && !ev.flag('ash_bet_done') ? R.T('events.caldera_arena_bookie.say_4') : R.T('events.caldera_arena_bookie.say_5'));
      if (step + 1 >= 3 && !ev.flag('ash_bet_done')) {
        ev.setFlag('ash_bet_done');
        ev.leadDone('q_ash_bet');
        x.small(ev, [['i_ether', 3], ['i_ether', 3], ['i_ether2', 1], ['i_ether2', 2], ['i_ether2', 2], ['i_elixir', 1]]);   // 表はティア順。癒やしの霊水（全回復）は終盤（ティア 5）から（オーナー 2026-09-28）
      }
    } else {
      ev.setFlag('ash_bet_hint_' + step);
      await ev.say('bookie', [R.T('events.caldera_arena_bookie.say.0'), R.T('events.caldera_arena_bookie.say.1', { hint: m.hint })]);
    }
  }, { meta: { needs: [], gives: ['lead:q_ash_bet', 'flag:ash_bet_done'] } });
  // 挑戦者の間（解決の後。5 組の勝ち抜き。3 組と 5 組で品。ティア連動）
  E('caldera_arena_challenge', async (ev) => {
    await ev.say('receptionist', ev.flag('ash_challenge_done') ? R.T('events.caldera_arena_challenge.say') : R.T('events.caldera_arena_challenge.say_2'));
    ev.lead('q_ash_challenge');
    const i = await ev.choose(R.T('events.caldera_arena_challenge.i.choose'), { text: R.T('events.caldera_arena_challenge.i.choose.text') });
    if (i === 1) { await ev.shop('shop_arena'); return; }
    if (i !== 0) return;
    const list = ['tr_ash_r1', 'tr_b_ash_r2', 'tr_b_ash_r3', 'tr_b_ash_r4', 'tr_b_zakuro'];
    await ev.fade('out', 400);
    await ev.warp('caldera_arena', 'sand');
    let won = 0;
    for (let k = 0; k < list.length; k++) {
      if (k > 0) {
        const c = await ev.choose(R.T('events.caldera_arena_challenge.c.choose'), { text: R.T('events.caldera_arena_challenge.c.choose.text', { k }) });
        if (c !== 0) break;
      }
      await ev.caption(R.T('events.caldera_arena_challenge.caption', { p0: k + 1 }), { ms: 1200 });
      const r = await ev.battle(list[k], { canLose: true, boss: k >= 3 });
      if (r !== 'win') break;
      won = k + 1;
      if (won === 3 && !ev.flag('ash_challenge_3')) { ev.setFlag('ash_challenge_3'); X().small(ev, [['i_potion', 3], ['i_potion', 4], ['i_incense', 2], ['i_incense', 3], ['i_incense', 3], ['i_elixir', 2]]); }   // 表はティア順。癒やしの霊水（全回復）は終盤（ティア 5）から（オーナー 2026-09-28）
      if (won === 5 && !ev.flag('ash_challenge_done')) { ev.setFlag('ash_challenge_done'); ev.leadDone('q_ash_challenge'); X().small(ev, [['gold', 800], ['gold', 1200], ['gold', 1800], ['gold', 2400], ['gold', 3000]]); }
    }
    await ev.fade('out', 400);
    await ev.warp('caldera_arena', 'waiting');
    ev.rest();
    await ev.caption(R.T('events.caldera_arena_challenge.caption_2', { won }), { ms: 2000 });
  }, { meta: { needs: ['flag:cleared_r_ash'], gives: ['lead:q_ash_challenge', 'flag:ash_challenge_done'] } });

  // ---------------------------------------------------------------- 店・酒場
  E('caldera_item_keeper', async (ev) => { await ev.say('item_keeper', R.T('events.caldera_item_keeper.say')); await ev.shop('shop_caldera_items'); });
  E('caldera_smith', async (ev) => { await ev.say('smith', R.T('events.caldera_smith.say')); await ev.shop('shop_caldera_arms'); });
  E('caldera_barkeep', async (ev) => {
    await ev.say('barkeep', cleared(ev) ? R.T('events.caldera_barkeep.say') : R.T('events.caldera_barkeep.say_2'));
    ev.lead('l_ash_stranger');
  }, { meta: { needs: [], gives: ['lead:l_ash_stranger'] } });
  E('caldera_zakuro', async (ev) => {
    await ev.say('zakuro_tav', R.T('events.caldera_zakuro.say'));
    ev.lead('l_ash_stranger');
  }, { meta: { needs: [], gives: ['lead:l_ash_stranger'] } });
  E('caldera_tav_fighter', async (ev) => {
    await ev.say('tav_fighter', R.T('events.caldera_tav_fighter.say'));
  });
  E('caldera_tav_bookie', async (ev) => { await ev.say('tav_bookie', R.T('events.caldera_tav_bookie.say')); ev.lead('q_ash_bet'); }, { meta: { needs: [], gives: ['lead:q_ash_bet'] } });

  // ---------------------------------------------------------------- 町の人（近況・ほのめかし）・温泉の番
  E('caldera_gate_w', async (ev) => {
    await ev.say('guard_w', cleared(ev) ? [R.T('events.caldera_gate_w.say.0')] : R.T('events.caldera_gate_w.say'));
    ev.lead('l_ash_trial');
  }, { meta: { needs: [], gives: ['lead:l_ash_trial'] } });
  E('caldera_gate_e', async (ev) => {
    await ev.say('guard_e', champ(ev) ? R.T('events.caldera_gate_e.say') : R.T('events.caldera_gate_e.say_2'));
    if (champ(ev)) ev.lead('l_ash_volcano');
  }, { meta: { needs: [], gives: [] } });
  E('caldera_oldman', async (ev) => {
    await ev.say('oldman', cleared(ev) ? R.T('events.caldera_oldman.say') : R.T('events.caldera_oldman.say_2'));
  });
  E('caldera_woman', async (ev) => {
    await ev.say('woman', cleared(ev) ? R.T('events.caldera_woman.say') : R.T('events.caldera_woman.say_2'));
  });
  E('caldera_child', async (ev) => { await ev.say('child', X().skyLine() || (champ(ev) ? R.T('events.caldera_child.say') : R.T('events.caldera_child.say_2'))); });
  E('caldera_spa', async (ev) => {
    if (ev.flag('ash_spa_done')) {
      const i = await ev.choose(R.T('events.caldera_spa.i.choose'), { text: R.T('events.caldera_spa.i.choose.text') });
      if (i !== 0) return;
      await ev.fade('out', 500);
      ev.rest();
      await ev.fade('in', 500);
      await ev.caption(R.T('events.caldera_spa.caption'), { ms: 1800 });
      return;
    }
    await ev.say(null, R.T('events.caldera_spa.say'));
  });
  E('caldera_spa_keeper', async (ev) => {
    if (ev.flag('ash_spa_done')) { await ev.say('spa_keeper', R.T('events.caldera_spa_keeper.say')); return; }
    if (ev.has('k_spa_salt')) {
      ev.take('k_spa_salt', 1);
      ev.setFlag('ash_spa_done');
      ev.leadDone('q_ash_spa');
      ev.sfx('heal');
      await ev.say('spa_keeper', R.T('events.caldera_spa_keeper.say_2'));
      return;
    }
    await ev.say('spa_keeper', R.T('events.caldera_spa_keeper.say_3'));
    ev.setFlag('q_ash_spa_on');
    ev.lead('q_ash_spa');
    ev.lead('l_opt_spa');
  }, { meta: { needs: [], gives: ['flag:q_ash_spa_on', 'lead:q_ash_spa', 'lead:l_opt_spa', 'flag:ash_spa_done'] } });
  E('caldera_board', async (ev) => {
    const lines = [];
    lines.push(cleared(ev) ? R.T('events.caldera_board') : R.T('events.caldera_board_2'));
    lines.push(ev.flag('ash_spa_done') ? R.T('events.caldera_board_3') : R.T('events.caldera_board_4'));
    if (X().tier() >= 2) lines.push(R.T('events.caldera_board_5'));
    await ev.say(null, lines);
  });
  E('caldera_house_spear', async (ev) => { await ev.say(null, R.T('events.caldera_house_spear.say')); });
  E('caldera_widow', async (ev) => {
    if (!ev.flag('ash_widow_gift')) {
      ev.setFlag('ash_widow_gift');
      await ev.say('widow', R.T('events.caldera_widow.say'));
      X().small(ev, [['i_salve', 3], ['i_potion', 2], ['i_potion', 3], ['i_panacea', 1], ['i_panacea', 2]]);
      return;
    }
    await ev.say('widow', cleared(ev) ? R.T('events.caldera_widow.say_2') : R.T('events.caldera_widow.say_3'));
  });
  E('caldera_house_kid', async (ev) => { await ev.say('house_kid', R.T('events.caldera_house_kid.say')); });
})(window.RPG);
// 段の上の小さな屋内（鍛冶場・灰よけの蔵・見習いの家）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Ash.ev;
  E('caldera_blacksmith', async (ev) => {
    await ev.say('blacksmith', ev.flag('cleared_r_ash') ? [R.T('events.caldera_blacksmith.say.0')] : R.T('events.caldera_blacksmith.say'));
  });
  E('caldera_anvil', async (ev) => { await ev.say(null, [R.T('events.caldera_anvil.say.0')]); });
  E('caldera_granary_keeper', async (ev) => {
    await ev.say('granary_keeper', ev.flag('cleared_r_ash') ? [R.T('events.caldera_granary_keeper.say.0')] : R.T('events.caldera_granary_keeper.say'));
  });
  E('caldera_toto_mother', async (ev) => {
    await ev.say('toto_mother', ev.flag('ash_lanterns_done') ? R.T('events.caldera_toto_mother.say') : X().skyLine() || R.T('events.caldera_toto_mother.say_2'));
  });
})(window.RPG);
