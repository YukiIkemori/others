#!/usr/bin/env node
// check_reg7.js (owner reg7 R7) — runs the shared QA tools filtered to Region 7 and prints one summary:
//   validate --owner R7 · progress --owner R7 --quick · check_text --owner R7 · check_density --owner R7 · test_reg7
// exit 1 when validate / progress / check_text / test_reg7 report errors (density warnings are listed, not fatal:
// the caldera street is enclosed by the crater wall, so check_density counts it as one big "room").
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const run = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const last = (s, re) => (s.split('\n').filter((l) => re.test(l)).pop() || '').trim();
const steps = [
  ['validate', ['tools/validate.js', '--owner', 'R7', '--quiet'], /^validate:/, true],
  ['progress', ['tools/progress.js', '--owner', 'R7', '--quick'], /COMPLETABLE|ERROR \[R7\]/, true],
  ['check_text', ['tools/check_text.js', '--owner', 'R7'], /^check_text:/, true],
  ['check_density', ['tools/check_density.js', '--owner', 'R7'], /^check_density:/, false],
  ['test_reg7', ['tools/test_reg7.js'], /^(OK|FAILED) —/, true],
];
let bad = 0;
for (const [name, args, re, fatal] of steps) {
  const r = run(args);
  const own = r.out.split('\n').filter((l) => /\[R7\]|FAIL:/.test(l));
  console.log(name.padEnd(14) + (r.code === 0 ? 'ok   ' : fatal ? 'FAIL ' : 'warn ') + last(r.out, re));
  for (const l of own.slice(0, 20)) console.log('    ' + l.trim());
  if (r.code !== 0 && fatal) bad++;
}
process.exit(bad ? 1 : 0);
