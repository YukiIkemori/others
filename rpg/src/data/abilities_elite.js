// Abilities, tiers 3–4: まほうけんし パラディン にんじゃ けんじゃ りゅうきし
// じくうまどうし あんこくきし ゆうしゃ. JP 200–900 (tier 3) / 400–1200 (tier 4).
// See abilities.js for the balance notes.
(function (R) {
  'use strict';

  // ------------------------------------------------------------ builders
  const phys = (power, o) => Object.assign({ type: 'damage', formula: 'phys', power }, o);
  const magic = (power, scale, element, o) => Object.assign({ type: 'damage', formula: 'magic', power, scale }, element ? { element } : {}, o);
  const heal = (power, scale) => ({ type: 'heal', power, scale });
  const buff = (stat, stages, chance) => Object.assign({ type: 'buff', stat, stages }, chance != null ? { chance } : {});
  const status = (s, chance) => ({ type: 'status', status: s, chance });
  const cure = (statuses) => ({ type: 'cure', statuses });
  const act = (name, jp, desc, o) => Object.assign({ name, kind: 'action', jp, desc }, o);
  const reaction = (name, jp, desc, trigger, chance, react) => ({ name, kind: 'reaction', jp, desc, trigger, chance, react });
  const support = (name, jp, desc, mods) => ({ name, kind: 'support', jp, desc, mods });
  const field = (name, jp, desc, mods) => ({ name, kind: 'field', jp, desc, mods });
  const add = (job, list) => { for (const id in list) R.DB.abilities[id] = Object.assign({ job }, list[id]); };
  const JUTSU = '{user}は {name}を つかった！';

  // ============================================================ まほうけんし
  add('spellblade', {
    spellblade_flame: act('ほむらぎり', 200, 'ほのおを まとった けんで きりつける。', {
      mp: 4, target: 'enemy', effects: [phys(1.4, { element: 'fire' })], fx: 'fire1',
    }),
    spellblade_frost: act('ひょうけつぎり', 200, 'こおりを まとった けんで きりつける。', {
      mp: 4, target: 'enemy', effects: [phys(1.4, { element: 'ice' })], fx: 'ice1',
    }),
    spellblade_thunder: act('らいめいぎり', 250, 'いかずちを まとった けんで きりつける。', {
      mp: 4, target: 'enemy', effects: [phys(1.4, { element: 'thunder' })], fx: 'thunder1',
    }),
    spellblade_seal: act('まふうぎり', 300, 'きりつけて てきの じゅもんを ふうじる。', {
      mp: 3, target: 'enemy', effects: [phys(1.0), status('silence', 0.6)], fx: 'slash',
    }),
    spellblade_gale: act('かざきり', 400, 'かぜの やいばで てきの むれを きりさく。', {
      mp: 6, target: 'group', effects: [phys(0.9, { element: 'wind' })], fx: 'wind2',
    }),
    spellblade_enchant: act('まけんかくせい', 500, 'じぶんの こうげきと まりょくを あげる。', {
      mp: 6, target: 'self', effects: [buff('atk', 1), buff('mag', 1)], fx: 'buff',
    }),
    spellblade_dance: act('まけんらんぶ', 800, 'まけんが まいおどり 4かい きりさく。', {
      mp: 12, target: 'random', effects: [phys(0.8, { hits: 4 })], fx: 'slash3',
    }),
    spellblade_riposte: reaction('まけんのかえし', 500, 'じゅもんを うけると ときどき きりかえす。', 'hitMagic', 0.6, { type: 'counter' }),
    spellblade_equip_sword: support('けんそうび', 500, 'どの ジョブでも けんを そうびできる。', { equip: ['sword'] }),
    spellblade_dual_path: support('ぶんぶのみち', 600, 'ちからと かしこさが 10% あがる。', { strPct: 10, intPct: 10 }),
  });

  // ============================================================ パラディン
  add('paladin', {
    paladin_holy_blade: act('ひかりのけん', 250, 'せいなる いちげき。 アンデッドに つよい。', {
      mp: 5, target: 'enemy', effects: [phys(1.4, { element: 'holy', vs: { undead: 1.5 } })], fx: 'holy1',
    }),
    paladin_heal: act('せいなるいやし', 300, 'ひとりの HPを おおきく かいふくする。', {
      mp: 8, magic: true, target: 'ally', effects: [heal(50, 0.9)], fx: 'heal2', fieldUse: true,
    }),
    paladin_purify: act('はじゃのひかり', 350, 'ぜんいんの じょうたいいじょうを なおす。', {
      mp: 10, magic: true, target: 'allies', effects: [cure('all')], fx: 'cure', fieldUse: true,
    }),
    paladin_sacrifice: act('いのちわけ', 400, 'HPを わけあたえ なかまを おおきく いやす。', {
      mp: 0, target: 'ally', effects: [{ type: 'heal', pct: 0.6, hpCost: 0.25 }], fx: 'heal',
    }),
    paladin_wave: act('ひかりのなみ', 500, 'ひかりの なみで てき ぜんたいを うつ。', {
      mp: 10, target: 'enemies', effects: [phys(0.8, { element: 'holy', vs: { undead: 1.5 } })], fx: 'holy2',
    }),
    paladin_cross: act('じゅうじぎり', 600, 'せいなる じゅうじを きざむ 2れんげき。', {
      mp: 8, target: 'enemy', effects: [phys(1.0, { element: 'holy', hits: 2, vs: { undead: 1.5 } })], fx: 'holy3',
    }),
    paladin_last_stand: reaction('ふくつのちかい', 800, 'たおれても いちどだけ たちあがる。', 'ko', 1, { type: 'revive', pct: 0.5 }),
    paladin_guardian: reaction('まもりびと', 500, 'HPの すくない なかまを かならず かばう。', 'allyLowHp', 1, { type: 'cover' }),
    paladin_ward: support('はじゃのこころ', 600, 'どく ねむり まひ こんらんを ふせぐ。', { statusImmune: ['poison', 'sleep', 'paralyze', 'confuse'] }),
    paladin_life: support('せいなるいのち', 700, 'せんとうちゅう HPが すこしずつ もどる。', { regen: true }),
  });

  // ============================================================ にんじゃ
  add('ninja', {
    ninja_shuriken: act('しゅりけん', 200, 'しゅりけんを なげ てきを 3かい こうげき。', {
      mp: 3, target: 'random', effects: [phys(0.7, { hits: 3 })], fx: 'pierce', msg: JUTSU,
    }),
    ninja_smoke: act('けむりがくれ', 200, 'けむりに まぎれて かならず にげだす。', {
      mp: 2, target: 'self', effects: [{ type: 'escape' }], fx: 'smoke', msg: JUTSU,
    }),
    ninja_bind: act('かげしばり', 300, 'かげを ぬいとめ てきを しびれさせる。', {
      mp: 4, target: 'enemy', effects: [status('paralyze', 0.5)], fx: 'paralyze', msg: JUTSU,
    }),
    ninja_mirage: act('げんえいじゅつ', 350, 'まぼろしで すばやさと しゅびを あげる。', {
      mp: 4, target: 'self', effects: [buff('agi', 2), buff('def', 1)], fx: 'buff', msg: JUTSU,
    }),
    ninja_flame: act('ほむらのじゅつ', 400, 'ほのおの うずで てき ぜんたいを やく。', {
      mp: 8, target: 'enemies', effects: [phys(0.7, { element: 'fire' })], fx: 'fire2', msg: JUTSU,
    }),
    ninja_thunder: act('なるかみ', 400, 'かみなりを よび てき ぜんたいを うつ。', {
      mp: 8, target: 'enemies', effects: [phys(0.7, { element: 'thunder' })], fx: 'thunder2', msg: JUTSU,
    }),
    ninja_water: act('みずちのじゅつ', 400, 'みずの りゅうが てき ぜんたいを のみこむ。', {
      mp: 8, target: 'enemies', effects: [phys(0.7, { element: 'water' })], fx: 'water2', msg: JUTSU,
    }),
    ninja_assassin: act('しのびうち', 600, 'かげからの いちげき。 かいしんが でやすい。', {
      mp: 5, target: 'enemy', effects: [phys(1.6, { critBonus: 30 })], fx: 'slash3',
    }),
    ninja_retaliate: reaction('かえりうち', 700, 'こうげきを うけると よく はんげきする。', 'hitAny', 0.45, { type: 'counter' }),
    ninja_two_swords: support('にとうりゅう', 900, 'ぶきを ふたつ もち 2かい こうげきする。', { twoSwords: true }),
    ninja_equip_katana: support('かたなそうび', 500, 'どの ジョブでも かたなを そうびできる。', { equip: ['katana'] }),
  });

  // ============================================================ けんじゃ
  add('sage', {
    sage_full_heal: act('フルヒール', 350, 'なかま ひとりの HPを すべて かいふくする。', {
      mp: 18, magic: true, target: 'ally', effects: [{ type: 'heal', pct: 1 }], fx: 'heal3', fieldUse: true,
    }),
    sage_blessed_rain: act('めぐみのあめ', 500, 'ぜんいんの HPを おおきく かいふくする。', {
      mp: 24, magic: true, target: 'allies', effects: [heal(70, 1.0)], fx: 'heal3', fieldUse: true,
    }),
    sage_prominence: act('プロミネンス', 600, 'たいようの ほのおで てきを やきつくす。', {
      mp: 30, magic: true, target: 'enemy', effects: [magic(40, 1.2, 'fire')], fx: 'fire3',
    }),
    sage_zero: act('ぜったいれいど', 600, 'すべてを こおらせる れいきで てきを うつ。', {
      mp: 30, magic: true, target: 'enemy', effects: [magic(40, 1.2, 'ice')], fx: 'ice3',
    }),
    sage_mother: act('せいぼのいのり', 700, 'たおれた なかま ぜんいんを いきかえらせる。', {
      mp: 40, magic: true, target: 'allies', effects: [{ type: 'revive', pct: 0.5 }], fx: 'revive', fieldUse: true,
    }),
    sage_stardust: act('ほしくずのあめ', 800, 'ほしくずを ふらせ てき ぜんたいを うつ。', {
      mp: 36, magic: true, target: 'enemies', effects: [magic(10, 0.75)], fx: 'meteor3',
    }),
    sage_mana_return: reaction('まりょくかんげん', 450, 'ダメージを うけると MPが もどる。', 'hitAny', 0.5, { type: 'mp', power: 12 }),
    sage_half_mp: support('MPはんげん', 900, 'しょうひMPが はんぶんに なる。', { mpCostPct: -50 }),
  });

  // ============================================================ りゅうきし
  add('dragoon', {
    dragoon_wyvern: act('ひりゅうづき', 250, 'そらとぶ てきと りゅうに つよい つき。', {
      mp: 4, target: 'enemy', effects: [phys(1.5, { vs: { flying: 1.5, dragon: 1.5 } })], fx: 'pierce',
    }),
    dragoon_leech: act('きゅうけつづき', 300, 'つきさして てきの HPを すいとる。', {
      mp: 3, target: 'enemy', effects: [phys(1.0, { drain: 0.5 })], fx: 'drain',
    }),
    dragoon_pierce: act('よろいつらぬき', 350, 'しゅびりょくを むしして つらぬく。', {
      mp: 4, target: 'enemy', effects: [phys(1.2, { ignoreDef: true })], fx: 'pierce2',
    }),
    dragoon_roar: act('ほうこう', 400, 'ほえて てき ぜんたいの こうげきを さげる。', {
      mp: 6, target: 'enemies', effects: [buff('atk', -1, 0.6)], fx: 'debuff',
    }),
    dragoon_breath: act('りゅうのいぶき', 500, 'ほのおを はき てき ぜんたいを やく。', {
      mp: 10, target: 'enemies', effects: [{ type: 'damage', formula: 'breath', power: 60, element: 'fire' }], fx: 'breath_fire',
    }),
    dragoon_meteor: act('りゅうせいづき', 650, 'たかく とびあがり てきを つらぬく。', {
      mp: 6, target: 'enemy', effects: [phys(2.2, { acc: 0.9 })], fx: 'jump',
    }),
    dragoon_great_breath: act('ドラゴンブレス', 800, 'りゅうの いぶきで てき ぜんたいを うつ。', {
      mp: 24, target: 'enemies', effects: [{ type: 'damage', formula: 'breath', power: 110 }], fx: 'breath',
    }),
    dragoon_wrath: reaction('りゅうのいかり', 450, 'こうげきされると こうげきが あがる。', 'hitAny', 0.4, { type: 'buff', stat: 'atk', stages: 1 }),
    dragoon_equip_spear: support('やりそうび', 450, 'どの ジョブでも やりを そうびできる。', { equip: ['spear'] }),
    dragoon_might: support('りゅうのちから', 700, 'ぶきで あたえる ダメージが 20% あがる。', { physPct: 20 }),
  });

  // ============================================================ じくうまどうし
  add('timemage', {
    timemage_haste: act('かそく', 200, 'ひとりの すばやさを おおきく あげる。', {
      mp: 5, magic: true, target: 'ally', effects: [buff('agi', 2)], fx: 'buff',
    }),
    timemage_slow: act('げんそく', 250, 'てきの むれの すばやさを さげる。', {
      mp: 5, magic: true, target: 'group', effects: [buff('agi', -1, 0.8)], fx: 'debuff',
    }),
    timemage_dispel: act('かいじゅ', 250, 'てき ひとりに かかった こうかを うちけす。', {
      mp: 4, magic: true, target: 'enemy', effects: [{ type: 'dispel' }], fx: 'dispel',
    }),
    timemage_gravity: act('じゅうりょく', 400, 'てきの むれの HPを 4ぶんの1 けずる。', {
      mp: 8, magic: true, target: 'group', effects: [{ type: 'damage', formula: 'percent', power: 0.25, acc: 0.8 }], fx: 'gravity',
    }),
    timemage_haste_all: act('じくうかそく', 500, 'みかた ぜんいんの すばやさを あげる。', {
      mp: 14, magic: true, target: 'allies', effects: [buff('agi', 1)], fx: 'buff',
    }),
    timemage_stop: act('ときとめ', 600, 'ときを とめ てきの むれを うごけなくする。', {
      mp: 10, magic: true, target: 'group', effects: [status('paralyze', 0.4)], fx: 'paralyze',
    }),
    timemage_meteor: act('りゅうせいう', 800, 'いんせきを よびよせ てきに 5かい ふらせる。', {
      mp: 36, magic: true, target: 'random', effects: [magic(12, 0.6, null, { hits: 5 })], fx: 'meteor3',
    }),
    timemage_close_call: reaction('ききいっぱつ', 400, 'HPが へると すばやさが おおきく あがる。', 'lowHp', 1, { type: 'buff', stat: 'agi', stages: 2 }),
    timemage_swift: support('しゅんそく', 700, 'たたかいの はじめから すばやさが あがる。', { startBuffs: { agi: 1 } }),
    timemage_float: field('ふゆうのじゅつ', 400, 'うかんで ゆかの ダメージを うけない。', { noFloorDamage: true }),
  });

  // ============================================================ あんこくきし
  add('darkknight', {
    darkknight_shadow: act('やみぎり', 250, 'HPを けずり やみの けんで きりつける。', {
      mp: 0, target: 'enemy', effects: [phys(1.5, { element: 'dark', hpCost: 0.06 })], fx: 'dark1',
    }),
    darkknight_drain: act('きゅうせいけん', 300, 'きりつけて てきの HPを すいとる。', {
      mp: 4, target: 'enemy', effects: [phys(1.2, { element: 'dark', drain: 0.5 })], fx: 'drain',
    }),
    darkknight_curse: act('のろいぎり', 300, 'きりつけ どくと くらやみを あたえる。', {
      mp: 4, target: 'enemy', effects: [phys(1.0, { element: 'dark' }), status('poison', 0.5), status('blind', 0.5)], fx: 'dark1',
    }),
    darkknight_pact: act('ちのけいやく', 400, 'HPを ささげ こうげきと まりょくを あげる。', {
      mp: 0, target: 'self', effects: [Object.assign(buff('atk', 2), { hpCost: 0.15 }), buff('mag', 1)], fx: 'buff',
    }),
    darkknight_wave: act('やみのはどう', 500, 'HPを けずり てき ぜんたいを やみで うつ。', {
      mp: 0, target: 'enemies', effects: [phys(1.0, { element: 'dark', hpCost: 0.12 })], fx: 'dark2',
    }),
    darkknight_reaper: act('いのちがり', 600, 'きりつけ ときどき いきのねを とめる。', {
      mp: 8, target: 'enemy', effects: [phys(0.8, { element: 'dark' }), status('death', 0.25)], fx: 'death',
    }),
    darkknight_doom: act('ほろびのやいば', 800, 'HPを 4ぶんの1 ささげる ほろびの いちげき。', {
      mp: 0, target: 'enemy', effects: [phys(2.8, { element: 'dark', hpCost: 0.25 })], fx: 'dark3',
    }),
    darkknight_fury: reaction('いかりのほのお', 500, 'HPが へると こうげきが おおきく あがる。', 'lowHp', 1, { type: 'buff', stat: 'atk', stages: 2 }),
    darkknight_power: support('ちからアップ', 700, 'ちからが 20% あがる。', { strPct: 20 }),
  });

  // ============================================================ ゆうしゃ
  add('hero', {
    hero_radiant: act('せいこうざん', 400, 'ひかりを まとった けんで てきを きりさく。', {
      mp: 8, target: 'enemy', effects: [phys(1.8, { element: 'holy' })], fx: 'holy2',
    }),
    hero_courage: act('ゆうきのひ', 400, 'ぜんいんの こうげきと しゅびを あげる。', {
      mp: 18, magic: true, target: 'allies', effects: [buff('atk', 1), buff('def', 1)], fx: 'buff',
    }),
    hero_verdict: act('ひかりのさばき', 550, 'ひかりの つるぎで てき ぜんたいを きる。', {
      mp: 16, target: 'enemies', effects: [phys(0.9, { element: 'holy' })], fx: 'holy2',
    }),
    hero_judgment: act('ジャッジメント', 650, 'てんの ひかりで てき ぜんたいを さばく。', {
      mp: 30, magic: true, target: 'enemies', effects: [magic(90, 0.5, 'holy')], fx: 'holy3',
    }),
    hero_hope: act('きぼうのひかり', 650, 'ぜんいんを かんぜんに かいふくする。', {
      mp: 40, magic: true, target: 'allies', effects: [{ type: 'heal', pct: 1 }, cure('all')], fx: 'heal3', fieldUse: true,
    }),
    hero_luminous: act('ルミナス', 900, 'もんしょうの ひかりを こめた いちげき。', {
      mp: 30, target: 'enemy', effects: [phys(3.0, { element: 'holy', ignoreDef: true })], fx: 'holy3',
    }),
    hero_guiding_light: reaction('みちびきのひかり', 400, 'なかまが ピンチの とき ひかりで いやす。', 'allyLowHp', 0.6, { type: 'heal', pct: 0.5 }),
    hero_heart: support('ゆうしゃのこころ', 600, 'HPと すべての のうりょくが 10% あがる。', { hpPct: 10, strPct: 10, vitPct: 10, agiPct: 10, intPct: 10, mndPct: 10 }),
    hero_aura: field('ひかりのかご', 400, 'まものを さけ あるくと HPが もどる。', { encounterPct: -50, walkHeal: 2, noFloorDamage: true }),
  });
})(window.RPG);
