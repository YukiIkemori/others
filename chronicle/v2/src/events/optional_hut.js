// CONTENT-F: きこりの休み小屋（#1）のイベント（V2_PLAN §3.3 F13、STORY_BIBLE §7.1・§10.2 の 9）
//   hut_bed（無料の寝床 = ev.rest、何度でも）・hut_journal（途切れたきこりの日誌 → l_forest_hut）・
//   hut_notes（記録官の帳面 → 本筋の手がかり l_main_recorder_forest〔CONTENT-P の leads_main.js〕・読み物 lo_ev_forest「写すと忘れる」）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));

  E('hut_arrive', async (ev) => {
    await ev.caption('きこりたちの休み小屋だ。\nかまどの灰が、まだ\nほんのり温かい。', { ms: 2200 });
  });

  E('hut_bed', async (ev) => {
    await ev.say(null, '干し草を詰めた寝床だ。\n少し、休んでいこうか。');
    const i = await ev.choose(['休む', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    // 暗転とジングル（飛ばせるのは 2.5 秒から。明ける前にジングルを閉じて BGM を戻す）は宿と同じ R.Events.night
    await R.Events.night({ onDark: () => ev.rest() });
    await ev.caption('ぐっすり眠って、\nすっかり元気になった。', { ms: 1600 });
  });

  E('hut_journal', async (ev) => {
    await ev.say(null, ['卓の上に、きこりの日誌が\n開いたまま置いてある。', '「三日目。森の道が、また変わった。\nハンスは歌が聞こえると言う。\nおれには何も聞こえない。」', '「記録院の男が、森の奥の\n空き小屋へ入っていった。\n何を書きに来たのか。」']);
    await ev.say(null, '日誌は、そこで途切れている。');
    ev.lead('l_forest_hut');
  }, { meta: { needs: [], gives: ['lead:l_forest_hut'] } });

  E('hut_notes', async (ev) => {
    if (ev.flag('lo_ev_forest')) { await ev.say(null, '棚の奥の帳面。\n「写したあと、村の子が\n歌えなくなった。」'); return; }
    await ev.say(null, ['棚の奥に、革の帳面が\n押しこまれている。\n記録院の印がある。', '「森の歌の石の歌を写した。\n写したあと、村の子が\n歌えなくなった。」', '「報告すべきか。\n……写すと、忘れるのか？」']);
    ev.lead('l_main_recorder_forest');
    await R.ContentF.forest.lore(ev, 'lo_ev_forest');
  }, { meta: { needs: [], gives: ['lead:l_main_recorder_forest', 'flag:lo_ev_forest'] } });
})(window.RPG);
