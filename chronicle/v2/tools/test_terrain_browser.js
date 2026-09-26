#!/usr/bin/env node
// TERRAIN: ブラウザのテスト（canvas で焼く）。V2_PLAN §4.4 の TERRAIN の行:
//   素材の境（dual grid の 16 通り）、チャンクの境で模様がずれない、Job.step が 3 ms を超えない、チャンク 1 つの焼き時間（§2.10）、
//   dirty で 1 チャンクだけ焼き直る、物の meta（solid・soft・light）、宝箱と床の色の差、見つける前の隠し通路は周りの壁と同じ画素
//   node v2/tools/test_terrain_browser.js [--no-build] [--cpu4]
// 一覧表も撮る: v2/design/shots/terrain/dualgrid.png・props.png（撮ったら Read で見る）。性能の数字は最後に JSON で出す（G1 の報告）。
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');
const { MAPS, THEMES9 } = require('./test_terrain_maps');

const args = process.argv.slice(2);
const OUT = path.join(B.V2, 'design', 'shots', 'terrain');

(async () => {
  if (!args.includes('--no-build')) require('child_process').execSync('node ' + path.join(B.V2, 'tools', 'build.js'), { stdio: 'ignore' });
  const S = await B.start();
  const P = await B.open(S, 'dev.html');
  const page = P.page;
  process.on('exit', () => { if (process.exitCode && P.errors.length) console.log('page errors:\n' + P.errors.slice(0, 5).join('\n')); });
  await page.evaluate((maps) => { for (const k of Object.keys(maps)) RPG.DB.maps[maps[k].id] = maps[k]; window.__M = maps; }, MAPS);
  // ページの中の小道具
  await page.evaluate(`
    window.__bake = (map, cx, cy, o) => { const j = RPG.Terrain.bakeChunk(map, cx, cy, o); let n = 0; while (!j.done && n++ < 100000) j.step(o && o.stepMs || 3); return j; };
    window.__px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    window.__cmp = (a, ax, ay, b, bx, by, w, h) => {   // a の (ax, ay) と b の (bx, by) から w × h を比べる → {max, over8}
      const A = a.getContext('2d').getImageData(ax, ay, w, h).data, Bd = b.getContext('2d').getImageData(bx, by, w, h).data;
      let max = 0, over = 0;
      for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - Bd[i]), Math.abs(A[i + 1] - Bd[i + 1]), Math.abs(A[i + 2] - Bd[i + 2]), Math.abs(A[i + 3] - Bd[i + 3])); if (d > max) max = d; if (d > 8) over++; }
      return { max, over: over / (A.length / 4) };
    };
    window.__lum = (c, x, y, w, h, alphaOnly) => { const d = c.getContext('2d').getImageData(x, y, w, h).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (alphaOnly && d[i + 3] < 200) continue; s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++; } return n ? s / n : 0; };
  `);

  section('dual grid（16 通り × 素材の組）');
  const dg = await page.evaluate(() => {
    const T = RPG.Terrain, pairs = [['dirt', 'grass'], ['sand', 'water'], ['cave_floor', 'wall_cave'], ['grass', 'cobble'], ['moss_earth', 'forest_dark'], ['stone_floor', 'carpet']];
    const t = 32, out = { bad: [] };
    const c = T._u.canvas(16 * (t + 8) + 8, pairs.length * (t + 8) + 8), g = c.getContext('2d');
    g.fillStyle = '#16141e'; g.fillRect(0, 0, c.width, c.height);
    pairs.forEach(([a, b], row) => {
      for (let combo = 0; combo < 16; combo++) {
        const px = T._dgSample(a, b, combo, t), img = g.createImageData(t, t);
        new Uint32Array(img.data.buffer).set(px);
        g.putImageData(img, 8 + combo * (t + 8), 8 + row * (t + 8));
        // 角の近くの画素は、その角の素材の 1 枚の画素と同じ色の系統（上の素材の 1 枚に一致するか）
        const top = T._rank(b) > T._rank(a) ? b : a, sh = T._sheet(top, t);
        for (const [x, y, bit] of [[2, 2, 1], [29, 2, 2], [2, 29, 4], [29, 29, 8]]) {
          const want = !!(combo & bit) === (top === b);
          const wx = t / 2 + x, wy = t / 2 + y, sp = sh.px[(wy % sh.S) * sh.S + (wx % sh.S)];
          const got = px[y * t + x] === sp || px[y * t + x] === T._shade(sp, T._matInfo(top).rim || 0);
          if (got !== want && !(T._matInfo(top).edge !== 'hard' && (x === 2 || x === 29))) { /* やわらかい境の角は揺らぎの内側 */ }
          if (got !== want) out.bad.push([a, b, combo, x, y]);
        }
      }
    });
    out.url = c.toDataURL();
    return out;
  });
  ok('6 組 × 16 通り: 角の近くは角の素材（上の素材の 1 枚の画素そのもの）', dg.bad.length === 0, dg.bad.slice(0, 6));
  require('fs').mkdirSync(OUT, { recursive: true });
  require('fs').writeFileSync(path.join(OUT, 'dualgrid.png'), Buffer.from(dg.url.split(',')[1], 'base64'));

  section('チャンクの境（格子を半分ずらして焼いても同じ画素）');
  for (const [name, cx, cy] of [['harbor', 1, 0], ['forest_dungeon', 1, 1], ['cave', 1, 1], ['world', 1, 0], ['treetop', 1, 0]]) {
    for (const lit of [false, true]) {
      const r = await page.evaluate(([id, cx, cy, lit]) => {
        const T = RPG.Terrain, map = RPG.DB.maps[id], o = { tile: 32, tier: 0, noLight: !lit, state: {} };
        const pw = T.prewarm(map, { tile: 32 }); while (!pw.done) pw.step(50);
        const S = 256;
        const a = __bake(map, cx, cy, o).result, b = __bake(map, cx + 1, cy, o).result, c = __bake(map, cx + 1, cy + 1, o).result, d = __bake(map, cx, cy + 1, o).result;
        const h = __bake(map, cx, cy, Object.assign({ shift: [S / 2, 0] }, o)).result, v = __bake(map, cx, cy, Object.assign({ shift: [0, S / 2] }, o)).result;
        const res = {
          hL: __cmp(h.base, 0, 0, a.base, S / 2, 0, S / 2, S), hR: __cmp(h.base, S / 2, 0, b.base, 0, 0, S / 2, S),
          vT: __cmp(v.base, 0, 0, a.base, 0, S / 2, S, S / 2), vB: __cmp(v.base, 0, S / 2, d.base, 0, 0, S, S / 2),
        };
        if (a.over && h.over && b.over) { res.oL = __cmp(h.over, 0, 0, a.over, S / 2, 0, S / 2, S); res.oR = __cmp(h.over, S / 2, 0, b.over, 0, 0, S / 2, S); }
        return res;
      }, [MAPS[name].id, cx, cy, lit]);
      const worst = Math.max(...Object.values(r).map((q) => q.over));
      if (!lit) ok(`${name}: 地面・面・物（光の地図の前）の境がつながる（8 を超える差の画素 ${(worst * 100).toFixed(3)}%）`, worst < 0.002, r);
      else ok(`${name}: 光の地図まで焼いても境がつながる（8 を超える差の画素 ${(worst * 100).toFixed(3)}%）`, worst < 0.01, r);
    }
  }

  section('見つける前の隠し通路は周りの壁と同じ画素（check_secrets）');
  {
    const r = await page.evaluate(() => {
      const T = RPG.Terrain, base = RPG.DB.maps.tt_lighthouse;
      const plain = JSON.parse(JSON.stringify(base)); plain.id = 'tt_lighthouse_plain'; plain.rows = plain.rows.map((row) => row.replace('S', 'W'));
      const sx = 15, sy = 5, cx = Math.floor(sx / 8), cy = Math.floor(sy / 8), o = { tile: 32, tier: 0, state: { secrets: [] } };
      const a = __bake(base, cx, cy, o).result, b = __bake(plain, cx, cy, o).result;
      const same = __cmp(a.base, 0, 0, b.base, 0, 0, 256, 256);
      const f = __bake(base, cx, cy, Object.assign({}, o, { state: { secrets: ['15,5'] } })).result;
      const cell = __cmp(f.base, (sx % 8) * 32, (sy % 8) * 32, a.base, (sx % 8) * 32, (sy % 8) * 32, 32, 32);
      const sheet = RPG.Hd.now('hd:secret:wall_stone', { floor: 'stone_floor', tile: 32 });
      return { same, cell, sheet: !!sheet && RPG.Contract.check('sheet', sheet).ok };
    });
    ok('見つける前: 隠し通路のマップと、ただの壁のマップが同じ画素', r.same.max === 0, r.same);
    ok('見つけた後: そのマスは床の絵に変わる', r.cell.over > 0.3, r.cell);
    ok('hd:secret:<壁> が K.sheet', r.sheet);
  }

  section('dirty で 1 チャンクだけ焼き直る');
  {
    const r = await page.evaluate(() => {
      const T = RPG.Terrain, map = RPG.DB.maps.tt_forest, ch = map.objects.find((o) => o.id === 'v_c1');
      const cx = Math.floor(ch.x / 8), cy = Math.floor(ch.y / 8), o = { tile: 32, tier: 0, state: { chests: [] } };
      const before = {}, after = {};
      for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) before[x + ',' + y] = __bake(map, x, y, o).result;
      const list = T.dirty(map, ch.x, ch.y);
      const o2 = { tile: 32, tier: 0, state: { chests: ['v_c1'] } };
      let changed = [];
      for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) { after[x + ',' + y] = __bake(map, x, y, o2).result; if (__cmp(before[x + ',' + y].base, 0, 0, after[x + ',' + y].base, 0, 0, 256, 256).max > 0) changed.push(x + ',' + y); }
      const p0 = before[cx + ',' + cy].props.find((p) => p.id === 'v_c1'), p1 = after[cx + ',' + cy].props.find((p) => p.id === 'v_c1');
      T.takeDirty(map.id);
      return { list, changed, cx, cy, f0: p0 && p0.frame, f1: p1 && p1.frame };
    });
    ok('dirty が返すのは宝箱のチャンク 1 つ', r.list.length === 1 && r.list[0][0] === r.cx && r.list[0][1] === r.cy, r.list);
    ok('状態を変えて全部焼き直すと、画素が変わるのはそのチャンクだけ', r.changed.length <= 1 && (r.changed.length === 0 || r.changed[0] === r.cx + ',' + r.cy), r.changed);
    ok('宝箱の絵のコマ closed → open', r.f0 === 'closed' && r.f1 === 'open', [r.f0, r.f1]);
  }

  section('物の絵と meta');
  {
    const r = await page.evaluate(() => {
      const C = RPG.Contract, out = { bad: [], black: [], poses: [], light: [], n: 0 };
      const ids = Object.keys(RPG.DB.props);
      const W = 12, cell = 104, c = RPG.Terrain._u.canvas(W * cell, Math.ceil(ids.length / W) * cell * 1), g = c.getContext('2d');
      g.fillStyle = '#3a3848'; g.fillRect(0, 0, c.width, c.height);
      ids.forEach((id, i) => {
        const sh = RPG.Hd.now('hd:prop:' + id, {});
        out.n++;
        if (!sh || !C.check('sheet', sh).ok) { out.bad.push(id); return; }
        const meta = RPG.DB.props[id];
        for (const f of meta.frames || []) if (!sh.poses[f]) out.poses.push(id + ':' + f);
        if (meta.light && !(sh.anchors && sh.anchors.light) && !['chest', 'spring', 'waylamp', 'brazier'].includes(id)) out.light.push(id);
        for (const fr of sh.frames) { const d = fr.c.getContext('2d').getImageData(0, 0, fr.c.width, fr.c.height).data; for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 0 && d[k] + d[k + 1] + d[k + 2] < 3) { out.black.push(id); break; } }
        // 一覧表（コマを横に並べる）
        const x0 = (i % W) * cell, y0 = Math.floor(i / W) * cell;
        sh.frames.slice(0, 4).forEach((fr, k) => { const sc = sh.frames.length > 1 ? 0.5 : 1; const bx = x0 + 8 + k * 24; if (sh.frames.length > 1) g.drawImage(fr.c, bx, y0 + 90 - fr.c.height * sc, fr.c.width * sc, fr.c.height * sc); else g.drawImage(fr.c, x0 + cell / 2 - fr.ox, y0 + 92 - fr.oy); });
        g.fillStyle = '#e8e0d0'; g.font = '10px sans-serif'; g.fillText(id, x0 + 4, y0 + 102);
      });
      out.url = c.toDataURL();
      return out;
    });
    ok(`物の絵 ${r.n} 種がすべて K.sheet`, r.bad.length === 0, r.bad);
    ok('meta.frames の名前が全部 poses にある', r.poses.length === 0, r.poses);
    ok('灯りを持つ物は anchors.light（芯の位置）を持つ', r.light.length === 0, r.light);
    ok('純粋な黒 #000 の画素なし', r.black.length === 0, r.black);
    require('fs').writeFileSync(path.join(OUT, 'props.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  }
  {
    const r = await page.evaluate(() => {
      const k = RPG.Terrain.building({ type: 'building', id: 'tb', x: 0, y: 0, w: 7, h: 5, wall: 2, roof: 'thatch', mat: 'log', door: { x: 3, y: 4 }, windows: 2, sign: 'inn' });
      const sh = RPG.Hd.now(k, { tile: 32 });
      return { ok: RPG.Contract.check('sheet', sh).ok, door: sh.meta.door, emit: sh.meta.emit.map((e) => e.kind), w: sh.frames[0].c.width, h: sh.frames[0].c.height, ox: sh.frames[0].ox, oy: sh.frames[0].oy };
    });
    ok('建物の絵は K.sheet、描く点 = 敷地の左下、窓・開いた戸口・灯り・看板の位置', r.ok && r.oy === r.h - 2 && r.emit.includes('win') && r.emit.includes('door') && r.emit.includes('lamp') && r.emit.includes('sign') && r.door, r);
  }

  section('宝箱と床の色の差（WORLD_REDESIGN §6.3: どの床の上でも見分けられる）');
  {
    const r = await page.evaluate(() => {
      const T = RPG.Terrain, map = RPG.DB.maps.tt_chests, out = [];
      const o = { tile: 32, tier: 0, state: { chests: map.opened } };
      const amb = T.ambient(map, 0).ambient;
      const sh = RPG.Hd.now('hd:prop:chest', { amb }), fr = sh.frames[sh.poses.closed[0]];
      const chestLum = __lum(fr.c, 0, 0, fr.c.width, fr.c.height, true);
      map.floors.forEach((f, i) => {
        const x0 = 1 + (i % 4) * 7, y0 = 1 + Math.floor(i / 4) * 5, cx = Math.floor((x0 + 3) / 8), cy = Math.floor((y0 + 3) / 8);
        const res = __bake(map, cx, cy, o).result;
        const fx = (x0 + 1) * 32 - res.x, fy = (y0 + 2) * 32 - res.y;   // 箱の下の床（2 マス）
        const floorLum = __lum(res.base, Math.max(0, fx), Math.max(0, fy + 6), 64, 20);
        out.push({ f, chest: +chestLum.toFixed(3), floor: +floorLum.toFixed(3), diff: +(chestLum - floorLum).toFixed(3) });
      });
      return out;
    });
    for (const q of r) ok(`${q.f}: 宝箱 ${q.chest} − 床 ${q.floor} = ${q.diff} ≧ 0.08`, q.diff >= 0.08, q);
  }

  section('明るさ（MODERN_UI §4.2: 焼いたチャンクの平均輝度 0.12 以上）');
  const lum = {};
  for (const th of THEMES9) {
    const v = await page.evaluate((id) => {
      const T = RPG.Terrain, map = RPG.DB.maps[id]; let s = 0, n = 0;
      for (let cy = 0; cy < Math.ceil(map.h / 8); cy++) for (let cx = 0; cx < Math.ceil(map.w / 8); cx++) { const r = __bake(map, cx, cy, { tile: 32, tier: 0, state: { lamps: map.lamps || {} } }).result; s += __lum(r.base, 0, 0, 256, 256); n++; }
      return s / n;
    }, MAPS[th].id);
    lum[th] = +v.toFixed(3);
    ok(`${th}: 平均輝度 ${v.toFixed(3)} ≧ 0.12`, v >= 0.12, v);
  }

  section('契約の形（結果・光・発光・物）');
  {
    const r = await page.evaluate(() => {
      const C = RPG.Contract, map = RPG.DB.maps.tt_forest, j = __bake(map, 1, 1, { tile: 32, tier: 0 }), res = j.result;
      return { job: C.check('bakeJob', j).ok, res: C.check('chunkResult', res).ok, errs: C.check('chunkResult', res).errors, lights: res.lights.every((l) => C.check('light', l).ok),
        glows: res.glows.every((g) => typeof g.x === 'number' && typeof g.r === 'number' && g.color), props: res.props.every((p) => RPG.Hd.has(p.key) && p.opts && p.frame),
        size: res.base.width === 256 && res.base.height === 256, thumb: (() => { const c = RPG.Terrain.worldThumb(0); return c ? [c.width, c.height] : null; })() };
    });
    ok('Job は K.bakeJob、result は K.chunkResult', r.job && r.res, r.errs);
    ok('lights は K.light、glows は R.Light.glow の形、props は登録のある絵・opts・frame', r.lights && r.glows && r.props);
    ok('base は CHUNK × tile 四方', r.size);
    ok('worldThumb: ワールドの 1 マス 3 px の一枚絵', r.thumb && r.thumb[0] % 3 === 0 && r.thumb[1] % 3 === 0, r.thumb);
  }

  section('性能（§2.10: 1 チャンク 4 ms／CPU 4 倍 16 ms、Job.step ≦ 3 ms）');
  const perf = {};
  for (const rate of args.includes('--cpu4') ? [1, 4] : [1]) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const r = await page.evaluate((ids) => {
      const T = RPG.Terrain, bakes = [], steps = [], prewarm = {};
      for (const id of ids) {
        const map = RPG.DB.maps[id];
        const t0 = performance.now(), pw = T.prewarm(map, { tile: 32 }); while (!pw.done) pw.step(3); prewarm[id] = performance.now() - t0;
        // 1 回目で形（境・影）を作り、2 回目を測る（素材のタイルと境目のかたちは先に焼いてある状態、§2.10）
        for (let pass = 0; pass < 2; pass++) for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 5; cx++) {
          const j = T.bakeChunk(map, cx, cy, { tile: 32, tier: 0, state: { lamps: map.lamps || {} } });
          while (!j.done) { const s0 = performance.now(); j.step(3); if (pass) steps.push(performance.now() - s0); }
          if (pass) bakes.push(j.ms);
        }
      }
      const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
      return { chunkMed: q(bakes, 0.5), chunkP90: q(bakes, 0.9), chunkMax: Math.max(...bakes), stepMed: q(steps, 0.5), stepP99: q(steps, 0.99), stepMax: Math.max(...steps), prewarm };
    }, THEMES9.map((t) => MAPS[t].id));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    perf['cpu' + rate] = r;
    const budget = rate === 1 ? 4 : 16;
    console.log(`  CPU ×${rate}: chunk median ${r.chunkMed.toFixed(2)} ms  p90 ${r.chunkP90.toFixed(2)}  max ${r.chunkMax.toFixed(2)}  | step median ${r.stepMed.toFixed(2)}  p99 ${r.stepP99.toFixed(2)}  max ${r.stepMax.toFixed(2)}`);
    ok(`CPU ×${rate}: チャンク 1 つの焼き時間の中央値 ${r.chunkMed.toFixed(2)} ms ≦ 予算の 2 倍 ${budget * 2} ms（G1 の関門）`, r.chunkMed <= budget * 2, r);
    if (rate === 1) {
      ok(`Job.step(3) の 99% が 3 ms 以内（${r.stepP99.toFixed(2)} ms）`, r.stepP99 <= 3.2, r);
      ok(`Job.step(3) の最長 ${r.stepMax.toFixed(2)} ms ≦ 5 ms（共有の機械の揺れを含む）`, r.stepMax <= 5, r);
    }
  }

  const errs = P.errors.concat(await page.evaluate('RPG.loadErrors.filter((e) => !/duplicate/.test(e))'));
  ok('コンソールのエラー・外への通信なし', errs.length === 0, errs.slice(0, 5));
  await B.stop(S);
  console.log('\nPERF ' + JSON.stringify({ lum, perf }));
  done('test_terrain_browser');
})().catch((e) => { console.error(e); process.exitCode = 1; });
