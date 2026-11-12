const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const st = async tag => console.log(tag, await J(p, () => JSON.stringify({ map: __game.mapUrl, h: [Math.round(__game.hero.x), Math.round(__game.hero.y)], dlg: !!__game.dialog, ui: RPG.ui.length, busy: RPG.busy, paused: __game.paused, gold: RPG.G && RPG.G.gold, items: RPG.G && RPG.G.items, near: __game.near })));
  const key = async (k, n = 1, ms = 140) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(ms); } };
  await key('z'); await p.waitForTimeout(2500); await st('start');
  // menu
  await key('c'); await p.waitForTimeout(300); await shot('m_menu'); await key('z'); await p.waitForTimeout(200); await shot('m_items'); await key('x'); await key('ArrowDown', 2); await key('z'); await key('z'); await p.waitForTimeout(200); await shot('m_status');
  await key('x'); await key('x'); await p.waitForTimeout(300); await st('menu closed');
  // mother -> inn
  await J(p, () => { const t = __game.map.triggers.find(t => t.id === 'mother'); __game.teleport(t.x - 30, t.y + 34, 'right'); __game.sim(3); });
  await p.waitForTimeout(300); await st('near mother'); await key('z'); await p.waitForTimeout(900); await shot('m_talk'); await key('z', 4, 500); await p.waitForTimeout(400); await shot('m_inn'); await st('inn?');
  await key('z'); await p.waitForTimeout(4200); await key('z'); await p.waitForTimeout(500); await st('rested');
  // shop door
  await J(p, () => { const t = __game.map.triggers.find(t => t.shop === 'goods' && t.kind === 'shop'); __game.teleport(t.x, t.y + 30, 'up'); __game.sim(3); });
  await p.waitForTimeout(300); await key('z'); await p.waitForTimeout(500); await key('e'); await p.waitForTimeout(300); await key('z'); await p.waitForTimeout(300); await key('z'); await p.waitForTimeout(300); await shot('m_shop'); await st('bought');   // 道具 tab, 薬草, one piece
  await key('x'); await key('x'); await p.waitForTimeout(300); await st('shop closed');
  // hidden spot
  await J(p, () => { const t = __game.map.triggers.find(t => t.id === 'ch001'); __game.teleport(t.x, t.y + 10, 'up'); __game.sim(3); });
  await p.waitForTimeout(300); await st('near spot'); await key('z'); await p.waitForTimeout(900); await shot('m_spot'); await key('z'); await p.waitForTimeout(500); await st('spot done');
  // roof chest
  await J(p, () => { const t = __game.map.triggers.find(t => t.id === 'ch002'); __game.teleport(t.x - 30, t.y + 20, 'right'); __game.sim(3); });
  await p.waitForTimeout(300); await st('near chest'); await key('z'); await p.waitForTimeout(1200); await shot('m_chest'); await key('z', 2, 600); await st('chest done');
  // save, then out of the gate
  await key('c'); await key('ArrowUp'); await key('z'); await p.waitForTimeout(1800); await key('x'); await p.waitForTimeout(300); await st('saved');
  await J(p, () => { const s = __game.map.spawns.gate; __game.teleport(s.x, s.y, 'left'); __game.keys.add('l'); });
  await p.waitForTimeout(6000); await J(p, () => __game.keys.delete('l')); await p.waitForTimeout(3000); await st('f01?'); await shot('m_f01');
  // an encounter by walking
  await J(p, () => { RPG.G.steps = 999; __game.keys.add('l'); }); await p.waitForTimeout(1500); await J(p, () => __game.keys.delete('l')); await p.waitForTimeout(3500); await st('battle?'); await shot('m_enc');
  for (let r = 0; r < 12 && await J(p, () => !!BATTLE.state); r++) { await key('z', 10, 180); await p.waitForTimeout(2500); }
  await shot('m_after'); await st('after battle');
  console.log(await J(p, () => JSON.stringify(RPG.G.party)));
};
