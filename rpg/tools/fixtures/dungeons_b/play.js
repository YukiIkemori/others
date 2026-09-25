// Scripted in-game checks for dungeons B (real field, events and battle scene; battles are won
// automatically after ~2 s so the scripts after them run). Screenshots go to OUT.
//   node tools/build.js && node tools/fixtures/dungeons_b/play.js <ice|volcano|star|demon|king|misc|tour> [maps]
//   OUT=/tmp/somewhere node tools/fixtures/dungeons_b/play.js king
'use strict';
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = process.env.OUT || '/tmp/claude-0/dungeons_b/play';
require('fs').mkdirSync(OUT, { recursive: true });
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyZ', b: 'KeyX' };

(async () => {
  const which = process.argv[2] || 'ice';
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 700 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => { errs.push(String(e.stack || e)); console.log('[pageerror]', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text()); });
  await page.goto('file://' + ROOT + '/dist/index.html');
  await page.waitForTimeout(1500);
  const ev = (js) => page.evaluate(`(async()=>{ return (${js}); })()`);
  const wait = (ms) => page.waitForTimeout(ms);
  const press = async (k, n = 1, gap = 120) => { for (let i = 0; i < n; i++) { await page.keyboard.down(KEY[k]); await wait(60); await page.keyboard.up(KEY[k]); await wait(gap); } };
  /** walk n tiles (holds the direction until the leader has moved n tiles or is stopped by an event) */
  const walk = async (k, n = 1) => {
    for (let i = 0; i < n; i++) {
      const p0 = await ev('JSON.stringify(RPG.Field.pos())');
      await page.keyboard.down(KEY[k]);
      for (let t = 0; t < 30; t++) { await wait(20); const p1 = await ev('JSON.stringify(RPG.Field.pos())'); if (p1 !== p0 && JSON.parse(p1).x + ',' + JSON.parse(p1).y !== JSON.parse(p0).x + ',' + JSON.parse(p0).y) break; }
      await page.keyboard.up(KEY[k]);
      await wait(160);
      if (await ev('RPG.Events.busy()')) break;
    }
  };
  let shotN = 0;
  const shot = async (name) => { const f = path.join(OUT, which + '_' + String(++shotN).padStart(2, '0') + '_' + name + '.png'); await page.locator('#screen').screenshot({ path: f }); console.log('shot', f); };
  const busy = () => ev('RPG.Events.busy() || !!(RPG.Battle && RPG.Battle.current)');
  /** press A through messages until the event ends (max n presses); shoot every `every` presses */
  const advance = async (label, n = 60, every = 0) => {
    for (let i = 0; i < n; i++) {
      if (!(await busy())) return i;
      if (every && i % every === 0) await shot(label + i);
      await press('a', 1, 160);
    }
    return n;
  };
  const state = () => ev(`({ map: RPG.Field.map && RPG.Field.map.id, pos: RPG.Field.pos(), flags: Object.keys(RPG.Game.flags), inv: RPG.Game.inv, obj: RPG.Game.objective })`);
  // battles: show the real scene briefly, then win
  await ev(`(() => { const R = RPG; const orig = R.Battle.start; R.Battle.start = (o) => { const p = orig(o); setTimeout(() => { if (R.Battle.current) R.Battle.current.close('win'); }, 2200); return p; }; R.__battleShots = 0; return true; })()`);
  const boot = async (map, spawn, lv) => {
    await ev(`RPG.debug.newGameAt('${map}', ${JSON.stringify(spawn)})`);
    await wait(1200);
    await ev(`(RPG.debug.level(${lv || 30}), RPG.debug.noEncounter(true), RPG.Settings.msgSpeed = 3, true)`);
  };
  const S = {};

  S.ice = async () => {
    await boot('ice_cave_2', 'up', 22);
    await ev(`RPG.debug.warp('ice_cave_2', {x:33, y:9})`); await wait(600);
    await shot('before');
    await walk('up', 3);
    await wait(400); await shot('talk');
    await advance('msg', 8, 2);
    await wait(900); await shot('battle');
    await wait(2000);
    await advance('after', 40, 3);
    console.log(JSON.stringify(await state()));
    await shot('cleared');
    // exit circle
    await ev(`RPG.debug.warp('ice_cave_2', {x:33, y:4})`); await wait(500);
    await shot('circle');
    await walk('up', 1); await wait(400); await shot('ask');
    await advance('exit', 10);
    await wait(800);
    console.log(JSON.stringify(await state()));
    await shot('world');
    // the crack in ice_cave_1
    await ev(`RPG.debug.warp('ice_cave_1', {x:44, y:4})`); await wait(600);
    await shot('crack');
    await walk('up', 1); await walk('left', 1); await wait(1200);
    console.log(JSON.stringify(await state()));
    await shot('ledge');
  };

  S.volcano = async () => {
    await boot('volcano_1', 'entrance', 26);
    await shot('entrance');
    await walk('up', 2); await wait(300);
    await shot('locked');
    await advance('lock', 5);
    await ev(`RPG.debug.give('gold_key')`);
    await walk('up', 3); await wait(500);
    await shot('inside');
    await ev(`RPG.debug.warp('volcano_1', {x:25, y:23})`); await wait(500);
    const hp0 = await ev(`RPG.Game.party.map(c=>c.hp).join(',')`);
    await walk('up', 2); await wait(300);
    const hp1 = await ev(`RPG.Game.party.map(c=>c.hp).join(',')`);
    console.log('lava hp', hp0, '→', hp1);
    await shot('lava');
    await ev(`RPG.debug.warp('volcano_2', {x:27, y:15})`); await wait(600);
    await shot('approach');
    await walk('up', 4); await wait(300);
    await shot('talk');
    await advance('msg', 8, 2);
    await wait(900); await shot('battle');
    await wait(2000);
    await advance('after', 30, 3);
    await shot('cleared');
    await ev(`RPG.debug.warp('volcano_2', {x:27, y:6})`); await wait(500);
    await walk('up', 2);
    await shot('crest');
    await press('a', 1, 300);
    await advance('crest', 30, 2);
    console.log(JSON.stringify(await state()));
  };

  S.star = async () => {
    await boot('star_tower_2', 'down', 30);
    await ev(`RPG.debug.warp('star_tower_2', {x:17, y:25})`); await wait(500);
    await shot('compass');
    await walk('up', 1); await press('a', 1, 300);
    await advance('hint', 10, 1);
    await walk('left', 1); await walk('up', 2); await walk('right', 1); await walk('up', 2); await wait(900);
    console.log(JSON.stringify(await state()));
    await shot('floor3');
    await ev(`RPG.debug.warp('star_tower_3', {x:33, y:13})`); await wait(500);
    await walk('down', 1); await wait(900);
    console.log(JSON.stringify(await state()));
    await shot('gap');
    await ev(`RPG.debug.warp('star_tower_4', 'down')`); await wait(600);
    await shot('top');
    await ev(`RPG.debug.warp('star_tower_4', {x:20, y:13})`); await wait(400);
    await walk('up', 3); await wait(300);
    await shot('talk');
    await advance('msg', 12, 2);
    await wait(900); await shot('battle');
    await wait(2000);
    await advance('after', 30, 3);
    await shot('cleared');
    await ev(`RPG.debug.warp('star_tower_4', {x:20, y:6})`); await wait(500);
    await walk('up', 1); await press('a', 1, 300);
    await advance('crest', 30, 3);
    console.log(JSON.stringify(await state()));
  };

  S.demon = async () => {
    await boot('demon_castle_1', 'entrance', 38);
    await wait(500);
    await shot('voice');
    await advance('voice', 20, 2);
    await ev(`RPG.debug.warp('demon_castle_1', {x:14, y:25})`); await wait(500);
    await walk('left', 1); await press('a', 1, 300);
    await shot('seal');
    await advance('seal', 6);
    // general 1
    await ev(`RPG.debug.warp('demon_castle_3', {x:31, y:12})`); await wait(600);
    await shot('general1');
    await walk('up', 10); await wait(300);
    await advance('g1', 16, 3);
    await wait(900); await shot('battle1');
    await wait(2000);
    await advance('g1after', 30, 3);
    await shot('g1cleared');
    // shortcut: floor 3 circle → floor 1
    await ev(`RPG.debug.warp('demon_castle_3', {x:32, y:4})`); await wait(400);
    await walk('right', 1); await wait(1200);
    console.log(JSON.stringify(await state()));
    await shot('shortcut');
    // general 2
    await ev(`RPG.debug.warp('demon_castle_4', {x:27, y:14})`); await wait(600);
    await shot('general2');
    await walk('up', 10); await wait(300);
    await advance('g2', 16, 3);
    await wait(900); await shot('battle2');
    await wait(2000);
    await advance('g2after', 30, 3);
    // the king
    await ev(`RPG.debug.warp('demon_castle_5', {x:24, y:14})`); await wait(700);
    await shot('throne');
    await walk('up', 10); await wait(300);
    await advance('king', 14, 2);
    await wait(900); await shot('kbattle1');
    await wait(2000);
    await advance('transform', 14, 1);
    await wait(900); await shot('kbattle2');
    await wait(2000);
    await advance('finale', 16, 1);
    await wait(3000); await shot('ending1');
    console.log(JSON.stringify(await state()));
  };

  S.king = async () => {
    await boot('demon_castle_5', 'down', 40);
    await ev(`(RPG.debug.flag('boss_general1_done'), RPG.debug.flag('boss_general2_done'))`);
    await ev(`RPG.debug.warp('demon_castle_5', {x:24, y:14})`); await wait(700);
    await shot('throne');
    await walk('up', 10);
    await advance('king', 14, 7);
    await wait(900);
    await wait(2000);
    await advance('transform', 14, 3);
    await wait(900);
    await wait(2000);
    await advance('finale', 40, 4);
    for (let i = 0; i < 12; i++) { await wait(1500); await shot('ending' + i); await press('a', 1, 200); }
    console.log(JSON.stringify(await state()));
  };

  S.tour = async () => {
    const T = {
      ice_cave_1: [[25, 20], [7, 16], [6, 6], [27, 5], [43, 21]],
      ice_cave_2: [[20, 27], [36, 30], [47, 5], [9, 27]],
      volcano_1: [[46, 16], [25, 17], [8, 20], [38, 21], [25, 33]],
      volcano_2: [[8, 37], [42, 33], [27, 16], [8, 8], [48, 12]],
      star_tower_1: [[22, 34], [22, 20], [9, 33], [20, 6], [35, 20]],
      star_tower_2: [[37, 7], [9, 9], [31, 22], [30, 32]],
      star_tower_3: [[22, 12], [33, 19], [7, 7], [25, 30], [13, 22]],
      star_tower_4: [[20, 20], [8, 8]],
      demon_castle_1: [[30, 40], [30, 27], [30, 10], [43, 18], [15, 10]],
      demon_castle_2: [[30, 24], [51, 24], [10, 16], [15, 25], [45, 42]],
      demon_castle_3: [[10, 40], [30, 26], [31, 12]],
      demon_castle_4: [[17, 23], [27, 14], [45, 31], [30, 40]],
      demon_castle_5: [[24, 30], [4, 20]],
    };
    const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(T);
    await boot('ice_cave_1', 'entrance', 30);
    await ev(`(RPG.debug.give('gold_key'), RPG.debug.give('silver_key'))`);
    for (const m of only) for (const [x, y] of T[m]) {
      await ev(`RPG.debug.warp('${m}', {x:${x}, y:${y}})`);
      await wait(700);
      await ev(`RPG.Field.layer && (RPG.Field.layer.banner = null)`);
      await shot(m + '_' + x + '_' + y);
    }
  };

  S.misc = async () => {
    await boot('star_tower_1', 'entrance', 30);
    await walk('up', 6); await wait(300);
    await shot('golddoor');
    await advance('gd', 4);
    await ev(`RPG.debug.warp('star_tower_1', {x:28, y:9})`); await wait(500);
    await walk('right', 1); await press('a', 1, 300);
    await shot('mimic');
    await advance('mimic', 12, 2);
    console.log(JSON.stringify(await state()));
    await ev(`(RPG.debug.flag('demon_voice_heard'), RPG.debug.flag('boss_general2_done'), RPG.debug.warp('demon_castle_1', {x:45, y:25}))`); await wait(600);
    await shot('sealopen');
    await walk('right', 2); await wait(1200);
    console.log(JSON.stringify(await state()));
    await shot('gate_e');
    await walk('left', 1); await walk('right', 1); await wait(1200);
    console.log(JSON.stringify(await state()));
    await ev(`RPG.debug.noEncounter(false)`);
    await ev(`RPG.debug.warp('volcano_2', {x:8, y:37})`); await wait(500);
    for (let i = 0; i < 40 && !(await ev('!!RPG.Battle.current')); i++) { await walk(i % 2 ? 'left' : 'right', 1); }
    await wait(600); await shot('encounter');
  };

  await S[which]();
  if (errs.length) console.log('ERRORS', errs.length);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
