// CONTENT-P: ティアの場面 T2（STORY_BIBLE §4.3 の灯の数 2・§6.4・§11.2）
//   story_t2  E17（R.Tier の遅らせ）: 2 つ目の地方を解いた後、その町で宿に泊まるか町を出るとき（ctx.reason 'inn'|'leave'）。
//             町に寄らずに地方を離れたときは、次に入る町の入口で（'enter'。追ってきた形。台詞は同じ）。
//             ロウェル 1 戦目（v_rowell_t2_01〜07、tr_b_rowell1。負けても続く）→ 空の群青 → 余白の 2 段目（l_main_margin_2）。
//   勝てば銀の筆（ac_rival_pen）。旗 story_rowell_duel1・story_rowell_won1。
(function (R) {
  'use strict';
  const S = () => R.Story;

  R.def('events', 'story_t2', {
    meta: { needs: ['flag:story_t1'], gives: ['flag:story_t2', 'flag:story_rowell_duel1', 'flag:story_rowell_won1', 'item:ac_rival_pen', 'lead:l_main_margin_2'], calls: [] },
    run: async (ev, ctx) => {
      const St = S();
      if (ev.flag('story_t2') || (R.DB.config && R.DB.config.slice)) return;
      St.begin(2);
      const map = await St.stage(ev, ctx);
      const rw = St.who('rowell');
      ev.bgm('tension');
      if (St.chased(map)) await St.narr(ev, R.T('events.story_t2.run.narr'));
      await St.actor(ev, 'rowell', 'rowell', { dist: 2, walk: 3 });
      await ev.say('rowell', R.T('events.story_t2.run.say'), Object.assign({ voice: 'v_rowell_t2_01' }, rw));
      await ev.say('rowell', R.T('events.story_t2.run.say_2'), Object.assign({ voice: 'v_rowell_t2_02' }, rw, { face: 'rowell:angry' }));
      await St.narr(ev, R.T('events.story_t2.run.narr_2'));
      await ev.say('rowell', R.T('events.story_t2.run.say_3'), Object.assign({ voice: 'v_rowell_t2_03' }, rw, { face: 'rowell:angry' }));
      const r = await ev.battle({ troop: 'tr_b_rowell1', canLose: true, noEscape: true });
      ev.setFlag('story_rowell_duel1');
      const won = r === 'win';
      if (won) {
        await ev.say('rowell', R.T('events.story_t2.run.say_4'), Object.assign({ voice: 'v_rowell_t2_04' }, rw, { face: 'rowell:surprise' }));
        await ev.say('rowell', R.T('events.story_t2.run.say_5'), Object.assign({ voice: 'v_rowell_t2_05' }, rw));
        ev.setFlag('story_rowell_won1');
        await St.narr(ev, R.T('events.story_t2.run.narr_3'));
        if (!ev.has('ac_rival_pen')) ev.item('ac_rival_pen', 1);
        await ev.say('rowell', R.T('events.story_t2.run.say_6'), Object.assign({ voice: 'v_rowell_t2_06' }, rw));
      } else {
        await ev.say('rowell', R.T('events.story_t2.run.say_7'), Object.assign({ voice: 'v_rowell_t2_07' }, rw));
      }
      await St.leave(ev, 'rowell', { steps: 4 });
      ev.heal();
      if (!won) await St.narr(ev, R.T('events.story_t2.run.narr_4'));
      ev.mapBgm();
      // 世界の反応（§4.3: 空が群青に。空の段は R.Sky がティアで引き直している）
      await St.narr(ev, R.T('events.story_t2.run.narr_5'));
      ev.setFlag('story_t2');
      await St.margin(ev, 2);
      St.end();
    },
  });
})(window.RPG);
