#!/usr/bin/env node
// tools/test_gear.js — gear-a (A10a) unit tests: armor + accessories (DESIGN §8.14.1; shops / pools / consumables
// are validate's, §8.14.2). node tools/test_gear.js [-v]   → exit 1 on any failure.
//
//  1  the 36 armor / accessory lines have T0–T9 with the §8.1.1 / §8.1.2 ids (T0 fixed ids), starting gear names
//  2  numbers after fillItem = the §8.4 tables (tables held below); data files do not write the filled numbers
//  3  units: body 2, shield / head / hands / feet / ability accessory 1, support / relic / reward 0; normal stats
//     follow the weight (§4.3.3)
//  4  special effects / quirks: counts per grade and sizes within §8.3.5 (caps) and §8.3.6 (quirk ranges);
//     off-weight stats only with a quirk
//  5  no two-handed flag on armor or accessories
//  6  names ≤ 9, unique, not in STYLE_JA §7, jōyō kanji (+ §2 extras); desc ≤ 2 lines × 20 (half-width 0.5)
//  7  mods keys in §3.3.16 (and their sub-keys: elements, statuses, weapon types, tech / spell, buff stats)
//  8  T8 super sets and T7 / T9 rare sets complete; §8.13.1 build multipliers (D1 D2) and fragility (D3)
//  +  every status has a normal / rare / relic-or-super defence (§8.13.3); rare-hunting build and the caps
//     of §8.3.5 through R.Rules.mods / partyMods (§8.13.2); proficiency / glimmer items (§8.13.4);
//     easy steal (Part A5); spec conformance with DESIGN tables (tools/check_gear-a.js); monster links (info)
'use strict';
const fs = require('fs');
const path = require('path');
const load = require('./lib/load');
const CG = require('./check_gear-a');

const VERBOSE = process.argv.includes('-v');
const ROOT = path.resolve(__dirname, '..');
const R0 = load({ quiet: true, dataHooks: false });      // the data as written (before fillItem)
const R = load({ quiet: true });
const DB = R.DB;
let pass = 0, fail = 0;
const fails = [];
const warns = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); } return !!cond; }
function warn(msg) { warns.push(msg); }
function section(name, fn) {
  const f0 = fail, p0 = pass;
  try { fn(); } catch (e) { fail++; fails.push(`${name}: threw ${e && e.stack || e}`); }
  console.log(`${fail > f0 ? 'FAIL' : 'ok  '} ${name}  (${pass - p0} passed${fail > f0 ? `, ${fail - f0} failed` : ''})`);
}

// ------------------------------------------------------------------ the gear-a set
const PREFIX = /^(bd|hd|sh|hn|ft|ac)_/;
const ARMOR = ['shield', 'head', 'body', 'hands', 'feet'];
const MINE = Object.keys(DB.items).filter((id) => PREFIX.test(id));
const raw = Object.fromEntries(MINE.map((id) => [id, R0.DB.items[id]]));
const I = (id) => DB.items[id];
const STATS = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const STATUSES = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind', 'death'];
const WTYPES = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
const WEIGHT_STATS = { heavy: ['str', 'vit'], light: ['dex', 'agi'], cloth: ['int', 'mnd'] };
const U = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
const GM = { normal: 1, rare: 2, super: 3 };
const gearStat = (T, u, g) => Math.max(1, Math.round(u * U[T])) * GM[g || 'normal'];
const unitsOf = (it) => [...String(it.units || '').matchAll(/([svdaim])(\d)/g)].map((m) => ({ stat: { s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' }[m[1]], n: +m[2] }));
const width = (s) => [...String(s)].reduce((w, ch) => w + (/[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

console.log(`test_gear: ${MINE.length} armor / accessory items (armor ${MINE.filter((id) => I(id).type !== 'acc').length}, accessories ${MINE.filter((id) => I(id).type === 'acc').length})`);

// ------------------------------------------------------------------ the tables of §8.4 / §8.3 (held here, §8.14.1-2)
// def/mdef by T: body heavy/light/cloth, head h/l/c, shield h/l/c, hands h/l/c, feet h/l/c (§8.4.2)
const DEF_TABLE = [
  '28/6 18/10 11/17 11/2 7/4 4/6 14/3 9/5 6/8 7/1 5/2 3/4 11/2 7/4 4/6',
  '40/8 26/14 16/24 15/3 10/5 6/9 20/4 13/7 8/12 10/2 7/4 4/6 15/3 10/5 6/9',
  '52/10 34/18 21/31 20/4 13/7 8/12 26/5 17/9 10/16 13/3 8/5 5/8 20/4 13/7 8/12',
  '64/13 42/22 26/38 24/5 16/8 10/14 32/6 21/11 13/19 16/3 10/6 6/10 24/5 16/8 10/14',
  '76/15 49/27 30/46 29/6 19/10 11/17 38/8 25/13 15/23 19/4 12/7 8/11 29/6 19/10 11/17',
  '88/18 57/31 35/53 33/7 21/12 13/20 44/9 29/15 18/26 22/4 14/8 9/13 33/7 21/12 13/20',
  '100/20 65/35 40/60 38/8 24/13 15/23 50/10 33/18 20/30 25/5 16/9 10/15 38/8 24/13 15/23',
  '112/22 73/39 45/67 42/8 27/15 17/25 56/11 36/20 22/34 28/6 18/10 11/17 42/8 27/15 17/25',
  '124/25 81/43 50/74 47/9 30/16 19/28 62/12 40/22 25/37 31/6 20/11 12/19 47/9 30/16 19/28',
  '136/27 88/48 54/82 51/10 33/18 20/31 68/14 44/24 27/41 34/7 22/12 14/20 51/10 33/18 20/31',
].map((row) => {
  const v = row.split(' ').map((c) => c.split('/').map(Number));
  const o = {};
  ['body', 'head', 'shield', 'hands', 'feet'].forEach((t, i) => ['heavy', 'light', 'cloth'].forEach((w, j) => { o[`${t}.${w}`] = v[i * 3 + j]; }));
  return o;
});
const EVA = { heavy: 8, light: 5, cloth: 2 };
// price by T: body head shield hands feet acc (§8.3.8)
const PRICE_TABLE = [
  [100, 60, 70, 40, 40, 80], [220, 130, 160, 100, 100, 190], [410, 230, 290, 170, 170, 350], [630, 360, 450, 270, 270, 540],
  [920, 530, 660, 400, 400, 790], [1260, 720, 900, 540, 540, 1080], [1680, 960, 1200, 720, 720, 1440], [2100, 1200, 1500, 900, 900, 1800],
  [2660, 1520, 1900, 1140, 1140, 2280], [3640, 2080, 2600, 1560, 1560, 3120],
].map(([body, head, shield, hands, feet, acc]) => ({ body, head, shield, hands, feet, acc }));
// 1 unit / 2 units, normal / rare / super (§8.3.1)
const UNIT_TABLE = ['1/2/3 2/4/6', '2/4/6 3/6/9', '2/4/6 4/8/12', '3/6/9 5/10/15', '3/6/9 6/12/18', '4/8/12 7/14/21', '4/8/12 8/16/24',
  '5/10/15 9/18/27', '5/10/15 10/20/30', '6/12/18 12/24/36'].map((r) => r.split(' ').map((c) => c.split('/').map(Number)));
const unitValue = (T, n, g) => UNIT_TABLE[T][n - 1][{ normal: 0, rare: 1, super: 2 }[g]];

// ------------------------------------------------------------------ 1. lines and ids
const ARMOR_LINES = {
  body: ['bd_mail', 'bd_plate', 'bd_vest', 'bd_garb', 'bd_robe', 'bd_habit'],
  head: ['hd_helm', 'hd_band', 'hd_cap', 'hd_scarf', 'hd_hat', 'hd_hood'],
  shield: ['sh_buckler', 'sh_tower', 'sh_shield', 'sh_round', 'sh_book', 'sh_charm'],
  hands: ['hn_gauntlet', 'hn_bracer', 'hn_glove', 'hn_armlet', 'hn_longglove', 'hn_mitten'],
  feet: ['ft_greave', 'ft_shin', 'ft_boots', 'ft_shoes', 'ft_slipper', 'ft_sandal'],
  acc: ['ac_str', 'ac_vit', 'ac_dex', 'ac_agi', 'ac_int', 'ac_mnd'],
};
const LINE_KIND = ['heavy:str', 'heavy:vit', 'light:dex', 'light:agi', 'cloth:int', 'cloth:mnd'];
const T0ID = { bd_mail: 'bd_iron_cuirass', bd_vest: 'bd_leather_vest', bd_robe: 'bd_hemp_robe', hd_band: 'hd_iron_band', hd_cap: 'hd_leather_cap',
  hd_hood: 'hd_wool_hood', sh_buckler: 'sh_iron_buckler', sh_shield: 'sh_leather', sh_book: 'sh_primer' };
const lineId = (line, T) => (T === 0 && T0ID[line]) || `${line}_${T}`;
const START_GEAR = { bd_iron_cuirass: ['鉄の胸当て', { str: 2 }], hd_iron_band: ['鉄の額当て', { vit: 1 }], sh_iron_buckler: ['鉄の小盾', { str: 1 }],
  bd_leather_vest: ['革の胴着', { dex: 2 }], hd_leather_cap: ['革の帽子', { dex: 1 }], sh_leather: ['革の盾', { dex: 1 }],
  bd_hemp_robe: ['麻の法衣', { int: 2 }], hd_wool_hood: ['毛織りの頭巾', { mnd: 1 }], sh_primer: ['術の手引き', { int: 1 }] };
const NORMAL_LINE_IDS = [];

section('1 lines and ids (§8.1.1, §8.1.2)', () => {
  for (const [type, lines] of Object.entries(ARMOR_LINES)) {
    lines.forEach((line, li) => {
      for (let T = 0; T <= 9; T++) {
        const id = lineId(line, T), it = I(id);
        NORMAL_LINE_IDS.push(id);
        if (!ok(it, `${id}: missing`)) continue;
        ok(it.type === type && it.line === line && it.tier === T && it.grade === 'normal' && it.src === 'shop', `${id}: type/line/tier/grade/src ${it.type}/${it.line}/${it.tier}/${it.grade}/${it.src}`);
        if (type !== 'acc') {
          const [w, st] = LINE_KIND[li].split(':');
          ok(it.weight === w, `${id}: weight ${it.weight} ≠ ${w}`);
          ok(unitsOf(it).length === 1 && unitsOf(it)[0].stat === st, `${id}: units ${it.units} (line stat ${st})`);
        } else ok(unitsOf(it).length === 1 && unitsOf(it)[0].stat === STATS[li], `${id}: units ${it.units}`);
        if (T === 0 && T0ID[line]) ok(!I(`${line}_0`), `${line}_0 must not exist (T0 is ${T0ID[line]})`);
      }
    });
  }
  ok(NORMAL_LINE_IDS.length === 360, `36 lines × 10 = ${NORMAL_LINE_IDS.length}`);
  for (const [id, [name, st]] of Object.entries(START_GEAR)) {
    ok(I(id) && I(id).name === name, `start gear ${id} = ${name} (got ${I(id) && I(id).name})`);
    ok(I(id) && JSON.stringify(I(id).stats) === JSON.stringify(st), `start gear ${id} stats ${JSON.stringify(I(id) && I(id).stats)} ≠ ${JSON.stringify(st)}`);
  }
  // id shapes of the other groups (§8.1.1)
  const PFX = { body: 'bd_', head: 'hd_', shield: 'sh_', hands: 'hn_', feet: 'ft_', acc: 'ac_' };
  for (const id of MINE) {
    const it = I(id);
    ok(id.startsWith(PFX[it.type]), `${id}: prefix does not match type ${it.type}`);
    if (it.src === 'drop') ok(/^(bd|hd|sh|hn|ft|ac)_r[13579]_[a-z]+$/.test(id) && +id.match(/_r(\d)_/)[1] === it.tier, `${id}: band-rare id / tier`);
    if (it.src === 'super') ok(/_sr_[a-z_]+$/.test(id), `${id}: super id needs _sr_<key>`);
    if (it.src === 'relic') ok((it.grade === 'rare' && /^ac_rl_[a-z]+$/.test(id)) || (it.grade === 'super' && /^ac_rs_[a-z]+$/.test(id)), `${id}: relic id / grade`);
    if (it.src === 'mdrop') ok(!/_r\d_|_sr_/.test(id), `${id}: monster rare id must not look like a band / super id`);
  }
  const count = (f) => MINE.filter((id) => f(I(id))).length;
  const n = { armor: count((it) => it.type !== 'acc'), acc: count((it) => it.type === 'acc') };
  ok(n.armor === 480 && n.acc === 265, `counts armor ${n.armor}/480, accessories ${n.acc}/265 (§8.1.3)`);
  const by = (type, src) => count((it) => (type === 'acc' ? it.type === 'acc' : it.type !== 'acc') && it.src === src);
  const EXPECT = [['armor', 'shop', 300], ['armor', 'drop', 52], ['armor', 'mdrop', 42], ['armor', 'super', 85], ['armor', 'reward', 1],
    ['acc', 'shop', 112], ['acc', 'drop', 19], ['acc', 'mdrop', 40], ['acc', 'super', 41], ['acc', 'relic', 42], ['acc', 'reward', 11]];
  for (const [t, s, e] of EXPECT) ok(by(t, s) === e, `${t} src '${s}': ${by(t, s)} ≠ ${e}`);
});

// ------------------------------------------------------------------ 2. numbers
const WRITTEN_OK = (id, k, it) => {
  if ((k === 'def' || k === 'mdef') && it.quirk) return true;                                // quirk def:0 / halved
  if (k === 'price' && (it.src === 'relic' || it.src === 'reward' || (it.grade === 'normal' && !it.units))) return true;
  return false;
};
section('2 numbers after fillItem = §8.4 tables; data does not write them', () => {
  for (const id of MINE) {
    const r = raw[id];
    for (const k of ['atk', 'mag', 'def', 'mdef', 'eva', 'stats', 'price'])
      if (r[k] !== undefined) ok(WRITTEN_OK(id, k, r), `${id}: data writes '${k}' (${JSON.stringify(r[k])}) — fillItem's job`);
  }
  for (const id of MINE) {
    const it = I(id), T = it.tier;
    // def / mdef / eva
    if (ARMOR.includes(it.type)) {
      const [d, m] = DEF_TABLE[T][`${it.type}.${it.weight}`];
      const rd = raw[id].def, rm = raw[id].mdef;
      if (rd === 0 && rm === 0) ok(it.def === 0 && it.mdef === 0, `${id}: def/mdef 0 quirk`);
      else {
        ok(it.def === (rd !== undefined ? Math.round(d / 2) : d), `${id}: def ${it.def} (table ${d}${rd !== undefined ? ', halved' : ''})`);
        ok(it.mdef === (rm !== undefined ? Math.round(m / 2) : m), `${id}: mdef ${it.mdef} (table ${m}${rm !== undefined ? ', halved' : ''})`);
      }
      if (rd !== undefined && rd !== 0) ok(rd === Math.round(d / 2), `${id}: halved def must be round(${d}/2)`);
      if (rm !== undefined && rm !== 0) ok(rm === Math.round(m / 2), `${id}: halved mdef must be round(${m}/2)`);
      if (it.type === 'shield') ok(it.eva === EVA[it.weight], `${id}: shield eva ${it.eva} ≠ ${EVA[it.weight]}`);
      else ok(it.eva === undefined, `${id}: only shields have eva`);
    } else ok(!it.def && !it.mdef && it.eva === undefined, `${id}: accessories have no def / mdef / eva`);
    ok(it.atk === undefined && it.mag === undefined, `${id}: armor / accessories have no atk / mag`);
    // stats
    const want = {};
    for (const u of unitsOf(it)) { want[u.stat] = unitValue(T, u.n, it.grade); ok(want[u.stat] === gearStat(T, u.n, it.grade), `${id}: unit table / formula disagree`); }
    for (const [k, v] of Object.entries(raw[id].statsAdd || {})) want[k] = (want[k] || 0) + v;
    if (it.units) ok(JSON.stringify(Object.fromEntries(Object.entries(it.stats || {}).filter(([, v]) => v))) === JSON.stringify(want), `${id}: stats ${JSON.stringify(it.stats)} ≠ ${JSON.stringify(want)}`);
    else ok(!it.stats || Object.values(it.stats).every((v) => !v), `${id}: no units → no stats (${JSON.stringify(it.stats)})`);
    // price
    if (it.src === 'relic') ok(it.price === (it.grade === 'rare' ? 1500 : 3000), `${id}: relic price ${it.price}`);
    else if (it.src === 'reward') ok(it.price === 0 && it.unique === true, `${id}: reward price 0 + unique`);
    else if (it.grade === 'normal' && !it.units) ok(it.price === Math.round(({ 0: 70, 1: 160, 2: 290, 3: 450 })[T] * 1.2 / 10) * 10, `${id}: support price ${it.price} (shop tier ${T})`);
    else ok(it.price === PRICE_TABLE[T][it.type] * { normal: 1, rare: 3, super: 6 }[it.grade], `${id}: price ${it.price} ≠ ${PRICE_TABLE[T][it.type]} × grade`);
    ok(typeof it.desc === 'string' && it.desc.length > 0, `${id}: desc`);
  }
  // normal-item descs (§8.2.7)
  const WT = { heavy: '重くて守りが固い。', light: '軽くて動きやすい。', cloth: '術から身を守る。' };
  const SN = { str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' };
  for (const id of NORMAL_LINE_IDS) {
    const it = I(id); if (!it) continue;
    ok(it.desc === `${it.type === 'acc' ? '身につける飾り。' : WT[it.weight]}\n${SN[unitsOf(it)[0].stat]}が上がる。`, `${id}: normal desc ${JSON.stringify(it.desc)}`);
  }
});

// ------------------------------------------------------------------ 2b. the local fallback of R.GearA = R.Rules.fillItem
section('2b local fallback fill (R.GearA.localFill) = R.Rules.fillItem', () => {
  if (!ok(R.GearA && typeof R.GearA.localFill === 'function', 'R.GearA.localFill exists')) return;
  if (!(R.Rules && typeof R.Rules.fillItem === 'function')) { warn('R.Rules.fillItem missing: the game runs on the local fallback'); return; }
  const rulesFill = R.Rules.fillItem, rulesDesc = R.Rules.autoDesc;
  for (const id of MINE) {
    const a = JSON.parse(JSON.stringify(raw[id])), b = JSON.parse(JSON.stringify(raw[id]));
    rulesFill(a);
    R.Rules.fillItem = undefined; R.Rules.autoDesc = undefined;                // the fallback path as in a build without rules
    try { R.GearA.localFill(b); } finally { R.Rules.fillItem = rulesFill; R.Rules.autoDesc = rulesDesc; }
    for (const k of ['stats', 'def', 'mdef', 'eva', 'price', 'desc']) ok(JSON.stringify(a[k]) === JSON.stringify(b[k]), `${id}.${k}: rules ${JSON.stringify(a[k])} ≠ local ${JSON.stringify(b[k])}`);
  }
});

// ------------------------------------------------------------------ 3. units
section('3 units per slot; normal stats follow the weight (§4.3.3)', () => {
  for (const id of MINE) {
    const it = I(id);
    const n = unitsOf(it).reduce((a, u) => a + u.n, 0);
    const want = it.type === 'body' ? 2 : ARMOR.includes(it.type) ? 1 : (it.units ? 1 : 0);
    if (it.type === 'acc' && (it.src === 'relic' || it.src === 'reward' || (it.grade === 'normal' && it.line && it.line.startsWith('charm_'))))
      ok(!it.units, `${id}: support / relic / reward accessories have no units`);
    else ok(n === want, `${id}: units ${it.units} = ${n}, want ${want}`);
    if (it.grade === 'normal' && ARMOR.includes(it.type)) for (const u of unitsOf(it)) ok(WEIGHT_STATS[it.weight].includes(u.stat), `${id}: ${u.stat} on ${it.weight}`);
  }
});

// ------------------------------------------------------------------ 4. effects and quirks
// classes: 0 normal (support accessories), 1 rare, 2 super, 3 relic / reward rare, 4 relic / reward super
const cls = (it) => (it.src === 'relic' ? (it.grade === 'super' ? 4 : 3) : it.src === 'reward' ? (it.units ? 1 : 4) : it.grade === 'super' ? 2 : it.grade === 'rare' ? 1 : 0);
const STAT_PCT = new Set(STATS.map((s) => s + 'Pct'));
// §8.3.5 caps (absolute values) per class [normal, rare, super, relic-rare, relic-super]; null = not allowed
const LIM = {
  crit: [null, 20, 20, 10, 20], hit: [null, 15, 15, 10, 20], atk: [null, 10, 20, null, null], def: [null, 10, 20, null, null], mdef: [null, 10, 20, null, null],
  elemBoost: [10, 20, 30, 20, 30], hpPct: [null, 15, 20, 15, 20], mpPct: [null, 20, 25, 15, 20], wpPct: [null, 20, 25, 15, 20],
  regen: [null, true, true, true, true], mpRegen: [null, 3, 3, 1, 2], wpRegen: [null, 3, 3, 1, 2],
  physPct: [10, 15, 25, 15, 25], magicPct: [10, 15, 25, 15, 25], healPct: [20, 35, 50, 35, 35], itemPct: [30, 50, 50, null, null],
  mpCostPct: [15, 25, 35, 15, 35], wpCostPct: [15, 25, 35, 15, 35], mag: [null, 'T', '2T', null, null],
  glimPct: [10, 15, 20, 15, 20], profPct: [20, 35, 50, null, null],
  dropPct: [10, 20, 30, 20, 30], rarePct: [10, 20, 30, 20, 30], superPct: [null, 20, 30, 20, 30], goldPct: [10, 20, 30, 20, 30],
  expPct: [10, 15, 20, 15, null], encounterPct: [50, 50, 50, 50, null], rareEncPct: [null, 20, 30, 20, 30], goldenPct: [null, 20, 30, 20, 30],
  stealPct: [50, 50, 50, null, null], escapePct: [50, 50, 50, 50, 50], preemptPct: [5, 5, 10, 10, 10], autoSteal: [50, 75, 100, null, null],
  spd: [null, 20, 30, 15, 30], eva: [null, 10, 15, 15, 30], defPct: [null, null, 25, 15, 25], mdefPct: [null, null, 25, 15, 25],
  autoRevive: [null, null, 0.3, null, null], autoCounter: [null, null, 0.3, null, 0.25], noFloorDamage: [true, true, true, null, null],
  startBuffs: [null, 1, 2, null, 2], statusImmune: [0, 1, 3, 1, 2],
};
const SRES = [[0.5, 1], [0.5, 3], [0.6, 3], [0.5, 3], [0.5, 3]];                     // statusResist [max value, max states]
// §8.3.6 quirk ranges [rare (weak), super (strong)] — the largest allowed harm
const QLIM = { defPct: [-25, -50], mdefPct: [-25, -50], takenPct: [15, 30], hpPct: [-10, -30], spd: [-15, -30], eva: [-10, -20], hit: [-10, -20],
  elemResist: [1.25, 2], statusResist: [-0.25, -0.5], expPct: [-25, -50], goldPct: [-25, -50], encounterPct: [50, 50], mpCostPct: [25, 50],
  wpCostPct: [25, 50], glimPct: [-50, -100], noSpell: [null, true], hpLoss: [null, 5], statsAdd: [1, 2] };
const QUIRK_IF = { takenPct: (v) => v > 0, hpLoss: () => true, noSpell: () => true, mpCostPct: (v) => v > 0, wpCostPct: (v) => v > 0 };

/** split an item into effect keys, quirk keys and stat-% keys */
function analyse(it, r) {
  const eff = new Set(), q = new Set(), pct = {};
  const m = it.mods || {};
  for (const [k, v] of Object.entries(m)) {
    if (k === 'elemResist') { for (const x of Object.values(v)) (x > 1 ? q : eff).add(k); continue; }
    if (k === 'statusResist') { for (const x of Object.values(v)) (x < 0 ? q : eff).add(k); continue; }
    if (k === 'glimPct' || k === 'profPct') { for (const x of Object.values(v)) (x < 0 ? q : eff).add(k); continue; }
    if (STAT_PCT.has(k)) { if (v < 0) q.add(k); else pct[k] = v; continue; }
    if (k === 'encounterPct') { (v > 0 && it.grade !== 'normal' ? q : eff).add(k); continue; }
    if (QUIRK_IF[k]) { (QUIRK_IF[k](v) ? q : eff).add(k); continue; }
    if (typeof v === 'number') (v < 0 ? q : eff).add(k); else eff.add(k);
  }
  if (r.statsAdd) q.add('statsAdd');
  if (r.def === 0 && r.mdef === 0) q.add('def+mdef:0');                            // one quirk: 守備と術防が 0
  else { if (r.def !== undefined) q.add('def:half'); if (r.mdef !== undefined) q.add('mdef:half'); }
  return { eff, q, pct };
}
const MONSTER_CHAPTER = new Set([...CG.spec().mSuper.map((x) => x.id), ...CG.spec().mRare.map((x) => x.id)]);

section('4 effects / quirks: counts and sizes (§8.3.3–§8.3.6)', () => {
  let supers = 0, supersNoQuirk = 0;
  for (const id of MINE) {
    const it = I(id), r = raw[id], c = cls(it), T = it.tier;
    const qcol = it.grade === 'rare' ? 0 : 1;                                       // §8.3.6 column: rare (weak) / super (strong)
    const { eff, q, pct } = analyse(it, r);
    const m = it.mods || {};
    // counts
    if (NORMAL_LINE_IDS.includes(id)) { ok(!Object.keys(m).length && !q.size, `${id}: normal line item has mods`); continue; }
    if (c === 0) ok(eff.size >= 1 && eff.size <= 2 && !q.size, `${id}: support accessory effects ${[...eff]} quirks ${[...q]}`);
    if (c === 1) {
      const max = (T === 9 || it.src === 'mdrop') ? 3 : 1;
      ok(eff.size >= 1 && eff.size <= max, `${id}: rare effects ${eff.size} (${[...eff]}), max ${max}`);
      // LEAD_DECISIONS D3 (BRIEF Part A「レア装備は性能が突き抜けているがクセもある」): exactly one weak quirk
      ok(q.size === 1, `${id}: a rare has exactly one quirk (D3), has ${[...q]}`);
      ok(!!it.quirk === q.size > 0, `${id}: quirk flag ${!!it.quirk} vs quirks ${[...q]}`);
    }
    if (c === 2) {
      supers++; if (!q.size) supersNoQuirk++;
      ok(eff.size >= 1 && eff.size <= 3, `${id}: super effects ${eff.size} (${[...eff]})`);
      // §8.14.1-4 says 0–1 quirk; the §9.12.4 table gives 6 armor / accessory supers two quirk kinds (reported)
      ok(q.size <= (MONSTER_CHAPTER.has(id) ? 2 : 1), `${id}: super quirks ${[...q]}`);
      ok(!!it.quirk === q.size > 0, `${id}: quirk flag`);
    }
    if (c >= 3) {
      ok(eff.size + Object.keys(pct).length >= 1 && eff.size <= 3, `${id}: relic / reward effects ${[...eff]}`);
      // D3: a rare relic / story reward (grade 'rare') has exactly one weak quirk; a super relic 0–1
      if (it.grade === 'rare') ok(q.size === 1, `${id}: rare relic / reward has exactly one quirk (D3), has ${[...q]}`);
      else ok(q.size <= 1, `${id}: relic / reward quirks ${[...q]}`);
      const pv = Object.values(pct);
      if (c === 3) ok(pv.length <= 1 && pv.every((v) => v <= 10), `${id}: stat % ${JSON.stringify(pct)} (rare: one +10)`);
      else ok((pv.length <= 1 && pv.every((v) => v <= 20)) || (pv.length === 2 && pv.every((v) => v <= 15)), `${id}: stat % ${JSON.stringify(pct)} (super: two +15 or one +20)`);
    }
    // sizes of effects
    for (const [k, v] of Object.entries(m)) {
      if (STAT_PCT.has(k)) continue;
      if (k === 'elemResist') {
        const vals = Object.values(v).filter((x) => x < 1);
        const n = (f) => vals.filter(f).length;
        if (c === 0) ok(vals.length <= 1 && vals.every((x) => x >= 0.5), `${id}: elemResist ${JSON.stringify(v)} (normal: one 0.5)`);
        if (c === 1) ok(n((x) => x < 0) === 0 && n((x) => x <= 0) <= 1 && n((x) => x <= 0.5) <= 2 && vals.length <= 4 && (n((x) => x <= 0) === 0 || vals.length === 1), `${id}: elemResist ${JSON.stringify(v)} (rare)`);
        if (c === 2) ok(n((x) => x < 0) <= 1 && n((x) => x <= 0) <= 2 && vals.length <= 4 && vals.every((x) => x >= -1), `${id}: elemResist ${JSON.stringify(v)} (super)`);
        if (c === 3) ok(vals.every((x) => x >= 0.5), `${id}: elemResist ${JSON.stringify(v)} (relic rare 0.5)`);
        if (c === 4) ok(vals.every((x) => x >= -1) && n((x) => x < 0.5) <= 1, `${id}: elemResist ${JSON.stringify(v)} (relic super)`);
        for (const x of Object.values(v).filter((x) => x > 1)) ok(x <= QLIM.elemResist[qcol], `${id}: weakness ${x} too large`);
        continue;
      }
      if (k === 'statusResist') {
        const good = Object.values(v).filter((x) => x > 0), bad = Object.values(v).filter((x) => x < 0);
        ok(good.length <= SRES[c][1] && good.every((x) => x <= SRES[c][0]), `${id}: statusResist ${JSON.stringify(v)}`);
        for (const x of bad) ok(x >= QLIM.statusResist[qcol], `${id}: status weakness ${x} too large`);
        continue;
      }
      if (k === 'statusImmune') { ok(v.length <= LIM.statusImmune[c], `${id}: statusImmune ${v.length} > ${LIM.statusImmune[c]}`); continue; }
      if (k === 'startBuffs') { ok(LIM.startBuffs[c] && Object.keys(v).length <= LIM.startBuffs[c] && Object.values(v).every((x) => x === 1), `${id}: startBuffs ${JSON.stringify(v)}`); continue; }
      const isQ = analyse({ mods: { [k]: v }, grade: it.grade }, {}).q.has(k);
      if (isQ) {
        const lim = QLIM[k];
        if (!ok(lim, `${id}: ${k}=${JSON.stringify(v)} is not a quirk of §8.3.6`)) continue;
        let L = lim[qcol];
        if (k === 'expPct' && T === 9 && qcol === 1) L = -100;                                        // post-game supers
        if (typeof L === 'number') ok(L < 0 ? v >= L : v <= L, `${id}: quirk ${k}=${v} beyond ${L}`);
        else ok(L === true, `${id}: quirk ${k} not allowed for this grade`);
        continue;
      }
      const lim = LIM[k];
      if (!ok(lim, `${id}: effect key ${k} has no §8.3.5 row`)) continue;
      let L = lim[c];
      if (k === 'glimPct' && c === 2 && T === 9) L = 25;
      if (id === 'w_greatsword_sr_frenzy') L = 50;
      if (L === 'T') L = T; else if (L === '2T') L = 2 * T;
      if (!ok(L !== null && L !== undefined, `${id}: ${k} not allowed for class ${c}`)) continue;
      if (L === true) { ok(v === true, `${id}: ${k} must be true`); continue; }
      if (typeof v === 'object') for (const [kk, x] of Object.entries(v)) ok(Math.abs(x) <= L, `${id}: ${k}.${kk}=${x} > ${L}`);
      else ok(Math.abs(v) <= L, `${id}: ${k}=${v} > ${L}`);
    }
    // statsAdd quirk: −1 unit (rare) / −1〜2 units (super) of this tier
    for (const [k, v] of Object.entries(r.statsAdd || {})) {
      const u1 = gearStat(T, 1, 'normal'), u2 = gearStat(T, 2, 'normal');
      ok(qcol === 0 ? v === -u1 : (v === -u1 || v === -u2), `${id}: statsAdd ${k}=${v} (1u ${u1}, 2u ${u2})`);
      // the desc says 「ただし〇が下がる」: the stat must really end below 0 (not a smaller plus on the unit's own stat)
      ok((it.stats || {})[k] < 0, `${id}: statsAdd ${k} lowers the item's own unit stat (stats ${JSON.stringify(it.stats)})`);
    }
    // off-weight stats only with a quirk; monster-chapter items use the §8.6.2 rule (checked by conformance)
    if (ARMOR.includes(it.type) && !MONSTER_CHAPTER.has(id))
      for (const u of unitsOf(it)) ok(WEIGHT_STATS[it.weight].includes(u.stat) || q.size > 0, `${id}: ${u.stat} on ${it.weight} without a quirk`);
  }
  ok(supersNoQuirk <= supers * 0.2, `supers without a quirk ${supersNoQuirk}/${supers} ≤ 20%`);
  if (VERBOSE) console.log(`     supers ${supers}, without quirk ${supersNoQuirk}`);
});

// ------------------------------------------------------------------ 5. two-handed
section('5 no twoHanded on armor / accessories', () => {
  for (const id of MINE) ok(!I(id).twoHanded && !raw[id].twoHanded, `${id}: twoHanded`);
});

// ------------------------------------------------------------------ 6. names and desc
function styleLists() {
  const L = fs.readFileSync(path.join(ROOT, 'STYLE_JA.md'), 'utf8').split('\n');
  const i1 = L.findIndex((l) => l.startsWith('### 7.1')), i2 = L.findIndex((l) => l.startsWith('### 7.2')), i3 = L.findIndex((l) => l.startsWith('### 7.3'));
  const words = (a, b) => L.slice(a, b).filter((l) => /^- .*`/.test(l) || /^`/.test(l)).flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].flatMap((m) => m[1].split(/\s+/))).filter(Boolean);
  const extra = (L.find((l) => l.includes('使ってよい常用外の字')) || '').replace(/（[^）]*）/g, '').split(/[:：]/).pop().split(/\s+/).filter((s) => s.length === 1);
  return { partial: words(i1 + 1, i2), exact: words(i2 + 1, i3), extra };
}
// §8.2.7 sentence forms (long / short) of the monster-chapter descs, without the final 「。」.
// E = element list 火・水…, S = status list, P = stat list, W = weapon-type name. atk / def / mdef (mods fixed values,
// no row in §8.2.7) use the §4 buff nouns: 攻撃力・守備力・術防が上がる.
const E_ = '(?:火|水|風|土|光|闇)(?:・(?:火|水|風|土|光|闇))*';
const S_ = '(?:毒|暗闇|眠り|まひ|沈黙|混乱|気絶|凍結|やけど|即死)(?:・(?:毒|暗闇|眠り|まひ|沈黙|混乱|気絶|凍結|やけど|即死))*';
const P_ = '(?:腕力|体力|器用さ|素早さ|知力|精神)';
const W_ = '(?:剣|大剣|短剣|斧|槍|弓|棍棒|杖|刀|体術|鞭)';
const DESC_FORMS = [
  `${E_}のダメージを(?:少し)?減らす`, `${E_}に(?:少し)?強い`, `${E_}の攻撃を受けない`, `${E_}が効かない`, `${E_}の攻撃を吸い取る`, `${E_}を吸う`,
  `ただし${E_}に弱(?:くなる|い)`, `${E_}にも弱くなる`, `${E_}の攻撃が強くなる`, `${E_}が強くなる`,
  `${S_}が効かない`, `${S_}にかかりにくい`, `ただし${S_}に弱い`,
  `${P_}(?:と${P_})?が(?:割合で)?上がる`, '最大(?:HP|MP|WP)が上がる', '戦闘中、(?:HP|MP|WP|MPとWP)が少しずつ戻る', '(?:HP|MP|WP)が戻る',
  '戦闘の始めに(?:攻撃|守り|素早さ|術力|術防)が上がる', '始めに(?:攻撃|守り)が上がる',
  '物理攻撃の威力が上がる', '術の威力が上がる', '物理が強くなる', '術が強くなる', '回復の(?:術|道具)がよく効く',
  '(?:術の)?MPの消費が減る', '(?:技の)?WPの消費が減る', 'ただし(?:術の)?MPの消費が増える', 'ただし(?:技の)?WPの消費が増える', '術力が上がる',
  '(?:技|術|技と術)を閃きやすい', '閃きやすい', `${E_}の術を閃きやすい`, `${W_}の技を閃きやすい`, `(?:${E_}|${W_})の熟練度が伸びやすい`,
  // A1.3 / STYLE_JA §8: the on-screen word is アイテム (the same sentences as R.Rules.autoDesc)
  '魔物がアイテムを落としやすい', '(?:超)?レアアイテムを落としやすい', '(?:|レアを|超レアを)よく落とす', 'アイテムをよく落とす',
  '(?:手に入る)?お金が増える', '経験値が増える', '金色の魔物に出会いやすい', 'めずらしい魔物に出会いやすい',
  '魔物に(?:出会|会)いにくい', '魔物に出会いやすい', 'ただし魔物を呼ぶ', '盗みが成功しやすい', '逃げやすくなる', '先制しやすくなる',
  '攻撃が当たると、ついでに盗むことがある', 'ついでに盗む', 'すばやく動ける', 'すばやい', '攻撃をかわしやすい', 'かわしやすい',
  '倒れても一度だけ起き上がる', '攻撃を受けると反撃する', '反撃する', '毒の沼や熱い床で傷つかない', '会心が出やすい', 'よく当たる',
  '(?:攻撃力|守備力|術防)が上がる',
  'ただし(?:守備力|術防|最大HP)が下がる', 'ただし受けるダメージが増える', 'ただし受ける傷が増える', 'ただし(?:術|技)が使えない', 'ただし戦闘中にHPが減る',
  'ただし動きが遅くなる', 'ただし経験値が減る', 'ただしお金が減る', 'ただしかわしにくい', 'ただし当たりにくい', 'ただし(?:技|術)?を?閃きにくい', 'ただし守備と術防は0', `ただし${P_}が下がる`, `(?:${P_}|最大HP|守備力|術防)も下がる`,
].map((s) => new RegExp(`^${s}$`));
const QUIRK_TAIL = new RegExp(`^(?:ただし|${E_}にも|(?:${P_}|最大HP|守備力|術防)も)`);
section('6 names ≤ 9 / unique / STYLE_JA §7 / jōyō; desc 2 × 20', () => {
  const { partial, exact, extra } = styleLists();
  ok(partial.length > 100 && exact.length > 30, `STYLE_JA §7 lists parsed (${partial.length} / ${exact.length})`);
  const joyoFile = path.join(__dirname, 'lib', 'joyo.txt');
  const joyo = fs.existsSync(joyoFile) ? new Set([...fs.readFileSync(joyoFile, 'utf8').replace(/\s/g, '')]) : null;
  if (!joyo) warn('tools/lib/joyo.txt missing: jōyō check skipped');
  const allowed = new Set(extra);
  const KANJI = /[㐀-䶿一-鿿豈-﫿]/;
  const badKanji = (s) => [...s].filter((ch) => KANJI.test(ch) && joyo && !joyo.has(ch) && !allowed.has(ch));
  // display names of everything the player sees (V3): items, monsters, techs / spells / enemy actions
  const names = new Map();
  const note = (name, who) => { if (!name) return; if (!names.has(name)) names.set(name, []); names.get(name).push(who); };
  for (const [id, it] of Object.entries(DB.items)) note(it.name, 'item:' + id);
  for (const [id, m] of Object.entries(DB.monsters || {})) { note(m.name, 'mon:' + id); if (m.goldName) note(m.goldName, 'mon-gold:' + id); }
  for (const [id, a] of Object.entries(DB.actions || {})) note(a.name, 'act:' + id);
  for (const id of MINE) {
    const it = I(id), n = it.name;
    ok(typeof n === 'string' && width(n) <= 9 && [...n].length <= 9, `${id}: name "${n}" > 9`);
    const dup = names.get(n).filter((w) => w !== 'item:' + id);
    ok(!dup.length, `${id}: name "${n}" also used by ${dup.join(', ')}`);
    for (const w of partial) ok(!n.includes(w), `${id}: name "${n}" contains banned "${w}" (STYLE_JA §7.1)`);
    ok(!exact.includes(n), `${id}: name "${n}" is banned (STYLE_JA §7.2)`);
    ok(!badKanji(n).length, `${id}: name "${n}" uses non-jōyō ${badKanji(n).join('')}`);
    // desc
    const d = it.desc || '';
    const lines = d.split('\n');
    ok(lines.length <= 2 && lines.every((l) => width(l) <= 20 && l.length), `${id}: desc ${JSON.stringify(d)} (${lines.map(width).join('/')})`);
    ok(!badKanji(d).length, `${id}: desc uses non-jōyō ${badKanji(d).join('')}`);
    ok(!/にならない|眠りにする|まひにする|沈黙にする|混乱にする|気絶にする|凍結にする|暗闇にする|やけどにする|　|…(?!…)|魔法|呪文|麻痺|アクセサリー/.test(d.replace(/……/g, '')), `${id}: desc style ${JSON.stringify(d)}`);
    ok(/。$/.test(d.replace(/\n/g, '')), `${id}: desc must end with 。`);
    if (it.quirk) ok(/ただし/.test(d), `${id}: a quirk item's desc names the quirk with 「ただし」`);
    ok(!/品/.test(d), `${id}: on-screen text says アイテム, not 品 (STYLE_JA §8, A1.3): ${JSON.stringify(d)}`);
    // monster-chapter descs are written here (the tables of §8.4.4–§8.8 are copied and checked by conformance):
    // every sentence must be one of the §8.2.7 forms (long or short), effects first, then the 「ただし」 quirks
    if (MONSTER_CHAPTER.has(id)) {
      const sents = d.replace(/\n/g, '').split('。').filter(Boolean);
      const bad = sents.filter((s) => !DESC_FORMS.some((re) => re.test(s)));
      ok(!bad.length, `${id}: desc sentence(s) not in the §8.2.7 forms: ${bad.join(' / ')}`);
      const qi = sents.findIndex((s) => s.startsWith('ただし'));
      ok(qi < 0 || sents.slice(qi + 1).every((s) => QUIRK_TAIL.test(s)), `${id}: effects must come before the 「ただし」 quirk: ${JSON.stringify(d)}`);
    }
  }
});

// ------------------------------------------------------------------ 7. mods keys
const MOD_KEYS = new Set(('atk def mdef hit eva crit spd mag strPct vitPct dexPct agiPct intPct mndPct hpPct mpPct wpPct defPct mdefPct ' +
  'physPct magicPct healPct itemPct takenPct mpCostPct wpCostPct elemBoost elemResist statusImmune statusResist profPct glimPct expPct ' +
  'goldPct dropPct rarePct superPct rareEncPct goldenPct preemptPct escapePct stealPct autoSteal encounterPct regen mpRegen wpRegen ' +
  'startBuffs noSpell hpLoss autoRevive autoCounter walkHeal noFloorDamage').split(' '));
const ITEM_KEYS = new Set('name type grade tier desc price units line src exclusive unique quirk sort icon stats statsAdd mods weight def mdef eva'.split(' '));
section('7 mods keys and sub-keys (§3.3.16); item fields (§8.2.1)', () => {
  for (const id of MINE) {
    const it = I(id);
    for (const k of Object.keys(raw[id])) ok(ITEM_KEYS.has(k), `${id}: unknown item field '${k}'`);
    for (const [k, v] of Object.entries(it.mods || {})) {
      if (!ok(MOD_KEYS.has(k), `${id}: mods key '${k}' not in §3.3.16`)) continue;
      if (k === 'elemResist' || k === 'elemBoost') for (const e of Object.keys(v)) ok(ELEMENTS.includes(e), `${id}: ${k}.${e}`);
      if (k === 'statusResist') for (const s of Object.keys(v)) ok(STATUSES.includes(s), `${id}: ${k}.${s}`);
      if (k === 'statusImmune') { ok(Array.isArray(v), `${id}: statusImmune must be a list`); for (const s of v) ok(STATUSES.includes(s), `${id}: statusImmune ${s}`); }
      if (k === 'glimPct') for (const g of Object.keys(v)) ok(['tech', 'spell', ...WTYPES, ...ELEMENTS].includes(g), `${id}: glimPct.${g}`);
      if (k === 'profPct') for (const g of Object.keys(v)) ok([...WTYPES, ...ELEMENTS].includes(g), `${id}: profPct.${g}`);
      if (k === 'startBuffs') for (const b of Object.keys(v)) ok(['atk', 'def', 'mag', 'mdef', 'agi'].includes(b), `${id}: startBuffs.${b}`);
      if (['regen', 'noSpell', 'noFloorDamage'].includes(k)) ok(v === true, `${id}: ${k} must be true`);
      if (!['elemResist', 'elemBoost', 'statusResist', 'statusImmune', 'glimPct', 'profPct', 'startBuffs', 'regen', 'noSpell', 'noFloorDamage'].includes(k))
        ok(typeof v === 'number' && isFinite(v), `${id}: ${k} must be a number`);
    }
    for (const [k, v] of Object.entries(raw[id].statsAdd || {})) ok(STATS.includes(k) && v < 0, `${id}: statsAdd ${k}=${v}`);
    ok(['normal', 'rare', 'super'].includes(it.grade), `${id}: grade ${it.grade}`);
    ok(Number.isInteger(it.tier) && it.tier >= 0 && it.tier <= 9, `${id}: tier ${it.tier}`);
    ok(['shop', 'drop', 'mdrop', 'super', 'relic', 'reward'].includes(it.src), `${id}: src ${it.src}`);
    if (ARMOR.includes(it.type)) ok(['heavy', 'light', 'cloth'].includes(it.weight), `${id}: weight ${it.weight}`);
    else ok(it.weight === undefined, `${id}: accessories have no weight`);
    if (it.src === 'super' || it.src === 'relic') ok(typeof it.exclusive === 'string' && it.exclusive.length > 0, `${id}: exclusive monster`);
    else ok(it.exclusive === undefined, `${id}: exclusive only on supers / relics`);
    ok(typeof it.sort === 'number' && isFinite(it.sort), `${id}: sort`);
  }
});

// ------------------------------------------------------------------ 8. sets and build multipliers
const stat = (id, k) => { const it = I(id); if (it && it.stats) return it.stats[k] || 0; return null; };
const SETS = {
  int: { base: 52, W: ['w_staff_8', 'mag', 94], key: 'int', fallback: { w: 'i2' },
    N: ['w_staff_8', 'w_staff_8', 'sh_book_8', 'hd_hat_8', 'bd_robe_8', 'hn_longglove_8', 'ft_slipper_8', 'ac_int_8', 'ac_int_8'],
    R7: ['w_staff_r7', 'w_staff_r7b', 'sh_r7_int', 'hd_r7_int', 'bd_r7_int', 'hn_r7_int', 'ft_r7_int', 'ac_r7_int', 'ac_r7_int'],
    R9: ['w_staff_r9', 'w_staff_r9b', 'sh_r9_int', 'hd_r9_int', 'bd_r9_int', 'hn_r9_int', 'ft_r9_int', 'ac_r9_int', 'ac_r9_int'],
    S: ['w_staff_sr_cosmos', 'w_staff_sr_moon', 'sh_sr_blank', 'hd_sr_dusk', 'bd_sr_starry', 'hn_sr_words', 'ft_sr_cloud', 'ac_sr_owl', 'ac_sr_ink'],
    table: [[52, 170], [112, 259], [166, 338], [196, 382], [232, 435]] },
  str: { base: 50, W: ['w_sword_8', 'atk', 94], key: 'str',
    N: ['w_sword_8', 'w_sword_8', 'sh_buckler_8', 'hd_helm_8', 'bd_mail_8', 'hn_gauntlet_8', 'ft_greave_8', 'ac_str_8', 'ac_str_8'],
    R7: ['w_sword_r7', 'w_axe_r7', 'sh_r7_str', 'hd_r7_str', 'bd_r7_str', 'hn_r7_str', 'ft_r7_str', 'ac_r7_str', 'ac_r7_str'],
    R9: ['w_sword_r9', 'w_axe_r9', 'sh_r9_str', 'hd_r9_str', 'bd_r9_str', 'hn_r9_str', 'ft_r9_str', 'ac_r9_str', 'ac_r9_str'],
    S: ['w_sword_sr_hegemon', 'w_axe_sr_titan', 'sh_sr_steadfast', 'hd_sr_oni', 'bd_sr_dragonhide', 'hn_sr_mighty', 'ft_sr_quake', 'ac_sr_beastheart', 'ac_sr_bloodoath'],
    table: [[50, 167], [110, 256], [164, 335], [194, 379], [230, 432]] },
  dex: { base: 54, W: ['w_dagger_8', 'atk', 71], key: 'dex',
    N: ['w_dagger_8', 'w_dagger_8', 'sh_shield_8', 'hd_cap_8', 'bd_vest_8', 'hn_glove_8', 'ft_boots_8', 'ac_dex_8', 'ac_dex_8'],
    R7: ['w_dagger_r7', 'w_dagger_r7', 'sh_r7_dex', 'hd_r7_dex', 'bd_r7_dex', 'hn_r7_dex', 'ft_r7_dex', 'ac_r7_dex', 'ac_r7_dex'],
    R9: ['w_dagger_r9', 'w_dagger_r9', 'sh_r9_dex', 'hd_r9_dex', 'bd_r9_dex', 'hn_r9_dex', 'ft_r9_dex', 'ac_r9_dex', 'ac_r9_dex'],
    S: ['w_dagger_sr_moonfang', 'w_whip_sr_silk', 'sh_sr_phantom', 'hd_sr_heaveneye', 'bd_sr_shadow', 'hn_sr_hundred', 'ft_sr_whirl', 'ac_sr_eagle', 'ac_sr_needle'],
    table: [[54, 131], [114, 197], [168, 257], [198, 291], [234, 331]] },
};
// weapons are weapons' (A9) items: use them when loaded, else the §8.3.1 value of their grade (2 units at the tier)
const WEAPON_FALLBACK = (id) => { const T = +(id.match(/_(\d)$/) || id.match(/_r(\d)/) || [0, 8])[1]; return gearStat(T, 2, /_sr_/.test(id) ? 'super' : /_r\d/.test(id) ? 'rare' : 'normal'); };
section('8 T8 super sets, T7 / T9 rare sets, §8.13.1 multipliers (D1 D2 D3)', () => {
  const POS = ['weapon', 'weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc', 'acc'];
  let weaponsMissing = 0;
  for (const [name, S] of Object.entries(SETS)) {
    const rows = [];
    for (const [ri, set] of [[], S.N, S.R7, S.R9, S.S].entries()) {
      let sum = 0;
      set.forEach((id, i) => {
        const isW = id.startsWith('w_');
        let v = stat(id, S.key);
        if (isW && v === null) { weaponsMissing++; v = WEAPON_FALLBACK(id); }
        if (!isW) {
          if (!ok(I(id), `${name} set: ${id} missing`)) return;
          ok(I(id).type === POS[i], `${name} set: ${id} is ${I(id).type}, position ${POS[i]}`);
        } else if (I(id)) ok(I(id).type === 'weapon', `${name} set: ${id} must be a weapon`);
        sum += v || 0;
      });
      const W = (I(S.W[0]) && I(S.W[0])[S.W[1]]) || S.W[2];
      const st = S.base + sum;
      const power = Math.round(W * (64 + st) / 64);
      rows.push([st, power]);
      ok(st === S.table[ri][0] && power === S.table[ri][1], `${name} ${['Z', 'N', 'R7', 'R9', 'S'][ri]}: ${S.key} ${st} → ${power} (§8.13.1 ${S.table[ri].join(' → ')})`);
    }
    const [Z, N, , , Sx] = rows.map((r) => r[1]);
    ok(Sx / Z >= 2.4 && Sx / Z <= 2.7, `${name}: S/Z ${(Sx / Z).toFixed(2)} in 2.4–2.7 (D1/D2)`);
    ok(Sx / N >= 1.6 && Sx / N <= 1.75, `${name}: S/N ${(Sx / N).toFixed(2)} in 1.6–1.75 (D1/D2)`);
    console.log(`     ${name.padEnd(3)} Z/N/R7/R9/S = ${rows.map((r) => `${r[0]}→${r[1]}`).join('  ')}   S/Z ${(Sx / Z).toFixed(2)}  S/N ${(Sx / N).toFixed(2)}`);
    // exclusive supers of the T8 set: tier 8, super
    for (const id of S.S) if (I(id) && !id.startsWith('w_')) ok(I(id).tier === 8 && I(id).grade === 'super' && I(id).src === 'super', `${name} S set ${id}: T8 super`);
    // physPct + magicPct ≤ 30 and mag ≤ 16 inside one T8 set (§8.3.4, 0.9)
    const sumMod = (k) => S.S.reduce((a, id) => a + ((I(id) && I(id).mods && I(id).mods[k]) || 0), 0);
    ok(sumMod('physPct') + sumMod('magicPct') <= 30 && sumMod('mag') <= 16, `${name} S set: physPct+magicPct ${sumMod('physPct') + sumMod('magicPct')} ≤ 30, mag ${sumMod('mag')} ≤ 16`);
  }
  // the exported sets (R.GearA.BUILD_SETS, for qa's party_model) are these sets
  for (const [name, S] of Object.entries(SETS)) for (const k of ['N', 'R7', 'R9', 'S'])
    ok(R.GearA && R.GearA.BUILD_SETS && JSON.stringify(R.GearA.BUILD_SETS[name][k]) === JSON.stringify(S[k]), `R.GearA.BUILD_SETS.${name}.${k}`);
  if (weaponsMissing) warn(`${weaponsMissing} set weapons not loaded (weapons A9): used the §8.3.1 value`);
  // T7 / T9 band rares: 3 builds × body / head / shield / hands / feet / accessory (§8.5)
  for (const T of [7, 9]) for (const b of ['str', 'dex', 'int'])
    for (const p of ['bd', 'hd', 'sh', 'hn', 'ft', 'ac']) ok(I(`${p}_r${T}_${b}`) && I(`${p}_r${T}_${b}`).src === 'drop', `band T${T} ${b}: ${p}_r${T}_${b}`);
  // every tier has a normal item of every stat in every slot (the N sets of any build, §8.0 0.1)
  for (let T = 0; T <= 9; T++) for (const type of [...ARMOR, 'acc']) for (const k of STATS)
    ok(MINE.some((id) => I(id).tier === T && I(id).type === type && I(id).grade === 'normal' && I(id).units && unitsOf(I(id))[0].stat === k), `T${T} ${type}: a normal ${k} item`);
  // D3: cloth vs heavy set at T8 against DK(54) = 310
  const defSum = (ids) => ids.reduce((a, id) => a + I(id).def, 0);
  const cloth = defSum(['bd_robe_8', 'hd_hat_8', 'sh_book_8', 'hn_longglove_8', 'ft_slipper_8']);
  const heavy = defSum(['bd_mail_8', 'hd_helm_8', 'sh_buckler_8', 'hn_gauntlet_8', 'ft_greave_8']);
  const DK = 40 + 5 * 54, ratio = (DK + heavy) / (DK + cloth);
  ok(cloth === 125 && heavy === 311 && ratio >= 1.35, `D3: cloth ${cloth} / heavy ${heavy} → physical taken ×${ratio.toFixed(3)} (≥ 1.35)`);
  console.log(`     D3 cloth set def ${cloth}, heavy ${heavy}: the caster takes ×${ratio.toFixed(2)} physical`);
});

// ------------------------------------------------------------------ + status defences (§8.13.3)
section('+ status defences for every bad state (§8.13.3)', () => {
  const has = (pred) => MINE.filter((id) => pred(I(id)));
  for (const s of STATUSES) {
    const normal = has((it) => it.grade === 'normal' && it.mods && it.mods.statusResist && it.mods.statusResist[s] >= 0.5);
    const rare = has((it) => ['drop', 'reward'].includes(it.src) && it.mods && (it.mods.statusImmune || []).includes(s));
    const high = has((it) => ['relic', 'super', 'mdrop'].includes(it.src) && it.mods && ((it.mods.statusImmune || []).includes(s) || (it.mods.statusResist && it.mods.statusResist[s] > 0)));
    ok(normal.includes(`ac_ward_${s}`), `${s}: normal ward ac_ward_${s}`);
    ok(rare.length >= 1, `${s}: a band rare / reward that blocks it (${rare.join(' ')})`);
    ok(high.length >= 1 || ['blind', 'burn'].includes(s), `${s}: a relic / monster item against it (${high.join(' ')})`);
    if (VERBOSE) console.log(`     ${s.padEnd(8)} normal ${normal.join(' ')} | rare ${rare.join(' ')} | relic/super ${high.slice(0, 6).join(' ')}${high.length > 6 ? ' …' : ''}`);
  }
  const TABLE = { poison: 'ac_r5_poison', blind: 'ac_r3_blind', sleep: 'ac_r7_sleep', paralyze: 'ac_r5_para', silence: 'ft_r7_int', confuse: 'ac_r7_confuse',
    stun: 'bd_r3_vit', freeze: 'ac_r5_freeze', burn: 'ac_r5_burn', death: 'ac_r9_death' };
  for (const [s, id] of Object.entries(TABLE)) ok(I(id) && (I(id).mods.statusImmune || []).includes(s), `${id} blocks ${s}`);
});

// ------------------------------------------------------------------ + rare hunting and the caps (§8.13.2, §8.3.5)
section('+ rare-hunting build and the stacking caps (through R.Rules.mods / partyMods)', () => {
  const sum = (ids, k) => ids.reduce((a, id) => a + ((I(id).mods || {})[k] || 0), 0);
  const ACC = { hero: ['ac_sr_coin', 'ac_rs_clover'], noela: ['ac_rl_clover', 'ac_clover'], boden: ['ac_sr_greedy', 'ac_r3_drop'], ferno: ['ac_sr_cursed_lock', 'ac_tale_star'] };
  const all = Object.values(ACC).flat();
  const innate = (id, k) => (DB.companions && DB.companions[id] && DB.companions[id].innate && DB.companions[id].innate.mods[k]) || 0;
  const drop = sum(all, 'dropPct') + innate('boden', 'dropPct'), rare = sum(all, 'rarePct') + innate('noela', 'rarePct'), sup = sum(all, 'superPct') + innate('ferno', 'superPct');
  ok(drop === 60 && rare === 150 && sup === 100, `§8.13.2 sums: drop ${drop}/60, rare ${rare}/150, super ${sup}/100`);
  ok(Math.max(...MINE.map((id) => ((I(id).mods || {}).rarePct || 0))) <= 30, 'one item gives at most +30 rarePct');
  console.log(`     rare hunt (8 accessories + innate): dropPct +${drop} (1/8 → ${(100 / 8 * (1 + drop / 100)).toFixed(1)}%), rarePct +${rare} (1/32 → 1/${(32 / (1 + Math.min(150, rare) / 100)).toFixed(1)}), superPct +${sup} (1/256 → 1/${(256 / (1 + sup / 100)).toFixed(0)})`);
  if (!(R.Rules && typeof R.Rules.mods === 'function' && typeof R.Rules.partyMods === 'function')) { warn('R.Rules.mods / partyMods missing: cap checks skipped'); return; }
  const mk = (id, accs, extra) => Object.assign({ id, heroType: 'warrior', hp: 100, equip: { weapon1: null, weapon2: null, shield: null, head: null, body: null, hands: null, feet: null, acc1: accs[0] || null, acc2: accs[1] || null } }, extra || {});
  const party = [mk('hero', ACC.hero), mk('noela', ACC.noela), mk('boden', ACC.boden), mk('ferno', ACC.ferno)];
  const pm = R.Rules.partyMods(party);
  ok(pm.rarePct === 150, `partyMods rarePct ${pm.rarePct} = cap 150`);
  ok(pm.superPct === 100 && pm.dropPct === 60, `partyMods superPct ${pm.superPct} / dropPct ${pm.dropPct}`);
  // more than the cap: two coins + clovers on everyone
  const over = [mk('hero', ['ac_sr_coin', 'ac_rs_clover']), mk('noela', ['ac_rs_clover', 'ac_sr_coin']), mk('boden', ['ac_sr_greedy', 'ac_rl_clover']), mk('ferno', ['ac_sr_cursed_lock', 'ac_rs_clover'])];
  const po = R.Rules.partyMods(over);
  ok(po.rarePct === 150 && po.superPct <= 150, `stacked past the cap: rarePct ${po.rarePct} (150), superPct ${po.superPct}`);
  // per-person caps: glimPct +40 per key, profPct +50, expPct +30, cost −50, encounter ±50, autoSteal 100
  const one = (accs, body) => R.Rules.mods(mk('hero', accs, body ? { equip: Object.assign(mk('hero', accs).equip, body) } : null));
  let m = one(['ac_sr_eagle', 'ac_rl_star'], { head: 'hd_r3_int', weapon1: null });
  ok(m.glimPct && m.glimPct.tech === 35, `glimPct tech 20+15 = ${m.glimPct && m.glimPct.tech}`);
  m = one(['ac_sr_ouroboros', 'ac_rs_star'], { head: 'hd_sr_dusk' });
  ok(m.glimPct && m.glimPct.spell === 40 && m.glimPct.tech === 40, `glimPct capped at 40 per key (spell ${m.glimPct && m.glimPct.spell}, tech ${m.glimPct && m.glimPct.tech})`);
  m = one(['ac_badge_sword', 'ac_badge_sword'], { hands: null });
  ok(m.profPct && m.profPct.sword === 40, `profPct sword 20+20 = ${m.profPct && m.profPct.sword}`);
  m = one(['ac_sr_first_letter', 'ac_spirit_fire']);
  ok(m.profPct && m.profPct.fire === 45, `profPct fire 25+20 = ${m.profPct && m.profPct.fire}`);
  m = one(['ac_sr_first_letter', 'ac_sr_first_letter'], { head: null });
  ok(m.profPct && m.profPct.fire === 50, `profPct capped at 50 (${m.profPct && m.profPct.fire})`);
  m = one(['ac_sr_platinum_heart', 'ac_silver_orb'], { head: null });
  ok(m.expPct === 30, `expPct 20+15 capped at 30 (${m.expPct})`);
  m = one(['ac_rival_pen', 'ac_hourglass_mp'], { hands: 'hn_r5_int', weapon1: 'w_staff_sr_moon' });
  ok(m.mpCostPct === -50, `mpCostPct −15−15−25−35 capped at −50 (${m.mpCostPct})`);
  m = one(['ac_quickhand', 'ac_quickhand'], { hands: 'hn_r1_dex' });
  ok(m.autoSteal === 100 && m.stealPct === 50, `easy steal: autoSteal ${m.autoSteal} (50+50, cap 100), stealPct ${m.stealPct}`);
  m = one(['ac_quiet', 'ac_rl_shadow'], { feet: 'ft_sr_ghost' });
  ok(m.encounterPct === -50, `encounterPct stacked −150 clamped to −50 (${m.encounterPct})`);
});

// ------------------------------------------------------------------ + proficiency / glimmer / steal items (§8.13.4, Part A5)
section('+ proficiency, glimmer and easy-steal accessories (§8.13.4, Part A5)', () => {
  for (const w of WTYPES) ok(I(`ac_badge_${w}`) && I(`ac_badge_${w}`).mods.profPct[w] === 20, `badge ${w}: profPct +20`);
  for (const e of ELEMENTS) { const it = I(`ac_spirit_${e}`); ok(it && it.mods.profPct[e] === 20 && it.mods.elemBoost[e] === 10, `spirit stone ${e}: profPct +20, elemBoost +10`); }
  ok(I('ac_glim_tech').mods.glimPct.tech === 10 && I('ac_glim_spell').mods.glimPct.spell === 10, 'glimmer feather / bell +10');
  ok(I('ac_otto_lantern').mods.glimPct.tech === 10 && I('ac_berna_charm').mods.glimPct.spell === 15, 'reward lantern +10, 語り部の首飾り +15');
  ok(I('ac_quickhand') && I('ac_quickhand').mods.autoSteal === 50 && I('ac_quickhand').grade === 'normal' && I('ac_quickhand').tier === 2, 'ac_quickhand 早業の指輪: autoSteal 50 in shops from T2');
  ok(I('hn_r1_dex').mods.stealPct === 50 && I('ac_pouch').mods.stealPct === 50, 'くすね屋の手袋 / すりの小袋 stealPct +50');
  const glimItems = MINE.filter((id) => I(id).mods && I(id).mods.glimPct).length, profItems = MINE.filter((id) => I(id).mods && I(id).mods.profPct).length;
  console.log(`     glimPct items ${glimItems}, profPct items ${profItems}, stealPct / autoSteal items ${MINE.filter((id) => I(id).mods && (I(id).mods.stealPct || I(id).mods.autoSteal)).length}`);
});

// ------------------------------------------------------------------ + spec conformance (DESIGN tables)
section('+ conformance with the DESIGN tables (tools/check_gear-a.js)', () => {
  const errs = CG.conformance(JSON.parse(JSON.stringify(raw)), Object.fromEntries(MINE.map((id) => [id, I(id)])));
  for (const e of errs) ok(false, 'spec: ' + e);
  ok(true, 'conformance ran');
});

// ------------------------------------------------------------------ + monster links (the assignment is mons / boss; reported, not failed)
section('+ monster links (info: §9.12 assignment belongs to A11 / A12)', () => {
  if (!Object.keys(DB.monsters || {}).length) { warn('no DB.monsters: monster links not checked'); return; }
  const slots = {};
  for (const [mid, m] of Object.entries(DB.monsters)) for (const [slot, d] of Object.entries(m.drops || {})) if (d && d.item) (slots[d.item] = slots[d.item] || []).push(`${mid}.${slot}`);
  const S = CG.spec();
  let bad = 0;
  for (const id of MINE) {
    const it = I(id), where = slots[id] || [];
    if (it.src === 'super') {
      const want = [`${it.exclusive}.super`];
      if (JSON.stringify(where) !== JSON.stringify(want)) { bad++; warn(`${id}: super slot ${JSON.stringify(where)} ≠ ${want}`); }
      const lin = DB.monsters[it.exclusive] && DB.monsters[it.exclusive].lineage;
      if (lin && S.lineageStages[lin]) { const t = CG.srTier(S, it.exclusive); if (t !== it.tier) { bad++; warn(`${id}: tier ${it.tier} ≠ srTier(${it.exclusive}) ${t}`); } }
    } else if (it.src === 'mdrop') {
      const mons = where.filter((w) => w.endsWith('.rare')).map((w) => w.split('.')[0]);
      if (!mons.length || mons.length > 3 || where.some((w) => !w.endsWith('.rare'))) { bad++; warn(`${id}: monster rare slots ${JSON.stringify(where)}`); }
      for (const mid of mons) if (DB.monsters[mid].lineage) { const t = CG.band(CG.srTier(S, mid)); if (t !== it.tier) { bad++; warn(`${id}: tier ${it.tier} ≠ band(srTier(${mid})) ${t}`); } }
    } else if (it.src === 'relic') {
      const want = `${it.exclusive}.${it.grade === 'rare' ? 'rare' : 'super'}`;
      if (JSON.stringify(where) !== JSON.stringify([want])) { bad++; warn(`${id}: relic slot ${JSON.stringify(where)} ≠ ${want}`); }
    } else if (where.length && (it.src === 'drop' || it.src === 'shop' || it.src === 'reward')) { bad++; warn(`${id} (${it.src}) is in monster slots ${where}`); }
  }
  console.log(`     ${bad ? bad + ' link problems (see warnings)' : 'every super / monster rare / relic sits in its monster slot'}`);
  ok(true, 'links reported');
});

// ------------------------------------------------------------------ result
if (warns.length) { console.log(`warnings (${warns.length}):`); for (const w of warns.slice(0, 40)) console.log('  ! ' + w); if (warns.length > 40) console.log(`  … ${warns.length - 40} more`); }
if (fails.length) { console.log(`FAILURES (${fails.length}):`); for (const f of fails.slice(0, 60)) console.log('  ✗ ' + f); if (fails.length > 60) console.log(`  … ${fails.length - 60} more`); }
console.log(`test_gear: ${pass} passed, ${fail} failed${warns.length ? `, ${warns.length} warnings` : ''}`);
process.exit(fail ? 1 : 0);
