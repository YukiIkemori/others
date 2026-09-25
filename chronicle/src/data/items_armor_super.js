// items_armor_super.js — gear-a (A10a). Hand-made armor supers (19).
// Numbers (def mdef eva stats price) are filled by R.Rules.fillItem in R.onData (DESIGN §8.2.9); the data
// only carries tier / grade / units / weight. Spec: DESIGN §8 (definitions) and §9.12 (monster → item).
(function (R) {
  'use strict';
  // Hand-made supers (DESIGN §8.6.5): one-of-a-kind, only in exactly one monster's super slot (exclusive).
  // Stats ×3, 1–3 special effects and a strong quirk (§8.3.6). The T8 sets give 知力 / 腕力 / 器用さ builds all
  // nine positions (weapons 1 and 2 are weapons' items_weapons_super.js); per set physPct+magicPct ≤ 30, mag ≤ 16.
  const ITEMS = {
    // ---------------------------------------------------------------- 知力の一式（T8。超レア枠 1/128）
    // → book_1
    sh_sr_blank: { name: '白紙の魔導書', type: 'shield', weight: 'cloth', grade: 'super', tier: 8, units: 'i1', src: 'super', exclusive: 'book_1', quirk: true,
      mods: { magicPct: 15, /* クセ */ mdefPct: -50 },
      desc: '術の威力が上がる。ただし術防が下がる。' },
    // → imp_5
    hd_sr_dusk: { name: '宵闇の冠', type: 'head', weight: 'cloth', grade: 'super', tier: 8, units: 'i1', src: 'super', exclusive: 'imp_5', quirk: true,
      mods: { glimPct: { spell: 20 }, /* クセ */ elemResist: { light: 1.5 } },
      desc: '術を閃きやすい。ただし光に弱くなる。' },
    // → ghost_5
    bd_sr_starry: { name: '星空の衣', type: 'body', weight: 'cloth', grade: 'super', tier: 8, units: 'i2', src: 'super', exclusive: 'ghost_5', quirk: true,
      mods: { mpRegen: 2, elemResist: { dark: 0 } },
      def: 0, mdef: 0,           // クセ: 守備と術防が 0（§8.3.6）
      desc: 'MPが戻る。闇が効かない。\nただし守備と術防は0。' },
    // → scribe_2
    hn_sr_words: { name: '言の葉の長手袋', type: 'hands', weight: 'cloth', grade: 'super', tier: 8, units: 'i1', src: 'super', exclusive: 'scribe_2',
      quirk: true,
      mods: { mpPct: 25, /* クセ */ hpPct: -20 },
      desc: '最大MPが上がる。ただし最大HPが下がる。' },
    // → frostling_5
    ft_sr_cloud: { name: '雲上の布靴', type: 'feet', weight: 'cloth', grade: 'super', tier: 8, units: 'i1', src: 'super', exclusive: 'frostling_5',
      quirk: true,
      mods: { spd: 30, /* クセ */ takenPct: 25 },
      desc: 'すばやく動ける。\nただし受けるダメージが増える。' },
    // ---------------------------------------------------------------- 腕力の一式（T8。1/128）
    // → armor_4
    sh_sr_steadfast: { name: '不動の小盾', type: 'shield', weight: 'heavy', grade: 'super', tier: 8, units: 's1', src: 'super', exclusive: 'armor_4',
      quirk: true,
      mods: { autoCounter: 0.25, /* クセ */ spd: -30 },
      desc: '攻撃を受けると反撃する。\nただし動きが遅くなる。' },
    // → orc_3
    hd_sr_oni: { name: '鬼角の兜', type: 'head', weight: 'heavy', grade: 'super', tier: 8, units: 's1', src: 'super', exclusive: 'orc_3', quirk: true,
      mods: { startBuffs: { atk: 1 }, /* クセ */ noSpell: true },
      desc: '戦闘の始めに攻撃が上がる。\nただし術が使えない。' },
    // → salamander_5
    bd_sr_dragonhide: { name: '火竜の鎧', type: 'body', weight: 'heavy', grade: 'super', tier: 8, units: 's2', src: 'super', exclusive: 'salamander_5',
      quirk: true,
      mods: { elemResist: { fire: -1, /* クセ */ water: 1.5 }, hpPct: 20 },
      desc: '火の攻撃を吸い取る。最大HPが上がる。\nただし水に弱くなる。' },
    // → yeti_3
    hn_sr_mighty: { name: '剛腕の籠手', type: 'hands', weight: 'heavy', grade: 'super', tier: 8, units: 's1', src: 'super', exclusive: 'yeti_3', quirk: true,
      mods: { crit: 15, /* クセ */ mdefPct: -50 },
      desc: '会心が出やすい。ただし術防が下がる。' },
    // → mammoth_3
    ft_sr_quake: { name: '地響きのグリーブ', type: 'feet', weight: 'heavy', grade: 'super', tier: 8, units: 's1', src: 'super', exclusive: 'mammoth_3',
      quirk: true,
      mods: { hpPct: 20, startBuffs: { def: 1 }, /* クセ */ eva: -20 },
      desc: '最大HPが上がる。始めに守りが上がる。\nただしかわしにくい。' },
    // ---------------------------------------------------------------- 器用さの一式（T8。1/128）
    // → jelly_5
    sh_sr_phantom: { name: '幻影の盾', type: 'shield', weight: 'light', grade: 'super', tier: 8, units: 'd1', src: 'super', exclusive: 'jelly_5',
      quirk: true,
      mods: { eva: 15, /* クセ */ hpPct: -20 },
      desc: '攻撃をかわしやすい。\nただし最大HPが下がる。' },
    // → eyeball_5
    hd_sr_heaveneye: { name: '天眼の帽子', type: 'head', weight: 'light', grade: 'super', tier: 8, units: 'd1', src: 'super', exclusive: 'eyeball_5',
      quirk: true,
      mods: { hit: 15, crit: 10, /* クセ */ mdefPct: -50 },
      desc: 'よく当たる。会心が出やすい。\nただし術防が下がる。' },
    // → mummy_5
    bd_sr_shadow: { name: '影法師の装束', type: 'body', weight: 'light', grade: 'super', tier: 8, units: 'd2', src: 'super', exclusive: 'mummy_5', quirk: true,
      mods: { eva: 15, /* クセ */ defPct: -50 },
      desc: '攻撃をかわしやすい。\nただし守備力が下がる。' },
    // → scorpion_5
    hn_sr_hundred: { name: '百発の手袋', type: 'hands', weight: 'light', grade: 'super', tier: 8, units: 'd1', src: 'super', exclusive: 'scorpion_5',
      quirk: true,
      mods: { crit: 15, /* クセ */ wpCostPct: 50 },
      desc: '会心が出やすい。\nただし技のWPの消費が増える。' },
    // → bee_5
    ft_sr_whirl: { name: '旋風のブーツ', type: 'feet', weight: 'light', grade: 'super', tier: 8, units: 'd1', src: 'super', exclusive: 'bee_5', quirk: true,
      mods: { spd: 30, preemptPct: 10, /* クセ */ encounterPct: 50 },
      desc: 'すばやく動ける。先制しやすくなる。\nただし魔物に出会いやすい。' },
    // ---------------------------------------------------------------- クセの強い名品
    // → salamander_3
    bd_sr_salamander: { name: '火とかげの法衣', type: 'body', weight: 'cloth', grade: 'super', tier: 5, units: 'i2', src: 'super', exclusive: 'salamander_3',
      quirk: true,
      mods: { elemResist: { fire: -1, /* クセ */ water: 1.5 }, elemBoost: { fire: 30 } },
      desc: '火の攻撃を吸い取る。火の攻撃が強くなる。\nただし水に弱くなる。' },
    // → orc_2
    hd_sr_berserk: { name: '狂戦士の面', type: 'head', weight: 'heavy', grade: 'super', tier: 5, units: 's1', src: 'super', exclusive: 'orc_2', quirk: true,
      mods: { physPct: 25, /* クセ */ noSpell: true },
      desc: '物理攻撃の威力が上がる。\nただし術が使えない。' },
    // → ghost_4
    ft_sr_ghost: { name: '亡霊の足音', type: 'feet', weight: 'light', grade: 'super', tier: 7, units: 'a1', src: 'super', exclusive: 'ghost_4', quirk: true,
      mods: { eva: 15, encounterPct: -50, /* クセ */ statusResist: { death: -0.5 } },
      desc: '攻撃をかわしやすい。魔物に出会いにくい。\nただし即死に弱い。' },
    // ---------------------------------------------------------------- クリア後（T9）
    // → void_2
    bd_sr_oblivion: { name: '忘却のローブ', type: 'body', weight: 'cloth', grade: 'super', tier: 9, units: 'i2', src: 'super', exclusive: 'void_2',
      quirk: true,
      mods: { statusImmune: ['sleep', 'confuse', 'silence'], mpRegen: 2, /* クセ */ hpPct: -20 },
      desc: '眠り・混乱・沈黙が効かない。MPが戻る。\nただし最大HPが下がる。' },
  };

  // register now (ids must exist for other owners' load-time checks); numbers are filled in R.onData
  for (const id in ITEMS) {
    if (R.DB.items[id]) R.loadErrors.push('items_armor_super: duplicate item id ' + id);
    R.DB.items[id] = ITEMS[id];
  }
  R.onData(() => {
    if (!R.GearA || !R.GearA.finish) { R.loadErrors.push('items_armor_super: items_armor.js (R.GearA) did not load'); return; }
    R.GearA.finish(Object.keys(ITEMS), 'super');
  });
})(window.RPG);
