#!/usr/bin/env node
// Conformance check for rules A1: the numbers R.Rules computes against the tables in
// DESIGN.md (parsed from the spec itself), and the real data against the rules' needs
// (character data, gear numbers, mods keys, shops, pools, warps). Exit 1 on an error.
//   node tools/check_rules.js         errors + warnings
//   node tools/check_rules.js -q      errors only
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./lib/load')({ quiet: true });
const QUIET = process.argv.includes('-q');
const DB = R.DB, Ru = R.Rules, K = Ru.K;
const SPEC = fs.readFileSync(path.join(__dirname, '..', 'DESIGN.md'), 'utf8');
const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
let checks = 0;
const expect = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) err(`${what}: got ${JSON.stringify(got)}, spec ${JSON.stringify(want)}`); };

/** the lines of a DESIGN section, from its heading to the next heading of the same or higher level */
function section(title) {
  const lines = SPEC.split('\n');
  const i = lines.findIndex((l) => /^#+ /.test(l) && l.includes(title));
  if (i < 0) { err('DESIGN.md: section not found: ' + title); return []; }
  const lvl = lines[i].match(/^#+/)[0].length;
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].match(/^(#+) /);
    if (m && m[1].length <= lvl) break;
    out.push(lines[j]);
  }
  return out;
}
const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
const num = (s) => +String(s).replace(/−/g, '-').replace(/[^\d.\-]/g, '');
// design/build/SYSTEMS_REWORK.md on top of DESIGN until the lead folds it in (phase 4): A18 (no WP, growth hp/mp §2.3),
// A19 (7 weapon types §3.1, the letters of §3.5). Once DESIGN carries the new tables these overlays change nothing.
const RW = (() => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'design', 'build', 'SYSTEMS_REWORK.md'), 'utf8').split('\n');
  const HERO = { '主人公 warrior': 'warrior', '主人公 ranger': 'ranger', '主人公 mage': 'mage', '主人公 spellblade': 'spellblade', '主人公 wanderer': 'wanderer' };
  const growth = {}, apt = {};
  const i23 = md.findIndex((l) => l.startsWith('### 2.3')), i24 = md.findIndex((l) => l.startsWith('### 2.4'));
  for (const l of md.slice(i23, i24)) {
    if (!/^\| /.test(l) || /^\| id /.test(l) || /^\|---/.test(l)) continue;
    const c = cells(l);
    for (const [idc, nw] of [[c[0], c[2]], [c[4], c[6]]]) {
      if (!idc || !nw) continue;
      if (idc.includes(' / ')) {
        const ids = idc.split(' / ').map((x) => x.trim()), vals = nw.split(' / ').map((x) => x.trim());
        ids.forEach((x, k) => { growth[x] = (vals[k] || vals[0]).split(' '); });
      } else growth[HERO[idc] || idc] = nw.split(' ');
    }
  }
  const i35 = md.findIndex((l) => l.startsWith('### 3.5')), i36 = md.findIndex((l) => l.startsWith('### 3.6'));
  for (const l of md.slice(i35, i36)) {
    const m = l.match(/^\| ([a-z]+|主人公 [a-z]+) \| [SABCD ]+ \| \*\*([SABCD ]+)\*\*/);
    if (m) apt[HERO[m[1]] || m[1]] = m[2].trim().split(' ');
  }
  return { growth, apt, removed: ['club', 'katana', 'whip'], reach: { staff: true } };
})();

// ---------------------------------------------------------- §4.2.2 curve table
{
  const rows = section('4.2.2 レベルと HP・MP・WP').filter((l) => /^\| \d/.test(l));
  let n = 0;
  for (const l of rows) {
    const c = cells(l);
    for (const off of [0, 5]) {
      if (!c[off] || isNaN(num(c[off]))) continue;
      const L = num(c[off]);
      expect(['hp', 'mp'].map((k) => Math.round(Ru.lvCurve(k, L))), [num(c[off + 1]), num(c[off + 2])], `§4.2.2 HPlv/MPlv L${L} (WP gone, SYSTEMS_REWORK A18)`);
      n++;
    }
  }
  if (n < 10) err('§4.2.2 table rows parsed: ' + n);
}
// ---------------------------------------------------------- §4.2.3 EXP table
{
  const rows = section('4.2.3 経験値').filter((l) => /^\| \d/.test(l));
  let n = 0;
  for (const l of rows) {
    const c = cells(l);
    for (const off of [0, 4]) {
      if (!c[off] || isNaN(num(c[off]))) continue;
      const L = num(c[off]);
      expect([Ru.need(L), Ru.expForLevel(L)], [num(c[off + 1]), num(c[off + 2])], `§4.2.3 need/累計 L${L}`);
      n++;
    }
  }
  if (n < 10) err('§4.2.3 table rows parsed: ' + n);
}
// ---------------------------------------------------------- §4.3.1 tier table
{
  const rows = section('4.3.1 ティア表').filter((l) => /^\| \d/.test(l));
  for (const l of rows) {
    const c = cells(l);
    const T = num(c[0]);
    expect([K.LZ(T), K.W[T], K.U[T], K.D(T)], [num(c[1]), num(c[2]), num(c[3]), num(c[7])], `§4.3.1 LZ/W/U/D T${T}`);
    expect(['normal', 'rare', 'super'].map((g) => Ru.gearStat(T, 1, g)).join('/'), c[4], `§4.3.1 1単位 T${T}`);
    expect(['normal', 'rare', 'super'].map((g) => Ru.gearStat(T, 2, g)).join('/'), c[5], `§4.3.1 2単位 T${T}`);
  }
  if (rows.length !== 10) err('§4.3.1 rows ' + rows.length);
}
// ---------------------------------------------------------- §4.3.4 weapon types
{
  const rows = section('4.3.4 武器系統の表').filter((l) => /^\| [a-z]+ [^|\s]/.test(l));
  const statOf = { 腕力: ['str'], 器用さ: ['dex'], '(腕力+器用さ)/2': ['str', 'dex'], '(腕力+知力)/2': ['str', 'int'], '(腕力+素早さ)/2': ['str', 'agi'] };
  for (const l of rows) {
    const c = cells(l);
    const w = c[0].split(' ')[0];
    const T = K.WTYPE[w];
    if (RW.removed.includes(w)) { if (T) err(`§4.3.4 ${w} is gone (SYSTEMS_REWORK §3.1) but still in K.WTYPE`); continue; }
    if (!T) { err('§4.3.4 unknown type ' + w); continue; }
    expect([T.twoHanded, T.reach, T.mult, T.hit, T.crit], [c[1] === '両手', RW.reach[w] || c[2] === '○', num(c[4]), num(c[5]), num(c[6])], `§4.3.4 ${w}`);
    expect(T.stat, statOf[c[7]], `§4.3.4 ${w} stat`);
    expect(T.magMult, /1\.0/.test(c[8]) ? 1 : 0.5, `§4.3.4 ${w} mag`);
    expect(T.kind, { 斬: 'slash', 打: 'blunt', 突: 'pierce' }[c[3]], `§4.3.4 ${w} kind`);
  }
  if (rows.length !== 11) err('§4.3.4 rows ' + rows.length);
  expect(Ru.WTYPES.length, 7, 'SYSTEMS_REWORK §3.1 7 types');
}
// ---------------------------------------------------------- §4.3.7 build ratios
{
  const mag = (int) => Math.round(94 * (64 + int) / 64);
  expect([mag(52), mag(112), mag(172), mag(232)], [170, 259, 347, 435], '§4.3.7 術力 Z/N/R/S');
  const atk = (str) => Math.round(94 * (64 + str) / 64);
  expect([atk(50), atk(110), atk(230)], [167, 256, 432], '§4.3.7 攻撃力 Z/N/S');
  expect([Ru.gearStat(8, 1, 'normal') * 12, Ru.gearStat(8, 1, 'super') * 12], [60, 180], '§4.3.7 12 units at T8');
}
// ---------------------------------------------------------- §8.3.8 prices
{
  const rows = section('8.3.8 値段').filter((l) => /^\| \d/.test(l));
  for (const l of rows) {
    const c = cells(l);
    const T = num(c[0]);
    const got = ['body', 'head', 'shield', 'hands', 'feet', 'acc'].map((type) => Ru.fillItem({ type, tier: T, grade: 'normal', weight: 'light', units: type === 'acc' ? 'i1' : 'v1' }).price);
    expect(got, c.slice(1, 7).map(num), `§8.3.8 prices T${T}`);
  }
  if (rows.length !== 10) err('§8.3.8 rows ' + rows.length);
}
// ---------------------------------------------------------- §4.14.2 curve
{
  const rows = section('4.14.2 魔物の能力値の曲線').filter((l) => /^\| \d/.test(l));
  for (const l of rows) {
    const c = cells(l);
    for (const off of [0, 8]) {
      if (!c[off] || isNaN(num(c[off]))) continue;
      const L = num(c[off]), v = K.curve(L);
      expect(['hp', 'atk', 'def', 'agi', 'exp', 'gold'].map((k) => Math.round(v[k])), c.slice(off + 1, off + 7).map(num), `§4.14.2 curve L${L}`);
    }
  }
}
// ---------------------------------------------------------- §5.3.2 companion table
if (Object.keys(DB.companions).length) {
  const rows = section('5.3.2 能力値と成長').filter((l) => /^\| `[a-z]+`/.test(l));
  for (const l of rows) {
    const c = cells(l);
    const id = c[0].replace(/`/g, '');
    const D = DB.companions[id];
    if (!D) { err('§5.3.2 companion missing in data: ' + id); continue; }
    expect(Ru.STATS.map((k) => D.stats[k]), c.slice(2, 8).map(num), `§5.3.2 ${id} stats`);
    const G = RW.growth[id] || [c[9], c[10]];
    expect([D.growth.hp, D.growth.mp], G, `§5.3.2 ${id} growth (SYSTEMS_REWORK §2.3)`);
    if ('wp' in D.growth) err(`§5.3.2 ${id} growth still has wp`);
    // HP only where the hp letter kept its DESIGN value (MP follows the new letters and curve)
    const at = (L) => { const x = Ru.newChar({ id, level: L }); x.equip = Ru.emptyEquip(); return String(Ru.stats(x).hp); };
    if (G[0] === c[9]) expect([at(1), at(24), at(54)], [c[12], c[13], c[14]].map((v) => v.split(' / ')[0].trim()), `§5.3.2 ${id} HP`);
  }
  if (rows.length !== 20) err('§5.3.2 rows ' + rows.length);
}
// ---------------------------------------------------------- §5.3.3 aptitudes
if (Object.keys(DB.companions).length) {
  const rows = section('5.3.3 得手不得手').filter((l) => /^\| `[a-z]+`/.test(l));
  for (const l of rows) {
    const c = cells(l).map((x) => x.replace(/\*/g, ''));
    const id = c[0].replace(/`/g, '');
    const L = Ru.aptLetters(Ru.newChar({ id }));
    expect(Ru.WTYPES.map((w) => L.w[w]), RW.apt[id] || c.slice(2, 13), `§5.3.3 ${id} weapons (SYSTEMS_REWORK §3.5)`);
    expect(Ru.ELEMENTS.map((e) => L.e[e]), c.slice(14, 20), `§5.3.3 ${id} elements`);
  }
}

// ---------------------------------------------------------- data vs rules
const MOD_KEYS = new Set(('atk def mdef hit eva crit spd mag strPct vitPct dexPct agiPct intPct mndPct hpPct mpPct defPct mdefPct ' +
  'physPct magicPct healPct itemPct takenPct mpCostPct techCostPct elemBoost elemResist statusImmune statusResist profPct glimPct expPct ' +
  'goldPct dropPct rarePct superPct rareEncPct goldenPct preemptPct escapePct stealPct autoSteal encounterPct regen mpRegen ' +
  'startBuffs noSpell hpLoss autoRevive autoCounter walkHeal noFloorDamage').split(' '));
const modsOk = (m, where) => { for (const k in m || {}) { checks++; if (!MOD_KEYS.has(k)) err(`${where}: mods key ${k} is not in §3.3.16`); } };
for (const id in DB.heroTypes) {
  const T = DB.heroTypes[id];
  for (const k of Ru.STATS) if (!(T.stats && T.stats[k] >= 10 && T.stats[k] <= 60)) err(`heroType ${id}: stat ${k} out of 10..60`);
  for (const k of ['hp', 'mp']) if (!Ru.LETTERS.includes(T.growth && T.growth[k])) err(`heroType ${id}: growth ${k}`);
  for (const w of Ru.WTYPES) if (!Ru.LETTERS.includes(T.apt && T.apt.w && T.apt.w[w])) err(`heroType ${id}: apt ${w}`);
  for (const e of Ru.ELEMENTS) if (!Ru.LETTERS.includes(T.apt && T.apt.e && T.apt.e[e])) err(`heroType ${id}: apt ${e}`);
  if (T.defaultWeapon && !DB.items[T.defaultWeapon]) warn(`heroType ${id}: defaultWeapon ${T.defaultWeapon} missing`);
  for (const s in T.startEquip || {}) if (!DB.items[T.startEquip[s]]) warn(`heroType ${id}: startEquip ${T.startEquip[s]} missing`);
  modsOk(T.mods, 'heroType ' + id);
}
for (const id in DB.companions) {
  const D = DB.companions[id];
  const c = Ru.newChar({ id });
  for (const s in D.startEquip || {}) {
    const it = D.startEquip[s];
    if (!Ru.SLOTS.includes(s)) err(`companion ${id}: startEquip slot ${s} is not one of the 9`);
    else if (!DB.items[it]) warn(`companion ${id}: startEquip ${it} missing`);
    else if (Ru.groupOfSlot(s) !== DB.items[it].type) err(`companion ${id}: ${it} does not fit ${s}`);
  }
  if (D.startEquip && D.startEquip.shield && ['weapon1', 'weapon2'].some((s) => D.startEquip[s] && Ru.isTwoHanded(D.startEquip[s]))) err(`companion ${id}: shield with a two-handed weapon`);
  for (const t of (D.startTechs || []).concat(D.startSpells || [])) if (!DB.actions[t]) warn(`companion ${id}: start action ${t} missing`);
  for (const t of D.startTechs || []) {
    const a = DB.actions[t];
    if (a && !Ru.WEAPON_SLOTS.some((s) => c.equip[s] && DB.items[c.equip[s]].wtype === a.wtype)) err(`companion ${id}: tech ${t} without a ${a.wtype} weapon`);
  }
  modsOk(D.innate && D.innate.mods, 'companion ' + id);
  checks++;
}
const EQ = Ru.EQUIP_TYPES;
let gear = 0;
for (const id in DB.items) {
  const it = DB.items[id];
  modsOk(it.mods, 'item ' + id);
  if (!EQ.includes(it.type)) continue;
  gear++;
  if (it.type === 'weapon') {
    if (!K.WTYPE[it.wtype]) err(`item ${id}: unknown wtype ${it.wtype}`);
    if (!(it.atk >= 0) || !(it.mag >= 0)) err(`item ${id}: atk/mag not filled (fillItem)`);
    if (K.WTYPE[it.wtype] && K.WTYPE[it.wtype].twoHanded && !Ru.isTwoHanded(id)) err(`item ${id}: two-handed type not two-handed`);
  } else if (it.type !== 'acc') {
    if (!K.WEIGHT[it.weight]) err(`item ${id}: weight ${it.weight}`);
    if (!(it.def >= 0) || !(it.mdef >= 0)) err(`item ${id}: def/mdef not filled`);
  }
  if (!(it.price >= 0)) err(`item ${id}: price not filled`);
  if (!(it.tier >= 0 && it.tier <= 9)) err(`item ${id}: tier ${it.tier}`);
  const d = String(it.desc || '');
  const lines = d.split('\n');
  if (!d) warn(`item ${id}: no desc`);
  if (lines.length > 2 || lines.some((l) => Ru.textWidth(l) > 20)) warn(`item ${id}: desc over 2 × 20: ${JSON.stringify(d)}`);
  if (it.stats) for (const k in it.stats) if (!Ru.STATS.includes(k)) err(`item ${id}: stats key ${k}`);
  // numbers of normal gear follow the tier table exactly (§4.3.2–§4.3.3)
  if (it.grade === 'normal' && it.src === 'shop' && it.units) {
    const ref = Ru.fillItem({ type: it.type, wtype: it.wtype, mult: it.mult, weight: it.weight, tier: it.tier, grade: 'normal', units: it.units });
    for (const k of ['atk', 'mag', 'def', 'mdef', 'price']) if (ref[k] !== undefined && it[k] !== ref[k]) warn(`item ${id}: ${k} ${it[k]} differs from the tier table ${ref[k]}`);
  }
}
checks += gear;
// shops at every tier, pools at every tier
{
  const g = R.State.newGame();
  for (const sid in DB.shops) {
    const s = DB.shops[sid];
    for (const id of (s.items || []).concat(...(s.stock || []).map((st) => st.items || []))) if (!DB.items[id]) err(`shop ${sid}: item ${id} missing`);
    for (let t = 0; t <= 8; t++) {
      g.tier = t;
      const list = R.Tier.shopItems(sid);
      checks++;
      if (!list.length && (s.stock || []).some((st) => (st.tier || 0) <= t && !st.cond)) err(`shop ${sid}: empty at tier ${t}`);
      for (const id of list) if (DB.items[id] && DB.items[id].grade && DB.items[id].grade !== 'normal') warn(`shop ${sid}: ${id} is not a normal item`);
    }
  }
  for (const pid in DB.pools) {
    const p = DB.pools[pid];
    if (!Array.isArray(p.tiers) || p.tiers.length !== 10) { err(`pool ${pid}: needs 10 tiers`); continue; }
    p.tiers.forEach((list, t) => {
      checks++;
      if (!list || !list.length) warn(`pool ${pid}: tier ${t} empty`);
      for (const e of list || []) if (!(e.gold > 0) && !DB.items[e.item]) err(`pool ${pid} T${t}: ${e.item} missing`);
    });
  }
  // innPrice
  if (DB.config.innPrice) expect(DB.config.innPrice, K.INN, 'DB.config.innPrice = K.INN');
  if (DB.config.defaultHero && !DB.heroTypes[DB.config.defaultHero.type]) err('DB.config.defaultHero.type missing');
}
// warp targets of every dungeon floor
for (const mid in DB.maps) {
  const d = DB.maps[mid];
  if (d.type === 'dungeon') { checks++; if (!R.State.dungeonLocation(d)) warn(`map ${mid}: no warp target (location / escape.spawn)`); }
}

console.log(`check_rules: ${checks} checks, ${errors.length} errors, ${warns.length} warnings`);
for (const e of errors.slice(0, 60)) console.log('  ERROR ' + e);
if (errors.length > 60) console.log(`  … ${errors.length - 60} more errors`);
if (!QUIET) { for (const w of warns.slice(0, 40)) console.log('  warn  ' + w); if (warns.length > 40) console.log(`  … ${warns.length - 40} more warnings`); }
process.exit(errors.length ? 1 : 0);
