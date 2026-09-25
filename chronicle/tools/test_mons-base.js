#!/usr/bin/env node
// Unit tests for area A14b mons-base (DESIGN §9.4.1, §9.4.2, §9.4.3, §11.4.2).
//
//   node tools/test_mons-base.js        exit 1 on any failure
//
// Node only (no browser): registry, sizes, anchors, toolkit export, source rules and
// the cross-check against the lineage compose table of §9.4.6 / §9.11.6 in DESIGN.md.
// The pixel checks (sizes, feet, outline, value range under the lineage recolours)
// are in tools/check_mons-base.js (headless Chromium).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { const r = fn(); if (r === false) throw new Error('returned false'); pass++; }
  catch (e) { fail++; failures.push(name + ': ' + (e && e.message || e)); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function ok(c, msg) { if (!c) throw new Error(msg || 'assertion failed'); }

const R = require('./lib/load')({ quiet: true, dataHooks: false });
const mine = /src\/art\/monsters_[abc]\.js/;
const myErrors = (R._nodeLoadErrors || []).filter((e) => mine.test(e));

// §9.4.2: the 14 new bases and their canvas sizes
const NEW = { beetle: 32, fairy: 32, book: 32, crystal: 32, frog: 48, doll: 48, seabird: 48, mole: 48, automaton: 48, scribe: 48, owl: 48, spider: 48, treant: 64, mammoth: 64 };
// §9.4.1: the 36 Crest bases kept as they are (a: 18, b: 18)
const OLD_A = { jelly: 32, bat: 32, rat: 32, mushroom: 32, bee: 32, wisp: 32, imp: 32, mimic: 32, eyeball: 32, goblin: 48, snake: 48, wolf: 48, plant: 48, skeleton: 48, ghost: 48, lizardman: 48, scorpion: 48, mummy: 48 };
const OLD_B = { crab: 48, merman: 48, harpy: 48, darkmage: 48, armor: 48, gargoyle: 48, salamander: 48, cactus: 48, frostling: 48, orc: 64, golem: 64, wyvern: 64, chimera: 64, yeti: 64, kraken: 64, demon: 64, sandworm: 64, minotaur: 64 };
const ANCHOR_KEYS = ['head', 'brow', 'eyes', 'mouth', 'neck', 'back', 'body', 'hand', 'hand2', 'tail', 'feet'];
const FLOATERS = ['fairy', 'book', 'crystal', 'doll']; // §9.4.2: "宙に浮く" / "浮き" / "足もとが少し浮く"

const A = (R && R.Art) || {};
const C = A.monstersC || {};

t('T0 my files load in node without errors', () => { eq(myErrors, []); });
t('T1 monstersC lists exactly the 14 new bases of §9.4.2', () => { eq(Object.keys(C.sizes || {}).sort(), Object.keys(NEW).sort()); eq((C.ids || []).slice().sort(), Object.keys(NEW).sort()); });
t('T2 monstersC sizes match §9.4.2 (32/48/64)', () => { for (const id in NEW) eq(C.sizes[id], NEW[id], id); });
t('T3 size mix is 4 small / 8 medium / 2 large', () => {
  const n = { 32: 0, 48: 0, 64: 0 };
  for (const id in C.sizes) n[C.sizes[id]]++;
  eq(n, { 32: 4, 48: 8, 64: 2 });
});
t('T4 every new base is registered as mon:<id>', () => { for (const id in NEW) ok(R.Gfx.has('mon:' + id), id); });
t('T5 the 36 Crest bases stay registered with their sizes (§9.4.1)', () => {
  eq(A.monstersA && A.monstersA.sizes, OLD_A, 'monstersA');
  eq(A.monstersB && A.monstersB.sizes, OLD_B, 'monstersB');
  for (const id in Object.assign({}, OLD_A, OLD_B)) ok(R.Gfx.has('mon:' + id), id);
});
t('T6 no base id is defined twice across monsters_a/b/c', () => {
  const all = Object.keys(OLD_A).concat(Object.keys(OLD_B), Object.keys(NEW));
  eq(all.length, new Set(all).size);
  eq(all.length, 50);
});
t('T7 R.Art.MonScene exports the 2.5-D scene toolkit (monsters_b.js)', () => {
  const S = A.MonScene;
  ok(S, 'missing');
  for (const k of ['Scene', 'mat', 'ramp', 'mix', 'darken', 'hash', 'clamp', 'stamp', 'stampM', 'shadeLine', 'shave', 'finish', 'flame', 'paintFlame', 'texScales', 'texFur', 'texStone', 'sym'])
    ok(typeof S[k] === 'function', k);
  eq([S.OUT, S.INK, S.WHITE], ['#140e18', '#1e1624', '#f8f8f2']);
});
t('T8 R.Art.MonTK (monsters_a.js) is still exported', () => {
  for (const k of ['ramp', 'mask', 'capsule', 'tube', 'shade', 'part', 'put', 'finish', 'stamp']) ok(typeof A.MonTK[k] === 'function', k);
});
t('T9 anchors: every key of §9.4.3 on every new base, inside the canvas', () => {
  const AN = C.anchors || {};
  for (const id in NEW) {
    const a = AN[id], n = NEW[id];
    ok(a, id + ' has no anchors');
    for (const k of ANCHOR_KEYS) ok(a[k], id + '.' + k);
    const pts = ANCHOR_KEYS.filter((k) => k !== 'eyes').map((k) => a[k]).concat(a.eyes);
    for (const p of pts) ok(Array.isArray(p) && p.length === 2 && p.every((v) => Number.isInteger(v) && v >= 0 && v < n), id + ' point ' + JSON.stringify(p));
    ok(a.eyes.length >= 1, id + ' eyes');
    for (let i = 1; i < a.eyes.length; i++) ok(a.eyes[i][0] > a.eyes[i - 1][0], id + ' eyes left to right');
    ok(a.headW > 0 && a.headW < n, id + ' headW');
  }
});
t('T10 anchors: feet on row H-2 for standing bases, above it for the floaters', () => {
  for (const id in NEW) {
    const a = C.anchors[id], n = NEW[id];
    if (FLOATERS.includes(id)) { ok(a.float === true, id + ' float'); ok(a.feet[1] < n - 2 && a.feet[1] >= n - 8, id + ' feet ' + a.feet[1]); }
    else { ok(!a.float, id + ' must stand'); eq(a.feet[1], n - 2, id + ' feet'); }
  }
});
t('T11 anchors: head above brow above mouth, eyes above mouth (a frog\'s eyes sit on top of its head); hand left of hand2', () => {
  for (const id in NEW) {
    const a = C.anchors[id];
    ok(a.head[1] <= a.brow[1], id + ' head/brow');
    ok(a.brow[1] <= a.mouth[1], id + ' brow/mouth');
    ok(Math.max(...a.eyes.map((e) => e[1])) <= a.mouth[1], id + ' eyes/mouth');
    ok(a.hand[0] < a.hand2[0], id + ' hands');
  }
});

// ---- cross-check against the compose tables in DESIGN.md (§9.4.6 mobs, §9.11.6 bosses)
const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const rows = [];
for (const m of design.matchAll(/^\s+([a-z0-9_]+): \['([a-z_]+)', (\{[^}]*\}), \[(.*)\](?:, '([a-z]+)')?\],?\s*$/gm)) rows.push({ id: m[1], base: m[2], hsb: m[3], parts: m[4], filter: m[5] });
const HEAD_PARTS = ['crown', 'tiara', 'helm', 'hood', 'hat', 'halo', 'bandana', 'flower', 'horns', 'ribbon'];
// required head room above the head anchor for a head part (§9.4.3 step 5: crowns/horns
// 6–8 px on a small base, 8–12 on a medium one, 12–16 on a large one; the part sits over
// the skull, so the free rows above the anchor must hold most of it)
const NEED_BIG = { 32: 4, 48: 7, 64: 10 };          // crown, helm, hat, horns
const NEED_SMALL = { tiara: 3, halo: 3, flower: 4, bandana: 2, hood: 2, ribbon: 2 }; // thin or head-wrapping parts
const need = (part, size) => (part in NEED_SMALL ? NEED_SMALL[part] : NEED_BIG[size]);
t('T12 DESIGN compose tables parse (≥ 200 rows)', () => ok(rows.length >= 200, 'rows ' + rows.length));
t('T13 every base the compose tables use for a new base is one of the 14', () => {
  const used = new Set(rows.map((r) => r.base));
  for (const id in NEW) ok(used.has(id), id + ' unused by the lineage table');
});
t('T14 every base named in the compose tables is registered (mine + postgame)', () => {
  const missing = [...new Set(rows.map((r) => r.base))].filter((b) => !R.Gfx.has('mon:' + b) && !['void_wraith', 'chaos_beast'].includes(b));
  eq(missing, []);
});
t('T15 head room above the head anchor for the new bases that get a head part', () => {
  const bad = [];
  for (const r of rows) {
    if (!(r.base in NEW)) continue;
    const heads = HEAD_PARTS.filter((k) => r.parts.includes("['" + k + "'"));
    if (!heads.length) continue;
    const a = C.anchors[r.base], n = Math.max(...heads.map((k) => need(k, NEW[r.base])));
    if (a.head[1] < n) bad.push(r.id + ' ' + heads.join('+') + ' head y ' + a.head[1] + ' < ' + n);
  }
  eq(bad, []);
});

// ---- source rules (§9.4.2 colours, §11.4.2 opaque pixels, determinism, lazy toolkit)
const srcC = fs.readFileSync(path.join(ROOT, 'src/art/monsters_c.js'), 'utf8');
t('T16 monsters_c.js uses the §9.4.2 outline #120c16 and inner line #1c1420', () => {
  ok(/const OUT = '#120c16'/.test(srcC), 'OUT'); ok(/const INK = '#1c1420'/.test(srcC), 'INK');
});
t('T17 no semi-transparent colours (#rrggbbaa) and no Math.random in monsters_c.js', () => {
  ok(!/'#[0-9a-f]{8}'/i.test(srcC), 'alpha colour'); ok(!/Math\.random/.test(srcC), 'random');
});
t('T18 monsters_c.js loads alone (no toolkit lookup at load time) and registers 14 keys', () => {
  const defs = [];
  const sb = { window: {} };
  sb.window.RPG = { Gfx: { def: (k) => defs.push(k) }, Art: {} };
  vm.createContext(sb);
  vm.runInContext(srcC, sb, { filename: 'monsters_c.js' });
  eq(defs.sort(), Object.keys(NEW).map((id) => 'mon:' + id).sort());
});
t('T19 monsters_c.js sorts after monsters_a/b and after the underscore files (load order)', () => {
  const list = fs.readdirSync(path.join(ROOT, 'src/art')).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, 'src/art', f)).sort((a, b) => a.localeCompare(b));
  const i = (n) => list.findIndex((f) => f.endsWith('/' + n));
  ok(i('monsters_a.js') < i('monsters_b.js') && i('monsters_b.js') < i('monsters_c.js'));
});

console.log(`test_mons-base: ${pass} passed, ${fail} failed (compose rows parsed: ${rows.length})`);
for (const f of failures) console.log('  FAIL', f);
process.exit(fail ? 1 : 0);
