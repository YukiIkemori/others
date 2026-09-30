// CONTENT（ガルド山地）: 山地のエリア（ガルドの峠道・鉱石の谷・トロッコ線の崖）の調べる物と人（WORLD_REDESIGN §4.6・§2.5・§2.7 #15）。
//   峠道: 石積みの道しるべ・板でふさいだ古い坑道（鍛冶衆の抜け道。鍛冶衆につくか仲裁で開き、ドヴァンの鍛冶場の裏へ出る）。
//   鉱石の谷: ドヴァンの門の番人・選鉱小屋。
//   トロッコ線の崖: 崖の昇降機（動かない）・東の果てのトンネル（高原への古い線。組合につくか仲裁で、トロッコでドヴァンへ戻れる）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const cleared = (ev) => ev.flag('cleared_r_mine');

  E('mine_pass_cairn', async (ev) => {
    await ev.say(null, R.T('events.mine_pass_cairn.say'));
    if (cleared(ev)) await ev.say(null, R.T('events.mine_pass_cairn.say_2'));
  });
  E('mine_pass_tunnel', async (ev) => {
    if (ev.flag('mine_smithpath')) return;
    await ev.say(null, R.T('events.mine_pass_tunnel.say'));
    await ev.say(null, R.T('events.mine_pass_tunnel.say_2'));
  });
  E('mine_gate_guard', async (ev) => {
    if (cleared(ev)) { await ev.say('gate_guard', R.T('events.mine_gate_guard.say')); return; }
    await ev.say('gate_guard', R.T('events.mine_gate_guard.say_2'));
    await ev.say('gate_guard', R.T('events.mine_gate_guard.say_3'));
  });
  E('mine_sorting_shed', async (ev) => {
    await ev.say(null, R.T('events.mine_sorting_shed.say'));
  });
  E('mine_cliff_lift', async (ev) => {
    await ev.say(null, R.T('events.mine_cliff_lift.say'));
  });
  E('mine_rail_tunnel', async (ev) => {
    if (!ev.flag('mine_cartline')) {
      await ev.say(null, R.T('events.mine_rail_tunnel.say'));
      await ev.say(null, R.T('events.mine_rail_tunnel.say_2'));
      return;
    }
    const i = await ev.choose(R.T('events.mine_rail_tunnel.i.choose'), { text: R.T('events.mine_rail_tunnel.i.choose.text') });
    if (i !== 0) return;
    ev.sfx('earth');
    await ev.fade('out', 500);
    await ev.caption(R.T('events.mine_rail_tunnel.caption'), { ms: 1800 });
    await ev.warp('dovan', 'station');
    await ev.fade('in', 500);
  }, { meta: { needs: [], gives: [], warp: { to: 'dovan', spawn: 'station' } } });
})(window.RPG);
