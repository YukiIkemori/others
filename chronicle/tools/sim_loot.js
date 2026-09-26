#!/usr/bin/env node
// Loot simulator (A12, DESIGN §9.13.3 L1–L6, §4.10, §4.17.3 H1–H3).
//   node tools/sim_loot.js            all checks (≈10 s)
//   node tools/sim_loot.js --l 3,4    only L3 and L4
//   node tools/sim_loot.js --runs 400 region replays per region × tier (default 300)
//   node tools/sim_loot.js --json out.json
// Uses R.Mon (battle A2: dropChances / rollDrops / rollGolden / resolve) when present, and the §4.10
// formulas otherwise (reported as 'formula'). Encounter data are mons A11's; rare rows and the
// rare/boss drops are this area's. Exit 1 when a check fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const LS = String(arg('l', '1,2,3,4,5,6')).split(',').map(Number);
const RUNS = +arg('runs', 300);
const SEED = +arg('seed', 4242);
const JSON_OUT = arg('json', null);

const R = require('./lib/load')({ quiet: true });
const DB = R.DB;
let s0 = SEED >>> 0;
const rng = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
if (R.U) { R.U.r = rng; R.U.rng = rng; R.U.chance = (p) => rng() < p; R.U.ri = (a, b) => a + Math.floor(rng() * (b - a + 1)); R.U.pick = (a) => a[Math.floor(rng() * a.length)]; }
const HAVE_MON = !!(R.Mon && R.Mon.dropChances && R.Mon.rollDrops);

const CAP = { normal: 0.75, rare: 0.5, super: 0.125 };
const MODKEY = { normal: 'dropPct', rare: 'rarePct', super: 'superPct' };
const GOLDX = { normal: 2, rare: 8, super: 8 };
function chances(d, golden, mods) {
  if (HAVE_MON) return R.Mon.dropChances(d, { golden, mods: mods || {} });
  const out = {};
  for (const g of ['normal', 'rare', 'super']) {
    const sl = d.drops && d.drops[g];
    if (!sl) { out[g] = 0; continue; }
    const m = Math.min(150, (mods && mods[MODKEY[g]]) || 0);
    out[g] = sl.rate <= 1 ? 1 : Math.min(CAP[g], 1 / sl.rate * (golden ? GOLDX[g] : 1) * (1 + m / 100));
  }
  return out;
}
const expectP = (d, g, golden, mods) => {
  const sl = d.drops[g];
  const m = Math.min(150, (mods && mods[MODKEY[g]]) || 0);
  return sl.rate <= 1 ? 1 : Math.min(CAP[g], 1 / sl.rate * (golden ? GOLDX[g] : 1) * (1 + m / 100));
};
function resolve(ref, T) {
  if (R.Mon && R.Mon.resolve) return R.Mon.resolve(ref, T);
  if (ref[0] !== '@') return ref;
  const lin = DB.lineages[ref.slice(1)];
  let best = null;
  for (const s of (lin && lin.stages) || []) if (s.tier <= T) best = s.mon;
  return best;
}
const weighted = (list) => { let t = 0; for (const x of list) t += x.w; let r = rng() * t; for (const x of list) { r -= x.w; if (r < 0) return x; } return list[list.length - 1]; };

const out = { engine: HAVE_MON ? 'R.Mon' : 'formula', checks: [] };
let failed = 0;
const check = (id, ok, text, data) => { out.checks.push({ id, ok, text, data }); if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + id + ' ' + text); };
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
console.log(`sim_loot: drops by ${out.engine}, seed ${SEED}`);

// ------------------------------------------------------------------ L1 drop probabilities (§4.17.3-H1)
if (LS.includes(1)) {
  console.log('\nL1  drop roll vs the §4.10.1 formula (100 000 kills per case)');
  const cases = [
    ['jelly_1', false, {}], ['jelly_1', true, {}], ['jelly_1', false, { dropPct: 60, rarePct: 150, superPct: 100 }],
    ['jelly_1', true, { dropPct: 300, rarePct: 300, superPct: 300 }], ['book_1', false, {}], ['mimic_1', false, {}],
    ['quicksilver_1', false, {}], ['rm_gold_idol', false, {}], ['rm_dream_tapir', false, { rarePct: 150, superPct: 150 }],
    ['b_valzard_echo', false, {}],
  ].filter(([id]) => DB.monsters[id]);
  let worst = 0, capOk = true;
  for (const [id, golden, mods] of cases) {
    const d0 = DB.monsters[id];
    const d = HAVE_MON && R.Mon.def ? R.Mon.def(id, { golden }) : d0;
    const n = 100000;
    const cnt = { normal: 0, rare: 0, super: 0 };
    for (let i = 0; i < n; i++) {
      if (HAVE_MON) { for (const e of R.Mon.rollDrops(d, { golden, mods, tier: 3 })) if (e.slot !== 'bonus') cnt[e.slot || e.grade]++; }
      else { const ch = chances(d0, golden, mods); for (const g in cnt) if (rng() < ch[g]) cnt[g]++; }
    }
    const row = [];
    for (const g of ['normal', 'rare', 'super']) {
      if (!d0.drops[g]) continue;
      const want = expectP(d0, g, golden, mods);
      const got = cnt[g] / n;
      const tol = Math.max(0.1 * want, 3 * Math.sqrt(want * (1 - want) / n));
      worst = Math.max(worst, Math.abs(got - want) / want);
      if (Math.abs(got - want) > tol) check(`L1 ${id} ${g}`, false, `p ${got.toFixed(5)} vs formula ${want.toFixed(5)}`);
      if (got > CAP[g] * 1.02 && want < 1) capOk = false;
      row.push(`${g} ${got.toFixed(4)}/${want.toFixed(4)}`);
    }
    console.log(`  ${(id + (golden ? '(金色)' : '')).padEnd(22)} ${JSON.stringify(mods).padEnd(46)} ${row.join('  ')}`);
  }
  check('L1 formula', worst <= 0.1, `largest relative error ${(worst * 100).toFixed(1)}% (≤10%)`);
  check('L1 caps', capOk, 'never above 0.75 / 0.5 / 0.125 with mods capped at +150');
}

// ------------------------------------------------------------------ region replays (L2–L4)
const REGIONS = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
// floors (non-boss rooms count as one floor each) per dungeon zone (§10.6.2); the world zone gets 40 %
const FLOORS = { z_r_forest_maze: 2, z_r_forest_tree: 2, z_r_desert_tomb: 3, z_r_snow_peak: 3, z_r_marsh_manor: 2, z_r_marsh_bog: 1,
  z_r_isles_cave: 1, z_r_isles_ship: 3, z_r_mine_mine: 3, z_r_ash_volcano: 3, z_r_star_tower: 4 };
// §10.6.4 rare-monster rooms: a small room behind a secret wall that other owners register as a copy of a zone
// with the rare rate ÷ 3 (z_r_marsh_teaparty, z_r_mine_den, …). Not in src/data/rare_encounters.js. A player
// fights there about ROOM_BATTLES times per visit of the region, not a floor's share.
const MY_RARE = (() => { const sb = { DB: { rareEncounters: {} } }; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'rare_encounters.js'), 'utf8'))({ RPG: sb }); return sb.DB.rareEncounters; })();
const isRoom = (z) => !!(DB.encounters[z] && DB.encounters[z].rareRoom) || (!!DB.rareEncounters[z] && !MY_RARE[z]);
const ROOM_BATTLES = 2;
function zoneShare(region) {
  const zones = Object.keys(DB.encounters).filter((z) => DB.encounters[z].region === region);
  const rooms = zones.filter(isRoom);
  const world = zones.filter((z) => z.startsWith('zw_') && !isRoom(z));
  const dung = zones.filter((z) => !z.startsWith('zw_') && !isRoom(z));
  const fl = dung.map((z) => FLOORS[z] || 2), tot = fl.reduce((s, x) => s + x, 0);
  const roomW = ROOM_BATTLES / 95, rest = 1 - roomW * rooms.length;
  const out = [];
  for (const z of world) out.push({ z, w: rest * 0.4 / world.length });
  dung.forEach((z, i) => out.push({ z, w: rest * 0.6 * fl[i] / tot }));
  for (const z of rooms) out.push({ z, w: roomW });
  return out;
}
function groupsAt(zone, T) {
  return DB.encounters[zone].groups.filter((g) => (g.tierMin == null || T >= g.tierMin) && (g.tierMax == null || T <= g.tierMax)
    && g.mons.every(([ref]) => resolve(ref, T)));
}
function battle(zone, T, mods, st) {
  const rr = DB.rareEncounters[zone];
  const rareP = rr ? (1 / rr.rate) * (1 + Math.min(150, mods.rareEncPct || 0) / 100) : 0;
  if (rr && rng() < rareP) {
    st.rareMon++;
    const d = DB.monsters[rr.mon];
    const ch = chances(d, false, mods);
    for (const g of ['normal', 'rare', 'super']) if (rng() < ch[g]) st[g]++;
    st.kills++;
    return;
  }
  const g = weighted(groupsAt(zone, T));
  const ids = [];
  for (const [ref, mn, mx] of g.mons) { const id = resolve(ref, T); const n = mn + Math.floor(rng() * ((mx || mn) - mn + 1)); for (let i = 0; i < n && ids.length < 8; i++) ids.push(id); }
  const metalOnly = ids.every((id) => (DB.monsters[id].flags || []).includes('metal'));
  let gold = -1;
  if (!metalOnly) {
    const pGold = (1 / 40) * (1 + Math.min(150, mods.goldenPct || 0) / 100);
    if (rng() < pGold) { const el = ids.map((id, i) => i).filter((i) => !(DB.monsters[ids[i]].flags || []).some((f) => f === 'metal' || f === 'rare' || f === 'boss')); if (el.length) { gold = el[Math.floor(rng() * el.length)]; st.golden++; } }
  }
  ids.forEach((id, i) => {
    const d = DB.monsters[id];
    const ch = chances(d, i === gold, mods);
    for (const gr of ['normal', 'rare', 'super']) if (rng() < ch[gr]) st[gr]++;
    st.kills++;
  });
}
function replay(region, T, mods) {
  const st = { normal: 0, rare: 0, super: 0, golden: 0, rareMon: 0, kills: 0 };
  const shares = zoneShare(region);
  for (let b = 0; b < 95; b++) battle(weighted(shares).z, T, mods, st);
  return st;
}
function regionStats(mods) {
  const res = {};
  for (const region of REGIONS) {
    const acc = { normal: 0, rare: 0, super: 0, golden: 0, rareMon: 0, kills: 0 };
    const runs = [];
    for (let T = 0; T <= 7; T++) for (let i = 0; i < Math.ceil(RUNS / 8); i++) { const st = replay(region, T, mods); runs.push(st); for (const k in acc) acc[k] += st[k]; }
    for (const k in acc) acc[k] /= runs.length;
    res[region] = acc;
  }
  return res;
}
let plain = null;
if (LS.some((l) => l >= 2 && l <= 4)) {
  plain = regionStats({});
  out.regions = plain;
}
if (LS.includes(2)) {
  console.log('\nL2  golden and rare monsters per region (95 battles, no mods)');
  for (const r of REGIONS) console.log(`  ${r.padEnd(9)} golden ${f2(plain[r].golden)}  rare monsters ${f2(plain[r].rareMon)}  kills ${Math.round(plain[r].kills)}`);
  const g = REGIONS.map((r) => plain[r].golden), m = REGIONS.map((r) => plain[r].rareMon);
  check('L2 golden', Math.min(...g) >= 2 && Math.max(...g) <= 3, `golden 2–3 per region: ${f2(Math.min(...g))}–${f2(Math.max(...g))}`);
  check('L2 rare monsters', Math.min(...m) >= 0.8 && Math.max(...m) <= 1.5, `rare monsters 0.8–1.5 per region: ${f2(Math.min(...m))}–${f2(Math.max(...m))}`);
}
if (LS.includes(3)) {
  console.log('\nL3  items per region (no mods; mobs + golden + rare monsters, bosses excluded)');
  for (const r of REGIONS) console.log(`  ${r.padEnd(9)} normal ${f2(plain[r].normal).padStart(6)}  rare ${f2(plain[r].rare).padStart(5)}  super ${f2(plain[r].super)}`);
  const avg = (k) => REGIONS.reduce((s, r) => s + plain[r][k], 0) / REGIONS.length;
  const rng3 = (k) => [Math.min(...REGIONS.map((r) => plain[r][k])), Math.max(...REGIONS.map((r) => plain[r][k]))];
  const [n0, n1] = rng3('normal'), [r0, r1] = rng3('rare'), [s0_, s1] = rng3('super');
  check('L3 normal', n0 >= 30 && n1 <= 45, `normal 30–45: ${f2(n0)}–${f2(n1)} (avg ${f2(avg('normal'))})`);
  check('L3 rare', r0 >= 7 && r1 <= 12, `rare 7–12: ${f2(r0)}–${f2(r1)} (avg ${f2(avg('rare'))})`);
  check('L3 super', s0_ >= 0.8 && s1 <= 1.6, `super 0.8–1.6: ${f2(s0_)}–${f2(s1)} (avg ${f2(avg('super'))})`);
}
if (LS.includes(4)) {
  console.log('\nL4  rare-hunting build (dropPct +60, rarePct +150, superPct +100; §8.13.2)');
  const hunt = regionStats({ dropPct: 60, rarePct: 150, superPct: 100 });
  out.hunt = hunt;
  const ratio = (k) => REGIONS.map((r) => hunt[r][k] / plain[r][k]);
  const rr = ratio('rare'), sr = ratio('super');
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  for (const r of REGIONS) console.log(`  ${r.padEnd(9)} rare ×${f2(hunt[r].rare / plain[r].rare)}  super ×${f2(hunt[r].super / plain[r].super)}  normal ×${f2(hunt[r].normal / plain[r].normal)}`);
  check('L4 rare ×', avg(rr) >= 2.2 && avg(rr) <= 2.8, `rare ×2.2–2.8: ×${f2(avg(rr))} (regions ${f2(Math.min(...rr))}–${f2(Math.max(...rr))})`);
  check('L4 super ×', avg(sr) >= 1.8 && avg(sr) <= 2.2, `super ×1.8–2.2: ×${f2(avg(sr))} (regions ${f2(Math.min(...sr))}–${f2(Math.max(...sr))})`);
}

// ------------------------------------------------------------------ L5 one-of-a-kind super items (H2)
if (LS.includes(5)) {
  console.log('\nL5  super items are one-of-a-kind');
  const superOf = {}, otherSlot = {};
  for (const [id, d] of Object.entries(DB.monsters)) {
    if (!d.drops) continue;
    if (d.drops.super && d.drops.super.item) (superOf[d.drops.super.item] = superOf[d.drops.super.item] || []).push(id);
    for (const g of ['normal', 'rare', 'bonus']) if (d.drops[g] && d.drops[g].item) (otherSlot[d.drops[g].item] = otherSlot[d.drops[g].item] || []).push(id + ':' + g);
  }
  const dup = Object.entries(superOf).filter(([, l]) => l.length > 1);
  check('L5 one monster', dup.length === 0, `every super item on exactly one monster's super slot (${Object.keys(superOf).length} items${dup.length ? '; dup: ' + dup.map(([k, l]) => k + '→' + l).join(', ') : ''})`);
  const inOther = Object.keys(superOf).filter((it) => otherSlot[it]);
  check('L5 not stealable', inOther.length === 0, `no super item in a normal/rare slot (steal takes those)${inOther.length ? ': ' + inOther.join(' ') : ''}`);
  const pooled = [], sold = [];
  for (const [pid, p] of Object.entries(DB.pools || {})) for (const list of p.tiers || []) for (const e of list || []) if (e.item && superOf[e.item]) pooled.push(pid + ':' + e.item);
  for (const [sid, sh] of Object.entries(DB.shops || {})) { const txt = JSON.stringify(sh); for (const it of Object.keys(superOf)) if (txt.includes('"' + it + '"')) sold.push(sid + ':' + it); }
  check('L5 not in chests/shops', !pooled.length && !sold.length, `no super item in a pool or shop${pooled.length || sold.length ? ': ' + pooled.concat(sold).slice(0, 8).join(' ') : ''} (pools ${Object.keys(DB.pools || {}).length}, shops ${Object.keys(DB.shops || {}).length})`);
  out.superItems = Object.keys(superOf).length;
  const missing = Object.keys(superOf).filter((it) => !DB.items[it]);
  if (missing.length) console.log(`  note: ${missing.length} super items not defined yet in DB.items (weapons / gear owners): ${missing.slice(0, 8).join(' ')}${missing.length > 8 ? ' …' : ''}`);
  else {
    const bad = Object.entries(superOf).filter(([it, l]) => DB.items[it].exclusive && DB.items[it].exclusive !== l[0]);
    check('L5 exclusive field', bad.length === 0, `items' exclusive = their monster${bad.length ? ': ' + bad.slice(0, 5).map(([k]) => k).join(' ') : ''}`);
  }
}

// ------------------------------------------------------------------ L6 the three T8 sets (§8.6.5)
if (LS.includes(6)) {
  console.log('\nL6  T8 sets (27 items, super 1/128): expected battles per set of 9 with superPct +100');
  const SETS = {
    int: ['w_staff_sr_cosmos', 'w_staff_sr_moon', 'sh_sr_blank', 'hd_sr_dusk', 'bd_sr_starry', 'hn_sr_words', 'ft_sr_cloud', 'ac_sr_owl', 'ac_sr_ink'],
    str: ['w_sword_sr_hegemon', 'w_axe_sr_titan', 'sh_sr_steadfast', 'hd_sr_oni', 'bd_sr_dragonhide', 'hn_sr_mighty', 'ft_sr_quake', 'ac_sr_beastheart', 'ac_sr_bloodoath'],
    dex: ['w_dagger_sr_moonfang', 'w_dagger_sr_silk', 'sh_sr_phantom', 'hd_sr_heaveneye', 'bd_sr_shadow', 'hn_sr_hundred', 'ft_sr_whirl', 'ac_sr_eagle', 'ac_sr_needle'],
  };
  const monOf = {};
  for (const [id, d] of Object.entries(DB.monsters)) if (d.drops && d.drops.super) monOf[d.drops.super.item] = id;
  // expected encounters of a species per battle in a zone at tier T
  const perBattle = (zone, T, mon) => {
    const gs = groupsAt(zone, T);
    const tw = gs.reduce((s, g) => s + g.w, 0);
    let e = 0;
    for (const g of gs) for (const [ref, mn, mx] of g.mons) if (resolve(ref, T) === mon) e += g.w / tw * (mn + (mx || mn)) / 2;
    const rr = DB.rareEncounters[zone];
    return e * (rr ? 1 - 1 / rr.rate : 1);
  };
  const zoneTier = (z) => (DB.encounters[z].tier === 'dyn' ? [8] : [DB.encounters[z].tier]);
  const res = {};
  let allOk = true;
  for (const [set, items] of Object.entries(SETS)) {
    let total = 0;
    const rows = [];
    for (const it of items) {
      const mon = monOf[it];
      if (!mon) { rows.push(`${it}: no monster`); allOk = false; continue; }
      const d = DB.monsters[mon];
      let best = { z: null, e: 0 };
      for (const z of Object.keys(DB.encounters)) for (const T of zoneTier(z)) { const e = perBattle(z, T, mon); if (e > best.e) best = { z, e, T }; }
      const p = Math.min(0.125, 1 / d.drops.super.rate * 2);
      // golden individuals (1/40 per battle, ×8) add a little on top
      const pEff = p + (1 / 40) / Math.max(1, best.e) * (Math.min(0.125, 1 / d.drops.super.rate * 8 * 2) - p);
      const battles = best.e > 0 ? 1 / (pEff * best.e) : Infinity;
      total += battles;
      rows.push(`${mon} ${best.z || '—'} ${f2(best.e)}/battle → ${Math.round(battles)}`);
      if (best.e < 0.65) console.log(`  note: ${mon} (${it}) meets ${f2(best.e)} per battle at best (§9.13.3 L6 asks ≥0.65; encounter weights are mons A11's)`);
    }
    res[set] = { total, rows };
    console.log(`  ${set}: ${Math.round(total)} battles  [${rows.join(' | ')}]`);
    check('L6 ' + set, total <= 900, `one set within 900 battles: ${Math.round(total)}`);
  }
  out.L6 = res;
}

if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
console.log(`\n${failed ? 'FAILED ' + failed : 'all passed'} (${out.checks.length} checks, drops by ${out.engine})`);
process.exit(failed ? 1 : 0);
