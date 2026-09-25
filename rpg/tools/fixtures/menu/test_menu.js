#!/usr/bin/env node
// Menu logic tests in node (no DOM): field effects, equip previews, shop deltas,
// monster book order.   node tools/fixtures/menu/test_menu.js
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const R = require('../../lib/load')({ quiet: true });
// fixtures (stand-in data only where the real data is missing)
const ctx = vm.createContext(Object.assign({}, { window: { RPG: R }, console }));
ctx.window.RPG = R;
for (const f of ['stubs.js', 'state.js']) {
  const code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  // run with window pointing at R's sandbox global
  new vm.Script(code).runInNewContext({ window: { RPG: R }, console, document: undefined });
}

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');

for (const f of ['menu.js', 'menu_items.js', 'menu_equip.js', 'menu_jobs.js', 'menu_status.js', 'menu_save.js', 'shop.js', 'title.js', 'gameover.js']) {
  ok(!R._nodeLoadErrors.some((e) => e.includes('systems/' + f)), 'loads ' + f);
}
ok(R.Menu && typeof R.Menu.open === 'function', 'R.Menu.open');
for (const k of ['applyFieldEffect', 'saveScreen', 'saveMenu', 'settings', 'itemScreen', 'abilityScreen', 'equipScreen', 'jobScreen', 'learnScreen', 'setScreen', 'statusScreen', 'orderScreen', 'bookScreen', 'useItem', 'useAbility', 'pickMember', 'codeOverlay']) {
  ok(typeof R.Menu[k] === 'function', 'R.Menu.' + k);
}
ok(typeof R.Shop.open === 'function' && typeof R.Shop.inn === 'function' && typeof R.Shop.church === 'function', 'R.Shop API');
ok(typeof R.Title.start === 'function', 'R.Title.start');
ok(typeof R.GameOver.run === 'function', 'R.GameOver.run');

R.fxMenu.setup();
const [y, n, m] = R.Game.party;
const sy = R.Rules.stats(y);

// heal (item: fixed power × itemPct)
y.hp = 10;
let r = R.Menu.applyFieldEffect({ effects: [{ type: 'heal', power: 30, scale: 0 }] }, y, [y], { item: true });
ok(y.hp >= 10 + 28 && y.hp <= 10 + 32, 'herb heals ~30 (hp ' + y.hp + ')');
ok(r.changed && /HPが\d+回復した/.test(r.lines[0]), 'heal message: ' + r.lines[0]);
// heal to full
y.hp = sy.hp - 3;
r = R.Menu.applyFieldEffect({ effects: [{ type: 'heal', power: 30 }] }, y, [y], { item: true });
eq(y.hp, sy.hp, 'heal clamps to max');
ok(/全回復/.test(r.lines[0]), 'full heal message');
// no effect on full / dead
r = R.Menu.applyFieldEffect({ effects: [{ type: 'heal', power: 30 }] }, y, [y], { item: true });
ok(!r.changed, 'heal on full HP changes nothing');
ok(!R.Menu.affects([{ type: 'heal', power: 30 }], y), 'affects() false at full HP');
m.hp = 0;
ok(!R.Menu.affects([{ type: 'heal', power: 30 }], m), 'heal does not affect the dead');
ok(R.Menu.affects([{ type: 'revive', pct: 0.5 }], m), 'revive affects the dead');
r = R.Menu.applyFieldEffect({ effects: [{ type: 'revive', pct: 0.5 }] }, y, [m], { item: true });
eq(m.hp, Math.floor(R.Rules.stats(m).hp * 0.5), 'revive to 50%');
ok(/生き返った/.test(r.lines[0]), 'revive message');
// healMp with itemPct
m.mp = 0;
r = R.Menu.applyFieldEffect({ effects: [{ type: 'healMp', power: 5 }] }, y, [m], { item: true });
eq(m.mp, 5, 'healMp +5');
// cure
n.status = { poison: true, blind: true };
r = R.Menu.applyFieldEffect({ effects: [{ type: 'cure', statuses: ['poison'] }] }, y, [n], {});
ok(!n.status.poison && n.status.blind, 'cure poison only');
r = R.Menu.applyFieldEffect({ effects: [{ type: 'cure', statuses: 'all' }] }, y, [n], {});
eq(Object.keys(n.status).length, 0, 'cure all');
// grow
const str0 = R.Rules.stats(y).str;
r = R.Menu.applyFieldEffect({ effects: [{ type: 'grow', stat: 'str', n: 2 }] }, y, [y], { item: true });
eq(R.Rules.stats(y).str, str0 + 2, 'grow str +2');
ok(/力が2上がった/.test(r.lines[0]), 'grow message: ' + r.lines[0]);
const hp0 = R.Rules.stats(y).hp, cur0 = y.hp;
R.Menu.applyFieldEffect({ effects: [{ type: 'grow', stat: 'hp', n: 8 }] }, y, [y], { item: true });
ok(R.Rules.stats(y).hp > hp0 && y.hp > cur0, 'grow hp raises max and current HP');
// repel / teleport / exit flags
R.Game.repelSteps = 0;
r = R.Menu.applyFieldEffect({ effects: [{ type: 'repel', steps: 150 }] }, y, [], { item: true });
eq(R.Game.repelSteps, 150, 'repel sets steps');
r = R.Menu.applyFieldEffect({ effects: [{ type: 'teleport' }] }, y, [], {});
ok(r.teleport && !r.changed, 'teleport reported');
r = R.Menu.applyFieldEffect({ effects: [{ type: 'exit' }] }, y, [], {});
ok(r.exit, 'exit reported');
// ability heal uses mnd scale
n.hp = 1;
r = R.Menu.applyFieldEffect({ effects: [{ type: 'heal', power: 10, scale: 1 }] }, n, [n], {});
ok(n.hp - 1 >= Math.floor((10 + R.Rules.stats(n).mnd) * 0.94), 'ability heal adds mnd × scale');

// equip preview does not touch inventory
const inv0 = JSON.stringify(R.Game.inv);
const pv = R.Menu.previewStats(y, 'weapon', 'bastard_sword');
ok(pv.atk > R.Rules.stats(y).atk, 'preview: bastard sword raises atk');
eq(JSON.stringify(R.Game.inv), inv0, 'preview leaves inventory alone');
const cands = R.Menu.equipCandidates(y, 'weapon');
ok(cands.includes('bastard_sword') && !cands.includes('apprentice_rod'), 'weapon candidates filtered by canEquip');
if (R.DB.items.short_bow) {
  R.State.addItem('short_bow', 1);
  const t = R.Menu.previewStats(y, 'weapon', 'short_bow');
  ok(t, 'two-handed preview ok');
}
// shop delta
const d = R.Shop.gearDelta(y, 'bastard_sword');
ok(d && d.stat === 'atk' && d.d > 0, 'shop delta for warrior: ' + JSON.stringify(d));
ok(R.Shop.gearDelta(m, 'bastard_sword') === null, 'mage cannot equip the sword');

// book order: bosses last, by level
const ord = R.Menu.monsterOrder();
const bossIdx = ord.findIndex((id) => (R.DB.monsters[id].flags || []).includes('boss'));
ok(bossIdx === -1 || ord.slice(bossIdx).every((id) => (R.DB.monsters[id].flags || []).includes('boss')), 'bosses at the end of the book');

// job change via rules (menu relies on it)
const removed = R.Rules.changeJob(y, 'knight');
ok(Array.isArray(removed), 'knight change returns removed list');
eq(y.job, 'knight', 'job changed');

console.log(`\n${passes} passed, ${fails} failed`);
process.exitCode = fails ? 1 : 0;
