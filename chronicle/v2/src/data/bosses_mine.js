// ガルド山地のボス（BATTLE の形。WORLD_REDESIGN §4.6・§4.10・E18、STORY_BIBLE §7.6）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   岩食らい tr_b_rockeater（深き坑道 2 階の中ボス。どの道でも戦う）: 土の中へもぐる（予告）→ 次の手番に足もとから突き上げる落盤（全体。守る）。
//       岩をかじって固くなる・砂利を吐く（今の行動）。風に弱い。
//   鉄の番人 tr_b_ironwarden（七の層の広間、組合につく道 A だけ）: 大槌を高く振りかぶる（予告）→ 次の手番に金床落とし（全体。守る）。
//       炉の息・鉄の壁（今の行動）。3/4 で二度動く、3 割を切ると水にいっそう弱くなる（今の第 2・第 3 の姿）。
(function (R) {
  'use strict';
  const SCHED = 200;
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const L = R.DB.monsters;
  Object.assign(R.DB.bossActions, {
    eb_rock_burrow: { name: R.T('bossActions.eb_rock_burrow.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_rock_burrow.msg'),
      telegraph: { text: R.T('bossActions.eb_rock_burrow.telegraph.text'), pose: 'tele', tint: '#d8b080', next: 'eb_rock_upheaval', guard: 'defend', lethal: true } },
    eb_rock_upheaval: { name: R.T('bossActions.eb_rock_upheaval.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.88, guardPct: 0.08, kind: 'blunt', element: 'earth' }], fx: 'earth', msg: R.T('bossActions.eb_rock_upheaval.msg') },
    eb_warden_raise: { name: R.T('bossActions.eb_warden_raise.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_warden_raise.msg'),
      telegraph: { text: R.T('bossActions.eb_warden_raise.telegraph.text'), pose: 'tele', tint: '#ffb070', next: 'eb_warden_anvil', guard: 'defend', lethal: true } },
    // 2026-10-01（ボスの組み直し）: 番人の鉄の構え（守りが上がり、打ちこむと殴り返す。battle_core の魔物の反撃の構え）
    eb_warden_guard: { name: R.T('bossActions.eb_warden_guard.name'), kind: 'enemy', target: 'self', effects: [{ type: 'status', status: 'counter', power: 1.0 }, { type: 'buff', stat: 'def', stages: 1 }], fx: 'buff', msg: R.T('bossActions.eb_warden_guard.msg') },
    eb_rock_acid: { name: R.T('bossActions.eb_rock_acid.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.8, element: 'earth' }, { type: 'buff', stat: 'def', stages: -1, chance: 0.7 }, { type: 'status', status: 'poison', chance: 0.4 }], fx: 'poison', msg: R.T('bossActions.eb_rock_acid.msg') },
    eb_warden_slag: { name: R.T('bossActions.eb_warden_slag.name'), kind: 'enemy', target: 'random', effects: [{ type: 'damage', formula: 'phys', power: 0.5, hits: 3, element: 'fire' }, { type: 'status', status: 'burn', chance: 0.2 }], fx: 'fire2', msg: R.T('bossActions.eb_warden_slag.msg') },
    eb_warden_anvil: { name: R.T('bossActions.eb_warden_anvil.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt', element: 'fire' }], fx: 'explosion', msg: R.T('bossActions.eb_warden_anvil.msg') },
  });
  const E = L.b_rockeater;
  if (E) {
    // 2026-10-01（ボスの組み直し）: 前は 4 手番ごとに必ず もぐる（予告）→ 突き上げ、3 手番ごとに岩をかじる の決まった順。溜めはやめた。
    //   かみ砕く・砂利吐き（ばらまき）・落盤（全体・気絶）・岩溶かしの酸（守りを下げる・毒）。岩をかじって固くなるのは HP が 7 割を切ってから
    E.actions = A([['attack', 1], ['eb_grind', 3], ['eb_gravel_spit', 2], ['eb_cave_in', 2], ['eb_rock_acid', 2], ['eb_rock_crunch', 2, { hpBelow: 0.7 }]]);
    E.desc = R.T('data.bosses_mine.desc');
    E.s = { hp: 1.2, atk: 3.3, mag: 3.3 };   // 2026-10-01（組み直し）: 毎手番攻める型で台本 85〜95%（前は 100%）。hp 1.7 → 1.2・atk 0.95 → 3.3
  }
  const W = L.b_ironwarden;
  if (W) {
    // 2026-10-01（ボスの組み直し）: 最初から 1 ラウンドに 2 回（重い手 1 つ: 鉄の拳・金床落とし・鉄くず散らし ＋ 軽い手 1 つ: 炉の息・鉄の壁・鉄の構え（反撃））。
    //   前は 3/4 から二度動き、2 ラウンドごとに必ず 振りかぶる（予告）→ 金床落とし（全体）。溜めはやめた
    W.actsPerTurn = 2;
    const HV = { every: [2, 0] }, LT = { every: [2, 1] };
    W.actions = A([['eb_iron_fist', 3, HV], ['eb_anvil_drop', 2, HV], ['eb_warden_slag', 2, HV],
      ['eb_forge_breath', 2, LT], ['eb_warden_guard', 1, LT], ['attack', 1, LT], ['eb_iron_wall', 3, { every: [2, 1], hpBelow: 0.7, once: true }]]);
    // 3/4 で二度動く姿はやめ、3 割で水にいっそう弱くなる姿だけ残す（文は前の 2 つ目の姿のまま）
    W.phases = [{ hpBelow: 0.3, msg: R.T('data.bosses.LIST.b_ironwarden.phases.1.msg'), set: { elem: { water: 2 }, buffs: { atk: 1 } } }];
    W.desc = R.T('data.bosses_mine.desc_2');
    W.s = { hp: 0.52, atk: 0.8, mag: 0.8 };   // 2026-10-01（組み直し）: 最初から 2 回動く型に。atk 0.48 → 0.8（台本 94〜96%・9〜12 ラウンド）   // 2026-10-01: 地方ボスの通常の技が 1 人の最大 HP の 3〜4% しか削らず弱すぎた（オーナー「砂の王が弱すぎる」→ 地方ボス全体を見直し）。atk・mag を約 1.6 倍（sim_bosses）
  }

  // ---------------------------------------------------------------- (2026-09-30) 鉱脈の主（隠しボス、#17 深淵の鉱脈の底。強さ固定 = ティア 6 相当）
  //   鉱脈が脈打つ（予告）→ 次の手番に結晶の嵐（全体、守る）。結晶のかけらを呼ぶ（かけらがいる間は鉱脈から力を吸って固い）。
  //   半分を切ると結晶の鎧がひび割れて、速く・強くなる。水と風が効き、土はほとんど効かない。
  Object.assign(R.DB.bossActions, {
    eb_vein_pulse: { name: R.T('bossActions.eb_vein_pulse.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_vein_pulse.msg'),
      telegraph: { text: R.T('bossActions.eb_vein_pulse.telegraph.text'), pose: 'tele', tint: '#a8e8ff', next: 'eb_vein_storm', guard: 'defend' } },
    eb_vein_storm: { name: R.T('bossActions.eb_vein_storm.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 1.4, element: 'earth', sure: true }], fx: 'earth', msg: R.T('bossActions.eb_vein_storm.msg') },
    eb_vein_fist: { name: R.T('bossActions.eb_vein_fist.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.6 }], fx: 'explosion', msg: R.T('bossActions.eb_vein_fist.msg') },
    eb_vein_glare: { name: R.T('bossActions.eb_vein_glare.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'status', status: 'blind', chance: 0.35 }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.4 }], fx: 'debuff', msg: R.T('bossActions.eb_vein_glare.msg') },
    eb_vein_crystal: { name: R.T('bossActions.eb_vein_crystal.name'), kind: 'enemy', target: 'self', effects: [{ type: 'status', status: 'veil' }, { type: 'buff', stat: 'mdef', stages: 1 }], fx: 'buff', msg: R.T('bossActions.eb_vein_crystal.msg') },
    eb_vein_shards: { name: R.T('bossActions.eb_vein_shards.name'), kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_vein_shard', n: 2, max: 3 }], fx: 'magic', msg: R.T('bossActions.eb_vein_shards.msg') },
  });
  const def = (id, d) => { L[id] = d; R.DB.bosses[id] = d; };
  def('b_vein_lord', {
    name: R.T('data.bosses_mine.b_vein_lord.name'), sprite: 'golem_3', artKind: 'mon', bossType: 'fmid', lv: 9, actsPerTurn: 2, size: 'l',
    race: 'construct', affinity: 'earth', flags: ['boss'], eva: 4,
    elem: { water: 1.5, wind: 1.25, earth: 0.1 }, phys: { blunt: 1.25, pierce: 0.75 }, statusRes: { death: 1, poison: 1, sleep: 0.7, confuse: 1 },
    // 2026-10-01（ボスの組み直し）: 重い手（鉱脈の拳・結晶の嵐）＋軽い手（にらみ・結晶の膜（加護）・かけらを呼ぶ）。前は 3 手番ごとに必ず脈打った（予告）→ 結晶の嵐。溜めはやめた
    actions: A([['eb_vein_fist', 3, { every: [2, 0] }], ['eb_vein_storm', 1, { every: [2, 0], round: 2 }], ['attack', 1, { every: [2, 0] }],
      ['eb_vein_glare', 2, { every: [2, 1] }], ['eb_vein_crystal', 1, { every: [2, 1] }], ['eb_vein_shards', 2, { every: [2, 1], countBelow: 3 }], ['attack', 1, { every: [2, 1] }]]),
    phases: [{ hpBelow: 0.5, msg: R.T('data.bosses_mine.b_vein_lord.phases.0.msg'), set: { buffs: { atk: 1, agi: 1 } } }],
    s: { hp: 0.5, atk: 1.0, mag: 1.0 },   // 2026-10-01（組み直し）: 予告が減った分 atk 0.5 → 1.0・hp 0.42 → 0.5（台本 95%・11 ラウンド）
    drops: { normal: { pool: 'p_boss', rate: 1 }, bonus: { pool: 'p_heal', rate: 1 } },
    desc: R.T('data.bosses_mine.b_vein_lord.desc'),
  });
  def('b_vein_shard', {
    name: R.T('data.bosses_mine.b_vein_shard.name'), sprite: 'crystal_3', artKind: 'mon', bossType: 'add', addOf: 'b_vein_lord', lv: 9, hpShare: 4, actsPerTurn: 1, size: 's',
    race: 'construct', flags: ['boss'], eva: 6, elem: { water: 1.5, earth: 0.1 }, phys: { blunt: 1.5 }, statusRes: { death: 1, poison: 1 },
    actions: A([['attack', 3], ['eb_vein_glare', 1]]), s: { atk: 0.55, mag: 0.55 }, drops: {},
    desc: R.T('data.bosses_mine.b_vein_shard.desc'),
  });
  // ---------------------------------------------------------------- 合体技（2026-10-01 ボスの組み直し。決まりは w_combo の R.DB.enemyCombos）
  R.defs('enemyCombos', {
    // 結晶の共鳴: かけらがまぶしく光って目をくらませ、鉱脈の主が弱った人を殴る
    c_b_vein_resonance: { name: R.T('enemyCombos.c_b_vein_resonance.name'), members: [{ mon: 'b_vein_lord' }, { mon: 'b_vein_shard' }],
      steps: [{ by: 1, act: 'eb_vein_glare' }, { by: 0, act: 'eb_vein_fist', aim: 'low', seq: 'sq:ec_upthrust' }], round: 2, chance: 0.35, cd: 3 },
  });
})(window.RPG);
