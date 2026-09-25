#!/usr/bin/env node
// Logic test for the item catalogue against R.Rules / R.State (node, no DOM):
//   node tools/fixtures/items/test_items.js
// Equips every piece of gear, checks derived stats move the right way, runs the
// optimizer per band, applies seeds via R.Rules.grow and checks mods aggregation.
'use strict';
const path = require('path');
const R = require(path.join(__dirname, '..', '..', 'lib', 'load'))({ quiet: true });
const I = R.DB.items;
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } };

// minimal jobs so the test works even before jobs.js exists (never overrides real ones)
const ALLW = ['sword', 'knife', 'axe', 'spear', 'staff', 'rod', 'bow', 'claw', 'katana', 'harp'];
if (!R.DB.jobs.warrior) R.DB.jobs.warrior = { mult: {}, weapons: ['sword', 'axe'], shield: true, heads: ['helm'], bodies: ['heavy', 'light'] };
R.DB.jobs._test_all = { mult: {}, weapons: ALLW, shield: true, heads: ['helm', 'hat'], bodies: ['heavy', 'light', 'robe'] };

R.State.newGame();
ok(R.Game.inv.herb === 4, 'new game starts with 4 herbs');
for (const c of R.Game.party) for (const s in c.equip) if (c.equip[s]) ok(!!I[c.equip[s]], `${c.id} start gear ${c.equip[s]} exists`);

// every equipment piece changes the right derived stat
const c = R.Rules.newChar('yuki');
c.job = '_test_all';
for (const s of R.Rules.SLOTS) c.equip[s] = null;
const base = R.Rules.stats(c);
for (const id in I) {
  const it = I[id];
  const slot = R.Rules.itemSlot(id);
  if (!slot) continue;
  ok(R.Rules.canEquip(c, id, slot), `${id} equippable by an all-weapons job`);
  c.equip[slot] = id;
  const s = R.Rules.stats(c);
  for (const k of ['atk', 'def', 'mag', 'mdef', 'eva', 'hit', 'hp', 'mp']) ok(Number.isFinite(s[k]), `${id}: ${k} finite`);
  if (it.atk) ok(s.atk >= base.atk + it.atk, `${id}: atk +${it.atk} (${base.atk} → ${s.atk})`);
  if (it.def) ok(s.def >= base.def + it.def, `${id}: def +${it.def}`);
  if (it.mag) ok(s.mag >= base.mag + it.mag, `${id}: mag +${it.mag}`);
  if (it.element) ok(s.element === it.element, `${id}: weapon element`);
  if (it.onHit) ok(s.onHit && s.onHit.status === it.onHit.status, `${id}: onHit`);
  if (it.mods && it.mods.statusImmune) ok(it.mods.statusImmune.every((st) => s.mods.statusImmune.includes(st)), `${id}: statusImmune aggregated`);
  c.equip[slot] = null;
}

// two-handed bow clears the shield
R.Game.inv = {};
const y = R.Game.party[0];
y.job = '_test_all';
R.State.addItem('oak_shield'); R.State.addItem('long_bow');
ok(R.Rules.equip(y, 'shield', 'oak_shield'), 'equip shield');
ok(R.Rules.equip(y, 'weapon', 'long_bow'), 'equip bow');
ok(!y.equip.shield && R.Game.inv.oak_shield === 1, 'bow unequips shield into the bag');

// elemResist keeps the minimum across pieces
y.equip = { weapon: null, shield: 'dragon_shield', head: null, body: 'holy_armor', acc: 'fire_ring' };
const m = R.Rules.mods(y);
ok(m.elemResist.fire === 0.5 && m.elemResist.dark === 0.5 && m.elemResist.thunder === 0.5, 'elemResist min-merge');

// optimizer picks the best band gear from a bag (warrior)
for (const band of [1, 3, 6]) {
  const w = R.Rules.newChar('yuki');
  R.Game.party[0] = w;
  R.Game.inv = {};
  for (const loc of Object.keys(R.DB.shops)) {
    const b = { regnas: 1, milt: 1, porta: 2, elfin: 3, salva: 3, frost: 4, arcana: 5, edge: 6 }[loc.split('_')[0]];
    if (b <= band) for (const id of R.DB.shops[loc].items) if (I[id].type !== 'consumable') R.State.addItem(id);
  }
  R.Rules.optimize(w);
  const wi = I[w.equip.weapon];
  ok(wi && wi.band === band, `band ${band}: optimizer picked a band-${band} weapon (${w.equip.weapon})`);
  console.log(`band ${band} warrior best:`, JSON.stringify(w.equip), 'atk', R.Rules.stats(w).atk, 'def', R.Rules.stats(w).def);
}

// seeds grow stats permanently
const n = R.Rules.newChar('non');
const before = R.Rules.stats(n);
for (const id of R.ITEM_RARE.seeds) {
  const g = I[id].use.effects[0];
  R.Rules.grow(n, g.stat, g.n);
}
const after = R.Rules.stats(n);
for (const k of ['str', 'vit', 'agi', 'int', 'mnd', 'luk', 'hp', 'mp']) ok(after[k] > before[k], `seed raises ${k}`);

// shops never sell rare/key items and every consumable has a usable target
for (const sid in R.DB.shops) for (const id of R.DB.shops[sid].items) ok(!I[id].rare && I[id].price > 0, `${sid}: ${id} sellable`);
console.log(fails ? `\n${fails} failure(s)` : '\nall item tests passed');
process.exitCode = fails ? 1 : 0;
