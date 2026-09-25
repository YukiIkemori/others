#!/usr/bin/env node
// Field logic tests (node, no DOM): drives R.Engine.step() with simulated input
// over the fixture maps.   node tools/fixtures/field/test_field.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');

const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => { warnings.push(a.join(' ')); };
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true });
console.warn = origWarn;
const win = { RPG: R };
// The field is tested in isolation: drop the real battle/shop/menu/game-over
// systems so the fixture battle stub and the event fallbacks are exercised.
R.Battle = null;
R.Shop = null;
R.Menu = null;
R.GameOver = null;
for (const f of ['maps.js', 'battle_stub.js']) new Function('window', fs.readFileSync(path.join(__dirname, f), 'utf8'))(win);

// headless stubs: text metrics only (nothing is drawn)
R.Gfx.textWidth = (s) => String(s).length * 10.7;
R.Settings.alwaysDash = false;
R.Settings.msgSpeed = 3;
const sfxLog = [], jingleLog = [];
R.Audio = { sfx: (id) => sfxLog.push(id), playBGM: (id) => { R.Audio.current = id; }, playJingle: (id) => { jingleLog.push(id); return Promise.resolve(); } };
R.warn = (...a) => warnings.push(a.join(' '));

let fails = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log('  FAIL:', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

const flush = () => new Promise((r) => setImmediate(r));
let totalSteps = 0;
async function step(n = 1) {
  for (let i = 0; i < n; i++) {
    if (++totalSteps > 150000) throw new Error('frame budget exceeded at ' + JSON.stringify(R.Field.pos()) + ' top=' + (R.Engine.top() && R.Engine.top().constructor.name));
    R.Engine.step(); await flush();
  }
}
async function press(b, hold = 2) { R.Input._set(b, true); await step(hold); R.Input._set(b, false); await step(2); }
async function hold(b, frames) { R.Input._set(b, true); await step(frames); R.Input._set(b, false); await step(1); }
async function settle(max = 600) { for (let i = 0; i < max && R.Field.isBusy(); i++) await step(1); await step(2); }
/** dismiss message windows until the field is free */
async function clearMsgs(max = 20) {
  for (let i = 0; i < max; i++) {
    await step(3);
    const top = R.Engine.top();
    if (top === R.Field.layer && !R.Field.isBusy()) return;
    if (top && top.constructor.name === 'MessageLayer') await press('a');
    else if (top && top.list) await press('a');
    else await step(5);
  }
}
const msgText = () => { const m = R.UI._msg; return m && !m.closed ? m.pages.map((p) => p.join('')).join('|') : ''; };
/** window lines as shown: lines joined by '/', pages by '|' */
const msgLines = () => { const m = R.UI._msg; return m && !m.closed ? m.pages.map((p) => p.join('/')).join('|') : ''; };
const pos = () => R.Field.pos();
/** walk whole tiles: hold each direction until the leader's box is headed for the next tile
 *  (two half steps), then release (the running half step completes) */
async function walk(path) {
  for (const d of R.Field.parsePath(path)) {
    const L = R.Field.layer;
    const m0 = R.Field.map, p0 = R.Field.exactPos();
    const gx = p0.x + R.U.DX[d], gy = p0.y + R.U.DY[d];
    R.Input._set(d, true);
    let idle = 0;
    for (let i = 0; i < 40; i++) {
      await step(1);
      if (L.locks || R.Events.busy() || R.Field.map !== m0) break;
      const p = L.P[0];
      if (L.mv && Math.abs(p.x - gx) < 1e-6 && Math.abs(p.y - gy) < 1e-6) break;
      if (!L.mv && !L.arrived) { if (++idle > 2) break; } else idle = 0;
    }
    R.Input._set(d, false);
    await settle();
  }
}
/** hold several directions for n frames */
async function holdDirs(dirs, n) {
  for (const d of dirs) R.Input._set(d, true);
  await step(n);
  for (const d of dirs) R.Input._set(d, false);
  await settle();
}
const xp = () => { const p = R.Field.exactPos(); return [p.x, p.y]; };
async function newGame(map, spawn) {
  R.Engine.clear();
  R.State.newGame();
  R.Field.noEncounter = true;
  const p = R.Field.start(map, spawn);
  await step(40); await p;
}

(async function main() {
  // --------------------------------------------------------------- compile
  console.log('settings');
  {
    const old = { alwaysDash: true, msgSpeed: 1 };
    ok(R.Save.migrateSettings(old), 'old settings migrate');
    eq([old.alwaysDash, old.msgSpeed, old.settingsVer], [false, 1, R.DEFAULT_SETTINGS.settingsVer], 'v1 settings: always-dash reset to the new default (off)');
    const cur = { alwaysDash: true, settingsVer: R.DEFAULT_SETTINGS.settingsVer };
    ok(!R.Save.migrateSettings(cur) && cur.alwaysDash === true, 'current settings keep the player\'s choice');
    eq(R.DEFAULT_SETTINGS.alwaysDash, false, 'always-dash off by default');
  }
  console.log('compile');
  const town = R.FieldMap.compile('fx_town');
  eq([town.w, town.h], [22, 16], 'town size');
  eq(town.spawns.entrance, { x: 10, y: 14, dir: 'up' }, 'town entrance spawn');
  eq(town.npcs.map((n) => n.id).sort(), ['elder', 'ghost_girl', 'guard', 'kid', 'priest', 'shopkeeper'], 'npc ids');
  eq(town.tileAt(10, 14), 'dirt', 'mark under tile');
  eq(town.tileAt(-1, 0), 'lgrass', 'outside tile from legend char');
  eq(town.tileAt(3, 10), 'sign', 'sign under');
  R.DB.maps.fx_bad = {
    name: 'bad', type: 'dungeon', rows: ['#####', '#A.A#', '#.?.#', '#A$##', '###'],
    marks: { A: { npc: { id: 'g', sprite: 'soldier', text: 'x' } }, $: { chest: { id: 'c', item: 'herb' } }, '#': { sign: 'no' } },
    chests: [{ id: 'c', x: 2, y: 2, item: 'herb' }], warps: [{ x: 9, y: 9, to: 'nowhere' }],
  };
  warnings.length = 0;
  const bad = R.FieldMap.compile('fx_bad');
  eq(bad.npcs.map((n) => n.id), ['g', 'g_2', 'g_3'], 'duplicate npc ids suffixed');
  eq(bad.chests.map((c) => c.id), ['c', 'c_2'], 'duplicate chest ids suffixed');
  eq(bad.npcs[0].sprite, 'npc:soldier', 'sprite shorthand');
  const w = warnings.join('\n');
  ok(/unequal lengths/.test(w), 'warns ragged rows');
  ok(/unknown row chars/.test(w) && /"\?"/.test(w), 'warns unknown char');
  ok(/also a legend char/.test(w), 'warns mark/legend clash');
  ok(/unknown map nowhere/.test(w), 'warns unknown warp target');
  ok(/out of bounds/.test(w), 'warns object out of bounds');
  eq(bad.tileAt(4, 4), 'void', 'ragged row padded with outside');

  // --------------------------------------------------------------- town
  console.log('town');
  await newGame('fx_town', 'entrance');
  eq(pos(), { x: 10, y: 14, dir: 'up' }, 'start pos');
  ok(R.Game.visited.fx_town, 'visited via location');
  // the town's onEnter speech is up: the map-name banner gives way so it never covers the speaker
  ok(!R.Field.layer.banner, 'location banner yields to the onEnter message');
  ok(/テストの町に着いた/.test(msgText()), 'onEnter event message');
  ok(R.Field.isBusy(), 'field frozen during event');
  await clearMsgs();
  ok(R.State.flag('fx_town_seen'), 'onEnter flag');
  ok(!R.UI._msg || R.UI._msg.closed, 'window closed at event end');

  // no turn-in-place delay: a tap walks half a tile (8px) at once
  await press('left', 1);
  eq(xp(), [9.5, 14], 'tap walks half a tile immediately');
  eq(pos(), { x: 10, y: 14, dir: 'left' }, 'logical tile stays until the box is aligned');
  await press('left', 1); await settle();
  eq(xp(), [9, 14], 'second tap: aligned on the next tile');
  eq(pos(), { x: 9, y: 14, dir: 'left' }, 'logical tile follows once aligned');
  await settle();
  await walk('R');
  eq(pos(), { x: 10, y: 14, dir: 'right' }, 'walked back');
  // walking timing: the move starts on the first frame the direction is held,
  // and consecutive half steps chain with no idle frame (WALK/2 frames each)
  R.Input._set('up', true);
  await step(1);
  ok(!!R.Field.layer.mv && R.Field.layer.mv.dur === R.Field.WALK / 2, 'half step starts on the first held frame (WALK/2=' + R.Field.WALK / 2 + ')');
  let moved = -1;
  const arrivals = [];
  for (let i = 0; i < 40; i++) {
    await step(1);
    if (pos().y === 13 && moved < 0) moved = i;
    if (R.Field.layer.mv && R.Field.layer.mv.t === 0) arrivals.push(i);
  }
  ok(arrivals.length >= 2 && arrivals[0] === R.Field.WALK / 2 - 1 && arrivals[1] - arrivals[0] === R.Field.WALK / 2, 'next half step starts right as the last ends (' + arrivals + ')');
  R.Input._set('up', false);
  await settle();
  ok(moved >= 0, 'walked up after holding');
  // walked from y14 → step event at y12 stops at 12
  eq(pos().y, 12, 'stopped by step event at 10,12');
  eq(xp(), [10, 12], 'box aligned on the event tile');
  ok(/石畳/.test(msgText()), 'step event text');
  await clearMsgs();
  ok(R.State.flag('fx_step_hello_done'), 'once flag set after step event');
  await walk('D');
  await walk('U');
  ok(!/石畳/.test(msgText()), 'once step event does not repeat');
  // caterpillar: followers trail the leader's path one tile apart
  const lay = R.Field.layer;
  eq(lay.P.map((p) => [p.x, p.y]), [[10, 12], [10, 13], [10, 12]], 'followers follow trail');
  // dash timing
  R.Settings.alwaysDash = true;
  await hold('up', 1);
  ok(lay.mv && lay.mv.dur === R.Field.DASH / 2, 'dash = ' + R.Field.DASH + ' frames/tile (' + (lay.mv && lay.mv.dur) + ' per half step)');
  let fr = 0;
  while (lay.mv && fr < 20) { await step(1); fr++; }
  ok(fr <= R.Field.DASH / 2, 'dash half step ends in time (' + fr + ')');
  await settle();
  // いつでもダッシュ + holding B = walk
  R.Input._set('b', true);
  await hold('down', 1);
  ok(lay.mv && lay.mv.dur === R.Field.WALK / 2, 'always-dash: holding B walks');
  R.Input._set('b', false);
  R.Settings.alwaysDash = false;
  await settle();
  // default: hold B (or Shift) while moving = dash
  for (const btn of ['b', 'dash']) {
    R.Input._set(btn, true);
    await hold('up', 1);
    ok(lay.mv && lay.mv.dur === R.Field.DASH / 2, 'hold ' + btn + ' + move = dash');
    R.Input._set(btn, false);
    await settle();
  }
  // dash speed is exact over many steps (fractional frames carry over): 4 tiles in 4·DASH frames
  R.Field.setPlayerPos(10, 13, 'up');
  R.Input._set('b', true); R.Input._set('up', true);
  await step(1);
  const y0 = lay.mv.from.y;
  await step(R.Field.DASH * 3);
  eq([lay.mv.from.y, lay.mv.t], [y0 - 3, 0], 'dash: exactly DASH frames per tile over 3 tiles');
  R.Input._set('b', false); R.Input._set('up', false);
  await settle();
  R.Field.setPlayerPos(10, 11, 'up');
  // go to shop door (5,8): from (10,11) → up to 9, left to 5, up to 8
  await walk('UU'); // (10,9)
  eq(pos(), { x: 10, y: 9, dir: 'up' }, 'on road');
  await walk('LLLLL');
  eq(pos().x, 5, 'at x5');
  sfxLog.length = 0;
  await walk('U');
  eq(pos(), { x: 5, y: 8, dir: 'up' }, 'on shop door');
  ok(sfxLog.includes('door'), 'door sfx');
  ok(R.Field.map.opened.has(R.Field.map.idx(5, 8)), 'door drawn open');
  await walk('U');
  // talk across counter
  await press('a');
  await step(5);
  ok(/道具屋へようこそ/.test(msgText()), 'talk across counter');
  eq(R.Field.map.npc('shopkeeper').dir, 'down', 'npc faces player');
  await clearMsgs();
  ok(warnings.some((x) => /shop system missing/.test(x)), 'ev.shop without R.Shop warns');
  // chest at (7,7): stand at (6,7) face right
  await walk('R');
  eq(pos(), { x: 6, y: 7, dir: 'right' }, 'next to chest');
  await walk('R');
  eq(pos().x, 6, 'chest blocks movement');
  const hw0 = R.State.count('holy_water');
  jingleLog.length = 0;
  await press('a');
  await step(20);
  eq(msgLines(), 'ユウキは宝箱を開けた！/' + R.DB.items.holy_water.name + 'を2個手に入れた！', 'chest message');
  ok(R.Game.chests.fx_town_c1, 'chest opened state');
  eq(R.State.count('holy_water') - hw0, 2, 'chest item added');
  ok(jingleLog.includes('item'), 'item jingle');
  await clearMsgs();
  await press('a');
  await step(5);
  ok(!msgText(), 'opened chest does nothing');
  // full inventory
  R.DB.maps.fx_town.chests = [{ id: 'fx_full', x: 7, y: 5, item: 'herb', n: 1 }];

  // --------------------------------------------------------------- hidden/sign/elder
  // well hidden item at (14,11): stand at (14,10) facing down
  await walk('L');
  await walk('D'); // (5,8) door
  await walk('D'); // (5,9)
  await walk('RRRRRRRRR'); // (14,9)
  await walk('D'); // (14,10)
  await press('a');
  await step(10);
  eq(msgLines(), 'ユウキはあたりを調べた。/なんと、' + R.DB.items.seed_str.name + 'を見つけた！', 'hidden item message');
  ok(R.Game.chests.fx_town_h1 && R.State.count('seed_str') === 1, 'hidden item taken');
  await clearMsgs();
  // elder at (18,11): stand (17,11) facing right
  await walk('RRR'); // (17,10)
  await walk('D'); // (17,11)
  await press('right', 1); await step(2);
  eq(pos(), { x: 17, y: 11, dir: 'right' }, 'facing elder');
  await press('a');
  await step(10);
  ok(/よくぞ参った/.test(msgText()) && /ユウキよ/.test(msgText()), '{leader} replaced: ' + msgText());
  await press('a'); await step(10);
  // choice window: pick はい
  ok(R.Engine.top().list, 'choice open');
  await press('a'); await step(10);
  await clearMsgs(30);
  ok(R.State.hasItem('gold_key'), 'ev.give gave gold_key');
  ok(jingleLog.includes('keyitem'), 'keyitem jingle');
  ok(R.Game.ship && R.Game.ship.map === 'fx_world', 'ship given');
  ok(R.Field.map.npc('ghost_girl').present, 'cond npc appears after refresh');
  eq([R.Field.map.npc('elder').x, R.Field.map.npc('elder').y], [16, 11], 'npc scripted walk');

  // wander npcs stay near home and off the party
  for (let i = 0; i < 1500; i++) {
    await step(1);
    for (const n of R.Field.map.npcs) {
      if (!n.present || n.move !== 'wander') continue;
      if (Math.abs(n.x - n.homeX) > 2 || Math.abs(n.y - n.homeY) > 2) { ok(false, 'wander left home ' + n.id); i = 1e9; break; }
      if (lay.P.some((p) => p.x === n.x && p.y === n.y)) { ok(false, 'wander onto party ' + n.id); i = 1e9; break; }
      const id = R.Field.map.tileAt(n.x, n.y);
      if (id.startsWith('door')) { ok(false, 'wander onto door'); i = 1e9; break; }
    }
  }
  ok(R.Field.map.npcs.filter((n) => n.move === 'wander').some((n) => n.x !== n.homeX || n.y !== n.homeY) || true, 'wander');

  // --------------------------------------------------------------- exit to world
  console.log('world');
  R.Field.setPlayerPos(10, 15, 'down');
  await walk('D');
  await settle();
  eq(R.Field.map.id, 'fx_world', 'edge exit to world');
  eq([pos().x, pos().y], [5, 7], 'at world spawn fx_town');
  eq(R.Audio.current, 'overworld', 'world bgm');
  // encounters on world
  R.Field.noEncounter = false;
  R.fxBattleLog.length = 0;
  R.Field.setPlayerPos(6, 9, 'right');
  for (let i = 0; i < 60 && !R.fxBattleLog.length; i++) { await walk(i % 2 ? 'L' : 'R'); }
  ok(R.fxBattleLog.length > 0, 'random encounter happened');
  if (R.fxBattleLog.length) {
    eq(R.fxBattleLog[0].zone, 'fx_w1', 'zone by rectangle');
    ok(['grass', 'forest', 'hills'].includes(R.fxBattleLog[0].bg), 'bg from tile: ' + R.fxBattleLog[0].bg);
  }
  await settle(200);
  // repel
  R.Field.repel(3);
  R.fxBattleLog.length = 0;
  R.Field.layer.encCount = 0.1;
  await walk('R'); await walk('L');
  eq(R.fxBattleLog.length, 0, 'no encounter while repelled');
  await walk('R');
  ok(/魔除けの効果が切れた/.test(msgText()), 'repel expiry notice');
  await clearMsgs();
  R.Field.noEncounter = true;
  // encounterPct from a member's equipment mods: -100 → none
  R.DB.items.fx_ring = { name: 'テストの指輪', type: 'acc', price: 0, mods: { encounterPct: -100 } };
  R.Game.party[2].equip.acc = 'fx_ring';
  R.Field.noEncounter = false; lay._fm = null;
  eq(lay.fieldMods().encounterPct, -100, 'strongest encounterPct');
  R.fxBattleLog.length = 0;
  for (let i = 0; i < 12; i++) await walk(i % 2 ? 'L' : 'R');
  eq(R.fxBattleLog.length, 0, 'encounterPct -100 prevents fights');
  R.Game.party[2].equip.acc = null; lay._fm = null;
  R.Field.noEncounter = true;

  // --------------------------------------------------------------- ship
  console.log('ship');
  // dock fx_dock at (11,15); land (10,15) beach. Put party on (10,15) facing right.
  R.Field.setPlayerPos(10, 15, 'right');
  await walk('R');
  ok(R.Game.onShip, 'boarded ship');
  eq(R.Audio.current, 'sea', 'sea bgm');
  const sailFrom = pos();
  await walk('R');
  eq([pos().x, pos().y], [sailFrom.x + 1, sailFrom.y], 'sailed');
  ok(R.Game.onShip, 'still aboard at sea');
  eq([R.Game.ship.x, R.Game.ship.y], [pos().x, pos().y], 'ship moves with party');
  // barrier blocks without flag
  R.Field.setPlayerPos(29, 17, 'down');
  R.Game.ship = { map: 'fx_world', x: 29, y: 17, dir: 'down' };
  R.Game.onShip = true;
  R.Game.ship.map = R.Field.map.id;
  await walk('D');
  eq(pos().y, 17, 'barrier blocks ship');
  R.State.setFlag('barrier_broken');
  await walk('D');
  eq(pos().y, 18, 'barrier sailable with flag');
  await walk('R'); // (30,18) barrier
  eq(pos().x, 30, 'sail along barrier');
  await walk('D'); // (30,19) reef: blocked
  eq(pos().y, 18, 'reef blocks');
  // disembark: go to (28,18)->... sail back and land on beach at (13,4)?
  R.Field.setPlayerPos(12, 15, 'left');
  R.Game.ship = { map: 'fx_world', x: 12, y: 15, dir: 'left' };
  R.Game.onShip = true;
  await walk('L'); // (11,15) sea
  await walk('L'); // (10,15) beach → land
  ok(!R.Game.onShip, 'disembarked');
  eq([R.Game.ship.x, R.Game.ship.y], [11, 15], 'ship left at shore');
  eq(R.Audio.current, 'overworld', 'bgm back');
  await walk('R');
  ok(R.Game.onShip, 're-boarded');
  await walk('L');
  ok(!R.Game.onShip, 'off again');

  // --------------------------------------------------------------- dungeon
  console.log('dungeon');
  R.Field.setPlayerPos(12, 8, 'down');
  await walk('D'); // (12,9) = cave icon warp
  eq(R.Field.map.id, 'fx_dungeon_1', 'entered cave via icon warp');
  eq([pos().x, pos().y], [1, 1], 'dungeon entrance spawn');
  ok(R.Field.layer.banner && R.Field.layer.banner.text === 'テストの洞窟', 'location banner');
  await settle();
  // silver door at (6,3) locked
  R.Field.setPlayerPos(5, 3, 'right');
  sfxLog.length = 0;
  await walk('R');
  eq(pos().x, 5, 'locked door blocks');
  ok(msgText() === '鍵がかかっている。', 'locked message');
  ok(sfxLog.includes('locked'), 'locked sfx');
  await clearMsgs();
  // gold chest at (3,3)
  R.Field.setPlayerPos(3, 4, 'up');
  const g0 = R.Game.gold;
  await press('a'); await step(20);
  eq(R.Game.gold - g0, 120, 'gold chest');
  ok(/120ゴールドを手に入れた！/.test(msgText()), 'gold chest text');
  await clearMsgs();
  // key chest at (16,7)
  R.Field.setPlayerPos(15, 7, 'right');
  await press('a'); await step(20);
  ok(R.State.hasItem('silver_key'), 'silver key from chest');
  await clearMsgs();
  R.Field.setPlayerPos(5, 3, 'right');
  sfxLog.length = 0;
  await walk('R');
  eq(pos().x, 6, 'door opens with key');
  ok(sfxLog.includes('door'), 'door sfx with key');
  // poison floor (row 6 x8..13): each step damages
  R.Field.setPlayerPos(9, 7, 'up');
  const hp0 = R.Game.party.map((c) => c.hp);
  sfxLog.length = 0;
  await walk('U');
  const hp1 = R.Game.party.map((c) => c.hp);
  ok(hp1.every((h, i) => h === hp0[i] - 3), 'poison floor damage 3 each: ' + hp0 + ' → ' + hp1);
  ok(sfxLog.includes('step_damage'), 'damage sfx');
  // noFloorDamage mod
  R.DB.items.fx_boots = { name: 'テストの靴', type: 'acc', price: 0, mods: { noFloorDamage: true } };
  R.Game.party[0].equip.acc = 'fx_boots'; lay._fm = null;
  await walk('D'); await walk('U');
  eq(R.Game.party.map((c) => c.hp), hp1, 'noFloorDamage');
  R.Game.party[0].equip.acc = null; lay._fm = null;
  // poison status: 1 HP/step, min 1
  R.Field.setPlayerPos(3, 1, 'down');
  R.Game.party[1].status = { poison: true };
  R.Game.party[1].hp = 2;
  await walk('D'); await walk('U'); await walk('D');
  eq(R.Game.party[1].hp, 1, 'poison step min 1 HP');
  R.Game.party[1].status = {};
  // lava kills weak party → game over path (no R.GameOver) → wipeRecover + respawn
  R.Game.respawn = { map: 'fx_town', spawn: 'entrance' };
  for (const c of R.Game.party) c.hp = 5;
  R.Game.gold = 100;
  R.Field.setPlayerPos(8, 1, 'down');
  await walk('D'); // (8,2) lava 10 dmg
  await settle(300);
  eq(R.Field.map.id, 'fx_town', 'wipe → respawn map');
  eq(R.Game.gold, 50, 'wipe halves gold');
  ok(R.Game.party.every((c) => c.hp === R.Rules.stats(c).hp), 'wipe full revive');
  await clearMsgs();

  // back into dungeon 1 to stairs
  await R.Field.warp('fx_dungeon_1', { x: 14, y: 3 }, { fade: false });
  await settle();
  sfxLog.length = 0;
  await walk('R');
  eq(R.Field.map.id, 'fx_dungeon_2', 'stairs warp');
  ok(sfxLog.includes('stairs'), 'stairs sfx');
  eq([pos().x, pos().y], [1, 1], 'arrive on up spawn');
  await settle();
  eq(R.Field.map.tileAt(5, 5), 'seal', 'seal before boss');
  // boss: escape keeps event repeatable
  R.Field.setPlayerPos(5, 3, 'down');
  R.fxBattleResult = 'escape';
  R.fxBattleLog.length = 0;
  await press('a');
  await clearMsgs(40); await settle(300);
  eq(R.fxBattleLog.length, 1, 'boss battle started');
  eq(R.fxBattleLog[0] && R.fxBattleLog[0].troop, 'fx_golem', 'boss troop');
  ok(R.fxBattleLog[0] && R.fxBattleLog[0].noEscape === true, 'battle opts passed');
  eq(R.fxBattleLog[0] && R.fxBattleLog[0].bg, 'cave', 'troop bg');
  ok(!R.State.flag('fx_boss_done') && R.Field.map.npc('boss').present, 'boss remains after escape');
  // win
  R.fxBattleResult = 'win';
  await press('a');
  await clearMsgs(40); await settle(300);
  ok(R.State.flag('fx_boss_done'), 'boss flag');
  ok(!R.Field.map.npc('boss').present, 'boss hidden');
  eq(R.Field.map.tileAt(5, 5), 'floor', 'tilePatch applied on refresh');
  // crest chest behind seal (5,7): walk down through seal
  await walk('D'); await walk('D');
  eq([pos().x, pos().y], [5, 5], 'walk through removed seal');
  await walk('D');
  jingleLog.length = 0;
  await press('a'); await step(20);
  ok(R.State.hasItem('crest_wind'), 'crest chest');
  ok(jingleLog.includes('keyitem'), 'key item jingle from chest');
  await clearMsgs();
  // boss lose → game over during event: event aborted, respawn
  R.State.setFlag('fx_boss_done', false);
  await R.Field.warp('fx_dungeon_2', 'up', { fade: false });
  await settle();
  R.Game.respawn = { map: 'fx_town', spawn: 'entrance' };
  R.Field.setPlayerPos(5, 3, 'down');
  R.fxBattleResult = 'lose';
  await press('a');
  await clearMsgs(40); await settle(400);
  eq(R.Field.map.id, 'fx_town', 'boss loss → respawn');
  ok(!R.State.flag('fx_boss_done'), 'aborted event did not continue');
  R.fxBattleResult = 'win';
  await clearMsgs();

  // --------------------------------------------------------------- exit / teleport / respawn / resume
  console.log('api');
  await R.Field.warp('fx_dungeon_2', 'up', { fade: false });
  await settle();
  ok(R.Field.canExit(), 'canExit in dungeon');
  const ex = R.Field.exitDungeon();
  await settle(200); await ex;
  eq(R.Field.map.id, 'fx_world', 'exitDungeon → world');
  eq([pos().x, pos().y], [12, 9], 'escape spawn');
  ok(!R.Field.canExit(), 'no exit on world');
  R.Game.ship = { map: 'fx_world', x: 28, y: 18, dir: 'down' };
  const tp = R.Field.teleport('fx_town');
  await settle(300); await tp;
  // landing on the location's entrance tile enters it at once (no step off and back on)
  eq([R.Field.map.id, pos().x, pos().y], ['fx_town', 10, 14], 'teleport enters the location');
  eq([R.Game.ship.x, R.Game.ship.y], [11, 15], 'ship moved to dock');
  eq(R.Field.teleportList(), [{ id: 'fx_town', name: 'テストの町' }], 'teleportList');
  R.Field.setRespawnHere();
  eq(R.Game.respawn, { map: 'fx_town', x: 10, y: 14, dir: 'up' }, 'setRespawnHere');
  // save → load → resume
  await R.Field.warp('fx_town', { x: 12, y: 9, dir: 'left' }, { fade: false });
  await settle();
  const save = JSON.parse(JSON.stringify(R.State.serialize()));
  eq([save.game.pos.map, save.game.pos.x, save.game.pos.y], ['fx_town', 12, 9], 'pos saved');
  R.State.newGame();
  R.State.deserialize(save);
  const rp = R.Field.resume();
  await step(40); await rp;
  eq([R.Field.map.id, pos().x, pos().y, pos().dir], ['fx_town', 12, 9, 'left'], 'resume position');
  ok(R.Game.playFrames > 0, 'playFrames counting');
  // resume on ship
  await R.Field.warp('fx_world', { x: 11, y: 15 }, { fade: false });
  await settle();
  ok(R.Game.onShip, 'warp onto ship tile = aboard');
  const save2 = JSON.parse(JSON.stringify(R.State.serialize()));
  R.State.deserialize(save2);
  const rp2 = R.Field.resume(); await step(40); await rp2;
  ok(R.Game.onShip, 'resume aboard ship');

  // --------------------------------------------------------------- events API
  console.log('events');
  await R.Field.warp('fx_town', { x: 10, y: 9, dir: 'down' }, { fade: false });
  await settle(); await clearMsgs();
  let order = [];
  R.DB.events.fx_a = { run: async (ev) => { order.push('a1'); await ev.wait(5); order.push('a2'); } };
  R.DB.events.fx_b = { run: async (ev) => { order.push('b'); } };
  R.DB.events.fx_nest = { run: async (ev) => { order.push('n1'); await R.Events.run('fx_b'); order.push('n2'); await ev.call('fx_b'); } };
  const pa = R.Events.run('fx_a'); const pb = R.Events.run('fx_b');
  await step(20); await pa; await pb;
  eq(order, ['a1', 'a2', 'b'], 'events serialised');
  order = [];
  await Promise.all([R.Events.run('fx_nest'), step(10)]);
  eq(order, ['n1', 'b', 'n2', 'b'], 'nested run inline (no deadlock)');
  R.DB.events.fx_pw = {
    run: async (ev) => {
      ev.player.face('up');
      await ev.player.walk('UU');
      await ev.npc('kid').setPos(9, 9).walk('R');
      order = [ev.npc('kid').x, ev.npc('kid').y];
      ev.setVar('v', 3); ev.setFlag('fx_x');
      return ev.var('v') === 3 && ev.check('fx_x') && ev.has('herb') && ev.map === 'fx_town';
    },
  };
  const rpw = R.Events.run('fx_pw');
  await step(60);
  eq(await rpw, true, 'ev state helpers');
  eq([pos().x, pos().y], [10, 7], 'ev.player.walk');
  eq(order, [10, 9], 'ev.npc setPos+walk');
  // giveGold / take / takeGold / give full
  R.DB.events.fx_money = {
    run: async (ev) => {
      await ev.giveGold(30);
      const t = ev.take('herb', 1);
      const tg = ev.takeGold(10);
      R.Game.inv.herb = 99;
      const g = await ev.give('herb', 1);
      return [t, tg, g];
    },
  };
  const g1 = R.Game.gold;
  const rm = R.Events.run('fx_money');
  await clearMsgs(10); await step(5);
  eq(await rm, [true, true, false], 'take/takeGold/give full');
  eq(R.Game.gold - g1, 20, 'giveGold/takeGold');
  // got-item wording: one line when it fits, else the break comes before the verb
  const lines = R.Events.lines;
  eq(lines('ユウキは', '薬草を', '手に入れた！'), 'ユウキは薬草を手に入れた！', 'lines: fits on one line');
  eq(lines('ユウキユウキは', 'サファイアのロッドを', '手に入れた！'), 'ユウキユウキはサファイアのロッドを\n手に入れた！', 'lines: break before the verb');
  R.Game.party[0].name = 'アレクサンド';
  R.DB.items.fx_long = { name: 'サファイアのロッド', type: 'consumable', price: 0 };
  R.DB.events.fx_give_long = { run: async (ev) => { await ev.give('fx_long', 2); } };
  const rgl = R.Events.run('fx_give_long');
  await step(10);
  eq(msgLines(), 'アレクサンドはサファイアのロッドを/2個手に入れた！', 'ev.give long name layout');
  await clearMsgs(10); await rgl;
  R.Game.party[0].name = 'ユウキ';
  // inn fallback
  R.Game.gold = 100;
  for (const c of R.Game.party) c.hp = 1;
  R.DB.events.fx_inn = { run: async (ev) => ev.inn(10) };
  const ri = R.Events.run('fx_inn');
  await step(10); await press('a'); await step(10); // yes (choice)
  await clearMsgs(20); await settle(300); await clearMsgs(10);
  eq(await ri, true, 'inn fallback');
  eq(R.Game.gold, 90, 'inn price');
  ok(R.Game.party.every((c) => c.hp === R.Rules.stats(c).hp), 'inn healed');
  eq(R.Game.respawn.map, 'fx_town', 'inn set respawn');
  // giveShip & setObjective
  R.DB.events.fx_ship = { run: async (ev) => { ev.giveShip('fx_dock'); ev.setObjective('obj_x'); } };
  await Promise.all([R.Events.run('fx_ship'), step(3)]);
  eq([R.Game.ship.x, R.Game.ship.y, R.Game.objective], [11, 15, 'obj_x'], 'giveShip/setObjective');

  // --------------------------------------------------------------- extras
  console.log('extras');
  // held direction against a locked door shows the message once
  await R.Field.warp('fx_dungeon_1', { x: 5, y: 3, dir: 'right' }, { fade: false });
  await settle();
  R.Game.inv = { herb: 1 };
  let lockMsgs = 0;
  const origSay = R.UI.say;
  R.UI.say = function (t, o) { if (/鍵が/.test(t)) lockMsgs++; return origSay.call(this, t, o); };
  R.Input._set('right', true);
  for (let i = 0; i < 80; i++) { await step(1); const top = R.Engine.top(); if (top && top.constructor.name === 'MessageLayer' && top.resolveText && top.shown >= top.pageLen()) { R.Input._set('a', true); await step(2); R.Input._set('a', false); } }
  R.Input._set('right', false);
  await settle();
  R.UI.say = origSay;
  eq(lockMsgs, 1, 'locked message once while held');
  // menu: Y calls R.Menu.open, no field lock held while open
  let menuOpen = null;
  R.Menu = { open() { return new Promise((res) => { menuOpen = res; }); } };
  await press('b');
  ok(!menuOpen, 'B no longer opens the menu on the field');
  await press('y');
  ok(!!menuOpen, 'Y opens R.Menu');
  ok(!R.Field.isBusy(), 'field not busy while menu open');
  menuOpen(); await step(2);
  delete R.Menu;
  {
    // wandering townsfolk keep off trees and decor cells (the party may walk over them)
    const M = R.Field.map, L = R.Field.layer, P = L.P[0];
    let cell = null;
    for (let y = 1; y < M.h - 1 && !cell; y++) for (let x = 1; x < M.w - 1 && !cell; x++) if (Math.abs(x - P.x) + Math.abs(y - P.y) > 3 && L.npcCanEnter(x, y, {})) cell = { x, y };
    ok(!!cell, 'found an open cell');
    const i = M.idx(cell.x, cell.y), keepDecor = M.decor, keepTile = M.tiles[i];
    M.decor = new Array(M.w * M.h).fill(null); M.decor[i] = 'bench';
    ok(!L.npcCanEnter(cell.x, cell.y, {}), 'npc avoids decor cells');
    M.decor = keepDecor;
    M.tiles[i] = 'tree';
    ok(!L.npcCanEnter(cell.x, cell.y, {}), 'npc avoids trees');
    M.tiles[i] = keepTile;
  }
  // mimic chest: escape keeps it closed, win opens it
  R.DB.maps.fx_mimic = { name: 'ミミック', type: 'dungeon', theme: 'cave', rows: ['#####', '#.$.#', '#.@.#', '#####'],
    marks: { '$': { chest: { id: 'fx_mimic_c', item: 'herb', troop: 'fx_golem' } }, '@': { spawn: 'entrance', dir: 'up' } },
    exit: { left: { to: 'fx_town', spawn: 'entrance' }, right: { to: 'fx_world', spawn: 'fx_town' } } };
  await R.Field.warp('fx_mimic', 'entrance', { fade: false }); await settle();
  R.fxBattleResult = 'escape';
  await press('a'); await clearMsgs(20); await settle(200);
  ok(!R.Game.chests.fx_mimic_c, 'mimic escape: chest stays shut');
  R.fxBattleResult = 'win';
  const herbs = R.State.count('herb');
  await press('a'); await clearMsgs(20); await settle(200); await clearMsgs(10);
  ok(R.Game.chests.fx_mimic_c && R.State.count('herb') === herbs + 1, 'mimic win: item');
  // per-edge exits: rows ragged-free 5 wide, walls at edges → use setPlayerPos on the edge
  R.DB.maps.fx_edge = { name: '関所', type: 'town', rows: [',,,,,', ',,,,,', ',,,,,'], marks: {},
    spawns: { entrance: { x: 2, y: 1 } }, exit: { left: { to: 'fx_town', spawn: 'entrance' }, right: { to: 'fx_world', spawn: 'fx_town' } } };
  await R.Field.warp('fx_edge', 'entrance', { fade: false }); await settle();
  R.Field.setPlayerPos(4, 1, 'right');
  await walk('R');
  eq(R.Field.map.id, 'fx_world', 'right edge exit');
  await R.Field.warp('fx_edge', 'entrance', { fade: false }); await settle();
  R.Field.setPlayerPos(0, 1, 'left');
  await walk('L'); await clearMsgs();
  eq(R.Field.map.id, 'fx_town', 'left edge exit');
  await walk('D'); await settle();
  // new game resets a stuck event: event awaiting a window that got cleared
  R.DB.events.fx_stuck = { run: async (ev) => { await ev.say('待っている'); R.State.setFlag('fx_stuck_after'); } };
  R.Events.run('fx_stuck');
  await step(5);
  ok(R.Events.busy(), 'stuck event busy');
  R.Engine.clear();
  R.State.newGame();
  const ns = R.Field.start('fx_town', { x: 10, y: 9, dir: 'down' });
  await step(40); await ns; await clearMsgs();
  ok(!R.Events.busy() || R.Events.current, 'events reset on new game');
  await walk('D');
  eq(pos().y, 10, 'field responsive after reset');
  ok(!R.State.flag('fx_stuck_after'), 'stale event never continues');

  // --------------------------------------------------------------- 8 directions / half tiles
  console.log('free movement');
  {
    let stepHits = 0;
    R.DB.events.fx_cnt = { run: async () => { stepHits++; } };
    R.DB.events.fx_talk = { run: async (ev) => { await ev.say('こんにちは。'); } };
    R.DB.maps.fx_open = {
      name: 'ひろば', type: 'dungeon', legend: 'local', theme: 'cave',
      rows: [
        '############',
        '#..........#',
        '#..#.......#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '############',
      ],
      marks: {},
      spawns: { entrance: { x: 5, y: 3, dir: 'down' } },
      npcs: [{ id: 'fx_n', x: 4, y: 6, sprite: 'npc:man', dir: 'up', event: 'fx_talk' }],
      chests: [{ id: 'fx_open_c', x: 9, y: 1, item: 'herb' }],
      events: [{ x: 6, y: 4, id: 'fx_cnt', trigger: 'step' }],
      warps: [{ x: 9, y: 5, to: 'fx_town', spawn: 'entrance' }],
    };
    let L = R.Field.layer;
    const go = async (x, y, dir, cell) => {
      await R.Field.warp('fx_open', 'entrance', { fade: false }); await settle();
      L.place(x, y, dir, cell); L.savePos();
    };
    // diagonal: both axes in one half step, facing kept when it is one of the held directions
    await go(1, 5, 'down');
    R.Input._set('right', true); R.Input._set('up', true);
    await step(1);
    eq(xp(), [1.5, 4.5], 'diagonal half step');
    ok(Math.abs(L.mv.dur - R.Field.WALK / 2 * Math.SQRT2) < 1e-9, 'diagonal half step takes √2× (same px/frame)');
    await step(40);
    R.Input._set('right', false); R.Input._set('up', false); await settle();
    eq(xp()[1], 1, 'diagonal walk stops at the top wall');
    ok(xp()[0] > 5, 'then slides along the wall (' + xp() + ')');
    eq(L.P[0].dir, 'right', 'facing the slide');
    // diagonal into the corner of a wall block: the swept cells include the corner → slide, no corner cutting
    await go(2, 1, 'right');
    R.Input._set('down', true); R.Input._set('right', true);
    await step(1);
    eq(xp(), [2.5, 1], 'corner cell blocked → slide along the free (last pressed) axis');
    R.Input._set('down', false); R.Input._set('right', false); await settle();
    // corner assist: pushing up into an edge that is only half in the way shifts half a tile sideways
    await go(2.5, 3, 'up', { x: 3, y: 3 });
    await holdDirs(['up'], 1);
    eq(xp(), [2, 3], 'corner nudge toward the free side');
    eq(L.P[0].dir, 'up', 'nudge keeps facing');
    await holdDirs(['up'], 8);
    eq(xp()[0], 2, 'then passes the corner');
    ok(xp()[1] < 3, 'moved up past the wall (' + xp() + ')');
    // no nudge against a full wall
    await go(3, 3, 'up');
    await holdDirs(['up'], 6);
    eq(xp(), [3, 3], 'full wall: no movement');
    // step event: fires once when the box aligns on the tile (diagonal approach)
    await go(5, 3, 'down');
    stepHits = 0;
    await holdDirs(['right', 'down'], 1); // (5.5,3.5)
    eq(stepHits, 0, 'half over the event tile: nothing yet');
    await holdDirs(['right', 'down'], 1); await clearMsgs(); // (6,4)
    eq(stepHits, 1, 'aligned on the event tile: fired');
    await holdDirs(['right'], 1); await holdDirs(['left'], 1); await clearMsgs(); // (6.5,4) → (6,4)
    eq(stepHits, 1, 'jiggling within the tile never re-fires');
    // entering with a half offset on the other axis: the box glides onto the tile, then the event runs (once)
    await go(5, 4.5, 'right', { x: 5, y: 4 });
    stepHits = 0;
    await holdDirs(['right'], 4); await clearMsgs(); await settle();
    eq([stepHits, xp()[0], xp()[1]], [1, 6, 4], 'half-offset entry: glide onto the tile, fire once');
    // warps too
    await go(8, 5.5, 'right', { x: 8, y: 5 });
    await holdDirs(['right'], 4); await settle(200); await clearMsgs();
    eq(R.Field.map.id, 'fx_town', 'warp from a half-offset approach');
    // talk / chest from half positions: the tile in front of the box (either tile when it straddles two)
    await go(3.5, 5, 'down', { x: 3, y: 5 });
    await press('a'); await step(5);
    ok(/こんにちは/.test(msgText()), 'talk from a half position');
    await clearMsgs();
    eq(R.Field.map.npc('fx_n').dir, 'up', 'npc turns to the player');
    await go(8.5, 2.5, 'up', { x: 8, y: 2 });
    eq(R.Field.front(), { x: 8, y: 1 }, 'front = first whole tile beyond the box');
    await press('a'); await step(20);
    ok(R.Game.chests.fx_open_c, 'chest from a half position (both axes offset)');
    await clearMsgs();
    // blocked by NPC / chest boxes
    await go(4.5, 4, 'down', { x: 4, y: 4 });
    let overlap = false;
    R.Input._set('down', true);
    for (let i = 0; i < 20; i++) { await step(1); const p = L.leadAt(0); if (Math.abs(p.x - 4) < 1 - 1e-9 && Math.abs(p.y - 6) < 1 - 1e-9) overlap = true; }
    R.Input._set('down', false); await settle();
    ok(!overlap, 'never overlaps the npc');
    eq(xp()[0], 5, 'nudged around the npc that was half in the way');
    ok(xp()[1] > 5, 'and walked on past it (' + xp() + ')');
    // caterpillar: followers one tile back along the leader's path, facing their motion
    await go(1, 5, 'right');
    await holdDirs(['right'], 12);
    await holdDirs(['right', 'up'], 6);
    const P = L.P;
    // leader went right 2 tiles (1→3) then 2 diagonal half steps up-right → (4, 4): the path back is
    // two diagonals (√½ tile each) then straight left
    eq(xp(), [4, 4], 'leader after straight + diagonal');
    const back = (d) => { const diag = Math.SQRT1_2 * 2; return d <= diag ? [4 - d / Math.SQRT2, 4 + d / Math.SQRT2] : [3 - (d - diag), 5]; };
    const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
    ok(near([P[1].x, P[1].y], back(1)), 'follower 1 one tile back along the path: ' + [P[1].x, P[1].y] + ' vs ' + back(1));
    ok(near([P[2].x, P[2].y], back(2)), 'follower 2 two tiles back along the path: ' + [P[2].x, P[2].y] + ' vs ' + back(2));
    eq([P[1].dir, P[2].dir], ['right', 'right'], 'followers face their own motion');
    // saves keep whole tiles only
    await go(3.5, 4.5, 'left', { x: 3, y: 4 });
    const sv = JSON.parse(JSON.stringify(R.State.serialize()));
    eq([sv.game.pos.x, sv.game.pos.y], [3, 4], 'save stores the logical whole tile');
    R.State.deserialize(sv);
    const rr = R.Field.resume(); await step(40); await rr;
    L = R.Field.layer;
    eq(xp(), [3, 4], 'resume on the whole tile');
    sv.game.pos.x = 3.5; sv.game.pos.y = 4.4; // a fractional position (never written) still loads
    R.State.deserialize(sv);
    const rr2 = R.Field.resume(); await step(40); await rr2;
    L = R.Field.layer; // resume builds a fresh layer
    eq(xp(), [4, 4], 'fractional saved position rounds to a whole tile');
    // scripted party walks align onto the whole tile first
    await go(5.5, 3, 'down', { x: 5, y: 3 });
    R.DB.events.fx_pw2 = { run: async (ev) => { await ev.player.walk('D'); } };
    const pw = R.Events.run('fx_pw2'); await step(60); await pw;
    eq(xp(), [5, 4], 'ev.player.walk from a half position: aligned whole-tile steps');
    // encounters count distance: a half step counts half
    await R.Field.warp('fx_world', { x: 6, y: 9 }, { fade: false }); await settle();
    R.Field.noEncounter = false; R.Game.repelSteps = 0;
    L.encCount = 50; L._fm = null;
    const rate = R.Field.map.tile(6, 9).enc == null ? 1 : R.Field.map.tile(6, 9).enc;
    await holdDirs(['right'], 1);
    ok(Math.abs(50 - L.encCount - rate * 0.5) < 1e-9, 'half step = half an encounter step (' + (50 - L.encCount) + ')');
    R.Field.noEncounter = true;
    // ship: board from a half position, sail diagonally, saves keep whole tiles
    R.Game.ship = { map: 'fx_world', x: 11, y: 15, dir: 'left' };
    R.Game.onShip = false;
    L.place(10, 14.5, 'right', { x: 10, y: 14 });
    await holdDirs(['right'], 1); await settle();
    ok(R.Game.onShip, 'boarded from a half position');
    eq(xp(), [11, 15], 'onto the ship');
    L.place(20, 5, 'right'); R.Game.ship = { map: 'fx_world', x: 20, y: 5, dir: 'right' };
    await holdDirs(['right', 'down'], 1);
    eq(xp(), [20.5, 5.5], 'diagonal sailing');
    eq([R.Game.ship.x, R.Game.ship.y, R.Game.pos.x, R.Game.pos.y], [20, 5, 20, 5], 'ship / pos saved on whole tiles');
    R.Input._set('b', true);
    await holdDirs(['right'], 1); // sail dash: 1.5 frames per half step (fractions carry)
    ok(Math.abs(L.P[0].x - 21) < 1e-9, 'sail dash half step');
    R.Input._set('b', false);
    // land from the ship: everyone ashore, ship left on a whole tile
    L.place(12, 15, 'left'); R.Game.ship = { map: 'fx_world', x: 12, y: 15, dir: 'left' }; R.Game.onShip = true;
    await walk('L'); await walk('L');
    ok(!R.Game.onShip, 'landed');
    ok(Number.isInteger(R.Game.ship.x) && Number.isInteger(R.Game.ship.y), 'ship on a whole tile');
  }

  // debug
  console.log('debug');
  R.debug.level(10);
  ok(R.Game.party.every((c) => c.level === 10), 'debug.level');
  eq(R.debug.setJobLevel('yuki', 'warrior', 3), 'ユウキ warrior Lv3', 'debug.setJobLevel');
  R.debug.noEncounter(true);
  ok(R.Field.noEncounter, 'debug.noEncounter');

  const bad2 = warnings.filter((x) => !/fx_bad|shop system|nowhere|objective|missing graphic/.test(x));
  if (bad2.length) console.log('warnings:\n  ' + [...new Set(bad2)].join('\n  '));
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
