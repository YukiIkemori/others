#!/usr/bin/env node
// Battle voices of the 20 companions + the hero (BRIEF A36 / A37).
//   node tools/battle_voice.js            check design/voice/battle_lines.csv, write design/voice/battle_lines.md
//                                         and design/battle_voice_preview.html (players, relative ../assets/voice/)
//   node tools/battle_voice.js --check    only check (exit 1 on problems)
// Lines: design/voice/battle_lines.csv (id,char,kind,text,direction), id b_<char>_<kind>_<n>.
// Casting: design/voice/casting.json → battle.cast[<char>] (voice, direction, profile, style, pitch).
// Audio: node tools/voice_tts.js --battle → assets/voice/b_<char>_<kind>_<n>.ogg (hero: v_hero_<g>_<kind>_<n>).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV = path.join(ROOT, 'design', 'voice', 'battle_lines.csv');
const KINDS = ['attack', 'bigtech', 'spell', 'hurt', 'ko', 'victory'];
const COUNT = { attack: [2, 3], bigtech: [1, 2], spell: [1, 1], hurt: [1, 2], ko: [1, 1], victory: [1, 1] };
const KIND_JA = { attack: '通常攻撃', bigtech: '大技・閃き', glimmer: '閃き', spell: '術', hurt: '被弾', ko: '戦闘不能', victory: '勝利' };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** spoken length: characters without punctuation / small marks */
const spokenLen = (t) => [...String(t).replace(/[…！？。、「」―ー〜!?\s]/g, '')].length;

function parseCsv(text) {
  const rows = [];
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (q) { if (c === '"' && raw[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { cells.push(cur); cur = ''; } else cur += c;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : r[i]])));
}
/** [{id, char, kind, n, text, direction}] in file order */
function loadLines(file) {
  return parseCsv(fs.readFileSync(file || CSV, 'utf8')).map((r) => Object.assign(r, { n: +String(r.id).split('_').pop() }));
}
function loadCasting() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'design', 'voice', 'casting.json'), 'utf8')); }
function companions() {
  const R = require('./lib/load')({ quiet: true });
  return R.DB.companions || {};
}

/** → problems[] */
function check(lines, C, comp) {
  const P = [];
  const cast = (C.battle && C.battle.cast) || {};
  const ids = new Set();
  for (const l of lines) {
    if (!/^b_[a-z]+_(attack|bigtech|spell|hurt|ko|victory)_\d$/.test(l.id)) P.push(`${l.id}: id is not b_<char>_<kind>_<n>`);
    if (l.id !== `b_${l.char}_${l.kind}_${l.n}`) P.push(`${l.id}: id does not match char/kind`);
    if (ids.has(l.id)) P.push(`${l.id}: duplicate id`);
    ids.add(l.id);
    if (!l.text) P.push(`${l.id}: empty text`);
    if (/\{hero\}|\{leader\}/.test(l.text)) P.push(`${l.id}: {hero} in a battle line`);
    if (l.kind === 'attack' && spokenLen(l.text) > 6) P.push(`${l.id}: attack shout longer than 6 (${l.text})`);
    if (l.kind === 'bigtech' && [...l.text].length > 20) P.push(`${l.id}: big-technique line longer than 20 (${l.text})`);
    if (!l.direction) P.push(`${l.id}: no direction`);
  }
  for (const id of Object.keys(comp)) {
    const mine = lines.filter((l) => l.char === id);
    if (!cast[id] || !cast[id].voice) P.push(`${id}: no battle casting`);
    for (const k of KINDS) {
      const n = mine.filter((l) => l.kind === k).length;
      if (n < COUNT[k][0] || n > COUNT[k][1]) P.push(`${id}: ${n} ${k} line(s), want ${COUNT[k].join('–')}`);
    }
  }
  for (const l of lines) if (!comp[l.char]) P.push(`${l.id}: ${l.char} is not a companion`);
  // distinct characters: no two companions share a voice or a line
  const byVoice = {};
  for (const [id, c] of Object.entries(cast)) (byVoice[c.voice] = byVoice[c.voice] || []).push(id);
  for (const [v, who] of Object.entries(byVoice)) if (who.length > 1) P.push(`voice ${v} is used by ${who.join(', ')}`);
  const story = new Set(Object.values(C.speakers || {}).map((s) => s.voice).concat(Object.values((C.hero || {}).voices || {}).map((v) => v.voice)));
  for (const [id, c] of Object.entries(cast)) if (story.has(c.voice)) P.push(`${id}: voice ${c.voice} is a story / hero voice`);
  const byText = {};
  for (const l of lines) (byText[l.text] = byText[l.text] || []).push(l.id);
  for (const [t, who] of Object.entries(byText)) if (who.length > 1) P.push(`「${t}」 is used by ${who.join(', ')}`);
  return P;
}

const fileOf = (id) => { for (const e of ['ogg', 'm4a', 'mp3', 'wav']) { const f = path.join(ROOT, 'assets', 'voice', id + '.' + e); if (fs.existsSync(f)) return f; } return null; };
function durOf(f) {
  try { const GA = require('./lib/gemini_audio'); const d = GA.decode(f, { rate: 24000, channels: 1 }); return d.channels[0].length / d.rate; } catch (e) { return null; }
}

function heroRows(C) {
  const out = [];
  for (const g of Object.keys(C.hero.voices)) for (const kind of Object.keys(C.hero.lines)) C.hero.lines[kind].forEach((ln, i) => out.push({ id: `v_hero_${g}_${kind}_${i + 1}`, g, kind, text: ln.text, direction: ln.note }));
  return out;
}

function writeMd(lines, C, comp) {
  const cast = C.battle.cast;
  const L = [];
  L.push('# ルミナス・クロニクル　戦闘ボイス台本（仲間 20 人＋主人公）', '');
  L.push('BRIEF A36 / A37。物語に絡まない短い戦闘用の台詞だけ。仲間の個別の話は作らない。正は `design/voice/battle_lines.csv`（このファイルは `node tools/battle_voice.js` が作る。手で直さない）。', '');
  L.push(`- 仲間 ${Object.keys(comp).length} 人 × 10 本 = **${lines.length} 本**＋主人公 男女 × ${heroRows(C).length / 2} 本`);
  L.push('- 種類: 通常攻撃 3（短い掛け声・6 字以内）／大技・閃き 2（個性のある一言・20 字以内）／術 1／被弾 2／戦闘不能 1／勝利 1');
  L.push('- ファイル: `assets/voice/b_<仲間id>_<種類>_<n>.ogg`（主人公は `v_hero_<m|f>_<種類>_<n>.ogg`）。鳴らし方は design/notes/audio.md §13.2。');
  L.push('- 声: Gemini TTS の既製の声（物語の登場人物・主人公の声とは重ねない）。作り直し: `node tools/voice_tts.js --battle --only <id> --force`', '');
  L.push('## 配役', '', '| 仲間 | 性別・年齢 | 肩書 | 声 | 演出 |', '|---|---|---|---|---|');
  for (const [id, c] of Object.entries(comp)) {
    const k = cast[id] || {};
    L.push(`| ${c.name} \`${id}\` | ${c.gender === 'f' ? '女' : '男'} ${c.age} | ${c.title} | \`${k.voice}\`${k.pitch && k.pitch !== 1 ? `（ピッチ ×${k.pitch}）` : ''} | ${k.direction || ''} |`);
  }
  L.push('');
  for (const [id, c] of Object.entries(comp)) {
    const k = cast[id] || {};
    L.push(`## ${c.name}（${c.title}）`, '', `声 \`${k.voice}\` — ${k.direction}`, '', '| id | 種類 | 台詞 | 演技 |', '|---|---|---|---|');
    for (const l of lines.filter((x) => x.char === id)) L.push(`| \`${l.id}\` | ${KIND_JA[l.kind]} | ${l.text} | ${l.direction} |`);
    L.push('');
  }
  L.push('## 主人公（男女共通の台詞）', '', `男 \`${C.hero.voices.m.voice}\`（${C.hero.voices.m.name}）／女 \`${C.hero.voices.f.voice}\``, '', '| 種類 | n | 台詞 | 演技 |', '|---|---|---|---|');
  for (const kind of Object.keys(C.hero.lines)) C.hero.lines[kind].forEach((ln, i) => L.push(`| ${KIND_JA[kind] || kind} | ${i + 1} | ${ln.text} | ${ln.note} |`));
  L.push('');
  fs.writeFileSync(path.join(ROOT, 'design', 'voice', 'battle_lines.md'), L.join('\n'));
}

function writePreview(lines, C, comp) {
  const cast = C.battle.cast;
  let n = 0, bytes = 0, missing = 0;
  const row = (id, kind, text, dir) => {
    const f = fileOf(id);
    let cell = '<i>missing</i>';
    if (f) {
      const sz = fs.statSync(f).size, d = durOf(f);
      n++; bytes += sz;
      cell = `<button class="play" data-src="../assets/voice/${esc(path.basename(f))}" aria-label="play ${esc(id)}">▶</button> <small>${d != null ? d.toFixed(2) + ' s · ' : ''}${(sz / 1024).toFixed(1)} KB</small>`;
    } else missing++;
    return `<tr><td>${cell}</td><td>${esc(KIND_JA[kind] || kind)}</td><td class="t">${esc(text)}</td><td><code>${esc(id)}</code><br><small>${esc(dir)}</small></td></tr>`;
  };
  const cards = [];
  for (const [id, c] of Object.entries(comp)) {
    const k = cast[id] || {};
    const mine = lines.filter((l) => l.char === id);
    cards.push(`<section id="c-${id}"><h3>${esc(c.name)} <small>${esc(c.title)} · ${c.gender === 'f' ? '女' : '男'} ${c.age} · <code>${esc(k.voice)}</code>${k.pitch && k.pitch !== 1 ? ' ×' + k.pitch : ''} · ${esc(k.direction)}</small> <button class="all" data-ids="${mine.map((l) => l.id).join(',')}">全部</button></h3>
<table>${mine.map((l) => row(l.id, l.kind, l.text, l.direction)).join('\n')}</table></section>`);
  }
  const hero = [];
  for (const g of Object.keys(C.hero.voices)) {
    const rows = heroRows(C).filter((h) => h.g === g);
    hero.push(`<section id="c-hero-${g}"><h3>主人公（${g === 'm' ? '男' : '女'}） <small><code>${esc(C.hero.voices[g].voice)}</code></small> <button class="all" data-ids="${rows.map((h) => h.id).join(',')}">全部</button></h3>
<table>${rows.map((h) => row(h.id, h.kind, h.text, h.direction)).join('\n')}</table></section>`);
  }
  const nav = Object.entries(comp).map(([id, c]) => `<a href="#c-${id}">${esc(c.name)}</a>`).join(' · ');
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Battle Voice Preview</title>
<style>
:root{--bg:#fbfaf7;--fg:#222;--mute:#666;--line:#ddd;--acc:#2b5d9b}
@media (prefers-color-scheme: dark){:root{--bg:#16171a;--fg:#e6e6e6;--mute:#9a9a9a;--line:#333;--acc:#8db4ea}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1000px;padding:16px}
h1{font-size:20px}h2{margin-top:32px;border-bottom:2px solid var(--line)}h3{margin:24px 0 4px;font-size:16px}
table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--line);padding:5px 8px;vertical-align:top}
td:first-child{white-space:nowrap;width:9em}td.t{font-size:16px}
small,i{color:var(--mute)}code{font-size:12px}a{color:var(--acc)}
button{font-size:13px;min-width:2.2em;cursor:pointer}button.on{background:var(--acc);color:var(--bg)}
</style></head><body>
<h1>ルミナス・クロニクル — 戦闘ボイス試聴</h1>
<p>仲間 20 人＋主人公（男女）。${n} 本（${(bytes / 1048576).toFixed(2)} MB）${missing ? `、未生成 ${missing} 本` : ''}。ファイルは <code>assets/voice/b_&lt;仲間&gt;_&lt;種類&gt;_&lt;n&gt;.ogg</code> と <code>v_hero_&lt;m|f&gt;_…</code>。
台本 <code>design/voice/battle_lines.md</code>、鳴らし方 <code>design/notes/audio.md</code> §13.2。「全部」は 1 人分を順に鳴らします（新しい声は前の声を止める、ゲームと同じ）。</p>
<p>${nav} · <a href="#hero">主人公</a></p>
<h2>仲間</h2>
${cards.join('\n')}
<h2 id="hero">主人公</h2>
${hero.join('\n')}
<script>
const au = new Audio(); let queue = [];
function play(src, btn) {
  document.querySelectorAll('button.on').forEach((b) => b.classList.remove('on'));
  au.src = src; au.play(); if (btn) btn.classList.add('on');
}
au.addEventListener('ended', () => { document.querySelectorAll('button.play.on').forEach((b) => b.classList.remove('on')); if (queue.length) { const b = queue.shift(); setTimeout(() => play(b.dataset.src, b), 250); } });
document.addEventListener('click', (e) => {
  const p = e.target.closest('button.play');
  if (p) { queue = []; play(p.dataset.src, p); return; }
  const a = e.target.closest('button.all');
  if (a) { queue = [...a.closest('section').querySelectorAll('button.play')]; const b = queue.shift(); if (b) play(b.dataset.src, b); }
});
</script>
</body></html>
`;
  fs.writeFileSync(path.join(ROOT, 'design', 'battle_voice_preview.html'), html);
  return { n, bytes, missing };
}

function main(argv) {
  const lines = loadLines(), C = loadCasting(), comp = companions();
  const P = check(lines, C, comp);
  for (const p of P) console.log('  ✗ ' + p);
  console.log(`[battle_voice] ${lines.length} companion lines, ${Object.keys(comp).length} companions, ${P.length} problem(s)`);
  if (argv.includes('--check')) return P.length ? 1 : 0;
  writeMd(lines, C, comp);
  const r = writePreview(lines, C, comp);
  console.log(`[battle_voice] battle_lines.md + battle_voice_preview.html: ${r.n} files (${(r.bytes / 1048576).toFixed(2)} MB), ${r.missing} missing`);
  return P.length ? 1 : 0;
}

module.exports = { CSV, KINDS, COUNT, loadLines, parseCsv, check, spokenLen, companions };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
