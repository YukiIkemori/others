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
      name: 'のぞき目玉', sprite: 'eyeball_1', lineage: 'eyeball', stage: 1, lv: 7, size: 's', race: 'demon',
      flags: [], s: { hp: 1.07, atk: 0.75, mag: 0.82, agi: 1.1 }, eva: 5,
      elem: { light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_gaze', w: 1 }],
      drops: { normal: { item: 'i_clear', rate: 8 }, rare: { item: 'hd_star_hood', rate: 32 }, super: { item: 'ac_sr_peeping_eye', rate: 256 } },
      desc: 'ふわふわ浮かぶ目玉。\n物かげからじっと見ている。',
    },
    eyeball_2: {
      name: 'にらみ目玉', sprite: 'eyeball_2', lineage: 'eyeball', stage: 2, lv: 19, size: 's', race: 'demon',
      flags: [], s: { hp: 1.5, atk: 0.59, mag: 0.68, agi: 1.1 }, eva: 5,
      elem: { light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_gaze', w: 3 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_bow_star', rate: 32 }, super: { item: 'hd_sr_glare_band', rate: 256 } },
      desc: '赤い目でにらみつける目玉。\nにらまれると体が動かない。',
    },
    eyeball_3: {
      name: 'まどわし目玉', sprite: 'eyeball_3', lineage: 'eyeball', stage: 3, lv: 31, size: 's', race: 'demon', affinity: 'light',
      flags: [], s: { hp: 1.41, atk: 0.32, mag: 0.38, agi: 1.1 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_evil_eye', w: 3 }],
      drops: { normal: { item: 'i_panacea', rate: 8 }, rare: { item: 'ac_astrolabe', rate: 32 }, super: { item: 'ac_sr_mind_eye', rate: 256 } },
      desc: '瞳の色がくるくる変わる目玉。\n見ていると気が遠くなる。',
    },
    eyeball_4: {
      name: '星見の目玉', sprite: 'eyeball_4', lineage: 'eyeball', stage: 4, lv: 43, size: 's', race: 'demon', affinity: 'light',
      flags: [], s: { hp: 2.25, atk: 0.36, mag: 0.45, mdef: 1.2, agi: 1.1 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_light_ray', w: 2 }, { id: 'e_flash', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_light', rate: 8 }, rare: { item: 'w_sword_starblade', rate: 32 }, super: { item: 'w_bow_sr_stargazer', rate: 256 } },
      desc: '瞳に星を映す目玉。\n夜空を見上げて光を放つ。',
    },
    eyeball_5: {
      name: '天の大目玉', sprite: 'eyeball_5', lineage: 'eyeball', stage: 5, lv: 55, size: 's', race: 'demon', affinity: 'light',
      flags: [], s: { hp: 3.22, atk: 0.23, mag: 0.3, mdef: 1.25, agi: 1.05 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_holy_beam', w: 2 }, { id: 'e_light_ray', w: 2 }, { id: 'e_gaze', w: 1 }, { id: 'e_dispel', w: 1, cond: { every: [4, 2] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_heaven_feather', rate: 32 }, super: { item: 'hd_sr_heaveneye', rate: 128 } },
      desc: '白い翼をもつ大きな目玉。\n天からすべてを見下ろす。',
    },
    // ---- darkmage 魔術師（人型・m）: 星読みの塔に集まったはぐれ術師。見習い・炎・風・闇。
    darkmage_1: {
      name: '見習い魔術師', sprite: 'darkmage_1', lineage: 'darkmage', stage: 1, lv: 7, size: 'm', race: 'humanoid',
      flags: [], s: { hp: 1.42, atk: 0.53, mag: 0.93, def: 0.85, mdef: 1.3 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_bolt', w: 2 }, { id: 'e_water_bolt', w: 2 }],
      drops: { normal: { item: 'i_ether', rate: 8 }, rare: { item: 'hd_star_hood', rate: 32 }, super: { item: 'ac_sr_scholar', rate: 256 } },
      desc: '塔で術を学ぶ見習い。\n火と水の術を覚えたばかり。',
    },
    darkmage_2: {
      name: '炎の魔術師', sprite: 'darkmage_2', lineage: 'darkmage', stage: 2, lv: 19, size: 'm', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 1.88, atk: 0.3, mag: 0.54, def: 0.85, mdef: 1.3 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_fire_bolt', w: 2 }, { id: 'e_fire_rain', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 }, rare: { item: 'w_bow_star', rate: 32 }, super: { item: 'bd_sr_flame_robe', rate: 256 } },
      desc: '赤い法衣の魔術師。\n火の雨で何でも焼きはらう。',
    },
    darkmage_3: {
      name: '風の魔術師', sprite: 'darkmage_3', lineage: 'darkmage', stage: 3, lv: 31, size: 'm', race: 'humanoid', affinity: 'wind',
      flags: [], s: { hp: 2.39, atk: 0.27, mag: 0.48, def: 0.85, mdef: 1.3, agi: 1.15 }, eva: 5,
      elem: { fire: 1.5, wind: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_wind_blade', w: 2 }, { id: 'e_gust', w: 2 }, { id: 'e_hush', w: 1 }, { id: 'e_haste', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_wind', rate: 8 }, rare: { item: 'ac_astrolabe', rate: 32 }, super: { item: 'ft_sr_wind_sandals', rate: 256 } },
      desc: '緑の法衣の魔術師。\n風の刃と沈黙の霧を使う。',
    },
    darkmage_4: {
      name: '闇の魔術師', sprite: 'darkmage_4', lineage: 'darkmage', stage: 4, lv: 43, size: 'm', race: 'humanoid', affinity: 'dark',
      flags: [], s: { hp: 2.92, atk: 0.26, mag: 0.48, def: 0.85, mdef: 1.3 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_dark_mist', w: 2 }, { id: 'e_gloom', w: 1 }, { id: 'e_mind_suck', w: 1 }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'w_sword_starblade', rate: 32 }, super: { item: 'w_staff_sr_abyss', rate: 256 } },
      desc: '禁じられた闇の術を学んだ者。\n塔の奥で人を待ち伏せる。',
    },
    // ---- automaton からくり（魔造・m）: 賢者カペラが残したからくり兵。兵・弓兵・術兵・大将。
    automaton_1: {
      name: 'からくり兵', sprite: 'automaton_1', lineage: 'automaton', stage: 1, lv: 7, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 0.95, atk: 1.22, mag: 1.22, def: 1.2, agi: 0.95 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_double', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'hd_star_hood', rate: 32 }, super: { item: 'hn_sr_gear_gauntlet', rate: 256 } },
      desc: 'ぜんまいで動く真ちゅうの兵。\n命令をいまも守り続ける。',
    },
    automaton_2: {
      name: 'からくり弓兵', sprite: 'automaton_2', lineage: 'automaton', stage: 2, lv: 19, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.4, atk: 0.8, mag: 0.8, def: 1.15 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_arrow', w: 3 }],
      drops: { normal: { item: 'i_clear', rate: 8 }, rare: { item: 'w_bow_star', rate: 32 }, super: { item: 'w_bow_sr_clockwork', rate: 256 } },
      desc: '弓を組みこまれたからくり兵。\n中列の者もねらってくる。',
    },
    automaton_3: {
      name: 'からくり術兵', sprite: 'automaton_3', lineage: 'automaton', stage: 3, lv: 31, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.43, atk: 0.59, mag: 0.73, def: 1.1, mdef: 1.2 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_light_ray', w: 2 }, { id: 'e_zap', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_ether', rate: 8 }, rare: { item: 'ac_astrolabe', rate: 32 }, super: { item: 'ac_sr_tesla_coil', rate: 256 } },
      desc: '術の回路を組みこまれた兵。\n電撃で相手をしびれさせる。',
    },
    automaton_4: {
      name: 'からくり大将', sprite: 'automaton_4', lineage: 'automaton', stage: 4, lv: 43, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.81, atk: 0.77, mag: 0.67, def: 1.25 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_double', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'e_howl', w: 1, cond: { once: true } }, { id: 'e_zap', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_sword_starblade', rate: 32 }, super: { item: 'w_katana_sr_clockwork', rate: 256 } },
      desc: '兜を飾ったからくりの大将。\n塔の兵を指揮する。',
    },
    // ---- armor 鎧（魔造・m）: 中身のない鎧。番兵、騎士、そして闇の黒金。
    armor_1: {
      name: 'からっぽの鎧', sprite: 'armor_1', lineage: 'armor', stage: 1, lv: 7, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 0.83, atk: 1.23, mag: 1.23, def: 1.35, agi: 0.8 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_slash', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'sh_star_buckler', rate: 32 }, super: { item: 'bd_sr_hollow_mail', rate: 256 } },
      desc: '中に誰もいない古い鎧。\n兜の奥で赤い光がゆれる。',
    },
    armor_2: {
      name: '番兵の鎧', sprite: 'armor_2', lineage: 'armor', stage: 2, lv: 19, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.1, atk: 1.03, mag: 1.03, def: 1.4, agi: 0.8 }, eva: 5,
      elem: { water: 1.5, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_thrust', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'hd_sentry_helm', rate: 32 }, super: { item: 'sh_sr_sentinel', rate: 256 } },
      desc: '塔の門を守る鎧の番兵。\n盾を構えて槍で突く。',
    },
    armor_3: {
      name: '騎士の鎧', sprite: 'armor_3', lineage: 'armor', stage: 3, lv: 31, size: 'm', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.45, atk: 0.74, mag: 0.67, def: 1.35 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_slash', w: 2 }, { id: 'e_double', w: 1 }, { id: 'e_focus', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'bd_knight_mail', rate: 32 }, super: { item: 'w_sword_sr_knightless', rate: 256 } },
      desc: '騎士の姿のまま動く鎧。\n主の名はとうに忘れられた。',
    },
    armor_4: {
      name: '黒金の鎧', goldName: '金色の鎧', sprite: 'armor_4', lineage: 'armor', stage: 4, lv: 43, size: 'm', race: 'construct', affinity: 'dark',
      flags: [], s: { hp: 1.75, atk: 0.72, mag: 0.6, def: 1.35 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_slash', w: 1 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_revive', rate: 8 }, rare: { item: 'hd_blackgold_helm', rate: 32 }, super: { item: 'sh_sr_steadfast', rate: 128 } },
      desc: '黒と金の重い鎧。\n闇をまとった大剣をふるう。',
    },
    // ---- wyvern 飛竜（竜・l・飛ぶ）: 高原の空を飛ぶ竜。風を起こし、嵐の息を吐く。
    wyvern_1: {
      name: '若飛竜', sprite: 'wyvern_1', lineage: 'wyvern', stage: 1, lv: 7, size: 'l', race: 'dragon', affinity: 'wind',
      flags: ['flying'], s: { hp: 1.24, atk: 0.97, mag: 0.88, agi: 1.1 }, eva: 12,
      elem: { fire: 1.5, water: 0.75, wind: 0.25, earth: 0.5, light: 0.75, dark: 0.75 }, phys: { slash: 0.75, pierce: 1.25 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_bite', w: 2 }, { id: 'e_gust', w: 2 }],
      drops: { normal: { item: 'i_stone_wind', rate: 8 }, rare: { item: 'sh_star_buckler', rate: 32 }, super: { item: 'hd_sr_wyvern_crest', rate: 256 } },
      desc: '高原の岩場に巣をつくる竜。\nまだ若いが、気は荒い。',
    },
    wyvern_2: {
      name: '風切り飛竜', sprite: 'wyvern_2', lineage: 'wyvern', stage: 2, lv: 25, size: 'l', race: 'dragon', affinity: 'wind',
      flags: ['flying'], s: { hp: 2.37, atk: 0.74, mag: 0.65, agi: 1.15 }, eva: 12,
      elem: { fire: 1.5, water: 0.75, wind: 0.25, earth: 0.5, light: 0.75, dark: 0.75 }, phys: { slash: 0.75, pierce: 1.25 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dive', w: 2 }, { id: 'e_gust', w: 2 }, { id: 'e_tail', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'sh_wyvern_scale', rate: 32 }, super: { item: 'w_spear_sr_windcutter', rate: 256 } },
      desc: '風を切る音だけを残して飛ぶ。\n急降下で獲物をさらう。',
    },
    wyvern_3: {
      name: '嵐飛竜', sprite: 'wyvern_3', lineage: 'wyvern', stage: 3, lv: 43, size: 'l', race: 'dragon', affinity: 'wind',
      flags: ['flying'], s: { hp: 2.67, atk: 0.45, mag: 0.43, agi: 1.15 }, eva: 12,
      elem: { fire: 1.5, water: 0.75, wind: 0.25, earth: 0.5, light: 0.75, dark: 0.75 }, phys: { slash: 0.75, pierce: 1.25 }, statusRes: { death: 1, sleep: 0.5, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_storm_breath', w: 2 }, { id: 'e_dive', w: 2 }, { id: 'e_tail', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'hd_blackgold_helm', rate: 32 }, super: { item: 'ac_sr_eagle', rate: 128 } },
      desc: '雷雲を連れて飛ぶ灰色の竜。\n嵐の息で空を荒らす。',
    },
  });
})(window.RPG);
