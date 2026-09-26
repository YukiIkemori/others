// A12 boss/loot simulation model (node only; used by tools/sim_bosses.js, tools/sim_loot.js
// and tools/test_boss.js). A compact, self-contained implementation of the DESIGN §4 battle
// rules, used while the Chronicle battle engine (battle A2) is not in place, and as a second
// opinion afterwards. It reads the real data (DB.monsters / actions / troops / companions /
// heroTypes / lineages / items) and the constants from R.Rules.K when rules has them.
//
// What it models (normative sections in brackets):
//   monsters: fillStats for mobs / rare / bosses incl. hpShare and 'add' [§9.1.2, §9.11.2,
//     §4.14.2-3], stretch to Lb, boss status defaults [§4.8.3]; AI: weights + conds hpBelow
//     hpAbove every once round countBelow allyDown [§9.1.7], the engine's re-pick rules for
//     pointless heals/buffs/revives, row weights 2:1 / aim middle 3:1 [§4.5.3, §3.3.9].
//   effects: damage (phys/magic/breath, hits, random re-pick, kind, element(s), acc, drain,
//     mp:true, vs), status, buff, heal, revive, dispel(good), summon, on:'self' [§9.1.6, §4.6].
//   phases [§9.11.1]: first time hp% < hpBelow → applied at the end of that action.
//   party: hero + 3 from real data, level/gear per tier [§4.17.1, §4.2.2, §4.3, §4.4]; known
//     techs/spells EXPECT(T) [§4.9.4]; auto-like AI (revive → heal → focus offence) [§4.13.2];
//     items 回復35%×6・蘇生×3・MP30%×3; statuses [§4.8.1]; glimmer rolls [§4.9.2-4].
// It is a model, not the engine: numbers are for balance targets, not frame-exact replays.
'use strict';

module.exports = function makeModel(R, opts) {
  opts = opts || {};
  const DB = R.DB;
  const RK = (R.Rules && R.Rules.K) || {};
  const rng = opts.rng || Math.random;
  const rf = (a, b) => a + (b - a) * rng();
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const weighted = (list) => {
    let t = 0; for (const x of list) t += x.w;
    let r = rng() * t;
    for (const x of list) { r -= x.w; if (r < 0) return x; }
    return list[list.length - 1];
  };

  // ------------------------------------------------------------------ constants (§4, §9)
  const pickK = (k, d) => (RK[k] != null ? RK[k] : d);
  const W = pickK('W', [8, 14, 21, 30, 40, 51, 64, 78, 94, 112]);
  const U = pickK('U', [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6]);
  const LZ = (T) => 6 + 6 * T;
  const Dset = (T) => 70 + 30 * T;
  const DK = (Lb) => 40 + 5 * Lb;
  const STAGE = [0.63, 0.77, 1, 1.3, 1.6];
  const stage = (n) => STAGE[clamp(n | 0, -2, 2) + 2];
  const curve = (L) => {
    const atk = 4 + 3.15 * Math.pow(Math.max(0, L - 1), 0.9);
    return { hp: 6 + 2.6 * L + 0.1 * L * L, atk, mag: 0.85 * atk, def: 20 + 2.5 * L, mdef: 20 + 2.5 * L,
      agi: 24 + 0.6 * L, exp: 3 + 1.2 * L + 0.06 * L * L, gold: 2 + 0.5 * L + 0.07 * L * L };
  };
  const hpBoss = (L) => curve(L).hp * (0.65 + 0.05 * clamp((L - 6) / 6, 0, 10));
  const SIZE = { s: { hp: 0.7, atk: 0.9, def: 0.9, rw: 0.7 }, m: { hp: 1, atk: 1, def: 1, rw: 1 }, l: { hp: 2.0, atk: 1.15, def: 1.1, rw: 1.8 } };
  const MOB = { atk: 0.6, mag: 0.6 };
  const BOSS = {
    prologue: { hpMul: 11, atk: 1.25, mag: 1.25, def: 1.1, agi: 1.0, exp: 10, gold: 15 },
    mid: { hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, exp: 10, gold: 15 },
    region: { hpMul: 18, atk: 1.5, mag: 1.4, def: 1.2, agi: 1.2, exp: 20, gold: 15 },
    rival: { hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, exp: 10, gold: 15 },
    fmid: { hpMul: 20, atk: 1.5, mag: 1.5, def: 1.2, agi: 1.2, exp: 20, gold: 15 },
    last1: { hpMul: 30, atk: 1.6, mag: 1.6, def: 1.25, agi: 1.3, exp: 40, gold: 15 },
    last2: { hpMul: 36, atk: 1.6, mag: 1.6, def: 1.25, agi: 1.3, exp: 40, gold: 15 },
    echo: { hpMul: 30, atk: 1.7, mag: 1.7, def: 1.25, agi: 1.3, exp: 30, gold: 15 },
    super: { hpMul: 45, atk: 1.8, mag: 1.8, def: 1.3, agi: 1.4, exp: 40, gold: 15 },
  };
  const BOSS_RES = { death: 1, sleep: 0.75, paralyze: 0.75, freeze: 0.75, confuse: 0.75, stun: 0.5, silence: 0.5, blind: 0.5, poison: 0.25, burn: 0.25 };
  const EXPECT = [2, 4, 6, 8, 10, 12, 14, 16, 17, 19];
  // A17 (SYSTEMS_REWORK §1.2, §4.3): the main weapon at PROF_TRACK[T]; rank r needs round(11·(r−1)^1.18); a tech of glim.lv L
  // needs rank TECH_PROF[L]
  const PROF_TRACK = [180, 370, 555, 745, 935, 1125, 1315, 1505, 1675, 1850];
  const TECH_PROF = [0, 1, 3, 8, 14, 20, 26, 32, 40, 50, 60];
  const PROF_PTS = [0].concat(Array.from({ length: 100 }, (_, i) => Math.round(11 * Math.pow(i, 1.18))));
  const profRank = (p) => { let r = 0; for (let i = 0; i < PROF_PTS.length; i++) if (p >= PROF_PTS[i]) r = i; return r; };
  const GLIM = { tech: 0.012, secret: 0.006, single: 0.015, comboA: 0.012, comboB: 0.010, triple: 0.008, cap: 0.35 };
  const APT = { S: 2, A: 1.5, B: 1, C: 0.6, D: 0.3 };
  const GROW_HP = { S: 1.25, A: 1.12, B: 1.0, C: 0.9, D: 0.8 };
  const GROW_MW = { S: 1.3, A: 1.15, B: 1.0, C: 0.85, D: 0.7 };   // K.GROW.mp (A18)
  const HPlv = (L) => 17.5 + 14.7 * Math.pow(L - 1, 0.9);
  const MPlv = (L) => 8 + 2.6 * Math.pow(L - 1, 0.85);
  const WT = {
    sword: { two: 0, reach: 0, kind: 'slash', mul: 1.0, hit: 0, crit: 2, s: ['str'] },
    greatsword: { two: 1, reach: 0, kind: 'slash', mul: 1.4, hit: -5, crit: 2, s: ['str'] },
    dagger: { two: 0, reach: 0, kind: 'pierce', mul: 0.75, hit: 8, crit: 10, s: ['dex'] },
    axe: { two: 0, reach: 0, kind: 'slash', mul: 1.15, hit: -10, crit: 4, s: ['str'] },
    spear: { two: 1, reach: 1, kind: 'pierce', mul: 1.25, hit: 0, crit: 2, s: ['str', 'dex'] },
    bow: { two: 1, reach: 1, kind: 'pierce', mul: 1.1, hit: 5, crit: 4, s: ['dex'] },
    staff: { two: 0, reach: 1, kind: 'blunt', mul: 0.6, hit: 0, crit: 0, s: ['str', 'int'], magW: 1 },   // A19: reaches from the back row
  };
  const WEIGHT = { heavy: { def: 1, mdef: 0.2, eva: 8, st: ['str', 'vit'] }, light: { def: 0.65, mdef: 0.35, eva: 5, st: ['dex', 'agi'] }, cloth: { def: 0.4, mdef: 0.6, eva: 2, st: ['int', 'mnd'] } };
  const DUR = { sleep: [2, 4], paralyze: [1, 3], freeze: [1, 2], stun: [1, 1], confuse: [2, 4], silence: [3, 5], blind: [3, 5], burn: [3, 3], regen: [5, 5], veil: [3, 3], poison: [99, 99], counter: [1, 1], nimble: [3, 3], cover: [1, 1] };
  const DISABLING = { sleep: 1, paralyze: 1, freeze: 1, stun: 1 };
  const GOOD = { regen: 1, veil: 1, counter: 1, nimble: 1, cover: 1 };
  const ELS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];

  // ------------------------------------------------------------------ monsters
  function resolveRef(ref, tier) {
    if (typeof ref === 'string' && ref[0] === '@') {
      const lin = DB.lineages && DB.lineages[ref.slice(1)];
      if (!lin) return null;
      let best = null;
      for (const st of lin.stages) if (st.tier <= tier) best = st.mon;
      return best;
    }
    return ref;
  }
  /** nominal stats at Lb (what R.Mon.fillStats + R.Mon.def would give) */
  function monStats(id, Lb) {
    const d = DB.monsters[id];
    if (!d) throw new Error('unknown monster ' + id);
    const s = Object.assign({ hp: 1, atk: 1, mag: 1, def: 1, mdef: 1, agi: 1 }, d.s || {});
    const c = curve(Lb);
    const flags = d.flags || [];
    if (flags.includes('boss')) {
      const lead = d.bossType === 'add' ? (DB.monsters[d.addOf] || {}).bossType : d.bossType;
      const B = BOSS[lead] || BOSS.mid;
      const share = d.hpShare != null ? d.hpShare : B.hpMul;
      const k = d.bossType === 'add' ? { exp: 2, gold: 2 } : B;
      return {
        hp: Math.round(hpBoss(Lb) * share * s.hp), atk: Math.round(c.atk * B.atk * s.atk), mag: Math.round(c.mag * B.mag * s.mag),
        def: Math.round(c.def * B.def * s.def), mdef: Math.round(c.mdef * B.def * s.mdef), agi: Math.round(c.agi * B.agi * s.agi),
        exp: Math.round(c.exp * k.exp), gold: Math.round(c.gold * k.gold), eva: d.eva != null ? d.eva : 5, crit: 3,
      };
    }
    const sz = SIZE[d.size] || SIZE.m;
    const rare = flags.includes('rare'), metal = flags.includes('metal');
    const mob = rare || metal ? { atk: 1, mag: 1 } : MOB;
    const kind = rare ? { exp: 5, gold: 5 } : metal ? { exp: 30, gold: 10 } : { exp: 1, gold: 1 };
    const rw = Object.assign({ exp: 1, gold: 1 }, d.rw || {});
    return {
      hp: d.hpFixed || Math.round(c.hp * sz.hp * s.hp), atk: Math.round(c.atk * sz.atk * s.atk * mob.atk), mag: Math.round(c.mag * s.mag * mob.mag),
      def: Math.round(c.def * sz.def * s.def), mdef: Math.round(c.mdef * s.mdef), agi: Math.round(c.agi * s.agi),
      exp: Math.round(c.exp * sz.rw * rw.exp * kind.exp * (d.race === 'dragon' ? 1.2 : 1)), gold: Math.round(c.gold * sz.rw * rw.gold * kind.gold),
      eva: d.eva != null ? d.eva : (metal ? 30 : rare ? (flags.includes('flying') ? 20 : 15) : flags.includes('flying') ? 12 : (s.agi >= 1.3 ? 15 : 5)), crit: 2,
    };
  }
  function makeMon(id, Lb, extra) {
    const d = DB.monsters[id];
    const st = monStats(id, Lb);
    const flags = d.flags || [];
    const boss = flags.includes('boss'), rare = flags.includes('rare');
    const res = Object.assign({}, d.statusRes || {});
    if (boss || rare) for (const k in BOSS_RES) res[k] = Math.max(res[k] || 0, BOSS_RES[k]);
    return Object.assign({
      side: 'mon', id, d, name: d.name, lv: Lb, alive: true, gone: false,
      hp: st.hp, mhp: st.hp, atk: st.atk, mag: st.mag, def: st.def, mdef: st.mdef, agi: st.agi, eva: st.eva, crit: st.crit,
      exp: st.exp, gold: st.gold,
      elem: Object.assign({}, d.elem || {}), phys: Object.assign({}, d.phys || {}), res,
      acts: 0, used: {}, phaseDone: [], apt: d.actsPerTurn || 1,
      buffs: { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 }, status: {}, boss, rare, summoned: false,
    }, extra || {});
  }

  // ------------------------------------------------------------------ party
  const wtypeOfItem = (id) => (id && /^w_([a-z]+)_/.exec(id) || [])[1];
  const ROLE_OF_HERO = { warrior: 'guard', ranger: 'ranged', mage: 'caster', spellblade: 'hybrid', wanderer: 'hybrid' };
  const WEIGHT_OF_ROLE = { guard: 'heavy', striker: 'light', hybrid: 'light', ranged: 'light', caster: 'cloth', healer: 'cloth' };
  function techList(wtype) {
    return Object.keys(DB.actions).filter((k) => { const a = DB.actions[k]; return a.kind === 'tech' && a.wtype === wtype && a.glim; })
      .sort((a, b) => DB.actions[a].glim.lv - DB.actions[b].glim.lv);
  }
  function spellList() {
    return Object.keys(DB.actions).filter((k) => { const a = DB.actions[k]; return a.kind === 'spell' && a.glim && a.elements; })
      .sort((a, b) => DB.actions[a].glim.lv - DB.actions[b].glim.lv || (DB.actions[a].order || 0) - (DB.actions[b].order || 0));
  }
  let TECHS = null, SPELLS = null;
  const techsOf = (w) => { TECHS = TECHS || {}; return TECHS[w] || (TECHS[w] = techList(w)); };
  const spells = () => SPELLS || (SPELLS = spellList());

  /**
   * member spec: 'hero' (with o.heroType/o.favor) or a companion id.
   * o: {tier, level, gear:'shop'|'rare'|'super'|'realistic'|'strong', heroType, favor:{kind,id}}
   */
  function makeChar(spec, o, idx) {
    const T = o.tier;
    let rowOverride = null;
    if (spec.indexOf(':') > 0) { rowOverride = spec.split(':')[1]; spec = spec.split(':')[0]; }
    let base, apt, growth, row, role, wtype, name, innate = {};
    if (spec === 'hero') {
      const H = DB.heroTypes[o.heroType || 'warrior'];
      base = Object.assign({}, H.stats); apt = JSON.parse(JSON.stringify(H.apt)); growth = H.growth; name = '主人公';
      role = ROLE_OF_HERO[o.heroType || 'warrior'] || 'hybrid';
      const fav = o.favor || { kind: 'weapon', id: (H.favorOptions && H.favorOptions.weapon && H.favorOptions.weapon[0]) || 'sword' };
      if (fav.kind === 'weapon') { apt.w[fav.id] = 'S'; wtype = fav.id; } else { apt.e[fav.id] = 'S'; wtype = wtypeOfItem(H.defaultWeapon) || 'staff'; }
      if (!wtype || !WT[wtype]) wtype = wtypeOfItem(H.defaultWeapon) || 'sword';
      row = H.row === 'middle' || (H.row === 'auto' && !WT[wtype].reach && role === 'caster') ? 'middle' : H.row === 'auto' ? (WT[wtype].reach ? 'middle' : 'front') : (H.row || 'front');
      innate = H.mods || {};
    } else {
      const C = DB.companions[spec];
      if (!C) throw new Error('unknown companion ' + spec);
      base = Object.assign({}, C.stats); apt = C.apt; growth = C.growth; row = C.row; role = C.role; name = C.name;
      wtype = wtypeOfItem(C.startEquip && C.startEquip.weapon1) || 'sword';
      innate = (C.innate && C.innate.mods) || {};
    }
    const wt = WT[wtype] || WT.sword;
    if (row === 'middle' && !wt.reach && wtype !== 'staff' && role !== 'caster' && role !== 'healer' && role !== 'hybrid') row = 'front';
    if (rowOverride) row = rowOverride;
    const weight = WEIGHT_OF_ROLE[role] || 'light';
    const Wg = WEIGHT[weight];
    const gm = { shop: [1, 1], rare: [2, 2], super: [3, 3], realistic: [1, 2], strong: [2, 3] }[o.gear || 'shop'] || [1, 1];
    // units: weapon 2, shield 1 (not two-handed), head 1, body 2, hands 1, feet 1, acc 1 + 1
    const stats = Object.assign({}, base);
    const u = U[clamp(T, 0, 9)];
    const add = (k, units, mult) => { stats[k] = (stats[k] || 0) + Math.max(1, Math.round(units * u)) * mult; };
    const wS = wt.s;
    const pieces = [['w', 2], ['sh', 1], ['hd', 1], ['bd', 2], ['hn', 1], ['ft', 1], ['a1', 1], ['a2', 1]];
    let rareLeft = o.gear === 'realistic' ? 3 : o.gear === 'strong' ? 7 : 99;
    const primary = role === 'caster' || role === 'healer' ? (role === 'healer' ? 'mnd' : 'int') : wS[0];
    for (const [slot, n] of pieces) {
      if (slot === 'sh' && wt.two) continue;
      let mult = gm[0];
      if (gm[1] > gm[0] && rareLeft > 0 && slot !== 'sh') { mult = gm[1]; rareLeft--; }
      if (slot === 'w') { if (wS.length === 2) { add(wS[0], 1, mult); add(wS[1], 1, mult); } else add(wS[0], 2, mult); }
      else if (slot === 'a1' || slot === 'a2') add(primary, n, mult);
      else if (n === 2) { add(Wg.st[0], 1, mult); add(Wg.st[1], 1, mult); }
      else add(slot === 'hd' || slot === 'hn' ? Wg.st[0] : Wg.st[1], n, mult);
    }
    const L = o.level != null ? o.level : LZ(T) + 1;
    const WT_ = W[clamp(T, 0, 9)];
    const sVal = wS.length === 2 ? (stats[wS[0]] + stats[wS[1]]) / 2 : stats[wS[0]];
    const atk = Math.round(Math.round(WT_ * wt.mul) * (64 + sVal) / 64);
    const Wm = wt.magW ? WT_ : 0.5 * WT_;
    const mag = Math.round(Wm * (64 + stats.int) / 64);
    const D = Dset(T);
    const cover = wt.two ? 0.8 : 1.0;           // shield 0.2 of the set
    const def = Math.round(D * cover * Wg.def);
    const mdef = Math.round(D * cover * Wg.mdef) + Math.floor(stats.mnd / 2);
    const VIT = (160 + stats.vit) / 200;
    const mhp = Math.min(999, Math.round(HPlv(L) * GROW_HP[growth.hp || 'B'] * VIT));
    const mmp = Math.min(250, Math.round(MPlv(L) * GROW_MW[growth.mp || 'B']));
    const pr = profRank(PROF_TRACK[clamp(T, 0, 9)]);
    // known techs & spells: EXPECT(T) (lowest glim.lv first; main weapon, favoured elements)
    const count = o.known != null ? o.known : EXPECT[clamp(T, 0, 9)];
    const aptEls = ELS.filter((e) => 'SAB'.includes(apt.e[e] || 'C')).sort((a, b) => 'SABCD'.indexOf(apt.e[a]) - 'SABCD'.indexOf(apt.e[b]));
    const rankCap = T + 3;
    const techPool = techsOf(wtype).filter((id) => DB.actions[id].glim.lv <= rankCap && pr >= TECH_PROF[DB.actions[id].glim.lv]);
    const spellPool = spells().filter((id) => {
      const a = DB.actions[id];
      if (a.glim.lv > rankCap || (a.glim.prof || 0) > pr) return false;
      return a.elements.every((e) => aptEls.includes(e));
    });
    // share of EXPECT(T) on the main weapon / on spells (§4.9.5: a warrior ends with ~10 of 11 on the
    // main weapon and 6–10 on the second one; a caster mostly single-element spells + some staff techs)
    const share = { guard: [0.6, 0.1], striker: [0.6, 0.05], ranged: [0.6, 0.1], hybrid: [0.4, 0.4], caster: [0.2, 0.7], healer: [0.2, 0.7] }[role] || [0.5, 0.2];
    let nTe = Math.min(techPool.length, Math.round(count * share[0]));
    let nSp = Math.min(spellPool.length, Math.max(role === 'caster' || role === 'healer' ? 1 : 0, Math.round(count * share[1])));
    // healers learn heals first
    const healFirst = spellPool.filter((id) => DB.actions[id].effects.some((e) => e.type === 'heal' || e.type === 'revive'));
    const others = spellPool.filter((id) => !healFirst.includes(id));
    const sp = (role === 'healer' || role === 'caster' || role === 'hybrid' || (apt.e.light && 'SA'.includes(apt.e.light)) ? healFirst.concat(others) : others.concat(healFirst)).slice(0, nSp);
    const known = new Set(techPool.slice(0, nTe).concat(sp));
    const extra = Math.max(0, count - known.size);        // techs of the 2nd weapon etc. (count for FK only)
    const c = {
      side: 'party', idx, spec, name, row, role, wtype, apt, stats, level: L,
      mhp, hp: mhp, mmp, mp: mmp, atk, mag, def, mdef,
      hit: 90 + Math.floor(stats.dex / 4) + wt.hit, crit: Math.min(60, 2 + Math.floor(stats.dex / 16) + wt.crit),
      eva: Math.min(60, Math.floor(stats.agi / 5) + (wt.two ? 0 : Wg.eva)), spd: stats.agi,
      known, extra, prof: pr, alive: true, gone: false,
      buffs: { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 }, status: {}, defend: false,
      sres: (innate && innate.statusResist) || {}, simm: (innate && innate.statusImmune) || [],
      glimPct: 0,
    };
    return c;
  }
  function makeParty(o) {
    const members = o.members || ['hero', 'brigitta', 'marta', 'sylvain'];
    return members.map((m, i) => makeChar(m, o, i));
  }

  // ------------------------------------------------------------------ battle
  function Battle(o) {
    this.o = o;
    this.tier = o.tier;
    this.Lb = o.Lb;
    this.party = o.party;
    this.mons = [];
    this.round = 0;
    this.log = o.log ? [] : null;
    this.ev = { encore: 0, feed: 0, summon: {}, phase: {}, rewind: 0, revive: 0, glimmers: 0, koSet: new Set(), healsBoss: 0, dispelled: 0 };
    this.items = Object.assign({ i_salve: 6, i_revive: 3, i_ether: 3 }, o.items || {});
    this.dk = DK(o.Lb);
    this.rankB = o.rankB;
    this.ef = o.ef;
    this.boss = false;
  }
  const B = Battle.prototype;
  B.say = function (s) { if (this.log) this.log.push(s); };
  B.living = function (side) { return (side === 'mon' ? this.mons : this.party).filter((u) => u.alive && !u.gone); };
  B.addMon = function (id, extra) {
    const u = makeMon(id, this.Lb, extra);
    u.key = this.mons.length;
    this.mons.push(u);
    return u;
  };
  B.frontAlive = function () { return this.party.some((p) => p.alive && p.row === 'front'); };
  B.effRow = function (p) { return this.frontAlive() ? p.row : 'front'; };
  B.pickParty = function (aim) {
    const l = this.living('party');
    if (!l.length) return null;
    if (aim === 'low') return l.slice().sort((a, b) => a.hp / a.mhp - b.hp / b.mhp)[0];
    return weighted(l.map((p) => ({ p, w: aim === 'middle' ? (this.effRow(p) === 'middle' ? 3 : 1) : (this.effRow(p) === 'front' ? 2 : 1) }))).p;
  };

  // --- damage
  B.elemMult = function (tgt, eff, act, user) {
    let els = null;
    if (eff.element) els = [eff.element];
    else if (act && act.elements && act.elements.length) els = act.elements;
    else if (user && user.side === 'party' && eff._weaponEl) els = [eff._weaponEl];
    if (!els) return { m: 1, el: null };
    let best = -9, bel = null;
    for (const e of els) {
      const m = tgt.side === 'mon' ? (tgt.elem[e] != null ? tgt.elem[e] : 1) : 1;
      if (m > best) { best = m; bel = e; }
    }
    return { m: best, el: bel };
  };
  B.hitDamage = function (user, tgt, eff, act) {
    const f = eff.formula || (act && act.kind === 'spell' ? 'magic' : 'phys');
    const P = eff.power != null ? eff.power : 1;
    const em = this.elemMult(tgt, eff, act, user);
    let dmg, crit = false;
    if (f === 'phys') {
      const hitRate = clamp((user.side === 'mon' ? 95 : user.hit) * (eff.acc || 1) - (tgt.side === 'mon' ? tgt.eva : tgt.eva), 20, 100) / 100
        * (user.status.blind ? 0.5 : 1);
      const sure = Object.keys(DISABLING).some((s) => tgt.status[s]);
      if (!sure && !eff.sure && rng() >= hitRate) return { miss: true };
      crit = rng() * 100 < (user.crit + (eff.critBonus || 0));
      const guard = crit ? 1 : this.dk / (this.dk + tgt.def * (1 - (eff.ignoreDef || 0)));
      const kind = eff.kind || (user.side === 'party' ? (WT[user.wtype] || WT.sword).kind : null);
      const km = tgt.side === 'mon' && kind && tgt.phys[kind] != null ? tgt.phys[kind] : 1;
      const row = tgt.side === 'party' && this.effRow(tgt) === 'middle' ? 0.7 : 1;
      let vs = 1;
      if (eff.vs) for (const k in eff.vs) if ((tgt.d && (tgt.d.race === k || (tgt.d.flags || []).includes(k))) || tgt.status[k]) vs = Math.max(vs, eff.vs[k]);
      dmg = user.atk * P * guard * km * em.m * vs * row * stage(user.buffs.atk) / stage(tgt.buffs.def) * (crit ? 1.5 : 1) * rf(0.9, 1.1);
    } else if (f === 'magic') {
      dmg = user.mag * P * this.dk / (this.dk + tgt.mdef * (1 - (eff.ignoreMdef || 0))) * em.m * stage(user.buffs.mag) / stage(tgt.buffs.mdef) * rf(0.95, 1.05);
    } else if (f === 'breath') {
      dmg = user.atk * P * em.m * rf(0.9, 1.1);
    } else if (f === 'tier') {
      dmg = P * W[clamp(this.tier, 0, 9)] * em.m * rf(0.9, 1.1);
    } else if (f === 'fixed') dmg = P * rf(0.95, 1.05);
    else if (f === 'percent') { if (tgt.boss) return { miss: true }; dmg = tgt.hp * P; }
    else dmg = user.atk * P;
    if (tgt.defend) dmg *= 0.5;
    if (em.m === 0) dmg = 0;
    else if (dmg >= 0) dmg = Math.max(1, Math.round(dmg));
    else dmg = Math.round(dmg);
    return { dmg: Math.min(9999, dmg), crit };
  };
  B.applyDamage = function (user, tgt, r, eff) {
    if (r.miss) return 0;
    let n = r.dmg;
    if (eff.mp) {
      if (tgt.side === 'party') { const m = Math.min(tgt.mp, n); tgt.mp -= m; n = m; } else n = 0;
      if (eff.drain && n > 0 && user.alive) user.hp = Math.min(user.mhp, user.hp + n);
      return 0;
    }
    if (n < 0) { tgt.hp = Math.min(tgt.mhp, tgt.hp - n); return 0; }
    tgt.hp -= n;
    if (this.log) this.say(`    ${tgt.name} -${n}${r.crit ? '!' : ''} (${Math.max(0, tgt.hp)}/${tgt.mhp})`);
    if (tgt.status.sleep && rng() < 0.5) delete tgt.status.sleep;
    if (tgt.status.confuse && rng() < 0.5) delete tgt.status.confuse;
    if (tgt.status.freeze && eff._el === 'fire') delete tgt.status.freeze;
    if (eff.drain && user.alive) user.hp = Math.min(user.mhp, user.hp + Math.round(n * eff.drain));
    if (tgt.hp <= 0) this.die(tgt);
    else if (tgt.side === 'mon') this.checkPhase(tgt);
    return n;
  };
  B.die = function (u) {
    u.hp = 0; u.alive = false; u.status = {}; u.buffs = { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 };
    if (u.side === 'party') this.ev.koSet.add(u.idx);
  };
  B.checkPhase = function (u) {
    const ph = u.d.phases;
    if (!ph) return;
    for (let i = 0; i < ph.length; i++) {
      if (u.phaseDone[i] || u.phasePending === i) continue;
      if (u.hp / u.mhp < ph[i].hpBelow) { (u.phaseQueue = u.phaseQueue || []).push(i); u.phaseDone[i] = true; }
    }
  };
  B.flushPhases = function () {
    for (const u of this.mons) {
      if (!u.phaseQueue || !u.phaseQueue.length) continue;
      for (const i of u.phaseQueue) {
        if (!u.alive) continue;
        const set = u.d.phases[i].set || {};
        if (set.actsPerTurn) u.apt = set.actsPerTurn;
        if (set.elem) Object.assign(u.elem, set.elem);
        if (set.phys) Object.assign(u.phys, set.phys);
        if (set.buffs) for (const k in set.buffs) u.buffs[k] = clamp(u.buffs[k] + set.buffs[k], -2, 2);
        const key = u.id + '#' + i;
        this.ev.phase[key] = (this.ev.phase[key] || 0) + 1;
        this.say('PHASE ' + u.d.phases[i].msg);
      }
      u.phaseQueue = [];
    }
  };
  B.statusResist = function (tgt, s) {
    if (tgt.side === 'mon') return tgt.res[s] || 0;
    if (tgt.simm.includes(s)) return 1;
    return Math.min(0.9, (tgt.stats.mnd || 0) / 500 + (tgt.sres[s] || 0));
  };
  B.inflict = function (user, tgt, s, chance) {
    if (!tgt.alive) return false;
    if (GOOD[s]) { tgt.status[s] = ri(DUR[s][0], DUR[s][1]); return true; }
    if (tgt.status.veil) return false;
    if (s === 'death') { if (tgt.boss || tgt.rare) return false; if (rng() < (chance || 1) * (1 - this.statusResist(tgt, 'death'))) { this.die(tgt); return true; } return false; }
    const sf = user.side === 'party' ? clamp((128 + (user.stats.int || 0)) / 168, 0.6, 2.0) : 1;
    const p = clamp((chance == null ? 1 : chance) * sf * (1 - this.statusResist(tgt, s)), 0, 0.95);
    if (tgt.status[s] || rng() >= p) return false;
    if (DISABLING[s]) for (const k in DISABLING) delete tgt.status[k];
    if (s === 'freeze') delete tgt.status.burn;
    if (s === 'burn') delete tgt.status.freeze;
    const dur = (tgt.boss && (s === 'sleep' || s === 'paralyze' || s === 'freeze')) ? [1, 1] : (tgt.boss && s === 'confuse') ? [1, 2] : DUR[s] || [2, 3];
    tgt.status[s] = ri(dur[0], dur[1]);
    return true;
  };
  B.buff = function (user, tgt, stat, st, chance) {
    if (!tgt.alive) return;
    if (st < 0) {
      if (tgt.status.veil) return;
      let p = chance == null ? 1 : chance;
      if (tgt.boss || tgt.rare) p *= 0.5;
      if (rng() >= p) return;
    }
    tgt.buffs[stat] = clamp(tgt.buffs[stat] + st, -2, 2);
  };

  // --- actions
  B.targetsFor = function (user, act, chosen) {
    const foes = user.side === 'mon' ? this.living('party') : this.living('mon');
    const friends = user.side === 'mon' ? this.living('mon') : this.living('party');
    switch (act.target) {
      case 'enemy': return chosen && chosen.alive ? [chosen] : foes.length ? [user.side === 'mon' ? this.pickParty(act.aim) : foes[0]] : [];
      case 'group': case 'enemies': return foes;
      case 'random': return foes;
      case 'self': return [user];
      case 'ally': return chosen ? [chosen] : friends.slice().sort((a, b) => a.hp / a.mhp - b.hp / b.mhp).slice(0, 1);
      case 'allies': return friends;
      case 'ally_dead': {
        const pool = (user.side === 'mon' ? this.mons : this.party).filter((u) => !u.alive && !u.gone);
        return chosen && !chosen.alive ? [chosen] : pool.slice(0, 1);
      }
      default: return foes.slice(0, 1);
    }
  };
  B.effect = function (user, tgt, eff, act) {
    switch (eff.type) {
      case 'damage': {
        const hits = eff.hits || 1;
        let total = 0;
        for (let h = 0; h < hits; h++) {
          let t = tgt;
          if (act.target === 'random') {
            const foes = user.side === 'mon' ? this.living('party') : this.living('mon');
            if (!foes.length) break;
            t = user.side === 'mon' ? this.pickParty() : foes[Math.floor(rng() * foes.length)];
          }
          if (!t || !t.alive) break;
          const r = this.hitDamage(user, t, eff, act);
          const em = this.elemMult(t, eff, act, user);
          eff._el = em.el;
          total += this.applyDamage(user, t, r, eff);
        }
        return total;
      }
      case 'status': this.inflict(user, tgt, eff.status, eff.chance); return 0;
      case 'buff': this.buff(user, tgt, eff.stat, eff.stages, eff.chance); return 0;
      case 'heal': {
        const t = eff.on === 'self' ? user : tgt;
        if (!t.alive) return 0;
        const mndf = user.side === 'party' ? clamp((128 + user.stats.mnd) / 168, 0.75, 2.2) : 1;
        const n = Math.round(t.mhp * eff.pct * mndf);
        t.hp = Math.min(t.mhp, t.hp + n);
        if (t.side === 'mon') this.ev.healsBoss++;
        return 0;
      }
      case 'healMp': if (tgt.side === 'party') tgt.mp = Math.min(tgt.mmp, tgt.mp + Math.round(tgt.mmp * eff.pct)); return 0;
      case 'revive': if (!tgt.alive && !tgt.gone) { tgt.alive = true; tgt.hp = Math.max(1, Math.round(tgt.mhp * eff.pct)); if (tgt.side === 'mon') this.ev.revive++; } return 0;
      case 'dispel': {
        const t = eff.on === 'self' ? user : tgt;
        if (eff.side === 'good' || !eff.side) { for (const k in t.buffs) if (t.buffs[k] > 0) { t.buffs[k] = 0; this.ev.dispelled++; } for (const s in GOOD) delete t.status[s]; }
        if (eff.side === 'bad' || eff.side === 'all') { for (const k in t.buffs) if (t.buffs[k] < 0) t.buffs[k] = 0; }
        return 0;
      }
      case 'cure': for (const s in t_bad) delete tgt.status[s]; return 0;
      case 'summon': return 0;   // handled per action
      default: return 0;
    }
  };
  const t_bad = { poison: 1, burn: 1, sleep: 1, paralyze: 1, freeze: 1, stun: 1, confuse: 1, silence: 1, blind: 1 };
  B.useAction = function (user, id, chosen) {
    const act = id === 'attack' ? { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1 }] } : DB.actions[id];
    if (!act) return;
    if (this.log) this.say(`R${this.round} ${user.name}${user.side === 'mon' ? '' : '(' + user.hp + '/' + user.mhp + ' mp' + user.mp + ')'} → ${id === 'attack' ? '攻撃' : act.name}${chosen ? ' @' + chosen.name : ''}`);
    if (id !== 'attack' && user.side === 'party') {
      if (act.mp) user.mp -= act.mp;
    }
    const summon = act.effects.find((e) => e.type === 'summon');
    if (summon) { this.doSummon(user, summon, act); return; }
    const tgts = this.targetsFor(user, act, chosen);
    const selfEffects = act.effects.filter((e) => e.on === 'self');
    const main = act.effects.filter((e) => e.on !== 'self');
    if (act.target === 'random') {
      // one pass: damage effects pick their own targets per hit; others hit a random foe
      for (const eff of main) {
        if (eff.type === 'damage') this.effect(user, null, eff, act);
        else { const foes = user.side === 'mon' ? this.living('party') : this.living('mon'); if (foes.length) this.effect(user, foes[Math.floor(rng() * foes.length)], eff, act); }
      }
    } else {
      for (const t of tgts) for (const eff of main) { if (!t.alive && eff.type !== 'revive') break; this.effect(user, t, eff, act); }
    }
    for (const eff of selfEffects) this.effect(user, user, eff, act);
    if (id === 'eb_encore') this.ev.encore++;
    if (id === 'eb_feed') this.ev.feed++;
    if (id === 'eb_rewind') this.ev.rewind++;
  };
  B.doSummon = function (user, eff, act) {
    const alive = this.living('mon').length;
    const present = this.mons.filter((m) => m.alive && !m.gone).length;
    if (alive >= (eff.max || 8) || present >= 8) { this.say('しかし、誰も来なかった。'); return; }
    let id = eff.mon;
    if (id === 'same') id = user.id;
    id = resolveRef(id, this.tier);
    if (!id || !DB.monsters[id]) return;
    for (let i = 0; i < (eff.n || 1); i++) {
      if (this.living('mon').length >= (eff.max || 8)) break;
      this.addMon(id, { summoned: true });
      this.ev.summon[id] = (this.ev.summon[id] || 0) + 1;
    }
  };

  // --- monster AI (§9.1.7 + the engine's re-pick rules)
  B.condOk = function (u, a) {
    const c = a.cond;
    if (!c) return true;
    const r = u.hp / u.mhp;
    if (c.hpBelow != null && !(r < c.hpBelow)) return false;
    if (c.hpAbove != null && !(r > c.hpAbove)) return false;
    if (c.every) { const n = Math.max(1, c.every[0] | 0); if (u.acts % n !== (c.every[1] | 0) % n) return false; }
    if (c.once && u.used[a.id]) return false;
    if (c.round != null && this.round < c.round) return false;
    if (c.alone && this.living('mon').length > 1) return false;
    if (c.countBelow != null && !(this.living('mon').length < c.countBelow)) return false;
    if (c.allyDown && !this.mons.some((m) => !m.alive && !m.gone)) return false;
    return true;
  };
  B.monPick = function (u) {
    let list = (u.d.actions || [{ id: 'attack', w: 1 }]).filter((a) => a.w > 0 && this.condOk(u, a));
    while (list.length) {
      const a = weighted(list);
      if (a.id === 'attack') return { id: 'attack', target: this.pickParty() };
      const act = DB.actions[a.id];
      if (!act) { list = list.filter((x) => x !== a); continue; }
      const heal = act.effects.some((e) => e.type === 'heal' && e.on !== 'self');
      const buff = act.effects.find((e) => e.type === 'buff' && (e.stages || 0) > 0);
      let ok = true, target = null;
      if (act.target === 'self') {
        if (heal && u.hp / u.mhp > 0.6) ok = false;
        if (buff && !heal && u.buffs[buff.stat] >= 2) ok = false;
      } else if (act.target === 'ally') {
        const pool = this.living('mon');
        if (heal) { target = pool.filter((m) => m.hp / m.mhp < 0.6).sort((x, y) => x.hp / x.mhp - y.hp / y.mhp)[0]; ok = !!target; }
      } else if (act.target === 'allies') {
        if (heal && !this.living('mon').some((m) => m.hp / m.mhp < 0.7)) ok = false;
      } else if (act.target === 'ally_dead') {
        target = this.mons.find((m) => !m.alive && !m.gone); ok = !!target;
      } else if (act.target === 'enemy') target = this.pickParty(act.aim);
      if (ok) return { id: a.id, target };
      list = list.filter((x) => x !== a);
    }
    return { id: 'attack', target: this.pickParty() };
  };

  // --- party AI (auto-like, §4.13.2)
  B.expectDmg = function (c, id, tgt) {
    const act = id === 'attack' ? null : DB.actions[id];
    const effs = act ? act.effects.filter((e) => e.type === 'damage') : [{ type: 'damage', formula: 'phys', power: 1 }];
    if (!effs.length) return 0;
    const foes = this.living('mon');
    const targets = !act || act.target === 'enemy' ? [tgt] : act.target === 'random' ? [tgt] : act.target === 'group' ? foes.filter((m) => m.id === tgt.id) : foes;
    let total = 0;
    for (const t of targets) {
      for (const e of effs) {
        const f = e.formula || (act && act.kind === 'spell' ? 'magic' : 'phys');
        const hits = e.hits || 1;
        const em = this.elemMult(t, e, act, c);
        let d;
        if (f === 'magic') d = c.mag * (e.power || 1) * this.dk / (this.dk + t.mdef) * em.m;
        else {
          const kind = e.kind || (WT[c.wtype] || WT.sword).kind;
          const km = t.phys[kind] != null ? t.phys[kind] : 1;
          const hr = clamp(c.hit * (e.acc || 1) - t.eva, 20, 100) / 100;
          d = c.atk * (e.power || 1) * this.dk / (this.dk + t.def * (1 - (e.ignoreDef || 0))) * km * em.m * hr;
        }
        total += d * hits * (act && act.target === 'random' ? 1 : 1);
      }
    }
    return total;
  };
  B.focusTarget = function () {
    const foes = this.living('mon');
    let best = null, bs = -1;
    for (const m of foes) {
      const heals = (m.d.actions || []).some((a) => /encore|shade_raise|shade_heal|feed/.test(a.id));
      const thr = (m.atk + m.mag * 0.5) * (m.apt || 1) * (heals ? 1.6 : 1);
      const s = thr / Math.max(1, m.hp);
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  };
  B.usable = function (c, id) {
    const a = DB.actions[id];
    if (!a) return false;
    if (a.mp && c.mp < a.mp) return false;
    if ((a.magic || a.kind === 'spell') && c.status.silence) return false;
    if (a.kind === 'tech' && this.effRow(c) === 'middle' && !a.reach && !(WT[a.wtype] || {}).reach) return false;
    return true;
  };
  B.partyCommand = function (c, plan) {
    const party = this.party;
    // 1) revive
    const dead = party.filter((p) => !p.alive);
    if (dead.length && !plan.revived) {
      const rs = [...c.known].find((id) => { const a = DB.actions[id]; return a && a.kind === 'spell' && a.effects.some((e) => e.type === 'revive') && this.usable(c, id); });
      if (rs) { plan.revived = true; return { id: rs, target: dead[0] }; }
      if (this.items.i_revive > 0 && c === this.living('party').sort((a, b) => b.spd - a.spd)[0]) { plan.revived = true; this.items.i_revive--; return { item: 'i_revive', target: dead[0] }; }
    }
    // 2) heal (§4.13.2: below 40 %, boss fights 55 %; 2+ hurt → group heal; no heal spell → items below 25 %)
    const alive = this.living('party');
    const lim = this.boss ? 0.55 : 0.4;
    const hurt = alive.filter((p) => p.hp / p.mhp < lim && !plan.healTargets.has(p)).sort((a, b) => a.hp / a.mhp - b.hp / b.mhp);
    const heals = [...c.known].filter((id) => { const a = DB.actions[id]; return a && a.effects.some((e) => e.type === 'heal') && a.target !== 'self' && this.usable(c, id); });
    if (hurt.length && heals.length) {
      const hp = (id) => DB.actions[id].effects.find((e) => e.type === 'heal').pct;
      const all = heals.filter((id) => DB.actions[id].target === 'allies').sort((a, b) => hp(b) - hp(a));
      const one = heals.filter((id) => DB.actions[id].target !== 'allies').sort((a, b) => hp(b) - hp(a));
      if (hurt.length >= 2 && all.length) { for (const p of alive) plan.healTargets.add(p); return { id: all[0], target: null }; }
      if (one.length) { plan.healTargets.add(hurt[0]); return { id: one[0], target: hurt[0] }; }
      if (all.length) { for (const p of alive) plan.healTargets.add(p); return { id: all[0], target: null }; }
    }
    if (!heals.length) {
      const low = alive.filter((p) => p.hp / p.mhp < 0.25 && !plan.healTargets.has(p)).sort((a, b) => a.hp / a.mhp - b.hp / b.mhp)[0];
      if (low && this.items.i_salve > 0) { plan.healTargets.add(low); this.items.i_salve--; return { item: 'i_salve', target: low }; }
    }
    // 3) cure (§4.13.2-3): sleep / paralysis / freeze / confusion, or a silenced caster
    const cures = [...c.known].filter((id) => { const a = DB.actions[id]; return a && a.effects.some((e) => e.type === 'cure') && this.usable(c, id); });
    if (cures.length) {
      const t = alive.find((p) => p !== c && !plan.cured.has(p) && (p.status.sleep || p.status.paralyze || p.status.freeze || p.status.confuse || (p.status.silence && [...p.known].some((id) => (DB.actions[id] || {}).kind === 'spell'))));
      if (t) { plan.cured.add(t); const id = cures.find((x) => DB.actions[x].target !== 'allies') || cures[0]; return { id, target: DB.actions[id].target === 'allies' ? null : t }; }
    }
    // 4) buffs / debuffs (§4.13.2-4): boss fights, first 4 rounds, 40 %; strip the boss's own buffs
    if (this.boss) {
      const foes = this.living('mon');
      const buffed = foes.find((m) => Object.values(m.buffs).some((v) => v > 0));
      const dispels = [...c.known].filter((id) => { const a = DB.actions[id]; return a && ['enemy', 'enemies'].includes(a.target) && a.effects.some((e) => e.type === 'dispel' && e.side === 'good') && this.usable(c, id); });
      if (buffed && dispels.length && !plan.dispel) { plan.dispel = true; return { id: dispels[0], target: buffed }; }
      if (this.round <= 4 && rng() < 0.4 && !plan.buff) {
        const sup = [...c.known].filter((id) => {
          const a = DB.actions[id];
          if (!a || !this.usable(c, id) || a.effects.some((e) => e.type === 'damage' || e.type === 'heal' || e.type === 'revive')) return false;
          const good = a.effects.filter((e) => (e.type === 'buff' && e.stages > 0) || (e.type === 'status' && GOOD[e.status]));
          const bad = a.effects.filter((e) => e.type === 'buff' && e.stages < 0);
          if (['ally', 'allies', 'self'].includes(a.target) && good.length) {
            const tg = a.target === 'self' ? [c] : alive;
            return tg.some((p) => good.some((e) => (e.type === 'buff' ? p.buffs[e.stat] < 2 : !p.status[e.status])));
          }
          if (['enemy', 'enemies'].includes(a.target) && bad.length) return foes.some((m) => bad.some((e) => m.buffs[e.stat] > -2));
          return false;
        });
        if (sup.length) {
          plan.buff = true;
          const id = sup[Math.floor(rng() * sup.length)];
          const a = DB.actions[id];
          const tgt = a.target === 'ally' ? alive.filter((p) => p.row === 'front')[0] || alive[0] : a.target === 'enemy' ? this.focusTarget() : null;
          return { id, target: tgt };
        }
      }
    }
    if (c.mp < c.mmp * 0.2 && this.items.i_ether > 0 && [...c.known].some((id) => (DB.actions[id] || {}).kind === 'spell') && !plan.ether) {
      plan.ether = true; this.items.i_ether--; return { item: 'i_ether', target: c };
    }
    // 3) offence on the focus target
    const tgt = this.focusTarget();
    if (!tgt) return { id: 'attack', target: null };
    const reachOk = this.effRow(c) === 'front' || (WT[c.wtype] || {}).reach;
    let best = reachOk ? { id: 'attack', v: this.expectDmg(c, 'attack', tgt) } : { id: 'defend', v: 0 };
    const keep = heals.length ? Math.min(...heals.map((id) => DB.actions[id].mp || 0)) : 0;     // keep one heal's MP
    for (const id of c.known) {
      const a = DB.actions[id];
      if (!a || !a.effects.some((e) => e.type === 'damage') || !this.usable(c, id)) continue;
      if (a.kind === 'spell' && keep && c.mp - (a.mp || 0) < keep) continue;
      const v = this.expectDmg(c, id, tgt) * (a.kind === 'spell' ? 1 : 1);
      const cost = (a.mp || 0) / Math.max(1, c.mmp);
      if (v * (1 - 0.3 * cost) > best.v * 1.05) best = { id, v: v * (1 - 0.3 * cost) };
    }
    return { id: best.id, target: tgt };
  };

  // --- glimmer (§4.9.2-4)
  B.glimmer = function (c, cmd) {
    if (!cmd.id || cmd.item || cmd.id === 'defend') return null;
    const used = DB.actions[cmd.id];
    let kind, cand = [];
    if (cmd.id === 'attack' || (used && used.kind === 'tech')) {
      kind = 'tech';
      const w = used && used.wtype ? used.wtype : c.wtype;
      const list = techsOf(w).filter((id) => !c.known.has(id));
      let minLv = 99;
      for (const id of list) {
        const g = DB.actions[id].glim;
        if (g.lv > this.rankB || c.prof < g.lv - 1) continue;
        if (this.effRow(c) === 'middle' && !DB.actions[id].reach && !(WT[w] || {}).reach && w !== 'staff') continue;
        cand.push(id); minLv = Math.min(minLv, g.lv);
      }
      cand = cand.map((id) => {
        const g = DB.actions[id].glim;
        let wgt = 1;
        if ((g.from || []).includes(cmd.id === 'attack' ? 'attack' : cmd.id)) wgt *= 3;
        if (g.lv === minLv) wgt *= 2;
        return { id, w: wgt, base: g.lv >= 10 ? GLIM.secret : GLIM.tech, apt: APT[c.apt.w[w] || 'C'], gf: clamp((100 + c.stats.dex) / 150, 0.7, 2) };
      });
    } else if (used && used.kind === 'spell') {
      kind = 'spell';
      const els = used.elements || [];
      let minLv = 99;
      for (const id of spells()) {
        if (c.known.has(id)) continue;
        const a = DB.actions[id];
        if (!a.elements.some((e) => els.includes(e))) continue;
        if (a.glim.lv > this.rankB || (a.glim.prof || 0) > c.prof) continue;
        if (a.elements.length === 3) continue;
        cand.push(id); minLv = Math.min(minLv, a.glim.lv);
      }
      cand = cand.map((id) => {
        const a = DB.actions[id];
        const cls = a.cls || (a.elements.length === 1 ? 'single' : a.glim.lv >= 6 ? 'comboB' : 'comboA');
        const apt = a.elements.reduce((s, e) => s + APT[c.apt.e[e] || 'C'], 0) / a.elements.length;
        return { id, w: a.glim.lv === minLv ? 2 : 1, base: GLIM[cls] || GLIM.single, apt, gf: clamp((100 + c.stats.int) / 150, 0.7, 2) };
      });
    }
    if (!cand.length) return null;
    const pick = weighted(cand);
    const lv = DB.actions[pick.id].glim.lv;
    const fk = clamp(1 + 0.4 * (EXPECT[clamp(this.tier, 0, 9)] - c.known.size - c.extra - 2), 1, 4);
    const margin = 1 + 0.1 * Math.min(5, this.rankB - lv);
    const p = Math.min(GLIM.cap, pick.base * pick.apt * pick.gf * fk * this.ef * margin * (1 + c.glimPct / 100));
    if (rng() >= p) return null;
    c.known.add(pick.id);
    this.ev.glimmers++;
    return pick.id;
  };

  // --- round
  B.endTurn = function (u) {
    if (!u.alive) return;
    const st = u.status;
    if (st.poison) u.hp -= Math.min(999, Math.max(1, Math.floor(u.mhp / (u.boss ? 64 : 16))));
    if (st.burn) u.hp -= Math.min(999, Math.max(1, Math.floor(u.mhp / (u.boss ? 40 : 10))));
    if (st.regen) u.hp = Math.min(u.mhp, u.hp + Math.floor(u.mhp / (u.side === 'mon' ? 20 : 10)));
    if (u.hp <= 0) this.die(u);
    else if (u.side === 'mon' && u.hp < u.mhp) { this.checkPhase(u); this.flushPhases(); }
    for (const s in st) { if (s === 'poison') continue; if (!DISABLING[s]) { st[s]--; if (st[s] <= 0) delete st[s]; } }
  };
  B.act = function (u, cmd) {
    if (!u.alive) return;
    // disabled?
    for (const s in DISABLING) if (u.status[s]) { u.status[s]--; if (u.status[s] <= 0) delete u.status[s]; this.endTurn(u); return; }
    if (u.side === 'mon') {
      if (u.rare && this.round >= 2 && rng() < (u.d.fleeRate || 0)) { u.gone = true; u.alive = false; this.fled = true; return; }
      if (u.status.confuse) { const all = this.living('party').concat(this.living('mon').filter((m) => m !== u)); if (all.length) this.useAction(u, 'attack', all[Math.floor(rng() * all.length)]); u.acts++; this.endTurn(u); return; }
      const pick = this.monPick(u);
      u.used[pick.id] = true;
      this.useAction(u, pick.id, pick.target);
      u.acts++;
      this.flushPhases();
      this.endTurn(u);
      return;
    }
    // party
    if (cmd.defend) { this.endTurn(u); return; }
    if (u.status.confuse) { const all = this.living('mon').concat(this.living('party').filter((p) => p !== u)); if (all.length) this.useAction(u, 'attack', all[Math.floor(rng() * all.length)]); this.endTurn(u); return; }
    if (cmd.item) {
      const it = DB.items[cmd.item];
      const eff = it && it.use && it.use.effects;
      const t = cmd.target && (cmd.item === 'i_revive' ? !cmd.target.alive : cmd.target.alive) ? cmd.target : null;
      if (eff && t) for (const e of eff) { if (e.type === 'heal') t.hp = Math.min(t.mhp, t.hp + Math.round(t.mhp * e.pct)); else if (e.type === 'revive') { if (!t.alive) { t.alive = true; t.hp = Math.max(1, Math.round(t.mhp * e.pct)); } } else if (e.type === 'healMp') t.mp = Math.min(t.mmp, t.mp + Math.round(t.mmp * e.pct)); }
      this.endTurn(u); return;
    }
    let id = cmd.id, target = cmd.target;
    if (id === 'defend') { this.endTurn(u); return; }
    if (id !== 'attack' && !this.usable(u, id)) id = (this.effRow(u) === 'front' || (WT[u.wtype] || {}).reach) ? 'attack' : null;
    if (!id) { this.endTurn(u); return; }
    const act = id === 'attack' ? null : DB.actions[id];
    if (!act || act.effects.some((e) => e.type === 'damage')) {
      if (!target || !target.alive) target = this.focusTarget();
      if (!target) { this.endTurn(u); return; }
    }
    const g = this.glimmer(u, { id, target });
    if (g) {
      const na = DB.actions[g];
      const off = na.effects.some((e) => e.type === 'damage');
      this.useActionFree(u, g, off ? target : this.living('party').sort((a, b) => a.hp / a.mhp - b.hp / b.mhp)[0]);
    } else this.useAction(u, id, target);
    this.flushPhases();
    this.endTurn(u);
  };
  B.useActionFree = function (u, id, target) {
    const a = DB.actions[id];
    const mp = u.mp;
    this.useAction(u, id, target);
    u.mp = mp;
    if (a && a.kind === 'spell' && a.target === 'ally' && !target) return;
  };
  B.playRound = function () {
    this.round++;
    const plan = { healTargets: new Set(), cured: new Set() };
    const cmds = new Map();
    for (const p of this.living('party')) {
      p.defend = false;
      cmds.set(p, this.partyCommand(p, plan));
      if (cmds.get(p).id === 'defend') p.defend = true;
    }
    const q = [];
    for (const p of this.living('party')) q.push({ u: p, v: (p.defend ? 1e4 : 0) + p.spd * stage(p.buffs.agi) * rf(0.75, 1) });
    for (const m of this.living('mon')) for (let i = 0; i < clamp(m.apt || 1, 1, 3); i++) q.push({ u: m, v: m.agi * stage(m.buffs.agi) * rf(0.75, 1) });
    q.sort((a, b) => b.v - a.v);
    for (const e of q) {
      if (this.over()) break;
      this.act(e.u, cmds.get(e.u) || {});
    }
    for (const p of this.party) p.defend = false;
  };
  B.over = function () { return !this.living('mon').length || !this.living('party').length; };
  B.run = function (maxRounds) {
    maxRounds = maxRounds || 60;
    while (!this.over() && this.round < maxRounds) this.playRound();
    const win = !this.living('mon').length && !this.fled;
    return {
      win: win && this.living('party').length > 0, fled: !!this.fled, rounds: this.round,
      ko: this.ev.koSet.size, deadAtEnd: this.party.filter((p) => !p.alive).length,
      hpLeft: this.party.reduce((s, p) => s + Math.max(0, p.hp), 0) / this.party.reduce((s, p) => s + p.mhp, 0),
      ev: this.ev,
    };
  };

  // ------------------------------------------------------------------ entry points
  /** Lb and tier of a troop at the given party tier (T for scale:'tier', fixed otherwise). */
  function troopLevel(troopId, T) {
    const tr = DB.troops[troopId];
    const tier = tr.scale === 'tier' ? T : (tr.tier != null ? tr.tier : T);
    const Lb = tr.lv != null ? tr.lv : LZ(tier) + (tr.lvOff || 0);
    return { tier, Lb };
  }
  function fightTroop(troopId, party, o) {
    o = o || {};
    const tr = DB.troops[troopId];
    const { tier, Lb } = troopLevel(troopId, o.tier != null ? o.tier : 0);
    let rankB = tier + 1, ef = 1;
    const b = new Battle({ tier, Lb, party, rankB: 0, ef: 1, log: o.log, items: o.items });
    for (const [ref, n] of tr.mons) {
      const id = resolveRef(ref, tier);
      if (!id || !DB.monsters[id]) continue;
      for (let i = 0; i < n; i++) {
        const u = b.addMon(id);
        const fl = u.d.flags || [];
        rankB = Math.max(rankB, tier + 1 + (fl.includes('boss') ? 2 : fl.includes('rare') ? 2 : 0) + (u.d.rankAdd || 0));
        ef = Math.max(ef, fl.includes('boss') ? 2.5 : fl.includes('rare') ? 2 : 1);
      }
    }
    b.rankB = rankB; b.ef = ef; b.boss = ef >= 2.5;
    return b.run(o.maxRounds);
  }
  function fightMons(ids, party, o) {
    const b = new Battle({ tier: o.tier, Lb: o.Lb, party, rankB: o.tier + 1, ef: 1, log: o.log, items: o.items });
    for (const id of ids) b.addMon(id);
    const fl = (DB.monsters[ids[0]] || {}).flags || [];
    b.rankB = o.tier + 1 + (fl.includes('rare') ? 2 : 0) + ((DB.monsters[ids[0]] || {}).rankAdd || 0);
    b.ef = fl.includes('rare') ? 2 : 1;
    return b.run(o.maxRounds);
  }

  return { curve, hpBoss, LZ, DK, BOSS, SIZE, W, U, monStats, makeMon, makeChar, makeParty, Battle, fightTroop, fightMons, troopLevel, resolveRef, EXPECT };
};
