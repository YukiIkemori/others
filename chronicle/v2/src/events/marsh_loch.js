// CONTENT（湿原）: 水辺の町ロッホの人と物・推理・集会（WORLD_REDESIGN §5.7・§4.4、STORY_BIBLE §7.4・§8.5）。
//   流れ: 着く（松明の人だかり）→ 宿でエマ → 証拠集め（足あと〈夜〉・鐘楼の記録帳・ベッポの人形・リナの絵・館のメルダ・沼の縁の石碑）
//         → 証拠 4 つで集会所の集会 → 名指し（霧そのもの = 正しい。証拠 1・2・4・6 のうち 3 つを示す）→ 町の人と沼へ（marsh_assembly_done）。
//         間違えて名指しすると、その人が捕まり、その夜もう一人子どもが消える。翌朝、新しい証拠が 1 つ出て、集会をやり直せる（3 回まで。3 回目の後は正しい証拠がそろう）。
//   消灯の刻（marsh_night）: 宿で「消灯の刻まで休む」。灯が落ち、夜市が開き、運河の岸に光る足あとが見える。フィーネは夜の橋（証拠 2 つ以上）。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。仲間の名前は出さない（A36）。ボイスは使わない。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Marsh.ev;
  const cleared = (ev) => ev.flag('cleared_r_marsh');
  const night = (ev) => ev.flag('marsh_night');
  const FINE = { name: R.T('ev.marsh_loch.FINE.name') };

  // ---------------------------------------------------------------- 町に入る
  E('loch_arrival', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('marsh_arrived_after')) { ev.setFlag('marsh_arrived_after'); await ev.caption(R.T('events.loch_arrival.caption'), { ms: 2400 }); }
      return;
    }
    if (!ev.flag('marsh_arrived')) {
      ev.setFlag('marsh_arrived');
      await ev.caption(R.T('events.loch_arrival.caption_2'), { ms: 2600 });
      await ev.caption(R.T('events.loch_arrival.caption_3'), { ms: 2200 });
      await ev.say(null, R.T('events.loch_arrival.say'), { name: R.T('events.loch_arrival.say.name') });
      ev.lead('l_marsh_mist');
      ev.lead('l_marsh_emma');
      return;
    }
    if (night(ev) && !ev.flag('marsh_night_seen')) {
      ev.setFlag('marsh_night_seen');
      await ev.caption(R.T('events.loch_arrival.caption_4'), { ms: 2200 });
    }
  }, { meta: { needs: [], gives: ['flag:marsh_arrived', 'lead:l_marsh_mist', 'lead:l_marsh_emma'] } });

  // 松明の人だかり（集会が済むまで）
  E('loch_mob', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'mob_leader';
    if (ev.flag('marsh_held_beppo') || ev.flag('marsh_held_tobias') || ev.flag('marsh_held_melda')) {
      await ev.say(id, R.T('events.loch_mob.say'));
      return;
    }
    if (!ev.flag('marsh_emma_met')) { await ev.say(id, R.T('events.loch_mob.say_2')); return; }
    if (ev.flag('marsh_can_assemble')) { await ev.say(id, R.T('events.loch_mob.say_3')); return; }
    await ev.say(id, R.T('events.loch_mob.say_4'));
  });

  // ---------------------------------------------------------------- エマ（宿 → 家）
  E('loch_emma', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'emma_inn';
    if (cleared(ev)) {
      const said = ev.flag('marsh_yena_torn');
      await ev.say(id, said ? R.T('events.loch_emma.say') : R.T('events.loch_emma.say_2'));
      return;
    }
    if (!ev.flag('marsh_emma_met')) {
      ev.setFlag('marsh_emma_met');
      await ev.say(id, R.T('events.loch_emma.say_3'));
      ev.lead('l_marsh_evidence');
      ev.leadDone('l_marsh_emma');
      await ev.caption(R.T('events.loch_emma.caption'), { ms: 2200 });
      try { await ev.leave(id); } catch (e) { /* */ }
      return;
    }
    const n = X().count(ev);
    await ev.say(id, n >= 4 ? R.T('events.loch_emma.say_4') : R.T('events.loch_emma.say_5'));
  }, { meta: { needs: ['flag:marsh_arrived'], gives: ['flag:marsh_emma_met', 'lead:l_marsh_evidence'] } });

  // エマの家: 妹リナの絵（証拠 4）
  E('loch_emma_drawing', async (ev) => {
    await ev.say(null, R.T('events.loch_emma_drawing.say'));
    if (!ev.flag('marsh_emma_met')) return;
    await X().evidence(ev, 'drawing');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_ev_drawing', 'lead:l_marsh_ev_drawing', 'var:marsh_evidence'] } });
  E('loch_lina', async (ev) => {
    if (cleared(ev)) { await ev.say('lina', R.T('events.loch_lina.say')); return; }
    await ev.say('lina', R.T('events.loch_lina.say_2'));
    if (ev.flag('marsh_emma_met')) await X().evidence(ev, 'drawing');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_ev_drawing', 'lead:l_marsh_ev_drawing', 'var:marsh_evidence'] } });

  // 静夜会のイェナ（任意。エマの家の前。同席するとエマが奉納の紙を破る）
  E('loch_yena', async (ev) => {
    if (ev.flag('marsh_yena_done')) return;
    await ev.say('yena', R.T('events.loch_yena.say'));
    const i = await ev.choose(R.T('events.loch_yena.i.choose'), { text: R.T('events.loch_yena.i.choose.text') });
    ev.setFlag('marsh_yena_done');
    if (i === 0) {
      await ev.say(null, R.T('events.loch_yena.say_2'));
      await ev.say(null, R.T('events.loch_yena.say_3'), { name: R.T('events.loch_yena.say.name') });
      ev.setFlag('marsh_yena_torn');
      await ev.say('yena', R.T('events.loch_yena.say_4'));
    }
    try { await ev.leave('yena'); } catch (e) { /* */ }
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_yena_done'] } });

  // ---------------------------------------------------------------- 宿「霧笛亭」: 灯りの刻と消灯の刻（E9）
  E('loch_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? R.T('events.loch_inn_keeper.say') : R.T('events.loch_inn_keeper.say_2'));
    // いつまで休むかは宿の画面で選ぶ（選択肢の後に「泊まる」だけの画面を重ねない。テスター 2026-10-02 P37 と同じ）
    const ok = await ev.inn(undefined, { choices: R.T('events.loch_inn_keeper.i.choose').slice(0, 2), text: R.T('events.loch_inn_keeper.i.choose.text') });
    if (!ok) return;
    const i = ok.pick;
    ev.setFlag('marsh_night', i === 0);
    await ev.caption(i === 0 ? R.T('events.loch_inn_keeper.caption') : R.T('events.loch_inn_keeper.caption_2'), { ms: 2200 });
  }, { meta: { needs: [], gives: ['flag:marsh_night'] } });
  E('loch_inn_guest', async (ev) => {
    await ev.say('inn_guest', R.T('events.loch_inn_guest.say'));
    ev.lead('l_opt_lotus');
  }, { meta: { needs: [], gives: ['lead:l_opt_lotus'] } });

  // ---------------------------------------------------------------- 夜: 運河の岸の光る足あと（証拠 1）
  E('loch_footprints', async (ev) => {
    await ev.say(null, R.T('events.loch_footprints.say'));
    if (ev.flag('marsh_emma_met')) await X().evidence(ev, 'foot');
  }, { meta: { needs: ['flag:marsh_emma_met', 'flag:marsh_night'], gives: ['flag:marsh_ev_foot', 'lead:l_marsh_ev_foot', 'var:marsh_evidence'] } });

  // 夜の運河の橋: 灰色のマントの少女（v_fine_marsh_01 の文のまま。声はあとで）
  E('loch_bridge_fine', async (ev) => {
    if (ev.flag('marsh_fine_seen')) return;
    ev.setFlag('marsh_fine_seen');
    R.Audio && R.Audio.pushBgm && R.Audio.pushBgm('fine_theme');
    try {
      await ev.say(null, R.T('events.loch_bridge_fine.say'));
      await ev.say('fine', R.T('events.loch_bridge_fine.say_2'), Object.assign({ voice: 'v_fine_marsh_01' }, FINE));
      ev.sfx('magic');
      try { await ev.leave('fine', { path: [[27, 27], [27, 29]], ms: 900 }); } catch (e) { /* */ }
      await ev.caption(R.T('events.loch_bridge_fine.caption'), { ms: 2000 });
    } finally { R.Audio && R.Audio.popBgm && R.Audio.popBgm(); }
  }, { meta: { needs: ['flag:marsh_night'], gives: ['flag:marsh_fine_seen'] } });

  // ---------------------------------------------------------------- 鐘楼（トビアス。記録帳 = 証拠 2、貸し出し簿、第七の鐘）
  E('loch_tobias', async (ev) => {
    if (cleared(ev)) { await ev.call('loch_tobias_reward'); return; }
    if (ev.flag('marsh_held_tobias')) return;
    if (!ev.flag('marsh_tobias_met')) {
      ev.setFlag('marsh_tobias_met');
      await ev.say('tobias', R.T('events.loch_tobias.say'));
      ev.item('k_blank_score', 1);
      await ev.say('tobias', R.T('events.loch_tobias.say_2'));
      await X().lore(ev, 'lo_ev_marsh');
      ev.lead('l_main_recorder_marsh');
      return;
    }
    await ev.say('tobias', ev.flag('marsh_ev_book') ? R.T('events.loch_tobias.say_3') : [R.T('events.loch_tobias.say.0')]);
    if (!ev.flag('lo_war_marsh')) {
      await ev.say('tobias', R.T('events.loch_tobias.say_4'));
      await X().lore(ev, 'lo_war_marsh');
    }
  }, { meta: { needs: [], gives: ['flag:marsh_tobias_met', 'item:k_blank_score', 'lore:lo_ev_marsh', 'lore:lo_war_marsh', 'lead:l_main_recorder_marsh'], calls: ['loch_tobias_reward'] } });
  E('loch_tower_book', async (ev) => {
    await ev.say(null, R.T('events.loch_tower_book.say'));
    await X().lore(ev, 'lo_time_marsh');
    await ev.say(null, R.T('events.loch_tower_book.say_2'));
    if (ev.flag('marsh_emma_met')) await X().evidence(ev, 'book');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['lore:lo_time_marsh', 'flag:marsh_ev_book', 'lead:l_marsh_ev_book', 'var:marsh_evidence'] } });
  E('loch_tower_ladder', async (ev) => { await ev.say(null, R.T('events.loch_tower_ladder.say')); });
  E('loch_tower_bell', async (ev) => {
    await ev.say(null, cleared(ev) ? R.T('events.loch_tower_bell.say') : R.T('events.loch_tower_bell.say_2'));
  });
  E('loch_tobias_reward', async (ev) => {
    if (ev.flag('marsh_tobias_reward')) { await ev.say('tobias', R.T('events.loch_tobias_reward.say')); return; }
    ev.setFlag('marsh_tobias_reward');
    await ev.say('tobias', R.T('events.loch_tobias_reward.say_2'));
    ev.item('ac_tale_marsh', 1);
  }, { meta: { needs: ['flag:cleared_r_marsh'], gives: ['flag:marsh_tobias_reward', 'item:ac_tale_marsh'] } });

  // ---------------------------------------------------------------- 人形師ベッポ（消えた子に似た人形 = 証拠 3）
  E('loch_beppo', async (ev) => {
    if (cleared(ev)) { await ev.say('beppo', ev.flag('marsh_held_beppo_was') ? R.T('events.loch_beppo.say') : R.T('events.loch_beppo.say_2')); return; }
    await ev.say('beppo', R.T('events.loch_beppo.say_3'));
    if (ev.flag('marsh_emma_met')) await ev.say('beppo', R.T('events.loch_beppo.say_4'));
  });
  E('loch_beppo_dolls', async (ev) => {
    await ev.say(null, R.T('events.loch_beppo_dolls.say'));
    if (ev.flag('marsh_emma_met')) await X().evidence(ev, 'doll');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_ev_doll', 'lead:l_marsh_ev_doll', 'var:marsh_evidence'] } });
  E('loch_beppo_order', async (ev) => {
    await ev.say(null, R.T('events.loch_beppo_order.say'));
  });

  // ---------------------------------------------------------------- 記録院ロッホ出張所（クラウス。写したことを覚えていない）
  E('loch_klaus', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'klaus';
    if (cleared(ev)) {
      await ev.say(id, R.T('events.loch_klaus.say'));
      return;
    }
    await ev.say(id, R.T('events.loch_klaus.say_2'));
    if (!ev.flag('marsh_klaus_met')) { ev.setFlag('marsh_klaus_met'); ev.lead('l_main_recorder_marsh'); }
  }, { meta: { needs: [], gives: ['flag:marsh_klaus_met', 'lead:l_main_recorder_marsh'] } });
  E('loch_klaus_desk', async (ev) => {
    if (ev.flag('marsh_lz_got')) { await ev.say(null, R.T('events.loch_klaus_desk.say')); return; }
    ev.setFlag('marsh_lz_got');
    await ev.say(null, R.T('events.loch_klaus_desk.say_2'));
    await X().lz(ev);
  }, { meta: { needs: [], gives: ['flag:marsh_lz_got'] } });
  E('loch_klaus_shelf', async (ev) => { await ev.say(null, [R.T('events.loch_klaus_shelf.say.0')]); });

  // ---------------------------------------------------------------- 町の人（近況・ほのめかし）
  E('loch_bard', async (ev) => {
    if (cleared(ev)) { await ev.say('bard', [R.T('events.loch_bard.say.0'), X().SONG]); return; }
    await ev.say('bard', R.T('events.loch_bard.say'));
    ev.lead('l_opt_lotus');
  }, { meta: { needs: [], gives: ['lead:l_opt_lotus'] } });
  E('loch_child', async (ev) => { await ev.say('child_plaza', X().skyLine() || [R.T('events.loch_child.say.0')]); });
  E('loch_gate_w', async (ev) => {
    await ev.say('guard_w', cleared(ev) ? [R.T('events.loch_gate_w.say.0')] : R.T('events.loch_gate_w.say'));
  });
  E('loch_gate_e', async (ev) => {
    if (cleared(ev)) { await ev.say('guard_e', R.T('events.loch_gate_e.say')); return; }
    await ev.say('guard_e', R.T('events.loch_gate_e.say_2'));
    ev.lead('l_marsh_manor');
  }, { meta: { needs: [], gives: ['lead:l_marsh_manor'] } });
  E('loch_fisher', async (ev) => {
    await ev.say('fisher', cleared(ev) ? R.T('events.loch_fisher.say') : R.T('events.loch_fisher.say_2'));
  });
  E('loch_laundress', async (ev) => {
    await ev.say('laundress', cleared(ev) ? R.T('events.loch_laundress.say') : R.T('events.loch_laundress.say_2'));
  });
  E('loch_boy', async (ev) => {
    await ev.say('boy_south', cleared(ev) ? R.T('events.loch_boy.say') : R.T('events.loch_boy.say_2'));
  });
  E('loch_ferryman', async (ev) => {
    await ev.say('ferryman', [R.T('events.loch_ferryman.say.0')]);
  });
  E('loch_ferry', async (ev, ctx) => {
    const o = ctx && R.DB.maps.loch && (R.DB.maps.loch.objects || []).find((q) => q.type === 'examine' && q.event === 'loch_ferry' && q.x === ctx.x && q.y === ctx.y);
    const side = (o && o.side) || 'n';
    const i = await ev.choose(R.T('events.loch_ferry.i.choose'), { text: R.T('events.loch_ferry.i.choose.text') });
    if (i !== 0) return;
    await ev.fade('out', 400);
    await ev.warp('loch', side === 'n' ? 'ferry_s' : 'ferry_n');
  }, { meta: { needs: [], gives: [] } });
  E('loch_board', async (ev) => {
    const lines = [];
    lines.push(cleared(ev) ? R.T('events.loch_board') : R.T('events.loch_board_2'));
    lines.push(ev.flag('marsh_cat_done') ? R.T('events.loch_board_3') : R.T('events.loch_board_4'));
    if (X().tier() >= 2) lines.push(R.T('events.loch_board_5'));
    await ev.say(null, lines);
  });
  E('loch_bell_tongue', async (ev) => {
    await ev.say(null, R.T('events.loch_bell_tongue.say'));
  });

  // ---------------------------------------------------------------- 店・酒場
  E('loch_item_keeper', async (ev) => { await ev.say('item_keeper', R.T('events.loch_item_keeper.say')); await ev.shop('shop_loch_items'); });
  E('loch_smith', async (ev) => { await ev.say('smith', R.T('events.loch_smith.say')); await ev.shop('shop_loch_arms'); });
  E('loch_barkeep', async (ev) => {
    await ev.say('barkeep', cleared(ev) ? R.T('events.loch_barkeep.say') : R.T('events.loch_barkeep.say_2'));
    ev.lead('l_marsh_evidence');
  }, { meta: { needs: [], gives: ['lead:l_marsh_evidence'] } });
  E('loch_tav_bard', async (ev) => {
    await ev.say('tav_bard', R.T('events.loch_tav_bard.say'));
    ev.lead('l_opt_lotus');
  }, { meta: { needs: [], gives: ['lead:l_opt_lotus'] } });
  E('loch_tav_sailor', async (ev) => {
    await ev.say('tav_sailor', R.T('events.loch_tav_sailor.say'));
  });
  E('loch_tav_match', async (ev) => {
    await ev.say('tav_match', cleared(ev) ? R.T('events.loch_tav_match.say') : R.T('events.loch_tav_match.say_2'));
  });

  // ---------------------------------------------------------------- 町長・集会所（集会は loch_assembly）
  E('loch_mayor', async (ev) => { await ev.call('loch_assembly'); }, { meta: { needs: [], gives: [] } });
  E('loch_hall_clerk', async (ev) => {
    const n = X().count(ev);
    await ev.say('hall_clerk', ev.flag('marsh_assembly_done') ? R.T('events.loch_hall_clerk.say') : n >= 4 ? R.T('events.loch_hall_clerk.say_2') : R.T('events.loch_hall_clerk.say_3', { n }));
  });
  E('loch_hall_board', async (ev) => { await ev.say(null, R.T('events.loch_hall_board.say')); });
  E('loch_mayor_shelf', async (ev) => { await ev.say(null, [R.T('events.loch_mayor_shelf.say.0')]); });
  E('loch_mayor_wife', async (ev) => {
    if (!ev.flag('marsh_mayor_wife_gift')) {
      ev.setFlag('marsh_mayor_wife_gift');
      await ev.say('mayor_wife', R.T('events.loch_mayor_wife.say'));
      X().small(ev, [['i_waker', 3], ['i_waker', 4], ['i_clear', 3], ['i_clear', 4], ['i_panacea', 2]]);
      return;
    }
    await ev.say('mayor_wife', cleared(ev) ? R.T('events.loch_mayor_wife.say_2') : R.T('events.loch_mayor_wife.say_3'));
  });

  // ================================================================ 集会（推理の山場）
  E('loch_assembly', async (ev) => {
    const x = X();
    if (cleared(ev)) { await ev.say('mayor', R.T('events.loch_assembly.say')); return; }
    if (ev.flag('marsh_assembly_done')) {
      await ev.say('mayor', ev.has('k_bell_key') ? R.T('events.loch_assembly.say_2') : R.T('events.loch_assembly.say_3'));
      if (!ev.has('k_bell_key')) ev.lead('l_marsh_manor');
      return;
    }
    const n = x.count(ev);
    if (n < 4) {
      await ev.say('mayor', [R.T('events.loch_assembly.say.0'), R.T('events.loch_assembly.say.1', { n }), R.T('events.loch_assembly.say.2')]);
      ev.lead('l_marsh_evidence');
      return;
    }
    // 集会
    await ev.fade('out', 500);
    await ev.caption(R.T('events.loch_assembly.caption'), { ms: 2400 });
    await ev.fade('in', 400);
    await ev.say('mayor', [R.T('events.loch_assembly.say.0_2')], { voice: 'v_mayor_marsh_01' });
    for (;;) {
      const i = await ev.choose(x.SUSPECTS.map((s) => s.name), { important: true, text: R.T('events.loch_assembly.i.choose.text') });
      const who = x.SUSPECTS[i].id;
      if (who === 'melda' && ev.flag('marsh_ev_melda') && !ev.flag('marsh_melda_warned')) {
        ev.setFlag('marsh_melda_warned');
        await ev.say(null, R.T('events.loch_assembly.say_4'));
        continue;
      }
      if (who !== 'mist') { await ev.call('loch_accuse_wrong', { who }); return; }
      break;
    }
    // 霧そのもの: 証拠を 3 つ示す
    await ev.say('mayor', R.T('events.loch_assembly.say_5'), { voice: ['v_mayor_marsh_02', 'v_mayor_marsh_03'] });
    let good = 0;
    const shown = new Set();
    while (good < 3) {
      const list = x.EVIDENCE.filter((e) => x.has(ev, e.id) && !shown.has(e.id));
      if (!list.length) break;
      const i = await ev.choose(list.map((e) => e.name).concat([R.T('events.loch_assembly.i.choose.0')]), { important: true, text: R.T('events.loch_assembly.i.choose.text_2', { p0: 3 - good }) });
      if (i >= list.length) break;
      const e = list[i];
      shown.add(e.id);
      await ev.say(null, e.say);
      if (e.right) {
        good++;
        await ev.say(null, good >= 3 ? R.T('events.loch_assembly.say_6') : R.T('events.loch_assembly.say_7'));
      } else {
        await ev.say(null, e.id === 'doll' ? R.T('events.loch_assembly.say_8') : R.T('events.loch_assembly.say_9'), { name: R.T('events.loch_assembly.say.name') });
      }
    }
    if (good < 3) {
      await ev.say('mayor', R.T('events.loch_assembly.say_10'));
      return;
    }
    await ev.call('loch_assembly_right');
  }, {
    meta: {
      needs: ['flag:marsh_ev_foot', 'flag:marsh_ev_book', 'flag:marsh_ev_drawing', 'flag:marsh_ev_stone'],
      gives: ['flag:marsh_assembly_done', 'choice:ch_marsh_accuse', 'lead:l_marsh_bog'],
      calls: ['loch_accuse_wrong', 'loch_assembly_right'],
    },
  });

  // 正しい名指し: 町の人と沼へ（沼の入口の霧の壁を松明で押し広げる）
  E('loch_assembly_right', async (ev) => {
    if (ev.flag('marsh_assembly_done')) return;
    const wrong = ev.var('marsh_wrong');
    await ev.say('mayor', R.T('events.loch_assembly_right.say'), { voice: ['v_mayor_marsh_04', 'v_mayor_marsh_05'] });
    if (wrong) await ev.say('mayor', R.T('events.loch_assembly_right.say_2'));
    for (const w of ['beppo', 'tobias', 'melda']) if (ev.flag('marsh_held_' + w)) { ev.setFlag('marsh_held_' + w, false); ev.setFlag('marsh_held_' + w + '_was'); }
    ev.choice('ch_marsh_accuse', wrong ? 'wrong' : 'first');
    ev.setFlag('marsh_assembly_done');
    ev.leadDone('l_marsh_assembly');
    ev.leadDone('l_marsh_evidence');
    ev.lead('l_marsh_bog');
    await ev.fade('out', 600);
    await ev.caption(R.T('events.loch_assembly_right.caption'), { ms: 2600 });
    await ev.caption(R.T('events.loch_assembly_right.caption_2'), { ms: 2600 });
    await ev.fade('in', 400);
    await ev.say('mayor', ev.has('k_bell_key') ? R.T('events.loch_assembly_right.say_3') : R.T('events.loch_assembly_right.say_4'));
  }, { meta: { needs: [], gives: ['flag:marsh_assembly_done', 'choice:ch_marsh_accuse', 'lead:l_marsh_bog'] } });

  // 間違えた名指し: その人が捕まり、その夜もう一人消える。翌朝、新しい証拠が 1 つ出る（3 回目の後は正しい証拠がそろう）
  E('loch_accuse_wrong', async (ev, ctx) => {
    const x = X();
    const who = (ctx && ctx.who) || 'beppo';
    const name = { melda: R.T('events.loch_accuse_wrong.name.melda'), beppo: R.T('events.loch_accuse_wrong.name.beppo'), tobias: R.T('events.loch_accuse_wrong.name.tobias') }[who];
    await ev.say('mayor', who === 'melda' ? R.T('events.loch_accuse_wrong.say') : [R.T('events.loch_accuse_wrong.say.0', { name }), R.T('events.loch_accuse_wrong.say.1')]);
    ev.setFlag('marsh_held_' + who);
    ev.addVar('marsh_wrong', 1);
    ev.addVar('marsh_lost', 1);
    await ev.fade('out', 800);
    await ev.caption(R.T('events.loch_accuse_wrong.caption'), { ms: 2000 });
    await ev.caption(R.T('events.loch_accuse_wrong.caption_2'), { ms: 2600 });
    ev.setFlag('marsh_night', false);
    await ev.warp('loch_hall', 'door');
    // 新しい証拠（正しい証拠のうち、まだ無い物を 1 つ。3 回目なら全部）
    const missing = x.EVIDENCE.filter((e) => e.right && !x.has(ev, e.id));
    const give = ev.var('marsh_wrong') >= 3 ? missing : missing.slice(0, 1);
    await ev.say('mayor', [R.T('events.loch_accuse_wrong.say.0_2', { name }), R.T('events.loch_accuse_wrong.say.1_2')]);
    for (const e of give) {
      await ev.say(null, { foot: R.T('events.loch_accuse_wrong.say.foot'), book: R.T('events.loch_accuse_wrong.say.book'), drawing: R.T('events.loch_accuse_wrong.say.drawing'), stone: R.T('events.loch_accuse_wrong.say.stone') }[e.id]);
      await x.evidence(ev, e.id);
    }
    await ev.say('mayor', R.T('events.loch_accuse_wrong.say_2'));
  }, { meta: { needs: [], gives: ['var:marsh_wrong'] } });

  // ================================================================ 依頼
  // 迷い猫ミーナ（夜の高床の下）
  E('loch_night_owl', async (ev) => {
    if (ev.flag('marsh_cat_done')) { await ev.say('night_owl', R.T('events.loch_night_owl.say')); return; }
    if (ev.flag('marsh_cat_found')) {
      ev.take('k_lost_cat', 1);
      ev.setFlag('marsh_cat_done');
      ev.leadDone('q_marsh_cat');
      await ev.say('night_owl', R.T('events.loch_night_owl.say_2'));
      X().small(ev, [['i_ether', 2], ['i_ether', 2], ['i_ether', 3], ['i_ether2', 1], ['i_ether2', 2]]);
      return;
    }
    await ev.say('night_owl', R.T('events.loch_night_owl.say_3'));
    ev.setFlag('q_marsh_cat_on');
    ev.lead('q_marsh_cat');
  }, { meta: { needs: ['flag:marsh_night'], gives: ['flag:q_marsh_cat_on', 'lead:q_marsh_cat', 'flag:marsh_cat_done'] } });
  E('loch_cat', async (ev) => {
    await ev.say('lost_cat', R.T('events.loch_cat.say'));
    ev.setFlag('marsh_cat_found');
    ev.item('k_lost_cat', 1);
    try { await ev.leave('lost_cat', { ms: 500 }); } catch (e) { /* */ }
    await ev.caption(R.T('events.loch_cat.caption'), { ms: 2000 });
  }, { meta: { needs: ['flag:q_marsh_cat_on'], gives: ['flag:marsh_cat_found', 'item:k_lost_cat'] } });

  // 【灯りを守る】運河の灯籠（消灯の刻に、油で 3 つ）
  E('loch_lampkeeper', async (ev) => {
    if (ev.flag('marsh_lanterns_done')) { await ev.say('lamp_keeper', R.T('events.loch_lampkeeper.say')); return; }
    const lit = [1, 2, 3].filter((n) => ev.flag('marsh_canal_lamp_' + n)).length;
    if (lit >= 3) {
      ev.setFlag('marsh_lanterns_done');
      ev.leadDone('q_marsh_lanterns');
      ev.take('k_canal_oil', 1);
      await ev.say('lamp_keeper', R.T('events.loch_lampkeeper.say_2'));
      X().small(ev, [['gold', 200], ['gold', 300], ['gold', 450], ['gold', 600], ['gold', 800]]);
      return;
    }
    if (ev.has('k_canal_oil')) { await ev.say('lamp_keeper', R.T('events.loch_lampkeeper.say_3', { p0: 3 - lit })); return; }
    await ev.say('lamp_keeper', R.T('events.loch_lampkeeper.say_4'));
    ev.item('k_canal_oil', 1);
    ev.setFlag('q_marsh_lanterns_on');
    ev.lead('q_marsh_lanterns');
  }, { meta: { needs: [], gives: ['item:k_canal_oil', 'flag:q_marsh_lanterns_on', 'lead:q_marsh_lanterns', 'flag:marsh_lanterns_done'] } });
  E('loch_canal_lamp', async (ev, ctx) => {
    const o = ctx && R.DB.maps.loch && (R.DB.maps.loch.objects || []).find((q) => q.type === 'examine' && q.event === 'loch_canal_lamp' && q.x === ctx.x && q.y === ctx.y);
    const n = (o && o.lamp) || 1;
    if (ev.flag('marsh_canal_lamp_' + n)) { await ev.say(null, R.T('events.loch_canal_lamp.say')); return; }
    if (!night(ev)) { await ev.say(null, R.T('events.loch_canal_lamp.say_2')); return; }
    if (!ev.has('k_canal_oil')) { await ev.say(null, R.T('events.loch_canal_lamp.say_3')); return; }
    ev.setFlag('marsh_canal_lamp_' + n);
    ev.sfx('fire');
    await ev.say(null, R.T('events.loch_canal_lamp.say_4'));
  }, { meta: { needs: ['flag:q_marsh_lanterns_on', 'flag:marsh_night'], gives: ['flag:marsh_canal_lamp_1', 'flag:marsh_canal_lamp_2', 'flag:marsh_canal_lamp_3'] } });

  // 夜市（消灯の刻だけ）
  E('loch_night_market', async (ev) => {
    await ev.say('night_vendor', [R.T('events.loch_night_market.say.0'), X().tier() >= 2 ? R.T('events.loch_night_market.say.1') : R.T('events.loch_night_market.say.1_2')]);
    await ev.shop('shop_loch_night');
  });
})(window.RPG);
