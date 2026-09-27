#!/usr/bin/env node
// v2 のビルド（CORE、V2_PLAN §2.7）
//
//   node v2/tools/build.js                 v2/dist/index.html（遊ぶ用）と v2/dist/dev.html（dev/ とフィクスチャ入り）
//   node v2/tools/build.js --single        媒体（BGM・ボイス・顔絵）を全部埋め込んだ 1 枚の index.html（オーナーに渡す版）
//   node v2/tools/build.js --check         構文だけ調べる（壊れたファイルがあれば終了コード 1）
//   オプション:
//     --media <dir>        bgm/・voice/・portraits/ を読む元（既定 chronicle/assets）
//     --all-bgm            縦切りで使わない BGM も入れる（既定は §3.10 の 17 曲だけ = --slice）
//     --portraits <m>      approved（既定。chronicle/design/portraits/manifest.json で approved の物だけ）| all | none
//     --out <dir>          出力先（既定 v2/dist。テスト用）
//     --with <dir>         フィクスチャを足した dev_<dir の名前>.html も作る（<dir>/states/*.json・scenes/*.json・*.js）
//     --no-dev             dev.html を作らない
//
// 読み込みの順（§2.4）: core（ns util bus engine fit gfx の順、残りは名前順・再帰）→ render → uik → data → art → audio
//   → maps → events → systems → screens →（dev.html だけ dev）→ main.js。各ディレクトリの中は名前順（再帰）。
// 構文の壊れたファイルは警告して外す（誰かの作業中の壊れでほかの人が止まらない）。
// 書体: 使う字を src/** とフィクスチャから集め、Zen Maru Gothic（Medium・Bold）を pyftsubset で woff2 に切り出して埋め込む。
//   Cinzel（英字）は latin の woff2 をそのまま埋め込む。どちらも OFL（v2/assets/fonts/OFL_*.txt）。
// 媒体: 既定は外に置く（dist/bgm・dist/voice・dist/portraits に写す）。--single は <script type="application/octet-stream">
//   の base64 として置き、起動時には解かない（初めて使うときに core/media.js が Blob にする）。
// どの版も実行時に外へ通信しない（書体も埋め込み。外のスタイルシートを読まない）。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const V2 = path.resolve(__dirname, '..');
const CHRONICLE = path.resolve(V2, '..');
const SRC = path.join(V2, 'src');
const TITLE = 'ルミナス・クロニクル 〜八つの灯火〜';
const DIRS = ['core', 'render', 'uik', 'data', 'art', 'audio', 'maps', 'events', 'systems', 'screens'];
const CORE_FIRST = ['ns.js', 'util.js', 'bus.js', 'engine.js', 'fit.js', 'gfx.js'];
// 縦切りの BGM（§3.10 の 17 曲）
const SLICE_BGM = ['title', 'home', 'town', 'tavern', 'overworld', 'tower', 'battle', 'boss', 'boss2', 'rarebattle', 'village', 'forest',
  'shrine', 'cave', 'sorrow', 'legend', 'tension'];
const EXPRS = ['neutral', 'smile', 'sad', 'angry', 'surprise'];
const MEDIA_EXT = { bgm: ['ogg', 'm4a', 'mp3', 'wav'], voice: ['ogg', 'm4a', 'mp3', 'wav'], portraits: ['webp', 'png', 'jpg'] };
const MIME = { ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };

// ------------------------------------------------------------------ ファイルの順番
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const rel = (f) => path.relative(V2, f).replace(/\\/g, '/');
const byName = (a, b) => (rel(a) < rel(b) ? -1 : rel(a) > rel(b) ? 1 : 0);
/** 読み込む順のファイルの一覧（絶対パス）。o.dev で src/dev/* を main.js の前に入れる */
function order(o) {
  o = o || {};
  const out = [];
  for (const d of DIRS) {
    const list = walk(path.join(SRC, d)).sort((a, b) => {
      if (d === 'core') {
        const ia = path.dirname(a) === path.join(SRC, 'core') ? CORE_FIRST.indexOf(path.basename(a)) : -1;
        const ib = path.dirname(b) === path.join(SRC, 'core') ? CORE_FIRST.indexOf(path.basename(b)) : -1;
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return byName(a, b);
    });
    out.push(...list);
  }
  if (o.dev) out.push(...walk(path.join(SRC, 'dev')).sort(byName));
  const main = path.join(SRC, 'main.js');
  if (fs.existsSync(main)) out.push(main);
  return out;
}

function syntax(files) {
  const ok = [], bad = [];
  for (const f of files) {
    try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); ok.push(f); } catch (e) { bad.push({ f, e }); }
  }
  return { ok, bad };
}

// ------------------------------------------------------------------ フィクスチャ（§2.6.7）
/** {states: {name: obj}, scenes: {name: obj}}。dirs は tools/fixtures と同じ形のディレクトリの一覧 */
function fixtures(dirs) {
  dirs = dirs || [path.join(V2, 'tools', 'fixtures')];
  const out = { states: {}, scenes: {} };
  for (const dir of dirs) {
    for (const kind of ['states', 'scenes']) {
      const d = path.join(dir, kind);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort()) {
        const name = f.slice(0, -5);
        try { out[kind][name] = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch (e) { console.warn(`[build] fixture ${rel(path.join(d, f))}: bad JSON (${e.message}) — skipped`); }
        if (!/^[a-z0-9]+(-[a-z0-9]+)?_/.test(name)) console.warn(`[build] fixture ${kind}/${f}: the name should start with the owner prefix (core_, field_, …)`);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ 書体
const FONT_DIR = path.join(V2, 'assets', 'fonts');
function fontCss(texts, cacheDir) {
  const chars = new Set();
  const add = (s) => { for (const ch of s) chars.add(ch); };
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  for (let c = 0x3000; c < 0x3100; c++) chars.add(String.fromCharCode(c)); // 記号・ひらがな・カタカナ
  for (let c = 0xff01; c < 0xff5f; c++) chars.add(String.fromCharCode(c)); // 全角の英数と記号
  add('▶▼▲◀♪★☆…→←↑↓○●◆◇■□♥♡※×÷±〜～・「」『』【】（）！？©≡─━│┃');
  for (const t of texts) add(t);
  const text = [...chars].filter((ch) => ch.codePointAt(0) >= 0x20 && !(ch.codePointAt(0) >= 0xd800 && ch.codePointAt(0) < 0xe000)).sort().join('');
  const hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
  fs.mkdirSync(cacheDir, { recursive: true });
  const faces = [];
  const zen = [['ZenMaruGothic-Medium.ttf', 500], ['ZenMaruGothic-Bold.ttf', 700]];
  let subsetOk = true;
  for (const [file, weight] of zen) {
    const src = path.join(FONT_DIR, file);
    const out = path.join(cacheDir, `${hash}-${weight}.woff2`);
    try {
      if (!fs.existsSync(out)) {
        const txt = path.join(cacheDir, hash + '.txt');
        fs.writeFileSync(txt, text);
        execFileSync('pyftsubset', [src, '--text-file=' + txt, '--flavor=woff2', '--output-file=' + out, '--layout-features=*', '--no-hinting'], { stdio: 'pipe' });
      }
      faces.push(`@font-face{font-family:"Zen Maru Gothic";font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(out).toString('base64')}) format("woff2")}`);
    } catch (e) {
      subsetOk = false;
      console.warn(`[build] !!!!! font subset failed for ${file}: ${String(e.message || e).split('\n')[0]}`);
      console.warn('[build] the page falls back to the system font (no network is used). Fix: pip install fonttools brotli');
    }
  }
  for (const f of fs.readdirSync(cacheDir)) if (!f.startsWith(hash)) fs.unlinkSync(path.join(cacheDir, f));
  for (const [file, weight] of [['cinzel-latin-400-normal.woff2', 400], ['cinzel-latin-700-normal.woff2', 700]]) {
    const p = path.join(FONT_DIR, file);
    if (fs.existsSync(p)) faces.push(`@font-face{font-family:"Cinzel";font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(p).toString('base64')}) format("woff2")}`);
  }
  const bytes = faces.reduce((s, f) => s + f.length, 0);
  return { css: faces.join('\n'), chars: text.length, bytes, ok: subsetOk };
}

// ------------------------------------------------------------------ 媒体
/** {bgm: [{id, file, ext, meta}], voice: […], portraits: [{id: 'portrait:<look>:<expr>', file, ext}]} */
function scanMedia(root, o) {
  const out = { bgm: [], voice: [], portraits: [] };
  for (const kind of ['bgm', 'voice', 'portraits']) {
    const dir = path.join(root, kind);
    if (!fs.existsSync(dir)) continue;
    const byId = {};
    for (const f of fs.readdirSync(dir).sort()) {
      const m = /^([a-z0-9_]+)\.([a-z0-9]+)$/.exec(f);
      if (!m || !MEDIA_EXT[kind].includes(m[2])) continue;
      let id = m[1];
      if (kind === 'portraits') {
        const pm = /^(.+)_([a-z]+)$/.exec(id);
        if (!pm || !EXPRS.includes(pm[2])) { console.warn(`[build] portraits/${f}: name must be <look>_<expr> (expr: ${EXPRS.join(' ')}) — skipped`); continue; }
        id = `portrait:${pm[1]}:${pm[2]}`;
      }
      const ext = m[2];
      if (!byId[id] || MEDIA_EXT[kind].indexOf(ext) < MEDIA_EXT[kind].indexOf(byId[id].ext)) byId[id] = { id, ext, file: path.join(dir, f), meta: {} };
    }
    for (const id of Object.keys(byId).sort()) {
      const e = byId[id];
      if (kind === 'bgm') {
        if (o.slice && !SLICE_BGM.includes(id)) continue;
        const js = path.join(dir, id + '.json');
        if (fs.existsSync(js)) {
          // ループ点と音量だけを読む（ほかの項目＝生成の記録は dist に出さない）
          try {
            const j = JSON.parse(fs.readFileSync(js, 'utf8'));
            for (const k of ['loopStart', 'loopEnd', 'gain']) if (typeof j[k] === 'number' && isFinite(j[k]) && j[k] >= 0) e.meta[k] = j[k];
            if (j.loop === false) e.meta.loop = false;
          } catch (err) { console.warn(`[build] ${js}: bad JSON, loop points ignored (${err.message})`); }
        }
      }
      if (kind === 'portraits' && o.portraits !== 'all') {
        if (o.portraits === 'none') continue;
        const [, look, expr] = id.split(':');
        const rec = (o.portraitManifest || []).find((r) => r && r.look === look);
        if (!rec || rec.status !== 'approved' || (Array.isArray(rec.exprs) && !rec.exprs.includes(expr))) continue;
      }
      out[kind].push(e);
    }
  }
  return out;
}
/** 版 2: CAST の原画の取り込み。v2/assets/sprites/<look>/<kind>.png（＋同じ名前の .json = meta）→ sprites['<look>:<kind>'] */
const SPRITES_DIR = path.join(V2, 'assets', 'sprites');
function scanSprites(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const look of fs.readdirSync(root).sort()) {
    const d = path.join(root, look);
    if (!/^[a-z0-9_]+$/.test(look) || !fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d).sort()) {
      const m = /^([a-z0-9_]+)\.png$/.exec(f);
      if (!m) continue;
      let meta = null;
      const js = path.join(d, m[1] + '.json');
      if (fs.existsSync(js)) { try { meta = JSON.parse(fs.readFileSync(js, 'utf8')); } catch (e) { console.warn(`[build] ${js}: bad JSON (${e.message})`); } }
      out.push({ id: `${look}:${m[1]}`, ext: 'png', file: path.join(d, f), meta, outName: `${look}.${m[1]}.png` });
    }
  }
  return out;
}
/** 地形・戦闘背景の画像（TERRAIN/BEAST、v2/design/ENV_ASSETS.md）。v2/assets/env/<theme>/<sub>/<name>@<tile>.png ＋ <id>.json（meta）
 *  → env['<theme>/<sub>/<file>'] = {url, meta}（meta は同じ id の .json。bbg は <bbg>/<layer>.png） */
const ENV_DIR = path.join(V2, 'assets', 'env');
function scanEnv(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const walkEnv = (d, rel) => {
    for (const f of fs.readdirSync(d).sort()) {
      const full = path.join(d, f), r = rel ? rel + '/' + f : f;
      if (fs.statSync(full).isDirectory()) { walkEnv(full, r); continue; }
      if (!/\.png$/.test(f)) continue;
      out.push({ id: r.replace(/\.png$/, ''), ext: 'png', file: full, meta: null, outName: 'env.' + r.replace(/\//g, '.') });
    }
  };
  walkEnv(root, '');
  // meta: 同じディレクトリの <id>.json（名前の @ より前、_emit を除く。bbg は <bbg>.json）
  const metas = {};
  const readMeta = (dir, id) => {
    const k = dir + '/' + id;
    if (k in metas) return metas[k];
    const js = path.join(dir, id + '.json');
    let m = null;
    if (fs.existsSync(js)) { try { m = JSON.parse(fs.readFileSync(js, 'utf8')); delete m.src; delete m.def_; } catch (e) { console.warn(`[build] ${js}: bad JSON`); } }
    return (metas[k] = m);
  };
  for (const e of out) {
    const dir = path.dirname(e.file), base = path.basename(e.file, '.png');
    const id = /\/bbg\//.test(e.file) ? path.basename(dir) : base.replace(/@\d+$/, '').replace(/_emit$/, '');
    e.meta = readMeta(dir, id);
  }
  return out;
}
function copyIfChanged(src, dst) {
  try {
    const a = fs.statSync(src), b = fs.existsSync(dst) && fs.statSync(dst);
    if (b && a.size === b.size && a.mtimeMs <= b.mtimeMs) return;
  } catch (e) { /* 写す */ }
  fs.copyFileSync(src, dst);
}
/** → {script, embeds, bytes}。mode 'external' は outDir/<kind>/ に写して相対 URL、'embed' は埋め込み、'none' は空 */
function mediaTable(media, mode, outDir) {
  const table = { bgm: {}, voice: {}, portraits: {}, sprites: {}, env: {} };
  const embeds = [];
  let bytes = 0;
  media.sprites = media.sprites || [];
  media.env = media.env || [];
  const base = (e) => e.outName || path.basename(e.file);
  for (const kind of ['bgm', 'voice', 'portraits', 'sprites', 'env']) {
    const extDir = path.join(outDir, kind);
    if (mode === 'external') {
      fs.mkdirSync(extDir, { recursive: true });
      const want = new Set(media[kind].map(base));
      for (const f of fs.readdirSync(extDir)) if (!want.has(f)) fs.unlinkSync(path.join(extDir, f));
    }
    for (const e of media[kind]) {
      let url;
      if (mode === 'embed') {
        const buf = fs.readFileSync(e.file);
        bytes += buf.length;
        const ref = `media:${kind}:${e.id}`;
        embeds.push(`<script type="application/octet-stream" id="${ref}" data-type="${MIME[e.ext]}">${buf.toString('base64')}</script>`);
        url = '#' + ref;
      } else if (mode === 'external') {
        copyIfChanged(e.file, path.join(extDir, base(e)));
        bytes += fs.statSync(e.file).size;
        url = kind + '/' + base(e);
      } else continue;
      table[kind][e.id] = kind === 'bgm' ? Object.assign({ url }, e.meta) : kind === 'sprites' || kind === 'env' ? { url, meta: e.meta } : url;
    }
  }
  return { script: `<script>window.RPG_MEDIA=${JSON.stringify(table)};</script>`, embeds: embeds.join('\n'), bytes, counts: { bgm: media.bgm.length, voice: media.voice.length, portraits: media.portraits.length, sprites: media.sprites.length, env: media.env.length } };
}

// ------------------------------------------------------------------ HTML
const CSS = `html,body{margin:0;padding:0;height:100%;background:#070812;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
#screen{position:absolute;display:block;left:0;top:0;outline:none}
#safe-probe{position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}`;
function page(o) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#070812">
<meta name="generator" content="luminous-chronicle-v2 build ${o.stamp}">
<title>${o.title}</title>
<style>${o.fonts}</style>
<style>${CSS}</style>
</head>
<body>
<div id="safe-probe"></div>
<canvas id="screen" width="1920" height="1080"></canvas>
${o.head || ''}
${o.body}
${o.embeds || ''}
</body>
</html>
`;
}
const esc = (code) => code.replace(/<\/script/gi, '<\\/script');
/** index.html: 1 本にまとめ、ファイルごとに try/catch（読み込みの失敗は R.loadErrors へ） */
function bundle(files) {
  return '<script>\n' + files.map((f) => {
    const r = rel(f);
    return `// ==== ${r}\ntry{\n${esc(fs.readFileSync(f, 'utf8'))}\n}catch(e){(window.RPG=window.RPG||{}).loadErrors=(window.RPG.loadErrors||[]);window.RPG.loadErrors.push(${JSON.stringify(r)}+': '+(e&&e.stack||e));console.error(${JSON.stringify(r)},e);}`;
  }).join('\n') + '\n</script>';
}
/** dev.html: ファイルごとに別の <script>（エラーの行がファイル名で出る） */
function separate(files) {
  return files.map((f) => {
    const r = rel(f);
    return `<script>\n${esc(fs.readFileSync(f, 'utf8'))}\n//# sourceURL=${r}\n</script>`;
  }).join('\n') + `\n<script>(function(){var R=window.RPG||{};if(!R.Engine){(R.loadErrors=R.loadErrors||[]).push('core failed to load');}})();</script>`;
}

// ------------------------------------------------------------------ 本体
function argVal(argv, k, d) { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; }

function main(argv) {
  const t0 = Date.now();
  const has = (k) => argv.includes(k);
  const devFiles = order({ dev: true });
  const { ok, bad } = syntax(devFiles);
  for (const b of bad) {
    console.warn(`\n[build] SYNTAX ERROR — excluded: ${rel(b.f)}`);
    console.warn(String(b.e.stack || b.e).split('\n').slice(0, 6).join('\n'));
  }
  if (has('--check')) { console.log(`[build] syntax: ${ok.length} ok, ${bad.length} bad`); process.exitCode = bad.length ? 1 : 0; return; }
  const DEV_DIR = path.join(SRC, 'dev');
  const playFiles = ok.filter((f) => !f.startsWith(DEV_DIR + path.sep));
  const OUT = path.resolve(argVal(argv, '--out', path.join(V2, 'dist')));
  fs.mkdirSync(OUT, { recursive: true });
  const single = has('--single');
  const mediaRoot = path.resolve(argVal(argv, '--media', path.join(CHRONICLE, 'assets')));
  const portraitsMode = argVal(argv, '--portraits', 'approved');
  if (!['approved', 'all', 'none'].includes(portraitsMode)) { console.error('[build] --portraits must be approved|all|none'); process.exit(2); }
  let portraitManifest = [];
  const pm = path.join(CHRONICLE, 'design', 'portraits', 'manifest.json');
  if (fs.existsSync(pm)) { try { portraitManifest = JSON.parse(fs.readFileSync(pm, 'utf8')); } catch (e) { console.warn('[build] design/portraits/manifest.json: bad JSON — no painted portraits'); } }
  const media = scanMedia(mediaRoot, { slice: !has('--all-bgm'), portraits: portraitsMode, portraitManifest });
  media.sprites = scanSprites(SPRITES_DIR);
  media.env = scanEnv(ENV_DIR);

  // 書体（dev のフィクスチャの字も入れる）
  const withDir = argVal(argv, '--with', null);
  const fxDirs = [path.join(V2, 'tools', 'fixtures')].concat(withDir ? [path.resolve(withDir)] : []);
  const fx = fixtures(fxDirs);
  const texts = ok.map((f) => fs.readFileSync(f, 'utf8')).concat([JSON.stringify(fx)]);
  const font = fontCss(texts, path.join(OUT, '.fontcache'));
  const stamp = new Date().toISOString().slice(0, 19) + 'Z';

  // 遊ぶ版
  const M = mediaTable(media, single ? 'embed' : 'external', OUT);
  const indexHtml = page({ title: TITLE, fonts: font.css, stamp, head: M.script, body: bundle(playFiles), embeds: M.embeds });
  fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml);

  // dev 版（外に置いた媒体を使う。--single のときも dev は外に置く）
  const writeDev = (name, extraFx, extraJs) => {
    const DM = single ? mediaTable(media, 'external', OUT) : M;
    const files = ok.filter((f) => path.basename(f) !== 'main.js' || path.dirname(f) !== SRC);
    const mainF = ok.filter((f) => path.basename(f) === 'main.js' && path.dirname(f) === SRC);
    const head = DM.script + `\n<script>window.RPG_FIXTURES=${esc(JSON.stringify(extraFx))};window.RPG_DEV=true;</script>`;
    fs.writeFileSync(path.join(OUT, name), page({ title: TITLE + '（dev）', fonts: font.css, stamp, head, body: separate(files.concat(extraJs, mainF)) }));
  };
  if (!has('--no-dev')) {
    writeDev('dev.html', fixtures([path.join(V2, 'tools', 'fixtures')]), []);
    if (withDir) {
      const d = path.resolve(withDir);
      const js = fs.readdirSync(d).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(d, f));
      const jsOk = syntax(js);
      for (const b of jsOk.bad) console.warn(`[build] --with SYNTAX ERROR — excluded: ${b.f}`);
      writeDev(`dev_${path.basename(d)}.html`, fx, jsOk.ok);
      console.log(`[build] dev_${path.basename(d)}.html with ${Object.keys(fx.states).length} state / ${Object.keys(fx.scenes).length} scene fixtures and ${jsOk.ok.length} js`);
    }
  }
  const kb = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0);
  const mb = (n) => (n / 1048576).toFixed(1);
  console.log(`[build] ${playFiles.length} files → ${path.relative(process.cwd(), OUT) || '.'}/index.html (${kb('index.html')} KB)` +
    (has('--no-dev') ? '' : `, dev.html (${kb('dev.html')} KB, +${ok.length - playFiles.length} dev files)`) +
    `\n[build] fonts: ${font.chars} chars, ${(font.bytes / 1024).toFixed(0)} KB embedded${font.ok ? '' : ' (SUBSET FAILED)'}` +
    `\n[build] media (${single ? 'embedded' : 'external'}): ${M.counts.bgm} BGM${has('--all-bgm') ? '' : ' (slice)'}, ${M.counts.voice} voice, ${M.counts.portraits} portraits, ${M.counts.sprites} sprite sheets, ${M.counts.env} env images, ${mb(M.bytes)} MB` +
    (bad.length ? `\n[build] ${bad.length} file(s) EXCLUDED (syntax)` : '') + `  [${Date.now() - t0} ms]`);
  if (bad.length) process.exitCode = 1;
}

module.exports = { order, fixtures, syntax, scanMedia, scanSprites, SPRITES_DIR, scanEnv, ENV_DIR, SLICE_BGM, DIRS, CORE_FIRST, V2 };
if (require.main === module) main(process.argv.slice(2));
