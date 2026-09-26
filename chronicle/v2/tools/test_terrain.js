#!/usr/bin/env node
// TERRAIN: node のテスト（DOM なし）。V2_PLAN §4.4 の TERRAIN の行のうち、canvas の要らない物。
//   node v2/tools/test_terrain.js
// 契約の名前・仮の一覧の id が全部本物・meta（solid/soft/light）・dual grid の 16 通りの角・素材の周期（隣とつながる）・テーマ・光の既定・dirty。
// 焼く物（チャンク・物の絵・境の見本）はブラウザの test_terrain_browser.js。
'use strict';
const load = require('./lib/load');
const { ok, section, done } = require('./lib/testkit');
const { MAPS } = require('./test_terrain_maps');

const R = load({ quiet: true });
const C = R.Contract, T = R.Terrain;

section('契約');
ok('R.Terrain の名前がそろう（checkApi）', C.checkApi('Terrain').ok, C.checkApi('Terrain').errors);
ok('Terrain は本物（仮の実装で埋まっていない・claim 済み）', !R.Stubs.installed.Terrain && !!(R.Stubs.claimed || {}).Terrain, R.Stubs.installed.Terrain);
ok('CHUNK = 8', T.CHUNK === 8);
ok('読み込みのエラーなし', R._nodeLoadErrors.length === 0 && !R.loadErrors.some((e) => /terrain|materials|props|hd:(prop|bld|secret)/i.test(e)), R._nodeLoadErrors.concat(R.loadErrors).slice(0, 5));

section('素材と物の一覧（仮の stub_art.js の id を全部本物で）');
const STUB_MATS = ['grass', 'moss_earth', 'dirt', 'road', 'cobble', 'sand', 'plank', 'deck', 'bridge', 'ladder', 'stone_floor', 'wood_floor', 'carpet', 'cave_floor', 'bark_floor', 'root_floor', 'flowers', 'tall_grass', 'pier',
  'rock', 'cliff', 'wall_stone', 'wall_brick', 'wall_wood', 'wall_moss', 'wall_bark', 'wall_cave', 'tree', 'forest_dark', 'bush', 'roots', 'water', 'sea', 'deep_water', 'shallow'];
const STUB_WALK = { grass: 1, moss_earth: 1, dirt: 1, road: 1, cobble: 1, sand: 1, plank: 1, deck: 1, bridge: 1, ladder: 1, stone_floor: 1, wood_floor: 1, carpet: 1, cave_floor: 1, bark_floor: 1, root_floor: 1, flowers: 1, tall_grass: 1, pier: 1, shallow: 1 };
const STUB_PROPS = ['barrel', 'crate', 'sack', 'bench', 'chair', 'table', 'bed', 'bookshelf', 'counter', 'stove', 'lamp_post', 'lantern', 'fence', 'flower_pot', 'well', 'signboard', 'rock_small', 'stump', 'log', 'mushroom_glow', 'firefly',
  'rope_bridge', 'leaves_over', 'chest', 'spring', 'brazier', 'waylamp', 'switch', 'songstone', 'footprint', 'beacon', 'stairs_up', 'stairs_down', 'door'];
ok('素材の id が全部ある', STUB_MATS.every((id) => R.DB.materials[id]), STUB_MATS.filter((id) => !R.DB.materials[id]));
ok('素材は仮でなく本物（R.Stubs.installed に DB.materials の仮の id が無い）', !(R.Stubs.installed['DB.materials'] || []).some((id) => STUB_MATS.includes(id)), R.Stubs.installed['DB.materials']);
ok('walk は仮の一覧と同じ意味', STUB_MATS.every((id) => R.DB.materials[id].walk === !!STUB_WALK[id]), STUB_MATS.filter((id) => R.DB.materials[id].walk !== !!STUB_WALK[id]));
ok('壁・崖は hard、それ以外の境は材質の通り', ['rock', 'cliff', 'wall_stone', 'wall_cave'].every((id) => R.DB.materials[id].edge === 'hard'));
ok('全素材が K.materialDef', Object.keys(R.DB.materials).every((id) => C.check('materialDef', R.DB.materials[id]).ok), Object.keys(R.DB.materials).filter((id) => !C.check('materialDef', R.DB.materials[id]).ok));
ok('物の id が全部ある', STUB_PROPS.every((id) => R.DB.props[id]), STUB_PROPS.filter((id) => !R.DB.props[id]));
ok('物は仮でなく本物', !(R.Stubs.installed['DB.props'] || []).some((id) => STUB_PROPS.includes(id)), R.Stubs.installed['DB.props']);
ok('全物が K.propDef', Object.keys(R.DB.props).every((id) => C.check('propDef', R.DB.props[id]).ok), Object.keys(R.DB.props).filter((id) => !C.check('propDef', R.DB.props[id]).ok));
const P = R.DB.props;
ok('meta: solid と soft は同時に立たない', Object.keys(P).every((id) => !(P[id].solid && P[id].soft)), Object.keys(P).filter((id) => P[id].solid && P[id].soft));
ok('meta: 仕掛けの物のコマ（宝箱 closed/open/rare_*、燭台・灯籠・スイッチ off/on）', P.chest.frames.join() === 'closed,open,rare_closed,rare_open' && ['brazier', 'waylamp', 'switch'].every((id) => P[id].frames.join() === 'off,on'));
ok('meta: 泉は 2×2・光る・solid', P.spring.footprint.join() === '2,2' && P.spring.solid && P.spring.light && P.spring.glow);
ok('meta: 灯りを持つ物は light に半径（r > 0）', Object.keys(P).filter((id) => P[id].light).every((id) => P[id].light.r > 0), Object.keys(P).filter((id) => P[id].light && !(P[id].light.r > 0)));
ok('meta: 通り抜けの小物（椅子・袋・花・小石）は soft、人より上の物は overChars', ['chair', 'sack', 'flower_pot', 'rock_small', 'bench'].every((id) => P[id].soft) && P.rope_bridge.overChars && P.leaves_over.overChars);
ok('全物に hd:prop の登録', Object.keys(P).every((id) => R.Hd.has('hd:prop:' + id)), Object.keys(P).filter((id) => !R.Hd.has('hd:prop:' + id)));
ok('隠し通路の絵 hd:secret:<壁> の登録', ['rock', 'wall_stone', 'wall_moss', 'wall_bark', 'wall_cave', 'forest_dark'].every((id) => R.Hd.has('hd:secret:' + id)));

section('建物のキー');
const d1 = { type: 'building', id: 'a', x: 3, y: 4, w: 6, h: 5, roof: 'slate', mat: 'plaster', door: { x: 5, y: 8 }, windows: 2 };
const k1 = T.building(d1), k2 = T.building(Object.assign({}, d1)), k3 = T.building(Object.assign({}, d1, { x: 10, door: { x: 12, y: 8 } })), k4 = T.building(Object.assign({}, d1, { roof: 'terra' }));
ok('同じ中身の def は同じキー（位置は関係ない）', k1 === k2 && k1 === k3, [k1, k2, k3]);
ok('中身が違えば別のキー', k1 !== k4);
ok('キーの形 hd:bld:<hash> と登録', /^hd:bld:[0-9a-z]+$/.test(k1) && R.Hd.has(k1));

section('dual grid（16 通りの角）');
for (const [a, b] of [['dirt', 'grass'], ['sand', 'water'], ['cave_floor', 'wall_cave'], ['cobble', 'stone_floor']]) {
  const top = T._rank(b) > T._rank(a) ? b : a, low = top === a ? b : a;
  let bad = [];
  for (let combo = 0; combo < 16; combo++) for (const [px, py] of [[0, 0], [1, 2], [3, 1]]) {
    const M = T._mask(top, 32, combo, px, py);
    // 4 つの角の近く（2 px 内側）は、その角の素材そのもの
    const at = (x, y) => M[y * 32 + x];
    const corners = [[2, 2, 1], [29, 2, 2], [2, 29, 4], [29, 29, 8]];
    for (const [x, y, bit] of corners) { const inTop = at(x, y) === 1 || at(x, y) === 2; if (inTop !== !!(combo & bit)) bad.push([combo, px, py, x, y]); }
  }
  ok(`${low} の上の ${top}: 角の近くは 16 通りすべてその角の素材`, bad.length === 0, bad.slice(0, 5));
}
{
  // 隣の表示のタイルと境目がつながる: 横に並ぶ 2 枚（位相 0 と 1）の境の列で、中外が一致する（やわらかい境の 1/2 の組）
  let miss = 0, n = 0;
  for (const combo of [3, 12, 5, 10, 1, 2]) {
    const A = T._mask('grass', 32, combo, 0, 0), B = T._mask('grass', 32, combo, 1, 0);
    const right = (combo & 2 ? 1 : 0) | (combo & 8 ? 4 : 0), left = (combo & 1 ? 1 : 0) | (combo & 4 ? 4 : 0);
    if (right !== left) continue;   // 同じ角の組が続くときだけ（右の角 = 次の左の角）
    for (let y = 0; y < 32; y++) { n++; const a = A[y * 32 + 31] ? 1 : 0, b = B[y * 32] ? 1 : 0; if (a !== b && Math.abs(A[y * 32 + 31] - B[y * 32]) > 1) miss++; }
  }
  ok('となりの表示のタイルと境の列の中外が大きく食い違わない', n === 0 || miss / n < 0.1, { miss, n });
}
{
  const hard = T._mask('wall_stone', 32, 3, 0, 0), hard2 = T._mask('wall_stone', 32, 3, 2, 3);
  ok('硬い境は位相で形が変わらない（マスの線のまま）', hard === hard2 && hard[15 * 32 + 5] >= 1 && !(hard[16 * 32 + 5] === 1));
}

section('素材の周期（4 マスで一周 → 隣のマス・チャンクとつながる）');
for (const id of ['cobble', 'grass', 'plank', 'cave_floor', 'forest_dark', 'water', 'stone_floor', 'bark_floor']) {
  const s32 = T._sheet(id, 32), S = s32.S;
  ok(`${id}: 1 枚は 4 マス四方（${S} px）で全部焼ける`, s32.done && S === 128 && s32.px.every((p) => p >>> 24 === 255));
  // 端と端がつながる: 左端の列と右端の列の差が、内側の隣どうしの列の差と同じくらい
  const colDiff = (x0, x1) => { let d = 0; for (let y = 0; y < S; y++) { const a = s32.px[y * S + x0], b = s32.px[y * S + x1]; d += Math.abs((a & 255) - (b & 255)) + Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)); } return d / S; };
  const wrap = colDiff(S - 1, 0), inner = (colDiff(40, 41) + colDiff(80, 81) + colDiff(100, 101)) / 3;
  ok(`${id}: 周期の継ぎ目が目立たない（端の差 ${wrap.toFixed(1)} ≦ 内側の差 ${inner.toFixed(1)} の 2.5 倍 + 8）`, wrap <= inner * 2.5 + 8, { wrap, inner });
}
{
  const s24 = T._sheet('grass', 24), s40 = T._sheet('grass', 40);
  ok('広さの設定の tile 24 / 40 でも焼ける（S = 4 × tile）', s24.S === 96 && s40.S === 160 && s24.done && s40.done);
}
ok('純粋な黒を使わない（素材の 1 枚に r+g+b < 3 の画素なし）', Object.keys(R.DB.materials).filter((id) => !/^stub_/.test(id)).every((id) => { const s = T._sheet(id, 32); return s.px.every((p) => (p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255) >= 3); }));

section('テーマと光');
const TH = C.THEMES;
ok('テーマの表が THEMES を全部持つ', TH.every((t) => T.THEMES[t]), TH.filter((t) => !T.THEMES[t]));
ok('テーマの mood は MOODS の中', Object.values(T.THEMES).every((t) => C.MOODS.includes(t.mood)));
ok('map.theme が優先', T.theme({ kind: 'town', theme: 'cave', legend: {} }).id === 'cave');
const guess = (kind, mats) => { const legend = {}; mats.forEach((m, i) => { legend[String.fromCharCode(65 + i)] = { mat: m }; }); return T.theme({ kind, legend }).id; };
ok('theme が無いとき kind と素材から決める', guess('world', ['grass']) === 'world' && guess('dungeon', ['wall_cave', 'cave_floor']) === 'cave' && guess('dungeon', ['wall_bark']) === 'tree_inside'
  && guess('dungeon', ['forest_dark', 'grass']) === 'forest_dungeon' && guess('dungeon', ['wall_stone', 'stone_floor']) === 'lighthouse' && guess('town', ['deck', 'moss_earth']) === 'treetop'
  && guess('town', ['cobble', 'sea']) === 'harbor' && guess('town', ['moss_earth']) === 'moss_village' && guess('town', ['grass', 'dirt']) === 'hill_village', {
  w: guess('world', ['grass']), c: guess('dungeon', ['wall_cave']), f: guess('dungeon', ['forest_dark', 'grass']) });
for (const k of Object.keys(MAPS)) ok(`見本 ${k} は K.map・テーマ ${T.theme(MAPS[k]).id}`, C.check('map', MAPS[k]).ok, C.check('map', MAPS[k]).errors);
const amb = T.ambient(MAPS.harbor, 0);
ok('ambient は K.ambient（mood は MOODS）', C.check('ambient', amb).ok && C.MOODS.includes(amb.mood), amb);
ok('map.light.k（明るさ）→ compose の k（効き）: 夜の町 0.45 → 1、昼 1.0 → 0、ダンジョン 0.6 → 0.73', T.ambient({ kind: 'town', legend: {}, light: { ambient: '#5c5aa0', k: 0.45 } }, 0).k === 1 && T.ambient({ kind: 'town', legend: {}, light: { ambient: '#5c5aa0', k: 1 } }, 0).k === 0 && Math.abs(T.ambient({ kind: 'dungeon', legend: {}, light: { ambient: '#5c5aa0', k: 0.6 } }, 0).k - 0.727) < 0.01);
{
  const a0 = R.Terrain._u.hex(T.ambient(MAPS.harbor, 0).ambient), a8 = R.Terrain._u.hex(T.ambient(MAPS.harbor, 8).ambient);
  ok('ティアが上がると環境光が明るくなる（R.Sky.at(tier).ambientMul）', a8[2] > a0[2] && a8[0] > a0[0], { a0, a8 });
}
ok('map.light が無ければ mood の色', /^#[0-9a-f]{6}$/.test(T.ambient({ kind: 'dungeon', legend: { a: { mat: 'wall_cave' } } }, 0).ambient));

section('光の出どころ（建物の窓・戸口・灯り、物、宝箱、泉）');
{
  // 建物は絵を焼かないと窓の位置が分からないので、node では物と仕掛けだけ
  const m = MAPS.lights, st = T._stateOf(m, { lamps: m.lamps });
  const L = T._lightsOf(m, { tile: 32, st, bld: () => null });
  const src = L.lights.map((l) => l.src);
  ok('泉・ともった燭台・ともった灯籠が光だまりを持ち、消えた物は持たない', src.includes('L_s') && src.includes('L_b1') && src.includes('L_w1') && !src.includes('L_b0') && !src.includes('L_w0'), src);
  ok('光は K.light', L.lights.every((l) => C.check('light', l).ok), L.lights.find((l) => !C.check('light', l).ok));
  ok('灯りの色は R.Hd.STYLE.light から', L.lights.some((l) => l.color === R.Hd.STYLE.light.fireColor) && L.lights.some((l) => l.color === R.Hd.STYLE.light.crystalColor));
  const c = MAPS.chests, cst = T._stateOf(c, { chests: c.opened });
  const CL = T._lightsOf(c, { tile: 32, st: cst, bld: () => null });
  ok('閉じた宝箱だけ小さな光だまりときらめき（開けた箱は光なし、MODERN_UI §7.5）', CL.lights.filter((l) => l.type === 'chest').length === 16 && CL.glows.filter((g) => g.type === 'sparkle').length === 16, CL.lights.length);
}

section('焼き直し（dirty）');
{
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'テスト' }, seed: 3 });
  const m = MAPS.forest_dungeon;
  let ev = null; R.on('terrain:dirty', (e) => { ev = e; });
  const ch = m.objects.find((o) => o.type === 'chest' && o.id === 'v_c1');
  const d = T.dirty(m, ch.x, ch.y);
  ok('宝箱を開けた → そのチャンク 1 つだけ', d.length === 1 && d[0][0] === Math.floor(ch.x / 8) && d[0][1] === Math.floor(ch.y / 8), d);
  ok("R.emit('terrain:dirty', {map, chunks})", ev && ev.map === m.id && ev.chunks.length === 1);
  ok('takeDirty で受け取って空になる', T.takeDirty(m.id).length === 1 && T.takeDirty(m.id).length === 0);
  const b = m.objects.find((o) => o.type === 'brazier');
  const db = T.dirty(m, b.x, b.y);
  ok('燭台（光が隣へ届く）はそのチャンクと届く範囲のチャンク', db.length >= 1 && db.some((q) => q[0] === Math.floor(b.x / 8) && q[1] === Math.floor(b.y / 8)), db);
  ok('chunkOf', T.chunkOf(17, 9).join() === '2,1');
}

section('仕事の形（node では焼かない）');
{
  const job = T.bakeChunk(MAPS.cave, 0, 0, { tile: 32, tier: 0 });
  ok('bakeChunk → K.bakeJob（kind chunk、まだ done でない）', C.check('bakeJob', job).ok && job.kind === 'chunk' && job.done === false);
  const pw = T.prewarm(MAPS.cave, { tile: 32 });
  ok('prewarm → K.bakeJob', C.check('bakeJob', pw).ok);
}

done('test_terrain');
