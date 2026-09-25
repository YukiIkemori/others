// ルミナス・クロニクル — 雑魚の魔物: 地方7 灰の荒野（火トカゲ・悪魔・石像鬼・大鬼・三頭獣）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- salamander 火トカゲ（獣・m）: 火山の火トカゲ。火を吹き、溶岩をまとい、角を生やし、竜の王になる。
    salamander_1: {
      name: '火トカゲ', sprite: 'salamander_1', lineage: 'salamander', stage: 1, lv: 7, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { atk: 1.05, agi: 1.05 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_fire_bite', w: 2 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 }, rare: { item: 'hd_ash_mask', rate: 32 }, super: { item: 'ft_sr_salamander', rate: 256 } },
      desc: '熱い岩の上で昼寝するトカゲ。\n燃える牙でかみつく。',
    },
    salamander_2: {
      name: '火吹きトカゲ', sprite: 'salamander_2', lineage: 'salamander', stage: 2, lv: 19, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { atk: 1.05, mag: 1.1 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_fire_breath', w: 2 }, { id: 'e_fire_bite', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_axe_ember', rate: 32 }, super: { item: 'w_bow_sr_firebreath', rate: 256 } },
      desc: '口から炎を吹くトカゲ。\n草原ならすぐ火事になる。',
    },
    salamander_3: {
      name: '溶岩トカゲ', sprite: 'salamander_3', lineage: 'salamander', stage: 3, lv: 31, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.1, atk: 1.1, def: 1.15 }, eva: 5,
      elem: { fire: -1, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_lava_spit', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'bd_ash_cloak', rate: 32 }, super: { item: 'bd_sr_salamander', rate: 256 } },
      desc: '溶岩の中を泳ぐトカゲ。\n火を浴びるほど元気になる。',
    },
    salamander_4: {
      name: '炎角トカゲ', sprite: 'salamander_4', lineage: 'salamander', stage: 4, lv: 43, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.1, atk: 1.15, mag: 1.1 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_breath', w: 2 }, { id: 'e_horn', w: 2 }, { id: 'e_focus', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 }, rare: { item: 'w_katana_ash', rate: 32 }, super: { item: 'w_spear_sr_flamehorn', rate: 256 } },
      desc: '燃える角を生やした火トカゲ。\n竜の血をひくといわれる。',
    },
    salamander_5: {
      name: '炎帝トカゲ', sprite: 'salamander_5', lineage: 'salamander', stage: 5, lv: 55, size: 'm', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.3, atk: 0.61, mag: 0.59 }, eva: 5,
      elem: { fire: -1, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_inferno_breath', w: 2 }, { id: 'e_fire_bite', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 1] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_phoenix_ash', rate: 32 }, super: { item: 'bd_sr_dragonhide', rate: 128 } },
      desc: '竜になりかけた火トカゲの王。\n吐く炎は岩をも溶かす。',
    },
    // ---- imp 悪魔（魔族・s）: 灰の荒野の小悪魔。すす・火の粉・灰・業火、そして軍師。
    imp_1: {
      name: 'すす悪魔', sprite: 'imp_1', lineage: 'imp', stage: 1, lv: 7, size: 's', race: 'demon', affinity: 'fire',
      flags: [], s: { hp: 0.9, atk: 1.05, agi: 1.2 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_thrust', w: 2 }, { id: 'e_fire_bolt', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'hd_ash_mask', rate: 32 }, super: { item: 'w_spear_sr_soot_fork', rate: 256 } },
      desc: 'すすにまみれた小さな悪魔。\n三つまたのほこで突いてくる。',
    },
    imp_2: {
      name: '火の粉悪魔', sprite: 'imp_2', lineage: 'imp', stage: 2, lv: 19, size: 's', race: 'demon', affinity: 'fire',
      flags: [], s: { hp: 0.9, mag: 0.89, agi: 1.2, atk: 0.77 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_fire_bolt', w: 2 }, { id: 'e_fire_rain', w: 1 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 }, rare: { item: 'w_axe_ember', rate: 32 }, super: { item: 'ac_sr_ember_horn', rate: 256 } },
      desc: '火の粉をまき散らす赤い悪魔。\nたき火のいたずら者。',
    },
    imp_3: {
      name: '灰の悪魔', sprite: 'imp_3', lineage: 'imp', stage: 3, lv: 31, size: 's', race: 'demon', affinity: 'fire',
      flags: [], s: { hp: 0.95, mag: 0.72, agi: 1.2, atk: 0.63 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_ash_cloud', w: 2 }, { id: 'e_fire_rain', w: 2 }],
      drops: { normal: { item: 'i_panacea', rate: 8 }, rare: { item: 'bd_ash_cloak', rate: 32 }, super: { item: 'bd_sr_ash_cloak_devil', rate: 256 } },
      desc: '灰をかぶって白くなった悪魔。\n熱い灰で目をふさぐ。',
    },
    imp_4: {
      name: '業火の悪魔', sprite: 'imp_4', lineage: 'imp', stage: 4, lv: 43, size: 's', race: 'demon', affinity: 'fire',
      flags: [], s: { mag: 0.75, agi: 1.2, atk: 0.6 }, eva: 5,
      elem: { fire: 0.25, water: 1.5, light: 1.5, dark: 0.5 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_rain', w: 2 }, { id: 'e_fire_bolt', w: 2 }, { id: 'e_haste', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_katana_ash', rate: 32 }, super: { item: 'w_staff_sr_hellfire', rate: 256 } },
      desc: '炎をまとう大角の悪魔。\n火の雨で荒野を焼く。',
    },
    imp_5: {
      name: '悪魔の軍師', sprite: 'imp_5', lineage: 'imp', stage: 5, lv: 55, size: 's', race: 'demon', affinity: 'dark',
      flags: [], s: { hp: 1.1, mag: 1.3, mdef: 1.25, agi: 1.15 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_dispel', w: 1, cond: { every: [3, 1] } }, { id: 'e_haste', w: 1, cond: { once: true } }, { id: 'e_ward', w: 1, cond: { once: true } }, { id: 'e_gloom', w: 1 }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'ac_phoenix_ash', rate: 32 }, super: { item: 'hd_sr_dusk', rate: 128 } },
      desc: '悪魔たちに策を授ける軍師。\n味方を固め、守りを消す。',
    },
    // ---- gargoyle 石像鬼（魔族・m・飛ぶ）: 古い神殿や塔の屋根に止まる石の鬼。
    gargoyle_1: {
      name: '石像鬼', sprite: 'gargoyle_1', lineage: 'gargoyle', stage: 1, lv: 7, size: 'm', race: 'demon',
      flags: ['flying'], s: { hp: 1.05, def: 1.3, agi: 0.95 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5, light: 1.5, dark: 0.5 }, phys: { slash: 0.75, blunt: 1.25, pierce: 0.75 }, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 4 }, { id: 'e_claw', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'hd_ash_mask', rate: 32 }, super: { item: 'hd_sr_gargoyle_face', rate: 256 } },
      desc: '屋根の飾りのふりをした石の鬼。\n近づくと羽を広げる。',
    },
    gargoyle_2: {
      name: '黒曜の石像鬼', goldName: '金色の石像鬼', sprite: 'gargoyle_2', lineage: 'gargoyle', stage: 2, lv: 19, size: 'm', race: 'demon',
      flags: ['flying'], s: { hp: 1.05, atk: 1.1, def: 1.35 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5, light: 1.5, dark: 0.5 }, phys: { slash: 0.75, blunt: 1.25, pierce: 0.75 }, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_dive', w: 2 }, { id: 'e_claw', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_axe_ember', rate: 32 }, super: { item: 'w_dagger_sr_obsidian', rate: 256 } },
      desc: '黒曜石でできた石像鬼。\n刃のような翼で切り裂く。',
    },
    gargoyle_3: {
      name: '火炎の石像鬼', sprite: 'gargoyle_3', lineage: 'gargoyle', stage: 3, lv: 31, size: 'm', race: 'demon', affinity: 'fire',
      flags: ['flying'], s: { hp: 1.1, atk: 0.77, mag: 0.77, def: 1.3 }, eva: 12,
      elem: { fire: 0.25, water: 1.5, wind: 1.5, earth: 0.5, light: 1.5, dark: 0.5 }, phys: { slash: 0.75, blunt: 1.25, pierce: 0.75 }, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_breath', w: 2 }, { id: 'e_claw', w: 2 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 }, rare: { item: 'bd_ash_cloak', rate: 32 }, super: { item: 'sh_sr_lava_gargoyle', rate: 256 } },
      desc: '溶岩で焼き固められた石像鬼。\n体の割れ目が赤く光る。',
    },
    gargoyle_4: {
      name: '石像鬼の長', sprite: 'gargoyle_4', lineage: 'gargoyle', stage: 4, lv: 43, size: 'm', race: 'demon',
      flags: ['flying'], s: { hp: 1.25, atk: 1.15, def: 1.35 }, eva: 12,
      elem: { wind: 1.5, earth: 0.5, light: 1.5, dark: 0.5 }, phys: { slash: 0.75, blunt: 1.25, pierce: 0.75 }, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_gaze', w: 2 }, { id: 'e_dive', w: 2 }, { id: 'e_harden', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_katana_ash', rate: 32 }, super: { item: 'w_axe_sr_gargoyle', rate: 256 } },
      desc: '大角の石像鬼の長。\nにらまれると体が石になる。',
    },
    // ---- orc 大鬼（人型・l）: 荒野をのし歩く大鬼。力まかせと鉄棒。
    orc_1: {
      name: '荒野の大鬼', sprite: 'orc_1', lineage: 'orc', stage: 1, lv: 7, size: 'l', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 1.2, atk: 1.2, def: 0.95, mdef: 0.85, agi: 0.8 }, rw: { gold: 1.3 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_heavy', w: 2 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_club_ashen', rate: 32 }, super: { item: 'w_greatsword_sr_frenzy', rate: 256 } },
      desc: '荒野をうろつく大きな鬼。\n丸太を軽々と振り回す。',
    },
    orc_2: {
      name: '鉄棒の大鬼', sprite: 'orc_2', lineage: 'orc', stage: 2, lv: 25, size: 'l', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 1.25, atk: 0.92, mdef: 0.85, agi: 0.8, mag: 0.74 }, rw: { gold: 1.3 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_heavy', w: 2 }, { id: 'e_sweep', w: 2 }, { id: 'e_armor_break', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'w_greatsword_beastfang', rate: 32 }, super: { item: 'hd_sr_berserk', rate: 256 } },
      desc: 'とげのついた鉄棒の大鬼。\nなぎ払われると吹き飛ぶ。',
    },
    orc_3: {
      name: '大鬼の頭目', sprite: 'orc_3', lineage: 'orc', stage: 3, lv: 43, size: 'l', race: 'humanoid', affinity: 'fire',
      flags: [], s: { hp: 1.35, atk: 0.8, def: 1.05, agi: 0.8, mag: 0.64 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_rampage', w: 2 }, { id: 'e_focus', w: 1, cond: { once: true } }, { id: 'e_sweep', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 2] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_fist_brimstone', rate: 32 }, super: { item: 'hd_sr_oni', rate: 128 } },
      desc: '赤い肌の大鬼の頭目。\n怒ると誰にも止められない。',
    },
    // ---- chimera 三頭獣（獣・l）: シシ・ヤギ・ヘビの頭をもつ獣。火の息が強くなっていく。
    chimera_1: {
      name: 'まだら獣', sprite: 'chimera_1', lineage: 'chimera', stage: 1, lv: 7, size: 'l', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.15, atk: 1.1 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_bite', w: 2 }, { id: 'e_fire_breath', w: 1 }, { id: 'e_poison_bite', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 }, rare: { item: 'w_club_ashen', rate: 32 }, super: { item: 'hn_sr_chimera_paw', rate: 256 } },
      desc: 'シシとヤギとヘビが一つになった\n獣。三つの口で襲う。',
    },
    chimera_2: {
      name: '三頭獣', sprite: 'chimera_2', lineage: 'chimera', stage: 2, lv: 25, size: 'l', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.2, atk: 0.61, mag: 0.59 }, eva: 5,
      elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_fire_breath', w: 2 }, { id: 'e_poison_bite', w: 1 }, { id: 'e_bite', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'sh_wyvern_scale', rate: 32 }, super: { item: 'w_fist_sr_triple_fang', rate: 256 } },
      desc: '三つの頭がそれぞれに吠える。\nシシの頭は火を吐く。',
    },
    chimera_3: {
      name: '業火の三頭獣', sprite: 'chimera_3', lineage: 'chimera', stage: 3, lv: 43, size: 'l', race: 'beast', affinity: 'fire',
      flags: [], s: { hp: 1.3, atk: 0.5, mag: 0.5 }, eva: 5,
      elem: { fire: -1, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_inferno_breath', w: 2 }, { id: 'e_bite', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 0] } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_fist_brimstone', rate: 32 }, super: { item: 'bd_sr_chimera_hide', rate: 256 } },
      desc: '燃えるたてがみの三頭獣。\n吐く業火は荒野を焦がす。',
    },
  });
})(window.RPG);
