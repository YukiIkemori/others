// ライバル ロウェルの 2 戦の予告（BATTLE の形。地方・終盤のボスと同じ「予告 → 守らないと最大 HP の大半」の考えどころ）。
//   負けても物語は続く戦い（T2・T5）なので、答えは「守る」ひとつだけ。数値は tools/sim_bosses.js の中ボスの目安（ティア 2・5）で合わせた。
//   ロウェル b_rowell1・b_rowell2: 銀のペン先に記録の光を集める（予告）→ 次の手番に記録の断罪（全体。守る）。
(function (R) {
  'use strict';
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const L = R.DB.monsters;
  // 文は i18n の表（bossActions.<id>.*）。キーは書いたままの形で（test_i18n がキーを拾う）
  Object.assign(R.DB.bossActions, {
    eb_rowell_gather: { name: R.T('bossActions.eb_rowell_gather.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_rowell_gather.msg'),
      telegraph: { text: R.T('bossActions.eb_rowell_gather.telegraph.text'), pose: 'tele', tint: '#f4ecd0', next: 'eb_rowell_verdict', guard: 'defend', lethal: true } },
    eb_rowell_verdict: { name: R.T('bossActions.eb_rowell_verdict.name'), kind: 'enemy', target: 'enemies',
      effects: [{ type: 'special', id: 'desert_sweep', pct: 0.85, guardPct: 0.08, kind: 'light', element: 'light' }], fx: 'holy2', msg: R.T('bossActions.eb_rowell_verdict.msg') },
  });
  // every は魔物の手番の数え（1 戦目は 1 回、2 戦目は 2 回動く）: どちらもおよそ 3 ラウンドに 1 度の予告
  const add = (id, every) => { const d = L[id]; if (d && d.actions) d.actions = d.actions.concat(A([['eb_rowell_gather', 200, { every }]])); };
  add('b_rowell1', [3, 0]);   // 1 戦目は最初の手番から予告（守りを覚える戦い）
  add('b_rowell2', [6, 2]);
  // 予告のぶん戦いが長くなるので、2 戦目の HP を少し下げる（1 戦目は bosses.js のまま）
  const S = { b_rowell2: { hp: 1.1 } };
  for (const id of Object.keys(S)) if (L[id]) L[id].s = Object.assign({}, L[id].s || {}, S[id]);
})(window.RPG);
