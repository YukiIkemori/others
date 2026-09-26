#!/usr/bin/env node
// Battle engine tests (node, no DOM) for A2: R.Mon (curves, tier scaling, golden, drops, heal), every damage formula,
// statuses, buffs, rows and reach, techs / spells / WP / MP, counters and cover, supports (mods), monster AI conds,
// rounds, escape and preempt, rewards (EXP falloff, reserve 60 %, drops, pools), golden / rare / metal / summon /
// boss phases, the glimmer hook, リピート R1–R6, live bookkeeping, the party AI (focus fire, thrift, glimmer aiming),
// simulate(), and a run of every real action / monster / troop / zone in src/data.
//   node tools/test_battle.js            (exit 1 on failure)
// Uses the 'tb_' fixtures of tools/fixtures/battle/data.js (rules_shim.js only steps in when rules.js lacks the API).
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FX = path.join(ROOT, 'tools', 'fixtures', 'battle');
const R = require('./lib/load')({ quiet: true, extra: [path.join(FX, 'rules_shim.js'), path.join(FX, 'data.js')] });
if (R._nodeLoadErrors.length) console.log(`  (note: ${R._nodeLoadErrors.length} source file(s) failed to load — other owners' files; testing with the rest)`);
R.warn = () => {};
const { U, DB } = R;
const B = R.Battle;
const AI = R.BattleAI;

let passes = 0, fails = 0, section = '';
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log(`  FAIL [${section}] ${msg}`); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, `${msg} (got ${typeof a === 'number' ? a.toFixed(4) : a}, want ${typeof b === 'number' ? b.toFixed(4) : b} ±${tol})`); }
function sec(n) { section = n; }
function guard(name, fn) { try { fn(); } catch (e) { fails++; console.log(`  FAIL [${section}] ${name} threw: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); } }

// ------------------------------------------------------------ helpers
const BASE = { mons: ['tb_dummy'], live: false, noSurprise: true, lv: 10, tier: 2, glimTier: 2 };
function mk(o) { return new B.Engine(Object.assign({ party: R.fxBattleParty(10), inv: {} }, BASE, o || {})); }
function run(gen) { const out = []; for (const ev of gen) out.push(ev); return out; }
const texts = (evs) => evs.filter((e) => e.t === 'msg').map((e) => e.text);
const said = (evs, re) => texts(evs).some((t) => (re instanceof RegExp ? re.test(t) : t.includes(re)));
const count = (evs, t, pred) => evs.filter((e) => e.t === t && (!pred || pred(e))).length;
function mean(fn, n) { let s = 0; for (let i = 0; i < n; i++) s += fn(i); return s / n; }
const P = (e, i) => e.party[i];
const Mo = (e, i) => e.mons[i];
/** use an action (tech / spell / enemy action) or, with item: true, a consumable */
function use(e, u, id, target, o) {
  o = o || {};
  if (o.item) return run(e.useAction(u, id, DB.items[id].use, target, { item: DB.items[id] }));
  return run(e.useAction(u, id, DB.actions[id], target, o));
}
/** override a monster's numbers on its own copy of the definition */
function withD(u, o) { u.ownDef(); Object.assign(u.d, o); return u; }
function equip(u, slot, id) { u.c.equip[slot] = id; u.refresh(); }
const PHYS = (o) => Object.assign({ type: 'damage', formula: 'phys', power: 1 }, o || {});
const SURE = (o) => PHYS(Object.assign({ sure: true, critBonus: -100 }, o || {}));
/** R.Glimmer.roll replaced for the duration of fn (null = never glimmers) */
function withGlimmer(roll, fn) {
  const G = R.Glimmer, saved = G && G.roll;
  if (G) G.roll = roll || (() => null);
  try { return fn(); } finally { if (G) G.roll = saved; }
}
const quiet = (fn) => withGlimmer(null, fn);
function meanRoll(e, a, t, eff, ctx, n) { return mean(() => e.roll(a, t, eff, ctx || {}).dmg, n || 3000); }

U.seed(20260925);

// ================================================================ constants
sec('constants');
guard('constants', () => {
  ok(JSON.stringify([-2, -1, 0, 1, 2].map(B.stageMult)) === JSON.stringify([0.63, 0.77, 1, 1.3, 1.6]), 'STAGE = [0.63, 0.77, 1, 1.3, 1.6]');
  ok(B.stageMult(5) === 1.6 && B.stageMult(-9) === 0.63, 'stages clamp to ±2');
  const e = mk();
  ok(e.dk === 90 && e.lv === 10 && e.tier === 2, 'DK(Lb) = 40 + 5 Lb (Lb 10 → 90)');
  ok(B.K('ROW').middleTaken === 0.7 && B.K('ROW').weight.front === 2 && B.K('ROW').weight.middle === 1, 'row constants (0.7, 2 : 1)');
  ok(B.K('RESERVE_RATE') === 0.6 && B.K('DEFEND') === 0.5, 'reserve 60 %, defend × 0.5');
  ok(typeof B.reasonText('wp') === 'string' && B.reasonText('reach') === '後列からは届かない。', 'reason texts');
});

// ================================================================ R.Mon
sec('R.Mon');
guard('R.Mon', () => {
  const M = R.Mon;
  const r = Math.round;
  const c6 = M.curve(6), c30 = M.curve(30);
  ok([r(c6.hp), r(c6.atk), r(c6.def), r(c6.agi), r(c6.exp), r(c6.gold)].join() === '26,17,35,28,12,8', 'curve(6) = the §4.14.2 table (hp × MON_HP_PROF, Part A13)');
  ok([r(c30.hp), r(c30.atk), r(c30.def), r(c30.agi), r(c30.exp), r(c30.gold)].join() === '195,69,95,42,93,80', 'curve(30) = the §4.14.2 table (hp × MON_HP_PROF, Part A13)');
  // the boss-balance pass (A12.5) moved the curve into R.Rules.K.hpBoss; R.Mon.hpBoss must follow it, else the §4.14.3 default
  const kHp = R.Rules && R.Rules.K && typeof R.Rules.K.hpBoss === 'function' ? R.Rules.K.hpBoss : null;
  if (kHp) near(M.hpBoss(18), kHp(18), 1e-9, 'hpBoss(L) follows R.Rules.K.hpBoss');
  else near(M.hpBoss(18), M.curve(18).hp * (0.65 + 0.05 * 2), 1e-9, 'hpBoss(L) = hp(L) × (0.65 + 0.05 clamp((L−6)/6, 0, 10))');
  // fillStats: mob (size s, MOB 0.6), rare (no MOB, ×5 rewards), metal (fixed HP, ×30 EXP), boss (region row), お供 (master's row)
  const c7 = M.curve(7);
  const rat = M.fillStats({ lv: 7, size: 's', s: { hp: 0.9, agi: 1.2 }, flags: [] });
  ok(rat.hp === r(c7.hp * 0.7 * 0.9) && rat.atk === r(c7.atk * 0.9 * 0.6) && rat.def === r(c7.def * 0.9) && rat.agi === r(c7.agi * 1.2) && rat.exp === r(c7.exp * 0.7) && rat.eva === 5 && rat.hit === 95,
    'mob stats = curve × size × s × K.MOB');
  const fast = M.fillStats({ lv: 7, s: { agi: 1.4 }, flags: ['flying'] });
  ok(fast.eva === 15, 'fast species eva 15 (flying 12 → the larger)');
  const c10 = M.curve(10);
  const rare = DB.monsters.tb_rare;
  ok(rare.hp === r(c10.hp * 3) && rare.atk === r(c10.atk) && rare.exp === r(c10.exp * 5) && rare.fleeRate === 0.25 && rare.fleeFrom === 2 && rare.eva === 15, 'rare: no MOB cut, EXP × 5, flee 25 % from round 2, eva 15');
  const c19 = M.curve(19);
  const metal = DB.monsters.tb_metal;
  ok(metal.hp === 8 && metal.exp === r(c19.exp * 0.7 * 30) && metal.gold === r(c19.gold * 0.7 * 10) && metal.fleeRate === 0.5 && metal.eva === 30 && metal.agi === r(c19.agi * 2.5), 'metal: fixed HP, EXP × 30, gold × 10, flee 50 %, eva 30, 素早さ × 2.5');
  const noHp = M.fillStats({ lv: 12, flags: ['metal'] });
  ok(noHp.hp >= 6 && noHp.hp <= 12 && noHp.agi === r(M.curve(12).agi * 2.5), 'metal without hpFixed: 6–12, agi × 2.5 by default');
  const c9 = M.curve(9);
  const boss = DB.monsters.tb_boss, BR = M.K('BOSS').region;
  ok(boss.hp === r(M.hpBoss(9) * 12) && boss.atk === r(c9.atk * BR.atk) && boss.actsPerTurn === BR.acts && boss.exp === r(c9.exp * BR.exp) && boss.crit === 3,
    'region boss: hpBoss × hpShare, atk × 1.5, acts 2, EXP × 20, crit 3');
  const minion = DB.monsters.tb_minion;
  ok(minion._master === 'region' && minion.atk === r(c9.atk * BR.atk) && minion.hp === r(M.hpBoss(9) * 2), 'お供 take the master boss row (troop), their own hpShare');
  // def: tier scaling, cache, golden
  const d13 = M.def('tb_rat_1', { Lb: 13 }), base = DB.monsters.tb_rat_1, c13 = M.curve(13);
  const nom = (d, k) => (d._raw && d._raw[k] != null ? d._raw[k] : d[k]); // unrounded nominal value (no double rounding)
  ok(d13.lv === 13 && d13.hp === Math.max(1, r(nom(base, 'hp') * c13.hp / c7.hp)) && d13.atk === r(nom(base, 'atk') * c13.atk / c7.atk) && d13.exp === r(nom(base, 'exp') * c13.exp / c7.exp), 'def(Lb): every stat × curve(Lb)/curve(lv)');
  ok(Math.abs(nom(base, 'hp') - base.hp) <= 0.5 && Math.abs(d13.hp - base.hp * c13.hp / c7.hp) <= Math.max(1, c13.hp / c7.hp), 'def scales from the unrounded nominal value (stays within one rounding step)');
  ok(M.def('tb_rat_1', { Lb: 13 }) === d13 && DB.monsters.tb_rat_1.lv === 7, 'def is cached and never changes DB');
  ok(M.def('tb_rat_1', { tier: 1, lvOff: 1 }).lv === 13, 'def({tier, lvOff}) → Lb = LZ(T) + lvOff');
  ok(M.def('tb_boss', { Lb: 12 }).hp === r(M.hpBoss(12) * 12), 'boss HP scales by the hpBoss curve (hpBoss(Lb) × hpShare, no double rounding)');
  ok(M.def('tb_metal', { Lb: 40 }).hp === 8, 'metal HP never scales');
  const g = M.def('tb_goblin', { golden: true }), gob = DB.monsters.tb_goblin;
  ok(g.golden && g.hp === gob.hp * 2 && g.atk === r(gob.atk * 1.2) && g.exp === gob.exp * 3 && g.gold === gob.gold * 5 && g.lvShow === gob.lv + 2 && g.flags.includes('golden'),
    'golden: HP × 2, stats × 1.2, EXP × 3, gold × 5, Lv shown + 2');
  ok(g.name === '金色のテスト小鬼' && M.goldenName(DB.monsters.tb_rat_1) === '金のテストネズミ', 'golden names: 金色の (≤ 5 chars) / 金の (6+)');
  ok(!M.def('tb_metal', { golden: true }).golden && !M.canBeGolden(DB.monsters.tb_rare) && !M.canBeGolden(DB.monsters.tb_boss), 'metal / rare / boss never golden');
  // resolve / lower / buildList / zone groups
  ok(M.resolve('@tb_rat', 0) === 'tb_rat_1' && M.resolve('@tb_rat', 2) === 'tb_rat_2' && M.resolve('@tb_rat', 3) === 'tb_rat_2' && M.resolve('@tb_rat', 7) === 'tb_rat_3', '@lineage → the last stage started by T');
  ok(M.resolve('lower', 2, 'tb_rat_3') === 'tb_rat_2' && M.resolve('lower', 2, 'tb_rat_1') === 'tb_rat_1' && M.resolve('same', 2, 'tb_bat') === 'tb_bat', "'lower' / 'same'");
  ok(M.resolve('@tb_nope', 3) === null && M.resolve('tb_nope', 3) === null, 'unknown refs → null');
  ok(M.buildList([['tb_slime', 1], ['tb_goblin', 1], ['tb_slime', 2]], 0).join() === 'tb_slime,tb_slime,tb_slime,tb_goblin', 'species kept together');
  ok(M.buildList([['tb_slime', 12]], 0).length === 8, 'at most 8 monsters');
  const rl = M.buildList([['@tb_rat', 2, 3]], 2);
  ok(rl.length >= 2 && rl.length <= 3 && rl.every((x) => x === 'tb_rat_2'), '[ref, min, max]');
  ok(M.zoneGroups('tb_zone', 0).length === 2 && M.zoneGroups('tb_zone', 1).length === 2 && M.zoneGroups('tb_zone', 1).every((x) => x.tierMax == null), 'zone groups filtered by tierMin / tierMax');
  // golden roll
  const N = 40000;
  let gc = 0, gc2 = 0;
  for (let i = 0; i < N; i++) { if (M.rollGolden(['tb_goblin', 'tb_goblin'], { goldenPct: 0 }) >= 0) gc++; if (M.rollGolden(['tb_goblin'], { goldenPct: 100 }) >= 0) gc2++; }
  near(gc / N, 1 / 40, 0.004, 'golden 1/40 per zone battle');
  near(gc2 / N, 1 / 20, 0.005, 'goldenPct +100 → 1/20');
  ok(M.rollGolden(['tb_metal', 'tb_rare'], { goldenPct: 150 }) === -1, 'no golden metal / rare');
  // drops
  const ch = M.dropChances(gob, { mods: {} });
  ok(Math.abs(ch.normal - 1 / 8) < 1e-12 && Math.abs(ch.rare - 1 / 32) < 1e-12 && Math.abs(ch.super - 1 / 256) < 1e-12, 'drop chances 1/rate');
  const chg = M.dropChances(gob, { golden: true, mods: {} });
  ok(Math.abs(chg.normal - 2 / 8) < 1e-12 && Math.abs(chg.rare - 8 / 32) < 1e-12 && Math.abs(chg.super - 8 / 256) < 1e-12, 'golden ×2 / ×8 / ×8');
  const chm = M.dropChances(gob, { mods: { dropPct: 300, rarePct: 150, superPct: 150 } });
  ok(Math.abs(chm.normal - 0.125 * 2.5) < 1e-12 && Math.abs(chm.rare - 2.5 / 32) < 1e-12, 'mods capped at +150');
  const capd = M.dropChances({ drops: { normal: { item: 'tb_salve', rate: 2 }, rare: { item: 'tb_rare_charm', rate: 2 }, super: { item: 'tb_sr_blade', rate: 2 } } }, { golden: true, mods: { dropPct: 150, rarePct: 150, superPct: 150 } });
  ok(capd.normal === 0.75 && capd.rare === 0.5 && capd.super === 0.125, 'caps 0.75 / 0.5 / 0.125');
  const hits = { normal: 0, rare: 0, super: 0 }, n2 = 120000;
  let orderOk = true;
  for (let i = 0; i < n2; i++) {
    const l = M.rollDrops(gob, { mods: {} });
    for (const x of l) hits[x.grade]++;
    if (l.map((x) => x.grade).join() !== l.map((x) => x.grade).sort((a, b) => ['normal', 'rare', 'super'].indexOf(a) - ['normal', 'rare', 'super'].indexOf(b)).join()) orderOk = false;
  }
  ok(Math.abs(hits.normal / n2 / ch.normal - 1) < 0.1 && Math.abs(hits.rare / n2 / ch.rare - 1) < 0.1 && Math.abs(hits.super / n2 / ch.super - 1) < 0.1, `drop rates within ±10 % (${hits.normal}/${hits.rare}/${hits.super})`);
  ok(orderOk, 'drops in the order normal → rare → super');
  const bl = M.rollDrops(boss, { tier: 2 });
  ok(bl.length === 2 && bl[0].slot === 'normal' && bl[1].slot === 'bonus' && bl[1].item === 'tb_seed', 'boss: certain pool drop + bonus, bonus last');
  const pool = DB.pools.tb_pool.tiers;
  const pk = M.pickPool('tb_pool', 1);
  ok(pk && (pk.item === 'tb_pool_b' || pk.gold), 'pool pick by tier');
  const pg = M.pickPool('tb_pool', 9);
  ok(pg && pg.gold === 500 && pool.length === 3, 'pool: the last tier list for higher tiers (gold)');
  ok(M.rollDrops(Object.assign({}, gob, { summoned: true })).length === 0 && M.rollDrops(gob, { summoned: true }).length === 0, 'summoned monsters drop nothing');
  // heal formula
  const e = mk();
  const hero = P(e, 0), mage = P(e, 2);
  ok(M.healAmount(mage, hero, { pct: 0.35 }) === r(hero.mhp * 0.35 * M.mndf(mage.stat('mnd'))), 'spell heal = max HP × pct × MNDF');
  ok(M.healAmount(mage, hero, { pct: 0.35 }, { item: true }) === r(hero.mhp * 0.35), 'item heal = max HP × pct (no MNDF)');
  ok(M.healAmount(Mo(e, 0), hero, { pct: 0.35 }) === r(hero.mhp * 0.35), 'monster heal = max HP × pct');
  near(M.mndf(40), 1, 0.001, 'MNDF(40) = 1.0');
  ok(M.mndf(0) === 128 / 168 && M.mndf(999) === 2.2, 'MNDF clamp');
  const hst = R.Rules.stats(hero.c);
  ok(M.healAmount(hero.c, hero.c, { pct: 0.35 }, { field: true }) === r(hst.hp * 0.35 * M.mndf(hst.mnd)) && B.healAmount(hero.c, hero.c, { pct: 0.35 }) === M.healAmount(hero.c, hero.c, { pct: 0.35 }), 'CharState input (the field menu) uses the same formula');
  ok(M.ef(boss) === 2.5 && M.ef(rare) === 2 && M.ef(g) === 1.5 && M.ef(gob) === 1 && M.ef(metal) === 1, 'EF: boss 2.5 / rare 2 / golden 1.5 / normal & metal 1');
  ok(M.rank(boss, 2) >= 5 && M.rank(gob, 2) === 3 && M.rank(metal, 2) === 4, 'glimmer rank: Tb + 1 (+2 boss, +1 metal)');
});

// ================================================================ formulas
sec('phys');
guard('phys', () => {
  const e = mk({ mons: ['tb_dummy', 'tb_goblin', 'tb_slime', 'tb_bone', 'tb_bat'] });
  const hero = P(e, 0), dummy = Mo(e, 0), gob = Mo(e, 1), slime = Mo(e, 2), bone = Mo(e, 3), bat = Mo(e, 4);
  const W = hero.weapon('weapon1'), A = W.atk;
  ok(A > 20 && W.wtype === 'sword' && W.kind === 'slash', 'party W from R.Rules.stats (atk includes the stat share)');
  ok(dummy.stat('def') === 0 && dummy.stat('eva') === 0, 'dummy: def 0, eva 0');
  let lo = Infinity, hi = -Infinity, sum = 0, n = 0, crits = 0, miss = 0, critOk = true;
  const N = 8000;
  for (let i = 0; i < N; i++) {
    const r = e.roll(hero, dummy, PHYS(), { slot: 'weapon1', attack: true });
    if (r.miss) { miss++; continue; }
    if (r.crit) { crits++; if (r.dmg < A * 1.5 * 0.9 - 1e-9 || r.dmg > A * 1.5 * 1.1 + 1e-9) critOk = false; continue; }
    lo = Math.min(lo, r.dmg); hi = Math.max(hi, r.dmg); sum += r.dmg; n++;
  }
  ok(lo >= A * 0.9 - 1e-9 && hi <= A * 1.1 + 1e-9 && hi - lo > A * 0.15, `A × P × rand(0.90, 1.10) (${lo.toFixed(1)}..${hi.toFixed(1)}, A ${A})`);
  near(sum / n, A, A * 0.01, 'mean = A at def 0');
  ok(critOk, 'crit = A × 1.5 (guard ignored)');
  near(miss / N, 1 - Math.min(100, W.hit) / 100, 0.008, 'hit = clamp(hit × acc − eva, 20, 100) %');
  near(crits / (N - miss), W.crit / 100, 0.012, 'crit rate = W.crit %');
  // guard DK/(DK + def), kind multiplier
  const guardG = 90 / (90 + 45);
  near(meanRoll(e, hero, gob, SURE(), { slot: 'weapon1' }), A * guardG * 1.25, A * 0.012, 'guard DK/(DK+def) × slash 1.25');
  near(meanRoll(e, hero, gob, PHYS({ sure: true, critBonus: 100 }), { slot: 'weapon1' }), A * 1.5 * 1.25, A * 0.02, 'critBonus 100 → always crit, × 1.5 ignoring def');
  near(meanRoll(e, hero, gob, SURE({ power: 1.5, ignoreDef: 0.5 }), { slot: 'weapon1' }), A * 1.5 * (90 / (90 + 22.5)) * 1.25, A * 0.02, 'power × and ignoreDef 0.5');
  near(meanRoll(e, hero, gob, SURE({ ignoreDef: true }), { slot: 'weapon1' }), A * 1.25, A * 0.015, 'ignoreDef true = 1');
  near(meanRoll(e, hero, gob, SURE({ kind: 'blunt' }), { slot: 'weapon1' }), A * guardG, A * 0.012, "the action's kind replaces the weapon's");
  // elements
  equip(hero, 'weapon1', 'tb_flame_sword');
  const Af = hero.weapon('weapon1').atk;
  near(meanRoll(e, hero, gob, SURE(), { slot: 'weapon1' }), Af * guardG * 1.25 * 1.5, Af * 0.02, "weapon element × the monster's elem (fire 1.5)");
  equip(hero, 'weapon1', 'tb_sword');
  const zr = e.roll(hero, gob, SURE({ element: 'water' }), { slot: 'weapon1' });
  ok(zr.zero, 'element multiplier 0 → zero');
  let ev = run(e.hit(hero, gob, zr, { kind: 'phys' }));
  ok(said(ev, 'テスト小鬼には傷ひとつない！') && gob.hp === gob.mhp && count(ev, 'dmg', (x) => x.n === 0) === 1, '0 damage: 「〜には傷ひとつない！」');
  slime.hp = 5;
  ev = run(e.hit(hero, slime, e.roll(hero, slime, SURE({ element: 'wind' }), { slot: 'weapon1' }), { kind: 'phys' }));
  ok(slime.hp > 5 && count(ev, 'heal') === 1 && said(ev, /テストゼリーのHPが\d+回復した！/), 'negative multiplier absorbs (heals)');
  slime.hp = slime.mhp;
  ok(e.elemFactor(hero, gob, ['water', 'fire']).mult === 1.5 && e.elemFactor(hero, gob, ['water', 'fire']).el === 'fire', 'several elements → the best multiplier');
  // vs (race / flag / status), weapon vs
  near(meanRoll(e, hero, bone, SURE({ vs: { undead: 2 } }), { slot: 'weapon1' }) / meanRoll(e, hero, bone, SURE(), { slot: 'weapon1' }), 2, 0.05, 'vs race × 2');
  near(meanRoll(e, hero, bat, SURE({ vs: { flying: 1.5 } }), { slot: 'weapon1' }) / meanRoll(e, hero, bat, SURE(), { slot: 'weapon1' }), 1.5, 0.04, 'vs flag × 1.5');
  equip(hero, 'weapon1', 'tb_katana');
  const Ak = hero.weapon('weapon1').atk;
  near(meanRoll(e, hero, bone, SURE(), { slot: 'weapon1' }), Ak * (90 / 140) * 1.5, Ak * 0.02, "weapon vs (katana: undead × 1.5)");
  equip(hero, 'weapon1', 'tb_sword');
  gob.status.sleep = true;
  near(meanRoll(e, hero, gob, SURE({ vs: { sleep: 2 } }), { slot: 'weapon1' }), A * guardG * 1.25 * 2, A * 0.03, 'vs status (asleep × 2)');
  delete gob.status.sleep;
  // hit chance
  const ev50 = withD(new B.MonUnit('tb_goblin', 9, e), { eva: 50 });
  near(mean(() => (e.roll(hero, ev50, PHYS(), { slot: 'weapon1' }).miss ? 0 : 1), 6000), (W.hit - 50) / 100, 0.02, 'hit − eva');
  hero.status.blind = true;
  near(mean(() => (e.roll(hero, ev50, PHYS(), { slot: 'weapon1' }).miss ? 0 : 1), 6000), (W.hit - 50) / 200, 0.02, 'blind × 0.5');
  delete hero.status.blind;
  near(mean(() => (e.roll(hero, ev50, PHYS({ acc: 0.8 }), { slot: 'weapon1' }).miss ? 0 : 1), 6000), (W.hit * 0.8 - 50) / 100, 0.02, 'acc multiplies hit');
  const ev95 = withD(new B.MonUnit('tb_goblin', 10, e), { eva: 95 });
  near(mean(() => (e.roll(hero, ev95, PHYS(), { slot: 'weapon1' }).miss ? 0 : 1), 6000), 0.2, 0.02, 'hit floor 20 %');
  for (const s of ['sleep', 'paralyze', 'freeze', 'stun']) {
    ev95.status[s] = true;
    ok(mean(() => (e.roll(hero, ev95, PHYS(), { slot: 'weapon1' }).miss ? 0 : 1), 300) === 1, `disabled target (${s}) always hit`);
    delete ev95.status[s];
  }
  ok(mean(() => (e.roll(hero, ev95, PHYS({ sure: true }), { slot: 'weapon1' }).miss ? 0 : 1), 300) === 1, 'sure: always hits');
  const lancer = P(e, 1);
  lancer.status.nimble = true;
  const gm = Mo(e, 1);
  near(mean(() => (e.roll(gm, lancer, PHYS(), {}).miss ? 0 : 1), 6000), (95 - lancer.stat('eva') - 25) / 100, 0.02, 'nimble: target eva + 25');
  delete lancer.status.nimble;
  // rows, stages, mods, defend, taken
  const mage = P(e, 2);
  ok(e.effRow(mage) === 'middle' && e.effRow(P(e, 0)) === 'front', 'effective rows');
  const midD = meanRoll(e, gm, mage, SURE(), {}, 4000);
  P(e, 0).c.hp = 0; P(e, 1).c.hp = 0;
  ok(e.effRow(mage) === 'front', 'nobody alive in front → the middle row counts as front');
  const frontD = meanRoll(e, gm, mage, SURE(), {}, 4000);
  near(midD / frontD, 0.7, 0.02, 'middle row takes × 0.7 physical');
  const mMid = mean(() => e.roll(gm, mage, { type: 'damage', formula: 'magic', power: 1 }, {}).dmg, 3000);
  P(e, 0).c.hp = P(e, 0).mhp; P(e, 1).c.hp = P(e, 1).mhp;
  near(mean(() => e.roll(gm, mage, { type: 'damage', formula: 'magic', power: 1 }, {}).dmg, 3000) / mMid, 1, 0.02, 'no row factor on magic');
  const b0 = meanRoll(e, hero, dummy, SURE(), { slot: 'weapon1' });
  hero.buffs.atk = 2;
  near(meanRoll(e, hero, dummy, SURE(), { slot: 'weapon1' }) / b0, 1.6, 0.03, 'atk +2 → × 1.6');
  hero.buffs.atk = 0; dummy.buffs.def = 1;
  near(meanRoll(e, hero, dummy, SURE(), { slot: 'weapon1' }) / b0, 1 / 1.3, 0.02, 'target def +1 → ÷ 1.3');
  dummy.buffs.def = -2;
  near(meanRoll(e, hero, dummy, SURE(), { slot: 'weapon1' }) / b0, 1 / 0.63, 0.05, 'target def −2 → ÷ 0.63');
  dummy.buffs.def = 0;
  equip(hero, 'acc1', 'tb_boost');
  near(meanRoll(e, hero, dummy, SURE(), { slot: 'weapon1' }) / b0, 1.5, 0.03, 'physPct +50');
  equip(hero, 'acc1', null);
  dummy.defending = true;
  near(meanRoll(e, hero, dummy, SURE(), { slot: 'weapon1' }) / b0, 0.5, 0.015, 'defending × 0.5');
  dummy.defending = false;
  const toHero = meanRoll(e, gm, hero, SURE(), {}, 4000);
  equip(hero, 'acc2', 'tb_cursed');
  near(meanRoll(e, gm, hero, SURE(), {}, 4000) / toHero, 1.25, 0.03, 'takenPct +25 (cursed)');
  equip(hero, 'acc2', null);
  // min 1, cap 9999, messages
  const tank = withD(new B.MonUnit('tb_goblin', 11, e), { def: 99999, hp: 50 });
  tank.hp = tank.mhp = 50;
  ev = run(e.hit(hero, tank, e.roll(hero, tank, SURE(), { slot: 'weapon1' }), { kind: 'phys' }));
  ok(count(ev, 'dmg', (x) => x.n === 1) === 1 && tank.hp === 49, 'at least 1 damage unless a multiplier is 0');
  const big = withD(new B.MonUnit('tb_goblin', 12, e), { hp: 20000 });
  big.hp = big.mhp = 20000;
  ev = run(e.hit(hero, big, { dmg: 123456 }, { kind: 'phys' }));
  ok(count(ev, 'dmg', (x) => x.n === 9999) === 1, 'damage cap 9999');
  gob.hp = gob.mhp;
  ev = run(e.hit(hero, gob, { dmg: 24 }, { kind: 'phys' }));
  ok(said(ev, 'テスト小鬼に24のダメージ！') && gob.hp === gob.mhp - 24, '「〜に24のダメージ！」');
  ev = run(e.hit(hero, gob, { dmg: 3, crit: true }, { kind: 'phys' }));
  ok(said(ev, '会心の手ごたえ！') && count(ev, 'crit') === 1, 'party crit 「会心の手ごたえ！」');
  ev = run(e.hit(gob, hero, { dmg: 3, crit: true }, { kind: 'phys' }));
  ok(said(ev, '強烈な一撃！'), 'monster crit 「強烈な一撃！」');
  ev = run(e.hit(hero, gob, { miss: true, dmg: 0 }, { kind: 'phys' }));
  ok(said(ev, 'テスト小鬼は攻撃をかわした！') && count(ev, 'miss') === 1, 'miss 「〜は攻撃をかわした！」');
  gob.hp = 2;
  ev = run(e.hit(hero, gob, { dmg: 50 }, { kind: 'phys' }));
  ok(!gob.alive && said(ev, 'テスト小鬼は倒れた！') && count(ev, 'die') === 1 && e.killed.includes(gob), 'kill 「〜は倒れた！」');
  // the normal attack end to end
  const e2 = mk({ mons: ['tb_goblin'] });
  ev = run(e2.attack(P(e2, 0), Mo(e2, 0), { slot: 'weapon1' }));
  ok(said(ev, 'アルンの攻撃！') && count(ev, 'fx', (x) => x.kind === 'attack' && x.fx === 'slash') === 1, '「〜の攻撃！」 + weapon fx');
  ok(e2.weaponFx(Mo(e2, 0)) === 'claw' && e2.weaponFx(P(e2, 1), 'weapon1') === 'pierce' && e2.weaponFx(P(e2, 3), 'weapon1') === 'arrow', 'attack fx per weapon type / monster default');
});

sec('metal');
guard('metal', () => {
  const e = mk({ mons: ['tb_metal'] });
  const hero = P(e, 0), mage = P(e, 2), metal = Mo(e, 0);
  ok(metal.metal && metal.hp === 8, 'metal unit, HP 8 at any Lb');
  const set = new Set();
  for (let i = 0; i < 400; i++) set.add(e.roll(hero, metal, SURE(), { slot: 'weapon1' }).dmg);
  ok(set.size === 1 && set.has(1), 'any hit = 1');
  const cs = new Set();
  for (let i = 0; i < 200; i++) cs.add(e.roll(hero, metal, PHYS({ sure: true, critBonus: 100 }), { slot: 'weapon1' }).dmg);
  ok(cs.size === 1 && cs.has(2), 'a crit = 2');
  ok(e.roll(mage, metal, DB.actions.tb_s_fire.effects[0], { act: DB.actions.tb_s_fire, kind: 'spell' }).dmg === 1, 'spells deal 1 too');
  ok(e.roll(hero, metal, SURE({ power: 1.0, metalHit: true }), { slot: 'weapon1' }).dmg === 3 && e.roll(hero, metal, SURE({ power: 1.5, metalHit: true }), { slot: 'weapon1' }).dmg === 5, 'metalHit: ceil(3 × P)');
  equip(hero, 'weapon1', 'tb_metal_whip');
  ok(e.roll(hero, metal, SURE(), { slot: 'weapon1' }).dmg === 3, 'a metalHit weapon: ceil(3 × 1)');
  equip(hero, 'weapon1', 'tb_sword');
  ok(e.roll(mage, metal, { type: 'damage', formula: 'percent', power: 0.5 }, {}).immune, 'percent: no effect');
  let ev = run(e.inflict(mage, metal, 'sleep', 1, { sf: 'int' }));
  ok(!metal.status.sleep && said(ev, 'しかし効き目がなかった。'), 'no status');
  ev = run(e.inflict(mage, metal, 'death', 1, { sf: 'int' }));
  ok(metal.alive, 'no instant death');
  ev = use(e, mage, 'tb_s_break', metal);
  ok(metal.buffs.def === 0 && said(ev, '効き目がなかった'), 'no debuff');
  e.round = 1;
  near(mean(() => (e.monFlees(metal) ? 1 : 0), 6000), 0.5, 0.02, 'runs 50 % at its turn, from round 1');
  ok(e.expectDamage(hero, DB.actions.tb_t_cut, metal) <= 1.0001 && e.expectDamage(hero, DB.actions.tb_t_cut, metal) > 0, 'AI expects ≤ 1 per hit on metal');
});

sec('magic');
guard('magic', () => {
  const e = mk({ mons: ['tb_goblin', 'tb_dummy', 'tb_boss'] });
  const mage = P(e, 2), gob = Mo(e, 0), dummy = Mo(e, 1), boss = Mo(e, 2);
  const M = mage.stat('mag');
  const fire = DB.actions.tb_s_fire;
  const ctx = (a) => ({ act: a, kind: 'spell' });
  near(meanRoll(e, mage, gob, fire.effects[0], ctx(fire)), M * 1.4 * (90 / 135) * 1.5, M * 0.015, 'magic = M × SP × DK/(DK+mdef) × elem × rand(0.95, 1.05)');
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 3000; i++) { const d = e.roll(mage, dummy, fire.effects[0], ctx(fire)).dmg; lo = Math.min(lo, d); hi = Math.max(hi, d); }
  ok(lo >= M * 1.4 * 0.95 - 1e-9 && hi <= M * 1.4 * 1.05 + 1e-9, 'magic rand 0.95..1.05');
  ok(mean(() => (e.roll(mage, gob, fire.effects[0], ctx(fire)).miss ? 1 : 0), 500) === 0, 'spells never miss');
  const water = DB.actions.tb_s_water;
  ok(e.roll(mage, gob, water.effects[0], ctx(water)).zero, 'immune element (water 0) → zero');
  const steam = DB.actions.tb_s_steam;
  near(meanRoll(e, mage, gob, steam.effects[0], ctx(steam)), M * 1.45 * (90 / 135) * 1.5, M * 0.02, 'two elements: the best (fire 1.5 over water 0)');
  equip(mage, 'acc1', 'tb_boost');
  near(meanRoll(e, mage, gob, fire.effects[0], ctx(fire)) / (M * 1.4 * (90 / 135) * 1.5), 1.5 * 1.5, 0.05, 'elemBoost fire +50 and magicPct +50');
  near(meanRoll(e, mage, dummy, water.effects[0], ctx(water)) / (M * 1.2), 1.5, 0.03, 'magicPct only for another element');
  equip(mage, 'acc1', null);
  mage.buffs.mag = 1; gob.buffs.mdef = -1;
  near(meanRoll(e, mage, gob, fire.effects[0], ctx(fire)) / (M * 1.4 * (90 / 135) * 1.5), 1.3 / 0.77, 0.05, 'mag / mdef stages');
  mage.buffs.mag = 0; gob.buffs.mdef = 0;
  const pierce = DB.actions.tb_s_pierce;
  near(meanRoll(e, mage, gob, pierce.effects[0], ctx(pierce)), M * 2.0, M * 0.03, 'ignoreMdef 1');
  gob.defending = true;
  near(meanRoll(e, mage, gob, fire.effects[0], ctx(fire)) / (M * 1.4 * (90 / 135) * 1.5), 0.5, 0.02, 'defend halves magic');
  gob.defending = false;
  // breath / tier / fixed / percent
  const hero = P(e, 0), lancer = P(e, 1), atk = gob.stat('atk');
  const breath = DB.actions.tb_e_breath;
  near(meanRoll(e, gob, lancer, breath.effects[0], { act: breath, kind: 'enemy' }), atk * 0.6, atk * 0.02, 'breath = atk × SP (no def, no row)');
  near(meanRoll(e, gob, P(e, 3), breath.effects[0], { act: breath, kind: 'enemy' }), atk * 0.6, atk * 0.02, 'breath: no middle-row cut');
  equip(hero, 'acc1', 'tb_ring_fire');
  near(meanRoll(e, gob, hero, breath.effects[0], { act: breath, kind: 'enemy' }), atk * 0.6 * 0.5, atk * 0.015, 'breath × elemResist (fire 0.5)');
  equip(hero, 'acc1', null);
  const pot = DB.items.tb_firepot;
  near(meanRoll(e, mage, gob, pot.use.effects[0], { act: pot.use, item: pot, kind: 'item' }), 0.8 * 21 * 1.5, 0.3, 'tier = SP × W(Tb) × elem (Tb 2 → W 21)');
  equip(mage, 'acc1', 'tb_boost');
  near(meanRoll(e, mage, gob, pot.use.effects[0], { act: pot.use, item: pot, kind: 'item' }), 0.8 * 21 * 1.5, 0.3, 'tier damage ignores itemPct / elemBoost');
  equip(mage, 'acc1', null);
  near(meanRoll(e, mage, gob, { type: 'damage', formula: 'fixed', power: 50 }, {}), 50, 0.4, 'fixed = power × rand(0.95, 1.05)');
  gob.hp = 30;
  ok(e.roll(mage, gob, { type: 'damage', formula: 'percent', power: 0.25 }, {}).dmg === 7, 'percent = floor(HP × power)');
  gob.hp = 2;
  ok(e.roll(mage, gob, { type: 'damage', formula: 'percent', power: 0.25 }, {}).dmg === 1, 'percent: at least 1');
  ok(e.roll(mage, boss, { type: 'damage', formula: 'percent', power: 0.25 }, {}).immune, 'percent: bosses immune');
  gob.hp = gob.mhp;
  // MP damage & drain (monster drain heals HP)
  const suck = DB.actions.tb_e_suck;
  mage.mp = 20;
  gob.hp = 10;
  let ev = use(e, gob, 'tb_e_suck', mage);
  const lost = 20 - mage.mp;
  ok(lost > 0 && said(ev, `マルタのMPが${lost}減った！`) && gob.hp === Math.min(gob.mhp, 10 + lost), 'MP damage; a monster turns the MP it drains into HP');
  ok(suck.effects[0].mp && mage.hp === mage.mhp, 'MP damage leaves HP');
  mage.mp = 0;
  ev = use(e, gob, 'tb_e_suck', mage);
  ok(said(ev, 'しかし効き目がなかった。'), 'no MP → no effect');
  // spell drain
  const dark = DB.actions.tb_s_dark;
  mage.mp = 30; mage.c.hp = 10;
  ev = use(e, mage, 'tb_s_dark', dummy);
  const dealt = ev.filter((x) => x.t === 'dmg' && x.u === dummy).reduce((s, x) => s + x.n, 0);
  ok(dealt > 0 && mage.hp === Math.min(mage.mhp, 10 + Math.round(dealt * dark.effects[0].drain)), 'drain heals round(dealt × drain)');
});

// ================================================================ Part A13: proficiency raises power
sec('proficiency power (A13)');   // A17: ranks 1–100, ×(1 + 0.30 × ((r − 1)/99)^0.75)
guard('proficiency power', () => {
  const e = mk({ mons: ['tb_goblin', 'tb_dummy'] });
  const hero = P(e, 0), mage = P(e, 2), gob = Mo(e, 0), dummy = Mo(e, 1);
  const PTS = R.Rules.K.PROF_PTS;
  const PF = (r) => R.Rules.profPowerOf(r);
  const X = (u, t, a, o) => e.roll(u, t, a.effects[0], Object.assign({ act: a, kind: a.kind, expect: true }, o || {})).dmg;
  const fire = DB.actions.tb_s_fire, steam = DB.actions.tb_s_steam, heal = DB.actions.tb_s_heal;
  for (const k in mage.c.eprof) mage.c.eprof[k] = 0;
  for (const k in hero.c.wprof) hero.c.wprof[k] = 0;
  const f0 = X(mage, dummy, fire);
  mage.c.eprof.fire = PTS[20];
  near(X(mage, dummy, fire) / f0, PF(20), 1e-9, 'spell: element rank 20 → ×1.087');
  mage.c.eprof.fire = PTS[100];
  near(X(mage, dummy, fire) / f0, 1.30, 1e-9, 'spell: element rank 100 → ×1.30 (max)');
  mage.c.eprof.fire = 0;
  near(X(mage, dummy, fire) / f0, 1, 1e-9, 'spell: rank 1 → ×1');
  // combo: the average rank of its elements
  const s0 = X(mage, dummy, steam);
  mage.c.eprof.fire = PTS[30]; mage.c.eprof.water = PTS[10];
  near(X(mage, dummy, steam) / s0, PF(20), 1e-9, 'combo: ranks 30 and 10 → average 20');
  mage.c.eprof.fire = 0; mage.c.eprof.water = 0;
  // healing spells too (battle and the AI's estimate share R.Mon.healAmount)
  const h0 = e.expectHeal(mage, heal, hero);
  mage.c.eprof.light = PTS[60];
  near(e.expectHeal(mage, heal, hero) / h0, PF(60), 0.03, 'heal spell: light rank 60 → ×1.20 (rounded HP)');
  const n = R.Mon.healAmount(mage, hero, heal.effects[0], { action: heal });
  ok(n === Math.round(h0 * PF(60)) || Math.abs(n - h0 * PF(60)) <= 1, 'healAmount with the action applies the bonus');
  ok(R.Mon.healAmount(mage, hero, heal.effects[0], { item: true, action: heal }) === R.Mon.healAmount(mage, hero, heal.effects[0], { item: true }), 'items get no proficiency bonus');
  mage.c.eprof.light = 0;
  // plain attack and techs: the weapon type in the slot used; weapon2 uses its own type
  equip(hero, 'shield', null); equip(hero, 'weapon2', 'tb_dagger');
  const atk = (slot) => e.roll(hero, dummy, SURE(), { slot, attack: true, expect: true }).dmg;
  const a1 = atk('weapon1'), a2 = atk('weapon2'), ea2 = e.expectAttack(hero, dummy, 'weapon2');
  hero.c.wprof.sword = PTS[20];
  near(atk('weapon1') / a1, PF(20), 1e-9, 'attack with weapon1: sword rank 20');
  near(atk('weapon2') / a2, 1, 1e-9, 'attack with weapon2 (dagger rank 1) is not raised by the sword rank');
  hero.c.wprof.dagger = PTS[60];
  near(atk('weapon2') / a2, PF(60), 1e-9, 'attack with weapon2: its own type (dagger rank 60)');
  const cut = DB.actions.tb_t_cut;
  const t0 = (slot) => { const sv = [hero.c.wprof.sword, hero.c.wprof.dagger]; hero.c.wprof.sword = 0; hero.c.wprof.dagger = 0; const d = X(hero, dummy, cut, { slot, W: hero.weapon(slot) }); hero.c.wprof.sword = sv[0]; hero.c.wprof.dagger = sv[1]; return d; };
  near(X(hero, dummy, cut, { slot: 'weapon1', W: hero.weapon('weapon1') }) / t0('weapon1'), PF(20), 1e-9, 'tech from weapon1 → sword rank');
  near(X(hero, dummy, cut, { slot: 'weapon2', W: hero.weapon('weapon2') }) / t0('weapon2'), PF(60), 1e-9, 'tech from weapon2 → dagger rank');
  near(e.expectAttack(hero, dummy, 'weapon2') / ea2, PF(60), 1e-9, 'the AI estimate (expectAttack) sees the bonus');
  // monsters are unaffected
  ok(e.profMul(gob, { attack: true }) === 1 && e.profMul(gob, { act: fire, kind: 'spell' }) === 1, 'monsters: profMul 1');
  const m0 = e.roll(gob, hero, SURE(), { attack: true, expect: true }).dmg;
  for (const k in hero.c.wprof) hero.c.wprof[k] = R.Rules.K.PROF_CAP;
  near(e.roll(gob, hero, SURE(), { attack: true, expect: true }).dmg, m0, 1e-9, "a monster's hit does not change with the target's proficiency");
  // items / 魔石 get nothing
  const pot = DB.items.tb_firepot;
  mage.c.eprof.fire = R.Rules.K.PROF_CAP;
  near(e.roll(mage, gob, pot.use.effects[0], { act: pot.use, item: pot, kind: 'item', expect: true }).dmg, 0.8 * 21 * 1.5, 1e-6, 'tier-formula items: no proficiency bonus');
  mage.c.eprof.fire = 0;
  // Part A13b: the engine's MP cost follows R.Rules.mpCost (1段目 free at rank 14, A17)
  if (DB.actions.s_fire_1) {
    mage.c.eprof.fire = PTS[14];
    ok(e.mpCost(mage, 's_fire_1') === 0 && !e.unusable(mage, 's_fire_1'), 'A13b: 1段目 fire spell costs MP 0 at fire rank 14');
    mage.mp = 0;
    ok(!e.unusable(mage, 's_fire_1'), 'A13b: castable with MP 0');
    mage.c.eprof.fire = 0;
    ok(e.unusable(mage, 's_fire_1') === 'mp', 'A13b: rank 1 needs MP again');
    // the auto AI (thrift, 雑魚戦) casts a free 1段目 spell instead of 攻撃 / 防御 when it hits
    const e2 = mk({ mons: ['tb_goblin', 'tb_goblin'] });
    const mg = P(e2, 2);
    if (!mg.c.spells.includes('s_fire_1')) mg.c.spells.push('s_fire_1');
    mg.mp = 0;
    const before = AI.partyCommands(e2, { thrift: true, items: false })[2];
    ok(!(before && before.type === 'spell'), 'A13b: MP 0 at rank 1 → no spell');
    mg.c.eprof.fire = PTS[14];
    const cmd = AI.partyCommands(e2, { thrift: true, items: false })[2];
    ok(cmd && cmd.type === 'spell' && cmd.id === 's_fire_1', 'A13b: the free 1段目 spell is chosen in thrift mode', JSON.stringify(cmd && { type: cmd.type, id: cmd.id }));
  }
});

// ================================================================ effects
sec('heal/revive/items');
guard('heal', () => {
  const e = mk({ mons: ['tb_goblin'] });
  const hero = P(e, 0), mage = P(e, 2);
  hero.c.hp = 1;
  const n0 = R.Mon.healAmount(mage, hero, DB.actions.tb_s_heal.effects[0]);
  const mp0 = mage.mp;
  let ev = use(e, mage, 'tb_s_heal', hero);
  ok(hero.hp === 1 + n0 && said(ev, 'マルタはテストひだまりを唱えた！') && said(ev, `アルンのHPが${n0}回復した！`), '「〜は〈術〉を唱えた！」「〜のHPが〜回復した！」');
  ok(mage.mp === mp0 - e.mpCost(mage, 'tb_s_heal') && e.stats.casts.tb_mage === 1, 'MP paid, cast counted');
  hero.c.hp = hero.mhp;
  ev = use(e, mage, 'tb_s_heal', hero);
  ok(said(ev, 'しかし効き目がなかった。'), 'heal at full HP: no effect');
  equip(mage, 'acc1', 'tb_boost');
  hero.c.hp = 1;
  run(e.effect(mage, hero, { type: 'heal', pct: 0.35 }, { act: DB.actions.tb_s_heal, kind: 'spell' }));
  ok(hero.hp === 1 + Math.round(hero.mhp * 0.35 * R.Mon.mndf(mage.stat('mnd')) * 1.5), 'healPct +50');
  equip(mage, 'acc1', null);
  // items: consumed, % of max HP, itemPct, none left
  e.inv.tb_salve = 2;
  hero.c.hp = 1;
  ev = use(e, P(e, 1), 'tb_salve', hero, { item: true });
  ok(hero.hp === 1 + Math.round(hero.mhp * 0.35) && e.count('tb_salve') === 1 && said(ev, 'ブリギッタはテスト傷薬を使った！'), 'item heal = max HP × pct, the item is used up');
  equip(P(e, 1), 'acc1', 'tb_boost');
  hero.c.hp = 1;
  use(e, P(e, 1), 'tb_salve', hero, { item: true });
  ok(hero.hp === 1 + Math.round(hero.mhp * 0.35 * 2), 'itemPct +100 on healing items');
  ev = use(e, P(e, 1), 'tb_salve', hero, { item: true });
  ok(said(ev, 'ブリギッタはテスト傷薬を使おうとした！') && said(ev, 'しかしテスト傷薬はもう残っていない。'), 'none left');
  equip(P(e, 1), 'acc1', null);
  // all allies: quiet for the full ones
  hero.c.hp = 5; P(e, 1).c.hp = P(e, 1).mhp;
  mage.mp = 30;
  ev = use(e, mage, 'tb_s_healall', null);
  ok(count(ev, 'heal') === 1 && hero.hp > 5 && !said(ev, 'しかし効き目がなかった。'), 'allies: the full ones are skipped quietly');
  // MP (A18: no WP)
  P(e, 3).mp = 0;
  e.inv.tb_ether = 1;
  ev = use(e, hero, 'tb_ether', P(e, 3), { item: true });
  ok(P(e, 3).mp === Math.ceil(P(e, 3).mmp * 0.3) && said(ev, 'シルヴァンのMPが'), 'healMp = ceil(max × pct)');
  ok(!('wp' in P(e, 3)) && !('mwp' in P(e, 3)) && typeof e.wpCost !== 'function', 'no WP on units, no wpCost (A18)');
  // revive
  run(e.die(hero, null));
  ok(!hero.alive && hero.hp === 0 && e.stats.deaths === 1, 'down');
  mage.mp = 30;
  ev = use(e, mage, 'tb_s_heal', hero);
  ok(!hero.alive, 'a heal never revives (it goes to a living ally)');
  ev = use(e, mage, 'tb_s_revive', hero);
  ok(hero.alive && hero.hp === Math.floor(hero.mhp * 0.3) && said(ev, 'アルンは生き返った！') && count(ev, 'revive') === 1, 'revive = floor(max HP × pct)');
  ev = use(e, mage, 'tb_s_revive', hero);
  ok(said(ev, 'しかし効き目がなかった。'), 'revive with nobody down');
  run(e.die(P(e, 3), null));
  mage.mp = 30; hero.c.hp = 1;
  use(e, mage, 'tb_s_party', null);
  ok(P(e, 3).alive && hero.hp > 1, "'party' target: the fallen and the living");
  e.inv.tb_revive = 1;
  run(e.die(P(e, 1), null));
  ev = use(e, hero, 'tb_revive', null, { item: true });
  ok(P(e, 1).alive && P(e, 1).hp === Math.floor(P(e, 1).mhp * 0.35), 'revive item on the fallen ally');
  // field-only effects & unusable items
  ok(e.unusable(hero, 'tb_repel') === 'field', 'a field-only item cannot be chosen in battle');
  ev = run(e.effect(hero, hero, { type: 'teleport' }, {}));
  ok(said(ev, 'ここでは使えない。'), 'field effect in battle');
  ok(e.unusable(hero, 'tb_salve') === 'none', 'no item left → none');
  // grow
  e.inv.tb_seed = 1;
  const mhp0 = hero.mhp, hp0 = hero.hp;
  ev = use(e, hero, 'tb_seed', hero, { item: true });
  ok(hero.mhp === mhp0 + 10 && hero.hp === hp0 + 10 && hero.c.bonus.hp === 10 && said(ev, 'アルンの最大HPが10増えた！'), 'grow: max HP +10, current HP too');
  hero.c.bonus.hp = 200;
  ev = run(e.effect(hero, hero, { type: 'grow', stat: 'hp', n: 10 }, {}));
  ok(said(ev, 'これ以上は効かない。'), 'grow cap');
});

sec('status');
guard('status', () => {
  const e = mk({ mons: ['tb_goblin', 'tb_bone', 'tb_boss'] });
  const hero = P(e, 0), mage = P(e, 2), gob = Mo(e, 0), bone = Mo(e, 1), boss = Mo(e, 2);
  const SF = U.clamp((128 + mage.stat('int')) / 168, 0.6, 2);
  const rate = (u, t, s, ch, sf, n) => mean(() => { delete t.status[s]; delete t.turns[s]; const got = run(e.inflict(u, t, s, ch, { sf, quiet: true })); return t.status[s] ? 1 : 0; }, n || 4000);
  near(rate(mage, gob, 'blind', 0.5, 'int'), 0.5 * SF, 0.025, 'p = chance × SF(int)');
  near(rate(mage, gob, 'blind', 1, 'int'), 0.95, 0.012, 'p ≤ 0.95');
  near(rate(mage, boss, 'silence', 1, 'int'), Math.min(0.95, SF * 0.5), 0.025, 'boss default resist (silence 0.5)');
  near(rate(mage, boss, 'sleep', 1, 'int'), Math.min(0.95, SF * 0.25), 0.02, 'boss sleep resist 0.75');
  ok(rate(mage, bone, 'sleep', 1, 'int', 300) === 0, 'statusRes 1 = immune');
  near(rate(mage, bone, 'confuse', 1, 'int'), Math.min(0.95, SF * 0.5), 0.025, 'statusRes 0.5');
  const SFd = U.clamp((128 + hero.stat('dex')) / 168, 0.6, 2);
  near(rate(hero, gob, 'blind', 0.5, 'dex'), 0.5 * SFd, 0.025, 'SF(dex) for weapons and physical techs');
  near(rate(gob, hero, 'poison', 1, null), 1 - hero.stat('mnd') / 500, 0.02, 'party resist = 精神/500');
  equip(hero, 'acc1', 'tb_ring_sleep');
  ok(rate(gob, hero, 'sleep', 1, null, 300) === 0, 'statusImmune (equipment) blocks');
  equip(hero, 'acc1', null);
  // messages
  delete gob.status.poison;
  let ev = run(e.inflict(mage, gob, 'poison', 1, { sf: 'int' }));
  ok(!gob.status.poison || said(ev, 'テスト小鬼は毒におかされた！'), 'status on-text from DB.statuses');
  gob.status.poison = true;
  ev = run(e.inflict(mage, gob, 'poison', 1, { sf: 'int' }));
  ok(said(ev, 'しかし効き目がなかった。'), 'already poisoned');
  ev = run(e.inflict(mage, gob, 'poison', 1, { sf: 'int', multi: true }));
  ok(said(ev, 'テスト小鬼には効き目がなかった。'), 'multi-target wording');
  // veil
  hero.status.veil = true;
  ok(rate(gob, hero, 'blind', 1, null, 200) === 0, 'veil blocks bad statuses');
  hero.status.veil = true; hero.buffs.atk = 0;
  ev = use(e, gob, 'tb_e_weak', hero);
  ok(hero.buffs.atk === 0, 'veil blocks debuffs');
  run(e.inflict(mage, hero, 'regen', null, {}));
  ok(hero.status.regen, 'veil lets good statuses through');
  delete hero.status.veil; delete hero.status.regen;
  // good statuses always land, turns refreshed
  run(e.inflict(mage, hero, 'regen', null, {}));
  hero.turns.regen = 1;
  run(e.inflict(mage, hero, 'regen', null, {}));
  ok(hero.status.regen && hero.turns.regen === 5, 'good status refreshed (regen 5)');
  // death
  const e2 = mk({ mons: ['tb_goblin', 'tb_boss', 'tb_rare'] });
  const m2 = P(e2, 2);
  m2.mp = 99;
  ev = use(e2, m2, 'tb_s_doom', Mo(e2, 1));
  ok(Mo(e2, 1).alive, 'death: bosses immune');
  ev = use(e2, m2, 'tb_s_doom', Mo(e2, 2));
  ok(Mo(e2, 2).alive, 'death: rare monsters immune');
  let killed = 0;
  for (let i = 0; i < 200; i++) { const x = mk({ mons: ['tb_goblin'] }); P(x, 2).mp = 99; use(x, P(x, 2), 'tb_s_doom', Mo(x, 0)); if (!Mo(x, 0).alive) killed++; }
  near(killed / 200, 0.95, 0.05, 'death kills at p (capped 0.95)');
  // exclusive statuses
  gob.status = {}; gob.turns = {};
  run(e.inflict(gob, hero, 'sleep', 1, { quiet: true }));
  hero.status = { sleep: true }; hero.turns = { sleep: 3 };
  ev = run(e.inflict(Mo(e, 0), hero, 'paralyze', 5, {}));
  ok(hero.status.paralyze && !hero.status.sleep, 'one disabling status at a time (the new one wins)');
  hero.status = { burn: true }; hero.turns = { burn: 3 };
  run(e.inflict(Mo(e, 0), hero, 'freeze', 5, {}));
  ok(hero.status.freeze && !hero.status.burn, 'freeze removes burn');
  run(e.inflict(Mo(e, 0), hero, 'burn', 5, {}));
  ok(hero.status.burn && !hero.status.freeze, 'burn removes freeze');
  hero.status = { freeze: true }; hero.turns = { freeze: 2 };
  run(e.hit(gob, hero, { dmg: 3 }, { kind: 'magic', element: 'fire' }));
  ok(!hero.status.freeze, 'fire damage melts freeze');
  let woke = 0, snapped = 0, magicSnap = 0;
  for (let i = 0; i < 600; i++) {
    hero.c.hp = hero.mhp;
    hero.status = { sleep: true, confuse: true }; hero.turns = { sleep: 4, confuse: 4 };
    run(e.hit(gob, hero, { dmg: 1 }, { kind: 'phys' }));
    if (!hero.status.sleep) woke++;
    if (!hero.status.confuse) snapped++;
    hero.status = { confuse: true }; hero.turns = { confuse: 4 };
    run(e.hit(gob, hero, { dmg: 1 }, { kind: 'magic' }));
    if (!hero.status.confuse) magicSnap++;
  }
  near(woke / 600, 0.5, 0.07, 'sleep: 50 % wake on damage');
  near(snapped / 600, 0.5, 0.07, 'confuse: 50 % on physical damage');
  ok(magicSnap === 0, 'confuse: magic damage does not snap it');
  hero.status = {}; hero.turns = {};
  // durations
  const turnsOf = (s, t) => { const out = new Set(); for (let i = 0; i < 400; i++) { delete t.status[s]; delete t.turns[s]; run(e.inflict(mage, t, s, 5, { quiet: true })); if (t.status[s]) out.add(t.turns[s]); } return [...out].sort(); };
  gob.statusRes = null;
  ok(turnsOf('sleep', Mo(e, 0)).join() === '2,3,4', 'sleep 2–4 turns');
  ok(turnsOf('sleep', boss).join() === '1', 'boss sleep 1 turn');
  ok(turnsOf('blind', Mo(e, 0)).join() === '3,4,5' && turnsOf('burn', Mo(e, 0)).join() === '3', 'blind 3–5, burn 3');
  ok(!('poison' in (() => { const t = Mo(e, 0); delete t.status.poison; delete t.turns.poison; run(e.inflict(mage, t, 'poison', 5, { quiet: true })); return t.turns; })()), 'poison: until cured');
  // cure
  e.inv.tb_panacea = 1; e.inv.tb_waker = 1;
  hero.status = { sleep: true, poison: true, blind: true }; hero.turns = { sleep: 3, blind: 3 };
  ev = use(e, P(e, 1), 'tb_panacea', hero, { item: true });
  ok(!hero.status.sleep && !hero.status.poison && !hero.status.blind && said(ev, 'アルンは目を覚ました！') && said(ev, 'アルンの毒が消えた。'), "cure 'all' with the off-texts");
  hero.status = { confuse: true, poison: true }; hero.turns = { confuse: 3 };
  use(e, P(e, 1), 'tb_waker', hero, { item: true });
  ok(!hero.status.confuse && hero.status.poison, 'cure: only the listed statuses');
  hero.status = {}; hero.turns = {};
});

sec('turn statuses');
guard('turn statuses', () => {
  const e = mk({ mons: ['tb_goblin', 'tb_boss'] });
  const hero = P(e, 0), gob = Mo(e, 0), boss = Mo(e, 1);
  e.round = 1;
  quiet(() => {
    hero.status.sleep = true; hero.turns.sleep = 2;
    let ev = run(e.turn(hero, { type: 'attack', target: gob, slot: 'weapon1' }));
    ok(said(ev, 'アルンは眠っている。') && !said(ev, 'アルンの攻撃！') && hero.turns.sleep === 1, 'asleep: the turn is skipped, the count goes down');
    e.round = 2;
    ev = run(e.turn(hero, { type: 'attack', target: gob, slot: 'weapon1' }));
    ok(said(ev, 'アルンは目を覚ました！') && !hero.status.sleep && !said(ev, 'アルンの攻撃！'), 'wakes on the last skipped turn (that turn is lost)');
    e.round = 3;
    hero.status.stun = true; hero.turns.stun = 1;
    ev = run(e.turn(hero, { type: 'attack', target: gob, slot: 'weapon1' }));
    ok(said(ev, 'アルンは気を失っている。') && !hero.status.stun, 'stun: one turn');
    e.round = 4;
    ev = run(e.turn(hero, { type: 'attack', target: gob, slot: 'weapon1' }));
    ok(said(ev, 'アルンの攻撃！'), 'acts again');
  });
  // poison / burn / regen ticks, once per round
  hero.c.hp = hero.mhp; hero.status = { poison: true }; hero.upkeep = null;
  e.round = 10;
  let ev = run(e.endTurn(hero));
  ok(hero.hp === hero.mhp - Math.floor(hero.mhp / 16) && said(ev, `毒でアルンに${Math.floor(hero.mhp / 16)}のダメージ！`), 'poison: max HP/16');
  run(e.endTurn(hero));
  ok(hero.hp === hero.mhp - Math.floor(hero.mhp / 16), 'upkeep once per round');
  boss.status.poison = true; boss.upkeep = null;
  const bh = boss.hp;
  run(e.endTurn(boss));
  ok(bh - boss.hp === Math.min(999, Math.floor(boss.mhp / 64)), 'boss poison: max HP/64');
  e.round = 11;
  hero.c.hp = hero.mhp; hero.status = { burn: true }; hero.turns = { burn: 3 };
  run(e.endTurn(hero));
  ok(hero.hp === hero.mhp - Math.floor(hero.mhp / 10) && hero.turns.burn === 2, 'burn: max HP/10, counts down');
  e.round = 12;
  hero.status = { regen: true }; hero.turns = { regen: 5 }; hero.c.hp = 10;
  run(e.endTurn(hero));
  ok(hero.hp === 10 + Math.floor(hero.mhp / 10), 'regen: party max HP/10');
  gob.status = { regen: true }; gob.turns = { regen: 5 }; gob.hp = 10;
  run(e.endTurn(gob));
  ok(gob.hp === 10 + Math.floor(gob.mhp / 20), 'regen: monsters max HP/20');
  for (let r = 13; r < 17; r++) { e.round = r; run(e.endTurn(hero)); }
  ok(!hero.status.regen, 'regen ends after 5 turns');
  hero.status = {}; hero.turns = {};
  // mods: permanent regen, mpRegen (quiet), hpLoss (never below 1)
  equip(hero, 'acc1', 'tb_regen');
  hero.c.hp = 10; hero.mp = 0;
  e.round = 20;
  ev = run(e.endTurn(hero));
  ok(hero.hp === 10 + Math.floor(hero.mhp / 20) && hero.mp === 2 && !said(ev, 'MPが'), 'regen:true /20, mpRegen 2 (quiet; no wpRegen, A18)');
  equip(hero, 'acc1', 'tb_cursed');
  hero.c.hp = hero.mhp;
  e.round = 21;
  run(e.endTurn(hero));
  ok(hero.hp === hero.mhp - Math.floor(hero.mhp * 0.05), 'hpLoss 5 %');
  hero.c.hp = 1; e.round = 22;
  run(e.endTurn(hero));
  ok(hero.hp === 1, 'hpLoss never takes the last HP');
  equip(hero, 'acc1', null); hero.c.hp = hero.mhp;
  // silence
  const mage = P(e, 2);
  mage.status.silence = true; mage.turns.silence = 3;
  ev = use(e, mage, 'tb_s_fire', gob);
  ok(said(ev, 'しかし術を封じられている！') && count(ev, 'dmg') === 0 && e.unusable(mage, 'tb_s_fire') === 'silence', 'silence blocks spells');
  ok(e.unusable(mage, 'tb_t_mind', 'weapon1') === 'silence' && !e.unusable(P(e, 0), 'tb_t_cut', 'weapon1'), 'silence blocks magic techs only');
  delete mage.status.silence;
  mage.mp = 1;
  ev = use(e, mage, 'tb_s_fireall', null);
  ok(said(ev, 'しかしMPが足りない！') && e.unusable(mage, 'tb_s_fireall') === 'mp', 'not enough MP');
  mage.mp = mage.mmp;
  const caster = new B.MonUnit('tb_caster', 5, e);
  e.mons.push(caster);
  caster.status.silence = true;
  ok(e.unusable(caster, 'tb_e_bolt') === 'silence' && !AI.monUsable(e, caster, 'tb_e_bolt'), 'monster magic actions: silence');
  ok(AI.monster(e, caster).type === 'attack', 'a silenced caster attacks');
  ev = use(e, caster, 'tb_e_bolt', hero);
  ok(said(ev, 'しかし術を封じられている！'), 'queued monster spell refused');
  e.mons.pop();
  // confusion
  const e2 = mk({ mons: ['tb_dummy', 'tb_dummy'] });
  const y2 = P(e2, 0);
  let friend = 0, foe = 0, self = 0;
  for (let i = 0; i < 600; i++) { const c = e2.confusedCommand(y2); if (c.target === y2) self++; else if (c.target.isParty) friend++; else foe++; }
  ok(self === 0 && friend > 220 && foe > 220, `confused: friends and foes 50 : 50, never self (${friend}/${foe})`);
  y2.status.confuse = true; y2.turns.confuse = 5;
  const cev = withGlimmer(() => { throw new Error('no glimmer roll when confused'); }, () => run(e2.turn(y2, { type: 'defend' })));
  ok(said(cev, 'アルンは混乱している！') && said(cev, 'アルンの攻撃！'), 'confused: attacks someone (no command, no glimmer)');
});

sec('buffs/dispel');
guard('buffs', () => {
  const e = mk({ mons: ['tb_goblin', 'tb_boss'] });
  const hero = P(e, 0), mage = P(e, 2), gob = Mo(e, 0), boss = Mo(e, 1);
  mage.mp = 99;
  let ev = use(e, mage, 'tb_s_rally', null);
  ok(e.party.every((p) => p.buffs.atk === 1) && texts(ev).filter((t) => t.includes('攻撃力が上がった')).length === 4 && count(ev, 'buff') === 4, 'allies +1');
  use(e, mage, 'tb_s_rally', null);
  ev = use(e, mage, 'tb_s_rally', null);
  ok(hero.buffs.atk === 2 && said(ev, 'しかしアルンの攻撃力はもう上がらない！'), 'clamped at +2');
  const SF = U.clamp((128 + mage.stat('int')) / 168, 0.6, 2);
  const land = (t, id, n) => mean(() => { t.buffs.atk = 0; t.buffs.def = 0; t.status = {}; use(e, mage, id, t); mage.mp = 99; return t.buffs.atk < 0 || t.buffs.def < 0 ? 1 : 0; }, n || 2000);
  near(land(gob, 'tb_s_weaken'), Math.min(0.95, 0.8 * SF), 0.03, 'debuff chance × SF(int)');
  ok(land(gob, 'tb_s_break', 300) === 1, 'a debuff without chance always lands');
  // a physical tech's debuff: chance × SF(器用さ) (§7.3.3, §4.8.3)
  const knight = P(e, 0);
  const saveW = knight.c.equip.weapon1;
  equip(knight, 'weapon1', 'tb_whip');
  const SFd = U.clamp((128 + knight.stat('dex')) / 168, 0.6, 2);
  const landT = () => (() => { gob.buffs.agi = 0; gob.status = {}; knight.mp = 99; const r = run(e.useAction(knight, 'tb_t_trip', DB.actions.tb_t_trip, gob, { slot: knight.slotFor('dagger') === false ? undefined : knight.slotFor('dagger'), free: true })); return gob.alive && r.some((x) => x.t === 'dmg' && x.u === gob && x.n > 0) ? (gob.buffs.agi < 0 ? 1 : 0) : null; })();
  if (knight.slotFor('dagger') !== false) {
    let hitN = 0, got = 0;
    for (let i = 0; i < 2000; i++) { gob.hp = gob.mhp; const v = landT(); if (v != null) { hitN++; got += v; } }
    near(got / Math.max(1, hitN), Math.min(0.95, 1 * SFd), 0.035, 'tech debuff chance × SF(dex)');
  } else ok(false, 'tb_whip (a dagger since A19) gives a dagger slot');
  equip(knight, 'weapon1', saveW);
  near(land(boss, 'tb_s_break'), 0.5, 0.03, 'bosses: × 0.5');
  near(land(boss, 'tb_s_weaken'), 0.8 * SF * 0.5, 0.03, 'bosses: chance × SF × 0.5');
  gob.buffs.def = 0;
  use(e, mage, 'tb_s_break', gob);
  ev = use(e, mage, 'tb_s_break', gob);
  ok(gob.buffs.def === -2 && said(ev, 'しかしテスト小鬼の守備力はもう下がらない！'), 'clamped at −2');
  // dispel
  gob.buffs = { atk: 2, def: -1, mag: 0, mdef: 1, agi: 0 };
  gob.status.regen = true; gob.turns.regen = 3;
  P(e, 2).mp = 99;
  ev = use(e, mage, 'tb_t_unward', gob, { slot: 'weapon1' });
  ok(gob.buffs.atk === 0 && gob.buffs.mdef === 0 && gob.buffs.def === -1 && !gob.status.regen && said(ev, 'テスト小鬼の強化の効果が消えた！'), "dispel 'good': ups and good statuses");
  ev = use(e, mage, 'tb_t_unward', gob, { slot: 'weapon1' });
  ok(said(ev, 'しかし効き目がなかった。'), 'nothing to dispel');
  hero.buffs.def = -2; hero.status.blind = true; hero.turns.blind = 3;
  ev = use(e, mage, 'tb_s_purge', null);
  ok(hero.buffs.def === 0 && hero.buffs.atk === 2 && !hero.status.blind && said(ev, 'アルンの弱体の効果が消えた！'), "dispel 'bad' + cure on the allies");
  // startBuffs, on:'allies', agi stages in the order
  const p2 = R.fxBattleParty(10);
  p2[2].equip.acc1 = 'tb_haste';
  const e2 = mk({ party: p2 });
  ev = run(e2.begin());
  ok(P(e2, 2).buffs.agi === 1 && P(e2, 2).buffs.def === 1 && count(ev, 'buff', (x) => x.start) === 2, 'startBuffs at the start');
  const e3 = mk({ mons: ['tb_goblin', 'tb_goblin'] });
  P(e3, 2).mp = 99;
  ev = use(e3, P(e3, 2), 'tb_s_steam', null);
  ok(e3.party.every((p) => p.buffs.atk === 1) && count(ev, 'dmg', (x) => !x.u.isParty) === 2, "on:'allies' effect after the damage");
});

sec('steal/scan/summon');
guard('steal', () => {
  const e = mk({ mons: ['tb_goblin', 'tb_boss', 'tb_dummy'] });
  const archer = P(e, 3), gob = Mo(e, 0), boss = Mo(e, 1);
  const pc = e.stealChance(archer, gob);
  ok(Math.abs(pc - U.clamp(0.35 + (archer.stat('agi') - gob.stat('agi')) / 200, 0.1, 0.8)) < 1e-12, 'steal = clamp(0.35 + Δagi/200, 0.1, 0.8)');
  ok(Math.abs(e.stealChance(archer, boss) - U.clamp(0.35 + (archer.stat('agi') - boss.stat('agi')) / 200, 0.1, 0.8) * 0.5) < 1e-12, 'bosses × 0.5');
  equip(archer, 'acc1', 'tb_lucky');
  ok(Math.abs(e.stealChance(archer, gob) - Math.min(1, pc * 1.5)) < 1e-12, 'stealPct +50 (× (1 + stealPct/100), no cap below 1)');
  equip(archer, 'acc1', null);
  let got = 0, rare = 0, tries = 0, again = 0;
  for (let i = 0; i < 3000; i++) {
    const x = mk({ mons: ['tb_goblin'] });
    const u = P(x, 3), t = Mo(x, 0);
    const ev = run(x.steal(u, t));
    tries++;
    if (x.stolen.length) {
      got++;
      if (x.stolen[0].grade === 'rare') rare++;
      if (said(run(x.steal(u, t)), 'しかし何も盗めなかった。')) again++;
      if (!(said(ev, /^シルヴァンは(★テストのお守り|テスト傷薬)を盗んだ！$/) && count(ev, 'gain', (g) => g.stolen) === 1 && t.stolen)) ok(false, 'steal message / event');
    } else if (!said(ev, 'しかし何も盗めなかった。')) ok(false, 'failed steal message');
  }
  near(got / tries, pc, 0.025, 'steal success rate');
  ok(again === got, 'one steal per monster');
  near(rare / got, Math.min(0.5, (1 / 32) * 4), 0.03, 'rare slot at min(0.5, rare drop × 4)');
  const dummyEv = run(e.steal(archer, Mo(e, 2)));
  ok(said(dummyEv, 'しかし何も盗めなかった。'), 'nothing to steal');
  // the tech
  const e4 = mk({ mons: ['tb_goblin'] });
  const a4 = P(e4, 3);
  a4.c.equip.weapon1 = 'tb_dagger'; a4.c.techs.push('tb_t_filch'); a4.refresh();
  a4.c.row = 'front';
  a4.mp = 99;
  const ev4 = use(e4, a4, 'tb_t_filch', Mo(e4, 0), { slot: 'weapon1' });
  ok(said(ev4, 'シルヴァンのテストかすめ！'), 'steal tech');
  // full bag
  const e5 = mk({ mons: ['tb_goblin'], inv: { tb_salve: 99, tb_rare_charm: 99 } });
  let any = false;
  for (let i = 0; i < 40; i++) { Mo(e5, 0).stolen = false; run(e5.steal(P(e5, 3), Mo(e5, 0))); if (e5.stolen.length) any = true; }
  ok(!any && e5.inv.tb_salve === 99, 'a full stack (99) is not stolen');
  // autoSteal
  let auto = 0, silent = true, autoTries = 0, autoRare = 0;
  for (let i = 0; i < 3000; i++) {
    const x = mk({ mons: ['tb_goblin'] });
    const u = P(x, 0), t = withD(Mo(x, 0), { hp: 99999 });
    t.hp = t.mhp = 99999;
    equip(u, 'acc1', 'tb_glove');
    const ev = run(x.attack(u, t, { slot: 'weapon1' }));
    if (!ev.some((q) => q.t === 'dmg' && q.u === t)) continue;
    autoTries++;
    if (x.stolen.length) { auto++; if (x.stolen[0].grade === 'rare') autoRare++; } else if (said(ev, '盗') ) silent = false;
    run(x.attack(u, t, { slot: 'weapon1' }));
    if (x.stolen.length > 1) ok(false, 'auto-steal once per monster');
  }
  const ac = mk({ mons: ['tb_goblin'] });
  near(auto / autoTries, ac.stealChance(P(ac, 0), Mo(ac, 0)), 0.03, 'ついでに盗む: steal chance × autoSteal/100 on a landed attack');
  near(autoRare / Math.max(1, auto), Math.min(0.5, (1 / 32) * 4) * 0.5, 0.03, 'auto-steal: the rare slot at half the rate');
  ok(silent, 'a failed auto-steal says nothing');
  // monsters steal gold only in real battles
  const ev6 = run(e.steal(Mo(e, 0), P(e, 0)));
  ok(said(ev6, 'しかし何も盗めなかった。'), 'simulated: monster theft takes nothing');
});
guard('scan/summon/grow', () => {
  const e = mk({ mons: ['tb_goblin', 'tb_slime', 'tb_splitter'] });
  e.inv.tb_lens = 2;
  let ev = use(e, P(e, 0), 'tb_lens', Mo(e, 0), { item: true });
  ok(said(ev, 'テスト小鬼　Lv10　HP60/60') && said(ev, '弱点：火') && !said(ev, '吸収'), 'scan: Lv, HP, weakness');
  ev = use(e, P(e, 0), 'tb_lens', Mo(e, 1), { item: true });
  ok(said(ev, '弱点は見つからない。') && said(ev, '吸収：風'), 'scan: no weakness, absorb');
  // summon
  const sp = Mo(e, 2);
  ev = use(e, sp, 'tb_e_call', null);
  ok(e.mons.length === 4 && Mo(e, 3).id === 'tb_splitter' && Mo(e, 3).summoned && count(ev, 'summon', (x) => x.units.join() === '3') === 1, 'summon: a new monster on the right');
  ok(Mo(e, 2).name === 'テスト分裂Ａ' && Mo(e, 3).name === 'テスト分裂Ｂ' && said(ev, 'テスト分裂は仲間を呼んだ！') && said(ev, 'テスト分裂Ｂが現れた！'), '「〜は仲間を呼んだ！」, then letters relabelled and 「〜が現れた！」');
  ev = use(e, sp, 'tb_e_call', null);
  ok(e.mons.length === 4 && said(ev, 'しかし、誰も来なかった。'), 'no one comes past max living');
  ok(AI.monCommand(e, sp, 'tb_e_call') === null, 'AI never calls with the room full');
  ok(!AI.condOk(e, sp, { id: 'tb_e_call', cond: { countBelow: 4 } }), 'cond countBelow');
  const e2 = mk({ mons: ['tb_rat_2'] });
  use(e2, Mo(e2, 0), 'tb_e_call_lower', null);
  ok(Mo(e2, 1) && Mo(e2, 1).id === 'tb_rat_1' && Mo(e2, 1).d.lv === 10, "'lower' calls the stage below, at the battle level");
  // a summoned goblin: EXP counts, it never drops
  const e3 = mk({ mons: ['tb_goblin'] });
  run(e3.summon(Mo(e3, 0), { mon: 'same', n: 1, max: 4 }));
  const sg = Mo(e3, 1);
  ok(sg && sg.summoned && sg.id === 'tb_goblin', 'summon same');
  run(e3.die(sg, P(e3, 0)));
  let sumDrops = 0;
  for (let i = 0; i < 400; i++) sumDrops += e3.computeRewards().drops.length;
  ok(sumDrops === 0 && e3.computeRewards().each[0].exp === 30, 'summoned monsters give EXP, never drops');
});

// ================================================================ rows, reach, techs, spells
sec('rows/reach/targeting');
guard('rows', () => {
  const e = mk({ mons: ['tb_goblin'] });
  const [hero, lancer, mage, archer] = e.party;
  ok(!e.slotReaches(hero, 'weapon1') && e.slotReaches(lancer, 'weapon1') && e.slotReaches(archer, 'weapon1') && e.slotReaches(mage, 'weapon1'), 'reach: sword front only; spear / bow / staff any (A19)');
  ok(e.attackIssue(mage, 'weapon1') === null && e.attackIssue(archer, 'weapon1') === null && e.attackIssue(hero, 'weapon1') === null, 'attackIssue: the staff reaches from the middle row (A19)');
  ok(e.unusable(mage, 'tb_t_mind', 'weapon1') === null, 'a reach:true staff tech from the middle row');
  const a2 = P(e, 3);
  a2.c.equip.weapon1 = 'tb_dagger'; a2.c.equip.weapon2 = null; a2.c.techs.push('tb_t_vital'); a2.refresh();
  ok(e.unusable(a2, 'tb_t_vital', 'weapon1') === 'reach', "a reach:false tech from the middle row → 'reach'");
  ok(e.attackIssue(a2, 'weapon1') === 'reach', "attackIssue: a dagger → 'reach' from the middle row");
  const ev = quiet(() => run(e.execute(a2, { type: 'attack', slot: 'weapon1', target: Mo(e, 0) })));
  ok(said(ev, 'シルヴァンは守りを固めている。') && a2.defending, 'an attack that cannot reach any more: guard instead');
  hero.c.hp = 0; lancer.c.hp = 0;
  ok(e.unusable(a2, 'tb_t_vital', 'weapon1') === null && e.attackIssue(a2, 'weapon1') === null, 'front row down → everyone counts as front');
  hero.c.hp = hero.mhp; lancer.c.hp = lancer.mhp;
  // monster targeting weights 2 : 1, aim middle 1 : 3, aim low
  const cnt = [0, 0, 0, 0], N = 30000;
  for (let i = 0; i < N; i++) cnt[AI.pickPartyTarget(e).idx]++;
  near(cnt[0] / N, 2 / 6, 0.012, 'front 2 : middle 1 (front member)');
  near(cnt[2] / N, 1 / 6, 0.012, 'front 2 : middle 1 (middle member)');
  const cm = [0, 0, 0, 0];
  for (let i = 0; i < N; i++) cm[AI.pickPartyTarget(e, 'middle').idx]++;
  near(cm[0] / N, 1 / 8, 0.012, "aim 'middle' 1 : 3 (front)");
  near(cm[3] / N, 3 / 8, 0.012, "aim 'middle' 1 : 3 (middle)");
  mage.c.hp = 5;
  ok(AI.pickPartyTarget(e, 'low') === mage, "aim 'low' → the lowest HP %");
  mage.c.hp = mage.mhp;
  hero.c.hp = 0; lancer.c.hp = 0;
  const c2 = [0, 0, 0, 0];
  for (let i = 0; i < 8000; i++) c2[AI.pickPartyTarget(e).idx]++;
  near(c2[2] / 8000, 0.5, 0.03, 'nobody in front: even weights');
  hero.c.hp = hero.mhp; lancer.c.hp = lancer.mhp;
  // targets()
  const e3 = mk({ mons: ['tb_slime', 'tb_slime', 'tb_goblin', 'tb_goblin', 'tb_bat'] });
  ok(Mo(e3, 0).name === 'テストゼリーＡ' && Mo(e3, 1).name === 'テストゼリーＢ' && Mo(e3, 4).name === 'テストコウモリ', 'duplicate species get letters Ａ, Ｂ');
  for (const m of e3.mons) { withD(m, { hp: 999 }); m.hp = m.mhp = 999; }
  ok(e3.targets(P(e3, 0), DB.actions.tb_t_wheel, Mo(e3, 2)).map((m) => m.name).join() === 'テスト小鬼Ａ,テスト小鬼Ｂ', "'group' = the chosen species");
  ok(e3.targets(P(e3, 0), DB.actions.tb_t_wind, null).length === 5, "'enemies' = all");
  P(e3, 3).mp = 99;
  let evr = use(e3, P(e3, 3), 'tb_t_rain', null, { slot: 'weapon1' });
  ok(count(evr, 'fx') === 4 && count(evr, 'dmg') + count(evr, 'miss') === 4, "'random': 4 hits on random foes");
  Mo(e3, 0).hp = 0;
  const rt = e3.targets(P(e3, 0), DB.actions.tb_t_cut, Mo(e3, 0))[0];
  ok(rt && rt.alive && rt === AI.focusOrder(e3, e3.pendingPlan())[0], 'a fallen single target → the focus-fire target');
  ok(e3.targets(P(e3, 2), DB.actions.tb_s_healall, null).length === 4, "'allies'");
  ok(e3.targets(P(e3, 2), { target: 'self' }, null)[0] === P(e3, 2), "'self'");
  P(e3, 0).c.hp = 0;
  ok(e3.targets(P(e3, 2), DB.actions.tb_s_revive, null)[0] === P(e3, 0), "'ally_dead' → a fallen ally");
  ok(e3.targets(P(e3, 2), { target: 'ally_any' }, P(e3, 0))[0] === P(e3, 0), "'ally_any' may pick the fallen");
  ok(e3.targets(P(e3, 2), { target: 'allies', effects: [{ type: 'revive' }] }, null).length === 4, "'allies' with revive includes the fallen");
  ok(e3.targets(P(e3, 2), { target: 'ally_other' }, P(e3, 2))[0] !== P(e3, 2), "'ally_other' never the user");
  ok(e3.targets(Mo(e3, 2), { target: 'group' }, P(e3, 1)).every((u) => u.isParty), 'a monster group action hits the party');
});

sec('techs/weapons');
guard('techs', () => {
  const e = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_dummy'] });
  const hero = P(e, 0), gob = Mo(e, 0);
  const mp0 = hero.mp;
  let ev = use(e, hero, 'tb_t_cut', gob, { slot: 'weapon1' });
  ok(said(ev, 'アルンのテスト斬り！') && hero.mp === mp0 - e.mpCost(hero, 'tb_t_cut') && e.mpCost(hero, 'tb_t_cut') === 2 && e.stats.techs.hero === 1, '「〜の〈技〉！」, MP paid (A18: techs pay MP)');
  hero.mp = 0;
  ev = use(e, hero, 'tb_t_cut', gob, { slot: 'weapon1' });
  ok(said(ev, 'しかしMPが足りない！') && e.unusable(hero, 'tb_t_cut', 'weapon1') === 'mp', 'not enough MP');
  hero.mp = hero.mmp;
  ok(e.unusable(hero, 'tb_t_up') === 'none' && e.unusable(hero, 'tb_t_up', 'weapon1') === 'none', 'a tech of a weapon type not equipped');
  equip(hero, 'acc1', 'tb_saver');
  ok(e.mpCost(hero, 'tb_t_wheel') === R.Rules.mpCost(hero.c, 'tb_t_wheel') && e.mpCost(hero, 'tb_t_wheel') === Math.round(DB.actions.tb_t_wheel.mp / 2), 'techCostPct −50 via R.Rules.mpCost');
  equip(hero, 'acc1', null);
  // two weapons: the tech uses the slot of its type
  equip(hero, 'weapon2', 'tb_dagger');
  hero.c.techs.push('tb_t_vital');
  ok(hero.attackSlots().join() === 'weapon1,weapon2' && hero.slotFor('dagger') === 'weapon2' && hero.slotFor('bow') === false, 'attack slots / slotFor');
  const Wd = hero.weapon('weapon2');
  const dctx = { act: DB.actions.tb_t_vital, kind: 'tech', slot: 'weapon2', W: Wd };
  const dv = mean(() => e.roll(hero, Mo(e, 2), Object.assign({}, DB.actions.tb_t_vital.effects[0], { sure: true }), dctx).dmg, 3000);
  near(dv, Wd.atk * 1.25 * 1.5, Wd.atk * 0.05, "the tech hits with its own slot's weapon (dagger atk)");
  ok(AI.abilityOptions(e, hero).some((o) => o.id === 'tb_t_vital' && o.slot === 'weapon2'), 'AI sees techs per slot');
  equip(hero, 'weapon2', null);
  // bare hands
  const bare = R.fxBattleChar('hero', 10, {}, 'front', []);
  const eb = mk({ party: [bare] });
  ok(P(eb, 0).attackSlots().join() === '' || P(eb, 0).attackSlots()[0] === null, 'bare hands: one 体術 command');
  ok(P(eb, 0).weapon(null).wtype === 'fist' && P(eb, 0).weapon(undefined).wtype === 'fist', 'fist W when both weapon slots are empty');
  // sealTech
  equip(hero, 'weapon1', 'tb_seal_axe');
  hero.c.techs.push('tb_t_reckless');
  ok(e.unusable(hero, 'tb_t_reckless', 'weapon1') === 'seal' && !AI.abilityOptions(e, hero).some((o) => o.id === 'tb_t_reckless'), 'sealTech weapon: no techs');
  equip(hero, 'weapon1', 'tb_sword');
  // multi-hit, fx again
  ev = use(e, hero, 'tb_t_twin', Mo(e, 2), { slot: 'weapon1' });
  ok(count(ev, 'dmg') + count(ev, 'miss') === 2 && count(ev, 'fx') === 2 && count(ev, 'fx', (x) => x.again) === 1, 'hits 2: two rolls');
  // hpCost
  const wx = mk({ mons: ['tb_dummy'] });
  const hx = P(wx, 0);
  hx.c.equip.weapon1 = 'tb_seal_axe'; hx.c.equip.shield = null; hx.refresh();
  hx.mp = 99;
  const h0 = hx.hp;
  run(wx.useAction(hx, 'tb_t_reckless', DB.actions.tb_t_reckless, Mo(wx, 0), { slot: 'weapon1' }));
  ok(hx.hp === h0 - Math.floor(hx.mhp * 0.1), 'hpCost: floor(max HP × 0.1)');
  hx.c.hp = 3; hx.mp = 99;
  run(wx.useAction(hx, 'tb_t_reckless', DB.actions.tb_t_reckless, Mo(wx, 0), { slot: 'weapon1' }));
  ok(hx.hp === 1, 'hpCost never kills');
  // drain (tech) and weapon drain, silent at full HP
  const dz = mk({ mons: ['tb_dummy'] });
  const fz = P(dz, 0);
  fz.c.equip.weapon1 = 'tb_claw'; fz.c.equip.shield = null; fz.c.techs.push('tb_t_drainfist'); fz.refresh();
  fz.mp = 99; fz.c.hp = 20;
  ev = use(dz, fz, 'tb_t_drainfist', Mo(dz, 0), { slot: 'weapon1' });
  const got = ev.filter((x) => x.t === 'dmg' && x.u === Mo(dz, 0)).reduce((s, x) => s + x.n, 0);
  ok(got === 0 || fz.hp === Math.min(fz.mhp, 20 + Math.round(got * 0.5)), 'drain 0.5 of the damage dealt');
  fz.c.hp = fz.mhp; fz.mp = 99;
  ev = use(dz, fz, 'tb_t_drainfist', Mo(dz, 0), { slot: 'weapon1' });
  ok(count(ev, 'heal') === 0, 'drain at full HP: silent');
  fz.c.equip.weapon1 = 'tb_katana'; fz.refresh(); fz.c.hp = 20;
  ev = run(dz.attack(fz, Mo(dz, 0), { slot: 'weapon1' }));
  const got2 = ev.filter((x) => x.t === 'dmg' && x.u === Mo(dz, 0)).reduce((s, x) => s + x.n, 0);
  ok(got2 === 0 || fz.hp === Math.min(fz.mhp, 20 + Math.round(got2 * 0.2)), 'weapon drain on a normal attack');
  // tech gating: a missed damage effect carries no status
  let gated = 0, landedSil = 0;
  for (let i = 0; i < 300; i++) {
    const x = mk({ mons: ['tb_goblin'] });
    const t = withD(Mo(x, 0), { eva: 200, hp: 9999 }); t.hp = t.mhp = 9999;
    const u = P(x, 0); u.c.techs.push('tb_t_seal'); u.mp = 99;
    const evs = run(x.useAction(u, 'tb_t_seal', DB.actions.tb_t_seal, t, { slot: 'weapon1' }));
    if (count(evs, 'miss') && !count(evs, 'dmg')) { if (t.status.silence) gated++; } else if (t.status.silence) landedSil++;
  }
  ok(gated === 0 && landedSil > 0, `a tech's status needs its damage to land (${gated} / ${landedSil})`);
  // spells are not gated
  const sx = mk({ mons: ['tb_goblin'] });
  P(sx, 2).mp = 99;
  let sl = 0;
  for (let i = 0; i < 100; i++) { Mo(sx, 0).status = {}; use(sx, P(sx, 2), 'tb_s_mute', Mo(sx, 0)); P(sx, 2).mp = 99; if (Mo(sx, 0).status.silence) sl++; }
  ok(sl > 80, 'a status spell rolls on its own');
  // weapon onHit: once per tech per target
  const ox = mk({ mons: ['tb_goblin'] });
  const ou = P(ox, 3);
  ou.c.equip.weapon1 = 'tb_venom_dagger'; ou.c.row = 'front'; ou.c.techs.push('tb_t_flurry'); ou.refresh();
  let most = 0, poisoned = 0;
  for (let i = 0; i < 200; i++) {
    const t = Mo(ox, 0); t.hp = t.mhp = 999; t.status = {}; t.turns = {};
    ou.mp = 99;
    const evs = use(ox, ou, 'tb_t_flurry', t, { slot: 'weapon1' });
    const n = count(evs, 'status', (x) => x.s === 'poison' && x.on);
    most = Math.max(most, n);
    if (n) poisoned++;
  }
  ok(most === 1 && poisoned > 120, `onHit: at most once per tech per target (${poisoned}/200)`);
  let aPois = 0;
  for (let i = 0; i < 100; i++) { const t = Mo(ox, 0); t.status = {}; t.hp = 999; run(ox.attack(ou, t, { slot: 'weapon1' })); if (t.status.poison) aPois++; }
  ok(aPois > 60, 'onHit on a normal attack');
  // monster onHit
  const vx = mk({ mons: ['tb_viper'] });
  let vp = 0;
  for (let i = 0; i < 100; i++) { P(vx, 1).status = {}; P(vx, 1).c.hp = P(vx, 1).mhp; run(vx.attack(Mo(vx, 0), P(vx, 1))); if (P(vx, 1).status.poison) vp++; }
  ok(vp > 50, 'monster onHit status');
  // quick techs act first
  const qx = mk({ mons: ['tb_goblin'] });
  withD(Mo(qx, 0), { agi: 9999 });
  const qev = quiet(() => run(qx.playRound([{ type: 'defend' }, { type: 'defend' }, { type: 'defend' }, { type: 'tech', id: 'tb_t_rapid', slot: 'weapon1', target: Mo(qx, 0) }])));
  const order = qev.filter((x) => x.t === 'actor' && x.u).map((x) => x.u.key);
  ok(order.indexOf('p3') < order.indexOf('m0') && order.indexOf('p0') < order.indexOf('m0'), 'defend / quick techs act before a much faster monster');
  // spells: mpCostPct, noSpell
  const mx = mk();
  const mg = P(mx, 2);
  equip(mg, 'acc1', 'tb_saver');
  ok(mx.mpCost(mg, 'tb_s_healall') === R.Rules.mpCost(mg.c, 'tb_s_healall') && mx.mpCost(mg, 'tb_s_healall') < DB.actions.tb_s_healall.mp, 'mpCostPct −50');
  equip(mg, 'acc1', 'tb_nospell');
  ok(mx.unusable(mg, 'tb_s_fire') === 'none' && !AI.abilityOptions(mx, mg).some((o) => o.type === 'spell'), 'noSpell');
  equip(mg, 'acc1', null);
  ok(mx.unusable(mg, 'tb_s_fire') === null, 'usable again');
});

// ================================================================ counters, cover, supports
sec('counter/cover/revive');
guard('counter', () => {
  const e = mk({ mons: ['tb_goblin'] });
  const hero = P(e, 0), mage = P(e, 2), gob = withD(Mo(e, 0), { hit: 999, crit: 0, hp: 9999 });
  gob.hp = gob.mhp = 9999;
  hero.mp = 99;
  let ev = use(e, hero, 'tb_t_guard', null, { slot: 'weapon1' });
  const st = hero.status.counter;
  ok(st && st.slot === 'weapon1' && st.power === 0.8 && st.parry === 0.35 && hero.turns.counter === 'next' && said(ev, 'アルンは反撃の構えをとった！'), 'counter stance with its slot, power, parry');
  let parried = 0, countered = 0, n = 0;
  for (let i = 0; i < 1500; i++) {
    hero.c.hp = hero.mhp; gob.hp = gob.mhp;
    const evs = run(e.attack(gob, hero)).concat(run(e.flushReactions()));
    n++;
    if (said(evs, 'アルンは攻撃を受け流した！')) parried++;
    if (said(evs, 'アルンの反撃！')) countered++;
  }
  near(parried / n, 0.35, 0.035, 'parry 35 %');
  ok(countered === n, 'every single physical attack is countered (once)');
  ev = run(e.hit(gob, hero, { dmg: 5 }, { kind: 'magic' })).concat(run(e.flushReactions()));
  ok(!said(ev, '反撃'), 'no counter on magic');
  ev = use(e, gob, 'tb_e_sweep', null).concat(run(e.flushReactions()));
  ok(!said(ev, 'アルンの反撃！'), 'no counter on an all-party attack');
  gob.hp = gob.mhp;
  ev = use(e, gob, 'tb_e_bite', hero).concat(run(e.flushReactions()));
  ok(said(ev, 'アルンの反撃！') || said(ev, '受け流した'), 'a single physical enemy action is countered');
  hero.status.sleep = true;
  ev = run(e.attack(gob, hero)).concat(run(e.flushReactions()));
  ok(!said(ev, '反撃') && !said(ev, '受け流した'), 'no counter while asleep');
  delete hero.status.sleep;
  ev = run(e.clearNext(hero));
  ok(!hero.status.counter && count(ev, 'status', (x) => x.s === 'counter' && !x.on) === 1, 'the stance ends at its next turn');
  // counter spell (no weapon data from a tech)
  mage.mp = 99;
  use(e, mage, 'tb_s_rock', null);
  ok(mage.status.counter && mage.status.counter.slot === 'weapon1' && mage.status.counter.power === 1, 'counter status from a spell: default slot, power 1');
  delete mage.status.counter;
  // autoCounter
  const lancer = P(e, 1);
  equip(lancer, 'acc1', 'tb_ring_counter');
  lancer.c.hp = lancer.mhp; gob.hp = gob.mhp;
  ev = run(e.attack(gob, lancer)).concat(run(e.flushReactions()));
  ok(said(ev, 'ブリギッタの反撃！') && count(ev, 'react', (x) => x.kind === 'counter') === 1, 'autoCounter 1: counters every physical attack');
  equip(lancer, 'acc1', null);
  // cover
  hero.mp = 99;
  ev = use(e, hero, 'tb_t_wall', null, { slot: 'weapon1' });
  ok(hero.status.cover && hero.status.cover.mul === 0.6 && hero.turns.cover === 'next' && said(ev, 'アルンは仲間の前に立ちはだかった！'), 'cover stance (mul 0.6)');
  mage.c.hp = mage.mhp; hero.c.hp = hero.mhp; gob.hp = gob.mhp;
  delete hero.status.counter;
  ev = run(e.attack(gob, mage));
  ok(said(ev, 'アルンはマルタをかばった！') && mage.hp === mage.mhp && hero.hp < hero.mhp && count(ev, 'cover') === 1, 'cover takes the single physical attack');
  const covered = mean(() => e.roll(gob, hero, SURE(), { coverMul: 0.6 }).dmg, 3000) / mean(() => e.roll(gob, hero, SURE(), {}).dmg, 3000);
  near(covered, 0.6, 0.02, 'covered damage × mul');
  ev = run(e.attack(gob, hero));
  ok(!said(ev, 'かばった'), 'the cover-er is not covered for itself');
  ev = use(e, gob, 'tb_e_bolt', mage);
  ok(!said(ev, 'かばった'), 'magic is not covered');
  hero.status.sleep = true;
  ev = run(e.attack(gob, mage));
  ok(!said(ev, 'かばった'), 'no cover while asleep');
  delete hero.status.sleep;
  // autoRevive once
  const p2 = R.fxBattleParty(10);
  p2[1].equip.acc1 = 'tb_feather';
  const e2 = mk({ party: p2 });
  const l2 = P(e2, 1);
  ev = run(e2.die(l2, Mo(e2, 0)));
  ok(l2.alive && l2.hp === Math.floor(l2.mhp * 0.5) && said(ev, 'ブリギッタは倒れた！') && said(ev, 'ブリギッタは立ち上がった！') && count(ev, 'revive') === 1, 'autoRevive: back at 50 %');
  ev = run(e2.die(l2, Mo(e2, 0)));
  ok(!l2.alive && !said(ev, '立ち上がった'), 'autoRevive: once per battle');
});

// ================================================================ §6.9.1-10 (techs' battle unit tests, A7.3)
sec('§6.9.1-10');
/** record every e.roll made while fn runs → [{att, tgt, ctx}] */
function spyRoll(e, fn) {
  const calls = [], orig = e.roll;
  e.roll = function (att, tgt, eff, ctx) { calls.push({ att, tgt, eff, ctx: ctx || {} }); return orig.apply(this, arguments); };
  try { fn(); } finally { e.roll = orig; }
  return calls;
}
guard('6.9.1-10', () => {
  // (1) 反撃の構え: the counter strikes with the weapon of the slot the stance was taken with
  const e = mk({ mons: ['tb_goblin'] });
  const hero = P(e, 0), mage = P(e, 2), gob = withD(Mo(e, 0), { hit: 999, crit: 0, hp: 9999 });
  gob.hp = gob.mhp = 9999;
  equip(hero, 'shield', null); equip(hero, 'weapon1', 'tb_dagger'); equip(hero, 'weapon2', 'tb_sword');
  ok(hero.weapon('weapon1').wtype === 'dagger' && hero.weapon('weapon2').wtype === 'sword', 'fixture: dagger in slot 1, sword in slot 2');
  hero.mp = 99;
  use(e, hero, 'tb_t_guard', null, { slot: 'weapon2' });
  ok(hero.status.counter && hero.status.counter.slot === 'weapon2', 'the stance remembers its slot (weapon 2)');
  let cev = [];
  const croll = spyRoll(e, () => { hero.c.hp = hero.mhp; cev = run(e.attack(gob, hero)).concat(run(e.flushReactions())); });
  const cc = croll.filter((x) => x.att === hero && x.ctx.attack);
  ok(cc.length === 1 && cc[0].ctx.slot === 'weapon2' && cc[0].ctx.W && cc[0].ctx.W.wtype === 'sword', `the counter uses the stance slot's weapon (${cc.map((x) => x.ctx.W && x.ctx.W.wtype).join()})`);
  ok(cc.length === 1 && cc[0].eff.power === 0.8, 'the counter uses the stance power (0.8)');
  ok(count(cev, 'fx', (x) => x.kind === 'counter' && x.fx === e.weaponFx(hero, 'weapon2')) === 1, "the counter's effect is weapon 2's");
  // (2) once per enemy action (a 2-hit action is one action), again on the next action
  gob.hp = gob.mhp; hero.c.hp = hero.mhp;
  let ev = use(e, gob, 'tb_e_double', hero).concat(run(e.flushReactions()));
  ok(count(ev, 'react', (x) => x.kind === 'counter' && x.u === hero) === 1, `a 2-hit enemy action: exactly one counter (${count(ev, 'react')})`);
  hero.c.hp = hero.mhp;
  ev = use(e, gob, 'tb_e_bite', hero).concat(run(e.flushReactions()));
  ok(count(ev, 'react', (x) => x.kind === 'counter' && x.u === hero) === 1, 'the next enemy action: one counter again');
  // (3) never against all-target actions or spells
  hero.c.hp = hero.mhp;
  ev = use(e, gob, 'tb_e_sweep', null).concat(run(e.flushReactions()));
  ok(count(ev, 'react') === 0, 'no counter on an all-party physical action');
  hero.c.hp = hero.mhp;
  ev = use(e, gob, 'tb_e_bolt', hero).concat(run(e.flushReactions()));
  ok(count(ev, 'react') === 0 && !said(ev, '受け流した'), 'no counter / parry on a spell');
  delete hero.status.counter; delete hero.turns.counter;
  equip(hero, 'weapon2', null); equip(hero, 'weapon1', 'tb_sword'); equip(hero, 'shield', 'tb_shield');

  // (4) かばう: the attack moves to the cover-er, its damage × mul (0.6), only for a single physical attack
  hero.mp = 99;
  use(e, hero, 'tb_t_wall', null, { slot: 'weapon1' });
  mage.c.hp = mage.mhp; hero.c.hp = hero.mhp;
  const cvr = spyRoll(e, () => { ev = run(e.attack(gob, mage)); });
  const cr = cvr.filter((x) => x.att === gob);
  ok(cr.length === 1 && cr[0].tgt === hero && cr[0].ctx.coverMul === 0.6, `covered: the roll is on the cover-er with coverMul 0.6 (${cr[0] && cr[0].ctx.coverMul})`);
  const ncv = spyRoll(e, () => { run(e.attack(gob, hero)); });
  ok(ncv.filter((x) => x.att === gob).every((x) => x.ctx.coverMul === 1), 'not covered: coverMul 1');
  const r06 = mean(() => e.roll(gob, hero, SURE(), { coverMul: 0.6 }).dmg, 3000) / mean(() => e.roll(gob, hero, SURE(), { coverMul: 1 }).dmg, 3000);
  near(r06, 0.6, 0.02, 'coverMul scales the damage');
  hero.c.hp = hero.mhp; mage.c.hp = mage.mhp;
  ev = use(e, gob, 'tb_e_sweep', null);
  ok(!said(ev, 'かばった'), 'an all-party action is not covered');
  delete hero.status.cover; delete hero.turns.cover;

  // (5) a tech's riders (status / 弱体) only when its damage lands
  let missBuff = 0, hitBuff = 0, hits = 0, misses = 0;
  for (let i = 0; i < 200; i++) {
    const x = mk({ mons: ['tb_goblin'] });
    const t = withD(Mo(x, 0), { eva: i % 2 ? 0 : 200, hp: 9999 }); t.hp = t.mhp = 9999;
    const u = P(x, 0); equip(u, 'shield', null); equip(u, 'weapon1', 'tb_whip'); u.c.techs.push('tb_t_trip'); u.mp = 99;
    const evs = quiet(() => use(x, u, 'tb_t_trip', t, { slot: 'weapon1' }));
    if (count(evs, 'dmg', (d) => d.u === t)) { hits++; if (t.buffs.agi === -1) hitBuff++; } else { misses++; if (t.buffs.agi !== 0) missBuff++; }
  }
  ok(misses > 20 && missBuff === 0, `a missed tech carries no 弱体 (${missBuff}/${misses})`);
  ok(hits > 20 && hitBuff >= hits * 0.9, `a landed tech carries its 弱体 (${hitBuff}/${hits})`);

  // (6) vs keyed by status ids (× only while the target has that status)
  const vx = mk({ mons: ['tb_goblin', 'tb_goblin'] });
  const vh = P(vx, 0), g1 = Mo(vx, 0), g2 = Mo(vx, 1);
  g1.status.poison = true; g1.turns.poison = 9;
  near(meanRoll(vx, vh, g1, SURE({ vs: { poison: 2 } }), { slot: 'weapon1' }) / meanRoll(vx, vh, g1, SURE(), { slot: 'weapon1' }), 2, 0.05, 'vs {poison: 2} on a poisoned foe × 2');
  near(meanRoll(vx, vh, g2, SURE({ vs: { poison: 2 } }), { slot: 'weapon1' }) / meanRoll(vx, vh, g2, SURE(), { slot: 'weapon1' }), 1, 0.04, 'vs {poison: 2} on a healthy foe × 1');

  // (7) dispel side:'good' from a tech: ups and every good status (regen, veil, counter, nimble, cover) go; downs and bad statuses stay
  const dx = mk({ mons: ['tb_goblin'] });
  const dg = Mo(dx, 0), dm = P(dx, 2);
  dg.buffs = { atk: 1, def: 2, mag: -1, mdef: 0, agi: 1 };
  for (const s of ['regen', 'veil', 'counter', 'nimble', 'cover']) { dg.status[s] = s === 'counter' ? { slot: null, power: 1, parry: 0 } : s === 'cover' ? { mul: 1 } : true; dg.turns[s] = 3; }
  dg.status.poison = true; dg.turns.poison = 3;
  dm.mp = 99;
  ev = use(dx, dm, 'tb_t_unward', dg, { slot: 'weapon1' });
  ok(dg.buffs.atk === 0 && dg.buffs.def === 0 && dg.buffs.agi === 0 && dg.buffs.mag === -1, "tech dispel 'good': ups cleared, downs kept");
  ok(['regen', 'veil', 'counter', 'nimble', 'cover'].every((s) => !dg.status[s]) && dg.status.poison, "tech dispel 'good': good statuses (incl. counter / cover) cleared, poison kept");
  ok(dm.mp === 99 - dx.mpCost(dm, 'tb_t_unward') && said(ev, '強化の効果が消えた'), 'the dispel tech paid its MP and said so');

  // (8) healMp pct from a tech: ceil(max MP × pct), at least 1
  const hx = mk();
  const hm = P(hx, 2), hs = P(hx, 3);
  hm.c.techs.push('tb_t_share'); hm.mp = 99; hs.mp = 0;
  use(hx, hm, 'tb_t_share', hs, { slot: 'weapon1' });
  ok(hs.mmp > 0 && hs.mp === Math.max(1, Math.ceil(hs.mmp * 0.2)), `healMp pct 0.2 → ceil(max × 0.2) (${hs.mp}/${hs.mmp})`);
  hs.mp = hs.mmp - 1;
  use(hx, hm, 'tb_t_share', hs, { slot: 'weapon1' });
  ok(hs.mp === hs.mmp, 'healMp stops at max MP');

  // (9) the weapon's onHit is rolled once per tech per target, even for 3 hits
  const ox = mk({ mons: ['tb_goblin'] });
  const ou = P(ox, 3);
  ou.c.equip.weapon1 = 'tb_venom_dagger'; ou.c.row = 'front'; ou.c.techs.push('tb_t_flurry'); ou.refresh();
  let maxRolls = 0, anyHit = 0;
  const inf0 = ox.inflict;
  let pr = 0;
  ox.inflict = function (u, t, s) { if (s === 'poison' && u === ou) pr++; return inf0.apply(this, arguments); };
  try {
    for (let i = 0; i < 60; i++) {
      const t = Mo(ox, 0); t.hp = t.mhp = 9999; t.status = {}; t.turns = {};
      ou.mp = 99; pr = 0;
      const evs = quiet(() => use(ox, ou, 'tb_t_flurry', t, { slot: 'weapon1' }));
      if (count(evs, 'dmg', (d) => d.u === t)) anyHit++;
      maxRolls = Math.max(maxRolls, pr);
    }
  } finally { ox.inflict = inf0; }
  ok(anyHit > 30 && maxRolls === 1, `onHit rolled at most once per tech (max ${maxRolls} over ${anyHit} landed)`);

  // (10) 'reach' and 'silence' make a tech unusable (and the AI does not offer it)
  const ux = mk({ mons: ['tb_goblin'] });
  const uh = P(ux, 0), um = P(ux, 2);
  uh.c.row = 'middle'; uh.refresh(); uh.mp = 99;
  ok(ux.effRow(uh) === 'middle' && ux.unusable(uh, 'tb_t_cut', 'weapon1') === 'reach', "a reach:false tech from the middle row → 'reach'");
  ok(!AI.abilityOptions(ux, uh).some((o) => o.id === 'tb_t_cut'), 'the AI does not offer it');
  const hp0 = Mo(ux, 0).hp;
  ev = quiet(() => use(ux, uh, 'tb_t_cut', Mo(ux, 0), { slot: 'weapon1' }));
  ok(Mo(ux, 0).hp === hp0 && count(ev, 'dmg') === 0 && uh.mp === 99 && said(ev, '後列からは届かない'), 'used anyway: refused, no damage, no MP');
  um.mp = 99; um.status.silence = true; um.turns.silence = 3;
  ok(ux.unusable(um, 'tb_t_mind', 'weapon1') === 'silence', "silenced: a staff (magic) tech → 'silence'");
  ok(!AI.abilityOptions(ux, um).some((o) => o.id === 'tb_t_mind'), 'the AI does not offer it while silenced');
  ok(ux.unusable(P(ux, 1), 'tb_t_up', 'weapon1') === null || ux.unusable(P(ux, 1), 'tb_t_up', 'weapon1') === undefined, 'a non-magic tech of a front-row fighter is usable');
});

// ================================================================ monsters & rounds
sec('monster AI');
guard('monster AI', () => {
  const e = mk({ mons: ['tb_boss', 'tb_healer', 'tb_goblin'] });
  const boss = Mo(e, 0), healer = Mo(e, 1), gob = Mo(e, 2);
  const u = boss;
  // conds
  ok(AI.condOk(e, u, { id: 'x', cond: { hpBelow: 0.5 } }) === false && (u.hp = 1, AI.condOk(e, u, { id: 'x', cond: { hpBelow: 0.5 } })), 'hpBelow');
  u.hp = u.mhp;
  ok(!AI.condOk(e, u, { id: 'x', cond: { hpAbove: 1 } }) && AI.condOk(e, u, { id: 'x', cond: { hpAbove: 0.5 } }), 'hpAbove');
  u.acts = 2;
  ok(AI.condOk(e, u, { id: 'x', cond: { every: [3, 2] } }) && !AI.condOk(e, u, { id: 'x', cond: { every: [3, 1] } }), 'every [n, k]');
  u.used.tb_e_harden = true;
  ok(!AI.condOk(e, u, { id: 'tb_e_harden', cond: { once: true } }), 'once');
  delete u.used.tb_e_harden;
  e.round = 2;
  ok(!AI.condOk(e, u, { id: 'x', cond: { round: 3 } }) && AI.condOk(e, u, { id: 'x', cond: { round: 2 } }), 'round');
  ok(!AI.condOk(e, u, { id: 'x', cond: { alone: true } }), 'alone');
  ok(!AI.condOk(e, u, { id: 'x', cond: { allyDown: true } }), 'allyDown (nobody down)');
  // weights (w 0 never), once
  const picks = {};
  for (let i = 0; i < 3000; i++) { const c = AI.monster(e, boss); const k = c.id || c.type; picks[k] = (picks[k] || 0) + 1; }
  ok(!picks.tb_e_call && picks.attack > picks.tb_e_sweep && picks.tb_e_sweep > (picks.tb_e_harden || 0), `weights (${JSON.stringify(picks)})`);
  const hc = AI.monster(e, boss);
  boss.used.tb_e_harden = true;
  let again = 0;
  for (let i = 0; i < 300; i++) if (AI.monster(e, boss).id === 'tb_e_harden') again++;
  ok(again === 0 && hc, 'once: never again');
  // pointless buff / heal skipped
  delete boss.used.tb_e_harden;
  boss.buffs.def = 2;
  ok(AI.monCommand(e, boss, 'tb_e_harden') === null, 'a +2 stat is not buffed again');
  boss.buffs.def = 0;
  // healer heals the hurt ally, revives the fallen
  gob.hp = 5;
  let heals = 0;
  for (let i = 0; i < 300; i++) { const c = AI.monster(e, healer); if (c.id === 'tb_e_heal_ally') { heals++; if (c.target !== gob) ok(false, 'heals the most hurt'); } }
  ok(heals > 200, `healer heals (${heals}/300)`);
  gob.hp = gob.mhp;
  for (let i = 0; i < 100; i++) { const c = AI.monster(e, healer); if (c.id === 'tb_e_heal_ally' || c.id === 'tb_e_revive') { ok(false, 'no pointless heal / revive'); break; } }
  run(e.die(gob, P(e, 0)));
  let revs = 0;
  for (let i = 0; i < 200; i++) { const c = AI.monster(e, healer); if (c.id === 'tb_e_revive') { revs++; if (c.target !== gob) ok(false, 'revives the fallen'); } }
  ok(revs > 60, 'allyDown → revive');
  const rev = use(e, healer, 'tb_e_revive', gob);
  ok(gob.alive && gob.hp === Math.floor(gob.mhp * 0.5) && !e.killed.includes(gob) && said(rev, 'テスト小鬼は生き返った！'), 'monster revive takes it off the kill list');
  // self heal skipped when healthy
  gob.hp = gob.mhp;
  ok(AI.monCommand(e, gob, 'tb_e_heal_self') === null, 'healthy: no self heal');
  gob.hp = 3;
  ok(AI.monCommand(e, gob, 'tb_e_heal_self').target === gob, 'hurt: self heal');
  // boss phases
  const e2 = mk({ mons: ['tb_boss'] });
  const b2 = Mo(e2, 0);
  const d0 = DB.monsters.tb_boss;
  b2.hp = Math.floor(b2.mhp * 0.6);
  let ev = run(e2.hit(P(e2, 0), b2, { dmg: Math.floor(b2.mhp * 0.2) }, { kind: 'phys' }));
  ev = ev.concat(run(e2.afterAction()));
  ok(count(ev, 'phase', (x) => x.text === 'テスト魔王の体が燃え上がった！' && x.sprite === 'tb_boss2') === 1, 'phase at hpBelow 0.5 (event with text and sprite)');
  ok(b2.actsPerTurn() === 3 && b2.d.elem.fire === 0.25 && b2.d.elem.light === 1.5 && b2.buffs.atk === 1 && b2.d.sprite === 'tb_boss2', 'phase set: acts, elem merge, buffs, sprite');
  ok(d0.actsPerTurn === 2 && d0.elem.fire === 1.5 && R.Mon.def('tb_boss', { Lb: 10 }).elem.fire === 1.5, 'DB and the def cache untouched');
  run(e2.hit(P(e2, 0), b2, { dmg: 1 }, { kind: 'phys' }));
  ok(count(run(e2.afterAction()), 'phase') === 0, 'each phase once');
  const e3 = mk({ mons: ['tb_boss'] });
  quiet(() => {
    const evs = run(e3.playRound([{ type: 'defend' }, { type: 'defend' }, { type: 'defend' }, { type: 'defend' }]));
    ok(count(evs, 'actor', (x) => x.u === Mo(e3, 0)) === 2, 'region boss: 2 actions per round');
  });
  // monster flee (rare), bosses never flee
  const e4 = mk({ mons: ['tb_rare'] });
  e4.round = 1;
  ok(mean(() => (e4.monFlees(Mo(e4, 0)) ? 1 : 0), 500) === 0, 'rare: no flight in round 1');
  e4.round = 2;
  near(mean(() => (e4.monFlees(Mo(e4, 0)) ? 1 : 0), 6000), 0.25, 0.02, 'rare: 25 % from round 2');
  ok(!e4.monFlees(Mo(e3, 0)), 'bosses never flee');
  ev = use(e4, Mo(e4, 0), 'tb_e_flee', null);
  ok(Mo(e4, 0).gone && said(ev, 'テスト宝石ウサギは逃げ出した！') && count(ev, 'flee') === 1 && e4.checkEnd() === 'win', "a monster's escape effect");
  ok(AI.monCommand(e3, Mo(e3, 0), 'flee') === null, 'a boss never chooses to flee');
  // messages of enemy actions
  const e5 = mk({ mons: ['tb_goblin'] });
  ev = use(e5, Mo(e5, 0), 'tb_e_breath', null);
  ok(said(ev, 'テスト小鬼は炎を吐いた！') && count(ev, 'dmg') === 4, 'custom msg, all 4 members');
  ev = quiet(() => run(e5.execute(Mo(e5, 0), { type: 'wait' })));
  ok(said(ev, 'テスト小鬼はじっとこちらを見ている。'), '「〜はじっとこちらを見ている。」');
});

sec('rounds/order/defend');
guard('rounds', () => quiet(() => {
  const e = mk({ mons: ['tb_goblin', 'tb_goblin'] });
  run(e.begin());
  const ev = run(e.playRound([{ type: 'attack', slot: 'weapon1', target: Mo(e, 0) }, { type: 'defend' }, { type: 'spell', id: 'tb_s_fire', target: Mo(e, 1) }, { type: 'attack', slot: 'weapon1', target: Mo(e, 1) }]));
  const actors = ev.filter((x) => x.t === 'actor' && x.u).map((x) => x.u.key);
  ok(actors[0] === 'p1', 'defend first');
  ok(said(ev, 'ブリギッタは守りを固めている。'), '「〜は守りを固めている。」');
  ok(new Set(actors).size === actors.length && actors.length >= 4, 'everyone acts once');
  ok(!P(e, 1).defending && e.round === 1, 'defend lasts the round');
  // speed order: a much faster monster acts first
  let first = 0;
  for (let i = 0; i < 200; i++) {
    const f = mk({ mons: ['tb_goblin'] });
    withD(Mo(f, 0), { agi: 999, atk: 0 });
    const ev2 = run(f.playRound([{ type: 'attack', slot: 'weapon1', target: Mo(f, 0) }]));
    if (ev2.find((x) => x.t === 'actor' && x.u).u.key === 'm0') first++;
  }
  ok(first === 200, 'speed × rand(0.75, 1) order');
  // agi stage in the order
  let early = 0;
  for (let i = 0; i < 400; i++) {
    const f = mk({ mons: ['tb_goblin'] });
    withD(Mo(f, 0), { agi: Math.round(P(f, 0).stat('spd') * 1.25), atk: 0 });
    P(f, 0).buffs.agi = 2;
    const ev3 = run(f.playRound([{ type: 'attack', slot: 'weapon1', target: Mo(f, 0) }]));
    const a = ev3.filter((x) => x.t === 'actor' && x.u).map((x) => x.u.key);
    if (a.indexOf('p0') < a.indexOf('m0')) early++;
  }
  ok(early > 300, `agi +2 speeds up the turn (${early}/400)`);
  // wipe / win
  const w = mk({ mons: ['tb_goblin'] });
  for (const p of w.party) run(w.die(p, null));
  ok(w.checkEnd() === 'lose', 'everyone down → lose');
  const v = mk({ mons: ['tb_goblin'] });
  run(v.die(Mo(v, 0), P(v, 0)));
  ok(v.checkEnd() === 'win', 'every monster down → win');
  // members who were not given a command (revived this round) only do upkeep
  const r = mk({ mons: ['tb_goblin'] });
  r.round = 1;
  P(r, 0).status.poison = true;
  const e2 = run(r.turn(P(r, 0), null));
  ok(said(e2, '毒でアルンに') && !said(e2, 'アルンの攻撃！'), 'no command: upkeep only');
}));

sec('escape/preempt');
guard('escape', () => {
  const e = mk({ mons: ['tb_goblin'] });
  const E = B.K('ESCAPE');
  const avg = (l) => l.reduce((s, u) => s + u.stat('spd'), 0) / l.length;
  const ap = avg(e.party), am = avg(e.mons);
  near(e.escapeChance(), U.clamp(E.base + E.agi * (ap - am) / (ap + am), E.min, E.max), 1e-9, 'escape = 0.55 + 0.5 × (ap − am)/(ap + am)');
  e.escapeFails = 2;
  near(e.escapeChance(), U.clamp(E.base + 2 * E.step + E.agi * (ap - am) / (ap + am), E.min, E.max), 1e-9, '+0.12 per failure');
  e.escapeFails = 0;
  const slow = mk({ mons: ['tb_goblin'] });
  withD(Mo(slow, 0), { agi: 9999 });
  ok(Math.abs(slow.escapeChance() - E.min) < 1e-9, 'min 0.25');
  const p2 = R.fxBattleParty(10);
  p2[0].equip.acc1 = 'tb_lucky';
  const lucky = mk({ party: p2, mons: ['tb_goblin'] });
  near(lucky.escapeChance(), Math.min(1, e.escapeChance() * 1.5), 1e-9, 'escapePct +50');
  let esc = 0;
  quiet(() => { for (let i = 0; i < 600; i++) { const x = mk({ mons: ['tb_goblin'] }); run(x.playRound(Object.assign([], { flee: true }))); if (x.result === 'escape') esc++; } });
  near(esc / 600, e.escapeChance(), 0.06, 'escape rate');
  const okEv = quiet(() => { for (let i = 0; i < 50; i++) { const x = mk({ mons: ['tb_goblin'] }); const evs = run(x.playRound(Object.assign([], { flee: true }))); if (x.result === 'escape') return evs; } return []; });
  ok(said(okEv, '{hero}たちは逃げ出した。') && count(okEv, 'escape', (x) => x.ok) === 1, '「{hero}たちは逃げ出した。」');
  let failOk = false;
  quiet(() => {
    for (let i = 0; i < 60 && !failOk; i++) {
      const x = mk({ mons: ['tb_goblin'] });
      const evs = run(x.playRound(Object.assign([], { flee: true })));
      if (x.result) continue;
      failOk = said(evs, 'しかし行く手をふさがれた！') && evs.some((q) => q.t === 'actor' && q.u && !q.u.isParty) && !evs.some((q) => q.t === 'actor' && q.u && q.u.isParty) && x.escapeFails === 1;
    }
  });
  ok(failOk, 'failed escape: the monsters act, the party does not');
  const b = mk({ mons: ['tb_boss'] });
  const bev = run(b.playRound(Object.assign([], { flee: true })));
  ok(!b.result && said(bev, 'この戦いからは逃げられない！') && b.noEscape, 'bosses: no escape');
  const ne = mk({ mons: ['tb_goblin'], noEscape: true });
  ne.inv.tb_smoke = 1;
  ok(ne.unusable(P(ne, 0), 'tb_smoke') === 'noescape' && B.isEscape(DB.items.tb_smoke.use), "an escape item where there is no escape → 'noescape'");
  const sm = mk({ mons: ['tb_goblin'], inv: { tb_smoke: 1 } });
  const smev = use(sm, P(sm, 0), 'tb_smoke', null, { item: true });
  ok(sm.result === 'escape' && count(smev, 'escape', (x) => x.ok) === 1, 'escape item: sure');
  // preempt
  const pre = mk({ mons: ['tb_goblin'], surprise: 'pre', noSurprise: false });
  let ev = run(pre.begin());
  ok(said(ev, '魔物たちは、まだこちらに気づいていない。\n先手を取った！'), 'preempt line');
  ev = quiet(() => run(pre.playRound([{ type: 'defend' }, { type: 'defend' }, { type: 'defend' }, { type: 'defend' }])));
  ok(!ev.some((x) => x.t === 'actor' && x.u && !x.u.isParty), 'preempt: the monsters skip round 1');
  const pre2 = mk({ mons: ['tb_goblin'], surprise: 'pre', noSurprise: false });
  run(pre2.begin());
  withD(Mo(pre2, 0), { agi: 9999 });
  run(pre2.playRound(Object.assign([], { flee: true })));
  ok(pre2.result === 'escape', 'preempt round: escape is sure');
  const pc = mk({ mons: ['tb_goblin'] }).preemptChance();
  const pa = avg(mk().party), ma = mk({ mons: ['tb_goblin'] }).mons[0].stat('spd');
  near(pc, (1 / 16) * U.clamp(pa / ma, 0.5, 2), 1e-9, 'preempt = 1/16 × clamp(spd ratio, 0.5, 2)');
  let pr = 0;
  for (let i = 0; i < 8000; i++) { const x = mk({ mons: ['tb_goblin'], noSurprise: false }); run(x.begin()); if (x.surprise === 'pre') pr++; }
  near(pr / 8000, pc, 0.008, 'preempt rate');
  const lp = mk({ party: p2, mons: ['tb_goblin'] });
  near(lp.preemptChance(), pc + 0.3, 1e-9, 'preemptPct +30 (cap 30)');
  let bossPre = 0;
  for (let i = 0; i < 300; i++) { const x = mk({ mons: ['tb_boss'], noSurprise: false }); run(x.begin()); if (x.surprise) bossPre++; }
  ok(bossPre === 0, 'no preempt against bosses');
  ok(!('ambush' in B) && !said(run(mk({ mons: ['tb_goblin'], surprise: 'ambush', noSurprise: false }).begin()), 'いきなり'), 'no ambushes (§4.11.2)');
});

// ================================================================ rewards
sec('rewards');
guard('rewards', () => {
  const party = R.fxBattleParty(10);
  const reserve = [R.fxBattleChar('tb_archer', 10, { weapon1: 'tb_bow' }, 'middle', [])];
  reserve[0].name = 'ロルフ';
  const e = mk({ party, reserve, mons: ['tb_goblin', 'tb_goblin'] });
  run(e.begin());
  for (const m of e.mons) run(e.die(m, P(e, 0)));
  run(e.die(P(e, 3), null));
  const rw = e.computeRewards();
  ok(rw.each[0].exp === 60 && rw.each[3].exp === Math.round(60 * 0.6) && rw.bench[0].exp === Math.round(60 * 0.6), 'EXP Σ exp × f(0); a fallen member and the reserve 60 %');
  ok(rw.gold === 40, 'gold Σ');
  const bexp0 = reserve[0].exp;
  U.seed(77);
  const ev = run(e.rewards());
  const tx = texts(ev);
  ok(ev[0].t === 'victory' && tx[0] === '魔物たちを倒した！', 'victory first');
  ok(said(ev, 'アルンは60の経験値を得た！') && said(ev, 'シルヴァンは36の経験値を得た！'), 'per-member EXP lines when they differ');
  ok(said(ev, '40ゴールドを手に入れた！'), 'gold line');
  ok(tx.indexOf('40ゴールドを手に入れた！') > tx.indexOf('アルンは60の経験値を得た！'), 'EXP before gold');
  ok(said(ev, '控えの仲間も経験値を得た。') && reserve[0].exp === bexp0 + 36 && tx[tx.length - 1] === '控えの仲間も経験値を得た。', 'the reserve line last');
  // same EXP → one line
  const e2 = mk({ mons: ['tb_goblin'] });
  run(e2.die(Mo(e2, 0), P(e2, 0)));
  ok(said(run(e2.rewards()), 'それぞれ30の経験値を得た！'), '「それぞれ30の経験値を得た！」');
  // falloff f(d)
  const mixed = [R.fxBattleChar('hero', 12, { weapon1: 'tb_sword' }, 'front', []), R.fxBattleChar('tb_lancer', 8, { weapon1: 'tb_spear' }, 'front', []), R.fxBattleChar('tb_mage', 30, { weapon1: 'tb_staff' }, 'middle', [])];
  const e3 = mk({ party: mixed, mons: ['tb_goblin'] });
  run(e3.die(Mo(e3, 0), P(e3, 0)));
  const r3 = e3.computeRewards();
  ok(r3.each[0].exp === Math.round(30 * Math.pow(0.75, 2)) && r3.each[1].exp === Math.round(30 * 1.2) && r3.each[2].exp === Math.max(1, Math.round(30 * 0.03)), 'falloff: 0.75^d above, +10 %/level below, floor 3 %, min 1');
  // expPct, goldPct
  const p4 = R.fxBattleParty(10);
  p4[0].equip.acc1 = 'tb_exp'; p4[1].equip.acc1 = 'tb_lucky';
  const e4 = mk({ party: p4, mons: ['tb_goblin'] });
  run(e4.die(Mo(e4, 0), P(e4, 0)));
  const r4 = e4.computeRewards();
  ok(r4.each[0].exp === Math.round(30 * 1.3) && r4.each[1].exp === 30, 'expPct per member');
  ok(r4.gold === 40, 'goldPct +100 (party-wide)');
  // level up: one jingle, lines
  const low = R.fxBattleParty(1);
  const e5 = mk({ party: low, mons: ['tb_boss'], lv: 20 });
  run(e5.die(Mo(e5, 0), P(e5, 0)));
  const ev5 = run(e5.rewards());
  ok(count(ev5, 'jingle', (x) => x.id === 'levelup') === 1 && count(ev5, 'levelup') === 4, 'one levelup jingle for the whole party');
  const lu = ev5.find((x) => x.t === 'levelup');
  ok(said(ev5, `アルンはレベル${P(e5, 0).c.level}に上がった！`) && lu.c === P(e5, 0).c && lu.level === P(e5, 0).c.level && lu.gains.hp > 0, 'level line + event');
  ok(texts(ev5).some((t) => /^最大HP\+\d+(　最大MP\+\d+)?(　最大WP\+\d+)?$/.test(t)), 'gains line 「最大HP+x　最大MP+y　最大WP+z」');
  ok(ev5.findIndex((x) => x.t === 'jingle') < ev5.findIndex((x) => x.t === 'levelup'), 'the jingle before the first level line');
  ok(P(e5, 0).mhp > R.Rules.stats(R.fxBattleChar('hero', 1, { weapon1: 'tb_sword', shield: 'tb_shield', body: 'tb_mail', head: 'tb_helm' })).hp, 'units refreshed after the level up');
  // boss drops: certain pool + bonus, order, items to the bag
  const drops = ev5.filter((x) => x.t === 'drop');
  ok(drops.length >= 1 && drops[drops.length - 1].item === 'tb_seed' && e5.inv.tb_seed >= 1, 'boss bonus drop');
  const poolDrop = drops.find((x) => x.slot === 'normal' && x.item !== 'tb_seed');
  ok(poolDrop || said(ev5, '500ゴールドを手に入れた！'), 'boss pool drop (item or gold)');
  // drop lines, rare line, full bag
  const e6 = mk({ mons: ['tb_goblin'] });
  run(e6.die(Mo(e6, 0), P(e6, 0)));
  const saved = R.Mon.rollDrops;
  R.Mon.rollDrops = () => [{ item: 'tb_salve', n: 1, grade: 'normal', slot: 'normal' }, { item: 'tb_rare_charm', n: 1, grade: 'rare', slot: 'rare' }, { item: 'tb_sr_blade', n: 1, grade: 'super', slot: 'super' }];
  const ev6 = run(e6.rewards());
  R.Mon.rollDrops = saved;
  const d6 = ev6.filter((x) => x.t === 'drop');
  ok(d6.map((x) => x.grade).join() === 'normal,rare,super' && d6.every((x) => x.mon === 'tb_goblin' && x.name === 'テスト小鬼'), 'drop events: normal → rare → super, mon + name');
  ok(said(ev6, 'テスト小鬼はテスト傷薬を残していった！') && said(ev6, 'テスト小鬼は★テストのお守りを残していった！') && said(ev6, 'レアアイテムだ！') && said(ev6, 'テスト小鬼は★テスト一品の剣を残していった！') && said(ev6, '超レアアイテムだ！'), 'drop lines (★ for rare / super)');
  ok(e6.inv.tb_salve === 1 && e6.inv.tb_rare_charm === 1 && e6.inv.tb_sr_blade === 1, 'drops in the bag');
  const e7 = mk({ mons: ['tb_goblin'], inv: { tb_salve: 99 } });
  run(e7.die(Mo(e7, 0), P(e7, 0)));
  R.Mon.rollDrops = () => [{ item: 'tb_salve', n: 1, grade: 'normal', slot: 'normal' }];
  const ev7 = run(e7.rewards());
  R.Mon.rollDrops = saved;
  ok(said(ev7, 'これ以上は持てない。') && e7.inv.tb_salve === 99 && !ev7.some((x) => x.t === 'drop'), 'full stack: not obtained');
  // drop statistics through the engine (kill order, mods of the living)
  let dn = 0, dr = 0;
  for (let i = 0; i < 6000; i++) {
    const x = mk({ mons: ['tb_goblin'] });
    run(x.die(x.mons[0], null));
    const r = x.computeRewards();
    if (r.drops.some((q) => q.grade === 'normal')) dn++;
    if (r.drops.some((q) => q.grade === 'rare')) dr++;
  }
  near(dn / 6000, 1 / 8, 0.012, 'normal drop 1/8');
  near(dr / 6000, 1 / 32, 0.007, 'rare drop 1/32');
  const lucky = R.fxBattleParty(10);
  lucky[0].equip.acc1 = 'tb_lucky';
  let lr = 0;
  for (let i = 0; i < 6000; i++) { const x = mk({ party: lucky, mons: ['tb_goblin'] }); run(x.die(x.mons[0], null)); if (x.computeRewards().drops.some((q) => q.grade === 'rare')) lr++; }
  near(lr / 6000, 2.5 / 32, 0.012, 'rarePct +150 → × 2.5');
  // everything fled
  const e8 = mk({ mons: ['tb_rare'] });
  Mo(e8, 0).gone = true;
  const ev8 = run(e8.rewards());
  ok(e8.checkEnd() === 'win' && said(ev8, '魔物たちはいなくなった。') && !ev8.some((x) => x.t === 'victory'), 'all fled: no victory');
  // after-battle recovery
  const e9 = mk({ mons: ['tb_goblin'], after: true });
  const [h9, l9] = e9.party;
  h9.c.hp = 5; h9.mp = 0; h9.wp = 0; run(e9.die(l9, null));
  run(e9.die(Mo(e9, 0), h9));
  e9.checkEnd();
  e9.finish();
  ok(h9.hp === h9.mhp && h9.mp === Math.ceil(h9.mmp * 0.1) && h9.wp === Math.ceil(h9.mwp * 0.1) && l9.hp === 0, 'win: HP full, MP/WP +10 % (rounded up); the fallen stay down');
  const e10 = mk({ mons: ['tb_goblin'], after: true });
  P(e10, 0).c.hp = 5; P(e10, 0).mp = 0; e10.result = 'escape';
  e10.finish();
  ok(P(e10, 0).hp === P(e10, 0).mhp && P(e10, 0).mp === 0, 'escape: HP full only');
  ok(Object.keys(P(e10, 0).c.status).length === 0, 'statuses never outlive the battle');
});

// ================================================================ golden / rare / metal / setup
sec('golden/rare/setup');
guard('golden', () => {
  const e = mk({ mons: [{ id: 'tb_goblin', golden: true }, 'tb_goblin', 'tb_goblin'] });
  const g = Mo(e, 0);
  ok(g.golden && g.name === '金色のテスト小鬼' && g.hp === DB.monsters.tb_goblin.hp * 2 && g.species !== Mo(e, 1).species, 'golden unit: own species key, own name');
  ok(Mo(e, 1).name === 'テスト小鬼Ａ' && Mo(e, 2).name === 'テスト小鬼Ｂ', 'the others lettered apart');
  const ev = run(e.begin());
  const gi = ev.findIndex((x) => x.t === 'golden');
  ok(gi >= 0 && ev[gi].u === g && texts(ev)[0] === '金色のテスト小鬼が現れた！' && said(ev, 'テスト小鬼が2匹現れた！'), 'golden event, then 「金色の〇〇が現れた！」, then the others');
  ok(e.golden && e.ef === 1.5, 'EF 1.5 for a golden battle');
  const r = mk({ mons: ['tb_rare'] });
  const rev = run(r.begin());
  ok(texts(rev)[0] === 'テスト宝石ウサギが現れた！' && texts(rev)[1] === 'テスト宝石ウサギは額の宝石をきらりと光らせた！', "rare: the usual line, then its own 'appear' line");
  ok(r.rare && r.ef === 2, 'rare: EF 2');
  // resolveMonsters: tiers, levels, rare swap, golden
  const T = (o) => B.resolveMonsters(o, { mods: {} });
  const z = T({ zone: 'tb_zone', tier: 2, noRare: true, noGolden: true });
  ok(z.kind === 'zone' && z.Tb === 2 && z.Lb === 6 + 12 + 1 && z.mons.every((m) => ['tb_rat_2', 'tb_goblin'].includes(m.id)), 'zone: Tb = tier (dyn), Lb = LZ(Tb) + lvOff');
  const z0 = T({ zone: 'tb_zone', tier: 0, noRare: true, noGolden: true });
  ok(z0.mons.every((m) => ['tb_rat_1', 'tb_slime'].includes(m.id)), 'zone at T0: T0 groups only');
  const pro = T({ zone: 'tb_zone_pro', noRare: true, noGolden: true });
  ok(pro.Tb === 0 && pro.Lb >= 2 && pro.Lb <= 4, 'fixed-tier zone with lv [2, 4]');
  const bt = T({ troop: 'tb_troop_boss', tier: 3 });
  ok(bt.kind === 'troop' && bt.Tb === 3 && bt.Lb === 6 + 18 + 3 && bt.mons.map((m) => m.id).join() === 'tb_minion,tb_boss,tb_minion', "troop scale:'tier': Lb = LZ(T) + lvOff, order kept");
  const ft = T({ troop: 'tb_troop_fixed', tier: 5 });
  ok(ft.Tb === 2 && ft.Lb === 6 + 12 + 1, 'a troop with its own tier keeps it');
  ok(T({ zone: 'tb_zone_pro', tier: 5, noRare: true }).Tb === 0, 'a fixed-tier zone keeps its tier');
  const tt = T({ troop: 'tb_troop_tut' });
  ok(tt.Tb === 0 && tt.Lb === 2, 'troop with a fixed lv');
  const rr = T({ zone: 'tb_zone', tier: 2, rare: 'force' });
  ok(rr.rare && rr.mons.length === 1 && rr.mons[0].id === 'tb_rare' && rr.Lb === 19 + 2, 'rare swap: alone, Lb + 2');
  let rc = 0;
  for (let i = 0; i < 40000; i++) if (T({ zone: 'tb_zone', tier: 2, noGolden: true }).rare) rc++;
  near(rc / 40000, 1 / 80, 0.002, 'rare swap 1/80');
  let rc2 = 0;
  for (let i = 0; i < 20000; i++) if (B.resolveMonsters({ zone: 'tb_zone', tier: 2, noGolden: true }, { mods: { rareEncPct: 100 } }).rare) rc2++;
  near(rc2 / 20000, 2 / 80, 0.004, 'rareEncPct +100 → × 2');
  const gz = T({ zone: 'tb_zone_metal', tier: 2, golden: 'force', noRare: true });
  ok(gz.mons.every((m) => !m.golden), 'no golden metal even when forced');
  const gz2 = T({ zone: 'tb_zone', tier: 1, golden: 'force', noRare: true });
  ok(gz2.golden && gz2.mons.filter((m) => m.golden).length === 1, "golden 'force'");
  ok(T({ troop: 'tb_troop_fixed', golden: 'force' }).golden === false, 'troops never roll golden');
  ok(T({ mons: [['tb_goblin', 2]], tier: 4 }).Lb === 30, 'mons: Lb = LZ(Tb)');
  // the engine scales every monster to Lb
  const es = new B.Engine(Object.assign({ party: R.fxBattleParty(20) }, BASE, { mons: ['tb_rat_1', 'tb_goblin'], lv: 25, tier: 3 }));
  ok(es.mons.every((m) => m.d.lv === 25) && Mo(es, 1).hp === R.Mon.def('tb_goblin', { Lb: 25 }).hp && es.dk === 40 + 5 * 25, 'one Lb for the whole battle (DK from it)');
  // setup (needs R.Game)
  const G0 = R.Game;
  R.Game = { party: R.fxBattleParty(10), reserve: [], inv: {}, gold: 0, tier: 2, flags: {}, records: {}, book: { mon: {}, tech: {}, spell: {} } };
  try {
    const s1 = B.setup({ zone: 'tb_zone', tier: 2, rare: false, golden: false });
    ok(s1 && s1.eng && s1.bgm === 'battle' && s1.kind === 'zone' && s1.bg === 'grass', 'setup: zone → battle BGM, zone bg');
    const s2 = B.setup({ troop: 'tb_troop_boss', tier: 2 });
    ok(s2.bgm === 'boss' && s2.eng.noEscape && s2.bg === 'castle' && !s2.autoStart, 'setup: troop → its bgm / bg, no escape, manual start');
    const s3 = B.setup({ zone: 'tb_zone', tier: 2, rare: 'force' });
    ok(s3.rare && s3.bgm === 'rarebattle' && !s3.autoStart, 'setup: rare → rarebattle, manual start');
    const s4 = B.setup({ zone: 'tb_zone_metal', tier: 2, rare: false });
    ok(s4.metal && s4.bgm === 'rarebattle', 'setup: metal → rarebattle');
    const s5 = B.setup({ zone: 'tb_zone', tier: 2, members: ['hero', 'tb_mage'], rare: false });
    ok(s5.eng.party.length === 2 && s5.eng.bench.length === 2, 'setup: members fight, the rest share as the reserve');
    const saveAuto = B.autoCarry, saveS = R.Settings;
    R.Settings = Object.assign({}, R.Settings || {}, { autoKeep: true });
    B.autoCarry = true;
    ok(B.setup({ zone: 'tb_zone', tier: 2, rare: false, noGolden: true }).autoStart, 'オート carries into the next ordinary zone battle');
    ok(!B.setup({ zone: 'tb_zone', tier: 2, canLose: true, rare: false }).autoStart, '…not into canLose battles');
    B.autoCarry = false;
    ok(!B.setup({ zone: 'tb_zone', tier: 2, rare: false }).autoStart, 'no carry-over when the last battle was manual');
    B.autoCarry = saveAuto; R.Settings = saveS;
    const bm = B.buildMons({ zone: 'tb_zone', tier: 2 });
    ok(Array.isArray(bm) && bm.meta && bm.meta.Tb === 2 && bm.meta.Lb >= 19, 'buildMons (compat) carries Tb / Lb');
  } finally { R.Game = G0; }
});

// ================================================================ glimmer hook
sec('glimmer');
guard('glimmer', () => {
  // a mock roll: replaces the attack for free, event + line, learned
  let seen = null;
  const e = mk({ mons: ['tb_goblin', 'tb_goblin'] });
  const hero = P(e, 0), gob = Mo(e, 0);
  withD(gob, { hp: 9999 }); gob.hp = gob.mhp = 9999;
  const wp0 = hero.wp;
  let ev = withGlimmer((c, ctx) => { seen = ctx; return c.id === 'hero' ? { id: 'tb_t_twin', kind: 'tech' } : null; }, () => run(e.execute(hero, { type: 'attack', slot: 'weapon1', target: gob })));
  ok(seen && seen.kind === 'tech' && seen.wtype === 'sword' && seen.used === 'attack' && seen.rankB === e.rankB && seen.ef === e.ef && seen.tier === 2 && seen.row === 'front' && seen.silenced === false && seen.force === false && seen.fallbackWtype === 'sword', 'ctx for R.Glimmer.roll (§4.9.2)');
  const gi = ev.findIndex((x) => x.t === 'glimmer');
  ok(gi >= 0 && ev[gi].id === 'tb_t_twin' && ev[gi].kind === 'tech' && texts(ev.slice(gi))[0] === 'アルンはテスト二連を閃いた！', 'glimmer event, then 「〜は〈技名〉を閃いた！」');
  ok(hero.c.techs.includes('tb_t_twin') && e.glimmers.length === 1 && e.glimmers[0].char === 'hero', 'learned (a clone only in simulations)');
  ok(said(ev, 'アルンのテスト二連！') && !said(ev, 'アルンの攻撃！') && hero.wp === wp0 && ev.some((x) => x.t === 'dmg' && x.u === gob), 'replaces the attack at no WP, same target');
  // spells: replaced for free; nothing to act on → learned, the original goes ahead
  const mage = P(e, 2);
  const mp0 = mage.mp;
  ev = withGlimmer((c) => (c.id === 'tb_mage' ? { id: 'tb_s_fireall', kind: 'spell' } : null), () => run(e.execute(mage, { type: 'spell', id: 'tb_s_fire', target: gob })));
  ok(said(ev, 'マルタはテスト火の粉を閃いた！') && said(ev, 'マルタはテスト火の粉を唱えた！') && mage.mp === mp0, 'a glimmered spell is cast for free');
  const mp1 = mage.mp;
  ev = withGlimmer((c) => (c.id === 'tb_mage' ? { id: 'tb_s_raise', kind: 'spell' } : null), () => run(e.execute(mage, { type: 'spell', id: 'tb_s_fire', target: gob })));
  ok(mage.c.spells.includes('tb_s_raise') && said(ev, 'マルタはテスト呼び戻しを閃いた！') && said(ev, 'マルタはテスト火の矢を唱えた！'), 'nothing for the new spell to act on (蘇生, nobody down): learnt, the original spell runs');
  ok(mage.mp === mp1 - e.mpCost(mage, 'tb_s_fire'), '…and the original is paid for');
  // 魔石: spell ctx with stone
  e.inv.tb_stone_fire = 1;
  withGlimmer((c, ctx) => { seen = ctx; return null; }, () => run(e.execute(P(e, 1), { type: 'item', id: 'tb_stone_fire', target: gob })));
  ok(seen.kind === 'spell' && seen.stone === true && seen.elements.join() === 'fire', '魔石: a spell roll with stone:true');
  // no roll: confused, unreachable, items, defend
  let rolls = 0;
  const count1 = () => { rolls++; return null; };
  withGlimmer(count1, () => {
    run(e.execute(mage, { type: 'attack', slot: 'weapon1', target: gob })); // staff from the middle: cannot reach → no roll
    run(e.execute(hero, { type: 'defend' }));
    e.inv.tb_salve = 1; run(e.execute(hero, { type: 'item', id: 'tb_salve', target: hero }));
  });
  ok(rolls === 0, 'no roll for an unreachable attack, 防御, ordinary items');
  withGlimmer(count1, () => run(e.execute(hero, { type: 'attack', slot: 'weapon1', target: gob })));
  ok(rolls === 1, 'one roll per action');
  // train info
  const savedTrain = R.Rules.train;
  const infos = [];
  R.Rules.train = (c, info) => { infos.push(info); return info.kind === 'attack' ? [{ kind: 'w', id: 'sword', rank: 3 }] : []; };
  try {
    ev = quiet(() => run(e.execute(hero, { type: 'attack', slot: 'weapon1', target: gob })));
    quiet(() => run(e.execute(mage, { type: 'spell', id: 'tb_s_fire', target: gob })));
    e.inv.tb_stone_fire = 1;
    quiet(() => run(e.execute(P(e, 1), { type: 'item', id: 'tb_stone_fire', target: gob })));
  } finally { R.Rules.train = savedTrain; }
  ok(infos[0].kind === 'attack' && infos[0].slot === 'weapon1' && infos[0].wtype === 'sword' && infos[0].actionId === 'attack' && infos[0].tier === 2 && infos[0].mon && infos[0].mon.lv === 10, 'R.Rules.train after 攻撃');
  ok(infos[1].kind === 'spell' && infos[1].elements.join() === 'fire' && infos[1].actionId === 'tb_s_fire', 'R.Rules.train after a spell');
  ok(infos[2].stone === true && infos[2].elements.join() === 'fire', 'R.Rules.train after a 魔石');
  ok(count(ev, 'prof', (x) => x.u === hero && x.kind === 'w' && x.id === 'sword' && x.rank === 3) === 1 && e.profUps.length >= 1, "{t:'prof'} for every rank up");
  // glimmerForce 'hero' with the real R.Glimmer: the first action of the hero, whatever it is
  const ef = mk({ mons: ['tb_goblin'], glimmerForce: 'hero' });
  const h = P(ef, 0);
  const known = h.c.techs.length;
  ev = run(ef.execute(h, { type: 'defend' }));
  const g = ev.find((x) => x.t === 'glimmer');
  ok(g && g.u === h && DB.actions[g.id].kind === 'tech' && DB.actions[g.id].wtype === 'sword' && h.c.techs.length === known + 1, 'glimmerForce: 防御 still glimmers a sword tech');
  ev = run(ef.execute(h, { type: 'defend' }));
  ok(!ev.some((x) => x.t === 'glimmer') && said(ev, 'アルンは守りを固めている。'), 'glimmerForce: only the first action');
  ev = run(ef.execute(P(ef, 1), { type: 'defend' }));
  ok(!ev.some((x) => x.t === 'glimmer'), 'glimmerForce: the hero only');
  // simulate learns on its clones only
  const party = R.fxBattleParty(10);
  const before = JSON.stringify(party);
  B.simulate({ party, mons: [['tb_goblin', 2]], glimmerForce: 'hero', seed: 5, tier: 2 });
  ok(JSON.stringify(party) === before, 'simulate never touches the given party');
});

// ================================================================ リピート (§11.5.3a)
sec('repeat R1-R6');
guard('repeat', () => {
  const e = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_slime'], inv: { tb_salve: 1 } });
  run(e.begin());
  const [hero, lancer, mage, archer] = e.party;
  for (const m of e.mons) { withD(m, { hp: 500 }); m.hp = m.mhp = 500; }
  mage.mp = mage.mmp; hero.wp = hero.mwp;
  hero.c.hp = Math.floor(hero.mhp / 2);
  const prev = [];
  prev[0] = { type: 'tech', id: 'tb_t_cut', slot: 'weapon1', target: Mo(e, 0) };
  prev[1] = { type: 'attack', slot: 'weapon1', target: Mo(e, 1) };
  prev[2] = { type: 'spell', id: 'tb_s_heal', target: hero };
  prev[3] = { type: 'defend' };
  let r = e.repeatCommands(prev);
  ok(r[0].type === 'tech' && r[0].id === 'tb_t_cut' && r[0].slot === 'weapon1' && r[0].target === Mo(e, 0), 'R1: the same tech, slot, target');
  ok(r[1].type === 'attack' && r[1].slot === 'weapon1' && r[1].target === Mo(e, 1), 'R1: the same attack');
  ok(r[2].type === 'spell' && r[2].id === 'tb_s_heal' && r[2].target === hero, 'R1: the same heal');
  ok(r[3].type === 'defend', 'R1: 防御');
  // R2: fallen target → the focus target
  run(e.die(Mo(e, 0), hero));
  r = e.repeatCommands(prev);
  ok(r[0].id === 'tb_t_cut' && r[0].target && r[0].target.alive && !r[0].target.isParty, 'R2: a single-target tech goes to a living foe');
  const focus = AI.focusOrder(e, AI.newPlan())[0];
  const r2 = e.repeatCommands([{ type: 'attack', slot: 'weapon1', target: Mo(e, 0) }, { type: 'attack', slot: 'weapon1', target: Mo(e, 0) }]);
  ok(r2[0].target === focus && r2[1].target && r2[1].target.alive, 'R2: 攻撃 on a fallen foe → the focus-fire target');
  // heal target: the most hurt now
  lancer.c.hp = 5;
  r = e.repeatCommands(prev);
  ok(r[2].target === lancer, 'a repeated heal goes to the most hurt ally');
  lancer.c.hp = lancer.mhp;
  // R3: WP / MP / silence / reach → 攻撃 (防御 when nothing reaches)
  hero.wp = 0;
  r = e.repeatCommands(prev);
  ok(r[0].type === 'attack' && r[0].slot === 'weapon1', 'R3: no WP → 攻撃');
  hero.wp = hero.mwp;
  mage.mp = 0;
  r = e.repeatCommands(prev);
  ok(r[2].type === 'defend', 'R3: no MP → 攻撃, and the staff cannot reach from the middle → 防御');
  mage.mp = mage.mmp;
  mage.status.silence = true;
  r = e.repeatCommands([undefined, undefined, { type: 'spell', id: 'tb_s_heal', target: hero }, { type: 'tech', id: 'tb_t_rapid', slot: 'weapon1', target: Mo(e, 1) }]);
  ok(r[2].type === 'defend' && r[3].type === 'tech', 'R3: silence');
  delete mage.status.silence;
  archer.c.equip.weapon1 = 'tb_dagger'; archer.c.techs.push('tb_t_vital'); archer.refresh();
  r = e.repeatCommands([undefined, undefined, undefined, { type: 'tech', id: 'tb_t_vital', slot: 'weapon1', target: Mo(e, 1) }]);
  ok(r[3].type === 'defend', 'R3: a tech that cannot reach from the middle → 防御 (nothing reaches)');
  archer.c.equip.weapon1 = 'tb_bow'; archer.refresh();
  // R4: items (reserved across members)
  const pi = { type: 'item', id: 'tb_salve', target: hero };
  r = e.repeatCommands([pi, pi, undefined, pi]);
  ok(r.filter((c) => c && c.type === 'item').length === 1 && r[1].type === 'attack', 'R4: one salve left → one item use, the others 攻撃');
  e.inv.tb_salve = 0;
  r = e.repeatCommands([pi]);
  ok(r[0].type === 'attack', 'R4: none left → 攻撃');
  const eb = mk({ mons: ['tb_boss'], inv: { tb_smoke: 2 } });
  r = eb.repeatCommands([{ type: 'item', id: 'tb_smoke', target: null }]);
  ok(r[0].type === 'attack', 'R4: an escape item in a no-escape battle → 攻撃');
  // R5: flee is not in the commands (the scene never stores it); repeatCommands ignores a flee flag
  const fl = Object.assign([], { flee: true });
  r = e.repeatCommands(fl);
  ok(!r.flee && r.filter(Boolean).every((c) => c.type === 'attack' || c.type === 'defend'), 'R5: 逃げる is never repeated');
  // R6: no previous command → 攻撃 (defend when nothing reaches)
  r = e.repeatCommands([undefined, undefined, undefined, undefined]);
  ok(r[0].type === 'attack' && r[3].type === 'attack' && r[2].type === 'defend', 'R6: did not act → 攻撃 (the staff in the middle → 防御)');
  // repeated attack whose slot cannot reach any more → 防御
  r = e.repeatCommands([undefined, undefined, { type: 'attack', slot: 'weapon1', target: Mo(e, 1) }]);
  ok(r[2].type === 'defend', 'a repeated 攻撃 that cannot reach → 防御');
  // revive: nobody down → 攻撃; ally_any keeps the old target
  r = e.repeatCommands([undefined, undefined, { type: 'spell', id: 'tb_s_revive', target: hero }]);
  ok(r[2].type === 'defend' || r[2].type === 'attack', 'nothing to revive → 攻撃 (防御 here)');
  run(e.die(lancer, null));
  r = e.repeatCommands([undefined, undefined, { type: 'spell', id: 'tb_s_revive', target: hero }]);
  ok(r[2].type === 'spell' && r[2].target === lancer, 'revive → the fallen');
  ok(r[1] === undefined, 'a fallen member gets no command');
  // asleep: no command
  hero.status.sleep = true;
  r = e.repeatCommands(prev);
  ok(r[0] === undefined, 'a member who cannot act gets no command');
  delete hero.status.sleep;
  // a repeated round plays out
  const e2 = mk({ mons: ['tb_goblin', 'tb_goblin'] });
  run(e2.begin());
  const c1 = [{ type: 'attack', slot: 'weapon1', target: Mo(e2, 0) }, { type: 'attack', slot: 'weapon1', target: Mo(e2, 0) }, { type: 'defend' }, { type: 'attack', slot: 'weapon1', target: Mo(e2, 1) }];
  quiet(() => { run(e2.playRound(c1)); for (let i = 0; i < 6 && !e2.result; i++) run(e2.playRound(e2.repeatCommands(c1))); });
  ok(e2.result === 'win', 'repeating rounds finish the fight');
});

// ================================================================ live battles
sec('live');
guard('live', () => {
  const G0 = R.Game;
  R.State.newGame();
  const G = R.Game;
  G.party = R.fxBattleParty(10);
  G.reserve = [];
  G.inv = { tb_salve: 3 };
  G.gold = 100;
  try {
    const e = new B.Engine({ party: G.party, mons: ['tb_goblin', 'tb_goblin', 'tb_slime', { id: 'tb_bat', golden: true }], inv: G.inv, live: true, noSurprise: true, lv: 10, tier: 2 });
    run(e.begin());
    ok(G.book.mon.tb_goblin.seen === 1 && G.book.mon.tb_slime.seen === 1, 'seen once per species per battle');
    let got = false;
    for (let i = 0; i < 60 && !got; i++) { e.mons[0].stolen = false; run(e.steal(P(e, 3), e.mons[0])); got = !!G.book.mon.tb_goblin.stole; }
    ok(got && (G.book.mon.tb_goblin.drop || G.book.mon.tb_goblin.rare), 'a steal fills the bestiary slot');
    run(e.scan(e.mons[2]));
    ok(G.book.mon.tb_slime.scan, 'scan noted');
    const salve0 = G.inv.tb_salve;
    run(e.useAction(P(e, 0), 'tb_salve', DB.items.tb_salve.use, P(e, 0), { item: DB.items.tb_salve }));
    ok(G.inv.tb_salve === salve0 - 1, 'items come out of R.Game.inv');
    const thief = new B.MonUnit('tb_thief', 9, e);
    const g0 = G.gold;
    const tev = run(e.steal(thief, P(e, 0)));
    ok(G.gold === g0 - Math.min(g0, thief.level * 5) && said(tev, `{hero}たちは${Math.min(g0, thief.level * 5)}ゴールドを盗まれた！`), 'monster thieves take gold in real battles');
    for (const m of e.mons) run(e.die(m, P(e, 0)));
    e.checkEnd();
    const gold0 = G.gold;
    const rev = run(e.rewards());
    e.finish();
    ok(G.gold > gold0, 'gold to R.Game');
    ok(G.book.mon.tb_goblin.kills === 2 && G.book.mon.tb_bat.kills === 1 && G.book.mon.tb_bat.gold === 1, 'kills and golden kills recorded');
    ok(G.records.goldens === 1, 'records.goldens counted once');
    ok(B.last && B.last.result === 'win' && B.last.killed.length === 4 && B.last.gold === e.gold && Array.isArray(B.last.drops), 'R.Battle.last');
    ok(G.party.every((c) => c.counts.battles === 1), 'counts.battles once (R.Party.afterBattle)');
    ok(G.party.every((c) => c.hp === R.Rules.stats(c).hp), 'after-battle recovery done by finish()');
    e.finish();
    ok(G.party.every((c) => c.counts.battles === 1), 'finish runs once');
    ok(rev.some((x) => x.t === 'victory'), 'victory');
    // members: only the fighters count a battle
    const e2 = new B.Engine({ party: G.party.slice(0, 2), mons: ['tb_goblin'], inv: G.inv, live: true, noSurprise: true, lv: 10, tier: 2 });
    run(e2.die(Mo(e2, 0), P(e2, 0)));
    e2.checkEnd(); run(e2.rewards()); e2.finish();
    ok(G.party[0].counts.battles === 2 && G.party[3].counts.battles === 1, 'a members battle counts for its members only');
  } finally { R.Game = G0; }
});

// ================================================================ party AI
sec('party AI');
guard('party AI', () => quiet(() => {
  // weak foes: plain attacks, no MP / WP beyond the one glimmer-aim spell
  const e = mk({ mons: ['tb_slime', 'tb_slime'] });
  run(e.begin());
  const cmds = AI.partyCommands(e, AI.AUTO_OPTS);
  ok(cmds.filter((c) => c && c.type === 'tech').length === 0 && cmds.filter((c) => c && c.type === 'spell').length <= 1, 'mobs: attacks, no WP (one glimmer-aim cast at most)');
  ok(cmds[2].type === 'spell' || cmds[2].type === 'defend', 'the mage in the middle (staff): casts once or guards');
  const again = AI.partyCommands(e, AI.AUTO_OPTS);
  ok(again[2].type !== 'spell' || !DB.actions[again[2].id].mp || DB.actions[again[2].id].effects.some((x) => x.type === 'heal'), '(d): once per battle');
  // (d) glimmer aim needs ≥ 50 % MP
  const e1 = mk({ mons: ['tb_slime', 'tb_slime'] });
  P(e1, 2).mp = Math.floor(P(e1, 2).mmp * 0.4);
  ok(AI.partyCommands(e1, AI.AUTO_OPTS)[2].type !== 'spell', '(d) not below 50 % MP');
  // heal / revive / cure / items
  const e2 = mk({ mons: ['tb_boss'] });
  P(e2, 0).c.hp = 5;
  let c2 = AI.partyCommands(e2, AI.AUTO_OPTS);
  ok(c2[2].type === 'spell' && DB.actions[c2[2].id].effects.some((x) => x.type === 'heal') && (c2[2].target === P(e2, 0) || DB.actions[c2[2].id].target === 'allies'), 'the healer heals the ally in danger');
  run(e2.die(P(e2, 0), null));
  c2 = AI.partyCommands(e2, AI.AUTO_OPTS);
  ok(c2[2].id === 'tb_s_revive' && c2[2].target === P(e2, 0), 'the healer revives');
  P(e2, 0).c.hp = P(e2, 0).mhp;
  P(e2, 2).mp = 0;
  e2.inv.tb_salve = 2; e2.inv.tb_rare_potion = 3;
  P(e2, 1).c.hp = 3;
  c2 = AI.partyCommands(e2, AI.AUTO_OPTS);
  ok(c2.some((c) => c && c.type === 'item' && c.id === 'tb_salve' && c.target === P(e2, 1)), 'nobody can heal: a healing item for someone below 25 %');
  ok(!c2.some((c) => c && c.id === 'tb_rare_potion'), 'never rare items');
  P(e2, 1).c.hp = P(e2, 1).mhp;
  P(e2, 3).status.sleep = true; P(e2, 3).turns.sleep = 3;
  e2.inv.tb_waker = 1;
  c2 = AI.partyCommands(e2, AI.AUTO_OPTS);
  ok(c2.some((c) => c && c.type === 'item' && c.id === 'tb_waker' && c.target === P(e2, 3)) && !c2[3], 'cure an asleep ally; the sleeper gets nothing');
  delete P(e2, 3).status.sleep;
  e2.inv = {};
  ok(!AI.partyCommands(e2, Object.assign({}, AI.AUTO_OPTS, { items: false })).some((c) => c && c.type === 'item'), 'items: false');
  // boss: dispel a buffed boss, spend freely, keep one heal
  const e3 = mk({ mons: ['tb_boss'] });
  P(e3, 2).mp = 99; P(e3, 2).c.techs.push('tb_t_unward');
  Mo(e3, 0).buffs.def = 2;
  const c3 = AI.partyCommands(e3, AI.AUTO_OPTS);
  ok(c3.some((c) => c && c.id === 'tb_t_unward' && c.target === Mo(e3, 0)), 'dispels a boss with 守備力 up');
  // thrift in a trivial fight
  const e4 = mk({ party: R.fxBattleParty(30), mons: ['tb_goblin', 'tb_goblin'] });
  let spent = 0, hunt = 0;
  for (let i = 0; i < 20; i++) {
    for (const c of AI.partyCommands(e4, AI.AUTO_OPTS)) {
      if (!c || c.type !== 'tech') continue;
      // (d) 閃きねらい: the middle-row staff's reach tech (its 攻撃 cannot reach) is the one allowed exception (§4.13.2)
      if (c.id === 'tb_t_mind' && e4.effRow(P(e4, 2)) === 'middle') hunt++; else spent++;
    }
  }
  ok(spent === 0, `thrift: no WP on a trivial group (${spent})`);
  ok(hunt <= AI.GLIM_REACH.perBattle, `thrift: the reach tech of (d) at most ${AI.GLIM_REACH.perBattle} a fight (${hunt})`);
  // focus fire
  const e5 = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_goblin'] });
  for (const m of e5.mons) { withD(m, { hp: 500 }); m.hp = m.mhp = 500; }
  for (const p of e5.party) { p.mp = 0; }
  const c5 = AI.partyCommands(e5, AI.AUTO_OPTS);
  const tg = c5.filter((c) => c && c.type === 'attack').map((c) => c.target);
  ok(tg.length >= 2 && tg.every((t) => t === tg[0]), 'focus fire: every attack on one target');
  const e6 = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_goblin'] });
  for (const m of e6.mons) { withD(m, { hp: 500 }); m.hp = m.mhp = 500; }
  Mo(e6, 2).hp = 200;
  ok(AI.focusOrder(e6, AI.newPlan())[0] === Mo(e6, 2), 'focus order: the lowest HP first at equal threat');
  const e7 = mk({ mons: ['tb_goblin', 'tb_caster'] });
  for (const m of e7.mons) { withD(m, { hp: 300 }); m.hp = m.mhp = 300; }
  withD(Mo(e7, 1), { mag: 80 });
  ok(AI.focusOrder(e7, AI.newPlan())[0] === Mo(e7, 1) && AI.threat(e7, Mo(e7, 1)) > AI.threat(e7, Mo(e7, 0)), 'focus order: the bigger threat first at equal HP');
  const e8 = mk({ mons: ['tb_goblin', 'tb_goblin'] });
  const d0 = e8.expectAttack(P(e8, 0), Mo(e8, 0), 'weapon1');
  Mo(e8, 0).hp = Math.max(1, Math.floor(d0 * 0.8)); withD(Mo(e8, 1), { hp: 900 }); Mo(e8, 1).hp = Mo(e8, 1).mhp = 900;
  const c8 = AI.partyCommands(e8, AI.AUTO_OPTS);
  const onWeak = c8.filter((c) => c && c.type === 'attack' && c.target === Mo(e8, 0)).length;
  ok(onWeak === 1, `85 % cover: one attacker on the nearly dead foe (${onWeak})`);
  // mid-round retarget follows the focus order
  const e9 = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_goblin'] });
  for (const m of e9.mons) { withD(m, { hp: 500 }); m.hp = m.mhp = 500; }
  Mo(e9, 1).hp = 120; run(e9.die(Mo(e9, 0), null));
  const picks = new Set();
  for (let i = 0; i < 20; i++) picks.add(e9.pickFoe(P(e9, 0), Mo(e9, 0)));
  ok(picks.size === 1 && picks.has(Mo(e9, 1)), 'retarget: always the focus target');
  // group spells on a tough pack (no thrift)
  let grp = 0;
  for (let i = 0; i < 20; i++) {
    const x = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_goblin', 'tb_goblin'] });
    for (const m of x.mons) { withD(m, { hp: 300 }); m.hp = m.mhp = 300; }
    P(x, 2).c.spells.push('tb_s_fireall'); P(x, 2).mp = 99;
    const c = AI.partyCommands(x, { thrift: false, items: false });
    if (c[2] && c[2].type === 'spell' && ['enemies', 'group', 'random'].includes(DB.actions[c[2].id].target)) grp++;
  }
  ok(grp >= 15, `an all-foes spell on a tough pack (${grp}/20)`);
  // noAuto techs never chosen
  const e10 = mk({ mons: ['tb_goblin'] });
  const a10 = P(e10, 3);
  a10.c.equip.weapon1 = 'tb_dagger'; a10.c.row = 'front'; a10.c.techs.push('tb_t_filch'); a10.refresh();
  ok(!AI.abilityOptions(e10, a10).some((o) => o.id === 'tb_t_filch'), 'noAuto techs are not auto options');
  // percent techs never on mobs
  const e11 = mk({ mons: ['tb_goblin', 'tb_goblin'] });
  P(e11, 2).c.spells.push('tb_s_gravity'); P(e11, 2).mp = 99;
  let pc = 0;
  for (let i = 0; i < 20; i++) { const c = AI.partyCommands(e11, AI.AUTO_OPTS); if (c[2] && c[2].id === 'tb_s_gravity') pc++; }
  ok(pc === 0, 'no percent spells on mobs');
  // the glimmer slot: in mob fights the attack uses a slot with open candidates
  ok(typeof AI.glimSlot === 'function' && typeof AI.candidatesOpen === 'function', 'glimmer aim helpers');
  // D8 (§4.13.2-d): a middle-row staff (its 攻撃 cannot reach) hunts glimmers with its cheapest reach tech before weapon 2
  const mkHunt = (o) => {
    const x = mk(Object.assign({ mons: ['tb_goblin', 'tb_goblin'] }, o || {}));
    for (const m of x.mons) { withD(m, { hp: 400 }); m.hp = m.mhp = 400; }
    const mg = P(x, 2);
    equip(mg, 'weapon2', 'tb_whip');
    mg.wp = mg.mwp; mg.mp = 0;
    return x;
  };
  const h1 = mkHunt(), mg1 = P(h1, 2);
  const open1 = AI.candidatesOpen(h1, mg1, { kind: 'tech', wtype: 'staff', rankB: h1.rankB, ef: h1.ef, tier: h1.glimTier, row: 'middle', silenced: false, used: 'tb_t_mind' });
  ok(h1.effRow(mg1) === 'middle' && !h1.canReach(mg1, 'weapon1') && h1.canReach(mg1, 'weapon2'), 'D8 fixture: the staff cannot reach, the whip can');
  const r1 = AI.glimReach(h1, mg1, AI.abilityOptions(h1, mg1));
  ok(open1 && (r1 && r1.o.id === 'tb_t_mind' && r1.slot === 'weapon1'), `D8: glimReach → the staff slot's reach tech (${r1 && r1.o.id})`);
  const hc = AI.partyCommands(h1, AI.AUTO_OPTS)[2];
  ok(open1 && (hc && hc.type === 'tech' && hc.id === 'tb_t_mind' && hc.slot === 'weapon1'), `D8: the auto mage uses 念じ打ち, not the whip's 攻撃 (${hc && (hc.id || hc.type + ':' + hc.slot)})`);
  const hc2 = AI.partyCommands(h1, AI.AUTO_OPTS)[2];
  const hc3 = AI.partyCommands(h1, AI.AUTO_OPTS)[2];
  ok(AI.GLIM_REACH.perBattle !== 2 || (hc2 && hc2.id === 'tb_t_mind' && hc3 && hc3.type === 'attack' && hc3.slot === 'weapon2'), `D8: at most ${AI.GLIM_REACH.perBattle} a fight, then the whip (${hc3 && (hc3.id || hc3.type + ':' + hc3.slot)})`);
  const h2 = mkHunt(); P(h2, 2).wp = Math.floor(P(h2, 2).mwp * 0.4);
  const hc4 = AI.partyCommands(h2, AI.AUTO_OPTS)[2];
  ok(hc4 && hc4.type === 'attack' && hc4.slot === 'weapon2', `D8: WP below half → the whip's 攻撃 (${hc4 && (hc4.id || hc4.type)})`);
  const h3 = mkHunt({ mons: ['tb_boss'] });
  ok(AI.glimReach(h3, P(h3, 2), AI.abilityOptions(h3, P(h3, 2))) === null, 'D8: not in boss fights (WP is spent on the best action there)');
  const h4 = mkHunt(); P(h4, 2).c.row = 'front'; P(h4, 2).refresh();
  ok(AI.glimReach(h4, P(h4, 2), AI.abilityOptions(h4, P(h4, 2))) === null, 'D8: a front-row staff attacks normally');
}));

// ================================================================ simulate
sec('simulate');
guard('simulate', () => {
  const party = R.fxBattleParty(10);
  const snap = JSON.stringify(party);
  const a = B.simulate({ party, mons: [['tb_goblin', 3]], seed: 42, tier: 2 });
  const b = B.simulate({ party, mons: [['tb_goblin', 3]], seed: 42, tier: 2 });
  ok(JSON.stringify(party) === snap, 'the given party is untouched');
  const strip = (x) => JSON.stringify(Object.assign({}, x, { party: null, reserve: null, inv: null }));
  ok(a.result === 'win' && strip(a) === strip(b), 'deterministic with a seed');
  ok(['rounds', 'partyHpPct', 'partyMpPct', 'partyWpPct', 'hpLossPct', 'deaths', 'damageDealt', 'damageTaken', 'mpUsed', 'wpUsed', 'itemsUsed', 'killed', 'exp', 'gold'].every((k) => typeof a[k] === 'number'), 'number fields');
  ok(Array.isArray(a.mpUsedBy) && a.mpUsedBy.length === 4 && typeof a.casts === 'object' && Array.isArray(a.glimmers) && Array.isArray(a.profUps) && Array.isArray(a.drops) && Array.isArray(a.expEach), 'per-member fields');
  ok(a.killed === 3 && a.exp > 0 && a.Lb === 18 && a.Tb === 2, `sensible (${a.rounds} rounds, ${a.hpLossPct}% HP lost)`);
  const lose = B.simulate({ party: R.fxBattleParty(1), troop: 'tb_troop_boss', tier: 6, seed: 1 });
  ok(lose.result === 'lose' && lose.partyHpPct === 0, 'an overwhelming foe → lose');
  const t = B.simulate({ party: R.fxBattleParty(10), mons: [['tb_dummy', 1]], lv: 10, maxRounds: 3, seed: 1 });
  ok(t.result === 'timeout' && t.rounds === 3, 'maxRounds → timeout');
  const z = B.simulate({ party, zone: 'tb_zone', tier: 2, seed: 5 });
  ok(z.mons.length >= 1 && z.mons.every((m) => ['tb_rat_2', 'tb_goblin', 'tb_rat_1'].includes(m)) && !z.rare && !z.golden, 'zone battle (no rare / golden unless asked)');
  const zr = B.simulate({ party, zone: 'tb_zone', tier: 2, rare: 'force', seed: 5 });
  ok(zr.rare && zr.mons.join() === 'tb_rare', "rare: 'force'");
  const tr = B.simulate({ party: R.fxBattleParty(16), troop: 'tb_troop_boss', tier: 1, seed: 9, log: true });
  ok(tr.boss && tr.log.length > 10 && ['win', 'lose'].includes(tr.result), `troop battle (${tr.result} in ${tr.rounds} rounds)`);
  const rw = B.simulate({ party: R.fxBattleParty(1), mons: [['tb_goblin', 2]], lv: 1, seed: 3, rewards: true });
  ok(rw.result !== 'win' || rw.party[0].exp > R.Rules.expForLevel(1), 'rewards: EXP applied to the clones');
  const mem = B.simulate({ party, members: ['hero', 'tb_lancer'], mons: [['tb_goblin', 1]], seed: 2, tier: 2 });
  ok(mem.party.length === 2 && mem.reserve.length === 2, 'members');
  let wins = 0;
  for (let i = 0; i < 40; i++) if (B.simulate({ party: R.fxBattleParty(10), mons: [['tb_goblin', 3]], seed: 100 + i, tier: 2 }).result === 'win') wins++;
  ok(wins === 40, `a level-10 party beats 3 goblins (${wins}/40)`);
  const saved = U.rng;
  B.simulate({ party, mons: [['tb_slime', 1]], seed: 1 });
  ok(U.rng === saved, 'rng restored');
  const after = B.simulate({ party, mons: [['tb_goblin', 2]], seed: 8, tier: 2, after: true });
  ok(after.result !== 'win' || after.party.every((c) => c.hp === 0 || c.hp === R.Rules.stats(c).hp), 'after: recovery applied to the clones');
});

// ================================================================ requests from other areas (A1 / A10b / A7)
sec('requests');
guard('requests', () => {
  // §3.3.8 / §4.10.3: the rare swap is 1/rate × (1 + rareEncPct/100) × L, L = 2 while 誘い寄せ (encItem.pct > 0)
  const G0 = R.Game;
  const rate = (encItem, n) => {
    R.Game = Object.assign({}, G0 || {}, { encItem });
    let hit = 0;
    try { for (let i = 0; i < n; i++) { const r = B.resolveMonsters({ zone: 'tb_zone', tier: 2 }, { mods: {} }); if (r && r.rare) hit++; } } finally { R.Game = G0; }
    return hit / n;
  };
  near(rate(null, 24000), 1 / 80, 0.004, 'rare swap 1/80');
  near(rate({ id: 'x', pct: 100, steps: 50 }, 24000), 2 / 80, 0.005, 'rare swap ×2 while a lure is active');
  near(rate({ id: 'x', pct: -100, steps: 50, weakOnly: true }, 24000), 1 / 80, 0.004, 'a repel does not change the rare swap');
  // A10b: auto never uses relic items or 魔石, and grow goes through R.Rules.grow (its cap)
  const e = mk({ mons: [['tb_goblin', 2]] });
  e.inv.tb_stone_fire = 3;
  const relic = Object.keys(DB.items).find((id) => DB.items[id].src === 'relic' && DB.items[id].use && DB.items[id].use.battle);
  if (relic) e.inv[relic] = 3;
  P(e, 0).c.hp = 1; P(e, 1).c.hp = 1;
  const cmds = AI.partyCommands(e, AI.AUTO_OPTS);
  ok(!cmds.some((c) => c && c.type === 'item' && (c.id === 'tb_stone_fire' || c.id === relic)), 'auto: no 魔石, no relic items');
  const hero = P(e, 0);
  hero.c.bonus = { hp: 195, mp: 0, wp: 0 };
  hero.refresh();
  e.inv.tb_seed = 2;
  const mh = hero.mhp;
  let ev = use(e, hero, 'tb_seed', hero, { item: true });
  ok(hero.c.bonus.hp === 200 && hero.mhp === mh + 5 && said(ev, '最大HPが5増えた'), 'grow: capped at +200 through R.Rules.grow');
  ev = use(e, hero, 'tb_seed', hero, { item: true });
  ok(hero.c.bonus.hp === 200 && said(ev, 'これ以上は効かない。'), 'grow at the cap: no effect');
  // §9.11.2: boss HP = hpBoss(Lb) × share × s.hp at any tier, with no double rounding
  for (const T of [0, 3, 7]) {
    const r = B.resolveMonsters({ troop: 'tb_troop_boss', tier: T }, {});
    if (!r) continue;
    const eng = new B.Engine({ party: [], mons: r.mons, tier: r.Tb, lv: r.Lb, noSurprise: true });
    const b = eng.mons.find((m) => m.boss && m.id === 'tb_boss');
    if (b) ok(Math.abs(b.hp - R.Mon.hpBoss(r.Lb) * (DB.monsters.tb_boss.hpShare || 12) * ((DB.monsters.tb_boss.s && DB.monsters.tb_boss.s.hp) || 1)) <= 1, `boss HP at T${T} = hpBoss(Lb) × share`);
  }
});

// ================================================================ real content (src/data)
sec('real content');
guard('real content', () => {
  const real = (o) => Object.keys(o).filter((k) => !k.startsWith('tb_'));
  let items = 0, acts = 0, mons = 0, troops = 0, zones = 0;
  for (const id of real(DB.items)) {
    const it = DB.items[id];
    if (it.type !== 'consumable' || !it.use || !it.use.battle) continue;
    const e = mk({ mons: ['tb_goblin', 'tb_goblin', 'tb_slime'] });
    e.inv[id] = 1;
    const u = P(e, 1);
    P(e, 0).c.hp = 1;
    if (it.use.target === 'ally_dead') run(e.die(P(e, 0), null));
    const tgt = ['enemy', 'group'].includes(it.use.target) ? Mo(e, 0) : P(e, 0);
    let ev = [];
    try { ev = use(e, u, id, tgt, { item: true }); } catch (err) { ok(false, `item ${id} threw: ${err.message}`); continue; }
    ok(said(ev, `${it.name}を使った`) && e.count(id) === 0, `item ${id} works in battle`);
    items++;
  }
  for (const id of real(DB.actions)) {
    const a = DB.actions[id];
    if (!a || !a.effects) continue;
    const sides = a.kind === 'tech' || a.kind === 'spell' ? ['party'] : ['mon'];
    for (const side of sides) {
      const e = mk({ mons: ['tb_goblin', 'tb_caster', 'tb_goblin'] });
      let u;
      if (side === 'party') {
        u = P(e, 0);
        if (a.kind === 'tech') { const W = Object.keys(DB.items).find((k) => DB.items[k].type === 'weapon' && DB.items[k].wtype === a.wtype && !DB.items[k].sealTech); if (W) { u.c.equip.weapon1 = W; u.c.equip.shield = null; u.refresh(); } }
        u.mp = 999;
      } else u = Mo(e, 1);
      const foe = side === 'party' ? Mo(e, 0) : P(e, 0);
      const ally = side === 'party' ? P(e, 1) : Mo(e, 0);
      const tgt = ['enemy', 'group', 'random', 'enemies'].includes(a.target) ? foe : ally;
      try { run(e.useAction(u, id, a, tgt, { slot: a.kind === 'tech' ? 'weapon1' : undefined })); acts++; } catch (err) { ok(false, `action ${id} (${side}) threw: ${err.message}`); }
    }
  }
  for (const id of real(DB.monsters)) {
    const d = DB.monsters[id];
    let r;
    try { r = B.simulate({ party: R.fxBattleParty(Math.max(1, Math.min(60, (d.lv || 1) + 2))), mons: [[id, 1]], lv: d.lv || 1, seed: 11, maxRounds: 25 }); } catch (err) { ok(false, `monster ${id} simulate threw: ${err.message}`); continue; }
    if (!['win', 'lose', 'escape', 'timeout'].includes(r.result)) ok(false, `monster ${id} battle resolves (${r.result})`);
    mons++;
  }
  for (const id of real(DB.troops)) {
    try { B.simulate({ party: R.fxBattleParty(40), troop: id, seed: 3, maxRounds: 30 }); troops++; } catch (err) { ok(false, `troop ${id} simulate threw: ${err.message}`); }
  }
  for (const z of real(DB.encounters)) {
    try { B.simulate({ party: R.fxBattleParty(25), zone: z, tier: 3, seed: 4, maxRounds: 30, rare: true, golden: true }); zones++; } catch (err) { ok(false, `zone ${z} simulate threw: ${err.message}`); }
  }
  ok(items + acts + mons > 0 || !Object.keys(DB.monsters).some((k) => !k.startsWith('tb_')), 'real content exercised');
  console.log(`  real content exercised: ${items} items, ${acts} action uses, ${mons} monsters, ${troops} troops, ${zones} zones`);
});

console.log(`battle tests: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
