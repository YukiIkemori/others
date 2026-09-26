#!/usr/bin/env node
// Build: concatenate src/**.js (fixed directory order) into a single
// self-contained dist/index.html, and write debug.html that loads each file
// separately (better stack traces while developing).
//
//   node tools/build.js           build both
//   node tools/build.js --check   syntax-check only (exit 1 on error)
//
// Recorded audio (BRIEF A9/A10): assets/bgm/<id>.(ogg|m4a|mp3|wav) (+ optional <id>.json
// {loopStart, loopEnd, gain, loop}) and assets/voice/<id>.(ogg|m4a|mp3|wav) are listed in
// window.RPG_MEDIA, which src/core/audio.js reads. By default they are embedded in dist/index.html as
// base64 data: URLs (one self-contained file). Options:
//   --bgm external     copy the BGM files to dist/bgm/ and load them by relative URL (smaller html;
//                      needs the page served over http(s), e.g. `npx http-server dist` — file:// cannot fetch)
//   --voice external   the same for voice lines (dist/voice/)
//   --media <dir>      read bgm/ and voice/ from <dir> instead of assets/ (tests)
//   --out <dir>        write index.html (and bgm/, voice/) to <dir> instead of dist/, skip debug*.html (tests)
// debug.html always loads the files from assets/ by relative URL. No option contacts another host.
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

// ------------------------------------------------------------------ recorded audio
const MEDIA_EXT = ['ogg', 'm4a', 'mp3', 'wav']; // preference when one id has several files
const MIME = { ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav' };
const argVal = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
/** {bgm:[{id, file, ext, meta}], voice:[…]} from <root>/bgm and <root>/voice (ids: [a-z0-9_]+) */
function scanMedia(root) {
  const out = { bgm: [], voice: [] };
  for (const kind of ['bgm', 'voice']) {
    const dir = path.join(root, kind);
    if (!fs.existsSync(dir)) continue;
    const byId = {};
    for (const f of fs.readdirSync(dir).sort()) {
      const m = /^([a-z0-9_]+)\.([a-z0-9]+)$/.exec(f);
      if (!m || !MEDIA_EXT.includes(m[2])) continue;
      const [, id, ext] = m;
      if (!byId[id] || MEDIA_EXT.indexOf(ext) < MEDIA_EXT.indexOf(byId[id].ext)) byId[id] = { id, ext, file: path.join(dir, f) };
    }
    for (const id of Object.keys(byId).sort()) {
      const e = byId[id];
      e.meta = {};
      const js = path.join(dir, id + '.json');
      if (kind === 'bgm' && fs.existsSync(js)) {
        try {
          const j = JSON.parse(fs.readFileSync(js, 'utf8'));
          for (const k of ['loopStart', 'loopEnd', 'gain']) if (typeof j[k] === 'number' && isFinite(j[k]) && j[k] >= 0) e.meta[k] = j[k];
          if (j.loop === false) e.meta.loop = false;
        } catch (err) { console.warn(`[build] ${path.relative(ROOT, js)}: bad JSON, loop points ignored (${err.message})`); }
      }
      out[kind].push(e);
    }
  }
  return out;
}
/** window.RPG_MEDIA for a page. mode[kind]: 'embed' (data: URL) | 'external' (<kind>/<file>) | 'assets' (debug) */
function mediaTable(media, mode, outDir, mediaRoot) {
  const table = { bgm: {}, voice: {} };
  let bytes = 0;
  for (const kind of ['bgm', 'voice']) {
    const extDir = path.join(outDir || '', kind);
    if (outDir && mode[kind] === 'external') {
      fs.mkdirSync(extDir, { recursive: true });
      const want = new Set(media[kind].map((e) => e.id + '.' + e.ext));
      for (const f of fs.readdirSync(extDir)) if (!want.has(f)) fs.unlinkSync(path.join(extDir, f));
    } else if (outDir && fs.existsSync(extDir)) fs.rmSync(extDir, { recursive: true, force: true });
    for (const e of media[kind]) {
      let src;
      if (mode[kind] === 'embed') {
        const buf = fs.readFileSync(e.file);
        bytes += buf.length;
        src = `data:${MIME[e.ext]};base64,${buf.toString('base64')}`;
      } else if (mode[kind] === 'external') {
        fs.copyFileSync(e.file, path.join(extDir, e.id + '.' + e.ext));
        src = kind + '/' + e.id + '.' + e.ext;
      } else src = path.relative(ROOT, e.file).replace(/\\/g, '/');
      table[kind][e.id] = Object.assign({ src }, e.meta);
    }
  }
  const script = media.bgm.length || media.voice.length
    ? `<script>window.RPG_MEDIA=${JSON.stringify(table)};</script>\n` : '';
  return { script, bytes, table };
}

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
<div id="game"><canvas id="screen" width="1024" height="896"></canvas></div>
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
  const OUT = path.resolve(argVal('--out', path.join(ROOT, 'dist')));
  const custom = process.argv.includes('--out');
  const mediaRoot = path.resolve(argVal('--media', path.join(ROOT, 'assets')));
  const media = scanMedia(mediaRoot);
  const mode = { bgm: argVal('--bgm', 'embed'), voice: argVal('--voice', 'embed') };
  for (const k of ['bgm', 'voice']) if (!['embed', 'external'].includes(mode[k])) { console.error(`[build] --${k} must be embed or external`); process.exit(2); }

  const parts = ok.map((f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const code = fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script');
    return `// ==== ${rel}\ntry{\n${code}\n}catch(e){(window.RPG=window.RPG||{}).loadErrors=(window.RPG.loadErrors||[]);window.RPG.loadErrors.push(${JSON.stringify(rel)}+': '+(e&&e.stack||e));console.error(${JSON.stringify(rel)},e);}`;
  });
  const bundle = parts.join('\n');
  fs.mkdirSync(OUT, { recursive: true });
  const M = mediaTable(media, mode, OUT, mediaRoot);
  fs.writeFileSync(path.join(OUT, 'index.html'), html(`${M.script}<script>\n${bundle}\n</script>`, TITLE));
  const mediaNote = media.bgm.length || media.voice.length
    ? `  media: ${media.bgm.length} BGM (${mode.bgm}), ${media.voice.length} voice (${mode.voice}), ${(M.bytes / 1048576).toFixed(1)} MB embedded` : '';
  if (M.bytes > 40 * 1048576) console.warn('[build] more than 40 MB of audio embedded — consider --bgm external');
  if (custom) {
    const kb = (fs.statSync(path.join(OUT, 'index.html')).size / 1024).toFixed(0);
    console.log(`[build] ${ok.length} files → ${path.relative(ROOT, OUT) || '.'}/index.html (${kb} KB)` + mediaNote);
    if (bad.length) process.exitCode = 1;
    return;
  }
  const DBG = mediaTable(media, { bgm: 'assets', voice: 'assets' }, null, mediaRoot).script;
  const tag = (f) => `<script src="${path.relative(ROOT, f).replace(/\\/g, '/')}"></script>`;
  const tags = ok.map(tag).join('\n');
  fs.writeFileSync(path.join(ROOT, 'debug.html'), html(DBG + tags, TITLE + ' (debug)'));
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
    fs.writeFileSync(path.join(ROOT, name), html(DBG + [...rest, ...xok, ...main].map(tag).join('\n'), TITLE + ' (' + path.basename(dir) + ')'));
    console.log(`[build] ${name} with ${xok.length} fixture file(s) from ${path.relative(ROOT, dir)}`);
  }
  const kb = (fs.statSync(path.join(ROOT, 'dist', 'index.html')).size / 1024).toFixed(0);
  console.log(`[build] ${ok.length} files → dist/index.html (${kb} KB), debug.html` + mediaNote + (bad.length ? `  (${bad.length} excluded!)` : ''));
  if (bad.length) process.exitCode = 1;
}
main();
