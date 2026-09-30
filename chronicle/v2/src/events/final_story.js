// CONTENT（終盤）: T8 の場面・終盤のロア・ビブリアへの船（STORY_BIBLE §4.3 の灯の数 8・§6.1〜§6.4・§9.3 の 1〜2・§11.1〜§11.3）
//   story_t8          E17: 8 つ目の地方を解決した後、次に宿に泊まるか町に入ると（R.Tier の遅らせ）。灰色のマントの少女が名乗り、正体を明かす
//                     （v_fine_t8_01〜06）。声なしの 2 行（§6.1・§6.2）。手がかり帳の余白に古層がつながる（l_main_margin_8、ネムレア）
//   story_final_roa   ロアの roa_enter（T8 の後、1 回）: 封書（寄っていなければ）→ 語り石の前のベルナ → フィーネ・ロウェル（声 §11）→
//                     読み聞かせ（章の題と、選んだ版の最初の一文）→ 記憶が戻る → リオナの名 → 首飾り → 霧が晴れる（final_open）
//   final_ferry       ファロスの桟橋の記録院の船（ロウェル、のちに船乗り）: ビブリアへ渡る（1 回目は航海の字幕）
//   final_ferry_back  ビブリアの桟橋の船乗り: ファロスへ戻る
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Final.ev;
  const REGIONS8 = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];

  // ================================================================ T8 八節の光
  E('story_t8', async (ev) => {
    const x = X();
    if (ev.flag('story_t8')) return;
    await x.preload(['v_fine_t8_01', 'v_fine_t8_02', 'v_fine_t8_03', 'v_fine_t8_04', 'v_fine_t8_05', 'v_fine_t8_06']);
    await x.narr(ev, R.T('events.story_t8.narr'));
    R.Audio.pushBgm('fine_theme');
    try {
      await x.narr(ev, R.T('events.story_t8.narr_2'));
      await ev.say('fine', R.T('events.story_t8.say'), { voice: 'v_fine_t8_01', face: 'fine:smile' });
      await ev.say('fine', R.T('events.story_t8.say_2'), { voice: 'v_fine_t8_02', face: 'fine:neutral' });
      await ev.say('fine', R.T('events.story_t8.say_3'), { voice: 'v_fine_t8_03', face: 'fine:neutral' });
      await ev.say('fine', R.T('events.story_t8.say_4'), { voice: 'v_fine_t8_04', face: 'fine:sad' });
      // 声なしの 2 行（STORY_BIBLE §6.1「なぜこの見習いなのか」・§6.2「なぜ透けていくのか」）
      await ev.say('fine', R.T('events.story_t8.say_5'), { face: 'fine:smile' });
      await ev.say('fine', R.T('events.story_t8.say_6'), { face: 'fine:smile' });
      await ev.say('fine', R.T('events.story_t8.say_7'), { voice: 'v_fine_t8_05', face: 'fine:neutral' });
      await ev.say('fine', R.T('events.story_t8.say_8'), { voice: 'v_fine_t8_06', face: 'fine:smile' });
      ev.sfx('magic');
      x.flash('#e8ecff', 300);
      await x.narr(ev, R.T('events.story_t8.narr_3'));
    } finally { R.Audio.popBgm(); }
    ev.setFlag('story_t8');
    ev.setFlag('story_fine_reveal');
    // 手がかり帳の余白（§4.2 の 8 行目のあと、破れ目をつなぐと読める名）
    ev.sfx('quill');
    ev.lead('l_main_margin_8');
    await x.narr(ev, R.T('events.story_t8.narr_4'));
    await ev.caption(R.T('events.story_t8.caption'), { ms: 3400 });
    ev.lead('l_main_final_roa');
  }, { meta: { needs: REGIONS8.map((r) => 'cleared:' + r), gives: ['flag:story_t8', 'flag:story_fine_reveal', 'lead:l_main_margin_8', 'lead:l_main_final_roa'] } });

  // ================================================================ 終盤のロア
  const SCENE_VOICES = ['v_fine_roa_01', 'v_berna_roa_01', 'v_fine_roa_02', 'v_berna_roa_02', 'v_rowell_roa_01', 'v_berna_roa_03', 'v_berna_roa_04', 'v_fine_roa_03', 'v_rowell_roa_02'];
  /** ベルナの封書（T5 の二通目の封書。T6 のうちにロアへ寄らなかったので、終盤のロアに着いた所で開ける。§6.3）
   *  T6 のロア（story_roa.js）で開けていれば何もしない。持っていれば（T5 の封書）自分で開ける。
   *  持っていないとき（T5 を見ていない古い記録）だけ、門のおかみが預かっていた物を渡す */
  async function confession(ev) {
    const x = X();
    if (ev.flag('lo_berna_confession')) return;
    if (ev.has('k_berna_sealed') && R.Story && R.Story.openSealed) {
      await x.narr(ev, R.T('ev.final_story.confession.narr_2'));
      await R.Story.openSealed(ev);
      return;
    }
    await ev.say('gatewoman2', R.T('ev.final_story.confession.say'), { name: R.T('ev.final_story.confession.say.name') });
    await x.narr(ev, R.T('ev.final_story.confession.narr'));
    ev.sfx('page');
    for (const id of x.CONFESSION) await ev.letter(id);
    x.lore(ev, 'lo_berna_confession');
  }
  E('story_final_roa', async (ev) => {
    const x = X();
    if (ev.flag('final_roa') || !ev.flag('story_t8')) return;
    await x.preload(SCENE_VOICES);
    await confession(ev);
    // 語り石の前へ（ベルナが石の前に立っている。フィーネとロウェルは東の道から）
    await ev.fade('out', 500);
    await ev.warp('roa', 'fin_stone');
    ev.bgm('home');
    await x.breath(ev, 400);
    await ev.say('fin_berna', R.T('events.story_final_roa.say'), { face: 'berna:smile' });
    await x.narr(ev, R.T('events.story_final_roa.narr'));
    ev.setFlag('final_roa_scene');
    try { await ev.appear('fin_fine', { from: [26, 18], ms: 900 }); } catch (e) { /* */ }
    // T7 の後、ロウェルはロアに身を寄せていた（story_t7。§6.3）
    if (ev.flag('story_t7')) await x.narr(ev, R.T('events.story_final_roa.narr_7'));
    try { await ev.appear('fin_rowell', { from: [27, 18], ms: 900 }); } catch (e) { /* */ }
    await ev.say('fin_fine', R.T('events.story_final_roa.say_2'), { voice: 'v_fine_roa_01', face: 'fine:smile' });
    await ev.say('fin_berna', R.T('events.story_final_roa.say_3'), { voice: 'v_berna_roa_01', face: 'berna:surprise' });
    await ev.say('fin_fine', R.T('events.story_final_roa.say_4'), { voice: 'v_fine_roa_02', face: 'fine:sad' });
    // 読み聞かせ（§9.3 の 1: 章の題と、選んだ版の最初の一文。ボイスなし）
    ev.bgm('legend');
    await x.narr(ev, R.T('events.story_final_roa.narr_2'));
    for (const c of x.chapters()) {
      ev.sfx('page');
      await ev.caption('『' + c.title + '』\n' + (c.write || c.first), { ms: 3000 });
    }
    await x.breath(ev, 500);
    // 記憶が戻る
    ev.bgm('home');
    await x.narr(ev, R.T('events.story_final_roa.narr_3'));
    await ev.say('fin_berna', R.T('events.story_final_roa.say_5'), { face: 'berna:surprise' });
    await ev.say('fin_berna', R.T('events.story_final_roa.say_6'), { voice: 'v_berna_roa_02', face: 'berna:smile' });
    if (x.pain() >= 4) await ev.say('fin_berna', R.T('events.story_final_roa.say_7'), { face: 'berna:sad' });
    await ev.say('fin_rowell', R.T('events.story_final_roa.say_8'), { voice: 'v_rowell_roa_01', face: 'rowell:neutral' });
    // T7 を見ていないとき（古い記録）だけ: 封印の扉の言葉の手帳をここで渡す（T7 の声の行は流さない）
    if (!ev.has('k_rowell_note')) {
      await x.narr(ev, R.T('events.story_final_roa.narr_8'));
      ev.item('k_rowell_note', 1);
      x.lore(ev, 'lo_rowell_cover');
    }
    // ロウェルの母の名（§6.4 の弧: 名を得る者）
    await x.breath(ev, 300);
    await ev.say('fin_berna', R.T('events.story_final_roa.say_9'), { face: 'berna:surprise' });
    await x.narr(ev, R.T('events.story_final_roa.narr_4'));
    await x.narr(ev, R.T('events.story_final_roa.narr_5'));
    await ev.say('fin_berna', R.T('events.story_final_roa.say_10'), { voice: 'v_berna_roa_03', face: 'berna:neutral' });
    await ev.say('fin_berna', R.T('events.story_final_roa.say_11'), { voice: 'v_berna_roa_04', face: 'berna:smile' });
    if (!ev.has('ac_berna_charm')) ev.item('ac_berna_charm', 1);
    await ev.say('fin_fine', R.T('events.story_final_roa.say_12'), { voice: 'v_fine_roa_03', face: 'fine:smile' });
    ev.sfx('magic');
    x.flash('#e8ecff', 300);
    try { await ev.leave('fin_fine', { ms: 900, steps: 2 }); } catch (e) { /* */ }
    await ev.say('fin_rowell', R.T('events.story_final_roa.say_13'), { voice: 'v_rowell_roa_02', face: 'rowell:neutral' });
    try { await ev.leave('fin_rowell', { ms: 900, path: [[24, 18], [26, 18], [28, 18]] }); } catch (e) { /* */ }
    // 語り石: 後ろ半分の字が戻り、前の半分（題）だけが白い（§9.3 の 1）
    await x.narr(ev, R.T('events.story_final_roa.narr_6'));
    ev.sfx('light');
    x.flash('#fffbe0', 700);
    await ev.caption(R.T('events.story_final_roa.caption'), { ms: 3000 });
    ev.setFlag('final_open');
    ev.setFlag('final_roa');
    ev.setFlag('final_roa_scene', false);
    await ev.say('fin_berna', R.T('events.story_final_roa.say_14'), { face: 'berna:smile' });
    ev.leadDone('l_main_final_roa');
    ev.lead('l_main_final_ferry');
    ev.mapBgm();
  }, { meta: { needs: ['flag:story_t8'], gives: ['flag:final_roa', 'flag:final_open', 'lore:lo_berna_confession', 'item:ac_berna_charm', 'lead:l_main_final_ferry', 'item:k_rowell_note', 'lore:lo_rowell_cover'], warp: { to: 'roa', spawn: 'fin_stone' } } });

  // ================================================================ ビブリアへの船（記録院の船。ファロスの桟橋）
  async function voyage(ev, first) {
    const x = X();
    await ev.fade('out', 700);
    ev.sfx('ship');
    if (first) {
      ev.bgm('sorrow');
      await ev.caption(R.T('ev.final_story.voyage.caption'), { ms: 2800 });
      await ev.caption(R.T('ev.final_story.voyage.caption_2'), { ms: 3200 });
      ev.setFlag('final_sailed');
    } else {
      await ev.caption(R.T('ev.final_story.voyage.caption_3'), { ms: 1600 });
    }
    await ev.warp('biblia', 'dock');
    void x;
  }
  E('final_ferry', async (ev) => {
    const x = X();
    if (!ev.flag('final_open')) return;
    const first = !ev.flag('final_sailed');
    if (first) {
      await ev.say('fin_rowell_pier', R.T('events.final_ferry.say'), { face: 'rowell:neutral' });
    } else {
      await ev.say('fin_ship_hand', R.T('events.final_ferry.say_2'));
    }
    const i = await ev.choose(R.T('events.final_ferry.i.choose'), { cancel: 1, text: first ? R.T('events.final_ferry.i.choose.text') : R.T('events.final_ferry.i.choose.text_2') });
    if (i !== 0) {
      if (first) await ev.say('fin_rowell_pier', R.T('events.final_ferry.say_3'), { face: 'rowell:neutral' });
      return;
    }
    await voyage(ev, first);
    void x;
  }, { meta: { needs: ['flag:final_open'], gives: ['flag:final_sailed'], warp: { to: 'biblia', spawn: 'dock' } } });
  E('final_ferry_back', async (ev) => {
    const i = await ev.choose(R.T('events.final_ferry_back.i.choose'), { cancel: 1, text: R.T('events.final_ferry_back.i.choose.text') });
    if (i !== 0) return;
    await ev.fade('out', 600);
    ev.sfx('ship');
    await ev.caption(R.T('events.final_ferry_back.caption'), { ms: 1600 });
    await ev.warp('pharos', 'fin_pier');
  }, { meta: { needs: ['flag:final_arrived'], gives: [], warp: { to: 'pharos', spawn: 'fin_pier' } } });
})(window.RPG);
