// Battle test fixtures (NOT shipped): jobs, abilities, monsters, items and troops
// with 'tb_' ids covering every effect / target / reaction / mod the battle engine supports.
// Loaded by tools/test_battle.js (node) and by the browser harness (make_harness.js).
(function (R) {
  'use strict';
  const DB = R.DB;
  const dmg = (formula, power, o) => Object.assign({ type: 'damage', formula, power }, o || {});
  const act = (name, job, target, effects, o) => Object.assign({ name, job, kind: 'action', jp: 50, desc: name + 'のテスト。', target, effects }, o || {});
  const react = (name, trigger, r, chance) => ({ name, job: 'tb_fighter', kind: 'reaction', jp: 100, desc: 'テスト', trigger, chance: chance == null ? 1 : chance, react: r });

  Object.assign(DB.abilities, {
    // ---- fighter (physical)
    tb_power:   act('パワースラッシュ', 'tb_fighter', 'enemy', [dmg('phys', 1.5)], { mp: 2, fx: 'slash' }),
    tb_double:  act('二段斬り', 'tb_fighter', 'enemy', [dmg('phys', 0.8, { hits: 2 })], { mp: 3, fx: 'slash' }),
    tb_drain:   act('吸血斬り', 'tb_fighter', 'enemy', [dmg('phys', 1, { drain: 0.5 })], { mp: 3, fx: 'drain' }),
    tb_sacrifice: act('捨て身', 'tb_fighter', 'enemy', [dmg('phys', 2.5, { hpCost: 0.1, ignoreDef: true })], { fx: 'slash' }),
    tb_holyblade: act('聖なる刃', 'tb_fighter', 'enemy', [dmg('phys', 1, { element: 'holy', vs: { undead: 2 } })], { mp: 2, fx: 'holy' }),
    tb_steal:   act('盗む', 'tb_fighter', 'enemy', [{ type: 'steal' }], { fx: 'steal' }),
    tb_mug:     act('強奪', 'tb_fighter', 'enemy', [{ type: 'steal', rareBonus: 1 }], { fx: 'steal' }),
    tb_scan:    act('調べる', 'tb_fighter', 'enemy', [{ type: 'scan' }], { fx: 'scan' }),
    tb_flurry:  act('乱れ撃ち', 'tb_fighter', 'random', [dmg('phys', 0.7, { hits: 4 })], { mp: 4, fx: 'pierce' }),
    tb_cheer:   act('ときの声', 'tb_fighter', 'allies', [{ type: 'buff', stat: 'atk', stages: 1 }], { mp: 3, fx: 'buff' }),
    tb_seed:    act('秘密の種', 'tb_fighter', 'ally', [{ type: 'grow', stat: 'str', n: 2 }], { fx: 'grow' }),
    tb_smoke:   act('煙幕', 'tb_fighter', 'self', [{ type: 'escape' }], { fx: 'smoke' }),
    tb_osmose:  act('マナドレイン', 'tb_fighter', 'enemy', [dmg('magic', 6, { mp: true, drain: 1, scale: 0.2 })], { mp: 0, magic: true, fx: 'drain' }),
    tb_special: act('必殺', 'tb_fighter', 'enemy', [{ type: 'special', id: 'tb_special' }], { fx: 'strike' }),
    tb_warpout: act('テレポート', 'tb_fighter', 'self', [{ type: 'teleport' }], { fieldUse: true, fx: 'warp' }),
    // reactions / supports
    tb_counter: react('カウンター', 'hitPhys', { type: 'counter' }),
    tb_autoheal: react('オートヒール', 'lowHp', { type: 'heal', pct: 0.3 }),
    tb_autoitem: react('オートポーション', 'hitAny', { type: 'autoItem' }),
    tb_rage:    react('怒り', 'hitAny', { type: 'buff', stat: 'atk', stages: 1 }),
    tb_cover:   react('かばう', 'allyLowHp', { type: 'cover' }),
    tb_guardian: react('ガーディアン', 'allyLowHp', { type: 'heal', pct: 0.25 }),
    tb_phoenix: react('不死鳥', 'ko', { type: 'revive', pct: 0.5 }),
    tb_manashield: react('マナリカバー', 'hitMagic', { type: 'mp', power: 7 }),
    tb_twoswords: { name: '二刀流', job: 'tb_fighter', kind: 'support', jp: 300, desc: 'テスト', mods: { twoSwords: true } },
    tb_regen:   { name: '再生', job: 'tb_fighter', kind: 'support', jp: 300, desc: 'テスト', mods: { regen: true } },
    tb_haste:   { name: '先制', job: 'tb_fighter', kind: 'support', jp: 300, desc: 'テスト', mods: { startBuffs: { agi: 1, def: 1 } } },
    tb_saver:   { name: 'MP節約', job: 'tb_caster', kind: 'support', jp: 300, desc: 'テスト', mods: { mpCostPct: -50 } },
    tb_booster: { name: '魔法強化', job: 'tb_caster', kind: 'support', jp: 300, desc: 'テスト', mods: { magicPct: 50, healPct: 50 } },
    tb_chemist: { name: '薬の知識', job: 'tb_caster', kind: 'support', jp: 300, desc: 'テスト', mods: { itemPct: 100 } },
    tb_brawn:   { name: '馬鹿力', job: 'tb_fighter', kind: 'support', jp: 300, desc: 'テスト', mods: { physPct: 50 } },
    tb_lucky:   { name: 'ラッキー', job: 'tb_fighter', kind: 'support', jp: 300, desc: 'テスト', mods: { expPct: 100, jpPct: 50, goldPct: 100, dropPct: 100, rarePct: 100, stealPct: 100 } },

    // ---- caster (magic)
    tb_fire:    act('ファイアボール', 'tb_caster', 'enemy', [dmg('magic', 12, { element: 'fire' })], { mp: 3, magic: true, fx: 'fire' }),
    tb_blizzard: act('ブリザード', 'tb_caster', 'group', [dmg('magic', 10, { element: 'ice' })], { mp: 5, magic: true, fx: 'ice' }),
    tb_thunder: act('サンダーボルト', 'tb_caster', 'enemies', [dmg('magic', 20, { element: 'thunder' })], { mp: 8, magic: true, fx: 'thunder2' }),
    tb_tornado: act('トルネード', 'tb_caster', 'enemies', [dmg('magic', 26, { element: 'wind' })], { mp: 9, magic: true, fx: 'wind' }),
    tb_quake:   act('アースクエイク', 'tb_caster', 'enemies', [dmg('magic', 26, { element: 'earth' })], { mp: 9, magic: true, fx: 'earth' }),
    tb_flood:   act('アクアウェーブ', 'tb_caster', 'group', [dmg('magic', 18, { element: 'water' })], { mp: 6, magic: true, fx: 'water' }),
    tb_holy:    act('ホーリーレイ', 'tb_caster', 'enemy', [dmg('magic', 40, { element: 'holy' })], { mp: 12, magic: true, fx: 'holy' }),
    tb_dark:    act('ダークネス', 'tb_caster', 'enemies', [dmg('magic', 30, { element: 'dark' })], { mp: 12, magic: true, fx: 'dark' }),
    tb_meteor:  act('メテオレイン', 'tb_caster', 'random', [dmg('magic', 20, { hits: [3, 5] })], { mp: 15, magic: true, fx: 'explosion' }),
    tb_heal:    act('ヒール', 'tb_caster', 'ally', [{ type: 'heal', power: 30, scale: 0.5 }], { mp: 3, magic: true, fx: 'heal', fieldUse: true }),
    tb_healall: act('ヒールオール', 'tb_caster', 'allies', [{ type: 'heal', power: 25, scale: 0.4 }], { mp: 8, magic: true, fx: 'heal' }),
    tb_revive:  act('リヴァイブ', 'tb_caster', 'ally_dead', [{ type: 'revive', pct: 0.5 }], { mp: 10, magic: true, fx: 'revive' }),
    tb_cure:    act('キュア', 'tb_caster', 'ally', [{ type: 'cure', statuses: 'all' }], { mp: 3, magic: true, fx: 'cure' }),
    tb_ether:   act('マナギフト', 'tb_caster', 'ally_any', [{ type: 'healMp', power: 10 }], { mp: 0, fx: 'mp' }),
    tb_sleep:   act('スリープ', 'tb_caster', 'group', [{ type: 'status', status: 'sleep', chance: 0.8 }], { mp: 3, magic: true, fx: 'sleep' }),
    tb_mute:    act('サイレンス', 'tb_caster', 'enemy', [{ type: 'status', status: 'silence', chance: 1 }], { mp: 3, magic: true, fx: 'silence' }),
    tb_poison:  act('ポイズン', 'tb_caster', 'enemy', [{ type: 'status', status: 'poison', chance: 1 }], { mp: 2, magic: true, fx: 'poison' }),
    tb_confuse: act('コンフューズ', 'tb_caster', 'enemy', [{ type: 'status', status: 'confuse', chance: 1 }], { mp: 3, magic: true, fx: 'confuse' }),
    tb_blind:   act('ブラインド', 'tb_caster', 'enemy', [{ type: 'status', status: 'blind', chance: 1 }], { mp: 2, magic: true, fx: 'blind' }),
    tb_stun:    act('パラライズ', 'tb_caster', 'enemy', [{ type: 'status', status: 'paralyze', chance: 1 }], { mp: 3, magic: true, fx: 'paralyze' }),
    tb_protect: act('プロテクト', 'tb_caster', 'allies', [{ type: 'buff', stat: 'def', stages: 1 }], { mp: 4, magic: true, fx: 'buff' }),
    tb_weaken:  act('ウィーク', 'tb_caster', 'enemy', [{ type: 'buff', stat: 'atk', stages: -1 }], { mp: 3, magic: true, fx: 'debuff' }),
    tb_dispel:  act('解呪', 'tb_caster', 'enemy', [{ type: 'dispel' }], { mp: 4, magic: true, fx: 'dispel' }),
    tb_regenspell: act('再生の光', 'tb_caster', 'ally', [{ type: 'regen' }], { mp: 5, magic: true, fx: 'regen' }),
    tb_gravity: act('グラビティ', 'tb_caster', 'enemy', [dmg('percent', 0.25)], { mp: 6, magic: true, fx: 'gravity' }),
    tb_doom:    act('即死の呪い', 'tb_caster', 'enemy', [{ type: 'status', status: 'death', chance: 1 }], { mp: 8, magic: true, fx: 'death' }),
    tb_bomb:    act('爆発', 'tb_caster', 'enemies', [dmg('fixed', 50, { element: 'fire' })], { mp: 5, fx: 'explosion' }),

    // ---- enemy abilities
    en_tb_fire:   { name: '火の玉', kind: 'action', target: 'enemy', mp: 2, magic: true, effects: [dmg('magic', 10, { element: 'fire' })], fx: 'fire' },
    en_tb_breath: { name: '炎の息', kind: 'action', target: 'enemies', effects: [dmg('breath', 20, { element: 'fire' })], fx: 'breath_fire', msg: '{user}は炎を吐いた！' },
    en_tb_frost:  { name: '氷の息', kind: 'action', target: 'enemies', effects: [dmg('breath', 16, { element: 'ice' })], fx: 'breath_ice', msg: '{user}は冷たい息を吐いた！' },
    en_tb_heal:   { name: 'ヒール', kind: 'action', target: 'ally', mp: 3, magic: true, effects: [{ type: 'heal', power: 40 }], fx: 'heal' },
    en_tb_sleep:  { name: '眠りの歌', kind: 'action', target: 'enemies', effects: [{ type: 'status', status: 'sleep', chance: 0.5 }], fx: 'sleep' },
    en_tb_revive: { name: '蘇生', kind: 'action', target: 'ally_dead', mp: 5, magic: true, effects: [{ type: 'revive', pct: 1 }], fx: 'revive' },
    en_tb_smash:  { name: '渾身の一撃', kind: 'action', target: 'enemy', effects: [dmg('phys', 2)], fx: 'strike', msg: '{user}は力をためて殴りかかった！' },
    en_tb_roar:   { name: '雄叫び', kind: 'action', target: 'self', effects: [{ type: 'buff', stat: 'atk', stages: 1 }], fx: 'buff', msg: '{user}は雄叫びを上げた！' },
    en_tb_steal:  { name: '盗む', kind: 'action', target: 'enemy', effects: [{ type: 'steal' }], fx: 'steal' },
  });

  const allOf = (job) => Object.keys(DB.abilities).filter((k) => DB.abilities[k].job === job);
  Object.assign(DB.jobs, {
    tb_fighter: {
      name: 'テスト戦士', tier: 1, desc: 'テスト', command: '技',
      mult: { hp: 1, mp: 1, str: 1, vit: 1, agi: 1, int: 1, mnd: 1, luk: 1 },
      weapons: ['sword', 'knife'], shield: true, heads: ['helm', 'hat'], bodies: ['heavy', 'light', 'robe'],
      abilities: allOf('tb_fighter'), req: [], outfit: { main: '#3060c0', sub: '#c0c0c0', trim: '#e0c040' },
    },
    tb_caster: {
      name: 'テスト魔術師', tier: 1, desc: 'テスト', command: '魔法',
      mult: { hp: 1, mp: 1, str: 1, vit: 1, agi: 1, int: 1, mnd: 1, luk: 1 },
      weapons: ['staff', 'rod'], shield: false, heads: ['hat'], bodies: ['robe'],
      abilities: allOf('tb_caster'), req: [], outfit: { main: '#a03090', sub: '#e0e0e0', trim: '#60c0e0' },
    },
    tb_adept: {
      name: 'テスト達人', tier: 2, desc: 'テスト', command: '秘伝',
      mult: { hp: 1, mp: 1, str: 1, vit: 1, agi: 1, int: 1, mnd: 1, luk: 1 },
      weapons: ['sword'], shield: true, heads: ['helm'], bodies: ['heavy'],
      abilities: [], req: [['tb_fighter', 2], ['tb_caster', 2]], outfit: { main: '#40a040', sub: '#e0e0e0', trim: '#e0c040' },
    },
  });

  Object.assign(DB.items, {
    tb_sword:  { name: 'テストソード', type: 'weapon', wtype: 'sword', atk: 20, price: 100, desc: 'テスト' },
    tb_sword2: { name: 'テストソード2', type: 'weapon', wtype: 'sword', atk: 10, price: 100, desc: 'テスト' },
    tb_flame:  { name: '炎の剣', type: 'weapon', wtype: 'sword', atk: 20, element: 'fire', price: 100, desc: 'テスト' },
    tb_venom:  { name: '毒のナイフ', type: 'weapon', wtype: 'knife', atk: 12, onHit: { status: 'poison', chance: 1 }, price: 100, desc: 'テスト' },
    tb_staff:  { name: 'テストの杖', type: 'weapon', wtype: 'staff', atk: 5, mag: 5, price: 100, desc: 'テスト' },
    tb_ring:   { name: '火よけの指輪', type: 'acc', price: 100, desc: 'テスト', mods: { elemResist: { fire: 0.5 }, statusImmune: ['sleep'] } },
    tb_boost:  { name: '炎の指輪', type: 'acc', price: 100, desc: 'テスト', mods: { elemBoost: { fire: 50 } } },
    tb_herb:   { name: 'テスト薬草', type: 'consumable', price: 8, desc: 'テスト', use: { target: 'ally', effects: [{ type: 'heal', power: 30, scale: 0 }], fx: 'heal', battle: true, field: true } },
    tb_potion: { name: 'テストポーション', type: 'consumable', price: 50, desc: 'テスト', use: { target: 'ally', effects: [{ type: 'heal', power: 100, scale: 0 }], fx: 'heal', battle: true, field: true } },
    tb_feather: { name: 'テストの羽根', type: 'consumable', price: 300, desc: 'テスト', use: { target: 'ally_dead', effects: [{ type: 'revive', pct: 0.5 }], fx: 'revive', battle: true, field: true } },
    tb_firebomb: { name: 'テスト爆弾', type: 'consumable', price: 40, desc: 'テスト', use: { target: 'group', effects: [{ type: 'damage', formula: 'fixed', power: 30, element: 'fire' }], fx: 'fire', battle: true, field: false } },
    tb_nut:    { name: 'テストの実', type: 'consumable', price: 0, rare: true, desc: 'テスト', use: { target: 'ally', effects: [{ type: 'grow', stat: 'agi', n: 2 }], fx: 'grow', battle: true, field: true } },
    tb_gem:    { name: 'きらめく石', type: 'consumable', price: 0, rare: true, desc: 'テスト', use: { target: 'ally', effects: [{ type: 'healMp', power: 50 }], fx: 'mp', battle: true, field: true } },
  });

  const M = (o) => Object.assign({ lv: 1, hp: 20, mp: 0, atk: 10, def: 5, agi: 8, mag: 5, mdef: 5, exp: 5, gold: 5, jp: 2, desc: 'テスト', actions: [{ id: 'attack', w: 1 }] }, o);
  Object.assign(DB.monsters, {
    tb_slime:  M({ name: 'テストスライム', sprite: 'jelly', lv: 1, hp: 12, atk: 9, def: 3, agi: 5, exp: 3, gold: 4, jp: 3, drop: { item: 'tb_herb', rate: 2 }, rare: { item: 'tb_nut', rate: 4 }, steal: { item: 'tb_herb', rare: 'tb_gem' } }),
    tb_bluejelly: M({ name: '青ゼリー', sprite: 'jelly', hue: 200, lv: 2, hp: 16, atk: 11, def: 4, agi: 6, exp: 5, gold: 6, jp: 3 }),
    tb_goblin: M({ name: 'テストゴブリン', sprite: 'goblin', lv: 3, hp: 34, atk: 18, def: 9, agi: 9, exp: 9, gold: 10, jp: 4, elem: { fire: 2, ice: 0.5, thunder: 0, wind: -1 }, steal: { item: 'tb_herb' } }),
    tb_wolf:   M({ name: 'テストウルフ', sprite: 'wolf', lv: 4, hp: 40, atk: 22, def: 8, agi: 18, exp: 12, gold: 8, jp: 4 }),
    tb_bone:   M({ name: 'テストスケルトン', sprite: 'skeleton', lv: 5, hp: 50, atk: 20, def: 12, agi: 8, flags: ['undead'], elem: { holy: 2, fire: 1.5, dark: -1 }, exp: 15, gold: 12, jp: 5 }),
    tb_metal:  M({ name: 'メタルゼリー', sprite: 'jelly', hue: 180, sat: 0.1, bri: 1.3, lv: 10, hp: 6, mp: 20, atk: 20, def: 255, agi: 120, mag: 10, mdef: 255, eva: 20, flags: ['metal', 'flee'], fleeRate: 0.25, exp: 800, gold: 20, jp: 30 }),
    tb_mage:   M({ name: 'テスト魔導士', sprite: 'darkmage', lv: 6, hp: 45, mp: 40, atk: 12, def: 8, mag: 30, agi: 12, exp: 20, gold: 18, jp: 6,
      actions: [{ id: 'attack', w: 2 }, { id: 'en_tb_fire', w: 3 }, { id: 'en_tb_heal', w: 3 }, { id: 'en_tb_revive', w: 2 }, { id: 'en_tb_sleep', w: 1 }] }),
    tb_drake:  M({ name: 'テストドラゴン', sprite: 'wyvern', lv: 8, hp: 90, atk: 28, def: 14, agi: 14, flags: ['dragon', 'flying'], exp: 40, gold: 30, jp: 8,
      actions: [{ id: 'attack', w: 3 }, { id: 'en_tb_breath', w: 2 }, { id: 'en_tb_frost', w: 1 }], actsPerTurn: 1 }),
    tb_boss:   M({ name: 'テストキング', sprite: 'boss_goblin_chief', lv: 10, hp: 900, mp: 99, atk: 34, def: 18, agi: 16, mag: 20, mdef: 20, flags: ['boss'],
      statusRes: { sleep: 1, poison: 0.5, silence: 1, confuse: 1, paralyze: 1, blind: 0.5 }, exp: 300, gold: 200, jp: 40, actsPerTurn: 2,
      drop: { item: 'tb_potion', rate: 1 }, rare: { item: 'tb_gem', rate: 1 }, steal: { item: 'tb_potion', rare: 'tb_gem' },
      actions: [{ id: 'attack', w: 5 }, { id: 'en_tb_smash', w: 100, cond: { every: [3, 2] } }, { id: 'en_tb_roar', w: 100, cond: { hpBelow: 0.5, once: true } }, { id: 'en_tb_breath', w: 2 }] }),
    tb_thief:  M({ name: 'テスト盗賊', sprite: 'goblin', hue: 120, lv: 4, hp: 30, atk: 14, def: 6, agi: 20, exp: 10, gold: 30, jp: 4, actions: [{ id: 'en_tb_steal', w: 1 }] }),
    tb_dummy:  M({ name: 'かかし', sprite: 'goblin', hue: 60, lv: 1, hp: 9999, atk: 0, def: 0, agi: 1, mdef: 0, eva: 0, exp: 0, gold: 0, jp: 0, actions: [{ id: 'wait', w: 1 }] }),
    tb_brute:  M({ name: '怪力', sprite: 'orc', lv: 30, hp: 3000, atk: 400, def: 100, agi: 200, exp: 0, gold: 0, jp: 0, crit: 0, hit: 999 }),
  });

  Object.assign(DB.troops, {
    tb_boss: { mons: [['tb_boss', 1, 1]], bg: 'castle', bgm: 'boss', noEscape: true },
  });
  Object.assign(DB.encounters, {
    tb_zone: { lv: [1, 3], bg: 'grass', groups: [{ w: 10, mons: [['tb_slime', 2, 3], ['tb_goblin', 1, 2]] }, { w: 5, mons: [['tb_wolf', 1, 3]] }] },
  });

  // a character built directly for tests (bypasses newChar's job defaults)
  R.fxBattleChar = function (id, job, level, learned, equip, set) {
    const c = {
      id, name: DB.chars[id].name, level: level || 10, exp: R.Rules.expForLevel(level || 10), hp: 1, mp: 0, status: {},
      job, jobs: { [job]: { jp: 0, total: 0, learned: (learned || []).filter((a) => DB.abilities[a] && DB.abilities[a].job === job) } },
      equip: Object.assign({ weapon: null, shield: null, head: null, body: null, acc: null }, equip || {}),
      set: Object.assign({ sub: null, reaction: null, support: null, field: null }, set || {}),
    };
    // abilities of other jobs (reactions/supports) are learned in their own job record
    for (const a of learned || []) {
      const ab = DB.abilities[a];
      if (!ab || ab.job === job) continue;
      if (!c.jobs[ab.job]) c.jobs[ab.job] = { jp: 0, total: 0, learned: [] };
      c.jobs[ab.job].learned.push(a);
    }
    const st = R.Rules.stats(c);
    c.hp = st.hp; c.mp = st.mp;
    return c;
  };
  R.fxBattleParty = function (level) {
    const F = R.fxBattleChar;
    return [
      F('yuki', 'tb_fighter', level, ['tb_power', 'tb_double', 'tb_steal', 'tb_scan', 'tb_flurry', 'tb_cheer', 'tb_counter'], { weapon: 'tb_sword' }, { reaction: 'tb_counter' }),
      F('non', 'tb_caster', level, ['tb_heal', 'tb_healall', 'tb_revive', 'tb_cure', 'tb_protect', 'tb_regenspell', 'tb_sleep'], { weapon: 'tb_staff' }),
      F('metem', 'tb_caster', level, ['tb_fire', 'tb_blizzard', 'tb_thunder', 'tb_tornado', 'tb_quake', 'tb_flood', 'tb_holy', 'tb_dark', 'tb_meteor', 'tb_gravity', 'tb_mute', 'tb_weaken'], { weapon: 'tb_staff' }),
    ];
  };
})(window.RPG);
