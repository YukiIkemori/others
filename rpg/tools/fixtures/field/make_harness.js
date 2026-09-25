#!/usr/bin/env node
// Writes a test page = debug.html + the field fixtures (loaded before main.js).
//   node tools/fixtures/field/make_harness.js /tmp/claude-0/field/harness.html [--no-stub-art] [--no-stub-battle]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const out = process.argv[2] || '/tmp/claude-0/field/harness.html';
const args = process.argv.slice(3);
let html = fs.readFileSync(path.join(ROOT, 'debug.html'), 'utf8');
const fx = ['tools/fixtures/field/maps.js'];
if (!args.includes('--no-stub-art')) fx.push('tools/fixtures/field/art_stub.js');
if (!args.includes('--no-stub-battle')) fx.push('tools/fixtures/field/battle_stub.js');
const tags = fx.map((f) => `<script src="${f}"></script>`).join('\n');
html = html.replace('<script src="src/main.js"></script>', tags + '\n<script src="src/main.js"></script>');
html = html.replace('<head>', `<head>\n<base href="file://${ROOT}/">`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('harness →', out);
