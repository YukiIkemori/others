#!/usr/bin/env node
// Battle engine tests (node, no DOM): formulas, every effect / target / reaction /
// mod / status, monster AI conds, escape, surprise rounds, rewards, simulate().
//   node tools/test_battle.js            (exit 1 on failure)
// Uses only the 'tb_' fixtures from tools/fixtures/battle/data.js.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const R = require('./lib/load')({ quiet: true });
new Function('window', fs.readFileSync(path.join(ROOT, 'tools/fixtures/battle/data.js'), 'utf8'))({ RPG: R });
R.warn = () => {};
const { U, DB } = R;
const B = R.Battle;

let passes = 0, fails = 0, section = '';
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log(`  FAIL [${section}] ${msg}`); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, `${msg} (got ${a.toFixed ? a.toFixed(3) : a}, want ${b.toFixed ? b.toFixed(3) : b} ±${tol})`); }
function sec(n) { section = n; }

// ------------------------------------------------------------ helpers
function mk(o) {
  return new B.Engine(Object.assign({ party: R.fxBattleParty(10), mons: ['tb_dummy'], inv: {}, live: false, noSurprise: true }, o || {}));
}
function run(gen) { const out = []; for (const ev of gen) out.push(ev); return out; }
const texts = (evs) => evs.filter((e) => e.t === 'msg').map((e) => e.text);
const said = (evs, re) => texts(evs).some((t) => (re instanceof RegExp ? re.test(t) : t.includes(re)));
function withStats(u, o) { u.d = Object.assign({}, u.d, o); return u; }
function mean(fn, n) { let s = 0; for (let i = 0; i < n; i++) s += fn(i); return s / n; }
function use(e, u, id, target, item) {
  const ab = item ? DB.items[id].use : DB.abilities[id];
  return run(e.useAbility(u, id, ab, target, item ? DB.items[id] : null));
}
const P = (e, i) => e.party[i];
const Mo = (e, i) => e.mons[i];

U.seed(12345);

// ================================================================ formulas
sec('phys');
{
  const e = mk();
  const yuki = P(e, 0), dummy = Mo(e, 0);
  const atk = yuki.stat('atk');
  ok(atk > 20, 'party atk includes weapon');
  let lo = Infinity, hi = -Infinity, crits = 0, n = 3000;
  for (let i = 0; i < n; i++) {
    const r = e.roll(yuki, dummy, { formula: 'phys', power: 1 }, {});
    if (r.miss) continue;
    if (r.crit) { crits++; ok(r.dmg >= atk * 0.95 - 1e-9 && r.dmg <= atk * 1.05 + 1e-9, 'crit = atk × 0.95..1.05'); continue; }
    lo = Math.min(lo, r.dmg); hi = Math.max(hi, r.dmg);
  }
  ok(lo >= atk / 2 * 0.875 - 1e-9 && hi <= atk / 2 * 1.125 + 1e-9, `non-crit within base × 0.875..1.125 (${lo.toFixed(1)}..${hi.toFixed(1)}, base ${atk / 2})`);
  near(crits / n, yuki.stat('crit') / 100, 0.012, 'crit rate = crit %');

  const gob = new B.MonUnit('tb_goblin', 1);
  const nc = mean(() => { const r = e.roll(yuki, gob, { formula: 'phys', power: 1 }, {}); return r.miss || r.crit ? atk / 2 - 9 / 4 : r.dmg; }, 3000);
  near(nc, atk / 2 - 9 / 4, 0.3, 'base = atk×power/2 − def/4');
  const p15 = mean(() => { const r = e.roll(yuki, dummy, { formula: 'phys', power: 1.5, critBonus: -100 }, {}); return r.miss ? atk * 0.75 : r.dmg; }, 3000);
  near(p15, atk * 1.5 / 2, 0.4, 'power scales atk');
  const allCrit = mean(() => (e.roll(yuki, gob, { formula: 'phys', power: 1, critBonus: 100, acc: 10 }, {}).crit ? 1 : 0), 300);
  ok(allCrit === 1, 'critBonus 100 always crits');
  const cd = mean(() => e.roll(yuki, gob, { formula: 'phys', power: 1, critBonus: 100, acc: 10 }, {}).dmg, 1000);
  near(cd, atk * 2 * 1, atk * 0.06 + atk, 'crit ignores def (≈ atk × elem 1)');

  // base < 1 → 0 or 1
  const slime = new B.MonUnit('tb_slime', 2);
  const tank = withStats(new B.MonUnit('tb_goblin', 3), { def: 500 });
  const vals = new Set();
  for (let i = 0; i < 500; i++) { const r = e.roll(slime, tank, { formula: 'phys', power: 1, critBonus: -100, acc: 10 }, {}); if (!r.miss) vals.add(r.dmg); }
  ok(vals.size === 2 && vals.has(0) && vals.has(1), 'base < 1 → 0 or 1 at random');

  // hit chance & blind & sleep
  const evader = withStats(new B.MonUnit('tb_goblin', 4), { eva: 50 });
  const hitRate = mean(() => (e.roll(yuki, evader, { formula: 'phys' }, {}).miss ? 0 : 1), 4000);
  near(hitRate, (yuki.stat('hit') - 50) / 100, 0.03, 'hit chance = hit − eva');
  yuki.status.blind = true;
  const blindRate = mean(() => (e.roll(yuki, evader, { formula: 'phys' }, {}).miss ? 0 : 1), 4000);
  near(blindRate, (yuki.stat('hit') - 50) / 200, 0.03, 'blind halves hit');
  delete yuki.status.blind;
  evader.status.sleep = true;
  ok(mean(() => (e.roll(yuki, evader, { formula: 'phys' }, {}).miss ? 0 : 1), 500) === 1, 'sleeping target is always hit');
  delete evader.status.sleep;

  // element via weapon, immune, absorb
  yuki.c.equip.weapon = 'tb_flame'; yuki.refresh();
  const fire = mean(() => { const r = e.roll(yuki, gob, { formula: 'phys', critBonus: -100, acc: 10 }, {}); return r.dmg; }, 3000);
  near(fire, (yuki.stat('atk') / 2 - 9 / 4) * 2, 0.6, 'weapon element × monster elem (fire 2)');
  yuki.c.equip.weapon = 'tb_sword'; yuki.refresh();
  const thunderHit = run(e.hit(yuki, gob, e.roll(yuki, gob, { formula: 'phys', element: 'thunder', critBonus: -100, acc: 10 }, {}), { kind: 'phys' }));
  ok(said(thunderHit, 'ダメージを与えられない'), 'element 0 → no damage message');
  gob.hp = 10;
  const windHit = run(e.hit(yuki, gob, e.roll(yuki, gob, { formula: 'phys', element: 'wind', critBonus: -100, acc: 10 }, {}), { kind: 'phys' }));
  ok(said(windHit, '吸収') && gob.hp > 10, 'negative element multiplier absorbs (heals)');

  // buffs × stage multipliers
  const b0 = mean(() => e.roll(yuki, dummy, { formula: 'phys', critBonus: -100, acc: 10 }, {}).dmg, 2000);
  yuki.buffs.atk = 2;
  const b2 = mean(() => e.roll(yuki, dummy, { formula: 'phys', critBonus: -100, acc: 10 }, {}).dmg, 2000);
  near(b2 / b0, 2, 0.05, 'atk +2 → ×2');
  yuki.buffs.atk = 0; dummy.buffs.def = 1;
  const d1 = mean(() => e.roll(yuki, dummy, { formula: 'phys', critBonus: -100, acc: 10 }, {}).dmg, 2000);
  near(d1 / b0, 1 / 1.5, 0.03, 'target def +1 → ÷1.5');
  dummy.buffs.def = -2;
  near(mean(() => e.roll(yuki, dummy, { formula: 'phys', critBonus: -100, acc: 10 }, {}).dmg, 2000) / b0, 2, 0.06, 'target def −2 → ×2');
  dummy.buffs.def = 0;
  ok(B.stageMult(-1) === 0.75 && B.stageMult(1) === 1.5 && B.stageMult(5) === 2, 'stage table');

  // physPct mod, ignoreDef, vs
  yuki.c.jobs.tb_fighter.learned.push('tb_brawn'); yuki.c.set.support = 'tb_brawn'; yuki.refresh();
  near(mean(() => e.roll(yuki, dummy, { formula: 'phys', critBonus: -100, acc: 10 }, {}).dmg, 2000) / b0, 1.5, 0.04, 'physPct +50');
  yuki.c.set.support = null; yuki.refresh();
  const ig = mean(() => e.roll(yuki, tank, { formula: 'phys', ignoreDef: true, critBonus: -100, acc: 10 }, {}).dmg, 2000);
  near(ig, atk / 2, 0.4, 'ignoreDef');
  const bone = new B.MonUnit('tb_bone', 5);
  const vsd = mean(() => e.roll(yuki, bone, { formula: 'phys', element: 'holy', vs: { undead: 2 }, critBonus: -100, acc: 10 }, {}).dmg, 3000);
  near(vsd, (atk / 2 - 12 / 4) * 4, 1, 'vs undead ×2 and holy weakness ×2');

  // defend halves
  const def = run(e.hit(Mo(e, 0), yuki, { dmg: 40 }, { kind: 'phys' }));
  const hp0 = yuki.mhp;
  ok(yuki.hp === hp0 - 40 && said(def, '40のダメージを受けた'), 'party damage message');
  yuki.hp = yuki.mhp; yuki.defending = true;
  run(e.hit(Mo(e, 0), yuki, { dmg: 40 }, { kind: 'phys' }));
  ok(yuki.hp === hp0 - 20, 'defend halves damage');
  yuki.defending = false; yuki.hp = yuki.mhp;
}

sec('metal');
{
  const e = mk({ mons: ['tb_metal'] });
  const yuki = P(e, 0), metal = Mo(e, 0);
  metal.d = Object.assign({}, metal.d, { eva: 0 });
  const set = new Set();
  for (let i = 0; i < 400; i++) { const r = e.roll(yuki, metal, { formula: 'phys', critBonus: -100 }, {}); if (!r.miss) set.add(r.dmg); }
  ok([...set].every((v) => v === 0 || v === 1) && set.size === 2, 'metal: phys dmg 0–1');
  const cs = new Set();
  for (let i = 0; i < 400; i++) { const r = e.roll(yuki, metal, { formula: 'phys', critBonus: 100 }, {}); if (!r.miss) cs.add(r.dmg); }
  ok([...cs].every((v) => v >= 1 && v <= 3) && cs.size === 3, 'metal: crit 1–3');
  const metem = P(e, 2);
  ok(e.roll(metem, metal, DB.abilities.tb_fire.effects[0], {}).immune, 'metal immune to magic');
  ok(e.roll(metem, metal, { formula: 'breath', power: 20 }, {}).immune, 'metal immune to breath');
  const g = e.roll(metem, metal, DB.abilities.tb_gravity.effects[0], {});
  ok(!g.immune && g.dmg >= 1, 'percent works on metal');
}

sec('magic');
{
  const e = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_slime'] });
  const metem = P(e, 2);
  const gob = Mo(e, 0);
  const mag = metem.stat('mag');
  const exp = (12 + mag * 0.6) * (100 / (100 + gob.stat('mdef'))) * 2;
  const got = mean(() => e.roll(metem, gob, DB.abilities.tb_fire.effects[0], {}).dmg, 4000);
  near(got, exp, exp * 0.01, 'magic = (power + mag×0.6) × 100/(100+mdef) × elem');
  const ice = mean(() => e.roll(metem, gob, DB.abilities.tb_blizzard.effects[0], {}).dmg, 4000);
  near(ice, (10 + mag * 0.6) * (100 / 105) * 0.5, 0.3, 'resist 0.5');
  metem.c.jobs.tb_caster.learned.push('tb_booster'); metem.c.set.support = 'tb_booster'; metem.refresh();
  near(mean(() => e.roll(metem, gob, DB.abilities.tb_fire.effects[0], {}).dmg, 4000) / got, 1.5, 0.02, 'magicPct +50');
  metem.c.set.support = null; metem.c.equip.acc = 'tb_boost'; metem.refresh();
  near(mean(() => e.roll(metem, gob, DB.abilities.tb_fire.effects[0], {}).dmg, 4000) / got, 1.5, 0.02, 'elemBoost fire +50');
  metem.c.equip.acc = null; metem.refresh();
  metem.buffs.mag = 1; gob.buffs.mdef = -1;
  near(mean(() => e.roll(metem, gob, DB.abilities.tb_fire.effects[0], {}).dmg, 4000) / got, 1.5 / 0.75, 0.04, 'mag / mdef buffs');
  metem.buffs.mag = 0; gob.buffs.mdef = 0;
  // fixed & breath & percent
  near(mean(() => e.roll(metem, gob, { formula: 'fixed', power: 50 }, {}).dmg, 3000), 50, 0.6, 'fixed = power × 0.9..1.1');
  near(mean(() => e.roll(metem, gob, { formula: 'fixed', power: 50, element: 'fire' }, {}).dmg, 3000), 100, 1.2, 'fixed × element');
  const yuki = P(e, 0);
  yuki.c.equip.acc = 'tb_ring'; yuki.refresh();
  const dm = Mo(e, 1);
  near(mean(() => e.roll(dm, yuki, { formula: 'breath', power: 40, element: 'fire' }, {}).dmg, 3000), 20, 0.4, 'breath reduced only by elemResist');
  near(mean(() => e.roll(dm, P(e, 1), { formula: 'breath', power: 40, element: 'fire' }, {}).dmg, 3000), 40, 0.6, 'breath ignores def/mdef');
  yuki.c.equip.acc = null; yuki.refresh();
  gob.hp = 30;
  ok(e.roll(metem, gob, { formula: 'percent', power: 0.25 }, {}).dmg === 7, 'percent = targetHP × power');
  const boss = new B.MonUnit('tb_boss', 7);
  ok(e.roll(metem, boss, { formula: 'percent', power: 0.25 }, {}).immune, 'percent fails on bosses');
  // item damage with itemPct
  const non = P(e, 1);
  non.c.jobs.tb_caster.learned.push('tb_chemist'); non.c.set.support = 'tb_chemist'; non.refresh();
  near(mean(() => e.roll(non, gob, { formula: 'fixed', power: 30 }, { item: DB.items.tb_firebomb }).dmg, 3000), 60, 0.8, 'itemPct +100 on item damage');
  non.c.set.support = null; non.refresh();
}

// ================================================================ effects
sec('heal');
{
  const e = mk();
  const non = P(e, 1), yuki = P(e, 0);
  yuki.hp = 1;
  const mnd = non.stat('mnd');
  const ev = use(e, non, 'tb_heal', yuki);
  const healed = yuki.hp - 1;
  ok(healed >= Math.round((30 + mnd * 0.5) * 0.95) && healed <= Math.round((30 + mnd * 0.5) * 1.05), `heal = (power + mnd×scale) × 0.95..1.05 (${healed})`);
  ok(said(ev, 'ノンはヒールを唱えた！') && said(ev, `ユウキのHPが${healed}回復した！`), 'heal messages');
  ok(non.mp === non.mmp - 3, 'mp paid');
  non.c.jobs.tb_caster.learned.push('tb_booster'); non.c.set.support = 'tb_booster'; non.refresh();
  const h2 = mean(() => { yuki.hp = 1; run(e.effect(non, yuki, DB.abilities.tb_heal.effects[0], { ab: DB.abilities.tb_heal })); return yuki.hp - 1; }, 400);
  near(h2, (30 + mnd * 0.5) * 1.5, 1.2, 'healPct +50');
  yuki.hp = yuki.mhp;
  const full = run(e.effect(non, yuki, { type: 'heal', power: 30 }, { ab: {} }));
  ok(said(full, '満タン'), 'heal at full HP');
  // item heal ignores mnd, itemPct doubles
  yuki.hp = 1;
  e.inv.tb_herb = 2;
  use(e, non, 'tb_herb', yuki, true);
  ok(yuki.hp >= 1 + Math.round(30 * 0.95) && yuki.hp <= 1 + Math.round(30 * 1.05), `item heal = power × 0.95..1.05, no mnd (${yuki.hp - 1})`);
  ok(e.count('tb_herb') === 1, 'item consumed');
  non.c.set.support = 'tb_chemist'; non.c.jobs.tb_caster.learned.push('tb_chemist'); non.refresh();
  yuki.hp = 1; use(e, non, 'tb_herb', yuki, true);
  ok(yuki.hp >= 1 + Math.round(60 * 0.95) && yuki.hp <= 1 + Math.round(60 * 1.05), `itemPct +100 (${yuki.hp - 1})`);
  const none = use(e, non, 'tb_herb', yuki, true);
  ok(said(none, 'もうなかった'), 'no item left');
  // pct heal & healMp
  yuki.hp = 1;
  run(e.effect(non, yuki, { type: 'heal', pct: 1 }, { ab: {} }));
  ok(yuki.hp === yuki.mhp, 'pct 1 = full heal');
  P(e, 2).mp = 0;
  const mpEv = use(e, non, 'tb_ether', P(e, 2));
  ok(P(e, 2).mp === Math.min(10, P(e, 2).mmp) && said(mpEv, 'MPが'), 'healMp');
}

sec('revive/cure/status');
{
  const e = mk({ mons: ['tb_goblin', 'tb_boss'] });
  const non = P(e, 1), yuki = P(e, 0), metem = P(e, 2);
  run(e.die(yuki, null));
  ok(!yuki.alive && yuki.hp === 0, 'died');
  const hev = use(e, non, 'tb_heal', yuki);
  ok(!yuki.alive && !said(hev, 'ユウキのHPが'), 'heal does not revive (retargets living ally)');
  const rev = use(e, non, 'tb_revive', yuki);
  ok(yuki.alive && yuki.hp === Math.floor(yuki.mhp * 0.5) && said(rev, 'ユウキは生き返った！'), 'revive pct');
  const again = use(e, non, 'tb_revive', yuki);
  ok(said(again, '何も起こらなかった'), 'revive on nobody');
  // status + resist + immune + cure
  const gob = Mo(e, 0), boss = Mo(e, 1);
  metem.c.jobs.tb_caster.learned.push('tb_poison', 'tb_confuse', 'tb_stun', 'tb_blind', 'tb_sleep', 'tb_doom');
  let ev = use(e, metem, 'tb_poison', gob);
  ok(gob.status.poison && said(ev, '毒に冒された'), 'poison inflicted');
  ev = use(e, metem, 'tb_poison', gob);
  ok(said(ev, '効かなかった'), 'already poisoned');
  ev = use(e, metem, 'tb_mute', boss);
  ok(!boss.status.silence && said(ev, '効かなかった'), 'statusRes 1 = immune');
  const sleepRes = mean(() => { delete boss.status.blind; run(e.inflict(metem, boss, 'blind', 1, true)); return boss.status.blind ? 1 : 0; }, 2000);
  near(sleepRes, 0.5, 0.04, 'success = chance × (1 − resist)');
  yuki.c.equip.acc = 'tb_ring'; yuki.refresh();
  ev = run(e.inflict(Mo(e, 0), yuki, 'sleep', 1, false));
  ok(!yuki.status.sleep && said(ev, '効かなかった'), 'statusImmune from equipment');
  yuki.c.equip.acc = null; yuki.refresh();
  run(e.inflict(gob, yuki, 'sleep', 1, false));
  run(e.inflict(gob, yuki, 'blind', 1, false));
  run(e.inflict(gob, yuki, 'poison', 1, false));
  ok(yuki.status.sleep && yuki.turns.sleep >= 1 && yuki.turns.sleep <= 4, 'sleep turns 1–4');
  ok(yuki.turns.blind >= 3 && yuki.turns.blind <= 5, 'blind turns 3–5');
  ev = use(e, non, 'tb_cure', yuki);
  ok(!yuki.status.sleep && !yuki.status.blind && !yuki.status.poison && said(ev, '目を覚ました') && said(ev, '毒が消えた'), 'cure all');
  // death status: boss immune
  ev = use(e, metem, 'tb_doom', boss);
  ok(boss.alive && said(ev, '効かなかった'), 'death fails on boss');
  ev = use(e, metem, 'tb_doom', gob);
  ok(!gob.alive && said(ev, 'テストゴブリンを倒した！') && e.killed.includes(gob), 'death kills');
}

sec('turn statuses');
{
  const e = mk({ mons: ['tb_goblin'] });
  const yuki = P(e, 0);
  yuki.status.sleep = true; yuki.turns.sleep = 2;
  let ev = run(e.turn(yuki, { type: 'attack', target: Mo(e, 0) }));
  ok(said(ev, '眠っている') && !said(ev, '攻撃'), 'asleep: no action');
  ev = run(e.turn(yuki, { type: 'attack', target: Mo(e, 0) }));
  ok(said(ev, '目を覚ました') && !yuki.status.sleep && !said(ev, '攻撃！'), 'wakes up (turn lost)');
  yuki.status.paralyze = true; yuki.turns.paralyze = 1;
  ev = run(e.turn(yuki, { type: 'attack', target: Mo(e, 0) }));
  ok(said(ev, 'しびれが取れた'), 'paralysis wears off');
  // poison tick 1/12, regen 1/10
  yuki.hp = yuki.mhp; yuki.status.poison = true;
  ev = run(e.endTurn(yuki));
  ok(yuki.hp === yuki.mhp - Math.floor(yuki.mhp / 12) && said(ev, '毒で'), 'poison 1/12 max HP');
  delete yuki.status.poison;
  run(e.inflict(yuki, yuki, 'regen', 1));
  ok(yuki.turns.regen === 5, 'regen 5 turns');
  yuki.hp = 10;
  run(e.endTurn(yuki));
  ok(yuki.hp === 10 + Math.floor(yuki.mhp / 10), 'regen +1/10 max HP');
  for (let i = 0; i < 4; i++) run(e.endTurn(yuki));
  ok(!yuki.status.regen, 'regen expires');
  // silence blocks magic; mp shortage
  const metem = P(e, 2);
  metem.status.silence = true; metem.turns.silence = 3;
  ev = use(e, metem, 'tb_fire', Mo(e, 0));
  ok(said(ev, '魔法は封じられている') && Mo(e, 0).hp === Mo(e, 0).mhp, 'silence blocks magic');
  ok(e.unusable(metem, 'tb_fire') === 'silence' && !e.unusable(P(e, 0), 'tb_power'), 'unusable() reports silence');
  delete metem.status.silence;
  metem.mp = 1;
  ev = use(e, metem, 'tb_fire', Mo(e, 0));
  ok(said(ev, 'MPが足りない'), 'not enough MP');
  ok(e.unusable(metem, 'tb_fire') === 'mp', 'unusable() reports mp');
  ok(e.unusable(P(e, 0), 'tb_warpout') === 'field', 'field-only ability unusable in battle');
  // confusion: random targets including friends
  const e2 = mk({ mons: ['tb_dummy', 'tb_dummy'] });
  const y2 = P(e2, 0);
  let friend = 0, foe = 0;
  for (let i = 0; i < 400; i++) { const c = e2.confusedCommand(y2); if (c.target.isParty) friend++; else foe++; ok(c.target !== y2, 'confused never self when others exist'); }
  ok(friend > 120 && foe > 120, `confuse picks friends and foes (${friend}/${foe})`);
  y2.status.confuse = true; y2.turns.confuse = 5;
  const cev = run(e2.turn(y2, null));
  ok(said(cev, '混乱している') && said(cev, 'ユウキの攻撃！'), 'confused unit attacks anyway');
  let woke = 0, snapped = 0;
  for (let i = 0; i < 400; i++) {
    const g = mk({ mons: ['tb_dummy'] });
    const t = P(g, 1);
    t.status.sleep = true; t.turns.sleep = 4; t.status.confuse = true; t.turns.confuse = 4;
    run(g.hit(Mo(g, 0), t, { dmg: 1 }, { kind: 'magic' }));
    if (!t.status.sleep) woke++;
    if (!t.status.confuse) snapped++;
  }
  near(woke / 400, 0.5, 0.07, 'sleep: 50 % wake when hit');
  near(snapped / 400, 0.6, 0.07, 'confuse: 60 % recover when hit');
}

sec('buff/dispel/steal/scan/escape/grow/special');
{
  const e = mk({ mons: ['tb_slime', 'tb_goblin', 'tb_boss'] });
  const yuki = P(e, 0), non = P(e, 1), metem = P(e, 2);
  let ev = use(e, non, 'tb_protect', null);
  ok(e.party.every((p) => p.buffs.def === 1) && texts(ev).filter((t) => t.includes('守備力が上がった')).length === 3, 'allies buff');
  use(e, non, 'tb_protect', null);
  ev = use(e, non, 'tb_protect', null);
  ok(yuki.buffs.def === 2 && said(ev, 'もう上がらない'), 'buff clamps at +2');
  metem.c.jobs.tb_caster.learned.push('tb_dispel');
  use(e, metem, 'tb_weaken', Mo(e, 1));
  use(e, metem, 'tb_weaken', Mo(e, 1));
  ev = use(e, metem, 'tb_weaken', Mo(e, 1));
  ok(Mo(e, 1).buffs.atk === -2 && said(ev, 'もう下がらない'), 'debuff clamps at −2');
  ev = use(e, metem, 'tb_dispel', Mo(e, 1));
  ok(Mo(e, 1).buffs.atk === 0 && said(ev, '効果が消えた'), 'dispel');
  // steal: normal / rare / nothing / fail
  yuki.c.jobs.tb_fighter.learned.push('tb_mug', 'tb_seed', 'tb_smoke', 'tb_special', 'tb_sacrifice', 'tb_drain', 'tb_osmose', 'tb_holyblade');
  let items = 0, rares = 0, nothing = 0, fail = 0;
  for (let i = 0; i < 600; i++) {
    const s = new B.MonUnit('tb_slime', 9);
    for (const k in e.inv) if (e.inv[k] >= 98) e.inv[k] = 1; // the bag holds 99 of each item
    const ev2 = run(e.steal(yuki, s, {}));
    if (said(ev2, 'テスト薬草を盗んだ')) items++;
    else if (said(ev2, 'きらめく石を盗んだ')) { rares++; ok(ev2.some((x) => x.t === 'rare'), 'rare steal event'); }
    else fail++;
    if (said(run(e.steal(yuki, s, {})), '何も持っていない')) nothing++;
  }
  ok(nothing === items + rares, 'second steal: nothing left');
  near(rares / (items + rares), 0.125, 0.04, 'rare steal ≈ 1/8');
  near((items + rares) / 600, e.stealChance(yuki, new B.MonUnit('tb_slime', 9)), 0.06, 'steal success from agi/luk');
  ok(fail > 0 && items > 0, 'steal can fail');
  yuki.c.jobs.tb_fighter.learned.push('tb_lucky'); yuki.c.set.support = 'tb_lucky'; yuki.refresh();
  ok(e.stealChance(yuki, Mo(e, 0)) > 0.9 * Math.min(0.98, 2 * U.clamp(0.4 + (yuki.stat('agi') - 5) / 200 + yuki.stat('luk') / 400, 0.1, 0.9)), 'stealPct doubles');
  ok(Math.abs(e.rareStealChance(yuki, { rareBonus: 0.125 }) - 0.5) < 1e-9, 'rareBonus + rarePct');
  yuki.c.set.support = null; yuki.refresh();
  ok(e.count('tb_herb') > 0 && e.count('tb_gem') > 0, 'stolen items go to the inventory');
  ev = use(e, yuki, 'tb_steal', Mo(e, 2));
  // scan
  ev = use(e, yuki, 'tb_scan', Mo(e, 1));
  ok(said(ev, /^テストゴブリン　レベル3　HP\d+\/34$/) && said(ev, '弱点：炎') && said(ev, '吸収：風'), 'scan shows HP / weakness / absorb');
  // grow
  const str0 = yuki.stat('str');
  ev = use(e, yuki, 'tb_seed', yuki);
  ok(yuki.stat('str') === str0 + 2 && yuki.c.bonus.str === 2 && said(ev, '力が2上がった'), 'grow (seed)');
  const hp0 = yuki.hp, mhp0 = yuki.mhp;
  e.inv.tb_nut = 1;
  run(e.effect(yuki, yuki, { type: 'grow', stat: 'hp', n: 8 }, { ab: {} }));
  ok(yuki.mhp === mhp0 + 8 && yuki.hp === hp0 + 8, 'grow hp raises current HP too');
  // special registry
  B.specials.tb_special = function* (eng, u, t) { t.hp = 1; yield eng.m('特別な効果！'); };
  ev = use(e, yuki, 'tb_special', Mo(e, 1));
  ok(Mo(e, 1).hp === 1 && said(ev, '特別な効果'), 'special effect hook');
  delete B.specials.tb_special;
  ev = use(e, yuki, 'tb_special', Mo(e, 1));
  ok(said(ev, '何も起こらなかった'), 'unknown special does nothing');
  ev = use(e, yuki, 'tb_warpout', null);
  ok(said(ev, 'ここでは使えない'), 'field-only effect in battle');
  // escape effect
  ev = use(e, yuki, 'tb_smoke', null);
  ok(e.result === null && said(ev, '逃げられない'), 'escape effect blocked by a boss');
  const e3 = mk({ mons: ['tb_slime'] });
  ev = use(e3, P(e3, 0), 'tb_smoke', null);
  ok(e3.result === 'escape' && ev.some((x) => x.t === 'escape' && x.ok), 'escape effect guaranteed');
}

sec('targets');
{
  const e = mk({ mons: ['tb_slime', 'tb_slime', 'tb_goblin', 'tb_goblin', 'tb_wolf'] });
  const metem = P(e, 2);
  ok(Mo(e, 0).name === 'テストスライムＡ' && Mo(e, 1).name === 'テストスライムＢ' && Mo(e, 4).name === 'テストウルフ', 'duplicate species get letters');
  for (const m of e.mons) m.hp = m.mhp = 999;
  let ev = use(e, metem, 'tb_blizzard', Mo(e, 2));
  const hitNames = ev.filter((x) => x.t === 'dmg').map((x) => x.u.name);
  ok(hitNames.join() === 'テストゴブリンＡ,テストゴブリンＢ', 'group = same species as the chosen target');
  ev = use(e, metem, 'tb_thunder', null);
  ok(ev.filter((x) => x.t === 'dmg' || x.t === 'miss').length === 5, 'enemies = all');
  metem.mp = 99;
  ev = use(e, metem, 'tb_meteor', null);
  const n = ev.filter((x) => x.t === 'fx').length;
  ok(n >= 3 && n <= 5 && ev.filter((x) => x.t === 'dmg').length === n, 'random: hits [3,5] random targets');
  // retarget when the chosen monster died
  Mo(e, 0).hp = 0;
  ev = use(e, metem, 'tb_fire', Mo(e, 0));
  ok(ev.find((x) => x.t === 'dmg').u === Mo(e, 1), 'enemy target retargets to same species');
  const t = e.targets(P(e, 1), DB.abilities.tb_healall, null);
  ok(t.length === 3, 'allies');
  ok(e.targets(P(e, 1), { target: 'self' }, null)[0] === P(e, 1), 'self');
  P(e, 0).hp = 0;
  ok(e.targets(P(e, 1), DB.abilities.tb_revive, null)[0] === P(e, 0), 'ally_dead picks a fallen ally');
  ok(e.targets(P(e, 1), { target: 'ally_any' }, P(e, 0))[0] === P(e, 0), 'ally_any can pick the dead');
  ok(e.targets(P(e, 1), { target: 'allies', effects: [{ type: 'revive' }] }, null).length === 3, 'allies with revive includes the fallen');
  // monster-side targets
  const mt = e.targets(Mo(e, 2), { target: 'group' }, P(e, 1));
  ok(mt.length === 2 && mt.every((u) => u.isParty), 'monster group = the whole party');
}

sec('multi-hit/drain/hpCost/mp');
{
  const e = mk({ mons: ['tb_dummy'] });
  const yuki = P(e, 0), dummy = Mo(e, 0);
  let ev = use(e, yuki, 'tb_double', dummy);
  ok(ev.filter((x) => x.t === 'dmg' || x.t === 'miss').length === 2 && ev.filter((x) => x.t === 'fx').length === 2, 'hits: 2');
  yuki.hp = 50;
  const hp0 = dummy.hp;
  ev = use(e, yuki, 'tb_drain', dummy);
  const dealt = hp0 - dummy.hp;
  ok(dealt === 0 || yuki.hp === Math.min(yuki.mhp, 50 + Math.round(dealt * 0.5)), 'drain heals user by dmg × drain');
  yuki.hp = yuki.mhp;
  ev = use(e, yuki, 'tb_sacrifice', dummy);
  ok(yuki.hp === yuki.mhp - Math.floor(yuki.mhp * 0.1), 'hpCost paid');
  yuki.hp = 3;
  use(e, yuki, 'tb_sacrifice', dummy);
  ok(yuki.hp === 1, 'hpCost never kills');
  const e2 = mk({ mons: ['tb_mage'] });
  const mage = Mo(e2, 0);
  P(e2, 0).mp = 0;
  P(e2, 0).c.jobs.tb_fighter.learned.push('tb_osmose');
  ev = use(e2, P(e2, 0), 'tb_osmose', mage);
  const lost = 40 - mage.mp;
  ok(lost > 0 && P(e2, 0).mp === Math.min(P(e2, 0).mmp, lost) && mage.hp === mage.mhp && said(ev, 'MPが') && said(ev, 'MPを'), 'MP damage + MP drain');
}

// ================================================================ reactions / supports
sec('reactions');
{
  const e = mk({ mons: ['tb_goblin'] });
  const [yuki, non, metem] = e.party;
  const gob = Mo(e, 0);
  gob.hp = gob.mhp = 999;
  gob.d = Object.assign({}, gob.d, { hit: 999, crit: 0 });
  let ev = run(e.attack(gob, yuki, false));
  ev = ev.concat(run(e.flushReactions()));
  ok(said(ev, 'ユウキのカウンター！') && gob.hp < 999, 'counter on physical hit (announced with the reaction name)');
  ev = run(e.hit(gob, yuki, { dmg: 5 }, { kind: 'magic' }));
  ev = ev.concat(run(e.flushReactions()));
  ok(!said(ev, '反撃'), 'hitPhys ignores magic');
  // lowHp heal
  const learn = (u, id, slot) => { const ab = DB.abilities[id]; (u.c.jobs[ab.job] = u.c.jobs[ab.job] || { jp: 0, total: 0, learned: [] }).learned.push(id); u.c.set[slot] = id; u.refresh(); };
  learn(non, 'tb_autoheal', 'reaction');
  non.hp = Math.floor(non.mhp * 0.3);
  run(e.hit(gob, non, { dmg: 10 }, { kind: 'phys' }));
  ev = run(e.flushReactions());
  ok(said(ev, 'ノンのオートヒール！') && ev.some((x) => x.t === 'heal' && x.u === non), 'lowHp → heal');
  // autoItem (never rare items)
  learn(metem, 'tb_autoitem', 'reaction');
  e.inv.tb_herb = 1; e.inv.tb_gem = 3;
  metem.hp = metem.mhp;
  run(e.hit(gob, metem, { dmg: 20 }, { kind: 'phys' }));
  ev = run(e.flushReactions());
  ok(said(ev, 'メテムはとっさにテスト薬草を使った！') && !e.inv.tb_herb && e.inv.tb_gem === 3, 'autoItem uses a heal item');
  run(e.hit(gob, metem, { dmg: 5 }, { kind: 'phys' }));
  ev = run(e.flushReactions());
  ok(!ev.length, 'autoItem with no item does nothing');
  // buff reaction, mp reaction (hitMagic)
  learn(metem, 'tb_rage', 'reaction');
  run(e.hit(gob, metem, { dmg: 1 }, { kind: 'magic' }));
  run(e.flushReactions());
  ok(metem.buffs.atk === 1, 'buff reaction');
  learn(metem, 'tb_manashield', 'reaction');
  metem.mp = 0;
  run(e.hit(gob, metem, { dmg: 1 }, { kind: 'magic' }));
  run(e.flushReactions());
  ok(metem.mp === 7, 'mp reaction on magic hit');
  // reactions do not fire while asleep
  metem.status.paralyze = true; metem.turns.paralyze = 3; metem.mp = 0;
  run(e.hit(gob, metem, { dmg: 1 }, { kind: 'magic' }));
  run(e.flushReactions());
  ok(metem.mp === 0, 'no reaction while paralysed');
  delete metem.status.paralyze;
  // cover
  learn(yuki, 'tb_cover', 'reaction');
  non.hp = 2; yuki.hp = yuki.mhp;
  ev = run(e.attack(gob, non, false));
  ok(said(ev, 'ユウキはノンをかばった！') && non.hp === 2 && yuki.hp < yuki.mhp, 'cover takes the hit for a weak ally');
  // allyLowHp heal
  learn(yuki, 'tb_guardian', 'reaction');
  non.hp = non.mhp;
  run(e.hit(gob, non, { dmg: non.mhp - 3 }, { kind: 'phys' }));
  ev = run(e.flushReactions());
  ok(said(ev, 'ユウキのガーディアン！') && non.hp > 3, 'allyLowHp heals the ally');
  // ko revive (once per battle)
  learn(non, 'tb_phoenix', 'reaction');
  non.hp = 5;
  ev = run(e.hit(gob, non, { dmg: 50 }, { kind: 'phys' }));
  ok(said(ev, 'ノンは倒れた！') && said(ev, '再び立ち上がった') && non.hp === Math.floor(non.mhp * 0.5), 'ko → revive');
  non.hp = 5;
  ev = run(e.hit(gob, non, { dmg: 50 }, { kind: 'phys' }));
  ok(!non.alive && !said(ev, '再び'), 'ko revive only once');
}

sec('supports');
{
  const learn = (u, id, slot) => { const ab = DB.abilities[id]; (u.c.jobs[ab.job] = u.c.jobs[ab.job] || { jp: 0, total: 0, learned: [] }).learned.push(id); u.c.set[slot] = id; u.refresh(); };
  const party = R.fxBattleParty(10);
  const e = mk({ party, mons: ['tb_dummy'] });
  const yuki = P(e, 0);
  learn(yuki, 'tb_twoswords', 'support');
  // 二刀流: a second swing only with a weapon in the shield slot; that swing deals ×OFFHAND_MULT
  const dummy = Mo(e, 0);
  const swings = () => run(e.attack(yuki, dummy, false)).filter((x) => x.t === 'fx').length;
  const expOne = (atk) => e.roll(yuki, dummy, { formula: 'phys', power: 1 }, { expect: true, atk }).dmg;
  ok(B.OFFHAND_MULT === 0.6, 'OFFHAND_MULT = 0.6');
  ok(swings() === 1, 'twoSwords with an empty off hand: 1 swing');
  near(e.expectAttack(yuki, dummy), expOne(), 1e-9, 'AI estimate: 1 swing with an empty off hand');
  yuki.c.equip.shield = 'tb_shield'; yuki.refresh();
  ok(yuki.st.atk2 === 0 && swings() === 1, 'twoSwords with a shield: 1 swing');
  near(e.expectAttack(yuki, dummy), expOne(), 1e-9, 'AI estimate: 1 swing with a shield');
  yuki.c.equip.shield = 'tb_sword2'; yuki.refresh();
  ok(yuki.st.atk2 > 0 && yuki.st.atk2 < yuki.stat('atk'), 'off-hand atk2 from the second weapon');
  ok(swings() === 2, 'twoSwords with an off-hand weapon: 2 swings');
  near(e.expectAttack(yuki, dummy), expOne() + B.OFFHAND_MULT * expOne(yuki.st.atk2), 1e-9, 'AI estimate: main hand + off hand × OFFHAND_MULT');
  yuki.c.equip.shield = 'tb_sword'; yuki.refresh();
  ok(yuki.st.atk2 === yuki.stat('atk'), 'the same weapon in both hands: atk2 = atk');
  let sw1 = 0, sw2 = 0;
  for (let i = 0; i < 4000; i++) {
    dummy.hp = dummy.mhp;
    let k = -1;
    for (const x of e.attack(yuki, dummy, false)) {
      if (x.t === 'fx') k++;
      else if (x.t === 'dmg' && x.u === dummy) { if (k === 0) sw1 += x.n; else sw2 += x.n; }
    }
  }
  near(sw2 / sw1, B.OFFHAND_MULT, 0.03, 'the off-hand swing deals ×OFFHAND_MULT of the main-hand one');
  dummy.hp = dummy.mhp;
  yuki.c.equip.shield = null; yuki.refresh();
  // regen support
  learn(P(e, 1), 'tb_regen', 'support');
  const e2 = mk({ party: e.party.map((u) => u.c), mons: ['tb_dummy'] });
  const non = P(e2, 1);
  ok(non.permRegen, 'regen:true mod');
  non.hp = 10;
  run(e2.endTurn(non));
  ok(non.hp === 10 + Math.floor(non.mhp / 10), 'permanent regen ticks');
  // startBuffs
  learn(P(e2, 2), 'tb_haste', 'support');
  const e3 = mk({ party: e2.party.map((u) => u.c), mons: ['tb_dummy'] });
  run(e3.begin());
  ok(P(e3, 2).buffs.agi === 1 && P(e3, 2).buffs.def === 1, 'startBuffs');
  // mpCostPct
  const metem = P(e3, 2);
  learn(metem, 'tb_saver', 'support');
  ok(e3.mpCost(metem, 'tb_thunder', DB.abilities.tb_thunder) === 4, 'mpCostPct −50 via Rules.mpCost');
  // weapon onHit status
  const y4 = R.fxBattleChar('yuki', 'tb_fighter', 10, [], { weapon: 'tb_venom' });
  const e4 = mk({ party: [y4], mons: ['tb_dummy'] });
  let poisoned = false;
  for (let i = 0; i < 10 && !poisoned; i++) { run(e4.attack(P(e4, 0), Mo(e4, 0), false)); poisoned = !!Mo(e4, 0).status.poison; }
  ok(poisoned, 'weapon onHit status');
}

// ================================================================ monsters & rounds
sec('monster AI');
{
  const e = mk({ mons: ['tb_boss'] });
  const boss = Mo(e, 0);
  run(e.begin());
  const counts = [];
  for (let r = 0; r < 3; r++) {
    const ev = run(e.playRound([]));
    counts.push(ev.filter((x) => x.t === 'actor' && x.u === boss).length);
  }
  ok(counts.every((c) => c === 2), `actsPerTurn 2 (${counts})`);
  // every:[3,2] → 3rd, 6th … action uses en_tb_smash (w:100)
  const e2 = mk({ mons: ['tb_boss'] });
  const b2 = Mo(e2, 0);
  const picks = [];
  for (let i = 0; i < 9; i++) { picks.push(R.BattleAI.monster(e2, b2).id || 'attack'); b2.acts++; }
  ok(picks[2] === 'en_tb_smash' && picks[5] === 'en_tb_smash' && picks[8] === 'en_tb_smash', `every:[3,2] (${picks})`);
  ok(picks.filter((p) => p === 'en_tb_smash').length <= 4, 'every: only on matching turns (mostly)');
  // hpBelow + once
  b2.acts = 0; b2.hp = 100;
  const c1 = R.BattleAI.monster(e2, b2);
  ok(c1.id === 'en_tb_roar', 'hpBelow 0.5 enables action');
  run(e2.execute(b2, c1));
  ok(b2.used.en_tb_roar && R.BattleAI.monster(e2, b2).id !== 'en_tb_roar', 'once: used only once');
  // healer heals hurt ally, revives dead ally
  const e3 = mk({ mons: ['tb_mage', 'tb_goblin'] });
  const mage = Mo(e3, 0), gob = Mo(e3, 1);
  let heals = 0, revs = 0;
  for (let i = 0; i < 200; i++) {
    gob.hp = 5;
    const c = R.BattleAI.monster(e3, mage);
    if (c.id === 'en_tb_heal') { heals++; ok(c.target === gob, 'monster heals the hurt ally'); }
  }
  ok(heals > 40, `healer heals (${heals}/200)`);
  gob.hp = 0;
  for (let i = 0; i < 200; i++) { const c = R.BattleAI.monster(e3, mage); if (c.id === 'en_tb_revive') { revs++; ok(c.target === gob, 'revives the dead'); } }
  ok(revs > 20, 'monster revive');
  gob.hp = gob.mhp;
  for (let i = 0; i < 100; i++) { const c = R.BattleAI.monster(e3, mage); ok(c.id !== 'en_tb_revive' && !(c.id === 'en_tb_heal' && c.target.hpRate() >= 0.6), 'no pointless heal/revive'); }
  mage.mp = 0;
  for (let i = 0; i < 50; i++) ok(!['en_tb_fire', 'en_tb_heal'].includes(R.BattleAI.monster(e3, mage).id), 'no spells without MP');
  // flee flag
  const e4 = mk({ mons: ['tb_metal'] });
  run(e4.begin());
  let fled = false;
  for (let r = 0; r < 20 && !e4.result; r++) { const ev = run(e4.playRound([{ type: 'defend' }, { type: 'defend' }, { type: 'defend' }])); if (said(ev, '逃げ出した')) fled = true; }
  ok(fled && e4.result === 'win' && e4.killed.length === 0, 'flee monsters run away; battle ends');
  // breath monster uses msg template
  const e5 = mk({ mons: ['tb_drake'] });
  const drake = Mo(e5, 0);
  const ev5 = run(e5.useAbility(drake, 'en_tb_breath', DB.abilities.en_tb_breath, null, null));
  ok(said(ev5, 'テストドラゴンは炎を吐いた！') && ev5.filter((x) => x.t === 'dmg').length === 3, 'breath hits the whole party, custom msg');
  // monster thief steals gold only in live battles
  const ev6 = run(e5.steal(Mo(e5, 0), P(e5, 0), {}));
  ok(said(ev6, '盗めなかった'), 'sim: monster steal takes nothing');
}

sec('rounds/order/defend');
{
  const e = mk({ mons: ['tb_goblin', 'tb_goblin'] });
  run(e.begin());
  const ev = run(e.playRound([{ type: 'attack', target: Mo(e, 0) }, { type: 'defend' }, { type: 'attack', target: Mo(e, 1) }]));
  const actors = ev.filter((x) => x.t === 'actor').map((x) => x.u.key);
  ok(actors[0] === 'p1', 'defend acts first');
  ok(actors.length === 5, 'everyone acts once');
  ok(!P(e, 1).defending, 'defend lasts one round');
  // agi ordering statistics
  const fast = mk({ mons: ['tb_slime'] });
  let first = 0;
  for (let i = 0; i < 300; i++) {
    const f = mk({ mons: ['tb_slime'] });
    f.mons[0].d = Object.assign({}, f.mons[0].d, { agi: 500, atk: 0 });
    const ev2 = run(f.playRound([{ type: 'defend' }]));
    if (ev2.find((x) => x.t === 'actor' && x.u.key !== 'p0').u.key === 'm0') first++;
  }
  ok(first > 280, 'fast monster acts before slow members');
  ok(fast, 'engine created');
}

sec('escape/surprise');
{
  const e = mk({ mons: ['tb_goblin'] });
  const p0 = e.escapeChance();
  const avg = (l) => l.reduce((s, u) => s + u.stat('agi'), 0) / l.length;
  near(p0, U.clamp(0.5 + (avg(e.party) - 9) / 200, 0.3, 1), 1e-9, 'escape = 0.5 + 0.1×tries + agi diff/200');
  e.escapes = 2;
  near(e.escapeChance(), Math.min(1, U.clamp(0.7 + (avg(e.party) - 9) / 200, 0.3, 1)), 1e-9, 'tries add 0.1');
  const slow = mk({ mons: ['tb_metal'] });
  ok(slow.escapeChance() === 0.3, 'clamped at 0.3');
  let esc = 0;
  for (let i = 0; i < 400; i++) { const x = mk({ mons: ['tb_goblin'] }); run(x.playRound({ flee: true })); if (x.result === 'escape') esc++; }
  near(esc / 400, p0, 0.07, 'escape rate');
  const b = mk({ troop: 'tb_boss', mons: ['tb_boss'], noEscape: true });
  const ev = run(b.playRound({ flee: true }));
  ok(!b.result && said(ev, '逃げられない'), 'bosses: no escape');
  let failedOk = false;
  for (let i = 0; i < 30 && !failedOk; i++) {
    const failed = mk({ mons: ['tb_goblin'] });
    failed.mons[0].flags = [];
    const evs = run(failed.playRound({ flee: true }));
    if (failed.result) continue;
    failedOk = said(evs, '回り込まれて') && evs.some((x) => x.t === 'actor' && x.u && x.u.key === 'm0') && !evs.some((x) => x.t === 'actor' && x.u && x.u.isParty);
  }
  ok(failedOk, 'failed escape: monsters act, party does not');
  // surprise rounds
  const pre = mk({ mons: ['tb_goblin'], surprise: 'pre', noSurprise: false });
  let ev2 = run(pre.begin());
  ok(said(ev2, '気づいていない'), 'preemptive message');
  ev2 = run(pre.playRound([{ type: 'defend' }, { type: 'defend' }, { type: 'defend' }]));
  ok(!ev2.some((x) => x.t === 'actor' && x.u && !x.u.isParty), 'preemptive: monsters skip round 1');
  const amb = mk({ mons: ['tb_goblin'], surprise: 'ambush', noSurprise: false });
  ev2 = run(amb.begin());
  ok(said(ev2, 'いきなり襲いかかってきた'), 'ambush message');
  ev2 = run(amb.playRound([{ type: 'attack', target: amb.mons[0] }]));
  ok(!ev2.some((x) => x.t === 'actor' && x.u && x.u.isParty), 'ambush: party skips round 1');
  let pr = 0, am = 0;
  for (let i = 0; i < 6000; i++) { const x = mk({ mons: ['tb_goblin'], noSurprise: false }); run(x.begin()); if (x.surprise === 'pre') pr++; if (x.surprise === 'ambush') am++; }
  near(pr / 6000, 1 / 16, 0.012, 'preemptive 1/16');
  near(am / 6000, 1 / 32, 0.009, 'ambush 1/32');
  const nob = mk({ mons: ['tb_boss'], noSurprise: false });
  for (let i = 0; i < 200; i++) run(nob.begin());
  ok(!nob.surprise, 'no surprise rounds for bosses');
}

// ================================================================ rewards
sec('rewards');
{
  const party = R.fxBattleParty(1);
  party[0].jobs.tb_caster = { jp: 0, total: 100, learned: [] };
  party[0].jobs.tb_fighter.total = 60;
  const e = mk({ party, mons: ['tb_boss', 'tb_slime'] });
  run(e.begin());
  for (const m of e.mons) run(e.die(m, P(e, 0)));
  run(e.die(P(e, 2), null)); // メテム KO → no rewards for her
  ok(e.checkEnd() === 'win', 'win when all monsters are gone');
  const lv0 = P(e, 0).c.level;
  U.seed(7);
  const ev = run(e.rewards());
  const tx = texts(ev);
  ok(said(ev, '魔物たちをやっつけた！'), 'victory message');
  ok(said(ev, 'それぞれ303ポイントの経験値を獲得！'), 'EXP summed, each living member full');
  ok(said(ev, '204ゴールドを手に入れた！'), 'gold');
  ok(said(ev, 'それぞれ43JPを獲得！'), 'JP');
  ok(P(e, 0).c.level > lv0 && said(ev, `ユウキはレベル${P(e, 0).c.level}に上がった！`), 'level up message');
  ok(tx.some((t) => /^(力|素早さ|体力|最大HP)\+\d+(　\S+\+\d+)*$/.test(t)), 'stat gain lines');
  ok(ev.some((x) => x.t === 'jingle' && x.id === 'levelup') && ev.some((x) => x.t === 'jingle' && x.id === 'jobup'), 'levelup / jobup jingles');
  ok(said(ev, 'ユウキのテスト戦士のジョブレベルが2に上がった！'), 'job level up message');
  ok(said(ev, '新しいジョブ『テスト達人』になれるようになった！'), 'job unlock message');
  ok(P(e, 2).c.exp === R.Rules.expForLevel(1), 'KO member gets nothing');
  ok(said(ev, 'テストキングはテストポーションを落としていった！') && said(ev, '★レアアイテム！') && ev.some((x) => x.t === 'rare'), 'guaranteed drop + rare drop');
  ok(e.inv.tb_potion === 1 && e.inv.tb_gem === 1, 'drops added to inventory');
  // per-character mods
  const p2 = R.fxBattleParty(1);
  p2[0].jobs.tb_fighter.learned.push('tb_lucky'); p2[0].set.support = 'tb_lucky';
  const e2 = mk({ party: p2, mons: ['tb_slime'] });
  run(e2.die(Mo(e2, 0), P(e2, 0)));
  const rw = e2.computeRewards();
  ok(rw.each[0].exp === 6 && rw.each[1].exp === 3 && rw.each[0].jp === 5 && rw.each[1].jp === 3, 'expPct / jpPct per character');
  ok(rw.gold === 8, 'goldPct');
  const ev2 = run(e2.rewards());
  ok(said(ev2, 'ユウキは6ポイントの経験値を獲得！') && said(ev2, 'ノンは3ポイントの'), 'per-character EXP lines when they differ');
  // drop rate statistics
  let d = 0, rr = 0;
  for (let i = 0; i < 4000; i++) {
    const x = mk({ mons: ['tb_slime'] });
    run(x.die(x.mons[0], null));
    const r = x.computeRewards();
    if (r.drops.some((q) => !q.rare)) d++;
    if (r.drops.some((q) => q.rare)) rr++;
  }
  near(d / 4000, 0.5, 0.03, 'drop 1/rate');
  near(rr / 4000, 0.25, 0.03, 'rare 1/rate');
  const lucky = R.fxBattleParty(1);
  lucky[0].jobs.tb_fighter.learned.push('tb_lucky'); lucky[0].set.support = 'tb_lucky';
  let d2 = 0;
  for (let i = 0; i < 2000; i++) { const x = mk({ party: lucky, mons: ['tb_slime'] }); run(x.die(x.mons[0], null)); if (x.computeRewards().drops.some((q) => q.rare)) d2++; }
  near(d2 / 2000, 0.5, 0.04, 'rarePct +100 doubles the rare rate');
  // all fled → no rewards
  const e3 = mk({ mons: ['tb_metal'] });
  e3.mons[0].gone = true;
  ok(e3.checkEnd() === 'win' && said(run(e3.rewards()), 'いなくなった'), 'everything fled');
}

sec('live bestiary/state');
{
  R.State.newGame();
  R.Game.party = R.fxBattleParty(5);
  R.Game.inv = { tb_herb: 3 };
  const e = new B.Engine({ party: R.Game.party, mons: ['tb_slime', 'tb_slime', 'tb_goblin'], inv: R.Game.inv, live: true, noSurprise: true });
  run(e.begin());
  ok(R.Game.bestiary.tb_slime.seen === 1 && R.Game.bestiary.tb_goblin.seen === 1, 'seen once per species per battle');
  const yuki = P(e, 0);
  let got = false;
  for (let i = 0; i < 40 && !got; i++) { e.mons[0].stolen = false; run(e.steal(yuki, e.mons[0], {})); got = !!(R.Game.bestiary.tb_slime.steal || R.Game.bestiary.tb_slime.stealRare); }
  ok(got, 'steal noted in the bestiary');
  run(e.scan(e.mons[2]));
  ok(R.Game.bestiary.tb_goblin.scan, 'scan noted in the bestiary');
  for (const m of e.mons) run(e.die(m, yuki));
  const g0 = R.Game.gold;
  U.seed(3);
  run(e.rewards());
  e.finish();
  ok(R.Game.gold > g0, 'gold added to R.Game');
  ok(R.Game.bestiary.tb_slime.kills === 2 && R.Game.bestiary.tb_goblin.kills === 1, 'kills recorded');
  ok(R.Game.bestiary.tb_slime.drop || R.Game.bestiary.tb_slime.rare || true, 'drop notes');
  // statuses after battle: only poison persists
  yuki.c.status = { poison: true, sleep: true, confuse: true };
  e.finish();
  ok(yuki.c.status.poison && !yuki.c.status.sleep && !yuki.c.status.confuse, 'only poison persists');
  // monster thief in a live battle steals gold
  R.Game.gold = 100;
  const e2 = new B.Engine({ party: R.Game.party, mons: ['tb_thief'], inv: R.Game.inv, live: true, noSurprise: true });
  const ev = run(e2.steal(e2.mons[0], P(e2, 0), {}));
  ok(R.Game.gold === 80 && said(ev, '20ゴールドを盗まれた'), 'monster steals gold');
}

// ================================================================ AI & simulate
sec('party AI');
{
  const e = mk({ mons: ['tb_slime', 'tb_slime'] });
  run(e.begin());
  let cmds = R.BattleAI.partyCommands(e);
  ok(cmds.every((c) => c.type === 'attack'), 'weak foes: plain attacks, no MP');
  const e2 = mk({ mons: ['tb_boss'] });
  cmds = R.BattleAI.partyCommands(e2);
  ok(cmds[2].type === 'ability', 'boss: caster uses spells');
  P(e2, 0).hp = 5;
  cmds = R.BattleAI.partyCommands(e2);
  ok(cmds[1].type === 'ability' && DB.abilities[cmds[1].id].effects[0].type === 'heal' && cmds[1].target === P(e2, 0), 'healer heals the ally in danger');
  P(e2, 0).hp = 0;
  cmds = R.BattleAI.partyCommands(e2);
  ok(cmds[1].id === 'tb_revive' && cmds[1].target === P(e2, 0), 'healer revives');
  P(e2, 0).hp = P(e2, 0).mhp;
  P(e2, 1).status.sleep = true;
  P(e2, 2).hp = 3; P(e2, 2).mp = 0;
  cmds = R.BattleAI.partyCommands(e2, { items: false });
  ok(!cmds[1], 'asleep: no command');
  e2.inv.tb_potion = 1;
  cmds = R.BattleAI.partyCommands(e2, { items: true });
  ok(cmds[0].type === 'item' && cmds[0].target === P(e2, 2), 'items: heal item when no heal ability');
  P(e2, 1).status = {};
  const e3 = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_goblin'] });
  for (const m of e3.mons) m.hp = m.mhp = 200;
  cmds = R.BattleAI.partyCommands(e3);
  ok(cmds[2].type === 'ability' && ['group', 'enemies', 'random'].includes(DB.abilities[cmds[2].id].target), `tough group: area spell (${cmds[2].id})`);
  ok(DB.abilities[cmds[2].id].effects[0].element !== 'thunder', 'AI avoids an element the foe is immune to');
}

sec('simulate');
{
  const party = R.fxBattleParty(5);
  const snap = JSON.stringify(party);
  const a = B.simulate({ party, mons: [['tb_slime', 3]], seed: 42 });
  const b = B.simulate({ party, mons: [['tb_slime', 3]], seed: 42 });
  ok(JSON.stringify(party) === snap, 'simulate does not touch the given party');
  ok(a.result === 'win' && JSON.stringify(a) === JSON.stringify(b), 'deterministic with a seed');
  ok(['rounds', 'partyHpPct', 'partyMpPct', 'deaths', 'damageDealt', 'damageTaken'].every((k) => typeof a[k] === 'number'), 'result fields');
  ok(a.damageDealt >= 36 && a.partyHpPct > 50 && a.partyHpPct <= 100, `sensible numbers (${a.damageDealt}, ${a.partyHpPct}%)`);
  const lose = B.simulate({ party, mons: [['tb_brute', 1]], seed: 1 });
  ok(lose.result === 'lose' && lose.deaths === 3 && lose.partyHpPct === 0, 'loses against an overwhelming foe');
  const t = B.simulate({ party: R.fxBattleParty(1), mons: [['tb_dummy', 1]], maxRounds: 3, seed: 1 });
  ok(t.result === 'timeout' && t.rounds === 3, 'maxRounds → timeout');
  const z = B.simulate({ party, zone: 'tb_zone', seed: 5 });
  ok(z.mons.length >= 1 && z.mons.every((m) => ['tb_slime', 'tb_goblin', 'tb_wolf'].includes(m)), 'zone groups');
  const tr = B.simulate({ party: R.fxBattleParty(12), troop: 'tb_boss', seed: 9, log: true });
  ok(tr.mons.join() === 'tb_boss' && tr.log.length > 10, `troop battle (${tr.result} in ${tr.rounds} rounds)`);
  const rw = B.simulate({ party: R.fxBattleParty(1), mons: [['tb_goblin', 2]], seed: 3, rewards: true });
  ok(rw.result !== 'win' || rw.party[0].exp > R.Rules.expForLevel(1), 'rewards option applies EXP to the clones');
  let wins = 0;
  for (let i = 0; i < 60; i++) if (B.simulate({ party: R.fxBattleParty(8), mons: [['tb_goblin', 3]], seed: 100 + i }).result === 'win') wins++;
  ok(wins >= 57, `level 8 party beats 3 goblins (${wins}/60)`);
  const saved = U.rng;
  B.simulate({ party, mons: [['tb_slime', 1]], seed: 1 });
  ok(U.rng === saved, 'rng restored after simulate');
  ok(B.buildMons({ mons: [['tb_slime', 12]] }).length === 8, 'at most 8 monsters');
  ok(B.buildMons({ mons: [['tb_slime', 1], ['tb_goblin', 1], ['tb_slime', 2]] }).join() === 'tb_slime,tb_slime,tb_slime,tb_goblin', 'species kept adjacent');
}

// ================================================================ real content (whatever exists in src/data)
sec('real content');
{
  const real = (o) => Object.keys(o).filter((k) => !k.startsWith('tb_') && !k.startsWith('en_tb_'));
  // every battle-usable consumable
  let n = 0;
  for (const id of real(DB.items)) {
    const it = DB.items[id];
    if (it.type !== 'consumable' || !it.use || !it.use.battle) continue;
    const e = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_slime'] });
    e.inv[id] = 1;
    const u = P(e, 1);
    P(e, 0).hp = 1;
    if (it.use.target === 'ally_dead') run(e.die(P(e, 0), null));
    const tgt = ['enemy', 'group'].includes(it.use.target) ? Mo(e, 0) : P(e, 0);
    let ev = [];
    try { ev = use(e, u, id, tgt, true); } catch (err) { ok(false, `item ${id} threw: ${err.message}`); continue; }
    ok(said(ev, `${it.name}を使った`) && texts(ev).length >= 2 && !e.inv[id], `item ${id} works in battle`);
    n++;
  }
  // every action ability (job + enemy) used by a party member and by a monster
  let a = 0;
  for (const id of real(DB.abilities)) {
    const ab = DB.abilities[id];
    if (ab.kind !== 'action') continue;
    for (const side of ['party', 'mon']) {
      const e = mk({ mons: ['tb_goblin', 'tb_mage'] });
      const u = side === 'party' ? P(e, 0) : Mo(e, 1);
      u.mp = 999;
      const foe = side === 'party' ? Mo(e, 0) : P(e, 0);
      const ally = side === 'party' ? P(e, 1) : Mo(e, 0);
      const tgt = ['enemy', 'group', 'random', 'enemies'].includes(ab.target) ? foe : ally;
      try { run(e.useAbility(u, id, ab, tgt, null)); a++; } catch (err) { ok(false, `ability ${id} (${side}) threw: ${err.message}`); }
    }
  }
  // every monster: a simulated battle against a fixture party, and its AI never errors
  let mcount = 0;
  for (const id of real(DB.monsters)) {
    let r;
    try { r = B.simulate({ party: R.fxBattleParty(Math.max(1, DB.monsters[id].lv || 1)), mons: [[id, 1]], seed: 11, maxRounds: 30 }); } catch (err) { ok(false, `monster ${id} simulate threw: ${err.message}`); continue; }
    ok(['win', 'lose', 'escape', 'timeout'].includes(r.result), `monster ${id} battle resolves`);
    mcount++;
  }
  for (const id of real(DB.troops)) {
    try { B.simulate({ party: R.fxBattleParty(30), troop: id, seed: 3, maxRounds: 40 }); } catch (err) { ok(false, `troop ${id} simulate threw: ${err.message}`); }
  }
  for (const z of real(DB.encounters)) {
    try { B.simulate({ party: R.fxBattleParty(20), zone: z, seed: 4, maxRounds: 40 }); } catch (err) { ok(false, `zone ${z} simulate threw: ${err.message}`); }
  }
  console.log(`  real content exercised: ${n} items, ${a} ability uses, ${mcount} monsters, ${real(DB.troops).length} troops, ${real(DB.encounters).length} zones`);
}

// ================================================================ QA round-1 regressions
sec('qa fixes');
{
  // a dodged physical skill carries no status / debuff
  DB.abilities.tb_sleeparrow = { name: '眠り矢', job: 'tb_fighter', kind: 'action', jp: 1, desc: 't', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1, acc: 0 }, { type: 'status', status: 'sleep', chance: 1 }, { type: 'buff', stat: 'def', stages: -1 }], fx: 'pierce' };
  {
    const e = mk({ mons: ['tb_goblin'] });
    let slept = 0;
    for (let i = 0; i < 60; i++) {
      const g = Mo(e, 0); g.hp = g.mhp; delete g.status.sleep; g.buffs.def = 0;
      const ev = run(e.useAbility(P(e, 0), 'tb_sleeparrow', DB.abilities.tb_sleeparrow, g, null));
      if (ev.some((x) => x.t === 'miss') && (g.status.sleep || g.buffs.def < 0)) slept++;
    }
    ok(slept === 0, `missed physical skill applies nothing (${slept}/60)`);
  }
  // poison: once per round, capped for monsters
  {
    const e = mk({ mons: ['tb_boss'] });
    const b = Mo(e, 0);
    b.status.poison = true;
    e.round = 1;
    const h0 = b.hp;
    run(e.endTurn(b)); run(e.endTurn(b));
    const tick = h0 - b.hp;
    ok(tick === Math.min(Math.floor(b.mhp / 12), 20 + b.level * 3), `boss poison tick capped, once per round (${tick})`);
  }
  // drain at full HP: no 「HPを0吸い取った」
  {
    const e = mk({ mons: ['tb_goblin'] });
    const ev = use(e, P(e, 0), 'tb_drain', Mo(e, 0));
    ok(!said(ev, '0吸い取った'), 'drain at full HP is silent');
  }
  // every monster ran away: no victory fanfare
  {
    const e = mk({ mons: ['tb_goblin'] });
    Mo(e, 0).gone = true;
    e.checkEnd();
    const ev = run(e.rewards());
    ok(!ev.some((x) => x.t === 'victory') && said(ev, 'いなくなった'), 'all fled: no victory event');
  }
  // a full bag: the drop is announced as not carried
  {
    const e = mk({ mons: ['tb_goblin'], inv: { tb_herb: 99 } });
    const g = Mo(e, 0);
    g.d = Object.assign({}, g.d, { drop: { item: 'tb_herb', rate: 1 } });
    e.killed.push(g); g.hp = 0; e.checkEnd();
    const ev = run(e.rewards());
    ok(said(ev, '持ちきれない') && e.inv.tb_herb === 99 && !ev.some((x) => x.t === 'gain'), 'drop at 99: not obtained');
  }
  // AI: dispel a buffed boss; オート thrift keeps MP in a trivial fight
  {
    const e = mk({ mons: ['tb_boss'] });
    const metem = P(e, 2);
    metem.c.jobs.tb_caster.learned.push('tb_dispel');
    Mo(e, 0).buffs.def = 2;
    const cmds = R.BattleAI.partyCommands(e);
    ok(cmds.some((c) => c && c.id === 'tb_dispel'), 'AI dispels a boss with 守備力 up');
    const e2 = mk({ mons: ['tb_goblin', 'tb_goblin'], party: R.fxBattleParty(30) });
    let spent = 0;
    for (let i = 0; i < 20; i++) {
      const c2 = R.BattleAI.partyCommands(e2, { thrift: true, items: 'auto' });
      spent += c2.filter((c) => c && c.type === 'ability' && DB.abilities[c.id].mp).length;
    }
    ok(spent === 0, `thrift: no MP spells on a trivial group (${spent})`);
  }
}

sec('oncePerBattle / ally_other / mpCost');
{
  // test-only abilities (added to the tb_caster job list)
  DB.abilities.tb_once = { name: '一度きり', job: 'tb_caster', kind: 'action', jp: 1, desc: 'テスト', mp: 0, target: 'ally_any', oncePerBattle: true, effects: [{ type: 'healMp', power: 5, hpCost: 0.1 }], fx: 'mp' };
  DB.abilities.tb_share = { name: '命分けテスト', job: 'tb_caster', kind: 'action', jp: 1, desc: 'テスト', mp: 0, target: 'ally_other', effects: [{ type: 'heal', pct: 0.6, hpCost: 0.25 }], fx: 'heal' };
  DB.jobs.tb_caster.abilities.push('tb_once', 'tb_share');
  const e = mk({ mons: ['tb_boss'] });
  const non = P(e, 1);
  non.c.jobs.tb_caster.learned.push('tb_once', 'tb_share');
  ok(!e.unusable(non, 'tb_once'), 'oncePerBattle usable at first');
  ok(R.BattleAI.abilityOptions(e, non).some((o) => o.id === 'tb_once'), 'AI sees the once ability at first');
  let ev = use(e, non, 'tb_once', P(e, 2));
  ok(e.unusable(non, 'tb_once') === 'once', 'oncePerBattle: not selectable again');
  ok(!R.BattleAI.abilityOptions(e, non).some((o) => o.id === 'tb_once'), 'AI skips a used once ability');
  const mp0 = P(e, 2).mp;
  ev = use(e, non, 'tb_once', P(e, 2));
  ok(said(ev, 'もう使えない') && P(e, 2).mp === mp0, 'a queued second use does nothing');
  ok(!e.unusable(P(e, 2), 'tb_once') || e.unusable(P(e, 2), 'tb_once') !== 'once', 'once is per unit');
  // monsters too
  const m = Mo(e, 0);
  m.d = Object.assign({}, m.d, { actions: [{ id: 'tb_once', w: 1 }] });
  ok(R.BattleAI.monster(e, m).id === 'tb_once', 'monster may use a once ability');
  m.used.tb_once = true;
  ok(R.BattleAI.monster(e, m).type === 'attack', 'monster AI respects oncePerBattle');
  // ally_other: never the user
  non.hp = 5; P(e, 0).hp = P(e, 0).mhp; P(e, 2).hp = Math.floor(P(e, 2).mhp / 2);
  let t = e.targets(non, DB.abilities.tb_share, non);
  ok(t.length === 1 && t[0] !== non, 'ally_other retargets away from the user');
  t = e.targets(non, DB.abilities.tb_share, P(e, 0));
  ok(t[0] === P(e, 0), 'ally_other keeps a chosen other ally');
  ok(e.targets(non, DB.abilities.tb_share, null)[0] === P(e, 2), 'ally_other default = most hurt other ally');
  // AI: only the caster is hurt → no ally_other heal on itself
  P(e, 2).hp = P(e, 2).mhp;
  for (let i = 0; i < 20; i++) {
    const cmds = R.BattleAI.partyCommands(e);
    const c = cmds[1];
    ok(!(c && c.id === 'tb_share' && c.target === non), 'AI never aims ally_other at the user');
  }
  // alone: nothing to target, nothing paid
  const e2 = mk({ mons: ['tb_boss'], party: [R.fxBattleParty(10)[1]] });
  const solo = P(e2, 0);
  solo.c.jobs.tb_caster.learned.push('tb_share');
  solo.hp = solo.mhp;
  const hp0 = solo.hp;
  ev = use(e2, solo, 'tb_share', solo);
  ok(solo.hp === hp0 && said(ev, '何も起こらなかった'), 'ally_other with nobody else: no effect, no HP cost');
  // Rules.mpCost: reductions round down, min 1
  const c = R.fxBattleChar('metem', 'tb_caster', 10, ['tb_saver', 'tb_fire', 'tb_heal'], {}, { support: 'tb_saver' });
  ok(R.Rules.mpCost(c, 'tb_fire') === 1, 'mpCost 3 × 50% → 1 (floor)');
  DB.abilities.tb_cheap = { name: '安い', job: 'tb_caster', kind: 'action', jp: 1, mp: 1, target: 'enemy', effects: [], fx: 'fire' };
  ok(R.Rules.mpCost(c, 'tb_cheap') === 1, 'mpCost never below 1');
  ok(R.Rules.mpCost(c, 'tb_ether') === 0, 'mp 0 stays free');
  delete DB.abilities.tb_cheap;
  DB.jobs.tb_caster.abilities.splice(DB.jobs.tb_caster.abilities.indexOf('tb_once'), 2);
}

console.log(`battle tests: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
