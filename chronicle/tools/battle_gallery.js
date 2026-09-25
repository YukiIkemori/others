#!/usr/bin/env node
// Battle screen gallery (bui A3): screenshots of every battle presentation without the rest of the game.
// It builds debug_bui.html (src + tools/fixtures/bui), opens it in headless Chromium, pauses the engine and
// runs the scenarios of tools/fixtures/bui/stage.js frame by frame; every shot is the real 4× canvas (1024×896).
//
//   node tools/battle_gallery.js [--out DIR] [--only a,b,c] [--sheet] [--no-build] [--list]
//     --out DIR    where the PNGs go (default: $TMPDIR/bui_gallery)
//     --only       scenario names (see --list)
//     --sheet      also write DIR/sheet.png: every shot at 1× with its label (a contact sheet)
//     --no-build   use the existing debug_bui.html
// Exit code 1 when a scenario throws or the page logs an error.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(os.tmpdir(), 'bui_gallery')));
const ONLY = (opt('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const SHEET = argv.includes('--sheet');

(async () => {
  if (!argv.includes('--no-build')) {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--with', path.join(ROOT, 'tools', 'fixtures', 'bui')], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  const html = path.join(ROOT, 'debug_bui.html');
  const browser = await playwright.chromium.launch();
  let failed = false;
  try {
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 950 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e.stack || e).split('\n').slice(0, 4).join(' | ')));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('[console.error] ' + m.text().slice(0, 300)); });
    await page.goto('file://' + html);
    await page.waitForFunction(() => window.RPG && window.RPG.bui && window.RPG.Battle && window.RPG.Battle.Scene, null, { timeout: 15000 });
    await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => setTimeout(r, 400)); });
    const le = await page.evaluate(() => (window.RPG.loadErrors || []).map((s) => String(s).split('\n')[0]));
    for (const e of le) console.log('[loadError]', e);
    const all = await page.evaluate(() => window.RPG.bui.list());
    if (argv.includes('--list')) { console.log(all.join('\n')); return; }
    const names = ONLY.length ? ONLY : all;
    fs.mkdirSync(OUT, { recursive: true });
    const sheet = [];
    for (const name of names) {
      if (!all.includes(name)) { console.log('unknown scenario', name); failed = true; continue; }
      const t0 = Date.now();
      const shots = await page.evaluate((n) => window.RPG.bui.run(n), name);
      for (const s of shots) {
        if (s.error) { console.log(`[${name}] ERROR ${s.error.split('\n').slice(0, 5).join(' | ')}`); failed = true; continue; }
        const file = path.join(OUT, `${name}__${s.label}.png`);
        fs.writeFileSync(file, Buffer.from(s.data.split(',')[1], 'base64'));
        sheet.push({ label: `${name}/${s.label}`, data: s.data });
      }
      console.log(`${name}: ${shots.length} shot(s) ${Date.now() - t0}ms`);
    }
    if (SHEET && sheet.length) {
      const data = await page.evaluate(async (list) => {
        const cols = 4, w = 256, h = 224, lh = 14;
        const rows = Math.ceil(list.length / cols);
        const cv = document.createElement('canvas');
        cv.width = cols * (w + 4); cv.height = rows * (h + lh + 4);
        const c = cv.getContext('2d');
        c.fillStyle = '#333'; c.fillRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = true;
        for (let i = 0; i < list.length; i++) {
          const img = new Image();
          await new Promise((r) => { img.onload = r; img.src = list[i].data; });
          const x = (i % cols) * (w + 4), y = Math.floor(i / cols) * (h + lh + 4);
          c.drawImage(img, x, y + lh, w, h);
          c.fillStyle = '#fff'; c.font = '11px monospace'; c.fillText(list[i].label, x + 2, y + 11);
        }
        return cv.toDataURL('image/png');
      }, sheet);
      fs.writeFileSync(path.join(OUT, 'sheet.png'), Buffer.from(data.split(',')[1], 'base64'));
      console.log('sheet →', path.join(OUT, 'sheet.png'));
    }
    for (const e of errors) { console.log(e); failed = true; }
    console.log(`gallery → ${OUT} (${sheet.length} shots)`);
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
