// Shop, equipment and 満タン as in the old game.
const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  const tag = process.env.TAG || 'w';
  const key = async (k, n = 1, ms = 170) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(ms); } };
  const st = async t => console.log(t, await J(p, () => JSON.stringify({ ui: RPG.ui.length, gold: RPG.G.gold, items: RPG.G.items, eq: Object.fromEntries(Object.entries(RPG.G.party).map(([k, v]) => [k, Object.values(v.equip).filter(Boolean).join(',')])), hp: Object.values(RPG.G.party).map(q => q.hp), mp: Object.values(RPG.G.party).map(q => q.mp), help: [...document.querySelectorAll('.helpbar .t')].map(e => e.textContent).filter(Boolean) })));
  const closeAll = async () => { for (let i = 0; i < 8 && await J(p, () => RPG.ui.length); i++) await key('x', 1, 250); };
  // move the cursor of the top list to the row that holds the text
  const goto = async txt => { for (let i = 0; i < 12; i++) { const s = await J(p, () => { const a = [...document.querySelectorAll('.pane')].filter(e => e.querySelector('.li.sel')).pop(); return a ? a.querySelector('.li.sel').textContent : ''; }); if (s.includes(txt)) return true; await key('ArrowDown', 1, 120); } console.log('NOT FOUND', txt); return false; };
  const SH = (n) => shot('fix/' + tag + '_' + n);
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await key('z'); await p.waitForTimeout(3000);
  await J(p, () => { RPG.G.gold = 500; RPG.debug.shop('smith'); }); await p.waitForTimeout(500); await SH('shop1');
  await goto('薪割りの大剣'); await p.waitForTimeout(200); await SH('shop2');
  await key('z'); await p.waitForTimeout(300); await key('ArrowRight'); await SH('qty'); await key('ArrowLeft'); await key('z'); await p.waitForTimeout(400); await SH('offer'); await st('bought the greatsword');
  await key('z'); await p.waitForTimeout(400); await st('teto wears it'); await SH('shop3');
  await key('e'); await p.waitForTimeout(300); await SH('sell'); await st('sell tab');
  await goto('薬草'); await key('z'); await p.waitForTimeout(300); await SH('sellq'); await key('ArrowRight'); await key('z'); await p.waitForTimeout(300); await st('sold 2 herbs');
  await closeAll(); await st('shop closed');
  await J(p, () => { RPG.debug.shop('goods'); }); await p.waitForTimeout(400); await SH('goods');
  await goto('革の帽子'); await key('z'); await p.waitForTimeout(300); await key('ArrowRight', 3); await SH('hatq'); await key('z'); await p.waitForTimeout(400); await SH('hat');
  await key('z', 1, 400); await SH('hat2'); await key('z', 1, 400); await key('z', 1, 400); await goto('装備しない'); await key('z', 1, 400); await st('three wear the hat, one left over');
  await key('e'); await p.waitForTimeout(300); await SH('goods2'); await goto('薬草'); await key('z'); await key('ArrowUp'); await SH('herbq'); await key('z'); await p.waitForTimeout(300); await st('bought 11 herbs');
  await closeAll();
  // menu: equip
  await key('c'); await p.waitForTimeout(400); await goto('そうび'); await key('z'); await SH('eqwho'); await key('z'); await p.waitForTimeout(300); await SH('eq1');
  await key('z'); await p.waitForTimeout(300); await SH('eq2'); await goto('古い片手剣'); await p.waitForTimeout(200); await SH('eq3'); await key('z'); await p.waitForTimeout(300); await st('teto back to the sword');
  await key('v'); await p.waitForTimeout(400); await SH('best'); await key('z'); await p.waitForTimeout(300); await st('best'); await SH('eq4');
  await key('v'); await p.waitForTimeout(400); await SH('best2'); await key('z');
  await goto('頭'); await key('z'); await p.waitForTimeout(200); await goto('外す'); await SH('off'); await key('z'); await p.waitForTimeout(300); await st('hat off');
  await key('e'); await p.waitForTimeout(300); await SH('eq5'); await key('x'); await p.waitForTimeout(300); await st('equip closed');
  // 満タン
  await J(p, () => { const P = RPG.G.party; P.teto.hp = 5; P.metem.hp = 9; P.pamp.hp = 20; });
  await key('v'); await p.waitForTimeout(400); await SH('full1'); await key('z'); await p.waitForTimeout(400); await SH('full2'); await st('full'); await key('z'); await p.waitForTimeout(300);
  await key('v'); await p.waitForTimeout(300); await SH('full3'); await key('z');
  // items: use stays open
  await J(p, () => { const P = RPG.G.party; P.teto.hp = 5; P.metem.hp = 9; });
  await goto('どうぐ'); await key('z'); await p.waitForTimeout(300); await goto('薬草'); await key('z'); await p.waitForTimeout(300); await SH('use1'); await key('z', 1, 400); await key('ArrowDown'); await key('z', 1, 400); await SH('use2'); await st('used two herbs');
  await closeAll(); await st('menu closed');
};
