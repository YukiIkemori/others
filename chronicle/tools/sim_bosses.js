#!/usr/bin/env node
// Boss simulator (A12, DESIGN §9.13.2 X1–X5, §4.17.3 B1/B2/B3/C1–C3, §4.9.5).
//
//   node tools/sim_bosses.js                  all checks (real engine ≈ 3–5 min on one core; --engine model ≈ 30 s)
//   node tools/sim_bosses.js --x 1,3 --n 40   only X1 and X3, 40 battles per case
//   node tools/sim_bosses.js --boss tr_b_dolls --tier 3 [--log]   one troop (per-battle log with --log)
//   node tools/sim_bosses.js --engine model   A12's compact rules model (tools/fixtures/boss/lib/model.js)
//   node tools/sim_bosses.js --tune [--write] [--keep] [--boss id,id] [--hp-grid a,b] [--atk-grid a,b]   calibrate the per-boss `s`
//   node tools/sim_bosses.js --sx "b_x:def=0.6,agi=0.8;b_y:hp=1"   try other `s` values (not written)
//   node tools/sim_bosses.js --json out.json  write every number
//
// Engines: 'real' = the Chronicle battle engine (R.Battle.Engine + R.BattleAI.partyCommands, the same
// code R.Battle.simulate drains) with qa's party model (tools/lib/party_model.js); 'model' = the A12
// rules model. 'auto' (default) = real when the engine has the Chronicle boss features, else model.
// Exit 1 when a check fails.
'use strict';
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const XS = String(arg('x', '1,2,3,4,5')).split(',').map(Number);
const SEED = +arg('seed', 12345);
const ENGINE = arg('engine', 'auto');
const ONE = arg('boss', null);
const JSON_OUT = arg('json', null);
const QUIET = !!arg('quiet', false);

const R = require('./lib/load')({ quiet: true });
let s0 = SEED >>> 0;
const rng = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const M = require('./fixtures/boss/lib/model.js')(R, { rng });
const DB = R.DB;

// ------------------------------------------------------------------ engine choice
const SYS = path.join(__dirname, '..', 'src', 'systems');
function realEngineReady() {
  try {
    if (!(R.Mon && R.Mon.fillStats && R.Battle && R.Battle.Engine && R.Battle.resolveMonsters && R.Battle.drain && R.BattleAI && R.BattleAI.partyCommands)) return false;
    if (!fs.existsSync(path.join(__dirname, 'lib', 'party_model.js'))) return false;
    const src = ['battle.js', 'battle_ai.js', 'mon.js'].map((f) => { try { return fs.readFileSync(path.join(SYS, f), 'utf8'); } catch (e) { return ''; } }).join('\n');
    if (!/summon/.test(src) || !/phases/.test(src) || !/countBelow/.test(src) || /DB\.abilities/.test(src)) return false;
    const d = DB.monsters.b_moth;
    return !!d && d.hp > 0;
  } catch (e) { return false; }
}
const USE_REAL = ENGINE === 'real' || (ENGINE === 'auto' && realEngineReady());
const PM = USE_REAL ? require('./lib/party_model') : null;
if (USE_REAL) { R.U.rng = rng; R.U.r = rng; }
const N = +arg('n', USE_REAL ? 40 : 120);

// ------------------------------------------------------------------ cases
const MID = ['tr_b_moth', 'tr_b_sandworm', 'tr_b_icegiant', 'tr_b_dolls', 'tr_b_octopus', 'tr_b_rockeater', 'tr_b_hellhound', 'tr_b_orrery'];
const REGION = ['tr_b_rooteater', 'tr_b_sandking', 'tr_b_whitedragon', 'tr_b_mistbeast', 'tr_b_captain', 'tr_b_ironwarden', 'tr_b_lavabeast', 'tr_b_stareater'];
const FMID = ['tr_b_bookgolem', 'tr_b_heroshades', 'tr_b_lazaro'];
const STANDARD = 'standard';        // §4.17.1: hero warrior/sword + brigitta (front) + marta + sylvain
const kindOf = (tr) => (MID.includes(tr) ? 'mid' : REGION.includes(tr) ? 'region' : FMID.includes(tr) ? 'fmid'
  : tr === 'tr_b_pageeater' ? 'prologue' : /rowell/.test(tr) ? 'rival' : /nemrea/.test(tr) ? 'last' : 'post');
const ROUNDS = { mid: [5, 7], region: [8, 11], fmid: [9, 12], prologue: [4, 8], rival: [4, 9] };
const PMKIND = { mid: 'mid', region: 'boss', fmid: 'final', last: 'last', post: 'super', prologue: 'prologue', rival: 'mid' };
const EXPECT = M.EXPECT;

function levelFor(tr, tier) {
  const k = kindOf(tr);
  if (k === 'prologue') return 5;        // §10.7: Lv 4〜6 at the lighthouse boss
  if (k === 'fmid') return 56;           // §4.17.1
  if (k === 'last') return 58;
  if (k === 'post') return 64;
  return M.LZ(tier) + (k === 'region' ? 3 : 2);
}
// techs/spells known at the boss: EXPECT(T) while at tier T (§4.9.4); a region boss ends the region (≈ EXPECT(T+1))
function knownFor(tr, tier) {
  const k = kindOf(tr);
  if (k === 'region') return EXPECT[Math.min(9, tier + 1)];
  if (k === 'mid' || k === 'prologue') return Math.round((EXPECT[tier] + EXPECT[Math.min(9, tier + 1)]) / 2);
  return EXPECT[Math.min(9, tier)];
}
const troopTier = (tr, T) => (DB.troops[tr].scale === 'tier' ? T : DB.troops[tr].tier != null ? DB.troops[tr].tier : T);

// ------------------------------------------------------------------ one battle
const ACT = (id) => DB.actions[id];
function newEv() { return { encore: 0, feed: 0, rewind: 0, summon: {}, phase: {}, used: {}, glimmers: 0, ko: new Set() }; }
const ACT_ID = new Map(Object.entries(DB.actions).filter(([k]) => /^eb_/.test(k)).map(([k, a]) => [a, k]));
function realParty(o, tier) {
  const pmo = { level: o.level, gear: o.gear === 'strong' ? 'real' : (o.gear || 'shop'), kind: PMKIND[o.kind] };
  if (o.gear === 'strong') pmo.superSlots = 4;
  if (o.members === STANDARD || !o.members) return PM.standard(R, tier, pmo);
  return PM.build(R, Object.assign({ tier, members: o.members, heroType: o.heroType, favor: o.favor, build: 'balanced' }, pmo));
}
function fightReal(tr, o) {
  const B = R.Battle;
  const tier = troopTier(tr, o.tier);
  const built = realParty(Object.assign({ kind: kindOf(tr) }, o), tier);
  const party = built.party.map((c) => R.U.clone(c)), inv = R.U.clone(built.inv || {});
  const r0 = B.resolveMonsters({ troop: tr, tier, noRare: true, noGolden: true }, { mods: B.charsMods ? B.charsMods(party) : {} });
  const eng = new B.Engine({ party, reserve: [], mons: r0.mons, inv, live: false, noEscape: true, noSurprise: true, tier: r0.Tb, lv: r0.Lb, glimTier: r0.Tb, troop: tr });
  const ev = newEv();
  const log = o.log ? [] : null;
  const sink = (e) => {
    if (!e) return;
    if (log && e.t === 'msg') log.push(e.text);
    if (e.t === 'phase' && e.u) { const i = ((e.u.d && e.u.d.phases) || []).findIndex((p) => p.msg === e.text); const k = e.u.id + '#' + Math.max(0, i); ev.phase[k] = (ev.phase[k] || 0) + 1; }
    else if (e.t === 'summon') for (const i of e.units || []) { const m = eng.mons[i]; if (m) ev.summon[m.id] = (ev.summon[m.id] || 0) + 1; }
    else if (e.t === 'fx' && e.kind === 'ability' && !e.again && e.ab) {
      const aid = ACT_ID.get(e.ab);
      if (aid) ev.used[aid] = (ev.used[aid] || 0) + 1;
      if (e.ab === ACT('eb_encore')) ev.encore++;
      else if (e.ab === ACT('eb_feed')) ev.feed++;
      else if (e.ab === ACT('eb_rewind')) ev.rewind++;
    } else if (e.t === 'glimmer') ev.glimmers++;
    else if (e.t === 'die' && e.u && e.u.side === 'party') ev.ko.add(e.u.idx);
  };
  B.drain(eng.begin(), sink);
  const ai = Object.assign({}, R.BattleAI.AUTO_OPTS || { thrift: true, items: 'auto' }, { items: true });
  while (!eng.result && eng.round < 60) B.drain(eng.playRound(R.BattleAI.partyCommands(eng, ai)), sink);
  if (eng.finish) eng.finish();
  return { win: eng.result === 'win', rounds: eng.round, ko: ev.ko.size, ev, log };
}
function fightModel(tr, o) {
  const tier = troopTier(tr, o.tier);
  const members = o.members === STANDARD || !o.members ? ['hero', 'brigitta:front', 'marta', 'sylvain'] : o.members;
  const party = M.makeParty(Object.assign({}, o, { tier, members }));
  const b = new M.Battle({ tier, Lb: M.troopLevel(tr, o.tier).Lb, party, rankB: 0, ef: 2.5, log: o.log });
  let rankB = tier + 1;
  for (const [ref, n] of DB.troops[tr].mons) { const id = M.resolveRef(ref, tier); if (!id) continue; for (let i = 0; i < n; i++) { const u = b.addMon(id); if ((u.d.flags || []).includes('boss')) rankB = Math.max(rankB, tier + 3 + (u.d.rankAdd || 0)); } }
  b.rankB = rankB; b.boss = true;
  const r = b.run(60);
  return { win: r.win, rounds: r.rounds, ko: r.ko, ev: Object.assign(r.ev, { ko: r.ev.koSet }), log: b.log };
}
const fight = (tr, o) => (USE_REAL ? fightReal(tr, o) : fightModel(tr, o));

function runCase(tr, tier, n, o) {
  o = o || {};
  const acc = { win: 0, rounds: 0, roundsWin: 0, ko: 0, glim: 0, enc: 0, feed: 0, rewind: 0, summon: {}, phaseB: {}, used: {}, any: {} };
  for (let i = 0; i < n; i++) {
    const r = fight(tr, Object.assign({ tier, members: STANDARD, level: levelFor(tr, tier), known: knownFor(tr, tier) }, o));
    acc.win += r.win ? 1 : 0; acc.rounds += r.rounds; if (r.win) acc.roundsWin += r.rounds; acc.ko += r.ko;
    acc.glim += r.ev.glimmers > 0 ? 1 : 0; acc.enc += r.ev.encore; acc.feed += r.ev.feed; acc.rewind += r.ev.rewind;
    for (const k in r.ev.summon) acc.summon[k] = (acc.summon[k] || 0) + r.ev.summon[k];
    for (const k in r.ev.phase) acc.phaseB[k] = (acc.phaseB[k] || 0) + 1;
    for (const k in r.ev.used || {}) { acc.used[k] = (acc.used[k] || 0) + r.ev.used[k]; acc.any[k] = (acc.any[k] || 0) + 1; }
    for (const k in r.ev.summon) acc.any['summon:' + k] = (acc.any['summon:' + k] || 0) + 1;
  }
  const per = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v / n]));
  return { tr, tier, n, win: acc.win / n, rounds: acc.rounds / n, roundsWin: acc.win ? acc.roundsWin / acc.win : 0, ko: acc.ko / n, glim: acc.glim / n,
    encore: acc.enc / n, feed: acc.feed / n, rewind: acc.rewind / n, summon: per(acc.summon), phase: per(acc.phaseB), used: per(acc.used), any: per(acc.any) };
}

// ------------------------------------------------------------------ `s` changes at run time (tuner)
const STAT_KEYS = ['hp', 'atk', 'mag', 'def', 'mdef', 'agi', 'exp', 'gold'];
function setS(id, s) {
  const d = DB.monsters[id];
  d.s = s;
  if (USE_REAL) {
    for (const k of STAT_KEYS) delete d[k];
    delete d._filled;
    R.Mon.fillStats(d, id);
    if (R.Mon.clearCache) R.Mon.clearCache();
  }
}

// --s1: run with the design values (every boss s = 1) instead of the calibrated @@S block
if (arg('s1', false)) for (const id in DB.monsters) if (/^b_/.test(id)) setS(id, {});
// --sx 'b_nemrea2:def=0.6,mdef=0.6;b_nemrea1:hp=1': try other `s` values on top of the current ones (not written)
if (arg('sx', false)) for (const part of String(arg('sx')).split(';').filter(Boolean)) {
  const [id, kv] = part.split(':');
  if (!DB.monsters[id]) { console.error('--sx: unknown monster ' + id); process.exit(2); }
  const s = Object.assign({}, DB.monsters[id].s || {});
  for (const e of (kv || '').split(',').filter(Boolean)) { const [k, v] = e.split('='); s[k] = +v; }
  setS(id, s);
}

// ------------------------------------------------------------------ report helpers
const out = { engine: USE_REAL ? 'real' : 'model', seed: SEED, n: N, checks: [] };
let failed = 0;
const say = (s) => { if (!QUIET) console.log(s); };
function check(id, ok, text, data) { out.checks.push({ id, ok, text, data }); if (!ok) failed++; say((ok ? '  ok   ' : '  FAIL ') + id + ' ' + text); }
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const pc = (x) => Math.round(x * 100) + '%';
say(`sim_bosses: engine=${out.engine} n=${N} seed=${SEED}` + (arg('s1', false) ? '  (design values: s = 1)' : ''));

// ------------------------------------------------------------------ one troop
if (ONE && !arg('tune', false)) {
  const tier = +arg('tier', DB.troops[ONE].tier || 0);
  const gear = arg('gear', undefined);
  if (arg('log', false)) {
    const r = fight(ONE, { tier, members: STANDARD, level: levelFor(ONE, tier), known: knownFor(ONE, tier), log: true, gear });
    console.log((r.log || []).join('\n'));
    console.log(JSON.stringify({ win: r.win, rounds: r.rounds, ko: r.ko, ev: Object.assign({}, r.ev, { ko: undefined }) }));
  }
  console.log(JSON.stringify(runCase(ONE, tier, N, { gear }), null, 1));
  process.exit(0);
}

// ------------------------------------------------------------------ --tune
// Grid search of hp × (atk = mag) multipliers per troop (members of a troop and its summoned adds share
// them) against the X1/X4 targets; --write stores them in src/data/bosses.js (the @@S block).
if (arg('tune', false)) {
  const TARGET = { prologue: 5.5, mid: 6, region: 9.5, fmid: 10.5, rival: 6, last: 9.5 };
  const bossIdsOf = (tr) => {
    const ids = new Set();
    for (const [ref] of DB.troops[tr].mons) if (DB.monsters[ref] && (DB.monsters[ref].flags || []).includes('boss')) ids.add(ref);
    for (const id of [...ids]) for (const a of DB.monsters[id].actions || []) for (const e of (ACT(a.id) && ACT(a.id).effects) || []) if (e.type === 'summon' && DB.monsters[e.mon] && (DB.monsters[e.mon].flags || []).includes('boss')) ids.add(e.mon);
    return [...ids];
  };
  const base = {};
  // start from s = 1 (the design values) unless --keep
  for (const id in DB.monsters) if (/^b_/.test(id)) base[id] = arg('keep', false) ? Object.assign({}, DB.monsters[id].s || {}) : {};
  const cl = (x) => Math.min(2, Math.max(0.5, Math.round(x * 100) / 100));      // §4.14.2: 0.5–2.0
  const apply = (tr, m) => { for (const id of bossIdsOf(tr)) setS(id, Object.assign({}, base[id], { hp: cl((base[id].hp || 1) * m.hp), atk: cl((base[id].atk || 1) * m.atk), mag: cl((base[id].mag || 1) * m.atk) })); };
  const evalCase = (tr, m, tiers, n, o) => {
    apply(tr, m);
    const cs = tiers.map((T) => runCase(tr, T, n, o));
    return { minWin: Math.min(...cs.map((c) => c.win)), win: cs.reduce((s, c) => s + c.win, 0) / cs.length,
      rounds: cs.reduce((s, c) => s + c.rounds, 0) / cs.length, roundsWin: cs.reduce((s, c) => s + c.roundsWin, 0) / cs.length, ko: cs.reduce((s, c) => s + c.ko, 0) / cs.length, cs };
  };
  const coarse = !!arg('coarse', USE_REAL);
  // multipliers on the starting s (§4.14.2: species s stays within 0.5–2.0); --hp-grid / --atk-grid '0.8,1,1.2' override
  const list = (k) => (arg(k, false) ? String(arg(k)).split(',').map(Number) : null);
  const HP = list('hp-grid') || (coarse ? [0.5, 0.7, 0.9, 1.1, 1.35, 1.65, 2.0] : [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.65, 1.8, 2.0]);
  const ATK = list('atk-grid') || (coarse ? [0.5, 0.6, 0.7, 0.85, 1] : [0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1, 1.1]);
  const n1 = +arg('n1', coarse ? 8 : 20), n2 = +arg('n2', coarse ? 24 : 60);
  const troops = ONE ? String(ONE).split(',') : ['tr_b_pageeater', ...MID, ...REGION, 'tr_b_rowell1', 'tr_b_rowell2', ...FMID, 'tr_b_nemrea1', 'tr_b_nemrea2', 'tr_b_valzard_echo', 'tr_b_ouroboros'];
  const result = {};
  for (const tr of troops) {
    const k = kindOf(tr);
    const tiers = DB.troops[tr].scale === 'tier' ? (coarse ? [0, 2, 4, 7] : [0, 1, 2, 4, 6, 7]) : [DB.troops[tr].tier];
    let fine;
    if (k === 'post') {
      const tgt = tr === 'tr_b_ouroboros' ? { win: [0.55, 0.85], plain: 0.2, rounds: 21 } : { win: [0.7, 0.92], plain: 0.45, rounds: 14 };
      const ev = (m, n) => ({ s: evalCase(tr, m, tiers, n, { gear: 'strong', level: 64 }), p: evalCase(tr, m, tiers, Math.max(6, n >> 1), { gear: 'shop', level: 64 }) });
      const feas = (r) => r.s.win >= tgt.win[0] && r.s.win <= tgt.win[1] && r.p.win <= tgt.plain;
      const score = (r, m) => (feas(r) ? 0 : 10 + Math.abs(r.s.win - (tgt.win[0] + tgt.win[1]) / 2) * 10 + Math.max(0, r.p.win - tgt.plain) * 10) + Math.abs(r.s.rounds - tgt.rounds) / tgt.rounds + 0.3 * Math.abs(m.atk - 1);
      const cand = [];
      for (const hp of HP) for (const atk of ATK) { const m = { hp, atk }; const r = ev(m, n1); cand.push({ m, r, sc: score(r, m) }); }
      cand.sort((a, b) => a.sc - b.sc);
      fine = cand.slice(0, 4).map((c) => { const r = ev(c.m, n2); return { m: c.m, r, sc: score(r, c.m) }; }).sort((a, b) => a.sc - b.sc);
      say(`${tr.padEnd(18)} hp×${fine[0].m.hp} atk×${fine[0].m.atk}  strong ${pc(fine[0].r.s.win)}/${f1(fine[0].r.s.rounds)}r  normal ${pc(fine[0].r.p.win)}`);
    } else {
      const target = TARGET[k] || 8;
      const minWin = k === 'last' ? 0.9 : 0.88;
      const feas = (r) => r.minWin >= minWin && r.ko <= 0.9;
      const score = (r, m) => (feas(r) ? 0 : 10 + (minWin - r.minWin) * 20 + Math.max(0, r.ko - 0.9) * 5) + Math.abs(r.rounds - target) / target + 0.3 * Math.abs(m.atk - 1);
      const cand = [];
      for (const hp of HP) for (const atk of ATK) { const m = { hp, atk }; const r = evalCase(tr, m, tiers, n1); cand.push({ m, r, sc: score(r, m) }); }
      cand.sort((a, b) => a.sc - b.sc);
      fine = cand.slice(0, 4).map((c) => { const r = evalCase(tr, c.m, tiers, n2); return { m: c.m, r, sc: score(r, c.m) }; }).sort((a, b) => a.sc - b.sc);
      const b = fine[0];
      say(`${tr.padEnd(18)} hp×${b.m.hp} atk×${b.m.atk}  win(min) ${pc(b.r.minWin)}  rounds ${f1(b.r.rounds)} (target ${target})  KO ${f1(b.r.ko)}  ` + b.r.cs.map((c) => 'T' + c.tier + ' ' + pc(c.win) + '/' + f1(c.rounds)).join(' '));
    }
    result[tr] = fine[0];
    apply(tr, fine[0].m);
  }
  if (arg('write', false)) {
    const file = path.join(__dirname, '..', 'src', 'data', 'bosses.js');
    let src = fs.readFileSync(file, 'utf8');
    const old = /\/\/ @@S-BEGIN\n  const S = \{\n([\s\S]*?)  \};\n  \/\/ @@S-END/.exec(src);
    const cur = {};
    if (old) for (const line of old[1].split('\n')) { const mm = /^\s+(b_\w+): (\{.*\}),/.exec(line); if (mm) cur[mm[1]] = mm[2]; }
    for (const tr in result) {
      const m = result[tr].m;
      for (const id of bossIdsOf(tr)) {
        const s = Object.assign({}, base[id]);            // --keep: other keys (def, mdef, agi) stay as they were
        s.hp = cl((base[id].hp || 1) * m.hp);
        s.atk = cl((base[id].atk || 1) * m.atk); s.mag = cl((base[id].mag || 1) * m.atk);
        for (const k of Object.keys(s)) if (s[k] === 1) delete s[k];
        if (Object.keys(s).length) cur[id] = '{ ' + Object.entries(s).map(([k2, v]) => k2 + ': ' + v).join(', ') + ' }'; else delete cur[id];
      }
    }
    const order = Object.keys(DB.monsters).filter((id) => /^b_/.test(id));
    const body = order.filter((id) => cur[id]).map((id) => `    ${id}: ${cur[id]},`).join('\n');
    src = src.replace(/\/\/ @@S-BEGIN\n  const S = \{\n[\s\S]*?  \};\n  \/\/ @@S-END/, `// @@S-BEGIN\n  const S = {\n${body}${body ? '\n' : ''}  };\n  // @@S-END`);
    fs.writeFileSync(file, src);
    say('wrote ' + path.relative(process.cwd(), file) + ` (engine ${out.engine})`);
  }
  process.exit(0);
}

// ------------------------------------------------------------------ X1 (§4.17.3-B1, C1)
if (XS.includes(1)) {
  s0 = (SEED + 1 * 7919) >>> 0;   // each check has its own random stream (same numbers whichever checks run)
  say('\nX1  mid / region bosses, standard party (auto), T0–T7; prologue, rivals and finale mid bosses at their fixed tier');
  say('  cells: win% / rounds');
  const rows = [];
  for (const tr of ['tr_b_pageeater', ...MID, ...REGION, 'tr_b_rowell1', 'tr_b_rowell2', ...FMID]) {
    const k = kindOf(tr);
    const tiers = DB.troops[tr].scale === 'tier' ? [0, 1, 2, 3, 4, 5, 6, 7] : [DB.troops[tr].tier || 0];
    const cells = tiers.map((T) => runCase(tr, T, N));
    rows.push({ tr, kind: k, cells });
    const avgR = cells.reduce((s, c) => s + c.rounds, 0) / cells.length;
    const minW = Math.min(...cells.map((c) => c.win));
    const avgKo = cells.reduce((s, c) => s + c.ko, 0) / cells.length;
    const txt = cells.map((c) => (pc(c.win) + '/' + f1(c.rounds)).padStart(10)).join('');
    say('  ' + tr.padEnd(19) + k.padEnd(9) + (tiers.length === 1 ? ('T' + tiers[0]).padEnd(4) + txt : txt) + '  | avg ' + f1(avgR) + ' r, min win ' + pc(minW) + ', KO ' + f1(avgKo));
  }
  out.X1 = rows;
  for (const row of rows) {
    if (row.kind === 'rival') continue;              // canLose fights (story): reported only
    const [lo, hi] = ROUNDS[row.kind];
    const avgR = row.cells.reduce((s, c) => s + c.rounds, 0) / row.cells.length;
    const minW = Math.min(...row.cells.map((c) => c.win));
    const avgKo = row.cells.reduce((s, c) => s + c.ko, 0) / row.cells.length;
    check('X1 ' + row.tr, minW >= 0.85 && avgR >= lo - 0.5 && avgR <= hi + 0.5 && avgKo <= 1.0,
      `win ≥85% at every tier: ${pc(minW)}; rounds ${lo}–${hi}: ${f1(avgR)}; KO ≤1.0: ${f1(avgKo)}`);
  }
  // §4.17.3-B4 (order independence) for the tier-scaled bosses: each tier's rounds within ±15% of that boss's
  // mean over T0–T7. The per-boss `s` cannot change this trend (it is tier-independent); it follows the hpBoss
  // slope (K.hpBoss, rules) against the party model's growth, so the check reports it for the lead.
  const spread = [];
  for (const row of rows) {
    if (row.cells.length < 2) continue;
    const m = row.cells.reduce((s, c) => s + c.rounds, 0) / row.cells.length;
    const dev = row.cells.map((c) => (c.rounds - m) / m);
    const worst = dev.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
    spread.push({ tr: row.tr, mean: m, worst, first: row.cells[0].rounds, last: row.cells[row.cells.length - 1].rounds });
  }
  if (spread.length) {
    const bad = spread.filter((x) => Math.abs(x.worst) > 0.15);
    const mk = (k) => { const l = spread.filter((x) => kindOf(x.tr) === k); return l.length ? `${k} T0 ${f1(l.reduce((s, x) => s + x.first, 0) / l.length)} → T7 ${f1(l.reduce((s, x) => s + x.last, 0) / l.length)} rounds` : ''; };
    say('  rounds by tier: ' + [mk('mid'), mk('region')].filter(Boolean).join(', '));
    out.X1spread = spread;
    check('X1 tier spread (B4)', !bad.length, `rounds of every tier within ±15% of the boss's T0–T7 mean: ${bad.length ? bad.length + ' outside, worst ' + bad.sort((a, b) => Math.abs(b.worst) - Math.abs(a.worst)).slice(0, 4).map((x) => x.tr + ' ' + (x.worst > 0 ? '+' : '') + Math.round(x.worst * 100) + '%').join(' ') : 'all inside'}`);
  }
}

// ------------------------------------------------------------------ X2 (§4.17.3-B2/B3)
if (XS.includes(2)) {
  s0 = (SEED + 2 * 7919) >>> 0;   // each check has its own random stream (same numbers whichever checks run)
  say('\nX2  any three companions: 6 hero variants × companion trios, every mid/region boss');
  const HEROES = (PM && PM.HERO_VARIANTS) || [
    { heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' } }, { heroType: 'warrior', favor: { kind: 'weapon', id: 'axe' } },
    { heroType: 'ranger', favor: { kind: 'weapon', id: 'bow' } }, { heroType: 'mage', favor: { kind: 'element', id: 'fire' } },
    { heroType: 'spellblade', favor: { kind: 'element', id: 'wind' } }, { heroType: 'wanderer', favor: { kind: 'weapon', id: 'spear' } },
  ];
  const ids = Object.keys(DB.companions);
  const role = (id) => DB.companions[id].role;
  const trios = [];
  if (PM && PM.COMBOS) for (const c of PM.COMBOS) trios.push(c.members);
  const pickTrio = (filter) => { for (let k = 0; k < 500; k++) { const t = []; while (t.length < 3) { const c = ids[Math.floor(rng() * ids.length)]; if (!t.includes(c)) t.push(c); } if (!filter || filter(t)) return t; } return null; };
  const forced = [
    (t) => t.every((c) => role(c) !== 'healer' && !['basil', 'noela', 'marta', 'selma', 'bartolo'].includes(c)),   // 回復役なし
    (t) => t.every((c) => role(c) === 'caster' || role(c) === 'healer'),                                             // 全員術師
    (t) => t.every((c) => ['guard', 'striker'].includes(role(c))),                                                   // 全員戦士
  ];
  const nTrio = +arg('trios', 34);
  for (const f of forced) { const t = pickTrio(f); if (t) trios.push(t); }
  while (trios.length < nTrio) trios.push(pickTrio());
  const bosses = [...MID, ...REGION];
  const per = +arg('per', USE_REAL ? 1 : 3);
  const play = (h, t, k) => {
    let w = 0, n = 0, rounds = 0;
    for (const tr of bosses) for (let i = 0; i < k; i++) {
      const T = Math.floor(rng() * 8);
      const r = fight(tr, Object.assign({ tier: T, members: ['hero', ...t], level: levelFor(tr, T), known: knownFor(tr, T) }, h));
      w += r.win ? 1 : 0; n++; rounds += r.rounds;
    }
    return { win: w / n, rounds: rounds / n };
  };
  const combos = [];
  for (const h of HEROES) for (const t of trios) combos.push(Object.assign({ h, hero: h.heroType + ':' + h.favor.id, trio: t }, play(h, t, per)));
  const k10 = Math.max(1, Math.floor(combos.length / 10));
  // Stage 2: with one battle per boss a combo's win rate moves in steps of 1/16 and its binomial noise
  // (±7 pt) alone puts the worst of 200 combos near 70 %. The combos that screen as the lowest and highest
  // 10 % (wins and rounds) are played again with fresh battles and judged on those (no selection bias).
  const per2 = +arg('per2', USE_REAL ? 3 : 0);
  if (per2 > 0) {
    const byWin = combos.slice().sort((a, b) => a.win - b.win), byR = combos.slice().sort((a, b) => a.rounds - b.rounds);
    const again = new Set([...byWin.slice(0, k10), ...byWin.slice(-k10), ...byR.slice(0, k10), ...byR.slice(-k10)]);
    for (const c of again) { c.screen = c.win; Object.assign(c, play(c.h, c.trio, per2)); }
  }
  combos.sort((a, b) => a.win - b.win);
  const wins = combos.map((c) => c.win);
  const med = wins[Math.floor(wins.length / 2)];
  const lowAvg = wins.slice(0, k10).reduce((s, x) => s + x, 0) / k10, topAvg = wins.slice(-k10).reduce((s, x) => s + x, 0) / k10;
  const rs = combos.map((c) => c.rounds).sort((a, b) => a - b);
  const rLow = rs.slice(0, k10).reduce((s, x) => s + x, 0) / k10, rTop = rs.slice(-k10).reduce((s, x) => s + x, 0) / k10;
  say(`  combos ${combos.length} (${HEROES.length} heroes × ${trios.length} trios), ${bosses.length} bosses × ${per} battle(s) at random T0–T7` + (per2 > 0 ? `; the lowest/highest 10 % replayed with ${per2} fresh battle(s) per boss` : ''));
  say('  worst: ' + combos.slice(0, 6).map((c) => `${c.hero}+${c.trio.join('/')} ${pc(c.win)}`).join(', '));
  say('  best : ' + combos.slice(-3).map((c) => `${c.hero}+${c.trio.join('/')} ${pc(c.win)}`).join(', '));
  out.X2 = { combos: combos.length, min: wins[0], median: med, top10: topAvg, low10: lowAvg, roundsRatio: rTop / rLow, worst: combos.slice(0, 12).map(({ h, ...c }) => c) };
  check('X2 min', wins[0] >= 0.70, `every combo ≥70%: min ${pc(wins[0])}`);
  check('X2 median', med >= 0.88, `median ≥88%: ${pc(med)}`);
  check('X2 spread (B3)', topAvg - lowAvg <= 0.20 && rTop / rLow <= 1.6, `top10%−low10% ≤20pt: ${Math.round((topAvg - lowAvg) * 100)}pt; rounds high/low ≤1.6: ${(rTop / rLow).toFixed(2)}`);
  if (combos.length < 200) check('X2 size', false, `needs ≥200 combos (got ${combos.length})`);
}

// ------------------------------------------------------------------ X3 gimmicks
if (XS.includes(3)) {
  s0 = (SEED + 3 * 7919) >>> 0;   // each check has its own random stream (same numbers whichever checks run)
  say('\nX3  gimmicks fire at least once per battle (average over T0/T2/T4/T6/T7; fixed-tier bosses at their tier)');
  // [troop, key, uses per battle, share of battles with at least one, label]
  const G = [
    ['tr_b_dolls', 'encore', (r) => r.encore, (r) => r.any.eb_encore || 0, '楽団のアンコール'],
    ['tr_b_rooteater', 'feed', (r) => r.feed, (r) => r.any.eb_feed || 0, '根の触手の養分'],
    ['tr_b_mistbeast', 'double', (r) => r.summon.b_mist_double || 0, (r) => r.any['summon:b_mist_double'] || 0, '霧の分身'],
    ['tr_b_octopus', 'regrow', (r) => r.summon.b_tentacle || 0, (r) => r.any['summon:b_tentacle'] || 0, '足の生え直し'],
    ['tr_b_ironwarden', 'phase75', null, (r) => r.phase['b_ironwarden#0'] || 0, '鉄の番人 HP75%'],
    ['tr_b_ironwarden', 'phase30', null, (r) => r.phase['b_ironwarden#1'] || 0, '鉄の番人 HP30%'],
    ['tr_b_lavabeast', 'phase', null, (r) => r.phase['b_lavabeast#0'] || 0, '溶岩の巨獣 冷える'],
    ['tr_b_ouroboros', 'rewind', (r) => r.rewind, (r) => r.any.eb_rewind || 0, '円環竜の巻き戻し'],
  ];
  out.X3 = [];
  const cache = {};
  // "1戦に1回以上": at least one per battle on average, and in (nearly) every battle — a gimmick the party can
  // cut short on purpose (kill the conductor first, clear the roots) is allowed to miss a few fights (≥ 80 %)
  for (const [tr, key, get, share, label] of G) {
    const tiers = DB.troops[tr].scale === 'tier' ? [0, 2, 4, 6, 7] : [DB.troops[tr].tier];
    const cs = tiers.map((T) => cache[tr + T] || (cache[tr + T] = runCase(tr, T, Math.max(20, Math.round(N / 2)), tr === 'tr_b_ouroboros' ? { gear: 'strong', level: 64 } : {})));
    const sh = cs.reduce((s, c) => s + share(c), 0) / cs.length;
    // a phase happens at most once (a battle lost before the line, or one blow from above the line to 0, has none)
    const v = get ? cs.reduce((s, c) => s + get(c), 0) / cs.length : null;
    out.X3.push({ tr, key, label, perBattle: v == null ? sh : v, share: sh });
    check('X3 ' + key, (v == null || v >= 1) && sh >= 0.8, `${label}: ` + (v == null ? '' : `${v.toFixed(2)} per battle (≥1), `) + `in ${pc(sh)} of battles (≥80%)`);
  }
  // for information: how often each "n手ごと" move of §9.11.4 is used (the SCHEDULED ones of bosses.js carry
  // weight ×100 on their turn; the others keep the table weight and compete with the rest by weight, §9.1.7)
  const everyMoves = [];
  for (const tr of [...MID, ...REGION, ...FMID, 'tr_b_pageeater', 'tr_b_nemrea1', 'tr_b_nemrea2', 'tr_b_valzard_echo']) {
    const ids = new Set();
    for (const [ref] of DB.troops[tr].mons) if (DB.monsters[ref]) for (const a of DB.monsters[ref].actions || []) if (a.cond && a.cond.every) ids.add(a.id);
    if (!ids.size) continue;
    const T = DB.troops[tr].scale === 'tier' ? 4 : DB.troops[tr].tier;
    const c = cache[tr + T] || (cache[tr + T] = runCase(tr, T, Math.max(20, Math.round(N / 2)), /valzard/.test(tr) ? { gear: 'strong', level: 64 } : {}));
    for (const id of ids) everyMoves.push(`${id} ${(c.used[id] || 0).toFixed(1)}/${pc(c.any[id] || 0)}`);
  }
  say('  info "n手ごと" moves (uses per battle / share of battles, T4 or the fixed tier): ' + everyMoves.join(', '));
  // for information: the other summons and phases (not X3 criteria)
  const INFO = [['tr_b_rooteater', 'b_root'], ['tr_b_sandking', null], ['tr_b_captain', null], ['tr_b_bookgolem', 'book_1'], ['tr_b_lazaro', 'scribe_1']];
  for (const [tr, id] of INFO) {
    const T = DB.troops[tr].scale === 'tier' ? 4 : DB.troops[tr].tier;
    const c = cache[tr + T] || (cache[tr + T] = runCase(tr, T, Math.max(20, Math.round(N / 2))));
    const sum = id ? (c.summon[id] || 0) : Object.values(c.summon).reduce((s, x) => s + x, 0);
    say(`  info ${tr} T${T}: summons ${sum.toFixed(2)}/battle` + (Object.keys(c.phase).length ? ', phases ' + Object.entries(c.phase).map(([k, v]) => k + ' ' + pc(v)).join(' ') : ''));
  }
}

// ------------------------------------------------------------------ X4 last boss and postgame (§4.17.3-C2/C3)
if (XS.includes(4)) {
  s0 = (SEED + 4 * 7919) >>> 0;   // each check has its own random stream (same numbers whichever checks run)
  say('\nX4  last boss (2 forms in a row, full heal between), postgame bosses');
  let w = 0, rounds = 0;
  const n = Math.max(30, N);
  for (let i = 0; i < n; i++) {
    const a = fight('tr_b_nemrea1', { tier: 8, members: STANDARD, level: 58, known: EXPECT[8] });
    if (!a.win) { rounds += a.rounds; continue; }
    const b = fight('tr_b_nemrea2', { tier: 8, members: STANDARD, level: 58, known: EXPECT[8] });
    rounds += a.rounds + b.rounds;
    if (b.win) w++;
  }
  out.X4 = { last: { win: w / n, rounds: rounds / n } };
  check('X4 last boss', w / n >= 0.75 && rounds / n >= 15.5 && rounds / n <= 22.5, `standard party win ≥75%: ${pc(w / n)}; rounds 16–22: ${f1(rounds / n)}`);
  for (const tr of ['tr_b_valzard_echo', 'tr_b_ouroboros']) {
    // 80 battles each: at 40 the win rate still moves by ±8 points between seeds (50 % vs 28 % seen)
    const strong = runCase(tr, 9, Math.max(80, N), { gear: 'strong', level: 64 });
    const plain = runCase(tr, 9, Math.max(80, N), { gear: 'shop', level: 64 });
    out.X4[tr] = { strong, plain };
    if (tr === 'tr_b_ouroboros') {
      check('X4 ouroboros', strong.win >= 0.5 && plain.win <= 0.2, `strong gear (Lv64, real + 4 super slots) ≥50%: ${pc(strong.win)}; normal set ≤20%: ${pc(plain.win)}`);
      check('X4 ouroboros rounds', strong.roundsWin >= 17.5 && strong.roundsWin <= 25.5, `rounds 18–25 when won: ${f1(strong.roundsWin)}`);
    } else say(`  ${tr}: strong ${pc(strong.win)} / ${f1(strong.rounds)} r, normal set ${pc(plain.win)} / ${f1(plain.rounds)} r`);
  }
}

// ------------------------------------------------------------------ X5 glimmer in boss fights (§4.9.5)
if (XS.includes(5)) {
  s0 = (SEED + 5 * 7919) >>> 0;   // each check has its own random stream (same numbers whichever checks run)
  say('\nX5  someone glimmers in a boss battle (T1+) ≥50%');
  const cells = [];
  for (const tr of [...MID, ...REGION]) for (const T of [1, 3, 5, 7]) cells.push(runCase(tr, T, Math.max(10, Math.round(N / 3))));
  for (const tr of FMID) cells.push(runCase(tr, 8, Math.max(10, Math.round(N / 3))));
  const avg = cells.reduce((s, c) => s + c.glim, 0) / cells.length;
  const byT = {};
  for (const c of cells) (byT[c.tier] = byT[c.tier] || []).push(c.glim);
  say('  by tier: ' + Object.entries(byT).map(([t, l]) => 'T' + t + ' ' + pc(l.reduce((s, x) => s + x, 0) / l.length)).join('  '));
  out.X5 = { avg, byT };
  check('X5 glimmer', avg >= 0.5, `P(someone glimmers) per boss battle: ${pc(avg)}`);
  // "T1 以降" read per tier as well: every tier's boss battles on their own
  const lowT = Object.entries(byT).map(([t, l]) => [t, l.reduce((s, x) => s + x, 0) / l.length]).filter(([, v]) => v < 0.5);
  check('X5 glimmer per tier', !lowT.length, `every tier ≥50%: ${lowT.length ? lowT.map(([t, v]) => 'T' + t + ' ' + pc(v)).join(' ') + ' below' : 'all'}`);
}

if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
say(`\n${failed ? 'FAILED ' + failed : 'all passed'} (${out.checks.length} checks, engine=${out.engine})`);
process.exit(failed ? 1 : 0);
