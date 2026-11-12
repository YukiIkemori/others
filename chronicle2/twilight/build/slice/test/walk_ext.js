// Walk-through of the extension (2D, no random fights): f01 -> f02 -> capital (shops, inn, map seller, hidden thing) -> plaza (wall chest, nest)
// -> abbey altar -> abbey2 (crystal, boss line, boss, chest, book) -> back to the altar.  Also an old save (no body slot) loads with clothes on.
const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const key = async (k, n = 1, ms = 140) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(ms); } };
  const st = async tag => console.log(tag, await J(p, () => JSON.stringify({ map: __game.mapUrl.split('/')[0], h: [Math.round(__game.hero.x), Math.round(__game.hero.y)], ui: RPG.ui.length, busy: RPG.busy, bt: !!BATTLE.state, gold: RPG.G.gold, flags: Object.keys(RPG.G.flags).join(','), warps: Object.keys(RPG.G.warps).join(','), items: JSON.stringify(RPG.G.items), dlg: !!__game.dialog, sub: document.getElementById('titleSub').textContent })));
  const onMap = async m => { await p.waitForFunction(m => __game.mapUrl.startsWith(m + '/') && !__game.loading && !RPG.busy, m, { timeout: 120000 }); await p.waitForTimeout(1200); };
  const go = async m => { await J(p, m => { RPG.debug.go(m, {}); }, m); await onMap(m); };
  const tp = async (x, y) => { await J(p, ([x, y]) => { __game.teleport(x, y, 'down'); __game.sim(5); }, [x, y]); await p.waitForTimeout(250); };
  const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(200); };
  const trig = async title => { const t = await J(p, title => { const t = __game.map.triggers.find(q => q.title === title || q.id === title); return [t.x, t.y]; }, title); let ok = false; for (const [dx, dy] of [[0, 14], [0, 26], [-20, 0], [20, 0], [0, -14], [-24, 14], [24, 14]]) if (await J(p, ([x, y]) => __game.free(x, y), [t[0] + dx, t[1] + dy])) { await tp(t[0] + dx, t[1] + dy); ok = true; break; } if (!ok) console.log('no free spot by', title); await key('z'); await p.waitForTimeout(500); };
  const talkOut = async (n = 8) => { for (let i = 0; i < n; i++) { await key('z'); await p.waitForTimeout(350); } };
  await key('z'); await p.waitForTimeout(2500);
  await J(p, () => { RPG.debug.lv(10); RPG.G.gold = 3000; });
  if (!process.env.SKIP) {
  // f01 -> f02 by the west exit
  await go('f01'); const e = await J(p, () => { const e = __game.map.exits.find(q => q.to === 'f02'); return e.rect; }); await tp(e[0] + e[2] + 40, e[1] + e[3] / 2); await hold('ArrowLeft', 1500); await onMap('f02'); await st('f01->f02');
  // f02: remains and the rock, then the capital gate
  await trig('ch018'); await talkOut(4); await trig('ch016'); await talkOut(5); await st('f02 spots');
  const c = await J(p, () => { const e = __game.map.exits.find(q => q.to === 'capital'); return [e.x, e.y]; }); await tp(c[0], c[1] + 90); await hold('ArrowUp', 1500); await onMap('capital'); await p.waitForTimeout(1200); await shot('fix/w7_capital_title'); await st('f02->capital');
  // capital: armour shop (buy the first thing and put it on), inn, map seller, hidden thing
  await trig('防具屋'); await p.waitForTimeout(600); await shot('fix/w7_shop'); await key('ArrowDown', 3); await key('z'); await p.waitForTimeout(300); await shot('fix/w7_shop2'); await key('z'); await p.waitForTimeout(400); await key('z'); await p.waitForTimeout(400); await key('x', 4, 250); await st('armour shop');
  await trig('宿「灯守り亭」'); await p.waitForTimeout(400); await shot('fix/w7_inn'); await key('z'); await p.waitForTimeout(4500); await key('z', 2, 400); await st('inn');
  await trig('nezu'); await talkOut(3); await p.waitForTimeout(300); await shot('fix/w7_nezu'); await key('z'); await p.waitForTimeout(500); await key('z', 2, 400); await st('nezu');
  await trig('ch003'); await talkOut(4); await st('alley');
  // -> plaza by the north stair
  const n = await J(p, () => __game.map.spawns.north); await tp(n.x, n.y); await hold('ArrowUp', 1800); await onMap('plaza'); await st('capital->plaza');
  await trig('ch004'); await p.waitForTimeout(700); await talkOut(5); await trig('時計塔のてっぺん'); await talkOut(4); await st('plaza');
  await go('capital'); await trig('nezu'); await p.waitForTimeout(300); await shot('fix/w7_nezu2'); await talkOut(3); await st('nezu again');
  }
  // abbey altar -> abbey2
  await go('abbey'); await trig('祭壇'); await p.waitForTimeout(500); await shot('fix/w7_altar'); await key('z'); await onMap('abbey2'); await p.waitForTimeout(1500); await shot('fix/w7_abbey2_title'); await st('abbey->abbey2');
  await trig('セーブ結晶'); await p.waitForTimeout(400); await key('z'); await p.waitForTimeout(700); await key('z'); await p.waitForTimeout(500); await st('crystal');
  // the boss line
  await J(p, () => { RPG.G.set.speed = 5; RPG.debug.healAll(); }); const b = await J(p, () => __game.map.boss.rect); await tp(b[0] + b[2] / 2 - 4, b[1] + b[3] + 30); await hold('ArrowUp', 700); await p.waitForTimeout(600); await shot('fix/w7_boss_intro'); await key('z', 2, 500); await p.waitForTimeout(3500); await st('boss started'); await shot('fix/w7_boss');
  for (let r = 0; r < 300 && await J(p, () => !!BATTLE.state); r++) { await J(p, () => { for (const id in RPG.G.party) { RPG.G.party[id].hp = Math.max(RPG.G.party[id].hp, 60); } }); await key('z', 5, 90); await p.waitForTimeout(250); }
  await p.waitForTimeout(2500); await st('after boss');
  await hold('ArrowUp', 600); await st('walked on');      // no second fight
  await trig('ch049'); await p.waitForTimeout(700); await talkOut(4); await st('boss chest');
  // read the book: menu -> 道具 -> the book -> メテム
  await key('c'); await p.waitForTimeout(400); await key('z'); await p.waitForTimeout(300);
  const idx = await J(p, () => Object.keys(RPG.G.items).filter(k => RPG.G.items[k] > 0).indexOf('sb08')); await key('ArrowDown', idx, 120); await key('z'); await p.waitForTimeout(300);
  const mi = await J(p, () => RPG.G.order.indexOf('metem')); await key('ArrowDown', mi, 120); await key('z'); await p.waitForTimeout(500); await shot('fix/w7_book'); await key('z'); await key('x', 4, 250);
  console.log('learned', await J(p, () => JSON.stringify(RPG.G.learned) + ' ' + RPG.env.skillsOf('metem').map(s => s.name).join(',')));
  // back out by the south door
  const s = await J(p, () => __game.map.exits[0].rect); await tp(s[0] + s[2] / 2, s[1] - 60); await hold('ArrowDown', 1500); await onMap('abbey'); await st('abbey2->abbey');
  // an old save without clothes
  console.log('old save', await J(p, () => { RPG.debug.save(); const k = 'twilight_slice_save_v1', o = JSON.parse(localStorage.getItem(k)); delete o.gear2; delete o.learned; for (const id in o.party) delete o.party[id].equip.body; localStorage.setItem(k, JSON.stringify(o)); return 'written'; }));
  await p.reload(); await p.waitForFunction(() => window.__game && !window.__game.loading, null, { timeout: 120000 }); await p.waitForTimeout(1000); await key('ArrowDown'); await key('z'); await p.waitForTimeout(4000);
  console.log('loaded', await J(p, () => JSON.stringify({ map: __game.mapUrl, body: Object.values(RPG.G.party).map(q => q.equip.body), learned: RPG.G.learned, arm: RPG.env.stats('teto').arm })));
};
