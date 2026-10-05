// 終盤 白の大書庫のボスの予告（BATTLE の形。WORLD_REDESIGN §4.10・E18。地方のボスと同じ「予告 → 守らないと最大 HP の大半」の考えどころ）。
//   数値は tools/sim_bosses.js の 3 本立て（ティア 8）で合わせた。書いた順に bosses.js の LIST の行動に予告を足す（ほかの行動はそのまま）。
//   書架の番人 b_bookgolem: 書架を背に積み上げる（予告）→ 次の手番に書架崩し（全体。守る）。
//   ラザロ b_lazaro: 白紙のページを高く掲げる（予告）→ 次の手番に白紙の審判（全体。守る）。ためらい（setup.hesitate）は battle_core のまま。
//   名のない王 b_nemrea1: 白い闇が王の手に集まる（予告）→ 次の手番に名消し（全体。守る）。
//   ネムレア b_nemrea2: 八つの伝承のページが逆さに開く（予告）→ 次の手番に物語の終わり（全体。守る）。
(function (R) {
  'use strict';
  const SCHED = 200;
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const L = R.DB.monsters;
  // 文は i18n の表（bossActions.<id>.*）。キーは書いたままの形で（test_i18n がキーを拾う）
  const tele = (name, msg, text, tint, next) => ({ name, kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg,
    telegraph: { text, pose: 'tele', tint, next, guard: 'defend', lethal: true } });
  const sweep = (name, msg, pct, kind, fx, element) => ({ name, kind: 'enemy', target: 'enemies',
    effects: [Object.assign({ type: 'special', id: 'desert_sweep', pct, guardPct: 0.08, kind }, element ? { element } : {})], fx, msg });
  Object.assign(R.DB.bossActions, {
    eb_golem_stack: tele(R.T('bossActions.eb_golem_stack.name'), R.T('bossActions.eb_golem_stack.msg'), R.T('bossActions.eb_golem_stack.telegraph.text'), '#e8dcc0', 'eb_golem_topple'),
    eb_golem_topple: sweep(R.T('bossActions.eb_golem_topple.name'), R.T('bossActions.eb_golem_topple.msg'), 0.9, 'blunt', 'strike3'),
    eb_lazaro_raise: tele(R.T('bossActions.eb_lazaro_raise.name'), R.T('bossActions.eb_lazaro_raise.msg'), R.T('bossActions.eb_lazaro_raise.telegraph.text'), '#f4f0e0', 'eb_lazaro_verdict'),
    eb_lazaro_verdict: sweep(R.T('bossActions.eb_lazaro_verdict.name'), R.T('bossActions.eb_lazaro_verdict.msg'), 0.9, 'light', 'magic3', 'light'),
    eb_nemrea_gather: tele(R.T('bossActions.eb_nemrea_gather.name'), R.T('bossActions.eb_nemrea_gather.msg'), R.T('bossActions.eb_nemrea_gather.telegraph.text'), '#f0f0ff', 'eb_nemrea_unname'),
    eb_nemrea_unname: sweep(R.T('bossActions.eb_nemrea_unname.name'), R.T('bossActions.eb_nemrea_unname.msg'), 0.9, 'dark', 'magic3'),
    eb_nemrea2_open: tele(R.T('bossActions.eb_nemrea2_open.name'), R.T('bossActions.eb_nemrea2_open.msg'), R.T('bossActions.eb_nemrea2_open.telegraph.text'), '#fff4d8', 'eb_nemrea2_end'),
    eb_nemrea2_end: sweep(R.T('bossActions.eb_nemrea2_end.name'), R.T('bossActions.eb_nemrea2_end.msg'), 0.92, 'light', 'magic3'),
  });
  // 2026-10-01（ボスの組み直し、オーナー「溜めての即死級はもう飽きた。難しくなるほど色んな角度から」）: 終盤のボスは溜め（予告）を使わない。
  //   1 ラウンドに 2 回（ネムレアは 3 回）。HV = 重い手、LT = 軽い手（ネムレアは 3 つの枠）。上の予告の行動は表に残す（使わない）
  Object.assign(R.DB.bossActions, {
    eb_golem_chain: { name: R.T('bossActions.eb_golem_chain.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.9 }, { type: 'status', status: 'paralyze', chance: 0.4 }, { type: 'buff', stat: 'def', stages: -1, chance: 0.5 }], fx: 'strike2', msg: R.T('bossActions.eb_golem_chain.msg') },
    eb_golem_index: { name: R.T('bossActions.eb_golem_index.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'dispel', side: 'good' }, { type: 'buff', stat: 'mag', stages: -1, chance: 0.4 }], fx: 'dispel', msg: R.T('bossActions.eb_golem_index.msg') },
    eb_shade_parry: { name: R.T('bossActions.eb_shade_parry.name'), kind: 'enemy', target: 'self', effects: [{ type: 'status', status: 'counter', power: 1.0 }], fx: 'buff', msg: R.T('bossActions.eb_shade_parry.msg') },
    eb_shade_seal: { name: R.T('bossActions.eb_shade_seal.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'status', status: 'silence', chance: 0.3 }, { type: 'damage', formula: 'magic', power: 0.4, element: 'light' }], fx: 'silence', msg: R.T('bossActions.eb_shade_seal.msg') },
    eb_lazaro_annotate: { name: R.T('bossActions.eb_lazaro_annotate.name'), kind: 'enemy', target: 'enemy', aim: 'healer', effects: [{ type: 'special', id: 'boss_mark', flag: 'lazaro_mark', pct: 0.32, guardPct: 0.08 }], fx: 'magic', msg: R.T('bossActions.eb_lazaro_annotate.msg') },
    eb_lazaro_redact: { name: R.T('bossActions.eb_lazaro_redact.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'boss_mark_burst', flag: 'lazaro_mark', kind: 'magic', element: 'light' }], fx: 'holy2', msg: R.T('bossActions.eb_lazaro_redact.msg') },
    eb_lazaro_rewrite: { name: R.T('bossActions.eb_lazaro_rewrite.name'), kind: 'enemy', target: 'self', effects: [{ type: 'special', id: 'boss_shift', elem: { light: 1.5, dark: 0.25 }, msg: R.T('bossActions.eb_lazaro_rewrite.shift') }, { type: 'buff', stat: 'mag', stages: 1 }], fx: 'magic2', msg: R.T('bossActions.eb_lazaro_rewrite.msg') },
    eb_nemrea_lull: { name: R.T('bossActions.eb_nemrea_lull.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'status', status: 'sleep', chance: 0.3 }], fx: 'sleep', msg: R.T('bossActions.eb_nemrea_lull.msg') },
    eb_nemrea_snatch: { name: R.T('bossActions.eb_nemrea_snatch.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.8, kind: 'slash' }, { type: 'special', id: 'boss_snatch' }], fx: 'slash', msg: R.T('bossActions.eb_nemrea_snatch.msg') },
    eb_nemrea2_mark: { name: R.T('bossActions.eb_nemrea2_mark.name'), kind: 'enemy', target: 'enemy', aim: 'strong', effects: [{ type: 'special', id: 'boss_mark', flag: 'nemrea_mark', pct: 0.35, guardPct: 0.08 }], fx: 'magic', msg: R.T('bossActions.eb_nemrea2_mark.msg') },
    eb_nemrea2_close: { name: R.T('bossActions.eb_nemrea2_close.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'boss_mark_burst', flag: 'nemrea_mark', kind: 'magic' }], fx: 'magic3', msg: R.T('bossActions.eb_nemrea2_close.msg') },
    eb_nemrea2_page: { name: R.T('bossActions.eb_nemrea2_page.name'), kind: 'enemy', target: 'self', effects: [{ type: 'special', id: 'boss_shift', elem: { light: 0.5, dark: 1.5 }, flag: 'nemrea_dark', clear: 'nemrea_light', msg: R.T('bossActions.eb_nemrea2_page.shift') }], fx: 'dark2', msg: R.T('bossActions.eb_nemrea2_page.msg') },
    eb_nemrea2_page2: { name: R.T('bossActions.eb_nemrea2_page.name'), kind: 'enemy', target: 'self', effects: [{ type: 'special', id: 'boss_shift', elem: { light: 1.5, dark: 0.5 }, flag: 'nemrea_light', clear: 'nemrea_dark', msg: R.T('bossActions.eb_nemrea2_page2.shift') }], fx: 'holy', msg: R.T('bossActions.eb_nemrea2_page.msg') },
  });
  const HV = { every: [2, 0] }, LT = { every: [2, 1] };
  const set = (id, o) => { const d = L[id]; if (d) Object.assign(d, o); };
  // 本の巨人: 重い手（本の一撃・紙の吹雪（ばらまき）・鎖しばり（まひ・守りを下げる））＋軽い手（古書のほこり・索引の目（強化を消す）・本を呼ぶ・綴じ直す（回復））
  set('b_bookgolem', { actsPerTurn: 2, actions: A([['eb_tome_slam', 3, HV], ['eb_page_blizzard', 2, HV], ['eb_golem_chain', 2, HV],
    ['attack', 1, LT], ['eb_dust_of_ages', 1, LT], ['eb_golem_index', 1, { every: [2, 1], round: 2 }], ['eb_call_books', 2, { every: [2, 1], countBelow: 3 }], ['eb_rebind', 2, { every: [2, 1], hpBelow: 0.6 }]]) });
  // 三英雄の影: 剣の影に受けの構え、祈りの影に加護、杖の影に封じの星。三人の合体技「三英雄の再演」がある（下）
  if (L.b_shade_sword) L.b_shade_sword.actions = L.b_shade_sword.actions.concat(A([['eb_shade_parry', 1]]));
  if (L.b_shade_prayer) L.b_shade_prayer.actions = L.b_shade_prayer.actions.concat(A([['e_veil_ally', 1]]));
  if (L.b_shade_star) L.b_shade_star.actions = L.b_shade_star.actions.concat(A([['eb_shade_seal', 1, { round: 2 }]]));
  // ラザロ: 最初から 2 回動く。重い手（銀のペン・記憶を消す（MP）・削除（赤字の印の人だけ打つ）・書き換え（光と闇の弱点が入れ替わる））
  //   ＋軽い手（白い本（沈黙・強化を消す）・赤字（回復役に印）・写し手を呼ぶ・紙の盾）。ためらい（setup.hesitate）は battle_core のまま
  set('b_lazaro', { actsPerTurn: 2, actions: A([['eb_silver_quill', 3, HV], ['eb_erase_memory', 2, HV], ['eb_lazaro_redact', 8, { every: [2, 0], flag: 'lazaro_mark' }],
    ['eb_lazaro_rewrite', 3, { every: [2, 0], hpBelow: 0.6, once: true }],
    ['attack', 1, LT], ['eb_white_book', 2, LT], ['eb_lazaro_annotate', 2, { every: [2, 1], noFlag: 'lazaro_mark' }], ['eb_call_scribes', 1, { every: [2, 1], countBelow: 3 }],
    ['eb_page_shield', 3, { every: [2, 1], hpBelow: 0.7, once: true }]]),
  phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_lazaro.phases.0.msg'), set: { buffs: { mag: 1, agi: 1 } } }] });
  // 虚ろの王: 重い手（紙の手・空白の嵐・白い闇（強化を消す））＋軽い手（忘却の波（MP・沈黙）・名消し（沈黙・攻めを下げる）・白い子守歌（眠り）・名を拾う（品を奪う））
  set('b_nemrea1', { actions: A([['eb_paper_hand', 3, HV], ['eb_blank_storm', 2, HV], ['eb_whiteout', 2, HV],
    ['attack', 1, LT], ['eb_oblivion_wave', 2, LT], ['eb_erase_name', 2, LT], ['eb_nemrea_lull', 1, { every: [2, 1], round: 2 }], ['eb_nemrea_snatch', 1, { every: [2, 1], round: 2 }]]),
  onDeath: 'boss_return' });
  // ネムレア: 1 ラウンドに 3 回（重い手・中の手・軽い手）。重い手（書き消し・八つの伝承・忘却の息・物語を閉じる（印の人だけ打つ））、
  //   中の手（結末の予約（印）・頁返し（光と闇の弱点が入れ替わる）・夢の眠り）、軽い手（ふつうの攻撃・忘却の息・書き直し（1 度だけ回復））
  const N0 = { every: [3, 0] }, N1 = { every: [3, 1] }, N2 = { every: [3, 2] };
  set('b_nemrea2', { actions: A([['eb_unwrite', 3, N0], ['eb_eight_legends', 2, N0], ['eb_oblivion_breath', 1, N0], ['eb_nemrea2_close', 8, { every: [3, 0], flag: 'nemrea_mark' }],
    ['eb_nemrea2_mark', 2, { every: [3, 1], noFlag: 'nemrea_mark' }], ['eb_nemrea2_page', 1, { every: [3, 1], noFlag: 'nemrea_dark' }], ['eb_nemrea2_page2', 1, { every: [3, 1], flag: 'nemrea_dark' }],
    ['eb_dream_sleep', 1, { every: [3, 1], round: 2 }], ['eb_oblivion_breath', 1, N1],
    ['attack', 2, N2], ['eb_oblivion_breath', 1, N2], ['eb_nemrea_rewrite', 3, { every: [3, 2], hpBelow: 0.3, once: true }]]) });
  // クリア後: 魔王の残影に 恐れの残響（混乱・魔力を下げる）・魂吸い（HP と MP）、円環竜に 尾の刻印（印）→ 輪の終わり（印の人だけ打つ）
  Object.assign(R.DB.bossActions, {
    eb_echo_dread: { name: R.T('bossActions.eb_echo_dread.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'status', status: 'confuse', chance: 0.25 }, { type: 'buff', stat: 'mag', stages: -1, chance: 0.4 }], fx: 'dark2', msg: R.T('bossActions.eb_echo_dread.msg') },
    // 闇の帳（持ち主 2026-10-05「凍てつく波動系のバフを消すやつ」）: 味方の強化を全部消す。円環竜の巻き戻しより少なめ（5 ラウンドごと、強化が 6 段以上たまったら 3 ラウンドで）
    eb_echo_shroud: { name: R.T('bossActions.eb_echo_shroud.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'dispel', side: 'good' }], fx: 'dark2', msg: R.T('bossActions.eb_echo_shroud.msg') },
    eb_echo_soul: { name: R.T('bossActions.eb_echo_soul.name'), kind: 'enemy', target: 'enemy', aim: 'caster', effects: [{ type: 'damage', formula: 'magic', power: 1.0, element: 'dark', drain: 0.5 }, { type: 'damage', formula: 'magic', power: 0.6, mp: true }], fx: 'drain', msg: R.T('bossActions.eb_echo_soul.msg') },
    eb_ouro_mark: { name: R.T('bossActions.eb_ouro_mark.name'), kind: 'enemy', target: 'enemy', aim: 'strong', effects: [{ type: 'special', id: 'boss_mark', flag: 'ouro_mark', pct: 0.35, guardPct: 0.08 }], fx: 'magic', msg: R.T('bossActions.eb_ouro_mark.msg') },
    eb_ouro_end: { name: R.T('bossActions.eb_ouro_end.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'boss_mark_burst', flag: 'ouro_mark', kind: 'magic' }], fx: 'magic3', msg: R.T('bossActions.eb_ouro_end.msg') },
  });
  if (L.b_valzard_echo) L.b_valzard_echo.actions = L.b_valzard_echo.actions.concat(A([['eb_echo_dread', 1, { round: 2 }], ['eb_echo_soul', 2], ['eb_echo_shroud', 200, { roundGap: 5 }], ['eb_echo_shroud', 200, { roundGap: 3, foeBuffsAtLeast: 6 }]]));
  if (L.b_ouroboros) L.b_ouroboros.actions = L.b_ouroboros.actions.concat(A([['eb_ouro_mark', 2, { every: [3, 2], noFlag: 'ouro_mark' }], ['eb_ouro_end', 8, { every: [3, 0], flag: 'ouro_mark' }]]));
  R.defs('enemyCombos', {
    // 三英雄の再演: 祈りの影が剣の影に加護をかけ、杖の影の星が降り、剣の影が弱った人を斬る
    c_b_three_heroes: { name: R.T('enemyCombos.c_b_three_heroes.name'), members: [{ mon: 'b_shade_sword' }, { mon: 'b_shade_prayer' }, { mon: 'b_shade_star' }],
      steps: [{ by: 1, act: 'e_veil_ally', to: 0 }, { by: 2, act: 'eb_shade_meteor' }, { by: 0, act: 'eb_shade_blade', aim: 'low', seq: 'sq:ec_cross_slash' }], round: 3, chance: 0.4, max: 1 },
    // 写しの赤字: 写し手が墨で目をくらませ、ラザロが同じ人へ銀のペン
    c_b_lazaro_scribes: { name: R.T('enemyCombos.c_b_lazaro_scribes.name'), members: [{ mon: 'b_lazaro' }, { mon: 'scribe_1' }],
      steps: [{ by: 1, act: 'e_ink' }, { by: 0, act: 'eb_silver_quill', aim: 'low', seq: 'sq:s_light_dark_a' }], round: 2, chance: 0.35, cd: 3 },
  });
  // 予告のぶん戦いが長くなるので HP を詰める。ネムレアは 3 回動くので、予告の無い手の重さを下げる（台本が 74% だった）。影は剣の影だけ少し軽く（11.1 ラウンド）
  const S = { b_bookgolem: { hp: 0.45 }, b_lazaro: { hp: 0.68 }, b_nemrea1: { hp: 0.5 }, b_nemrea2: { atk: 0.62, mag: 0.62 }, b_shade_sword: { hp: 0.85 } };
  for (const id of Object.keys(S)) if (L[id]) L[id].s = Object.assign({}, L[id].s || {}, S[id]);
})(window.RPG);
