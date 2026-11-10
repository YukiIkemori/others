const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const errs = []; p.on('console', m => { if (m.type()==='error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:8765/index.html?ui=0&q=low');
  await p.waitForFunction(() => window.__game && window.__game.hero); await p.waitForTimeout(600);
  // 1) random walk using the engine's own stepping: count how often the hero makes no progress at all while a key is held
  const res = await p.evaluate(async () => {
    const g = __game; const dirs = [['ArrowUp'],['ArrowDown'],['ArrowLeft'],['ArrowRight'],['ArrowUp','ArrowLeft'],['ArrowUp','ArrowRight'],['ArrowDown','ArrowLeft'],['ArrowDown','ArrowRight']];
    const fire = (k, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k }));
    let stuck = 0, legs = 0, minx = 1e9, maxx = 0, miny = 1e9, maxy = 0, off = 0; const stuckAt = [];
    for (let i = 0; i < 400; i++) {
      const d = dirs[Math.floor(Math.random() * 8)]; d.forEach(k => fire(k, true));
      const x0 = g.hero.x, y0 = g.hero.y; g.step(40, 1 / 60); d.forEach(k => fire(k, false)); g.step(1, 1 / 60);
      const moved = Math.hypot(g.hero.x - x0, g.hero.y - y0); legs++;
      if (!g.walkable(g.hero.x, g.hero.y)) off++;
      if (moved < 1) { // blocked in this direction: fine if some other direction works
        let any = false;
        for (const e of dirs) { e.forEach(k => fire(k, true)); const a = g.hero.x, c = g.hero.y; g.step(6, 1 / 60); e.forEach(k => fire(k, false)); g.step(1, 1/60); if (Math.hypot(g.hero.x - a, g.hero.y - c) > 1) { any = true; break; } }
        if (!any) { stuck++; stuckAt.push([Math.round(g.hero.x), Math.round(g.hero.y)]); }
      }
      minx = Math.min(minx, g.hero.x); maxx = Math.max(maxx, g.hero.x); miny = Math.min(miny, g.hero.y); maxy = Math.max(maxy, g.hero.y);
      if (i % 50 === 49) { const pts = [[650,1100],[663,650],[985,430],[350,430],[300,720],[1030,800],[250,1100],[900,1150]]; const q = pts[(i/50|0) % pts.length]; g.teleport(q[0], q[1], 'down'); }
    }
    return { legs, stuck, stuckAt, off, range: [minx|0, maxx|0, miny|0, maxy|0] };
  });
  console.log(JSON.stringify(res), errs);
  await b.close();
})();
