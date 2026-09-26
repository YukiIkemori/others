#!/usr/bin/env node
// Unit tests for the boss art (owner art-boss A15a). node, no browser; exit 1 on failure.
//
//   node tools/test_art-boss.js [-v]
//
// T1  MON_COMPOSE_BOSSES is the §9.11.6 table: the 14 ids, each row [base, hsb, parts, filter?] equal to
//     the transcription in tools/fixtures/art-boss/spec_compose.js (the two documented hue fixes aside)
// T2  merged into R.Art.MON_COMPOSE without replacing it (same row objects), no id shared with the mob
//     table (V8), every id registered as mon:<id>
// T3  every base, part and filter a row names exists (R.Gfx / R.Art.PARTS / R.Art.FILTERS), when the
//     owner of those registries has loaded
// T4  the 18 new sprites of bosses_b.js (16 bosses + 2 minions): ids and sizes of §9.11.6, face rows
// T5  every sprite of §9.11.4 is registered (35 keys incl. the phase sprite), and every boss id has a
//     mon:<bossId> alias (the bestiary draws mon:<id>); BOSS_SPRITES matches the §9.11.4 絵 column
// T6  against the boss data when it is loaded (A12): each b_* monster's sprite resolves and matches,
//     phase sprites resolve, every troop member resolves; the §11.4.2 sink keeps every face below the
//     window band (feet = 130 + clamp(round((h−64)/2.4), 0, 20), top = feet − h, top + face ≥ 56)
// T7  source hygiene of the owned files: parses, no STYLE_JA §7.3 / §9.14.2 words, no TODO/FIXME,
//     'use strict', one IIFE on window.RPG
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const R = require('./lib/load')({ quiet: true });
const ROSTER = require('./fixtures/art-boss/roster');
const SPEC = require('./fixtures/art-boss/spec_compose');
const VERBOSE = process.argv.includes('-v');

let fails = 0, passes = 0;
const fail = (t, msg) => { fails++; console.log('FAIL', t, msg); };
const ok = (t, msg) => { passes++; if (VERBOSE) console.log('ok  ', t, msg); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const A = R.Art || {};
const B = A.MON_COMPOSE_BOSSES || {};

// ---------------------------------------------------------------- T1
{
  const want = Object.keys(SPEC.TABLE), got = Object.keys(B);
  if (!eq(want.slice().sort(), got.slice().sort())) fail('T1', 'ids differ: want ' + want.join(',') + ' got ' + got.join(','));
  else ok('T1', '14 ids');
  if (got.length !== 14) fail('T1', 'MON_COMPOSE_BOSSES has ' + got.length + ' rows, want 14');
  // the fixture must still be the table in DESIGN.md (catches a spec edit, e.g. the lead adopting the fixes)
  const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  const m = DESIGN.match(/const BOSSES = \(R\.Art\.MON_COMPOSE_BOSSES = \{/);
  if (!m) fail('T1', 'DESIGN.md: §9.11.6 compose block not found');
  else {
    const blk = DESIGN.slice(m.index, DESIGN.indexOf('\n});', m.index) + 4);
    let doc = null;
    try { doc = new Function('return ' + blk.replace(/^const \w+ = \(R\.Art\.\w+ = /, '(').replace(/\}\);\s*$/, '})'))(); } catch (e) { fail('T1', 'DESIGN.md block does not evaluate: ' + e.message); }
    if (doc) {
      for (const id of new Set(Object.keys(doc).concat(want))) {
        if (eq(doc[id], SPEC.TABLE[id])) continue;
        // a spec that now carries the documented fix is fine too
        if (SPEC.FIXES[id] && doc[id] && eq(doc[id][1], SPEC.FIXES[id])) continue;
        fail('T1', 'fixture row ' + id + ' differs from DESIGN.md: ' + JSON.stringify(doc[id]));
      }
      ok('T1', 'fixture = DESIGN.md §9.11.6 (' + Object.keys(doc).length + ' rows)');
    }
  }
  for (const id of want) {
    const row = B[id];
    if (!row) continue;
    const spec = SPEC.TABLE[id];
    const exp = SPEC.FIXES[id] ? [spec[0], SPEC.FIXES[id]].concat(spec.slice(2)) : spec;
    if (!eq(row, exp)) fail('T1', id + ' row ' + JSON.stringify(row) + ' != ' + JSON.stringify(exp));
    else ok('T1', id);
    if (!Array.isArray(row[2]) || typeof row[0] !== 'string' || typeof row[1] !== 'object') fail('T1', id + ' malformed row');
  }
}

// ---------------------------------------------------------------- T2
{
  const MC = A.MON_COMPOSE || {};
  for (const id in B) {
    if (MC[id] !== B[id]) fail('T2', id + ' is not the same row in R.Art.MON_COMPOSE');
    if (!R.Gfx.has('mon:' + id)) fail('T2', 'mon:' + id + ' not registered');
  }
  const MOBS = A.MON_COMPOSE_MOBS || {};
  const shared = Object.keys(B).filter((id) => id in MOBS);
  if (shared.length) fail('T2', 'ids in both MON_COMPOSE_MOBS and MON_COMPOSE_BOSSES (V8): ' + shared.join(','));
  else ok('T2', 'no overlap with ' + Object.keys(MOBS).length + ' mob rows; MON_COMPOSE has ' + Object.keys(MC).length);
}

// ---------------------------------------------------------------- T3
{
  const PARTS = A.PARTS, FILTERS = A.FILTERS;
  for (const id in B) {
    const [base, , parts, filter] = B[id];
    if (!R.Gfx.has('mon:' + base)) fail('T3', id + ' base mon:' + base + ' not registered');
    if (PARTS) for (const [pid] of parts) if (!PARTS[pid]) fail('T3', id + ' part ' + pid + ' missing in R.Art.PARTS');
    if (filter && FILTERS && !FILTERS[filter]) fail('T3', id + ' filter ' + filter + ' missing in R.Art.FILTERS');
  }
  if (!PARTS) console.log('note T3: R.Art.PARTS not loaded (art-mons), part ids not checked');
  if (!A.compose) console.log('note T3: R.Art.compose not loaded — compose rows use the stand-in');
  ok('T3', 'bases/parts/filters');
}

// ---------------------------------------------------------------- T4
{
  const NEW = Object.entries(ROSTER.SPRITES).filter(([, r]) => r[3] === 'new');
  const BB = A.bossesB || {};
  if (NEW.length !== 18) fail('T4', 'roster lists ' + NEW.length + ' new sprites, want 18');
  if (!BB.ids || BB.ids.length !== 18) fail('T4', 'R.Art.bossesB.ids has ' + (BB.ids || []).length + ' ids, want 18');
  const minions = NEW.filter(([, r]) => r[2][0] === 48 && r[2][1] === 48).map(([id]) => id);
  if (!eq(minions.sort(), ['boss_root', 'boss_tentacle'])) fail('T4', 'the two minions should be boss_root, boss_tentacle: ' + minions);
  for (const [id, r] of NEW) {
    if (!BB.ids || !BB.ids.includes(id)) { fail('T4', id + ' not in bosses_b'); continue; }
    if (!eq(BB.sizes[id], r[2])) fail('T4', id + ' size ' + BB.sizes[id] + ' want ' + r[2]);
    const f = BB.face && BB.face[id];
    if (typeof f !== 'number' || f < 0 || f >= r[2][1]) fail('T4', id + ' face row missing');
    else if (r[2][1] >= 96 && f < 20) fail('T4', id + ' face row ' + f + ' < 20 (§9.11.6)');
    if (!R.Gfx.has('mon:' + id)) fail('T4', 'mon:' + id + ' not registered');
    ok('T4', id + ' ' + r[2].join('x') + ' face ' + f);
  }
  for (const w of [96, 112]) for (const [id, r] of NEW) if (r[2][1] === w && r[2][0] > 128) fail('T4', id + ' wider than 128');
}

// ---------------------------------------------------------------- T5
{
  const SP = A.BOSS_SPRITES || {};
  for (const sp of Object.keys(ROSTER.SPRITES)) if (!R.Gfx.has('mon:' + sp)) fail('T5', 'sprite mon:' + sp + ' not registered');
  for (const [id, [sp]] of Object.entries(ROSTER.BOSSES)) {
    if (SP[id] !== sp) fail('T5', 'BOSS_SPRITES.' + id + ' = ' + SP[id] + ', §9.11.4 says ' + sp);
    if (!R.Gfx.has('mon:' + id)) fail('T5', 'alias mon:' + id + ' not registered');
  }
  if (Object.keys(SP).length !== 34) fail('T5', 'BOSS_SPRITES has ' + Object.keys(SP).length + ' ids, want 34');
  for (const sp of (A.BOSS_PHASE_SPRITES || {}).b_lavabeast || []) if (!R.Gfx.has('mon:' + sp)) fail('T5', 'phase sprite ' + sp);
  for (const id of Object.keys(ROSTER.LEGACY)) if (!R.Gfx.has('mon:' + id)) fail('T5', 'Crest sprite mon:' + id + ' dropped');
  ok('T5', Object.keys(ROSTER.SPRITES).length + ' sprite keys, 34 aliases');
}

// ---------------------------------------------------------------- T6
{
  const M = (R.DB && R.DB.monsters) || {}, TR = (R.DB && R.DB.troops) || {};
  const bosses = Object.keys(M).filter((k) => k.startsWith('b_'));
  if (!bosses.length) console.log('note T6: boss data (A12) not loaded, data cross-check skipped');
  for (const id of bosses) {
    const d = M[id], sp = d.sprite || id;
    if (!R.Gfx.has('mon:' + sp)) fail('T6', id + ' sprite mon:' + sp + ' not registered');
    if ((A.BOSS_SPRITES || {})[id] && A.BOSS_SPRITES[id] !== sp) fail('T6', id + ' data sprite ' + sp + ' != BOSS_SPRITES ' + A.BOSS_SPRITES[id]);
    for (const ph of d.phases || []) if (ph.set && ph.set.sprite && !R.Gfx.has('mon:' + ph.set.sprite)) fail('T6', id + ' phase sprite ' + ph.set.sprite);
  }
  for (const tid of Object.keys(TR).filter((k) => k.startsWith('tr_b_'))) {
    for (const [mid] of TR[tid].mons || []) {
      if (mid[0] === '@') continue; // the region's mob of that lineage (art-mons)
      const d = M[mid];
      if (!d) { fail('T6', tid + ' member ' + mid + ' has no monster data'); continue; }
      if (!R.Gfx.has('mon:' + (d.sprite || mid))) fail('T6', tid + ' member ' + mid + ' sprite not registered');
    }
  }
  // §11.4.2 sink vs the window band, for every sprite size of the roster
  const sink = (h) => Math.max(0, Math.min(20, Math.round((h - 64) / 2.4)));
  const face = Object.assign({}, (A.bossesB || {}).face, SPEC.CREST_FACE);
  for (const [id, r] of Object.entries(ROSTER.SPRITES)) {
    const h = r[2][1], top = 130 + sink(h) - h;
    const base = B[id] ? B[id][0] : id;
    const f = face[id] != null ? face[id] : face[base];
    if (f == null) { fail('T6', id + ' no face row known'); continue; }
    if (top + f < 56) fail('T6', id + ' face at screen y ' + (top + f) + ' is under the window band (top ' + top + ')');
    else ok('T6', id + ' h' + h + ' top ' + top + ' face ' + (top + f));
  }
  if (bosses.length) ok('T6', bosses.length + ' bosses, ' + Object.keys(TR).filter((k) => k.startsWith('tr_b_')).length + ' troops');
}

// ---------------------------------------------------------------- T7
{
  const files = fs.readdirSync(path.join(ROOT, 'src/art')).filter((f) => /^bosses.*\.js$/.test(f)).map((f) => path.join(ROOT, 'src/art', f));
  files.push(path.join(ROOT, 'tools/sheet_bosses.js'));
  const BANNED = ['冒険の書', '復活の呪文', 'ふっかつのじゅもん', '呪文', '痛恨', '会心の一撃', 'やっつけた', 'スライム', 'メタル', 'ドラキー', 'キメラ', 'ゴーレム', 'ミミック', '人食い箱', 'はぐれ', 'キング'];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8'), rel = path.relative(ROOT, f);
    try { new vm.Script(src, { filename: f }); } catch (e) { fail('T7', rel + ' does not parse: ' + e.message); continue; }
    for (const w of BANNED) if (src.includes(w)) fail('T7', rel + ' contains ' + w);
    if (/\b(TODO|FIXME|XXX)\b/.test(src)) fail('T7', rel + ' has a TODO/FIXME marker');
    if (rel.startsWith('src/')) {
      if (!/'use strict'/.test(src)) fail('T7', rel + " lacks 'use strict'");
      if (!/\}\)\(window\.RPG\);\s*$/.test(src)) fail('T7', rel + ' is not one IIFE on window.RPG');
    }
    ok('T7', rel);
  }
  if (R._nodeLoadErrors && R._nodeLoadErrors.some((e) => /bosses/.test(e))) fail('T7', 'load error in a boss art file: ' + R._nodeLoadErrors.filter((e) => /bosses/.test(e)).join('; '));
}

console.log(`test_art-boss: ${passes} ok, ${fails} failed`);
process.exit(fails ? 1 : 0);
