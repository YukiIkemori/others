#!/usr/bin/env node
// Unit tests for rules A1: R.State, R.Rules, R.Party, R.Tier (DESIGN.md §3.2–§3.3.5,
// §4.2–§4.4, §4.9.1, §4.12, §5.2.7, §5.3, §5.5, §8.2.9, §8.11, §8.12). Exit 1 on failure.
//   node tools/test_rules.js            all tests
//   node tools/test_rules.js -v         also list passing groups
//   node tools/test_rules.js <filter>   only groups whose name contains <filter>
'use strict';
const path = require('path');
const R = require('./lib/load')({ quiet: true, extra: [path.join(__dirname, 'fixtures/rules/data.js')] });
const args = process.argv.slice(2);
const VERBOSE = args.includes('-v');
const FILTER = args.find((a) => !a.startsWith('-')) || '';

const DB = R.DB, Ru = R.Rules, St = R.State, Pa = R.Party, Ti = R.Tier, K = Ru.K;
let groups = 0, checks = 0, fails = 0;
const failures = [];
let cur = '';
function test(name, fn) {
  if (FILTER && !name.includes(FILTER)) return;
  groups++;
  cur = name;
  const before = fails;
  try { R.U.seed(1234); fn(); } catch (e) { fail('threw ' + (e && e.stack || e)); }
  R.U.unseed();
  if (VERBOSE && fails === before) console.log('  ok  ' + name);
}
function fail(msg) { fails++; failures.push(cur + ': ' + msg); }
function ok(c, msg) { checks++; if (!c) fail(msg || 'assertion'); }
function eq(a, b, msg) {
  checks++;
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) fail((msg || 'eq') + ' — got ' + A + ', want ' + B);
}
function near(a, b, eps, msg) { checks++; if (!(Math.abs(a - b) <= eps)) fail((msg || 'near') + ` — got ${a}, want ${b}±${eps}`); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
const loadErr = (R._nodeLoadErrors || []).concat(R.loadErrors || []).filter((e) => /systems\/(state|rules|party|tier)\.js|fixtures\/rules|fillItem/.test(String(e)));
/** a game with the hero (warrior/sword) and the standard three */
function fresh(companions) {
  St.newGame(null, { companions: companions || ['brigitta', 'marta', 'sylvain'] });
  return R.Game;
}
/** a bare CharState of a fixture companion, gear removed */
function bare(id, level) {
  const c = Ru.newChar({ id, level: level || 1 });
  c.equip = Ru.emptyEquip();
  Ru.fullHeal(c);
  return c;
}
const hasReal = (reg, n) => Object.keys(DB[reg]).filter((k) => !k.startsWith('fx_')).length >= n;

// =====================================================================
test('load: my files load without errors', () => {
  eq(loadErr, [], 'load errors');
  for (const k of ['State', 'Rules', 'Party', 'Tier']) ok(R[k], 'R.' + k + ' exists');
  ok(!('jobLevel' in Ru) && !('gainJp' in Ru) && !('changeJob' in Ru), 'no job/JP functions remain');
});

test('K: constants of §4.18.1', () => {
  eq(K.W, [8, 14, 21, 30, 40, 51, 64, 78, 94, 112], 'W');
  eq(K.U, [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6], 'U');
  eq(K.PRICE, [70, 160, 290, 450, 660, 900, 1200, 1500, 1900, 2600], 'PRICE');
  eq([0, 4, 8].map(K.D), [70, 190, 310], 'D');
  eq([0, 3, 8, 9].map(K.LZ), [6, 24, 54, 60], 'LZ');
  eq([6, 30].map(K.DK), [70, 190], 'DK');
  eq(K.PROF_PTS, [0, 5, 15, 30, 55, 90, 135, 190, 260, 350, 460], 'PROF_PTS');
  eq(K.PEXP, [15, 40, 70, 100, 135, 175, 220, 270, 330, 400], 'PEXP');
  eq(K.GLIM.expect, [2, 4, 6, 8, 10, 12, 14, 16, 17, 19], 'EXPECT');
  eq(K.GLIM.base, { tech: 0.012, secret: 0.006, single: 0.015, comboA: 0.012, comboB: 0.010, triple: 0.008 }, 'GLIM.base');
  eq(K.INN, [10, 16, 24, 32, 42, 54, 66, 80, 96, 112], 'INN');
  eq(K.STAGE, [0.63, 0.77, 1, 1.3, 1.6], 'STAGE');
  eq(K.MOB, { atk: 0.6, mag: 0.6 }, 'MOB');
  eq(K.PRICE_SLOT, { weapon: 1.6, body: 1.4, shield: 1.0, head: 0.8, hands: 0.6, feet: 0.6, acc: 1.2 }, 'PRICE_SLOT');
  eq(K.RESERVE_RATE, 0.6, 'RESERVE_RATE');
  eq(K.MODCAP, { party: 150, partyMin: -100, preempt: 30, exp: 30, expMin: -100, glim: 40, glimMin: -100, prof: 50, profMin: -100, cost: -50, encounter: 50, autoSteal: 100 }, 'MODCAP');
  eq(Ru.SLOTS, ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'], 'SLOTS');
  eq(Ru.STATS, ['str', 'vit', 'dex', 'agi', 'int', 'mnd'], 'STATS');
  const w = K.WTYPE;
  eq([w.sword.mult, w.greatsword.mult, w.dagger.mult, w.axe.mult, w.spear.mult, w.bow.mult, w.club.mult, w.staff.mult, w.katana.mult, w.fist.mult, w.whip.mult],
    [1.00, 1.40, 0.75, 1.15, 1.25, 1.10, 1.05, 0.60, 1.05, 0.90, 0.80], 'WTYPE mult');
  eq(Ru.WTYPES.filter((t) => w[t].twoHanded), ['greatsword', 'spear', 'bow'], 'two-handed types');
  eq(Ru.WTYPES.filter((t) => w[t].reach), ['spear', 'bow', 'whip'], 'reach types');
  eq(w.staff.magMult, 1.0, 'staff magMult');
  const c = K.curve(30);
  eq([Math.round(c.hp), Math.round(c.atk), Math.round(c.def), Math.round(c.agi), Math.round(c.exp), Math.round(c.gold)], [174, 69, 95, 42, 93, 80], 'monster curve L30 (§4.14.2)');
  eq(Math.round(K.hpBoss(9) * 18), 456, 'region boss HP T0 (§4.14.3)');
  eq(Math.round(K.hpBoss(58) * 30), 16029, 'last boss 1 HP');
});

test('levels: need/expForLevel table (§4.2.3)', () => {
  const need = { 1: 70, 2: 109, 5: 280, 6: 356, 12: 996, 18: 1936, 24: 3148, 30: 4608, 36: 6301, 42: 8217, 48: 10355, 54: 12711, 60: 15287, 70: 20073 };
  for (const L in need) eq(Ru.need(+L), need[L], 'need(' + L + ')');
  const cum = { 1: 0, 2: 70, 5: 550, 6: 830, 12: 4410, 18: 12596, 24: 27117, 30: 49539, 36: 81308, 42: 123797, 48: 178337, 54: 246249, 60: 328848, 70: 502744 };
  for (const L in cum) eq(Ru.expForLevel(+L), cum[L], 'expForLevel(' + L + ')');
  for (let L = 2; L <= 99; L++) ok(Ru.expForLevel(L) > Ru.expForLevel(L - 1), 'monotone at ' + L);
});

test('levels: HPlv/MPlv/WPlv table (§4.2.2)', () => {
  const T = { 1: [18, 8, 5], 5: [69, 16, 11], 6: [80, 18, 12], 12: [145, 28, 19], 18: [206, 37, 25], 24: [265, 45, 31], 30: [322, 54, 37],
    36: [378, 61, 42], 42: [433, 69, 47], 48: [488, 77, 52], 54: [541, 84, 58], 60: [594, 91, 63], 70: [682, 103, 71], 99: [928, 136, 94] };
  for (const L in T) eq(['hp', 'mp', 'wp'].map((k) => Math.round(Ru.lvCurve(k, +L))), T[L], 'curve L' + L);
  // growth diminishes: HP Lv2 +14.7, Lv54 +8.9
  near(Ru.lvCurve('hp', 2) - Ru.lvCurve('hp', 1), 14.7, 0.05, 'HP gain at Lv2');
  near(Ru.lvCurve('hp', 54) - Ru.lvCurve('hp', 53), 8.9, 0.1, 'HP gain at Lv54');
});

test('levels: falloff f(d) (§4.2.3)', () => {
  near(Ru.falloff(2), 0.5625, 1e-9, '+2'); near(Ru.falloff(4), 0.316, 0.001, '+4'); near(Ru.falloff(6), 0.178, 0.001, '+6');
  near(Ru.falloff(10), 0.056, 0.001, '+10'); eq(Ru.falloff(30), 0.03, 'floor 0.03');
  eq(Ru.falloff(0), 1, '0'); near(Ru.falloff(-5), 1.5, 1e-9, '-5'); near(Ru.falloff(-10), 2, 1e-9, '-10'); near(Ru.falloff(-40), 2, 1e-9, 'max 2');
});

test('companions: HP/MP/WP at Lv1/24/54 match §5.3.2', () => {
  if (!hasReal('companions', 20)) return;
  const T = {
    selma: '20/6/5 308/36/31 631/67/58', hagen: '23/5/5 347/27/31 710/50/58', dokka: '24/6/4 361/36/25 738/67/46', basil: '20/8/4 305/45/25 624/84/46',
    bartolo: '19/6/5 290/36/31 594/67/58', viola: '17/8/5 257/45/31 525/84/58', shigure: '17/5/7 254/27/40 520/50/75', rouga: '19/5/6 293/27/35 600/50/66',
    titta: '16/6/6 243/36/35 498/67/66', brigitta: '17/6/6 259/36/35 530/67/66', sylvain: '15/8/6 221/45/35 453/84/66', zafira: '15/8/6 221/45/35 453/84/66',
    ferno: '15/9/5 224/52/31 458/97/58', belladonna: '17/8/5 251/45/31 514/84/58', boden: '18/9/4 265/52/25 541/97/46', teo: '14/10/4 217/59/25 443/109/46',
    ilse: '14/10/4 217/59/25 443/109/46', morga: '15/9/5 224/52/31 458/97/58', marta: '16/10/3 249/59/19 509/109/35', noela: '15/9/5 221/52/31 453/97/58',
  };
  for (const id in T) {
    const got = [1, 24, 54].map((L) => { const s = Ru.stats(bare(id, L)); return [s.hp, s.mp, s.wp].join('/'); }).join(' ');
    eq(got, T[id], id);
  }
  const H = { warrior: '20/6/5 305/36/31 624/67/58', ranger: '17/6/6 251/36/35 514/67/66', mage: '14/10/4 219/59/25 448/109/46',
    spellblade: '17/8/5 259/45/31 530/84/58', wanderer: '17/8/5 257/45/31 525/84/58' };
  for (const t in H) {
    const opts = DB.heroTypes[t].favorOptions;
    const favor = opts.weapon ? { kind: 'weapon', id: opts.weapon[0] } : { kind: 'element', id: opts.element[0] };
    const got = [1, 24, 54].map((L) => {
      const c = Ru.newChar({ id: 'hero', heroSpec: { name: 'テスト', gender: 'm', type: t, favor } });
      c.equip = Ru.emptyEquip(); Ru.setLevel(c, L);
      const s = Ru.stats(c); return [s.hp, s.mp, s.wp].join('/');
    }).join(' ');
    eq(got, H[t], 'hero ' + t);
  }
});

test('stats: caps and bonuses (§4.2.2)', () => {
  const c = bare('fx_warrior', 99);
  c.equip.acc1 = 'fx_acc_a'; c.equip.acc2 = 'fx_acc_b';
  c.bonus = { hp: 200, mp: 30, wp: 30 };
  const s = Ru.stats(c);
  ok(s.hp <= 999 && s.mp <= 150 && s.wp <= 99, 'caps 999/150/99 ' + [s.hp, s.mp, s.wp]);
  eq([s.mp, s.wp], [150, 99], 'MP/WP reach their caps');
  const m = bare('fx_mage', 1), base = Ru.stats(m);
  m.bonus.hp = 12;
  eq(Ru.stats(m).hp, base.hp + 12, 'bonus.hp adds');
  // hpPct multiplies before the bonus: round(HPlv×G×VIT) × (1+pct) + bonus
  m.equip.acc1 = 'fx_acc_a';
  const exp = Math.round(Math.round(Ru.lvCurve('hp', 1) * 0.9 * (160 + Ru.finalStats(m).vit) / 200) * 1.2 + 12);
  eq(Ru.stats(m).hp, exp, 'hpPct then bonus');
});

test('stats: derived formulas (§4.4)', () => {
  const c = bare('fx_warrior', 10);
  c.equip.weapon1 = 'fx_sword_5'; c.equip.shield = 'fx_sh_h5'; c.equip.body = 'fx_body_h5'; c.equip.head = 'fx_head_h5';
  c.equip.hands = 'fx_hands_l5'; c.equip.feet = 'fx_feet_l5'; c.equip.weapon2 = 'fx_axe_5';
  const s = Ru.stats(c), fs = Ru.finalStats(c);
  const I = (id) => DB.items[id];
  eq(fs.str, 50 + I('fx_sword_5').stats.str + I('fx_body_h5').stats.str + I('fx_axe_5').stats.str, 'str sums weapon2 stats too (rule 4)');
  eq(s.w.weapon1.atk, Math.round(I('fx_sword_5').atk * (64 + fs.str) / 64), 'atk1 = round(W × (64+S)/64)');
  eq(s.w.weapon2.atk, Math.round(I('fx_axe_5').atk * (64 + fs.str) / 64), 'atk2 (axe, str)');
  eq(s.mag, Math.round(Math.max(I('fx_sword_5').mag, I('fx_axe_5').mag) * (64 + fs.int) / 64), 'mag uses the larger weapon mag');
  eq(s.def, ['fx_sh_h5', 'fx_body_h5', 'fx_head_h5', 'fx_hands_l5', 'fx_feet_l5'].reduce((a, id) => a + I(id).def, 0), 'def = armor sum');
  eq(s.mdef, ['fx_sh_h5', 'fx_body_h5', 'fx_head_h5', 'fx_hands_l5', 'fx_feet_l5'].reduce((a, id) => a + I(id).mdef, 0) + Math.floor(fs.mnd / 2), 'mdef = armor + mnd/2');
  eq(s.w.weapon1.hit, 90 + Math.floor(fs.dex / 4) + 0, 'hit sword');
  eq(s.w.weapon2.hit, 90 + Math.floor(fs.dex / 4) - 10, 'hit axe −10');
  eq(s.eva, Math.floor(fs.agi / 5) + 8, 'eva = agi/5 + heavy shield 8');
  eq(s.w.weapon1.crit, 2 + Math.floor(fs.dex / 16) + 2, 'crit sword +2');
  eq(s.w.weapon2.crit, 2 + Math.floor(fs.dex / 16) + 4, 'crit axe +4');
  eq(s.spd, fs.agi, 'spd');
  eq([s.atk1, s.atk2, s.hit, s.crit], [s.w.weapon1.atk, s.w.weapon2.atk, s.w.weapon1.hit, s.w.weapon1.crit], 'flat fields = weapon1');
  eq(s.w.weapon1.kind, 'slash', 'kind'); eq(s.w.weapon1.reach, 'front', 'sword reach'); eq(s.w.weapon2.twoHanded, false, 'axe 1H');
  // spear uses (str+dex)/2, staff (str+int)/2, fist (str+agi)/2, bow dex
  const d = bare('fx_warrior', 10); d.equip.weapon1 = 'fx_spear_5'; d.equip.weapon2 = 'fx_bow_5';
  const sd = Ru.stats(d), fd = Ru.finalStats(d);
  eq(sd.w.weapon1.atk, Math.round(I('fx_spear_5').atk * (64 + (fd.str + fd.dex) / 2) / 64), 'spear stat (str+dex)/2');
  eq(sd.w.weapon2.atk, Math.round(I('fx_bow_5').atk * (64 + fd.dex) / 64), 'bow stat dex');
  eq(sd.w.weapon1.reach, 'any', 'spear reach any');
  // bare hands: 体術 W 4, stat (str+agi)/2, mag 4
  const b = bare('fx_warrior', 1), sb = Ru.stats(b), fb = Ru.finalStats(b);
  eq(sb.w.weapon1, null, 'no weapon1');
  eq(sb.w.fist.atk, Math.round(4 * (64 + (fb.str + fb.agi) / 2) / 64), 'fist atk');
  eq(sb.mag, Math.round(4 * (64 + fb.int) / 64), 'Wm 4 bare');
  eq(sb.atk1, sb.w.fist.atk, 'atk1 = fist when weapon1 empty');
  // percent mods, flat mods, caps
  const m = bare('fx_mage', 1); m.equip.weapon1 = 'fx_staff_z'; m.equip.acc1 = 'fx_acc_a';
  const sm = Ru.stats(m), fm = Ru.finalStats(m);
  eq(fm.int, Math.floor(52 * 1.1), 'intPct +10%');
  eq(sm.mag, Math.round((94 + 8) * (64 + fm.int) / 64), 'mods.mag adds to Wm');
  eq(sm.w.weapon1.atk, Math.round((DB.items.fx_staff_z.atk + 10) * (64 + (fm.str + fm.int) / 2) / 64), 'mods.atk adds to W');
  eq(sm.def, 5, 'mods.def'); eq(sm.mdef, 6 + Math.floor(fm.mnd / 2), 'mods.mdef');
  eq(sm.w.weapon1.hit, 90 + Math.floor(fm.dex / 4) + 3, 'mods.hit'); eq(sm.eva, Math.floor(fm.agi / 5) + 7, 'mods.eva');
  eq(sm.w.weapon1.crit, 2 + Math.floor(fm.dex / 16) + 0 + 4, 'mods.crit'); eq(sm.spd, fm.agi + 5, 'mods.spd');
  eq(sm.elemResist, { fire: 0.5, water: 1.5, wind: 1, earth: 1, light: 1, dark: 1 }, 'elemResist defaults 1');
  // defPct: a quirk body halves def; def:0 written stays 0
  const q = bare('fx_mage', 1); q.equip.body = 'fx_body_q'; q.equip.weapon1 = 'fx_sword_q';
  const sq = Ru.stats(q);
  eq(sq.def, 0, 'def:0 body + defPct');
  eq(DB.items.fx_body_q.def, 0, 'fillItem keeps written def:0');
});

test('stats: §4.3.7 build ratios (int and str, T8)', () => {
  const setI = (g) => ({ weapon1: g === 'z' ? 'fx_staff_z' : 'fx_staff_' + g, weapon2: g === 'z' ? null : 'fx_staff_' + g,
    body: g === 'z' ? null : 'fx_i_body_' + g, head: g === 'z' ? null : 'fx_i_head_' + g, shield: g === 'z' ? null : 'fx_i_sh_' + g,
    hands: g === 'z' ? null : 'fx_i_hands_' + g, feet: g === 'z' ? null : 'fx_i_feet_' + g, acc1: g === 'z' ? null : 'fx_i_acc_' + g, acc2: g === 'z' ? null : 'fx_i_acc_' + g });
  const mag = (g) => { const c = bare('fx_mage', 55); Object.assign(c.equip, setI(g)); return Ru.stats(c).mag; };
  const [Z, N, S] = ['z', 'n', 's'].map(mag);
  eq([Z, N, S], [170, 259, 435], '術力 Z/N/S');
  near(S / Z, 2.55, 0.02, 'S/Z'); near(S / N, 1.68, 0.02, 'S/N');
  const setS = (g) => ({ weapon1: g === 'z' ? 'fx_sword_z' : 'fx_sword_' + g, weapon2: g === 'z' ? null : 'fx_sword_' + g,
    body: g === 'z' ? null : 'fx_s_body_' + g, head: g === 'z' ? null : 'fx_s_head_' + g, shield: g === 'z' ? null : 'fx_s_sh_' + g,
    hands: g === 'z' ? null : 'fx_s_hands_' + g, feet: g === 'z' ? null : 'fx_s_feet_' + g, acc1: g === 'z' ? null : 'fx_s_acc_' + g, acc2: g === 'z' ? null : 'fx_s_acc_' + g });
  const atk = (g) => { const c = bare('fx_warrior', 55); Object.assign(c.equip, setS(g)); return Ru.stats(c).atk1; };
  eq(['z', 'n', 's'].map(atk), [167, 256, 432], '攻撃力 Z/N/S');
  // cloth takes more physical damage than heavy (D3 ≥ 1.35): DK/(DK+def) ratio against the same foe
  const DK = K.DK(54);
  const defC = ['body', 'head', 'shield', 'hands', 'feet'].reduce((a, s) => a + Math.round(K.SLOT_SHARE[s] * K.D(8) * K.WEIGHT.cloth.def), 0);
  const defH = ['body', 'head', 'shield', 'hands', 'feet'].reduce((a, s) => a + Math.round(K.SLOT_SHARE[s] * K.D(8) * K.WEIGHT.heavy.def), 0);
  ok((DK / (DK + defC)) / (DK / (DK + defH)) >= 1.35, 'cloth set takes ≥ 1.35× physical');
});

test('gear: gearStat and fillItem numbers (§4.3, §8.2.9, §8.3)', () => {
  const T1 = [[1, 2, 3], [2, 4, 6], [2, 4, 6], [3, 6, 9], [3, 6, 9], [4, 8, 12], [4, 8, 12], [5, 10, 15], [5, 10, 15], [6, 12, 18]];
  const T2 = [[2, 4, 6], [3, 6, 9], [4, 8, 12], [5, 10, 15], [6, 12, 18], [7, 14, 21], [8, 16, 24], [9, 18, 27], [10, 20, 30], [12, 24, 36]];
  for (let t = 0; t < 10; t++) {
    eq(['normal', 'rare', 'super'].map((g) => Ru.gearStat(t, 1, g)), T1[t], 'gearStat T' + t + ' 1u');
    eq(['normal', 'rare', 'super'].map((g) => Ru.gearStat(t, 2, g)), T2[t], 'gearStat T' + t + ' 2u');
  }
  // price table §8.3.8
  const P = { 0: [100, 60, 70, 40, 40, 80], 1: [220, 130, 160, 100, 100, 190], 2: [410, 230, 290, 170, 170, 350], 5: [1260, 720, 900, 540, 540, 1080], 8: [2660, 1520, 1900, 1140, 1140, 2280], 9: [3640, 2080, 2600, 1560, 1560, 3120] };
  for (const t in P) {
    const got = ['body', 'head', 'shield', 'hands', 'feet', 'acc'].map((type) => Ru.fillItem({ type, tier: +t, grade: 'normal', weight: 'light', units: type === 'acc' ? 'i1' : 'v1' }).price);
    eq(got, P[t], 'prices T' + t);
  }
  const sup = Ru.fillItem({ type: 'body', tier: 3, grade: 'super', weight: 'heavy', units: 's2' });
  eq(sup.price, 630 * 6, 'super ×6'); eq(sup.stats, { str: 15 }, 'super stats ×3');
  const w = Ru.fillItem({ type: 'weapon', wtype: 'greatsword', tier: 4, grade: 'normal', units: 's2' });
  eq([w.atk, w.mag, w.twoHanded], [Math.round(40 * 1.4), Math.round(40 * 0.5), true], 'greatsword atk/mag/2H');
  eq(Ru.fillItem({ type: 'weapon', wtype: 'staff', tier: 6, units: 'i2' }).mag, 64, 'staff mag = W');
  const b = Ru.fillItem({ type: 'body', weight: 'cloth', tier: 8, units: 'i2' });
  eq([b.def, b.mdef, b.stats.int], [50, 74, 10], '天絹のローブ T8 cloth body (§4.3.3)');
  const sh = Ru.fillItem({ type: 'shield', weight: 'light', tier: 2, units: 'd1' });
  eq([sh.def, sh.mdef, sh.eva], [Math.round(0.2 * 130 * 0.65), Math.round(0.2 * 130 * 0.35), 5], 'light shield');
  const kept = Ru.fillItem({ type: 'body', weight: 'cloth', tier: 8, units: 'i2', def: 0, mdef: 0, price: 5, stats: { int: 99 } });
  eq([kept.def, kept.mdef, kept.price, kept.stats.int], [0, 0, 5, 99], 'written values kept');
  const neg = Ru.fillItem({ type: 'body', weight: 'cloth', tier: 5, grade: 'super', units: 's2', statsAdd: { agi: -4 } });
  eq(neg.stats, { str: 21, agi: -4 }, 'statsAdd');
  Ru.fillItem(neg); eq(neg.stats, { str: 21, agi: -4 }, 'fillItem twice does not add twice');
  eq(Ru.fillItem({ type: 'weapon', wtype: 'bow', tier: 0 }).icon, 'icon:bow', 'icon');
  eq(Ru.fillItem({ type: 'acc', tier: 0, units: 'm1' }).desc, '身につける飾り。\n精神が上がる。', 'acc desc');
  eq(Ru.fillItem({ type: 'feet', weight: 'heavy', tier: 0, units: 's1v1' }).desc, '重くて守りが固い。\n腕力と体力が上がる。', 'armor desc');
  eq(Ru.fillItem({ type: 'shield', weight: 'cloth', tier: 0, units: 'i1' }).desc, '術から身を守る。\n知力が上がる。', 'cloth desc');
});

test('gear: autoDesc fits 2 lines × 20 for every item', () => {
  let n = 0;
  for (const id in DB.items) {
    const it = DB.items[id];
    const d = Ru.autoDesc(Object.assign({}, it, { desc: undefined }));
    n++;
    const lines = d.split('\n');
    ok(lines.length <= 2, id + ' lines ' + JSON.stringify(d));
    for (const l of lines) ok(Ru.textWidth(l) <= 20, id + ' width ' + JSON.stringify(l));
    if (['weapon', 'shield', 'head', 'body', 'hands', 'feet'].includes(it.type)) ok(d.length > 0, id + ' has a desc');
  }
  ok(n > 50, 'items checked: ' + n);
  const d = Ru.autoDesc({ type: 'acc', tier: 5, grade: 'super', mods: { dropPct: 30, rarePct: 30, superPct: 30, goldPct: 30, expPct: -50, glimPct: { tech: 20, spell: 20 } }, quirk: true });
  ok(/ただし経験値が減る。/.test(d), 'quirk sentence kept when shortening: ' + d);
  eq(Ru.autoDesc({ type: 'acc', grade: 'rare', mods: { elemResist: { fire: 0.5, water: 0.5 } } }), '火・水のダメージを減らす。', 'grouped resist');
  eq(Ru.autoDesc({ type: 'acc', grade: 'rare', mods: { statusImmune: ['sleep', 'confuse', 'silence'] } }), '眠り・混乱・沈黙が効かない。', 'immune list');
  eq(Ru.autoDesc(DB.items.fx_acc_luck), 'レアと超レアのアイテムを落としやすい。', 'rarePct + superPct in one sentence');
  // quirks: a lowered def written on a quirk armor, and several 「〜が下がる」 merged into one sentence (§8.2.7, §8.3.6)
  const low = Ru.autoDesc({ type: 'body', weight: 'heavy', tier: 5, grade: 'super', quirk: true, def: 20, mdef: 18, mods: { elemResist: { earth: 0.5 }, agiPct: -20 } });
  ok(/ただし守備力と素早さが下がる。/.test(low), 'merged quirk sentence: ' + low);
  ok(!/ただし.*ただし/.test(low), 'one ただし only: ' + low);
  eq(Ru.autoDesc({ type: 'acc', grade: 'rare', mods: { takenPct: -10 } }), '受けるダメージを減らす。', 'takenPct < 0');
});

test('equip: slots, two-handed and the shield (§3.3.3 rules 1–6)', () => {
  const g = fresh([]);
  const h = St.hero();
  ok(Ru.canEquip(h, 'fx_sword_5', 'weapon2'), 'sword into weapon2');
  eq(Ru.equipIssue(h, 'fx_sword_5', 'shield'), 'この枠には付けられない。', 'weapon not into shield');
  eq(Ru.equipIssue(h, 'fx_head_h5', 'body'), 'この枠には付けられない。', 'head not into body');
  ok(Ru.canEquip(h, 'fx_i_acc_n', 'acc2'), 'acc into acc2');
  eq(Ru.slotsFor('fx_axe_5'), ['weapon1', 'weapon2'], 'slotsFor weapon');
  eq(Ru.slotsFor('fx_i_acc_n'), ['acc1', 'acc2'], 'slotsFor acc');
  eq(Ru.slotsFor('fx_herb'), [], 'slotsFor consumable');
  eq(Ru.slotGroup('fx_feet_l5'), 'feet', 'slotGroup');
  // not in the inventory
  const r0 = Ru.equip(h, 'weapon2', 'fx_sword_5');
  eq([r0.ok, r0.reason], [false, '持ち物にない。'], 'not carried');
  St.addItem('fx_sh_h5'); St.addItem('fx_gs_5'); St.addItem('fx_spear_5'); St.addItem('fx_sword_5', 1);
  h.equip.shield = null;
  eq(Ru.equip(h, 'shield', 'fx_sh_h5').ok, true, 'shield on');
  const before = clone({ equip: h.equip, inv: g.inv });
  // 2H into weapon1: shield comes off, both old items back to inv
  const r1 = Ru.equip(h, 'weapon1', 'fx_gs_5');
  eq(r1.ok, true, 'greatsword on');
  eq(r1.shieldRemoved, 'fx_sh_h5', 'shield removed');
  ok(r1.removed.includes('fx_sh_h5') && r1.removed.includes(before.equip.weapon1), 'removed lists old weapon and shield');
  eq(h.equip.shield, null, 'shield slot empty');
  eq(St.count('fx_sh_h5'), 1, 'shield in inv');
  eq(Ru.equipIssue(h, 'fx_sh_h5', 'shield'), '両手持ちの武器を装備している。', 'shield refused with 2H');
  ok(!Ru.canEquip(h, 'fx_sh_h5'), 'canEquip false');
  // 2H in weapon2 also blocks the shield
  Ru.equip(h, 'weapon1', 'fx_sword_5');
  ok(Ru.canEquip(h, 'fx_sh_h5', 'shield'), 'shield ok again');
  Ru.equip(h, 'shield', 'fx_sh_h5');
  const r2 = Ru.equip(h, 'weapon2', 'fx_spear_5');
  eq([r2.ok, r2.shieldRemoved, h.equip.shield], [true, 'fx_sh_h5', null], 'weapon2 2H removes shield');
  ok(Ru.hasTwoHanded(h), 'hasTwoHanded');
  // two 2H weapons are fine
  St.addItem('fx_bow_5');
  eq(Ru.equip(h, 'weapon1', 'fx_bow_5').ok, true, 'spear + bow');
  // same item in two slots needs two copies
  Ru.equip(h, 'weapon2', null); Ru.equip(h, 'weapon1', 'fx_sword_5');
  eq(Ru.equip(h, 'weapon2', 'fx_sword_5').ok, false, 'second copy missing');
  St.addItem('fx_sword_5');
  eq(Ru.equip(h, 'weapon2', 'fx_sword_5').ok, true, 'second copy');
  // take off → inventory, same item → no-op
  eq(Ru.equip(h, 'weapon2', 'fx_sword_5').removed, [], 'same item no-op');
  const c0 = St.count('fx_sword_5');
  eq(Ru.equip(h, 'weapon2', null).removed, ['fx_sword_5'], 'take off');
  eq(St.count('fx_sword_5'), c0 + 1, 'back in inv');
  // 99 cap: taking off refused, nothing changes
  St.addItem('fx_axe_5', 1); Ru.equip(h, 'weapon2', 'fx_axe_5');
  g.inv.fx_axe_5 = 99;
  const snap = clone({ e: h.equip, i: g.inv });
  const r3 = Ru.equip(h, 'weapon2', null);
  eq([r3.ok, r3.reason], [false, 'これ以上は持てない。'], '99 cap');
  eq(clone({ e: h.equip, i: g.inv }), snap, 'nothing changed on failure');
  // unknown slot
  eq(Ru.equip(h, 'weapon', 'fx_sword_5').ok, false, 'old slot name refused');
  // only / gender
  const m = Ru.newChar({ id: 'fx_mage' }), w = Ru.newChar({ id: 'fx_warrior' });
  ok(Ru.canEquip(m, 'fx_only', 'acc1') && !Ru.canEquip(w, 'fx_only', 'acc1'), 'only');
  ok(Ru.canEquip(m, 'fx_gender', 'head') && !Ru.canEquip(w, 'fx_gender', 'head'), 'gender');
  eq(Ru.equipIssue(w, 'fx_only', 'acc1'), 'テスト剣には装備できない。', 'only reason');
  // reach / isTwoHanded
  eq([Ru.reach('fx_spear_5'), Ru.reach('fx_whip_5'), Ru.reach('fx_sword_5'), Ru.reach(null)], ['any', 'any', 'front', 'front'], 'reach');
  eq([Ru.isTwoHanded('fx_bow_5'), Ru.isTwoHanded('fx_whip_5'), Ru.isTwoHanded('fx_herb')], [true, false, false], 'isTwoHanded');
  // defaultSlot
  const d = Ru.newChar({ id: 'fx_warrior' });
  eq(Ru.defaultSlot(d, 'fx_axe_5'), 'weapon2', 'first empty weapon slot');
  eq(Ru.defaultSlot(d, 'fx_i_acc_n'), 'acc1', 'first empty acc slot');
});

test('equip: HP follows a vit change; unequipAll keeps pieces over 99', () => {
  const g = fresh([]);
  const h = St.hero();
  St.addItem('fx_body_h5');
  const hp0 = Ru.stats(h).hp;
  Ru.equip(h, 'body', 'fx_body_h5');
  const hp1 = Ru.stats(h).hp;
  ok(hp1 > hp0, 'vit body raises max HP');
  h.hp = hp1;
  Ru.equip(h, 'body', null);
  ok(h.hp <= Ru.stats(h).hp, 'hp clamped after taking off');
  ok(h.hp >= 1, 'alive stays alive');
  // unequipAll
  const eqd = Object.values(h.equip).filter(Boolean);
  g.inv[eqd[0]] = 99;
  const r = Ru.unequipAll(h);
  eq(r.ok, false, 'one piece kept');
  eq(r.kept.length, 1, 'kept one slot');
  eq(r.removed.length, eqd.length - 1, 'others removed');
});

test('previewStats: equals stats after − before, touches nothing (§3.3.3)', () => {
  const g = fresh(['brigitta']);
  const h = St.hero();
  for (const id of ['fx_sword_5', 'fx_gs_5', 'fx_axe_5', 'fx_body_c5', 'fx_head_h5', 'fx_sh_c5', 'fx_i_acc_s', 'fx_acc_a', 'fx_spear_5']) St.addItem(id);
  const snap = clone({ e: h.equip, i: g.inv, hp: h.hp });
  for (const id of Object.keys(g.inv)) {
    for (const slot of Ru.slotsFor(id)) {
      const d = Ru.previewStats(h, slot, id);
      eq(Object.keys(d), Ru.DIFF_KEYS, 'keys ' + id);
      const v = clone(h);
      v.equip[slot] = id;
      if (Ru.isTwoHanded(id) && (slot === 'weapon1' || slot === 'weapon2')) v.equip.shield = null;
      eq(d, Ru.diffStats(Ru.stats(h), Ru.stats(v)), 'diff ' + id + '@' + slot);
    }
  }
  const off = Ru.previewStats(h, 'weapon1', null);
  eq(off.atk1, Ru.stats(Object.assign(clone(h), { equip: Object.assign(clone(h.equip), { weapon1: null }) })).w.fist.atk - Ru.stats(h).atk1, 'taking off → fist');
  const gs = Ru.previewStats(h, 'weapon1', 'fx_gs_5');
  ok(gs.def < 0 && gs.eva < 0, 'the shield a 2H weapon pushes off is counted');
  eq(clone({ e: h.equip, i: g.inv, hp: h.hp }), snap, 'nothing changed');
});

test('optimize: pure, keeps accessories/quirks/types, score never drops (§4.4.1, §4.17.3 J)', () => {
  const g = fresh(['brigitta', 'marta', 'sylvain']);
  const h = St.hero();
  const add = ['fx_sword_3', 'fx_sword_5', 'fx_sword_n', 'fx_axe_5', 'fx_gs_5', 'fx_spear_5', 'fx_bow_5', 'fx_staff_5', 'fx_staff_n', 'fx_whip_5',
    'fx_body_h5', 'fx_body_c5', 'fx_head_h5', 'fx_head_c5', 'fx_sh_h5', 'fx_sh_c5', 'fx_hands_l5', 'fx_feet_l5', 'fx_i_body_n', 'fx_i_head_n', 'fx_i_sh_n',
    'fx_sword_q', 'fx_body_q', 'fx_sword_seal', 'fx_i_acc_s', 'fx_acc_a', 'fx_s_body_n', 'fx_s_head_n', 'fx_i_hands_n', 'fx_i_feet_n'];
  for (const id of add) St.addItem(id, 1);
  h.equip.acc1 = 'fx_acc_b';
  const all = () => clone({ party: g.party, reserve: g.reserve, inv: g.inv });
  for (const c of g.party) {
    for (const mode of ['phys', 'magic', 'balance']) {
      const snap = all();
      const s0 = Ru.loadoutScore(Ru.stats(c), mode);
      const plan = Ru.optimize(c, mode);
      eq(all(), snap, c.id + ' ' + mode + ': optimize is pure');
      eq(plan.mode, mode, 'mode');
      eq(Object.keys(plan.equip), ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet'], '7 slots, no accessories');
      ok(plan.score >= Math.round(s0 * 100) / 100 - 1e-6, c.id + ' ' + mode + ' score ' + plan.score + ' ≥ ' + s0);
      for (const s of ['weapon1', 'weapon2']) {
        const a = DB.items[c.equip[s]], b = DB.items[plan.equip[s]];
        if (!a) ok(!b || (s === 'weapon2' && !b), s + ' empty stays empty');
        else if (b) eq(b.wtype, a.wtype, s + ' keeps its weapon type');
      }
      for (const ch of plan.changes) {
        ok(!ch.to || !DB.items[ch.to].quirk, 'no quirk items: ' + ch.to);
        ok(!ch.to || g.inv[ch.to] > 0 || Object.values(c.equip).includes(ch.to), 'only own/inventory items: ' + ch.to);
      }
      if (plan.equip.shield) ok(!['weapon1', 'weapon2'].some((s) => plan.equip[s] && Ru.isTwoHanded(plan.equip[s])), 'no shield with 2H');
      // diff = stats of the plan − now
      const v = clone(c); Object.assign(v.equip, plan.equip);
      eq(plan.diff, Ru.diffStats(Ru.stats(c), Ru.stats(v)), 'plan.diff');
    }
  }
  // phys picks the strongest sword, magic keeps the type (sword) but prefers mag armor
  const pp = Ru.optimize(h, 'phys');
  eq(pp.equip.weapon1, 'fx_sword_n', 'phys: best sword');
  const pm = Ru.optimize(h, 'magic');
  ok(DB.items[pm.equip.body].weight === 'cloth', 'magic: cloth body ' + pm.equip.body);
  // apply → equipment equals the plan, accessories untouched, inventory conserved
  const count = () => { const t = {}; for (const c of St.all()) for (const s of Ru.SLOTS) if (c.equip[s]) t[c.equip[s]] = (t[c.equip[s]] || 0) + 1; for (const id in g.inv) t[id] = (t[id] || 0) + g.inv[id]; return Object.keys(t).sort().map((k) => k + ':' + t[k]).join(' '); };
  const total = count();
  const r = Ru.applyLoadout(h, pp);
  eq(r.ok, true, 'applyLoadout ok');
  for (const s in pp.equip) eq(h.equip[s], pp.equip[s], 'applied ' + s);
  eq(h.equip.acc1, 'fx_acc_b', 'acc1 untouched');
  eq(count(), total, 'items conserved');
  eq(Ru.optimize(h, 'phys').changes, [], 'optimal after apply');
  // a quirk item in a slot locks that slot
  St.addItem('fx_sword_q', 1);
  Ru.equip(h, 'weapon1', 'fx_sword_q');
  const pq = Ru.optimize(h, 'phys');
  eq(pq.equip.weapon1, 'fx_sword_q', 'quirk slot locked');
  // failure rolls back: inventory full of the old item
  Ru.equip(h, 'weapon1', 'fx_sword_3');
  const plan = Ru.optimize(h, 'phys');
  ok(plan.changes.some((c) => c.slot === 'weapon1'), 'weapon1 would change');
  g.inv.fx_sword_3 = 99;
  const snap = clone({ e: h.equip, i: g.inv });
  const rf = Ru.applyLoadout(h, plan);
  eq(rf.ok, false, 'apply fails at 99');
  eq(clone({ e: h.equip, i: g.inv }), snap, 'rolled back');
});

test('optimize: two-handed weapon2 vs shield (§4.4.1)', () => {
  const g = fresh([]);
  const c = Ru.newChar({ id: 'fx_warrior', level: 20 });
  g.party.push(c);
  c.equip = Ru.emptyEquip();
  c.equip.weapon1 = 'fx_sword_5'; c.equip.weapon2 = 'fx_spear_1';
  // a strong shield in the bag: "weapon2 off, shield on" wins for magic
  St.addItem('fx_sh_c5'); St.addItem('fx_sh_h5');
  const pm = Ru.optimize(c, 'magic');
  eq([pm.equip.weapon2, pm.equip.shield], [null, 'fx_sh_c5'], 'magic: weapon2 off, cloth shield on');
  const pp = Ru.optimize(c, 'phys');
  ok(pp.equip.weapon2 === 'fx_spear_1' || pp.equip.shield, 'phys chooses one of the two');
  const s0 = Ru.loadoutScore(Ru.stats(c), 'phys');
  ok(pp.score >= s0, 'phys score ≥ now');
  const r = Ru.applyLoadout(c, pm);
  eq([r.ok, c.equip.weapon2, c.equip.shield], [true, null, 'fx_sh_c5'], 'applied');
  // the stronger of two same-type weapons goes to weapon1 (items c wears are candidates, §4.4.1)
  c.equip.weapon1 = 'fx_sword_3'; c.equip.weapon2 = 'fx_sword_5'; c.equip.shield = null;
  for (const k of Object.keys(g.inv)) delete g.inv[k];
  const inv0 = clone(g.inv);
  const psw = Ru.optimize(c, 'phys');
  eq([psw.equip.weapon1, psw.equip.weapon2], ['fx_sword_5', 'fx_sword_3'], 'weapons swap places');
  eq(g.inv, inv0, 'optimize stays pure');
  const rsw = Ru.applyLoadout(c, psw);
  eq([rsw.ok, c.equip.weapon1, c.equip.weapon2, rsw.removed], [true, 'fx_sword_5', 'fx_sword_3', []], 'swap applied, nothing removed');
  eq(g.inv, inv0, 'inventory unchanged by a swap');
  eq(Ru.optimize(c, 'phys').changes, [], 'no swap back');
  eq(Ru.optimize(c, 'magic').changes, [], 'no swap when the score is the same (magic ignores weapon atk)');
  // weapon1 two-handed → no shield ever
  c.equip.weapon1 = 'fx_gs_5'; g.inv.fx_gs_5 = 0; c.equip.shield = null;
  const pg = Ru.optimize(c, 'magic');
  eq(pg.equip.shield, null, 'no shield with a 2H weapon1');
});

test('optimize: J over the real roster with the real shop gear (§4.17.3 J)', () => {
  if (!hasReal('companions', 20) || !hasReal('items', 100)) return;
  const g = fresh(['selma', 'teo', 'brigitta']);
  for (const c of Pa.candidates()) if (!c.startsWith('fx_')) Pa.recruit(c);
  // every normal item up to T4, a few rares and quirks
  for (const id in DB.items) {
    const it = DB.items[id];
    if (id.startsWith('fx_') || !Ru.EQUIP_TYPES.includes(it.type)) continue;
    if ((it.src === 'shop' && it.tier <= 4) || (it.grade !== 'normal' && it.tier <= 4 && R.U.r() < 0.3)) St.addItem(id, 1);
  }
  let plans = 0;
  for (const c of St.all()) {
    for (const mode of ['phys', 'magic', 'balance']) {
      const others = clone(St.all().filter((o) => o !== c).map((o) => o.equip));
      const acc = [c.equip.acc1, c.equip.acc2];
      const s0 = Ru.loadoutScore(Ru.stats(c), mode);
      const plan = Ru.optimize(c, mode);
      plans++;
      ok(plan.score >= Math.round(s0 * 100) / 100 - 1e-6, c.id + ' ' + mode + ' score');
      const r = Ru.applyLoadout(c, plan);
      ok(r.ok, c.id + ' apply');
      eq([c.equip.acc1, c.equip.acc2], acc, c.id + ' accessories unchanged');
      for (const s of Ru.SLOTS) if (c.equip[s]) ok(!DB.items[c.equip[s]].quirk || plan.changes.every((ch) => ch.to !== c.equip[s]), 'no quirk put on');
      eq(clone(St.all().filter((o) => o !== c).map((o) => o.equip)), others, c.id + ' did not take others\' gear');
    }
  }
  ok(plans >= 60, 'plans ' + plans);
});

test('mods: merging and personal caps (§3.3.16)', () => {
  const c = bare('fx_mage', 1);
  c.equip.acc1 = 'fx_acc_a'; c.equip.acc2 = 'fx_acc_b';
  const m = Ru.mods(c);
  eq(m.expPct, 30, 'expPct 10 innate + 20 + 20 → cap 30');
  eq(m.glimPct, { tech: 40, sword: 10 }, 'glimPct per key cap 40');
  eq(m.profPct, { sword: 50 }, 'profPct cap 50');
  eq(m.elemResist, { fire: 0, water: 0.75 }, 'elemResist min (a 1.5 weakness loses to 0.75)');
  eq(m.statusImmune, ['poison', 'sleep'], 'lists unique');
  eq(m.statusResist, { sleep: 0.75 }, 'maps add');
  eq([m.mpCostPct, m.wpCostPct], [-50, -50], 'cost cap −50');
  eq(m.encounterPct, -50, 'encounter clamp');
  eq(m.autoSteal, 100, 'autoSteal cap');
  eq(m.goldPct, 200, 'party keys are not capped per person');
  eq(m.noFloorDamage, true, 'booleans');
  // innate: companion innate.mods / hero type mods
  eq(Ru.mods(bare('fx_warrior', 1)).goldPct, 10, 'companion innate');
  if (hasReal('companions', 20)) {
    eq(Ru.mods(Ru.newChar({ id: 'titta' })).autoSteal, 100, 'titta autoSteal');
    eq(Ru.mods(Ru.newChar({ id: 'shigure' })).statusImmune, ['blind'], 'shigure blind');
  }
});

test('mods: party sums, caps, reserve excluded (§3.3.16, §5.3.4)', () => {
  const g = fresh([]);
  const a = Ru.newChar({ id: 'fx_warrior' }), b = Ru.newChar({ id: 'fx_mage' });
  g.party.push(a, b);
  a.equip.acc1 = 'fx_acc_a'; b.equip.acc1 = 'fx_acc_b'; a.equip.acc2 = 'fx_acc_b';
  const pm = Ru.partyMods();
  eq(pm.goldPct, 150, 'goldPct cap 150');
  eq(pm.dropPct, 150, 'dropPct cap');
  eq(pm.preemptPct, 30, 'preempt cap 30');
  eq(pm.escapePct, 150, 'escape uncapped');
  eq(Pa.mod('goldPct'), 150, 'Party.mod reads partyMods');
  b.hp = 0;
  eq(Ru.partyMods().escapePct, 100, 'the fallen do not count');
  b.hp = 1;
  a.equip.acc1 = 'fx_acc_poor'; a.equip.acc2 = 'fx_acc_poor'; b.equip.acc1 = 'fx_acc_poor';
  eq(Ru.partyMods().goldPct, -100, 'quirk sums stop at −100 (never a negative reward)');
  // reserve innate does not count
  const g2 = fresh([]);
  const r = Ru.newChar({ id: 'fx_warrior' });
  g2.reserve.push(r);
  eq(Pa.mod('goldPct'), 0, 'reserve innate excluded');
  eq(Pa.mod('encounterPct'), 0, 'reserve encounter excluded');
});

test('mods: fieldMods encounterPct rule (§3.3.4)', () => {
  if (!hasReal('companions', 20)) return;
  const g = fresh(['rouga', 'sylvain']);
  eq(Pa.fieldMods().encounterPct, 0, 'Rouga +25 and Sylvain −25 cancel');
  St.char('rouga').equip.acc1 = 'fx_acc_lure';
  eq(Pa.fieldMods().encounterPct, 50, '+50 wins');
  St.char('sylvain').equip.acc1 = 'fx_acc_a';
  eq(Pa.fieldMods().encounterPct, 0, '+50 and −50 cancel');
  St.char('rouga').hp = 0;
  eq(Pa.fieldMods().encounterPct, -50, 'fallen ignored');
  eq(Pa.fieldMods().walkHeal, 2, 'walkHeal max');
  eq(Pa.fieldMods().noFloorDamage, true, 'noFloorDamage anyone');
  g.party = [St.hero()];
  eq(Pa.fieldMods(), { encounterPct: 0, walkHeal: 0, noFloorDamage: false }, 'none');
});

test('commands, tech/spell lists, costs, rows (§3.3.3)', () => {
  const g = fresh([]);
  const c = Ru.newChar({ id: 'fx_warrior' });
  g.party.push(c);
  c.equip = Ru.emptyEquip();
  eq(Ru.commands(c).map((x) => [x.type, x.slot, x.wtype]), [['weapon', null, 'fist'], ['defend', undefined, undefined], ['item', undefined, undefined]], 'bare hands → 体術');
  eq(Ru.commands(c)[0].name, '体術', 'name 体術');
  c.equip.weapon2 = 'fx_bow_5';
  eq(Ru.commands(c).map((x) => x.slot), ['weapon2', undefined, undefined], 'one weapon only: no fist command');
  c.equip.weapon1 = 'fx_sword_seal';
  c.spells = ['fx_s_cost'];
  const cm = Ru.commands(c);
  eq(cm.map((x) => x.type), ['weapon', 'weapon', 'spell', 'defend', 'item'], 'weapon1 weapon2 術 防御 道具');
  eq([cm[0].name, cm[1].name, cm[0].sealed], [DB.weaponTypes.sword ? DB.weaponTypes.sword.name : '剣', DB.weaponTypes.bow ? DB.weaponTypes.bow.name : '弓', true], 'names from weaponTypes; sealed');
  c.techs = ['fx_t_high', 'fx_t_cost'];
  eq(Ru.techList(c, 'sword'), ['fx_t_cost', 'fx_t_high'], 'tech order');
  eq(Ru.techList(c, 'sword', 'weapon1'), [], 'sealTech slot → no techs');
  eq(Ru.techList(c, 'bow'), [], 'other type');
  c.equip.acc1 = 'fx_acc_nospell';
  ok(!Ru.commands(c).some((x) => x.type === 'spell'), 'noSpell hides 術');
  c.equip.acc1 = null;
  c.spells = ['fx_s_triple', 'fx_s_cost', 'fx_s_pair'];
  eq(Ru.spellList(c), ['fx_s_cost', 'fx_s_pair', 'fx_s_triple'], 'spell order');
  eq(Ru.fieldSpells(c), ['fx_s_cost'], 'field spells');
  for (const w of Ru.WTYPES) {
    const data = Object.keys(DB.actions).filter((id) => !id.startsWith('fx_') && DB.actions[id].kind === 'tech' && DB.actions[id].wtype === w);
    if (data.length) eq(Ru.techList({ techs: data.slice().reverse(), equip: Ru.emptyEquip() }, w), data, 'tech data order ' + w);
  }
  if (DB.actions.s_fire_1 && DB.actions.s_fire_2 && DB.actions.s_water_1) {
    c.spells = ['s_water_1', 's_fire_2', 's_fire_1'];
    eq(Ru.spellList(c), ['s_fire_1', 's_fire_2', 's_water_1'], 'real spell order (§7.2.2)');
  }
  // costs: wp 5 × (1 − 0.35) → floor 3; mp 7 × 0.5 → 3; raise rounds up
  eq([Ru.wpCost(c, 'fx_t_cost'), Ru.mpCost(c, 'fx_s_cost')], [5, 7], 'base costs');
  c.equip.acc1 = 'fx_acc_a';
  eq([Ru.wpCost(c, 'fx_t_cost'), Ru.mpCost(c, 'fx_s_cost')], [3, 4], '−35%');
  c.equip.acc2 = 'fx_acc_b';
  eq([Ru.wpCost(c, 'fx_t_cost'), Ru.mpCost(c, 'fx_s_cost')], [2, 3], '−50% cap');
  c.equip.acc1 = 'fx_acc_cost_up'; c.equip.acc2 = null;
  eq([Ru.wpCost(c, 'fx_t_cost'), Ru.mpCost(c, 'fx_s_cost')], [7, 9], '+25% rounds up');
  eq(Ru.mpCost(c, 'nope'), 0, 'unknown action 0');
  // rows
  const h = St.hero();
  h.row = 'front'; c.row = 'middle';
  eq(Ru.effectiveRow(c), 'middle', 'middle with a living front');
  h.hp = 0;
  eq(Ru.effectiveRow(c), 'front', 'middle counts as front when the front is down');
  eq(Ru.effectiveRow(h), 'front', 'front');
  eq(Ru.effectiveRow({ row: 'middle', hp: 5 }, [{ row: 'middle', hp: 5 }, { row: 'front', hp: 3 }]), 'middle', 'unit-like objects');
});

test('newChar: hero rules for every type × favor (§5.2.4, §5.2.7)', () => {
  if (!hasReal('heroTypes', 5)) return;
  const kit = DB.starterKit;
  const pair = kit.pair;
  const S = { S: 4, A: 3, B: 2, C: 1, D: 0 };
  for (const type in DB.heroTypes) {
    const T = DB.heroTypes[type];
    for (const kind of ['weapon', 'element']) {
      for (const id of (T.favorOptions && T.favorOptions[kind]) || []) {
        const c = Ru.newChar({ id: 'hero', heroSpec: { name: 'ラーク', gender: 'f', type, favor: { kind, id } } });
        const L = Ru.aptLetters(c);
        const tag = type + '/' + kind + ':' + id;
        eq([c.name, c.gender, c.heroType, c.favor], ['ラーク', 'f', type, { kind, id }], tag + ' identity');
        eq(L[kind === 'weapon' ? 'w' : 'e'][id], 'S', tag + ' favor S');
        if (T.pairElement && kind === 'element') eq(L.e[pair[id]], 'A', tag + ' pair A');
        const wsum = Ru.WTYPES.reduce((a, w) => a + S[L.w[w]], 0), esum = Ru.ELEMENTS.reduce((a, e) => a + S[L.e[e]], 0);
        ok(wsum >= 15 && wsum <= 19 && esum >= 8 && esum <= 12 && wsum + esum >= 26 && wsum + esum <= 27, tag + ' aptitude budget ' + wsum + '/' + esum);
        const prof = kind === 'weapon' ? c.wprof : c.eprof;
        eq(prof[id], 15, tag + ' prof 15');
        for (const w of Ru.WTYPES) eq(c.wprof[w], ({ S: 15, A: 5 })[L.w[w]] || 0, tag + ' wprof ' + w);
        for (const e of Ru.ELEMENTS) eq(c.eprof[e], ({ S: 15, A: 5 })[L.e[e]] || 0, tag + ' eprof ' + e);
        const w1 = kind === 'weapon' ? kit.weapon[id] : T.defaultWeapon;
        if (DB.items[w1]) eq(c.equip.weapon1, w1, tag + ' weapon1');
        if (Ru.isTwoHanded(c.equip.weapon1)) eq(c.equip.shield, null, tag + ' no shield with 2H');
        else if (DB.items[T.startEquip.shield]) eq(c.equip.shield, T.startEquip.shield, tag + ' shield');
        const wantT = (kind === 'weapon' ? [kit.tech[id]] : []).concat(T.onFavor[kind].techs).filter((x) => DB.actions[x]);
        const wantS = (kind === 'element' ? [kit.spell[id]] : []).concat(T.onFavor[kind].spells).filter((x) => DB.actions[x]);
        eq(c.techs, wantT, tag + ' techs'); eq(c.spells, wantS, tag + ' spells');
        const row = T.row === 'auto' ? (Ru.reach(c.equip.weapon1) === 'any' || kind === 'element' ? 'middle' : 'front') : T.row;
        eq(c.row, row, tag + ' row');
        const s = Ru.stats(c);
        eq([c.hp, c.mp, c.wp, c.level, c.exp], [s.hp, s.mp, s.wp, 1, 0], tag + ' full at Lv1');
        eq(Ru.baseStats(c), T.stats, tag + ' base stats from the type');
        eq(Pa.spriteKey(c), 'party:hero_f_' + type, tag + ' sprite');
      }
    }
  }
  // defaults
  const d = Ru.newChar({ id: 'hero' });
  eq([d.name, d.heroType, d.favor], [DB.config.defaultHero.name, DB.config.defaultHero.type, DB.config.defaultHero.favor], 'default hero');
});

test('newChar: companions (§5.3.5, §5.0 0.6)', () => {
  if (!hasReal('companions', 20)) return;
  for (const id of Pa.candidates().filter((x) => !x.startsWith('fx_'))) {
    const D = DB.companions[id];
    const c = Ru.newChar({ id });
    eq([c.name, c.gender, c.row], [D.name, D.gender, D.row], id + ' identity');
    for (const s of Ru.SLOTS) if (D.startEquip[s] && DB.items[D.startEquip[s]]) eq(c.equip[s], D.startEquip[s], id + ' ' + s);
    ok(!(c.equip.shield && Ru.hasTwoHanded(c)), id + ' no shield + 2H');
    eq(c.techs, D.startTechs.filter((t) => DB.actions[t]), id + ' techs');
    eq(c.spells, D.startSpells.filter((t) => DB.actions[t]), id + ' spells');
    for (const w of Ru.WTYPES) eq(c.wprof[w], ({ S: 15, A: 5 })[D.apt.w[w]] || 0, id + ' wprof ' + w);
    const A = Ru.aptitude(c), MUL = { S: 2, A: 1.5, B: 1, C: 0.6, D: 0.3 };
    for (const w of Ru.WTYPES) eq(A.w[w], MUL[D.apt.w[w]], id + ' apt ' + w);
    for (const e of Ru.ELEMENTS) eq(A.e[e], MUL[D.apt.e[e]], id + ' apt ' + e);
    eq(Pa.spriteKey(c), 'party:' + (D.sprite || id), id + ' sprite');
    eq(Pa.faceKey(c), 'face:' + (D.sprite || id), id + ' face');
  }
  const c5 = Ru.newChar({ id: 'marta', level: 12 });
  eq([c5.level, c5.exp], [12, Ru.expForLevel(12)], 'level option');
  eq(Ru.aptitude(Ru.newChar({ id: 'fx_mage' })).e, { fire: 2, water: 0.6, wind: 0.6, earth: 1.5, light: 0.6, dark: 1 }, 'aptitude multipliers');
});

test('proficiency: train points, profPct, catch-up (§4.9.1)', () => {
  const g = fresh([]);
  const c = Ru.newChar({ id: 'fx_warrior' });
  g.party.push(c);
  c.wprof.sword = 0; c.equip.weapon1 = 'fx_sword_5';
  // below PEXP(0)=15 the gain doubles
  Ru.train(c, { kind: 'attack', slot: 'weapon1' });
  eq(c.wprof.sword, 2, 'attack +1 ×2 (catch-up)');
  Ru.train(c, { kind: 'tech', wtype: 'sword', actionId: 'fx_t_high' });
  eq(c.wprof.sword, 6, 'lv≥6 tech +2 ×2');
  c.wprof.sword = 20;
  Ru.train(c, { kind: 'attack', wtype: 'sword' });
  eq(c.wprof.sword, 21, 'no catch-up at 20 ≥ PEXP(0)');
  c.equip.acc1 = 'fx_acc_a';                      // profPct sword +40
  Ru.train(c, { kind: 'attack', wtype: 'sword' });
  eq(c.wprof.sword, 22.4, 'profPct +40%');
  c.equip.acc1 = null;
  // spells: single 1–2段 +1, 3–5段 +2, pair +2 each, triple +3 each, stone +1
  for (const e of Ru.ELEMENTS) c.eprof[e] = 100;
  Ru.train(c, { kind: 'spell', actionId: 'fx_s_cost' }); eq(c.eprof.fire, 101, 'single step 1: +1');
  Ru.train(c, { kind: 'spell', actionId: 'fx_s_step3' }); eq(c.eprof.fire, 103, 'single step 3: +2');
  Ru.train(c, { kind: 'spell', actionId: 'fx_s_pair' }); eq([c.eprof.fire, c.eprof.wind], [105, 102], 'pair +2 each');
  Ru.train(c, { kind: 'spell', actionId: 'fx_s_triple' }); eq([c.eprof.fire, c.eprof.wind, c.eprof.light], [108, 105, 103], 'triple +3 each');
  Ru.train(c, { kind: 'spell', elements: ['earth'], stone: true }); eq(c.eprof.earth, 101, 'stone +1');
  // bare hands train 体術
  c.equip = Ru.emptyEquip(); c.wprof.fist = 50;
  Ru.train(c, { kind: 'attack', slot: null });
  eq(c.wprof.fist, 51, 'bare hands → fist');
  // rank ups reported; ranks per PROF_PTS
  c.wprof.axe = 4.5;
  const ups = Ru.train(c, { kind: 'attack', wtype: 'axe' });
  eq(ups, [{ kind: 'w', id: 'axe', rank: 1 }], 'rank up reported');
  eq([0, 4.9, 5, 14, 15, 459, 460, 999].map(Ru.profRank), [0, 0, 1, 1, 2, 9, 10, 10], 'profRank');
  c.wprof.axe = 998.5;
  Ru.train(c, { kind: 'attack', wtype: 'axe' });
  eq(c.wprof.axe, 999, 'cap 999');
  // PEXP follows R.Tier.effective()
  g.regionsCleared = ['r_forest', 'r_desert', 'r_snow']; g.tier = 3;
  eq(Ru.pexp(), 100, 'PEXP(3)');
  g.gameClear = true;
  eq(Ru.pexp(), 400, 'PEXP(9) after the ending');
});

test('recruit: first three vs later (catch-up), levels, reserve (§5.5.2)', () => {
  if (!hasReal('companions', 20)) return;
  const g = fresh([]);
  const h = St.hero();
  Ru.setLevel(h, 30);
  g.regionsCleared = ['r_forest', 'r_desert', 'r_snow', 'r_marsh']; g.tier = 4;
  const seen = [];
  R.on('recruit', (c) => seen.push(c.id));
  const a = Pa.recruit('selma');
  eq(a.level, 27, 'joinLevel floor(30 × 0.9)');
  eq(a.wprof.sword, 15, 'first three: start prof only (S 15)');
  Pa.recruit('marta'); Pa.recruit('teo');
  const d = Pa.recruit('boden');
  eq(g.party.length, 4, 'party full'); eq(g.reserve.map((c) => c.id), ['boden'], 'the 4th goes to the reserve');
  const L = Ru.aptLetters(d), P = K.PEXP[4];
  for (const w of Ru.WTYPES) eq(d.wprof[w], Math.max(({ S: 15, A: 5 })[L.w[w]] || 0, Math.round(P * K.JOIN_PROF[L.w[w]])), 'catch-up ' + w);
  eq(d.eprof.earth, Math.round(135 * 0.8), 'S earth → 108');
  ok(St.flag('joined_boden'), 'joined flag');
  eq(seen, ['selma', 'marta', 'teo', 'boden'], 'recruit events');
  eq(Pa.recruit('boden'), d, 'no duplicate');
  eq(Pa.recruit('nobody'), null, 'unknown');
  const e = Pa.recruit('noela', { toParty: false });
  eq(g.reserve.map((c) => c.id), ['boden', 'noela'], 'reserve in join order');
  const s = Ru.stats(e);
  eq([e.hp, e.mp, e.wp], [s.hp, s.mp, s.wp], 'full HP/MP/WP');
  eq(Pa.joinLevel(), 27, 'joinLevel()');
  eq(Pa.unrecruited().includes('selma'), false, 'unrecruited');
  eq(Pa.isRecruited('noela'), true, 'isRecruited');
});

test('party: setParty, swap, order, rows, canSwapHere (§3.3.4, §5.5.3)', () => {
  if (!hasReal('companions', 20)) return;
  const g = fresh(['selma', 'marta', 'teo']);
  Pa.recruit('boden'); Pa.recruit('noela');
  let changes = 0;
  R.on('partyChange', () => changes++);
  const bo = St.char('boden');
  bo.hp = 0; bo.mp = 0; bo.row = 'front';
  eq(Pa.swap('hero', 'boden'), false, 'the hero cannot leave');
  eq(Pa.swap('selma', 'boden'), true, 'swap');
  eq(g.party.map((c) => c.id), ['hero', 'marta', 'teo', 'boden'], 'newcomer at the end');
  eq(g.reserve.map((c) => c.id), ['selma', 'noela'], 'reserve in join order');
  eq([bo.hp, bo.mp], [Ru.stats(bo).hp, Ru.stats(bo).mp], 'newcomer healed');
  eq(bo.row, DB.companions.boden.row, 'row from data');
  eq(Pa.toParty('noela'), false, 'party full');
  eq(Pa.toReserve('teo'), true, 'to reserve');
  eq(Pa.toParty('noela'), true, 'to party');
  eq(g.party.length, 4, '4 again');
  eq(Pa.setParty(['marta', 'selma']), false, 'without the hero refused');
  eq(Pa.setParty(['hero', 'hero']), false, 'duplicates refused');
  eq(Pa.setParty(['hero', 'a', 'b', 'c', 'd']), false, 'more than 4 refused');
  eq(Pa.setParty(['hero', 'nobody']), false, 'unrecruited refused');
  eq(Pa.setParty(['selma', 'hero']), true, 'setParty');
  eq(g.party.map((c) => c.id), ['selma', 'hero'], 'order as given');
  eq(g.reserve.map((c) => c.id), ['marta', 'teo', 'boden', 'noela'], 'the rest in join order');
  eq(Pa.setOrder(['hero', 'selma']), true, 'setOrder');
  eq(g.party[0].id, 'hero', 'reordered');
  eq(Pa.setOrder(['hero', 'marta']), false, 'setOrder must keep members');
  eq(Pa.setRow('selma', 'middle'), true, 'setRow');
  eq(St.char('selma').row, 'middle', 'row set');
  eq(Pa.setRow('selma', 'back'), false, 'bad row');
  ok(changes >= 6, 'partyChange emitted');
  // invariants
  const ids = St.all().map((c) => c.id);
  eq(new Set(ids).size, ids.length, 'no one twice');
  ok(g.party.some((c) => c.id === 'hero'), 'hero in party');
  // canSwapHere by map type
  const at = (m) => { g.pos.map = m; return Pa.canSwapHere(); };
  eq([at('fx_town'), at('fx_castle'), at('fx_house'), at('fx_dun_1'), at('nowhere')], [true, true, false, false, false], 'canSwapHere');
});

test('EXP: battleExp, award shares, gainExp (§4.2.3, §5.5.4)', () => {
  const g = fresh([]);
  const a = Ru.newChar({ id: 'fx_warrior', level: 10 }), b = Ru.newChar({ id: 'fx_mage', level: 10 }), r = Ru.newChar({ id: 'fx_warrior', level: 8 });
  r.id = 'fx_warrior_r';
  g.party.push(a, b); g.reserve.push(r);
  const killed = [{ exp: 100, lv: 10 }, { exp: 50, lv: 12 }];
  eq(Ru.battleExp(a, killed), 100 + Math.round(50 * 1.2), 'Σ round(exp × f(d))');
  eq(Ru.battleExp(b, killed), Math.round((100 + 60) * 1.1), 'expPct +10 (innate)');
  eq(Ru.battleExp(a, [{ exp: 1, lv: 1 }], 0.6), 1, 'at least 1');
  // the §3.3.3 form battleExp(c, [monDef]): a monster def carries its 守備力 in `def` (a number)
  const md = { id: 'm_x', lv: 12, exp: 50, def: 30, hp: 99 };
  eq(Ru.battleExp(a, [md]), Math.round(50 * 1.2), 'a bare monster def (def = 守備力) counts');
  eq(Ru.battleExp(a, [{ def: md, golden: false }]), Math.round(50 * 1.2), '{def, golden} wrapper');
  if (R.Mon && R.Mon.def) {
    const mid = Object.keys(DB.monsters).find((id) => { const m = DB.monsters[id]; return m && !(m.flags || []).includes('boss'); });
    const d = mid && R.Mon.def(mid, { Lb: 10 });
    if (d && d.exp) eq(Ru.battleExp(a, [d]), Ru.battleExp(a, [{ def: d }]), 'R.Mon.def output directly = wrapped');
  }
  b.hp = 0;
  const res = Pa.award({ killed });
  const by = {}; for (const e of res) by[e.c.id] = e;
  eq(by.fx_warrior.exp, 160, 'active full');
  eq(by.fx_mage.exp, Math.round(160 * 0.6 * 1.1), 'fallen 60%');
  eq(by.fx_warrior_r.exp, Math.round((Math.round(100 * 1.2) + Math.round(50 * 1.4)) * 0.6), 'reserve 60% with its own level falloff');
  eq(by.fx_warrior_r.reserve, true, 'reserve flag');
  eq(b.hp, 0, 'fallen stays at 0 HP even on a level up');
  // members: non-members get the reserve share
  const res2 = Pa.award({ killed, members: ['hero'] });
  eq(res2.find((e) => e.c === a).exp, Math.round(160 * 0.6), 'non-member 60%');
  // level ups
  const c = Ru.newChar({ id: 'fx_warrior' });
  g.party.push(c);
  const lv = []; R.on('levelup', (x, l) => { if (x === c) lv.push(l); });
  c.hp = 5;
  const before = Ru.stats(c);
  const gx = Ru.gainExp(c, Ru.expForLevel(5));
  eq([gx.levels, c.level, gx.level], [4, 5, 5], 'to Lv5');
  const after = Ru.stats(c);
  eq(gx.gains, { hp: after.hp - before.hp, mp: after.mp - before.mp, wp: after.wp - before.wp }, 'gains = max diff');
  eq(c.hp, 5 + gx.gains.hp, 'current HP rises by the gain');
  eq(lv, [5], 'levelup emitted once');
  const outside = Ru.newChar({ id: 'fx_mage' }); let em = 0;
  R.on('levelup', (x) => { if (x === outside) em++; });
  Ru.gainExp(outside, 5000);
  eq(em, 0, 'no event for characters outside R.Game (simulations)');
  Ru.gainExp(c, 1e9);
  eq([c.level, c.exp], [99, Ru.expForLevel(99)], 'MAX_LEVEL cap');
  eq(Ru.expToNext(c), 0, 'expToNext at max');
});

test('afterBattle: win / escape / lose (§4.12.1)', () => {
  const g = fresh([]);
  const a = Ru.newChar({ id: 'fx_warrior', level: 20 }), b = Ru.newChar({ id: 'fx_mage', level: 20 });
  g.party.push(a, b);
  const sa = Ru.stats(a), sb = Ru.stats(b);
  a.hp = 3; a.mp = 0; a.wp = 0; a.status = { poison: 3 };
  b.hp = 0; b.mp = 1; b.wp = 1; b.status = { sleep: 2 };
  Pa.afterBattle('win');
  eq([a.hp, a.mp, a.wp], [sa.hp, Math.ceil(sa.mp * 0.1), Math.ceil(sa.wp * 0.1)], 'win: full HP, +10% MP/WP (ceil)');
  eq([b.hp, b.mp, b.wp], [0, 1, 1], 'fallen unchanged');
  eq([a.status, b.status], [{}, {}], 'statuses cleared');
  eq(a.counts.battles, 1, 'battle counted');
  a.hp = 1; a.mp = 0;
  Pa.afterBattle({ result: 'escape' });
  eq([a.hp, a.mp], [sa.hp, 0], 'escape: HP only');
  a.hp = 1; a.status = { stun: 1 };
  Pa.afterBattle('lose');
  eq([a.hp, a.status], [1, {}], 'lose: statuses only');
  a.mp = sa.mp - 1;
  Pa.afterBattle('win');
  eq(a.mp, sa.mp, 'MP capped at max');
  void sb;
});

test('State.check: every key (§3.2.3)', () => {
  if (!hasReal('companions', 20)) return;
  const g = fresh(['marta']);
  Pa.recruit('teo', { toParty: false });
  St.setFlag('a'); St.setVar('v', 3); St.setVar('neg', -2); St.addItem('fx_key');
  g.regionsCleared = ['r_forest', 'r_desert']; g.tier = 2;
  const T = [
    [null, true], [true, true], [false, false], ['a', true], ['!a', false], ['b', false], ['!b', true], [['a', '!b'], true], [['a', 'b'], false],
    [{ flag: 'a' }, true], [{ notFlag: 'a' }, false], [{ item: 'fx_key' }, true], [{ notItem: 'fx_key' }, false], [{ item: 'fx_herb' }, false],
    [{ all: ['a', { tier: 2 }] }, true], [{ any: ['b', { tier: 3 }] }, false], [{ any: ['b', 'a'] }, true],
    [{ tier: 2 }, true], [{ tier: 3 }, false], [{ tierBelow: 3 }, true], [{ tierBelow: 2 }, false],
    [{ cleared: 'r_forest' }, true], [{ cleared: 'r_snow' }, false], [{ notCleared: 'r_snow' }, true], [{ notCleared: 'r_desert' }, false],
    [{ member: 'marta' }, true], [{ member: 'teo' }, false], [{ recruited: 'teo' }, true], [{ recruited: 'ilse' }, false],
    [{ hero: 'm' }, true], [{ hero: 'f' }, false], [{ heroType: 'warrior' }, true], [{ heroType: 'mage' }, false],
    [{ var: 'v' }, true], [{ var: 'w' }, false], [{ var: 'v', gte: 3 }, true], [{ var: 'v', gte: 4 }, false], [{ var: 'v', lt: 4 }, true], [{ var: 'v', lt: 3 }, false],
    [{ var: 'v', eq: 3 }, true], [{ var: 'v', eq: 2 }, false], [{ postgame: true }, false], [{ postgame: false }, true],
    [{ flag: 'a', tier: 2, member: 'marta' }, true], [{ flag: 'a', tier: 5 }, false],
    ['', true], [{ var: 'neg' }, false], [{ var: 'neg', lt: 0 }, true],
  ];
  for (const [c, want] of T) eq(St.check(c), want, JSON.stringify(c));
  St.setFlag('game_clear');
  eq([g.gameClear, St.check({ postgame: true })], [true, true], 'game_clear flag sets gameClear');
  // equipment of the reserve counts for item conditions
  St.char('teo').equip.acc1 = 'fx_only';
  eq(St.check({ item: 'fx_only' }), true, 'reserve equipment counts');
});

test('inventory & gold (§3.3.2)', () => {
  const g = fresh([]);
  eq(St.addItem('fx_herb', 98), true, 'add 98');
  eq(St.addItem('fx_herb', 2), false, 'over 99 refused (all or nothing)');
  eq(St.count('fx_herb'), 98, 'unchanged');
  eq(St.room('fx_herb'), 1, 'room');
  eq(St.addItem('fx_herb'), true, 'to 99');
  eq(St.addItem('nothing'), false, 'unknown item');
  eq([St.addItem('fx_key'), St.addItem('fx_key'), St.count('fx_key')], [true, true, 1], 'key items stay at 1');
  eq(St.removeItem('fx_herb', 100), false, 'remove more than carried');
  eq(St.removeItem('fx_herb', 99), true, 'remove all');
  ok(!('fx_herb' in g.inv), 'key deleted at 0');
  St.addItem('fx_sword_5'); St.addItem('fx_feet_l5'); St.addItem('fx_hands_l5'); St.addItem('fx_herb'); St.addItem('fx_i_acc_n');
  const order = St.items().map((e) => e.item.type);
  const rank = { consumable: 0, weapon: 1, shield: 2, head: 3, body: 4, hands: 5, feet: 6, acc: 7, key: 8 };
  for (let i = 1; i < order.length; i++) ok(rank[order[i - 1]] <= rank[order[i]], 'sorted by type: ' + order.join(','));
  eq(St.items((it) => it.type === 'feet').map((e) => e.id), ['fx_feet_l5'], 'filter');
  // hasItem counts equipment of party and reserve
  const r = Ru.newChar({ id: 'fx_mage' }); g.reserve.push(r); r.equip.acc2 = 'fx_i_acc_s';
  eq([St.hasItem('fx_i_acc_s'), St.hasItem('fx_i_acc_s', 2)], [true, false], 'reserve gear counts');
  g.gold = 0;
  eq(St.addGold(9999999 + 5), 9999999, 'gold cap');
  eq(St.takeGold(10000000), false, 'cannot pay');
  eq(St.takeGold(9999999), true, 'pay');
  eq(St.addGold(-50), 0, 'gold floor 0');
});

test('books: bestiary, drops, learned (§3.2.1, §3.3.2)', () => {
  const g = fresh([]);
  St.seen('fx_mon'); St.seen('fx_mon');
  St.killed('fx_mon'); St.killed('fx_mon', { golden: true });
  eq(g.book.mon.fx_mon, { seen: 2, kills: 2, gold: 1, drop: false, rare: false, sr: false, scan: false }, 'seen/kills/gold');
  St.noteDrop('fx_mon', 'normal'); St.noteDrop('fx_mon', 'rare', { stolen: true }); St.noteDrop('fx_mon', 'super'); St.noteDrop('fx_mon', 'scan');
  const e = g.book.mon.fx_mon;
  eq([e.drop, e.rare, e.sr, e.scan], [true, true, true, true], 'grades');
  eq(e.stole, { rare: true }, 'stolen noted');
  eq(St.noteDrop('fx_mon', 'drop'), null, 'unknown kind refused');
  St.noteDrop('fx_rare', 'normal', { stolen: true });
  eq(g.book.mon.fx_rare.kills, 0, 'stolen before a kill');
  eq([g.records.rareDrops, g.records.superDrops, g.records.goldens], [1, 1, 1], 'records');
  St.seen('fx_rare');
  eq(g.records.rareMons, 1, 'rare monster met');
  St.seen('fx_rare');
  eq(g.records.rareMons, 2, 'every encounter with a rare monster counts');
  St.seen('fx_mon');
  eq(g.records.rareMons, 2, 'ordinary monsters do not');
  St.noteLearned('hero', 'fx_t_cost'); St.noteLearned('hero', 'fx_t_cost'); St.noteLearned('fx_mage', 'fx_t_cost'); St.noteLearned('hero', 'fx_s_cost');
  eq([g.book.tech.fx_t_cost, g.book.spell.fx_s_cost], [['hero', 'fx_mage'], ['hero']], 'books');
  eq(St.learnedBy('fx_s_cost'), ['hero'], 'learnedBy');
});

test('heal & wipe (§3.3.2, §4.12.2)', () => {
  if (!hasReal('companions', 20)) return;
  const g = fresh(['marta']);
  Pa.recruit('teo', { toParty: false });
  for (const c of St.all()) { c.hp = 0; c.mp = 0; c.wp = 0; c.status = { poison: 1 }; }
  g.gold = 1235; g.encItem = { id: 'i_repel', pct: -100, steps: 50, weakOnly: true };
  if (R.Battle) R.Battle.autoCarry = true;
  St.wipeRecover();
  eq(g.gold, 617, 'gold halved, rounded down');
  for (const c of St.all()) { const s = Ru.stats(c); eq([c.hp, c.mp, c.wp, c.status], [s.hp, s.mp, s.wp, {}], c.id + ' healed'); }
  eq(g.encItem, null, 'encItem cleared');
  if (R.Battle) eq(R.Battle.autoCarry, false, 'autoCarry off');
  for (const c of St.all()) c.hp = 1;
  St.healAll({ reserve: false });
  eq(St.char('teo').hp, 1, 'reserve left out on request');
  eq(St.leader().id, 'hero', 'leader');
  St.hero().hp = 0;
  eq(St.leader().id, 'marta', 'first living');
  eq(St.alive().map((c) => c.id), ['marta'], 'alive');
});

test('tier: clear, effective, pick, inn (§3.3.5)', () => {
  const g = fresh([]);
  const ev = [];
  R.on('tier', (t, id) => ev.push([t, id]));
  eq(Ti.clear('r_forest'), { tier: 1, first: true }, 'first clear');
  eq(Ti.clear('r_forest'), { tier: 1, first: false }, 'again');
  ok(St.flag('cleared_r_forest'), 'flag');
  eq(ev, [[1, 'r_forest']], 'event');
  for (const r of ['r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star', 'extra_region']) Ti.clear(r);
  eq(g.tier, 8, 'capped at 8');
  eq([Ti.current(), Ti.effective()], [8, 8], 'current/effective');
  St.setFlag('game_clear');
  eq(Ti.effective(), 9, '9 after the ending');
  eq([Ti.isCleared('r_mine'), Ti.isCleared('r_x')], [true, false], 'isCleared');
  eq(Ti.clearedList().slice(0, 2), ['r_forest', 'r_desert'], 'clear order');
  eq([Ti.pick([1, 2, 3], 0), Ti.pick([1, 2, 3], 1), Ti.pick([1, 2, 3], 9)], [1, 2, 3], 'array pick clamps');
  eq([Ti.pick({ 0: 'a', 3: 'b', 6: 'c' }, 2), Ti.pick({ 0: 'a', 3: 'b', 6: 'c' }, 3), Ti.pick({ 0: 'a', 3: 'b' }, 9), Ti.pick({ 2: 'x' }, 0)], ['a', 'b', 'b', undefined], 'object pick');
  eq(Ti.pick([5, 6]), 6, 'default tier = current');
  eq(Ti.innPrice(), 112, 'inn T9');
  g.gameClear = false; delete g.flags.game_clear; g.regionsCleared = []; g.tier = 0;
  eq(Ti.innPrice(), 10, 'inn T0');
  g.tier = 4;
  eq(Ti.innPrice(), 42, 'inn T4');
});

test('tier: chests and pools (§8.12.1)', () => {
  const g = fresh([]);
  g.tier = 2;
  eq(Ti.chestTier({ id: 'x', pool: 'fx_pool', tier: 7 }, 'fx_dun_1'), 7, 'def.tier first');
  eq(Ti.chestTier({ id: 'x', pool: 'fx_pool' }, 'fx_dun_1'), 5, 'then map.chestTier');
  eq(Ti.chestTier({ id: 'x', pool: 'fx_pool' }, DB.maps.fx_town), 2, 'then R.Game.tier');
  eq(Ti.chestTier({ id: 'x', pool: 'fx_pool' }, { def: DB.maps.fx_dun_1 }), 5, 'a FieldMap-like object');
  const c1 = Ti.chest({ id: 'fx_dun_1_c1', pool: 'fx_pool' }, 'fx_dun_1');
  eq(c1, { item: 'fx_pool_c', n: 1 }, 'T5 draw');
  eq(g.chests.fx_dun_1_c1, c1, 'recorded');
  g.tier = 0;
  eq(Ti.chest({ id: 'fx_dun_1_c1', pool: 'fx_pool' }, 'fx_dun_1'), c1, 'recorded chest keeps its contents');
  eq(Ti.rollChest({ id: 'y', pool: 'fx_pool', tier: 3 }), { item: 'fx_pool_b', n: 2 }, 'n from the entry');
  let items = 0, gold = 0;
  for (let i = 0; i < 4000; i++) { const r = Ti.rollPool('fx_pool', 0); if (r.item) items++; else if (r.gold === 50) gold++; }
  near(items / 4000, 0.75, 0.03, 'weights 3:1');
  eq(items + gold, 4000, 'only pool entries');
  eq(Ti.rollPool('nope', 0), null, 'unknown pool');
  eq(Ti.chest({ id: 'z', gold: 33 }), { gold: 33 }, 'gold chest');
  if (DB.pools.p_gold) eq(Ti.rollPool('p_gold', 4), { gold: 530 }, 'real p_gold T4');
  ok(!g.chests.y, 'rollChest does not record');
});

test('tier: shop goods (§8.11.1)', () => {
  const g = fresh([]);
  g.tier = 0;
  eq(Ti.shopItems('fx_shop_new'), ['fx_herb', 'fx_sword_3'], 'T0: fixed + T0 step');
  g.tier = 2;
  eq(Ti.shopItems('fx_shop_new'), ['fx_herb', 'fx_sword_5'], 'keepOld:false → only the last qualifying step');
  St.setFlag('fx_flag');
  eq(Ti.shopItems('fx_shop_new'), ['fx_herb', 'fx_axe_5'], 'cond step later in the array wins');
  g.tier = 8; g.gameClear = true;
  eq(Ti.shopItems('fx_shop_new'), ['fx_herb', 'fx_sword_q'], 'postgame step');
  g.gameClear = false; g.tier = 1;
  eq(Ti.shopItems('fx_shop_old'), ['fx_pool_a', 'fx_herb', 'fx_pool_b'], 'keepOld:true accumulates, no duplicates');
  g.regionsCleared = ['r_mine'];
  eq(Ti.shopItems('fx_shop_old'), ['fx_pool_a', 'fx_herb', 'fx_pool_b', 'fx_key'], 'cond cleared');
  eq(Ti.shopItems('none'), [], 'unknown shop');
  if (DB.shops.lute_weapon && DB.items.w_sword_iron) {
    g.tier = 0; g.regionsCleared = [];
    ok(Ti.shopItems('lute_weapon').includes('w_sword_iron'), 'real lute_weapon T0 has the iron sword');
    g.tier = 3;
    ok(!Ti.shopItems('lute_weapon').includes('w_sword_iron') && Ti.shopItems('lute_weapon').includes('w_sword_3'), 'real lute_weapon T3 only T3 swords');
  }
});

test('zoneLevel (§4.14.1, §9.0 0.17)', () => {
  const g = fresh([]);
  g.tier = 3;
  eq(Ru.zoneLevel('fx_zone', 'fx_town'), { Tb: 3, Lb: 25, lvMin: 25, lvMax: 25 }, 'dyn + zone lvOff 1');
  eq(Ru.zoneLevel('fx_zone', 'fx_dun_1'), { Tb: 3, Lb: 26, lvMin: 26, lvMax: 26 }, 'map lvOff 2 wins');
  eq(Ru.zoneLevel('fx_zone_fixed', 'fx_town').Lb, 54, 'fixed tier 8');
  eq(Ru.zoneLevel('fx_zone_pro', null), { Tb: 0, Lb: 3, lvMin: 1, lvMax: 3 }, 'prologue lv range (max)');
  for (let i = 0; i < 50; i++) { const l = Ru.zoneLevel('fx_zone_pro', null, { roll: true }).Lb; ok(l >= 1 && l <= 3, 'rolled ' + l); }
  eq(Ru.zoneLevel(DB.encounters.fx_zone, { def: DB.maps.fx_dun_1 }).Lb, 26, 'objects accepted');
});

test('warps: dungeonLocation and syncVisited (§3.3.2)', () => {
  const g = fresh([]);
  eq(St.dungeonLocation(DB.maps.fx_dun_3), 'fx_loc_dun', 'def.location');
  eq(St.dungeonLocation(DB.maps.fx_dun_1), 'fx_loc_dun', 'escape.spawn match');
  eq(St.dungeonLocation(DB.maps.fx_town), 'fx_loc_town', 'town location');
  eq(St.dungeonLocation(null), null, 'null');
  eq(St.dungeonLocation({ escape: { spawn: 'nowhere' } }), null, 'no match');
  const v = (fn) => { const gg = clone(g); gg.visited = {}; fn(gg); St.syncVisited(gg); return !!gg.visited.fx_loc_dun; };
  eq(v(() => {}), false, 'nothing');
  eq(v((gg) => { gg.chests.fx_dun_1_c1 = { gold: 1 }; }), true, 'a chest opened');
  eq(v((gg) => { gg.book.mon.fx_mon = { seen: 1, kills: 0 }; }), true, 'a zone monster seen');
  eq(v((gg) => { gg.pos.map = 'fx_dun_2'; }), true, 'standing inside');
  eq(v((gg) => { gg.book.mon.fx_rare = { seen: 1 }; }), false, 'unrelated monster');
  // a monster that also lives in a town/world zone proves nothing
  DB.maps.fx_town.encounter = 'fx_zone';
  eq(v((gg) => { gg.book.mon.fx_mon = { seen: 1, kills: 0 }; }), false, 'shared zone monster ignored');
  delete DB.maps.fx_town.encounter;
});

test('save: serialize / deserialize round trip (§3.2.5)', () => {
  if (!hasReal('companions', 20)) return;
  const g = fresh(['selma', 'marta', 'teo']);
  Pa.recruit('boden');
  St.addItem('fx_herb', 7); St.setFlag('x'); St.setVar('y', 4); Ti.clear('r_forest');
  St.seen('fx_rare'); St.noteLearned('hero', 'fx_t_cost'); St.markSecret('fx_dun_1', 3, 4);
  g.playFrames = 3600 * 75;
  const data = St.serialize();
  eq([data.v, data.kind], [1, 'chronicle'], 'header');
  const sm = data.summary;
  eq([sm.hero, sm.level, sm.names.length, sm.tier, sm.clear, sm.time, sm.gold], [St.hero().name, 1, 4, 1, false, '1:15', g.gold], 'summary');
  eq(sm.sprites[0], Pa.spriteKey(St.hero()), 'summary sprites');
  const json = JSON.parse(JSON.stringify(data));
  const snap = clone(g);
  R.Game = null;
  eq(St.deserialize(json), true, 'loads');
  eq(clone(R.Game).party, snap.party, 'party equal');
  eq(clone(R.Game).reserve, snap.reserve, 'reserve equal');
  for (const k of ['inv', 'flags', 'vars', 'regionsCleared', 'tier', 'book', 'secrets', 'gold', 'visited', 'pos']) eq(clone(R.Game)[k], snap[k], k + ' equal');
  ok(St.isSecretFound('fx_dun_1', 3, 4), 'secret kept');
  eq(St.markSecret('fx_dun_1', 3, 4), false, 'second find is not new');
  // the code path through the passcode format
  eq(St.deserialize({ kind: 'crest', game: snap }), false, 'other kinds rejected');
  eq(St.deserialize({ v: 1, game: snap }), false, 'no kind rejected');
  eq(St.deserialize(null), false, 'null rejected');
  eq(St.deserialize({ kind: 'chronicle', game: 'x' }), false, 'bad game rejected');
  eq(R.Game.party.length, 4, 'failed loads leave R.Game as it was');
});

test('save: old-save safety (§3.2.5 steps 2–9)', () => {
  if (!hasReal('companions', 20)) return;
  fresh(['selma', 'marta']);
  const d = St.serialize();
  const g = d.game;
  // damage it the way old / foreign-shaped saves look
  delete g.secrets; delete g.records; delete g.reserve; delete g.book; delete g.regionObj;
  g['repel' + 'Steps'] = 40; g.encItem = { id: 'i_repel', pct: -100, steps: 20, weakOnly: true };
  g.bestiary = { fx_mon: { seen: 3, kills: 2, drop: true, steal: false, rare: false, stealRare: true } };
  g.inv = { fx_herb: 3, gone_item: 2, fx_key: 5 };
  g.regionsCleared = ['r_forest', 'r_forest', 'r_desert', 'no_region'];
  g.tier = 7; g.flags.game_clear = true; g.gameClear = false;
  const h = g.party[0];
  h.equip = { weapon: 'fx_sword_5', shield: 'fx_sh_h5', head: 'gone', body: null, acc: 'fx_i_acc_n' };
  h.hp = 99999; h.mp = -5; h.status = { poison: true }; delete h.wprof; h.eprof = { fire: 3, bogus: 9 };
  h.techs = ['fx_t_cost', 'gone_tech', 'fx_t_cost']; delete h.bonus; delete h.mem; delete h.counts; h.job = 'knight'; h.jobs = {};
  const marta = g.party[2];
  g.party.splice(2, 1);
  g.reserve = [marta, clone(marta)];                // duplicate id
  g.party.push({ id: 'unknown_companion', name: 'x', equip: {} });
  g.pos = { map: 'renamed_map', x: 3, y: 4, dir: 'up' };
  g.respawn = { map: 'fx_town', spawn: 'inn' };
  ok(St.deserialize(d), 'loads');
  const G = R.Game;
  eq([G.pos.map, G.pos.spawn], ['fx_town', 'inn'], 'a vanished map falls back to the respawn town');
  eq(G.secrets, {}, 'secrets filled');
  eq(G.records.glimmers, 0, 'records filled');
  ok(!(('repel' + 'Steps') in G) && G.encItem === null, 'old repel counter dropped, encItem null');
  eq(G.book.mon.fx_mon, { seen: 3, kills: 2, gold: 0, drop: true, rare: true, sr: false, scan: false }, 'old bestiary migrated (steals count)');
  eq(G.inv, { fx_herb: 3, fx_key: 1 }, 'unknown items gone, key capped');
  eq(G.regionsCleared, ['r_forest', 'r_desert'], 'regions deduped and filtered');
  eq(G.tier, 2, 'tier recomputed');
  eq(G.gameClear, true, 'gameClear from the flag');
  const H = St.hero();
  eq(H.equip.weapon1, 'fx_sword_5', 'old weapon slot → weapon1');
  eq(H.equip.acc1, 'fx_i_acc_n', 'old acc slot → acc1');
  eq(H.equip.head, null, 'unknown equipment dropped');
  eq(H.equip.shield, 'fx_sh_h5', 'shield kept with a 1H weapon');
  eq(Object.keys(H.wprof).length, 11, 'wprof filled');
  eq(Object.keys(H.eprof), Ru.ELEMENTS, 'eprof fixed');
  eq(H.eprof.fire, 3, 'eprof value kept');
  eq(H.techs, ['fx_t_cost'], 'techs deduped, unknown dropped');
  const s = Ru.stats(H);
  eq([H.hp, H.mp], [s.hp, 0], 'hp/mp clamped');
  eq(H.status, {}, 'status cleared');
  ok(!('job' in H) && !('jobs' in H), 'job keys removed');
  eq([H.bonus, H.mem.cmd, H.counts.battles], [{ hp: 0, mp: 0, wp: 0 }, 0, 0], 'bonus/mem/counts filled');
  eq(St.all().map((c) => c.id), ['hero', 'selma', 'marta'], 'duplicates and unknown companions dropped');
  // the hero is forced into the party; over-full party trimmed
  const d2 = St.serialize();
  const hero = d2.game.party.shift();
  d2.game.reserve.push(hero);
  for (const id of ['teo', 'ilse', 'morga', 'noela']) d2.game.party.push(Ru.newChar({ id }));
  ok(St.deserialize(d2), 'loads 2');
  eq(R.Game.party[0].id, 'hero', 'hero back in the party');
  eq(R.Game.party.length, 4, 'party trimmed to 4');
  ok(R.Game.reserve.length >= 3, 'overflow to the reserve');
  // a 2H weapon with a shield: the shield goes back to the inventory
  const d3 = St.serialize();
  d3.game.party[0].equip.weapon1 = 'fx_gs_5'; d3.game.party[0].equip.shield = 'fx_sh_h1';
  ok(St.deserialize(d3), 'loads 3');
  eq([St.hero().equip.shield, R.Game.inv.fx_sh_h1], [null, 1], 'shield returned');
  if (R.Battle) { R.Battle.autoCarry = true; St.deserialize(St.serialize()); eq(R.Battle.autoCarry, false, 'autoCarry reset'); }
});

test('save: empty registries never delete saved data', () => {
  fresh([]);
  St.addItem('fx_herb', 2); St.seen('fx_mon');
  const d = St.serialize();
  const keep = { items: DB.items, monsters: DB.monsters, actions: DB.actions };
  const hold = {};
  for (const k in keep) { hold[k] = Object.assign({}, DB[k]); for (const id in DB[k]) delete DB[k][id]; }
  let okLoad;
  try { okLoad = St.deserialize(d); } finally { for (const k in hold) Object.assign(DB[k], hold[k]); }
  ok(okLoad, 'loads with empty registries');
  eq([R.Game.inv.fx_herb, !!R.Game.book.mon.fx_mon], [2, true], 'data kept');
});

test('grow: seeds with caps (§8.2.5)', () => {
  const g = fresh([]);
  const h = St.hero();
  const hp0 = Ru.stats(h).hp;
  eq(Ru.grow(h, 'hp', 150), 150, 'added');
  eq(Ru.stats(h).hp, hp0 + 150, 'max up');
  eq(h.hp, hp0 + 150, 'current follows');
  eq(Ru.grow(h, 'hp', 100), 50, 'to the cap 200');
  eq([Ru.grow(h, 'hp', 1), Ru.canGrow(h, 'hp')], [0, false], 'at cap');
  eq(Ru.grow(h, 'mp', 40), 30, 'mp cap 30');
  eq(Ru.grow(h, 'str', 5), 0, 'fixed stats never grow');
  void g;
});

test('newGame: shape of R.Game (§3.2.1)', () => {
  const g = St.newGame();
  const keys = ['game', 'version', 'party', 'reserve', 'tier', 'regionsCleared', 'gameClear', 'clearCount', 'flags', 'vars', 'objective', 'regionObj', 'gold', 'inv',
    'chests', 'visited', 'book', 'pos', 'respawn', 'encItem', 'secrets', 'ship', 'onShip', 'steps', 'playFrames', 'battles', 'wins', 'escapes', 'records', 'title'];
  for (const k of keys) ok(k in g, 'key ' + k);
  eq(g.game, 'chronicle', 'marker');
  eq(g.party.length, 1, 'hero only');
  eq(g.pos.map, (DB.config.start || {}).map || 'roa_house', 'start map');
  eq(g.objective, DB.config.startObjective || null, 'objective');
  eq(g.gold, DB.config.startGold || 0, 'gold');
  eq(St.START.map, g.pos.map, 'START getter');
  const c = g.party[0];
  for (const k of ['id', 'name', 'gender', 'heroType', 'favor', 'level', 'exp', 'hp', 'mp', 'wp', 'bonus', 'status', 'equip', 'wprof', 'eprof', 'techs', 'spells', 'row', 'mem', 'joined', 'counts']) ok(k in c, 'char key ' + k);
  eq(Object.keys(c.equip), Ru.SLOTS, '9 slots');
  eq(Object.keys(c.wprof), Ru.WTYPES, '11 wprof');
  eq(Object.keys(c.eprof), Ru.ELEMENTS, '6 eprof');
  if (hasReal('companions', 20)) {
    const g2 = St.newGame({ name: 'リーネ', gender: 'f', type: 'mage', favor: { kind: 'element', id: 'water' } }, { companions: ['brigitta', 'marta', 'sylvain'] });
    eq(g2.party.map((x) => x.id), ['hero', 'brigitta', 'marta', 'sylvain'], 'with companions');
    eq(St.hero().name, 'リーネ', 'hero spec');
    eq(St.char('marta').wprof.staff, 5, 'first three without catch-up');
  }
});

test('setHero: re-create the hero, keep progress (§3.3.11 ev.createHero)', () => {
  if (!hasReal('heroTypes', 5)) return;
  const g = fresh(['marta']);
  const old = St.hero();
  Ru.setLevel(old, 3); old.bonus.hp = 10; old.counts.battles = 7;
  ok((g.book.tech[DB.starterKit.tech.sword] || []).includes('hero'), 'newGame books the starting tech');
  const c = St.setHero({ name: 'リーネ', gender: 'f', type: 'mage', favor: { kind: 'element', id: 'water' } });
  eq([g.party[0], c.name, c.gender, c.heroType, c.level, c.bonus.hp, c.counts.battles], [c, 'リーネ', 'f', 'mage', 3, 10, 7], 'replaced in place, progress kept');
  eq(c.equip.weapon1, DB.heroTypes.mage.defaultWeapon, 'first creation: the new kit');
  eq(c.spells.includes(DB.starterKit.spell.water), true, 'starting spell');
  eq(Ru.aptLetters(c).e.light, 'A', 'mage pair element A');
  ok((g.book.spell[DB.starterKit.spell.water] || []).includes('hero'), 'spell booked');
  ok(!(g.book.tech[DB.starterKit.tech.sword] || []).includes('hero'), 'the placeholder hero\'s tech left the tech book');
  eq([c.hp, c.mp], [Ru.stats(c).hp, Ru.stats(c).mp], 'healed');
  // later (hero_created set): equipment and knowledge stay
  St.setFlag('hero_created');
  St.addItem('fx_sword_5'); Ru.equip(c, 'weapon2', 'fx_sword_5');
  c.eprof.water = 40;
  const d = St.setHero({ name: 'リーネ', gender: 'f', type: 'warrior', favor: { kind: 'weapon', id: 'axe' } });
  eq(d.equip.weapon2, 'fx_sword_5', 'equipment kept');
  eq(d.eprof.water, 40, 'proficiency kept');
  ok(d.spells.includes(DB.starterKit.spell.water) && d.techs.includes(DB.starterKit.tech.axe), 'old + new actions');
  eq(Ru.aptLetters(d).w.axe, 'S', 'new favor S');
  eq(g.party.filter((x) => x.id === 'hero').length, 1, 'one hero');
  const mt = Pa.recruit('teo');
  ok((g.book.spell[mt.spells[0]] || []).includes('teo'), 'recruit books starting actions');
});

test('invariants under random operations (§3.2.6)', () => {
  if (!hasReal('companions', 20)) return;
  const g = fresh(['selma', 'marta', 'teo']);
  for (const id of ['boden', 'noela', 'ilse', 'rouga']) Pa.recruit(id);
  const gear = ['fx_sword_3', 'fx_sword_5', 'fx_gs_5', 'fx_spear_5', 'fx_bow_5', 'fx_axe_5', 'fx_sh_h5', 'fx_sh_c5', 'fx_body_h5', 'fx_head_c5', 'fx_i_acc_n', 'fx_acc_a', 'fx_hands_l5'];
  for (const id of gear) St.addItem(id, 2);
  const total = () => { const t = {}; for (const c of St.all()) for (const s of Ru.SLOTS) if (c.equip[s]) t[c.equip[s]] = (t[c.equip[s]] || 0) + 1; for (const id in g.inv) t[id] = (t[id] || 0) + g.inv[id]; return JSON.stringify(Object.keys(t).sort().map((k) => [k, t[k]])); };
  const T0 = total();
  const U = R.U;
  for (let i = 0; i < 800; i++) {
    const c = U.pick(St.all());
    const op = U.ri(0, 7);
    if (op <= 2) { const id = U.pick(gear.concat([null])); const slot = id ? U.pick(Ru.slotsFor(id)) : U.pick(Ru.SLOTS); Ru.equip(c, slot, id); }
    else if (op === 3) Ru.applyLoadout(c, Ru.optimize(c, U.pick(['phys', 'magic', 'balance'])));
    else if (op === 4) { const a = U.pick(g.party), r = U.pick(g.reserve.concat([null])); Pa.swap(a.id, r ? r.id : null); }
    else if (op === 5 && g.reserve.length) Pa.toParty(U.pick(g.reserve).id);
    else if (op === 6) Ru.unequipAll(c);
    else Pa.setOrder(U.shuffle(g.party.map((x) => x.id)));
    // invariants
    if (!(g.party.length >= 1 && g.party.length <= 4)) { fail('party size ' + g.party.length + ' at ' + i); break; }
    if (!g.party.some((x) => x.id === 'hero')) { fail('hero missing at ' + i); break; }
    const ids = St.all().map((x) => x.id);
    if (new Set(ids).size !== ids.length) { fail('duplicate member at ' + i); break; }
    if (total() !== T0) { fail('items not conserved at op ' + op + ' step ' + i); break; }
    for (const x of St.all()) {
      if (x.equip.shield && Ru.hasTwoHanded(x)) { fail('shield with 2H at ' + i); break; }
      const s = Ru.stats(x);
      if (x.hp > s.hp || x.mp > s.mp || x.wp > s.wp) { fail('over max at ' + i); break; }
    }
    if (g.tier !== g.regionsCleared.length) { fail('tier'); break; }
  }
  checks++;
});

// =====================================================================
console.log(`test_rules: ${groups} groups, ${checks} checks, ${fails} failures`);
if (fails) {
  for (const f of failures.slice(0, 80)) console.log('  FAIL ' + f);
  if (failures.length > 80) console.log('  … ' + (failures.length - 80) + ' more');
  process.exit(1);
}
