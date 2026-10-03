// CONTENT（オルビス高原）: 消灯後の学院への潜入（WORLD_REDESIGN §4.8 の流れ 1〜3・§6.6 の E10、STORY_BIBLE §7.8 の場面 1・3）。
//   学院の大扉（町）: 準備が 2 つ以上 → 「消灯の刻を待って忍びこむ」→ 勝手口から 1 階へ（star_night_seen）。
//   見回りのランタンに入る（systems/field/watch.js）→ star_caught: 「逃げる」= 外へつまみ出される（取った物はそのまま。何度でも）／
//     「押し通る」= 騒ぎを起こす（守衛が呼ぶ夜番の鎧と戦う。勝てばその見張りは倒れたまま。star_riot → 学長が責めを負う）。
//   夜ふかしの学生（制服が無いと悲鳴を上げる）→ 見回りが来る（逃げるだけ）。
//   黒板 3 枚の端の数（鍵の組み合わせを学生から聞けなかったとき）→ 保管庫の文字盤 → 星図・封鎖の命令書（lo_ev_star）・命令書の束の中の手紙（X.lz）→
//   学長室のオクタヴィア: 命令書を「学長に渡して公にする」／「黙って保管庫に戻す」（ch_star_order）。こっそり／騒ぎ（ch_star_way）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Star.ev;
  const cleared = (ev) => ev.flag('cleared_r_star');
  const OCTAVIA = { name: R.T('ev.star_academy.OCTAVIA.name'), title: R.T('ev.star_academy.OCTAVIA.title') };
  const GUARD = { name: R.T('ev.star_academy.GUARD.name') };

  // ---------------------------------------------------------------- 学院の大扉（町。昼は閉じている）
  E('star_academy_door', async (ev) => {
    const x = X();
    if (cleared(ev) || ev.flag('star_octavia_done')) { await x.narr(ev, R.T('events.star_academy_door.narr')); return; }
    if (!ev.flag('star_message')) { await x.narr(ev, R.T('events.star_academy_door.narr_2')); return; }
    const n = x.preps(ev);
    if (n < 2) {
      await x.narr(ev, R.T('events.star_academy_door.narr_3'));
      const miss = [];
      if (!ev.flag('star_prep_key')) miss.push(R.T('events.star_academy_door'));
      if (!ev.flag('star_prep_route')) miss.push(R.T('events.star_academy_door_2'));
      if (!ev.flag('star_prep_uniform')) miss.push(R.T('events.star_academy_door_3'));
      await ev.caption(miss.join('\n'), { ms: 2800 });
      return;
    }
    const i = await ev.choose(R.T('events.star_academy_door.i.choose'), { text: ev.flag('star_night_seen') ? R.T('events.star_academy_door.i.choose.text') : R.T('events.star_academy_door.i.choose.text_2') });
    if (i !== 0) return;
    await ev.fade('out', 700);
    await ev.caption(R.T('events.star_academy_door.caption'), { ms: 2600 });
    ev.setFlag('star_night_seen');
    ev.setFlag('star_ready');
    await ev.warp('star_academy_1', 'service');
  }, { meta: { needs: ['flag:star_ready'], gives: ['flag:star_night_seen'], warp: { to: 'star_academy_1', spawn: 'service' } } });

  E('star_academy_arrive', async (ev) => {
    if (ev.flag('star_academy_seen')) return;
    ev.setFlag('star_academy_seen');
    await ev.caption(R.T('events.star_academy_arrive.caption'), { ms: 2800 });
    await ev.caption(R.T('events.star_academy_arrive.caption_2'), { ms: 3000 });
    if (ev.flag('star_prep_route')) await ev.caption(R.T('events.star_academy_arrive.caption_3'), { ms: 2200 });
  });
  E('star_academy2_arrive', async (ev) => {
    if (ev.flag('star_academy2_seen')) return;
    ev.setFlag('star_academy2_seen');
    await ev.caption(R.T('events.star_academy2_arrive.caption'), { ms: 3000 });
  });

  // ---------------------------------------------------------------- 見つかった（逃げる／押し通る）
  async function thrownOut(ev) {
    await ev.fade('out', 500);
    await ev.caption(R.T('ev.star_academy.thrownOut.caption'), { ms: 2400 });
    ev.addVar('star_caught', 1);
    await ev.warp('orbis', 'academy');
    await X().narr(ev, R.T('ev.star_academy.thrownOut.narr'));
  }
  E('star_caught', async (ev, ctx) => {
    const id = ctx.npc;
    ev.sfx('alert');
    await ev.say(id || null, R.T('events.star_caught.say'), GUARD);
    const i = await ev.choose(R.T('events.star_caught.i.choose'), { text: R.T('events.star_caught.i.choose.text') });
    if (i !== 1) { await thrownOut(ev); return; }
    const n = Math.min(3, ev.var('star_riot_n') + 1);
    await ev.say(id || null, R.T('events.star_caught.say_2'), GUARD);
    const r = await ev.battle(['tr_star_riot_1', 'tr_star_riot_2', 'tr_star_riot_3'][n - 1]);
    if (r !== 'win') return;
    ev.setVar('star_riot_n', n);
    ev.setFlag('star_riot');
    if (id) ev.setFlag('star_down_' + id);
    await X().narr(ev, R.T('events.star_caught.narr'));
  }, { meta: { needs: ['flag:star_night_seen'], gives: ['flag:star_riot'] } });
  E('star_student_shout', async (ev) => {
    if (ev.flag('star_prep_uniform')) {
      await ev.say('night_student', R.T('events.star_student_shout.say'));
      return;
    }
    ev.sfx('alert');
    await ev.say('night_student', R.T('events.star_student_shout.say_2'));
    await X().narr(ev, R.T('events.star_student_shout.narr'));
    await thrownOut(ev);
  }, { meta: { needs: ['flag:star_night_seen'], gives: [] } });

  // ---------------------------------------------------------------- 黒板の数（鍵の組み合わせの代わり）
  E('star_board', async (ev, ctx) => {
    const n = ctx.board || 1;
    const x = X();
    await x.narr(ev, R.T('events.star_board.narr'));
    await ev.caption(R.T('events.star_board.caption', { p0: x.CODE[n - 1], p1: R.T('events.star_board.caption_2')[n - 1] }), { ms: 2000 });
    if (ev.flag('star_board_' + n)) return;
    ev.setFlag('star_board_' + n);
    const c = [1, 2, 3].filter((k) => ev.flag('star_board_' + k)).length;
    if (c >= 3 && !ev.flag('star_code_known')) {
      ev.setFlag('star_code_known');
      await ev.caption(R.T('events.star_board.caption_3'), { ms: 2600 });
    }
  }, { meta: { needs: ['flag:star_night_seen'], gives: ['flag:star_code_known'] } });
  E('star_board_blank', async (ev) => {
    await X().narr(ev, R.T('events.star_board_blank.narr'));
  });
  E('star_great_door', async (ev) => {
    await X().narr(ev, R.T('events.star_great_door.narr'));
  });

  // ---------------------------------------------------------------- 保管庫（文字盤・星図・命令書・手紙）
  E('star_vault_lock', async (ev) => {
    if (ev.flag('star_vault_open')) return;
    if (!ev.flag('star_prep_key') && !ev.flag('star_code_known')) {
      await X().narr(ev, R.T('events.star_vault_lock.narr'));
      await X().narr(ev, R.T('events.star_vault_lock.narr_2'));
      return;
    }
    await X().narr(ev, R.T('events.star_vault_lock.narr_3'));
    ev.sfx('door');
    ev.setFlag('star_vault_open');
    ev.leadDone('l_star_message');
  }, { meta: { needs: ['flag:star_night_seen'], gives: ['flag:star_vault_open'] } });
  E('star_vault_chart', async (ev) => {
    const x = X();
    if (ev.flag('star_chart_got')) { await x.narr(ev, R.T('events.star_vault_chart.narr')); return; }
    await x.narr(ev, R.T('events.star_vault_chart.narr_2'));
    ev.item('k_star_chart', 1);
    ev.setFlag('star_chart_got');
    await x.narr(ev, R.T('events.star_vault_chart.narr_3'));
    ev.item('k_seal_order', 1);
    await ev.caption(R.T('events.star_vault_chart.caption'), { ms: 3200 });
    await x.lore(ev, 'lo_ev_star');
    ev.lead('l_main_recorder_star');
    if (x.tier() >= 4) await x.narr(ev, R.T('events.star_vault_chart.narr_4'));
    ev.leadDone('l_star_vault');
    await x.narr(ev, R.T('events.star_vault_chart.narr_5'));
  }, { meta: { needs: ['flag:star_vault_open'], gives: ['flag:star_chart_got', 'item:k_star_chart', 'item:k_seal_order', 'lore:lo_ev_star', 'lead:l_main_recorder_star'] } });
  E('star_vault_bundle', async (ev) => {
    const x = X();
    if (!ev.flag('star_vault_open')) return;
    if (ev.flag('star_bundle_seen')) { await x.narr(ev, R.T('events.star_vault_bundle.narr')); return; }
    ev.setFlag('star_bundle_seen');
    await x.narr(ev, R.T('events.star_vault_bundle.narr_2'));
    await x.lz(ev);
  }, { meta: { needs: ['flag:star_vault_open'], gives: ['flag:star_bundle_seen'] } });
  E('star_vault_cabinet', async (ev) => {
    await X().narr(ev, R.T('events.star_vault_cabinet.narr'));
  });
  E('star_octavia_desk', async (ev) => {
    await X().narr(ev, R.T('events.star_octavia_desk.narr'));
  });
  E('star_lecture_lectern', async (ev) => {
    await X().narr(ev, cleared(ev) && ev.choiceOf('ch_star_write') === 'pain'
      ? R.T('events.star_lecture_lectern.narr') : R.T('events.star_lecture_lectern.narr_2'));
  });

  // ---------------------------------------------------------------- 学長室のオクタヴィア（命令書の選択）
  E('star_octavia_night', async (ev) => {
    const x = X();
    if (ev.flag('star_octavia_done')) return;
    if (!ev.flag('star_chart_got')) {
      await ev.say('octavia_night', R.T('events.star_octavia_night.say'), OCTAVIA);
      await ev.say('octavia_night', R.T('events.star_octavia_night.say_2'), OCTAVIA);
      return;
    }
    await ev.say('octavia_night', R.T('events.star_octavia_night.say_3'), OCTAVIA);
    if (ev.flag('star_riot')) {
      await ev.say('octavia_night', R.T('events.star_octavia_night.say_4'), OCTAVIA);
    }
    await x.narr(ev, R.T('events.star_octavia_night.narr'));
    await ev.say('octavia_night', R.T('events.star_octavia_night.say_5'), OCTAVIA);
    await ev.say('octavia_night', R.T('events.star_octavia_night.say_6'), OCTAVIA);
    const i = await ev.choose(R.T('events.star_octavia_night.i.choose'), { important: true, text: R.T('events.star_octavia_night.i.choose.text') });
    ev.take('k_seal_order', 1);
    if (i === 0) {
      ev.choice('ch_star_order', 'public');
      await ev.say('octavia_night', R.T('events.star_octavia_night.say_7'), OCTAVIA);
    } else {
      ev.choice('ch_star_order', 'silent');
      await ev.say('octavia_night', R.T('events.star_octavia_night.say_8'), OCTAVIA);
      ev.item('k_star_chart_copy', 1);
      await x.narr(ev, R.T('events.star_octavia_night.narr_2'));
      if (!ev.flag('star_riot')) {
        await ev.say('octavia_night', R.T('events.star_octavia_night.say_9'), OCTAVIA);
        ev.item('u_scholar_robe', 1);
      }
    }
    ev.choice('ch_star_way', ev.flag('star_riot') ? 'riot' : 'sneak');
    ev.setFlag('star_octavia_done');
    ev.lead('l_star_summit');
    await ev.say('octavia_night', R.T('events.star_octavia_night.say_10'), OCTAVIA);
    await ev.fade('out', 600);
    await ev.caption(R.T('events.star_octavia_night.caption'), { ms: 2400 });
    await ev.warp('orbis', 'academy');
  }, { meta: { needs: ['flag:star_chart_got'], gives: ['flag:star_octavia_done', 'choice:ch_star_order', 'choice:ch_star_way', 'lead:l_star_summit', 'item:k_star_chart_copy'], warp: { to: 'orbis', spawn: 'academy' } } });
})(window.RPG);
