// CONTENT（砂漠）: 砂の王墓と灯り直す場面（WORLD_REDESIGN §4.2 の流れ 3〜5、STORY_BIBLE §7.2 の主な場面 3・4）。
//   墓守の像の名の文字（ハ・ザ・ル → 三つで「王の名の記し」i_desert_kingname。戦いの中で使うと名を呼べる）
//   1 階: 封じの扉（二つの踏み板。旗は FIELD の switch が立てる）・金剛トカゲの隠し部屋
//   2 階: 砂もぐり tr_b_sandworm（倒すと流砂が止まる = tilePatches の desert_worm）
//   3 階: 名なき砂の王 tr_b_sandking（倒す／名を呼ぶ）→ ハザルの 4 つの言葉（文字だけ。ボイスは後で）→ desert_finale
//   desert_finale: 古い泉の底に日輪の火（ev.clearRegion）→ カシムの泉が湧く → ナディアの歌 → 年代記の選択 ch_desert_write →
//                  アブルの砂王の印章 ac_tale_desert・隊商ギルドの割引（shops_desert の priceMul）・隊商路の荷車（砂の縁 ⇔ カシム）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const HAZAL = { name: R.T('ev.desert_tomb.HAZAL.name'), face: false };
  const HAZAL2 = { name: R.T('ev.desert_tomb.HAZAL2.name'), face: false };
  const objAt = (ctx, event) => { const m = R.DB.maps[ctx && ctx.map]; return m && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const GLYPH = { ha: ['k_desert_glyph_ha', R.T('ev.desert_tomb.GLYPH.ha.1')], za: ['k_desert_glyph_za', R.T('ev.desert_tomb.GLYPH.za.1')], ru: ['k_desert_glyph_ru', R.T('ev.desert_tomb.GLYPH.ru.1')] };

  // ---------------------------------------------------------------- 入口・階
  E('desert_tomb_sealed', async (ev) => {
    await ev.say(null, R.T('events.desert_tomb_sealed.say'));
  });
  E('desert_tomb_arrive', async (ev) => {
    await ev.caption(R.T('events.desert_tomb_arrive.caption'), { ms: 2400 });
  });
  E('desert_tomb2_arrive', async (ev) => {
    await ev.caption(R.T('events.desert_tomb2_arrive.caption'), { ms: 2400 });
  });
  E('desert_tomb3_arrive', async (ev) => {
    await ev.caption(R.T('events.desert_tomb3_arrive.caption'), { ms: 2400 });
  });

  // 封じの扉（1 階）
  E('desert_tomb_door', async (ev) => {
    const w = ev.flag('desert_t1_sw_w'), e = ev.flag('desert_t1_sw_e');
    await ev.say(null, [R.T('events.desert_tomb_door.say.0'), w || e ? R.T('events.desert_tomb_door.say.1', { p0: w && e ? 0 : 1 }) : R.T('events.desert_tomb_door.say.1_2')]);
  });
  // 踏み板（FIELD の switch が旗を立てる。同じマスの step のトリガーが知らせを出す＝閉包の meta もここ）
  const plate = (id, flag, pair, msgs) => E(id, async (ev) => {
    ev.setFlag(flag);
    const n = pair.filter((f) => ev.flag(f)).length;
    ev.sfx('unlock');
    await ev.caption(n >= pair.length ? msgs[1] : msgs[0].replace('#', n + '/' + pair.length), { ms: 1600 });
  }, { meta: { needs: [], gives: ['flag:' + flag] } });
  const T1 = ['desert_t1_sw_w', 'desert_t1_sw_e'];
  plate('desert_tomb_plate_w', T1[0], T1, R.T('ev.desert_tomb.desert_tomb_plate_w'));
  plate('desert_tomb_plate_e', T1[1], T1, R.T('ev.desert_tomb.desert_tomb_plate_e'));
  const TP = ['desert_tp_disc_1', 'desert_tp_disc_2', 'desert_tp_disc_3'];
  TP.forEach((f, i) => plate('desert_temple_plate_' + (i + 1), f, TP, R.T('ev.desert_tomb.plate')));

  // 墓守の像（名の文字）
  E('desert_tomb_glyph', async (ev, ctx) => {
    const o = objAt(ctx, 'desert_tomb_glyph');
    const gl = GLYPH[(o && o.glyph) || 'ha'];
    if (ev.has(gl[0])) { await ev.say(null, R.T('events.desert_tomb_glyph.say', { p0: gl[1] })); return; }
    await ev.say(null, [R.T('events.desert_tomb_glyph.say.0'), R.T('events.desert_tomb_glyph.say.1', { p0: gl[1] })]);
    ev.sfx('item');
    ev.item(gl[0], 1);
    const n = X().glyphs(ev);
    if (n >= 3 && !ev.has('i_desert_kingname')) {
      await ev.say(null, R.T('events.desert_tomb_glyph.say_2'));
      ev.item('i_desert_kingname', 1);
      ev.sfx('quill');
      await ev.caption(R.T('events.desert_tomb_glyph.caption'), { ms: 2600 });
      ev.leadDone('l_desert_glyphs');
    } else {
      await ev.say(null, R.T('events.desert_tomb_glyph.say_3', { n }));
    }
  }, { meta: { needs: [], gives: ['item:k_desert_glyph_ha|k_desert_glyph_za|k_desert_glyph_ru', 'item:i_desert_kingname'] } });

  // 墓の番の影（1 階）
  E('desert_tomb_ghost', async (ev) => {
    if (ev.flag('desert_king')) { await ev.say('tomb_ghost', R.T('events.desert_tomb_ghost.say')); return; }
    await ev.say('tomb_ghost', R.T('events.desert_tomb_ghost.say_2'));
  });

  // 金剛トカゲの隠し部屋（ティアごとに 1 度。盗みの品のため）
  E('desert_tomb_lizard', async (ev) => {
    const key = 'desert_lizard_t' + X().tier();
    if (ev.flag(key)) { await ev.say(null, R.T('events.desert_tomb_lizard.say')); return; }
    await ev.say(null, R.T('events.desert_tomb_lizard.say_2'));
    ev.setFlag(key);
    await ev.battle('tr_desert_lizard_hole');
  }, { meta: { needs: [], gives: [] } });

  // ---------------------------------------------------------------- 2 階: 流砂と砂もぐり
  E('desert_tomb_quicksand', async (ev) => {
    if (ev.flag('desert_worm')) { await ev.say(null, R.T('events.desert_tomb_quicksand.say')); return; }
    await ev.say(null, R.T('events.desert_tomb_quicksand.say_2'));
  });
  E('desert_tomb_robber', async (ev) => {
    if (ev.flag('desert_worm')) { await ev.call('desert_tomb_robber_leave', { stay: true }); return; }   // 前のセーブ（倒した後もまだ倒れていた）
    await ev.say('worm_track', R.T('events.desert_tomb_robber.say'));
    if (!ev.flag('desert_robber_help')) {
      ev.setFlag('desert_robber_help');
      await ev.say(null, R.T('events.desert_tomb_robber.say_2'));
      await ev.say('worm_track', R.T('events.desert_tomb_robber.say_3'));
      ev.item('i_stone_earth', 2);
    }
  }, { meta: { needs: [], gives: ['item:i_stone_earth'], calls: ['desert_tomb_robber_leave'] } });
  // 砂もぐりを倒した後: 倒れていた墓荒らしが起き上がり、礼を言って、足を引きずって上の階へ帰っていく（→ desert_robber_gone で消えたまま）
  E('desert_tomb_robber_leave', async (ev) => {
    if (ev.flag('desert_robber_gone')) return;
    const n = ev.npc('worm_track'), stay = !!(ev.ctx && ev.ctx.stay);   // stay: 話しかけられた（一行がすぐ隣にいる）
    if (!stay) await ev.camera(27, 34, 500);
    await ev.say(null, R.T('events.desert_tomb_robber_leave.say'));
    // 暗い間なので、一行の灯りの届く所（ねぐらへ下りる口）まで来てから話す
    if (!stay) { await n.move([[26, 33], [27, 33], [28, 33], [28, 34]], { speed: 0.8 }); await n.face('s'); }
    await ev.say('worm_track', ev.flag('desert_robber_help')
      ? R.T('events.desert_tomb_robber_leave.say_2')
      : R.T('events.desert_tomb_robber_leave.say_3'), { name: R.T('events.desert_tomb_robber_leave.say.name') });
    // 背を向けて、足を引きずって歩きながら薄れて消える（画面ごと暗くしない。持ち主の決まり: 立ち去る人は ev.leave）
    await ev.leave('worm_track', { path: stay ? [[25, 31], [26, 31], [26, 29], [26, 28]] : [[28, 32], [28, 31], [28, 30], [28, 29]], ms: 1400 });
    ev.setFlag('desert_robber_gone');
    await ev.caption(R.T('events.desert_tomb_robber_leave.caption'), { ms: 2000 });
    if (!stay) await ev.camera(null, null, 500);
  }, { meta: { needs: ['flag:desert_worm'], gives: ['flag:desert_robber_gone'] } });
  E('desert_tomb_worm', async (ev) => {
    if (ev.flag('desert_worm')) return;
    ev.sfx('shake');
    await ev.say(null, R.T('events.desert_tomb_worm.say'));
    const r = await ev.battle('tr_b_sandworm', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('desert_worm');
    ev.sfx('unlock');
    await ev.caption(R.T('events.desert_tomb_worm.caption'), { ms: 2400 });
    await ev.call('desert_tomb_robber_leave');
  }, { meta: { needs: [], gives: ['flag:desert_worm', 'flag:desert_robber_gone'], calls: ['desert_tomb_robber_leave'] } });

  // ---------------------------------------------------------------- 3 階: 拓本の跡・玉座
  E('desert_tomb_rubbing', async (ev) => {
    await ev.say(null, R.T('events.desert_tomb_rubbing.say'));
    await X().lore(ev, 'lo_ev_desert');
    ev.lead('l_main_recorder_desert');
  }, { meta: { needs: [], gives: ['flag:lo_ev_desert', 'lead:l_main_recorder_desert'] } });
  E('desert_tomb_throne', async (ev) => {
    if (ev.flag('desert_king')) { await ev.say(null, R.T('events.desert_tomb_throne.say')); return; }
    await ev.say(null, R.T('events.desert_tomb_throne.say_2'));
  });

  // ---------------------------------------------------------------- 名なき砂の王
  E('desert_tomb_king', async (ev) => {
    if (ev.flag('desert_king')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.desert_tomb_king.say'));
    await ev.say('npc_hazal', R.T('events.desert_tomb_king.say_2'), Object.assign({ voice: 'v_hazal_tomb_01' }, HAZAL));
    if (X().glyphs(ev) >= 3 && !ev.has('i_desert_kingname')) ev.item('i_desert_kingname', 1);
    if (ev.has('i_desert_kingname')) await ev.caption(R.T('events.desert_tomb_king.caption'), { ms: 2600 });
    ev.setFlag('desert_named', false);
    const r = await ev.battle('tr_b_sandking', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    await ev.npc('hazal_king').hide();   // 王の霊（cond: desert_king）は、崩れ落ちる語りの後で浮かび上がらせる
    ev.setFlag('desert_king');
    const named = ev.flag('desert_named');
    if (named) {
      await ev.say(null, R.T('events.desert_tomb_king.say_3'));
    } else {
      await ev.say(null, R.T('events.desert_tomb_king.say_4'));
    }
    await ev.appear('hazal_king', { ms: 700 });
    await ev.say('npc_hazal', R.T('events.desert_tomb_king.say_5'), Object.assign({ voice: 'v_hazal_tomb_02' }, HAZAL));
    ev.sfx('quill');
    if (X().glyphs(ev) >= 3 || named) await ev.say(null, R.T('events.desert_tomb_king.say_6'));
    else await ev.say(null, R.T('events.desert_tomb_king.say_7'));
    ev.sfx('light');
    await ev.say('npc_hazal', R.T('events.desert_tomb_king.say_8'), Object.assign({ voice: 'v_hazal_tomb_03' }, HAZAL2));
    await ev.say('npc_hazal', R.T('events.desert_tomb_king.say_9'), Object.assign({ voice: 'v_hazal_tomb_04' }, HAZAL2));
    await ev.say('npc_hazal', R.T('events.desert_tomb_king.say_10'), Object.assign({ voice: ['v_hazal_tomb_05', 'v_hazal_tomb_06', 'v_hazal_tomb_07'] }, HAZAL2));
    if (named) {
      ev.lead('l_main_margin_named');
      await ev.caption(R.T('events.desert_tomb_king.caption_2'), { ms: 2000 });
    }
    ev.leadDone('l_desert_tomb');
    await ev.call('desert_finale');
  }, {
    meta: {
      needs: ['flag:desert_worm'],
      gives: ['flag:desert_king', 'flag:desert_named', 'lead:l_main_margin_named', 'region:r_desert', 'flag:desert_finale_done', 'choice:ch_desert_write'],
      calls: ['desert_finale'],
    },
  });

  // ---------------------------------------------------------------- 灯り直す場面
  E('desert_finale', async (ev) => {
    if (ev.flag('desert_finale_done')) return;
    // 1. 古い泉の底に日輪の火（大灯火）
    await ev.fade('out', 600);
    await ev.warp('desert_camp3', 'spring');
    await ev.clearRegion('r_desert');
    ev.sfx('light');
    ev.bgm('dawn');
    await ev.caption(R.T('events.desert_finale.caption'), { ms: 3200 });
    await ev.say('npc_zaid', R.T('events.desert_finale.say'), { name: R.T('events.desert_finale.say.name'), voice: ['v_zaid_desert_06', 'v_zaid_desert_07'] });
    ev.setFlag('desert_finale_done');
    // 2. カシムへ（帰り道は暗転で省く）
    await ev.fade('out', 600);
    await ev.warp('kasim', 'plaza');
    ev.bgm('kasim');
    await ev.caption(R.T('events.desert_finale.caption_2'), { ms: 3000 });
    await ev.say('fara_after', [R.T('events.desert_finale.say.0')], { name: R.T('events.desert_finale.say.name_2') });
    await ev.say('nadia', R.T('events.desert_finale.say_2'), { name: R.T('events.desert_finale.say.name_3'), voice: ['v_nadia_desert_04', 'v_nadia_desert_05'] });
    ev.sfx('bell');
    await ev.caption(X().SONG_FULL, { ms: 5200, voice: X().SONG_VOICE.full });
    await ev.say(null, R.T('events.desert_finale.say_3'));
    // 日継ぎの主張（STORY_BIBLE §7.2）
    await ev.say('sundial_old', R.T('events.desert_finale.say_4'), { name: R.T('events.desert_finale.say.name_4') });
    // 3. 年代記に書く選択
    await ev.say(null, R.T('events.desert_finale.say_5'));
    const i = await ev.choose(R.T('events.desert_finale.i.choose'), { text: R.T('events.desert_finale.i.choose.text') });
    if (i === 1) {
      ev.choice('ch_desert_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, R.T('events.desert_finale.say_6'));
    } else {
      ev.choice('ch_desert_write', 'legend');
      await ev.say(null, R.T('events.desert_finale.say_7'));
    }
    ev.sfx('quill');
    ev.leadDone('l_desert_spring');
    ev.leadDone('l_desert_song');
    await ev.call('desert_after');
  }, {
    meta: {
      needs: ['flag:desert_king'],
      gives: ['region:r_desert', 'flag:desert_finale_done', 'choice:ch_desert_write', 'var:pain_count+1'],
      calls: ['desert_after'],
      warp: { to: 'kasim', spawn: 'plaza' },
    },
  });

  // 報酬（アブルの砂王の印章・ギルドの割引・隊商路）
  E('desert_after', async (ev) => {
    if (ev.flag('desert_reward_given')) return;
    await ev.say('npc_abul', R.T('events.desert_after.say'), { name: R.T('events.desert_after.say.name') });
    ev.item('ac_tale_desert', 1);
    await ev.say('zaid_after', R.T('events.desert_after.say_2'), { name: R.T('events.desert_after.say.name_2') });
    ev.setFlag('desert_reward_given');
    ev.setFlag('desert_cart');
    await ev.caption(R.T('events.desert_after.caption'), { ms: 2600 });
    const c = X().hawk(ev);
    if (ev.choiceOf('ch_desert_write') === 'pain') await ev.caption(c === 'fight' ? R.T('events.desert_after.caption_2') : R.T('events.desert_after.caption_3'), { ms: 2800 });
    if (ev.flag('yura_dyer_asked') && !ev.flag('yura_dyer_home')) await ev.caption(R.T('events.desert_after.caption_4'), { ms: 2400 });
  }, { meta: { needs: ['flag:desert_finale_done'], gives: ['flag:desert_reward_given', 'flag:desert_cart', 'item:ac_tale_desert'] } });

  // ---------------------------------------------------------------- 解決の後のハザル（王の間と古い泉）
  E('desert_hazal_after', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'npc_hazal';
    if (X().tier() >= 6) { await ev.say(id, R.T('events.desert_hazal_after.say'), HAZAL2); return; }
    if (ctx && ctx.map === 'desert_camp3') {
      await ev.say(id, R.T('events.desert_hazal_after.say_2'), HAZAL2);
      return;
    }
    await ev.say(id, R.T('events.desert_hazal_after.say_3'), HAZAL2);
  });

  // 王墓のオアシスのアブル（名の文字の手がかり）
  E('desert_abul_oasis', async (ev) => {
    const n = X().glyphs(ev);
    ev.lead('l_desert_glyphs');
    if (ev.flag('desert_king')) { await ev.say('abul_oasis', R.T('events.desert_abul_oasis.say')); return; }
    await ev.say('abul_oasis', n >= 3 ? R.T('events.desert_abul_oasis.say_2') : [R.T('events.desert_abul_oasis.say.0'), R.T('events.desert_abul_oasis.say.1', { n }), R.T('events.desert_abul_oasis.say.2')]);
    if (!ev.flag('desert_abul_gift')) {
      ev.setFlag('desert_abul_gift');
      await ev.say('abul_oasis', R.T('events.desert_abul_oasis.say_3'));
      ev.item('i_repel', 2);
    }
  }, { meta: { needs: ['flag:desert_abul_came'], gives: ['lead:l_desert_glyphs'] } });

  E('desert_camp3_oldspring', async (ev) => {
    if (ev.flag('cleared_r_desert')) { await ev.say(null, R.T('events.desert_camp3_oldspring.say')); return; }
    await ev.say(null, R.T('events.desert_camp3_oldspring.say_2'));
  });
})(window.RPG);
