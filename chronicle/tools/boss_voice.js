#!/usr/bin/env node
// Boss voices in battle (owner 2026-10-03): battle start, enrage, ultimate (one per ultimate move), defeat.
//   node tools/boss_voice.js            check design/voice/boss_lines.csv, write design/voice/boss_lines.md and
//                                       design/boss_voice_preview.html (players, relative ../assets/voice/)
//   node tools/boss_voice.js --check    only check (exit 1 on problems)
// Lines: design/voice/boss_lines.csv (id,boss,kind,move,text,direction), id bv_<boss without b_>_<kind>_<n>.
// Casting: design/voice/casting.json → boss.cast[<monster id>] ({speaker} = reuse a story speaker, or an own voice).
// In game (v2): src/data/boss_voice.js (R.DB.bossVoice) + src/i18n/<lang>/boss_voice.js ('bossVoice.<id>', ja = the CSV text),
//   played by src/systems/battle/voice_boss.js. Audio: node tools/voice_tts.js --boss → assets/voice/bv_*.ogg
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV = path.join(ROOT, 'design', 'voice', 'boss_lines.csv');
const V2 = path.join(ROOT, 'v2');
const KINDS = ['start', 'enrage', 'ult', 'defeat'];
const KIND_JA = { start: '戦闘の始め', enrage: '暴走', ult: '必殺技', defeat: '倒れた時' };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function loadLines(file) {
  const { parseCsv } = require('./battle_voice');
  return parseCsv(fs.readFileSync(file || CSV, 'utf8')).map((r) => Object.assign(r, { n: +String(r.id).split('_').pop() }));
}
function loadCasting() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'design', 'voice', 'casting.json'), 'utf8')); }
/** the casting entry of a boss, with a reused story speaker merged in → {voice, type, profile, style, fx, pitch, speaker?} */
function castOf(C, boss) {
  const b = C.boss && C.boss.cast && C.boss.cast[boss];
  if (!b) return null;
  if (b.speaker) {
    const s = (C.speakers || {})[b.speaker];
    if (!s) return null;
    return Object.assign({}, s, b, { voice: s.voice, type: s.type, fx: b.fx !== undefined ? b.fx : s.fx, pitch: b.pitch != null ? b.pitch : s.pitch });
  }
  return b;
}
/** the v2 game: monsters, the ultimate moves of the fx table, R.DB.bossVoice and the ja texts */
function game() {
  const R = require(path.join(V2, 'tools', 'lib', 'load'))({ quiet: true });
  const src = fs.readFileSync(path.join(V2, 'src', 'art', 'fx', 'fx_seq_table_boss.js'), 'utf8');
  const ults = new Set([...src.matchAll(/def\('([a-z0-9_]+)'[^\n]*ult: 1/g)].map((m) => m[1]));
  const ja = {};
  for (const l of ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko']) {
    const f = path.join(V2, 'src', 'i18n', l, 'boss_voice.js');
    ja[l] = {};
    if (!fs.existsSync(f)) continue;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/'bossVoice\.([a-z0-9_]+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) ja[l][m[1]] = m[2] != null ? m[2] : JSON.parse('"' + m[3] + '"');
  }
  return { R, ults, texts: ja };
}
/** spoken length (no punctuation) */
const spokenLen = (t) => [...String(t).replace(/[…！？。、「」―ー〜!?\s　]/g, '')].length;

/** → problems[] */
function check(lines, C, G) {
  const P = [];
  const ids = new Set();
  const M = G.R.DB.monsters, BVdb = G.R.DB.bossVoice || {};
  for (const l of lines) {
    const short = String(l.boss).replace(/^b_/, '');
    if (!/^bv_[a-z0-9_]+_(start|enrage|ult|defeat)_\d$/.test(l.id)) P.push(`${l.id}: id is not bv_<boss>_<kind>_<n>`);
    if (l.id !== `bv_${short}_${l.kind}_${l.n}`) P.push(`${l.id}: id does not match boss/kind`);
    if (ids.has(l.id)) P.push(`${l.id}: duplicate id`);
    ids.add(l.id);
    if (!KINDS.includes(l.kind)) P.push(`${l.id}: kind ${l.kind}`);
    if (!M[l.boss] || !(M[l.boss].flags || []).includes('boss')) P.push(`${l.id}: ${l.boss} is not a boss`);
    if (l.kind === 'ult') {
      if (!l.move) P.push(`${l.id}: an ult line needs the move`);
      else if (!G.ults.has(l.move)) P.push(`${l.id}: ${l.move} is not an ultimate (ult: 1) of fx_seq_table_boss.js`);
      else if (!(M[l.boss].actions || []).some((a) => a.id === l.move || ((G.R.DB.bossActions[a.id] || {}).telegraph || {}).next === l.move)) P.push(`${l.id}: ${l.boss} does not use ${l.move}`);
    } else if (l.move) P.push(`${l.id}: move only for ult lines`);
    if (!l.text) P.push(`${l.id}: empty text`);
    if ([...l.text].length > 20) P.push(`${l.id}: longer than 20 (${l.text})`);
    if (/\.\.\.|…(?!…)/.test(l.text.replace(/……/g, ''))) P.push(`${l.id}: ellipsis must be ……`);
    if (!l.direction) P.push(`${l.id}: no direction`);
    if (!castOf(C, l.boss) || !castOf(C, l.boss).voice) P.push(`${l.id}: ${l.boss} has no casting`);
    // the game must have the same line
    const e = BVdb[l.boss];
    const inGame = e && (l.kind === 'ult' ? e.ult && e.ult[l.move] && e.ult[l.move].id === l.id : (e[l.kind] || []).some((x) => x.id === l.id));
    if (!inGame) P.push(`${l.id}: not in v2 src/data/boss_voice.js`);
    if (G.texts.ja[l.id] !== l.text) P.push(`${l.id}: ja text differs from the CSV (${G.texts.ja[l.id]})`);
    for (const lang of ['en', 'zh-Hans', 'zh-Hant', 'ko']) if (!G.texts[lang][l.id]) P.push(`${l.id}: no ${lang} subtitle`);
  }
  // the game must not have lines the CSV lacks
  for (const [boss, e] of Object.entries(BVdb)) {
    const all = [].concat(e.start || [], e.enrage || [], e.defeat || [], Object.values(e.ult || {}));
    for (const x of all) if (!ids.has(x.id)) P.push(`${boss}: ${x.id} is in the game but not in the CSV`);
  }
  // the boss casting: own voices are not shared with a story, hero, companion or another boss voice
  const used = {};
  for (const [k, s] of Object.entries(C.speakers || {})) (used[s.voice] = used[s.voice] || []).push('story:' + k);
  for (const [k, v] of Object.entries((C.hero || {}).voices || {})) (used[v.voice] = used[v.voice] || []).push('hero:' + k);
  for (const [k, v] of Object.entries((C.battle || {}).cast || {})) (used[v.voice] = used[v.voice] || []).push('battle:' + k);
  for (const [k, b] of Object.entries((C.boss || {}).cast || {})) {
    if (b.speaker) { if (!(C.speakers || {})[b.speaker]) P.push(`boss ${k}: speaker ${b.speaker} does not exist`); continue; }
    if (used[b.voice]) P.push(`boss ${k}: voice ${b.voice} is already used by ${used[b.voice].join(', ')}`);
    (used[b.voice] = used[b.voice] || []).push('boss:' + k);
  }
  return P;
}

const fileOf = (id) => { for (const e of ['ogg', 'm4a', 'mp3', 'wav']) { const f = path.join(ROOT, 'assets', 'voice', id + '.' + e); if (fs.existsSync(f)) return f; } return null; };
function durOf(f) {
  try { const GA = require('./lib/gemini_audio'); const d = GA.decode(f, { rate: 24000, channels: 1 }); return d.channels[0].length / d.rate; } catch (e) { return null; }
}
const bossName = (G, id) => (G.R.DB.monsters[id] || {}).name || id;

function writeMd(lines, C, G) {
  const L = ['# ルミナス・クロニクル　ボスの声（戦闘）', ''];
  L.push('持ち主 2026-10-03。戦闘の始め・暴走（怒り狂った／本気になった）・必殺技（技ごとに 1 つ）・倒れた時の短い一言。正は `design/voice/boss_lines.csv`（このファイルは `node tools/boss_voice.js` が作る。手で直さない）。', '');
  L.push('- ゲーム: `v2/src/data/boss_voice.js`（R.DB.bossVoice）・字幕 `v2/src/i18n/<言語>/boss_voice.js`・鳴らし方 `v2/src/systems/battle/voice_boss.js`');
  L.push('- 鳴らし方: 待たない。新しい声が前の声を止める（仲間の戦闘ボイスと同じ口）。倍速・リピート中は始めと暴走を出さず、必殺技はその戦闘で初めての技だけ。設定「戦闘ボイス」なしなら出さない。');
  L.push('- 声の無いボス（言葉を持たない獣）: ページ食らい・ダストウィング・根食らい・砂もぐり・狼の群れ頭・吹雪の大狼・深みの大ダコ・岩食らい・炎の番犬・溶岩の巨獣・星食らい・人形の楽団・本の巨人・鉱脈の主');
  L.push('- 作り直し: `node tools/voice_tts.js --boss --only <id> --force`', '');
  L.push('## 配役', '', '| ボス | 声 | 物語の声を使う | 演出 |', '|---|---|---|---|');
  const bosses = [...new Set(lines.map((l) => l.boss))];
  for (const b of bosses) {
    const c = castOf(C, b) || {}, raw = C.boss.cast[b] || {};
    L.push(`| ${bossName(G, b)} \`${b}\` | \`${c.voice}\`${c.pitch && c.pitch !== 1 ? ` ×${c.pitch}` : ''}${c.fx ? ` fx ${typeof c.fx === 'string' ? c.fx : 'p' + c.fx.p}` : ''} | ${raw.speaker ? '`' + raw.speaker + '`' : '新'} | ${raw.direction || c.style || ''} |`);
  }
  L.push('');
  for (const b of bosses) {
    L.push(`## ${bossName(G, b)}`, '', '| id | 場面 | 技 | 台詞 | 演技 |', '|---|---|---|---|---|');
    for (const l of lines.filter((x) => x.boss === b)) L.push(`| \`${l.id}\` | ${KIND_JA[l.kind]} | ${l.move ? (G.R.DB.bossActions[l.move] || {}).name || l.move : ''} | ${l.text} | ${l.direction} |`);
    L.push('');
  }
  fs.writeFileSync(path.join(ROOT, 'design', 'voice', 'boss_lines.md'), L.join('\n'));
}

function writePreview(lines, C, G) {
  let n = 0, bytes = 0, missing = 0;
  const cards = [];
  for (const b of [...new Set(lines.map((l) => l.boss))]) {
    const c = castOf(C, b) || {}, raw = C.boss.cast[b] || {};
    const rows = lines.filter((l) => l.boss === b).map((l) => {
      const f = fileOf(l.id);
      let cell = '<i>missing</i>';
      if (f) {
        const sz = fs.statSync(f).size, d = durOf(f);
        n++; bytes += sz;
        cell = `<button class="play" data-src="../assets/voice/${esc(path.basename(f))}" aria-label="play ${esc(l.id)}">▶</button> <small>${d != null ? d.toFixed(2) + ' s · ' : ''}${(sz / 1024).toFixed(1)} KB</small>`;
      } else missing++;
      const mv = l.move ? ' · ' + esc((G.R.DB.bossActions[l.move] || {}).name || l.move) : '';
      return `<tr><td>${cell}</td><td>${esc(KIND_JA[l.kind])}${mv}</td><td class="t">${esc(l.text)}<br><small>${esc(G.texts.en[l.id] || '')}</small></td><td><code>${esc(l.id)}</code><br><small>${esc(l.direction)}</small></td></tr>`;
    });
    cards.push(`<section><h3>${esc(bossName(G, b))} <small><code>${esc(b)}</code> · <code>${esc(c.voice)}</code>${raw.speaker ? ' (story: ' + esc(raw.speaker) + ')' : ''}</small> <button class="all">all</button></h3><table>${rows.join('\n')}</table></section>`);
  }
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boss Voice Preview</title>
<style>
:root{--bg:#fbfaf7;--fg:#222;--mute:#666;--line:#ddd;--acc:#9b3b2b}
@media (prefers-color-scheme: dark){:root{--bg:#16171a;--fg:#e6e6e6;--mute:#9a9a9a;--line:#333;--acc:#eaa08d}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1000px;padding:16px}
h1{font-size:20px}h3{margin:24px 0 4px;font-size:16px}
table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--line);padding:5px 8px;vertical-align:top}
td:first-child{white-space:nowrap;width:9em}td.t{font-size:16px}
small,i{color:var(--mute)}code{font-size:12px}
button{font-size:13px;min-width:2.2em;cursor:pointer}button.on{background:var(--acc);color:var(--bg)}
</style></head><body>
<h1>ルミナス・クロニクル — ボスの声 試聴</h1>
<p>${n} 本（${(bytes / 1048576).toFixed(2)} MB）${missing ? `、未生成 ${missing} 本` : ''}。台本 <code>design/voice/boss_lines.md</code>。</p>
${cards.join('\n')}
<script>
const au = new Audio(); let queue = [];
function play(src, btn) { document.querySelectorAll('button.on').forEach((b) => b.classList.remove('on')); au.src = src; au.play(); if (btn) btn.classList.add('on'); }
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
  fs.writeFileSync(path.join(ROOT, 'design', 'boss_voice_preview.html'), html);
  return { n, bytes, missing };
}

function main(argv) {
  const lines = loadLines(), C = loadCasting(), G = game();
  const P = check(lines, C, G);
  for (const p of P) console.log('  ✗ ' + p);
  console.log(`[boss_voice] ${lines.length} lines, ${new Set(lines.map((l) => l.boss)).size} bosses, ${P.length} problem(s)`);
  if (argv.includes('--check')) return P.length ? 1 : 0;
  writeMd(lines, C, G);
  const r = writePreview(lines, C, G);
  console.log(`[boss_voice] boss_lines.md + boss_voice_preview.html: ${r.n} files (${(r.bytes / 1048576).toFixed(2)} MB), ${r.missing} missing`);
  return P.length ? 1 : 0;
}

module.exports = { CSV, KINDS, loadLines, castOf, check, spokenLen };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
