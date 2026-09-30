// CONTENT-P: ティアの場面 T3（STORY_BIBLE §4.3 の灯の数 3・§6.2・§6.3・§11.1）
//   story_t3  E17: 3 つ目の地方を解いた後、次に宿に泊まるか町に入ると（宿の前・広場）。
//             ベルナの手紙（字が乱れる・物忘れ。letters.berna_t3）→ 灰色のマントの少女が名乗る（v_fine_t3_01・02）→
//             指先が透ける → ロアへの寄り道の手がかり（l_main_roa_t3。ロアでベルナが旅の話をせがむ: story_roa.js）→ 余白の 3 段目。
(function (R) {
  'use strict';
  const S = () => R.Story;

  R.def('events', 'story_t3', {
    meta: { needs: ['flag:story_t2'], gives: ['flag:story_t3', 'lead:l_main_roa_t3', 'lead:l_main_margin_3'], calls: [] },
    run: async (ev, ctx) => {
      const St = S();
      if (ev.flag('story_t3') || (R.DB.config && R.DB.config.slice)) return;
      St.begin(3);
      await St.stage(ev, ctx);
      ev.bgm('home');
      await St.narr(ev, R.T('events.story_t3.run.narr'));
      ev.sfx('page');
      await ev.letter('berna_t3');
      await St.narr(ev, R.T('events.story_t3.run.narr_2'));
      R.Audio.pushBgm('fine_theme');
      try {
        await St.narr(ev, ctx && ctx.reason === 'inn' ? R.T('events.story_t3.run.narr_3') : R.T('events.story_t3.run.narr_4'));
        await St.actor(ev, 'fine', 'fine', { dist: 2, walk: 0, ms: 700 });
        const o = { name: R.T('events.story_t3.run.o.name') };
        await ev.say('fine', R.T('events.story_t3.run.say'), Object.assign({ voice: 'v_fine_t3_01', face: 'fine:smile' }, o));
        await ev.say('fine', R.T('events.story_t3.run.say_2'), Object.assign({ voice: 'v_fine_t3_02', face: 'fine:neutral' }, o));
        ev.setFlag('story_t3');   // ここからフィーネの名で呼ぶ（R.Story.who）
        ev.sfx('magic');
        await ev.caption(R.T('events.story_t3.run.caption'), { ms: 2600 });
        await St.leave(ev, 'fine', { steps: 2, ms: 900 });
      } finally { R.Audio.popBgm(); }
      ev.mapBgm();
      ev.lead('l_main_roa_t3');
      await St.margin(ev, 3);
      St.end();
    },
  });
})(window.RPG);
