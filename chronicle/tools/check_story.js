#!/usr/bin/env node
// check_story.js (owner story A19) — conformance of the story's data and scripts with DESIGN.md (the tables are
// read from the spec itself, so a later edit of the spec shows up here). exit 1 on any mismatch.
//   C1 objectives obj_s_* = §10.13.8 (id and text)
//   C2 うわさ: the folk_a mood lines and the folk_b region lines = §10.9.3 (word for word)
//   C3 the girl before each boss: the eight region lines and the three closings = §10.9.4
//   C4 the event ids of §10.13.9 (story row) exist; the map ids of §10.13.2 (story row) exist
//   C5 every story / endgame flag of §10.13.7 is set somewhere in the story's sources
//   C6 the troops of the endgame (§10.13.5) are the ones the archive's events fight
//   C7 the scenes' completed lines of §10.9.2 / §10.10 / §10.11 appear in the sources (a sample of key lines)
//
//   node tools/check_story.js [--verbose]
'use strict';
const fs = require('fs');
const path = require('path');
const load = require('./lib/load');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const R = load({ quiet: true });
const DB = R.DB;
const SPEC = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const SRC = ['src/events/final_00_scene.js', 'src/events/final_roa.js', 'src/events/final_biblia.js', 'src/events/final_archive.js',
  'src/events/story.js', 'src/events/story_rumors.js', 'src/events/story_objectives.js', 'src/systems/ending.js',
  'src/maps/final_biblia.js', 'src/maps/final_archive_a.js', 'src/maps/final_archive_b.js']
  .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('FAIL', msg); } };
/** the spec's 「」 text → the data form (\n as in the tables) */
const unq = (s) => s.replace(/^「|」$/g, '').replace(/\\n/g, '\n');
const section = (s) => { if (VERBOSE) console.log('--', s); };

// ------------------------------------------------------------ C1
section('C1 objectives');
for (const m of SPEC.matchAll(/^\| `(obj_s_\w+)` \| ([^|]+) \| story \|$/gm)) {
  const id = m[1], text = m[2].trim().replace(/\\n/g, '\n');
  ok(DB.objectives[id] && DB.objectives[id].text === text, `C1 ${id}: ${JSON.stringify(DB.objectives[id] && DB.objectives[id].text)} ≠ ${JSON.stringify(text)}`);
}
ok(Object.keys(DB.objectives).filter((k) => k.startsWith('obj_s_')).length === 6, 'C1 six obj_s_*');

// ------------------------------------------------------------ C2
section('C2 rumours');
const SR = DB.events.story_rumor;
const MOODKEY = { 'postgame:true': 'post', final_open: 'fog', '{tier:7}': 't7', '{tier:6}': 't6', '{tier:4}': 't4', '{tier:3}': 't3', '{tier:1}': 't1', '（既定）': 't0' };
let nMood = 0;
for (const m of SPEC.matchAll(/^\| (`postgame:true`|`final_open`|`\{tier:\d\}`|（既定）) \| (「[^|]+」) \|$/gm)) {
  const key = MOODKEY[m[1].replace(/`/g, '')];
  if (!key) continue;
  nMood++;
  ok(SR.MOOD[key] === unq(m[2]), `C2 folk_a ${key}: ${JSON.stringify(SR.MOOD[key])} ≠ ${JSON.stringify(unq(m[2]))}`);
}
ok(nMood === 8, 'C2 eight mood rows read from the spec (' + nMood + ')');
let nHint = 0;
for (const m of SPEC.matchAll(/^\| `(r_\w+)` \| (「[^|]+」) \|$/gm)) {
  nHint++;
  ok(SR.HINT[m[1]] === unq(m[2]), `C2 folk_b ${m[1]}`);
}
ok(nHint === 8, 'C2 eight region rumours read from the spec (' + nHint + ')');
// the rumour of every town exists, and its NPC in the town's map (when the map is there)
for (const t of Object.keys(SR.TOWNS).concat(['biblia'])) {
  for (const k of ['a', 'b']) {
    if (k === 'b' && (t === 'nerei' || t === 'biblia')) continue;
    const id = t + '_' + k;
    ok(!!DB.rumors[id], 'C2 rumor ' + id);
    const map = DB.maps[t];
    if (map) ok((map.npcs || []).some((n) => n.rumor === id && n.event === 'story_rumor'), `C2 map ${t} has folk_${k} (rumor ${id})`);
  }
}

// ------------------------------------------------------------ C3
section('C3 story_fine');
const S = R.Story;
for (const m of SPEC.matchAll(/^\| (forest|desert|snow|marsh|isles|mine|ash|star) \| (「[^|]+」) \|$/gm)) ok(S.FINE[m[1]] === unq(m[2]), 'C3 fine ' + m[1]);
const closeRows = [...SPEC.matchAll(/^\| (0〜2|3〜5|6〜7) \| (「[^|]+」) \|/gm)];
ok(closeRows.length === 3, 'C3 three closings in the spec');
for (const m of closeRows) { const k = { '0〜2': 0, '3〜5': 3, '6〜7': 6 }[m[1]]; ok(S.FINE_CLOSE[k].line === unq(m[2]), 'C3 closing ' + m[1]); }
for (const rs of Object.keys(S.FINE)) ok(!!DB.events['story_fine_' + rs], 'C3 event story_fine_' + rs);

// ------------------------------------------------------------ C4
section('C4 ids');
const evRow = SPEC.match(/^\| story \| (`story_after_clear`.*)\|$/m);
ok(!!evRow, 'C4 the story row of §10.13.9');
if (evRow) {
  for (const m of evRow[1].matchAll(/`([a-z0-9_<>]+)`/g)) {
    const id = m[1];
    if (id.includes('<rs>')) { for (const rs of Object.keys(S.FINE)) ok(!!DB.events[id.replace('<rs>', rs)], 'C4 event ' + id.replace('<rs>', rs)); continue; }
    ok(!!DB.events[id], 'C4 event ' + id);
  }
}
const mapRow = SPEC.match(/^\| story（A19） \| (`biblia`.*)\|$/m);
ok(!!mapRow, 'C4 the story row of §10.13.2');
for (const id of ['biblia', 'archive_1', 'archive_2', 'archive_3', 'archive_4', 'archive_5', 'archive_6']) ok(!!DB.maps[id], 'C4 map ' + id);

// ------------------------------------------------------------ C5
section('C5 flags');
const fl = (row) => { const m = SPEC.match(new RegExp('^\\| ' + row + ' \\| (.*) \\|$', 'm')); return m ? [...m[1].matchAll(/`(\w+)`/g)].map((x) => x[1]) : []; };
const story = fl('物語'), temp = fl('一時（場面の NPC を出すだけ。場面の最後に必ず下ろす）');
if (story.includes('st_t1') && story.includes('st_t8')) for (let k = 2; k <= 7; k++) story.push('st_t' + k); // `st_t1`〜`st_t8`
const finRow = SPEC.match(/^\| 終盤 \| (`final_roa`.*) \|$/m);
const fin = finRow ? [...finRow[1].matchAll(/`(\w+)`/g)].map((x) => x[1]) : [];
ok(story.length === 15 && temp.length === 3 && fin.length === 8, `C5 flag rows read (${story.length}/${temp.length}/${fin.length})`);
for (const f of story.concat(fin)) ok(new RegExp("setFlag\\('" + f + "'|once: '" + f + "'").test(SRC) || (f.startsWith('st_t') && /setFlag\('st_t' \+ k\)/.test(SRC)), 'C5 flag set: ' + f);
for (const f of temp) ok(SRC.includes("'" + f + "'"), 'C5 scene flag used: ' + f);

// ------------------------------------------------------------ C6
section('C6 troops');
for (const [ev, troop] of [['archive_2_boss', 'tr_b_bookgolem'], ['archive_4_boss', 'tr_b_heroshades'], ['archive_5_lazaro', 'tr_b_lazaro'], ['archive_6_boss', 'tr_b_nemrea1'], ['archive_6_boss', 'tr_b_nemrea2'], ['story_after_clear', 'tr_b_rowell1'], ['story_after_clear', 'tr_b_rowell2']]) {
  ok(!!DB.troops[troop], 'C6 troop ' + troop);
  ok(SRC.includes("'" + troop + "'"), `C6 ${ev} fights ${troop}`);
}

// ------------------------------------------------------------ C7
section('C7 lines');
const KEY = [
  'また会ったな、語り部。', '一つ目……。\\nあと、七つね。', 'わたしはフィーネ。', '院長は本気だ。', 'なぜ分からない！', 'あなたの師匠は、もう……。',
  '自分の母の顔を', '始まりの\\n年代記を書いた語り部。', 'ロアの里へ。すべてが\\n始まった場所へ、帰りましょう。',
  'あなたの弟子の物語を、', '内海の白い霧を払っていく……。', '二十年前の戦争で……。', 'おれの手帳の言葉で開く。',
  '行け、語り部！', '名は忘れられても、物語は\\n残っていたのね。', '娘のミラを失いました。', 'おまえの悲しみは、じつに\\n美味であった。',
  '――ネムレア。', '名を……呼んだな……！', 'わたしの最後の光を、\\nあなたたちに。', 'はじめてだ……。', 'わたしも、物語に還る時間。',
  '……ミラ。\\nああ、ミラ……。', 'これは、ある語り部の物語。', '『語り部の旅』が記された。', 'それは、また別のお話。', '――おしまい',
];
for (const k of KEY) ok(SRC.includes(k), 'C7 line: ' + k);

console.log(`check_story: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
