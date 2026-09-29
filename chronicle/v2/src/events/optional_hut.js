// CONTENT-F: きこりの休み小屋（#1）のイベント（V2_PLAN §3.3 F13、STORY_BIBLE §7.1・§10.2 の 9）
//   hut_bed（無料の寝床 = ev.rest、何度でも）・hut_journal（途切れたきこりの日誌 → l_forest_hut）・
//   hut_notes（記録官の帳面 → 本筋の手がかり l_main_recorder_forest〔CONTENT-P の leads_main.js〕・読み物 lo_ev_forest「写すと忘れる」）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));

  E('hut_arrive', async (ev) => {
    await ev.caption(R.T('events.hut_arrive.caption'), { ms: 2200 });
  });

  E('hut_bed', async (ev) => {
    await ev.say(null, R.T('events.hut_bed.say'));
    const i = await ev.choose(R.T('events.hut_bed.i.choose'), { cancel: 1 });
    if (i !== 0) return;
    // 暗転とジングル（飛ばせるのは 2.5 秒から。明ける前にジングルを閉じて BGM を戻す）は宿と同じ R.Events.night
    await R.Events.night({ onDark: () => ev.rest() });
    await ev.caption(R.T('events.hut_bed.caption'), { ms: 1600 });
  });

  E('hut_journal', async (ev) => {
    await ev.say(null, R.T('events.hut_journal.say'));
    await ev.say(null, R.T('events.hut_journal.say_2'));
    ev.lead('l_forest_hut');
  }, { meta: { needs: [], gives: ['lead:l_forest_hut'] } });

  E('hut_notes', async (ev) => {
    if (ev.flag('lo_ev_forest')) { await ev.say(null, R.T('events.hut_notes.say')); return; }
    await ev.say(null, R.T('events.hut_notes.say_2'));
    ev.lead('l_main_recorder_forest');
    await R.ContentF.forest.lore(ev, 'lo_ev_forest');
  }, { meta: { needs: [], gives: ['lead:l_main_recorder_forest', 'flag:lo_ev_forest'] } });
})(window.RPG);
