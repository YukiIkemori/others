// 術: 2属性の合成 30（15組 × 合成A・合成B）。DESIGN §7.6.2・§7.7 CODE 2 が正本。
// 組み立て関数 sp() は 3 つの spells_*.js の先頭に同じものを置く（§7.2.3。ファイルどうしで共有しない）。
(function (R) {
  'use strict';
  const EL = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const GLIM = { 1: [1, 0], 2: [2, 2], 3: [3, 4], 4: [5, 6], 5: [7, 8], A: [4, 5], B: [6, 7], T: [8, 8] };
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
  const healWp = (p) => ({ type: 'healWp', pct: p });
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
    return Object.assign(a, o || {});
  }
  Object.assign(R.DB.actions, {
    s_fire_water_a: sp('煮え湯の雨', ['fire', 'water'], 'A', 9, 'enemies',
      [dmg(1.4), st('burn', 0.3), buff('agi', -1, 0.3)], ['water2', 'fire2'],
      '煮え湯を降らせ、焼いて動きを鈍らせる。'),
    s_fire_water_b: sp('いで湯の恵み', ['fire', 'water'], 'B', 11, 'allies',
      [st('regen'), buff('atk', 1)], ['regen', 'buff'],
      '全員を再生状態にし、攻撃力を上げる。'),
    s_fire_wind_a: sp('野を焼く風', ['fire', 'wind'], 'A', 9, 'enemies',
      [dmg(1.35), st('burn', 0.3)], ['wind2', 'fire2'],
      '真っ先に、炎の風で敵全体を焼く。', { quick: true }),
    s_fire_wind_b: sp('炎の旋風', ['fire', 'wind'], 'B', 13, 'random',
      [dmg(0.75, { hits: 5 }), st('burn', 0.15)], ['wind1', 'fire1'],
      '炎の旋風が、敵を次々に5回焼く。'),
    s_fire_earth_a: sp('溶岩弾', ['fire', 'earth'], 'A', 8, 'enemy',
      [dmg(2.6), st('stun', 0.3)], ['earth2', 'fire2'],
      '溶岩の塊で、敵1体を打ちすえる。'),
    s_fire_earth_b: sp('溶岩の鎧', ['fire', 'earth'], 'B', 11, 'allies',
      [buff('atk', 1), buff('def', 1)], ['buff', 'buff'],
      '全員の攻撃力と守備力を上げる。'),
    s_fire_light_a: sp('聖なる炎', ['fire', 'light'], 'A', 9, 'enemies',
      [dmg(1.45), st('blind', 0.3)], ['holy', 'fire2'],
      '清らかな炎で、敵全体の目をくらます。'),
    s_fire_light_b: sp('勇気の灯火', ['fire', 'light'], 'B', 11, 'allies',
      [buff('atk', 1), healWp(0.25)], ['buff', 'mp'],
      '全員の攻撃力を上げ、WPを回復する。', { field: true }),
    s_fire_dark_a: sp('誘い火', ['fire', 'dark'], 'A', 8, 'enemy',
      [dmg(2.4, { drain: 0.3 }), st('burn', 0.3)], ['dark1', 'fire1'],
      '焼いて吸う。外では魔物を呼び寄せる。', { field: true, fieldEffects: [enc(100, 100)] }),
    s_fire_dark_b: sp('黒炎の渦', ['fire', 'dark'], 'B', 13, 'enemies',
      [dmg(1.8), st('burn', 0.4), buff('mdef', -1, 0.4)], ['dark2', 'fire3'],
      '黒い炎で敵全体を焼き、術防を下げる。'),
    s_water_wind_a: sp('吹雪', ['water', 'wind'], 'A', 9, 'enemies',
      [dmg(1.45), st('freeze', 0.3)], ['wind2', 'ice2'],
      '吹雪で、敵全体を凍らせる。'),
    s_water_wind_b: sp('氷の彫像', ['water', 'wind'], 'B', 13, 'enemy',
      [dmg(3.4), st('freeze', 0.4)], ['wind1', 'ice3'],
      '敵1体を、氷の中に閉じこめる。'),
    s_water_earth_a: sp('泥の沼', ['water', 'earth'], 'A', 8, 'enemies',
      [buff('agi', -1), st('paralyze', 0.3)], ['water1', 'earth1'],
      '敵全体の足を取り、動きを封じる。'),
    s_water_earth_b: sp('岩清水', ['water', 'earth'], 'B', 10, 'allies',
      [buff('def', 1), buff('mdef', 1)], ['water1', 'buff'],
      '全員の守備力と術防を上げる。'),
    s_water_light_a: sp('恵みの雨', ['water', 'light'], 'A', 8, 'allies',
      [heal(0.25), st('regen')], ['water1', 'heal'],
      '全員を回復し、再生状態にする。', { field: true }),
    s_water_light_b: sp('いやしの泉', ['water', 'light'], 'B', 11, 'allies',
      [heal(0.45), cure('all')], ['cure', 'heal'],
      '全員を回復し、悪い状態を治す。', { field: true }),
    s_water_dark_a: sp('毒のしずく', ['water', 'dark'], 'A', 9, 'enemies',
      [dmg(1.35), st('poison', 0.35)], ['water2', 'poison'],
      '毒の雨で、敵全体を毒にする。'),
    s_water_dark_b: sp('水底への誘い', ['water', 'dark'], 'B', 13, 'enemy',
      [dmg(3.2, { drain: 0.3 }), buff('agi', -1, 0.5)], ['water3', 'drain'],
      '水底へ引きこみ、HPを吸い取る。'),
    s_wind_earth_a: sp('砂嵐', ['wind', 'earth'], 'A', 9, 'enemies',
      [dmg(0.72, { hits: 2 }), st('stun', 0.3)], ['wind2', 'earth1'],
      '砂と石の嵐で、敵全体を2回打つ。'),
    s_wind_earth_b: sp('峰の守り', ['wind', 'earth'], 'B', 10, 'allies',
      [buff('def', 1), buff('agi', 1)], ['wind1', 'buff'],
      '全員の守備力と素早さを上げる。'),
    s_wind_light_a: sp('澄みきった心', ['wind', 'light'], 'A', 8, 'self',
      [buff('mag', 2), st('veil')], ['wind1', 'buff'],
      '心を澄ませ、術力を上げて加護を得る。'),
    s_wind_light_b: sp('光の薄衣', ['wind', 'light'], 'B', 12, 'allies',
      [heal(0.35), st('nimble')], ['heal', 'wind1'],
      '全員を回復し、身軽にする。', { field: true }),
    s_wind_dark_a: sp('影隠れ', ['wind', 'dark'], 'A', 8, 'allies',
      [st('nimble')], ['dark1', 'wind1'],
      '全員を身軽に。外では弱い魔物を避ける。', { field: true, fieldEffects: [enc(-100, 100, true)] }),
    s_wind_dark_b: sp('惑いの夜嵐', ['wind', 'dark'], 'B', 13, 'enemies',
      [dmg(1.8), st('confuse', 0.4)], ['dark2', 'wind2'],
      '夜の嵐で、敵全体を惑わせる。'),
    s_earth_light_a: sp('不屈の光', ['earth', 'light'], 'A', 9, 'ally_dead',
      [revive(0.5), buff('def', 1)], ['revive', 'buff'],
      '1人を生き返らせ、守備力を上げる。', { field: true }),
    s_earth_light_b: sp('大地の加護', ['earth', 'light'], 'B', 12, 'allies',
      [st('veil'), buff('def', 1)], ['earth1', 'holy'],
      '全員に加護を与え、守備力を上げる。'),
    s_earth_dark_a: sp('腐れ土', ['earth', 'dark'], 'A', 8, 'enemies',
      [st('poison', 0.45), buff('def', -1)], ['earth1', 'poison'],
      '敵全体を毒にし、守備力を下げる。'),
    s_earth_dark_b: sp('石の呪い', ['earth', 'dark'], 'B', 13, 'enemy',
      [dmg(3.0), st('paralyze', 0.4), buff('def', -1, 0.5)], ['dark2', 'earth3'],
      '敵1体を打ち、石のように固める。'),
    s_light_dark_a: sp('たそがれ', ['light', 'dark'], 'A', 8, 'enemies',
      [dispel('good'), st('blind', 0.3), st('sleep', 0.3)], ['holy', 'sleep'],
      '敵の強化を消し、眠りと暗闇に誘う。'),
    s_light_dark_b: sp('白と黒の刃', ['light', 'dark'], 'B', 13, 'enemy',
      [dmg(3.2, { drain: 0.3 }), dispel('good')], ['holy', 'dark3'],
      '敵1体を裂き、HPと強化を奪う。'),
  });
})(window.RPG);
