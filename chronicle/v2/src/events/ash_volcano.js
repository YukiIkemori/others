// 灰の火山と灰の荒野の締め（WORLD_REDESIGN §4.7 の 3〜5・§6.4・§4.10、STORY_BIBLE §7.7・§11.8）
//   1 階: volcano_arrive・溶岩のせきのレバー（流れが A と B の間で入れ替わる）・壁画 3 つ（好きな順。3 つで火口への岩戸が開く）・
//         炎の番犬（tr_b_hellhound、東の部屋の前）・記録院の写し手（西の部屋の前。八百長を受けた = 刻限を知っていれば止められる。
//         断った = 着いたときには壁画 3 の後半が白く塗りこめられている）
//   火口: ash_crater_arrive・溶岩の巨獣（tr_b_lavabeast、土手道）→ 火口の縁にフィーネ（v_fine_ash_01、録音の文のまま）→
//         卵に壁画の物語を語る（白くされた壁画は一行短い）→ 火の鳥がかえる → ash_finale（clearRegion('r_ash') → 町の上を火の鳥がめぐる →
//         闘技場の銘板の前でドルガ → 年代記に書く選択 ch_ash_write → 帯か残り火）
//   ワールド: 火山の岩戸（優勝の前）・峠の旅人・湯の郷・火山ガメの浜・折れた剣の碑・灰見の宿の人。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Ash.ev;
  const objAt = (ctx, map, event) => { const m = R.DB.maps[map]; return m && ctx && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const FINE = { name: R.T('ev.ash_volcano.FINE.name') }, DORGA = { name: R.T('ev.ash_volcano.DORGA.name') };

  // ================================================================ 1 階
  E('volcano_arrive', async (ev) => {
    if (X().cleared(ev)) return;
    if (!ev.flag('ash_volcano_seen')) {
      ev.setFlag('ash_volcano_seen');
      await ev.caption(R.T('events.volcano_arrive.caption'), { ms: 2400 });
      await ev.caption(R.T('events.volcano_arrive.caption_2'), { ms: 2200 });
    }
  });
  // 溶岩のせき（引くたびに、流れが A（西）と B（北）の間で入れ替わる）
  E('volcano_sluice', async (ev) => {
    const i = await ev.choose(R.T('events.volcano_sluice.i.choose'), { text: R.T('events.volcano_sluice.i.choose.text') });
    if (i !== 0) return;
    const on = !ev.flag('ash_sluice');
    ev.setFlag('ash_sluice', on);
    ev.sfx('stone');
    try { R.Field.shake(3, 600); } catch (e) { /* */ }
    await ev.caption(on ? R.T('events.volcano_sluice.caption') : R.T('events.volcano_sluice.caption_2'), { ms: 2400 });
  }, { meta: { needs: [], gives: ['flag:ash_sluice'] } });
  // 壁画（好きな順）。3 つ目で火口への岩戸が開く
  E('volcano_mural', async (ev, ctx) => {
    const x = X();
    const o = objAt(ctx, 'ash_volcano_1', 'volcano_mural');
    const n = (o && o.mural) || 1;
    const f = 'ash_mural_' + n;
    const blank = n === 3 && ev.flag('ash_mural_blank');
    const text = blank ? x.MURALS[3.5] : x.MURALS[n];
    if (ev.flag(f)) { await ev.say(null, [R.T('events.volcano_mural.say.0'), text]); return; }
    await ev.say(null, R.T('events.volcano_mural.say'));
    ev.sfx('page');
    await ev.say(null, text);
    ev.setFlag(f);
    const k = x.murals(ev);
    ev.setVar('ash_murals', k);
    await ev.say(null, R.T('events.volcano_mural.say_2'));
    if (k < 3) { await ev.say(null, k === 1 ? R.T('events.volcano_mural.say_3') : R.T('events.volcano_mural.say_4')); return; }
    await ev.say(null, R.T('events.volcano_mural.say_5'));
    await x.lore(ev, 'lo_ash_firebird');
    ev.leadDone('l_ash_murals');
    ev.sfx('unlock');
    try { R.Field.shake(4, 900); } catch (e) { /* */ }
    await ev.caption(R.T('events.volcano_mural.caption'), { ms: 2400 });
  }, { meta: { needs: [], gives: ['flag:ash_mural_1', 'flag:ash_mural_2', 'flag:ash_mural_3', 'var:ash_murals+3', 'lore:lo_ash_firebird'] } });
  E('volcano_rockdoor', async (ev) => {
    const k = X().murals(ev);
    await ev.say(null, [R.T('events.volcano_rockdoor.say.0'), R.T('events.volcano_rockdoor.say.1'), k === 1 ? R.T('events.volcano_rockdoor.say.2') : k === 2 ? R.T('events.volcano_rockdoor.say.2_2') : R.T('events.volcano_rockdoor.say.2_3')]);
  });
  // 炎の番犬（中ボス。東の部屋 = 壁画 2 の前）
  E('volcano_hound', async (ev) => {
    if (ev.flag('ash_hound')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.volcano_hound.say'));
    ev.sfx('roar');
    const r = await ev.battle('tr_b_hellhound', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('ash_hound');
    await ev.say(null, R.T('events.volcano_hound.say_2'));
  }, { meta: { needs: [], gives: ['flag:ash_hound'] } });
  // 記録院の写し手（西の部屋の前。八百長を受けた = 刻限を知っている → 止める／断った → もう白くされている）
  E('volcano_copyists', async (ev) => {
    if (ev.flag('ash_copy_done') || !ev.flag('ash_champion')) return;
    if (ev.choiceOf('ch_ash_bribe') === 'accept') {
      await ev.caption(R.T('events.volcano_copyists.caption'), { ms: 2400 });
      ev.setFlag('ash_copyists');
      try { await ev.appear(['copyist_a', 'copyist_b'], { ms: 600 }); } catch (e) { /* */ }
      await ev.say('copyist_a', R.T('events.volcano_copyists.say'));
      const r = await ev.battle('tr_ash_copyists');
      if (r !== 'win') return;
      await ev.say(null, R.T('events.volcano_copyists.say_2'));
      try { await ev.leave(['copyist_a', 'copyist_b'], { ms: 600 }); } catch (e) { /* */ }
      ev.setFlag('ash_copyists', false);
      ev.setFlag('ash_copy_stopped');
      await ev.caption(R.T('events.volcano_copyists.caption_2'), { ms: 2200 });
    } else {
      await ev.caption(R.T('events.volcano_copyists.caption_3'), { ms: 2400 });
      ev.setFlag('ash_mural_blank');
    }
    ev.setFlag('ash_copy_done');
  }, { meta: { needs: ['flag:ash_champion'], gives: ['flag:ash_copy_done'] } });

  // ================================================================ 火口
  E('ash_crater_arrive', async (ev) => {
    if (ev.flag('ash_lavabeast')) return;
    await ev.caption(R.T('events.ash_crater_arrive.caption'), { ms: 2600 });
  });
  E('ash_crater_beast', async (ev) => {
    if (ev.flag('ash_lavabeast')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.ash_crater_beast.say'));
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    await ev.say(null, R.T('events.ash_crater_beast.say_2'));
    ev.sfx('roar');
    const r = await ev.battle('tr_b_lavabeast', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('ash_lavabeast');
    await ev.say(null, R.T('events.ash_crater_beast.say_3'));
    ev.leadDone('l_ash_volcano');
    await ev.call('ash_crater_fine');
    ev.mapBgm();
  }, { meta: { needs: [], gives: ['flag:ash_lavabeast', 'flag:ash_fine_seen'], calls: ['ash_crater_fine'] } });
  // 火口の縁のフィーネ（録音の文のまま。卵がかえる前）
  E('ash_crater_fine', async (ev) => {
    if (ev.flag('ash_fine_seen')) return;
    R.Audio && R.Audio.pushBgm && R.Audio.pushBgm('fine_theme');
    try {
      await ev.say(null, R.T('events.ash_crater_fine.say'));
      try { await ev.appear('fine', { ms: 900 }); } catch (e) { /* */ }
      await ev.say('fine', R.T('events.ash_crater_fine.say_2'), Object.assign({ voice: 'v_fine_ash_01' }, FINE));
      const t = Math.min(7, X().tier());
      if (t >= 3) await ev.caption(R.T('events.ash_crater_fine.caption'), { ms: 1800 });
      ev.sfx('magic');
      ev.setFlag('ash_fine_seen');
      try { await ev.leave('fine', { ms: 900 }); } catch (e) { /* */ }
      await ev.caption(R.T('events.ash_crater_fine.caption_2'), { ms: 2000 });
    } finally { R.Audio && R.Audio.popBgm && R.Audio.popBgm(); }
  }, { meta: { needs: ['flag:ash_lavabeast'], gives: ['flag:ash_fine_seen'] } });
  // 卵に壁画の物語を語る → 火の鳥がかえる → 締め
  E('ash_crater_egg', async (ev) => {
    const x = X();
    if (x.cleared(ev)) { await ev.say(null, [R.T('events.ash_crater_egg.say.0')]); return; }
    if (!ev.flag('ash_lavabeast')) { await ev.say(null, [R.T('events.ash_crater_egg.say.0_2')]); return; }
    await ev.say(null, R.T('events.ash_crater_egg.say'));
    ev.bgm('legend');
    for (let i = 0; i < 3; i++) {
      const t = i === 2 && ev.flag('ash_mural_blank') ? x.TELL_BLANK : x.TELL[i];
      await ev.caption(t, { ms: 2600 });
    }
    if (ev.flag('ash_mural_blank')) await ev.caption(R.T('events.ash_crater_egg.caption'), { ms: 2600 });
    ev.sfx('light');
    try { R.Field.flash && R.Field.flash('#ffd080', 400); } catch (e) { /* */ }
    try { R.Field.shake(4, 800); } catch (e) { /* */ }
    await ev.caption(R.T('events.ash_crater_egg.caption_2'), { ms: 2600 });
    try { R.Field.flash && R.Field.flash('#ffffff', 500); } catch (e) { /* */ }
    ev.setFlag('ash_egg');
    await ev.caption(R.T('events.ash_crater_egg.caption_3'), { ms: 2000 });
    await ev.caption(R.T('events.ash_crater_egg.caption_4'), { ms: 2400 });
    await ev.call('ash_finale');
  }, {
    meta: {
      needs: ['flag:ash_lavabeast'],
      gives: ['flag:ash_egg', 'region:r_ash', 'flag:ash_finale_done', 'choice:ch_ash_write', 'flag:ash_reward_given'],
      calls: ['ash_finale'],
    },
  });

  // ---------------------------------------------------------------- 灯り直す場面と締め
  E('ash_finale', async (ev) => {
    if (ev.flag('ash_finale_done')) return;
    // 大灯火（火の鳥）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_ash');
    ev.bgm('dawn');
    await ev.fade('out', 800);
    await ev.warp('caldera', 'warp');
    await ev.caption(R.T('events.ash_finale.caption'), { ms: 3000 });
    await ev.caption(R.T('events.ash_finale.caption_2'), { ms: 3000 });
    await ev.fade('out', 600);
    await ev.warp('caldera_arena', 'plaque');
    ev.setFlag('ash_plaque_scene');
    await ev.say(null, R.T('events.ash_finale.say'), { face: false });
    await ev.say('dorga_plaque', [R.T('events.ash_finale.say.0')], DORGA);
    await ev.say(null, R.T('events.ash_finale.say_2'));
    const i = await ev.choose(R.T('events.ash_finale.i.choose'), { text: R.T('events.ash_finale.i.choose.text') });
    if (i === 1) {
      ev.choice('ch_ash_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, R.T('events.ash_finale.say_3'));
      await ev.say('dorga_plaque', R.T('events.ash_finale.say_4'), Object.assign({ voice: 'v_dorga_ash_03' }, DORGA));
      ev.setFlag('ash_singer_board');
      await ev.caption(R.T('events.ash_finale.caption_3'), { ms: 2400 });
    } else {
      ev.choice('ch_ash_write', 'rebirth');
      await ev.say(null, R.T('events.ash_finale.say_5'));
    }
    ev.sfx('quill');
    ev.setFlag('ash_finale_done');
    ev.leadDone('l_ash_egg');
    await ev.call('ash_reward');
    ev.mapBgm();
  }, { meta: { needs: ['flag:ash_egg'], gives: ['region:r_ash', 'flag:ash_finale_done', 'choice:ch_ash_write', 'flag:ash_singer_board'], calls: ['ash_reward'], warp: { to: 'caldera_arena', spawn: 'plaque' } } });
  // 族長の品（断った: 闘士の帯）／カヤの品（受けた: 壁画の残り火）。同じ強さ
  E('ash_reward', async (ev) => {
    if (ev.flag('ash_reward_given')) return;
    ev.setFlag('ash_reward_given');
    if (ev.choiceOf('ch_ash_bribe') === 'accept') {
      await ev.say(null, R.T('events.ash_reward.say'), { face: false });
      ev.item('u_mural_ember', 1);
    } else {
      await ev.say('dorga_plaque', R.T('events.ash_reward.say_2'), DORGA);
      ev.item('u_champion_belt', 1);
    }
  }, { meta: { needs: ['flag:ash_finale_done'], gives: ['flag:ash_reward_given', 'item:u_champion_belt|u_mural_ember'] } });

  // ================================================================ ワールド
  E('ash_rockdoor_world', async (ev) => {
    await ev.say(null, R.T('events.ash_rockdoor_world.say'));
    if (ev.flag('ash_entered')) await ev.say(null, R.T('events.ash_rockdoor_world.say_2'));
  });
  E('ash_world_traveler', async (ev) => {
    await ev.say('ash_traveler', X().cleared(ev) ? [R.T('events.ash_world_traveler.say.0')] : R.T('events.ash_world_traveler.say'));
    ev.lead('l_ash_trial');
  }, { meta: { needs: [], gives: ['lead:l_ash_trial'] } });
  E('ash_spa_pool', async (ev) => {
    ev.setFlag('ash_spa_bathed');
    const i = await ev.choose(R.T('events.ash_spa_pool.i.choose'), { text: R.T('events.ash_spa_pool.i.choose.text') });
    if (i === 0) {
      await ev.fade('out', 500);
      ev.rest();
      await ev.fade('in', 500);
      await ev.caption(R.T('events.ash_spa_pool.caption'), { ms: 1800 });
    }
    if (ev.flag('q_ash_spa_on') && !ev.flag('ash_spa_done') && !ev.has('k_spa_salt')) {
      await ev.say(null, R.T('events.ash_spa_pool.say'));
      ev.item('k_spa_salt', 1);
    }
  }, { meta: { needs: [], gives: ['flag:ash_spa_bathed', 'item:k_spa_salt'] } });
  E('ash_beach_rock', async (ev) => {
    ev.addVar('ash_turtle_seen', 1);
    await ev.say(null, R.T('events.ash_beach_rock.say'));
  }, { meta: { needs: [], gives: ['var:ash_turtle_seen'] } });
  E('ash_battlefield_stone', async (ev) => {
    ev.setFlag('ash_battlefield_seen');
    await ev.say(null, R.T('events.ash_battlefield_stone.say'));
  }, { meta: { needs: [], gives: ['flag:ash_battlefield_seen'] } });
  E('ash_bridge_sign', async (ev) => {
    await ev.say(null, R.T('events.ash_bridge_sign.say'));
  });
})(window.RPG);
// 宿場「灰見の宿」（#27）: 宿と売り台・橋番・湿原の行商（ワールドの人の続き。別の IIFE にしない: 上の E と同じ形で足す）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  E('haimi_keeper', async (ev) => {
    await ev.say('haimi_keeper', R.T('events.haimi_keeper.say'));
    const i = await ev.choose(R.T('events.haimi_keeper.i.choose'), { text: R.T('events.haimi_keeper.i.choose.text') });
    if (i === 0) await ev.inn();
    else if (i === 1) await ev.shop('shop_haimi');
  });
  E('haimi_bridgeman', async (ev) => {
    await ev.say('haimi_bridgeman', ev.flag('cleared_r_ash') ? R.T('events.haimi_bridgeman.say') : R.T('events.haimi_bridgeman.say_2'));
  });
  E('haimi_guest', async (ev) => {
    await ev.say('haimi_guest', R.T('events.haimi_guest.say'));
    ev.lead('l_rumor_marsh');
    ev.lead('l_ash_trial');
  }, { meta: { needs: [], gives: ['lead:l_rumor_marsh', 'lead:l_ash_trial'] } });
  E('haimi_bridge_log', async (ev) => {
    await ev.say(null, R.T('events.haimi_bridge_log.say'));
  });
})(window.RPG);
