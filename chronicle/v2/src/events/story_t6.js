// CONTENT-P: ティアの場面 T6（STORY_BIBLE §4.3 の灯の数 6・§6.2・§6.3・§11.1）
//   story_t6  E17: 6 つ目の地方を解いた後、次に宿に泊まるか町に入ると（宿の前）。
//             フィーネ（v_fine_t6_01 → 声なしの「{hero}。ロアの里へ、帰ってあげて。」→ v_fine_t6_02）→ 足元が半分透ける →
//             ロアの里へ（l_main_roa_t6。ロアでベルナは主人公を忘れている。封書を開ける: story_roa.js）→ 余白の 6 段目。
//   世界の反応: 空は薄紅（R.Sky のティア 6）。子どもが「暁」を口にし、灯札が紙くずになりかける（maps/story_links.js）。
(function (R) {
  'use strict';
  const S = () => R.Story;

  R.def('events', 'story_t6', {
    meta: { needs: ['flag:story_t5'], gives: ['flag:story_t6', 'lead:l_main_roa_t6', 'lead:l_main_margin_6'], calls: [] },
    run: async (ev, ctx) => {
      const St = S();
      if (ev.flag('story_t6') || (R.DB.config && R.DB.config.slice)) return;
      St.begin(6);
      await St.stage(ev, ctx);
      ev.bgm('sorrow');
      await St.narr(ev, ctx && ctx.reason === 'inn' ? R.T('events.story_t6.run.narr') : R.T('events.story_t6.run.narr_2'));
      await St.actor(ev, 'fine', 'fine', { dist: 2, walk: 0, ms: 900, alpha: 0.72 });
      const o = St.who('fine');
      await ev.say('fine', R.T('events.story_t6.run.say'), Object.assign({ voice: 'v_fine_t6_01', face: 'fine:sad' }, o));
      await ev.say('fine', R.T('events.story_t6.run.say_2'), Object.assign({ face: 'fine:sad' }, o));
      await ev.say('fine', R.T('events.story_t6.run.say_3'), Object.assign({ voice: 'v_fine_t6_02', face: 'fine:sad' }, o));
      await ev.caption(R.T('events.story_t6.run.caption'), { ms: 2800 });
      ev.sfx('magic');
      await St.leave(ev, 'fine', { steps: 2, ms: 1100 });
      ev.mapBgm();
      ev.setFlag('story_t6');
      ev.lead('l_main_roa_t6');
      await St.margin(ev, 6);
      St.end();
    },
  });
})(window.RPG);
