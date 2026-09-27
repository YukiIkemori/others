// 雪原のボス（BATTLE の形。WORLD_REDESIGN §4.3・§4.10・E18、STORY_BIBLE §7.3）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   吹雪の大狼 b_blizzardwolf（籠城の 3 波目。新規）: 遠吠え → 次の手番に全体の吹雪の牙（守る）。守らなかった門の数だけ援軍（_1・_2 の変化形）。
//       頭が倒れると群れは散る（leader）。絵は狼の群れ頭の大きい灰色狼（hd:boss:boss_wolflord）。籠城の山場なので盗み専用の品は持たない（§4.11）。
//   氷壁の巨人 b_icegiant（峰の中ボス）: 体が白く光る（予告）→ 次の手番に氷の鎧（守り +2）。光っている間に火で打つと張れない（cancel）。
//       鎧を張った後も、火で打てば砕けて守りが −2 に落ちる（melt。battle_core の雪原の口）。物理はそこでよく効く。
//   白竜ネーヴェ b_whitedragon（地方ボス。戦う道のとき）: 深く息を吸う（予告）→ 次の手番に全体の大吹雪（守る・水の耐性）。
//       HP が半分を切ると、祭で語った昔話の一節を思い出して 1 手番止まる（祭のご褒美、§4.10）。第 2 の姿は hd:boss:boss_whitedragon@p2。
//   氷の船団長 b_frost_admiral（隠しボス、#13 氷に閉じた帆船。強さ固定）: 号令（予告）→ 氷の砲撃（全体）、手下の水兵を呼ぶ、凍てつく旗。
(function (R) {
  'use strict';
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const MID = (seed) => ({ normal: { pool: 'p_boss_mid', rate: 1 }, bonus: { item: seed, rate: 1 } });
  const L = R.DB.monsters;

  // ---------------------------------------------------------------- 行動
  Object.assign(R.DB.bossActions, {
    // 吹雪の大狼
    eb_bw_howl: { name: '吹雪の遠吠え', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}は天を仰ぎ、長く遠吠えした……！',
      telegraph: { text: '大狼のまわりに、吹雪が渦を巻きはじめた……。', pose: 'tele', tint: '#d8e4ff', next: 'eb_bw_storm', guard: 'defend' } },
    eb_bw_storm: { name: '吹雪の牙', kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 6.0, element: 'water', sure: true }, { type: 'status', status: 'freeze', chance: 0.1 }], fx: 'breath_ice', msg: '吹雪をまとった牙が、一行を次々に襲った！' },
    eb_bw_bite: { name: '大狼の牙', kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.35 }], fx: 'bite2', msg: '{user}は低くうなって飛びかかった！' },
    eb_bw_call_1: { name: '群れを呼ぶ', kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_siegewolf', n: 1, max: 4 }], fx: 'song', msg: '守りの手薄な門から、\n狼が駆けつけた！' },
    eb_bw_call_2: { name: '群れを呼ぶ', kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_siegewolf', n: 2, max: 5 }], fx: 'song', msg: '守りの手薄な門から、\n狼の群れが駆けつけた！' },
    // 氷壁の巨人
    eb_frost_glow: { name: '白い光', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}は胸の前で両腕を組んだ。',
      telegraph: { text: '巨人の体が、白く光りはじめた……。', pose: 'tele', tint: '#e8f4ff', next: 'eb_ice_armor', guard: 'element:fire',
        cancel: { element: 'fire', msg: '炎が、張りかけた氷を溶かした！' } } },
    eb_ice_armor: { name: '氷の鎧', kind: 'enemy', target: 'self', effects: [{ type: 'buff', stat: 'def', stages: 4 }, { type: 'buff', stat: 'mdef', stages: 2 }, { type: 'heal', pct: 0.1 }, { type: 'status', status: 'regen' }], fx: 'buff', msg: '{user}の体が、分厚い氷の鎧に覆われた！\n傷も氷でふさがっていく……。' },
    // 白竜ネーヴェ
    eb_dragon_inhale: { name: '深く息を吸う', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}は首を高くもたげた。',
      telegraph: { text: 'ネーヴェが、深く息を吸いこんでいる……。', pose: 'tele', tint: '#dff0ff', next: 'eb_dragon_whiteout', guard: 'defend' } },
    eb_dragon_whiteout: { name: '白の大吹雪', kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'breath', power: 1.9, element: 'water', sure: true }, { type: 'status', status: 'freeze', chance: 0.2 }], fx: 'breath_ice', msg: '{user}の口から、あたり一面を白く塗りつぶす\n大吹雪が吹き出した！' },
    eb_dragon_remember: { name: '昔話の一節', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}の動きが、ふと止まった。\n……祭で語られた昔話の一節が、\n胸の氷の奥で響いたようだ。' },
    // 氷の船団長
    eb_admiral_order: { name: '号令', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}はサーベルを高く掲げた！',
      telegraph: { text: '凍った大砲が、一行に向けられた……。', pose: 'tele', tint: '#c8e0ff', next: 'eb_admiral_cannon', guard: 'defend' } },
    eb_admiral_cannon: { name: '氷の砲撃', kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 2.0, element: 'water', sure: true }], fx: 'ice3', msg: '氷の砲弾が、甲板ごと一行を打ち砕いた！' },
    eb_admiral_crew: { name: '総員集合', kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_frost_sailor', n: 2, max: 4 }], fx: 'magic', msg: '氷の中から、凍った水兵たちが起き上がった！' },
    eb_admiral_flag: { name: '凍てつく旗', kind: 'enemy', target: 'enemies', effects: [{ type: 'buff', stat: 'agi', stages: -1, chance: 0.6 }, { type: 'status', status: 'freeze', chance: 0.2 }], fx: 'debuff', msg: '{user}の旗が、凍える風にはためいた！' },
    eb_admiral_slash: { name: '氷のサーベル', kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, element: 'water', hits: 2 }], fx: 'slash2', msg: '{user}の氷のサーベルがひらめいた！' },
  });

  // ---------------------------------------------------------------- ボス
  const def = (id, d) => { L[id] = d; R.DB.bosses[id] = d; };
  const base = {
    name: '吹雪の大狼', sprite: 'boss_wolflord', bossType: 'mid', lv: 9, actsPerTurn: 1, size: 'l',
    race: 'beast', affinity: 'water', flags: ['boss'], eva: 10,
    elem: { fire: 1.5, water: 0.25, earth: 1.25 }, phys: {}, statusRes: { sleep: 0.25, freeze: 1 },
    s: { hp: 1.15, atk: 0.9, mag: 0.9 },
    leader: { msg: '大狼が倒れると、狼の群れは\n吹雪の中へ散り散りに逃げていった！' },
    drops: MID('i_ether'),
    desc: '吹雪にまぎれて村を囲む狼の群れの頭。\n遠吠えひとつで吹雪を呼ぶ。',
  };
  const bwActs = (call) => A([['attack', 3], ['eb_bw_bite', 2], ['eb_bw_howl', 200, { every: [3, 1] }]].concat(call ? [[call, 200, { every: [3, 2], countBelow: call === 'eb_bw_call_2' ? 5 : 4 }]] : []));
  def('b_blizzardwolf', Object.assign({}, base, { actions: bwActs(null) }));
  def('b_blizzardwolf_1', Object.assign({}, base, { actions: bwActs('eb_bw_call_1') }));
  def('b_blizzardwolf_2', Object.assign({}, base, { actions: bwActs('eb_bw_call_2') }));
  def('b_siegewolf', {
    name: '吹雪の狼', sprite: 'wolf_1', artKind: 'mon', bossType: 'add', addOf: 'b_blizzardwolf', lv: 9, hpShare: 3, actsPerTurn: 1, size: 's',
    race: 'beast', flags: ['boss'], eva: 10, elem: { fire: 1.5, water: 0.25 }, phys: {}, statusRes: {},
    actions: A([['attack', 3], ['e_bite', 1]]), s: { atk: 0.55, mag: 0.55 }, drops: {},
    desc: '大狼に従う白い狼。\n頭がいなくなると散っていく。',
  });

  // 氷壁の巨人（今の数値と行動に予告と融ける氷を足す）
  const G = L.b_icegiant;
  if (G) {
    G.actions = A([['attack', 3], ['eb_ice_hammer', 2], ['eb_avalanche_drop', 2], ['eb_frost_glow', 200, { every: [2, 1] }], ['eb_frost_exhale', 1]]);
    G.melt = { element: 'fire', to: -2, clear: 'regen', msg: '炎が氷の鎧を砕いた！\n巨人の体がむき出しになった！' };
    G.s = { hp: 1.15, atk: 1.6, mag: 1.6 };
    G.desc = '白竜の峰の中腹を守る氷の巨人。\n氷の鎧を張るが、火に弱い。';
  }
  // 白竜ネーヴェ（予告の大吹雪・昔話の一節）
  const D = L.b_whitedragon;
  if (D) {
    D.s = { hp: 1.05, atk: 0.6, mag: 0.6 };
    D.actions = A([['attack', 2], ['eb_ice_claw', 2], ['eb_dragon_tail', 2], ['eb_dragon_inhale', 200, { every: [4, 1] }],
      ['eb_frozen_roar', 1, { every: [4, 3] }], ['eb_glacier_fall', 2, { hpBelow: 0.5 }], ['eb_dragon_remember', 400, { hpBelow: 0.5, once: true }]]);
  }

  // 氷の船団長（隠しボス。強さ固定）と凍った水兵
  def('b_frost_admiral', {
    name: '氷の船団長', sprite: 'frostling_5', artKind: 'mon', bossType: 'fmid', lv: 9, actsPerTurn: 2, size: 'l',
    race: 'undead', affinity: 'water', flags: ['boss'], eva: 10,
    elem: { fire: 1.5, water: 0, light: 1.25 }, phys: {}, statusRes: { death: 1, freeze: 1, sleep: 0.5 },
    actions: A([['attack', 2], ['eb_admiral_slash', 2], ['eb_admiral_flag', 1, { every: [4, 3] }], ['eb_admiral_order', 200, { every: [3, 1] }],
      ['eb_admiral_crew', 200, { every: [4, 2], countBelow: 3 }]]),
    phases: [{ hpBelow: 0.4, msg: '船団長の氷の鎧がはがれ落ちた！\n――帰りたい、と声がした。', set: { buffs: { atk: 1 } } }],
    s: { hp: 0.6, atk: 0.5, mag: 0.5 },
    drops: { normal: { pool: 'p_boss', rate: 1 }, bonus: { item: 'i_elixir', rate: 1 } },
    desc: '氷に閉じこめられた帆船の船団長。\n百年、帰る港を探している。',
  });
  def('b_frost_sailor', {
    name: '凍った水兵', sprite: 'frostling_4', artKind: 'mon', bossType: 'add', addOf: 'b_frost_admiral', lv: 9, hpShare: 3, actsPerTurn: 1, size: 's',
    race: 'undead', flags: ['boss'], eva: 5, elem: { fire: 1.5, water: 0 }, phys: {}, statusRes: { death: 1 },
    actions: A([['attack', 3], ['e_icicle', 1]]), s: { atk: 0.6, mag: 0.6 }, drops: {},
    desc: '船団長に従う、凍りついた水兵。',
  });
})(window.RPG);
