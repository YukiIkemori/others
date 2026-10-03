// R.Glimmer（RULES）: 閃き（技と術）。式は DESIGN §4.9、術の手順は §7.10。今の木の src/systems/glimmer.js から移して直した:
//   - GF = clamp(abilMul(S, 0.04), 0.7, 1.8)（STATS_REWORK §2.2。S = 技は器用さ、術は知力）
//   - 技の候補は「今の武器の系統」だけ（§8.6。武器枠 1 つ）、熟練度 1〜100 の関門は K.TECH_PROF
//   - 定数はすべて R.Rules.K.GLIM
//
//   roll(c, action, ctx) → {kind:'tech'|'spell', id} | null     契約（V2_PLAN §2.5.12）。action = 使った行動の id か 'attack'（ctx.used になる）
//   roll(c, ctx)         → 同じ（今の木の形。ctx.used を使う）
//   candidates(c, ctx) → [{id, w, p}]   chance(c, id, ctx) → p   learn(c, id) → bool   classOf(a)   profMargin(c, a) → 熟練度の余り（術）
//   params(units, Tb) → {rankB, ef}     monRank(u, Tb)   pairsKnown(c, els)   spellId(els, step)   sideOf(a)   banner(a)
//   派生技: countUse(c, id) → n   deriveRoll(c, usedTechId, {rankB, rng, force}) → {kind:'tech', id, from} | null   learnDerived(c, to, from)
//           deriveChance(c, from, to, {rankB}, n?)   deriveOf(id) → [{to, lv, tier}]   deriveSources(to)   tierOf(id)   isDerived(id)
//           derivedFrom(c, id)   useCount(c, id)   sanitize(c)（読み込み）
//   魔石: firstSpell(el) → id   stoneOf(item) → {element, spell}   stoneBlock(c, item) → わけ | null   useStone(c, item) → {ok, id, reason, line}
//
//   ctx = { kind:'tech'|'spell', wtype?(既定は今の武器), elements?, used: actionId|'attack', rankB, ef, tier?, row:'front'|'back',
//           silenced?, force?(glimmerForce), rng?:()=>[0,1) }
//   c は R.Rules の CharState（BATTLE の unit なら unit.c か unit.char を渡す。unit に techs・spells・equip があればそのままでもよい）
(function (R) {
  'use strict';
  R.Stubs.claim('Glimmer');
  const DB = R.DB;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const FOE_TARGETS = { enemy: 1, enemies: 1, group: 1, random: 1 };
  const K = () => R.Rules.K;
  const act = (id) => (DB.techs && DB.techs[id]) || (DB.spells && DB.spells[id]) || null;

  // ------------------------------------------------------------ 索引（系統ごとの技・術。データの順）
  let index = null, indexN = -1;
  function idx() {
    const n = Object.keys(DB.techs || {}).length + Object.keys(DB.spells || {}).length;
    if (index && indexN === n) return index;
    const techs = {}, spells = [];
    for (const id of Object.keys(DB.techs || {})) { const a = DB.techs[id]; if (a && a.glim && a.wtype) (techs[a.wtype] = techs[a.wtype] || []).push(id); }
    for (const id of Object.keys(DB.spells || {})) { const a = DB.spells[id]; if (a && a.glim && Array.isArray(a.elements) && a.elements.length) spells.push(id); }
    for (const w of Object.keys(techs)) techs[w].sort((x, y) => (DB.techs[x].rank || 0) - (DB.techs[y].rank || 0));
    index = { techs, spells }; indexN = n;
    return index;
  }
  const charOf = (u) => (u && (u.c || u.char)) || u;
  const known = (c) => ((c && c.techs) ? c.techs.length : 0) + ((c && c.spells) ? c.spells.length : 0);
  const has = (arr, id) => !!arr && arr.indexOf(id) >= 0;
  const isBack = (row) => row === 'back' || row === 'middle';
  const glimMod = (m, key) => { const g = m && m.glimPct; const v = g && typeof g[key] === 'number' ? g[key] : 0; return clamp(v, K().MODCAP.glimMin, K().MODCAP.glim); };
  const tierNow = () => { try { if (R.Tier && R.Tier.effective) return R.Tier.effective() | 0; } catch (e) { /* 無い */ } return (R.Game && R.Game.tier) | 0; };

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
  function orderEls(els) { return els.slice().sort((a, b) => ELEMENTS.indexOf(a) - ELEMENTS.indexOf(b)); }
  /** 3 属性の術の条件: その 3 属性の組のうち、合成術を覚えている組の数（§7.1.4-5） */
  function pairsKnown(c, els) {
    if (!c || !c.spells || !els || els.length < 3) return 0;
    const want = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) want.push(orderEls([els[i], els[j]]).join('_'));
    const got = {};
    for (const id of c.spells) { const a = act(id); if (a && a.kind === 'spell' && a.elements && a.elements.length === 2) got[orderEls(a.elements).join('_')] = true; }
    let n = 0;
    for (const k of want) if (got[k]) n++;
    return n;
  }
  function wtypeOf(c, ctx) {
    if (ctx.wtype) return ctx.wtype;
    const w = R.Rules.weaponType(c);
    return w && w !== R.Rules.UNARMED ? w : null;
  }

  // ------------------------------------------------------------ 候補
  function techCands(c, ctx) {
    const out = [];
    const wtype = wtypeOf(c, ctx);
    if (!wtype || ctx.sealTech) return out;
    const it = R.Rules.itemOf(c.equip && c.equip.weapon1);
    if (it && it.sealTech) return out;
    const rankB = ctx.rankB || 0;
    const pr = R.Rules.profRank(c.wprof ? c.wprof[wtype] : 0);
    const TP = K().TECH_PROF;
    for (const id of idx().techs[wtype] || []) {
      if (has(c.techs, id)) continue;
      const a = DB.techs[id], lv = a.glim.lv;
      if (lv > rankB || pr < (TP[lv] != null ? TP[lv] : TP[TP.length - 1])) continue;
      if (isBack(ctx.row) && !a.reach) continue;
      if (ctx.silenced && a.magic) continue;
      out.push({ id, a, lv });
    }
    return out;
  }
  // 熟練度の余り（持ち主 2026-10-03「熟練度高くなれば、熟練度低いやつほど覚える確率上がってもいいと思うよ」）:
  //   余り PM = 術の属性のうち一番低い熟練度の段階 − glim.prof（2・3 属性は低いほう。0 未満は 0）。術だけ（技は変えない）
  //   確率 ×min(pm.max[格], 1 + pm.slope[格] × PM)、候補の関門 lv ≤ rankB + min(pm.gateMax, floor(PM / pm.gateStep))（弱い相手でも、十分に低い術は出る）
  function profMargin(c, a) {
    if (!c || !a || a.kind !== 'spell' || !a.glim || !Array.isArray(a.elements) || !a.elements.length) return 0;
    let lo = Infinity;
    for (const e of a.elements) lo = Math.min(lo, R.Rules.profRank(c.eprof ? c.eprof[e] : 0));
    return Math.max(0, lo - (a.glim.prof || 0));
  }
  function pmGate(pm) { const P = K().GLIM.pm; return P ? Math.min(P.gateMax, Math.floor(pm / P.gateStep)) : 0; }
  function pmMul(a, pm) {
    const P = K().GLIM.pm, cls = classOf(a);
    if (!P || !pm) return 1;
    const sl = P.slope[cls] != null ? P.slope[cls] : P.slope.single, mx = P.max[cls] != null ? P.max[cls] : P.max.single;
    return Math.min(mx, 1 + sl * pm);
  }
  function spellCands(c, ctx) {
    const out = [];
    const els = ctx.elements || [];
    if (!els.length || ctx.silenced) return out;
    if (R.Rules.mods(c).noSpell) return out;
    const rankB = ctx.rankB || 0;
    const pr = {};
    for (const e of ELEMENTS) pr[e] = R.Rules.profRank(c.eprof ? c.eprof[e] : 0);
    for (const id of idx().spells) {
      if (has(c.spells, id)) continue;
      const a = DB.spells[id];
      if (!a.elements.some((e) => els.indexOf(e) >= 0)) continue;
      const lv = a.glim.lv;
      if (a.elements.some((e) => (pr[e] || 0) < a.glim.prof)) continue;
      if (lv > rankB + pmGate(profMargin(c, a))) continue;
      if (a.elements.length === 3 && pairsKnown(c, a.elements) < 2) continue;
      out.push({ id, a, lv });
    }
    return out;
  }
  function rawCands(c, ctx) {
    if (!c || !ctx) return [];
    if (ctx.kind === 'tech') return techCands(c, ctx);
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
    c = charOf(c);
    const a = act(id);
    if (!a || !a.glim || !c) return 0;
    ctx = ctx || {};
    if (ctx.force) return 1;
    const G = K().GLIM;
    const apt = R.Rules.aptitude(c);
    const m = R.Rules.mods(c);
    const fs = R.Rules.finalStats(c);
    let base, aptM, stat, gp;
    if (a.kind === 'tech') {
      base = a.glim.lv >= G.secretLv ? G.base.secret : G.base.tech;
      aptM = apt.w[a.wtype] != null ? apt.w[a.wtype] : 1;
      stat = fs.dex;
      gp = glimMod(m, a.wtype) + glimMod(m, 'tech');
    } else {
      base = G.base[classOf(a)] != null ? G.base[classOf(a)] : G.base.single;
      let s = 0;
      for (const e of a.elements) s += apt.e[e] != null ? apt.e[e] : 1;
      aptM = s / a.elements.length;
      stat = fs.int;
      let best = -Infinity;
      for (const e of a.elements) best = Math.max(best, glimMod(m, e));
      gp = (best === -Infinity ? 0 : best) + glimMod(m, 'spell');
    }
    const GF = R.Rules.gfOf(stat);
    const T = clamp(ctx.tier != null ? ctx.tier : tierNow(), 0, G.expect.length - 1);
    const FK = clamp(1 + G.fkSlope * (G.expect[T] - known(c) - G.fkFree), 1, G.fkMax);
    const EF = ctx.ef || 1;
    const MARGIN = 1 + G.margin * clamp((ctx.rankB || 0) - a.glim.lv, 0, G.marginMax);
    const boss = EF >= G.ef.boss, BL = G.bossLate || {};
    const T0 = (!boss && a.kind === 'tech' && T === 0 && G.tier0 && known(c) <= (G.tier0Known != null ? G.tier0Known : Infinity) ? G.tier0 : 1) *
      (boss && BL.slope ? Math.min(BL.max || Infinity, 1 + BL.slope * Math.max(0, T - (BL.from || 0))) : 1);
    const PM = pmMul(a, profMargin(c, a));   // 熟練度の余り（術だけ。技は 1）
    let p = base * aptM * GF * FK * EF * MARGIN * PM * T0 * Math.max(0, 1 + gp / 100);
    p = Math.min(G.cap, p);
    return R.Tester ? R.Tester.glim(p) : p;   // テスト用メニュー（src/tester/）: 閃き ×10（1 まで）。無い・無効なら同じ値
  }
  function candidates(c, ctx) {
    c = charOf(c);
    const cands = weigh(rawCands(c, ctx), ctx || {});
    return cands.map((x) => ({ id: x.id, w: x.w, p: chance(c, x.id, ctx) }));
  }
  /** glimmerForce で候補が無いとき: 今の武器の系統の、覚えていない技のうち格が一番低い物 */
  function forcedFallback(c, ctx) {
    const wtype = ctx.fallbackWtype || wtypeOf(c, Object.assign({}, ctx, { wtype: null }));
    if (!wtype) return null;
    const list = (idx().techs[wtype] || []).filter((id) => !has(c.techs, id));
    if (!list.length) return null;
    const ok = (id) => { const a = DB.techs[id]; return !(isBack(ctx.row) && !a.reach) && !(ctx.silenced && a.magic); };
    const pool = list.some(ok) ? list.filter(ok) : list;
    let best = null;
    for (const id of pool) if (!best || DB.techs[id].glim.lv < DB.techs[best].glim.lv) best = id;
    return best;
  }
  /** 閃きの判定（1 回の行動につき 1 回だけ）。c は変えない（覚えるのは learn） */
  function roll(u, action, ctx) {
    if (action && typeof action === 'object' && !Array.isArray(action) && ctx === undefined) { ctx = action; action = null; }
    const c = charOf(u);
    if (!c || !ctx) return null;
    if (action != null) {
      const a = typeof action === 'string' ? act(action) : action;
      ctx = Object.assign({}, ctx, { used: ctx.used || (typeof action === 'string' ? action : 'attack') });
      if (!ctx.kind && a) ctx.kind = a.kind === 'spell' ? 'spell' : 'tech';
      if (!ctx.kind && action === 'attack') ctx.kind = 'tech';
      if (ctx.kind === 'spell' && !ctx.elements && a && a.elements) ctx.elements = a.elements;
    }
    const rng = typeof ctx.rng === 'function' ? ctx.rng : ctx.rng && ctx.rng.next ? () => ctx.rng.next() : Math.random;
    const cands = weigh(rawCands(c, ctx), ctx);
    if (!cands.length) {
      if (!ctx.force) return null;
      const id = forcedFallback(c, ctx);
      return id ? { kind: 'tech', id } : null;
    }
    let total = 0;
    for (const x of cands) total += x.w;
    let r = rng() * total, pick = cands[cands.length - 1];
    for (const x of cands) { r -= x.w; if (r < 0) { pick = x; break; } }
    const p = ctx.force ? 1 : chance(c, pick.id, ctx);
    if (rng() < p) return { kind: pick.a.kind, id: pick.id };
    return null;
  }
  /** 覚える（c.techs・c.spells に足す。R.emit('glimmer', {c, id, kind})）→ 新しく覚えたら true */
  function learn(u, id, opts) {
    const c = charOf(u);
    const a = act(id);
    if (!c || !a || (a.kind !== 'tech' && a.kind !== 'spell')) { R.warn('Glimmer.learn: 技・術でない id', id); return false; }
    const key = a.kind === 'tech' ? 'techs' : 'spells';
    c[key] = c[key] || [];
    if (c[key].indexOf(id) >= 0) return false;
    c[key].push(id);
    if (!(opts && opts.quiet)) R.emit('glimmer', { c: c.id, id, kind: a.kind });
    return true;
  }

  // ------------------------------------------------------------ 魔石（オーナー 2026-09-28「魔石はアイテムで、それを誰かに使うと、
  // そいつはその系統の最初の魔法が覚えられるって仕様にしてよ」）
  // 品の use.effects の {type:'learnSpell', element, spell?} → 使った仲間が、その属性の最初の術（単属性で段 step が一番低い物）を確実に覚える。
  // 覚えるのは learn（'glimmer' の知らせ・記録は閃きと同じ）。もう覚えている人・術を使えない人（mods.noSpell）には使えない（品は減らない）。
  // 術を唱えるのに熟練度の条件は無い（覚えていれば段階 1 から唱えられる）ので、熟練度は足さない。
  /** 属性の最初の術の id（単属性で step が一番低い物。無ければ null） */
  function firstSpell(el) {
    let best = null;
    for (const id of Object.keys(DB.spells || {})) {
      const a = DB.spells[id];
      if (!a || a.kind !== 'spell' || !Array.isArray(a.elements) || a.elements.length !== 1 || a.elements[0] !== el) continue;
      const st = a.step != null ? a.step : (a.glim && a.glim.lv) || 99;
      if (!best || st < best.st) best = { id, st };
    }
    return best ? best.id : null;
  }
  /** 品の「術を覚える」効き目（無ければ null）→ {element, spell} */
  function stoneOf(it) {
    const use = it && (it.use || it);
    const e = use && (use.effects || []).find((x) => x && x.type === 'learnSpell');
    if (!e) return null;
    const spell = e.spell || firstSpell(e.element);
    const a = spell && DB.spells && DB.spells[spell];
    if (!a) return null;
    // spells: 一度に覚える術（光は『ひだまり』と『光の矢』）。無ければ spell 1 つ
    const spells = (Array.isArray(e.spells) && e.spells.length ? e.spells : [spell]).filter((id) => DB.spells && DB.spells[id]);
    return { element: e.element || (a.elements || [])[0], spell, spells };
  }
  /** この人に使えないわけ（使えるなら null）: 'もう覚えている' | '術を使えない' */
  function stoneBlock(u, it) {
    const c = charOf(u), s = stoneOf(it);
    if (!c || !s) return R.T('sys.glimmer.stoneBlock.ret');
    if (s.spells.every((id) => has(c.spells, id))) return R.T('sys.glimmer.stoneBlock.ret_2');
    if (R.Rules && R.Rules.mods && R.Rules.mods(c).noSpell) return R.T('sys.glimmer.stoneBlock.ret_3');
    return null;
  }
  /** 魔石を使う（品の数は呼ぶ側）→ {ok, id, reason, line} */
  function useStone(u, it, opts) {
    const c = charOf(u), s = stoneOf(it);
    const reason = stoneBlock(c, it);
    if (reason) return { ok: false, id: s && s.spell, reason, line: '' };
    const got = s.spells.filter((id) => !has(c.spells, id) && learn(c, id, opts));
    if (!got.length) return { ok: false, id: s.spell, reason: R.T('sys.glimmer.useStone.reason'), line: '' };
    const el = DB.elements && DB.elements[s.element];
    const line = R.T('sys.glimmer.useStone.line', { name: c.name, p1: el ? el.name : '', join: got.map((id) => R.T('sys.glimmer.useStone.line.name', { name: DB.spells[id].name })).join(R.T('sys.glimmer.useStone.line.join')) });
    return { ok: true, id: got[0], ids: got, reason: null, line };
  }

  // ------------------------------------------------------------ 派生技（design/BACKLOG「派生技の閃き」。定数は K.DERIVE）
  // 持ち主（2026-09-28）「派生技は普通の通常攻撃使ってるだけじゃ覚えないのよ。派生技ってレア技なのよ」
  //   「回数と熟練度があっても確率なのよ、結局は。確率と相手のランクと自分の相性の問題」
  // 派生技 = derived:{from, lv} を持ち glim が無い技（通常の閃きの候補に入らない）。親 from を使った行動の後だけ振る。
  //   c.techUse = {技id: 使った回数}（保存する）、c.derived = {派生技id: 親の技id}（覚えた記録）
  let dIndex = null, dIndexN = -1;
  function dIdx() {
    const n = Object.keys(DB.techs || {}).length;
    if (dIndex && dIndexN === n) return dIndex;
    dIndex = {}; dIndexN = n;
    for (const id of Object.keys(DB.techs || {})) { const d = DB.techs[id].derived; if (d && d.from) (dIndex[d.from] = dIndex[d.from] || []).push(id); }
    return dIndex;
  }
  const isDerived = (id) => !!(DB.techs && DB.techs[id] && DB.techs[id].derived && DB.techs[id].derived.from);
  /** 派生技の段: 1（親がふつうの技）・2（親も派生技）… 派生技でなければ 0 */
  function tierOf(id) { let t = 0, x = id; while (isDerived(x) && t < 5) { t++; x = DB.techs[x].derived.from; } return t; }
  /** 技 id を使うと編み出せる派生技の一覧 [{to, lv, tier}]（データの順） */
  function deriveOf(id) { return (dIdx()[id] || []).map((to) => ({ to, lv: DB.techs[to].derived.lv || DB.techs[to].rank || 1, tier: tierOf(to) })); }
  /** 派生技 to の親（1 つ。派生技でなければ []） */
  function deriveSources(to) { return isDerived(to) ? [DB.techs[to].derived.from] : []; }
  function useCount(u, id) { const c = charOf(u); return (c && c.techUse && c.techUse[id]) | 0; }
  /** 技 id を 1 回使った（戦闘の中で行動が終わったとき）→ 新しい回数 */
  function countUse(u, id) {
    const c = charOf(u);
    if (!c || !id || !(DB.techs && DB.techs[id])) return 0;
    const t = (c.techUse = c.techUse && typeof c.techUse === 'object' ? c.techUse : {});
    t[id] = Math.min(K().DERIVE.maxCount, (t[id] | 0) + 1);
    return t[id];
  }
  /**
   * 派生 1 つの確率（K.DERIVE の式）。to が from の派生技でない・覚えている・回数が minUses 未満 → 0。
   * ctx = {rankB（戦闘の閃きレベル。無ければ 1）}。回数と熟練度は少しだけ上げる（上限は低い）。確定にはならない（cap[段] < 1）
   */
  function deriveChance(u, from, to, ctx, n) {
    const c = charOf(u);
    if (to && typeof to === 'object') to = to.to;
    const a = DB.techs && DB.techs[to];
    if (!c || !a || !a.derived || a.derived.from !== from || has(c.techs, to)) return 0;
    ctx = ctx || {};
    const D = K().DERIVE, G = K().GLIM, TP = K().TECH_PROF;
    n = n != null ? n : useCount(c, from);
    if (n < D.minUses) return 0;
    const tier = Math.max(1, Math.min(D.base.length - 1, tierOf(to)));
    const lv = a.derived.lv || a.rank || 1;
    const apt = R.Rules.aptitude(c);
    const aptM = apt.w[a.wtype] != null ? apt.w[a.wtype] : 1;
    const GF = R.Rules.gfOf(R.Rules.finalStats(c).dex);
    const rankB = ctx.rankB != null ? ctx.rankB : G.rankBase;
    const RANK = clamp(1 + D.rankSlope * (rankB - lv), D.rankMin, D.rankMax);
    const gate = TP[lv] != null ? TP[lv] : TP[TP.length - 1];
    const pr = R.Rules.profRank(c.wprof ? c.wprof[a.wtype] : 0);
    const PROF = clamp(1 + D.profSlope * (pr - gate), D.profMin, D.profMax);
    const USE = Math.min(D.useMax, 1 + D.useSlope * n);
    const m = R.Rules.mods(c);
    const gp = glimMod(m, a.wtype) + glimMod(m, 'tech');
    return Math.min(D.cap[tier], D.base[tier] * aptM * GF * RANK * PROF * USE * Math.max(0, 1 + gp / 100));
  }
  /**
   * 技 used を使った行動の後の判定（1 回の行動で派生は 1 つまで。データの順に振り、最初に当たった物）。
   * used 以外（攻撃・術・道具・ほかの技）では振らない。c は変えない（覚えるのは learnDerived）
   * ctx = {rankB, rng, force（テスト用: 覚えていない最初の派生技を必ず）} → {kind:'tech', id, from} | null
   */
  function deriveRoll(u, used, ctx) {
    const c = charOf(u);
    ctx = ctx || {};
    if (!c || typeof used !== 'string' || !(DB.techs && DB.techs[used])) return null;
    const rng = typeof ctx.rng === 'function' ? ctx.rng : ctx.rng && ctx.rng.next ? () => ctx.rng.next() : Math.random;
    const n = useCount(c, used);
    for (const d of deriveOf(used)) {
      if (has(c.techs, d.to)) continue;
      if (ctx.force) return { kind: 'tech', id: d.to, from: used };
      const p = deriveChance(c, used, d.to, ctx, n);
      if (p > 0 && rng() < p) return { kind: 'tech', id: d.to, from: used };
    }
    return null;
  }
  /** 派生で覚える（learn ＋ c.derived[to] = from）→ 新しく覚えたら true */
  function learnDerived(u, to, from, opts) {
    const c = charOf(u);
    if (!learn(c, to, opts)) return false;
    c.derived = c.derived && typeof c.derived === 'object' ? c.derived : {};
    c.derived[to] = from;
    return true;
  }
  /** 技 id が派生技なら親の技 id（技・術の「〇〇から派生」。派生技でなければ null） */
  function derivedFrom(u, id) { void u; return isDerived(id) && DB.techs[DB.techs[id].derived.from] ? DB.techs[id].derived.from : null; }
  /** 読み込んだ人の techUse・derived を正しい形に（古いセーブには無い → {}。知らない技・負の数は捨てる） */
  function sanitize(c) {
    if (!c || typeof c !== 'object') return c;
    const tu = {}, dv = {};
    const src = c.techUse && typeof c.techUse === 'object' && !Array.isArray(c.techUse) ? c.techUse : {};
    for (const id of Object.keys(src)) { const v = Math.floor(+src[id]); if (DB.techs && DB.techs[id] && v > 0) tu[id] = Math.min(K().DERIVE.maxCount, v); }
    const d0 = c.derived && typeof c.derived === 'object' && !Array.isArray(c.derived) ? c.derived : {};
    for (const id of Object.keys(d0)) if (isDerived(id) && DB.techs[id].derived.from === d0[id]) dv[id] = d0[id];   // 派生技だけ
    c.techUse = tu; c.derived = dv;
    return c;
  }

  // ------------------------------------------------------------ 補助
  function flagsOf(u) {
    if (!u) return [];
    const a = (u.def && u.def.flags) || [], b = u.flags || [];
    const out = a === b ? a.slice() : a.concat(b);
    if (u.boss) out.push('boss');
    if (u.rare) out.push('rare');
    return out;
  }
  /** 1 体の閃きレベル（§4.9.2） */
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
  /** 戦闘の閃きレベル rankB と敵の種類 EF（最初にいた魔物から。§4.9.2） */
  function params(units, Tb) {
    const G = K().GLIM;
    let rankB = (Tb || 0) + G.rankBase, ef = G.ef.normal;
    for (const u of units || []) {
      if (!u || u.side === 'party') continue;
      rankB = Math.max(rankB, monRank(u, Tb));
      const flags = flagsOf(u);
      const e = flags.indexOf('boss') >= 0 ? G.ef.boss : flags.indexOf('rare') >= 0 ? G.ef.rare : (u.golden || flags.indexOf('golden') >= 0) ? G.ef.golden : G.ef.normal;
      ef = Math.max(ef, e);
    }
    return { rankB, ef };
  }
  function spellId(elements, which) {
    const els = orderEls(elements || []);
    if (els.length === 1) return 's_' + els[0] + '_' + which;
    if (els.length === 2) return 's_' + els.join('_') + '_' + String(which || 'a').toLowerCase();
    return 's_' + els.join('_');
  }
  function sideOf(a) { const t = typeof a === 'string' ? a : a && a.target; return FOE_TARGETS[t] ? 'foe' : 'ally'; }
  /** 閃きの札の見出しと名前の色（§11.5.7） */
  function banner(a) {
    if (typeof a === 'string') a = act(a);
    if (!a) return { title: R.T('sys.glimmer.banner.title'), color: '#fff8d0' };
    if (a.kind === 'spell') {
      const el = orderEls(a.elements || [])[0];
      const color = (el && DB.elements[el] && DB.elements[el].color) || '#fff8d0';
      return { title: (a.elements || []).length > 1 ? R.T('sys.glimmer.banner.title_2') : R.T('sys.glimmer.banner.title'), color };
    }
    const lv = a.glim ? a.glim.lv : 1;
    if (lv >= 10) return { title: R.T('sys.glimmer.banner.title_3'), color: '#ff88d0' };
    if (lv === 9) return { title: R.T('sys.glimmer.banner.title_4'), color: '#f8d838' };
    return { title: R.T('sys.glimmer.banner.title'), color: '#fff8d0' };
  }

  const Glimmer = (R.Glimmer = R.Glimmer || {});
  Object.assign(Glimmer, {
    ELEMENTS, classOf, candidates, chance, roll, learn, profMargin, firstSpell, stoneOf, stoneBlock, useStone, monRank, params, pairsKnown, spellId, sideOf, banner,
    deriveOf, deriveSources, tierOf, isDerived, useCount, countUse, deriveChance, deriveRoll, learnDerived, derivedFrom, sanitize,
    reindex() { index = null; return idx(); },
  });
})(window.RPG);
