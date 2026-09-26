#!/usr/bin/env node
// progress.js (owner qa A22) — completability of the whole game (DESIGN §12.2 progress 1–5, §10.15 qa 1–5).
// A fixpoint BFS over every map from DB.config.start: tile passability (tilePatches and closed tiles solved with the
// game's own condition rules, tools/lib/cond.js), door locks, non-pushable NPC blockers (R.FieldMap.pushable),
// furniture decor, warps (with cond), map exits, step / talk / examine events, NPC events and onEnter events whose
// meta.needs hold add their meta.gives; events with meta.warp (the ferries `common_ferry`, ghost ship pier, …) move
// the party; after `prologue_done` the menu's warp (visited locations) and escape are usable.
//
// Checks:
//  1. new game → flag game_clear (tier and region clears included)
//  2. the 8 regions in ANY order: each region can be cleared (a) with no other region cleared (tier 0) and (b) with all
//     the 7 others cleared first; plus a few whole-game orders (natural, reversed, rotated)
//  3. after the ending: oblivion_5 is reached and pg_clear is given
//  4. secret passages (secret_*) count as walkable, but nothing that meta.gives (flags, key items) nor any required
//     map may be reachable only through one (Part A4): the whole run is repeated with secret tiles closed
//  5. unreached maps / chests are reported (maps: error, chests: warning)
//
// meta tokens: needs/gives 'flag:<n>' 'item:<id>' 'region:<id>' 'recruit:<id>'; extensions read here:
//   gives 'var:<name>+<n>' / 'var:<name>=<n>' (the "collect 3" counters), needs 'var:<name>>=<n>', 'tier:<n>', 'postgame:true'.
//   meta.warp = {to, spawn} or [{to, spawn, needs?:[…], cond?}] (a ferry with several routes).
//   meta.calls = [event ids] run by ev.call: each fires (once) when the caller is reachable and its own meta.needs hold.
//
//   node tools/progress.js [--verbose] [--owner R3] [--quick]       exit 1 unless every check passes
//   const P = require('./progress'); P.analyse(R) → the report object (used by playthrough.js)
'use strict';
const Cond = require('./lib/cond');
const M = require('./lib/maps');

const REGIONS = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
const REGION_OWNER = { r_forest: 'R1', r_desert: 'R2', r_snow: 'R3', r_marsh: 'R4', r_isles: 'R5', r_mine: 'R6', r_ash: 'R7', r_star: 'R8' };

// ------------------------------------------------------------------------------------------ world model
function Model(R) {
  const DB = R.DB;
  const maps = {};
  for (const id of Object.keys(DB.maps || {})) { const P = M.parseMap(R, id); if (P) maps[id] = P; }
  const start = (DB.config && DB.config.start) || null;
  return { R, DB, maps, start };
}

function newState(model) {
  const DB = model.DB;
  return {
    flags: new Set(['hero_created']), items: new Set(Object.keys((DB.config && DB.config.startItems) || {})), vars: {},
    cleared: [], fired: new Set(), log: [], visited: new Set(), gameClear: false, secretUsed: new Set(),
  };
}
const cloneState = (s) => ({ flags: new Set(s.flags), items: new Set(s.items), vars: Object.assign({}, s.vars), cleared: s.cleared.slice(),
  fired: new Set(s.fired), log: s.log.slice(), visited: new Set(s.visited), gameClear: s.gameClear, secretUsed: new Set(s.secretUsed) });

function condState(s) {
  return Cond.fromSets({ flags: s.flags, items: s.items, vars: s.vars, cleared: s.cleared, tier: () => Math.min(8, s.cleared.length), postgame: () => s.gameClear || s.flags.has('game_clear') });
}

function tokenOk(tok, s) {
  const m = String(tok).match(/^(\w+):(.*)$/);
  if (!m) return true;
  const [, k, v] = m;
  if (k === 'flag') return s.flags.has(v) || (v === 'game_clear' && s.gameClear);
  if (k === 'item') return s.items.has(v);
  if (k === 'region') return s.cleared.includes(v);
  if (k === 'recruit') return s.flags.has('joined_' + v);
  if (k === 'tier') return s.cleared.length >= +v;
  if (k === 'postgame') return !!s.gameClear === (v !== 'false');
  if (k === 'var') { const mm = v.match(/^(\w+)\s*(>=|>|==|=|<)\s*(\d+)$/); if (!mm) return true; const x = +s.vars[mm[1]] || 0, n = +mm[3]; return mm[2] === '>=' ? x >= n : mm[2] === '>' ? x > n : mm[2] === '<' ? x < n : x === n; }
  return true;
}

/** explore once with the current flags: every reachable cell of every map */
function bfs(model, s, opt) {
  const { R, DB, maps } = model;
  const S = condState(s);
  const check = (c) => Cond.check(c, S);
  const seen = new Map();                 // mapId → Set of cell index
  const reachedMaps = new Set();
  const secretCells = new Set();
  const q = [];
  const push = (mid, x, y, viaSecret) => {
    const P = maps[mid];
    if (!P) return;
    x = P.wx(x); y = P.wy(y);
    if (!P.inMap(x, y)) return;
    let set = seen.get(mid);
    if (!set) { set = new Set(); seen.set(mid, set); }
    const k = y * P.w + x;
    if (set.has(k)) return;
    set.add(k); reachedMaps.add(mid);
    if (viaSecret) secretCells.add(mid + ':' + x + ',' + y);
    q.push([mid, x, y]);
  };
  const goSpawn = (to, spawn) => {
    const P = maps[to];
    if (!P) return;
    const sp = spawn && typeof spawn === 'object' ? spawn : P.spawns[spawn] || P.spawns.entrance;
    if (sp) push(to, sp.x, sp.y);
  };
  // per-map lookups for this pass
  const cache = {};
  const info = (mid) => {
    if (cache[mid]) return cache[mid];
    const P = maps[mid];
    const block = new Set();
    for (const n of P.npcs) {
      const present = check(n.cond);
      if (!present) continue;
      let push2 = false;
      try { push2 = R.FieldMap && R.FieldMap.pushable ? R.FieldMap.pushable(n) : !n.fixed; } catch (e) { push2 = false; }
      if (!push2) block.add(n.y * P.w + n.x);
    }
    const warpAt = new Map();
    for (const w of P.warps) if (check(w.cond)) warpAt.set(w.y * P.w + w.x, w);
    const stepEv = new Map();
    for (const e of P.events) if ((e.trigger || 'step') === 'step') { const k = e.y * P.w + e.x; (stepEv.get(k) || stepEv.set(k, []).get(k)).push(e); }
    return (cache[mid] = { P, block, warpAt, stepEv });
  };
  const walkable = (mid, x, y) => {
    const I = info(mid), P = I.P;
    if (!P.inBounds(x, y)) return false;
    x = P.wx(x); y = P.wy(y);
    if (I.block.has(y * P.w + x)) return false;
    const tid = P.patchedAt(x, y, check);
    const t = DB.tiles[tid];
    if (!t) return false;
    const dd = P.decorDef(x, y);
    if (dd && !dd.pass && !dd.over && !opt.decorPass) return false;
    if (M.isSecret(R, tid)) return !opt.noSecret;
    if (t.lock && !s.items.has(t.lock)) return false;
    if (t.pass) return true;
    return !!(t.flagPass && !t.shipWhenFlag && s.flags.has(t.flagPass));
  };
  // start, and every destination a ferry / talk warp has opened (synthetic __warp flags)
  if (model.start && maps[model.start.map]) goSpawn(model.start.map, model.start.spawn);
  for (const f of s.flags) if (f.startsWith('__warp:')) { const [, to, spawn] = f.split(':'); goSpawn(to, spawn); }
  // menu warp / escape after the prologue: every visited location, from anywhere
  const menuTravel = s.flags.has('prologue_done');
  if (menuTravel) for (const loc of s.visited) { const L = DB.locations[loc]; if (L) goSpawn(L.map || 'world', L.spawn); }
  const stepWarps = (mid, x, y) => {
    const I = info(mid), P = I.P, k = y * P.w + x;
    const w = I.warpAt.get(k);
    if (w) goSpawn(w.to, w.spawn);
    for (const e of I.stepEv.get(k) || []) {
      if (!check(e.cond)) continue;
      const ev = DB.events[e.id];
      if (ev && ev.meta && ev.meta.warp) for (const wt of [].concat(ev.meta.warp)) if ((wt.needs || []).every((t) => tokenOk(t, s)) && check(wt.cond)) goSpawn(wt.to, wt.spawn);
    }
  };
  while (q.length) {
    const [mid, x, y] = q.shift();
    const I = info(mid), P = I.P;
    stepWarps(mid, x, y);
    if (menuTravel && P.def.escape && P.def.type === 'dungeon') goSpawn(P.def.escape.to, P.def.escape.spawn);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!P.wrap && !P.inMap(nx, ny)) {
        const ex = P.def.exit;
        const dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
        const e = ex && (ex.to ? ex : ex[dir]);
        if (e && e.to) goSpawn(e.to, e.spawn);
        continue;
      }
      if (!walkable(mid, nx, ny)) continue;
      const tid = P.patchedAt(nx, ny, check);
      push(mid, nx, ny, M.isSecret(R, tid) || secretCells.has(mid + ':' + x + ',' + y) && !isSpawnish(P, nx, ny));
    }
  }
  return { seen, reachedMaps, secretCells };
}
function isSpawnish(P, x, y) { for (const k in P.spawns) { const s = P.spawns[k]; if (s.x === x && s.y === y) return true; } return false; }

/** fixpoint: explore, fire every event that became possible, repeat */
function run(model, s, opt) {
  opt = opt || {};
  const { R, DB, maps } = model;
  const block = new Set(opt.blockRegions || []);
  let res = null;
  for (let round = 0; round < (opt.maxRounds || 400); round++) {
    const S = condState(s);
    const check = (c) => Cond.check(c, S);
    res = bfs(model, s, opt);
    let changed = false;
    const near = (mid, x, y) => {
      const set = res.seen.get(mid), P = maps[mid];
      if (!set) return false;
      const has = (xx, yy) => { if (!P.inBounds(xx, yy)) return false; return set.has(P.wy(yy) * P.w + P.wx(xx)); };
      if (has(x, y)) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (has(x + dx, y + dy)) return true;
        const t = DB.tiles[P.patchedAt(x + dx, y + dy, check)] || {}, dd = P.decorDef(x + dx, y + dy);
        if ((t.counter || (dd && dd.counter)) && has(x + 2 * dx, y + 2 * dy)) return true;
      }
      return false;
    };
    const viaSecretOnly = (mid, x, y) => {
      // is (x,y) or its neighbours reached only through a secret cell? (for the Part A4 report)
      return res.secretCells.has(mid + ':' + x + ',' + y);
    };
    const fire = (id, why, placement, depth) => {
      const ev = DB.events[id];
      if (!ev || !ev.meta) return;
      // meta.calls: events this one runs with ev.call when their own needs hold (checked again every round, since
      // the caller — an onEnter, a dispatcher NPC — keeps running after its first time)
      if ((depth || 0) < 4) for (const cid of ev.meta.calls || []) {
        if (cid !== id) fire(cid, `called by ${id}`, { key: 'call:' + cid, at: placement && placement.at, secret: placement && placement.secret }, (depth || 0) + 1);
      }
      const key = id + (placement && placement.key ? '@' + placement.key : '');
      if (s.fired.has(key)) return;
      if (!(ev.meta.needs || []).every((t) => tokenOk(t, s))) return;
      if ((ev.meta.gives || []).some((g) => /^region:/.test(g) && block.has(g.slice(7)))) return;
      s.fired.add(key);
      const gives = [];
      for (const g of ev.meta.gives || []) {
        const m = String(g).match(/^(\w+):(.*)$/);
        if (!m) continue;
        const [, k, v] = m;
        if (k === 'flag') { if (!s.flags.has(v)) { s.flags.add(v); gives.push(g); if (v === 'game_clear') s.gameClear = true; } }
        else if (k === 'item') { if (!s.items.has(v)) { s.items.add(v); gives.push(g); } }
        else if (k === 'region') { if (!s.cleared.includes(v)) { s.cleared.push(v); s.flags.add('cleared_' + v); gives.push(g); } }
        else if (k === 'recruit') { if (!s.flags.has('joined_' + v)) { s.flags.add('joined_' + v); gives.push(g); } }
        else if (k === 'var') { const mm = v.match(/^(\w+)\s*([+=])\s*(\d+)$/); if (mm) { s.vars[mm[1]] = mm[2] === '+' ? (+s.vars[mm[1]] || 0) + (+mm[3]) : +mm[3]; gives.push(g); } }
      }
      if (placement && placement.once && !s.flags.has(placement.once)) { s.flags.add(placement.once); gives.push('flag:' + placement.once); }
      if (gives.length) changed = true;
      s.log.push({ round, event: id, why, gives, secret: !!(placement && placement.secret), at: placement && placement.at });
    };
    for (const mid of res.reachedMaps) {
      const P = maps[mid];
      const d = P.def;
      if (d.location && !s.visited.has(d.location)) { s.visited.add(d.location); changed = true; }
      else if (!d.location && d.type === 'dungeon' && R.State && R.State.dungeonLocation) { try { const l = R.State.dungeonLocation(d); if (l && !s.visited.has(l)) { s.visited.add(l); changed = true; } } catch (e) { /* ignore */ } }
      if (d.onEnter) fire(d.onEnter, `onEnter ${mid}`, { key: 'enter:' + mid, at: { map: mid } });
      for (const n of P.npcs) if (n.event && check(n.cond) && near(mid, n.x, n.y)) fire(n.event, `npc ${n.id} @${mid}`, { key: `npc:${mid}:${n.id}`, secret: viaSecretOnly(mid, n.x, n.y), at: { map: mid, npc: n } });
      for (const e of P.events) {
        if (!e.id || !check(e.cond)) continue;
        const hit = (e.trigger || 'step') === 'step' ? (res.seen.get(mid) || new Set()).has(e.y * P.w + e.x) : near(mid, e.x, e.y);
        if (hit) fire(e.id, `event @${mid} ${e.x},${e.y}`, { key: `ev:${mid}:${e.x},${e.y}`, once: e.once, secret: viaSecretOnly(mid, e.x, e.y), at: { map: mid, event: e } });
      }
      // NPC-borne warps (ferries): meta.warp of a talk event is followed when the NPC is reachable (handled in bfs via fired flags below)
    }
    // ferries / talk warps: add their destinations as extra starts on the next round (a flag per destination)
    for (const mid of res.reachedMaps) {
      const P = maps[mid];
      for (const n of P.npcs) {
        const ev = n.event && DB.events[n.event];
        if (!ev || !ev.meta || !ev.meta.warp || !check(n.cond) || !near(mid, n.x, n.y)) continue;
        for (const wt of [].concat(ev.meta.warp)) {
          if (!(wt.needs || []).every((t) => tokenOk(t, s)) || !check(wt.cond)) continue;
          if (wt.from && n.ferryFrom && wt.from !== n.ferryFrom) continue;
          const f = `__warp:${wt.to}:${wt.spawn}`;
          if (!s.flags.has(f)) { s.flags.add(f); changed = true; s.log.push({ round, event: n.event, why: `npc ${n.id} @${mid}`, gives: [`warp:${wt.to}/${wt.spawn}`] }); }
        }
      }
      for (const e of P.events) {
        const ev = e.id && DB.events[e.id];
        if (!ev || !ev.meta || !ev.meta.warp || (e.trigger || 'step') === 'step' || !check(e.cond) || !near(mid, e.x, e.y)) continue;
        for (const wt of [].concat(ev.meta.warp)) {
          if (!(wt.needs || []).every((t) => tokenOk(t, s)) || !check(wt.cond)) continue;
          const f = `__warp:${wt.to}:${wt.spawn}`;
          if (!s.flags.has(f)) { s.flags.add(f); changed = true; }
        }
      }
    }
    if (opt.until && opt.until(s)) break;
    if (!changed) break;
  }
  return res;
}

// ------------------------------------------------------------------------------------------ analysis
function analyse(R, o) {
  o = o || {};
  const model = Model(R);
  const DB = model.DB;
  const out = { errors: [], warns: [], notes: [], log: [], order: [], regionTable: {}, secret: {}, model };
  const E = (owner, msg) => out.errors.push({ owner, msg });
  const W = (owner, msg) => out.warns.push({ owner, msg });
  if (!model.start) { E('A18a', 'DB.config.start is missing'); return out; }
  if (!model.maps[model.start.map]) { E('A18a', `start map '${model.start.map}' is not registered`); return out; }
  if (!model.maps[model.start.map].spawns[model.start.spawn]) E('A18a', `start spawn '${model.start.spawn}' is not on ${model.start.map}`);
  const realRegions = Object.keys(DB.regions || {}).length ? Object.keys(DB.regions) : REGIONS;
  const runFix = (s, opt) => run(model, s, opt);
  // 1. whole game, natural order
  const full = newState(model);
  const resFull = runFix(full, {});
  out.log = full.log;
  out.full = { flags: full.flags, items: full.items, cleared: full.cleared.slice(), gameClear: full.gameClear, reachedMaps: resFull.reachedMaps };
  const allMaps = Object.keys(model.maps);
  const unreached = allMaps.filter((m) => !resFull.reachedMaps.has(m));
  const chestsMissing = [];
  for (const mid of allMaps) { const P = model.maps[mid]; for (const c of P.chests) { const set = resFull.seen.get(mid); if (!set || ![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.inMap(c.x + dx, c.y + dy) && set.has((c.y + dy) * P.w + c.x + dx))) chestsMissing.push(`${mid}:${c.id}`); } }
  out.unreached = unreached; out.chestsMissing = chestsMissing;
  const V = require('./validate');
  for (const m of unreached) E(V.expectedMapOwner(m) || 'A18a', `map ${m} is never reached`);
  if (chestsMissing.length) W('A22', `${chestsMissing.length} chest(s) unreachable: ${chestsMissing.slice(0, 12).join(' ')}${chestsMissing.length > 12 ? ' …' : ''}`);
  if (!full.flags.has('game_clear')) E('A19', `game_clear is never reached (regions cleared: ${full.cleared.join(' ') || 'none'})`);
  const neverCleared = new Set(realRegions.filter((r) => !full.cleared.includes(r)));
  for (const r of neverCleared) E(REGION_OWNER[r] || 'A18a', `region ${r} is never cleared`);
  // 3. postgame
  const pgReached = resFull.reachedMaps.has('oblivion_5');
  out.postgame = { oblivion5: pgReached, pgClear: full.flags.has('pg_clear') };
  if (!pgReached) E('OB', 'oblivion_5 is never reached after the ending');
  if (!full.flags.has('pg_clear')) E('OB', 'pg_clear is never given');
  // 2. any order
  if (!o.quick) {
    // state right after the prologue (no region may be cleared)
    const p0 = newState(model);
    runFix(p0, { blockRegions: realRegions });
    out.prologueDone = p0.flags.has('prologue_done');
    if (!out.prologueDone) E('A18b', 'prologue_done is never reached');
    for (const r of realRegions) {
      const others = realRegions.filter((x) => x !== r);
      const a = cloneState(p0);
      runFix(a, { blockRegions: others, until: (st) => st.cleared.includes(r) });
      const okA = a.cleared.includes(r);
      const b = cloneState(p0);
      runFix(b, { blockRegions: [r], until: (st) => others.every((x) => st.cleared.includes(x)) });
      const got7 = others.every((x) => b.cleared.includes(x));
      runFix(b, { until: (st) => st.cleared.includes(r) });
      const okB = b.cleared.includes(r);
      out.regionTable[r] = { first: okA, last: okB, others7: got7 };
      if (!okA && !neverCleared.has(r)) E(REGION_OWNER[r], `region ${r} cannot be cleared first (at tier 0 with no other region cleared): its gate depends on another region or on the tier`);
      if (!okB && !neverCleared.has(r)) E(REGION_OWNER[r], `region ${r} cannot be cleared last (after the 7 others): a condition closes it once other regions are cleared`);
    }
    // whole-game orders: reversed and rotated
    const orders = [realRegions.slice().reverse(), realRegions.slice(3).concat(realRegions.slice(0, 3)), realRegions.slice(5).concat(realRegions.slice(0, 5))];
    out.orders = [];
    for (const ord of orders) {
      const st = cloneState(p0);
      let ok = true, stuckAt = null;
      for (let i = 0; i < ord.length && ok; i++) {
        const allow = new Set(ord.slice(0, i + 1));
        runFix(st, { blockRegions: realRegions.filter((x) => !allow.has(x)), until: (x) => x.cleared.includes(ord[i]) });
        if (!st.cleared.includes(ord[i])) { ok = false; stuckAt = ord[i]; }
      }
      runFix(st, {});
      const regionsOk = ok;
      ok = ok && st.flags.has('game_clear');
      out.orders.push({ order: ord, ok, cleared: st.cleared.slice(), stuckAt });
      // blame the region that could not be cleared in this order (a region that is never clearable, or a game_clear
      // that is never reached, is already reported above — only an order-specific failure is new information)
      if (!regionsOk && stuckAt && !neverCleared.has(stuckAt)) E(REGION_OWNER[stuckAt] || 'A22', `order ${ord.map((x) => x.replace(/^r_/, '')).join('→')}: ${stuckAt} cannot be cleared after ${st.cleared.join(' ') || 'nothing'}`);
    }
  }
  // 4. secret passages
  const ns = newState(model);
  const resNs = runFix(ns, { noSecret: true });
  const lostFlags = [...full.flags].filter((f) => !f.startsWith('__') && !ns.flags.has(f));
  const lostItems = [...full.items].filter((i) => !ns.items.has(i));
  const lostMaps = [...resFull.reachedMaps].filter((m) => !resNs.reachedMaps.has(m));
  out.secret = { lostFlags, lostItems, lostMaps, gameClear: ns.flags.has('game_clear'), cells: countSecrets(model) };
  for (const f of lostFlags) E(ownerOfFlagSource(full.log, f, DB, V), `flag '${f}' is only reachable through a secret passage (Part A4)`);
  for (const i of lostItems) E(ownerOfFlagSource(full.log, 'item:' + i, DB, V), `item '${i}' is only reachable through a secret passage (Part A4)`);
  for (const m of lostMaps) E(V.expectedMapOwner(m) || 'A18a', `map ${m} is only reachable through a secret passage (Part A4)`);
  out.order = full.log.filter((l) => l.gives.length).map((l) => l.event);
  out.fired = full.log.map((l) => l.event);
  return out;
}
function countSecrets(model) {
  const out = {};
  for (const [id, P] of Object.entries(model.maps)) { let n = 0; for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (M.isSecret(model.R, P.tileAt(x, y))) n++; if (n) out[id] = n; }
  return out;
}
function ownerOfFlagSource(log, tok, DB, V) {
  const t = tok.startsWith('item:') ? tok : 'flag:' + tok;
  const l = log.find((x) => x.gives.includes(t));
  return l ? V.expectedOwner('events', l.event) : 'A22';
}

// ------------------------------------------------------------------------------------------ CLI
function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
  const owners = arg('owner') ? arg('owner').split(',') : null;
  const verbose = argv.includes('--verbose');
  const t0 = Date.now();
  const V = require('./validate');
  const L = V.loadTracked({ with: arg('with') ? arg('with').split(',') : null });
  const R = L.R;
  R.warn = () => {};
  const out = analyse(R, { quick: argv.includes('--quick') });
  console.log('Acquisition order (event → gives):');
  for (const l of out.log) if (l.gives.length && (verbose || l.gives.some((g) => !/^flag:[a-z0-9_]+$/.test(g) || /prologue|boss|clear|final|pg_|_done/.test(g)))) console.log(`  r${String(l.round).padStart(2)} ${l.event.padEnd(28)} ${l.gives.join(' ')}${l.secret ? '  (via secret)' : ''}`);
  if (out.regionTable && Object.keys(out.regionTable).length) {
    console.log('\nAny order (first = at tier 0 with nothing else cleared, last = after the 7 others):');
    for (const [r, t] of Object.entries(out.regionTable)) console.log(`  ${r.padEnd(10)} first ${t.first ? 'ok' : 'NO'}   last ${t.last ? 'ok' : 'NO'}`);
    for (const o of out.orders || []) console.log(`  order ${o.order.map((r) => r.replace('r_', '')).join('→')}: ${o.ok ? 'ok' : 'STUCK after ' + o.cleared.join(' ')}`);
  }
  if (out.secret && out.secret.cells) {
    const floors = Object.keys(out.secret.cells);
    console.log(`\nSecret passages: ${floors.length} map(s) (${floors.map((f) => f + ' ' + out.secret.cells[f]).join(', ') || 'none'}); without them: game_clear ${out.secret.gameClear ? 'ok' : 'NO'}, lost ${out.secret.lostFlags.length + out.secret.lostItems.length + out.secret.lostMaps.length}`);
  }
  if (out.full) console.log(`\nregions cleared: ${out.full.cleared.join(' ') || 'none'}; maps reached ${out.full.reachedMaps.size}/${Object.keys(out.model.maps).length}; postgame oblivion_5 ${out.postgame && out.postgame.oblivion5 ? 'ok' : 'NO'}, pg_clear ${out.postgame && out.postgame.pgClear ? 'ok' : 'NO'}`);
  let errs = out.errors, warns = out.warns;
  if (owners) { errs = errs.filter((e) => owners.includes(e.owner)); warns = warns.filter((e) => owners.includes(e.owner)); }
  for (const w of warns) console.log(`WARN  [${w.owner}] ${w.msg}`);
  for (const e of errs) console.log(`ERROR [${e.owner}] ${e.msg}`);
  const ok = !errs.length;
  console.log(ok ? `\nCOMPLETABLE ✓ (${Date.now() - t0} ms)` : `\nNOT COMPLETABLE ✗ — ${errs.length} error(s), ${warns.length} warning(s) (${Date.now() - t0} ms)`);
  process.exitCode = ok ? 0 : 1;
}

module.exports = { analyse, Model, newState, run, bfs, tokenOk, condState };
if (require.main === module) main();
