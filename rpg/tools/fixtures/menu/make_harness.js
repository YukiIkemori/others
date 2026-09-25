#!/usr/bin/env node
// Writes a menu test page = debug.html + menu fixtures (+ field test maps/art),
// loaded before main.js.
//   node tools/fixtures/menu/make_harness.js [/tmp/claude-0/menu/harness.html]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const out = process.argv[2] || '/tmp/claude-0/menu/harness.html';
let html = fs.readFileSync(path.join(ROOT, 'debug.html'), 'utf8');
const fx = ['tools/fixtures/menu/stubs.js', 'tools/fixtures/menu/state.js'];
for (const f of ['tools/fixtures/field/maps.js', 'tools/fixtures/field/art_stub.js']) if (fs.existsSync(path.join(ROOT, f))) fx.push(f);
const tags = fx.map((f) => `<script src="${f}"></script>`).join('\n');
html = html.replace('<script src="src/main.js"></script>', tags + '\n<script src="src/main.js"></script>');
html = html.replace('<head>', `<head>\n<base href="file://${ROOT}/">`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('harness →', out);
