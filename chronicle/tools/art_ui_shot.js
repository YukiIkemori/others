#!/usr/bin/env node
// Render the modern-UI mock screens (design/art_proto/ui/index.html) headless at native size.
//   node tools/art_ui_shot.js                 → every view in VIEWS
//   node tools/art_ui_shot.js battle town:tall  → only these (":tall" = phone portrait layout)
// Output: design/art_proto/ui/out/<view>[_tall].png   (1920×1080, portrait 1080×2338)
'use strict';
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..');
const VIEWS = ['title', 'town', 'field', 'dungeon', 'dialogue', 'menu', 'equip', 'shop', 'battle', 'battle_tech', 'glimmer', 'victory', 'kit', 'chars',
  'town:tall', 'dialogue:tall', 'battle:tall', 'menu:tall'];
(async () => {
  const want = process.argv.slice(2);
  const list = want.length ? want : VIEWS;
  const b = await playwright.chromium.launch();
  for (const item of list) {
    const [view, lay] = item.split(':'), layout = lay || 'wide';
    const page = await (await b.newContext({ viewport: layout === 'tall' ? { width: 1080, height: 2338 } : { width: 1920, height: 1080 } })).newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text()); });
    page.on('pageerror', (e) => console.log('[pageerror]', e.stack || e));
    const t0 = Date.now();
    await page.goto('file://' + path.join(ROOT, 'design/art_proto/ui/index.html') + '?view=' + view + '&layout=' + layout);
    await page.waitForFunction(() => document.title === 'done' || document.title === 'err', null, { timeout: 300000 });
    const out = path.join(ROOT, 'design/art_proto/ui/out', view + (layout === 'tall' ? '_tall' : '') + '.png');
    await page.locator('#screen').screenshot({ path: out });
    console.log((await page.title()) === 'done' ? '→' : 'ERR', out, (Date.now() - t0) + 'ms');
    await page.close();
  }
  await b.close();
})();
