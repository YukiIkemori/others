const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const tag = process.env.TAG || 'p';
  // ---- a pretend controller
  await J(p, () => { window.__pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad], configurable: true }); });
  const press = async (i, ms = 120) => { await J(p, i => { __pad.buttons[i].pressed = true; }, i); await p.waitForTimeout(ms); await J(p, i => { __pad.buttons[i].pressed = false; }, i); await p.waitForTimeout(140); };
  const st = async t => console.log(t, await J(p, () => JSON.stringify({ h: [__game.hero.x | 0, __game.hero.y | 0], ui: RPG.ui.length, busy: RPG.busy, pad: PAD.using, hint: (document.getElementById('fieldhint') || {}).textContent, bat: !!BATTLE.state })));
  await shot('fix/' + tag + '_title'); await press(0); await p.waitForTimeout(3500); await st('started with A'); await shot('fix/' + tag + '_field');
  // walk with the stick, run with RB
  await J(p, () => { __pad.axes[0] = 1; }); await p.waitForTimeout(900); await J(p, () => { __pad.axes[0] = 0; }); await st('stick right');
  await J(p, () => { __pad.buttons[14].pressed = true; __pad.buttons[5].pressed = true; }); await p.waitForTimeout(900); await J(p, () => { __pad.buttons[14].pressed = false; __pad.buttons[5].pressed = false; }); await st('dpad left + RB');
  await press(1); await p.waitForTimeout(600); await st('B: menu'); await shot('fix/' + tag + '_menu');
  await J(p, () => { __pad.axes[1] = 1; }); await p.waitForTimeout(800); await J(p, () => { __pad.axes[1] = 0; }); await p.waitForTimeout(200); await shot('fix/' + tag + '_menu2');
  await press(1); await p.waitForTimeout(500); await st('B: closed');
  // a battle, played with the pad
  await J(p, () => { RPG.debug.battle(['mn009', 'mn005', 'mn033'], 'f01'); }); await p.waitForTimeout(3800); await st('battle'); await shot('fix/' + tag + '_battle');
  for (let k = 0; k < 4; k++) { await press(0); await press(0); }
  await p.waitForTimeout(1500); await shot('fix/' + tag + '_battle2'); await st('after commands');
  await press(5); await p.waitForTimeout(3000); await shot('fix/' + tag + '_battle3');
};
