// Rare monsters (レアモンスター): one per region, met in ≈1.5 % of that region's
// random battles (R.DB.rareEncounters, rolled by the battle system, which also plays
// the rare flash + 'rare' jingle and starts the fight in manual mode). Each has its
// own sprite (mon:<id>), flees easily, pays several times a normal monster of its
// level and is the only source of one exclusive item (ids rx_*, rare drop 1/64–1/128,
// also its rare steal). Checked by tools/check_rare.js (references + battle sim).
//
// Stats use the same level curve as monsters.js (inlined: data files never depend
// on each other) × per-monster multipliers; rewards are multiples of the regular
// monster of the same level: EXP ×≈6, gold ×≈8, JP ×≈5.
(function (R) {
  'use strict';

  // ------------------------------------------------------------ curve (= monsters.js)
  const expFor = (L) => (L <= 1 ? 0 : 8 * Math.pow(L - 1, 2.6) + 10 * (L - 1));
  const late = (L) => { const t = Math.min(1, Math.max(0, (L - 16) / 14)); return t * t * (3 - 2 * t); };
  const curve = (L) => ({
    hp: (7 + 5 * L + 0.28 * L * L) * (1 + 0.15 * late(L)),
    atk: (10 + 3.8 * L) * (1 + 0.12 * late(L)),
    def: 1 + 2.1 * L,
    mdef: L,
    agi: 4 + 1.8 * L,
    mag: 5 + 2.4 * L,
    exp: ((expFor(L + 2.5) - expFor(L + 1.5)) / 14.4) * Math.exp(0.1 - 2 * (L / 40) + 1.8 * (L / 40) * (L / 40)),
    jp: 5 + 1.15 * L,
    gold: 6 + 8 * L + 0.3 * L * L,
  });
  // 64 px sprites count as large monsters (monsters.js SZ.l)
  const LARGE = { hp: 2, atk: 1.15, def: 1.1, rw: 1.8, jp: 1.6 };
  const MEDIUM = { hp: 1, atk: 1, def: 1, rw: 1, jp: 1 };
  const nice = (n) => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);

  /**
   * lv, o: s:{hp,atk,def,mdef,agi,mag} multipliers · x:{exp,gold,jp} reward multipliers
   * (vs a regular monster of the same level and size) · everything else is copied.
   */
  function rareMon(id, name, lv, o) {
    const c = curve(lv), sz = o.large ? LARGE : MEDIUM, s = o.s || {};
    const k = (key) => (s[key] != null ? s[key] : 1);
    const d = {
      name, sprite: id, lv,
      hp: Math.round(c.hp * sz.hp * k('hp')),
      mp: o.mp || 0,
      atk: Math.round(c.atk * sz.atk * k('atk')),
      def: Math.round(c.def * sz.def * k('def')),
      agi: Math.round(c.agi * k('agi')),
      mag: Math.round(c.mag * k('mag')),
      mdef: Math.round(c.mdef * k('mdef')),
      exp: nice(c.exp * sz.rw * o.x.exp),
      gold: nice(c.gold * sz.rw * o.x.gold),
      jp: nice(c.jp * sz.jp * o.x.jp),
      actions: o.a.map(([aid, w, cond]) => (cond ? { id: aid, w, cond } : { id: aid, w })),
    };
    for (const key of ['eva', 'elem', 'statusRes', 'flags', 'fleeRate', 'attackFx', 'appear', 'desc']) if (o[key] != null) d[key] = o[key];
    d.drop = { item: o.drop[0], rate: o.drop[1] };
    d.rare = { item: o.rare[0], rate: o.rare[1] };
    d.steal = { item: o.steal[0], rare: o.steal[1] };
    return d;
  }

  // rare monsters shrug off instant death; sleep/paralysis (which stop them from
  // running away) land about half as often as on a normal monster
  const RARE_RES = { death: 1, sleep: 0.5, paralyze: 0.5, confuse: 0.5 };

  // ------------------------------------------------------------ exclusive items
  // One per rare monster, never sold (price 0), never in chests or other monsters'
  // pools. `band` as in items.js; `exclusive` = the monster that carries it.
  const EX = { rare: true, price: 0 };
  Object.assign(R.DB.items, {
    rx_rabbit_charm: Object.assign({
      name: '宝石ウサギのお守り', type: 'acc', band: 2, sort: 1001, exclusive: 'rare_hare',
      desc: '宝石ウサギの額の石を収めたお守り。\n運が上がり、珍しい物を得やすくなる。',
      stats: { luk: 15, agi: 4 }, mods: { rarePct: 50 },
    }, EX),
    rx_prism_shield: Object.assign({
      name: '金剛石の盾', type: 'shield', atype: 'shield', band: 3, sort: 1002, exclusive: 'rare_lizard',
      desc: '金剛トカゲのうろこを張った盾。\n虹色の輝きが炎・氷・雷を和らげる。',
      def: 21, eva: 8, mdef: 6, mods: { elemResist: { fire: 0.75, ice: 0.75, thunder: 0.75 } },
    }, EX),
    rx_aurora_robe: Object.assign({
      name: 'オーロラのローブ', type: 'body', atype: 'robe', band: 4, sort: 1003, exclusive: 'rare_bird',
      desc: 'オーロラ鳥の羽で織ったローブ。\n消費MPが減り、氷の攻撃に強い。',
      def: 27, mdef: 22, stats: { int: 4, mnd: 4 }, mods: { mpCostPct: -15, elemResist: { ice: 0.5 } },
    }, EX),
    rx_starsea_rod: Object.assign({
      name: '星海のロッド', type: 'weapon', wtype: 'rod', band: 5, sort: 1004, exclusive: 'rare_whale',
      desc: '星くじらの歌を宿したロッド。\n攻撃と回復、両方の魔法が強くなる。',
      atk: 18, mag: 36, stats: { int: 5, mnd: 5 }, mods: { magicPct: 10, healPct: 10 },
    }, EX),
    rx_golden_amulet: Object.assign({
      name: '黄金の護符', type: 'acc', band: 6, sort: 1005, exclusive: 'rare_idol',
      desc: '黄金の守護像の力が宿る護符。\n戦闘開始時に守りを固め、即死も防ぐ。',
      stats: { vit: 6, mnd: 6 }, mods: { startBuffs: { def: 1, mdef: 1 }, statusImmune: ['death'] },
    }, EX),
  });

  // ------------------------------------------------------------ enemy abilities
  const act = (name, target, effects, fx, msg) => ({ name, kind: 'action', target, effects, fx, msg });
  const magic = (power, scale, element) => Object.assign({ type: 'damage', formula: 'magic', power, scale }, element ? { element } : {});
  Object.assign(R.DB.abilities, {
    en_rx_gem_flash: act('宝石の輝き', 'enemies', [{ type: 'status', status: 'blind', chance: 0.3 }], 'holy',
      '{user}の額の宝石がまばゆく光った！'),
    en_rx_hop: act('跳ね回る', 'self', [{ type: 'buff', stat: 'agi', stages: 1 }, { type: 'buff', stat: 'def', stages: 1 }], 'buff',
      '{user}はぴょんぴょん跳ね回っている！'),
    en_rx_prism: act('虹色の光', 'enemies', [magic(14, 0.45)], 'holy',
      '{user}のうろこが虹色の光を放った！'),
    en_rx_aurora: act('オーロラの光', 'enemies', [magic(20, 0.5)], 'holy2',
      '{user}はオーロラの光を降らせた！'),
    en_rx_star_song: act('星の歌', 'enemies', [{ type: 'status', status: 'sleep', chance: 0.3 }], 'song',
      '{user}は星空に響く歌を歌った！'),
    en_rx_gold_ray: act('黄金の光線', 'enemy', [magic(40, 0.8, 'holy')], 'holy2',
      '{user}の目から光線が放たれた！'),
    en_rx_guard: act('守護の構え', 'self', [{ type: 'buff', stat: 'def', stages: 1 }, { type: 'buff', stat: 'mdef', stages: 1 }], 'buff',
      '{user}は守りの構えをとった！'),
  });

  // ------------------------------------------------------------ monsters
  Object.assign(R.DB.monsters, {
    // レグナス〜盗賊の砦 (Lv1–11): harmless but slippery, pays like a whole dungeon floor
    rare_hare: rareMon('rare_hare', '宝石ウサギ', 8, {
      s: { hp: 1.6, atk: 0.55, def: 0.7, mdef: 1.2, agi: 1.7, mag: 0.8 }, x: { exp: 6, gold: 8, jp: 5 },
      eva: 12, flags: ['rare', 'flee'], fleeRate: 0.45, attackFx: 'strike', statusRes: RARE_RES,
      a: [['attack', 3], ['en_rx_gem_flash', 2], ['en_rx_hop', 1, { once: true }], ['wait', 2]],
      drop: ['seed_luk', 6], rare: ['rx_rabbit_charm', 64], steal: ['seed_agi', 'rx_rabbit_charm'],
      appear: 'まばゆい光とともに、宝石ウサギが現れた！',
      desc: '額に宝石を輝かせる、まるいウサギ。\nめったに姿を見せず、すぐに逃げてしまう。',
    }),
    // エルフィン〜ピラミッド (Lv10–19): hard crystal hide, magic finds the gaps
    rare_lizard: rareMon('rare_lizard', '金剛トカゲ', 16, {
      s: { hp: 1.3, atk: 0.95, def: 1.8, mdef: 0.8, agi: 1.25 }, x: { exp: 6, gold: 8, jp: 5 },
      eva: 6, flags: ['rare', 'flee'], fleeRate: 0.4, attackFx: 'bite',
      elem: { ice: 1.5, earth: 0.5, holy: 0.5 }, statusRes: RARE_RES,
      a: [['attack', 3], ['en_rx_prism', 2], ['en_tail', 2], ['wait', 1]],
      drop: ['seed_vit', 6], rare: ['rx_prism_shield', 96], steal: ['seed_str', 'rx_prism_shield'],
      appear: '虹色の光があふれ、金剛トカゲが現れた！',
      desc: '背中が金剛石のうろこで覆われたトカゲ。\n光を受けると虹色に輝く。出会えたら幸運だ。',
    }),
    // フロスト〜炎の火山 (Lv17–27): quick flyer with aurora magic
    rare_bird: rareMon('rare_bird', 'オーロラ鳥', 23, {
      s: { hp: 1.5, atk: 0.9, def: 0.9, mdef: 2.2, agi: 1.5, mag: 1.3 }, x: { exp: 6, gold: 8, jp: 5 },
      eva: 10, flags: ['rare', 'flee', 'flying'], fleeRate: 0.45, attackFx: 'pierce',
      elem: { ice: 0.5, wind: 0.5, earth: 0.5, thunder: 1.5 }, statusRes: RARE_RES,
      a: [['attack', 3], ['en_rx_aurora', 2], ['en_sleep_song', 1], ['wait', 1]],
      drop: ['light_drop', 6], rare: ['rx_aurora_robe', 128], steal: ['seed_mnd', 'rx_aurora_robe'],
      appear: '空が色づき、オーロラ鳥が舞い降りた！',
      desc: 'オーロラ色の羽と長い尾を持つ美しい鳥。\nその姿を見た者はほとんどいないという。',
    }),
    // アルカナ〜星見の塔〜最果ての海 (Lv25–32): a big, slow sky whale
    rare_whale: rareMon('rare_whale', '星くじら', 28, {
      large: true, mp: 60,
      s: { hp: 1.3, atk: 0.9, mdef: 1.5, agi: 1.4, mag: 1.3 }, x: { exp: 4.2, gold: 4.5, jp: 3 },
      eva: 4, flags: ['rare', 'flee', 'flying'], fleeRate: 0.35, attackFx: 'strike',
      elem: { thunder: 1.5, earth: 0.5, water: 0.5, holy: 0.5 }, statusRes: RARE_RES,
      a: [['attack', 3], ['en_stardust', 2], ['en_rx_star_song', 1], ['en_star_heal', 2, { hpBelow: 0.5, once: true }]],
      drop: ['goddess_tear', 8], rare: ['rx_starsea_rod', 128], steal: ['seed_int', 'rx_starsea_rod'],
      appear: '星がきらめき、星くじらが現れた！',
      desc: '空を泳ぐ小さなくじら。体に星がまたたく。\n流れ星の夜にだけ現れると言われている。',
    }),
    // 魔王島〜魔王城 (Lv31–40): a living golden statue guarding the demon king's hoard
    rare_idol: rareMon('rare_idol', '黄金の守護像', 36, {
      mp: 0,
      s: { hp: 2, atk: 1.05, def: 1.7, mdef: 1.4, agi: 1.5, mag: 1.2 }, x: { exp: 6, gold: 8.5, jp: 4 },
      eva: 4, flags: ['rare', 'flee'], fleeRate: 0.4, attackFx: 'strike',
      elem: { thunder: 1.5, earth: 0.5, holy: 0.5, dark: 0.5 },
      statusRes: Object.assign({}, RARE_RES, { poison: 1, blind: 0.5, confuse: 0.8 }),
      a: [['attack', 3], ['en_rx_gold_ray', 2], ['en_rx_guard', 1, { once: true }], ['en_quake', 1]],
      drop: ['seed_str', 6], rare: ['rx_golden_amulet', 128], steal: ['seed_hp', 'rx_golden_amulet'],
      appear: '金色の光が満ち、黄金の守護像が現れた！',
      desc: 'ルビーの目とヒスイの飾りを持つ黄金の像。\n魔王の財宝を守り、人前にはまず現れない。',
    }),
  });

  // ------------------------------------------------------------ encounter table
  // zone → rare monster and its share of that zone's random battles
  const zones = (mon, rate, list) => list.split(' ').reduce((o, z) => Object.assign(o, { [z]: { mon, rate } }), {});
  Object.assign(R.DB.rareEncounters,
    zones('rare_hare', 0.015, 'w_start w_east d_wind1 d_wind2 d_fort1 d_fort2'),
    zones('rare_lizard', 0.015, 'w_sea1 w_forest w_desert d_water1 d_water2 d_pyr1 d_pyr2 d_pyr3'),
    zones('rare_bird', 0.015, 'w_sea2 w_snow w_volcano d_ice1 d_ice2 d_vol1 d_vol2'),
    zones('rare_whale', 0.018, 'w_sea3 w_arcana d_star1 d_star2 d_star3 d_star4'),
    zones('rare_idol', 0.015, 'w_demon d_demon1 d_demon2 d_demon3 d_demon4 d_demon5'),
  );
})(window.RPG);
