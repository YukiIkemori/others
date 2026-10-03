// CONTENT-P: ティアの場面 T5（STORY_BIBLE §4.3 の灯の数 5・§6.3・§6.4・§11.2）
//   story_t5  E17: 5 つ目の地方を解いた後、その町で宿に泊まるか町を出るとき（ロウェルは町の出口で。寄らなければ次の宿か町の出口で追ってくる。戦いの前に手当てと記録）。
//             ロウェル 2 戦目（v_rowell_t5_01 は 1 戦目に勝っていたら、_02・_03、勝ち _04／負け _05。tr_b_rowell2）→
//             ベルナの手紙が二通（同じ文面、同じ日付）→ 二通目の中に封書（k_berna_sealed。表に「ロアに帰ったら開けて」）→ 余白の 5 段目。
//   勝てば傷だらけの手甲（hn_rival_bracer）。旗 story_rowell_duel2・story_rowell_won2。
//   世界の反応（maps/story_links.js）: 町のうわさで、院長の娘の名「ミラ」が初めて出る（l_rumor_mira）。
(function (R) {
  'use strict';
  const S = () => R.Story;

  R.def('events', 'story_t5', {
    meta: { needs: ['flag:story_t4'], gives: ['flag:story_t5', 'flag:story_rowell_duel2', 'flag:story_rowell_won2', 'item:hn_rival_bracer', 'item:k_berna_sealed', 'lead:l_main_margin_5'], calls: [] },
    run: async (ev, ctx) => {
      const St = S();
      if (ev.flag('story_t5') || (R.DB.config && R.DB.config.slice)) return;
      St.begin(5);
      const map = await St.stage(ev, ctx);
      const rw = St.who('rowell');
      ev.bgm('tension');
      if (St.chased(map)) await St.narr(ev, R.T('events.story_t5.run.narr'));
      await St.actor(ev, 'rowell', 'rowell', { dist: 2, walk: 3 });
      if (ev.flag('story_rowell_won1')) await ev.say('rowell', R.T('events.story_t5.run.say'), Object.assign({ voice: 'v_rowell_t5_01' }, rw));
      await ev.say('rowell', R.T('events.story_t5.run.say_2'), Object.assign({ voice: 'v_rowell_t5_02' }, rw, { face: 'rowell:angry' }));
      await ev.say('rowell', R.T('events.story_t5.run.say_3'), Object.assign({ voice: 'v_rowell_t5_03' }, rw, { face: 'rowell:angry' }));
      // 戦いの前の一息（手当てと記録。R.Story.duelPrep）
      await St.duelPrep(ev, ctx);
      const r = await ev.battle({ troop: 'tr_b_rowell2', canLose: true, noEscape: true, bg: St.duelBg(map) });
      ev.setFlag('story_rowell_duel2');
      const won = r === 'win';
      if (won) {
        await ev.say('rowell', R.T('events.story_t5.run.say_4'), Object.assign({ voice: 'v_rowell_t5_04' }, rw, { face: 'rowell:sad' }));
        ev.setFlag('story_rowell_won2');
        await St.narr(ev, R.T('events.story_t5.run.narr_2'));
        if (!ev.has('hn_rival_bracer')) ev.item('hn_rival_bracer', 1);
      } else {
        await ev.say('rowell', R.T('events.story_t5.run.say_5'), Object.assign({ voice: 'v_rowell_t5_05' }, rw, { face: 'rowell:sad' }));
      }
      await St.leave(ev, 'rowell', { steps: 4 });
      ev.heal();
      if (!won) await St.narr(ev, R.T('events.story_t5.run.narr_3'));
      // ベルナの手紙が二通（§6.3）
      ev.bgm('home');
      await St.narr(ev, R.T('events.story_t5.run.narr_4'));
      ev.sfx('page');
      await ev.letter('berna_t5');
      await St.narr(ev, R.T('events.story_t5.run.narr_5'));
      ev.sfx('page');
      await ev.letter('berna_t5_2');
      await St.narr(ev, R.T('events.story_t5.run.narr_6'));
      await St.narr(ev, R.T('events.story_t5.run.narr_7'));
      if (!ev.has('k_berna_sealed') && !ev.flag('lo_berna_confession')) ev.item('k_berna_sealed', 1);
      await St.narr(ev, R.T('events.story_t5.run.narr_8'));
      ev.mapBgm();
      ev.setFlag('story_t5');
      await St.margin(ev, 5);
      St.end();
    },
  });
})(window.RPG);
