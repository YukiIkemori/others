// 灰の荒野のボスと大会の相手（BATTLE の形。WORLD_REDESIGN §4.7・§4.10・E18、STORY_BIBLE §7.7）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   炎の試練（闘技大会）5 回戦: 回ごとに相手の型が違う（どれも scale:'tier'。間に控え室で全快、負けたらその回から）。
//     1 回戦 一族の若者たち（4 人。数が多い）
//     2 回戦 獣使いのガロと岩の獣・火トカゲの子 2（獣使いが群れの頭: 倒れると獣は座りこむ。口笛を吹く予告 → 岩の獣の突進（全体。守る））
//     3 回戦 術師の姉妹（姉ヒノエが妹を起こし・癒やす = 先に姉を倒す（群れの頭）。妹スミの詠唱の予告 → 火柱（全体。守る））
//     4 回戦 鉄鎧のバルガ（硬い。打撃がよく効く。大きく振りかぶる予告 → 大なぎ（全体。守る））
//     決勝   記録院付きの闘士ザクロ（律儀に「構えな」と言う予告 → 居合の一閃（全体。守る）。半分を切ると二本目の刀（本気））
//   炎の番犬 tr_b_hellhound（火山 1 階の中ボス）: 二つの頭が息を吸う予告 → 業火の雄たけび（全体。守る）。水に弱い。
//   溶岩の巨獣 tr_b_lavabeast（地方ボス）: 背の火口がふくれる予告 → 大噴火（全体。守る）。半分で溶岩が冷えて黒い岩に（今の第 2 の姿）。
//   記録院の写し手 tr_ash_copyists（八百長を受けたときだけ、火山 1 階の壁画の前で）。
(function (R) {
  'use strict';
  const SCHED = 200;
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const MID = (seed) => ({ normal: { pool: 'p_boss_mid', rate: 1 }, bonus: { item: seed, rate: 1 } });
  const L = R.DB.monsters;

  // ------------------------------------------------------------ 雑魚の形の相手（1 回戦・2 回戦のお供・写し手）
  const MOBS = {
    ash_youth: {
      name: R.T('data.bosses_ash.MOBS.ash_youth.name'), sprite: 'ash_youth', size: 'm', lv: 8, race: 'humanoid', flags: [],
      s: { hp: 1.25, atk: 0.95, agi: 1.05 }, elem: { fire: 0.75, water: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_slash', w: 2 }, { id: 'e_focus', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('data.bosses_ash.MOBS.ash_youth.desc'),
    },
    ash_pup: {
      name: R.T('data.bosses_ash.MOBS.ash_pup.name'), sprite: 'salamander_1', size: 's', lv: 8, race: 'beast', affinity: 'fire', flags: [],
      s: { hp: 0.9, atk: 0.9 }, elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_fire_bite', w: 2 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: R.T('data.bosses_ash.MOBS.ash_pup.desc'),
    },
    ash_copyist: {
      name: R.T('data.bosses_ash.MOBS.ash_copyist.name'), sprite: 'scribe_1', size: 'm', lv: 8, race: 'humanoid', affinity: 'light', flags: [],
      s: { hp: 1.1, atk: 0.8, mag: 1.0 }, elem: { light: 0.5, dark: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_ink', w: 2 }, { id: 'e_transcribe', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('data.bosses_ash.MOBS.ash_copyist.desc'),
    },
  };
  for (const id in MOBS) L[id] = MOBS[id];

  // ------------------------------------------------------------ 大会の相手とザクロ（ボスの形）
  const LIST = {
    b_rockbeast: {
      name: R.T('data.bosses_ash.LIST.b_rockbeast.name'), sprite: 'golem_1', artKind: 'mon', bossType: 'add', addOf: 'b_tamer', lv: 8, hpShare: 4, actsPerTurn: 1, size: 'l',
      race: 'beast', affinity: 'earth', flags: ['boss'], eva: 0,
      elem: { water: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { sleep: 0.5 },
      actions: A([['attack', 3], ['e_crush', 2]]),
      drops: {},
      desc: R.T('data.bosses_ash.LIST.b_rockbeast.desc'),
    },
    b_tamer: {
      name: R.T('data.bosses_ash.LIST.b_tamer.name'), sprite: 'b_ash_tamer', bossType: 'mid', lv: 8, hpShare: 9, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 5, elem: {}, phys: {}, statusRes: {},
      actions: A([['attack', 2], ['eb_tamer_whip', 2], ['eb_tamer_whistle', SCHED, { every: [3, 1] }], ['e_howl', 1]]),
      leader: { msg: R.T('data.bosses_ash.LIST.b_tamer.leader.msg') },
      drops: MID('i_potion'),
      desc: R.T('data.bosses_ash.LIST.b_tamer.desc'),
    },
    b_sister_elder: {
      name: R.T('data.bosses_ash.LIST.b_sister_elder.name'), sprite: 'b_ash_hinoe', bossType: 'mid', lv: 8, hpShare: 9, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 5, elem: { water: 1.25 }, phys: {}, statusRes: {},
      actions: A([['e_fire_bolt', 2], ['eb_hinoe_mend', 2], ['eb_hinoe_raise', SCHED, { allyDown: true }]]),
      leader: { msg: R.T('data.bosses_ash.LIST.b_sister_elder.leader.msg') },
      drops: MID('i_ether'),
      desc: R.T('data.bosses_ash.LIST.b_sister_elder.desc'),
    },
    b_sister_younger: {
      name: R.T('data.bosses_ash.LIST.b_sister_younger.name'), sprite: 'b_ash_sumi', bossType: 'add', addOf: 'b_sister_elder', lv: 8, hpShare: 5, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 5, elem: { water: 1.25 }, phys: {}, statusRes: {},
      actions: A([['e_fire_bolt', 3], ['e_fire_rain', 1], ['eb_sumi_chant', SCHED, { every: [4, 0] }]]),
      drops: {},
      desc: R.T('data.bosses_ash.LIST.b_sister_younger.desc'),
    },
    b_armorman: {
      name: R.T('data.bosses_ash.LIST.b_armorman.name'), sprite: 'b_ash_barga', bossType: 'mid', lv: 8, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 0,
      elem: { water: 1.25, wind: 1.25 }, phys: { slash: 0.6, pierce: 0.75, blunt: 1.4 }, statusRes: { stun: 0.5 },
      actions: A([['attack', 3], ['e_armor_break', 1], ['e_harden', 1, { once: true }], ['eb_barga_raise', SCHED, { every: [3, 0] }]]),
      drops: MID('i_potion'),
      desc: R.T('data.bosses_ash.LIST.b_armorman.desc'),
    },
    b_zakuro: {
      name: R.T('data.bosses_ash.LIST.b_zakuro.name'), sprite: 'b_ash_zakuro', bossType: 'mid', lv: 9, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 10, elem: {}, phys: {}, statusRes: { sleep: 0.5, confuse: 0.5 },
      actions: A([['attack', 3], ['eb_zakuro_cut', 2], ['eb_zakuro_stance', SCHED, { every: [3, 1] }], ['eb_zakuro_draw', SCHED, { hpBelow: 0.5, once: true }]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses_ash.LIST.b_zakuro.phases.0.msg'), set: { buffs: { atk: 1, agi: 1 } } }],
      drops: MID('i_ether'),
      desc: R.T('data.bosses_ash.LIST.b_zakuro.desc'),
    },
  };
  for (const id in LIST) L[id] = LIST[id];

  // ------------------------------------------------------------ 行動（予告 → 次の手番の大技。E18）
  Object.assign(R.DB.bossActions, {
    eb_tamer_whip: { name: R.T('bossActions.eb_tamer_whip.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.3, kind: 'slash' }], fx: 'slash', msg: R.T('bossActions.eb_tamer_whip.msg') },
    eb_tamer_whistle: { name: R.T('bossActions.eb_tamer_whistle.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_tamer_whistle.msg'),
      telegraph: { text: R.T('bossActions.eb_tamer_whistle.telegraph.text'), pose: 'tele', tint: '#e8c890', next: 'eb_rock_charge', guard: 'defend', lethal: true } },
    eb_rock_charge: { name: R.T('bossActions.eb_rock_charge.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt' }], fx: 'strike3', msg: R.T('bossActions.eb_rock_charge.msg') },
    eb_hinoe_mend: { name: R.T('bossActions.eb_hinoe_mend.name'), kind: 'enemy', target: 'ally', effects: [{ type: 'heal', pct: 0.3 }], fx: 'heal', msg: R.T('bossActions.eb_hinoe_mend.msg') },
    eb_hinoe_raise: { name: R.T('bossActions.eb_hinoe_raise.name'), kind: 'enemy', target: 'ally_dead', effects: [{ type: 'revive', pct: 0.5 }], fx: 'revive', msg: R.T('bossActions.eb_hinoe_raise.msg') },
    eb_sumi_chant: { name: R.T('bossActions.eb_sumi_chant.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_sumi_chant.msg'),
      telegraph: { text: R.T('bossActions.eb_sumi_chant.telegraph.text'), pose: 'tele', tint: '#ffb070', next: 'eb_sumi_pillar', guard: 'defend', lethal: true } },
    eb_sumi_pillar: { name: R.T('bossActions.eb_sumi_pillar.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'fire', element: 'fire' }], fx: 'fire3', msg: R.T('bossActions.eb_sumi_pillar.msg') },
    eb_barga_raise: { name: R.T('bossActions.eb_barga_raise.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_barga_raise.msg'),
      telegraph: { text: R.T('bossActions.eb_barga_raise.telegraph.text'), pose: 'tele', tint: '#d0d0d8', next: 'eb_barga_sweep', guard: 'defend', lethal: true } },
    eb_barga_sweep: { name: R.T('bossActions.eb_barga_sweep.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'slash' }], fx: 'slash3', msg: R.T('bossActions.eb_barga_sweep.msg') },
    eb_zakuro_cut: { name: R.T('bossActions.eb_zakuro_cut.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, kind: 'slash' }], fx: 'slash2', msg: R.T('bossActions.eb_zakuro_cut.msg') },
    eb_zakuro_stance: { name: R.T('bossActions.eb_zakuro_stance.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_zakuro_stance.msg'),
      telegraph: { text: R.T('bossActions.eb_zakuro_stance.telegraph.text'), pose: 'tele', tint: '#e0e8ff', next: 'eb_zakuro_flash', guard: 'defend', lethal: true } },
    eb_zakuro_flash: { name: R.T('bossActions.eb_zakuro_flash.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.95, guardPct: 0.08, kind: 'slash' }], fx: 'slash3', msg: R.T('bossActions.eb_zakuro_flash.msg') },
    eb_zakuro_draw: { name: R.T('bossActions.eb_zakuro_draw.name'), kind: 'enemy', target: 'self', effects: [{ type: 'buff', stat: 'atk', stages: 1 }], fx: 'buff', msg: R.T('bossActions.eb_zakuro_draw.msg') },
    eb_hound_inhale: { name: R.T('bossActions.eb_hound_inhale.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_hound_inhale.msg'),
      telegraph: { text: R.T('bossActions.eb_hound_inhale.telegraph.text'), pose: 'tele', tint: '#ffa060', next: 'eb_hound_inferno', guard: 'defend', lethal: true } },
    eb_hound_inferno: { name: R.T('bossActions.eb_hound_inferno.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'fire', element: 'fire' }], fx: 'breath_fire', msg: R.T('bossActions.eb_hound_inferno.msg') },
    eb_beast_swell: { name: R.T('bossActions.eb_beast_swell.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_beast_swell.msg'),
      telegraph: { text: R.T('bossActions.eb_beast_swell.telegraph.text'), pose: 'tele', tint: '#ff9050', next: 'eb_beast_eruption', guard: 'defend', lethal: true } },
    eb_beast_eruption: { name: R.T('bossActions.eb_beast_eruption.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'fire', element: 'fire' }], fx: 'explosion2', msg: R.T('bossActions.eb_beast_eruption.msg') },
  });

  // ------------------------------------------------------------ 炎の番犬・溶岩の巨獣（bosses.js の形に予告を足す）
  const H = L.b_hellhound;
  if (H) {
    H.actions = A([['attack', 2], ['eb_twin_fang', 2], ['eb_flame_howl', 1], ['eb_lava_breath', 1], ['eb_hound_inhale', SCHED, { every: [4, 1] }],
      ['eb_hound_fury', 1, { hpBelow: 0.5, once: true }]]);
    H.desc = R.T('data.bosses_ash.desc');
    H.s = { hp: 0.95, atk: 0.4, mag: 0.4 };
  }
  const B = L.b_lavabeast;
  if (B) {
    B.actions = A([['attack', 2], ['eb_lava_wave', 2, { hpAbove: 0.5 }], ['eb_magma_fist', 2, { hpAbove: 0.5 }], ['eb_beast_swell', SCHED, { every: [4, 1] }],
      ['eb_obsidian_crush', 3, { hpBelow: 0.5 }], ['eb_ash_storm', 2, { hpBelow: 0.5 }]]);
    B.desc = R.T('data.bosses_ash.desc_2');
    B.s = { hp: 0.5, atk: 0.58, mag: 0.58 };   // 2026-10-01: 地方ボスの通常の技が 1 人の最大 HP の 3〜4% しか削らず弱すぎた（オーナー「砂の王が弱すぎる」→ 地方ボス全体を見直し）。atk・mag を約 1.6 倍（sim_bosses）
    // 第 2 の姿の絵（冷えた黒い岩）は無いので、同じ絵のまま（b_lavabeast_cold の絵は描いていない）
    for (const p of B.phases || []) if (p.set && p.set.sprite && !(typeof window !== 'undefined' && window.RPG_MEDIA && window.RPG_MEDIA.monsters && window.RPG_MEDIA.monsters[p.set.sprite])) delete p.set.sprite;
  }
  for (const id of ['b_tamer', 'b_rockbeast']) if (L[id]) L[id].s = { hp: 0.9, atk: 0.55, mag: 0.55 };
  for (const id of ['b_sister_elder', 'b_sister_younger']) if (L[id]) L[id].s = { hp: 0.8, atk: 0.55, mag: 0.55 };
  if (L.b_armorman) L.b_armorman.s = { hp: 1.3, atk: 0.55, mag: 0.55, def: 1.4 };
  if (L.b_zakuro) L.b_zakuro.s = { hp: 1.4, atk: 0.6, mag: 0.6 };
})(window.RPG);
