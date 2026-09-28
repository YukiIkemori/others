// 雪原の出現表（BATTLE の形。WORLD_REDESIGN §4.3・§2.2、V2_PLAN §3.6）。組は今の表（encounters.js の zw_snow・z_r_snow_peak、
// A11 の調整済み）を写し、場所ごとに lvOff・率・戦闘背景 'snow' を変える。レア魔物は rare_encounters と同じ形で足す。
//   zw_snow        雪原の原野（ワールド）           zw_snow_road  雪原の街道（率 0.3）
//   z_snow_woods   雪の林（薪集め。ダンジョンより軽い）  z_snow_peak   白竜の峰
//   z_snow_icicle  つららの回廊（寄り道。強めの一行 mid で見る）         z_snow_floe   北の流氷原（オーロラの崖）
//   z_snow_peak_high 峰の上の段   z_snow_icicle_deep 回廊の 2 階   z_snow_ship 氷に閉じた帆船（奥: 1 組 5 匹まで）
(function (R) {
  'use strict';
  const E = R.DB.encounters;
  const clone = (z, o) => Object.assign({}, z, { groups: z.groups.map((g) => Object.assign({}, g, { mons: g.mons.map((m) => m.slice()) })) }, o);
  const W = E.zw_snow, P = E.z_r_snow_peak;
  // 雪男の組は重い（p95 が上がる）ので、ダンジョンの写しでは重みを半分にする
  const lessYeti = (z) => {
    for (const g of z.groups) if (g.mons.some((m) => m[0] === '@yeti')) { g.w = g.w / 2; for (const m of g.mons) if (m[0] !== '@yeti') m[2] = Math.min(m[2], 2); }
    return z;
  };
  // 雪ん子（frostling）の群れは 4 匹だと重い（p95 が 20% を超える）ので、雪原の表では 3 匹まで（sim_zones で合わせた）
  for (const z of [W, P]) if (z) for (const g of z.groups) for (const m of g.mons) if (m[0] === '@frostling') m[2] = Math.min(m[2], g.mons.length > 1 ? 1 : 3);
  if (W) W.bg = 'snow';
  if (P) P.bg = 'snow';
  // 雪原のダンジョンの 1 組の数（持ち主 2026-09-28「ダンジョンの敵は体験版以降は4匹でも5匹でもいいよ。バランスみてね」）。
  //   雪原は縦切り（体験版）の外なので、入口に近い所は 4 匹まで、奥（峰の上の段・回廊の 2 階・帆船）は 5 匹まで。
  //   多い組は、いちばん多い魔物から 1 匹ずつ減らす（最小の数は 1 まで。組の最小の合計は cap − 2 まで、ただし 2 以上）。
  //   数と重みは tools/sim_zones.js（T1 の標準の一行）と --segments で合わせた（HP の減り 8〜12%・p95 ≤ 20%）
  const small = (z, cap) => {
    const minCap = Math.max(2, cap - 2);
    for (const g of z.groups) {
      const tot = (i) => g.mons.reduce((a, m) => a + m[i], 0);
      while (tot(2) > cap) { const m = g.mons.reduce((a, b) => (b[2] > a[2] ? b : a)); m[2] -= 1; if (m[1] > m[2]) m[1] = m[2]; }
      while (tot(1) > minCap) { const m = g.mons.reduce((a, b) => (b[1] > a[1] ? b : a)); if (m[1] <= 1) break; m[1] -= 1; }
    }
    return z;
  };
  // 奥だけの混ざった組（どのティアでも。重みは sim_zones で合わせた）
  const more = (z, list) => { for (const [w, mons] of list) z.groups.push({ w, mons }); return z; };
  // 組の重みを掛ける（key = 組の系統を + でつないだ物。例 'owl+wolf'）。重い組を少し減らして p95 を 20% の内に
  const reweigh = (z, map) => { for (const g of z.groups) { const k = g.mons.map((m) => m[0].slice(1)).join('+'); if (map[k] != null) g.w *= map[k]; } return z; };
  // 雪の林は雪原の最初のダンジョンで軽め: 4 匹になるのはオオカミとフクロウの群れだけ（雪ん子の混ざる組は 3 匹まで）
  const woods = (z) => { for (const g of z.groups) if (g.mons.length > 1 && g.mons.some((m) => m[0] === '@frostling')) for (const m of g.mons) if (m[0] !== '@frostling') m[2] = Math.min(m[2], 2); return reweigh(z, { frostling: 0.8 }); };
  Object.assign(E, {
    zw_snow_road: clone(W, { rate: 0.3, bg: 'snow' }),
    z_snow_woods: woods(small(clone(W, { lvOff: 0, bg: 'snow' }), 4)),
    z_snow_peak: small(lessYeti(clone(P, { lvOff: 0, bg: 'snow' })), 4),
    // 峰の上の段（氷の壁 2 の先・西の岩棚・巨人の氷壁の前）
    z_snow_peak_high: more(reweigh(small(lessYeti(clone(P, { lvOff: 0, bg: 'snow' })), 5), { 'owl+wolf': 0.7 }), [
      [4, [['@wolf', 2, 3], ['@owl', 1, 1]]],
      [3, [['@frostling', 1, 1], ['@bat', 2, 3]]],
    ]),
    z_snow_icicle: small(lessYeti(clone(P, { lvOff: 0, bg: 'snow' })), 4),
    // 回廊の 2 階（暗がり）
    z_snow_icicle_deep: more(reweigh(small(lessYeti(clone(P, { lvOff: 0, bg: 'snow' })), 5), { 'owl+wolf': 0.7 }), [
      [4, [['@bat', 2, 3], ['@frostling', 1, 1]]],
      [3, [['@owl', 2, 2], ['@frostling', 1, 1]]],
    ]),
    z_snow_floe: woods(small(clone(W, { lvOff: 0, bg: 'snow' }), 4)),
    // 氷に閉じた帆船（甲板・船倉）
    z_snow_ship: more(reweigh(small(clone(W, { lvOff: 0, bg: 'snow' }), 5), { 'wolf+frostling': 0.7 }), [
      [3, [['@wolf', 2, 3], ['@frostling', 1, 1]]],
      [4, [['@mammoth', 1, 1], ['@wolf', 1, 2]]],
    ]),
  });
  // 籠城の門の戦い（troops_snow.js）と同じ地方の印
  Object.assign(R.DB.rareEncounters, {
    zw_snow_road: { mon: 'rm_icetail_fox', rate: 120 },
    z_snow_woods: { mon: 'rm_aurora_bird', rate: 80 },
    z_snow_peak: { mon: 'rm_icetail_fox', rate: 140 },
    z_snow_peak_high: { mon: 'rm_icetail_fox', rate: 140 },
    z_snow_icicle: { mon: 'rm_icetail_fox', rate: 120 },
    z_snow_icicle_deep: { mon: 'rm_icetail_fox', rate: 120 },
    z_snow_ship: { mon: 'rm_icetail_fox', rate: 140 },
    // オーロラの崖（#12）は氷尾ギツネとオーロラ鳥の巣
    z_snow_floe: [{ mon: 'rm_aurora_bird', rate: 30, cond: 'snow_aurora_seen' }, { mon: 'rm_icetail_fox', rate: 120 }],
  });
})(window.RPG);
