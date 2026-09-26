// Shared party model for every simulator (DESIGN §13 補足, §4.17.1, §6.10, §7.12.1, §8.13.1, §12.3).
// Builds the party a player would plausibly have at tier T, the same way for sim_balance (A22),
// sim_zones (A11), sim_bosses / sim_loot (A12), sim_spells / sim_glimmer (A8) and sim_growth (A1).
//
//   const PM = require('./lib/party_model');
//   PM.build(R, { tier, members: ['hero', '<compId>'…], heroType, favor, build: 'phys'|'magic'|'balanced',
//                 gear: 'none'|'shop'|'real'|'rare'|'super', level?, kind?, rows?, weapons?, learned?, rareSlots?, superSlots? })
//     → { party: [CharState], inv, notes: [string], spec }
//   PM.levelAt(tier, kind?)   → 想定レベル（kind: 'mob' LZ+1 | 'mid' LZ+2 | 'boss' LZ+3 | 'final' 56 | 'last' 58 | 'super' 64 | 'prologue' 5）
//   PM.profAt(tier, apt)      → 想定の熟練度のポイント（§4.9.1 の途中加入の式 PEXP(T) × {S .8, A .7, B .5, C .3, D .1}）
//   PM.withGame(R, {tier, party?, gameClear?}, fn) → fn(R.Game) の戻り値（仮の R.Game で実行して元に戻す）
//   PM.runBattle(R, o)        → R.Battle.simulate(o) ＋ 数えた値（下の STATS）。o.party と o.inv は変えない
//   PM.afterBattle(R, party, result) → §4.12.1 の戦闘後の回復（R.Party.afterBattle があればそれ）
//   PM.standard(R, tier, o)   → §4.17.1 の標準のパーティ（主人公 戦士・剣 ＋ brigitta marta sylvain）
//   PM.COMBOS                 → §5.4.3 の必ず試す 12 組
//   PM.HERO_VARIANTS          → 主人公のタイプ × 得意分野の代表 6 通り（§4.17.3 B2）
//   PM.K(R)                   → 定数（R.Rules.K があればそれ、無ければ DESIGN §4.18.1 の値）
//
// gear:
//   'none'  = the 'shop' set with every ability stat and mod stripped (Z of §4.3.7/§8.13.1: 能力の装備なし;
//             attack / magic / defence of the items stay, so only the stats differ from N)
//   'shop'  = N: the tier-T normal set, units on the member's build stat (§4.17.1 通常品一式、§8.13.1 N)
//   'real'  = 現実的な装備: 'shop' with 3 slots upgraded to the rare band RB(T) (§4.17.1)
//   'rare'  = R: every slot from the rare band RB(T) that has the build stat (fallback: normal)
//   'super' = S: super-rare items with the build stat (tier ≤ T, highest first; the §8.6.5 T8 sets), fallback rare → normal
//   rareSlots / superSlots (numbers) upgrade that many slots on top of the chosen gear (C3: gear 'real' + superSlots 4)
//   At T 8 the §8.13.1 sets of gear-a are used as is (R.GearA.BUILD_SETS int/str/dex: N for none/shop, R9 — or R7 with
//   rareBand 7 — for rare, S for super) when the member's build stat has one and its weapon type matches the set's
//   (buildSets: true forces the set whatever the weapon, false turns it off).
// Every member gets EXPECT(T) techs/spells (§4.17.1, §6.10: the main weapon's and favoured elements' actions
// in glim.lv order), proficiencies at profAt (equipped weapon types and the spells' elements at least PEXP(T)),
// full HP/MP/WP, status {}. Works on partial data: missing registries are reported in `notes`, never thrown.
'use strict';

const WTYPES = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const STATS = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
const SLOTS = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];
const SLOT_TYPE = { weapon1: 'weapon', weapon2: 'weapon', shield: 'shield', head: 'head', body: 'body', hands: 'hands', feet: 'feet', acc1: 'acc', acc2: 'acc' };
const UPGRADE_ORDER = ['weapon1', 'body', 'head', 'shield', 'hands', 'feet', 'weapon2', 'acc1', 'acc2'];
const APTF = { S: 0.8, A: 0.7, B: 0.5, C: 0.3, D: 0.1 };
const APTN = { S: 4, A: 3, B: 2, C: 1, D: 0 };
// §4.3.4 attack stat per weapon type (the "phys" build stat); 'sd' = (str+dex)/2 → the larger of the two
const WSTAT = { sword: 'str', greatsword: 'str', dagger: 'dex', axe: 'str', spear: 'sd', bow: 'dex', club: 'str', staff: 'int', katana: 'sd', fist: 'sa', whip: 'dex' };
const TWO_HANDED = { greatsword: true, spear: true, bow: true };

// DESIGN §4.18.1 (used only when R.Rules.K is missing or partial)
const K_FALLBACK = {
  W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112], U: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6],
  LZ: (T) => 6 + 6 * T, D: (T) => 70 + 30 * T, DK: (L) => 40 + 5 * L,
  PROF_PTS: [0, 5, 15, 30, 55, 90, 135, 190, 260, 350, 460], PEXP: [15, 40, 70, 100, 135, 175, 220, 270, 330, 400],
  GLIM: { expect: [2, 4, 6, 8, 10, 12, 14, 16, 17, 19] }, GRADE_MULT: { normal: 1, rare: 2, super: 3 },
  AFTER: { mpPct: 0.10, wpPct: 0.10 }, MOB: { atk: 0.6, mag: 0.6 }, RESERVE_RATE: 0.6,
};
const RB = [1, 1, 3, 3, 5, 5, 7, 7, 9, 9];

function K(R) {
  const k = (R.Rules && R.Rules.K) || {};
  const out = Object.assign({}, K_FALLBACK, k);
  out.GLIM = Object.assign({}, K_FALLBACK.GLIM, k.GLIM || {});
  if (typeof out.LZ !== 'function') out.LZ = K_FALLBACK.LZ;
  if (typeof out.D !== 'function') out.D = K_FALLBACK.D;
  return out;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clone = (o) => JSON.parse(JSON.stringify(o));

function levelAt(tier, kind) {
  const T = clamp(tier | 0, 0, 9), LZ = 6 + 6 * T;
  switch (kind) {
    case 'prologue': return 5;
    case 'mid': return LZ + 2;
    case 'boss': return LZ + 3;
    case 'final': return 56;
    case 'last': return 58;
    case 'super': return 64;
    default: return LZ + 1;
  }
}
function profAt(tier, apt) {
  const T = clamp(tier | 0, 0, 9);
  return Math.round(K_FALLBACK.PEXP[T] * (APTF[apt] != null ? APTF[apt] : 0.5));
}
function profRank(R, pts) {
  if (R.Rules && R.Rules.profRank) { try { return R.Rules.profRank(pts); } catch (e) { /* fall through */ } }
  const P = K(R).PROF_PTS; let r = 0;
  for (let i = 0; i < P.length; i++) if (pts >= P[i]) r = i;
  return r;
}

// ------------------------------------------------------------------ characters
function aptOf(R, c) {
  const DB = R.DB;
  if (c.id === 'hero') {
    const T = DB.heroTypes && DB.heroTypes[c.heroType];
    const apt = clone((T && T.apt) || { w: {}, e: {} });
    if (c.favor) {
      apt[c.favor.kind === 'weapon' ? 'w' : 'e'][c.favor.id] = 'S';
      const kit = DB.starterKit || {};
      if (T && T.pairElement && c.favor.kind === 'element' && kit.pair && kit.pair[c.favor.id]) apt.e[kit.pair[c.favor.id]] = 'A';
    }
    return apt;
  }
  const D = DB.companions && DB.companions[c.id];
  return clone((D && D.apt) || { w: {}, e: {} });
}

/** §5.2.7 without R.Rules.newChar */
function fallbackNewChar(R, spec, notes) {
  const DB = R.DB;
  const kit = DB.starterKit || {};
  const profFrom = (apt) => {
    const P = (kit.prof) || { S: 15, A: 5 };
    const w = {}, e = {};
    for (const t of WTYPES) w[t] = P[(apt.w || {})[t]] || 0;
    for (const el of ELEMENTS) e[el] = P[(apt.e || {})[el]] || 0;
    return { w, e };
  };
  const equip = {}; for (const s of SLOTS) equip[s] = null;
  const base = { level: 1, exp: 0, hp: 1, mp: 0, wp: 0, bonus: { hp: 0, mp: 0, wp: 0 }, status: {}, equip, techs: [], spells: [],
    mem: { cmd: 0, list: {}, item: 0, target: null }, joined: { tier: 0, frame: 0 }, counts: { battles: 0, kills: 0, glimmers: 0 } };
  if (spec.id === 'hero') {
    const hs = spec.heroSpec;
    const T = (DB.heroTypes || {})[hs.type];
    if (!T) { notes.push(`heroTypes.${hs.type} missing`); }
    const c = Object.assign(base, { id: 'hero', name: hs.name, gender: hs.gender, heroType: hs.type, favor: hs.favor });
    const apt = aptOf(R, c);
    const pf = profFrom(apt); c.wprof = pf.w; c.eprof = pf.e;
    const fw = hs.favor && hs.favor.kind === 'weapon';
    c.equip.weapon1 = fw ? (kit.weapon || {})[hs.favor.id] || (T && T.defaultWeapon) || null : (T && T.defaultWeapon) || null;
    for (const s of ['body', 'head', 'shield']) c.equip[s] = (T && T.startEquip && T.startEquip[s]) || null;
    const wt = c.equip.weapon1 && DB.items[c.equip.weapon1] && DB.items[c.equip.weapon1].wtype;
    if (wt && TWO_HANDED[wt]) c.equip.shield = null;
    const of = (T && T.onFavor && T.onFavor[hs.favor.kind]) || { techs: [], spells: [] };
    c.techs = (fw && kit.tech && kit.tech[hs.favor.id] ? [kit.tech[hs.favor.id]] : []).concat(of.techs || []);
    c.spells = (!fw && kit.spell && kit.spell[hs.favor.id] ? [kit.spell[hs.favor.id]] : []).concat(of.spells || []);
    c.row = T && T.row && T.row !== 'auto' ? T.row : (wt && ['spear', 'bow', 'whip'].includes(wt)) || !fw ? 'middle' : 'front';
    return c;
  }
  const D = (DB.companions || {})[spec.id];
  if (!D) { notes.push(`companions.${spec.id} missing`); return null; }
  const c = Object.assign(base, { id: spec.id, name: D.name, gender: D.gender, row: D.row || 'front' });
  const pf = profFrom(D.apt || {}); c.wprof = pf.w; c.eprof = pf.e;
  Object.assign(c.equip, D.startEquip || {});
  c.techs = (D.startTechs || []).slice(); c.spells = (D.startSpells || []).slice();
  return c;
}

function newChar(R, spec, notes) {
  if (R.Rules && R.Rules.newChar) {
    try {
      const c = R.Rules.newChar(spec);
      if (c && c.equip && c.wprof) return c;
      notes.push('R.Rules.newChar returned an incomplete CharState; fallback used');
    } catch (e) { notes.push('R.Rules.newChar threw (' + (e && e.message) + '); fallback used'); }
  }
  return fallbackNewChar(R, spec, notes);
}

function statsOf(R, c) {
  if (R.Rules && R.Rules.stats) { try { return R.Rules.stats(c); } catch (e) { /* ignore */ } }
  return null;
}
function fullRestore(R, c) {
  const st = statsOf(R, c);
  if (st) { c.hp = st.hp; c.mp = st.mp; c.wp = st.wp; }
  c.status = {};
}

// ------------------------------------------------------------------ items
function itemStats(R, it) {
  if (!it) return {};
  if (it.stats) return it.stats;
  // units not filled yet (rules.fillItem missing): compute gearStat for scoring only
  const out = {};
  if (it.units) {
    const U = K(R).U, T = it.tier || 0, GM = { normal: 1, rare: 2, super: 3 }[it.grade || 'normal'] || 1;
    const SK = { s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' };
    for (const m of String(it.units).matchAll(/([svdaim])(\d)/g)) out[SK[m[1]]] = Math.max(1, Math.round(+m[2] * U[T])) * GM;
    for (const [k, v] of Object.entries(it.statsAdd || {})) out[k] = (out[k] || 0) + v;
  }
  return out;
}
function statScore(stats, key) {
  if (!stats) return 0;
  if (key === 'sd') return Math.max(stats.str || 0, stats.dex || 0) + 0.5 * Math.min(stats.str || 0, stats.dex || 0);
  if (key === 'sa') return Math.max(stats.str || 0, stats.agi || 0) + 0.5 * Math.min(stats.str || 0, stats.agi || 0);
  if (key === 'phys+int') return (stats.str || 0) + (stats.dex || 0) + (stats.int || 0);
  return stats[key] || 0;
}

/** index of the item registry by slot type (built once per DB state) */
function itemIndex(R) {
  const DB = R.DB;
  const n = Object.keys(DB.items || {}).length;
  if (R.__pmIndex && R.__pmIndex.n === n) return R.__pmIndex;
  const byType = {};
  for (const [id, it] of Object.entries(DB.items || {})) {
    if (!it || !it.type) continue;
    (byType[it.type] = byType[it.type] || []).push(Object.assign({ id }, it));
  }
  R.__pmIndex = { n, byType };
  return R.__pmIndex;
}

/** pick the best item for a slot. want = {grade:'normal'|'rare'|'super', tier, stat, wtype?, weight?} */
function pickItem(R, slotType, want, used) {
  const idx = itemIndex(R);
  const list = idx.byType[slotType] || [];
  const T = want.tier;
  const okSrc = (it) => {
    if (want.grade === 'normal') return (it.grade || 'normal') === 'normal' && (it.src === 'shop' || it.src == null) && !(it.line && /^charm_/.test(it.line));
    if (want.grade === 'rare') return it.grade === 'rare' && (it.src === 'drop' || it.src === 'mdrop');
    if (want.grade === 'super') return it.grade === 'super' && (it.src === 'super' || it.src == null);
    return true;
  };
  let best = null, bestScore = -Infinity;
  for (const it of list) {
    if (!okSrc(it)) continue;
    if (want.wtype && it.wtype !== want.wtype) continue;
    if (it.only || it.gender) continue;
    const t = it.tier || 0;
    let tierScore;
    if (want.grade === 'normal') { if (t !== T) continue; tierScore = 0; }
    else if (want.grade === 'rare') { const band = RB[clamp(T, 0, 9)]; if (t > band) continue; tierScore = t === band ? 0 : -(band - t) * 50; }
    else { if (t > T) continue; tierScore = -(T - t) * 30; }
    if (used && used[it.id] && (used[it.id] >= (it.grade === 'normal' ? 99 : 1))) continue;
    const st = itemStats(R, it);
    let s = statScore(st, want.stat) * 10 + tierScore;
    if (slotType === 'weapon') s += (want.stat === 'int' ? (it.mag || 0) : (it.atk || 0)) * 0.5;
    else s += ((it.def || 0) + (it.mdef || 0)) * 0.1;
    if (want.weight && it.weight === want.weight) s += 3;
    if (it.quirk && want.noQuirk) continue;                                                    // realistic upgrades avoid quirk items
    if (it.quirk && want.grade !== 'super') s -= 25;
    if (it.twoHanded && slotType === 'weapon' && want.wtype && !TWO_HANDED[want.wtype]) s -= 40;   // quirk: one-handed type made two-handed
    if (s > bestScore) { bestScore = s; best = it; }
  }
  return best ? best.id : null;
}

/** weapon types of a member: [weapon1 wtype, weapon2 wtype|null] */
function weaponTypes(R, c) {
  const w = (slot) => { const id = c.equip[slot]; return id && R.DB.items[id] ? R.DB.items[id].wtype : null; };
  let w1 = w('weapon1'), w2 = w('weapon2');
  const apt = aptOf(R, c).w || {};
  const ranked = WTYPES.slice().sort((a, b) => (APTN[apt[b]] || 0) - (APTN[apt[a]] || 0));
  if (!w1) w1 = ranked[0];
  if (!w2) {
    // a second weapon type a player would carry: the best other apt that is usable from the member's row
    const mid = c.row === 'middle';
    // a one-handed main weapon keeps its shield: the second weapon is one-handed too
    w2 = ranked.find((t) => t !== w1 && (!mid || ['spear', 'bow', 'whip'].includes(t)) && (!TWO_HANDED[t] || TWO_HANDED[w1]) && t !== 'staff') || null;
    if (w1 === 'staff' && !w2) w2 = 'whip';
  }
  return [w1, w2];
}

function naturalBuild(R, c) {
  if (c.id === 'hero') {
    const t = c.heroType;
    if (t === 'mage') return 'magic';
    if (t === 'spellblade' || t === 'wanderer') return c.favor && c.favor.kind === 'element' ? 'balanced' : 'phys';
    return 'phys';
  }
  const D = (R.DB.companions || {})[c.id] || {};
  if (D.role === 'caster' || D.role === 'healer') return 'magic';
  if (D.role === 'hybrid') return 'balanced';
  return 'phys';
}

function buildStatFor(R, c, build, wtype, slot) {
  if (build === 'magic') {
    // casters stack 知力 (術力, §4.3.7); healers put their accessories on 精神 (回復量 MNDF, §4.6.4)
    const D = (R.DB.companions || {})[c.id] || {};
    return D.role === 'healer' && (slot === 'acc1' || slot === 'acc2') ? 'mnd' : 'int';
  }
  const ws = WSTAT[wtype] || 'str';
  if (ws === 'int') return 'int';
  if (ws === 'sd' || ws === 'sa') {
    const bs = baseStats(R, c);
    if (ws === 'sd') return (bs.str || 0) >= (bs.dex || 0) ? 'str' : 'dex';
    return (bs.str || 0) >= (bs.agi || 0) ? 'str' : 'agi';
  }
  return ws;
}
function baseStats(R, c) {
  if (R.Rules && R.Rules.baseStats) { try { return R.Rules.baseStats(c); } catch (e) { /* ignore */ } }
  if (c.id === 'hero') return ((R.DB.heroTypes || {})[c.heroType] || {}).stats || {};
  return ((R.DB.companions || {})[c.id] || {}).stats || {};
}

/** strip ability stats and mods: register (once) stat-less copies of the items (the Z build of §4.3.7) */
function strippedId(R, id) {
  const it = R.DB.items[id];
  if (!it) return id;
  const sid = 'pmz__' + id;
  if (!R.DB.items[sid]) {
    const z = Object.assign({}, it, { stats: {}, statsAdd: undefined, units: undefined, mods: undefined, name: it.name, src: 'pm_model', price: 0 });
    for (const k of ['element', 'onHit', 'vs', 'drain', 'sealTech', 'metalHit', 'hit', 'crit']) delete z[k];
    R.DB.items[sid] = z;
  }
  return sid;
}

function applyBuildSet(R, plan, T, o, stat, w1) {
  const G = R.GearA;
  if (o.buildSets === false || (T !== 8 && o.buildSets !== true) || !G || !G.BUILD_SETS || !G.BUILD_SETS[stat]) return null;
  const col = { none: 'N', shop: 'N', rare: o.rareBand === 7 ? 'R7' : 'R9', super: 'S' }[o.gear];
  const set = col && G.BUILD_SETS[stat][col];
  if (!Array.isArray(set)) return null;
  const slots = G.BUILD_SLOTS || SLOTS;
  const it0 = R.DB.items[set[0]];
  if (!it0 || (w1 && it0.wtype !== w1 && o.buildSets !== true)) return null;
  let n = 0;
  slots.forEach((slot, i) => { if (set[i] && R.DB.items[set[i]]) { plan[slot] = set[i]; n++; } });
  return n ? `${stat}.${col} (${n}/${slots.length})` : null;
}

function equipMember(R, c, o, notes) {
  const T = clamp(o.tier | 0, 0, 9);
  const build = o.buildOf(c);
  const [w1, w2] = (o.weaponsOf && o.weaponsOf(c)) || weaponTypes(R, c);
  const phys = buildStatFor(R, c, 'phys', w1);
  const statFor = (slot) => {
    if (build === 'magic') return buildStatFor(R, c, 'magic', w1, slot);
    if (build === 'balanced') return ['weapon1', 'body', 'feet', 'acc1'].includes(slot) ? phys : 'int';
    return phys;
  };
  const weightFor = (stat) => ({ str: 'heavy', vit: 'heavy', dex: 'light', agi: 'light', int: 'cloth', mnd: 'cloth' })[stat] || null;
  const base = o.gear === 'none' ? 'normal' : o.gear === 'rare' ? 'rare' : o.gear === 'super' ? 'super' : 'normal';
  const choose = (slot, grade, noQuirk) => {
    const type = SLOT_TYPE[slot];
    const stat = statFor(slot);
    const want = { grade, tier: T, stat, weight: weightFor(stat), noQuirk: !!noQuirk };
    if (type === 'weapon') {
      const wt = slot === 'weapon1' ? w1 : w2;
      if (!wt) return null;
      want.wtype = wt;
      if (build === 'magic' && wt === 'staff') want.stat = 'int';
    }
    let id = pickItem(R, type, want, o.used);
    if (!id && grade === 'super') id = pickItem(R, type, Object.assign({}, want, { grade: 'rare' }), o.used);
    if (!id && grade !== 'normal') id = pickItem(R, type, Object.assign({}, want, { grade: 'normal' }), o.used);
    if (!id && type === 'weapon' && T > 0) {
      for (let t = T - 1; t >= 0 && !id; t--) id = pickItem(R, type, Object.assign({}, want, { grade: 'normal', tier: t }), o.used);
    }
    return id;
  };
  const plan = {};
  for (const slot of SLOTS) plan[slot] = choose(slot, base);
  // upgrades on top ('real' = 3 rare slots, plus explicit rareSlots / superSlots)
  let rareN = (o.gear === 'real' ? 3 : 0) + (o.rareSlots || 0), superN = o.superSlots || 0;
  for (const slot of UPGRADE_ORDER) {
    if (!plan[slot] && SLOT_TYPE[slot] === 'weapon') continue;
    const cur = plan[slot] && R.DB.items[plan[slot]];
    const g = cur ? cur.grade || 'normal' : 'normal';
    if (superN > 0 && g !== 'super') { const id = choose(slot, 'super', true); if (id && R.DB.items[id].grade === 'super') { plan[slot] = id; superN--; continue; } }
    if (rareN > 0 && g === 'normal') { const id = choose(slot, 'rare', true); if (id && R.DB.items[id].grade === 'rare') { plan[slot] = id; rareN--; } }
  }
  // T8 builds: the fixed §8.13.1 sets of gear-a (R.GearA.BUILD_SETS.{int,str,dex}.{N,R7,R9,S} in R.GearA.BUILD_SLOTS order)
  // replace the picked items for 'none' / 'shop' (N), 'rare' (R9, or R7 with rareBand 7) and 'super' (S), when the
  // member's build stat has a set and the set's main weapon is of the member's weapon type (o.buildSets false: off)
  const setUsed = applyBuildSet(R, plan, T, o, statFor('weapon1'), w1);
  if (setUsed) notes.push(`${c.id}: §8.13.1 set ${setUsed}`);
  // two-handed weapons exclude the shield (§3.3.3 規則 2)
  const twoH = (id) => { const it = id && R.DB.items[id]; return !!(it && (it.twoHanded || TWO_HANDED[it.wtype])); };
  if (twoH(plan.weapon1) || twoH(plan.weapon2)) plan.shield = null;
  if (o.gear === 'none') for (const s of SLOTS) if (plan[s]) plan[s] = strippedId(R, plan[s]);
  let missing = 0;
  for (const s of SLOTS) {
    if (!plan[s] && !(s === 'shield' && (twoH(plan.weapon1) || twoH(plan.weapon2))) && !(s === 'weapon2' && !w2)) missing++;
    c.equip[s] = plan[s] || null;
    if (plan[s] && o.used) o.used[plan[s]] = (o.used[plan[s]] || 0) + 1;
  }
  if (missing) notes.push(`${c.id}: ${missing} slot(s) without a ${base} T${T} item (${build}/${phys})`);
  return { build, w1, w2 };
}

// ------------------------------------------------------------------ learned actions
function actionsBy(R) {
  const n = Object.keys(R.DB.actions || {}).length;
  if (R.__pmActs && R.__pmActs.n === n) return R.__pmActs;
  const techs = {}, spells = [];
  let i = 0;
  for (const [id, a] of Object.entries(R.DB.actions || {})) {
    i++;
    if (!a || !a.glim) continue;
    if (a.kind === 'tech' || /^t_/.test(id)) (techs[a.wtype] = techs[a.wtype] || []).push({ id, a, i });
    else if (a.kind === 'spell' || /^s_/.test(id)) spells.push({ id, a, i });
  }
  for (const w in techs) techs[w].sort((x, y) => (x.a.glim.lv - y.a.glim.lv) || (x.i - y.i));
  spells.sort((x, y) => (x.a.glim.lv - y.a.glim.lv) || ((x.a.order || 0) - (y.a.order || 0)) || (x.i - y.i));
  R.__pmActs = { n, techs, spells };
  return R.__pmActs;
}

function learnFor(R, c, o, info) {
  const T = clamp(o.tier | 0, 0, 9);
  const kk = K(R);
  const E = (kk.GLIM.expect || K_FALLBACK.GLIM.expect)[T];
  const cap = T + 2;                       // glim.lv reachable by now (normal fights rank T+1, bosses T+3)
  const acts = actionsBy(R);
  const have = new Set([].concat(c.techs || [], c.spells || []));
  const apt = aptOf(R, c);
  const build = info.build;
  // favoured elements: S/A first (then B) — at most 3 for a caster, 1–2 otherwise
  const els = ELEMENTS.slice().sort((a, b) => (APTN[apt.e[b]] || 0) - (APTN[apt.e[a]] || 0));
  for (const s of c.spells || []) { const a = R.DB.actions[s]; for (const el of (a && a.elements) || []) if (!els.slice(0, 1).includes(el)) { els.splice(els.indexOf(el), 1); els.unshift(el); } }
  const nEl = build === 'magic' ? 3 : build === 'balanced' ? 2 : 1;
  const myEls = els.slice(0, nEl);
  // proficiencies: at least profAt(T, apt); the weapons in use and the chosen elements at least PEXP(T)
  const PEXP = kk.PEXP || K_FALLBACK.PEXP;
  for (const w of WTYPES) c.wprof[w] = Math.max(c.wprof[w] || 0, profAt(T, (apt.w || {})[w]));
  for (const el of ELEMENTS) c.eprof[el] = Math.max(c.eprof[el] || 0, profAt(T, (apt.e || {})[el]));
  if (info.w1) c.wprof[info.w1] = Math.max(c.wprof[info.w1], PEXP[T]);
  if (info.w2) c.wprof[info.w2] = Math.max(c.wprof[info.w2], Math.round(PEXP[T] * 0.75));
  if (build !== 'phys') for (const el of myEls) c.eprof[el] = Math.max(c.eprof[el], PEXP[T]);
  const techOk = (t) => t.a.glim.lv <= cap && t.a.glim.lv <= 9 && profRank(R, c.wprof[t.a.wtype] || 0) >= t.a.glim.lv - 1 && !have.has(t.id);
  const spellOk = (s) => {
    const a = s.a;
    if (have.has(s.id) || a.glim.lv > cap) return false;
    const els2 = a.elements || [];
    if (!els2.length || !els2.every((el) => myEls.includes(el))) return false;
    if (!els2.every((el) => profRank(R, c.eprof[el] || 0) >= (a.glim.prof || 0))) return false;
    if (els2.length === 3) {
      const pairs = [[els2[0], els2[1]], [els2[0], els2[2]], [els2[1], els2[2]]];
      const got = pairs.filter(([x, y]) => [...have].some((id) => { const b = R.DB.actions[id]; return b && b.elements && b.elements.length === 2 && b.elements.includes(x) && b.elements.includes(y); })).length;
      if (got < 2) return false;
    }
    return true;
  };
  const want = Math.max(0, E - have.size);
  let nSpell = build === 'magic' ? Math.round(want * 0.7) : build === 'balanced' ? Math.round(want * 0.5) : 0;
  let nTech = want - nSpell;
  const pickSpells = (n) => {
    let k = 0;
    // repeat passes: learning a pair unlocks triples
    for (let pass = 0; pass < 3 && k < n; pass++) for (const s of acts.spells) { if (k >= n) break; if (spellOk(s)) { have.add(s.id); c.spells.push(s.id); k++; } }
    return k;
  };
  const pickTechs = (n) => {
    let k = 0;
    const t1 = (acts.techs[info.w1] || []).filter(techOk), t2 = (acts.techs[info.w2] || []).filter(techOk);
    const n1 = info.w2 ? Math.ceil(n * 0.6) : n;
    for (const t of t1.slice(0, n1)) { have.add(t.id); c.techs.push(t.id); k++; }
    for (const t of t2) { if (k >= n) break; if (!have.has(t.id)) { have.add(t.id); c.techs.push(t.id); k++; } }
    for (const t of t1) { if (k >= n) break; if (!have.has(t.id)) { have.add(t.id); c.techs.push(t.id); k++; } }
    return k;
  };
  const gotS = pickSpells(nSpell);
  nTech += nSpell - gotS;
  const gotT = pickTechs(nTech);
  if (gotT < nTech && build !== 'phys') pickSpells(nTech - gotT);
  else if (gotT < nTech) pickSpells(nTech - gotT);   // a fighter out of techs may still know a few spells
}

// ------------------------------------------------------------------ inventory
function findConsumable(R, pred, fallbackIds) {
  for (const id of fallbackIds) if (R.DB.items[id] && R.DB.items[id].type === 'consumable') return id;
  let best = null, bestPrice = Infinity;
  for (const [id, it] of Object.entries(R.DB.items || {})) {
    if (!it || it.type !== 'consumable' || (it.grade && it.grade !== 'normal') || !it.use) continue;
    if (!pred(it.use.effects || [], it)) continue;
    const p = it.price || 0;
    if (p < bestPrice) { bestPrice = p; best = id; }
  }
  return best;
}
function standardInv(R, notes) {
  const inv = {};
  const heal = findConsumable(R, (ef, it) => it.use.target === 'ally' && ef.some((e) => e.type === 'heal' && Math.abs((e.pct || 0) - 0.35) < 0.06), ['i_salve']);
  const rev = findConsumable(R, (ef) => ef.some((e) => e.type === 'revive'), ['i_revive']);
  const mp = findConsumable(R, (ef) => ef.some((e) => e.type === 'healMp' && Math.abs((e.pct || 0) - 0.3) < 0.06), ['i_ether']);
  if (heal) inv[heal] = 6; else notes.push('no 35% heal item');
  if (rev) inv[rev] = 3; else notes.push('no revive item');
  if (mp) inv[mp] = 3; else notes.push('no MP 30% item');
  return inv;
}

// ------------------------------------------------------------------ build
function build(R, o) {
  o = Object.assign({}, o || {});
  const notes = [];
  const DB = R.DB;
  const T = clamp(o.tier | 0, 0, 9);
  const members = o.members || ['hero', 'brigitta', 'marta', 'sylvain'];
  const L = o.level != null ? o.level : levelAt(T, o.kind);
  const dh = (DB.config && DB.config.defaultHero) || { name: 'アルン', gender: 'm', type: 'warrior', favor: { kind: 'weapon', id: 'sword' } };
  const heroSpec = {
    name: o.heroName || dh.name || 'アルン', gender: o.gender || dh.gender || 'm',
    type: o.heroType || dh.type || 'warrior', favor: o.favor || (o.heroType ? defaultFavor(R, o.heroType) : dh.favor),
  };
  const buildOf = (c) => (typeof o.build === 'string' ? o.build : (o.build && o.build[c.id]) || naturalBuild(R, c));
  const weaponsOf = o.weapons ? (c) => (Array.isArray(o.weapons) ? o.weapons : o.weapons[c.id]) : null;
  const ctx = { tier: T, gear: o.gear || 'shop', buildOf, weaponsOf, rareSlots: o.rareSlots, superSlots: o.superSlots, buildSets: o.buildSets, rareBand: o.rareBand, used: o.shareItems === false ? null : {} };
  const party = [];
  for (const id of members) {
    const c = newChar(R, id === 'hero' ? { id: 'hero', heroSpec } : { id, level: L }, notes);
    if (!c) continue;
    c.level = L;
    if (R.Rules && R.Rules.expForLevel) { try { c.exp = R.Rules.expForLevel(L); } catch (e) { /* ignore */ } }
    if (o.rows && o.rows[id]) c.row = o.rows[id];
    if (!c.wprof) c.wprof = {}; if (!c.eprof) c.eprof = {};
    for (const w of WTYPES) c.wprof[w] = c.wprof[w] || 0;
    for (const el of ELEMENTS) c.eprof[el] = c.eprof[el] || 0;
    c.techs = (c.techs || []).filter((a) => !Object.keys(DB.actions || {}).length || DB.actions[a]);
    c.spells = (c.spells || []).filter((a) => !Object.keys(DB.actions || {}).length || DB.actions[a]);
    let info = { build: buildOf(c), w1: null, w2: null };
    if (Object.keys(DB.items || {}).length) info = equipMember(R, c, ctx, notes);
    else notes.push('DB.items empty: members keep their start equipment');
    if (o.learned !== false) learnFor(R, c, { tier: T }, info);
    fullRestore(R, c);
    party.push(c);
  }
  const inv = o.inv || standardInv(R, notes);
  return { party, inv, notes, spec: { tier: T, level: L, members, heroSpec, gear: ctx.gear } };
}

function defaultFavor(R, type) {
  const T = (R.DB.heroTypes || {})[type];
  if (!T) return { kind: 'weapon', id: 'sword' };
  const fo = T.favorOptions || {};
  if (T.favorKind === 'element') return { kind: 'element', id: (fo.element || ['fire'])[0] };
  return { kind: 'weapon', id: (fo.weapon || [String(T.defaultWeapon || '').split('_')[1] || 'sword'])[0] };
}

// ------------------------------------------------------------------ game / battles
function withGame(R, o, fn) {
  o = o || {};
  const saved = R.Game;
  const savedAuto = R.Battle && R.Battle.autoCarry;
  try {
    let g = null;
    if (R.State && R.State.newGame) { try { R.State.newGame(); g = R.Game; } catch (e) { g = null; } }
    if (!g) {
      g = R.Game = { game: 'chronicle', party: [], reserve: [], tier: 0, regionsCleared: [], gameClear: false, clearCount: 0, flags: {}, vars: {},
        gold: 0, inv: {}, chests: {}, visited: {}, book: { mon: {}, tech: {}, spell: {} }, pos: { map: null, x: 0, y: 0, dir: 'down' },
        respawn: null, encItem: null, secrets: {}, steps: 0, playFrames: 0, battles: 0, wins: 0, escapes: 0,
        records: { glimmers: 0, rareDrops: 0, superDrops: 0, goldens: 0, rareMons: 0 }, title: '' };
    }
    const regions = Object.keys(R.DB.regions || {});
    const order = regions.length ? regions : ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
    const T = clamp(o.tier == null ? 0 : o.tier, 0, 9);
    g.regionsCleared = (o.cleared || order.slice(0, Math.min(8, T)));
    g.tier = g.regionsCleared.length;
    for (const r of g.regionsCleared) g.flags['cleared_' + r] = true;
    if (o.gameClear || T >= 9) { g.gameClear = true; g.flags.game_clear = true; }
    if (o.party) g.party = o.party;
    if (o.reserve) g.reserve = o.reserve;
    if (o.inv) g.inv = o.inv;
    if (o.flags) for (const f of o.flags) g.flags[f] = true;
    return fn(g);
  } finally {
    R.Game = saved;
    if (R.Battle) R.Battle.autoCarry = savedAuto;
  }
}

/** §4.12.1 after-battle recovery on a model party (mutates party) */
function afterBattle(R, party, result) {
  if (R.Party && R.Party.afterBattle) {
    try {
      withGame(R, { party }, () => R.Party.afterBattle(result));
      for (const c of party) c.status = {};
      return;
    } catch (e) { /* fall back to the rule */ }
  }
  const A = K(R).AFTER || K_FALLBACK.AFTER;
  for (const c of party) {
    const st = statsOf(R, c);
    c.status = {};
    if (!st) continue;
    if (c.hp <= 0) continue;
    c.hp = st.hp;
    if (result === 'win') {
      c.mp = Math.min(st.mp, c.mp + Math.ceil(st.mp * A.mpPct));
      c.wp = Math.min(st.wp, c.wp + Math.ceil(st.wp * A.wpPct));
    }
  }
}

/**
 * One battle through the real engine (R.Battle.simulate) with extra counting. R.BattleAI.partyCommands is
 * wrapped for the call so the commands the AI chose are counted per member (spells cast, techs used, items).
 * Returns simulate's result ＋ { hpLostPct, anyDown, downs, mpUsedPct, wpUsedPct, mpUsedBy:[], casts:[], techs:[], items:[], cmdsBy:[] }
 * or null when the engine is not available.
 */
function runBattle(R, o) {
  if (!R.Battle || !R.Battle.simulate) return null;
  const party0 = o.party;
  const stat0 = party0.map((c) => statsOf(R, c) || { hp: c.hp, mp: c.mp, wp: c.wp });
  const hp0 = party0.map((c) => c.hp), mp0 = party0.map((c) => c.mp), wp0 = party0.map((c) => c.wp);
  const casts = party0.map(() => 0), techs = party0.map(() => 0), items = party0.map(() => 0), attacks = party0.map(() => 0);
  const AI = R.BattleAI;
  const orig = AI && AI.partyCommands;
  if (orig) {
    AI.partyCommands = function (eng, opts) {
      const cmds = orig.call(this, eng, opts);
      if (cmds) {
        for (let i = 0; i < party0.length; i++) {
          const cmd = cmds[i];
          if (!cmd) continue;
          if (cmd.type === 'spell') casts[i]++;
          else if (cmd.type === 'tech') techs[i]++;
          else if (cmd.type === 'item') items[i]++;
          else if (cmd.type === 'attack') attacks[i]++;
        }
      }
      return cmds;
    };
  }
  let r;
  try { r = R.Battle.simulate(o); } finally { if (orig) AI.partyCommands = orig; }
  if (!r) return null;
  const end = r.party || [];
  let hpMax = 0, hpLost = 0, mpMax = 0, mpUsed = 0, wpMax = 0, wpUsed = 0, downs = 0;
  const mpUsedBy = [];
  for (let i = 0; i < party0.length; i++) {
    const e = end[i] || party0[i];
    hpMax += stat0[i].hp || 0; hpLost += Math.max(0, hp0[i] - Math.max(0, e.hp || 0));
    mpMax += stat0[i].mp || 0; const mu = Math.max(0, mp0[i] - (e.mp || 0)); mpUsed += mu; mpUsedBy.push(stat0[i].mp ? mu / stat0[i].mp : 0);
    wpMax += stat0[i].wp || 0; wpUsed += Math.max(0, wp0[i] - (e.wp || 0));
    if ((e.hp || 0) <= 0) downs++;
  }
  // the engine's own counters win when it has them (§3.3.8 simulate): casts/techs keyed by char id, mpUsedBy by index
  const byId = (o2, fallback) => (o2 && typeof o2 === 'object' && !Array.isArray(o2) ? party0.map((c) => o2[c.id] || 0) : fallback);
  const mpBy = Array.isArray(r.mpUsedBy) ? r.mpUsedBy.map((v, i) => (stat0[i] && stat0[i].mp ? v / stat0[i].mp : 0)) : mpUsedBy;
  const mpU = r.mpUsed != null ? r.mpUsed : mpUsed, wpU = r.wpUsed != null ? r.wpUsed : wpUsed;
  return Object.assign(r, {
    netLossPct: hpMax ? (100 * hpLost) / hpMax : 0,                                      // HP missing at the end
    hpLostPct: r.hpLossPct != null ? r.hpLossPct : hpMax ? (100 * hpLost) / hpMax : 0,   // damage taken / party max HP (§4.17.3 A2)
    mpUsedPct: mpMax ? (100 * mpU) / mpMax : 0,
    wpUsedPct: wpMax ? (100 * wpU) / wpMax : 0,
    downs, anyDown: downs > 0 || (r.deaths || 0) > 0, mpUsedBy: mpBy,
    casts: byId(r.casts, casts), techs: byId(r.techs, techs), items, attacks,
  });
}

/** §4.17.1 standard party */
function standard(R, tier, o) {
  return build(R, Object.assign({ tier, members: ['hero', 'brigitta', 'marta', 'sylvain'], heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' },
    rows: { hero: 'front', brigitta: 'front', marta: 'middle', sylvain: 'middle' }, gear: 'shop' }, o || {}));
}

/** §5.4.3: the 12 combinations every simulator must try */
const COMBOS = [
  { no: 1, name: '標準', heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, members: ['brigitta', 'marta', 'sylvain'] },
  { no: 2, name: '全員術師', heroType: 'mage', favor: { kind: 'element', id: 'fire' }, members: ['teo', 'ilse', 'morga'] },
  { no: 3, name: '回復なしの前衛', heroType: 'warrior', favor: { kind: 'weapon', id: 'greatsword' }, members: ['hagen', 'rouga', 'titta'] },
  { no: 4, name: '全員中列', heroType: 'ranger', favor: { kind: 'weapon', id: 'bow' }, members: ['brigitta', 'sylvain', 'zafira'] },
  { no: 5, name: '重装の壁', heroType: 'warrior', favor: { kind: 'weapon', id: 'club' }, members: ['selma', 'dokka', 'bartolo'] },
  { no: 6, name: '回復だらけ', heroType: 'mage', favor: { kind: 'element', id: 'light' }, members: ['marta', 'noela', 'basil'] },
  { no: 7, name: '万能型', heroType: 'wanderer', favor: { kind: 'weapon', id: 'spear' }, members: ['viola', 'ferno', 'belladonna'] },
  { no: 8, name: '年長組', heroType: 'spellblade', favor: { kind: 'element', id: 'earth' }, members: ['boden', 'bartolo', 'morga'] },
  { no: 9, name: '速さ', heroType: 'ranger', favor: { kind: 'weapon', id: 'katana' }, members: ['rouga', 'titta', 'zafira'] },
  { no: 10, name: '斬るだけ', heroType: 'warrior', favor: { kind: 'weapon', id: 'axe' }, members: ['hagen', 'viola', 'shigure'] },
  { no: 11, name: '属性が1つだけ', heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, members: ['selma', 'basil', 'bartolo'] },
  { no: 12, name: 'レア狙い', heroType: 'wanderer', favor: { kind: 'element', id: 'dark' }, members: ['ferno', 'noela', 'boden'] },
];
/** §4.17.3 B2: 6 representative hero type × favour */
const HERO_VARIANTS = [
  { heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' } },
  { heroType: 'warrior', favor: { kind: 'weapon', id: 'axe' } },
  { heroType: 'ranger', favor: { kind: 'weapon', id: 'bow' } },
  { heroType: 'mage', favor: { kind: 'element', id: 'fire' } },
  { heroType: 'spellblade', favor: { kind: 'element', id: 'wind' } },
  { heroType: 'wanderer', favor: { kind: 'weapon', id: 'spear' } },
];
const COMPANIONS = ['selma', 'hagen', 'dokka', 'basil', 'bartolo', 'viola', 'shigure', 'rouga', 'titta', 'brigitta', 'sylvain', 'zafira', 'ferno', 'belladonna', 'boden', 'teo', 'ilse', 'morga', 'marta', 'noela'];

/** all C(n,3) triples of the companion list (DB order when present) */
function triples(R) {
  const ids = Object.keys((R && R.DB.companions) || {}).length ? Object.keys(R.DB.companions) : COMPANIONS;
  const out = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) for (let c = b + 1; c < ids.length; c++) out.push([ids[a], ids[b], ids[c]]);
  return out;
}

module.exports = {
  build, levelAt, profAt, profRank, withGame, runBattle, afterBattle, standard, triples, K, aptOf, naturalBuild, weaponTypes,
  COMBOS, HERO_VARIANTS, COMPANIONS, WTYPES, ELEMENTS, STATS, SLOTS, RB, APTN,
};
