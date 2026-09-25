#!/usr/bin/env node
// Headless browser driver for visual checks & smoke tests (Playwright + Chromium).
//
//   node tools/shot.js --out /tmp/x.png [options]
//
// Options (repeatable ones run in the order given):
//   --html <file>        page to load (default dist/index.html; debug.html for per-file stacks)
//   --query <qs>         appended as ?qs (e.g. "debug=1")
//   --wait <ms>          wait (default 1500 after load)
//   --eval <js>          evaluate JS in the page (await-able expression; result printed)
//   --keys <seq>         key sequence: comma separated tokens
//                          up/down/left/right/a/b/dash  press ~2 frames
//                          hold:<btn>:<ms>              hold a button
//                          wait:<ms>                    pause
//                          <btn>*<n>                    repeat n times
//   --shot <file>        take a screenshot now (canvas only)
//   --out <file>         final screenshot (canvas only)
//   --full               screenshot the whole page instead of the canvas
//   --size WxH           viewport (default 800x700)
//   --touch              emulate a touch device (portrait phone)
// Prints console errors, page errors and RPG.loadErrors. Exit code 1 if any error.
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyZ', b: 'KeyX', y: 'KeyC', l: 'KeyQ', r: 'KeyE', dash: 'ShiftLeft' };

async function main() {
  const argv = process.argv.slice(2);
  const steps = [];
  let html = path.join(ROOT, 'dist', 'index.html');
  let query = '', size = [800, 700], full = false, touch = false, out = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--html') { html = path.resolve(v); i++; }
    else if (a === '--query') { query = v; i++; }
    else if (a === '--size') { size = v.split('x').map(Number); i++; }
    else if (a === '--full') full = true;
    else if (a === '--touch') touch = true;
    else if (a === '--out') { out = v; i++; }
    else if (a === '--wait' || a === '--eval' || a === '--keys' || a === '--shot') { steps.push([a.slice(2), v]); i++; }
  }
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext(touch
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: size[0], height: size[1] } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = `[console.${m.type()}] ${m.text()}`; console.log(t); if (m.type() === 'error') errors.push(t); } });
  page.on('pageerror', (e) => { const t = `[pageerror] ${e.stack || e}`; console.log(t); errors.push(t); });
  await page.goto('file://' + html + (query ? '?' + query : ''));
  await page.waitForTimeout(1500);

  const shot = async (file) => {
    if (full) await page.screenshot({ path: file });
    else await page.locator('#screen').screenshot({ path: file });
    console.log('screenshot →', file);
  };
  for (const [kind, v] of steps) {
    if (kind === 'wait') await page.waitForTimeout(+v);
    else if (kind === 'shot') await shot(v);
    else if (kind === 'eval') {
      try {
        const r = await page.evaluate(`(async()=>{ return (${v}); })()`);
        if (r !== undefined) console.log('eval →', typeof r === 'string' ? r : JSON.stringify(r).slice(0, 4000));
      } catch (e) { console.log('[eval error]', e.message); errors.push(String(e.message)); }
    } else if (kind === 'keys') {
      for (let tok of v.split(',').map((s) => s.trim()).filter(Boolean)) {
        let n = 1;
        const m = tok.match(/^(.*)\*(\d+)$/);
        if (m) { tok = m[1]; n = +m[2]; }
        for (let k = 0; k < n; k++) {
          if (tok.startsWith('wait:')) await page.waitForTimeout(+tok.slice(5));
          else if (tok.startsWith('hold:')) {
            const [, b, ms] = tok.split(':');
            await page.keyboard.down(KEY[b]); await page.waitForTimeout(+ms); await page.keyboard.up(KEY[b]);
            await page.waitForTimeout(50);
          } else if (KEY[tok]) {
            await page.keyboard.down(KEY[tok]); await page.waitForTimeout(50); await page.keyboard.up(KEY[tok]);
            await page.waitForTimeout(90);
          } else console.log('unknown key token', tok);
        }
      }
    }
  }
  if (out) await shot(out);
  const le = await page.evaluate('(window.RPG && window.RPG.loadErrors) || []');
  for (const e of le) { console.log('[loadError]', e); errors.push(e); }
  await browser.close();
  if (errors.length) { console.log(`\n${errors.length} error(s)`); process.exitCode = 1; }
}
main().catch((e) => { console.error(e); process.exit(2); });
