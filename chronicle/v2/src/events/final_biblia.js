// CONTENT（終盤）: 書の都ビブリア（STORY_BIBLE §9.3 の 2・§4.3 の終盤の行・§5.1 の書斎・§6.5 ノア・§11.2・§11.6、WORLD_REDESIGN §5.13）
//   biblia_arrival    はじめて桟橋に着いたとき（1 回）: 白紙になりかけた町の女 → ロウェル・ノア（声の順は §11: rowell_01 → noa_01 → rowell_02 →
//                     noa_02〜04 → rowell_03・04）→ ロウェルは北の門へ、ノアは宿へ（final_arrived・l_main_final_archive）
//   biblia_noa        ノアの宿: ミラの歌（v_noa_biblia_06、ラザロの後は _05）・ただで泊まる。はじめて話すと余白に一行（歌の節回し = 暁の詞の器）
//   biblia_rowell     北の門のロウェル（封印の前まで）
//   書斎（任意）      肖像画（lo_mira_portrait）・白紙の暁の詞（lo_mira_dawnword）・立会記録（lo_arena_record → 余白 l_main_margin_study）・手紙の箱（拾っていない lo_lz_*）
//   町               掲示板（記録院の通達）・名もなき語り部の像・大図書館の伝説の本・白衣の書記・町の人（ラザロの後・クリアの後で台詞が変わる）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Final.ev;
  const clear = (ev) => ev.flag('final_clear');
  const after = (ev) => ev.flag('final_lazaro');

  // ================================================================ 着いたとき（桟橋）
  const ARR_VOICES = ['v_rowell_biblia_01', 'v_noa_biblia_01', 'v_rowell_biblia_02', 'v_noa_biblia_02', 'v_noa_biblia_03', 'v_noa_biblia_04', 'v_rowell_biblia_03', 'v_rowell_biblia_04'];
  E('biblia_arrival', async (ev, ctx) => {
    const x = X();
    if (ev.flag('final_arrived') || !ev.flag('final_sailed')) return;
    await x.preload(ARR_VOICES);
    ev.bgm('sorrow');
    await x.breath(ev, 500);
    await ev.say('white_woman', R.T('events.biblia_arrival.say'));
    try { await ev.leave('white_woman', { ms: 900, steps: 3 }); } catch (e) { /* */ }
    await ev.say('rowell_quay', R.T('events.biblia_arrival.say_2'), { voice: 'v_rowell_biblia_01', face: 'rowell:sad' });
    try { await ev.npc('noa_quay').move([[25, 36]]); } catch (e) { /* */ }
    await ev.say('noa_quay', R.T('events.biblia_arrival.say_3'), { voice: 'v_noa_biblia_01', face: 'noa:surprise' });
    await ev.say('rowell_quay', R.T('events.biblia_arrival.say_4'), { voice: 'v_rowell_biblia_02', face: 'rowell:neutral' });
    await ev.say('noa_quay', R.T('events.biblia_arrival.say_5'), { voice: 'v_noa_biblia_02', face: 'noa:neutral' });
    await ev.say('noa_quay', R.T('events.biblia_arrival.say_6'), { voice: 'v_noa_biblia_03', face: 'noa:sad' });
    await ev.say('noa_quay', R.T('events.biblia_arrival.say_7'), { voice: 'v_noa_biblia_04', face: 'noa:sad' });
    await ev.say('rowell_quay', R.T('events.biblia_arrival.say_8'), { voice: 'v_rowell_biblia_03', face: 'rowell:neutral' });
    await ev.say('rowell_quay', R.T('events.biblia_arrival.say_9'), { voice: 'v_rowell_biblia_04', face: 'rowell:neutral' });
    try { await ev.leave('rowell_quay', { ms: 1100, path: [[28, 36], [28, 34], [28, 32]] }); } catch (e) { /* */ }
    await ev.say('noa_quay', R.T('events.biblia_arrival.say_10'), { face: 'noa:smile' });
    try { await ev.leave('noa_quay', { ms: 900, path: [[23, 36], [21, 36], [19, 36]] }); } catch (e) { /* */ }
    ev.setFlag('final_arrived');
    ev.leadDone('l_main_final_ferry');
    ev.lead('l_main_final_archive');
    void ctx;
  }, { meta: { needs: ['flag:final_sailed'], gives: ['flag:final_arrived', 'lead:l_main_final_archive'] } });

  // ================================================================ ノアの宿
  async function stay(ev) {
    const i = await ev.choose(R.T('ev.final_biblia.stay.i.choose'), { cancel: 1, text: R.T('ev.final_biblia.stay.i.choose.text') });
    if (i !== 0) { await ev.say('noa', R.T('ev.final_biblia.stay.say'), { face: 'noa:smile' }); return; }
    const p = R.Field.pos;
    await R.Events.night({ onDark() {
      ev.rest();
      if (R.Game) R.Game.lastInn = { map: p.map, x: p.x, y: p.y, dir: p.dir };
    } });
    try { R.Save.autosave('inn'); } catch (e) { /* */ }
    R.emit('inn', { map: p.map });
    await ev.say('noa', clear(ev) ? R.T('ev.final_biblia.stay.say_2') : R.T('ev.final_biblia.stay.say_3'), { face: 'noa:smile' });
  }
  E('biblia_noa', async (ev) => {
    const x = X();
    if (clear(ev)) {
      await ev.say('noa', R.T('events.biblia_noa.say'), { face: 'noa:smile' });
      await ev.caption(R.T('events.biblia_noa.caption'), { ms: 3200 });
    } else if (after(ev)) {
      await ev.say('noa', R.T('events.biblia_noa.say_2'), { voice: 'v_noa_biblia_05', face: 'noa:sad' });
    } else if (!ev.flag('final_noa_song')) {
      await ev.say('noa', R.T('events.biblia_noa.say_3'), { voice: 'v_noa_biblia_06', face: 'noa:smile' });
      await x.narr(ev, R.T('events.biblia_noa.narr'));
      await ev.caption(R.T('events.biblia_noa.caption_2'), { ms: 3400 });
      await x.narr(ev, R.T('events.biblia_noa.narr_2'));
      ev.setFlag('final_noa_song');
      ev.sfx('quill');
      ev.lead('l_main_margin_noa');
    } else {
      await ev.say('noa', R.T('events.biblia_noa.say_4'), { face: 'noa:neutral' });
    }
    await stay(ev);
  }, { meta: { needs: [], gives: ['flag:final_noa_song', 'lead:l_main_margin_noa'] } });
  E('biblia_inn_song', async (ev) => {
    await X().narr(ev, R.T('events.biblia_inn_song.narr'));
  });

  // ================================================================ 北の門のロウェル
  E('biblia_rowell', async (ev) => {
    await ev.say('rowell', R.T('events.biblia_rowell.say'), { face: 'rowell:neutral' });
    await ev.say('rowell', R.T('events.biblia_rowell.say_2'), { face: 'rowell:neutral' });
  });

  // ================================================================ 院長の書斎（任意。§5.1 の見せ方の 3 層目）
  E('biblia_mira_portrait', async (ev) => {
    const x = X();
    await x.narr(ev, R.T('events.biblia_mira_portrait.narr'));
    await x.narr(ev, R.T('events.biblia_mira_portrait.narr_2'));
    x.lore(ev, 'lo_mira_portrait');
  }, { meta: { needs: [], gives: ['lore:lo_mira_portrait'] } });
  E('biblia_mira_dawnword', async (ev) => {
    const x = X();
    await x.narr(ev, R.T('events.biblia_mira_dawnword.narr'));
    await x.narr(ev, R.T('events.biblia_mira_dawnword.narr_2'));
    if (!ev.flag('lo_mira_dawnword')) await x.narr(ev, R.T('events.biblia_mira_dawnword.narr_3'));
    x.lore(ev, 'lo_mira_dawnword');
  }, { meta: { needs: [], gives: ['lore:lo_mira_dawnword'] } });
  E('biblia_arena_record', async (ev) => {
    const x = X();
    await x.narr(ev, R.T('events.biblia_arena_record.narr'));
    await x.narr(ev, R.T('events.biblia_arena_record.narr_2'));
    const first = x.lore(ev, 'lo_arena_record');
    if (first || !ev.flag('final_margin_study')) {
      ev.sfx('quill');
      ev.setFlag('final_margin_study');
      ev.lead('l_main_margin_study');
      await x.narr(ev, R.T('events.biblia_arena_record.narr_3'));
    }
  }, { meta: { needs: [], gives: ['lore:lo_arena_record', 'flag:final_margin_study', 'lead:l_main_margin_study'] } });
  E('biblia_letters_box', async (ev) => {
    const x = X();
    const left = [];
    for (let n = 1; n <= 8; n++) if (R.DB.lore['lo_lz_' + n] && !ev.flag('lo_lz_' + n)) left.push(n);
    await x.narr(ev, R.T('events.biblia_letters_box.narr'));
    if (!left.length) { await x.narr(ev, R.T('events.biblia_letters_box.narr_2')); return; }
    const i = await ev.choose(R.T('events.biblia_letters_box.i.choose'), { cancel: 1, text: R.T('events.biblia_letters_box.i.choose.text', { length: left.length }) });
    if (i !== 0) return;
    for (const n of left) {
      x.lore(ev, 'lo_lz_' + n);
      if (R.DB.letters['letter_lz_' + n]) await ev.letter('letter_lz_' + n);
    }
    await x.narr(ev, R.T('events.biblia_letters_box.narr_3'));
  }, { meta: { needs: [], gives: [] } });
  E('biblia_lazaro_portrait', async (ev) => {
    const x = X();
    if (clear(ev)) { await x.narr(ev, R.T('events.biblia_lazaro_portrait.narr')); return; }
    await x.narr(ev, R.T('events.biblia_lazaro_portrait.narr_2'));
    if (after(ev)) await x.narr(ev, R.T('events.biblia_lazaro_portrait.narr_3'));
  });
  E('biblia_blank_ledger', async (ev) => {
    await X().narr(ev, clear(ev) ? R.T('events.biblia_blank_ledger.narr') : R.T('events.biblia_blank_ledger.narr_2'));
  });
  E('biblia_clerk', async (ev) => {
    if (clear(ev)) { await ev.say('clerk', R.T('events.biblia_clerk.say')); return; }
    await ev.say('clerk', R.T('events.biblia_clerk.say_2'));
    await ev.say('clerk', R.T('events.biblia_clerk.say_3'));
  });

  // ================================================================ 町
  E('biblia_board', async (ev) => {
    const x = X();
    const evs = Object.keys(R.DB.lore || {}).filter((id) => /^lo_ev_/.test(id) && ev.flag(id)).length;
    await x.narr(ev, R.T('events.biblia_board.narr'));
    await x.narr(ev, R.T('events.biblia_board.narr_2'));
    if (evs) await x.narr(ev, R.T('events.biblia_board.narr_3', { evs }));
    if (clear(ev)) await x.narr(ev, R.T('events.biblia_board.narr_4'));
  });
  E('biblia_statue', async (ev) => {
    const x = X();
    if (clear(ev)) {
      await x.narr(ev, R.T('events.biblia_statue.narr'));
      await ev.caption(R.T('events.biblia_statue.caption'), { ms: 2400 });
      return;
    }
    await x.narr(ev, R.T('events.biblia_statue.narr_2'));
    await x.narr(ev, R.T('events.biblia_statue.narr_3'));
  });
  E('biblia_scribe', async (ev, ctx) => {
    const who = (ctx && ctx.npc) || 'scribe_a';
    if (after(ev)) { await ev.say(who, R.T('events.biblia_scribe.say')); return; }
    await ev.say(who, R.T('events.biblia_scribe.say_2'));
  });
  E('biblia_old_man', async (ev) => {
    if (clear(ev)) { await ev.say('old_man', R.T('events.biblia_old_man.say')); return; }
    await ev.say('old_man', R.T('events.biblia_old_man.say_2'));
  });
  E('biblia_board_woman', async (ev) => {
    if (clear(ev)) { await ev.say('board_woman', R.T('events.biblia_board_woman.say')); return; }
    await ev.say('board_woman', R.T('events.biblia_board_woman.say_2'));
  });
  E('biblia_child', async (ev) => {
    if (clear(ev)) { await ev.say('child', R.T('events.biblia_child.say')); return; }
    await ev.say('child', R.T('events.biblia_child.say_2'));
  });
  E('biblia_sailor', async (ev) => {
    if (clear(ev)) { await ev.say('sailor_old', R.T('events.biblia_sailor.say')); return; }
    await ev.say('sailor_old', R.T('events.biblia_sailor.say_2'));
  });
  E('biblia_youth', async (ev) => {
    if (clear(ev)) { await ev.say('youth', R.T('events.biblia_youth.say')); return; }
    await ev.say('youth', R.T('events.biblia_youth.say_2'));
  });

  // ---------------------------------------------------------------- 大図書館
  E('biblia_tome', async (ev) => {
    const x = X();
    await x.narr(ev, R.T('events.biblia_tome.narr'));
    if (!clear(ev)) await x.narr(ev, R.T('events.biblia_tome.narr_2'));
    await x.narr(ev, R.T('events.biblia_tome.narr_3'));
    await x.narr(ev, R.T('events.biblia_tome.narr_4'));
    await x.narr(ev, R.T('events.biblia_tome.narr_5'));
  });
  E('biblia_shelves', async (ev) => {
    await X().narr(ev, clear(ev) ? R.T('events.biblia_shelves.narr') : R.T('events.biblia_shelves.narr_2'));
  });
  E('biblia_librarian', async (ev) => {
    if (clear(ev)) { await ev.say('librarian', R.T('events.biblia_librarian.say')); return; }
    await ev.say('librarian', R.T('events.biblia_librarian.say_2'));
  });

  // ---------------------------------------------------------------- 酒場（白紙になりかけの人々の最後のうわさ）
  E('biblia_barkeep', async (ev) => {
    if (clear(ev)) { await ev.say('barkeep', R.T('events.biblia_barkeep.say')); return; }
    await ev.say('barkeep', R.T('events.biblia_barkeep.say_2'));
  });
  E('biblia_rumor_a', async (ev) => {
    if (clear(ev)) { await ev.say('rumor_a', R.T('events.biblia_rumor_a.say')); return; }
    await ev.say('rumor_a', R.T('events.biblia_rumor_a.say_2'));
  });
  E('biblia_rumor_b', async (ev) => {
    if (clear(ev)) { await ev.say('rumor_b', R.T('events.biblia_rumor_b.say')); return; }
    await ev.say('rumor_b', R.T('events.biblia_rumor_b.say_2'));
  });
  E('biblia_rumor_c', async (ev) => {
    if (clear(ev)) { await ev.say('rumor_c', R.T('events.biblia_rumor_c.say')); return; }
    await ev.say('rumor_c', R.T('events.biblia_rumor_c.say_2'));
  });
  E('biblia_shopkeeper', async (ev) => {
    const i = await ev.choose(R.T('events.biblia_shopkeeper.i.choose'), { cancel: 2, text: clear(ev) ? R.T('events.biblia_shopkeeper.i.choose.text') : R.T('events.biblia_shopkeeper.i.choose.text_2') });
    if (i === 0) await ev.shop('shop_biblia');
    else if (i === 1) await ev.shop('shop_biblia_arms');
  });

  // ---------------------------------------------------------------- 家（エンディングで名を思い出す母と子）
  E('biblia_mother', async (ev) => {
    if (clear(ev)) { await ev.say('mother', R.T('events.biblia_mother.say')); return; }
    await ev.say('mother', R.T('events.biblia_mother.say_2'));
  });
  E('biblia_boy', async (ev) => {
    if (clear(ev)) { await ev.say('boy', R.T('events.biblia_boy.say')); return; }
    await ev.say('boy', R.T('events.biblia_boy.say_2'));
  });
  E('biblia_old_wife', async (ev) => {
    if (clear(ev)) { await ev.say('old_wife', R.T('events.biblia_old_wife.say')); return; }
    await ev.say('old_wife', R.T('events.biblia_old_wife.say_2'));
  });
  E('biblia_old_husband', async (ev) => {
    if (clear(ev)) { await ev.say('old_husband', R.T('events.biblia_old_husband.say')); return; }
    await ev.say('old_husband', R.T('events.biblia_old_husband.say_2'));
  });
})(window.RPG);
