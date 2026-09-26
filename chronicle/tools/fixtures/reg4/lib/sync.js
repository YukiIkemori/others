#!/usr/bin/env node
// Writes the composed rows/decor of the region-4 maps into src/maps/region4_*.js, between the
// markers `// @rows <id>` and `// @end <id>` (the rest of each map file is hand-written).
//   node tools/fixtures/reg4/lib/sync.js [--print <id>]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const MAPS = {
  loch: ['layout_loch', 'src/maps/region4_loch.js'],
  mist_manor_1: ['layout_manor1', 'src/maps/region4_manor.js'],
  mist_manor_2: ['layout_manor2', 'src/maps/region4_manor.js'],
  bell_marsh_1: ['layout_marsh', 'src/maps/region4_marsh.js'],
};
function block(id, L, indent) {
  const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const out = [];
  out.push(indent + '// @rows ' + id);
  out.push(indent + 'rows: [');
  for (const r of L.T.rows()) out.push(indent + '  ' + q(r) + ',');
  out.push(indent + '],');
  out.push(indent + 'decor: [');
  for (const r of L.D.rows()) out.push(indent + '  ' + q(r) + ',');
  out.push(indent + '],');
  out.push(indent + '// @end ' + id);
  return out.join('\n');
}
const argv = process.argv.slice(2);
const pi = argv.indexOf('--print');
for (const [id, [mod, file]] of Object.entries(MAPS)) {
  if (pi >= 0 && argv[pi + 1] !== id) continue;
  const modPath = path.join(__dirname, mod + '.js');
  if (!fs.existsSync(modPath)) continue;
  delete require.cache[require.resolve(modPath)];
  const L = require(modPath)();
  if (pi >= 0) { L.T.rows().forEach((r, y) => console.log(String(y).padStart(2), r)); L.D.rows().forEach((r, y) => console.log(String(y).padStart(2), r)); continue; }
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) { console.log('skip (no file)', file); continue; }
  const src = fs.readFileSync(fp, 'utf8');
  const re = new RegExp('^([ \\t]*)// @rows ' + id + '\\n[\\s\\S]*?// @end ' + id + '$', 'm');
  const m = src.match(re);
  if (!m) { console.log('no markers for', id, 'in', file); continue; }
  const next = src.replace(re, block(id, L, m[1]));
  if (next !== src) { fs.writeFileSync(fp, next); console.log('synced', id, '→', file, L.W + '×' + L.H); }
  else console.log('unchanged', id);
}
