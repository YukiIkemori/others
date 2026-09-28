// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_common.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: 共通の系統（ゼリー・ネズミ・コウモリ・虚ろの使い・カニ・カモメ・宝箱）と鋼の 3 系統（白銀ゼリー・鏡カブト・白金の鬼火）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- jelly ゼリー（軟体・s）: どこにでもいる水辺のゼリー。段が上がるほど、泡・毒・兵隊・虹と姿を変える。
    jelly_1: {
      name: 'ぷちゼリー', sprite: 'jelly_1', lineage: 'jelly', stage: 1, lv: 7, size: 's', race: 'slime',
      flags: [], s: { hp: 1.69, atk: 0.91, mag: 1.01, agi: 0.8 }, eva: 5,
      elem: { fire: 1.25 }, phys: { slash: 1.25, blunt: 0.5 }, statusRes: {},
      actions: [{ id: 'attack', w: 6 }, { id: 'e_tackle', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: 'ぷるぷる震える小さなゼリー。\n道ばたで群れをつくる。',
    },
    jelly_2: {
      name: 'あわゼリー', sprite: 'jelly_2', lineage: 'jelly', stage: 2, lv: 19, size: 's', race: 'slime', affinity: 'water',
      flags: [], s: { hp: 2.29, atk: 0.82, mag: 0.9, agi: 0.9 }, eva: 5,
      elem: { fire: 1.25, water: 0.25, earth: 1.5 }, phys: { slash: 1.25, blunt: 0.5 }, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_water_bolt', w: 2 }, { id: 'e_bubbles', w: 2 }],
      drops: { normal: { item: 'i_stone_water', rate: 8 } },
      desc: '体の中で泡がはじけるゼリー。\n泡を吐いて目をくらます。',
    },
    jelly_3: {
      name: '毒ゼリー', sprite: 'jelly_3', lineage: 'jelly', stage: 3, lv: 31, size: 's', race: 'slime',
      flags: [], s: { hp: 3.24, atk: 0.53, mag: 0.53 }, eva: 5,
      elem: { fire: 1.25 }, phys: { slash: 1.25, blunt: 0.5 }, statusRes: { poison: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_poison_spit', w: 3 }, { id: 'e_split', w: 1, cond: { hpAbove: 0.5, countBelow: 6 } }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: '毒をためこんだ紫のゼリー。\n傷つくと二つに分かれる。',
    },
    jelly_4: {
      name: 'ゼリー将軍', sprite: 'jelly_4', lineage: 'jelly', stage: 4, lv: 43, size: 's', race: 'slime',
      flags: [], s: { hp: 4.31, atk: 0.5, mag: 0.46, def: 1.1 }, eva: 5,
      elem: { fire: 1.25 }, phys: { slash: 1.25, blunt: 0.5 }, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_howl', w: 2, cond: { every: [3, 0] } }, { id: 'e_crush', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: '兜をかぶった赤いゼリー。\nゼリーの群れを率いる。',
    },
    jelly_5: {
      name: '虹ゼリー', goldName: '金色ゼリー', sprite: 'jelly_5', lineage: 'jelly', stage: 5, lv: 55, size: 's', race: 'slime',
      flags: [], s: { hp: 4.25, atk: 0.31, mag: 0.37, mdef: 1.2 }, eva: 5,
      elem: { fire: 0.75, water: 0.75, wind: 0.75, earth: 0.75, light: 0.75, dark: 0.75 }, phys: { slash: 1.25, blunt: 0.5 }, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_prism_ray', w: 3 }, { id: 'e_split', w: 1, cond: { hpAbove: 0.5, countBelow: 6 } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_rainbow_drop', rate: 32 }, super: { item: 'sh_sr_phantom', rate: 128 } },
      desc: '七色に光るまぼろしのゼリー。\nどの属性もはね返しがち。',
    },
    // ---- rat ネズミ（獣・s）: 人里と坑道と船にすみつくネズミ。歯と数で押してくる。
    rat_1: {
      name: '野ネズミ', sprite: 'rat_1', lineage: 'rat', stage: 1, lv: 7, size: 's', race: 'beast',
      flags: [], s: { hp: 1.36, atk: 1.1, mag: 1.1, agi: 1.2 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 5 }, { id: 'e_bite', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: '野原を走り回る灰色のネズミ。\n食べ物のにおいに寄ってくる。',
    },
    rat_2: {
      name: '毒牙ネズミ', sprite: 'rat_2', lineage: 'rat', stage: 2, lv: 19, size: 's', race: 'beast',
      flags: [], s: { hp: 1.76, atk: 0.66, mag: 0.63, agi: 1.2 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_poison_bite', w: 3 }, { id: 'e_call', w: 1, cond: { countBelow: 6 } }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: '牙に毒をもつネズミ。\nかまれると体がしびれて痛む。',
    },
    rat_3: {
      name: '鉄歯ネズミ', sprite: 'rat_3', lineage: 'rat', stage: 3, lv: 31, size: 's', race: 'beast',
      flags: [], s: { hp: 2.94, atk: 0.59, mag: 0.53, def: 1.25 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_gnaw', w: 3 }, { id: 'e_bite', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: '鉄のように硬い歯のネズミ。\n鎧さえかじって穴をあける。',
    },
    rat_4: {
      name: 'ネズミの頭領', sprite: 'rat_4', lineage: 'rat', stage: 4, lv: 43, size: 's', race: 'beast',
      flags: [], s: { hp: 3.01, atk: 0.76, mag: 0.69 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_call_lesser', w: 2, cond: { countBelow: 6 } }, { id: 'e_double', w: 2 }, { id: 'e_howl', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'hd_rat_bandana', rate: 32 }, steal: { item: 'ac_st_rat_boss', rate: 32 } },
      desc: '片目の大ネズミ。手下を呼び\n集めては荷を奪う。',
    },
    // ---- bat コウモリ（獣・s・飛ぶ）: 暗い所ならどこにでも。血を吸い、音で惑わせ、最後は闇の貴族になる。
    bat_1: {
      name: '小コウモリ', sprite: 'bat_1', lineage: 'bat', stage: 1, lv: 7, size: 's', race: 'beast',
      flags: ['flying'], s: { hp: 1.47, atk: 0.78, mag: 0.78, agi: 1.4 }, eva: 15,
      elem: { fire: 1.25, wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 5 }, { id: 'e_bite', w: 1 }],
      drops: { normal: { item: 'i_clear', rate: 8 } },
      desc: '暗がりから飛び出す小さな\nコウモリ。すばしこい。',
    },
    bat_2: {
      name: '血吸いコウモリ', sprite: 'bat_2', lineage: 'bat', stage: 2, lv: 19, size: 's', race: 'beast',
      flags: ['flying'], s: { hp: 2.69, atk: 0.67, mag: 0.67, agi: 1.35 }, eva: 15,
      elem: { fire: 1.25, wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_drain_bite', w: 3 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: '血を吸うと体が赤く染まる。\n傷口をねらってくる。',
    },
    bat_3: {
      name: '音波コウモリ', sprite: 'bat_3', lineage: 'bat', stage: 3, lv: 31, size: 's', race: 'beast',
      flags: ['flying'], s: { hp: 2.27, atk: 0.35, mag: 0.38, agi: 1.3 }, eva: 15,
      elem: { fire: 1.25, wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_sonic', w: 3 }],
      drops: { normal: { item: 'i_clear', rate: 8 } },
      desc: '耳をつんざく音を出して、\n相手の頭を惑わせる。',
    },
    bat_4: {
      name: '闇コウモリ', sprite: 'bat_4', lineage: 'bat', stage: 4, lv: 43, size: 's', race: 'beast', affinity: 'dark',
      flags: ['flying'], s: { hp: 4.43, atk: 0.52, mag: 0.6, agi: 1.35 }, eva: 15,
      elem: { fire: 1.25, wind: 1.5, earth: 0.5, light: 1.5, dark: 0.25 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_drain_bite', w: 2 }],
      drops: { normal: { item: 'i_stone_dark', rate: 8 } },
      desc: '夜そのもののような黒い翼。\n闇の玉を吐き出す。',
    },
    bat_5: {
      name: 'コウモリ公', sprite: 'bat_5', lineage: 'bat', stage: 5, lv: 55, size: 's', race: 'beast', affinity: 'dark',
      flags: ['flying'], s: { hp: 4.74, atk: 0.29, mag: 0.35, agi: 1.25 }, eva: 12,
      elem: { fire: 1.25, wind: 1.5, earth: 0.5, light: 1.5, dark: 0.25 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_life_suck', w: 3 }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }, { id: 'e_dark_mist', w: 2 }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'ac_count_brooch', rate: 32 }, super: { item: 'w_dagger_sr_moonfang', rate: 128 } },
      desc: '夜の城に住むというコウモリの\n貴族。命を吸って生きる。',
    },
    // ---- paper 虚ろの使い（霊体・大きさは段ごと）: 伝承が忘れられた場所に生まれる、白い紙のような魔物。記憶と力を「白紙」にする。
    paper_1: {
      name: '白紙の小鬼', goldName: '金紙の小鬼', sprite: 'paper_1', lineage: 'paper', stage: 1, lv: 19, size: 's', race: 'spirit',
      flags: [], s: { hp: 2, atk: 1.15, mag: 1.26, agi: 1.1 }, eva: 5,
      elem: { fire: 1.5, light: 0.25, dark: 1.5 }, phys: { slash: 1.25, blunt: 0.75 }, statusRes: { poison: 1, death: 1, confuse: 0.5, sleep: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_forget', w: 3 }, { id: 'e_paper_cut', w: 2 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: '紙を切り抜いたような白い小鬼。\nふれた者の記憶を消す。',
    },
    paper_2: {
      name: '白紙の獣', goldName: '金紙の獣', sprite: 'paper_2', lineage: 'paper', stage: 2, lv: 31, size: 'm', race: 'spirit',
      flags: [], s: { hp: 1.94, atk: 1.27, mag: 1.2, agi: 1.1 }, eva: 5,
      elem: { fire: 1.5, light: 0.25, dark: 1.5 }, phys: { slash: 1.25, blunt: 0.75 }, statusRes: { poison: 1, death: 1, confuse: 0.5, sleep: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_bite', w: 2 }, { id: 'e_forget', w: 2 }, { id: 'e_erase_all', w: 1, cond: { every: [4, 1] } }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: '忘れられたオオカミの物語から\n生まれた白い獣。',
    },
    paper_3: {
      name: '白紙の騎士', goldName: '金紙の騎士', sprite: 'paper_3', lineage: 'paper', stage: 3, lv: 43, size: 'm', race: 'spirit',
      flags: [], s: { hp: 2.5, atk: 1.13, mag: 1.03, def: 1.2, agi: 0.85 }, eva: 5,
      elem: { fire: 1.5, light: 0.25, dark: 1.5 }, phys: { slash: 1.25, blunt: 0.75 }, statusRes: { poison: 1, death: 1, confuse: 0.5, sleep: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_slash', w: 2 }, { id: 'e_forget', w: 2 }, { id: 'e_erase_all', w: 1, cond: { every: [3, 2] } }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: '名を忘れられた騎士の影。\n白紙の剣で守りを消す。',
    },
    paper_4: {
      name: '白紙の竜', goldName: '金紙の竜', sprite: 'paper_4', lineage: 'paper', stage: 4, lv: 55, size: 'l', race: 'spirit',
      flags: ['flying'], s: { hp: 2.78, atk: 0.63, mag: 0.63 }, eva: 12,
      elem: { fire: 1.5, wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 }, phys: { slash: 1.25, blunt: 0.75 }, statusRes: { poison: 1, death: 1, confuse: 0.5, sleep: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_blank_breath', w: 3 }, { id: 'e_forget', w: 2 }, { id: 'e_tail', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_greatsword_blank', rate: 32 }, super: { item: 'w_greatsword_sr_eraser', rate: 256 } },
      desc: '古い竜の伝承の抜けがら。\n吐く息は何もかも白くする。',
    },
    // ---- crab カニ（水生・m）: 浜から洞窟まで。甲羅はだんだん城のように大きくなる。
    crab_1: {
      name: '浜ガニ', sprite: 'crab_1', lineage: 'crab', stage: 1, lv: 7, size: 'm', race: 'aquatic',
      flags: [], s: { hp: 0.97, atk: 1.79, mag: 1.79, def: 1.4, agi: 0.8 }, eva: 5,
      elem: { fire: 0.75, water: 0.5, earth: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 5 }, { id: 'e_pincer', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: '浜辺を横歩きする赤いカニ。\nはさみに気をつけて。',
    },
    crab_2: {
      name: '鉄甲ガニ', sprite: 'crab_2', lineage: 'crab', stage: 2, lv: 19, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.39, atk: 1.19, mag: 1.19, def: 1.7, mdef: 0.8, agi: 0.7 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_pincer', w: 2 }, { id: 'e_harden', w: 2, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_water', rate: 8 } },
      desc: '鉄のような甲羅のカニ。\n身を固めると刃が通らない。',
    },
    crab_3: {
      name: '泡吹きガニ', sprite: 'crab_3', lineage: 'crab', stage: 3, lv: 31, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 1.57, atk: 0.96, mag: 1.06, def: 1.4 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_bubbles', w: 2 }, { id: 'e_water_bolt', w: 2 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: '青いカニ。泡で目をくらませ、\n水の弾を撃ってくる。',
    },
    crab_4: {
      name: '城ガニ', sprite: 'crab_4', lineage: 'crab', stage: 4, lv: 43, size: 'm', race: 'aquatic', affinity: 'water',
      flags: [], s: { hp: 2.47, atk: 0.95, mag: 0.95, def: 1.6, agi: 0.6 }, eva: 5,
      elem: { fire: 0.75, water: 0.25, earth: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_pincer', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'e_crush', w: 2 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'sh_castle_shell', rate: 32 } },
      desc: '背中に小さな城を背負った\n大ガニ。まるで動く砦。',
    },
    // ---- seabird カモメ（鳥・m・飛ぶ）: 海辺と船の上を飛ぶカモメ。嵐を呼び、光り物を盗む。
    seabird_1: {
      name: '浜カモメ', sprite: 'seabird_1', lineage: 'seabird', stage: 1, lv: 7, size: 'm', race: 'bird',
      flags: ['flying'], s: { hp: 1.45, atk: 0.84, mag: 0.84, agi: 1.3 }, eva: 15,
      elem: { wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 5 }, { id: 'e_peck', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: '港の空をわがもの顔で飛ぶ。\n魚も弁当もねらってくる。',
    },
    seabird_2: {
      name: '嵐カモメ', sprite: 'seabird_2', lineage: 'seabird', stage: 2, lv: 19, size: 'm', race: 'bird', affinity: 'wind',
      flags: ['flying'], s: { hp: 2.53, atk: 0.46, mag: 0.51, agi: 1.3 }, eva: 15,
      elem: { fire: 1.5, wind: 0.25, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_gust', w: 3 }],
      drops: { normal: { item: 'i_stone_wind', rate: 8 } },
      desc: '嵐の前に群れで現れる灰色の\nカモメ。翼で突風を起こす。',
    },
    seabird_3: {
      name: 'ぬすみカモメ', sprite: 'seabird_3', lineage: 'seabird', stage: 3, lv: 31, size: 'm', race: 'bird',
      flags: ['flying'], s: { hp: 2.74, atk: 0.62, mag: 0.59, agi: 1.35 }, rw: { gold: 2 }, eva: 15,
      elem: { wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_peck_eyes', w: 2 }, { id: 'e_dive', w: 2 }],
      drops: { normal: { item: 'i_clear', rate: 8 }, steal: { item: 'ac_st_thief_gull', rate: 32 } },
      desc: '光るものに目がないカモメ。\n目をつついてすきを作る。',
    },
    seabird_4: {
      name: '長老カモメ', sprite: 'seabird_4', lineage: 'seabird', stage: 4, lv: 43, size: 'm', race: 'bird', affinity: 'wind',
      flags: ['flying'], s: { hp: 2.96, atk: 0.48, mag: 0.55, agi: 1.2 }, eva: 12,
      elem: { fire: 1.5, wind: 0.25, earth: 0.5 }, phys: { pierce: 1.25 }, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dive', w: 2 }, { id: 'e_gust', w: 2 }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'bd_gull_robe', rate: 32 } },
      desc: '白いひげのような羽の老鳥。\n海の風を思いのままに操る。',
    },
    // ---- mimic 宝箱（魔造・s）: 宝箱に化けた魔物。お金をたくさん持ち、レアを落としやすい。
    mimic_1: {
      name: '牙の宝箱', sprite: 'mimic_1', lineage: 'mimic', stage: 1, lv: 7, size: 's', race: 'construct',
      flags: [], s: { hp: 1.38, atk: 0.86, mag: 0.75, def: 1.2, agi: 0.9 }, rw: { gold: 3 }, eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_bite', w: 3 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: '宝箱のふりをした魔物。\nふたを開けると牙が並ぶ。',
    },
    mimic_2: {
      name: '毒牙の宝箱', sprite: 'mimic_2', lineage: 'mimic', stage: 2, lv: 19, size: 's', race: 'construct',
      flags: [], s: { hp: 2, atk: 0.6, mag: 0.52, def: 1.2, agi: 0.9 }, rw: { gold: 3 }, eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_poison_bite', w: 2 }, { id: 'e_bite', w: 2 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: 'ふたのすき間から毒がしたたる。\n中身はたいてい空っぽ。',
    },
    mimic_3: {
      name: '呪いの宝箱', sprite: 'mimic_3', lineage: 'mimic', stage: 3, lv: 31, size: 's', race: 'construct',
      flags: [], s: { hp: 2.22, atk: 0.48, mag: 0.4, def: 1.2, agi: 0.9 }, rw: { gold: 3 }, eva: 5,
      elem: { water: 1.25, wind: 0.75 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_curse', w: 1 }, { id: 'e_abyss_fang', w: 2 }, { id: 'e_bite', w: 1 }],
      drops: { normal: { item: 'i_revive', rate: 8 } },
      desc: '鎖を巻かれた古い宝箱。\n開けた者を奈落へ引きこむ。',
    },
    mimic_4: {
      name: '奈落の宝箱', sprite: 'mimic_4', lineage: 'mimic', stage: 4, lv: 43, size: 's', race: 'construct', affinity: 'dark',
      flags: [], s: { hp: 2.54, atk: 0.49, mag: 0.47, def: 1.25, agi: 0.9 }, rw: { gold: 3 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_abyss_fang', w: 2 }, { id: 'e_dark_mist', w: 2 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_abyss_key', rate: 16 }, steal: { item: 'ac_st_abyss_gem', rate: 32 } },
      desc: '底の見えない黒い宝箱。\n中には何があるのだろう。',
    },
    // ---- quicksilver 白銀ゼリー（軟体・s・鋼・jelly の分岐）: 水銀のようなゼリー。硬く、すぐ逃げるが、経験値とお金が多い。
    quicksilver_1: {
      name: '白銀ゼリー', sprite: 'quicksilver_1', lineage: 'quicksilver', stage: 1, lv: 19, size: 's', race: 'slime',
      flags: ['metal'], s: { agi: 2.5 }, hpFixed: 8, fleeRate: 0.5, eva: 30,
      elem: { fire: 1.25 }, phys: { slash: 1.25, blunt: 0.5 }, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_water_bolt', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 4 } },
      desc: '水銀のように光るゼリー。\n打っても打ってもびくともしない。',
    },
    quicksilver_2: {
      name: '白銀の大ゼリー', sprite: 'quicksilver_2', lineage: 'quicksilver', stage: 2, lv: 43, size: 's', race: 'slime',
      flags: ['metal'], s: { agi: 2.5 }, hpFixed: 10, fleeRate: 0.5, eva: 30,
      elem: { fire: 1.25 }, phys: { slash: 1.25, blunt: 0.5 }, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_tide', w: 1 }, { id: 'e_water_bolt', w: 1 }],
      drops: { normal: { item: 'i_ether2', rate: 4 }, rare: { item: 'ac_silver_orb', rate: 16 } },
      desc: '白銀ゼリーが集まった大玉。\n出会えたら運がいい。',
    },
    // ---- mirror 鏡カブト（虫・s・鋼・beetle の分岐）: 全身が鏡のようなカブト。光をはね返して逃げる。
    mirror_1: {
      name: '鏡カブト', sprite: 'mirror_1', lineage: 'mirror', stage: 1, lv: 37, size: 's', race: 'insect',
      flags: ['metal'], s: { agi: 2.5 }, hpFixed: 8, fleeRate: 0.5, eva: 30,
      elem: { fire: 1.5 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_flash', w: 1 }],
      drops: { normal: { item: 'i_ether2', rate: 4 } },
      desc: '鏡のような殻をもつ甲虫。\nまぶしく光ってすぐ逃げる。',
    },
    mirror_2: {
      name: '鏡の大カブト', sprite: 'mirror_2', lineage: 'mirror', stage: 2, lv: 49, size: 's', race: 'insect',
      flags: ['metal'], s: { agi: 2.5 }, hpFixed: 10, fleeRate: 0.5, eva: 30,
      elem: { fire: 1.5 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_flash', w: 1 }, { id: 'e_light_ray', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 4 }, rare: { item: 'ac_mirror_crest', rate: 16 } },
      desc: '鏡の角をもつ大きな甲虫。\n見た者は自分の顔に驚く。',
    },
    // ---- platinum 白金の鬼火（霊体・s・鋼・wisp の分岐）: 白金色に燃える灯。最終地方と裏ダンジョンにだけ現れる。
    platinum_1: {
      name: '白金の鬼火', sprite: 'platinum_1', lineage: 'platinum', stage: 1, lv: 55, size: 's', race: 'spirit',
      flags: ['metal'], s: { agi: 2.5 }, hpFixed: 10, fleeRate: 0.5, eva: 30,
      elem: { light: 1.5 }, phys: { slash: 0.5, blunt: 0.5, pierce: 0.5 }, statusRes: { poison: 1, death: 1, stun: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_light_ray', w: 2 }, { id: 'e_fire_bolt', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 4 } },
      desc: '白金色に燃える小さな灯。\n見つけたら逃がしたくない。',
    },
    platinum_2: {
      name: '白金の大鬼火', sprite: 'platinum_2', lineage: 'platinum', stage: 2, lv: 61, size: 's', race: 'spirit',
      flags: ['metal'], s: { agi: 2.5 }, hpFixed: 12, fleeRate: 0.5, eva: 30,
      elem: { light: 1.5 }, phys: { slash: 0.5, blunt: 0.5, pierce: 0.5 }, statusRes: { poison: 1, death: 1, stun: 1 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_light_ray', w: 2 }, { id: 'e_holy_beam', w: 1 }, { id: 'e_flash', w: 1 }],
      drops: { normal: { item: 'i_phoenix', rate: 4 }, rare: { item: 'ac_platinum_crown', rate: 16 } },
      desc: '冠をいただく白金の大きな灯。\n忘却の底の宝といわれる。',
    },
  });
  // @@V2-BEGIN 縦切りの調整（BATTLE、2026-09-26 P2。sim_zones の主人公 1 人の表を 5 型 × 得意で回した結果）
  // ぷちゼリーの打撃の耐性 0.5 → 0.75: 杖（打撃）しか攻め手の無い魔道士（光・水・土…の得意）が主人公 1 人の夜道で 1〜2% 全滅していた。
  // 段 2 以上（jelly_2〜）は 0.5 のまま（系統の性格は残す）。出現表 zw_prologue の lv [1,3] → [1,2] と組み合わせて 0 に（encounters.js）
  if (R.DB.monsters.jelly_1 && R.DB.monsters.jelly_1.phys) R.DB.monsters.jelly_1.phys.blunt = 0.75;
  // 縦切りのレア枠を戻す（オーナー 2026-09-27「レアがめっきり減ったねえ……。楽しみがちょっとないかも」）。
  // STATS_REWORK §10.1 の「レア枠は系統の最後の段だけ」で縦切りの 11 系統の段 1〜2 がレア 0 になっていた → 段 1〜2 の全部に
  // レアは店の T0〜T1 より強いか、店に無い品（装備は T1 の帯のレア）。率は段 1 が K.DROP の既定 32、たまに混ざる段 2 は 16（枠ごと。既定は変えない）。
  // 盗み専用は約 3 分の 1 の 7 体（率 32、items_steal.js の T2 の 7 品）。
  // 見込み（sim_loot の H7）: 縦切り 1 周でレアのドロップ 最短の道 約 3 回〜自動の通し（R1、迷い・やり直し込み）約 12 回、ふつうの 1 周で 5〜7 回。
  // 森の系統は monsters_forest.js、オオカミは monsters_snow.js
  // 2 回目（オーナー 2026-09-27「普通の敵さ、全員が装備じゃなくていいからね、装備溢れちゃうし。普通の雑魚は多くはレアっつっても消耗品でいいよ」）:
  // 22 体のうち 16 体は消耗品（縦切りの店 T0〜T1 に無い・より強い品。同じ品が別の魔物と重なってもよい）、装備は当たりの 6 体だけ
  // （段 2 の武器 5 ＋ 浜ガニの甲羅盾）。外した装備のレアは宝箱 p_rare に戻る（pools.js は魔物が落とす品だけを外す）
  // 3 回目（オーナー 2026-09-28「天の恵み・よみがえりの花・癒しの霊水が早すぎる。全回復系は基本終盤から。序盤のレアは 30% 回復くらいまで」）:
  //   全回復（霊水・命のしずく・天の恵み・よみがえりの花）と魔力の霊水（MP 60%）を、滋養の丸薬（HP・MP 30%）・癒やしの香炉（全員 35%）・清めの霊薬へ。
  //   倒れた味方は店の気つけの羽根（HP 35%）で起こす
  const DEMO_RARE = {
    jelly_1: 'i_tonic', jelly_2: 'w_bow_r1', rat_1: 'i_bomb', rat_2: 'i_panacea', seabird_1: 'i_horn', seabird_2: 'i_tonic',
    crab_1: 'sh_crab_shell', crab_2: 'w_sword_coral', bat_1: 'i_incense', bat_2: 'i_incense',
  };
  const DEMO_STEAL = { rat_1: 'ac_st_rat_pouch', crab_1: 'hd_st_beach_crab', seabird_2: 'ft_st_storm_gull' };
  for (const [id, item] of Object.entries(DEMO_RARE)) if (R.DB.monsters[id]) R.DB.monsters[id].drops = Object.assign({}, R.DB.monsters[id].drops, { rare: { item, rate: /_2$/.test(id) ? 16 : 32 } });
  for (const [id, item] of Object.entries(DEMO_STEAL)) if (R.DB.monsters[id]) R.DB.monsters[id].drops = Object.assign({}, R.DB.monsters[id].drops, { steal: { item, rate: 32 } });
  // @@V2-END
})(window.RPG);
