// CONTENT-P: ティアの場面 T1（V2_PLAN §3.3 T1・§2.11 E17、STORY_BIBLE §4.3 の灯の数 1・§6.2・§6.3・§11.1）
//   story_t1  EVENTS が 'inn' と町の 'map:enter' で R.Tier.pending() を見て走らせる（宿の前か広場。走っている場面があれば終わった後）。
//             ベルナの手紙（ボイスなし、R.DB.letters.berna_t1）→ 灰色のマントの少女（v_fine_t1_01・02、名はまだ無い）→
//             手がかり帳の余白に 1 段目（l_main_margin_1。ページの裏の古層の 1 行目）。
//             体験版（DB.config.slice）では続けて「体験版の終わり」（お礼・この後も歩けること・記録の案内。フラグ demo_end）。
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

  // 体験版の終わり（DB.config.slice の間だけ。T1 の場面の後に 1 回）: 遊んでくれた人へのお礼・この後も歩けること・峠の先は製品版・記録の案内。
  //   V2_PLAN §3.1 の 10「以後も森と半島を歩き回れる」。峠の番人（cond {slice:true}）はそのまま立つ
  async function demoEnd(ev) {
    if (!(R.DB.config && R.DB.config.slice) || ev.flag('demo_end')) return;
    const E = X();
    ev.setFlag('demo_end');
    await ev.caption('体験版は、ここまでです。\n遊んでくださって、\nありがとうございました。');
    await E.narr(ev, 'ヴェルダの森とファロス半島は、\nこのまま歩き回れます。');
    await E.narr(ev, '依頼や寄り道、図鑑の続きを\nどうぞ楽しんでください。');
    await E.narr(ev, '峠の先の地方の物語は、\n製品版で語られます。');
    const i = await ev.choose(['記録する', 'あとで'], { text: 'ここまでの冒険を、\n記録しますか？', cancel: 1 });
    if (i === 0) { try { await R.Screens.open('save', {}); } catch (e) { /* */ } }
  }

  D.story_t1 = {
    once: true,
    meta: { needs: ['cleared:r_forest'], gives: ['flag:story_t1', 'lead:l_main_margin_1', 'flag:demo_end'] },
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
      await demoEnd(ev);
      // TODO(MENUS・EVENTS): 手がかり帳の「余白」のページ（STORY_BIBLE §12.2 の R.DB.margin）ができたら、l_main_margin_1 をそちらへ移す。
    },
  };
})(window.RPG);
