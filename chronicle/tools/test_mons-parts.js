#!/usr/bin/env node
// Unit tests for area A14a mons-parts (DESIGN §9.4.3–§9.4.6), node only (no browser).
//
//   node tools/test_mons-parts.js            exit 1 on any failure
//   node tools/test_mons-parts.js --verbose  print every check
//
// Pixel checks (rendering all 211 sprites, distinctness, outline, colour words) are in
// tools/check_mons-parts.js (headless Chromium).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const R = require('./lib/load')({ quiet: true });
const A = R.Art;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + msg); }
  else { fail++; fails.push(msg); console.log('  FAIL ' + msg); }
}
const section = (s) => console.log('\n' + s);

// ---------------------------------------------------------------- spec extraction from DESIGN.md
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
function specBlock(startRe) {
  const m = DESIGN.match(startRe);
  if (!m) return null;
  const from = m.index;
  const end = DESIGN.indexOf('\n});', from);
  return DESIGN.slice(from, end + 4);
}
/** evaluate `const X = (R.Art.NAME = {...});` into a plain object */
function evalTable(src) {
  if (!src) return null;
  const body = src.replace(/^const \w+ = \(R\.Art\.\w+ = /, '(').replace(/\}\);\s*$/, '})');
  return new Function('return ' + body)();
}
const SPEC_MOBS = evalTable(specBlock(/const MOBS = \(R\.Art\.MON_COMPOSE_MOBS = \{/));
const SPEC_BOSSES = evalTable(specBlock(/const BOSSES = \(R\.Art\.MON_COMPOSE_BOSSES = \{/));
/** part ids of the §9.4.4 table (first column; a row may list several ids) */
function specParts() {
  const a = DESIGN.indexOf('#### 9.4.4'), b = DESIGN.indexOf('#### 9.4.5');
  const ids = [];
  for (const line of DESIGN.slice(a, b).split('\n')) {
    if (!line.startsWith('| `')) continue;
    const first = line.split('|')[1];
    for (const m of first.matchAll(/`([a-z0-9_]+)`/g)) ids.push(m[1]);
  }
  return ids;
}
function specFilters() {
  const a = DESIGN.indexOf('#### 9.4.5'), b = DESIGN.indexOf('#### 9.4.6');
  return DESIGN.slice(a, b).split('\n').filter((l) => l.startsWith('| `')).map((l) => l.split('|')[1].match(/`([a-z]+)`/)[1]);
}
/** back-layer parts of §9.4.4 (層 = 後) */
function specBackLayer() {
  const a = DESIGN.indexOf('#### 9.4.4'), b = DESIGN.indexOf('#### 9.4.5');
  const out = [];
  for (const line of DESIGN.slice(a, b).split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cols = line.split('|').map((s) => s.trim());
    if (cols[4] === '後') for (const m of cols[1].matchAll(/`([a-z0-9_]+)`/g)) out.push(m[1]);
  }
  return out;
}

// Documented deviations from the §9.4.6 table (each one is in the report and in monsters_compose.js)
const ADDED_PARTS = {         // stage 2+ entries that were a pure recolour got one part (not just a hue shift)
  beetle_2: ['armor_plates'], crystal_2: ['embers'], crystal_3: ['frost'], crystal_4: ['aura', 'runes'],
  frog_3: ['horns', 'spots'], darkmage_2: ['embers'], darkmage_3: ['storm'],
};
const COLOUR_FIX = {          // hue values whose result contradicted the monster's own name / bestiary text
  crystal_2: { hue: 150, sat: 1.4 }, crystal_3: { hue: 20, sat: 1.3 }, crystal_4: { hue: 80, sat: 1.3, bri: 0.85 },
  frog_2: { hue: 125, sat: 1.3 }, bat_2: { hue: 55, sat: 1.2 }, jelly_4: { hue: -150, sat: 1.1 },
  darkmage_2: { hue: 60, sat: 1.2 }, ghost_3: { hue: 50, sat: 0.8, bri: 0.8 }, plant_3: { hue: -60, sat: 1.1 },
  wisp_4: { hue: 15, sat: 1.2, bri: 0.55 }, gargoyle_3: { hue: 115, sat: 1.3 }, crab_3: { hue: 190 },
  snake_1: { hue: -70, sat: 0.7, bri: 1.1 }, snake_4: { hue: -75, sat: 1, bri: 0.8 }, spider_4: { hue: 15, sat: 1.3, bri: 0.9 },
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- 1. API
section('1. API (§9.4.3)');
ok(typeof A.compose === 'function', 'R.Art.compose is a function');
ok(A.compose.length >= 4, 'compose(base, hsb, parts, filter[, id])');
ok(A.MON_ANCHORS && typeof A.MON_ANCHORS === 'object', 'R.Art.MON_ANCHORS exists');
ok(typeof A.monAnchors === 'function', 'R.Art.monAnchors(base) exists (tools)');
ok(A.PartTK && typeof A.PartTK.ramp === 'function' && typeof A.PartTK.shade === 'function', 'R.Art.PartTK toolkit exported');
ok(!R._nodeLoadErrors.some((e) => /monsters_(parts|compose)/.test(e)), 'my files load without errors in node');

// ---------------------------------------------------------------- 2. parts and filters
section('2. PARTS 66 / FILTERS 6 (§9.4.4, §9.4.5)');
const SP = specParts(), SF = specFilters();
ok(SP.length === 66, 'spec lists 66 parts (' + SP.length + ')');
ok(Object.keys(A.PARTS).length === 66, 'R.Art.PARTS has 66 ids (' + Object.keys(A.PARTS).length + ')');
for (const id of SP) ok(typeof A.PARTS[id] === 'function', 'part ' + id + ' is a function');
ok(Object.keys(A.PARTS).every((id) => SP.includes(id)), 'no part outside the spec');
ok(SF.length === 6 && same(SF.slice().sort(), Object.keys(A.FILTERS).sort()), 'FILTERS = ' + SF.join(' '));
for (const id of SF) ok(typeof A.FILTERS[id] === 'function', 'filter ' + id + ' is a function');
const back = specBackLayer();
ok(same(back.slice().sort(), Object.keys(A.PART_LAYER).filter((k) => A.PART_LAYER[k] === 'back').sort()), 'back layer = ' + back.join(' '));
for (const id of SP) ok(!!A.PART_ANCHOR[id], 'part ' + id + ' has an anchor key (' + A.PART_ANCHOR[id] + ')');

// ---------------------------------------------------------------- 3. the table
section('3. MON_COMPOSE_MOBS (§9.4.6)');
const MOBS = A.MON_COMPOSE_MOBS;
ok(SPEC_MOBS && Object.keys(SPEC_MOBS).length === 211, 'spec table parsed: 211 ids');
ok(MOBS && Object.keys(MOBS).length === 211, 'R.Art.MON_COMPOSE_MOBS has 211 ids (' + Object.keys(MOBS || {}).length + ')');
ok(same(Object.keys(MOBS), Object.keys(SPEC_MOBS)), 'same ids in the same order as §9.4.6');
let devParts = 0, devHue = 0;
for (const id in SPEC_MOBS) {
  const s = SPEC_MOBS[id], m = MOBS[id];
  if (!m) continue;
  ok(m[0] === s[0], id + ': base ' + s[0]);
  ok((m[3] || null) === (s[3] || null), id + ': filter ' + (s[3] || '-'));
  if (COLOUR_FIX[id]) { ok(same(m[1], COLOUR_FIX[id]), id + ': colour correction as documented'); devHue++; }
  else ok(same(m[1], s[1]), id + ': hsb as §9.4.6');
  const extra = ADDED_PARTS[id] || [];
  const want = s[2].concat(extra.map((pid) => m[2].find((p) => p[0] === pid)).filter(Boolean));
  ok(same(m[2].slice(0, s[2].length), s[2]), id + ': the §9.4.6 parts, in order, with their options');
  ok(m[2].length === s[2].length + extra.length && same(m[2].map((p) => p[0]), want.map((p) => p[0])), id + ': ' + (extra.length ? 'documented additions ' + extra.join(' ') : 'no extra parts'));
  if (extra.length) devParts++;
  for (const k of Object.keys(m[1])) ok(['hue', 'sat', 'bri'].includes(k), id + ': hsb key ' + k);
  if (m[1].sat != null) ok(m[1].sat >= 0 && m[1].sat <= 1.5, id + ': sat in 0..1.5');
  if (m[1].bri != null) ok(m[1].bri >= 0.4 && m[1].bri <= 1.35, id + ': bri in 0.4..1.35');
}
ok(devParts === Object.keys(ADDED_PARTS).length, 'all ' + devParts + ' part additions present');
ok(devHue === Object.keys(COLOUR_FIX).length, 'all ' + devHue + ' colour corrections present');
// every stage 2+ has a part or a filter (not just a hue shift) — the reason for ADDED_PARTS
for (const id in MOBS) {
  const n = +id.split('_').pop();
  const lin = id.replace(/_\d+$/, '');
  const firstBase = MOBS[lin + '_1'] && MOBS[lin + '_1'][0];
  if (n >= 2 && MOBS[id][0] === firstBase) ok(MOBS[id][2].length > 0 || !!MOBS[id][3], id + ': stage ' + n + ' has a part or a filter');
}

// ---------------------------------------------------------------- 4. registration
section('4. registration (§9.4.6)');
for (const id in MOBS) {
  ok(R.Gfx.has('mon:' + id), 'mon:' + id + ' registered');
  ok(A.MON_COMPOSE[id] === MOBS[id], 'MON_COMPOSE[' + id + '] is the MOBS entry (added, not copied)');
}
const BOSSES = A.MON_COMPOSE_BOSSES || {};
ok(Object.keys(BOSSES).every((id) => !MOBS[id]), 'no id in both MON_COMPOSE_MOBS and MON_COMPOSE_BOSSES (V8)');
ok(Object.keys(A.MON_COMPOSE).length === Object.keys(MOBS).length + Object.keys(BOSSES).length, 'MON_COMPOSE = mobs + bosses (' + Object.keys(A.MON_COMPOSE).length + ')');
const src = fs.readFileSync(path.join(ROOT, 'src/art/monsters_compose.js'), 'utf8');
ok(!/R\.Art\.MON_COMPOSE\s*=\s*\{/.test(src) && !/\|\|=/.test(src), 'MON_COMPOSE is added to, never assigned wholesale; no ||= (ES2020)');
if (SPEC_BOSSES) ok(same(Object.keys(SPEC_BOSSES).sort(), Object.keys(BOSSES).sort()) || !Object.keys(BOSSES).length, 'bosses table ids match §9.11.6 (A15)');

// ---------------------------------------------------------------- 5. references
section('5. references: bases, parts, filters');
const allTables = Object.assign({}, MOBS, BOSSES);
for (const id in allTables) {
  const [base, , parts, filter] = allTables[id];
  ok(R.Gfx.has('mon:' + base), id + ': base mon:' + base + ' registered');
  for (const [pid, o] of parts) {
    ok(!!A.PARTS[pid], id + ': part ' + pid + ' exists');
    if (o && o.style) ok(true, id + ': ' + pid + ' style ' + o.style);
    if (o) for (const k of Object.keys(o)) ok(['c', 'c2', 'gem', 'size', 'style', 'len'].includes(k), id + ': ' + pid + ' option ' + k + ' is a §9.4.4 option');
    if (o && o.size) ok(['s', 'm', 'l'].includes(o.size), id + ': size s/m/l');
    if (o && o.len) ok(['s', 'm', 'l'].includes(o.len), id + ': len s/m/l');
    for (const k of ['c', 'c2', 'gem']) if (o && o[k]) ok(/^#[0-9a-f]{6}$/i.test(o[k]), id + ': ' + pid + '.' + k + ' is #rrggbb');
  }
  if (filter) ok(!!A.FILTERS[filter], id + ': filter ' + filter + ' exists');
}
const pend = (A.PENDING || []).filter((k) => /^mon:/.test(k) && MOBS[k.slice(4)]);
ok(pend.length === 0, 'no regular monster is waiting for a base (R.Art.PENDING: ' + (pend.join(' ') || '-') + ')');

// ---------------------------------------------------------------- 6. anchors
section('6. anchors of the 50 bases (§9.4.3)');
const KEYS = ['head', 'brow', 'eyes', 'mouth', 'neck', 'back', 'body', 'hand', 'hand2', 'tail', 'feet'];
const sizes = Object.assign({}, (A.monstersA || {}).sizes, (A.monstersB || {}).sizes, (A.monstersC || {}).sizes, (A.Postgame || {}).SIZES);
const bases = [...new Set(Object.values(MOBS).map((e) => e[0]))];
ok(bases.length === 50, '50 base sprites used by the table (' + bases.length + ')');
for (const b of bases) {
  const t = Object.assign({}, A.monstersC && A.monstersC.anchors && A.monstersC.anchors[b], A.MON_ANCHORS[b]);
  ok(Object.keys(t).length > 0, b + ': has an anchor table');
  const sz = sizes[b];
  const W = Array.isArray(sz) ? sz[0] : sz, H = Array.isArray(sz) ? sz[1] : sz;
  for (const k of KEYS) {
    const v = t[k];
    ok(!!v, b + ': anchor ' + k);
    if (!v || !W) continue;
    const pts = k === 'eyes' ? v : [v];
    for (const p of pts) ok(p[0] >= 0 && p[1] >= 0 && p[0] < W && p[1] < H, b + ': ' + k + ' ' + JSON.stringify(p) + ' inside ' + W + 'x' + H);
  }
  if (t.headW) ok(t.headW >= 6 && t.headW <= (W || 64), b + ': headW ' + t.headW);
  for (const k in t.erase || {}) for (const r of t.erase[k]) ok(r.length >= 4 && r[0] <= r[2] && r[1] <= r[3], b + ': erase rect ' + JSON.stringify(r));
}

// ---------------------------------------------------------------- 7. data agreement (A11)
section('7. monster data (A11) → sprites');
const M = R.DB.monsters || {};
const regular = Object.keys(M).filter((id) => M[id].lineage);
if (regular.length) {
  ok(regular.length === 211, 'A11 defines 211 regular monsters (' + regular.length + ')');
  for (const id of regular) ok(!!MOBS[M[id].sprite || id], id + ': sprite ' + (M[id].sprite || id) + ' in MON_COMPOSE_MOBS');
  for (const id in MOBS) ok(!!M[id], id + ': has monster data');
  for (const id of regular) ok(M[id].hue == null && M[id].sat == null && M[id].bri == null, id + ': no hue/sat/bri in the data (V8)');
} else console.log('  (no monster data loaded: skipped)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n  ' + fails.slice(0, 40).join('\n  ')); process.exit(1); }
