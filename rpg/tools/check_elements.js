#!/usr/bin/env node
// Element balance report + policy checks (DESIGN §5.5 "Element policy").
//
//   node tools/check_elements.js            counts, per-family table, gear/skill tables, checks
//   node tools/check_elements.js --list     also print every monster with its families and elements
//   node tools/check_elements.js --quiet    checks only (exit 1 on errors)
//
// Counts per element over the regular monsters (not boss / rare / post-game, metal jellies left out:
// they are immune to magic anyway): weak (×≥1.5) / resist (0<×<1) / immune (0) / absorb (<0);
// bosses, rare and post-game monsters are counted separately.
// Families: monsters.js exports R.ELEM_FAMILIES (the policy table) and every monster lists its
// families in `fam` (data-only field, the game ignores it). The checker verifies that each monster's
// elements follow its families (a family's weakness is present, its immunity/absorb is not turned into
// a weakness), that absorb only appears where a family allows it, and that every element has
// 12–20 weak regular monsters.
// Gear: elemental weapons per element and band (items.js `band`); skills: elemental player abilities
// per element and job tier, with a rough power figure (phys power ×2 ≈ spell "戦士 hits").
'use strict';
const R = require('./lib/load')({ quiet: true });
const { DB } = R;

const argv = process.argv.slice(2);
const LIST = argv.includes('--list');
const QUIET = argv.includes('--quiet');
const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);
for (const e of R._nodeLoadErrors) E('load: ' + e.split('\n')[0]);

const ELEMENTS = ['fire', 'ice', 'thunder', 'wind', 'earth', 'water', 'holy', 'dark'];
const JA = { fire: '炎', ice: '氷', thunder: '雷', wind: '風', earth: '大地', water: '水', holy: '聖', dark: '闇' };
const WEAK_RANGE = [12, 20];
const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += /[　-￿]/.test(ch) ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
const padL = (s, n) => { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; };
const out = (s) => { if (!QUIET) console.log(s); };

// ------------------------------------------------------------ categories
const flags = (m) => m.flags || [];
const isPost = (id) => /^pg_/.test(id) || id === 'abyss_lord' || id === 'rare_prism';
function category(id, m) {
  if (isPost(id)) return 'post';
  if (flags(m).includes('boss')) return 'boss';
  if (flags(m).includes('rare')) return 'rare';
  if (flags(m).includes('metal')) return 'metal';
  return 'regular';
}
const kind = (x) => (x < 0 ? 'absorb' : x === 0 ? 'immune' : x < 1 ? 'resist' : x >= 1.5 ? 'weak' : x > 1 ? 'mild' : null);

function countOf(ids) {
  const c = {};
  for (const e of ELEMENTS) c[e] = { weak: [], resist: [], immune: [], absorb: [] };
  for (const id of ids) {
    const el = DB.monsters[id].elem || {};
    for (const e in el) { const k = kind(el[e]); if (c[e] && c[e][k]) c[e][k].push(id); }
  }
  return c;
}
function printCounts(title, ids) {
  const c = countOf(ids);
  out(`\n=== ${title} (${ids.length}) — weak / resist / immune / absorb`);
  out('  ' + ELEMENTS.map((e) => pad(JA[e], 5) + padL(c[e].weak.length, 3) + '/' + c[e].resist.length + '/' + c[e].immune.length + '/' + c[e].absorb.length).join('  '));
  const abs = ELEMENTS.reduce((s, e) => s + c[e].absorb.length, 0);
  const none = ids.filter((id) => !Object.values(DB.monsters[id].elem || {}).some((x) => x >= 1.5)).length;
  out(`  absorb total ${abs} · no weakness ${none}`);
  return c;
}

const all = Object.keys(DB.monsters);
const by = { regular: [], boss: [], rare: [], post: [], metal: [] };
for (const id of all) by[category(id, DB.monsters[id])].push(id);

const reg = printCounts('regular monsters', by.regular);
printCounts('bosses', by.boss);
printCounts('rare monsters', by.rare);
printCounts('post-game', by.post);

for (const e of ELEMENTS) {
  const n = reg[e].weak.length;
  if (n < WEAK_RANGE[0] || n > WEAK_RANGE[1]) W(`${e}: ${n} regular monsters weak (target ${WEAK_RANGE.join('–')})`);
}

// ------------------------------------------------------------ families
const FAM = R.ELEM_FAMILIES || null;
if (!FAM) E('R.ELEM_FAMILIES missing (monsters.js)');
else {
  out('\n=== families (R.ELEM_FAMILIES) — members: regular / boss / rare / post');
  for (const f in FAM) {
    const mem = all.filter((id) => (DB.monsters[id].fam || []).includes(f));
    const cnt = ['regular', 'boss', 'rare', 'post', 'metal'].map((k) => mem.filter((id) => category(id, DB.monsters[id]) === k).length);
    const rule = Object.entries(FAM[f].elem).map(([e, x]) => JA[e] + '×' + x).join(' ');
    out(`  ${pad(f, 8)} ${pad(FAM[f].name, 30)} ${pad(rule, 26)} ${cnt.slice(0, 4).join('/')}`);
  }
  for (const id of all) {
    const m = DB.monsters[id], cat = category(id, m);
    const fam = m.fam || [];
    if (!fam.length && cat !== 'metal') W(`${id}: no family (fam)`);
    for (const f of fam) if (!FAM[f]) E(`${id}: unknown family ${f}`);
    const el = m.elem || {};
    const flying = flags(m).includes('flying'), airborne = fam.includes('wing') || fam.includes('float');
    if (flying && !airborne) W(`${id}: flag flying but neither wing nor float family`);
    if (!flying && airborne) W(`${id}: wing/float family but no flying flag`);
    // every absorb must come from a family that allows it
    for (const e in el) {
      // regular monsters: only an absorbing family; bosses / rare / post-game may upgrade a family's resistance
      const ok = fam.some((f) => FAM[f] && FAM[f].elem[e] != null && (cat === 'regular' ? FAM[f].elem[e] < 0 : FAM[f].elem[e] < 1));
      if (el[e] < 0 && !ok) W(`${id}: absorbs ${e} but none of its families (${fam.join(',') || '-'}) allows it`);
    }
    // families' immunities/absorbs never become weaknesses; family weaknesses are kept
    for (const f of fam) {
      if (!FAM[f]) continue;
      for (const [e, x] of Object.entries(FAM[f].elem)) {
        const v = el[e] != null ? el[e] : 1;
        if (x >= 1.5 && v < 1 && !(FAM[f].soft || []).includes(e)) {
          // a later family may override (e.g. an ice-bodied flier): only report when no family explains it
          if (!fam.some((g) => g !== f && FAM[g] && FAM[g].elem[e] != null && FAM[g].elem[e] < 1)) W(`${id}: family ${f} is weak to ${e} but ${id} has ×${v}`);
        }
        if (x <= 0 && v >= 1.5) E(`${id}: family ${f} is immune/absorbs ${e} but ${id} is weak (×${v})`);
      }
    }
  }
}

// ------------------------------------------------------------ monster list
if (LIST) {
  for (const cat of ['regular', 'boss', 'rare', 'post']) {
    out(`\n=== ${cat}`);
    for (const id of by[cat]) {
      const m = DB.monsters[id];
      const el = Object.entries(m.elem || {}).map(([e, x]) => JA[e] + x).join(' ');
      out(`  ${pad(m.name, 16)} Lv${padL(m.lv, 2)} ${pad((m.fam || []).join(','), 18)} ${el}`);
    }
  }
}

// ------------------------------------------------------------ weapons
const BANDS = [1, 2, 3, 4, 5, 6];
out('\n=== elemental weapons per band (★ = rare / not sold)');
for (const e of ELEMENTS) {
  const ws = Object.entries(DB.items).filter(([, it]) => it.type === 'weapon' && it.element === e && it.band);
  const cells = BANDS.map((b) => ws.filter(([, it]) => it.band === b).map(([, it]) => it.name + (it.rare ? '★' : '')).join('・') || '-');
  out(`  ${pad(JA[e], 5)} ${padL(ws.length, 2)} | ` + cells.map((c, i) => `b${i + 1} ${c}`).join(' | '));
  if (ws.length < 3) W(`weapons: only ${ws.length} ${e} weapons`);
}

// ------------------------------------------------------------ abilities
const tierOf = (job) => (DB.jobs[job] ? DB.jobs[job].tier : 0);
out('\n=== elemental player abilities per tier (power: phys p → "p×2", magic "base+mag×scale")');
const abByEl = {};
for (const [id, a] of Object.entries(DB.abilities)) {
  if (/^en_/.test(id) || !a.effects || a.kind !== 'action') continue;
  const d = a.effects.find((x) => x.type === 'damage' && x.element);
  if (!d) continue;
  (abByEl[d.element] = abByEl[d.element] || []).push([id, a, d]);
}
for (const e of ELEMENTS) {
  const list = (abByEl[e] || []).sort((x, y) => tierOf(x[1].job) - tierOf(y[1].job));
  out(`  ${pad(JA[e], 5)} ${padL(list.length, 2)} | ` + list.map(([id, a, d]) => {
    const pw = d.formula === 'magic' ? `${d.power}+${d.scale}` : d.formula === 'breath' ? `息${d.power}` : `p${d.power}${d.hits ? '×' + (Array.isArray(d.hits) ? d.hits.join('-') : d.hits) : ''}`;
    return `T${tierOf(a.job)} ${a.name}(${a.target === 'enemy' ? '単' : a.target === 'group' ? '群' : a.target === 'enemies' ? '全' : a.target} ${pw} MP${a.mp || 0})`;
  }).join(' '));
  if (!(abByEl[e] || []).length) W(`abilities: no ${e} player ability`);
}

// ------------------------------------------------------------ enemy abilities
const enemyEl = {};
for (const [id, a] of Object.entries(DB.abilities)) {
  if (!/^en_/.test(id) || !a.effects) continue;
  const d = a.effects.find((x) => x.type === 'damage' && x.element);
  if (d) enemyEl[d.element] = (enemyEl[d.element] || 0) + 1;
}
out('\n=== enemy abilities per element: ' + ELEMENTS.map((e) => JA[e] + (enemyEl[e] || 0)).join(' '));

// ------------------------------------------------------------ report
if (warns.length) { out(`\nWARN (${warns.length})`); for (const w of warns) out('  ' + w); }
if (errors.length) { console.log(`\nERRORS (${errors.length})`); for (const e of errors) console.log('  ' + e); }
console.log(`\ncheck_elements: ${errors.length} errors, ${warns.length} warnings`);
process.exit(errors.length ? 1 : 0);
