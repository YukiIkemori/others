// Battle AI (DESIGN §3.3.9, §4.5.3, §4.13.2, §6.2.7, §9.1.7): monster action choice (weights + conds, row-weighted
// targets) and the party AI used by オート battles and by R.Battle.simulate. Pure logic, no DOM. Owner: battle (A2).
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;

  const FOE_TARGETS = { enemy: 1, enemies: 1, group: 1, random: 1 };
  const ALLY_TARGETS = { ally: 1, allies: 1, self: 1, ally_any: 1, ally_other: 1, party: 1 };
  const SINGLE_ALLY = { ally: 1, ally_any: 1, ally_other: 1 };
  const DISABLING = ['sleep', 'paralyze', 'freeze', 'confuse'];
  const GOOD = ['regen', 'veil', 'counter', 'nimble', 'cover'];
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const AUTO_OPTS = Object.freeze({ thrift: true, items: 'auto' }); // the in-game オート (battle_scene uses the same)
  const has = (act, type) => !!(act && act.effects && act.effects.some((e) => e.type === type));
  const effOf = (act, type) => act && act.effects && act.effects.find((e) => e.type === type);
  const dmgOf = (act) => act && act.effects && act.effects.find((e) => e.type === 'damage' && !e.on);
  const rowK = () => {
    const k = R.Rules && R.Rules.K && R.Rules.K.ROW;
    return {
      weight: (k && k.weight) || { front: 2, middle: 1 },
      aimMiddle: (k && k.aimMiddle) || { front: 1, middle: 3 },
    };
  };
  const isMagicAct = (a) => (R.Battle && R.Battle.isMagicAct ? R.Battle.isMagicAct(a) : !!(a && a.magic));

  // --------------------------------------------------------------- monsters
  /** §9.1.7 action conditions (every key of the object must hold) */
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
    return true;
  }
  function monUsable(eng, u, id) {
    if (id === 'attack' || id === 'defend' || id === 'wait' || id === 'flee') return true;
    const a = DB.actions[id];
    if (!a) return false;
    if (isMagicAct(a) && u.status.silence) return false;
    return true;
  }
  /**
   * Party member a single-target monster action goes for (§4.5.3): front row 2 : middle row 1 (effective rows —
   * nobody alive in front = everyone counts as front); aim 'middle' 1 : 3, aim 'low' the lowest HP %.
   */
  function pickPartyTarget(eng, aim) {
    const l = eng.living('party');
    if (!l.length) return null;
    if (aim === 'low') return l.slice().sort((a, b) => a.hpRate() - b.hpRate() || a.idx - b.idx)[0];
    const K = rowK();
    const W = aim === 'middle' ? K.aimMiddle : K.weight;
    return U.weighted(l.map((p) => ({ p, w: W[eng.effRow(p)] || 1 }))).p;
  }
  function monCommand(eng, u, id) {
    if (id === 'attack') return { type: 'attack', target: pickPartyTarget(eng) };
    if (id === 'defend' || id === 'wait') return { type: id };
    if (id === 'flee') return u.boss ? null : { type: 'flee' };
    const a = DB.actions[id];
    if (!a) return null;
    const mons = eng.living(u.side);
    const heal = has(a, 'heal');
    const buff = effOf(a, 'buff');
    const st = effOf(a, 'status');
    const goodSt = st && GOOD.includes(st.status) ? st.status : null;
    const sm = effOf(a, 'summon');
    if (sm && mons.length >= Math.min(8, sm.max != null ? sm.max : 8)) return null; // nobody would come
    switch (a.target) {
      case 'enemy': case 'group':
        return { type: 'ability', id, target: pickPartyTarget(eng, a.aim) };
      case 'enemies': case 'random':
        return { type: 'ability', id, target: null };
      case 'self':
        if (sm) return { type: 'ability', id, target: u };
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
  /** choose a monster's action at the moment it acts (weights w among the actions whose cond holds, §9.1.7) */
  function monster(eng, u) {
    const src = u.d.actions && u.d.actions.length ? u.d.actions : [{ id: 'attack', w: 1 }];
    let list = src.filter((a) => (a.w == null || a.w > 0) && condOk(eng, u, a) && monUsable(eng, u, a.id))
      .map((a) => (a.w == null ? Object.assign({ w: 1 }, a) : a));
    while (list.length) {
      const a = U.weighted(list);
      const cmd = monCommand(eng, u, a.id);
      if (cmd && (cmd.type !== 'attack' || cmd.target)) return cmd;
      list = list.filter((x) => x !== a);
    }
    return { type: 'attack', target: pickPartyTarget(eng) };
  }

  // ------------------------------------------------------------------ party
  const wItem = (W) => (R.Battle && R.Battle.weaponItem ? R.Battle.weaponItem(W) : (W && W.id && DB.items[W.id]) || {});
  function techIds(c, wtype) {
    if (R.Rules && R.Rules.techList) { try { const l = R.Rules.techList(c, wtype); if (l) return l; } catch (e) { /* fallback */ } }
    return (c.techs || []).filter((id) => DB.actions[id] && DB.actions[id].wtype === wtype);
  }
  function spellIds(c) {
    if (R.Rules && R.Rules.spellList) { try { const l = R.Rules.spellList(c); if (l) return l; } catch (e) { /* fallback */ } }
    return (c.spells || []).filter((id) => DB.actions[id] && DB.actions[id].kind === 'spell');
  }
  /**
   * battle-usable techs (of the equipped weapon types, per slot) and spells of u (noAuto excluded, §6.2.7).
   * → [{id, ab, type:'tech'|'spell', slot, wp, mp, cost}]
   */
  function abilityOptions(eng, u) {
    const out = [];
    const c = u.c;
    const seen = new Set();
    for (const slot of u.attackSlots()) {
      const W = u.weapon(slot);
      if (!W || wItem(W).sealTech) continue;
      for (const id of techIds(c, W.wtype)) {
        const a = DB.actions[id];
        if (!a || a.kind !== 'tech' || a.noAuto) continue;
        if (eng.unusable(u, id, slot)) continue;
        const key = id + '|' + slot;
        if (seen.has(key)) continue;
        seen.add(key);
        const wp = eng.wpCost(u, id);
        out.push({ id, ab: a, type: 'tech', slot, wp, mp: 0, cost: wp });
      }
    }
    if (!u.mods.noSpell) {
      for (const id of spellIds(c)) {
        const a = DB.actions[id];
        if (!a || a.kind !== 'spell' || a.noAuto) continue;
        if (eng.unusable(u, id)) continue;
        const mp = eng.mpCost(u, id);
        out.push({ id, ab: a, type: 'spell', slot: undefined, wp: 0, mp, cost: mp });
      }
    }
    return out;
  }
  /** fraction of u's own pools an option spends (WP/max WP + MP/max MP) */
  const spend = (u, o) => (o.wp ? o.wp / Math.max(1, u.mwp) : 0) + (o.mp ? o.mp / Math.max(1, u.mmp) : 0);
  /** the pool an option draws from is below 30 % (雑魚戦では使わない, §4.13.2) */
  const lowPool = (u, o) => (o.wp && u.wp < u.mwp * 0.3) || (o.mp && u.mp < u.mmp * 0.3);
  const rareItem = (it) => !!(it && (it.grade === 'rare' || it.grade === 'super' || it.rare));
  /**
   * consumables the AI may use for u. mode true: any but rare / 魔石 (simulator); 'auto' (in-game オート): revive items when
   * nobody alive can cast a revive, healing items when u has no healing action, cure items when nobody can cure it
   */
  function itemOptions(eng, u, plan, mode, acts) {
    const out = [];
    if (!mode) return out;
    let partyRevive = false, partyCure = new Set();
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
      if (!it || it.type !== 'consumable' || !it.use || !it.use.battle || rareItem(it) || it.stone) continue;
      if (eng.count(id) - (plan.items[id] || 0) <= 0) continue;
      if (eng.unusable(u, id)) continue;
      if (mode === 'auto') {
        const rev = has(it.use, 'revive'), heal = has(it.use, 'heal'), cure = effOf(it.use, 'cure');
        const ok = (rev && !partyRevive) || (heal && !rev && !selfHeal) || (cure && !heal && !rev && (cure.statuses === 'all' || cure.statuses.some((s) => !partyCure.has(s))));
        if (!ok) continue;
      }
      out.push({ id, ab: it.use, type: 'item', cost: 0, wp: 0, mp: 0, item: it });
    }
    return out;
  }
  const cmdOf = (o, target) => (o.item ? { type: 'item', id: o.id, target } : o.type === 'tech' ? { type: 'tech', id: o.id, slot: o.slot, target } : { type: 'spell', id: o.id, target });
  function reserve(plan, o) { if (o.item) plan.items[o.id] = (plan.items[o.id] || 0) + 1; }

  /** u's best plain attack on m over the weapon slots that reach → {slot, d} (d 0 when nothing reaches) */
  function bestAttack(eng, u, m) {
    let best = { slot: undefined, d: 0, reach: false };
    for (const slot of u.attackSlots()) {
      if (!eng.canReach(u, slot)) continue;
      const d = m ? eng.expectAttack(u, m, slot) : 0;
      if (!best.reach || d > best.d) best = { slot, d, reach: true };
    }
    return best;
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

  function tryHeal(eng, u, acts, plan) {
    const mates = eng.living('party');
    const after = (p) => (p.hp + (plan.heal.get(p) || 0)) / p.mhp;
    const limit = eng.boss ? 0.55 : 0.4;
    const hurt = mates.filter((p) => after(p) < limit).sort((a, b) => after(a) - after(b));
    if (!hurt.length) return null;
    const many = mates.filter((p) => after(p) < 0.65).length >= 2;
    let best = null, bestScore = 0, bestTargets = null;
    for (const o of acts) {
      if (!has(o.ab, 'heal') || !ALLY_TARGETS[o.ab.target] || has(o.ab, 'damage')) continue;
      if (o.item && hurt[0].hpRate() >= 0.25) continue; // 回復の道具: only for someone below 25 %
      if (o.ab.target === 'self' && hurt[0] !== u) continue;
      const other = hurt.find((p) => p !== u);
      if (o.ab.target === 'ally_other' && !other) continue;
      const all = o.ab.target === 'allies' || o.ab.target === 'party';
      const targets = all ? mates : [o.ab.target === 'self' ? u : o.ab.target === 'ally_other' ? other : hurt[0]];
      let gain = 0;
      for (const t of targets) gain += Math.min(eng.expectHeal(u, o.ab, t, o.item), Math.max(0, t.mhp - t.hp - (plan.heal.get(t) || 0)) / t.mhp * t.mhp);
      // score in "fractions of a member's max HP" so spells and items of any tier compare
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

  /** strip a boss's buffs (守備力 / 術防 up, strong 攻撃力 / 術力) with an enemy-targeted dispel */
  function tryDispel(eng, u, acts, plan) {
    if (!eng.boss) return null;
    const t = eng.living('mon').find((m) => m.boss && (m.buffs.def > 0 || m.buffs.mdef > 0 || m.buffs.atk > 1 || m.buffs.mag > 1) && !plan.dispelled.has(m));
    if (!t) return null;
    const o = acts.filter((x) => !x.item && has(x.ab, 'dispel') && FOE_TARGETS[x.ab.target]).sort((a, b) => spend(u, a) - spend(u, b))[0];
    if (!o) return null;
    plan.dispelled.add(t);
    return cmdOf(o, t);
  }

  /** 4. 強化・弱体 (§4.13.2, §6.2.7): boss fights, rounds 1–4, 40 %; かばう when an ally is below 50 % */
  function tryBuff(eng, u, acts, plan) {
    if (!eng.boss) return null;
    const cover = acts.find((o) => !o.item && has(o.ab, 'cover'));
    if (cover && !plan.buffed.has('cover') && eng.living('party').some((p) => p !== u && p.hpRate() < 0.5) && u.hpRate() > 0.6) { plan.buffed.add('cover'); return cmdOf(cover, u); }
    if (eng.round > 4 || U.r() > 0.4) return null;
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

  // ------------------------------------------------------------ focus fire (Part A5, §4.13.2-a)
  /** rough damage per round monster m deals to the party */
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
    if (!m.canAct()) t *= 0.3;
    else if (m.status.confuse) t *= 0.5;
    return t;
  }
  const FOCUS_COVER = 0.85;
  /** living foes, best focus target first: threat ÷ HP still to deal (damage planned this round subtracted) */
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
  /**
   * u's share of the focus fire: the members still to plan are split over the foes in focus order — each target gets
   * the cheapest set of attackers whose expected damage reaches 85 % of its HP; a target nobody can finish takes everyone
   */
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
  /** the focus target for u's plain attack (records the expected damage in plan) */
  function focusTarget(eng, u, plan) {
    const t = focusOrder(eng, plan)[0] || null;
    if (t && plan) plan.dmg.set(t, (plan.dmg.get(t) || 0) + bestAttack(eng, u, t).d);
    return t;
  }

  // ------------------------------------------------------------ glimmer aiming (§4.13.2-d)
  function glimCtx(eng, u, kind, extra) {
    return Object.assign({ kind, rankB: eng.rankB, ef: eng.ef, tier: eng.glimTier, row: eng.effRow(u), silenced: !!u.status.silence }, extra);
  }
  /** are there glimmer candidates for u with ctx (R.Glimmer.candidates, else a rank-only estimate) */
  function candidatesOpen(eng, u, ctx) {
    if (R.Glimmer && R.Glimmer.candidates) {
      try { const l = R.Glimmer.candidates(u.c, ctx); return !!(l && l.length); } catch (e) { return false; }
    }
    const c = u.c;
    const known = new Set((c.techs || []).concat(c.spells || []));
    for (const id in DB.actions) {
      const a = DB.actions[id];
      if (!a || known.has(id) || !a.glim || a.glim.lv > eng.rankB) continue;
      if (ctx.kind === 'tech' && a.kind === 'tech' && a.wtype === ctx.wtype && !(ctx.row === 'middle' && !a.reach)) return true;
      if (ctx.kind === 'spell' && a.kind === 'spell' && (a.elements || []).some((e) => ctx.elements.includes(e))) return true;
    }
    return false;
  }
  /** a weapon slot of u whose type still has techs to glimmer (the 攻撃 of that slot is preferred in 雑魚戦) */
  function glimSlot(eng, u) {
    for (const slot of u.attackSlots()) {
      const W = u.weapon(slot);
      if (!W || wItem(W).sealTech || !eng.canReach(u, slot)) continue;
      if (candidatesOpen(eng, u, glimCtx(eng, u, 'tech', { wtype: W.wtype, used: 'attack' }))) return slot;
    }
    return undefined;
  }
  /**
   * (d) 閃きねらい: once per battle, a member with ≥ 50 % MP casts the cheapest useful spell of an element whose
   * glimmer candidates are open; when no element is open (early tiers: nothing within reach yet), the cheapest useful
   * spell of any element still goes once — it grows that element's proficiency, which opens candidates (§4.0 0.23,
   * §4.17.3 A3: オートの術師は 1 戦に 0.75 回以上唱える). → command | null
   */
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
      if (!mine.length) continue;
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
          target = SINGLE_ALLY[a.target] ? u : u;
          useful = b ? eng.living('party').some((p) => p.buffs[b.stat] < 2) : true;
        }
        if (!useful) continue;
        // an open element first, then the cheapest, offensive on a tie
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

  // ------------------------------------------------------------ offense (§4.13.2-5)
  function offense(eng, u, acts, plan) {
    const foes = eng.living('mon');
    if (!foes.length) return { type: 'defend' };
    const left = (m) => Math.max(0, m.hp - (plan.dmg.get(m) || 0));
    const open = foes.filter((m) => left(m) > 0);
    const pool = open.length ? open : foes;
    const value = (d, m) => { const l = left(m) || m.hp; return Math.min(d, l) * (d >= l ? 1.35 : 1); };
    const focus = assignTarget(eng, u, plan);
    const single = (d, m) => (m === focus ? value(d, m) : d >= left(m) && left(m) > 0 ? value(d, m) * 0.9 : -1);
    // the plain attack on the focus target (the 雑魚戦 prefers the slot whose techs can still be glimmered)
    let ba = bestAttack(eng, u, focus);
    if (!eng.boss && ba.reach) {
      const gs = glimSlot(eng, u);
      if (gs !== undefined && gs !== ba.slot) { const d = eng.expectAttack(u, focus, gs); if (d > 0) ba = { slot: gs, d, reach: true }; }
    }
    let best = ba.reach ? { score: value(ba.d, focus), cmd: { type: 'attack', slot: ba.slot, target: focus }, hits: [[focus, ba.d]] }
      : { score: 0, cmd: { type: 'defend' }, hits: [] };
    const v0 = Math.max(1, best.score);
    const totalLeft = pool.reduce((s, m) => s + left(m), 0);
    const perRound = Math.max(1, plan.perRound || v0);
    // 雑魚戦: WP / MP only for a skill that kills 2+ or ends the fight a round earlier, never when attacks finish it
    const mobGate = (v, kills) => {
      if (totalLeft <= perRound) return false;
      if (kills >= 2) return true;
      const now = Math.ceil(totalLeft / perRound);
      const withIt = Math.ceil(Math.max(0, totalLeft - (v - v0)) / perRound);
      return withIt < now;
    };
    const healer = acts.some((o) => o.type === 'spell' && has(o.ab, 'heal') && ALLY_TARGETS[o.ab.target]);
    const healCost = healer ? Math.min(...acts.filter((o) => o.type === 'spell' && has(o.ab, 'heal') && ALLY_TARGETS[o.ab.target]).map((o) => o.mp)) : 0;
    for (const o of acts) {
      if (o.item) continue;
      const de = dmgOf(o.ab);
      if (!de || !FOE_TARGETS[o.ab.target]) continue;
      if (!eng.boss) {
        if (plan.thrift && lowPool(u, o)) continue;
        if (de.formula === 'percent') continue;
      } else if (healer && o.mp && u.mp - o.mp < healCost && !has(o.ab, 'heal')) continue; // keep one heal
      const t0 = o.ab.target;
      const cands = t0 === 'enemy' || t0 === 'group' ? pool : [pool[0]];
      for (const m of cands) {
        const targets = t0 === 'enemy' ? [m] : t0 === 'group' ? pool.filter((x) => x.species === m.species) : pool;
        let v = 0, kills = 0;
        const hits = [];
        for (const t of targets) {
          let d = eng.expectDamage(u, o.ab, t, { slot: o.slot });
          if (t0 === 'random') d = (d * eng.hitCountMean(de)) / targets.length;
          const sv = t0 === 'enemy' ? single(d, t) : value(d, t);
          if (sv < 0) { v = -1; break; }
          v += sv;
          if (d >= left(t) && left(t) > 0) kills++;
          hits.push([t, d]);
        }
        if (v <= 0) continue;
        if (!eng.boss && plan.thrift && !mobGate(v, kills)) continue;
        const pen = spend(u, o) * v0 * (eng.boss ? 0.4 : plan.thrift ? 2.5 : 1.2);
        const hpCost = o.ab.effects.reduce((mx, e) => Math.max(mx, e.hpCost || 0), 0) * u.mhp;
        const score = v - pen - hpCost * (u.hpRate() < 0.5 ? 2 : 0.5);
        if (score > best.score * 1.1 || (best.cmd.type === 'defend' && score > 0)) best = { score, cmd: cmdOf(o, m), hits };
      }
    }
    for (const [t, d] of best.hits) plan.dmg.set(t, (plan.dmg.get(t) || 0) + d);
    if (best.cmd.type !== 'attack' && best.cmd.type !== 'defend') plan.skillsUsed = (plan.skillsUsed || 0) + 1;
    return best.cmd;
  }

  /** one party member's action for this round (plan is shared by the whole party) */
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
  /**
   * How the fight looks: perRound = the party's plain-attack damage per round; trivial = attacks finish it in about
   * two rounds and nobody is hurt; danger = party HP below half (or someone down) in a non-boss fight.
   */
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
  /**
   * commands for every commandable party member (array by party index).
   * opts: {items: true|'auto'|false, thrift: bool (in-game オート: conserve WP / MP in ordinary fights)}
   */
  function partyCommands(eng, opts) {
    opts = opts || AUTO_OPTS;
    const plan = newPlan();
    plan.thrift = !!opts.thrift;
    assess(eng, plan);
    const cmds = [];
    for (const u of eng.party) if (u.commandable()) cmds[u.idx] = partyAction(eng, u, plan, opts);
    return cmds;
  }

  R.BattleAI = {
    AUTO_OPTS, monster, monCommand, condOk, monUsable, pickPartyTarget,
    partyCommands, partyAction, abilityOptions, itemOptions, newPlan, assess, threat,
    focusOrder, focusTarget, assignTarget, bestAttack, glimCast, glimSlot, candidatesOpen, FOCUS_COVER,
  };
})(window.RPG);
