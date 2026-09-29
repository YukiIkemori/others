// （RULES。今の木の src/data/spells_triple.js から「そのまま」移した。tools/port/port_techs.js）
// 術: 3属性の合成 20（C(6,3)。大技 = 百雷・星降らし・皆既日食・冥府返し）。DESIGN §7.6.3・§7.7 CODE 3 が正本。
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
    s_fire_water_wind: sp(R.T('spells.s_fire_water_wind.sp'), ['fire', 'water', 'wind'], 'T', 20, 'enemies',
      [dmg(1.35, { hits: 2 }), st('paralyze', 0.3)], ['thunder3', 'thunder3'],
      R.T('spells.s_fire_water_wind.sp_2')),
    s_fire_water_earth: sp(R.T('spells.s_fire_water_earth.sp'), ['fire', 'water', 'earth'], 'T', 19, 'enemies',
      [dmg(2.4), st('burn', 0.4), st('stun', 0.35)], ['earth3', 'fire3'],
      R.T('spells.s_fire_water_earth.sp_2')),
    s_fire_water_light: sp(R.T('spells.s_fire_water_light.sp'), ['fire', 'water', 'light'], 'T', 17, 'allies',
      [heal(0.5), st('regen'), buff('atk', 1)], ['holy', 'heal'],
      R.T('spells.s_fire_water_light.sp_2'), { field: true }),
    s_fire_water_dark: sp(R.T('spells.s_fire_water_dark.sp'), ['fire', 'water', 'dark'], 'T', 18, 'enemies',
      [dmg(2.2), st('burn', 0.45), st('poison', 0.45)], ['poison', 'fire3'],
      R.T('spells.s_fire_water_dark.sp_2')),
    s_fire_wind_earth: sp(R.T('spells.s_fire_wind_earth.sp'), ['fire', 'wind', 'earth'], 'T', 20, 'random',
      [dmg(0.8, { hits: 6 }), st('burn', 0.15), st('stun', 0.15)], 'explosion2',
      R.T('spells.s_fire_wind_earth.sp_2')),
    s_fire_wind_light: sp(R.T('spells.s_fire_wind_light.sp'), ['fire', 'wind', 'light'], 'T', 19, 'enemies',
      [dmg(2.4), st('blind', 0.4), dispel('good')], ['wind3', 'holy'],
      R.T('spells.s_fire_wind_light.sp_2')),
    s_fire_wind_dark: sp(R.T('spells.s_fire_wind_dark.sp'), ['fire', 'wind', 'dark'], 'T', 19, 'enemies',
      [dmg(2.2), st('confuse', 0.35), st('burn', 0.35)], ['dark3', 'wind3'],
      R.T('spells.s_fire_wind_dark.sp_2')),
    s_fire_earth_light: sp(R.T('spells.s_fire_earth_light.sp'), ['fire', 'earth', 'light'], 'T', 19, 'allies',
      [buff('atk', 1), buff('def', 1), st('veil')], ['holy', 'buff'],
      R.T('spells.s_fire_earth_light.sp_2')),
    s_fire_earth_dark: sp(R.T('spells.s_fire_earth_dark.sp'), ['fire', 'earth', 'dark'], 'T', 18, 'enemy',
      [dmg(4.2), st('burn', 0.4), buff('def', -1, 0.5)], ['dark3', 'fire3'],
      R.T('spells.s_fire_earth_dark.sp_2')),
    s_fire_light_dark: sp(R.T('spells.s_fire_light_dark.sp'), ['fire', 'light', 'dark'], 'T', 20, 'enemy',
      [dmg(4.5, { ignoreMdef: 0.5 }), st('blind', 0.3)], ['dark3', 'holy', 'fire3'],
      R.T('spells.s_fire_light_dark.sp_2')),
    s_water_wind_earth: sp(R.T('spells.s_water_wind_earth.sp'), ['water', 'wind', 'earth'], 'T', 19, 'enemies',
      [dmg(1.2, { hits: 2 }), st('freeze', 0.35), buff('agi', -1, 0.5)], ['water3', 'ice2'],
      R.T('spells.s_water_wind_earth.sp_2')),
    s_water_wind_light: sp(R.T('spells.s_water_wind_light.sp'), ['water', 'wind', 'light'], 'T', 17, 'allies',
      [heal(0.4), st('nimble'), buff('mdef', 1)], ['holy', 'heal'],
      R.T('spells.s_water_wind_light.sp_2'), { field: true }),
    s_water_wind_dark: sp(R.T('spells.s_water_wind_dark.sp'), ['water', 'wind', 'dark'], 'T', 19, 'enemies',
      [dmg(2.2), st('freeze', 0.4), buff('mag', -1, 0.5)], ['dark3', 'ice3'],
      R.T('spells.s_water_wind_dark.sp_2')),
    s_water_earth_light: sp(R.T('spells.s_water_earth_light.sp'), ['water', 'earth', 'light'], 'T', 19, 'allies',
      [heal(0.7), st('regen'), buff('def', 1)], ['earth1', 'heal'],
      R.T('spells.s_water_earth_light.sp_2'), { field: true }),
    s_water_earth_dark: sp(R.T('spells.s_water_earth_dark.sp'), ['water', 'earth', 'dark'], 'T', 17, 'enemies',
      [pct(0.3), st('poison', 0.45), buff('agi', -1)], ['gravity', 'poison'],
      R.T('spells.s_water_earth_dark.sp_2')),
    s_water_light_dark: sp(R.T('spells.s_water_light_dark.sp'), ['water', 'light', 'dark'], 'T', 19, 'enemies',
      [dmg(2.2), st('sleep', 0.35), onAllies(st('regen'))], ['holy', 'sleep'],
      R.T('spells.s_water_light_dark.sp_2')),
    s_wind_earth_light: sp(R.T('spells.s_wind_earth_light.sp'), ['wind', 'earth', 'light'], 'T', 18, 'enemy',
      [dmg(4.2), st('stun', 0.4), dispel('good')], ['holy', 'earth3'],
      R.T('spells.s_wind_earth_light.sp_2')),
    s_wind_earth_dark: sp(R.T('spells.s_wind_earth_dark.sp'), ['wind', 'earth', 'dark'], 'T', 19, 'enemies',
      [dmg(2.2), st('silence', 0.4), st('paralyze', 0.35)], ['wind3', 'dark2'],
      R.T('spells.s_wind_earth_dark.sp_2')),
    s_wind_light_dark: sp(R.T('spells.s_wind_light_dark.sp'), ['wind', 'light', 'dark'], 'T', 15, 'allies',
      [cure('all'), st('nimble'), buff('agi', 1)], ['wind2', 'cure'],
      R.T('spells.s_wind_light_dark.sp_2')),
    s_earth_light_dark: sp(R.T('spells.s_earth_light_dark.sp'), ['earth', 'light', 'dark'], 'T', 20, 'party',
      [revive(1.0), heal(0.3), dispel('bad')], ['dark2', 'revive'],
      R.T('spells.s_earth_light_dark.sp_2'), { field: true }),
  });
})(window.RPG);
