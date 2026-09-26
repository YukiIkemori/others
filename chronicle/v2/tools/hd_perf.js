#!/usr/bin/env node
// 焼く時間と光・仕上げの時間（RENDER、V2_PLAN §2.10・G1）。デスクトップと CPU 4 倍遅い（CDP）で測り、R.Hd.BUDGET と比べる。
//
//   node v2/tools/hd_perf.js [--area <cast|mons|boss|bbg|terrain|props|fx|all>] [--only <部分文字列>] [--cpu 1,4] [--json <file>]
//
// - キーごと: forget して R.Hd.now の時間（1 枚の Sheet 全部）。人（btl・field）は BUDGET.charBakeMs と比べる
// - RENDER: 光の地図（画面 960×540 に灯り 10 個）・チャンク 256² の光の地図・仕上げ（高・低）・発光 30・光の輪・1/4 のぼかし（すりガラス）・空の pump
// 予算の 2 倍を超えた物に「!!」（G1 の決まり: P1 の中で作り直す）。ヘッドレスは GPU が無い（SwiftShader）ので、合成の多い物は実機より遅く出る。
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');
const { AREAS } = require('./hd_sheet');

function args(argv) {
  const o = { area: null, only: null, cpu: [1, 4], json: path.join(B.V2, 'design', 'shots', 'render', 'hd_perf.json') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--area') { o.area = v; i++; } else if (a === '--only') { o.only = v; i++; } else if (a === '--cpu') { o.cpu = v.split(',').map(Number); i++; } else if (a === '--json') { o.json = v; i++; }
  }
  return o;
}

function measure(o) {
  const R = window.RPG, Hd = R.Hd, g = R.Gfx.g, cv = R.Gfx.canvas;
  if (R.Engine.stop) R.Engine.stop();
  const T = (fn, n) => { fn(); g.getImageData(0, 0, 1, 1); const t = performance.now(); for (let i = 0; i < n; i++) fn(); g.getImageData(0, 0, 1, 1); return +((performance.now() - t) / n).toFixed(3); };
  const out = { canvas: [cv.width, cv.height], render: {}, keys: {} };
  const lights = []; for (let i = 0; i < 10; i++) lights.push({ x: 40 + i * 90, y: 100 + (i % 3) * 140, r: 110, color: '#ffc27a', k: 0.9 });
  const chunk = Hd.RZ.canvas(256, 256), cx = chunk.getContext('2d');
  const q = Hd.RZ.canvas(Math.ceil(cv.width / 4), Math.ceil(cv.height / 4));
  q.getContext('2d').drawImage(cv, 0, 0, q.width, q.height);
  out.render.lightMapScreen10 = T(() => R.Light.compose(g, [0, 0, R.W, R.H], { mood: 'town_night', lights }), 10);
  out.render.lightMapChunk = T(() => R.Light.compose(cx, [0, 0, 256, 256], { mood: 'town_night', lights: lights.slice(0, 4).map((l, i) => Object.assign({}, l, { x: 40 + i * 60, y: 128 })) }), 20);
  R.Settings.set('fx', 'high'); out.render.postHigh = T(() => R.Post.frame(g, { mood: 'town_night' }), 10);
  R.Settings.set('fx', 'low'); out.render.postLow = T(() => R.Post.frame(g, { mood: 'town_night' }), 10);
  R.Settings.set('fx', 'high');
  out.render.glow30 = T(() => { for (let i = 0; i < 30; i++) R.Light.glow(g, 20 + i * 30, 200, { core: 7 }, 1000); }, 10);
  out.render.ring = T(() => R.Light.ring(g, 480, 270, 88, 1000), 10);
  out.render.snapshotBlur = T(() => Hd.blur(q, 3), 5);
  out.render.pumpEmpty = T(() => Hd.pump(3), 50);
  let keys = [];
  for (const p of o.prefixes) keys = keys.concat(Hd.keys(p));
  if (o.only) keys = keys.filter((k) => k.indexOf(o.only) >= 0);
  for (const key of keys) {
    const opts = key.startsWith('hd:bbg:') ? { w: R.W, h: R.H } : undefined;
    Hd.forget(key);
    const t = performance.now();
    let sh = null;
    try { sh = Hd.now(key, opts); } catch (e) { sh = null; }
    out.keys[key] = { ms: +(performance.now() - t).toFixed(2), frames: sh && sh.frames ? sh.frames.length : 0, kind: Hd.kindOf(key) };
  }
  out.stats = Hd.stats();
  if (R.Engine.start) R.Engine.start(cv);
  return out;
}

if (require.main === module) {
  (async () => {
    const o = args(process.argv.slice(2));
    const prefixes = !o.area ? [] : o.area === 'all' ? [].concat(...Object.values(AREAS)) : AREAS[o.area];
    const S = await B.start();
    const all = { date: new Date().toISOString().slice(0, 10), runs: {} };
    let budget;
    try {
      for (const rate of o.cpu) {
        const P = await B.open(S, 'dev.html');
        if (rate > 1) { const cdp = await P.ctx.newCDPSession(P.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate }); }
        await P.page.evaluate(`(() => { const never = () => new Promise(() => {}); RPG.Screens.open = never; RPG.Flow.title = never; RPG.Flow.newGame = never; RPG.Engine.clear(); })()`);
        budget = await P.page.evaluate('RPG.Hd.BUDGET');
        all.runs['cpu' + rate] = await P.page.evaluate(`(${measure})(${JSON.stringify({ prefixes, only: o.only })})`);
        await P.close();
      }
    } finally { await B.stop(S); }
    const lim = (dev, b) => (b ? (dev === 'cpu1' ? b.desk : b.phone) : null);
    for (const [run, r] of Object.entries(all.runs)) {
      console.log(`\n== ${run} (canvas ${r.canvas.join('x')}, headless SwiftShader)`);
      const rb = { postHigh: budget.postMs, postLow: budget.postMs, lightMapScreen10: budget.lightMapMs, snapshotBlur: budget.snapshotMs };
      for (const [k, v] of Object.entries(r.render)) {
        const b = lim(run, rb[k]);
        console.log(`  ${k.padEnd(18)} ${String(v).padStart(8)} ms${b != null ? `   budget ${b}${v > b * 2 ? '  !! over 2×' : v > b ? '  (over)' : ''}` : ''}`);
      }
      const byKind = {};
      for (const [k, v] of Object.entries(r.keys)) (byKind[v.kind] = byKind[v.kind] || []).push([k, v]);
      for (const [kind, list] of Object.entries(byKind)) {
        const ms = list.map((x) => x[1].ms).sort((a, b) => a - b);
        const b = kind === 'btl' || kind === 'field' ? lim(run, budget.charBakeMs) : null;
        const worst = list.sort((x, y) => y[1].ms - x[1].ms)[0];
        console.log(`  bake ${kind.padEnd(6)} n=${list.length} median ${ms[ms.length >> 1]} ms, max ${worst[1].ms} ms (${worst[0]})${b ? `   budget ${b}${worst[1].ms > b * 2 ? '  !! over 2×' : ''}` : ''}`);
      }
    }
    fs.mkdirSync(path.dirname(o.json), { recursive: true });
    fs.writeFileSync(o.json, JSON.stringify(all, null, 1));
    console.log('\n→ ' + path.relative(process.cwd(), o.json));
  })().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { measure };
