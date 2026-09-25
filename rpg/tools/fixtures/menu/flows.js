#!/usr/bin/env node
// Browser flow tests for menus / shops / title / game over (Playwright).
// Drives the real UI with the D-pad + A + B keys only and asserts on R.Game.
//   node tools/build.js && node tools/fixtures/menu/make_harness.js && node tools/fixtures/menu/flows.js [filter]
'use strict';
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const HARNESS = process.env.HARNESS || '/tmp/claude-0/menu/harness.html';
const OUT = process.env.OUT || '/tmp/claude-0/menu/flows';
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyZ', b: 'KeyX' };
const filter = process.argv[2] || '';

async function main() {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 700 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + HARNESS);
  await page.waitForTimeout(1200);

  const ev = (js) => page.evaluate(`(async()=>{ const R = window.RPG; return (${js}); })()`);
  const keys = async (seq) => {
    for (let tok of seq.split(',').map((s) => s.trim()).filter(Boolean)) {
      let n = 1;
      const m = tok.match(/^(.*)\*(\d+)$/);
      if (m) { tok = m[1]; n = +m[2]; }
      for (let k = 0; k < n; k++) {
        if (tok.startsWith('w')) { await page.waitForTimeout(+tok.slice(1) || 200); continue; }
        await page.keyboard.down(KEY[tok]); await page.waitForTimeout(40); await page.keyboard.up(KEY[tok]); await page.waitForTimeout(tok === 'a' || tok === 'b' ? 260 : 90);
      }
    }
  };
  const setup = async (map, spawn, opts) => {
    await ev(`(R.Engine.clear(), R.Engine.fade(0,0), R.fxMenu.setup(${JSON.stringify(opts || {})}), R.Field.start('${map}','${spawn}'), 1)`);
    await page.waitForTimeout(700);
  };
  let pass = 0, fail = 0;
  const check = (name, cond, info) => {
    if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, info !== undefined ? JSON.stringify(info) : ''); }
  };
  const shot = (name) => page.locator('#screen').screenshot({ path: path.join(OUT, name + '.png') });
  // poll until a page condition holds (jingles run much longer headless than their nominal length)
  const until = async (js, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 15000)) { if (await ev(js)) return true; await page.waitForTimeout(100); }
    return false;
  };
  const msgShown = `!!(R.UI._msg && !R.UI._msg.closed && R.UI._msg.resolveText) && R.Engine.fadeAlpha === 0`;
  const onlyField = async () => JSON.stringify(await ev(`R.Engine.layers.map(l=>l.constructor.name)`)) === '["FieldLayer"]';

  const T = {};
  T.herb = async () => {
    await setup('fx_world', 'start');
    const before = await ev(`({n:R.Game.inv.herb, hp:R.Game.party[0].hp})`);
    await ev(`(R.Menu.open(), 1)`); await keys('w300,a,w200,a,w200,a,w200,a,w300,a,w300,b,w200,b,w200,b,w300');
    const after = await ev(`({n:R.Game.inv.herb, hp:R.Game.party[0].hp})`);
    check('herb consumed', after.n === before.n - 1, [before, after]);
    check('herb healed', after.hp > before.hp, [before, after]);
    check('menu closed', await onlyField());
  };
  T.wing = async () => {
    await setup('fx_world', 'start');
    const idx = await ev(`R.State.items(it=>it.type==='consumable').map(e=>e.id).indexOf('wing')`);
    const dest = await ev(`(()=>{ const l = R.Field.teleportList()[1]; const loc = R.DB.locations[l.id]; return loc && loc.map; })()`);
    const p0 = await ev(`R.debug.pos()`);
    await ev(`(R.Menu.open(), 1)`); await keys(`w300,a,w200,down*${idx},a,w200,a,w300,down,a,w400,a,w2000`);
    const st = await ev(`({wing:R.Game.inv.wing, pos:R.debug.pos()})`);
    check('wing consumed', st.wing === 2, st);
    check('teleported to the 2nd destination', st.pos && st.pos.map === dest && JSON.stringify(st.pos) !== JSON.stringify(p0), [dest, p0, st]);
    check('no menu left open', await onlyField());
  };
  T.exit = async () => {
    await setup('fx_dungeon_1', 'entrance');
    const k = await ev(`R.Rules.fieldActions(R.Game.party[2]).indexOf('mage_exit')`);
    const mp0 = await ev(`R.Game.party[2].mp - R.Rules.mpCost(R.Game.party[2], 'mage_exit')`);
    await ev(`(R.Menu.open(), 1)`); await keys(`w300,right,a,w300,right,right,down*${k},a,w400,a,w2200`);
    const st = await ev(`({mp:R.Game.party[2].mp, pos:R.debug.pos()})`);
    check('exit spell cost MP', st.mp === mp0, [mp0, st]);
    check('left the dungeon', st.pos.map === 'fx_world', st);
  };
  T.equip = async () => {
    await setup('fx_world', 'start');
    await ev(`(R.Menu.equipScreen(), 1)`);
    const ids = await ev(`R.Menu.equipCandidates(R.Game.party[0],'weapon')`);
    const k = ids.indexOf('bastard_sword') + 1;
    await keys(`w300,a,w200,down*${k - 1},w100,a,w300`);
    const st = await ev(`({w:R.Game.party[0].equip.weapon, iron:R.Game.inv.iron_sword||0, bs:R.Game.inv.bastard_sword||0})`);
    check('equipped bastard sword', st.w === 'bastard_sword' && st.iron === 1 && st.bs === 0, st);
    await keys('down*5,a,w400');
    await shot('equip_after_optimize');
    const opt = await ev(`R.Game.party[0].equip`);
    check('optimize keeps a weapon', !!opt.weapon, opt);
    await keys('a,w200,b,w300');
    check('equip screen closed', await onlyField());
  };
  T.job = async () => {
    await setup('fx_world', 'start');
    await ev(`(R.Menu.jobScreen({member:1}), 1)`);
    // Non: priest → whitemage (row 2 of the board: 'whitemage' is unlocked at priest 3)
    const pos = await ev(`(()=>{ const rows=[]; for (const id of Object.keys(R.DB.jobs)) { const t=R.DB.jobs[id].tier; (rows[t-1]=rows[t-1]||[]).push(id); } return rows[1].indexOf('whitemage'); })()`);
    await keys(`w300,down,left*9,right*${pos},a,w300,a,w500`);
    await shot('job_changed');
    const st = await ev(`R.Game.party[1].job`);
    check('Non changed job to whitemage', st === 'whitemage', st);
    await keys('a,w300,b,w300');
    check('job screen closed', await onlyField());
  };
  T.learn = async () => {
    await setup('fx_world', 'start');
    const before = await ev(`R.Game.party[1].jobs.priest.jp`);
    await ev(`(R.Menu.learnScreen(R.Game.party[1], 'priest'), 1)`);
    // find the first affordable, unlearned ability
    const k = await ev(`(()=>{ const c=R.Game.party[1]; return R.Rules.jobAbilities('priest').findIndex(a=>R.Rules.canLearn(c,a).ok); })()`);
    const id = await ev(`R.Rules.jobAbilities('priest')[${k}]`);
    await keys(`w300,down*${k},a,w300,a,w400,a,w300`);
    await shot('learned');
    const st = await ev(`({jp:R.Game.party[1].jobs.priest.jp, learned:R.Rules.learned(R.Game.party[1], '${id}')})`);
    check('ability learned with JP', st.learned && st.jp < before, [id, before, st]);
    await keys('b,w200,b,w200,b,w200,b,w300');
  };
  T.set = async () => {
    await setup('fx_world', 'start');
    await ev(`(R.Menu.setScreen({member:2}), 1)`);
    // metem: field slot → pick the first learned field ability
    await keys('w300,down*3,a,w200,down,a,w300');
    const st = await ev(`R.Game.party[2].set.field`);
    check('field ability set', !!st, st);
    await keys('b,w300');
    check('set screen closed', await onlyField());
  };
  T.order = async () => {
    await setup('fx_world', 'start');
    await ev(`(R.Menu.orderScreen(), 1)`);
    await keys('w300,a,w200,down,down,a,w300,b,w300');
    const st = await ev(`R.Game.party.map(c=>c.id).join(',')`);
    check('party reordered', st === 'metem,non,yuki', st);
  };
  T.shop = async () => {
    await setup('fx_world', 'start');
    const g0 = await ev(`R.Game.gold`), h0 = await ev(`R.Game.inv.herb`);
    await ev(`(R.Shop.open('regnas_item').then(()=>window.__shop=1), 1)`);
    await keys('w500,a,w300,a,w300,up,up,w100,a,w300,a,w300');
    const st = await ev(`({g:R.Game.gold, h:R.Game.inv.herb})`);
    check('bought 3 herbs', st.h === h0 + 3 && st.g === g0 - 24, [g0, h0, st]);
    // sell 1 herb
    await keys('b,w300,down,a,w300,a,w300,a,w300,a,w300');
    const st2 = await ev(`({g:R.Game.gold, h:R.Game.inv.herb})`);
    check('sold 1 herb for half price', st2.h === st.h - 1 && st2.g === st.g + 4, [st, st2]);
    await keys('a,w300,b,w400,down,down,a,w300,a,w400');
    check('shop closed', (await ev(`window.__shop`)) === 1 && await onlyField());
  };
  T.gear = async () => {
    await setup('fx_world', 'start');
    const g0 = await ev(`R.Game.gold`);
    await ev(`(R.Shop.open('milt_weapon').then(()=>window.__gear=1), 1)`);
    // hand axe (warrior can equip) → buy → equip now → yuki → sell old sword
    const k = await ev(`R.DB.shops.milt_weapon.items.indexOf('hand_axe')`);
    await keys(`w500,a,w300,down*${k},a,w400,a,w300`);
    await shot('gear_pick');
    await keys('a,w300,a,w400');
    const st = await ev(`({g:R.Game.gold, w:R.Game.party[0].equip.weapon, iron:R.Game.inv.iron_sword||0})`);
    check('bought + equipped hand axe, sold old sword', st.w === 'hand_axe' && st.iron === 0 && st.g === g0 - 300 + 140, [g0, st]);
    await keys('b,w300,down,down,a,w300,a,w400');
    check('weapon shop closed', await onlyField());
  };
  T.inn = async () => {
    await setup('fx_town', 'entrance', { dead: true });
    await ev(`(R.Events.run(async ev => { window.__inn = await ev.inn(20); }), 1)`);
    await keys('w500,a,w300,a,w300');
    await until(`R.Engine.fadeAlpha > 0`, 5000); // the night fade has begun
    await until(msgShown);
    await keys('a,w300,a,w400');
    await until(`window.__inn !== undefined`, 3000);
    const st = await ev(`({inn:window.__inn, full:R.Game.party.map(c=>c.hp===R.Rules.stats(c).hp), r:R.Game.respawn, g:R.Game.gold})`);
    check('inn healed everyone', st.inn === true && st.full.every(Boolean), st);
    check('inn respawn set', st.r && st.r.map === 'fx_town', st);
  };
  T.church = async () => {
    await setup('fx_town', 'entrance', { dead: true });
    const g0 = await ev(`R.Game.gold`);
    await ev(`(R.Events.run(async ev => { await ev.church(); window.__ch = 1; }), 1)`);
    await keys('w500,down,a,w300,a,w300,a,w300,a,w300');
    const st = await ev(`({hp:R.Game.party[2].hp, g:R.Game.gold})`);
    check('church revived metem', st.hp > 0 && st.g === g0 - 140, [g0, st]);
    await keys('w300,down,down,a,w300,a,w300,a,w300');
    const st2 = await ev(`({p:!!R.Game.party[1].status.poison, g:R.Game.gold})`);
    check('church cured poison', !st2.p && st2.g === st.g - 10, [st, st2]);
    await keys('w300,down*3,a,w300,a,w400');
    check('church closed', (await ev(`window.__ch`)) === 1 && await onlyField());
  };
  T.save = async () => {
    await ev(`(localStorage.clear(), 1)`);
    await setup('fx_town', 'entrance');
    await ev(`(R.Game.gold = 777, R.Menu.saveScreen().then(v=>window.__sv=v), 1)`);
    await keys('w400,a,w400');
    await until(msgShown);
    await keys('a,w300');
    await until(`window.__sv !== undefined`);
    check('saved to slot 1', (await ev(`window.__sv`)) === true);
    const list = await ev(`R.Save.list()`);
    check('slot 1 has a summary', list[0] && list[0].summary.gold === 777, list);
    await ev(`(R.Game.gold = 1, R.Title.start(), 1)`);
    await page.waitForTimeout(1300);
    await keys('a,w500,a,w400,a,w2200');
    const st = await ev(`({g:R.Game.gold, pos:R.debug.pos()})`);
    check('continue restored the save', st.g === 777 && st.pos.map === 'fx_town', st);
  };
  T.settings = async () => {
    await setup('fx_world', 'start');
    await ev(`(R.Settings.windowColor='black', R.Menu.settings().then(()=>window.__set=1), 1)`);
    await keys('w300,down*5,right,w100');
    await shot('settings_blue');
    const st = await ev(`({c:R.Settings.windowColor, ls: JSON.parse(localStorage.getItem('luminas_crest_settings')||'{}').windowColor})`);
    check('window color changes & persists', st.c === 'blue' && st.ls === 'blue', st);
    await keys('left,b,w300');
    check('settings closed', (await ev(`window.__set`)) === 1);
  };
  T.gameover = async () => {
    await setup('fx_world', 'start');
    await ev(`(R.Game.respawn = {map:'fx_town', spawn:'entrance'}, R.Game.gold = 1001, R.Game.party.forEach(c=>c.hp=0), R.GameOver.run().then(()=>window.__go=1), 1)`);
    await page.waitForTimeout(1600);
    await keys('a,w2400,a,w400');
    const st = await ev(`({go:window.__go, g:R.Game.gold, hp:R.Game.party.map(c=>c.hp), pos:R.debug.pos()})`);
    check('game over: half gold, revived, at respawn', st.go === 1 && st.g === 500 && st.hp.every((h) => h > 0) && st.pos.map === 'fx_town', st);
  };
  T.book = async () => {
    await setup('fx_world', 'start');
    await ev(`(R.Menu.bookScreen().then(()=>window.__bk=1), 1)`);
    await keys('w300,a,w200,right,w100,down,w100');
    await shot('book_detail');
    await keys('b,w200,b,w300');
    check('book closed', (await ev(`window.__bk`)) === 1 && await onlyField());
  };
  T.status = async () => {
    await setup('fx_world', 'start');
    await ev(`(R.Menu.statusScreen().then(()=>window.__st=1), 1)`);
    await keys('w300,right,down,right,down,a,b,w300');
    check('status closed', (await ev(`window.__st`)) === 1 && await onlyField());
  };

  for (const name of Object.keys(T)) {
    if (filter && !name.includes(filter)) continue;
    console.log(name);
    try { await T[name](); } catch (e) { fail++; console.log('  FAIL (exception)', e.message); }
  }
  const errs = errors.filter((e) => !/missing graphic/.test(e));
  if (errs.length) { console.log('\npage errors:\n' + errs.join('\n')); fail += errs.length; }
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exit(2); });
