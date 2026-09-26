// Battle test fixtures (NOT shipped): characters, items, techs, spells, enemy actions, monsters, troops, zones,
// a lineage and a pool with 'tb_' ids covering every effect / target / status / mod / flag the battle engine handles.
// Loaded by tools/test_battle.js and tools/check_battle.js (node, via tools/lib/load extra) and by the browser harness
// (node tools/build.js --with tools/fixtures/battle → debug_battle.html). Registers only tb_ ids.
(function (R) {
  'use strict';
  const DB = R.DB;
  const dmg = (power, o) => Object.assign({ type: 'damage', power }, o || {});
  const mdmg = (power, o) => Object.assign({ type: 'damage', formula: 'magic', power }, o || {});
  const st = (status, chance, o) => Object.assign(chance == null ? { type: 'status', status } : { type: 'status', status, chance }, o || {});
  const buff = (stat, stages, chance) => (chance == null ? { type: 'buff', stat, stages } : { type: 'buff', stat, stages, chance });
  const tech = (wtype, name, wp, target, reach, effects, lv, o) => Object.assign({
    kind: 'tech', wtype, name, desc: name + 'のテスト。', wp, target, reach, effects, fx: 'slash', rank: lv, glim: { lv, from: ['attack'] },
  }, o || {});
  const spell = (name, elements, lv, mp, target, effects, o) => Object.assign({
    kind: 'spell', magic: true, name, desc: name + 'のテスト。', elements, mp, target, effects, fx: 'magic', cls: elements.length === 1 ? 'single' : elements.length === 2 ? 'comboA' : 'triple',
    glim: { lv, prof: 0 }, rank: lv, order: 900 + lv,
  }, o || {});
  const en = (name, target, effects, o) => Object.assign({ name, kind: 'enemy', target, effects, fx: 'strike' }, o || {});

  // ------------------------------------------------------------------ characters
  Object.assign(DB.heroTypes, {
    tb_warrior: {
      name: 'テスト戦士', desc: 'テスト', stats: { str: 50, vit: 44, dex: 30, agi: 28, int: 18, mnd: 30 },
      growth: { hp: 'A', mp: 'C', wp: 'A' }, apt: { w: { sword: 'A', spear: 'B' }, e: { fire: 'B' } }, favorKind: 'weapon', row: 'front',
    },
  });
  Object.assign(DB.companions, {
    tb_lancer: {
      name: 'ブリギッタ', gender: 'f', role: 'テスト', row: 'front', stats: { str: 46, vit: 46, dex: 34, agi: 30, int: 16, mnd: 28 },
      growth: { hp: 'A', mp: 'D', wp: 'A' }, apt: { w: { spear: 'A', sword: 'B' }, e: { earth: 'B' } }, innate: { name: 'テスト', desc: 'テスト', mods: {} },
    },
    tb_mage: {
      name: 'マルタ', gender: 'f', role: 'テスト', row: 'middle', stats: { str: 18, vit: 24, dex: 30, agi: 34, int: 52, mnd: 42 },
      growth: { hp: 'C', mp: 'S', wp: 'C' }, apt: { w: { staff: 'A' }, e: { light: 'A', water: 'A', fire: 'B' } }, innate: { name: 'テスト', desc: 'テスト', mods: {} },
    },
    tb_archer: {
      name: 'シルヴァン', gender: 'm', role: 'テスト', row: 'middle', stats: { str: 26, vit: 30, dex: 55, agi: 44, int: 20, mnd: 25 },
      growth: { hp: 'B', mp: 'C', wp: 'B' }, apt: { w: { bow: 'A', dagger: 'B' }, e: { wind: 'B' } }, innate: { name: 'テスト', desc: 'テスト', mods: {} },
    },
  });

  // ------------------------------------------------------------------ items
  const W = (name, wtype, atk, o) => Object.assign({ name, type: 'weapon', wtype, grade: 'normal', tier: 2, src: 'shop', desc: 'テスト', price: 100, atk, mag: Math.round(atk * 0.5), stats: {} }, o || {});
  const A = (name, type, def, mdef, o) => Object.assign({ name, type, grade: 'normal', tier: 2, src: 'shop', desc: 'テスト', price: 100, weight: 'heavy', def, mdef, stats: {} }, o || {});
  const ACC = (name, mods, o) => Object.assign({ name, type: 'acc', grade: 'normal', tier: 0, src: 'shop', desc: 'テスト', price: 100, mods }, o || {});
  const USE = (name, target, effects, o) => Object.assign({ name, type: 'consumable', grade: 'normal', src: 'shop', desc: 'テスト', price: 20, use: { target, effects, fx: 'heal', battle: true, field: false } }, o || {});
  Object.assign(DB.items, {
    tb_sword: W('テストの剣', 'sword', 21),
    tb_flame_sword: W('テスト炎の剣', 'sword', 21, { element: 'fire' }),
    tb_spear: W('テストの槍', 'spear', 26, { twoHanded: true }),
    tb_bow: W('テストの弓', 'bow', 23, { twoHanded: true }),
    tb_staff: W('テストの杖', 'staff', 13, { mag: 21 }),
    tb_dagger: W('テストの短剣', 'dagger', 16),
    tb_venom_dagger: W('テスト毒の短剣', 'dagger', 16, { onHit: { status: 'poison', chance: 1 } }),
    tb_club: W('テストの棍棒', 'club', 22),
    tb_katana: W('テストの刀', 'katana', 22, { drain: 0.2, vs: { undead: 1.5 } }),
    tb_whip: W('テストの鞭', 'whip', 17),
    tb_metal_whip: W('テスト白銀の鞭', 'whip', 17, { metalHit: true, grade: 'super' }),
    tb_seal_axe: W('テスト封じの斧', 'axe', 24, { sealTech: true, grade: 'super' }),
    tb_claw: W('テストの爪', 'fist', 19),
    tb_shield: A('テストの盾', 'shield', 26, 8, { eva: 8 }),
    tb_mail: A('テストの鎧', 'body', 52, 10),
    tb_robe: A('テストのローブ', 'body', 21, 31, { weight: 'cloth', stats: { int: 4 } }),
    tb_helm: A('テストの兜', 'head', 20, 4),
    tb_ring_fire: ACC('テスト火よけ', { elemResist: { fire: 0.5 } }),
    tb_ring_absorb: ACC('テスト水吸い', { elemResist: { water: -1 } }),
    tb_ring_sleep: ACC('テスト眠りよけ', { statusImmune: ['sleep'] }),
    tb_ring_counter: ACC('テスト反撃の輪', { autoCounter: 1 }),
    tb_feather: ACC('テスト再起の羽', { autoRevive: 0.5 }),
    tb_glove: ACC('テスト早業', { autoSteal: 100 }),
    tb_lucky: ACC('テスト幸運', { dropPct: 150, rarePct: 150, superPct: 150, goldPct: 100, goldenPct: 100, rareEncPct: 100, preemptPct: 30, escapePct: 50, stealPct: 50 }),
    tb_regen: ACC('テスト再生', { regen: true, mpRegen: 2, wpRegen: 1 }),
    tb_cursed: ACC('テスト呪い', { hpLoss: 5, takenPct: 25 }, { quirk: true }),
    tb_boost: ACC('テスト強化', { elemBoost: { fire: 50 }, physPct: 50, magicPct: 50, healPct: 50, itemPct: 100 }),
    tb_saver: ACC('テスト節約', { mpCostPct: -50, wpCostPct: -50 }),
    tb_haste: ACC('テスト先手', { startBuffs: { agi: 1, def: 1 } }),
    tb_nospell: ACC('テスト術封じ', { noSpell: true }, { quirk: true }),
    tb_exp: ACC('テスト経験', { expPct: 30 }),
    // consumables
    tb_salve: USE('テスト傷薬', 'ally', [{ type: 'heal', pct: 0.35 }]),
    tb_potion: USE('テスト霊水', 'ally', [{ type: 'heal', pct: 1 }]),
    tb_herbs: USE('テスト香炉', 'allies', [{ type: 'heal', pct: 0.35 }]),
    tb_revive: USE('テスト気つけ', 'ally_dead', [{ type: 'revive', pct: 0.35 }], { use: { target: 'ally_dead', effects: [{ type: 'revive', pct: 0.35 }], fx: 'revive', battle: true, field: true } }),
    tb_ether: USE('テスト魔力', 'ally', [{ type: 'healMp', pct: 0.3 }]),
    tb_tonic: USE('テスト気力', 'ally', [{ type: 'healWp', pct: 0.3 }]),
    tb_waker: USE('テスト目覚まし', 'ally', [{ type: 'cure', statuses: ['sleep', 'confuse', 'stun'] }]),
    tb_panacea: USE('テスト万病', 'ally', [{ type: 'cure', statuses: 'all' }]),
    tb_smoke: USE('テスト煙玉', 'self', [{ type: 'escape' }]),
    tb_lens: USE('テスト見破り', 'enemy', [{ type: 'scan' }]),
    tb_firepot: USE('テスト火炎つぼ', 'group', [{ type: 'damage', formula: 'tier', power: 0.8, element: 'fire' }]),
    tb_bomb: USE('テストはじけ玉', 'enemies', [{ type: 'damage', formula: 'tier', power: 0.7 }]),
    tb_horn: USE('テスト角笛', 'allies', [{ type: 'buff', stat: 'atk', stages: 1 }]),
    tb_stone_fire: USE('テスト火の魔石', 'enemy', [{ type: 'damage', formula: 'tier', power: 1.2, element: 'fire' }], { stone: 'fire', price: 30 }),
    tb_dust: USE('テストりん粉', 'enemies', [{ type: 'status', status: 'blind', chance: 0.6 }]),
    tb_seed: USE('テスト活力の実', 'ally', [{ type: 'grow', stat: 'hp', n: 10 }], { use: { target: 'ally', effects: [{ type: 'grow', stat: 'hp', n: 10 }], fx: 'heal', battle: true, field: true } }),
    tb_repel: USE('テスト魔除け', 'self', [{ type: 'encounter', pct: -100, steps: 100, weakOnly: true }], { use: { target: 'self', effects: [{ type: 'encounter', pct: -100, steps: 100, weakOnly: true }], fx: 'buff', battle: false, field: true } }),
    tb_rare_potion: USE('テスト命の露', 'ally', [{ type: 'heal', pct: 1 }], { grade: 'rare', src: 'drop' }),
    // drops
    tb_rare_charm: ACC('テストのお守り', { dropPct: 10 }, { grade: 'rare', src: 'mdrop', tier: 1 }),
    tb_sr_blade: W('テスト一品の剣', 'sword', 30, { grade: 'super', src: 'super', exclusive: 'tb_goblin' }),
    tb_pool_a: USE('テスト報酬A', 'ally', [{ type: 'heal', pct: 0.5 }]),
    tb_pool_b: USE('テスト報酬B', 'ally', [{ type: 'heal', pct: 0.5 }]),
  });

  // ------------------------------------------------------------------ techs (t_ shape, tb_ ids)
  Object.assign(DB.actions, {
    tb_t_cut: tech('sword', 'テスト斬り', 1, 'enemy', false, [dmg(1.5)], 1),
    tb_t_guard: tech('sword', 'テスト受け', 2, 'self', false, [st('counter', null, { power: 0.8, parry: 0.35 })], 1, { quick: true, fx: 'stance' }),
    tb_t_twin: tech('sword', 'テスト二連', 2, 'enemy', false, [dmg(0.9, { hits: 2 })], 2, { glim: { lv: 2, from: ['tb_t_cut'] } }),
    tb_t_wheel: tech('sword', 'テスト風車', 4, 'group', false, [dmg(1.35)], 4),
    tb_t_wall: tech('sword', 'テスト城壁', 3, 'self', false, [{ type: 'cover', mul: 0.6 }], 5, { quick: true, fx: 'stance' }),
    tb_t_holy: tech('sword', 'テスト清め', 5, 'enemy', false, [dmg(2.3, { element: 'light' })], 6),
    tb_t_wind: tech('sword', 'テスト刃風', 7, 'enemies', true, [dmg(1.2)], 7),
    tb_t_seal: tech('sword', 'テスト封じ斬り', 3, 'enemy', false, [dmg(1.2), st('silence', 1)], 3),
    tb_t_sunder: tech('sword', 'テスト鎧崩し', 3, 'enemy', false, [dmg(1.1), buff('def', -1)], 3),
    tb_t_secret: tech('sword', 'テスト極意', 13, 'enemy', false, [dmg(3.2)], 10),
    tb_t_up: tech('spear', 'テスト突き上げ', 1, 'enemy', true, [dmg(1.45, { vs: { flying: 1.5 } })], 1, { fx: 'pierce' }),
    tb_t_pierce: tech('spear', 'テスト貫き', 3, 'enemy', true, [dmg(1.6, { ignoreDef: 0.5 })], 3),
    tb_t_rapid: tech('bow', 'テスト速射', 1, 'enemy', true, [dmg(1.35)], 1, { quick: true, fx: 'arrow' }),
    tb_t_rain: tech('bow', 'テスト矢の雨', 4, 'random', true, [dmg(0.5, { hits: 4 })], 4, { fx: 'arrow2' }),
    tb_t_blind: tech('bow', 'テスト目つぶし', 2, 'enemy', true, [dmg(1.1), st('blind', 1)], 2),
    tb_t_vital: tech('dagger', 'テスト急所', 1, 'enemy', false, [dmg(1.25, { critBonus: 100 })], 1),
    tb_t_filch: tech('dagger', 'テストかすめ', 1, 'enemy', false, [dmg(0.8), { type: 'steal' }], 1, { noAuto: true }),
    tb_t_nape: tech('dagger', 'テスト寝首', 4, 'enemy', false, [dmg(1.2, { vs: { sleep: 2, paralyze: 2 } })], 4),
    tb_t_flurry: tech('dagger', 'テスト三連', 3, 'enemy', false, [dmg(0.6, { hits: 3 })], 3),
    tb_t_mind: tech('staff', 'テスト念じ', 1, 'enemy', true, [mdmg(1.2)], 1, { magic: true }),
    tb_t_soothe: tech('staff', 'テストいたわり', 1, 'ally', true, [{ type: 'heal', pct: 0.3 }], 1, { magic: true, fx: 'heal' }),
    tb_t_share: tech('staff', 'テスト魔力分け', 2, 'ally', true, [{ type: 'healMp', pct: 0.2 }], 4, { magic: true, noAuto: true, fx: 'mp' }),
    tb_t_unward: tech('staff', 'テスト守りほどき', 2, 'enemy', true, [{ type: 'dispel', side: 'good' }], 3, { magic: true, fx: 'dispel' }),
    tb_t_smash: tech('club', 'テスト強打', 1, 'enemy', false, [dmg(1.3), st('stun', 1)], 1, { fx: 'strike' }),
    tb_t_draw: tech('katana', 'テスト抜き打ち', 1, 'enemy', false, [dmg(1.2, { critBonus: 10 })], 1, { quick: true }),
    tb_t_trip: tech('whip', 'テスト足からめ', 1, 'enemy', true, [dmg(1.25), buff('agi', -1, 1)], 1, { fx: 'lash' }),
    tb_t_metal: tech('whip', 'テスト鋼打ち', 2, 'enemy', true, [dmg(1.0, { metalHit: true })], 2, { fx: 'lash' }),
    tb_t_reckless: tech('axe', 'テスト捨て身', 2, 'enemy', false, [dmg(2.5, { hpCost: 0.1, ignoreDef: 1 })], 3),
    tb_t_palm: tech('fist', 'テスト掌打', 1, 'enemy', false, [dmg(1.5)], 1, { fx: 'strike' }),
    tb_t_sure: tech('fist', 'テスト必中', 1, 'enemy', false, [dmg(1.0, { sure: true })], 2, { fx: 'strike' }),
    tb_t_drainfist: tech('fist', 'テスト吸い拳', 2, 'enemy', false, [dmg(1.0, { drain: 0.5 })], 3, { fx: 'strike' }),
  });

  // ------------------------------------------------------------------ spells
  Object.assign(DB.actions, {
    tb_s_fire: spell('テスト火の矢', ['fire'], 1, 2, 'enemy', [mdmg(1.4)], { fx: 'fire1' }),
    tb_s_fireall: spell('テスト火の粉', ['fire'], 2, 5, 'enemies', [mdmg(1.0), st('burn', 0.2)], { fx: 'fire2' }),
    tb_s_heal: spell('テストひだまり', ['light'], 1, 3, 'ally', [{ type: 'heal', pct: 0.35 }], { fx: 'heal' }),
    tb_s_healall: spell('テストあまねく', ['light'], 3, 7, 'allies', [{ type: 'heal', pct: 0.3 }], { fx: 'heal' }),
    tb_s_revive: spell('テストよみがえり', ['light'], 5, 7, 'ally_dead', [{ type: 'revive', pct: 0.3 }], { fx: 'revive' }),
    tb_s_bless: spell('テスト祝福', ['light'], 7, 12, 'allies', [{ type: 'heal', pct: 0.6 }, st('veil')], { fx: 'heal' }),
    tb_s_water: spell('テスト水の刃', ['water'], 1, 2, 'enemy', [mdmg(1.2)], { fx: 'water' }),
    tb_s_regen: spell('テスト恵み', ['water'], 3, 6, 'allies', [st('regen')], { fx: 'regen' }),
    tb_s_gust: spell('テスト疾風', ['wind'], 3, 5, 'random', [mdmg(0.55, { hits: 4 })], { fx: 'wind' }),
    tb_s_quick: spell('テスト早風', ['wind'], 2, 4, 'enemy', [mdmg(1.0)], { quick: true, fx: 'wind' }),
    tb_s_nimble: spell('テスト身軽', ['wind'], 2, 3, 'self', [st('nimble')], { fx: 'buff' }),
    tb_s_dark: spell('テスト影ばり', ['dark'], 1, 2, 'enemy', [mdmg(1.2, { drain: 0.3 })], { fx: 'dark1' }),
    tb_s_sleep: spell('テストまどろみ', ['dark'], 2, 4, 'enemies', [st('sleep', 0.35)], { fx: 'sleep' }),
    tb_s_doom: spell('テスト黄泉', ['dark'], 5, 9, 'enemy', [st('death', 1), mdmg(1.0)], { fx: 'death' }),
    tb_s_rock: spell('テスト岩の構え', ['earth'], 2, 3, 'self', [st('counter')], { fx: 'buff' }),
    tb_s_para: spell('テスト石化', ['earth'], 3, 5, 'enemy', [st('paralyze', 1)], { fx: 'paralyze' }),
    tb_s_mute: spell('テスト静寂', ['wind'], 2, 3, 'enemy', [st('silence', 1)], { fx: 'silence' }),
    tb_s_confuse: spell('テスト惑い', ['dark'], 3, 4, 'enemy', [st('confuse', 1)], { fx: 'confuse' }),
    tb_s_weaken: spell('テスト弱らせ', ['dark'], 2, 3, 'enemy', [buff('atk', -1, 0.8)], { fx: 'debuff' }),
    tb_s_break: spell('テスト崩し', ['earth'], 2, 3, 'enemy', [buff('def', -2)], { fx: 'debuff' }),
    tb_s_rally: spell('テスト闘志', ['fire'], 3, 6, 'allies', [buff('atk', 1)], { fx: 'buff' }),
    tb_s_purge: spell('テスト浄化', ['light'], 3, 4, 'allies', [{ type: 'dispel', side: 'bad' }, { type: 'cure', statuses: 'all' }], { fx: 'cure' }),
    tb_s_steam: spell('テスト湯煙', ['fire', 'water'], 4, 8, 'enemies', [mdmg(1.45), Object.assign(buff('atk', 1), { on: 'allies' })], { fx: ['fire2', 'water'] }),
    tb_s_blizzard: spell('テスト吹雪', ['water', 'wind'], 4, 8, 'enemies', [mdmg(1.45), st('freeze', 0.4)], { fx: 'ice2' }),
    tb_s_tri: spell('テスト三属', ['fire', 'water', 'dark'], 8, 18, 'enemy', [mdmg(4.2)], { fx: 'magic3' }),
    tb_s_gravity: spell('テスト重力', ['earth'], 4, 6, 'enemy', [{ type: 'damage', formula: 'percent', power: 0.25 }], { fx: 'gravity' }),
    tb_s_pierce: spell('テスト術防破り', ['dark'], 5, 8, 'enemy', [mdmg(2.0, { ignoreMdef: 1 })], { fx: 'dark3' }),
    tb_s_wprest: spell('テスト気力回復', ['water'], 2, 3, 'allies', [{ type: 'healWp', pct: 0.3 }], { fx: 'mp' }),
    tb_s_party: spell('テスト全員', ['light'], 6, 10, 'party', [{ type: 'revive', pct: 0.25 }, { type: 'heal', pct: 0.2 }], { fx: 'revive' }),
    tb_s_melt: spell('テスト溶かし', ['fire'], 2, 3, 'enemy', [mdmg(0.2)], { fx: 'fire1' }),
    tb_s_raise: spell('テスト呼び戻し', ['light'], 6, 9, 'ally_dead', [{ type: 'revive', pct: 0.5 }], { fx: 'revive' }),
  });

  // ------------------------------------------------------------------ enemy actions
  Object.assign(DB.actions, {
    tb_e_bite: en('テストかみつき', 'enemy', [{ type: 'damage', formula: 'phys', power: 1.3 }], { fx: 'bite', msg: '{user}は鋭い牙でかみついた！' }),
    tb_e_double: en('テスト二段', 'enemy', [{ type: 'damage', formula: 'phys', power: 0.8, hits: 2 }], { msg: '{user}はすばやく2回攻撃した！' }),
    tb_e_sweep: en('テスト横払い', 'enemies', [{ type: 'damage', formula: 'phys', power: 0.65 }], { msg: '{user}は大きくなぎ払った！' }),
    tb_e_breath: en('テスト炎の息', 'enemies', [{ type: 'damage', formula: 'breath', power: 0.6, element: 'fire' }], { fx: 'breath_fire', msg: '{user}は炎を吐いた！' }),
    tb_e_bolt: en('テスト闇の玉', 'enemy', [{ type: 'damage', formula: 'magic', power: 1.3, element: 'dark' }], { fx: 'dark', msg: '{user}は闇の玉を放った！' }),
    tb_e_arrow: en('テスト矢', 'enemy', [{ type: 'damage', formula: 'phys', power: 1.3, kind: 'pierce' }], { aim: 'middle', msg: '{user}は矢を放った！' }),
    tb_e_low: en('テストとどめ', 'enemy', [{ type: 'damage', formula: 'phys', power: 1.3 }], { aim: 'low', msg: '{user}は弱った者をねらった！' }),
    tb_e_prism: en('テスト七色', 'enemy', [{ type: 'damage', formula: 'magic', power: 1.4 }], { elements: ['fire', 'water', 'wind', 'earth', 'light', 'dark'], msg: '{user}は七色の光を放った！' }),
    tb_e_suck: en('テスト魔力吸い', 'enemy', [{ type: 'damage', formula: 'magic', power: 0.8, mp: true, drain: 1 }], { msg: '{user}は魔力を吸い取ろうとした！' }),
    tb_e_poison: en('テスト毒霧', 'enemy', [st('poison', 1)], { msg: '{user}は毒の霧を吹いた！' }),
    tb_e_sleep: en('テスト眠り歌', 'enemies', [st('sleep', 0.3)], { msg: '{user}は眠りの歌を歌った！' }),
    tb_e_weak: en('テスト弱らせ', 'enemy', [buff('atk', -1, 1)], { msg: '{user}はにらみつけた！' }),
    tb_e_heal_ally: en('テスト癒やし', 'ally', [{ type: 'heal', pct: 0.3 }], { fx: 'heal', msg: '{user}は癒やしの粉を振りかけた！' }),
    tb_e_heal_self: en('テスト傷なめ', 'self', [{ type: 'heal', pct: 0.25 }], { fx: 'heal', msg: '{user}は傷をなめている。' }),
    tb_e_harden: en('テスト身固め', 'self', [buff('def', 2)], { fx: 'buff', msg: '{user}は身を固めた！' }),
    tb_e_howl: en('テスト遠吠え', 'allies', [buff('atk', 1)], { fx: 'buff', msg: '{user}は仲間を奮い立たせた！' }),
    tb_e_revive: en('テスト死者起こし', 'ally_dead', [{ type: 'revive', pct: 0.5 }], { fx: 'revive', msg: '{user}は倒れた仲間を呼び起こした！' }),
    tb_e_call: en('テスト仲間呼び', 'self', [{ type: 'summon', mon: 'same', n: 1, max: 4 }], { fx: 'song', msg: '{user}は仲間を呼んだ！' }),
    tb_e_call_lower: en('テスト手下呼び', 'self', [{ type: 'summon', mon: 'lower', n: 1, max: 6 }], { fx: 'song', msg: '{user}は手下を呼んだ！' }),
    tb_e_steal: en('テスト盗み', 'enemy', [{ type: 'steal' }], { msg: '{user}はお金をねらった！' }),
    tb_e_rewind: en('テスト巻き戻し', 'enemies', [{ type: 'dispel', side: 'good' }, { type: 'heal', pct: 0.1, on: 'self' }], { fx: 'warp', msg: '時が巻き戻っていく……！' }),
    tb_e_flee: en('テスト逃走', 'self', [{ type: 'escape' }], { msg: '{user}は逃げようとした！' }),
  });

  // ------------------------------------------------------------------ monsters (explicit numbers where tests need them exact)
  const M = (name, lv, o) => Object.assign({ name, sprite: 'tb_mon', lv, size: 'm', race: 'humanoid', flags: [], actions: [{ id: 'attack', w: 1 }], drops: {}, desc: 'テスト' }, o || {});
  Object.assign(DB.monsters, {
    tb_dummy: M('テスト人形', 10, { hp: 9999, atk: 1, mag: 1, def: 0, mdef: 0, agi: 1, eva: 0, exp: 10, gold: 5, actions: [{ id: 'wait', w: 1 }] }),
    tb_goblin: M('テスト小鬼', 10, {
      hp: 60, atk: 20, mag: 15, def: 45, mdef: 45, agi: 30, eva: 5, exp: 30, gold: 20,
      elem: { fire: 1.5, water: 0 }, phys: { slash: 1.25 },
      drops: { normal: { item: 'tb_salve', rate: 8 }, rare: { item: 'tb_rare_charm', rate: 32 }, super: { item: 'tb_sr_blade', rate: 256 } },
    }),
    tb_slime: M('テストゼリー', 10, { hp: 40, atk: 12, mag: 8, def: 45, mdef: 45, agi: 20, eva: 5, exp: 12, gold: 8, size: 's', race: 'slime', phys: { blunt: 0.5, slash: 1.25 }, elem: { fire: 1.25, wind: -1 },
      drops: { normal: { item: 'tb_salve', rate: 4 }, rare: { item: 'tb_rare_charm', rate: 16 } } }),
    tb_bat: M('テストコウモリ', 10, { hp: 30, atk: 14, mag: 8, def: 40, mdef: 40, agi: 45, eva: 12, exp: 10, gold: 6, size: 's', race: 'beast', flags: ['flying'], elem: { wind: 1.5, earth: 0.5 }, phys: { pierce: 1.25 } }),
    tb_bone: M('テスト骸骨', 10, { hp: 70, atk: 22, mag: 10, def: 50, mdef: 45, agi: 25, eva: 5, exp: 30, gold: 20, race: 'undead', elem: { light: 2, fire: 1.5, dark: -1 }, phys: { blunt: 1.25 },
      statusRes: { poison: 1, death: 1, sleep: 1, confuse: 0.5 } }),
    tb_metal: M('テスト白銀', 19, { size: 's', race: 'slime', flags: ['metal'], hpFixed: 8, s: { agi: 2.5 }, actions: [{ id: 'attack', w: 1 }],
      drops: { normal: { item: 'tb_salve', rate: 4 }, rare: { item: 'tb_rare_charm', rate: 16 }, super: { item: 'tb_sr_blade', rate: 128 } } }),
    tb_rare: M('テスト宝石ウサギ', 10, { race: 'beast', flags: ['rare'], s: { hp: 3, agi: 1.8 }, appear: '{user}は額の宝石をきらりと光らせた！',
      drops: { normal: { item: 'tb_potion', rate: 2 }, rare: { item: 'tb_rare_charm', rate: 6 }, super: { item: 'tb_sr_blade', rate: 24 } } }),
    tb_boss: M('テスト魔王', 9, {
      sprite: 'tb_boss', race: 'demon', flags: ['boss'], bossType: 'region', hpShare: 12, elem: { light: 1.5, fire: 1.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'tb_e_sweep', w: 2 }, { id: 'tb_e_harden', w: 1, cond: { once: true } }, { id: 'tb_e_call', w: 0 }],
      phases: [{ hpBelow: 0.5, msg: 'テスト魔王の体が燃え上がった！', set: { actsPerTurn: 3, elem: { fire: 0.25 }, buffs: { atk: 1 }, sprite: 'tb_boss2' } }],
      drops: { normal: { pool: 'tb_pool', rate: 1 }, bonus: { item: 'tb_seed', rate: 1 } },
    }),
    tb_minion: M('テスト手下', 9, { sprite: 'tb_mon', race: 'demon', flags: ['boss'], bossType: 'add', hpShare: 2, actions: [{ id: 'tb_e_heal_ally', w: 1 }, { id: 'attack', w: 1 }] }),
    tb_caster: M('テスト魔術師', 10, { hp: 50, atk: 10, mag: 30, def: 40, mdef: 55, agi: 30, eva: 5, exp: 25, gold: 15, actions: [{ id: 'tb_e_bolt', w: 1 }] }),
    tb_thief: M('テスト盗賊', 10, { hp: 50, atk: 15, mag: 10, def: 40, mdef: 40, agi: 40, eva: 5, exp: 20, gold: 30, actions: [{ id: 'tb_e_steal', w: 1 }] }),
    tb_splitter: M('テスト分裂', 10, { hp: 40, atk: 10, mag: 10, def: 40, mdef: 40, agi: 20, eva: 5, exp: 10, gold: 5, actions: [{ id: 'tb_e_call', w: 1, cond: { countBelow: 4 } }, { id: 'attack', w: 1 }] }),
    tb_fire_elem: M('テスト火の精', 10, { hp: 50, atk: 18, mag: 20, def: 40, mdef: 40, agi: 30, eva: 5, exp: 20, gold: 10, elem: { fire: -1, water: 1.5 } }),
    tb_mimic: M('テスト宝箱', 10, { hp: 60, atk: 20, mag: 10, def: 45, mdef: 45, agi: 30, eva: 5, exp: 30, gold: 60, drops: { normal: { pool: 'tb_pool', rate: 8 }, rare: { item: 'tb_rare_charm', rate: 16 } } }),
    tb_rat_1: M('テストネズミ', 7, { race: 'beast', size: 's', lineage: 'tb_rat', stage: 1, s: { hp: 0.9, agi: 1.2 }, actions: [{ id: 'attack', w: 5 }, { id: 'tb_e_bite', w: 2 }],
      drops: { normal: { item: 'tb_salve', rate: 8 } } }),
    tb_rat_2: M('テスト毒ネズミ', 19, { race: 'beast', size: 's', lineage: 'tb_rat', stage: 2, actions: [{ id: 'attack', w: 4 }, { id: 'tb_e_call_lower', w: 1 }] }),
    tb_rat_3: M('テスト鉄ネズミ', 31, { race: 'beast', size: 's', lineage: 'tb_rat', stage: 3, s: { def: 1.25 } }),
    tb_viper: M('テスト毒蛇', 10, { hp: 50, atk: 16, mag: 8, def: 40, mdef: 40, agi: 30, eva: 5, exp: 15, gold: 8, race: 'beast', onHit: { status: 'poison', chance: 1 } }),
    tb_healer: M('テスト看護', 10, { hp: 50, atk: 10, mag: 10, def: 40, mdef: 40, agi: 30, eva: 5, exp: 10, gold: 5, actions: [{ id: 'tb_e_heal_ally', w: 5 }, { id: 'tb_e_revive', w: 5, cond: { allyDown: true } }, { id: 'attack', w: 1 }] }),
  });
  Object.assign(DB.lineages, {
    tb_rat: { name: 'テストネズミ', stages: [{ mon: 'tb_rat_1', tier: 0 }, { mon: 'tb_rat_2', tier: 2 }, { mon: 'tb_rat_3', tier: 4 }] },
  });
  Object.assign(DB.pools, {
    tb_pool: { tiers: [[{ item: 'tb_pool_a', w: 1 }], [{ item: 'tb_pool_b', w: 1 }], [{ gold: 500, w: 1 }]] },
  });
  Object.assign(DB.troops, {
    tb_troop_boss: { mons: [['tb_minion', 1], ['tb_boss', 1], ['tb_minion', 1]], scale: 'tier', lvOff: 3, bg: 'castle', bgm: 'boss', noEscape: true },
    tb_troop_fixed: { mons: [['tb_goblin', 2]], tier: 2, lvOff: 1 },
    tb_troop_tut: { mons: [['tb_rat_1', 2]], tier: 0, lv: 2, bg: 'tower', noEscape: true },
  });
  Object.assign(DB.encounters, {
    tb_zone: { region: 'tb', tier: 'dyn', lvOff: 1, bg: 'grass', groups: [
      { w: 10, mons: [['@tb_rat', 2, 3]] },
      { w: 5, mons: [['tb_goblin', 1, 2], ['@tb_rat', 1, 1]], tierMin: 1 },
      { w: 5, mons: [['tb_slime', 3, 3]], tierMax: 0 },
    ] },
    tb_zone_pro: { region: 'tb', tier: 0, lv: [2, 4], bg: null, groups: [{ w: 1, mons: [['tb_rat_1', 1, 2]] }] },
    tb_zone_metal: { region: 'tb', tier: 'dyn', lvOff: 0, groups: [{ w: 1, mons: [['tb_metal', 1, 2]] }] },
  });
  Object.assign(DB.rareEncounters, { tb_zone: { mon: 'tb_rare', rate: 80 } });

  // ------------------------------------------------------------------ helpers
  const EMPTY = () => ({ weapon1: null, weapon2: null, shield: null, head: null, body: null, hands: null, feet: null, acc1: null, acc2: null });
  /** a CharState (§3.2.2) for id ('hero' = tb_warrior), level, equipment, row, learned techs / spells */
  R.fxBattleChar = function (id, level, equip, row, learned) {
    const hero = id === 'hero';
    const src = hero ? DB.heroTypes.tb_warrior : DB.companions[id];
    const c = {
      id, name: hero ? 'アルン' : src.name, gender: hero ? 'm' : src.gender, level: level || 10, exp: 0,
      hp: 1, mp: 0, wp: 0, bonus: { hp: 0, mp: 0, wp: 0 }, status: {}, equip: Object.assign(EMPTY(), equip || {}),
      wprof: {}, eprof: {}, techs: [], spells: [], row: row || src.row || 'front',
      mem: { cmd: 0, list: {}, item: 0, target: null }, joined: { tier: 0, frame: 0 }, counts: { battles: 0, kills: 0, glimmers: 0 },
    };
    if (hero) { c.heroType = 'tb_warrior'; c.favor = { kind: 'weapon', id: 'sword' }; }
    if (R.Rules && R.Rules.expForLevel) c.exp = R.Rules.expForLevel(c.level);
    for (const a of learned || []) { const k = DB.actions[a] && DB.actions[a].kind === 'spell' ? 'spells' : 'techs'; c[k].push(a); }
    const st = R.Rules.stats(c);
    c.hp = st.hp; c.mp = st.mp; c.wp = st.wp;
    return c;
  };
  /** the standard 4: hero (sword + shield, front), lancer (spear, front), mage (staff, middle), archer (bow, middle) */
  R.fxBattleParty = function (level) {
    const L = level || 10;
    return [
      R.fxBattleChar('hero', L, { weapon1: 'tb_sword', shield: 'tb_shield', body: 'tb_mail', head: 'tb_helm' }, 'front', ['tb_t_cut', 'tb_t_guard']),
      R.fxBattleChar('tb_lancer', L, { weapon1: 'tb_spear', body: 'tb_mail' }, 'front', ['tb_t_up']),
      R.fxBattleChar('tb_mage', L, { weapon1: 'tb_staff', body: 'tb_robe' }, 'middle', ['tb_t_mind', 'tb_s_fire', 'tb_s_heal', 'tb_s_healall', 'tb_s_revive']),
      R.fxBattleChar('tb_archer', L, { weapon1: 'tb_bow', body: 'tb_robe' }, 'middle', ['tb_t_rapid']),
    ];
  };
})(window.RPG);
