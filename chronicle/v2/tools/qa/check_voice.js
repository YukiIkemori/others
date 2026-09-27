#!/usr/bin/env node
// QA: ボイスの検査（V2_PLAN §3.16 の 3「check_voice」、§3.10）。node だけ。
//
//   node v2/tools/qa/check_voice.js
//
// 縦切りのボイス 22 本（§3.10）について:
//  - v2/src/events の ev.say(…, {voice:'v_…'}) にちょうど 1 回ずつ出る（縦切りの外の v_ を使っていない）
//  - 文面（改行を除く）が chronicle/design/voice/script.csv と 1 字も違わない
//  - 音のファイル（chronicle/assets/voice/<id>.ogg）がある、ビルドの媒体の一覧（v2/dist/voice）にも写されている
//  - 戦闘中の主人公の声（b_hero_*）を鳴らさない（A20）
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

const V2 = path.resolve(__dirname, '..', '..');
const CHRON = path.resolve(V2, '..');
const SLICE = ['v_berna_prologue_01', 'v_berna_prologue_02', 'v_berna_prologue_03', 'v_berna_prologue_04', 'v_rowell_prologue_01', 'v_rowell_prologue_02',
  'v_fine_lighthouse_01', 'v_fine_lighthouse_02', 'v_berna_lute_01', 'v_berna_lute_02', 'v_berna_lute_03', 'v_berna_lute_04', 'v_berna_lute_05',
  'v_fine_forest_01', 'v_elm_forest_01', 'v_elm_forest_02', 'v_elm_forest_03', 'v_elm_forest_04', 'v_elm_forest_05', 'v_elm_forest_06', 'v_fine_t1_01', 'v_fine_t1_02'];

// script.csv（引用符つきの欄もある）
function parseCsv(txt) {
  const rows = [];
  for (const line of txt.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    rows.push(out);
  }
  return rows;
}

section('ボイス 22 本（§3.10）');
const rows = parseCsv(fs.readFileSync(path.join(CHRON, 'design', 'voice', 'script.csv'), 'utf8'));
const head = rows.shift();
const ti = head.indexOf('text'), ii = head.indexOf('id');
const script = {};
for (const r of rows) if (/^v_/.test(r[ii])) script[r[ii]] = r[ti];
ok('script.csv に 22 本すべてがある', SLICE.every((id) => script[id] != null), SLICE.filter((id) => script[id] == null));
ok('縦切りのボイスは 22 本', SLICE.length === 22);

// ev.say(who, 'text' | ['a','b'], {… voice: 'v_…' …}) を、文字列の連結と Object.assign も含めて拾う
const used = {};
for (const f of fs.readdirSync(path.join(V2, 'src', 'events'))) {
  const src = fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8');
  const re = /\.say\(\s*[^,]+,\s*('(?:[^'\\]|\\.)*'(?:\s*\+\s*'(?:[^'\\]|\\.)*')*)\s*,[^;]*?voice:\s*'(v_[a-z0-9_]+)'/g;
  for (const m of src.matchAll(re)) {
    const text = m[1].split(/'\s*\+\s*'/).join('').replace(/^'|'$/g, '').replace(/\\n/g, '').replace(/\\'/g, "'");
    (used[m[2]] = used[m[2]] || []).push({ file: f, text });
  }
  for (const m of src.matchAll(/voice:\s*'(v_[a-z0-9_]+)'/g)) if (!used[m[1]]) (used[m[1]] = []).push({ file: f, text: null });
}
for (const id of SLICE) {
  const u = used[id] || [];
  ok(`${id}: イベントで 1 回`, u.length === 1, u.map((x) => x.file));
  if (u[0] && u[0].text != null) ok(`${id}: 文面が script.csv と同じ`, u[0].text === script[id], [u[0].text, script[id]]);
  else if (u[0]) ok(`${id}: 文面が読める形で書かれている（ev.say の 2 つ目の文字列）`, false, u[0].file);
  const file = ['ogg', 'mp3', 'm4a'].map((e) => path.join(CHRON, 'assets', 'voice', id + '.' + e)).find((p) => fs.existsSync(p));
  ok(`${id}: 音のファイルがある`, !!file);
}
const extra = Object.keys(used).filter((id) => !SLICE.includes(id));
ok('縦切りの外のボイスを使っていない', extra.length === 0, extra);
const dist = path.join(V2, 'dist', 'voice');
if (fs.existsSync(dist)) {
  const have = new Set(fs.readdirSync(dist).map((f) => f.replace(/\.\w+$/, '')));
  ok('ビルドの dist/voice に 22 本が写されている', SLICE.every((id) => have.has(id)), SLICE.filter((id) => !have.has(id)));
}
section('戦闘の主人公の声（A20）');
{
  const bs = fs.readdirSync(path.join(V2, 'src', 'systems', 'battle')).map((f) => fs.readFileSync(path.join(V2, 'src', 'systems', 'battle', f), 'utf8')).join('\n');
  ok('戦闘の場面が主人公（hero）の声を鳴らさない', /hero/.test(bs) ? !/b_hero_|voice[^\n]*['"]hero['"]/.test(bs) : true);
}
done('check_voice');
