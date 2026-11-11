const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const st = async tag => console.log(tag, await J(p, () => JSON.stringify({ map: __game.mapUrl, h: [Math.round(__game.hero.x), Math.round(__game.hero.y)], ui: RPG.ui.length, busy: RPG.busy, paused: __game.paused, near: __game.near, items: RPG.G.items })));
  const key = async (k, n = 1, ms = 160) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(ms); } };
  await key('z'); await p.waitForTimeout(3000);
  await J(p, () => { RPG.debug.go('abbey', { spawn: 'gate' }); }); await p.waitForFunction(() => __game.mapUrl.startsWith('abbey') && !__game.loading && !RPG.busy, null, { timeout: 90000 }); await p.waitForTimeout(4500);
  await st('abbey'); await shot('a_gate');
  const go = async (name, dx, dy, n) => { await J(p, ([name, dx, dy]) => { const g = __game, t = g.map.triggers.find(t => t.title === name || t.id === name); g.teleport(t.x + dx, t.y + dy, 'up'); g.keys.add('l'); g.sim(24); g.keys.delete('l'); g.keys.add('u'); g.sim(4); g.keys.delete('u'); g.sim(3); }, [name, dx, dy]); await p.waitForTimeout(900); await shot(n); await st(n); };
  await go('セーブ結晶', 40, 30, 'a_crystal');
  await go('祭壇', 60, 70, 'a_nave');
  await go('ch047', 80, 40, 'a_plaza');
  await go('鐘楼の扉', 50, 40, 'a_tower');
  await go('崩れた階段', 50, 10, 'a_broken');
  await J(p, () => { const g = __game, t = g.map.triggers.find(t => t.kind === 'warp'); g.teleport(t.x + 14, t.y + 8, 'left'); g.sim(3); }); await p.waitForTimeout(300); await st('at broken');
  await key('z'); await p.waitForTimeout(600); await shot('a_ask'); await key('z'); await p.waitForFunction(() => __game.mapUrl.startsWith('f01') && !__game.loading && !RPG.busy, null, { timeout: 90000 }); await p.waitForTimeout(3000); await st('ledge'); await shot('a_ledge');
  await J(p, () => { const g = __game, t = g.map.triggers.find(t => t.kind === 'jump'); g.teleport(t.x, t.y - 6, 'down'); g.sim(3); }); await p.waitForTimeout(300); await st('at edge'); await key('z'); await p.waitForTimeout(1800); await st('jumped'); await shot('a_jumped');
};
