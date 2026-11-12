// The controller, laid out as in the old game: right button decides, bottom button goes back and runs while held,
// top button / Start opens the menu, L = repeat, R = the battle's speed.
const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const tag = process.env.TAG || 'q';
  await J(p, () => { window.__pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad], configurable: true }); });
  const press = async (i, ms = 120) => { await J(p, i => { __pad.buttons[i].pressed = true; }, i); await p.waitForTimeout(ms); await J(p, i => { __pad.buttons[i].pressed = false; }, i); await p.waitForTimeout(160); };
  const st = async t => { const s = await J(p, () => ({ h: [__game.hero.x | 0, __game.hero.y | 0], ui: RPG.ui.length, pad: PAD.using, hint: (document.getElementById('fieldhint') || {}).textContent, bat: BATTLE.state ? { sp: BATTLE.state.speed, rep: BATTLE.state.repeat } : null })); console.log(t, JSON.stringify(s)); return s; };
  const walk = async (hold, ms = 800) => { const a = await J(p, () => __game.hero.x); await J(p, h => { __pad.axes[0] = 1; if (h != null) __pad.buttons[h].pressed = true; }, hold); await p.waitForTimeout(ms); const b = await J(p, () => __game.hero.x); await J(p, h => { __pad.axes[0] = 0; if (h != null) __pad.buttons[h].pressed = false; }, hold); await p.waitForTimeout(250);
    await J(p, () => { __pad.axes[0] = -1; }); await p.waitForTimeout(ms); await J(p, () => { __pad.axes[0] = 0; }); await p.waitForTimeout(250); return Math.round(b - a); };
  await press(0); await p.waitForTimeout(800); console.log('bottom button on the title does not start:', await J(p, () => !!document.getElementById('start')));
  await press(1); await p.waitForTimeout(3500); await st('started with the right button'); await shot('fix/' + tag + '_field');
  await J(p, () => __game.teleport(1000, 1010, 'down')); await p.waitForTimeout(300);
  console.log('stick only (walk):', await walk(null), ' stick + bottom button (run):', await walk(0));
  await press(0); await p.waitForTimeout(400); await st('bottom button alone: no menu');
  await press(3); await p.waitForTimeout(600); await st('top button: menu'); await shot('fix/' + tag + '_menu');
  // settings: the last row of the menu's list is found by label
  const rows = await J(p, () => [...document.querySelectorAll('.pane .li span:first-child')].map(e => e.textContent)); console.log('menu rows', rows.join(' / '));
  const si = rows.indexOf('せってい'); for (let i = 0; i < si; i++) { await J(p, () => { __pad.buttons[13].pressed = true; }); await p.waitForTimeout(90); await J(p, () => { __pad.buttons[13].pressed = false; }); await p.waitForTimeout(140); }
  await press(1); await p.waitForTimeout(400);
  for (let i = 0; i < 3; i++) { await J(p, () => { __pad.buttons[13].pressed = true; }); await p.waitForTimeout(90); await J(p, () => { __pad.buttons[13].pressed = false; }); await p.waitForTimeout(140); }
  await press(1); await p.waitForTimeout(300); await shot('fix/' + tag + '_set');
  console.log('always dash now:', await J(p, () => RPG.env.G.set.dash));
  await press(0); await press(0); await p.waitForTimeout(400); await st('menu closed with the bottom button');
  console.log('always dash: stick only:', await walk(null), ' stick + bottom button (walk):', await walk(0));
  await J(p, () => { RPG.env.G.set.dash = false; });
  // battle
  await J(p, () => { RPG.debug.battle(['mn009', 'mn005', 'mn033'], 'f01'); }); await p.waitForTimeout(3800); await st('battle');
  const sp = []; for (let i = 0; i < 4; i++) { await press(5); sp.push(await J(p, () => BATTLE.state.speed)); } console.log('R cycles the speed:', sp.join(' '));
  await press(5); await press(5);                       // +2
  await press(4); await p.waitForTimeout(300); await st('L in the first round'); await shot('fix/' + tag + '_battle');
  for (let k = 0; k < 4; k++) { await press(1); await press(1); }
  await p.waitForTimeout(400); await st('commands given');
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(1500); const s = await J(p, () => BATTLE.state ? { r: BATTLE.state.repeat, n: BATTLE.state.ens.filter(e => e.hp > 0).length, list: !!document.getElementById('bcmd'), res: !!document.getElementById('bresult') } : null); if (!s || s.res) { console.log('round loop ended', JSON.stringify(s), 'after', i); break; } if (i === 2) await shot('fix/' + tag + '_battle2'); if (i % 4 === 0) console.log(JSON.stringify(s)); }
  await shot('fix/' + tag + '_battle3');
};
