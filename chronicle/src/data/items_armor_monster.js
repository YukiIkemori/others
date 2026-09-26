// items_armor_monster.js — gear-a (A10a). Monster armor: 42 rares, 65 supers, 1 fixed-tier super.
// Numbers (def mdef eva stats price) are filled by R.Rules.fillItem in R.onData (DESIGN §8.2.9); the data
// only carries tier / grade / units / weight. Spec: DESIGN §8 (definitions) and §9.12 (monster → item).
(function (R) {
  'use strict';
  // Monster-chapter armor (DESIGN §9.12). Rare = the monster rare slot (§9.12.5, src 'mdrop', tier = band(srTier)),
  // super = the one-of-a-kind super-rare slot of exactly one monster (§9.12.4, tier = srTier), plus the fixed-tier
  // super of the rare monster 記憶の金魚 (§8.7.2). units follow §8.6.2 (race of the first monster → main / sub stat,
  // else the weight's first stat); stat quirks are −1 unit U(T) (§9.12.2); desc uses the §8.2.7 sentence forms.
  const ITEMS = {
    // ---------------------------------------------------------------- monster rares (42)
    // crab_1 · def+4
    sh_crab_shell: { name: 'カニの甲羅盾', type: 'shield', weight: 'heavy', grade: 'rare', tier: 1, units: 'v1', src: 'mdrop', quirk: true,
      mods: { def: 4, /* クセ */ spd: -15 },
      desc: '守備力が上がる。ただし動きが遅くなる。' },
    // golem_1 beetle_1 crystal_1 · sres:stun30
    sh_ore_shield: { name: '鉱石の盾', type: 'shield', weight: 'heavy', grade: 'rare', tier: 1, units: 'v1', src: 'mdrop', quirk: true,
      mods: { statusResist: { stun: 0.3 }, /* クセ */ eva: -10 },
      desc: '気絶にかかりにくい。ただしかわしにくい。' },
    // armor_1 wyvern_1 · mdef+4
    sh_star_buckler: { name: '星の小盾', type: 'shield', weight: 'light', grade: 'rare', tier: 1, units: 'd1', src: 'mdrop', quirk: true,
      mods: { mdef: 4, /* クセ */ defPct: -25 },
      desc: '術防が上がる。ただし守備力が下がる。' },
    // mushroom_1 treant_1 · sres:sleep30
    hd_mushroom_cap: { name: 'キノコの帽子', type: 'head', weight: 'cloth', grade: 'rare', tier: 1, units: 'm1', src: 'mdrop', quirk: true,
      mods: { statusResist: { sleep: 0.3 }, /* クセ */ elemResist: { fire: 1.25 } },
      desc: '眠りにかかりにくい。ただし火に弱くなる。' },
    // ghost_1 wisp_1 doll_1 · sres:confuse30
    hd_mist_hood: { name: '霧の頭巾', type: 'head', weight: 'cloth', grade: 'rare', tier: 1, units: 'm1', src: 'mdrop', quirk: true,
      mods: { statusResist: { confuse: 0.3 }, /* クセ */ defPct: -25 },
      desc: '混乱にかかりにくい。\nただし守備力が下がる。' },
    // salamander_1 imp_1 gargoyle_1 · sres:blind30
    hd_ash_mask: { name: '灰よけの面', type: 'head', weight: 'light', grade: 'rare', tier: 1, units: 'a1', src: 'mdrop', quirk: true,
      mods: { statusResist: { blind: 0.3 }, /* クセ */ mdefPct: -25 },
      desc: '暗闇にかかりにくい。ただし術防が下がる。' },
    // eyeball_1 darkmage_1 automaton_1 · glim:spell10
    hd_star_hood: { name: '星見の頭巾', type: 'head', weight: 'cloth', grade: 'rare', tier: 1, units: 'i1', src: 'mdrop', quirk: true,
      mods: { glimPct: { spell: 10 }, /* クセ */ defPct: -25 },
      desc: '術を閃きやすい。ただし守備力が下がる。' },
    // mummy_1 cactus_1 · sres:blind30
    bd_wrap_cloth: { name: '砂よけの布', type: 'body', weight: 'cloth', grade: 'rare', tier: 1, units: 'i2', src: 'mdrop', quirk: true,
      mods: { statusResist: { blind: 0.3 }, /* クセ */ elemResist: { fire: 1.25 } },
      desc: '暗闇にかかりにくい。ただし火に弱くなる。' },
    // wolf_1 yeti_1 owl_1 · res:water0.75
    bd_wolf_pelt: { name: 'オオカミの毛皮', type: 'body', weight: 'light', grade: 'rare', tier: 1, units: 'a2', src: 'mdrop', quirk: true,
      mods: { elemResist: { water: 0.75, /* クセ */ fire: 1.25 } },
      desc: '水のダメージを少し減らす。\nただし火に弱くなる。' },
    // frog_1 lizardman_1 spider_1 · sres:poison30
    bd_marsh_coat: { name: '沼の雨よけ', type: 'body', weight: 'light', grade: 'rare', tier: 1, units: 'd2', src: 'mdrop', quirk: true,
      mods: { statusResist: { poison: 0.3 }, /* クセ */ mdefPct: -25 },
      desc: '毒にかかりにくい。ただし術防が下がる。' },
    // mole_1 goblin_1 · crit+5
    hn_mole_claw: { name: 'モグラの爪', type: 'hands', weight: 'light', grade: 'rare', tier: 1, units: 'a1', src: 'mdrop', quirk: true,
      mods: { crit: 5, /* クセ */ hit: -10 },
      desc: '会心が出やすい。ただし当たりにくい。' },
    // rat_1 · eva+4
    ft_rat_sandal: { name: 'ネズミ革のサンダル', type: 'feet', weight: 'light', grade: 'rare', tier: 1, units: 'a1', src: 'mdrop', quirk: true,
      mods: { eva: 4, /* クセ */ hpPct: -10 },
      desc: '攻撃をかわしやすい。\nただし最大HPが下がる。' },
    // jelly_2 · res:water0.5
    sh_bubble: { name: '泡の盾', type: 'shield', weight: 'cloth', grade: 'rare', tier: 3, units: 'm1', src: 'mdrop', quirk: true,
      mods: { elemResist: { water: 0.5, /* クセ */ wind: 1.25 } },
      desc: '水のダメージを減らす。\nただし風に弱くなる。' },
    // merman_2 skeleton_2 · res:water0.5
    sh_tide_shield: { name: '潮の盾', type: 'shield', weight: 'light', grade: 'rare', tier: 3, units: 'd1', src: 'mdrop', quirk: true,
      mods: { elemResist: { water: 0.5, /* クセ */ fire: 1.25 } },
      desc: '水のダメージを減らす。\nただし火に弱くなる。' },
    // armor_2 · sres:stun30
    hd_sentry_helm: { name: '番兵の兜', type: 'head', weight: 'heavy', grade: 'rare', tier: 3, units: 'v1', src: 'mdrop', quirk: true,
      mods: { statusResist: { stun: 0.3 }, /* クセ */ spd: -15 },
      desc: '気絶にかかりにくい。\nただし動きが遅くなる。' },
    // crab_2 · res:water0.5
    bd_crab_plate: { name: '甲羅の胸当て', type: 'body', weight: 'heavy', grade: 'rare', tier: 3, units: 'v2', src: 'mdrop', quirk: true,
      mods: { elemResist: { water: 0.5, /* クセ */ fire: 1.25 } },
      desc: '水のダメージを減らす。\nただし火に弱くなる。' },
    // rat_2 · stealPct+25
    hn_rat_claw: { name: 'ネズミのかぎ爪', type: 'hands', weight: 'light', grade: 'rare', tier: 3, units: 'a1', src: 'mdrop', quirk: true,
      mods: { stealPct: 25, /* クセ */ defPct: -25 },
      desc: '盗みが成功しやすい。\nただし守備力が下がる。' },
    // mummy_2 cactus_2 · glim:dark15
    hn_curse_wrap: { name: '呪い布の手甲', type: 'hands', weight: 'cloth', grade: 'rare', tier: 3, units: 'i1', src: 'mdrop', quirk: true,
      mods: { glimPct: { dark: 15 }, /* クセ */ elemResist: { light: 1.25 } },
      desc: '闇の術を閃きやすい。ただし光に弱くなる。' },
    // scorpion_3 snake_3 cactus_3 · sres:poison40
    sh_scorpion_shell: { name: 'サソリの甲羅盾', type: 'shield', weight: 'heavy', grade: 'rare', tier: 5, units: 's1', src: 'mdrop', quirk: true,
      mods: { statusResist: { poison: 0.4 }, /* クセ */ elemResist: { water: 1.25 } },
      desc: '毒にかかりにくい。ただし水に弱くなる。' },
    // ghost_3 wisp_3 doll_3 · sres:sleep40
    sh_bell_shield: { name: '鐘の盾', type: 'shield', weight: 'heavy', grade: 'rare', tier: 5, units: 's1', src: 'mdrop', quirk: true,
      mods: { statusResist: { sleep: 0.4, /* クセ */ confuse: -0.25 } },
      desc: '眠りにかかりにくい。ただし混乱に弱い。' },
    // chimera_2 wyvern_2 · res:wind0.5
    sh_wyvern_scale: { name: '飛竜のうろこ盾', type: 'shield', weight: 'heavy', grade: 'rare', tier: 5, units: 's1', src: 'mdrop', quirk: true,
      mods: { elemResist: { wind: 0.5, /* クセ */ earth: 1.25 } },
      desc: '風のダメージを減らす。\nただし土に弱くなる。' },
    // bat_3 · sres:confuse40
    hd_sonic_band: { name: '音波の鉢巻き', type: 'head', weight: 'light', grade: 'rare', tier: 5, units: 'a1', src: 'mdrop', quirk: true,
      mods: { statusResist: { confuse: 0.4, /* クセ */ silence: -0.25 } },
      desc: '混乱にかかりにくい。ただし沈黙に弱い。' },
    // crab_3 · res:water0.5
    hd_foam_cap: { name: '泡の帽子', type: 'head', weight: 'cloth', grade: 'rare', tier: 5, units: 'm1', src: 'mdrop', quirk: true,
      mods: { elemResist: { water: 0.5, /* クセ */ wind: 1.25 } },
      desc: '水のダメージを減らす。\nただし風に弱くなる。' },
    // seabird_3 · stealPct+30
    hd_thief_bandana: { name: '盗人のバンダナ', type: 'head', weight: 'light', grade: 'rare', tier: 5, units: 'a1', src: 'mdrop', quirk: true,
      mods: { stealPct: 30, /* クセ */ mdefPct: -25 },
      desc: '盗みが成功しやすい。ただし術防が下がる。' },
    // paper_2 · sres:silence40
    bd_blank_coat: { name: '白紙のマント', type: 'body', weight: 'cloth', grade: 'rare', tier: 5, units: 'm2', src: 'mdrop', quirk: true,
      mods: { statusResist: { silence: 0.4 }, /* クセ */ defPct: -25 },
      desc: '沈黙にかかりにくい。\nただし守備力が下がる。' },
    // bee_3 plant_3 treant_3 · res:earth0.5
    bd_leaf_mail: { name: '葉の鎧', type: 'body', weight: 'light', grade: 'rare', tier: 5, units: 'd2', src: 'mdrop', quirk: true,
      mods: { elemResist: { earth: 0.5, /* クセ */ wind: 1.25 } },
      desc: '土のダメージを減らす。\nただし風に弱くなる。' },
    // frog_3 lizardman_3 spider_3 · sres:paralyze40
    bd_bog_mail: { name: '沼の鎖編み鎧', type: 'body', weight: 'heavy', grade: 'rare', tier: 5, units: 'v2', src: 'mdrop', quirk: true,
      mods: { statusResist: { paralyze: 0.4 }, /* クセ */ spd: -15 },
      desc: 'まひにかかりにくい。\nただし動きが遅くなる。' },
    // salamander_3 imp_3 gargoyle_3 · res:fire0.5
    bd_ash_cloak: { name: '灰のマント', type: 'body', weight: 'cloth', grade: 'rare', tier: 5, units: 'i2', src: 'mdrop', quirk: true,
      mods: { elemResist: { fire: 0.5, /* クセ */ water: 1.25 } },
      desc: '火のダメージを減らす。\nただし水に弱くなる。' },
    // armor_3 · def+8
    bd_knight_mail: { name: '騎士の古鎧', type: 'body', weight: 'heavy', grade: 'rare', tier: 5, units: 'v2', src: 'mdrop', quirk: true,
      mods: { def: 8, /* クセ */ eva: -10 },
      desc: '守備力が上がる。ただしかわしにくい。' },
    // jelly_3 · sres:poison40
    hn_jelly_glove: { name: 'ゼリーの手袋', type: 'hands', weight: 'cloth', grade: 'rare', tier: 5, units: 'm1', src: 'mdrop', quirk: true,
      mods: { statusResist: { poison: 0.4 }, /* クセ */ defPct: -25 },
      desc: '毒にかかりにくい。ただし守備力が下がる。' },
    // paper_3 · sres:silence50
    sh_blank_shield: { name: '白紙の盾', type: 'shield', weight: 'heavy', grade: 'rare', tier: 7, units: 's1', src: 'mdrop', quirk: true,
      mods: { statusResist: { silence: 0.5 }, /* クセ */ spd: -15 },
      desc: '沈黙にかかりにくい。\nただし動きが遅くなる。' },
    // crab_4 · def+10
    sh_castle_shell: { name: '城ガニの盾', type: 'shield', weight: 'heavy', grade: 'rare', tier: 7, units: 'v1', src: 'mdrop', quirk: true,
      mods: { def: 10, /* クセ */ spd: -15 },
      desc: '守備力が上がる。ただし動きが遅くなる。' },
    // jelly_4 · hpPct+8
    hd_jelly_helm: { name: 'ゼリーの兜', type: 'head', weight: 'heavy', grade: 'rare', tier: 7, units: 'v1', src: 'mdrop', quirk: true,
      mods: { hpPct: 8, /* クセ */ mdefPct: -25 },
      desc: '最大HPが上がる。ただし術防が下がる。' },
    // rat_4 · goldPct+20
    hd_rat_bandana: { name: '頭領のバンダナ', type: 'head', weight: 'light', grade: 'rare', tier: 7, units: 'a1', src: 'mdrop', quirk: true,
      mods: { goldPct: 20, /* クセ */ expPct: -25 },
      desc: '手に入るお金が増える。\nただし経験値が減る。' },
    // mushroom_4 fairy_4 · healPct+15
    hd_fairy_circlet: { name: '妖精の冠', type: 'head', weight: 'cloth', grade: 'rare', tier: 7, units: 'm1', src: 'mdrop', quirk: true,
      mods: { healPct: 15, /* クセ */ defPct: -25 },
      desc: '回復の術がよく効く。\nただし守備力が下がる。' },
    // yeti_3 mammoth_3 · res:water0.5
    hd_yeti_fur: { name: '雪男の毛帽', type: 'head', weight: 'light', grade: 'rare', tier: 7, units: 'a1', src: 'mdrop', quirk: true,
      mods: { elemResist: { water: 0.5, /* クセ */ fire: 1.25 } },
      desc: '水のダメージを減らす。\nただし火に弱くなる。' },
    // armor_4 wyvern_3 · sres:stun50
    hd_blackgold_helm: { name: '黒金の兜', type: 'head', weight: 'heavy', grade: 'rare', tier: 7, units: 'v1', src: 'mdrop', quirk: true,
      mods: { statusResist: { stun: 0.5 }, /* クセ */ eva: -10 },
      desc: '気絶にかかりにくい。ただしかわしにくい。' },
    // scribe_1 book_1 · sres:silence50
    hd_scribe_hood: { name: '書記の頭巾', type: 'head', weight: 'cloth', grade: 'rare', tier: 7, units: 'i1', src: 'mdrop', quirk: true,
      mods: { statusResist: { silence: 0.5 }, /* クセ */ defPct: -25 },
      desc: '沈黙にかかりにくい。\nただし守備力が下がる。' },
    // bat_4 · res:dark0.5
    bd_night_cloak: { name: '夜のマント', type: 'body', weight: 'cloth', grade: 'rare', tier: 7, units: 'i2', src: 'mdrop', quirk: true,
      mods: { elemResist: { dark: 0.5, /* クセ */ light: 1.25 } },
      desc: '闇のダメージを減らす。\nただし光に弱くなる。' },
    // seabird_4 · res:wind0.5
    bd_gull_robe: { name: '潮風の薄衣', type: 'body', weight: 'cloth', grade: 'rare', tier: 7, units: 'i2', src: 'mdrop', quirk: true,
      mods: { elemResist: { wind: 0.5, /* クセ */ earth: 1.25 } },
      desc: '風のダメージを減らす。\nただし土に弱くなる。' },
    // scribe_2 book_2 · mdef+10
    bd_scribe_coat: { name: '記録院の白衣', type: 'body', weight: 'cloth', grade: 'rare', tier: 7, units: 'i2', src: 'mdrop', quirk: true,
      mods: { mdef: 10, /* クセ */ defPct: -25 },
      desc: '術防が上がる。ただし守備力が下がる。' },
    // void_3 · res:dark0.5 sres:death50
    hd_void_helm: { name: '虚無の兜', type: 'head', weight: 'heavy', grade: 'rare', tier: 9, units: 's1', src: 'mdrop', quirk: true,
      mods: { elemResist: { dark: 0.5, /* クセ */ light: 1.25 }, statusResist: { death: 0.5 } },
      desc: '闇のダメージを減らす。\n即死にかかりにくい。ただし光に弱くなる。' },
    // ---------------------------------------------------------------- monster supers (65)
    // cactus_1（1/256）· def+5 eva+5 ｜ Q: res:fire1.5
    sh_sr_cactus: { name: 'サボテンの盾', type: 'shield', weight: 'light', grade: 'super', tier: 1, units: 'd1', src: 'super', exclusive: 'cactus_1',
      quirk: true,
      mods: { def: 5, eva: 5, /* クセ */ elemResist: { fire: 1.5 } },
      desc: '守備力が上がる。攻撃をかわしやすい。\nただし火に弱くなる。' },
    // lizardman_1（1/256）· eva+8 res:water0.5 ｜ Q: res:earth1.5
    sh_sr_reed_shield: { name: 'アシの盾', type: 'shield', weight: 'light', grade: 'super', tier: 1, units: 'd1', src: 'super', exclusive: 'lizardman_1',
      quirk: true,
      mods: { eva: 8, elemResist: { water: 0.5, /* クセ */ earth: 1.5 } },
      desc: '攻撃をかわしやすい。水に強い。\nただし土に弱くなる。' },
    // mushroom_1（1/256）· imm:sleep hpPct+10 ｜ Q: stat:agi-1u
    hd_sr_nap_cap: { name: 'ひるねの帽子', type: 'head', weight: 'cloth', grade: 'super', tier: 1, units: 'm1', src: 'super', exclusive: 'mushroom_1',
      quirk: true,
      mods: { statusImmune: ['sleep'], hpPct: 10 },
      statsAdd: { agi: -2 },
      desc: '眠りが効かない。最大HPが上がる。\nただし素早さが下がる。' },
    // owl_1（1/256）· hit+8 preemptPct+5 ｜ Q: res:wind1.5
    hd_sr_owl_feather: { name: '雪フクロウの羽飾り', type: 'head', weight: 'light', grade: 'super', tier: 1, units: 'a1', src: 'super', exclusive: 'owl_1',
      quirk: true,
      mods: { hit: 8, preemptPct: 5, /* クセ */ elemResist: { wind: 1.5 } },
      desc: 'よく当たる。先制しやすくなる。\nただし風に弱くなる。' },
    // doll_1（1/256）· sres:confuse50 mdef+4 ｜ Q: res:earth1.5
    hd_sr_porcelain_mask: { name: '陶器の仮面', type: 'head', weight: 'light', grade: 'super', tier: 1, units: 'd1', src: 'super', exclusive: 'doll_1',
      quirk: true,
      mods: { statusResist: { confuse: 0.5 }, mdef: 4, /* クセ */ elemResist: { earth: 1.5 } },
      desc: '混乱にかかりにくい。術防が上がる。\nただし土に弱くなる。' },
    // beetle_1（1/256）· crit+6 def+4 ｜ Q: res:fire1.5
    hd_sr_beetle_horn: { name: 'カブトの角兜', type: 'head', weight: 'heavy', grade: 'super', tier: 1, units: 's1', src: 'super', exclusive: 'beetle_1',
      quirk: true,
      mods: { crit: 6, def: 4, /* クセ */ elemResist: { fire: 1.5 } },
      desc: '会心が出やすい。守備力が上がる。\nただし火に弱くなる。' },
    // gargoyle_1（1/256）· def+6 sres:paralyze50 ｜ Q: res:wind1.5
    hd_sr_gargoyle_face: { name: '石像鬼の面', type: 'head', weight: 'heavy', grade: 'super', tier: 1, units: 's1', src: 'super', exclusive: 'gargoyle_1',
      quirk: true,
      mods: { def: 6, statusResist: { paralyze: 0.5 }, /* クセ */ elemResist: { wind: 1.5 } },
      desc: '守備力が上がる。まひにかかりにくい。\nただし風に弱くなる。' },
    // armor_1（1/256）· def+10 imm:confuse ｜ Q: stat:agi-1u
    bd_sr_hollow_mail: { name: 'がらんどうの胸甲', type: 'body', weight: 'heavy', grade: 'super', tier: 1, units: 'v2', src: 'super', exclusive: 'armor_1',
      quirk: true,
      mods: { def: 10, statusImmune: ['confuse'] },
      statsAdd: { agi: -2 },
      desc: '守備力が上がる。混乱が効かない。\nただし素早さが下がる。' },
    // mummy_1（1/256）· sres:paralyze50 def+4 ｜ Q: res:fire1.5
    hn_sr_tomb_wrap: { name: '墓守の手甲', type: 'hands', weight: 'light', grade: 'super', tier: 1, units: 'd1', src: 'super', exclusive: 'mummy_1',
      quirk: true,
      mods: { statusResist: { paralyze: 0.5 }, def: 4, /* クセ */ elemResist: { fire: 1.5 } },
      desc: 'まひにかかりにくい。守備力が上がる。\nただし火に弱くなる。' },
    // spider_1（1/256）· hit+10 stealPct+25 ｜ Q: res:fire1.5
    hn_sr_silk_gloves: { name: 'クモ糸の手袋', type: 'hands', weight: 'cloth', grade: 'super', tier: 1, units: 'i1', src: 'super', exclusive: 'spider_1',
      quirk: true,
      mods: { hit: 10, stealPct: 25, /* クセ */ elemResist: { fire: 1.5 } },
      desc: 'よく当たる。盗みが成功しやすい。\nただし火に弱くなる。' },
    // mole_1（1/256）· atk+4 noFloorDamage ｜ Q: res:wind1.5
    hn_sr_digger: { name: '穴掘りの手甲', type: 'hands', weight: 'light', grade: 'super', tier: 1, units: 'a1', src: 'super', exclusive: 'mole_1', quirk: true,
      mods: { atk: 4, noFloorDamage: true, /* クセ */ elemResist: { wind: 1.5 } },
      desc: '毒の沼や熱い床で傷つかない。\n攻撃力が上がる。ただし風に弱くなる。' },
    // automaton_1（1/256）· hit+8 def+5 ｜ Q: res:water1.5
    hn_sr_gear_gauntlet: { name: '歯車の籠手', type: 'hands', weight: 'heavy', grade: 'super', tier: 1, units: 'v1', src: 'super', exclusive: 'automaton_1',
      quirk: true,
      mods: { hit: 8, def: 5, /* クセ */ elemResist: { water: 1.5 } },
      desc: 'よく当たる。守備力が上がる。\nただし水に弱くなる。' },
    // bat_1（1/256）· eva+8 escapePct+25 ｜ Q: res:wind1.5
    ft_sr_bat_wing: { name: 'コウモリの羽靴', type: 'feet', weight: 'light', grade: 'super', tier: 1, units: 'a1', src: 'super', exclusive: 'bat_1',
      quirk: true,
      mods: { eva: 8, escapePct: 25, /* クセ */ elemResist: { wind: 1.5 } },
      desc: '攻撃をかわしやすい。逃げやすくなる。\nただし風に弱くなる。' },
    // seabird_1（1/256）· spd+10 preemptPct+5 ｜ Q: res:wind1.5
    ft_sr_gull_boots: { name: 'カモメの羽靴', type: 'feet', weight: 'light', grade: 'super', tier: 1, units: 'a1', src: 'super', exclusive: 'seabird_1',
      quirk: true,
      mods: { spd: 10, preemptPct: 5, /* クセ */ elemResist: { wind: 1.5 } },
      desc: 'すばやく動ける。先制しやすくなる。\nただし風に弱くなる。' },
    // fairy_1（1/256）· preemptPct+8 escapePct+30 ｜ Q: stat:vit-1u
    ft_sr_prank_shoes: { name: 'いたずら妖精の靴', type: 'feet', weight: 'cloth', grade: 'super', tier: 1, units: 'i1', src: 'super', exclusive: 'fairy_1',
      quirk: true,
      mods: { preemptPct: 8, escapePct: 30 },
      statsAdd: { vit: -2 },
      desc: '先制しやすくなる。逃げやすくなる。\nただし体力が下がる。' },
    // snake_1（1/256）· spd+8 noFloorDamage ｜ Q: res:fire1.5
    ft_sr_sandsnake: { name: '砂ヘビの靴', type: 'feet', weight: 'light', grade: 'super', tier: 1, units: 'a1', src: 'super', exclusive: 'snake_1',
      quirk: true,
      mods: { spd: 8, noFloorDamage: true, /* クセ */ elemResist: { fire: 1.5 } },
      desc: '毒の沼や熱い床で傷つかない。\nすばやく動ける。ただし火に弱くなる。' },
    // frog_1（1/256）· noFloorDamage eva+6 ｜ Q: res:earth1.5
    ft_sr_frog_boots: { name: 'カエルの水かき靴', type: 'feet', weight: 'light', grade: 'super', tier: 1, units: 'd1', src: 'super', exclusive: 'frog_1',
      quirk: true,
      mods: { noFloorDamage: true, eva: 6, /* クセ */ elemResist: { earth: 1.5 } },
      desc: '毒の沼や熱い床で傷つかない。\n攻撃をかわしやすい。ただし土に弱くなる。' },
    // merman_1（1/256）· spd+8 res:water0.5 ｜ Q: res:earth1.5
    ft_sr_fin_boots: { name: '魚人のひれ靴', type: 'feet', weight: 'light', grade: 'super', tier: 1, units: 'd1', src: 'super', exclusive: 'merman_1',
      quirk: true,
      mods: { spd: 8, elemResist: { water: 0.5, /* クセ */ earth: 1.5 } },
      desc: 'すばやく動ける。水のダメージを減らす。\nただし土に弱くなる。' },
    // salamander_1（1/256）· res:fire0.5 noFloorDamage ｜ Q: res:water1.5
    ft_sr_salamander: { name: '火トカゲの靴', type: 'feet', weight: 'light', grade: 'super', tier: 1, units: 'a1', src: 'super', exclusive: 'salamander_1',
      quirk: true,
      mods: { elemResist: { fire: 0.5, /* クセ */ water: 1.5 }, noFloorDamage: true },
      desc: '火に強い。毒の沼や熱い床で傷つかない。\nただし水に弱くなる。' },
    // golem_1（1/256）· def+10 sres:stun50 ｜ Q: stat:agi-1u
    sh_sr_rubble: { name: '石くれの大盾', type: 'shield', weight: 'heavy', grade: 'super', tier: 2, units: 'v1', src: 'super', exclusive: 'golem_1',
      quirk: true,
      mods: { def: 10, statusResist: { stun: 0.5 } },
      statsAdd: { agi: -2 },
      desc: '守備力が上がる。気絶にかかりにくい。\nただし素早さが下がる。' },
    // kraken_1（1/256）· sres:blind60 mdef+4 ｜ Q: res:earth1.5
    hd_sr_octopus_cap: { name: 'タコの頭巾', type: 'head', weight: 'cloth', grade: 'super', tier: 2, units: 'm1', src: 'super', exclusive: 'kraken_1',
      quirk: true,
      mods: { statusResist: { blind: 0.6 }, mdef: 4, /* クセ */ elemResist: { earth: 1.5 } },
      desc: '暗闇にかかりにくい。術防が上がる。\nただし土に弱くなる。' },
    // wyvern_1（1/256）· res:wind0.5 spd+6 ｜ Q: res:fire1.5
    hd_sr_wyvern_crest: { name: '若飛竜の兜', type: 'head', weight: 'heavy', grade: 'super', tier: 2, units: 's1', src: 'super', exclusive: 'wyvern_1',
      quirk: true,
      mods: { elemResist: { wind: 0.5, /* クセ */ fire: 1.5 }, spd: 6 },
      desc: '風のダメージを減らす。すばやく動ける。\nただし火に弱くなる。' },
    // sandworm_1（1/256）· hpPct+10 res:earth0.5 ｜ Q: res:wind1.5
    bd_sr_sandworm_hide: { name: '砂ミミズの革鎧', type: 'body', weight: 'light', grade: 'super', tier: 2, units: 'd2', src: 'super', exclusive: 'sandworm_1',
      quirk: true,
      mods: { hpPct: 10, elemResist: { earth: 0.5, /* クセ */ wind: 1.5 } },
      desc: '最大HPが上がる。土のダメージを減らす。\nただし風に弱くなる。' },
    // mammoth_1（1/256）· hpPct+15 res:water0.5 ｜ Q: stat:agi-1u
    bd_sr_mammoth_fur: { name: 'マンモスの毛皮', type: 'body', weight: 'heavy', grade: 'super', tier: 2, units: 's2', src: 'super', exclusive: 'mammoth_1',
      quirk: true,
      mods: { hpPct: 15, elemResist: { water: 0.5 } },
      statsAdd: { agi: -2 },
      desc: '最大HPが上がる。水のダメージを減らす。\nただし素早さが下がる。' },
    // chimera_1（1/256）· crit+8 atk+4 ｜ Q: res:fire1.5
    hn_sr_chimera_paw: { name: 'まだら獣の籠手', type: 'hands', weight: 'light', grade: 'super', tier: 2, units: 'a1', src: 'super', exclusive: 'chimera_1',
      quirk: true,
      mods: { crit: 8, atk: 4, /* クセ */ elemResist: { fire: 1.5 } },
      desc: '会心が出やすい。攻撃力が上がる。\nただし火に弱くなる。' },
    // crab_2（1/256）· def+10 sres:stun50 ｜ Q: stat:agi-1u
    sh_sr_ironshell: { name: '鉄甲の盾', type: 'shield', weight: 'heavy', grade: 'super', tier: 3, units: 'v1', src: 'super', exclusive: 'crab_2',
      quirk: true,
      mods: { def: 10, statusResist: { stun: 0.5 } },
      statsAdd: { agi: -3 },
      desc: '守備力が上がる。気絶にかかりにくい。\nただし素早さが下がる。' },
    // treant_2（1/256）· def+6 eva+6 ｜ Q: res:fire1.5
    sh_sr_bramble: { name: 'いばらの盾', type: 'shield', weight: 'light', grade: 'super', tier: 3, units: 'd1', src: 'super', exclusive: 'treant_2',
      quirk: true,
      mods: { def: 6, eva: 6, /* クセ */ elemResist: { fire: 1.5 } },
      desc: '守備力が上がる。攻撃をかわしやすい。\nただし火に弱くなる。' },
    // beetle_2（1/256）· def+8 res:earth0.5 ｜ Q: res:fire1.5
    sh_sr_beetle_shell: { name: '鉄カブトの殻盾', type: 'shield', weight: 'heavy', grade: 'super', tier: 3, units: 's1', src: 'super', exclusive: 'beetle_2',
      quirk: true,
      mods: { def: 8, elemResist: { earth: 0.5, /* クセ */ fire: 1.5 } },
      desc: '守備力が上がる。土のダメージを減らす。\nただし火に弱くなる。' },
    // armor_2（1/256）· def+10 sres:stun50 ｜ Q: stat:agi-1u
    sh_sr_sentinel: { name: '番兵の大盾', type: 'shield', weight: 'heavy', grade: 'super', tier: 3, units: 'v1', src: 'super', exclusive: 'armor_2',
      quirk: true,
      mods: { def: 10, statusResist: { stun: 0.5 } },
      statsAdd: { agi: -3 },
      desc: '守備力が上がる。気絶にかかりにくい。\nただし素早さが下がる。' },
    // mummy_2（1/256）· mag+6 glim:dark20 ｜ Q: res:light1.5
    hd_sr_cursed_wrap: { name: '呪いの包帯', type: 'head', weight: 'cloth', grade: 'super', tier: 3, units: 'i1', src: 'super', exclusive: 'mummy_2',
      quirk: true,
      mods: { mag: 6, glimPct: { dark: 20 }, /* クセ */ elemResist: { light: 1.5 } },
      desc: '術力が上がる。闇の術を閃きやすい。\nただし光に弱くなる。' },
    // eyeball_2（1/256）· sres:paralyze60 crit+5 ｜ Q: res:light1.5
    hd_sr_glare_band: { name: 'にらみの鉢巻き', type: 'head', weight: 'light', grade: 'super', tier: 3, units: 'd1', src: 'super', exclusive: 'eyeball_2',
      quirk: true,
      mods: { statusResist: { paralyze: 0.6 }, crit: 5, /* クセ */ elemResist: { light: 1.5 } },
      desc: 'まひにかかりにくい。会心が出やすい。\nただし光に弱くなる。' },
    // plant_2（1/256）· def+8 sres:paralyze50 ｜ Q: res:fire1.5
    bd_sr_thorn_mail: { name: 'いばらの鎧', type: 'body', weight: 'light', grade: 'super', tier: 3, units: 'd2', src: 'super', exclusive: 'plant_2',
      quirk: true,
      mods: { def: 8, statusResist: { paralyze: 0.5 }, /* クセ */ elemResist: { fire: 1.5 } },
      desc: '守備力が上がる。まひにかかりにくい。\nただし火に弱くなる。' },
    // ghost_2（1/256）· mdef+10 imm:sleep ｜ Q: res:light1.5
    bd_sr_mourning_veil: { name: '嘆きの喪服', type: 'body', weight: 'cloth', grade: 'super', tier: 3, units: 'm2', src: 'super', exclusive: 'ghost_2',
      quirk: true,
      mods: { mdef: 10, statusImmune: ['sleep'], /* クセ */ elemResist: { light: 1.5 } },
      desc: '術防が上がる。眠りが効かない。\nただし光に弱くなる。' },
    // darkmage_2（1/256）· boost:fire25 mag+6 ｜ Q: res:water1.5
    bd_sr_flame_robe: { name: '炎術師の法衣', type: 'body', weight: 'cloth', grade: 'super', tier: 3, units: 'i2', src: 'super', exclusive: 'darkmage_2',
      quirk: true,
      mods: { elemBoost: { fire: 25 }, mag: 6, /* クセ */ elemResist: { water: 1.5 } },
      desc: '火の攻撃が強くなる。術力が上がる。\nただし水に弱くなる。' },
    // frog_2（1/256）· imm:poison glim:whip20 ｜ Q: res:earth1.5
    hn_sr_poisonfrog: { name: '毒ガエルの手袋', type: 'hands', weight: 'light', grade: 'super', tier: 3, units: 'd1', src: 'super', exclusive: 'frog_2',
      quirk: true,
      mods: { statusImmune: ['poison'], glimPct: { whip: 20 }, /* クセ */ elemResist: { earth: 1.5 } },
      desc: '毒が効かない。鞭の技を閃きやすい。\nただし土に弱くなる。' },
    // mimic_2（1/128）· dropPct+30 stealPct+50 ｜ Q: def-50%
    hn_sr_greedy_hand: { name: '欲ばりの手袋', type: 'hands', weight: 'cloth', grade: 'super', tier: 3, units: 'i1', src: 'super', exclusive: 'mimic_2',
      quirk: true,
      mods: { dropPct: 30, stealPct: 50 },
      def: 3,                 // クセ: 守備が半分（同じ T・重さの通常品の半分）
      desc: '魔物がアイテムを落としやすい。\n盗みが成功しやすい。ただし守備力が下がる。' },
    // doll_2（1/256）· spd+12 eva+6 ｜ Q: stat:str-1u
    ft_sr_dance_shoes: { name: '踊り人形の靴', type: 'feet', weight: 'cloth', grade: 'super', tier: 3, units: 'i1', src: 'super', exclusive: 'doll_2',
      quirk: true,
      mods: { spd: 12, eva: 6 },
      statsAdd: { str: -3 },
      desc: 'すばやく動ける。攻撃をかわしやすい。\nただし腕力が下がる。' },
    // gargoyle_3（1/256）· res:fire0.5 def+8 ｜ Q: res:water1.5
    sh_sr_lava_gargoyle: { name: '火炎石の盾', type: 'shield', weight: 'heavy', grade: 'super', tier: 5, units: 's1', src: 'super', exclusive: 'gargoyle_3',
      quirk: true,
      mods: { elemResist: { fire: 0.5, /* クセ */ water: 1.5 }, def: 8 },
      desc: '火のダメージを減らす。守備力が上がる。\nただし水に弱くなる。' },
    // bat_3（1/256）· imm:confuse sres:sleep50 ｜ Q: mpCostPct+20
    hd_sr_echo_hood: { name: '反響の頭巾', type: 'head', weight: 'cloth', grade: 'super', tier: 5, units: 'i1', src: 'super', exclusive: 'bat_3', quirk: true,
      mods: { statusImmune: ['confuse'], statusResist: { sleep: 0.5 }, /* クセ */ mpCostPct: 20 },
      desc: '混乱が効かない。眠りにかかりにくい。\nただし術のMPの消費が増える。' },
    // fairy_3（1/256）· eva+8 sres:silence50 ｜ Q: res:earth1.5
    hd_sr_mist_veil: { name: '霧の妖精のベール', type: 'head', weight: 'cloth', grade: 'super', tier: 5, units: 'i1', src: 'super', exclusive: 'fairy_3',
      quirk: true,
      mods: { eva: 8, statusResist: { silence: 0.5 }, /* クセ */ elemResist: { earth: 1.5 } },
      desc: '攻撃をかわしやすい。沈黙にかかりにくい。\nただし土に弱くなる。' },
    // snake_3（1/256）· sres:paralyze60 hit+8 ｜ Q: res:fire1.5
    hd_sr_gaze_circlet: { name: 'にらみの額当て', type: 'head', weight: 'light', grade: 'super', tier: 5, units: 'a1', src: 'super', exclusive: 'snake_3',
      quirk: true,
      mods: { statusResist: { paralyze: 0.6 }, hit: 8, /* クセ */ elemResist: { fire: 1.5 } },
      desc: 'まひにかかりにくい。よく当たる。\nただし火に弱くなる。' },
    // frostling_3（1/256）· res:water0 mag+6 ｜ Q: res:fire2
    hd_sr_blizzard_hat: { name: 'ふぶきの帽子', type: 'head', weight: 'cloth', grade: 'super', tier: 5, units: 'i1', src: 'super', exclusive: 'frostling_3',
      quirk: true,
      mods: { elemResist: { water: 0, /* クセ */ fire: 2 }, mag: 6 },
      desc: '水の攻撃を受けない。術力が上がる。\nただし火に弱くなる。' },
    // owl_3（1/256）· sres:confuse60 glim:spell15 ｜ Q: res:wind1.5
    hd_sr_spiral_monocle: { name: 'まどいの片眼鏡', type: 'head', weight: 'cloth', grade: 'super', tier: 5, units: 'i1', src: 'super', exclusive: 'owl_3',
      quirk: true,
      mods: { statusResist: { confuse: 0.6 }, glimPct: { spell: 15 }, /* クセ */ elemResist: { wind: 1.5 } },
      desc: '混乱にかかりにくい。術を閃きやすい。\nただし風に弱くなる。' },
    // crystal_3（1/256）· mag+6 res:water0.5 ｜ Q: res:earth1.5
    hd_sr_sapphire: { name: '青水晶の額飾り', type: 'head', weight: 'cloth', grade: 'super', tier: 5, units: 'i1', src: 'super', exclusive: 'crystal_3',
      quirk: true,
      mods: { mag: 6, elemResist: { water: 0.5, /* クセ */ earth: 1.5 } },
      desc: '術力が上がる。水のダメージを減らす。\nただし土に弱くなる。' },
    // treant_3（1/256）· regen res:earth0.5 ｜ Q: stat:agi-1u res:fire1.5
    bd_sr_moss_bark: { name: 'こけむした樹皮', type: 'body', weight: 'heavy', grade: 'super', tier: 5, units: 'v2', src: 'super', exclusive: 'treant_3',
      quirk: true,
      mods: { regen: true, elemResist: { earth: 0.5, /* クセ */ fire: 1.5 } },
      statsAdd: { agi: -4 },
      desc: '戦闘中、HPが少しずつ戻る。土に強い。\nただし素早さが下がる。火にも弱くなる。' },
    // scorpion_3（1/256）· def+12 sres:poison50 ｜ Q: stat:agi-1u
    bd_sr_steel_carapace: { name: '鋼殻の鎧', type: 'body', weight: 'heavy', grade: 'super', tier: 5, units: 's2', src: 'super', exclusive: 'scorpion_3',
      quirk: true,
      mods: { def: 12, statusResist: { poison: 0.5 } },
      statsAdd: { agi: -4 },
      desc: '守備力が上がる。毒にかかりにくい。\nただし素早さが下がる。' },
    // wolf_3（1/256）· res:water0.5 eva+6 ｜ Q: res:earth1.5
    bd_sr_blizzard_fur: { name: '吹雪の毛皮', type: 'body', weight: 'light', grade: 'super', tier: 5, units: 'a2', src: 'super', exclusive: 'wolf_3',
      quirk: true,
      mods: { elemResist: { water: 0.5, /* クセ */ earth: 1.5 }, eva: 6 },
      desc: '水のダメージを減らす。\n攻撃をかわしやすい。ただし土に弱くなる。' },
    // spider_3（1/256）· eva+12 boost:dark15 ｜ Q: res:light1.5 res:fire1.5
    bd_sr_shadow_silk: { name: '影糸の衣', type: 'body', weight: 'cloth', grade: 'super', tier: 5, units: 'i2', src: 'super', exclusive: 'spider_3',
      quirk: true,
      mods: { eva: 12, elemBoost: { dark: 15 }, /* クセ */ elemResist: { light: 1.5, fire: 1.5 } },
      desc: '攻撃をかわしやすい。闇の攻撃が強くなる。\nただし光・火に弱くなる。' },
    // imp_3（1/256）· eva+10 sres:blind60 ｜ Q: res:light1.5
    bd_sr_ash_cloak_devil: { name: '灰悪魔のマント', type: 'body', weight: 'cloth', grade: 'super', tier: 5, units: 'i2', src: 'super', exclusive: 'imp_3',
      quirk: true,
      mods: { eva: 10, statusResist: { blind: 0.6 }, /* クセ */ elemResist: { light: 1.5 } },
      desc: '攻撃をかわしやすい。暗闇にかかりにくい。\nただし光に弱くなる。' },
    // rat_3（1/256）· atk+6 def+6 ｜ Q: stat:agi-1u
    hn_sr_iron_tooth: { name: '鉄歯の手甲', type: 'hands', weight: 'heavy', grade: 'super', tier: 5, units: 's1', src: 'super', exclusive: 'rat_3',
      quirk: true,
      mods: { atk: 6, def: 6 },
      statsAdd: { agi: -4 },
      desc: '攻撃力が上がる。守備力が上がる。\nただし素早さが下がる。' },
    // bee_3（1/256）· hit+6 sres:paralyze50 ｜ Q: res:fire1.5
    hn_sr_numb_gloves: { name: 'しびれ針の手袋', type: 'hands', weight: 'light', grade: 'super', tier: 5, units: 'd1', src: 'super', exclusive: 'bee_3',
      quirk: true,
      mods: { hit: 6, statusResist: { paralyze: 0.5 }, /* クセ */ elemResist: { fire: 1.5 } },
      desc: 'よく当たる。まひにかかりにくい。\nただし火に弱くなる。' },
    // darkmage_3（1/256）· spd+12 boost:wind20 ｜ Q: res:fire1.5
    ft_sr_wind_sandals: { name: '風術師のサンダル', type: 'feet', weight: 'cloth', grade: 'super', tier: 5, units: 'i1', src: 'super', exclusive: 'darkmage_3',
      quirk: true,
      mods: { spd: 12, elemBoost: { wind: 20 }, /* クセ */ elemResist: { fire: 1.5 } },
      desc: 'すばやく動ける。風の攻撃が強くなる。\nただし火に弱くなる。' },
    // mirror_1（1/128）· res:light0.5 res:dark0.5 mdef+12 ｜ Q: stat:agi-1u
    sh_sr_mirror_shell: { name: '鏡の殻盾', type: 'shield', weight: 'heavy', grade: 'super', tier: 6, units: 's1', src: 'super', exclusive: 'mirror_1',
      quirk: true,
      mods: { elemResist: { light: 0.5, dark: 0.5 }, mdef: 12 },
      statsAdd: { agi: -4 },
      desc: '光・闇のダメージを減らす。術防が上がる。\nただし素早さが下がる。' },
    // paper_3（1/256）· res:dark0.5 sres:silence50 ｜ Q: res:fire1.5
    sh_sr_unwritten: { name: '書かれざる盾', type: 'shield', weight: 'heavy', grade: 'super', tier: 7, units: 's1', src: 'super', exclusive: 'paper_3',
      quirk: true,
      mods: { elemResist: { dark: 0.5, /* クセ */ fire: 1.5 }, statusResist: { silence: 0.5 } },
      desc: '闇のダメージを減らす。\n沈黙にかかりにくい。ただし火に弱くなる。' },
    // doll_4（1/256）· res:light0.5 mdef+10 eva+6 ｜ Q: res:dark1.5
    sh_sr_lady_parasol: { name: '貴婦人の日傘', type: 'shield', weight: 'cloth', grade: 'super', tier: 8, units: 'i1', src: 'super', exclusive: 'doll_4',
      quirk: true,
      mods: { elemResist: { light: 0.5, /* クセ */ dark: 1.5 }, mdef: 10, eva: 6 },
      desc: '光のダメージを減らす。術防が上がる。\n攻撃をかわしやすい。ただし闇に弱くなる。' },
    // seabird_4（1/256）· res:wind0.5 eva+10 ｜ Q: res:fire1.5
    hd_sr_sea_wind: { name: '潮風の冠', type: 'head', weight: 'light', grade: 'super', tier: 8, units: 'a1', src: 'super', exclusive: 'seabird_4',
      quirk: true,
      mods: { elemResist: { wind: 0.5, /* クセ */ fire: 1.5 }, eva: 10 },
      desc: '風のダメージを減らす。\n攻撃をかわしやすい。ただし火に弱くなる。' },
    // crab_4（1/256）· def+15 res:water0.5 ｜ Q: stat:agi-2u
    bd_sr_castle_carapace: { name: '城ガニの甲羅', type: 'body', weight: 'heavy', grade: 'super', tier: 8, units: 'v2', src: 'super', exclusive: 'crab_4',
      quirk: true,
      mods: { def: 15, elemResist: { water: 0.5 } },
      statsAdd: { agi: -10 },
      desc: '守備力が上がる。水のダメージを減らす。\nただし素早さが下がる。' },
    // plant_5（1/256）· regen healPct+15 ｜ Q: res:dark1.5 res:fire1.5
    bd_sr_thousand_petal: { name: '千年花の衣', type: 'body', weight: 'cloth', grade: 'super', tier: 8, units: 'm2', src: 'super', exclusive: 'plant_5',
      quirk: true,
      mods: { regen: true, healPct: 15, /* クセ */ elemResist: { dark: 1.5, fire: 1.5 } },
      desc: 'HPが戻る。回復の術がよく効く。\nただし闇・火に弱くなる。' },
    // kraken_3（1/256）· res:water0 eva+8 ｜ Q: res:earth2
    bd_sr_whirlpool: { name: '渦潮のマント', type: 'body', weight: 'cloth', grade: 'super', tier: 8, units: 'm2', src: 'super', exclusive: 'kraken_3',
      quirk: true,
      mods: { elemResist: { water: 0, /* クセ */ earth: 2 }, eva: 8 },
      desc: '水の攻撃を受けない。攻撃をかわしやすい。\nただし土に弱くなる。' },
    // beetle_4（1/256）· def+20 res:earth0.5 ｜ Q: stat:agi-2u mdef-50%
    bd_sr_diamond_shell: { name: '金剛の甲殻', type: 'body', weight: 'heavy', grade: 'super', tier: 8, units: 's2', src: 'super', exclusive: 'beetle_4',
      quirk: true,
      mods: { def: 20, elemResist: { earth: 0.5 } },
      mdef: 13,                // クセ: 術防が半分（同じ T・重さの通常品の半分）
      statsAdd: { agi: -10 },
      desc: '守備力が上がる。土のダメージを減らす。\nただし素早さが下がる。術防も下がる。' },
    // chimera_3（1/256）· res:fire-1 hpPct+10 ｜ Q: res:water2
    bd_sr_chimera_hide: { name: '業火の獣皮', type: 'body', weight: 'light', grade: 'super', tier: 8, units: 'a2', src: 'super', exclusive: 'chimera_3',
      quirk: true,
      mods: { elemResist: { fire: -1, /* クセ */ water: 2 }, hpPct: 10 },
      desc: '火の攻撃を吸い取る。最大HPが上がる。\nただし水に弱くなる。' },
    // void_3（1/256）· res:dark-1 res:light0.5 def+20 ｜ Q: stat:agi-2u
    sh_sr_void_aegis: { name: '虚無の大盾', type: 'shield', weight: 'heavy', grade: 'super', tier: 9, units: 's1', src: 'super', exclusive: 'void_3',
      quirk: true,
      mods: { elemResist: { dark: -1, light: 0.5 }, def: 20 },
      statsAdd: { agi: -12 },
      desc: '闇を吸う。光のダメージを減らす。\n守備力が上がる。ただし素早さが下がる。' },
    // demon_2（1/256）· atk+12 imm:stun ｜ Q: res:light2
    hd_sr_demon_general: { name: '魔将の角兜', type: 'head', weight: 'heavy', grade: 'super', tier: 9, units: 's1', src: 'super', exclusive: 'demon_2',
      quirk: true,
      mods: { atk: 12, statusImmune: ['stun'], /* クセ */ elemResist: { light: 2 } },
      desc: '攻撃力が上がる。気絶が効かない。\nただし光に弱くなる。' },
    // chaos_2（1/256）· res:fire0.5 res:water0.5 res:wind0.5 res:earth0.5 ｜ Q: res:light1.5 stat:agi-2u
    bd_sr_chaos_hide: { name: '混沌の獣皮', type: 'body', weight: 'heavy', grade: 'super', tier: 9, units: 's2', src: 'super', exclusive: 'chaos_2',
      quirk: true,
      mods: { elemResist: { fire: 0.5, water: 0.5, wind: 0.5, earth: 0.5, /* クセ */ light: 1.5 } },
      statsAdd: { agi: -12 },
      desc: '火・水・風・土のダメージを減らす。\nただし光に弱くなる。素早さも下がる。' },
    // chaos_3（1/256）· crit+15 physPct+10 ｜ Q: res:light1.5
    hn_sr_chaos_claw: { name: '混沌の爪甲', type: 'hands', weight: 'heavy', grade: 'super', tier: 9, units: 's1', src: 'super', exclusive: 'chaos_3',
      quirk: true,
      mods: { crit: 15, physPct: 10, /* クセ */ elemResist: { light: 1.5 } },
      desc: '会心が出やすい。物理攻撃の威力が上がる。\nただし光に弱くなる。' },
    // ---------------------------------------------------------------- fixed-tier super of a rare monster (1)
    // → rm_memory_fish（§8.7.2）
    sh_sr_memory_bowl: { name: '記憶の金魚鉢', type: 'shield', weight: 'cloth', grade: 'super', tier: 9, units: 'm1', src: 'super',
      exclusive: 'rm_memory_fish', quirk: true,
      mods: { mag: 15, statusImmune: ['silence', 'sleep'] },
      def: 14,                 // クセ: 守備が半分（同じ T・重さの通常品の半分）
      desc: '術力が上がる。沈黙・眠りが効かない。\nただし守備力が下がる。' },
  };

  // register now (ids must exist for other owners' load-time checks); numbers are filled in R.onData
  for (const id in ITEMS) {
    if (R.DB.items[id]) R.loadErrors.push('items_armor_monster: duplicate item id ' + id);
    R.DB.items[id] = ITEMS[id];
  }
  R.onData(() => {
    if (!R.GearA || !R.GearA.finish) { R.loadErrors.push('items_armor_monster: items_armor.js (R.GearA) did not load'); return; }
    R.GearA.finish(Object.keys(ITEMS), 'monster');
  });
})(window.RPG);
