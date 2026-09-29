// CONTENT-P: ワールドの出来事（V2_PLAN §3.3 P3・§3.2 の縦切りの閉じ方、WORLD_REDESIGN §1.3・§2.6）
//   world_pen_lamp          半島の消えた道しるべの灯籠（P3 の夜道の 1 つ wl_pen_road と、見晴らし台の古い灯籠 wl_pen_lookout）。
//                           依頼 q_pharos_lamp の火種があればともす（lit の条件 prologue_lamp_road / prologue_lamp_lookout を立てる）
//   world_bridge_guard      跳ね橋の番（序章の間は上がっている。V2_PLAN §3.3 P4）
//   world_traveler_plains / world_woodcutter / world_shepherd   街道の旅人（景色の目印、話す見返り ⑦近況・④ほのめかし）
//   峠の番人（崖崩れ）の台詞は world.js の npcs の talk.lines（gen_world.js が書く）。
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  D.world_pen_lamp = {
    meta: { needs: [], gives: ['flag:prologue_lamp_road', 'flag:prologue_lamp_lookout'] },
    run: async (ev, ctx) => {
      const E = X();
      // どちらの灯籠か: 調べたマスの灯籠の id（WORLD v3: ワールドを広げたので座標では決めない）。見つからなければ前の決め方（論理の座標 y < 88 = 見晴らし台）
      // 調べたマップ（エリア切り替えのフィールドでは ctx.map のエリア。無ければ前のワールド）の灯籠
      const w = R.DB.maps[(ctx && ctx.map) || 'world'] || R.DB.maps.world, lamp = w && ctx && ctx.x != null ? (w.objects || []).find((o) => o.type === 'waylamp' && o.x === ctx.x && o.y === ctx.y && /^wl_pen_/.test(o.id || '')) : null;
      const lookout = lamp ? lamp.id === 'wl_pen_lookout' : !!(ctx && ctx.y != null && ctx.y < 88);
      const flag = lookout ? 'prologue_lamp_lookout' : 'prologue_lamp_road';
      if (ev.flag(flag)) { await E.narr(ev, R.T('ev.world_prologue.world_pen_lamp.run.narr')); return; }
      if (!ev.flag('prologue_lamp_quest')) {
        await E.narr(ev, lookout ? R.T('ev.world_prologue.world_pen_lamp.run.narr_2') : R.T('ev.world_prologue.world_pen_lamp.run.narr_3'));
        await E.narr(ev, R.T('ev.world_prologue.world_pen_lamp.run.narr_4'));
        return;
      }
      await E.narr(ev, R.T('ev.world_prologue.world_pen_lamp.run.narr_5'));
      ev.setFlag(flag);
      try { R.Audio.sfx('lamp'); } catch (e) { /* */ }
      await E.narr(ev, R.T('ev.world_prologue.world_pen_lamp.run.narr_6'));
      if (ev.flag('prologue_lamp_road') && ev.flag('prologue_lamp_lookout')) await E.narr(ev, R.T('ev.world_prologue.world_pen_lamp.run.narr_7'));
    },
  };

  D.world_bridge_guard = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'bridge_guard', E.pick([
        { cond: 'cleared_r_forest', text: R.T('ev.world_prologue.world_bridge_guard.run.pick.0.text') },
        { cond: 'prologue_done', text: R.T('ev.world_prologue.world_bridge_guard.run.pick.1.text') },
        { text: R.T('ev.world_prologue.world_bridge_guard.run.pick.2.text') },
      ]));
    },
  };

  D.world_traveler_plains = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'traveler_plains', E.pick([
        { cond: 'cleared_r_forest', text: R.T('ev.world_prologue.world_traveler_plains.run.pick.0.text') },
        { text: R.T('ev.world_prologue.world_traveler_plains.run.pick.1.text') },
      ]));
    },
  };
  D.world_woodcutter = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'woodcutter_road', E.pick([
        { cond: 'cleared_r_forest', text: R.T('ev.world_prologue.world_woodcutter.run.pick.0.text') },
        { text: R.T('ev.world_prologue.world_woodcutter.run.pick.1.text') },
      ]));
    },
  };
  D.world_shepherd = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'shepherd', E.pick([
        { cond: 'cleared_r_forest', text: R.T('ev.world_prologue.world_shepherd.run.pick.0.text') },
        { text: R.T('ev.world_prologue.world_shepherd.run.pick.1.text') },
      ]));
    },
  };
})(window.RPG);
