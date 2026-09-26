#!/usr/bin/env node
// newgame (A6) conformance check: the character data against DESIGN §5 (the §5.7 validate list, the
// §5.2〜§5.3 tables, the §5.4.4 counts) and the screen text of the newgame files against STYLE_JA.
// design/build/SYSTEMS_REWORK.md is applied on top of DESIGN §5 (A18 §2.3 growth hp/mp, A19 §3.5 the 7 weapon letters,
// the starting gear and techs, 3 profile lines; lead: ザフィラ front row) until the lead folds it into DESIGN (§4.2-4).
//   node tools/check_newgame.js [-v]      exit 1 on any error (warnings are only counted)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true });
const DB = R.DB;
const MD = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8').split('\n');

let errors = 0, warns = 0, checks = 0;
const err = (m) => { errors++; console.log('  ERROR ' + m); };
const warn = (m) => { warns++; console.log('  warn  ' + m); };
function check(cond, m) { checks++; if (!cond) err(m); else if (VERBOSE) console.log('  ok    ' + m); return cond; }

const W = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff'];   // SYSTEMS_REWORK §3.1
const E = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const ST = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
const PT = { S: 4, A: 3, B: 2, C: 1, D: 0 };
const IDS = 'selma hagen dokka basil bartolo viola shigure rouga titta brigitta sylvain zafira ferno belladonna boden teo ilse morga marta noela'.split(' ');
const TYPES = 'warrior ranger mage spellblade wanderer'.split(' ');
const TWO = { greatsword: 1, spear: 1, bow: 1 };
const MOD_KEYS = new Set(('atk def mdef hit eva crit spd mag strPct vitPct dexPct agiPct intPct mndPct hpPct mpPct defPct mdefPct physPct magicPct healPct itemPct ' +
  'takenPct mpCostPct techCostPct elemBoost elemResist statusImmune statusResist profPct glimPct expPct goldPct dropPct rarePct superPct rareEncPct goldenPct preemptPct ' +
  'escapePct stealPct autoSteal encounterPct regen mpRegen startBuffs noSpell hpLoss autoRevive autoCounter walkHeal noFloorDamage').split(' '));
/** full-width width of a line ({hero} counts 5) */
const fw = (s) => { let w = 0; for (const ch of String(s).replace(/\{hero\}/g, 'あいうえお')) w += ch.charCodeAt(0) < 0x2000 || (ch >= '｡' && ch <= 'ﾟ') ? 0.5 : 1; return w; };
const C = DB.companions;
const D8 = ['teo', 'ilse', 'morga', 'marta']; // LEAD_DECISIONS D8
// §5.4.3 B5 fixes (A22.4, sim_balance B5 at seed 20260925): stats re-dealt with the total 200 kept, aptitudes re-dealt
// with the weapon / element totals kept. Everyone else must still match the §5.3.2 / §5.3.3 tables exactly.
const REDEAL = {
  stats: ['hagen', 'dokka', 'basil', 'viola', 'rouga', 'titta', 'sylvain', 'zafira', 'belladonna', 'ilse', 'noela'],
  apt: ['viola'],
};
const sumApt = (o) => Object.values(o).reduce((a, l) => a + PT[l], 0);

// ------------------------------------------------------------ SYSTEMS_REWORK overlay (§2.3, §3.5)
const RW = (() => {
  const md = fs.readFileSync(path.join(ROOT, 'design', 'build', 'SYSTEMS_REWORK.md'), 'utf8').split('\n');
  const cellsOf = (l) => l.split('|').slice(1, -1).map((x) => x.trim());
  const HERO = { '主人公 warrior': 'warrior', '主人公 ranger': 'ranger', '主人公 mage': 'mage', '主人公 spellblade': 'spellblade', '主人公 wanderer': 'wanderer' };
  const growth = {}, apt = {};
  const i23 = md.findIndex((l) => l.startsWith('### 2.3')), i24 = md.findIndex((l) => l.startsWith('### 2.4'));
  for (const l of md.slice(i23, i24)) {
    if (!/^\| /.test(l) || /^\| id /.test(l) || /^\|---/.test(l)) continue;
    const c = cellsOf(l);
    for (const [idc, nw] of [[c[0], c[2]], [c[4], c[6]]]) {
      if (!idc || !nw) continue;
      if (idc.includes(' / ')) {   // 「ranger / mage」「spellblade / wanderer」
        const ids = idc.split(' / ').map((x) => x.trim()), vals = nw.split(' / ').map((x) => x.trim());
        ids.forEach((x, k) => { growth[x] = (vals[k] || vals[0]).split(' '); });   // 「B B B / B B」 = the same letters for both
      } else growth[HERO[idc] || idc] = nw.split(' ');
    }
  }
  const i35 = md.findIndex((l) => l.startsWith('### 3.5')), i36 = md.findIndex((l) => l.startsWith('### 3.6'));
  for (const l of md.slice(i35, i36)) {
    const m = l.match(/^\| ([a-z]+|主人公 [a-z]+) \| [SABCD ]+ \| \*\*([SABCD ]+)\*\*/);
    if (m) apt[HERO[m[1]] || m[1]] = m[2].trim().split(' ');
  }
  // the §3.5 starting-gear table, as edits of the DESIGN §5.3.5 rows (ids through the save remap)
  const gear = { basil: { weapon2: '' }, rouga: { weapon1: 'w_axe_cudgel', weapon2: '' }, titta: { weapon2: '' }, zafira: { weapon1: 'w_dagger_iron', weapon2: '' },
    teo: { weapon2: '' }, ilse: { weapon2: '' }, morga: { weapon2: '' }, marta: { weapon2: '' } };
  const techs = { t_club_smash: 't_axe_crumble', t_whip_trip: 't_dagger_numb' };   // §3.5 (the save remap sends them elsewhere)
  const text = { basil: [['祈りと棍棒で', '祈りと槌で']], titta: [['短剣と鞭で', '短剣ひとつで']], zafira: [['鞭さばきも舞のうち', '短剣さばきも舞のうち']] };
  const row = { zafira: 'front' };   // §3.5 (lead: front row, dagger S)
  return { growth, apt, gear, techs, text, row };
})();
const remapItem = (id) => (DB.remap && DB.remap.items && DB.remap.items[id]) || id;
const remapAct = (id) => RW.techs[id] || (DB.remap && DB.remap.actions && DB.remap.actions[id]) || id;

// ------------------------------------------------------------ 1. ids and order
console.log('1  ids and order (§5.1.1)');
check(JSON.stringify(Object.keys(C)) === JSON.stringify(IDS), 'DB.companions = the 20 ids in tavern order');
check(JSON.stringify(Object.keys(DB.heroTypes)) === JSON.stringify(TYPES), 'DB.heroTypes = warrior ranger mage spellblade wanderer');

// ------------------------------------------------------------ 2. companion budgets
console.log('2  companion budgets (§5.7-2, §5.4.4)');
const statMin = Math.min(...IDS.map((id) => Math.min(...ST.map((k) => C[id].stats[k])))), statMax = Math.max(...IDS.map((id) => Math.max(...ST.map((k) => C[id].stats[k]))));
for (const id of IDS) {
  const c = C[id];
  const s = ST.reduce((a, k) => a + c.stats[k], 0);
  check(s === 200 && ST.every((k) => c.stats[k] >= 10 && c.stats[k] <= 60), id + ' stats sum 200, each 10〜60 (' + s + ')');
  check(W.every((w) => PT[c.apt.w[w]] != null) && E.every((e) => PT[c.apt.e[e]] != null) && Object.keys(c.apt.w).length === 7 && Object.keys(c.apt.e).length === 6, id + ' aptitudes 7 + 6, S〜D');
  const w = sumApt(c.apt.w), e = sumApt(c.apt.e);
  check(w >= 10 && w <= 13 && e >= 8 && e <= 12, id + ' aptitude budget ' + w + '/' + e + ' (weapons 10〜13, elements 8〜12; SYSTEMS_REWORK §3.5)');
  const g = PT[c.growth.hp] + PT[c.growth.mp];
  check(g >= 4 && g <= 6 && !('wp' in c.growth), id + ' growth hp+mp 4〜6, no wp (' + g + ')');
  check(PT[c.apt.e.light] >= 1 || PT[c.apt.e.water] >= 1, id + ' light or water ≥ C');
}
const healers = IDS.filter((id) => PT[C[id].apt.e.light] >= 3 || PT[C[id].apt.e.water] >= 3);
check(healers.length >= 8, 'light or water ≥ A: ' + healers.length + ' ≥ 8');
let dominated = [];
for (const a of IDS) for (const b of IDS) if (a !== b && ST.every((k) => C[a].stats[k] >= C[b].stats[k])) dominated.push(a + '>' + b);
check(dominated.length === 0, 'no companion ≥ another in all six stats' + (dominated.length ? ' (' + dominated.join(' ') + ')' : ''));
const saCount = {};
for (const k of W) saCount[k] = IDS.filter((id) => PT[C[id].apt.w[k]] >= 3).length;
for (const k of E) saCount[k] = IDS.filter((id) => PT[C[id].apt.e[k]] >= 3).length;
check(Object.values(saCount).every((n) => n >= 3), 'every weapon type / element has ≥ 3 S/A (min ' + Math.min(...Object.values(saCount)) + ')');
const gender = IDS.reduce((o, id) => { o[C[id].gender]++; return o; }, { m: 0, f: 0 }), rows = IDS.reduce((o, id) => { o[C[id].row]++; return o; }, { front: 0, middle: 0 });
check(gender.m === 10 && gender.f === 10 && rows.front === 11 && rows.middle === 9, 'men 10 / women 10, front 11 / middle 9 (ザフィラ moved to the front, SYSTEMS_REWORK §3.5)');
check(statMin >= 12 && statMax <= 58, 'stat range ' + statMin + '〜' + statMax + ' (§5.4.1: max 58, never 60)');

// ------------------------------------------------------------ 3. hero budgets
console.log('3  hero types × favours (§5.7-3, §5.2.4)');
const heroBudgets = {};
for (const t of TYPES) {
  const T = DB.heroTypes[t];
  const s = ST.reduce((a, k) => a + T.stats[k], 0);
  check(s === 200, t + ' stats sum 200');
  const gs = PT[T.growth.hp] + PT[T.growth.mp];
  check(gs >= 4 && gs <= 6 && !('wp' in T.growth), t + ' growth hp+mp 4〜6, no wp');
  const w0 = sumApt(T.apt.w);
  check(w0 >= 10 && w0 <= 13, t + ' weapon letters ' + w0 + ' before the favour (10〜13, SYSTEMS_REWORK §3.5)');
  check(fw(T.name) <= 5 && T.desc.split('\n').length === 2 && T.desc.split('\n').every((l) => fw(l) <= 20), t + ' name and 2-line desc (20 per line)');
  const fo = R.CharCreate.favorOptions(t);
  heroBudgets[t] = new Set();
  for (const f of fo) {
    const a = R.CharCreate.previewApt(t, f);
    const w = sumApt(a.w), e = sumApt(a.e);
    heroBudgets[t].add(w + '/' + e);
    check(w >= w0 && w <= w0 + 4 && e >= 8 && e <= 12, t + '/' + f.id + ' budget ' + w + '/' + e + ' (the favour raises one letter to S)');
  }
}
const fk = { warrior: ['weapon', 4, 0], ranger: ['weapon', 3, 0], mage: ['element', 0, 6], spellblade: ['any', 4, 6], wanderer: ['any', 7, 6] };   // SYSTEMS_REWORK §3.5
for (const t of TYPES) {
  const T = DB.heroTypes[t], want = fk[t];
  check(T.favorKind === want[0] && ((T.favorOptions.weapon || []).length === want[1]) && ((T.favorOptions.element || []).length === want[2]), t + ' favorKind ' + T.favorKind + ' with ' + want[1] + ' weapons / ' + want[2] + ' elements');
}

// ------------------------------------------------------------ 4. ids used by the data
console.log('4  equipment, techs and spells (§5.7-4)');
const kit = DB.starterKit;
check(W.every((w) => kit.weapon[w] && kit.tech[w]) && Object.keys(kit.weapon).length === 7 && E.every((e) => kit.spell[e]) && Object.keys(kit.pair).length === 6, 'starterKit has 7 weapons + 7 techs + 6 spells + 6 pairs');
check(JSON.stringify(kit.prof) === JSON.stringify({ S: 25, A: 11 }), 'starterKit.prof = {S:25, A:11} (A17 START_PROF)');
const haveItems = Object.keys(DB.items).length > 0, haveActs = Object.keys(DB.actions).length > 0;
const itemIds = new Set();
for (const w of W) itemIds.add(kit.weapon[w]);
for (const id of IDS) for (const v of Object.values(C[id].startEquip)) itemIds.add(v);
for (const t of TYPES) { itemIds.add(DB.heroTypes[t].defaultWeapon); for (const v of Object.values(DB.heroTypes[t].startEquip)) itemIds.add(v); }
const actIds = new Set([...Object.values(kit.tech), ...Object.values(kit.spell)]);
for (const id of IDS) for (const a of C[id].startTechs.concat(C[id].startSpells)) actIds.add(a);
for (const t of TYPES) for (const k of ['weapon', 'element']) for (const a of DB.heroTypes[t].onFavor[k].techs.concat(DB.heroTypes[t].onFavor[k].spells)) actIds.add(a);
check(itemIds.size === 18, 'the starting gear uses the 18 items of §5.1.4 after SYSTEMS_REWORK §3.5 (9 weapons + 9 armor) (' + itemIds.size + ')');
if (haveItems) for (const id of itemIds) check(!!DB.items[id], 'item ' + id + ' exists');
else warn('DB.items is empty: item ids not checked yet');
if (haveActs) for (const id of actIds) check(!!DB.actions[id], 'action ' + id + ' exists');
else warn('DB.actions is empty: tech/spell ids not checked yet');
const wtypeOf = (id) => (DB.items[id] && DB.items[id].wtype) || (/^w_([a-z]+)_/.exec(id || '') || [])[1];
const twoHanded = (id) => { const it = DB.items[id]; if (it && it.twoHanded != null) return !!it.twoHanded; const wt = DB.weaponTypes[wtypeOf(id)]; return wt && wt.twoHanded != null ? !!wt.twoHanded : !!TWO[wtypeOf(id)]; };
for (const id of IDS) {
  const e = C[id].startEquip;
  check(!!e.weapon1 && !!e.body && !!e.head, id + ' has weapon1, body and head');
  check(!(e.shield && (twoHanded(e.weapon1) || (e.weapon2 && twoHanded(e.weapon2)))), id + ' no shield with a two-handed weapon');
  for (const t of C[id].startTechs) {
    const tw = (DB.actions[t] && DB.actions[t].wtype) || t.split('_')[1];
    check([e.weapon1, e.weapon2].some((w) => w && wtypeOf(w) === tw), id + ' carries a ' + tw + ' for ' + t);
    check(PT[C[id].apt.w[tw]] >= 3, id + ' ' + t + ' is in an S/A weapon type');
  }
  for (const s of C[id].startSpells) {
    const el = (DB.actions[s] && DB.actions[s].elements && DB.actions[s].elements[0]) || s.split('_')[1];
    check(PT[C[id].apt.e[el]] >= 3, id + ' ' + s + ' is in an S/A element');
  }
  // LEAD_DECISIONS D8: the staff users also start with 念じ打ち (t_staff_mind) on top of §5.3.5's 1〜2
  const n = C[id].startTechs.filter((t) => !(D8.includes(id) && t === 't_staff_mind')).length + C[id].startSpells.length;
  check(n >= 1 && n <= 2, id + ' starts with 1〜2 techs/spells besides D8 (' + n + ')');
  if (D8.includes(id)) check(C[id].startTechs.includes('t_staff_mind'), id + ' starts with t_staff_mind (D8)');
}
for (const t of TYPES) {
  const T = DB.heroTypes[t];
  check(!(T.startEquip.shield && twoHanded(T.defaultWeapon)), t + ' default weapon + shield is legal');
}

// ------------------------------------------------------------ 5. text lengths
console.log('5  names and text (§5.7-5, §5.3.6)');
const LINES = { profile: [3, 3], joinLine: [1, 2], leaveLine: [1, 1], rejoinLine: [1, 1], epilogue: [2, 2] };
for (const id of IDS) {
  const c = C[id];
  check(fw(c.name) <= 5, id + ' name ≤ 5 (' + c.name + ')');
  check(fw(c.title) <= 6, id + ' title ≤ 6 (' + c.title + ')');
  check(fw(c.innate.name) <= 7 && fw(c.innate.desc) <= 20, id + ' innate name ≤ 7, desc ≤ 20');
  for (const k in LINES) {
    const ls = String(c[k] || '').split('\n');
    check(ls.length >= LINES[k][0] && ls.length <= LINES[k][1], id + ' ' + k + ' has ' + ls.length + ' line(s)');
    for (const l of ls) check(fw(l) <= 20, id + ' ' + k + ' line ≤ 20: ' + l + ' (' + fw(l) + ')');
    check(!/\{name\}/.test(c[k]), id + ' ' + k + ' has no {name}');
  }
  check(typeof c.age === 'number' && !!c.kin && !!c.from && !!R.CharCreate.kit.ROLE_NAMES[c.role] && (c.row === 'front' || c.row === 'middle'), id + ' age, kin, from, role, row');
  check(c.sprite === undefined && c.startProf === undefined, id + ' has no sprite / startProf (§5.3.9)');
}
for (const k in kit.favorDesc) check(fw(kit.favorDesc[k]) <= 20, 'favorDesc.' + k + ' ≤ 20');
check(W.concat(E).every((k) => kit.favorDesc[k]), 'favorDesc for all 7 + 6');
for (const g of ['m', 'f']) check(kit.heroNames[g].length === 8 && kit.heroNames[g].every((n) => R.NameEntry.check(n) === null), 'heroNames.' + g + ' = 8 valid names');
for (const k in R.Tavern.LINES) {
  const v = R.Tavern.LINES[k];
  for (const l of [].concat(v).join('\n').split('\n')) check(fw(l.replace(/\{name\}/g, 'あいうえお')) <= 20, 'tavern line ' + k + ' ≤ 20: ' + l);
}

// ------------------------------------------------------------ 6. innate mods
console.log('6  innate mods (§5.7-6, §5.3.4)');
const allParty = { goldPct: 1, dropPct: 1, rarePct: 1, superPct: 1, rareEncPct: 1, goldenPct: 1, preemptPct: 1, escapePct: 1, noFloorDamage: 1 };
const seen = {};
for (const id of IDS) {
  const m = C[id].innate.mods;
  for (const k of Object.keys(m)) {
    check(MOD_KEYS.has(k), id + ' innate key ' + k + ' is in §3.3.16');
    if (allParty[k]) { seen[k] = (seen[k] || 0) + 1; }
  }
}
check(Object.values(seen).every((n) => n === 1), 'each party-wide innate key is held by exactly one companion (§5.4.1-6)');

// ------------------------------------------------------------ 7. art keys
console.log('7  sprites (§5.7-7)');
const keys = IDS.map((id) => 'party:' + id).concat(...['m', 'f'].map((g) => TYPES.map((t) => 'party:hero_' + g + '_' + t)));
const missing = keys.filter((k) => !R.Gfx.has(k));
if (missing.length) warn(missing.length + ' party sprite keys not registered yet: ' + missing.slice(0, 6).join(' ') + (missing.length > 6 ? ' …' : ''));
else check(true, 'all 30 party sprite keys are registered');

// ------------------------------------------------------------ 8. DESIGN tables (§5.2.3, §5.3.1〜§5.3.6)
console.log('8  data = DESIGN tables');
const tableRows = (from, to) => MD.slice(from, to).filter((l) => /^\| `[a-z]+` \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((s) => s.trim()));
const findLine = (re, start) => { for (let i = start || 0; i < MD.length; i++) if (re.test(MD[i])) return i; return -1; };
const sec = (h) => findLine(new RegExp('^#### ' + h.replace(/\./g, '\\.') + ' '));
const s531 = sec('5.3.1'), s532 = sec('5.3.2'), s533 = sec('5.3.3'), s534 = sec('5.3.4'), s535 = sec('5.3.5'), s536 = sec('5.3.6'), s537 = sec('5.3.7'), s523 = sec('5.2.3');
check(s531 > 0 && s537 > s536 && s523 > 0, 'found §5.2.3 and §5.3.1〜§5.3.7');
const JA = { 女: 'f', 男: 'm' };
const rowsOf = (a, b) => tableRows(a, b);
for (const r of rowsOf(s531, s532)) {
  const id = r[1].replace(/`/g, ''), c = C[id];
  if (!check(!!c, '§5.3.1 row ' + id)) continue;
  check(c.name === r[2] && c.gender === JA[r[3]] && String(c.age) === r[4] && c.kin === r[5] && c.title === r[6] && c.from === r[7] && r[8].includes('`' + c.role + '`') && (RW.row[id] || (r[9] === '前列' ? 'front' : 'middle')) === c.row, id + ' = §5.3.1');
}
for (const r of rowsOf(s532, s533)) {
  const id = r[0].replace(/`/g, ''), c = C[id];
  const sum = (a) => a.reduce((x, y) => x + +y, 0);
  const same = ST.map((k) => c.stats[k]).join() === r.slice(2, 8).join();
  // §5.4.3 B5 (A22.4): the listed companions were re-dealt for fairness (total 200 kept); the rest match the table
  check((same || (REDEAL.stats.includes(id) && sum(ST.map((k) => c.stats[k])) === sum(r.slice(2, 8)))) && [c.growth.hp, c.growth.mp].join() === (RW.growth[id] || []).join(), id + ' stats/growth = §5.3.2 (growth: SYSTEMS_REWORK §2.3)' + (same ? '' : ' (re-dealt, §5.4.3)'));
}
for (const r of rowsOf(s533, s534)) {
  const id = r[0].replace(/`/g, ''), c = C[id];
  const tw = (RW.apt[id] || []).join(''), te = r.slice(14, 20).map((s) => s.replace(/\*/g, '')).join('');
  const sameA = W.map((k) => c.apt.w[k]).join('') === tw && E.map((k) => c.apt.e[k]).join('') === te;
  check((sameA || (REDEAL.apt.includes(id) && W.map((k) => c.apt.w[k]).join('') === tw)) && String(sumApt(c.apt.e)) === r[20], id + ' aptitudes = §5.3.3 (weapons: SYSTEMS_REWORK §3.5)' + (sameA ? '' : ' (elements re-dealt, same totals, §5.4.3)'));
}
for (const r of rowsOf(s534, s535)) {
  const id = r[0].replace(/`/g, ''), c = C[id];
  const mods = r[4].replace(/`/g, '').replace(/\[([a-z]+)\]/g, '["$1"]').replace(/([a-zA-Z]+):/g, '"$1":');
  let m = null; try { m = JSON.parse(mods); } catch (e) { /* reported below */ }
  // BRIEF A1.3 / STYLE_JA §8: the on-screen word is 「アイテム」, not DESIGN §8.2.7's 「品」
  check(!/品を落と/.test(c.innate.desc), id + ' innate desc says アイテム, not 品 (A1.3)');
  check(c.innate.name === r[2] && c.innate.desc === r[3].replace(/品を/g, 'アイテムを') && m && JSON.stringify(m) === JSON.stringify(c.innate.mods), id + ' innate = §5.3.4');
}
for (const r of rowsOf(s535, s536)) {
  const id = r[0].replace(/`/g, ''), c = C[id];
  const ex = (s) => (s.match(/`([a-z0-9_]+)`/g) || []).map((x) => x.replace(/`/g, ''));
  const e = c.startEquip;
  const want = { weapon1: remapItem(ex(r[2])[0] || ''), weapon2: remapItem(ex(r[3])[0] || ''), shield: ex(r[4])[0] || '', body: ex(r[5])[0] || '', head: ex(r[6])[0] || '' };
  Object.assign(want, RW.gear[id] || {});   // SYSTEMS_REWORK §3.5
  const wantT = ex(r[7]).map(remapAct).concat(D8.includes(id) ? ['t_staff_mind'] : []);
  check([e.weapon1, e.weapon2, e.shield, e.body, e.head].map((v) => v || '').join() === [want.weapon1, want.weapon2, want.shield, want.body, want.head].join()
    && wantT.join() === c.startTechs.join() && ex(r[8]).join() === c.startSpells.join(), id + ' gear/techs/spells = §5.3.5 with SYSTEMS_REWORK §3.5');
}
{
  let cur = null;
  const tx = {};
  for (let i = s536; i < s537; i++) {
    const m = MD[i].match(/^##### \d+\. .*（`([a-z]+)`）/);
    if (m) { cur = m[1]; tx[cur] = {}; continue; }
    const t = MD[i].match(/^\| .* `(profile|joinLine|leaveLine|rejoinLine|epilogue)` \| (.*) \|$/);
    if (t && cur) tx[cur][t[1]] = t[2].replace(/\\n/g, '\n');
  }
  for (const [id, reps] of Object.entries(RW.text)) if (tx[id]) for (const [a, b] of reps) tx[id].profile = String(tx[id].profile).replace(a, b);   // SYSTEMS_REWORK §3.5
  for (const id of IDS) check(['profile', 'joinLine', 'leaveLine', 'rejoinLine', 'epilogue'].every((k) => tx[id] && tx[id][k] === C[id][k]), id + ' text = §5.3.6');
}
{
  const NAMES = { 戦士: 'warrior', 狩人: 'ranger', 術師: 'mage', 術剣士: 'spellblade', 旅人: 'wanderer' };
  const trs = MD.slice(s523, s523 + 12).filter((l) => /^\| `[a-z]+` \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((s) => s.trim()));
  for (const r of trs) {
    const t = r[0].replace(/`/g, ''), T = DB.heroTypes[t];
    check(T && T.name === r[1] && ST.map((k) => T.stats[k]).join() === r.slice(2, 8).join() && [T.growth.hp, T.growth.mp].join() === (RW.growth[t] || []).join(), t + ' = §5.2.3 stats (growth: SYSTEMS_REWORK §2.3)');
  }
  const aptStart = findLine(/^\*\*得手不得手の元\*\*/, s523);
  const ars = MD.slice(aptStart, aptStart + 10).filter((l) => /^\| (戦士|狩人|術師|術剣士|旅人) \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((s) => s.trim().replace(/\*/g, '')));
  check(ars.length === 5, '§5.2.3 aptitude table found');
  for (const r of ars) {
    const t = NAMES[r[0]], T = DB.heroTypes[t];
    check(W.map((k) => T.apt.w[k]).join('') === (RW.apt[t] || []).join('') && E.map((k) => T.apt.e[k]).join('') === r.slice(12, 18).join(''), t + ' = §5.2.3 aptitudes (weapons: SYSTEMS_REWORK §3.5)');
  }
}

// ------------------------------------------------------------ 9. §5.4.4 counts over the 1140 trios
console.log('9  the 1140 trios (§5.4.4)');
const trios = [];
for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) for (let k = j + 1; k < 20; k++) trios.push([IDS[i], IDS[j], IDS[k]]);
const noHeal = trios.filter((t) => t.every((id) => PT[C[id].apt.e.light] < 3 && PT[C[id].apt.e.water] < 3)).length;
const noFront = trios.filter((t) => t.every((id) => C[id].row !== 'front')).length;
const allFront = trios.filter((t) => t.every((id) => C[id].row === 'front')).length;
const noSpell = trios.filter((t) => t.every((id) => !C[id].startSpells.length)).length;
const elemsA = (t) => E.filter((e) => t.some((id) => PT[C[id].apt.e[e]] >= 3)).length;
const one = trios.filter((t) => elemsA(t) === 1).map((t) => t.join(' '));
const three = trios.filter((t) => elemsA(t) >= 3).length / trios.length;
check(trios.length === 1140, '1140 trios');
check(noHeal === 165, 'trios without light/water ≥ A: ' + noHeal + ' (§5.4.4: 165)');
check(noFront === 84 && allFront === 165, 'no front row ' + noFront + ', all front ' + allFront + ' (84 / 165: 11 front, 9 middle since ザフィラ moved, SYSTEMS_REWORK §3.5)');
check(noSpell === 120, 'no starting spell ' + noSpell + ' (120)');
check(one.length === 1 && one[0] === 'selma basil bartolo', 'one element ≥ A only: ' + one.join(', '));
check(Math.round(three * 100) === 92, 'three or more elements ≥ A: ' + (three * 100).toFixed(1) + '% (92%)');

// ------------------------------------------------------------ 10. STYLE_JA on the newgame sources
console.log('10 screen text of the newgame files (STYLE_JA)');
const FILES = ['src/systems/title.js', 'src/systems/charcreate.js', 'src/systems/nameentry.js', 'src/systems/tavern.js', 'src/data/herotypes.js', 'src/data/companions.js'];
const BANNED = ['冒険の書', '復活の呪文', 'ふっかつのじゅもん', '呪文', '痛恨', '会心の一撃', 'やっつけた', '回り込まれて', '息の根を止めた', '何も起こらなかった', 'ポイントの経験値', '身を守っている',
  '様子をうかがっている', 'を落としていった', 'リジェネ', 'ジョブ', 'アビリティ', 'JP', '麻痺', '魔法防御', '並び替え', '酒場の主人', 'すべて袋に', '頁', '秘奥義', '魔剣士', '蘇生', 'アクセサリー', 'ひらめ'];
const joyoPath = path.join(ROOT, 'tools/lib/joyo.txt');
const JOYO = fs.existsSync(joyoPath) ? new Set([...fs.readFileSync(joyoPath, 'utf8').trim()]) : null;
const EXTRA = new Set([...'杖槍斧鞭鎧兜棍閃狼巫砦傭鷹槌吠沌翔淵獅鷲狐樺蓮凪叉']);
if (!JOYO) warn('tools/lib/joyo.txt is missing: the kanji check is skipped');
function strings(src) {
  const out = [];
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
  const re = /'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(code))) { const s = (m[1] != null ? m[1] : m[2]).replace(/\\n/g, '\n').replace(/\\'/g, "'"); if (/[぀-ヿ一-鿿]/.test(s)) out.push(s); }
  return out;
}
let nStrings = 0;
for (const f of FILES) {
  const list = strings(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  nStrings += list.length;
  for (const s of list) {
    for (const b of BANNED) if (s.includes(b)) err(f + ': banned word 「' + b + '」 in 「' + s + '」');
    if (JOYO) for (const ch of s) if (/[一-鿿]/.test(ch) && !JOYO.has(ch) && !EXTRA.has(ch)) err(f + ': kanji outside the jōyō list 「' + ch + '」 in 「' + s + '」');
    if (/…/.test(s.replace(/……/g, ''))) err(f + ': a single … in 「' + s + '」');
    if (/[！？][^　\n！？」』）]/.test(s)) err(f + ': 「！」「？」 must be followed by a full-width space: 「' + s + '」');
    if (/[０-９]/.test(s)) warn(f + ': full-width digits in 「' + s + '」');
    for (const l of s.split('\n')) if (fw(l.replace(/\{name\}/g, 'あいうえお')) > 20 && !/^[　-〿぀-ヿ一-鿿a-zA-Z0-9]*[\s:：]/.test('')) {
      if (fw(l) > 20) err(f + ': a line wider than 20: 「' + l + '」 (' + fw(l) + ')');
    }
    if (/アルン/.test(s) && f !== 'src/data/herotypes.js') err(f + ': the hero name is written directly: 「' + s + '」');
  }
}
check(nStrings > 200, 'scanned ' + nStrings + ' Japanese strings in ' + FILES.length + ' files');

console.log('\n' + checks + ' checks, ' + errors + ' error(s), ' + warns + ' warning(s)');
console.log('measured: stats ' + statMin + '〜' + statMax + ', light/water ≥A ' + healers.length + ', S/A per type ≥ ' + Math.min(...Object.values(saCount)) +
  ', trios no-heal ' + noHeal + ' / no-front ' + noFront + ' / all-front ' + allFront + ' / no-spell ' + noSpell + ' / ≥3 elements ' + (three * 100).toFixed(1) + '%');
process.exit(errors ? 1 : 0);
