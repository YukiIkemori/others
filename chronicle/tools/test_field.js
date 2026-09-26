#!/usr/bin/env node
// Field / map / event-runtime / debug tests (owner A4; node, no DOM, exit 1 on failure).
// Drives R.Engine.step() with simulated input over tools/fixtures/field/fx_maps.js and
// checks DESIGN §2.3 (movement), §3.3.10 (field), §3.3.11 (ev API), §3.3.13 (debug),
// §4.11.1 (encounters, 魔除け / 誘い寄せ), §4.12.2 (wipe invariants), §11.6 (display rules)
// and the Part A6 acceptance tests W1–W4 (§0.7).
//   node tools/test_field.js            all sections
//   node tools/test_field.js wipe push  only the named sections
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FX = path.join(ROOT, 'tools/fixtures/field');

const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => { warnings.push(a.join(' ')); };
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true, extra: [path.join(FX, 'fx_maps.js'), path.join(FX, 'node/stubs.js')] });
console.warn = origWarn;
if (R._nodeLoadErrors.length) console.log('load errors (other owners):\n  ' + R._nodeLoadErrors.map((e) => e.split('\n')[0]).join('\n  '));

// The field is tested in isolation: the real menu / shop / tavern / hero-creation screens are
// replaced by stubs where a test drives them; battles use the fixture stand-in.
const REAL = { GameOver: R.GameOver, Menu: R.Menu, Shop: R.Shop, Tavern: R.Tavern, CharCreate: R.CharCreate };
R.Menu = null; R.Shop = null; R.Tavern = null; R.CharCreate = null;
if (!R.Battle) R.Battle = {};
R.Battle.start = R.fxBattleStart;
R.Gfx.textWidth = (s) => R.Text.approxWidth(String(s));
R.Settings.alwaysDash = false;
R.Settings.msgSpeed = 3;
R.Settings.fieldZoom = 'wide';
R.warn = (...a) => warnings.push(a.join(' '));
const sayLog = [];
{ const say0 = R.UI.say; R.UI.say = function (t, o) { sayLog.push(R.Text.fmt(t)); return say0.call(this, t, o); }; }
const said = (re) => sayLog.some((t) => re.test(t));

let fails = 0, passes = 0;
const failed = [];
let section = '';
function ok(cond, msg) { if (cond) passes++; else { fails++; failed.push(section + ': ' + msg); console.log('  FAIL:', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

const flush = () => new Promise((r) => setImmediate(r));
let totalSteps = 0;
async function step(n = 1) {
  for (let i = 0; i < n; i++) {
    if (++totalSteps > 400000) throw new Error('frame budget exceeded at ' + JSON.stringify(R.Field.pos()) + ' top=' + (R.Engine.top() && R.Engine.top().constructor.name));
    R.Engine.step(); await flush();
  }
}
async function press(b, hold = 2) { R.Input._set(b, true); await step(hold); R.Input._set(b, false); await step(2); }
async function hold(b, frames) { R.Input._set(b, true); await step(frames); R.Input._set(b, false); await step(1); }
const busy = () => R.Field.isBusy() || R.Field.wipePending;
async function settle(max = 600) { for (let i = 0; i < max && busy(); i++) await step(1); await step(2); }
const topName = () => { const t = R.Engine.top(); return t ? t.constructor.name : null; };
/** dismiss message / choice windows until the field is free */
async function clearMsgs(max = 30) {
  for (let i = 0; i < max; i++) {
    await step(3);
    const top = R.Engine.top();
    if (top === R.Field.layer && !busy()) return;
    if (top && (top.constructor.name === 'MessageLayer' || top.constructor.name === 'StageLayer' || top.list)) await press('a');
    else await step(5);
  }
}
const msgText = () => { const m = R.UI._msg; return m && !m.closed ? m.pages.map((p) => p.join('')).join('|') : ''; };
const msgLines = () => { const m = R.UI._msg; return m && !m.closed ? m.pages.map((p) => p.join('/')).join('|') : ''; };
const pos = () => R.Field.pos();
const xp = () => { const p = R.Field.exactPos(); return [p.x, p.y]; };
/** walk whole tiles: hold each direction until the step toward the next tile has started, then release */
async function walk(p) {
  for (const d of R.Field.parsePath(p)) {
    const L = R.Field.layer;
    const m0 = R.Field.map, p0 = R.Field.exactPos();
    const gx = p0.x + R.U.DX[d], gy = p0.y + R.U.DY[d];
    R.Input._set(d, true);
    let idle = 0;
    for (let i = 0; i < 40; i++) {
      await step(1);
      if (L.locks || R.Events.busy() || R.Field.map !== m0) break;
      const q = L.P[0];
      if (L.mv && Math.abs(q.x - gx) < 1e-6 && Math.abs(q.y - gy) < 1e-6) break;
      if (!L.mv && !L.arrived) { if (++idle > 2) break; } else idle = 0;
    }
    R.Input._set(d, false);
    await settle();
  }
}
async function holdDirs(dirs, n) {
  for (const d of dirs) R.Input._set(d, true);
  await step(n);
  for (const d of dirs) R.Input._set(d, false);
  await settle();
}
/** a fresh game with the hero and the standard companions on map/spawn (no random battles) */
async function newGame(map, spawn, opts) {
  const o = opts || {};
  R.Engine.clear();
  R.Engine.fade(0, 0);
  R.State.newGame();
  for (const id of o.companions || ['brigitta', 'marta', 'sylvain']) R.Party.recruit(id);
  R.Field.noEncounter = !o.encounters;
  const p = R.Field.start(map, spawn);
  await step(40); await p;
  await settle();
}
const has = (list, id) => list.includes(id);
/** step frames until the promise settles (or max frames) → its value */
async function until(p, max = 900) {
  let done = false, val;
  p.then((v) => { done = true; val = v; }, () => { done = true; });
  for (let i = 0; i < max && !done; i++) await step(1);
  return val;
}
function run(name, fn) { return { name, fn }; }

// ============================================================ sections
const SECTIONS = [
  run('compile', async () => {
    const town = R.FieldMap.compile('fx_town');
    eq([town.w, town.h, town.type, town.isTown], [40, 32, 'town', true], 'town compiled');
    eq(town.spawns.entrance, { x: 19, y: 30, dir: 'up' }, 'town entrance spawn');
    eq(town.tileAt(-1, 0), 'tree', 'outside tile from the legend');
    eq(town.chests.map((c) => c.pool), ['p_supply', 'p_rare'], 'chest pools compiled');
    const w = R.FieldMap.compile('fx_world');
    ok(w.wrap && w.isWorld, 'world wraps by default');
    eq(w.warpAt(20, 8), null, 'warp with a false cond is closed');
    R.State.newGame();
    R.State.setFlag('fx_shrine_open');
    eq(w.warpAt(20, 8) && w.warpAt(20, 8).spawn, 'inn', 'warp cond checked at runtime');
    ok(w.warpCell(20, 8), 'warpCell sees the warp whatever its cond');
    eq(R.FieldMap.secretCells('fx_world').length, 3, 'world secret_rock cells');
    eq(R.FieldMap.secretCells('fx_dungeon_1'), [[7, 17], [7, 18]], 'dungeon secret_wall cells');
    ok(R.FieldMap.secretTotal() >= 5, 'secret total counts every map (' + R.FieldMap.secretTotal() + ')');
    const d2 = R.FieldMap.compile('fx_dungeon_2');
    eq([d2.escape && d2.escape.to, d2.lvOff, d2.chestTier], ['fx_world', 2, 3], 'escape {map,…} normalised; lvOff and chestTier read');
    const sm = R.FieldMap.compile('fx_small');
    eq([sm.decorAt(2, 1), sm.decorOver(2, 1), sm.overCells.length, sm.walkable(2, 1)], ['fx_arch', true, 1, true], 'decorLegend + over:true decor (walkable, drawn above sprites)');
    // warnings: hidden items ignored, local maps without outside, ids
    R.DB.maps.fx_bad = {
      name: 'bad', type: 'dungeon', rows: ['#####', '#A.A#', '#...#', '#A$##', '###'],
      marks: { A: { npc: { id: 'g', sprite: 'soldier', text: 'x' } }, $: { chest: { id: 'c', pool: 'p_supply' } }, '#': { sign: 'no' } },
      chests: [{ id: 'c', x: 2, y: 2, pool: 'p_supply' }], warps: [{ x: 9, y: 9, to: 'nowhere' }], hidden: [{ id: 'h', x: 1, y: 1, item: 'i_salve' }],
    };
    warnings.length = 0;
    const bad = R.FieldMap.compile('fx_bad');
    eq(bad.npcs.map((n) => n.id), ['g', 'g_2', 'g_3'], 'duplicate npc ids suffixed');
    eq(bad.chests.map((c) => c.id), ['c', 'c_2'], 'duplicate chest ids suffixed');
    eq(bad.npcs[0].sprite, 'npc:soldier', 'sprite shorthand');
    const ws = warnings.join('\n');
    ok(/hidden item\(s\) ignored/.test(ws), 'hidden items are ignored with a warning');
    ok(/without `outside`/.test(ws), 'local map without outside warns');
    ok(/unequal lengths/.test(ws) && /also a legend char/.test(ws) && /unknown map nowhere/.test(ws) && /out of bounds/.test(ws), 'shape warnings');
    eq(bad.hiddenAt(1, 1), null, 'no hidden items at runtime');
    delete R.DB.maps.fx_bad;
    // pushable rules (§10.13.10)
    const PF = R.FieldMap.pushable;
    eq([PF({ fixed: true }), PF({ push: true, event: 'x', cond: 'y' }), PF({ sprite: 'mon:x' }), PF({ sprite: 'npc:man', cond: 'f' }), PF({ sprite: 'npc:man', event: 'e' }), PF({ sprite: 'npc:man', move: 'wander', event: 'e' }), PF({ sprite: 'npc:man', text: 'x' })],
      [false, true, false, false, false, true, true], 'pushable: fixed / push / monsters / cond / event / wander / plain');
  }),

  run('town', async () => {
    R.fxEnter = 0;
    await newGame('fx_town', 'entrance');
    eq(pos(), { x: 19, y: 30, dir: 'up' }, 'start position');
    ok(R.Game.visited.fx_town, 'visited via the map location');
    eq(R.Game.respawn, { map: 'fx_town', spawn: 'entrance' }, 'entering a town sets the respawn point automatically');
    ok(/テストの町に着いた/.test(msgText()), 'onEnter message');
    eq(R.fxEnter, 1, 'onEnter ran once');
    ok(!R.Field.layer.banner, 'the name banner gives way to the onEnter speech');
    await clearMsgs();
    eq(R.Field.layer.P.length, 4, 'caterpillar of 4');
    // whole-tile steps: a tap walks one tile at once
    await press('up', 1); await settle();
    eq(xp(), [19, 29], 'a tap walks a whole tile');
    eq(pos(), { x: 19, y: 29, dir: 'up' }, 'logical tile follows');
    // walking timing: the move starts on the first held frame, and chained steps have no idle frame
    R.Input._set('up', true);
    await step(1);
    ok(!!R.Field.layer.mv && R.Field.layer.mv.dur === R.Field.WALK, 'step starts on the first held frame (WALK=' + R.Field.WALK + ')');
    const starts = [];
    for (let i = 0; i < 70; i++) { await step(1); if (R.Field.layer.mv && R.Field.layer.mv.t <= 0) starts.push(i); }
    R.Input._set('up', false);
    await settle();
    ok(starts.length >= 3 && starts[1] - starts[0] === R.Field.WALK && starts[2] - starts[1] === R.Field.WALK, 'steps chain every WALK frames (' + starts.slice(0, 4) + ')');
    // walking up from y29 stops at the step event (19,20), once
    eq(pos().y, 20, 'stopped by the step event at 19,20');
    ok(/石畳/.test(msgText()), 'step event text');
    await clearMsgs();
    ok(R.State.flag('fx_step_hello_done'), 'once flag set');
    await walk('D'); await walk('U');
    ok(!/石畳/.test(msgText()), 'a once step event does not repeat');
    // the caterpillar: followers stand on the leader's previous tiles once the party stops
    const L = R.Field.layer;
    await walk('D'); await walk('D'); await walk('D'); await walk('U');
    eq(L.P.map((p) => [p.x, p.y]), [[19, 22], [19, 23], [19, 22], [19, 21]], 'followers trace the path tile by tile');
    ok(!L.moving(), 'standing still: no stepping in place (frame 0)');
    // dash
    for (const btn of ['b', 'dash']) {
      R.Input._set(btn, true);
      await hold('up', 1);
      ok(L.mv && L.mv.dur === R.Field.DASH, 'hold ' + btn + ' + move = dash');
      R.Input._set(btn, false);
      await settle();
    }
    R.Settings.alwaysDash = true;
    await hold('down', 1);
    ok(L.mv && L.mv.dur === R.Field.DASH, 'always-dash dashes');
    await settle();
    R.Input._set('b', true); await hold('down', 1);
    ok(L.mv && L.mv.dur === R.Field.WALK, 'always-dash + B walks');
    R.Input._set('b', false); R.Settings.alwaysDash = false;
    await settle();
    // NPC text forms (§3.2.4): {cond,text} list; tier changes the line
    R.Field.setPlayerPos(13, 20, 'right');
    await press('a'); await step(4);
    ok(/昔話の続き/.test(msgText()), 'default line of a {cond,text} list');
    await clearMsgs();
    eq(R.Field.npc('teller').dir, 'left', 'the NPC turns to the player');
    R.Game.tier = 1; R.Game.regionsCleared = ['r_forest'];
    R.Field.setPlayerPos(13, 20, 'right');
    await press('a'); await step(4);
    ok(/語り直された/.test(msgText()), 'tier line (cond {tier:1})');
    await clearMsgs();
    // sign with a tier text
    R.Field.setPlayerPos(17, 16, 'up');
    await press('a'); await step(4);
    ok(/記録院/.test(msgText()), 'sign text picked by cond');
    await clearMsgs();
    R.Game.tier = 0; R.Game.regionsCleared = [];
    // talking across the inn counter
    R.Field.setPlayerPos(8, 6, 'up');
    let innCalled = null;
    R.Shop = { inn: async (p) => { innCalled = p; return true; } };
    await press('a'); await clearMsgs(); await settle();
    eq(innCalled, R.Tier.innPrice(), 'ev.inn() across the counter, default price R.Tier.innPrice() (' + innCalled + ')');
    R.Shop = null;
    // ev.inn fallback: heals everyone (reserve too) and costs the tier price
    R.Game.gold = 100;
    for (const c of R.Game.party) c.hp = 1;
    const ri = R.Events.run((ev) => ev.inn(10));
    await step(10); await press('a'); await step(10);
    await clearMsgs(20); await settle(300); await clearMsgs(10);
    eq(await ri, true, 'inn fallback');
    eq(R.Game.gold, 90, 'inn price paid');
    ok(R.Game.party.every((c) => c.hp === R.Rules.stats(c).hp), 'inn healed');
    // conditional NPC appears after its flag (elder: yes → flag → refresh)
    ok(!R.Field.npc('fan').present, 'cond NPC hidden before its flag');
    R.Field.setPlayerPos(25, 16, 'right');
    await press('a'); await step(8);
    ok(/よくぞ参った/.test(msgText()), 'elder event: ' + msgText());
    await press('a'); await step(8);
    ok(R.Engine.top().list, 'choice window');
    await press('a'); await clearMsgs(30); await settle();
    ok(R.State.flag('fx_elder_done') && R.Field.npc('fan').present, 'cond NPC appears after refresh');
    eq([R.Field.npc('elder').x, R.Field.npc('elder').y], [27, 16], 'scripted NPC walk');
    // wanderers stay near home, off the party, off doors
    const P = R.Field.layer.P;
    let bad = null;
    for (let i = 0; i < 900 && !bad; i++) {
      await step(1);
      for (const n of R.Field.map.npcs) {
        if (!n.present || n.move !== 'wander') continue;
        if (Math.abs(n.x - n.homeX) > 2 || Math.abs(n.y - n.homeY) > 2) bad = 'left home ' + n.id;
        else if (P.some((p) => p.x === n.x && p.y === n.y)) bad = 'onto the party ' + n.id;
        else if (R.Field.map.tileAt(n.x, n.y).startsWith('door')) bad = 'onto a door';
      }
    }
    ok(!bad, 'wanderers behave (' + (bad || 'ok') + ')');
    // Y opens the menu (no field lock while it is open); B does not
    let menuOpen = null;
    R.Menu = { open() { return new Promise((res) => { menuOpen = res; }); } };
    await press('b');
    ok(!menuOpen, 'B does not open the menu');
    await press('y');
    ok(!!menuOpen, 'Y opens R.Menu');
    ok(!R.Field.isBusy(), 'field not busy while the menu is open');
    menuOpen(); await step(2);
    R.Menu = null;
  }),

  run('chests', async () => {
    await newGame('fx_town', 'entrance');
    await clearMsgs();
    const L = R.Field.layer;
    // a pool chest is resolved when opened and recorded as {item, n} | {gold}
    R.Field.setPlayerPos(32, 20, 'right');
    R.fxJingles.length = 0;
    await press('a'); await step(20);
    const rec = R.Game.chests.fx_town_c1;
    ok(rec && (rec.item || rec.gold != null), 'pool chest recorded: ' + JSON.stringify(rec));
    const it = rec && rec.item && R.DB.items[rec.item];
    if (it) {
      ok(/は宝箱を開けた！/.test(msgText()) && msgText().includes(it.name + 'を'), 'chest message: ' + msgText());
      ok(R.fxJingles.includes('item') || R.fxJingles.includes('rare'), 'item jingle');
      ok(R.State.count(rec.item) >= rec.n, 'item added');
    }
    await clearMsgs();
    await press('a'); await step(5);
    ok(!msgText(), 'an opened chest does nothing');
    // the rare chest: star + grade jingle; full inventory keeps it shut and the roll stays the same
    const c2 = R.Field.map.chests.find((c) => c.id === 'fx_town_c2');
    const roll = R.Field.peekChest(c2);
    ok(roll && roll.item && R.DB.items[roll.item], 'p_rare roll: ' + JSON.stringify(roll));
    ok(!R.Game.chests.fx_town_c2, 'peeking records nothing');
    R.Game.inv[roll.item] = 99;
    R.Field.setPlayerPos(34, 20, 'right');
    await press('a'); await step(10);
    ok(/これ以上は持てない。/.test(msgText()), 'full inventory: ' + msgText());
    await clearMsgs();
    ok(!R.Game.chests.fx_town_c2, 'the chest stays shut');
    eq(R.Field.peekChest(c2), roll, 'the same contents next time');
    delete R.Game.inv[roll.item];
    R.fxJingles.length = 0;
    await press('a'); await step(12);
    const ri = R.DB.items[roll.item];
    ok(msgText().includes((ri.grade === 'rare' || ri.grade === 'super' ? '★' : '') + ri.name), 'rare mark in the message: ' + msgText());
    const want = ri.type === 'key' ? 'keyitem' : ri.grade === 'super' ? 'superrare' : ri.grade === 'rare' ? 'rare' : 'item';
    ok(R.fxJingles.includes(want), 'jingle by grade: ' + want + ' (' + R.fxJingles + ')');
    await clearMsgs();
    eq(R.Game.chests.fx_town_c2, { item: roll.item, n: roll.n }, 'rare chest recorded');
    // chest tier: def.tier ?? map.chestTier ?? game tier (fx_dungeon_2 has chestTier 3)
    await R.Field.warp('fx_dungeon_2', 'from_prev', { fade: false }); await settle();
    const c3 = R.Field.map.chests[0];
    eq(R.Tier.chestTier(c3, R.Field.map), 3, 'map chestTier used for the roll');
    // a chest blocks movement
    await R.Field.warp('fx_town', 'entrance', { fade: false }); await settle(); await clearMsgs();
    R.Field.setPlayerPos(34, 20, 'right');
    await walk('R');
    eq(pos().x, 34, 'a chest blocks movement');
    ok(L.P.length === 4, 'still 4 in the caterpillar');
  }),

  run('movement', async () => {
    await newGame('fx_open', 'entrance');
    let L = R.Field.layer;
    const go = async (x, y, dir) => { await R.Field.warp('fx_open', 'entrance', { fade: false }); await settle(); L = R.Field.layer; L.place(x, y, dir); L.savePos(); };
    // diagonal: one whole diagonal step, √2× the time (same px/frame)
    await go(2, 5, 'down');
    R.Input._set('right', true); R.Input._set('up', true);
    await step(1);
    eq(xp(), [3, 4], 'diagonal whole step');
    ok(Math.abs(L.mv.dur - R.Field.WALK * Math.SQRT2) < 1e-9, 'diagonal takes √2× (same speed)');
    await step(60);
    R.Input._set('right', false); R.Input._set('up', false); await settle();
    eq(xp()[1], 1, 'diagonal walk stops at the top wall');
    ok(xp()[0] > 5, 'then slides along the wall (' + xp() + ')');
    // no corner cutting: the wall block at (3,2)
    await go(2, 1, 'right');
    R.Input._set('down', true); R.Input._set('right', true);
    await step(1);
    ok(!(xp()[0] === 3 && xp()[1] === 2), 'never cuts the corner / enters the wall');
    R.Input._set('down', false); R.Input._set('right', false); await settle();
    // no jitter: the drawn position advances at a constant rate across step boundaries
    for (const [keys, dash, x0, y0] of [[['right'], false, 1, 5], [['right', 'down'], false, 4, 1], [['right', 'down'], true, 4, 1], [['left', 'up'], true, 10, 5]]) {
      await go(x0, y0, keys[0]);
      if (dash) R.Input._set('b', true);
      for (const k of keys) R.Input._set(k, true);
      const samples = [];
      for (let f = 0; f < 16; f++) {
        await step(1);
        for (const a of [0, 0.25, 0.5, 0.75]) samples.push(L.leadAt(a));
      }
      for (const k of keys) R.Input._set(k, false);
      R.Input._set('b', false);
      await settle();
      const per = (dash ? 1 / R.Field.DASH : 1 / R.Field.WALK) / (keys.length === 2 ? Math.SQRT2 : 1) / 4;
      let worst = 0;
      for (let i = 5; i < samples.length; i++) {
        const dx = Math.abs(samples[i].x - samples[i - 1].x), dy = Math.abs(samples[i].y - samples[i - 1].y);
        if (dx === 0 && dy === 0) break; // reached a wall
        worst = Math.max(worst, Math.abs(dx - per), keys.length === 2 ? Math.abs(dy - per) : dy);
      }
      ok(worst < 1e-9, 'constant drawn speed ' + keys.join('+') + (dash ? ' dash' : '') + ' (worst ' + worst.toExponential(2) + ')');
    }
    // step event fires once per tile entered
    await go(5, 3, 'down');
    R.fxStepHits = 0;
    await holdDirs(['right', 'down'], 1); await clearMsgs(); // (6,4)
    eq(R.fxStepHits, 1, 'diagonal onto the event tile fires once');
    await holdDirs(['right'], 1); await holdDirs(['left'], 1); await clearMsgs();
    eq(R.fxStepHits, 2, 're-entering fires again');
    // warps
    await go(8, 5, 'right');
    await walk('R'); await settle(200); await clearMsgs();
    eq(R.Field.map.id, 'fx_town', 'warp on entry');
    // talk and chest from the tile in front
    await go(4, 5, 'down');
    await press('a'); await step(5);
    ok(/こんにちは/.test(msgText()), 'talk to the NPC in front');
    await clearMsgs();
    await go(9, 2, 'up');
    eq(R.Field.front(), { x: 9, y: 1 }, 'front tile');
    await press('a'); await step(20);
    ok(R.Game.chests.fx_open_c, 'chest in front opened');
    await clearMsgs();
    // the party never walks into an NPC
    await go(4, 4, 'down');
    await walk('D');
    await walk('D');
    eq(xp(), [4, 5], 'NPC blocks (a fixed one is not pushed)');
    // saves keep whole tiles; resume
    await go(3, 4, 'left');
    const sv = JSON.parse(JSON.stringify(R.State.serialize()));
    eq([sv.game.pos.x, sv.game.pos.y], [3, 4], 'save stores the tile');
    R.State.deserialize(sv);
    const rr = R.Field.resume(); await step(40); await rr;
    eq([R.Field.map.id].concat(xp()), ['fx_open', 3, 4], 'resume on the tile');
    // scripted party walks
    R.DB.events.fx_pw = { run: async (ev) => { ev.player.face('up'); await ev.player.walk('UU'); await ev.npc('fx_n').setPos(8, 6).walk('R'); ev.setVar('fx_v', 3); ev.setFlag('fx_x'); return [ev.var('fx_v'), ev.check('fx_x'), ev.map, ev.npc('fx_n').x]; } };
    const rp = R.Events.run('fx_pw');
    await step(80);
    eq(await rp, [3, true, 'fx_open', 9], 'ev state helpers / npc setPos + walk');
    eq(xp(), [3, 2], 'ev.player.walk');
    // walk-distance counting (a diagonal step is one step, §4.11.1: 「斜めの 1 歩も 1 歩」)
    const s0 = R.Game.steps;
    await go(2, 5, 'right');
    await holdDirs(['right', 'up'], 1);
    eq(R.Game.steps - s0, 1, 'a diagonal step counts 1');
    await go(2, 5, 'right');
    const s1 = R.Game.steps;
    for (let i = 0; i < 3; i++) await holdDirs(['right', 'up'], 1);
    eq([xp(), R.Game.steps - s1, R.Field.layer.walked], [[5, 2], 3, 0], 'three diagonal steps count 3 (no √2 carry)');
    R.Field.setEncItem({ id: 'i_ward_incense', pct: -100, steps: 5, weakOnly: true });
    await go(2, 5, 'right');
    for (let i = 0; i < 2; i++) await holdDirs(['right', 'up'], 1);
    eq(R.Game.encItem && R.Game.encItem.steps, 3, '魔除け steps: a diagonal step uses 1');
    R.Game.encItem = null;
  }),

  run('view', async () => {
    eq(R.DEFAULT_SETTINGS.fieldZoom, 'wide', 'fieldZoom default: wide');
    const want = { normal: [4, 256, 224], wide: [3, 1024 / 3, 896 / 3], wider: [2, 512, 448] };
    for (const z of R.Field.ZOOMS) {
      R.Settings.fieldZoom = z;
      const v = R.Field.view();
      eq([v.zoom, v.z, +v.w.toFixed(3), +v.h.toFixed(3)], [z, ...want[z].map((n) => +n.toFixed(3))], 'view ' + z);
    }
    R.Settings.fieldZoom = 'bogus';
    eq(R.Field.view().zoom, 'wide', 'unknown zoom → wide');
    for (const id of ['fx_town', 'fx_small']) {
      await R.Field.warp(id, 'entrance', { fade: false }); await settle(); await clearMsgs();
      const L = R.Field.layer, m = R.Field.map, mw = m.w * 16, mh = m.h * 16;
      for (const z of R.Field.ZOOMS) {
        R.Settings.fieldZoom = z;
        const v = R.Field.view();
        for (const [x, y] of [[1, 1], [m.w - 2, m.h - 2], [m.w >> 1, m.h >> 1]]) {
          L.place(x, y, 'down');
          const c = R.Field.camera();
          const okX = mw <= v.w ? c.x === Math.floor((mw - v.w) / 2) : c.x >= 0 && c.x <= mw - v.w + 1e-9;
          const okY = mh <= v.h ? c.y === Math.floor((mh - v.h) / 2) : c.y >= 0 && c.y <= mh - v.h + 1e-9;
          ok(okX && okY, `camera ${id} ${z} at ${x},${y}: clamped / centred (${c.x},${c.y})`);
        }
      }
    }
    R.Settings.fieldZoom = 'wide';
  }),

  run('push', async () => {
    await newGame('fx_yard', 'entrance');
    const L = R.Field.layer, npc = (id) => R.Field.npc(id);
    L.place(4, 2, 'right'); L.savePos();
    await press('a');
    ok(/ひまだなあ/.test(msgText()), 'A talks');
    await clearMsgs();
    eq([npc('loafer').x, npc('loafer').y], [5, 2], 'talking does not push');
    await hold('right', 5); await settle();
    eq([npc('loafer').x, npc('loafer').y, pos().x], [5, 2, 4], 'a brief push does nothing');
    R.Input._set('right', true); await step(40); R.Input._set('right', false); await settle();
    const lo = npc('loafer');
    ok(lo.x === 5 && (lo.y === 1 || lo.y === 3), 'pushed NPC stepped aside (' + lo.x + ',' + lo.y + ')');
    ok(pos().x >= 5, 'party walked on (' + pos().x + ')');
    ok(R.Engine.top() === L, 'pushing opened no message');
    L.place(1, 2, 'left'); L.savePos();
    await step(520);
    eq([lo.x, lo.y], [5, 2], 'a standing NPC goes back to its post');
    L.place(4, 2, 'right'); L.savePos();
    await hold('right', 3); await settle(); await step(3);
    R.Input._set('right', true); await step(4); R.Input._set('right', false);
    ok(lo.y !== 2 || lo.x !== 5, 'a second push within a moment moves it at once');
    await settle(); await step(20);
    L.place(6, 2, 'right'); L.savePos();
    R.Input._set('right', true); await step(60); R.Input._set('right', false); await settle();
    eq([npc('boss').x, npc('boss').y, pos().x], [7, 2, 6], 'an NPC with an event is never pushed');
    // boxed in: trade places (BRIEF A3)
    L.place(1, 5, 'right'); L.savePos();
    R.Input._set('right', true); await step(24); R.Input._set('right', false); await settle();
    eq([pos().x, npc('mover').x, npc('mover').y], [2, 1, 5], 'no room to step aside: swapped places');
    eq([npc('post').x, npc('post').y], [3, 5], 'fixed NPC stays');
    // wanderers never take the leader's last way out
    L.place(1, 5, 'right');
    const mv = npc('mover');
    mv.x = 3; mv.y = 5;
    ok(!L.npcCanEnter(2, 5, mv, true), 'a wanderer will not seal a dead end');
    ok(L.npcCanEnter(2, 5, mv, false), 'a push may still move it there');
    mv.x = 1; mv.y = 5;
    // the town lane: a townsman in a 1-wide dead-end lane is swapped past
    await R.Field.warp('fx_town', { x: 29, y: 24, dir: 'right' }, { fade: false }); await settle(); await clearMsgs();
    R.Input._set('right', true); await step(60); R.Input._set('right', false); await settle();
    ok(pos().x >= 30, 'the lane townsman lets the party through (' + pos().x + ')');
  }),

  run('world', async () => {
    await newGame('fx_world', 'start');
    const L = R.Field.layer;
    ok(R.Field.map.wrap, 'world wraps');
    eq(R.Game.respawn.map, 'roa_house', 'the world is not a respawn point');
    // walking onto the town icon enters the town; its edge exit comes back to the icon
    R.Field.setPlayerPos(12, 11, 'up');
    await walk('U'); await settle(); await clearMsgs();
    eq(R.Field.map.id, 'fx_town', 'town icon warp');
    R.Field.setPlayerPos(19, 31, 'down');
    await walk('D'); await settle();
    eq([R.Field.map.id, pos().x, pos().y], ['fx_world', 12, 10], 'edge exit to the world spawn');
    // a warp with a false cond does nothing; once the flag is set it takes the party
    R.Field.setPlayerPos(20, 9, 'up');
    await walk('U'); await settle();
    eq([R.Field.map.id, pos().x, pos().y], ['fx_world', 20, 8], 'closed warp: the party just stands on the icon');
    R.State.setFlag('fx_shrine_open');
    await walk('D'); await walk('U'); await settle(); await clearMsgs();
    eq([R.Field.map.id, pos().x, pos().y], ['fx_town', 8, 11], 'open warp (cond) → fx_town inn');
    // secret passage (world secret_rock): first entry → notice + sfx + record (all 3 cells at once)
    await R.Field.warp('fx_world', { x: 37, y: 25, dir: 'right' }, { fade: false }); await settle();
    R.fxSfx.length = 0; sayLog.length = 0;
    await walk('R'); await step(4);
    ok(said(/^隠し通路を見つけた！$/), 'secret notice');
    ok(R.fxSfx.includes('secret'), 'secret sfx');
    await clearMsgs(); await settle();
    ok(R.Field.isSecretFound('fx_world', 38, 25) && R.Field.isSecretFound('fx_world', 40, 25), 'the connected passage is recorded');
    eq(R.Field.secretsFound(), 3, 'found count');
    R.Game.secrets['fx_world:1,1'] = true; R.Game.secrets['no_such_map:2,2'] = true; // stale save keys
    eq(R.Field.secretsFound(), 3, 'found count ignores cells that are not secret passages');
    delete R.Game.secrets['fx_world:1,1']; delete R.Game.secrets['no_such_map:2,2'];
    sayLog.length = 0;
    await walk('R'); await step(4);
    ok(!said(/隠し通路/), 'second cell: no second notice');
    await walk('R'); await walk('R'); await settle();
    eq(pos().x, 41, 'through the rock into the hollow');
    R.Field.setPlayerPos(41, 25, 'right');
    await press('a'); await step(20);
    ok(R.Game.chests.fx_world_c1 && R.Game.chests.fx_world_c1.gold > 0, 'the chest past the secret (p_gold): ' + JSON.stringify(R.Game.chests.fx_world_c1));
    await clearMsgs();
    sayLog.length = 0;
    await walk('L'); await walk('L'); await walk('L'); await walk('L'); await step(4);
    ok(!said(/隠し通路/), 'walking back: nothing more');
    await settle(); await clearMsgs();
    // wrap: off the left edge comes in at the right edge; saved position stays inside the map
    await R.Field.warp('fx_torus', 'entrance', { fade: false }); await settle();
    const m = R.Field.map;
    L.place(0, 5, 'left'); L.savePos();
    await walk('L');
    eq([pos().x, pos().y], [m.w - 1, 5], 'left edge → right side');
    ok(R.Game.pos.x >= 0 && R.Game.pos.x < m.w, 'saved position inside the map');
    L.place(m.w - 1, 5, 'right'); await walk('R');
    eq([pos().x, pos().y], [0, 5], 'right edge → x 0');
    L.place(4, 0, 'up'); await walk('U');
    eq([pos().x, pos().y], [4, m.h - 1], 'top edge → bottom');
    L.place(0, 0, 'left'); await walk('L');
    eq([pos().x, pos().y], [0, 0], 'blocked by the mountain across the seam');
    L.place(0, 0, 'down');
    const c0 = R.Field.camera();
    ok(c0.x < 0 && c0.y < 0, 'camera not clamped on a wrapping map');
    // followers across the seam
    L.place(1, 7, 'left'); L.savePos();
    await walk('LLLL');
    eq([pos().x, pos().y], [m.w - 3, 7], 'four tiles west across the seam');
    ok(L.P.every((p) => Math.abs(p.x - L.P[0].x) <= 3.01), 'followers followed across the seam');
  }),

  run('encounters', async () => {
    await newGame('fx_world', 'start', { encounters: true });
    const L = R.Field.layer;
    R.fxBattleLog.length = 0; R.fxBattleResult = 'win';
    // random battles happen on the fx_w1 zone, with the tile's backdrop (on grass, enc 1: the
    // counter of at most 26 × 1.4 runs out within 50 steps even with シルヴァン's −25 %)
    R.Field.setPlayerPos(16, 18, 'right');
    for (let i = 0; i < 120 && !R.fxBattleLog.length; i++) await walk(i % 2 ? 'L' : 'R');
    ok(R.fxBattleLog.length > 0, 'random encounter');
    const b0 = R.fxBattleLog[0] || {};
    eq(b0.zone, 'fx_w1', 'zone from the rectangle');
    eq(b0.bg, 'grass', 'backdrop from the tile');
    await settle(200);
    // grace: no battle in the first 6 steps after a battle
    eq(L.grace, R.Field.ENC_GRACE, 'grace after the battle');
    L.encCount = 0.001;
    const n0 = R.fxBattleLog.length;
    for (let i = 0; i < 6; i++) await walk(i % 2 ? 'L' : 'R');
    eq(R.fxBattleLog.length, n0, 'no battle during the 6 grace steps');
    await walk('R'); await settle(200);
    eq(R.fxBattleLog.length, n0 + 1, 'the 7th step may fight');
    // counter maths: tile enc × (1 + encounterPct/100) × item factor
    const walkCost = async (setup) => {
      L.grace = 0; L.encCount = 1000; L._fm = null;
      setup();
      const x = pos().x;
      await walk(x > 10 ? 'L' : 'R');
      return +(1000 - L.encCount).toFixed(6);
    };
    R.Field.setPlayerPos(14, 16, 'right'); // road: enc 0.5
    const base = await walkCost(() => { R.Game.encItem = null; });
    const pct0 = L.fieldMods().encounterPct;
    eq(base, +(R.DB.tiles.road.enc * (1 + pct0 / 100)).toFixed(6), 'road step costs enc × (1 + encounterPct/100) (' + base + ', party encounterPct ' + pct0 + ')');
    const lure = await walkCost(() => { R.Field.setEncItem({ id: 'i_lure_incense', pct: 100, steps: 100 }); });
    eq(lure, base * 2, '誘い寄せ doubles the rate');
    const ward = await walkCost(() => { R.Field.setEncItem({ id: 'i_ward_incense', pct: -100, steps: 100, weakOnly: true }); });
    eq(ward, base, '魔除け (weakOnly) keeps the rate');
    R.Game.encItem = null;
    // a diagonal step costs one step (§4.11.1): grass (14,17) → road (15,16)
    L.grace = 0; L.encCount = 1000; L._fm = null;
    R.Field.setPlayerPos(14, 17, 'right');
    await holdDirs(['right', 'up'], 1);
    eq([pos().x, pos().y, +(1000 - L.encCount).toFixed(6)], [15, 16, base], 'a diagonal step onto the road costs the same as a straight one');
    // encounterPct from equipment / innate: the strongest size, capped ±50
    const ring = { name: 'テストの指輪', type: 'acc', price: 0, mods: { encounterPct: -100 } };
    R.DB.items.fx_ring = ring;
    const hero = R.Game.party[0];
    const keepAcc = hero.equip.acc1;
    hero.equip.acc1 = 'fx_ring';
    R.Game.encItem = null;
    const lowered = await walkCost(() => {});
    eq(L.fieldMods().encounterPct, -50, 'encounterPct −100 is capped to −50');
    eq(lowered, +(R.DB.tiles.road.enc * 0.5).toFixed(6), 'the capped value sets the rate (' + lowered + ')');
    hero.equip.acc1 = keepAcc;
    // 魔除け: the battle is skipped only when the party has outgrown the zone (avg Lv ≥ Lb + 3)
    const lb = R.Rules.zoneLevel('fx_w1', R.Field.map).Lb;
    R.Field.setEncItem({ id: 'i_ward_incense', pct: -100, steps: 100, weakOnly: true });
    for (const c of R.Game.party) c.level = lb + 3;
    L.grace = 0; L.encCount = 0.001;
    const n1 = R.fxBattleLog.length;
    await walk(pos().x > 10 ? 'L' : 'R'); await settle(200);
    eq(R.fxBattleLog.length, n1, '魔除け: an outgrown zone keeps away (Lv ' + (lb + 3) + ' vs Lb ' + lb + ')');
    for (const c of R.Game.party) c.level = Math.max(1, lb + 2);
    L.grace = 0; L.encCount = 0.001;
    await walk(pos().x > 10 ? 'L' : 'R'); await settle(200);
    eq(R.fxBattleLog.length, n1 + 1, '魔除け does not work below Lb + 3');
    for (const c of R.Game.party) c.level = 1;
    // steps run out → the fixed line (STYLE_JA §9) + cancel sfx, encItem cleared
    R.Field.noEncounter = true;
    R.Field.setEncItem({ id: 'i_ward_incense', pct: -100, steps: 2, weakOnly: true });
    R.fxSfx.length = 0;
    await walk('R'); await walk('L'); await step(4);
    const itName = R.DB.items.i_ward_incense ? R.DB.items.i_ward_incense.name : '魔除けの香';
    ok(msgText().includes(itName + 'の効果が切れた。'), 'item expiry line: ' + msgText());
    ok(R.fxSfx.includes('cancel'), 'cancel sfx');
    await clearMsgs();
    eq(R.Game.encItem, null, 'encItem cleared');
    const spell = Object.keys(R.DB.actions).find((id) => (R.DB.actions[id].effects || []).some((e) => e.type === 'encounter'));
    if (spell) {
      R.Field.setEncItem({ id: spell, pct: -100, steps: 1, weakOnly: true });
      await walk('R'); await step(4);
      ok(msgText().includes(R.DB.actions[spell].name + 'の効き目が切れた。'), 'spell expiry line: ' + msgText());
      await clearMsgs();
    }
    // the step that finds a secret passage still counts; a battle it would start waits one step
    R.Field.noEncounter = false;
    await R.Field.warp('fx_world', { x: 37, y: 25, dir: 'right' }, { fade: false }); await settle();
    L.grace = 0; L.encCount = 0.5; L._fm = null;
    const nS = R.fxBattleLog.length;
    sayLog.length = 0;
    await walk('R'); await step(4);
    ok(said(/隠し通路を見つけた！/) && R.fxBattleLog.length === nS && L.encCount <= 0, 'secret step: notice, counted (' + L.encCount.toFixed(2) + '), no battle yet');
    await clearMsgs(); await settle(200);
    await walk('R'); await settle(200);
    eq(R.fxBattleLog.length, nS + 1, 'the held battle comes on the next step');
    eq(L.grace, R.Field.ENC_GRACE, 'grace after it');
    // an event battle gives the same 6-step grace
    L.grace = 0;
    await until(R.Events.run((ev) => ev.battle('fx_golem'))); await settle(200);
    eq(L.grace, R.Field.ENC_GRACE, 'grace after an event battle');
    R.Field.noEncounter = true;
    // lvOff of the map is passed to the battle (fx_dungeon_2 lvOff 2)
    await R.Field.warp('fx_dungeon_2', 'from_prev', { fade: false }); await settle();
    R.fxBattleLog.length = 0;
    const re = R.Field.encounter('fx_d2'); await settle(200); await re;
    eq(R.fxBattleLog[0] && R.fxBattleLog[0].lvOff, 2, 'map lvOff passed to R.Battle.start');
    eq(R.fxBattleLog[0] && R.fxBattleLog[0].bg, 'cave', 'dungeon backdrop from the theme');
    R.Field.noEncounter = true;
  }),

  run('dungeon', async () => {
    await newGame('fx_dungeon_1', 'entrance');
    R.Game.party[1].hp = 1;
    ok(R.Game.visited.fx_cave, 'dungeon location visited');
    ok(R.Field.canExit() && !R.Field.canTeleport(), 'canExit in a dungeon, no ワープ');
    // damage floor: a share of max HP, never below 1 (nobody falls on the field)
    R.Field.setPlayerPos(22, 6, 'down');
    const hp0 = R.Game.party.map((c) => c.hp);
    R.fxSfx.length = 0;
    await walk('D');
    const hp1 = R.Game.party.map((c) => c.hp);
    const expect = R.Game.party.map((c, i) => Math.max(1, hp0[i] > 1 ? hp0[i] - Math.max(1, Math.round(R.Rules.stats(c).hp * R.DB.tiles.lava.damagePct / 100)) : hp0[i]));
    eq(hp1, expect, 'lava: damagePct of max HP, floor at 1 HP');
    ok(R.fxSfx.includes('step_damage'), 'damage sfx');
    ok(R.State.alive().length === R.Game.party.length, 'nobody fell');
    // noFloorDamage (per member)
    R.DB.items.fx_boots = { name: 'テストの靴', type: 'acc', price: 0, mods: { noFloorDamage: true } };
    const h = R.Game.party[0];
    const keep = h.equip.acc1;
    h.equip.acc1 = 'fx_boots';
    for (const c of R.Game.party) c.hp = R.Rules.stats(c).hp;
    await walk('R');
    const hp2 = R.Game.party.map((c) => c.hp);
    eq(hp2[0], R.Rules.stats(h).hp, 'noFloorDamage: that member is unhurt');
    ok(hp2.slice(1).every((v, i) => v < R.Rules.stats(R.Game.party[i + 1]).hp), 'the others are hurt');
    h.equip.acc1 = keep;
    // secret wall: the dead end south of room A
    R.Field.setPlayerPos(7, 16, 'down');
    R.fxSfx.length = 0; sayLog.length = 0;
    await walk('D'); await step(4);
    ok(said(/^隠し通路を見つけた！$/) && R.fxSfx.includes('secret'), 'secret wall found');
    await clearMsgs(); await settle();
    ok(R.Field.isSecretFound('fx_dungeon_1', 7, 17) && R.Field.isSecretFound('fx_dungeon_1', 7, 18), 'both cells recorded');
    ok(R.Field.map.dirty.some((d) => d.cells.some(([x, y]) => x === 7 && y === 18)), 'the found cells are redrawn (found look)');
    await walk('D'); await walk('D'); await walk('D');
    eq(pos(), { x: 7, y: 20, dir: 'down' }, 'into the hidden room');
    await press('a'); await step(20);
    ok(R.Game.chests.fx_d1_c1 && R.Game.chests.fx_d1_c1.item, 'the p_rare chest beyond it');
    await clearMsgs();
    // closed tile (vine wall) opened by two levers: tilePatch {var, gte}
    R.Field.setPlayerPos(15, 6, 'right');
    await walk('R');
    eq(pos().x, 15, 'the vine wall blocks');
    await press('a'); await step(6);
    ok(/つる/.test(msgText()), 'examine event on the closed tile');
    await clearMsgs();
    R.Field.setPlayerPos(3, 9, 'down');
    await press('a'); await clearMsgs();
    eq(R.Field.map.tileAt(16, 6), 'vine_wall', 'one lever: still closed');
    R.Field.setPlayerPos(11, 9, 'down');
    R.fxSfx.length = 0;
    await press('a'); await clearMsgs();
    eq(R.Field.map.tileAt(16, 6), 'floor', '{var:fx_levers, gte:2} tilePatch opened it');
    ok(R.fxSfx.includes('unlock'), 'unlock sfx');
    ok(R.Field.map.dirty.length > 0, 'the opened cell is patched in place');
    R.Field.setPlayerPos(15, 6, 'right');
    await walk('R');
    eq(pos().x, 16, 'walk through the opened way');
    // the conditional warp pad
    R.Field.setPlayerPos(26, 10, 'down');
    await walk('D'); await settle();
    eq(R.Field.map.id, 'fx_dungeon_1', 'closed pad does nothing');
    R.State.setFlag('fx_pad_on');
    await walk('U'); R.fxSfx.length = 0; await walk('D'); await settle(); await clearMsgs();
    eq(R.Field.map.id, 'fx_town', 'open pad warps (cond)');
    ok(R.fxSfx.includes('warp'), 'warp sfx of the pad');
    // rest lantern (§11.6.4)
    await R.Field.warp('fx_dungeon_1', { x: 30, y: 11, dir: 'up' }, { fade: false }); await settle();
    for (const c of R.Game.party) { c.hp = 1; c.mp = 0; }
    R.Game.party[2].hp = 0;
    R.fxSfx.length = 0;
    await press('a'); await step(6);
    ok(/灯の光に包まれて/.test(msgText()) && R.fxSfx.includes('heal'), 'rest lantern line + heal sfx');
    await clearMsgs();
    ok(R.Game.party.every((c) => c.hp === R.Rules.stats(c).hp && c.mp === R.Rules.stats(c).mp), 'rest: everyone full and revived');
    // stairs
    R.Field.setPlayerPos(29, 3, 'right');
    R.fxSfx.length = 0;
    await walk('R'); await settle();
    eq([R.Field.map.id, pos().x, pos().y], ['fx_dungeon_2', 3, 3], 'stairs down → from_prev');
    ok(R.fxSfx.includes('stairs'), 'stairs sfx');
    ok(R.Field.layer.banner && R.Field.layer.banner.text === 'テストの洞窟　2階', 'floor banner');
    // boss: escape keeps it, win opens the seal
    eq(R.Field.map.tileAt(8, 11), 'seal', 'seal before the boss');
    R.Field.setPlayerPos(8, 8, 'down');
    R.fxBattleResult = 'escape'; R.fxBattleLog.length = 0;
    await press('a'); await clearMsgs(40); await settle(300);
    eq(R.fxBattleLog.length, 1, 'boss battle');
    ok(R.fxBattleLog[0] && R.fxBattleLog[0].noEscape === true && R.fxBattleLog[0].troop === 'fx_golem' && R.fxBattleLog[0].bg === 'cave', 'battle opts and troop bg');
    ok(!R.State.flag('fx_boss_done') && R.Field.npc('boss').present, 'escape: the boss stays');
    R.fxBattleResult = 'win';
    await press('a'); await clearMsgs(40); await settle(300);
    ok(R.State.flag('fx_boss_done') && !R.Field.npc('boss').present, 'win: boss gone');
    eq(R.Field.map.tileAt(8, 11), 'floor', 'seal tilePatch applied');
    // escape (脱出): bell → warp
    R.fxSfx.length = 0;
    const ex = R.Field.exitDungeon(); await settle(200); await ex;
    eq([R.Field.map.id, pos().x, pos().y], ['fx_world', 36, 20], 'exitDungeon → escape spawn');
    ok(R.fxSfx.indexOf('bell') >= 0 && R.fxSfx.indexOf('bell') < R.fxSfx.indexOf('warp'), '脱出 sounds: bell then warp (' + R.fxSfx + ')');
    ok(!R.Field.canExit() && R.Field.canTeleport(), 'no 脱出 outside, ワープ allowed');
  }),

  run('warp', async () => {
    // W2: entering a dungeon's 2nd floor alone lists its entrance
    await newGame('fx_town', 'entrance');
    await clearMsgs();
    R.Game.visited = {};
    await R.Field.warp('fx_dungeon_2', 'from_prev', { fade: false }); await settle();
    const l1 = R.Field.teleportList();
    ok(l1.some((e) => e.id === 'fx_cave' && e.kind === 'dungeon' && e.region === 'prologue'), 'W2: floor 2 lists the dungeon entrance: ' + JSON.stringify(l1));
    // real data: a floor whose location is a real dungeon id
    R.DB.maps.fx_real_floor = Object.assign({}, R.DB.maps.fx_dungeon_2, { location: 'verda_maze', region: 'r_forest', npcs: [] });
    await R.Field.warp('fx_real_floor', 'from_prev', { fade: false }); await settle();
    ok(R.Field.teleportList().some((e) => e.id === 'verda_maze' && e.kind === 'dungeon' && e.region === 'r_forest'), 'W2: verda_maze listed from a deeper floor');
    delete R.DB.maps.fx_real_floor;
    // W3: order = regions (prologue → r_forest … r_star → finale), towns before dungeons
    R.debug.visitAll();
    const list = R.Field.teleportList();
    const order = ['prologue'].concat(Object.keys(R.DB.regions), ['finale']);
    let sorted = true;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      const ra = order.indexOf(a.region), rb = order.indexOf(b.region);
      if (ra > rb || (ra === rb && a.kind === 'dungeon' && b.kind === 'town')) sorted = false;
    }
    ok(sorted, 'W3: region order, towns before dungeons (' + list.map((e) => e.id).join(' ') + ')');
    eq(list.length, Object.keys(R.DB.locations).length, 'every visited location listed');
    ok(list.every((e) => e.name && (e.kind === 'town' || e.kind === 'dungeon') && e.region), 'entries carry {id,name,kind,region}');
    // teleport: quill → teleport sounds; landing on a dungeon entrance enters floor 1
    R.fxSfx.length = 0;
    const tp = R.Field.teleport('fx_cave'); await settle(300); await tp; await clearMsgs();
    eq([R.Field.map.id, pos().x, pos().y], ['fx_dungeon_1', 3, 3], 'ワープ to a dungeon entrance enters floor 1');
    ok(R.fxSfx.indexOf('quill') >= 0 && R.fxSfx.indexOf('quill') < R.fxSfx.indexOf('teleport'), 'ワープ sounds: quill then teleport (' + R.fxSfx + ')');
    const tp2 = R.Field.teleport('fx_town'); await settle(300); await tp2; await clearMsgs();
    eq([R.Field.map.id, pos().x, pos().y], ['fx_town', 19, 30], 'ワープ to a town');
    // W1: towns / villages / houses / dungeon floors carry a location that DB.locations knows
    const missing = [];
    for (const id in R.DB.maps) {
      const d = R.DB.maps[id];
      if (id.startsWith('fx_') || d.type === 'world') continue;
      if (!d.location || !R.DB.locations[d.location]) missing.push(id + ':' + (d.location || '-'));
    }
    ok(!missing.length, 'W1: every town / dungeon floor has a known location (' + (missing.join(' ') || Object.keys(R.DB.maps).filter((k) => !k.startsWith('fx_')).length + ' maps ok') + ')');
    // setRespawnHere / ev.setRespawn
    R.Field.setRespawnHere();
    eq(R.Game.respawn, { map: 'fx_town', x: 19, y: 30, dir: 'up' }, 'setRespawnHere');
    await R.Events.run((ev) => ev.setRespawn('fx_town', 'inn'));
    eq(R.Game.respawn, { map: 'fx_town', spawn: 'inn' }, 'ev.setRespawn(map, spawn)');
    // a town with noRespawn keeps the old point
    await R.Field.warp('fx_yard', 'entrance', { fade: false }); await settle();
    eq(R.Game.respawn, { map: 'fx_town', spawn: 'inn' }, 'noRespawn map keeps the respawn point');
  }),

  run('wipe', async () => {
    // W4 (§0.7) and §4.12.2: lose a random, an event and a boss battle → after R.GameOver.run()
    // the invariants ①–⑦ hold. Run with the menu owner's R.GameOver and with the field's fallback.
    const variants = [['field fallback', null]];
    if (REAL.GameOver && REAL.GameOver.run) variants.unshift(['R.GameOver (A5)', REAL.GameOver]);
    for (const [label, GO] of variants) {
      for (const kind of ['random', 'event', 'boss']) {
        R.GameOver = GO;
        await newGame('fx_town', 'entrance');
        await clearMsgs();
        const enter0 = R.fxEnter;
        R.Game.gold = 101;
        R.Field.setEncItem({ id: 'i_ward_incense', pct: -100, steps: 50, weakOnly: true });
        if (R.Battle) R.Battle.autoCarry = true;
        R.fxBattleResult = 'lose';
        let atResolve = null;
        const check = () => {
          const L = R.Field.layer;
          const everyone = R.Game.party.concat(R.Game.reserve || []);
          return {
            top: R.Engine.top() === L, // ①
            locks: L.locks === 0 && !R.Field.isBusy() && !R.Events.busy(), // ②
            fade: R.Engine.fadeAlpha === 0 && !R.Engine.paused, // ③
            input: R.Input.enabled !== false, // ④
            healed: everyone.every((c) => { const s = R.Rules.stats(c); return c.hp === s.hp && c.mp === s.mp && JSON.stringify(c.status || {}) === '{}'; }), // ⑤
            gold: R.Game.gold === 50,
            carry: !(R.Battle && R.Battle.autoCarry) && R.Game.encItem === null, // ⑥
            noBattle: !R.Engine.layers.some((l) => l.repeating), // ⑥ no battle layer left
          };
        };
        if (GO) {
          const orig = GO.run;
          R.GameOver = Object.assign({}, GO, { run: async function () { await orig.apply(GO, arguments); atResolve = check(); } });
        }
        if (kind === 'random') {
          await R.Field.warp('fx_dungeon_1', 'entrance', { fade: false }); await settle(); // towns are safe: fight in the cave
          R.Field.setPlayerPos(5, 5, 'right');
          R.Field.noEncounter = false;
          R.Field.layer.encCount = 0.001; R.Field.layer.grace = 0;
          await walk('U');
          R.Field.noEncounter = true;
        } else if (kind === 'event') {
          R.Field.setPlayerPos(12, 26, 'down'); // the brawler: an event battle without canLose
          await press('a'); await step(6); await press('a');
        } else {
          await R.Field.warp('fx_dungeon_2', 'from_prev', { fade: false }); await settle();
          R.Field.setPlayerPos(8, 8, 'down');
          await press('a'); await step(6); await press('a');
        }
        // A skips the game-over screen, A dismisses the wake-up line; then 60 frames at most
        let frames = 0, woke = '';
        for (; frames < 1500; frames++) {
          await step(1);
          const top = topName();
          if (top === 'GameOverLayer' && frames % 20 === 0) { R.Input._set('a', true); await step(2); R.Input._set('a', false); }
          if (top === 'MessageLayer' && R.Field.map.id === 'fx_town' && !woke) { woke = msgText(); }
          if (top === 'MessageLayer' && frames % 10 === 0) { R.Input._set('a', true); await step(2); R.Input._set('a', false); }
          if (!R.Field.wipePending && R.Engine.top() === R.Field.layer && !R.Events.busy() && R.Field.map.id === 'fx_town' && woke) break;
        }
        const tag = label + ' / ' + kind;
        ok(R.fxBattleLog.length > 0, tag + ': the battle ran');
        ok(/たちは目を覚ました/.test(woke), tag + ': wake-up line (' + woke + ')');
        if (atResolve) ok(Object.values(atResolve).every(Boolean), tag + ': ①–⑥ hold when R.GameOver.run() resolves ' + JSON.stringify(atResolve));
        let settled = null;
        for (let i = 0; i < 60; i++) { await step(1); settled = check(); if (Object.values(settled).every(Boolean)) break; }
        ok(Object.values(settled).every(Boolean), tag + ': ①–⑥ within 60 frames ' + JSON.stringify(settled));
        eq(R.Field.map.id, 'fx_town', tag + ': back in the last town');
        eq(R.fxEnter - enter0, 1, tag + ': ⑦ the town onEnter ran exactly once');
        if (kind !== 'random') ok(!R.State.flag('fx_boss_done'), tag + ': the aborted event set nothing');
        // walk 3 tiles, open / close the menu, win the next random battle
        R.fxBattleResult = 'win';
        const x0 = pos().x;
        R.Field.setPlayerPos(19, 20, 'right'); // on the road, clear to the east
        await walk('RRR');
        eq(pos().x, 22, tag + ': walks afterwards');
        let opened = false;
        R.Menu = { open() { opened = true; return Promise.resolve(); } };
        await press('y');
        ok(opened, tag + ': Y opens the menu');
        R.Menu = null;
        await R.Field.warp('fx_world', 'start', { fade: false }); await settle();
        R.Field.noEncounter = false; R.Field.layer.encCount = 0.001; R.Field.layer.grace = 0;
        const nb = R.fxBattleLog.length;
        await walk('L'); await settle(300);
        R.Field.noEncounter = true;
        ok(R.fxBattleLog.length === nb + 1 && R.Battle.last.result === 'win' && R.Field.map.id === 'fx_world' && R.Engine.top() === R.Field.layer && R.State.alive().length === R.Game.party.length, tag + ': the next random battle is won');
        void x0;
      }
    }
    R.GameOver = REAL.GameOver;
    R.fxBattleResult = 'win';
    // canLose: the party gets up with 1 HP and the event goes on
    await newGame('fx_town', 'entrance'); await clearMsgs();
    R.fxBattleResult = 'lose';
    const r = R.Events.run(async (ev) => { const x = await ev.battle('fx_golem', { canLose: true }); return [x, R.Game.party.every((c) => c.hp === 1)]; });
    await settle(300);
    eq(await r, ['lose', true], 'canLose: HP 1 and the event continues');
    ok(!R.Field.wipePending, 'canLose: no wipe');
    R.fxBattleResult = 'win';
  }),

  // Crest 8609ae4 (「全滅のあと固まる」): a message window closed from outside releases its say(), and the
  // wake-up lines never leave the field locked — also when R.GameOver.run() is called outside the field's
  // wipe flow (from inside a running event) and the respawn town's onEnter talks.
  run('freeze', async () => {
    await newGame('fx_town', 'entrance'); await clearMsgs();
    // ① UI level: closeMessage() settles the pending say; the window counts as not read
    let released = false;
    R.UI.say('外から閉じられる窓').then(() => { released = true; });
    await step(3);
    let m = R.UI.msgOpen();
    ok(m && !R.UI.msgSettled(m), 'a window waiting for its reader is not settled');
    R.UI.closeMessage(); await step(1);
    ok(released, 'closeMessage() releases the say() it cut off');
    ok(m.closed && R.UI.msgSettled(m) === false && R.UI.msgOpen() === null, 'closed from outside: not read (msgSettled false), no window left');
    // read by the player: settled
    let read = false;
    R.UI.say('読まれる窓').then(() => { read = true; });
    await step(3); m = R.UI.msgOpen();
    await press('a');
    ok(read && m.closed && R.UI.msgSettled(m) === true, 'closed by its reader: settled');
    // ② event level: an event waiting on ev.say whose window someone else closes ends, the field is free
    await clearMsgs();
    let after = false;
    R.Events.run(async (ev) => { await ev.say('待っている行'); after = true; });
    await step(5);
    ok(R.Events.busy() && topName() === 'MessageLayer', 'the event is waiting on its line');
    R.UI.closeMessage(); await step(3);
    ok(after && !R.Events.busy() && R.Engine.top() === R.Field.layer, 'window closed from outside: the event goes on and ends, the field is free');
    // a new game / the title (Engine.clear + Events.reset) never wakes the old game's event
    let stale = false;
    R.Events.run(async (ev) => { await ev.say('古い行'); stale = true; });
    await step(5);
    R.Engine.clear(); R.Events.reset(); await step(3);
    ok(!stale, 'Engine.clear() leaves the old game’s say pending (its code never runs on)');
    // ③ R.GameOver.run() awaited from inside an event (the Crest freeze), with the town's onEnter talking
    for (const where of ['event', 'field']) {
      await newGame('fx_town', 'entrance'); await clearMsgs();
      R.State.setFlag('fx_town_seen', false);
      R.Game.gold = 40;
      const enter0 = R.fxEnter;
      let done = false, woke = 0;
      const go = where === 'event' ? R.Events.run(async () => { await R.GameOver.run(); }) : R.GameOver.run();
      go.then(() => { done = true; }, () => { done = true; });
      let frames = 0;
      for (; frames < 3000; frames++) {
        await step(1);
        const top = topName();
        if (top === 'GameOverLayer' && frames % 20 === 0) { R.Input._set('a', true); await step(2); R.Input._set('a', false); }
        if (top === 'MessageLayer' && /目を覚ました/.test(msgText()) && frames % 10 === 0) woke++;
        if (top === 'MessageLayer' && frames % 10 === 0) { R.Input._set('a', true); await step(2); R.Input._set('a', false); }
        if (done && !R.Events.busy() && R.Engine.top() === R.Field.layer && !R.Field.isBusy()) break;
      }
      ok(done, where + ': R.GameOver.run() resolves (' + frames + ' frames)');
      ok(woke > 0, where + ': the wake-up lines were shown');
      ok(!R.Events.busy() && R.Engine.top() === R.Field.layer && R.Field.layer.locks === 0, where + ': the field is free afterwards (no freeze)');
      ok(R.fxEnter - enter0 >= 1 && R.State.flag('fx_town_seen'), where + ': the town onEnter ran');
      const x0 = pos().x;
      R.Field.setPlayerPos(19, 20, 'right');
      await walk('R');
      eq(pos().x, 20, where + ': the party walks afterwards');
      void x0;
    }
  }),

  run('events', async () => {
    await newGame('fx_town', 'entrance'); await clearMsgs();
    // serialisation, nesting
    let order = [];
    R.DB.events.fx_a = { run: async (ev) => { order.push('a1'); await ev.wait(5); order.push('a2'); } };
    R.DB.events.fx_b = { run: async () => { order.push('b'); } };
    R.DB.events.fx_nest = { run: async (ev) => { order.push('n1'); await R.Events.run('fx_b'); order.push('n2'); await ev.call('fx_b'); } };
    const pa = R.Events.run('fx_a'), pb = R.Events.run('fx_b');
    await step(20); await pa; await pb;
    eq(order, ['a1', 'a2', 'b'], 'events are serialised');
    order = [];
    await Promise.all([R.Events.run('fx_nest'), step(10)]);
    eq(order, ['n1', 'b', 'n2', 'b'], 'nested runs inline');
    // give / money / lines
    const lines = R.Events.lines;
    eq(lines('ユウキは', '薬草を', '手に入れた！'), 'ユウキは薬草を手に入れた！', 'lines: one line when it fits');
    eq(lines('ユウキユウキは', 'サファイアの杖と盾を', '手に入れた！'), 'ユウキユウキはサファイアの杖と盾を\n手に入れた！', 'lines: break before the verb');
    R.fxJingles.length = 0;
    const key = Object.keys(R.DB.items).find((id) => R.DB.items[id].type === 'key');
    const rg = R.Events.run(async (ev) => { await ev.giveGold(30); const t = await ev.give(key); return t; });
    await clearMsgs(20);
    eq(await rg, true, 'ev.give a key item');
    ok(R.fxJingles.includes('keyitem'), 'keyitem jingle');
    R.Game.inv.i_salve = 99;
    const rf = R.Events.run((ev) => ev.give('i_salve'));
    await step(6);
    ok(/これ以上は持てない。/.test(msgText()), 'give past 99 refuses: ' + msgText());
    await clearMsgs(); eq(await rf, false, 'give past 99 → false');
    // text forms through ev.say
    R.Game.tier = 2;
    const rs = R.Events.run((ev) => ev.say([{ cond: { tier: 3 }, text: 'A' }, { cond: { tier: 2 }, text: 'B' }, { text: 'C' }]));
    await step(4);
    eq(msgText(), 'B', 'ev.say picks from a {cond,text} list');
    await clearMsgs(); await rs;
    R.Game.tier = 0;
    // sync helpers
    const rh = R.Events.run((ev) => [ev.tier(), ev.cleared('r_forest'), ev.inParty('brigitta'), ev.recruited('marta'), ev.recruited('teo'), ev.g('坊や', 'お嬢さん'), ev.hero.id, ev.lastBattle && ev.lastBattle.result]);
    eq(await rh, [0, false, true, true, false, '坊や', 'hero', R.Battle.last ? R.Battle.last.result : undefined], 'tier / cleared / inParty / recruited / g / hero / lastBattle');
    // setObjective (global and per region)
    await R.Events.run((ev) => { ev.setObjective('obj_regions'); ev.setObjective('obj_forest_1', { region: 'r_forest' }); });
    eq([R.Game.objective, R.Game.regionObj.r_forest], ['obj_regions', 'obj_forest_1'], 'setObjective global / region');
    // recruit (join line + jingle), tavern, chooseCompanions, createHero (screens stubbed)
    R.fxJingles.length = 0;
    const rr = R.Events.run((ev) => ev.recruit('teo'));
    await step(4);
    ok(/テオが仲間に加わった！/.test(msgText()) || msgText().includes(R.DB.companions.teo.name + 'が仲間に加わった！'), 'recruit line: ' + msgText());
    await clearMsgs();
    const teo = await rr;
    ok(teo && R.Game.reserve.includes(teo), 'a 5th companion waits in the reserve');
    ok(R.fxJingles.includes('recruit'), 'recruit jingle');
    let opened = null;
    R.Tavern = { open: async (o) => { opened = o; R.Party.swap('marta', 'teo'); }, chooseStart: async () => ['selma', 'hagen', 'dokka'] };
    await R.Events.run((ev) => ev.tavern());
    eq(opened, { recruit: true }, 'ev.tavern opens R.Tavern with recruit');
    await step(2);
    eq(R.Field.layer.P.length, 4, 'the caterpillar keeps 4 after a swap');
    // chooseCompanions on a hero-only game
    R.State.newGame();
    // (the new game's flags are clear: the town's onEnter says its line again — read it, or the next
    // R.Events.run from here would run inline inside that event)
    await R.Field.warp('fx_town', 'inn', { fade: false }); await settle(); await clearMsgs();
    ok(!R.Events.busy() && !R.Events.current, 'no event left running before chooseCompanions');
    eq(R.Field.layer.P.length, 1, 'a hero alone is a caterpillar of 1');
    R.fxJingles.length = 0;
    const rc = R.Events.run((ev) => ev.chooseCompanions({ count: 3 }));
    await clearMsgs(30);
    eq(await rc, ['selma', 'hagen', 'dokka'], 'chooseCompanions returns the ids');
    eq(R.Game.party.map((c) => c.id), ['hero', 'selma', 'hagen', 'dokka'], 'the three joined');
    eq(R.fxJingles.filter((j) => j === 'recruit').length, 1, 'recruit jingle once');
    await step(2);
    eq(R.Field.layer.P.length, 4, 'the caterpillar grows to 4');
    R.CharCreate = { run: async () => ({ name: 'リオ', gender: 'f', type: 'mage', favor: { kind: 'element', id: 'fire' } }) };
    const rcr = R.Events.run((ev) => ev.createHero());
    await settle();
    const hero = await rcr;
    eq([hero && hero.name, hero && hero.gender, R.State.hero().name, R.State.flag('hero_created')], ['リオ', 'f', 'リオ', true], 'createHero replaces the hero');
    eq(R.Game.party[0].id, 'hero', 'the hero keeps the lead');
    ok(R.Field.spriteKey(R.Game.party[0]) === 'party:hero_f_mage' || R.Field.spriteKey(R.Game.party[0]).startsWith('npc:'), 'hero sprite key ' + R.Field.spriteKey(R.Game.party[0]));
    R.Tavern = null; R.CharCreate = null;
    // caption: auto after frames, A goes on; a black screen stays black around it
    R.Field.layer.banner = { text: R.Field.map.name || 'x', t: 0 };
    const cp = R.Events.run((ev) => ev.caption('……ねえ、聞こえる？', { frames: 60 }));
    await step(14);
    eq(topName(), 'StageLayer', 'caption stage on top');
    eq(R.Field.layer.banner, null, 'the map-name banner goes away under a caption');
    await step(20); await press('a');
    const tCap = totalSteps;
    await until(cp, 400);
    ok(totalSteps - tCap < 40, 'A goes on (' + (totalSteps - tCap) + ' frames)');
    ok(R.Engine.top() === R.Field.layer, 'caption closed');
    R.Engine.fade(1, 0);
    const cp2 = R.Events.run((ev) => ev.caption('これは、忘れられかけた物語。', { frames: 20 }));
    await step(3);
    eq(R.Engine.fadeAlpha, 0, 'the caption takes a black screen over');
    await until(cp2, 400);
    eq(R.Engine.fadeAlpha, 1, 'and gives it back (暗転のまま)');
    R.Engine.fade(0, 0);
    // clearRegion: tier, flags, page given silently, chapter jingle, quill/page sounds, return value
    R.fxSfx.length = 0; R.fxJingles.length = 0;
    const page = R.DB.regions.r_forest.fragment;
    const cr = R.Events.run((ev) => ev.clearRegion('r_forest'));
    let sawCap = '';
    for (let i = 0; i < 900; i++) {
      await step(1);
      const st = R.Engine.layers.find((l) => l.constructor.name === 'StageLayer');
      if (st && st.cap && !sawCap) sawCap = st.cap.lines.join('\n');
      if (topName() === 'StageLayer' && i % 30 === 29) await press('a');
      if (topName() === 'MessageLayer') await press('a');
      if (!R.Events.busy()) break;
    }
    eq(await cr, 1, 'clearRegion returns the new tier');
    ok(R.State.flag('cleared_r_forest') && R.Game.regionsCleared[0] === 'r_forest', 'region cleared');
    ok(sawCap.includes('第1章『' + R.DB.regions.r_forest.chapter.title + '』'), 'chapter caption: ' + sawCap);
    ok(R.State.hasItem(page), 'the page was given');
    ok(R.fxJingles.includes('chapter') && !R.fxJingles.includes('keyitem'), 'chapter jingle, no keyitem jingle (' + R.fxJingles + ')');
    ok(R.fxSfx.includes('quill') && R.fxSfx.includes('page'), 'quill and page sounds');
    const again = await R.Events.run((ev) => ev.clearRegion('r_forest'));
    eq([again, R.Game.regionsCleared.length], [1, 1], 'clearing twice does nothing');
    ok(R.Engine.top() === R.Field.layer, 'the scene closed');
    // a new game resets stuck events
    R.DB.events.fx_stuck = { run: async (ev) => { await ev.say('待っている'); R.State.setFlag('fx_stuck_after'); } };
    R.Events.run('fx_stuck');
    await step(5);
    ok(R.Events.busy(), 'stuck event busy');
    await newGame('fx_town', { x: 19, y: 20, dir: 'down' }); await clearMsgs();
    await walk('D');
    eq(pos().y, 21, 'field responsive after a new game');
    ok(!R.State.flag('fx_stuck_after'), 'the stale event never continues');
  }),

  run('debug', async () => {
    const hasLute = !!(R.DB.maps.lute && R.FieldMap.compile('lute').hasSpawn('inn'));
    const p = await until(R.debug.quickStart({}));
    await settle(); await clearMsgs();
    eq(R.Game.party.map((c) => c.id), ['hero', 'brigitta', 'marta', 'sylvain'], 'quickStart: the standard party');
    eq(R.State.hero().name, R.DB.config.defaultHero.name, 'quickStart: default hero');
    ok(['hero_created', 'prologue_done', 'pro_party_chosen'].every((f) => R.State.flag(f)), 'quickStart: prologue flags');
    ok(['k_chronicle', 'k_quill', 'k_bell'].every((k) => !R.DB.items[k] || R.State.hasItem(k)), 'quickStart: key items');
    ok(R.Game.visited.lute && R.Game.visited.roa && R.Game.visited.lighthouse, 'quickStart: visited roa lute lighthouse');
    eq(R.Game.objective, 'obj_regions', 'quickStart: objective');
    if (hasLute) eq([p.map, R.Field.map.id], ['lute', 'lute'], 'quickStart: lute / inn');
    await until(R.debug.quickStart({ gender: 'f', type: 'mage', fav: 'fire', tier: 3, level: 12, companions: ['selma', 'teo', 'noela'], map: 'fx_town', spawn: 'inn' }));
    await settle(); await clearMsgs();
    const h = R.State.hero();
    eq([h.gender, h.heroType, h.favor && h.favor.kind, h.favor && h.favor.id], ['f', 'mage', 'element', 'fire'], 'quickStart: hero spec shorthand');
    eq([R.Game.tier, R.Game.regionsCleared], [3, ['r_forest', 'r_desert', 'r_snow']], 'quickStart: tier 3 = the first three regions');
    ok(R.State.flag('cleared_r_snow') && R.State.flag('snow_boss'), 'quickStart: region flags');
    ok(R.Game.party.every((c) => c.level === 12), 'quickStart: level');
    eq(R.Game.party.map((c) => c.id), ['hero', 'selma', 'teo', 'noela'], 'quickStart: companions');
    eq([R.Field.map.id, pos().x, pos().y], ['fx_town', 8, 11], 'quickStart: map / spawn');
    eq(R.debug.tier(1), 1, 'debug.tier down');
    ok(!R.State.flag('cleared_r_desert') && R.Game.regionsCleared.length === 1, 'debug.tier clears the later regions');
    eq(R.debug.party(['teo', 'noela']), ['hero', 'teo', 'noela'], 'debug.party');
    await step(2);
    eq(R.Field.layer.P.length, 3, 'the caterpillar follows the party size');
    R.debug.level(20, 'teo');
    eq(R.State.char('teo').level, 20, 'debug.level for one');
    const t = Object.keys(R.DB.actions).find((id) => id.startsWith('t_sword'));
    R.debug.learn('hero', t);
    ok(R.State.hero().techs.includes(t), 'debug.learn');
    R.debug.prof('hero', 'w', 'sword', 123);
    eq(R.State.hero().wprof.sword, 123, 'debug.prof');
    const n = R.debug.giveAll('consumable');
    ok(n > 0 && R.State.count('i_salve') >= 9, 'debug.giveAll consumable (' + n + ')');
    await until(R.debug.quickStart({ tier: 4, gear: 'tier', map: 'fx_town' }));
    await settle(); await clearMsgs();
    const w1 = R.Game.party[0].equip.weapon1, wt = w1 && R.DB.items[w1] && R.DB.items[w1].tier;
    ok(wt != null && wt <= 4 && wt >= 3, 'quickStart gear:tier equips tier gear (weapon tier ' + wt + ')');
    ok(R.debug.maps().includes('fx_town'), 'debug.maps');
    eq(R.debug.pos().map, 'fx_town', 'debug.pos');
    const sec = R.debug.secrets();
    ok(sec.total >= 5 && sec.found === 0, 'debug.secrets ' + JSON.stringify(sec));
    await until(R.debug.quickStart({ prologue: true }));
    await step(10);
    ok(!R.State.flag('prologue_done') && R.Game.party.length === 1, 'quickStart prologue: before the prologue');
    eq(R.Field.map && R.Field.map.id, R.DB.maps[R.DB.config.start.map] ? R.DB.config.start.map : R.Field.map && R.Field.map.id, 'quickStart prologue: DB.config.start');
    R.Engine.clear(); R.Events.reset();
  }),

  run('minimap', async () => {
    await newGame('fx_town', 'entrance'); await clearMsgs();
    R.DB.maps.world_keep = R.DB.maps.world; // make the fixture world the one the minimap finds
    const realWorld = R.DB.maps.world;
    R.DB.maps.world = R.DB.maps.fx_world;
    const p = R.Minimap.partyPos();
    eq(p && [p.x, p.y], [12, 10], 'from a town: its world spawn (exit / location)');
    await R.Field.warp('fx_dungeon_2', 'from_prev', { fade: false }); await settle();
    const q = R.Minimap.partyPos();
    eq(q && [q.x, q.y], [36, 20], 'from a dungeon floor: its escape spawn');
    R.DB.maps.world = realWorld; delete R.DB.maps.world_keep;
    ok(R.Minimap.TERRAIN.road && R.Minimap.TERRAIN.marsh && R.Minimap.TERRAIN.fog && R.Minimap.ICON.loc_library, '§11.2.5 colours');
    eq(R.Minimap.TERRAIN.secret_rock, R.Minimap.TERRAIN.mountain, 'secret passages look like their rock on the map');
  }),
  // pass 3: world battle backdrops (A16a.0), map weather (R3.0), save-slot place names (A18a.4),
  // wipes from event battles (A5.0)
  run('pass3', async () => {
    // A16a.0: a road fights on the ground it lies on (R.Art.worldBbg), checked through real encounters
    if (R.DB.maps.world && R.Art && R.Art.worldBbg) {
      await newGame('world', 'roa');
      const bgs = [];
      const start0 = R.Battle.start;
      R.Battle.start = (o) => { bgs.push(o.bg); return Promise.resolve('win'); };
      const cells = [[26, 77, 'desert'], [83, 74, 'ashland'], [22, 19, 'snow']];
      for (const [x, y, want] of cells) {
        await R.Field.warp('world', { x, y, dir: 'down' }, { fade: false }); await settle();
        eq(R.Field.map.tileAt(x, y), 'road', 'world ' + x + ',' + y + ' is a road');
        eq(R.Field.battleBg(R.Field.map.zoneAt(x, y)), want, 'battleBg on the road at ' + x + ',' + y);
        const p = R.Field.encounter(); await until(p, 200); await settle();
        eq(bgs[bgs.length - 1], want, 'a random battle on the road at ' + x + ',' + y + ' uses the ' + want + ' backdrop');
      }
      R.Battle.start = start0;
    }
    // R3.0: the weather layer
    const RW = R.FieldMap.resolveWeather;
    R.State.newGame();
    eq([RW('snow'), RW('blizzard'), RW('rain'), RW(null)], ['snow', 'blizzard', null, null], 'weather: a kind string');
    const list = [{ cond: { notCleared: 'r_snow' }, kind: 'blizzard' }, { kind: 'snow' }];
    eq(RW(list), 'blizzard', 'weather: the first entry whose cond passes wins');
    R.Game.regionsCleared.push('r_snow');
    eq(RW(list), 'snow', 'weather: an entry without cond always passes');
    if (R.DB.maps.yule) {
      await newGame('yule', 'entrance');
      eq(R.Field.map.weather, 'blizzard', 'yule: a blizzard before r_snow is cleared');
      const L = R.Field.layer, t0 = L.weatherT || 0;
      await step(10);
      eq((L.weatherT || 0) - t0, 10, 'weather clock runs on the field');
      class Screen extends R.Layer {}
      const menu = new Screen();
      R.Engine.push(menu);
      const t1 = L.weatherT; await step(10);
      eq(L.weatherT, t1, 'weather pauses under a menu / battle');
      R.Engine.remove(menu); await step(1);
      const say = R.UI.say('……');
      const t2 = L.weatherT; await step(5);
      ok(L.weatherT > t2, 'weather keeps falling behind a message window');
      await clearMsgs(); await until(say, 60);
      R.Game.regionsCleared.push('r_snow');
      R.Field.refresh();
      eq(R.Field.map.weather, 'snow', 'yule: light snow once r_snow is cleared (refresh)');
      R.Game.regionsCleared = [];
      await R.Field.warp('fx_town', 'entrance', { fade: false }); await settle();
      eq(R.Field.map.weather || null, null, 'a map without `weather` has none');
    }
    // A18a.4: save-slot place names on the (wrapping) world map
    if (R.DB.maps.world && R.DB.locations.caldera) {
      R.State.newGame();
      const g = R.Game;
      g.visited = { roa: true, lute: true, lighthouse: true };
      const cal = R.FieldMap.spawnPos(R.DB.locations.caldera.spawn, 'world');
      g.pos = { map: 'world', x: cal.x, y: cal.y, dir: 'down' };
      const zone = R.FieldMap.peek('world').zoneAt(cal.x, cal.y);
      const reg = Object.keys(R.DB.regions).find((r) => R.DB.regions[r].zone === zone);
      const name = R.State.placeName();
      ok(!/ファロス灯台/.test(name), 'at カルデラ with only prologue places visited: not 「ファロス灯台付近」 (got ' + name + ')');
      eq(name, reg ? R.DB.regions[reg].name : 'エルセリア', 'far from every visited place: the region of the zone underfoot');
      const lh = R.FieldMap.spawnPos(R.DB.locations.lighthouse.spawn, 'world');
      g.pos = { map: 'world', x: lh.x + 5, y: lh.y + 4, dir: 'down' };
      eq(R.State.placeName(), R.DB.locations.lighthouse.name + '付近', 'within 12 cells: 「〇〇付近」');
      g.pos = { map: 'world', x: lh.x, y: lh.y + 1, dir: 'down' };
      eq(R.State.placeName(), R.DB.locations.lighthouse.name, 'next to it: the place itself');
      // the short way round the torus
      const W = R.FieldMap.peek('world').w;
      R.DB.locations.fx_edge = { name: '端の村', map: 'world', spawn: { x: 1, y: lh.y } };
      g.visited = { fx_edge: true };
      g.pos = { map: 'world', x: W - 3, y: lh.y, dir: 'down' };
      eq(R.State.placeName(), '端の村付近', 'wrapping world: distance is measured across the seam');
      delete R.DB.locations.fx_edge;
      g.visited = {};
      g.pos = { map: 'world', x: cal.x, y: cal.y, dir: 'down' };
      const zz = R.FieldMap.peek('world').zoneAt(cal.x, cal.y);
      const saved = zz && R.DB.regions[reg] ? R.DB.regions[reg].zone : null;
      if (reg) R.DB.regions[reg].zone = 'zw_nowhere';
      eq(R.State.placeName(), 'エルセリア', 'no region for the zone: エルセリア');
      if (reg) R.DB.regions[reg].zone = saved;
    }
    // A5.0: a lost event battle never calls R.GameOver.run() itself; the field's wipe flow does
    // (the brawler of fx_town: an event battle without canLose)
    await newGame('fx_town', 'entrance');
    await clearMsgs();
    let direct = 0, requested = 0, fromWipe = 0;
    const go0 = R.GameOver, req0 = R.Field.requestWipe;
    R.GameOver = { run: async () => { direct++; if (requested) fromWipe++; R.State.wipeRecover(); await R.Field.respawn(); } };
    R.Field.requestWipe = function () { requested++; return req0.apply(this, arguments); };
    R.fxBattleResult = 'lose';
    R.Field.setPlayerPos(12, 26, 'down');
    await press('a'); await step(6); await press('a');
    for (let i = 0; i < 900 && !(direct && !R.Field.wipePending && !R.Events.busy()); i++) {
      await step(1);
      if (topName() === 'MessageLayer' && i % 10 === 0) await press('a');
    }
    ok(requested >= 1, 'ev.battle lost: the field wipe was requested');
    eq([direct, fromWipe], [1, 1], 'the game over ran exactly once, from the wipe flow');
    await clearMsgs();
    eq(R.Field.map.id, 'fx_town', 'woke up in the last town');
    R.Field.requestWipe = req0; R.GameOver = go0; R.fxBattleResult = 'win';
  }),
];

(async function main() {
  const only = process.argv.slice(2);
  const t0 = Date.now();
  // watchdog: a promise that never settles would otherwise let node exit silently
  let lastFrames = -1, stuck = 0;
  const dog = setInterval(() => {
    if (totalSteps !== lastFrames) { lastFrames = totalSteps; stuck = 0; return; }
    if (++stuck >= 5) {
      console.log('  STUCK in ' + section + ' at frame ' + totalSteps + ' top=' + topName() + ' pos=' + JSON.stringify(R.Field.pos()) + ' busy=' + R.Events.busy() + ' msg=' + msgText());
      process.exit(3);
    }
  }, 1000);
  for (const s of SECTIONS) {
    if (only.length && !only.includes(s.name)) continue;
    section = s.name;
    const f0 = fails, p0 = passes;
    try { await s.fn(); } catch (e) { fails++; failed.push(s.name + ': threw ' + (e && e.stack || e)); console.log('  THREW in ' + s.name + ':', e && e.stack || e); }
    R.Input._set && ['up', 'down', 'left', 'right', 'a', 'b', 'y', 'dash'].forEach((b) => R.Input._set(b, false));
    console.log(`${s.name.padEnd(11)} ${passes - p0} passed${fails - f0 ? ', ' + (fails - f0) + ' FAILED' : ''}`);
  }
  const noise = /fx_bad|shop system|nowhere|objective|missing graphic|unknown spawn|R\.Tavern|R\.CharCreate|ev\.recruit|chronicleScreen/;
  const content = /^map (?!fx_)|^unknown event/; // other owners' maps in progress: counted, not listed
  const nContent = new Set(warnings.filter((x) => content.test(x))).size;
  if (nContent) console.log('(' + nContent + ' warnings from maps of other owners, not listed)');
  const other = [...new Set(warnings.filter((x) => !noise.test(x) && !content.test(x)))];
  if (other.length) console.log('warnings (' + other.length + '):\n  ' + other.slice(0, 20).join('\n  '));
  console.log(`\n${passes} passed, ${fails} failed  (${totalSteps} frames, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (failed.length) console.log('failed:\n  ' + failed.join('\n  '));
  clearInterval(dog);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
