// CONTENT（マレア諸島）: 自分の船での航海（WORLD_REDESIGN §4.5 の流れ 2〜4・§2.5、STORY_BIBLE §7.5 の 1）。
//   外洋船（isles_ship）の舵: コーラルの真ん中の桟橋・ネレイの夜の桟橋・島々の桟橋で調べると、行き先を選ぶ（固定航路のように）。
//   行き先: コーラル・ネレイ・灯台島・人魚の歌う岩・財宝ヤドカリの島・座礁した商船・霧の海（マリナが歌ったあと = 幽霊船）。
//   島へ着くと海図の空白が埋まる（X.chart。3 つで幽霊船の海域が絞れる）。
//   島: 灯台島（灯台守のいない灯台。灯室にラザロの手紙・【灯りを守る】）・人魚の歌う岩（#34。舟歌の後半の節・人魚のくし）・
//       財宝ヤドカリの島（#35。巣）・座礁した商船（選択 ch_isles_wreck: 船員を助ける（小舟で 3 往復）／積荷を拾う（ティア宝箱 3））。
//   航海のイベントは行き先ごとに 1 本（meta.warp。tools/qa/progress.js の閉包が行き先ごとに着ける）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Isles.ev;
  const cleared = (ev) => ev.flag('cleared_r_isles');

  // ---------------------------------------------------------------- 舵（行き先を選ぶ）
  const DEST = [
    { id: 'coral', label: R.T('ev.isles_sea.DEST.coral.label'), ev: 'isles_sail_coral' },
    { id: 'nerei', label: R.T('ev.isles_sea.DEST.nerei.label'), ev: 'isles_sail_nerei' },
    { id: 'light', label: R.T('ev.isles_sea.DEST.light.label'), ev: 'isles_sail_light' },
    { id: 'siren', label: R.T('ev.isles_sea.DEST.siren.label'), ev: 'isles_sail_siren' },
    { id: 'crab', label: R.T('ev.isles_sea.DEST.crab.label'), ev: 'isles_sail_crab' },
    { id: 'wreck', label: R.T('ev.isles_sea.DEST.wreck.label'), ev: 'isles_sail_wreck' },
    { id: 'fog', label: R.T('ev.isles_sea.DEST.fog.label'), ev: 'isles_sail_fog', cond: 'isles_fog_open' },
  ];
  E('isles_helm', async (ev, ctx) => {
    if (!ev.flag('isles_ship')) { await ev.say(null, R.T('events.isles_helm.say')); return; }
    const here = { coral: 'coral', nerei: 'nerei', i_light: 'light', i_siren: 'siren', i_crab: 'crab', i_wreck: 'wreck', ghost_ship_1: 'fog' }[ctx && ctx.map];
    const list = DEST.filter((d) => d.id !== here && (!d.cond || ev.flag(d.cond)));
    const i = await ev.choose(list.map((d) => d.label + (X().CHART.includes(d.id) && !ev.flag('isles_chart_' + d.id) ? R.T('events.isles_helm.i.choose') : '')).concat([R.T('events.isles_helm.i.choose.0')]),
      { cancel: list.length, text: R.T('events.isles_helm.i.choose.text') });
    if (i >= list.length) return;
    await ev.call(list[i].ev);
  }, { meta: { needs: [], gives: [], calls: DEST.map((d) => d.ev) } });
  // 島の桟橋の船（調べると舵）
  E('isles_boat', async (ev, ctx) => { await ev.call('isles_helm', ctx); }, { meta: { needs: [], gives: [], calls: ['isles_helm'] } });

  async function sail(ev, map, spawn, cap) {
    await ev.fade('out', 500);
    ev.sfx('ship');
    await ev.warp(map, spawn);
    if (cap) await ev.caption(cap, { ms: 1800 });
  }
  const S = (id, map, spawn, run, o) => E(id, run, Object.assign({ meta: Object.assign({ needs: ['flag:isles_ship'], gives: [], warp: { to: map, spawn } }, (o && o.meta) || {}) }));
  S('isles_sail_coral', 'coral', 'ship', async (ev) => { await sail(ev, 'coral', 'ship', R.T('ev.isles_sea.isles_sail_coral.sail')); });
  S('isles_sail_nerei', 'nerei', 'pier_end', async (ev) => { await sail(ev, 'nerei', 'pier_end', R.T('ev.isles_sea.isles_sail_nerei.sail')); });
  for (const k of ['light', 'siren', 'crab', 'wreck']) {
    S('isles_sail_' + k, 'i_' + k, 'boat', async (ev) => {
      await sail(ev, 'i_' + k, 'boat', R.T('ev.isles_sea.sail', { p0: X().CHART_NAME[k] }));
      await X().chart(ev, k);
    }, { meta: { gives: ['flag:isles_chart_' + k, 'var:isles_chart', 'flag:isles_fog_found'] } });   // fog_found は 3 つ目で立つ（閉包は 4 つとも回るので、ここに書く）
  }
  S('isles_sail_fog', 'ghost_ship_1', 'board', async (ev) => {
    await ev.fade('out', 600);
    ev.sfx('ship');
    await ev.caption(cleared(ev) ? R.T('ev.isles_sea.isles_sail_fog.caption') : R.T('ev.isles_sea.isles_sail_fog.caption_2'), { ms: 2400 });
    await ev.warp('ghost_ship_1', 'board');
  }, { meta: { needs: ['flag:isles_ship', 'flag:isles_fog_open'] } });

  // ---------------------------------------------------------------- 灯台島（灯台守のいない灯台・灯室）
  E('isles_light_plaque', async (ev) => {
    await ev.say(null, R.T('events.isles_light_plaque.say'));
  });
  E('isles_light_arrive', async (ev) => {
    if (ev.flag('isles_light_seen')) return;
    ev.setFlag('isles_light_seen');
    await ev.caption(ev.flag('isles_light_lit') || cleared(ev) ? R.T('events.isles_light_arrive.caption') : R.T('events.isles_light_arrive.caption_2'), { ms: 2400 });
  });
  E('isles_lamp', async (ev) => {
    if (cleared(ev)) { await ev.say(null, R.T('events.isles_lamp.say')); return; }
    if (ev.flag('isles_light_lit')) { await ev.say(null, R.T('events.isles_lamp.say_2')); return; }
    if (!ev.has('k_lamp_oil')) { await ev.say(null, R.T('events.isles_lamp.say_3')); return; }
    const i = await ev.choose(R.T('events.isles_lamp.i.choose'), { text: R.T('events.isles_lamp.i.choose.text') });
    if (i !== 0) return;
    ev.take('k_lamp_oil', 1);
    ev.sfx('light');
    try { R.Field.flash && R.Field.flash('#ffd890', 400); } catch (e) { /* */ }
    ev.setFlag('isles_light_lit');
    await ev.caption(R.T('events.isles_lamp.caption'), { ms: 2600 });
    ev.leadDone('q_isles_light');
  }, { meta: { needs: ['item:k_lamp_oil'], gives: ['flag:isles_light_lit'] } });
  E('isles_lamproom_letter', async (ev) => {
    if (ev.flag('isles_lz_found')) { await ev.say(null, R.T('events.isles_lamproom_letter.say')); return; }
    ev.setFlag('isles_lz_found');
    await ev.say(null, R.T('events.isles_lamproom_letter.say_2'));
    await X().lz(ev);
  }, { meta: { needs: [], gives: ['flag:isles_lz_found'] } });
  E('isles_keeper_log', async (ev) => {
    await ev.say(null, R.T('events.isles_keeper_log.say'));
    await ev.say(null, R.T('events.isles_keeper_log.say_2'));
    await ev.say(null, R.T('events.isles_keeper_log.say_3'));
    ev.lead('l_main_recorder_isles');
  }, { meta: { needs: [], gives: ['lead:l_main_recorder_isles'] } });

  // ---------------------------------------------------------------- 人魚の歌う岩（#34）
  E('isles_siren_rock', async (ev) => {
    if (ev.flag('isles_siren_heard')) { await ev.say(null, R.T('events.isles_siren_rock.say')); return; }
    await ev.say(null, R.T('events.isles_siren_rock.say_2'));
    ev.sfx('bell');
    await ev.caption(X().SHANTY_B, { ms: 3400 });
    ev.setFlag('isles_siren_heard');
    await ev.say(null, R.T('events.isles_siren_rock.say_3'));
    await ev.say(null, R.T('events.isles_siren_rock.say_4'));
    ev.item('u_siren_comb', 1);
    ev.leadDone('l_opt_siren');
  }, { meta: { needs: [], gives: ['flag:isles_siren_heard', 'item:u_siren_comb'] } });

  // ---------------------------------------------------------------- 財宝ヤドカリの島（#35）
  E('isles_crab_nest', async (ev) => {
    if (ev.flag('isles_crab_seen')) { await ev.say(null, R.T('events.isles_crab_nest.say')); return; }
    ev.setFlag('isles_crab_seen');
    await ev.say(null, R.T('events.isles_crab_nest.say_2'));
    await ev.say(null, R.T('events.isles_crab_nest.say_3'));
    ev.gold(80 + 40 * X().tier());
    ev.leadDone('l_opt_crab');
  }, { meta: { needs: [], gives: ['flag:isles_crab_seen'] } });

  // ---------------------------------------------------------------- 座礁した商船（選択 ch_isles_wreck）
  E('isles_wreck', async (ev) => {
    if (ev.flag('isles_wreck_done')) {
      await ev.say(null, ev.choiceOf('ch_isles_wreck') === 'help' ? R.T('events.isles_wreck.say') : R.T('events.isles_wreck.say_2'));
      return;
    }
    await ev.say('wreck_captain', R.T('events.isles_wreck.say_3'));
    await ev.say(null, R.T('events.isles_wreck.say_4'));
    const i = await ev.choose(R.T('events.isles_wreck.i.choose'), { important: true, text: R.T('events.isles_wreck.i.choose.text') });
    ev.setFlag('isles_wreck_done');
    if (i === 0) {
      ev.choice('ch_isles_wreck', 'help');
      for (let n = 1; n <= 3; n++) {
        await ev.fade('out', 400);
        ev.sfx('water');
        await ev.caption(R.T('events.isles_wreck.caption', { n }), { ms: 1800 });
        await ev.fade('in', 400);
      }
      await ev.say('wreck_captain', R.T('events.isles_wreck.say_5'));
      ev.setFlag('isles_wreck_saved');
    } else {
      ev.choice('ch_isles_wreck', 'cargo');
      ev.sfx('water');
      await ev.caption(R.T('events.isles_wreck.caption_2'), { ms: 2000 });
      await ev.say('wreck_captain', R.T('events.isles_wreck.say_6'));
      await ev.say(null, R.T('events.isles_wreck.say_7'));
    }
    try { await ev.leave('wreck_captain', { ms: 600 }); } catch (e) { /* */ }
  }, { meta: { needs: [], gives: ['flag:isles_wreck_done', 'choice:ch_isles_wreck'] } });
  // ---------------------------------------------------------------- 島の道（白崖の道・夜光虫の入り江・ネレイの岬道）
  E('isles_watchtower', async (ev) => {
    await ev.say(null, R.T('events.isles_watchtower.say'));
  });
  E('isles_cove_glow', async (ev) => {
    await ev.say(null, cleared(ev) ? R.T('events.isles_cove_glow.say')
      : R.T('events.isles_cove_glow.say_2'));
  });
  E('isles_signal_mast', async (ev) => {
    await ev.say(null, R.T('events.isles_signal_mast.say'));
  });
})(window.RPG);
