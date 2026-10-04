// CONTENT（終盤）: エンディング（STORY_BIBLE §9.4 の E1〜E12、§7.9 地方の結果、§9.5、§11。画面の部品は screens/ending.js の R.Ending）
//   final_ending   ネムレアを倒した後（archive_6_boss が呼ぶ）。結末は一本（太陽は必ず戻る）。変わるのは地方のカード・朗読の文・ラザロの章・小さな一行だけ。
//     E1 虚ろの間: ネムレア（v_nemrea_ending_01・02）が年代記に吸い込まれる → 最後のページに名
//     E2 同: フィーネが物語に還る（v_fine_ending_01・02）。消える前、声なしで「題を、お願い」
//     E3 同: 白紙の題のページ → {hero}が羽ペンを取る → 「夜があって、朝が来た。」（R.Ending.titlePage）。年代記の扉にも同じ一行
//     E4 大書庫の入口（ビブリア、まだ夜）: ラザロが目を覚ます（v_lazaro_ending_01）→ ロウェルが肩を貸す（v_rowell_ending_01）
//     E5 同: ラザロの章を書く（ch_final_lazaro: sin 罪として ／ father 父として）→ 後日談は字幕だけ
//     E6 ビブリアの広場: 町の人が名を思い出す → ノア（v_noa_ending_01）→ ミラの節で題の一行を歌う → 東の空が白み、日が昇る（biblia_dawn）→
//        「{hero}は、はじめて朝を見た。」→ イェナが「エステル」と名乗り直す
//     E7 年代記の朗読（章の題と選んだ版の一文）→ 地方のカード 8 枚（朝日が差していく順）→ タデオのカード（ファロス）
//     E8 ロアの丘の朝（roa_dawn）: 語り石のそばのベルナが振り返る「おはよう。今日は大事な日だよ。」（v_berna_prologue_01 の 2 度目。§11.3 の「再」）→
//        「約束の朝ごはん」→ ベルナの家（roa_house_dawn）: ベルナが朝の席の後ろへ歩き、カメラが席へ寄る → 東の窓から光が差して席に落ちる
//        （R.Ending.beam）→ ベルナが席の布を外し、杯を置く → 間 →「いらっしゃい。……二十年、待っていたよ。」→ 字幕（テスター 2026-10-04 R23。
//        朝の席の意味は終盤のロアでベルナが話す: final_seat_told）
//     演出（テスター 2026-10-04 §7）: E1 は祭壇へカメラ、E2 はフィーネが歩み寄って向かい合う、E4 はラザロとロウェルの短いやりとり
//        （育ての父と語り部の子）、E6 はファロスから一緒に渡ったイェナが名乗る
//     E9 語り石: 子どもたちに語る（v_berna_ending_01・02）→ 終章『語り部の旅』が年代記に → 「それは、九つ目の伝承になった」
//     E10 クレジット（R.Ending.credits）  E11 しばらくして（v_berna_ending_03）  E12 おしまい → クリアの記録（つづきはロアの里から）→ タイトル
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Final.ev;
  const ch = (k) => (R.Game && R.Game.choices ? R.Game.choices[k] : undefined);
  // 序章の 1 行目の流し直し（§11.3「v_berna_prologue_01: 序章 P1 ＋ E8 ロアの日の出（再）」）。
  // 1 回目は prologue_roa.js の ev.say。ここは 2 度目なので、定数から鳴らす（tools/qa/check_voice.js がこの流し直しを別に確かめる）
  const FIRST_MORNING = 'v_berna_prologue_01';
  const ENDING_VOICES = ['v_nemrea_ending_01', 'v_nemrea_ending_02', 'v_fine_ending_01', 'v_fine_ending_02', 'v_lazaro_ending_01', 'v_rowell_ending_01',
    'v_noa_ending_01', FIRST_MORNING, 'v_berna_ending_01', 'v_berna_ending_02', 'v_berna_ending_03'];

  // ---------------------------------------------------------------- 地方のカード（§7.9。カードは地方の人物だけで作る）
  /** 解決した順の地方のカード → [{name, text, image, focus}] */
  function cards() {
    const x = X();
    const pain = (r) => ch('ch_' + r + '_write') === 'pain';
    const C = {
      r_forest: { image: 'treetop/under/fern', focus: [0.5, 0.45], text: () => R.T('ev.final_ending.cards.C.r_forest.text', { p0: pain('forest')
        ? R.T('ev.final_ending.cards.C.r_forest.text_2')
        : R.T('ev.final_ending.cards.C.r_forest.text_3') }) },
      r_desert: { image: 'desert/under/kasim', focus: [0.5, 0.5], text: () => R.T('ev.final_ending.cards.C.r_desert.text', { p0: pain('desert')
        ? R.T('ev.final_ending.cards.C.r_desert.text_2') : R.T('ev.final_ending.cards.C.r_desert.text_3') }) },
      r_snow: { image: 'snow/under/yule', focus: [0.5, 0.45], text: () => R.T('ev.final_ending.cards.C.r_snow.text', { p0: pain('snow')
        ? R.T('ev.final_ending.cards.C.r_snow.text_2') : (ch('ch_snow_tale') === 'dragon' ? R.T('ev.final_ending.cards.C.r_snow.text_3') : R.T('ev.final_ending.cards.C.r_snow.text_4')) }) },
      r_marsh: { image: 'moss_village/under/loch', focus: [0.5, 0.45], text: () => R.T('ev.final_ending.cards.C.r_marsh.text', { p0: pain('marsh')
        ? R.T('ev.final_ending.cards.C.r_marsh.text_2') : R.T('ev.final_ending.cards.C.r_marsh.text_3') }) },
      r_isles: { image: 'isles/under/nerei', focus: [0.5, 0.35], text: () => R.T('ev.final_ending.cards.C.r_isles.text', { p0: pain('isles')
        ? R.T('ev.final_ending.cards.C.r_isles.text_2') : (ch('ch_isles_wreck') === 'help' ? R.T('ev.final_ending.cards.C.r_isles.text_3') : R.T('ev.final_ending.cards.C.r_isles.text_4')) }) },
      r_mine: { image: 'mine/under/dovan', focus: [0.5, 0.5], text: () => R.T('ev.final_ending.cards.C.r_mine.text', { p0: {
        guild: R.T('ev.final_ending.cards.C.r_mine.text.guild'), smiths: R.T('ev.final_ending.cards.C.r_mine.text.smiths'), accord: R.T('ev.final_ending.cards.C.r_mine.text.accord'),
      }[ch('ch_mine_side')] || R.T('ev.final_ending.cards.C.r_mine.text_2'), p1: pain('mine') ? R.T('ev.final_ending.cards.C.r_mine.text_3') : '' }) },
      r_ash: { image: 'ash/under/caldera', focus: [0.5, 0.45], text: () => R.T('ev.final_ending.cards.C.r_ash.text', { p0: pain('ash')
        ? R.T('ev.final_ending.cards.C.r_ash.text_2') : R.T('ev.final_ending.cards.C.r_ash.text_3') }) },
      r_star: { image: 'star/under/orbis', focus: [0.5, 0.4], text: () => R.T('ev.final_ending.cards.C.r_star.text', { p0: pain('star')
        ? R.T('ev.final_ending.cards.C.r_star.text_2') : R.T('ev.final_ending.cards.C.r_star.text_3') }) },
    };
    const out = [];
    for (const c of x.chapters()) {
      const d = C[c.id];
      if (!d) continue;
      out.push({ name: (R.DB.regions[c.id] || {}).name || '', text: d.text(), image: d.image, focus: d.focus });
    }
    out.push({ name: R.T('ev.final_ending.cards.name'), text: R.T('ev.final_ending.cards.text'), image: 'harbor/under/pharos', focus: [0.45, 0.5] });
    return out;
  }
  /** 朗読の章（§9.4 の E7。序章は入れない） */
  function reading() {
    return X().chapters().map((c) => ({ title: c.title, region: (R.DB.regions[c.id] || {}).name, text: c.write ? c.first + '\n' + c.write : c.first }));
  }
  const inField = () => { try { return !!(R.Field && R.Engine && R.Engine.has && R.Engine.has('field')); } catch (e) { return false; } };

  E('final_ending', async (ev) => {
    const x = X();
    await x.preload(ENDING_VOICES);
    // ================================================================ E1 虚ろの間
    ev.bgm('legend');
    ev.sfx('page');
    x.flash('#ffffff', 700);
    x.heroFace('n');
    await x.cam(ev, 17, 8, 900);
    await x.narr(ev, R.T('events.final_ending.narr'));
    await x.breath(ev, 600);
    // 安らぎの声（§5.2: 恐れではなく）。ひと呼吸ずつ間を取る
    await ev.say('nemrea', R.T('events.final_ending.say'), { voice: 'v_nemrea_ending_01', face: false, name: R.T('events.final_ending.say.name') });
    await x.breath(ev, 800);
    await ev.say('nemrea', R.T('events.final_ending.say_2'), { voice: 'v_nemrea_ending_02', face: false, name: R.T('events.final_ending.say.name') });
    await x.breath(ev, 500);
    ev.sfx('light');
    x.flash('#fffbe0', 900);
    await x.narr(ev, R.T('events.final_ending.narr_2'));
    await ev.caption(R.T('events.final_ending.caption'), { ms: 3200 });
    await x.camBack(ev, 700);
    // ================================================================ E2 フィーネが物語に還る
    R.Audio.pushBgm('fine_theme');
    try {
      // フィーネは一行の方へ歩いてきて、向かい合う
      await x.walk(ev, 'naming_fine', [[18, 13]], 0.7);
      await x.face(ev, 'naming_fine', 'hero');
      x.heroFace('s');
      await x.breath(ev, 500);
      await ev.say('naming_fine', R.T('events.final_ending.say_3'), { face: 'fine:smile' });
      await ev.say('naming_fine', R.T('events.final_ending.say_4'), { voice: 'v_fine_ending_01', face: 'fine:smile' });
      await x.breath(ev, 600);
      await ev.say('naming_fine', R.T('events.final_ending.say_5'), { voice: 'v_fine_ending_02', face: 'fine:sad' });
      await x.narr(ev, R.T('events.final_ending.e2_narr'));
      await x.breath(ev, 700);
      await ev.say('naming_fine', R.T('events.final_ending.say_6'), { face: 'fine:smile' });
      await x.act(ev, 'naming_fine', 'nod', 800);
      ev.sfx('magic');
      x.flash('#f4f0ff', 900);
      await x.leave(ev, 'naming_fine', { ms: 2600, steps: 1 });
      await x.breath(ev, 900);
      await x.narr(ev, R.T('events.final_ending.narr_3'));
    } finally { R.Audio.popBgm(); }
    ev.setFlag('final_naming_scene', false);
    // ================================================================ E3 白紙の題のページ（祭壇の始まりの年代記へ）
    x.heroFace('n');
    await x.cam(ev, 17, 5, 1000);
    await x.narr(ev, R.T('events.final_ending.narr_4'));
    await x.narr(ev, R.T('events.final_ending.narr_5'));
    await x.breath(ev, 600);
    ev.sfx('quill');
    await x.narr(ev, R.T('events.final_ending.narr_6'));
    await ev.fade('out', 700);
    await R.Ending.titlePage(x.TITLE_LINE);
    const G = R.Game;
    if (G) { G.chronicle = G.chronicle || { chapters: [] }; G.chronicle.title = x.TITLE_LINE; }
    ev.setFlag('final_clear');
    // ================================================================ E4 大書庫の入口（まだ夜）
    ev.setFlag('final_ending_gate');
    await ev.warp('biblia', 'e_gate');
    ev.bgm('sorrow');
    await ev.fade('in', 700);
    await x.act(ev, 'e_lazaro', 'kneel', 1000);
    await x.narr(ev, R.T('events.final_ending.narr_7'));
    await x.breath(ev, 600);
    await ev.say('e_lazaro', R.T('events.final_ending.say_7'), { voice: 'v_lazaro_ending_01', face: 'lazaro:sad' });
    await x.breath(ev, 700);
    await x.face(ev, 'e_rowell', 'w');
    await x.narr(ev, R.T('events.final_ending.narr_8'));
    await x.face(ev, 'e_lazaro', 'e');
    // 育ての父と、語り部の子（ロウェルはロアで母の名を聞いた。テスター 2026-10-04 §9 の 1）
    await ev.say('e_lazaro', R.T('events.final_ending.e4_lazaro_1'), { face: 'lazaro:sad' });
    await ev.say('e_rowell', R.T('events.final_ending.e4_rowell_1'), { face: 'rowell:neutral' });
    await ev.say('e_lazaro', R.T('events.final_ending.e4_lazaro_2'), { face: 'lazaro:sad' });
    await x.breath(ev, 600);
    await ev.say('e_rowell', R.T('events.final_ending.say_8'), { voice: 'v_rowell_ending_01', face: 'rowell:sad' });
    await x.act(ev, 'e_lazaro', 'nod', 900);
    await x.narr(ev, R.T('events.final_ending.e4_narr'));
    // ================================================================ E5 ラザロの章
    await x.narr(ev, R.T('events.final_ending.narr_9'));
    const i = await ev.choose(R.T('events.final_ending.i.choose'), { important: true, text: R.T('events.final_ending.i.choose.text') });
    if (i === 0) {
      ev.choice('ch_final_lazaro', 'sin');
      ev.sfx('quill');
      await ev.caption(R.T('events.final_ending.caption_2'), { ms: 3200 });
      await ev.caption(R.T('events.final_ending.caption_3'), { ms: 3600 });
    } else {
      ev.choice('ch_final_lazaro', 'father');
      ev.sfx('quill');
      await ev.caption(R.T('events.final_ending.caption_4'), { ms: 3200 });
      await ev.caption(R.T('events.final_ending.caption_5'), { ms: 3600 });
    }
    // ふたりは、肩を並べて坂を下りていく
    await Promise.all([x.leave(ev, 'e_lazaro', { ms: 2000, path: [[27, 11], [27, 12], [26, 12], [25, 12]] }), x.leave(ev, 'e_rowell', { ms: 2000, path: [[29, 12], [28, 12], [27, 12], [26, 12]] })]);
    await ev.caption(R.T('events.final_ending.caption_6'), { ms: 3400 });
    // ================================================================ E6 ビブリアの広場 → 日の出
    await ev.fade('out', 600);
    ev.setFlag('final_ending_gate', false);
    ev.setFlag('final_ending_plaza');
    await ev.warp('biblia', 'e_plaza');
    await ev.fade('in', 600);
    await x.narr(ev, R.T('events.final_ending.narr_10'));
    await ev.say('e_boy', R.T('events.final_ending.say_9'));
    await ev.say('e_mother', R.T('events.final_ending.say_10'));
    await ev.say('e_noa', R.T('events.final_ending.say_11'), { voice: 'v_noa_ending_01', face: 'noa:smile' });
    await x.narr(ev, R.T('events.final_ending.narr_11'));
    const glow = inField() ? R.Ending.glow() : null;
    try {
      const song = ev.caption(R.T('events.final_ending.caption_7'), { ms: 5200 });
      if (glow) await glow.to(0.45, 4200);
      await song;
      await x.narr(ev, R.T('events.final_ending.narr_12'));
      if (glow) { await glow.to(1, 1800); await glow.white(1, 900); }
      else await ev.fade('out', 800);
      ev.setFlag('final_ending_plaza', false);
      await ev.warp('biblia_dawn', 'e_plaza');
      ev.bgm('dawn');
      if (glow) { await glow.to(0, 10); await glow.white(0, 1800); } else await ev.fade('in', 1200);
    } finally { if (glow) glow.close(); }
    await ev.caption(R.T('events.final_ending.caption_8'), { ms: 3600 });
    // 静夜会のイェナ（ファロスの桟橋で「名が戻ったら、最初に名乗る」と言った人）
    if (ev.flag('final_yena_ferry')) {
      await x.walk(ev, 'e_yena', [[26, 25], [26, 26]], 0.8);
      await x.face(ev, 'e_yena', 'hero');
      await ev.say('e_yena', R.T('events.final_ending.e6_yena'), { name: R.T('events.final_ending.say.name_2') });
    } else {
      await x.face(ev, 'e_yena', 'hero');
    }
    await ev.say('e_yena', R.T('events.final_ending.say_12'), { name: R.T('events.final_ending.say.name_2') });
    await x.narr(ev, R.T('events.final_ending.e6_narr'));
    await x.breath(ev, 600);
    // ================================================================ E7 年代記の朗読と地方のカード
    await ev.fade('out', 900);
    await R.Ending.reading(reading());
    await R.Ending.cards(cards());
    // ================================================================ E8 ロアの丘の朝
    await ev.warp('roa_dawn', 'e_hill');
    ev.bgm('home');
    await ev.fade('in', 1200);
    await x.narr(ev, R.T('events.final_ending.narr_13'));
    await x.breath(ev, 500);
    try { await ev.npc('e_berna').face('e'); } catch (e) { /* */ }
    await x.breath(ev, 400);
    await ev.say('e_berna', R.T('events.final_ending.say_13'), { voice: FIRST_MORNING, face: 'berna:smile' });
    await x.breath(ev, 700);
    // 朝の席（終盤のロアで話した「朝を待つ席」。テスター 2026-10-04 R23: 人のいない部屋に字幕だけ、をやめる）
    await ev.say('e_berna', ev.flag('final_seat_told') ? R.T('events.final_ending.e8_berna_1') : R.T('events.final_ending.e8_berna_1b'), { face: 'berna:smile' });
    await ev.fade('out', 800);
    await ev.warp('roa_house_dawn', 'e_seat');
    await ev.fade('in', 900);
    await x.breath(ev, 400);
    await x.walk(ev, 'e_berna_house', [[7, 5], [8, 5], [9, 5]], 0.8);
    await x.face(ev, 'e_berna_house', 's');
    x.heroFace('n');
    await x.cam(ev, 9, 6, 1100);
    await x.narr(ev, R.T('events.final_ending.e8_narr_1'));
    // 東の窓から光が差し、朝の席に落ちる
    const beam = inField() && R.Ending.beam ? R.Ending.beam({ x: 9, y: 6 }) : null;
    try {
      ev.sfx('light');
      if (beam) await beam.to(1, 2400); else await x.breath(ev, 1200);
      await x.breath(ev, 700);
      await x.act(ev, 'e_berna_house', 'kneel', 900);
      ev.sfx('page');
      await x.narr(ev, R.T('events.final_ending.e8_narr_2'));
      ev.sfx('item');
      await x.narr(ev, R.T('events.final_ending.e8_narr_3'));
      // ひと呼吸。光の中の席を見つめる
      await x.breath(ev, 1800);
      await x.face(ev, 'e_berna_house', 'e');
      await ev.say('e_berna_house', R.T('events.final_ending.e8_berna_2'), { face: 'berna:smile' });
      await x.breath(ev, 900);
      await ev.caption(R.T('events.final_ending.caption_9'), { ms: 4200 });
      await x.face(ev, 'e_berna_house', 'hero');
      await ev.say('e_berna_house', R.T('events.final_ending.e8_berna_3'), { face: 'berna:smile' });
      await x.breath(ev, 600);
    } finally { if (beam) beam.close(); }
    // ================================================================ E9 語り石
    await ev.fade('out', 800);
    await ev.warp('roa_dawn', 'e_stone');
    ev.bgm('home');
    await ev.fade('in', 900);
    try { await ev.npc('e_berna').face('s'); } catch (e) { /* */ }
    await x.narr(ev, R.T('events.final_ending.narr_14'));
    await ev.say('e_berna', R.T('events.final_ending.say_14'), { voice: 'v_berna_ending_01', face: 'berna:smile' });
    await ev.say('e_berna', R.T('events.final_ending.say_15'), { face: 'berna:smile' });
    if (G) {
      G.chronicle = G.chronicle || { chapters: [] };
      if (!G.chronicle.chapters.some((c) => c && c.id === 'finale')) G.chronicle.chapters.push({ id: 'finale', summaryKey: 'finale' });
    }
    ev.sfx('quill');
    await ev.caption(R.T('events.final_ending.caption_10'), { ms: 3400 });
    await ev.caption(R.T('events.final_ending.caption_11'), { ms: 3000 });
    await ev.say('e_child_a', R.T('events.final_ending.say_16'), { name: R.T('events.final_ending.say.name_3') });
    await ev.say('e_berna', R.T('events.final_ending.say_17'), { voice: 'v_berna_ending_02', face: 'berna:smile' });
    await ev.say('e_berna', R.T('events.final_ending.say_18'), { face: 'berna:smile' });
    // ================================================================ E10 クレジット
    await ev.fade('out', 1200);
    ev.bgm('ending');
    await R.Ending.credits();
    // ================================================================ E11 しばらくして
    ev.bgm('home');
    await ev.warp('roa_dawn', 'e_stone');
    await ev.caption(R.T('events.final_ending.caption_12'), { ms: 2600 });
    await ev.fade('in', 900);
    await ev.say('e_child_b', R.T('events.final_ending.say_19'), { name: R.T('events.final_ending.say.name_3') });
    await ev.say('e_berna', R.T('events.final_ending.say_20'), { voice: 'v_berna_ending_03', face: 'berna:smile' });
    await x.breath(ev, 900);
    // ================================================================ E12 おしまい → クリアの記録
    await ev.fade('out', 1400);
    await R.Ending.fin();
    await clearSave(ev);
  }, {
    meta: {
      needs: ['flag:final_nemrea1'], gives: ['flag:final_clear', 'choice:ch_final_lazaro'],
      warp: [{ to: 'biblia', spawn: 'e_gate' }, { to: 'biblia_dawn', spawn: 'e_plaza' }, { to: 'roa_dawn', spawn: 'e_hill' }, { to: 'roa_house_dawn', spawn: 'e_seat' }, { to: 'roa_dawn', spawn: 'e_stone' }],
    },
  });

  /** クリアの記録（つづきはロアの里から）→ タイトル */
  async function clearSave(ev) {
    const G = R.Game;
    if (G) {
      G.flags.final_clear = true;
      G.flags.final_ending_plaza = false; G.flags.final_ending_gate = false;
      const sp = (R.DB.maps.roa && R.DB.maps.roa.spawns.warp) || { x: 21, y: 19, dir: 's' };
      G.pos = { map: 'roa', x: sp.x, y: sp.y, dir: sp.dir || 's' };
      G.lastInn = { map: 'roa', x: sp.x, y: sp.y, dir: sp.dir || 's' };
    }
    // 「おしまい」の後の暗転を明ける（選択とセーブの画面が暗転の下に隠れないように。後ろは朝のロアの丘）
    try { await ev.fade('in', 700); } catch (e) { /* */ }
    const i = await ev.choose(R.T('ev.final_ending.clearSave.i.choose'), { cancel: 1, text: R.T('ev.final_ending.clearSave.i.choose.text') });
    if (i === 0) {
      try { await R.Screens.open('save', { ending: true }); } catch (e) { R.warn('ending save', e && e.message); }
    }
    // タイトルへ（走っているイベントが終わってから）
    try { if (R.Flow && R.Flow.title) R.Events.after(() => { R.Flow.title(); }); } catch (e) { /* */ }
  }
  X().clearSave = clearSave;
  X().endingCards = cards;       // テスト（tools/test_content_final.js）と見本の撮影用
  X().endingReading = reading;
})(window.RPG);
