#!/usr/bin/env node
// Render the code-only art prototype (design/art_proto/code/index.html) headless.
//   node tools/art_code_shot.js <view> <out.png> [query]
'use strict';
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const [view, out, q] = process.argv.slice(2);
  const b = await playwright.chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  page.on('console', (m) => console.log('[' + m.type() + ']', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.stack || e));
  const t0 = Date.now();
  await page.goto('file://' + path.join(ROOT, 'design/art_proto/code/index.html') + '?view=' + view + (q ? '&' + q : ''));
  await page.waitForFunction(() => document.title === 'done' || document.title === 'err', null, { timeout: 120000 });
  await page.locator('#screen').screenshot({ path: out });
  console.log('→', out, (Date.now() - t0) + 'ms');
  await b.close();
})();
