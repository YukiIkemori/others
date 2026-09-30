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
  // every は魔物の手番の数え（2 回・3 回動くボスは 1 ラウンドに 2・3 手番）: どれもおよそ 2〜4 ラウンドに 1 度の予告にする
  const add = (id, act, every) => { const d = L[id]; if (d && d.actions) d.actions = d.actions.concat(A([[act, SCHED, { every }]])); };
  add('b_bookgolem', 'eb_golem_stack', [4, 1]);
  add('b_lazaro', 'eb_lazaro_raise', [4, 1]);
  add('b_nemrea1', 'eb_nemrea_gather', [6, 2]);
  add('b_nemrea2', 'eb_nemrea2_open', [12, 5]);
  // 予告のぶん戦いが長くなるので HP を詰める。ネムレアは 3 回動くので、予告の無い手の重さを下げる（台本が 74% だった）。影は剣の影だけ少し軽く（11.1 ラウンド）
  const S = { b_bookgolem: { hp: 0.45 }, b_lazaro: { hp: 0.68 }, b_nemrea1: { hp: 0.5 }, b_nemrea2: { atk: 0.62, mag: 0.62 }, b_shade_sword: { hp: 0.85 } };
  for (const id of Object.keys(S)) if (L[id]) L[id].s = Object.assign({}, L[id].s || {}, S[id]);
})(window.RPG);
