// CONTENT-P: ファロス灯台（V2_PLAN §3.3 P8・P9、STORY_BIBLE §9.1 P8・P9・§10.2 の 5）
//   lighthouse_1_door      塔の扉（調べる・押す）: 鍵が無ければ閉じたまま、鍵があれば初めの 1 回だけ開ける場面
//   lighthouse_1_tutorial  P8 入ってすぐ: オットーが見守り、野ネズミ 2 匹と主人公ひとり。必ず閃く。負けてもやり直して続く（canLose）
//   lighthouse_3_fine      P9 灯室の手前で灰色のマントの少女（v_fine_lighthouse_01・02。名はまだ無い）
//   lighthouse_3_boss      P9 ページ食らい → 紙切れから守り歌が戻る（lo_lighthouse_song）→ 灯台に灯がともる（夜の世界で最初の灯り）
//                          → 朝の鐘のファロスへ（pharos_departure）。序章の灯はページも古層も持たない（STORY_BIBLE §9.1）
//   lighthouse_3_lamp      灯室の大きな灯（調べる）
(function (R) {
  'use strict';
  /** 今のマップの BGM（予告の曲 omen・霧の曲の後に戻す） */
  const mapBgm = (ev, o) => { const p = R.Field && R.Field.pos, m = p && R.DB.maps[p.map]; if (m && m.bgm) ev.bgm(m.bgm, o); };
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  // 塔の扉: 鍵が無ければ閉じたまま。灯台の鍵があれば、初めての 1 回だけ鍵を開ける場面（→ prologue_lh_door。扉の物が入口の間への扉に替わる）。
  //   扉を調べたとき（K.exam）と、鍵を持って扉を押したとき（扉の物の unlock。FIELD の move.js）に走る
  D.lighthouse_1_door = {
    meta: { needs: [], gives: ['flag:prologue_lh_door'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_lh_door') || ev.flag('prologue_tutorial')) return;
      if (!ev.flag('prologue_key')) {
        await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_1_door.run.narr'));
        await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_1_door.run.narr_2'));
        return;
      }
      await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_1_door.run.narr_3'));
      ev.sfx('unlock');
      await ev.wait(450);
      ev.setFlag('prologue_lh_door');
      await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_1_door.run.narr_4'));
    },
  };

  // ------------------------------------------------------------ P8 チュートリアルの戦闘（必ず閃く）
  const TUTORIAL = { troop: 'tr_tutorial', members: ['hero'], glimmerForce: 'hero', canLose: true, noEscape: true, noRare: true, noGolden: true };
  D.lighthouse_1_tutorial = {
    meta: { needs: ['flag:prologue_key'], gives: ['flag:prologue_tutorial'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_tutorial') || !ev.flag('prologue_key')) return;
      await ev.say('otto', R.T('ev.prologue_lighthouse.lighthouse_1_tutorial.run.say'), { voice: 'v_otto_tower_01', face: 'otto:surprise' });
      try { R.Field.shake(6, 400); R.Audio.sfx('roar'); } catch (e) { /* */ }
      await E.say(ev, 'otto', R.T('ev.prologue_lighthouse.lighthouse_1_tutorial.run.say_2'), { face: 'otto:neutral' });
      const hero = () => R.Game.chars.hero || {};
      const t0 = (hero().techs || []).length, s0 = (hero().spells || []).length;
      for (let i = 0; i < 10; i++) {
        const r = await ev.battle(TUTORIAL);
        if (r === 'win') break;
        await ev.say('otto', R.T('ev.prologue_lighthouse.lighthouse_1_tutorial.run.say_3'), { voice: 'v_otto_tower_02', face: 'otto:sad' });
        ev.heal();
      }
      const spell = (hero().techs || []).length <= t0 && (hero().spells || []).length > s0;
      await ev.say('otto', spell ? R.T('ev.prologue_lighthouse.lighthouse_1_tutorial.run.say_4') : R.T('ev.prologue_lighthouse.lighthouse_1_tutorial.run.say_5'), { voice: spell ? 'v_otto_tower_04' : 'v_otto_tower_03', face: 'otto:surprise' });
      await ev.say('otto', spell ? R.T('ev.prologue_lighthouse.lighthouse_1_tutorial.run.say_6') : R.T('ev.prologue_lighthouse.lighthouse_1_tutorial.run.say_7'), { face: 'otto:smile' });
      await ev.say('otto', R.T('ev.prologue_lighthouse.lighthouse_1_tutorial.run.say_8'), { voice: 'v_otto_tower_05', face: 'otto:neutral' });
      ev.setFlag('prologue_tutorial');
      // 去り方（持ち主の決まり 2026-09-27: その場でパッと消さない）。入口の扉まで歩き、扉の音を鳴らして外へ出る
      try {
        await ev.npc('otto').move([[15, 20], [17, 20]]);
        ev.sfx('door');
        await ev.leave('otto', { path: [[17, 21]], ms: 520 });   // 戸口へ 1 歩、薄れて外へ（パッと消さない）
        await ev.wait(200);
        await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_1_tutorial.run.narr'));
      } catch (e) { /* */ }
    },
  };

  // ------------------------------------------------------------ P9 灰色のマントの少女
  D.lighthouse_3_fine = {
    meta: { needs: [], gives: ['flag:prologue_fine'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_fine')) return;
      R.Audio.pushBgm('fine_theme');
      try {
        await ev.wait(300);
        await ev.npc('fine').face('s');
        await ev.say('fine', R.T('ev.prologue_lighthouse.lighthouse_3_fine.run.say'), { voice: 'v_fine_lighthouse_01', face: 'fine:neutral' });
        await ev.say('fine', R.T('ev.prologue_lighthouse.lighthouse_3_fine.run.say_2'), { voice: 'v_fine_lighthouse_02', face: 'fine:smile' });
        try { R.Audio.sfx('magic'); R.Field.flash('#e8ecff', 300); } catch (e) { /* */ }
        await ev.npc('fine').hide();
        ev.setFlag('prologue_fine');
        await ev.wait(400);
        await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_3_fine.run.narr'));
      } finally { R.Audio.popBgm(); }
    },
  };

  // ------------------------------------------------------------ P9 ページ食らい → 灯がともる
  D.lighthouse_3_boss = {
    meta: {
      needs: ['flag:prologue_key'],
      gives: ['flag:prologue_boss', 'lore:lo_lighthouse_song', 'flag:prologue_done'],
      warp: { to: 'pharos', spawn: 'inn_front' },
      calls: ['pharos_departure'],
    },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_boss')) return;
      ev.bgm('omen');   // ボスの予告（1 回だけ鳴る）
      await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_3_boss.run.narr'));
      await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_3_boss.run.narr_2'));
      try { R.Field.shake(8, 500); R.Audio.sfx('roar'); } catch (e) { /* */ }
      const r = await ev.battle('tr_b_pageeater', { boss: true });
      mapBgm(ev);   // 予告の曲は鳴り終わっている: マップの曲へ
      if (r !== 'win') return;
      await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_3_boss.run.narr_3'));
      try { R.Audio.sfx('page'); R.Field.flash('#ffffff', 200); } catch (e) { /* */ }
      await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_3_boss.run.narr_4'));
      await ev.caption(R.T('ev.prologue_lighthouse.lighthouse_3_boss.run.caption'), { ms: 4200, voice: 'v_fine_song_02' });   // 守り歌はフィーネの声（声の終わりまで待つ）
      try { R.Audio.sfx('quill'); } catch (e) { /* */ }
      await ev.caption(E.t(R.T('ev.prologue_lighthouse.lighthouse_3_boss.run.caption.t')), { ms: 2600 });
      E.lore(ev, 'lo_lighthouse_song');
      ev.setFlag('prologue_boss');
      ev.bgm('dawn');
      try { R.Audio.sfx('light'); R.Field.flash('#fffbe0', 700); R.Field.shake(4, 600); } catch (e) { /* */ }
      await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_3_boss.run.narr_5'));
      await E.narr(ev, R.T('ev.prologue_lighthouse.lighthouse_3_boss.run.narr_6'));
      await ev.wait(500);
      await ev.fade('out', 800);
      ev.rest();
      await ev.caption(E.t(R.T('ev.prologue_lighthouse.lighthouse_3_boss.run.caption.t_2')), { ms: 2600 });
      await ev.warp('pharos', 'inn_front');
      await ev.call('pharos_departure');
    },
  };

  D.lighthouse_3_lamp = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, ev.flag('prologue_boss') ? R.T('ev.prologue_lighthouse.lighthouse_3_lamp.run.narr') : R.T('ev.prologue_lighthouse.lighthouse_3_lamp.run.narr_2'));
    },
  };
})(window.RPG);
