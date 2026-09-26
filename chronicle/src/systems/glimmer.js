// R.Glimmer — 閃き（技と術）。式の正は DESIGN §4.9、術の部分の手順は §7.10、API の形は §3.3.7。
//
//   roll(c, ctx)        → {id, kind:'tech'|'spell'} | null   c を変えない。1 回の行動につき 1 回だけ呼ぶ
//   candidates(c, ctx)  → [{id, w, p}]                       候補・重み・確率（デバッグ・シミュレーター・オート用）
//   chance(c, id, ctx)  → p                                   その候補の 1 回の判定の確率（上限 K.GLIM.cap）
//   learn(c, id, opts?) → bool                                覚える（opts.record === false なら c だけを変える）
//   classOf(a)          → 'tech'|'single'|'comboA'|'comboB'|'triple'|null
//
//   ctx = { kind:'tech'|'spell', wtype?, elements?:[…], used: actionId|'attack', stone?:bool,
//           rankB, ef, tier, row:'front'|'middle', silenced:bool, force?:bool, rng?, sealTech?, fallbackWtype? }
//     tier = R.Tier.effective()（EXPECT の添え字。戦闘のティア Tb ではない）。rankB・ef は戦闘の開始時に決めた値。
//     force = glimmerForce（p = 1。候補が無いとき・防御・道具のときは武器1の系統の一番低い覚えていない技）。
//
// 補助: params(units, Tb) → {rankB, ef}（§4.9.2 の敵の閃きレベル）、monRank(u, Tb)、pairsKnown(c, els)、
//       spellId(elements, step|'a'|'b')、sideOf(actionOrTarget)、banner(a)（閃きの札の見出しと色。§11.5.7）、reindex()。
//
// 定数はすべて R.Rules.K（§4.18.1）から読む。rules がまだ入れていない項目だけ、下の SPEC（§4.9 の値の写し）で補う。
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const FOE_TARGETS = { enemy: 1, enemies: 1, group: 1, random: 1 };

  // §4.9 / §4.18.1 の値の写し。R.Rules.K に同じ項目があればそちらを使う（並列の作業中に rules が未完成でも動くように）。
  const SPEC = {
    GLIM: {
      base: { tech: 0.012, secret: 0.006, single: 0.015, comboA: 0.012, comboB: 0.010, triple: 0.008 },
      techLv: [1, 10], spellLv: [1, 8], cap: 0.35,
      apt: { S: 2, A: 1.5, B: 1, C: 0.6, D: 0.3 },
      expect: [2, 4, 6, 8, 10, 12, 14, 16, 17, 19],
      fkSlope: 0.4, fkFree: 2, fkMax: 4, stoneEntry: 10,
      ef: { normal: 1, golden: 1.5, rare: 2, boss: 2.5 },
      margin: 0.1, marginMax: 5, wFrom: 3, wLowest: 2,
      gf: { base: 100, div: 150, min: 0.7, max: 2 },            // GF = clamp((base + 能力値)/div, min, max)（§4.9.4）
      rank: { boss: 2, rare: 2, golden: 1, metal: 1 },           // rank = Tb + rankBase + 旗の分 + 魔物の rankAdd（§4.9.2）
      rankBase: 1, secretLv: 10,
      // 規則の §4.9.4 の式に足す 2 つの補正（DESIGN §4.9.4 の例 1・例 2 の値は変えない）:
      //   tier0 … ティア 0 の雑魚戦（ボス戦でない）の技の判定で、覚えている数が tier0Known 以下の人は ×1.7。
      //            序章 約 35 戦で 4 回以上（§4.9.5。A18b.0）。覚えるほど外れ、術・魔石には掛けないので、G5・X2 と §4.9.6 の ×10 は変えない
      //   bossLate … ボス戦（EF ≥ ef.boss）の判定 ×min(2, 1 + 0.4 × max(0, T − 4))。T5〜T7 のボス戦でも誰かが閃く 50% 以上（§9.13.2 X5。A12.5）
      tier0: 1.7, tier0Known: 3, bossLate: { from: 4, slope: 0.4, max: 2 },
    },
    PROF_PTS: [0, 5, 15, 30, 55, 90, 135, 190, 260, 350, 460],
    MODCAP: { glim: 40, glimMin: -100 },
  };
  let warned = false, kcache = null, kref = null, gref = null;
  function K() {
    const k = (R.Rules && R.Rules.K) || null;
    if (kcache && kref === k && gref === (k && k.GLIM)) return kcache;
    if (!k || !k.GLIM) {
      if (!warned) { warned = true; R.warn('Glimmer: R.Rules.K.GLIM が無いので §4.9 の既定値を使う'); }
    }
    kref = k; gref = k && k.GLIM;
    const g = Object.assign({}, SPEC.GLIM, (k && k.GLIM) || {});
    for (const key of ['base', 'apt', 'ef', 'gf', 'rank', 'bossLate']) g[key] = Object.assign({}, SPEC.GLIM[key], (k && k.GLIM && k.GLIM[key]) || {});
    kcache = {
      GLIM: g,
      PROF_PTS: (k && k.PROF_PTS) || SPEC.PROF_PTS,
      MODCAP: Object.assign({}, SPEC.MODCAP, (k && k.MODCAP) || {}),
    };
    return kcache;
  }

  // ------------------------------------------------------------ 索引（系統ごとの技・術の一覧。データの並び順）
  let index = null;
  function buildIndex() {
    const techs = {}, spells = [];
    let n = 0;
    for (const id in DB.actions) {
      n++;
      const a = DB.actions[id];
      if (!a || !a.glim) continue;
      if (a.kind === 'tech' && a.wtype) (techs[a.wtype] = techs[a.wtype] || []).push(id);
      else if (a.kind === 'spell' && Array.isArray(a.elements) && a.elements.length) spells.push(id);
    }
    index = { n, techs, spells };
    return index;
  }
  function idx() {
    if (!index || index.n !== Object.keys(DB.actions).length) buildIndex();
    return index;
  }
  R.onData(() => { index = null; });

  // ------------------------------------------------------------ rules への窓口（無いときは §4 の式で補う）
  function profRank(pts) {
    if (R.Rules && typeof R.Rules.profRank === 'function') return R.Rules.profRank(pts || 0);
    const P = K().PROF_PTS;
    let r = 0;
    for (let i = 0; i < P.length; i++) if ((pts || 0) >= P[i]) r = i;
    return r;
  }
  function charDef(c) {
    if (!c) return null;
    if (c.id === 'hero' || c.heroType) return (DB.heroTypes && DB.heroTypes[c.heroType]) || null;
    return (DB.companions && DB.companions[c.id]) || null;
  }
  function aptOf(c) {
    if (R.Rules && typeof R.Rules.aptitude === 'function') {
      try { const a = R.Rules.aptitude(c); if (a && a.w && a.e) return a; } catch (e) { /* 補う */ }
    }
    // 補い: データの文字から（主人公は得意分野を S、術師は組の属性を A。§5.0 の 0.2）
    const table = K().GLIM.apt;
    const d = charDef(c);
    const w = {}, e = {};
    const src = (d && d.apt) || { w: {}, e: {} };
    for (const k in src.w || {}) w[k] = table[src.w[k]] != null ? table[src.w[k]] : 1;
    for (const k in src.e || {}) e[k] = table[src.e[k]] != null ? table[src.e[k]] : 1;
    if (c && c.favor && c.favor.id) {
      if (c.favor.kind === 'weapon') w[c.favor.id] = table.S;
      else if (c.favor.kind === 'element') {
        e[c.favor.id] = table.S;
        const pair = DB.starterKit && DB.starterKit.pair && DB.starterKit.pair[c.favor.id];
        if (d && d.pairElement && pair) e[pair] = Math.max(e[pair] || 0, table.A);
      }
    }
    return { w, e };
  }
  function statOf(c, key) {
    if (R.Rules && typeof R.Rules.stats === 'function') {
      try { const s = R.Rules.stats(c); if (s && typeof s[key] === 'number') return s[key]; } catch (e) { /* 補う */ }
    }
    const d = charDef(c);
    return (d && d.stats && d.stats[key]) || 0;
  }
  function modsOf(c) {
    if (R.Rules && typeof R.Rules.mods === 'function') {
      try { return R.Rules.mods(c) || {}; } catch (e) { /* 補う */ }
    }
    return {};
  }
  function glimMod(m, key, M) {
    const g = m && m.glimPct;
    const v = g && typeof g[key] === 'number' ? g[key] : 0;
    return U.clamp(v, M.glimMin, M.glim);
  }
  const known = (c) => ((c && c.techs) ? c.techs.length : 0) + ((c && c.spells) ? c.spells.length : 0);
  const has = (arr, id) => !!arr && arr.indexOf(id) >= 0;

  function classOf(a) {
    if (!a) return null;
    if (a.kind === 'tech') return 'tech';
    if (a.kind === 'spell') {
      if (a.cls) return a.cls;
      const n = (a.elements || []).length;
      return n === 3 ? 'triple' : n === 2 ? ((a.glim && a.glim.lv >= 6) ? 'comboB' : 'comboA') : 'single';
    }
    return null;
  }

  /** 3 属性の術の条件: その 3 属性の 3 つの組のうち、合成術（A か B）を覚えている組の数（§7.1.4-5） */
  function pairsKnown(c, els) {
    if (!c || !c.spells || !els || els.length < 3) return 0;
    const want = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) want.push(orderEls([els[i], els[j]]).join('_'));
    const got = {};
    for (const id of c.spells) {
      const a = DB.actions[id];
      if (a && a.kind === 'spell' && a.elements && a.elements.length === 2) got[a.elements.join('_')] = true;
    }
    let n = 0;
    for (const k of want) if (got[k]) n++;
    return n;
  }
  function orderEls(els) { return els.slice().sort((a, b) => ELEMENTS.indexOf(a) - ELEMENTS.indexOf(b)); }

  // ------------------------------------------------------------ 候補
  function techCands(c, ctx) {
    const list = idx().techs[ctx.wtype] || [];
    const rankB = ctx.rankB || 0;
    const pr = profRank(c.wprof ? c.wprof[ctx.wtype] : 0);
    const out = [];
    if (ctx.sealTech) return out;
    for (const id of list) {
      if (has(c.techs, id)) continue;
      const a = DB.actions[id];
      const lv = a.glim.lv;
      if (lv > rankB || pr < lv - 1) continue;
      if (ctx.row === 'middle' && !a.reach) continue;   // §6.4.4-1
      if (ctx.silenced && a.magic) continue;             // §6.4.4-2
      out.push({ id, a, lv });
    }
    return out;
  }
  function spellCands(c, ctx) {
    const out = [];
    const els = ctx.elements || [];
    if (!els.length || ctx.silenced) return out;         // 沈黙中は術（magic:true）を外す
    const m = modsOf(c);
    if (m && m.noSpell) return out;                      // §8.3.7: 術を使えない人は術を閃かない
    const rankB = ctx.rankB || 0;
    const pr = {};
    for (const e of ELEMENTS) pr[e] = profRank(c.eprof ? c.eprof[e] : 0);
    for (const id of idx().spells) {
      if (has(c.spells, id)) continue;
      const a = DB.actions[id];
      if (!a.elements.some((e) => els.indexOf(e) >= 0)) continue;       // 1. 使った属性を含む
      const lv = a.glim.lv;
      if (lv > rankB) continue;                                         // 3. 格
      if (a.elements.some((e) => (pr[e] || 0) < a.glim.prof)) continue; // 4. すべての属性の熟練度
      if (a.elements.length === 3 && pairsKnown(c, a.elements) < 2) continue; // 5. 組の合成術 2 組
      out.push({ id, a, lv });
    }
    return out;
  }
  function rawCands(c, ctx) {
    if (!c || !ctx) return [];
    if (ctx.kind === 'tech') return ctx.wtype ? techCands(c, ctx) : [];
    if (ctx.kind === 'spell') return spellCands(c, ctx);
    return [];
  }
  function weigh(cands, ctx) {
    if (!cands.length) return cands;
    const G = K().GLIM;
    let min = Infinity;
    for (const x of cands) if (x.lv < min) min = x.lv;
    for (const x of cands) {
      let w = 1;
      if (x.a.kind === 'tech' && ctx.used && x.a.glim.from && x.a.glim.from.indexOf(ctx.used) >= 0) w *= G.wFrom;
      if (x.lv === min) w *= G.wLowest;
      x.w = w;
    }
    return cands;
  }

  // ------------------------------------------------------------ 確率（§4.9.4・§7.10-3）
  function chance(c, id, ctx) {
    const a = DB.actions[id];
    if (!a || !a.glim || !c) return 0;
    ctx = ctx || {};
    if (ctx.force) return 1;
    const k = K(), G = k.GLIM, cap = k.MODCAP;
    const apt = aptOf(c);
    const m = modsOf(c);
    let base, aptM, stat, gp;
    if (a.kind === 'tech') {
      base = a.glim.lv >= G.secretLv ? G.base.secret : G.base.tech;
      aptM = apt.w[a.wtype] != null ? apt.w[a.wtype] : 1;
      stat = statOf(c, 'dex');
      gp = glimMod(m, a.wtype, cap) + glimMod(m, 'tech', cap);
    } else {
      base = G.base[classOf(a)] != null ? G.base[classOf(a)] : G.base.single;
      let s = 0;
      for (const e of a.elements) s += apt.e[e] != null ? apt.e[e] : 1;
      aptM = s / a.elements.length;
      stat = statOf(c, 'int');
      let best = -Infinity;
      for (const e of a.elements) best = Math.max(best, glimMod(m, e, cap));  // 術の属性のうち一番大きいもの
      gp = (best === -Infinity ? 0 : best) + glimMod(m, 'spell', cap);
    }
    const GF = U.clamp((G.gf.base + stat) / G.gf.div, G.gf.min, G.gf.max);
    const T = U.clamp(ctx.tier != null ? ctx.tier : tierNow(), 0, G.expect.length - 1);
    const FK = U.clamp(1 + G.fkSlope * (G.expect[T] - known(c) - G.fkFree), 1, G.fkMax);
    const EF = ctx.ef || 1;
    const MARGIN = 1 + G.margin * U.clamp((ctx.rankB || 0) - a.glim.lv, 0, G.marginMax);
    const boss = EF >= G.ef.boss, BL = G.bossLate || {};
    const T0 = (!boss && a.kind === 'tech' && T === 0 && G.tier0 && known(c) <= (G.tier0Known != null ? G.tier0Known : Infinity) ? G.tier0 : 1) * (boss && BL.slope ? Math.min(BL.max || Infinity, 1 + BL.slope * Math.max(0, T - (BL.from || 0))) : 1);
    let p = base * aptM * GF * FK * EF * MARGIN * T0 * Math.max(0, 1 + gp / 100);
    if (ctx.stone && a.kind === 'spell' && ctx.elements && ctx.elements[0] && !knowsElement(c, ctx.elements[0])) p *= G.stoneEntry;
    return Math.min(G.cap, p);
  }
  function knowsElement(c, el) {
    for (const id of c.spells || []) {
      const a = DB.actions[id];
      if (a && a.elements && a.elements.indexOf(el) >= 0) return true;
    }
    return false;
  }
  function tierNow() {
    try { if (R.Tier && R.Tier.effective) return R.Tier.effective(); } catch (e) { /* ゲームが無い */ }
    const g = R.Game;
    return g ? (g.gameClear ? 9 : g.tier || 0) : 0;
  }

  function candidates(c, ctx) {
    const cands = weigh(rawCands(c, ctx), ctx || {});
    return cands.map((x) => ({ id: x.id, w: x.w, p: chance(c, x.id, ctx) }));
  }

  // glimmerForce で候補が無いとき（防御・道具を含む）: 武器1の系統の、覚えていない技のうち格が一番低いもの（§3.3.7）
  function forcedFallback(c, ctx) {
    let wtype = ctx.fallbackWtype || null;
    if (!wtype) {
      try {
        const s = R.Rules && R.Rules.stats ? R.Rules.stats(c) : null;
        const w1 = s && s.w && s.w.weapon1;
        if (w1 && w1.wtype) wtype = w1.wtype;
      } catch (e) { /* 補う */ }
    }
    if (!wtype) {
      const it = c.equip && c.equip.weapon1 && DB.items[c.equip.weapon1];
      wtype = (it && it.wtype) || 'fist';
    }
    const list = (idx().techs[wtype] || []).filter((id) => !has(c.techs, id));
    if (!list.length) return null;
    const ok = (id) => { const a = DB.actions[id]; return !(ctx.row === 'middle' && !a.reach) && !(ctx.silenced && a.magic); };
    const pool = list.some(ok) ? list.filter(ok) : list;
    let best = null;
    for (const id of pool) if (!best || DB.actions[id].glim.lv < DB.actions[best].glim.lv) best = id;
    return best;
  }

  function roll(c, ctx) {
    if (!c || !ctx) return null;
    const rng = typeof ctx.rng === 'function' ? ctx.rng : U.r;
    const cands = weigh(rawCands(c, ctx), ctx);
    if (!cands.length) {
      if (!ctx.force) return null;
      const id = forcedFallback(c, ctx);
      return id ? { id, kind: 'tech' } : null;
    }
    let total = 0;
    for (const x of cands) total += x.w;
    let r = rng() * total, pick = cands[cands.length - 1];
    for (const x of cands) { r -= x.w; if (r < 0) { pick = x; break; } }
    const p = ctx.force ? 1 : chance(c, pick.id, ctx);
    if (rng() < p) return { id: pick.id, kind: pick.a.kind };
    return null;
  }

  function learn(c, id, opts) {
    const a = DB.actions[id];
    if (!c || !a || (a.kind !== 'tech' && a.kind !== 'spell')) { R.warn('Glimmer.learn: 技・術でない id', id); return false; }
    const key = a.kind === 'tech' ? 'techs' : 'spells';
    c[key] = c[key] || [];
    if (c[key].indexOf(id) >= 0) return false;
    c[key].push(id);
    c.counts = c.counts || { battles: 0, kills: 0, glimmers: 0 };
    c.counts.glimmers = (c.counts.glimmers || 0) + 1;
    if (opts && opts.record === false) return true;
    if (R.State && typeof R.State.noteLearned === 'function') R.State.noteLearned(c.id, id);
    else if (R.Game && R.Game.book) {
      const b = R.Game.book[a.kind] = R.Game.book[a.kind] || {};
      const who = b[id] = b[id] || [];
      if (who.indexOf(c.id) < 0) who.push(c.id);
    }
    if (R.Game) {
      R.Game.records = R.Game.records || {};
      R.Game.records.glimmers = (R.Game.records.glimmers || 0) + 1;
    }
    R.emit('glimmer', c, id, a.kind);
    return true;
  }

  // ------------------------------------------------------------ 補助
  /** 1 体の閃きレベル（§4.9.2）。u = {flags:[…]|def, golden, rankAdd} か魔物の定義 */
  function monRank(u, Tb) {
    const G = K().GLIM, add = G.rank;
    const def = (u && u.def) || u || {};
    const flags = flagsOf(u);
    let r = (Tb || 0) + G.rankBase;
    if (flags.indexOf('boss') >= 0) r += add.boss;
    else if (flags.indexOf('rare') >= 0) r += add.rare;
    if (u.golden || flags.indexOf('golden') >= 0) r += add.golden;
    if (flags.indexOf('metal') >= 0) r += add.metal;
    r += def.rankAdd || u.rankAdd || 0;
    return r;
  }
  function flagsOf(u) {
    if (!u) return [];
    const a = (u.def && u.def.flags) || [], b = u.flags || [];
    return a === b ? a : a.concat(b);
  }
  /** 戦闘の閃きレベル rankB と敵の種類 EF（最初にいた魔物から。§4.9.2） */
  function params(units, Tb) {
    const G = K().GLIM;
    let rankB = (Tb || 0) + G.rankBase, ef = G.ef.normal;
    for (const u of units || []) {
      if (!u) continue;
      rankB = Math.max(rankB, monRank(u, Tb));
      const flags = flagsOf(u);
      const e = flags.indexOf('boss') >= 0 ? G.ef.boss : flags.indexOf('rare') >= 0 ? G.ef.rare
        : (u.golden || flags.indexOf('golden') >= 0) ? G.ef.golden : G.ef.normal;
      ef = Math.max(ef, e);
    }
    return { rankB, ef };
  }
  /** 属性の組から術の id を作る（§7.0 の 0.2）。単属性は段 1〜5、2 属性は 'a'|'b'、3 属性は省略 */
  function spellId(elements, which) {
    const els = orderEls(elements || []);
    if (els.length === 1) return 's_' + els[0] + '_' + which;
    if (els.length === 2) return 's_' + els.join('_') + '_' + String(which || 'a').toLowerCase();
    return 's_' + els.join('_');
  }
  /** 行動（か target の文字列）の向き: 'foe' | 'ally'（§4.9.2-5 の「同じ向き」） */
  function sideOf(a) {
    const t = typeof a === 'string' ? a : a && a.target;
    return FOE_TARGETS[t] ? 'foe' : 'ally';
  }
  /** 閃きの札の見出しと名前の色（§11.5.7） */
  function banner(a) {
    const C = (R.Gfx && R.Gfx.C) || {};
    if (!a) return { title: '閃き！', color: '#fff8d0' };
    if (a.kind === 'spell') {
      const el = orderEls(a.elements || [])[0];
      const color = (el && DB.elements[el] && DB.elements[el].color) || '#fff8d0';
      return { title: (a.elements || []).length > 1 ? '合成術' : '閃き！', color };
    }
    const lv = a.glim ? a.glim.lv : 1;
    if (lv >= 10) return { title: '極意', color: C.super || '#ff88d0' };
    if (lv === 9) return { title: '奥義', color: C.gold || '#f8d838' };
    return { title: '閃き！', color: '#fff8d0' };
  }

  R.Glimmer = {
    ELEMENTS, SPEC,
    classOf, candidates, chance, roll, learn,
    monRank, params, pairsKnown, spellId, sideOf, banner,
    profRank, aptitude: aptOf,
    reindex() { index = null; kcache = null; return buildIndex(); },
  };
})(window.RPG);
