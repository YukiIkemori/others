// CONTENT-P: ティアの場面 T1（V2_PLAN §3.3 T1・§2.11 E17、STORY_BIBLE §4.3 の灯の数 1・§6.2・§6.3・§11.1）
//   story_t1  EVENTS が 'inn' と町の 'map:enter' で R.Tier.pending() を見て走らせる（宿の前か広場。走っている場面があれば終わった後）。
//             ベルナの手紙（ボイスなし、R.DB.letters.berna_t1）→ 灰色のマントの少女（v_fine_t1_01・02、名はまだ無い）→
//             手がかり帳の余白に 1 段目（l_main_margin_1。ページの裏の古層の 1 行目）。
//             体験版（DB.config.slice）では続けて「体験版の終わり」（demo_end.js の R.Demo.end。フラグ world_demo_end）。
//   T2〜T8 は縦切りの外（TODO(CONTENT-P): STORY_BIBLE §4.3・§6・§11 のとおり、全体の制作で story_t2〜t8 を足す）。
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  R.def('letters', 'berna_t1', {
    from: R.T('letters.berna_t1.from'), title: R.T('letters.berna_t1.title'), face: 'berna:smile',
    text: R.T('letters.berna_t1.text'),
  });

  // 体験版の終わり（DB.config.slice の間だけ。T1 の場面の後に 1 回）: 前置き・お礼・記録の案内・引き継ぎの記録・終わりの画面 → タイトル。
  //   中身は demo_end.js（R.Demo.end）。峠の番人（cond {slice:true}）と境の通せんぼ（data/demo_gate.js）はそのまま
  async function demoEnd(ev) {
    if (R.Demo && R.Demo.end) await R.Demo.end(ev);
  }

  D.story_t1 = {
    once: true,
    meta: { needs: ['cleared:r_forest'], gives: ['flag:story_t1', 'lead:l_main_margin_1', 'flag:world_demo_end'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, R.T('ev.story_t1.run.narr'));
      try { R.Audio.sfx('page'); } catch (e) { /* */ }
      await ev.letter('berna_t1');
      R.Audio.pushBgm('fine_theme');
      try {
        await E.narr(ev, R.T('ev.story_t1.run.narr_2'));
        const o = { name: R.T('ev.story_t1.run.o.name') };
        await ev.say('fine', R.T('ev.story_t1.run.say'), Object.assign({ voice: 'v_fine_t1_01', face: 'fine:smile' }, o));
        await ev.say('fine', R.T('ev.story_t1.run.say_2'), Object.assign({ voice: 'v_fine_t1_02', face: 'fine:neutral' }, o));
        try { R.Audio.sfx('magic'); R.Field.flash('#e8ecff', 300); } catch (e) { /* */ }
        await E.narr(ev, R.T('ev.story_t1.run.narr_3'));
      } finally { R.Audio.popBgm(); }
      ev.setFlag('story_t1');
      // 手がかり帳の余白（STORY_BIBLE §4.1-3・§4.3 の灯の数 1）。羽ペンの音とともに書き足される
      try { R.Audio.sfx('quill'); } catch (e) { /* */ }
      ev.lead('l_main_margin_1');
      await E.narr(ev, R.T('ev.story_t1.run.narr_4'));
      await demoEnd(ev);
      // TODO(MENUS・EVENTS): 手がかり帳の「余白」のページ（STORY_BIBLE §12.2 の R.DB.margin）ができたら、l_main_margin_1 をそちらへ移す。
    },
  };
})(window.RPG);
