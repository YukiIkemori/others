// R.Mon — monster resolution for battles (DESIGN §3.3.6, §4.10, §4.14, §9.1.2, §9.8, §9.11.2, §9.12).
// Pure logic, no DOM. Owner: battle (A2).
//
//   R.Mon.curve(L)                     → {hp, atk, mag, def, mdef, agi, exp, gold}   (§4.14.2)
//   R.Mon.hpBoss(L)                    → boss HP curve (§4.14.3)
//   R.Mon.resolve(ref, tier?, from?)   → monId | null   ('@lineage', 'same', 'lower', plain id)
//   R.Mon.def(id, {tier, golden, lvOff, Lb}) → derived definition (scaled to the battle level, golden variant)
//   R.Mon.buildList(spec, tier)        → [monId] (≤ 8, species kept together)
//   R.Mon.zoneGroup(zoneId, tier)      → the rolled encounter group of a zone (tierMin/tierMax, unresolvable groups skipped)
//   R.Mon.rollGolden(ids, mods)        → index of the monster that turns golden | -1
//   R.Mon.dropChances(def, {golden, mods}) → {normal, rare, super} probabilities (§4.10.1)
//   R.Mon.rollDrops(def, {golden, mods, tier}) → [{item, grade, n} | {gold, grade}] (normal → rare → super → bonus)
//   R.Mon.healAmount(user, target, eff, {item, field}) → HP healed (§4.6.4; battle and menu share it)
//   R.Mon.fillStats(def, id)           → fills the nominal stats of a monster (run once for every monster in R.onData)
//   R.Mon.goldenName(def)              → name of the golden individual (§9.8)
//   R.Mon.rank(def, Tb) / R.Mon.ef(def) → glimmer rank and enemy factor (§4.9.2)
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;

  // Fallback constants (§4.18.1). The live values are always read from R.Rules.K first; these only
  // keep the engine working while rules.js is still being written (§1.2-5).
  const KF = {
    LZ: (T) => 6 + 6 * T,
    W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112],
    MOB: { atk: 0.6, mag: 0.6 },
    SIZE: { s: { hp: 0.7, atk: 0.9, def: 0.9, rw: 0.7 }, m: { hp: 1, atk: 1, def: 1, rw: 1 }, l: { hp: 2.0, atk: 1.15, def: 1.1, rw: 1.8 } },
    KIND: { mob: { exp: 1, gold: 1 }, rare: { exp: 5, gold: 5 }, metal: { exp: 30, gold: 10 } },
    // §4.14.3 / §9.11.2 (acts = actions per round; exp/gold = reward multipliers of the curve)
    BOSS: {
      prologue: { lvOff: 0, hpMul: 11, atk: 1.25, mag: 1.25, def: 1.1, agi: 1.0, acts: 1, exp: 10, gold: 15 },
      mid: { lvOff: 2, hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, exp: 10, gold: 15 },
      region: { lvOff: 3, hpMul: 18, atk: 1.5, mag: 1.4, def: 1.2, agi: 1.2, acts: 2, exp: 20, gold: 15 },
      rival: { lvOff: 2, hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, exp: 10, gold: 15 },
      fmid: { lvOff: 2, hpMul: 20, atk: 1.5, mag: 1.5, def: 1.2, agi: 1.2, acts: 2, exp: 20, gold: 15 },
      last1: { lvOff: 4, hpMul: 30, atk: 1.6, mag: 1.6, def: 1.25, agi: 1.3, acts: 2, exp: 40, gold: 15 },
      last2: { lvOff: 4, hpMul: 36, atk: 1.6, mag: 1.6, def: 1.25, agi: 1.3, acts: 3, exp: 40, gold: 15 },
      echo: { lvOff: 4, hpMul: 30, atk: 1.7, mag: 1.7, def: 1.25, agi: 1.3, acts: 2, exp: 30, gold: 15 },
      super: { lvOff: 8, hpMul: 45, atk: 1.8, mag: 1.8, def: 1.3, agi: 1.4, acts: 3, exp: 40, gold: 15 },
      add: { lvOff: 0, hpMul: 1, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, exp: 2, gold: 2 },
    },
    GOLDEN: { rate: 1 / 40, hp: 2, stat: 1.2, exp: 3, gold: 5, lvShow: 2 },
    METAL: { exp: 30, gold: 10, flee: 0.5 },
    RARE_MON: { lvOff: 2, exp: 5, gold: 5, flee: 0.25, fleeFrom: 2, eva: 15, evaFlying: 20 },
    DROP: { cap: { normal: 0.75, rare: 0.5, super: 0.125 }, modCap: 150, golden: { normal: 2, rare: 8, super: 8 } },
    MODCAP: { party: 150, preempt: 30 },
    RARE_ENC: 80,
    MON_EVA: { base: 5, flying: 12, fast: 15, fastAgi: 1.3, metal: 30, rare: 15, rareFlying: 20, boss: 5, bossFlying: 10 },
    MNDF: { base: 128, div: 168, min: 0.75, max: 2.2 },
  };
  /** constant `key` of R.Rules.K (§4.18.1), falling back to KF; plain objects are merged one level deep */
  function K(key) {
    const k = R.Rules && R.Rules.K;
    const v = k && k[key];
    const f = KF[key];
    if (v == null) return f;
    if (f && typeof f === 'object' && !Array.isArray(f) && typeof v === 'object' && !Array.isArray(v)) {
      const out = Object.assign({}, f);
      for (const x in v) out[x] = (f[x] && typeof f[x] === 'object' && !Array.isArray(f[x]) && v[x] && typeof v[x] === 'object') ? Object.assign({}, f[x], v[x]) : v[x];
      return out;
    }
    return v;
  }
  const LZ = (T) => { const f = K('LZ'); return typeof f === 'function' ? f(T) : 6 + 6 * T; };
  const tierNow = () => (R.Tier && R.Tier.current ? R.Tier.current() : (R.Game && R.Game.tier) || 0);
  const has = (d, f) => !!(d && d.flags && d.flags.includes(f));

  // ------------------------------------------------------------------ curves
  /** the monster stat curve at level L (§4.14.2) */
  function curve(L) {
    L = Math.max(1, +L || 1);
    const kc = R.Rules && R.Rules.K && R.Rules.K.curve;
    if (typeof kc === 'function') return kc(L);
    const atk = 4 + 3.15 * Math.pow(L - 1, 0.9);
    const dk = 20 + 2.5 * L;
    return { hp: 6 + 2.6 * L + 0.1 * L * L, atk, mag: 0.85 * atk, def: dk, mdef: dk, agi: 24 + 0.6 * L, exp: 3 + 1.2 * L + 0.06 * L * L, gold: 2 + 0.5 * L + 0.07 * L * L };
  }
  /** boss HP curve (§4.14.3): hp(L) × (0.65 + 0.05 × clamp((L − 6)/6, 0, 10)) */
  function hpBoss(L) {
    const k = R.Rules && R.Rules.K && R.Rules.K.hpBoss;
    if (typeof k === 'function') return k(L);
    return curve(L).hp * (0.65 + 0.05 * U.clamp((L - 6) / 6, 0, 10));
  }

  // ------------------------------------------------------------------ names
  /** display width in full-width characters (half-width = 0.5) */
  function fwLen(s) { let n = 0; for (const ch of String(s || '')) n += /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.5 : 1; return n; }
  /** §9.8: goldName, else 「金色の」 + name (≤ 5 chars) or 「金の」 + name (6+ chars) */
  function goldenName(def) {
    if (!def) return '';
    if (def.goldName) return def.goldName;
    const n = def.name || '';
    return fwLen(n) <= 5 ? '金色の' + n : '金の' + n;
  }
  /** a monster that can appear as a golden individual (§9.8: not metal / rare / boss / summoned) */
  function canBeGolden(d) { return !!d && !has(d, 'metal') && !has(d, 'rare') && !has(d, 'boss') && !d.summoned; }

  // ------------------------------------------------------------------ resolve
  /** the stage below monster `id` in its lineage (the same id for a first stage or a non-lineage monster) */
  function lower(id) {
    const d = DB.monsters[id];
    const L = d && d.lineage && DB.lineages[d.lineage];
    if (!L || !L.stages) return id;
    const i = L.stages.findIndex((s) => s.mon === id);
    if (i <= 0) return id;
    const m = L.stages[i - 1].mon;
    return DB.monsters[m] ? m : id;
  }
  /**
   * '@wolf' → the last stage of lineage wolf whose start tier ≤ T (null if none, §9.1.3);
   * 'same' / 'lower' relative to monster `from` (summon, §9.1.6); a plain id → itself when it exists.
   */
  function resolve(ref, tier, from) {
    if (typeof ref !== 'string' || !ref) return null;
    const T = tier == null ? tierNow() : tier;
    if (ref === 'same') return from && DB.monsters[from] ? from : null;
    if (ref === 'lower') return from && DB.monsters[from] ? lower(from) : null;
    if (ref[0] === '@') {
      const L = DB.lineages[ref.slice(1)];
      if (!L || !L.stages) { R.warn('R.Mon.resolve: unknown lineage', ref); return null; }
      let out = null;
      for (const s of L.stages) if ((s.tier || 0) <= T) out = s.mon;
      if (out && !DB.monsters[out]) { R.warn('R.Mon.resolve: lineage stage has no monster', ref, out); return null; }
      return out;
    }
    return DB.monsters[ref] ? ref : null;
  }

  // ------------------------------------------------------------------ fillStats
  /** bossType row for a boss definition; お供 ('add') take their master's multipliers (§9.11.2) */
  function bossRow(def, id) {
    const B = K('BOSS');
    const t = def.bossType && B[def.bossType] ? def.bossType : 'mid';
    if (t !== 'add') return B[t];
    const m = def._master && B[def._master] ? B[def._master] : B.mid;
    return Object.assign({}, m, { hpMul: B.add.hpMul, acts: B.add.acts, exp: B.add.exp, gold: B.add.gold });
  }
  function defaultEva(def, s) {
    const E = K('MON_EVA');
    const fly = has(def, 'flying');
    if (has(def, 'metal')) return E.metal;
    if (has(def, 'boss')) return fly ? E.bossFlying : E.boss;
    if (has(def, 'rare')) return fly ? E.rareFlying : E.rare;
    let e = E.base;
    if (fly) e = Math.max(e, E.flying);
    if ((s.agi || 1) >= (E.fastAgi || 1.3)) e = Math.max(e, E.fast);
    return e;
  }
  /**
   * Fill the nominal stats (hp atk mag def mdef agi exp gold eva hit crit …) of monster data from its
   * level, size, multipliers s / rw and kind (§9.1.2 mobs, rare, metal; §9.11.2 bosses). Values written in
   * the data are kept as they are. Idempotent.
   */
  function fillStats(def, id) {
    if (!def || def._filled) return def;
    const lv = Math.max(1, def.lv || 1);
    const c = curve(lv);
    const s = def.s || {}, rw = def.rw || {};
    const sm = (k) => (s[k] != null ? s[k] : 1);
    const set = (k, v) => { if (def[k] == null) def[k] = v; };
    const r = (v, min) => Math.max(min == null ? 0 : min, Math.round(v));
    if (!def.flags) def.flags = [];
    if (has(def, 'boss')) {
      const b = bossRow(def, id);
      set('hp', r(hpBoss(lv) * (def.hpShare != null ? def.hpShare : b.hpMul != null ? b.hpMul : 1) * sm('hp'), 1));
      set('atk', r(c.atk * b.atk * sm('atk')));
      set('mag', r(c.mag * b.mag * sm('mag')));
      set('def', r(c.def * b.def * sm('def')));
      set('mdef', r(c.mdef * (b.mdef != null ? b.mdef : b.def) * sm('mdef')));
      set('agi', r(c.agi * b.agi * sm('agi'), 1));
      set('exp', r(c.exp * b.exp * (rw.exp != null ? rw.exp : 1)));
      set('gold', r(c.gold * b.gold * (rw.gold != null ? rw.gold : 1)));
      set('actsPerTurn', b.acts || 1);
    } else {
      const SZ = K('SIZE');
      const Z = SZ[def.size] || SZ.m;
      const rare = has(def, 'rare'), metal = has(def, 'metal');
      const KD = K('KIND');
      const kind = metal ? KD.metal : rare ? KD.rare : KD.mob;
      const mob = metal || rare ? { atk: 1, mag: 1 } : K('MOB');
      const MT = K('METAL');
      // 鋼 (§4.10.5): HP fixed (6–12, never the curve), 素早さ ×2.5 unless the data says otherwise
      const metalHp = () => def.hpFixed || Math.round(((MT.hp && MT.hp[0]) || 6) / 2 + ((MT.hp && MT.hp[1]) || 12) / 2);
      if (metal && s.agi == null && MT.agi) def.s = Object.assign({}, s, { agi: MT.agi });
      set('hp', metal ? metalHp() : r(c.hp * Z.hp * sm('hp'), 1));
      set('atk', r(c.atk * Z.atk * sm('atk') * mob.atk));
      set('mag', r(c.mag * sm('mag') * mob.mag));
      set('def', r(c.def * Z.def * sm('def')));
      set('mdef', r(c.mdef * sm('mdef')));
      set('agi', r(c.agi * (metal && s.agi == null && MT.agi ? MT.agi : sm('agi')), 1));
      set('exp', r(c.exp * Z.rw * (rw.exp != null ? rw.exp : 1) * kind.exp * (def.race === 'dragon' ? 1.2 : 1)));
      set('gold', r(c.gold * Z.rw * (rw.gold != null ? rw.gold : 1) * kind.gold));
      if (metal) set('fleeRate', K('METAL').flee);
      if (rare) { set('fleeRate', K('RARE_MON').flee); set('fleeFrom', K('RARE_MON').fleeFrom); }
    }
    set('eva', defaultEva(def, s));
    set('hit', 95);
    set('crit', has(def, 'boss') ? 3 : 2);
    def._lv = lv;
    def._filled = true;
    return def;
  }

  /** onData: お供 find their master boss in the troops, then every monster gets its nominal stats */
  function fillAll() {
    for (const tid in DB.troops) {
      const t = DB.troops[tid];
      if (!t || !t.mons) continue;
      const ids = t.mons.map((e) => (Array.isArray(e) ? e[0] : e)).filter((x) => typeof x === 'string' && DB.monsters[x]);
      const master = ids.map((x) => DB.monsters[x]).find((d) => has(d, 'boss') && d.bossType && d.bossType !== 'add');
      if (!master) continue;
      for (const x of ids) { const d = DB.monsters[x]; if (d.bossType === 'add' && !d._master) d._master = master.bossType; }
    }
    for (const id in DB.monsters) {
      try { fillStats(DB.monsters[id], id); } catch (e) { R.warn('R.Mon.fillStats failed', id, e && e.message); }
    }
    cache.clear();
  }

  // ------------------------------------------------------------------ def
  const cache = new Map();
  const SCALE_KEYS = ['atk', 'mag', 'def', 'mdef', 'agi', 'exp', 'gold'];
  /**
   * The battle definition of monster `id` (never mutates DB): stats × curve(Lb)/curve(lv) per stat
   * (bosses' HP by the hpBoss ratio, metal HP fixed) and the golden variant (§4.10.2, §9.8).
   * opts: {Lb} (battle level) or {tier, lvOff} (Lb = LZ(tier) + lvOff); none = nominal level.
   * Cached per (id, Lb, golden). The result is shared: copy it before changing it (boss phases do).
   */
  function def(id, opts) {
    opts = opts || {};
    const base = DB.monsters[id];
    if (!base) return null;
    if (!base._filled) fillStats(base, id);
    let Lb = opts.Lb != null ? opts.Lb : opts.lv;
    if (Lb == null && opts.tier != null) Lb = LZ(opts.tier) + (opts.lvOff || 0);
    const L0 = base._lv || base.lv || 1;
    if (Lb == null) Lb = L0;
    Lb = Math.max(1, Math.round(Lb));
    const golden = !!opts.golden && canBeGolden(base);
    const key = id + '|' + Lb + '|' + (golden ? 1 : 0);
    const hit = cache.get(key);
    if (hit) return hit;
    const d = Object.assign({}, base);
    d.baseId = id;
    d.flags = (base.flags || []).slice();
    if (Lb !== L0) {
      const c0 = curve(L0), c1 = curve(Lb);
      for (const k of SCALE_KEYS) if (typeof base[k] === 'number') d[k] = Math.max(k === 'agi' ? 1 : 0, Math.round(base[k] * c1[k] / c0[k]));
      if (has(base, 'metal')) d.hp = base.hp;
      else if (has(base, 'boss')) d.hp = Math.max(1, Math.round(base.hp * hpBoss(Lb) / hpBoss(L0)));
      else d.hp = Math.max(1, Math.round(base.hp * c1.hp / c0.hp));
    }
    d.lv = Lb;
    d.lvShow = Lb;
    if (golden) {
      const G = K('GOLDEN');
      d.golden = true;
      d.name = goldenName(base);
      d.hp = Math.max(1, Math.round(d.hp * G.hp));
      for (const k of ['atk', 'mag', 'def', 'mdef', 'agi']) d[k] = Math.round((d[k] || 0) * G.stat);
      d.exp = Math.round((d.exp || 0) * G.exp);
      d.gold = Math.round((d.gold || 0) * G.gold);
      d.lvShow = Lb + (G.lvShow || 0);
      if (!d.flags.includes('golden')) d.flags.push('golden');
    }
    cache.set(key, d);
    return d;
  }

  // ------------------------------------------------------------------ lists
  function entryOf(e) {
    if (Array.isArray(e)) return { ref: e[0], a: e[1], b: e[2] };
    if (e && typeof e === 'object') return { ref: e.id || e.mon, a: e.n != null ? e.n : 1, b: undefined };
    return { ref: e, a: 1, b: undefined };
  }
  /**
   * monster ids for a battle: spec [['@wolf',1,3], ['bat_2',2], 'jelly_1'] at tier T; ≤ 8, each species kept together
   * (opts.keepOrder: the spec's own left → right order, for troops such as お供・ボス・お供)
   */
  function buildList(spec, tier, opts) {
    const T = tier == null ? tierNow() : tier;
    const out = [];
    for (const e of spec || []) {
      const { ref, a, b } = entryOf(e);
      const id = resolve(ref, T);
      if (!id) { if (typeof ref === 'string' && ref[0] !== '@') R.warn('battle: unknown monster', ref); continue; }
      const n = b != null ? U.ri(a, b) : a != null ? a : 1;
      for (let i = 0; i < n && out.length < 8; i++) out.push(id);
    }
    if (opts && opts.keepOrder) return out;
    const firstAt = {};
    out.forEach((id, i) => { if (!(id in firstAt)) firstAt[id] = i; });
    return out.map((id, i) => [firstAt[id], i, id]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((x) => x[2]);
  }
  /** the encounter groups of a zone available at tier T (tierMin/tierMax, every '@ref' resolvable) */
  function zoneGroups(zoneId, tier) {
    const z = DB.encounters[zoneId];
    if (!z || !z.groups) return [];
    const T = tier == null ? tierNow() : tier;
    return z.groups.filter((g) => g && g.mons && g.mons.length && (g.tierMin == null || T >= g.tierMin) && (g.tierMax == null || T <= g.tierMax) &&
      g.mons.every((e) => resolve(entryOf(e).ref, T)));
  }
  /** one weighted group of the zone at tier T (null when none fits) */
  function zoneGroup(zoneId, tier) {
    const gs = zoneGroups(zoneId, tier);
    return gs.length ? U.weighted(gs) : null;
  }

  // ------------------------------------------------------------------ golden
  function partyModOf(mods, key) {
    if (typeof mods === 'number') return mods;
    if (mods && mods[key] != null) return mods[key];
    if (mods == null && R.Party && R.Party.mod) { try { return R.Party.mod(key) || 0; } catch (e) { return 0; } }
    return 0;
  }
  /** §4.10.2: 1/40 × (1 + min(150, goldenPct)/100) per zone battle; one eligible monster turns golden (-1 = none) */
  function rollGolden(ids, mods) {
    const idx = [];
    (ids || []).forEach((id, i) => { const key = id && typeof id === 'object' ? id.id : id; if (canBeGolden(DB.monsters[key])) idx.push(i); });
    if (!idx.length) return -1;
    const G = K('GOLDEN');
    const cap = K('DROP').modCap;
    const p = G.rate * (1 + Math.min(cap, partyModOf(mods, 'goldenPct')) / 100);
    return U.chance(p) ? U.pick(idx) : -1;
  }

  // ------------------------------------------------------------------ drops
  const GRADES = ['normal', 'rare', 'super'];
  const MOD_OF = { normal: 'dropPct', rare: 'rarePct', super: 'superPct' };
  /** probability of each drop slot (§4.10.1). rate 1 = certain (boss pools); caps 0.75 / 0.5 / 0.125, mods capped +150 */
  function dropChances(d, opts) {
    opts = opts || {};
    const out = { normal: 0, rare: 0, super: 0 };
    if (!d || !d.drops) return out;
    const D = K('DROP');
    const golden = opts.golden != null ? opts.golden : !!d.golden;
    for (const g of GRADES) {
      const slot = d.drops[g];
      if (!slot || (!slot.item && !slot.pool)) continue;
      const rate = slot.rate || 1;
      if (rate <= 1) { out[g] = 1; continue; }
      const mod = Math.min(D.modCap, partyModOf(opts.mods, MOD_OF[g]));
      out[g] = Math.min(D.cap[g], (1 / rate) * (golden ? D.golden[g] : 1) * (1 + mod / 100));
    }
    return out;
  }
  /** a pool pick at tier T: {item, n} | {gold} | null */
  function pickPool(poolId, tier) {
    const P = DB.pools[poolId];
    const tiers = P && P.tiers;
    if (!tiers || !tiers.length) { R.warn('R.Mon: unknown pool', poolId); return null; }
    const T = tier == null ? tierNow() : tier;
    const list = R.Tier && R.Tier.pick ? R.Tier.pick(tiers, T) : tiers[Math.min(Math.max(0, T), tiers.length - 1)];
    if (!list || !list.length) return null;
    const e = U.weighted(list);
    if (!e) return null;
    if (e.gold) return { gold: e.gold };
    return e.item ? { item: e.item, n: e.n || 1 } : null;
  }
  function slotPrize(slot, tier) {
    if (!slot) return null;
    if (slot.pool) return pickPool(slot.pool, tier);
    return slot.item ? { item: slot.item, n: slot.n || 1 } : null;
  }
  /**
   * Roll the three slots independently, then the certain `bonus` (§3.3.6, §4.10.1, §8.12.3).
   * opts: {golden, mods:{dropPct, rarePct, superPct} (party totals; omitted = R.Party.mod), tier (pool tier), summoned}
   * → [{item, n, grade, slot} | {gold, grade, slot}] in the order normal → rare → super → bonus
   */
  function rollDrops(d, opts) {
    opts = opts || {};
    if (!d || d.summoned || opts.summoned || !d.drops) return [];
    const ch = dropChances(d, opts);
    const out = [];
    for (const g of GRADES) {
      if (!ch[g] || !U.chance(ch[g])) continue;
      const p = slotPrize(d.drops[g], opts.tier);
      if (p) out.push(Object.assign(p, { grade: g, slot: g }));
    }
    if (d.drops.bonus) {
      const p = slotPrize(d.drops.bonus, opts.tier);
      if (p) out.push(Object.assign(p, { grade: 'normal', slot: 'bonus' }));
    }
    return out;
  }

  // ------------------------------------------------------------------ heal
  function statsOf(x) {
    if (!x) return {};
    if (x.st) return x.st;
    if (R.Rules && R.Rules.stats) { try { return R.Rules.stats(x) || {}; } catch (e) { return {}; } }
    return {};
  }
  /** MNDF = clamp((128 + 精神)/168, 0.75, 2.2) (§4.6.4) */
  function mndf(mnd) { const M = K('MNDF'); return U.clamp((M.base + (mnd || 0)) / M.div, M.min, M.max); }
  /**
   * HP healed by effect eff (§4.6.4). user/target: battle units or CharStates (menu, field).
   * spells & techs: maxHP × pct × MNDF(user) × (1 + healPct/100); items: maxHP × pct × (1 + itemPct/100);
   * monsters: maxHP × pct. Rounded, at least 1 when anything is healed.
   */
  function healAmount(user, target, eff, opts) {
    opts = opts || {};
    if (!eff || !target) return 0;
    const tst = target.isParty != null ? null : statsOf(target);
    const mhp = target.mhp != null ? target.mhp : tst.hp || 0;
    let n;
    if (eff.pct != null) n = mhp * eff.pct;
    else n = eff.power || 0; // legacy flat heal
    if (user && user.isParty === false) return n > 0 ? Math.max(1, Math.round(n)) : 0;
    const ust = user && user.isParty != null ? null : statsOf(user);
    const mods = (user && (user.isParty != null ? user.mods : ust.mods)) || {};
    if (opts.item) n *= 1 + (mods.itemPct || 0) / 100;
    else if (user) {
      const mnd = user.isParty != null ? user.stat('mnd') : ust.mnd;
      n *= mndf(mnd) * (1 + (mods.healPct || 0) / 100);
    }
    return n > 0 ? Math.max(1, Math.round(n)) : 0;
  }

  // ------------------------------------------------------------------ glimmer helpers
  /** enemy glimmer rank (§4.9.2): Tb + 1 (+2 boss, +2 rare, +1 golden, +1 metal, + rankAdd) */
  function rank(d, Tb) {
    if (d && R.Glimmer && R.Glimmer.monRank) { try { return R.Glimmer.monRank(d, Tb); } catch (e) { /* fallback */ } }
    if (!d) return (Tb || 0) + 1;
    let r = (Tb || 0) + 1;
    if (has(d, 'boss')) r += 2;
    if (has(d, 'rare')) r += 2;
    if (d.golden || has(d, 'golden')) r += 1;
    if (has(d, 'metal')) r += 1;
    return r + (d.rankAdd || 0);
  }
  /** enemy factor EF (§4.9.2): normal 1 / golden 1.5 / rare 2 / boss 2.5 (metal 1) */
  function ef(d) {
    const E = (R.Rules && R.Rules.K && R.Rules.K.GLIM && R.Rules.K.GLIM.ef) || { normal: 1, golden: 1.5, rare: 2, boss: 2.5 };
    if (!d) return E.normal;
    if (has(d, 'boss')) return E.boss;
    if (has(d, 'rare')) return E.rare;
    if (d.golden || has(d, 'golden')) return E.golden;
    return E.normal;
  }

  R.onData(fillAll);

  Object.assign(R.Mon = R.Mon || {}, {
    K, KF, LZ, curve, hpBoss, resolve, lower, def, buildList, zoneGroups, zoneGroup, rollGolden, dropChances, rollDrops, pickPool,
    healAmount, mndf, fillStats, fillAll, goldenName, canBeGolden, rank, ef, fwLen,
    clearCache() { cache.clear(); },
  });
})(window.RPG);
