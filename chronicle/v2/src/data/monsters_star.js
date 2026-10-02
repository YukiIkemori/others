// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_star.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: 地方8 オルビス高原（目玉・魔術師・からくり・鎧・飛竜）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- eyeball 目玉（魔族・s）: 高原と塔に浮かぶ目玉。にらみ、惑わし、星見、天の大目玉。
    eyeball_1: {
      name: R.T('monsters.eyeball_1.name'), sprite: 'eyeball_1', lineage: 'eyeball', stage: 1, lv: 7, size: 's', race: 'demon',
      flags: [], s: { hp: 1.07, atk: 0.75, mag: 0.82, agi: 1.1 }, eva: 5,
      elem: { light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_gaze', w: 1 }],
      drops: { normal: { item: 'i_clear', rate: 8 } },
      desc: R.T('monsters.eyeball_1.desc'),
    },
    eyeball_2: {
      name: R.T('monsters.eyeball_2.name'), sprite: 'eyeball_2', lineage: 'eyeball', stage: 2, lv: 19, size: 's', race: 'demon',
      flags: [], s: { hp: 1.5, atk: 0.59, mag: 0.68, agi: 1.1 }, eva: 5,
      elem: { light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_gaze', w: 3 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.eyeball_2.desc'),
    },
    eyeball_3: {
      name: R.T('monsters.eyeball_3.name'), sprite: 'eyeball_3', lineage: 'eyeball', stage: 3, lv: 31, size: 's', race: 'demon', affinity: 'light',
      flags: [], s: { hp: 1.41, atk: 0.32, mag: 0.38, agi: 1.1 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_evil_eye', w: 3 }, { id: 'e_snipe', w: 1 }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: R.T('monsters.eyeball_3.desc'),
    },
    eyeball_4: {
      name: R.T('monsters.eyeball_4.name'), sprite: 'eyeball_4', lineage: 'eyeball', stage: 4, lv: 43, size: 's', race: 'demon', affinity: 'light',
      flags: [], s: { hp: 2.25, atk: 0.36, mag: 0.45, mdef: 1.2, agi: 1.1 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_light_ray', w: 2 }, { id: 'e_flash', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_light', rate: 8 } },
      desc: R.T('monsters.eyeball_4.desc'),
    },
    eyeball_5: {
      name: R.T('monsters.eyeball_5.name'), sprite: 'eyeball_5', lineage: 'eyeball', stage: 5, lv: 55, size: 's', race: 'demon', affinity: 'light',
      flags: [], s: { hp: 3.22, atk: 0.23, mag: 0.3, mdef: 1.25, agi: 1.05 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_holy_beam', w: 2 }, { id: 'e_light_ray', w: 2 }, { id: 'e_gaze', w: 1 }, { id: 'e_dispel', w: 1, cond: { every: [4, 2] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_heaven_feather', rate: 16 }, super: { item: 'hd_sr_heaveneye', rate: 128 }, steal: { item: 'ac_st_heaven_eye', rate: 16 } },
      desc: R.T('monsters.eyeball_5.desc'),
    },
    // ---- darkmage 魔術師（人型・m）: 星読みの塔に集まったはぐれ術師。見習い・炎・風・闇。
    darkmage_1: {
      name: R.T('monsters.darkmage_1.name'), sprite: 'darkmage_1', lineage: 'darkmage', stage: 1, lv: 7, size: 'm', race: 'humanoid',
      flags: [], s: { hp: 1.42, atk: 0.53, mag: 0.93, def: 0.85, mdef: 1.3 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_bolt', w: 2 }, { id: 'e_water_bolt', w: 2 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('monsters.darkmage_1.desc'),
    },
    darkmage_2: {
      name: R.T('monsters.darkmage_2.name'), sprite: 'darkmage_2', lineage: 'darkmage', stage: 2, lv: 19, size: 'm', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 1.88, atk: 0.3, mag: 0.54, def: 0.85, mdef: 1.3 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_fire_bolt', w: 2 }, { id: 'e_fire_rain', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: R.T('monsters.darkmage_2.desc'),
    },
    darkmage_3: {
      name: R.T('monsters.darkmage_3.name'), sprite: 'darkmage_3', lineage: 'darkmage', stage: 3, lv: 31, size: 'm', race: 'humanoid', affinity: 'wind',
      flags: [], s: { hp: 2.39, atk: 0.27, mag: 0.48, def: 0.85, mdef: 1.3, agi: 1.15 }, eva: 5,
      elem: { fire: 1.5, wind: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_wind_blade', w: 2 }, { id: 'e_gust', w: 2 }, { id: 'e_hush', w: 1 }, { id: 'e_haste', w: 1, cond: { once: true } }, { id: 'e_weaken', w: 1 }],
      drops: { normal: { item: 'i_stone_wind', rate: 8 } },
      desc: R.T('monsters.darkmage_3.desc'),
    },
    darkmage_4: {
      name: R.T('monsters.darkmage_4.name'), sprite: 'darkmage_4', lineage: 'darkmage', stage: 4, lv: 43, size: 'm', race: 'humanoid', affinity: 'dark',
      flags: [], s: { hp: 3.07, atk: 0.27, mag: 0.51, def: 0.85, mdef: 1.3 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_dark_mist', w: 2 }, { id: 'e_gloom', w: 1 }, { id: 'e_mind_suck', w: 1 }, { id: 'e_elem_shift', w: 1, cond: { every: [4, 0] } }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'w_sword_starblade', rate: 16 } },
      desc: R.T('monsters.darkmage_4.desc'),
    },
    // ---- automaton からくり（魔造・m）: 賢者カペラが残したからくり兵。兵・弓兵・術兵・大将。
    automaton_1: {
      name: R.T('monsters.automaton_1.name'), sprite: 'automaton_1', lineage: 'automaton', stage: 1, lv: 7, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 0.95, atk: 1.22, mag: 1.22, def: 1.2, agi: 0.95 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_double', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.automaton_1.desc'),
    },
    automaton_2: {
      name: R.T('monsters.automaton_2.name'), sprite: 'automaton_2', lineage: 'automaton', stage: 2, lv: 19, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.4, atk: 0.8, mag: 0.8, def: 1.15 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_arrow', w: 3 }, { id: 'e_snipe', w: 2 }],
      drops: { normal: { item: 'i_clear', rate: 8 } },
      desc: R.T('monsters.automaton_2.desc'),
    },
    automaton_3: {
      name: R.T('monsters.automaton_3.name'), sprite: 'automaton_3', lineage: 'automaton', stage: 3, lv: 31, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.43, atk: 0.59, mag: 0.73, def: 1.1, mdef: 1.2 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_light_ray', w: 2 }, { id: 'e_zap', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }, { id: 'e_guard_stance', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('monsters.automaton_3.desc'),
    },
    automaton_4: {
      name: R.T('monsters.automaton_4.name'), sprite: 'automaton_4', lineage: 'automaton', stage: 4, lv: 43, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.9, atk: 0.82, mag: 0.71, def: 1.25 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_double', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'e_howl', w: 1, cond: { once: true } }, { id: 'e_zap', w: 1 }],
      drops: { normal: { item: 'i_potion2', rate: 8 }, rare: { item: 'w_sword_starblade', rate: 16 } },
      desc: R.T('monsters.automaton_4.desc'),
    },
    // ---- armor 鎧（魔造・m）: 中身のない鎧。番兵、騎士、そして闇の黒金。
    armor_1: {
      name: R.T('monsters.armor_1.name'), sprite: 'armor_1', lineage: 'armor', stage: 1, lv: 7, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 0.83, atk: 1.23, mag: 1.23, def: 1.35, agi: 0.8 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_slash', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.armor_1.desc'),
    },
    armor_2: {
      name: R.T('monsters.armor_2.name'), sprite: 'armor_2', lineage: 'armor', stage: 2, lv: 19, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.1, atk: 1.03, mag: 1.03, def: 1.4, agi: 0.8 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_thrust', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.armor_2.desc'),
    },
    armor_3: {
      name: R.T('monsters.armor_3.name'), sprite: 'armor_3', lineage: 'armor', stage: 3, lv: 31, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.45, atk: 0.74, mag: 0.67, def: 1.35 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_slash', w: 2 }, { id: 'e_double', w: 1 }, { id: 'e_focus', w: 1, cond: { once: true } }, { id: 'e_guard_stance', w: 1 }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.armor_3.desc'),
    },
    armor_4: {
      name: R.T('monsters.armor_4.name'), goldName: R.T('monsters.armor_4.goldName'), sprite: 'armor_4', lineage: 'armor', stage: 4, lv: 43, size: 'm', race: 'construct', affinity: 'dark',
      flags: [], s: { hp: 1.84, atk: 0.56, mag: 0.47, def: 1.35 }, actsPerTurn: 2,   // 2 回動く精鋭（w_combo）: 1 回の強さは 0.72 倍
      eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_slash', w: 1 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_revive', rate: 8 }, rare: { item: 'hd_blackgold_helm', rate: 16 } },
      desc: R.T('monsters.armor_4.desc'),
    },
    // ---- wyvern 飛竜（竜・l・飛ぶ）: 高原の空を飛ぶ竜。風を起こし、嵐の息を吐く。
    wyvern_1: {
      name: R.T('monsters.wyvern_1.name'), sprite: 'wyvern_1', lineage: 'wyvern', stage: 1, lv: 7, size: 'l', race: 'dragon', affinity: 'wind',
      flags: ['flying'], s: { hp: 1.24, atk: 0.97, mag: 0.88, agi: 1.1 }, eva: 12,
      elem: { fire: 1.5, water: 0.75, wind: 0.25, earth: 0.5, light: 0.75, dark: 0.75 }, phys: { slash: 0.75, pierce: 1.25 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_bite', w: 2 }, { id: 'e_gust', w: 2 }],
      drops: { normal: { item: 'i_stone_wind', rate: 8 } },
      desc: R.T('monsters.wyvern_1.desc'),
    },
    wyvern_2: {
      name: R.T('monsters.wyvern_2.name'), sprite: 'wyvern_2', lineage: 'wyvern', stage: 2, lv: 25, size: 'l', race: 'dragon', affinity: 'wind',
      flags: ['flying'], s: { hp: 2.37, atk: 0.74, mag: 0.65, agi: 1.15 }, eva: 12,
      elem: { fire: 1.5, water: 0.75, wind: 0.25, earth: 0.5, light: 0.75, dark: 0.75 }, phys: { slash: 0.75, pierce: 1.25 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dive', w: 2 }, { id: 'e_gust', w: 2 }, { id: 'e_tail', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: R.T('monsters.wyvern_2.desc'),
    },
    wyvern_3: {
      name: R.T('monsters.wyvern_3.name'), sprite: 'wyvern_3', lineage: 'wyvern', stage: 3, lv: 43, size: 'l', race: 'dragon', affinity: 'wind',
      flags: ['flying'], s: { hp: 2.8, atk: 0.35, mag: 0.33, agi: 1.15 }, actsPerTurn: 2,   // 2 回動く精鋭（w_combo）: 1 回の強さは 0.72 倍
      eva: 12,
      elem: { fire: 1.5, water: 0.75, wind: 0.25, earth: 0.5, light: 0.75, dark: 0.75 }, phys: { slash: 0.75, pierce: 1.25 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_storm_breath', w: 2 }, { id: 'e_dive', w: 2 }, { id: 'e_tail', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'hd_blackgold_helm', rate: 16 } },
      desc: R.T('monsters.wyvern_3.desc'),
    },
  });
})(window.RPG);
