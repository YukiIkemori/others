// CONTENT-P: ティアの場面 T7（STORY_BIBLE §4.3 の灯の数 7・§6.4・§10.2 の 44・§11.2）
//   story_t7  E17: 7 つ目の地方を解いた後、次に宿に泊まるか町に入ると（宿の前。傷を負って倒れこむ）。
//             ロウェルが白の書の秘密を明かす（v_rowell_t7_01、_02 は 2 戦目に勝っていたら、_03〜_07）。
//             _05 のあと手帳の表紙の裏（lo_rowell_cover「母 リ……」）、_06 で封印の扉の言葉の手帳（k_rowell_note）→
//             ロウェルは記録院を抜け、ロアの里に身を寄せる（ベルナは何も知らないまま客として泊める。maps/story_links.js の roa の人）→
//             余白の 7 段目（T6 の封書を読んでいれば「ロウェルの母は、ベルナの弟子リオナかもしれない」）。
(function (R) {
  'use strict';
  const S = () => R.Story;

  R.def('events', 'story_t7', {
    meta: { needs: ['flag:story_t6'], gives: ['flag:story_t7', 'flag:story_rowell_defect', 'item:k_rowell_note', 'lore:lo_rowell_cover', 'lead:l_main_margin_7'], calls: [] },
    run: async (ev, ctx) => {
      const St = S();
      if (ev.flag('story_t7') || (R.DB.config && R.DB.config.slice)) return;
      St.begin(7);
      await St.stage(ev, ctx);
      const rw = St.who('rowell');
      ev.bgm('tension');
      await St.narr(ev, ctx && ctx.reason === 'inn' ? R.T('events.story_t7.run.narr') : R.T('events.story_t7.run.narr_2'));
      await St.actor(ev, 'rowell', 'rowell', { dist: 1, walk: 3, speed: 0.7 });
      await ev.say('rowell', R.T('events.story_t7.run.say'), Object.assign({ voice: 'v_rowell_t7_01' }, rw, { face: 'rowell:sad' }));
      await St.narr(ev, R.T('events.story_t7.run.narr_3'));
      if (ev.flag('story_rowell_won2')) await ev.say('rowell', R.T('events.story_t7.run.say_2'), Object.assign({ voice: 'v_rowell_t7_02' }, rw));
      await ev.say('rowell', R.T('events.story_t7.run.say_3'), Object.assign({ voice: 'v_rowell_t7_03' }, rw));
      await ev.say('rowell', R.T('events.story_t7.run.say_4'), Object.assign({ voice: 'v_rowell_t7_04' }, rw, { face: 'rowell:angry' }));
      await ev.say('rowell', R.T('events.story_t7.run.say_5'), Object.assign({ voice: 'v_rowell_t7_05' }, rw, { face: 'rowell:sad' }));
      await St.narr(ev, R.T('events.story_t7.run.narr_4'));
      ev.lore('lo_rowell_cover');
      await ev.say('rowell', R.T('events.story_t7.run.say_6'), Object.assign({ voice: 'v_rowell_t7_06' }, rw));
      if (!ev.has('k_rowell_note')) ev.item('k_rowell_note', 1);
      ev.setFlag('story_rowell_defect');
      await ev.say('rowell', R.T('events.story_t7.run.say_7'), Object.assign({ voice: 'v_rowell_t7_07' }, rw));
      await St.narr(ev, R.T('events.story_t7.run.narr_5'));
      await St.leave(ev, 'rowell', { steps: 4, ms: 1400 });
      ev.mapBgm();
      ev.setFlag('story_t7');
      await St.margin(ev, 7);
      St.end();
    },
  });
})(window.RPG);
