// CONTENT-P: ティアの場面 T4（STORY_BIBLE §4.3 の灯の数 4・§5.1 の公の顔・§6.4・§11.2）
//   story_t4  E17: 4 つ目の地方を解いた後、次に宿に泊まるか町を出るとき（布告の広場。ロウェルが出るので町に入ってすぐは起こさない）。
//             記録院の書記がラザロの布告を読み上げ、写しを配る（lo_decree）。束に記録官あての私信の写し（lo_decree_memo）→
//             ロウェル（v_rowell_t4_01 は 1 戦目に勝っていたら、_02・_03）。布告の紙をロウェルだけが読まずに丸める →
//             内海の霧が濃くなる → 余白の 4 段目（戦の傷を 2 つ以上拾っていれば 1 行ふくらむ）。
//   世界の反応（data 駆動。maps/story_links.js）: 旗 story_t4 から、どの町にも白衣の書記が立ち、出張所に布告と私信の写しが貼られる。
//   空は薄紫（R.Sky のティア 4）。ファロスと灯台の岬に内海の霧（map.weather 'mist'、story_t8 まで）。
(function (R) {
  'use strict';
  const S = () => R.Story;

  R.def('events', 'story_t4', {
    meta: { needs: ['flag:story_t3'], gives: ['flag:story_t4', 'lore:lo_decree', 'lore:lo_decree_memo', 'lead:l_main_margin_4'], calls: [] },
    run: async (ev, ctx) => {
      const St = S();
      if (ev.flag('story_t4') || (R.DB.config && R.DB.config.slice)) return;
      St.begin(4);
      await St.stage(ev, ctx);
      const sc = St.who('scribe'), rw = St.who('rowell');
      ev.bgm('tension');
      await St.narr(ev, R.T('events.story_t4.run.narr'));
      await St.actor(ev, 'story_scribe', 'npc_scribe', { dist: 3, walk: 2 });
      await ev.say('story_scribe', R.T('events.story_t4.run.say'), sc);
      await ev.say('story_scribe', R.T('events.story_t4.run.say_2'), sc);
      await ev.say('story_scribe', R.T('events.story_t4.run.say_3'), sc);
      await St.narr(ev, R.T('events.story_t4.run.narr_2'));
      ev.lore('lo_decree');
      await St.narr(ev, R.T('events.story_t4.run.narr_3'));
      ev.lore('lo_decree_memo');
      await St.leave(ev, 'story_scribe', { steps: 4 });
      await St.actor(ev, 'rowell', 'rowell', { dist: 2, walk: 3 });
      if (ev.flag('story_rowell_won1')) await ev.say('rowell', R.T('events.story_t4.run.say_4'), Object.assign({ voice: 'v_rowell_t4_01' }, rw));
      await ev.say('rowell', R.T('events.story_t4.run.say_5'), Object.assign({ voice: 'v_rowell_t4_02' }, rw));
      await ev.say('rowell', R.T('events.story_t4.run.say_6'), Object.assign({ voice: 'v_rowell_t4_03' }, rw, { face: 'rowell:sad' }));
      await St.narr(ev, R.T('events.story_t4.run.narr_4'));
      await St.leave(ev, 'rowell', { steps: 4 });
      ev.mapBgm();
      await ev.caption(R.T('events.story_t4.run.caption'), { ms: 2800 });
      ev.setFlag('story_t4');
      await St.margin(ev, 4);
      St.end();
    },
  });
})(window.RPG);
