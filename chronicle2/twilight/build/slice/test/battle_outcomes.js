const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const st = async tag => console.log(tag, await J(p, () => JSON.stringify({ map: __game.mapUrl, h: [Math.round(__game.hero.x), Math.round(__game.hero.y)], ui: RPG.ui.length, busy: RPG.busy, paused: __game.paused, bt: !!BATTLE.state, gold: RPG.G.gold, lv: RPG.G.party.teto.lv, hp: Object.values(RPG.G.party).map(q => q.hp) })));
  const key = async (k, n = 1, ms = 160) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(ms); } };
  const endBattle = async () => { for (let r = 0; r < 40 && await J(p, () => !!BATTLE.state); r++) { await key('z', 6, 150); await p.waitForTimeout(700); } await p.waitForTimeout(1500); };
  await key('z'); await p.waitForTimeout(2500);
  await J(p, () => { __game.teleport(1110, 1000, 'down'); __game.sim(3); });
  // level up: nearly enough exp, one weak monster, double speed
  await J(p, () => { for (const id in RPG.G.party) RPG.G.party[id].exp = 50; RPG.G.set.speed = 2; RPG.debug.battle(['mn001']); });
  await p.waitForTimeout(3000); await key('z', 40, 250); await shot('t_levelup'); await endBattle(); await st('after level up');
  // flee
  await J(p, () => { RPG.debug.battle(['mn001', 'mn005']); }); await p.waitForTimeout(3000);
  for (let i = 0; i < 6 && await J(p, () => !!BATTLE.state); i++) { await key('ArrowUp'); await key('z'); await p.waitForTimeout(2600); await key('z', 1); await p.waitForTimeout(3500); }
  await p.waitForTimeout(1200); await st('after flee');
  // lose: everyone at 1 HP against strong monsters -> back to the start (no save)
  await J(p, () => { for (const id in RPG.G.party) RPG.G.party[id].hp = 1; RPG.debug.battle(['mn021', 'mn021', 'mn021'], 'abbey'); }); await p.waitForTimeout(3000);
  for (let r = 0; r < 30 && await J(p, () => !!BATTLE.state); r++) { await key('z', 6, 150); await p.waitForTimeout(900); if (r === 6) await shot('t_lose'); }
  await p.waitForTimeout(4000); await st('after lose'); await shot('t_afterlose');
};
