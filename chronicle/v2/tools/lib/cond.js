// 条件式 Cond の node の道具（EVENTS。V2_PLAN §2.5.10）。ゲームの R.State.check と**同じ関数**を読む:
// v2/src/systems/state.js を小さな箱（vm）で読み、R.State.checkIn(G, cond, {DB}) をそのまま使う（書き写さない）。
//
//   const Cond = require('./lib/cond');
//   Cond.check(cond, G, {DB?})          → bool   G は R.Game の形（無い項目は空として読む）。DB は leads（手がかりの done）と config（slice）
//   Cond.fromSets({flags, items, vars, cleared, tier, leads, done, choices, heard, guest, party, joined, visited, sex}) → G
//                                                  QA の模型（BFS の状態など）を G の形にする。Set・配列・物のどれでもよい
//   Cond.refs(cond)                      → {flags, items, vars, regions, leads, choices, heard, looks, maps, members}
//   Cond.validate(cond, known?)          → [問題の文]（知らない鍵・形の誤り。known = {flags?, items?, leads?, …} の Set/配列で知らない id も）
//   Cond.KEYS                            → 物の条件に書ける鍵
//   Cond.fromGame(R)                     → R.Game（ブラウザ・load.js の R）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.resolve(__dirname, '..', '..', 'src', 'systems', 'state.js');
let S = null;
function state() {
  if (S) return S;
  const warns = [];
  const R = { DB: { config: {}, leads: {}, items: {} }, Stubs: null, warn: (...a) => warns.push(a.join(' ')), emit() {}, loadErrors: [] };
  vm.runInNewContext(fs.readFileSync(SRC, 'utf8'), { window: { RPG: R }, console, JSON, Math, Object, Array, String, Number, Date }, { filename: SRC });
  S = { State: R.State, R, warns };
  return S;
}

function asMap(v) {
  if (v == null) return {};
  if (v instanceof Set) { const o = {}; for (const k of v) o[k] = true; return o; }
  if (Array.isArray(v)) { const o = {}; for (const k of v) o[k] = true; return o; }
  return v;
}
function asNum(v) {
  if (v == null) return {};
  if (v instanceof Set || Array.isArray(v)) { const o = {}; for (const k of v) o[k] = 1; return o; }
  return v;
}

function fromSets(o) {
  o = o || {};
  const leads = {};
  for (const id of Object.keys(asMap(o.leads))) leads[id] = { got: 0, pin: false, seen: true };
  for (const id of Object.keys(asMap(o.done))) leads[id] = Object.assign(leads[id] || { got: 0, pin: false, seen: true }, { done: true });
  const cleared = asMap(o.cleared);
  const party = Array.isArray(o.party) ? o.party : o.party instanceof Set ? [...o.party] : Object.keys(o.party || {});
  const joined = Array.isArray(o.joined) ? o.joined : o.joined instanceof Set ? [...o.joined] : Object.keys(o.joined || {});
  const G = {
    flags: asMap(o.flags), items: asNum(o.items), vars: Object.assign({}, o.vars || {}), cleared,
    tier: o.tier != null ? o.tier : Object.keys(cleared).filter((k) => cleared[k]).length,
    leads, choices: Object.assign({}, o.choices || {}), heard: asMap(o.heard),
    guest: o.guest ? (typeof o.guest === 'string' ? { id: o.guest, look: o.guest } : o.guest) : null,
    party: party.length ? party : ['hero'], joined: joined.length ? joined : ['hero'], visited: asMap(o.visited),
    chars: { hero: { id: 'hero', look: 'hero_' + (o.sex || 'm') + '_warrior', sex: o.sex || 'm', equip: {} } }, hero: 'hero',
  };
  return G;
}

function check(cond, G, env) {
  const s = state();
  env = env || {};
  const DB = env.DB || { config: { slice: env.slice != null ? env.slice : true }, leads: env.leads || {} };
  return s.State.checkIn(G || {}, cond, { DB, warn: env.warn || (() => {}) });
}

function refs(cond) { return state().State.condRefs(cond); }

function validate(cond, known) {
  const out = state().State.condProblems(cond);
  if (known) {
    const r = refs(cond);
    const has = (set, id) => (set instanceof Set ? set.has(id) : Array.isArray(set) ? set.includes(id) : !!(set && set[id]));
    for (const [k, list] of Object.entries(r)) {
      if (!known[k]) continue;
      for (const id of list) if (!has(known[k], id)) out.push(`unknown ${k.replace(/s$/, '')} '${id}'`);
    }
  }
  return out;
}

function fromGame(R) { return R.Game; }

module.exports = {
  check, fromSets, refs, validate, fromGame,
  get KEYS() { return state().State.COND_KEYS.slice(); },
  _state: state,
};
