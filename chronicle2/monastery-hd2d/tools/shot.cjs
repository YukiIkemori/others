// node tools/shot.cjs "<url or path?query>" out.png [--w 1280] [--h 720] [--wait 1500] [--eval "js"] [--keys "ArrowUp:800,ArrowLeft:400"] [--canvas "css selector"] [--page 1]
// Opens a page in headless Chromium (software WebGL), waits for window.HD_READY === true, and saves the WebGL canvas
// as a PNG at its own resolution. Prints console errors and page errors.
// It reads the canvas (largest <canvas>, or --canvas) right after the page's next animation frame; an ordinary page
// screenshot hangs on a software-rendered WebGL loop, so use --page 1 only for pages without a running WebGL loop.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
const a = process.argv.slice(2); const url0 = a[0], out = a[1];
const opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const W = +opt('w', 1280), H = +opt('h', 720), wait = +opt('wait', 1500);
const url = /^https?:/.test(url0) ? url0 : 'http://localhost:' + (process.env.PORT || 8765) + '/' + url0.replace(/^\//, '');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 600)); });
p.on('pageerror', e => console.log('[pageerror]', String(e.stack || e).slice(0, 900)));
await p.goto(url, { waitUntil: 'load' });
try { await p.waitForFunction('window.HD_READY === true', null, { timeout: +opt('ready', 90000) }); } catch (e) { console.log('[warn] HD_READY not set within timeout'); }
const keys = opt('keys', '');
if (keys) for (const kv of keys.split(',')) { const [k, ms] = kv.split(':'); await p.keyboard.down(k); await p.waitForTimeout(+ms); await p.keyboard.up(k); }
const ev = opt('eval', ''); if (ev) { const r = await p.evaluate(ev); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
await p.waitForTimeout(wait);
if (opt('page', '')) { await p.screenshot({ path: out }); }
else {
  const data = await p.evaluate(sel => new Promise(res => { const cs = sel ? [document.querySelector(sel)] : [...document.querySelectorAll('canvas')].sort((x, y) => y.width * y.height - x.width * x.height);
    const c = cs[0]; if (!c) return res(null); let done = false; const grab = () => { if (!done) { done = true; res(c.toDataURL('image/png')); } }; requestAnimationFrame(grab); setTimeout(grab, 120000); }), opt('canvas', ''));
  if (!data) { console.log('[warn] no canvas found'); } else fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
}
console.log('saved', out); await b.close();
})();
