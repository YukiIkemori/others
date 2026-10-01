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
      effects: [{ type: 'special', id: 'desert_sweep', pct: 0.4, guardPct: 0.08, kind: 'light', element: 'light' }], fx: 'holy2', msg: R.T('bossActions.eb_rowell_verdict.msg') },
    // 2026-10-01（ボスの組み直し）: 2 戦目は溜めをやめ、記録官らしい「注釈 → 抹消」（時間差の呪い。印の人だけ最大 HP の 3 割、守れば 1 割弱）
    eb_rowell_annotate: { name: R.T('bossActions.eb_rowell_annotate.name'), kind: 'enemy', target: 'enemy', aim: 'healer', effects: [{ type: 'damage', formula: 'phys', power: 0.7, kind: 'pierce' }, { type: 'special', id: 'boss_mark', flag: 'rowell_mark', pct: 0.3, guardPct: 0.08 }], fx: 'pierce', msg: R.T('bossActions.eb_rowell_annotate.msg') },
    eb_rowell_redact: { name: R.T('bossActions.eb_rowell_redact.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'boss_mark_burst', flag: 'rowell_mark', kind: 'magic', element: 'light' }], fx: 'holy2', msg: R.T('bossActions.eb_rowell_redact.msg') },
  });
  // every は魔物の手番の数え（1 戦目は 1 回、2 戦目は 2 回動く）: どちらもおよそ 3 ラウンドに 1 度の予告
  const add = (id, every) => { const d = L[id]; if (d && d.actions) d.actions = d.actions.concat(A([['eb_rowell_gather', 200, { every }]])); };
  // 2026-10-01（ボスの組み直し）: 1 戦目は序盤の教える戦いなので、光を集める構え（予告、断罪は最大 HP の 4 割）を残す。ただし 3 手番ごとの決まりはやめ、たまに
  { const d = L.b_rowell1; if (d && d.actions) d.actions = d.actions.concat(A([['eb_rowell_gather', 3, { every: [3, 1], round: 2 }]])); }
  // 2 戦目（ティア 5、中盤）: 1 ラウンドに重い手 1 つ（突き・連続突き・抹消）＋軽い手 1 つ（写し取る・白紙・記録の光・注釈）。溜めはなし
  {
    const d = L.b_rowell2, HV = { every: [2, 0] }, LT = { every: [2, 1] };
    // 注釈（印）は軽い手、抹消は次のラウンドの重い手（間に一行の手番が入る）
    if (d) d.actions = A([['eb_silver_thrust', 3, HV], ['eb_pen_flurry', 2, HV], ['eb_rowell_redact', 8, { every: [2, 0], flag: 'rowell_mark' }],
      ['eb_copy_power', 1, LT], ['eb_white_page', 1, LT], ['eb_record_light', 2, LT], ['eb_rowell_annotate', 2, { every: [2, 1], noFlag: 'rowell_mark' }]]);
  }
  // 予告のぶん戦いが長くなるので、2 戦目の HP を少し下げる（1 戦目は bosses.js のまま）
  const S = { b_rowell2: { hp: 1.1 } };
  for (const id of Object.keys(S)) if (L[id]) L[id].s = Object.assign({}, L[id].s || {}, S[id]);
})(window.RPG);
