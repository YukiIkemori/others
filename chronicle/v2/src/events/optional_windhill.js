// CONTENT-P: 風鳴りの丘（寄り道 #2。ワールドの出来事、マップなし。V2_PLAN §3.2「あとで」、WORLD_REDESIGN §2.7-2）
//   windhill_notes  丘の上の岩: 語り部の書き付け、灰色のマントの少女の一言（ボイスなし）、風の鈴 u_windchime（1 回）。
//   縦切りに入れるかは P2 の関門でリードが決める（V2_PLAN §3.2）。入れないときは world.js の examine を外し、看板だけにする。
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  D.windhill_notes = {
    meta: { needs: ['flag:prologue_done'], gives: ['item:u_windchime', 'flag:prologue_windhill'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_windhill')) { await E.narr(ev, R.T('ev.optional_windhill.windhill_notes.run.narr')); return; }
      await ev.caption(R.T('ev.optional_windhill.windhill_notes.run.caption'), { ms: 2600 });
      await E.narr(ev, R.T('ev.optional_windhill.windhill_notes.run.narr_2'));
      await E.narr(ev, R.T('ev.optional_windhill.windhill_notes.run.narr_3'));
      R.Audio.pushBgm('fine_theme');
      try {
        await E.narr(ev, R.T('ev.optional_windhill.windhill_notes.run.narr_4'));
        await ev.say('fine', R.T('ev.optional_windhill.windhill_notes.run.say'), { voice: 'v_fine_windhill_01', name: R.T('ev.optional_windhill.windhill_notes.run.say.name'), face: 'fine:smile' });
        await E.narr(ev, R.T('ev.optional_windhill.windhill_notes.run.narr_5'));
      } finally { R.Audio.popBgm(); }
      await E.give(ev, 'u_windchime', 1, { say: true });
      ev.setFlag('prologue_windhill');
      if (R.Game.leads && R.Game.leads.l_opt_windhill) ev.leadDone('l_opt_windhill');
    },
  };
})(window.RPG);
