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
    return Object.assign(a, o || {});
  }
  Object.assign(R.DB.actions, {
    s_fire_1: sp('火の矢', ['fire'], '1', 2, 'enemy',
      [dmg(1.4)], 'fire1',
      '炎の矢を放ち、敵1体を焼く。'),
    s_fire_2: sp('火の粉', ['fire'], '2', 5, 'enemies',
      [dmg(1.0), st('burn', 0.2)], 'fire2',
      '火の粉をまき、敵全体を焼く。'),
    s_fire_3: sp('闘志の炎', ['fire'], '3', 6, 'allies',
      [buff('atk', 1)], 'buff',
      '胸に火をともし、全員の攻撃力を上げる。'),
    s_fire_4: sp('炎の大波', ['fire'], '4', 9, 'enemies',
      [dmg(1.5), st('burn', 0.3)], 'fire2',
      '炎の波が、敵全体をのみこんで焼く。'),
    s_fire_5: sp('日輪落とし', ['fire'], '5', 12, 'enemy',
      [dmg(3.4), st('burn', 0.5)], 'fire3',
      '小さな太陽を落とし、敵1体を焼きつくす。'),
    s_water_1: sp('水の刃', ['water'], '1', 2, 'enemy',
      [dmg(1.3)], 'water1',
      '水を刃に変えて、敵1体を切る。'),
    s_water_2: sp('清めの水', ['water'], '2', 4, 'ally',
      [cure('all'), st('regen')], 'cure',
      '悪い状態を治し、再生状態にする。'),
    s_water_3: sp('水のとばり', ['water'], '3', 5, 'allies',
      [buff('mdef', 1)], 'buff',
      '水の膜で、全員の術防を上げる。'),
    s_water_5: sp('大渦潮', ['water'], '5', 11, 'enemies',
      [dmg(1.6), buff('agi', -1, 0.5)], 'water3',
      '渦に巻きこみ、敵全体の動きを鈍らせる。'),
    s_wind_1: sp('風切り', ['wind'], '1', 2, 'enemy',
      [dmg(1.2)], 'wind1',
      '真っ先に、風の刃で敵1体を切る。', { quick: true }),
    s_wind_2: sp('風の衣', ['wind'], '2', 4, 'ally',
      [st('nimble'), buff('agi', 1)], 'buff',
      '1人を身軽にし、素早さも上げる。'),
    s_wind_3: sp('疾風の舞', ['wind'], '3', 7, 'random',
      [dmg(0.55, { hits: 4 }), st('silence', 0.15)], 'wind2',
      '風の刃が、敵を次々に4回切る。'),
    s_wind_5: sp('天を裂く嵐', ['wind'], '5', 11, 'enemies',
      [dmg(0.55, { hits: 3 }), st('silence', 0.35)], 'wind3',
      '嵐が敵全体を3回切り、術を封じる。'),
    s_earth_1: sp('石つぶて', ['earth'], '1', 2, 'enemy',
      [dmg(1.2), st('stun', 0.15)], 'earth1',
      '石を飛ばして、敵1体を打つ。'),
    s_earth_2: sp('岩の構え', ['earth'], '2', 3, 'ally',
      [buff('def', 1), st('counter')], 'buff',
      '守りを固め、反撃の構えをとらせる。'),
    s_earth_3: sp('地鳴り', ['earth'], '3', 6, 'enemies',
      [dmg(1.0), st('stun', 0.25)], 'earth2',
      '大地を揺らし、敵全体を打つ。'),
    s_earth_5: sp('大地の目覚め', ['earth'], '5', 12, 'enemies',
      [dmg(1.5), st('paralyze', 0.3), onAllies(buff('def', 1))], 'earth3',
      '敵全体を打ち、全員の守備力を上げる。'),
    s_light_1: sp('ひだまり', ['light'], '1', 3, 'ally',
      [heal(0.35)], 'heal',
      '温かな光で、1人のHPを回復する。', { field: true }),
    s_light_2: sp('光の矢', ['light'], '2', 4, 'enemy',
      [dmg(1.5), st('blind', 0.2)], 'holy',
      '光の矢で射る。不死の魔物によく効く。'),
    s_light_3: sp('あまねく光', ['light'], '3', 7, 'allies',
      [heal(0.3)], 'heal',
      '味方全員のHPを回復する。', { field: true }),
    s_light_4: sp('よみがえりの光', ['light'], '4', 7, 'ally_dead',
      [revive(0.3)], 'revive',
      '戦闘不能の1人を生き返らせる。', { field: true }),
    s_light_5: sp('天の祝福', ['light'], '5', 12, 'allies',
      [heal(0.6), st('veil')], 'heal',
      '全員を大きく回復し、加護を与える。', { field: true }),
    s_dark_1: sp('影ばり', ['dark'], '1', 2, 'enemy',
      [dmg(1.2, { drain: 0.3 })], 'dark1',
      '影の針で刺し、HPを吸い取る。'),
    s_dark_2: sp('まどろみの影', ['dark'], '2', 4, 'enemies',
      [st('sleep', 0.35)], 'sleep',
      '敵全体を、深い眠りに誘う。'),
    s_dark_3: sp('呪いの言葉', ['dark'], '3', 7, 'enemies',
      [buff('atk', -1), buff('mag', -1)], 'debuff',
      '敵全体の攻撃力と術力を下げる。'),
    s_dark_4: sp('影の口づけ', ['dark'], '4', 8, 'enemy',
      [dmg(2.2, { drain: 0.5 })], 'drain',
      '敵1体から、HPを大きく吸い取る。'),
    s_dark_5: sp('黄泉の門', ['dark'], '5', 12, 'enemies',
      [st('death', 0.3), dmg(1.2)], 'death',
      '黄泉の門を開き、敵全体を死へ誘う。'),
  });
})(window.RPG);
