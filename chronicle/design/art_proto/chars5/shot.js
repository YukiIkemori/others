#!/usr/bin/env node
// Render chars5 sheets / composites headless.
//   node design/art_proto/chars5/shot.js                 → everything
//   node design/art_proto/chars5/shot.js sheet:v1 battle:v2 compare stats
'use strict';
const path = require('path'), fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const DIR = __dirname, OUT = path.join(DIR, 'out');
fs.mkdirSync(OUT, { recursive: true });
const VS = ['v1', 'v2', 'v3', 'v4', 'v5'];
const ALL = [].concat(VS.map((v) => 'sheet:' + v), VS.map((v) => 'sheet1:' + v), ['compare', 'compare4', 'stats'], VS.map((v) => 'battle:' + v), VS.map((v) => 'town:' + v));
(async () => {
  const list = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
  const b = await playwright.chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  for (const item of list) {
    const [kind, v] = item.split(':');
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text()); });
    page.on('pageerror', (e) => console.log('[pageerror]', e.stack || e));
    let q, out;
    if (kind === 'sheet') { q = `view=sheet&v=${v}&z=6`; out = `${v}_sheet_6x.png`; }
    else if (kind === 'sheet1') { q = `view=sheet&v=${v}&z=1`; out = `${v}_sheet_1x.png`; }
    else if (kind === 'compare') { q = 'view=compare&z=1'; out = 'compare_1x.png'; }
    else if (kind === 'compare4') { q = 'view=compare&z=4'; out = 'compare_4x.png'; }
    else if (kind === 'stats') { q = 'view=stats'; }
    else if (kind === 'preview') { const [, vv, ks, z] = item.split(':'); q = `view=preview&v=${vv}&k=${ks || 'down0,side0,up0,battle0'}&z=${z || 8}`; out = `_preview_${vv}.png`; }
    else if (kind === 'battle') { q = `view=battle&v=${v}`; out = `${v}_battle.png`; }
    else if (kind === 'town') { q = `view=town&v=${v}`; out = `${v}_town.png`; }
    await page.goto('file://' + path.join(DIR, 'index.html') + '?' + q);
    await page.waitForFunction(() => document.title === 'done' || document.title === 'err', null, { timeout: 300000 });
    if (kind === 'stats') { const s = await page.evaluate(() => document.body.getAttribute('data-stats')); fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(JSON.parse(s), null, 1)); console.log(s); }
    else { const d = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png')); fs.writeFileSync(path.join(OUT, out), Buffer.from(d.split(',')[1], 'base64')); console.log((await page.title()) === 'done' ? '→' : 'ERR', out); }
    await page.close();
  }
  await b.close();
})();
