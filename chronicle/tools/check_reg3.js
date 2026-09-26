#!/usr/bin/env node
// check_reg3.js (owner R3 reg3) — conformance of r_snow ノルデン雪原 with DESIGN.md, and the QA tools
// filtered to this area. Reads DESIGN.md itself (§10.8.4 table, §10.13, §10.6.2, §8.8, §10.9.4) and checks
// that every line and id the spec fixes for this region is in the game data / scripts exactly; then runs
// validate.js / progress.js / check_density.js / check_text.js with --owner R3 and test_reg3.js, and prints
// the measured numbers of the area (sizes, NPCs, tier lines, chests, secret cells, walkable cells).
//
//   node tools/check_reg3.js            exit 1 on any mismatch or tool error
//   node tools/check_reg3.js --no-tools only the DESIGN cross-check (fast)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const R = require('./lib/load')({ quiet: true });
const M = require('./lib/maps');
const Cond = require('./lib/cond');
const DB = R.DB;

let bad = 0;
const out = [];
function ok(c, msg) { if (!c) { bad++; out.push('  MISMATCH ' + msg); } else out.push('  ok ' + msg); }

const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const src = ['src/events/region3_yule.js', 'src/events/region3_frost_peak.js', 'src/maps/region3_yule.js', 'src/maps/region3_frost_peak.js']
  .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const unq = (s) => s.replace(/\\n/g, '\n');
/** every 「…」 quote of a DESIGN line (with its \n kept as written) */
const quotes = (line) => [...line.matchAll(/「([^」]*)」/g)].map((m) => m[1]);
const inSrc = (text) => src.includes("'" + text.replace(/\n/g, '\\n') + "'") || src.includes(text.replace(/\n/g, '\\n'));

// ------------------------------------------------------------------ §10.8.4 the region table
const sec = design.slice(design.indexOf('#### 10.8.4 地方3 `r_snow`'), design.indexOf('#### 10.8.5'));
ok(sec.length > 500, '§10.8.4 found');
const rows = sec.split('\n').filter((l) => /^\| \d \|/.test(l));
ok(rows.length === 7, '§10.8.4 has 7 steps');
// every quoted line of the table that the region's scripts speak (the speaker's words only)
const spoken = [];
for (const r of rows) for (const q of quotes(r)) spoken.push(unq(q));
const expected = spoken.filter((q) => !/^(\{hero\}は|分厚い)/.test(q) || true);
for (const q of expected) ok(inSrc(q), '§10.8.4 line in the scripts: ' + JSON.stringify(q));
// the event ids of the table
for (const id of ['yule_intro', 'yule_sonja', 'yule_hearth', 'frost_peak_2_boss', 'frost_peak_3_boss']) ok(!!DB.events[id], '§10.8.4 event ' + id);
for (const f of ['snow_start', 'snow_flame', 'snow_mid', 'snow_fine', 'snow_boss']) ok(src.includes("'" + f + "'"), '§10.8.4 flag ' + f + ' used');
// objectives text
const objLine = sec.split('\n').find((l) => l.startsWith('目的の文'));
const objs = [...objLine.matchAll(/`(obj_snow_\d)`「([^」]*)」/g)];
ok(objs.length === 2, '§10.8.4 names 2 objectives');
for (const [, id, text] of objs) ok(DB.objectives[id] && DB.objectives[id].text === unq(text), id + ' text = ' + JSON.stringify(unq(text)));
// NPCs (name, id, sprite)
const npcLine = sec.split('\n').find((l) => l.startsWith('**NPC**'));
for (const m of npcLine.matchAll(/（`(\w+)`、`npc:(\w+)`/g)) {
  const [, id, spr] = m;
  const n = DB.maps.yule.npcs.find((x) => x.id === id);
  ok(!!n && n.sprite === 'npc:' + spr, 'NPC ' + id + ' npc:' + spr);
}
const rowell = sec.split('\n').find((l) => l.startsWith('**ロウェルの痕跡**'));
ok(quotes(rowell).every((q) => inSrc(unq(q))), 'Rowell\'s trace (Sonja before the clear)');
const after = sec.split('\n').find((l) => l.startsWith('**クリア後**'));
ok(/yule_jorn_reward/.test(after) && !!DB.events.yule_jorn_reward, 'the reward event yule_jorn_reward');
// §8.8 reward item
const r88 = design.split('\n').find((l) => l.includes('`yule_jorn_reward`') && l.includes('`ac_'));
const rewardId = r88 && (r88.match(/`(ac_\w+)`/) || [])[1];
ok(!!rewardId && src.includes("'" + rewardId + "'") && !!DB.items[rewardId], '§8.8 reward ' + rewardId + ' given');
// §10.8.1 row: bosses and page
const row81 = design.split('\n').find((l) => l.startsWith('| 3 | `r_snow`'));
ok(/tr_b_icegiant/.test(row81) && /tr_b_whitedragon/.test(row81) && /k_page_snow/.test(row81), '§10.8.1 row (tr_b_icegiant → tr_b_whitedragon, k_page_snow)');
ok(src.includes("'tr_b_icegiant'") && src.includes("'tr_b_whitedragon'"), 'the troops are fought');
ok(!!DB.troops.tr_b_icegiant && !!DB.troops.tr_b_whitedragon, 'the troops exist');
ok(DB.regions.r_snow && DB.regions.r_snow.fragment === 'k_page_snow', 'DB.regions.r_snow.fragment k_page_snow');
// §10.9.4 Fine
const fineRow = design.split('\n').find((l) => l.startsWith('| snow |'));
ok(fineRow && quotes(fineRow).every((q) => inSrc(unq(q))), '§10.9.4 Fine\'s line for snow (fallback until story_fine_snow)');
// §10.6.2 dungeon table row
const d62 = design.split('\n').find((l) => l.startsWith('| frost_peak |'));
ok(/`ice`/.test(d62) && /`z_r_snow_peak`/.test(d62), '§10.6.2 frost_peak row: ice / z_r_snow_peak');
// §10.13.2 map ids
ok(['yule', 'frost_peak_1', 'frost_peak_2', 'frost_peak_3'].every((id) => DB.maps[id]), '§10.13.2 maps yule frost_peak_1..3');
const maps = Object.keys(DB.maps).filter((id) => DB.maps[id].region === 'r_snow');
ok(maps.length === 4, 'no extra r_snow maps (' + maps.join(' ') + ')');
// §10.6.4 secret passage count
const sec64 = design.split('\n').find((l) => l.includes('`frost_peak_2`') && l.includes('`verda_maze_2`'));
ok(!!sec64, '§10.6.4 names frost_peak_2');

// ------------------------------------------------------------------ measured numbers
const P = {};
for (const id of ['yule', 'frost_peak_1', 'frost_peak_2', 'frost_peak_3']) P[id] = M.parseMap(R, id);
const walk = (Pm) => { let n = 0; for (let y = 0; y < Pm.h; y++) for (let x = 0; x < Pm.w; x++) { const t = DB.tiles[Pm.tileAt(x, y)]; const d = Pm.decorDef(x, y); if (t && t.pass && !(d && !d.pass)) n++; } return n; };
const nums = [];
for (const id in P) {
  const Pm = P[id];
  const secrets = (() => { let n = 0; for (let y = 0; y < Pm.h; y++) for (let x = 0; x < Pm.w; x++) if (M.isSecret(R, Pm.tileAt(x, y))) n++; return n; })();
  const tiered = Pm.npcs.filter((n) => Array.isArray(n.text) && n.text.length > 1 && typeof n.text[0] === 'object').length;
  nums.push(`${id}: ${Pm.w}×${Pm.h}, walkable ${walk(Pm)}, NPCs ${Pm.npcs.length} (tier lines ${tiered}), chests ${Pm.chests.length} [${Pm.chests.map((c) => c.pool).join(' ')}], secret cells ${secrets}, events ${Pm.events.length}, signs ${Pm.signs.length}`);
}

console.log('check_reg3 — DESIGN cross-check');
for (const l of out) if (!/^ {2}ok/.test(l) || process.argv.includes('-v')) console.log(l);
console.log('  ' + out.filter((l) => /^ {2}ok/.test(l)).length + ' ok, ' + bad + ' mismatch(es)');
console.log('\nmeasured:');
for (const l of nums) console.log('  ' + l);

// ------------------------------------------------------------------ the QA tools for R3
if (!process.argv.includes('--no-tools')) {
  const run = (args) => {
    try { return { code: 0, text: execFileSync('node', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000 }) }; }
    catch (e) { return { code: e.status || 1, text: String(e.stdout || '') + String(e.stderr || '') }; }
  };
  const tools = [
    ['validate', ['tools/validate.js', '--owner', 'R3'], /validate: .*/],
    ['progress', ['tools/progress.js', '--owner', 'R3'], /r_snow\s+first \w+\s+last \w+/],
    ['density', ['tools/check_density.js', '--owner', 'R3'], /check_density: .*/],
    ['text', ['tools/check_text.js', '--owner', 'R3'], /check_text: .*/],
    ['test_reg3', ['tools/test_reg3.js'], /test_reg3: .*/],
  ];
  console.log('\ntools (--owner R3):');
  for (const [name, args, re] of tools) {
    const r = run(args);
    const m = r.text.match(re);
    const line = m ? m[0] : '(no summary line)';
    let good = true;
    if (name === 'validate') good = /: 0 error/.test(line);
    else if (name === 'progress') good = /first ok\s+last ok/.test(line);
    else if (name === 'density') good = / 0 warning/.test(r.text.split('\n').filter((l) => /\[R3\]/.test(l)).length ? 'x' : ' 0 warning');
    else if (name === 'text') good = /0 error/.test(line) && !/\[R3\].*ERROR|ERROR.*\[R3\]/.test(r.text);
    else good = r.code === 0;
    if (!good) bad++;
    console.log('  ' + (good ? 'ok  ' : 'FAIL') + ' ' + name.padEnd(9) + ' ' + line.trim());
  }
}
process.exit(bad ? 1 : 0);
