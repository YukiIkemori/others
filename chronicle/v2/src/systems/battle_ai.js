// R.BattleAI（BATTLE）: 魔物の行動の選び方（重み＋条件、列で重みのついたねらい）と、sim・道具だけが使う味方の AI。
// 移植の元は chronicle/src/systems/battle_ai.js（DESIGN §3.3.9・§4.5.3・§4.13.2・§6.2.7・§9.1.7）。武器は 1 本（STATS_REWORK §8.2）。
// 画面にオートは無い（A26）: 味方の AI は sim と tools だけが呼ぶ。
//
//   R.BattleAI.enemyCommand(B, uid)             → {cmd, id?, target?}（契約の形。B は R.BattleCore.create の物）
//   R.BattleAI.partyCommand(B, uid, style)      → {cmd, id?, target?}  style: 'fight'（たたかうだけ）| 'repeat'（リピートだけ）| 'script'（正しく対処する台本）
//   R.BattleAI.monster(eng, u) / partyCommands(eng, opts) / scripted(eng, style, round) … Engine（中の形）に対する物
(function (R) {
  'use strict';
  const DB = R.DB;
  R.Stubs && R.Stubs.claim && R.Stubs.claim('BattleAI');
  const RN = () => R.Mon.rng();
  const ACT = (id) => R.BattleCore.ACT(id);

  const FOE_TARGETS = { enemy: 1, enemies: 1, group: 1, random: 1, front: 1 };
  const ALLY_TARGETS = { ally: 1, allies: 1, self: 1, ally_any: 1, ally_other: 1, party: 1 };
  const SINGLE_ALLY = { ally: 1, ally_any: 1, ally_other: 1 };
  const DISABLING = ['sleep', 'paralyze', 'freeze', 'confuse'];
  const GOOD = ['regen', 'veil', 'counter', 'nimble', 'cover'];
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const AUTO_OPTS = Object.freeze({ thrift: true, items: 'auto' });
  const has = (act, type) => !!(act && act.effects && act.effects.some((e) => e.type === type));
  const effOf = (act, type) => act && act.effects && act.effects.find((e) => e.type === type);
  const dmgOf = (act) => act && act.effects && act.effects.find((e) => e.type === 'damage' && !e.on);
  const rowK = () => {
    const k = R.Rules && R.Rules.K && R.Rules.K.ROW;
    const w = (k && k.weight) || { front: 2, middle: 1 };
    const a = (k && k.aimMiddle) || { front: 1, middle: 3 };
    return { weight: { front: w.front, back: w.back != null ? w.back : w.middle }, aimMiddle: { front: a.front, back: a.back != null ? a.back : a.middle } };
  };
  const isMagicAct = (a) => R.BattleCore.isMagicAct(a);
  const isUseItem = (it) => !!(it && (it.slot === 'use' || it.type === 'consumable'));

  // --------------------------------------------------------------- 魔物（§9.1.7）
  /** 行動の条件（全部のキーが成り立つとき）。v2: flag / noFlag（戦闘の中の旗） */
  function condOk(eng, u, a) {
    const c = a.cond;
    if (!c) return true;
    if (c.hpBelow != null && !(u.hpRate() < c.hpBelow)) return false;
    if (c.hpAbove != null && !(u.hpRate() > c.hpAbove)) return false;
    if (c.every) { const n = Math.max(1, c.every[0] | 0); if (u.acts % n !== ((c.every[1] | 0) % n)) return false; }
    if (c.once && u.used[a.id]) return false;
    if (c.round != null && eng.round < c.round) return false;
    if (c.alone && eng.living(u.side).length > 1) return false;
    if (c.countBelow != null && !(eng.living(u.side).length < c.countBelow)) return false;
    if (c.allyDown && !(u.isParty ? eng.party : eng.mons).some((m) => !m.alive && !m.gone)) return false;
    if (c.flag && !(eng.flags && eng.flags[c.flag])) return false;
    if (c.noFlag && eng.flags && eng.flags[c.noFlag]) return false;
    return true;
  }
  function monUsable(eng, u, id) {
    if (id === 'attack' || id === 'defend' || id === 'wait' || id === 'flee') return true;
    const a = ACT(id);
    if (!a) return false;
    if (isMagicAct(a) && u.status.silence) return false;
    return true;
  }
  /** 味方の誰をねらうか（§4.5.3）: 前列 2 : 後列 1、aim 'middle' は 1 : 3、aim 'low' は HP の割合が低い人 */
  function pickPartyTarget(eng, aim) {
    const l = eng.living('party');
    if (!l.length) return null;
    if (aim === 'low') return l.slice().sort((a, b) => a.hpRate() - b.hpRate() || a.idx - b.idx)[0];
    const K = rowK();
    const W = aim === 'middle' ? K.aimMiddle : K.weight;
    return R.Mon.weighted(l.map((p) => ({ p, w: W[eng.effRow(p)] || 1 }))).p;
  }
  function monCommand(eng, u, id) {
    if (id === 'attack') return { type: 'attack', target: pickPartyTarget(eng) };
    if (id === 'defend' || id === 'wait') return { type: id };
    if (id === 'flee') return u.boss ? null : { type: 'flee' };
    const a = ACT(id);
    if (!a) return null;
    const mons = eng.living(u.side);
    const heal = has(a, 'heal');
    const buff = effOf(a, 'buff');
    const st = effOf(a, 'status');
    const goodSt = st && GOOD.includes(st.status) ? st.status : null;
    const sm = effOf(a, 'summon');
    if (sm && mons.length >= Math.min(8, sm.max != null ? sm.max : 8)) return null;
    if (a.target === 'front' && !eng.living('party').some((p) => eng.effRow(p) === 'front')) return null;
    switch (a.target) {
      case 'enemy': case 'group':
        return { type: 'ability', id, target: pickPartyTarget(eng, a.aim) };
      case 'enemies': case 'random': case 'front':
        return { type: 'ability', id, target: null };
      case 'self':
        if (sm || a.telegraph) return { type: 'ability', id, target: u };
        if (heal && !effOf(a, 'damage') && u.hpRate() > 0.6) return null;
        if (buff && buff.stages > 0 && u.buffs[buff.stat] >= 2) return null;
        if (goodSt && u.status[goodSt]) return null;
        return { type: 'ability', id, target: u };
      case 'ally': case 'ally_any': case 'ally_other': {
        const pool = a.target === 'ally_other' ? mons.filter((m) => m !== u) : mons;
        if (!pool.length) return null;
        if (heal) {
          const t = pool.filter((m) => m.hpRate() < 0.6).sort((x, y) => x.hpRate() - y.hpRate())[0];
          return t ? { type: 'ability', id, target: t } : null;
        }
        let cand = pool;
        if (buff) cand = cand.filter((m) => m.buffs[buff.stat] < 2);
        if (goodSt) cand = cand.filter((m) => !m.status[goodSt]);
        if (!cand.length) return null;
        return { type: 'ability', id, target: cand.slice().sort((x, y) => x.hpRate() - y.hpRate())[0] };
      }
      case 'allies':
        if (heal && !mons.some((m) => m.hpRate() < 0.7)) return null;
        if (buff && buff.stages > 0 && mons.every((m) => m.buffs[buff.stat] >= 2)) return null;
        return { type: 'ability', id, target: u };
      case 'ally_dead': {
        const t = (u.isParty ? eng.party : eng.mons).find((m) => !m.alive && !m.gone);
        return t ? { type: 'ability', id, target: t } : null;
      }
    }
    return { type: 'ability', id, target: pickPartyTarget(eng, a.aim) };
  }
  /** 魔物の手番の行動（重み w、条件の成り立つ物から） */
  function monster(eng, u) {
    const src = u.d.actions && u.d.actions.length ? u.d.actions : [{ id: 'attack', w: 1 }];
    // 予告を 1 つ出している間は次の予告を選ばない（E18）
    let list = src.filter((a) => (a.w == null || a.w > 0) && condOk(eng, u, a) && monUsable(eng, u, a.id) && !(u.reserved && ACT(a.id) && ACT(a.id).telegraph))
      .map((a) => (a.w == null ? Object.assign({ w: 1 }, a) : a));
    while (list.length) {
      const a = R.Mon.weighted(list);
      const cmd = monCommand(eng, u, a.id);
      if (cmd && (cmd.type !== 'attack' || cmd.target)) return cmd;
      list = list.filter((x) => x !== a);
    }
    return { type: 'attack', target: pickPartyTarget(eng) };
  }

  // ------------------------------------------------------------------ 味方（sim の台本）
  const wItem = (W) => R.BattleCore.weaponItem(W);
  function techIds(c, wtype) {
    return (c.techs || []).filter((id) => { const a = ACT(id); return a && a.kind === 'tech' && a.wtype === wtype; });
  }
  function spellIds(c) {
    return (c.spells || []).filter((id) => { const a = ACT(id); return a && a.kind === 'spell'; });
  }
  /** 使える技（今の武器の系統）と術 → [{id, ab, type, mp, cost}] */
  function abilityOptions(eng, u) {
    const out = [];
    const c = u.c;
    const W = u.weapon();
    if (W && !wItem(W).sealTech) {
      for (const id of techIds(c, u.wtype)) {
        const a = ACT(id);
        if (!a || a.noAuto) continue;
        if (eng.unusable(u, id)) continue;
        const mp = eng.mpCost(u, id);
        out.push({ id, ab: a, type: 'tech', mp, cost: mp });
      }
    }
    if (!u.mods.noSpell) {
      for (const id of spellIds(c)) {
        const a = ACT(id);
        if (!a || a.noAuto) continue;
        if (eng.unusable(u, id)) continue;
        const mp = eng.mpCost(u, id);
        out.push({ id, ab: a, type: 'spell', mp, cost: mp });
      }
    }
    return out;
  }
  const spend = (u, o) => (o.mp ? o.mp / Math.max(1, u.mmp) : 0);
  const lowPool = (u, o) => !!(o.mp && u.mp < u.mmp * 0.3);
  const HEAL_RESERVE = { pct: 0.3, heals: 2 };
  const isCare = (a) => !!(a && a.kind === 'spell' && (has(a, 'heal') || has(a, 'revive')) && (ALLY_TARGETS[a.target] || a.target === 'ally_dead'));
  function careOf(eng, u, plan) {
    const memo = plan && (plan.care = plan.care || new Map());
    if (memo && memo.has(u)) return memo.get(u);
    let healCost = Infinity;
    if (u.isParty && !u.mods.noSpell) for (const id of spellIds(u.c)) { const a = ACT(id); if (isCare(a)) healCost = Math.min(healCost, eng.mpCost(u, id)); }
    const healer = healCost !== Infinity;
    const r = { healer, healCost: healer ? healCost : 0, reserve: healer ? Math.max(u.mmp * HEAL_RESERVE.pct, HEAL_RESERVE.heals * healCost) : 0 };
    if (memo) memo.set(u, r);
    return r;
  }
  const careOk = (u, o, care) => !care.healer || !o.mp || u.mp - o.mp >= care.reserve;
  const rareItem = (it) => !!(it && (it.grade === 'rare' || it.grade === 'super' || it.rare || it.src === 'relic'));
  function itemOptions(eng, u, plan, mode, acts) {
    const out = [];
    if (!mode) return out;
    let partyRevive = false;
    const partyCure = new Set();
    const selfHeal = (acts || []).some((o) => has(o.ab, 'heal') && ALLY_TARGETS[o.ab.target]);
    if (mode === 'auto') {
      for (const p of eng.party) {
        if (!p.commandable()) continue;
        for (const o of abilityOptions(eng, p)) {
          if (has(o.ab, 'revive')) partyRevive = true;
          const cu = effOf(o.ab, 'cure');
          if (cu) for (const s of cu.statuses === 'all' ? DISABLING.concat(['silence']) : cu.statuses) partyCure.add(s);
        }
      }
    }
    for (const id in eng.inv) {
      const it = DB.items[id];
      if (!isUseItem(it) || !it.use || !it.use.battle || rareItem(it) || it.stone) continue;
      if (eng.count(id) - (plan.items[id] || 0) <= 0) continue;
      if (eng.unusable(u, id)) continue;
      if (mode === 'auto') {
        const rev = has(it.use, 'revive'), heal = has(it.use, 'heal'), cure = effOf(it.use, 'cure');
        const ok = (rev && !partyRevive) || (heal && !rev && !selfHeal) || (cure && !heal && !rev && (cure.statuses === 'all' || cure.statuses.some((s) => !partyCure.has(s))));
        if (!ok) continue;
      }
      out.push({ id, ab: it.use, type: 'item', cost: 0, mp: 0, item: it });
    }
    return out;
  }
  const cmdOf = (o, target) => (o.item ? { type: 'item', id: o.id, target } : o.type === 'tech' ? { type: 'tech', id: o.id, target } : { type: 'spell', id: o.id, target });
  function reserve(plan, o) { if (o.item) plan.items[o.id] = (plan.items[o.id] || 0) + 1; }
  function bestAttack(eng, u, m) {
    if (!eng.canReach(u)) return { slot: undefined, d: 0, reach: false };
    return { slot: 'weapon1', d: m ? eng.expectAttack(u, m) : 0, reach: true };
  }
  function tryRevive(eng, u, acts, plan) {
    const dead = eng.party.filter((p) => !p.alive && !p.gone && !plan.revive.has(p));
    if (!dead.length) return null;
    const opts = acts.filter((o) => has(o.ab, 'revive') && ['ally_dead', 'ally_any', 'allies', 'party'].includes(o.ab.target) && !(o.item && rareItem(o.item)));
    if (!opts.length) return null;
    const multi = (o) => o.ab.target === 'allies' || o.ab.target === 'party';
    opts.sort((a, b) => multi(b) - multi(a) || spend(u, a) - spend(u, b));
    const o = opts.find((x) => multi(x) && dead.length > 1) || opts.filter((x) => !multi(x))[0] || opts[0];
    for (const p of multi(o) ? dead : [dead[0]]) plan.revive.add(p);
    reserve(plan, o);
    return cmdOf(o, dead[0]);
  }
  function canFinish(eng, u, acts, plan) {
    const foes = eng.living('mon');
    if (!foes.length || eng.boss) return false;
    const left = (m) => Math.max(0, m.hp - (plan.dmg.get(m) || 0));
    if (foes.length === 1) {
      const m = foes[0], l = left(m);
      if (!l) return true;
      const ba = bestAttack(eng, u, m);
      if (ba.reach && ba.d >= l) return true;
      return acts.some((o) => !o.item && dmgOf(o.ab) && FOE_TARGETS[o.ab.target] && dmgOf(o.ab).formula !== 'percent' && eng.expectDamage(u, o.ab, m) >= l);
    }
    return acts.some((o) => !o.item && dmgOf(o.ab) && o.ab.target === 'enemies' && dmgOf(o.ab).formula !== 'percent' && foes.every((m) => eng.expectDamage(u, o.ab, m) >= left(m)));
  }
  function tryHeal(eng, u, acts, plan) {
    const mates = eng.living('party');
    const after = (p) => (p.hp + (plan.heal.get(p) || 0)) / p.mhp;
    const limit = eng.boss ? (plan.healAt || 0.55) : 0.4;
    const hurt = mates.filter((p) => after(p) < limit).sort((a, b) => after(a) - after(b));
    if (!hurt.length) return null;
    if (!eng.boss) {
      const incoming = eng.living('mon').reduce((s, m) => s + threat(eng, m), 0) / Math.max(1, mates.length);
      if (hurt.every((p) => p.hp + (plan.heal.get(p) || 0) > incoming) && canFinish(eng, u, acts, plan)) return null;
    }
    const many = mates.filter((p) => after(p) < 0.65).length >= 2;
    let best = null, bestScore = 0, bestTargets = null;
    for (const o of acts) {
      if (!has(o.ab, 'heal') || !ALLY_TARGETS[o.ab.target] || has(o.ab, 'damage')) continue;
      if (o.item && hurt[0].hpRate() >= (eng.boss ? 0.4 : 0.25)) continue;
      if (o.ab.target === 'self' && hurt[0] !== u) continue;
      const other = hurt.find((p) => p !== u);
      if (o.ab.target === 'ally_other' && !other) continue;
      const all = o.ab.target === 'allies' || o.ab.target === 'party';
      const targets = all ? mates : [o.ab.target === 'self' ? u : o.ab.target === 'ally_other' ? other : hurt[0]];
      let gain = 0;
      for (const t of targets) gain += Math.min(eng.expectHeal(u, o.ab, t, o.item), Math.max(0, t.mhp - t.hp - (plan.heal.get(t) || 0)));
      const avgMhp = mates.reduce((s, p) => s + p.mhp, 0) / mates.length;
      let score = gain / Math.max(1, avgMhp);
      if (all && !many) score *= 0.6;
      score -= spend(u, o) * 0.6 + (o.item ? 0.15 : 0);
      if (score > bestScore) { best = o; bestScore = score; bestTargets = targets; }
    }
    if (!best) return null;
    for (const t of bestTargets) plan.heal.set(t, (plan.heal.get(t) || 0) + eng.expectHeal(u, best.ab, t, best.item));
    reserve(plan, best);
    return cmdOf(best, bestTargets[0]);
  }
  function tryCure(eng, u, acts, plan) {
    for (const p of eng.living('party')) {
      if (plan.cured.has(p)) continue;
      const bad = DISABLING.filter((s) => p.status[s]);
      if (p.status.silence && p.c && (p.c.spells || []).length && p.mmp > 0) bad.push('silence');
      if (!bad.length) continue;
      const o = acts.find((x) => {
        const cu = effOf(x.ab, 'cure');
        return cu && ALLY_TARGETS[x.ab.target] && x.ab.target !== 'self' && !(x.ab.target === 'ally_other' && p === u) && (cu.statuses === 'all' || bad.some((s) => cu.statuses.includes(s)));
      });
      if (o) { plan.cured.add(p); reserve(plan, o); return cmdOf(o, p); }
    }
    return null;
  }
  function tryDispel(eng, u, acts, plan) {
    if (!eng.boss) return null;
    const t = eng.living('mon').find((m) => m.boss && (m.buffs.def > 0 || m.buffs.mdef > 0 || m.buffs.atk > 1 || m.buffs.mag > 1) && !plan.dispelled.has(m));
    if (!t) return null;
    const o = acts.filter((x) => !x.item && has(x.ab, 'dispel') && FOE_TARGETS[x.ab.target]).sort((a, b) => spend(u, a) - spend(u, b))[0];
    if (!o) return null;
    plan.dispelled.add(t);
    return cmdOf(o, t);
  }
  function tryBuff(eng, u, acts, plan) {
    if (!eng.boss) return null;
    const cover = acts.find((o) => !o.item && has(o.ab, 'cover'));
    if (cover && !plan.buffed.has('cover') && eng.living('party').some((p) => p !== u && p.hpRate() < 0.5) && u.hpRate() > 0.6) { plan.buffed.add('cover'); return cmdOf(cover, u); }
    if (eng.round > 4 || RN().next() > 0.4) return null;
    for (const o of acts) {
      if (o.item || has(o.ab, 'damage')) continue;
      const b = effOf(o.ab, 'buff');
      const st = effOf(o.ab, 'status');
      if (b && b.stages > 0 && ALLY_TARGETS[o.ab.target]) {
        const t = o.ab.target === 'self' ? u : eng.living('party').find((p) => p.buffs[b.stat] < 1 && !plan.buffed.has(p.key + b.stat) && !(o.ab.target === 'ally_other' && p === u));
        if (t && t.buffs[b.stat] < 1) { plan.buffed.add(t.key + b.stat); return cmdOf(o, t); }
      }
      if (st && GOOD.includes(st.status) && ALLY_TARGETS[o.ab.target] && st.status !== 'cover') {
        const t = o.ab.target === 'self' ? u : eng.living('party').find((p) => !p.status[st.status] && !plan.buffed.has(p.key + st.status));
        if (t && !t.status[st.status]) { plan.buffed.add(t.key + st.status); return cmdOf(o, t); }
      }
      if (b && b.stages < 0 && FOE_TARGETS[o.ab.target]) {
        const t = eng.living('mon').find((m) => m.boss && m.buffs[b.stat] > -1 && !plan.buffed.has(m.key + b.stat));
        if (t) { plan.buffed.add(t.key + b.stat); return cmdOf(o, t); }
      }
    }
    return null;
  }

  // ------------------------------------------------------------ 集中（A5、§4.13.2-a）
  function threat(eng, m) {
    const party = eng.living('party');
    if (!party.length) return 1;
    let phys = 0, mag = 0;
    for (const p of party) {
      phys += eng.expectAttack(m, p);
      mag += m.stat('mag') * 1.2 * eng.dk / (eng.dk + Math.max(0, p.stat('mdef')));
    }
    phys /= party.length; mag /= party.length;
    let t = Math.max(phys, mag, 1) * (m.actsPerTurn ? m.actsPerTurn() : 1);
    if (m.reserved) t *= 2;
    if (m.d && m.d.leader) t *= 2;   // 群れの頭（倒せば群れが逃げる）
    if (!m.canAct()) t *= 0.3;
    else if (m.status.confuse) t *= 0.5;
    return t;
  }
  const FOCUS_COVER = 0.85;
  function focusOrder(eng, plan) {
    const foes = eng.living('mon');
    const left = (m) => Math.max(0, m.hp * FOCUS_COVER - ((plan && plan.dmg.get(m)) || 0));
    const rows = foes.map((m) => {
      const l = left(m);
      const score = threat(eng, m) / Math.max(1, l);
      return { m, l, score: l > 0 ? score : -((plan && plan.dmg.get(m)) || 0) / Math.max(1, m.hp) };
    });
    rows.sort((a, b) => b.score - a.score || a.l - b.l || a.m.idx - b.m.idx);
    return rows.map((r) => r.m);
  }
  function assignTarget(eng, u, plan) {
    const order = focusOrder(eng, plan);
    if (!order.length) return null;
    let free = eng.party.filter((p) => p.idx >= u.idx && p.commandable());
    if (!free.includes(u)) free.push(u);
    const planned = (m) => (plan && plan.dmg.get(m)) || 0;
    for (const m of order) {
      const need = m.hp * FOCUS_COVER - planned(m);
      if (need <= 0) continue;
      const ds = free.map((p) => bestAttack(eng, p, m).d);
      const total = ds.reduce((a, b) => a + b, 0);
      if (total < need) return m;
      let bestMask = 0, bestSum = Infinity, bestN = 9;
      for (let mask = 1; mask < 1 << free.length; mask++) {
        let sum = 0, n = 0;
        for (let i = 0; i < free.length; i++) if (mask & (1 << i)) { sum += ds[i]; n++; }
        if (sum >= need && (sum < bestSum - 1e-6 || (Math.abs(sum - bestSum) < 1e-6 && n < bestN))) { bestMask = mask; bestSum = sum; bestN = n; }
      }
      const ui = free.indexOf(u);
      if (bestMask & (1 << ui)) return m;
      free = free.filter((_, i) => !(bestMask & (1 << i)));
      if (!free.length) break;
    }
    return order.slice().sort((a, b) => planned(a) / Math.max(1, a.hp) - planned(b) / Math.max(1, b.hp))[0];
  }
  function focusTarget(eng, u, plan) {
    const t = focusOrder(eng, plan)[0] || null;
    if (t && plan) plan.dmg.set(t, (plan.dmg.get(t) || 0) + bestAttack(eng, u, t).d);
    return t;
  }

  // ------------------------------------------------------------ 閃きねらい（§4.13.2-d）
  function glimCtx(eng, u, kind, extra) {
    const row = eng.effRow(u);
    return Object.assign({ kind, rankB: eng.rankB, ef: eng.ef, tier: eng.glimTier, row, middle: row === 'back', silenced: !!u.status.silence }, extra);
  }
  function candidatesOpen(eng, u, ctx) {
    if (R.Glimmer && R.Glimmer.candidates) {
      try { const l = R.Glimmer.candidates(u.c, ctx); return !!(l && l.length); } catch (e) { return false; }
    }
    const c = u.c;
    const known = new Set((c.techs || []).concat(c.spells || []));
    const pool = ctx.kind === 'tech' ? DB.techs || {} : DB.spells || {};
    for (const id in pool) {
      const a = ACT(id);
      if (!a || known.has(id) || !a.glim || a.glim.lv > eng.rankB) continue;
      if (ctx.kind === 'tech' && a.wtype === ctx.wtype && !(ctx.middle && !a.reach)) return true;
      if (ctx.kind === 'spell' && (a.elements || []).some((e) => ctx.elements.includes(e))) return true;
    }
    return false;
  }
  function glimCast(eng, u, acts, plan) {
    if (eng.boss) return null;
    const mem = (eng.aiMem = eng.aiMem || {});
    const key = u.c.id || u.key;
    if (mem[key] && mem[key].cast) return null;
    if (!u.mmp || u.mp < u.mmp * 0.5) return null;
    const spells = acts.filter((o) => o.type === 'spell');
    if (!spells.length) return null;
    const foes = eng.living('mon');
    const hurt = eng.living('party').filter((p) => p.hp < p.mhp);
    let best = null;
    const open = new Set();
    for (const el of ELEMENTS) {
      const mine = spells.filter((o) => (o.ab.elements || []).includes(el));
      if (mine.length && candidatesOpen(eng, u, glimCtx(eng, u, 'spell', { elements: [el], used: mine[0].id }))) open.add(el);
    }
    for (const el of ELEMENTS) {
      const mine = spells.filter((o) => (o.ab.elements || []).includes(el));
      for (const o of mine) {
        const a = o.ab;
        let target = null, useful = false;
        if (FOE_TARGETS[a.target] && (has(a, 'damage') || has(a, 'status') || has(a, 'buff'))) {
          if (!foes.length) continue;
          target = a.target === 'enemy' || a.target === 'group' ? assignTarget(eng, u, plan) || foes[0] : null;
          useful = !has(a, 'damage') || (target ? eng.expectDamage(u, a, target) > 0 : foes.some((m) => eng.expectDamage(u, a, m) > 0));
        } else if (has(a, 'heal') && ALLY_TARGETS[a.target]) {
          if (!hurt.length) continue;
          target = SINGLE_ALLY[a.target] ? hurt.slice().sort((x, y) => x.hpRate() - y.hpRate())[0] : u;
          useful = true;
        } else if (ALLY_TARGETS[a.target] && (has(a, 'buff') || has(a, 'status'))) {
          const b = effOf(a, 'buff');
          target = u;
          useful = b ? eng.living('party').some((p) => p.buffs[b.stat] < 2) : true;
        }
        if (!useful) continue;
        const sc = (open.has(el) ? 0 : 1000) + o.mp + (FOE_TARGETS[a.target] ? 0 : 0.5);
        if (!best || sc < best.sc) best = { o, target, sc };
      }
    }
    if (!best) return null;
    mem[key] = Object.assign(mem[key] || {}, { cast: true });
    const a = best.o.ab;
    if (FOE_TARGETS[a.target] && best.target) {
      const d = eng.expectDamage(u, a, best.target);
      if (d > 0) plan.dmg.set(best.target, (plan.dmg.get(best.target) || 0) + d);
    }
    return cmdOf(best.o, best.target);
  }

  // ------------------------------------------------------------ 攻め（§4.13.2-5）
  function offense(eng, u, acts, plan) {
    const foes = eng.living('mon');
    if (!foes.length) return { type: 'defend' };
    const left = (m) => Math.max(0, m.hp - (plan.dmg.get(m) || 0));
    const open = foes.filter((m) => left(m) > 0);
    const pool = open.length ? open : foes;
    const value = (d, m) => { const l = left(m) || m.hp; return Math.min(d, l) * (d >= l ? 1.35 : 1); };
    const focus = assignTarget(eng, u, plan);
    const single = (d, m) => (m === focus ? value(d, m) : d >= left(m) && left(m) > 0 ? value(d, m) * 0.9 : -1);
    const ba = bestAttack(eng, u, focus);
    let best = ba.reach ? { score: value(ba.d, focus), cmd: { type: 'attack', target: focus }, hits: [[focus, ba.d]] } : { score: 0, cmd: { type: 'defend' }, hits: [] };
    const v0 = Math.max(1, best.score);
    const totalLeft = pool.reduce((s, m) => s + left(m), 0);
    const perRound = Math.max(1, plan.perRound || v0);
    const mobGate = (v, kills) => {
      if (totalLeft <= perRound) return false;
      if (kills >= 2) return true;
      const now = Math.ceil(totalLeft / perRound);
      const withIt = Math.ceil(Math.max(0, totalLeft - (v - v0)) / perRound);
      return withIt < now;
    };
    const care = careOf(eng, u, plan);
    const healer = care.healer, healCost = care.healCost;
    for (const o of acts) {
      if (o.item) continue;
      const de = dmgOf(o.ab);
      if (!de || !FOE_TARGETS[o.ab.target]) continue;
      if (!eng.boss) {
        if (plan.thrift && lowPool(u, o)) continue;
        if (de.formula === 'percent') continue;
        if (plan.thrift && !careOk(u, o, care) && !has(o.ab, 'heal')) continue;
      } else if (healer && o.mp && u.mp - o.mp < healCost && !has(o.ab, 'heal')) continue;
      const t0 = o.ab.target;
      const cands = t0 === 'enemy' || t0 === 'group' ? pool : [pool[0]];
      for (const m of cands) {
        const targets = t0 === 'enemy' ? [m] : t0 === 'group' ? pool.filter((x) => x.species === m.species) : pool;
        let v = 0, kills = 0;
        const hits = [];
        for (const t of targets) {
          let d = eng.expectDamage(u, o.ab, t);
          if (t0 === 'random') d = (d * eng.hitCountMean(de)) / targets.length;
          const sv = t0 === 'enemy' ? single(d, t) : value(d, t);
          if (sv < 0) { v = -1; break; }
          v += sv;
          if (d >= left(t) && left(t) > 0) kills++;
          hits.push([t, d]);
        }
        if (v <= 0) continue;
        const free = !o.mp;
        if (!eng.boss && plan.thrift && !free && !mobGate(v, kills)) continue;
        const pen = spend(u, o) * v0 * (eng.boss ? 0.4 : plan.thrift ? 2.5 : 1.2);
        const hpCost = o.ab.effects.reduce((mx, e) => Math.max(mx, e.hpCost || 0), 0) * u.mhp;
        const score = v - pen - hpCost * (u.hpRate() < 0.5 ? 2 : 0.5);
        if (score > best.score * (free ? 1 : 1.1) || (best.cmd.type === 'defend' && score > 0)) best = { score, cmd: cmdOf(o, m), hits };
      }
    }
    for (const [t, d] of best.hits) plan.dmg.set(t, (plan.dmg.get(t) || 0) + d);
    if (best.cmd.type !== 'attack' && best.cmd.type !== 'defend') plan.skillsUsed = (plan.skillsUsed || 0) + 1;
    return best.cmd;
  }

  function partyAction(eng, u, plan, opts) {
    opts = opts || {};
    const acts = abilityOptions(eng, u);
    const items = itemOptions(eng, u, plan, opts.items, acts);
    const all = acts.concat(items);
    return tryRevive(eng, u, all, plan) || tryHeal(eng, u, all, plan) || tryCure(eng, u, all, plan) ||
      tryDispel(eng, u, acts, plan) || tryBuff(eng, u, acts, plan) ||
      (plan.thrift && !plan.danger ? glimCast(eng, u, acts, plan) : null) || offense(eng, u, acts, plan);
  }
  function newPlan() { return { heal: new Map(), revive: new Set(), dmg: new Map(), cured: new Set(), buffed: new Set(), dispelled: new Set(), items: {}, perRound: 0 }; }
  function assess(eng, plan) {
    const party = eng.living('party'), foes = eng.living('mon');
    const hp = party.reduce((s, p) => s + p.hp, 0), mhp = eng.party.reduce((s, p) => s + p.mhp, 0);
    let perRound = 0;
    for (const p of party) {
      if (!p.commandable()) continue;
      let best = 0;
      for (const m of foes) best = Math.max(best, bestAttack(eng, p, m).d);
      perRound += best;
    }
    plan.perRound = perRound;
    const foeHp = foes.reduce((s, m) => s + m.hp, 0);
    const down = eng.party.some((p) => !p.alive);
    plan.danger = !eng.boss && (down || (mhp ? hp / mhp : 1) < 0.5);
    plan.trivial = !eng.boss && !plan.danger && foeHp <= perRound * 2 && party.every((p) => p.hpRate() >= 0.5);
  }
  /** 味方全員の命令（番号ごと、中の形）。opts: {items: true|'auto'|false, thrift} */
  function partyCommands(eng, opts) {
    opts = opts || AUTO_OPTS;
    const plan = newPlan();
    plan.thrift = !!opts.thrift;
    if (opts.healAt) plan.healAt = opts.healAt;
    assess(eng, plan);
    const cmds = [];
    for (const u of eng.party) if (u.commandable()) cmds[u.idx] = partyAction(eng, u, plan, opts);
    return cmds;
  }

  // ------------------------------------------------------------ sim の 3 本立て（WORLD_REDESIGN §4.10 の 6）
  /** 「たたかう」だけ: 全員が集中の相手へ通常攻撃（届かない人は防御） */
  function fightOnly(eng) {
    const plan = newPlan();
    const cmds = [];
    for (const u of eng.party) {
      if (!u.commandable()) continue;
      if (!eng.canReach(u)) { cmds[u.idx] = { type: 'defend' }; continue; }
      cmds[u.idx] = { type: 'attack', target: focusTarget(eng, u, plan) };
    }
    return cmds;
  }
  /**
   * 「リピート」だけ: 1 ラウンド目に強い技をそろえ（回復も予告への対処もしない）、あとは前のラウンドの命令を繰り返す
   * （eng.repeatCommands。MP が尽きた人は攻撃に落ちる）
   */
  function repeatOnly(eng, round, mem) {
    if (round === 1 || !mem.last) {
      const plan = newPlan();
      assess(eng, plan);
      const cmds = [];
      for (const u of eng.party) if (u.commandable()) cmds[u.idx] = offense(eng, u, abilityOptions(eng, u), plan);
      mem.last = cmds;
      return cmds;
    }
    const cmds = eng.repeatCommands(mem.last);
    for (const u of eng.party) if (cmds[u.idx]) mem.last[u.idx] = cmds[u.idx];
    return cmds;
  }
  /** 予告（予約）している魔物と、その答え（bossActions[from].telegraph.guard） */
  function pendingTelegraphs(eng) {
    const out = [];
    for (const m of eng.living('mon')) {
      if (!m.reserved) continue;
      const src = ACT(m.reserved.from);
      const T = src && src.telegraph;
      out.push({ m, guard: (T && T.guard) || 'defend', next: m.reserved.id, cancel: m.reserved.cancel });
    }
    return out;
  }
  /**
   * 正しく対処する台本: 予告を見たら答え（guard: 'defend' = 全員守る／'back' = 前列の人が守る／'element:<e>' = その属性で打つ、
   * 無ければ守る）、群れの頭を先に、根を火で、HP が半分を切ったら回復（道具も使う）。ほかは sim の AI（thrift なし）
   */
  function scripted(eng) {
    const plan = newPlan();
    plan.healAt = 0.5;
    assess(eng, plan);
    const tele = pendingTelegraphs(eng);
    const cmds = [];
    const guardFor = (u) => {
      for (const t of tele) {
        const g = t.guard;
        if (g === 'defend') return true;
        if (g === 'back' && eng.effRow(u) === 'front') return true;
      }
      return false;
    };
    // 属性で予告を消せるなら、その属性の術・技を持つ人が 1 人打つ
    let elemDone = new Set();
    for (const u of eng.party) {
      if (!u.commandable()) continue;
      const acts = abilityOptions(eng, u);
      const items = itemOptions(eng, u, plan, true, acts);
      const all = acts.concat(items);
      // 1. 倒れた人・危ない人
      const rev = tryRevive(eng, u, all, plan);
      if (rev) { cmds[u.idx] = rev; continue; }
      const heal = tryHeal(eng, u, all, plan);
      if (heal) { cmds[u.idx] = heal; continue; }
      const cure = tryCure(eng, u, all, plan);
      if (cure) { cmds[u.idx] = cure; continue; }
      // 2. 予告への答え
      let done = false;
      for (const t of tele) {
        const m = /^element:(\w+)$/.exec(t.guard || '');
        if (!m || elemDone.has(t.m)) continue;
        const o = acts.find((x) => dmgOf(x.ab) && FOE_TARGETS[x.ab.target] && ((x.ab.elements || []).includes(m[1]) || dmgOf(x.ab).element === m[1]));
        if (o) { cmds[u.idx] = cmdOf(o, t.m); elemDone.add(t.m); done = true; break; }
      }
      if (done) continue;
      if (tele.length && (guardFor(u) || tele.some((t) => /^element:/.test(t.guard) && !elemDone.has(t.m)))) { cmds[u.idx] = { type: 'defend' }; continue; }
      // 3. 考えどころの相手（群れの頭・火に弱い根）
      const leader = eng.living('mon').find((m) => m.d.leader);
      const burnable = eng.living('mon').find((m) => m.d.onBurn || m.d.onKilledBy);
      if (burnable && !(eng.flags[(burnable.d.onBurn || burnable.d.onKilledBy).flag])) {
        const el = (burnable.d.onBurn || burnable.d.onKilledBy).element;
        const o = acts.find((x) => dmgOf(x.ab) && FOE_TARGETS[x.ab.target] && ((x.ab.elements || []).includes(el) || dmgOf(x.ab).element === el));
        if (o) { cmds[u.idx] = cmdOf(o, burnable); continue; }
      }
      if (leader) {
        const o = offense(eng, u, acts.filter((x) => x.ab.target === 'enemy'), plan);
        cmds[u.idx] = o.type === 'defend' ? o : Object.assign({}, o, { target: leader });
        continue;
      }
      cmds[u.idx] = tryBuff(eng, u, acts, plan) || offense(eng, u, acts, plan);
    }
    return cmds;
  }
  /** sim の台本: style 'fight' | 'repeat' | 'script' | 'ai' → (eng, round) → cmds */
  function styleAI(style) {
    const mem = {};
    if (style === 'fight') return (eng) => fightOnly(eng);
    if (style === 'repeat') return (eng, round) => repeatOnly(eng, round, mem);
    if (style === 'script') return (eng) => scripted(eng);
    return (eng) => partyCommands(eng, { thrift: true, items: 'auto' });
  }

  // ------------------------------------------------------------ 契約の形（B と uid）
  const outCmd = (c) => {
    if (!c) return null;
    const cmd = c.type === 'tech' ? 'skill' : c.type === 'ability' ? 'enemy' : c.type;
    return { cmd, id: c.id || null, target: c.target ? c.target.uid : null };
  };
  /** 敵の命令（契約）。B.engine が Engine */
  function enemyCommand(B, uid) {
    const eng = B && B.engine;
    const u = eng && eng.mons.find((m) => m.uid === uid);
    if (!u) return null;
    eng.use();
    return outCmd(u.reserved ? { type: 'ability', id: u.reserved.id } : monster(eng, u));
  }
  /** 味方の命令（契約）。style: 'fight' | 'repeat' | 'script'（sim と tools だけ。A26） */
  function partyCommand(B, uid, style) {
    const eng = B && B.engine;
    const u = eng && eng.party.find((p) => p.uid === uid);
    if (!u) return null;
    eng.use();
    const mem = (B._aiMem = B._aiMem || {});
    const cmds = style === 'fight' ? fightOnly(eng) : style === 'repeat' ? repeatOnly(eng, eng.round + 1, mem) : style === 'script' ? scripted(eng) : partyCommands(eng);
    return outCmd(cmds[u.idx] || { type: 'defend' });
  }

  R.BattleAI = Object.assign(R.BattleAI || {}, {
    AUTO_OPTS, monster, monCommand, condOk, monUsable, pickPartyTarget,
    partyCommands, partyAction, abilityOptions, itemOptions, newPlan, assess, threat,
    focusOrder, focusTarget, assignTarget, bestAttack, glimCast, candidatesOpen, careOf, FOCUS_COVER, HEAL_RESERVE,
    fightOnly, repeatOnly, scripted, styleAI, pendingTelegraphs, enemyCommand, partyCommand,
  });
})(window.RPG);
