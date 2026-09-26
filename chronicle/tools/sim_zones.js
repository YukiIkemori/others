#!/usr/bin/env node
// tools/sim_zones.js — A11 mons: difficulty of every encounter zone × tier (DESIGN.md §9.13.1, criteria M1–M5).
//
//   node tools/sim_zones.js                      all zones, T0..8 (fixed-tier zones at their tier), 200 battles per group
//   node tools/sim_zones.js --n 60               fewer battles per group (quick look)
//   node tools/sim_zones.js --zone zw_snow       one zone   (--tier 4 for one tier, --tiers 0,4,8 for a few)
//   node tools/sim_zones.js --only M1,M4         run a subset of the criteria
//   node tools/sim_zones.js --engine model|real  force the built-in model / the game engine (default: auto)
//   node tools/sim_zones.js --groups             print every group's numbers (worst first)
//   node tools/sim_zones.js --json out.json      write all numbers (M1 includes every group's result)
//   node tools/sim_zones.js --species [--fit out.json]   species danger; --fit writes a candidate overlay (see below)
//   node tools/sim_zones.js --refit all.json --fit out.json   zone-context correction of s from a --json run
//   node tools/sim_zones.js --tuning cand.json   run on DESIGN ⊕ a candidate overlay (in memory)
//
// Criteria (§9.13.1; party = §4.17.1 standard party, auto battle, mob fights start with MP/WP 60%, HP full):
//   M1 win ≥ 99.5%, rounds 2.5–3.5, HP lost per battle (share of the party's max HP) mean 8–12% overall and 5–15% in
//      every zone×tier, p95 ≤ 20%, battles where someone falls ≤ 3%, wipes ≤ 0.1%
//   M2 order independence: per zone, T0..T7 rounds / HP lost / win within ±15% of their mean
//   M3 physical-only and magic-only parties: M1 win rate ≥ 98% in every zone×tier
//   M4 the hero alone (Lv1–3, starting gear) in zw_prologue: win ≥ 97%
//   M5 static group rules (§9.7.2): average strength 3.0–3.4, every group 2.2–4.8, ≥4 groups per tier, ≤3 species,
//      ≤8 bodies, ≤256 px
// "HP lost" = damage the party took in the battle (each hit capped by the HP the target had) over Σ max HP — the same
// measure as the engine's simulate().hpLossPct and qa's party_model runBattle().hpLostPct (sim_balance A2). The net
// loss (HP missing at the end, after in-battle healing) is printed alongside. Per zone×tier: win ≥ 99.5%, mean 5–15%, wipes ≤ 0.1% (hard); rounds / p95 / falls are shown
// per zone as warnings and checked on the pooled battles of all mid, finale and postgame zones (each zone×tier weighs 1).
//
// Engine: when the game engine is complete (R.Mon.def + R.Battle.simulate + R.BattleAI + R.Rules.stats and
// qa's tools/lib/party_model.js), `--engine auto` uses it; otherwise it falls back to the MODEL below — a
// compact re-implementation of DESIGN §4.4–§4.8, §4.13, §4.14, §9.1.2 used only for balancing the tables.
// The report always says which one produced the numbers. Seeds are fixed (R.U.seed), so runs are reproducible.
'use strict';
const fs = require('fs');
const path = require('path');
const CM = require('./check_mons');

// ---------------------------------------------------------------- CLI
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = (k) => argv.includes('--' + k);
const N = Number(opt('n', 200));
const ONLY = (opt('only', 'M1,M2,M3,M4,M5')).split(',');
const ZONE = opt('zone', null);
const TIER = opt('tier', null) == null ? null : Number(opt('tier'));
const TIERS = opt('tiers', null) ? opt('tiers').split(',').map(Number) : null;   // e.g. --tiers 0,4,8 (quick look)
const ENGINE = opt('engine', 'auto');
const SEED = Number(opt('seed', 20260925));

const R = require('./lib/load')({ quiet: true });
const DB = R.DB;
const U = R.U;
// --design: run on the untuned DESIGN §9 values (s, groups) instead of src/data (DESIGN ⊕ tuning.json), for comparison
// --tuning <file>: run on DESIGN ⊕ that overlay (a candidate tuning.json), applied in memory — src/data is not touched
function applyOverlay(E) {
  for (const [id, m] of Object.entries(E.mons)) if (DB.monsters[id]) DB.monsters[id].s = JSON.parse(JSON.stringify(m.s || {}));
  for (const [z, e] of Object.entries(E.encounters)) if (DB.encounters[z]) DB.encounters[z].groups = JSON.parse(JSON.stringify(e.groups));
  if (R.Mon && R.Mon.clearCache) R.Mon.clearCache();
  if (R.Mon && R.Mon.fillStats) for (const id of Object.keys(E.mons)) {
    const m = DB.monsters[id];
    for (const k of ['hp', 'atk', 'mag', 'def', 'mdef', 'agi', 'exp', 'gold', 'eva', 'hit', 'crit', '_lv', '_filled']) delete m[k];
    try { R.Mon.fillStats(m, id); } catch (e) { /* fillStats signature may differ */ }
  }
}
if (flag('design')) applyOverlay(CM.parseDesign());
else if (opt('tuning', null)) { process.env.MONS_TUNING = opt('tuning'); applyOverlay(CM.expected()); console.log('[sim_zones] overlay ' + opt('tuning') + ' applied in memory'); }

// ================================================================ constants (DESIGN §4 — model only)
const K = {
  STAGE: [0.63, 0.77, 1, 1.3, 1.6], MOB: { atk: 0.6, mag: 0.6 },
  SIZE: { s: { hp: 0.7, atk: 0.9, def: 0.9 }, m: { hp: 1, atk: 1, def: 1 }, l: { hp: 2.0, atk: 1.15, def: 1.1 } },
  W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112], U: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6],
  EXPECT: [2, 4, 6, 8, 10, 12, 14, 16, 17, 19],
  GH: { S: 1.25, A: 1.12, B: 1.0, C: 0.9, D: 0.8 }, GM: { S: 1.3, A: 1.15, B: 1.0, C: 0.8, D: 0.6 },
  WT: { sword: [1.0, 0, 2, 'slash'], greatsword: [1.4, -5, 2, 'slash'], dagger: [0.75, 8, 10, 'pierce'], axe: [1.15, -10, 4, 'slash'],
    spear: [1.25, 0, 2, 'pierce'], bow: [1.1, 5, 4, 'pierce'], club: [1.05, 0, 2, 'blunt'], staff: [0.6, 0, 0, 'blunt'],
    katana: [1.05, 0, 10, 'slash'], fist: [0.9, 5, 5, 'blunt'], whip: [0.8, 0, 2, 'blunt'] },
  REACH: ['spear', 'bow', 'whip'],
  TIMED: { sleep: [2, 4], paralyze: [1, 3], freeze: [1, 2], stun: [1, 1], confuse: [2, 4], silence: [3, 5], blind: [3, 5], burn: [3, 3], regen: [5, 5], veil: [3, 3] },
  DISABLE: ['sleep', 'paralyze', 'freeze', 'stun'],
};
const LZ = (T) => 6 + 6 * T;
const DKf = (L) => 40 + 5 * L;
const D = (T) => 70 + 30 * T;
function curve(L) {
  const atk = 4 + 3.15 * Math.pow(Math.max(0, L - 1), 0.9);
  return { hp: 6 + 2.6 * L + 0.1 * L * L, atk, mag: 0.85 * atk, def: 20 + 2.5 * L, mdef: 20 + 2.5 * L, agi: 24 + 0.6 * L };
}
const HPlv = (L) => 17.5 + 14.7 * Math.pow(L - 1, 0.9);
const MPlv = (L) => 8 + 2.6 * Math.pow(L - 1, 0.85);
const WPlv = (L) => 5 + 1.8 * Math.pow(L - 1, 0.85);
const gearStat = (T, units) => Math.max(1, Math.round(units * K.U[T]));
const stageMul = (s) => K.STAGE[(s | 0) + 2];

// ================================================================ MODEL: party (§4.17.1 standard party)
// Types from §4.2.1. Gear = tier-T normal set, stat units to the type's stats (§4.3.3), levels LZ(T)+1.
const TYPES = {
  warrior: { str: 50, vit: 44, dex: 30, agi: 28, int: 18, mnd: 30, g: { hp: 'A', mp: 'C', wp: 'A' } },
  mage: { str: 18, vit: 24, dex: 30, agi: 34, int: 52, mnd: 42, g: { hp: 'C', mp: 'A', wp: 'C' } },
  hunter: { str: 26, vit: 30, dex: 55, agi: 44, int: 20, mnd: 25, g: { hp: 'B', mp: 'C', wp: 'B' } },
};
// Known actions at tier T: those a mob fight of tier T can have taught (glim.lv ≤ rank T+1, §4.9.3/§9.2.3), lowest
// glim.lv first, at most EXPECT(T) (§4.17.1). Spells also need the element proficiency, approximated by the same cap.
function techsFor(wtype, T, n) {
  return Object.entries(DB.actions).filter(([, a]) => a.kind === 'tech' && a.wtype === wtype && a.glim && a.glim.lv <= T + 1)
    .sort((a, b) => a[1].glim.lv - b[1].glim.lv).slice(0, n == null ? K.EXPECT[T] : n).map(([id]) => id);
}
function spellsFor(els, T, n) {
  return Object.entries(DB.actions).filter(([, a]) => a.kind === 'spell' && a.glim && a.glim.lv <= T + 1 && (a.elements || []).every((e) => els.includes(e)))
    .sort((a, b) => a[1].glim.lv - b[1].glim.lv || (a[1].order || 0) - (b[1].order || 0)).slice(0, n == null ? K.EXPECT[T] : n).map(([id]) => id);
}
/** 12-unit normal set of tier T (weapon1 2, weapon2 2, shield 1, head 1, body 2, hands 1, feet 1, acc 1+1; §4.3.1 "全身") */
const F12 = (T) => 2 * gearStat(T, 2) + gearStat(T, 1) * 6 + gearStat(T, 2);
/** kind: 'sword'|'spear'|'axe'|'bow'|'mage'. Mirrors the §4.17.2 reference numbers: every stat unit of the tier-T normal
 *  set on the type's main stat (腕力 / 知力 / 器用さ), and max HP as in that table (体力 = base + half the set). */
function member(name, kind, row, T, L, extra) {
  const isMage = kind === 'mage';
  const type = isMage ? TYPES.mage : kind === 'bow' ? TYPES.hunter : TYPES.warrior;
  const wtype = isMage ? 'staff' : kind;
  const st = Object.assign({}, type);
  const twoH = ['spear', 'bow', 'greatsword'].includes(wtype);
  const F = F12(T);
  if (isMage) { st.int += F; } else if (kind === 'bow') { st.dex += F; st.vit += Math.round(F / 2); } else { st.str += F; st.vit += Math.round(F / 2); }
  const weight = isMage ? 'cloth' : kind === 'bow' ? 'light' : 'heavy';
  const WGT = { heavy: [1, 0.2, 8], light: [0.65, 0.35, 5], cloth: [0.4, 0.6, 2] }[weight];
  const shield = !twoH; // mages carry a book (cloth shield)
  const share = shield ? 1.0 : 0.8;
  const def = Math.round(D(T) * share * WGT[0]);
  const mdef = Math.round(D(T) * share * WGT[1]) + Math.floor(st.mnd / 2);
  const [mult, hitAdd, critAdd, pkind] = K.WT[wtype];
  const S = { sword: st.str, axe: st.str, club: st.str, greatsword: st.str, katana: (st.str + st.dex) / 2, spear: (st.str + st.dex) / 2, bow: st.dex, staff: (st.str + st.int) / 2 }[wtype];
  const W = Math.round(K.W[T] * mult);
  const atk = Math.round(W * (64 + S) / 64);
  const Wm = isMage ? K.W[T] : Math.round(K.W[T] * 0.5);
  const mag = Math.round(Wm * (64 + st.int) / 64);
  const mhp = Math.min(999, Math.round(HPlv(L) * K.GH[type.g.hp] * (160 + st.vit) / 200));
  const mmp = Math.min(150, Math.round(MPlv(L) * K.GM[type.g.mp]));
  const mwp = Math.min(99, Math.round(WPlv(L) * K.GM[type.g.wp]));
  const els = (extra && extra.els) || (isMage ? ['light', 'water'] : []);
  const u = {
    side: 'party', name, kind, row, wtype, pkind, reach: K.REACH.includes(wtype),
    mhp, hp: mhp, mmp, mp: Math.ceil(mmp * 0.6), mwp, wp: Math.ceil(mwp * 0.6),
    atk, mag, def, mdef, hit: 90 + Math.floor(st.dex / 4) + hitAdd, crit: 2 + Math.floor(st.dex / 16) + critAdd,
    eva: Math.min(60, Math.floor(st.agi / 5) + (shield ? WGT[2] : 0)), spd: st.agi, mnd: st.mnd, int: st.int, dex: st.dex,
    spells: isMage ? spellsFor(els, T) : [],
    status: {}, buffs: {}, alive: true, acts: 0, isMage,
  };
  u.techs = techsFor(wtype, T, Math.max(0, K.EXPECT[T] - u.spells.length));
  delete (extra || {}).els;
  return Object.assign(u, extra || {});
}
function standardParty(T, L) {
  return [member('戦士（剣）', 'sword', 'front', T, L), member('戦士（槍）', 'spear', 'front', T, L),
    member('術師', 'mage', 'middle', T, L), member('狩人', 'bow', 'middle', T, L)];
}
function physParty(T, L) {
  return [member('剣', 'sword', 'front', T, L), member('斧', 'axe', 'front', T, L), member('槍', 'spear', 'middle', T, L), member('弓', 'bow', 'middle', T, L)];
}
function magicParty(T, L) {
  return [member('術師（火風）', 'mage', 'front', T, L, { els: ['fire', 'wind'] }), member('術師（土闇）', 'mage', 'front', T, L, { els: ['earth', 'dark'] }),
    member('術師（光水）', 'mage', 'middle', T, L, { els: ['light', 'water'] }), member('術師（水風）', 'mage', 'middle', T, L, { els: ['water', 'wind'] })];
}
function prologueHero(L) {
  // the default hero (DB.config.defaultHero: warrior with a sword) at Lv L with the tier-0 starting set (§5.1.4)
  const ht = (DB.heroTypes || {}).warrior;
  const h = member('主人公', 'sword', 'front', 0, L);
  if (ht) {
    const st = Object.assign({}, ht.stats);
    let def = 0, mdef = 0, eva = 0;
    for (const id of Object.values(ht.startEquip || {})) {
      const it = (DB.items || {})[id];
      if (!it) continue;
      for (const [k, v] of Object.entries(it.stats || {})) st[k] = (st[k] || 0) + v;
      def += it.def || 0; mdef += it.mdef || 0; eva += it.eva || 0;
    }
    const w = (DB.items || {})[ht.defaultWeapon];
    if (w) for (const [k, v] of Object.entries(w.stats || {})) st[k] = (st[k] || 0) + v;
    const W = w && w.atk ? w.atk : K.W[0];
    h.atk = Math.round(W * (64 + st.str) / 64);
    h.def = def || h.def; h.mdef = (mdef || 0) + Math.floor(st.mnd / 2); h.eva = Math.floor(st.agi / 5) + eva;
    h.hit = 90 + Math.floor(st.dex / 4); h.crit = 2 + Math.floor(st.dex / 16) + 2; h.spd = st.agi; h.mnd = st.mnd;
    h.mhp = h.hp = Math.round(HPlv(L) * K.GH[ht.growth.hp] * (160 + st.vit) / 200);
    h.techs = []; // the hero knows 1 entry tech at most; keep the model to plain attacks
  }
  h.mp = h.mmp; h.wp = h.mwp; // the prologue starts rested
  return [h];
}
function inventory() { return { potion: 6, revive: 3, ether: 3 }; } // §4.17.1: 回復 35% ×6、蘇生 ×3、MP 30% ×3

// ================================================================ MODEL: monsters (§9.1.2, §4.14.2)
function monUnit(id, Lb, key) {
  const d = DB.monsters[id];
  const c = curve(Lb);
  const s = Object.assign({ hp: 1, atk: 1, mag: 1, def: 1, mdef: 1, agi: 1 }, d.s || {});
  const SZ = K.SIZE[d.size] || K.SIZE.m;
  const flags = d.flags || [];
  const metal = flags.includes('metal');
  const mob = !metal && !flags.includes('boss') && !flags.includes('rare');
  const mhp = metal ? d.hpFixed : Math.max(1, Math.round(c.hp * SZ.hp * s.hp));
  return {
    side: 'mon', id, key, name: d.name, d, flags, metal, lineage: d.lineage, stage: d.stage,
    mhp, hp: mhp, atk: Math.round(c.atk * SZ.atk * s.atk * (mob ? K.MOB.atk : 1)), mag: Math.round(c.mag * s.mag * (mob ? K.MOB.mag : 1)),
    def: Math.round(c.def * SZ.def * s.def), mdef: Math.round(c.mdef * s.mdef), spd: Math.round(c.agi * s.agi),
    eva: d.eva != null ? d.eva : CM.evaRule(d), hit: 95, crit: 2, elem: d.elem || {}, phys: d.phys || {}, statusRes: d.statusRes || {},
    status: {}, buffs: {}, alive: true, acts: 0, used: {}, fleeRate: d.fleeRate || (metal ? 0.5 : 0),
    actsPerTurn: Math.max(1, Math.min(3, d.actsPerTurn || 1)),
  };
}

// ================================================================ MODEL: battle
function Battle(party, monIds, Lb, opts) {
  this.party = party; this.Lb = Lb; this.DK = DKf(Lb); this.round = 0; this.result = null; this.opts = opts || {};
  this.mons = monIds.map((id, i) => monUnit(id, Lb, i));
  this.inv = inventory();
  this.taken = 0; this.fell = 0; this.casts = 0; this.mpUsed = 0; this.wpUsed = 0; this.baitDone = new Set();
}
const P = Battle.prototype;
P.alive = function (side) { return (side === 'party' ? this.party : this.mons).filter((u) => u.alive && !u.gone); };
P.frontAlive = function () { return this.party.some((u) => u.alive && u.row === 'front'); };
P.effRow = function (u) { return this.frontAlive() ? u.row : 'front'; };
P.canAct = function (u) { return u.alive && !u.gone && !K.DISABLE.some((s) => u.status[s]); };
P.elemMult = function (t, el) { if (!el) return 1; if (t.side === 'mon') return t.elem[el] != null ? t.elem[el] : 1; return 1; };
P.bestElem = function (t, els) { let b = null, v = -9; for (const e of els) { const m = this.elemMult(t, e); if (m > v) { v = m; b = e; } } return b; };

/** expected (expect=true: mean × hit chance, like ctx.expect) or rolled damage of effect f from a to t (§4.6) */
P.roll = function (a, t, f, act, expect) {
  const el = f.element || (act && act.elements ? this.bestElem(t, act.elements) : null);
  const formula = f.formula || 'phys';
  if (t.metal) { // §4.10.5: 1 per hit (2 on a crit); only phys connects
    if (formula !== 'phys') return { dmg: 0, hitP: 1 };
    let hitP = Math.max(0.2, Math.min(1, (a.hit * (f.acc || 1) - t.eva) / 100)) * (a.status.blind ? 0.5 : 1);
    if (f.sure) hitP = 1;
    return { dmg: expect ? hitP * (f.hits || 1) : (U.r() * 100 < a.crit ? 2 : 1), hitP };
  }
  const em = this.elemMult(t, el);
  let dmg = 0, hitP = 1, crit = false;
  if (formula === 'phys') {
    const kind = f.kind || (a.side === 'party' ? a.pkind : null);
    hitP = Math.max(0.2, Math.min(1, (a.hit * (f.acc || 1) - t.eva) / 100));
    if (a.status.blind) hitP *= 0.5;
    if (K.DISABLE.some((s) => t.status[s]) || f.sure) hitP = 1;
    const critP = Math.min(0.6, (a.crit + (f.critBonus || 0)) / 100);
    const guardN = this.DK / (this.DK + t.def * (1 - (f.ignoreDef || 0)));
    const kindM = t.side === 'mon' && kind && t.phys[kind] != null ? t.phys[kind] : 1;
    let vs = 1;
    if (f.vs && t.side === 'mon') for (const [k, v] of Object.entries(f.vs)) if (t.d.race === k || t.flags.includes(k) || t.status[k]) vs = Math.max(vs, v);
    const row = t.side === 'party' && this.effRow(t) === 'middle' ? 0.7 : 1;
    const base = a.atk * (f.power || 1) * kindM * em * vs * row * stageMul(a.buffs.atk) / stageMul(t.buffs.def);
    if (expect) dmg = base * ((1 - critP) * guardN + critP * 1.5);
    else { crit = U.r() < critP; dmg = base * (crit ? 1.5 : guardN) * U.rf(0.9, 1.1); }
  } else if (formula === 'magic') {
    dmg = a.mag * f.power * this.DK / (this.DK + t.mdef * (1 - (f.ignoreMdef || 0))) * em * stageMul(a.buffs.mag) / stageMul(t.buffs.mdef);
    if (!expect) dmg *= U.rf(0.95, 1.05);
  } else if (formula === 'breath') {
    dmg = a.atk * f.power * em;
    if (!expect) dmg *= U.rf(0.9, 1.1);
  }
  if (t.defending) dmg *= 0.5;
  if (expect) return { dmg: dmg * hitP, hitP, el };
  dmg = em === 0 ? 0 : em < 0 ? Math.round(dmg) : Math.max(1, Math.round(dmg));
  return { dmg, hitP, crit, el };
};

P.applyDamage = function (a, t, f, act) {
  const hits = f.hits || 1;
  let total = 0;
  for (let h = 0; h < hits; h++) {
    if (!t.alive) break;
    const r = this.roll(a, t, f, act, false);
    if ((f.formula || 'phys') === 'phys' && U.r() >= r.hitP) continue;
    let dmg = r.dmg;
    if (dmg < 0) { t.hp = Math.min(t.mhp, t.hp - dmg); continue; }
    if (f.mp && t.side === 'party') { const m = Math.min(t.mp, dmg); t.mp -= m; if (f.drain) a.hp = Math.min(a.mhp, a.hp + m); continue; }
    const real = Math.min(t.hp, dmg);
    t.hp -= real; total += real;
    if (t.side === 'party') this.taken += real;
    if (f.drain && a.alive) a.hp = Math.min(a.mhp, a.hp + Math.round(real * f.drain));
    if (r.el === 'fire' && t.status.freeze) delete t.status.freeze;
    if (t.status.sleep && U.r() < 0.5) delete t.status.sleep;
    if (t.status.confuse && (f.formula || 'phys') === 'phys' && U.r() < 0.5) delete t.status.confuse;
    if (t.hp <= 0) { this.die(t); break; }
  }
  return total;
};
P.die = function (t) {
  t.hp = 0; t.alive = false; t.status = {}; t.buffs = {};
  if (t.side === 'party') this.fell++;
};
P.resist = function (t, s) {
  if (t.side === 'party') return Math.min(0.9, t.mnd / 500);
  if (t.metal && (BADS.includes(s) || s === 'death')) return 1;
  return t.statusRes[s] || 0;
};
const BADS = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind'];
P.inflict = function (a, t, s, chance) {
  if (!t.alive) return false;
  const bad = BADS.includes(s) || s === 'death';
  if (bad && t.status.veil) return false;
  if (bad) {
    const SF = a.side === 'party' ? Math.max(0.6, Math.min(2, (128 + (a.isMage ? a.int : a.dex)) / 168)) : 1;
    const p = Math.min(0.95, (chance == null ? 1 : chance) * SF * (1 - this.resist(t, s)));
    if (U.r() >= p) return false;
  }
  if (s === 'death') { if (t.side === 'party') this.taken += t.hp; this.die(t); return true; }
  if (t.status[s]) return false;
  if (K.DISABLE.includes(s)) for (const x of K.DISABLE) delete t.status[x];
  if (s === 'freeze') delete t.status.burn;
  if (s === 'burn') delete t.status.freeze;
  const tm = K.TIMED[s];
  t.status[s] = tm ? U.ri(tm[0], tm[1]) : 99;
  return true;
};
P.buff = function (t, stat, stages, chance) {
  if (!t.alive) return;
  if (stages < 0) {
    if (t.status.veil || t.metal) return;
    if (chance != null && U.r() >= chance) return;
  }
  t.buffs[stat] = Math.max(-2, Math.min(2, (t.buffs[stat] || 0) + stages));
};

// ---------------- targets
P.pickParty = function (aim) {
  const al = this.alive('party');
  if (!al.length) return null;
  if (aim === 'low') return al.slice().sort((x, y) => x.hp / x.mhp - y.hp / y.mhp)[0];
  const w = al.map((u) => { const row = this.effRow(u); return aim === 'middle' ? (row === 'middle' ? 3 : 1) : (row === 'front' ? 2 : 1); });
  let x = U.r() * w.reduce((s, v) => s + v, 0);
  for (let i = 0; i < al.length; i++) { x -= w[i]; if (x < 0) return al[i]; }
  return al[al.length - 1];
};
P.foesOf = function (u) { return u.side === 'party' ? this.alive('mon') : this.alive('party'); };
P.friendsOf = function (u) { return u.side === 'party' ? this.alive('party') : this.alive('mon'); };

// ---------------- actions
P.useAction = function (u, id, target) {
  const act = id === 'attack' ? null : DB.actions[id];
  if (!act) { // plain attack
    const t = target && target.alive ? target : (u.side === 'party' ? this.focusFallback(u) : this.pickParty());
    if (t) this.applyDamage(u, t, { type: 'damage', formula: 'phys', power: 1 }, null);
    return;
  }
  if (u.side === 'party') {
    if (act.mp) { u.mp -= act.mp; this.mpUsed += act.mp; this.casts++; }
    if (act.wp) { u.wp -= act.wp; this.wpUsed += act.wp; }
  }
  u.used && (u.used[id] = true);
  let tg;
  switch (act.target) {
    case 'enemy': tg = [target && target.alive ? target : (u.side === 'party' ? this.focusFallback(u) : this.pickParty(act.aim))]; break;
    case 'group': { const t0 = target && target.alive ? target : this.focusFallback(u); tg = this.alive('mon').filter((m) => t0 && m.id === t0.id); break; }
    case 'enemies': tg = this.foesOf(u); break;
    case 'random': tg = null; break;
    case 'self': tg = [u]; break;
    case 'ally': tg = [target && target.alive ? target : this.friendsOf(u).slice().sort((x, y) => x.hp / x.mhp - y.hp / y.mhp)[0]]; break;
    case 'allies': tg = this.friendsOf(u); break;
    case 'ally_dead': tg = [target && !target.alive && !target.gone ? target : (u.side === 'party' ? this.party : this.mons).find((x) => !x.alive && !x.gone)]; break;
    default: tg = [];
  }
  if (act.target === 'random') {
    const f0 = act.effects.find((f) => f.type === 'damage');
    const hits = (f0 && f0.hits) || 1;
    for (let h = 0; h < hits; h++) {
      const foes = this.foesOf(u); if (!foes.length) break;
      const t = u.side === 'party' ? U.pick(foes) : this.pickParty(act.aim);
      for (const f of act.effects) this.effect(u, t, Object.assign({}, f, { hits: 1 }), act);
    }
    return;
  }
  for (const t of tg.filter(Boolean)) for (const f of act.effects) { if (!t.alive && f.type !== 'revive') break; this.effect(u, t, f, act); }
};
P.effect = function (u, t, f, act) {
  switch (f.type) {
    case 'damage': this.applyDamage(u, t, f, act); break;
    case 'status': this.inflict(u, t, f.status, f.chance); break;
    case 'buff': this.buff(t, f.stat, f.stages, f.chance); break;
    case 'heal': { if (!t.alive) break; const mndf = u.side === 'party' ? Math.max(0.75, Math.min(2.2, (128 + u.mnd) / 168)) : 1; t.hp = Math.min(t.mhp, t.hp + Math.round(t.mhp * f.pct * mndf)); break; }
    case 'revive': if (!t.alive && !t.gone) { t.alive = true; t.hp = Math.max(1, Math.round(t.mhp * f.pct)); } break;
    case 'cure': for (const s of BADS) delete t.status[s]; break;
    case 'dispel': for (const k of Object.keys(t.buffs)) if (t.buffs[k] > 0) delete t.buffs[k]; for (const s of ['regen', 'veil', 'counter', 'cover', 'nimble']) delete t.status[s]; break;
    case 'summon': this.summon(u, f); break;
    default: break;
  }
};
P.summon = function (u, f) {
  const living = this.alive('mon').length;
  if (living >= (f.max || 8) || this.mons.filter((m) => !m.gone && m.alive).length >= 8) return;
  let id = f.mon;
  if (id === 'same') id = u.id;
  else if (id === 'lower') { const L = DB.lineages[u.lineage]; id = L && u.stage > 1 ? L.stages[u.stage - 2].mon : u.id; }
  else if (id[0] === '@') id = CM.resolveRef(DB, id, this.opts.T || 0);
  for (let i = 0; i < (f.n || 1); i++) {
    if (this.alive('mon').length >= Math.min(8, f.max || 8)) break;
    const m = monUnit(id, this.Lb, this.mons.length); m.summoned = true; this.mons.push(m);
  }
};

// ---------------- monster AI (§9.1.7, crest battle_ai)
P.condOk = function (u, c) {
  if (!c) return true;
  const pct = u.hp / u.mhp;
  if (c.hpBelow != null && !(pct < c.hpBelow)) return false;
  if (c.hpAbove != null && !(pct > c.hpAbove)) return false;
  if (c.every && u.acts % c.every[0] !== c.every[1]) return false;
  if (c.once && u.used[c.id || '_']) return false;
  if (c.round != null && this.round < c.round) return false;
  if (c.alone && this.alive('mon').length > 1) return false;
  if (c.countBelow != null && !(this.alive('mon').length < c.countBelow)) return false;
  if (c.allyDown && !this.mons.some((m) => !m.alive && !m.gone)) return false;
  return true;
};
P.monPick = function (u) {
  let list = (u.d.actions || [{ id: 'attack', w: 1 }]).filter((a) => a.w > 0 && this.condOk(u, a.cond && Object.assign({ id: a.id }, a.cond)) && !(a.cond && a.cond.once && u.used[a.id]));
  for (let tries = 0; tries < 6 && list.length; tries++) {
    const a = U.weighted(list);
    const act = DB.actions[a.id];
    if (a.id !== 'attack' && act) {
      const eff = act.effects;
      const pointless = (eff.some((f) => f.type === 'heal') && !this.friendsOf(u).some((m) => m.hp / m.mhp < 0.6)) ||
        (eff.every((f) => f.type === 'buff' && f.stages > 0) && (act.target === 'self' ? eff.every((f) => (u.buffs[f.stat] || 0) >= 2) : false)) ||
        (eff.some((f) => f.type === 'revive') && !this.mons.some((m) => !m.alive && !m.gone)) ||
        (eff.some((f) => f.type === 'status' && !BADS.includes(f.status) && f.status !== 'death') && act.target === 'self' && eff.every((f) => f.type !== 'status' || u.status[f.status]));
      if (pointless) { list = list.filter((x) => x !== a); continue; }
    }
    return a.id;
  }
  return 'attack';
};

// ---------------- party AI (§4.13.2, simplified: revive → heal → cure → focus-fire offense with WP/MP thrift)
P.expectAction = function (u, id, t) {
  if (id === 'attack') return this.roll(u, t, { type: 'damage', formula: 'phys', power: 1 }, null, true).dmg;
  const act = DB.actions[id];
  let sum = 0;
  for (const f of act.effects) if (f.type === 'damage') sum += this.roll(u, t, Object.assign({ formula: act.kind === 'spell' ? 'magic' : 'phys' }, f), act, true).dmg * (f.hits || 1);
  return sum;
};
P.affordable = function (u, id, thrift) {
  const a = DB.actions[id];
  if (!a) return true;
  if (a.mp && (u.mp < a.mp || (thrift && u.mp < u.mmp * 0.3) || u.status.silence)) return false;
  if (a.magic && u.status.silence) return false;
  if (a.wp && (u.wp < a.wp || (thrift && u.wp < u.mwp * 0.3))) return false;
  if (a.kind === 'tech' && a.reach === false && this.effRow(u) === 'middle') return false;
  return true;
};
P.focusFallback = function (u) {
  const foes = this.alive('mon');
  if (!foes.length) return null;
  const plan = this.plan && this.plan.order;
  if (plan) for (const t of plan) if (t.alive) return t;
  return foes[0];
};
P.partyCommands = function () {
  const cmds = new Map();
  const foes = this.alive('mon');
  const mem = this.party.filter((u) => this.canAct(u));
  const lowHp = () => this.alive('party').filter((x) => x.hp / x.mhp < 0.4);
  const dead = this.party.filter((x) => !x.alive);
  const spell = (u, pred) => u.spells.find((id) => { const a = DB.actions[id]; return pred(a) && this.affordable(u, id, false); });
  // 1-3: support
  const claimed = new Set();
  for (const u of mem) {
    if (dead.length && !claimed.has('rev')) {
      const rev = spell(u, (a) => a.target === 'ally_dead');
      if (rev) { cmds.set(u, { id: rev, target: dead[0] }); claimed.add('rev'); continue; }
      if (this.inv.revive > 0 && !u.isMage) { cmds.set(u, { item: 'revive', target: dead[0] }); this.inv.revive--; claimed.add('rev'); continue; }
    }
    const low = lowHp().filter((x) => !claimed.has(x));
    if (low.length) {
      const all = low.length >= 2 && spell(u, (a) => a.target === 'allies' && a.effects.some((f) => f.type === 'heal'));
      if (all) { cmds.set(u, { id: all }); low.forEach((x) => claimed.add(x)); continue; }
      const one = spell(u, (a) => a.target === 'ally' && a.effects.some((f) => f.type === 'heal'));
      if (one) { const t = low.sort((x, y) => x.hp / x.mhp - y.hp / y.mhp)[0]; cmds.set(u, { id: one, target: t }); claimed.add(t); continue; }
      const crit = low.filter((x) => x.hp / x.mhp < 0.25);
      if (crit.length && this.inv.potion > 0 && !u.spells.length) { cmds.set(u, { item: 'potion', target: crit[0] }); this.inv.potion--; claimed.add(crit[0]); continue; }
    }
    const sick = this.alive('party').find((x) => ['sleep', 'paralyze', 'freeze', 'confuse'].some((s) => x.status[s]) && !claimed.has('c' + x.name));
    if (sick) {
      const cure = spell(u, (a) => a.effects.some((f) => f.type === 'cure'));
      if (cure) { cmds.set(u, { id: cure, target: sick }); claimed.add('c' + sick.name); continue; }
    }
  }
  // 5: offense — focus order by threat / remaining HP, cover 85% (A5)
  const threat = (m) => Math.max(1, m.atk) / Math.max(1, m.hp);
  const order = foes.slice().sort((a, b) => threat(b) - threat(a));
  this.plan = { order };
  const attackers = mem.filter((u) => !cmds.has(u));
  const assigned = new Map(order.map((m) => [m, 0]));
  for (const u of attackers) {
    const opts = [];
    const canHit = !(this.effRow(u) === 'middle' && !u.reach);
    if (canHit) opts.push({ id: 'attack' });
    for (const id of u.techs) { const a = DB.actions[id]; if (a.effects.some((f) => f.type === 'damage') && this.affordable(u, id, true)) opts.push({ id }); }
    for (const id of u.spells) { const a = DB.actions[id]; if (a.effects.some((f) => f.type === 'damage') && this.affordable(u, id, true)) opts.push({ id }); }
    // glimmer bait (d): mages cast their cheapest damage spell once per battle while MP ≥ 50%
    if (u.isMage && !this.baitDone.has(u) && u.mp >= u.mmp * 0.5) {
      const cheap = u.spells.filter((id) => DB.actions[id].effects.some((f) => f.type === 'damage') && this.affordable(u, id, false)).sort((a, b) => DB.actions[a].mp - DB.actions[b].mp)[0];
      if (cheap) { this.baitDone.add(u); const t = order.find((m) => assigned.get(m) < m.hp) || order[0]; cmds.set(u, { id: cheap, target: t }); assigned.set(t, assigned.get(t) + this.expectAction(u, cheap, t)); continue; }
    }
    if (!opts.length) { cmds.set(u, { defend: true }); continue; }
    const tgt = order.find((m) => assigned.get(m) < m.hp * 0.85) || order[0];
    // mob-fight thrift (§4.13.2-5): a tech/spell only if an AoE kills ≥2, or a single-target one secures a kill the
    // plain attack would not (the fight ends a round earlier); never below 30% WP/MP (affordable(…, true))
    const left = Math.max(1, tgt.hp - assigned.get(tgt));
    const atkDmg = canHit ? this.expectAction(u, 'attack', tgt) : 0;
    let best = canHit ? { id: 'attack', val: Math.min(left, atkDmg) } : null;
    for (const o of opts) {
      if (o.id === 'attack') continue;
      const a = DB.actions[o.id];
      const cost = (a.wp || 0) + (a.mp || 0);
      if (a.target === 'enemies' || a.target === 'random' || a.target === 'group') {
        const hitSet = a.target === 'group' ? order.filter((m) => m.id === tgt.id) : order;
        const per = (m) => this.expectAction(u, o.id, m) / (a.target === 'random' ? hitSet.length : 1);
        const kills = hitSet.filter((m) => per(m) >= m.hp - assigned.get(m)).length;
        if (kills < 2) continue;
        const val = hitSet.reduce((sum, m) => sum + Math.min(Math.max(0, m.hp - assigned.get(m)), per(m)), 0) - cost;
        if (!best || val > best.val) best = { id: o.id, val, aoe: true };
      } else {
        const e = this.expectAction(u, o.id, tgt);
        if (atkDmg >= left || e < left) continue;
        const val = Math.min(left, e) - cost * 0.5;
        if (!best || (!best.aoe && val > best.val)) best = { id: o.id, val };
      }
    }
    if (!best) { cmds.set(u, { defend: true }); continue; }
    cmds.set(u, { id: best.id, target: tgt });
    assigned.set(tgt, assigned.get(tgt) + (best.id === 'attack' ? atkDmg : this.expectAction(u, best.id, tgt)));
  }
  return cmds;
};

P.endTurn = function (u) {
  if (!u.alive) return;
  if (u.status.poison) { const d = Math.max(1, Math.floor(u.mhp / 16)); const r = Math.min(u.hp, d); u.hp -= r; if (u.side === 'party') this.taken += r; }
  if (u.status.burn) { const d = Math.max(1, Math.floor(u.mhp / 10)); const r = Math.min(u.hp, d); u.hp -= r; if (u.side === 'party') this.taken += r; }
  if (u.hp <= 0) { this.die(u); return; }
  if (u.status.regen) u.hp = Math.min(u.mhp, u.hp + Math.floor(u.mhp / (u.side === 'party' ? 10 : 20)));
  for (const s of ['burn', 'confuse', 'silence', 'blind', 'regen', 'veil']) if (u.status[s] && s !== 'poison') { u.status[s]--; if (u.status[s] <= 0) delete u.status[s]; }
};
P.turn = function (u, cmd) {
  if (!u.alive || u.gone) return;
  u.defending = false;
  const dis = K.DISABLE.find((s) => u.status[s]);
  if (dis) { u.status[dis]--; if (u.status[dis] <= 0) delete u.status[dis]; if (dis === 'stun') delete u.status.stun; u.acts++; return; }
  if (u.status.confuse) {
    const pool = [...this.alive('party'), ...this.alive('mon')].filter((x) => x !== u);
    const mine = pool.filter((x) => x.side === u.side), theirs = pool.filter((x) => x.side !== u.side);
    const t = (U.r() < 0.5 && mine.length) || !theirs.length ? U.pick(mine) : U.pick(theirs);
    if (t) this.applyDamage(u, t, { type: 'damage', formula: 'phys', power: 1 }, null);
    this.endTurn(u); u.acts++; return;
  }
  if (u.side === 'mon') {
    if (u.fleeRate && U.r() < u.fleeRate) { u.gone = true; u.alive = false; return; }
    const id = this.monPick(u);
    this.useAction(u, id, null);
  } else if (cmd) {
    if (cmd.defend) u.defending = true;
    else if (cmd.item === 'potion') { if (cmd.target.alive) cmd.target.hp = Math.min(cmd.target.mhp, cmd.target.hp + Math.round(cmd.target.mhp * 0.35)); }
    else if (cmd.item === 'revive') { if (!cmd.target.alive) { cmd.target.alive = true; cmd.target.hp = Math.round(cmd.target.mhp * 0.3); } }
    else if (cmd.id && (cmd.id === 'attack' || this.affordable(u, cmd.id, false))) this.useAction(u, cmd.id, cmd.target);
    else this.useAction(u, 'attack', cmd.target);
  }
  this.endTurn(u);
  u.acts++;
};
P.check = function () {
  if (!this.alive('party').length) { this.result = 'lose'; return true; }
  if (!this.alive('mon').length) { this.result = 'win'; return true; }
  return false;
};
P.run = function (maxRounds) {
  const agiP = this.party.reduce((s, u) => s + u.spd, 0) / this.party.length;
  const agiM = this.mons.reduce((s, u) => s + u.spd, 0) / this.mons.length;
  const pre = U.r() < (1 / 16) * Math.max(0.5, Math.min(2, agiP / agiM));
  while (!this.result && this.round < maxRounds) {
    this.round++;
    const cmds = this.partyCommands();
    for (const u of this.party) u.defending = !!(cmds.get(u) && cmds.get(u).defend);
    const order = [];
    for (const u of this.party) if (u.alive) order.push({ u, v: (cmds.get(u) && cmds.get(u).defend ? 1e4 : 0) + u.spd * stageMul(u.buffs.agi) * U.rf(0.75, 1) });
    if (!(pre && this.round === 1)) for (const m of this.mons) if (m.alive && !m.gone) for (let i = 0; i < m.actsPerTurn; i++) order.push({ u: m, v: m.spd * stageMul(m.buffs.agi) * U.rf(0.75, 1) });
    order.sort((a, b) => b.v - a.v);
    for (const { u } of order) {
      if (this.check()) break;
      this.turn(u, cmds.get(u));
    }
    this.check();
    for (const u of this.party) u.defending = false;
  }
  if (!this.result) this.result = 'timeout';
  return this;
};

// ================================================================ engine adapter (real game engine)
let PM = null;
const PROBES = [[['jelly_3', 3], ['bat_4', 2]], [['frog_2', 2], ['lizardman_3', 2]], [['paper_2', 3]], [['mimic_3', 1]], [['treant_2', 1], ['bee_2', 3]]];
/** the game engine is used only when it runs Chronicle data end to end (e_ actions, @refs, tier scaling) */
function realEngineOk() {
  if (ENGINE === 'model') return false;
  try { PM = require('./lib/party_model'); } catch (e) { PM = null; }
  const have = PM && PM.standard && PM.runBattle && R.Battle && R.Battle.simulate && R.Mon && R.Mon.def && R.BattleAI && R.Rules && R.Rules.stats;
  if (!have) { if (ENGINE === 'real') throw new Error('real engine requested but not available'); return false; }
  try {
    PROBES.forEach((mons, i) => {
      const b = PM.standard(R, 4);
      const res = PM.runBattle(R, { party: b.party, inv: b.inv, mons, tier: 4, seed: 11 + i, maxRounds: 30, noRare: true, noGolden: true });
      if (!res || !['win', 'lose', 'escape', 'timeout'].includes(res.result) || !(res.rounds >= 1)) throw new Error('bad result ' + JSON.stringify(res && res.result));
    });
    const d = R.Mon.def('wolf_3', { tier: 6 });
    if (!d || !(d.hp > 0)) throw new Error('R.Mon.def');
    return true;
  } catch (e) {
    if (ENGINE === 'real') throw e;
    console.log('[sim_zones] game-engine probe failed (' + String((e && e.message) || e).split('\n')[0].slice(0, 140) + ') → using the model');
    return false;
  }
}

// ================================================================ runner
function lbOf(z, T) {
  if (z.lv) return null;
  return LZ(T) + (z.lvOff || 0);
}
function drawCount(a, b) { return U.ri(a, b); }
/** one battle; returns {win, rounds, lost, fell, wipe, casts, mpUsed, mmp} */
function fight(z, T, ms, partyKind, useReal) {
  const Lb = z.lv ? U.ri(z.lv[0], z.lv[1]) : lbOf(z, T);
  const monIds = [];
  for (const [id, a, b] of ms) { const n = drawCount(a, b); for (let i = 0; i < n; i++) monIds.push(id); }
  if (useReal) return fightReal(z, T, ms, monIds, partyKind);
  const L = partyKind === 'hero' ? U.ri(1, 3) : (z.lv ? LZ(0) + 1 : LZ(T) + 1);
  const party = partyKind === 'hero' ? prologueHero(L) : partyKind === 'phys' ? physParty(T, L) : partyKind === 'magic' ? magicParty(T, L) : standardParty(T, L);
  const mhp = party.reduce((s, u) => s + u.mhp, 0);
  const mmp = party.reduce((s, u) => s + u.mmp, 0);
  const b = new Battle(party, monIds, Lb, { T }).run(30);
  const net = party.reduce((s, u) => s + (u.mhp - Math.max(0, u.hp)), 0) / mhp;
  const mwp = party.reduce((s, u) => s + u.mwp, 0);
  return { win: b.result === 'win', rounds: b.round, lost: b.taken / mhp, taken: net, fell: b.fell > 0, wipe: b.result === 'lose', casts: b.casts, mpUsed: b.mpUsed / Math.max(1, mmp), wpUsed: b.wpUsed / Math.max(1, mwp) };
}
function fightReal(z, T, ms, monIds, partyKind) {
  const tier = z.tier === 'dyn' ? T : z.tier;
  let b;
  if (partyKind === 'standard') b = PM.standard(R, tier);
  else if (partyKind === 'phys') b = PM.build(R, { tier, members: ['hero', 'hagen', 'brigitta', 'sylvain'], heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, build: 'phys', gear: 'shop' });
  else if (partyKind === 'magic') { const c = PM.COMBOS.find((x) => x.no === 2); b = PM.build(R, { tier, members: ['hero', ...c.members], heroType: c.heroType, favor: c.favor, build: 'magic', gear: 'shop' }); }
  else {
    // the prologue hero: default hero type (warrior, sword) with its starting kit only (§5.1.4: weapon, body, head, shield)
    b = PM.build(R, { tier: 0, members: ['hero'], heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, gear: 'shop', level: U.ri(1, 3) });
    const ht = (DB.heroTypes || {}).warrior || {};
    const c = b.party[0];
    const kit = Object.assign({ weapon1: ht.defaultWeapon || c.equip.weapon1 }, ht.startEquip || {});
    for (const slot of Object.keys(c.equip)) c.equip[slot] = kit[slot] || null;
    const st = R.Rules.stats(c);
    c.hp = st.hp; c.mp = st.mp; c.wp = st.wp;
  }
  if (partyKind !== 'hero') for (const c of b.party) { c.mp = Math.ceil((c.mp || 0) * 0.6); c.wp = Math.ceil((c.wp || 0) * 0.6); }
  const o = { party: b.party, inv: b.inv, mons: monIds.map((id) => [id, 1]), tier, seed: Math.floor(U.r() * 1e9), maxRounds: 30, noRare: true, noGolden: true };
  if (z.lv) o.lv = U.ri(z.lv[0], z.lv[1]); else o.lvOff = z.lvOff || 0;
  const res = PM.runBattle(R, o);
  const mhp = b.party.reduce((s, c) => s + ((R.Rules.stats(c) || {}).hp || c.hp), 0);
  const taken = res.damageTaken != null ? Math.min(1, res.damageTaken / mhp) : res.hpLostPct / 100;
  return { win: res.result === 'win', rounds: res.rounds, lost: (res.hpLostPct != null ? res.hpLostPct : 100 * taken) / 100, taken: (res.netLossPct || 0) / 100, fell: !!res.anyDown, wipe: res.result === 'lose',
    casts: (res.casts || []).reduce((x, y) => x + y, 0), mpUsed: (res.mpUsedPct || 0) / 100 };
}
function stats(arr) {
  const n = arr.length || 1;
  const s = arr.slice().sort((a, b) => a - b);
  return { mean: arr.reduce((x, y) => x + y, 0) / n, p95: s[Math.min(s.length - 1, Math.floor(0.95 * s.length))] || 0 };
}
/** simulate every group of zone z at tier T; weighted aggregate (solo & metal groups excluded from the averages) */
function runZoneTier(zid, T, partyKind, n, useReal) {
  const z = DB.encounters[zid];
  const el = CM.eligibleGroups(DB, z, T);
  const groups = [];
  for (const { g, ms } of el) {
    const excluded = !!g.solo || CM.isMetalGroup(DB, ms);
    const rs = [];
    for (let i = 0; i < n; i++) rs.push(fight(z, T, ms, partyKind, useReal));
    groups.push({ g, ms, excluded, rs });
  }
  const agg = { win: 0, rounds: 0, lost: 0, taken: 0, fell: 0, wipe: 0, casts: 0, mpUsed: 0, wpUsed: 0, w: 0, lostAll: [] };
  for (const G of groups) {
    const w = G.g.w;
    const win = G.rs.filter((r) => r.win).length / G.rs.length;
    const rounds = stats(G.rs.map((r) => r.rounds)).mean;
    const lost = stats(G.rs.map((r) => r.lost));
    const fell = G.rs.filter((r) => r.fell).length / G.rs.length;
    const wipe = G.rs.filter((r) => r.wipe).length / G.rs.length;
    G.sum = { win, rounds, lost: lost.mean, p95: lost.p95, fell, wipe, casts: stats(G.rs.map((r) => r.casts)).mean, mpUsed: stats(G.rs.map((r) => r.mpUsed)).mean, wpUsed: stats(G.rs.map((r) => r.wpUsed || 0)).mean, taken: stats(G.rs.map((r) => r.taken || 0)).mean };
    if (G.excluded) continue;
    agg.w += w; agg.win += w * win; agg.rounds += w * rounds; agg.lost += w * lost.mean; agg.fell += w * fell; agg.wipe += w * wipe; agg.casts += w * G.sum.casts; agg.mpUsed += w * G.sum.mpUsed; agg.wpUsed += w * G.sum.wpUsed; agg.taken += w * G.sum.taken;
    // p95 over the zone's battle distribution: sample each group's battles proportionally to its weight
    const k = Math.max(1, Math.round(w * 4));
    for (let i = 0; i < k; i++) for (const r of G.rs) agg.lostAll.push(r.lost);
  }
  for (const key of ['win', 'rounds', 'lost', 'taken', 'fell', 'wipe', 'casts', 'mpUsed', 'wpUsed']) agg[key] /= agg.w || 1;
  agg.p95 = stats(agg.lostAll).p95;
  delete agg.lostAll;
  // a 400-battle sample of this zone×tier's mixture (for the pooled distribution)
  const incl = groups.filter((G) => !G.excluded);
  const wsum = incl.reduce((x, G) => x + G.g.w, 0);
  const sample = [];
  for (let i = 0; i < 400 && incl.length; i++) {
    let x = U.r() * wsum, G = incl[incl.length - 1];
    for (const H of incl) { x -= H.g.w; if (x < 0) { G = H; break; } }
    sample.push(G.rs[Math.floor(U.r() * G.rs.length)]);
  }
  // excluded groups still must be won
  agg.minWinAll = Math.min(...groups.map((G) => G.sum.win));
  return { zid, T, agg, groups, sample };
}

/** §9.13.1: a lineage's s moves one way for all its stages. Per lineage and stat, the direction (vs DESIGN) with the larger
 *  total log-change wins; stages that wanted the other way keep their DESIGN value for that stat. pairs: [[lineage, monId]] */
function projectLineages(base, Dd, pairs) {
  const byL = {};
  for (const [lid, id] of pairs) if (base.monsters[id] && base.monsters[id].s) (byL[lid] = byL[lid] || []).push(id);
  for (const ids of Object.values(byL)) {
    for (const k of ['hp', 'atk', 'mag']) {
      const lr = ids.map((id) => { const d = (Dd.mons[id].s || {})[k]; const e = base.monsters[id].s[k]; return Math.log((e != null ? e : 1) / (d != null ? d : 1)); });
      const up = lr.filter((x) => x > 0).reduce((a, b) => a + b, 0), dn = -lr.filter((x) => x < 0).reduce((a, b) => a + b, 0);
      ids.forEach((id, i) => {
        if ((up >= dn && lr[i] < 0) || (dn > up && lr[i] > 0)) {
          const d = (Dd.mons[id].s || {})[k];
          if (d == null || d === 1) delete base.monsters[id].s[k]; else base.monsters[id].s[k] = d;
        }
      });
    }
  }
}

/** --refit <sim_zones --json file> --fit <out.json>: zone-context correction of s (no battles are run). Every non-excluded
 *  group's result is compared with a target proportional to its strength (HP lost FIT_LOST × strength / 3.2, rounds
 *  FIT_ROUNDS × (strength / 3.2)^0.8); the log residual is shared among its species by strength share, and each species'
 *  s.atk / s.mag (and s.hp for rounds) moves against its weighted residual (damped), then the lineage rule applies. */
function refit(file, outFile) {
  const J = JSON.parse(fs.readFileSync(file, 'utf8'));
  const G = (J.M && J.M.M1 && J.M.M1.groups) || [];
  if (!G.length) throw new Error('refit: ' + file + ' has no M1 groups (run sim_zones with --json and M1)');
  const L_T = Number(opt('fit-lost', 0.092)), R_T = Number(opt('fit-rounds', 2.8)), DAMP = Number(opt('fit-damp', 0.7));
  const Dd = CM.parseDesign();
  const acc = {};
  for (const g of G) {
    if (g.excluded || /prologue/.test(g.zone)) continue;
    const parts = g.ms.map(([id, a, b]) => [id, CM.SIZE_W[DB.monsters[id].size] * (a + b) / 2]);
    const st = parts.reduce((x, [, v]) => x + v, 0);
    const rl = Math.log(Math.max(0.003, g.lost) / (L_T * st / 3.2));
    const rr = Math.log(Math.max(0.5, g.rounds) / (R_T * Math.pow(st / 3.2, 0.8)));
    for (const [id, v] of parts) {
      const a = acc[id] = acc[id] || { w: 0, rl: 0, rr: 0 };
      const w = g.w * v / st;
      a.w += w; a.rl += w * rl; a.rr += w * rr;
    }
  }
  const base = CM.loadTuning();
  base.monsters = base.monsters || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r2 = (v) => Math.round(v * 100) / 100;
  const pairs = [];
  let n = 0;
  for (const [id, a] of Object.entries(acc)) {
    const m = DB.monsters[id];
    if (!m.lineage || (m.flags || []).includes('metal')) continue;
    const rl = a.rl / a.w, rr = a.rr / a.w;
    const fh = clamp(Math.exp(-DAMP * rr / 0.8), 0.8, 1.25);
    const fd = clamp(Math.exp(-DAMP * rl) / Math.pow(fh, 0.8), 0.7, 1.4);
    const cur = Object.assign({}, m.s || {});
    const sv = Object.assign({}, cur);
    sv.hp = r2(clamp((cur.hp != null ? cur.hp : 1) * fh, 0.5, 2.5));
    sv.atk = r2(clamp((cur.atk != null ? cur.atk : 1) * fd, 0.3, 2.5));
    sv.mag = r2(clamp((cur.mag != null ? cur.mag : 1) * fd, 0.3, 2.5));
    for (const k of Object.keys(sv)) if (sv[k] === 1) delete sv[k];
    const e = base.monsters[id] = base.monsters[id] || {};
    e.s = sv;
    const why = `sim_zones --fit + --refit (game engine; zone groups: HP lost ×${Math.exp(rl).toFixed(2)}, rounds ×${Math.exp(rr).toFixed(2)} of the strength target)`;
    e.why = e.desc ? why + ' ／ ' + String(e.why || '').split(' ／ ').filter((x) => x.startsWith('desc:')).join(' ／ ') : why;
    pairs.push([m.lineage, id]);
    n++;
  }
  if (!flag('fit-free')) projectLineages(base, Dd, Object.values(DB.lineages).flatMap((L) => L.stages.map((st) => [DB.monsters[st.mon].lineage, st.mon])).filter(([, id]) => base.monsters[id] && base.monsters[id].s));
  delete base.global;
  fs.writeFileSync(outFile, JSON.stringify(base, null, 2) + '\n');
  console.log(`[sim_zones] refit: ${n} species corrected from ${G.length} group results → ${outFile}`);
}

/** --tilt-t0 <avg> --fit <out.json>: dungeon zones (lvOff ≥ 1) at T0. lvOff +1 is a much larger share of the level at T0
 *  (Lb 7 vs 6) than later (×1.38 HP lost at T0–1, ×1.0 at T7), so at T0 only the zone's groups are re-weighted toward
 *  the lighter ones (w × e^(λ·(strength − mean)), λ < 0) until the average strength is <avg> (M5 floor 3.0). The groups
 *  eligible at T0 get a tierMax:0 copy with the new weight; the originals start at T1. No battles are run. */
function tiltT0(target, outFile) {
  const base = CM.loadTuning();
  base.encounters = base.encounters || {};
  const E = CM.expected();
  let n = 0;
  for (const [zid, z] of Object.entries(E.encounters)) {
    if (z.tier !== 'dyn' || !(z.lvOff >= 1)) continue;
    const el = CM.eligibleGroups(DB, Object.assign({}, z), 0).filter(({ g, ms }) => !g.solo && !CM.isMetalGroup(DB, ms));
    const st = el.map(({ ms }) => CM.groupStrength(DB, ms));
    const W = el.map(({ g }) => g.w);
    const mean = (lam) => { let a = 0, b = 0; el.forEach((_, i) => { const w = W[i] * Math.exp(lam * st[i]); a += w * st[i]; b += w; }); return a / b; };
    if (mean(0) <= target) continue;
    let lo = -5, hi = 0;
    for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (mean(m) > target) hi = m; else lo = m; }
    const lam = lo;
    const s0 = el.reduce((a, _, i) => a + W[i] * st[i], 0) / W.reduce((a, b) => a + b, 0);
    const neu = new Map(el.map(({ g }, i) => [g, Math.max(0.5, Math.round(2 * W[i] * Math.exp(lam * (st[i] - s0))) / 2)]));
    const groups = [];
    for (const g of z.groups) {
      if (neu.has(g)) {
        const lowCopy = Object.assign({}, g, { w: neu.get(g), tierMax: 0 });
        delete lowCopy.tierMin;
        groups.push(lowCopy);
        groups.push(Object.assign({}, g, { tierMin: Math.max(1, g.tierMin || 0) }));
      } else groups.push(g);
    }
    const why = `sim_zones --tilt-t0 ${target}: lvOff ${z.lvOff} makes T0 ×1.38 harder than T1+ (M2 order independence); at T0 the groups are re-weighted to average strength ${target} (was ${s0.toFixed(2)})`;
    const prev = base.encounters[zid] && base.encounters[zid].why;
    base.encounters[zid] = { groups, why: prev && !/tilt-t0/.test(prev) ? prev + ' ／ ' + why : why };
    n++;
  }
  fs.writeFileSync(outFile, JSON.stringify(base, null, 2) + '\n');
  console.log(`[sim_zones] tilt-t0: ${n} dungeon zones re-weighted at T0 → ${outFile}`);
}

// ================================================================ main
function pct(x, d = 1) { return (100 * x).toFixed(d) + '%'; }
function main() {
  if (opt('tilt-t0', null)) { tiltT0(Number(opt('tilt-t0')), opt('fit')); return; }
  if (opt('refit', null)) { refit(opt('refit'), opt('fit', null) || (() => { throw new Error('--refit needs --fit <out.json>'); })()); return; }
  const useReal = realEngineOk();
  const t0 = Date.now();
  console.log(`[sim_zones] engine: ${useReal ? 'GAME ENGINE (R.Battle.simulate + party_model)' : 'MODEL (DESIGN §4 re-implementation; the game engine is not complete yet)'}; seed ${SEED}; ${N} battles per group`);
  // zones other owners derive from ours (same groups; e.g. OB's rare-monster den) are not simulated twice
  const D0 = CM.expected();
  const zones = Object.keys(DB.encounters).filter((z) => (!ZONE || z === ZONE) && (D0.encounters[z] || !CM.derivedFrom(DB, D0, z)));
  const out = { engine: useReal ? 'game' : 'model', seed: SEED, n: N, M: {} };
  let failures = 0;
  const FAIL = (m, msg) => { failures++; console.log(`  ✗ ${m} ${msg}`); };

  // ---------------- M5 static
  if (ONLY.includes('M5')) {
    console.log('\nM5 group rules (static, §9.7.2)');
    let bad = 0;
    const rows = [];
    for (const zid of zones) {
      const z = DB.encounters[zid];
      const strs = [];
      for (const T of CM.zoneTiers(z)) {
        if (TIER != null && z.tier === 'dyn' && T !== TIER) continue;
        const el = CM.eligibleGroups(DB, z, T);
        if (el.length < 4) { bad++; FAIL('M5', `${zid} T${T}: only ${el.length} groups`); }
        for (const { g, ms } of el) {
          const px = ms.reduce((s, [id, , b]) => s + CM.SIZE_PX[DB.monsters[id].size] * b, 0);
          const cnt = ms.reduce((s, [, , b]) => s + b, 0);
          if (ms.length > 3 || cnt > 8 || px > 256) { bad++; FAIL('M5', `${zid} T${T} ${JSON.stringify(g.mons)}: ${ms.length} species ${cnt} bodies ${px}px`); }
          if (g.solo || CM.isMetalGroup(DB, ms)) continue;
          const st = CM.groupStrength(DB, ms);
          const [lo, hi] = zid === 'zw_prologue' ? [1, 2] : zid === 'z_prologue_lighthouse' ? [1.5, 2.5] : [2.2, 4.8];
          if (st < lo - 1e-9 || st > hi + 1e-9) { bad++; FAIL('M5', `${zid} T${T} ${JSON.stringify(g.mons)}: strength ${st.toFixed(2)} not in ${lo}–${hi}`); }
        }
        const avg = CM.zoneStrength(DB, z, T);
        strs.push(avg);
        const [lo, hi] = zid === 'zw_prologue' ? [1, 2] : zid === 'z_prologue_lighthouse' ? [1.5, 2.5] : [3.0, 3.4];
        if (avg < lo - 1e-9 || avg > hi + 1e-9) { bad++; FAIL('M5', `${zid} T${T}: average strength ${avg.toFixed(2)} not in ${lo}–${hi}`); }
      }
      rows.push(`${zid.padEnd(24)} ${strs.map((x) => x.toFixed(2)).join(' ')}`);
    }
    console.log('  zone                     average strength per tier (T0..T8 / fixed)');
    for (const r of rows) console.log('  ' + r);
    console.log(bad ? `  M5 FAIL (${bad})` : '  M5 PASS');
    out.M.M5 = { pass: !bad, rows };
  }

  // ---------------- M1 / M2 standard party
  const results = [];
  if (ONLY.includes('M1') || ONLY.includes('M2')) {
    U.seed(SEED);
    for (const zid of zones) {
      const z = DB.encounters[zid];
      if (z.region === 'prologue' && !ZONE) { /* prologue zones are also run with the standard party (the hero alone is M4) */ }
      for (const T of CM.zoneTiers(z)) {
        if (TIER != null && z.tier === 'dyn' && T !== TIER) continue;
        if (TIERS && z.tier === 'dyn' && !TIERS.includes(T)) continue;
        results.push(runZoneTier(zid, T, 'standard', N, useReal));
      }
    }
  }
  if (ONLY.includes('M1')) {
    console.log('\nM1 standard party (§4.17.1), auto — per zone × tier: win, rounds, HP lost mean/p95 (taken), someone fell, wipe, MP/WP used, casts');
    let bad = 0, warnZ = 0;
    const all = { lost: 0, taken: 0, rounds: 0, w: 0, mp: 0, wp: 0 };
    const pool = [];
    let line = '';
    for (const r of results) {
      const a = r.agg;
      const tag = `${r.zid}${DB.encounters[r.zid].tier === 'dyn' ? ' T' + r.T : ''}`;
      const hard = [], soft = [];
      if (a.win < 0.995 || a.minWinAll < 0.995) hard.push('win');
      if (a.lost < 0.05 || a.lost > 0.15) hard.push('lost');
      if (a.wipe > 0.001) hard.push('wipe');
      if (a.rounds < 2.5 || a.rounds > 3.5) soft.push('rounds');
      if (a.p95 > 0.20) soft.push('p95');
      if (a.fell > 0.03) soft.push('fell');
      const prologue = DB.encounters[r.zid].region === 'prologue';
      if (!prologue) { all.lost += a.lost; all.taken += a.taken; all.rounds += a.rounds; all.w++; all.mp += a.mpUsed; all.wp += a.wpUsed; pool.push(...r.sample); }
      const txt = `${tag.padEnd(26)} win ${pct(a.win)} rnd ${a.rounds.toFixed(2)} lost ${pct(a.lost)} p95 ${pct(a.p95)} (net ${pct(a.taken)}) fell ${pct(a.fell)} wipe ${pct(a.wipe, 2)} mp ${pct(a.mpUsed)} wp ${pct(a.wpUsed)} cast ${a.casts.toFixed(2)}` +
        (hard.length ? '  ✗ ' + hard.join(',') : '') + (soft.length ? '  (' + soft.join(',') + ')' : '');
      if (prologue) { line += '  · ' + txt + '  [prologue: the hero-alone case is M4]\n'; continue; }
      if (hard.length) { bad++; console.log('  ✗ ' + txt); } else if (soft.length) { warnZ++; line += '  ~ ' + txt + '\n'; } else line += '  ✓ ' + txt + '\n';
    }
    if (flag('verbose') || ZONE) process.stdout.write(line);
    const n = all.w || 1;
    const P = { lost: all.lost / n, taken: all.taken / n, rounds: all.rounds / n, p95: stats(pool.map((r) => r.lost)).p95,
      fell: pool.filter((r) => r.fell).length / (pool.length || 1), wipe: pool.filter((r) => r.wipe).length / (pool.length || 1), win: pool.filter((r) => r.win).length / (pool.length || 1) };
    const chk = [['HP lost mean', P.lost, P.lost >= 0.08 && P.lost <= 0.12, '8–12%'], ['rounds', P.rounds, P.rounds >= 2.5 && P.rounds <= 3.5, '2.5–3.5'],
      ['p95', P.p95, P.p95 <= 0.20, '≤20%'], ['someone fell', P.fell, P.fell <= 0.03, '≤3%'], ['wipe', P.wipe, P.wipe <= 0.001, '≤0.1%'], ['win', P.win, P.win >= 0.995, '≥99.5%']];
    console.log(`  pooled over ${all.w} mid/finale/postgame zone×tier (${pool.length} battles): ` + chk.map(([k, v, okk, rng]) => `${k} ${k === 'rounds' ? v.toFixed(2) : pct(v)} ${okk ? '✓' : '✗'}(${rng})`).join('  '));
    console.log(`  net loss after in-battle healing ${pct(P.taken)}, MP used ${pct(all.mp / n)}, WP used ${pct(all.wp / n)} of max per battle; ${warnZ} zone×tier with per-zone warnings (rounds/p95/fell)`);
    const okPool = chk.every((c) => c[2]);
    if (!okPool) bad++;
    console.log(bad ? `  M1 FAIL (${bad - (okPool ? 0 : 1)} zone×tier out of range${okPool ? '' : '; pooled criteria off'})` : '  M1 PASS');
    failures += bad;
    out.M.M1 = { pass: !bad, pooled: P, rows: results.map((r) => ({ zone: r.zid, T: r.T, ...r.agg })),
      groups: results.flatMap((r) => r.groups.map((G) => ({ zone: r.zid, T: r.T, w: G.g.w, ms: G.ms, excluded: G.excluded, lost: G.sum.lost, rounds: G.sum.rounds, p95: G.sum.p95 }))) };
    if (flag('groups')) {
      const gs = results.flatMap((r) => r.groups.map((G) => ({ zone: r.zid, T: r.T, g: G.g.mons, ...G.sum, excl: G.excluded })));
      gs.sort((a, b) => b.lost - a.lost);
      console.log('\n  groups by HP lost (top 40):');
      for (const g of gs.slice(0, 40)) console.log(`   ${(g.zone + ' T' + g.T).padEnd(28)} ${JSON.stringify(g.g).padEnd(44)} lost ${pct(g.lost)} p95 ${pct(g.p95)} win ${pct(g.win)} rnd ${g.rounds.toFixed(2)} fell ${pct(g.fell)}${g.excl ? ' (excl)' : ''}`);
      gs.sort((a, b) => a.lost - b.lost);
      console.log('  groups by HP lost (bottom 15):');
      for (const g of gs.slice(0, 15)) console.log(`   ${(g.zone + ' T' + g.T).padEnd(28)} ${JSON.stringify(g.g).padEnd(44)} lost ${pct(g.lost)} rnd ${g.rounds.toFixed(2)}${g.excl ? ' (excl)' : ''}`);
    }
  }
  if (ONLY.includes('M2')) {
    console.log('\nM2 order independence — T0..T7 within ±15% of the zone mean (rounds / HP lost / win)');
    let bad = 0;
    for (const zid of zones) {
      if (DB.encounters[zid].tier !== 'dyn') continue;
      const rs = results.filter((r) => r.zid === zid && r.T <= 7);
      if (rs.length < 8) continue;
      const dev = {};
      for (const k of ['rounds', 'lost', 'win']) {
        const m = rs.reduce((s, r) => s + r.agg[k], 0) / rs.length;
        dev[k] = Math.max(...rs.map((r) => Math.abs(r.agg[k] - m) / m));
      }
      const okz = dev.rounds <= 0.15 && dev.lost <= 0.15 && dev.win <= 0.15;
      if (!okz) bad++;
      console.log(`  ${okz ? '✓' : '✗'} ${zid.padEnd(24)} max dev: rounds ${pct(dev.rounds)} lost ${pct(dev.lost)} win ${pct(dev.win)}  | lost by tier ${rs.map((r) => (100 * r.agg.lost).toFixed(1)).join(' ')}`);
    }
    console.log(bad ? `  M2 FAIL (${bad})` : '  M2 PASS');
    failures += bad;
    out.M.M2 = { pass: !bad };
  }
  // ---------------- M3 phys-only / magic-only
  if (ONLY.includes('M3')) {
    console.log('\nM3 physical-only (sword/axe front, spear/bow middle) and magic-only (4 mages) parties — win ≥ 98% everywhere');
    let bad = 0;
    for (const kind of ['phys', 'magic']) {
      U.seed(SEED + (kind === 'phys' ? 1 : 2));
      let worst = null, lostSum = 0, cnt = 0;
      for (const zid of zones) {
        const z = DB.encounters[zid];
        if (z.region === 'prologue') continue;
        for (const T of CM.zoneTiers(z)) {
          if (TIER != null && z.tier === 'dyn' && T !== TIER) continue;
          if (TIERS && z.tier === 'dyn' && !TIERS.includes(T)) continue;
          const r = runZoneTier(zid, T, kind, Math.max(20, Math.round(N / 2)), useReal);
          lostSum += r.agg.lost; cnt++;
          if (!worst || r.agg.win < worst.agg.win) worst = r;
          if (r.agg.win < 0.98) { bad++; console.log(`  ✗ ${kind} ${zid} T${r.T}: win ${pct(r.agg.win)} lost ${pct(r.agg.lost)} rounds ${r.agg.rounds.toFixed(2)}`); }
        }
      }
      console.log(`  ${kind.padEnd(6)} worst ${worst.zid} T${worst.T} win ${pct(worst.agg.win)}; mean HP lost ${pct(lostSum / cnt)}`);
      out.M['M3_' + kind] = { worst: { zone: worst.zid, T: worst.T, win: worst.agg.win }, meanLost: lostSum / cnt };
    }
    console.log(bad ? `  M3 FAIL (${bad})` : '  M3 PASS');
    failures += bad;
    out.M.M3 = { pass: !bad };
  }
  // ---------------- M4 the hero alone in zw_prologue
  if (ONLY.includes('M4') && (!ZONE || ZONE === 'zw_prologue')) {
    U.seed(SEED + 3);
    const r = runZoneTier('zw_prologue', 0, 'hero', N * 3, useReal);
    const okm = r.agg.minWinAll >= 0.97 && r.agg.win >= 0.97;
    console.log(`\nM4 hero alone (Lv1–3, starting gear) in zw_prologue: win ${pct(r.agg.win)} (worst group ${pct(r.agg.minWinAll)}), rounds ${r.agg.rounds.toFixed(2)}, HP lost ${pct(r.agg.lost)}  ${okm ? 'PASS' : 'FAIL'}`);
    for (const G of r.groups) console.log(`    ${JSON.stringify(G.g.mons).padEnd(40)} win ${pct(G.sum.win)} lost ${pct(G.sum.lost)} rounds ${G.sum.rounds.toFixed(2)}`);
    if (!okm) failures++;
    out.M.M4 = { pass: okm, win: r.agg.win, worst: r.agg.minWinAll };
  }
  // ---------------- per-species danger report (not a criterion: helps tune lineage s and group sizes)
  //   --species          a pure group worth 3.2 standard monsters of every species over the tiers where '@' picks
  //                      that stage (world lvOff 0 and dungeon lvOff 1 alternately), HP lost / rounds
  //   --fit <out.json>   also write a candidate overlay (the current one ⊕ s.hp / s.atk / s.mag per species) that moves
  //                      every species toward HP lost FIT_LOST and FIT_ROUNDS rounds; damped, so run it 2–3 times
  //                      (--tuning <previous out.json>) and then check M1 with --tuning. Per lineage and stat the
  //                      stages move one way (§9.13.1; --fit-free lifts that)
  if (flag('species') || opt('fit', null)) {
    const FIT = opt('fit', null);
    const L_T = Number(opt('fit-lost', 0.095)), R_T = Number(opt('fit-rounds', 2.8)), DAMP = Number(opt('fit-damp', 0.8));
    const Dd = CM.parseDesign();
    console.log(`\nspecies danger — a pure group worth 3.2 standard monsters over the stage's tiers, lvOff 0/1 (HP lost / rounds)${FIT ? ` → fit to ${pct(L_T)} / ${R_T}` : ''}`);
    U.seed(SEED + 9);
    const rows = [];
    for (const [lid, L] of Object.entries(DB.lineages)) {
      for (const st of L.stages) {
        const m = DB.monsters[st.mon];
        if ((m.flags || []).includes('metal')) continue;
        const T = CM.midTier(Dd, Dd.mons[st.mon] || m, st.mon);
        const cnt = Math.max(1, Math.min(8, Math.round(3.2 / CM.SIZE_W[m.size])));
        // every tier where '@' picks this stage, alternating world (lvOff 0) and dungeon (lvOff 1) levels
        const k = L.stages.indexOf(st);
        const t1 = Math.min(9, k + 1 < L.stages.length ? L.stages[k + 1].tier - 1 : 9);
        const tiers = [];
        for (let t = Math.min(9, st.tier); t <= Math.max(t1, st.tier); t++) tiers.push(t);
        const rs = [];
        const n = Math.max(20, N, 2 * tiers.length);
        for (let i = 0; i < n; i++) {
          const Ti = tiers[i % tiers.length];
          rs.push(fight({ tier: Ti, lvOff: Math.floor(i / tiers.length) % 2 }, Ti, [[st.mon, cnt, cnt]], 'standard', useReal));
        }
        const lost = rs.reduce((a, r) => a + r.lost, 0) / rs.length, rounds = rs.reduce((a, r) => a + r.rounds, 0) / rs.length;
        // a pure group of `cnt` is worth cnt × SIZE_W, not exactly 3.2: compare like with like
        const w = cnt * CM.SIZE_W[m.size] / 3.2;
        rows.push({ id: st.mon, lid, T, cnt, lost, rounds, lostN: lost / w, roundsN: rounds / Math.pow(w, 0.8) });
      }
    }
    rows.sort((a, b) => b.lostN - a.lostN);
    for (const r of rows) console.log(`  ${r.id.padEnd(14)} T${r.T} ×${r.cnt}  lost ${pct(r.lost)}  rounds ${r.rounds.toFixed(2)}  (per 3.2: ${pct(r.lostN)} / ${r.roundsN.toFixed(2)})`);
    const q = (a, k) => { const s = a.map((r) => r[k]).sort((x, y) => x - y); return [s[Math.floor(s.length * 0.1)], s[Math.floor(s.length / 2)], s[Math.floor(s.length * 0.9)]]; };
    console.log(`  spread (p10 / median / p90): lost ${q(rows, 'lostN').map((v) => pct(v)).join(' / ')}  rounds ${q(rows, 'roundsN').map((v) => v.toFixed(2)).join(' / ')}`);
    out.species = rows;
    if (FIT) {
      const base = CM.loadTuning();
      base.monsters = base.monsters || {};
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const r2 = (v) => Math.round(v * 100) / 100;
      for (const r of rows) {
        const fh = clamp(Math.pow(R_T / Math.max(0.5, r.roundsN), DAMP / 0.8), 0.75, 1.5);
        const fd = clamp(Math.pow(L_T / Math.max(0.005, r.lostN), DAMP) / Math.pow(fh, 0.8 * DAMP), 0.5, 2.0);
        const cur = Object.assign({}, DB.monsters[r.id].s || {});
        const sv = Object.assign({}, cur);
        sv.hp = r2(clamp((cur.hp != null ? cur.hp : 1) * fh, 0.5, 2.5));
        sv.atk = r2(clamp((cur.atk != null ? cur.atk : 1) * fd, 0.3, 2.5));
        sv.mag = r2(clamp((cur.mag != null ? cur.mag : 1) * fd, 0.3, 2.5));
        for (const k of Object.keys(sv)) if (sv[k] === 1) delete sv[k];
        const e = base.monsters[r.id] = base.monsters[r.id] || {};
        e.s = sv;
        const why = `sim_zones --fit (game engine, pure group ×${r.cnt} at T${r.T}): HP lost ${pct(r.lostN)} → ${pct(L_T)}, rounds ${r.roundsN.toFixed(2)} → ${R_T}`;
        e.why = e.desc ? why + ' ／ ' + String(e.why || '').split(' ／ ').filter((x) => x.startsWith('desc:')).join(' ／ ') : why;
      }
      if (!flag('fit-free')) projectLineages(base, Dd, rows.map((r) => [r.lid, r.id]));
      delete base.global;
      fs.writeFileSync(FIT, JSON.stringify(base, null, 2) + '\n');
      console.log(`  candidate overlay → ${FIT}`);
    }
  }
  const jf = opt('json', null);
  if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
  console.log(`\n[sim_zones] ${failures ? 'FAIL' : 'PASS'} (${((Date.now() - t0) / 1000).toFixed(1)}s, engine ${out.engine})`);
  process.exit(failures ? 1 : 0);
}
main();
