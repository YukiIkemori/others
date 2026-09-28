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
      const w = R.DB.maps.world, lamp = w && ctx && ctx.x != null ? (w.objects || []).find((o) => o.type === 'waylamp' && o.x === ctx.x && o.y === ctx.y && /^wl_pen_/.test(o.id || '')) : null;
      const lookout = lamp ? lamp.id === 'wl_pen_lookout' : !!(ctx && ctx.y != null && ctx.y < 88);
      const flag = lookout ? 'prologue_lamp_lookout' : 'prologue_lamp_road';
      if (ev.flag(flag)) { await E.narr(ev, '道しるべの灯籠に、\n火がともっている。\nまわりの闇が、少しやわらいだ。'); return; }
      if (!ev.flag('prologue_lamp_quest')) {
        await E.narr(ev, lookout ? '見晴らし台の古い灯籠は、\n火が消えたままだ。' : '道しるべの灯籠の火が\n消えている。');
        await E.narr(ev, '火種があれば、\nともせそうだ。');
        return;
      }
      await E.narr(ev, '組合の火種を、\n灯籠に移した。');
      ev.setFlag(flag);
      try { R.Audio.sfx('lamp'); } catch (e) { /* */ }
      await E.narr(ev, '灯籠に、火がともった！\nこのあたりには、もう\n魔物が寄りつかないだろう。');
      if (ev.flag('prologue_lamp_road') && ev.flag('prologue_lamp_lookout')) await E.narr(ev, 'タデオに知らせに行こう。');
    },
  };

  D.world_bridge_guard = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'bridge_guard', E.pick([
        { cond: 'cleared_r_forest', text: '西の森の上に、光の柱が\n見えるだろう？\nあれが大灯火ってやつかね。' },
        { cond: 'prologue_done', text: ['跳ね橋は下ろしてある。\n北の野を抜ければ、\n西の森へ続く街道だ。', '東と北の峠は、崖崩れで\n通れないそうだ。気をつけてな。'] },
        { text: ['跳ね橋は、上げたままだ。\n灯台の火が消えてから、\n夜の魔物が橋を渡ってくるんでな。', '灯台に火が戻るまでは、\n下ろせんよ。'] },
      ]));
    },
  };

  D.world_traveler_plains = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'traveler_plains', E.pick([
        { cond: 'cleared_r_forest', text: '森の灯が戻ってから、\n夜道の樹脂の松明が\nよく売れるんだ。' },
        { text: ['よい灯りを。\n東の峠が崖崩れでね、\n山の町へ荷が運べないんだ。', 'しばらくは、ここで\n野宿さ。たき火にあたって\nいくかい？'] },
      ]));
    },
  };
  D.world_woodcutter = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'woodcutter_road', E.pick([
        { cond: 'cleared_r_forest', text: '仲間たちが、みんな\n村へ帰ってきたよ。\n森の道も、もう迷わない。' },
        { text: ['森が道を変えるんで、\n奥へは入れないんだ。', '街道の道しるべの灯籠が\n三つも消えててな。\n夜は、それが怖い。'] },
      ]));
    },
  };
  D.world_shepherd = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'shepherd', E.pick([
        { cond: 'cleared_r_forest', text: '近ごろ、空がほんの少し\n明るくないかい？\n羊たちも落ち着いておる。' },
        { text: ['灯台が戻ってから、\n羊が夜に鳴かなくなった。', 'わしの若いころは……\nはて、昼というのが\nあったような、なかったような。'] },
      ]));
    },
  };
})(window.RPG);
