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
      name: '灰色オオカミ', goldName: '金色オオカミ', sprite: 'wolf_1', lineage: 'wolf', stage: 1, lv: 7, size: 'm', race: 'beast',
      flags: [], s: { hp: 1.22, atk: 0.97, mag: 0.92, agi: 1.15 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_bite', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'bd_wolf_pelt', rate: 32 }, super: { item: 'w_fist_sr_greywolf', rate: 256 } },
      desc: '雪原を群れで走るオオカミ。\n遠吠えで仲間を奮い立たせる。',
    },
    wolf_2: {
      name: '霜牙オオカミ', sprite: 'wolf_2', lineage: 'wolf', stage: 2, lv: 19, size: 'm', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.63, atk: 0.78, mag: 0.71, agi: 1.15 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_frost_bite', w: 3 }],
      drops: { normal: { item: 'i_stone_water', rate: 8 }, rare: { item: 'w_dagger_frost', rate: 32 }, super: { item: 'w_dagger_sr_frostfang', rate: 256 } },
      desc: '牙に霜をまとうオオカミ。\nかまれた所から凍りつく。',
    },
    wolf_3: {
      name: '吹雪オオカミ', sprite: 'wolf_3', lineage: 'wolf', stage: 3, lv: 31, size: 'm', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.82, atk: 0.42, mag: 0.44, agi: 1.15 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_frost_breath', w: 2 }, { id: 'e_bite', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'ac_blizzard_charm', rate: 32 }, super: { item: 'bd_sr_blizzard_fur', rate: 256 } },
      desc: '吹雪の中から現れる白いオオカミ。\n凍てつく息で群れを守る。',
    },
    wolf_4: {
      name: '月夜オオカミ', sprite: 'wolf_4', lineage: 'wolf', stage: 4, lv: 43, size: 'm', race: 'beast', affinity: 'dark',
      flags: [], s: { hp: 2.66, atk: 0.61, mag: 0.53, agi: 1.25 }, eva: 5,
      elem: { fire: 1.25, light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_double', w: 2 }, { id: 'e_shadow_bite', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_dark', rate: 8 }, rare: { item: 'w_katana_moon', rate: 32 }, super: { item: 'w_katana_sr_matsuyoi', rate: 256 } },
      desc: '月の出ている夜だけ現れる。\n影から影へと跳び回る。',
    },
    wolf_5: {
      name: '氷牙のオオカミ王', sprite: 'wolf_5', lineage: 'wolf', stage: 5, lv: 55, size: 'm', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 2.09, atk: 0.41, mag: 0.35, agi: 1.2 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_frost_breath', w: 2 }, { id: 'e_frost_bite', w: 2 }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_fist_wolfking', rate: 32 }, super: { item: 'ac_sr_beastheart', rate: 128 } },
      desc: '氷の冠をいただくオオカミたちの王。\n一声で吹雪を呼ぶという。',
    },
    // ---- yeti 雪男（獣・l）: 雪山の大男。雪玉、氷の拳、雪崩。
    yeti_1: {
      name: '雪男', sprite: 'yeti_1', lineage: 'yeti', stage: 1, lv: 7, size: 'l', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 0.96, atk: 1.38, mag: 1.2, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_crush', w: 1 }, { id: 'e_snowball', w: 2 }, { id: 'e_headbutt', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'bd_wolf_pelt', rate: 32 }, super: { item: 'w_fist_sr_yeti', rate: 256 } },
      desc: '雪山に住む毛むくじゃらの大男。\n大きな雪玉を投げてくる。',
    },
    yeti_2: {
      name: '氷の雪男', sprite: 'yeti_2', lineage: 'yeti', stage: 2, lv: 25, size: 'l', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.18, atk: 1.01, mag: 0.84, def: 1.1, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_frost_fist', w: 2 }, { id: 'e_frost_breath', w: 1 }, { id: 'e_focus', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_greatsword_beastfang', rate: 32 }, super: { item: 'w_axe_sr_icefist', rate: 256 } },
      desc: '体に氷の結晶が生えた雪男。\n氷の拳は岩をもくだく。',
    },
    yeti_3: {
      name: '大雪男', sprite: 'yeti_3', lineage: 'yeti', stage: 3, lv: 43, size: 'l', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.78, atk: 0.72, mag: 0.6, agi: 0.8 }, eva: 5,
      elem: { fire: 1.5, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_crush', w: 2 }, { id: 'e_avalanche', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 1] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'hd_yeti_fur', rate: 32 }, super: { item: 'hn_sr_mighty', rate: 128 } },
      desc: '雪男たちの長。骨の面をかぶり、\n雪崩を呼んで山を守る。',
    },
    // ---- frostling 氷の小鬼（妖精・m）: 雪の子どもの小鬼。こおり・つらら・ふぶき小僧から雪の大将、冬将軍へ。
    frostling_1: {
      name: 'こおり小僧', sprite: 'frostling_1', lineage: 'frostling', stage: 1, lv: 7, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 1.16, atk: 0.69, mag: 0.83, agi: 1.1 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_frost', w: 2 }],
      drops: { normal: { item: 'i_stone_water', rate: 8 }, rare: { item: 'ac_snow_crystal', rate: 32 }, super: { item: 'w_fist_sr_icicle_child', rate: 256 } },
      desc: '雪の日に生まれる小さな小鬼。\n冷たい息で遊び相手を探す。',
    },
    frostling_2: {
      name: 'つらら小僧', sprite: 'frostling_2', lineage: 'frostling', stage: 2, lv: 19, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 1.76, atk: 0.52, mag: 0.62, agi: 1.1 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_icicle', w: 3 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_dagger_frost', rate: 32 }, super: { item: 'ac_sr_glass', rate: 256 } },
      desc: '頭につららを生やした小鬼。\nつららを次々に落としてくる。',
    },
    frostling_3: {
      name: 'ふぶき小僧', sprite: 'frostling_3', lineage: 'frostling', stage: 3, lv: 31, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 1.7, atk: 0.32, mag: 0.4, agi: 1.15 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_frost', w: 2 }, { id: 'e_frost_breath', w: 2 }, { id: 'e_hush', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 }, rare: { item: 'ac_blizzard_charm', rate: 32 }, super: { item: 'hd_sr_blizzard_hat', rate: 256 } },
      desc: '吹雪をまとって現れる小鬼。\n通ったあとは真っ白になる。',
    },
    frostling_4: {
      name: '雪の大将', sprite: 'frostling_4', lineage: 'frostling', stage: 4, lv: 43, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 2.5, atk: 0.47, mag: 0.45, agi: 1.05 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_frost_fist', w: 2 }, { id: 'e_frost', w: 2 }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_katana_moon', rate: 32 }, super: { item: 'w_katana_sr_snowgeneral', rate: 256 } },
      desc: '氷の兜をかぶった小鬼の\n大将。雪の子らを率いる。',
    },
    frostling_5: {
      name: '冬将軍', sprite: 'frostling_5', lineage: 'frostling', stage: 5, lv: 55, size: 'm', race: 'fairy', affinity: 'water',
      flags: [], s: { hp: 2.76, atk: 0.38, mag: 0.42, agi: 1.05 }, eva: 5,
      elem: { fire: 1.25, water: -1, earth: 1.5, light: 0.5, dark: 1.5 }, phys: {}, statusRes: { confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_frost', w: 2 }, { id: 'e_icicle', w: 2 }, { id: 'e_freeze_gaze', w: 1 }, { id: 'e_haste', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_fist_wolfking', rate: 32 }, super: { item: 'ft_sr_cloud', rate: 128 } },
      desc: '冬そのものといわれる小鬼の王。\n来ると、春が遠のく。',
    },
    // ---- owl フクロウ（鳥・m・飛ぶ）: 雪の夜のフクロウ。眠りの歌、惑わしの目、そして術を使う賢者。
    owl_1: {
      name: '雪フクロウ', sprite: 'owl_1', lineage: 'owl', stage: 1, lv: 7, size: 'm', race: 'bird',
      flags: ['flying'], s: { hp: 1.23, atk: 0.9, mag: 0.9, agi: 1.2 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_peck', w: 2 }],
      drops: { normal: { item: 'i_stone_wind', rate: 8 }, rare: { item: 'bd_wolf_pelt', rate: 32 }, super: { item: 'hd_sr_owl_feather', rate: 256 } },
      desc: '雪原の夜を音もなく飛ぶ。\n暗がりでもよく目が見える。',
    },
    owl_2: {
      name: 'ねむりフクロウ', sprite: 'owl_2', lineage: 'owl', stage: 2, lv: 19, size: 'm', race: 'bird',
      flags: ['flying'], s: { hp: 1.59, atk: 0.67, mag: 0.73, agi: 1.15 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_lullaby', w: 3 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_dagger_frost', rate: 32 }, super: { item: 'ac_sr_lullaby_quill', rate: 256 } },
      desc: 'ナイトキャップのフクロウ。\n子守歌で旅人を眠らせる。',
    },
    owl_3: {
      name: 'まどいフクロウ', sprite: 'owl_3', lineage: 'owl', stage: 3, lv: 31, size: 'm', race: 'bird',
      flags: ['flying'], s: { hp: 2.03, atk: 0.35, mag: 0.4, agi: 1.2 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_evil_eye', w: 2 }, { id: 'e_gust', w: 2 }],
      drops: { normal: { item: 'i_panacea', rate: 8 }, rare: { item: 'ac_blizzard_charm', rate: 32 }, super: { item: 'hd_sr_spiral_monocle', rate: 256 } },
      desc: 'うずまきの目でじっと見つめる。\n見返すと頭がくらくらする。',
    },
    owl_4: {
      name: '賢者フクロウ', sprite: 'owl_4', lineage: 'owl', stage: 4, lv: 43, size: 'm', race: 'bird', affinity: 'light',
      flags: ['flying'], s: { hp: 3.2, atk: 0.36, mag: 0.47, mdef: 1.25, agi: 1.1 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_light_ray', w: 2 }, { id: 'e_gust', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }, { id: 'e_heal_all', w: 1, cond: { hpBelow: 0.6 } }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'w_katana_moon', rate: 32 }, super: { item: 'ac_sr_owl', rate: 128 } },
      desc: '本を抱えたフクロウの学者。\n術を使いこなし仲間を守る。',
    },
    // ---- mammoth マンモス（獣・l）: 雪原の巨獣。突進と踏み鳴らし。鉄の牙、そして大王。
    mammoth_1: {
      name: '雪原マンモス', sprite: 'mammoth_1', lineage: 'mammoth', stage: 1, lv: 7, size: 'l', race: 'beast',
      flags: [], s: { hp: 0.7, atk: 2.18, mag: 1.98, def: 1.2, agi: 0.7 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_charge', w: 2 }, { id: 'e_stomp', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'ac_snow_crystal', rate: 32 }, super: { item: 'bd_sr_mammoth_fur', rate: 256 } },
      desc: '長い毛におおわれた雪原の巨獣。\n群れを守って突進してくる。',
    },
    mammoth_2: {
      name: '鉄牙マンモス', sprite: 'mammoth_2', lineage: 'mammoth', stage: 2, lv: 25, size: 'l', race: 'beast',
      flags: [], s: { hp: 1.06, atk: 1.05, mag: 0.92, def: 1.3, agi: 0.65 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_charge', w: 2 }, { id: 'e_stomp', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_greatsword_beastfang', rate: 32 }, super: { item: 'w_spear_sr_irontusk', rate: 256 } },
      desc: '牙に鉄のかぶせをはめられた\nマンモス。昔の戦の名残。',
    },
    mammoth_3: {
      name: '大王マンモス', sprite: 'mammoth_3', lineage: 'mammoth', stage: 3, lv: 43, size: 'l', race: 'beast', affinity: 'water',
      flags: [], s: { hp: 1.51, atk: 0.85, mag: 0.71, def: 1.25, agi: 0.65 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_charge', w: 2 }, { id: 'e_avalanche', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 2] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'hd_yeti_fur', rate: 32 }, super: { item: 'ft_sr_quake', rate: 128 } },
      desc: '白い毛の大王。一歩ごとに\n雪原の雪が震えて落ちる。',
    },
  });
})(window.RPG);
