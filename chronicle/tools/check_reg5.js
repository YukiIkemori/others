#!/usr/bin/env node
// check_reg5.js (owner reg-5 R5) — conformance of the マレア諸島 area with DESIGN.md / STYLE_JA.md, read from the
// documents themselves (so a later edit of the spec shows up here):
//   1. every line the §10.8.6 flow table quotes (「…」, \n → newline) is spoken by the region's scripts
//   2. the objective texts obj_isles_1..4 equal the §10.8.6 目的の文
//   3. the region line of §10.9.4 (isles) is in the fallback of the girl in grey; the §10.8.6 NPC list holds
//      (drake sailor, marina old_woman, glen ghost, regnas_merchant merchant + cond cleared + shop coral_regnas)
//   4. every Japanese string in src/maps/region5_*.js and src/events/region5_*.js: ≤ 20 full-width per line
//      ({hero} = 5), ≤ 4 lines per page, no lone "…", kanji only from 常用漢字 (tools/lib/joyo.txt) + STYLE_JA §2
//   5. §10.6.2 / §10.6.4 table rows for the region (floors, theme, zone, secret floors) match the maps
//   --full: also runs validate.js / progress.js / check_density.js / check_text.js for owner R5 and reports them
//
//   node tools/check_reg5.js [--full]        exit 1 on any failure
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const STYLE = fs.readFileSync(path.join(ROOT, 'STYLE_JA.md'), 'utf8');
const files = [...fs.readdirSync(path.join(ROOT, 'src/maps')).filter((f) => /^region5_.*\.js$/.test(f)).map((f) => 'src/maps/' + f),
  ...fs.readdirSync(path.join(ROOT, 'src/events')).filter((f) => /^region5_.*\.js$/.test(f)).map((f) => 'src/events/' + f)];
const SRC = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const R = require('./lib/load')({ quiet: true });

let fails = 0, passes = 0;
function ok(c, m) { if (c) passes++; else { fails++; console.log('  FAIL ' + m); } }

// ------------------------------------------------------------------ JS string literals of my files (unescaped)
function literals(src) {
  const out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[1];
    if (!/[぀-ヿ一-鿿]/.test(raw)) continue;
    // skip comments: find line start
    const ls = src.lastIndexOf('\n', m.index) + 1;
    const pre = src.slice(ls, m.index);
    if (/^\s*\/\//.test(pre)) continue;
    out.push(raw.replace(/\\n/g, '\n').replace(/\\f/g, '\f').replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
  }
  return out;
}
const strs = literals(files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').map((l) => l.replace(/\/\/[^'\n]*$/, '')).join('\n')).join('\n'));
const joined = strs.join('\u0000');

// ------------------------------------------------------------------ 1. §10.8.6 quoted lines
const sec = DESIGN.slice(DESIGN.indexOf('#### 10.8.6 地方5'), DESIGN.indexOf('#### 10.8.7'));
ok(sec.length > 1000, '§10.8.6 found');
const flowRows = sec.split('\n').filter((l) => /^\| \d \|/.test(l));
ok(flowRows.length === 8, `§10.8.6 flow table has 8 rows (${flowRows.length})`);
const quoted = [];
for (const row of flowRows) {
  const cols = row.split('|');
  const flow = cols[4] || '';
  for (const m of flow.matchAll(/「([^」]+)」/g)) {
    let q = m[1].replace(/\\n/g, '\n');
    if (/^[a-z_]+$/.test(q)) continue;
    quoted.push(q);
  }
}
ok(quoted.length >= 15, `§10.8.6 quotes ${quoted.length} lines`);
for (const q of quoted) ok(joined.includes(q), `spoken: 「${q.replace(/\n/g, '\\n')}」`);
// Rowell's trace, the Regnas merchant (§10.8.6 bullets)
for (const m of sec.matchAll(/(?:ロウェルの痕跡|商人：)[^「]*「([^」]+)」/g)) { const q = m[1].replace(/\\n/g, '\n'); ok(joined.includes(q), `spoken: 「${q.replace(/\n/g, '\\n')}」`); }

// ------------------------------------------------------------------ 2. objectives
const objLine = sec.split('\n').find((l) => l.startsWith('目的の文'));
for (const m of (objLine || '').matchAll(/`(obj_isles_\d)`「([^」]+)」/g)) {
  const want = m[2].replace(/\\n/g, '\n');
  ok(R.DB.objectives[m[1]] && R.DB.objectives[m[1]].text === want, `objective ${m[1]} = spec`);
}
ok(/obj_isles_4/.test(objLine || ''), '目的の文 line parsed');

// ------------------------------------------------------------------ 3. §10.9.4 and the NPC list
const fineRow = DESIGN.split('\n').find((l) => /^\| isles \|/.test(l));
const fineLine = fineRow && (fineRow.match(/「([^」]+)」/) || [])[1];
ok(fineLine && joined.includes(fineLine.replace(/\\n/g, '\n')), '§10.9.4 isles line in the fallback');
const m5 = R.DB.maps;
const npc = (map, id) => (m5[map].npcs || []).find((n) => n.id === id);
ok(npc('coral', 'drake') && npc('coral', 'drake').sprite === 'npc:sailor', 'drake: npc:sailor');
ok(npc('nerei', 'marina') && npc('nerei', 'marina').sprite === 'npc:old_woman', 'marina: npc:old_woman');
ok((m5.ghost_ship_3.npcs || []).some((n) => n.id === 'glen' && n.sprite === 'npc:ghost') && npc('nerei', 'glen_pier').sprite === 'npc:ghost', 'glen: npc:ghost (scenes only)');
const rm = npc('coral', 'regnas_merchant');
ok(rm && rm.sprite === 'npc:merchant' && rm.shop === 'coral_regnas' && rm.cond && rm.cond.cleared === 'r_isles' && rm.fixed, 'regnas_merchant: merchant, shop coral_regnas, cond cleared, fixed');
const stories = sec.match(/story_fine_isles/g) || [];
ok(stories.length >= 1 && /story_fine_isles/.test(SRC), 'story_fine_isles is called');
ok(/story_after_clear/.test(SRC) && /ev\.clearRegion\(RS\)/.test(SRC), 'clearRegion + story_after_clear');

// ------------------------------------------------------------------ 4. text shape and kanji
const joyoPath = path.join(ROOT, 'tools/lib/joyo.txt');
const joyo = fs.existsSync(joyoPath) ? new Set([...fs.readFileSync(joyoPath, 'utf8').replace(/\s/g, '')]) : null;
const allowMatch = STYLE.match(/\*\*使ってよい常用外の字\*\*: ([^\n]+)/);
const allow = new Set([...(allowMatch ? allowMatch[1].replace(/（[^）]*）/g, '').replace(/\s/g, '') : '')]);
const width = (line) => { const s = line.replace(/\{hero\}/g, '＿＿＿＿＿'); let w = 0; for (const ch of s) w += /[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1; return w; };
const bad = [];
for (const s of strs) {
  for (const pg of s.split('\f')) {
    const lines = pg.split('\n');
    if (lines.length > 4) bad.push(`5+ lines: ${pg.replace(/\n/g, '\\n')}`);
    for (const l of lines) if (width(l) > 20) bad.push(`> 20: ${l}`);
  }
  if (/(^|[^…])…([^…]|$)/.test(s)) bad.push(`lone …: ${s}`);
  if (/……$/.test(s)) bad.push(`ends in …… without 。: ${s}`);
  if (joyo) for (const ch of s) if (/[一-鿿]/.test(ch) && !joyo.has(ch) && !allow.has(ch)) bad.push(`kanji ${ch}: ${s.slice(0, 20)}`);
  for (const w of ['頁', '呪文', '魔法', '蘇生', '教会', '噂', '珊瑚', '舵', '樽']) if (s.includes(w)) bad.push(`word ${w}: ${s.slice(0, 20)}`);
}
for (const b of bad) console.log('  FAIL ' + b);
fails += bad.length;
passes += strs.length - bad.length;
ok(!!joyo, 'tools/lib/joyo.txt read');

// ------------------------------------------------------------------ 5. §10.6.2 / §10.6.4 rows
const dunRows = DESIGN.split('\n').filter((l) => /^\| (tide_cave|ghost_ship) \|/.test(l));
ok(dunRows.length === 2, '§10.6.2 rows for tide_cave / ghost_ship');
for (const row of dunRows) {
  const c = row.split('|').map((s) => s.trim());
  const floors = [...c[4].matchAll(/`([a-z_]+?)(?:_(\d)(?:\.\.(\d))?)?`/g)][0];
  const base = floors[1], n = floors[3] ? +floors[3] : 1;
  for (let i = 1; i <= n; i++) {
    const d = m5[`${base}_${i}`];
    ok(!!d, `${base}_${i} exists`);
    if (!d) continue;
    const theme = c[5].match(/`(\w+)`/)[1], zone = c[8].match(/`(\w+)`/)[1];
    ok(d.theme === theme && d.encounter === zone, `${base}_${i}: theme ${theme}, zone ${zone}`);
  }
}
const secRow = DESIGN.split('\n').find((l) => /^\| reg-b（A21） \| `tide_cave_1`/.test(l));
ok(!!secRow, '§10.6.4 reg-b row');
const isSecret = (id) => (m5[id].rows || []).some((r) => r.includes('%'));
ok(isSecret('tide_cave_1') && isSecret('ghost_ship_2') && !isSecret('ghost_ship_1') && !isSecret('ghost_ship_3'), 'secret passages on tide_cave_1 and ghost_ship_2 only');

// ------------------------------------------------------------------ --full: the shared QA tools for R5
if (process.argv.includes('--full')) {
  const runTool = (args) => { try { return execFileSync('node', args, { cwd: ROOT, encoding: 'utf8', timeout: 600000, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
  const v = runTool(['tools/validate.js', '--owner', 'R5']);
  const vl = v.split('\n').find((l) => /^validate:/.test(l)) || '';
  console.log('  validate  ' + vl);
  ok(/validate: 0 error/.test(vl), 'validate --owner R5: 0 errors');
  const pr = runTool(['tools/progress.js', '--owner', 'R5']);
  const isl = pr.split('\n').find((l) => /^\s+r_isles\s/.test(l)) || '';
  console.log('  progress  ' + isl.trim());
  ok(/first ok\s+last ok/.test(isl), 'progress: r_isles first ok / last ok');
  const de = runTool(['tools/check_density.js', '--owner', 'R5']);
  const dl = de.split('\n').filter((l) => /^check_density/.test(l)).join(' ');
  console.log('  density   ' + dl);
  ok(/0 warning/.test(dl), 'check_density --owner R5: 0 warnings');
  const tx = runTool(['tools/check_text.js', '--owner', 'R5']);
  const tl = tx.split('\n').find((l) => /^check_text/.test(l)) || '';
  console.log('  text      ' + tl);
  ok(/0 error/.test(tl), 'check_text --owner R5: 0 errors');
}

console.log(`check_reg5: ${passes} passed, ${fails} failed (${strs.length} strings, ${quoted.length} spec lines)`);
process.exit(fails ? 1 : 0);
