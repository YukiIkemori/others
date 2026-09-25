// Abilities, tier 1: せんし そうりょ まほうつかい とうぞく (DESIGN §5.3).
// Tier 2 is in abilities_adv.js, tiers 3–4 in abilities_elite.js.
// Balance (DESIGN §6; `node tools/check_jobs.js` prints the damage/heal tables). mag ≈ atk at
// every level, and a spell deals ≈ (power + 0.5·mag) while a weapon hit is ≈ 0.4·atk, so spells
// are sized in "せんし hits" (ratio at the level where they are usually bought):
//   single  T1 10–12 + mag×0.5–0.55 (≈1.5) · T2 16 + ×0.8 (≈2) · T4 40 + ×1.2 (≈3)
//   group   T1 8 + ×0.38 (≈0.9 each) · T2 4 + ×0.5 (≈1.1) · all T2 2 + ×0.38 (≈1.0) · all T3 6–10 + ×0.6–0.75 (≈1.3–1.5)
//   heals   ヒール 14+mnd×0.7 → ヒーリング 45+×1.0 → めぐみのあめ (all) 70+×1.0 → フルヒール / きぼうのひかり
//   skills  phys power 1.3–2.0 single (MP 2–6), 0.7–0.9 on groups; hpCost skills trade HP for MP 0
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

  // ============================================================ せんし
  add('warrior', {
    warrior_power_slash: act('ちからぎり', 30, 'ねらいは あまいが ちからいっぱい きる。', {
      mp: 0, target: 'enemy', effects: [phys(1.5, { acc: 0.8 })], fx: 'slash',
    }),
    warrior_first_aid: act('てあて', 80, 'じぶんの きずを てあてし どくも けす。', {
      mp: 2, target: 'self', effects: [heal(16, 0.5), cure(['poison'])], fx: 'heal', fieldUse: true,
    }),
    warrior_armor_break: act('よろいくだき', 120, 'きりつけて てきの しゅびりょくを さげる。', {
      mp: 2, target: 'enemy', effects: [phys(1.0), buff('def', -1, 0.8)], fx: 'slash',
    }),
    warrior_weapon_break: act('ぶきくだき', 160, 'きりつけて てきの こうげきりょくを さげる。', {
      mp: 2, target: 'enemy', effects: [phys(1.0), buff('atk', -1, 0.8)], fx: 'slash',
    }),
    warrior_double: act('れんぞくぎり', 200, 'すばやく 2かい きりつける。', {
      mp: 3, target: 'enemy', effects: [phys(0.75, { hits: 2 })], fx: 'slash',
    }),
    warrior_sweep: act('なぎはらい', 240, 'ぶきを ふりまわし てき ぜんたいを うつ。', {
      mp: 4, target: 'enemies', effects: [phys(0.7)], fx: 'slash',
    }),
    warrior_rush: act('とっしん', 260, 'とびこんで きる。 かいしんが でやすい。', {
      mp: 3, target: 'enemy', effects: [phys(1.2, { critBonus: 20 })], fx: 'strike',
    }),
    warrior_war_cry: act('ときのこえ', 280, 'みかた ぜんいんの こうげきりょくを あげる。', {
      mp: 6, target: 'allies', effects: [buff('atk', 1)], fx: 'buff',
    }),
    warrior_mighty: act('もろてぎり', 300, 'りょうてで ちからいっぱい きりおろす。', {
      mp: 5, target: 'enemy', effects: [phys(1.9)], fx: 'slash3',
    }),
    warrior_counter: reaction('はんげき', 300, 'こうげきを うけると ときどき やりかえす。', 'hitPhys', 0.3, { type: 'counter' }),
    warrior_brace: reaction('ふんばり', 250, 'HPが へると しゅびが おおきく あがる。', 'lowHp', 0.8, { type: 'buff', stat: 'def', stages: 2 }),
    warrior_hp_up: support('HPアップ', 300, 'さいだいHPが 20% あがる。', { hpPct: 20 }),
    warrior_equip_axe: support('おのそうび', 150, 'どの ジョブでも おのを そうびできる。', { equip: ['axe'] }),
    warrior_crit_up: support('かいしんアップ', 300, 'かいしんの いちげきが でやすくなる。', { crit: 8 }),
  });

  // ============================================================ そうりょ
  add('priest', {
    priest_heal: act('ヒール', 30, 'なかま ひとりの HPを かいふくする。', {
      mp: 3, magic: true, target: 'ally', effects: [heal(14, 0.7)], fx: 'heal', fieldUse: true,
    }),
    priest_cure: act('げどく', 100, 'なかま ひとりの どくと くらやみを なおす。', {
      mp: 2, magic: true, target: 'ally', effects: [cure(['poison', 'blind'])], fx: 'cure', fieldUse: true,
    }),
    priest_holy: act('ひかりのつぶて', 150, 'せいなる ひかり。 アンデッドに つよい。', {
      mp: 3, magic: true, target: 'enemy', effects: [magic(12, 0.55, 'holy', { vs: { undead: 1.5 } })], fx: 'holy',
    }),
    priest_protect: act('まもりのいのり', 180, 'なかま ひとりの しゅびりょくを あげる。', {
      mp: 3, magic: true, target: 'ally', effects: [buff('def', 1)], fx: 'buff',
    }),
    priest_awaken: act('めざめのいのり', 230, 'ねむり まひ こんらん ふうじを なおす。', {
      mp: 3, magic: true, target: 'ally', effects: [cure(['sleep', 'paralyze', 'confuse', 'silence'])], fx: 'cure', fieldUse: true,
    }),
    priest_silence: act('しじまのいのり', 250, 'てきの むれの じゅもんを ふうじる。', {
      mp: 3, magic: true, target: 'group', effects: [status('silence', 0.6)], fx: 'silence',
    }),
    priest_barrier: act('ひかりのかべ', 260, 'みかた ぜんいんの まほうぼうぎょを あげる。', {
      mp: 6, magic: true, target: 'allies', effects: [buff('mdef', 1)], fx: 'buff',
    }),
    priest_heal_all: act('いやしのわ', 300, 'みかた ぜんいんの HPを かいふくする。', {
      mp: 7, magic: true, target: 'allies', effects: [heal(14, 0.55)], fx: 'heal', fieldUse: true,
    }),
    priest_revive: act('リバイブ', 300, 'たおれた なかまを いきかえらせる。', {
      mp: 10, magic: true, target: 'ally_dead', effects: [{ type: 'revive', pct: 0.25 }], fx: 'revive', fieldUse: true,
    }),
    priest_mp_regain: reaction('MPかいしゅう', 300, 'ダメージを うけると MPが すこし もどる。', 'hitAny', 0.4, { type: 'mp', power: 6 }),
    priest_mnd_up: support('せいしんアップ', 300, 'せいしんが 20% あがり かいふくが ます。', { mndPct: 20 }),
    priest_pure: support('きよめのこころ', 300, 'どくと くらやみを うけつけなくなる。', { statusImmune: ['poison', 'blind'] }),
    priest_walk_heal: field('いやしのあゆみ', 300, 'あるくたびに HPが すこし かいふくする。', { walkHeal: 1 }),
  });

  // ============================================================ まほうつかい
  add('mage', {
    mage_fire: act('ファイアボール', 30, 'てき ひとりを ひのたまで やく。', {
      mp: 2, magic: true, target: 'enemy', effects: [magic(10, 0.5, 'fire')], fx: 'fire1',
    }),
    mage_scan: act('アナライズ', 80, 'てきの HPと じゃくてんを みやぶる。', {
      mp: 1, magic: true, target: 'enemy', effects: [{ type: 'scan' }], fx: 'scan',
    }),
    mage_ice: act('アイスニードル', 120, 'こおりの はりで てき ひとりを さす。', {
      mp: 3, magic: true, target: 'enemy', effects: [magic(12, 0.55, 'ice')], fx: 'ice1',
    }),
    mage_exit: act('だっしゅつ', 150, 'どうくつや とうから そとへ ぬけだす。', {
      mp: 4, magic: true, target: 'self', effects: [{ type: 'exit' }], fx: 'warp', fieldUse: true,
    }),
    mage_thunder: act('ライトニング', 160, 'いなずまで てき ひとりを うつ。', {
      mp: 3, magic: true, target: 'enemy', effects: [magic(12, 0.55, 'thunder')], fx: 'thunder1',
    }),
    mage_sleep: act('ねむりのきり', 200, 'てきの むれを ねむらせる。', {
      mp: 3, magic: true, target: 'group', effects: [status('sleep', 0.55)], fx: 'sleep',
    }),
    mage_blind: act('くらやみのきり', 220, 'てきの むれの めを くらませる。', {
      mp: 3, magic: true, target: 'group', effects: [status('blind', 0.6)], fx: 'blind',
    }),
    mage_wind: act('かまいたち', 250, 'かぜの やいばで てきの むれを きりさく。', {
      mp: 4, magic: true, target: 'group', effects: [magic(8, 0.38, 'wind')], fx: 'wind1',
    }),
    mage_teleport: act('ワープ', 250, 'いちど おとずれた 町や 村へ ひとっとび。', {
      mp: 6, magic: true, target: 'self', effects: [{ type: 'teleport' }], fx: 'warp', fieldUse: true,
    }),
    mage_missile: act('まりょくのや', 300, 'まりょくの や。 ぞくせいを もたない。', {
      mp: 4, magic: true, target: 'enemy', effects: [magic(18, 0.6)], fx: 'magic',
    }),
    mage_ward: reaction('まほうのたて', 250, 'じゅもんを うけると まほうに つよくなる。', 'hitMagic', 0.6, { type: 'buff', stat: 'mdef', stages: 1 }),
    mage_mp_up: support('MPアップ', 300, 'さいだいMPが 20% あがる。', { mpPct: 20 }),
    mage_int_up: support('かしこさアップ', 300, 'かしこさが 15% あがる。', { intPct: 15 }),
    mage_mp_save: support('MPせつやく', 300, 'しょうひMPが 15% へる。', { mpCostPct: -15 }),
  });

  // ============================================================ とうぞく
  add('thief', {
    thief_steal: act('ぬすむ', 50, 'てきの もちものを ぬすむ。', {
      mp: 0, target: 'enemy', effects: [{ type: 'steal' }], fx: 'steal',
    }),
    thief_sand: act('すなかけ', 120, 'すなを かけて てきの めを くらませる。', {
      mp: 0, target: 'enemy', effects: [status('blind', 0.7)], fx: 'blind',
    }),
    thief_flee: act('ずらかる', 150, 'せんとうから かならず にげだす。', {
      mp: 2, target: 'self', effects: [{ type: 'escape' }], fx: 'smoke',
    }),
    thief_repel: act('けはいけし', 180, 'しばらく まものが よってこなくなる。', {
      mp: 3, target: 'self', effects: [{ type: 'repel', steps: 200 }], fx: 'magic', fieldUse: true,
    }),
    thief_quick: act('はやてぎり', 200, 'めにも とまらぬ はやさで 2かい きる。', {
      mp: 2, target: 'enemy', effects: [phys(0.7, { hits: 2, acc: 1.1 })], fx: 'slash',
    }),
    thief_poison: act('どくのやいば', 220, 'どくを ぬった やいばで きりつける。', {
      mp: 2, target: 'enemy', effects: [phys(0.9), status('poison', 0.6)], fx: 'slash',
    }),
    thief_mug: act('ひったくり', 280, 'こうげきと どうじに もちものを ぬすむ。', {
      mp: 3, target: 'enemy', effects: [phys(0.8), { type: 'steal' }], fx: 'steal',
    }),
    thief_steal_rare: act('おおものねらい', 300, 'めずらしい おたからを ねらって ぬすむ。', {
      mp: 4, target: 'enemy', effects: [{ type: 'steal', rareBonus: 0.25 }], fx: 'steal',
    }),
    thief_nimble: reaction('はやあし', 250, 'こうげきを うけると すばやさが あがる。', 'hitAny', 0.5, { type: 'buff', stat: 'agi', stages: 1 }),
    thief_rare_hunter: support('レアハンター', 300, 'レアアイテムを てにいれやすくなる。', { rarePct: 100 }),
    thief_steal_up: support('ぬすみのコツ', 250, 'ぬすみが せいこうしやすくなる。', { stealPct: 50 }),
    thief_ambush: support('さきがけ', 300, 'せんせいこうげきを しかけやすくなる。', { preemptPct: 20, escapePct: 25 }),
    thief_treasure: field('たからさがし', 300, 'かくされた どうぐが ひかって みえる。', { treasureSense: true }),
  });
})(window.RPG);
