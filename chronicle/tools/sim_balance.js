#!/usr/bin/env node
// sim_balance.js (owner qa A22) — the whole-game balance targets of DESIGN §4.17 (A1…K, plus B5 of §5.4.3 and the
// floor MP of A3b), played through the real engine (R.Battle.simulate, R.BattleAI) with the shared party model
// (tools/lib/party_model.js). Every random number is seeded (--seed); the seed is printed with the results.
//
//   node tools/sim_balance.js                      the standard pass (≈1–2 min): every item at a moderate n
//   node tools/sim_balance.js --only A2,B1 --n 200 some items, more battles each
//   node tools/sim_balance.js --full               all tiers, 200+ combos per hero variant, n × 3 (slow)
//   node tools/sim_balance.js --quick              a smoke pass (few tiers, small n)
//   options: --seed N  --zones z1,z2  --troops t1,t2  --verbose (per zone / troop / combo lines)  --json out.json
// exit 1 when an item FAILs (items the engine or data cannot run yet are SKIP and listed, not failures).
//
// Items (§4.17.3): A1 hits to kill · A2 mob fights (win, rounds, HP loss mean/zone/p95, downs, wipes) · A3 MP per
// fight, caster casts · A3b one dungeon floor · B1 bosses · B2 any three · B3 no best three · B4 order independence ·
// B5 per-companion fairness (§5.4.3) · C1 final region · C2 last boss (2 forms) · C3 superboss · D1 int build ·
// D2 str/dex builds · D3 cloth fragility · D4 int and glimmer · E1 growth · E2 max HP from grinding · I weakness
// spread (§4.7.3) · J optimize (§4.4.1) · K repel (§4.11.1) · G glimmer (A8's sim_glimmer, --full / --only G) ·
// H1 H3 drops (A12's sim_loot) · H2 super-rare items in exactly one monster (structural).
'use strict';
const PM = require('./lib/party_model');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const FULL = argv.includes('--full'), QUICK = argv.includes('--quick'), VERBOSE = argv.includes('--verbose');
const ONLY = arg('only', null) ? arg('only').split(',') : null;
const SEED = +arg('seed', 20260925);
const NBASE = +arg('n', FULL ? 120 : QUICK ? 12 : 40);
const ZONES = arg('zones', null) ? arg('zones').split(',') : null;
const TROOPS = arg('troops', null) ? arg('troops').split(',') : null;
const on = (k) => !ONLY || ONLY.includes(k);

const R = require('./lib/load')({ quiet: true });
R.warn = () => {};
const DB = R.DB;
const K = PM.K(R);
const LZ = (T) => 6 + 6 * T;
const DK = (L) => (R.Rules && R.Rules.dk ? R.Rules.dk(L) : 40 + 5 * L);
const results = [];
const res = (id, status, measured, target, note) => { results.push({ id, status, measured, target, note: note || '' }); };
const f1 = (x) => (x == null || !isFinite(x) ? '-' : (Math.round(x * 10) / 10).toFixed(1));
const f2 = (x) => (x == null || !isFinite(x) ? '-' : (Math.round(x * 100) / 100).toFixed(2));
const pct = (a, b) => (b ? (100 * a) / b : 0);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const q = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const log = (...a) => console.log(...a);
const engineOk = !!(R.Battle && R.Battle.simulate && R.Rules && R.Rules.stats && R.Rules.newChar);
let seedCtr = 0;
const nextSeed = () => (SEED * 7919 + (seedCtr++) * 104729) >>> 0;

// ------------------------------------------------------------------------------------ helpers
const partyCache = new Map();
function party(key, build) {
  if (!partyCache.has(key)) partyCache.set(key, build());
  const b = partyCache.get(key);
  return { party: b.party.map((c) => JSON.parse(JSON.stringify(c))), inv: Object.assign({}, b.inv), notes: b.notes };
}
function standardParty(T, kind) { return party(`std:${T}:${kind || 'mob'}`, () => PM.standard(R, T, { kind })); }
// §4.17.1: mobs at LZ(T)+1, but the final region (finale) at Lv 56; the post-game zones are not a §4.17.3 A2 region
const zoneKind = (e) => (e.region === 'finale' ? 'final' : 'mob');
function startAt(p, frac) {
  for (const c of p.party) { const st = R.Rules.stats(c); c.hp = st.hp; c.mp = Math.round(st.mp * frac); c.status = {}; }
  return p;
}
function casterIndex(p) { return p.party.findIndex((c) => ['marta', 'noela', 'teo', 'ilse', 'morga', 'boden'].includes(c.id) || (c.id === 'hero' && c.heroType === 'mage')); }
function fight(p, spec) {
  const r = PM.runBattle(R, Object.assign({ party: p.party, inv: p.inv, seed: nextSeed(), maxRounds: 60 }, spec));
  return r;
}
function zoneList() {
  return Object.entries(DB.encounters || {}).filter(([z, e]) => (!ZONES || ZONES.includes(z)) && e && (e.groups || []).length);
}
function zoneTiers(e) {
  if (typeof e.tier === 'number') return [e.tier];
  if (e.region === 'prologue') return [0];
  return FULL ? [0, 1, 2, 3, 4, 5, 6, 7] : QUICK ? [0, 4, 7] : [0, 2, 4, 6, 7];
}
function bossKind(tid) {
  const tr = DB.troops[tid];
  // the troop's main boss: skip the minions (bossType 'add') and lineage refs ('@mummy')
  const first = tr && tr.mons && tr.mons.map((m) => DB.monsters[m[0]]).find((m) => m && m.bossType && m.bossType !== 'add');
  if (first) return first.bossType;
  if (Object.values(DB.regions || {}).some((r) => r.bossTroop === tid)) return 'region';
  return 'mid';
}
function statsSafe(c) { try { return R.Rules.stats(c); } catch (e) { return null; } }

// ------------------------------------------------------------------------------------ A1
function A1() {
  const rows = [];
  for (let T = 0; T <= 9; T++) {
    const p = standardParty(T);
    const hero = p.party[0];
    const st = statsSafe(hero);
    if (!st || !st.w || !st.w.weapon1) { res('A1', 'SKIP', '-', '2.3–3.0', 'R.Rules.stats(c).w missing'); return; }
    const L = LZ(T);                           // §4.17.2: the standard monster at Lb = LZ(T)
    const cv = R.Mon && R.Mon.curve ? R.Mon.curve(L) : { hp: 6 + 2.6 * L + 0.1 * L * L, def: 20 + 2.5 * L };
    const A = st.w.weapon1.atk, dk = DK(L);
    const hit = Math.max(20, Math.min(100, (st.w.weapon1.hit != null ? st.w.weapon1.hit : st.hit || 95) - 5)) / 100;
    const crit = Math.min(60, st.w.weapon1.crit != null ? st.w.weapon1.crit : st.crit || 2) / 100;
    // Part A13: the attack carries the proficiency bonus of weapon 1's type (R.Rules.profPowerMul)
    const pm = R.Rules && R.Rules.profPowerMul ? R.Rules.profPowerMul(hero, null, 'weapon1') : 1;
    const per = hit * ((1 - crit) * A * dk / (dk + cv.def) + crit * 1.5 * A) * pm;
    rows.push({ T, A, per, hp: cv.hp, hits: cv.hp / per });
  }
  const bad = rows.filter((r) => r.hits < 2.3 || r.hits > 3.0);
  res('A1', bad.length ? 'FAIL' : 'PASS', rows.map((r) => `T${r.T} ${f2(r.hits)}`).join(' '), '2.3–3.0 every tier', `warrior atk ${rows.map((r) => r.A).join('/')}`);
}

// ------------------------------------------------------------------------------------ A2 / A3 / B4 (zones)
const zoneData = [];
function A2() {
  const list = zoneList().filter(([, e]) => e.region !== 'prologue');
  const pgData = [];
  if (!list.length) { res('A2', 'SKIP', '-', '', 'no encounter zones'); return; }
  for (const [z, e] of list) for (const T of zoneTiers(e)) {
    const kind = zoneKind(e);
    const n = NBASE;
    const acc = { z, T, region: e.region, n: 0, win: 0, rounds: [], loss: [], net: [], down: 0, wipe: 0, mp: [], casts: 0 };
    for (let i = 0; i < n; i++) {
      const p = startAt(standardParty(Math.min(T, 9), kind), 0.6);
      const r = fight(p, { zone: z, tier: T, noRare: true, golden: false, rare: false });
      if (!r) { res('A2', 'SKIP', '-', '', 'R.Battle.simulate unavailable'); return; }
      if (r.result === 'none') break;
      acc.n++;
      if (r.result === 'win') acc.win++;
      if (r.result === 'lose') acc.wipe++;
      if (r.anyDown) acc.down++;
      acc.rounds.push(r.rounds); acc.loss.push(r.hpLostPct); acc.net.push(r.netLossPct); acc.mp.push(r.mpUsedPct);
      const ci = casterIndex(p); if (ci >= 0) acc.casts += r.casts[ci] || 0;
    }
    if (!acc.n) continue;
    (e.region === 'postgame' ? pgData : zoneData).push(acc);
    if (VERBOSE) log(`  ${z.padEnd(24)} T${T} n${acc.n} win ${f1(pct(acc.win, acc.n))}% rounds ${f2(mean(acc.rounds))} HP-${f1(mean(acc.loss))}% (p95 ${f1(q(acc.loss, 0.95))}) net-${f1(mean(acc.net))}% down ${f1(pct(acc.down, acc.n))}% MP ${f1(mean(acc.mp))}% casts ${f2(acc.casts / acc.n)}`);
  }
  if (!zoneData.length) { res('A2', 'SKIP', '-', '', 'no zone could be simulated'); return; }
  if (pgData.length) {
    const L = pgData.flatMap((a) => a.loss), W = pgData.reduce((s2, a) => s2 + a.win, 0), N = pgData.reduce((s2, a) => s2 + a.n, 0);
    res('A2pg', 'INFO', `post-game mobs: win ${f1(pct(W, N))}% HP-loss ${f1(mean(L))}% (p95 ${f1(q(L, 0.95))}%) — ${pgData.map((a) => `${a.z} ${f1(mean(a.loss))}%`).join(' ')}`, 'not a §4.17.3 item', 'party Lv LZ(9)+1');
  }
  const all = { n: 0, win: 0, down: 0, wipe: 0, rounds: [], loss: [], mp: [], casts: 0 };
  for (const a of zoneData) { all.n += a.n; all.win += a.win; all.down += a.down; all.wipe += a.wipe; all.rounds.push(...a.rounds); all.loss.push(...a.loss); all.mp.push(...a.mp); all.casts += a.casts; }
  const zoneMeans = zoneData.map((a) => ({ k: `${a.z}@T${a.T}`, m: mean(a.loss) }));
  const outZ = zoneMeans.filter((x) => x.m < 5 || x.m > 15);
  const winP = pct(all.win, all.n), rnd = mean(all.rounds), lossM = mean(all.loss), p95 = q(all.loss, 0.95), downP = pct(all.down, all.n), wipeP = pct(all.wipe, all.n);
  const ok = winP >= 99.5 && rnd >= 2.5 && rnd <= 3.5 && lossM >= 8 && lossM <= 12 && !outZ.length && p95 <= 20 && downP <= 3 && wipeP <= 0.1;
  res('A2', ok ? 'PASS' : 'FAIL', `win ${f1(winP)}% rounds ${f2(rnd)} HP-loss ${f1(lossM)}% (zones ${f1(Math.min(...zoneMeans.map((x) => x.m)))}–${f1(Math.max(...zoneMeans.map((x) => x.m)))}%) p95 ${f1(p95)}% downs ${f1(downP)}% wipes ${f2(wipeP)}%`,
    'win ≥ 99.5 · rounds 2.5–3.5 · loss 8–12 (every zone 5–15) · p95 ≤ 20 · downs ≤ 3 · wipes ≤ 0.1', `${zoneData.length} zone×tier, ${all.n} fights${outZ.length ? '; out of 5–15: ' + outZ.slice(0, 6).map((x) => `${x.k} ${f1(x.m)}`).join(' ') : ''}`);
  const mpM = mean(all.mp), cpb = all.casts / all.n;
  res('A3', mpM <= 12 && cpb >= 0.75 ? 'PASS' : 'FAIL', `MP ${f1(mpM)}% of max per fight (techs + spells); caster casts ${f2(cpb)}/fight`, 'MP ≤ 12% · casts ≥ 0.75', 'fights start at 60% MP (§4.17.1, SYSTEMS_REWORK §4.3)');
  // B4: per region, zones across tiers within ±15% of their mean
  const byRegion = {};
  for (const a of zoneData) if (/^r_/.test(a.region) && typeof DB.encounters[a.z].tier !== 'number') (byRegion[a.region] = byRegion[a.region] || []).push(a);
  const devs = [];
  for (const [rg, list2] of Object.entries(byRegion)) {
    const byZone = {};
    for (const a of list2) (byZone[a.z] = byZone[a.z] || []).push(a);
    for (const [z, rows] of Object.entries(byZone)) {
      if (rows.length < 2) continue;
      for (const key of ['rounds', 'loss']) {
        const ms = rows.map((r) => mean(r[key])), mu = mean(ms);
        for (let i = 0; i < ms.length; i++) devs.push({ k: `${z}@T${rows[i].T} ${key}`, d: mu ? (ms[i] - mu) / mu : 0 });
      }
      const ws = rows.map((r) => pct(r.win, r.n)), wmu = mean(ws);
      for (let i = 0; i < ws.length; i++) devs.push({ k: `${z}@T${rows[i].T} win`, d: wmu ? (ws[i] - wmu) / wmu : 0 });
    }
  }
  if (devs.length) {
    const worst = devs.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const bad = worst.filter((x) => Math.abs(x.d) > 0.15);
    res('B4', bad.length ? 'FAIL' : 'PASS', `max deviation ${f1(100 * Math.abs(worst[0].d))}% (${worst[0].k})`, '±15% of the zone mean over T0–T7', bad.length ? `${bad.length} outside: ${bad.slice(0, 5).map((x) => `${x.k} ${f1(100 * x.d)}%`).join(' ')}` : '');
  }
}

// ------------------------------------------------------------------------------------ A3b (a dungeon floor)
function A3b() {
  const dz = zoneList().filter(([z, e]) => /^z_/.test(z) && e.region !== 'prologue');
  if (!dz.length) { res('A3b', 'SKIP', '-', '', 'no dungeon zones'); return; }
  const ends = [], lows = [];
  let wipes = 0, chains = 0;
  const chainsPer = FULL ? 20 : QUICK ? 3 : 6;
  for (const [z, e] of dz) for (const T of zoneTiers(e).filter((t, i, a) => i === 0 || i === a.length - 1 || !QUICK)) {
    for (let k = 0; k < chainsPer; k++) {
      const p = startAt(standardParty(T), 1);
      const ci = casterIndex(p);
      if (ci < 0) break;
      const nF = 8 + ((k * 7 + T) % 5);
      let ok = true;
      for (let i = 0; i < nF; i++) {
        const r = fight(p, { zone: z, tier: T, lvOff: i >= nF / 2 ? 2 : undefined, noRare: true, golden: false, rare: false });
        if (!r) { res('A3b', 'SKIP', '-', '', 'simulate unavailable'); return; }
        if (r.result === 'lose') { ok = false; wipes++; break; }
        p.party = r.party.map((c) => JSON.parse(JSON.stringify(c)));
        p.inv = r.inv || p.inv;
        PM.afterBattle(R, p.party, r.result);
      }
      chains++;
      if (!ok) continue;
      const c = p.party[ci], st = statsSafe(c);
      if (st && st.mp) { ends.push(100 * c.mp / st.mp); }
    }
  }
  if (!ends.length) { res('A3b', 'SKIP', '-', '', 'no caster / no chain finished'); return; }
  const m = mean(ends);
  res('A3b', m >= 30 && !wipes ? 'PASS' : 'FAIL', `caster MP left ${f1(m)}% (p10 ${f1(q(ends, 0.1))}%), ${wipes} wipe(s) in ${chains} floors`, '≥ 30% of max MP after 8–12 fights, no rest', 'second half of each floor at lvOff 2');
}

// ------------------------------------------------------------------------------------ bosses
function bossTroops(filterFn) {
  return Object.entries(DB.troops || {}).filter(([t, tr]) => (!TROOPS || TROOPS.includes(t)) && /^tr_b_/.test(t) && filterFn(t, tr));
}
function bossRun(p, tid, T, n) {
  const acc = { n: 0, win: 0, rounds: [], deaths: [], glim: 0 };
  for (let i = 0; i < n; i++) {
    const pp = { party: p.party.map((c) => JSON.parse(JSON.stringify(c))), inv: Object.assign({}, p.inv) };
    const r = fight(pp, { troop: tid, tier: T, items: true });
    if (!r || r.result === 'none') return null;
    acc.n++;
    if (r.result === 'win') { acc.win++; acc.rounds.push(r.rounds); }
    acc.deaths.push(r.deaths || r.downs || 0);
    if ((r.glimmers || []).length) acc.glim++;
  }
  return acc;
}
const bossData = [];
function B1() {
  const list = bossTroops((t, tr) => tr.scale === 'tier');
  if (!list.length) { res('B1', 'SKIP', '-', '', 'no scale:tier boss troops'); return; }
  const tiers = FULL ? [0, 1, 2, 3, 4, 5, 6, 7] : QUICK ? [0, 7] : [0, 3, 5, 7];
  for (const [tid] of list) for (const T of tiers) {
    const kind = bossKind(tid);
    const p = startAt(standardParty(T, kind === 'region' ? 'boss' : 'mid'), 1);
    const a = bossRun(p, tid, T, Math.max(8, Math.round(NBASE / 2)));
    if (!a) { res('B1', 'SKIP', '-', '', 'simulate unavailable'); return; }
    a.tid = tid; a.T = T; a.kind = kind;
    bossData.push(a);
    if (VERBOSE) log(`  ${tid.padEnd(20)} ${kind.padEnd(6)} T${T} win ${f1(pct(a.win, a.n))}% rounds ${f1(mean(a.rounds))} deaths ${f2(mean(a.deaths))} glimmer ${f1(pct(a.glim, a.n))}%`);
  }
  const badW = bossData.filter((a) => pct(a.win, a.n) < 85);
  const badR = bossData.filter((a) => a.rounds.length && (a.kind === 'region' ? mean(a.rounds) < 8 || mean(a.rounds) > 11 : mean(a.rounds) < 5 || mean(a.rounds) > 7));
  const badD = bossData.filter((a) => mean(a.deaths) > 1.0);
  const winAll = mean(bossData.map((a) => pct(a.win, a.n)));
  res('B1', badW.length || badR.length || badD.length ? 'FAIL' : 'PASS', `win ${f1(winAll)}% avg (min ${f1(Math.min(...bossData.map((a) => pct(a.win, a.n))))}%), rounds mid ${f1(mean(bossData.filter((a) => a.kind !== 'region').flatMap((a) => a.rounds)))} / region ${f1(mean(bossData.filter((a) => a.kind === 'region').flatMap((a) => a.rounds)))}, deaths ${f2(mean(bossData.flatMap((a) => a.deaths)))}`,
    'win ≥ 85 · rounds mid 5–7 / region 8–11 · deaths ≤ 1.0', [badW.length ? `win<85: ${badW.slice(0, 4).map((a) => `${a.tid}@T${a.T} ${f1(pct(a.win, a.n))}%`).join(' ')}` : '', badR.length ? `rounds: ${badR.slice(0, 4).map((a) => `${a.tid}@T${a.T} ${f1(mean(a.rounds))}`).join(' ')}` : ''].filter(Boolean).join('; '));
  // B4 for bosses as well
  const byT = {};
  for (const a of bossData) (byT[a.tid] = byT[a.tid] || []).push(a);
  const devs = [];
  for (const [tid, rows] of Object.entries(byT)) if (rows.length > 1) {
    const ms = rows.map((r) => mean(r.rounds)).filter(isFinite), mu = mean(ms);
    rows.forEach((r) => { const m = mean(r.rounds); if (isFinite(m) && mu) devs.push({ k: `${tid}@T${r.T}`, d: (m - mu) / mu }); });
  }
  if (devs.length) {
    const w = devs.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    res('B4b', Math.abs(w[0].d) > 0.15 ? 'FAIL' : 'PASS', `boss rounds max deviation ${f1(100 * Math.abs(w[0].d))}% (${w[0].k})`, '±15% over T0–T7', '');
  }
}

function B2() {
  const regionBosses = bossTroops((t, tr) => tr.scale === 'tier' && bossKind(t) === 'region').map(([t]) => t);
  if (!regionBosses.length || !Object.keys(DB.companions || {}).length) { res('B2', 'SKIP', '-', '', 'no region bosses / companions'); return; }
  const triples = PM.triples(R);
  const perHero = FULL ? 200 : QUICK ? 4 : 34;
  const combos = [];
  // the 12 named combos (§5.4.3)
  for (const c of PM.COMBOS) combos.push({ name: `#${c.no} ${c.name}`, heroType: c.heroType, favor: c.favor, members: c.members });
  // stratified sample: every hero variant × evenly spaced triples (must include no healer / all casters / all fighters)
  PM.HERO_VARIANTS.forEach((h, hi) => {
    for (let k = 0; k < perHero; k++) {
      const t = triples[Math.floor(((k + hi * 0.37) * triples.length) / perHero) % triples.length];
      combos.push({ name: `${h.heroType}/${h.favor.id}+${t.join(',')}`, heroType: h.heroType, favor: h.favor, members: t });
    }
  });
  const perCombo = FULL ? 12 : QUICK ? 3 : 6;
  const rows = [];
  for (const [ci, cb] of combos.entries()) {
    let win = 0, n = 0; const rounds = [];
    for (let k = 0; k < perCombo; k++) {
      const tid = regionBosses[(ci + k) % regionBosses.length];
      const T = [0, 2, 4, 6, 7, 3, 5, 1][(ci * 3 + k) % 8];
      const p = startAt(party(`cb:${cb.heroType}:${cb.favor.id}:${cb.members.join(',')}:${T}`, () => PM.build(R, { tier: T, members: ['hero', ...cb.members], heroType: cb.heroType, favor: cb.favor, kind: 'boss', gear: 'shop' })), 1);
      const r = fight(p, { troop: tid, tier: T, items: true });
      if (!r || r.result === 'none') continue;
      n++; if (r.result === 'win') { win++; rounds.push(r.rounds); }
    }
    if (!n) continue;
    rows.push({ cb, win: pct(win, n), rounds: mean(rounds), n });
    if (VERBOSE) log(`  ${cb.name.padEnd(46)} win ${f1(pct(win, n))}% rounds ${f1(mean(rounds))}`);
  }
  if (!rows.length) { res('B2', 'SKIP', '-', '', 'no boss fight could be simulated'); return; }
  const wins = rows.map((r) => r.win);
  const minR = rows.reduce((a, b) => (b.win < a.win ? b : a));
  res('B2', Math.min(...wins) >= 70 && q(wins, 0.5) >= 88 ? 'PASS' : 'FAIL', `${rows.length} combos: min ${f1(minR.win)}% (${minR.cb.name}), median ${f1(q(wins, 0.5))}%`, 'every combo ≥ 70, median ≥ 88', `${perCombo} region-boss fights per combo over T0–T7`);
  const sorted = rows.slice().sort((a, b) => b.win - a.win), k10 = Math.max(1, Math.round(rows.length / 10));
  const top = mean(sorted.slice(0, k10).map((r) => r.win)), bot = mean(sorted.slice(-k10).map((r) => r.win));
  const rs = rows.map((r) => r.rounds).filter(isFinite).sort((a, b) => a - b);
  const rr = rs.length ? mean(rs.slice(-k10)) / mean(rs.slice(0, k10)) : NaN;
  res('B3', top - bot <= 20 && (!isFinite(rr) || rr <= 1.6) ? 'PASS' : 'FAIL', `top 10% ${f1(top)}% − bottom 10% ${f1(bot)}% = ${f1(top - bot)} pts; rounds slow/fast ${f2(rr)}`, '≤ 20 points · rounds ≤ 1.6', '');
  // B5: per companion
  const per = {};
  for (const r of rows) for (const m of r.cb.members) { (per[m] = per[m] || { w: [], r: [] }).w.push(r.win); if (isFinite(r.rounds)) per[m].r.push(r.rounds); }
  const pm = Object.entries(per).map(([id, v]) => ({ id, w: mean(v.w), r: mean(v.r) }));
  if (pm.length >= 2) {
    const wmax = pm.reduce((a, b) => (b.w > a.w ? b : a)), wmin = pm.reduce((a, b) => (b.w < a.w ? b : a));
    const rmax = Math.max(...pm.map((x) => x.r).filter(isFinite)), rmin = Math.min(...pm.map((x) => x.r).filter(isFinite));
    res('B5', wmax.w - wmin.w <= 8 && rmax / rmin <= 1.15 ? 'PASS' : 'FAIL', `win ${f1(wmin.w)}% (${wmin.id}) … ${f1(wmax.w)}% (${wmax.id}) = ${f1(wmax.w - wmin.w)} pts; rounds ${f2(rmax / rmin)}×`, 'max − min ≤ 8 pts · rounds ≤ 1.15×', `${pm.length} companions`);
  }
}

// ------------------------------------------------------------------------------------ C
function C() {
  // C1: final region mobs (A2 at tier 8 zones) and mid bosses at Lv 56
  const fin = zoneData.filter((a) => DB.encounters[a.z].region === 'finale');
  if (fin.length) {
    // "A2 と同じ": the whole A2 row, applied to the final region's zones (party Lv 56, §4.17.1)
    const all = fin.flatMap((a) => a.loss), rnds = fin.flatMap((a) => a.rounds), wins = fin.reduce((s, a) => s + a.win, 0), n = fin.reduce((s, a) => s + a.n, 0);
    const downs = fin.reduce((s, a) => s + a.down, 0), wipes = fin.reduce((s, a) => s + a.wipe, 0);
    const zm = fin.map((a) => ({ k: a.z, m: mean(a.loss) })), outZ = zm.filter((x) => x.m < 5 || x.m > 15);
    const ok = pct(wins, n) >= 99.5 && mean(rnds) >= 2.5 && mean(rnds) <= 3.5 && mean(all) >= 8 && mean(all) <= 12 && !outZ.length && q(all, 0.95) <= 20 && pct(downs, n) <= 3 && pct(wipes, n) <= 0.1;
    res('C1a', ok ? 'PASS' : 'FAIL', `final mobs (Lv 56): win ${f1(pct(wins, n))}% rounds ${f2(mean(rnds))} HP-loss ${f1(mean(all))}% (${zm.map((x) => `${x.k} ${f1(x.m)}`).join(' ')}) p95 ${f1(q(all, 0.95))}% downs ${f1(pct(downs, n))}%`, 'as A2 (loss 8–12, every zone 5–15, rounds 2.5–3.5 …)', `${n} fights`);
  }
  const fmid = bossTroops((t, tr) => tr.tier === 8 && !/nemrea/.test(t));
  if (fmid.length) {
    const rows = [];
    for (const [tid] of fmid) {
      const p = startAt(party(`fin:${tid}`, () => PM.standard(R, 8, { level: 56 })), 1);
      const a = bossRun(p, tid, 8, Math.max(8, Math.round(NBASE / 2)));
      if (a) rows.push({ tid, win: pct(a.win, a.n), rounds: mean(a.rounds), deaths: mean(a.deaths) });
    }
    if (rows.length) res('C1b', rows.every((r) => r.win >= 85 && r.deaths <= 1 && r.rounds >= 9 && r.rounds <= 12) ? 'PASS' : 'FAIL', rows.map((r) => `${r.tid.replace('tr_b_', '')} ${f1(r.win)}%/${f1(r.rounds)}r/${f2(r.deaths)}d`).join(' '), 'win ≥ 85 · rounds 9–12 (§4.14.3 最終ダンジョンの中ボス) · deaths ≤ 1.0 (Lv 56)', '');
  }
  // C2: last boss, two forms back to back (after-battle recovery in between)
  if (DB.troops.tr_b_nemrea1 && DB.troops.tr_b_nemrea2) {
    let win = 0, n = 0; const rounds = [];
    const N = Math.max(10, Math.round(NBASE / 2));
    for (let i = 0; i < N; i++) {
      const p = startAt(party('last', () => PM.standard(R, 8, { level: 58 })), 1);
      const r1 = fight(p, { troop: 'tr_b_nemrea1', tier: 8, items: true });
      if (!r1 || r1.result === 'none') break;
      n++;
      if (r1.result !== 'win') continue;
      // §10.10.4: the naming scene ends with ev.heal() (everyone fully restored) before the second form
      p.party = r1.party.map((c) => JSON.parse(JSON.stringify(c))); p.inv = r1.inv || p.inv;
      startAt(p, 1);
      const r2 = fight(p, { troop: 'tr_b_nemrea2', tier: 8, items: true });
      if (r2 && r2.result === 'win') { win++; rounds.push(r1.rounds + r2.rounds); }
    }
    if (n) res('C2', pct(win, n) >= 75 && mean(rounds) >= 16 && mean(rounds) <= 22 ? 'PASS' : 'FAIL', `win ${f1(pct(win, n))}% rounds ${f1(mean(rounds))}`, 'win ≥ 75 · 16–22 rounds (Lv 58)', `${n} runs`);
    else res('C2', 'SKIP', '-', '', 'simulate unavailable');
  } else res('C2', 'SKIP', '-', '', 'tr_b_nemrea1/2 missing');
  // C3: superboss with the realistic gear + 4 rare/super slots vs the normal set (Lv 64)
  if (DB.troops.tr_b_ouroboros) {
    const run = (gear, extra) => {
      let win = 0, n = 0;
      const N = Math.max(10, Math.round(NBASE / 2));
      for (let i = 0; i < N; i++) {
        const p = startAt(party(`sb:${gear}:${extra}`, () => PM.standard(R, 9, Object.assign({ level: 64, gear }, extra ? { superSlots: extra } : {}))), 1);
        const r = fight(p, { troop: 'tr_b_ouroboros', tier: 9, items: true, maxRounds: 80 });
        if (!r || r.result === 'none') break;
        n++; if (r.result === 'win') win++;
      }
      return n ? pct(win, n) : null;
    };
    const good = run('real', 4), normal = run('shop', 0);
    if (good == null) res('C3', 'SKIP', '-', '', 'simulate unavailable');
    else res('C3', good >= 50 && normal <= 20 ? 'PASS' : 'FAIL', `rare/super gear ${f1(good)}%, normal set ${f1(normal)}%`, '≥ 50% / ≤ 20% (Lv 64)', '');
  } else res('C3', 'SKIP', '-', '', 'tr_b_ouroboros missing');
}

// ------------------------------------------------------------------------------------ D
function D() {
  const T = 8;
  const mk = (heroType, favor, build, weapons, gear) => PM.build(R, { tier: T, members: ['hero'], heroType, favor, build, weapons, gear, learned: false }).party[0];
  // §4.3.7 / §8.13.1: the ratio of the stat effect with the same weapon power (W or Wm of the T8 normal weapon);
  // the special effects of the super set (mag +16, magicPct +30 …) come on top and are shown for information
  const ratio = (get, stat, heroType, favor, build, weapons, name, key) => {
    const z = mk(heroType, favor, build, weapons, 'none'), nn = mk(heroType, favor, build, weapons, 'shop'), s = mk(heroType, favor, build, weapons, 'super');
    const sts = [z, nn, s].map((c) => statsSafe(c));
    if (sts.some((x) => !x)) { res(key, 'SKIP', '-', '', 'stats failed'); return { z, nn, s }; }
    const W0 = get(sts[0]) / ((64 + sts[0][stat]) / 64);                 // the weapon power behind the Z value
    const [vz, vn, vs] = sts.map((st) => Math.round(W0 * (64 + st[stat]) / 64));
    const sz = vs / vz, sn = vs / vn;
    res(key, sz >= 2.4 && sz <= 2.7 && sn >= 1.6 && sn <= 1.75 ? 'PASS' : 'FAIL', `${name} ${stat} ${sts.map((x) => x[stat]).join('/')} → Z ${vz} / N ${vn} / S ${vs}: S/Z ${f2(sz)} S/N ${f2(sn)}`, 'S/Z 2.4–2.7 · S/N 1.6–1.75',
      `T8 ${weapons.join('+')}; with the S set's own effects ${get(sts[2])} (${f2(get(sts[2]) / get(sts[0]))}× Z)`);
    return { z, nn, s };
  };
  if (!R.Rules || !R.Rules.stats) { res('D', 'SKIP', '-', '', 'R.Rules.stats missing'); return; }
  const int = ratio((st) => st.mag, 'int', 'mage', { kind: 'element', id: 'fire' }, 'magic', ['staff', 'staff'], '術力', 'D1');
  ratio((st) => (st.w && st.w.weapon1 ? st.w.weapon1.atk : NaN), 'str', 'warrior', { kind: 'weapon', id: 'sword' }, 'phys', ['sword', 'sword'], '攻撃力', 'D2a');
  ratio((st) => (st.w && st.w.weapon1 ? st.w.weapon1.atk : NaN), 'dex', 'ranger', { kind: 'weapon', id: 'dagger' }, 'phys', ['dagger', 'dagger'], '攻撃力', 'D2b');
  // D3: cloth caster vs heavy warrior, same enemy, both front row
  const war = mk('warrior', { kind: 'weapon', id: 'sword' }, 'phys', ['sword', 'axe'], 'shop');
  const cs = statsSafe(int.nn), ws = statsSafe(war);
  if (cs && ws) {
    const dk = DK(LZ(T) + 1);
    const taken = (st) => dk / (dk + st.def) * (1 + (((st.mods || {}).takenPct) || 0) / 100);
    const rr = taken(cs) / taken(ws);
    res('D3', rr >= 1.35 ? 'PASS' : 'FAIL', `cloth def ${cs.def} vs heavy def ${ws.def}: ×${f2(rr)} physical damage`, '≥ 1.35×', `DK ${dk}`);
  }
  // D4: glimmer chance with the three int builds
  if (R.Glimmer && R.Glimmer.chance) {
    const sp = Object.keys(DB.actions).find((id) => /^s_fire_4$/.test(id)) || Object.keys(DB.actions).find((id) => /^s_fire_[2-5]$/.test(id));
    const ctx = { kind: 'spell', elements: ['fire'], used: 's_fire_1', rankB: 9, ef: 1, tier: 8, row: 'middle', silenced: false };
    const p = [int.z, int.nn, int.s].map((c) => { c.spells = ['s_fire_1']; c.techs = []; c.eprof.fire = 999; try { return R.Glimmer.chance(c, sp, ctx); } catch (e) { return NaN; } });
    const sz = p[2] / p[0], sn = p[2] / p[1];
    res('D4', sz >= 1.8 && sn >= 1.35 ? 'PASS' : 'FAIL', `p(${sp}) Z ${f2(100 * p[0])}% N ${f2(100 * p[1])}% S ${f2(100 * p[2])}%: S/Z ${f2(sz)} S/N ${f2(sn)}`, 'S/Z ≥ 1.8 · S/N ≥ 1.35', 'R.Glimmer.chance, T8 rankB 9');
  } else res('D4', 'SKIP', '-', '', 'R.Glimmer.chance missing');
}

// ------------------------------------------------------------------------------------ E (growth)
function E() {
  const Ru = R.Rules;
  if (!Ru || !Ru.battleExp || !Ru.gainExp || !Ru.stats) { res('E1', 'SKIP', '-', '', 'R.Rules.battleExp/gainExp missing'); return; }
  const curve = (L) => (R.Mon && R.Mon.curve ? R.Mon.curve(L) : { exp: 3 + 1.2 * L + 0.06 * L * L });
  const mon = (L, mult) => ({ id: 'qa_std', lv: L, exp: Math.round(curve(L).exp * (mult || 1)), gold: 0, flags: [] });
  const fightExp = (c, L, count, mult) => { const killed = []; for (let i = 0; i < count; i++) killed.push(mon(L, mult)); try { return Ru.battleExp(c, killed); } catch (e) { return 0; } };
  const b = PM.build(R, { tier: 0, members: ['hero', 'brigitta', 'marta', 'sylvain', 'selma'], level: 5, learned: false });
  const act = b.party.slice(0, 4), res2 = b.party[4];
  for (const c of b.party) { c.level = 5; c.exp = Ru.expForLevel ? Ru.expForLevel(5) : 0; }
  const rows = [];
  let grindOk = true, hpOk = true;
  for (let T = 0; T <= 7; T++) {
    const L = LZ(T) + 1;
    const run95 = (cs, reserve) => {
      for (let i = 0; i < 95; i++) {
        const cnt = i % 10 < 3 ? 4 : 3;                          // 3.3 monsters per fight
        for (const c of cs) Ru.gainExp(c, fightExp(c, L, cnt));
        if (reserve) Ru.gainExp(reserve, Math.round(fightExp(reserve, L, cnt) * 0.6));
      }
    };
    run95(act, res2);
    // mid boss (×10) then region boss (×20)
    for (const c of act) Ru.gainExp(c, fightExp(c, LZ(T) + 2, 1, 10));
    Ru.gainExp(res2, Math.round(fightExp(res2, LZ(T) + 2, 1, 10) * 0.6));
    const atBoss = act[0].level;
    for (const c of act) Ru.gainExp(c, fightExp(c, LZ(T) + 3, 1, 20));
    Ru.gainExp(res2, Math.round(fightExp(res2, LZ(T) + 3, 1, 20) * 0.6));
    // grinding: 100 more fights in this region from a copy
    const g = JSON.parse(JSON.stringify(act[0]));
    const hp0 = statsSafe(g).hp, lv0 = g.level;
    for (let i = 0; i < 100; i++) Ru.gainExp(g, fightExp(g, L, i % 10 < 3 ? 4 : 3));
    const dLv = g.level - lv0, dHp = statsSafe(g).hp / hp0 - 1;
    if (dLv > 3) grindOk = false;
    if (T >= 2 && dHp > 0.10) hpOk = false;
    rows.push({ T, atBoss, rel: atBoss - LZ(T), lag: act[0].level - res2.level, dLv, dHp });
  }
  const badB = rows.filter((r) => r.rel < 2 || r.rel > 5), badLag = rows.filter((r) => r.lag > 3);
  res('E1', !badB.length && !badLag.length && grindOk ? 'PASS' : 'FAIL', rows.map((r) => `T${r.T} Lv${r.atBoss}(LZ+${r.rel}) lag${r.lag} +${r.dLv}`).join(' '), 'boss at LZ+2…+5 · reserve lag ≤ 3 · +100 fights ≤ +3 levels', 'model: 95 fights (3.3 standard monsters at LZ+1) + 2 bosses per region, from Lv5');
  res('E2', hpOk ? 'PASS' : 'FAIL', rows.filter((r) => r.T >= 2).map((r) => `T${r.T} +${f1(100 * r.dHp)}%`).join(' '), 'max HP +10% or less from 100 extra fights (T2+)', '');
}

// ------------------------------------------------------------------------------------ I (weakness spread)
function I() {
  const mobs = Object.entries(DB.monsters || {}).filter(([id, m]) => m.lineage && !/^(rm_|b_)/.test(id) && !(m.flags || []).includes('metal'));
  if (mobs.length < 20) { res('I', 'SKIP', '-', '', 'monsters not landed'); return; }
  const out = [];
  let ok = true;
  for (const el of PM.ELEMENTS) { const p = pct(mobs.filter(([, m]) => ((m.elem || {})[el] || 1) >= 1.5).length, mobs.length); out.push(`${el} ${f1(p)}%`); if (p < 12 || p > 25) ok = false; }
  for (const k of ['slash', 'blunt', 'pierce']) { const p = pct(mobs.filter(([, m]) => ((m.phys || {})[k] || 1) >= 1.25).length, mobs.length); out.push(`${k} ${f1(p)}%`); if (p < 10) ok = false; }
  res('I', ok ? 'PASS' : 'FAIL', out.join(' '), 'each element 12–25% · each kind ≥ 10%', `${mobs.length} mobs`);
}

// ------------------------------------------------------------------------------------ J (optimize)
function J() {
  const Ru = R.Rules;
  if (!Ru || !Ru.optimize) { res('J', 'SKIP', '-', '', 'R.Rules.optimize missing'); return; }
  const score = (c, mode) => {
    const st = statsSafe(c); if (!st) return NaN;
    const a1 = st.w && st.w.weapon1 ? st.w.weapon1.atk : 0, a2 = st.w && st.w.weapon2 ? st.w.weapon2.atk : 0;
    const phys = a1 + 0.5 * a2 + 0.6 * st.def + 0.3 * st.mdef, magic = st.mag + 0.6 * st.mdef + 0.3 * st.def;
    return mode === 'phys' ? phys : mode === 'magic' ? magic : (phys + magic) / 2;
  };
  let checked = 0; const probs = [];
  for (const T of [2, 5, 8]) {
    const combos = [PM.COMBOS[0], PM.COMBOS[1], PM.COMBOS[3], PM.COMBOS[6]];
    for (const cb of combos) {
      const b = PM.build(R, { tier: Math.max(0, T - 1), members: ['hero', ...cb.members], heroType: cb.heroType, favor: cb.favor, gear: 'shop', learned: false });
      // a bag of this tier's normal and rare equipment (2 of each) and a few quirk items
      const inv = {};
      for (const [id, it] of Object.entries(DB.items)) if (/^(weapon|shield|head|body|hands|feet|acc)$/.test(it.type) && (it.tier === T || (it.quirk && it.tier <= T)) && ['shop', 'drop'].includes(it.src)) inv[id] = 2;
      PM.withGame(R, { tier: T, party: b.party, inv }, (g) => {
        for (const c of b.party) for (const mode of ['phys', 'magic', 'balance']) {
          let plan;
          try { plan = Ru.optimize(c, mode); } catch (e) { probs.push(`${c.id}/${mode}: threw ${e.message}`); continue; }
          checked++;
          if (!plan || !plan.equip) { probs.push(`${c.id}/${mode}: no plan`); continue; }
          if ('acc1' in plan.equip || 'acc2' in plan.equip) probs.push(`${c.id}/${mode}: plan touches the accessories`);
          for (const [slot, id] of Object.entries(plan.equip)) {
            if (!id || id === c.equip[slot]) continue;
            const it = DB.items[id];
            if (it && it.quirk) probs.push(`${c.id}/${mode}: picks quirk item ${id}`);
            const own2 = Object.values(c.equip).filter((x) => x === id).length;
            if (!(g.inv[id] > 0) && !own2) probs.push(`${c.id}/${mode}: ${id} is neither carried nor worn by ${c.id}`);
            if (it && it.type === 'weapon' && c.equip[slot] && DB.items[c.equip[slot]] && DB.items[c.equip[slot]].wtype !== it.wtype) probs.push(`${c.id}/${mode}: ${slot} changes weapon type`);
          }
          const before = score(c, mode);
          const copy = JSON.parse(JSON.stringify(c));
          for (const [slot, id] of Object.entries(plan.equip)) copy.equip[slot] = id;
          const after = score(copy, mode);
          if (after + 1e-6 < before) probs.push(`${c.id}/${mode}: score drops ${f1(before)} → ${f1(after)}`);
          if (c.equip.acc1 !== copy.equip.acc1 || c.equip.acc2 !== copy.equip.acc2) probs.push(`${c.id}/${mode}: accessories changed`);
        }
      });
    }
  }
  res('J', !probs.length && checked ? 'PASS' : checked ? 'FAIL' : 'SKIP', `${checked} plans, ${probs.length} problem(s)`, 'accessories and quirk items untouched · no one else\'s items · score ≥ before', probs.slice(0, 5).join('; '));
}

// ------------------------------------------------------------------------------------ K (repel)
async function Kcheck() {
  if (!R.Field || !R.Field.start || !R.State || !R.State.newGame) { res('K', 'SKIP', '-', '', 'R.Field / R.State missing'); return; }
  // a world zone of a region, at tier 3
  const world = DB.maps.world;
  const zones = ((world && world.zones) || []).filter((z) => /^zw_(forest|desert|snow|marsh|mine|ash|star)/.test(z.zone));
  if (!zones.length) { res('K', 'SKIP', '-', '', 'no world zones'); return; }
  const out = [];
  try {
    R.Gfx.textWidth = R.Gfx.textWidth || ((s) => String(s).length * 10.7);
    R.Audio = R.Audio || { sfx() {}, playBGM() {}, playJingle() { return Promise.resolve(); } };
    for (const [label, lvAdd] of [['at Lb', 0], ['Lb+3', 3]]) {
      R.State.newGame();
      const T = 3;
      if (R.Tier && R.Tier.clear) for (const r of Object.keys(DB.regions).slice(0, T)) R.Tier.clear(r);
      const z = zones[0];
      const b = PM.standard(R, T);
      let Lb = LZ(T);
      try { const zl = R.Rules.zoneLevel(z.zone, world); Lb = typeof zl === 'number' ? zl : zl.Lb; } catch (e) { /* default */ }
      for (const c of b.party) { c.level = Lb + lvAdd; const st = statsSafe(c); if (st) c.hp = st.hp; }
      R.Game.party = b.party;
      const done = R.Field.start('world', { x: z.x + (z.w >> 1), y: z.y + (z.h >> 1), dir: 'down' });
      for (let i = 0; i < 400; i++) { R.Engine.step(); await new Promise((r) => setImmediate(r)); }
      await Promise.race([done, new Promise((r) => setTimeout(r, 50))]);
      const L = R.Field.layer;
      if (!L || !L.encounterStep) { res('K', 'SKIP', '-', '', 'field layer has no encounterStep'); return; }
      R.Game.encItem = { id: 'i_repel', pct: -100, steps: 100, weakOnly: true };
      let battles = 0;
      const tile = { enc: 1 };
      const saved = R.Battle.start;
      for (let s = 0; s < 100; s++) if (L.encounterStep(tile, 1)) battles++;
      R.Battle.start = saved;
      out.push({ label, battles, Lb });
    }
  } catch (e) { res('K', 'SKIP', '-', '', 'field could not run in node: ' + e.message); return; }
  const a = out.find((x) => x.label === 'at Lb'), b = out.find((x) => x.label === 'Lb+3');
  res('K', a && b && a.battles >= 1 && b.battles === 0 ? 'PASS' : 'FAIL', `100 steps with 魔除けの香: party at Lb → ${a && a.battles} fight(s), at Lb+3 → ${b && b.battles}`, 'normal at Lb · 0 at ≥ Lb+3', `Lb ${a && a.Lb}`);
}

// ------------------------------------------------------------------------------------ G · H (the owners' simulators)
// §4.17.3 G (閃き) is measured by A8's tools/sim_glimmer.js and H1–H3 (drops, golden, rare monsters) by A12's
// tools/sim_loot.js; their JSON is read back here so the §4.17 table is complete in one report. H2 (every super-rare
// item in exactly one monster's super slot) is structural and checked here directly as well.
function childJson(file, args, timeoutS) {
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
  const f = path.join(__dirname, file);
  if (!fs.existsSync(f)) return { missing: true };
  const out = path.join(os.tmpdir(), `sim_balance_${process.pid}_${file.replace(/\W/g, '')}.json`);
  const r = cp.spawnSync(process.execPath, [f].concat(args, ['--json', out]), { encoding: 'utf8', timeout: timeoutS * 1000, maxBuffer: 32 << 20 });
  let j = null;
  try { j = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { j = null; }
  try { fs.unlinkSync(out); } catch (e) { /* ignore */ }
  return { j, code: r.status, timedOut: !!(r.error && r.error.code === 'ETIMEDOUT'), tail: String(r.stdout || '').trim().split('\n').slice(-1)[0] };
}
function G() {
  // slow (≈3 min): the default pass runs it only with --full or --only G
  if (!FULL && !(ONLY && ONLY.includes('G'))) { res('G', 'SKIP', '-', '§4.9.5', 'run with --full or --only G (tools/sim_glimmer.js, A8, ≈3 min)'); return; }
  const r = childJson('sim_glimmer.js', ['-q', '--no-engine', '--seed', String(SEED % 1000)], 900);
  if (r.missing) { res('G', 'SKIP', '-', '§4.9.5', 'tools/sim_glimmer.js (A8) missing'); return; }
  if (!r.j || !Array.isArray(r.j.results)) { res('G', 'SKIP', '-', '§4.9.5', `sim_glimmer gave no JSON (${r.timedOut ? 'timeout' : 'exit ' + r.code}): ${r.tail}`); return; }
  const hard = r.j.results.filter((x) => !x.guide), bad = hard.filter((x) => !x.ok);
  res('G', bad.length ? 'FAIL' : 'PASS', `${hard.length - bad.length}/${hard.length} of §4.9.5${bad.length ? ': ' + bad.map((x) => `${x.id} ${x.value}`).join('; ') : ''}`, '§4.9.5 table (A8 sim_glimmer)', hard.slice(0, 4).map((x) => `${x.id} ${x.value}`).join(' · '));
}
function H() {
  // H2 (structural): each super-rare item sits in exactly one monster's super slot
  const holders = {};
  for (const [id, m] of Object.entries(DB.monsters || {})) { const sp = m && m.drops && m.drops.super; const it = sp && (sp.item || sp.id); if (it) (holders[it] = holders[it] || []).push(id); }
  const supers = Object.keys(DB.items).filter((id) => DB.items[id].grade === 'super' && (DB.items[id].src === 'super' || DB.items[id].src == null));
  const none = supers.filter((id) => !holders[id]), many = supers.filter((id) => (holders[id] || []).length > 1);
  res('H2', supers.length && !none.length && !many.length ? 'PASS' : supers.length ? 'FAIL' : 'SKIP', `${supers.length} super-rare items: ${none.length} in no monster, ${many.length} in several`, 'each in exactly one super slot', [...none.slice(0, 3), ...many.slice(0, 3)].join(' '));
  if (QUICK && !(ONLY && ONLY.includes('H'))) { res('H1', 'SKIP', '-', '', 'quick pass (tools/sim_loot.js, A12)'); return; }
  const r = childJson('sim_loot.js', [], 600);
  if (r.missing) { res('H1', 'SKIP', '-', '', 'tools/sim_loot.js (A12) missing'); return; }
  if (!r.j || !Array.isArray(r.j.checks)) { res('H1', 'SKIP', '-', '', `sim_loot gave no JSON (${r.timedOut ? 'timeout' : 'exit ' + r.code}): ${r.tail}`); return; }
  const pick = (re) => r.j.checks.filter((c) => re.test(c.id));
  const row = (id, list, target) => { if (!list.length) { res(id, 'SKIP', '-', target, 'no matching sim_loot check'); return; } const bad = list.filter((c) => !c.ok); res(id, bad.length ? 'FAIL' : 'PASS', list.map((c) => `${c.id}: ${c.text}`).join(' · ').slice(0, 260), target, `A12 sim_loot (${r.j.engine || '?'})`); };
  row('H1', pick(/^L1/), '±10% of the formula; caps 0.75/0.5/0.125, mods ≤ +150');
  row('H3', pick(/^L2/), 'golden 2–3 · rare monsters 0.8–1.5 per region');
  const others = r.j.checks.filter((c) => !/^L[12]/.test(c.id) && !c.ok);
  if (others.length) res('L*', 'INFO', others.map((c) => `${c.id}: ${c.text}`).join(' · ').slice(0, 260), '§9.13.3 (A12)', 'reported by sim_loot, not a §4.17 item');
}

// ------------------------------------------------------------------------------------ main
(async () => {
  const t0 = Date.now();
  log(`sim_balance — seed ${SEED}, n ${NBASE}${FULL ? ' (full)' : QUICK ? ' (quick)' : ''}; engine ${engineOk ? 'ok' : 'INCOMPLETE'}`);
  const steps = [['A1', A1], ['A2', A2], ['A3b', A3b], ['B1', B1], ['B2', B2], ['C', C], ['D', D], ['E', E], ['G', G], ['H', H], ['I', I], ['J', J], ['K', Kcheck]];
  for (const [k, fn] of steps) {
    if (ONLY && !ONLY.some((o) => o === k || (k === 'H' && /^H/.test(o)) || (k === 'A2' && ['A3', 'B4', 'C1'].includes(o)) || (k === 'B2' && ['B3', 'B5'].includes(o)) || (k === 'C' && /^C/.test(o)) || (k === 'D' && /^D/.test(o)) || (k === 'E' && /^E/.test(o)))) continue;
    const t1 = Date.now();
    if (!engineOk && !['I', 'G', 'H'].includes(k)) { res(k, 'SKIP', '-', '', 'engine incomplete (R.Battle.simulate / R.Rules)'); continue; }
    try { await fn(); } catch (e) { res(k, 'SKIP', '-', '', 'threw: ' + (e && e.message)); }
    if (VERBOSE) log(`  (${k} ${Date.now() - t1} ms)`);
  }
  log('\n item  status  measured  |  target  |  note');
  for (const r of results) log(` ${r.id.padEnd(5)} ${r.status.padEnd(5)}  ${r.measured}  |  ${r.target}${r.note ? '  |  ' + r.note : ''}`);
  const fails = results.filter((r) => r.status === 'FAIL'), skips = results.filter((r) => r.status === 'SKIP');
  const infos = results.filter((r) => r.status === 'INFO');
  log(`\nsim_balance: ${results.length - fails.length - skips.length - infos.length} pass, ${fails.length} fail, ${skips.length} skip — seed ${SEED} — ${Math.round((Date.now() - t0) / 1000)} s`);
  const json = arg('json', null);
  if (json) require('fs').writeFileSync(json, JSON.stringify({ seed: SEED, n: NBASE, results }, null, 1));
  process.exitCode = fails.length ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 10);
})();
