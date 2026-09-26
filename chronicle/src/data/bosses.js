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
  const REGION = (seed) => ({ normal: { pool: 'p_boss', rate: 1 }, bonus: { item: seed, rate: 1 } });
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
    b_valzard_echo: { hp: 0.9, atk: 0.7, mag: 0.7 },
    b_ouroboros: { hp: 0.6, atk: 0.55, mag: 0.55 },
  };
  // @@S-END

  const LIST = {
    // ------------------------------------------------------------ 序章
    b_pageeater: {
      name: 'ページ食らい', sprite: 'boss_pageeater', bossType: 'prologue', lv: 8, actsPerTurn: 1,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { fire: 1.5, light: 0.5, dark: 1.5 }, phys: { slash: 1.25, blunt: 0.75 },
      statusRes: { poison: 1, death: 1, stun: 1, sleep: 0.5, confuse: 0.5 },
      actions: A([['attack', 4], ['eb_page_storm', 2], ['eb_eat_words', 1, { every: [3, 2] }],
        ['eb_ink_spit', 1, { every: [4, 1] }], ['eb_devour', 1]]),
      phases: [{ hpBelow: 0.5, msg: 'ページ食らいの体がめくれあがった！', set: { actsPerTurn: 2 } }],
      drops: MID('i_seed_wp'),
      desc: '灯台の守り歌を食べてしまった\n紙の化け物。文字が体に残る。',
    },

    // ------------------------------------------------------------ 地方1 ヴェルダの森
    b_moth: {
      name: 'ダストウィング', sprite: 'boss_moth', bossType: 'mid', lv: 8, actsPerTurn: 1,
      race: 'insect', flags: ['boss', 'flying'], eva: 10,
      elem: { fire: 1.5, wind: 1.5, earth: 0.5 }, statusRes: { poison: 0.5 },
      actions: A([['attack', 3], ['eb_scale_sleep', 2, { every: [3, 0] }], ['eb_scale_poison', 2], ['eb_wing_gale', 2],
        ['eb_eye_spots', 1, { every: [4, 2] }], ['eb_moth_dive', 2]]),
      phases: [{ hpBelow: 0.5, msg: 'ダストウィングの羽から、\nりん粉が噴き出した！', set: { actsPerTurn: 2 } }],
      drops: MID('i_seed_wp'),
      desc: '迷いの森の奥に巣くう大きなガ。\n眠りと毒のりん粉をまき散らす。',
    },
    b_rooteater: {
      name: '根食らい', sprite: 'boss_rooteater', bossType: 'region', lv: 8, hpShare: 15, actsPerTurn: 2,
      race: 'insect', affinity: 'earth', flags: ['boss'], eva: 5,
      elem: { fire: 1.5, wind: 1.5, earth: 0.25 }, statusRes: { poison: 0.5 },
      actions: A([['attack', 3], ['eb_root_drain', 2], ['eb_rot_breath', 2, { every: [3, 1] }],
        ['eb_call_roots', 1, { every: [4, 3], countBelow: 3 }], ['eb_body_slam', 2]]),
      phases: [{ hpBelow: 0.5, msg: '根食らいの白い体が、ぬらりと光った！', set: { buffs: { atk: 1 } } }],
      drops: REGION('i_seed_hp'),
      desc: '忘却から生まれ、千年樹の根を\nかじる白い虫。中は空っぽだ。',
    },
    b_root: {
      name: '根の触手', sprite: 'boss_root', bossType: 'add', addOf: 'b_rooteater', lv: 8, hpShare: 1.5, actsPerTurn: 1,
      race: 'plant', flags: ['boss'], eva: 5,
      elem: { fire: 1.5, water: 0.5, wind: 1.5, earth: 0.25 }, phys: { slash: 1.25 },
      statusRes: { sleep: 0.5, poison: 0.5 },
      actions: A([['attack', 2], ['eb_root_whip', 3], ['eb_feed', 2, { every: [2, 1] }]]),
      drops: {},
      desc: '根食らいに操られた千年樹の根。\n本体に養分を送り続ける。',
    },

    // ------------------------------------------------------------ 地方2 ザハラ砂漠
    b_sandworm: {
      name: '砂もぐり', sprite: 'b_sandworm', bossType: 'mid', lv: 8, actsPerTurn: 1,
      race: 'beast', affinity: 'earth', flags: ['boss'], eva: 5,
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 },
      actions: A([['attack', 2], ['eb_sink', 2, { every: [3, 0] }], ['eb_sand_strike', 3, { every: [3, 1] }],
        ['eb_quicksand', 2], ['eb_swallow_whole', 1]]),
      drops: MID('i_seed_mp'),
      desc: '王墓の流砂にひそむ大ミミズ。\n砂にもぐると、足もとから襲う。',
    },
    b_sandking: {
      name: '名なき砂の王', sprite: 'b_sandking', bossType: 'region', lv: 7, hpShare: 16, actsPerTurn: 2,
      race: 'undead', flags: ['boss'], eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: UNDEAD_RES,
      actions: A([['attack', 2], ['eb_steal_name', 2], ['eb_king_sand', 2],
        ['eb_raise_guard', 1, { every: [4, 2], countBelow: 3 }], ['eb_withering', 2]]),
      phases: [{ hpBelow: 0.4, msg: '王の顔の包帯がほどけ、\nうつろな目がのぞいた……。', set: { buffs: { atk: 1, mag: 1 } } }],
      drops: REGION('i_seed_hp'),
      desc: '名を砂の精霊に差し出した王。\n忘れられた名を探してさまよう。',
    },

    // ------------------------------------------------------------ 地方3 ノルデン雪原
    b_icegiant: {
      name: '氷壁の巨人', sprite: 'boss_frost_giant', bossType: 'mid', lv: 9, actsPerTurn: 1,
      race: 'humanoid', affinity: 'water', flags: ['boss'], eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 },
      actions: A([['attack', 3], ['eb_ice_hammer', 2], ['eb_avalanche_drop', 2], ['eb_frost_exhale', 1],
        ['eb_ice_wall', 1, { hpBelow: 0.6, once: true }]]),
      drops: MID('i_seed_wp'),
      desc: '白竜の峰の中腹を守る氷の巨人。\n氷の壁を張って身を守る。',
    },
    b_whitedragon: {
      name: '白竜ネーヴェ', sprite: 'boss_whitedragon', bossType: 'region', lv: 7, actsPerTurn: 2,
      race: 'dragon', affinity: 'water', flags: ['boss', 'flying'], eva: 10,
      elem: { fire: 1.25, water: -1, wind: 1.5, earth: 1.5, light: 0.75, dark: 0.75 },
      phys: { slash: 0.75, pierce: 1.25 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: A([['attack', 2], ['eb_white_blizzard', 2], ['eb_ice_claw', 2], ['eb_dragon_tail', 2],
        ['eb_frozen_roar', 1, { every: [4, 1] }], ['eb_glacier_fall', 2, { hpBelow: 0.5 }]]),
      phases: [{ hpBelow: 0.5, msg: '白竜の胸の氷に、ひびが入った！', set: { elem: { fire: 1.5 } } }],
      drops: REGION('i_seed_hp'),
      desc: '北の峰で吹雪を鎮めてきた白竜。\n忘却に心が凍りついている。',
    },

    // ------------------------------------------------------------ 地方4 グレイモア湿原
    b_doll_conductor: {
      name: '指揮者人形', sprite: 'b_doll_conductor', bossType: 'mid', lv: 8, hpShare: 4, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_baton', 2], ['eb_encore', 3, { every: [3, 2], allyDown: true }],
        ['eb_crescendo', 1, { every: [4, 0] }]]),
      drops: MID('i_seed_mp'),
      desc: '霧の館で演奏を続ける人形の長。\n倒れた楽士をよみがえらせる。',
    },
    b_doll_violin: {
      name: '弦ひき人形', sprite: 'b_doll_violin', bossType: 'add', addOf: 'b_doll_conductor', lv: 8, hpShare: 2, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_sad_tune', 2], ['eb_bow_slash', 2]]),
      drops: {},
      desc: '悲しい調べをかなでる人形。\n弓は刃のように鋭い。',
    },
    b_doll_drum: {
      name: '太鼓人形', sprite: 'b_doll_drum', bossType: 'add', addOf: 'b_doll_conductor', lv: 8, hpShare: 2, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_drum_roll', 3]]),
      drops: {},
      desc: '太鼓を打ち鳴らす兵隊の人形。\n響く音で相手をすくませる。',
    },
    b_doll_flute: {
      name: '笛人形', sprite: 'b_doll_flute', bossType: 'add', addOf: 'b_doll_conductor', lv: 8, hpShare: 2, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 1], ['eb_flute_lullaby', 2], ['eb_shrill', 2]]),
      drops: {},
      desc: '眠りを誘う笛を吹く人形。\n甲高い音で耳を刺してくる。',
    },
    b_mistbeast: {
      name: '霧食らい', sprite: 'boss_mistbeast', bossType: 'region', lv: 9, hpShare: 18, actsPerTurn: 2,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { wind: 1.5, light: 1.5 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 2], ['eb_mist_hand', 2], ['eb_mist_breath', 2],
        ['eb_call_double', 1, { every: [4, 1], countBelow: 3 }], ['eb_witch_mimic', 2], ['eb_inhale_mist', 1, { every: [4, 3] }]]),
      phases: [{ hpBelow: 0.5, msg: '霧が薄れて、\n霧食らいの本当の口がのぞいた！', set: { phys: { slash: 1, blunt: 1, pierce: 1 } } }],
      drops: REGION('i_seed_hp'),
      desc: '鐘の音が絶えた沼の霧の魔物。\n魔女の姿をまねて人をさらう。',
    },
    b_mist_double: {
      name: '霧の分身', sprite: 'b_mist_double', bossType: 'add', addOf: 'b_mistbeast', lv: 9, hpShare: 1, actsPerTurn: 1,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { wind: 1.5, light: 1.5 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 2], ['eb_cold_touch', 2]]),
      drops: {},
      desc: '霧食らいが作った魔女の幻。\n冷たい手でそっとふれてくる。',
    },

    // ------------------------------------------------------------ 地方5 マレア諸島
    b_octopus: {
      name: '深みの大ダコ', sprite: 'b_octopus', bossType: 'mid', lv: 8, hpShare: 7, actsPerTurn: 1,
      race: 'aquatic', affinity: 'water', flags: ['boss'], eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 },
      actions: A([['attack', 2], ['eb_ink_cloud', 1, { every: [3, 0] }], ['eb_crush_hug', 2],
        // every [3, 2] instead of the table's [4, 3]: a mid-boss fight is ~6 rounds, [4, 3] gave the octopus one
        // chance to regrow a leg; §9.13.2 X3 wants the regrowth in every fight (reported to the lead)
        ['eb_regrow', 2, { every: [3, 2], countBelow: 3 }], ['eb_whirl', 2]]),
      drops: MID('i_seed_wp'),
      desc: '潮の洞窟の奥にひそむ大ダコ。\n切っても切っても足が生える。',
    },
    b_tentacle: {
      name: '大ダコの足', sprite: 'boss_tentacle', bossType: 'add', addOf: 'b_octopus', lv: 8, hpShare: 1.5, actsPerTurn: 1,
      race: 'aquatic', flags: ['boss'], eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 },
      actions: A([['attack', 2], ['eb_tentacle_bind', 3]]),
      drops: {},
      desc: '深みの大ダコの太い足。\n巻きつくと、なかなか離れない。',
    },
    b_captain: {
      name: '亡霊船長グレン', sprite: 'b_captain', bossType: 'region', lv: 9, hpShare: 16, actsPerTurn: 2,
      race: 'undead', flags: ['boss'], eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: UNDEAD_RES,
      actions: A([['attack', 2], ['eb_cutlass', 2], ['eb_fire_volley', 2], ['eb_ghost_shanty', 1, { every: [4, 2] }],
        ['eb_call_crew', 1, { every: [4, 0], countBelow: 3 }], ['eb_anchor_throw', 1]]),
      phases: [{ hpBelow: 0.5, msg: '船長の目に、かすかな光が戻った……。', set: { buffs: { atk: 1 } } }],
      drops: REGION('i_seed_hp'),
      desc: '嵐の海に消えた船長の亡霊。\n霧の夜に船を岩礁へ誘う。',
    },

    // ------------------------------------------------------------ 地方6 ガルド山地
    b_rockeater: {
      name: '岩食らい', sprite: 'b_rockeater', bossType: 'mid', lv: 8, actsPerTurn: 1,
      race: 'insect', affinity: 'earth', flags: ['boss'], eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, statusRes: { poison: 0.5 },
      actions: A([['attack', 2], ['eb_rock_crunch', 2, { every: [3, 2] }], ['eb_gravel_spit', 2], ['eb_cave_in', 2], ['eb_grind', 2]]),
      drops: MID('i_seed_mp'),
      desc: '深き坑道の岩をかみ砕く大虫。\n食べるほど体が固くなる。',
    },
    b_ironwarden: {
      name: '鉄の番人', sprite: 'b_ironwarden', bossType: 'region', lv: 13, actsPerTurn: 1,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { water: 1.5, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_iron_fist', 2], ['eb_anvil_drop', 2], ['eb_forge_breath', 2],
        ['eb_iron_wall', 1, { hpBelow: 0.7, once: true }]]),
      phases: [
        { hpBelow: 0.75, msg: '鉄の番人が、完全に目を覚ました！', set: { actsPerTurn: 2 } },
        { hpBelow: 0.3, msg: '炉心が赤く燃え上がった！\n鎧のすき間から湯気が噴く！', set: { elem: { water: 2 }, buffs: { atk: 1 } } },
      ],
      drops: REGION('i_seed_hp'),
      desc: '七の層の下で眠っていた番人。\n胸の炉が燃えると手に負えない。',
    },

    // ------------------------------------------------------------ 地方7 灰の荒野
    b_hellhound: {
      name: '炎の番犬', sprite: 'boss_hellhound', bossType: 'mid', lv: 9, actsPerTurn: 2,
      race: 'beast', affinity: 'fire', flags: ['boss'], eva: 5,
      elem: { fire: 0.25, water: 1.5 },
      actions: A([['attack', 2], ['eb_twin_fang', 2], ['eb_flame_howl', 1, { every: [3, 1] }], ['eb_lava_breath', 2],
        ['eb_hound_fury', 1, { hpBelow: 0.5, once: true }]]),
      drops: MID('i_seed_wp'),
      desc: '火口の壁画を守る二つ頭の犬。\n口から溶岩がしたたっている。',
    },
    b_lavabeast: {
      name: '溶岩の巨獣', sprite: 'boss_flame_lord', bossType: 'region', lv: 9, actsPerTurn: 2,
      race: 'demon', affinity: 'fire', flags: ['boss'], eva: 5,
      elem: { fire: -1, water: 1.5, light: 1.5, dark: 0.5 }, statusRes: { death: 0.8 },
      actions: A([['attack', 2], ['eb_lava_wave', 2, { hpAbove: 0.5 }], ['eb_eruption', 2, { hpAbove: 0.5 }],
        ['eb_magma_fist', 2, { hpAbove: 0.5 }], ['eb_obsidian_crush', 3, { hpBelow: 0.5 }], ['eb_ash_storm', 2, { hpBelow: 0.5 }]]),
      phases: [{
        hpBelow: 0.5, msg: '溶岩が冷えて、黒い岩に固まった！',
        set: { elem: { fire: 0.5, water: 1, wind: 1.5, earth: 0.25 }, buffs: { def: 2, agi: -1 }, sprite: 'b_lavabeast_cold' },
      }],
      drops: REGION('i_seed_hp'),
      desc: '守り手を失った山の火が、\n獣の形になって暴れている。',
    },

    // ------------------------------------------------------------ 地方8 オルビス高原
    b_orrery: {
      name: '天球の番人', sprite: 'boss_star_guardian', bossType: 'mid', lv: 12, actsPerTurn: 1,
      race: 'construct', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 1], ['eb_sun_orb', 3, { every: [3, 0] }], ['eb_moon_orb', 3, { every: [3, 1] }],
        ['eb_star_orb', 3, { every: [3, 2] }], ['eb_orbit_shield', 1, { hpBelow: 0.6, once: true }]]),
      drops: MID('i_seed_mp'),
      desc: '星読みの塔を守るからくり。\n太陽・月・星の順に撃ってくる。',
    },
    b_stareater: {
      name: '星食らい', sprite: 'boss_stareater', bossType: 'region', lv: 9, actsPerTurn: 2,
      race: 'demon', affinity: 'dark', flags: ['boss'], eva: 5,
      elem: { light: 1.5, dark: 0.25 }, statusRes: { death: 0.8 },
      actions: A([['attack', 2], ['eb_swallow_star', 2, { every: [3, 2] }], ['eb_star_spit', 2], ['eb_void_fang', 2], ['eb_dark_nova', 2]]),
      phases: [{ hpBelow: 0.5, msg: '飲みこんだ星が、腹の中で光っている……！', set: { elem: { light: 2 } } }],
      drops: REGION('i_seed_hp'),
      desc: '名を失った星を食べる闇の獣。\n腹の中で星がかすかに光る。',
    },

    // ------------------------------------------------------------ ライバル（負けても続く）
    b_rowell1: {
      name: 'ロウェル', sprite: 'boss_rowell', bossType: 'rival', lv: 20, actsPerTurn: 1,
      race: 'humanoid', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 },
      actions: A([['attack', 3], ['eb_silver_thrust', 2], ['eb_copy_power', 2], ['eb_ink_guard', 1, { once: true }], ['eb_record_light', 2]]),
      drops: {},
      desc: '記録院の若い記録官。\n銀のペンを細剣のように使う。',
    },
    b_rowell2: {
      name: 'ロウェル', sprite: 'b_rowell2', bossType: 'rival', lv: 38, actsPerTurn: 2,
      race: 'humanoid', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 },
      actions: A([['attack', 2], ['eb_silver_thrust', 2], ['eb_pen_flurry', 2], ['eb_copy_power', 1],
        ['eb_white_page', 1, { every: [3, 1] }], ['eb_record_light', 1]]),
      drops: {},
      desc: '記録院の若い記録官。迷いを\n振り切るように、ペンを振るう。',
    },

    // ------------------------------------------------------------ 終盤 白の大書庫（ティア 8）
    b_bookgolem: {
      name: '本の巨人', sprite: 'boss_bookgolem', bossType: 'fmid', lv: 56, actsPerTurn: 2,
      race: 'construct', flags: ['boss'], eva: 5,
      elem: { fire: 1.5, water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      actions: A([['attack', 2], ['eb_page_blizzard', 2], ['eb_tome_slam', 2], ['eb_rebind', 1, { every: [4, 3] }],
        ['eb_call_books', 1, { every: [4, 1], countBelow: 3 }], ['eb_dust_of_ages', 1]]),
      drops: REGION('i_seed_mp'),
      desc: '何千冊もの本を鎖でしばった巨人。\n写本の間の階段をふさいでいる。',
    },
    b_shade_sword: {
      name: '剣の勇者の影', sprite: 'boss_shade_sword', bossType: 'fmid', lv: 56, hpShare: 8, actsPerTurn: 1,
      race: 'spirit', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 2], ['eb_shade_blade', 2], ['eb_shade_crest', 2], ['eb_shade_sweep', 1]]),
      drops: { normal: { pool: 'p_boss', rate: 1 } },
      desc: '海の向こうで語られた勇者の影。\n白い剣で相手を斬りふせる。',
    },
    b_shade_prayer: {
      name: '祈りの勇者の影', sprite: 'boss_shade_prayer', bossType: 'fmid', lv: 56, hpShare: 6, actsPerTurn: 1,
      race: 'spirit', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 1], ['eb_shade_heal', 2, { hpBelow: 0.8 }], ['eb_shade_raise', 3, { once: true, allyDown: true }],
        ['eb_shade_holy', 2]]),
      drops: { bonus: { item: 'i_seed_mp', rate: 1 } },
      desc: '神殿の娘の姿をした白い影。\n祈りで仲間の傷を癒やす。',
    },
    b_shade_star: {
      name: '杖の勇者の影', sprite: 'boss_shade_star', bossType: 'fmid', lv: 56, hpShare: 6, actsPerTurn: 1,
      race: 'spirit', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 1], ['eb_shade_meteor', 2], ['eb_shade_frost', 2], ['eb_shade_fire', 2]]),
      drops: {},
      desc: '杖を掲げる娘の姿の白い影。\n星と氷と炎の術を操る。',
    },
    b_lazaro: {
      name: '大書記ラザロ', sprite: 'boss_lazaro', bossType: 'fmid', lv: 56, actsPerTurn: 1,
      race: 'humanoid', affinity: 'light', flags: ['boss'], eva: 5,
      elem: { light: 0.25, dark: 1.5 },
      actions: A([['attack', 1], ['eb_white_book', 2], ['eb_erase_memory', 2], ['eb_silver_quill', 3],
        ['eb_page_shield', 1, { hpBelow: 0.7, once: true }], ['eb_call_scribes', 1, { every: [4, 2], countBelow: 3 }]]),
      phases: [{ hpBelow: 0.5, msg: 'ラザロの手が、かすかに震えている……。', set: { actsPerTurn: 2 } }],
      drops: REGION('i_seed_hp'),
      desc: '記録院の長。すべてを忘れれば、\n悲しみも消えると信じている。',
    },
    b_nemrea1: {
      name: '虚ろの王', sprite: 'boss_nemrea1', bossType: 'last1', lv: 58, actsPerTurn: 2,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { fire: 1.25, light: 0.5, dark: 1.25 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 1], ['eb_whiteout', 2, { every: [3, 0] }], ['eb_oblivion_wave', 2], ['eb_paper_hand', 3],
        ['eb_erase_name', 1, { every: [4, 2] }], ['eb_blank_storm', 2]]),
      drops: {},
      desc: '白い紙片が渦を巻いてできた影。\n胸にラザロを取りこんでいる。',
    },
    b_nemrea2: {
      name: 'ネムレア', sprite: 'boss_nemrea2', bossType: 'last2', lv: 58, actsPerTurn: 3,
      race: 'spirit', flags: ['boss'], eva: 5,
      elem: { light: 1.5 }, statusRes: SPIRIT_RES,
      actions: A([['attack', 1], ['eb_eight_legends', 2, { every: [3, 1] }], ['eb_oblivion_breath', 2], ['eb_unwrite', 3],
        ['eb_dream_sleep', 1, { every: [4, 3] }], ['eb_nemrea_rewrite', 1, { hpBelow: 0.3, once: true }]]),
      phases: [{ hpBelow: 0.5, msg: 'その名が、体に刻まれていく……！', set: { elem: ALL(1.25) } }],
      drops: {},
      desc: '名を与えられた虚ろの王の姿。\n眠たげな顔で物語を消していく。',
    },

    // ------------------------------------------------------------ クリア後 忘却の底（ティア 9）
    b_valzard_echo: {
      name: '魔王の残影', sprite: 'b_valzard_echo', bossType: 'echo', lv: 64, actsPerTurn: 2,
      race: 'demon', affinity: 'dark', flags: ['boss'], eva: 5,
      elem: { light: 1.5, dark: 0.25 }, statusRes: { death: 0.8 },
      actions: A([['attack', 1], ['eb_echo_despair', 2], ['eb_echo_claw', 2], ['eb_echo_flame', 2],
        ['eb_echo_gaze', 1, { every: [4, 2] }], ['eb_echo_gather', 1, { every: [4, 3] }]]),
      phases: [{ hpBelow: 0.5, msg: '……光の……紋章……。\n残影が大きく揺らいだ！', set: { actsPerTurn: 3 } }],
      drops: {
        normal: { pool: 'p_boss', rate: 1 },
        rare: { item: 'ac_crest_fragment', rate: 4 },
        super: { item: 'w_sword_sr_echo', rate: 4 },
      },
      desc: '三百年前に倒れた魔王の残影。\n恐れだけが、ここに残った。',
    },
    b_ouroboros: {
      name: '円環竜オウロボラ', sprite: 'boss_ouroboros', bossType: 'super', lv: 68, actsPerTurn: 3,
      race: 'dragon', flags: ['boss'], eva: 5,
      elem: ALL(0.75), phys: { slash: 0.75 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: A([['attack', 1], ['eb_rewind', 2, { hpAbove: 0.25, every: [5, 4] }], ['eb_eternal_breath', 2], ['eb_ring_crush', 2],
        ['eb_time_loop', 1, { every: [4, 1] }], ['eb_scale_storm', 2], ['eb_tail_devour', 1, { hpBelow: 0.5, once: true }]]),
      phases: [{ hpBelow: 0.25, msg: '円環が、ほどけかけている！', set: { buffs: { def: -1, mdef: -1 } } }],
      drops: {
        normal: { pool: 'p_boss', rate: 1 },
        rare: { item: 'ac_ouroboros_ring', rate: 4 },
        super: { item: 'ac_sr_ouroboros', rate: 4 },
      },
      desc: '自分の尾をくわえた輪の竜。\n物語の終わりを食べて生きる。',
    },
  };
  for (const id in S) if (LIST[id]) LIST[id].s = Object.assign({}, LIST[id].s || {}, S[id]);
  Object.assign(R.DB.monsters, LIST);
})(window.RPG);
