// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/bosses.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// Bosses: 34 monsters in 26 troops (DESIGN §9.11). Troops are in troops.js, actions
// (eb_*) in bosses_actions.js, sprites (mon:<sprite>) by art-boss A15.
//
// Stats are NOT written here: R.Mon.fillStats (battle A2, onData) builds hp/atk/… from
// `lv`, `bossType` and `hpShare` with the §9.11.2 table (hp = hpBoss(lv) × (hpShare ??
// hpMul), others = curve(lv) × the bossType multipliers × `s`). `lv` is the troop's Lb:
// tier-scaled troops write LZ(0) + lvOff and are stretched to the battle's Lb.
// `s` holds the per-boss personality, set with tools/sim_bosses.js on the real engine. DESIGN
// §9.11.2 asks for ±20 %; the calibrated values go further (hp ×0.5–1.65, region, finale and
// post-game bosses atk/mag ×0.5–0.85, the last form of ネムレア all ×0.5) because the bossType
// table is off for the current engine and party model. They stay inside the species range
// 0.5–2.0 (§4.14.2); reported to the lead (円環竜 would need atk/mag ≈ 0.35 for §4.17.3-C3).
// `addOf` names the leader of an 'add' (お供) so the add can take its multipliers.
// Element / strike / status values are final (§9.0 0.5); status resistances list only
// the boss's own additions (battle takes max with the boss defaults of §4.8.3).
(function (R) {
  'use strict';

  // Scheduled moves. The engine picks among the actions whose cond holds by weight (§9.1.7), so a move written
  // "n手ごと" with the §9.11.4 table weight happens on only some of its turns. The moves below are the tricks §9.11.3
  // builds a fight around and §9.13.2 X3 asks to see in every battle (the band's encore, the roots feeding and
  // coming back, the mist double, the octopus regrowing legs) and the telegraphed patterns ("もぐったら防御",
  // the orrery's readable sun → moon → star): their table weight is multiplied by SCHED, so on its turn the move is
  // taken unless it has nothing to do (no fallen ally, nobody hurt, three already out). Other "n手ごと" moves keep
  // the table weight. tools/check_boss.js compares the table weight × SCHED for these ids.
  const SCHED = 100;
  const SCHEDULED = new Set(['eb_encore', 'eb_feed', 'eb_call_roots', 'eb_call_double', 'eb_regrow',
    'eb_sink', 'eb_sand_strike', 'eb_sun_orb', 'eb_moon_orb', 'eb_star_orb']);
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w: SCHEDULED.has(id) && cond.every ? w * SCHED : w, cond } : { id, w }));
  const MID = (seed) => ({ normal: { pool: 'p_boss_mid', rate: 1 }, bonus: { item: seed, rate: 1 } });
  // bonus に 'p_' で始まる id を渡すとプール（p_heal: 終盤の前は癒やしの水、終盤から癒やしの霊水。オーナー 2026-09-28「全回復系は基本終盤から」）
  const REGION = (seed) => ({ normal: { pool: 'p_boss', rate: 1 }, bonus: /^p_/.test(seed) ? { pool: seed, rate: 1 } : { item: seed, rate: 1 } });
  const CONSTRUCT_PHYS = { slash: 0.75, blunt: 1.5, pierce: 0.75 };
  const CONSTRUCT_RES = { poison: 1, sleep: 1, confuse: 1, death: 1 };
  const UNDEAD_RES = { poison: 1, death: 1, sleep: 1, confuse: 0.5 };
  const SPIRIT_RES = { poison: 1, death: 1, stun: 1 };
  const ALL = (v) => ({ fire: v, water: v, wind: v, earth: v, light: v, dark: v });

  // ---- personality `s` per boss (calibrated with `node tools/sim_bosses.js --tune --write`; that command
  // rewrites the block between these two markers. Members of one troop share the troop's values) ----
  // @@S-BEGIN
  const S = {
    b_pageeater: { hp: 1.7 },
    b_moth: { hp: 1.7 },
    b_rooteater: { hp: 0.9, atk: 0.6, mag: 0.6 },
    b_root: { hp: 1, atk: 0.5, mag: 0.5 },
    b_sandworm: { hp: 1.1 },
    b_sandking: { hp: 1, atk: 0.7, mag: 0.7 },
    b_icegiant: { hp: 1.25 },
    b_whitedragon: { hp: 1.6, atk: 0.6, mag: 0.6 },
    b_doll_conductor: { hp: 0.9, atk: 0.85, mag: 0.85 },
    b_doll_violin: { hp: 0.9, atk: 0.85, mag: 0.85 },
    b_doll_drum: { hp: 0.9, atk: 0.85, mag: 0.85 },
    b_doll_flute: { hp: 0.9, atk: 0.85, mag: 0.85 },
    b_mistbeast: { hp: 0.7, atk: 0.5, mag: 0.5 },
    b_mist_double: { hp: 0.7, atk: 0.5, mag: 0.5 },
    b_octopus: { hp: 1.1 },
    b_tentacle: { hp: 1.1 },
    b_captain: { hp: 1.1, atk: 0.6, mag: 0.6 },
    b_rockeater: { hp: 1.35 },
    b_ironwarden: { hp: 0.65, atk: 0.5, mag: 0.5 },
    b_hellhound: { hp: 1.25, atk: 0.7, mag: 0.7 },
    b_lavabeast: { hp: 0.9, atk: 0.6, mag: 0.6 },
    b_orrery: { hp: 0.85 },
    b_stareater: { hp: 1.1, atk: 0.6, mag: 0.6 },
    b_rowell1: { hp: 1.35 },
    b_rowell2: { hp: 1.35 },
    b_bookgolem: { hp: 0.8, atk: 0.85, mag: 0.85 },
    b_shade_sword: { hp: 0.95, atk: 0.6, mag: 0.6 },
    b_shade_prayer: { hp: 0.95, atk: 0.6, mag: 0.6 },
    b_shade_star: { hp: 0.95, atk: 0.6, mag: 0.6 },
    b_lazaro: { hp: 0.9 },
    b_nemrea1: { hp: 0.55, atk: 0.9, mag: 0.9 },
    // 持ち主 2026-10-04（装備のティアの見直し）: クリア後のボスは店 8・本編のレア 9〜10 では勝てず、ティア 11〜12 を集めて勝てる強さ（tools/sim_gear_bosses.js）。
    //   残響 hp 0.9 → 2.8・atk 0.7 → 1.5（P-c 23%・P-d 43%・P-e 100%）、円環竜 hp 0.6 → 1.7・atk 0.64 → 1.55（P-c 0%・P-d 0%・P-e 69%・P-f 78%）
    b_valzard_echo: { hp: 2.8, atk: 1.5, mag: 1.5 },
    b_ouroboros: { hp: 1.7, atk: 1.55, mag: 1.55 },   // SYSTEMS_REWORK phase 3 (C3: the normal set won 25–45 %): atk/mag 0.55 → 0.64; 2026-10-04 → 1.55 (gear tiers)
  };
  // @@S-END

  const LIST = {
    // ------------------------------------------------------------ 序章
    b_pageeater: {
      name: R.T('data.bosses.LIST.b_pageeater.name'), sprite: 'boss_pageeater', bossType: 'prologue', lv: 8, actsPerTurn: 1,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { fire: 1.5, light: 0.5, dark: 1.5 }, phys: { slash: 1.25, blunt: 0.75 },
      statusRes: { poison: 1, death: 1, stun: 1, sleep: 0.5, confuse: 0.5 },
      actions: A([['attack', 4], ['eb_page_storm', 2], ['eb_eat_words', 1, { every: [3, 2] }],
        ['eb_ink_spit', 1, { every: [4, 1] }], ['eb_devour', 1]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_pageeater.phases.0.msg'), set: { actsPerTurn: 2 } }],
      drops: MID('i_ether'),
      desc: R.T('data.bosses.LIST.b_pageeater.desc'),
    },

    // ------------------------------------------------------------ 地方1 ヴェルダの森
    b_moth: {
      name: R.T('data.bosses.LIST.b_moth.name'), sprite: 'boss_moth', bossType: 'mid', lv: 8, actsPerTurn: 1,
      race: 'insect', flags: ['boss', 'flying'], eva: 10,
      elem: { wind: 1.5, earth: 0.5 }, statusRes: { poison: 0.5 },
      actions: A([['attack', 3], ['eb_scale_sleep', 2, { every: [3, 0] }], ['eb_scale_poison', 2], ['eb_wing_gale', 2],
        ['eb_eye_spots', 1, { every: [4, 2] }], ['eb_moth_dive', 2]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_moth.phases.0.msg'), set: { actsPerTurn: 2 } }],
      drops: MID('i_ether'),
      desc: R.T('data.bosses.LIST.b_moth.desc'),
    },
    b_rooteater: {
      name: R.T('data.bosses.LIST.b_rooteater.name'), sprite: 'boss_rooteater', bossType: 'region', lv: 8, hpShare: 15, actsPerTurn: 2,
      race: 'insect', affinity: 'earth', flags: ['boss'], eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, statusRes: { poison: 0.5 },
      actions: A([['attack', 3], ['eb_root_drain', 2], ['eb_rot_breath', 2, { every: [3, 1] }],
        ['eb_call_roots', 1, { every: [4, 3], countBelow: 3 }], ['eb_body_slam', 2]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_rooteater.phases.0.msg'), set: { buffs: { atk: 1 } } }],
      drops: REGION('p_heal'),
      desc: R.T('data.bosses.LIST.b_rooteater.desc'),
    },
    b_root: {
      name: R.T('data.bosses.LIST.b_root.name'), sprite: 'boss_root', bossType: 'add', addOf: 'b_rooteater', lv: 8, hpShare: 1.5, actsPerTurn: 1,
      race: 'plant', flags: ['boss'], eva: 5,
      elem: { fire: 1.5, water: 0.5, wind: 1.5, earth: 0.25 }, phys: { slash: 1.25 },
      statusRes: { sleep: 0.5, poison: 0.5 },
      actions: A([['attack', 2], ['eb_root_whip', 3], ['eb_feed', 2, { every: [2, 1] }]]),
      drops: {},
      desc: R.T('data.bosses.LIST.b_root.desc'),
    },

    // ------------------------------------------------------------ 地方2 ザハラ砂漠
    b_sandworm: {
      name: R.T('data.bosses.LIST.b_sandworm.name'), sprite: 'b_sandworm', bossType: 'mid', lv: 8, actsPerTurn: 1,
      race: 'beast', affinity: 'earth', flags: ['boss'], eva: 5,
      elem: { wind: 1.5, earth: 0.25 },
      actions: A([['attack', 2], ['eb_sink', 2, { every: [3, 0] }], ['eb_sand_strike', 3, { every: [3, 1] }],
        ['eb_quicksand', 2], ['eb_swallow_whole', 1]]),
      drops: MID('i_ether'),
      desc: R.T('data.bosses.LIST.b_sandworm.desc'),
    },
    b_sandking: {
      name: R.T('data.bosses.LIST.b_sandking.name'), sprite: 'b_sandking', bossType: 'region', lv: 7, hpShare: 16, actsPerTurn: 2,
      race: 'undead', flags: ['boss'], eva: 5,
      elem: { water: 1.25, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: UNDEAD_RES,
      actions: A([['attack', 2], ['eb_steal_name', 2], ['eb_king_sand', 2],
        ['eb_raise_guard', 1, { every: [4, 2], countBelow: 3 }], ['eb_withering', 2]]),
      phases: [{ hpBelow: 0.4, msg: R.T('data.bosses.LIST.b_sandking.phases.0.msg'), set: { buffs: { atk: 1, mag: 1 } } }],
      drops: REGION('p_heal'),
      desc: R.T('data.bosses.LIST.b_sandking.desc'),
    },

    // ------------------------------------------------------------ 地方3 ノルデン雪原
    b_icegiant: {
      name: R.T('data.bosses.LIST.b_icegiant.name'), sprite: 'boss_frost_giant', bossType: 'mid', lv: 9, actsPerTurn: 1,
      race: 'humanoid', affinity: 'water', flags: ['boss'], eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 },
      actions: A([['attack', 3], ['eb_ice_hammer', 2], ['eb_avalanche_drop', 2], ['eb_frost_exhale', 1],
        ['eb_ice_wall', 1, { hpBelow: 0.6, once: true }]]),
      drops: MID('i_ether'),
      desc: R.T('data.bosses.LIST.b_icegiant.desc'),
    },
    b_whitedragon: {
      name: R.T('data.bosses.LIST.b_whitedragon.name'), sprite: 'boss_whitedragon', bossType: 'region', lv: 7, actsPerTurn: 2,
      race: 'dragon', affinity: 'water', flags: ['boss', 'flying'], eva: 10,
      elem: { water: -1, wind: 1.5, earth: 1.5, light: 0.75, dark: 0.75 },
      phys: { slash: 0.75, pierce: 1.25 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: A([['attack', 2], ['eb_white_blizzard', 2], ['eb_ice_claw', 2], ['eb_dragon_tail', 2],
        ['eb_frozen_roar', 1, { every: [4, 1] }], ['eb_glacier_fall', 2, { hpBelow: 0.5 }]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_whitedragon.phases.0.msg'), set: { elem: { fire: 1.5 } } }],
      drops: REGION('p_heal'),
      desc: R.T('data.bosses.LIST.b_whitedragon.desc'),
    },

    // ------------------------------------------------------------ 地方4 グレイモア湿原
    b_doll_conductor: {
      name: R.T('data.bosses.LIST.b_doll_conductor.name'), sprite: 'b_doll_conductor', bossType: 'mid', lv: 8, hpShare: 4, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_baton', 2], ['eb_encore', 3, { every: [3, 2], allyDown: true }],
        ['eb_crescendo', 1, { every: [4, 0] }]]),
      drops: MID('i_ether'),
      desc: R.T('data.bosses.LIST.b_doll_conductor.desc'),
    },
    b_doll_violin: {
      name: R.T('data.bosses.LIST.b_doll_violin.name'), sprite: 'b_doll_violin', bossType: 'add', addOf: 'b_doll_conductor', lv: 8, hpShare: 2, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_sad_tune', 2], ['eb_bow_slash', 2]]),
      drops: {},
      desc: R.T('data.bosses.LIST.b_doll_violin.desc'),
    },
    b_doll_drum: {
      name: R.T('data.bosses.LIST.b_doll_drum.name'), sprite: 'b_doll_drum', bossType: 'add', addOf: 'b_doll_conductor', lv: 8, hpShare: 2, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_drum_roll', 3]]),
      drops: {},
      desc: R.T('data.bosses.LIST.b_doll_drum.desc'),
    },
    b_doll_flute: {
      name: R.T('data.bosses.LIST.b_doll_flute.name'), sprite: 'b_doll_flute', bossType: 'add', addOf: 'b_doll_conductor', lv: 8, hpShare: 2, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 1], ['eb_flute_lullaby', 2], ['eb_shrill', 2]]),
      drops: {},
      desc: R.T('data.bosses.LIST.b_doll_flute.desc'),
    },
    b_mistbeast: {
      name: R.T('data.bosses.LIST.b_mistbeast.name'), sprite: 'boss_mistbeast', bossType: 'region', lv: 9, hpShare: 18, actsPerTurn: 2,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { wind: 1.5, light: 1.5 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 2], ['eb_mist_hand', 2], ['eb_mist_breath', 2],
        ['eb_call_double', 1, { every: [4, 1], countBelow: 3 }], ['eb_witch_mimic', 2], ['eb_inhale_mist', 1, { every: [4, 3] }]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_mistbeast.phases.0.msg'), set: { phys: { slash: 1, blunt: 1, pierce: 1 } } }],
      drops: REGION('p_heal'),
      desc: R.T('data.bosses.LIST.b_mistbeast.desc'),
    },
    b_mist_double: {
      name: R.T('data.bosses.LIST.b_mist_double.name'), sprite: 'b_mist_double', bossType: 'add', addOf: 'b_mistbeast', lv: 9, hpShare: 1, actsPerTurn: 1,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { wind: 1.5, light: 1.5 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 2], ['eb_cold_touch', 2]]),
      drops: {},
      desc: R.T('data.bosses.LIST.b_mist_double.desc'),
    },

    // ------------------------------------------------------------ 地方5 マレア諸島
    b_octopus: {
      name: R.T('data.bosses.LIST.b_octopus.name'), sprite: 'b_octopus', bossType: 'mid', lv: 8, hpShare: 7, actsPerTurn: 1,
      race: 'aquatic', affinity: 'water', flags: ['boss'], eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 },
      actions: A([['attack', 2], ['eb_ink_cloud', 1, { every: [3, 0] }], ['eb_crush_hug', 2],
        // every [3, 2] instead of the table's [4, 3]: a mid-boss fight is ~6 rounds, [4, 3] gave the octopus one
        // chance to regrow a leg; §9.13.2 X3 wants the regrowth in every fight (reported to the lead)
        ['eb_regrow', 2, { every: [3, 2], countBelow: 3 }], ['eb_whirl', 2]]),
      drops: MID('i_ether'),
      desc: R.T('data.bosses.LIST.b_octopus.desc'),
    },
    b_tentacle: {
      name: R.T('data.bosses.LIST.b_tentacle.name'), sprite: 'boss_tentacle', bossType: 'add', addOf: 'b_octopus', lv: 8, hpShare: 1.5, actsPerTurn: 1,
      race: 'aquatic', flags: ['boss'], eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 },
      actions: A([['attack', 2], ['eb_tentacle_bind', 3]]),
      drops: {},
      desc: R.T('data.bosses.LIST.b_tentacle.desc'),
    },
    b_captain: {
      name: R.T('data.bosses.LIST.b_captain.name'), enrageText: 'serious', sprite: 'b_captain', bossType: 'region', lv: 9, hpShare: 16, actsPerTurn: 2,
      race: 'undead', flags: ['boss'], eva: 5,
      elem: { earth: 1.25, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: UNDEAD_RES,
      actions: A([['attack', 2], ['eb_cutlass', 2], ['eb_fire_volley', 2], ['eb_ghost_shanty', 1, { every: [4, 2] }],
        ['eb_call_crew', 1, { every: [4, 0], countBelow: 3 }], ['eb_anchor_throw', 1]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_captain.phases.0.msg'), set: { buffs: { atk: 1 } } }],
      drops: REGION('p_heal'),
      desc: R.T('data.bosses.LIST.b_captain.desc'),
    },

    // ------------------------------------------------------------ 地方6 ガルド山地
    b_rockeater: {
      name: R.T('data.bosses.LIST.b_rockeater.name'), sprite: 'b_rockeater', bossType: 'mid', lv: 8, actsPerTurn: 1,
      race: 'insect', affinity: 'earth', flags: ['boss'], eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, statusRes: { poison: 0.5 },
      actions: A([['attack', 2], ['eb_rock_crunch', 2, { every: [3, 2] }], ['eb_gravel_spit', 2], ['eb_cave_in', 2], ['eb_grind', 2]]),
      drops: MID('i_ether'),
      desc: R.T('data.bosses.LIST.b_rockeater.desc'),
    },
    b_ironwarden: {
      name: R.T('data.bosses.LIST.b_ironwarden.name'), sprite: 'b_ironwarden', bossType: 'region', lv: 13, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.5, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_iron_fist', 2], ['eb_anvil_drop', 2], ['eb_forge_breath', 2],
        ['eb_iron_wall', 1, { hpBelow: 0.7, once: true }]]),
      phases: [
        { hpBelow: 0.75, msg: R.T('data.bosses.LIST.b_ironwarden.phases.0.msg'), set: { actsPerTurn: 2 } },
        { hpBelow: 0.3, msg: R.T('data.bosses.LIST.b_ironwarden.phases.1.msg'), set: { elem: { water: 2 }, buffs: { atk: 1 } } },
      ],
      drops: REGION('p_heal'),
      desc: R.T('data.bosses.LIST.b_ironwarden.desc'),
    },

    // ------------------------------------------------------------ 地方7 灰の荒野
    b_hellhound: {
      name: R.T('data.bosses.LIST.b_hellhound.name'), sprite: 'boss_hellhound', bossType: 'mid', lv: 9, actsPerTurn: 2,
      race: 'beast', affinity: 'fire', flags: ['boss'], eva: 5,
      elem: { fire: 0, water: 1.5 },
      actions: A([['attack', 2], ['eb_twin_fang', 2], ['eb_flame_howl', 1, { every: [3, 1] }], ['eb_lava_breath', 2],
        ['eb_hound_fury', 1, { hpBelow: 0.5, once: true }]]),
      drops: MID('i_ether'),
      desc: R.T('data.bosses.LIST.b_hellhound.desc'),
    },
    b_lavabeast: {
      name: R.T('data.bosses.LIST.b_lavabeast.name'), sprite: 'boss_flame_lord', bossType: 'region', lv: 9, actsPerTurn: 2,
      race: 'demon', affinity: 'fire', flags: ['boss'], eva: 5,
      elem: { fire: -1, water: 1.5, light: 1.5, dark: 0.5 }, statusRes: { death: 0.8 },
      actions: A([['attack', 2], ['eb_lava_wave', 2, { hpAbove: 0.5 }], ['eb_eruption', 2, { hpAbove: 0.5 }],
        ['eb_magma_fist', 2, { hpAbove: 0.5 }], ['eb_obsidian_crush', 3, { hpBelow: 0.5 }], ['eb_ash_storm', 2, { hpBelow: 0.5 }]]),
      phases: [{
        hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_lavabeast.phases.0.msg'),
        set: { elem: { fire: 0.5, water: 1, wind: 1.5, earth: 0.25 }, buffs: { def: 2, agi: -1 }, sprite: 'b_lavabeast_cold' },
      }],
      drops: REGION('p_heal'),
      desc: R.T('data.bosses.LIST.b_lavabeast.desc'),
    },

    // ------------------------------------------------------------ 地方8 オルビス高原
    b_orrery: {
      name: R.T('data.bosses.LIST.b_orrery.name'), sprite: 'boss_star_guardian', bossType: 'mid', lv: 12, actsPerTurn: 1,
      race: 'construct', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 1], ['eb_sun_orb', 3, { every: [3, 0] }], ['eb_moon_orb', 3, { every: [3, 1] }],
        ['eb_star_orb', 3, { every: [3, 2] }], ['eb_orbit_shield', 1, { hpBelow: 0.6, once: true }]]),
      drops: MID('i_ether'),
      desc: R.T('data.bosses.LIST.b_orrery.desc'),
    },
    b_stareater: {
      name: R.T('data.bosses.LIST.b_stareater.name'), sprite: 'boss_stareater', bossType: 'region', lv: 9, actsPerTurn: 2,
      race: 'demon', affinity: 'dark', flags: ['boss'], eva: 5,
      elem: { light: 1.5, dark: 0.25 }, statusRes: { death: 0.8 },
      actions: A([['attack', 2], ['eb_swallow_star', 2, { every: [3, 2] }], ['eb_star_spit', 2], ['eb_void_fang', 2], ['eb_dark_nova', 2]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_stareater.phases.0.msg'), set: { elem: { light: 2 } } }],
      drops: REGION('p_heal'),
      desc: R.T('data.bosses.LIST.b_stareater.desc'),
    },

    // ------------------------------------------------------------ ライバル（負けても続く）
    b_rowell1: {
      name: R.T('data.bosses.LIST.b_rowell1.name'), enrageText: 'serious', sprite: 'boss_rowell', bossType: 'rival', lv: 20, actsPerTurn: 1,
      race: 'humanoid', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 },
      actions: A([['attack', 3], ['eb_silver_thrust', 2], ['eb_copy_power', 2], ['eb_ink_guard', 1, { once: true }], ['eb_record_light', 2]]),
      drops: {},
      desc: R.T('data.bosses.LIST.b_rowell1.desc'),
    },
    b_rowell2: {
      name: R.T('data.bosses.LIST.b_rowell2.name'), enrageText: 'serious', sprite: 'b_rowell2', bossType: 'rival', lv: 38, actsPerTurn: 2,
      race: 'humanoid', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 },
      actions: A([['attack', 2], ['eb_silver_thrust', 2], ['eb_pen_flurry', 2], ['eb_copy_power', 1],
        ['eb_white_page', 1, { every: [3, 1] }], ['eb_record_light', 1]]),
      drops: { steal: { item: 'ac_st_rowell', rate: 16 } },
      desc: R.T('data.bosses.LIST.b_rowell2.desc'),
    },

    // ------------------------------------------------------------ 終盤 白の大書庫（ティア 8）
    b_bookgolem: {
      name: R.T('data.bosses.LIST.b_bookgolem.name'), sprite: 'boss_bookgolem', bossType: 'fmid', lv: 56, actsPerTurn: 2,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { fire: 1.5, water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_page_blizzard', 2], ['eb_tome_slam', 2], ['eb_rebind', 1, { every: [4, 3] }],
        ['eb_call_books', 1, { every: [4, 1], countBelow: 3 }], ['eb_dust_of_ages', 1]]),
      drops: REGION('i_ether'),
      desc: R.T('data.bosses.LIST.b_bookgolem.desc'),
    },
    b_shade_sword: {
      name: R.T('data.bosses.LIST.b_shade_sword.name'), enrageText: 'serious', sprite: 'boss_shade_sword', bossType: 'fmid', lv: 56, hpShare: 8, actsPerTurn: 1,
      race: 'spirit', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 2], ['eb_shade_blade', 2], ['eb_shade_crest', 2], ['eb_shade_sweep', 1]]),
      drops: { normal: { pool: 'p_boss', rate: 1 } },
      desc: R.T('data.bosses.LIST.b_shade_sword.desc'),
    },
    b_shade_prayer: {
      name: R.T('data.bosses.LIST.b_shade_prayer.name'), enrageText: 'serious', sprite: 'boss_shade_prayer', bossType: 'fmid', lv: 56, hpShare: 6, actsPerTurn: 1,
      race: 'spirit', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 1], ['eb_shade_heal', 2, { hpBelow: 0.8 }], ['eb_shade_raise', 3, { once: true, allyDown: true }],
        ['eb_shade_holy', 2]]),
      drops: { bonus: { item: 'i_ether', rate: 1 } },
      desc: R.T('data.bosses.LIST.b_shade_prayer.desc'),
    },
    b_shade_star: {
      name: R.T('data.bosses.LIST.b_shade_star.name'), enrageText: 'serious', sprite: 'boss_shade_star', bossType: 'fmid', lv: 56, hpShare: 6, actsPerTurn: 1,
      race: 'spirit', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 1], ['eb_shade_meteor', 2], ['eb_shade_frost', 2], ['eb_shade_fire', 2]]),
      drops: { steal: { item: 'ac_st_shade_star', rate: 16 } },
      desc: R.T('data.bosses.LIST.b_shade_star.desc'),
    },
    b_lazaro: {
      name: R.T('data.bosses.LIST.b_lazaro.name'), enrageText: 'serious', sprite: 'boss_lazaro', bossType: 'fmid', lv: 56, actsPerTurn: 1,
      race: 'humanoid', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 },
      actions: A([['attack', 1], ['eb_white_book', 2], ['eb_erase_memory', 2], ['eb_silver_quill', 3],
        ['eb_page_shield', 1, { hpBelow: 0.7, once: true }], ['eb_call_scribes', 1, { every: [4, 2], countBelow: 3 }]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_lazaro.phases.0.msg'), set: { actsPerTurn: 2 } }],
      drops: REGION('p_heal'),
      desc: R.T('data.bosses.LIST.b_lazaro.desc'),
    },
    b_nemrea1: {
      name: R.T('data.bosses.LIST.b_nemrea1.name'), enrageText: 'serious', sprite: 'boss_nemrea1', bossType: 'last1', lv: 58, actsPerTurn: 2,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { light: 0.5, dark: 1.25 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 1], ['eb_whiteout', 2, { every: [3, 0] }], ['eb_oblivion_wave', 2], ['eb_paper_hand', 3],
        ['eb_erase_name', 1, { every: [4, 2] }], ['eb_blank_storm', 2]]),
      drops: {},
      desc: R.T('data.bosses.LIST.b_nemrea1.desc'),
    },
    b_nemrea2: {
      name: R.T('data.bosses.LIST.b_nemrea2.name'), enrageText: 'serious', sprite: 'boss_nemrea2', bossType: 'last2', lv: 58, actsPerTurn: 3,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { light: 1.5 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 1], ['eb_eight_legends', 2, { every: [3, 1] }], ['eb_oblivion_breath', 2], ['eb_unwrite', 3],
        ['eb_dream_sleep', 1, { every: [4, 3] }], ['eb_nemrea_rewrite', 1, { hpBelow: 0.3, once: true }]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_nemrea2.phases.0.msg'), set: { elem: ALL(1.25) } }],
      drops: {},
      desc: R.T('data.bosses.LIST.b_nemrea2.desc'),
    },

    // ------------------------------------------------------------ クリア後 忘却の底（ティア 9）
    b_valzard_echo: {
      name: R.T('data.bosses.LIST.b_valzard_echo.name'), enrageText: 'serious', sprite: 'b_valzard_echo', bossType: 'echo', lv: 64, actsPerTurn: 2,
      race: 'demon', affinity: 'dark', flags: ['boss'], eva: 5,
      elem: { light: 1.5, dark: 0.25 }, statusRes: { death: 0.8 },
      actions: A([['attack', 1], ['eb_echo_despair', 2], ['eb_echo_claw', 2], ['eb_echo_flame', 2],
        ['eb_echo_gaze', 1, { every: [4, 2] }], ['eb_echo_gather', 1, { every: [4, 3] }]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_valzard_echo.phases.0.msg'), set: { actsPerTurn: 3 } }],
      drops: {
        normal: { pool: 'p_boss', rate: 1 },
        rare: { item: 'ac_crest_fragment', rate: 4 },
        super: { item: 'w_sword_sr_echo', rate: 4 },
      },
      desc: R.T('data.bosses.LIST.b_valzard_echo.desc'),
    },
    b_ouroboros: {
      name: R.T('data.bosses.LIST.b_ouroboros.name'), sprite: 'boss_ouroboros', bossType: 'super', lv: 68, actsPerTurn: 3,
      race: 'dragon', flags: ['boss'], eva: 5,
      elem: ALL(0.75), phys: { slash: 0.75 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: A([['attack', 1], ['eb_rewind', 2, { hpAbove: 0.25, every: [5, 4] }], ['eb_eternal_breath', 2], ['eb_ring_crush', 2],
        ['eb_time_loop', 1, { every: [4, 1] }], ['eb_scale_storm', 2], ['eb_tail_devour', 1, { hpBelow: 0.5, once: true }]]),
      phases: [{ hpBelow: 0.25, msg: R.T('data.bosses.LIST.b_ouroboros.phases.0.msg'), set: { buffs: { def: -1, mdef: -1 } } }],
      drops: {
        normal: { pool: 'p_boss', rate: 1 },
        rare: { item: 'ac_ouroboros_ring', rate: 4 },
        super: { item: 'ac_sr_ouroboros', rate: 4 },
      },
      desc: R.T('data.bosses.LIST.b_ouroboros.desc'),
    },
  };
  for (const id in S) if (LIST[id]) LIST[id].s = Object.assign({}, LIST[id].s || {}, S[id]);
  Object.assign(R.DB.monsters, LIST);
  // port_mons.js: 盗み専用（STATS_REWORK §7.2、率は V2_PLAN §2.6.6）。倒しても落ちない（R.Mon.rollDrops は steal を見ない）
  LIST.b_rooteater.drops = Object.assign({}, LIST.b_rooteater.drops, { steal: { item: 'ac_st_rooteater', rate: 16 } });
  LIST.b_sandking.drops = Object.assign({}, LIST.b_sandking.drops, { steal: { item: 'ac_st_sandking', rate: 16 } });
  LIST.b_whitedragon.drops = Object.assign({}, LIST.b_whitedragon.drops, { steal: { item: 'ac_st_whitedragon', rate: 16 } });
  LIST.b_mistbeast.drops = Object.assign({}, LIST.b_mistbeast.drops, { steal: { item: 'ac_st_mistbeast', rate: 16 } });
  LIST.b_captain.drops = Object.assign({}, LIST.b_captain.drops, { steal: { item: 'ac_st_captain', rate: 16 } });
  LIST.b_ironwarden.drops = Object.assign({}, LIST.b_ironwarden.drops, { steal: { item: 'hn_st_ironwarden', rate: 16 } });
  LIST.b_lavabeast.drops = Object.assign({}, LIST.b_lavabeast.drops, { steal: { item: 'ac_st_lavabeast', rate: 16 } });
  LIST.b_stareater.drops = Object.assign({}, LIST.b_stareater.drops, { steal: { item: 'ac_st_stareater', rate: 16 } });
  LIST.b_lazaro.drops = Object.assign({}, LIST.b_lazaro.drops, { steal: { item: 'ac_st_lazaro', rate: 16 } });
  LIST.b_ouroboros.drops = Object.assign({}, LIST.b_ouroboros.drops, { steal: { item: 'bd_st_ouroboros', rate: 16 } });
  // port_mons.js: v2 の形（K.monster の size、K.boss の登録）
  for (const id in LIST) { const d = LIST[id]; if (!d.size) d.size = d.bossType === 'add' ? 'm' : 'l'; if (!R.DB.bosses[id]) R.DB.bosses[id] = d; }
  // @@V2-BEGIN 縦切りのボスの考えどころ（WORLD_REDESIGN §4.10・E18、V2_PLAN §3.6、BATTLE）。数値 s は sim_bosses で合わせる
  {
    const P = LIST.b_pageeater, M = LIST.b_moth, RE = LIST.b_rooteater, RT = LIST.b_root;
    // 数値（s）は tools/sim_bosses.js の 3 本立てで合わせた（2026-09-26、標準の一行・そのティアの店の品）
    // 予告の行動は重み 200（その手番なら必ず。§9.11.3 の SCHED と同じ考え）
    P.s = { hp: 1.3, atk: 0.7 };
    M.s = { hp: 1.2, atk: 2.2, mag: 2.2 };   // 2026-10-01（組み直し）: 半分で二度動くのをやめた分 atk・mag 1.55 → 2.2、hp 1.29 → 1.2（sim_bosses: リピート 29%・台本 99%・6.3 ラウンド）   // 2026-10-01: 1.35 → 1.29（K.BOSS_HP 1.05 倍の分を戻す。台本のラウンド 5〜7 の上の端）
    RE.s = { hp: 0.95, atk: 1.5, mag: 1.5 };   // 2026-10-01（組み直し）: 1 手番 1 回にした分 atk・mag 0.6 → 1.5、hp 1.1 → 0.95（sim_bosses: 台本 100%・10.4 ラウンド・リピート 35%）
    // ページ食らい: 紙吹雪（ランダム 3 回）を「紙を吸いこむ → 紙吹雪（全体）」の予告に置き換え
    // 2026-10-01（ボスの組み直し、オーナー「溜めはいらない」）: 序章の教える戦いなので紙を吸いこむ構え（予告）→ 紙吹雪 は残す。ただし 3 手番ごとの決まりはやめ、たまに（2 ラウンド目から）
    P.actions = A([['attack', 3], ['eb_page_gather', 3, { every: [3, 1], round: 2 }], ['eb_eat_words', 1], ['eb_ink_spit', 1], ['eb_devour', 2]]);
    // 教える戦い: 半分を切っても手数は増やさない（攻撃力が 1 段上がるだけ）
    P.phases = [{ hpBelow: 0.5, msg: R.T('data.bosses.phases.0.msg'), set: { buffs: { atk: 1 } } }];
    // ダストウィング: 眠りのりん粉を「羽の光 → 眠りのりん粉（全体、強い）」の予告に
    // 2026-10-01（ボスの組み直し）: 羽の光（予告）→ 眠りのりん粉 は 3 手番ごとの決まりをやめ、たまに（眠りが毎回続かないように）
    M.actions = A([['attack', 2], ['eb_wing_glow', 3, { every: [3, 1], round: 2 }], ['eb_scale_poison', 2], ['eb_wing_gale', 2], ['eb_eye_spots', 1], ['eb_moth_dive', 3]]);
    // 2026-10-01（ボスの組み直し）: 序盤のボスは 1 手番に 1 回。半分を切っても二度は動かず、りん粉で攻めと術が 1 段上がる
    M.phases = [{ hpBelow: 0.5, msg: R.T('data.bosses.LIST.b_moth.phases.0.msg'), set: { buffs: { atk: 1, mag: 1 } } }];
    // 根食らい: 根もぐり → 前列へ突き上げ。根を呼ぶのは根を火で焼くまで（戦闘の旗 roots_burned）
    // 2026-10-01（ボスの組み直し）: 序盤のボスは 1 手番に 1 回（前は 2 回）。予告（根もぐり）は 4 手番ごとの決まりをやめ、たまに。ほかの手番は毎回攻めるか根を呼ぶ
    RE.actsPerTurn = 1;
    RE.actions = A([['attack', 3], ['eb_root_drain', 2], ['eb_root_sink', 3, { every: [3, 1], round: 2 }], ['eb_rot_breath', 2],
      ['eb_call_roots', 2, { countBelow: 3, noFlag: 'roots_burned' }], ['eb_body_slam', 2]]);
    // 根の子分の絵は hd:mon:b_root（BEAST）。火で倒されると、根食らいはもう根を呼べない
    RT.sprite = 'b_root';
    RT.artKind = 'mon';
    RT.onBurn = { element: 'fire', flag: 'roots_burned', msg: R.T('data.bosses.onBurn.msg') };
    // 狼の群れ頭（新規、救出の戦い）。狼の土台の大きい変化形の絵（BEAST の hd:boss:boss_wolflord）
    LIST.b_wolflord = {
      name: R.T('data.bosses.b_wolflord.name'), sprite: 'boss_wolflord', bossType: 'mid', lv: 8, actsPerTurn: 1, size: 'l',
      race: 'beast', flags: ['boss'], eva: 10,
      elem: { fire: 1.25, earth: 0.75 }, phys: {}, statusRes: { sleep: 0.25 },
      // 2026-10-01（ボスの組み直し）: 前は 2 手番ごとに 息を吸う（予告）→ 遠吠え の繰り返しで、攻めるのは 5 手番に 1 度だった。
      //   いまは予告なしで遠吠え（4 回に 1 度ほど、群れが 5 匹になるまで）、ほかは噛みつく。頭を先に倒せば群れは逃げる（leader）
      actions: A([['attack', 3], ['eb_lord_bite', 3], ['eb_pack_howl', 2, { countBelow: 5 }]]),
      s: { hp: 1.6, atk: 1.5 },   // 2026-10-01（組み直し）: atk 1 → 1.5（予告の手番が減って毎手番攻める分。sim_bosses: たたかう 5%・台本 100%・6.5 ラウンド）
      leader: { msg: R.T('data.bosses.b_wolflord.leader.msg') },
      drops: MID('i_ether'),
      desc: R.T('data.bosses.b_wolflord.desc'),
    };
    // 群れの狼（群れ頭のお供。絵は狼の土台 hd:mon:wolf_1。遠吠えで増える。頭が倒れると逃げる）
    LIST.b_packwolf = {
      name: R.T('data.bosses.b_packwolf.name'), sprite: 'wolf_1', artKind: 'mon', bossType: 'add', addOf: 'b_wolflord', lv: 8, hpShare: 3.5, actsPerTurn: 1, size: 's',
      race: 'beast', flags: ['boss'], eva: 10,
      elem: { fire: 1.25, earth: 0.75 }, phys: {}, statusRes: {},
      actions: A([['attack', 3], ['e_bite', 1]]),
      s: { atk: 0.8, mag: 0.8 },   // 2026-10-01（組み直し）: 0.5 → 0.8（群れを放っておくと痛い）
      drops: {},
      desc: R.T('data.bosses.b_packwolf.desc'),
    };
    // 合体技（2026-10-01 ボスの組み直し。決まりは w_combo の R.DB.enemyCombos）
    R.defs('enemyCombos', {
      // 群れ頭の号令: 群れの狼が弱った人へ飛びかかり、頭が同じ人へ噛みつく
      c_b_lord_pack: { name: R.T('enemyCombos.c_b_lord_pack.name'), members: [{ mon: 'b_wolflord' }, { mon: 'b_packwolf' }],
        steps: [{ by: 1, act: 'ec_pack_fang', aim: 'low', seq: 'sq:ec_pack_fang' }, { by: 0, act: 'eb_lord_bite', same: true }], round: 2, chance: 0.3, cd: 3 },
      // 根の締めつけ: 根が前の人を打ってしびれさせ、根食らいが同じ人へ体当たり
      c_b_root_bind: { name: R.T('enemyCombos.c_b_root_bind.name'), members: [{ mon: 'b_rooteater' }, { mon: 'b_root' }],
        steps: [{ by: 1, act: 'eb_root_whip' }, { by: 0, act: 'eb_body_slam', same: true, seq: 'sq:ec_thorn_bite' }], round: 2, chance: 0.3, cd: 3 },
    });
    for (const id of ['b_wolflord', 'b_packwolf']) {
      if (!R.DB.monsters[id]) R.DB.monsters[id] = LIST[id];
      if (!R.DB.bosses[id]) R.DB.bosses[id] = LIST[id];
    }
  }
  // @@V2-END
})(window.RPG);
