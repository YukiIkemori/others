// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_desert.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: 地方2 ザハラ砂漠（サソリ・ヘビ・ミイラ・サボテン・ミミズ）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- scorpion サソリ（虫・m）: 砂漠の毒虫。毒の尾、鋼の殻、死神の一刺し、そして皇帝。
    scorpion_1: {
      name: R.T('monsters.scorpion_1.name'), goldName: R.T('monsters.scorpion_1.goldName'), sprite: 'scorpion_1', lineage: 'scorpion', stage: 1, lv: 7, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.26, atk: 1.17, mag: 1.17, def: 1.2 }, eva: 5,
      elem: { fire: 0.75, wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_pincer', w: 2 }, { id: 'e_poison_sting', w: 1 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: R.T('monsters.scorpion_1.desc'),
    },
    scorpion_2: {
      name: R.T('monsters.scorpion_2.name'), sprite: 'scorpion_2', lineage: 'scorpion', stage: 2, lv: 19, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.65, atk: 0.84, mag: 0.8, def: 1.2 }, eva: 5,
      elem: { fire: 0.75, wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_poison_sting', w: 3 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: R.T('monsters.scorpion_2.desc'),
    },
    scorpion_3: {
      name: R.T('monsters.scorpion_3.name'), sprite: 'scorpion_3', lineage: 'scorpion', stage: 3, lv: 31, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.72, atk: 0.88, mag: 0.88, def: 1.5, agi: 0.85 }, eva: 5,
      elem: { fire: 0.75, wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_pincer', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'e_numb_sting', w: 2 }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.scorpion_3.desc'),
    },
    scorpion_4: {
      name: R.T('monsters.scorpion_4.name'), sprite: 'scorpion_4', lineage: 'scorpion', stage: 4, lv: 43, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 2.92, atk: 0.67, mag: 0.58, def: 1.2 }, eva: 5,
      elem: { fire: 0.75, wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_death_sting', w: 2 }, { id: 'e_poison_sting', w: 2 }, { id: 'e_double', w: 1 }, { id: 'e_finish', w: 1 }],
      drops: { normal: { item: 'i_revive', rate: 8 } },
      desc: R.T('monsters.scorpion_4.desc'),
    },
    scorpion_5: {
      name: R.T('monsters.scorpion_5.name'), sprite: 'scorpion_5', lineage: 'scorpion', stage: 5, lv: 55, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 2.89, atk: 0.58, mag: 0.53, def: 1.4, agi: 0.9 }, eva: 5,
      elem: { fire: 0.75, wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_death_sting', w: 1 }, { id: 'e_pincer', w: 2 }, { id: 'e_quake', w: 1 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_royal_ankh', rate: 16 }, super: { item: 'hn_sr_hundred', rate: 128 } },
      desc: R.T('monsters.scorpion_5.desc'),
    },
    // ---- snake ヘビ（獣・m）: 砂漠の蛇。毒、鈴の音のおどし、にらみ、丸のみの大蛇へ。
    snake_1: {
      name: R.T('monsters.snake_1.name'), sprite: 'snake_1', lineage: 'snake', stage: 1, lv: 7, size: 'm', race: 'beast',
      flags: [], s: { hp: 1.25, atk: 1.37, mag: 1.31, agi: 1.05 }, eva: 5,
      elem: { water: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_poison_bite', w: 2 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: R.T('monsters.snake_1.desc'),
    },
    snake_2: {
      name: R.T('monsters.snake_2.name'), sprite: 'snake_2', lineage: 'snake', stage: 2, lv: 19, size: 'm', race: 'beast',
      flags: [], s: { hp: 1.6, atk: 0.91, mag: 0.87, agi: 1.1 }, eva: 5,
      elem: { water: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_scare', w: 2 }, { id: 'e_poison_bite', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.snake_2.desc'),
    },
    snake_3: {
      name: R.T('monsters.snake_3.name'), sprite: 'snake_3', lineage: 'snake', stage: 3, lv: 31, size: 'm', race: 'beast',
      flags: [], s: { hp: 1.8, atk: 0.88, mag: 0.97, agi: 1.05 }, eva: 5,
      elem: { water: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_gaze', w: 2 }, { id: 'e_bind', w: 2 }, { id: 'e_finish', w: 1 }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: R.T('monsters.snake_3.desc'),
    },
    snake_4: {
      name: R.T('monsters.snake_4.name'), sprite: 'snake_4', lineage: 'snake', stage: 4, lv: 43, size: 'm', race: 'beast', affinity: 'earth',
      flags: [], s: { hp: 3.52, atk: 0.67, mag: 0.58, agi: 0.95 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_bind', w: 2 }, { id: 'e_poison_bite', w: 2 }, { id: 'e_swallow', w: 1 }],
      drops: { normal: { item: 'i_potion2', rate: 8 }, rare: { item: 'w_sword_sand', rate: 16 } },
      desc: R.T('monsters.snake_4.desc'),
    },
    // ---- mummy ミイラ（不死・m）: 王墓を守る死者たち。兵、呪い、神官、将軍、そして王家の者。
    mummy_1: {
      name: R.T('monsters.mummy_1.name'), sprite: 'mummy_1', lineage: 'mummy', stage: 1, lv: 7, size: 'm', race: 'undead',
      flags: [], s: { hp: 1.35, atk: 1.75, mag: 1.75, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_bandage', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.mummy_1.desc'),
    },
    mummy_2: {
      name: R.T('monsters.mummy_2.name'), sprite: 'mummy_2', lineage: 'mummy', stage: 2, lv: 19, size: 'm', race: 'undead',
      flags: [], s: { hp: 1.59, atk: 1.38, mag: 1.52, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_curse', w: 2 }, { id: 'e_bandage', w: 2 }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: R.T('monsters.mummy_2.desc'),
    },
    mummy_3: {
      name: R.T('monsters.mummy_3.name'), sprite: 'mummy_3', lineage: 'mummy', stage: 3, lv: 31, size: 'm', race: 'undead',
      flags: [], s: { hp: 1.77, atk: 0.65, mag: 1.06, mdef: 1.3 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_revive_ally', w: 1, cond: { allyDown: true } }, { id: 'e_heal_ally', w: 1, cond: { hpBelow: 0.6 } }, { id: 'e_curse', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('monsters.mummy_3.desc'),
    },
    mummy_4: {
      name: R.T('monsters.mummy_4.name'), sprite: 'mummy_4', lineage: 'mummy', stage: 4, lv: 43, size: 'm', race: 'undead',
      flags: [], s: { hp: 2.75, atk: 0.9, mag: 0.75, def: 1.15, agi: 0.85 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_slash', w: 2 }, { id: 'e_howl', w: 1 }, { id: 'e_bandage', w: 1 }, { id: 'e_weaken', w: 2 }],
      drops: { normal: { item: 'i_revive', rate: 8 } },
      desc: R.T('monsters.mummy_4.desc'),
    },
    mummy_5: {
      name: R.T('monsters.mummy_5.name'), sprite: 'mummy_5', lineage: 'mummy', stage: 5, lv: 55, size: 'm', race: 'undead',
      flags: [], s: { hp: 2.47, atk: 0.51, mag: 0.64, mdef: 1.2, agi: 0.85 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_death_word', w: 1 }, { id: 'e_dark_mist', w: 2 }, { id: 'e_revive_ally', w: 1, cond: { allyDown: true } }, { id: 'e_curse', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_royal_ankh', rate: 16 }, super: { item: 'bd_sr_shadow', rate: 128 }, steal: { item: 'bd_st_royal_linen', rate: 16 } },
      desc: R.T('monsters.mummy_5.desc'),
    },
    // ---- cactus サボテン（植物・m）: 砂漠をうろつくサボテン。針を飛ばし、花を咲かせ、大将になる。
    cactus_1: {
      name: R.T('monsters.cactus_1.name'), sprite: 'cactus_1', lineage: 'cactus', stage: 1, lv: 7, size: 'm', race: 'plant',
      flags: [], s: { hp: 1.29, atk: 1.14, mag: 1.14, def: 1.1, agi: 0.85 }, eva: 5,
      elem: { water: 0.5, earth: 0.75, dark: 1.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_needles', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.cactus_1.desc'),
    },
    cactus_2: {
      name: R.T('monsters.cactus_2.name'), sprite: 'cactus_2', lineage: 'cactus', stage: 2, lv: 19, size: 'm', race: 'plant',
      flags: [], s: { hp: 1.92, atk: 0.61, mag: 0.58, def: 1.1, agi: 0.85 }, eva: 5,
      elem: { water: 0.5, earth: 0.75, dark: 1.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_needles', w: 4 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.cactus_2.desc'),
    },
    cactus_3: {
      name: R.T('monsters.cactus_3.name'), sprite: 'cactus_3', lineage: 'cactus', stage: 3, lv: 31, size: 'm', race: 'plant',
      flags: [], s: { hp: 1.78, atk: 0.73, mag: 0.81, agi: 0.85 }, eva: 5,
      elem: { water: 0.5, earth: 0.75, dark: 1.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_sleep_pollen', w: 2 }, { id: 'e_needles', w: 2 }, { id: 'e_heal_self', w: 1, cond: { hpBelow: 0.5 } }, { id: 'e_guard_stance', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('monsters.cactus_3.desc'),
    },
    cactus_4: {
      name: R.T('monsters.cactus_4.name'), sprite: 'cactus_4', lineage: 'cactus', stage: 4, lv: 43, size: 'm', race: 'plant', affinity: 'earth',
      flags: [], s: { hp: 3.48, atk: 0.62, mag: 0.54, def: 1.2, agi: 0.85 }, eva: 5,
      elem: { water: 0.5, wind: 1.5, earth: 0.25, dark: 1.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_needles', w: 3 }, { id: 'e_focus', w: 1, cond: { once: true } }, { id: 'e_heavy', w: 1 }, { id: 'e_guard_stance', w: 1 }],
      drops: { normal: { item: 'i_potion2', rate: 8 }, rare: { item: 'w_sword_sand', rate: 16 } },
      desc: R.T('monsters.cactus_4.desc'),
    },
    // ---- sandworm ミミズ（虫・l）: 砂の下を泳ぐ巨大なミミズ。砂ぼこり、岩の体、大地の揺れ。
    sandworm_1: {
      name: R.T('monsters.sandworm_1.name'), sprite: 'sandworm_1', lineage: 'sandworm', stage: 1, lv: 7, size: 'l', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 0.73, atk: 1.58, mag: 1.51, agi: 0.7 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25, light: 1.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_swallow', w: 1 }, { id: 'e_dust', w: 2 }],
      drops: { normal: { item: 'i_stone_earth', rate: 8 } },
      desc: R.T('monsters.sandworm_1.desc'),
    },
    sandworm_2: {
      name: R.T('monsters.sandworm_2.name'), sprite: 'sandworm_2', lineage: 'sandworm', stage: 2, lv: 25, size: 'l', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.13, atk: 0.96, mag: 0.96, def: 1.3, agi: 0.65 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25, light: 1.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_crush', w: 2 }, { id: 'e_quake', w: 2 }, { id: 'e_ambush', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: R.T('monsters.sandworm_2.desc'),
    },
    sandworm_3: {
      name: R.T('monsters.sandworm_3.name'), sprite: 'sandworm_3', lineage: 'sandworm', stage: 3, lv: 43, size: 'l', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 2.17, atk: 0.73, mag: 0.64, def: 1.2, agi: 0.65 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25, light: 1.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_swallow', w: 2 }, { id: 'e_quake', w: 2 }, { id: 'e_dust', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_greatsword_dune', rate: 16 } },
      desc: R.T('monsters.sandworm_3.desc'),
    },
  });
})(window.RPG);
