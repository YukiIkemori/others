#!/usr/bin/env node
// v2 slice story voices (tier-A NPCs) + town greeting barks, and the listening page of the slice audio upgrade.
//   node tools/story_voice.js            check design/voice/story_v2_lines.csv, write design/voice/story_v2_lines.md,
//                                        v2/design/voice_story_map.json (voice id → event file / event / line) and
//                                        design/story_audio_preview.html (voices + the new / regenerated BGM, A/B with
//                                        design/bgm/prev/, loop-seam button)
//   node tools/story_voice.js --check    only check (exit 1 on problems)
// Lines: design/voice/story_v2_lines.csv (id,speaker,kind,file,event,key,text,direction)
//   kind   story (key story line) | optional (not in the design yet, e.g. a caption) | bark (1–2 s greeting when a talk opens)
//   text   exactly the JS string of the event (with \n) — the check fails when the v2 source no longer contains it
// Casting: design/voice/casting.json speakers[<speaker>]. Audio: node tools/voice_tts.js --story2 → assets/voice/<id>.ogg
// BGM: design/bgm/prompts_v2.json (node tools/lyria_bgm.js --prompts design/bgm/prompts_v2.json …).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV = path.join(ROOT, 'design', 'voice', 'story_v2_lines.csv');
const MAP = path.join(ROOT, 'v2', 'design', 'voice_story_map.json');
const PAGE = path.join(ROOT, 'design', 'story_audio_preview.html');
const PROMPTS2 = path.join(ROOT, 'design', 'bgm', 'prompts_v2.json');
const KINDS = ['story', 'optional', 'bark', 'retired'];   // retired: 声を外した行（音は残す。持ち主 2026-09-28「脇役の声は一旦外して」）
const NAMES = { otto: 'オットー', berna: 'ベルナ', fine: 'フィーネ', rowell: 'ロウェル', elm: 'エルム', tadeo: 'タデオ', fishwife: '漁師のおかみ', gateguard: '門番', master: '潮風亭のマスター', gord: 'ゴード', hanna: 'ハンナ', rita: 'リタ', pim: 'ピム' };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** the CSV text (JS-escaped \n) → what is said */
const plain = (t) => String(t).replace(/\\n/g, '');
/** seconds a line takes, roughly (7 spoken characters / s + pauses) */
function estimate(t) {
  const s = plain(t);
  const n = [...s.replace(/[…！？。、「」『』―ー〜♪!?\s　]/g, '')].length;
  return Math.round((n / 7 + (s.match(/……/g) || []).length * 0.4 + 0.4) * 10) / 10;
}
function loadLines(file) {
  const { parseCsv } = require('./battle_voice');
  return parseCsv(fs.readFileSync(file || CSV, 'utf8'));
}
function loadCasting() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'design', 'voice', 'casting.json'), 'utf8')); }
/** 1-based line of `text` (as a JS string literal) in the v2 file, or 0 */
function lineOf(file, text) {
  const f = path.join(ROOT, file);
  if (!fs.existsSync(f)) return -1;
  let src = fs.readFileSync(f, 'utf8');
  // v2 の台詞は R.T('key') で表（src/i18n/ja）にある: 日本語の文に戻してから探す（2026-10-04）
  if (/^v2[\\/]/.test(file)) { try { src = require('../v2/tools/lib/i18n_src').inline(src); } catch (e) { /* i18n table unavailable */ } }
  const i = src.indexOf(text);
  return i < 0 ? 0 : src.slice(0, i).split('\n').length;
}

/** → problems[] */
function check(lines, C) {
  const P = [];
  const ids = new Set();
  let known = new Set();
  try { known = new Set(require('./voice_script').collect().lines.map((l) => l.id)); } catch (e) { /* v1 script unavailable */ }
  for (const l of lines) {
    if (!/^v_[a-z]+_[a-z0-9]+_\d\d$/.test(l.id)) P.push(`${l.id}: id is not v_<speaker>_<scene>_<nn>`);
    if (!l.id.startsWith(`v_${l.speaker}_`)) P.push(`${l.id}: id does not start with v_${l.speaker}_`);
    if (ids.has(l.id)) P.push(`${l.id}: duplicate id`);
    if (known.has(l.id)) P.push(`${l.id}: already used by design/voice/script.csv`);
    ids.add(l.id);
    if (!KINDS.includes(l.kind)) P.push(`${l.id}: kind ${l.kind} not in ${KINDS.join('/')}`);
    if (!l.text) P.push(`${l.id}: empty text`);
    if (/\{hero\}|\{leader\}/.test(l.text)) P.push(`${l.id}: {hero} lines are not voiced`);
    if (!l.direction) P.push(`${l.id}: no direction`);
    const sp = (C.speakers || {})[l.speaker];
    if (!sp || !sp.voice || !sp.profile) P.push(`${l.id}: speaker ${l.speaker} has no casting`);
    if (l.kind === 'bark' && estimate(l.text) > 2.2) P.push(`${l.id}: a bark should be 1–2 s (${l.text})`);
    // the line must still be in the v2 source (barks are greetings, not lines of the source)
    if (l.kind === 'retired') continue;   // 外した行は元の文を探さない
    if (l.kind !== 'bark') {
      const n = lineOf(l.file, l.text);
      if (n < 0) P.push(`${l.id}: ${l.file} does not exist`);
      else if (n === 0) P.push(`${l.id}: text not found in ${l.file} (changed by the polish pass?)`);
    } else if (lineOf(l.file, l.event.split(' ')[0]) <= 0 && lineOf(l.file, `'${l.speaker}'`) <= 0) P.push(`${l.id}: ${l.file} has neither the event nor the speaker`);
  }
  // distinct voices: a new speaker must not share a voice with another story speaker, the hero or a battle voice
  const used = {};
  for (const [k, s] of Object.entries(C.speakers || {})) (used[s.voice] = used[s.voice] || []).push('story:' + k);
  for (const [k, v] of Object.entries((C.hero || {}).voices || {})) (used[v.voice] = used[v.voice] || []).push('hero:' + k);
  for (const [k, v] of Object.entries((C.battle || {}).cast || {})) (used[v.voice] = used[v.voice] || []).push('battle:' + k);
  const mine = new Set(lines.map((l) => l.speaker));
  for (const [v, who] of Object.entries(used)) {
    const m = who.filter((w) => mine.has(w.replace(/^story:/, '')) && w.startsWith('story:'));
    if (m.length && who.length > 1 && !(who.length === 2 && who.every((w) => /^story:(melda|mistwitch)$/.test(w)))) P.push(`voice ${v} is shared: ${who.join(', ')}`);
  }
  return P;
}

const vfile = (id) => { for (const e of ['ogg', 'm4a', 'mp3', 'wav']) { const f = path.join(ROOT, 'assets', 'voice', id + '.' + e); if (fs.existsSync(f)) return f; } return null; };
function durOf(f) {
  try { const GA = require('./lib/gemini_audio'); const d = GA.decode(f, { rate: 24000, channels: 1 }); return d.channels[0].length / d.rate; } catch (e) { return null; }
}

function writeMd(lines, C) {
  const L = ['# ルミナス・クロニクル v2 縦切り　物語ボイス（ティア A）と町のあいさつ', ''];
  L.push('正は `design/voice/story_v2_lines.csv`（このファイルは `node tools/story_voice.js` が作る。手で直さない）。文面は v2 のイベントと 1 字も違わない（違えば check が落ちる）。');
  L.push('主人公は物語ではしゃべらない（STORY_BIBLE 冒頭）ので、主人公の台詞は無い。ラザロは 5 階より前に声で出さない（§5.1）ので縦切りには無い。ノアは縦切りに出ない。', '');
  L.push('- 種類: story = 物語の要の台詞／optional = 設計では声なしの所（使うかはオーナーとリード）／bark = 話しかけたときの 1〜2 秒のあいさつ');
  L.push('- 作り方: `node tools/voice_tts.js --story2`（無いファイルだけ。`--only <id> --force` で作り直し）。つなぎ方: `v2/design/voice_story_map.json`', '');
  L.push('## 配役（新しく足した人）', '', '| 話者 | 声 | 役 |', '|---|---|---|');
  for (const sp of [...new Set(lines.map((l) => l.speaker))]) {
    const s = C.speakers[sp] || {};
    L.push(`| ${NAMES[sp] || sp} \`${sp}\` | \`${s.voice}\`${s.pitch && s.pitch !== 1 ? ` ×${s.pitch}` : ''}${s.fx ? ` fx ${s.fx}` : ''} | ${s.profile || ''} |`);
  }
  L.push('');
  for (const sp of [...new Set(lines.map((l) => l.speaker))]) {
    L.push(`## ${NAMES[sp] || sp}`, '', '| id | 種類 | 場面 | 台詞 | 演技 |', '|---|---|---|---|---|');
    for (const l of lines.filter((x) => x.speaker === sp)) L.push(`| \`${l.id}\` | ${l.kind} | \`${l.event}\` ${l.key} | ${l.text.replace(/\\n/g, '<br>')} | ${l.direction} |`);
    L.push('');
  }
  fs.writeFileSync(path.join(ROOT, 'design', 'voice', 'story_v2_lines.md'), L.join('\n'));
}

function writeMap(lines) {
  const out = {
    _readme: [
      'Voice id → where it plays in the v2 slice (written by chronicle/tools/story_voice.js; do not edit by hand).',
      'story / optional: add `voice: \'<id>\'` to the options of the ev.say / E.say that shows `text` (file, event, key; `line` = where the text was on 2026-09-27).',
      '  For a say with a list of pages, pass `voice: [id1, id2]` (one id per page). For a line inside a list such as P2 in prologue_roa.js, pass the id of that entry to its E.say.',
      '  optional = the design says "no voice" there (none at the moment: the opening captions are voiced since 2026-09-27, owner request).',
      '  captions: ev.caption(text, {ms, voice: \'<id>\'}) plays the voice with the caption and waits for its end (UIK caption, 2026-09-27; the opening v_fine_opening_01〜03 and the lighthouse song v_fine_song_01・02).',
      'bark: a 1–2 s greeting played when the player opens the talk: R.Audio.playVoice(id) at the start of the talk event (or a `bark` field on the map NPC read by the field talk code). Suggested: only the first talk per visit to a map, never over a voiced line.',
      'Text rule: the voiced text must stay exactly as it is; if the polish pass changes one of these texts, drop the voice from that say (node chronicle/tools/story_voice.js --check lists them).',
    ],
    lines: {},
  };
  for (const l of lines) {
    const n = l.kind === 'bark' ? null : lineOf(l.file, l.text);
    out.lines[l.id] = { speaker: l.speaker, kind: l.kind, file: l.file, event: l.event, key: l.key, line: n || null, text: l.text.replace(/\\n/g, '\n'), audio: `assets/voice/${l.id}.ogg` };
  }
  fs.writeFileSync(MAP, JSON.stringify(out, null, 1) + '\n');
}

function bgmRows() {
  if (!fs.existsSync(PROMPTS2)) return [];
  const P = JSON.parse(fs.readFileSync(PROMPTS2, 'utf8'));
  return P.tracks.map((t) => {
    const f = path.join(ROOT, 'assets', 'bgm', t.id + '.ogg'), j = path.join(ROOT, 'assets', 'bgm', t.id + '.json');
    const prev = path.join(ROOT, 'design', 'bgm', 'prev', t.id + '.ogg'), pj = path.join(ROOT, 'design', 'bgm', 'prev', t.id + '.json');
    const meta = fs.existsSync(j) ? JSON.parse(fs.readFileSync(j, 'utf8')) : null;
    const pmeta = fs.existsSync(pj) ? JSON.parse(fs.readFileSync(pj, 'utf8')) : null;
    return { t, has: fs.existsSync(f), meta, prev: fs.existsSync(prev), pmeta, dur: fs.existsSync(f) ? durOf(f) : null, pdur: fs.existsSync(prev) ? durOf(prev) : null };
  });
}

function writePage(lines, C) {
  let n = 0, bytes = 0, missing = 0;
  const row = (l) => {
    const f = vfile(l.id);
    let cell = '<i>missing</i>';
    if (f) {
      const sz = fs.statSync(f).size, d = durOf(f);
      n++; bytes += sz;
      cell = `<button class="play" data-src="../assets/voice/${esc(path.basename(f))}" aria-label="play ${esc(l.id)}">▶</button> <small>${d != null ? d.toFixed(2) + ' s' : ''}</small>`;
    } else missing++;
    return `<tr class="k-${esc(l.kind)}"><td>${cell}</td><td class="t">${esc(l.text.replace(/\\n/g, ''))}</td><td><code>${esc(l.id)}</code> <span class="tag">${esc(l.kind)}</span><br><small>${esc(l.event)} · ${esc(l.key)}</small><br><small class="dir">${esc(l.direction)}</small></td></tr>`;
  };
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  const cards = speakers.map((sp) => {
    const s = C.speakers[sp] || {};
    const mine = lines.filter((l) => l.speaker === sp);
    return `<section id="v-${sp}"><h3>${esc(NAMES[sp] || sp)} <small><code>${esc(s.voice)}</code>${s.pitch && s.pitch !== 1 ? ' ×' + s.pitch : ''}${s.fx ? ' · fx ' + esc(s.fx) : ''} · ${mine.length} 本</small> <button class="all">全部</button></h3>
<p class="prof">${esc(s.profile || '')}</p>
<table>${mine.map(row).join('\n')}</table></section>`;
  }).join('\n');
  const bg = bgmRows();
  const bcell = (src, meta, dur) => `<button class="play" data-src="${esc(src)}">▶</button> <button class="seam" data-src="${esc(src)}" data-ls="${meta ? meta.loopStart : 0}" data-le="${meta ? meta.loopEnd : 0}" data-oneshot="${meta && meta.loop === false ? 1 : 0}">${meta && meta.loop === false ? 'once' : 'loop seam'}</button><br><small>${dur != null ? dur.toFixed(1) + ' s' : ''}${meta && meta.loop !== false ? ` · loop ${(meta.loopEnd - meta.loopStart).toFixed(1)} s (${meta.loopStart.toFixed(1)}→${meta.loopEnd.toFixed(1)})` : ''}${meta && meta.analysis && meta.analysis.loudnessLUFS != null ? ' · ' + meta.analysis.loudnessLUFS + ' LUFS' : ''}${meta && meta.analysis && meta.analysis.seamListen ? ' · seam heard ' + meta.analysis.seamListen.seam_smooth + '/10' : ''}</small>`;
  const brows = bg.map((b) => `<tr><td><b>${esc(b.t.id)}</b> <span class="tag">${esc(b.t.status)}</span><br><small>${esc(b.t.scene)}</small><br><small>${esc(b.t.tempo)} BPM · ${esc(b.t.meter)} · ${esc(b.t.key_text || b.t.key)}</small></td>
<td>${b.has ? bcell('../assets/bgm/' + b.t.id + '.ogg', b.meta, b.dur) : '<i>not generated</i>'}</td>
<td>${b.prev ? bcell('bgm/prev/' + b.t.id + '.ogg', b.pmeta, b.pdur) : '<small>—</small>'}</td></tr>`).join('\n');
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slice Audio Preview</title>
<style>
:root{--bg:#f7f5f0;--fg:#23222a;--mute:#6a6770;--line:#dcd8cf;--acc:#9a5b16;--card:#fffdf8}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#15161c;--fg:#e8e6e1;--mute:#9b98a3;--line:#34343e;--acc:#e8b36a;--card:#1c1d25}}
:root[data-theme="dark"]{--bg:#15161c;--fg:#e8e6e1;--mute:#9b98a3;--line:#34343e;--acc:#e8b36a;--card:#1c1d25}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font:14px/1.55 system-ui,sans-serif;margin:0 auto;max-width:1040px;padding:16px}
h1{font-size:21px;margin:8px 0}h2{margin-top:34px;border-bottom:2px solid var(--line);font-size:18px}h3{margin:26px 0 2px;font-size:16px}
table{border-collapse:collapse;width:100%;background:var(--card)}td{border-top:1px solid var(--line);padding:6px 8px;vertical-align:top}
td:first-child{white-space:nowrap;width:8.5em}td.t{font-size:16px}
small,i,.prof{color:var(--mute)}.prof{margin:0 0 6px;font-size:13px}code{font-size:12px}a{color:var(--acc)}
.tag{font-size:11px;border:1px solid var(--line);border-radius:8px;padding:0 6px;color:var(--mute)}
tr.k-optional td.t{opacity:.8}tr.k-optional td.t::after{content:" （任意）";font-size:12px;color:var(--mute)}
button{font-size:13px;min-width:2.2em;cursor:pointer;margin:1px}button.on{background:var(--acc);color:var(--bg)}
.wrap{overflow-x:auto}
@media (max-width:640px){td:first-child{width:auto}td{display:block;border-top:none}tr{display:block;border-top:1px solid var(--line)}}
</style></head><body>
<h1>ルミナス・クロニクル v2 縦切り — 追加の音（BGM・物語ボイス・町のあいさつ）</h1>
<p>ボイス ${n} 本（${(bytes / 1048576).toFixed(2)} MB）${missing ? `、未生成 ${missing} 本` : ''}。台本 <code>design/voice/story_v2_lines.md</code>、つなぎ方 <code>v2/design/voice_story_map.json</code>、BGM の変更 <code>v2/design/bgm_changes.md</code>。
「loop seam」はループの終わり 4 秒前から鳴らし、ゲームと同じようにループ点で頭へ戻ります（継ぎ目の確認）。「前の版」は置き換える前のファイル（<code>design/bgm/prev/</code>）。</p>
<p><a href="#bgm">BGM</a> · ${speakers.map((sp) => `<a href="#v-${sp}">${esc(NAMES[sp] || sp)}</a>`).join(' · ')}</p>
<h2 id="bgm">BGM（新しい曲・作り直した曲）</h2>
<div class="wrap"><table><tr><td><b>id</b></td><td><b>今の版</b></td><td><b>前の版</b></td></tr>
${brows}
</table></div>
<h2>物語ボイス・あいさつ</h2>
${cards}
<script>
let ctx = null, src = null, au = new Audio(), queue = [];
const bufs = {};
function stopAll() { au.pause(); if (src) { try { src.stop(); } catch (e) {} src = null; } document.querySelectorAll('button.on').forEach((b) => b.classList.remove('on')); }
function play(url, btn) { stopAll(); au.src = url; au.play(); if (btn) btn.classList.add('on'); }
async function seam(btn) {
  stopAll();
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  const url = btn.dataset.src;
  if (!bufs[url]) bufs[url] = await fetch(url).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a));
  const b = bufs[url], ls = +btn.dataset.ls, le = +btn.dataset.le || b.duration;
  src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination);
  if (btn.dataset.oneshot === '1') src.start(); else { src.loop = true; src.loopStart = ls; src.loopEnd = le; src.start(0, Math.max(ls, le - 4)); }
  btn.classList.add('on');
}
au.addEventListener('ended', () => { document.querySelectorAll('button.play.on').forEach((b) => b.classList.remove('on')); if (queue.length) { const b = queue.shift(); setTimeout(() => play(b.dataset.src, b), 300); } });
document.addEventListener('click', (e) => {
  const s = e.target.closest('button.seam'); if (s) { queue = []; if (s.classList.contains('on')) stopAll(); else seam(s); return; }
  const p = e.target.closest('button.play'); if (p) { queue = []; if (p.classList.contains('on')) stopAll(); else play(p.dataset.src, p); return; }
  const a = e.target.closest('button.all'); if (a) { queue = [...a.closest('section').querySelectorAll('button.play')]; const b = queue.shift(); if (b) play(b.dataset.src, b); }
});
</script>
</body></html>
`;
  fs.writeFileSync(PAGE, html);
  return { n, bytes, missing, bgm: bg.length };
}

function main(argv) {
  const lines = loadLines(), C = loadCasting();
  const P = check(lines, C);
  for (const p of P) console.log('  ✗ ' + p);
  const by = {};
  for (const l of lines) by[l.kind] = (by[l.kind] || 0) + 1;
  console.log(`[story_voice] ${lines.length} lines (${Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ')}), ${P.length} problem(s)`);
  if (argv.includes('--check')) return P.length ? 1 : 0;
  writeMd(lines, C);
  writeMap(lines);
  const r = writePage(lines, C);
  console.log(`[story_voice] story_v2_lines.md, v2/design/voice_story_map.json, story_audio_preview.html: ${r.n} voice files (${(r.bytes / 1048576).toFixed(2)} MB), ${r.missing} missing, ${r.bgm} BGM rows`);
  return P.length ? 1 : 0;
}

module.exports = { CSV, loadLines, check, plain, estimate, lineOf };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
