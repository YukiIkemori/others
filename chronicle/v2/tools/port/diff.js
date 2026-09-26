#!/usr/bin/env node
// 移植の元の変化を調べる（CORE、V2_PLAN §1.1）
//
//   node v2/tools/port/diff.js            manifest.json の各行の元（chronicle/ からの相対）を今のハッシュと比べ、
//                                          「写した後に元が変わった」「元が無くなった」を一覧にする（終了コード: 変化あり 1）
//   node v2/tools/port/diff.js --all      変わっていない物も出す
//   node v2/tools/port/diff.js --stamp <src> [--status ported]   その行のハッシュを今の元で取り直す（取り込みを決めたリードだけが使う）
//
// manifest.json = {made, note, files: [{src, dst, how:'as-is'|'port'|'ref'|'copy', owner, status:'ported'|'pending', sha256, bytes}]}
//   status 'ported' = v2 の木に写した（dst がある）。'pending' = P1 で担当が移す（P0 の時点のハッシュを持つ）。
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CHRONICLE = path.resolve(__dirname, '..', '..', '..');
const MAN = path.join(__dirname, 'manifest.json');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
const argv = process.argv.slice(2);
const si = argv.indexOf('--stamp');
if (si >= 0) {
  const src = argv[si + 1];
  const row = m.files.find((r) => r.src === src);
  if (!row) { console.error('no manifest row for ' + src); process.exit(2); }
  const f = path.join(CHRONICLE, src);
  row.sha256 = sha(f); row.bytes = fs.statSync(f).size; row.stamped = new Date().toISOString();
  const st = argv.indexOf('--status'); if (st >= 0) row.status = argv[st + 1];
  fs.writeFileSync(MAN, JSON.stringify(m, null, 1) + '\n');
  console.log('stamped ' + src);
  process.exit(0);
}
let changed = 0;
for (const r of m.files) {
  const f = path.join(CHRONICLE, r.src);
  let state = 'same';
  if (!fs.existsSync(f)) state = 'MISSING';
  else if (sha(f) !== r.sha256) state = 'CHANGED';
  if (state !== 'same') changed++;
  if (state !== 'same' || argv.includes('--all')) console.log(`${state.padEnd(8)} ${r.status.padEnd(8)} ${r.owner.padEnd(10)} ${r.src}${r.dst ? '  → ' + r.dst : ''}`);
}
console.log(`\n${m.files.length} files, ${changed} changed since ${m.made}`);
process.exitCode = changed ? 1 : 0;
