// 白竜の峰と雪原の締め（WORLD_REDESIGN §4.3 の 5〜7・§4.10、STORY_BIBLE §7.3・§11.8）
//   peak_icewall（冬至の火の火種で氷の壁をとかす）・peak_giant（氷壁の巨人 tr_b_icegiant）・peak_neve（頂で白竜ネーヴェ: 語る／戦う）→
//   snow_finale（冬至の火を竜に渡す → 吹雪が止み、空いっぱいのオーロラ → ev.clearRegion('r_snow') → ユールで夜数えの板・日継ぎの主張 →
//   年代記に書く選択 ch_snow_write）・snow_day2（遅れた大火祭の二日目。痛みの側はヨルンが被害の家の名を読み上げる）
//   録音済みの文（巨人・ネーヴェ）は 1 字も変えずに地の文として置く（声はあとで）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Snow.ev;
  const objAt = (ctx, event) => { const m = R.DB.maps[ctx && ctx.map]; return m && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const NEVE = { name: R.T('ev.snow_peak.NEVE.name'), face: false };
  const GIANT = { name: R.T('ev.snow_peak.GIANT.name'), face: false };

  E('peak_arrive', async (ev) => {
    if (X().cleared(ev)) return;
    await ev.caption(R.T('events.peak_arrive.caption'), { ms: 2200 });
    if (!ev.has('k_winter_flame')) await ev.caption(R.T('events.peak_arrive.caption_2'), { ms: 2000 });
  }, { meta: { needs: [], gives: [] } });

  // 氷の壁（冬至の火の火種でとける）
  E('peak_icewall', async (ev, ctx) => {
    const o = objAt(ctx, 'peak_icewall');
    const n = (o && o.wall) || 1;
    const f = 'snow_ice_' + n;
    if (ev.flag(f)) { await ev.say(null, R.T('events.peak_icewall.say')); return; }
    if (!ev.has('k_winter_flame')) {
      await ev.say(null, R.T('events.peak_icewall.say_2'));
      return;
    }
    await ev.say(null, R.T('events.peak_icewall.say_3'));
    ev.sfx('fire');
    try { R.Field.flash('#ffc070', 300); } catch (e) { /* */ }
    ev.setFlag(f);
    await ev.caption(R.T('events.peak_icewall.caption'), { ms: 1800 });
  }, { meta: { needs: ['item:k_winter_flame'], gives: ['flag:snow_ice_1', 'flag:snow_ice_2', 'flag:snow_ice_3'] } });

  E('peak_overlook', async (ev) => {
    await ev.say(null, X().cleared(ev) ? [R.T('events.peak_overlook.say.0')] : R.T('events.peak_overlook.say'));
  });

  // 氷壁の巨人（中ボス）
  E('peak_giant', async (ev) => {
    if (ev.flag('snow_giant')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.peak_giant.say'));
    await ev.say('icegiant', R.T('events.peak_giant.say_2'), Object.assign({ voice: 'v_giant_peak_01' }, GIANT));
    ev.sfx('roar');
    const r = await ev.battle('tr_b_icegiant', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('snow_giant');
    await ev.say(null, R.T('events.peak_giant.say_3'));
  }, { meta: { needs: ['flag:snow_ice_2'], gives: ['flag:snow_giant'] } });

  E('peak_top_arrive', async (ev) => {
    if (X().cleared(ev)) return;
    await ev.caption(R.T('events.peak_top_arrive.caption'), { ms: 2600 });
  });
  E('peak_epitaph', async (ev) => {
    await ev.say(null, R.T('events.peak_epitaph.say'));
    await X().lore(ev, 'lo_snow_epitaph');
  }, { meta: { needs: [], gives: ['flag:lo_snow_epitaph'] } });
  E('peak_altar', async (ev) => {
    await ev.say(null, X().cleared(ev) ? R.T('events.peak_altar.say') : R.T('events.peak_altar.say_2'));
  });

  // 頂で白竜ネーヴェ（語る／戦う）
  E('peak_neve', async (ev) => {
    if (X().cleared(ev)) return;
    if (!ev.has('k_winter_flame')) return;
    ev.bgm('omen');
    try { R.Field.shake(6, 900); } catch (e) { /* */ }
    await ev.caption(R.T('events.peak_neve.caption'), { ms: 2400 });
    await ev.say('neve', R.T('events.peak_neve.say'), Object.assign({ voice: 'v_neve_peak_01' }, NEVE));
    const canTalk = ev.flag('snow_logs_done') && ev.flag('snow_ice_done') && ev.flag('snow_tales_done') && ev.choiceOf('ch_snow_tale') === 'dragon';
    let how = 'fight';
    if (canTalk) {
      const i = await ev.choose(R.T('events.peak_neve.i.choose'), { text: R.T('events.peak_neve.i.choose.text') });
      how = i === 0 ? 'talk' : 'fight';
    } else {
      await ev.say(null, R.T('events.peak_neve.say_2'));
    }
    if (how === 'talk') {
      await ev.say(null, R.T('events.peak_neve.say_3'));
      ev.bgm('legend');
      for (const l of X().TALES.dragon.lines) await ev.caption(l, { ms: 3000 });
      await ev.caption(R.T('events.peak_neve.caption_2'), { ms: 2600 });
    } else {
      ev.sfx('roar');
      const r = await ev.battle('tr_b_whitedragon', { boss: true });
      if (r !== 'win') { ev.mapBgm(); return; }
      await ev.say(null, R.T('events.peak_neve.say_4'));
    }
    ev.choice('ch_snow_neve', how);
    ev.bgm('dawn');
    await ev.say('neve', R.T('events.peak_neve.say_5'), Object.assign({ voice: 'v_neve_peak_02' }, NEVE));
    await ev.say('neve', R.T('events.peak_neve.say_6'), Object.assign({ voice: 'v_neve_peak_03' }, NEVE));
    ev.setFlag('snow_neve');
    await ev.call('snow_finale');
  }, {
    meta: {
      needs: ['flag:snow_giant', 'item:k_winter_flame'],
      gives: ['flag:snow_neve', 'choice:ch_snow_neve', 'region:r_snow', 'flag:snow_finale_done', 'choice:ch_snow_write'],
      calls: ['snow_finale'],
    },
  });

  // ---------------------------------------------------------------- 灯り直す場面と締め
  E('snow_finale', async (ev) => {
    if (ev.flag('snow_finale_done')) return;
    const x = X();
    // 竜の品（戦う: 竜の牙の剣／語る: 竜のうろこのお守り。同じ強さの別の品）
    if (ev.choiceOf('ch_snow_neve') === 'talk') {
      await ev.say('neve', R.T('events.snow_finale.say'), Object.assign({ voice: 'v_neve_peak_04' }, NEVE));
      ev.item('u_dragon_scale', 1);
    } else {
      await ev.say(null, R.T('events.snow_finale.say_2'));
      ev.item('u_dragon_fang', 1);
    }
    await ev.say(null, R.T('events.snow_finale.say_3'));
    ev.take('k_winter_flame', 1);
    ev.sfx('fire');
    // 大灯火（冬至の火）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_snow');
    ev.bgm('dawn');
    ev.sfx('light');
    await ev.caption(R.T('events.snow_finale.caption'), { ms: 2000 });
    await ev.caption(R.T('events.snow_finale.caption_2'), { ms: 3200 });
    await ev.caption(R.T('events.snow_finale.caption_3'), { ms: 2600 });
    ev.setFlag('snow_aurora_seen');
    // ユールへ: 夜数えの板・日継ぎの主張
    await ev.fade('out', 800);
    await ev.warp('yule', 'hearth');
    await ev.caption(R.T('events.snow_finale.caption_4'), { ms: 2600 });
    await ev.say('sonja', R.T('events.snow_finale.say_4'), { voice: ['v_sonja_snow_05', 'v_sonja_snow_06', 'v_sonja_snow_07'] });   // 1 つ目は名前を読まない
    ev.setFlag('snow_board_stop');
    await ev.say('old_m', R.T('events.snow_finale.say_5'), { name: R.T('events.snow_finale.say.name') });
    // 年代記に書く選択（ch_snow_write。痛みの側は pain_count を足す）
    const broken = ['n', 'e', 'w'].filter((g) => ev.flag('snow_gate_' + g + '_broken'));
    await ev.say(null, R.T('events.snow_finale.say_6'));
    const i = await ev.choose([R.T('events.snow_finale.i.choose.0'), broken.length ? R.T('events.snow_finale.i.choose.1') : R.T('events.snow_finale.i.choose.1_2')], { text: R.T('events.snow_finale.i.choose.text') });
    if (i === 1) {
      ev.choice('ch_snow_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, R.T('events.snow_finale.say_7'));
    } else {
      ev.choice('ch_snow_write', 'glory');
      await ev.say(null, R.T('events.snow_finale.say_8'));
    }
    ev.sfx('quill');
    ev.setFlag('snow_finale_done');
    ev.leadDone('l_snow_peak');
    await ev.call('snow_jorn_reward');
    ev.mapBgm();
  }, { meta: { needs: ['flag:snow_neve'], gives: ['region:r_snow', 'flag:snow_finale_done', 'choice:ch_snow_write', 'flag:snow_board_stop', 'item:u_dragon_fang|u_dragon_scale'], calls: ['snow_jorn_reward'], warp: { to: 'yule', spawn: 'hearth' } } });

  // 遅れた大火祭の二日目（締めのあと、次にユールに入ったとき）
  E('snow_day2', async (ev) => {
    if (ev.flag('snow_day2') || !ev.flag('snow_finale_done')) return;
    ev.setFlag('snow_day2');
    ev.bgm('bonfire');
    await ev.caption(R.T('events.snow_day2.caption'), { ms: 2800 });
    const broken = ['n', 'e', 'w'].filter((g) => ev.flag('snow_gate_' + g + '_broken'));
    if (ev.choiceOf('ch_snow_write') === 'pain' && broken.length) {
      await ev.say('jorn', [R.T('events.snow_day2.say.0'), R.T('events.snow_day2.say.1', { join: broken.map((g) => X().GATES[g]).join(R.T('events.snow_day2.say.1.join')) })]);
      await ev.caption(R.T('events.snow_day2.caption_2'), { ms: 3200 });
    }
    await ev.say('sonja', R.T('events.snow_day2.say'));
    ev.item('k_yule_ember', 1);
    ev.lead('q_snow_lamps');
    const ok = ['n', 'e', 'w'].filter((g) => !ev.flag('snow_gate_' + g + '_broken'));
    if (ok.length) await ev.caption(R.T('events.snow_day2.caption_3'), { ms: 2000 });
    ev.mapBgm();
  }, { meta: { needs: ['flag:snow_finale_done'], gives: ['flag:snow_day2', 'item:k_yule_ember', 'lead:q_snow_lamps'] } });
})(window.RPG);
