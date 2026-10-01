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
    eb_warden_anvil: { name: R.T('bossActions.eb_warden_anvil.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt', element: 'fire' }], fx: 'explosion', msg: R.T('bossActions.eb_warden_anvil.msg') },
  });
  const E = L.b_rockeater;
  if (E) {
    E.actions = A([['attack', 2], ['eb_rock_crunch', 1, { every: [3, 2] }], ['eb_gravel_spit', 2], ['eb_grind', 2], ['eb_rock_burrow', SCHED, { every: [4, 1] }]]);
    E.desc = R.T('data.bosses_mine.desc');
    E.s = { hp: 1.7, atk: 0.95, mag: 0.95 };
  }
  const W = L.b_ironwarden;
  if (W) {
    W.actions = A([['attack', 2], ['eb_iron_fist', 2], ['eb_forge_breath', 1], ['eb_iron_wall', 1, { hpBelow: 0.7, once: true }],
      ['eb_warden_raise', SCHED, { every: [4, 3] }]]);
    W.desc = R.T('data.bosses_mine.desc_2');
    W.s = { hp: 0.5, atk: 0.48, mag: 0.48 };   // 2026-10-01: 地方ボスの通常の技が 1 人の最大 HP の 3〜4% しか削らず弱すぎた（オーナー「砂の王が弱すぎる」→ 地方ボス全体を見直し）。atk・mag を約 1.6 倍（sim_bosses）
  }

  // ---------------------------------------------------------------- (2026-09-30) 鉱脈の主（隠しボス、#17 深淵の鉱脈の底。強さ固定 = ティア 6 相当）
  //   鉱脈が脈打つ（予告）→ 次の手番に結晶の嵐（全体、守る）。結晶のかけらを呼ぶ（かけらがいる間は鉱脈から力を吸って固い）。
  //   半分を切ると結晶の鎧がひび割れて、速く・強くなる。水と風が効き、土はほとんど効かない。
  Object.assign(R.DB.bossActions, {
    eb_vein_pulse: { name: R.T('bossActions.eb_vein_pulse.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_vein_pulse.msg'),
      telegraph: { text: R.T('bossActions.eb_vein_pulse.telegraph.text'), pose: 'tele', tint: '#a8e8ff', next: 'eb_vein_storm', guard: 'defend' } },
    eb_vein_storm: { name: R.T('bossActions.eb_vein_storm.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 2.1, element: 'earth', sure: true }], fx: 'earth', msg: R.T('bossActions.eb_vein_storm.msg') },
    eb_vein_fist: { name: R.T('bossActions.eb_vein_fist.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.6 }], fx: 'explosion', msg: R.T('bossActions.eb_vein_fist.msg') },
    eb_vein_glare: { name: R.T('bossActions.eb_vein_glare.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'status', status: 'blind', chance: 0.35 }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.4 }], fx: 'debuff', msg: R.T('bossActions.eb_vein_glare.msg') },
    eb_vein_shards: { name: R.T('bossActions.eb_vein_shards.name'), kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_vein_shard', n: 2, max: 3 }], fx: 'magic', msg: R.T('bossActions.eb_vein_shards.msg') },
  });
  const def = (id, d) => { L[id] = d; R.DB.bosses[id] = d; };
  def('b_vein_lord', {
    name: R.T('data.bosses_mine.b_vein_lord.name'), sprite: 'golem_3', artKind: 'mon', bossType: 'fmid', lv: 9, actsPerTurn: 2, size: 'l',
    race: 'construct', affinity: 'earth', flags: ['boss'], eva: 4,
    elem: { water: 1.5, wind: 1.25, earth: 0.1 }, phys: { blunt: 1.25, pierce: 0.75 }, statusRes: { death: 1, poison: 1, sleep: 0.7, confuse: 1 },
    actions: A([['attack', 2], ['eb_vein_fist', 2], ['eb_vein_glare', 1, { every: [4, 2] }], ['eb_vein_pulse', SCHED, { every: [3, 1] }],
      ['eb_vein_shards', SCHED, { every: [4, 3], countBelow: 3 }]]),
    phases: [{ hpBelow: 0.5, msg: R.T('data.bosses_mine.b_vein_lord.phases.0.msg'), set: { buffs: { atk: 1, agi: 1 } } }],
    s: { hp: 0.42, atk: 0.5, mag: 0.5 },
    drops: { normal: { pool: 'p_boss', rate: 1 }, bonus: { pool: 'p_heal', rate: 1 } },
    desc: R.T('data.bosses_mine.b_vein_lord.desc'),
  });
  def('b_vein_shard', {
    name: R.T('data.bosses_mine.b_vein_shard.name'), sprite: 'crystal_3', artKind: 'mon', bossType: 'add', addOf: 'b_vein_lord', lv: 9, hpShare: 4, actsPerTurn: 1, size: 's',
    race: 'construct', flags: ['boss'], eva: 6, elem: { water: 1.5, earth: 0.1 }, phys: { blunt: 1.5 }, statusRes: { death: 1, poison: 1 },
    actions: A([['attack', 3], ['eb_vein_glare', 1]]), s: { atk: 0.55, mag: 0.55 }, drops: {},
    desc: R.T('data.bosses_mine.b_vein_shard.desc'),
  });
})(window.RPG);
