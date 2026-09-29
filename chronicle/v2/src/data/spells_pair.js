// （RULES。今の木の src/data/spells_pair.js から「そのまま」移した。tools/port/port_techs.js）
// 術: 2属性の合成 30（15組 × 合成A・合成B）。DESIGN §7.6.2・§7.7 CODE 2 が正本。
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
    s_fire_water_a: sp(R.T('spells.s_fire_water_a.sp'), ['fire', 'water'], 'A', 9, 'enemies',
      [dmg(1.4), st('burn', 0.3), buff('agi', -1, 0.3)], ['water2', 'fire2'],
      R.T('spells.s_fire_water_a.sp_2')),
    s_fire_water_b: sp(R.T('spells.s_fire_water_b.sp'), ['fire', 'water'], 'B', 11, 'allies',
      [st('regen'), buff('atk', 1)], ['regen', 'buff'],
      R.T('spells.s_fire_water_b.sp_2')),
    s_fire_wind_a: sp(R.T('spells.s_fire_wind_a.sp'), ['fire', 'wind'], 'A', 9, 'enemies',
      [dmg(1.35), st('burn', 0.3)], ['wind2', 'fire2'],
      R.T('spells.s_fire_wind_a.sp_2'), { quick: true }),
    s_fire_wind_b: sp(R.T('spells.s_fire_wind_b.sp'), ['fire', 'wind'], 'B', 13, 'random',
      [dmg(0.75, { hits: 5 }), st('burn', 0.15)], ['wind1', 'fire1'],
      R.T('spells.s_fire_wind_b.sp_2')),
    s_fire_earth_a: sp(R.T('spells.s_fire_earth_a.sp'), ['fire', 'earth'], 'A', 8, 'enemy',
      [dmg(2.6), st('stun', 0.3)], ['earth2', 'fire2'],
      R.T('spells.s_fire_earth_a.sp_2')),
    s_fire_earth_b: sp(R.T('spells.s_fire_earth_b.sp'), ['fire', 'earth'], 'B', 11, 'allies',
      [buff('atk', 1), buff('def', 1)], ['buff', 'buff'],
      R.T('spells.s_fire_earth_b.sp_2')),
    s_fire_light_a: sp(R.T('spells.s_fire_light_a.sp'), ['fire', 'light'], 'A', 9, 'enemies',
      [dmg(1.45), st('blind', 0.3)], ['holy', 'fire2'],
      R.T('spells.s_fire_light_a.sp_2')),
    s_fire_light_b: sp(R.T('spells.s_fire_light_b.sp'), ['fire', 'light'], 'B', 11, 'allies',
      [buff('atk', 1), st('regen')], ['buff', 'regen'],
      R.T('spells.s_fire_light_b.sp_2')),
    s_fire_dark_a: sp(R.T('spells.s_fire_dark_a.sp'), ['fire', 'dark'], 'A', 8, 'enemy',
      [dmg(2.4, { drain: 0.3 }), st('burn', 0.3)], ['dark1', 'fire1'],
      R.T('spells.s_fire_dark_a.sp_2'), { field: true, fieldEffects: [enc(100, 100)] }),
    s_fire_dark_b: sp(R.T('spells.s_fire_dark_b.sp'), ['fire', 'dark'], 'B', 13, 'enemies',
      [dmg(1.8), st('burn', 0.4), buff('mdef', -1, 0.4)], ['dark2', 'fire3'],
      R.T('spells.s_fire_dark_b.sp_2')),
    s_water_wind_a: sp(R.T('spells.s_water_wind_a.sp'), ['water', 'wind'], 'A', 9, 'enemies',
      [dmg(1.45), st('freeze', 0.3)], ['wind2', 'ice2'],
      R.T('spells.s_water_wind_a.sp_2')),
    s_water_wind_b: sp(R.T('spells.s_water_wind_b.sp'), ['water', 'wind'], 'B', 13, 'enemy',
      [dmg(3.4), st('freeze', 0.4)], ['wind1', 'ice3'],
      R.T('spells.s_water_wind_b.sp_2')),
    s_water_earth_a: sp(R.T('spells.s_water_earth_a.sp'), ['water', 'earth'], 'A', 8, 'enemies',
      [buff('agi', -1), st('paralyze', 0.3)], ['water1', 'earth1'],
      R.T('spells.s_water_earth_a.sp_2')),
    s_water_earth_b: sp(R.T('spells.s_water_earth_b.sp'), ['water', 'earth'], 'B', 10, 'allies',
      [buff('def', 1), buff('mdef', 1)], ['water1', 'buff'],
      R.T('spells.s_water_earth_b.sp_2')),
    s_water_light_a: sp(R.T('spells.s_water_light_a.sp'), ['water', 'light'], 'A', 8, 'allies',
      [heal(0.25), st('regen')], ['water1', 'heal'],
      R.T('spells.s_water_light_a.sp_2'), { field: true }),
    s_water_light_b: sp(R.T('spells.s_water_light_b.sp'), ['water', 'light'], 'B', 11, 'allies',
      [heal(0.45), cure('all')], ['cure', 'heal'],
      R.T('spells.s_water_light_b.sp_2'), { field: true }),
    s_water_dark_a: sp(R.T('spells.s_water_dark_a.sp'), ['water', 'dark'], 'A', 9, 'enemies',
      [dmg(1.35), st('poison', 0.35)], ['water2', 'poison'],
      R.T('spells.s_water_dark_a.sp_2')),
    s_water_dark_b: sp(R.T('spells.s_water_dark_b.sp'), ['water', 'dark'], 'B', 13, 'enemy',
      [dmg(3.2, { drain: 0.3 }), buff('agi', -1, 0.5)], ['water3', 'drain'],
      R.T('spells.s_water_dark_b.sp_2')),
    s_wind_earth_a: sp(R.T('spells.s_wind_earth_a.sp'), ['wind', 'earth'], 'A', 9, 'enemies',
      [dmg(0.72, { hits: 2 }), st('stun', 0.3)], ['wind2', 'earth1'],
      R.T('spells.s_wind_earth_a.sp_2')),
    s_wind_earth_b: sp(R.T('spells.s_wind_earth_b.sp'), ['wind', 'earth'], 'B', 10, 'allies',
      [buff('def', 1), buff('agi', 1)], ['wind1', 'buff'],
      R.T('spells.s_wind_earth_b.sp_2')),
    s_wind_light_a: sp(R.T('spells.s_wind_light_a.sp'), ['wind', 'light'], 'A', 8, 'self',
      [buff('mag', 2), st('veil')], ['wind1', 'buff'],
      R.T('spells.s_wind_light_a.sp_2')),
    s_wind_light_b: sp(R.T('spells.s_wind_light_b.sp'), ['wind', 'light'], 'B', 12, 'allies',
      [heal(0.35), st('nimble')], ['heal', 'wind1'],
      R.T('spells.s_wind_light_b.sp_2'), { field: true }),
    s_wind_dark_a: sp(R.T('spells.s_wind_dark_a.sp'), ['wind', 'dark'], 'A', 8, 'allies',
      [st('nimble')], ['dark1', 'wind1'],
      R.T('spells.s_wind_dark_a.sp_2'), { field: true, fieldEffects: [enc(-100, 100, true)] }),
    s_wind_dark_b: sp(R.T('spells.s_wind_dark_b.sp'), ['wind', 'dark'], 'B', 13, 'enemies',
      [dmg(1.8), st('confuse', 0.4)], ['dark2', 'wind2'],
      R.T('spells.s_wind_dark_b.sp_2')),
    s_earth_light_a: sp(R.T('spells.s_earth_light_a.sp'), ['earth', 'light'], 'A', 9, 'ally_dead',
      [revive(0.5), buff('def', 1)], ['revive', 'buff'],
      R.T('spells.s_earth_light_a.sp_2'), { field: true }),
    s_earth_light_b: sp(R.T('spells.s_earth_light_b.sp'), ['earth', 'light'], 'B', 12, 'allies',
      [st('veil'), buff('def', 1)], ['earth1', 'holy'],
      R.T('spells.s_earth_light_b.sp_2')),
    s_earth_dark_a: sp(R.T('spells.s_earth_dark_a.sp'), ['earth', 'dark'], 'A', 8, 'enemies',
      [st('poison', 0.45), buff('def', -1)], ['earth1', 'poison'],
      R.T('spells.s_earth_dark_a.sp_2')),
    s_earth_dark_b: sp(R.T('spells.s_earth_dark_b.sp'), ['earth', 'dark'], 'B', 13, 'enemy',
      [dmg(3.0), st('paralyze', 0.4), buff('def', -1, 0.5)], ['dark2', 'earth3'],
      R.T('spells.s_earth_dark_b.sp_2')),
    s_light_dark_a: sp(R.T('spells.s_light_dark_a.sp'), ['light', 'dark'], 'A', 8, 'enemies',
      [dispel('good'), st('blind', 0.3), st('sleep', 0.3)], ['holy', 'sleep'],
      R.T('spells.s_light_dark_a.sp_2')),
    s_light_dark_b: sp(R.T('spells.s_light_dark_b.sp'), ['light', 'dark'], 'B', 13, 'enemy',
      [dmg(3.2, { drain: 0.3 }), dispel('good')], ['holy', 'dark3'],
      R.T('spells.s_light_dark_b.sp_2')),
  });
})(window.RPG);
