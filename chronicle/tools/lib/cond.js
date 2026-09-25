// Shared implementation of the condition expressions of DESIGN §3.2.3 (R.State.check) for the
// QA tools (progress.js, playthrough.js, validate.js, the per-owner check_*.js). Same rules as the
// game; the state is read through an adapter so the tools can evaluate conditions against their
// own model of the game (BFS state, a snapshot, or the live R.Game).
//
//   const Cond = require('./lib/cond');
//   Cond.check(cond, S)                  → bool
//   Cond.fromGame(R)                     → adapter over R.Game / R.State (live game)
//   Cond.fromSets({flags, items, vars, cleared, tier, members, recruited, gender, heroType, postgame})
//   Cond.refs(cond)                      → {flags:[], items:[], vars:[], regions:[], members:[], keys:[]}
//   Cond.validate(cond, known?)          → [problem strings] (unknown keys, bad value types, unknown ids)
//   Cond.KEYS                            → every key an object condition may use
//
// Grammar (§3.2.3): 'flag' | '!flag' | [cond…] (all) | {flag, notFlag, item, notItem, all:[…], any:[…],
//   tier, tierBelow, cleared, notCleared, member, recruited, hero, heroType, var, gte, lt, eq, postgame}.
//   Several keys in one object must all hold. null / undefined / true are always true, false never.
'use strict';

const KEYS = ['flag', 'notFlag', 'item', 'notItem', 'all', 'any', 'tier', 'tierBelow', 'cleared', 'notCleared',
  'member', 'recruited', 'hero', 'heroType', 'var', 'gte', 'lt', 'eq', 'postgame'];
const KEYSET = new Set(KEYS);

/** S: { flag(n), item(id), tier(), cleared(r), member(id), recruited(id), gender(), heroType(), getVar(n), postgame() } */
function check(cond, S) {
  if (cond == null || cond === true) return true;
  if (cond === false) return false;
  if (typeof cond === 'string') {
    if (!cond.length) return true;
    return cond[0] === '!' ? !S.flag(cond.slice(1)) : !!S.flag(cond);
  }
  if (Array.isArray(cond)) return cond.every((c) => check(c, S));
  if (typeof cond !== 'object') return !!cond;
  const c = cond;
  if (c.flag != null && !S.flag(c.flag)) return false;
  if (c.notFlag != null && S.flag(c.notFlag)) return false;
  if (c.item != null && !S.item(c.item)) return false;
  if (c.notItem != null && S.item(c.notItem)) return false;
  if (c.all && !c.all.every((x) => check(x, S))) return false;
  if (c.any && !c.any.some((x) => check(x, S))) return false;
  if (c.tier != null && !(S.tier() >= c.tier)) return false;
  if (c.tierBelow != null && !(S.tier() < c.tierBelow)) return false;
  if (c.cleared != null && !S.cleared(c.cleared)) return false;
  if (c.notCleared != null && S.cleared(c.notCleared)) return false;
  if (c.member != null && !S.member(c.member)) return false;
  if (c.recruited != null && !S.recruited(c.recruited)) return false;
  if (c.hero != null && S.gender() !== c.hero) return false;
  if (c.heroType != null && S.heroType() !== c.heroType) return false;
  if (c.var != null) {
    const v = +S.getVar(c.var) || 0;
    if (c.gte != null && !(v >= c.gte)) return false;
    if (c.lt != null && !(v < c.lt)) return false;
    if (c.eq != null && !(v === c.eq)) return false;
    if (c.gte == null && c.lt == null && c.eq == null && !(v > 0)) return false;   // bare {var} = "is set"
  }
  if (c.postgame != null && !!S.postgame() !== !!c.postgame) return false;
  return true;
}

/** adapter over a plain model (Sets / arrays / objects all accepted) */
function fromSets(o) {
  o = o || {};
  const set = (v) => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : Object.keys(v || {}).filter((k) => v[k])));
  const flags = set(o.flags), items = set(o.items), cleared = set(o.cleared);
  const members = set(o.members), recruited = set(o.recruited);
  const vars = o.vars || {};
  const S = {
    flags, items, cleared, members, recruited, vars,
    flag: (n) => flags.has(n) || (n === 'game_clear' && !!S.postgame()) || (/^cleared_/.test(n) && cleared.has(n.slice(8))),
    item: (id) => items.has(id),
    tier: () => (o.tier != null ? (typeof o.tier === 'function' ? o.tier() : o.tier) : cleared.size),
    cleared: (r) => cleared.has(r) || flags.has('cleared_' + r),
    member: (id) => id === 'hero' || members.has(id),
    recruited: (id) => id === 'hero' || recruited.has(id) || members.has(id) || flags.has('joined_' + id),
    gender: () => o.gender || 'm',
    heroType: () => o.heroType || 'warrior',
    getVar: (n) => (vars instanceof Map ? vars.get(n) : vars[n]) || 0,
    postgame: () => (typeof o.postgame === 'function' ? o.postgame() : !!o.postgame || flags.has('game_clear')),
  };
  return S;
}

/** adapter over the live game (R.Game / R.State); tolerant of a partial R.State */
function fromGame(R) {
  const G = () => R.Game || {};
  const St = R.State || {};
  const all = () => (G().party || []).concat(G().reserve || []);
  return {
    flag: (n) => (St.flag ? !!St.flag(n) : !!(G().flags || {})[n]),
    item: (id) => {
      if (St.hasItem) { try { return !!St.hasItem(id); } catch (e) { /* fall through */ } }
      if ((G().inv || {})[id] > 0) return true;
      return all().some((c) => c && c.equip && Object.values(c.equip).includes(id));
    },
    tier: () => (G().regionsCleared ? G().regionsCleared.length : G().tier || 0),
    cleared: (r) => (G().regionsCleared || []).includes(r) || !!(G().flags || {})['cleared_' + r],
    member: (id) => (G().party || []).some((c) => c && c.id === id),
    recruited: (id) => all().some((c) => c && c.id === id),
    gender: () => { const h = (G().party || []).concat(G().reserve || []).find((c) => c && c.id === 'hero'); return h ? h.gender : 'm'; },
    heroType: () => { const h = all().find((c) => c && c.id === 'hero'); return h ? h.heroType : null; },
    getVar: (n) => (St.getVar ? St.getVar(n) : (G().vars || {})[n]) || 0,
    postgame: () => !!G().gameClear || !!(G().flags || {}).game_clear,
  };
}

/** every id a condition refers to (for dependency analysis / validation) */
function refs(cond, out) {
  out = out || { flags: [], items: [], vars: [], regions: [], members: [], heroTypes: [], keys: [] };
  const add = (k, v) => { if (v != null && !out[k].includes(v)) out[k].push(v); };
  (function walk(c) {
    if (c == null || c === true || c === false) return;
    if (typeof c === 'string') { add('flags', c[0] === '!' ? c.slice(1) : c); return; }
    if (Array.isArray(c)) { c.forEach(walk); return; }
    if (typeof c !== 'object') return;
    for (const k of Object.keys(c)) add('keys', k);
    add('flags', c.flag); add('flags', c.notFlag);
    add('items', c.item); add('items', c.notItem);
    add('regions', c.cleared); add('regions', c.notCleared);
    add('members', c.member); add('members', c.recruited);
    add('vars', c.var); add('heroTypes', c.heroType);
    (c.all || []).forEach(walk); (c.any || []).forEach(walk);
  })(cond);
  return out;
}

/** structural problems of a condition. known = {items, regions, companions, heroTypes} (objects keyed by id), optional */
function validate(cond, known) {
  known = known || {};
  const probs = [];
  (function walk(c, where) {
    if (c == null || c === true || c === false) return;
    if (typeof c === 'string') { if (!/^!?[A-Za-z0-9_]+$/.test(c)) probs.push(`${where}: odd flag name ${JSON.stringify(c)}`); return; }
    if (Array.isArray(c)) { c.forEach((x, i) => walk(x, `${where}[${i}]`)); return; }
    if (typeof c !== 'object') { probs.push(`${where}: condition of type ${typeof c}`); return; }
    for (const k of Object.keys(c)) if (!KEYSET.has(k)) probs.push(`${where}: unknown condition key '${k}'`);
    for (const k of ['tier', 'tierBelow', 'gte', 'lt', 'eq']) if (c[k] != null && typeof c[k] !== 'number') probs.push(`${where}: ${k} must be a number`);
    if ((c.gte != null || c.lt != null || c.eq != null) && c.var == null) probs.push(`${where}: gte/lt/eq without var`);
    if (c.hero != null && c.hero !== 'm' && c.hero !== 'f') probs.push(`${where}: hero must be 'm' or 'f'`);
    if (c.postgame != null && typeof c.postgame !== 'boolean') probs.push(`${where}: postgame must be true/false`);
    for (const k of ['all', 'any']) if (c[k] != null && !Array.isArray(c[k])) probs.push(`${where}: ${k} must be an array`);
    const chk = (k, reg, what) => { if (c[k] != null && reg && !reg[c[k]]) probs.push(`${where}: ${k} → unknown ${what} '${c[k]}'`); };
    chk('item', known.items, 'item'); chk('notItem', known.items, 'item');
    chk('cleared', known.regions, 'region'); chk('notCleared', known.regions, 'region');
    chk('member', known.companions, 'companion'); chk('recruited', known.companions, 'companion');
    chk('heroType', known.heroTypes, 'hero type');
    (c.all || []).forEach((x, i) => walk(x, `${where}.all[${i}]`));
    (c.any || []).forEach((x, i) => walk(x, `${where}.any[${i}]`));
  })(cond, 'cond');
  return probs;
}

module.exports = { check, fromSets, fromGame, refs, validate, KEYS };
