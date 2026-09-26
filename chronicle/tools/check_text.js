#!/usr/bin/env node
// check_text.js (owner qa A22) — the text rules of STYLE_JA §10 (DESIGN §12.4).
// The banned-name lists are read from STYLE_JA.md §7 itself (so the guide stays the single source), plus the
// words DESIGN adds (§9.14: キング; §12.4: スライム・メタル in all of src/).
//
//   node tools/check_text.js                 all findings, exit 1 on errors
//   node tools/check_text.js --owner R3      one owner      --quiet  errors only     --summary  counts only
//
// Errors (STYLE_JA §10 1–8)                                   Warnings (9–11)
//  1 §7.1 partial / §7.2 exact banned names in techs, spells,   9 魔力 / 魔法 outside item names and the §7.3 exceptions
//    enemy actions, items, monsters (name, goldName)            10 spelling variants of the §3 table ("使わない" side)
//  2 §7.3 words anywhere in src/ strings (comments excluded)    11 full-width digits
//  3 kanji outside 常用漢字 (tools/lib/joyo.txt) + §2's list
//  4 DQ-style word spacing; full-width spaces other than the 2 allowed uses (after ！？♪, UI item lists)
//  5 a single "…", an odd run, "・・・", or a sentence ending in "……" without 。！？」
//  6 a line wider than 20 (split at \n / \f; {hero} = 5); tech/spell desc 1×20, item desc 2×20
//  7 the hero's name written directly (DB.config.defaultHero.name, アルン) or {yuki} {non} {metem}
//  8 「〇にならない」「(状態)にする」 (毒にする is fine)
// Strings = every string literal in src/**/*.js that contains Japanese (template literals: ${…} counts as nothing).
// Code-only strings (ids, ASCII) are ignored. Lines with a "check_text:ignore" comment are skipped.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ------------------------------------------------------------------------------------------ STYLE_JA
function readStyle() {
  const file = path.join(ROOT, 'STYLE_JA.md');
  const out = { partial: [], exact: [], src: [], allowedKanji: '', variants: [] };
  if (!fs.existsSync(file)) return out;
  const md = fs.readFileSync(file, 'utf8');
  const section = (h) => { const i = md.indexOf(h); if (i < 0) return ''; const j = md.indexOf('\n### ', i + h.length); const k = md.indexOf('\n## ', i + h.length); const e = Math.min(j < 0 ? md.length : j, k < 0 ? md.length : k); return md.slice(i, e); };
  const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  // §7.1: each bullet holds one backticked space-separated list
  for (const t of ticks(section('### 7.1'))) for (const w of t.split(/\s+/)) if (w) out.partial.push(w);
  for (const t of ticks(section('### 7.2'))) for (const w of t.split(/\s+/)) if (w) out.exact.push(w);
  // §7.3: backticked words on the first line(s) until the "- 例外" bullet
  const s73 = section('### 7.3').split('\n- 例外')[0];
  for (const t of ticks(s73)) for (const w of t.split(/\s+/)) if (w) out.src.push(w);
  // §2 allowed non-joyo kanji
  const m = md.match(/使ってよい常用外の字\*\*:\s*([^\n]+)/);
  if (m) out.allowedKanji = m[1].replace(/（[^）]*）/g, '').replace(/\s+/g, '');
  // §3 table: "使わない" column
  const s3 = section('## 3. 表記の統一');
  for (const line of s3.split('\n')) {
    const cells = line.split('|').map((x) => x.trim());
    if (cells.length >= 4 && cells[1] && !/^-+$/.test(cells[1]) && cells[1] !== '正') {
      for (const w of cells[2].replace(/（[^）]*）/g, '').split(/[・／、]/)) if (w && !/使わない/.test(w)) out.variants.push(w.replace(/^〜/, ''));
    }
  }
  return out;
}

const EXTRA_PARTIAL = ['キング'];                 // DESIGN §9.14 (STYLE_JA §7.1 only lists キングスライム)
const EXTRA_SRC = ['スライム', 'メタル'];          // DESIGN §12.4
const SRC_EXCEPTIONS = ['魔法都市アルカナ', '魔法学院', '魔法の天才'];
// names DESIGN fixes verbatim although rule 9 would warn (魔力 = MP here, as in item names). §6.0 0.6 / §6.8: t_staff_share
const SPEC_FIXED_NAMES = ['魔力分け'];
const STATUS_WORDS = ['眠り', 'まひ', '凍結', '気絶', '混乱', '沈黙', '暗闇', 'やけど'];
const JP = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/;
const KANJI = /[㐀-䶿一-鿿豈-﫿]/;

// width in full-width units (R.Text.approxWidth / 10.67): half-width = code < 0x2000 or half-width katakana
function width(s) {
  s = String(s).replace(/\{hero\}|\{leader\}|\{name\}|\{user\}|\{ally\}|\{item\}/g, '＊＊＊＊＊')
    .replace(/\{g:([^|}]*)\|([^}]*)\}/g, (m, a, b) => (a.length >= b.length ? a : b)).replace(/\{(left|cleared)\}/g, '８');
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) < 0x2000 || (ch >= '｡' && ch <= 'ﾟ') ? 0.5 : 1;
  return w;
}

// ------------------------------------------------------------------------------------------ string extraction
/** string literals of a JS source with line numbers; comments skipped; ${…} in templates dropped */
function strings(src) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  let lastSig = '';           // last significant char (to tell a regex from a division)
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$/.test(lastSig)) {    // regex literal
      i++;
      let cls = false;
      while (i < n && src[i] !== '\n') { const x = src[i]; if (x === '\\') { i += 2; continue; } if (x === '[') cls = true; else if (x === ']') cls = false; else if (x === '/' && !cls) break; i++; }
      i++; while (i < n && /[a-z]/i.test(src[i])) i++;
      lastSig = 'r'; continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c, l0 = line;
      let s = '';
      i++;
      while (i < n && src[i] !== q) {
        const x = src[i];
        if (x === '\\') {
          const y = src[i + 1];
          s += y === 'n' ? '\n' : y === 'f' ? '\f' : y === 't' ? '\t' : y === 'u' ? String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)) : y;
          i += y === 'u' ? 6 : 2; continue;
        }
        if (q === '`' && x === '$' && src[i + 1] === '{') {        // skip ${…} with nesting
          let depth = 1; i += 2;
          while (i < n && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; else if (src[i] === '\n') line++; i++; }
          s += '\u0000'; continue;
        }
        if (x === '\n') { if (q !== '`') break; line++; }
        s += x; i++;
      }
      i++;
      out.push({ s, line: l0, tpl: q === '`' });
      lastSig = 's'; continue;
    }
    if (!/\s/.test(c)) lastSig = c;
    i++;
  }
  return out;
}

// ------------------------------------------------------------------------------------------ checks
function run(opts) {
  opts = opts || {};
  const V = require('./validate');
  let R = opts.R, prov = opts.prov, files = opts.files;
  if (!R) { const L = V.loadTracked({ with: opts.with }); R = L.R; prov = L.prov; files = L.files; }
  const DB = (R && R.DB) || {};
  const findings = [];
  const add = (level, rule, owner, msg) => findings.push({ level, rule, owner, msg: `${rule}: ${msg}` });
  const style = readStyle();
  const partial = [...new Set(style.partial.concat(EXTRA_PARTIAL))];
  const exact = new Set(style.exact);
  const srcBanned = [...new Set(style.src.concat(EXTRA_SRC))];
  if (!style.partial.length) add('warn', 'T0', 'A0', 'STYLE_JA.md §7.1 list not found (banned names not checked)');
  const own = (reg, id) => { const f = prov && prov[reg] && prov[reg][id]; return f ? V.ownerOfFile(f) : V.expectedOwner(reg, id); };

  // 1. banned names in data names
  const named = [];
  for (const [id, a] of Object.entries(DB.actions || {})) named.push({ reg: 'actions', id, name: a && a.name });
  for (const [id, it] of Object.entries(DB.items || {})) if (!/^pmz__/.test(id)) named.push({ reg: 'items', id, name: it && it.name });
  for (const [id, m] of Object.entries(DB.monsters || {})) { named.push({ reg: 'monsters', id, name: m && m.name }); if (m && m.goldName) named.push({ reg: 'monsters', id, name: m.goldName }); }
  for (const x of named) {
    if (!x.name) continue;
    const hit = partial.find((w) => x.name.includes(w));
    if (hit) add('error', 'T1', own(x.reg, x.id), `${x.id} '${x.name}' contains the banned name '${hit}' (STYLE_JA §7.1)`);
    if (exact.has(x.name)) add('error', 'T1', own(x.reg, x.id), `${x.id} '${x.name}' is a banned name (STYLE_JA §7.2)`);
  }
  // data text widths (6): tech/spell desc 1×20, item desc 2×20 are checked by validate V3; here the message-like fields
  // 3/4/5/6/7/8 on every Japanese string literal of src/
  let joyo = null;
  const jf = path.join(ROOT, 'tools', 'lib', 'joyo.txt');
  if (fs.existsSync(jf)) joyo = new Set([...fs.readFileSync(jf, 'utf8').replace(/\s+/g, '')]);
  else add('warn', 'T3', 'A0', 'tools/lib/joyo.txt missing: the 常用漢字 check (3) is skipped');
  const allowed = new Set([...style.allowedKanji]);
  const heroName = (DB.config && DB.config.defaultHero && DB.config.defaultHero.name) || 'アルン';
  const heroNames = [...new Set([heroName, 'アルン'])];
  const variants = style.variants.filter((w) => w.length >= 2 && !/^[ぁ-ん]{2}$/.test(w) || /^(よろい|かぶと|ずきん|めがね)$/.test(w));
  const risky = new Set(['くつ', 'ぐつ', 'はずす', 'もどる']);
  const nonJoyo = {};
  let nStrings = 0;
  for (const rel of files || []) {
    if (!/^src\//.test(rel)) continue;
    const owner = V.ownerOfFile(rel);
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const lines = src.split('\n');
    for (const { s, line } of strings(src)) {
      if (!JP.test(s)) continue;
      const srcLine = lines[line - 1] || '';
      if (/check_text:ignore/.test(srcLine)) continue;
      if (/\bR\.warn\(|console\.(log|warn|error|info)\(|throw new Error|loadErrors\.push/.test(srcLine)) continue;   // developer messages, never on screen
      if ((s.match(/[ぁぃぅぇぉっゃゅょァィゥェォッャュョ]/g) || []).length >= 6) continue;                         // character tables (kinsoku lists)
      nStrings++;
      const where = `${rel}:${line}`;
      const text = s.replace(/\u0000/g, '');
      // 2. §7.3 words
      for (const w of srcBanned) if (text.includes(w) && !SRC_EXCEPTIONS.some((e) => e.includes(w) && text.includes(e))) add('error', 'T2', owner, `${where} '${w}' must not appear in any string (STYLE_JA §7.3): ${clip(text)}`);
      // 3. kanji
      if (joyo) for (const ch of text) {
        if (!KANJI.test(ch) || joyo.has(ch) || allowed.has(ch) || ch === '々') continue;
        if (ch === '叉' && text.includes('夜叉')) continue;
        const k = ch + '|' + rel;
        if (!nonJoyo[k]) { nonJoyo[k] = 1; add('error', 'T3', owner, `${where} '${ch}' is not 常用漢字 nor in STYLE_JA §2 (${clip(text)})`); }
      }
      // 4. spacing
      checkSpacing(text, (m) => add('error', 'T4', owner, `${where} ${m}: ${clip(text)}`));
      // 5. ellipsis
      checkEllipsis(text, (m) => add('error', 'T5', owner, `${where} ${m}: ${clip(text)}`));
      // 6. width per line (messages; UI strings are short anyway)
      for (const ln of text.split(/[\n\f／]/)) { const w = width(ln); if (w > 20) add('error', 'T6', owner, `${where} a line is ${w} wide (max 20): ${clip(ln)}`); }
      // 7. hard-coded hero name
      if (!/^src\/data\/(config|herotypes)\.js$/.test(rel)) for (const hn of heroNames) if (text.includes(hn) && text.trim() !== hn) add('error', 'T7', owner, `${where} the hero's name '${hn}' is written directly (use {hero}): ${clip(text)}`);
      if (/\{(yuki|non|metem)\}/.test(text)) add('error', 'T7', owner, `${where} Crest placeholder ${text.match(/\{(yuki|non|metem)\}/)[0]}`);
      // 8. forbidden status phrasing
      for (const st of STATUS_WORDS) if (text.includes(st + 'にする')) add('error', 'T8', owner, `${where} '${st}にする' (write the verb, STYLE_JA §4): ${clip(text)}`);
      const nm = text.match(/(毒|眠り|まひ|凍結|気絶|混乱|沈黙|暗闇|やけど|即死)にならない/);
      if (nm) add('error', 'T8', owner, `${where} '${nm[0]}' (write 「${nm[1]}が効かない。」): ${clip(text)}`);
      // 9. 魔力 / 魔法
      if (/魔法/.test(text) && !SRC_EXCEPTIONS.some((e) => text.includes(e))) add('warn', 'T9', owner, `${where} '魔法' (the game says 術): ${clip(text)}`);
      if (/魔力/.test(text) && !/^src\/data\/items_/.test(rel) && !SPEC_FIXED_NAMES.includes(text.trim())) add('warn', 'T9', owner, `${where} '魔力' outside item names: ${clip(text)}`);
      // 10. spelling variants
      for (const v of variants) {
        if (risky.has(v)) continue;
        if (v === '除け' && /魔除け/.test(text) && !text.replace(/魔除け/g, '').includes('除け')) continue;
        if (v === '鉢巻' && /鉢巻き/.test(text)) continue;
        if (text.includes(v)) add('warn', 'T10', owner, `${where} '${v}' (STYLE_JA §3 writes it differently): ${clip(text)}`);
      }
      // 11. full-width digits
      if (/[０-９]/.test(text)) add('warn', 'T11', owner, `${where} full-width digits: ${clip(text)}`);
    }
  }
  // 6. data desc widths not covered by validate: monster desc, NPC text in maps is covered above (maps are src/)
  return { findings, nStrings, lists: { partial: partial.length, exact: exact.size, src: srcBanned.length, allowedKanji: allowed.size, joyo: joyo ? joyo.size : 0 } };
}

function clip(s) { s = String(s).replace(/\n/g, '⏎').replace(/\f/g, '¶'); return s.length > 40 ? s.slice(0, 40) + '…' : s; }

function checkSpacing(text, bad) {
  const t = text;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c !== ' ' && c !== '　') continue;
    const prev = t[i - 1] || '', next = t[i + 1] || '';
    if (c === ' ') {                                           // half-width space between two Japanese chars = DQ spacing
      if (JP.test(prev) && JP.test(next)) { bad('DQ-style word spacing (half-width space between Japanese words)'); return; }
      continue;
    }
    // full-width space
    if (!prev || prev === '\n' || prev === '\f' || prev === '　') continue;   // leading / alignment padding
    if (!next || next === '\n' || next === '\f' || next === '　') continue;   // trailing padding
    if ('！？♪'.includes(prev)) continue;                                           // use (1)
    const segL = t.slice(0, i).split(/[\n\f　]/).pop(), segR = t.slice(i + 1).split(/[\n\f　]/)[0];
    const uiLike = (x) => /[0-9０-９+＋\-−×\/％%A-Za-zＡ-Ｚ：:★◆Lv]/.test(x) || width(x) <= 6;
    const sentence = /[。、]/.test(t);
    if (!sentence && (uiLike(segL) || uiLike(segR))) continue;                    // use (2): UI item lists
    if (!sentence && width(segL) <= 10 && width(segR) <= 10) continue;
    bad('full-width space outside the 2 allowed uses (after ！？ / UI lists)');
    return;
  }
}

function checkEllipsis(text, bad) {
  if (/・・・/.test(text)) { bad("'・・・' (write ……)"); return; }
  const re = /…+/g;
  let m;
  while ((m = re.exec(text))) {
    const run = m[0].length;
    if (run % 2 === 1) { bad(run === 1 ? "a single '…' (always two: ……)" : `an odd run of ${run} '…'`); return; }
    const after = text[m.index + run];
    const lineStart = Math.max(text.lastIndexOf('\n', m.index), text.lastIndexOf('\f', m.index)) + 1;
    const lineEnd = (() => { const a = text.indexOf('\n', m.index), b = text.indexOf('\f', m.index); return Math.min(a < 0 ? text.length : a, b < 0 ? text.length : b); })();
    const lineText = text.slice(lineStart, lineEnd).trim();
    if ((after === undefined || after === '\n' || after === '\f' || after === '\u0000') && !/^[「]?…+[」]?$/.test(lineText) && !/[「（]$/.test(text.slice(lineStart, m.index))) {
      // a sentence (line) that ends in …… needs 。！？」 — unless the whole line is just "……"; a line that continues on the next line is fine
      const nextCh = text[lineEnd + 1];
      if (after === '\n' && nextCh && !/[\n\f]/.test(nextCh)) continue;    // the sentence goes on after the line break
      bad("a sentence ending in '……' without 。！？」");
      return;
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
  const owners = arg('owner') ? arg('owner').split(',') : null;
  const quiet = argv.includes('--quiet'), summary = argv.includes('--summary');
  const t0 = Date.now();
  const res = run({ with: arg('with') ? arg('with').split(',') : null });
  let list = res.findings;
  if (owners) list = list.filter((f) => owners.includes(f.owner));
  const errs = list.filter((f) => f.level === 'error'), warns = list.filter((f) => f.level === 'warn');
  if (!summary) {
    if (!quiet) for (const f of warns) console.log(`WARN  [${f.owner}] ${f.msg}`);
    for (const f of errs) console.log(`ERROR [${f.owner}] ${f.msg}`);
  }
  const by = {};
  for (const f of list) { const k = f.rule + ':' + f.level[0]; by[k] = (by[k] || 0) + 1; }
  console.log(`\ncheck_text: ${errs.length} error(s), ${warns.length} warning(s) in ${res.nStrings} Japanese strings — rules ${Object.entries(by).sort().map(([k, v]) => k + ' ' + v).join(', ') || 'none'}` +
    ` — lists: §7.1 ${res.lists.partial}, §7.2 ${res.lists.exact}, §7.3 ${res.lists.src}, §2 ${res.lists.allowedKanji} kanji, joyo ${res.lists.joyo} — ${Date.now() - t0} ms`);
  process.exitCode = errs.length ? 1 : 0;
}

module.exports = { run, strings, width, readStyle, checkSpacing, checkEllipsis };
if (require.main === module) main();
