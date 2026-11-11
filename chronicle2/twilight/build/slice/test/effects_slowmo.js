// close-ups of effects: node play.js url s5.js ; env FX=fire,water,...
module.exports = async (p, shot) => {
  await p.keyboard.press('z'); await p.waitForTimeout(3000);
  await p.evaluate(() => { RPG.debug.lv(8); RPG.debug.battle(['mn045', 'mn021', 'mn033'], 'abbey'); });
  await p.waitForTimeout(3500);
  const list = (process.env.FX || 'fire,water,earth,wind,light').split(',');
  for (const fx of list) {
    await p.evaluate(fx => { const B = BATTLE.state, T = BATTLE._t, a = B.pcs[1], t = B.ens[0]; B.speed = .12; B.parts.length = 0; B.nums.length = 0; t.hp = t.mhp = 999;
      const pc = n => B.pcs[n];
      window.__done = false;
      const run = fx === 'slash' ? T.strike(pc(0), t, 1) : fx === 'heavy' ? T.strike(pc(0), t, 1.5, true) : fx === 'dagger' ? T.strike(pc(2), t, 1) : fx === 'staff' ? T.strike(pc(3), t, 1)
        : fx === 'heal' ? T.healFx(pc(0), 30) : fx === 'shield' ? (T.shieldFx(pc(0)), new Promise(r => setTimeout(r, 4000))) : fx === 'steal' ? T.pcAct(pc(2), { k: 'steal', t })
        : fx === 'blind' ? T.pcAct(pc(2), { k: 'skill', s: 'metsubushi', t }) : fx.startsWith('en') ? T.enAct(B.ens[+fx[2]]) : T.castSpell(a, { fx, el: fx, power: 1 }, t);
      run.then(() => { window.__done = true; }); }, fx);
    for (let i = 0; i < 40; i++) { await shot('fx_' + fx + '_' + String(i).padStart(2, '0')); if (await p.evaluate(() => window.__done)) break; }
  }
};
