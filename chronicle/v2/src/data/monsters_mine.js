// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_mine.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: 地方6 ガルド山地（石くれ兵・モグラ・カブト・水晶・小鬼）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- golem 石くれ兵（魔造・l）: 鉱山を守る石の兵。石・鉄鉱・宝玉。
    golem_1: {
      name: R.T('monsters.golem_1.name'), sprite: 'golem_1', lineage: 'golem', stage: 1, lv: 7, size: 'l', race: 'construct', affinity: 'earth',
      flags: [], s: { hp: 0.76, atk: 2.29, mag: 2.18, def: 1.3, agi: 0.65 }, eva: 5,
      elem: { fire: 0.75, water: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_crush', w: 1 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_earth', rate: 8 } },
      desc: R.T('monsters.golem_1.desc'),
    },
    golem_2: {
      name: R.T('monsters.golem_2.name'), sprite: 'golem_2', lineage: 'golem', stage: 2, lv: 25, size: 'l', race: 'construct', affinity: 'earth',
      flags: [], s: { hp: 0.9, atk: 1.31, mag: 1.19, def: 1.4, agi: 0.6 }, eva: 5,
      elem: { fire: 0.75, water: 1.5, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_crush', w: 2 }, { id: 'e_stomp', w: 2 }, { id: 'e_rock', w: 1 }, { id: 'e_guard_stance', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: R.T('monsters.golem_2.desc'),
    },
    golem_3: {
      name: R.T('monsters.golem_3.name'), sprite: 'golem_3', lineage: 'golem', stage: 3, lv: 43, size: 'l', race: 'construct', affinity: 'earth',
      flags: [], s: { hp: 1.5, atk: 1.29, mag: 1.35, def: 1.35, agi: 0.6 }, eva: 5,
      elem: { fire: 0.75, water: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_crush', w: 2 }, { id: 'e_gem_beam', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_gem_core', rate: 16 } },
      desc: R.T('monsters.golem_3.desc'),
    },
    // ---- mole モグラ（獣・m）: 坑道を掘るモグラ。爪、火薬、そして鉱夫の親方。
    mole_1: {
      name: R.T('monsters.mole_1.name'), sprite: 'mole_1', lineage: 'mole', stage: 1, lv: 7, size: 'm', race: 'beast', affinity: 'earth',
      flags: [], s: { hp: 1.26, atk: 0.89, mag: 0.85, agi: 0.9 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25, light: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_claw', w: 2 }],
      drops: { normal: { item: 'i_stone_earth', rate: 8 } },
      desc: R.T('monsters.mole_1.desc'),
    },
    mole_2: {
      name: R.T('monsters.mole_2.name'), sprite: 'mole_2', lineage: 'mole', stage: 2, lv: 19, size: 'm', race: 'beast', affinity: 'earth',
      flags: [], s: { hp: 1.69, atk: 0.68, mag: 0.59, agi: 0.9 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25, light: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_claw', w: 2 }, { id: 'e_dust', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.mole_2.desc'),
    },
    mole_3: {
      name: R.T('monsters.mole_3.name'), sprite: 'mole_3', lineage: 'mole', stage: 3, lv: 31, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 2.22, atk: 0.45, mag: 0.41, agi: 0.95 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_bomb', w: 3 }, { id: 'e_claw', w: 1 }, { id: 'e_ambush', w: 1 }, { id: 'flee', w: 1, cond: { hpBelow: 0.25 } }],
      drops: { normal: { item: 'i_firepot', rate: 8 } },
      desc: R.T('monsters.mole_3.desc'),
    },
    mole_4: {
      name: R.T('monsters.mole_4.name'), sprite: 'mole_4', lineage: 'mole', stage: 4, lv: 43, size: 'm', race: 'beast', affinity: 'earth',
      flags: [], s: { hp: 2.43, atk: 0.53, mag: 0.46, def: 1.1, agi: 0.85 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25, light: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_quake', w: 2 }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }, { id: 'e_claw', w: 2 }],
      drops: { normal: { item: 'i_potion2', rate: 8 }, rare: { item: 'w_greatsword_forgehammer', rate: 16 } },
      desc: R.T('monsters.mole_4.desc'),
    },
    // ---- beetle カブト（虫・s）: 岩山の甲虫。石・鉄・火花・金剛と殻が硬くなる。
    beetle_1: {
      name: R.T('monsters.beetle_1.name'), sprite: 'beetle_1', lineage: 'beetle', stage: 1, lv: 7, size: 's', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.44, atk: 1.21, mag: 1.21, def: 1.4, agi: 0.8 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.25 }, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_horn', w: 2 }],
      drops: { normal: { item: 'i_stone_earth', rate: 8 } },
      desc: R.T('monsters.beetle_1.desc'),
    },
    beetle_2: {
      name: R.T('monsters.beetle_2.name'), sprite: 'beetle_2', lineage: 'beetle', stage: 2, lv: 19, size: 's', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.76, atk: 0.92, mag: 0.92, def: 1.6, agi: 0.8 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.25 }, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_horn', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.beetle_2.desc'),
    },
    beetle_3: {
      name: R.T('monsters.beetle_3.name'), sprite: 'beetle_3', lineage: 'beetle', stage: 3, lv: 31, size: 's', race: 'insect', affinity: 'fire',
      flags: [], s: { hp: 2.38, atk: 0.54, mag: 0.62, def: 1.4, agi: 0.85 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: { slash: 0.75, blunt: 1.25 }, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_horn', w: 2 }, { id: 'e_fire_bolt', w: 2 }, { id: 'e_guard_stance', w: 1 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: R.T('monsters.beetle_3.desc'),
    },
    beetle_4: {
      name: R.T('monsters.beetle_4.name'), goldName: R.T('monsters.beetle_4.goldName'), sprite: 'beetle_4', lineage: 'beetle', stage: 4, lv: 43, size: 's', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 3.39, atk: 0.74, mag: 0.74, def: 1.8, agi: 0.8 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.25 }, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_horn', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'e_charge', w: 2 }],
      drops: { normal: { item: 'i_potion2', rate: 8 }, rare: { item: 'w_greatsword_forgehammer', rate: 16 } },
      desc: R.T('monsters.beetle_4.desc'),
    },
    // ---- crystal 水晶（魔造・s）: 坑道の奥で生まれる、浮かぶ水晶。色で属性が変わる。
    crystal_1: {
      name: R.T('monsters.crystal_1.name'), sprite: 'crystal_1', lineage: 'crystal', stage: 1, lv: 7, size: 's', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.19, atk: 0.79, mag: 0.95, def: 1.2 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_light_ray', w: 2 }],
      drops: { normal: { item: 'i_stone_light', rate: 8 } },
      desc: R.T('monsters.crystal_1.desc'),
    },
    crystal_2: {
      name: R.T('monsters.crystal_2.name'), goldName: R.T('monsters.crystal_2.goldName'), sprite: 'crystal_2', lineage: 'crystal', stage: 2, lv: 19, size: 's', race: 'construct', affinity: 'fire',
      flags: [], s: { hp: 1.59, atk: 0.46, mag: 0.58, def: 1.2 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, wind: 0.75 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_bolt', w: 3 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: R.T('monsters.crystal_2.desc'),
    },
    crystal_3: {
      name: R.T('monsters.crystal_3.name'), goldName: R.T('monsters.crystal_3.goldName'), sprite: 'crystal_3', lineage: 'crystal', stage: 3, lv: 31, size: 's', race: 'construct', affinity: 'water',
      flags: [], s: { hp: 1.82, atk: 0.35, mag: 0.44, def: 1.2 }, eva: 5,
      elem: { water: 0.25, wind: 0.75, earth: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_water_bolt', w: 2 }, { id: 'e_frost', w: 1 }, { id: 'e_elem_shift', w: 1, cond: { every: [3, 0] } }],
      drops: { normal: { item: 'i_stone_water', rate: 8 } },
      desc: R.T('monsters.crystal_3.desc'),
    },
    crystal_4: {
      name: R.T('monsters.crystal_4.name'), goldName: R.T('monsters.crystal_4.goldName'), sprite: 'crystal_4', lineage: 'crystal', stage: 4, lv: 43, size: 's', race: 'construct', affinity: 'dark',
      flags: [], s: { hp: 2.68, atk: 0.54, mag: 0.7, def: 1.2, mdef: 1.2 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_mind_suck', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }, { id: 'e_elem_shift', w: 1, cond: { every: [3, 0] } }],
      drops: { normal: { item: 'i_stone_dark', rate: 8 }, rare: { item: 'ac_gem_core', rate: 16 } },
      desc: R.T('monsters.crystal_4.desc'),
    },
    // ---- goblin 小鬼（人型・m）: 山の坑道にすむ小鬼の一族。斧兵、火薬師、隊長、王。
    goblin_1: {
      name: R.T('monsters.goblin_1.name'), sprite: 'goblin_1', lineage: 'goblin', stage: 1, lv: 7, size: 'm', race: 'humanoid',
      flags: [], s: { hp: 1.23, atk: 1.11, mag: 1.01 }, rw: { gold: 1.3 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_heavy', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.goblin_1.desc'),
    },
    goblin_2: {
      name: R.T('monsters.goblin_2.name'), sprite: 'goblin_2', lineage: 'goblin', stage: 2, lv: 19, size: 'm', race: 'humanoid',
      flags: [], s: { hp: 1.82, atk: 0.76, mag: 0.66 }, rw: { gold: 1.3 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_heavy', w: 2 }, { id: 'e_double', w: 1 }, { id: 'flee', w: 1, cond: { hpBelow: 0.3 } }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.goblin_2.desc'),
    },
    goblin_3: {
      name: R.T('monsters.goblin_3.name'), sprite: 'goblin_3', lineage: 'goblin', stage: 3, lv: 31, size: 'm', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 2.17, atk: 0.47, mag: 0.43, agi: 1.05 }, rw: { gold: 1.3 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_bomb', w: 3 }, { id: 'e_snipe', w: 1 }],
      drops: { normal: { item: 'i_firepot', rate: 8 } },
      desc: R.T('monsters.goblin_3.desc'),
    },
    goblin_4: {
      name: R.T('monsters.goblin_4.name'), sprite: 'goblin_4', lineage: 'goblin', stage: 4, lv: 43, size: 'm', race: 'humanoid',
      flags: [], s: { hp: 2.75, atk: 0.66, mag: 0.57, def: 1.1 }, rw: { gold: 1.3 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_howl', w: 2, cond: { once: true } }, { id: 'e_double', w: 1 }, { id: 'e_slash', w: 1 }, { id: 'e_war_dance', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.goblin_4.desc'),
    },
    goblin_5: {
      name: R.T('monsters.goblin_5.name'), sprite: 'goblin_5', lineage: 'goblin', stage: 5, lv: 55, size: 'm', race: 'humanoid',
      flags: [], s: { hp: 2.25, atk: 0.57, mag: 0.47, def: 1.1 }, rw: { gold: 2 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_call_lesser', w: 2, cond: { countBelow: 5 } }, { id: 'e_howl', w: 1, cond: { once: true } }, { id: 'e_heavy', w: 2 }, { id: 'e_bomb', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_goblin_hoard', rate: 16 }, super: { item: 'w_sword_sr_hegemon', rate: 128 }, steal: { item: 'hd_st_goblin_king', rate: 16 } },
      desc: R.T('monsters.goblin_5.desc'),
    },
  });
})(window.RPG);
