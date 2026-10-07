// MENUS: 年代記の画面の「書庫」のタブのブラウザのテスト（PC 1920×1080 と スマホ縦 390×844）
//   node v2/tools/build.js && node v2/tools/test_library_browser.js [--shots <dir>]
//   L/R で書庫へ・数・「？？？」・選んだ物の全文・長い文を A で読んで ↓ で送る・B で一覧へ・開いた印がセーブに残る（読み込み直し）・
//   体験版の行けない地方は 1 行の「？？？」・タッチで書庫の札を押す・右の札を引きずって送る・コンソールのエラー 0。
//   --shots を付けたときだけ撮る（撮ったら Read で見る）。
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const args = process.argv.slice(2);
const OUT = args.includes('--shots') ? path.resolve(args[args.indexOf('--shots') + 1]) : null;
const TOP = B.TOP;
const V = 'RPG.Engine.top().view';
const shot = async (p, name) => { if (OUT) await B.shot(p, path.join(OUT, name + '.png')); };

// 書き写した読み物（長い文・声のある物・外伝・手紙・世界のうわさ）
const GOT = ['lo_roa_stone', 'lo_roa_seat', 'lo_lighthouse_song', 'lo_pharos_oilboard', 'lo_ev_forest', 'lo_forest_moss_stone', 'lo_lz_1', 'lo_lz_2',
  'lo_ev_snow', 'lo_ev_isles', 'lo_war_isles', 'lo_mine_oath', 'lo_ev_star', 'lo_rowell_cover', 'lo_ouroboros', 'lo_mira_portrait'];
const SETUP = (full) => `(() => { const G = RPG.Game; for (const id of Object.keys(RPG.DB.lore)) delete G.flags[id]; for (const id of ${JSON.stringify(GOT)}) G.flags[id] = true;
  G.loreSeen = { lo_roa_stone: true }; RPG.DB.config.slice = ${full ? 'false' : 'true'}; return true; })()`;

async function openAt(S, phone) {
  const P = await B.open(S, 'dev.html?fixture=menus_party', phone ? { phone: true } : {});
  await B.waitFor(P.page, `${TOP}==='field'`, 8000);
  await P.page.waitForTimeout(400);
  return P;
}
async function openChronicle(p) {
  await B.ev(p, `(() => { RPG.Screens.open('chronicle', {}); return true; })()`);
  return B.waitFor(p, `${TOP}==='screen:chronicle'`, 3000);
}
const focusRow = (p, id) => B.ev(p, `(() => { const L = ${V}.list; const i = L.rows.findIndex((r) => r.value === ${JSON.stringify(id)}); L.focusIndex(i); return i; })()`);

(async () => {
  const S = await B.start();
  let P;
  try {
    // ------------------------------------------------ PC（キー）
    section('PC 1920×1080（キー）');
    P = await openAt(S, false);
    let p = P.page;
    await B.ev(p, SETUP(true));
    ok('opens chronicle', await openChronicle(p));
    const tab0 = await B.ev(p, `${V}.tab`);
    await B.pressUntil(p, 'r', `${V}.tab===2`, 3);
    ok('L/R reaches the 書庫 tab (tab 2)', (await B.ev(p, `${V}.tab`)) === 2, [tab0, await B.ev(p, `${V}.tab`)]);
    const n = await B.ev(p, 'RPG.Screens.loreCount()');
    ok('count = collected / all lore', n.got === GOT.length && n.total === Object.keys(await B.ev(p, 'RPG.DB.lore')).length, n);
    const rows = await B.ev(p, `${V}.list.rows.map((r) => ({v: r.value, l: r.label, got: r.got, t: !!r.text, n: r.isNew, rg: r.region}))`);
    ok('first group is the prologue, last is finale', rows[0].rg === 'prologue' && rows[rows.length - 1].rg === 'finale');
    ok('uncollected rows are ？？？ without text', rows.filter((r) => !r.got).every((r) => r.l === '？？？' && !r.t) && rows.some((r) => !r.got));
    ok('collected rows show titles', rows.filter((r) => r.got).length === GOT.length);
    ok('new mark: collected and unseen (lo_roa_stone was seen)', rows.find((r) => r.v === 'lo_roa_seat').n && !rows.find((r) => r.v === 'lo_roa_stone').n);
    // 先頭の行（序章の石碑）にフォーカスがある
    await shot(p, 'pc_library_top');
    await B.pressUntil(p, 'down', `${V}.list.current().value==='lo_lighthouse_song'`, 6);
    await p.waitForTimeout(150);
    ok('focusing a new row marks it seen', await B.ev(p, '!!RPG.Game.loreSeen.lo_roa_seat'));
    ok('voiced lore: A offers the song', await B.ev(p, `${V}.lorePrompts(${V}.list.current())[0].btn==='a'`));
    await shot(p, 'pc_library_song');
    // 長い文（島の地方の日誌）
    await focusRow(p, 'lo_ev_isles'); await B.press(p, 'down'); await B.press(p, 'up'); await p.waitForTimeout(200);
    ok('focus is on lo_ev_isles', (await B.ev(p, `${V}.list.current().value`)) === 'lo_ev_isles');
    await shot(p, 'pc_library_long');
    const max = await B.ev(p, `${V}.loreMax`);
    if (max > 0) {
      await B.press(p, 'a'); await p.waitForTimeout(100);
      ok('A on a long text → reading', await B.ev(p, `${V}.reading===true`));
      await B.press(p, 'down'); await B.press(p, 'down');
      ok('↓ scrolls the text while reading', (await B.ev(p, `${V}.loreScroll`)) > 0);
      ok('…and the list does not move', (await B.ev(p, `${V}.list.current().value`)) === 'lo_ev_isles');
      await shot(p, 'pc_library_long_scrolled');
      await B.press(p, 'b'); await p.waitForTimeout(100);
      ok('B leaves reading, screen stays open', (await B.ev(p, `${V}.reading`)) === false && (await B.ev(p, TOP)) === 'screen:chronicle');
    } else ok('long text fits on PC (no scroll needed)', true);
    // 外伝
    await focusRow(p, 'lo_ouroboros'); await B.press(p, 'up'); await B.press(p, 'down'); await p.waitForTimeout(200);
    await shot(p, 'pc_library_ouroboros');
    ok('外伝『円環の竜』 is listed with its title', (await B.ev(p, `${V}.list.current().label`)) === (await B.ev(p, 'RPG.DB.lore.lo_ouroboros.title')));
    // 書き写していない物
    await B.ev(p, `(() => { const L = ${V}.list; L.focusIndex(L.rows.findIndex((r) => !r.got)); return true; })()`);
    await p.waitForTimeout(150);
    await shot(p, 'pc_library_unknown');
    const seenN = await B.ev(p, 'Object.keys(RPG.Game.loreSeen).length');
    // L/R の行き来（書庫 → R → 年代記 → L → 書庫、L → 手がかり）
    await B.press(p, 'r'); ok('R from 書庫 wraps to 年代記', (await B.ev(p, `${V}.tab`)) === 0);
    await B.press(p, 'l'); ok('L from 年代記 → 書庫', (await B.ev(p, `${V}.tab`)) === 2);
    await B.press(p, 'l'); ok('L from 書庫 → 手がかり', (await B.ev(p, `${V}.tab`)) === 1);
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 3);
    ok('B closes to the field', (await B.ev(p, TOP)) === 'field');
    // セーブ → 読み込み直し → 印が残る
    ok('save s1', await B.ev(p, `RPG.Save.save('s1')`));
    await p.reload();
    await p.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 60000 });
    await p.evaluate('Promise.resolve(window.RPG && RPG.bootReady).then(() => 1)');
    await B.waitFor(p, `${TOP}==='field'`, 8000);
    ok('load s1 after a reload', await B.ev(p, `RPG.Save.load('s1')`));
    ok('seen marks survive the save', (await B.ev(p, 'Object.keys(RPG.Game.loreSeen || {}).length')) === seenN && (await B.ev(p, '!!RPG.Game.loreSeen.lo_ev_isles')), await B.ev(p, 'RPG.Game.loreSeen'));
    ok('collected lore survive the save', (await B.ev(p, 'RPG.Screens.loreCount().got')) >= 1);
    // 体験版: 行けない地方は 1 行の ？？？
    await B.ev(p, SETUP(false));
    await openChronicle(p);
    await B.pressUntil(p, 'l', `${V}.tab===2`, 3);
    const dr = await B.ev(p, `${V}.list.rows.map((r) => ({v: r.value, l: r.label, lk: r.locked, t: !!r.text, rg: r.region}))`);
    const lockedRg = dr.filter((r) => r.lk).map((r) => r.rg);
    ok('demo: locked regions collapse to one ？？？ row each', lockedRg.length > 0 && lockedRg.every((rg) => dr.filter((r) => r.rg === rg).length === 1));
    ok('demo: no title or text from locked regions', dr.filter((r) => r.lk).every((r) => r.l === '？？？' && !r.t));
    const dn = await B.ev(p, 'RPG.Screens.loreCount()');
    ok('demo: count only open regions', dn.total < Object.keys(await B.ev(p, 'RPG.DB.lore')).length, dn);
    await B.ev(p, `(() => { const L = ${V}.list; L.focusIndex(L.rows.findIndex((r) => r.locked)); return true; })()`);
    await p.waitForTimeout(150);
    await shot(p, 'pc_library_demo_locked');
    ok('0 console errors (PC)', P.errors.length === 0, P.errors.slice(0, 5));
    await P.close();

    // ------------------------------------------------ スマホ縦（タッチ）
    section('スマホ縦 390×844（タッチ）');
    P = await openAt(S, true);
    p = P.page;
    const cdp = await P.ctx.newCDPSession(p);
    const css = (x, y) => B.ev(p, `(() => { const c = document.getElementById('screen').getBoundingClientRect(); return {x: c.left + ${x} / RPG.W * c.width, y: c.top + ${y} / RPG.H * c.height}; })()`);
    const tap = async (x, y) => {
      const q = await css(x, y);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [q] }); await p.waitForTimeout(60);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(250);
    };
    const drag = async (x, y0, y1) => {
      const a = await css(x, y0), b = await css(x, y1);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] }); await p.waitForTimeout(50);
      for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x, y: a.y + (b.y - a.y) * i / 6 }] }); await p.waitForTimeout(40); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(200);
    };
    await B.ev(p, SETUP(true));
    await openChronicle(p);
    await p.waitForTimeout(300);
    const tr = await B.ev(p, `(() => { const r = ${V}.tabRects[2]; return {x: r.x + r.w / 2, y: r.y + r.h / 2}; })()`);
    await tap(tr.x, tr.y);
    ok('touch: tap the 書庫 tab', (await B.ev(p, `${V}.tab`)) === 2);
    await p.waitForTimeout(200);
    await shot(p, 'phone_library_top');
    // 行を押す → 右（下）の札に全文
    const ri = await B.ev(p, `(() => { const L = ${V}.list; const i = L.rows.findIndex((r) => r.value === 'lo_lighthouse_song'); L.focusIndex(i); const rr = L.rowRect(i); return rr ? {x: rr.x + rr.w / 2, y: rr.y + rr.h / 2} : null; })()`);
    if (ri) { await B.ev(p, `${V}.list.focusIndex(0)`); await tap(ri.x, ri.y); }
    ok('touch: tap a row focuses it', (await B.ev(p, `${V}.list.current().value`)) === 'lo_lighthouse_song');
    await focusRow(p, 'lo_ev_isles'); await p.waitForTimeout(250);
    await shot(p, 'phone_library_long');
    const pmax = await B.ev(p, `${V}.loreMax`);
    ok('phone: the long journal overflows (scrollable)', pmax > 0, pmax);
    const lr = await B.ev(p, `${V}.loreRect`);
    if (lr) await drag(lr.x + lr.w / 2, lr.y + lr.h * 0.8, lr.y + lr.h * 0.2);
    ok('touch: dragging the text panel scrolls it', (await B.ev(p, `${V}.loreScroll`)) > 0, await B.ev(p, `${V}.loreScroll`));
    ok('touch: …without changing the row', (await B.ev(p, `${V}.list.current().value`)) === 'lo_ev_isles');
    await shot(p, 'phone_library_long_scrolled');
    await focusRow(p, 'lo_ouroboros'); await p.waitForTimeout(250);
    await shot(p, 'phone_library_ouroboros');
    ok('0 console errors (phone)', P.errors.length === 0, P.errors.slice(0, 5));
    await P.close();
  } catch (e) {
    ok('no exception', false, String(e && e.stack || e));
    try { if (P) await P.close(); } catch (e2) { /* */ }
  }
  await B.stop(S);
  done('test_library_browser');
})();
