#!/usr/bin/env node
// Battle visual gallery (test tool): opens the battle harness, pauses the engine
// and steps it frame by frame, pasting chosen frames into one contact sheet.
//   node tools/fixtures/battle/gallery.js <harness.html> <out.png> <script.json>
// script.json: {cols, scale, setup:"js", steps:[{eval:"js"} | {frames:n} | {shot:"label"} | {keys:"a,b"}]}
'use strict';
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

(async () => {
  const [html, out, scriptFile] = process.argv.slice(2);
  const script = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 700 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + html);
  await page.waitForTimeout(1200);
  const cols = script.cols || 4, scale = script.scale || 1;
  await page.evaluate(({ cols, scale }) => {
    window.__sheet = { cv: document.createElement('canvas'), n: 0, cols, scale, labels: [] };
    window.__step = async (n, keys) => {
      const R = window.RPG;
      for (let i = 0; i < n; i++) {
        if (keys) for (const k in keys) R.Input._set(k, keys[k] > 0), keys[k]--;
        R.Engine.step();
        await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setTimeout(r, 0));
      }
      R.Engine.render();
    };
    window.__shot = (label) => {
      const s = window.__sheet, src = document.getElementById('screen');
      const w = 256 * s.scale, h = 224 * s.scale;
      const i = s.n++;
      const rows = Math.ceil(s.n / s.cols);
      const old = s.cv.width ? s.cv : null;
      const nc = document.createElement('canvas');
      nc.width = s.cols * (w + 4); nc.height = rows * (h + 16);
      const c = nc.getContext('2d');
      c.fillStyle = '#333'; c.fillRect(0, 0, nc.width, nc.height);
      if (old) c.drawImage(old, 0, 0);
      c.imageSmoothingEnabled = false;
      const x = (i % s.cols) * (w + 4), y = Math.floor(i / s.cols) * (h + 16);
      c.drawImage(src, 0, 0, src.width, src.height, x, y + 14, w, h);
      c.fillStyle = '#fff'; c.font = '11px monospace'; c.fillText(label, x + 2, y + 11);
      s.cv = nc;
    };
  }, { cols, scale });
  if (script.setup) await page.evaluate(script.setup);
  await page.evaluate(() => { window.RPG.Engine.paused = true; });
  for (const st of script.steps) {
    if (st.eval) { try { await page.evaluate(st.eval); } catch (e) { errors.push('eval: ' + e.message); } }
    if (st.keys && !st.frames) st.frames = 3;
    if (st.frames) await page.evaluate(([n, k]) => window.__step(n, k), [st.frames, st.keys ? Object.fromEntries(st.keys.split(',').map((k) => [k, 2])) : null]);
    if (st.shot) await page.evaluate((l) => window.__shot(l), st.shot);
  }
  const data = await page.evaluate(() => window.__sheet.cv.toDataURL('image/png'));
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  const le = await page.evaluate(() => window.RPG.loadErrors || []);
  for (const e of le.concat(errors)) console.log('[error]', e.slice(0, 400));
  console.log('sheet →', out);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
