// CONTENT（ガルド山地）: 山地のエリア（ガルドの峠道・鉱石の谷・トロッコ線の崖）の調べる物と人（WORLD_REDESIGN §4.6・§2.5・§2.7 #15）。
//   峠道: 石積みの道しるべ・板でふさいだ古い坑道（鍛冶衆の抜け道。鍛冶衆につくか仲裁で開き、ドヴァンの鍛冶場の裏へ出る）。
//   鉱石の谷: ドヴァンの門の番人・選鉱小屋。
//   トロッコ線の崖: 崖の昇降機（動かない）・東の果てのトンネル（高原への古い線。組合につくか仲裁で、トロッコでドヴァンと高原の星見の坂へ行ける）。
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
  // トロッコ線（WORLD_REDESIGN §2.5 の近道: 組合につくか仲裁で ドヴァン ⇔ 高原）。東の果てのトンネルは高原の星見の坂の終点（s_steps の rail）へ抜ける。
  //   高原（r_star）が行けない間（体験版の境、R.DemoGate）は、ドヴァンへ戻るだけ
  const starOpen = () => !!(R.DB.maps.s_steps && (!R.DemoGate || !R.DemoGate.isOpen || R.DemoGate.isOpen('s_steps')));
  async function ride(ev, to, spawn, caption) {
    ev.sfx('earth');
    await ev.fade('out', 500);
    await ev.caption(caption, { ms: 1800 });
    await ev.warp(to, spawn);
    await ev.fade('in', 500);
  }
  E('mine_rail_tunnel', async (ev) => {
    if (!ev.flag('mine_cartline')) {
      await ev.say(null, R.T('events.mine_rail_tunnel.say'));
      await ev.say(null, R.T('events.mine_rail_tunnel.say_2'));
      // (2026-10-03) 開け方の手がかり: 組合が掘り直すのは山の騒ぎ（ドヴァンの寄り合い・七の層）の後。組合につくか仲裁で開く
      await ev.say(null, R.T(cleared(ev) ? 'events.mine_rail_tunnel.say_4' : 'events.mine_rail_tunnel.say_3'));
      return;
    }
    if (!starOpen()) {
      const i = await ev.choose(R.T('events.mine_rail_tunnel.i.choose'), { text: R.T('events.mine_rail_tunnel.i.choose.text') });
      if (i === 0) await ride(ev, 'dovan', 'station', R.T('events.mine_rail_tunnel.caption'));
      return;
    }
    const i = await ev.choose(R.T('events.mine_rail_tunnel.i2.choose'), { text: R.T('events.mine_rail_tunnel.i2.choose.text') });
    if (i === 0) await ride(ev, 's_steps', 'rail', R.T('events.mine_rail_tunnel.caption_2'));
    else if (i === 1) await ride(ev, 'dovan', 'station', R.T('events.mine_rail_tunnel.caption'));
  }, { meta: { needs: [], gives: [], warp: [{ to: 'dovan', spawn: 'station' }, { to: 's_steps', spawn: 'rail' }] } });
  // 高原の側の終点（星見の坂の崖の下。field_star_00_kit.js が置く）
  E('star_rail_stop', async (ev) => {
    if (!ev.flag('mine_cartline')) {
      await ev.say(null, R.T('events.star_rail_stop.say'));
      await ev.say(null, R.T('events.star_rail_stop.say_2'));
      return;
    }
    const i = await ev.choose(R.T('events.star_rail_stop.i.choose'), { text: R.T('events.star_rail_stop.i.choose.text') });
    if (i === 0) await ride(ev, 'dovan', 'station', R.T('events.mine_rail_tunnel.caption'));
    else if (i === 1) await ride(ev, 'g_rail', 'railend', R.T('events.star_rail_stop.caption'));
  }, { meta: { needs: [], gives: [], warp: [{ to: 'dovan', spawn: 'station' }, { to: 'g_rail', spawn: 'railend' }] } });
})(window.RPG);
