// Abilities, tier 2: ナイト ぶとうか しろまどうし くろまどうし かりゅうど ぎんゆうしじん くすりし.
// JP 100–600 per ability; ~4000 JP to master a job. See abilities.js for the balance notes.
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
  const SONG = '{user}は {name}を うたった！';
  const BREW = '{user}は {name}を つくりだした！';

  // ============================================================ ナイト
  add('knight', {
    knight_bash: act('たてうち', 100, 'たてで なぐり てきを しびれさせる。', {
      mp: 2, target: 'enemy', effects: [phys(1.0), status('paralyze', 0.25)], fx: 'strike',
    }),
    knight_mind_break: act('まどうくだき', 200, 'きりつけて てきの まりょくを さげる。', {
      mp: 3, target: 'enemy', effects: [phys(0.9), buff('mag', -1, 0.8)], fx: 'slash',
    }),
    knight_speed_break: act('あしくだき', 200, 'あしを ねらって てきの すばやさを さげる。', {
      mp: 3, target: 'enemy', effects: [phys(0.9), buff('agi', -1, 0.8)], fx: 'slash',
    }),
    knight_fortress: act('ふどうのかまえ', 250, 'みを かためて しゅびを おおきく あげる。', {
      mp: 2, target: 'self', effects: [buff('def', 2), buff('mdef', 1)], fx: 'buff',
    }),
    knight_oath: act('まもりのちかい', 400, 'みかた ぜんいんの しゅびりょくを あげる。', {
      mp: 6, target: 'allies', effects: [buff('def', 1)], fx: 'buff',
    }),
    knight_full_power: act('ぜんりょくぎり', 450, 'ありったけの ちからで きりつける。', {
      mp: 5, target: 'enemy', effects: [phys(1.8)], fx: 'slash3',
    }),
    knight_breaker: act('ブレイカー', 500, 'てきの こうげきと しゅびを くだく。', {
      mp: 6, target: 'enemy', effects: [phys(1.2), buff('def', -1, 0.7), buff('atk', -1, 0.7)], fx: 'slash2',
    }),
    knight_cover: reaction('かばいだて', 450, 'HPの すくない なかまを かばう。', 'allyLowHp', 0.75, { type: 'cover' }),
    knight_iron_wall: reaction('てっぺき', 350, 'こうげきされると しゅびが あがる。', 'hitPhys', 0.4, { type: 'buff', stat: 'def', stages: 1 }),
    knight_equip_armor: support('じゅうそうび', 600, 'よろい かぶと たてが そうびできる。', { equip: ['heavy', 'helm', 'shield'] }),
    knight_guard_stance: support('まもりのかまえ', 450, 'せんとうの はじめから しゅびが あがる。', { startBuffs: { def: 1 } }),
  });

  // ============================================================ ぶとうか
  add('monk', {
    monk_chi: act('きこう', 100, 'きを ねって じぶんの HPと どくを いやす。', {
      mp: 2, target: 'self', effects: [heal(24, 0.8), cure(['poison'])], fx: 'heal', fieldUse: true,
    }),
    monk_stun: act('あてみ', 150, 'きゅうしょを ついて てきを しびれさせる。', {
      mp: 2, target: 'enemy', effects: [phys(0.8), status('paralyze', 0.35)], fx: 'strike',
    }),
    monk_focus: act('とうき', 200, 'じぶんの こうげきりょくを おおきく あげる。', {
      mp: 3, target: 'self', effects: [buff('atk', 2)], fx: 'buff',
    }),
    monk_flurry: act('らんげき', 300, 'てきに 4かい つづけて なぐりかかる。', {
      mp: 5, target: 'random', effects: [phys(0.55, { hits: 4 })], fx: 'strike',
    }),
    monk_whirl_kick: act('せんぷうきゃく', 300, 'まわしげりで てきの むれを けちらす。', {
      mp: 4, target: 'group', effects: [phys(0.9)], fx: 'strike2',
    }),
    monk_quake: act('じならし', 350, 'だいちを ゆらし てき ぜんたいを こうげき。', {
      mp: 5, target: 'enemies', effects: [phys(0.75, { element: 'earth', vs: { flying: 0.5 } })], fx: 'earth2',
    }),
    monk_revive: act('かつをいれる', 400, 'かつを いれて なかまを よみがえらせる。', {
      mp: 6, target: 'ally_dead', effects: [{ type: 'revive', pct: 0.2 }], fx: 'revive', fieldUse: true,
    }),
    monk_tiger: act('もうこけん', 450, 'もうれつな いちげき。 かいしんが でやすい。', {
      mp: 6, target: 'enemy', effects: [phys(1.8, { critBonus: 15 })], fx: 'strike3',
    }),
    monk_counter: reaction('かえしわざ', 500, 'こうげきを うけると よく はんげきする。', 'hitPhys', 0.5, { type: 'counter' }),
    monk_ibuki: reaction('いぶき', 400, 'HPが へると いきを ととのえ いやす。', 'lowHp', 0.6, { type: 'heal', pct: 0.4 }),
    monk_brawler: support('すでのこころえ', 400, 'すでの ときの こうげきりょくが あがる。', { unarmed: 30, crit: 5 }),
    monk_training: support('しゅぎょう', 600, 'たたかいで える けいけんちが 50% ふえる。', { expPct: 50 }),
  });

  // ============================================================ しろまどうし
  add('whitemage', {
    whitemage_healing: act('ヒーリング', 150, 'ひとりの HPを おおきく かいふくする。', {
      mp: 6, magic: true, target: 'ally', effects: [heal(45, 1.0)], fx: 'heal2', fieldUse: true,
    }),
    whitemage_esuna: act('きよめのひかり', 200, 'ひとりの じょうたいいじょうを なおす。', {
      mp: 4, magic: true, target: 'ally', effects: [cure('all')], fx: 'cure', fieldUse: true,
    }),
    whitemage_regen: act('いのちのいずみ', 300, 'ひとりの HPを すこしずつ かいふくさせる。', {
      mp: 5, magic: true, target: 'ally', effects: [{ type: 'regen' }], fx: 'regen',
    }),
    whitemage_arrow: act('ひかりのや', 300, 'せいなる ひかりの やで てきを いぬく。', {
      mp: 7, magic: true, target: 'enemy', effects: [magic(30, 0.7, 'holy', { vs: { undead: 1.5 } })], fx: 'holy2',
    }),
    whitemage_purge: act('はらいのひかり', 350, 'てきの むれを うつ。 アンデッドに つよい。', {
      mp: 8, magic: true, target: 'group', effects: [magic(12, 0.4, 'holy', { vs: { undead: 3 } })], fx: 'holy',
    }),
    whitemage_guard: act('しゅごのひかり', 400, 'ぜんいんの ぼうぎょを すべて あげる。', {
      mp: 12, magic: true, target: 'allies', effects: [buff('def', 1), buff('mdef', 1)], fx: 'buff',
    }),
    whitemage_heal_wind: act('いやしのかぜ', 450, 'みかた ぜんいんの HPを かいふくする。', {
      mp: 12, magic: true, target: 'allies', effects: [heal(30, 0.7)], fx: 'heal2', fieldUse: true,
    }),
    whitemage_resurrect: act('リザレクション', 550, 'なかまを HP 6わりで よみがえらせる。', {
      mp: 18, magic: true, target: 'ally_dead', effects: [{ type: 'revive', pct: 0.6 }], fx: 'revive', fieldUse: true,
    }),
    whitemage_mending_hand: reaction('いやしのて', 500, 'なかまが ピンチの とき HPを いやす。', 'allyLowHp', 0.5, { type: 'heal', pct: 0.4 }),
    whitemage_heal_up: support('かいふくアップ', 500, 'かいふくじゅもんの こうかが 30% あがる。', { healPct: 30 }),
    whitemage_robe: support('まほうのころも', 350, 'まほうぼうぎょが 30% あがる。', { mdefPct: 30 }),
  });

  // ============================================================ くろまどうし
  add('blackmage', {
    blackmage_fire2: act('かえんのうず', 150, 'ほのおの うずで てきの むれを やきつくす。', {
      mp: 7, magic: true, target: 'group', effects: [magic(4, 0.5, 'fire')], fx: 'fire2',
    }),
    blackmage_ice2: act('アイスストーム', 150, 'こおりの あらしが てきの むれを おそう。', {
      mp: 7, magic: true, target: 'group', effects: [magic(4, 0.5, 'ice')], fx: 'ice2',
    }),
    blackmage_poison: act('どくのきり', 150, 'どくの きりで てきの むれを どくに する。', {
      mp: 4, magic: true, target: 'group', effects: [status('poison', 0.65)], fx: 'poison',
    }),
    blackmage_thunder2: act('いかずちのあめ', 200, 'いなずまが てき ぜんたいに ふりそそぐ。', {
      mp: 10, magic: true, target: 'enemies', effects: [magic(2, 0.38, 'thunder')], fx: 'thunder2',
    }),
    blackmage_confuse: act('まどわしのかぜ', 250, 'てきの むれを こんらんさせる。', {
      mp: 5, magic: true, target: 'group', effects: [status('confuse', 0.45)], fx: 'confuse',
    }),
    blackmage_osmose: act('まりょくすい', 300, 'てき ひとりの MPを すいとる。', {
      mp: 0, magic: true, target: 'enemy', effects: [magic(6, 0.2, null, { mp: true, drain: 1 })], fx: 'drain',
    }),
    blackmage_blast: act('ばくえん', 300, 'はげしい ばくえんで てき ひとりを やく。', {
      mp: 8, magic: true, target: 'enemy', effects: [magic(16, 0.8, 'fire')], fx: 'explosion2',
    }),
    blackmage_death: act('たましいぬき', 450, 'てき ひとりの たましいを ぬきとる。', {
      mp: 10, magic: true, target: 'enemy', effects: [status('death', 0.35)], fx: 'death',
    }),
    blackmage_inferno: act('インフェルノ', 600, 'ごうかで てき ぜんたいを やきはらう。', {
      mp: 18, magic: true, target: 'enemies', effects: [magic(6, 0.6, 'fire')], fx: 'fire3',
    }),
    blackmage_awaken: reaction('まりょくかくせい', 400, 'じゅもんを うけると まりょくが あがる。', 'hitMagic', 0.6, { type: 'buff', stat: 'mag', stages: 1 }),
    blackmage_magic_up: support('まほうアップ', 600, 'じゅもんの ダメージが 25% あがる。', { magicPct: 25 }),
    blackmage_elem_up: support('ぞくせいアップ', 450, 'ほのお こおり いかずち かぜが つよまる。', { elemBoost: { fire: 25, ice: 25, thunder: 25, wind: 25 } }),
  });

  // ============================================================ かりゅうど
  add('hunter', {
    hunter_aim: act('ねらいうち', 100, 'よく ねらって うつ。 かいしんが でやすい。', {
      mp: 2, target: 'enemy', effects: [phys(1.3, { acc: 1.3, critBonus: 10 })], fx: 'pierce',
    }),
    hunter_venom: act('どくや', 150, 'どくを ぬった やを うつ。', {
      mp: 2, target: 'enemy', effects: [phys(0.8), status('poison', 0.7)], fx: 'pierce',
    }),
    hunter_double: act('にれんしゃ', 200, 'すばやく 2かい うつ。', {
      mp: 3, target: 'enemy', effects: [phys(0.8, { hits: 2 })], fx: 'pierce',
    }),
    hunter_sleep: act('ねむりや', 250, 'ねむりぐすりの やで てきを ねむらせる。', {
      mp: 3, target: 'enemy', effects: [phys(0.6), status('sleep', 0.5)], fx: 'pierce',
    }),
    hunter_numb: act('しびれや', 300, 'しびれぐすりの やで てきを しびれさせる。', {
      mp: 3, target: 'enemy', effects: [phys(0.6), status('paralyze', 0.4)], fx: 'pierce',
    }),
    hunter_skyshot: act('うちおとし', 300, 'そらとぶ てきに だいダメージを あたえる。', {
      mp: 3, target: 'enemy', effects: [phys(1.2, { vs: { flying: 2 } })], fx: 'pierce2',
    }),
    hunter_rain: act('やのあめ', 400, 'やの あめを ふらせ てきを 4かい こうげき。', {
      mp: 6, target: 'random', effects: [phys(0.55, { hits: 4 })], fx: 'pierce2',
    }),
    hunter_deadeye: act('ひっさつのや', 550, 'まれに てきを いちげきで しとめる。', {
      mp: 6, target: 'enemy', effects: [{ type: 'damage', formula: 'percent', power: 1, acc: 0.2 }], fx: 'pierce3',
    }),
    hunter_cover_fire: reaction('えんごしゃげき', 450, 'なかまが ピンチに なると てきを うつ。', 'allyLowHp', 0.6, { type: 'counter' }),
    hunter_equip_bow: support('ゆみそうび', 350, 'どの ジョブでも ゆみを そうびできる。', { equip: ['bow'] }),
    hunter_spoils: support('えものがり', 500, 'まものが どうぐを おとしやすくなる。', { dropPct: 100 }),
    hunter_lure: field('えものよせ', 300, 'まものに であいやすくなる。', { encounterPct: 100 }),
  });

  // ============================================================ ぎんゆうしじん
  add('bard', {
    bard_lullaby: act('こもりうた', 100, 'てき ぜんたいを ねむりに さそう。', {
      mp: 4, target: 'enemies', effects: [status('sleep', 0.4)], fx: 'song', msg: SONG,
    }),
    bard_swift: act('しっぷうのうた', 200, 'みかた ぜんいんの すばやさを あげる。', {
      mp: 5, target: 'allies', effects: [buff('agi', 1)], fx: 'song', msg: SONG,
    }),
    bard_hymn: act('いやしのうた', 250, 'みかた ぜんいんの HPを かいふくする。', {
      mp: 6, target: 'allies', effects: [heal(12, 0.45)], fx: 'song', msg: SONG, fieldUse: true,
    }),
    bard_battle: act('たたかいのうた', 300, 'みかた ぜんいんの こうげきりょくを あげる。', {
      mp: 7, target: 'allies', effects: [buff('atk', 1)], fx: 'song', msg: SONG,
    }),
    bard_requiem: act('ちんこんか', 300, 'しずめの うた。 アンデッドに よく きく。', {
      mp: 8, target: 'enemies', effects: [magic(8, 0.35, 'holy', { vs: { undead: 2 } })], fx: 'song', msg: SONG,
    }),
    bard_bewilder: act('まどわしのうた', 350, 'てき ぜんたいを こんらんさせる。', {
      mp: 6, target: 'enemies', effects: [status('confuse', 0.35)], fx: 'song', msg: SONG,
    }),
    bard_mana: act('まりょくのうた', 400, 'ぜんいんの MPを すこし かいふくする。', {
      mp: 0, target: 'allies', effects: [{ type: 'healMp', power: 10 }], fx: 'song', msg: SONG,
    }),
    bard_life: act('いのちのうた', 500, 'ぜんいんの どくを けし すこしずつ いやす。', {
      mp: 12, target: 'allies', effects: [cure(['poison']), { type: 'regen' }], fx: 'song', msg: SONG,
    }),
    bard_rally: reaction('たちなおり', 350, 'HPが へると うたって じぶんを いやす。', 'lowHp', 0.7, { type: 'heal', pct: 0.3 }),
    bard_learning: support('まなびのこころ', 600, 'たたかいで えられる JPが 50% ふえる。', { jpPct: 50 }),
    bard_calm: field('やすらぎのしらべ', 450, 'まものに であいにくくなる。', { encounterPct: -50 }),
  });

  // ============================================================ くすりし
  add('alchemist', {
    alchemist_salve: act('いやしのくすり', 100, 'なかま ひとりの HPを かいふくする。', {
      mp: 3, target: 'ally', effects: [heal(30, 0.3)], fx: 'heal', msg: BREW, fieldUse: true,
    }),
    alchemist_panacea: act('ばんのうやく', 150, 'ひとりの じょうたいいじょうを なおす。', {
      mp: 3, target: 'ally', effects: [cure('all')], fx: 'cure', msg: BREW, fieldUse: true,
    }),
    alchemist_venom: act('どくびん', 150, 'どくびんで てきの むれを どくに する。', {
      mp: 3, target: 'group', effects: [status('poison', 0.7)], fx: 'poison', msg: BREW,
    }),
    alchemist_fire_flask: act('かえんびん', 200, 'もえる びんを なげて てきの むれを やく。', {
      mp: 5, target: 'group', effects: [magic(6, 0.4, 'fire')], fx: 'fire2', msg: BREW,
    }),
    alchemist_numb: act('しびれびん', 250, 'しびれぐすりで てき ひとりを しびれさせる。', {
      mp: 4, target: 'enemy', effects: [status('paralyze', 0.5)], fx: 'paralyze', msg: BREW,
    }),
    alchemist_tonic: act('きょうかやく', 300, 'ひとりの こうげきと しゅびを あげる。', {
      mp: 6, target: 'ally', effects: [buff('atk', 1), buff('def', 1)], fx: 'buff', msg: BREW,
    }),
    alchemist_ether: act('まりょくやく', 400, 'なかま ひとりの MPを 20 かいふくする。', {
      mp: 0, target: 'ally', effects: [{ type: 'healMp', power: 20 }], fx: 'mp', msg: BREW,
    }),
    alchemist_revive: act('ふっかつやく', 450, 'なかまを HP はんぶんで いきかえらせる。', {
      mp: 12, target: 'ally_dead', effects: [{ type: 'revive', pct: 0.5 }], fx: 'revive', msg: BREW, fieldUse: true,
    }),
    alchemist_blast: act('ばくやく', 500, 'ばくやくで てき ぜんたいを ふきとばす。', {
      mp: 12, target: 'enemies', effects: [magic(16, 0.5)], fx: 'explosion2', msg: BREW,
    }),
    alchemist_auto_potion: reaction('とっさのくすり', 450, 'HPが へると どうぐで かいふくする。', 'lowHp', 1, { type: 'autoItem' }),
    alchemist_first_aid: reaction('くすりのえんご', 500, 'なかまが ピンチの とき どうぐで いやす。', 'allyLowHp', 0.7, { type: 'autoItem' }),
    alchemist_item_lore: support('どうぐのちしき', 500, 'どうぐの こうかが 50% あがる。', { itemPct: 50 }),
    alchemist_profit: support('かねもうけ', 450, 'たたかいで てにいれる ゴールドが ふえる。', { goldPct: 50 }),
  });
})(window.RPG);
