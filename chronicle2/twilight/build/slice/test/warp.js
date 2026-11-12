// ワープ: the list, "いまいる所", not from inside a dungeon, flying to a town and to a dungeon entrance
const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const key = async (k, n = 1, ms = 170) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(ms); } };
  const goto = async txt => { for (let i = 0; i < 12; i++) { const s = await J(p, () => { const a = [...document.querySelectorAll('.pane')].filter(e => e.querySelector('.li.sel')).pop(); return a ? a.querySelector('.li.sel').textContent : ''; }); if (s.includes(txt)) return true; await key('ArrowDown', 1, 120); } console.log('NOT FOUND', txt); return false; };
  const st = async t => console.log(t, await J(p, () => JSON.stringify({ map: __game.mapUrl, h: [Math.round(__game.hero.x), Math.round(__game.hero.y)], ui: RPG.ui.length, busy: RPG.busy, warps: RPG.G.warps, help: [...document.querySelectorAll('.helpbar .t')].map(e => e.textContent).filter(Boolean), rows: [...document.querySelectorAll('#menu .sub .li')].map(e => e.textContent + (e.classList.contains('dim') ? '(dim)' : '')) })));
  const idle = () => p.waitForFunction(() => !__game.loading && !RPG.busy && !RPG.ui.length, null, { timeout: 60000 });
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await key('z'); await p.waitForTimeout(3200);
  await key('c', 1, 400); await goto('ワープ'); await shot('fix/v6_menu'); await key('z', 1, 400); await st('village: list'); await shot('fix/v6_warp_village');
  await key('z', 1, 300); await st('picked the place we are in'); await key('x', 3, 300);
  await J(p, () => RPG.debug.go('abbey', { spawn: 'gate' })); await p.waitForTimeout(1500); await idle();
  await key('c', 1, 400); await goto('ワープ'); await key('z', 1, 300); await st('abbey: warp row is dim'); await shot('fix/v6_warp_dungeon'); await key('x', 2, 300);
  await J(p, () => RPG.debug.go('f01', { spawn: 'abbey' })); await p.waitForTimeout(1500); await idle();
  await key('c', 1, 400); await goto('ワープ'); await key('z', 1, 400); await st('f01: list'); await shot('fix/v6_warp_f01');
  await goto('始まりの村'); await key('z', 1, 400); await shot('fix/v6_warp_ask'); await key('z', 1, 600); await p.waitForTimeout(1500); await idle(); await st('flew to the village');
  await key('c', 1, 400); await goto('ワープ'); await key('z', 1, 400); await goto('崖の修道院'); await key('z', 1, 400); await key('ArrowDown'); await key('z', 1, 400); await st('said やめる');
  await key('z', 1, 400); await key('z', 1, 600); await p.waitForTimeout(1500); await idle(); await st('flew to the abbey gate');
  // an old save without warps
  console.log('old save', await J(p, () => { const o = JSON.parse(JSON.stringify(RPG.G)); delete o.warps; o.map = 'f01'; o.flags.ch045 = 1; localStorage.setItem('twilight_slice_save_v1', JSON.stringify(o)); return 'written'; }));
};
