// Item catalogue: consumables, weapons, armor, accessories, key items.
// Schema: DESIGN.md §5.1 (+ mods §5.4). Extra field `band` (1..6, 0 = any) is the
// level band an item belongs to — used by tools/check_items.js, R.ITEM_TIERS and
// R.ITEM_RARE; the game itself ignores it.
//
// Bands: 1 = Lv1-5 (regnas milt)   2 = Lv6-11 (porta)   3 = Lv12-18 (elfin salva)
//        4 = Lv19-26 (frost)       5 = Lv27-32 (arcana)  6 = Lv33-40 (edge_shrine)
//
// Balance notes (DESIGN §6: phys = atk/2 - def/4, atk = str + weapon):
//   sword line  8 → 15 → 25 → 34/43 → 54 → 68 → 84, legendary 112
//   axe ×1.15 (hit -5) · spear ×1.05 · katana ×1.1 (+crit) · bow ×1.0 (two-handed, hit +5)
//   claw ×0.87 · knife ×0.7 (+agi, hit +5) · harp ×0.55 (+status) · staff/rod carry mag
//   heavy body 9 → 65 · light 3 → 51 · robe 4 → 41 (+mdef) · helm 4 → 32 · hat 2 → 24 · shield 3 → 34 (+eva)
//
// ------------------------------------------------------------------ RARE_POOL
// rare:true items never appear in shops. Use them for monster drop/rare slots,
// steal slots and treasure chests of the matching band (also exported as R.ITEM_RARE).
//   any band : seed_str seed_vit seed_agi seed_int seed_mnd seed_luk seed_hp seed_mp  (rare drops / hidden spots)
//   band1    : swallow_sword fairy_knife clover
//   band2    : gale_spear cat_hood gold_charm
//   band3    : lightning_sword rock_claw prayer_staff dream_robe maneki study_charm float_shoes
//   band4    : glacier_sword glacier_bow sapphire_rod kagerou water_spear shadow_dagger flame_shield ninja_garb speed_boots loot_bag light_drop
//   band5    : dusk_sword night_dagger gust_bow tide_claw dragon_mail dragon_shield regen_ring magic_orb giant_bracer wisdom_ring goddess_tear
//   band6    : LEGENDARY (rare-drop only, keep out of chests except one or two story chests):
//              dawn_sword dawn_armor dawn_shield dawn_helm            (dawn set 暁 — knight/paladin/hero)
//              goddess_lyre goddess_robe goddess_crown goddess_charm (goddess set 女神 — casters/bard)
//              earth_axe sky_spear galaxy_dagger amatsukaze kirin_claw moon_bow angel_staff orb_rod phoenix_garb golden_maneki
// ---------------------------------------------------------------------------
(function (R) {
  'use strict';

  // ------------------------------------------------------------- builders
  const HEAD = { helm: 'head', hat: 'head', heavy: 'body', light: 'body', robe: 'body', shield: 'shield' };
  const W = (name, wtype, atk, price, band, desc, o) => Object.assign({ name, type: 'weapon', wtype, atk, price, band, desc }, o);
  const A = (name, atype, def, price, band, desc, o) => Object.assign({ name, type: HEAD[atype], atype, def, price, band, desc }, o);
  const X = (name, price, band, desc, o) => Object.assign({ name, type: 'acc', price, band, desc }, o);
  const C = (name, price, band, desc, use, o) => Object.assign({ name, type: 'consumable', price, band, desc, use }, o);
  const K = (name, desc) => ({ name, type: 'key', price: 0, band: 0, desc });
  // use helpers
  const both = (target, effects, fx) => ({ target, effects, fx, battle: true, field: true });
  const battle = (target, effects, fx) => ({ target, effects, fx, battle: true, field: false });
  const field = (effects, fx) => ({ target: 'self', effects, fx, battle: false, field: true });
  const heal = (power) => ({ type: 'heal', power, scale: 0 });
  const cure = (statuses) => ({ type: 'cure', statuses });
  const bomb = (power, element) => Object.assign({ type: 'damage', formula: 'fixed', power }, element ? { element } : {});
  const seed = (stat, n, name, label) => C(name, 0, 0, `食べると${label}が${n}上がる不思議な木の実。`, both('ally', [{ type: 'grow', stat, n }], 'grow'), { rare: true });
  const RARE = { rare: true };
  const ALL_STATUS = ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'death'];

  // ---------------------------------------------------------- consumables
  const consumables = {
    herb:           C('薬草',             8, 1, 'HPを30ほど回復する、ありふれた薬草。', both('ally', [heal(30)], 'heal')),
    healing_grass:  C('癒やし草',        36, 2, 'HPを85ほど回復する、よく効く薬草。', both('ally', [heal(85)], 'heal')),
    nectar:         C('癒やしの蜜',     130, 4, 'HPを240ほど回復する甘い花の蜜。', both('ally', [heal(240)], 'heal')),
    healing_aroma:  C('癒やしの香り',   360, 3, '味方全員のHPを120ほど回復する。', both('allies', [heal(120)], 'heal')),
    light_drop:     C('光のしずく',       0, 4, 'HPとMPをすべて回復する奇跡のしずく。', both('ally', [{ type: 'heal', pct: 1 }, { type: 'healMp', power: 999 }], 'heal'), RARE),
    goddess_tear:   C('女神の涙',         0, 5, '味方全員のHPを全快し、状態異常も治す。', both('allies', [{ type: 'heal', pct: 1 }, cure('all')], 'heal'), RARE),
    mana_drop:      C('魔力のしずく',   180, 2, 'MPを30ほど回復する澄んだしずく。', both('ally', [{ type: 'healMp', power: 30 }], 'mp')),
    mana_crystal:   C('魔力の石',       420, 5, 'MPを90ほど回復する魔力の結晶。', both('ally', [{ type: 'healMp', power: 90 }], 'mp')),
    antidote:       C('解毒の実',        10, 1, '毒を消し去る苦い木の実。', both('ally', [cure(['poison'])], 'cure')),
    eye_drop:       C('目薬草',          12, 1, '暗闇を払い、目をすっきりさせる。', both('ally', [cure(['blind'])], 'cure')),
    smelling_salts: C('気付け薬',        20, 1, '眠りと混乱から目を覚まさせる。', both('ally', [cure(['sleep', 'confuse'])], 'cure')),
    numb_cure:      C('しびれほぐし',    20, 2, '麻痺した体をほぐす塗り薬。', both('ally', [cure(['paralyze'])], 'cure')),
    throat_drop:    C('のど飴',          15, 2, '沈黙を治し、声を取り戻す。', both('ally', [cure(['silence'])], 'cure')),
    all_cure:       C('清めの粉',       100, 3, 'あらゆる状態異常を治す粉。', both('ally', [cure('all')], 'cure')),
    revive_feather: C('よみがえりの羽', 300, 2, '倒れた仲間をHP半分で生き返らせる。', both('ally_dead', [{ type: 'revive', pct: 0.5 }], 'revive')),
    fire_bomb:      C('火炎玉',          45, 1, '投げると炎が広がり、敵の群れを焼く。', battle('group', [bomb(28, 'fire')], 'fire')),
    ice_bomb:       C('氷結玉',         140, 3, '敵の群れを凍りつかせる爆弾。', battle('group', [bomb(70, 'ice')], 'ice')),
    thunder_bomb:   C('雷鳴玉',         410, 4, '敵全体に雷を落とす爆弾。', battle('enemies', [bomb(120, 'thunder')], 'thunder')),
    mega_bomb:      C('爆裂玉',         850, 5, '敵全体を吹き飛ばす大きな爆弾。', battle('enemies', [bomb(220)], 'explosion')),
    sleep_powder:   C('まどろみの粉',    60, 2, '敵全体を眠りに誘う粉。', battle('enemies', [{ type: 'status', status: 'sleep', chance: 0.5 }], 'sleep')),
    smoke_bomb:     C('煙玉',            25, 1, '煙に紛れて、必ず逃げ出せる。', battle('self', [{ type: 'escape' }], 'smoke')),
    courage_flute:  C('勇みの笛',       120, 3, '味方全員の攻撃力を上げる。', battle('allies', [{ type: 'buff', stat: 'atk', stages: 1 }], 'buff')),
    guard_bell:     C('守りの鐘',       120, 3, '味方全員の守備力を上げる。', battle('allies', [{ type: 'buff', stat: 'def', stages: 1 }], 'buff')),
    holy_water:     C('魔除けの香',      40, 1, 'しばらく魔物を寄せつけない不思議な香。', field([{ type: 'repel', steps: 150 }], 'buff')),
    wing:           C('旅鳥の羽',        25, 1, '投げると、訪れた町や村へひとっ飛び。', field([{ type: 'teleport' }], 'warp')),
    escape_rope:    C('導きの糸',        30, 1, '洞窟や塔などから外へ導いてくれる。', field([{ type: 'exit' }], 'warp')),
    // stat nuts: rare drops / hidden spots only
    seed_str: seed('str', 2, '剛力の実', '力'),
    seed_vit: seed('vit', 2, '頑丈の実', '体力'),
    seed_agi: seed('agi', 2, '疾風の実', '素早さ'),
    seed_int: seed('int', 2, '知恵の実', '知力'),
    seed_mnd: seed('mnd', 2, '精神の実', '精神'),
    seed_luk: seed('luk', 3, '幸運の実', '運'),
    seed_hp:  seed('hp', 8, '生命の実', '最大HP'),
    seed_mp:  seed('mp', 5, '魔力の実', '最大MP'),
  };

  // menu icon (icon:<key>, src/art/objects.js) for consumables that are not herbs or flasks
  const ICON = {
    feather: ['wing', 'revive_feather'], rope: ['escape_rope'],
    bomb: ['fire_bomb', 'ice_bomb', 'thunder_bomb', 'mega_bomb', 'smoke_bomb'], powder: ['sleep_powder', 'all_cure'],
    seed: ['antidote', 'seed_str', 'seed_vit', 'seed_agi', 'seed_int', 'seed_mnd', 'seed_luk', 'seed_hp', 'seed_mp'],
    drop: ['mana_drop', 'mana_crystal', 'light_drop', 'goddess_tear'], bell: ['guard_bell'], flute: ['courage_flute'],
  };
  for (const k in ICON) for (const id of ICON[k]) consumables[id].icon = k;

  // -------------------------------------------------------------- weapons
  const weapons = {
    // swords — warrior knight spellblade paladin darkknight hero
    copper_sword:    W('銅の剣',             'sword',   8,    60, 1, '銅を鍛えた、駆け出し向けの剣。'),
    iron_sword:      W('鉄の剣',             'sword',  15,   280, 1, '鉄で打たれた丈夫な剣。'),
    swallow_sword:   W('燕の剣',             'sword',  19,   400, 1, '燕のように軽く、素早さが上がる。', { stats: { agi: 4 }, rare: true }),
    bastard_sword:   W('バスタードソード',   'sword',  25,   850, 2, '磨き抜かれた鋼の長剣。'),
    silver_sword:    W('銀の剣',             'sword',  34,  1500, 3, '銀の輝きを放つ剣。'),
    flamberge:       W('フランベルジュ',     'sword',  43,  2650, 3, '波打つ刃に炎を宿した剣。', { element: 'fire' }),
    lightning_sword: W('稲光の剣',           'sword',  46,  2900, 3, '触れると稲妻が走る剣。', { element: 'thunder', rare: true }),
    platinum_sword:  W('白銀の剣',           'sword',  54,  4600, 4, '白銀で作られた鋭い剣。'),
    glacier_sword:   W('氷河の剣',           'sword',  58,  5100, 4, '溶けない氷でできた冷たい剣。', { element: 'ice', rare: true }),
    stardust_sword:  W('星くずの剣',         'sword',  68,  6500, 5, '星くずを混ぜて鍛えた輝く剣。'),
    dusk_sword:      W('黄昏の剣',           'sword',  78,  6700, 5, '闇の力を吸い込んだ黒い剣。', { element: 'dark', rare: true }),
    holy_sword:      W('聖銀の剣',           'sword',  84, 10700, 6, '聖なる銀の剣。魔物を打ち払う。', { element: 'holy' }),
    dawn_sword:      W('暁の剣',             'sword', 112,     0, 6, '夜明けの光を宿す伝説の剣。', { element: 'holy', stats: { str: 8, agi: 4 }, rare: true }),

    // axes — heavy hitters, slightly less accurate
    hand_axe:        W('ハンドアックス',     'axe',  17,   300, 1, '片手で振るえる小ぶりな斧。', { hit: -5 }),
    battle_axe:      W('バトルアックス',     'axe',  28,   900, 2, '戦いのために鍛えられた斧。', { hit: -5 }),
    great_axe:       W('グレートアックス',   'axe',  39,  1600, 3, 'ずっしりと重い大きな斧。', { hit: -5 }),
    whirl_axe:       W('旋風の斧',           'axe',  50,  2800, 3, '振るうたびにつむじ風が起こる。', { element: 'wind', hit: -5 }),
    giant_axe:       W('巨人の斧',           'axe',  62,  4900, 4, '振り下ろすと大地が割れる巨人の斧。', { element: 'earth', hit: -5 }),
    thunder_axe:     W('轟雷の斧',           'axe',  78,  6700, 5, '雷の轟音とともに打ち下ろす。', { element: 'thunder', hit: -5 }),
    crimson_axe:     W('紅蓮の斧',           'axe',  96, 11300, 6, '紅蓮の炎をまとう大斧。', { element: 'fire', hit: -5 }),
    earth_axe:       W('地竜の斧',           'axe', 126,     0, 6, '大地の竜の牙から作られた斧。', { element: 'earth', hit: -5, stats: { str: 10, vit: 6 }, rare: true }),

    // spears — knight dragoon
    copper_spear:    W('銅の槍',             'spear',  11,   120, 1, '銅の穂先をつけた槍。'),
    iron_spear:      W('鉄の槍',             'spear',  18,   330, 1, '鉄の穂先が鋭い槍。'),
    partisan:        W('パルチザン',         'spear',  26,   880, 2, '幅広の穂先を持つ槍。'),
    gale_spear:      W('風切りの槍',         'spear',  31,  1300, 2, '風を切り裂く軽い槍。', { element: 'wind', stats: { agi: 3 }, rare: true }),
    thunder_spear:   W('雷の槍',             'spear',  36,  1700, 3, '雷の力を秘めた槍。', { element: 'thunder' }),
    halberd:         W('ハルバード',         'spear',  45,  2700, 3, '斧と槍を合わせた長柄の武器。'),
    platinum_spear:  W('白銀の槍',           'spear',  56,  4750, 4, '白銀の穂先が光る槍。'),
    water_spear:     W('水竜の槍',           'spear',  58,  5000, 4, '水竜のうろこで鍛えた、水の力を秘めた槍。', { element: 'water', rare: true }),
    stardust_spear:  W('星くずの槍',         'spear',  71,  6600, 5, '星くずの光をまとう槍。'),
    holy_spear:      W('聖銀の槍',           'spear',  88, 11000, 6, '聖なる銀の槍。魔物を貫く。', { element: 'holy' }),
    sky_spear:       W('天竜の槍',           'spear', 116,     0, 6, '空を駆ける竜の風が宿る槍。', { element: 'wind', stats: { agi: 8, str: 4 }, rare: true }),

    // knives — thief ninja bard alchemist: light, accurate, raise agility
    copper_knife:    W('銅のナイフ',         'knife',   6,    45, 1, '銅でできた小さなナイフ。', { hit: 5, stats: { agi: 1 } }),
    dagger:          W('ダガー',             'knife',  11,   200, 1, '持ちやすく扱いやすい短剣。', { hit: 5, stats: { agi: 2 } }),
    fairy_knife:     W('妖精のナイフ',       'knife',  13,   380, 1, '妖精の祝福を受け、運が上がる。', { hit: 5, stats: { agi: 2, luk: 6 }, rare: true }),
    viper_knife:     W('毒蛇のナイフ',       'knife',  17,   640, 2, '毒蛇の牙を削ったナイフ。毒を与える。', { hit: 5, stats: { agi: 3 }, onHit: { status: 'poison', chance: 0.3 } }),
    silver_dagger:   W('銀のダガー',         'knife',  24,  1200, 3, '磨き上げられた銀の短剣。', { hit: 5, stats: { agi: 4 } }),
    slumber_dagger:  W('まどろみの短剣',     'knife', 30, 2100, 3, '傷つけた相手を眠りに誘う。', { hit: 5, stats: { agi: 4 }, onHit: { status: 'sleep', chance: 0.2 } }),
    platinum_dagger: W('白銀のダガー',       'knife',  38,  3600, 4, '白銀の刃が光る短剣。', { hit: 5, stats: { agi: 5 } }),
    shadow_dagger:   W('影縫いの短剣',       'knife',  41,  4200, 4, '影に溶ける黒い刃。闇の力を宿す。', { hit: 5, element: 'dark', stats: { agi: 5 }, rare: true }),
    stardust_dagger: W('星くずのダガー',     'knife',  48,  5300, 5, '星くずをちりばめた軽い短剣。', { hit: 5, stats: { agi: 6 } }),
    night_dagger:    W('闇夜の短剣',         'knife',  52,  5500, 5, '闇に溶ける刃。相手を麻痺させる。', { hit: 5, element: 'dark', stats: { agi: 6 }, onHit: { status: 'paralyze', chance: 0.2 }, rare: true }),
    holy_dagger:     W('聖銀のダガー',       'knife',  60,  8900, 6, '聖なる銀の短剣。', { hit: 5, element: 'holy', stats: { agi: 8 } }),
    galaxy_dagger:   W('銀河のダガー',       'knife',  80,     0, 6, '星の流れを刻んだ伝説の短剣。', { hit: 10, stats: { agi: 15, luk: 8 }, mods: { crit: 5 }, rare: true }),

    // katanas — ninja: strong and prone to critical hits
    wakizashi:       W('脇差',               'katana',  33,  1600, 3, '短く鋭い刀。', { mods: { crit: 3 } }),
    shigure:         W('時雨の太刀',         'katana',  45,  2800, 3, '水のように滑らかな刀。', { element: 'water', mods: { crit: 3 } }),
    kogarashi:       W('木枯らしの太刀',     'katana',  58,  4900, 4, '冷たい風を呼ぶ刀。', { element: 'wind', mods: { crit: 4 } }),
    kagerou:         W('陽炎の太刀',         'katana',  61,  5300, 4, '陽炎のように揺らめく炎の刀。', { element: 'fire', mods: { crit: 4 }, rare: true }),
    oborozuki:       W('朧月の太刀',         'katana',  74,  7100, 5, '闇夜の朧月のように妖しく光る刀。', { element: 'dark', mods: { crit: 5 } }),
    izayoi:          W('十六夜の太刀',       'katana',  92, 11600, 6, '名工が命をかけて打った刀。', { mods: { crit: 6 } }),
    amatsukaze:      W('天つ風',             'katana', 118,     0, 6, '天の風をまとう伝説の刀。', { element: 'wind', stats: { agi: 6 }, mods: { crit: 10 }, rare: true }),

    // claws — monk
    beast_claw:      W('獣の爪',             'claw',  13,   240, 1, '獣の爪を取りつけた拳の武器。'),
    iron_knuckle:    W('鉄甲',               'claw',  21,   780, 2, '拳を鉄で固める手甲。'),
    silver_claw:     W('銀の爪',             'claw',  29,  1400, 3, '銀でできた鋭い爪。'),
    tiger_claw:      W('猛虎の爪',           'claw',  37,  2400, 3, '猛虎の力が宿る爪。', { stats: { str: 3 } }),
    flame_claw:      W('炎の爪',             'claw',  47,  4250, 4, '炎をまとった赤い爪。', { element: 'fire' }),
    raijin_claw:     W('雷神の爪',           'claw',  60,  6100, 5, '雷がほとばしる爪。', { element: 'thunder' }),
    tide_claw:       W('水神の爪',           'claw',  61,  6300, 5, '水神の加護を受けた青い爪。水の力を宿す。', { element: 'water', rare: true }),
    holy_claw:       W('聖銀の爪',           'claw',  74, 10100, 6, '聖なる銀の爪。', { element: 'holy' }),
    rock_claw:       W('岩砕きの爪',         'claw',  33,  1900, 3, '岩をも砕く大地の力を宿した爪。', { element: 'earth', rare: true }),
    kirin_claw:      W('麒麟の爪',           'claw',  98,     0, 6, '聖獣・麒麟の爪。素早さも上がる。', { stats: { agi: 10, str: 6 }, rare: true }),

    // bows — hunter (two-handed)
    short_bow:       W('ショートボウ',       'bow',  14,   260, 1, '扱いやすい小ぶりの弓。', { twoHanded: true, hit: 5 }),
    long_bow:        W('ロングボウ',         'bow',  24,   820, 2, '遠くまで届く大きな弓。', { twoHanded: true, hit: 5 }),
    silver_bow:      W('銀の弓',             'bow',  34,  1500, 3, '銀で飾られた弓。', { twoHanded: true, hit: 5 }),
    flame_bow:       W('炎の弓',             'bow',  43,  2650, 3, '放った矢が炎に包まれる。', { twoHanded: true, hit: 5, element: 'fire' }),
    platinum_bow:    W('白銀の弓',           'bow',  54,  4600, 4, '白銀の弦を張った強い弓。', { twoHanded: true, hit: 5 }),
    glacier_bow:     W('氷河の弓',           'bow',  57,  4900, 4, '放った矢が氷の矢に変わる。', { twoHanded: true, hit: 5, element: 'ice', rare: true }),
    stardust_bow:    W('星くずの弓',         'bow',  68,  6500, 5, '流れ星のように矢が飛ぶ弓。', { twoHanded: true, hit: 5 }),
    gust_bow:        W('突風の弓',           'bow',  70,  6600, 5, '放った矢が突風となって敵を襲う。', { twoHanded: true, hit: 5, element: 'wind', rare: true }),
    holy_bow:        W('聖銀の弓',           'bow',  84, 10700, 6, '聖なる銀の弓。魔物を射抜く。', { twoHanded: true, hit: 5, element: 'holy' }),
    moon_bow:        W('月光の弓',           'bow', 108,     0, 6, '月の光で狙いを外さない弓。', { twoHanded: true, hit: 15, mods: { crit: 5 }, rare: true }),

    // staves — priest whitemage sage: raise spirit (healing power)
    oak_staff:       W('ナラの杖',           'staff',  4,    40, 1, 'ナラの木で作った軽い杖。', { mag: 1 }),
    copper_staff:    W('銅の杖',             'staff',  7,   190, 1, '銅の飾りがついた杖。', { mag: 2, stats: { mnd: 2 } }),
    priest_staff:    W('神官の杖',           'staff', 11,   700, 2, '神殿の神官が持つ杖。', { mag: 4, stats: { mnd: 4 } }),
    silver_staff:    W('銀の錫杖',           'staff', 15, 1350, 3, 'しゃらりと鳴る銀の杖。', { mag: 7, stats: { mnd: 6 } }),
    prayer_staff:    W('祈りの杖',           'staff', 16,  2100, 3, '祈りを込めた杖。回復の力が増す。', { mag: 8, stats: { mnd: 10 }, mods: { healPct: 10 }, rare: true }),
    sun_staff:       W('太陽の杖',           'staff', 19,  2400, 3, '太陽の光を宿した杖。', { mag: 9, element: 'holy', stats: { mnd: 8 } }),
    platinum_staff:  W('白銀の杖',           'staff', 23,  4250, 4, '白銀の輪がついた杖。', { mag: 12, stats: { mnd: 10 } }),
    starseer_staff:  W('星読みの杖',         'staff', 28,  6000, 5, '星の声を聞く占い師の杖。', { mag: 16, stats: { mnd: 13 } }),
    saint_staff:     W('聖者の杖',           'staff', 34,  9900, 6, '聖者が携えた尊い杖。', { mag: 21, stats: { mnd: 17 } }),
    angel_staff:     W('天使の杖',           'staff', 40,     0, 6, '天使の翼をかたどった伝説の杖。', { mag: 28, stats: { mnd: 26 }, mods: { healPct: 15 }, rare: true }),

    // rods — mage blackmage sage timemage: raise magic power
    wooden_rod:      W('木のロッド',         'rod',  3,    40, 1, '魔法の練習に使う木のロッド。', { mag: 3 }),
    apprentice_rod:  W('見習いのロッド',     'rod',  4,   200, 1, '魔法学院の生徒が持つロッド。', { mag: 6 }),
    opal_rod:        W('オパールのロッド',   'rod',  7,   780, 2, '虹色のオパールがはまったロッド。', { mag: 11 }),
    topaz_rod:       W('トパーズのロッド',   'rod', 10,  1500, 3, '雷の魔法が強くなるロッド。', { mag: 15, element: 'thunder', mods: { elemBoost: { thunder: 20 } } }),
    ruby_rod:        W('ルビーのロッド',     'rod', 12,  2550, 3, '炎の魔法が強くなるロッド。', { mag: 19, element: 'fire', mods: { elemBoost: { fire: 20 } } }),
    diamond_rod:     W('ダイヤのロッド',     'rod', 15,  4450, 4, '硬いダイヤが魔力を高める。', { mag: 25 }),
    sapphire_rod:    W('サファイアのロッド', 'rod', 14,  4900, 4, '氷の魔法が強くなるロッド。', { mag: 27, element: 'ice', mods: { elemBoost: { ice: 25 } }, rare: true }),
    stardust_rod:    W('星くずのロッド',     'rod', 18,  6200, 5, '星くずの魔力が宿るロッド。', { mag: 33, stats: { int: 4 } }),
    mystic_rod:      W('神秘のロッド',       'rod', 22, 10400, 6, '神秘の力を秘めたロッド。', { mag: 42, stats: { int: 6 } }),
    orb_rod:         W('宝珠のロッド',       'rod', 26,     0, 6, '宝珠が魔法の威力を高める。', { mag: 56, stats: { int: 8 }, mods: { magicPct: 10 }, rare: true }),

    // harps — bard: modest power, lull or confuse on hit
    wood_harp:       W('木製のハープ',       'harp',  9,   220, 1, '優しい音色の木の竪琴。', { stats: { mnd: 1 } }),
    sleep_harp:      W('眠りのハープ',       'harp', 14,   760, 2, '調べを聴いた相手が眠くなる。', { onHit: { status: 'sleep', chance: 0.2 } }),
    fairy_harp:      W('妖精のハープ',       'harp', 20,  1450, 3, '妖精が作った澄んだ音色のハープ。', { stats: { mnd: 4 } }),
    bewilder_harp:   W('惑わしのハープ',     'harp', 25,  2500, 3, '不思議な調べで相手を惑わせる。', { onHit: { status: 'confuse', chance: 0.15 } }),
    platinum_harp:   W('白銀のハープ',       'harp', 31,  4100, 4, '白銀の弦を張ったハープ。', { stats: { mnd: 6 } }),
    star_harp:       W('星座のハープ',       'harp', 39,  6000, 5, '星空の歌を奏でるハープ。', { stats: { mnd: 8, int: 4 } }),
    holy_harp:       W('聖銀のハープ',       'harp', 48,  9900, 6, '聖なる銀のハープ。', { element: 'holy', stats: { mnd: 10 } }),
    goddess_lyre:    W('女神の竪琴',         'harp', 64,     0, 6, '女神が奏でたという伝説の竪琴。', { stats: { mnd: 15, int: 10 }, onHit: { status: 'sleep', chance: 0.25 }, rare: true }),
  };

  // ---------------------------------------------------------------- armor
  const armor = {
    // heavy body — warrior knight paladin darkknight dragoon hero
    bronze_armor:    A('銅の鎧',         'heavy',  9,   180, 1, '銅の板をつないだ鎧。'),
    chain_mail:      A('鎖の鎧',         'heavy', 14,   420, 1, '細かい鎖を編んだ鎧。'),
    iron_armor:      A('鉄の鎧',         'heavy', 21,   950, 2, '鉄でできた丈夫な鎧。'),
    silver_armor:    A('銀の鎧',         'heavy', 28,  1600, 3, '銀色に輝く美しい鎧。'),
    knight_armor:    A('騎士の鎧',       'heavy', 34,  2700, 3, '騎士団に伝わる頑丈な鎧。', { mdef: 2 }),
    platinum_armor:  A('白銀の鎧',       'heavy', 42,  4750, 4, '白銀で作られた軽く硬い鎧。', { mdef: 3 }),
    stardust_armor:  A('星くずの鎧',     'heavy', 53,  6700, 5, '星くずの光が魔法も防ぐ鎧。', { mdef: 6 }),
    dragon_mail:     A('竜鱗の鎧',       'heavy', 58,  7300, 5, '竜の鱗の鎧。炎と氷に強い。', { mdef: 6, mods: { elemResist: { fire: 0.5, ice: 0.5 } }, rare: true }),
    holy_armor:      A('聖銀の鎧',       'heavy', 65, 11300, 6, '聖なる銀の鎧。闇の力を防ぐ。', { mdef: 10, mods: { elemResist: { dark: 0.5 } } }),
    dawn_armor:      A('暁の鎧',         'heavy', 80,     0, 6, '夜明けの光に包まれた伝説の鎧。', { mdef: 16, stats: { vit: 6 }, mods: { elemResist: { dark: 0.5 }, statusImmune: ['poison', 'paralyze'] }, rare: true }),

    // light body — thief monk hunter bard ninja alchemist …
    traveler_clothes: A('旅路の服',       'light',  3,    30, 1, '長旅にも耐える丈夫な服。'),
    leather_vest:    A('革のベスト',     'light',  7,   110, 1, 'なめし革のベスト。動きやすい。'),
    hard_leather:    A('ハードレザー',   'light', 11,   350, 1, 'ロウで固めた革の鎧。'),
    kenpo_gi:        A('拳法着',         'light', 16,   800, 2, '武術家のための動きやすい道着。', { stats: { agi: 2 } }),
    forest_garb:     A('森人の服',       'light', 21,  1450, 3, '森の民が織った軽く丈夫な服。', { stats: { agi: 3 } }),
    sand_mantle:     A('砂風のマント',   'light', 26,  2400, 3, '砂嵐から身を守るマント。', { mdef: 3, stats: { agi: 3 } }),
    silk_coat:       A('銀糸のコート',   'light', 32,  4100, 4, '銀の糸で織ったコート。氷に強い。', { mdef: 4, stats: { agi: 4 }, mods: { elemResist: { ice: 0.5 } } }),
    ninja_garb:      A('忍びの衣',       'light', 36,  4500, 4, '影に溶け込む衣。攻撃をかわしやすくなる。', { eva: 5, stats: { agi: 8 }, rare: true }),
    gale_garb:       A('疾風の服',       'light', 41,  6000, 5, '風のように軽い服。', { mdef: 6, stats: { agi: 6 } }),
    holy_vest:       A('聖銀のベスト',   'light', 51, 10100, 6, '聖なる銀を織り込んだベスト。', { mdef: 9, stats: { agi: 8 } }),
    phoenix_garb:    A('鳳凰の衣',       'light', 60,     0, 6, '鳳凰の羽で織った伝説の衣。', { mdef: 12, eva: 6, stats: { agi: 12 }, mods: { elemResist: { fire: 0.5 } }, rare: true }),

    // robes — priest mage whitemage blackmage sage timemage
    cloth_robe:      A('布のローブ',     'robe',  4,    80, 1, '魔法を学ぶ者が着る布のローブ。', { mdef: 3 }),
    apprentice_robe: A('見習いのローブ', 'robe',  8,   300, 1, '魔法の糸で縫われたローブ。', { mdef: 5 }),
    silk_robe:       A('シルクのローブ', 'robe', 12,   820, 2, 'なめらかな絹のローブ。', { mdef: 8 }),
    fairy_robe:      A('妖精のローブ',   'robe', 16,  1500, 3, '妖精の羽のように軽いローブ。', { mdef: 11, stats: { mnd: 2 } }),
    dream_robe:      A('夢見のローブ',   'robe', 19,  2100, 3, '夢の力で魔力が湧き出るローブ。', { mdef: 15, stats: { mp: 15, int: 3 }, rare: true }),
    moon_robe:       A('月夜のローブ',   'robe', 20,  2400, 3, '月の光を織り込んだローブ。', { mdef: 14, stats: { int: 2 } }),
    glacier_robe:    A('氷河のローブ',   'robe', 26,  4100, 4, '氷の精霊のローブ。氷に強い。', { mdef: 17, mods: { elemResist: { ice: 0.5 } } }),
    starseer_robe:   A('星読みのローブ', 'robe', 33,  6000, 5, '星を読む魔術師のローブ。', { mdef: 22, stats: { int: 3, mnd: 3 } }),
    holy_robe:       A('聖銀のローブ',   'robe', 41, 10100, 6, '聖なる銀の糸で縫ったローブ。', { mdef: 28, stats: { int: 4, mnd: 4 } }),
    goddess_robe:    A('女神のローブ',   'robe', 50,     0, 6, '女神の加護を受けた伝説のローブ。', { mdef: 40, stats: { int: 10, mnd: 10 }, mods: { statusImmune: ['silence'] }, rare: true }),

    // helms
    bronze_helm:     A('銅の兜',         'helm',  4,    90, 1, '銅で作った兜。'),
    iron_helm:       A('鉄の兜',         'helm',  7,   330, 1, '鉄で作った兜。'),
    knight_helm:     A('ナイトヘルム',   'helm', 10,   800, 2, '顔まで守る騎士の兜。'),
    silver_helm:     A('銀の兜',         'helm', 14,  1300, 3, '銀色に輝く兜。'),
    great_helm:      A('グレートヘルム', 'helm', 17,  2100, 3, '頭をすっぽり覆う大兜。'),
    platinum_helm:   A('白銀の兜',       'helm', 21,  3450, 4, '白銀で作られた兜。', { mdef: 2 }),
    stardust_helm:   A('星くずの兜',     'helm', 26,  5000, 5, '星くずの光を放つ兜。', { mdef: 4 }),
    holy_helm:       A('聖銀の兜',       'helm', 32,  8300, 6, '聖なる銀の兜。', { mdef: 6 }),
    dawn_helm:       A('暁の兜',         'helm', 38,     0, 6, '夜明けの光が迷いを払う兜。', { mdef: 10, mods: { statusImmune: ['confuse', 'sleep'] }, rare: true }),

    // hats
    cloth_hat:       A('布の帽子',       'hat',  2,    40, 1, '布でできた簡単な帽子。'),
    leather_hood:    A('革の頭巾',       'hat',  4,   160, 1, '頭をすっぽり包む革の頭巾。'),
    pointy_hat:      A('とんがり帽子',   'hat',  6,   560, 2, '魔法使いが好む、とがった帽子。', { mdef: 2, stats: { int: 2 } }),
    cat_hood:        A('猫耳フード',     'hat',  6,   900, 2, '猫の耳がついたフード。なぜか運が上がる。', { mdef: 2, stats: { luk: 8, agi: 3 }, rare: true }),
    circlet:         A('サークレット',   'hat',  9,  1100, 3, '額を守る銀の輪。', { mdef: 4, stats: { mnd: 1 } }),
    turban:          A('ターバン',       'hat', 12,  1900, 3, '砂漠の民が巻く布。軽くて丈夫。', { mdef: 4, stats: { agi: 2 } }),
    fur_hat:         A('毛皮の帽子',     'hat', 15,  3100, 4, '雪国の暖かい毛皮の帽子。', { mdef: 6 }),
    star_crown:      A('星の冠',         'hat', 19,  4400, 5, '星をかたどった小さな冠。', { mdef: 10, stats: { int: 3 } }),
    light_crown:     A('光の冠',         'hat', 24,  7500, 6, '清らかな光を放つ冠。', { mdef: 14, stats: { int: 4, mnd: 4 } }),
    goddess_crown:   A('女神の冠',       'hat', 28,     0, 6, '女神の知恵が宿る伝説の冠。', { mdef: 20, stats: { int: 8, mnd: 8 }, mods: { statusImmune: ['silence', 'confuse'] }, rare: true }),

    // shields
    oak_shield:      A('ナラの盾',       'shield',  3,    60, 1, 'ナラの板で作った軽い盾。', { eva: 2 }),
    bronze_shield:   A('銅の盾',         'shield',  6,   240, 1, '銅を張った丸い盾。', { eva: 3 }),
    iron_shield:     A('鉄の盾',         'shield', 10,   700, 2, '鉄でできた重い盾。', { eva: 4 }),
    silver_shield:   A('銀の盾',         'shield', 14,  1300, 3, '銀色に輝く盾。', { eva: 5 }),
    kite_shield:     A('カイトシールド', 'shield', 17,  2150, 3, '全身を守る縦長の盾。', { eva: 6 }),
    glacier_shield:  A('氷河の盾',       'shield', 18,  3300, 4, '氷の精霊の盾。氷に強い。', { eva: 6, mods: { elemResist: { ice: 0.5 } } }),
    flame_shield:    A('炎の盾',         'shield', 20,  4100, 4, '炎の精霊の盾。炎に強い。', { eva: 6, mods: { elemResist: { fire: 0.5 } }, rare: true }),
    platinum_shield: A('白銀の盾',       'shield', 21,  3750, 4, '白銀でできた軽い盾。', { eva: 7, mdef: 2 }),
    stardust_shield: A('星くずの盾',     'shield', 27,  5500, 5, '星くずが魔法をはじく盾。', { eva: 8, mdef: 5 }),
    dragon_shield:   A('竜鱗の盾',       'shield', 31,  6100, 5, '竜の鱗の盾。炎・氷・雷に強い。', { eva: 9, mdef: 6, mods: { elemResist: { fire: 0.5, ice: 0.5, thunder: 0.5 } }, rare: true }),
    holy_shield:     A('聖銀の盾',       'shield', 34,  8900, 6, '聖なる銀の盾。', { eva: 10, mdef: 8 }),
    dawn_shield:     A('暁の盾',         'shield', 42,     0, 6, '夜明けの光があらゆる魔を払う盾。', { eva: 12, mdef: 12, mods: { elemResist: { dark: 0.5, fire: 0.75, ice: 0.75, thunder: 0.75 } }, rare: true }),
  };

  // ----------------------------------------------------------- accessories
  const accessories = {
    clover:         X('四つ葉のお守り',   300, 1, '四つ葉のクローバーのお守り。運が上がる。', { stats: { luk: 10 }, rare: true }),
    power_bracer:   X('剛力の腕輪',       900, 2, '身につけると力が湧いてくる腕輪。', { stats: { str: 6 } }),
    magic_ring:     X('魔導の指輪',       900, 2, '知力を高める魔術師の指輪。', { stats: { int: 6 } }),
    escape_shoes:   X('逃げ足の靴',       450, 2, '戦闘から逃げやすくなる靴。', { stats: { agi: 2 }, mods: { escapePct: 50 } }),
    poison_bell:    X('毒よけの鈴',       350, 2, '毒を受けつけなくなる小さな鈴。', { mods: { statusImmune: ['poison'] } }),
    gold_charm:     X('黄金のお守り',     2000, 2, '戦闘で手に入るゴールドが増える。', { mods: { goldPct: 50 }, rare: true }),
    iron_ring:      X('鉄壁の指輪',       1300, 3, '身の守りを固める指輪。', { def: 8 }),
    wake_brooch:    X('目覚めのブローチ', 960, 3, '眠りを受けつけなくなるブローチ。', { mods: { statusImmune: ['sleep'] } }),
    thief_glove:    X('スリの手袋',       1100, 3, '魔物から盗みやすくなる手袋。', { stats: { agi: 2 }, mods: { stealPct: 50 } }),
    vigor_shoes:    X('元気の靴',         1200, 3, '歩くたびにHPが少し回復する靴。', { mods: { walkHeal: 1 } }),
    rosary:         X('祈りのロザリオ',   2550, 3, '祈りの力で回復の効果が増す。', { stats: { mnd: 5 }, mods: { healPct: 15 } }),
    tiger_fang:     X('虎の牙',           2250, 3, '会心の一撃が出やすくなる牙。', { stats: { str: 3 }, mods: { crit: 8 } }),
    free_bracelet:  X('自由の腕輪',       1900, 3, '麻痺を受けつけなくなる腕輪。', { mods: { statusImmune: ['paralyze'] } }),
    mana_pierce:    X('魔力のピアス',     2900, 3, '最大MPが増える不思議なピアス。', { mods: { mpPct: 15 } }),
    maneki:         X('招き猫',           2400, 3, '珍しい物を招き寄せる置物。', { mods: { rarePct: 100 }, rare: true }),
    study_charm:    X('学びのお守り',     2400, 3, '戦闘で得られる経験値が増える。', { mods: { expPct: 20 }, rare: true }),
    float_shoes:    X('浮遊の靴',         2000, 3, '少し浮いて歩ける靴。\n床のダメージを受けない。', { mods: { noFloorDamage: true }, rare: true }),
    frost_ring:     X('霜よけの指輪',     2450, 4, '氷の攻撃を和らげる指輪。', { mods: { elemResist: { ice: 0.5 } } }),
    fire_ring:      X('火よけの指輪',     2450, 4, '炎の攻撃を和らげる指輪。', { mods: { elemResist: { fire: 0.5 } } }),
    life_belt:      X('生命の帯',         3950, 4, '最大HPが増える丈夫な帯。', { mods: { hpPct: 10 } }),
    wind_bracelet:  X('風の腕輪',         3450, 4, '風のように素早く動ける腕輪。', { stats: { agi: 8 } }),
    speed_boots:    X('はやての靴',       4900, 4, '戦闘開始時から素早さが上がる。', { stats: { agi: 5 }, mods: { startBuffs: { agi: 1 } }, rare: true }),
    loot_bag:       X('獲物袋',           3300, 4, '魔物が道具を落としやすくなる袋。', { mods: { dropPct: 50 }, rare: true }),
    star_earring:   X('星のイヤリング',   4950, 5, '消費MPが減る不思議なイヤリング。', { mods: { mpCostPct: -20 } }),
    barrier_charm:  X('結界のお札',       4600, 5, '戦闘開始時から守備力が上がる。', { mods: { startBuffs: { def: 1 } } }),
    thunder_ring:   X('雷よけの指輪',     3050, 5, '雷の攻撃を和らげる指輪。', { mods: { elemResist: { thunder: 0.5 } } }),
    calm_ring:      X('安らぎの指輪',     3050, 5, '混乱を受けつけなくなる指輪。', { mods: { statusImmune: ['confuse'] } }),
    voice_bell:     X('言霊の鈴',         3050, 5, '沈黙を受けつけなくなる鈴。', { mods: { statusImmune: ['silence'] } }),
    eagle_eye:      X('鷲の瞳',           3350, 5, '暗闇を受けつけず、命中が上がる。', { mods: { statusImmune: ['blind'], hit: 5, preemptPct: 10 } }),
    regen_ring:     X('再生の指輪',       4950, 5, '戦闘中、少しずつHPが回復する。', { mods: { regen: true }, rare: true }),
    magic_orb:      X('魔導の宝玉',       4950, 5, '魔法の威力を高める水晶玉。', { stats: { int: 4 }, mods: { magicPct: 15 }, rare: true }),
    giant_bracer:   X('巨人の腕輪',       4950, 5, '巨人の力が宿る腕輪。', { stats: { str: 12, vit: 4 }, rare: true }),
    wisdom_ring:    X('知恵の指輪',       4950, 5, '賢者の知恵が宿る指輪。', { stats: { int: 12, mnd: 4 }, rare: true }),
    ward_ring:      X('魔除けの指輪',     5400, 6, '闇の攻撃を和らげる指輪。', { mods: { elemResist: { dark: 0.5 } } }),
    life_charm:     X('命のお守り',       7100, 6, '即死の呪いを受けつけなくなるお守り。', { mods: { statusImmune: ['death'] } }),
    goddess_charm:  X('女神のお守り',     0, 6, 'あらゆる状態異常を防ぐ伝説のお守り。', { mods: { statusImmune: ALL_STATUS }, rare: true }),
    golden_maneki:  X('金の招き猫',       0, 6, '珍しい物とお金を招く金の置物。', { mods: { rarePct: 200, goldPct: 30 }, rare: true }),
  };

  // ------------------------------------------------------------ key items
  const keys = {
    crest_wind:  K('風の紋章',   '風の力を宿す紋章。五つの紋章のひとつ。'),
    crest_water: K('水の紋章',   '水の力を宿す紋章。五つの紋章のひとつ。'),
    crest_earth: K('大地の紋章', '大地の力を宿す紋章。五つの紋章のひとつ。'),
    crest_fire:  K('炎の紋章',   '炎の力を宿す紋章。五つの紋章のひとつ。'),
    crest_star:  K('星の紋章',   '星の力を宿す紋章。五つの紋章のひとつ。'),
    light_crest: K('光の紋章',   '五つの力がひとつになった伝説の紋章。\n魔の渦を払う。'),
    silver_key:  K('銀の鍵',     '銀の扉を開ける古い鍵。'),
    gold_key:    K('金の鍵',     '金の扉を開ける重い鍵。'),
  };

  // display order inside each type = definition order
  let n = 0;
  for (const group of [consumables, weapons, armor, accessories, keys]) {
    for (const id in group) group[id].sort = n++;
    Object.assign(R.DB.items, group);
  }

  // ------------------------------------------------ chest-worthy items per band
  // Treasure for dungeons/towns of each band: the next shop tier a little early,
  // useful consumables, and the band's rare:true finds. (Legendaries excluded.)
  R.ITEM_TIERS = {
    band1: ['herb', 'antidote', 'eye_drop', 'smelling_salts', 'fire_bomb', 'holy_water', 'wing', 'escape_rope',
      'iron_sword', 'hand_axe', 'iron_spear', 'dagger', 'beast_claw', 'short_bow', 'copper_staff', 'apprentice_rod', 'wood_harp',
      'chain_mail', 'hard_leather', 'apprentice_robe', 'iron_helm', 'leather_hood', 'bronze_shield',
      'swallow_sword', 'fairy_knife', 'clover', 'seed_luk', 'seed_hp'],
    band2: ['healing_grass', 'mana_drop', 'numb_cure', 'throat_drop', 'revive_feather', 'sleep_powder', 'fire_bomb',
      'bastard_sword', 'battle_axe', 'partisan', 'viper_knife', 'iron_knuckle', 'long_bow', 'priest_staff', 'opal_rod', 'sleep_harp',
      'iron_armor', 'kenpo_gi', 'silk_robe', 'knight_helm', 'pointy_hat', 'iron_shield',
      'power_bracer', 'magic_ring', 'escape_shoes', 'poison_bell',
      'gale_spear', 'cat_hood', 'gold_charm', 'seed_agi', 'seed_mp'],
    band3: ['healing_grass', 'healing_aroma', 'mana_drop', 'all_cure', 'revive_feather', 'ice_bomb', 'courage_flute', 'guard_bell',
      'silver_sword', 'flamberge', 'great_axe', 'whirl_axe', 'thunder_spear', 'halberd', 'silver_dagger', 'slumber_dagger',
      'wakizashi', 'shigure', 'silver_claw', 'tiger_claw', 'silver_bow', 'flame_bow', 'silver_staff', 'sun_staff',
      'topaz_rod', 'ruby_rod', 'fairy_harp', 'bewilder_harp',
      'silver_armor', 'knight_armor', 'forest_garb', 'sand_mantle', 'fairy_robe', 'moon_robe', 'silver_helm', 'great_helm',
      'circlet', 'turban', 'silver_shield', 'kite_shield',
      'iron_ring', 'wake_brooch', 'thief_glove', 'vigor_shoes', 'rosary', 'tiger_fang', 'free_bracelet', 'mana_pierce',
      'lightning_sword', 'rock_claw', 'prayer_staff', 'dream_robe', 'maneki', 'study_charm', 'float_shoes', 'seed_str', 'seed_vit'],
    band4: ['nectar', 'healing_aroma', 'all_cure', 'revive_feather', 'thunder_bomb', 'light_drop',
      'platinum_sword', 'giant_axe', 'platinum_spear', 'platinum_dagger', 'kogarashi', 'flame_claw', 'platinum_bow',
      'platinum_staff', 'diamond_rod', 'platinum_harp',
      'platinum_armor', 'silk_coat', 'glacier_robe', 'platinum_helm', 'fur_hat', 'platinum_shield', 'glacier_shield',
      'frost_ring', 'fire_ring', 'life_belt', 'wind_bracelet',
      'glacier_sword', 'glacier_bow', 'sapphire_rod', 'kagerou', 'water_spear', 'shadow_dagger', 'flame_shield', 'ninja_garb', 'speed_boots', 'loot_bag',
      'seed_int', 'seed_mnd'],
    band5: ['nectar', 'mana_crystal', 'healing_aroma', 'revive_feather', 'mega_bomb', 'goddess_tear', 'light_drop',
      'stardust_sword', 'thunder_axe', 'stardust_spear', 'stardust_dagger', 'oborozuki', 'raijin_claw', 'stardust_bow',
      'starseer_staff', 'stardust_rod', 'star_harp',
      'stardust_armor', 'gale_garb', 'starseer_robe', 'stardust_helm', 'star_crown', 'stardust_shield',
      'star_earring', 'barrier_charm', 'thunder_ring', 'calm_ring', 'voice_bell', 'eagle_eye',
      'dusk_sword', 'night_dagger', 'gust_bow', 'tide_claw', 'dragon_mail', 'dragon_shield', 'regen_ring', 'magic_orb', 'giant_bracer', 'wisdom_ring',
      'seed_hp', 'seed_str', 'seed_agi'],
    band6: ['nectar', 'mana_crystal', 'revive_feather', 'mega_bomb', 'goddess_tear', 'light_drop',
      'holy_sword', 'crimson_axe', 'holy_spear', 'holy_dagger', 'izayoi', 'holy_claw', 'holy_bow', 'saint_staff', 'mystic_rod', 'holy_harp',
      'holy_armor', 'holy_vest', 'holy_robe', 'holy_helm', 'light_crown', 'holy_shield', 'ward_ring', 'life_charm',
      'seed_str', 'seed_vit', 'seed_agi', 'seed_int', 'seed_mnd', 'seed_luk', 'seed_hp', 'seed_mp'],
  };

  // Rare pool per band (rare:true items) for monster rare/steal slots — see RARE_POOL above.
  const SEEDS = ['seed_str', 'seed_vit', 'seed_agi', 'seed_int', 'seed_mnd', 'seed_luk', 'seed_hp', 'seed_mp'];
  R.ITEM_RARE = {
    seeds: SEEDS,
    band1: ['swallow_sword', 'fairy_knife', 'clover'],
    band2: ['gale_spear', 'cat_hood', 'gold_charm'],
    band3: ['lightning_sword', 'rock_claw', 'prayer_staff', 'dream_robe', 'maneki', 'study_charm', 'float_shoes'],
    band4: ['glacier_sword', 'glacier_bow', 'sapphire_rod', 'kagerou', 'water_spear', 'shadow_dagger', 'flame_shield', 'ninja_garb', 'speed_boots', 'loot_bag', 'light_drop'],
    band5: ['dusk_sword', 'night_dagger', 'gust_bow', 'tide_claw', 'dragon_mail', 'dragon_shield', 'regen_ring', 'magic_orb', 'giant_bracer', 'wisdom_ring', 'goddess_tear'],
    band6: ['dawn_sword', 'dawn_armor', 'dawn_shield', 'dawn_helm', 'goddess_lyre', 'goddess_robe', 'goddess_crown', 'goddess_charm',
      'earth_axe', 'sky_spear', 'galaxy_dagger', 'amatsukaze', 'kirin_claw', 'moon_bow', 'angel_staff', 'orb_rod', 'phoenix_garb', 'golden_maneki'],
  };
})(window.RPG);
