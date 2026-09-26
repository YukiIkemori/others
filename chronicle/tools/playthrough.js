#!/usr/bin/env node
// playthrough.js (owner qa A22) — node dry run of the story (DESIGN §12.1, §12.6-4).
// Runs the events in the order progress.js finds them (new game → game_clear → pg_clear) with a stand-in `ev`
// (every message / choice / screen resolves at once: ask → the first choice, yesno → true), against the real
// R.State / R.Tier / R.Party. Battles go through R.Battle.simulate with the party of tools/lib/party_model.js at the
// current tier (post-game bosses: Lv64 with 'real' gear); the story goes on as if every battle was won, and a lost
// battle is reported as a WARN. Afterwards every other event is run once
// on its own (exceptions only).
// Checks: no exception; every `meta.gives` token is really given; everything really given (items, region clears,
// recruits, and flags that some condition reads) is declared in meta.gives; game_clear and pg_clear are reached.
//
//   node tools/playthrough.js [--verbose] [--owner R3] [--events id,id]      exit 1 on any error
'use strict';
const PM = require('./lib/party_model');
const Cond = require('./lib/cond');

const MAX_CALLS = 4000;
const LOOP = new Error('playthrough: event loops (too many ev calls)');

function makeEv(R, rep, ctx) {
  const DB = R.DB, St = R.State;
  let calls = 0;
  const tick = () => { if (++calls > MAX_CALLS) throw LOOP; };
  const hero = () => (St && St.hero ? St.hero() : (R.Game.party || []).find((c) => c.id === 'hero'));
  const lastBattle = { v: null };
  const ev = {
    ctx: ctx || {}, self: (ctx && ctx.self) || null,
    get map() { return (ctx && ctx.map) || (R.Game.pos && R.Game.pos.map) || null; },
    get leader() { const l = St && St.leader ? St.leader() : hero(); return l ? l.name : ''; },
    get hero() { return hero(); },
    get lastBattle() { return lastBattle.v; },
    async say() { tick(); }, async ask(text, choices) { tick(); return choices && choices.length ? 0 : -1; }, async yesno() { tick(); return true; },
    async gotItem() { tick(); }, closeMessage() {}, async caption() { tick(); },
    flag(n) { return St.flag(n); }, setFlag(n, v = true) { tick(); St.setFlag(n, v); rep.flags.add(n); },
    check(c) { return St.check(c); }, var(n) { return St.getVar(n); }, setVar(n, v) { tick(); St.setVar(n, v); rep.vars.add(n); },
    has(i, n = 1) { return St.hasItem(i, n); }, take(i, n = 1) { tick(); return St.removeItem(i, n); },
    gold() { return R.Game.gold; }, takeGold(n) { tick(); return St.takeGold(n); },
    tier() { return R.Tier && R.Tier.current ? R.Tier.current() : R.Game.tier || 0; },
    cleared(r) { return (R.Game.regionsCleared || []).includes(r); },
    inParty(id) { return R.Game.party.some((c) => c.id === id); },
    recruited(id) { return R.Game.party.concat(R.Game.reserve || []).some((c) => c.id === id); },
    g(m, f) { const h = hero(); return h && h.gender === 'f' ? f : m; },
    async give(item, n = 1) { tick(); if (!DB.items[item]) { rep.problem(`ev.give('${item}'): unknown item`); return false; } St.addItem(item, n); rep.items.add(item); return true; },
    async giveGold(n) { tick(); St.addGold(n); },
    async battle(troopId, opts) {
      tick();
      const o = Object.assign({}, opts || {});
      if (troopId && typeof troopId === 'object') Object.assign(o, troopId); else if (troopId) o.troop = troopId;
      if (o.troop && !DB.troops[o.troop]) rep.problem(`ev.battle('${o.troop}'): unknown troop`);
      const res = simulateFor(R, o, rep);
      lastBattle.v = R.Battle ? R.Battle.last || null : null;
      return res;
    },
    async warp(map, spawn) { tick(); if (!DB.maps[map]) rep.problem(`ev.warp('${map}'): unknown map`); R.Game.pos = Object.assign({}, R.Game.pos, { map, spawn }); if (ctx) ctx.map = map; },
    async wait() { tick(); }, async fadeOut() { tick(); }, async fadeIn() { tick(); }, async shake() { tick(); }, async flash() { tick(); },
    sfx() {}, bgm() {}, async jingle() { tick(); },
    npc() { const h = { x: 0, y: 0, dir: 'down', visible: true, face: () => h, walk: async () => { tick(); }, hide: () => h, show: () => h, setPos: () => h }; return h; },
    player: { x: 0, y: 0, dir: 'down', face() {}, async walk() { tick(); }, setPos() {} },
    heal() { if (St.healAll) St.healAll({ reserve: true }); }, async inn() { tick(); if (St.healAll) St.healAll({ reserve: true }); return true; }, async rest() { tick(); if (St.healAll) St.healAll({ reserve: true }); },
    async shop(id) { tick(); if (!DB.shops[id]) rep.problem(`ev.shop('${id}'): unknown shop`); return null; },
    async saveMenu() { tick(); return null; },
    setObjective(id, o) { tick(); if (!DB.objectives[id]) rep.problem(`ev.setObjective('${id}'): unknown objective`); if (o && o.region) { R.Game.regionObj = R.Game.regionObj || {}; R.Game.regionObj[o.region] = id; } else R.Game.objective = id; },
    setRespawn(map, spawn) { if (map) R.Game.respawn = { map, spawn: spawn || 'entrance' }; },
    giveShip() {}, refresh() {},
    async ending() {
      tick();
      R.Game.gameClear = true; R.Game.clearCount = (R.Game.clearCount || 0) + 1; St.setFlag('game_clear'); rep.flags.add('game_clear');
      const pg = DB.config && DB.config.postgameStart;
      if (pg) R.Game.pos = Object.assign({}, R.Game.pos, { map: pg.map, spawn: pg.spawn });
    },
    async call(id) {
      // what the callee gives is the callee's (checked against its own meta once), not the caller's
      tick();
      const before = snapshot(R);
      const sub = newRep(rep);
      const r = await runEvent(R, id, sub, ctx, true);
      const after = snapshot(R);
      diffInto(sub, before, after);
      for (const t of tokens(sub)) rep.nested.add(t);
      for (const t of sub.nested) rep.nested.add(t);
      if (rep.onCall) rep.onCall(id, sub);
      return r;
    },
    async createHero() { tick(); St.setFlag('hero_created'); return hero(); },
    async chooseCompanions(o) {
      tick();
      const ids = ['brigitta', 'marta', 'sylvain'].slice(0, (o && o.count) || 3);
      for (const id of ids) { doRecruit(R, id, rep); rep.chosen.add(id); }   // the player's pick: not a fixed give
      return ids;
    },
    async tavern() { tick(); }, async recruit(id) { tick(); return doRecruit(R, id, rep); },
    async clearRegion(id) {
      tick();
      if (!DB.regions[id]) rep.problem(`ev.clearRegion('${id}'): unknown region`);
      if ((R.Game.regionsCleared || []).includes(id)) return R.Game.tier;
      if (R.Tier && R.Tier.clear) R.Tier.clear(id);
      else { R.Game.regionsCleared.push(id); R.Game.tier = R.Game.regionsCleared.length; St.setFlag('cleared_' + id); }
      rep.regions.add(id);
      const frag = DB.regions[id] && DB.regions[id].fragment;
      if (frag && DB.items[frag]) { St.addItem(frag, 1); rep.nested.add('item:' + frag); }   // the page comes with region:<id>
      return R.Game.tier;
    },
    async chronicle() { tick(); },
  };
  return new Proxy(ev, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol' || k === 'then' || /^__/.test(k)) return undefined;   // private markers an event keeps on ev
      rep.problem(`ev.${String(k)} is not part of the ev API (§3.3.11)`);
      return async () => {};
    },
  });
}

function newRep(parent) {
  return { flags: new Set(), items: new Set(), regions: new Set(), recruits: new Set(), chosen: new Set(), vars: new Set(), nested: new Set(),
    battles: parent ? parent.battles : [], problems: parent ? parent.problems : [], onCall: parent ? parent.onCall : null,
    problem(m) { this.problems.push(m); } };
}
function diffInto(rep, before, after) {
  for (const f of Object.keys(after.flags)) if (after.flags[f] && !before.flags[f]) rep.flags.add(f);
  for (const i of Object.keys(after.inv)) if ((after.inv[i] || 0) > (before.inv[i] || 0)) rep.items.add(i);
  for (const x of after.cleared) if (!before.cleared.includes(x)) rep.regions.add(x);
  for (const x of after.members) if (!before.members.includes(x)) rep.recruits.add(x);
}
function tokens(rep) {
  const out = [];
  for (const f of rep.flags) out.push('flag:' + f);
  for (const i of rep.items) out.push('item:' + i);
  for (const r of rep.regions) out.push('region:' + r);
  for (const c of rep.recruits) if (!rep.chosen.has(c)) out.push('recruit:' + c);
  return out;
}

function doRecruit(R, id, rep) {
  const DB = R.DB;
  if (!DB.companions[id]) { rep.problem(`recruit('${id}'): unknown companion`); return null; }
  const all = R.Game.party.concat(R.Game.reserve || []);
  const had = all.find((c) => c.id === id);
  if (had) return had;
  let c = null;
  if (R.Party && R.Party.recruit) c = R.Party.recruit(id, { toParty: true });
  else { c = R.Rules.newChar({ id }); (R.Game.party.length < 4 ? R.Game.party : R.Game.reserve).push(c); R.State.setFlag('joined_' + id); }
  rep.recruits.add(id);
  return c;
}

function simulateFor(R, o, rep) {
  const DB = R.DB;
  const tier = o.tier != null ? o.tier : R.Tier && R.Tier.effective ? R.Tier.effective() : R.Game.tier || 0;
  const troop = o.troop && DB.troops[o.troop];
  let result = 'win', rounds = 0;
  if (R.Battle && R.Battle.simulate && (troop || o.mons || o.zone)) {
    const members = (o.members || R.Game.party.map((c) => c.id)).filter((id) => id === 'hero' || DB.companions[id]);
    const hero = R.Game.party.find((c) => c.id === 'hero') || {};
    // the post-game bosses (T9) are fought by a well-geared party: Lv64 with 現実的な装備 (§4.17.1 'real', the C3 party
    // without the 4 extra super slots); everything else by the tier's model party
    const post = !!(troop && /^tr_b_/.test(o.troop) && tier >= 9);
    const kind = post ? 'super' : troop && /^tr_b_/.test(o.troop) ? 'boss' : 'mob';
    let pm;
    try { pm = PM.build(R, { tier: Math.min(9, tier), members, heroType: hero.heroType || 'warrior', favor: hero.favor, kind, gear: post ? 'real' : 'shop' }); } catch (e) { pm = null; }
    try {
      const r = R.Battle.simulate(Object.assign({ party: pm ? pm.party : R.Game.party, inv: pm ? pm.inv : R.Game.inv, tier, seed: 7, maxRounds: 60, items: true }, o.troop ? { troop: o.troop } : {}, o.mons ? { mons: o.mons } : {}, o.zone ? { zone: o.zone } : {}));
      result = r && r.result; rounds = r ? r.rounds : 0;
    } catch (e) { rep.problem(`R.Battle.simulate(${o.troop || 'mons'}) threw: ${e && e.message}`); result = 'error'; }
  }
  rep.battles.push({ troop: o.troop || (o.mons ? 'mons' : o.zone), tier, result, rounds });
  return 'win';
}

async function runEvent(R, id, rep, ctx, inline) {
  const ev = R.DB.events[id];
  if (!ev || typeof ev.run !== 'function') { rep.problem(`event '${id}' has no run()`); return false; }
  const e = makeEv(R, rep, ctx);
  try {
    const r = await ev.run(e);
    return r;
  } catch (err) {
    if (inline) throw err;
    rep.problem(`${id}: threw ${err === LOOP ? 'LOOP (too many ev calls — an endless menu or retry loop?)' : (err && err.stack || err).split('\n').slice(0, 2).join(' | ')}`);
    return false;
  }
}

async function playthrough(R, o) {
  o = o || {};
  const DB = R.DB;
  const V = require('./validate');
  const P = require('./progress');
  const out = { errors: [], warns: [], ran: [], battles: [], dryOnly: [] };
  const E = (owner, msg) => out.errors.push({ owner, msg });
  const W = (owner, msg) => out.warns.push({ owner, msg });
  if (!R.State || !R.State.newGame) { E('A1', 'R.State.newGame missing'); return out; }
  try { R.State.newGame(); } catch (e) { E('A1', 'R.State.newGame threw: ' + e.message); return out; }
  // flags any condition reads (so an undeclared set of one of them hides a gate from progress.js)
  const readFlags = new Set();
  const addC = (c) => { for (const f of Cond.refs(c).flags) readFlags.add(f); };
  for (const m of Object.values(DB.maps)) for (const k of ['npcs', 'events', 'warps', 'tilePatches', 'chests', 'signs']) for (const x of m[k] || []) addC(x.cond);
  for (const m of Object.values(DB.maps)) for (const mk of Object.values(m.marks || {})) for (const k of ['npc', 'event', 'warp', 'chest']) if (mk[k]) addC(mk[k].cond);
  for (const ev of Object.values(DB.events)) for (const t of (ev.meta && ev.meta.needs) || []) if (/^flag:/.test(t)) readFlags.add(t.slice(5));
  const order = [];
  if (o.events) order.push(...o.events.map((id) => ({ event: id })));
  else { const pr = P.analyse(R, { quick: true }); for (const l of pr.log) order.push(l); }
  const done = new Set();
  const acc = new Map();          // event id → {declared, actual, runs, owner}
  for (const step of order) {
    const id = step.event;
    const ev = DB.events[id];
    if (!ev) continue;
    const owner = V.expectedOwner('events', id);
    const rep = newRep(null);
    rep.battles = out.battles;
    rep.onCall = (cid, sub) => {
      const cev = DB.events[cid];
      if (cev && cev.meta) compareMeta(cid, cev.meta, sub, readFlags, V.expectedOwner('events', cid), E, W, R, acc);
      done.add(cid);
    };
    const before = snapshot(R);
    const ctx = step.at ? { map: step.at.map, npc: step.at.npc, event: step.at.event, self: step.at.npc || step.at.event || null } : {};
    if (ctx.map) R.Game.pos = Object.assign({}, R.Game.pos, { map: ctx.map });
    const r = await runEvent(R, id, rep, ctx, false);
    const after = snapshot(R);
    // actual gives from the state diff (covers direct R.State calls too)
    diffInto(rep, before, after);
    const once = step.at && step.at.event && step.at.event.once;
    if (once && r !== false && !R.State.flag(once)) R.State.setFlag(once);
    out.ran.push({ id, result: r, problems: rep.problems.slice() });
    for (const p of rep.problems) E(owner, p);
    if (ev.meta) compareMeta(id, ev.meta, rep, readFlags, owner, E, W, R, acc);
    done.add(id);
  }
  // meta.gives never given over all the runs of an event (an event may give a different part each time it runs)
  for (const [id, a] of acc) {
    for (const t of a.declared) {
      if (/^(var|tier|postgame):/.test(t) || a.actual.has(t)) continue;
      if (t.startsWith('flag:') && R.State.flag(t.slice(5))) continue;           // set by some other event: progress.js decides
      if (t.startsWith('item:') && R.State.hasItem(t.slice(5))) continue;
      E(a.owner, `${id}: meta.gives '${t}' but no run of the event gave it (${a.runs} run(s))`);
    }
  }
  // a battle the model party loses is a balance problem (the dry run still goes on as if it had been won)
  for (const b of out.battles) if (b.result !== 'win') W(/^tr_b_/.test(b.troop || '') ? 'A12' : 'A11', `battle ${b.troop}@T${b.tier} not won by the model party (${b.result}, ${b.rounds} rounds)`);
  const g = R.Game;
  out.gameClear = !!(g.flags && g.flags.game_clear); out.pgClear = !!(g.flags && g.flags.pg_clear);
  if (!o.events) {
    if (!g.flags.game_clear) E('A19', 'the dry run never reached game_clear');
    if (!g.flags.pg_clear) E('OB', 'the dry run never reached pg_clear');
  }
  // every other event once (exceptions only), in a fresh game
  if (!o.events && !o.noRest) {
    for (const id of Object.keys(DB.events)) {
      if (done.has(id)) continue;
      try { R.State.newGame(); } catch (e) { break; }
      const rep = newRep(null);
      await runEvent(R, id, rep, {}, false);
      out.dryOnly.push(id);
      for (const p of rep.problems) E(V.expectedOwner('events', id), `${p} (run alone)`);
    }
  }
  return out;
}

function compareMeta(id, meta, rep, readFlags, owner, E, W, R, acc) {
  const declared = new Set(meta.gives || []);
  const actual = new Set(tokens(rep));
  const nested = rep.nested || new Set();
  const auto = (t) => /^flag:(cleared_|joined_|hero_created$|game_clear$)/.test(t) || t === 'flag:' + id;   // + the event's own once-flag
  if (acc) {
    const a = acc.get(id) || { declared, actual: new Set(), runs: 0, owner };
    a.runs++;
    for (const t of actual) a.actual.add(t);
    for (const t of nested) a.actual.add(t);
    acc.set(id, a);
  }
  const seen = (acc && acc.get(id)) || null;
  if (seen && seen.runs > 1) seen.reported = seen.reported || new Set();
  for (const t of actual) {
    if (declared.has(t) || auto(t) || nested.has(t)) continue;       // nested: given by an ev.call'd event (its own meta)
    if (seen) { seen.reported = seen.reported || new Set(); if (seen.reported.has(t)) continue; seen.reported.add(t); }
    if (t.startsWith('region:') && declared.has('flag:cleared_' + t.slice(7))) continue;
    if (t.startsWith('flag:')) {
      const f = t.slice(5);
      if (/^st_show_/.test(f)) continue;                                   // scene-only flags (§10.13.7)
      if (readFlags.has(f)) E(owner, `${id}: sets flag '${f}' that a condition reads, but meta.gives does not declare it`);
      else W(owner, `${id}: sets undeclared flag '${f}'`);
    } else if (t.startsWith('item:')) {
      const it = R.DB.items[t.slice(5)];
      if (it && (it.type === 'key' || it.src === 'reward')) E(owner, `${id}: gives ${t} (${it.type === 'key' ? 'a key item' : 'a reward'}) not declared in meta.gives`);
      else W(owner, `${id}: gives ${t} not declared in meta.gives`);
    } else E(owner, `${id}: ${t} not declared in meta.gives`);
  }
}

function snapshot(R) {
  const g = R.Game || {};
  return {
    flags: Object.assign({}, g.flags || {}), inv: Object.assign({}, g.inv || {}), cleared: (g.regionsCleared || []).slice(),
    members: (g.party || []).concat(g.reserve || []).map((c) => c.id),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
  const owners = arg('owner') ? arg('owner').split(',') : null;
  const t0 = Date.now();
  const V = require('./validate');
  const L = V.loadTracked({ with: arg('with') ? arg('with').split(',') : null });
  const R = L.R;
  R.warn = () => {};
  const out = await playthrough(R, { events: arg('events') ? arg('events').split(',') : null });
  if (argv.includes('--verbose')) for (const r of out.ran) console.log(`  ${r.id}${r.result === false ? ' (false)' : ''}${r.problems.length ? '  ✗ ' + r.problems.join('; ') : ''}`);
  const lost = out.battles.filter((b) => b.result !== 'win');
  console.log(`battles: ${out.battles.length} simulated, ${lost.length} not won by the model party${lost.length ? ' (' + lost.slice(0, 8).map((b) => `${b.troop}@T${b.tier}:${b.result}`).join(' ') + ')' : ''} — the story goes on as if won; each loss is a WARN below`);
  let errs = out.errors, warns = out.warns;
  if (owners) { errs = errs.filter((e) => owners.includes(e.owner)); warns = warns.filter((e) => owners.includes(e.owner)); }
  for (const w of warns) console.log(`WARN  [${w.owner}] ${w.msg}`);
  for (const e of errs) console.log(`ERROR [${e.owner}] ${e.msg}`);
  console.log(`\nplaythrough: ${out.ran.length} event run(s) in story order, ${out.dryOnly.length} alone; ${errs.length} error(s), ${warns.length} warning(s); ` +
    `game_clear ${out.gameClear ? '✓' : '✗'} pg_clear ${out.pgClear ? '✓' : '✗'} — ${Date.now() - t0} ms`);
  process.exitCode = errs.length ? 1 : 0;
}

module.exports = { playthrough, makeEv };
if (require.main === module) main();
