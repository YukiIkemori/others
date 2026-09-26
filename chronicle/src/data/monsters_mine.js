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
      name: '石くれ兵', sprite: 'golem_1', lineage: 'golem', stage: 1, lv: 7, size: 'l', race: 'construct', affinity: 'earth',
      flags: [], s: { hp: 0.83, atk: 1.81, def: 1.3, agi: 0.65, mag: 1.74 }, eva: 5,
      elem: { water: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_crush', w: 1 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_earth', rate: 8 }, rare: { item: 'sh_ore_shield', rate: 32 }, super: { item: 'sh_sr_rubble', rate: 256 } },
      desc: '坑道の石が集まってできた兵。\n動きはのろいが力は強い。',
    },
    golem_2: {
      name: '鉄鉱兵', sprite: 'golem_2', lineage: 'golem', stage: 2, lv: 25, size: 'l', race: 'construct', affinity: 'earth',
      flags: [], s: { hp: 0.93, atk: 0.96, def: 1.4, agi: 0.6, mag: 0.87 }, eva: 5,
      elem: { water: 1.5, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_crush', w: 2 }, { id: 'e_stomp', w: 2 }, { id: 'e_rock', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_fist_wormtooth', rate: 32 }, super: { item: 'w_club_sr_ironore', rate: 256 } },
      desc: '鉄鉱石の体をもつ兵。\nさびた鉄が赤く浮いている。',
    },
    golem_3: {
      name: '宝玉兵', sprite: 'golem_3', lineage: 'golem', stage: 3, lv: 43, size: 'l', race: 'construct', affinity: 'earth',
      flags: [], s: { hp: 1.79, atk: 1.01, mag: 1.05, def: 1.35, agi: 0.6 }, eva: 5,
      elem: { water: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_crush', w: 2 }, { id: 'e_gem_beam', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_gem_core', rate: 32 }, super: { item: 'w_axe_sr_titan', rate: 128 } },
      desc: '宝石をちりばめた石の兵。\n胸の宝玉から光線を撃つ。',
    },
    // ---- mole モグラ（獣・m）: 坑道を掘るモグラ。爪、火薬、そして鉱夫の親方。
    mole_1: {
      name: '穴掘りモグラ', sprite: 'mole_1', lineage: 'mole', stage: 1, lv: 7, size: 'm', race: 'beast', affinity: 'earth',
      flags: [], s: { hp: 1.28, atk: 0.94, agi: 0.9, mag: 0.92 }, eva: 5,
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_claw', w: 2 }],
      drops: { normal: { item: 'i_stone_earth', rate: 8 }, rare: { item: 'hn_mole_claw', rate: 32 }, super: { item: 'hn_sr_digger', rate: 256 } },
      desc: '坑道のあちこちに穴をあける。\n暗がりでも鼻がきく。',
    },
    mole_2: {
      name: 'かぎ爪モグラ', sprite: 'mole_2', lineage: 'mole', stage: 2, lv: 19, size: 'm', race: 'beast', affinity: 'earth',
      flags: [], s: { hp: 1.78, atk: 0.63, agi: 0.9, mag: 0.55 }, eva: 5,
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_claw', w: 2 }, { id: 'e_dust', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_axe_pick', rate: 32 }, super: { item: 'w_fist_sr_ironclaw', rate: 256 } },
      desc: '鉄の爪をはめたモグラ。\n鉱夫の帽子を失敬している。',
    },
    mole_3: {
      name: '火薬モグラ', sprite: 'mole_3', lineage: 'mole', stage: 3, lv: 31, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 2.25, atk: 0.5, agi: 0.95, mag: 0.5 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_bomb', w: 3 }, { id: 'e_claw', w: 1 }],
      drops: { normal: { item: 'i_firepot', rate: 8 }, rare: { item: 'ac_gem_eye', rate: 32 }, super: { item: 'ac_sr_blasting_cap', rate: 256 } },
      desc: '火薬玉を抱えたモグラ。\n坑道で投げるのはやめてほしい。',
    },
    mole_4: {
      name: 'モグラ大親方', sprite: 'mole_4', lineage: 'mole', stage: 4, lv: 43, size: 'm', race: 'beast', affinity: 'earth',
      flags: [], s: { hp: 2.01, atk: 0.55, def: 1.1, agi: 0.85, mag: 0.5 }, eva: 5,
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_quake', w: 2 }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }, { id: 'e_claw', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_club_forgehammer', rate: 32 }, super: { item: 'w_axe_sr_mole_boss', rate: 256 } },
      desc: '白ひげのモグラの親方。\n地響きで坑道をゆさぶる。',
    },
    // ---- beetle カブト（虫・s）: 岩山の甲虫。石・鉄・火花・金剛と殻が硬くなる。
    beetle_1: {
      name: '石カブト', sprite: 'beetle_1', lineage: 'beetle', stage: 1, lv: 7, size: 's', race: 'insect', affinity: 'earth',
      flags: [], s: { def: 1.4, agi: 0.8, hp: 1.33, atk: 0.74, mag: 0.74 }, eva: 5,
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.25 }, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_horn', w: 2 }],
      drops: { normal: { item: 'i_stone_earth', rate: 8 }, rare: { item: 'sh_ore_shield', rate: 32 }, super: { item: 'hd_sr_beetle_horn', rate: 256 } },
      desc: '石のような殻の甲虫。\n大きな角で突き上げる。',
    },
    beetle_2: {
      name: '鉄カブト', sprite: 'beetle_2', lineage: 'beetle', stage: 2, lv: 19, size: 's', race: 'insect', affinity: 'earth',
      flags: [], s: { def: 1.6, agi: 0.8, hp: 2.13, atk: 0.69, mag: 0.69 }, eva: 5,
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.25 }, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_horn', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_axe_pick', rate: 32 }, super: { item: 'sh_sr_beetle_shell', rate: 256 } },
      desc: '鉄の殻をもつ甲虫。\n鉱石を食べて殻を育てる。',
    },
    beetle_3: {
      name: '火花カブト', sprite: 'beetle_3', lineage: 'beetle', stage: 3, lv: 31, size: 's', race: 'insect', affinity: 'fire',
      flags: [], s: { mag: 0.5, def: 1.4, agi: 0.85, hp: 2.5, atk: 0.5 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: { slash: 0.75, blunt: 1.25 }, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_horn', w: 2 }, { id: 'e_fire_bolt', w: 2 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 }, rare: { item: 'ac_gem_eye', rate: 32 }, super: { item: 'w_spear_sr_sparkhorn', rate: 256 } },
      desc: '殻をこすって火花を散らす。\n坑道の火事の元になる。',
    },
    beetle_4: {
      name: '金剛カブト', goldName: '黄金カブト', sprite: 'beetle_4', lineage: 'beetle', stage: 4, lv: 43, size: 's', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 2.5, def: 1.8, agi: 0.8, atk: 0.65, mag: 0.65 }, eva: 5,
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.25 }, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_horn', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'e_charge', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_club_forgehammer', rate: 32 }, super: { item: 'bd_sr_diamond_shell', rate: 256 } },
      desc: '金剛石のように光る甲虫。\nどんな刃もはね返す。',
    },
    // ---- crystal 水晶（魔造・s）: 坑道の奥で生まれる、浮かぶ水晶。色で属性が変わる。
    crystal_1: {
      name: '水晶くず', sprite: 'crystal_1', lineage: 'crystal', stage: 1, lv: 7, size: 's', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 1.25, mag: 0.63, def: 1.2, atk: 0.54 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_light_ray', w: 2 }],
      drops: { normal: { item: 'i_stone_light', rate: 8 }, rare: { item: 'sh_ore_shield', rate: 32 }, super: { item: 'ac_sr_quartz_shard', rate: 256 } },
      desc: '坑道の奥に浮かぶ透明な水晶。\n光を集めて撃ってくる。',
    },
    crystal_2: {
      name: '紅水晶', goldName: '金色水晶', sprite: 'crystal_2', lineage: 'crystal', stage: 2, lv: 19, size: 's', race: 'construct', affinity: 'fire',
      flags: [], s: { hp: 2.23, mag: 0.5, def: 1.2, atk: 0.5 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, wind: 0.75 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_bolt', w: 3 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 }, rare: { item: 'ac_ruby_chip', rate: 32 }, super: { item: 'w_staff_sr_ruby', rate: 256 } },
      desc: '炎を閉じこめた赤い水晶。\n中で火がゆれている。',
    },
    crystal_3: {
      name: '青水晶', goldName: '金の青晶', sprite: 'crystal_3', lineage: 'crystal', stage: 3, lv: 31, size: 's', race: 'construct', affinity: 'water',
      flags: [], s: { hp: 2.11, mag: 0.5, def: 1.2, atk: 0.5 }, eva: 5,
      elem: { water: 0.25, wind: 0.75, earth: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_water_bolt', w: 2 }, { id: 'e_frost', w: 1 }],
      drops: { normal: { item: 'i_stone_water', rate: 8 }, rare: { item: 'ac_sapphire_chip', rate: 32 }, super: { item: 'hd_sr_sapphire', rate: 256 } },
      desc: '冷たい水を閉じこめた水晶。\nさわると指が凍える。',
    },
    crystal_4: {
      name: '紫水晶', goldName: '金の紫晶', sprite: 'crystal_4', lineage: 'crystal', stage: 4, lv: 43, size: 's', race: 'construct', affinity: 'dark',
      flags: [], s: { mag: 0.72, def: 1.2, mdef: 1.2, hp: 2.5, atk: 0.55 }, eva: 5,
      elem: { water: 1.25, wind: 0.75, light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_mind_suck', w: 2 }, { id: 'e_ward', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_dark', rate: 8 }, rare: { item: 'ac_gem_core', rate: 32 }, super: { item: 'ac_sr_amethyst', rate: 256 } },
      desc: '闇を吸いこんだ紫の水晶。\n近くの者のMPを奪う。',
    },
    // ---- goblin 小鬼（人型・m）: 山の坑道にすむ小鬼の一族。斧兵、火薬師、隊長、王。
    goblin_1: {
      name: '小鬼', sprite: 'goblin_1', lineage: 'goblin', stage: 1, lv: 7, size: 'm', race: 'humanoid',
      flags: [], s: { atk: 1.09, hp: 1.36 }, rw: { gold: 1.3 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_heavy', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'hn_mole_claw', rate: 32 }, super: { item: 'w_club_sr_goblin', rate: 256 } },
      desc: '光り物が大好きな緑の小鬼。\n棍棒を振り回して襲う。',
    },
    goblin_2: {
      name: '小鬼の斧兵', sprite: 'goblin_2', lineage: 'goblin', stage: 2, lv: 19, size: 'm', race: 'humanoid',
      flags: [], s: { hp: 1.8, atk: 0.71, mag: 0.63 }, rw: { gold: 1.3 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_heavy', w: 2 }, { id: 'e_double', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_axe_pick', rate: 32 }, super: { item: 'w_axe_sr_goblin', rate: 256 } },
      desc: '手斧をもった小鬼の兵。\n数で押してくる。',
    },
    goblin_3: {
      name: '小鬼の火薬師', sprite: 'goblin_3', lineage: 'goblin', stage: 3, lv: 31, size: 'm', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 2.35, atk: 0.5, agi: 1.05, mag: 0.5 }, rw: { gold: 1.3 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_bomb', w: 3 }],
      drops: { normal: { item: 'i_firepot', rate: 8 }, rare: { item: 'ac_gem_eye', rate: 32 }, super: { item: 'ac_sr_powder_pouch', rate: 256 } },
      desc: 'ゴーグルをかけた小鬼。\n火薬玉を投げるのが得意。',
    },
    goblin_4: {
      name: '小鬼の隊長', sprite: 'goblin_4', lineage: 'goblin', stage: 4, lv: 43, size: 'm', race: 'humanoid',
      flags: [], s: { hp: 2.5, atk: 0.63, def: 1.1, mag: 0.55 }, rw: { gold: 1.3 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_howl', w: 2, cond: { once: true } }, { id: 'e_double', w: 1 }, { id: 'e_slash', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_club_forgehammer', rate: 32 }, super: { item: 'w_sword_sr_goblincaptain', rate: 256 } },
      desc: '角兜の小鬼の隊長。\n手下を奮い立たせて戦う。',
    },
    goblin_5: {
      name: '小鬼の王', sprite: 'goblin_5', lineage: 'goblin', stage: 5, lv: 55, size: 'm', race: 'humanoid',
      flags: [], s: { hp: 1.94, atk: 0.7, def: 1.1, mag: 0.59 }, rw: { gold: 2 }, eva: 5,
      elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_call_lesser', w: 2, cond: { countBelow: 5 } }, { id: 'e_howl', w: 1, cond: { once: true } }, { id: 'e_heavy', w: 2 }, { id: 'e_bomb', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_goblin_hoard', rate: 32 }, super: { item: 'w_sword_sr_hegemon', rate: 128 } },
      desc: '山の小鬼すべての王。\n宝の山の上にふんぞり返る。',
    },
  });
})(window.RPG);
