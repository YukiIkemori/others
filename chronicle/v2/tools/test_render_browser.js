// RENDER のブラウザのテスト（V2_PLAN §4.4 の RENDER の行）: 同じキーで同じ画素・純黒なし・ctx.filter を使わない・ぼかし・色調・
// 光の地図・光の輪・仕上げ（効果 高/低/切・明るさ）・効果の自動の下げ・本物の焼く列の予算、仕上げと光の地図の時間（参考）
//   node v2/tools/build.js && node v2/tools/test_render_browser.js
'use strict';
const { ok, section, done } = require('./lib/testkit');
const B = require('./lib/browser');

(async () => {
  const S = await B.start();
  try {
    const P = await B.open(S, 'dev.html');
    const ev = (js) => P.page.evaluate(js);
    // タイトルの流れを止めて、場面を空にする
    await ev(`(() => { const never = () => new Promise(() => {}); RPG.Screens.open = never; RPG.Flow.title = never; RPG.Flow.newGame = never; RPG.Engine.clear(); RPG.Engine.fade.a = 0; })()`);
    // ctx.filter の書き込みを数える（使ってはいけない）
    await ev(`(() => { const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'filter'); window.__filterSets = 0;
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', { get() { return d.get.call(this); }, set(v) { if (v !== 'none') window.__filterSets++; d.set.call(this, v); }, configurable: true }); })()`);

    section('same key → same pixels (RZ)');
    const px = await ev(`(() => {
      const R = RPG, Hd = R.Hd, RZ = Hd.RZ;
      const hash = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h + ':' + c.width + 'x' + c.height; };
      const build = (key) => () => {
        const r = RZ.rng(RZ.seed(key)), B = new RZ.Builder();
        const m = RZ.mat({ keys: ['#241a30', '#4a3a60', '#7a6a98', '#b0a0d0'], tex: 1.5 });
        for (let i = 0; i < 6; i++) B.ell((r() - 0.5) * 20, -10 - r() * 20, 3 + r() * 5, 3 + r() * 5, m, i * 0.1);
        const fr = RZ.frame(RZ.render(B, { scale: 1, tones: Hd.STYLE.tones, olMix: Hd.STYLE.olMix }));
        return { frames: [fr], poses: { idle: [0] }, anchors: {}, w: fr.c.width, h: fr.c.height };
      };
      Hd.def('hd:prop:t_same', build('hd:prop:t_same'));
      const a = hash(Hd.now('hd:prop:t_same').frames[0].c);
      Hd.forget('hd:prop:t_same');
      const b = hash(Hd.now('hd:prop:t_same').frames[0].c);
      Hd.def('hd:prop:t_same2', build('hd:prop:t_same'));
      const c = hash(Hd.now('hd:prop:t_same2').frames[0].c);
      Hd.def('hd:prop:t_other', build('hd:prop:t_other'));
      const d = hash(Hd.now('hd:prop:t_other').frames[0].c);
      const img = Hd.now('hd:prop:t_same').frames[0].c;
      const data = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
      let black = 0, opaque = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) { opaque++; if (data[i] + data[i + 1] + data[i + 2] < 3) black++; }
      return { a, b, c, d, black, opaque, check: R.Contract.check('sheet', Hd.now('hd:prop:t_same')) };
    })()`);
    ok('rebake after forget gives the same pixels', px.a === px.b, px);
    ok('same builder + same seed under another key gives the same pixels', px.a === px.c);
    ok('a different seed gives different pixels', px.a !== px.d);
    ok('RZ output has no pure black', px.black === 0 && px.opaque > 50, px);
    ok('sheet made with RZ.frame is K.sheet', px.check.ok, px.check.errors);

    section('blur / grade');
    const bl = await ev(`(() => {
      const Hd = RPG.Hd, c = Hd.RZ.canvas(41, 41), x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(18, 18, 5, 5);
      const b = Hd.blur(c, 3), d = b.getContext('2d').getImageData(0, 0, 41, 41).data;
      const at = (px, py) => d[(py * 41 + px) * 4 + 3];
      const big = Hd.RZ.canvas(200, 100); big.getContext('2d').fillStyle = '#a0c0e0'; big.getContext('2d').fillRect(0, 0, 200, 100);
      const bb = Hd.blur(big, 20), dd = bb.getContext('2d').getImageData(100, 50, 1, 1).data;
      // 色調
      const s = Hd.RZ.canvas(8, 8), sx = s.getContext('2d'); sx.fillStyle = '#806040'; sx.fillRect(0, 0, 8, 8); sx.fillStyle = 'rgb(1,1,1)'; sx.fillRect(0, 0, 2, 2);
      const g1 = Hd.grade(s, 'town_night'), g2 = Hd.grade(s, 'town_night'), g3 = Hd.grade(s, 'cave');
      const gd = g1.getContext('2d').getImageData(0, 0, 8, 8).data;
      return { center: at(20, 20), near: at(24, 20), far: at(29, 20), corner: at(0, 0), size: [b.width, b.height], new: b !== c, bigKeep: [dd[0], dd[1], dd[2], dd[3]],
        gSame: g1 === g2, gDiff: g1 !== g3, gChanged: gd[4 * 20] !== 0x80 || gd[4 * 20 + 1] !== 0x60, gBlack: gd[0] + gd[1] + gd[2] };
    })()`);
    ok('blur spreads a point (center > near > far, corner 0)', bl.center > bl.near && bl.near > bl.far && bl.corner === 0, bl);
    ok('blur returns a new canvas of the same size', bl.new && bl.size[0] === 41 && bl.size[1] === 41);
    ok('blur of a flat colour keeps the colour (large r, downscaled path)', Math.abs(bl.bigKeep[0] - 0xa0) <= 2 && Math.abs(bl.bigKeep[2] - 0xe0) <= 2 && bl.bigKeep[3] === 255, bl.bigKeep);
    ok('grade is cached per canvas and mood', bl.gSame && bl.gDiff);
    ok('grade changes colours and lifts near-black (no pure black)', bl.gChanged && bl.gBlack >= 3, bl);

    section('light map');
    const lm = await ev(`(() => {
      const R = RPG, L = R.Light;
      const m = L.map([0, 0, 200, 100], { mood: 'town_night', lights: [{ x: 150, y: 50, r: 40, color: '#ffc27a', k: 0.9 }] });
      const d = m.getContext('2d').getImageData(0, 0, m.width, m.height).data;
      const at = (x, y) => { const q = (Math.floor(y / 2) * m.width + Math.floor(x / 2)) * 4; return [d[q], d[q + 1], d[q + 2]]; };
      const amb = R.Hd._rgb(R.Hd.mood('town_night').ambient);
      // compose を白い canvas に
      const c = R.Hd.RZ.canvas(200, 100), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 200, 100);
      x.fillStyle = 'rgb(160,160,160)'; x.fillRect(0, 0, 200, 100);
      L.compose(x, [0, 0, 200, 100], { mood: 'cave', lights: [{ x: 60, y: 60, r: 30, color: '#ffc27a', k: 0.9 }], moon: [[0, 0, 200, 10]] });
      const cd = x.getImageData(0, 0, 200, 100).data;
      const cat = (px, py) => { const q = (py * 200 + px) * 4; return [cd[q], cd[q + 1], cd[q + 2]]; };
      const caveAmb = R.Hd._rgb(R.Hd.mood('cave').ambient).map((v) => Math.round(v * 160 / 255));
      return { far: at(10, 90), center: at(150, 50), amb, size: [m.width, m.height], cFar: cat(180, 99), cMoon: cat(180, 3), cLight: cat(72, 60), caveAmb };
    })()`);
    ok('light map is half resolution by default', lm.size[0] === 100 && lm.size[1] === 50, lm.size);
    ok('light map = ambient away from lights', lm.far.every((v, i) => Math.abs(v - lm.amb[i]) <= 2), lm);
    ok('light map is warm and bright at a light', lm.center[0] > lm.amb[0] + 80 && lm.center[0] > lm.center[2], lm.center);
    ok('compose multiplies: grey × ambient far from lights', lm.cFar.every((v, i) => Math.abs(v - lm.caveAmb[i]) <= 3), [lm.cFar, lm.caveAmb]);
    ok('compose: moon rects lighter than ambient', lm.cMoon[2] > lm.cFar[2] || lm.cMoon[0] > lm.cFar[0], lm.cMoon);
    ok('compose: lit ground warm (red > blue)', lm.cLight[0] > lm.cLight[2] && lm.cLight[0] > lm.cFar[0], lm.cLight);

    section('ring / glow / quality');
    const rg = await ev(`(() => {
      const R = RPG, L = R.Light;
      const mk = () => { const c = R.Hd.RZ.canvas(200, 200), x = c.getContext('2d'); x.fillStyle = 'rgb(60,56,100)'; x.fillRect(0, 0, 200, 200); return x; };
      const px = (x, a, b) => Array.from(x.getImageData(a, b, 1, 1).data.slice(0, 3));
      const out = {};
      for (const q of ['high', 'low', 'off']) {
        R.Settings.set('fx', q);
        const x = mk(); L.ring(x, 100, 100, 88, 1000, { mood: 'town_night' }); out['ring_' + q] = px(x, 100, 100);
        const y = mk(); L.glow(y, 100, 100, { core: 6 }, 1000); out['glowCore_' + q] = px(y, 100, 100); out['glowHalo_' + q] = px(y, 112, 100);
      }
      R.Settings.set('fx', 'high');
      // ゆらぎ: 時刻で変わる（高）・reduceMotion で止まる
      const f1 = L._flick(10, 10, 0, 0.08, 3), f2 = L._flick(10, 10, 170, 0.08, 3);
      R.Settings.set('reduceMotion', true); const f3 = L._flick(10, 10, 170, 0.08, 3); R.Settings.set('reduceMotion', false);
      return Object.assign(out, { f1, f2, f3 });
    })()`);
    ok('ring brightens warmly on high', rg.ring_high[0] > 90 && rg.ring_high[0] > rg.ring_high[2] * 0.9, rg.ring_high);
    ok('ring on low too', rg.ring_low[0] > 90);
    ok('ring off with fx off (plain ambient)', rg.ring_off.join() === '60,56,100', rg.ring_off);
    ok('glow core near white', rg.glowCore_high.every((v) => v > 200), rg.glowCore_high);
    ok('glow halo on high, none with fx off', rg.glowHalo_high[0] > 60 + 10 && rg.glowHalo_off.join() === '60,56,100', [rg.glowHalo_high, rg.glowHalo_off]);
    ok('flicker moves with time, stops with reduceMotion', rg.f1 !== rg.f2 && rg.f3 === 1, rg);

    section('post');
    const po = await ev(`(async () => {
      const R = RPG, cv = R.Gfx.canvas, g = R.Gfx.g;
      const fill = () => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgb(120,110,160)'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = 'rgb(250,240,220)'; g.fillRect(cv.width / 2 - 20, cv.height / 2 - 20, 40, 40); g.restore(); };
      const at = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
      R.Engine.stop && R.Engine.stop();
      const out = { w: cv.width, h: cv.height };
      R.Settings.set('fx', 'off'); R.Settings.set('brightness', 1);
      fill(); R.Post.frame(g, { mood: 'town_night' }); out.off = [at(5, 5), at(cv.width / 2 - 60, cv.height / 2)];
      R.Settings.set('brightness', 0.85); fill(); R.Post.frame(g, { mood: 'town_night' }); out.dim = at(cv.width / 2 - 60, cv.height / 2);
      R.Settings.set('brightness', 1.25); fill(); R.Post.frame(g, { mood: 'town_night' }); out.bright = at(cv.width / 2 - 60, cv.height / 2);
      R.Settings.set('brightness', 1);
      R.Settings.set('fx', 'low'); fill(); R.Post.frame(g, { mood: 'town_night' }); out.low = [at(5, 5), at(cv.width / 2 - 60, cv.height / 2), at(cv.width / 2, cv.height / 2)];
      R.Settings.set('fx', 'high'); fill(); R.Post.frame(g, { mood: 'town_night' }); out.high = [at(5, 5), at(cv.width / 2 - 60, cv.height / 2), at(cv.width / 2 + 24, cv.height / 2)];
      fill(); R.Post.frame(g, { mood: 'town_night', bloom: 0 }); out.highNoBloom = at(cv.width / 2 + 24, cv.height / 2);
      // 時間（参考）: 60 回の平均
      const T = (fn, n) => { fn(); g.getImageData(0, 0, 1, 1); const t = performance.now(); for (let i = 0; i < n; i++) fn(); g.getImageData(0, 0, 1, 1); return (performance.now() - t) / n; };
      // 基準: 画面全体に半分の解像度の絵を最近傍で 1 回置く（フィールドの 1 フレームの下地と同じ仕事）。ヘッドレスは GPU が無い（SwiftShader）ので ms は実機より大きい
      const half = R.Hd.RZ.canvas(cv.width / 2, cv.height / 2); half.getContext('2d').fillStyle = '#446'; half.getContext('2d').fillRect(0, 0, half.width, half.height);
      out.pass = T(() => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(half, 0, 0, cv.width, cv.height); g.restore(); }, 30);
      const chunk = R.Hd.RZ.canvas(256, 256), cx = chunk.getContext('2d');
      const cl = []; for (let i = 0; i < 4; i++) cl.push({ x: 40 + i * 60, y: 60 + (i % 2) * 120, r: 110, color: '#ffc27a', k: 0.9 });
      out.composeChunk = T(() => R.Light.compose(cx, [0, 0, 256, 256], { mood: 'town_night', lights: cl }), 30);
      out.postHigh = T(() => R.Post.frame(g, { mood: 'town_night' }), 60);
      R.Settings.set('fx', 'low'); out.postLow = T(() => R.Post.frame(g, { mood: 'town_night' }), 60); R.Settings.set('fx', 'high');
      const lights = []; for (let i = 0; i < 10; i++) lights.push({ x: 40 + i * 90, y: 100 + (i % 3) * 140, r: 110, color: '#ffc27a', k: 0.9 });
      out.compose10 = T(() => R.Light.compose(g, [0, 0, R.W, R.H], { mood: 'town_night', lights }), 60);
      out.glow30 = T(() => { for (let i = 0; i < 30; i++) R.Light.glow(g, 20 + i * 30, 200, { core: 6 }, 1000); }, 30);
      out.ring = T(() => R.Light.ring(g, 480, 270, 88, 1000), 60);
      out.budget = R.Hd.BUDGET.postMs;
      R.Engine.start && R.Engine.start(cv);
      return out;
    })()`);
    ok('fx off: post leaves the frame (no vignette)', po.off[0].join() === '120,110,160' && po.off[1].join() === '120,110,160', po.off);
    ok('brightness 0.85 darker, 1.25 brighter (applied in post)', po.dim[0] < 120 && po.bright[0] > 120 && Math.abs(po.bright[0] - 150) <= 3 && Math.abs(po.dim[0] - 102) <= 3, [po.dim, po.bright]);
    ok('fx low: vignette (corner darker than middle)', po.low[0][0] < po.low[1][0] * 0.6, po.low);
    ok('fx high: bloom brightens around a bright patch', po.high[2][0] + po.high[2][1] + po.high[2][2] > po.highNoBloom[0] + po.highNoBloom[1] + po.highNoBloom[2], [po.high[2], po.highNoBloom]);
    ok('no ctx.filter used anywhere (blur, light, post)', (await ev('window.__filterSets')) === 0, await ev('window.__filterSets'));
    console.log(`  timings (${po.w}x${po.h}, headless SwiftShader = no GPU, ms/call): full-screen pass ${po.pass.toFixed(2)}; post high ${po.postHigh.toFixed(2)}, low ${po.postLow.toFixed(2)} (budget desk ${po.budget.desk} / phone ${po.budget.phone} on a GPU canvas);`);
    console.log(`  light map on screen (10 lights) ${po.compose10.toFixed(2)}; light map on a 256² chunk (4 lights) ${po.composeChunk.toFixed(2)}; 30 glows ${po.glow30.toFixed(2)}; ring ${po.ring.toFixed(2)}`);
    ok(`post low ≤ 1.5 full-screen passes (${(po.postLow / po.pass).toFixed(2)})`, po.postLow <= po.pass * 1.5, po);
    ok(`post high ≤ 10 full-screen passes (${(po.postHigh / po.pass).toFixed(2)}; bloom is blend-heavy on a software canvas)`, po.postHigh <= po.pass * 10, po);
    ok(`light map on a chunk ≤ 1 ms (${po.composeChunk.toFixed(2)})`, po.composeChunk <= 1, po.composeChunk);

    section('auto quality (first battle, 120 frames, avg > 14 ms → low)');
    const aq = await ev(`(async () => {
      const R = RPG; R.Settings.set('fx', 'high'); R.Hd.autoQuality(null);
      const orig = R.Engine.frameStats;
      R.Engine.frameStats = () => ({ n: 120, avg: 20, p95: 22, max: 30, long: 0 });
      R.emit('battle:start');
      const f0 = R.Engine.frame;
      await R.until(() => R.Engine.frame - f0 > 125);
      const q = R.Hd.quality(), setting = R.Settings.get('fx');
      R.emit('battle:end');
      R.Engine.frameStats = orig;
      // 2 回目の戦闘では測らない
      R.Hd.autoQuality(null); R.emit('battle:start'); R.Engine.frameStats = () => ({ n: 120, avg: 30 });
      const f1 = R.Engine.frame; await R.until(() => R.Engine.frame - f1 > 125);
      const q2 = R.Hd.quality(); R.Engine.frameStats = orig; R.emit('battle:end');
      return { q, setting, q2 };
    })()`);
    ok('slow first battle → quality low, setting untouched', aq.q === 'low' && aq.setting === 'high', aq);
    ok('only the first battle is measured', aq.q2 === 'high', aq);

    section('real bake queue in the page');
    const bq = await ev(`(async () => {
      const R = RPG, Hd = R.Hd, RZ = Hd.RZ;
      Hd._s.pumpMs.max = 0;
      const keys = [];
      for (let i = 0; i < 24; i++) {
        const key = 'hd:prop:t_q' + i; keys.push(key);
        Hd.def(key, () => { const r = RZ.rng(RZ.seed(key)), B = new RZ.Builder(), m = RZ.mat({ keys: ['#302418', '#6a5030', '#a08050'] });
          for (let k = 0; k < 4; k++) B.ell((r() - 0.5) * 16, -8 - r() * 10, 3 + r() * 4, 3 + r() * 4, m, k * 0.1);
          const f = RZ.frame(RZ.render(B, { scale: 1 })); return { frames: [f], poses: { idle: [0] }, anchors: {}, w: f.c.width, h: f.c.height }; });
        Hd.get(key);
      }
      const t0 = performance.now();
      await R.until(() => keys.every((k) => Hd.ready(k)) || performance.now() - t0 > 8000);
      const st = Hd.stats();
      return { all: keys.every((k) => Hd.ready(k)), pumpMax: st.pumpMs.max, over: st.over, baked: st.bakedMs.prop, check: R.Contract.check('hdStats', st) };
    })()`);
    ok('24 wanted sheets baked by the per-frame pump', bq.all, bq);
    ok(`pump max in the page ${bq.pumpMax.toFixed(2)} ms (≤ 3 + one mis-estimated bake)`, bq.pumpMax <= 3 + (bq.baked ? bq.baked[1] : 3), bq);
    ok('stats in the page is K.hdStats', bq.check.ok, bq.check.errors);

    ok('no page errors', P.errors.length === 0, P.errors);
    await P.close();
  } finally { await B.stop(S); }
  done('test_render_browser');
})().catch((e) => { console.error(e); process.exit(1); });
