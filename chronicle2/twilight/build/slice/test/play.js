// usage: node play.js url script.js   (script exports async (p, shot) => {})
const { chromium } = require('playwright');
(async () => {
  const [url, script, w = 1920, h = 1080, dsf = 1] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf });
  p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver/.test(t)) console.log('[' + m.type() + ']', t.slice(0, 400)); });
  p.on('pageerror', e => console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(0, 5).join(' | ')));
  await p.goto(url);
  await p.waitForFunction(() => window.__game && !window.__game.loading, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  const shot = n => p.screenshot({ path: '/home/user/tw/view/' + n + '.png' });
  await require(require('path').resolve(script))(p, shot);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
