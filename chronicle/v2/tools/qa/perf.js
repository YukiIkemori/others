#!/usr/bin/env node
// 性能の測定（骨組み。P0 は CORE、P1 から QA が台本を足す。V2_PLAN §2.10「測り方」）
//
//   node v2/tools/qa/perf.js [--cpu 1,4] [--runs 3] [--only stub_walk] [--no-save]
//
// Playwright の Chromium で dev.html を開き、CDP の Emulation.setCPUThrottlingRate（1 と 4）で台本を流す。
// 台本ごとに 3 回の中央値を v2/design/perf/<日付>.json に残し、前のファイルより 20% 悪くなった項目を一覧に出す。
// 台本の形（SCRIPTS に足す）:
//   {id, desc, query: 'fixture=<状態>' | 'scene=<場面>', frames: 600,
//    run: async (page, h) => {…}}     h = {press(btn, ms), hold(btn, ms), eval(js), wait(ms)}
// 1 回の測りで取る値（ページの中で）: R.Engine.frameStats()（平均・p95・最大・33 ms を超えたフレーム）と R.Hd.stats()（焼いた絵の量・列）。
// ヘッドレスの数字は実機と違う（実機はオーナーの端末で、§7 の 9）。
'use strict';
const path = require('path');
const fs = require('fs');
const { serve } = require('../shot.js');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';

const V2 = path.resolve(__dirname, '..', '..');
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyZ', b: 'KeyX', y: 'KeyC', dash: 'ShiftLeft' };

// ---------------------------------------------------------------- 台本（QA が P1 で足す: 町を歩く・ワールドを走る・暗がり・術の戦闘・メニュー・出入り 10 回）
const SCRIPTS = [
  {
    id: 'town_walk', desc: '町（ファロス、灯り 10 以上）を 600 フレームほど歩く', query: 'fixture=content_p_pharos', frames: 600,
    async run(page, h) { for (let i = 0; i < 3; i++) { await h.hold('right', 1500); await h.hold('down', 800); await h.hold('left', 1500); await h.hold('up', 800); } },
  },
  {
    id: 'world_run', desc: 'ワールドを走る（ダッシュ、焼けていないチャンクが出ないか）', query: 'fixture=content_p_world_pharos', frames: 600,
    async run(page, h) { await page.keyboard.down('ShiftLeft'); for (let i = 0; i < 3; i++) { await h.hold('up', 1800); await h.hold('left', 1800); await h.hold('down', 1800); await h.hold('right', 1800); } await page.keyboard.up('ShiftLeft'); },
  },
  {
    id: 'dark_forest', desc: '迷いの森 2 階の暗がりを歩く', query: 'fixture=content_f_verda_2_dark', frames: 600,
    async run(page, h) { for (let i = 0; i < 3; i++) { await h.hold('down', 1200); await h.hold('up', 1200); await h.hold('left', 900); await h.hold('right', 900); } },
  },
  {
    id: 'battle_spell', desc: '効果の多い術の戦闘（BSCENE の見本、術の詠唱と当たり）', query: 'scene=bscene_spell', frames: 600,
    async run(page, h) { await h.wait(9000); },
  },
  {
    id: 'battle_boss', desc: 'ボスの戦闘（根食らい、入力待ちと A の連打）', query: 'scene=battle_b_rooteater', frames: 600,
    async run(page, h) { for (let i = 0; i < 40; i++) { await h.press('a'); await h.wait(150); } },
  },
  {
    id: 'menu', desc: 'メニューの開け閉め 10 回（ファロス）', query: 'fixture=content_p_pharos', frames: 300,
    async run(page, h) { await h.wait(800); for (let i = 0; i < 10; i++) { await h.press('y'); await h.wait(300); await h.press('b'); await h.wait(300); } },
  },
  {
    id: 'map_enter', desc: 'マップの出入り 10 回（ファロス ⇄ 潮風亭）', query: 'fixture=content_p_pharos', frames: 600,
    async run(page, h) {
      await h.wait(800);
      for (let i = 0; i < 10; i++) {
        const t0 = Date.now();
        await h.eval(`RPG.Field.enter(${i % 2 ? "'pharos', 'warp'" : "'pharos_tavern', 'door'"})`);
        await page.waitForFunction("RPG.Engine.fade.a < 0.01 && !RPG.Field._s.entering", null, { timeout: 10000 });
        (h.enterMs = h.enterMs || []).push(await h.eval('RPG.Field._s.stat.enterMs || 0'));
        void t0;
      }
    },
  },
];

function arg(k, d) { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; }
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

async function measure(browser, base, sc, cpu) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${base}dev.html?${sc.query}`);
  await page.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 20000 });
  await page.waitForTimeout(500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.evaluate(() => window.RPG.Engine.resetStats());
  const h = {
    wait: (ms) => page.waitForTimeout(ms),
    eval: (js) => page.evaluate(js),
    press: async (b, ms) => { await page.keyboard.down(KEY[b]); await page.waitForTimeout(ms || 60); await page.keyboard.up(KEY[b]); await page.waitForTimeout(80); },
    hold: async (b, ms) => { await page.keyboard.down(KEY[b]); await page.waitForTimeout(ms); await page.keyboard.up(KEY[b]); },
  };
  const t0 = Date.now();
  await sc.run(page, h);
  const enterMs = h.enterMs ? h.enterMs.slice().sort((a, b) => a - b)[Math.floor(h.enterMs.length / 2)] : null;
  const r = await page.evaluate(() => {
    const R = window.RPG;
    return { frame: R.Engine.frameStats(), hd: R.Hd && R.Hd.stats ? R.Hd.stats() : null, stubs: R.Stubs.report().length };
  });
  await ctx.close();
  return { enterMs, ms: Date.now() - t0, avg: r.frame.avg, p95: r.frame.p95, max: r.frame.max, long: r.frame.long, frames: r.frame.n, hdBytes: r.hd ? r.hd.bytes : 0, errors };
}

async function main() {
  const cpus = String(arg('--cpu', '1,4')).split(',').map(Number);
  const runs = +arg('--runs', 3);
  const only = arg('--only', null);
  const dist = path.join(V2, 'dist');
  if (!fs.existsSync(path.join(dist, 'dev.html'))) { console.error('build first: node v2/tools/build.js'); process.exit(2); }
  const srv = await serve(dist);
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await playwright.chromium.launch();
  const out = { date: new Date().toISOString(), runs, cpus, results: {} };
  let errs = 0;
  for (const sc of SCRIPTS.filter((s) => !only || only.split(',').includes(s.id))) {
    for (const cpu of cpus) {
      const rs = [];
      for (let i = 0; i < runs; i++) rs.push(await measure(browser, base, sc, cpu));
      errs += rs.reduce((s, r) => s + r.errors.length, 0);
      const key = `${sc.id}@cpu${cpu}`;
      out.results[key] = { desc: sc.desc, avg: median(rs.map((r) => r.avg)), p95: median(rs.map((r) => r.p95)), max: median(rs.map((r) => r.max)), long: median(rs.map((r) => r.long)), hdBytes: median(rs.map((r) => r.hdBytes)), enterMs: median(rs.map((r) => r.enterMs || 0)) };
      const x = out.results[key];
      console.log(`${key.padEnd(22)} avg ${x.avg.toFixed(2)} ms  p95 ${x.p95.toFixed(2)}  max ${x.max.toFixed(1)}  long(>33ms) ${x.long}  hd ${(x.hdBytes / 1048576).toFixed(1)} MB${x.enterMs ? '  enter ' + x.enterMs.toFixed(0) + ' ms' : ''}`);
    }
  }
  await browser.close();
  srv.close();
  // 前の日と比べる（20% 以上悪くなった項目）
  const dir = path.join(V2, 'design', 'perf');
  fs.mkdirSync(dir, { recursive: true });
  const prev = fs.readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop();
  if (prev) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, prev), 'utf8'));
    for (const k of Object.keys(out.results)) {
      const a = p.results && p.results[k], b = out.results[k];
      if (!a) continue;
      for (const m of ['avg', 'p95']) if (a[m] > 0 && b[m] > a[m] * 1.2) console.log(`WORSE ${k} ${m}: ${a[m].toFixed(2)} → ${b[m].toFixed(2)} ms (vs ${prev})`);
    }
  }
  if (!process.argv.includes('--no-save')) {
    const f = path.join(dir, out.date.slice(0, 10) + '.json');
    fs.writeFileSync(f, JSON.stringify(out, null, 1) + '\n');
    console.log('→ ' + path.relative(process.cwd(), f));
  }
  if (errs) { console.log(`${errs} page error(s)`); process.exitCode = 1; }
}

module.exports = { SCRIPTS };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
