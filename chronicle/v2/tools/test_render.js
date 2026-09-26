// RENDER の node のテスト（V2_PLAN §4.4 の RENDER の行）: 形・mood の表・空の段・登録簿・焼く列の順番と予算・キャッシュの上限と pin・量の数え方・効果の質
// 画素（同じキーで同じ画素・ぼかし・光・仕上げ）はブラウザ: node v2/tools/test_render_browser.js
//   node v2/tools/test_render.js
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const Hd = R.Hd;
const MB = 1024 * 1024;
const fakeCanvas = (w, h) => ({ width: w, height: h });
const fakeSheet = (w, h, n) => ({ frames: Array.from({ length: n || 1 }, () => ({ c: fakeCanvas(w, h), ox: w / 2, oy: h })), poses: { idle: [0] }, anchors: {}, w, h });
const busy = (ms) => { const t = Hd._now(); while (Hd._now() - t < ms); };

section('contract');
for (const ns of ['Hd', 'Light', 'Post', 'Sky']) {
  const r = R.Contract.checkApi(ns);
  ok(`R.${ns} has every contract name`, r.ok, r.errors);
  ok(`R.${ns} is claimed (no stub filled in)`, !R.Stubs.installed[ns] && R.Stubs.claimed[ns], R.Stubs.installed[ns]);
}
ok('no load errors from render', !R.loadErrors.some((e) => /render\//.test(e)), R.loadErrors);
const srcDir = path.join(__dirname, '..', 'src', 'render');
const files = fs.readdirSync(srcDir);
ok('render files (§2.3)', ['rz.js', 'hd.js', 'bake.js', 'cache.js', 'blur.js', 'mood.js', 'light.js', 'post.js', 'sky.js', 'style.js'].every((f) => files.includes(f)), files);
const allSrc = files.map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n');
ok('no ctx.filter in render (§2.1)', !/\.filter\s*=/.test(allSrc));
ok('no setTimeout in render (§2.1)', !/setTimeout\(/.test(allSrc));
ok('no #000 / rgb(0,0,0) in render', !/#000\b|#000000|rgb\(0,\s*0,\s*0\)/.test(allSrc));

section('STYLE / BUDGET');
ok('STYLE.olMix 0.82', Hd.STYLE.olMix === 0.82);
ok('STYLE has the stub names (olMix maxColors rim steps)', ['olMix', 'maxColors', 'rim', 'steps'].every((k) => typeof Hd.STYLE[k] === 'number'));
const stubSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'stubs', 'stub_render.js'), 'utf8');
const stubBudget = /BUDGET:\s*(\{[\s\S]*?\n    \}),/.exec(stubSrc);
// eslint-disable-next-line no-new-func
const sb = stubBudget ? Function('return ' + stubBudget[1])() : null;
ok('BUDGET starts from the stub values', sb && Object.keys(sb).every((k) => JSON.stringify(sb[k]) === JSON.stringify(Hd.BUDGET[k])), sb);
const mb = Hd.BUDGET.mb;
ok('per-kind limits sum to total with the shared groups (§2.10: 40+30+30+20+20+10 = 150)', mb.chunk + mb.field + mb.mon + mb.bbg + mb.prop + mb.face === mb.total, mb);

section('mood');
for (const id of R.Contract.MOODS) {
  const m = Hd.mood(id);
  const c = R.Contract.check('mood', m);
  ok(`mood ${id} is K.mood`, c.ok, c.errors);
  const a = Hd._rgb(m.ambient);
  ok(`mood ${id} ambient is a coloured night (blue >= red, not black)`, a[2] >= a[0] * 0.8 && a[0] + a[1] + a[2] > 60, a);
  ok(`mood ${id} vignette/bloom in 0..1`, m.vignette > 0 && m.vignette < 1 && m.bloom >= 0 && m.bloom <= 1);
  ok(`mood ${id} rz light for baking`, Array.isArray(m.rz.key) && Array.isArray(m.rz.rimC));
}
ok('mood table has exactly MOODS', Object.keys(Hd.MOOD_TABLE).sort().join() === R.Contract.MOODS.slice().sort().join());
ok('unknown mood → night', Hd.mood('nope') === Hd.mood('night'));
const t0 = Hd._rgb(Hd.mood('town_night', 0).ambient), t8 = Hd._rgb(Hd.mood('town_night', 8).ambient);
ok('mood with tier 8 is brighter than tier 0', t8[0] > t0[0] && t8[2] > t0[2], [t0, t8]);
ok('mood with tier keeps K.mood', R.Contract.check('mood', Hd.mood('cave', 5)).ok);
ok('dungeon moods vignette stronger than town', Hd.mood('cave').vignette > Hd.mood('town_night').vignette && Hd.mood('dark').vignette > Hd.mood('night').vignette);
// mood の値の表（§4.4）を出す
console.log('\n  mood          ambient            vignette bloom thr  grade.sh       grade.hi      lift sat');
for (const id of R.Contract.MOODS) { const m = Hd.mood(id); console.log(`  ${id.padEnd(13)} ${m.ambient.padEnd(18)} ${String(m.vignette).padEnd(8)} ${String(m.bloom).padEnd(5)} ${String(m.thr).padEnd(4)} ${JSON.stringify(m.grade.sh).padEnd(14)} ${JSON.stringify(m.grade.hi).padEnd(13)} ${m.grade.lift}    ${m.grade.sat}`); }

section('sky');
let prev = 0;
for (let t = 0; t <= 8; t++) {
  const s = R.Sky.at(t);
  ok(`Sky.at(${t}) is K.sky`, R.Contract.check('sky', s).ok, R.Contract.check('sky', s).errors);
  ok(`Sky.at(${t}) brighter than ${t - 1}`, s.ambientMul > prev);
  prev = s.ambientMul;
}
ok('Sky 0 and 1 both deep night (within 5%)', R.Sky.at(1).ambientMul / R.Sky.at(0).ambientMul < 1.05);
ok('Sky clamps out of range', R.Sky.at(-3) === R.Sky.at(0) && R.Sky.at(12) === R.Sky.at(8));
ok('Sky lum target .16 → .30 (STYLE_REFERENCE §5.2)', R.Sky.at(0).lum === 0.16 && R.Sky.at(8).lum === 0.30);
ok('Sky.ambient scales a colour', R.Sky.ambient('rgb(100,100,100)', 8) === 'rgb(155,155,155)', R.Sky.ambient('rgb(100,100,100)', 8));

section('kindOf');
const kinds = { 'hd:field:x': 'field', 'hd:btl:a:sword': 'btl', 'hd:bld:inn': 'prop', 'hd:secret:w': 'prop', 'hd:bfx:slash': 'fx', 'hd:snap:m': 'fx', 'hd:mon:jelly_1': 'mon', 'hd:boss:b': 'boss', 'hd:bbg:coast': 'bbg', 'hd:face:x': 'face', 'hd:chunk:1': 'chunk', 'hd:zzz:1': 'zzz', odd: 'other' };
for (const k of Object.keys(kinds)) ok(`kindOf ${k} → ${kinds[k]}`, Hd.kindOf(k) === kinds[k], Hd.kindOf(k));

section('registry');
let calls = 0;
ok('def returns true', Hd.def('hd:prop:t_a', (o) => { calls++; return fakeSheet(10, 10); }, { solid: true }) === true);
const nErr = R.loadErrors.length;
ok('duplicate def → false, warned, not replaced', Hd.def('hd:prop:t_a', () => null) === false && R.loadErrors.length === nErr + 1);
ok('has / meta / keys', Hd.has('hd:prop:t_a') && !Hd.has('hd:prop:none') && Hd.meta('hd:prop:t_a').solid === true && Hd.keys('hd:prop:t_').includes('hd:prop:t_a'));
ok('get unknown → null', Hd.get('hd:prop:none') === null);
ok('get not baked → null and queued', Hd.get('hd:prop:t_a') === null && Hd.stats().queue >= 1 && calls === 0);
ok('get twice queues once', Hd.get('hd:prop:t_a') === null && Hd._queueLen() === 1);
Hd.pump(3);
const a1 = Hd.get('hd:prop:t_a');
ok('after pump: get returns the sheet', a1 && a1.frames && calls === 1);
ok('same key → same object (cached)', Hd.get('hd:prop:t_a') === a1 && Hd.now('hd:prop:t_a') === a1 && calls === 1);
ok('ready', Hd.ready('hd:prop:t_a') && !Hd.ready('hd:prop:t_a', { golden: true }));
ok('opts make a separate entry', Hd.now('hd:prop:t_a', { golden: true }) !== a1 && calls === 2);
ok('empty opts = no opts', Hd.now('hd:prop:t_a', {}) === a1);
// factory が null（まだ焼けない）
let ready = false, nullCalls = 0;
Hd.def('hd:prop:t_wait', () => { nullCalls++; return ready ? fakeSheet(4, 4) : null; });
ok('now with null factory → null, not remembered', Hd.now('hd:prop:t_wait') === null && !Hd.ready('hd:prop:t_wait'));
Hd.get('hd:prop:t_wait'); for (let i = 0; i < 5; i++) Hd.pump(3);
const nc = nullCalls;
ready = true;
for (let i = 0; i < 5; i++) { Hd.get('hd:prop:t_wait'); Hd.pump(3); }
ok('null factory is not retried every frame', nullCalls === nc, [nc, nullCalls]);
for (let i = 0; i < 40; i++) { Hd.get('hd:prop:t_wait'); Hd.pump(3); }
ok('null factory retried later and then cached', Hd.ready('hd:prop:t_wait'));
// redef
Hd.redef('hd:prop:t_a', () => fakeSheet(12, 12));
ok('redef drops the old bake', !Hd.ready('hd:prop:t_a') && Hd.now('hd:prop:t_a').w === 12);
// factory が仕事（K.bakeJob）を返す
let steps = 0;
Hd.def('hd:btl:t_job:sword', () => ({ done: false, result: null, kind: 'btl', step(ms) { steps++; busy(Math.min(ms, 1)); if (steps >= 6) { this.done = true; this.result = fakeSheet(40, 60, 12); } } }));
Hd.want('hd:btl:t_job:sword', null, 5);
let pumps = 0;
while (!Hd.ready('hd:btl:t_job:sword') && pumps < 50) { Hd.pump(3); pumps++; }
ok('factory returning a bake job is baked in slices and cached', Hd.ready('hd:btl:t_job:sword') && Hd.get('hd:btl:t_job:sword').frames.length === 12, { pumps, steps });
steps = 0; Hd.forget('hd:btl:t_job:sword');
ok('now() runs a bake job to the end', Hd.now('hd:btl:t_job:sword').frames.length === 12);

section('schedule order (prio, then first in)');
Hd._clearQueue();
const order = [];
const job = (name, n) => { let i = 0; return { done: false, kind: 'x', step() { order.push(name); if (++i >= n) this.done = true; } }; };
Hd.schedule(job('low', 1), 1);
Hd.schedule(job('high', 1), 10);
Hd.schedule(job('mid-a', 1), 5);
Hd.schedule(job('mid-b', 1), 5);
Hd.schedule(job('zero', 1));
for (let i = 0; i < 10; i++) Hd.pump(3);
ok('jobs run by prio, ties in order', order.join() === 'high,mid-a,mid-b,low,zero', order);
let doneRes = null;
const j2 = { done: false, result: null, step() { this.done = true; this.result = 42; }, onDone(r) { doneRes = r; } };
Hd.schedule(j2, 0); Hd.pump(3);
ok('onDone(result) called once job is done', doneRes === 42);
const bj = R.Contract.check('bakeJob', { step() {}, done: false });
ok('K.bakeJob shape', bj.ok, bj.errors);
ok('schedule of a finished job is ignored', Hd.schedule({ step() {}, done: true }, 1) && Hd._queueLen() === 0);

section('pump budget (never over 3 ms)');
Hd._clearQueue();
// 決まった時計で確かめる（仕事と絵が使う時間を時計に足す。OS の割り込みや GC に左右されない）
const realClock = Hd._clock;
let T = 0;
Hd._clock = () => T;
const spend = (ms) => { T += ms; };
// 仕事 20 本（step(ms) は ms まで使う）と、0.4〜1.2 ms の小さな絵 60 枚を積み、フレームを回す
for (let i = 0; i < 20; i++) { let left = 12; Hd.schedule({ done: false, step(ms) { const use = Math.min(ms, left); spend(use); left -= use; if (left <= 1e-9) this.done = true; } }, i % 3); }
for (let i = 0; i < 60; i++) { const ms = 0.4 + (i % 5) * 0.2; Hd.def('hd:fx:t_small_' + i, () => { spend(ms); return fakeSheet(8, 8); }); Hd.want('hd:fx:t_small_' + i, null, i % 4); }
let maxPump = 0, frames = 0, overFrames = 0;
while (Hd._queueLen() && frames < 400) { const t = T; Hd.pump(3); const d = T - t; maxPump = Math.max(maxPump, d); if (d > 3 + 1e-9) overFrames++; frames++; }
ok('queue drained', Hd._queueLen() === 0, Hd._queueLen());
// 見込み（同じ種類の平均）より長くかかった 1 枚の分だけは越えうる（最大 1.2 − 見込み）。越えたフレームの数と最大を出す
ok(`pump(3) stays in 3 ms (max ${maxPump.toFixed(2)} ms, ${overFrames}/${frames} frames over by a mis-estimated bake)`, maxPump <= 3.5 && overFrames <= frames * 0.1, { maxPump, overFrames, frames });
// 見込みが当たっている絵（同じ時間の絵）だけなら、1 フレームも越えない
for (let i = 0; i < 40; i++) { Hd.def('hd:prop:t_even_' + i, () => { spend(0.7); return fakeSheet(8, 8); }); }
Hd.now('hd:prop:t_even_0');
for (let i = 1; i < 40; i++) Hd.want('hd:prop:t_even_' + i, null, 0);
for (let i = 0; i < 10; i++) { let left = 5; Hd.schedule({ done: false, step(ms) { const use = Math.min(ms, left); spend(use); left -= use; if (left <= 1e-9) this.done = true; } }, 1); }
let max2 = 0, fr2 = 0;
while (Hd._queueLen() && fr2 < 400) { const t = T; Hd.pump(3); max2 = Math.max(max2, T - t); fr2++; }
ok(`pump(3) never over 3 ms when estimates hold (max ${max2.toFixed(2)} ms over ${fr2} frames)`, max2 <= 3 + 1e-9 && fr2 > 10, max2);
ok('all small bakes cached', Array.from({ length: 60 }, (_, i) => Hd.ready('hd:fx:t_small_' + i)).every(Boolean));
Hd._clock = realClock;
// 本当の時計でも（参考。OS と GC の揺れを含む）
for (let i = 0; i < 30; i++) { let left = 6; Hd.schedule({ done: false, step(ms) { const use = Math.min(ms - 0.05, left); busy(Math.max(0, use)); left -= use; if (left <= 0.01) this.done = true; } }, 0); }
const real = [];
while (Hd._queueLen()) { const t = Hd._now(); Hd.pump(3); real.push(Hd._now() - t); }
real.sort((a, b) => a - b);
ok(`real clock: median pump ${real[real.length >> 1].toFixed(2)} ms ≤ 3`, real[real.length >> 1] <= 3.05, real.slice(-3));
// 見込みが予算を超える絵は、そのフレームの最初にだけ（飢えない）
Hd.def('hd:fx:t_big', () => { busy(5); return fakeSheet(8, 8); });
Hd.now('hd:fx:t_big'); Hd.forget('hd:fx:t_big');
Hd.want('hd:fx:t_big', null, 0);
for (let i = 0; i < 60 && !Hd.ready('hd:fx:t_big'); i++) Hd.pump(3);
ok('over-budget factory still gets baked (starvation guard) and is counted', Hd.ready('hd:fx:t_big') && Hd.stats().over >= 1);

section('cache limits, LRU, pin');
Hd._clearQueue();
// 魔物とボス（組 beasts = 30 MB）: 4 MB の絵を 12 枚
const big = () => fakeSheet(1024, 1024, 1);   // 4 MB
for (let i = 0; i < 12; i++) Hd.def('hd:mon:t_big_' + i, big);
Hd.now('hd:mon:t_big_0');
Hd.pin('hd:mon:t_big_0');
for (let i = 1; i < 12; i++) Hd.now('hd:mon:t_big_' + i);
const beastBytes = (Hd.stats().byKind.mon || 0) + (Hd.stats().byKind.boss || 0);
ok(`mon+boss bytes within 30 MB (${(beastBytes / MB).toFixed(1)} MB)`, beastBytes <= 30 * MB, beastBytes / MB);
ok('pinned key survives LRU', Hd.ready('hd:mon:t_big_0'));
ok('oldest unpinned evicted first', !Hd.ready('hd:mon:t_big_1') && Hd.ready('hd:mon:t_big_11'));
Hd.get('hd:mon:t_big_7'); // 使ったので後ろへ
Hd.def('hd:boss:t_big_b', big); Hd.now('hd:boss:t_big_b');
ok('recently used survives, boss shares the group', Hd.ready('hd:mon:t_big_7') && Hd.ready('hd:boss:t_big_b'));
Hd.unpin('hd:mon:t_big_0');
for (let i = 0; i < 6; i++) { Hd.def('hd:boss:t_big_c' + i, big); Hd.now('hd:boss:t_big_c' + i); }
ok('after unpin it can be evicted', !Hd.ready('hd:mon:t_big_0'));
Hd.pin('hd:mon:t_big_3'); Hd.pin('hd:mon:t_big_3'); Hd.unpin('hd:mon:t_big_3');
ok('pin counts (2 pins need 2 unpins)', Hd.pinned('hd:mon:t_big_3'));
Hd.unpin('hd:mon:t_big_3');
// 1 枚で組の上限を超える絵も入る（入れた物は捨てない）
Hd.def('hd:face:t_huge', () => fakeSheet(2048, 2048, 1)); // 16 MB > face 10 MB
ok('a single sheet over its limit is still kept', Hd.now('hd:face:t_huge') && Hd.ready('hd:face:t_huge'));
// people（field + btl）30 MB
for (let i = 0; i < 10; i++) { Hd.def('hd:field:t_p' + i, big); Hd.def('hd:btl:t_p' + i + ':sword', big); Hd.now('hd:field:t_p' + i); Hd.now('hd:btl:t_p' + i + ':sword'); }
const people = (Hd.stats().byKind.field || 0) + (Hd.stats().byKind.btl || 0);
ok(`field+btl within 30 MB (${(people / MB).toFixed(1)})`, people <= 30 * MB);
// 合計: track の分も入れて 150 MB
Hd.track('chunk', 'map1', 120 * MB);
const st = Hd.stats();
ok(`total bytes within 150 MB with tracked chunks (${(st.bytes / MB).toFixed(1)} MB)`, st.bytes <= 150 * MB || st.mine <= 16 * MB + 1, st.bytes / MB);
ok('tracked bytes appear in byKind.chunk', st.byKind.chunk === 120 * MB);
Hd.track('chunk', 'map1', null);
ok('track(kind, id, null) removes', !Hd.stats().byKind.chunk);

section('stats');
const s2 = Hd.stats();
ok('stats is K.hdStats', R.Contract.check('hdStats', s2).ok, R.Contract.check('hdStats', s2).errors);
ok('bakedMs is {kind: [avg, max]}', Object.values(s2.bakedMs).every((v) => Array.isArray(v) && v.length === 2 && v[0] <= v[1] + 1e-9), s2.bakedMs);
ok('bytes = width × height × 4', Hd._bytesOf(fakeSheet(10, 20, 3)) === 10 * 20 * 4 * 3 && Hd._bytesOf({ frames: [{ c: fakeCanvas(10, 10) }, { c: null }] }) === 400);
ok('shared canvas counted once', (() => { const c = fakeCanvas(10, 10); return Hd._bytesOf({ frames: [{ c }, { c }] }) === 400; })());

section('quality');
R.Settings.set('fx', 'high'); Hd.autoQuality(null);
ok('quality high', Hd.quality() === 'high');
R.Settings.set('fx', 'low');
ok('quality follows fx setting', Hd.quality() === 'low');
R.Settings.set('fx', 'high'); Hd.autoQuality('low');
ok('auto low wins over high, setting unchanged', Hd.quality() === 'low' && R.Settings.get('fx') === 'high');
R.Settings.set('fx', 'off');
ok('off wins over auto low', Hd.quality() === 'off');
R.Settings.set('fx', 'high'); Hd.autoQuality(null);

section('draw');
const log = [];
const g = { globalAlpha: 1, drawImage(...a) { log.push(['draw', ...a.slice(1)]); }, save() { log.push(['save']); }, restore() { log.push(['restore']); }, translate(x, y) { log.push(['tr', x, y]); }, scale(x, y) { log.push(['sc', x, y]); } };
const fr = { c: fakeCanvas(20, 30), ox: 10, oy: 28 };
Hd.draw(g, fr, 100.4, 50.6);
ok('draw rounds and puts (ox, oy) on the point', JSON.stringify(log[0]) === JSON.stringify(['draw', 90, 23]), log[0]);
log.length = 0; Hd.draw(g, fr, 100, 50, { flip: true });
ok('flip mirrors around the point', log.some((l) => l[0] === 'tr' && l[1] === 100 && l[2] === 50) && log.some((l) => l[0] === 'sc' && l[1] === -1) && log.some((l) => l[0] === 'draw' && l[1] === -10 && l[2] === -28), log);
log.length = 0; Hd.draw(g, fr, 100, 50, { alpha: 0.5 });
ok('alpha restored after draw', g.globalAlpha === 1);
log.length = 0; Hd.draw(g, { frames: [fr, { c: fakeCanvas(4, 4), ox: 0, oy: 0 }] }, 10, 10, { i: 1 });
ok('draw a Sheet picks frame i', JSON.stringify(log[0]) === JSON.stringify(['draw', 10, 10]), log);
ok('draw(null) is a no-op', (Hd.draw(g, null, 0, 0), true));
const sh = { frames: [0, 1, 2, 3].map(() => ({ c: fakeCanvas(2, 2), ox: 0, oy: 0 })), poses: { walk: [1, 2, 3] }, fps: { walk: 10 } };
ok('frameAt walks the pose by time', Hd.frameAt(sh, 'walk', 0) === sh.frames[1] && Hd.frameAt(sh, 'walk', 150) === sh.frames[2] && Hd.frameAt(sh, 'walk', 250) === sh.frames[3]);

done('test_render');
