// 大火祭の支度・大火祭の夜・籠城（3 波）・朝の鐘。WORLD_REDESIGN §4.3 の 1〜4・§4.10（吹雪の大狼）、STORY_BIBLE §7.3、E15（連戦）
//   支度の 3 つ（順番自由）: 薪（雪の林の倒木 3 本、snow_woods.js のイベント）・氷の灯籠（釣り小屋のトーレにのこぎりを借りて凍った池で切り出す、
//     R.Mini.timing）・昔話（イングリッド／オラフ／ブレンダの 3 人から聞く）。薪と昔話がそろえば祭を始められる（氷の灯籠は無くてもよい。
//     ただし白竜と「語る」道は、3 つともそろえて「竜と娘の約束」を語ったときだけ）。
//   大火祭の夜（snow_festival）: 語る話を選ぶ（ch_snow_tale）→ 字幕で語る → 吹雪と狼の群れ → 籠城。
//   籠城（snow_siege_wave。yule_night で村長に話すと次の波）: 波ごとに守る門を選ぶ（ch_snow_gate_<n>）。見張りのハルドが遠吠えの方角を教える。
//     守った門で 2 戦（猟師が加勢すると 1 戦目が 1 匹少ない）、そのあと大かまどで全快。いちばん強く押された門を守らなければ、そこが破られる
//     （snow_gate_<g>_broken: 見た目と台詞と店。失敗は無い）。3 波目は群れの頭「吹雪の大狼」: 一度も守らなかった門を狙う（読み合い）。
//     読み当てれば門の前で迎え撃つ（援軍が少ない）。外せば門が破られ、大かまどの前で戦う（守らなかった門の数だけ援軍）。
//   朝の鐘（snow_dawn）: 見張り台に灰色のマントの少女（録音の文のまま、声なし）→ ソーニャが冬至の火の火種 → 峰へ。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Snow.ev;

  // ================================================================ 支度: 昔話（3 人の年寄り）
  async function tellTale(ev, key, who, intro, after) {
    const T = X().TALES[key];
    if (ev.flag('snow_tale_' + key)) {
      await ev.say(who, after);
      return;
    }
    await ev.say(who, intro);
    ev.sfx('quill');
    for (const l of T.lines) await ev.caption(l, { ms: 2600 });
    ev.setFlag('snow_tale_' + key);
    await ev.caption(R.T('ev.snow_festival.tellTale.caption', { name: T.name }), { ms: 1800 });
    const n = ['dragon', 'hunter', 'fire_child'].filter((k) => ev.flag('snow_tale_' + k)).length;
    if (n >= 3 && !ev.flag('snow_tales_done')) {
      ev.setFlag('snow_tales_done');
      ev.leadDone('q_snow_ingrid');
      await ev.caption(R.T('ev.snow_festival.tellTale.caption_2'), { ms: 2600 });
    }
  }
  E('yule_ingrid', async (ev) => {
    if (X().cleared(ev)) { await ev.say('ingrid', R.T('events.yule_ingrid.say')); return; }
    await tellTale(ev, 'dragon', 'ingrid',
      R.T('events.yule_ingrid.tellTale'),
      R.T('events.yule_ingrid.tellTale_2'));
  }, { meta: { needs: [], gives: ['flag:snow_tale_dragon', 'flag:snow_tales_done'] } });
  E('yule_olaf', async (ev) => {
    if (X().cleared(ev)) { await ev.say('olaf', R.T('events.yule_olaf.say')); return; }
    await tellTale(ev, 'hunter', 'olaf',
      R.T('events.yule_olaf.tellTale'),
      R.T('events.yule_olaf.tellTale_2'));
  }, { meta: { needs: [], gives: ['flag:snow_tale_hunter', 'flag:snow_tales_done'] } });
  E('yule_brenda', async (ev) => {
    if (X().cleared(ev)) { await ev.say('brenda', R.T('events.yule_brenda.say')); return; }
    await tellTale(ev, 'fire_child', 'brenda',
      R.T('events.yule_brenda.tellTale'),
      R.T('events.yule_brenda.tellTale_2'));
  }, { meta: { needs: [], gives: ['flag:snow_tale_fire_child', 'flag:snow_tales_done'] } });

  // ================================================================ 支度: 氷の灯籠（釣り小屋のトーレ → 凍った池で切り出す）
  E('yule_fisher', async (ev) => {
    if (!ev.flag('snow_saw') && !ev.flag('snow_festival_lit')) {
      await ev.say('fisher', R.T('events.yule_fisher.say'));
      ev.item('k_ice_saw', 1);
      ev.setFlag('snow_saw');
    } else if (ev.flag('snow_ice_done') && ev.has('k_ice_saw')) {
      // 切り終えたのこぎりは、トーレに話すと返る（前はその場で消えて「返しておこう」と合わなかった。テスター 2026-10-02 P11）
      ev.take('k_ice_saw', 1);
      await ev.say('fisher', R.T('events.yule_fisher.say_2'));
      return;
    }
    await ev.call('snow_fishing_talk');
  }, { meta: { needs: [], gives: ['item:k_ice_saw', 'flag:snow_saw'], calls: ['snow_fishing_talk'] } });

  E('yule_pond_ice', async (ev) => {
    if (ev.flag('snow_ice_done')) { await ev.say(null, R.T('events.yule_pond_ice.say')); return; }
    if (!ev.flag('snow_saw')) { await ev.say(null, R.T('events.yule_pond_ice.say_2')); return; }
    await ev.say(null, R.T('events.yule_pond_ice.say_3'));
    const r = (await ev.mini.timing({ title: R.T('events.yule_pond_ice.r.title'), sub: R.T('events.yule_pond_ice.r.sub'), speed: 1500, zones: [[0.38, 0.62]], tries: 3, theme: 'night' })) || { hits: 3 };
    if (r.hits >= 2) {
      ev.sfx('item');
      ev.addVar('snow_ice_blocks', r.hits);
      await ev.caption(R.T('events.yule_pond_ice.caption', { Math: Math.min(3, ev.var('snow_ice_blocks')) }), { ms: 1800 });
    } else {
      await ev.caption(R.T('events.yule_pond_ice.caption_2'), { ms: 1600 });
    }
    if (ev.var('snow_ice_blocks') >= 3) {
      ev.item('k_ice_blocks', 1);   // のこぎりは持ったまま（トーレに話して返す。yule_fisher）
      ev.setFlag('snow_ice_done');
      await ev.caption(R.T('events.yule_pond_ice.caption_3'), { ms: 2400 });
    }
  }, { meta: { needs: ['flag:snow_saw'], gives: ['flag:snow_ice_done', 'item:k_ice_blocks'] } });

  // ================================================================ 大火祭の夜
  E('snow_festival', async (ev) => {
    const x = X();
    if (ev.flag('snow_festival_lit')) return;
    await ev.fade('out', 700);
    ev.setFlag('snow_festival_lit');
    await ev.warp('yule_night', 'hearth');
    ev.bgm('bonfire');
    await ev.caption(R.T('events.snow_festival.caption'), { ms: 2600 });
    await ev.caption(R.T('events.snow_festival.caption_2'), { ms: 2200 });
    ev.sfx('fire');
    try { R.Field.flash('#ffb060', 500); } catch (e) { /* */ }
    await ev.caption(R.T('events.snow_festival.caption_3'), { ms: 2600 });
    if (ev.flag('snow_ice_done')) await ev.caption(R.T('events.snow_festival.caption_4'), { ms: 2800 });
    await ev.say('jorn', R.T('events.snow_festival.say'), { voice: ['v_jorn_snow_05', 'v_jorn_snow_06'] });
    const keys = ['dragon', 'hunter', 'fire_child'].filter((k) => ev.flag('snow_tale_' + k));
    const i = await ev.choose(keys.map((k) => x.TALES[k].name), { text: R.T('events.snow_festival.i.choose.text') });
    const key = keys[i] || keys[0];
    ev.choice('ch_snow_tale', key);
    await ev.say(null, R.T('events.snow_festival.say_2'));
    ev.bgm('legend');
    for (const l of x.TALES[key].lines) await ev.caption(l, { ms: 3000 });
    await ev.caption(R.T('events.snow_festival.caption_5'), { ms: 2600 });
    if (key === 'fire_child') await ev.say('sonja', R.T('events.snow_festival.say_3'));
    if (key === 'hunter') await ev.say('olaf_n', R.T('events.snow_festival.say_4'), { name: R.T('events.snow_festival.say.name') });
    // 吹雪と狼
    ev.bgm('omen');
    ev.sfx('roar');
    try { R.Field.shake(4, 600); } catch (e) { /* */ }
    await ev.caption(R.T('events.snow_festival.caption_6'), { ms: 2600 });
    await ev.npc('hald').face('n');   // 見張りのハルドは大かまどの西にいる（画面の中で叫ぶ。テスター 2026-10-02 P19）
    await ev.caption(R.T('events.snow_festival.caption_7'), { ms: 2400 });
    await ev.npc('hald').face('hero');
    await ev.say('hald', R.T('events.snow_festival.say_5'), { voice: ['v_hald_snow_01', 'v_hald_snow_02'] });
    await ev.say('jorn', R.T('events.snow_festival.say_6'), { voice: ['v_jorn_snow_07', 'v_jorn_snow_08'] });   // 2 つ目は名前を読まない
    ev.leadDone('l_snow_prep');
    await ev.call('snow_siege_wave');
  }, {
    meta: {
      needs: ['flag:snow_logs_done', 'flag:snow_tales_done'],
      gives: ['flag:snow_festival_lit', 'choice:ch_snow_tale'],
      calls: ['snow_siege_wave'],
      warp: { to: 'yule_night', spawn: 'hearth' },
    },
  });

  // ================================================================ 籠城（1 波ずつ。村長に話すと次の波）
  const MAIN = { 1: 'n', 2: 'e' };
  const HINT = {
    1: R.T('ev.snow_festival.HINT.1'),
    2: R.T('ev.snow_festival.HINT.2'),
    3: R.T('ev.snow_festival.HINT.3'),
  };
  const PICKS = R.T('ev.snow_festival.PICKS');
  const G_OF = ['n', 'e', 'w'];
  // 吹雪の大狼の姿（地図の NPC bwolf。ふだんは隠れていて、3 波目の場面でだけ出す。テスター 2026-10-02 P21「姿を現したのにマップにいない」）
  //   門で迎え撃つ: その門の外から一行の前へ。破られた: 破られた門の側の道から大かまどの前へ
  const WOLF_GATE = { n: { at: [27, 2], from: [27, 0], dir: 's' }, w: { at: [2, 29], from: [0, 29], dir: 'e' }, e: { at: [53, 28], from: [55, 28], dir: 'w' } };
  const WOLF_HEARTH = { n: { at: [34, 27], from: [40, 27], dir: 'w' }, w: { at: [21, 27], from: [16, 27], dir: 'e' }, e: { at: [34, 27], from: [40, 27], dir: 'w' } };
  async function bwolfShow(ev, p) {
    await ev.npc('bwolf').setPos(p.at[0], p.at[1]);
    ev.sfx('roar');
    await ev.appear('bwolf', { from: p.from, dir: p.dir, speed: 0.8 });
  }
  E('snow_siege_wave', async (ev) => {
    const x = X();
    if (ev.flag('snow_siege_done')) return;
    const w = ev.var('snow_wave') + 1;
    if (w > 3) return;
    await ev.say('hald', HINT[w], { name: R.T('events.snow_siege_wave.say.name') });
    const i = await ev.choose(PICKS, { cancel: 3, text: R.T('events.snow_siege_wave.i.choose.text', { w }) });
    if (i === 3 || i == null || i < 0) {
      await ev.say('jorn', R.T('events.snow_siege_wave.say'), { name: R.T('events.snow_siege_wave.say.name_2') });
      return;
    }
    const g = G_OF[i];
    ev.choice('ch_snow_gate_' + w, g);
    const hunter = ev.choiceOf('ch_snow_tale') === 'hunter';
    await ev.fade('out', 400);
    await ev.warp('yule_night', 'def_' + g);
    await ev.caption(R.T('events.snow_siege_wave.caption', { p0: x.GATES[g] }), { ms: 2200 });
    const wins = async (list) => {
      for (let k = 0; k < list.length; k++) {
        if (k > 0) await ev.caption(R.T('events.snow_siege_wave.wins.caption'), { ms: 1200 });
        const r = await ev.battle(list[k]);
        if (r !== 'win') return false;
      }
      return true;
    };
    if (w < 3) {
      if (hunter) await ev.say(null, R.T('events.snow_siege_wave.say_2'));
      const ok = await wins(w === 1 ? [hunter ? 'tr_siege_1a_e' : 'tr_siege_1a', 'tr_siege_1b'] : [hunter ? 'tr_siege_2a_e' : 'tr_siege_2a', 'tr_siege_2b']);
      if (!ok) return;
      ev.mapBgm();
      const main = MAIN[w];
      if (g === main) {
        await ev.caption(R.T('events.snow_siege_wave.caption_2', { p0: x.GATES[g] }), { ms: 2600 });
      } else {
        ev.setFlag('snow_gate_' + main + '_broken');
        ev.sfx('shake');
        await ev.caption(R.T('events.snow_siege_wave.caption_3', { p0: x.GATES[g], p1: x.GATES[main] }), { ms: 2400 });
        await ev.caption({ n: R.T('events.snow_siege_wave.caption.n'), e: R.T('events.snow_siege_wave.caption.e'), w: R.T('events.snow_siege_wave.caption.w') }[main], { ms: 2400 });
      }
      ev.addVar('snow_wave', 1);
      await ev.fade('out', 400);
      await ev.warp('yule_night', 'hearth');
      ev.rest();
      await ev.caption(R.T('events.snow_siege_wave.caption_4'), { ms: 1800 });
      await ev.say('jorn', w === 1 ? R.T('events.snow_siege_wave.say_3') : R.T('events.snow_siege_wave.say_4'), { name: R.T('events.snow_siege_wave.say.name_2') });
      return;
    }
    // 3 波目: 吹雪の大狼（一度も守らなかった門を狙う）
    const und = x.undefended(ev);
    const bossGate = und[0];
    let k;
    if (g === bossGate) {
      // 読み当てた: 前の 3 波目で外して破られた印が残っていれば消す（1・2 波で破られた門はそのまま。テスター 2026-10-02 Q12
      //   「西の門を読み当てて守ったのに、朝に『西の門は、ひどくやられた』」）
      const early = (bossGate === 'n' && ev.choiceOf('ch_snow_gate_1') !== 'n') || (bossGate === 'e' && ev.choiceOf('ch_snow_gate_2') !== 'e');
      if (!early) ev.setFlag('snow_gate_' + bossGate + '_broken', false);
      await bwolfShow(ev, WOLF_GATE[g]);
      await ev.caption(R.T('events.snow_siege_wave.caption_5'), { ms: 2200 });
      k = Math.max(0, und.length - 1);
    } else {
      const ok = await wins([hunter ? 'tr_siege_3a_e' : 'tr_siege_3a']);
      if (!ok) return;
      ev.setFlag('snow_gate_' + bossGate + '_broken');
      ev.sfx('shake');
      await ev.caption(R.T('events.snow_siege_wave.caption_6', { p0: x.GATES[bossGate] }), { ms: 2600 });
      await ev.fade('out', 300);
      await ev.warp('yule_night', 'hearth');
      k = Math.min(2, und.length);
      ev.bgm('omen');
      await bwolfShow(ev, WOLF_HEARTH[bossGate]);
    }
    ev.bgm('omen');
    await ev.say(null, R.T('events.snow_siege_wave.say_5'));
    if (k > 0) await ev.say(null, k > 1 ? R.T('events.snow_siege_wave.say_6') : R.T('events.snow_siege_wave.say_7'));
    const r = await ev.battle(['tr_b_blizzardwolf_0', 'tr_b_blizzardwolf_1', 'tr_b_blizzardwolf_2'][k], { boss: true });
    await ev.npc('bwolf').hide();   // 戦いの後は地図の大狼を消す（勝てば群れは散る。負け・逃げはまた村長に話して始める）
    if (r !== 'win') return;
    ev.setFlag('snow_bwolf');
    ev.addVar('snow_wave', 1);
    ev.setFlag('snow_siege_done');
    ev.leadDone('l_snow_howl');
    ev.mapBgm();
    await ev.caption(R.T('events.snow_siege_wave.caption_7'), { ms: 2400 });
    await ev.call('snow_dawn');
  }, {
    meta: {
      needs: ['flag:snow_festival_lit'],
      gives: ['flag:snow_siege_done', 'flag:snow_bwolf', 'choice:ch_snow_gate_1', 'choice:ch_snow_gate_2', 'choice:ch_snow_gate_3'],
      calls: ['snow_dawn'],
    },
  });

  // 籠城の夜の人
  E('yule_siege_jorn', async (ev) => { if (!ev.flag('snow_siege_done')) await ev.call('snow_siege_wave'); }, { meta: { needs: ['flag:snow_festival_lit'], gives: [], calls: ['snow_siege_wave'] } });
  E('yule_siege_sonja', async (ev) => {
    await ev.say('sonja', R.T('events.yule_siege_sonja.say'));
    ev.rest();
  });
  E('yule_siege_hald', async (ev) => {
    const w = ev.var('snow_wave') + 1;
    await ev.say('hald', HINT[Math.min(3, w)] || R.T('events.yule_siege_hald.say'));
  });
  E('yule_siege_guard', async (ev, ctx) => {
    const id = ctx && ctx.npc;
    await ev.say(id, id === 'olaf_n' ? R.T('events.yule_siege_guard.say') : R.T('events.yule_siege_guard.say_2'));
  });

  // ================================================================ 朝の鐘（籠城が明ける）
  E('snow_dawn', async (ev) => {
    if (ev.flag('snow_dawn')) return;
    ev.setFlag('snow_dawn');
    await ev.fade('out', 900);
    await ev.warp('yule', 'watch');
    ev.bgm('dawn');
    ev.sfx('bell');
    await ev.caption(R.T('events.snow_dawn.caption'), { ms: 3000 });
    // 見張り台の灰色のマントの少女（録音の文のまま。声はあとで）
    R.Audio.pushBgm('fine_theme');
    try {
      try { await ev.npc('fine').face('n'); } catch (e) { /* */ }
      await ev.say(null, R.T('events.snow_dawn.say'));
      await ev.say('fine', R.T('events.snow_dawn.say_2'), { name: R.T('events.snow_dawn.say.name'), voice: 'v_fine_snow_01' });
      ev.sfx('magic');
      // 見張りの台の東の端へ歩き、吹雪の中へ薄れて消える（パッと消さない）
      try { await ev.leave('fine', { path: [[32, 1], [33, 1]], ms: 900 }); } catch (e) { /* */ }
      ev.setFlag('snow_fine_seen');
      await ev.caption(R.T('events.snow_dawn.caption_2'), { ms: 2000 });
    } finally { R.Audio.popBgm(); }
    // ソーニャと冬至の火の火種
    await ev.say('sonja', R.T('events.snow_dawn.say_3'));
    ev.item('k_winter_flame', 1);
    ev.lead('l_snow_peak');
    if (ev.choiceOf('ch_snow_tale') === 'fire_child' && !ev.flag('snow_ice_1')) {
      ev.setFlag('snow_ice_1');
      await ev.say('sonja', R.T('events.snow_dawn.say_4'));
    }
    // 村長の言葉: 3 波目の大狼を読み当てたか（その門で迎え撃った）、外したか（その門が破られた）で分ける（テスター 2026-10-02 Q12）。
    //   読み当てたときは、その門のことを「破られた」とは言わない（1・2 波で破られていれば「その前の波で」と言う）
    const bossGate = X().undefended(ev)[0];
    const read = !!bossGate && ev.choiceOf('ch_snow_gate_3') === bossGate;
    const broken = ['n', 'e', 'w'].filter((g) => ev.flag('snow_gate_' + g + '_broken'));
    const join = broken.map((g) => X().GATES[g]).join(R.T('events.snow_dawn.say.0.join'));
    const lines = [];
    if (read) lines.push(R.T('events.snow_dawn.read', { gate: X().GATES[bossGate] }));
    else if (bossGate && ev.flag('snow_gate_' + bossGate + '_broken')) lines.push(R.T('events.snow_dawn.miss', { gate: X().GATES[bossGate] }));
    if (broken.length) lines.push(R.T(read ? 'events.snow_dawn.say.0_read' : 'events.snow_dawn.say.0', { join }), R.T('events.snow_dawn.say.1'));
    else lines.push(...[].concat(R.T('events.snow_dawn.say_5')));
    await ev.say('jorn', lines, { name: R.T('events.snow_dawn.say.name_2') });
    // 見張り台の上（watch）は高台で、下りる段が無い。場面が終わったら大かまどの前へ戻す
    // （持ち主 2026-10-01「狼のボスを倒すと村の北のどこからも出られない所から再開して詰む」）
    await ev.fade('out', 500);
    await ev.warp('yule', 'hearth');
    ev.mapBgm();
  }, { meta: { needs: ['flag:snow_siege_done'], gives: ['flag:snow_dawn', 'item:k_winter_flame', 'lead:l_snow_peak', 'flag:snow_fine_seen'], warp: { to: 'yule', spawn: 'hearth' } } });

  // 籠城の夜に全滅したら: 宿ではなく大かまどの前で全快して起きる。所持金は減らさない（R.State.wipeSafe。テスター 2026-10-02 P23・P24）。
  //   波の数は進まないので、村長に話せば同じ波（3 波目なら門の読み）からやり直せる
  { const St = (R.State = R.State || {}); (St._safe = St._safe || []).push((G) => (G.flags.snow_festival_lit && !G.flags.snow_siege_done ? { map: 'yule_night', spawn: 'hearth', event: 'yule_siege_regroup' } : null)); }
  E('yule_siege_regroup', async (ev) => {
    await ev.caption(R.T('events.yule_siege_regroup.caption'), { ms: 2600 });
  }, { meta: { needs: ['flag:snow_festival_lit'], gives: [] } });

  // 籠城の途中で町を出た（全滅して宿へ・ワープ）: 昼のユールに入ったら夜へ戻す
  E('yule_siege_resume', async (ev) => {
    if (!ev.flag('snow_festival_lit') || ev.flag('snow_siege_done')) return;
    await ev.caption(R.T('events.yule_siege_resume.caption'), { ms: 2000 });
    await ev.warp('yule_night', 'hearth');
  }, { meta: { needs: [], gives: [] } });
})(window.RPG);
