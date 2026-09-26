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
      name: '魚人の見張り', sprite: 'merman_1', lineage: 'merman', stage: 1, lv: 7, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.19, atk: 0.96, mag: 0.89 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_thrust', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_spear_coral', rate: 32 }, super: { item: 'ft_sr_fin_boots', rate: 256 } },
      desc: '岩礁から海を見張る魚人。\n三つ叉の槍で突いてくる。',
    },
    merman_2: {
      name: '魚人のもり兵', sprite: 'merman_2', lineage: 'merman', stage: 2, lv: 19, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.71, atk: 0.62, mag: 0.55 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_thrust', w: 2 }, { id: 'e_tide', w: 1 }],
      drops: { normal: { item: 'i_stone_water', rate: 8 }, rare: { item: 'sh_tide_shield', rate: 32 }, super: { item: 'w_spear_sr_harpoon', rate: 256 } },
      desc: 'もりを投げて船を沈める魚人。\n狙った獲物は逃さない。',
    },
    merman_3: {
      name: '魚人の呪い師', sprite: 'merman_3', lineage: 'merman', stage: 3, lv: 31, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.78, atk: 0.41, mag: 0.41, mdef: 1.2 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_water_bolt', w: 2 }, { id: 'e_tide', w: 2 }, { id: 'e_heal_ally', w: 1, cond: { hpBelow: 0.6 } }],
      drops: { normal: { item: 'i_ether', rate: 8 }, rare: { item: 'ac_pearl_ear', rate: 32 }, super: { item: 'w_staff_sr_coralwand', rate: 256 } },
      desc: 'さんごの杖をもつ魚人の術師。\n海の水を思いのままに操る。',
    },
    merman_4: {
      name: '魚人の騎士', sprite: 'merman_4', lineage: 'merman', stage: 4, lv: 43, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 2.1, atk: 0.64, def: 1.25, mag: 0.57 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_thrust', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'e_tide', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_katana_tide', rate: 32 }, super: { item: 'w_sword_sr_merknight', rate: 256 } },
      desc: '海の王に仕える魚人の騎士。\nうろこの鎧は刃を通さない。',
    },
    // ---- kraken タコ（水生・l）: 洞窟と船底の大ダコ。墨、八本の腕、渦潮。
    kraken_1: {
      name: '墨吹きダコ', sprite: 'kraken_1', lineage: 'kraken', stage: 1, lv: 7, size: 'l', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 0.96, agi: 0.85 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_ink', w: 2 }, { id: 'e_tentacles', w: 2 }],
      drops: { normal: { item: 'i_clear', rate: 8 }, rare: { item: 'w_spear_coral', rate: 32 }, super: { item: 'hd_sr_octopus_cap', rate: 256 } },
      desc: '岩のすき間にひそむ大ダコ。\n墨を吐いて目をくらます。',
    },
    kraken_2: {
      name: '八本腕ダコ', sprite: 'kraken_2', lineage: 'kraken', stage: 2, lv: 25, size: 'l', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.15, atk: 0.92, agi: 0.85, mag: 0.85 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_tentacles', w: 3 }, { id: 'e_bind', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_fist_wormtooth', rate: 32 }, super: { item: 'w_whip_sr_eightarm', rate: 256 } },
      desc: '八本の腕で同時に襲いかかる。\n捕まったら逃げられない。',
    },
    kraken_3: {
      name: '渦潮ダコ', sprite: 'kraken_3', lineage: 'kraken', stage: 3, lv: 43, size: 'l', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.25, atk: 0.67, mag: 0.7, agi: 0.85 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_tentacles', w: 2 }, { id: 'e_tide', w: 2 }, { id: 'e_ink', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_katana_tide', rate: 32 }, super: { item: 'bd_sr_whirlpool', rate: 256 } },
      desc: '体のまわりに渦をまとう大ダコ。\n船ごと海に引きこむ。',
    },
    // ---- skeleton 骸骨（不死・m）: 幽霊船の骸骨の船乗り。水夫・海賊・砲手・航海士・提督。
    skeleton_1: {
      name: '骸骨の水夫', sprite: 'skeleton_1', lineage: 'skeleton', stage: 1, lv: 7, size: 'm', race: 'undead',
      flags: [], s: { atk: 1.05, hp: 1.15 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_slash', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_spear_coral', rate: 32 }, super: { item: 'w_sword_sr_cutlass', rate: 256 } },
      desc: '沈んだ船から戻ってきた水夫。\nさびた刀で斬りかかる。',
    },
    skeleton_2: {
      name: '骸骨の海賊', sprite: 'skeleton_2', lineage: 'skeleton', stage: 2, lv: 19, size: 'm', race: 'undead',
      flags: [], s: { atk: 0.73, agi: 1.05, hp: 1.62, mag: 0.68 }, rw: { gold: 1.5 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_double', w: 2 }, { id: 'e_slash', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'sh_tide_shield', rate: 32 }, super: { item: 'ac_sr_pirate_coin', rate: 256 } },
      desc: '宝を探し続ける骸骨の海賊。\n金貨の音にだけは反応する。',
    },
    skeleton_3: {
      name: '骸骨の砲手', sprite: 'skeleton_3', lineage: 'skeleton', stage: 3, lv: 31, size: 'm', race: 'undead', affinity: 'fire',
      flags: [], s: { hp: 2.22, atk: 0.35, mag: 0.35 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_cannon', w: 3 }],
      drops: { normal: { item: 'i_firepot', rate: 8 }, rare: { item: 'ac_pearl_ear', rate: 32 }, super: { item: 'ac_sr_firebird', rate: 256 } },
      desc: '腕ごと大砲になった骸骨。\n船の上でも撃ってくる。',
    },
    skeleton_4: {
      name: '骸骨の航海士', sprite: 'skeleton_4', lineage: 'skeleton', stage: 4, lv: 43, size: 'm', race: 'undead',
      flags: [], s: { hp: 2.5, atk: 0.87, mag: 0.87 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_slash', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }, { id: 'e_curse', w: 1 }],
      drops: { normal: { item: 'i_revive', rate: 8 }, rare: { item: 'w_katana_tide', rate: 32 }, super: { item: 'ac_sr_ghost_compass', rate: 256 } },
      desc: '死んでも航路を探す航海士。\n行き先はもう誰も知らない。',
    },
    skeleton_5: {
      name: '骸骨の提督', sprite: 'skeleton_5', lineage: 'skeleton', stage: 5, lv: 55, size: 'm', race: 'undead',
      flags: [], s: { hp: 2.28, atk: 0.57, mag: 0.54 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_cannon', w: 2 }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }, { id: 'e_howl', w: 1, cond: { once: true } }, { id: 'e_slash', w: 2 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_admiral_medal', rate: 32 }, super: { item: 'w_sword_sr_admiral', rate: 256 } },
      desc: '沈んだ艦隊を率いる提督。\n号令ひとつで大砲が鳴る。',
    },
  });
})(window.RPG);
