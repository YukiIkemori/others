// items_acc_monster.js — gear-a (A10a). Monster accessories: 40 rares, 28 supers, 1 fixed-tier super.
// Numbers (def mdef eva stats price) are filled by R.Rules.fillItem in R.onData (DESIGN §8.2.9); the data
// only carries tier / grade / units / weight. Spec: DESIGN §8 (definitions) and §9.12 (monster → item).
(function (R) {
  'use strict';
  // Monster-chapter accessories (DESIGN §9.12): rares of the monster rare slot (§9.12.5, incl. the two post-game
  // bosses), supers of exactly one monster's super slot (§9.12.4), and the fixed-tier super of 本の虫 (§8.7.2).
  const ITEMS = {
    // ---------------------------------------------------------------- monster rares (40)
    // jelly_1 · hpPct+5
    ac_jelly_ring: { name: 'ゼリーの指輪', type: 'acc', grade: 'rare', tier: 1, units: 'v1', src: 'mdrop',
      mods: { hpPct: 5 },
      desc: '最大HPが上がる。' },
    // bat_1 · escapePct+25
    ac_bat_fang: { name: 'コウモリの牙飾り', type: 'acc', grade: 'rare', tier: 1, units: 's1', src: 'mdrop',
      mods: { escapePct: 25 },
      desc: '逃げやすくなる。' },
    // seabird_1 · spd+6
    ac_gull_feather: { name: 'カモメの羽根飾り', type: 'acc', grade: 'rare', tier: 1, units: 'a1', src: 'mdrop',
      mods: { spd: 6 },
      desc: 'すばやく動ける。' },
    // frostling_1 mammoth_1 · sres:freeze30
    ac_snow_crystal: { name: '雪の結晶', type: 'acc', grade: 'rare', tier: 1, units: 'i1', src: 'mdrop',
      mods: { statusResist: { freeze: 0.3 } },
      desc: '凍結にかかりにくい。' },
    // mimic_1 · goldPct+20
    ac_mimic_tongue: { name: '宝箱の舌', type: 'acc', grade: 'rare', tier: 1, units: 'v1', src: 'mdrop',
      mods: { goldPct: 20 },
      desc: '手に入るお金が増える。' },
    // paper_1 · sres:silence40
    ac_blank_page: { name: '白紙の一枚', type: 'acc', grade: 'rare', tier: 3, units: 'm1', src: 'mdrop',
      mods: { statusResist: { silence: 0.4 } },
      desc: '沈黙にかかりにくい。' },
    // fairy_2 treant_2 · regen
    ac_honey_charm: { name: '蜂蜜のお守り', type: 'acc', grade: 'rare', tier: 3, units: 'i1', src: 'mdrop',
      mods: { regen: true },
      desc: '戦闘中、HPが少しずつ戻る。' },
    // crystal_2 · boost:fire15
    ac_ruby_chip: { name: '紅水晶のかけら', type: 'acc', grade: 'rare', tier: 3, units: 'v1', src: 'mdrop',
      mods: { elemBoost: { fire: 15 } },
      desc: '火の攻撃が強くなる。' },
    // mimic_2 · dropPct+20
    ac_mimic_key: { name: '宝箱の合い鍵', type: 'acc', grade: 'rare', tier: 3, units: 'v1', src: 'mdrop',
      mods: { dropPct: 20 },
      desc: '魔物が品を落としやすい。' },
    // mushroom_3 fairy_3 · mpRegen+1
    ac_fairy_dust: { name: '妖精の粉袋', type: 'acc', grade: 'rare', tier: 5, units: 'm1', src: 'mdrop',
      mods: { mpRegen: 1 },
      desc: '戦闘中、MPが少しずつ戻る。' },
    // wolf_3 frostling_3 owl_3 · res:water0.5
    ac_blizzard_charm: { name: '吹雪のお守り', type: 'acc', grade: 'rare', tier: 5, units: 's1', src: 'mdrop',
      mods: { elemResist: { water: 0.5 } },
      desc: '水のダメージを減らす。' },
    // merman_3 skeleton_3 · mdef+6
    ac_pearl_ear: { name: '真珠の耳飾り', type: 'acc', grade: 'rare', tier: 5, units: 'v1', src: 'mdrop',
      mods: { mdef: 6 },
      desc: '術防が上がる。' },
    // mole_3 beetle_3 goblin_3 · hit+8
    ac_gem_eye: { name: '宝石の目', type: 'acc', grade: 'rare', tier: 5, units: 's1', src: 'mdrop',
      mods: { hit: 8 },
      desc: 'よく当たる。' },
    // crystal_3 · boost:water15
    ac_sapphire_chip: { name: '青水晶のかけら', type: 'acc', grade: 'rare', tier: 5, units: 'v1', src: 'mdrop',
      mods: { elemBoost: { water: 15 } },
      desc: '水の攻撃が強くなる。' },
    // eyeball_3 darkmage_3 automaton_3 · glim:spell15
    ac_astrolabe: { name: '小さな天球儀', type: 'acc', grade: 'rare', tier: 5, units: 'i1', src: 'mdrop',
      mods: { glimPct: { spell: 15 } },
      desc: '術を閃きやすい。' },
    // mimic_3 · rarePct+20
    ac_mimic_chain: { name: '呪い宝箱の鎖', type: 'acc', grade: 'rare', tier: 5, units: 'v1', src: 'mdrop',
      mods: { rarePct: 20 },
      desc: 'レアの品を落としやすい。' },
    // quicksilver_1 · expPct+15
    ac_silver_drop: { name: '白銀のひとしずく', type: 'acc', grade: 'rare', tier: 5, units: 'v1', src: 'mdrop',
      mods: { expPct: 15 },
      desc: '経験値が増える。' },
    // mirror_1 · res:light0.5
    ac_mirror_scale: { name: '鏡のうろこ', type: 'acc', grade: 'rare', tier: 5, units: 'd1', src: 'mdrop',
      mods: { elemResist: { light: 0.5 } },
      desc: '光のダメージを減らす。' },
    // jelly_5 · res:fire0.75 res:water0.75 res:wind0.75 res:earth0.75
    ac_rainbow_drop: { name: '七色の粒', type: 'acc', grade: 'rare', tier: 7, units: 'v1', src: 'mdrop',
      mods: { elemResist: { fire: 0.75, water: 0.75, wind: 0.75, earth: 0.75 } },
      desc: '火・水・風・土のダメージを少し減らす。' },
    // bat_5 · regen
    ac_count_brooch: { name: '夜公爵のブローチ', type: 'acc', grade: 'rare', tier: 7, units: 's1', src: 'mdrop',
      mods: { regen: true },
      desc: '戦闘中、HPが少しずつ戻る。' },
    // bee_5 plant_5 · hpPct+10
    ac_millennium_seed: { name: '千年の種', type: 'acc', grade: 'rare', tier: 7, units: 'd1', src: 'mdrop',
      mods: { hpPct: 10 },
      desc: '最大HPが上がる。' },
    // scorpion_5 mummy_5 · imm:death
    ac_royal_ankh: { name: '王家の護符', type: 'acc', grade: 'rare', tier: 7, units: 'd1', src: 'mdrop',
      mods: { statusImmune: ['death'] },
      desc: '即死が効かない。' },
    // mummy_4 · imm:death
    ac_scarab: { name: '聖甲虫の護符', type: 'acc', grade: 'rare', tier: 7, units: 'i1', src: 'mdrop',
      mods: { statusImmune: ['death'] },
      desc: '即死が効かない。' },
    // ghost_5 · res:dark0.5
    ac_underworld_bell: { name: '冥界の鈴', type: 'acc', grade: 'rare', tier: 7, units: 'm1', src: 'mdrop',
      mods: { elemResist: { dark: 0.5 } },
      desc: '闇のダメージを減らす。' },
    // doll_4 lizardman_4 spider_4 · res:dark0.5
    ac_soul_candle: { name: '魂のろうそく', type: 'acc', grade: 'rare', tier: 7, units: 'v1', src: 'mdrop',
      mods: { elemResist: { dark: 0.5 } },
      desc: '闇のダメージを減らす。' },
    // skeleton_5 · buff:atk+1
    ac_admiral_medal: { name: '提督の勲章', type: 'acc', grade: 'rare', tier: 7, units: 'i1', src: 'mdrop',
      mods: { startBuffs: { atk: 1 } },
      desc: '戦闘の始めに攻撃が上がる。' },
    // golem_3 crystal_4 · mdef+8
    ac_gem_core: { name: '宝玉の核', type: 'acc', grade: 'rare', tier: 7, units: 'v1', src: 'mdrop',
      mods: { mdef: 8 },
      desc: '術防が上がる。' },
    // goblin_5 · goldPct+20
    ac_goblin_hoard: { name: '小鬼の財宝袋', type: 'acc', grade: 'rare', tier: 7, units: 'd1', src: 'mdrop',
      mods: { goldPct: 20 },
      desc: '手に入るお金が増える。' },
    // salamander_5 imp_5 · boost:fire20
    ac_phoenix_ash: { name: '炎鳥の灰', type: 'acc', grade: 'rare', tier: 7, units: 's1', src: 'mdrop',
      mods: { elemBoost: { fire: 20 } },
      desc: '火の攻撃が強くなる。' },
    // eyeball_5 · res:light0.5
    ac_heaven_feather: { name: '天の羽根', type: 'acc', grade: 'rare', tier: 7, units: 'i1', src: 'mdrop',
      mods: { elemResist: { light: 0.5 } },
      desc: '光のダメージを減らす。' },
    // scribe_3 book_3 demon_1 · glim:spell15
    ac_archive_key: { name: '書庫の鍵', type: 'acc', grade: 'rare', tier: 7, units: 'd1', src: 'mdrop',
      mods: { glimPct: { spell: 15 } },
      desc: '術を閃きやすい。' },
    // mimic_4 · rarePct+20
    ac_abyss_key: { name: '奈落の鍵', type: 'acc', grade: 'rare', tier: 7, units: 'v1', src: 'mdrop',
      mods: { rarePct: 20 },
      desc: 'レアの品を落としやすい。' },
    // quicksilver_2 · expPct+15
    ac_silver_orb: { name: '白銀の玉', type: 'acc', grade: 'rare', tier: 7, units: 'v1', src: 'mdrop',
      mods: { expPct: 15 },
      desc: '経験値が増える。' },
    // mirror_2 · mdef+10
    ac_mirror_crest: { name: '鏡の紋章', type: 'acc', grade: 'rare', tier: 7, units: 'd1', src: 'mdrop',
      mods: { mdef: 10 },
      desc: '術防が上がる。' },
    // platinum_1 · expPct+15
    ac_platinum_flame: { name: '白金の炎', type: 'acc', grade: 'rare', tier: 7, units: 'm1', src: 'mdrop',
      mods: { expPct: 15 },
      desc: '経験値が増える。' },
    // void_1 void_2 demon_2 · res:dark0.5
    ac_void_shard: { name: '虚無のかけら', type: 'acc', grade: 'rare', tier: 9, units: 'm1', src: 'mdrop',
      mods: { elemResist: { dark: 0.5 } },
      desc: '闇のダメージを減らす。' },
    // platinum_2 · expPct+15
    ac_platinum_crown: { name: '白金の灯冠', type: 'acc', grade: 'rare', tier: 9, units: 'm1', src: 'mdrop',
      mods: { expPct: 15 },
      desc: '経験値が増える。' },
    // chaos_3 · sres:confuse50 boost:dark20
    ac_chaos_eye: { name: '混沌の瞳', type: 'acc', grade: 'rare', tier: 9, units: 's1', src: 'mdrop',
      mods: { statusResist: { confuse: 0.5 }, elemBoost: { dark: 20 } },
      desc: '混乱にかかりにくい。闇の攻撃が強くなる。' },
    // b_valzard_echo · res:dark0.5 imm:death boost:light20
    ac_crest_fragment: { name: '紋章のかけら', type: 'acc', grade: 'rare', tier: 9, units: 'i1', src: 'mdrop',
      mods: { elemResist: { dark: 0.5 }, statusImmune: ['death'], elemBoost: { light: 20 } },
      desc: '闇のダメージを減らす。\n即死が効かない。光の攻撃が強くなる。' },
    // b_ouroboros · wpRegen+3 mpRegen+3
    ac_ouroboros_ring: { name: '円環のかけら', type: 'acc', grade: 'rare', tier: 9, units: 's1', src: 'mdrop',
      mods: { wpRegen: 3, mpRegen: 3 },
      desc: '戦闘中、MPとWPが少しずつ戻る。' },
    // ---------------------------------------------------------------- monster supers (28)
    // jelly_1（1/256）· hpPct+10 regen ｜ Q: stat:agi-1u
    ac_sr_jelly_heart: { name: 'ぷるぷるの心', type: 'acc', grade: 'super', tier: 1, units: 'v1', src: 'super', exclusive: 'jelly_1', quirk: true,
      mods: { hpPct: 10, regen: true },
      statsAdd: { agi: -2 },
      desc: '最大HPが上がる。HPが戻る。\nただし素早さが下がる。' },
    // ghost_1（1/256）· encounterPct-25 sres:confuse40 ｜ Q: res:light1.5
    ac_sr_lost_lantern: { name: '迷い霊のランタン', type: 'acc', grade: 'super', tier: 1, units: 'm1', src: 'super', exclusive: 'ghost_1', quirk: true,
      mods: { encounterPct: -25, statusResist: { confuse: 0.4 }, /* クセ */ elemResist: { light: 1.5 } },
      desc: '魔物に出会いにくい。混乱にかかりにくい。\nただし光に弱くなる。' },
    // wisp_1（1/256）· boost:fire15 res:fire0.5 ｜ Q: res:water1.5
    ac_sr_ember_lamp: { name: '鬼火のカンテラ', type: 'acc', grade: 'super', tier: 1, units: 'm1', src: 'super', exclusive: 'wisp_1', quirk: true,
      mods: { elemBoost: { fire: 15 }, elemResist: { fire: 0.5, /* クセ */ water: 1.5 } },
      desc: '火の攻撃が強くなる。火に強い。\nただし水に弱くなる。' },
    // crystal_1（1/256）· boost:light15 mdef+4 ｜ Q: res:dark1.5
    ac_sr_quartz_shard: { name: '水晶のかけら', type: 'acc', grade: 'super', tier: 1, units: 'v1', src: 'super', exclusive: 'crystal_1', quirk: true,
      mods: { elemBoost: { light: 15 }, mdef: 4, /* クセ */ elemResist: { dark: 1.5 } },
      desc: '光の攻撃が強くなる。術防が上がる。\nただし闇に弱くなる。' },
    // eyeball_1（1/256）· preemptPct+10 hit+6 ｜ Q: res:light1.5
    ac_sr_peeping_eye: { name: 'のぞき目玉の護符', type: 'acc', grade: 'super', tier: 1, units: 'i1', src: 'super', exclusive: 'eyeball_1', quirk: true,
      mods: { preemptPct: 10, hit: 6, /* クセ */ elemResist: { light: 1.5 } },
      desc: '先制しやすくなる。よく当たる。\nただし光に弱くなる。' },
    // rat_2（1/256）· imm:poison glim:dagger20 ｜ Q: res:fire1.5
    ac_sr_plague_tail: { name: '毒ネズミのしっぽ', type: 'acc', grade: 'super', tier: 3, units: 's1', src: 'super', exclusive: 'rat_2', quirk: true,
      mods: { statusImmune: ['poison'], glimPct: { dagger: 20 }, /* クセ */ elemResist: { fire: 1.5 } },
      desc: '毒が効かない。短剣の技を閃きやすい。\nただし火に弱くなる。' },
    // paper_1（1/256）· glim:spell20 prof:fire25 ｜ Q: res:dark1.5
    ac_sr_first_letter: { name: '最初の一文字', type: 'acc', grade: 'super', tier: 3, units: 'm1', src: 'super', exclusive: 'paper_1', quirk: true,
      mods: { glimPct: { spell: 20 }, profPct: { fire: 25 }, /* クセ */ elemResist: { dark: 1.5 } },
      desc: '術を閃きやすい。火の熟練度が伸びやすい。\nただし闇に弱くなる。' },
    // snake_2（1/256）· encounterPct-25 escapePct+25 ｜ Q: stat:str-1u
    // The quirk lowers the race's main stat (獣 腕力), so the unit goes to the sub stat (素早さ), as §8.6.2 does when the
    // main stat does not fit: 素早さ+9 腕力−3 (on 腕力 itself it would read 腕力+6 under 「ただし腕力が下がる」).
    ac_sr_rattle_charm: { name: '鈴尾の根付け', type: 'acc', grade: 'super', tier: 3, units: 'a1', src: 'super', exclusive: 'snake_2', quirk: true,
      mods: { encounterPct: -25, escapePct: 25 },
      statsAdd: { str: -3 },
      desc: '魔物に出会いにくい。逃げやすくなる。\nただし腕力が下がる。' },
    // owl_2（1/256）· imm:sleep mpRegen+1 ｜ Q: stat:agi-1u
    // The quirk lowers the race's main stat (鳥 素早さ): the unit goes to the sub stat (器用さ) — 器用さ+9 素早さ−3.
    ac_sr_lullaby_quill: { name: '子守歌の羽根', type: 'acc', grade: 'super', tier: 3, units: 'd1', src: 'super', exclusive: 'owl_2', quirk: true,
      mods: { statusImmune: ['sleep'], mpRegen: 1 },
      statsAdd: { agi: -3 },
      desc: '眠りが効かない。MPが戻る。\nただし素早さが下がる。' },
    // skeleton_2（1/256）· goldPct+30 ｜ Q: hpPct-10 res:light1.5
    ac_sr_pirate_coin: { name: '呪われた金貨', type: 'acc', grade: 'super', tier: 3, units: 'i1', src: 'super', exclusive: 'skeleton_2', quirk: true,
      mods: { goldPct: 30, /* クセ */ hpPct: -10, elemResist: { light: 1.5 } },
      desc: '手に入るお金が増える。\nただし最大HPが下がる。光にも弱くなる。' },
    // imp_2（1/256）· boost:fire20 glim:fire20 ｜ Q: res:water1.5
    ac_sr_ember_horn: { name: '火の粉の角笛', type: 'acc', grade: 'super', tier: 3, units: 'i1', src: 'super', exclusive: 'imp_2', quirk: true,
      mods: { elemBoost: { fire: 20 }, glimPct: { fire: 20 }, /* クセ */ elemResist: { water: 1.5 } },
      desc: '火の攻撃が強くなる。火の術を閃きやすい。\nただし水に弱くなる。' },
    // seabird_3（1/256）· goldPct+30 dropPct+25 ｜ Q: res:wind1.5
    ac_sr_gull_loot: { name: 'カモメの宝袋', type: 'acc', grade: 'super', tier: 5, units: 'a1', src: 'super', exclusive: 'seabird_3', quirk: true,
      mods: { goldPct: 30, dropPct: 25, /* クセ */ elemResist: { wind: 1.5 } },
      desc: 'お金が増える。魔物が品を落としやすい。\nただし風に弱くなる。' },
    // mushroom_3（1/256）· imm:confuse glim:spell15 ｜ Q: mpCostPct+15
    ac_sr_dream_spore: { name: '夢見の胞子', type: 'acc', grade: 'super', tier: 5, units: 'm1', src: 'super', exclusive: 'mushroom_3', quirk: true,
      mods: { statusImmune: ['confuse'], glimPct: { spell: 15 }, /* クセ */ mpCostPct: 15 },
      desc: '混乱が効かない。術を閃きやすい。\nただし術のMPの消費が増える。' },
    // plant_3（1/256）· imm:poison boost:dark15 ｜ Q: hpPct-10
    ac_sr_poison_bloom: { name: '毒花のコサージュ', type: 'acc', grade: 'super', tier: 5, units: 'm1', src: 'super', exclusive: 'plant_3', quirk: true,
      mods: { statusImmune: ['poison'], elemBoost: { dark: 15 }, /* クセ */ hpPct: -10 },
      desc: '毒が効かない。闇の攻撃が強くなる。\nただし最大HPが下がる。' },
    // cactus_3（1/256）· regen sres:sleep50 ｜ Q: res:fire1.5
    ac_sr_desert_rose: { name: '砂漠のバラ', type: 'acc', grade: 'super', tier: 5, units: 'm1', src: 'super', exclusive: 'cactus_3', quirk: true,
      mods: { regen: true, statusResist: { sleep: 0.5 }, /* クセ */ elemResist: { fire: 1.5 } },
      desc: '戦闘中、HPが少しずつ戻る。\n眠りにかかりにくい。ただし火に弱くなる。' },
    // wisp_3（1/256）· mpRegen+2 glim:dark20 ｜ Q: hpPct-10
    ac_sr_soul_bead: { name: '人魂の玉', type: 'acc', grade: 'super', tier: 5, units: 'm1', src: 'super', exclusive: 'wisp_3', quirk: true,
      mods: { mpRegen: 2, glimPct: { dark: 20 }, /* クセ */ hpPct: -10 },
      desc: 'MPが戻る。闇の術を閃きやすい。\nただし最大HPが下がる。' },
    // mole_3（1/256）· itemPct+30 boost:fire15 ｜ Q: res:fire1.5
    ac_sr_blasting_cap: { name: '発破の火打ち石', type: 'acc', grade: 'super', tier: 5, units: 's1', src: 'super', exclusive: 'mole_3', quirk: true,
      mods: { itemPct: 30, elemBoost: { fire: 15 }, /* クセ */ elemResist: { fire: 1.5 } },
      desc: '回復の道具がよく効く。\n火の攻撃が強くなる。ただし火に弱くなる。' },
    // goblin_3（1/256）· itemPct+25 boost:fire20 ｜ Q: hpPct-10
    ac_sr_powder_pouch: { name: '火薬師の小袋', type: 'acc', grade: 'super', tier: 5, units: 'd1', src: 'super', exclusive: 'goblin_3', quirk: true,
      mods: { itemPct: 25, elemBoost: { fire: 20 }, /* クセ */ hpPct: -10 },
      desc: '回復の道具がよく効く。火が強くなる。\nただし最大HPが下がる。' },
    // eyeball_3（1/256）· imm:confuse glim:tech20 ｜ Q: hpPct-10
    ac_sr_mind_eye: { name: '心眼の玉', type: 'acc', grade: 'super', tier: 5, units: 'i1', src: 'super', exclusive: 'eyeball_3', quirk: true,
      mods: { statusImmune: ['confuse'], glimPct: { tech: 20 }, /* クセ */ hpPct: -10 },
      desc: '混乱が効かない。技を閃きやすい。\nただし最大HPが下がる。' },
    // automaton_3（1/256）· boost:wind20 mpRegen+1 ｜ Q: res:water1.5
    ac_sr_tesla_coil: { name: '雷のぜんまい', type: 'acc', grade: 'super', tier: 5, units: 'v1', src: 'super', exclusive: 'automaton_3', quirk: true,
      mods: { elemBoost: { wind: 20 }, mpRegen: 1, /* クセ */ elemResist: { water: 1.5 } },
      desc: '風の攻撃が強くなる。MPが戻る。\nただし水に弱くなる。' },
    // mimic_3（1/128）· superPct+30 ｜ Q: stat:agi-1u hpPct-10
    ac_sr_cursed_lock: { name: '呪いの錠前', type: 'acc', grade: 'super', tier: 5, units: 'v1', src: 'super', exclusive: 'mimic_3', quirk: true,
      mods: { superPct: 30, /* クセ */ hpPct: -10 },
      statsAdd: { agi: -4 },
      desc: '超レアの品を落としやすい。\nただし素早さが下がる。最大HPも下がる。' },
    // skeleton_4（1/256）· rareEncPct+30 escapePct+25 ｜ Q: res:light1.5
    ac_sr_ghost_compass: { name: '亡霊の羅針盤', type: 'acc', grade: 'super', tier: 7, units: 'i1', src: 'super', exclusive: 'skeleton_4', quirk: true,
      mods: { rareEncPct: 30, escapePct: 25, /* クセ */ elemResist: { light: 1.5 } },
      desc: 'めずらしい魔物に出会いやすい。\n逃げやすくなる。ただし光に弱くなる。' },
    // rat_4（1/256）· goldPct+30 stealPct+50 ｜ Q: hpPct-10
    ac_sr_rat_king_ring: { name: '頭領の指輪', type: 'acc', grade: 'super', tier: 8, units: 's1', src: 'super', exclusive: 'rat_4', quirk: true,
      mods: { goldPct: 30, stealPct: 50, /* クセ */ hpPct: -10 },
      desc: 'お金が増える。盗みが成功しやすい。\nただし最大HPが下がる。' },
    // fairy_4（1/256）· glim:light20 mpRegen+2 ｜ Q: res:dark1.5
    ac_sr_fairy_tiara: { name: '妖精姫のティアラ', type: 'acc', grade: 'super', tier: 8, units: 'i1', src: 'super', exclusive: 'fairy_4', quirk: true,
      mods: { glimPct: { light: 20 }, mpRegen: 2, /* クセ */ elemResist: { dark: 1.5 } },
      desc: '光の術を閃きやすい。MPが戻る。\nただし闇に弱くなる。' },
    // frog_4（1/256）· imm:stun sres:sleep50 ｜ Q: res:earth1.5
    ac_sr_frog_bell: { name: '鐘鳴りの首鈴', type: 'acc', grade: 'super', tier: 8, units: 'v1', src: 'super', exclusive: 'frog_4', quirk: true,
      mods: { statusImmune: ['stun'], statusResist: { sleep: 0.5 }, /* クセ */ elemResist: { earth: 1.5 } },
      desc: '気絶が効かない。眠りにかかりにくい。\nただし土に弱くなる。' },
    // crystal_4（1/256）· mpRegen+2 boost:dark20 ｜ Q: res:light1.5
    ac_sr_amethyst: { name: '紫水晶の耳飾り', type: 'acc', grade: 'super', tier: 8, units: 'v1', src: 'super', exclusive: 'crystal_4', quirk: true,
      mods: { mpRegen: 2, elemBoost: { dark: 20 }, /* クセ */ elemResist: { light: 1.5 } },
      desc: '戦闘中、MPが少しずつ戻る。\n闇の攻撃が強くなる。ただし光に弱くなる。' },
    // platinum_1（1/128）· expPct+20 glim:tech15 glim:spell15 ｜ Q: hpPct-15
    ac_sr_platinum_heart: { name: '白金の心', type: 'acc', grade: 'super', tier: 8, units: 'm1', src: 'super', exclusive: 'platinum_1', quirk: true,
      mods: { expPct: 20, glimPct: { tech: 15, spell: 15 }, /* クセ */ hpPct: -15 },
      desc: '経験値が増える。技と術を閃きやすい。\nただし最大HPが下がる。' },
    // demon_3（1/256）· boost:dark30 boost:fire20 mag+10 ｜ Q: res:light2 hpPct-10
    ac_sr_demon_eye: { name: '魔神の第三の眼', type: 'acc', grade: 'super', tier: 9, units: 'i1', src: 'super', exclusive: 'demon_3', quirk: true,
      mods: { elemBoost: { dark: 30, fire: 20 }, mag: 10, /* クセ */ elemResist: { light: 2 }, hpPct: -10 },
      desc: '闇・火の攻撃が強くなる。術力が上がる。\nただし光に弱くなる。最大HPも下がる。' },
    // ---------------------------------------------------------------- fixed-tier super of a rare monster (1)
    // → rm_bookworm（§8.7.2）
    ac_sr_scholar_monocle: { name: '物知りの片眼鏡', type: 'acc', grade: 'super', tier: 8, units: 'i1', src: 'super', exclusive: 'rm_bookworm', quirk: true,
      mods: { expPct: 20, glimPct: { spell: 20 } },
      statsAdd: { vit: -5 },
      desc: '経験値が増える。術を閃きやすい。\nただし体力が下がる。' },
  };

  // register now (ids must exist for other owners' load-time checks); numbers are filled in R.onData
  for (const id in ITEMS) {
    if (R.DB.items[id]) R.loadErrors.push('items_acc_monster: duplicate item id ' + id);
    R.DB.items[id] = ITEMS[id];
  }
  R.onData(() => {
    if (!R.GearA || !R.GearA.finish) { R.loadErrors.push('items_acc_monster: items_armor.js (R.GearA) did not load'); return; }
    R.GearA.finish(Object.keys(ITEMS), 'monster');
  });
})(window.RPG);
