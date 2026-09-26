#!/usr/bin/env node
// Voice recording script (BRIEF Part A9): every voiced line of the game → design/voice/script.csv and
// design/voice/script.md (the actors' script).
//
//   node tools/voice_script.js            write both files (and print a summary)
//   node tools/voice_script.js --check    only check (exit 1 on a problem); writes nothing
//   node tools/voice_script.js --out <dir>   write into <dir> instead of design/voice (tests)
//
// A voiced line is an ev.say(...) call with the option `voice: 'v_<speaker>_<scene>_<nn>'` anywhere under
// src/ (events, ending). The text is read statically from the call's first argument: a string literal,
// or say/said('<speaker>', '<literal>'). Checks: id format, unique ids, the speaker is a fixed story
// character (never the hero or a companion), the text is a literal, no {hero}/{leader} (the player names
// the hero, an actor cannot say it). Columns: id, speaker, name, scene, event, file, line, text, chars,
// seconds (estimate), recorded (a file exists in assets/voice/).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const VOICE_DIR = path.join(ROOT, 'assets', 'voice');
const EXT = ['ogg', 'm4a', 'mp3', 'wav'];

/** speaker id (2nd part of the voice id) → display name; the order is the script's order */
const SPEAKERS = {
  fine: 'フィーネ（灰色のマントの少女）',
  rowell: 'ロウェル',
  berna: 'ベルナ（師匠）',
  lazaro: 'ラザロ（大書記）',
  king: '虚ろの王（ラスボス）',
  nemrea: 'ネムレア（名を得た虚ろの王）',
  noa: 'ノア',
  valzard: 'ヴァルザード（魔王の残影）',
  elm: '森の主エルム',
  hazal: 'ハザル王（砂の王）',
  giant: '氷の巨人',
  neve: '白竜ネーヴェ',
  melda: 'メルダ（霧の館の魔女）',
  mistwitch: '霧食らい（魔女の姿）',
  marina: 'マリナ',
  glen: 'グレン船長',
  guardian: '鉄の番人',
  sentinel: '天球の番人',
};
// the files in story order (the script lists each speaker's lines in this order)
const ORDER = ['prologue_roa', 'prologue_lute', 'prologue_lighthouse', 'region1_forest', 'region2_tomb', 'region3_frost_peak',
  'region4_dungeons', 'region5_isles', 'region6_mine', 'region7_volcano', 'region8_star', 'story', 'final_roa', 'final_biblia',
  'final_archive', 'ending', 'oblivion'];

function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])); }

/** index of the bracket closing the one at s[i]; skips strings and comments */
function closeOf(s, i) {
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '"' || c === "'" || c === '`') { const q = c; k++; while (k < s.length && s[k] !== q) { if (s[k] === '\\') k++; k++; } continue; }
    if (c === '/' && s[k + 1] === '/') { k = s.indexOf('\n', k); if (k < 0) return -1; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) return k; }
  }
  return -1;
}
/** split the top-level arguments of s[open..close] */
function args(s, open, close) {
  const out = [];
  let depth = 0, from = open + 1;
  for (let k = open + 1; k < close; k++) {
    const c = s[k];
    if (c === '"' || c === "'" || c === '`') { const q = c; k++; while (k < close && s[k] !== q) { if (s[k] === '\\') k++; k++; } continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) { out.push(s.slice(from, k).trim()); from = k + 1; }
  }
  out.push(s.slice(from, close).trim());
  return out.filter((a) => a !== '');
}
const LIT = /^'(?:[^'\\]|\\.)*'$|^"(?:[^"\\]|\\.)*"$/;
const literal = (a) => (LIT.test(a) ? vm.runInNewContext(a) : null);

/** the text of a say's first argument → {text, said} | null */
function textOf(a) {
  const t = literal(a);
  if (t != null) return { text: t, said: null };
  const m = /^(?:say|said|S\.said)\(\s*'([a-z]+)'\s*,\s*([\s\S]+)\)$/.exec(a);
  if (m) { const t2 = literal(m[2].trim()); if (t2 != null) return { text: t2, said: m[1] }; }
  return null;
}
/** the event / function the call sits in: nearest `E.id = {`, `E['id'] = {` or `async function name(` above */
function eventAt(s, at) {
  const head = s.slice(0, at);
  let best = null, bi = -1;
  for (const re of [/E\.([A-Za-z0-9_]+)\s*=\s*\{/g, /E\['([^']+)'\]\s*=/g, /async function ([A-Za-z0-9_]+)\s*\(/g]) {
    let m;
    while ((m = re.exec(head))) if (m.index > bi) { bi = m.index; best = m[1]; }
  }
  return best || '';
}
/** estimated spoken length: ≈ 7.5 kana-ish chars / s, plus pauses for …… ― 。 、 */
function seconds(t) {
  const plain = t.replace(/[\s「」『』♪]/g, '');
  const pauses = (t.match(/……|――/g) || []).length * 0.5 + (t.match(/[。！？]/g) || []).length * 0.35 + (t.match(/、/g) || []).length * 0.15;
  return Math.round((plain.replace(/[…―。、！？]/g, '').length / 7.5 + pauses + 0.4) * 10) / 10;
}

function collect() {
  const lines = [], problems = [];
  const files = walk(SRC).filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    const re = /voice:\s*(['"])([^'"<]*)\1/g; // (doc comments show 'v_<speaker>…')
    let m;
    while ((m = re.exec(s))) {
      const id = m[2], rel = path.relative(ROOT, f).replace(/\\/g, '/');
      const line = s.slice(0, m.index).split('\n').length;
      const where = rel + ':' + line;
      const call = s.lastIndexOf('ev.say(', m.index);
      const open = call + 'ev.say'.length;
      const close = call >= 0 ? closeOf(s, open) : -1;
      if (call < 0 || close < m.index) { problems.push(`${where}: voice '${id}' is not an option of an ev.say call`); continue; }
      const a = args(s, open, close);
      const mm = /^v_([a-z]+)_([a-z0-9]+)_(\d{2})$/.exec(id);
      if (!mm) problems.push(`${where}: id '${id}' is not v_<speaker>_<scene>_<nn>`);
      const speaker = mm ? mm[1] : '', scene = mm ? mm[2] : '';
      if (mm && !SPEAKERS[speaker]) problems.push(`${where}: '${id}': speaker '${speaker}' is not a fixed story character (hero and companions have no voice)`);
      const t = textOf(a[0] || '');
      if (!t) { problems.push(`${where}: '${id}': the text is not a literal (${String(a[0]).slice(0, 40)})`); continue; }
      if (t.said && t.said !== speaker) problems.push(`${where}: '${id}' is said by '${t.said}' in the game`);
      if (/\{(hero|leader)\}/.test(t.text)) problems.push(`${where}: '${id}' contains {hero}/{leader} — the player names the hero, an actor cannot say it`);
      // the words the actor says: without the name prefix 名「…」 and without line breaks
      let spoken = t.text.replace(/\f/g, '\n');
      const pre = /^[^「\n]{1,12}「([\s\S]*)」$/.exec(spoken);
      if (pre && !t.said) spoken = pre[1];
      const flat = spoken.split('\n').map((x) => x.trim()).join('');
      const rec = EXT.map((e) => path.join(VOICE_DIR, id + '.' + e)).find((p) => fs.existsSync(p));
      lines.push({
        id, speaker, name: SPEAKERS[speaker] || speaker, scene, event: eventAt(s, call), file: rel, line,
        text: flat, display: spoken, chars: [...flat.replace(/[「」『』]/g, '')].length, seconds: seconds(flat),
        recorded: rec ? path.basename(rec) : '',
      });
    }
  }
  const seen = {};
  for (const l of lines) {
    if (seen[l.id]) problems.push(`${l.file}:${l.line}: duplicate voice id '${l.id}' (also ${seen[l.id]})`);
    else seen[l.id] = l.file + ':' + l.line;
  }
  const sk = Object.keys(SPEAKERS);
  const fo = (l) => { const i = ORDER.indexOf(path.basename(l.file, '.js')); return i < 0 ? 99 : i; };
  lines.sort((a, b) => sk.indexOf(a.speaker) - sk.indexOf(b.speaker) || fo(a) - fo(b) || a.line - b.line);
  return { lines, problems };
}

const csvCell = (v) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function toCsv(lines) {
  const cols = ['id', 'speaker', 'name', 'scene', 'event', 'file', 'line', 'text', 'chars', 'seconds', 'recorded'];
  return '﻿' + [cols.join(','), ...lines.map((l) => cols.map((c) => csvCell(l[c])).join(','))].join('\n') + '\n';
}
function toMd(lines) {
  const by = {};
  for (const l of lines) (by[l.speaker] = by[l.speaker] || []).push(l);
  const sum = (a, k) => a.reduce((n, l) => n + l[k], 0);
  const out = [];
  out.push('# ルミナス・クロニクル　ボイス収録台本', '');
  out.push('`node tools/voice_script.js` が src/ の台詞（`ev.say(…, { voice: \'<id>\' })`）から作る表。手で直さない。', '');
  out.push(`- 収録する台詞：**${lines.length} 行**（${Object.keys(by).length} 人）、合計 ${sum(lines, 'chars')} 字、目安 約 ${Math.round(sum(lines, 'seconds') / 60 * 10) / 10} 分`);
  out.push(`- 収録済み：${lines.filter((l) => l.recorded).length} / ${lines.length}`);
  out.push('- 主人公（プレイヤーが名前を付ける・しゃべらない）と仲間 20 人は声なし。`{hero}` を含む台詞は収録しない。');
  out.push('');
  out.push('## 納品の形');
  out.push('- ファイル名は **id そのまま**：`assets/voice/<id>.ogg`（`.m4a` `.mp3` `.wav` も可。同じ id が複数あれば ogg → m4a → mp3 → wav の順で 1 つ）。');
  out.push('- 1 行 = 1 ファイル。前後の無音は 0.1 秒以内に切る。モノラル、44.1/48 kHz。ピーク −3 dBFS、行どうしの音量をそろえる（目安 −18 LUFS）。');
  out.push('- 置いたら `node tools/build.js` で dist/index.html に入る（無い行は文字だけで進む）。台詞を送ると声は止まる。声のあいだ BGM は少し下がる。');
  out.push('- 「文字数」は読む字数（かっこを除く）、「秒」は目安。');
  out.push('');
  out.push('## 話者ごとの量', '', '| 話者 | 行 | 字 | 目安（秒） |', '|---|---:|---:|---:|');
  for (const sp of Object.keys(by)) out.push(`| ${by[sp][0].name} | ${by[sp].length} | ${sum(by[sp], 'chars')} | ${Math.round(sum(by[sp], 'seconds'))} |`);
  out.push('');
  for (const sp of Object.keys(by)) {
    out.push(`## ${by[sp][0].name}　\`${sp}\``, '', '| id | 場面 | 台詞 | 字 | 秒 | 済 |', '|---|---|---|---:|---:|:-:|');
    for (const l of by[sp]) {
      const txt = l.display.replace(/\|/g, '｜').split('\n').map((x) => x.trim()).join('<br>');
      out.push(`| \`${l.id}\` | ${l.event} (${l.file.replace(/^src\//, '')}:${l.line}) | ${txt} | ${l.chars} | ${l.seconds} | ${l.recorded ? '✓' : ''} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

function main() {
  const { lines, problems } = collect();
  for (const p of problems) console.log('✗ ' + p);
  if (process.argv.includes('--check')) {
    console.log(`voice_script: ${lines.length} voiced lines, ${problems.length} problem(s)`);
    process.exit(problems.length ? 1 : 0);
  }
  const oi = process.argv.indexOf('--out');
  const dir = oi > 0 ? path.resolve(process.argv[oi + 1]) : path.join(ROOT, 'design', 'voice');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'script.csv'), toCsv(lines));
  fs.writeFileSync(path.join(dir, 'script.md'), toMd(lines));
  const per = {};
  for (const l of lines) per[l.speaker] = (per[l.speaker] || 0) + 1;
  console.log(`voice_script: ${lines.length} lines → ${path.relative(ROOT, dir)}/script.csv, script.md  (${Object.entries(per).map(([k, v]) => k + ' ' + v).join(', ')})`);
  if (problems.length) process.exitCode = 1;
}

module.exports = { collect, toCsv, toMd, SPEAKERS };
if (require.main === module) main();
