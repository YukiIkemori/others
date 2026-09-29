// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_forest.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: 地方1 ヴェルダの森（ハチ・キノコ・人食い花・妖精・魔木）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- bee ハチ（虫・s・飛ぶ）: 森の花畑のハチ。針は毒・しびれ・雨のような連射へ。最後は女王。
    bee_1: {
      name: R.T('monsters.bee_1.name'), sprite: 'bee_1', lineage: 'bee', stage: 1, lv: 7, size: 's', race: 'insect',
      flags: ['flying'], s: { hp: 1.45, atk: 1.03, mag: 1.03, agi: 1.35 }, eva: 15,
      elem: { fire: 1.5, wind: 1.5, earth: 0.5 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_sting', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.bee_1.desc'),
    },
    bee_2: {
      name: R.T('monsters.bee_2.name'), sprite: 'bee_2', lineage: 'bee', stage: 2, lv: 19, size: 's', race: 'insect',
      flags: ['flying'], s: { hp: 2.37, atk: 0.52, mag: 0.5, agi: 1.35 }, eva: 15,
      elem: { fire: 1.5, wind: 1.5, earth: 0.5 }, phys: {}, statusRes: { poison: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_poison_sting', w: 3 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: R.T('monsters.bee_2.desc'),
    },
    bee_3: {
      name: R.T('monsters.bee_3.name'), sprite: 'bee_3', lineage: 'bee', stage: 3, lv: 31, size: 's', race: 'insect',
      flags: ['flying'], s: { hp: 2.54, atk: 0.63, mag: 0.63, agi: 1.35 }, eva: 15,
      elem: { fire: 1.5, wind: 1.5, earth: 0.5 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_numb_sting', w: 3 }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: R.T('monsters.bee_3.desc'),
    },
    bee_4: {
      name: R.T('monsters.bee_4.name'), sprite: 'bee_4', lineage: 'bee', stage: 4, lv: 43, size: 's', race: 'insect',
      flags: ['flying'], s: { hp: 4.2, atk: 0.46, mag: 0.42, agi: 1.35 }, eva: 15,
      elem: { fire: 1.5, wind: 1.5, earth: 0.5 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_needles', w: 3 }, { id: 'e_poison_sting', w: 1 }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.bee_4.desc'),
    },
    bee_5: {
      name: R.T('monsters.bee_5.name'), sprite: 'bee_5', lineage: 'bee', stage: 5, lv: 55, size: 's', race: 'insect',
      flags: ['flying'], s: { hp: 3.64, atk: 0.47, mag: 0.49, agi: 1.2 }, eva: 12,
      elem: { fire: 1.5, wind: 1.5, earth: 0.5 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_call_lesser', w: 2, cond: { countBelow: 6 } }, { id: 'e_heal_all', w: 2, cond: { hpBelow: 0.7 } }, { id: 'e_poison_sting', w: 2 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_millennium_seed', rate: 32 }, super: { item: 'ft_sr_whirl', rate: 128 } },
      desc: R.T('monsters.bee_5.desc'),
    },
    // ---- mushroom キノコ（植物・s）: 胞子で眠らせ、毒にし、惑わせる。長老は森を癒やす。
    mushroom_1: {
      name: R.T('monsters.mushroom_1.name'), sprite: 'mushroom_1', lineage: 'mushroom', stage: 1, lv: 7, size: 's', race: 'plant',
      flags: [], s: { hp: 1.26, atk: 2.11, mag: 2.35, agi: 0.6 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_sleep_spore', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.mushroom_1.desc'),
    },
    mushroom_2: {
      name: R.T('monsters.mushroom_2.name'), sprite: 'mushroom_2', lineage: 'mushroom', stage: 2, lv: 19, size: 's', race: 'plant',
      flags: [], s: { hp: 2.06, atk: 1.57, mag: 1.74, agi: 0.6 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_poison_spore', w: 3 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: R.T('monsters.mushroom_2.desc'),
    },
    mushroom_3: {
      name: R.T('monsters.mushroom_3.name'), sprite: 'mushroom_3', lineage: 'mushroom', stage: 3, lv: 31, size: 's', race: 'plant',
      flags: [], s: { hp: 1.62, atk: 1.2, mag: 1.31, agi: 0.7 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_confuse_spore', w: 3 }, { id: 'e_sleep_spore', w: 1 }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: R.T('monsters.mushroom_3.desc'),
    },
    mushroom_4: {
      name: R.T('monsters.mushroom_4.name'), sprite: 'mushroom_4', lineage: 'mushroom', stage: 4, lv: 43, size: 's', race: 'plant', affinity: 'earth',
      flags: [], s: { hp: 1.97, atk: 1.15, mag: 1.38, mdef: 1.2, agi: 0.6 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, wind: 1.5, earth: 0.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_spore_storm', w: 2 }, { id: 'e_heal_all', w: 2, cond: { hpBelow: 0.7 } }, { id: 'e_confuse_spore', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'hd_fairy_circlet', rate: 32 } },
      desc: R.T('monsters.mushroom_4.desc'),
    },
    // ---- plant 人食い花（植物・m）: かみつく花。いばら、毒の息、夜咲き、そして千年咲き続ける光の花へ。
    plant_1: {
      name: R.T('monsters.plant_1.name'), sprite: 'plant_1', lineage: 'plant', stage: 1, lv: 7, size: 'm', race: 'plant',
      flags: [], s: { hp: 1.12, atk: 1.24, mag: 1.19, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_bite', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.plant_1.desc'),
    },
    plant_2: {
      name: R.T('monsters.plant_2.name'), sprite: 'plant_2', lineage: 'plant', stage: 2, lv: 19, size: 'm', race: 'plant',
      flags: [], s: { hp: 1.84, atk: 1.03, mag: 0.93, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_thorn_vine', w: 2 }, { id: 'e_bind', w: 2 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: R.T('monsters.plant_2.desc'),
    },
    plant_3: {
      name: R.T('monsters.plant_3.name'), sprite: 'plant_3', lineage: 'plant', stage: 3, lv: 31, size: 'm', race: 'plant',
      flags: [], s: { hp: 2.26, atk: 0.53, mag: 0.59, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_poison_breath', w: 3 }, { id: 'e_bite', w: 2 }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: R.T('monsters.plant_3.desc'),
    },
    plant_4: {
      name: R.T('monsters.plant_4.name'), sprite: 'plant_4', lineage: 'plant', stage: 4, lv: 43, size: 'm', race: 'plant', affinity: 'dark',
      flags: [], s: { hp: 1.95, atk: 0.8, mag: 0.92, agi: 0.85 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, earth: 0.75, light: 1.5, dark: 0.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_sleep_pollen', w: 2 }, { id: 'e_life_suck', w: 2 }, { id: 'e_bite', w: 1 }],
      drops: { normal: { item: 'i_stone_dark', rate: 8 } },
      desc: R.T('monsters.plant_4.desc'),
    },
    plant_5: {
      name: R.T('monsters.plant_5.name'), sprite: 'plant_5', lineage: 'plant', stage: 5, lv: 55, size: 'm', race: 'plant', affinity: 'light',
      flags: [], s: { hp: 1.92, atk: 0.59, mag: 0.7, mdef: 1.2, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, earth: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_heal_all', w: 2, cond: { hpBelow: 0.8 } }, { id: 'e_flash', w: 2 }, { id: 'e_spore_storm', w: 1 }, { id: 'e_regen_self', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_millennium_seed', rate: 32 }, super: { item: 'bd_sr_thousand_petal', rate: 256 } },
      desc: R.T('monsters.plant_5.desc'),
    },
    // ---- fairy 妖精（妖精・s・飛ぶ）: 森の小さな住人。いたずら、花の癒やし、霧の歌、そして妖精の姫。
    fairy_1: {
      name: R.T('monsters.fairy_1.name'), sprite: 'fairy_1', lineage: 'fairy', stage: 1, lv: 7, size: 's', race: 'fairy',
      flags: ['flying'], s: { hp: 0.96, atk: 0.97, mag: 1.06, agi: 1.4 }, eva: 15,
      elem: { wind: 1.5, earth: 0.5, light: 0.5, dark: 1.5 }, phys: { pierce: 1.25 }, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_prank', w: 2 }, { id: 'e_wind_blade', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.fairy_1.desc'),
    },
    fairy_2: {
      name: R.T('monsters.fairy_2.name'), sprite: 'fairy_2', lineage: 'fairy', stage: 2, lv: 19, size: 's', race: 'fairy', affinity: 'light',
      flags: ['flying'], s: { hp: 1.52, atk: 0.57, mag: 0.68, mdef: 1.1, agi: 1.3 }, eva: 15,
      elem: { wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 }, phys: { pierce: 1.25 }, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_heal_ally', w: 3, cond: { hpBelow: 0.7 } }, { id: 'e_light_ray', w: 2 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('monsters.fairy_2.desc'),
    },
    fairy_3: {
      name: R.T('monsters.fairy_3.name'), sprite: 'fairy_3', lineage: 'fairy', stage: 3, lv: 31, size: 's', race: 'fairy', affinity: 'water',
      flags: ['flying'], s: { hp: 1.4, atk: 0.65, mag: 0.78, agi: 1.3 }, eva: 15,
      elem: { water: 0.25, wind: 1.5, earth: 1.5, light: 0.5, dark: 1.5 }, phys: { pierce: 1.25 }, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_lullaby', w: 2 }, { id: 'e_water_bolt', w: 2 }, { id: 'e_hush', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('monsters.fairy_3.desc'),
    },
    fairy_4: {
      name: R.T('monsters.fairy_4.name'), sprite: 'fairy_4', lineage: 'fairy', stage: 4, lv: 43, size: 's', race: 'fairy', affinity: 'light',
      flags: ['flying'], s: { hp: 2.18, atk: 0.46, mag: 0.6, mdef: 1.2, agi: 1.3 }, eva: 15,
      elem: { wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 }, phys: { pierce: 1.25 }, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_heal_all', w: 2, cond: { hpBelow: 0.8 } }, { id: 'e_charm', w: 2 }, { id: 'e_light_ray', w: 2 }, { id: 'e_veil_ally', w: 1, cond: { every: [4, 0] } }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'hd_fairy_circlet', rate: 32 }, steal: { item: 'hd_st_fairy_queen', rate: 32 } },
      desc: R.T('monsters.fairy_4.desc'),
    },
    // ---- treant 魔木（植物・l）: 森を歩き回る木。根で縛り、いばらで打ち、最後は森の古老になる。
    treant_1: {
      name: R.T('monsters.treant_1.name'), sprite: 'treant_1', lineage: 'treant', stage: 1, lv: 7, size: 'l', race: 'plant', affinity: 'earth',
      flags: [], s: { hp: 0.82, atk: 1.82, mag: 1.82, def: 1.2, agi: 0.7 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, wind: 1.5, earth: 0.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_root_bind', w: 2 }, { id: 'e_sweep', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('monsters.treant_1.desc'),
    },
    treant_2: {
      name: R.T('monsters.treant_2.name'), sprite: 'treant_2', lineage: 'treant', stage: 2, lv: 19, size: 'l', race: 'plant', affinity: 'earth',
      flags: [], s: { hp: 1.15, atk: 1.17, mag: 1.06, def: 1.2, agi: 0.7 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, wind: 1.5, earth: 0.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_thorn_vine', w: 2 }, { id: 'e_sweep', w: 2 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: R.T('monsters.treant_2.desc'),
    },
    treant_3: {
      name: R.T('monsters.treant_3.name'), sprite: 'treant_3', lineage: 'treant', stage: 3, lv: 31, size: 'l', race: 'plant', affinity: 'earth',
      flags: [], s: { hp: 1.21, atk: 1.26, mag: 1.26, def: 1.25, mdef: 1.1, agi: 0.65 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, wind: 1.5, earth: 0.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_regen_self', w: 1, cond: { once: true } }, { id: 'e_root_bind', w: 2 }, { id: 'e_stomp', w: 2 }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.treant_3.desc'),
    },
    treant_4: {
      name: R.T('monsters.treant_4.name'), sprite: 'treant_4', lineage: 'treant', stage: 4, lv: 43, size: 'l', race: 'plant', affinity: 'earth',
      flags: [], s: { hp: 1.8, atk: 0.92, mag: 1.06, def: 1.25, agi: 0.6 }, eva: 5,
      elem: { fire: 1.5, water: 0.5, wind: 1.5, earth: 0.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_quake', w: 2 }, { id: 'e_heal_all', w: 1, cond: { hpBelow: 0.6 } }, { id: 'e_root_bind', w: 2 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_sword_hornet', rate: 32 } },
      desc: R.T('monsters.treant_4.desc'),
    },
  });
  // @@V2-BEGIN 縦切りのレア枠（BATTLE、2026-09-27。オーナー「レアがめっきり減ったねえ……」。決まりと見込みは monsters_common.js の同じ区画）
  // 花バチ〜さまよい木の段 1〜2
  // オーナー「普通の雑魚は多くはレアっつっても消耗品でいいよ」: 段 1 と まだらダケ・いばら花は消耗品、装備は段 2 の 3 体（短剣・杖・大剣）だけ
  // 全回復と魔力の霊水は外した（オーナー 2026-09-28「序盤のレアは 30% 回復くらいまで」。決まりは monsters_common.js の同じ区画）
  const DEMO_RARE = { bee_1: 'i_incense', bee_2: 'w_dagger_r1', mushroom_1: 'i_panacea', mushroom_2: 'i_tonic', plant_1: 'i_tonic', plant_2: 'i_bomb',
    fairy_1: 'i_tonic', fairy_2: 'w_staff_r1', treant_1: 'i_censer', treant_2: 'w_greatsword_r1' };
  const DEMO_STEAL = { bee_1: 'ac_st_royal_jelly', mushroom_1: 'ac_st_spore_sachet', fairy_2: 'w_staff_st_petal' };
  for (const [id, item] of Object.entries(DEMO_RARE)) if (R.DB.monsters[id]) R.DB.monsters[id].drops = Object.assign({}, R.DB.monsters[id].drops, { rare: { item, rate: /_2$/.test(id) ? 16 : 32 } });
  for (const [id, item] of Object.entries(DEMO_STEAL)) if (R.DB.monsters[id]) R.DB.monsters[id].drops = Object.assign({}, R.DB.monsters[id].drops, { steal: { item, rate: 32 } });
  // @@V2-END
})(window.RPG);
