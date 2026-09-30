// CONTENT（終盤）: 白の大書庫 1〜6 階（STORY_BIBLE §9.3 の 3・§5.1・§5.2・§11.1〜§11.5）
//   archive_1_enter     はじめて入ったとき: 題のない白い本の背・遠いフィーネの声（声なし）
//   archive_east_letter 1 階の読書机の東の大陸の封書（lo_east_letter。開けられない）
//   archive_oblivion    1 階の東の小部屋の白い手すりの向こうの階段（クリア後の忘却の底の口。まだ白い霧で下りられない）
//   archive_2_boss      2 階: 本の巨人（tr_b_bookgolem）→ final_golem
//   archive_3_rowell    3 階: 封印の扉の前でロウェル（v_rowell_seal_01〜04）→ 扉が開き、書記たちを引き受ける → final_rowell
//   archive_tale        3 階の 8 つの書見台: 語り直した伝承の章の題と、選んだ版の一文（こだま）
//   archive_4_boss      4 階: 王の声（v_king_shades_01）→ 伝説の三つの影（tr_b_heroshades）→ フィーネ（v_fine_shades_01・02）→ lo_three_shades
//   archive_5_lazaro    5 階: ラザロ（v_lazaro_archive_01〜05）→〔痛み 6 以上: 声なしの段・戦闘の最初の手番でためらう〕→ _06 → tr_b_lazaro →
//                       _07 → 王（v_king_archive_01）がラザロを連れ去る → 階段の白い紙がほどける（final_lazaro）
//   archive_6_boss      6 階: 虚ろの王（v_king_altar_01）→ 第 1 形態 tr_b_nemrea1 →（_02 ／ やり直しは _03）→ 名づけ（v_king_naming_01・v_fine_naming_01）→
//                       第 2 形態 tr_b_nemrea2 → エンディング（final_ending）。第 2 形態で全滅したら final_nemrea1 のまま、次は名づけから（短く）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Final.ev;
  const clear = (ev) => ev.flag('final_clear');
  const KING = { name: R.T('ev.final_archive.KING.name'), face: false };

  // ================================================================ 1 階
  E('archive_1_enter', async (ev) => {
    const x = X();
    ev.setFlag('final_archive_seen');
    if (ev.flag('archive_1_enter')) return;
    ev.setFlag('archive_1_enter');
    await ev.caption(R.T('events.archive_1_enter.caption'), { ms: 2400 });
    await x.narr(ev, R.T('events.archive_1_enter.narr'));
    ev.sfx('magic');
    await x.narr(ev, R.T('events.archive_1_enter.narr_2'));
    await ev.say('fine', R.T('events.archive_1_enter.say'), { face: false, name: R.T('events.archive_1_enter.say.name') });
  }, { meta: { needs: [], gives: ['flag:final_archive_seen', 'flag:archive_1_enter'] } });
  E('archive_east_letter', async (ev) => {
    const x = X();
    await x.narr(ev, R.T('events.archive_east_letter.narr'));
    await x.narr(ev, R.T('events.archive_east_letter.narr_2'));
    x.lore(ev, 'lo_east_letter');
  }, { meta: { needs: [], gives: ['lore:lo_east_letter'] } });
  E('archive_oblivion', async (ev) => {
    const x = X();
    if (!clear(ev)) {
      await x.narr(ev, R.T('events.archive_oblivion.narr'));
      return;
    }
    await x.narr(ev, R.T('events.archive_oblivion.narr_2'));
    await x.narr(ev, R.T('events.archive_oblivion.narr_3'));
    await x.narr(ev, R.T('events.archive_oblivion.narr_4'));
    ev.lead('l_post_oblivion');
  }, { meta: { needs: [], gives: ['lead:l_post_oblivion'] } });

  // ================================================================ 2 階 本の巨人
  E('archive_2_boss', async (ev) => {
    const x = X();
    if (ev.flag('final_golem')) return;
    ev.bgm('omen');
    await x.narr(ev, R.T('events.archive_2_boss.narr'));
    ev.sfx('roar');
    x.shake(4, 700);
    await x.narr(ev, R.T('events.archive_2_boss.narr_2'));
    const r = await ev.battle('tr_b_bookgolem', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('final_golem');
    ev.sfx('page');
    x.flash('#ffffff', 300);
    await x.narr(ev, R.T('events.archive_2_boss.narr_3'));
    ev.mapBgm();
  }, { meta: { needs: [], gives: ['flag:final_golem'] } });
  E('archive_copy_desk', async (ev) => {
    await X().narr(ev, clear(ev) ? R.T('events.archive_copy_desk.narr') : R.T('events.archive_copy_desk.narr_2'));
  });

  // ================================================================ 3 階 封印の扉とロウェル
  E('archive_3_door', async (ev) => {
    const x = X();
    if (ev.flag('final_rowell')) return;
    await x.narr(ev, R.T('events.archive_3_door.narr'));
    await x.narr(ev, R.T('events.archive_3_door.narr_2'));
  });
  E('archive_3_rowell', async (ev) => {
    const x = X();
    if (ev.flag('final_rowell')) return;
    await x.preload(['v_rowell_seal_01', 'v_rowell_seal_02', 'v_rowell_seal_03', 'v_rowell_seal_04']);
    await x.narr(ev, R.T('events.archive_3_rowell.narr'));
    ev.setFlag('final_seal_scene');
    try { await ev.appear('seal_rowell', { from: [21, 9], ms: 700 }); } catch (e) { /* */ }
    await ev.say('seal_rowell', R.T('events.archive_3_rowell.say'), { voice: 'v_rowell_seal_01', face: 'rowell:neutral' });
    await x.narr(ev, R.T('events.archive_3_rowell.narr_2'));
    await ev.say('seal_rowell', R.T('events.archive_3_rowell.say_2'), { voice: 'v_rowell_seal_02', face: 'rowell:neutral' });
    ev.sfx('door');
    x.flash('#ffffff', 300);
    ev.setFlag('final_rowell');
    await x.breath(ev, 500);
    try { await ev.appear(['seal_scribe_a', 'seal_scribe_b', 'seal_scribe_c'], { ms: 600 }); } catch (e) { /* */ }
    await ev.say('seal_rowell', R.T('events.archive_3_rowell.say_3'), { voice: 'v_rowell_seal_03', face: 'rowell:angry' });
    await ev.say('seal_rowell', R.T('events.archive_3_rowell.say_4'), { voice: 'v_rowell_seal_04', face: 'rowell:angry' });
    await ev.fade('out', 500);
    ev.setFlag('final_seal_scene', false);
    await ev.fade('in', 500);
    await x.narr(ev, R.T('events.archive_3_rowell.narr_3'));
    ev.leadDone('l_main_final_archive');
    ev.lead('l_main_final_archive');
  }, { meta: { needs: [], gives: ['flag:final_rowell'] } });
  /** 8 つの書見台（こだま）: 語り直した伝承の章の題と、選んだ版の一文 */
  E('archive_tale', async (ev, ctx) => {
    const x = X();
    const rid = ctx && ctx.region;
    const reg = R.DB.regions[rid] || {};
    const c = x.chapters().find((q) => q.id === rid);
    await x.narr(ev, R.T('events.archive_tale.narr'));
    if (!c) { await x.narr(ev, R.T('events.archive_tale.narr_2', { p0: reg.name || '' })); return; }
    ev.sfx('page');
    await ev.caption('『' + c.title + '』\n' + (c.write || c.first), { ms: 3000 });
    await x.narr(ev, R.T('events.archive_tale.narr_3'));
  });

  // ================================================================ 4 階 伝説の三つの影
  E('archive_4_boss', async (ev) => {
    const x = X();
    if (ev.flag('final_shades')) return;
    ev.bgm('omen');
    await x.narr(ev, R.T('events.archive_4_boss.narr'));
    await ev.say('king', R.T('events.archive_4_boss.say'), Object.assign({ voice: 'v_king_shades_01' }, KING));
    ev.sfx('dark');
    x.flash('#c8d0ff', 400);
    await x.narr(ev, R.T('events.archive_4_boss.narr_2'));
    const r = await ev.battle('tr_b_heroshades', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('final_shades');
    ev.sfx('holy');
    x.flash('#ffffff', 400);
    await x.narr(ev, R.T('events.archive_4_boss.narr_3'));
    R.Audio.pushBgm('fine_theme');
    try {
      await x.narr(ev, R.T('events.archive_4_boss.narr_4'));
      await ev.say('fine', R.T('events.archive_4_boss.say_2'), { voice: 'v_fine_shades_01', face: 'fine:sad', name: R.T('events.archive_4_boss.say.name') });
      await ev.say('fine', R.T('events.archive_4_boss.say_3'), { voice: 'v_fine_shades_02', face: 'fine:smile', name: R.T('events.archive_4_boss.say.name') });
    } finally { R.Audio.popBgm(); }
    x.lore(ev, 'lo_three_shades');
    ev.mapBgm();
  }, { meta: { needs: [], gives: ['flag:final_shades', 'lore:lo_three_shades'] } });
  const PAINTINGS = {
    1: R.T('ev.final_archive.PAINTINGS.1'),
    2: R.T('ev.final_archive.PAINTINGS.2'),
    3: R.T('ev.final_archive.PAINTINGS.3'),
    4: R.T('ev.final_archive.PAINTINGS.4'),
  };
  E('archive_4_painting', async (ev, ctx) => {
    const t = PAINTINGS[(ctx && ctx.pic) || 1] || PAINTINGS[1];
    for (const p of t) await X().narr(ev, p);
  });
  E('archive_4_statue', async (ev) => {
    await X().narr(ev, R.T('events.archive_4_statue.narr'));
  });

  // ================================================================ 5 階 大書記ラザロ
  const LZ_VOICES = ['v_lazaro_archive_01', 'v_lazaro_archive_02', 'v_lazaro_archive_03', 'v_lazaro_archive_04', 'v_lazaro_archive_05', 'v_lazaro_archive_06', 'v_lazaro_archive_07', 'v_king_archive_01'];
  E('archive_5_lazaro', async (ev) => {
    const x = X();
    if (ev.flag('final_lazaro')) return;
    await x.preload(LZ_VOICES);
    ev.bgm('tension');
    await x.breath(ev, 400);
    await ev.say('lazaro', R.T('events.archive_5_lazaro.say'), { voice: 'v_lazaro_archive_01', face: 'lazaro:neutral' });
    await ev.say('lazaro', R.T('events.archive_5_lazaro.say_2'), { voice: 'v_lazaro_archive_02', face: 'lazaro:sad' });
    await ev.say('lazaro', R.T('events.archive_5_lazaro.say_3'), { voice: 'v_lazaro_archive_03', face: 'lazaro:sad' });
    await ev.say('lazaro', R.T('events.archive_5_lazaro.say_4'), { voice: 'v_lazaro_archive_04', face: 'lazaro:neutral' });
    await ev.say('lazaro', R.T('events.archive_5_lazaro.say_5'), { voice: 'v_lazaro_archive_05', face: 'lazaro:neutral' });
    // 年代記の「痛みも書いた」が 6 つ以上: 声なしの段（§5.1）。戦闘の最初の手番で、ラザロはためらう
    const pained = x.pain() >= 6;
    if (pained) {
      await x.narr(ev, R.T('events.archive_5_lazaro.narr'));
      await x.narr(ev, R.T('events.archive_5_lazaro.narr_2'));
      await x.breath(ev, 800);
    }
    await ev.say('lazaro', R.T('events.archive_5_lazaro.say_6'), { voice: 'v_lazaro_archive_06', face: 'lazaro:angry' });
    const r = await ev.battle('tr_b_lazaro', { boss: true, hesitate: pained ? { id: 'b_lazaro', msg: R.T('events.archive_5_lazaro.b_lazaro.msg') } : undefined });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.bgm('sorrow');
    await ev.say('lazaro', R.T('events.archive_5_lazaro.say_7'), { voice: 'v_lazaro_archive_07', face: 'lazaro:sad' });
    ev.sfx('dark');
    x.shake(3, 600);
    await ev.say('king', R.T('events.archive_5_lazaro.say_8'), Object.assign({ voice: 'v_king_archive_01' }, KING));
    ev.sfx('warp');
    x.flash('#ffffff', 500);
    ev.setFlag('final_lazaro');
    try { await ev.leave('lazaro', { ms: 700, steps: 1 }); } catch (e) { /* */ }
    await x.narr(ev, R.T('events.archive_5_lazaro.narr_3'));
    ev.sfx('page');
    await x.narr(ev, R.T('events.archive_5_lazaro.narr_4'));
    ev.mapBgm();
  }, { meta: { needs: [], gives: ['flag:final_lazaro'] } });
  E('archive_5_desk', async (ev) => {
    const x = X();
    if (ev.flag('final_lazaro')) { await x.narr(ev, R.T('events.archive_5_desk.narr')); return; }
    await x.narr(ev, R.T('events.archive_5_desk.narr_2'));
  });
  E('archive_5_seal', async (ev) => {
    if (ev.flag('final_lazaro')) return;
    await X().narr(ev, R.T('events.archive_5_seal.narr'));
  });

  // ================================================================ 6 階 虚ろの王 → ネムレア
  const KING_VOICES = ['v_king_altar_01', 'v_king_altar_02', 'v_king_altar_03', 'v_king_naming_01', 'v_fine_naming_01'];
  /** 名づけ（§9.3 の 3 の 6 階）。short = 第 2 形態で全滅した後のやり直し */
  async function naming(ev, short) {
    const x = X();
    ev.setFlag('final_naming_scene');
    try { await ev.appear('naming_fine', { ms: 900 }); } catch (e) { /* */ }
    R.Audio.pushBgm('fine_theme');
    try {
      if (short) await ev.say('naming_fine', R.T('ev.final_archive.naming.say'), { face: 'fine:angry' });
      else await ev.say('naming_fine', R.T('ev.final_archive.naming.say_2'), { face: 'fine:angry' });
      ev.sfx('quill');
      await x.narr(ev, R.T('ev.final_archive.naming.narr'));
      await ev.caption(R.T('ev.final_archive.naming.caption'), { ms: 2600 });
      await ev.say('king', R.T('ev.final_archive.naming.say_3'), Object.assign({ voice: 'v_king_naming_01' }, KING));
      ev.sfx('roar');
      x.shake(5, 900);
      x.flash('#ffffff', 500);
      await x.narr(ev, R.T('ev.final_archive.naming.narr_2'));
      await ev.say('naming_fine', R.T('ev.final_archive.naming.say_4'), { voice: 'v_fine_naming_01', face: 'fine:smile' });
      ev.sfx('heal');
      x.flash('#fffbe0', 600);
      ev.rest();
      await x.narr(ev, R.T('ev.final_archive.naming.narr_3'));
    } finally { R.Audio.popBgm(); }
  }
  E('archive_6_boss', async (ev) => {
    const x = X();
    if (ev.flag('final_clear')) return;
    await x.preload(KING_VOICES);
    const retry = ev.flag('final_nemrea1');
    if (!retry) {
      await x.narr(ev, R.T('events.archive_6_boss.narr'));
      ev.sfx('dark');
      x.shake(3, 700);
      await ev.say('king', R.T('events.archive_6_boss.say'), Object.assign({ voice: 'v_king_altar_01' }, KING));
      const r1 = await ev.battle('tr_b_nemrea1', { boss: true, noEscape: true });
      if (r1 !== 'win') { ev.mapBgm(); return; }
      ev.setFlag('final_nemrea1');
      ev.sfx('page');
      x.flash('#ffffff', 400);
      await x.narr(ev, R.T('events.archive_6_boss.narr_2'));
      await ev.say('king', R.T('events.archive_6_boss.say_2'), Object.assign({ voice: 'v_king_altar_02' }, KING));
    } else {
      await ev.say('king', R.T('events.archive_6_boss.say_3'), Object.assign({ voice: 'v_king_altar_03' }, KING));
    }
    await naming(ev, retry);
    const r2 = await ev.battle('tr_b_nemrea2', { boss: true, noEscape: true });
    if (r2 !== 'win') { ev.setFlag('final_naming_scene', false); ev.mapBgm(); return; }
    await ev.call('final_ending');
  }, { meta: { needs: ['flag:final_lazaro'], gives: ['flag:final_nemrea1', 'flag:final_clear'], calls: ['final_ending'] } });
  E('archive_6_altar', async (ev) => {
    const x = X();
    if (clear(ev)) { await x.narr(ev, R.T('events.archive_6_altar.narr')); await ev.caption(x.TITLE_LINE, { ms: 2400 }); return; }
    await x.narr(ev, R.T('events.archive_6_altar.narr_2'));
  });
})(window.RPG);
