#!/usr/bin/env node
// check_qa.js (owner qa A22) — the QA sweep of DESIGN §12.6: runs the whole-game checks one after another (the machine
// is shared: never in parallel) and prints one line per tool plus the per-owner error counts.
//
//   node tools/check_qa.js                 build --check, validate, progress, check_text, check_density, playthrough, test_qa
//   node tools/check_qa.js --sims          + sim_balance --quick (§12.3; the full run is `node tools/sim_balance.js`)
//   node tools/check_qa.js --browser       + smoke.js (browser E2E: slice, S-W1–3, S-R1)
//   node tools/check_qa.js --all           + every other owner's tools/test_*.js and tools/check_*.js (their own gates)
//   node tools/check_qa.js --json out.json the results as JSON
// Exit 1 when a gate of §12.6 fails (build, validate, progress, check_text, playthrough, test_qa, smoke if run).
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const flag = (k) => argv.includes('--' + k);
const arg = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };

// tool, args, gate (fails the sweep), summary regex (the line to show), timeout (s)
const CORE = [
  { id: 'build', file: 'build.js', args: ['--check'], gate: true, sum: /\[build\].*|excluded.*/i, t: 120 },
  { id: 'validate', file: 'validate.js', args: [], gate: true, sum: /^validate:.*/m, owners: true, t: 300 },
  { id: 'progress', file: 'progress.js', args: [], gate: true, sum: /(NOT )?COMPLETABLE.*/, owners: true, t: 600 },
  { id: 'check_text', file: 'check_text.js', args: [], gate: true, sum: /^check_text:.*/m, owners: true, t: 300 },
  { id: 'check_density', file: 'check_density.js', args: [], gate: false, sum: /^check_density:.*/m, owners: true, t: 300 },
  { id: 'playthrough', file: 'playthrough.js', args: [], gate: true, sum: /^playthrough:.*/m, owners: true, t: 600 },
  { id: 'test_qa', file: 'test_qa.js', args: [], gate: true, sum: /^test_qa:.*/m, t: 300 },
];
if (flag('sims')) CORE.push({ id: 'sim_balance', file: 'sim_balance.js', args: ['--quick'], gate: false, sum: /^sim_balance:.*/m, t: 1800 });
if (flag('browser')) CORE.push({ id: 'smoke', file: 'smoke.js', args: ['--no-build'], gate: true, sum: /^smoke:.*/m, t: 1800 });

function others() {
  const mine = new Set(['test_qa.js', 'check_qa.js', 'check_text.js', 'check_density.js']);
  return fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => /^(test|check)_.+\.js$/.test(f) && !mine.has(f)).sort()
    .map((f) => ({ id: f.replace(/\.js$/, ''), file: f, args: [], gate: false, sum: null, t: 600, other: true }));
}

function run(tool) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', tool.file)].concat(tool.args), { cwd: ROOT, encoding: 'utf8', timeout: tool.t * 1000, maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const ms = Date.now() - t0;
  const timedOut = !!(r.error && r.error.code === 'ETIMEDOUT');
  let line = '';
  if (tool.sum) { const m = out.match(tool.sum); line = m ? m[0].trim() : ''; }
  if (!line) line = out.trim().split('\n').filter((l) => l.trim()).slice(-1)[0] || '';
  // per-owner error counts: "ERROR [V1][R3] …" (validate) or "ERROR [R3] …" (the others)
  const owners = {};
  if (tool.owners) for (const m of out.matchAll(/^ERROR\s+(?:\[[^\]]+\])?\[([A-Za-z0-9-]+)\]/gm)) owners[m[1]] = (owners[m[1]] || 0) + 1;
  return { id: tool.id, gate: tool.gate, other: !!tool.other, code: timedOut ? 'timeout' : r.status, ok: !timedOut && r.status === 0, ms, line: line.slice(0, 220), owners };
}

(function main() {
  const tools = CORE.concat(flag('all') ? others() : []);
  const res = [];
  const t0 = Date.now();
  console.log(`check_qa: ${tools.length} tool(s), one at a time\n`);
  for (const t of tools) {
    process.stdout.write(`  ${t.id.padEnd(18)} `);
    const r = run(t);
    res.push(r);
    const mark = r.ok ? '✓' : r.gate ? '✗' : '!';
    console.log(`${mark} ${String(r.code).padStart(7)} ${(r.ms / 1000).toFixed(1).padStart(6)}s  ${r.line}`);
  }
  const byOwner = {};
  for (const r of res) for (const [o, n] of Object.entries(r.owners)) { byOwner[o] = byOwner[o] || {}; byOwner[o][r.id] = n; }
  if (Object.keys(byOwner).length) {
    console.log('\nerrors by owner:');
    for (const o of Object.keys(byOwner).sort()) console.log(`  ${o.padEnd(6)} ${Object.entries(byOwner[o]).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  }
  const gates = res.filter((r) => r.gate), failed = gates.filter((r) => !r.ok), otherFail = res.filter((r) => r.other && !r.ok);
  console.log(`\ncheck_qa: gates ${gates.length - failed.length}/${gates.length} ok${failed.length ? ' (failed: ' + failed.map((r) => r.id).join(', ') + ')' : ''}` +
    `${flag('all') ? `; other owners' tools ${res.filter((r) => r.other).length - otherFail.length}/${res.filter((r) => r.other).length} ok${otherFail.length ? ' (failing: ' + otherFail.map((r) => r.id).join(', ') + ')' : ''}` : ''} — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (arg('json')) fs.writeFileSync(path.resolve(arg('json')), JSON.stringify({ when: new Date().toISOString(), results: res, byOwner }, null, 1));
  process.exitCode = failed.length ? 1 : 0;
})();
