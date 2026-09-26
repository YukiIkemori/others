// items_acc_relic.js — gear-a (A10a). Relics (42): 23 rare + 19 super.
// Numbers (def mdef eva stats price) are filled by R.Rules.fillItem in R.onData (DESIGN §8.2.9); the data
// only carries tier / grade / units / weight. Spec: DESIGN §8 (definitions) and §9.12 (monster → item).
(function (R) {
  'use strict';
  // Relics of the 23 rare monsters (DESIGN §8.7.1, names from §9.12.7): rare slot ac_rl_<key> (1/6), super slot
  // ac_rs_<key> (1/24; 夢食いバク 1/4 and 1/12). The four rare monsters of the fixed-tier zones have no ac_rs_ (their
  // super slot is a fixed-tier super, §8.7.2). Stats are percentages only (strPct …), so a relic keeps its value at
  // any tier; no def / mdef. Price 1500 / 3000. The key 'night' is not made (§8.7.1).
  const ITEMS = {
    // rm_aurora_bird（鍵 moon、レア枠 1/6）
    ac_rl_moon: { name: 'オーロラの羽飾り', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_aurora_bird', quirk: true,
      mods: { intPct: 10, mpRegen: 1, /* クセ */ defPct: -25 },
      price: 1500,
      desc: '知力が割合で上がる。MPが戻る。\nただし守備力が下がる。' },
    // rm_aurora_bird（鍵 moon、超レア枠 1/24）
    ac_rs_moon: { name: '極光の宝珠', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_aurora_bird', quirk: true,
      mods: { intPct: 15, mndPct: 15, mpRegen: 2, /* クセ */ elemResist: { dark: 1.5 } },
      price: 3000,
      desc: '知力と精神が上がる。MPが戻る。\nただし闇に弱い。' },
    // rm_lotus_sprite（鍵 sun、レア枠 1/6）
    ac_rl_sun: { name: 'はすの花飾り', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_lotus_sprite', quirk: true,
      mods: { mndPct: 10, healPct: 35, /* クセ */ elemResist: { dark: 1.25 } },
      price: 1500,
      desc: '精神が割合で上がる。回復の術がよく効く。\nただし闇に弱くなる。' },
    // rm_lotus_sprite（鍵 sun、超レア枠 1/24）
    ac_rs_sun: { name: '泥中の真珠', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_lotus_sprite', quirk: true,
      mods: { mndPct: 15, vitPct: 15, regen: true, /* クセ */ elemResist: { water: 1.5 } },
      price: 3000,
      desc: '精神と体力が上がる。HPが戻る。\nただし水に弱い。' },
    // rm_clock_bird（鍵 star、レア枠 1/6）
    ac_rl_star: { name: '歯車の羽根', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_clock_bird', quirk: true,
      mods: { dexPct: 10, glimPct: { tech: 15, /* クセ */ spell: -50 } },
      price: 1500,
      desc: '器用さが割合で上がる。技を閃きやすい。\nただし術を閃きにくい。' },
    // rm_clock_bird（鍵 star、超レア枠 1/24）
    ac_rs_star: { name: '止まらない歯車', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_clock_bird', quirk: true,
      mods: { dexPct: 15, intPct: 15, glimPct: { tech: 20, spell: 20 }, /* クセ */ goldPct: -50 },
      price: 3000,
      desc: '器用さと知力が上がる。閃きやすい。\nただしお金が減る。' },
    // rm_glass_moth（鍵 wind、レア枠 1/6）
    ac_rl_wind: { name: 'ガラスの羽', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_glass_moth', quirk: true,
      mods: { agiPct: 10, spd: 15, /* クセ */ encounterPct: 50 },
      price: 1500,
      desc: '素早さが割合で上がる。すばやく動ける。\nただし魔物を呼ぶ。' },
    // rm_glass_moth（鍵 wind、超レア枠 1/24）
    ac_rs_wind: { name: 'ステンドの羽', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_glass_moth', quirk: true,
      mods: { agiPct: 15, dexPct: 15, eva: 15, /* クセ */ takenPct: 25 },
      price: 3000,
      desc: '素早さと器用さが上がる。かわしやすい。\nただし受ける傷が増える。' },
    // rm_ghost_teapot（鍵 tide、レア枠 1/6）
    ac_rl_tide: { name: '幽霊のティーカップ', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_ghost_teapot', quirk: true,
      mods: { vitPct: 10, elemResist: { water: 0.5, /* クセ */ fire: 1.25 } },
      price: 1500,
      desc: '体力が割合で上がる。水に強い。\nただし火に弱くなる。' },
    // rm_ghost_teapot（鍵 tide、超レア枠 1/24）
    ac_rs_tide: { name: '茶器のふた', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_ghost_teapot', quirk: true,
      mods: { vitPct: 15, mndPct: 15, elemResist: { water: -1, /* クセ */ earth: 1.5 } },
      price: 3000,
      desc: '体力と精神が割合で上がる。\n水の攻撃を吸い取る。ただし土に弱くなる。' },
    // rm_volcano_turtle（鍵 ember、レア枠 1/6）
    ac_rl_ember: { name: '火山ガメの甲羅片', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_volcano_turtle', quirk: true,
      mods: { strPct: 10, elemBoost: { fire: 20 }, /* クセ */ elemResist: { water: 1.25 } },
      price: 1500,
      desc: '腕力が割合で上がる。火の攻撃が強くなる。\nただし水に弱くなる。' },
    // rm_volcano_turtle（鍵 ember、超レア枠 1/24）
    ac_rs_ember: { name: '火山ガメの心石', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_volcano_turtle', quirk: true,
      mods: { strPct: 15, intPct: 15, elemBoost: { fire: 30 }, /* クセ */ elemResist: { water: 1.5 } },
      price: 3000,
      desc: '腕力と知力が割合で上がる。\n火の攻撃が強くなる。ただし水に弱くなる。' },
    // rm_icetail_fox（鍵 frost、レア枠 1/6）
    ac_rl_frost: { name: '氷尾の毛飾り', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_icetail_fox', quirk: true,
      mods: { intPct: 10, statusImmune: ['freeze'], /* クセ */ elemResist: { fire: 1.25 } },
      price: 1500,
      desc: '知力が割合で上がる。凍結が効かない。\nただし火に弱くなる。' },
    // rm_icetail_fox（鍵 frost、超レア枠 1/24）
    ac_rs_frost: { name: '氷ギツネの面', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_icetail_fox', quirk: true,
      mods: { intPct: 15, agiPct: 15, elemBoost: { water: 30 }, /* クセ */ elemResist: { fire: 1.5 } },
      price: 3000,
      desc: '知力と素早さが割合で上がる。\n水の攻撃が強くなる。ただし火に弱くなる。' },
    // rm_bloom_fawn（鍵 bloom、レア枠 1/6）
    ac_rl_bloom: { name: '花角の髪飾り', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_bloom_fawn', quirk: true,
      mods: { mndPct: 10, regen: true, /* クセ */ elemResist: { fire: 1.25 } },
      price: 1500,
      desc: '精神が割合で上がる。HPが戻る。\nただし火に弱くなる。' },
    // rm_bloom_fawn（鍵 bloom、超レア枠 1/24）
    ac_rs_bloom: { name: '森の小さな冠', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_bloom_fawn', quirk: true,
      mods: { mndPct: 15, hpPct: 20, regen: true, /* クセ */ encounterPct: 50 },
      price: 3000,
      desc: '精神が割合で上がる。最大HPが上がる。\nHPが戻る。ただし魔物を呼ぶ。' },
    // rm_gem_hedgehog（鍵 thorn、レア枠 1/6）
    ac_rl_thorn: { name: '宝石針のブローチ', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_gem_hedgehog', quirk: true,
      mods: { strPct: 10, crit: 10, /* クセ */ mdefPct: -25 },
      price: 1500,
      desc: '腕力が割合で上がる。会心が出やすい。\nただし術防が下がる。' },
    // rm_gem_hedgehog（鍵 thorn、超レア枠 1/24）
    ac_rs_thorn: { name: '宝石ハリネズミの冠', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_gem_hedgehog', quirk: true,
      mods: { strPct: 15, dexPct: 15, autoCounter: 0.25, /* クセ */ hpLoss: 3 },
      price: 3000,
      desc: '腕力と器用さが上がる。反撃する。\nただしHPが減っていく。' },
    // rm_dream_tapir（鍵 shadow、レア枠 1/4）
    ac_rl_shadow: { name: '夢見のまくら', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_dream_tapir', quirk: true,
      mods: { agiPct: 10, encounterPct: -50, /* クセ */ elemResist: { light: 1.25 } },
      price: 1500,
      desc: '素早さが割合で上がる。\n魔物に出会いにくい。ただし光に弱くなる。' },
    // rm_gold_idol（鍵 gold、レア枠 1/6）
    ac_rl_gold: { name: '守護像のひすい', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_gold_idol', quirk: true,
      mods: { goldPct: 20, goldenPct: 20, /* クセ */ expPct: -25 },
      price: 1500,
      desc: 'お金が増える。金色の魔物に出会いやすい。\nただし経験値が減る。' },
    // rm_gold_idol（鍵 gold、超レア枠 1/24）
    ac_rs_gold: { name: '黄金の光輪', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_gold_idol', quirk: true,
      mods: { strPct: 15, goldPct: 30, goldenPct: 30, /* クセ */ expPct: -50 },
      price: 3000,
      desc: '腕力が割合で上がる。お金が増える。\n金色に出会いやすい。ただし経験値が減る。' },
    // rm_treasure_crab（鍵 clover、レア枠 1/6）
    ac_rl_clover: { name: '海賊の杯', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_treasure_crab', quirk: true,
      mods: { dexPct: 10, rarePct: 20, /* クセ */ goldPct: -25 },
      price: 1500,
      desc: '器用さが割合で上がる。\nレアをよく落とす。ただしお金が減る。' },
    // rm_treasure_crab（鍵 clover、超レア枠 1/24）
    ac_rs_clover: { name: '財宝の地図', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_treasure_crab', quirk: true,
      mods: { rarePct: 30, superPct: 30, /* クセ */ hpPct: -20 },
      price: 3000,
      desc: 'レアをよく落とす。超レアをよく落とす。\nただし最大HPが下がる。' },
    // rm_bookworm（鍵 sage、レア枠 1/6）
    ac_rl_sage: { name: '本の虫の眼鏡', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_bookworm', quirk: true,
      mods: { intPct: 10, expPct: 15, /* クセ */ goldPct: -25 },
      price: 1500,
      desc: '知力が割合で上がる。経験値が増える。\nただしお金が減る。' },
    // rm_diamond_lizard（鍵 iron、レア枠 1/6）
    ac_rl_iron: { name: '金剛トカゲのうろこ', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_diamond_lizard', quirk: true,
      mods: { vitPct: 10, statusImmune: ['stun'], /* クセ */ spd: -15 },
      price: 1500,
      desc: '体力が割合で上がる。気絶が効かない。\nただし動きが遅くなる。' },
    // rm_diamond_lizard（鍵 iron、超レア枠 1/24）
    ac_rs_iron: { name: '金剛トカゲの心臓石', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_diamond_lizard', quirk: true,
      mods: { vitPct: 15, strPct: 15, defPct: 25, /* クセ */ spd: -30 },
      price: 3000,
      desc: '体力と腕力が割合で上がる。\n守備力が上がる。ただし動きが遅くなる。' },
    // rm_memory_fish（鍵 spirit、レア枠 1/6）
    ac_rl_spirit: { name: '金魚のうろこ', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_memory_fish', quirk: true,
      mods: { mndPct: 10, statusImmune: ['death'], /* クセ */ takenPct: 15 },
      price: 1500,
      desc: '精神が割合で上がる。即死が効かない。\nただし受けるダメージが増える。' },
    // rm_spa_monkey（鍵 beast、レア枠 1/6）
    ac_rl_beast: { name: '湯けむりの手ぬぐい', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_spa_monkey', quirk: true,
      mods: { strPct: 10, physPct: 15, /* クセ */ mdefPct: -25 },
      price: 1500,
      desc: '腕力が割合で上がる。物理が強くなる。\nただし術防が下がる。' },
    // rm_spa_monkey（鍵 beast、超レア枠 1/24）
    ac_rs_beast: { name: '猿の湯おけ', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_spa_monkey', quirk: true,
      mods: { strPct: 15, agiPct: 15, physPct: 25, /* クセ */ mdefPct: -50 },
      price: 3000,
      desc: '腕力と素早さが上がる。物理が強くなる。\nただし術防が下がる。' },
    // rm_jewel_hare（鍵 bird、レア枠 1/6）
    ac_rl_bird: { name: '宝石ウサギのお守り', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_jewel_hare', quirk: true,
      mods: { agiPct: 10, escapePct: 50, /* クセ */ hpPct: -10 },
      price: 1500,
      desc: '素早さが割合で上がる。逃げやすくなる。\nただし最大HPが下がる。' },
    // rm_jewel_hare（鍵 bird、超レア枠 1/24）
    ac_rs_bird: { name: 'うさぎの月長石', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_jewel_hare', quirk: true,
      mods: { agiPct: 15, dexPct: 15, spd: 30, /* クセ */ elemResist: { wind: 1.5 } },
      price: 3000,
      desc: '素早さと器用さが割合で上がる。\nすばやく動ける。ただし風に弱くなる。' },
    // rm_moon_sheep（鍵 dream、レア枠 1/6）
    ac_rl_dream: { name: '月見の鈴', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_moon_sheep', quirk: true,
      mods: { mndPct: 10, statusImmune: ['sleep'], /* クセ */ statusResist: { confuse: -0.25 } },
      price: 1500,
      desc: '精神が割合で上がる。眠りが効かない。\nただし混乱に弱い。' },
    // rm_moon_sheep（鍵 dream、超レア枠 1/24）
    ac_rs_dream: { name: '三日月の角', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_moon_sheep', quirk: true,
      mods: { intPct: 15, mndPct: 15, statusImmune: ['sleep', 'confuse'], /* クセ */ spd: -30 },
      price: 3000,
      desc: '知力と精神が上がる。\n眠り・混乱が効かない。ただし遅くなる。' },
    // rm_bell_snail（鍵 bell、レア枠 1/6）
    ac_rl_bell: { name: '鐘の殻', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_bell_snail', quirk: true,
      mods: { mndPct: 10, statusResist: { silence: 0.5, confuse: 0.5, /* クセ */ sleep: -0.25 } },
      price: 1500,
      desc: '沈黙・混乱にかかりにくい。\n精神が割合で上がる。ただし眠りに弱い。' },
    // rm_bell_snail（鍵 bell、超レア枠 1/24）
    ac_rs_bell: { name: '七つ鐘の首飾り', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_bell_snail', quirk: true,
      mods: { mndPct: 15, vitPct: 15, startBuffs: { def: 1, mdef: 1 }, /* クセ */ goldPct: -50 },
      price: 3000,
      desc: '精神と体力が上がる。始めに守りが上がる。\nただしお金が減る。' },
    // rm_prisma（鍵 prism、レア枠 1/6）
    ac_rl_prism: { name: '虹晶の指輪', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_prisma', quirk: true,
      mods: { intPct: 10, magicPct: 15, /* クセ */ defPct: -25 },
      price: 1500,
      desc: '知力が割合で上がる。術の威力が上がる。\nただし守備力が下がる。' },
    // rm_prisma（鍵 prism、超レア枠 1/24）
    ac_rs_prism: { name: '虹晶の心', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_prisma', quirk: true,
      mods: { intPct: 15, dexPct: 15, magicPct: 15, physPct: 15, /* クセ */ takenPct: 25 },
      price: 3000,
      desc: '知力と器用さが上がる。術が強くなる。\n物理が強くなる。ただし受ける傷が増える。' },
    // rm_star_whale（鍵 sea、レア枠 1/6）
    ac_rl_sea: { name: '星の香玉', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_star_whale', quirk: true,
      mods: { vitPct: 10, hpPct: 10, /* クセ */ elemResist: { wind: 1.25 } },
      price: 1500,
      desc: '体力が割合で上がる。最大HPが上がる。\nただし風に弱くなる。' },
    // rm_star_whale（鍵 sea、超レア枠 1/24）
    ac_rs_sea: { name: '空くじらの歌貝', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_star_whale', quirk: true,
      mods: { vitPct: 20, hpPct: 20, /* クセ */ spd: -30 },
      price: 3000,
      desc: '体力が割合で上がる。最大HPが上がる。\nただし動きが遅くなる。' },
    // rm_acorn_prince（鍵 peak、レア枠 1/6）
    ac_rl_peak: { name: 'どんぐりの帽子飾り', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_acorn_prince', quirk: true,
      mods: { vitPct: 10, mpRegen: 1, /* クセ */ mpCostPct: 25 },
      price: 1500,
      desc: '体力が割合で上がる。MPが戻る。\nただし術のMPの消費が増える。' },
    // rm_acorn_prince（鍵 peak、超レア枠 1/24）
    ac_rs_peak: { name: 'どんぐり王子の紋章', type: 'acc', grade: 'super', tier: 0, src: 'relic', exclusive: 'rm_acorn_prince', quirk: true,
      mods: { vitPct: 15, strPct: 15, mpRegen: 2, /* クセ */ eva: -20 },
      price: 3000,
      desc: '体力と腕力が上がる。MPが戻る。\nただしかわしにくい。' },
    // rm_golden_quill（鍵 tale、レア枠 1/6）
    ac_rl_tale: { name: '黄金のペン先', type: 'acc', grade: 'rare', tier: 0, src: 'relic', exclusive: 'rm_golden_quill', quirk: true,
      mods: { mndPct: 10, glimPct: { spell: 15, /* クセ */ tech: -50 } },
      price: 1500,
      desc: '精神が割合で上がる。術を閃きやすい。\nただし技を閃きにくい。' },
  };

  // register now (ids must exist for other owners' load-time checks); numbers are filled in R.onData
  for (const id in ITEMS) {
    if (R.DB.items[id]) R.loadErrors.push('items_acc_relic: duplicate item id ' + id);
    R.DB.items[id] = ITEMS[id];
  }
  R.onData(() => {
    if (!R.GearA || !R.GearA.finish) { R.loadErrors.push('items_acc_relic: items_armor.js (R.GearA) did not load'); return; }
    R.GearA.finish(Object.keys(ITEMS), 'relic');
  });
})(window.RPG);
