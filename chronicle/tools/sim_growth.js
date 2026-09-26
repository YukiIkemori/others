#!/usr/bin/env node
// Growth simulator (rules A1): levels and HP/MP through a whole playthrough,
// what grinding buys, and how far the reserve (60% EXP) and late joiners fall behind.
// DESIGN.md §4.2, §4.17.3 E1/E2, §5.5.4, §12.3.
//
//   node tools/sim_growth.js              the report + pass/fail (exit 1 on a failure)
//   node tools/sim_growth.js --seed 7     another random seed (default 1)
//   node tools/sim_growth.js --runs 5     average over several playthroughs (default 3)
//   node tools/sim_growth.js --model      use the standard-monster model instead of the zone data
//
// The model (§4.17.1, §4.2.3): prologue ≈ 35 battles (field lv 1–3, lighthouse 3–5) + the
// tutorial and the prologue boss; then the 8 regions in order of tier 0..7, each 95 battles
// (35 on the world map at zone lvOff, 30 on dungeon floor 1 at the zone's lvOff, 30 deeper at
// map lvOff 2) with the mid boss before the deep floors and the region boss at the end; then
// the final region (tier 8). The reserve lag is checked at the end of each region (after the
// boss, when the party is back in a town and could swap) and printed before the boss too. Battles use the real encounter groups (R.Mon.zoneGroup / R.Mon.def)
// with golden (1/40), rare-monster (1/80) and metal (kill chance 35%) EXP; EXP goes through
// R.Party.award exactly as in the game. Grinding forks the state before a region boss.
'use strict';
const R = require('./lib/load')({ quiet: true });
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SEED = +opt('--seed', 1);
const RUNS = +opt('--runs', 3);
const MODEL = argv.includes('--model') || !(R.Mon && R.Mon.def && R.Mon.zoneGroup && Object.keys(R.DB.encounters).length);
const DB = R.DB, Ru = R.Rules, K = Ru.K, U = R.U;

const REGIONS = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
const MID = { r_forest: 'tr_b_moth', r_desert: 'tr_b_sandworm', r_snow: 'tr_b_icegiant', r_marsh: 'tr_b_dolls', r_isles: 'tr_b_octopus', r_mine: 'tr_b_rockeater', r_ash: 'tr_b_hellhound', r_star: 'tr_b_orrery' };
const ACTIVE = ['brigitta', 'marta', 'sylvain'];
const RESERVE = ['selma', 'teo', 'noela'];
const LATE = 'boden';                  // joins at tier 4 (a swap-in, §4.9.1 catch-up)
const results = [];
let failures = 0;
const check = (ok, msg) => { results.push((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };

// --------------------------------------------------------------- battles
const zonesOf = (region) => Object.keys(DB.encounters).filter((z) => DB.encounters[z].region === region);
function killedFromZone(zone, T, lvOff) {
  const z = DB.encounters[zone];
  if (!z) return modelKilled(K.LZ(T) + (lvOff || 0));
  const Lb = Array.isArray(z.lv) ? U.ri(z.lv[0], z.lv[1]) : K.LZ(T) + (lvOff != null ? lvOff : z.lvOff || 0);
  if (MODEL) return modelKilled(Lb);
  // a rare monster replaces the battle (1/80), Lb + 2
  const rare = DB.rareEncounters[zone];
  if (rare && DB.monsters[rare.mon] && U.chance(1 / (rare.rate || K.RARE_ENC))) {
    const d = R.Mon.def(rare.mon, { Lb: Lb + K.RARE_MON.lvOff });
    return d ? [{ def: d }] : [];
  }
  const g = R.Mon.zoneGroup(zone, T);
  if (!g) return modelKilled(Lb);
  const ids = R.Mon.buildList(g.mons, T);
  const golden = U.chance(K.GOLDEN.rate) ? U.ri(0, ids.length - 1) : -1;
  const out = [];
  ids.forEach((id, i) => {
    const base = DB.monsters[id];
    const metal = base && (base.flags || []).includes('metal');
    if (metal && !U.chance(0.35)) return;         // metal ones mostly run away
    const d = R.Mon.def(id, { Lb, golden: i === golden && !metal });
    if (d) out.push({ def: d });
  });
  return out;
}
/** 3.3 standard monsters of level L (the §4.2.3 model) */
function modelKilled(L) {
  const n = U.chance(0.3) ? 4 : 3;
  return Array.from({ length: n }, () => ({ exp: Math.round(Ru.mexp(L)), lv: L }));
}
function troopKilled(tid, T) {
  const t = DB.troops[tid];
  if (!t) return [];
  const tier = t.tier != null ? t.tier : T;
  const Lb = t.lv != null ? t.lv : K.LZ(tier) + (t.lvOff || 0);
  if (MODEL || !R.Mon) {
    const m = { tr_b_pageeater: 10 }[tid] || (t.lvOff >= 3 ? 20 : 10);
    return [{ exp: Math.round(Ru.mexp(Lb) * m), lv: Lb }];
  }
  const out = [];
  for (const e of t.mons) {
    const ids = R.Mon.buildList([e], tier);
    for (const id of ids) { const d = R.Mon.def(id, { Lb }); if (d) out.push({ def: d }); }
  }
  return out;
}
function fight(killed) {
  if (!killed.length) return;
  R.Party.award({ killed });
  R.Party.afterBattle('win');
}

// ---------------------------------------------------------- playthrough
function newRun(seed) {
  U.seed(seed);
  R.State.newGame(null, { companions: ACTIVE });
  for (const id of RESERVE) R.Party.recruit(id, { toParty: false, catchUp: false });
  return R.Game;
}
const active = () => R.Game.party;
const reserve = () => R.Game.reserve.filter((c) => c.id !== LATE);
const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const snapshot = () => JSON.stringify(R.Game);
const restore = (s) => { R.Game = JSON.parse(s); };
const levels = (list) => list.map((c) => c.level);

function prologue() {
  for (let i = 0; i < 20; i++) fight(killedFromZone('zw_prologue', 0));
  fight(troopKilled('tr_tutorial', 0));
  for (let i = 0; i < 15; i++) fight(killedFromZone('z_prologue_lighthouse', 0));
  const before = avg(levels(active()));
  fight(troopKilled('tr_b_pageeater', 0));
  return { before, after: avg(levels(active())) };
}
/** one region at tier T; returns the numbers measured right before the region boss */
function region(rid, T, extra) {
  const zs = zonesOf(rid);
  const world = zs.filter((z) => z.startsWith('zw_'));
  const dun = zs.filter((z) => !z.startsWith('zw_'));
  const wz = world[0] || zs[0], dz = dun.length ? dun : [wz];
  for (let i = 0; i < 35; i++) fight(killedFromZone(wz, T));
  for (let i = 0; i < 30; i++) fight(killedFromZone(dz[i % dz.length], T));
  fight(troopKilled(MID[rid], T));
  if (T === 2) fight(troopKilled('tr_b_rowell1', T));
  if (T === 5) fight(troopKilled('tr_b_rowell2', T));
  for (let i = 0; i < 30; i++) fight(killedFromZone(dz[i % dz.length], T, 2));
  for (let i = 0; i < (extra || 0); i++) fight(killedFromZone(dz[i % dz.length], T, 2));
  const out = {
    act: avg(levels(active())), actMin: Math.min(...levels(active())), actMax: Math.max(...levels(active())),
    res: avg(levels(reserve())), resMin: Math.min(...levels(reserve())),
    hp: R.Rules.stats(R.State.hero()).hp,
    late: R.State.char(LATE) ? R.State.char(LATE).level : null,
  };
  fight(troopKilled(DB.regions[rid] ? DB.regions[rid].bossTroop : null, T));
  out.lagAfter = avg(levels(active())) - avg(levels(reserve()));
  R.Tier.clear(rid);
  return out;
}
function finale() {
  const zs = zonesOf('finale');
  for (let i = 0; i < 90; i++) fight(killedFromZone(zs[i % zs.length], 8));
  for (const t of ['tr_b_bookgolem', 'tr_b_heroshades', 'tr_b_lazaro']) fight(troopKilled(t, 8));
  const lv = avg(levels(active()));
  fight(troopKilled('tr_b_nemrea1', 8)); fight(troopKilled('tr_b_nemrea2', 8));
  return lv;
}

// ------------------------------------------------------------------ run
const rows = [];   // per tier: averaged over runs
const acc = (T, k, v) => { rows[T] = rows[T] || {}; (rows[T][k] = rows[T][k] || []).push(v); };
let proLv = [], finLv = [];
for (let run = 0; run < RUNS; run++) {
  newRun(SEED * 1000 + run);
  proLv.push(prologue());
  for (let T = 0; T < 8; T++) {
    const rid = REGIONS[T];
    if (T === 4) {
      // a late joiner: swapped in for the tier-4 region
      const c = R.Party.recruit(LATE, { toParty: false });
      R.Party.swap('sylvain', LATE);
      acc(T, 'lateJoin', c.level);
    }
    // grinding forks: +100 and +200 battles before this region's boss
    const s = snapshot();
    const g100 = region(rid, T, 100); restore(s);
    const g200 = region(rid, T, 200); restore(s);
    const base = region(rid, T, 0);
    acc(T, 'act', base.act); acc(T, 'actMin', base.actMin); acc(T, 'actMax', base.actMax);
    acc(T, 'res', base.res); acc(T, 'lag', base.act - base.res); acc(T, 'lagMax', base.actMax - base.resMin); acc(T, 'lagAfter', base.lagAfter);
    acc(T, 'g100', g100.act - base.act); acc(T, 'g200', g200.act - base.act);
    acc(T, 'hp100', g100.hp / base.hp - 1);
    if (base.late != null) acc(T, 'late', base.act - base.late);
    if (T === 4) R.Party.swap(LATE, 'sylvain');
  }
  finLv.push(finale());
}

// ---------------------------------------------------------------- report
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
console.log(`sim_growth — ${RUNS} runs, seed ${SEED}, ${MODEL ? 'standard-monster model' : 'zone data (R.Mon)'}\n`);
console.log('HP/MP curves (§4.2.2; standard growth B, vit 40, no gear; WP gone, SYSTEMS_REWORK A18):');
console.log('  L    HPlv   MPlv   gain/L(HP)');
for (const L of [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 99]) {
  console.log('  ' + String(L).padStart(2) + '  ' + [Ru.lvCurve('hp', L), Ru.lvCurve('mp', L)].map((v) => f1(v).padStart(6)).join(' ') +
    '   ' + f1(L > 1 ? Ru.lvCurve('hp', L) - Ru.lvCurve('hp', L - 1) : 0).padStart(5));
}
console.log(`\nPrologue: party level ${f1(avg(proLv.map((p) => p.before)))} before the prologue boss, ${f1(avg(proLv.map((p) => p.after)))} after it (target ≈ 5, §4.2.3)`);
console.log('\nRegion bosses (level right before the boss; LZ = 6 + 6T):');
console.log('  T  LZ  active(avg min–max)  vsLZ  reserve  lag  lag(end)  +100b  +200b  HP+100b');
for (let T = 0; T < 8; T++) {
  const r = rows[T], a = (k) => avg(r[k] || [0]);
  const LZ = K.LZ(T);
  console.log('  ' + T + '  ' + String(LZ).padStart(2) + '  ' + f1(a('act')).padStart(6) + ' (' + Math.min(...r.actMin) + '–' + Math.max(...r.actMax) + ')' +
    '        ' + ('+' + f1(a('act') - LZ)).padStart(5) + '  ' + f1(a('res')).padStart(6) + '  ' + f1(a('lag')).padStart(4) + '  ' + f1(a('lagAfter')).padStart(8) + '  ' +
    ('+' + f1(a('g100'))).padStart(5) + '  ' + ('+' + f1(a('g200'))).padStart(5) + '  ' + ('+' + (a('hp100') * 100).toFixed(1) + '%').padStart(7));
}
const lj = rows[4].lateJoin ? avg(rows[4].lateJoin) : null;
if (lj != null) console.log(`\nLate joiner (${LATE}, recruited at tier 4 at Lv ${f1(lj)}, joinLevel = floor(hero × 0.9)): behind the party by ${f1(avg(rows[4].late || [0]))} levels at the tier-4 boss, ${f1(avg((rows[7] && rows[7].late) || [0]))} at the tier-7 boss (it goes back to the reserve after tier 4).`);
console.log(`Final region: party level before the last boss ${f1(avg(finLv))} (standard party 58, §4.17.1)\n`);

// checks (§4.17.3 E1/E2, §4.2.2)
for (let T = 0; T < 8; T++) {
  const r = rows[T], a = (k) => avg(r[k] || [0]), d = a('act') - K.LZ(T);
  check(d >= 2 - 1e-9 && d <= 5 + 1e-9, `E1 T${T}: level at the region boss LZ${d >= 0 ? '+' : ''}${f1(d)} within LZ+2..+5`);
  check(a('lagAfter') <= 3, `E1 T${T}: reserve lag at the end of the region ${f1(a('lagAfter'))} ≤ 3 (before the boss ${f1(a('lag'))})`);
  check(a('g100') <= 3, `E1 T${T}: +100 battles → +${f1(a('g100'))} levels ≤ 3`);
  if (T >= 2) check(a('hp100') <= 0.10, `E2 T${T}: +100 battles → max HP +${(a('hp100') * 100).toFixed(1)}% ≤ 10%`);
}
const pe = avg(proLv.map((p) => p.after));
check(pe >= 4.5 && pe <= 6.5, `prologue ends at Lv ${f1(pe)} ≈ 5`);
if (rows[4].late) check(avg(rows[4].late) <= 3, `a companion joining at tier 4 is ${f1(avg(rows[4].late))} ≤ 3 levels behind at that region's boss`);
let mono = true;
for (let L = 3; L <= 99; L++) if (Ru.lvCurve('hp', L) - Ru.lvCurve('hp', L - 1) > Ru.lvCurve('hp', L - 1) - Ru.lvCurve('hp', L - 2) + 1e-9) mono = false;
check(mono, 'HP gain per level never grows (diminishing returns)');
const top = Ru.newChar({ id: 'hagen', level: 99 });
if (top) {
  const BC = (K.BONUS_CAP) || { hp: 200, mp: 50 };
  top.bonus = { hp: BC.hp || 200, mp: BC.mp || 50 };
  const s = Ru.stats(top);
  check(s.hp <= 999 && s.mp <= 250, `caps at Lv99 with seeds eaten to the cap: ${s.hp}/${s.mp} ≤ 999/250`);
}
// SYSTEMS_REWORK §4.3 (sim_growth): max MP per growth letter (no gear, no seeds)
console.log('\nMax MP by growth letter (§2.3; K.GROW.mp × MPlv):');
console.log('  L   ' + ['S', 'A', 'B', 'C', 'D'].map((g) => g.padStart(5)).join(''));
for (const L of [1, 10, 20, 30, 40, 50, 60, 70, 99]) console.log('  ' + String(L).padStart(2) + '  ' + ['S', 'A', 'B', 'C', 'D'].map((g) => String(Math.min(K.MP.cap || 250, Math.round(Ru.lvCurve('mp', L) * K.GROW.mp[g]))).padStart(5)).join(''));
for (const l of results) console.log(l);
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
