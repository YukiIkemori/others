#!/usr/bin/env node
// Writes a screenshot page for the jobs area = debug.html + the menu owner's art
// stubs + tools/fixtures/jobs/state.js, loaded before main.js. Then e.g.
//   node tools/build.js && node tools/fixtures/jobs/make_harness.js /tmp/claude-0/jobs/h.html
//   node tools/shot.js --html /tmp/claude-0/jobs/h.html --eval "RPG.fxJobs.setup(); RPG.Menu.jobScreen({member:0}); 1" --wait 800 --out /tmp/claude-0/jobs/board.png
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const out = process.argv[2] || '/tmp/claude-0/jobs/harness.html';
let html = fs.readFileSync(path.join(ROOT, 'debug.html'), 'utf8');
const fx = ['tools/fixtures/menu/stubs.js', 'tools/fixtures/jobs/state.js'].filter((f) => fs.existsSync(path.join(ROOT, f)));
html = html.replace('<script src="src/main.js"></script>', fx.map((f) => `<script src="${f}"></script>`).join('\n') + '\n<script src="src/main.js"></script>');
html = html.replace('<head>', `<head>\n<base href="file://${ROOT}/">`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('harness →', out);
