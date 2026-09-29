// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_isles.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: 地方5 マレア諸島（魚人・タコ・骸骨）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- merman 魚人（水生・m）: 南の海の魚人たち。見張り、もり兵、呪い師、騎士。
    merman_1: {
      name: R.T('monsters.merman_1.name'), sprite: 'merman_1', lineage: 'merman', stage: 1, lv: 7, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.23, atk: 0.85, mag: 0.81 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_thrust', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.merman_1.desc'),
    },
    merman_2: {
      name: R.T('monsters.merman_2.name'), sprite: 'merman_2', lineage: 'merman', stage: 2, lv: 19, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.73, atk: 0.62, mag: 0.54 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_thrust', w: 2 }, { id: 'e_tide', w: 1 }],
      drops: { normal: { item: 'i_stone_water', rate: 8 } },
      desc: R.T('monsters.merman_2.desc'),
    },
    merman_3: {
      name: R.T('monsters.merman_3.name'), sprite: 'merman_3', lineage: 'merman', stage: 3, lv: 31, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.87, atk: 0.28, mag: 0.46, mdef: 1.2 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_water_bolt', w: 2 }, { id: 'e_tide', w: 2 }, { id: 'e_heal_ally', w: 1, cond: { hpBelow: 0.6 } }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('monsters.merman_3.desc'),
    },
    merman_4: {
      name: R.T('monsters.merman_4.name'), sprite: 'merman_4', lineage: 'merman', stage: 4, lv: 43, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 2.47, atk: 0.62, mag: 0.54, def: 1.25 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_thrust', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'e_tide', w: 1 }],
      drops: { normal: { item: 'i_potion2', rate: 8 }, rare: { item: 'w_sword_tide', rate: 32 } },
      desc: R.T('monsters.merman_4.desc'),
    },
    // ---- kraken タコ（水生・l）: 洞窟と船底の大ダコ。墨、八本の腕、渦潮。
    kraken_1: {
      name: R.T('monsters.kraken_1.name'), sprite: 'kraken_1', lineage: 'kraken', stage: 1, lv: 7, size: 'l', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 0.79, atk: 1.46, mag: 1.46, agi: 0.85 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_ink', w: 2 }, { id: 'e_tentacles', w: 2 }],
      drops: { normal: { item: 'i_clear', rate: 8 } },
      desc: R.T('monsters.kraken_1.desc'),
    },
    kraken_2: {
      name: R.T('monsters.kraken_2.name'), sprite: 'kraken_2', lineage: 'kraken', stage: 2, lv: 25, size: 'l', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.13, atk: 0.9, mag: 0.82, agi: 0.85 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_tentacles', w: 3 }, { id: 'e_bind', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: R.T('monsters.kraken_2.desc'),
    },
    kraken_3: {
      name: R.T('monsters.kraken_3.name'), sprite: 'kraken_3', lineage: 'kraken', stage: 3, lv: 43, size: 'l', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.78, atk: 0.67, mag: 0.7, agi: 0.85 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_tentacles', w: 2 }, { id: 'e_tide', w: 2 }, { id: 'e_ink', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_sword_tide', rate: 32 } },
      desc: R.T('monsters.kraken_3.desc'),
    },
    // ---- skeleton 骸骨（不死・m）: 幽霊船の骸骨の船乗り。水夫・海賊・砲手・航海士・提督。
    skeleton_1: {
      name: R.T('monsters.skeleton_1.name'), sprite: 'skeleton_1', lineage: 'skeleton', stage: 1, lv: 7, size: 'm', race: 'undead',
      flags: [], s: { hp: 1.33, atk: 1.03, mag: 0.98 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_slash', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.skeleton_1.desc'),
    },
    skeleton_2: {
      name: R.T('monsters.skeleton_2.name'), sprite: 'skeleton_2', lineage: 'skeleton', stage: 2, lv: 19, size: 'm', race: 'undead',
      flags: [], s: { hp: 1.72, atk: 0.66, mag: 0.6, agi: 1.05 }, rw: { gold: 1.5 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_double', w: 2 }, { id: 'e_slash', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.skeleton_2.desc'),
    },
    skeleton_3: {
      name: R.T('monsters.skeleton_3.name'), sprite: 'skeleton_3', lineage: 'skeleton', stage: 3, lv: 31, size: 'm', race: 'undead', affinity: 'fire',
      flags: [], s: { hp: 2.47, atk: 0.45, mag: 0.41 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_cannon', w: 3 }],
      drops: { normal: { item: 'i_firepot', rate: 8 } },
      desc: R.T('monsters.skeleton_3.desc'),
    },
    skeleton_4: {
      name: R.T('monsters.skeleton_4.name'), sprite: 'skeleton_4', lineage: 'skeleton', stage: 4, lv: 43, size: 'm', race: 'undead',
      flags: [], s: { hp: 2.99, atk: 0.68, mag: 0.68 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_slash', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }, { id: 'e_curse', w: 1 }],
      drops: { normal: { item: 'i_revive', rate: 8 } },
      desc: R.T('monsters.skeleton_4.desc'),
    },
    skeleton_5: {
      name: R.T('monsters.skeleton_5.name'), sprite: 'skeleton_5', lineage: 'skeleton', stage: 5, lv: 55, size: 'm', race: 'undead',
      flags: [], s: { hp: 2.66, atk: 0.48, mag: 0.46 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_cannon', w: 2 }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }, { id: 'e_howl', w: 1, cond: { once: true } }, { id: 'e_slash', w: 2 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_admiral_medal', rate: 32 }, super: { item: 'w_sword_sr_admiral', rate: 256 }, steal: { item: 'ac_st_admiral', rate: 32 } },
      desc: R.T('monsters.skeleton_5.desc'),
    },
  });
})(window.RPG);
