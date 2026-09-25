// Regular monsters (DESIGN §5.6). Every monster is a palette variant of one of
// the base sprites of §4, grouped in classic families (weak → strong recolours
// across the regions). Stats come from a level curve × per-monster multipliers,
// tuned with tools/sim_balance.js against the party model of each region:
//   hp 7+5L+0.28L²   atk 10+3.8L   def 1+2.1L   mdef L   agi 4+1.8L   mag 5+2.4L
//   (hp +15 % and atk +12 % phased in from Lv16 to Lv30)
//   exp: (EXP a party ≈1.5 levels above needs for its next level) / 14.4, × a smooth factor fitted
//        so that natural play (≈9 fights per region, 5–9 per dungeon floor, bosses) meets §7.4's levels
//   jp  5+1.15L (≈ 12·Lv² JP earned at Lv)      gold 6+8L+0.3L² (≈ 50–100 % of each town's gear)
//   size: small hp×0.72 atk×0.9 rewards×0.75 (jp×0.9) · large hp×2 atk×1.15 def×1.1 rewards×1.8 (jp×1.6)
// Rare drops use the band pools of items.js (R.ITEM_RARE); the metal and gold
// jellies and the mimic line are the main rare targets.
(function (R) {
  'use strict';

  const SIZE = {
    jelly: 's', bat: 's', rat: 's', mushroom: 's', bee: 's', wisp: 's', imp: 's', mimic: 's', eyeball: 's',
    orc: 'l', golem: 'l', wyvern: 'l', chimera: 'l', yeti: 'l', kraken: 'l', demon: 'l', sandworm: 'l', minotaur: 'l',
  };
  const SZ = {
    s: { hp: 0.72, atk: 0.9, def: 0.9, rw: 0.75, jp: 0.9 },
    m: { hp: 1, atk: 1, def: 1, rw: 1, jp: 1 },
    l: { hp: 2, atk: 1.15, def: 1.1, rw: 1.8, jp: 1.6 },
  };
  // total EXP to reach level L (same curve as R.Rules.expForLevel, inlined: data loads first)
  const expFor = (L) => (L <= 1 ? 0 : 8 * Math.pow(L - 1, 2.6) + 10 * (L - 1));
  // late-game boost: the party's jobs, abilities and gear snowball after the ship
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
  const UNDEAD_RES = { poison: 1, death: 1, sleep: 1, confuse: 0.5 };
  const GOLEM_RES = { poison: 1, sleep: 0.6, confuse: 1, death: 0.6, blind: 0.5 };
  const METAL_RES = { poison: 1, sleep: 0.9, paralyze: 1, confuse: 1, silence: 1, blind: 1, death: 1 };
  const MIMIC_RES = { death: 1, sleep: 0.5, confuse: 0.5 };

  /**
   * name, sprite, lv, o:
   *   s:{hp,atk,def,mdef,agi,mag} multipliers · rw reward multiplier · exp/gold/jp/hp absolute overrides
   *   a:[[id, w, cond?], ...] actions · apt actsPerTurn · mp · eva
   *   elem statusRes flags drop:[item,rate] rare:[item,rate] steal:[item, rare] hue sat bri desc fleeRate
   */
  function M(name, sprite, lv, o) {
    const sz = SZ[SIZE[sprite] || 'm'];
    const c = curve(lv), s = o.s || {};
    const k = (key) => (s[key] != null ? s[key] : 1);
    const rw = (o.rw != null ? o.rw : 1) * sz.rw;
    const d = {
      name, sprite, lv,
      hp: o.hp != null ? o.hp : Math.max(3, Math.round(c.hp * sz.hp * k('hp'))),
      mp: o.mp || 0,
      atk: Math.round(c.atk * sz.atk * k('atk')),
      def: Math.round(c.def * sz.def * k('def')),
      agi: Math.round(c.agi * k('agi')),
      mag: Math.round(c.mag * k('mag')),
      mdef: Math.round(c.mdef * k('mdef')),
      exp: o.exp != null ? o.exp : Math.max(1, Math.round(c.exp * rw)),
      gold: o.gold != null ? o.gold : Math.max(1, Math.round(c.gold * rw * (o.gm || 1))),
      jp: o.jp != null ? o.jp : Math.max(2, Math.round(c.jp * (o.rw != null ? o.rw : 1) * sz.jp)),
      actions: (o.a || [['attack', 1]]).map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w })),
      desc: o.desc,
    };
    if (o.def != null) d.def = o.def;
    if (o.mdef != null) d.mdef = o.mdef;
    if (o.eva != null) d.eva = o.eva;
    if (o.apt) d.actsPerTurn = o.apt;
    if (o.elem) d.elem = o.elem;
    if (o.statusRes) d.statusRes = o.statusRes;
    if (o.flags) d.flags = o.flags;
    if (o.fleeRate != null) d.fleeRate = o.fleeRate;
    if (o.hue) d.hue = o.hue;
    if (o.sat != null) d.sat = o.sat;
    if (o.bri != null) d.bri = o.bri;
    if (o.drop) d.drop = { item: o.drop[0], rate: o.drop[1] };
    if (o.rare) d.rare = { item: o.rare[0], rate: o.rare[1] };
    if (o.steal) d.steal = o.steal[1] ? { item: o.steal[0], rare: o.steal[1] } : { item: o.steal[0] };
    return d;
  }

  // shared element profiles
  const FLY = { wind: 1.5, earth: 0.5 };
  const UNDEAD = { holy: 2, fire: 1.5, dark: 0 };
  const UNDEAD_LATE = { holy: 1.5, fire: 1.25, dark: 0 }; // the demon castle's undead are hardened
  const PLANT = { fire: 2, ice: 1.5, water: 0.5 };
  const AQUA = { thunder: 2, water: -1, fire: 0.5 };
  const FROST = { ice: -1, fire: 2, water: 0.5 };
  const FLAME = { fire: -1, ice: 2, water: 2 };
  const DEMON = { holy: 2, dark: -1 };

  Object.assign(R.DB.monsters, {
    // ======================================================= レグナス周辺 (Lv1–4)
    puchi_jelly: M('ぷちゼリー', 'jelly', 1, {
      s: { hp: 1.1, atk: 0.9, agi: 0.8 }, a: [['attack', 1]],
      drop: ['herb', 8], rare: ['clover', 128], steal: ['herb', 'clover'],
      desc: 'ぷるぷると ふるえる ちいさな ゼリー。 よわいが なかまと むれて あらわれる。',
    }),
    chibi_bat: M('ちびこうもり', 'bat', 1, {
      s: { hp: 0.9, agi: 1.4 }, eva: 8, flags: ['flying'], elem: FLY, a: [['attack', 1]],
      drop: ['eye_drop', 10], rare: ['seed_agi', 96], steal: ['eye_drop'],
      desc: 'くらがりから とびだしてくる こうもりの こども。 すばしこい。',
    }),
    kajiri_rat: M('かじりねずみ', 'rat', 2, {
      s: { atk: 1.1, agi: 1.2 }, a: [['attack', 5], ['en_bite', 2]],
      drop: ['herb', 10], rare: ['seed_luk', 96], steal: ['herb', 'seed_luk'],
      desc: 'なんでも かじってしまう くいしんぼうの ねずみ。 まえばが じまん。',
    }),
    kusa_hebi: M('くさへび', 'snake', 2, {
      s: { hp: 1.05, atk: 1.1, agi: 0.9 }, elem: { ice: 1.5 }, a: [['attack', 5], ['en_poison_bite', 2]],
      drop: ['antidote', 8], rare: ['fairy_knife', 128], steal: ['antidote'],
      desc: 'くさむらに ひそむ みどりの へび。 かまれると どくが まわる。',
    }),
    warai_take: M('わらいだけ', 'mushroom', 2, {
      s: { hp: 1.5, atk: 0.9, agi: 0.6 }, elem: { fire: 2 }, a: [['attack', 5], ['en_sleep_spore', 2]],
      drop: ['smelling_salts', 10], rare: ['seed_hp', 64], steal: ['herb'],
      desc: 'けらけらと わらう あかい キノコ。 ねむりのこなを まきちらす。',
    }),
    goblin: M('ゴブリン', 'goblin', 3, {
      s: { hp: 1.05, atk: 1.16, agi: 0.95 }, gm: 1.5, a: [['attack', 5], ['en_heavy', 2]],
      drop: ['herb', 8], rare: ['swallow_sword', 128], steal: ['herb', 'swallow_sword'],
      desc: 'こんぼうを ふりまわす こおにの しゅぞく。 ひかりものに めがない。',
    }),
    hari_bachi: M('はりばち', 'bee', 3, {
      s: { hp: 0.9, atk: 1.1, agi: 1.4 }, eva: 6, flags: ['flying'], elem: { wind: 1.5, fire: 1.5, earth: 0.5 },
      a: [['attack', 4], ['en_poison_sting', 3]],
      drop: ['antidote', 8], rare: ['seed_agi', 96], steal: ['antidote'],
      desc: 'おしりの どくばりで さしてくる おおきな はち。 はねの おとが めじるし。',
    }),

    // ======================================================= かぜの洞くつ (Lv3–6)
    hora_bat: M('ほらこうもり', 'bat', 3, {
      s: { hp: 1.05, agi: 1.3 }, eva: 8, hue: 110, sat: 0.7, flags: ['flying'], elem: FLY,
      a: [['attack', 4], ['en_drain', 3]],
      drop: ['eye_drop', 8], rare: ['seed_agi', 96], steal: ['eye_drop'],
      desc: 'どうくつの てんじょうに ぶらさがる こうもり。 いきものの ちを すう。',
    }),
    iwa_jelly: M('いわゼリー', 'jelly', 4, {
      s: { hp: 1.35, def: 2.2, agi: 0.6, mdef: 0.8 }, hue: -120, sat: 0.35, bri: 0.85,
      elem: { earth: 0.5, thunder: 0.5, water: 1.5 }, a: [['attack', 4], ['en_charge', 2], ['en_harden', 1]],
      drop: ['herb', 8], rare: ['seed_vit', 64], steal: ['herb', 'seed_vit'],
      desc: 'いしころを とりこんで かたくなった ゼリー。 ぶきが はじかれる。',
    }),
    kaze_kodama: M('かぜのこだま', 'wisp', 4, {
      s: { hp: 0.9, mag: 1.3, mdef: 1.5, def: 0.8, agi: 1.2 }, mp: 12, hue: -80, sat: 1.1, flags: ['flying'],
      elem: { wind: -1, earth: 1.5 }, a: [['attack', 3], ['en_wind', 3]],
      drop: ['wing', 12], rare: ['clover', 96], steal: ['wing', 'clover'],
      desc: 'どうくつを ふきぬける かぜが かたちを もった せいれい。 かまいたちを おこす。',
    }),
    doku_take: M('どくだけ', 'mushroom', 4, {
      s: { hp: 1.5, atk: 0.95, agi: 0.6 }, hue: -80, elem: { fire: 2 },
      a: [['attack', 4], ['en_poison_spore', 2], ['en_sleep_spore', 1]],
      drop: ['antidote', 6], rare: ['seed_hp', 64], steal: ['antidote'],
      desc: 'むらさきいろの かさを もつ キノコ。 どくの ほうしを ばらまく。',
    }),
    hob_goblin: M('ホブゴブリン', 'goblin', 5, {
      s: { hp: 1.2, atk: 1.1 }, hue: -70, bri: 0.8, gm: 1.5,
      a: [['attack', 5], ['en_heavy', 2], ['en_herb', 2, { hpBelow: 0.5, once: true }]],
      drop: ['fire_bomb', 16], rare: ['swallow_sword', 96], steal: ['herb', 'swallow_sword'],
      desc: 'ゴブリンの なかでも からだの おおきな せんし。 やくそうを かじって たたかう。',
    }),
    koakuma: M('こあくま', 'imp', 5, {
      s: { hp: 0.95, mag: 1.2, agi: 1.2, mdef: 1.3 }, mp: 10, flags: ['flying'], elem: { holy: 1.5, fire: 0.5 },
      a: [['attack', 4], ['en_fire', 3], ['en_blind', 1]],
      drop: ['holy_water', 12], rare: ['fairy_knife', 96], steal: ['holy_water', 'fairy_knife'],
      desc: 'いたずらずきの ちいさな あくま。 ファイアボールを おぼえている。',
    }),

    // ======================================================= 東の平原 (Lv5–8)
    nora_wolf: M('のらおおかみ', 'wolf', 5, {
      s: { hp: 1.1, atk: 1.1, agi: 1.3 }, elem: { fire: 1.5 }, a: [['attack', 5], ['en_bite', 3]],
      drop: ['herb', 8], rare: ['seed_agi', 64], steal: ['herb'],
      desc: 'むれで かりを する のらの おおかみ。 えものの まわりを ぐるぐる まわる。',
    }),
    shizuku_jelly: M('しずくゼリー', 'jelly', 6, {
      s: { hp: 1.26, atk: 1.05, mag: 1.2 }, mp: 12, hue: 60, sat: 1.1, elem: { water: -1, thunder: 2 },
      a: [['attack', 5], ['en_heal', 3]],
      drop: ['healing_grass', 16], rare: ['gold_charm', 128], steal: ['herb', 'seed_mp'],
      desc: 'みずを たっぷり ふくんだ あおい ゼリー。 なかまの きずを ヒールで いやす。',
    }),
    kuitsuki_sou: M('くいつきそう', 'plant', 6, {
      s: { hp: 1.49, atk: 1.16, agi: 0.55 }, elem: PLANT, a: [['attack', 4], ['en_bite', 2], ['en_sleep_spore', 1]],
      drop: ['antidote', 8], rare: ['seed_vit', 64], steal: ['herb'],
      desc: 'ちかづく ものに かみつく にくしょくの はな。 あまい かおりで さそう。',
    }),
    kuma_bachi: M('くまばち', 'bee', 6, {
      s: { hp: 1.04, atk: 1.05, agi: 1.35 }, eva: 6, hue: -25, bri: 0.75, flags: ['flying'], elem: { wind: 1.5, fire: 1.5, earth: 0.5 },
      a: [['attack', 4], ['en_numb_sting', 2], ['en_poison_sting', 1]],
      drop: ['numb_cure', 10], rare: ['cat_hood', 128], steal: ['numb_cure'],
      desc: 'くろい からだの おおきな はち。 しびれる どくで えものを うごけなくする。',
    }),
    madara_hebi: M('まだらへび', 'snake', 7, {
      s: { hp: 1.16, atk: 1.05 }, hue: 150, sat: 0.9, elem: { ice: 1.5 }, a: [['attack', 4], ['en_poison_bite', 2], ['en_bind', 1]],
      drop: ['antidote', 6], rare: ['seed_luk', 64], steal: ['antidote'],
      desc: 'まだらもようの どくへび。 からみついて しめあげる。',
    }),
    orc: M('オーク', 'orc', 8, {
      s: { hp: 1.04, atk: 1.1, agi: 0.8 }, gm: 1.4, a: [['attack', 5], ['en_heavy', 2], ['en_focus', 1]],
      drop: ['healing_grass', 10], rare: ['gale_spear', 128], steal: ['healing_grass', 'gale_spear'],
      desc: 'ぶたの かおを した おおおとこ。 ちからは つよいが あたまは よくない。',
    }),

    // ======================================================= 盗賊のとりで (Lv7–11)
    banken: M('ばんけん', 'wolf', 7, {
      s: { hp: 1.1, atk: 1.05, agi: 1.25 }, hue: 175, sat: 1.3, bri: 0.9, elem: { fire: 1.5 },
      a: [['attack', 4], ['en_bite', 3], ['en_howl', 1]],
      drop: ['herb', 6], rare: ['seed_str', 64], steal: ['herb'],
      desc: 'とうぞくに かわれた ばんけん。 しんにゅうしゃに とびかかる。',
    }),
    dobu_nezumi: M('どぶねずみ', 'rat', 7, {
      s: { hp: 1.1, agi: 1.25 }, hue: 60, sat: 0.5, bri: 0.8, gm: 1.3, a: [['attack', 4], ['en_poison_bite', 2], ['en_steal', 1]],
      drop: ['antidote', 6], rare: ['seed_luk', 64], steal: ['antidote', 'gold_charm'],
      desc: 'とりでの ゴミを あさる ねずみ。 すきを みて ゴールドを くすねていく。',
    }),
    sabi_yoroi: M('さびよろい', 'armor', 8, {
      s: { hp: 1.26, def: 1.8, mdef: 0.6, agi: 0.6 }, hue: 160, sat: 3, bri: 0.75,
      elem: { thunder: 2, holy: 1.5 }, statusRes: { poison: 1, death: 0.5 },
      a: [['attack', 4], ['en_heavy', 2], ['en_harden', 1]],
      drop: ['iron_shield', 32], rare: ['seed_vit', 64], steal: ['herb', 'seed_vit'],
      desc: 'さびついた よろいに やどった うらみの たましい。 なかは からっぽ。',
    }),
    yatoware_madoushi: M('やとわれまどうし', 'darkmage', 8, {
      s: { hp: 0.99, def: 0.8, mdef: 1.5, mag: 1.4 }, mp: 16, elem: { holy: 1.5, dark: 0.5 },
      a: [['attack', 2], ['en_fire', 3], ['en_sleep', 2]],
      drop: ['mana_drop', 16], rare: ['cat_hood', 96], steal: ['mana_drop', 'cat_hood'],
      desc: 'かねで とうぞくに やとわれた まどうし。 ねむりのきりを つかう。',
    }),
    takara_modoki: M('たからもどき', 'mimic', 9, {
      s: { hp: 2.2, atk: 1.35, def: 1.3, agi: 1.1, mdef: 1.2 }, rw: 2.5, gm: 2, statusRes: MIMIC_RES,
      a: [['attack', 3], ['en_bite', 3], ['en_gaze', 1]],
      drop: ['revive_feather', 8], rare: ['gold_charm', 24], steal: ['fire_bomb', 'gold_charm'],
      desc: 'たからばこに ばけた まもの。 あけようと した ものに くらいつく。',
    }),

    // ======================================================= ふねの うみ (Lv9–12)
    umi_jelly: M('うみゼリー', 'jelly', 9, {
      s: { hp: 1.32, atk: 1.1, mag: 1.1 }, mp: 12, hue: 80, bri: 0.85, elem: AQUA,
      a: [['attack', 5], ['en_water', 2], ['en_acid', 1], ['en_heal', 1]],
      drop: ['healing_grass', 10], rare: ['seed_mp', 64], steal: ['healing_grass'],
      desc: 'しおみずで そだった ふかい あおいろの ゼリー。 なみに のって やってくる。',
    }),
    oobasami: M('おおばさみ', 'crab', 10, {
      s: { hp: 1.26, atk: 1.1, def: 1.9, mdef: 0.8, agi: 0.7 }, elem: { thunder: 2, water: 0, fire: 0.75 },
      a: [['attack', 4], ['en_claws', 2], ['en_harden', 1]],
      drop: ['healing_grass', 10], rare: ['seed_vit', 64], steal: ['healing_grass'],
      desc: 'おおきな はさみを もつ かに。 こうらは ぶきを はじく ほど かたい。',
    }),
    umi_hebi: M('うみへび', 'snake', 10, {
      s: { hp: 1.26, atk: 1.1, agi: 1.1 }, hue: 90, elem: { thunder: 1.5, water: 0.5 },
      a: [['attack', 4], ['en_bind', 2], ['en_poison_bite', 1]],
      drop: ['antidote', 6], rare: ['seed_hp', 64], steal: ['antidote'],
      desc: 'うみを すべるように およぐ へび。 ふねの へりから はいあがってくる。',
    }),
    gyojin_hei: M('ぎょじんへい', 'merman', 11, {
      s: { hp: 1.21, atk: 1.16 }, mp: 9, elem: AQUA, a: [['attack', 4], ['en_pierce', 2], ['en_water', 1]],
      drop: ['mana_drop', 16], rare: ['float_shoes', 128], steal: ['healing_grass', 'float_shoes'],
      desc: 'ほこを もった うみの へいし。 ふねを おそって たからを うばう。',
    }),
    oodako: M('おおだこ', 'kraken', 12, {
      s: { hp: 1.03, atk: 1.1, agi: 0.6 }, elem: AQUA, a: [['attack', 3], ['en_tentacles', 2], ['en_ink', 2]],
      drop: ['healing_grass', 8], rare: ['study_charm', 96], steal: ['healing_grass', 'study_charm'],
      desc: 'ふねを まるごと まきこむ おおきな たこ。 すみを はいて めを くらます。',
    }),

    // ======================================================= エルフィンの森 (Lv10–13)
    madowashi_take: M('まどわしだけ', 'mushroom', 10, {
      s: { hp: 1.45, atk: 0.95, agi: 0.6 }, hue: -140, elem: { fire: 2 },
      a: [['attack', 4], ['en_confuse_spore', 2], ['en_poison_spore', 1]],
      drop: ['smelling_salts', 8], rare: ['seed_mnd', 64], steal: ['smelling_salts'],
      desc: 'あおじろく ひかる キノコ。 ほうしを すうと あたまが くらくらする。',
    }),
    harpy: M('ハーピー', 'harpy', 11, {
      s: { agi: 1.3, mag: 1.1 }, mp: 9, eva: 8, flags: ['flying'], elem: { wind: 0.5, earth: 0.5, thunder: 1.5 },
      a: [['attack', 4], ['en_sleep_song', 2], ['en_wind', 1]],
      drop: ['smelling_salts', 8], rare: ['float_shoes', 96], steal: ['smelling_salts', 'float_shoes'],
      desc: 'とりの つばさを もつ まもの。 うたごえで たびびとを ねむらせる。',
    }),
    mori_ookami: M('もりおおかみ', 'wolf', 11, {
      s: { agi: 1.3, atk: 1.05 }, hue: -90, sat: 1.3, elem: { fire: 1.5 },
      a: [['attack', 4], ['en_bite', 2], ['en_howl', 1]],
      drop: ['healing_grass', 10], rare: ['seed_str', 64], steal: ['herb'],
      desc: 'ふかい もりに すむ みどりの けなみの おおかみ。 さけびで なかまを ふるいたたせる。',
    }),
    doku_bana: M('どくばな', 'plant', 11, {
      s: { hp: 1.35, atk: 1.05, agi: 0.55 }, hue: -60, elem: PLANT,
      a: [['attack', 3], ['en_bite', 2], ['en_breath_poison', 2], ['en_regrow', 2, { hpBelow: 0.5, once: true }]],
      drop: ['antidote', 6], rare: ['prayer_staff', 128], steal: ['antidote', 'all_cure'],
      desc: 'むらさきの はなびらを ひらく どくの はな。 どくガスを はく。',
    }),
    kitsunebi: M('きつねび', 'wisp', 12, {
      s: { hp: 0.9, mag: 1.35, mdef: 1.5, agi: 1.2 }, mp: 18, hue: 180, flags: ['flying'],
      elem: { fire: -1, water: 2, ice: 1.5 }, a: [['attack', 2], ['en_fire', 3], ['en_fire2', 1]],
      drop: ['mana_drop', 16], rare: ['dream_robe', 128], steal: ['mana_drop', 'dream_robe'],
      desc: 'よるの もりを さまよう あやしい ひのたま。 ひとを まよわせる。',
    }),

    // ======================================================= 水の洞くつ (Lv12–15)
    lizardman: M('リザードマン', 'lizardman', 13, {
      s: { hp: 1.1, atk: 1.05 }, elem: { ice: 1.5, thunder: 1.5 },
      a: [['attack', 5], ['en_double', 2], ['en_tail', 1]],
      drop: ['healing_grass', 10], rare: ['lightning_sword', 128], steal: ['healing_grass', 'lightning_sword'],
      desc: 'けんと たてを あやつる とかげの せんし。 みずべを なわばりに する。',
    }),
    iwa_gani: M('いわがに', 'crab', 13, {
      s: { hp: 1.15, def: 2.0, agi: 0.65, mdef: 0.8 }, hue: 30, sat: 0.45, bri: 0.85,
      elem: { thunder: 1.5, earth: 0.5, water: 0 }, a: [['attack', 4], ['en_claws', 2], ['en_harden', 1]],
      drop: ['guard_bell', 24], rare: ['seed_vit', 48], steal: ['healing_grass'],
      desc: 'いわの ような こうらを せおった かに。 とくいの はさみで きりさく。',
    }),
    mizu_bourei: M('みずのぼうれい', 'ghost', 13, {
      s: { hp: 0.95, def: 0.6, mdef: 1.3 }, eva: 14, hue: -60, sat: 1.2, flags: ['undead', 'flying'],
      elem: Object.assign({ ice: 0.5, water: 0.5 }, UNDEAD), statusRes: UNDEAD_RES,
      a: [['attack', 3], ['en_life_suck', 2], ['en_breath_ice1', 2], ['en_curse', 1]],
      drop: ['holy_water', 8], rare: ['prayer_staff', 96], steal: ['holy_water'],
      desc: 'みずうみに しずんだ ものたちの なげきが あつまった ぼうれい。',
    }),
    doku_mizuchi: M('どくみずち', 'snake', 14, {
      s: { hp: 1.15, atk: 1.05 }, hue: 160, elem: { thunder: 1.5, water: 0.5 },
      a: [['attack', 4], ['en_poison_bite', 2], ['en_breath_poison', 1], ['en_bind', 1]],
      drop: ['all_cure', 16], rare: ['seed_hp', 48], steal: ['antidote'],
      desc: 'ちかすいみゃくに すむ どくの みずへび。 どくガスを はく。',
    }),

    // ======================================================= さばく (Lv13–16)
    suna_sasori: M('すなさそり', 'scorpion', 13, {
      s: { hp: 1.05, atk: 1.1, def: 1.4, agi: 1 }, elem: { ice: 1.5, water: 1.5 },
      a: [['attack', 4], ['en_poison_sting', 2], ['en_numb_sting', 1]],
      drop: ['antidote', 6], rare: ['seed_agi', 64], steal: ['antidote'],
      desc: 'すなに もぐって えものを まつ さそり。 どくの しっぽを もつ。',
    }),
    togebouzu: M('とげぼうず', 'cactus', 14, {
      s: { hp: 1.26, atk: 1.1, agi: 0.7 }, elem: { fire: 1.5, water: 0.5 }, a: [['attack', 3], ['en_needles', 3], ['en_regrow', 2, { hpBelow: 0.5, once: true }]],
      drop: ['healing_grass', 8], rare: ['maneki', 128], steal: ['healing_grass', 'maneki'],
      desc: 'さばくを ぴょこぴょこ あるく サボテン。 からだの トゲを とばしてくる。',
    }),
    mummy: M('ミイラ', 'mummy', 15, {
      s: { hp: 1.31, atk: 1.1, agi: 0.6 }, flags: ['undead'], elem: { fire: 2, holy: 2, dark: 0 }, statusRes: UNDEAD_RES,
      a: [['attack', 4], ['en_bandage', 2]],
      drop: ['all_cure', 16], rare: ['dream_robe', 128], steal: ['all_cure'],
      desc: 'ほうたいに まかれた いにしえの しびと。 ほうたいを のばして からみつく。',
    }),
    hagane_jelly: M('はがねゼリー', 'jelly', 15, {
      hp: 7, hue: 70, sat: 0.25, bri: 0.8, def: 255, s: { agi: 2.6, atk: 0.85, mag: 1.0 }, mdef: 255, eva: 10, mp: 8,
      exp: 1200, jp: 90, gold: 24, flags: ['metal', 'flee'], fleeRate: 0.35,
      statusRes: METAL_RES, a: [['attack', 3], ['en_fire', 2]],
      drop: ['seed_luk', 12], rare: ['speed_boots', 48], steal: ['mana_drop', 'loot_bag'],
      desc: 'はがねの ように かたい ゼリー。 すぐに にげるが たおせば たくさんの けいけんが えられる。',
    }),
    suna_mogura: M('すなもぐり', 'sandworm', 16, {
      s: { hp: 1.16, atk: 1.16, agi: 0.5 }, elem: { water: 2, ice: 1.5, earth: 0.5 },
      a: [['attack', 4], ['en_bite_crush', 1], ['en_sand', 2]],
      drop: ['healing_aroma', 24], rare: ['study_charm', 96], steal: ['healing_grass', 'study_charm'],
      desc: 'すなの なかを およぐ きょだいな むし。 おおきな くちで なんでも のみこむ。',
    }),

    // ======================================================= ピラミッド (Lv14–18)
    skeleton: M('スケルトン', 'skeleton', 14, {
      s: { hp: 1.16, atk: 1.1 }, flags: ['undead'], elem: Object.assign({ ice: 0.75 }, UNDEAD), statusRes: UNDEAD_RES,
      a: [['attack', 5], ['en_double', 2]],
      drop: ['silver_dagger', 32], rare: ['seed_str', 48], steal: ['holy_water'],
      desc: 'けんと たてを もつ がいこつの へいし。 ほねが カタカタと なる。',
    }),
    akuryou: M('あくりょう', 'ghost', 15, {
      s: { hp: 1.04, atk: 1.05, def: 0.6, mdef: 1.3 }, eva: 14, flags: ['undead', 'flying'], elem: Object.assign({}, UNDEAD, { dark: -1 }),
      statusRes: UNDEAD_RES, a: [['attack', 3], ['en_life_suck', 2], ['en_curse', 1], ['en_evil_eye', 1]],
      drop: ['holy_water', 8], rare: ['study_charm', 96], steal: ['holy_water', 'study_charm'],
      desc: 'ピラミッドを さまよう うらみの たましい。 いきものの いのちを すいとる。',
    }),
    noroi_hitomi: M('のろいのひとみ', 'eyeball', 16, {
      s: { hp: 1.15, mag: 1.2, agi: 1.1 }, mp: 9, hue: 180, flags: ['flying'], elem: { holy: 1.5, dark: 0.5, earth: 0.5 },
      a: [['attack', 3], ['en_gaze', 2], ['en_evil_eye', 1], ['en_thunder', 1]],
      drop: ['eye_drop', 6], rare: ['maneki', 128], steal: ['eye_drop'],
      desc: 'ひつぎに ほられた のろいの め。 にらまれると からだが うごかなくなる。',
    }),
    kuro_sasori: M('くろさそり', 'scorpion', 16, {
      s: { def: 1.5, atk: 1.05 }, hue: -150, sat: 0.6, bri: 0.6, elem: { ice: 1.5, water: 1.5 },
      a: [['attack', 4], ['en_poison_sting', 2], ['en_numb_sting', 2]],
      drop: ['numb_cure', 8], rare: ['seed_agi', 48], steal: ['antidote'],
      desc: 'まっくろな からの さそり。 ふたつの どくを つかいわける。',
    }),
    hakamori: M('はかもり', 'darkmage', 17, {
      s: { hp: 0.95, mag: 1.4, mdef: 1.6 }, mp: 21, hue: 150, sat: 0.8, elem: { holy: 1.5, dark: 0 },
      a: [['attack', 2], ['en_fire2', 2], ['en_sleep', 1], ['en_poison_mist', 1], ['en_heal', 2]],
      drop: ['mana_drop', 12], rare: ['prayer_staff', 96], steal: ['mana_drop', 'prayer_staff'],
      desc: 'おうの はかを まもる やみの しんかん。 しびとたちの きずを いやす。',
    }),
    houmotsu_modoki: M('ほうもつもどき', 'mimic', 17, {
      s: { hp: 2.3, atk: 1.35, def: 1.4, agi: 1.1, mdef: 1.2 }, rw: 2.5, gm: 2, hue: 20, sat: 1.3, bri: 1.1, statusRes: MIMIC_RES,
      a: [['attack', 3], ['en_bite', 2], ['en_whisper', 1]],
      drop: ['healing_aroma', 8], rare: ['maneki', 16], steal: ['all_cure', 'maneki'],
      desc: 'おうけの ほうもつに ばけた まもの。 しの ことばを ささやく。',
    }),

    // ======================================================= きたの うみ (Lv16–19)
    hyouga_ni: M('ひょうがに', 'crab', 17, {
      s: { hp: 1.1, def: 1.9, agi: 0.7, mdef: 0.8 }, hue: 180, sat: 0.9, elem: { ice: -1, fire: 2, thunder: 1.5 },
      a: [['attack', 4], ['en_claws', 2], ['en_breath_ice1', 1]],
      drop: ['healing_grass', 8], rare: ['seed_vit', 48], steal: ['healing_grass'],
      desc: 'こおりの うみに すむ かに。 つめたい いきで あいてを こおらせる。',
    }),
    daiou_dako: M('だいおうだこ', 'kraken', 18, {
      s: { hp: 0.95, atk: 1.0, agi: 0.6 }, hue: -30, sat: 1.2, bri: 0.9, elem: AQUA,
      a: [['attack', 3], ['en_tentacles', 2], ['en_ink', 1], ['en_bind', 1]],
      drop: ['nectar', 16], rare: ['light_drop', 96], steal: ['healing_grass', 'light_drop'],
      desc: 'きたの うみの ぬしと よばれる おおだこ。 なんぼんもの あしで おそいかかる。',
    }),

    // ======================================================= ゆきぐに (Lv17–20)
    yukinko: M('ゆきんこ', 'frostling', 17, {
      s: { hp: 1.0, mag: 1.2 }, mp: 9, elem: FROST, a: [['attack', 4], ['en_breath_ice1', 2], ['en_ice', 1]],
      drop: ['healing_grass', 8], rare: ['seed_mnd', 64], steal: ['healing_grass'],
      desc: 'ゆきの せいれいの こども。 あそびずきで つめたい いきを ふきかける。',
    }),
    yuki_ookami: M('ゆきおおかみ', 'wolf', 18, {
      s: { agi: 1.3, atk: 1.05 }, sat: 0.3, bri: 1.25, elem: { ice: 0.5, fire: 1.5 },
      a: [['attack', 4], ['en_bite', 2], ['en_howl', 1], ['en_breath_ice1', 1]],
      drop: ['healing_grass', 8], rare: ['seed_agi', 48], steal: ['healing_grass'],
      desc: 'まっしろな けなみの おおかみ。 ふぶきに まぎれて むれで おそう。',
    }),
    koori_jelly: M('こおりゼリー', 'jelly', 18, {
      s: { hp: 1.15, mag: 1.2 }, mp: 12, hue: 50, sat: 0.45, bri: 1.15, elem: FROST,
      a: [['attack', 4], ['en_ice', 2], ['en_breath_ice1', 1]],
      drop: ['healing_grass', 8], rare: ['seed_mp', 48], steal: ['healing_grass'],
      desc: 'こおりついた ゼリー。 さわると てが くっついて はなれない。',
    }),
    yeti: M('イエティ', 'yeti', 19, {
      s: { hp: 1.05, atk: 1.1 }, elem: { ice: 0, fire: 1.5 },
      a: [['attack', 4], ['en_heavy', 2], ['en_rampage', 1], ['en_intimidate', 1], ['en_breath_ice2', 1]],
      drop: ['nectar', 16], rare: ['glacier_bow', 128], steal: ['nectar', 'glacier_bow'],
      desc: 'ゆきやまに すむ けむくじゃらの きょじん。 おそろしい こえで あいてを すくませる。',
    }),

    // ======================================================= ひょうけつの洞くつ (Lv19–22)
    tsurara_koumori: M('つららこうもり', 'bat', 19, {
      s: { hp: 1.05, agi: 1.3 }, eva: 8, hue: -80, sat: 0.9, bri: 1.1, flags: ['flying'],
      elem: { ice: 0, fire: 1.5, wind: 1.5, earth: 0.5 }, a: [['attack', 4], ['en_drain', 2], ['en_breath_ice1', 1]],
      drop: ['all_cure', 16], rare: ['seed_agi', 48], steal: ['all_cure'],
      desc: 'つららの ような きばを もつ こうもり。 こおりの どうくつに すむ。',
    }),
    hyou_seirei: M('ひょうせいれい', 'frostling', 20, {
      s: { hp: 1.0, mag: 1.35, mdef: 1.3 }, mp: 24, hue: 40, sat: 1.4, elem: FROST,
      a: [['attack', 3], ['en_ice2', 2], ['en_breath_ice2', 1], ['en_slow', 1]],
      drop: ['mana_drop', 12], rare: ['sapphire_rod', 128], steal: ['mana_drop', 'sapphire_rod'],
      desc: 'ひょうけつの どうくつを まもる こおりの せいれい。 アイスストームを となえる。',
    }),
    koori_yoroi: M('こおりのよろい', 'armor', 20, {
      s: { hp: 1.15, def: 1.85, agi: 0.6, mdef: 0.8 }, hue: -35, sat: 1.2, bri: 1.1,
      elem: { fire: 2, ice: -1, thunder: 1.5 }, statusRes: { poison: 1, death: 0.5 },
      a: [['attack', 4], ['en_frost_fist', 2], ['en_harden', 1]],
      drop: ['nectar', 16], rare: ['glacier_sword', 128], steal: ['nectar', 'glacier_sword'],
      desc: 'とけない こおりで できた よろい。 こおりの こぶしで なぐりかかる。',
    }),
    fubuki_seirei: M('ふぶきのせいれい', 'wisp', 21, {
      s: { hp: 0.95, mag: 1.35, mdef: 1.5, agi: 1.2 }, mp: 20, hue: -20, sat: 0.45, bri: 1.2, flags: ['flying'],
      elem: FROST, a: [['attack', 2], ['en_ice2', 2], ['en_breath_ice2', 2]],
      drop: ['mana_drop', 12], rare: ['light_drop', 96], steal: ['mana_drop', 'light_drop'],
      desc: 'ふぶきの よるに うまれる せいれい。 ふれた ものを こおりづけに する。',
    }),
    hyouseki_hei: M('ひょうせきへい', 'golem', 21, {
      s: { hp: 1.15, def: 1.7, agi: 0.45, mdef: 0.8 }, hue: 180, sat: 1.5, bri: 1.05,
      elem: { fire: 2, ice: 0, earth: 0.5 }, statusRes: GOLEM_RES,
      a: [['attack', 4], ['en_crush', 2], ['en_stomp', 1]],
      drop: ['nectar', 16], rare: ['ninja_garb', 128], steal: ['nectar', 'ninja_garb'],
      desc: 'こおりの いわで つくられた きょじんへい。 どうくつの おくを まもっている。',
    }),

    // ======================================================= 火山 (Lv21–26)
    salamander: M('サラマンダー', 'salamander', 22, {
      s: { hp: 1.05, atk: 1.05 }, elem: FLAME, a: [['attack', 4], ['en_fire_fang', 2], ['en_breath_fire2', 2]],
      drop: ['nectar', 16], rare: ['flame_shield', 128], steal: ['nectar', 'flame_shield'],
      desc: 'ようがんの なかに すむ ひとかげ。 せなかの ほのおが もえさかる。',
    }),
    magma_jelly: M('マグマゼリー', 'jelly', 22, {
      s: { hp: 1.15, mag: 1.2 }, mp: 12, hue: -140, sat: 1.3, elem: FLAME,
      a: [['attack', 4], ['en_breath_fire1', 2], ['en_fire2', 1]],
      drop: ['healing_grass', 8], rare: ['seed_str', 48], steal: ['healing_grass'],
      desc: 'どろどろに とけた いわの ゼリー。 ちかよると やけどを する。',
    }),
    hinoko_akuma: M('ひのこあくま', 'imp', 22, {
      s: { hp: 1.0, mag: 1.3, agi: 1.2, mdef: 1.3 }, mp: 20, hue: 30, sat: 1.2, flags: ['flying'],
      elem: { fire: -1, ice: 2, holy: 1.5 }, a: [['attack', 3], ['en_fire', 2], ['en_fire2', 2]],
      drop: ['mana_drop', 12], rare: ['speed_boots', 128], steal: ['mana_drop', 'speed_boots'],
      desc: 'かざんに すむ ひのこの あくま。 ほのおの じゅもんを つぎつぎ となえる。',
    }),
    wyvern: M('ワイバーン', 'wyvern', 23, {
      s: { hp: 0.95, atk: 1.05, agi: 1.1 }, flags: ['flying', 'dragon'], elem: { wind: 0.5, earth: 0.5, ice: 1.5, fire: 0.5 },
      a: [['attack', 4], ['en_bite', 2], ['en_breath_fire2', 2]],
      drop: ['nectar', 12], rare: ['kagerou', 128], steal: ['nectar', 'kagerou'],
      desc: 'そらを かける りゅうの なかま。 ほのおの いきを はく。',
    }),
    magma_orc: M('マグマオーク', 'orc', 23, {
      s: { hp: 1.0, atk: 1.1, agi: 0.8 }, gm: 1.4, hue: -100, sat: 1.1, elem: { fire: 0.5, ice: 1.5, water: 1.5 },
      a: [['attack', 4], ['en_heavy', 2], ['en_sweep', 1], ['en_focus', 1]],
      drop: ['thunder_bomb', 16], rare: ['loot_bag', 128], steal: ['nectar', 'loot_bag'],
      desc: 'ようがんで きたえた からだの オーク。 おおきな おのを ふりまわす。',
    }),
    hitokage_hei: M('ひとかげへい', 'lizardman', 23, {
      s: { hp: 1.1, atk: 1.05 }, hue: -125, sat: 1.4, bri: 0.95, elem: { fire: 0.5, ice: 1.5 },
      a: [['attack', 4], ['en_double', 2], ['en_breath_fire1', 1], ['en_tail', 1]],
      drop: ['nectar', 16], rare: ['kagerou', 96], steal: ['nectar'],
      desc: 'ほのおの うろこを もつ とかげの せんし。 かざんを すみかに する。',
    }),
    onibi: M('おにび', 'wisp', 24, {
      s: { hp: 0.95, mag: 1.4, mdef: 1.5, agi: 1.2 }, mp: 24, hue: 130, sat: 1.1, flags: ['flying'],
      elem: { fire: -1, water: 2, holy: 1.5, dark: 0.5 }, a: [['attack', 2], ['en_blast', 2], ['en_confuse', 1], ['en_fire2', 1]],
      drop: ['mana_drop', 12], rare: ['light_drop', 96], steal: ['mana_drop', 'light_drop'],
      desc: 'あかむらさきに もえる あやしい ひのたま。 ばくえんを となえる。',
    }),
    magma_golem: M('マグマゴーレム', 'golem', 25, {
      s: { hp: 1.15, def: 1.6, agi: 0.45, mdef: 0.8 }, hue: -30, sat: 1.7, bri: 0.95,
      elem: FLAME, statusRes: GOLEM_RES, a: [['attack', 4], ['en_crush', 2], ['en_breath_fire2', 1], ['en_quake', 1]],
      drop: ['nectar', 16], rare: ['flame_shield', 96], steal: ['nectar', 'flame_shield'],
      desc: 'ようがんが かたまって うまれた きょじん。 からだから ほのおが ふきだす。',
    }),

    // ======================================================= アルカナ地方 (Lv24–27)
    kimaira: M('キマイラ', 'chimera', 25, {
      s: { hp: 0.95, atk: 1.05, agi: 1.1 }, flags: ['flying'], elem: { ice: 1.5, wind: 0.5, earth: 0.5 },
      a: [['attack', 4], ['en_bite', 2], ['en_breath_fire2', 2], ['en_poison_bite', 1]],
      drop: ['nectar', 12], rare: ['dragon_shield', 128], steal: ['nectar', 'dragon_shield'],
      desc: 'しし やぎ へびの からだを もつ まもの。 ほのおを はき どくへびの しっぽで かむ。',
    }),
    arashi_harpy: M('あらしハーピー', 'harpy', 25, {
      s: { agi: 1.35, mag: 1.2 }, mp: 16, eva: 8, hue: -120, sat: 1.1, flags: ['flying'], elem: { wind: 0, earth: 0.5, thunder: 1.5 },
      a: [['attack', 3], ['en_claws', 1], ['en_sleep_song', 2], ['en_wind2', 1]],
      drop: ['nectar', 12], rare: ['night_dagger', 128], steal: ['nectar', 'night_dagger'],
      desc: 'あらしを よぶ ハーピー。 たつまきを おこし うたで ねむらせる。',
    }),
    minotauros: M('ミノタウロス', 'minotaur', 26, {
      s: { hp: 1.05, atk: 1.15, agi: 0.8 }, a: [['attack', 4], ['en_horn', 2], ['en_sweep', 1], ['en_focus', 1]],
      drop: ['mega_bomb', 24], rare: ['giant_bracer', 128], steal: ['nectar', 'giant_bracer'],
      desc: 'うしの あたまを もつ きょじん。 おおおのを ふりまわし ツノで つく。',
    }),
    hiryuu: M('ひりゅう', 'wyvern', 27, {
      s: { hp: 0.95, atk: 1.05, agi: 1.15 }, hue: 110, sat: 1.1, flags: ['flying', 'dragon'],
      elem: { wind: 0.5, earth: 0.5, thunder: 1.5, ice: 0.5 }, a: [['attack', 4], ['en_bite', 2], ['en_breath_ice2', 2], ['en_breath_ice3', 1]],
      drop: ['nectar', 12], rare: ['dragon_mail', 128], steal: ['nectar', 'dragon_mail'],
      desc: 'あおい うろこの ひりゅう。 こおりの いきを はいて そらから おそう。',
    }),

    // ======================================================= 星見の塔 (Lv25–30)
    gargoyle: M('ガーゴイル', 'gargoyle', 25, {
      s: { hp: 1.1, def: 1.6, agi: 0.9 }, flags: ['flying'], elem: { earth: 0.5, thunder: 1.5, wind: 1.0 },
      statusRes: { paralyze: 0.5, poison: 0.5 }, a: [['attack', 4], ['en_claws', 2], ['en_gaze', 1], ['en_harden', 1]],
      drop: ['all_cure', 12], rare: ['seed_vit', 32], steal: ['all_cure'],
      desc: 'とうを まもる いしの まもの。 ふだんは ちょうぞうの ふりを している。',
    }),
    hoshi_hitomi: M('ほしのひとみ', 'eyeball', 26, {
      s: { hp: 1.15, mag: 1.3, agi: 1.1 }, mp: 30, hue: -60, sat: 1.2, flags: ['flying'], elem: { dark: 1.5, holy: 0.5, earth: 0.5 },
      a: [['attack', 2], ['en_gaze', 2], ['en_evil_eye', 1], ['en_thunder2', 1], ['en_mp_drain', 1]],
      drop: ['mana_crystal', 32], rare: ['wisdom_ring', 128], steal: ['mana_drop', 'wisdom_ring'],
      desc: 'ほしぞらを うつす ふしぎな め。 みつめられると まりょくを すわれる。',
    }),
    nagareboshi: M('ながれぼし', 'wisp', 26, {
      s: { hp: 0.95, mag: 1.35, mdef: 1.5, agi: 1.25 }, mp: 24, hue: -160, sat: 1.2, bri: 1.1, flags: ['flying'],
      elem: { holy: 0.5, dark: 1.5 }, a: [['attack', 2], ['en_stardust', 2], ['en_blast', 1]],
      drop: ['mana_drop', 12], rare: ['seed_int', 32], steal: ['mana_drop', 'seed_int'],
      desc: 'よぞらから おちてきた ほしの かけら。 ほしくずを ふらせる。',
    }),
    hoshi_madoushi: M('ほしのまどうし', 'darkmage', 27, {
      s: { hp: 0.95, mag: 1.45, mdef: 1.6 }, mp: 44, hue: -50, sat: 1.1, elem: { holy: 1.5, dark: 0.5 },
      a: [['attack', 1], ['en_ice2', 2], ['en_thunder2', 2], ['en_silence', 1], ['en_protect', 1], ['en_healing', 1]],
      drop: ['mana_drop', 8], rare: ['magic_orb', 128], steal: ['mana_crystal', 'magic_orb'],
      desc: 'ほしの ちからを もとめて とうに こもった まどうし。 たくさんの じゅもんを あやつる。',
    }),
    hoshi_banpei: M('ほしのばんぺい', 'armor', 28, {
      s: { hp: 1.15, def: 1.8, agi: 0.7, mdef: 1.0 }, hue: 180, sat: 1.2, bri: 1.1,
      elem: { thunder: 1.5, dark: 1.5, holy: 0.5 }, statusRes: { poison: 1, death: 0.6 },
      a: [['attack', 4], ['en_double', 2], ['en_light_blade', 1], ['en_harden', 1]],
      drop: ['nectar', 16], rare: ['regen_ring', 128], steal: ['nectar', 'regen_ring'],
      desc: 'ほしの ひかりで うごく こがねの よろい。 とうの さいじょうかいを まもる。',
    }),
    hoshi_modoki: M('ほしのたからもどき', 'mimic', 29, {
      s: { hp: 2.3, atk: 1.35, def: 1.4, agi: 1.1, mdef: 1.2 }, rw: 2.5, gm: 2, mp: 16, hue: -150, sat: 1.1, statusRes: MIMIC_RES,
      a: [['attack', 3], ['en_bite', 2], ['en_whisper', 1], ['en_thunder2', 1]],
      drop: ['mana_crystal', 8], rare: ['goddess_tear', 24], steal: ['nectar', 'wisdom_ring'],
      desc: 'ほしの もようの たからばこに ばけた まもの。 いかずちまで あやつる。',
    }),

    // ======================================================= さいはての うみ (Lv27–31)
    yoroi_gani: M('よろいがに', 'crab', 28, {
      s: { hp: 1.38, atk: 1.1, def: 2.1, mdef: 0.8, agi: 0.7 }, hue: -150, sat: 0.35, bri: 0.75,
      elem: { thunder: 2, water: 0, fire: 0.75 }, a: [['attack', 4], ['en_claws', 2], ['en_harden', 1]],
      drop: ['nectar', 16], rare: ['seed_vit', 32], steal: ['nectar'],
      desc: 'はがねの ような こうらを もつ かに。 ちからじまんの せんしも てこずる。',
    }),
    kaijin_shougun: M('かいじんしょうぐん', 'merman', 29, {
      s: { hp: 1.32, atk: 1.21, mag: 1.1 }, mp: 18, hue: 120, sat: 1.1, elem: AQUA,
      a: [['attack', 4], ['en_pierce', 2], ['en_ice2', 1], ['en_protect', 1]],
      drop: ['mana_crystal', 32], rare: ['night_dagger', 96], steal: ['nectar', 'night_dagger'],
      desc: 'うみの へいしを したがえる しょうぐん。 さんさの ほこで つらぬく。',
    }),
    fukami_nushi: M('ふかみのぬし', 'kraken', 30, {
      s: { hp: 1.14, atk: 1.16, agi: 0.6 }, hue: -90, bri: 0.75, elem: AQUA,
      a: [['attack', 3], ['en_tentacles', 2], ['en_ink', 1], ['en_breath_ice2', 1]],
      drop: ['nectar', 12], rare: ['goddess_tear', 96], steal: ['nectar', 'goddess_tear'],
      desc: 'うみの いちばん ふかい ところから やってくる ぬし。 ひかりを きらう。',
    }),

    // ======================================================= 魔王島 (Lv30–34)
    demon_hei: M('デーモンへい', 'demon', 31, {
      s: { hp: 0.95, atk: 1.05, mag: 1.1 }, mp: 20, elem: Object.assign({ fire: 0.5 }, DEMON),
      a: [['attack', 4], ['en_pierce', 2], ['en_fire2', 1], ['en_dark', 1]],
      drop: ['mana_crystal', 24], rare: ['dusk_sword', 128], steal: ['nectar', 'dusk_sword'],
      desc: 'まおうぐんの さきぶれを つとめる あくまの へいし。',
    }),
    jigoku_mushi: M('じごくむし', 'sandworm', 31, {
      s: { hp: 1.1, atk: 1.05, agi: 0.5 }, hue: -30, sat: 1.1, bri: 0.7, elem: { water: 1.5, ice: 1.5, earth: 0.5 },
      a: [['attack', 4], ['en_bite_crush', 1], ['en_breath_poison', 2], ['en_sand', 1]],
      drop: ['nectar', 12], rare: ['seed_hp', 24], steal: ['nectar', 'seed_hp'],
      desc: 'まかいの だいちを くいやぶって あらわれる きょだいな むし。',
    }),
    kogane_jelly: M('こがねゼリー', 'jelly', 32, {
      hp: 10, def: 255, s: { agi: 2.4, atk: 0.85, mag: 1.0 }, mdef: 255, eva: 10, mp: 12,
      exp: 3000, jp: 150, gold: 2000, hue: -100, sat: 1.3, bri: 1.15, flags: ['metal', 'flee'], fleeRate: 0.3,
      statusRes: METAL_RES, a: [['attack', 3], ['en_blast', 2]],
      drop: ['light_drop', 8], rare: ['golden_maneki', 64], steal: ['mana_crystal', 'goddess_tear'],
      desc: 'きんいろに かがやく まぼろしの ゼリー。 たおせば たくさんの ゴールドが てにはいる。',
    }),
    yami_kimaira: M('やみキマイラ', 'chimera', 32, {
      s: { hp: 0.95, atk: 1.05, agi: 1.1 }, hue: -140, sat: 0.9, bri: 0.75, flags: ['flying'],
      elem: { holy: 1.5, dark: 0.5, earth: 0.5 }, a: [['attack', 4], ['en_bite', 2], ['en_breath_fire3', 1], ['en_poison_bite', 1]],
      drop: ['nectar', 12], rare: ['dragon_mail', 96], steal: ['nectar', 'dragon_mail'],
      desc: 'やみに そまった キマイラ。 はげしい ほのおを はく。',
    }),
    kuro_minotauros: M('くろミノタウロス', 'minotaur', 32, {
      s: { hp: 1.05, atk: 1.15, agi: 0.8 }, sat: 0.6, bri: 0.55, a: [['attack', 4], ['en_horn', 2], ['en_sweep', 1], ['en_crush', 1]],
      drop: ['mega_bomb', 16], rare: ['earth_axe', 256], steal: ['nectar', 'kirin_claw'],
      desc: 'まかいの ちからを えた くろい ミノタウロス。 いちげきで いわを くだく。',
    }),

    // ======================================================= 魔王城 (Lv31–38)
    yami_kenshi: M('やみのけんし', 'skeleton', 32, {
      s: { hp: 1.09, atk: 1.31, agi: 1.1 }, hue: -100, sat: 1.4, bri: 0.6, flags: ['undead'], elem: UNDEAD_LATE, statusRes: UNDEAD_RES,
      a: [['attack', 4], ['en_double', 3], ['en_curse', 1]],
      drop: ['revive_feather', 16], rare: ['amatsukaze', 256], steal: ['holy_water', 'night_dagger'],
      desc: 'まおうに たましいを うった けんしの なれのはて。 すばやい れんぞくぎりを はなつ。',
    }),
    jigoku_bourei: M('じごくのぼうれい', 'ghost', 32, {
      s: { hp: 0.98, atk: 1.19, def: 0.6, mdef: 1.3, mag: 1.2 }, mp: 20, eva: 14, hue: 130, sat: 1.3, flags: ['undead', 'flying'],
      elem: Object.assign({}, UNDEAD_LATE, { dark: -1 }), statusRes: UNDEAD_RES,
      a: [['attack', 2], ['en_life_suck', 2], ['en_dark2', 1], ['en_curse', 1]],
      drop: ['holy_water', 8], rare: ['goddess_charm', 256], steal: ['mana_crystal', 'goddess_robe'],
      desc: 'じごくの そこから よびだされた ぼうれい。 やみの うずで すべてを のみこむ。',
    }),
    yami_kishi: M('やみのきし', 'armor', 33, {
      s: { hp: 1.19, atk: 1.19, def: 1.8, mdef: 1, agi: 0.75 }, hue: 40, sat: 2, bri: 0.5,
      elem: { holy: 1.5, thunder: 1.5, dark: 0 }, statusRes: { poison: 1, death: 0.7 },
      a: [['attack', 4], ['en_heavy', 2], ['en_sweep', 1], ['en_harden', 1]],
      drop: ['nectar', 12], rare: ['dawn_shield', 256], steal: ['nectar', 'dragon_shield'],
      desc: 'まおうじょうを まもる くろい よろいの きし。 そのけんは おもく するどい。',
    }),
    magan: M('まがん', 'eyeball', 33, {
      s: { hp: 1.19, atk: 1.19, agi: 1.1, mag: 1.3 }, mp: 30, hue: 80, sat: 1.2, bri: 0.9, flags: ['flying'],
      elem: { holy: 1.5, dark: 0, earth: 0.5 }, a: [['attack', 2], ['en_gaze', 2], ['en_evil_eye', 1], ['en_dark', 1], ['en_death', 1]],
      drop: ['mana_crystal', 24], rare: ['orb_rod', 256], steal: ['mana_crystal', 'wisdom_ring'],
      desc: 'まおうの め と よばれる まもの。 しの じゅもんを となえる。',
    }),
    yami_gargoyle: M('やみのガーゴイル', 'gargoyle', 33, {
      s: { hp: 1.14, atk: 1.19, def: 1.6, agi: 0.95 }, hue: 50, sat: 2.5, bri: 0.6, flags: ['flying'],
      elem: { earth: 0.5, holy: 1.5, dark: 0 }, statusRes: { paralyze: 0.5, poison: 0.5 },
      a: [['attack', 4], ['en_claws', 2], ['en_gaze', 1], ['en_breath_fire3', 1]],
      drop: ['nectar', 12], rare: ['moon_bow', 256], steal: ['nectar', 'seed_vit'],
      desc: 'まおうじょうの やねに ならぶ やみの せきぞう。 ほのおを はいて とびかかる。',
    }),
    yami_shisai: M('やみのしさい', 'darkmage', 34, {
      s: { hp: 1.03, atk: 1.19, mdef: 1.6, mag: 1.45 }, mp: 40, hue: 100, sat: 1.1, bri: 0.75, elem: { holy: 2, dark: -1 },
      a: [['attack', 1], ['en_dark2', 2], ['en_ice3', 1], ['en_heal_all', 1], ['en_revive', 1]],
      drop: ['mana_crystal', 16], rare: ['angel_staff', 256], steal: ['mana_crystal', 'goddess_lyre'],
      desc: 'まおうを あがめる やみの しさい。 たおれた なかまを よみがえらせる。',
    }),
    shi_no_hako: M('しのはこ', 'mimic', 34, {
      s: { hp: 2.37, atk: 1.61, def: 1.4, mdef: 1.2, agi: 1.1 }, rw: 2.5, gm: 2, mp: 20, hue: -110, sat: 1.2, bri: 0.6, statusRes: MIMIC_RES,
      a: [['attack', 3], ['en_bite_crush', 2], ['en_whisper', 1], ['en_dark2', 1]],
      drop: ['light_drop', 8], rare: ['galaxy_dagger', 48], steal: ['mana_crystal', 'goddess_tear'],
      desc: 'くろい たからばこに ばけた まもの。 あけた ものに しを もたらす。',
    }),
    kokuryuu: M('こくりゅう', 'wyvern', 35, {
      s: { hp: 0.88, atk: 1.31, agi: 1.1 }, hue: 150, sat: 0.8, bri: 0.55, flags: ['flying', 'dragon'],
      elem: { holy: 1.5, dark: 0.5, earth: 0.5, fire: 0.5 }, a: [['attack', 4], ['en_bite', 2], ['en_breath_fire3', 2], ['en_tail', 1]],
      drop: ['nectar', 12], rare: ['sky_spear', 256], steal: ['nectar', 'dawn_sword'],
      desc: 'やみに そまった くろい りゅう。 はげしい ほのおで すべてを やきつくす。',
    }),
    akuma_kishi: M('あくまきし', 'demon', 36, {
      s: { hp: 0.84, atk: 1.31, mag: 1.15 }, mp: 30, hue: -130, sat: 1.1, bri: 0.85, elem: Object.assign({ ice: 0.5 }, DEMON),
      a: [['attack', 4], ['en_pierce', 2], ['en_dark2', 1], ['en_inferno', 1]],
      drop: ['mana_crystal', 16], rare: ['dawn_helm', 256], steal: ['nectar', 'goddess_crown'],
      desc: 'まおうの そっきんを つとめる あくまの きし。 やみと ほのおの じゅもんを つかう。',
    }),
    madou_hei: M('まどうへい', 'golem', 36, {
      s: { hp: 1.01, atk: 1.19, def: 1.6, mdef: 1, agi: 0.5 }, hue: -120, sat: 1.4, bri: 0.7,
      elem: { thunder: 1.5, holy: 1.5, earth: 0.5, dark: 0.5 }, statusRes: GOLEM_RES,
      a: [['attack', 4], ['en_crush', 2], ['en_quake', 1]],
      drop: ['mega_bomb', 16], rare: ['dawn_armor', 256], steal: ['nectar', 'phoenix_garb'],
      desc: 'まほうの ちからで うごく くろい きょじんへい。 まおうじょうの もんばん。',
    }),
  });
})(window.RPG);
