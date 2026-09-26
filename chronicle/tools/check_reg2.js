#!/usr/bin/env node
// check_reg2.js (owner reg2 R2) — conformance of region 2 r_desert ザハラ砂漠 with DESIGN.md, and the shared
// QA tools filtered to R2 (validate / progress / check_density / check_text).
//   1. every line the spec quotes in §10.8.3 (the region's event table, #1–#9) and §10.8.0-3 is in the region's
//      sources word for word (line breaks aside; the statue letters are assembled at run time)
//   2. §10.6.4: the secret passage floors of the region (sand_tomb_2 only), §10.6.2-5 rest lanterns,
//      §10.13.2 map ids, §10.13.8 objective texts, §10.6.1 facilities
//   3. node tools/{validate,progress,check_density,check_text}.js --owner R2 → 0 errors (warnings listed)
//
//   node tools/check_reg2.js [--no-tools]     exit 1 on any failure
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const R = require('./lib/load')();
const DB = R.DB;

let bad = 0;
const out = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) bad++; };

const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const src = ['src/maps/region2_00_kit.js', 'src/maps/region2_kasim.js', 'src/maps/region2_tomb.js', 'src/events/region2_kasim.js', 'src/events/region2_tomb.js']
  .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const norm = (s) => s.replace(/\\n/g, '').replace(/\n/g, '').replace(/\s+/g, '');
const srcN = norm(src);

// ---------------------------------------------------------------- 1. the quoted lines of §10.8.3
console.log('# §10.8.3 quoted lines');
const a = design.indexOf('#### 10.8.3 地方2 `r_desert`'), b = design.indexOf('#### 10.8.4', a);
const sec = design.slice(a, b);
const quotes = [...sec.matchAll(/「([^」]+)」/g)].map((m) => m[1]).filter((q) => !q.includes('『') && !q.includes('ハザル王」'));
let found = 0;
for (const q of quotes) {
  const has = srcN.includes(norm(q));
  if (!has) out(false, 'quoted line missing: 「' + q + '」');
  else found++;
}
out(found === quotes.length, found + '/' + quotes.length + ' quoted lines of §10.8.3 are in the sources');
out(srcN.includes(norm('その夜は、町の宿で眠った。')), '§10.8.0-3 caption 「その夜は、町の宿で眠った。」');
out(srcN.includes(norm('像の台座に、文字がひとつ刻まれている。')), 'statue line (letters assembled: ハ・ザ・ル)');
for (const l of ['ハ', 'ザ', 'ル']) out(new RegExp("statue\\(ev, 'sand_tomb_\\d_statue', '" + l + "'\\)").test(src), 'letter 『' + l + '』 is placed');

// ---------------------------------------------------------------- 2. structure against the spec tables
console.log('# ids and counts');
for (const id of ['kasim', 'sand_tomb_1', 'sand_tomb_2', 'sand_tomb_3']) out(!!DB.maps[id], 'map ' + id + ' (§10.13.2)');
for (const [id, t] of Object.entries({ obj_desert_1: '南西の砂の王墓で、\\n王の名を探そう。', obj_desert_2: '墓守の像の台座から、\\n王の名の文字を集めよう。', obj_desert_3: '王墓の奥で、\\n名なき王に名を返そう。' })) {
  out(DB.objectives[id] && DB.objectives[id].text === t.replace(/\\n/g, '\n') && design.includes('`' + id + '`「' + t + '」'), id + ' text = §10.8.3');
}
const secretFloors = ['kasim', 'sand_tomb_1', 'sand_tomb_2', 'sand_tomb_3'].filter((id) => {
  const M = R.FieldMap.compile(id);
  return M.base.some((t) => DB.tiles[t] && DB.tiles[t].secret);
});
out(JSON.stringify(secretFloors) === JSON.stringify(['sand_tomb_2']), '§10.6.4: the secret passage floors are exactly sand_tomb_2 (' + secretFloors.join(' ') + ')');
const rest = ['sand_tomb_1', 'sand_tomb_2', 'sand_tomb_3'].filter((id) => (DB.maps[id].npcs || []).some((n) => n.id === 'rest'));
out(rest.includes('sand_tomb_2') && rest.includes('sand_tomb_3'), '§10.6.2-5: 休息の灯 on the middle floor and before the boss (' + rest.join(' ') + ')');
const k = DB.maps.kasim.npcs.map((n) => n.id);
out(['inn', 'tavern', 'shop_item', 'shop_weapon', 'shop_armor'].every((i) => k.includes(i)), '§10.6.1: kasim has inn · tavern · item · weapon · armor');
out(DB.regions.r_desert && DB.regions.r_desert.bossTroop === 'tr_b_sandking' && DB.regions.r_desert.fragment === 'k_page_desert', 'DB.regions.r_desert boss / fragment');

// ---------------------------------------------------------------- 3. the shared tools, filtered to R2
if (!process.argv.includes('--no-tools')) {
  console.log('# shared QA tools (--owner R2)');
  const run = (tool, args) => {
    try { return { code: 0, text: execFileSync('node', [path.join(__dirname, tool)].concat(args), { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000 }) }; }
    catch (e) { return { code: e.status || 1, text: (e.stdout || '') + (e.stderr || '') }; }
  };
  const last = (t, re) => (t.split('\n').filter((l) => re.test(l)).pop() || '').trim();
  let r = run('validate.js', ['--owner', 'R2']);
  out(r.code === 0, 'validate: ' + last(r.text, /^validate:/));
  r = run('check_text.js', ['--owner', 'R2']);
  out(r.code === 0, 'check_text: ' + last(r.text, /^check_text:/));
  r = run('check_density.js', ['--owner', 'R2']);
  out(/check_density: 0 warning/.test(r.text), 'check_density: ' + last(r.text, /^check_density:/));
  r = run('progress.js', ['--owner', 'R2']);
  const row = last(r.text, /^\s*r_desert\s/);
  out(/first ok\s+last ok/.test(row), 'progress: ' + row);
  out(!/ERROR \[R2\]/.test(r.text), 'progress: no R2 errors');
  r.text.split('\n').filter((l) => /\[R2\]/.test(l)).forEach((l) => console.log('         ' + l.trim()));
}

console.log('\ncheck_reg2: ' + (bad ? bad + ' failure(s)' : 'all ok'));
process.exit(bad ? 1 : 0);
