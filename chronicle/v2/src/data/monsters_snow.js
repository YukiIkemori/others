// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_snow.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: 地方3 ノルデン雪原（オオカミ・雪男・氷の小鬼・フクロウ・マンモス）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- wolf オオカミ（獣・m）: 雪原の群れ。霜の牙、吹雪の息、月夜、そしてオオカミ王。
    wolf_1: {
      name: R.T('monsters.wolf_1.name'), goldName: R.T('monsters.wolf_1.goldName'), sprite: 'wolf_1', lineage: 'wolf', stage: 1, lv: 7, size: 'm', race: 'beast',
      flags: [], s: { hp: 1.22, atk: 0.97, mag: 0.92, agi: 1.15 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_bite', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.wolf_1.desc'),
    },
    wolf_2: {
      name: R.T('monsters.wolf_2.name'), sprite: 'wolf_2', lineage: 'wolf', stage: 2, lv: 19, size: 'm', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.63, atk: 0.78, mag: 0.71, agi: 1.15 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_frost_bite', w: 3 }],
      drops: { normal: { item: 'i_stone_water', rate: 8 } },
      desc: R.T('monsters.wolf_2.desc'),
    },
    wolf_3: {
      name: R.T('monsters.wolf_3.name'), sprite: 'wolf_3', lineage: 'wolf', stage: 3, lv: 31, size: 'm', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.82, atk: 0.42, mag: 0.44, agi: 1.15 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_frost_breath', w: 2 }, { id: 'e_bite', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }, { id: 'e_finish', w: 1 }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.wolf_3.desc'),
    },
    wolf_4: {
      name: R.T('monsters.wolf_4.name'), sprite: 'wolf_4', lineage: 'wolf', stage: 4, lv: 43, size: 'm', race: 'beast', affinity: 'dark',
      flags: [], s: { hp: 2.66, atk: 0.61, mag: 0.53, agi: 1.25 }, eva: 5,
      elem: { fire: 1.25, light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_double', w: 2 }, { id: 'e_shadow_bite', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_dark', rate: 8 } },
      desc: R.T('monsters.wolf_4.desc'),
    },
    wolf_5: {
      name: R.T('monsters.wolf_5.name'), sprite: 'wolf_5', lineage: 'wolf', stage: 5, lv: 55, size: 'm', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 2.09, atk: 0.41, mag: 0.35, agi: 1.2 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_frost_breath', w: 2 }, { id: 'e_frost_bite', w: 2 }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_dagger_wolfking', rate: 16 }, super: { item: 'ac_sr_beastheart', rate: 128 }, steal: { item: 'w_dagger_st_wolfking', rate: 16 } },
      desc: R.T('monsters.wolf_5.desc'),
    },
    // ---- yeti 雪男（獣・l）: 雪山の大男。雪玉、氷の拳、雪崩。
    yeti_1: {
      name: R.T('monsters.yeti_1.name'), sprite: 'yeti_1', lineage: 'yeti', stage: 1, lv: 7, size: 'l', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 0.96, atk: 1.38, mag: 1.2, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_crush', w: 1 }, { id: 'e_snowball', w: 2 }, { id: 'e_headbutt', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.yeti_1.desc'),
    },
    yeti_2: {
      name: R.T('monsters.yeti_2.name'), sprite: 'yeti_2', lineage: 'yeti', stage: 2, lv: 25, size: 'l', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.18, atk: 1.01, mag: 0.84, def: 1.1, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_frost_fist', w: 2 }, { id: 'e_frost_breath', w: 1 }, { id: 'e_focus', w: 1, cond: { once: true } }, { id: 'e_last_stand', w: 1, cond: { hpBelow: 0.5, once: true } }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: R.T('monsters.yeti_2.desc'),
    },
    yeti_3: {
      name: R.T('monsters.yeti_3.name'), sprite: 'yeti_3', lineage: 'yeti', stage: 3, lv: 43, size: 'l', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.87, atk: 0.77, mag: 0.64, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_crush', w: 2 }, { id: 'e_avalanche', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 1] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'hd_yeti_fur', rate: 16 } },
      desc: R.T('monsters.yeti_3.desc'),
    },
    // ---- frostling 氷の小鬼（妖精・m）: 雪の子どもの小鬼。こおり・つらら・ふぶき小僧から雪の大将、冬将軍へ。
    frostling_1: {
      name: R.T('monsters.frostling_1.name'), sprite: 'frostling_1', lineage: 'frostling', stage: 1, lv: 7, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 1.16, atk: 0.69, mag: 0.83, agi: 1.1 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_frost', w: 2 }],
      drops: { normal: { item: 'i_stone_water', rate: 8 } },
      desc: R.T('monsters.frostling_1.desc'),
    },
    frostling_2: {
      name: R.T('monsters.frostling_2.name'), sprite: 'frostling_2', lineage: 'frostling', stage: 2, lv: 19, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 1.76, atk: 0.52, mag: 0.62, agi: 1.1 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_icicle', w: 3 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.frostling_2.desc'),
    },
    frostling_3: {
      name: R.T('monsters.frostling_3.name'), sprite: 'frostling_3', lineage: 'frostling', stage: 3, lv: 31, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 1.7, atk: 0.32, mag: 0.4, agi: 1.15 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_frost', w: 2 }, { id: 'e_frost_breath', w: 2 }, { id: 'e_hush', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('monsters.frostling_3.desc'),
    },
    frostling_4: {
      name: R.T('monsters.frostling_4.name'), sprite: 'frostling_4', lineage: 'frostling', stage: 4, lv: 43, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 2.5, atk: 0.47, mag: 0.45, agi: 1.05 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_frost_fist', w: 2 }, { id: 'e_frost', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.frostling_4.desc'),
    },
    frostling_5: {
      name: R.T('monsters.frostling_5.name'), sprite: 'frostling_5', lineage: 'frostling', stage: 5, lv: 55, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 2.76, atk: 0.38, mag: 0.42, agi: 1.05 }, eva: 5,
      elem: { fire: 1.25, water: -1, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_frost', w: 2 }, { id: 'e_icicle', w: 2 }, { id: 'e_freeze_gaze', w: 1 }, { id: 'e_haste', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_dagger_wolfking', rate: 16 }, super: { item: 'ft_sr_cloud', rate: 128 } },
      desc: R.T('monsters.frostling_5.desc'),
    },
    // ---- owl フクロウ（鳥・m・飛ぶ）: 雪の夜のフクロウ。眠りの歌、惑わしの目、そして術を使う賢者。
    owl_1: {
      name: R.T('monsters.owl_1.name'), sprite: 'owl_1', lineage: 'owl', stage: 1, lv: 7, size: 'm', race: 'bird',
      flags: ['flying'], s: { hp: 1.23, atk: 0.9, mag: 0.9, agi: 1.2 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_peck', w: 2 }],
      drops: { normal: { item: 'i_stone_wind', rate: 8 } },
      desc: R.T('monsters.owl_1.desc'),
    },
    owl_2: {
      name: R.T('monsters.owl_2.name'), sprite: 'owl_2', lineage: 'owl', stage: 2, lv: 19, size: 'm', race: 'bird',
      flags: ['flying'], s: { hp: 1.59, atk: 0.67, mag: 0.73, agi: 1.15 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_lullaby', w: 3 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.owl_2.desc'),
    },
    owl_3: {
      name: R.T('monsters.owl_3.name'), sprite: 'owl_3', lineage: 'owl', stage: 3, lv: 31, size: 'm', race: 'bird',
      flags: ['flying'], s: { hp: 2.03, atk: 0.35, mag: 0.4, agi: 1.2 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_evil_eye', w: 2 }, { id: 'e_gust', w: 2 }, { id: 'e_snipe', w: 2 }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: R.T('monsters.owl_3.desc'),
    },
    owl_4: {
      name: R.T('monsters.owl_4.name'), sprite: 'owl_4', lineage: 'owl', stage: 4, lv: 43, size: 'm', race: 'bird', affinity: 'light',
      flags: ['flying'], s: { hp: 3.36, atk: 0.39, mag: 0.5, mdef: 1.25, agi: 1.1 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_light_ray', w: 2 }, { id: 'e_gust', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }, { id: 'e_heal_all', w: 1, cond: { hpBelow: 0.6 } }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'w_sword_moon', rate: 16 } },
      desc: R.T('monsters.owl_4.desc'),
    },
    // ---- mammoth マンモス（獣・l）: 雪原の巨獣。突進と踏み鳴らし。鉄の牙、そして大王。
    mammoth_1: {
      name: R.T('monsters.mammoth_1.name'), sprite: 'mammoth_1', lineage: 'mammoth', stage: 1, lv: 7, size: 'l', race: 'beast',
      flags: [], s: { hp: 0.7, atk: 2.18, mag: 1.98, def: 1.2, agi: 0.7 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_charge', w: 2 }, { id: 'e_stomp', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.mammoth_1.desc'),
    },
    mammoth_2: {
      name: R.T('monsters.mammoth_2.name'), sprite: 'mammoth_2', lineage: 'mammoth', stage: 2, lv: 25, size: 'l', race: 'beast',
      flags: [], s: { hp: 1.06, atk: 1.05, mag: 0.92, def: 1.3, agi: 0.65 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_charge', w: 2 }, { id: 'e_stomp', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'defend', w: 1, cond: { hpBelow: 0.4 } }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: R.T('monsters.mammoth_2.desc'),
    },
    mammoth_3: {
      name: R.T('monsters.mammoth_3.name'), sprite: 'mammoth_3', lineage: 'mammoth', stage: 3, lv: 43, size: 'l', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.58, atk: 0.91, mag: 0.76, def: 1.25, agi: 0.65 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_charge', w: 2 }, { id: 'e_avalanche', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 2] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'hd_yeti_fur', rate: 16 } },
      desc: R.T('monsters.mammoth_3.desc'),
    },
  });
  // @@V2-BEGIN 縦切りのレア枠（BATTLE、2026-09-27。オーナー「レアがめっきり減ったねえ……」。決まりと見込みは monsters_common.js の同じ区画）
  // 灰色オオカミ・霜牙オオカミ（森の z_verda に出る）
  // 消耗品（オーナー「普通の雑魚は多くはレアっつっても消耗品でいいよ」）。よみがえりの花（全回復で起こす）は終盤から → 癒やしの香炉（2026-09-28）
  const DEMO_RARE = { wolf_1: 'i_horn', wolf_2: 'i_incense' };
  const DEMO_STEAL = { wolf_2: 'w_dagger_st_frostfang' };
  for (const [id, item] of Object.entries(DEMO_RARE)) if (R.DB.monsters[id]) R.DB.monsters[id].drops = Object.assign({}, R.DB.monsters[id].drops, { rare: { item, rate: /_2$/.test(id) ? 12 : 16 } });
  for (const [id, item] of Object.entries(DEMO_STEAL)) if (R.DB.monsters[id]) R.DB.monsters[id].drops = Object.assign({}, R.DB.monsters[id].drops, { steal: { item, rate: 16 } });
  // @@V2-END
})(window.RPG);
