const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  await p.keyboard.press('z'); await p.waitForTimeout(3500);
  const tag = process.env.TAG || 'b', map = process.env.MAP, pts = JSON.parse(process.env.PTS);
  if (map && map !== 'village') { await J(p, m => { RPG.debug.go(m, {}); }, map); await p.waitForFunction(m => __game.mapUrl.startsWith(m) && !__game.loading && !RPG.busy, map, { timeout: 120000 }); await p.waitForTimeout(4000); }
  console.log('size', await J(p, () => JSON.stringify([__game.map.w, __game.map.h, __game.hero.x | 0, __game.hero.y | 0])));
  for (const [x, y, n] of pts) { await J(p, ([x, y]) => { const g = __game; g.teleport(x, y, 'down'); g.sim(40); }, [x, y]); await p.waitForTimeout(1200); await shot('fix/' + tag + '_' + n); console.log(n, await J(p, () => JSON.stringify([__game.hero.x | 0, __game.hero.y | 0]))); }
};
