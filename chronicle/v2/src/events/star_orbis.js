// CONTENT（オルビス高原）: 学術都市オルビスの人と物（WORLD_REDESIGN §4.8・§5.12、STORY_BIBLE §7.8・§8.9）。
//   着く（城壁の中は薄暗く星灯だけ。学院区の門に番兵、天文台区の人は空を見上げてため息）→ 手がかり 3 つ
//   （天文台のルカ「消える星」・学院区の門の番兵「封鎖された塔」・図書館の司書「学長の伝言」）→ 潜入の準備（順不同、2 つで入れる）:
//     鍵の組み合わせ = 学生 3 人から 1 つずつ（セレス: 試験の問答の稽古／ミロ: 落とし物の銀の羽ペン／ティモ: 洗濯場のイーダへの恋文）
//     見回りの順番 = 酒場の夜番の年寄りの日誌（一杯おごる）か、守衛室の窓からのぞく
//     学院の制服 = 仕立屋で買う（高い）か、洗濯場で借りる（夜のうちに返す）
//   → 学院の大扉の前で「消灯の刻を待って忍びこむ」（star_academy.js）。
//   依頼: 星見（天文台の望遠鏡、mini.sequence）・学院の試験（問答）・図書館の返却（延滞の本 5 冊）・【灯りを守る】星灯の見張り（油）。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。仲間の名前は出さない（A36）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Star.ev;
  const cleared = (ev) => ev.flag('cleared_r_star');
  const LUCA = { name: R.T('ev.star_orbis.LUCA.name'), title: R.T('ev.star_orbis.LUCA.title') };
  const OCTAVIA = { name: R.T('ev.star_orbis.OCTAVIA.name'), title: R.T('ev.star_orbis.OCTAVIA.title') };

  // ---------------------------------------------------------------- 町に入る
  E('orbis_arrival', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('star_arrived_after')) { ev.setFlag('star_arrived_after'); await ev.caption(R.T('events.orbis_arrival.caption'), { ms: 2600 }); }
      return;
    }
    if (ev.flag('star_arrived')) return;
    ev.setFlag('star_arrived');
    await ev.caption(R.T('events.orbis_arrival.caption_2'), { ms: 2800 });
    await ev.caption(R.T('events.orbis_arrival.caption_3'), { ms: 2600 });
  }, { meta: { needs: [], gives: ['flag:star_arrived'] } });

  // ---------------------------------------------------------------- 天文台のルカ（消える星・観測録・星見）
  E('star_luca', async (ev) => {
    const x = X();
    if (cleared(ev)) {
      await ev.say('luca', ev.choiceOf('ch_star_write') === 'pain'
        ? R.T('events.star_luca.say')
        : R.T('events.star_luca.say_2'), LUCA);
      if (!ev.flag('star_stargaze_done')) await ev.say('luca', R.T('events.star_luca.say_3'), LUCA);
      return;
    }
    if (!ev.flag('star_luca_met')) {
      ev.setFlag('star_luca_met');
      await ev.say('luca', R.T('events.star_luca.say_4'), LUCA);
      await ev.say('luca', R.T('events.star_luca.say_5'), LUCA);
      await ev.say('luca', R.T('events.star_luca.say_6'), LUCA);
      await ev.say('luca', R.T('events.star_luca.say_7'), LUCA);
      await ev.call('star_obs_log');
      ev.lead('l_star_stars');
      ev.lead('q_star_stargaze');
      return;
    }
    if (ev.flag('star_chart_got') && !ev.flag('star_tower_open')) {
      await ev.say('luca', R.T('events.star_luca.say_8'), LUCA);
      return;
    }
    await ev.say('luca', ev.flag('star_tower_open')
      ? R.T('events.star_luca.say_9')
      : R.T('events.star_luca.say_10'), LUCA);
  }, { meta: { needs: [], gives: ['flag:star_luca_met', 'lead:l_star_stars', 'lead:q_star_stargaze', 'lore:lo_time_star'], calls: ['star_obs_log'] } });
  // 観測録（時の証 lo_time_star）
  E('star_obs_log', async (ev) => {
    const first = !ev.flag('lo_time_star');
    await X().narr(ev, R.T('events.star_obs_log.narr'));
    await ev.caption(R.T('events.star_obs_log.caption'), { ms: 2400 });
    await X().narr(ev, R.T('events.star_obs_log.narr_2'));
    if (first) {
      await ev.say('luca', R.T('events.star_obs_log.say'), LUCA);
      await ev.say('luca', R.T('events.star_obs_log.say_2'), LUCA);
    }
    await X().lore(ev, 'lo_time_star');
  }, { meta: { needs: [], gives: ['lore:lo_time_star'] } });
  // 星見（天文台の望遠鏡で星座を探す。mini.sequence。3 段）
  const GAZE = [
    { label: R.T('ev.star_orbis.GAZE.0.label'), rounds: 2, tempo: 640, reward: ['i_ether', 2] },
    { label: R.T('ev.star_orbis.GAZE.1.label'), rounds: 3, tempo: 560, reward: ['i_potion2', 2] },
    { label: R.T('ev.star_orbis.GAZE.2.label'), rounds: 4, tempo: 480, reward: ['u_star_compass', 1] },
  ];
  const RANK_OK = { S: true, A: true, B: true };
  E('star_telescope', async (ev) => {
    if (!ev.flag('star_luca_met')) { await X().narr(ev, R.T('events.star_telescope.narr')); return; }
    const i = ev.var('star_gaze');
    if (i >= GAZE.length) { await X().narr(ev, R.T('events.star_telescope.narr_2')); return; }
    const st = GAZE[i];
    await ev.say('luca', R.T('events.star_telescope.say', { label: st.label }), LUCA);
    const r = (await ev.mini.sequence({ title: R.T('events.star_telescope.r.title', { label: st.label }), symbols: R.T('events.star_telescope.r.symbols'), rounds: st.rounds, tempo: st.tempo, theme: 'night' })) || {};
    if (!RANK_OK[r.rank]) { await ev.say('luca', R.T('events.star_telescope.say_2'), LUCA); return; }
    ev.addVar('star_gaze', 1);
    await ev.say('luca', R.T('events.star_telescope.say_3'), LUCA);
    ev.item(st.reward[0], st.reward[1]);
    if (i + 1 >= GAZE.length) { ev.setFlag('star_stargaze_done'); ev.leadDone('q_star_stargaze'); await ev.say('luca', R.T('events.star_telescope.say_4'), LUCA); }
  }, { meta: { needs: ['flag:star_luca_met'], gives: ['var:star_gaze', 'flag:star_stargaze_done', 'item:u_star_compass'] } });

  // ---------------------------------------------------------------- 学院区の門の番兵（封鎖された塔）・門の命令書
  E('orbis_district_guard', async (ev) => {
    if (cleared(ev)) { await ev.say('district_guard', ev.choiceOf('ch_star_order') === 'public' ? R.T('events.orbis_district_guard.say') : R.T('events.orbis_district_guard.say_2')); return; }
    await ev.say('district_guard', R.T('events.orbis_district_guard.say_3'));
    await ev.say('district_guard', R.T('events.orbis_district_guard.say_4'));
    ev.setFlag('star_gate_seen');
    ev.lead('l_star_tower');
  }, { meta: { needs: [], gives: ['flag:star_gate_seen', 'lead:l_star_tower'] } });
  E('star_gate_notice', async (ev) => {
    await X().narr(ev, cleared(ev) && ev.choiceOf('ch_star_order') === 'public' ? R.T('events.star_gate_notice.narr')
      : R.T('events.star_gate_notice.narr_2'));
    if (!cleared(ev)) { ev.setFlag('star_gate_seen'); ev.lead('l_star_tower'); }
  }, { meta: { needs: [], gives: ['flag:star_gate_seen', 'lead:l_star_tower'] } });
  E('orbis_north_gate', async (ev) => {
    await X().narr(ev, R.T('events.orbis_north_gate.narr'));
  });
  E('orbis_academy_guard', async (ev) => {
    if (ev.flag('star_octavia_done')) { await ev.say('academy_guard', R.T('events.orbis_academy_guard.say')); return; }
    await ev.say('academy_guard', R.T('events.orbis_academy_guard.say_2'));
    if (X().preps(ev) >= 1) await ev.say('academy_guard', R.T('events.orbis_academy_guard.say_3'));
  });
  E('orbis_clerk', async (ev) => {
    await ev.say('clerk', R.T('events.orbis_clerk.say'));
    await ev.say('clerk', R.T('events.orbis_clerk.say_2'));
  });
  E('orbis_lib_clerk', async (ev) => {
    await ev.say('lib_clerk', R.T('events.orbis_lib_clerk.say'));
  });

  // ---------------------------------------------------------------- 図書館の司書（学長の伝言）・学長（昼）・前の学長の辞表
  E('star_librarian', async (ev) => {
    const n = ev.var('star_books');
    if (ev.flag('star_books_on') && !ev.flag('star_books_done')) {
      if (n >= 5) { await ev.call('star_books_return'); return; }
      await ev.say('librarian', R.T('events.star_librarian.say', { p0: 5 - n }));
      return;
    }
    if (!ev.flag('star_message')) {
      ev.setFlag('star_message');
      await ev.say('librarian', R.T('events.star_librarian.say_2'));
      await ev.caption(R.T('events.star_librarian.caption'), { ms: 2800 });
      await ev.say('librarian', R.T('events.star_librarian.say_3'));
      ev.lead('l_star_message');
      ev.lead('l_star_prep');
      return;
    }
    if (!ev.flag('star_books_on') && !ev.flag('star_books_done')) {
      await ev.say('librarian', R.T('events.star_librarian.say_4'));
      const i = await ev.choose(R.T('events.star_librarian.i.choose'), { text: R.T('events.star_librarian.i.choose.text') });
      if (i === 0) { ev.setFlag('star_books_on'); ev.lead('q_star_books'); await ev.say('librarian', R.T('events.star_librarian.say_5')); }
      return;
    }
    await ev.say('librarian', cleared(ev) ? R.T('events.star_librarian.say_6') : R.T('events.star_librarian.say_7'));
  }, { meta: { needs: [], gives: ['flag:star_message', 'lead:l_star_message', 'lead:l_star_prep', 'flag:star_books_on', 'lead:q_star_books'], calls: ['star_books_return'] } });
  E('star_book', async (ev, ctx) => {
    const n = ctx.book || 1;
    if (ev.flag('star_book_' + n)) return;
    if (!ev.flag('star_books_on')) { await X().narr(ev, R.T('events.star_book.narr')); return; }
    ev.setFlag('star_book_' + n);
    const c = ev.addVar('star_books', 1);
    ev.sfx('item');
    await ev.caption(R.T('events.star_book.caption', { c }), { ms: 1600 });
  }, { meta: { needs: ['flag:star_books_on'], gives: ['var:star_books'] } });
  E('star_books_return', async (ev) => {
    if (ev.flag('star_books_done')) return;
    ev.setFlag('star_books_done');
    ev.leadDone('q_star_books');
    await ev.say('librarian', R.T('events.star_books_return.say'));
    ev.item('i_ether2', 2);
    ev.gold(300);
  }, { meta: { needs: ['flag:star_books_on'], gives: ['flag:star_books_done'] } });
  E('star_octavia_day', async (ev) => {
    if (ev.flag('star_night_seen')) { await ev.say('octavia', R.T('events.star_octavia_day.say'), OCTAVIA); return; }
    await ev.say('octavia', R.T('events.star_octavia_day.say_2'), OCTAVIA);
    await X().narr(ev, R.T('events.star_octavia_day.narr'));
    await ev.say('octavia', R.T('events.star_octavia_day.say_3'), OCTAVIA);
  });
  E('star_resignation', async (ev) => {
    await X().narr(ev, R.T('events.star_resignation.narr'));
    await ev.caption(R.T('events.star_resignation.caption'), { ms: 3200 });
    await X().lore(ev, 'lo_war_star');
  }, { meta: { needs: [], gives: ['lore:lo_war_star'] } });
  E('orbis_library_lectern', async (ev) => {
    await X().narr(ev, R.T('events.orbis_library_lectern.narr'));
  });

  // ---------------------------------------------------------------- 学院の試験（伝承の問答）・学生セレス（試験の稽古 → 鍵の一つ目）
  const QUIZ = [
    { q: R.T('ev.star_orbis.QUIZ.0.q'), a: R.T('ev.star_orbis.QUIZ.0.a'), ok: 1 },
    { q: R.T('ev.star_orbis.QUIZ.1.q'), a: R.T('ev.star_orbis.QUIZ.1.a'), ok: 0 },
    { q: R.T('ev.star_orbis.QUIZ.2.q'), a: R.T('ev.star_orbis.QUIZ.2.a'), ok: 2 },
  ];
  async function quiz(ev, who, name) {
    for (const q of QUIZ) {
      const i = await ev.choose(q.a, { text: q.q });
      if (i !== q.ok) { await ev.say(who, R.T('ev.star_orbis.quiz.say'), name ? { name } : undefined); return false; }
    }
    return true;
  }
  E('star_student_exam', async (ev) => {
    const x = X();
    if (ev.flag('star_key_1')) { await ev.say('student_exam', cleared(ev) ? R.T('events.star_student_exam.say') : R.T('events.star_student_exam.say_2')); return; }
    await ev.say('student_exam', R.T('events.star_student_exam.say_3'));
    if (!(await quiz(ev, 'student_exam'))) return;
    await ev.say('student_exam', R.T('events.star_student_exam.say_4'));
    ev.setFlag('star_key_1');
    await ev.call('star_key_check');
  }, { meta: { needs: ['flag:star_message'], gives: ['flag:star_key_1'], calls: ['star_key_check'] } });
  E('star_examiner', async (ev) => {
    if (ev.flag('star_exam_done')) { await ev.say('examiner', R.T('events.star_examiner.say')); return; }
    if (!ev.flag('star_exam_on')) {
      ev.setFlag('star_exam_on');
      ev.lead('q_star_exam');
      await ev.say('examiner', R.T('events.star_examiner.say_2'));
    }
    const i = await ev.choose(R.T('events.star_examiner.i.choose'), { text: R.T('events.star_examiner.i.choose.text') });
    if (i !== 0) return;
    if (!(await quiz(ev, 'examiner'))) return;
    ev.setFlag('star_exam_done');
    ev.leadDone('q_star_exam');
    await ev.say('examiner', R.T('events.star_examiner.say_3'));
    ev.item('u_exam_ribbon', 1);
  }, { meta: { needs: [], gives: ['flag:star_exam_done', 'lead:q_star_exam', 'item:u_exam_ribbon'] } });

  // ---------------------------------------------------------------- 学生ミロ（落とし物の銀の羽ペン → 鍵の二つ目）
  E('star_student_pen', async (ev) => {
    if (ev.flag('star_key_2')) { await ev.say('student_pen', cleared(ev) ? R.T('events.star_student_pen.say') : R.T('events.star_student_pen.say_2')); return; }
    if (ev.has('k_silver_pen')) {
      ev.take('k_silver_pen', 1);
      await ev.say('student_pen', R.T('events.star_student_pen.say_3'));
      await ev.say('student_pen', R.T('events.star_student_pen.say_4'));
      ev.setFlag('star_key_2');
      await ev.call('star_key_check');
      return;
    }
    await ev.say('student_pen', R.T('events.star_student_pen.say_5'));
    ev.setFlag('star_pen_asked');
  }, { meta: { needs: ['flag:star_message'], gives: ['flag:star_pen_asked', 'flag:star_key_2'], calls: ['star_key_check'] } });
  E('star_pen_spot', async (ev) => {
    if (ev.has('k_silver_pen') || ev.flag('star_key_2')) { await X().narr(ev, R.T('events.star_pen_spot.narr')); return; }
    await X().narr(ev, R.T('events.star_pen_spot.narr_2'));
    ev.item('k_silver_pen', 1);
  }, { meta: { needs: ['flag:star_pen_asked'], gives: ['item:k_silver_pen'] } });

  // ---------------------------------------------------------------- 学生ティモ（恋文 → 洗濯場のイーダ → 鍵の三つ目）
  E('star_student_letter', async (ev) => {
    if (ev.flag('star_key_3')) { await ev.say('student_letter', cleared(ev) ? R.T('events.star_student_letter.say') : R.T('events.star_student_letter.say_2')); return; }
    if (ev.flag('star_letter_given')) {
      await ev.say('student_letter', R.T('events.star_student_letter.say_3'));
      await ev.say('student_letter', R.T('events.star_student_letter.say_4'));
      ev.setFlag('star_key_3');
      await ev.call('star_key_check');
      return;
    }
    if (ev.has('k_love_letter')) { await ev.say('student_letter', R.T('events.star_student_letter.say_5')); return; }
    await ev.say('student_letter', R.T('events.star_student_letter.say_6'));
    ev.item('k_love_letter', 1);
  }, { meta: { needs: ['flag:star_message'], gives: ['item:k_love_letter', 'flag:star_key_3'], calls: ['star_key_check'] } });
  E('star_ida', async (ev) => {
    if (ev.has('k_love_letter')) {
      ev.take('k_love_letter', 1);
      ev.setFlag('star_letter_given');
      await X().narr(ev, R.T('events.star_ida.narr'));
      await ev.say('ida', R.T('events.star_ida.say'));
      return;
    }
    await ev.say('ida', cleared(ev) ? R.T('events.star_ida.say_2') : R.T('events.star_ida.say_3'));
  }, { meta: { needs: [], gives: ['flag:star_letter_given'] } });
  // 三つの数がそろった（鍵の組み合わせのメモ）
  E('star_key_check', async (ev) => {
    if (ev.flag('star_prep_key')) return;
    const n = [1, 2, 3].filter((k) => ev.flag('star_key_' + k)).length;
    if (n < 3) { await ev.caption(R.T('events.star_key_check.caption', { n }), { ms: 1800 }); return; }
    ev.setFlag('star_prep_key');
    ev.item('k_vault_code', 1);
    await ev.caption(R.T('events.star_key_check.caption_2'), { ms: 2200 });
    await X().prep(ev);
  }, { meta: { needs: ['flag:star_key_1', 'flag:star_key_2', 'flag:star_key_3'], gives: ['flag:star_prep_key', 'item:k_vault_code', 'flag:star_ready', 'lead:l_star_vault'] } });

  // ---------------------------------------------------------------- 見回りの順番（夜番の年寄りの日誌・守衛室の窓）
  E('star_old_watch', async (ev) => {
    if (cleared(ev)) { await ev.say('old_watch', R.T('events.star_old_watch.say')); return; }
    if (ev.flag('star_prep_route')) { await ev.say('old_watch', R.T('events.star_old_watch.say_2')); return; }
    await ev.say('old_watch', R.T('events.star_old_watch.say_3'));
    const i = await ev.choose(R.T('events.star_old_watch.i.choose'), { text: R.T('events.star_old_watch.i.choose.text') });
    if (i !== 0) return;
    if ((R.Game.gold || 0) < 50) { await X().narr(ev, R.T('events.star_old_watch.narr')); return; }
    ev.gold(-50);
    await ev.say('old_watch', R.T('events.star_old_watch.say_4'));
    await X().narr(ev, R.T('events.star_old_watch.narr_2'));
    ev.item('k_patrol_log', 1);
    ev.setFlag('star_prep_route');
    await ev.caption(R.T('events.star_old_watch.caption'), { ms: 2400 });
    await X().prep(ev);
  }, { meta: { needs: ['flag:star_message'], gives: ['item:k_patrol_log', 'flag:star_prep_route', 'flag:star_ready', 'lead:l_star_vault'] } });
  E('star_guard_window', async (ev) => {
    if (ev.flag('star_prep_route')) { await X().narr(ev, R.T('events.star_guard_window.narr')); return; }
    if (!ev.flag('star_message')) { await X().narr(ev, R.T('events.star_guard_window.narr_2')); return; }
    await X().narr(ev, R.T('events.star_guard_window.narr_3'));
    await X().narr(ev, R.T('events.star_guard_window.narr_4'));
    ev.setFlag('star_prep_route');
    await X().prep(ev);
  }, { meta: { needs: ['flag:star_message'], gives: ['flag:star_prep_route', 'flag:star_ready', 'lead:l_star_vault'] } });
  E('orbis_guard_captain', async (ev) => {
    await ev.say('guard_captain', cleared(ev) ? (X().resigned(ev) ? R.T('events.orbis_guard_captain.say') : R.T('events.orbis_guard_captain.say_2'))
      : R.T('events.orbis_guard_captain.say_3'));
  });

  // ---------------------------------------------------------------- 学院の制服（仕立屋で買う・洗濯場で借りる）
  E('star_tailor', async (ev) => {
    if (ev.flag('star_prep_uniform')) { await ev.say('tailor', ev.flag('star_uniform_bought') ? R.T('events.star_tailor.say') : R.T('events.star_tailor.say_2')); return; }
    await ev.say('tailor', R.T('events.star_tailor.say_3'));
    const i = await ev.choose(R.T('events.star_tailor.i.choose'), { text: R.T('events.star_tailor.i.choose.text') });
    if (i !== 0) return;
    if ((R.Game.gold || 0) < 600) { await ev.say('tailor', R.T('events.star_tailor.say_4')); return; }
    ev.gold(-600);
    ev.item('k_uniform', 1);
    ev.setFlag('star_prep_uniform'); ev.setFlag('star_uniform_bought');
    await ev.say('tailor', R.T('events.star_tailor.say_5'));
    await X().prep(ev);
  }, { meta: { needs: ['flag:star_message'], gives: ['item:k_uniform', 'flag:star_prep_uniform', 'flag:star_ready', 'lead:l_star_vault'] } });
  E('star_laundress', async (ev) => {
    if (ev.flag('star_prep_uniform')) {
      if (ev.flag('star_uniform_borrowed') && ev.flag('star_night_seen') && !ev.flag('star_uniform_back')) {
        ev.setFlag('star_uniform_back');
        await ev.say('laundress', R.T('events.star_laundress.say'));
        return;
      }
      await ev.say('laundress', R.T('events.star_laundress.say_2'));
      return;
    }
    if (!ev.flag('star_message')) { await ev.say('laundress', R.T('events.star_laundress.say_3')); return; }
    await ev.say('laundress', R.T('events.star_laundress.say_4'));
    await ev.say('laundress', R.T('events.star_laundress.say_5'));
    ev.item('k_uniform', 1);
    ev.setFlag('star_prep_uniform'); ev.setFlag('star_uniform_borrowed');
    await X().prep(ev);
  }, { meta: { needs: ['flag:star_message'], gives: ['item:k_uniform', 'flag:star_prep_uniform', 'flag:star_ready', 'lead:l_star_vault'] } });

  // ---------------------------------------------------------------- 【灯りを守る】星灯の見張り（星灯守のじいさん・星灯の塔）
  E('star_lamp_keeper', async (ev) => {
    if (ev.flag('star_lamp_lit')) { await ev.say('lamp_keeper', R.T('events.star_lamp_keeper.say')); return; }
    if (ev.has('k_star_oil')) { await ev.say('lamp_keeper', R.T('events.star_lamp_keeper.say_2')); return; }
    await ev.say('lamp_keeper', R.T('events.star_lamp_keeper.say_3'));
    const i = await ev.choose(R.T('events.star_lamp_keeper.i.choose'), { text: R.T('events.star_lamp_keeper.i.choose.text') });
    if (i !== 0) return;
    ev.item('k_star_oil', 1);
    ev.lead('q_star_lamp');
  }, { meta: { needs: [], gives: ['item:k_star_oil', 'lead:q_star_lamp'] } });
  E('star_lamp_tower', async (ev) => {
    if (ev.flag('star_lamp_lit')) { await X().narr(ev, R.T('events.star_lamp_tower.narr')); return; }
    if (!ev.has('k_star_oil')) { await X().narr(ev, R.T('events.star_lamp_tower.narr_2')); return; }
    ev.take('k_star_oil', 1);
    ev.sfx('light');
    await X().narr(ev, R.T('events.star_lamp_tower.narr_3'));
    ev.setFlag('star_lamp_lit');
    ev.leadDone('q_star_lamp');
    ev.item('i_ether', 2);
  }, { meta: { needs: [], gives: ['flag:star_lamp_lit'] } });

  // ---------------------------------------------------------------- 町の人（日継ぎの主張・戦の傷・近況・うわさ）
  E('orbis_gate_guard', async (ev) => {
    const s = X().skyLine();
    await ev.say('gate_guard', s || (cleared(ev) ? R.T('events.orbis_gate_guard.say') : R.T('events.orbis_gate_guard.say_2')));
  });
  E('orbis_plaza_old', async (ev) => {
    await ev.say('plaza_old', cleared(ev) ? R.T('events.orbis_plaza_old.say')
      : R.T('events.orbis_plaza_old.say_2'));
  });
  E('orbis_plaza_woman', async (ev) => {
    const s = X().skyLine();
    await ev.say('plaza_woman', s || (cleared(ev) ? R.T('events.orbis_plaza_woman.say') : R.T('events.orbis_plaza_woman.say_2')));
  });
  E('orbis_child', async (ev) => {
    await ev.say('child', cleared(ev) ? R.T('events.orbis_child.say') : R.T('events.orbis_child.say_2'));
  });
  E('orbis_researcher', async (ev) => {
    await ev.say('researcher', R.T('events.orbis_researcher.say'));
    ev.lead('l_opt_starfall');
  }, { meta: { needs: [], gives: ['lead:l_opt_starfall'] } });
  E('orbis_traveler', async (ev) => {
    await ev.say('traveler', R.T('events.orbis_traveler.say'));
    ev.lead('l_opt_clockbird');
  }, { meta: { needs: [], gives: ['lead:l_opt_clockbird'] } });
  E('orbis_barkeep', async (ev) => {
    const s = X().skyLine();
    await ev.say('barkeep', s || (cleared(ev) ? R.T('events.orbis_barkeep.say') : R.T('events.orbis_barkeep.say_2')));
  });
  E('orbis_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? R.T('events.orbis_inn_keeper.say') : R.T('events.orbis_inn_keeper.say_2'));
    const i = await ev.choose(R.T('events.orbis_inn_keeper.i.choose'), { text: R.T('events.orbis_inn_keeper.i.choose.text') });
    if (i !== 0) return;
    await ev.inn();
  });
  E('orbis_item_keeper', async (ev) => { await ev.say('item_keeper', R.T('events.orbis_item_keeper.say')); await ev.shop('shop_orbis_items'); });
  E('orbis_smith', async (ev) => { await ev.say('smith', R.T('events.orbis_smith.say')); await ev.shop('shop_orbis_arms'); });
  E('orbis_magic_keeper', async (ev) => {
    await ev.say('magic_keeper', cleared(ev) && ev.choiceOf('ch_star_way') === 'sneak' ? R.T('events.orbis_magic_keeper.say') : R.T('events.orbis_magic_keeper.say_2'));
    await ev.shop('shop_orbis_magic');
  });
  E('orbis_records_clerk', async (ev) => {
    await ev.say('records_clerk', X().tier() >= 4 ? R.T('events.orbis_records_clerk.say') : R.T('events.orbis_records_clerk.say_2'));
  });
  E('orbis_records_board', async (ev) => {
    await X().narr(ev, R.T('events.orbis_records_board.narr'));
  });
  E('orbis_scholar_w', async (ev) => {
    await ev.say('scholar_w', cleared(ev) ? R.T('events.orbis_scholar_w.say') : R.T('events.orbis_scholar_w.say_2'));
  });
  E('orbis_old_scholar', async (ev) => {
    await ev.say('old_scholar', R.T('events.orbis_old_scholar.say'));
  });
  E('orbis_house_mother', async (ev) => {
    const s = X().skyLine();
    await ev.say('house_mother', s || R.T('events.orbis_house_mother.say'));
  });
  E('orbis_house2_old', async (ev) => {
    await ev.say('house2_old', R.T('events.orbis_house2_old.say'));
  });
  E('orbis_house3_kid', async (ev) => {
    await ev.say('house3_kid', cleared(ev) ? R.T('events.orbis_house3_kid.say') : R.T('events.orbis_house3_kid.say_2'));
  });
  E('orbis_fountain', async (ev) => {
    await X().narr(ev, R.T('events.orbis_fountain.narr'));
  });
})(window.RPG);
