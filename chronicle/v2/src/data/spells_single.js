// （RULES。今の木の src/data/spells_single.js から「そのまま」移した。tools/port/port_techs.js）
// 術: 単属性 27（火・光・闇 1〜5段、水・風・土 1・2・3・5段）。DESIGN §7.6.1・§7.7 CODE 1 が正本。
// 組み立て関数 sp() は 3 つの spells_*.js の先頭に同じものを置く（§7.2.3。ファイルどうしで共有しない）。
(function (R) {
  'use strict';
  const EL = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const GLIM = { 1: [1, 1], 2: [2, 4], 3: [3, 10], 4: [5, 19], 5: [7, 32], A: [4, 14], B: [6, 25], T: [8, 34] };   // [glim.lv, glim.prof]（熟練度の段階 1〜100。SYSTEMS_REWORK §1.4）
  const PAIRS = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) PAIRS.push(EL[i] + '_' + EL[j]);
  const TRIPLES = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++) TRIPLES.push([EL[i], EL[j], EL[k]].join('_'));
  const dmg = (power, o) => Object.assign({ type: 'damage', formula: 'magic', power }, o || {});
  const pct = (power) => ({ type: 'damage', formula: 'percent', power });
  const st = (status, chance) => (chance == null ? { type: 'status', status } : { type: 'status', status, chance });
  const buff = (stat, stages, chance) => (chance == null ? { type: 'buff', stat, stages } : { type: 'buff', stat, stages, chance });
  const heal = (p) => ({ type: 'heal', pct: p });
  const revive = (p) => ({ type: 'revive', pct: p });
  const cure = (s) => ({ type: 'cure', statuses: s });
  const dispel = (side) => ({ type: 'dispel', side });
  const enc = (p, steps, weakOnly) => (weakOnly ? { type: 'encounter', pct: p, steps, weakOnly: true } : { type: 'encounter', pct: p, steps });
  const onAllies = (e) => Object.assign({}, e, { on: 'allies' });
  // cls: '1'..'5' = 単属性の段、'A' / 'B' = 2属性、'T' = 3属性
  function sp(name, elements, cls, mp, target, effects, fx, desc, o) {
    const [lv, prof] = GLIM[cls];
    const key = elements.join('_');
    const order = elements.length === 1 ? 10 * (EL.indexOf(elements[0]) + 1) + Number(cls)
      : elements.length === 2 ? 100 + 2 * PAIRS.indexOf(key) + (cls === 'A' ? 0 : 1)
      : 200 + TRIPLES.indexOf(key);
    const a = { kind: 'spell', magic: true, name, desc, elements, mp, target, effects, fx,
      cls: elements.length === 1 ? 'single' : elements.length === 3 ? 'triple' : cls === 'A' ? 'comboA' : 'comboB',
      glim: { lv, prof }, rank: lv, order };
    if (elements.length === 1) a.step = Number(cls);
    const r = Object.assign(a, o || {});
    if (Array.isArray(r.fx)) { r.fxs = r.fx; r.fx = r.fx[0]; }
    return r;
  }
  R.defs('spells', {
    // 2026-10-04 属性の見直し（持ち主「炎魔法強すぎて他を覚える必要性が感じられない」）: 火の 1・2・4・5 段を少し下げる。
    //   火だけが段 2 で全体を打てるので、段 2 は MP 5 → 6・威力 1.0 → 0.9。段 1 は 1.4 → 1.3（水と同じ）。段 4 は MP 9 → 10。段 5 は 3.4 → 3.2
    s_fire_1: sp(R.T('spells.s_fire_1.sp'), ['fire'], '1', 2, 'enemy',
      [dmg(1.3)], 'fire1',
      R.T('spells.s_fire_1.sp_2')),
    s_fire_2: sp(R.T('spells.s_fire_2.sp'), ['fire'], '2', 6, 'enemies',
      [dmg(0.9), st('burn', 0.2)], 'fire2',
      R.T('spells.s_fire_2.sp_2')),
    s_fire_3: sp(R.T('spells.s_fire_3.sp'), ['fire'], '3', 6, 'allies',
      [buff('atk', 1)], 'buff',
      R.T('spells.s_fire_3.sp_2')),
    s_fire_4: sp(R.T('spells.s_fire_4.sp'), ['fire'], '4', 10, 'enemies',
      [dmg(1.5), st('burn', 0.3)], 'fire2',
      R.T('spells.s_fire_4.sp_2')),
    s_fire_5: sp(R.T('spells.s_fire_5.sp'), ['fire'], '5', 12, 'enemy',
      [dmg(3.2), st('burn', 0.5)], 'fire3',
      R.T('spells.s_fire_5.sp_2')),
    s_water_1: sp(R.T('spells.s_water_1.sp'), ['water'], '1', 2, 'enemy',
      [dmg(1.3)], 'water1',
      R.T('spells.s_water_1.sp_2')),
    // 清めの水: 状態異常だけ（持ち主 2026-09-28「HP 回復いらない、状態異常だけ」）
    s_water_2: sp(R.T('spells.s_water_2.sp'), ['water'], '2', 4, 'ally',
      [cure('all')], 'cure',
      R.T('spells.s_water_2.sp_2'), { field: true }),
    // 水・土にもひだまり相当の小さな回復（持ち主 2026-09-28）。段 1・MP 3・1人 35%
    s_water_1h: sp(R.T('spells.s_water_1h.sp'), ['water'], '1', 3, 'ally',
      [heal(0.35)], 'heal',
      R.T('spells.s_water_1h.sp_2'), { field: true }),
    s_water_3: sp(R.T('spells.s_water_3.sp'), ['water'], '3', 5, 'allies',
      [buff('mdef', 1)], 'buff',
      R.T('spells.s_water_3.sp_2')),
    s_water_5: sp(R.T('spells.s_water_5.sp'), ['water'], '5', 11, 'enemies',
      [dmg(1.6), buff('agi', -1, 0.5)], 'water3',
      R.T('spells.s_water_5.sp_2')),
    s_wind_1: sp(R.T('spells.s_wind_1.sp'), ['wind'], '1', 2, 'enemy',
      [dmg(1.2)], 'wind1',
      R.T('spells.s_wind_1.sp_2'), { quick: true }),
    s_wind_2: sp(R.T('spells.s_wind_2.sp'), ['wind'], '2', 4, 'ally',
      [st('nimble'), buff('agi', 1)], 'buff',
      R.T('spells.s_wind_2.sp_2')),
    s_wind_3: sp(R.T('spells.s_wind_3.sp'), ['wind'], '3', 7, 'random',
      [dmg(0.55, { hits: 4 }), st('silence', 0.15)], 'wind2',
      R.T('spells.s_wind_3.sp_2')),
    s_wind_5: sp(R.T('spells.s_wind_5.sp'), ['wind'], '5', 11, 'enemies',
      [dmg(0.55, { hits: 3 }), st('silence', 0.35)], 'wind3',
      R.T('spells.s_wind_5.sp_2')),
    s_earth_1: sp(R.T('spells.s_earth_1.sp'), ['earth'], '1', 2, 'enemy',
      [dmg(1.2), st('stun', 0.15)], 'earth1',
      R.T('spells.s_earth_1.sp_2')),
    s_earth_1h: sp(R.T('spells.s_earth_1h.sp'), ['earth'], '1', 3, 'ally',
      [heal(0.35)], 'heal',
      R.T('spells.s_earth_1h.sp_2'), { field: true }),
    s_earth_2: sp(R.T('spells.s_earth_2.sp'), ['earth'], '2', 3, 'ally',
      [buff('def', 1), st('counter')], 'buff',
      R.T('spells.s_earth_2.sp_2')),
    s_earth_3: sp(R.T('spells.s_earth_3.sp'), ['earth'], '3', 6, 'enemies',
      [dmg(1.0), st('stun', 0.25)], 'earth2',
      R.T('spells.s_earth_3.sp_2')),
    s_earth_5: sp(R.T('spells.s_earth_5.sp'), ['earth'], '5', 12, 'enemies',
      [dmg(1.5), st('paralyze', 0.3), onAllies(buff('def', 1))], 'earth3',
      R.T('spells.s_earth_5.sp_2')),
    s_light_1: sp(R.T('spells.s_light_1.sp'), ['light'], '1', 3, 'ally',
      [heal(0.35)], 'heal',
      R.T('spells.s_light_1.sp_2'), { field: true }),
    s_light_2: sp(R.T('spells.s_light_2.sp'), ['light'], '2', 4, 'enemy',
      [dmg(1.5), st('blind', 0.2)], 'holy',
      R.T('spells.s_light_2.sp_2')),
    s_light_3: sp(R.T('spells.s_light_3.sp'), ['light'], '3', 7, 'allies',
      [heal(0.3)], 'heal',
      R.T('spells.s_light_3.sp_2'), { field: true }),
    s_light_4: sp(R.T('spells.s_light_4.sp'), ['light'], '4', 7, 'ally_dead',
      [revive(0.3)], 'revive',
      R.T('spells.s_light_4.sp_2'), { field: true }),
    s_light_5: sp(R.T('spells.s_light_5.sp'), ['light'], '5', 12, 'allies',
      [heal(0.6), st('veil')], 'heal',
      R.T('spells.s_light_5.sp_2'), { field: true }),
    s_dark_1: sp(R.T('spells.s_dark_1.sp'), ['dark'], '1', 2, 'enemy',
      [dmg(1.2, { drain: 0.3 })], 'dark1',
      R.T('spells.s_dark_1.sp_2')),
    s_dark_2: sp(R.T('spells.s_dark_2.sp'), ['dark'], '2', 4, 'enemies',
      [st('sleep', 0.35)], 'sleep',
      R.T('spells.s_dark_2.sp_2')),
    s_dark_3: sp(R.T('spells.s_dark_3.sp'), ['dark'], '3', 7, 'enemies',
      [buff('atk', -1), buff('mag', -1)], 'debuff',
      R.T('spells.s_dark_3.sp_2')),
    s_dark_4: sp(R.T('spells.s_dark_4.sp'), ['dark'], '4', 8, 'enemy',
      [dmg(2.2, { drain: 0.5 })], 'drain',
      R.T('spells.s_dark_4.sp_2')),
    s_dark_5: sp(R.T('spells.s_dark_5.sp'), ['dark'], '5', 12, 'enemies',
      [st('death', 0.3), dmg(1.2)], 'death',
      R.T('spells.s_dark_5.sp_2')),
  });
})(window.RPG);
