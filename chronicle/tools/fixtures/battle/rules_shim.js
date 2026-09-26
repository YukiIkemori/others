// Battle test fixture (NOT shipped): a stand-in for the parts of R.Rules / R.Tier the battle engine consumes
// (DESIGN §3.3.3, §4.2–§4.4, §4.9.1, §4.18.1), written straight from the spec formulas.
// It is installed ONLY when the real src/systems/rules.js does not provide the Chronicle API yet
// (tests then say "rules: fixture shim"); set RPG_BATTLE_SHIM=1 (node) / R.fxForceShim (browser) to force it.
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;
  const real = R.Rules;
  const force = (typeof process !== 'undefined' && process.env && process.env.RPG_BATTLE_SHIM === '1') || R.fxForceShim;
  const chronicle = real && real.K && real.K.STAGE && real.effectiveRow && real.techList && real.spellList && real.train && real.stats;
  if (chronicle && !force) { R.fxRulesShim = false; return; }
  R.fxRulesShim = true;

  const STATS = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
  const SLOTS = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];
  const WTYPES = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff'];   // A19 (bare hands = the 'fist' entry below, not a type)
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const WTYPE = {
    sword: { hands: 1, reach: false, kind: 'slash', mult: 1.0, hit: 0, crit: 2, stat: ['str'], magMult: 0.5 },
    greatsword: { hands: 2, reach: false, kind: 'slash', mult: 1.4, hit: -5, crit: 2, stat: ['str'], magMult: 0.5 },
    dagger: { hands: 1, reach: false, kind: 'pierce', mult: 0.75, hit: 8, crit: 10, stat: ['dex'], magMult: 0.5 },
    axe: { hands: 1, reach: false, kind: 'slash', mult: 1.15, hit: -10, crit: 4, stat: ['str'], magMult: 0.5 },
    spear: { hands: 2, reach: true, kind: 'pierce', mult: 1.25, hit: 0, crit: 2, stat: ['str', 'dex'], magMult: 0.5 },
    bow: { hands: 2, reach: true, kind: 'pierce', mult: 1.1, hit: 5, crit: 4, stat: ['dex'], magMult: 0.5 },
    staff: { hands: 1, reach: true, kind: 'blunt', mult: 0.6, hit: 0, crit: 0, stat: ['str', 'int'], magMult: 1.0 },
    fist: { hands: 1, reach: false, kind: 'blunt', mult: 0.9, hit: 5, crit: 5, stat: ['str', 'agi'], magMult: 0.5 },
  };
  const K = {
    STAT_K: 64, DK: (L) => 40 + 5 * L,
    W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112], U: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6], D: (T) => 70 + 30 * T, LZ: (T) => 6 + 6 * T,
    WTYPE,
    HP: { a: 17.5, b: 14.7, p: 0.9 }, MP: { a: 8, b: 2.6, p: 0.85, cap: 250 },
    GROW: { hp: { S: 1.25, A: 1.12, B: 1.0, C: 0.9, D: 0.8 }, mp: { S: 1.3, A: 1.15, B: 1.0, C: 0.85, D: 0.7 } },
    EXP: { a: 3, b: 1.2, c: 0.06, bplMax: 16, bplAmp: 12, bplTau: 12, perBattle: 3.3 },
    FALLOFF: { up: 0.75, downStep: 0.1, downMax: 10, min: 0.03 }, RESERVE_RATE: 0.6,
    ROW: { middleTaken: 0.7, weight: { front: 2, middle: 1 }, aimMiddle: { front: 1, middle: 3 } },
    STAGE: [0.63, 0.77, 1, 1.3, 1.6], MOB: { atk: 0.6, mag: 0.6 },
    PROF_PTS: [0, 5, 15, 30, 55, 90, 135, 190, 260, 350, 460], PEXP: [15, 40, 70, 100, 135, 175, 220, 270, 330, 400], PROF_CAP: 999,
    GLIM: {
      base: { tech: 0.012, secret: 0.006, single: 0.015, comboA: 0.012, comboB: 0.010, triple: 0.008 }, techLv: [1, 10], spellLv: [1, 8], cap: 0.35,
      apt: { S: 2, A: 1.5, B: 1, C: 0.6, D: 0.3 }, expect: [2, 4, 6, 8, 10, 12, 14, 16, 17, 19], fkSlope: 0.4, fkFree: 2, fkMax: 4, stoneEntry: 10,
      ef: { normal: 1, golden: 1.5, rare: 2, boss: 2.5 }, margin: 0.1, marginMax: 5, wFrom: 3, wLowest: 2,
    },
    DROP: { cap: { normal: 0.75, rare: 0.5, super: 0.125 }, modCap: 150, golden: { normal: 2, rare: 8, super: 8 } },
    MODCAP: { party: 150, preempt: 30, exp: 30, expMin: -100, glim: 40, prof: 50, cost: -50, encounter: 50 },
    GOLDEN: { rate: 1 / 40, hp: 2, stat: 1.2, exp: 3, gold: 5, lvShow: 2 }, RARE_ENC: 80, METAL: { exp: 30, gold: 10, flee: 0.5 },
    AFTER: { mpPct: 0.12 }, ESCAPE: { base: 0.55, step: 0.12, agi: 0.5, min: 0.25, max: 0.95 }, PREEMPT: 1 / 16,
    WEIGHT: { heavy: { def: 1, mdef: 0.2, eva: 8 }, light: { def: 0.65, mdef: 0.35, eva: 5 }, cloth: { def: 0.4, mdef: 0.6, eva: 2 } },
  };
  K.hpBoss = (L) => (6 + 2.6 * L + 0.1 * L * L) * (0.65 + 0.05 * U.clamp((L - 6) / 6, 0, 10));

  function src(c) { return (c && ((c.id === 'hero' && DB.heroTypes[c.heroType]) || DB.companions[c.id])) || {}; }
  function baseStats(c) { const s = src(c).stats || c._stats || {}; const o = {}; for (const k of STATS) o[k] = s[k] || 20; return o; }
  function growth(c) { return src(c).growth || { hp: 'B', mp: 'B' }; }
  function aptitude(c) {
    const a = src(c).apt || { w: {}, e: {} };
    const A = K.GLIM.apt;
    const w = {}, e = {};
    for (const t of WTYPES) w[t] = A[(a.w && a.w[t]) || 'C'];
    for (const t of ELEMENTS) e[t] = A[(a.e && a.e[t]) || 'C'];
    if (c && c.id === 'hero' && c.favor) { if (c.favor.kind === 'weapon') w[c.favor.id] = A.S; else e[c.favor.id] = A.S; }
    return { w, e };
  }
  function mergeMods(list) {
    const out = {};
    for (const m of list) {
      if (!m) continue;
      for (const k in m) {
        const v = m[k];
        if (typeof v === 'number') out[k] = (out[k] || 0) + v;
        else if (typeof v === 'boolean') out[k] = out[k] || v;
        else if (Array.isArray(v)) out[k] = Array.from(new Set((out[k] || []).concat(v)));
        else if (v && typeof v === 'object') {
          out[k] = Object.assign({}, out[k]);
          for (const x in v) out[k][x] = k === 'elemResist' ? (out[k][x] != null ? Math.min(out[k][x], v[x]) : v[x]) : (out[k][x] || 0) + v[x];
        }
      }
    }
    return out;
  }
  function mods(c) {
    const list = [];
    for (const s of SLOTS) { const it = c.equip && c.equip[s] && DB.items[c.equip[s]]; if (it && it.mods) list.push(it.mods); }
    const inn = c.id === 'hero' ? src(c).mods : src(c).innate && src(c).innate.mods;
    if (inn) list.push(inn);
    return mergeMods(list);
  }
  const lvCurve = (P, L) => P.a + P.b * Math.pow(Math.max(0, L - 1), P.p);
  function maxAt(c, key, level) {
    const L = level || c.level || 1;
    const g = growth(c);
    const m = mods(c);
    const b = (c.bonus && c.bonus[key]) || 0;
    if (key === 'hp') {
      const vit = stats0(c).vit;
      return Math.min(999, Math.round(Math.round(lvCurve(K.HP, L) * K.GROW.hp[g.hp || 'B'] * ((160 + vit) / 200)) * (1 + (m.hpPct || 0) / 100) + b));
    }
    return Math.min(K.MP.cap, Math.round(Math.round(lvCurve(K.MP, L) * K.GROW.mp[g.mp || 'B']) * (1 + (m.mpPct || 0) / 100) + b));
  }
  /** the six stats with equipment (and % mods) */
  function stats0(c) {
    const s = baseStats(c);
    const m = mods(c);
    for (const sl of SLOTS) {
      const it = c.equip && c.equip[sl] && DB.items[c.equip[sl]];
      if (!it) continue;
      for (const k of STATS) s[k] += ((it.stats && it.stats[k]) || 0) + ((it.statsAdd && it.statsAdd[k]) || 0);
    }
    for (const k of STATS) s[k] = U.clamp(Math.round(s[k] * (1 + (m[k + 'Pct'] || 0) / 100)), 0, 999);
    return s;
  }
  function weaponW(c, id, s, m) {
    const it = id && DB.items[id];
    const wtype = it ? it.wtype : 'fist';
    const T = WTYPE[wtype] || WTYPE.fist;
    const S = T.stat.reduce((a, k) => a + s[k], 0) / T.stat.length;
    const base = it ? it.atk || 0 : 4;
    return {
      id: id || null, wtype, atk: Math.round((base + (m.atk || 0)) * (64 + S) / 64),
      hit: 90 + Math.floor(s.dex / 4) + T.hit + ((it && it.hit) || 0) + (m.hit || 0),
      crit: Math.min(60, 2 + Math.floor(s.dex / 16) + T.crit + ((it && it.crit) || 0) + (m.crit || 0)),
      element: (it && it.element) || null, onHit: (it && it.onHit) || null,
      reach: (it && it.reach != null ? it.reach : T.reach) ? 'any' : 'front',
      twoHanded: !!(it && (it.twoHanded || T.hands === 2)),
    };
  }
  function stats(c) {
    const s = stats0(c);
    const m = mods(c);
    const w = {};
    const e = c.equip || {};
    w.weapon1 = e.weapon1 ? weaponW(c, e.weapon1, s, m) : null;
    w.weapon2 = e.weapon2 ? weaponW(c, e.weapon2, s, m) : null;
    w.fist = weaponW(c, null, s, m);
    let wm = 0;
    for (const sl of ['weapon1', 'weapon2']) { const it = e[sl] && DB.items[e[sl]]; if (it) wm = Math.max(wm, it.mag || 0); }
    if (!wm) wm = 4;
    let def = 0, mdef = 0, eva = 0;
    for (const sl of ['shield', 'head', 'body', 'hands', 'feet']) {
      const it = e[sl] && DB.items[e[sl]];
      if (!it) continue;
      def += it.def || 0; mdef += it.mdef || 0; if (sl === 'shield') eva += it.eva || 0;
    }
    def = Math.max(0, Math.round((def + (m.def || 0)) * (1 + (m.defPct || 0) / 100)));
    mdef = Math.max(0, Math.round((mdef + Math.floor(s.mnd / 2) + (m.mdef || 0)) * (1 + (m.mdefPct || 0) / 100)));
    const W1 = w.weapon1 || w.weapon2 || w.fist;
    const elemResist = {};
    for (const el of ELEMENTS) elemResist[el] = m.elemResist && m.elemResist[el] != null ? m.elemResist[el] : 1;
    return Object.assign(s, {
      hp: maxAt(c, 'hp'), mp: maxAt(c, 'mp'),
      atk: W1.atk, mag: Math.round((wm + (m.mag || 0)) * (64 + s.int) / 64), def, mdef,
      hit: W1.hit, eva: Math.min(60, Math.floor(s.agi / 5) + eva + (m.eva || 0)), crit: W1.crit, spd: s.agi + (m.spd || 0),
      w, elemResist, statusImmune: (m.statusImmune || []).slice(), mods: m,
    });
  }
  function commands(c) {
    const out = [];
    const e = c.equip || {};
    for (const sl of ['weapon1', 'weapon2']) {
      const it = e[sl] && DB.items[e[sl]];
      if (it) out.push({ type: 'weapon', slot: sl, wtype: it.wtype, name: (DB.weaponTypes[it.wtype] || {}).name || it.wtype });
    }
    if (!out.length) out.push({ type: 'weapon', slot: null, wtype: 'fist', name: '素手' });
    if ((c.spells || []).length && !mods(c).noSpell) out.push({ type: 'spell', name: '術' });
    out.push({ type: 'defend', name: '防御' }, { type: 'item', name: '道具' });
    return out;
  }
  const actOrder = (id) => { const a = DB.actions[id]; return a ? (a.order != null ? a.order : a.rank || 0) : 999; };
  function techList(c, wtype) { return (c.techs || []).filter((id) => DB.actions[id] && DB.actions[id].kind === 'tech' && DB.actions[id].wtype === wtype); }
  function spellList(c) { return (c.spells || []).filter((id) => DB.actions[id] && DB.actions[id].kind === 'spell').sort((a, b) => actOrder(a) - actOrder(b)); }
  function costOf(c, id, key, pct) {
    const a = DB.actions[id];
    if (!a || !a[key]) return 0;
    return Math.max(1, Math.round(a[key] * (1 + Math.max(K.MODCAP.cost, mods(c)[pct] || 0) / 100)));
  }
  const mpCost = (c, id) => costOf(c, id, 'mp', (DB.actions[id] || {}).kind === 'tech' ? 'techCostPct' : 'mpCostPct');   // A18: techs pay MP
  function effectiveRow(c, party) {
    if ((c.row || 'front') !== 'middle') return 'front';
    return (party || []).some((p) => p.hp > 0 && (p.row || 'front') !== 'middle') ? 'middle' : 'front';
  }
  function profRank(pts) { let r = 0; K.PROF_PTS.forEach((p, i) => { if (pts >= p) r = i; }); return Math.min(10, r); }
  function addProf(c, kind, id, pts) {
    const bag = kind === 'w' ? (c.wprof = c.wprof || {}) : (c.eprof = c.eprof || {});
    const before = profRank(bag[id] || 0);
    const T = R.Tier && R.Tier.effective ? R.Tier.effective() : 0;
    const pct = ((mods(c).profPct || {})[id] || 0);
    let n = pts * (1 + Math.min(K.MODCAP.prof, pct) / 100);
    if ((bag[id] || 0) < K.PEXP[U.clamp(T, 0, 9)]) n *= 2;
    bag[id] = Math.min(K.PROF_CAP, (bag[id] || 0) + n);
    const rank = profRank(bag[id]);
    return { rank, up: rank > before };
  }
  function train(c, info) {
    const ups = [];
    const add = (kind, id, pts) => { const r = addProf(c, kind, id, pts); if (r.up) ups.push({ kind, id, rank: r.rank }); };
    if (info.kind === 'attack' || info.kind === 'tech') {
      const a = info.kind === 'tech' && DB.actions[info.actionId];
      add('w', info.wtype || 'fist', a && a.glim && a.glim.lv >= 6 ? 2 : 1);
    } else if (info.kind === 'spell') {
      const a = DB.actions[info.actionId];
      const els = info.elements || [];
      let pts = 1;
      if (!info.stone && a) pts = els.length >= 3 ? 3 : els.length === 2 || (a.step || a.rank || 1) >= 3 ? 2 : 1;
      for (const el of els) add('e', el, pts);
    }
    return ups;
  }
  const mexp = (L) => K.EXP.a + K.EXP.b * L + K.EXP.c * L * L;
  const bpl = (L) => K.EXP.bplMax - K.EXP.bplAmp * Math.exp(-L / K.EXP.bplTau);
  const need = (L) => Math.round(mexp(L) * K.EXP.perBattle * bpl(L));
  function expForLevel(L) { let s = 0; for (let i = 1; i < L; i++) s += need(i); return s; }
  function gainExp(c, n) {
    const before = { hp: maxAt(c, 'hp'), mp: maxAt(c, 'mp') };
    const lv0 = c.level || 1;
    c.exp = (c.exp || 0) + n;
    while (c.level < 99 && c.exp >= expForLevel(c.level + 1)) c.level++;
    const gains = { hp: maxAt(c, 'hp') - before.hp, mp: maxAt(c, 'mp') - before.mp };
    if (c.level > lv0 && c.hp > 0) { c.hp += gains.hp; c.mp += gains.mp; }
    return { levels: c.level - lv0, gains };
  }
  function battleExp(c, killed) {
    let sum = 0;
    for (const d of killed || []) {
      const diff = (c.level || 1) - (d.lv || 1);
      const f = diff <= 0 ? 1 + K.FALLOFF.downStep * Math.min(K.FALLOFF.downMax, -diff) : Math.max(K.FALLOFF.min, Math.pow(K.FALLOFF.up, diff));
      sum += Math.round((d.exp || 0) * f);
    }
    return Math.round(sum * (1 + U.clamp(mods(c).expPct || 0, K.MODCAP.expMin, K.MODCAP.exp) / 100));
  }
  function clampHpMp(c) {
    const st = stats(c);
    c.hp = U.clamp(c.hp | 0, 0, st.hp); c.mp = U.clamp(c.mp | 0, 0, st.mp);
  }
  function zoneLevel(zoneId, map) {
    const z = DB.encounters[zoneId] || {};
    const Tb = typeof z.tier === 'number' ? z.tier : (R.Game && R.Game.tier) || 0;
    if (z.lv) return { Tb, Lb: z.lv[0] };
    const off = map && map.lvOff != null ? map.lvOff : z.lvOff || 0;
    return { Tb, Lb: K.LZ(Tb) + off };
  }
  function isAlive(c) { return c && c.hp > 0; }

  R.Rules = Object.assign({}, real || {}, {
    K, STATS, SLOTS, WTYPES, ELEMENTS, MAX_LEVEL: 99,
    baseStats, aptitude, stats, mods, maxAt, commands, techList, spellList, mpCost, effectiveRow,
    profRank, addProf, train, expForLevel, gainExp, battleExp, clampHpMp, zoneLevel, isAlive,
    dk: K.DK, prof: (c, kind, id) => ((kind === 'w' ? c.wprof : c.eprof) || {})[id] || 0,
    _shim: true,
  });
  if (!R.Tier || !R.Tier.current) {
    R.Tier = Object.assign({}, R.Tier || {}, {
      MAX: 8,
      current: () => (R.Game && R.Game.tier) || 0,
      effective: () => (R.Game ? (R.Game.gameClear ? 9 : R.Game.tier || 0) : 0),
      pick: (table, tier) => (Array.isArray(table) ? table[Math.min(Math.max(0, tier | 0), table.length - 1)] : table),
      _shim: true,
    });
  }
})(window.RPG);
