// CONTENT（ガルド山地）: 深き坑道・七の層・灯り直す場面（WORLD_REDESIGN §4.6 の流れ 1〜5・§6.4、STORY_BIBLE §7.6・§11.8）。
//   1 階: 落盤の奥の鉱夫ダグ・割れ目の子猫・トロッコ（縦穴の架台を渡る）・坑夫のカンテラ。
//   2 階: 水びたしの坑道の奥の鉱夫ロルフ・休み場（交代表 lo_time_mine・ラザロの手紙・幽霊）・岩食らい（中ボス、どの道でも戦う）→ ピップ（誓いのハンマー）。
//         ピップ: 「下を見たら、自分の名前が一瞬、出てこなかった」。
//   3 階（七の層）: 誓いのハンマーで岩戸を打つ → 隙間から白い下の層 → 番人が目を覚ましかける（v_guardian_mine_01）→ いったん町へ（集会所で選ぶ）。
//         選んだあと: 岩戸が開く → 広間の番人（v_guardian_mine_02。A・B・C 共通）
//           A 組合: 戦う tr_b_ironwarden → 声なしで締める（「……われの役目も、これまでか」の地の文）
//           B 鍛冶衆: 誓いの歌（字幕）→ v_guardian_mine_03 → 眠る
//           C 仲裁: 誓い直しの問答（選択肢 3 つ、どれでも進む）→ v_guardian_mine_03 → 眠る
//   灯り直す場面: 鍛冶神の炉に火が戻り、地下の町の灯りがいっせいに明るくなる（ドヴァンの誓いの碑の前）→ clearRegion('r_mine') →
//   選んだ道の場面（A 組合の祝杯と町を去る鍛冶衆／B 鍛冶場の火入れと肩を落とす組合／C 同じ卓）→ 礼（ac_tale_mine と道の品・近道）→
//   年代記に書く選択 ch_mine_write（誓いの話 story ／（痛）武器の帳簿も pain: ボルグとヘルガが同じ卓で帳簿を閉じ、広場に「刃を溶かす日」）→ 日継ぎの主張。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Mine.ev;
  const cleared = (ev) => ev.flag('cleared_r_mine');
  const objAt = (ctx, event) => { const m = ctx && R.DB.maps[ctx.map]; return m && (m.objects || []).find((o) => (o.type === 'examine' || o.type === 'waylamp') && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const WARDEN = { name: R.T('ev.mine_deep.WARDEN.name') }, PIP = { name: R.T('ev.mine_deep.PIP.name') }, BORG = { name: R.T('ev.mine_deep.BORG.name') }, HELGA = { name: R.T('ev.mine_deep.HELGA.name') };

  // ================================================================ 1 階
  E('mine_arrive', async (ev) => {
    if (ev.flag('mine_seen')) return;
    ev.setFlag('mine_seen');
    await ev.caption(R.T('events.mine_arrive.caption'), { ms: 2600 });
  }, { meta: { needs: [], gives: ['flag:mine_seen'] } });
  E('mine_cavein', async (ev) => {
    await ev.say(null, ev.flag('mine_miner1') ? R.T('events.mine_cavein.say') : R.T('events.mine_cavein.say_2'));
  });
  E('mine_miner1', async (ev) => {
    const x = X();
    if (ev.flag('mine_miner1')) return;
    await ev.say('miner1', R.T('events.mine_miner1.say'));
    await ev.say(null, R.T('events.mine_miner1.say_2'));
    ev.sfx('earth');
    await ev.say('miner1', R.T('events.mine_miner1.say_3'));
    await ev.say('miner1', R.T('events.mine_miner1.say_4'));
    x.rescue(ev, 'mine_miner1');
    await ev.fade('out', 400);
    await ev.caption(R.T('events.mine_miner1.caption'), { ms: 1800 });
    await ev.fade('in', 400);
  }, { meta: { needs: [], gives: ['flag:mine_miner1', 'var:mine_rescued+1', 'flag:mine_rescued_all'] } });
  // 割れ目の子猫（落盤の子猫の依頼）
  E('mine_kitten', async (ev) => {
    if (!ev.flag('mine_kitten_asked') || ev.flag('mine_kitten_found')) return;
    await ev.say(null, R.T('events.mine_kitten.say'));
    ev.setFlag('mine_kitten_found');
    ev.guest('ani_cat');
    await ev.caption(R.T('events.mine_kitten.caption'), { ms: 2000 });
  }, { meta: { needs: ['flag:mine_kitten_asked'], gives: ['flag:mine_kitten_found'] } });
  // トロッコ（縦穴の架台を渡る。どちらの乗り場からも）
  E('mine_cart_ride', async (ev, ctx) => {
    const o = objAt(ctx, 'mine_cart_ride');
    const to = (o && o.ride) || 'cart_e';
    await ev.say(null, R.T('events.mine_cart_ride.say'));
    const i = await ev.choose(R.T('events.mine_cart_ride.i.choose'), { text: R.T('events.mine_cart_ride.i.choose.text') });
    if (i !== 0) return;
    ev.sfx('earth');
    await ev.fade('out', 400);
    await ev.caption(R.T('events.mine_cart_ride.caption'), { ms: 1600 });
    await ev.warp('mine_1', to);
    await ev.fade('in', 400);
  }, { meta: { needs: [], gives: [], warp: { to: 'mine_1', spawn: 'cart_e' } } });
  // 坑夫のカンテラ（【灯りを守る】。3 か所）
  E('mine_lamp', async (ev, ctx) => {
    const o = objAt(ctx, 'mine_lamp');
    const m = o && /^wl_mine_(\d)$/.exec(o.id || '');
    if (!m) return;
    const key = 'mine_lamp_' + m[1];
    if (ev.flag(key)) { await ev.say(null, R.T('events.mine_lamp.say')); return; }
    if (!ev.has('k_mine_oil')) { await ev.say(null, R.T('events.mine_lamp.say_2')); return; }
    await ev.say(null, R.T('events.mine_lamp.say_3'));
    ev.sfx('lamp');
    ev.setFlag(key);
    const n = ev.addVar('mine_lamps', 1);
    await ev.caption(R.T('events.mine_lamp.caption', { n }), { ms: 1600 });
    if (n >= 3) { ev.take('k_mine_oil', 1); await ev.caption(R.T('events.mine_lamp.caption_2'), { ms: 1800 }); }
  }, { meta: { needs: ['item:k_mine_oil'], gives: ['var:mine_lamps+1', 'flag:mine_lamp_1', 'flag:mine_lamp_2', 'flag:mine_lamp_3'] } });

  // ================================================================ 2 階
  E('mine_f2_arrive', async (ev) => {
    if (ev.flag('mine_f2_seen')) return;
    ev.setFlag('mine_f2_seen');
    await ev.caption(R.T('events.mine_f2_arrive.caption'), { ms: 2200 });
  });
  E('mine_miner2', async (ev) => {
    const x = X();
    if (ev.flag('mine_miner2')) return;
    await ev.say('miner2', R.T('events.mine_miner2.say'));
    await ev.say('miner2', R.T('events.mine_miner2.say_2'));
    await ev.say('miner2', R.T('events.mine_miner2.say_3'));
    x.rescue(ev, 'mine_miner2');
    await ev.fade('out', 400);
    await ev.caption(R.T('events.mine_miner2.caption'), { ms: 1800 });
    await ev.fade('in', 400);
  }, { meta: { needs: [], gives: ['flag:mine_miner2', 'var:mine_rescued+1', 'flag:mine_rescued_all'] } });
  // 坑夫の休み場: 交代表（lo_time_mine）・長いす・ラザロの手紙・幽霊
  E('mine_shift_board', async (ev) => {
    const x = X();
    await ev.say(null, R.T('events.mine_shift_board.say'));
    await ev.say(null, R.T('events.mine_shift_board.say_2'));
    await ev.say(null, R.T('events.mine_shift_board.say_3'));
    await x.lore(ev, 'lo_time_mine');
  }, { meta: { needs: [], gives: ['lore:lo_time_mine'] } });
  E('mine_rest_bench', async (ev) => {
    await ev.say(null, R.T('events.mine_rest_bench.say'));
  });
  E('mine_lz', async (ev) => {
    const x = X();
    if (ev.flag('mine_lz_got')) { await ev.say(null, R.T('events.mine_lz.say')); return; }
    await ev.say(null, R.T('events.mine_lz.say_2'));
    await ev.say(null, R.T('events.mine_lz.say_3'));
    ev.setFlag('mine_lz_got');
    await x.lz(ev);
  }, { meta: { needs: [], gives: ['flag:mine_lz_got', 'lore:lo_lz_2'] } });
  E('mine_ghost', async (ev) => {
    if (ev.flag('mine_ghost_done')) return;
    await ev.say('ghost', R.T('events.mine_ghost.say'));
    await ev.say('ghost', R.T('events.mine_ghost.say_2'));
    await ev.say('ghost', R.T('events.mine_ghost.say_3'));
    await ev.say('ghost', R.T('events.mine_ghost.say_4'));
    await ev.say('ghost', R.T('events.mine_ghost.say_5'));
    await ev.say('ghost', R.T('events.mine_ghost.say_6'));
    ev.setFlag('mine_ghost_done');
    ev.leadDone('q_mine_ghost');
    try { await ev.leave('ghost', { ms: 1400 }); } catch (e) { /* */ }
    await ev.caption(R.T('events.mine_ghost.caption'), { ms: 2000 });
  }, { meta: { needs: ['flag:mine_lamp_2'], gives: ['flag:mine_ghost_done'] } });
  // 岩食らい（中ボス。横穴をふさいでいる）
  E('mine_rockeater', async (ev) => {
    if (ev.flag('mine_rockeater')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.mine_rockeater.say'));
    ev.sfx('roar');
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    const r = await ev.battle('tr_b_rockeater', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('mine_rockeater');
    await ev.say(null, R.T('events.mine_rockeater.say_2'));
  }, { meta: { needs: [], gives: ['flag:mine_rockeater'] } });
  // ピップ（3 人目。誓いのハンマー）
  E('mine_pip', async (ev) => {
    const x = X();
    if (ev.flag('mine_pip') || !ev.flag('mine_rockeater')) return;
    await ev.say('pip', R.T('events.mine_pip.say'));
    await ev.say('pip', R.T('events.mine_pip.say_2'));
    await ev.say('pip', R.T('events.mine_pip.say_3'));
    await ev.say('pip', R.T('events.mine_pip.say_4'));
    await ev.say('pip', R.T('events.mine_pip.say_5'));
    ev.item('k_oath_hammer', 1);
    x.rescue(ev, 'mine_pip');
    await ev.say('pip', R.T('events.mine_pip.say_6'));
    await ev.fade('out', 400);
    await ev.caption(R.T('events.mine_pip.caption'), { ms: 1800 });
    await ev.fade('in', 400);
  }, { meta: { needs: ['flag:mine_rockeater'], gives: ['flag:mine_pip', 'item:k_oath_hammer', 'var:mine_rescued+1', 'flag:mine_rescued_all'] } });

  // ================================================================ 3 階（七の層）
  E('mine_f3_arrive', async (ev) => {
    if (ev.flag('mine_f3_seen')) return;
    ev.setFlag('mine_f3_seen');
    await ev.caption(R.T('events.mine_f3_arrive.caption'), { ms: 2600 });
  });
  // 七の層の岩戸（誓いのハンマー）: 選ぶ前は隙間を開けて番人の声（_01）、選んだあとは開く
  E('mine_rockdoor', async (ev) => {
    const x = X();
    if (ev.flag('mine_door_open')) return;
    await ev.say(null, R.T('events.mine_rockdoor.say'));
    if (!ev.has('k_oath_hammer')) { await ev.say(null, R.T('events.mine_rockdoor.say_2')); return; }
    if (!ev.flag('mine_door_seen')) {
      await ev.say(null, R.T('events.mine_rockdoor.say_3'));
      ev.sfx('unlock');
      try { R.Field.shake(3, 700); } catch (e) { /* */ }
      await ev.say(null, R.T('events.mine_rockdoor.say_4'));
      await ev.say(null, R.T('events.mine_rockdoor.say_5'));
      ev.bgm('omen');
      await ev.say('warden', R.T('events.mine_rockdoor.say_6'), Object.assign({ voice: 'v_guardian_mine_01' }, WARDEN));
      await ev.say(null, R.T('events.mine_rockdoor.say_7'));
      ev.mapBgm();
      ev.setFlag('mine_door_seen');
      ev.leadDone('l_mine_trapped');
      ev.lead('l_mine_door');
      await ev.say(null, R.T('events.mine_rockdoor.say_8'));
      return;
    }
    if (!ev.flag('mine_choice')) { await ev.say(null, R.T('events.mine_rockdoor.say_9')); return; }
    await ev.say(null, R.T('events.mine_rockdoor.say_10'));
    ev.sfx('unlock');
    try { R.Field.shake(4, 900); } catch (e) { /* */ }
    ev.setFlag('mine_door_open');
    await ev.caption(R.T('events.mine_rockdoor.caption'), { ms: 2000 });
  }, { meta: { needs: ['item:k_oath_hammer'], gives: ['flag:mine_door_seen', 'lead:l_mine_door', 'flag:mine_door_open'] } });
  E('mine_guardian_throne', async (ev) => {
    if (ev.flag('mine_warden_fought')) { await ev.say(null, R.T('events.mine_guardian_throne.say')); return; }
    await ev.say(null, ev.flag('mine_warden_done') ? R.T('events.mine_guardian_throne.say_2') : R.T('events.mine_guardian_throne.say_3'));
  });
  E('mine_breach', async (ev) => {
    await ev.say(null, R.T('events.mine_breach.say'));
    await ev.say(null, R.T('events.mine_breach.say_2'));
  });
  // 鉄の番人（選んだ道で違う: A 戦う・B 誓いの歌・C 誓い直しの問答）
  E('mine_warden', async (ev) => {
    const x = X();
    if (ev.flag('mine_warden_done') || !ev.flag('mine_choice')) return;
    const side = x.side(ev);
    ev.bgm('omen');
    await ev.say(null, R.T('events.mine_warden.say'));
    await ev.say('warden', R.T('events.mine_warden.say_2'), Object.assign({ voice: 'v_guardian_mine_02' }, WARDEN));
    if (side === 'guild') {
      ev.sfx('roar');
      try { R.Field.shake(5, 900); } catch (e) { /* */ }
      const r = await ev.battle('tr_b_ironwarden', { boss: true });
      if (r !== 'win') { ev.mapBgm(); return; }
      ev.setFlag('mine_warden_fought');
      ev.bgm('sorrow');
      await ev.say(null, R.T('events.mine_warden.say_3'));
      await ev.say(null, R.T('events.mine_warden.say_4'));
    } else if (side === 'smiths') {
      await ev.say(null, R.T('events.mine_warden.say_5'));
      ev.bgm('sorrow');
      await ev.caption(x.SONG[0], { ms: 3000 });
      await ev.caption(x.SONG[1], { ms: 3000 });
    } else {
      await ev.say(null, R.T('events.mine_warden.say_6'));
      const q = await ev.choose(R.T('events.mine_warden.q.choose'), { text: R.T('events.mine_warden.q.choose.text') });
      await ev.say(null, R.T('events.mine_warden.say_7')[q] || '');
      ev.bgm('sorrow');
    }
    // 誓いが生きている道（B・C）だけ: _03 で眠る（A は声なしで締めた）
    if (side !== 'guild') {
      await ev.say('warden', R.T('events.mine_warden.say_8'), Object.assign({ voice: 'v_guardian_mine_03' }, WARDEN));
      await ev.say(null, R.T('events.mine_warden.say_9'));
    }
    ev.setFlag('mine_warden_done');
    ev.leadDone('l_mine_warden');
    await ev.call('mine_relight');
  }, { meta: { needs: ['flag:mine_choice', 'flag:mine_door_open'], gives: ['flag:mine_warden_done', 'flag:mine_warden_fought'], calls: ['mine_relight'] } });

  // ================================================================ 灯り直す場面（炉に火が戻り、地下の町の灯りがいっせいに明るくなる）
  E('mine_relight', async (ev) => {
    if (ev.flag('mine_relight_done')) return;
    const x = X();
    await ev.caption(R.T('events.mine_relight.caption'), { ms: 2400 });
    ev.sfx('fire');
    try { R.Field.flash && R.Field.flash('#ffb070', 700); } catch (e) { /* */ }
    await ev.caption(R.T('events.mine_relight.caption_2'), { ms: 2200 });
    await ev.fade('out', 900);
    ev.setFlag('mine_relight_scene');
    await ev.warp('dovan', 'oath');
    ev.bgm('dawn');
    await ev.fade('in', 900);
    await ev.caption(R.T('events.mine_relight.caption_3'), { ms: 3000 });
    try { R.Field.flash && R.Field.flash('#ffd8a0', 600); } catch (e) { /* */ }
    await ev.say('relight_borg', R.T('events.mine_relight.say'), BORG);
    await ev.say('relight_helga', R.T('events.mine_relight.say_2'), HELGA);
    await ev.say('relight_pip', R.T('events.mine_relight.say_3'), PIP);
    ev.setFlag('mine_relight_done');
    // 大灯火（鍛冶神の炉）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_mine');
    await ev.call('mine_finale');
    void x;
  }, { meta: { needs: ['flag:mine_warden_done'], gives: ['flag:mine_relight_done', 'region:r_mine'], calls: ['mine_finale'], warp: { to: 'dovan', spawn: 'oath' } } });
  E('mine_finale', async (ev) => {
    if (ev.flag('mine_finale_done')) return;
    const x = X();
    const side = x.side(ev);
    // 選んだ道の場面（WORLD §4.6 の 5）
    if (side === 'guild') {
      await ev.say('relight_borg', R.T('events.mine_finale.say'), BORG);
      await ev.say('relight_helga', R.T('events.mine_finale.say_2'), HELGA);
      ev.setFlag('mine_cartline'); ev.setFlag('mine_vein_open');
      ev.item('u_guild_pick', 1);
    } else if (side === 'smiths') {
      await ev.say('relight_helga', R.T('events.mine_finale.say_3'), HELGA);
      await ev.say('relight_borg', R.T('events.mine_finale.say_4'), BORG);
      ev.setFlag('mine_smithpath'); ev.setFlag('mine_volk_open');
      ev.item('u_oath_hammer', 1);
    } else {
      await ev.say('relight_borg', R.T('events.mine_finale.say_5'), BORG);
      await ev.say('relight_helga', R.T('events.mine_finale.say_6'), HELGA);
      ev.setFlag('mine_cartline'); ev.setFlag('mine_smithpath'); ev.setFlag('mine_vein_open'); ev.setFlag('mine_volk_open');
      ev.item('u_accord_ring', 1);
    }
    await ev.say('relight_borg', R.T('events.mine_finale.say_7'), BORG);
    ev.item('ac_tale_mine', 1);
    // 拓本の受け取り書をまだ見ていなければ、ヘルガが話す（lo_ev_mine は必ず手に入る）
    if (!ev.flag('lo_ev_mine')) {
      await ev.say('relight_helga', R.T('events.mine_finale.say_8'), HELGA);
      await x.lore(ev, 'lo_ev_mine');
      ev.lead('l_main_recorder_mine');
    }
    // 交代表をまだ見ていなければ、ピップが話す（lo_time_mine は必ず手に入る）
    if (!ev.flag('lo_time_mine')) {
      await ev.say('relight_pip', R.T('events.mine_finale.say_9'), PIP);
      await x.lore(ev, 'lo_time_mine');
    }
    // 年代記に書く選択（STORY_BIBLE §7.6 の表）
    const i = await ev.choose(R.T('events.mine_finale.i.choose'), { important: true, text: R.T('events.mine_finale.i.choose.text') });
    if (i === 1) {
      ev.choice('ch_mine_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, R.T('events.mine_finale.say_10'));
      await ev.say('relight_borg', R.T('events.mine_finale.say_11'), BORG);
      await ev.fade('out', 600);
      await ev.caption(R.T('events.mine_finale.caption'), { ms: 3000 });
      ev.setFlag('mine_ledger_closed');
      await ev.fade('in', 600);
      await ev.say('relight_helga', R.T('events.mine_finale.say_12'), HELGA);
    } else {
      ev.choice('ch_mine_write', 'story');
      await ev.say(null, R.T('events.mine_finale.say_13'));
    }
    ev.sfx('quill');
    // 日継ぎの主張（灯り直す場面の最後に、町の誰かが）
    await ev.say('relight_pip', R.T('events.mine_finale.say_14'), PIP);
    ev.setFlag('mine_relight_scene', false);
    ev.setFlag('mine_finale_done');
    ev.mapBgm();
  }, { meta: { needs: ['flag:mine_relight_done'], gives: ['flag:mine_finale_done', 'item:ac_tale_mine', 'item:u_guild_pick', 'item:u_oath_hammer', 'item:u_accord_ring', 'lore:lo_ev_mine', 'lore:lo_time_mine', 'choice:ch_mine_write', 'flag:mine_ledger_closed', 'flag:mine_cartline', 'flag:mine_smithpath', 'flag:mine_vein_open', 'flag:mine_volk_open'] } });
})(window.RPG);
