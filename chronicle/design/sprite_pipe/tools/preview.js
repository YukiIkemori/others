#!/usr/bin/env node
// Composite previews: the approved UI mocks (design/art_proto/ui) with the hero swapped for the
// pipeline's sheets, rendered headless at 1920×1080.
//   node tools/preview.js [char] [view[:query] …]
//   default views: battle battle_noui glimmer victory town town_noui
// Output: out/<char>/preview/<view>.png
'use strict';
const fs = require('fs'), path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const HERE = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const char = args[0] && !args[0].includes(':') && !['battle', 'town', 'glimmer', 'victory'].some((v) => args[0].startsWith(v)) ? args.shift() : 'arun';
const views = args.length ? args : ['battle', 'battle_noui', 'glimmer', 'victory', 'town', 'town_noui'];
const od = path.join(HERE, 'out', char);
const set = (k) => ({
  png: 'data:image/png;base64,' + fs.readFileSync(path.join(od, k, `${char}_${k}.png`)).toString('base64'),
  json: JSON.parse(fs.readFileSync(path.join(od, k, `${char}_${k}.json`), 'utf8')),
});
const HERO = { battle: set('battle'), field: set('field') };
(async () => {
  fs.mkdirSync(path.join(od, 'preview'), { recursive: true });
  const b = await playwright.chromium.launch();
  for (const item of views) {
    const [v0, extra] = item.split(':');
    const noui = v0.endsWith('_noui'), view = noui ? v0.slice(0, -5) : v0;
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
    await ctx.addInitScript({ content: 'window.__HERO = ' + JSON.stringify(HERO) + ';' });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text()); });
    page.on('pageerror', (e) => console.log('[pageerror]', e.stack || e));
    const url = 'file://' + path.join(HERE, 'preview/index.html') + '?view=' + view + '&layout=wide' + (noui ? '&noui=1' : '') + (extra ? '&' + extra : '');
    await page.goto(url);
    await page.waitForFunction(() => document.title === 'done' || document.title === 'err', null, { timeout: 300000 });
    const name = v0 + (extra ? '_' + extra.replace(/[^a-z0-9]+/gi, '_') : '');
    const out = path.join(od, 'preview', name + '.png');
    await page.locator('#screen').screenshot({ path: out });
    console.log((await page.title()) === 'done' ? '→' : 'ERR', out);
    await ctx.close();
  }
  await b.close();
})();
