// The boss on the map: walk over the line at a high level, win, the crow is gone, walking on starts nothing, and it stays gone after leaving and coming back.
const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const key = async (k, n = 1, ms = 140) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(ms); } };
  const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(200); };
  const st = async tag => console.log(tag, await J(p, () => JSON.stringify({ map: __game.mapUrl.split('/')[0], h: [Math.round(__game.hero.x), Math.round(__game.hero.y)], ui: RPG.ui.length, busy: RPG.busy, bt: !!BATTLE.state, flags: Object.keys(RPG.G.flags).join(','), items: RPG.G.items, boss: __game.map.triggers.filter(t => t.kind === 'boss').map(t => !!t.propObj) })));
  await key('z'); await p.waitForTimeout(2500);
  await J(p, () => { RPG.debug.lv(16); RPG.G.set.speed = 5; RPG.debug.go('abbey2', {}); }); await p.waitForFunction(() => __game.mapUrl.startsWith('abbey2/') && !__game.loading && !RPG.busy, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  const b = await J(p, () => __game.map.boss.rect);
  await J(p, ([x, y]) => { __game.teleport(x, y, 'up'); __game.sim(5); }, [b[0] + b[2] / 2 - 4, b[1] + b[3] + 30]); await st('before');
  await hold('ArrowUp', 700); await p.waitForTimeout(500); await key('z', 2, 500); await p.waitForTimeout(3500); await st('fight');
  for (let r = 0; r < 300 && await J(p, () => !!BATTLE.state); r++) { await key('z', 5, 90); await p.waitForTimeout(250); }
  await p.waitForTimeout(2500); await st('after');
  await hold('ArrowUp', 900); await st('walked on');
  await J(p, () => { RPG.debug.go('abbey', { spawn: 'altar' }); }); await p.waitForFunction(() => __game.mapUrl.startsWith('abbey/') && !__game.loading && !RPG.busy, null, { timeout: 120000 }); await p.waitForTimeout(800);
  await J(p, () => { RPG.debug.go('abbey2', {}); }); await p.waitForFunction(() => __game.mapUrl.startsWith('abbey2/') && !__game.loading && !RPG.busy, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  await J(p, ([x, y]) => { __game.teleport(x, y, 'up'); __game.sim(5); }, [b[0] + b[2] / 2 - 4, b[1] + b[3] + 30]); await hold('ArrowUp', 900); await st('came back');
};
