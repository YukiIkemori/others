// CONTENT（ガルド山地）: トロッコ競走（WORLD_REDESIGN §5.10「タイミング: 分かれ道で A を押して線路を選び、カーブの前でブレーキ」・§4.6 小さな依頼 1・§5.1 R.Mini）。
//   ドヴァンのトロッコ乗り場の競走番に話す → 段を選ぶ（初級・中級・上級。下の段を勝つと次の段）→ 線路を下る。
//   区間ごとに R.Mini.timing（1 回ずつ）: 分かれ道 = 近道へ切り替える梃子を引く（当たりは広め）、カーブ = ブレーキ（当たりは狭め、速い）。
//   外すと遠回り・減速で時間が足される。坑夫の古い記録より速ければ勝ち。失敗しても何も失わない。礼は段ごとに 1 回だけ（上級は トロッコ乗りの鈴 u_cart_bell）。
//   旗: mine_race_1..3（勝った段）・mine_race_done（全部）・mine_race_heard（うわさ）。手がかり q_mine_trolley。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  // 区間: j = 分かれ道（梃子）、c = カーブ（ブレーキ）。time = 区間の基本の秒、lose = 外したときに足す秒
  const COURSES = [
    { label: R.T('ev.mine_trolley.COURSES.0.label'), segs: 'jcc', speed: 1500, jz: 0.2, cz: 0.16, base: 30.0, record: 34.5, reward: ['i_potion', 3] },
    { label: R.T('ev.mine_trolley.COURSES.1.label'), segs: 'cjcjc', speed: 1250, jz: 0.17, cz: 0.13, base: 44.0, record: 49.0, reward: ['i_ether', 2] },
    { label: R.T('ev.mine_trolley.COURSES.2.label'), segs: 'jccjcjc', speed: 1050, jz: 0.14, cz: 0.11, base: 57.0, record: 62.5, reward: ['u_cart_bell', 1] },
  ];
  const LOSE = { j: 5.5, c: 4.0 };
  const SEG = {
    j: { title: R.T('ev.mine_trolley.SEG.j.title'), intro: R.T('ev.mine_trolley.SEG.j.intro'), ok: R.T('ev.mine_trolley.SEG.j.ok'), ng: R.T('ev.mine_trolley.SEG.j.ng') },
    c: { title: R.T('ev.mine_trolley.SEG.c.title'), intro: R.T('ev.mine_trolley.SEG.c.intro'), ok: R.T('ev.mine_trolley.SEG.c.ok'), ng: R.T('ev.mine_trolley.SEG.c.ng') },
  };
  const fmt = (t) => (Math.round(t * 10) / 10).toFixed(1);

  E('dovan_race_keeper', async (ev) => {
    if (!ev.flag('mine_race_met')) {
      ev.setFlag('mine_race_met');
      await ev.say('race_keeper', R.T('events.dovan_race_keeper.say'));
      ev.lead('q_mine_trolley');
    }
    const labels = COURSES.map((c, i) => c.label + (ev.flag('mine_race_' + (i + 1)) ? R.T('events.dovan_race_keeper.labels') : ''));
    const i = await ev.choose(labels.concat([R.T('events.dovan_race_keeper.i.choose.0')]), { cancel: COURSES.length, text: R.T('events.dovan_race_keeper.i.choose.text') });
    if (i < 0 || i >= COURSES.length) return;
    if (i > 0 && !ev.flag('mine_race_' + i)) { await ev.say('race_keeper', R.T('events.dovan_race_keeper.say_2')); return; }
    const c = COURSES[i];
    await ev.say('race_keeper', R.T('events.dovan_race_keeper.say_3', { label: c.label, record: fmt(c.record) }));
    ev.sfx('earth');
    await ev.caption(R.T('events.dovan_race_keeper.caption'), { ms: 1600 });
    let time = c.base, miss = 0;
    const n = c.segs.length;
    for (let k = 0; k < n; k++) {
      const kind = c.segs[k], S = SEG[kind];
      await ev.caption(S.intro, { ms: 1100 });
      const z = kind === 'j' ? c.jz : c.cz, mid = 0.5 + (((k * 37 + i * 11) % 5) - 2) * 0.05;
      const r = (await ev.mini.timing({ title: R.T('events.dovan_race_keeper.r.title', { title: S.title, p1: k + 1, n }), tries: 1, speed: kind === 'c' ? c.speed * 0.9 : c.speed, zones: [[mid - z / 2, mid + z / 2]], theme: 'night' })) || { hits: 1 };
      if ((r.hits || 0) >= 1) { await ev.caption(S.ok, { ms: 1000 }); }
      else { miss++; time += LOSE[kind]; ev.sfx('earth'); await ev.caption(S.ng, { ms: 1200 }); }
    }
    await ev.caption(R.T('events.dovan_race_keeper.caption_2', { time: fmt(time) }), { ms: 1800 });
    if (time > c.record) {
      await ev.say('race_keeper', R.T('events.dovan_race_keeper.say_4', { p0: fmt(time - c.record) }));
      return;
    }
    const key = 'mine_race_' + (i + 1);
    if (ev.flag(key)) { await ev.say('race_keeper', miss ? R.T('events.dovan_race_keeper.say_5') : R.T('events.dovan_race_keeper.say_6')); return; }
    ev.setFlag(key);
    await ev.say('race_keeper', R.T('events.dovan_race_keeper.say_7', { label: c.label }));
    ev.item(c.reward[0], c.reward[1]);
    if (i === COURSES.length - 1) {
      ev.setFlag('mine_race_done');
      ev.leadDone('q_mine_trolley');
      await ev.say('race_keeper', R.T('events.dovan_race_keeper.say_8'));
    }
  }, { meta: { needs: [], gives: ['lead:q_mine_trolley', 'flag:mine_race_1', 'flag:mine_race_2', 'flag:mine_race_3', 'flag:mine_race_done', 'item:u_cart_bell'] } });
})(window.RPG);
