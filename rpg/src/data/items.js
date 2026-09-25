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
//   band3    : lightning_sword prayer_staff dream_robe maneki study_charm float_shoes
//   band4    : glacier_sword glacier_bow sapphire_rod kagerou flame_shield ninja_garb speed_boots loot_bag light_drop
//   band5    : dusk_sword night_dagger dragon_mail dragon_shield regen_ring magic_orb giant_bracer wisdom_ring goddess_tear
//   band6    : LEGENDARY (rare-drop only, keep out of chests except one or two story chests):
//              dawn_sword dawn_armor dawn_shield dawn_helm            (あけぼの set — knight/paladin/hero)
//              goddess_lyre goddess_robe goddess_crown goddess_charm (めがみ set — casters/bard)
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
  const seed = (stat, n, name, label) => C(name, 0, 0, `たべると ${label}が ${n} あがる ふしぎな きのみ。`, both('ally', [{ type: 'grow', stat, n }], 'grow'), { rare: true });
  const RARE = { rare: true };
  const ALL_STATUS = ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'death'];

  // ---------------------------------------------------------- consumables
  const consumables = {
    herb:           C('やくそう',       8, 1, 'HPを 30ほど かいふくする くすりぐさ。', both('ally', [heal(30)], 'heal')),
    healing_grass:  C('いやしそう',    36, 2, 'HPを 85ほど かいふくする よくきく くすりぐさ。', both('ally', [heal(85)], 'heal')),
    nectar:         C('いやしのみつ', 130, 4, 'HPを 240ほど かいふくする あまい はなのみつ。', both('ally', [heal(240)], 'heal')),
    healing_aroma:  C('いやしのかおり', 360, 3, 'みかた ぜんいんの HPを 120ほど かいふくする。', both('allies', [heal(120)], 'heal')),
    light_drop:     C('ひかりのしずく',  0, 4, 'HPと MPを すべて かいふくする きせきの しずく。', both('ally', [{ type: 'heal', pct: 1 }, { type: 'healMp', power: 999 }], 'heal'), RARE),
    goddess_tear:   C('めがみのなみだ',  0, 5, 'みかた ぜんいんの HPと じょうたいを すべて なおす。', both('allies', [{ type: 'heal', pct: 1 }, cure('all')], 'heal'), RARE),
    mana_drop:      C('まりょくのしずく', 180, 2, 'MPを 30ほど かいふくする すんだ しずく。', both('ally', [{ type: 'healMp', power: 30 }], 'mp')),
    mana_crystal:   C('まりょくのいし', 420, 5, 'MPを 90ほど かいふくする まりょくの かたまり。', both('ally', [{ type: 'healMp', power: 90 }], 'mp')),
    antidote:       C('げどくのみ',    10, 1, 'どくを けしさる にがい きのみ。', both('ally', [cure(['poison'])], 'cure')),
    eye_drop:       C('めぐすりそう',  12, 1, 'くらやみを はらい めを すっきり させる。', both('ally', [cure(['blind'])], 'cure')),
    smelling_salts: C('きつけぐすり',  20, 1, 'ねむりと こんらんから めを さまさせる。', both('ally', [cure(['sleep', 'confuse'])], 'cure')),
    numb_cure:      C('しびれほぐし',  20, 2, 'からだの しびれを ほぐす ぬりぐすり。', both('ally', [cure(['paralyze'])], 'cure')),
    throat_drop:    C('のどあめ',      15, 2, 'ふうじられた こえを とりもどす。', both('ally', [cure(['silence'])], 'cure')),
    all_cure:       C('きよめのこな', 100, 3, 'あらゆる じょうたいいじょうを なおす こな。', both('ally', [cure('all')], 'cure')),
    revive_feather: C('よみがえりのはね', 300, 2, 'たおれた なかまを HP はんぶんで いきかえらせる。', both('ally_dead', [{ type: 'revive', pct: 0.5 }], 'revive')),
    fire_bomb:      C('かえんだま',    45, 1, 'なげると ほのおが ひろがり てきの むれを やく。', battle('group', [bomb(28, 'fire')], 'fire')),
    ice_bomb:       C('ひょうけつだま', 140, 3, 'てきの むれを こおりつかせる ばくだん。', battle('group', [bomb(70, 'ice')], 'ice')),
    thunder_bomb:   C('らいめいだま', 410, 4, 'てき ぜんたいに いかずちを おとす ばくだん。', battle('enemies', [bomb(120, 'thunder')], 'thunder')),
    mega_bomb:      C('ばくれつだま',  850, 5, 'てき ぜんたいを ふきとばす おおきな ばくだん。', battle('enemies', [bomb(220)], 'explosion')),
    sleep_powder:   C('まどろみのこな', 60, 2, 'てき ぜんたいを ねむりに さそう こな。', battle('enemies', [{ type: 'status', status: 'sleep', chance: 0.5 }], 'sleep')),
    smoke_bomb:     C('けむりだま',    25, 1, 'けむりに まぎれて かならず にげだせる。', battle('self', [{ type: 'escape' }], 'smoke')),
    courage_flute:  C('いさみのふえ', 120, 3, 'みかた ぜんいんの こうげきりょくを あげる。', battle('allies', [{ type: 'buff', stat: 'atk', stages: 1 }], 'buff')),
    guard_bell:     C('まもりのかね', 120, 3, 'みかた ぜんいんの しゅびりょくを あげる。', battle('allies', [{ type: 'buff', stat: 'def', stages: 1 }], 'buff')),
    holy_water:     C('まよけのこう',  40, 1, 'しばらく まものを よせつけない ふしぎな こう。', field([{ type: 'repel', steps: 150 }], 'buff')),
    wing:           C('たびどりのはね', 25, 1, 'なげると おとずれた 町や 村へ ひとっとび。', field([{ type: 'teleport' }], 'warp')),
    escape_rope:    C('みちびきのいと', 30, 1, 'どうくつや とうの そとへ みちびいて くれる。', field([{ type: 'exit' }], 'warp')),
    // stat nuts: rare drops / hidden spots only
    seed_str: seed('str', 2, 'ごうりきのみ', 'ちから'),
    seed_vit: seed('vit', 2, 'がんじょうのみ', 'たいりょく'),
    seed_agi: seed('agi', 2, 'しっぷうのみ', 'すばやさ'),
    seed_int: seed('int', 2, 'ちえのみ', 'かしこさ'),
    seed_mnd: seed('mnd', 2, 'せいしんのみ', 'せいしん'),
    seed_luk: seed('luk', 3, 'こううんのみ', 'うんのよさ'),
    seed_hp:  seed('hp', 8, 'せいめいのみ', 'さいだいHP'),
    seed_mp:  seed('mp', 5, 'まりょくのみ', 'さいだいMP'),
  };

  // -------------------------------------------------------------- weapons
  const weapons = {
    // swords — warrior knight spellblade paladin darkknight hero
    copper_sword:    W('あかがねのけん',   'sword',   8,    60, 1, 'あかがねを きたえた かけだしの けん。'),
    iron_sword:      W('くろがねのけん',   'sword',  15,   280, 1, 'くろがねで うたれた じょうぶな けん。'),
    swallow_sword:   W('つばめのけん',     'sword',  19,   400, 1, 'つばめの ように かるく すばやさが あがる。', { stats: { agi: 4 }, rare: true }),
    bastard_sword:   W('バスタードソード', 'sword',  25,   850, 2, 'みがきぬかれた はがねの ちょうけん。'),
    silver_sword:    W('しろがねのけん',   'sword',  34,  1500, 3, 'しろがねの かがやきを はなつ けん。'),
    flamberge:       W('フランベルジュ',   'sword',  43,  2650, 3, 'なみうつ やいばに ほのおを やどした けん。', { element: 'fire' }),
    lightning_sword: W('いなびかりのけん', 'sword',  46,  2900, 3, 'ふれると いなずまが はしる けん。', { element: 'thunder', rare: true }),
    platinum_sword:  W('はくぎんのけん',   'sword',  54,  4600, 4, 'はくぎんで つくられた するどい けん。'),
    glacier_sword:   W('ひょうがのけん',   'sword',  58,  5100, 4, 'とけない こおりで できた つめたい けん。', { element: 'ice', rare: true }),
    stardust_sword:  W('ほしくずのけん',   'sword',  68,  6500, 5, 'ほしくずを まぜて きたえた かがやく けん。'),
    dusk_sword:      W('たそがれのけん',   'sword',  78,  6700, 5, 'やみの ちからを すいこんだ くろい けん。', { element: 'dark', rare: true }),
    holy_sword:      W('せいぎんのけん',   'sword',  84, 10700, 6, 'せいなる ぎんの けん。 まものを うちはらう。', { element: 'holy' }),
    dawn_sword:      W('あけぼののけん',   'sword', 112,     0, 6, 'よあけの ひかりを やどす でんせつの けん。', { element: 'holy', stats: { str: 8, agi: 4 }, rare: true }),

    // axes — heavy hitters, slightly less accurate
    hand_axe:        W('ハンドアックス',   'axe',  17,   300, 1, 'かたてで ふるえる こぶりな おの。', { hit: -5 }),
    battle_axe:      W('バトルアックス',   'axe',  28,   900, 2, 'たたかいの ために きたえられた おの。', { hit: -5 }),
    great_axe:       W('グレートアックス', 'axe',  39,  1600, 3, 'ずっしりと おもい おおきな おの。', { hit: -5 }),
    whirl_axe:       W('せんぷうのおの',   'axe',  50,  2800, 3, 'ふるうたびに つむじかぜが おこる。', { element: 'wind', hit: -5 }),
    giant_axe:       W('きょじんのおの',   'axe',  62,  4900, 4, 'きょじんが つかったと いう とほうもない おの。', { hit: -5 }),
    thunder_axe:     W('ごうらいのおの',   'axe',  78,  6700, 5, 'かみなりの ごうおんと ともに うちおろす。', { element: 'thunder', hit: -5 }),
    crimson_axe:     W('ぐれんのおの',     'axe',  96, 11300, 6, 'ぐれんの ほのおを まとう まさかり。', { element: 'fire', hit: -5 }),
    earth_axe:       W('ちりゅうのおの',   'axe', 126,     0, 6, 'だいちの りゅうの きばから つくられた おの。', { hit: -5, stats: { str: 10, vit: 6 }, rare: true }),

    // spears — knight dragoon
    copper_spear:    W('あかがねのやり',   'spear',  11,   120, 1, 'あかがねの ほさきを つけた やり。'),
    iron_spear:      W('くろがねのやり',   'spear',  18,   330, 1, 'くろがねの ほさきが するどい やり。'),
    partisan:        W('パルチザン',       'spear',  26,   880, 2, 'はばひろの ほさきを もつ やり。'),
    gale_spear:      W('かざきりのやり',   'spear',  31,  1300, 2, 'かぜを きりさく かるい やり。', { element: 'wind', stats: { agi: 3 }, rare: true }),
    thunder_spear:   W('いかずちのやり',   'spear',  36,  1700, 3, 'いかずちの ちからを ひめた やり。', { element: 'thunder' }),
    halberd:         W('ハルバード',       'spear',  45,  2700, 3, 'おのと やりを あわせた ながえの ぶき。'),
    platinum_spear:  W('はくぎんのやり',   'spear',  56,  4750, 4, 'はくぎんの ほさきが ひかる やり。'),
    stardust_spear:  W('ほしくずのやり',   'spear',  71,  6600, 5, 'ほしくずの ひかりを まとう やり。'),
    holy_spear:      W('せいぎんのやり',   'spear',  88, 11000, 6, 'せいなる ぎんの やり。 まものを つらぬく。', { element: 'holy' }),
    sky_spear:       W('てんりゅうのやり', 'spear', 116,     0, 6, 'そらを かける りゅうの ちからが やどる やり。', { stats: { agi: 8, str: 4 }, rare: true }),

    // knives — thief ninja bard alchemist: light, accurate, raise agility
    copper_knife:    W('あかがねのナイフ', 'knife',   6,    45, 1, 'あかがねで できた ちいさな ナイフ。', { hit: 5, stats: { agi: 1 } }),
    dagger:          W('ダガー',           'knife',  11,   200, 1, 'もちやすく あつかいやすい たんけん。', { hit: 5, stats: { agi: 2 } }),
    fairy_knife:     W('ようせいのナイフ', 'knife',  13,   380, 1, 'ようせいの しゅくふくで うんが よくなる。', { hit: 5, stats: { agi: 2, luk: 6 }, rare: true }),
    viper_knife:     W('どくへびのナイフ', 'knife',  17,   640, 2, 'どくへびの きばを けずった ナイフ。 どくを あたえる。', { hit: 5, stats: { agi: 3 }, onHit: { status: 'poison', chance: 0.3 } }),
    silver_dagger:   W('しろがねのダガー', 'knife',  24,  1200, 3, 'しろがねで できた みがかれた たんけん。', { hit: 5, stats: { agi: 4 } }),
    slumber_dagger:  W('まどろみのたんけん', 'knife', 30, 2100, 3, 'きずつけた あいてを ねむりに さそう。', { hit: 5, stats: { agi: 4 }, onHit: { status: 'sleep', chance: 0.2 } }),
    platinum_dagger: W('はくぎんのダガー', 'knife',  38,  3600, 4, 'はくぎんの やいばが ひかる たんけん。', { hit: 5, stats: { agi: 5 } }),
    stardust_dagger: W('ほしくずのダガー', 'knife',  48,  5300, 5, 'ほしくずを ちりばめた かるい たんけん。', { hit: 5, stats: { agi: 6 } }),
    night_dagger:    W('やみよのたんけん', 'knife',  52,  5500, 5, 'やみに とける やいば。 あいてを しびれさせる。', { hit: 5, element: 'dark', stats: { agi: 6 }, onHit: { status: 'paralyze', chance: 0.2 }, rare: true }),
    holy_dagger:     W('せいぎんのダガー', 'knife',  60,  8900, 6, 'せいなる ぎんの たんけん。', { hit: 5, element: 'holy', stats: { agi: 8 } }),
    galaxy_dagger:   W('ぎんがのダガー',   'knife',  80,     0, 6, 'ほしの ながれを きざんだ でんせつの たんけん。', { hit: 10, stats: { agi: 15, luk: 8 }, mods: { crit: 5 }, rare: true }),

    // katanas — ninja: strong and prone to critical hits
    wakizashi:       W('わきざし',         'katana',  33,  1600, 3, 'みじかく するどい かたな。', { mods: { crit: 3 } }),
    shigure:         W('しぐれのたち',     'katana',  45,  2800, 3, 'みずの ように なめらかな かたな。', { element: 'water', mods: { crit: 3 } }),
    kogarashi:       W('こがらしのたち',   'katana',  58,  4900, 4, 'つめたい かぜを よぶ かたな。', { element: 'wind', mods: { crit: 4 } }),
    kagerou:         W('かげろうのたち',   'katana',  61,  5300, 4, 'かげろうの ように ゆらめく ほのおの かたな。', { element: 'fire', mods: { crit: 4 }, rare: true }),
    oborozuki:       W('おぼろづきのたち', 'katana',  74,  7100, 5, 'おぼろづきの ように あやしく ひかる かたな。', { mods: { crit: 5 } }),
    izayoi:          W('いざよいのたち',   'katana',  92, 11600, 6, 'めいこうが いのちを かけて うった かたな。', { mods: { crit: 6 } }),
    amatsukaze:      W('あまつかぜ',       'katana', 118,     0, 6, 'てんの かぜを きりさく でんせつの かたな。', { stats: { agi: 6 }, mods: { crit: 10 }, rare: true }),

    // claws — monk
    beast_claw:      W('けものづめ',       'claw',  13,   240, 1, 'けものの つめを つけた こぶしの ぶき。'),
    iron_knuckle:    W('てっこう',         'claw',  21,   780, 2, 'くろがねで こぶしを まもる てっこう。'),
    silver_claw:     W('しろがねのつめ',   'claw',  29,  1400, 3, 'しろがねで できた するどい つめ。'),
    tiger_claw:      W('もうこのつめ',     'claw',  37,  2400, 3, 'もうこの ちからが やどる つめ。', { stats: { str: 3 } }),
    flame_claw:      W('ほむらのつめ',     'claw',  47,  4250, 4, 'ほのおを まとった あかい つめ。', { element: 'fire' }),
    raijin_claw:     W('らいじんのつめ',   'claw',  60,  6100, 5, 'いかずちが ほとばしる つめ。', { element: 'thunder' }),
    holy_claw:       W('せいぎんのつめ',   'claw',  74, 10100, 6, 'せいなる ぎんの つめ。', { element: 'holy' }),
    kirin_claw:      W('きりんのつめ',     'claw',  98,     0, 6, 'せいじゅう きりんの つめ。 すばやさも あがる。', { stats: { agi: 10, str: 6 }, rare: true }),

    // bows — hunter (two-handed)
    short_bow:       W('ショートボウ',     'bow',  14,   260, 1, 'あつかいやすい こぶりの ゆみ。', { twoHanded: true, hit: 5 }),
    long_bow:        W('ロングボウ',       'bow',  24,   820, 2, 'とおくまで とどく おおきな ゆみ。', { twoHanded: true, hit: 5 }),
    silver_bow:      W('しろがねのゆみ',   'bow',  34,  1500, 3, 'しろがねで かざられた ゆみ。', { twoHanded: true, hit: 5 }),
    flame_bow:       W('ほむらのゆみ',     'bow',  43,  2650, 3, 'はなった やが ほのおに つつまれる。', { twoHanded: true, hit: 5, element: 'fire' }),
    platinum_bow:    W('はくぎんのゆみ',   'bow',  54,  4600, 4, 'はくぎんの つるを はった つよい ゆみ。', { twoHanded: true, hit: 5 }),
    glacier_bow:     W('ひょうがのゆみ',   'bow',  57,  4900, 4, 'はなった やが こおりの やに かわる。', { twoHanded: true, hit: 5, element: 'ice', rare: true }),
    stardust_bow:    W('ほしくずのゆみ',   'bow',  68,  6500, 5, 'ながれぼしの ように やが とぶ ゆみ。', { twoHanded: true, hit: 5 }),
    holy_bow:        W('せいぎんのゆみ',   'bow',  84, 10700, 6, 'せいなる ぎんの ゆみ。 まものを いぬく。', { twoHanded: true, hit: 5, element: 'holy' }),
    moon_bow:        W('げっこうのゆみ',   'bow', 108,     0, 6, 'つきの ひかりで ねらいを はずさない ゆみ。', { twoHanded: true, hit: 15, mods: { crit: 5 }, rare: true }),

    // staves — priest whitemage sage: raise spirit (healing power)
    oak_staff:       W('ならのつえ',       'staff',  4,    40, 1, 'ならの きで つくった かるい つえ。', { mag: 1 }),
    copper_staff:    W('あかがねのつえ',   'staff',  7,   190, 1, 'あかがねの かざりが ついた つえ。', { mag: 2, stats: { mnd: 2 } }),
    priest_staff:    W('しんかんのつえ',   'staff', 11,   700, 2, 'しんでんの しんかんが もつ つえ。', { mag: 4, stats: { mnd: 4 } }),
    silver_staff:    W('ぎんのしゃくじょう', 'staff', 15, 1350, 3, 'しゃらりと なる ぎんの つえ。', { mag: 7, stats: { mnd: 6 } }),
    prayer_staff:    W('いのりのつえ',     'staff', 16,  2100, 3, 'いのりを こめた つえ。 かいふくの ちからが ます。', { mag: 8, stats: { mnd: 10 }, mods: { healPct: 10 }, rare: true }),
    sun_staff:       W('たいようのつえ',   'staff', 19,  2400, 3, 'たいようの ひかりを やどした つえ。', { mag: 9, element: 'holy', stats: { mnd: 8 } }),
    platinum_staff:  W('はくぎんのつえ',   'staff', 23,  4250, 4, 'はくぎんの わっかが ついた つえ。', { mag: 12, stats: { mnd: 10 } }),
    starseer_staff:  W('ほしよみのつえ',   'staff', 28,  6000, 5, 'ほしの こえを きく うらないしの つえ。', { mag: 16, stats: { mnd: 13 } }),
    saint_staff:     W('せいじゃのつえ',   'staff', 34,  9900, 6, 'せいじゃが たずさえた とうとい つえ。', { mag: 21, stats: { mnd: 17 } }),
    angel_staff:     W('てんしのつえ',     'staff', 40,     0, 6, 'てんしの はねを かたどった でんせつの つえ。', { mag: 28, stats: { mnd: 26 }, mods: { healPct: 15 }, rare: true }),

    // rods — mage blackmage sage timemage: raise magic power
    wooden_rod:      W('きのロッド',       'rod',  3,    40, 1, 'まほうの れんしゅうに つかう きの ロッド。', { mag: 3 }),
    apprentice_rod:  W('みならいのロッド', 'rod',  4,   200, 1, 'まほうがくいんの せいとが もつ ロッド。', { mag: 6 }),
    opal_rod:        W('オパールのロッド', 'rod',  7,   780, 2, 'にじいろの オパールが はまった ロッド。', { mag: 11 }),
    topaz_rod:       W('トパーズのロッド', 'rod', 10,  1500, 3, 'いかずちの じゅもんが つよくなる ロッド。', { mag: 15, element: 'thunder', mods: { elemBoost: { thunder: 20 } } }),
    ruby_rod:        W('ルビーのロッド',   'rod', 12,  2550, 3, 'ほのおの じゅもんが つよくなる ロッド。', { mag: 19, element: 'fire', mods: { elemBoost: { fire: 20 } } }),
    diamond_rod:     W('ダイヤのロッド',   'rod', 15,  4450, 4, 'かたい ダイヤが まりょくを たかめる。', { mag: 25 }),
    sapphire_rod:    W('サファイアのロッド', 'rod', 14,  4900, 4, 'こおりの じゅもんが つよくなる ロッド。', { mag: 27, element: 'ice', mods: { elemBoost: { ice: 25 } }, rare: true }),
    stardust_rod:    W('ほしくずのロッド', 'rod', 18,  6200, 5, 'ほしくずの まりょくが やどる ロッド。', { mag: 33, stats: { int: 4 } }),
    mystic_rod:      W('しんぴのロッド',   'rod', 22, 10400, 6, 'しんぴの ちからを ひめた ロッド。', { mag: 42, stats: { int: 6 } }),
    orb_rod:         W('ほうじゅのロッド', 'rod', 26,     0, 6, 'ほうじゅが じゅもんの いりょくを たかめる。', { mag: 56, stats: { int: 8 }, mods: { magicPct: 10 }, rare: true }),

    // harps — bard: modest power, lull or confuse on hit
    wood_harp:       W('もくせいのハープ', 'harp',  9,   220, 1, 'やさしい ねいろの きの たてごと。', { stats: { mnd: 1 } }),
    sleep_harp:      W('ねむりのハープ',   'harp', 14,   760, 2, 'しらべを きいた あいてが ねむくなる。', { onHit: { status: 'sleep', chance: 0.2 } }),
    fairy_harp:      W('ようせいのハープ', 'harp', 20,  1450, 3, 'ようせいが つくった すんだ ねいろの ハープ。', { stats: { mnd: 4 } }),
    bewilder_harp:   W('まどわしのハープ', 'harp', 25,  2500, 3, 'ふしぎな しらべで あいてを まどわせる。', { onHit: { status: 'confuse', chance: 0.15 } }),
    platinum_harp:   W('はくぎんのハープ', 'harp', 31,  4100, 4, 'はくぎんの げんを はった ハープ。', { stats: { mnd: 6 } }),
    star_harp:       W('せいざのハープ',   'harp', 39,  6000, 5, 'ほしぞらの うたを かなでる ハープ。', { stats: { mnd: 8, int: 4 } }),
    holy_harp:       W('せいぎんのハープ', 'harp', 48,  9900, 6, 'せいなる ぎんの ハープ。', { element: 'holy', stats: { mnd: 10 } }),
    goddess_lyre:    W('めがみのたてごと', 'harp', 64,     0, 6, 'めがみが かなでたと いう でんせつの たてごと。', { stats: { mnd: 15, int: 10 }, onHit: { status: 'sleep', chance: 0.25 }, rare: true }),
  };

  // ---------------------------------------------------------------- armor
  const armor = {
    // heavy body — warrior knight paladin darkknight dragoon hero
    bronze_armor:    A('あかがねのよろい', 'heavy',  9,   180, 1, 'あかがねの いたを つないだ よろい。'),
    chain_mail:      A('くさりのよろい',   'heavy', 14,   420, 1, 'こまかい くさりを あんだ よろい。'),
    iron_armor:      A('くろがねのよろい', 'heavy', 21,   950, 2, 'くろがねで できた じょうぶな よろい。'),
    silver_armor:    A('しろがねのよろい', 'heavy', 28,  1600, 3, 'しろがねに かがやく うつくしい よろい。'),
    knight_armor:    A('きしのよろい',     'heavy', 34,  2700, 3, 'きしだんに つたわる がんじょうな よろい。', { mdef: 2 }),
    platinum_armor:  A('はくぎんのよろい', 'heavy', 42,  4750, 4, 'はくぎんで つくられた かるく かたい よろい。', { mdef: 3 }),
    stardust_armor:  A('ほしくずのよろい', 'heavy', 53,  6700, 5, 'ほしくずの ひかりが まほうも ふせぐ。', { mdef: 6 }),
    dragon_mail:     A('りゅうりんのよろい', 'heavy', 58,  7300, 5, 'りゅうの うろこの よろい。 ほのおと こおりに つよい。', { mdef: 6, mods: { elemResist: { fire: 0.5, ice: 0.5 } }, rare: true }),
    holy_armor:      A('せいぎんのよろい', 'heavy', 65, 11300, 6, 'せいなる ぎんの よろい。 やみの ちからを ふせぐ。', { mdef: 10, mods: { elemResist: { dark: 0.5 } } }),
    dawn_armor:      A('あけぼののよろい', 'heavy', 80,     0, 6, 'よあけの ひかりに つつまれた でんせつの よろい。', { mdef: 16, stats: { vit: 6 }, mods: { elemResist: { dark: 0.5 }, statusImmune: ['poison', 'paralyze'] }, rare: true }),

    // light body — thief monk hunter bard ninja alchemist …
    traveler_clothes: A('たびじのふく',    'light',  3,    30, 1, 'ながい たびにも たえる じょうぶな ふく。'),
    leather_vest:    A('かわのベスト',     'light',  7,   110, 1, 'なめした かわの ベスト。 うごきやすい。'),
    hard_leather:    A('ハードレザー',     'light', 11,   350, 1, 'ろうで かためた かわの よろい。'),
    kenpo_gi:        A('けんぽうぎ',       'light', 16,   800, 2, 'ぶじゅつかの ための うごきやすい どうぎ。', { stats: { agi: 2 } }),
    forest_garb:     A('もりびとのふく',   'light', 21,  1450, 3, 'もりの たみが おった かるく じょうぶな ふく。', { stats: { agi: 3 } }),
    sand_mantle:     A('すなかぜのマント', 'light', 26,  2400, 3, 'すなあらしから みを まもる マント。', { mdef: 3, stats: { agi: 3 } }),
    silk_coat:       A('ぎんしのコート',   'light', 32,  4100, 4, 'ぎんの いとで おった コート。 こおりに つよい。', { mdef: 4, stats: { agi: 4 }, mods: { elemResist: { ice: 0.5 } } }),
    ninja_garb:      A('しのびのころも',   'light', 36,  4500, 4, 'かげに とける しのびの ころも。 みを かわしやすい。', { eva: 5, stats: { agi: 8 }, rare: true }),
    gale_garb:       A('しっぷうのふく',   'light', 41,  6000, 5, 'かぜの ように かるい ふく。', { mdef: 6, stats: { agi: 6 } }),
    holy_vest:       A('せいぎんのベスト', 'light', 51, 10100, 6, 'せいなる ぎんを おりこんだ ベスト。', { mdef: 9, stats: { agi: 8 } }),
    phoenix_garb:    A('ほうおうのころも', 'light', 60,     0, 6, 'ほうおうの はねで おった でんせつの ころも。', { mdef: 12, eva: 6, stats: { agi: 12 }, mods: { elemResist: { fire: 0.5 } }, rare: true }),

    // robes — priest mage whitemage blackmage sage timemage
    cloth_robe:      A('ぬののローブ',     'robe',  4,    80, 1, 'まほうを まなぶ ものが きる ぬのの ローブ。', { mdef: 3 }),
    apprentice_robe: A('みならいのローブ', 'robe',  8,   300, 1, 'まほうの いとで ぬわれた ローブ。', { mdef: 5 }),
    silk_robe:       A('シルクのローブ',   'robe', 12,   820, 2, 'なめらかな きぬの ローブ。', { mdef: 8 }),
    fairy_robe:      A('ようせいのローブ', 'robe', 16,  1500, 3, 'ようせいの はねの ように かるい ローブ。', { mdef: 11, stats: { mnd: 2 } }),
    dream_robe:      A('ゆめみのローブ',   'robe', 19,  2100, 3, 'ゆめの ちからで まりょくが わきでる ローブ。', { mdef: 15, stats: { mp: 15, int: 3 }, rare: true }),
    moon_robe:       A('つきよのローブ',   'robe', 20,  2400, 3, 'つきの ひかりを おりこんだ ローブ。', { mdef: 14, stats: { int: 2 } }),
    glacier_robe:    A('ひょうがのローブ', 'robe', 26,  4100, 4, 'こおりの せいれいの ローブ。 こおりに つよい。', { mdef: 17, mods: { elemResist: { ice: 0.5 } } }),
    starseer_robe:   A('ほしよみのローブ', 'robe', 33,  6000, 5, 'ほしを よむ まどうしの ローブ。', { mdef: 22, stats: { int: 3, mnd: 3 } }),
    holy_robe:       A('せいぎんのローブ', 'robe', 41, 10100, 6, 'せいなる ぎんの いとで ぬった ローブ。', { mdef: 28, stats: { int: 4, mnd: 4 } }),
    goddess_robe:    A('めがみのローブ',   'robe', 50,     0, 6, 'めがみの かごを うけた でんせつの ローブ。', { mdef: 40, stats: { int: 10, mnd: 10 }, mods: { statusImmune: ['silence'] }, rare: true }),

    // helms
    bronze_helm:     A('あかがねのかぶと', 'helm',  4,    90, 1, 'あかがねで つくった かぶと。'),
    iron_helm:       A('くろがねのかぶと', 'helm',  7,   330, 1, 'くろがねで つくった かぶと。'),
    knight_helm:     A('ナイトヘルム',     'helm', 10,   800, 2, 'かおまで まもる きしの かぶと。'),
    silver_helm:     A('しろがねのかぶと', 'helm', 14,  1300, 3, 'しろがねに かがやく かぶと。'),
    great_helm:      A('グレートヘルム',   'helm', 17,  2100, 3, 'あたまを すっぽり おおう おおかぶと。'),
    platinum_helm:   A('はくぎんのかぶと', 'helm', 21,  3450, 4, 'はくぎんで つくられた かぶと。', { mdef: 2 }),
    stardust_helm:   A('ほしくずのかぶと', 'helm', 26,  5000, 5, 'ほしくずの ひかりを はなつ かぶと。', { mdef: 4 }),
    holy_helm:       A('せいぎんのかぶと', 'helm', 32,  8300, 6, 'せいなる ぎんの かぶと。', { mdef: 6 }),
    dawn_helm:       A('あけぼののかぶと', 'helm', 38,     0, 6, 'よあけの ひかりが まよいを はらう かぶと。', { mdef: 10, mods: { statusImmune: ['confuse', 'sleep'] }, rare: true }),

    // hats
    cloth_hat:       A('ぬののぼうし',     'hat',  2,    40, 1, 'ぬので できた かんたんな ぼうし。'),
    leather_hood:    A('かわのずきん',     'hat',  4,   160, 1, 'あたまを すっぽり つつむ かわの ずきん。'),
    pointy_hat:      A('とんがりぼうし',   'hat',  6,   560, 2, 'まほうつかいが このむ とがった ぼうし。', { mdef: 2, stats: { int: 2 } }),
    cat_hood:        A('ねこみみフード',   'hat',  6,   900, 2, 'ねこの みみが ついた フード。 なぜか うんが よくなる。', { mdef: 2, stats: { luk: 8, agi: 3 }, rare: true }),
    circlet:         A('サークレット',     'hat',  9,  1100, 3, 'ひたいを まもる ぎんの わ。', { mdef: 4, stats: { mnd: 1 } }),
    turban:          A('ターバン',         'hat', 12,  1900, 3, 'さばくの たみが まく ぬの。 かるくて じょうぶ。', { mdef: 4, stats: { agi: 2 } }),
    fur_hat:         A('けがわのぼうし',   'hat', 15,  3100, 4, 'ゆきぐにの あたたかい けがわの ぼうし。', { mdef: 6 }),
    star_crown:      A('ほしのかんむり',   'hat', 19,  4400, 5, 'ほしを かたどった ちいさな かんむり。', { mdef: 10, stats: { int: 3 } }),
    light_crown:     A('ひかりのかんむり', 'hat', 24,  7500, 6, 'きよらかな ひかりを はなつ かんむり。', { mdef: 14, stats: { int: 4, mnd: 4 } }),
    goddess_crown:   A('めがみのかんむり', 'hat', 28,     0, 6, 'めがみの ちえが やどる でんせつの かんむり。', { mdef: 20, stats: { int: 8, mnd: 8 }, mods: { statusImmune: ['silence', 'confuse'] }, rare: true }),

    // shields
    oak_shield:      A('ならのたて',       'shield',  3,    60, 1, 'ならの いたで つくった かるい たて。', { eva: 2 }),
    bronze_shield:   A('あかがねのたて',   'shield',  6,   240, 1, 'あかがねを はった まるい たて。', { eva: 3 }),
    iron_shield:     A('くろがねのたて',   'shield', 10,   700, 2, 'くろがねで できた おもい たて。', { eva: 4 }),
    silver_shield:   A('しろがねのたて',   'shield', 14,  1300, 3, 'しろがねに かがやく たて。', { eva: 5 }),
    kite_shield:     A('カイトシールド',   'shield', 17,  2150, 3, 'ぜんしんを まもる ながい たて。', { eva: 6 }),
    glacier_shield:  A('ひょうがのたて',   'shield', 18,  3300, 4, 'こおりの せいれいの たて。 こおりに つよい。', { eva: 6, mods: { elemResist: { ice: 0.5 } } }),
    flame_shield:    A('ほむらのたて',     'shield', 20,  4100, 4, 'ほのおの せいれいの たて。 ほのおに つよい。', { eva: 6, mods: { elemResist: { fire: 0.5 } }, rare: true }),
    platinum_shield: A('はくぎんのたて',   'shield', 21,  3750, 4, 'はくぎんで できた かるい たて。', { eva: 7, mdef: 2 }),
    stardust_shield: A('ほしくずのたて',   'shield', 27,  5500, 5, 'ほしくずが じゅもんを はじく たて。', { eva: 8, mdef: 5 }),
    dragon_shield:   A('りゅうりんのたて', 'shield', 31,  6100, 5, 'りゅうの うろこの たて。 ほのお こおり いかずちに つよい。', { eva: 9, mdef: 6, mods: { elemResist: { fire: 0.5, ice: 0.5, thunder: 0.5 } }, rare: true }),
    holy_shield:     A('せいぎんのたて',   'shield', 34,  8900, 6, 'せいなる ぎんの たて。', { eva: 10, mdef: 8 }),
    dawn_shield:     A('あけぼののたて',   'shield', 42,     0, 6, 'よあけの ひかりが あらゆる まを はらう たて。', { eva: 12, mdef: 12, mods: { elemResist: { dark: 0.5, fire: 0.75, ice: 0.75, thunder: 0.75 } }, rare: true }),
  };

  // ----------------------------------------------------------- accessories
  const accessories = {
    clover:         X('よつばのおまもり',  300, 1, 'よつばの クローバーの おまもり。 うんが よくなる。', { stats: { luk: 10 }, rare: true }),
    power_bracer:   X('ごうりきのうでわ',  900, 2, 'みにつけると ちからが わいてくる うでわ。', { stats: { str: 6 } }),
    magic_ring:     X('まどうのゆびわ',    900, 2, 'かしこさを たかめる まどうしの ゆびわ。', { stats: { int: 6 } }),
    escape_shoes:   X('にげあしのくつ',    450, 2, 'たたかいから にげやすくなる くつ。', { stats: { agi: 2 }, mods: { escapePct: 50 } }),
    poison_bell:    X('どくよけのすず',    350, 2, 'どくを うけつけなくなる ちいさな すず。', { mods: { statusImmune: ['poison'] } }),
    gold_charm:     X('こがねのおまもり', 2000, 2, 'たたかいで てにいれる ゴールドが ふえる。', { mods: { goldPct: 50 }, rare: true }),
    iron_ring:      X('てっぺきのゆびわ', 1300, 3, 'みの まもりを かたくする ゆびわ。', { def: 8 }),
    wake_brooch:    X('めざめのブローチ',  960, 3, 'ねむりを うけつけなくなる ブローチ。', { mods: { statusImmune: ['sleep'] } }),
    thief_glove:    X('すりのてぶくろ',   1100, 3, 'まものから ぬすみやすくなる てぶくろ。', { stats: { agi: 2 }, mods: { stealPct: 50 } }),
    vigor_shoes:    X('げんきのくつ',     1200, 3, 'あるくたびに HPが すこし かいふくする くつ。', { mods: { walkHeal: 1 } }),
    rosary:         X('いのりのロザリオ', 2550, 3, 'いのりの ちからで かいふくの こうかが ます。', { stats: { mnd: 5 }, mods: { healPct: 15 } }),
    tiger_fang:     X('とらのきば',       2250, 3, 'かいしんの いちげきが でやすくなる きば。', { stats: { str: 3 }, mods: { crit: 8 } }),
    free_bracelet:  X('じゆうのうでわ',   1900, 3, 'まひを うけつけなくなる うでわ。', { mods: { statusImmune: ['paralyze'] } }),
    mana_pierce:    X('まりょくのピアス', 2900, 3, 'さいだいMPが ふえる ふしぎな ピアス。', { mods: { mpPct: 15 } }),
    maneki:         X('まねきねこ',       2400, 3, 'めずらしい ものを まねきよせる おきもの。', { mods: { rarePct: 100 }, rare: true }),
    study_charm:    X('まなびのおまもり', 2400, 3, 'たたかいで えられる けいけんちが ふえる。', { mods: { expPct: 20 }, rare: true }),
    float_shoes:    X('ふゆうのくつ',     2000, 3, 'すこし ういて あるく くつ。 ゆかの ダメージを うけない。', { mods: { noFloorDamage: true }, rare: true }),
    frost_ring:     X('しもよけのゆびわ', 2450, 4, 'こおりの こうげきを やわらげる ゆびわ。', { mods: { elemResist: { ice: 0.5 } } }),
    fire_ring:      X('ひよけのゆびわ',   2450, 4, 'ほのおの こうげきを やわらげる ゆびわ。', { mods: { elemResist: { fire: 0.5 } } }),
    life_belt:      X('せいめいのおび',   3950, 4, 'さいだいHPが ふえる じょうぶな おび。', { mods: { hpPct: 10 } }),
    wind_bracelet:  X('かぜのうでわ',     3450, 4, 'かぜの ように すばやく うごける うでわ。', { stats: { agi: 8 } }),
    speed_boots:    X('はやてのくつ',     4900, 4, 'たたかいの はじめから すばやさが あがる。', { stats: { agi: 5 }, mods: { startBuffs: { agi: 1 } }, rare: true }),
    loot_bag:       X('えものぶくろ',     3300, 4, 'まものが どうぐを おとしやすくなる ふくろ。', { mods: { dropPct: 50 }, rare: true }),
    star_earring:   X('ほしのイヤリング', 4950, 5, 'じゅもんの しょうひMPが へる イヤリング。', { mods: { mpCostPct: -20 } }),
    barrier_charm:  X('けっかいのおふだ', 4600, 5, 'たたかいの はじめから しゅびりょくが あがる。', { mods: { startBuffs: { def: 1 } } }),
    thunder_ring:   X('らいよけのゆびわ', 3050, 5, 'いかずちの こうげきを やわらげる ゆびわ。', { mods: { elemResist: { thunder: 0.5 } } }),
    calm_ring:      X('やすらぎのゆびわ', 3050, 5, 'こんらんを うけつけなくなる ゆびわ。', { mods: { statusImmune: ['confuse'] } }),
    voice_bell:     X('ことだまのすず',   3050, 5, 'じゅもんを ふうじられなくなる すず。', { mods: { statusImmune: ['silence'] } }),
    eagle_eye:      X('わしのひとみ',     3350, 5, 'くらやみを うけつけず めいちゅうが あがる。', { mods: { statusImmune: ['blind'], hit: 5, preemptPct: 10 } }),
    regen_ring:     X('さいせいのゆびわ', 4950, 5, 'たたかいの あいだ すこしずつ HPが かいふくする。', { mods: { regen: true }, rare: true }),
    magic_orb:      X('まどうのたま',     4950, 5, 'じゅもんの いりょくを たかめる すいしょうだま。', { stats: { int: 4 }, mods: { magicPct: 15 }, rare: true }),
    giant_bracer:   X('きょじんのうでわ', 4950, 5, 'きょじんの ちからが やどる うでわ。', { stats: { str: 12, vit: 4 }, rare: true }),
    wisdom_ring:    X('ちえのゆびわ',     4950, 5, 'けんじゃの ちえが やどる ゆびわ。', { stats: { int: 12, mnd: 4 }, rare: true }),
    ward_ring:      X('まよけのゆびわ',   5400, 6, 'やみの こうげきを やわらげる ゆびわ。', { mods: { elemResist: { dark: 0.5 } } }),
    life_charm:     X('いのちのおまもり',  7100, 6, 'しの のろいを うけつけなくなる おまもり。', { mods: { statusImmune: ['death'] } }),
    goddess_charm:  X('めがみのおまもり',    0, 6, 'あらゆる じょうたいいじょうを ふせぐ でんせつの おまもり。', { mods: { statusImmune: ALL_STATUS }, rare: true }),
    golden_maneki:  X('きんのまねきねこ',    0, 6, 'めずらしい ものと おかねを まねく きんの おきもの。', { mods: { rarePct: 200, goldPct: 30 }, rare: true }),
  };

  // ------------------------------------------------------------ key items
  const keys = {
    crest_wind:  K('かぜのもんしょう',   'かぜの ちからを やどす もんしょう。 いつつの もんしょうの ひとつ。'),
    crest_water: K('みずのもんしょう',   'みずの ちからを やどす もんしょう。 いつつの もんしょうの ひとつ。'),
    crest_earth: K('だいちのもんしょう', 'だいちの ちからを やどす もんしょう。 いつつの もんしょうの ひとつ。'),
    crest_fire:  K('ほのおのもんしょう', 'ほのおの ちからを やどす もんしょう。 いつつの もんしょうの ひとつ。'),
    crest_star:  K('ほしのもんしょう',   'ほしの ちからを やどす もんしょう。 いつつの もんしょうの ひとつ。'),
    light_crest: K('ひかりのもんしょう', 'いつつの ちからが ひとつに なった でんせつの もんしょう。 まのうずを はらう。'),
    silver_key:  K('しろがねのかぎ',     'しろがねの とびらを ひらく ふるい かぎ。'),
    gold_key:    K('こがねのかぎ',       'こがねの とびらを ひらく おもい かぎ。'),
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
      'lightning_sword', 'prayer_staff', 'dream_robe', 'maneki', 'study_charm', 'float_shoes', 'seed_str', 'seed_vit'],
    band4: ['nectar', 'healing_aroma', 'all_cure', 'revive_feather', 'thunder_bomb', 'light_drop',
      'platinum_sword', 'giant_axe', 'platinum_spear', 'platinum_dagger', 'kogarashi', 'flame_claw', 'platinum_bow',
      'platinum_staff', 'diamond_rod', 'platinum_harp',
      'platinum_armor', 'silk_coat', 'glacier_robe', 'platinum_helm', 'fur_hat', 'platinum_shield', 'glacier_shield',
      'frost_ring', 'fire_ring', 'life_belt', 'wind_bracelet',
      'glacier_sword', 'glacier_bow', 'sapphire_rod', 'kagerou', 'flame_shield', 'ninja_garb', 'speed_boots', 'loot_bag',
      'seed_int', 'seed_mnd'],
    band5: ['nectar', 'mana_crystal', 'healing_aroma', 'revive_feather', 'mega_bomb', 'goddess_tear', 'light_drop',
      'stardust_sword', 'thunder_axe', 'stardust_spear', 'stardust_dagger', 'oborozuki', 'raijin_claw', 'stardust_bow',
      'starseer_staff', 'stardust_rod', 'star_harp',
      'stardust_armor', 'gale_garb', 'starseer_robe', 'stardust_helm', 'star_crown', 'stardust_shield',
      'star_earring', 'barrier_charm', 'thunder_ring', 'calm_ring', 'voice_bell', 'eagle_eye',
      'dusk_sword', 'night_dagger', 'dragon_mail', 'dragon_shield', 'regen_ring', 'magic_orb', 'giant_bracer', 'wisdom_ring',
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
    band3: ['lightning_sword', 'prayer_staff', 'dream_robe', 'maneki', 'study_charm', 'float_shoes'],
    band4: ['glacier_sword', 'glacier_bow', 'sapphire_rod', 'kagerou', 'flame_shield', 'ninja_garb', 'speed_boots', 'loot_bag', 'light_drop'],
    band5: ['dusk_sword', 'night_dagger', 'dragon_mail', 'dragon_shield', 'regen_ring', 'magic_orb', 'giant_bracer', 'wisdom_ring', 'goddess_tear'],
    band6: ['dawn_sword', 'dawn_armor', 'dawn_shield', 'dawn_helm', 'goddess_lyre', 'goddess_robe', 'goddess_crown', 'goddess_charm',
      'earth_axe', 'sky_spear', 'galaxy_dagger', 'amatsukaze', 'kirin_claw', 'moon_bow', 'angel_staff', 'orb_rod', 'phoenix_garb', 'golden_maneki'],
  };
})(window.RPG);
