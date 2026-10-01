// CONTENT-F: フェルンのイベント（V2_PLAN §3.3 F1〜F4・F12、WORLD_REDESIGN §4.1・§3.3、STORY_BIBLE §7.1・§8.2）
//   fern_arrival（F1、onEnter）・fern_board・fern_gord（F3）・fern_rita（F4）・fern_pim_mother（F2）・fern_hanna（＋一品物 ac_tale_forest）
//   町の人（話す見返り: 手がかり・依頼・一度だけの品・ボスの癖・ほのめかし・近況）と屋内の人・調べる物。
//   向こうから寄ってきて事件を話す人は置かない（WORLD §3.1 の 1）。台詞は 1 行 全角 16 字前後・3 行まで。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const F = () => R.ContentF.forest;
  const cleared = (ev) => ev.flag('cleared_r_forest');

  // ---------------------------------------------------------------- F1 着いたとき（話しかけてこない。広場の人だかりと張り紙）
  E('fern_arrival', async (ev) => {
    if (ev.flag('forest_start')) return;
    ev.setFlag('forest_start');
    await ev.caption(R.T('events.fern_arrival.caption'), { ms: 2600 });
    await ev.caption(R.T('events.fern_arrival.caption_2'), { ms: 2000 });
  }, { meta: { needs: [], gives: ['flag:forest_start'] } });

  // 掲示板（l_forest_board）
  E('fern_board', async (ev) => {
    if (cleared(ev)) {
      await ev.say(null, R.T('events.fern_board.say'));
      await ev.say(null, R.T('events.fern_board.say_2'));
      return;
    }
    await ev.say(null, R.T('events.fern_board.say_3'));
    await ev.say(null, R.T('events.fern_board.say_4'));
    ev.setFlag('forest_board');
    ev.lead('l_forest_board');
  }, { meta: { needs: [], gives: ['lead:l_forest_board', 'flag:forest_board'] } });

  E('fern_search_lead', async (ev) => {
    if (ev.flag('forest_found_hans') && ev.flag('forest_found_ben') && ev.flag('forest_found_roy')) {
      await ev.say('search_lead', R.T('events.fern_search_lead.say'));
      return;
    }
    await ev.say('search_lead', R.T('events.fern_search_lead.say_2'));
    ev.lead('l_forest_board');
  }, { meta: { needs: [], gives: ['lead:l_forest_board'] } });

  // ---------------------------------------------------------------- F3 きこり頭ゴード（l_forest_woodcutters）
  E('fern_gord', async (ev) => {
    const f = F();
    // ファロスからの届け物（q_pharos_delivery、依頼の中身は CONTENT-P）
    if (ev.has('k_ship_parcel') && !ev.flag('q_pharos_delivery_done')) {
      await ev.say('gord', R.T('events.fern_gord.say'));
      ev.take('k_ship_parcel', 1);
      ev.gold(150);
      ev.setFlag('q_pharos_delivery_done');
      ev.leadDone('q_pharos_delivery');
    }
    if (cleared(ev)) {
      if (ev.choiceOf('ch_forest_write') === 'pain') {
        await ev.say('gord', R.T('events.fern_gord.say_2'));
      } else {
        await ev.say('gord', R.T('events.fern_gord.say_3'));
      }
      return;
    }
    if (!ev.flag('forest_gord_talked')) {
      await ev.say('gord', R.T('events.fern_gord.say_4'));
      await ev.say('gord', R.T('events.fern_gord.say_5'));
      ev.setFlag('forest_gord_talked');
      ev.lead('l_forest_woodcutters');
      ev.lead('l_forest_board');
      return;
    }
    const n = f.count(ev);
    if (n > 0) await ev.say('gord', R.T('events.fern_gord.say_6', { n }));
    else await ev.say('gord', R.T('events.fern_gord.say_7'));
  }, { meta: { needs: [], gives: ['lead:l_forest_woodcutters', 'flag:forest_gord_talked', 'flag:q_pharos_delivery_done'] } });

  // ---------------------------------------------------------------- F2 ピムの母カトリ（帽子の片方 k_pim_hat → l_forest_pim）
  E('fern_pim_mother', async (ev) => {
    if (cleared(ev)) {
      await ev.say('katri', R.T('events.fern_pim_mother.say'));
      return;
    }
    if (ev.flag('forest_found_pim')) {
      if (ev.choiceOf('ch_forest_pim') === 'send' && !ev.flag('forest_katri_thanks')) {
        await ev.say('katri', R.T('events.fern_pim_mother.say_2'));
        R.ContentF.forest.give(ev, 'i_potion', 3);
        await ev.say('katri', R.T('events.fern_pim_mother.say_3'));
        ev.setFlag('forest_katri_thanks');
        return;
      }
      await ev.say('katri', R.T('events.fern_pim_mother.say_4'));
      return;
    }
    if (!ev.has('k_pim_hat')) {
      await ev.say('katri', R.T('events.fern_pim_mother.say_5'));
      await ev.say('katri', R.T('events.fern_pim_mother.say_6'));
      R.ContentF.forest.give(ev, 'k_pim_hat', 1);
      ev.lead('l_forest_pim');
      return;
    }
    await ev.say('katri', R.T('events.fern_pim_mother.say_7'));
  }, { meta: { needs: [], gives: ['item:k_pim_hat', 'lead:l_forest_pim', 'flag:forest_katri_thanks'] } });

  E('fern_pim_bed', async (ev) => {
    await ev.say(null, R.T('events.fern_pim_bed.say'));
  });

  // ---------------------------------------------------------------- F4 リタ（l_forest_song）
  E('fern_rita', async (ev) => {
    const f = F();
    const n = ev.var('forest_verses');
    if (cleared(ev)) {
      await ev.say('rita', R.T('events.fern_rita.say'));
      await ev.caption(ev.choiceOf('ch_forest_write') === 'pain' ? f.SONG + '\n' + f.EXTRA : f.SONG, { ms: 5200 });
      if (ev.choiceOf('ch_forest_write') === 'pain') await ev.say('rita', R.T('events.fern_rita.say_2'));
      else await ev.say('rita', R.T('events.fern_rita.say_3'));
      return;
    }
    if (n >= 3) { await ev.say('rita', R.T('events.fern_rita.say_4')); return; }
    if (n > 0) { await ev.say('rita', [R.T('events.fern_rita.say.0'), R.T('events.fern_rita.say.1', { p0: 3 - n })]); return; }
    if (!ev.flag('forest_rita_talked')) {
      await ev.say('rita', R.T('events.fern_rita.say_5'), { voice: ['v_rita_forest_01', 'v_rita_forest_02'] });
      await ev.say('rita', R.T('events.fern_rita.say_6'));
      await ev.say('rita', R.T('events.fern_rita.say_7'));
      ev.setFlag('forest_rita_talked');
      ev.lead('l_forest_song');
      return;
    }
    await ev.say('rita', R.T('events.fern_rita.say_8'));
  }, { meta: { needs: [], gives: ['lead:l_forest_song', 'flag:forest_rita_talked'] } });

  // 広場の千年樹の歌の碑（解決の前は下半分が白くかすれている）
  E('fern_monument', async (ev) => {
    if (ev.flag('cleared_r_forest')) {
      await ev.say(null, R.T('events.fern_monument.say'));
      await ev.caption(F().SONG, { ms: 4200 });
      return;
    }
    await ev.say(null, R.T('events.fern_monument.say_2'));
  });

  E('fern_rita_stone', async (ev) => {
    await ev.say(null, R.T('events.fern_rita_stone.say'));
  });

  // ---------------------------------------------------------------- 村の年寄りハンナ（解決の後に ac_tale_forest。ロアの出で「おはよう」を知っている）
  E('fern_hanna', async (ev) => {
    if (ev.flag('forest_finale_done') && !ev.flag('fern_hanna_reward')) { await ev.call('fern_hanna_reward'); return; }
    if (cleared(ev)) {
      await ev.say('hanna', R.T('events.fern_hanna.say'));
      return;
    }
    if (!ev.flag('forest_hanna_talked')) {
      await ev.say('hanna', R.T('events.fern_hanna.say_2'));
      await ev.say('hanna', R.T('events.fern_hanna.say_3'));
      ev.setFlag('forest_hanna_talked');
      return;
    }
    await ev.say('hanna', R.T('events.fern_hanna.say_4'));
  }, { meta: { needs: [], gives: ['flag:forest_hanna_talked'], calls: ['fern_hanna_reward'] } });

  E('fern_hanna_reward', async (ev) => {
    if (ev.flag('fern_hanna_reward')) return;
    await ev.say('hanna', R.T('events.fern_hanna_reward.say'));
    R.ContentF.forest.give(ev, 'ac_tale_forest', 1);
    ev.setFlag('fern_hanna_reward');
    await ev.say('hanna', R.T('events.fern_hanna_reward.say_2'));
  }, { meta: { needs: ['flag:forest_finale_done'], gives: ['item:ac_tale_forest', 'flag:fern_hanna_reward'] } });

  // ---------------------------------------------------------------- 町の人（見返り）
  E('fern_hunter', async (ev) => {
    // ⑥ ボスの癖（WORLD §4.10 の考えどころを先に）
    if (cleared(ev)) { await ev.say('hunter', R.T('events.fern_hunter.say')); return; }
    const i = ev.var('forest_hunter_tip') % 3;
    ev.addVar('forest_hunter_tip', 1);
    const tips = [
      R.T('events.fern_hunter.tips.0'),
      R.T('events.fern_hunter.tips.1'),
      R.T('events.fern_hunter.tips.2'),
    ];
    await ev.say('hunter', tips[i]);
  }, { meta: { needs: [], gives: [] } });

  E('fern_kid', async (ev) => {
    // ④ ダンジョンの中の隠し通路のほのめかし（場所まで言う）
    if (cleared(ev)) { await ev.say('kid', R.T('events.fern_kid.say')); return; }
    await ev.say('kid', R.T('events.fern_kid.say_2'));
  });

  E('fern_traveler', async (ev) => {
    // ① 寄り道のうわさ（手がかり）
    await ev.say('traveler', R.T('events.fern_traveler.say'));
    ev.lead('l_opt_hut');
    await ev.say('traveler', R.T('events.fern_traveler.say_2'));
    ev.lead('l_opt_yura');
  }, { meta: { needs: [], gives: ['lead:l_opt_hut', 'lead:l_opt_yura'] } });

  E('fern_old_woodcutter', async (ev) => {
    // ⑦ 近況・戦の傷（伐り跡の原）
    if (cleared(ev)) {
      await ev.say('elder_m', ev.choiceOf('ch_forest_write') === 'pain'
        ? R.T('events.fern_old_woodcutter.say')
        : [R.T('events.fern_old_woodcutter.say.0')]);
      return;
    }
    await ev.say('elder_m', R.T('events.fern_old_woodcutter.say_2'));
  });

  E('fern_cutover', async (ev) => {
    await ev.say(null, [R.T('events.fern_cutover.say.0')]);
    if (ev.choiceOf('ch_forest_write') === 'pain') await ev.say(null, R.T('events.fern_cutover.say'));
    await R.ContentF.forest.lore(ev, 'lo_war_forest');
  }, { meta: { needs: [], gives: ['flag:lo_war_forest'] } });

  E('fern_peddler', async (ev) => {
    await ev.say('peddler', cleared(ev) ? R.T('events.fern_peddler.say') : R.T('events.fern_peddler.say_2'));
    await ev.shop('shop_fern_peddler');
  });

  E('fern_yura_miller', async (ev) => {
    // 連作「名前を忘れた人々」の 1 人目（WORLD §4.9）: ユラで名を思い出し、フェルンへ帰った粉ひきのエダ
    if (!ev.flag('yura_miller_thanked')) {
      await ev.say('yura_miller', R.T('events.fern_yura_miller.say'));
      await ev.say('yura_miller', R.T('events.fern_yura_miller.say_2'));
      R.ContentF.forest.small(ev, [['i_potion', 2], ['i_potion', 3], ['i_potion', 4], ['i_incense', 2], ['i_incense', 3], ['i_elixir', 2]]);   // 表はティア順。癒やしの霊水（全回復）は終盤（ティア 5）から（オーナー 2026-09-28）
      ev.setFlag('yura_miller_thanked');
      ev.leadDone('q_yura_names');
      return;
    }
    await ev.say('yura_miller', R.T('events.fern_yura_miller.say_3'));
  }, { meta: { needs: ['flag:yura_miller_home'], gives: ['flag:yura_miller_thanked'] } });

  // ---------------------------------------------------------------- 屋内の人
  E('fern_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? R.T('events.fern_inn_keeper.say') : R.T('events.fern_inn_keeper.say_2'));
    await ev.inn();
  });
  E('fern_inn_guest', async (ev) => {
    if (cleared(ev)) { await ev.say('inn_guest', R.T('events.fern_inn_guest.say')); return; }
    await ev.say('inn_guest', R.T('events.fern_inn_guest.say_2'));
  });
  E('fern_shop_keeper', async (ev) => {
    await ev.say('shop_keeper', R.T('events.fern_shop_keeper.say'));
    // 森の蛾の眠りの粉と、眠りよけのお守り（持ち主 2026-10-01: 戦う前にほのめかす）
    if (!ev.flag('forest_moth') && !cleared(ev)) await ev.say('shop_keeper', R.T('events.fern_shop_keeper.say_2'));
    await ev.shop('shop_fern_items');
  });
  E('fern_search_chief', async (ev) => {
    if (cleared(ev)) { await ev.say('search_chief', R.T('events.fern_search_chief.say')); return; }
    await ev.say('search_chief', R.T('events.fern_search_chief.say_2'));
  });
  E('fern_search_map', async (ev) => {
    await ev.say(null, R.T('events.fern_search_map.say'));
  });

  // ---------------------------------------------------------------- 締めのあとのピム（連作「ピムの語り部修行」の始まり）
  E('fern_pim_after', async (ev) => {
    if (!ev.flag('forest_pim_poet')) {
      await ev.say('pim_after', R.T('events.fern_pim_after.say'));
      await ev.say('pim_after', R.T('events.fern_pim_after.say_2'));
      await ev.letter('letter_forest_pim_poem');
      ev.setFlag('forest_pim_poet');
      ev.lead('q_pim_poet');
      return;
    }
    await ev.say('pim_after', ev.choiceOf('ch_forest_pim') === 'take'
      ? R.T('events.fern_pim_after.say_3')
      : R.T('events.fern_pim_after.say_4'));
  }, { meta: { needs: ['region:r_forest'], gives: ['lead:q_pim_poet', 'flag:forest_pim_poet'] } });
})(window.RPG);
