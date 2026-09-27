// 雪原の出現表（BATTLE の形。WORLD_REDESIGN §4.3・§2.2、V2_PLAN §3.6）。組は今の表（encounters.js の zw_snow・z_r_snow_peak、
// A11 の調整済み）を写し、場所ごとに lvOff・率・戦闘背景 'snow' を変える。レア魔物は rare_encounters と同じ形で足す。
//   zw_snow        雪原の原野（ワールド）           zw_snow_road  雪原の街道（率 0.3）
//   z_snow_woods   雪の林（薪集め。ダンジョンより軽い）  z_snow_peak   白竜の峰
//   z_snow_icicle  つららの回廊（寄り道、+1）         z_snow_floe   北の流氷原（オーロラの崖・氷に閉じた帆船）
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
  if (W) W.bg = 'snow';
  if (P) P.bg = 'snow';
  Object.assign(E, {
    zw_snow_road: clone(W, { rate: 0.3, bg: 'snow' }),
    z_snow_woods: clone(W, { lvOff: 0, bg: 'snow' }),
    z_snow_peak: lessYeti(clone(P, { lvOff: 0, bg: 'snow' })),
    z_snow_icicle: lessYeti(clone(P, { lvOff: 1, bg: 'snow' })),
    z_snow_floe: clone(W, { lvOff: 0, bg: 'snow' }),
  });
  // 籠城の門の戦い（troops_snow.js）と同じ地方の印
  Object.assign(R.DB.rareEncounters, {
    zw_snow_road: { mon: 'rm_icetail_fox', rate: 120 },
    z_snow_woods: { mon: 'rm_aurora_bird', rate: 80 },
    z_snow_peak: { mon: 'rm_icetail_fox', rate: 140 },
    z_snow_icicle: { mon: 'rm_icetail_fox', rate: 120 },
    // オーロラの崖（#12）は氷尾ギツネとオーロラ鳥の巣
    z_snow_floe: [{ mon: 'rm_aurora_bird', rate: 30, cond: 'snow_aurora_seen' }, { mon: 'rm_icetail_fox', rate: 120 }],
  });
})(window.RPG);
