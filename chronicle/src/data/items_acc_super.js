// items_acc_super.js — gear-a (A10a). Hand-made accessory supers (12).
// Numbers (def mdef eva stats price) are filled by R.Rules.fillItem in R.onData (DESIGN §8.2.9); the data
// only carries tier / grade / units / weight. Spec: DESIGN §8 (definitions) and §9.12 (monster → item).
(function (R) {
  'use strict';
  // Hand-made supers (DESIGN §8.6.5): one-of-a-kind, only in exactly one monster's super slot (exclusive).
  // Stats ×3, 1–3 special effects and a strong quirk (§8.3.6). The T8 sets give 知力 / 腕力 / 器用さ builds all
  // nine positions (weapons 1 and 2 are weapons' items_weapons_super.js); per set physPct+magicPct ≤ 30, mag ≤ 16.
  const ITEMS = {
    // ---------------------------------------------------------------- 知力の一式（T8。超レア枠 1/128）
    // → owl_4
    ac_sr_owl: { name: 'ふくろうの瞳', type: 'acc', grade: 'super', tier: 8, units: 'i1', src: 'super', exclusive: 'owl_4', quirk: true,
      mods: { statusImmune: ['sleep', 'confuse', 'silence'], /* クセ */ expPct: -50 },
      desc: '眠り・混乱・沈黙が効かない。\nただし経験値が減る。' },
    // → scribe_1
    ac_sr_ink: { name: '千夜の墨つぼ', type: 'acc', grade: 'super', tier: 8, units: 'i1', src: 'super', exclusive: 'scribe_1', quirk: true,
      mods: { magicPct: 15, /* クセ */ elemResist: { earth: 1.5 } },
      desc: '術の威力が上がる。ただし土に弱くなる。' },
    // ---------------------------------------------------------------- 腕力の一式（T8。1/128）
    // → wolf_5
    ac_sr_beastheart: { name: '獣王の心臓', type: 'acc', grade: 'super', tier: 8, units: 's1', src: 'super', exclusive: 'wolf_5', quirk: true,
      mods: { autoRevive: 0.3, /* クセ */ hpPct: -20 },
      desc: '倒れても一度だけ起き上がる。\nただし最大HPが下がる。' },
    // → demon_1
    ac_sr_bloodoath: { name: '血の誓約', type: 'acc', grade: 'super', tier: 8, units: 's1', src: 'super', exclusive: 'demon_1', quirk: true,
      mods: { physPct: 15, /* クセ */ hpLoss: 5 },
      desc: '物理攻撃の威力が上がる。\nただし戦闘中にHPが減る。' },
    // ---------------------------------------------------------------- 器用さの一式（T8。1/128）
    // → wyvern_3
    ac_sr_eagle: { name: '大鷲の羽根', type: 'acc', grade: 'super', tier: 8, units: 'd1', src: 'super', exclusive: 'wyvern_3', quirk: true,
      mods: { glimPct: { tech: 20 }, /* クセ */ goldPct: -50 },
      desc: '技を閃きやすい。ただし得るお金が減る。' },
    // → scribe_3
    ac_sr_needle: { name: '星の縫い針', type: 'acc', grade: 'super', tier: 8, units: 'd1', src: 'super', exclusive: 'scribe_3', quirk: true,
      mods: { crit: 10, hit: 10, /* クセ */ statusResist: { confuse: -0.5 } },
      desc: '会心が出やすい。よく当たる。\nただし混乱に弱い。' },
    // ---------------------------------------------------------------- クセの強い名品
    // → mimic_1
    ac_sr_greedy: { name: '欲張りの首飾り', type: 'acc', grade: 'super', tier: 1, units: 'a1', src: 'super', exclusive: 'mimic_1', quirk: true,
      mods: { dropPct: 30, rarePct: 30, /* クセ */ hpPct: -30 },
      desc: 'アイテムをよく落とす。レアをよく落とす。\nただし最大HPが下がる。' },
    // → darkmage_1
    ac_sr_scholar: { name: '学者の眼鏡', type: 'acc', grade: 'super', tier: 1, units: 'i1', src: 'super', exclusive: 'darkmage_1', quirk: true,
      mods: { expPct: 20, glimPct: { spell: 20 }, /* クセ */ goldPct: -50 },
      desc: '経験値が増える。術を閃きやすい。\nただし得るお金が減る。' },
    // → frostling_2
    ac_sr_glass: { name: '薄氷の指輪', type: 'acc', grade: 'super', tier: 3, units: 'i1', src: 'super', exclusive: 'frostling_2', quirk: true,
      mods: { magicPct: 25, physPct: 25, /* クセ */ takenPct: 30 },
      desc: '術が強くなる。物理が強くなる。\nただし受ける傷が増える。' },
    // → skeleton_3
    ac_sr_firebird: { name: '再起の羽根', type: 'acc', grade: 'super', tier: 5, units: 'a1', src: 'super', exclusive: 'skeleton_3', quirk: true,
      mods: { autoRevive: 0.3, /* クセ */ expPct: -50 },
      desc: '倒れても一度だけ起き上がる。\nただし経験値が減る。' },
    // → mimic_4
    ac_sr_coin: { name: '福音の金貨', type: 'acc', grade: 'super', tier: 8, units: 'm1', src: 'super', exclusive: 'mimic_4', quirk: true,
      mods: { superPct: 30, rarePct: 30, /* クセ */ takenPct: 25 },
      desc: '超レアをよく落とす。レアをよく落とす。\nただし受ける傷が増える。' },
    // ---------------------------------------------------------------- クリア後（T9）
    // → b_ouroboros
    ac_sr_ouroboros: { name: '円環の指輪', type: 'acc', grade: 'super', tier: 9, units: 'm1', src: 'super', exclusive: 'b_ouroboros', quirk: true,
      mods: { glimPct: { tech: 25, spell: 25 }, mpRegen: 3, /* クセ */ expPct: -100 },
      desc: '閃きやすい。MPが戻る。\nただし経験値が入らない。' },
  };

  // register now (ids must exist for other owners' load-time checks); numbers are filled in R.onData
  for (const id in ITEMS) {
    if (R.DB.items[id]) R.loadErrors.push('items_acc_super: duplicate item id ' + id);
    R.DB.items[id] = ITEMS[id];
  }
  R.onData(() => {
    if (!R.GearA || !R.GearA.finish) { R.loadErrors.push('items_acc_super: items_armor.js (R.GearA) did not load'); return; }
    R.GearA.finish(Object.keys(ITEMS), 'super');
  });
})(window.RPG);
