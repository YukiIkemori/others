#!/usr/bin/env node
// Build: concatenate src/**.js (fixed directory order) into a single
// self-contained dist/index.html, and write debug.html that loads each file
// separately (better stack traces while developing).
//
//   node tools/build.js           build both
//   node tools/build.js --check   syntax-check only (exit 1 on error)
//
// Files that fail to parse are EXCLUDED with a warning (so one broken file
// being edited concurrently does not break everyone else's build).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const TITLE = 'ルミナス・クロニクル';
const DIRS = ['core', 'ui', 'data', 'art', 'audio', 'maps', 'events', 'systems'];
const CORE_FIRST = ['ns.js', 'input.js', 'gfx.js', 'engine.js', 'save.js'];

function listFiles() {
  const out = [];
  for (const d of DIRS) {
    const dir = path.join(SRC, d);
    if (!fs.existsSync(dir)) continue;
    let files = walk(dir).filter((f) => f.endsWith('.js'));
    files.sort((a, b) => {
      if (d === 'core') {
        const ia = CORE_FIRST.indexOf(path.basename(a)), ib = CORE_FIRST.indexOf(path.basename(b));
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return a.localeCompare(b);
    });
    out.push(...files);
  }
  const main = path.join(SRC, 'main.js');
  if (fs.existsSync(main)) out.push(main);
  return out;
}
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}

function check(files) {
  const ok = [], bad = [];
  for (const f of files) {
    const code = fs.readFileSync(f, 'utf8');
    try { new vm.Script(code, { filename: f }); ok.push(f); }
    catch (e) { bad.push({ f, e }); }
  }
  return { ok, bad };
}

const CSS = `
html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
body{display:flex;align-items:center;justify-content:center;font-family:"DotGothic16",monospace;color:#fff}
#game{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100vw;height:100vh;height:100dvh}
#screen{display:block;image-rendering:pixelated;image-rendering:crisp-edges;background:#000;box-shadow:0 0 0 1px #222}
#touchpad{display:none;position:relative;width:100%;max-width:560px;box-sizing:border-box;padding:50px 18px 14px;justify-content:space-between;align-items:center;flex:0 0 auto}
#game.touch #touchpad{display:flex}
.tp-dpad{position:relative;width:150px;height:150px;flex:0 0 auto}
.tp-btn{position:absolute;background:#2a2a36;border:2px solid #555a70;border-radius:10px;color:#cfd3e6;font:bold 22px sans-serif;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.tp-btn.on{background:#5a6090;border-color:#9aa0d0}
.tp-up{left:50px;top:0;width:50px;height:54px}
.tp-down{left:50px;bottom:0;width:50px;height:54px}
.tp-left{left:0;top:50px;width:54px;height:50px}
.tp-right{right:0;top:50px;width:54px;height:50px}
.tp-center{position:absolute;left:50px;top:50px;width:50px;height:50px;background:#2a2a36}
.tp-ab{position:relative;width:190px;height:150px;flex:0 0 auto}
.tp-a,.tp-b,.tp-y{border-radius:50%;width:74px;height:74px}
.tp-a{right:0;top:22px;background:#6a2830;border-color:#b05060}
.tp-b{left:42px;bottom:0;background:#28406a;border-color:#5070b0}
.tp-y{left:0;top:0;width:60px;height:60px;font-size:19px;background:#2c5234;border-color:#58a068}
.tp-a.on{background:#a04050}.tp-b.on{background:#4060a0}.tp-y.on{background:#3f7a4c}
.tp-l,.tp-r{top:8px;width:84px;height:36px;border-radius:18px;font-size:17px}
.tp-l{left:18px}.tp-r{right:18px}
@media (orientation:landscape){#game.touch{flex-direction:row}#game.touch #touchpad{position:absolute;inset:0;max-width:none;pointer-events:none;padding:0 12px}#game.touch .tp-dpad,#game.touch .tp-ab,#game.touch .tp-l,#game.touch .tp-r{pointer-events:auto}#game.touch .tp-l{left:14px;top:14px}#game.touch .tp-r{right:14px;top:14px}#game.touch #touchpad{align-items:flex-end;padding-bottom:20px}}
`;

// Embed a subset of DotGothic16 (OFL) containing every character used in the
// sources, so the game renders identically offline / inside sandboxed hosts.
// Falls back to the Google Fonts stylesheet if fonttools is unavailable.
const FONT_TTF = path.join(ROOT, 'assets', 'fonts', 'DotGothic16-Regular.ttf');
function fontCss(files) {
  const gf = '<link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet">';
  try {
    if (!fs.existsSync(FONT_TTF)) return gf;
    const chars = new Set();
    const add = (s) => { for (const ch of s) chars.add(ch); };
    for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
    for (let c = 0x3000; c < 0x3100; c++) chars.add(String.fromCharCode(c)); // punct, hiragana, katakana
    for (let c = 0xff01; c < 0xff5f; c++) chars.add(String.fromCharCode(c)); // full-width forms
    add('▶▼▲◀♪★☆…→←↑↓○●◆◇■□♥♡※×÷±〜～・「」『』【】（）！？');
    for (const f of files) add(fs.readFileSync(f, 'utf8'));
    const text = [...chars].filter((ch) => ch.codePointAt(0) >= 0x20).sort().join('');
    const hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
    const cacheDir = path.join(ROOT, 'dist', '.fontcache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const out = path.join(cacheDir, hash + '.woff2');
    if (!fs.existsSync(out)) {
      const txt = path.join(cacheDir, hash + '.txt');
      fs.writeFileSync(txt, text);
      execFileSync('pyftsubset', [FONT_TTF, '--text-file=' + txt, '--flavor=woff2', '--output-file=' + out, '--layout-features=*'], { stdio: 'pipe' });
      for (const f of fs.readdirSync(cacheDir)) if (!f.startsWith(hash)) fs.unlinkSync(path.join(cacheDir, f));
    }
    const b64 = fs.readFileSync(out).toString('base64');
    return `<style>@font-face{font-family:"DotGothic16";src:url(data:font/woff2;base64,${b64}) format("woff2");font-display:block}</style>`;
  } catch (e) {
    console.warn('\n[build] !!!!! FONT SUBSET FAILED — dist would need the network for its font. Run: pip install fonttools brotli');
    console.warn('[build] font subset failed, using Google Fonts link:', String(e.message || e).split('\n')[0]);
    return gf;
  }
}
let FONT_HEAD = '';

function html(body, title) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#000000">
<title>${title}</title>
${FONT_HEAD}
<style>${CSS}</style>
</head>
<body>
<div id="game"><canvas id="screen" width="768" height="672"></canvas></div>
${body}
</body>
</html>
`;
}

function main() {
  const files = listFiles();
  const { ok, bad } = check(files);
  for (const b of bad) {
    console.warn(`\n[build] SYNTAX ERROR — excluded: ${path.relative(ROOT, b.f)}`);
    console.warn(String(b.e.stack || b.e).split('\n').slice(0, 6).join('\n'));
  }
  if (process.argv.includes('--check')) { process.exit(bad.length ? 1 : 0); }
  FONT_HEAD = fontCss(ok);

  const parts = ok.map((f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const code = fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script');
    return `// ==== ${rel}\ntry{\n${code}\n}catch(e){(window.RPG=window.RPG||{}).loadErrors=(window.RPG.loadErrors||[]);window.RPG.loadErrors.push(${JSON.stringify(rel)}+': '+(e&&e.stack||e));console.error(${JSON.stringify(rel)},e);}`;
  });
  const bundle = parts.join('\n');
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), html(`<script>\n${bundle}\n</script>`, TITLE));
  const tag = (f) => `<script src="${path.relative(ROOT, f).replace(/\\/g, '/')}"></script>`;
  const tags = ok.map(tag).join('\n');
  fs.writeFileSync(path.join(ROOT, 'debug.html'), html(tags, TITLE + ' (debug)'));
  // --with <dir>: debug_<name>.html = sources + <dir>/*.js (fixtures) inserted before main.js
  const wi = process.argv.indexOf('--with');
  if (wi > 0 && process.argv[wi + 1]) {
    const dir = path.resolve(process.argv[wi + 1]);
    const extra = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(dir, f));
    const { ok: xok, bad: xbad } = check(extra);
    for (const b of xbad) console.warn(`[build] fixture SYNTAX ERROR — excluded: ${path.relative(ROOT, b.f)}`);
    const main = ok.filter((f) => path.basename(f) === 'main.js' && path.dirname(f) === SRC);
    const rest = ok.filter((f) => !main.includes(f));
    const name = 'debug_' + path.basename(dir) + '.html';
    fs.writeFileSync(path.join(ROOT, name), html([...rest, ...xok, ...main].map(tag).join('\n'), TITLE + ' (' + path.basename(dir) + ')'));
    console.log(`[build] ${name} with ${xok.length} fixture file(s) from ${path.relative(ROOT, dir)}`);
  }
  const kb = (fs.statSync(path.join(ROOT, 'dist', 'index.html')).size / 1024).toFixed(0);
  console.log(`[build] ${ok.length} files → dist/index.html (${kb} KB), debug.html` + (bad.length ? `  (${bad.length} excluded!)` : ''));
  if (bad.length) process.exitCode = 1;
}
main();
