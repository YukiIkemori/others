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
   *   fam (element families, see FAMILIES) elem (exceptions) statusRes flags drop:[item,rate] rare:[item,rate] steal:[item, rare] hue sat bri desc fleeRate
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
    if (o.fam) { d.fam = o.fam; const e = famElem(o.fam, o.elem); if (Object.keys(e).length) d.elem = e; } else if (o.elem) d.elem = o.elem;
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

  // ------------------------------------------------ element policy (DESIGN §5.5 "Element policy")
  // Every monster lists its families in `fam` (data-only; the game reads `elem`). A monster's elem is
  // its families' profiles merged left to right (a later family overrides an element of an earlier
  // one), then its own `elem` for the few exceptions. Weak ×2, resist ×0.5, immune 0, absorb −1.
  // Absorb only where the body *is* the element (water jelly / octopus, lava / fire wisp, ice / snow
  // spirit, ghost, wind spirit). Checked by tools/check_elements.js (12–20 weak regulars per element).
  const FAMILIES = R.ELEM_FAMILIES = {
    wing:    { name: '翼で飛ぶ敵（コウモリ・ハチ・鳥・竜・キマイラ・ガーゴイル・小悪魔）', elem: { wind: 2, earth: 0 } },
    float:   { name: '宙に浮かぶ敵（亡霊・火の玉・目玉・精霊）', elem: { earth: 0.5 } },
    beast:   { name: '地を駆ける獣・亜人（ネズミ・オオカミ・ゴブリン・オーク・ミノタウロス）', elem: { earth: 2 } },
    rock:    { name: '岩・石・ゴーレム', elem: { water: 2, earth: 2, fire: 0.5 } },
    sand:    { name: '砂漠の生き物（サソリ・砂もぐり）', elem: { water: 2, earth: 0.5 } },
    plant:   { name: '植物・キノコ', elem: { fire: 2, water: 0.5 } },
    bug:     { name: '虫', elem: { fire: 2 } },
    reptile: { name: 'ヘビ・トカゲ・竜', elem: { ice: 2 } },
    sea:     { name: '海の生き物（水のゼリー・タコ）', elem: { thunder: 2, water: -1 } },
    shore:   { name: '水辺の生き物（魚人・カニ・海ヘビ）', elem: { thunder: 2, water: 0.5 } },
    metal:   { name: '鎧・金属', elem: { thunder: 2 } },
    flame:   { name: '炎の体（火トカゲ・溶岩・火の玉）', elem: { ice: 2, water: 2, fire: -1 } },
    frost:   { name: '氷の体（雪と氷の精霊・氷ゼリー）', elem: { fire: 2, ice: -1 } },
    snow:    { name: '雪国の獣（毛皮で寒さに強い）', elem: { fire: 2, ice: 0.5 } },
    gale:    { name: '風の体', elem: { wind: -1 } },
    undead:  { name: 'アンデッド', elem: { holy: 2, dark: -1 } },
    demon:   { name: '悪魔・闇の使い手', elem: { holy: 2, dark: 0 } },
    shade:   { name: '闇に染まった魔物（「闇」「黒」の名を持つ）', elem: { dark: 0.5 } },
    light:   { name: '光・星・精霊', elem: { dark: 2, holy: 0.5 } },
    eye:     { name: '目玉（闇に目がくらむ）', elem: { dark: 2 } },
    human:   { name: '人間', elem: { dark: 2 } },
    plain:   { name: '弱点なし（ふつうのゼリー・宝箱もどき）', elem: {} },
  };
  /** merged element table of a family list (+ exceptions) */
  const famElem = R.famElem = (fam, extra) => {
    const e = {};
    for (const f of fam || []) Object.assign(e, FAMILIES[f].elem);
    return Object.assign(e, extra || {});
  };

  Object.assign(R.DB.monsters, {
    // ======================================================= レグナス周辺 (Lv1–4)
    puchi_jelly: M('プチゼリー', 'jelly', 1, {
      fam: ['plain'],
      s: { hp: 1.1, atk: 0.9, agi: 0.8 }, a: [['attack', 1]],
      drop: ['herb', 8], rare: ['clover', 128], steal: ['herb', 'clover'],
      desc: 'ぷるぷると震える小さなゼリー。\n弱いが、仲間と群れで現れる。',
    }),
    chibi_bat: M('チビコウモリ', 'bat', 1, {
      fam: ['wing'],
      s: { hp: 0.9, agi: 1.4 }, eva: 8, flags: ['flying'], a: [['attack', 1]],
      drop: ['eye_drop', 10], rare: ['seed_agi', 96], steal: ['eye_drop'],
      desc: '暗がりから飛び出してくる\nコウモリの子ども。すばしこい。',
    }),
    kajiri_rat: M('かじりネズミ', 'rat', 2, {
      fam: ['beast'],
      s: { atk: 1.1, agi: 1.2 }, a: [['attack', 5], ['en_bite', 2]],
      drop: ['herb', 10], rare: ['seed_luk', 96], steal: ['herb', 'seed_luk'],
      desc: '何でもかじってしまう\n食いしん坊のネズミ。前歯が自慢。',
    }),
    kusa_hebi: M('草ヘビ', 'snake', 2, {
      fam: ['reptile'],
      s: { hp: 1.05, atk: 1.1, agi: 0.9 }, a: [['attack', 5], ['en_poison_bite', 2]],
      drop: ['antidote', 8], rare: ['fairy_knife', 128], steal: ['antidote'],
      desc: '草むらにひそむ緑のヘビ。\n噛まれると毒が回る。',
    }),
    warai_take: M('笑いダケ', 'mushroom', 2, {
      fam: ['plant'],
      s: { hp: 1.5, atk: 0.9, agi: 0.6 }, a: [['attack', 5], ['en_sleep_spore', 2]],
      drop: ['smelling_salts', 10], rare: ['seed_hp', 64], steal: ['herb'],
      desc: 'けらけらと笑う赤いキノコ。\n眠りの粉をまき散らす。',
    }),
    goblin: M('ゴブリン', 'goblin', 3, {
      fam: ['beast'],
      s: { hp: 1.05, atk: 1.16, agi: 0.95 }, gm: 1.5, a: [['attack', 5], ['en_heavy', 2]],
      drop: ['herb', 8], rare: ['swallow_sword', 128], steal: ['herb', 'swallow_sword'],
      desc: 'こん棒を振り回す小鬼の一族。\n光り物に目がない。',
    }),
    hari_bachi: M('針バチ', 'bee', 3, {
      fam: ['bug', 'wing'],
      s: { hp: 0.9, atk: 1.1, agi: 1.4 }, eva: 6, flags: ['flying'],
      a: [['attack', 4], ['en_poison_sting', 3]],
      drop: ['antidote', 8], rare: ['seed_agi', 96], steal: ['antidote'],
      desc: 'お尻の毒針で刺してくる大きなハチ。\n羽音が目印。',
    }),

    // ======================================================= 風の洞窟 (Lv3–6)
    hora_bat: M('洞窟コウモリ', 'bat', 3, {
      fam: ['wing'],
      s: { hp: 1.05, agi: 1.3 }, eva: 8, hue: 110, sat: 0.7, flags: ['flying'],
      a: [['attack', 4], ['en_drain', 3]],
      drop: ['eye_drop', 8], rare: ['seed_agi', 96], steal: ['eye_drop'],
      desc: '洞窟の天井にぶら下がるコウモリ。\n生き物の血を吸う。',
    }),
    iwa_jelly: M('岩ゼリー', 'jelly', 4, {
      fam: ['rock'],
      s: { hp: 1.35, def: 2.2, agi: 0.6, mdef: 0.8 }, hue: -120, sat: 0.35, bri: 0.85,
      a: [['attack', 4], ['en_charge', 2], ['en_harden', 1]],
      drop: ['herb', 8], rare: ['seed_vit', 64], steal: ['herb', 'seed_vit'],
      desc: '石ころを取り込んで硬くなったゼリー。\n武器がはじかれる。',
    }),
    kaze_kodama: M('風のこだま', 'wisp', 4, {
      fam: ['gale', 'light', 'float'],
      s: { hp: 0.9, mag: 1.3, mdef: 1.5, def: 0.8, agi: 1.2 }, mp: 12, hue: -80, sat: 1.1, flags: ['flying'],
      a: [['attack', 3], ['en_wind', 3]],
      drop: ['wing', 12], rare: ['clover', 96], steal: ['wing', 'clover'],
      desc: '洞窟を吹き抜ける風が形を得た精霊。\nかまいたちを起こす。',
    }),
    doku_take: M('毒ダケ', 'mushroom', 4, {
      fam: ['plant'],
      s: { hp: 1.5, atk: 0.95, agi: 0.6 }, hue: -80,
      a: [['attack', 4], ['en_poison_spore', 2], ['en_sleep_spore', 1]],
      drop: ['antidote', 6], rare: ['seed_hp', 64], steal: ['antidote'],
      desc: '紫色のかさを持つキノコ。\n毒の胞子をばらまく。',
    }),
    hob_goblin: M('ホブゴブリン', 'goblin', 5, {
      fam: ['beast'],
      s: { hp: 1.2, atk: 1.1 }, hue: -70, bri: 0.8, gm: 1.5,
      a: [['attack', 5], ['en_heavy', 2], ['en_herb', 2, { hpBelow: 0.5, once: true }]],
      drop: ['fire_bomb', 16], rare: ['swallow_sword', 96], steal: ['herb', 'swallow_sword'],
      desc: 'ゴブリンの中でも体の大きな戦士。\n薬草をかじりながら戦う。',
    }),
    koakuma: M('小悪魔', 'imp', 5, {
      fam: ['demon', 'wing'],
      s: { hp: 0.95, mag: 1.2, agi: 1.2, mdef: 1.3 }, mp: 10, flags: ['flying'],
      a: [['attack', 4], ['en_fire', 3], ['en_blind', 1]],
      drop: ['holy_water', 12], rare: ['fairy_knife', 96], steal: ['holy_water', 'fairy_knife'],
      desc: 'いたずら好きの小さな悪魔。\nファイアボールを覚えている。',
    }),

    // ======================================================= 東の平原 (Lv5–8)
    nora_wolf: M('野良オオカミ', 'wolf', 5, {
      fam: ['beast'],
      s: { hp: 1.1, atk: 1.1, agi: 1.3 }, a: [['attack', 5], ['en_bite', 3]],
      drop: ['herb', 8], rare: ['seed_agi', 64], steal: ['herb'],
      desc: '群れで狩りをする野良のオオカミ。\n獲物の周りをぐるぐる回る。',
    }),
    shizuku_jelly: M('しずくゼリー', 'jelly', 6, {
      fam: ['sea'],
      s: { hp: 1.26, atk: 1.05, mag: 1.2 }, mp: 12, hue: 60, sat: 1.1,
      a: [['attack', 5], ['en_heal', 3]],
      drop: ['healing_grass', 16], rare: ['gold_charm', 128], steal: ['herb', 'seed_mp'],
      desc: '水をたっぷり含んだ青いゼリー。\n仲間の傷をヒールで癒やす。',
    }),
    kuitsuki_sou: M('食いつき草', 'plant', 6, {
      fam: ['plant'],
      s: { hp: 1.49, atk: 1.16, agi: 0.55 }, a: [['attack', 4], ['en_bite', 2], ['en_sleep_spore', 1]],
      drop: ['antidote', 8], rare: ['seed_vit', 64], steal: ['herb'],
      desc: '近づく者に噛みつく肉食の花。\n甘い香りで獲物を誘う。',
    }),
    kuma_bachi: M('クマバチ', 'bee', 6, {
      fam: ['bug', 'wing'],
      s: { hp: 1.04, atk: 1.05, agi: 1.35 }, eva: 6, hue: -25, bri: 0.75, flags: ['flying'],
      a: [['attack', 4], ['en_numb_sting', 2], ['en_poison_sting', 1]],
      drop: ['numb_cure', 10], rare: ['cat_hood', 128], steal: ['numb_cure'],
      desc: '黒い体の大きなハチ。\nしびれ毒で獲物を動けなくする。',
    }),
    madara_hebi: M('まだらヘビ', 'snake', 7, {
      fam: ['reptile'],
      s: { hp: 1.16, atk: 1.05 }, hue: 150, sat: 0.9, a: [['attack', 4], ['en_poison_bite', 2], ['en_bind', 1]],
      drop: ['antidote', 6], rare: ['seed_luk', 64], steal: ['antidote'],
      desc: 'まだら模様の毒ヘビ。\n絡みついて締め上げる。',
    }),
    orc: M('オーク', 'orc', 8, {
      fam: ['beast'],
      s: { hp: 1.04, atk: 1.1, agi: 0.8 }, gm: 1.4, a: [['attack', 5], ['en_heavy', 2], ['en_focus', 1]],
      drop: ['healing_grass', 10], rare: ['gale_spear', 128], steal: ['healing_grass', 'gale_spear'],
      desc: '豚の顔をした大男。\n力は強いが、頭はよくない。',
    }),

    // ======================================================= 盗賊の砦 (Lv7–11)
    banken: M('番犬', 'wolf', 7, {
      fam: ['beast'],
      s: { hp: 1.1, atk: 1.05, agi: 1.25 }, hue: 175, sat: 1.3, bri: 0.9,
      a: [['attack', 4], ['en_bite', 3], ['en_howl', 1]],
      drop: ['herb', 6], rare: ['seed_str', 64], steal: ['herb'],
      desc: '盗賊に飼われている番犬。\n侵入者に飛びかかる。',
    }),
    dobu_nezumi: M('ドブネズミ', 'rat', 7, {
      fam: ['beast'],
      s: { hp: 1.1, agi: 1.25 }, hue: 60, sat: 0.5, bri: 0.8, gm: 1.3, a: [['attack', 4], ['en_poison_bite', 2], ['en_steal', 1]],
      drop: ['antidote', 6], rare: ['seed_luk', 64], steal: ['antidote', 'gold_charm'],
      desc: '砦のゴミをあさるネズミ。\n隙を見てゴールドをくすねていく。',
    }),
    sabi_yoroi: M('さびた鎧', 'armor', 8, {
      fam: ['metal', 'undead'], elem: { dark: 0 },
      s: { hp: 1.26, def: 1.8, mdef: 0.6, agi: 0.6 }, hue: 160, sat: 3, bri: 0.75,
      statusRes: { poison: 1, death: 0.5 },
      a: [['attack', 4], ['en_heavy', 2], ['en_harden', 1]],
      drop: ['iron_shield', 32], rare: ['seed_vit', 64], steal: ['herb', 'seed_vit'],
      desc: 'さびついた鎧に宿った恨みの魂。\n中身は空っぽ。',
    }),
    yatoware_madoushi: M('雇われ魔導士', 'darkmage', 8, {
      fam: ['human'],
      s: { hp: 0.99, def: 0.8, mdef: 1.5, mag: 1.4 }, mp: 16,
      a: [['attack', 2], ['en_fire', 3], ['en_sleep', 2]],
      drop: ['mana_drop', 16], rare: ['cat_hood', 96], steal: ['mana_drop', 'cat_hood'],
      desc: '金で盗賊に雇われた魔導士。\n眠りの霧を使う。',
    }),
    takara_modoki: M('宝箱もどき', 'mimic', 9, {
      fam: ['plain'],
      s: { hp: 2.2, atk: 1.35, def: 1.3, agi: 1.1, mdef: 1.2 }, rw: 2.5, gm: 2, statusRes: MIMIC_RES,
      a: [['attack', 3], ['en_bite', 3], ['en_gaze', 1]],
      drop: ['revive_feather', 8], rare: ['gold_charm', 24], steal: ['fire_bomb', 'gold_charm'],
      desc: '宝箱に化けた魔物。\n開けようとした者に食らいつく。',
    }),

    // ======================================================= 最初の海 (Lv9–12)
    umi_jelly: M('海ゼリー', 'jelly', 9, {
      fam: ['sea'],
      s: { hp: 1.32, atk: 1.1, mag: 1.1 }, mp: 12, hue: 80, bri: 0.85,
      a: [['attack', 5], ['en_water', 2], ['en_acid', 1], ['en_heal', 1]],
      drop: ['healing_grass', 10], rare: ['seed_mp', 64], steal: ['healing_grass'],
      desc: '海水で育った深い青色のゼリー。\n波に乗ってやってくる。',
    }),
    oobasami: M('大バサミ', 'crab', 10, {
      fam: ['shore'],
      s: { hp: 1.26, atk: 1.1, def: 1.9, mdef: 0.8, agi: 0.7 },
      a: [['attack', 4], ['en_claws', 2], ['en_harden', 1]],
      drop: ['healing_grass', 10], rare: ['seed_vit', 64], steal: ['healing_grass'],
      desc: '大きなはさみを持つカニ。\n甲羅は武器をはじくほど硬い。',
    }),
    umi_hebi: M('海ヘビ', 'snake', 10, {
      fam: ['shore'],
      s: { hp: 1.26, atk: 1.1, agi: 1.1 }, hue: 90,
      a: [['attack', 4], ['en_bind', 2], ['en_poison_bite', 1]],
      drop: ['antidote', 6], rare: ['seed_hp', 64], steal: ['antidote'],
      desc: '海を滑るように泳ぐヘビ。\n船べりからはい上がってくる。',
    }),
    gyojin_hei: M('魚人兵', 'merman', 11, {
      fam: ['shore'],
      s: { hp: 1.21, atk: 1.16 }, mp: 9, a: [['attack', 4], ['en_pierce', 2], ['en_water', 1]],
      drop: ['mana_drop', 16], rare: ['float_shoes', 128], steal: ['healing_grass', 'float_shoes'],
      desc: '矛を持った海の兵士。\n船を襲って宝を奪う。',
    }),
    oodako: M('大ダコ', 'kraken', 12, {
      fam: ['sea'],
      s: { hp: 1.03, atk: 1.1, agi: 0.6 }, a: [['attack', 3], ['en_tentacles', 2], ['en_ink', 2]],
      drop: ['healing_grass', 8], rare: ['study_charm', 96], steal: ['healing_grass', 'study_charm'],
      desc: '船を丸ごと巻き込む大きなタコ。\n墨を吐いて目をくらます。',
    }),

    // ======================================================= エルフィンの森 (Lv10–13)
    madowashi_take: M('惑わしダケ', 'mushroom', 10, {
      fam: ['plant'],
      s: { hp: 1.45, atk: 0.95, agi: 0.6 }, hue: -140,
      a: [['attack', 4], ['en_confuse_spore', 2], ['en_poison_spore', 1]],
      drop: ['smelling_salts', 8], rare: ['seed_mnd', 64], steal: ['smelling_salts'],
      desc: '青白く光るキノコ。\n胞子を吸うと頭がくらくらする。',
    }),
    harpy: M('ハーピー', 'harpy', 11, {
      fam: ['wing'],
      s: { agi: 1.3, mag: 1.1 }, mp: 9, eva: 8, flags: ['flying'],
      a: [['attack', 4], ['en_sleep_song', 2], ['en_wind', 1]],
      drop: ['smelling_salts', 8], rare: ['float_shoes', 96], steal: ['smelling_salts', 'float_shoes'],
      desc: '鳥の翼を持つ魔物。\n歌声で旅人を眠らせる。',
    }),
    mori_ookami: M('森オオカミ', 'wolf', 11, {
      fam: ['beast'],
      s: { agi: 1.3, atk: 1.05 }, hue: -90, sat: 1.3,
      a: [['attack', 4], ['en_bite', 2], ['en_howl', 1]],
      drop: ['healing_grass', 10], rare: ['seed_str', 64], steal: ['herb'],
      desc: '深い森にすむ緑の毛並みのオオカミ。\n叫びで仲間を奮い立たせる。',
    }),
    doku_bana: M('毒花', 'plant', 11, {
      fam: ['plant'],
      s: { hp: 1.35, atk: 1.05, agi: 0.55 }, hue: -60,
      a: [['attack', 3], ['en_bite', 2], ['en_breath_poison', 2], ['en_regrow', 2, { hpBelow: 0.5, once: true }]],
      drop: ['antidote', 6], rare: ['prayer_staff', 128], steal: ['antidote', 'all_cure'],
      desc: '紫の花びらを開く毒の花。\n毒ガスを吐く。',
    }),
    kitsunebi: M('狐火', 'wisp', 12, {
      fam: ['flame', 'light', 'float'],
      s: { hp: 0.9, mag: 1.35, mdef: 1.5, agi: 1.2 }, mp: 18, hue: 180, flags: ['flying'],
      a: [['attack', 2], ['en_fire', 3], ['en_fire2', 1]],
      drop: ['mana_drop', 16], rare: ['dream_robe', 128], steal: ['mana_drop', 'dream_robe'],
      desc: '夜の森をさまよう妖しい火の玉。\n人を迷わせる。',
    }),

    // ======================================================= 水の洞窟 (Lv12–15)
    lizardman: M('リザードマン', 'lizardman', 13, {
      fam: ['reptile'],
      s: { hp: 1.1, atk: 1.05 },
      a: [['attack', 5], ['en_double', 2], ['en_tail', 1]],
      drop: ['healing_grass', 10], rare: ['lightning_sword', 128], steal: ['healing_grass', 'lightning_sword'],
      desc: '剣と盾を操るトカゲの戦士。\n水辺を縄張りにしている。',
    }),
    iwa_gani: M('岩ガニ', 'crab', 13, {
      fam: ['rock', 'shore'],
      s: { hp: 1.15, def: 2.0, agi: 0.65, mdef: 0.8 }, hue: 30, sat: 0.45, bri: 0.85,
      a: [['attack', 4], ['en_claws', 2], ['en_harden', 1]],
      drop: ['guard_bell', 24], rare: ['seed_vit', 48], steal: ['healing_grass'],
      desc: '岩のような甲羅を背負ったカニ。\n自慢のはさみで切り裂く。',
    }),
    mizu_bourei: M('水の亡霊', 'ghost', 13, {
      fam: ['undead', 'float'],
      s: { hp: 0.95, def: 0.6, mdef: 1.3 }, eva: 14, hue: -60, sat: 1.2, flags: ['undead', 'flying'],
      statusRes: UNDEAD_RES,
      a: [['attack', 3], ['en_life_suck', 2], ['en_breath_ice1', 2], ['en_curse', 1]],
      drop: ['holy_water', 8], rare: ['prayer_staff', 96], steal: ['holy_water'],
      desc: '湖に沈んだ者たちの嘆きが\n集まって生まれた亡霊。',
    }),
    doku_mizuchi: M('毒ミズチ', 'snake', 14, {
      fam: ['shore'],
      s: { hp: 1.15, atk: 1.05 }, hue: 160,
      a: [['attack', 4], ['en_poison_bite', 2], ['en_breath_poison', 1], ['en_bind', 1]],
      drop: ['all_cure', 16], rare: ['seed_hp', 48], steal: ['antidote'],
      desc: '地下水脈にすむ毒の水ヘビ。\n毒ガスを吐く。',
    }),

    // ======================================================= 砂漠 (Lv13–16)
    suna_sasori: M('砂サソリ', 'scorpion', 13, {
      fam: ['sand'],
      s: { hp: 1.05, atk: 1.1, def: 1.4, agi: 1 },
      a: [['attack', 4], ['en_poison_sting', 2], ['en_numb_sting', 1]],
      drop: ['antidote', 6], rare: ['seed_agi', 64], steal: ['antidote'],
      desc: '砂に潜って獲物を待つサソリ。\n毒のしっぽを持つ。',
    }),
    togebouzu: M('トゲ坊主', 'cactus', 14, {
      fam: ['plant'],
      s: { hp: 1.26, atk: 1.1, agi: 0.7 }, a: [['attack', 3], ['en_needles', 3], ['en_regrow', 2, { hpBelow: 0.5, once: true }]],
      drop: ['healing_grass', 8], rare: ['maneki', 128], steal: ['healing_grass', 'maneki'],
      desc: '砂漠をぴょこぴょこ歩くサボテン。\n体のトゲを飛ばしてくる。',
    }),
    mummy: M('ミイラ', 'mummy', 15, {
      fam: ['undead'],
      s: { hp: 1.31, atk: 1.1, agi: 0.6 }, flags: ['undead'], statusRes: UNDEAD_RES,
      a: [['attack', 4], ['en_bandage', 2]],
      drop: ['all_cure', 16], rare: ['dream_robe', 128], steal: ['all_cure'],
      desc: '包帯に巻かれた、いにしえの死者。\n包帯を伸ばして絡みつく。',
    }),
    hagane_jelly: M('鋼ゼリー', 'jelly', 15, {
      hp: 7, hue: 70, sat: 0.25, bri: 0.8, def: 255, s: { agi: 2.6, atk: 0.85, mag: 1.0 }, mdef: 255, eva: 10, mp: 8,
      exp: 1200, jp: 90, gold: 24, flags: ['metal', 'flee'], fleeRate: 0.35,
      statusRes: METAL_RES, a: [['attack', 3], ['en_fire', 2]],
      drop: ['seed_luk', 12], rare: ['speed_boots', 48], steal: ['mana_drop', 'loot_bag'],
      desc: '鋼のように硬いゼリー。すぐ逃げる。\n倒せば多くの経験値とJPが得られる。',
    }),
    suna_mogura: M('砂もぐり', 'sandworm', 16, {
      fam: ['sand'],
      s: { hp: 1.16, atk: 1.16, agi: 0.5 },
      a: [['attack', 4], ['en_bite_crush', 1], ['en_sand', 2]],
      drop: ['healing_aroma', 24], rare: ['rock_claw', 96], steal: ['healing_grass', 'study_charm'],
      desc: '砂の中を泳ぐ巨大な虫。\n大きな口で何でも飲み込む。',
    }),

    // ======================================================= ピラミッド (Lv14–18)
    skeleton: M('スケルトン', 'skeleton', 14, {
      fam: ['undead'],
      s: { hp: 1.16, atk: 1.1 }, flags: ['undead'], statusRes: UNDEAD_RES,
      a: [['attack', 5], ['en_double', 2]],
      drop: ['silver_dagger', 32], rare: ['seed_str', 48], steal: ['holy_water'],
      desc: '剣と盾を持つ骸骨の兵士。\n骨がカタカタと鳴る。',
    }),
    akuryou: M('悪霊', 'ghost', 15, {
      fam: ['undead', 'float'],
      s: { hp: 1.04, atk: 1.05, def: 0.6, mdef: 1.3 }, eva: 14, flags: ['undead', 'flying'],
      statusRes: UNDEAD_RES, a: [['attack', 3], ['en_life_suck', 2], ['en_curse', 1], ['en_evil_eye', 1]],
      drop: ['holy_water', 8], rare: ['study_charm', 96], steal: ['holy_water', 'study_charm'],
      desc: 'ピラミッドをさまよう恨みの魂。\n生き物の命を吸い取る。',
    }),
    noroi_hitomi: M('呪いの瞳', 'eyeball', 16, {
      fam: ['eye', 'float'],
      s: { hp: 1.15, mag: 1.2, agi: 1.1 }, mp: 9, hue: 180, flags: ['flying'],
      a: [['attack', 3], ['en_gaze', 2], ['en_evil_eye', 1], ['en_thunder', 1]],
      drop: ['eye_drop', 6], rare: ['maneki', 128], steal: ['eye_drop'],
      desc: '棺に彫られた呪いの目。\nにらまれると体が動かなくなる。',
    }),
    kuro_sasori: M('黒サソリ', 'scorpion', 16, {
      fam: ['sand'],
      s: { def: 1.5, atk: 1.05 }, hue: -150, sat: 0.6, bri: 0.6,
      a: [['attack', 4], ['en_poison_sting', 2], ['en_numb_sting', 2]],
      drop: ['numb_cure', 8], rare: ['seed_agi', 48], steal: ['antidote'],
      desc: '真っ黒な殻のサソリ。\n2種類の毒を使い分ける。',
    }),
    hakamori: M('墓守', 'darkmage', 17, {
      fam: ['demon'],
      s: { hp: 0.95, mag: 1.4, mdef: 1.6 }, mp: 21, hue: 150, sat: 0.8,
      a: [['attack', 2], ['en_fire2', 2], ['en_sleep', 1], ['en_poison_mist', 1], ['en_heal', 2]],
      drop: ['mana_drop', 12], rare: ['prayer_staff', 96], steal: ['mana_drop', 'prayer_staff'],
      desc: '王の墓を守る闇の神官。\n死者たちの傷を癒やす。',
    }),
    houmotsu_modoki: M('宝物もどき', 'mimic', 17, {
      fam: ['plain'],
      s: { hp: 2.3, atk: 1.35, def: 1.4, agi: 1.1, mdef: 1.2 }, rw: 2.5, gm: 2, hue: 20, sat: 1.3, bri: 1.1, statusRes: MIMIC_RES,
      a: [['attack', 3], ['en_bite', 2], ['en_whisper', 1]],
      drop: ['healing_aroma', 8], rare: ['maneki', 16], steal: ['all_cure', 'maneki'],
      desc: '王家の宝物に化けた魔物。\n死の言葉をささやく。',
    }),

    // ======================================================= 北の海 (Lv16–19)
    hyouga_ni: M('氷河ガニ', 'crab', 17, {
      fam: ['shore'], elem: { ice: 0.5 },
      s: { hp: 1.1, def: 1.9, agi: 0.7, mdef: 0.8 }, hue: 180, sat: 0.9,
      a: [['attack', 4], ['en_claws', 2], ['en_breath_ice1', 1]],
      drop: ['healing_grass', 8], rare: ['seed_vit', 48], steal: ['healing_grass'],
      desc: '氷の海にすむカニ。\n冷たい息で相手を凍らせる。',
    }),
    daiou_dako: M('大王ダコ', 'kraken', 18, {
      fam: ['sea'],
      s: { hp: 0.95, atk: 1.0, agi: 0.6 }, hue: -30, sat: 1.2, bri: 0.9,
      a: [['attack', 3], ['en_tentacles', 2], ['en_ink', 1], ['en_bind', 1]],
      drop: ['nectar', 16], rare: ['water_spear', 96], steal: ['healing_grass', 'light_drop'],
      desc: '北の海の主と呼ばれる大ダコ。\n何本もの足で襲いかかる。',
    }),

    // ======================================================= 雪国 (Lv17–20)
    yukinko: M('雪ん子', 'frostling', 17, {
      fam: ['frost', 'light'],
      s: { hp: 1.0, mag: 1.2 }, mp: 9, a: [['attack', 4], ['en_breath_ice1', 2], ['en_ice', 1]],
      drop: ['healing_grass', 8], rare: ['seed_mnd', 64], steal: ['healing_grass'],
      desc: '雪の精霊の子ども。遊び好きで、\n冷たい息を吹きかけてくる。',
    }),
    yuki_ookami: M('雪オオカミ', 'wolf', 18, {
      fam: ['beast', 'snow'],
      s: { agi: 1.3, atk: 1.05 }, sat: 0.3, bri: 1.25,
      a: [['attack', 4], ['en_bite', 2], ['en_howl', 1], ['en_breath_ice1', 1]],
      drop: ['healing_grass', 8], rare: ['seed_agi', 48], steal: ['healing_grass'],
      desc: '真っ白な毛並みのオオカミ。\n吹雪にまぎれて群れで襲う。',
    }),
    koori_jelly: M('氷ゼリー', 'jelly', 18, {
      fam: ['frost'],
      s: { hp: 1.15, mag: 1.2 }, mp: 12, hue: 50, sat: 0.45, bri: 1.15,
      a: [['attack', 4], ['en_ice', 2], ['en_breath_ice1', 1]],
      drop: ['healing_grass', 8], rare: ['seed_mp', 48], steal: ['healing_grass'],
      desc: '凍りついたゼリー。\n触ると手がくっついて離れない。',
    }),
    yeti: M('イエティ', 'yeti', 19, {
      fam: ['beast', 'snow'],
      s: { hp: 1.05, atk: 1.1 },
      a: [['attack', 4], ['en_heavy', 2], ['en_rampage', 1], ['en_intimidate', 1], ['en_breath_ice2', 1]],
      drop: ['nectar', 16], rare: ['glacier_bow', 128], steal: ['nectar', 'glacier_bow'],
      desc: '雪山にすむ毛むくじゃらの巨人。\n恐ろしい声で相手をすくませる。',
    }),

    // ======================================================= 氷結の洞窟 (Lv19–22)
    tsurara_koumori: M('つららコウモリ', 'bat', 19, {
      fam: ['snow', 'wing'],
      s: { hp: 1.05, agi: 1.3 }, eva: 8, hue: -80, sat: 0.9, bri: 1.1, flags: ['flying'],
      a: [['attack', 4], ['en_drain', 2], ['en_breath_ice1', 1]],
      drop: ['all_cure', 16], rare: ['shadow_dagger', 96], steal: ['all_cure', 'seed_agi'],
      desc: 'つららのような牙を持つコウモリ。\n氷の洞窟にすむ。',
    }),
    hyou_seirei: M('氷の精霊', 'frostling', 20, {
      fam: ['frost', 'light'],
      s: { hp: 1.0, mag: 1.35, mdef: 1.3 }, mp: 24, hue: 40, sat: 1.4,
      a: [['attack', 3], ['en_ice2', 2], ['en_breath_ice2', 1], ['en_slow', 1]],
      drop: ['mana_drop', 12], rare: ['sapphire_rod', 128], steal: ['mana_drop', 'sapphire_rod'],
      desc: '氷結の洞窟を守る氷の精霊。\nアイスストームを唱える。',
    }),
    koori_yoroi: M('氷の鎧', 'armor', 20, {
      fam: ['frost'], elem: { ice: 0 },
      s: { hp: 1.15, def: 1.85, agi: 0.6, mdef: 0.8 }, hue: -35, sat: 1.2, bri: 1.1,
      statusRes: { poison: 1, death: 0.5 },
      a: [['attack', 4], ['en_frost_fist', 2], ['en_harden', 1]],
      drop: ['nectar', 16], rare: ['glacier_sword', 128], steal: ['nectar', 'glacier_sword'],
      desc: '溶けない氷でできた鎧。\n氷の拳で殴りかかる。',
    }),
    fubuki_seirei: M('吹雪の精霊', 'wisp', 21, {
      fam: ['frost', 'light', 'float'],
      s: { hp: 0.95, mag: 1.35, mdef: 1.5, agi: 1.2 }, mp: 20, hue: -20, sat: 0.45, bri: 1.2, flags: ['flying'],
      a: [['attack', 2], ['en_ice2', 2], ['en_breath_ice2', 2]],
      drop: ['mana_drop', 12], rare: ['light_drop', 96], steal: ['mana_drop', 'light_drop'],
      desc: '吹雪の夜に生まれる精霊。\n触れたものを氷漬けにする。',
    }),
    hyouseki_hei: M('氷石兵', 'golem', 21, {
      fam: ['rock', 'frost'], elem: { water: 1, ice: 0 },
      s: { hp: 1.15, def: 1.7, agi: 0.45, mdef: 0.8 }, hue: 180, sat: 1.5, bri: 1.05,
      statusRes: GOLEM_RES,
      a: [['attack', 4], ['en_crush', 2], ['en_stomp', 1]],
      drop: ['nectar', 16], rare: ['ninja_garb', 128], steal: ['nectar', 'ninja_garb'],
      desc: '氷の岩で造られた巨人兵。\n洞窟の奥を守っている。',
    }),

    // ======================================================= 炎の火山 (Lv21–26)
    salamander: M('サラマンダー', 'salamander', 22, {
      fam: ['flame'],
      s: { hp: 1.05, atk: 1.05 }, a: [['attack', 4], ['en_fire_fang', 2], ['en_breath_fire2', 2]],
      drop: ['nectar', 16], rare: ['flame_shield', 128], steal: ['nectar', 'flame_shield'],
      desc: '溶岩の中にすむ火トカゲ。\n背中の炎が燃え盛る。',
    }),
    magma_jelly: M('マグマゼリー', 'jelly', 22, {
      fam: ['flame'],
      s: { hp: 1.15, mag: 1.2 }, mp: 12, hue: -140, sat: 1.3,
      a: [['attack', 4], ['en_breath_fire1', 2], ['en_fire2', 1]],
      drop: ['healing_grass', 8], rare: ['seed_str', 48], steal: ['healing_grass'],
      desc: 'どろどろに溶けた岩のゼリー。\n近寄るとやけどをする。',
    }),
    hinoko_akuma: M('火の粉悪魔', 'imp', 22, {
      fam: ['flame', 'wing'], elem: { fire: 0 },
      s: { hp: 1.0, mag: 1.3, agi: 1.2, mdef: 1.3 }, mp: 20, hue: 30, sat: 1.2, flags: ['flying'],
      a: [['attack', 3], ['en_fire', 2], ['en_fire2', 2]],
      drop: ['mana_drop', 12], rare: ['speed_boots', 128], steal: ['mana_drop', 'speed_boots'],
      desc: '火山にすむ火の粉の悪魔。\n炎の呪文を次々と唱える。',
    }),
    wyvern: M('ワイバーン', 'wyvern', 23, {
      fam: ['reptile', 'wing'], elem: { fire: 0.5 },
      s: { hp: 0.95, atk: 1.05, agi: 1.1 }, flags: ['flying', 'dragon'],
      a: [['attack', 4], ['en_bite', 2], ['en_breath_fire2', 2]],
      drop: ['nectar', 12], rare: ['kagerou', 128], steal: ['nectar', 'kagerou'],
      desc: '空を駆ける竜の仲間。\n炎の息を吐く。',
    }),
    magma_orc: M('マグマオーク', 'orc', 23, {
      fam: ['beast'], elem: { fire: 0.5 },
      s: { hp: 1.0, atk: 1.1, agi: 0.8 }, gm: 1.4, hue: -100, sat: 1.1,
      a: [['attack', 4], ['en_heavy', 2], ['en_sweep', 1], ['en_focus', 1]],
      drop: ['thunder_bomb', 16], rare: ['loot_bag', 128], steal: ['nectar', 'loot_bag'],
      desc: '溶岩で鍛えた体を持つオーク。\n大きな斧を振り回す。',
    }),
    hitokage_hei: M('火トカゲ兵', 'lizardman', 23, {
      fam: ['reptile'], elem: { fire: 0.5 },
      s: { hp: 1.1, atk: 1.05 }, hue: -125, sat: 1.4, bri: 0.95,
      a: [['attack', 4], ['en_double', 2], ['en_breath_fire1', 1], ['en_tail', 1]],
      drop: ['nectar', 16], rare: ['kagerou', 96], steal: ['nectar'],
      desc: '炎のうろこを持つトカゲの戦士。\n火山をすみかにしている。',
    }),
    onibi: M('鬼火', 'wisp', 24, {
      fam: ['flame', 'float'],
      s: { hp: 0.95, mag: 1.4, mdef: 1.5, agi: 1.2 }, mp: 24, hue: 130, sat: 1.1, flags: ['flying'],
      a: [['attack', 2], ['en_blast', 2], ['en_confuse', 1], ['en_fire2', 1]],
      drop: ['mana_drop', 12], rare: ['light_drop', 96], steal: ['mana_drop', 'light_drop'],
      desc: '赤紫に燃える妖しい火の玉。\n爆炎の呪文を唱える。',
    }),
    magma_golem: M('マグマゴーレム', 'golem', 25, {
      fam: ['rock', 'flame'],
      s: { hp: 1.15, def: 1.6, agi: 0.45, mdef: 0.8 }, hue: -30, sat: 1.7, bri: 0.95,
      statusRes: GOLEM_RES, a: [['attack', 4], ['en_crush', 2], ['en_breath_fire2', 1], ['en_quake', 1]],
      drop: ['nectar', 16], rare: ['flame_shield', 96], steal: ['nectar', 'flame_shield'],
      desc: '溶岩が固まって生まれた巨人。\n体から炎が噴き出す。',
    }),

    // ======================================================= アルカナ地方 (Lv24–27)
    kimaira: M('キマイラ', 'chimera', 25, {
      fam: ['beast', 'reptile', 'wing'], elem: { fire: 0.5 },
      s: { hp: 0.95, atk: 1.05, agi: 1.1 }, flags: ['flying'],
      a: [['attack', 4], ['en_bite', 2], ['en_breath_fire2', 2], ['en_poison_bite', 1]],
      drop: ['nectar', 12], rare: ['dragon_shield', 128], steal: ['nectar', 'dragon_shield'],
      desc: '獅子とヤギとヘビの体を持つ魔物。\n炎を吐き、毒ヘビの尾で噛む。',
    }),
    arashi_harpy: M('嵐のハーピー', 'harpy', 25, {
      fam: ['wing'],
      s: { agi: 1.35, mag: 1.2 }, mp: 16, eva: 8, hue: -120, sat: 1.1, flags: ['flying'],
      a: [['attack', 3], ['en_claws', 1], ['en_sleep_song', 2], ['en_wind2', 1]],
      drop: ['nectar', 12], rare: ['gust_bow', 96], steal: ['nectar', 'night_dagger'],
      desc: '嵐を呼ぶハーピー。竜巻を起こし、\n歌で旅人を眠らせる。',
    }),
    minotauros: M('ミノタウロス', 'minotaur', 26, {
      fam: ['beast'],
      s: { hp: 1.05, atk: 1.15, agi: 0.8 }, a: [['attack', 4], ['en_horn', 2], ['en_sweep', 1], ['en_focus', 1]],
      drop: ['mega_bomb', 24], rare: ['giant_bracer', 128], steal: ['nectar', 'giant_bracer'],
      desc: '牛の頭を持つ巨人。\n大斧を振り回し、角で突く。',
    }),
    hiryuu: M('飛竜', 'wyvern', 27, {
      fam: ['reptile', 'snow', 'wing'],
      s: { hp: 0.95, atk: 1.05, agi: 1.15 }, hue: 110, sat: 1.1, flags: ['flying', 'dragon'],
      a: [['attack', 4], ['en_bite', 2], ['en_breath_ice2', 2], ['en_breath_ice3', 1]],
      drop: ['nectar', 12], rare: ['dragon_mail', 128], steal: ['nectar', 'dragon_mail'],
      desc: '青いうろこの飛竜。\n氷の息を吐いて空から襲う。',
    }),

    // ======================================================= 星見の塔 (Lv25–30)
    gargoyle: M('ガーゴイル', 'gargoyle', 25, {
      fam: ['rock', 'wing'],
      s: { hp: 1.1, def: 1.6, agi: 0.9 }, flags: ['flying'],
      statusRes: { paralyze: 0.5, poison: 0.5 }, a: [['attack', 4], ['en_claws', 2], ['en_gaze', 1], ['en_harden', 1]],
      drop: ['all_cure', 12], rare: ['seed_vit', 32], steal: ['all_cure'],
      desc: '塔を守る石の魔物。\n普段は彫像のふりをしている。',
    }),
    hoshi_hitomi: M('星の瞳', 'eyeball', 26, {
      fam: ['eye', 'light', 'float'],
      s: { hp: 1.15, mag: 1.3, agi: 1.1 }, mp: 30, hue: -60, sat: 1.2, flags: ['flying'],
      a: [['attack', 2], ['en_gaze', 2], ['en_evil_eye', 1], ['en_thunder2', 1], ['en_mp_drain', 1]],
      drop: ['mana_crystal', 32], rare: ['wisdom_ring', 128], steal: ['mana_drop', 'wisdom_ring'],
      desc: '星空を映す不思議な目。\n見つめられると魔力を吸われる。',
    }),
    nagareboshi: M('流れ星', 'wisp', 26, {
      fam: ['light', 'float'],
      s: { hp: 0.95, mag: 1.35, mdef: 1.5, agi: 1.25 }, mp: 24, hue: -160, sat: 1.2, bri: 1.1, flags: ['flying'],
      a: [['attack', 2], ['en_stardust', 2], ['en_blast', 1]],
      drop: ['mana_drop', 12], rare: ['seed_int', 32], steal: ['mana_drop', 'seed_int'],
      desc: '夜空から落ちてきた星のかけら。\n星くずを降らせる。',
    }),
    hoshi_madoushi: M('星の魔導士', 'darkmage', 27, {
      fam: ['human', 'light'],
      s: { hp: 0.95, mag: 1.45, mdef: 1.6 }, mp: 44, hue: -50, sat: 1.1,
      a: [['attack', 1], ['en_ice2', 2], ['en_thunder2', 2], ['en_silence', 1], ['en_protect', 1], ['en_healing', 1]],
      drop: ['mana_drop', 8], rare: ['magic_orb', 128], steal: ['mana_crystal', 'magic_orb'],
      desc: '星の力を求めて塔にこもった魔導士。\n数多くの呪文を操る。',
    }),
    hoshi_banpei: M('星の番兵', 'armor', 28, {
      fam: ['metal', 'light'],
      s: { hp: 1.15, def: 1.8, agi: 0.7, mdef: 1.0 }, hue: 180, sat: 1.2, bri: 1.1,
      statusRes: { poison: 1, death: 0.6 },
      a: [['attack', 4], ['en_double', 2], ['en_light_blade', 1], ['en_harden', 1]],
      drop: ['nectar', 16], rare: ['regen_ring', 128], steal: ['nectar', 'regen_ring'],
      desc: '星の光で動く黄金の鎧。\n塔の最上階を守る。',
    }),
    hoshi_modoki: M('星の宝箱もどき', 'mimic', 29, {
      fam: ['plain', 'light'],
      s: { hp: 2.3, atk: 1.35, def: 1.4, agi: 1.1, mdef: 1.2 }, rw: 2.5, gm: 2, mp: 16, hue: -150, sat: 1.1, statusRes: MIMIC_RES,
      a: [['attack', 3], ['en_bite', 2], ['en_whisper', 1], ['en_thunder2', 1]],
      drop: ['mana_crystal', 8], rare: ['goddess_tear', 24], steal: ['nectar', 'wisdom_ring'],
      desc: '星模様の宝箱に化けた魔物。\n雷の呪文まで操る。',
    }),

    // ======================================================= 最果ての海 (Lv27–31)
    yoroi_gani: M('鎧ガニ', 'crab', 28, {
      fam: ['shore'],
      s: { hp: 1.38, atk: 1.1, def: 2.1, mdef: 0.8, agi: 0.7 }, hue: -150, sat: 0.35, bri: 0.75,
      a: [['attack', 4], ['en_claws', 2], ['en_harden', 1]],
      drop: ['nectar', 16], rare: ['tide_claw', 96], steal: ['nectar', 'seed_vit'],
      desc: '鋼のような甲羅を持つカニ。\n力自慢の戦士も手こずる。',
    }),
    kaijin_shougun: M('魚人将軍', 'merman', 29, {
      fam: ['shore'],
      s: { hp: 1.32, atk: 1.21, mag: 1.1 }, mp: 18, hue: 120, sat: 1.1,
      a: [['attack', 4], ['en_pierce', 2], ['en_ice2', 1], ['en_protect', 1]],
      drop: ['mana_crystal', 32], rare: ['night_dagger', 96], steal: ['nectar', 'night_dagger'],
      desc: '海の兵士を従える将軍。\n三つまたの矛で貫く。',
    }),
    fukami_nushi: M('深みの主', 'kraken', 30, {
      fam: ['sea'],
      s: { hp: 1.14, atk: 1.16, agi: 0.6 }, hue: -90, bri: 0.75,
      a: [['attack', 3], ['en_tentacles', 2], ['en_ink', 1], ['en_breath_ice2', 1]],
      drop: ['nectar', 12], rare: ['goddess_tear', 96], steal: ['nectar', 'goddess_tear'],
      desc: '海の最も深い所からやってくる主。\n光を嫌う。',
    }),

    // ======================================================= 魔王島 (Lv30–34)
    demon_hei: M('デーモン兵', 'demon', 31, {
      fam: ['demon'],
      s: { hp: 0.95, atk: 1.05, mag: 1.1 }, mp: 20,
      a: [['attack', 4], ['en_pierce', 2], ['en_fire2', 1], ['en_dark', 1]],
      drop: ['mana_crystal', 24], rare: ['dusk_sword', 128], steal: ['nectar', 'dusk_sword'],
      desc: '魔王軍の先兵を務める悪魔の兵士。',
    }),
    jigoku_mushi: M('地獄虫', 'sandworm', 31, {
      fam: ['sand'],
      s: { hp: 1.1, atk: 1.05, agi: 0.5 }, hue: -30, sat: 1.1, bri: 0.7,
      a: [['attack', 4], ['en_bite_crush', 1], ['en_breath_poison', 2], ['en_sand', 1]],
      drop: ['nectar', 12], rare: ['seed_hp', 24], steal: ['nectar', 'seed_hp'],
      desc: '魔界の大地を食い破って現れる\n巨大な虫。',
    }),
    kogane_jelly: M('黄金ゼリー', 'jelly', 32, {
      hp: 10, def: 255, s: { agi: 2.4, atk: 0.85, mag: 1.0 }, mdef: 255, eva: 10, mp: 12,
      exp: 3000, jp: 150, gold: 2000, hue: -100, sat: 1.3, bri: 1.15, flags: ['metal', 'flee'], fleeRate: 0.3,
      statusRes: METAL_RES, a: [['attack', 3], ['en_blast', 2]],
      drop: ['light_drop', 8], rare: ['golden_maneki', 64], steal: ['mana_crystal', 'goddess_tear'],
      desc: '金色に輝く幻のゼリー。\n倒せば大量のゴールドが手に入る。',
    }),
    yami_kimaira: M('闇キマイラ', 'chimera', 32, {
      fam: ['beast', 'reptile', 'wing', 'shade'], elem: { fire: 0.5 },
      s: { hp: 0.95, atk: 1.05, agi: 1.1 }, hue: -140, sat: 0.9, bri: 0.75, flags: ['flying'],
      a: [['attack', 4], ['en_bite', 2], ['en_breath_fire3', 1], ['en_poison_bite', 1]],
      drop: ['nectar', 12], rare: ['dragon_mail', 96], steal: ['nectar', 'dragon_mail'],
      desc: '闇に染まったキマイラ。\n激しい炎を吐く。',
    }),
    kuro_minotauros: M('黒ミノタウロス', 'minotaur', 32, {
      fam: ['beast', 'shade'],
      s: { hp: 1.05, atk: 1.15, agi: 0.8 }, sat: 0.6, bri: 0.55, a: [['attack', 4], ['en_horn', 2], ['en_sweep', 1], ['en_crush', 1]],
      drop: ['mega_bomb', 16], rare: ['earth_axe', 256], steal: ['nectar', 'kirin_claw'],
      desc: '魔界の力を得た黒いミノタウロス。\n一撃で岩を砕く。',
    }),

    // ======================================================= 魔王城 (Lv31–38)
    yami_kenshi: M('闇の剣士', 'skeleton', 32, {
      fam: ['undead'],
      s: { hp: 1.09, atk: 1.31, agi: 1.1 }, hue: -100, sat: 1.4, bri: 0.6, flags: ['undead'], statusRes: UNDEAD_RES,
      a: [['attack', 4], ['en_double', 3], ['en_curse', 1]],
      drop: ['revive_feather', 16], rare: ['amatsukaze', 256], steal: ['holy_water', 'night_dagger'],
      desc: '魔王に魂を売った剣士のなれの果て。\n素早い連続斬りを放つ。',
    }),
    jigoku_bourei: M('地獄の亡霊', 'ghost', 32, {
      fam: ['undead', 'float'],
      s: { hp: 0.98, atk: 1.19, def: 0.6, mdef: 1.3, mag: 1.2 }, mp: 20, eva: 14, hue: 130, sat: 1.3, flags: ['undead', 'flying'],
      statusRes: UNDEAD_RES,
      a: [['attack', 2], ['en_life_suck', 2], ['en_dark2', 1], ['en_curse', 1]],
      drop: ['holy_water', 8], rare: ['goddess_charm', 256], steal: ['mana_crystal', 'goddess_robe'],
      desc: '地獄の底から呼び出された亡霊。\n闇の渦ですべてを飲み込む。',
    }),
    yami_kishi: M('闇の騎士', 'armor', 33, {
      fam: ['metal', 'shade'],
      s: { hp: 1.19, atk: 1.19, def: 1.8, mdef: 1, agi: 0.75 }, hue: 40, sat: 2, bri: 0.5,
      statusRes: { poison: 1, death: 0.7 },
      a: [['attack', 4], ['en_heavy', 2], ['en_sweep', 1], ['en_harden', 1]],
      drop: ['nectar', 12], rare: ['dawn_shield', 256], steal: ['nectar', 'dragon_shield'],
      desc: '魔王城を守る黒い鎧の騎士。\nその剣は重く、鋭い。',
    }),
    magan: M('魔眼', 'eyeball', 33, {
      fam: ['eye', 'demon', 'float'],
      s: { hp: 1.19, atk: 1.19, agi: 1.1, mag: 1.3 }, mp: 30, hue: 80, sat: 1.2, bri: 0.9, flags: ['flying'],
      a: [['attack', 2], ['en_gaze', 2], ['en_evil_eye', 1], ['en_dark', 1], ['en_death', 1]],
      drop: ['mana_crystal', 24], rare: ['orb_rod', 256], steal: ['mana_crystal', 'wisdom_ring'],
      desc: '「魔王の目」と呼ばれる魔物。\n死の呪文を唱える。',
    }),
    yami_gargoyle: M('闇のガーゴイル', 'gargoyle', 33, {
      fam: ['rock', 'wing', 'shade'],
      s: { hp: 1.14, atk: 1.19, def: 1.6, agi: 0.95 }, hue: 50, sat: 2.5, bri: 0.6, flags: ['flying'],
      statusRes: { paralyze: 0.5, poison: 0.5 },
      a: [['attack', 4], ['en_claws', 2], ['en_gaze', 1], ['en_breath_fire3', 1]],
      drop: ['nectar', 12], rare: ['moon_bow', 256], steal: ['nectar', 'seed_vit'],
      desc: '魔王城の屋根に並ぶ闇の石像。\n炎を吐いて飛びかかる。',
    }),
    yami_shisai: M('闇の司祭', 'darkmage', 34, {
      fam: ['demon'],
      s: { hp: 1.03, atk: 1.19, mdef: 1.6, mag: 1.45 }, mp: 40, hue: 100, sat: 1.1, bri: 0.75,
      a: [['attack', 1], ['en_dark2', 2], ['en_ice3', 1], ['en_heal_all', 1], ['en_revive', 1]],
      drop: ['mana_crystal', 16], rare: ['angel_staff', 256], steal: ['mana_crystal', 'goddess_lyre'],
      desc: '魔王をあがめる闇の司祭。\n倒れた仲間をよみがえらせる。',
    }),
    shi_no_hako: M('死の箱', 'mimic', 34, {
      fam: ['plain', 'shade'],
      s: { hp: 2.37, atk: 1.61, def: 1.4, mdef: 1.2, agi: 1.1 }, rw: 2.5, gm: 2, mp: 20, hue: -110, sat: 1.2, bri: 0.6, statusRes: MIMIC_RES,
      a: [['attack', 3], ['en_bite_crush', 2], ['en_whisper', 1], ['en_dark2', 1]],
      drop: ['light_drop', 8], rare: ['galaxy_dagger', 48], steal: ['mana_crystal', 'goddess_tear'],
      desc: '黒い宝箱に化けた魔物。\n開けた者に死をもたらす。',
    }),
    kokuryuu: M('黒竜', 'wyvern', 35, {
      fam: ['reptile', 'wing', 'shade'], elem: { fire: 0.5 },
      s: { hp: 0.88, atk: 1.31, agi: 1.1 }, hue: 150, sat: 0.8, bri: 0.55, flags: ['flying', 'dragon'],
      a: [['attack', 4], ['en_bite', 2], ['en_breath_fire3', 2], ['en_tail', 1]],
      drop: ['nectar', 12], rare: ['sky_spear', 256], steal: ['nectar', 'dawn_sword'],
      desc: '闇に染まった黒い竜。\n激しい炎ですべてを焼き尽くす。',
    }),
    akuma_kishi: M('悪魔騎士', 'demon', 36, {
      fam: ['demon'],
      s: { hp: 0.84, atk: 1.31, mag: 1.15 }, mp: 30, hue: -130, sat: 1.1, bri: 0.85,
      a: [['attack', 4], ['en_pierce', 2], ['en_dark2', 1], ['en_inferno', 1]],
      drop: ['mana_crystal', 16], rare: ['dawn_helm', 256], steal: ['nectar', 'goddess_crown'],
      desc: '魔王の側近を務める悪魔の騎士。\n闇と炎の呪文を使う。',
    }),
    madou_hei: M('魔導兵', 'golem', 36, {
      fam: ['rock', 'shade'],
      s: { hp: 1.01, atk: 1.19, def: 1.6, mdef: 1, agi: 0.5 }, hue: -120, sat: 1.4, bri: 0.7,
      statusRes: GOLEM_RES,
      a: [['attack', 4], ['en_crush', 2], ['en_quake', 1]],
      drop: ['mega_bomb', 16], rare: ['dawn_armor', 256], steal: ['nectar', 'phoenix_garb'],
      desc: '魔法の力で動く黒い巨人兵。\n魔王城の門番。',
    }),
  });
})(window.RPG);
