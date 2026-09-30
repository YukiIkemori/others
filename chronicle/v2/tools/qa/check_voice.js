#!/usr/bin/env node
// QA: ボイスの検査（V2_PLAN §3.16 の 3「check_voice」、§3.10）。node だけ。
//
//   node v2/tools/qa/check_voice.js
//
// 縦切りのボイス 22 本（§3.10）と、物語・あいさつのボイス（design/voice_story_map.json の story・bark。灯台の守り歌 v_fine_song_01・02 を含む）について:
//  - v2/src/events の ev.say(…, {voice:'v_…'}) にちょうど 1 回ずつ出る（縦切りの外の v_ を使っていない）
//  - 文面（改行を除く）が chronicle/design/voice/script.csv と 1 字も違わない
//  - 音のファイル（chronicle/assets/voice/<id>.ogg）がある、ビルドの媒体の一覧（v2/dist/voice）にも写されている
//  - 戦闘中の主人公の声（b_hero_*）を鳴らさない（A20）
'use strict';
const fs = require('fs');
const { inline: i18nInline } = require('../lib/i18n_src');   // R.T('key') を日本語の文に戻して文面を確かめる（i18n）
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
  const src = i18nInline(fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8'));
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
// 2026-09-28: 地方のボイス（再開）。script.csv の録音済みの行（ハザル・巨人・ネーヴェ・メルダ・霧食らい・雪原と湿原のフィーネ）を
// 砂漠・雪原・湿原のイベントでそのまま使う。縦切りの 22 本と同じく、1 回ずつ・文面が script.csv と同じ・音のファイルがある
const REGION = ['v_hazal_tomb_01', 'v_hazal_tomb_02', 'v_hazal_tomb_03', 'v_hazal_tomb_04', 'v_giant_peak_01', 'v_neve_peak_01', 'v_neve_peak_02', 'v_neve_peak_03',
  'v_fine_snow_01', 'v_melda_manor_01', 'v_melda_manor_02', 'v_melda_manor_03', 'v_melda_manor_04', 'v_melda_manor_05', 'v_mistwitch_marsh_01', 'v_melda_marsh_01', 'v_fine_marsh_01'];
section('地方のボイス（script.csv の録音済みの行）');
REGION.push('v_fine_ash_01'); // 2026-09-28: 灰の荒野の火口のフィーネ（script.csv の録音済みの行のまま）
REGION.push('v_marina_nerei_01', 'v_marina_pier_01', 'v_marina_dawn_01', 'v_marina_dawn_02', 'v_glen_ship_01', 'v_glen_ship_02', 'v_glen_ship_03', 'v_glen_ship_04', 'v_glen_dawn_01', 'v_fine_isles_01'); // 2026-09-30: マレア諸島（isles_*.js）
for (const id of REGION) {
  const u = used[id] || [];
  ok(`${id}: イベントで 1 回`, u.length === 1, u.map((x) => x.file));
  if (u[0] && u[0].text != null) ok(`${id}: 文面が script.csv と同じ`, u[0].text === script[id], [u[0].text, script[id]]);
  else if (u[0]) ok(`${id}: 文面が読める形で書かれている（ev.say の 2 つ目の文字列）`, false, u[0].file);
  ok(`${id}: 音のファイルがある`, fs.existsSync(path.join(CHRON, 'assets', 'voice', id + '.ogg')));
}
// 2026-09-27: 町の人と物語のボイス（design/voice_story_map.json。文面は node chronicle/tools/story_voice.js --check が見る）
section('物語のボイスとあいさつ（voice_story_map.json）');
const SMAP = JSON.parse(fs.readFileSync(path.join(V2, 'design', 'voice_story_map.json'), 'utf8')).lines;
const STORY = Object.keys(SMAP).filter((id) => SMAP[id].kind === 'story');
const OPTIONAL = Object.keys(SMAP).filter((id) => SMAP[id].kind === 'optional');
const BARK = Object.keys(SMAP).filter((id) => SMAP[id].kind === 'bark');
const srcOf = (f) => i18nInline(fs.readFileSync(path.join(CHRON, f), 'utf8'));
for (const id of STORY) {
  const L = SMAP[id], src = srcOf(L.file);
  ok(`${id}: ${path.basename(L.file)} で鳴らす`, src.includes(`'${id}'`));
  ok(`${id}: 文面が ${path.basename(L.file)} にそのまま残っている`, src.includes(JSON.stringify(L.text).slice(1, -1).replace(/\\"/g, '"')));
  ok(`${id}: 音のファイルがある`, fs.existsSync(path.join(CHRON, 'assets', 'voice', id + '.ogg')));
}
const mapsSrc = fs.readdirSync(path.join(V2, 'src', 'maps')).map((f) => i18nInline(fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8'))).join('\n');
for (const id of BARK) {
  ok(`${id}: マップの NPC の bark`, (mapsSrc.match(new RegExp(`bark: '${id}'`, 'g')) || []).length === 1);
  ok(`${id}: 音のファイルがある`, fs.existsSync(path.join(CHRON, 'assets', 'voice', id + '.ogg')));
}
ok('まだ決まっていない optional のボイス（冒頭のキャプション）は鳴らさない', OPTIONAL.every((id) => !used[id]), OPTIONAL.filter((id) => used[id]));
const extra = Object.keys(used).filter((id) => !SLICE.includes(id) && !REGION.includes(id) && !STORY.includes(id));
ok('縦切りの外のボイスを使っていない', extra.length === 0, extra);
const dist = path.join(V2, 'dist', 'voice');
if (fs.existsSync(dist)) {
  const have = new Set(fs.readdirSync(dist).map((f) => f.replace(/\.\w+$/, '')));
  ok('ビルドの dist/voice に 22 本が写されている', SLICE.every((id) => have.has(id)), SLICE.filter((id) => !have.has(id)));
}
// 2026-09-27: 灯台の守り歌（オーナー「メインだから、つけてよ」）。フィーネの声で、冒頭の幕の上と、ページ食らいの後の紙切れ。年代記の序章で聞き直せる
section('灯台の守り歌（v_fine_song_01・02）');
{
  const SONG = '♪　海の果てまで、灯よ届け\n帰る舟に、道を照らせ';
  const lit = JSON.stringify(SONG).slice(1, -1);
  const where = { v_fine_song_01: ['prologue_roa.js', 'roa_house_intro'], v_fine_song_02: ['prologue_lighthouse.js', 'lighthouse_3_boss'] };
  for (const [id, [file, event]] of Object.entries(where)) {
    const L = SMAP[id];
    ok(`${id}: voice_story_map.json に story として載っている`, !!L && L.kind === 'story' && L.speaker === 'fine' && L.event === event && L.text === SONG, L);
    const src = i18nInline(fs.readFileSync(path.join(V2, 'src', 'events', file), 'utf8'));
    ok(`${id}: ${file} の守り歌のキャプションに声がつく`, src.includes(`ev.caption('${lit}', { ms: 4200, voice: '${id}' })`));
    const ogg = path.join(CHRON, 'assets', 'voice', id + '.ogg');
    ok(`${id}: Ogg のファイルがある`, fs.existsSync(ogg) && fs.readFileSync(ogg).subarray(0, 4).toString() === 'OggS');
    if (fs.existsSync(dist)) ok(`${id}: ビルドの dist/voice に写されている`, fs.existsSync(path.join(dist, id + '.ogg')));
  }
  const lead = i18nInline(fs.readFileSync(path.join(V2, 'src', 'events', 'leads_main.js'), 'utf8'));
  ok('読み物 lo_lighthouse_song に声（年代記で聞き直す）', /lo_lighthouse_song:[^\n]*voice: 'v_fine_song_02'/.test(lead));
  const msg = fs.readFileSync(path.join(V2, 'src', 'uik', 'message.js'), 'utf8');
  ok('UIK のキャプションが voice を鳴らし、声の終わりまで待つ', /const voiceId = o && o\.voice;/.test(msg) && /R\.Audio\.voice\(voiceId\)/.test(msg) && /st\.voiceDone \|\|/.test(msg));
  const chr = fs.readFileSync(path.join(V2, 'src', 'screens', 'chronicle.js'), 'utf8');
  ok('年代記の章で書き写した歌を聞き直せる（A）', /songsOf\(/.test(chr) && /playSong\(/.test(chr));
}
// 2026-09-27: 冒頭（オーナー「最初の一言にも声を」）。幕の上のフィーネ 3 本と守り歌、ベルナの「……うん、いい名前だ。」、P2[7]。幕の前に先読みする
section('冒頭のボイス（roa_house_intro・roa_berna）');
{
  const src = i18nInline(fs.readFileSync(path.join(V2, 'src', 'events', 'prologue_roa.js'), 'utf8'));
  const caps = [['v_fine_opening_01', '……ねえ、聞こえる？'], ['v_fine_opening_02', 'これは、忘れられかけた物語。'], ['v_fine_opening_03', 'そして、それを語り直した、\\nひとりの語り部の物語。']];
  for (const [id, t] of caps) ok(`${id}: 幕のキャプション「${t.replace(/\\n/g, '')}」に声`, new RegExp(`ev\\.caption\\('${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}', \\{ ms: \\d+, voice: '${id}' \\}\\)`).test(src));
  ok('v_berna_intro_01: 名前の後の「……うん、いい名前だ。」に声', /'\{hero\}。……うん、いい名前だ。', \{ voice: 'v_berna_intro_01'/.test(src));
  ok('v_berna_p2_10: P2[7]（名前の入る行）に声', /P2_VOICE = \[[^\]]*'v_berna_p2_07', 'v_berna_p2_10', 'v_berna_p2_08'/.test(src));
  const m = /const INTRO_VOICES = \[([^\]]*)\]/.exec(src), pre = m ? [...m[1].matchAll(/'(v_[a-z0-9_]+)'/g)].map((x) => x[1]) : [];
  const intro = [...src.slice(src.indexOf('D.roa_house_intro'), src.indexOf('D.roa_berna')).matchAll(/voice: '(v_[a-z0-9_]+)'/g)].map((x) => x[1]);
  ok('冒頭のボイスをすべて先読みする（INTRO_VOICES・R.Audio.preloadVoice）', intro.length >= 9 && intro.every((id) => pre.includes(id)) && /R\.Audio\.preloadVoice\(INTRO_VOICES\)/.test(src), intro.filter((id) => !pre.includes(id)));
  for (const id of intro) ok(`${id}: 音のファイルがある`, fs.existsSync(path.join(CHRON, 'assets', 'voice', id + '.ogg')));
  const au = fs.readFileSync(path.join(V2, 'src', 'core', 'audio.js'), 'utf8');
  ok('R.Audio.preloadVoice がある', /preloadVoice\(ids\) \{/.test(au));
}
section('戦闘の主人公の声（A20）');
{
  const bs = fs.readdirSync(path.join(V2, 'src', 'systems', 'battle')).map((f) => fs.readFileSync(path.join(V2, 'src', 'systems', 'battle', f), 'utf8')).join('\n');
  ok('戦闘の場面が主人公（hero）の声を鳴らさない', /hero/.test(bs) ? !/b_hero_|voice[^\n]*['"]hero['"]/.test(bs) : true);
}
done('check_voice');
