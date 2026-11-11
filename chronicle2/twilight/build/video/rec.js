const { chromium } = require('playwright'); const fs = require('fs');
// usage: PORT=8769 node rec.js legs.json outdir from to [hd=1]
// Drives the party along the planned legs with fixed 1/60 s steps; frame f (30 fps) is the state after 2*f steps.
// Every worker simulates from the start, so any range of frames can be rendered on its own (the game's randomness is seeded).
(async () => {
  const [legsF, out, from, to, hd] = process.argv.slice(2); const F0 = +from, F1 = +to, HD = hd !== '0';
  const legs = JSON.parse(fs.readFileSync(legsF, 'utf8')); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await p.goto('http://localhost:' + (process.env.PORT || 8769) + '/index.html?ui=0&keep=1&rec=1' + (HD ? '' : '&hd=0'));
  await p.waitForFunction(() => window.__game && window.__game.hero && (!new URLSearchParams(location.search).get('hd') ? window.__game.hd : true), null, { timeout: 120000 });
  await p.waitForTimeout(500);
  const plan = await p.evaluate((legs) => {
    // schedule: [kind, ...]  'wait' n frames, or a leg to run
    const S = [['wait', 96]];
    legs[0].forEach(l => S.push(['leg', ...l])); S.push(['wait', 40]); S.push(['face', 'u', 2]); S.push(['wait', 40]);
    legs[1].forEach(l => S.push(['leg', ...l])); S.push(['wait', 2]); S.push(['face', 'u', 2]); S.push(['wait', 150]);
    window.__S = S; window.__si = 0; window.__sf = 0; window.__log = [];
    const g = __game; g.teleport(959, 1609, 'up');
    return S.length;
  }, legs);
  // one video frame = 2 steps; returns false at the end of the schedule
  const advance = () => p.evaluate(() => {
    const g = __game, K = g.keys, D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], KS = ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur'];
    for (let s = 0; s < 2; s++) {
      const it = __S[__si]; if (!it) { K.clear(); g.sim(1, 1 / 60); continue; }
      K.clear();
      if (it[0] === 'wait') { if (++__sf >= it[1]) { __si++; __sf = 0; } }
      else if (it[0] === 'face') { for (const c of it[1]) K.add(c); if (++__sf >= it[2]) { __si++; __sf = 0; } }
      else {
        const [, d, tx, ty] = it, h = g.hero, v = D[d], n = Math.hypot(v[0], v[1]);
        const left = ((tx - h.x) * v[0] + (ty - h.y) * v[1]) / n;
        if (left <= 1.5 || ++__sf > 900) { __log.push([__si, Math.round(h.x), Math.round(h.y), tx, ty, __sf]); __si++; __sf = 0; s--; continue; }
        K.add('run'); for (const c of KS[d]) K.add(c);
      }
      g.sim(1, 1 / 60);
    }
    return __si < __S.length;
  });
  let f = 0, going = true;
  const W0 = Math.max(0, F0 - 10);                     // a few frames rendered before the range, so soft-followed things settle
  while (going && f < F1) {
    going = await advance();
    if (f >= W0) {
      const t0 = Date.now();
      const url = await p.evaluate(async () => { __game.step(0); await new Promise(r => requestAnimationFrame(r)); return __game.hd ? __game.hd.canvas.toDataURL('image/png') : document.querySelector('canvas').toDataURL('image/png'); });
      if (f >= F0) { fs.writeFileSync(`${out}/f${String(f).padStart(5, '0')}.png`, Buffer.from(url.split(',')[1], 'base64')); if (process.env.V) console.log(f, Date.now() - t0, 'ms'); }
    }
    f++;
  }
  console.log('frames', f, 'end of schedule', !going, JSON.stringify(await p.evaluate(() => [__log, __game.hero, __game.party.map(a => [Math.round(a.x), Math.round(a.y)])])), errs);
  await b.close();
})();
