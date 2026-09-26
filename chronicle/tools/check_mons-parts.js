#!/usr/bin/env node
// Pixel checks for area A14a mons-parts (DESIGN §9.4.3–§9.4.6, §11.4.2) in headless Chromium.
// Renders every R.Art.MON_COMPOSE_MOBS id (and the bosses' table of A15, which uses the same compose)
// through tools/sheet_monsters_compose.js --only check, then checks and prints the measured numbers:
//   C1 size        every sprite has exactly its base's size (32/48/64)
//   C2 opaque      no semi-transparent pixel (§11.4.2)
//   C3 complete    no unknown part / filter; the bosses' compositions resolve too
//   C4 outline     no solid part pixel borders transparency without the 1-px outline (§9.4.3 step 4)
//   C5 feet        the sprite still stands on the base's bottom row
//   C6 unique      all 211 images differ
//   C7 stages      every two stages of a lineage differ in silhouette, parts or filter (not a recolour)
//   C8 parts       every stage ≥ 2 on its lineage's base adds at least T part pixels (s 12 / m 20 / l 30) or a filter
//   C9 colours     the recoloured body matches the colour its name / bestiary text states (mean hue or
//                  one of its 3 strongest 30° bins: a flower may be blue on a magenta stem)
//   C10 time       compose time per sprite (budget: max ≤ 100 ms, total ≤ 4 s; slow ones re-timed best of 3)
//
//   node tools/check_mons-parts.js [--json FILE] [--verbose]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const ji = args.indexOf('--json');

let res;
if (ji >= 0 && fs.existsSync(args[ji + 1])) res = JSON.parse(fs.readFileSync(args[ji + 1], 'utf8'));
else {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mons-parts-'));
  const out = path.join(dir, 'check.json');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools/sheet_monsters_compose.js'), '--only', 'check', '--json', out, '--out', dir], { stdio: VERBOSE ? 'inherit' : 'pipe', timeout: 180000 });
  } catch (e) {
    if (!fs.existsSync(out)) { console.error('render failed:', String(e.stdout || e.message).slice(0, 2000)); process.exit(2); }
  }
  res = JSON.parse(fs.readFileSync(out, 'utf8'));
  fs.rmSync(dir, { recursive: true, force: true });
}

const R = require('./lib/load')({ quiet: true });
const M = R.DB.monsters || {};
const items = res.items, ids = Object.keys(items);
let fail = 0;
const report = [];
function check(name, bad, numbers) {
  const okk = bad.length === 0;
  if (!okk) fail++;
  report.push(`${okk ? 'PASS' : 'FAIL'} ${name}  ${numbers || ''}${okk ? '' : '\n       ' + bad.slice(0, 20).join('\n       ') + (bad.length > 20 ? `\n       … ${bad.length - 20} more` : '')}`);
}

check('C1 size', ids.filter((id) => items[id].w !== items[id].bw || items[id].h !== items[id].bh).map((id) => `${id}: ${items[id].w}x${items[id].h} vs base ${items[id].bw}x${items[id].bh}`),
  `${ids.length} sprites; sizes ${[...new Set(ids.map((id) => items[id].w))].sort().join('/')}`);
check('C2 opaque', ids.filter((id) => items[id].semi > 0).map((id) => `${id}: ${items[id].semi} semi-transparent px`), `semi-transparent px total ${ids.reduce((s, id) => s + items[id].semi, 0)}`);
const bossBad = Object.entries(res.bosses || {}).filter(([, b]) => b.missing.length || (b.composed && b.openEdge)).map(([id, b]) => `${id}: missing ${b.missing.join(' ')} openEdge ${b.openEdge}`);
check('C3 complete', ids.filter((id) => items[id].missing.length).map((id) => `${id}: missing ${items[id].missing.join(' ')}`).concat(bossBad).concat((res.warned || []).filter((w) => /^mon:/.test(w)).map((w) => 'missing graphic ' + w)),
  `bosses' compositions ${Object.keys(res.bosses || {}).length}, composed ${Object.values(res.bosses || {}).filter((b) => b.composed).length}`);
check('C4 outline', ids.filter((id) => items[id].openEdge > 0).map((id) => `${id}: ${items[id].openEdge} open edge px`), `open edge px total ${ids.reduce((s, id) => s + items[id].openEdge, 0)}`);
check('C5 feet', ids.filter((id) => items[id].bottom < items[id].baseBottom || items[id].bottom > items[id].h - 1).map((id) => `${id}: bottom ${items[id].bottom} base ${items[id].baseBottom}`), 'feet rows kept');
check('C6 unique', (res.dupes || []).map((l) => 'identical: ' + l.join(' ')), `${ids.length - (res.dupes || []).reduce((s, l) => s + l.length - 1, 0)} distinct images`);

// C7 stages differ: silhouette XOR, or a different base / filter / part list
const lin = {};
for (const id of ids) (lin[id.replace(/_\d+$/, '')] = lin[id.replace(/_\d+$/, '')] || []).push(id);
const c7 = [];
let minXor = Infinity, minPair = '';
for (const k in lin) {
  const g = lin[k];
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = items[g[i]], b = items[g[j]];
    const x = (a.xor || {})[g[j]];
    const structural = a.base !== b.base || a.filter !== b.filter || a.parts.join() !== b.parts.join();
    if (x != null && x >= 0 && x < minXor && a.base === b.base) { minXor = x; minPair = g[i] + '/' + g[j]; }
    if (!(structural || x >= 6)) c7.push(`${g[i]} vs ${g[j]}: xor ${x}, same base/parts/filter`);
    if (a.base === b.base && a.filter === b.filter && x < 1 && Math.abs(a.partPx - b.partPx) < 6) c7.push(`${g[i]} vs ${g[j]}: silhouettes identical, part px ${a.partPx}/${b.partPx}`);
  }
}
check('C7 stages', c7, `${Object.keys(lin).length} lineages; smallest same-base silhouette XOR ${minXor} px (${minPair})`);

// C8 every later stage adds something on top of the recolour
const T8 = { 32: 12, 48: 20, 64: 30 };
const c8 = [];
let minPart = Infinity, minPartId = '';
for (const id of ids) {
  const n = +id.split('_').pop(), first = items[id.replace(/_\d+$/, '_1')];
  if (n < 2 || !first || first.base !== items[id].base) continue;
  const it = items[id];
  if (!it.filter && it.partPx < minPart) { minPart = it.partPx; minPartId = id; }
  if (!it.filter && it.partPx < (T8[it.w] || 20)) c8.push(`${id}: ${it.partPx} part px (< ${T8[it.w]})`);
}
check('C8 parts', c8, `smallest addition ${minPart} px (${minPartId})`);

// C9 colour words: the body colour the text names (curated from R.DB.monsters names and descriptions)
const HUE = { red: [[330, 360], [0, 28]], orange: [[12, 50]], sand: [[15, 62]], yellow: [[35, 68]], green: [[72, 168]], blue: [[180, 252]], purple: [[252, 325]] };
const COLOUR = {
  jelly_3: 'purple', jelly_4: 'red', bat_2: 'red', crab_1: 'red', crab_3: 'blue', bee_1: 'sand', bee_2: 'purple', mushroom_1: 'red',
  mushroom_2: 'purple', plant_3: 'purple', plant_4: 'blue', scorpion_1: 'red', scorpion_2: 'green', scorpion_5: 'yellow', snake_1: 'sand',
  snake_4: 'orange', crystal_2: 'red', crystal_3: 'blue', crystal_4: 'purple', goblin_1: 'green', frog_2: 'blue', ghost_3: 'purple',
  wisp_2: 'green', wisp_4: 'blue', imp_2: 'red', orc_3: 'red', darkmage_2: 'red', darkmage_3: 'green', gargoyle_3: 'red', spider_4: 'yellow',
  salamander_1: 'orange', chimera_3: 'red', wisp_1: 'orange',
};
const PALE = ['wolf_1', 'seabird_2', 'wyvern_3', 'wolf_3', 'mammoth_3', 'imp_3', 'book_3', 'scribe_1', 'scribe_2', 'scribe_3', 'wisp_3', 'rat_3', 'scorpion_3', 'beetle_2'];
const inHue = (h, rs) => rs.some(([a, b]) => h >= a && h <= b);
const c9 = [];
for (const id in COLOUR) {
  const it = items[id];
  if (!it) { c9.push(id + ': not rendered'); continue; }
  // the mean hue, or one of the three strongest 30° bins (bodies with two colours, e.g. petals and stem)
  const hits = [it.hue].concat(it.hueBins || []).some((h) => inHue(h, HUE[COLOUR[id]]));
  if (!hits) c9.push(`${id} ${(M[id] || {}).name || ''}: body hue ${it.hue}° (bins ${(it.hueBins || []).join('/')}), text says ${COLOUR[id]}`);
}
for (const id of PALE) if (items[id] && items[id].sat > 0.36) c9.push(`${id} ${(M[id] || {}).name || ''}: saturation ${items[id].sat}, text says grey / white / iron`);
check('C9 colours', c9, `${Object.keys(COLOUR).length} hue claims, ${PALE.length} grey/white claims`);

const times = ids.map((id) => items[id].ms).sort((a, b) => a - b);
const total = times.reduce((s, t) => s + t, 0);
const slow = ids.slice().sort((a, b) => items[b].ms - items[a].ms).slice(0, 5).map((id) => id + ' ' + items[id].ms);
check('C10 time', (times[times.length - 1] > 100 ? ['slowest ' + times[times.length - 1] + ' ms'] : []).concat(total > 4000 ? ['total ' + Math.round(total) + ' ms'] : []),
  `total ${Math.round(total)} ms, median ${times[times.length >> 1]} ms, p95 ${times[Math.floor(times.length * 0.95)]} ms, slowest ${slow.join(', ')}`);

console.log(report.join('\n'));
console.log(`\n${10 - fail}/10 checks passed`);
process.exit(fail ? 1 : 0);
