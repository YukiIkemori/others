// Fixture data for tools/test_rules.js (rules A1). Loaded after src/ with
// require('./lib/load')({extra:[...]}) or `node tools/build.js --with tools/fixtures/rules`.
// Every id starts with fx_ so nothing collides with real data. Nothing here has
// src:'shop' or a `line`, so the real pools and shops stay as they are.
(function (R) {
  'use strict';
  const DB = R.DB;

  // two companions shaped like §4.3.7's mage (int 52) and warrior (str 50)
  Object.assign(DB.companions, {
    fx_mage: {
      name: 'テスト術', gender: 'f', row: 'middle', role: 'caster',
      stats: { str: 18, vit: 24, dex: 30, agi: 34, int: 52, mnd: 42 },
      growth: { hp: 'C', mp: 'S', wp: 'C' },
      apt: { w: { sword: 'B', greatsword: 'D', dagger: 'B', axe: 'D', spear: 'C', bow: 'B', club: 'C', staff: 'A', katana: 'C', fist: 'D', whip: 'B' },
        e: { fire: 'S', water: 'C', wind: 'C', earth: 'A', light: 'C', dark: 'B' } },
      innate: { name: 'テスト', desc: 'テスト', mods: { expPct: 10 } },
      startEquip: { weapon1: 'fx_staff_z' }, startTechs: [], startSpells: ['fx_s_cost'],
    },
    fx_warrior: {
      name: 'テスト剣', gender: 'm', row: 'front', role: 'guard',
      stats: { str: 50, vit: 44, dex: 30, agi: 28, int: 18, mnd: 30 },
      growth: { hp: 'A', mp: 'C', wp: 'B' },
      apt: { w: { sword: 'S', greatsword: 'A', dagger: 'C', axe: 'B', spear: 'B', bow: 'D', club: 'B', staff: 'D', katana: 'B', fist: 'C', whip: 'D' },
        e: { fire: 'B', water: 'B', wind: 'C', earth: 'B', light: 'A', dark: 'D' } },
      innate: { name: 'テスト', desc: 'テスト', mods: { goldPct: 10, encounterPct: 25 } },
      startEquip: { weapon1: 'fx_sword_z' }, startTechs: ['fx_t_cost'], startSpells: [],
    },
  });

  const IT = {
    // §4.3.7: T8 weapons with and without stat units
    fx_staff_z: { name: 'テスト杖Z', type: 'weapon', wtype: 'staff', tier: 8, grade: 'normal' },
    fx_sword_z: { name: 'テスト剣Z', type: 'weapon', wtype: 'sword', tier: 8, grade: 'normal' },
    fx_staff_n: { name: 'テスト杖N', type: 'weapon', wtype: 'staff', tier: 8, grade: 'normal', units: 'i2' },
    fx_staff_s: { name: 'テスト杖S', type: 'weapon', wtype: 'staff', tier: 8, grade: 'super', units: 'i2' },
    fx_sword_n: { name: 'テスト剣N', type: 'weapon', wtype: 'sword', tier: 8, grade: 'normal', units: 's2' },
    fx_sword_s: { name: 'テスト剣S', type: 'weapon', wtype: 'sword', tier: 8, grade: 'super', units: 's2' },
    fx_sword_3: { name: 'テスト剣3', type: 'weapon', wtype: 'sword', tier: 3, grade: 'normal', units: 's2' },
    fx_sword_5: { name: 'テスト剣5', type: 'weapon', wtype: 'sword', tier: 5, grade: 'normal', units: 's2' },
    fx_axe_5: { name: 'テスト斧5', type: 'weapon', wtype: 'axe', tier: 5, grade: 'normal', units: 's1v1' },
    fx_spear_5: { name: 'テスト槍5', type: 'weapon', wtype: 'spear', tier: 5, grade: 'normal', units: 's1d1' },
    fx_spear_1: { name: 'テスト槍1', type: 'weapon', wtype: 'spear', tier: 1, grade: 'normal', units: 's1d1' },
    fx_bow_5: { name: 'テスト弓5', type: 'weapon', wtype: 'bow', tier: 5, grade: 'normal', units: 'd2' },
    fx_gs_5: { name: 'テスト大剣5', type: 'weapon', wtype: 'greatsword', tier: 5, grade: 'normal', units: 's2' },
    fx_whip_5: { name: 'テスト鞭5', type: 'weapon', wtype: 'whip', tier: 5, grade: 'normal', units: 'd1a1' },
    fx_staff_5: { name: 'テスト杖5', type: 'weapon', wtype: 'staff', tier: 5, grade: 'normal', units: 'i2' },
    fx_sword_seal: { name: 'テスト封剣', type: 'weapon', wtype: 'sword', tier: 8, grade: 'super', units: 's2', sealTech: true, quirk: true, mods: { physPct: 25 } },
    fx_sword_q: { name: 'テスト癖剣', type: 'weapon', wtype: 'sword', tier: 9, grade: 'super', units: 's2', quirk: true, mods: { defPct: -50 } },
    fx_gs_rare: { name: 'テスト大剣R', type: 'weapon', wtype: 'greatsword', tier: 7, grade: 'rare', units: 's2', element: 'fire', desc: '火の属性で攻撃する。' },
    // armor, heavy and cloth
    fx_body_h5: { name: 'テスト鎧5', type: 'body', weight: 'heavy', tier: 5, grade: 'normal', units: 's1v1' },
    fx_body_c5: { name: 'テスト衣5', type: 'body', weight: 'cloth', tier: 5, grade: 'normal', units: 'i1m1' },
    fx_head_h5: { name: 'テスト兜5', type: 'head', weight: 'heavy', tier: 5, grade: 'normal', units: 'v1' },
    fx_head_c5: { name: 'テスト帽5', type: 'head', weight: 'cloth', tier: 5, grade: 'normal', units: 'i1' },
    fx_sh_h5: { name: 'テスト盾5', type: 'shield', weight: 'heavy', tier: 5, grade: 'normal', units: 'v1' },
    fx_sh_c5: { name: 'テスト書5', type: 'shield', weight: 'cloth', tier: 5, grade: 'normal', units: 'i1' },
    fx_sh_h1: { name: 'テスト盾1', type: 'shield', weight: 'heavy', tier: 1, grade: 'normal', units: 'v1' },
    fx_hands_l5: { name: 'テスト手5', type: 'hands', weight: 'light', tier: 5, grade: 'normal', units: 'd1' },
    fx_feet_l5: { name: 'テスト足5', type: 'feet', weight: 'light', tier: 5, grade: 'normal', units: 'a1' },
    fx_body_q: { name: 'テスト呪衣', type: 'body', weight: 'cloth', tier: 9, grade: 'super', units: 'i2', quirk: true, def: 0, mdef: 0 },
    // the full int / str sets of §4.3.7 (T8; 12 units with both weapons and both accessories)
    fx_i_body_n: { name: '知体N', type: 'body', weight: 'cloth', tier: 8, grade: 'normal', units: 'i2' },
    fx_i_head_n: { name: '知頭N', type: 'head', weight: 'cloth', tier: 8, grade: 'normal', units: 'i1' },
    fx_i_sh_n: { name: '知盾N', type: 'shield', weight: 'cloth', tier: 8, grade: 'normal', units: 'i1' },
    fx_i_hands_n: { name: '知手N', type: 'hands', weight: 'cloth', tier: 8, grade: 'normal', units: 'i1' },
    fx_i_feet_n: { name: '知足N', type: 'feet', weight: 'cloth', tier: 8, grade: 'normal', units: 'i1' },
    fx_i_acc_n: { name: '知飾N', type: 'acc', tier: 8, grade: 'normal', units: 'i1' },
    fx_i_body_s: { name: '知体S', type: 'body', weight: 'cloth', tier: 8, grade: 'super', units: 'i2' },
    fx_i_head_s: { name: '知頭S', type: 'head', weight: 'cloth', tier: 8, grade: 'super', units: 'i1' },
    fx_i_sh_s: { name: '知盾S', type: 'shield', weight: 'cloth', tier: 8, grade: 'super', units: 'i1' },
    fx_i_hands_s: { name: '知手S', type: 'hands', weight: 'cloth', tier: 8, grade: 'super', units: 'i1' },
    fx_i_feet_s: { name: '知足S', type: 'feet', weight: 'cloth', tier: 8, grade: 'super', units: 'i1' },
    fx_i_acc_s: { name: '知飾S', type: 'acc', tier: 8, grade: 'super', units: 'i1' },
    fx_s_body_n: { name: '力体N', type: 'body', weight: 'heavy', tier: 8, grade: 'normal', units: 's2' },
    fx_s_head_n: { name: '力頭N', type: 'head', weight: 'heavy', tier: 8, grade: 'normal', units: 's1' },
    fx_s_sh_n: { name: '力盾N', type: 'shield', weight: 'heavy', tier: 8, grade: 'normal', units: 's1' },
    fx_s_hands_n: { name: '力手N', type: 'hands', weight: 'heavy', tier: 8, grade: 'normal', units: 's1' },
    fx_s_feet_n: { name: '力足N', type: 'feet', weight: 'heavy', tier: 8, grade: 'normal', units: 's1' },
    fx_s_acc_n: { name: '力飾N', type: 'acc', tier: 8, grade: 'normal', units: 's1' },
    fx_s_body_s: { name: '力体S', type: 'body', weight: 'heavy', tier: 8, grade: 'super', units: 's2' },
    fx_s_head_s: { name: '力頭S', type: 'head', weight: 'heavy', tier: 8, grade: 'super', units: 's1' },
    fx_s_sh_s: { name: '力盾S', type: 'shield', weight: 'heavy', tier: 8, grade: 'super', units: 's1' },
    fx_s_hands_s: { name: '力手S', type: 'hands', weight: 'heavy', tier: 8, grade: 'super', units: 's1' },
    fx_s_feet_s: { name: '力足S', type: 'feet', weight: 'heavy', tier: 8, grade: 'super', units: 's1' },
    fx_s_acc_s: { name: '力飾S', type: 'acc', tier: 8, grade: 'super', units: 's1' },
    // accessories with mods (merging, caps)
    fx_acc_a: { name: '補A', type: 'acc', tier: 0, grade: 'rare', price: 100, mods: {
      expPct: 20, glimPct: { tech: 30, sword: 10 }, profPct: { sword: 40 }, elemResist: { fire: 0.5, water: 1.5 },
      statusImmune: ['poison'], statusResist: { sleep: 0.5 }, mpCostPct: -35, wpCostPct: -35, encounterPct: -50, autoSteal: 75,
      noFloorDamage: true, walkHeal: 2, goldPct: 100, dropPct: 100, preemptPct: 25, escapePct: 50, atk: 10, mag: 8, def: 5, mdef: 6, hit: 3, eva: 7, crit: 4, spd: 5,
      intPct: 10, hpPct: 20, mpPct: 20, wpPct: 20, regen: true } },
    fx_acc_b: { name: '補B', type: 'acc', tier: 0, grade: 'rare', price: 100, mods: {
      expPct: 20, glimPct: { tech: 20 }, profPct: { sword: 20 }, elemResist: { fire: 0, water: 0.75 },
      statusImmune: ['poison', 'sleep'], statusResist: { sleep: 0.25 }, mpCostPct: -35, wpCostPct: -35, encounterPct: -50, autoSteal: 50,
      goldPct: 100, dropPct: 100, preemptPct: 25, escapePct: 50 } },
    fx_acc_nospell: { name: '補封', type: 'acc', tier: 0, grade: 'super', price: 100, quirk: true, mods: { noSpell: true, strPct: 20 } },
    fx_acc_lure: { name: '補呼', type: 'acc', tier: 0, grade: 'normal', price: 100, mods: { encounterPct: 50 } },
    fx_acc_cost_up: { name: '補費', type: 'acc', tier: 0, grade: 'rare', price: 100, quirk: true, mods: { mpCostPct: 25, wpCostPct: 25 } },
    fx_acc_poor: { name: '補貧', type: 'acc', tier: 0, grade: 'super', price: 100, quirk: true, mods: { goldPct: -50, expPct: -50 } },
    fx_acc_luck: { name: '補運', type: 'acc', tier: 0, grade: 'rare', price: 100, mods: { rarePct: 20, superPct: 20 } },
    fx_only: { name: '専用', type: 'acc', tier: 0, grade: 'rare', price: 100, only: ['fx_mage'], units: 'i1' },
    fx_gender: { name: '女用', type: 'head', weight: 'cloth', tier: 0, grade: 'rare', gender: 'f', units: 'm1' },
    // consumables / key items for inventory tests
    fx_herb: { name: '草', type: 'consumable', grade: 'normal', price: 10, desc: 'テスト', use: { target: 'ally', effects: [{ type: 'heal', pct: 0.35 }], battle: true, field: true } },
    fx_key: { name: '鍵', type: 'key', price: 0, desc: 'テスト' },
    fx_pool_a: { name: 'プールA', type: 'consumable', grade: 'normal', price: 10, desc: 'テスト' },
    fx_pool_b: { name: 'プールB', type: 'consumable', grade: 'normal', price: 10, desc: 'テスト' },
    fx_pool_c: { name: 'プールC', type: 'consumable', grade: 'normal', price: 10, desc: 'テスト' },
  };
  Object.assign(DB.items, IT);

  Object.assign(DB.actions, {
    fx_t_cost: { kind: 'tech', name: 'テスト技', wtype: 'sword', wp: 5, target: 'enemy', effects: [], glim: { lv: 1, from: ['attack'] }, order: 99990 },
    fx_t_high: { kind: 'tech', name: 'テスト奥技', wtype: 'sword', wp: 9, target: 'enemy', effects: [], glim: { lv: 7, from: [] }, order: 99991 },
    fx_s_cost: { kind: 'spell', name: 'テスト術', elements: ['fire'], mp: 7, magic: true, field: true, target: 'ally', effects: [], glim: { lv: 1, prof: 0 }, step: 1, order: 99990 },
    fx_s_step3: { kind: 'spell', name: 'テスト術3', elements: ['fire'], mp: 6, magic: true, target: 'enemy', effects: [], glim: { lv: 3, prof: 4 }, step: 3, order: 99991 },
    fx_s_pair: { kind: 'spell', name: 'テスト合成', elements: ['fire', 'wind'], mp: 8, magic: true, target: 'enemies', effects: [], glim: { lv: 4, prof: 5 }, order: 99992 },
    fx_s_triple: { kind: 'spell', name: 'テスト三属', elements: ['fire', 'wind', 'light'], mp: 16, magic: true, target: 'enemies', effects: [], glim: { lv: 8, prof: 8 }, order: 99993 },
  });

  Object.assign(DB.monsters, {
    fx_mon: { name: 'テスト魔物', lv: 10, exp: 20, gold: 5, flags: [], size: 'm', s: {} },
    fx_rare: { name: 'テスト珍獣', lv: 10, exp: 100, gold: 5, flags: ['rare'], size: 'm', s: {} },
  });
  Object.assign(DB.encounters, {
    fx_zone: { region: 'r_forest', tier: 'dyn', lvOff: 1, groups: [{ w: 1, mons: [['fx_mon', 1, 2]] }] },
    fx_zone_fixed: { region: 'finale', tier: 8, lvOff: 0, groups: [{ w: 1, mons: [['fx_mon', 1, 1]] }] },
    fx_zone_pro: { region: 'prologue', tier: 0, lv: [1, 3], groups: [{ w: 1, mons: [['fx_mon', 1, 1]] }] },
  });
  const T10 = (fn) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(fn);
  Object.assign(DB.pools, {
    fx_pool: { tiers: T10((t) => (t === 0 ? [{ item: 'fx_pool_a', w: 3 }, { gold: 50, w: 1 }] : t < 5 ? [{ item: 'fx_pool_b', w: 1, n: 2 }] : [{ item: 'fx_pool_c', w: 1 }])) },
  });
  Object.assign(DB.shops, {
    fx_shop_new: { name: 'テスト武器屋', kind: 'weapon', keepOld: false, items: ['fx_herb'], stock: [
      { tier: 0, items: ['fx_sword_3'] }, { tier: 2, items: ['fx_sword_5'] }, { tier: 1, cond: { flag: 'fx_flag' }, items: ['fx_axe_5'] },
      { tier: 8, cond: { postgame: true }, items: ['fx_sword_q'] }] },
    fx_shop_old: { name: 'テスト道具屋', kind: 'item', keepOld: true, stock: [
      { tier: 0, items: ['fx_pool_a', 'fx_herb'] }, { tier: 1, items: ['fx_pool_b', 'fx_herb'] }, { tier: 3, items: ['fx_pool_c'] },
      { tier: 0, cond: { cleared: 'r_mine' }, items: ['fx_key'] }] },
  });
  Object.assign(DB.maps, {
    fx_town: { name: 'テストの町', type: 'town', location: 'fx_loc_town', rows: [] },
    fx_house: { name: 'テストの家', type: 'house', partySwap: false, rows: [] },
    fx_castle: { name: 'テストの城', type: 'castle', rows: [] },
    fx_dun_1: { name: 'テスト洞窟 1階', type: 'dungeon', escape: { map: 'world', spawn: 'fx_dun_1' }, encounter: 'fx_zone', lvOff: 2, chestTier: 5, chests: [{ id: 'fx_dun_1_c1', x: 1, y: 1, pool: 'fx_pool' }], rows: [] },
    fx_dun_2: { name: 'テスト洞窟 2階', type: 'dungeon', escape: { map: 'world', spawn: 'fx_dun_1' }, zones: [{ x: 0, y: 0, w: 1, h: 1, zone: 'fx_zone_pro' }], rows: [] },
    fx_dun_3: { name: 'テスト洞窟 3階', type: 'dungeon', escape: { map: 'world', spawn: 'fx_dun_1' }, location: 'fx_loc_dun', rows: [] },
  });
  Object.assign(DB.locations, {
    fx_loc_town: { name: 'テストの町', map: 'world', spawn: 'fx_town', region: 'prologue', kind: 'town' },
    fx_loc_dun: { name: 'テスト洞窟', map: 'world', spawn: 'fx_dun_1', region: 'prologue', kind: 'dungeon' },
  });

  R.onData(() => { for (const id in IT) R.Rules.fillItem(DB.items[id]); });
})(window.RPG);
