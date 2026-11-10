// node tools/views.cjs "<query after play?>" <out prefix> name=<view> [name=<view> ...] [--eval "js"]
// One page load, many pictures; each is drawn synchronously with HD.snap (no dependence on animation-frame timing, so it
// also works on a loaded machine). Views:
//   name=x,z[,k[,row]]                     the game camera with the hero standing at x,z (k = render scale 1|1.5|2; row = facing 0..7)
//   name=f:px,py,pz,tx,ty,tz[,fov[,k]]     a free camera (position, target)
// Example: node tools/views.cjs "nopost=1&shadow=1024" shots/t gate=0,-6.2 nave=0,-41,2 top=f:0,80,22,0,0,-36,38
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const a = process.argv.slice(2); const ei = a.indexOf('--eval'); let ev = ''; if (ei >= 0) { ev = a[ei + 1]; a.splice(ei, 2); }
  const q = a[0], prefix = a[1], views = a.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 700)); });
  p.on('pageerror', e => console.log('[pageerror]', String(e.stack || e).slice(0, 900)));
  const t0 = Date.now();
  await p.goto('http://localhost:' + (process.env.PORT || 8765) + '/play?' + q, { waitUntil: 'load', timeout: 600000 });
  await p.waitForFunction('typeof HD !== "undefined" && !!HD.snap', null, { timeout: 900000 });
  await p.evaluate('HD.paused = true'); await p.waitForTimeout(500);
  console.log('built after', ((Date.now() - t0) / 1000).toFixed(0), 's');
  for (const v of views) { const i = v.indexOf('='), name = v.slice(0, i); let spec = v.slice(i + 1), o;
    if (spec.startsWith('f:')) { const n = spec.slice(2).split(',').map(Number); o = { free: n.slice(0, 6), fov: n[6] || 40, k: n[7] || 1 }; }
    else { const n = spec.split(',').map(Number); o = { at: [n[0], n[1]], k: n[2] || 1, row: n[3] === undefined ? 3 : n[3] }; }
    const t1 = Date.now(); const data = await p.evaluate(o => HD.snap(o), o);
    fs.writeFileSync(prefix + '_' + name + '.png', Buffer.from(data.split(',')[1], 'base64')); console.log('saved', prefix + '_' + name + '.png', ((Date.now() - t1) / 1000).toFixed(0) + 's'); }
  if (ev) { const r = await p.evaluate(ev); if (r !== undefined) console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r)); }
  await b.close();
})();
