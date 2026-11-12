// The new monsters and the boss: fights at Lv 9 with the capital's gear, at the fastest battle speed; collects what the battle says.
const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const key = async (k, n = 1, ms = 120) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(ms); } };
  await key('z'); await p.waitForTimeout(2500);
  await J(p, () => { const G = RPG.G; RPG.debug.lv(+(new URLSearchParams(location.search).get('lv') || 9)); G.learned.tsumuji = 1; G.gold = 5000;
    for (const [k, n] of [['kizugusuri', 9], ['mpwater', 5], ['kitsuke', 3], ['dokukeshi', 3], ['mame', 2]]) RPG.debug.give(k, n);
    const eq = { teto: { weapon: 'sw02', shield: 'sh02', head: 'hd03', body: 'bd05', hand: 'hn03', foot: 'ft02' }, metem: { weapon: 'bk02', head: 'hd04', body: 'bd03' }, pamp: { weapon: 'dg03', body: 'bd01', hand: 'hn02' }, bani: { weapon: 'hs02', head: 'hd04', body: 'bd04' } };
    for (const id in eq) G.party[id].equip = eq[id]; RPG.debug.healAll(); G.set.speed = 5;
    window.__said = []; setInterval(() => { const e = document.querySelector('#battle .helpbar .t') || document.querySelector('#bui .t'); const t = e && e.textContent; if (t && __said[__said.length - 1] !== t) __said.push(t); const r = document.getElementById('bresult'); if (r && __said[__said.length - 1] !== 'R:' + r.textContent) __said.push('R:' + r.textContent); }, 60); });
  const fights = (process.env.FIGHTS ? JSON.parse(process.env.FIGHTS) : [['f02a', ['mn017', 'mn037', 'mn037'], 'f02'], ['f02b', ['mn006', 'mn046', 'mn046'], 'f02'], ['ab2a', ['mn053', 'mn097r', 'mn097b'], 'abbey2'], ['ab2b', ['mn049', 'mn049'], 'abbey2'], ['coin', ['mn101', 'mn053'], 'abbey2'], ['boss', ['bs01'], 'bs01', { boss: true }]]);
  for (const [n, g, t, opt] of fights) {
    await J(p, () => { __said.length = 0; RPG.debug.healAll(); });
    J(p, ([g, t, opt]) => { window.__res = null; RPG.debug.battle(g, t, opt).then(r => { window.__res = r; }); }, [g, t, opt || null]);
    await p.waitForTimeout(2600); await shot('fix/b7_' + n);
    let r = 0;
    for (; r < 400 && await J(p, () => !!BATTLE.state); r++) {
      // メテム uses the all-target spell on her first turns: menu 術 -> つむじ風
      await key('z', 5, 90); await p.waitForTimeout(250);
      if (r === 12) await shot('fix/b7_' + n + '_mid');
    }
    await p.waitForTimeout(1200);
    console.log('== ' + n, await J(p, () => JSON.stringify({ res: __res, hp: Object.values(RPG.G.party).map(q => q.hp), mp: Object.values(RPG.G.party).map(q => q.mp), psn: Object.values(RPG.G.party).map(q => !!q.poison), gold: RPG.G.gold, lv: RPG.G.party.teto.lv, items: RPG.G.items })));
    console.log(await J(p, () => __said.join(' / ')));
  }
};
