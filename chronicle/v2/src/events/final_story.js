// CONTENT（終盤）: T8 の場面・終盤のロア・ビブリアへの船（STORY_BIBLE §4.3 の灯の数 8・§6.1〜§6.4・§9.3 の 1〜2・§11.1〜§11.3）
//   story_t8          E17: 8 つ目の地方を解決した後、次に宿に泊まるか町に入ると（R.Tier の遅らせ）。灰色のマントの少女が灯りの下に立って名乗り、
//                     正体を明かす（v_fine_t8_01〜06）。声なしの 2 行（§6.1・§6.2）。手がかり帳の余白に古層がつながる（l_main_margin_8、ネムレア）
//   story_final_roa   ロアの roa_enter（T8 の後、1 回）: 封書（寄っていなければ）→ 語り石の前のベルナ → フィーネ・ロウェル（声 §11）→
//                     読み聞かせ（章の題と、選んだ版の最初の一文）→ 記憶が戻る → {hero}の生い立ち（朝が来なくなった後に生まれ、ベルナが育てた）→
//                     リオナの名とロウェルの生い立ち（ミラの家に預けられた赤子をラザロが育てた。ベルナには死んだと告げさせた。
//                     くべられなかった手紙の「あの子」）→ アルノ（語り部で、記録院の分室の写し手）→ 首飾り → フィーネが去る →
//                     ベルナが幼いころに灰色のマントの少女に会ったことを思い出す → 朝の席（エンディングの伏線。R23）→ 霧が晴れる（final_open）
//   final_ferry       ファロスの桟橋の記録院の船（ロウェル、のちに船乗り）: 1 回目は静夜会のイェナが来て、名を探しに一緒に渡る（§8.10。
//                     エンディングで「エステル」と名乗るための出番。テスター 2026-10-04 §9 の 8）→ 航海（ロウェルの一言）→ ビブリア
//   final_ferry_back  ビブリアの桟橋の船乗り: ファロスへ戻る
// 演出（テスター 2026-10-04 §7「大事な場面が字幕と暗転だけ」）: 人を立たせて向かい合わせ、間（wait）とカメラの寄りを足した。声の行は変えていない。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Final.ev;
  const REGIONS8 = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];

  // ================================================================ T8 八節の光
  E('story_t8', async (ev, ctx) => {
    const x = X();
    const St = R.Story;
    if (ev.flag('story_t8')) return;
    await x.preload(['v_fine_t8_01', 'v_fine_t8_02', 'v_fine_t8_03', 'v_fine_t8_04', 'v_fine_t8_05', 'v_fine_t8_06']);
    // 宿の中で起きたら宿の前へ（T6・T7 と同じ）
    if (St && St.stage) { try { await St.stage(ev, ctx); } catch (e) { /* */ } }
    await x.narr(ev, R.T('events.story_t8.narr'));
    R.Audio.pushBgm('fine_theme');
    try {
      // 灯りの下に、少女が浮かび上がる（足もとが透けている）
      if (St && St.actor) await St.actor(ev, 'fine', 'fine', { dist: 2, walk: 0, ms: 1400, alpha: 0.7 });
      await x.breath(ev, 500);
      await x.narr(ev, R.T('events.story_t8.narr_2'));
      await x.face(ev, 'fine', 'hero');
      await x.breath(ev, 400);
      await ev.say('fine', R.T('events.story_t8.say'), { voice: 'v_fine_t8_01', face: 'fine:smile' });
      await ev.say('fine', R.T('events.story_t8.say_2'), { voice: 'v_fine_t8_02', face: 'fine:neutral' });
      await ev.say('fine', R.T('events.story_t8.say_3'), { voice: 'v_fine_t8_03', face: 'fine:neutral' });
      ev.sfx('dark');
      x.shake(2, 500);
      await ev.say('fine', R.T('events.story_t8.say_4'), { voice: 'v_fine_t8_04', face: 'fine:sad' });
      await x.breath(ev, 600);
      // 声なしの 2 行（STORY_BIBLE §6.1「なぜこの見習いなのか」・§6.2「なぜ透けていくのか」）
      await ev.say('fine', R.T('events.story_t8.say_5'), { face: 'fine:smile' });
      await x.act(ev, 'fine', 'think', 900);
      await ev.say('fine', R.T('events.story_t8.say_6'), { face: 'fine:smile' });
      await ev.say('fine', R.T('events.story_t8.say_7'), { voice: 'v_fine_t8_05', face: 'fine:neutral' });
      await ev.say('fine', R.T('events.story_t8.say_8'), { voice: 'v_fine_t8_06', face: 'fine:smile' });
      ev.sfx('magic');
      x.flash('#e8ecff', 300);
      if (St && St.leave) await St.leave(ev, 'fine', { steps: 2, ms: 1400 });
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
  /** くべられなかった手紙の「預かっていた子」の一通（§10.3 の 2 通目）を読んでいるか */
  const readKeptChild = (ev) => ev.flag('lo_lz_2');

  /** ロウェルの生い立ち（テスター 2026-10-04 §9 の 1・2。STORY_BIBLE §2.2 の「その後」・§6.4 の出自・§10.3 の 2 通目） */
  async function rowellOrigin(ev) {
    const x = X();
    const RW = { face: 'rowell:sad' };
    await x.face(ev, 'fin_berna', 'e');
    await x.face(ev, 'fin_rowell', 'w');
    await x.breath(ev, 300);
    await ev.say('fin_berna', R.T('events.story_final_roa.say_9'), { face: 'berna:surprise' });
    await x.act(ev, 'fin_rowell', 'surprise', 600);
    await ev.say('fin_rowell', R.T('events.story_final_roa.o_rowell_1'), RW);
    await ev.say('fin_berna', R.T('events.story_final_roa.o_berna_1'), { face: 'berna:sad' });
    await ev.say('fin_berna', R.T('events.story_final_roa.o_berna_2'), { face: 'berna:sad' });
    await x.breath(ev, 600);
    await ev.say('fin_rowell', R.T('events.story_final_roa.o_rowell_2'), RW);
    await ev.say('fin_rowell', R.T('events.story_final_roa.o_rowell_3'), RW);
    await x.narr(ev, R.T('events.story_final_roa.o_narr_1'));
    await ev.say('fin_berna', R.T('events.story_final_roa.o_berna_3'), { face: 'berna:sad' });
    // くべられなかった手紙の「あの子」（拾っていれば。読んでいなければロウェルが自分で気づく）
    if (readKeptChild(ev)) {
      await x.narr(ev, R.T('events.story_final_roa.o_narr_2'));
      ev.sfx('page');
      await ev.caption(R.T('events.story_final_roa.o_caption'), { ms: 4200 });
      await x.face(ev, 'fin_rowell', 'hero');
      await ev.say('fin_rowell', R.T('events.story_final_roa.o_rowell_4'), RW);
      await ev.say('fin_rowell', R.T('events.story_final_roa.o_rowell_5'), RW);
    } else {
      await ev.say('fin_rowell', R.T('events.story_final_roa.o_rowell_6'), RW);
    }
    await x.breath(ev, 800);
    await x.act(ev, 'fin_rowell', 'sad', 1200);
    await x.narr(ev, R.T('events.story_final_roa.o_narr_3'));
    await ev.say('fin_rowell', R.T('events.story_final_roa.o_rowell_7'), { face: 'rowell:neutral' });
    await ev.say('fin_rowell', R.T('events.story_final_roa.o_rowell_8'), { face: 'rowell:smile' });
    await x.act(ev, 'fin_berna', 'nod', 800);
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
    await ev.fade('in', 700);
    await x.breath(ev, 600);
    await x.face(ev, 'fin_berna', 's');
    await ev.say('fin_berna', R.T('events.story_final_roa.say'), { face: 'berna:smile' });
    await x.narr(ev, R.T('events.story_final_roa.narr'));
    ev.setFlag('final_roa_scene');
    await x.appear(ev, 'fin_fine', { from: [26, 18], ms: 900 });
    await x.face(ev, 'fin_fine', 'w');
    // T7 の後、ロウェルはロアに身を寄せていた（story_t7。§6.3）
    if (ev.flag('story_t7')) await x.narr(ev, R.T('events.story_final_roa.narr_7'));
    await x.appear(ev, 'fin_rowell', { from: [27, 18], ms: 900 });
    await x.face(ev, 'fin_rowell', 'w');
    await ev.say('fin_fine', R.T('events.story_final_roa.say_2'), { voice: 'v_fine_roa_01', face: 'fine:smile' });
    await x.face(ev, 'fin_berna', 'e');
    await x.breath(ev, 500);
    await ev.say('fin_berna', R.T('events.story_final_roa.say_3'), { voice: 'v_berna_roa_01', face: 'berna:surprise' });
    await ev.say('fin_fine', R.T('events.story_final_roa.say_4'), { voice: 'v_fine_roa_02', face: 'fine:sad' });
    // 読み聞かせ（§9.3 の 1: 章の題と、選んだ版の最初の一文。ボイスなし）。語り石にカメラを寄せる
    ev.bgm('legend');
    await x.cam(ev, 21, 16, 900);
    await x.narr(ev, R.T('events.story_final_roa.narr_2'));
    for (const c of x.chapters()) {
      ev.sfx('page');
      await ev.caption('『' + c.title + '』\n' + (c.write || c.first), { ms: 3000 });
    }
    await x.breath(ev, 700);
    await x.camBack(ev, 700);
    // 記憶が戻る
    ev.bgm('home');
    ev.sfx('light');
    x.flash('#fff0d0', 600);
    await x.narr(ev, R.T('events.story_final_roa.narr_3'));
    await x.face(ev, 'fin_berna', 's');
    await x.act(ev, 'fin_berna', 'surprise', 700);
    await ev.say('fin_berna', R.T('events.story_final_roa.say_5'), { face: 'berna:surprise' });
    await x.breath(ev, 500);
    await ev.say('fin_berna', R.T('events.story_final_roa.say_6'), { voice: 'v_berna_roa_02', face: 'berna:smile' });
    if (x.pain() >= 4) await ev.say('fin_berna', R.T('events.story_final_roa.say_7'), { face: 'berna:sad' });
    // {hero}の生い立ち（§6.1。出自はプレイヤーが作成で決めたまま。リオナの坊やとは別の子だと分かるように。テスター §9 の 3）
    await ev.say('fin_berna', R.T('events.story_final_roa.h_berna_1'), { face: 'berna:smile' });
    await ev.say('fin_berna', R.T('events.story_final_roa.h_berna_2'), { face: 'berna:smile' });
    await x.face(ev, 'fin_rowell', 'w');
    await ev.say('fin_rowell', R.T('events.story_final_roa.say_8'), { voice: 'v_rowell_roa_01', face: 'rowell:neutral' });
    // T7 を見ていないとき（古い記録）だけ: 封印の扉の言葉の手帳をここで渡す（T7 の声の行は流さない）
    if (!ev.has('k_rowell_note')) {
      await x.narr(ev, R.T('events.story_final_roa.narr_8'));
      ev.item('k_rowell_note', 1);
      x.lore(ev, 'lo_rowell_cover');
    }
    // ロウェルの母の名と、誰に育てられたか（§6.4 の弧: 名を得る者）
    await x.breath(ev, 400);
    await rowellOrigin(ev);
    // 始まりの年代記のありかと、師匠アルノ（語り部で、記録院の分室の写し手。テスター §9 の 5）
    await x.face(ev, 'fin_berna', 's');
    await ev.say('fin_berna', R.T('events.story_final_roa.say_10'), { voice: 'v_berna_roa_03', face: 'berna:neutral' });
    await ev.say('fin_berna', R.T('events.story_final_roa.a_berna_1'), { face: 'berna:neutral' });
    await ev.say('fin_berna', R.T('events.story_final_roa.a_berna_2'), { face: 'berna:smile' });
    if (ev.flag('lo_ev_isles')) {
      await x.narr(ev, R.T('events.story_final_roa.a_narr'));
      await ev.say('fin_berna', R.T('events.story_final_roa.a_berna_3'), { face: 'berna:smile' });
    }
    await ev.say('fin_berna', R.T('events.story_final_roa.say_11'), { voice: 'v_berna_roa_04', face: 'berna:smile' });
    if (!ev.has('ac_berna_charm')) ev.item('ac_berna_charm', 1);
    await ev.say('fin_fine', R.T('events.story_final_roa.say_12'), { voice: 'v_fine_roa_03', face: 'fine:smile' });
    ev.sfx('magic');
    x.flash('#e8ecff', 300);
    await x.leave(ev, 'fin_fine', { ms: 1200, steps: 2 });
    // ベルナとフィーネ（幼いベルナは、語り石のそばで灰色のマントの少女に一度会っている。§6.2。テスター §9 の 4）
    await x.breath(ev, 600);
    await x.face(ev, 'fin_berna', 'e');
    await x.narr(ev, R.T('events.story_final_roa.f_narr'));
    await ev.say('fin_berna', R.T('events.story_final_roa.f_berna_1'), { face: 'berna:surprise' });
    await ev.say('fin_berna', R.T('events.story_final_roa.f_berna_2'), { face: 'berna:smile' });
    await x.face(ev, 'fin_rowell', 'hero');
    await ev.say('fin_rowell', R.T('events.story_final_roa.say_13'), { voice: 'v_rowell_roa_02', face: 'rowell:neutral' });
    await x.leave(ev, 'fin_rowell', { ms: 900, path: [[24, 18], [26, 18], [28, 18]] });
    // 語り石: 後ろ半分の字が戻り、前の半分（題）だけが白い（§9.3 の 1）
    await x.cam(ev, 21, 15, 700);
    await x.narr(ev, R.T('events.story_final_roa.narr_6'));
    ev.sfx('light');
    x.flash('#fffbe0', 700);
    await ev.caption(R.T('events.story_final_roa.caption'), { ms: 3000 });
    await x.camBack(ev, 600);
    ev.setFlag('final_open');
    ev.setFlag('final_roa');
    ev.setFlag('final_roa_scene', false);
    // 朝の席（エンディングで日が差す席。序章で食卓を調べていなくても分かるように、ここで話す。テスター 2026-10-04 R23）
    await x.face(ev, 'fin_berna', 's');
    await ev.say('fin_berna', R.T('events.story_final_roa.m_berna_1'), { face: 'berna:smile' });
    await x.cam(ev, 20, 27, 900);
    await x.narr(ev, R.T('events.story_final_roa.m_narr'));
    await x.breath(ev, 500);
    await ev.say('fin_berna', R.T('events.story_final_roa.m_berna_2'), { face: 'berna:neutral' });
    await ev.say('fin_berna', R.T('events.story_final_roa.m_berna_3'), { face: 'berna:smile' });
    await x.camBack(ev, 700);
    ev.setFlag('final_seat_told');
    await ev.say('fin_berna', R.T('events.story_final_roa.say_14'), { face: 'berna:smile' });
    ev.leadDone('l_main_final_roa');
    ev.lead('l_main_final_ferry');
    ev.mapBgm();
  }, { meta: { needs: ['flag:story_t8'], gives: ['flag:final_roa', 'flag:final_open', 'flag:final_seat_told', 'lore:lo_berna_confession', 'item:ac_berna_charm', 'lead:l_main_final_ferry', 'item:k_rowell_note', 'lore:lo_rowell_cover'], warp: { to: 'roa', spawn: 'fin_stone' } } });

  // ================================================================ ビブリアへの船（記録院の船。ファロスの桟橋）
  /** 静夜会のイェナ（§8.10。名を奉納した人たちの名は白の書の中。一緒に島へ渡り、エンディングで本当の名を思い出す） */
  async function yena(ev) {
    const x = X();
    if (ev.flag('final_yena_ferry')) return;
    const Y = { name: R.T('events.final_ferry.y_name'), title: R.T('events.final_ferry.y_title'), face: false };
    await x.narr(ev, R.T('events.final_ferry.y_narr'));
    ev.setFlag('final_yena_scene');
    await x.appear(ev, 'fin_yena', { from: [22, 37], speed: 0.8 });
    await x.face(ev, 'fin_yena', 'hero');
    await x.face(ev, 'fin_rowell_pier', 'w');
    await ev.say('fin_yena', R.T('events.final_ferry.y_1'), Y);
    await ev.say('fin_yena', R.T('events.final_ferry.y_2'), Y);
    await ev.say('fin_yena', R.T('events.final_ferry.y_3'), Y);
    await x.breath(ev, 500);
    await ev.say('fin_rowell_pier', R.T('events.final_ferry.y_rowell_1'), { face: 'rowell:sad' });
    await ev.say('fin_rowell_pier', R.T('events.final_ferry.y_rowell_2'), { face: 'rowell:neutral' });
    await x.act(ev, 'fin_yena', 'bow', 900);
    await ev.say('fin_yena', R.T('events.final_ferry.y_4'), Y);
    ev.setFlag('final_yena_ferry');
  }
  async function voyage(ev, first) {
    const x = X();
    await ev.fade('out', 700);
    ev.sfx('ship');
    ev.setFlag('final_yena_scene', false);
    if (first) {
      ev.bgm('sorrow');
      await ev.caption(R.T('ev.final_story.voyage.caption'), { ms: 2800 });
      // 船の上のロウェル（声なし。エンディングの「ミラさんの話を、聞かせてください」へ）
      await ev.say('fin_rowell_pier', R.T('ev.final_story.voyage.rowell'), { name: x.WHO.rowell.name, face: 'rowell:neutral' });
      if (ev.flag('final_yena_ferry')) await ev.caption(R.T('ev.final_story.voyage.yena'), { ms: 2600 });
      await ev.caption(R.T('ev.final_story.voyage.caption_2'), { ms: 3200 });
      ev.setFlag('final_sailed');
    } else {
      await ev.caption(R.T('ev.final_story.voyage.caption_3'), { ms: 1600 });
    }
    await ev.warp('biblia', 'dock');
  }
  E('final_ferry', async (ev) => {
    const x = X();
    if (!ev.flag('final_open')) return;
    const first = !ev.flag('final_sailed');
    if (first) {
      await x.face(ev, 'fin_rowell_pier', 'hero');
      await ev.say('fin_rowell_pier', R.T('events.final_ferry.say'), { face: 'rowell:neutral' });
      await yena(ev);
    } else {
      await ev.say('fin_ship_hand', R.T('events.final_ferry.say_2'));
    }
    const i = await ev.choose(R.T('events.final_ferry.i.choose'), { cancel: 1, who: first ? 'fin_rowell_pier' : 'fin_ship_hand', face: first ? 'rowell:neutral' : undefined, text: first ? R.T('events.final_ferry.i.choose.text') : R.T('events.final_ferry.i.choose.text_2') });
    if (i !== 0) {
      if (first) await ev.say('fin_rowell_pier', R.T('events.final_ferry.say_3'), { face: 'rowell:neutral' });
      return;
    }
    await voyage(ev, first);
  }, { meta: { needs: ['flag:final_open'], gives: ['flag:final_sailed', 'flag:final_yena_ferry'], warp: { to: 'biblia', spawn: 'dock' } } });
  E('final_ferry_back', async (ev) => {
    const i = await ev.choose(R.T('events.final_ferry_back.i.choose'), { cancel: 1, who: true, text: R.T('events.final_ferry_back.i.choose.text') });
    if (i !== 0) return;
    await ev.fade('out', 600);
    ev.sfx('ship');
    await ev.caption(R.T('events.final_ferry_back.caption'), { ms: 1600 });
    await ev.warp('pharos', 'fin_pier');
  }, { meta: { needs: ['flag:final_arrived'], gives: [], warp: { to: 'pharos', spawn: 'fin_pier' } } });
})(window.RPG);
