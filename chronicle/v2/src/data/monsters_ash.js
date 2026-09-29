// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_ash.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: 地方7 灰の荒野（火トカゲ・悪魔・石像鬼・大鬼・三頭獣）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- salamander 火トカゲ（獣・m）: 火山の火トカゲ。火を吹き、溶岩をまとい、角を生やし、竜の王になる。
    salamander_1: {
      name: R.T('monsters.salamander_1.name'), sprite: 'salamander_1', lineage: 'salamander', stage: 1, lv: 7, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.29, atk: 0.7, mag: 0.67, agi: 1.05 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_fire_bite', w: 2 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: R.T('monsters.salamander_1.desc'),
    },
    salamander_2: {
      name: R.T('monsters.salamander_2.name'), sprite: 'salamander_2', lineage: 'salamander', stage: 2, lv: 19, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.8, atk: 0.39, mag: 0.41 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_fire_breath', w: 2 }, { id: 'e_fire_bite', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.salamander_2.desc'),
    },
    salamander_3: {
      name: R.T('monsters.salamander_3.name'), sprite: 'salamander_3', lineage: 'salamander', stage: 3, lv: 31, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.89, atk: 0.49, mag: 0.45, def: 1.15 }, eva: 5,
      elem: { fire: -1, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_lava_spit', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.salamander_3.desc'),
    },
    salamander_4: {
      name: R.T('monsters.salamander_4.name'), sprite: 'salamander_4', lineage: 'salamander', stage: 4, lv: 43, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 2.86, atk: 0.4, mag: 0.38 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_breath', w: 2 }, { id: 'e_horn', w: 2 }, { id: 'e_focus', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: R.T('monsters.salamander_4.desc'),
    },
    salamander_5: {
      name: R.T('monsters.salamander_5.name'), sprite: 'salamander_5', lineage: 'salamander', stage: 5, lv: 55, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 3.28, atk: 0.23, mag: 0.22 }, eva: 5,
      elem: { fire: -1, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_inferno_breath', w: 2 }, { id: 'e_fire_bite', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 1] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_phoenix_ash', rate: 32 }, super: { item: 'bd_sr_dragonhide', rate: 128 } },
      desc: R.T('monsters.salamander_5.desc'),
    },
    // ---- imp 悪魔（魔族・s）: 灰の荒野の小悪魔。すす・火の粉・灰・業火、そして軍師。
    imp_1: {
      name: R.T('monsters.imp_1.name'), sprite: 'imp_1', lineage: 'imp', stage: 1, lv: 7, size: 's', race: 'demon', affinity: 'fire',
      flags: [], s: { hp: 1.55, atk: 0.71, mag: 0.68, agi: 1.2 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_thrust', w: 2 }, { id: 'e_fire_bolt', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.imp_1.desc'),
    },
    imp_2: {
      name: R.T('monsters.imp_2.name'), sprite: 'imp_2', lineage: 'imp', stage: 2, lv: 19, size: 's', race: 'demon', affinity: 'fire',
      flags: [], s: { hp: 2.48, atk: 0.38, mag: 0.44, agi: 1.2 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_fire_bolt', w: 2 }, { id: 'e_fire_rain', w: 1 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: R.T('monsters.imp_2.desc'),
    },
    imp_3: {
      name: R.T('monsters.imp_3.name'), sprite: 'imp_3', lineage: 'imp', stage: 3, lv: 31, size: 's', race: 'demon', affinity: 'fire',
      flags: [], s: { hp: 2.3, atk: 0.37, mag: 0.42, agi: 1.2 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_ash_cloud', w: 2 }, { id: 'e_fire_rain', w: 2 }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: R.T('monsters.imp_3.desc'),
    },
    imp_4: {
      name: R.T('monsters.imp_4.name'), sprite: 'imp_4', lineage: 'imp', stage: 4, lv: 43, size: 's', race: 'demon', affinity: 'fire',
      flags: [], s: { hp: 3.9, atk: 0.26, mag: 0.33, agi: 1.2 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_rain', w: 2 }, { id: 'e_fire_bolt', w: 2 }, { id: 'e_haste', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.imp_4.desc'),
    },
    imp_5: {
      name: R.T('monsters.imp_5.name'), sprite: 'imp_5', lineage: 'imp', stage: 5, lv: 55, size: 's', race: 'demon', affinity: 'dark',
      flags: [], s: { hp: 3.63, atk: 0.3, mag: 0.39, mdef: 1.25, agi: 1.15 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_dispel', w: 1, cond: { every: [3, 1] } }, { id: 'e_haste', w: 1, cond: { once: true } }, { id: 'e_ward', w: 1, cond: { once: true } }, { id: 'e_gloom', w: 1 }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'ac_phoenix_ash', rate: 32 }, super: { item: 'hd_sr_dusk', rate: 128 }, steal: { item: 'w_staff_st_strategist', rate: 32 } },
      desc: R.T('monsters.imp_5.desc'),
    },
    // ---- gargoyle 石像鬼（魔族・m・飛ぶ）: 古い神殿や塔の屋根に止まる石の鬼。
    gargoyle_1: {
      name: R.T('monsters.gargoyle_1.name'), sprite: 'gargoyle_1', lineage: 'gargoyle', stage: 1, lv: 7, size: 'm', race: 'demon',
      flags: ['flying'], s: { hp: 0.91, atk: 1.06, mag: 1.06, def: 1.3, agi: 0.95 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5, light: 1.5, dark: 0.5 }, phys: { slash: 0.75, blunt: 1.25, pierce: 0.75 }, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_claw', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.gargoyle_1.desc'),
    },
    gargoyle_2: {
      name: R.T('monsters.gargoyle_2.name'), goldName: R.T('monsters.gargoyle_2.goldName'), sprite: 'gargoyle_2', lineage: 'gargoyle', stage: 2, lv: 19, size: 'm', race: 'demon',
      flags: ['flying'], s: { hp: 1.25, atk: 0.75, mag: 0.68, def: 1.35 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5, light: 1.5, dark: 0.5 }, phys: { slash: 0.75, blunt: 1.25, pierce: 0.75 }, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_dive', w: 2 }, { id: 'e_claw', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.gargoyle_2.desc'),
    },
    gargoyle_3: {
      name: R.T('monsters.gargoyle_3.name'), sprite: 'gargoyle_3', lineage: 'gargoyle', stage: 3, lv: 31, size: 'm', race: 'demon', affinity: 'fire',
      flags: ['flying'], s: { hp: 1.63, atk: 0.54, mag: 0.54, def: 1.3 }, eva: 12,
      elem: { fire: 0.25, water: 1.5, wind: 1.5, earth: 0.5, light: 1.5, dark: 0.5 }, phys: { slash: 0.75, blunt: 1.25, pierce: 0.75 }, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_breath', w: 2 }, { id: 'e_claw', w: 2 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: R.T('monsters.gargoyle_3.desc'),
    },
    gargoyle_4: {
      name: R.T('monsters.gargoyle_4.name'), sprite: 'gargoyle_4', lineage: 'gargoyle', stage: 4, lv: 43, size: 'm', race: 'demon',
      flags: ['flying'], s: { hp: 2.04, atk: 0.86, mag: 0.75, def: 1.35 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5, light: 1.5, dark: 0.5 }, phys: { slash: 0.75, blunt: 1.25, pierce: 0.75 }, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_gaze', w: 2 }, { id: 'e_dive', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion2', rate: 8 }, rare: { item: 'w_sword_ash', rate: 32 } },
      desc: R.T('monsters.gargoyle_4.desc'),
    },
    // ---- orc 大鬼（人型・l）: 荒野をのし歩く大鬼。力まかせと鉄棒。
    orc_1: {
      name: R.T('monsters.orc_1.name'), sprite: 'orc_1', lineage: 'orc', stage: 1, lv: 7, size: 'l', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 1.15, atk: 1.93, mag: 1.61, def: 0.95, mdef: 0.85, agi: 0.8 }, rw: { gold: 1.3 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_heavy', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.orc_1.desc'),
    },
    orc_2: {
      name: R.T('monsters.orc_2.name'), sprite: 'orc_2', lineage: 'orc', stage: 2, lv: 25, size: 'l', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 1.22, atk: 0.99, mag: 0.8, mdef: 0.85, agi: 0.8 }, rw: { gold: 1.3 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_heavy', w: 2 }, { id: 'e_sweep', w: 2 }, { id: 'e_armor_break', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: R.T('monsters.orc_2.desc'),
    },
    orc_3: {
      name: R.T('monsters.orc_3.name'), sprite: 'orc_3', lineage: 'orc', stage: 3, lv: 43, size: 'l', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 1.9, atk: 0.89, mag: 0.71, def: 1.05, agi: 0.8 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_rampage', w: 2 }, { id: 'e_focus', w: 1, cond: { once: true } }, { id: 'e_sweep', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 2] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_greatsword_brimstone', rate: 32 } },
      desc: R.T('monsters.orc_3.desc'),
    },
    // ---- chimera 三頭獣（獣・l）: シシ・ヤギ・ヘビの頭をもつ獣。火の息が強くなっていく。
    chimera_1: {
      name: R.T('monsters.chimera_1.name'), sprite: 'chimera_1', lineage: 'chimera', stage: 1, lv: 7, size: 'l', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 0.77, atk: 0.76, mag: 0.69 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_bite', w: 2 }, { id: 'e_fire_breath', w: 1 }, { id: 'e_poison_bite', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.chimera_1.desc'),
    },
    chimera_2: {
      name: R.T('monsters.chimera_2.name'), sprite: 'chimera_2', lineage: 'chimera', stage: 2, lv: 25, size: 'l', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.01, atk: 0.56, mag: 0.53 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_breath', w: 2 }, { id: 'e_poison_bite', w: 1 }, { id: 'e_bite', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: R.T('monsters.chimera_2.desc'),
    },
    chimera_3: {
      name: R.T('monsters.chimera_3.name'), sprite: 'chimera_3', lineage: 'chimera', stage: 3, lv: 43, size: 'l', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 2.05, atk: 0.34, mag: 0.33 }, eva: 5,
      elem: { fire: -1, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_inferno_breath', w: 2 }, { id: 'e_bite', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 0] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_greatsword_brimstone', rate: 32 } },
      desc: R.T('monsters.chimera_3.desc'),
    },
  });
})(window.RPG);
