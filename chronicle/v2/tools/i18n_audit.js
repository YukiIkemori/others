#!/usr/bin/env node
// i18n の監査（node だけ・依存なし）
//
//   node v2/tools/i18n_audit.js              まとめ（移した割合・残りの直書き・key の抜け・言語ごとの訳の抜け）
//   node v2/tools/i18n_audit.js --list       残りの直書きを全部（ファイル:行 と文）
//   node v2/tools/i18n_audit.js --missing en 訳の無い key を全部（言語を 1 つ）
//   node v2/tools/i18n_audit.js --json       結果を JSON で（テスト・ほかの道具用）
//   node v2/tools/i18n_audit.js --update-baseline   今の残りを tools/i18n_baseline.json に書く（数が減ったときだけ使う）
//
// 見る物:
//   1 src/**/*.js の文字列（コメントの外）に残った日本語（画面の文の直書き）。allow（tools/i18n_allow.json）と行の `i18n:ignore` は除く。
//     ファイルごとの数が tools/i18n_baseline.json より増えたら失敗（新しい直書きを止める）。
//   2 R.T('key') の key が日本語の表（src/i18n/ja/*.js）に無い → 失敗
//   3 訳（en・zh-Hans・zh-Hant・ko）: 無い key の数（分野ごと）・日本語に無い key（古い訳）・差し込み {name} の食い違い・配列かどうかの食い違い
// 表は R.I18n.add(lang, {…}) の形のファイル（src/i18n/<言語>/<分野>.js）。読み込みは素の JS として評価する。
'use strict';
const fs = require('fs');
const path = require('path');

const V2 = path.resolve(__dirname, '..');
const SRC = path.join(V2, 'src');
const I18N = path.join(SRC, 'i18n');
const ALLOW_FILE = path.join(__dirname, 'i18n_allow.json');
const BASE_FILE = path.join(__dirname, 'i18n_baseline.json');
const LANGS = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'];
// 画面の文と見なす字（かな・漢字・全角の英数と記号）。句読点・かぎかっこだけの文字列は数えない（symbols に別に数える）
const JP = /[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿！-～ｦ-ﾟ]/;
const SYM = /[　-〿…‥・]/;

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else if (e.name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}
const rel = (f) => path.relative(V2, f).replace(/\\/g, '/');

// ------------------------------------------------------------------ JS の字句（文字列・テンプレート・コメント・正規表現）
/** → [{s, line, kind:'str'|'tpl', start, end}]。テンプレートの ${…} の中も読む（中の文字列も拾う）。${…} の所は \u0000 */
function strings(src) {
  const out = [];
  let i = 0, line = 1, prev = '';
  const n = src.length;
  const reAllowed = () => prev === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /^(return|typeof|case|do|else|in|of|new|delete|void|throw|instanceof|yield|await)$/.test(prev);
  function readTemplate() {
    // src[i] === '`'
    const start = i, l0 = line;
    i++;
    let s = '';
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { s += src[i] + src[i + 1]; if (src[i + 1] === '\n') line++; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2; s += '\u0000';
        let depth = 1;
        const saved = prev; prev = '(';
        while (i < n && depth) {
          const c = src[i];
          if (c === '{') { depth++; i++; prev = '{'; continue; }
          if (c === '}') { depth--; i++; prev = '}'; continue; }
          if (!step()) i++;
        }
        prev = saved;
        continue;
      }
      if (src[i] === '\n') line++;
      s += src[i]; i++;
    }
    i++;
    out.push({ s: unescape(s), line: l0, kind: 'tpl', start, end: i });
    prev = 'x';
  }
  function unescape(s) {
    return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/gs, (m, e) => {
      if (e[0] === 'u') return String.fromCodePoint(parseInt(e[1] === '{' ? e.slice(2, -1) : e.slice(1), 16));
      if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
      return { n: '\n', t: '\t', r: '\r', f: '\f', b: '\b', v: '\v', 0: '\0', '\n': '' }[e] != null ? { n: '\n', t: '\t', r: '\r', f: '\f', b: '\b', v: '\v', 0: '\0', '\n': '' }[e] : e;
    });
  }
  /** 1 つの字句を読む。読んだら true */
  function step() {
    const c = src[i];
    if (c === '\n') { line++; i++; return true; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; return true; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; for (let k = i; k < end; k++) if (src[k] === '\n') line++; i = end; return true; }
    if (c === '"' || c === "'") {
      const start = i, l0 = line;
      i++;
      let s = '';
      while (i < n && src[i] !== c) { if (src[i] === '\\') { s += src[i] + src[i + 1]; if (src[i + 1] === '\n') line++; i += 2; continue; } if (src[i] === '\n') break; s += src[i]; i++; }
      i++;
      out.push({ s: unescape(s), line: l0, kind: 'str', start, end: i });
      prev = 'x';
      return true;
    }
    if (c === '`') { readTemplate(); return true; }
    if (c === '/' && reAllowed()) {
      // 正規表現
      i++;
      let cls = false;
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break;
        i++;
      }
      i++;
      while (i < n && /[a-z]/i.test(src[i])) i++;
      prev = 'x';
      return true;
    }
    if (/\s/.test(c)) { i++; return true; }
    if (/[A-Za-z_$0-9]/.test(c)) { let w = ''; while (i < n && /[A-Za-z_$0-9.]/.test(src[i]) && !(src[i] === '.' && !/[0-9]/.test(w[0] || ''))) { w += src[i]; i++; } if (!w) { i++; prev = c; } else prev = w; return true; }
    prev = c; i++;
    return true;
  }
  while (i < n) step();
  return out;
}

// ------------------------------------------------------------------ 表
function readTables() {
  const T = {};
  const from = {};
  for (const l of LANGS) { T[l] = {}; from[l] = {}; }
  const dups = [];
  for (const l of LANGS) {
    for (const f of walk(path.join(I18N, l))) {
      const R = { I18n: { add: (lang, t) => { for (const k of Object.keys(t)) { if (k in T[lang]) dups.push(`${lang}:${k}`); T[lang][k] = t[k]; from[lang][k] = rel(f); } } } };
      try { new Function('window', fs.readFileSync(f, 'utf8'))({ RPG: R }); } catch (e) { dups.push(`${rel(f)}: ${e.message}`); }
    }
  }
  return { T, from, dups };
}
/** 文の中の差し込みの名前（{name}・{n, plural, …} の n）。{hero} など表の外で入る物も含む */
function params(v) {
  const out = new Set();
  for (const s of [].concat(v)) {
    const re = /\{\s*([A-Za-z_$][\w$]*)\s*(?:[,}])/g;
    let m;
    while ((m = re.exec(String(s)))) out.add(m[1]);
  }
  return out;
}

// ------------------------------------------------------------------ 本体
function audit() {
  const allow = fs.existsSync(ALLOW_FILE) ? JSON.parse(fs.readFileSync(ALLOW_FILE, 'utf8')) : { files: {}, strings: [] };
  const allowFiles = Object.keys(allow.files || {}).map((p) => ({ re: new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/(?<!\.)\*/g, '[^/]*') + '$'), p }));
  const allowStr = (allow.strings || []);
  const { T, from, dups } = readTables();
  const ja = T.ja;

  const hard = [];       // 残りの直書き
  const allowed = [];    // allow で除いた物
  const symbols = [];    // 句読点だけの文字列（数えるだけ）
  const used = new Map();   // key → [file:line]
  let dynamic = 0;
  for (const f of walk(SRC)) {
    const r = rel(f);
    if (r.startsWith('src/i18n/')) continue;
    const src = fs.readFileSync(f, 'utf8');
    const lines = src.split('\n');
    const af = allowFiles.find((a) => a.re.test(r));
    for (const t of strings(src)) {
      const L = lines[t.line - 1] || '';
      // R.T('key') の key
      if (t.kind === 'str' && /R\.T\(\s*$/.test(src.slice(Math.max(0, t.start - 12), t.start))) {
        if (!used.has(t.s)) used.set(t.s, []);
        used.get(t.s).push(`${r}:${t.line}`);
        continue;
      }
      if (!JP.test(t.s)) { if (SYM.test(t.s) && !/i18n:ignore|check_text:ignore/.test(L)) symbols.push({ file: r, line: t.line, s: t.s }); continue; }
      const dev = /i18n:ignore|check_text:ignore/.test(L) || /\bR\.warn\(|console\.(log|warn|error|info)\(|throw new Error|loadErrors\.push/.test(L);
      const as = allowStr.find((a) => a.file === r && (a.text === t.s || (a.re && new RegExp(a.re).test(t.s))));
      const e = { file: r, line: t.line, s: t.s, chars: [...t.s.replace(/\u0000/g, '')].length };
      if (dev) { allowed.push(Object.assign(e, { why: 'dev' })); continue; }
      if (af) { allowed.push(Object.assign(e, { why: allow.files[af.p] })); continue; }
      if (as) { allowed.push(Object.assign(e, { why: as.reason })); continue; }
      hard.push(e);
    }
    const dm = src.match(/R\.T\(\s*[^'"\s)]/g);
    if (dm) dynamic += dm.length;
  }
  // key の確かめ
  const missingJa = [...used.keys()].filter((k) => !(k in ja)).map((k) => ({ key: k, at: used.get(k)[0] }));
  const unused = Object.keys(ja).filter((k) => !used.has(k));
  // 訳
  const langs = {};
  const domainOf = (k) => (from.ja[k] || '?').replace(/^src\/i18n\/ja\//, '').replace(/\.js$/, '');
  for (const l of LANGS.slice(1)) {
    const t = T[l];
    const miss = Object.keys(ja).filter((k) => !(k in t));
    const byDomain = {};
    for (const k of miss) { const d = domainOf(k); byDomain[d] = (byDomain[d] || 0) + 1; }
    const stale = Object.keys(t).filter((k) => !(k in ja));
    const badParams = [], badShape = [];
    for (const k of Object.keys(t)) {
      if (!(k in ja)) continue;
      if (Array.isArray(ja[k]) !== Array.isArray(t[k])) badShape.push(k);
      const a = params(ja[k]), b = params(t[k]);
      const lost = [...a].filter((x) => !b.has(x)), extra = [...b].filter((x) => !a.has(x));
      if (lost.length || extra.length) badParams.push({ key: k, lost, extra });
    }
    const chars = Object.keys(ja).reduce((s, k) => s + (k in t ? 0 : [...[].concat(ja[k]).join('')].length), 0);
    langs[l] = { keys: Object.keys(t).length, missing: miss.length, missingChars: chars, byDomain, stale, badParams, badShape, missingKeys: miss };
  }
  const jaChars = Object.values(ja).reduce((s, v) => s + [...[].concat(v).join('')].length, 0);
  const hardChars = hard.reduce((s, e) => s + e.chars, 0);
  const allowChars = allowed.reduce((s, e) => s + e.chars, 0);
  const byFile = {};
  for (const e of hard) byFile[e.file] = (byFile[e.file] || 0) + 1;
  // 領域ごとの残り（src の 1 段目）
  const byArea = {};
  for (const e of hard) { const a = e.file.split('/')[1]; byArea[a] = (byArea[a] || 0) + e.chars; }
  return {
    jaKeys: Object.keys(ja).length, jaChars, hard, hardChars, allowed, allowChars, symbols, byFile, byArea,
    coverage: jaChars / Math.max(1, jaChars + hardChars),
    used: used.size, dynamic, missingJa, unused, dups, langs,
  };
}

function baselineCheck(r) {
  const base = fs.existsSync(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : { files: {} };
  const grew = [];
  for (const [f, n] of Object.entries(r.byFile)) {
    const b = (base.files || {})[f] || 0;
    if (n > b) grew.push({ file: f, now: n, base: b });
  }
  return grew;
}

function main() {
  const argv = process.argv.slice(2);
  const r = audit();
  if (argv.includes('--json')) { const o = Object.assign({}, r); for (const l of Object.keys(o.langs)) o.langs[l] = Object.assign({}, o.langs[l], { missingKeys: o.langs[l].missingKeys.length }); console.log(JSON.stringify(o, null, 1)); return; }
  if (argv.includes('--update-baseline')) {
    const files = {};
    for (const f of Object.keys(r.byFile).sort()) files[f] = r.byFile[f];
    fs.writeFileSync(BASE_FILE, JSON.stringify({ note: 'i18n_audit.js: ファイルごとの残りの直書きの数（これより増えたら test_i18n が失敗）。減ったら --update-baseline で書き直す', files }, null, 1) + '\n');
    console.log(`baseline: ${Object.keys(files).length} files, ${r.hard.length} strings`);
    return;
  }
  const mi = argv.indexOf('--missing');
  if (mi >= 0) { const l = argv[mi + 1]; for (const k of r.langs[l].missingKeys) console.log(k); return; }
  if (argv.includes('--list')) for (const e of r.hard) console.log(`${e.file}:${e.line}  ${JSON.stringify(e.s.replace(/\u0000/g, '${…}')).slice(0, 100)}`);
  const pct = (x) => (x * 100).toFixed(1) + '%';
  console.log(`日本語の表: ${r.jaKeys} keys・${r.jaChars} 字（src/i18n/ja）`);
  console.log(`残りの直書き: ${r.hard.length} 個・${r.hardChars} 字（${Object.keys(r.byFile).length} ファイル）  → 移した割合 ${pct(r.coverage)}`);
  console.log(`  領域ごと（字）: ${Object.entries(r.byArea).sort((a, b) => b[1] - a[1]).map(([a, n]) => a + ' ' + n).join('・') || 'なし'}`);
  console.log(`  除外（開発用・allow）: ${r.allowed.length} 個・${r.allowChars} 字   句読点だけの文字列: ${r.symbols.length} 個`);
  console.log(`R.T の key: ${r.used} 種（式で作る key ${r.dynamic} か所）  表に無い key: ${r.missingJa.length}  使われていない key: ${r.unused.length}`);
  for (const m of r.missingJa.slice(0, 20)) console.log(`  MISSING ja ${m.key}  (${m.at})`);
  if (r.dups.length) console.log(`重なった key: ${r.dups.length}  ${r.dups.slice(0, 5).join(' ')}`);
  for (const [l, x] of Object.entries(r.langs)) {
    console.log(`${l.padEnd(8)} 訳 ${x.keys} keys・無い ${x.missing}（${x.missingChars} 字）  古い ${x.stale.length}  差し込みの食い違い ${x.badParams.length}  配列の食い違い ${x.badShape.length}`);
    if (x.keys) console.log('         無い分野: ' + Object.entries(x.byDomain).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${n}`).join('・'));
    for (const b of x.badParams.slice(0, 10)) console.log(`         PARAMS ${b.key}  lost [${b.lost}] extra [${b.extra}]`);
  }
  const grew = baselineCheck(r);
  for (const g of grew) console.log(`NEW HARD-CODED TEXT ${g.file}: ${g.now} strings (baseline ${g.base})`);
  if (grew.length || r.missingJa.length || r.dups.length) process.exitCode = 1;
}
module.exports = { audit, strings, readTables, params, baselineCheck, LANGS };
if (require.main === module) main();
