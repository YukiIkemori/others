// CONTENT-P: ティアの場面 T1（V2_PLAN §3.3 T1・§2.11 E17、STORY_BIBLE §4.3 の灯の数 1・§6.2・§6.3・§11.1）
//   story_t1  EVENTS が 'inn' と町の 'map:enter' で R.Tier.pending() を見て走らせる（宿の前か広場。走っている場面があれば終わった後）。
//             ベルナの手紙（ボイスなし、R.DB.letters.berna_t1）→ 灰色のマントの少女（v_fine_t1_01・02、名はまだ無い）→
//             手がかり帳の余白に 1 段目（l_main_margin_1。ページの裏の古層の 1 行目）。
//   T2〜T8 は縦切りの外（TODO(CONTENT-P): STORY_BIBLE §4.3・§6・§11 のとおり、全体の制作で story_t2〜t8 を足す）。
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  R.def('letters', 'berna_t1', {
    from: 'ベルナ', title: '師匠からの手紙', face: 'berna:smile',
    text: [
      '第一章、おめでとう。\nあなたの声は、きっと\nあの土地の人たちに届いたよ。',
      'ただね、里の語り石の文字が\nまた一つ消えたの。',
      '急がなくていい。でも、\n立ち止まらないで。',
    ],
  });

  D.story_t1 = {
    once: true,
    meta: { needs: ['cleared:r_forest'], gives: ['flag:story_t1', 'lead:l_main_margin_1'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '{hero}に、師匠ベルナから\n手紙が届いていた。');
      try { R.Audio.sfx('page'); } catch (e) { /* */ }
      await ev.letter('berna_t1');
      R.Audio.pushBgm('fine_theme');
      try {
        await E.narr(ev, '手紙をたたむと、灯りの下に\n灰色のマントの少女が\n立っていた。');
        const o = { name: '灰色のマントの少女' };
        await ev.say('fine', '一つ目……。\nあと、七つね。', Object.assign({ voice: 'v_fine_t1_01', face: 'fine:smile' }, o));
        await ev.say('fine', 'わたし？　ただの、\n通りすがりよ。', Object.assign({ voice: 'v_fine_t1_02', face: 'fine:neutral' }, o));
        try { R.Audio.sfx('magic'); R.Field.flash('#e8ecff', 300); } catch (e) { /* */ }
        await E.narr(ev, '少女の姿は、灯りの中に\n溶けるように消えた。');
      } finally { R.Audio.popBgm(); }
      ev.setFlag('story_t1');
      // 手がかり帳の余白（STORY_BIBLE §4.1-3・§4.3 の灯の数 1）。羽ペンの音とともに書き足される
      try { R.Audio.sfx('quill'); } catch (e) { /* */ }
      ev.lead('l_main_margin_1');
      await E.narr(ev, '手がかり帳の余白に、\nひとりでに一行が書き足された。');
      // TODO(MENUS・EVENTS): 手がかり帳の「余白」のページ（STORY_BIBLE §12.2 の R.DB.margin）ができたら、l_main_margin_1 をそちらへ移す。
    },
  };
})(window.RPG);
