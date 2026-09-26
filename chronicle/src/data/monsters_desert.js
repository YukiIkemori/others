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
      name: '赤サソリ', goldName: '金色サソリ', sprite: 'scorpion_1', lineage: 'scorpion', stage: 1, lv: 7, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { def: 1.2, atk: 1.23, mag: 1.23, hp: 1.1 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_pincer', w: 2 }, { id: 'e_poison_sting', w: 1 }],
      drops: { normal: { item: 'i_antidote', rate: 8 }, rare: { item: 'w_dagger_scorpion', rate: 32 }, super: { item: 'w_dagger_sr_redtail', rate: 256 } },
      desc: '砂の中から現れる赤いサソリ。\nはさみと毒の尾で襲う。',
    },
    scorpion_2: {
      name: '毒尾サソリ', sprite: 'scorpion_2', lineage: 'scorpion', stage: 2, lv: 19, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { atk: 0.94, def: 1.2, hp: 1.18, mag: 0.9 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_poison_sting', w: 3 }],
      drops: { normal: { item: 'i_antidote', rate: 8 }, rare: { item: 'w_whip_snakeskin', rate: 32 }, super: { item: 'w_fist_sr_scorpion', rate: 256 } },
      desc: '尾の先が緑に光るサソリ。\n猛毒で知られる。',
    },
    scorpion_3: {
      name: '鋼殻サソリ', sprite: 'scorpion_3', lineage: 'scorpion', stage: 3, lv: 31, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.39, def: 1.5, agi: 0.85, atk: 0.81, mag: 0.81 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_pincer', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }, { id: 'e_numb_sting', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'sh_scorpion_shell', rate: 32 }, super: { item: 'bd_sr_steel_carapace', rate: 256 } },
      desc: '鋼のような殻をもつサソリ。\n剣がはね返されるほど硬い。',
    },
    scorpion_4: {
      name: '死神サソリ', sprite: 'scorpion_4', lineage: 'scorpion', stage: 4, lv: 43, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.41, atk: 0.82, def: 1.2, mag: 0.72 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_death_sting', w: 2 }, { id: 'e_poison_sting', w: 2 }, { id: 'e_double', w: 1 }],
      drops: { normal: { item: 'i_revive', rate: 8 }, rare: { item: 'w_katana_sand', rate: 32 }, super: { item: 'w_whip_sr_reaper', rate: 256 } },
      desc: '背にどくろの模様があるサソリ。\n一刺しで命を奪うこともある。',
    },
    scorpion_5: {
      name: '皇帝サソリ', sprite: 'scorpion_5', lineage: 'scorpion', stage: 5, lv: 55, size: 'm', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.85, atk: 0.69, def: 1.4, agi: 0.9, mag: 0.63 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_death_sting', w: 1 }, { id: 'e_pincer', w: 2 }, { id: 'e_quake', w: 1 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_royal_ankh', rate: 32 }, super: { item: 'hn_sr_hundred', rate: 128 } },
      desc: '黄金の殻をまとう砂漠の皇帝。\n砂を揺らして獲物を追いこむ。',
    },
    // ---- snake ヘビ（獣・m）: 砂漠の蛇。毒、鈴の音のおどし、にらみ、丸のみの大蛇へ。
    snake_1: {
      name: '砂ヘビ', sprite: 'snake_1', lineage: 'snake', stage: 1, lv: 7, size: 'm', race: 'beast',
      flags: [], s: { atk: 1.29, agi: 1.05, mag: 1.23, hp: 1.1 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_poison_bite', w: 2 }],
      drops: { normal: { item: 'i_antidote', rate: 8 }, rare: { item: 'w_dagger_scorpion', rate: 32 }, super: { item: 'ft_sr_sandsnake', rate: 256 } },
      desc: '砂と同じ色のヘビ。\n足もとに気をつけて。',
    },
    snake_2: {
      name: '鈴尾ヘビ', sprite: 'snake_2', lineage: 'snake', stage: 2, lv: 19, size: 'm', race: 'beast',
      flags: [], s: { atk: 0.94, agi: 1.1, hp: 1.18, mag: 0.9 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_scare', w: 2 }, { id: 'e_poison_bite', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_whip_snakeskin', rate: 32 }, super: { item: 'ac_sr_rattle_charm', rate: 256 } },
      desc: 'しっぽを鈴のように鳴らして\nおどかしてくる。',
    },
    snake_3: {
      name: 'にらみヘビ', sprite: 'snake_3', lineage: 'snake', stage: 3, lv: 31, size: 'm', race: 'beast',
      flags: [], s: { hp: 1.32, mag: 0.89, agi: 1.05, atk: 0.81 }, eva: 5,
      elem: { fire: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_gaze', w: 2 }, { id: 'e_bind', w: 2 }],
      drops: { normal: { item: 'i_panacea', rate: 8 }, rare: { item: 'sh_scorpion_shell', rate: 32 }, super: { item: 'hd_sr_gaze_circlet', rate: 256 } },
      desc: '赤い目でにらまれると、\n体が石のように固まる。',
    },
    snake_4: {
      name: '砂の大蛇', sprite: 'snake_4', lineage: 'snake', stage: 4, lv: 43, size: 'm', race: 'beast', affinity: 'earth',
      flags: [], s: { hp: 1.86, atk: 0.77, agi: 0.95, mag: 0.67 }, eva: 5,
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_bind', w: 2 }, { id: 'e_poison_bite', w: 2 }, { id: 'e_swallow', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_katana_sand', rate: 32 }, super: { item: 'w_whip_sr_python', rate: 256 } },
      desc: '人ひとりのみこむ砂漠の主。\n角のようなうろこが目じるし。',
    },
    // ---- mummy ミイラ（不死・m）: 王墓を守る死者たち。兵、呪い、神官、将軍、そして王家の者。
    mummy_1: {
      name: 'ミイラ兵', sprite: 'mummy_1', lineage: 'mummy', stage: 1, lv: 7, size: 'm', race: 'undead',
      flags: [], s: { hp: 1.26, agi: 0.8, atk: 1.23, mag: 1.23 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_bandage', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'bd_wrap_cloth', rate: 32 }, super: { item: 'hn_sr_tomb_wrap', rate: 256 } },
      desc: '包帯を巻かれた王墓の兵。\n包帯をのばして縛りつける。',
    },
    mummy_2: {
      name: '呪いミイラ', sprite: 'mummy_2', lineage: 'mummy', stage: 2, lv: 19, size: 'm', race: 'undead',
      flags: [], s: { hp: 1.3, mag: 0.98, agi: 0.8, atk: 0.9 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_curse', w: 2 }, { id: 'e_bandage', w: 2 }],
      drops: { normal: { item: 'i_panacea', rate: 8 }, rare: { item: 'hn_curse_wrap', rate: 32 }, super: { item: 'hd_sr_cursed_wrap', rate: 256 } },
      desc: '呪いの言葉を刻んだ包帯。\n声を聞くと術が使えなくなる。',
    },
    mummy_3: {
      name: 'ミイラ神官', sprite: 'mummy_3', lineage: 'mummy', stage: 3, lv: 31, size: 'm', race: 'undead',
      flags: [], s: { atk: 0.64, mag: 1.05, mdef: 1.3, hp: 1.26 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_revive_ally', w: 1, cond: { allyDown: true } }, { id: 'e_heal_ally', w: 1, cond: { hpBelow: 0.6 } }, { id: 'e_curse', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 }, rare: { item: 'w_staff_tombpriest', rate: 32 }, super: { item: 'w_staff_sr_ankh', rate: 256 } },
      desc: '王墓の祭りを続ける死者の神官。\n倒れた仲間を起こす。',
    },
    mummy_4: {
      name: 'ミイラ将軍', sprite: 'mummy_4', lineage: 'mummy', stage: 4, lv: 43, size: 'm', race: 'undead',
      flags: [], s: { hp: 1.68, atk: 0.86, def: 1.15, agi: 0.85, mag: 0.72 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_slash', w: 2 }, { id: 'e_howl', w: 1 }, { id: 'e_bandage', w: 1 }],
      drops: { normal: { item: 'i_revive', rate: 8 }, rare: { item: 'ac_scarab', rate: 32 }, super: { item: 'w_sword_sr_tombgeneral', rate: 256 } },
      desc: '千年前の王の軍を率いた将軍。\n今も墓の兵に号令をかける。',
    },
    mummy_5: {
      name: '王家のミイラ', sprite: 'mummy_5', lineage: 'mummy', stage: 5, lv: 55, size: 'm', race: 'undead',
      flags: [], s: { hp: 1.85, mag: 0.78, mdef: 1.2, agi: 0.85, atk: 0.63 }, eva: 5,
      elem: { fire: 1.5, light: 2, dark: -1 }, phys: { blunt: 1.25 }, statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_death_word', w: 1 }, { id: 'e_dark_mist', w: 2 }, { id: 'e_revive_ally', w: 1, cond: { allyDown: true } }, { id: 'e_curse', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_royal_ankh', rate: 32 }, super: { item: 'bd_sr_shadow', rate: 128 } },
      desc: '王家の血をひく古いミイラ。\n死の言葉で生者を招く。',
    },
    // ---- cactus サボテン（植物・m）: 砂漠をうろつくサボテン。針を飛ばし、花を咲かせ、大将になる。
    cactus_1: {
      name: 'サボテン小僧', sprite: 'cactus_1', lineage: 'cactus', stage: 1, lv: 7, size: 'm', race: 'plant',
      flags: [], s: { hp: 1.21, def: 1.1, agi: 0.85, atk: 0.99, mag: 0.99 }, eva: 5,
      elem: { fire: 1.25, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_needles', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'bd_wrap_cloth', rate: 32 }, super: { item: 'sh_sr_cactus', rate: 256 } },
      desc: 'とことこ歩くサボテンの子。\n抱きつくと痛い目にあう。',
    },
    cactus_2: {
      name: '針サボテン', sprite: 'cactus_2', lineage: 'cactus', stage: 2, lv: 19, size: 'm', race: 'plant',
      flags: [], s: { hp: 1.3, atk: 0.94, def: 1.1, agi: 0.85, mag: 0.9 }, eva: 5,
      elem: { fire: 1.25, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_needles', w: 4 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'hn_curse_wrap', rate: 32 }, super: { item: 'w_bow_sr_needlecactus', rate: 256 } },
      desc: '全身の針を雨のように飛ばす。\n遠くにいても安心できない。',
    },
    cactus_3: {
      name: '花咲きサボテン', sprite: 'cactus_3', lineage: 'cactus', stage: 3, lv: 31, size: 'm', race: 'plant',
      flags: [], s: { hp: 1.45, mag: 0.89, agi: 0.85, atk: 0.81 }, eva: 5,
      elem: { fire: 1.25, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_sleep_pollen', w: 2 }, { id: 'e_needles', w: 2 }, { id: 'e_heal_self', w: 1, cond: { hpBelow: 0.5 } }],
      drops: { normal: { item: 'i_ether', rate: 8 }, rare: { item: 'sh_scorpion_shell', rate: 32 }, super: { item: 'ac_sr_desert_rose', rate: 256 } },
      desc: '真っ赤な花を咲かせたサボテン。\n甘い香りで眠りを誘う。',
    },
    cactus_4: {
      name: 'サボテン大将', sprite: 'cactus_4', lineage: 'cactus', stage: 4, lv: 43, size: 'm', race: 'plant', affinity: 'earth',
      flags: [], s: { hp: 1.79, atk: 0.77, def: 1.2, agi: 0.85, mag: 0.67 }, eva: 5,
      elem: { fire: 1.25, water: 0.5, wind: 1.5, earth: 0.25 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_needles', w: 3 }, { id: 'e_focus', w: 1, cond: { once: true } }, { id: 'e_heavy', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_katana_sand', rate: 32 }, super: { item: 'w_club_sr_cactus_king', rate: 256 } },
      desc: 'ひげのような針が自慢の大将。\n砂漠のサボテンを束ねる。',
    },
    // ---- sandworm ミミズ（虫・l）: 砂の下を泳ぐ巨大なミミズ。砂ぼこり、岩の体、大地の揺れ。
    sandworm_1: {
      name: '砂ミミズ', sprite: 'sandworm_1', lineage: 'sandworm', stage: 1, lv: 7, size: 'l', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.32, atk: 1.03, agi: 0.7, mag: 0.99 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_swallow', w: 1 }, { id: 'e_dust', w: 2 }],
      drops: { normal: { item: 'i_stone_earth', rate: 8 }, rare: { item: 'w_dagger_scorpion', rate: 32 }, super: { item: 'bd_sr_sandworm_hide', rate: 256 } },
      desc: '砂の下からいきなり現れる。\n大きな口で何でものみこむ。',
    },
    sandworm_2: {
      name: '岩ミミズ', sprite: 'sandworm_2', lineage: 'sandworm', stage: 2, lv: 25, size: 'l', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.53, def: 1.3, agi: 0.65, atk: 0.64, mag: 0.64 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_crush', w: 2 }, { id: 'e_quake', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_fist_wormtooth', rate: 32 }, super: { item: 'w_greatsword_sr_rockworm', rate: 256 } },
      desc: '岩をまとったミミズ。\n地面を揺らして獲物を倒す。',
    },
    sandworm_3: {
      name: '大地ミミズ', sprite: 'sandworm_3', lineage: 'sandworm', stage: 3, lv: 43, size: 'l', race: 'insect', affinity: 'earth',
      flags: [], s: { hp: 1.86, atk: 0.41, def: 1.2, agi: 0.65, mag: 0.36 }, eva: 5,
      elem: { wind: 1.5, earth: 0.25 }, phys: {}, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_swallow', w: 2 }, { id: 'e_quake', w: 2 }, { id: 'e_dust', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_axe_dune', rate: 32 }, super: { item: 'w_greatsword_sr_duneworm', rate: 256 } },
      desc: '大陸の地下をめぐるという主。\n動くたびに大地が鳴る。',
    },
  });
})(window.RPG);
