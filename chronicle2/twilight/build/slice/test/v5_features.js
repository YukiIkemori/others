// version 5: small map, formation, faces in the battle order, kanji labels, exp, メテム's spells
const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const key = async (k, n = 1, ms = 170) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(ms); } };
  const SH = n => shot('fix/v5_' + n);
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await SH('start');
  await key('z'); await p.waitForTimeout(3200);
  console.log('new game', await J(p, () => JSON.stringify({ order: RPG.G.order, map: RPG.G.set.map, exp1: RPG.debug.expNext(1), exp5: RPG.debug.expNext(5), metem: RPG.env.skillsOf('metem').map(s => s.name) })));
  await p.waitForTimeout(600); await SH('map_small');
  // walk a little so that more is filled in
  await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(2500); await p.keyboard.up('ArrowLeft'); await p.waitForTimeout(300); await SH('map_small2');
  await key('v', 1, 500); await SH('map_big'); console.log('mode', await J(p, () => RPG.G.set.map));
  await key('v', 1, 500); await SH('map_off'); console.log('mode', await J(p, () => RPG.G.set.map + ' shown=' + (document.getElementById('mm').style.display !== 'none')));
  await key('v', 1, 500); console.log('mode', await J(p, () => RPG.G.set.map + ' explored=' + JSON.stringify(Object.keys(RPG.G.explored))));
  // menu and formation
  await key('c', 1, 500); await SH('menu');
  await key('ArrowDown', 3); await key('z', 1, 400); await SH('order1');
  await key('ArrowRight', 1, 300); await SH('order2');                         // テト to the back row
  await key('z', 1, 200); await key('ArrowDown', 2, 200); await SH('order3');    // lifted and moved down two places
  await key('z', 1, 200); await SH('order4');
  console.log('order', await J(p, () => JSON.stringify({ order: RPG.G.order, rows: RPG.G.order.map(id => RPG.G.party[id].row) })));
  // a click on a card changes its row
  await p.click('.cards .card:nth-child(4)'); await p.waitForTimeout(250); await SH('order5');
  console.log('after click', await J(p, () => JSON.stringify(RPG.G.order.map(id => id + ':' + RPG.G.party[id].row))));
  await p.click('.cards .card:nth-child(1) .mv i:nth-child(2)'); await p.waitForTimeout(250);
  console.log('after ▼', await J(p, () => JSON.stringify(RPG.G.order)));
  await key('x', 1, 300); console.log('ui after back', await J(p, () => RPG.ui.length + ' keys=' + document.querySelector('#menu .helpbar .keys').textContent));
  await key('ArrowUp', 1); await key('z', 1, 300); await key('z', 1, 400); await SH('status');       // 強さ
  await key('x', 1, 300); await key('ArrowDown', 2); await key('z', 1, 400); await SH('settings'); await key('x', 2, 300);
  // battle
  J(p, () => { RPG.debug.battle(['mn001', 'mn001', 'mn005', 'mn009'], 'f01'); }); await p.waitForTimeout(4800); await SH('battle1');
  console.log('battle', await J(p, () => JSON.stringify({ pcs: BATTLE.state.pcs.map(a => a.name + ':' + a.row + '@' + a.x + ',' + a.y), chips: [...document.querySelectorAll('#border .chip')].map(c => c.title + (c.querySelector('canvas') ? '*' : '')) })));
  await key('ArrowDown', 1); await key('z', 1, 400); await SH('battle2'); await key('x', 1, 300); await key('ArrowUp');
  // who gets hit: 4000 draws
  console.log('targets', await J(p, () => { const n = {}; for (let i = 0; i < 4000; i++) { /* same rule as pickTarget */ const B = BATTLE.state, fs = B.pcs.filter(a => a.hp > 0), wt = f => (B.pcs.length - f.i) * (f.row === 'front' ? 1 : .5); let tot = 0; for (const f of fs) tot += wt(f); let r = Math.random() * tot, t = fs[0]; for (const f of fs) { r -= wt(f); if (r <= 0) { t = f; break; } } n[t.name] = (n[t.name] || 0) + 1; } return JSON.stringify(n); }));
  for (let i = 0; i < 80 && await J(p, () => !!BATTLE.state); i++) { await key('z', 1, 300); if (i === 14) await SH('battle3'); }
  await p.waitForTimeout(1500); await SH('after');
  console.log('after battle', await J(p, () => JSON.stringify({ lv: RPG.G.order.map(id => RPG.G.party[id].lv + '/' + RPG.G.party[id].exp), wins: RPG.G.wins })));
  // save and load keeps the order and the map
  await J(p, () => { RPG.debug.save(); }); console.log('saved', await J(p, () => { const o = JSON.parse(localStorage.getItem('twilight_slice_save_v1')); return JSON.stringify({ order: o.order, set: o.set, ex: Object.keys(o.explored) }); }));
};
