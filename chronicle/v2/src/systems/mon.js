// R.Mon（BATTLE）: 魔物の解決・出現・ドロップ・回復の式（V2_PLAN §2.5.13、DESIGN §3.3.6・§4.10・§4.14・§9.1.2、STATS_REWORK §2.2・§7.4・§9.4）
// 移植の元は chronicle/src/systems/mon.js。登録だけで、読み込み時に document に触れない。
//
//   R.Mon.encounter(zoneId, {tier, dark, steps, ward}) → K.setup | null   FIELD が歩数ごとに呼ぶ（率・組・レア・金色・魔除けの香）
//   R.Mon.curve(L, kind) / hpBoss(L)                   魔物の曲線（R.Rules.K が持てばそちら、無ければ下の KF）
//   R.Mon.resolve(ref, tier, from)                     '@系統' 'same' 'lower' か id → 魔物の id
//   R.Mon.def(id, {Lb, golden, dark})                  戦闘の定義（Lb に合わせた数値・金色の個体・闇の強まり）。DB は変えない
//   R.Mon.buildList(spec, tier, {keepOrder}) / zoneGroups / zoneGroup / rollGolden / dropChances / rollDrops / pickPool
//   R.Mon.healAmount(user, target, eff, {item, action}) 回復の式（戦闘とメニューで同じ。STATS_REWORK §2.2 の HEALF）
//   R.Mon.rng() / R.Mon.setRng(r)                      戦闘の乱数（R.rng の形＋rf・ri・r）。戦闘・出現・sim が差し替える
//   R.Mon.rank(def, Tb) / ef(def)                      閃きの敵の強さ（R.Glimmer が持てばそちら）
// 経験値は無い（STATS_REWORK §9.4）。お金は旧のまま。
(function (R) {
  'use strict';
  const DB = R.DB;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  // ---------------------------------------------------------------- 乱数（V2_PLAN §2.1: R.rng から）
  /** R.rng(seed) に旧の U の名前（r・rf・ri）を足した物 */
  function mkRng(seed) {
    const g = R.rng(seed);
    g.r = g.next;
    g.rf = (a, b) => a + (b - a) * g.next();
    g.ri = (a, b) => a + Math.floor(g.next() * (b - a + 1));
    return g;
  }
  let RNG = null;
  function rng() { if (!RNG) RNG = mkRng('mon:default'); return RNG; }
  function setRng(r) { RNG = r && r.rf ? r : r ? Object.assign(r, { r: r.next, rf: (a, b) => a + (b - a) * r.next(), ri: (a, b) => a + Math.floor(r.next() * (b - a + 1)) }) : null; return RNG; }
  function weighted(list, key) {
    key = key || 'w';
    let total = 0;
    for (const e of list) total += Math.max(0, e[key] == null ? 1 : e[key]);
    let x = rng().next() * total;
    for (const e of list) { x -= Math.max(0, e[key] == null ? 1 : e[key]); if (x < 0) return e; }
    return list[list.length - 1];
  }

  // ---------------------------------------------------------------- 定数（R.Rules.K が正。無い間は今の rules.js と同じ値）
  const KF = {
    LZ: (T) => 6 + 6 * T,
    DK: (L) => 40 + 5 * L,
    W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112],
    MOB: { atk: 0.6, mag: 0.6 },
    CURVE: { hp: [6, 2.6, 0.1], atk: [4, 3.15, 0.9], magMul: 0.85, def: [20, 2.5], agi: [24, 0.6], gold: [2, 0.5, 0.07] },
    MON_HP_PROF: { perLv: 0.0035, max: 0.18 },
    MOB_TIER: { on: false, hp: [1.12, 1.2, 1.45, 1.72, 1.72, 1.9, 2.14, 2.3, 2.35, 2.06], dmg: [1.25, 1.25, 0.95, 0.75, 0.72, 0.61, 0.58, 0.58, 0.58, 0.45] },
    SIZE: { s: { hp: 0.7, atk: 0.9, def: 0.9, rw: 0.7 }, m: { hp: 1, atk: 1, def: 1, rw: 1 }, l: { hp: 2.0, atk: 1.15, def: 1.1, rw: 1.8 } },
    KIND: { mob: { gold: 1 }, rare: { gold: 5 }, metal: { gold: 10 } },
    BOSS: {
      prologue: { lv: 8, hpMul: 11, atk: 1.25, mag: 1.25, def: 1.1, agi: 1.0, acts: 1, gold: 15 },
      mid: { lvOff: 2, hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, gold: 15 },
      region: { lvOff: 3, hpMul: 18, atk: 1.5, mag: 1.4, def: 1.2, agi: 1.2, acts: 2, gold: 15 },
      rival: { lvOff: 2, hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, gold: 15 },
      fmid: { lvOff: 2, hpMul: 20, atk: 1.5, mag: 1.5, def: 1.2, agi: 1.2, acts: 2, gold: 15 },
      last1: { lvOff: 4, hpMul: 30, atk: 1.6, mag: 1.6, def: 1.25, agi: 1.3, acts: 2, gold: 15 },
      last2: { lvOff: 4, hpMul: 17, atk: 0.68, mag: 0.68, def: 0.65, agi: 0.65, acts: 3, gold: 15 },
      echo: { lvOff: 4, hpMul: 30, atk: 1.7, mag: 1.7, def: 1.25, agi: 1.3, acts: 2, gold: 15 },
      super: { lvOff: 8, hpMul: 56, atk: 1.25, mag: 1.25, def: 1.3, agi: 1.4, acts: 3, gold: 15 },
      add: { lvOff: 0, hpMul: 1, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, gold: 2 },
    },
    GOLDEN: { rate: 1 / 40, hp: 2, stat: 1.2, gold: 5, lvShow: 2 },
    METAL: { gold: 10, flee: 0.5, eva: 30, agi: 2.5, hp: [6, 12] },
    RARE_MON: { lvOff: 2, gold: 5, flee: 0.25, fleeFrom: 2, eva: 15, evaFlying: 20 },
    DROP: { cap: { normal: 0.75, rare: 0.5, super: 0.125 }, modCap: 150, golden: { normal: 2, rare: 8, super: 8 } },
    MODCAP: { party: 150, preempt: 30 },
    RARE_ENC: 80,
    MON_EVA: { base: 5, flying: 12, fast: 15, fastAgi: 1.3, metal: 30, rare: 15, rareFlying: 20, boss: 5, bossFlying: 10 },
    ABIL: { mid: 16, minMul: 0.5, heal: 0.04 },
    HEALF: { min: 0.6, max: 2.0 },
    // 出現（DESIGN §4.11.1。旧は field.js の K.ENC。v2 では R.Mon.encounter が率を持つ）
    ENC: { world: 26, dungeon: 22, safeSteps: 6 },
    ENC_ITEM: { weakMargin: 3 },
    // 闇の強まり（WORLD_REDESIGN E6）: 暗い階の灯りの外で始まった戦闘
    DARK: { ambush: 0.08, stat: 1.1 },
  };
  /** R.Rules.K[key]（無ければ KF）。1 段の物は KF に重ねる */
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
  const tierNow = () => (R.Tier && R.Tier.get ? R.Tier.get() : (R.Game && R.Game.tier) || 0);
  const has = (d, f) => !!(d && d.flags && d.flags.includes(f));
  /** STATS_REWORK §2.1: max(minMul, 1 + k × (a − 16)) */
  function abilMul(a, k) {
    if (R.Rules && typeof R.Rules.abilMul === 'function' && !(R.Stubs && R.Stubs.installed && (R.Stubs.installed.Rules || []).includes('abilMul'))) return R.Rules.abilMul(a, k);
    const A = K('ABIL');
    return Math.max(A.minMul, 1 + k * ((a == null ? A.mid : a) - A.mid));
  }

  // ---------------------------------------------------------------- 曲線（DESIGN §4.14.2・§4.14.3）
  function mobTier(L) {
    const M = K('MOB_TIER'), n = M.hp.length - 1;
    const t = Math.max(0, Math.min(n, (L - 6) / 6)), i = Math.min(n - 1, Math.floor(t)), f = t - i;
    return { hp: M.hp[i] + (M.hp[i + 1] - M.hp[i]) * f, dmg: M.dmg[i] + (M.dmg[i + 1] - M.dmg[i]) * f };
  }
  function curve(L, kind) {
    L = Math.max(1, +L || 1);
    const kc = R.Rules && R.Rules.K && R.Rules.K.curve;
    if (typeof kc === 'function') return kc(L, kind);
    const C = K('CURVE'), HP = K('MON_HP_PROF'), MT = K('MOB_TIER');
    const mt = kind === 'mob' && MT.on ? mobTier(L) : null;
    const atk = (C.atk[0] + C.atk[1] * Math.pow(Math.max(0, L - 1), C.atk[2])) * (mt ? mt.dmg : 1);
    const d = C.def[0] + C.def[1] * L;
    return {
      hp: (C.hp[0] + C.hp[1] * L + C.hp[2] * L * L) * (1 + Math.min(HP.max, HP.perLv * Math.max(0, L))) * (mt ? mt.hp : 1),
      atk, mag: C.magMul * atk, def: d, mdef: d, agi: C.agi[0] + C.agi[1] * L,
      gold: C.gold[0] + C.gold[1] * L + C.gold[2] * L * L,
    };
  }
  function hpBoss(L) {
    const k = R.Rules && R.Rules.K && R.Rules.K.hpBoss;
    if (typeof k === 'function') return k(L);
    return curve(L).hp * (0.65 + 0.025 * (clamp(L, 18, 51) - 18));
  }

  // ---------------------------------------------------------------- 名前
  function fwLen(s) { let n = 0; for (const ch of String(s || '')) n += /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.5 : 1; return n; }
  /** §9.8: goldName、無ければ「金色の」＋名前（5 字まで）か「金の」＋名前 */
  function goldenName(def) {
    if (!def) return '';
    if (def.goldName) return def.goldName;
    const n = def.name || '';
    return fwLen(n) <= 5 ? '金色の' + n : '金の' + n;
  }
  /** 金色になれる魔物（鋼・レア・ボス・呼ばれた物でない） */
  function canBeGolden(d) { return !!d && !has(d, 'metal') && !has(d, 'rare') && !has(d, 'boss') && !d.summoned; }

  // ---------------------------------------------------------------- 解決
  function lower(id) {
    const d = DB.monsters[id];
    const L = d && d.lineage && DB.lineages[d.lineage];
    if (!L || !L.stages) return id;
    const i = L.stages.findIndex((s) => s.mon === id);
    if (i <= 0) return id;
    const m = L.stages[i - 1].mon;
    return DB.monsters[m] ? m : id;
  }
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

  // ---------------------------------------------------------------- fillStats（R.onData で全員に 1 回）
  function bossRow(def) {
    const B = K('BOSS');
    const t = def.bossType && B[def.bossType] ? def.bossType : 'mid';
    if (t !== 'add') return B[t];
    const m = def._master && B[def._master] ? B[def._master] : B.mid;
    return Object.assign({}, m, { hpMul: B.add.hpMul != null ? B.add.hpMul : 1, acts: B.add.acts, gold: B.add.gold });
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
  function curveKind(d) { return has(d, 'boss') || has(d, 'rare') || has(d, 'metal') ? undefined : 'mob'; }
  /** 名目の数値（hp atk mag def mdef agi gold eva hit crit）を lv・大きさ・倍率 s・報酬 rw・種類から作る（書いてある値はそのまま） */
  function fillStats(def) {
    if (!def || def._filled) return def;
    const lv = Math.max(1, def.lv || 1);
    const c = curve(lv, curveKind(def));
    const s = def.s || {}, rw = def.rw || {};
    const sm = (k) => (s[k] != null ? s[k] : 1);
    const set = (k, v) => { if (def[k] == null) def[k] = v; };
    const raw = {};
    const setR = (k, v, min) => { if (def[k] == null) { def[k] = Math.max(min == null ? 0 : min, Math.round(v)); raw[k] = Math.max(min == null ? 0 : min, v); } };
    if (!def.flags) def.flags = [];
    if (has(def, 'boss')) {
      const b = bossRow(def);
      setR('hp', hpBoss(lv) * (def.hpShare != null ? def.hpShare : b.hpMul != null ? b.hpMul : 1) * sm('hp'), 1);
      setR('atk', c.atk * b.atk * sm('atk'));
      setR('mag', c.mag * b.mag * sm('mag'));
      setR('def', c.def * b.def * sm('def'));
      setR('mdef', c.mdef * (b.mdef != null ? b.mdef : b.def) * sm('mdef'));
      setR('agi', c.agi * b.agi * sm('agi'), 1);
      setR('gold', c.gold * (b.gold || 15) * (rw.gold != null ? rw.gold : 1));
      set('actsPerTurn', b.acts || 1);
    } else {
      const Z = K('SIZE')[def.size] || K('SIZE').m;
      const rare = has(def, 'rare'), metal = has(def, 'metal');
      const KD = K('KIND');
      const kind = metal ? KD.metal : rare ? KD.rare : KD.mob;
      const mob = metal || rare ? { atk: 1, mag: 1 } : K('MOB');
      const MT = K('METAL');
      const metalHp = () => def.hpFixed || Math.round(((MT.hp && MT.hp[0]) || 6) / 2 + ((MT.hp && MT.hp[1]) || 12) / 2);
      if (metal && s.agi == null && MT.agi) def.s = Object.assign({}, s, { agi: MT.agi });
      if (metal) set('hp', metalHp()); else setR('hp', c.hp * Z.hp * sm('hp'), 1);
      setR('atk', c.atk * Z.atk * sm('atk') * mob.atk);
      setR('mag', c.mag * sm('mag') * mob.mag);
      setR('def', c.def * Z.def * sm('def'));
      setR('mdef', c.mdef * sm('mdef'));
      setR('agi', c.agi * (metal && s.agi == null && MT.agi ? MT.agi : sm('agi')), 1);
      setR('gold', c.gold * Z.rw * (rw.gold != null ? rw.gold : 1) * (kind.gold || 1));
      if (metal) set('fleeRate', MT.flee);
      if (rare) { set('fleeRate', K('RARE_MON').flee); set('fleeFrom', K('RARE_MON').fleeFrom); }
    }
    set('eva', defaultEva(def, s));
    set('hit', 95);
    set('crit', has(def, 'boss') ? 3 : 2);
    def._lv = lv;
    Object.defineProperty(def, '_raw', { value: raw, enumerable: false, configurable: true, writable: true });
    def._filled = true;
    return def;
  }
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
      try { fillStats(DB.monsters[id]); } catch (e) { R.warn('R.Mon.fillStats failed', id, e && e.message); }
    }
    cache.clear();
  }

  // ---------------------------------------------------------------- def
  const cache = new Map();
  const SCALE_KEYS = ['atk', 'mag', 'def', 'mdef', 'agi', 'gold'];
  /**
   * 戦闘の定義（DB は変えない）: 数値 × curve(Lb)/curve(lv)（ボスの HP は hpBoss の比、鋼の HP は固定）、金色の個体、
   * 闇の強まり（opts.dark: 闇の属性の魔物の能力 × K.DARK.stat）。(id, Lb, golden, dark) ごとに覚える。共有なので変えるときは写す
   */
  function def(id, opts) {
    opts = opts || {};
    const base = DB.monsters[id];
    if (!base) return null;
    if (!base._filled) fillStats(base);
    let Lb = opts.Lb != null ? opts.Lb : opts.lv;
    if (Lb == null && opts.tier != null) Lb = LZ(opts.tier) + (opts.lvOff || 0);
    const L0 = base._lv || base.lv || 1;
    if (Lb == null) Lb = L0;
    Lb = Math.max(1, Math.round(Lb));
    const golden = !!opts.golden && canBeGolden(base);
    const dark = !!opts.dark && isDark(base);
    const key = id + '|' + Lb + '|' + (golden ? 1 : 0) + (dark ? 'd' : '');
    const hit = cache.get(key);
    if (hit) return hit;
    const d = Object.assign({}, base);
    d.baseId = id;
    d.flags = (base.flags || []).slice();
    if (Lb !== L0) {
      const ck = curveKind(base), c0 = curve(L0, ck), c1 = curve(Lb, ck);
      const raw = base._raw || {};
      const v0 = (k) => (raw[k] != null ? raw[k] : base[k]);
      for (const k of SCALE_KEYS) if (typeof base[k] === 'number') d[k] = Math.max(k === 'agi' ? 1 : 0, Math.round(v0(k) * c1[k] / c0[k]));
      if (has(base, 'metal')) d.hp = base.hp;
      else if (has(base, 'boss')) d.hp = Math.max(1, Math.round(v0('hp') * hpBoss(Lb) / hpBoss(L0)));
      else d.hp = Math.max(1, Math.round(v0('hp') * c1.hp / c0.hp));
    }
    d.lv = Lb;
    d.lvShow = Lb;
    if (golden) {
      const G = K('GOLDEN');
      d.golden = true;
      d.name = goldenName(base);
      d.hp = Math.max(1, Math.round(d.hp * G.hp));
      for (const k of ['atk', 'mag', 'def', 'mdef', 'agi']) d[k] = Math.round((d[k] || 0) * G.stat);
      d.gold = Math.round((d.gold || 0) * G.gold);
      d.lvShow = Lb + (G.lvShow || 0);
      if (!d.flags.includes('golden')) d.flags.push('golden');
    }
    if (dark) {
      const m = K('DARK').stat;
      for (const k of ['atk', 'mag', 'def', 'mdef', 'agi']) d[k] = Math.round((d[k] || 0) * m);
      d.darkBoost = true;
    }
    cache.set(key, d);
    return d;
  }
  /** 闇の属性の魔物（affinity 'dark'、闇を吸うか大きく耐える、霊・悪魔・骸骨の種族） */
  function isDark(d) {
    if (!d) return false;
    if (d.affinity === 'dark') return true;
    const e = d.elem && d.elem.dark;
    if (e != null && e <= 0.5) return true;
    return d.race === 'undead' || d.race === 'demon' || d.race === 'spirit';
  }

  // ---------------------------------------------------------------- 並び
  function entryOf(e) {
    if (Array.isArray(e)) return { ref: e[0], a: e[1], b: e[2] };
    if (e && typeof e === 'object') return { ref: e.id || e.mon, a: e.n != null ? e.n : 1, b: undefined };
    return { ref: e, a: 1, b: undefined };
  }
  /** spec [['@wolf',1,3], ['bat_2',2], 'jelly_1'] → 魔物の id（8 体まで、同じ種はまとめる。keepOrder は書いた順） */
  function buildList(spec, tier, opts) {
    const T = tier == null ? tierNow() : tier;
    const out = [];
    for (const e of spec || []) {
      const { ref, a, b } = entryOf(e);
      const id = resolve(ref, T);
      if (!id) { if (typeof ref === 'string' && ref[0] !== '@') R.warn('battle: unknown monster', ref); continue; }
      const n = b != null ? rng().ri(a, b) : a != null ? a : 1;
      for (let i = 0; i < n && out.length < 8; i++) out.push(id);
    }
    if (opts && opts.keepOrder) return out;
    const firstAt = {};
    out.forEach((id, i) => { if (!(id in firstAt)) firstAt[id] = i; });
    return out.map((id, i) => [firstAt[id], i, id]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((x) => x[2]);
  }
  function zoneGroups(zoneId, tier) {
    const z = DB.encounters[zoneId];
    if (!z || !z.groups) return [];
    const T = tier == null ? tierNow() : tier;
    return z.groups.filter((g) => g && g.mons && g.mons.length && (g.tierMin == null || T >= g.tierMin) && (g.tierMax == null || T <= g.tierMax) &&
      g.mons.every((e) => resolve(entryOf(e).ref, T)));
  }
  function zoneGroup(zoneId, tier) {
    const gs = zoneGroups(zoneId, tier);
    return gs.length ? weighted(gs) : null;
  }

  // ---------------------------------------------------------------- 金色
  function partyModOf(mods, key) {
    if (typeof mods === 'number') return mods;
    if (mods && mods[key] != null) return mods[key];
    return 0;
  }
  /** §4.10.2: 1/40 × (1 + min(150, goldenPct)/100)。金色になれる 1 体の番号（-1 = なし） */
  function rollGolden(ids, mods) {
    const idx = [];
    (ids || []).forEach((id, i) => { const key = id && typeof id === 'object' ? id.id : id; if (canBeGolden(DB.monsters[key])) idx.push(i); });
    if (!idx.length) return -1;
    const G = K('GOLDEN');
    const p = G.rate * (1 + Math.min(K('DROP').modCap, partyModOf(mods, 'goldenPct')) / 100);
    return rng().chance(p) ? rng().pick(idx) : -1;
  }

  // ---------------------------------------------------------------- ドロップ（盗み専用の steal は見ない。STATS_REWORK §7.4）
  const GRADES = ['normal', 'rare', 'super'];
  const MOD_OF = { normal: 'dropPct', rare: 'rarePct', super: 'superPct' };
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
  function pickPool(poolId, tier) {
    const P = DB.pools[poolId];
    const tiers = P && P.tiers;
    if (!tiers || !tiers.length) { R.warn('R.Mon: unknown pool', poolId); return null; }
    const T = tier == null ? tierNow() : tier;
    const list = tiers[Math.min(Math.max(0, T), tiers.length - 1)];
    if (!list || !list.length) return null;
    const e = weighted(list);
    if (!e) return null;
    if (e.gold) return { gold: e.gold };
    return e.item ? { item: e.item, n: e.n || 1 } : null;
  }
  function slotPrize(slot, tier) {
    if (!slot) return null;
    if (slot.pool) return pickPool(slot.pool, tier);
    return slot.item ? { item: slot.item, n: slot.n || 1 } : null;
  }
  /** 3 つの枠をそれぞれ振り、確定の bonus を足す → [{item, n, grade, slot} | {gold, grade, slot}]（normal → rare → super → bonus） */
  function rollDrops(d, opts) {
    opts = opts || {};
    if (!d || d.summoned || opts.summoned || !d.drops) return [];
    const ch = dropChances(d, opts);
    const out = [];
    for (const g of GRADES) {
      if (!ch[g] || !rng().chance(ch[g])) continue;
      const p = slotPrize(d.drops[g], opts.tier);
      if (p) out.push(Object.assign(p, { grade: g, slot: g }));
    }
    if (d.drops.bonus) {
      const p = slotPrize(d.drops.bonus, opts.tier);
      if (p) out.push(Object.assign(p, { grade: 'normal', slot: 'bonus' }));
    }
    return out;
  }

  // ---------------------------------------------------------------- 回復（§4.6.4、STATS_REWORK §2.2 HEALF）
  function statsOf(x) {
    if (!x) return {};
    if (x.st) return x.st;
    if (R.Rules && R.Rules.stats) { try { return R.Rules.stats(x) || {}; } catch (e) { return {}; } }
    return {};
  }
  /** HEALF = clamp(abilMul(精神, 0.04), 0.6, 2.0) */
  function healf(mnd) { const H = K('HEALF'); return clamp(abilMul(mnd, K('ABIL').heal || 0.04), H.min, H.max); }
  /**
   * 効果 eff で回る HP。user/target は戦闘の unit か CharState（メニュー）。
   * 術・技: 最大HP × pct × HEALF(使い手) × (1 + healPct/100) × 熟練、道具: 最大HP × pct × (1 + itemPct/100)、魔物: 最大HP × pct
   */
  function healAmount(user, target, eff, opts) {
    opts = opts || {};
    if (!eff || !target) return 0;
    const tst = target.isParty != null ? null : statsOf(target);
    const mhp = target.mhp != null ? target.mhp : tst.maxHp || tst.hp || 0;
    let n = eff.pct != null ? mhp * eff.pct : eff.power || 0;
    if (user && user.isParty === false) return n > 0 ? Math.max(1, Math.round(n)) : 0;
    const ust = user && user.isParty != null ? null : statsOf(user);
    const mods = (user && (user.isParty != null ? user.mods : ust.mods)) || {};
    if (opts.item) n *= 1 + (mods.itemPct || 0) / 100;
    else if (user) {
      const mnd = user.isParty != null ? user.stat('mnd') : ust.mnd;
      n *= healf(mnd) * (1 + (mods.healPct || 0) / 100);
      const ch = user.isParty != null ? user.c : user;
      if (opts.action && ch && R.Rules && R.Rules.profPowerMul) { try { n *= R.Rules.profPowerMul(ch, opts.action, opts.slot) || 1; } catch (e) { /* 1 */ } }
    }
    return n > 0 ? Math.max(1, Math.round(n)) : 0;
  }

  // ---------------------------------------------------------------- 閃きの敵の強さ（§4.9.2）
  function rank(d, Tb) {
    if (d && R.Glimmer && R.Glimmer.monRank) { try { return R.Glimmer.monRank(d, Tb); } catch (e) { /* 下へ */ } }
    if (!d) return (Tb || 0) + 1;
    let r = (Tb || 0) + 1;
    if (has(d, 'boss')) r += 2;
    if (has(d, 'rare')) r += 2;
    if (d.golden || has(d, 'golden')) r += 1;
    if (has(d, 'metal')) r += 1;
    return r + (d.rankAdd || 0);
  }
  function ef(d) {
    const E = (R.Rules && R.Rules.K && R.Rules.K.GLIM && R.Rules.K.GLIM.ef) || { normal: 1, golden: 1.5, rare: 2, boss: 2.5 };
    if (!d) return E.normal;
    if (has(d, 'boss')) return E.boss;
    if (has(d, 'rare')) return E.rare;
    if (d.golden || has(d, 'golden')) return E.golden;
    return E.normal;
  }

  // ---------------------------------------------------------------- 出現（V2_PLAN §2.5.13・§2.11「出現」）
  /** ゾーンの戦闘レベルの範囲（lv の表か LZ(T)+lvOff） */
  function zoneLb(z, T) {
    if (z.lv && z.lv.length) return { lo: z.lv[0], hi: z.lv[z.lv.length - 1] };
    const L = LZ(T) + (z.lvOff || 0);
    return { lo: L, hi: L };
  }
  function partyMods() {
    const out = {};
    let chars = [];
    try { chars = R.Party && R.Party.members ? R.Party.members() : []; } catch (e) { chars = []; }
    for (const c of chars) {
      if (!c || !(c.hp > 0)) continue;
      const m = statsOf(c).mods;
      if (!m) continue;
      for (const k of ['goldenPct', 'rareEncPct', 'encounterPct']) out[k] = (out[k] || 0) + (m[k] || 0);
    }
    return out;
  }
  function avgGl() {
    let chars = [];
    try { chars = R.Party && R.Party.members ? R.Party.members() : []; } catch (e) { chars = []; }
    if (!chars.length) return 0;
    const gl = (c) => (R.Growth && R.Growth.equivLevel ? R.Growth.equivLevel(c) : c.gl || 1);
    return chars.reduce((s, c) => s + gl(c), 0) / chars.length;
  }
  let encLast = { zone: null, step: -1e9 };
  /** 出現の 1 歩あたりの確率: 平均の歩数（world 26・dungeon 22、ゾーンの steps で上書き）から安全な歩数を引いた幅の逆数 × rate */
  function stepChance(zoneId, z) {
    const E = K('ENC');
    const avg = z.steps || (/^zw_/.test(zoneId) ? E.world : E.dungeon);
    const base = 1 / Math.max(1, avg - E.safeSteps + 1);   // 平均の間隔 = 安全な歩数 − 1 ＋ 1/base = avg
    const mod = 1 + clamp(partyMods().encounterPct || 0, -100, 50) / 100;
    return base * (z.rate != null ? z.rate : 1) * mod;
  }
  /** レア魔物の差し替えの行（1 つか、cond つきの配列） */
  function rareRow(zoneId) {
    const r = DB.rareEncounters && DB.rareEncounters[zoneId];
    if (!r) return null;
    const list = Array.isArray(r) ? r : [r];
    for (const x of list) {
      if (!x || !DB.monsters[x.mon]) continue;
      if (x.cond && !(R.State && R.State.check && R.State.check(x.cond))) continue;
      return x;
    }
    return null;
  }
  /**
   * FIELD が 1 歩ごとに呼ぶ。o = {tier, dark, steps, ward, force}
   * → null（出ない）| K.setup {zone, tier, dark, mons:[[id,1]…], lv, golden:<番号|-1>, rare, bg, bgm}
   * 乱数は R.Game.seed と歩数から（同じ歩数なら同じ結果）。安全な歩数（前の戦闘から K.ENC.safeSteps）の間は出ない。
   * ward（魔除けの香）: 弱い表だけ出ない（一行の平均の gl ≥ ゾーンの戦闘レベル + K.ENC_ITEM.weakMargin）
   */
  function encounter(zoneId, o) {
    o = o || {};
    const z = zoneId && DB.encounters[zoneId];
    if (!z) return null;
    const steps = o.steps != null ? o.steps : (R.Game && R.Game.steps) || 0;
    const seed = (R.Game && R.Game.seed) || 0;
    const T = o.tier != null ? o.tier : typeof z.tier === 'number' ? z.tier : tierNow();
    const Tb = typeof z.tier === 'number' ? z.tier : T;
    const lb = zoneLb(z, Tb);
    if (o.ward && avgGl() >= lb.hi + K('ENC_ITEM').weakMargin) return null;
    if (!o.force) {
      if (encLast.zone === zoneId && steps >= encLast.step && steps - encLast.step < K('ENC').safeSteps) return null;
      const g = mkRng(`${seed}:enc:${zoneId}:${steps}`);
      if (!g.chance(stepChance(zoneId, z))) return null;
    }
    const saved = RNG;
    RNG = mkRng(`${seed}:encgroup:${zoneId}:${steps}`);
    try {
      let Lb = lb.lo === lb.hi ? lb.lo : rng().ri(lb.lo, lb.hi);
      let ids = null, rare = false;
      const rr = rareRow(zoneId);
      if (rr && !o.noRare) {
        const mods = partyMods();
        const p = (1 / Math.max(1, rr.rate || K('RARE_ENC'))) * (1 + Math.min(K('MODCAP').party, mods.rareEncPct || 0) / 100);
        if (o.rare === 'force' || rng().chance(p)) { rare = true; ids = [rr.mon]; Lb += K('RARE_MON').lvOff; }
      }
      if (!ids) {
        const grp = zoneGroup(zoneId, Tb);
        if (!grp) return null;
        ids = buildList(grp.mons, Tb);
      }
      if (!ids.length) return null;
      const golden = rare || o.noGolden ? -1 : rollGolden(ids, partyMods());
      encLast = { zone: zoneId, step: steps };
      const setup = { zone: zoneId, tier: Tb, dark: !!o.dark, mons: ids.map((id) => [id, 1]), lv: Lb, golden, rare };
      if (z.bg) setup.bg = z.bg;
      if (rare || golden >= 0) setup.bgm = 'rarebattle';
      return setup;
    } finally { RNG = saved; }
  }
  /** 新しいマップに入った・戦闘が終わった後の「安全な歩数」を数え直す（FIELD が呼んでよい。呼ばなくても動く） */
  function resetEncounter(steps) { encLast = { zone: null, step: steps != null ? steps : -1e9 }; }

  R.onData(fillAll);

  Object.assign((R.Mon = R.Mon || {}), {
    K, KF, LZ, curve, hpBoss, mobTier, resolve, lower, def, buildList, zoneGroups, zoneGroup, rollGolden, dropChances, rollDrops, pickPool,
    healAmount, healf, abilMul, fillStats, fillAll, goldenName, canBeGolden, isDark, rank, ef, fwLen, encounter, resetEncounter, stepChance, zoneLb,
    rng, setRng, mkRng, weighted,
    clearCache() { cache.clear(); },
  });
})(window.RPG);
