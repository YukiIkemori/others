// 店のブラウザのテスト（持ち主 2026-09-28 の店の手直し）と 1920×1080 の撮影。
//   node v2/tools/build.js && node v2/tools/test_shop_browser.js [--no-shots] [--out <dir>]
//   仲間の帯（増減・装備できない・装備中）・まとめ買い（←→ ↑↓ L/R、所持金で止まる）・まとめ売り・「使わない物をまとめて売る」（START → 札 → A）。
//   キーボードだけで動かす。撮った PNG は v2/design/shots/menus/shop_*.png（--out で替えられる。必ず Read で見る）。
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const args = process.argv.slice(2);
const noShots = args.includes('--no-shots');
const OUT = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(B.V2, 'design', 'shots', 'menus');
const TOP = B.TOP, V = 'RPG.Engine.top().view';

async function openShop(p, params) {
  await B.ev(p, `(() => { RPG.Screens.open('shop', ${JSON.stringify(params)}); return true; })()`);
  const okd = await B.waitFor(p, `${TOP}==='screen:shop'`, 4000);
  await p.waitForTimeout(450);
  return okd;
}
const shot = async (p, name) => { if (!noShots) await B.shot(p, path.join(OUT, name)); };

(async () => {
  const S = await B.start();
  try {
    const P = await B.open(S, 'dev.html?fixture=menus_party');
    const p = P.page;
    await B.waitFor(p, `${TOP}==='field'`, 8000);
    await p.waitForTimeout(400);

    section('仲間の帯（武具屋）');
    await B.ev(p, `(() => { RPG.Game.gold = 2400; RPG.Game.chars.hero.equip.weapon1 = 'w_sword_1'; return true; })()`);
    ok('arms shop opens', await openShop(p, { id: 'shop_pharos_arms', line: '港の鍛冶場から今朝あがった品だよ' }));
    // 鉄の剣（皆が付けている）→ 装備中、弓 → 付けられない人がいる、の行を探して撮る
    await B.pressUntil(p, 'down', `${V}.list.current().value==='w_greatsword_1'`, 8);
    const cmp = await B.ev(p, `JSON.stringify(${V}.compare(${V}.list.current().value, 2))`);
    ok('strip data covers every member', JSON.parse(cmp).length === (await B.ev(p, 'RPG.Party.members().length')));
    await shot(p, 'shop_compare_1920.png');
    await B.pressUntil(p, 'up', `${V}.list.current().value==='w_sword_1'`, 8);
    ok('w_sword_1 (hero wears it) → 装備中', await B.ev(p, `${V}.compare('w_sword_1', 2).some((c) => c.state === 'wearing')`));
    await p.waitForTimeout(200);
    await shot(p, 'shop_compare_wearing_1920.png');
    await B.press(p, 'r'); await p.waitForTimeout(300);
    await B.pressUntil(p, 'down', `${V}.list.current().value==='bd_robe_1'`, 12);
    await p.waitForTimeout(200);
    await shot(p, 'shop_compare_armor_1920.png');

    section('まとめ買い（装備）');
    await B.ev(p, `(() => { RPG.Game.gold = 700; return true; })()`);
    ok('cursor on hn_glove_1', await B.pressUntil(p, 'down', `${V}.list.current().value==='hn_glove_1'`, 24));
    const pr = await B.ev(p, `${V}.price('hn_glove_1')`);
    await B.press(p, 'a');
    ok('A on gear → quantity picker', await B.waitFor(p, `!!${V}.qtyPick`, 1500));
    await B.press(p, 'r');
    const max = await B.ev(p, `${V}.qtyPick.max`);
    ok('R → max, capped by gold', (await B.ev(p, `${V}.qtyPick.n`)) === max && max === Math.min(Math.floor(700 / pr), 99) && (await B.ev(p, `${V}.qtyPick.cap`)) === 'gold', { max, pr });
    await B.press(p, 'right');
    ok('→ past max stays at max', (await B.ev(p, `${V}.qtyPick.n`)) === max);
    await p.waitForTimeout(150);
    await shot(p, 'shop_qty_buy_1920.png');
    await B.press(p, 'l');
    ok('L → 1', (await B.ev(p, `${V}.qtyPick.n`)) === 1);
    await B.press(p, 'right');
    const n = await B.ev(p, `${V}.qtyPick.n`);
    const g0 = await B.ev(p, 'RPG.Game.gold');
    await B.press(p, 'a');
    ok('buy ×2 gear → 今すぐ装備する？（あと 2 個）', await B.waitFor(p, `!!${V}.modal && /あと 2 個/.test(${V}.modal.o.title)`, 2000), await B.ev(p, `${V}.modal && ${V}.modal.o.title`));
    const first = await B.ev(p, `RPG.Party.members().findIndex((c) => RPG.Rules.canEquip(c, 'hn_glove_1', RPG.Rules.defaultSlot(c, 'hn_glove_1')) && c.equip.hands !== 'hn_glove_1')`);
    ok('cursor starts on the first member who can wear it and is not wearing it', (await B.ev(p, `${V}.modal.list.index`)) === first);
    await shot(p, 'shop_equip_offer_1920.png');
    await B.press(p, 'a');
    ok('then asks again for the 2nd copy', await B.waitFor(p, `!!${V}.modal && ${V}.modal.o.title === '今すぐ装備する？' && !${V}.modal.ending`, 2500));
    const second = await B.ev(p, `${V}.modal.list.index`);
    ok('2nd cursor is on a different member', second !== first, { first, second });
    await B.pressUntil(p, 'down', `${V}.modal.list.current().label === '装備しない'`, 8);
    await B.press(p, 'a');
    await B.waitFor(p, `!${V}.modal && !${V}.busy`, 2500);
    { const gl = await B.ev(p, 'RPG.Game.gold'), bag = await B.ev(p, 'RPG.Game.items.hn_glove_1'), worn = await B.ev(p, "RPG.Party.members().filter((c) => c.equip.hands === 'hn_glove_1').length"); ok('gold − 2 × price, 1 worn + 1 in the bag', gl === g0 - n * pr && bag === 1 && worn === 1, { gl, g0, n, pr, bag, worn }); }

    section('まとめ売り・使わない物をまとめて売る');
    await B.ev(p, `(() => { const G = RPG.Game; G.items.i_salve = 12; G.items.i_golden_acorn = 1; G.items.i_gold_coins = 2; G.items.w_sword_iron = 2; for (const c of RPG.Party.members().concat(RPG.Party.reserve())) if (RPG.Rules.canEquip(c, 'w_sword_1', 'weapon1')) { c.equip.weapon1 = 'w_sword_1'; if (!c.equip.shield) c.equip.shield = 'sh_iron_buckler'; } return true; })()`);
    await B.press(p, 'r'); await p.waitForTimeout(300);
    ok('R → 売る tab', (await B.ev(p, `${V}.tabKey()`)) === 'sell');
    await B.pressUntil(p, 'down', `${V}.list.current().value==='i_salve'`, 30);
    await B.press(p, 'a');
    ok('A on a stack → sell picker', await B.waitFor(p, `!!${V}.qtyPick && ${V}.qtyPick.mode === 'sell' && ${V}.qtyPick.max === 12`, 1500));
    await B.press(p, 'up');
    ok('↑ +10 → 11', (await B.ev(p, `${V}.qtyPick.n`)) === 11);
    await shot(p, 'shop_qty_sell_1920.png');
    await B.press(p, 'down'); await B.press(p, 'right'); await B.press(p, 'right');
    const g1 = await B.ev(p, 'RPG.Game.gold');
    await B.press(p, 'a'); await p.waitForTimeout(300);
    ok('sell ×3 → 9 left, gold + 3 × sell price', (await B.ev(p, 'RPG.Game.items.i_salve')) === 9 && (await B.ev(p, 'RPG.Game.gold')) === g1 + 3 * (await B.ev(p, `RPG.Rules.sellPrice('i_salve')`)));
    await p.waitForTimeout(200);
    await shot(p, 'shop_sell_tab_1920.png');
    await B.press(p, 'start');
    ok('START → まとめて売る panel', await B.waitFor(p, `!!${V}.junk`, 1500));
    const ids = await B.ev(p, `${V}.junk.rows.map((r) => r.id)`);
    ok('candidates: the treasure items; never salve / key / worn gear', ids.includes('i_golden_acorn') && ids.includes('i_gold_coins') && !ids.includes('i_salve'), ids);
    ok('鉄の剣 (everyone wields 鋼の剣, not sold here any more) → listed, keeping the last one', await B.ev(p, `(${V}.junk.rows.find((r) => r.id === 'w_sword_iron') || {}).n === 1`), await B.ev(p, `JSON.stringify(${V}.junk.rows)`));
    await p.waitForTimeout(150);
    await shot(p, 'shop_junk_1920.png');
    await B.press(p, 'a');   // 1 行目を外す
    const off = await B.ev(p, `${V}.junk.rows.filter((r) => !r.on).map((r) => r.id)`);
    ok('A on a row → unchecked', off.length === 1, off);
    await shot(p, 'shop_junk_unchecked_1920.png');
    const total = await B.ev(p, `${V}.junkTotal()`), g2 = await B.ev(p, 'RPG.Game.gold');
    await B.pressUntil(p, 'down', `${V}.junk.list.current().value === '__ok'`, 12);
    await B.press(p, 'a'); await p.waitForTimeout(300);
    ok('まとめて売る → gold + total, the unchecked one kept, salve kept', !(await B.ev(p, `!!${V}.junk`)) && (await B.ev(p, 'RPG.Game.gold')) === g2 + total && (await B.ev(p, `RPG.Game.items[${JSON.stringify(off[0])}] > 0`)) && (await B.ev(p, 'RPG.Game.items.i_salve')) === 9);
    await B.press(p, 'start'); await p.waitForTimeout(200);
    if (await B.ev(p, `!!${V}.junk`)) { await B.press(p, 'b'); await p.waitForTimeout(200); }
    ok('B closes the panel', !(await B.ev(p, `!!${V}.junk`)));
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 4);
    ok('B leaves the shop', (await B.ev(p, TOP)) === 'field');
    ok('0 console errors', P.errors.length === 0, P.errors.slice(0, 5));
    await P.close();
  } finally {
    await B.stop(S);
    done('test_shop_browser');
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
