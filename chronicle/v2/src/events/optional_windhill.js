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
      if (ev.flag('prologue_windhill')) { await E.narr(ev, '風が、歌のように鳴っている。'); return; }
      await ev.caption('……風が、歌のように鳴っている。', { ms: 2600 });
      await E.narr(ev, '岩のくぼみに、古い書き付けが\nはさまっている。');
      await E.narr(ev, '「風の丘で、灰色のマントの\n人を見た。風は、昔の歌を\n覚えているのだという。\n――ロアの語り部」');
      R.Audio.pushBgm('fine_theme');
      try {
        await E.narr(ev, '丘の上に、灰色のマントの人影が\n見えた気がした。');
        await ev.say('fine', '……風も、歌を覚えているのね。', { voice: 'v_fine_windhill_01', name: '灰色のマントの少女', face: 'fine:smile' });
        await E.narr(ev, '振り向くと、だれもいなかった。\n岩のくぼみに、小さな鈴が\n残されている。');
      } finally { R.Audio.popBgm(); }
      await E.give(ev, 'u_windchime', 1, { say: true });
      ev.setFlag('prologue_windhill');
      if (R.Game.leads && R.Game.leads.l_opt_windhill) ev.leadDone('l_opt_windhill');
    },
  };
})(window.RPG);
