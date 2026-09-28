#!/usr/bin/env node
// FIELD の小地図（minimap.js）の「歩いた所」のテスト（node）
//   オーナーの報告「ダンジョン、通ったはずの通路が、地図に表示されてない部分があるよ」:
//   歩いた所はこのセッションの間だけで、セーブ → 読み込み（再読み込み・続きから）のあとは消えていた。
//   1. 書き方（enc・dec）が行き来で変わらない・形の合わない物は読まない
//   2. いくつかのダンジョンの階（灯台 1〜3 階・迷いの森・古井戸・千年樹・砂の王墓）を、通路・扉のワープ・階段を通って本当に歩き、
//      立ったマスと、そのまわり（見せる半径の円）が地図に載っている（見つける前の隠し通路の先は除く）
//   3. セーブ（serialize → JSON → deserialize）・冒険の合言葉の行き来のあとも、全部の階で同じ所が載っている。載っていない所は増えない
//   4. 新しい旅では前の旅の地図を引き継がない
//   node v2/tools/test_automap.js
'use strict';
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true, dev: true, fixtures: true, fixtureDirs: [path.join(__dirname, 'fixtures')] });
const F = R.Field, S = F._s, M = F.minimap;
const REVEAL = 4;

const adv = (ms) => R.Engine.advance(ms);
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function drive(p, ms) {
  let fin = false;
  p.then(() => { fin = true; }, (e) => { fin = true; console.error(e); });
  for (let t = 0; t < (ms || 3000) && !fin; t += 16.67) { adv(16.67); await flush(); }
}
async function enter(map, sp) { await drive(F.enter(map, sp, { fade: 0, noAutosave: true })); await settle(); }
async function settle() { for (let i = 0; i < 60 && (S.mv || S.arriving || S.entering); i++) { adv(16.67); await flush(); } }

const D4 = [[1, 0, 'e'], [-1, 0, 'w'], [0, 1, 's'], [0, -1, 'n']];
/** 今の所から歩ける所の BFS（行き先のあるマスは target のときだけ入る）→ {dist, prev} */
function bfs(m, target) {
  const k0 = S.x + ',' + S.y, prev = new Map([[k0, null]]), dist = new Map([[k0, 0]]), q = [[S.x, S.y, S.lv || 0]];
  while (q.length) {
    const [x, y, lv] = q.shift();
    for (const [dx, dy, d] of D4) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (prev.has(k) || !F._canEnter(m, x, y, nx, ny, lv, d)) continue;
      prev.set(k, x + ',' + y); dist.set(k, dist.get(x + ',' + y) + 1);
      if (F._warpAt(m, nx, ny, lv) && k !== target) continue;
      q.push([nx, ny, F._lvAfter(m, x, y, nx, ny, lv)]);
    }
  }
  return { dist, prev };
}
/** (tx, ty) まで 1 歩ずつ本当に歩く（F._step → 歩き終わり → F._arrive）。歩いたマスを walked に積む */
async function walkTo(tx, ty, walked) {
  for (let guard = 0; guard < 400; guard++) {
    await settle();
    if (S.x === tx && S.y === ty) return true;
    const m = S.map, tk = tx + ',' + ty, { prev } = bfs(m, tk);
    if (!prev.has(tk)) return false;
    let k = tk;
    while (prev.get(k) !== S.x + ',' + S.y) k = prev.get(k);
    const [nx, ny] = k.split(',').map(Number);
    const id = m.id;
    if (!F._step(nx - S.x, ny - S.y, guard % 2 === 0)) return false;   // 歩きと走りを交互に
    await settle();
    walked.push([S.map.id, S.x, S.y]);
    if (S.map.id !== id || S.x !== nx || S.y !== ny) return true;   // ワープした（扉・階段）
  }
  return false;
}
/** いちばん遠い所を順に 3 か所回る（部屋と通路をひと通り） */
async function tour(walked) {
  for (let leg = 0; leg < 3; leg++) {
    const { dist } = bfs(S.map, null);
    let best = null, bd = -1;
    for (const [k, d] of dist) { const [x, y] = k.split(',').map(Number); if (d > bd && !F._warpAt(S.map, x, y, 0)) { bd = d; best = [x, y]; } }
    if (!best) break;
    await walkTo(best[0], best[1], walked);
  }
}
/** 立ったマスと、そのまわり（見せる半径）で、地図に載っていない所 */
function missing(walked) {
  const out = [];
  for (const [id, x, y] of walked) {
    const m = R.DB.maps[id];
    if (!m || m.kind !== 'dungeon') continue;
    for (let dy = -REVEAL; dy <= REVEAL; dy++) for (let dx = -REVEAL; dx <= REVEAL; dx++) {
      if (dx * dx + dy * dy > REVEAL * REVEAL + 1) continue;
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= m.w || Y >= m.h) continue;
      if (R.MapUtil.secretHidden(m, X, Y)) continue;
      if (!M.seenAt(id, X, Y)) out.push(id + ' ' + X + ',' + Y + (dx || dy ? '' : ' (stood)'));
    }
  }
  return out;
}
function count() { let n = 0; for (const s of Object.values((R.Game && R.Game.explored) || {})) { const b = M._dec(s, +s.split('x')[0], +s.split(':')[0].split('x')[1]); if (b) for (const v of b) n += v; } return n; }

async function main() {
  section('1. 書き方（enc・dec）');
  let rt = true;
  for (let t = 0; t < 200; t++) {
    const w = 1 + (t % 37), h = 1 + ((t * 7) % 23), bits = new Uint8Array(w * h);
    let v = t % 2;
    for (let i = 0; i < bits.length; i++) { if (Math.random() < 0.08) v ^= 1; bits[i] = v; }
    const s = M._enc({ w, h, bits }), b = M._dec(s, w, h);
    if (!b || b.length !== bits.length || b.some((x, i) => x !== bits[i])) { rt = false; ok('enc/dec round trip ' + w + 'x' + h, false, s); break; }
  }
  ok('enc → dec gives the same bits (200 random maps)', rt);
  ok('dec refuses another size', M._dec('3x3:2.4', 4, 3) === null);
  ok('dec refuses too many cells', M._dec('3x3:2.9', 3, 3) === null);
  ok('dec refuses garbage', M._dec('3x3:zz?', 3, 3) === null && M._dec(null, 3, 3) === null);
  ok('empty map encodes short', M._enc({ w: 60, h: 52, bits: new Uint8Array(60 * 52) }) === '60x52:');

  section('2. ダンジョンを歩く（通路・扉・階段）');
  R.Dev.applyState('content_p_lighthouse_1');
  S.suppress = 1e9;   // 出現で止めない
  const walked = [];
  // 灯台: 外 → 扉（同じマップの中のワープ）→ 部屋と通路 → 2 階への階段 → 2 階 → 3 階
  await enter('lighthouse_1', 'entrance');
  walked.push([S.map.id, S.x, S.y]);
  await walkTo(17, 22, walked);
  ok('lighthouse_1: the door warps inside', S.map.id === 'lighthouse_1' && S.y <= 20, [S.x, S.y]);
  await tour(walked);
  const st1 = R.DB.maps.lighthouse_1.objects.find((o) => o.type === 'stairs');
  await walkTo(st1.x, st1.y, walked);
  ok('lighthouse_1 → lighthouse_2 by the stairs', S.map.id === 'lighthouse_2', S.map.id);
  walked.push([S.map.id, S.x, S.y]);
  await tour(walked);
  const up2 = R.DB.maps.lighthouse_2.objects.find((o) => o.type === 'stairs' && o.to && o.to.map === 'lighthouse_3' && (o.cond == null || R.State.check(o.cond)));
  if (up2) { await walkTo(up2.x, up2.y, walked); walked.push([S.map.id, S.x, S.y]); await tour(walked); }
  // ほかの階（入口から入って歩く）
  for (const id of ['verda_1', 'well', 'elder_1', 'desert_tomb_1']) {
    const m = R.DB.maps[id];
    if (!m) continue;
    await enter(id, Object.keys(m.spawns)[0]);
    S.suppress = 1e9;
    walked.push([S.map.id, S.x, S.y]);
    await tour(walked);
  }
  const floors = [...new Set(walked.map((w) => w[0]))];
  ok('walked several floors (≥ 6) and many tiles (≥ 400)', floors.length >= 6 && walked.length >= 400, { floors, n: walked.length });
  const miss = missing(walked);
  ok('every tile stood on and its neighbours (reveal radius) are on the map', miss.length === 0, miss.slice(0, 12));
  ok('R.Game.explored has every walked floor', floors.every((id) => typeof R.Game.explored[id] === 'string'), Object.keys(R.Game.explored || {}));
  ok('R.Game passes K.game with explored', R.Contract.check('game', R.Game).ok, R.Contract.check('game', R.Game).errors);

  section('3. セーブと読み込みのあと');
  const n0 = count();
  const snap = JSON.parse(JSON.stringify(R.State.serialize()));
  R.State.newGame({ seed: 1 });
  ok('new game: nothing is on the map (not carried over from the last journey)', walked.every(([id, x, y]) => !M.seenAt(id, x, y)));
  ok('deserialize the save', R.State.deserialize(snap));
  const miss2 = missing(walked);
  ok('after save → load: every walked tile and its neighbours are still on the map', miss2.length === 0, miss2.slice(0, 12));
  ok('after save → load: the same number of tiles', count() === n0, { before: n0, after: count() });
  // 読み込んだあと、その階に入ると、同じ所が今のマップの地図（M.seen）に載る
  const [lid, lx, ly] = walked.find((w) => w[0] === 'lighthouse_2');
  await enter('lighthouse_2', 'from_prev');
  ok('after load, entering the floor shows the walked corridor (M.seen)', M.seen(lx, ly), [lx, ly, lid]);
  // 冒険の合言葉の行き来
  const code = R.Save.passphrase();
  R.State.newGame({ seed: 2 });
  ok('passphrase → load', R.Save.fromPassphrase(code));
  const miss3 = missing(walked);
  ok('after passphrase: every walked tile and its neighbours are still on the map', miss3.length === 0, miss3.slice(0, 12));
  // 記録の枠（localStorage）の行き来
  ok('save to a slot', R.Save.save('s3'));
  R.State.newGame({ seed: 3 });
  ok('load the slot', R.Save.load('s3'));
  ok('after slot save → load: still on the map', missing(walked).length === 0);
  R.Save.remove('s3');

  section('4. 古いセーブ（explored が無い）');
  const old = JSON.parse(JSON.stringify(snap));
  delete old.explored;
  ok('an old save without explored still loads', R.State.deserialize(old));
  ok('…and its map starts empty', walked.every(([id, x, y]) => !M.seenAt(id, x, y)));
  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
