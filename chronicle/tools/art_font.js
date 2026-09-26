#!/usr/bin/env node
// Art prototype (BRIEF Part A16): subset the smooth UI font for the hi-res renderer.
//
//   node tools/art_font.js [--src design/art_proto/fonts] [--out design/art_proto/fonts]
//
// Font: Zen Maru Gothic (SIL OFL 1.1, fonts/OFL_ZenMaruGothic.txt). Fetched once at tool time from
// github.com/google/fonts; the game never touches the network. The subset holds every character that appears
// in src/ (all game text), the jōyō kanji (tools/lib/joyo.txt, for name entry / later text), kana, ASCII,
// full-width forms and the UI symbols. Output: ZenMaru-{Medium,Bold}.subset.woff2 (~0.5–0.8 MB each).
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = path.resolve(ROOT, arg('--src', 'design/art_proto/fonts'));
const OUT = path.resolve(ROOT, arg('--out', 'design/art_proto/fonts'));

const chars = new Set();
const add = (s) => { for (const ch of s) chars.add(ch); };
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.js$/.test(f)) add(fs.readFileSync(p, 'utf8')); } };
walk(path.join(ROOT, 'src'));
const joyo = path.join(ROOT, 'tools/lib/joyo.txt');
if (fs.existsSync(joyo)) add(fs.readFileSync(joyo, 'utf8'));
const range = (a, b) => { for (let c = a; c <= b; c++) chars.add(String.fromCodePoint(c)); };
range(0x20, 0x7e); range(0x3000, 0x30ff); range(0xff01, 0xff9f); range(0x2190, 0x21ff); range(0x25a0, 0x25ff); range(0x2600, 0x266f);
add('…‥―—・「」『』【】〜☆★◆◇○●△▲▽▼♪♥');
const list = [...chars].filter((c) => c.codePointAt(0) >= 0x20);
const txt = path.join(OUT, '.subset_chars.txt');
fs.writeFileSync(txt, list.join(''));
for (const w of ['Medium', 'Bold']) {
  const src = path.join(SRC, `ZenMaruGothic-${w}.ttf`);
  if (!fs.existsSync(src)) { console.log('missing', src); continue; }
  const out = path.join(OUT, `ZenMaru-${w}.subset.woff2`);
  execFileSync('pyftsubset', [src, `--text-file=${txt}`, '--flavor=woff2', `--output-file=${out}`, '--layout-features=*', '--no-hinting'], { stdio: 'inherit' });
  console.log(`${path.relative(ROOT, out)}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB  (${list.length} chars)`);
}
fs.rmSync(txt);
