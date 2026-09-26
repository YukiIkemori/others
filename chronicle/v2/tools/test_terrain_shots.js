#!/usr/bin/env node
// TERRAIN: 見本の画面を撮る（V2_PLAN §4.4 の TERRAIN の行「テーマ 7 × 1 画面、宝箱を 8 種の床に並べた見本（開けた箱も）、泉・燭台（消えた／ともった）・灯籠」）
//   node v2/tools/test_terrain_shots.js [--only harbor,cave] [--phone] [--tile 24|32|40] [--no-build]
// dev.html を開き、tools/test_terrain_maps.js のマップをページに入れ、チャンクを焼いて「FIELD が描く順」（base → 物を y の順 → over → 発光 →
// R.Post.frame）で並べる見本の場面を積んで撮る。撮った PNG は v2/design/shots/terrain/。必ず Read で見る（§2.9）。
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { MAPS, THEMES9 } = require('./test_terrain_maps');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const only = opt('--only', null);
const phone = args.includes('--phone');
const tile = +opt('--tile', 32);
const OUT = path.join(B.V2, 'design', 'shots', 'terrain');

// ページの中の見本の場面（FIELD の描く順の真似）。window.__tt(mapJson, {cam:[x, y], tile, state, label}) → 焼いた時間など
const PAGE = `
window.__tt = function (map, o) {
  const R = RPG, T = R.Terrain;
  R.DB.maps[map.id] = map;
  const tile = o.tile || 32, st = o.state || {};
  const t0 = performance.now();
  const pw = T.prewarm(map, { tile, state: st }); while (!pw.done) pw.step(50);
  const prewarmMs = performance.now() - t0;
  const W = R.W, H = R.H, cam = o.cam || [Math.max(0, (map.w * tile - W) / 2), Math.max(0, (map.h * tile - H) / 2)];
  const S = T.CHUNK * tile, res = [], stats = [];
  for (let cy = Math.floor(cam[1] / S); cy <= Math.floor((cam[1] + H) / S); cy++)
    for (let cx = Math.floor(cam[0] / S); cx <= Math.floor((cam[0] + W) / S); cx++) {
      const job = T.bakeChunk(map, cx, cy, { tile, tier: o.tier || 0, state: st });
      while (!job.done) job.step(3);
      res.push(job.result); stats.push({ cx, cy, ms: +job.ms.toFixed(2), steps: job.steps, maxStep: +job.maxStep.toFixed(2), prof: job.prof });
    }
  const mood = T.ambient(map, o.tier || 0).mood;
  const props = [].concat(...res.map((r) => r.props)).sort((a, b) => a.sortY - b.sortY);
  const glows = [].concat(...res.map((r) => r.glows));
  const scene = {
    id: 'terrain_preview', opaque: true, enter() {}, exit() {}, update() {},
    draw(g) {
      g.fillStyle = '#070812'; g.fillRect(0, 0, W, H);
      const ox = Math.round(cam[0]), oy = Math.round(cam[1]);
      for (const r of res) if (r.base) g.drawImage(r.base, r.x - ox, r.y - oy);
      for (const p of props) {
        const sh = R.Hd.get(p.key, p.opts) || R.Hd.now(p.key, p.opts);
        if (!sh) continue;
        const pose = sh.poses[p.frame] || sh.poses.default || [0];
        const fps = (sh.fps && sh.fps[p.frame]) || 0;
        const fi = fps ? pose[Math.floor(R.Engine.time / 1000 * fps) % pose.length] : pose[0];
        R.Hd.draw(g, sh.frames[fi], p.x - ox, p.y - oy);
      }
      for (const r of res) if (r.over) g.drawImage(r.over, r.x - ox, r.y - oy);
      if (o.lantern) R.Light.ring(g, o.lantern[0] - ox, o.lantern[1] - oy, 88, R.Engine.time, { mood });
      for (const q of glows) R.Light.glow(g, q.x - ox, q.y - oy, q, R.Engine.time);
      R.Post.frame(g, { mood });
      if (o.label) R.UIK && R.UIK.text ? R.UIK.text(g, o.label, 12, H - 26, { size: 13, color: '#e8e0d0', shadow: true }) : 0;
    },
  };
  // 場面の積み上げには触れず、全部の上に描く重ね描きで見せる（タイトルなどの流れを動かさない）
  R.Engine.overlay('terrain_preview', (g) => { R.Gfx.reset(); scene.draw(g); }, 9999);
  const lights = res.reduce((n, r) => n + r.lights.length, 0);
  return { prewarmMs: +prewarmMs.toFixed(1), chunks: stats, props: props.length, glows: glows.length, lights };
};
`;

(async () => {
  if (!args.includes('--no-build')) require('child_process').execSync('node ' + path.join(B.V2, 'tools', 'build.js'), { stdio: 'ignore' });
  const S = await B.start();
  const P = await B.open(S, 'dev.html', phone ? { phone: true } : {});
  await P.page.evaluate(PAGE);
  const list = [];
  for (const th of THEMES9) list.push({ name: th, map: MAPS[th], o: { tile, label: `テーマ ${th}（tile ${tile}）`, lantern: null } });
  list.push({ name: 'chests', map: MAPS.chests, o: { tile, cam: [0, 0], state: { chests: MAPS.chests.opened }, label: '宝箱 × 8 種の床（左: 閉じた、中: 開けた、右: レア）' } });
  list.push({ name: 'lights', map: MAPS.lights, o: { tile, cam: [0, -60], state: { lamps: MAPS.lights.lamps }, label: '泉・燭台（消えた／ともった）・灯籠（消えた／ともった）・レバー・松明' } });
  if (MAPS.world.lamps) list.find((e) => e.name === 'world').o.state = { lamps: MAPS.world.lamps };
  const out = [];
  for (const e of list) {
    if (only && !only.split(',').includes(e.name)) continue;
    const r = await P.page.evaluate(([m, o]) => window.__tt(m, o), [e.map, e.o]);
    await P.page.evaluate('RPG.Engine.setTime ? RPG.Engine.setTime(1200) : 0');
    await P.page.waitForTimeout(250);
    const file = path.join(OUT, `${e.name}${phone ? '_phone' : ''}${tile !== 32 ? '_t' + tile : ''}.png`);
    await B.shot(P.page, file);
    const ms = r.chunks.map((c) => c.ms), max = r.chunks.map((c) => c.maxStep);
    console.log(`${e.name.padEnd(15)} prewarm ${String(r.prewarmMs).padStart(7)} ms  chunks ${r.chunks.length}  bake avg ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2)} max ${Math.max(...ms).toFixed(2)} ms  step max ${Math.max(...max).toFixed(2)} ms  props ${r.props} glows ${r.glows} lights ${r.lights} → ${path.relative(process.cwd(), file)}`);
    if (args.includes('--prof')) { const P2 = {}; for (const c of r.chunks) for (const k of Object.keys(c.prof)) P2[k] = (P2[k] || 0) + c.prof[k] / r.chunks.length; console.log('   phases avg ms: ' + Object.keys(P2).map((k) => k + ' ' + P2[k].toFixed(2)).join(', ')); }
    out.push(Object.assign({ name: e.name }, r));
  }
  const errs = P.errors.concat(await P.page.evaluate('RPG.loadErrors.filter((e) => !/duplicate/.test(e))'));
  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exitCode = 1; }
  await B.stop(S);
})().catch((e) => { console.error(e); process.exit(1); });
