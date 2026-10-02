// ユールのイベント（町の人・屋内・調べる物）。WORLD_REDESIGN §4.3・§3.3（話す見返り）・§5.6、STORY_BIBLE §7.3・§8.4・§3.5・§10
//   yule_arrival（着いたとき。話しかけてこない）・掲示板・ヨルン（支度）・ソーニャ（白紙の本）・ハルド（遠吠え・焼けた北門）
//   町の人: 見返り ①手がかり ②依頼 ③品ぞろえ ④ダンジョンの隠し場所のほのめかし ⑤一度だけの品 ⑥ボスの癖 ⑦近況 をそろえる。
//   台詞は 1 行 全角 16 字前後・3 行まで。解決の後・ティアで台詞が変わる。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Snow.ev;
  const cleared = (ev) => ev.flag('cleared_r_snow');

  // ---------------------------------------------------------------- 着いたとき（祭の飾りつけの最中。話しかけてこない）
  E('yule_arrival', async (ev) => {
    if (ev.flag('snow_festival_lit') && !ev.flag('snow_siege_done')) { await ev.call('yule_siege_resume'); return; }
    if (ev.flag('snow_finale_done') && !ev.flag('snow_day2')) { await ev.call('snow_day2'); return; }
    if (ev.flag('snow_start')) return;
    ev.setFlag('snow_start');
    await ev.caption(R.T('events.yule_arrival.caption'), { ms: 2400 });
    await ev.caption(R.T('events.yule_arrival.caption_2'), { ms: 2400 });
    await ev.caption(R.T('events.yule_arrival.caption_3'), { ms: 2800 });
    await ev.caption(R.T('events.yule_arrival.caption_4'), { ms: 2000 });
  }, { meta: { needs: [], gives: ['flag:snow_start'], calls: ['snow_day2', 'yule_siege_resume'] } });

  // ---------------------------------------------------------------- 掲示板（依頼の張り紙）
  E('yule_board', async (ev) => {
    if (cleared(ev)) {
      await ev.say(null, R.T('events.yule_board.say'));
      return;
    }
    await ev.say(null, R.T('events.yule_board.say_2'));
    await ev.say(null, R.T('events.yule_board.say_3'));
    ev.setFlag('snow_board');
    ev.lead('l_snow_prep'); ev.lead('q_snow_fishing'); ev.lead('q_snow_dog'); ev.lead('q_snow_statue');
  }, { meta: { needs: [], gives: ['flag:snow_board', 'lead:l_snow_prep', 'lead:q_snow_fishing', 'lead:q_snow_dog', 'lead:q_snow_statue'] } });

  // ---------------------------------------------------------------- 村長ヨルン（支度 → 祭の始まり）
  E('yule_jorn', async (ev) => {
    const x = X();
    if (ev.flag('snow_finale_done')) {
      if (!ev.flag('snow_jorn_reward')) { await ev.call('snow_jorn_reward'); return; }
      await ev.say('jorn', ev.choiceOf('ch_snow_write') === 'pain'
        ? R.T('events.yule_jorn.say')
        : R.T('events.yule_jorn.say_2'));
      return;
    }
    if (ev.flag('snow_siege_done')) { await ev.say('jorn', R.T('events.yule_jorn.say_3')); return; }
    if (ev.flag('snow_festival_lit')) return;
    if (!ev.flag('snow_jorn_talked')) {
      await ev.say('jorn', R.T('events.yule_jorn.say_4'), { voice: ['v_jorn_snow_01', 'v_jorn_snow_02'] });
      await ev.say('jorn', R.T('events.yule_jorn.say_5'), { voice: ['v_jorn_snow_03', 'v_jorn_snow_04'] });
      await ev.say('jorn', R.T('events.yule_jorn.say_6'));
      await ev.say('jorn', R.T('events.yule_jorn.say_7'));
      ev.setFlag('snow_jorn_talked');
      ev.lead('l_snow_prep'); ev.lead('q_snow_ingrid');
      return;
    }
    const logs = ev.flag('snow_logs_done'), ice = ev.flag('snow_ice_done'), tales = ev.flag('snow_tales_done');
    if (logs && tales) {
      if (!ice) {
        const i = await ev.choose(R.T('events.yule_jorn.i.choose'), { cancel: 1, who: 'jorn', text: R.T('events.yule_jorn.i.choose.text') });
        if (i !== 0) { await ev.say('jorn', R.T('events.yule_jorn.say_8')); return; }
      } else {
        const i = await ev.choose(R.T('events.yule_jorn.i.choose_2'), { cancel: 1, who: 'jorn', text: R.T('events.yule_jorn.i.choose.text_2') });
        if (i !== 0) { await ev.say('jorn', R.T('events.yule_jorn.say_9')); return; }
      }
      // 祭を始めると籠城の夜が明けるまで村から出られない（出口もワープも無い）。始める前に念を押す（テスター 2026-10-02 P23・P24）
      const sure = await ev.choose(R.T('events.yule_jorn.confirm'), { cancel: 1, who: 'jorn', text: R.T('events.yule_jorn.confirm.text') });
      if (sure !== 0) { await ev.say('jorn', R.T('events.yule_jorn.say_9')); return; }
      await ev.call('snow_festival');
      return;
    }
    const left = [];
    if (!logs) left.push(R.T('events.yule_jorn', { var: ev.var('snow_logs') }));
    if (!ice) left.push(R.T('events.yule_jorn_2'));
    if (!tales) left.push(R.T('events.yule_jorn_3', { length: ['snow_tale_dragon', 'snow_tale_hunter', 'snow_tale_fire_child'].filter((f) => ev.flag(f)).length }));
    await ev.say('jorn', [R.T('events.yule_jorn.say.0', { join: left.join(R.T('events.yule_jorn.say.0.join')) }), x.prep(ev) >= 2 ? R.T('events.yule_jorn.say.1') : R.T('events.yule_jorn.say.1_2')]);
  }, { meta: { needs: [], gives: ['flag:snow_jorn_talked', 'lead:l_snow_prep', 'lead:q_snow_ingrid'], calls: ['snow_festival', 'snow_jorn_reward'] } });

  E('snow_jorn_reward', async (ev) => {
    if (ev.flag('snow_jorn_reward')) return;
    await ev.say('jorn', R.T('events.snow_jorn_reward.say'));
    ev.item('ac_tale_snow', 1);
    ev.setFlag('snow_jorn_reward');
    await ev.say('jorn', R.T('events.snow_jorn_reward.say_2'));
  }, { meta: { needs: ['flag:snow_finale_done'], gives: ['item:ac_tale_snow', 'flag:snow_jorn_reward'] } });

  // ---------------------------------------------------------------- 火守りの娘ソーニャ（白紙の本・夜数えの板）
  E('yule_sonja', async (ev) => {
    if (ev.flag('snow_finale_done')) {
      await ev.say('sonja', ev.flag('snow_board_stop')
        ? R.T('events.yule_sonja.say')
        : R.T('events.yule_sonja.say_2'));
      return;
    }
    if (ev.flag('snow_siege_done')) { await ev.say('sonja', R.T('events.yule_sonja.say_3')); return; }
    if (!ev.flag('snow_sonja_talked')) {
      await ev.say('sonja', R.T('events.yule_sonja.say_4'), { voice: ['v_sonja_snow_01', 'v_sonja_snow_02'] });
      await ev.say('sonja', R.T('events.yule_sonja.say_5'), { voice: ['v_sonja_snow_03', 'v_sonja_snow_04'] });
      await ev.say('sonja', R.T('events.yule_sonja.say_6'));
      ev.setFlag('snow_sonja_talked');
      ev.lead('l_snow_book');
      return;
    }
    await ev.say('sonja', ev.flag('lo_ev_snow')
      ? R.T('events.yule_sonja.say_7')
      : R.T('events.yule_sonja.say_8'));
    if (ev.flag('lo_ev_snow')) ev.lead('l_main_recorder_snow');
  }, { meta: { needs: [], gives: ['flag:snow_sonja_talked', 'lead:l_snow_book', 'lead:l_main_recorder_snow'] } });

  // ---------------------------------------------------------------- 見張りの老人ハルド（遠吠え・焼けた北門・戦の傷）
  E('yule_hald', async (ev) => {
    if (cleared(ev)) {
      await ev.say('hald', R.T('events.yule_hald.say'));
      return;
    }
    if (ev.flag('snow_siege_done')) { await ev.say('hald', R.T('events.yule_hald.say_2')); return; }
    if (!ev.flag('snow_hald_talked')) {
      await ev.say('hald', R.T('events.yule_hald.say_3'));
      await ev.say('hald', R.T('events.yule_hald.say_4'));
      ev.setFlag('snow_hald_talked');
      ev.lead('l_snow_howl');
      return;
    }
    const i = ev.var('snow_hald_tip') % 3;
    ev.addVar('snow_hald_tip', 1);
    const tips = [
      R.T('events.yule_hald.tips.0'),
      R.T('events.yule_hald.tips.1'),
      R.T('events.yule_hald.tips.2'),
    ];
    await ev.say('hald', tips[i]);
  }, { meta: { needs: [], gives: ['flag:snow_hald_talked', 'lead:l_snow_howl'] } });

  E('yule_burnt_gate', async (ev) => {
    await ev.say(null, [R.T('events.yule_burnt_gate.say.0')]);
    if (ev.flag('snow_hald_talked')) await ev.say(null, R.T('events.yule_burnt_gate.say'));
    await X().lore(ev, 'lo_war_snow');
  }, { meta: { needs: [], gives: ['flag:lo_war_snow'] } });

  // ---------------------------------------------------------------- 町の人（見返り）
  E('yule_watch_e', async (ev) => {
    // ⑥ ボスの癖（吹雪の大狼・氷壁の巨人）
    if (cleared(ev)) { await ev.say('watch_e', R.T('events.yule_watch_e.say')); return; }
    const i = ev.var('snow_watch_tip') % 2;
    ev.addVar('snow_watch_tip', 1);
    await ev.say('watch_e', [
      R.T('events.yule_watch_e.say.0'),
      R.T('events.yule_watch_e.say.1'),
    ][i]);
  });

  E('yule_soup', async (ev) => {
    // ⑤ 一度だけの品
    if (!ev.flag('snow_soup_given')) {
      await ev.say('soup_woman', R.T('events.yule_soup.say'));
      X().small(ev, [['i_potion', 2], ['i_potion', 3], ['i_potion', 4], ['i_incense', 2], ['i_incense', 3], ['i_elixir', 2]]);   // 表はティア順。癒やしの霊水（全回復）は終盤（ティア 5）から（オーナー 2026-09-28）
      ev.setFlag('snow_soup_given');
      return;
    }
    await ev.say('soup_woman', cleared(ev) ? R.T('events.yule_soup.say_2') : R.T('events.yule_soup.say_3'));
  }, { meta: { needs: [], gives: ['flag:snow_soup_given'] } });

  E('yule_traveler', async (ev) => {
    // ① 寄り道のうわさ
    await ev.say('traveler', R.T('events.yule_traveler.say'));
    ev.lead('l_opt_pass_inn');
    if (X().skyLine()) await ev.say('traveler', X().skyLine());
  }, { meta: { needs: [], gives: ['lead:l_opt_pass_inn'] } });

  E('yule_tadeo', async (ev) => {
    // ⑦ 近況（地方をまたぐ人物タデオ。STORY_BIBLE §8.10）
    const t = X().tier();
    await ev.say('tadeo', t >= 6 ? [R.T('events.yule_tadeo.say.0')]
      : t >= 4 ? [R.T('events.yule_tadeo.say.0_2')]
        : R.T('events.yule_tadeo.say'));
  });

  E('yule_woodsman', async (ev) => {
    // ① 手がかり（薪集めの場所）・④ 雪の林の宝箱
    if (cleared(ev)) { await ev.say('villager_m', R.T('events.yule_woodsman.say')); return; }
    await ev.say('villager_m', R.T('events.yule_woodsman.say_2'));
    await ev.say('villager_m', R.T('events.yule_woodsman.say_3'));
    ev.lead('l_snow_prep');
  }, { meta: { needs: [], gives: ['lead:l_snow_prep'] } });

  E('yule_oldman', async (ev) => {
    // ⑦ 世代で分かれる記憶（STORY_BIBLE §3.5）・④ 峰の隠し通路のほのめかし
    if (cleared(ev)) { await ev.say('old_m', [R.T('events.yule_oldman.say.0')]); return; }
    await ev.say('old_m', R.T('events.yule_oldman.say'));
    await ev.say('old_m', R.T('events.yule_oldman.say_2'));
  });

  E('yule_scribe', async (ev) => {
    await ev.say('scribe', R.T('events.yule_scribe.say'));
  });

  E('yule_kid_a', async (ev) => {
    // 秘密基地の合言葉のほのめかし（1）
    if (ev.flag('snow_base_open')) { await ev.say('kid_a', R.T('events.yule_kid_a.say')); return; }
    await ev.say('kid_a', R.T('events.yule_kid_a.say_2'));
    ev.lead('q_snow_base');
  }, { meta: { needs: [], gives: ['lead:q_snow_base'] } });
  E('yule_kid_b', async (ev) => {
    // 秘密基地の合言葉のほのめかし（2）・⑦
    if (ev.flag('snow_base_open')) { await ev.say('kid_b', R.T('events.yule_kid_b.say')); return; }
    await ev.say('kid_b', R.T('events.yule_kid_b.say_2'));
    ev.lead('q_snow_base');
  }, { meta: { needs: [], gives: ['lead:q_snow_base'] } });

  // ---------------------------------------------------------------- 調べる物（町）
  E('yule_hearth', async (ev) => {
    if (cleared(ev)) { await ev.say(null, R.T('events.yule_hearth.say')); return; }
    if (ev.flag('snow_siege_done')) { await ev.say(null, R.T('events.yule_hearth.say_2')); return; }
    await ev.say(null, R.T('events.yule_hearth.say_3'));
  });
  E('yule_pond', async (ev) => {
    if (ev.flag('snow_saw') && !ev.flag('snow_ice_done')) { await ev.call('yule_pond_ice'); return; }
    await ev.say(null, R.T('events.yule_pond.say'));
  });
  E('yule_north_gate', async (ev) => {
    await ev.say(null, cleared(ev) ? R.T('events.yule_north_gate.say') : R.T('events.yule_north_gate.say_2'));
  });
  // 籠城の夜: 家の戸は閉ざされている（戸口を調べる）
  E('yule_night_door', async (ev) => {
    await ev.say(null, R.T('events.yule_night_door.say'));
  });
  E('yule_snowman', async (ev) => {
    const c = ev.choiceOf('ch_snow_statue');
    if (c) { await ev.say(null, { dragon: R.T('events.yule_snowman.say.dragon'), wolf: R.T('events.yule_snowman.say.wolf'), hearth: R.T('events.yule_snowman.say.hearth') }[c]); return; }
    await ev.call('yule_sculptor');
  }, { meta: { calls: ['yule_sculptor'] } });

  // ---------------------------------------------------------------- 屋内: 集会所
  E('yule_hall_hearth', async (ev) => {
    await ev.say(null, cleared(ev) ? R.T('events.yule_hall_hearth.say') : [R.T('events.yule_hall_hearth.say.0')]);
  });
  E('yule_nightboard', async (ev) => {
    // 時の証（lo_time_snow）
    await ev.say(null, [R.T('events.yule_nightboard.say.0')]);
    await ev.say(null, R.T('events.yule_nightboard.say'));
    if (ev.flag('snow_finale_done')) await ev.say(null, R.T('events.yule_nightboard.say_2'));
    await X().lore(ev, 'lo_time_snow');
  }, { meta: { needs: [], gives: ['flag:lo_time_snow'] } });
  E('yule_blank_book', async (ev) => {
    // 記録院の物証（lo_ev_snow）
    await ev.say(null, R.T('events.yule_blank_book.say'));
    await ev.say(null, R.T('events.yule_blank_book.say_2'));
    ev.item('k_blank_book', 1);
    await X().lore(ev, 'lo_ev_snow');
    ev.leadDone('l_snow_book');
    ev.lead('l_main_recorder_snow');
  }, { meta: { needs: [], gives: ['flag:lo_ev_snow', 'item:k_blank_book', 'lead:l_main_recorder_snow'] } });
  E('yule_hall_helper', async (ev) => {
    // ③ 品ぞろえ（祭の間の毛皮の行商）・⑦
    await ev.say('hall_helper', cleared(ev) ? R.T('events.yule_hall_helper.say') : R.T('events.yule_hall_helper.say_2'));
  });
  E('yule_hall_kid', async (ev) => {
    await ev.say('hall_kid', X().skyLine() || R.T('events.yule_hall_kid.say'));
  });

  // ---------------------------------------------------------------- 屋内: 宿・店・家
  E('yule_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? R.T('events.yule_inn_keeper.say') : R.T('events.yule_inn_keeper.say_2'));
    await ev.inn();
  });
  E('yule_inn_guest', async (ev) => {
    // ① 寄り道のうわさ（つららの回廊）
    await ev.say('inn_guest', R.T('events.yule_inn_guest.say'));
    ev.lead('l_opt_icicle');
  }, { meta: { needs: [], gives: ['lead:l_opt_icicle'] } });
  E('yule_inn_bard', async (ev) => {
    // ① 寄り道のうわさ（オーロラの崖）・近況
    await ev.say('inn_bard', R.T('events.yule_inn_bard.say'));
    ev.lead('l_opt_aurora');
  }, { meta: { needs: [], gives: ['lead:l_opt_aurora'] } });
  E('yule_inn_desk', async (ev) => {
    // 地方をまたぐ連作「ピムの語り部修行」（WORLD §4.9）: 解決した地方の話をピムへ手紙で
    if (ev.flag('forest_pim_poet') && cleared(ev) && !ev.flag('forest_pim_letter_snow')) {
      const i = await ev.choose(R.T('events.yule_inn_desk.i.choose'), { cancel: 1, text: R.T('events.yule_inn_desk.i.choose.text') });
      if (i !== 0) return;
      await ev.say(null, R.T('events.yule_inn_desk.say'));
      ev.setFlag('forest_pim_letter_snow');
      ev.addVar('forest_pim_letters', 1);
      return;
    }
    await ev.say(null, R.T('events.yule_inn_desk.say_2'));
  }, { meta: { needs: [], gives: [] } });
  E('yule_item_keeper', async (ev) => {
    await ev.say('item_keeper', R.T('events.yule_item_keeper.say'));
    await ev.shop('shop_yule_items');
  });
  E('yule_smith', async (ev) => {
    const low = ev.flag('snow_gate_e_broken');
    await ev.say('smith', low ? R.T('events.yule_smith.say') : R.T('events.yule_smith.say_2'));
    await ev.shop(low ? 'shop_yule_arms_low' : 'shop_yule_arms', low ? { line: R.T('events.yule_smith.line') } : undefined);
  });
  E('yule_fur', async (ev) => {
    await ev.say('fur_peddler', R.T('events.yule_fur.say'));
    await ev.shop('shop_yule_fur');
  });
  E('yule_jorn_ledger', async (ev) => {
    await ev.say(null, R.T('events.yule_jorn_ledger.say'));
  });
  E('yule_jorn_wife', async (ev) => {
    // ⑤ 一度だけの品
    if (!ev.flag('snow_jorn_wife_given')) {
      await ev.say('jorn_wife', R.T('events.yule_jorn_wife.say'));
      ev.item('i_thaw', 2);
      ev.setFlag('snow_jorn_wife_given');
      return;
    }
    await ev.say('jorn_wife', cleared(ev) ? R.T('events.yule_jorn_wife.say_2') : R.T('events.yule_jorn_wife.say_3'));
  }, { meta: { needs: [], gives: ['flag:snow_jorn_wife_given'] } });
  E('yule_sonja_fire', async (ev) => {
    await ev.say(null, [R.T('events.yule_sonja_fire.say.0')]);
  });
  E('yule_sonja_note', async (ev) => {
    await ev.say(null, R.T('events.yule_sonja_note.say'));
  });
  E('yule_sonja_gran', async (ev) => {
    // ⑦ 世代で分かれる記憶・ティアの近況
    if (cleared(ev)) { await ev.say('sonja_gran', R.T('events.yule_sonja_gran.say')); return; }
    await ev.say('sonja_gran', R.T('events.yule_sonja_gran.say_2'));
  });
  E('yule_hunter_bow', async (ev) => {
    await ev.say(null, [R.T('events.yule_hunter_bow.say.0')]);
  });
  E('yule_base_in', async (ev) => {
    await ev.say('pekka_in', R.T('events.yule_base_in.say'));
  });
  E('yule_base_drawing', async (ev) => {
    await ev.say(null, R.T('events.yule_base_drawing.say'));
  });

  // ---------------------------------------------------------------- ノルデン分室の空き家（記録院の物証の続き・くべられなかった手紙）
  E('yule_branch_desk', async (ev) => {
    if (ev.var('snow_lz')) { await ev.say(null, R.T('events.yule_branch_desk.say')); return; }
    await ev.say(null, R.T('events.yule_branch_desk.say_2'));
    await R.Snow.ev.lz(ev);
  }, { meta: { needs: [], gives: ['var:snow_lz'] } });
  E('yule_branch_shelf', async (ev) => {
    await ev.say(null, R.T('events.yule_branch_shelf.say'));
    ev.leadDone('l_main_recorder_snow');
  });
})(window.RPG);
