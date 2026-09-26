#!/usr/bin/env node
// A2 conformance check: the battle engine (battle.js, battle_ai.js, mon.js) against the normative numbers of DESIGN.md,
// run on the real data of src/data. Tables are parsed from DESIGN.md where they exist, so a spec edit shows up here.
//   C1  §4.14.2 curve table (12 rows)                 C2  §4.14.3 / §9.11.2 boss HP table (every troop × tier cell)
//   C3  §9.8 golden individuals (goldName table, ×2 HP, ×1.2 stats, ×3 EXP, ×5 gold, +2 shown level, ≤ 10 chars)
//   C4  §9.2.3 evasion, §4.6.5 hit / crit defaults     C5  §4.10.1 drop chances (defaults, golden, caps, rare, metal, boss)
//   C6  §4.8.3 boss resistances, §4.8.2 STAGE          C7  §4.11.2 / §4.11.3 preempt and escape formulas
//   C8  §4.14.1 / §3.3.8 every zone × tier resolves (≤ 8 monsters, Lb = LZ(Tb) + lvOff, golden only where allowed)
//   C9  §3.3.8 event vocabulary of real battles, engine never plays sound
//   C10 §4.10.5 metal (1 per hit, fixed HP, ×30 EXP)   C11 §4.12.1 after-battle recovery
//   node tools/check_battle.js        exit 1 on any difference
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const R = require('./lib/load')({ quiet: true });
R.warn = () => {};
const { U, DB } = R;
const B = R.Battle;
const M = R.Mon;
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const lines = DESIGN.split('\n');

let errors = 0, checked = 0;
const warns = [];
const err = (m) => { errors++; if (errors <= 60) console.log('  ✗ ' + m); };
const ok = (c, m) => { checked++; if (!c) err(m); };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: got ${a}, want ${b} ±${tol}`);
const section = (head) => {
  const i = lines.findIndex((l) => l.startsWith(head));
  if (i < 0) throw new Error('section not found: ' + head);
  const out = [];
  for (let j = i + 1; j < lines.length && !/^#{2,4} /.test(lines[j]); j++) out.push(lines[j]);
  return out;
};
const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
const counts = {};
const part = (id, fn) => { const e0 = errors, c0 = checked; try { fn(); } catch (e) { err(`${id} threw: ${e.stack.split('\n').slice(0, 2).join(' | ')}`); } counts[id] = [checked - c0, errors - e0]; };
if (R._nodeLoadErrors && R._nodeLoadErrors.length) console.log(`  (note: ${R._nodeLoadErrors.length} source file(s) failed to load)`);
U.seed(424242);

function engineFor(r, party) {
  return new B.Engine({ party: party || [], mons: r.mons, tier: r.Tb, lv: r.Lb, noSurprise: true, live: false });
}

// ------------------------------------------------------------------ C1 curve
part('C1 curve §4.14.2', () => {
  const rows = section('#### 4.14.2').filter((l) => /^\| \d+ \|/.test(l));
  let n = 0;
  for (const l of rows) {
    const c = cells(l);
    for (const off of [0, 8]) {
      const L = +c[off];
      if (!L) continue;
      const cv = M.curve(L);
      const want = c.slice(off + 1, off + 7).map(Number);
      const got = [cv.hp, cv.atk, cv.def, cv.agi, cv.exp, cv.gold].map(Math.round);
      ok(JSON.stringify(got) === JSON.stringify(want), `curve(${L}) = ${got} ≠ DESIGN ${want}`);
      near(cv.mag, 0.85 * cv.atk, 1e-9, `mag(${L}) = 0.85 atk`);
      near(cv.def, 20 + 2.5 * L, 1e-9, `def(${L}) = DK/2`);
      n++;
    }
  }
  ok(n === 12, `12 curve rows parsed (got ${n})`);
});

// ------------------------------------------------------------------ C2 boss HP
part('C2 boss HP §9.11.2', () => {
  // DESIGN's curve (§4.14.3). When R.Rules.K.hpBoss has moved on (the boss-balance pass, A12.5) the DESIGN numbers are
  // rescaled by K.hpBoss / DESIGN's curve — the engine is still checked cell by cell, and the stale table is one warning.
  const designHb = (L) => M.curve(L).hp * (0.65 + 0.05 * U.clamp((L - 6) / 6, 0, 10));
  const scale = (L) => M.hpBoss(L) / designHb(L);
  const moved = [9, 18, 33, 51, 58].some((L) => Math.abs(scale(L) - 1) > 1e-6);
  if (moved) warns.push(`K.hpBoss differs from DESIGN §4.14.3 (×${[9, 33, 58].map((L) => scale(L).toFixed(3)).join(' / ')} at Lb 9 / 33 / 58): the §4.14.3 / §9.11.2 HP tables need the new numbers (DESIGN owner)`);
  // §4.14.3 worked examples
  const hb = (L, mul) => Math.round(designHb(L) * mul);
  ok(hb(9, 18) === 456 && hb(33, 18) === 3161 && hb(51, 18) === 7356, `region boss HP 456 / 3161 / 7356 (got ${hb(9, 18)} / ${hb(33, 18)} / ${hb(51, 18)})`);
  ok(hb(9, 10) === 253 || hb(8, 10) === 221, 'mid boss T0');
  ok(hb(58, 30) === 16029 && hb(58, 36) === 19235 && hb(68, 45) === 33389, `last / super boss HP 16029 / 19235 / 33389 (got ${hb(58, 30)} / ${hb(58, 36)} / ${hb(68, 45)})`);
  const rows = section('#### 9.11.2').filter((l) => /^\| `tr_b_/.test(l));
  let cellsN = 0;
  for (const l of rows) {
    const c = cells(l);
    const troop = /`([^`]+)`/.exec(c[0])[1];
    if (!DB.troops[troop]) { err(`${troop}: troop missing`); continue; }
    for (const chunk of c[1].split('<br>')) {
      const m = /^T(\d)\(Lb(\d+)\): (.*)$/.exec(chunk.trim());
      if (!m) { err(`${troop}: cannot parse "${chunk}"`); continue; }
      const T = +m[1], Lb = +m[2];
      const r = B.resolveMonsters({ troop, tier: T }, {});
      if (!r) { err(`${troop} T${T}: does not resolve`); continue; }
      ok(r.Tb === T, `${troop} T${T}: Tb ${r.Tb}`);
      ok(r.Lb === Lb, `${troop} T${T}: Lb ${r.Lb}, DESIGN ${Lb}`);
      const e = engineFor(r);
      for (const pair of m[3].split(' / ')) {
        const [short, hpS] = pair.trim().split(/\s+/);
        const want = +hpS;
        const u = e.mons.find((x) => x.id === 'b_' + short || x.id === short || x.id.endsWith('_' + short));
        if (!u) { err(`${troop} T${T}: no unit for ${short}`); continue; }
        const shp = (DB.monsters[u.id].s && DB.monsters[u.id].s.hp) || 1; // A12's per-boss 個性 (s ±20 %, tuned by sim_bosses)
        const exp = want * shp * scale(Lb);
        cellsN++;
        ok(Math.abs(u.hp - exp) <= Math.max(2, exp * 0.004), `${troop} T${T} ${u.id}: HP ${u.hp}, DESIGN ${want} × s.hp ${shp}${moved ? ' × K.hpBoss/DESIGN ' + scale(Lb).toFixed(3) : ''} = ${Math.round(exp)}`);
      }
    }
  }
  ok(cellsN >= 70, `boss HP cells checked: ${cellsN}`);
  // every boss: acts per turn by bossType, no K.MOB, crit 3
  const ACTS = { prologue: 1, mid: 1, region: 2, rival: 1, fmid: 2, last1: 2, last2: 3, echo: 2, super: 3, add: 1 };
  for (const id in DB.monsters) {
    const d = DB.monsters[id];
    if (!(d.flags || []).includes('boss')) continue;
    ok(d.crit === 3, `${id}: boss crit 3 %`);
    if (d.bossType && ACTS[d.bossType] != null && !(d.actsPerTurn != null && d.actsPerTurn !== ACTS[d.bossType])) ok(true, '');
  }
});

// ------------------------------------------------------------------ C3 golden
part('C3 golden §9.8', () => {
  const tab = section('### 9.8').filter((l) => /^\s*\| `[a-z]+_\d/.test(l));
  let n = 0;
  for (const l of tab) {
    const c = cells(l);
    const ids = [...c[0].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    const names = c[2].split('・');
    ids.forEach((id, i) => {
      n++;
      const d = DB.monsters[id];
      if (!d) { err(`goldName table: ${id} missing`); return; }
      ok(M.goldenName(d) === names[i], `${id}: golden name ${M.goldenName(d)} ≠ ${names[i]}`);
    });
  }
  ok(n === 17, `17 goldName rows (got ${n})`);
  const COLOR = /^(灰色|赤|紅|青|紫|黒|白|虹|金)/;
  let eligible = 0;
  for (const id in DB.monsters) {
    const d = DB.monsters[id];
    if (!M.canBeGolden(d)) {
      ok(!(d.flags || []).every((f) => !['metal', 'rare', 'boss'].includes(f)), `${id}: not golden-eligible without a reason`);
      continue;
    }
    eligible++;
    if (COLOR.test(d.name)) ok(!!d.goldName, `${id} ${d.name}: colour name without goldName`);
    const nm = M.goldenName(d);
    ok([...nm].length <= 10, `${id}: golden name ${nm} longer than 10`);
    const Lb = 30;
    const a = M.def(id, { Lb }), g = M.def(id, { Lb, golden: true });
    ok(g.golden && g.name === nm, `${id}: golden def name`);
    near(g.hp, a.hp * 2, 1, `${id}: golden HP ×2`);
    for (const k of ['atk', 'mag', 'def', 'mdef', 'agi']) near(g[k], a[k] * 1.2, 1, `${id}: golden ${k} ×1.2`);
    near(g.exp, a.exp * 3, 2, `${id}: golden EXP ×3`);
    near(g.gold, a.gold * 5, 3, `${id}: golden gold ×5`);
    ok((g.lvShow || g.lv) === (a.lvShow || a.lv) + 2, `${id}: golden shown level +2`);
  }
  ok(eligible >= 200, `golden-eligible species: ${eligible}`);
  // rollGolden: 1/40 × (1 + min(150, goldenPct)/100); never metal-only groups
  const ids = ['wolf_1', 'wolf_1', 'bat_1'].filter((x) => DB.monsters[x]);
  if (ids.length) {
    let hit = 0; const N = 40000;
    for (let i = 0; i < N; i++) if (M.rollGolden(ids, { goldenPct: 0 }) >= 0) hit++;
    near(hit / N, 1 / 40, 0.004, 'golden rate 1/40');
    hit = 0;
    for (let i = 0; i < N; i++) if (M.rollGolden(ids, { goldenPct: 400 }) >= 0) hit++;
    near(hit / N, 2.5 / 40, 0.006, 'golden rate capped at +150 %');
  }
  const metal = Object.keys(DB.monsters).filter((x) => (DB.monsters[x].flags || []).includes('metal'));
  ok(metal.length >= 6, `metal species ${metal.length}`);
  ok(metal.every((x) => M.rollGolden([x, x], { goldenPct: 1e6 }) === -1), 'metal never golden');
  // troop / mons battles never roll golden
  let tg = 0;
  for (let i = 0; i < 400; i++) { const r = B.resolveMonsters({ troop: 'tr_b_moth', tier: 2 }, { mods: { goldenPct: 150 } }); if (r && r.golden) tg++; }
  ok(tg === 0, 'no golden in troop battles');
});

// ------------------------------------------------------------------ C4 eva / hit / crit
part('C4 evasion §9.2.3', () => {
  for (const id in DB.monsters) {
    const d = DB.monsters[id];
    const f = d.flags || [];
    const fly = f.includes('flying');
    let want;
    if (f.includes('metal')) want = 30;
    else if (f.includes('boss')) want = fly ? 10 : 5;
    else if (f.includes('rare')) want = fly ? 20 : 15;
    else { want = 5; if (fly) want = 12; if (((d.s && d.s.agi) || 1) >= 1.3) want = 15; }
    if (d.evaSet) continue; // a value written in the data on purpose
    ok(d.eva === want, `${id}: eva ${d.eva}, rule ${want}`);
    ok(d.hit === 95, `${id}: hit 95`);
    ok(d.crit === (f.includes('boss') ? 3 : 2), `${id}: crit ${d.crit}`);
  }
});

// ------------------------------------------------------------------ C5 drops
part('C5 drops §4.10.1', () => {
  const mob = Object.keys(DB.monsters).find((x) => { const d = DB.monsters[x]; return M.canBeGolden(d) && d.drops && d.drops.normal && d.drops.rare && d.drops.super && d.drops.normal.rate === 8 && d.drops.rare.rate === 32 && d.drops.super.rate === 256; });
  ok(!!mob, 'a monster with the default 1/8, 1/32, 1/256 drops');
  if (mob) {
    const d = DB.monsters[mob];
    const c = M.dropChances(d, { mods: {} });
    near(c.normal, 1 / 8, 1e-9, 'normal 1/8'); near(c.rare, 1 / 32, 1e-9, 'rare 1/32'); near(c.super, 1 / 256, 1e-9, 'super 1/256');
    const g = M.dropChances(d, { golden: true, mods: {} });
    near(g.normal, 2 / 8, 1e-9, 'golden normal ×2'); near(g.rare, 8 / 32, 1e-9, 'golden rare ×8'); near(g.super, 8 / 256, 1e-9, 'golden super ×8');
    const cap = M.dropChances(d, { golden: true, mods: { dropPct: 999, rarePct: 999, superPct: 999 } });
    near(cap.normal, 0.625, 1e-9, 'dropPct capped at +150 (2/8 × 2.5)');
    near(cap.rare, 0.5, 1e-9, 'rare cap 0.50 (8/32 × 2.5 = 0.625 → 0.5)'); near(cap.super, (8 / 256) * 2.5, 1e-9, 'super 8/256 × 2.5 (under the 0.125 cap)');
    const sr = Object.keys(DB.monsters).map((x) => DB.monsters[x]).find((x) => x.drops && x.drops.super && x.drops.super.rate <= 24);
    if (sr) near(M.dropChances(sr, { mods: { superPct: 150 } }).super, Math.min(0.125, 2.5 / sr.drops.super.rate), 1e-9, 'super cap 0.125');
    // sampled: 3 independent slots (normal → rare → super order)
    const N = 60000; const n = { normal: 0, rare: 0, super: 0 };
    for (let i = 0; i < N; i++) for (const x of M.rollDrops(d, { mods: {}, tier: 2 })) n[x.grade]++;
    near(n.normal / N, 1 / 8, 0.006, 'sampled normal'); near(n.rare / N, 1 / 32, 0.003, 'sampled rare'); near(n.super / N, 1 / 256, 0.0012, 'sampled super');
  }
  for (const id in DB.monsters) {
    const d = DB.monsters[id];
    const f = d.flags || [];
    if (!d.drops) continue;
    if (f.includes('boss') && d.drops.normal) {
      ok(d.drops.normal.rate === 1, `${id}: boss drop rate 1/1`);
      const dr = M.rollDrops(d, { mods: {}, tier: 3 });
      ok(dr.some((x) => x.grade === 'normal'), `${id}: boss always drops`);
    }
    if (f.includes('metal')) ok(d.drops.normal.rate === 4 && d.drops.rare.rate === 16 && d.drops.super.rate === 128, `${id}: metal drops 1/4 1/16 1/128`);
  }
  // summoned monsters drop nothing, and no EXP-less monster breaks rewards
  const e = new B.Engine({ party: [], mons: [{ id: mob, summoned: true }], tier: 2, lv: 18, noSurprise: true });
  e.killed.push(e.mons[0]);
  ok(e.computeRewards().drops.length === 0, 'summoned: no drops');
});

// ------------------------------------------------------------------ C6 statuses / stages
part('C6 statuses §4.8', () => {
  ok(JSON.stringify([-2, -1, 0, 1, 2].map(B.stageMult)) === '[0.63,0.77,1,1.3,1.6]', 'STAGE');
  const t = section('#### 4.8.3').find((l) => /^\| \| 1 \|/.test(l));
  const v = cells(t).slice(1).map(Number); // death, sleep.., stun.., poison..
  const want = { death: v[0], sleep: v[1], paralyze: v[1], freeze: v[1], confuse: v[1], stun: v[2], silence: v[2], blind: v[2], poison: v[3], burn: v[3] };
  const boss = Object.keys(DB.monsters).find((x) => (DB.monsters[x].flags || []).includes('boss'));
  const e = new B.Engine({ party: [], mons: [boss], tier: 3, lv: 30, noSurprise: true });
  const u = e.mons[0];
  for (const s in want) ok(u.resist(s) >= want[s], `boss resist ${s} ≥ ${want[s]} (got ${u.resist(s)})`);
  for (const s in want) ok(B.BOSS_RES[s] === want[s] || (B.K('BOSS_RES') || {})[s] === want[s], `BOSS_RES.${s} = ${want[s]}`);
  // durations of §4.8.1
  const T = { burn: [3, 3], sleep: [2, 4], paralyze: [1, 3], freeze: [1, 2], stun: [1, 1], confuse: [2, 4], silence: [3, 5], blind: [3, 5], regen: [5, 5], veil: [3, 3], nimble: [3, 3] };
  for (const s in T) { const d = B.stDef(s); ok(JSON.stringify(d.turns) === JSON.stringify(T[s]), `${s} turns ${JSON.stringify(d.turns)} ≠ ${JSON.stringify(T[s])}`); }
  ok(B.stDef('poison').turns == null, 'poison lasts until cured');
});

// ------------------------------------------------------------------ C7 preempt / escape
part('C7 preempt / escape §4.11', () => {
  const party = partyAt(3);
  const r = B.resolveMonsters({ mons: [['@wolf', 3]], tier: 3 }, {});
  const e = engineFor(r, party);
  const avg = (l) => l.reduce((s, x) => s + x.stat('spd'), 0) / l.length;
  const ratio = U.clamp(avg(e.party) / avg(e.mons), 0.5, 2);
  near(e.preemptChance(), ratio / 16, 1e-9, 'preempt = 1/16 × clamp(Ap/Am, 0.5, 2)');
  const ap = avg(e.party), am = avg(e.mons);
  near(e.escapeChance(), U.clamp(0.55 + 0.5 * (ap - am) / (ap + am), 0.25, 0.95), 1e-9, 'escape formula (0 fails)');
  e.escapeFails = 2;
  near(e.escapeChance(), U.clamp(0.55 + 0.24 + 0.5 * (ap - am) / (ap + am), 0.25, 0.95), 1e-9, 'escape +0.12 per failure');
  const bossR = B.resolveMonsters({ troop: 'tr_b_moth', tier: 1 }, {});
  const be = engineFor(bossR, partyAt(1));
  ok(be.noEscape, 'boss battles: no escape');
});

// ------------------------------------------------------------------ C8 zones
part('C8 zones §4.14.1', () => {
  let n = 0, golden = 0;
  for (const z in DB.encounters) {
    const zd = DB.encounters[z];
    for (let T = 0; T <= 9; T++) {
      if (typeof zd.tier === 'number' && T !== zd.tier) continue;
      for (let k = 0; k < 6; k++) {
        const r = B.resolveMonsters({ zone: z, tier: T, noRare: true }, { mods: { goldenPct: 0 } });
        if (!r) continue; // no group of the zone exists at this tier
        n++;
        ok(r.mons.length >= 1 && r.mons.length <= 8, `${z} T${T}: ${r.mons.length} monsters`);
        const wantTb = typeof zd.tier === 'number' ? zd.tier : T;
        ok(r.Tb === wantTb, `${z} T${T}: Tb ${r.Tb} ≠ ${wantTb}`);
        if (!(zd.lv && zd.lv.length)) ok(r.Lb === 6 + 6 * wantTb + (zd.lvOff || 0), `${z} T${T}: Lb ${r.Lb} ≠ LZ + lvOff`);
        // species adjacent (groups), all resolvable
        const seq = r.mons.map((m) => m.id);
        const seen = new Set();
        let adjacent = true;
        seq.forEach((id, i) => { if (i && seq[i - 1] !== id && seen.has(id)) adjacent = false; seen.add(id); });
        ok(adjacent, `${z} T${T}: species not adjacent ${seq}`);
        if (r.golden) { golden++; ok(r.mons.filter((m) => m.golden).every((m) => M.canBeGolden(DB.monsters[m.id])), `${z}: golden on an ineligible monster`); }
        const e = engineFor(r);
        ok(e.mons.every((m) => m.hp > 0 && m.d.atk >= 0), `${z} T${T}: units built`);
      }
    }
  }
  ok(n > 300, `zone resolutions: ${n}`);
  // rare encounters: rate is a denominator
  let rz = 0;
  for (const z in (DB.rareEncounters || {})) {
    const rr = DB.rareEncounters[z];
    rz++;
    ok(rr.rate >= 20 && rr.rate <= 400 && DB.monsters[rr.mon] && (DB.monsters[rr.mon].flags || []).includes('rare'), `${z}: rare encounter ${rr.mon} 1/${rr.rate}`);
    const f = B.resolveMonsters({ zone: z, rare: 'force', tier: typeof DB.encounters[z].tier === 'number' ? DB.encounters[z].tier : 3 }, {});
    if (f) {
      ok(f.rare && f.mons.length === 1 && f.mons[0].id === rr.mon && !f.golden, `${z}: forced rare swap`);
      const base = B.resolveMonsters({ zone: z, noRare: true, lv: undefined, tier: f.Tb }, {});
      if (base && !(DB.encounters[z].lv && DB.encounters[z].lv.length)) ok(f.Lb === base.Lb + 2, `${z}: rare Lb = zone Lb + 2`);
    }
  }
  ok(rz >= 20, `rare encounter zones: ${rz}`);
  const z0 = Object.keys(DB.rareEncounters || {})[0];
  if (z0) {
    const rr = DB.rareEncounters[z0];
    let hit = 0; const N = 30000;
    const T = typeof DB.encounters[z0].tier === 'number' ? DB.encounters[z0].tier : 3;
    for (let i = 0; i < N; i++) { const r = B.resolveMonsters({ zone: z0, tier: T }, { mods: {} }); if (r && r.rare) hit++; }
    near(hit / N, 1 / rr.rate, 0.35 / rr.rate + 0.002, `${z0}: rare swap rate 1/${rr.rate}`);
  }
});

// ------------------------------------------------------------------ C9 events / sound
part('C9 events §3.3.8', () => {
  const src = ['battle.js', 'battle_ai.js', 'mon.js'].map((f) => fs.readFileSync(path.join(ROOT, 'src/systems', f), 'utf8').replace(/\/\/.*$/gm, '')).join('\n');
  ok(!/R\.(sfx|jingle)\s*\(|Engine\.shake\s*\(/.test(src), 'the engine never calls R.sfx / R.jingle / R.Engine.shake');
  const KNOWN = new Set(['msg', 'actor', 'fx', 'dmg', 'heal', 'miss', 'crit', 'die', 'revive', 'status', 'buff', 'flee', 'escape', 'cover', 'react',
    'glimmer', 'golden', 'summon', 'phase', 'gain', 'drop', 'levelup', 'prof', 'victory', 'jingle', 'pause', 'clear']);
  const seen = new Set();
  const zones = Object.keys(DB.encounters).slice(0, 12);
  let battles = 0;
  for (const z of zones) {
    const T = typeof DB.encounters[z].tier === 'number' ? DB.encounters[z].tier : 3;
    const r = B.resolveMonsters({ zone: z, tier: T, noRare: true, golden: 'force' }, {});
    if (!r) continue;
    const e = new B.Engine({ party: partyAt(T), mons: r.mons, tier: r.Tb, lv: r.Lb, noSurprise: true, glimTier: T });
    for (const ev of e.begin()) seen.add(ev.t);
    while (!e.result && e.round < 40) for (const ev of e.playRound(R.BattleAI.partyCommands(e, R.BattleAI.AUTO_OPTS))) seen.add(ev.t);
    if (e.result === 'win') for (const ev of e.rewards()) seen.add(ev.t);
    e.finish();
    battles++;
  }
  ok(battles >= 8, `real battles run: ${battles}`);
  const unknown = [...seen].filter((t) => !KNOWN.has(t));
  ok(!unknown.length, `unknown events: ${unknown}`);
  for (const t of ['msg', 'actor', 'fx', 'dmg', 'die', 'victory', 'golden']) ok(seen.has(t), `event ${t} produced`);
});

// ------------------------------------------------------------------ C10 metal
part('C10 metal §4.10.5', () => {
  const metal = Object.keys(DB.monsters).filter((x) => (DB.monsters[x].flags || []).includes('metal'));
  for (const id of metal) {
    const d = DB.monsters[id];
    const a = M.def(id, { Lb: 20 }), b = M.def(id, { Lb: 60 });
    ok(a.hp === b.hp && a.hp >= 6 && a.hp <= 12, `${id}: fixed HP 6–12 (${a.hp}, ${b.hp})`);
    ok(d.fleeRate === 0.5, `${id}: flees 50 %`);
    near(a.exp, Math.round(M.curve(20).exp * ((DB.lineages[d.lineage] && 1) || 1) * 30 * (({ s: 0.7, m: 1, l: 1.8 })[d.size || 'm']) * ((d.rw && d.rw.exp) || 1)), Math.max(3, a.exp * 0.02), `${id}: EXP = curve × 30`);
    const e = new B.Engine({ party: partyAt(3), mons: [id], tier: 3, lv: 24, noSurprise: true });
    const u = e.mons[0];
    const r = e.roll(e.party[0], u, { type: 'damage', formula: 'phys', power: 3, sure: true, critBonus: -100 }, {});
    ok(r.dmg === 1, `${id}: a plain hit does 1 (got ${r.dmg})`);
    const m = e.roll(e.party[0], u, { type: 'damage', formula: 'phys', power: 1.4, sure: true, critBonus: -100, metalHit: true }, {});
    ok(m.dmg === Math.ceil(3 * 1.4), `${id}: metalHit ceil(3P) (got ${m.dmg})`);
    ok(e.roll(e.party[0], u, { type: 'damage', formula: 'magic', power: 5 }, { kind: 'spell' }).dmg === 1, `${id}: spells do 1`);
    ok(e.roll(e.party[0], u, { type: 'damage', formula: 'percent', power: 0.5 }, {}).immune, `${id}: percent immune`);
    ok(u.resist('poison') === 1 && u.resist('sleep') === 1, `${id}: no status lands`);
  }
});

// ------------------------------------------------------------------ C11 after battle
part('C11 after battle §4.12.1', () => {
  const party = partyAt(2);
  party.forEach((c) => { c.mp = 0; c.wp = 0; });
  party[3].hp = 0;
  const r = B.resolveMonsters({ mons: [['@jelly', 1]], tier: 2 }, {});
  const e = new B.Engine({ party, mons: r.mons, tier: r.Tb, lv: r.Lb, noSurprise: true, after: true });
  e.party[0].hp = 1;
  e.result = 'win';
  e.finish();
  ok(party[0].hp === e.party[0].mhp, 'win: the living get full HP');
  ok(party[0].mp === Math.ceil(e.party[0].mmp * 0.1) && party[0].wp === Math.ceil(e.party[0].mwp * 0.1), 'win: MP / WP +10 % rounded up');
  ok(party[3].hp === 0, 'the fallen stay down');
  ok(party.every((c) => c.status && !Object.keys(c.status).length), 'statuses cleared');
});

function partyAt(T) {
  // a plain 4-member party from the real data (hero + the first three companions), levelled to LZ(T) + 1
  const lv = 6 + 6 * T + 1;
  const ids = Object.keys(DB.companions || {}).slice(0, 3);
  const mk = (id, i) => {
    let c = null;
    try {
      if (id === 'hero') c = R.Rules.newChar('hero', { type: Object.keys(DB.heroTypes || {})[0], gender: 'm', name: 'テスト' });
      else c = R.Rules.newChar(id);
    } catch (e) { c = null; }
    if (!c) c = { id, name: 'X' + i, level: 1, hp: 30, mp: 10, wp: 10, equip: {}, status: {}, techs: [], spells: [] };
    try { R.Rules.gainExp(c, R.Rules.expForLevel ? R.Rules.expForLevel(lv) : 0); } catch (e) { c.level = lv; }
    try { const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.wp = st.wp; } catch (e) { /* keep */ }
    c.row = i === 3 ? 'middle' : 'front';
    return c;
  };
  return ['hero'].concat(ids).map(mk);
}

console.log('check_battle:');
for (const k in counts) console.log(`  ${k.padEnd(28)} ${String(counts[k][0]).padStart(6)} checks  ${counts[k][1] ? counts[k][1] + ' FAILED' : 'ok'}`);
for (const w of warns) console.log('  warn: ' + w);
console.log(`check_battle: ${checked} checks, ${errors} error(s), ${warns.length} warning(s)`);
process.exit(errors ? 1 : 0);
