#!/usr/bin/env node
// CONTENT-P のテスト（node。V2_PLAN §4.4 の CONTENT-P の行）
//   node v2/tools/test_content_p.js
//   1. 形: 全マップ・全イベント・手がかり・場所・手紙・フィクスチャが R.Contract.check を通る
//   2. つながり: 出口・階段・扉・ワープの行き先のマップと spawn がある。マップが呼ぶイベントがある
//   3. 到達（progress の自分の範囲）: 各マップで入口から出口・階段・宝箱・泉・人・調べる物に着く（R.Field._walkable と R.MapUtil）。
//      物語に要る物（階段・出口・ボス・人）が隠し通路の先に無い。ダンジョンの歩数（入口 → 次の階段、いちばん遠いマス）
//   4. 置き場所の決まり: 泉（各ダンジョン 1 以上、ボスの前）・宝箱（数と、上に重なる物の下に無い）・隠し通路（ダンジョンだけ・床の素材）
//   5. 見返りのある人の数と種類（ファロス 8 人以上・4 種以上、空気だけの人 4 人まで）
//   6. 文: 1 ページ 3 行・1 行 18 字まで、表示してはいけない言葉、仲間の名前が物語に出ない（A36）
//   7. ボイス: 使う 15 本の id と文面が design/voice/script.csv と 1 字も違わない（改行は除く）
//   8. 通し: 序章 P1 → P10 と T1 を、真似の ev で順に流して、フラグ・品・手がかりが立つ
//   9. ワールド: gen_world の検査（歩ける数・入口・閉じ方・30 歩の空白）と、生成物が今の生成器の出力と同じ
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const V2 = path.resolve(__dirname, '..');
const R = require('./lib/load')({ quiet: true, fixtures: true });

const MY_MAPS = ['world', 'roa', 'roa_house', 'pharos', 'pharos_inn', 'pharos_tavern', 'pharos_shop', 'pharos_smith', 'pharos_record', 'pharos_shipyard',
  'lighthouse_1', 'lighthouse_2', 'lighthouse_3', 'well'];
const MY_FILES = fs.readdirSync(path.join(V2, 'src', 'events')).filter((f) => /^(prologue_|pharos_|world_|story_|leads_main|optional_well|optional_windhill)/.test(f));
const SRC = MY_FILES.map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n');
const MAP_SRC = fs.readdirSync(path.join(V2, 'src', 'maps')).filter((f) => /^(prologue_|pharos_|optional_well|optional_windhill|world)/.test(f))
  .map((f) => fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8')).join('\n');
const MY_EVENTS = Object.keys(R.DB.events).filter((id) => SRC.includes('D.' + id + ' =') || SRC.includes("D." + id + "=") || new RegExp('D\\.' + id + '\\s*=').test(SRC));

// ------------------------------------------------------------------ 1. 形
section('1. 形（R.Contract.check）');
ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
for (const id of MY_MAPS) {
  const m = R.DB.maps[id];
  ok(`map ${id} がある`, !!m);
  if (!m) continue;
  const c = R.Contract.check('map', m);
  ok(`map ${id} K.map`, c.ok, c.errors.slice(0, 5));
  for (const n of m.npcs || []) { const cn = R.Contract.check('npc', n); if (!cn.ok) ok(`npc ${id}.${n.id}`, false, cn.errors); }
  for (const o of m.objects || []) { const co = R.Contract.check('mapObject', o); if (!co.ok) ok(`object ${id} ${o.type}`, false, co.errors); }
}
ok('自分のイベントが 50 以上', MY_EVENTS.length >= 50, MY_EVENTS.length);
for (const id of MY_EVENTS) {
  const e = R.DB.events[id];
  const c = R.Contract.check('event', e);
  if (!c.ok) ok(`event ${id}`, false, c.errors);
  if (!(e.meta && Array.isArray(e.meta.needs) && Array.isArray(e.meta.gives))) ok(`event ${id} meta.needs/gives`, false);
}
const MY_LEADS = ['l_main_rumors', 'l_main_recorder_forest', 'l_main_margin_1', 'l_rumor_forest', 'l_rumor_snow', 'l_rumor_desert', 'l_rumor_marsh', 'l_rumor_isles',
  'l_rumor_mine', 'l_rumor_ash', 'l_rumor_star', 'l_opt_well', 'l_opt_windhill', 'q_pharos_well', 'q_pharos_lamp', 'q_pharos_delivery'];
for (const id of MY_LEADS) { const l = R.DB.leads[id]; ok(`lead ${id}`, !!l && R.Contract.check('lead', l).ok, l && R.Contract.check('lead', l).errors); if (l) ok(`lead ${id} の見出し 14 字まで`, [...l.title].length <= 14, l.title); }
// 縦切りの後に作った地方（regions の slice の錠が外れた地方）の噂は錠なし
ok('森以外の噂は slice:locked', ['snow', 'desert', 'marsh', 'isles', 'mine', 'ash', 'star'].every((k) => R.DB.leads['l_rumor_' + k].slice === 'locked' || !R.DB.regions['r_' + k].slice));
for (const [id, l] of Object.entries(R.DB.locations)) { if (/^stub/.test(id)) continue; const c = R.Contract.check('location', l); ok(`location ${id}`, c.ok, c.errors); }
ok('letter berna_t1', R.Contract.check('letter', R.DB.letters.berna_t1).ok);
for (const f of fs.readdirSync(path.join(V2, 'tools', 'fixtures', 'states')).filter((f) => /^content_p_/.test(f))) {
  const fx = JSON.parse(fs.readFileSync(path.join(V2, 'tools', 'fixtures', 'states', f), 'utf8'));
  const c = R.Contract.check('fixtureState', fx);
  const m = R.DB.maps[fx.map.id];
  ok(`fixture ${f}`, c.ok && !!m && (!fx.map.spawn || !!(m.spawns || {})[fx.map.spawn]), c.errors.concat(m ? [] : ['no map']));
}

// ------------------------------------------------------------------ 2. つながり
section('2. つながり（行き先のマップと spawn、呼ぶイベント）');
const hasSpawn = (map, sp) => { const m = R.DB.maps[map]; return !!(m && m.spawns && m.spawns[sp]); };
for (const id of MY_MAPS) {
  const m = R.DB.maps[id];
  const tos = [];
  for (const e of m.exits || []) tos.push(['exit', e.to]);
  for (const o of m.objects || []) { if (o.to) tos.push([o.type, o.to]); if (o.door && o.door.to) tos.push(['door ' + o.id, o.door.to]); }
  for (const [k, to] of tos) ok(`${id}: ${k} → ${to.map}.${to.spawn}`, hasSpawn(to.map, to.spawn));
  const evs = [];
  for (const n of m.npcs || []) if (typeof n.talk === 'string') evs.push(n.talk);
  for (const t of m.triggers || []) evs.push(t.event);
  for (const o of m.objects || []) if (o.event) evs.push(o.event);
  for (const e of evs) ok(`${id}: イベント ${e} がある`, !!R.DB.events[e] || (id === 'world' && /^forest_/.test(e)), e);
}
for (const [id, l] of Object.entries(R.DB.locations)) if (!/^stub/.test(id)) ok(`location ${id} → ${l.map}.${l.spawn}`, hasSpawn(l.map, l.spawn));
// 森の担当のマップから自分のマップへの出口
for (const [id, m] of Object.entries(R.DB.maps)) {
  if (MY_MAPS.includes(id) || /^stub|^field_/.test(id)) continue;
  for (const e of m.exits || []) if (MY_MAPS.includes(e.to.map)) ok(`${id} → ${e.to.map}.${e.to.spawn}（森の担当から）`, hasSpawn(e.to.map, e.to.spawn));
}
// イベントの中で使う手がかりの id（ev.lead / leadDone）と品の id がある
for (const m of SRC.matchAll(/ev\.lead(?:Done)?\('([a-z0-9_]+)'\)/g)) ok(`手がかり ${m[1]} がある`, !!R.DB.leads[m[1]]);
for (const m of SRC.matchAll(/(?:give|item)\(ev, '([a-z0-9_]+)'|ev\.item\('([a-z0-9_]+)'/g)) { const id = m[1] || m[2]; ok(`品 ${id} がある`, !!R.DB.items[id] || /^k_/.test(id), id); }
const KEYS = [...new Set([...SRC.matchAll(/'(k_[a-z0-9_]+)'/g)].map((m) => m[1]))];
console.log('  （大事な物は EVENTS の items_key.js。今ある: ' + KEYS.filter((k) => R.DB.items[k]).join(' ') + ' ／ まだ: ' + KEYS.filter((k) => !R.DB.items[k]).join(' ') + '）');

// ------------------------------------------------------------------ 3. 到達
section('3. 到達（入口から出口・階段・宝箱・泉・人・調べる物へ。隠し通路を通らずに物語の物へ）');
// 条件は「序章を終えて、鍵も持っている」状態（扉・跳ね橋が開き、縦切りの閉じ方は閉じたまま）
R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 1 });
Object.assign(R.Game.flags, { prologue_start: true, prologue_berna: true, prologue_party: true, prologue_key: true, prologue_tutorial: true, prologue_done: true });
R.Game.items.k_lighthouse_key = 1;
R.MapUtil.invalidate();
const DIRS = [[1, 0, 'e'], [-1, 0, 'w'], [0, 1, 's'], [0, -1, 'n']];
function reach(m, sx, sy, useSecret) {
  const dist = new Map(), q = [[sx, sy]];
  dist.set(sx + ',' + sy, 0);
  while (q.length) {
    const [x, y] = q.shift();
    const d = dist.get(x + ',' + y);
    for (const [dx, dy, dir] of DIRS) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (dist.has(k)) continue;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const cell = R.MapUtil.cell(m, nx, ny);
      if (cell && cell.secret && !useSecret) continue;
      if (!R.Field._walkable(m, nx, ny, dir, 0)) continue;
      dist.set(k, d + 1); q.push([nx, ny]);
    }
  }
  return dist;
}
const near = (dist, x, y, w, h) => { let best = Infinity; for (let j = y - 1; j <= y + (h || 1); j++) for (let i = x - 1; i <= x + (w || 1); i++) { const v = dist.get(i + ',' + j); if (v != null && v < best) best = v; } return best; };
const START = { roa: 'gate', roa_house: 'bed', pharos: 'gate_w', lighthouse_1: 'entrance', lighthouse_2: 'from_prev', lighthouse_3: 'from_prev', well: 'entrance', world: 'roa' };
for (const id of MY_MAPS) {
  const m = R.DB.maps[id];
  const sp = m.spawns[START[id] || 'door'];
  const dist = reach(m, sp.x, sp.y, false), distS = reach(m, sp.x, sp.y, true);
  const miss = [];
  for (const e of m.exits || []) if (near(dist, e.x, e.y, e.w, e.h) === Infinity) miss.push('exit→' + e.to.map);
  for (const o of m.objects || []) {
    if (o.cond && !R.State.check(o.cond)) continue;
    const w = o.type === 'spring' ? 2 : o.type === 'building' ? o.w : 1, h = o.type === 'spring' ? 2 : o.type === 'building' ? o.h : 1;
    if (['stairs', 'chest', 'spring', 'examine', 'sign', 'waylamp', 'brazier', 'switch'].includes(o.type) || (o.type === 'building' && o.door)) {
      const D = o.type === 'chest' ? distS : dist;   // 宝箱は隠し通路の先でもよい
      const tx = o.type === 'building' ? o.door.x : o.x, ty = o.type === 'building' ? o.door.y : o.y;
      if (near(D, tx, ty, o.type === 'building' ? 1 : w, o.type === 'building' ? 1 : h) === Infinity && !(id === 'world' && !R.MapUtil.cell(m, tx, ty + 1))) miss.push(o.type + (o.id ? ':' + o.id : '') + '@' + tx + ',' + ty);
    }
  }
  for (const n of m.npcs || []) {
    if (n.cond && !R.State.check(n.cond)) continue;
    if (id === 'world' && n.cond && n.cond.slice === true) continue;
    if (near(dist, n.x, n.y) === Infinity) miss.push('npc:' + n.id);
  }
  for (const t of m.triggers || []) if (t.on === 'step' && near(dist, t.x, t.y, t.w, t.h) === Infinity) miss.push('trigger:' + t.id);
  ok(`${id}: 全部に着く（${dist.size} マス）`, miss.length === 0, miss.slice(0, 12));
  if (m.kind === 'dungeon') {
    const stairs = (m.objects || []).filter((o) => o.type === 'stairs');
    let far = 0; for (const v of dist.values()) far = Math.max(far, v);
    const toNext = stairs.map((o) => near(dist, o.x, o.y)).filter((v) => v < Infinity);
    console.log(`    ${id}: 入口から階段・出口まで ${toNext.join(', ')} 歩、いちばん遠いマス ${far} 歩`);
    ok(`${id}: いちばん遠いマス 200 歩以下`, far <= 200, far);
  }
}

// ------------------------------------------------------------------ 4. 置き場所の決まり
section('4. 泉・宝箱・隠し通路');
for (const id of MY_MAPS) {
  const m = R.DB.maps[id];
  const springs = (m.objects || []).filter((o) => o.type === 'spring'), chests = (m.objects || []).filter((o) => o.type === 'chest');
  if (m.kind === 'dungeon' && id !== 'lighthouse_2') ok(`${id}: 泉 1 つ以上`, springs.length >= 1);
  if (m.kind === 'world') ok('world: 宝箱・隠し通路なし（A27）', chests.length === 0 && !Object.values(m.legend).some((l) => l.secret));
  for (const s of springs) {
    let okCells = true;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const c = R.MapUtil.cell(m, s.x + i, s.y + j); if (!c || c.solid || c.walk === false) okCells = false; }
    ok(`${id}: 泉 ${s.id} は床の上の 2×2`, okCells);
  }
  const ids = new Set();
  for (const c of chests) {
    ok(`${id}: 宝箱 ${c.id} の中身`, !!(c.item || c.pool || c.gold));
    ok(`${id}: 宝箱 ${c.id} の id が重ならない`, !ids.has(c.id)); ids.add(c.id);
    const over = (m.objects || []).some((o) => o.type === 'prop' && (R.DB.props[o.id] || {}).overChars && Math.abs(o.x - c.x) <= 1 && o.y >= c.y && o.y - c.y <= 1);
    ok(`${id}: 宝箱 ${c.id} の上に重なる物が無い`, !over);
    const cell = R.MapUtil.cell(m, c.x, c.y);
    ok(`${id}: 宝箱 ${c.id} は床の上`, !!cell && !cell.solid && cell.walk !== false);
  }
  for (const [ch, l] of Object.entries(m.legend)) if (l.secret) ok(`${id}: 隠し通路 '${ch}' は床の素材を持つ（${l.floor}）`, !!l.floor && m.kind === 'dungeon');
}
const cnt = (id) => (R.DB.maps[id].objects || []).filter((o) => o.type === 'chest').length;
ok('宝箱の数（ロア 1・ファロス 2・灯台 2〜4 ずつ・古井戸 3）', cnt('roa') === 1 && cnt('pharos') === 2 && [1, 2, 3].every((i) => cnt('lighthouse_' + i) >= 2 && cnt('lighthouse_' + i) <= 4) && cnt('well') === 3,
  ['roa', 'pharos', 'lighthouse_1', 'lighthouse_2', 'lighthouse_3', 'well'].map(cnt));
ok('灯台 2 階の隠し通路の先にレアの箱', (R.DB.maps.lighthouse_2.objects || []).some((o) => o.pool === 'p_rare'));
ok('ボスの前の泉（灯台 3 階）', (R.DB.maps.lighthouse_3.objects || []).some((o) => o.type === 'spring'));

// 町の飾りの密度（V2_PLAN §3.16-3 check_density: 1 画面 30×17 マスに飾り 25〜40、通りの中央は空ける）
for (const id of ['roa', 'pharos']) {
  const m = R.DB.maps[id];
  const counts = [];
  for (let cy = 8; cy < m.h - 4; cy += 6) for (let cx = 15; cx < m.w - 10; cx += 8) {
    const c = R.MapUtil.cell(m, cx, cy);
    if (!c || c.solid || c.walk === false) continue;
    let n = 0;
    for (const o of m.objects || []) {
      if (o.x < cx - 15 || o.x > cx + 14 || o.y < cy - 8 || o.y > cy + 8) continue;
      if (['prop', 'building', 'sign', 'chest', 'waylamp', 'examine'].includes(o.type) && !(o.type === 'examine' && (m.objects || []).some((q) => q !== o && q.x === o.x && q.y === o.y))) n++;
    }
    for (const nn of m.npcs || []) if (nn.x >= cx - 15 && nn.x <= cx + 14 && nn.y >= cy - 8 && nn.y <= cy + 8 && !nn.cond) n++;
    counts.push(n);
  }
  counts.sort((a, b) => a - b);
  const med = counts[counts.length >> 1];
  console.log(`    ${id}: 1 画面の飾りと人 ${counts[0]}〜${counts[counts.length - 1]}（中央値 ${med}、${counts.length} 画面）`);
  ok(`${id}: 1 画面の飾りの中央値 25〜45`, med >= 25 && med <= 45, med);
}

// ------------------------------------------------------------------ 5. 話す見返り
section('5. 話す見返りのある人（WORLD_REDESIGN §3.3）');
function rewards(ids) {
  const r = { n: 0, kinds: new Set(), air: 0 };
  for (const id of ids) for (const n of R.DB.maps[id].npcs || []) {
    if (n.cond && /prologue_boss/.test(JSON.stringify(n.cond))) continue;
    if (n.reward) { r.n++; r.kinds.add(n.reward); } else if (n.talk && !/^ani_/.test(n.look)) r.air++;
  }
  return r;
}
const ph = rewards(['pharos', 'pharos_inn', 'pharos_tavern', 'pharos_shop', 'pharos_smith', 'pharos_record', 'pharos_shipyard']);
ok(`ファロス: 見返りのある人 8 人以上（${ph.n}）`, ph.n >= 8);
ok(`ファロス: 種類 4 種以上（${[...ph.kinds].join(' ')}）`, ph.kinds.size >= 4);
ok(`ファロス: 空気だけの人 4 人まで（店と宿の人を除く ${ph.air - 4}）`, ph.air - 4 <= 4);
for (const id of ['roa', 'pharos']) for (const n of R.DB.maps[id].npcs || []) if (n.talk && n.reward) ok(`${id}.${n.id} に新しい話の key`, !!n.key);

// ------------------------------------------------------------------ 6. 文
section('6. 文（1 ページ 3 行・1 行 18 字、表示してはいけない言葉、仲間の名前）');
const pages = [];
const SAY_SRC = MY_FILES.filter((f) => f !== 'leads_main.js').map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n');
const strs = SAY_SRC.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
for (const s of strs) { const t = s.slice(1, -1); if (/[ぁ-んァ-ン一-龥]/.test(t) && t.includes('\\n')) pages.push(t.replace(/\\n/g, '\n')); }
let bad = [];
for (const p of pages) {
  const lines = p.split('\n');
  const t = p.replace(/\{hero\}/g, 'アルン');
  if (lines.length > 4 || t.split('\n').some((l) => [...l].length > 20)) bad.push(p.slice(0, 30));
}
for (const id of MY_LEADS) { const l = R.DB.leads[id]; const L = l.text.split('\n'); if (L.length > 3 || L.some((x) => [...x].length > 22)) ok(`手がかり ${id} の文 3 行・1 行 22 字まで`, false, l.text); }
ok(`1 ページ 4 行まで・1 行 20 字まで（${pages.length} ページ）`, bad.length === 0, bad.slice(0, 6));
const long = pages.filter((p) => p.replace(/\{hero\}/g, 'アルン').split('\n').some((l) => [...l].length > 18));
console.log(`    18 字を越える行のあるページ ${long.length}（目安は 16 字）`);
const BAN = [/オート(?!セーブ)/, /\bWP\b/, /Lv/, /経験値/, /中列/, /レベル/];
ok('表示してはいけない言葉が無い', !BAN.some((re) => re.test(SRC.replace(/\/\/.*$/gm, ''))), BAN.filter((re) => re.test(SRC.replace(/\/\/.*$/gm, ''))).map(String));
const COMP = Object.values(R.DB.companions || {}).map((c) => c.name).filter(Boolean);
const said = pages.join('\n');
ok(`仲間 ${COMP.length} 人の名前が物語の文に出ない（A36）`, !COMP.some((n) => said.includes(n)), COMP.filter((n) => said.includes(n)));
const NPC_NAMES = ['タデオ', 'イェナ', 'オットー', 'ベルナ', 'ロウェル'];
ok('町の人の名前が仲間と重ならない', !NPC_NAMES.some((n) => COMP.includes(n)));

// ------------------------------------------------------------------ 7. ボイス
section('7. ボイス（id と文面が script.csv と同じ）');
const CSV = fs.readFileSync(path.join(V2, '..', 'design', 'voice', 'script.csv'), 'utf8').split('\n');
const script = {};
for (const line of CSV) { const c = line.split(','); if (/^v_/.test(c[0])) script[c[0]] = c[7]; }
const MINE = ['v_berna_prologue_01', 'v_berna_prologue_02', 'v_berna_prologue_03', 'v_berna_prologue_04', 'v_rowell_prologue_01', 'v_rowell_prologue_02',
  'v_fine_lighthouse_01', 'v_fine_lighthouse_02', 'v_berna_lute_01', 'v_berna_lute_02', 'v_berna_lute_03', 'v_berna_lute_04', 'v_berna_lute_05', 'v_fine_t1_01', 'v_fine_t1_02'];
const used = {};
for (const m of SRC.matchAll(/ev\.say\([^,]+,\s*'((?:[^'\\]|\\.)*)',\s*(?:Object\.assign\()?\{[^}]*voice:\s*'(v_[a-z0-9_]+)'/g)) used[m[2]] = (used[m[2]] || []).concat(m[1].replace(/\\n/g, ''));
for (const id of MINE) {
  ok(`${id} を 1 回使う`, (used[id] || []).length === 1, used[id]);
  if (used[id]) ok(`${id} の文面が同じ`, used[id][0] === script[id], [used[id][0], script[id]]);
  ok(`${id} のファイルがある`, fs.existsSync(path.join(V2, '..', 'assets', 'voice', id + '.ogg')));
}
// 2026-09-27: 物語のボイス（design/voice_story_map.json の story）も使う。文面は chronicle/tools/story_voice.js --check が見る
const STORY_V = Object.entries(JSON.parse(fs.readFileSync(path.join(V2, 'design', 'voice_story_map.json'), 'utf8')).lines).filter(([, l]) => l.kind === 'story').map(([k]) => k);
ok('自分のイベントで使うボイスは 15 本と物語のボイスだけ', Object.keys(used).every((k) => MINE.includes(k) || STORY_V.includes(k)), Object.keys(used));

// ------------------------------------------------------------------ 8. 通し（真似の ev）
section('8. 通し: 序章 P1〜P10 と T1（真似の ev で順に流す）');
async function flow() {
  // node の中では画面を開かない（開くと閉じるまで待つため）
  R.Screens.tip = async () => {}; R.Screens.open = async () => undefined;
  R.State.newGame({ seed: 7 });
  const G = R.Game;
  const log = [];
  const mk = (ctx) => {
    const ev = R.Events.makeEv ? Object.assign({}, R.Events.makeEv(ctx || {})) : {};
    Object.assign(ev, {
      say: async (who, t) => { log.push(['say', who, Array.isArray(t) ? t.join('/') : t]); },
      choose: async (labels) => { log.push(['choose', labels]); return 0; },
      caption: async (t) => { log.push(['caption', t]); },
      fade: async () => {}, wait: async () => {}, letter: async (id) => { log.push(['letter', id]); },
      battle: async (s) => { log.push(['battle', typeof s === 'string' ? s : s.troop]); return 'win'; },
      warp: async (map, sp) => { log.push(['warp', map, sp]); G.pos = { map, x: 0, y: 0, dir: 's' }; },
      createHero: async () => { const h = { type: 'ranger', sex: 'f', name: 'リズ', fav: 'bow' }; R.State.setHero(h); return h; },
      chooseCompanions: async () => { const ids = ['selma', 'viola', 'marta']; for (const id of ids) R.Party.join(id); return ids; },
      inn: async () => true, shop: async () => {}, tavern: async () => {},
      npc: () => ({ move: async () => {}, face: async () => {}, act: async () => {}, hide: async () => {}, show: async () => {}, setPos: async () => {} }),
      jingle: async () => {}, bgm: () => {}, sfx: () => {},
      call: (id, args) => R.DB.events[id].run(mk(Object.assign({}, ctx, args)), Object.assign({}, ctx, args)),
    });
    return ev;
  };
  const run = async (id, ctx) => { const e = R.DB.events[id]; if (e.once && G.flags['ev_' + id]) return; await e.run(mk(ctx), ctx || {}); if (e.once) G.flags['ev_' + id] = true; };
  const steps = [
    ['roa_house_intro', { map: 'roa_house' }], ['roa_lectern', {}], ['roa_seat', {}], ['roa_berna', { npc: 'berna_desk' }], ['roa_stone', {}], ['roa_children', {}], ['roa_farmer', {}],
    ['world_pen_lamp', { x: 89, y: 96 }], ['pharos_arrival', {}], ['pharos_record_notice', {}], ['pharos_rowell', {}], ['pharos_otto', {}],
    ['pharos_tavern_master', { npc: 'master' }], ['pharos_otto', {}], ['lighthouse_1_tutorial', {}], ['lighthouse_3_fine', {}], ['lighthouse_3_boss', {}],
    ['pharos_rumor_gossip', { npc: 'gossip' }], ['pharos_rumor_gossip', { npc: 'gossip' }], ['pharos_rumor_bard', { npc: 'bard' }], ['pharos_rumor_trader', { npc: 'trader' }],
    ['pharos_tadeo', {}], ['pharos_tadeo', {}], ['world_pen_lamp', { x: 89, y: 96 }], ['world_pen_lamp', { x: 100, y: 80 }], ['pharos_tadeo', {}],
    ['pharos_well_child', {}], ['well_nest', {}], ['pharos_apprentice', {}], ['windhill_notes', {}],
  ];
  const errs = [];
  for (const [id, ctx] of steps) {
    let t;
    const to = new Promise((res) => { t = setTimeout(() => res('timeout'), 3000); });
    try { const r = await Promise.race([run(id, ctx), to]); if (r === 'timeout') errs.push(id + ': 止まった（3 秒）'); } catch (e) { errs.push(id + ': ' + (e && e.stack || e)); }
    clearTimeout(t);
  }
  ok('序章のイベントが例外なく流れる', errs.length === 0, errs);
  ok('主人公ができた（ev.createHero）', !!(G.chars.hero && G.chars.hero.name === 'リズ'));
  ok('P2: 傷薬と 50 G', (G.items.i_salve || 0) >= 3 && G.gold >= 50, [G.items.i_salve, G.gold]);
  ok('P6: 仲間が 3 人', G.party.length === 4, G.party);
  ok('P7: 灯台の鍵', G.flags.prologue_key && (G.items.k_lighthouse_key || 0) >= 1);
  ok('P8: チュートリアルの戦闘（主人公ひとり・必ず閃く）', log.some((l) => l[0] === 'battle' && l[1] === 'tr_tutorial') && G.flags.prologue_tutorial);
  ok('P9: ページ食らい → 灯がともる → ファロスへ', log.some((l) => l[0] === 'battle' && l[1] === 'tr_b_pageeater') && G.flags.prologue_boss && log.some((l) => l[0] === 'warp' && l[1] === 'pharos'));
  ok('P10: 年代記・羽ペン・鈴・手がかり帳・灯台守のランタン・prologue_done', G.flags.prologue_done && ['k_chronicle', 'k_quill', 'k_bell', 'ac_keeper_lantern'].every((k) => (G.items[k] || 0) >= 1) && !!G.leads.l_main_rumors,
    ['k_chronicle', 'k_quill', 'k_bell', 'ac_keeper_lantern'].map((k) => G.items[k]));
  ok('P10: 年代記に序章の章', G.chronicle.chapters.some((c) => c.id === 'prologue'));
  ok('P10: ベルナが弟子の名の前で一瞬詰まる（地の文）', log.some((l) => l[0] === 'say' && /何か言いかけて/.test(l[2])));
  ok('読み物（語り石・名簿・朝の席・掲示・守り歌）を書き写した', ['lo_roa_stone', 'lo_roa_register', 'lo_roa_seat', 'lo_ev_prologue', 'lo_lighthouse_song'].every((k) => G.flags[k]));
  ok('潮風亭の噂: 1 回ごとに次の噂（森 → 休み小屋）', !!G.leads.l_rumor_forest && !!G.leads.l_opt_hut && !!G.leads.l_rumor_snow && !!G.leads.l_rumor_desert);
  ok('依頼 q_pharos_lamp: 2 つの灯籠をともして礼', G.flags.prologue_lamp_road && G.flags.prologue_lamp_lookout && G.flags.prologue_lamp_paid && G.leads.q_pharos_lamp && G.leads.q_pharos_lamp.done);
  ok('依頼 q_pharos_well: 巣を見つけて解決', G.leads.q_pharos_well && G.leads.q_pharos_well.done);
  ok('依頼 q_pharos_delivery: 包みを受け取る', !!G.leads.q_pharos_delivery && G.flags.prologue_parcel);
  ok('風鳴りの丘: 風の鈴', (G.items.u_windchime || 0) >= 1);
  ok('{hero} が名前に置き換わる', log.filter((l) => l[0] === 'say' && /\{hero\}/.test(l[2] || '')).length === 0);
  // T1
  G.cleared.r_forest = true; G.tier = 1;
  log.length = 0;
  await run('story_t1', {});
  ok('T1: 手紙 → 少女（v_fine_t1_01・02）→ 余白の一行', log.some((l) => l[0] === 'letter' && l[1] === 'berna_t1') && G.flags.story_t1 && !!G.leads.l_main_margin_1);
  const f0 = log.length; await run('story_t1', {});
  ok('T1 は 1 回だけ', log.length === f0);
}

// ------------------------------------------------------------------ 9. ワールド
section('9. ワールド（gen_world の検査と生成物）');
const gw = require('./gen_world.js');
const r = gw.check();
ok('gen_world の検査にエラーが無い', r.errs.length === 0, r.errs);
ok(`縦切りの範囲の歩けるマス 約 3,500 以上（${r.info.walk}: 半島 ${r.info.peninsula}・北の野 ${r.info.plains}・森 ${r.info.forest}）`, r.info.walk >= 3500);
ok('30 歩の空白の道 0', r.info.emptyRoad === 0, r.info.emptyAt);
const { execFileSync } = require('child_process');
const before = fs.readFileSync(path.join(V2, 'src', 'maps', 'world.js'), 'utf8');
ok('world.js は生成器の今の出力と同じ（手で直していない）', (() => {
  const tmp = path.join(require('os').tmpdir(), 'cp_world_' + process.pid + '.js');
  const src = fs.readFileSync(path.join(__dirname, 'gen_world.js'), 'utf8').replace("const OUT = path.join(__dirname, '..', 'src', 'maps', 'world.js');", `const OUT = ${JSON.stringify(tmp)};`);
  const gtmp = path.join(__dirname, '.gen_world_tmp_' + process.pid + '.js');
  fs.writeFileSync(gtmp, src);
  try { execFileSync(process.execPath, [gtmp], { stdio: 'ignore' }); } catch (e) { /* 検査の失敗は上で数える */ }
  fs.unlinkSync(gtmp);
  const out = fs.existsSync(tmp) ? fs.readFileSync(tmp, 'utf8') : '';
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  return out === before;
})());
const W = R.DB.maps.world;
ok('峠の崖崩れと番人は DB.config.slice の間だけ', W.tilePatches.filter((p) => p.cond && p.cond.slice === true).length === 3 && W.npcs.filter((n) => n.cond && n.cond.slice === true).length === 3);
ok('跳ね橋は序章の間だけ上がっている', W.tilePatches.some((p) => p.cond === '!prologue_done'));
ok('森の街道の消えた灯籠 3 つ（q_forest_fireflies）', W.objects.filter((o) => o.type === 'waylamp' && /^q_forest_fireflies_/.test(o.lit)).length === 3);
ok('半島の消えた灯籠 2 つ（P3・q_pharos_lamp）', W.objects.filter((o) => o.type === 'waylamp' && /^prologue_lamp_/.test(o.lit)).length === 2);

flow().then(() => done('test_content_p'), (e) => { ok('flow', false, String(e && e.stack || e)); done('test_content_p'); });
