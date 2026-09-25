// Battle AI: monster action choice (weights + conds, DESIGN §5.6) and the
// party AI used by オート battles and by R.Battle.simulate. Pure logic.
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;

  const FOE_TARGETS = { enemy: 1, enemies: 1, group: 1, random: 1 };
  const ALLY_TARGETS = { ally: 1, allies: 1, self: 1, ally_any: 1, ally_other: 1 };
  const DISABLING = ['paralyze', 'sleep', 'confuse'];
  const has = (act, type) => !!(act && act.effects && act.effects.some((e) => e.type === type));
  const effOf = (act, type) => act.effects.find((e) => e.type === type);

  // --------------------------------------------------------------- monsters
  function condOk(eng, u, a) {
    const c = a.cond;
    if (!c) return true;
    if (c.hpBelow != null && !(u.hpRate() < c.hpBelow)) return false;
    if (c.hpAbove != null && !(u.hpRate() > c.hpAbove)) return false;
    if (c.every) { const n = Math.max(1, c.every[0] | 0); if (u.acts % n !== ((c.every[1] | 0) % n)) return false; }
    if (c.once && u.used[a.id]) return false;
    if (c.round != null && eng.round < c.round) return false;
    if (c.alone && eng.living('mon').length > 1) return false;
    return true;
  }
  function monUsable(u, id) {
    if (id === 'attack' || id === 'defend' || id === 'wait' || id === 'flee') return true;
    const ab = DB.abilities[id];
    if (!ab || ab.kind !== 'action') return false;
    if (ab.magic && u.status.silence) return false;
    if (ab.oncePerBattle && u.used && u.used[id]) return false;
    return (ab.mp || 0) <= u.mp;
  }
  /**
   * Party member a single-target monster attack goes for. Formation matters:
   * the 1st/2nd/3rd LIVING members in line are picked 50% / 30% / 20% of the time
   * (with two left: 5:3, i.e. the same ratio). Group/random attacks are unaffected.
   */
  const LINE_WEIGHTS = [5, 3, 2];
  function pickPartyTarget(eng) {
    const l = eng.living('party').slice().sort((a, b) => a.idx - b.idx);
    if (!l.length) return null;
    return U.weighted(l.map((p, i) => ({ p, w: LINE_WEIGHTS[i] || 1 }))).p;
  }
  function monCommand(eng, u, id) {
    if (id === 'attack') return { type: 'attack', target: pickPartyTarget(eng) };
    if (id === 'defend' || id === 'wait' || id === 'flee') return u.boss && id === 'flee' ? null : { type: id };
    const ab = DB.abilities[id];
    const mons = eng.living('mon');
    const heal = has(ab, 'heal');
    switch (ab.target) {
      case 'enemy': case 'enemies': case 'group': case 'random':
        return { type: 'ability', id, target: pickPartyTarget(eng) };
      case 'self':
        if (heal && u.hpRate() > 0.6) return null;
        return { type: 'ability', id, target: u };
      case 'ally': case 'ally_any': case 'ally_other': {
        const pool = ab.target === 'ally_other' ? mons.filter((m) => m !== u) : mons;
        if (!pool.length) return null;
        if (heal) {
          const t = pool.filter((m) => m.hpRate() < 0.6).sort((a, b) => a.hpRate() - b.hpRate())[0];
          return t ? { type: 'ability', id, target: t } : null;
        }
        const b = has(ab, 'buff') && effOf(ab, 'buff');
        const cand = b ? pool.filter((m) => m.buffs[b.stat] < 2) : pool;
        return cand.length ? { type: 'ability', id, target: U.pick(cand) } : null;
      }
      case 'allies':
        if (heal && !mons.some((m) => m.hpRate() < 0.7)) return null;
        return { type: 'ability', id, target: u };
      case 'ally_dead': {
        const t = eng.mons.find((m) => !m.alive && !m.gone);
        return t ? { type: 'ability', id, target: t } : null;
      }
    }
    return { type: 'ability', id, target: pickPartyTarget(eng) };
  }
  /** choose a monster's action at the moment it acts */
  function monster(eng, u) {
    const src = u.d.actions && u.d.actions.length ? u.d.actions : [{ id: 'attack', w: 1 }];
    let list = src.filter((a) => (a.w == null || a.w > 0) && condOk(eng, u, a) && monUsable(u, a.id))
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
  /** battle-usable action abilities of u (current job + sub job) */
  function abilityOptions(eng, u) {
    const out = [];
    const c = u.c;
    for (const job of [c.job, c.set && c.set.sub]) {
      if (!job || !DB.jobs[job]) continue;
      for (const id of R.Rules.actionList(c, job)) {
        if (eng.unusable(u, id)) continue;
        const ab = DB.abilities[id];
        out.push({ id, ab, cost: eng.mpCost(u, id, ab) });
      }
    }
    return out;
  }
  /**
   * consumables the AI may use. mode true: any (simulator); 'auto' (in-game オート): only
   * revive items when no living member can cast a revive, and healing items when nobody
   * has the MP for a healing spell — the player's stock is not burnt on routine fights.
   */
  function itemOptions(eng, plan, mode) {
    const out = [];
    let canRevive = false, canHeal = false;
    if (mode === 'auto') {
      for (const p of eng.party) {
        if (!p.commandable()) continue;
        for (const o of abilityOptions(eng, p)) {
          if (has(o.ab, 'revive')) canRevive = true;
          if (has(o.ab, 'heal') && ALLY_TARGETS[o.ab.target]) canHeal = true;
        }
      }
    }
    for (const id in eng.inv) {
      const it = DB.items[id];
      if (!it || it.type !== 'consumable' || !it.use || !it.use.battle || it.rare) continue;
      if (eng.count(id) - (plan.items[id] || 0) <= 0) continue;
      if (mode === 'auto') {
        const rev = has(it.use, 'revive'), heal = has(it.use, 'heal');
        if (!(rev && !canRevive) && !(heal && !rev && !canHeal)) continue;
      }
      out.push({ id, ab: it.use, cost: 0, item: it });
    }
    return out;
  }
  const cmdOf = (o, target) => (o.item ? { type: 'item', id: o.id, target } : { type: 'ability', id: o.id, target });
  function reserve(plan, o) { if (o.item) plan.items[o.id] = (plan.items[o.id] || 0) + 1; }

  function tryRevive(eng, u, acts, plan) {
    const dead = eng.party.filter((p) => !p.alive && !plan.revive.has(p));
    if (!dead.length) return null;
    const opts = acts.filter((o) => has(o.ab, 'revive') && (o.ab.target === 'ally_dead' || o.ab.target === 'ally_any' || o.ab.target === 'allies'));
    if (!opts.length) return null;
    opts.sort((a, b) => (b.ab.target === 'allies') - (a.ab.target === 'allies') || a.cost - b.cost);
    const o = opts.find((x) => x.ab.target === 'allies' && dead.length > 1) || opts.filter((x) => x.ab.target !== 'allies')[0] || opts[0];
    for (const p of o.ab.target === 'allies' ? dead : [dead[0]]) plan.revive.add(p);
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
      if (!has(o.ab, 'heal') || !ALLY_TARGETS[o.ab.target]) continue;
      if (o.ab.target === 'self' && hurt[0] !== u) continue;
      const other = hurt.find((p) => p !== u);
      if (o.ab.target === 'ally_other' && !other) continue;
      const targets = o.ab.target === 'allies' ? mates : [o.ab.target === 'self' ? u : o.ab.target === 'ally_other' ? other : hurt[0]];
      let gain = 0;
      for (const t of targets) gain += Math.min(eng.expectHeal(u, o.ab, t, o.item), Math.max(0, t.mhp - t.hp - (plan.heal.get(t) || 0)));
      if (o.ab.target === 'allies' && !many) gain *= 0.6;
      const score = gain - o.cost * 1.5 - (o.item ? 4 : 0);
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
      if (p.status.silence && abilityOptions(eng, p).length === 0 && p.mmp > 0) bad.push('silence');
      // poison / blind only matter in a real fight (not while mopping up a trivial group)
      if (!plan.trivial) {
        if (p.status.poison && (eng.boss || p.hpRate() < 0.7)) bad.push('poison');
        if (p.status.blind && (eng.boss || p.stat('atk') >= p.stat('mag'))) bad.push('blind');
      }
      if (!bad.length) continue;
      const o = acts.find((x) => {
        const cu = has(x.ab, 'cure') && effOf(x.ab, 'cure');
        return cu && ALLY_TARGETS[x.ab.target] && x.ab.target !== 'self' && !(x.ab.target === 'ally_other' && p === u) && (cu.statuses === 'all' || bad.some((s) => cu.statuses.includes(s)));
      });
      if (o) { plan.cured.add(p); reserve(plan, o); return cmdOf(o, p); }
    }
    return null;
  }

  /** strip a boss's defensive buffs (守備力 / 魔法防御 up) with an enemy-targeted dispel */
  function tryDispel(eng, u, acts, plan) {
    if (!eng.boss) return null;
    const t = eng.living('mon').find((m) => m.boss && (m.buffs.def > 0 || m.buffs.mdef > 0 || m.buffs.atk > 1 || m.buffs.mag > 1) && !plan.dispelled.has(m));
    if (!t) return null;
    const o = acts.filter((x) => !x.item && has(x.ab, 'dispel') && FOE_TARGETS[x.ab.target]).sort((a, b) => a.cost - b.cost)[0];
    if (!o) return null;
    plan.dispelled.add(t);
    return cmdOf(o, t);
  }

  function tryBuff(eng, u, acts, plan) {
    if (!eng.boss || eng.round > 4 || U.r() > 0.4) return null;
    for (const o of acts) {
      if (o.item || !has(o.ab, 'buff')) continue;
      const b = effOf(o.ab, 'buff');
      if (b.stages > 0 && ALLY_TARGETS[o.ab.target]) {
        const t = o.ab.target === 'self' ? u : eng.living('party').find((p) => p.buffs[b.stat] < 1 && !plan.buffed.has(p.key + b.stat) && !(o.ab.target === 'ally_other' && p === u));
        if (t && t.buffs[b.stat] < 1) { plan.buffed.add(t.key + b.stat); return cmdOf(o, t); }
      }
      if (b.stages < 0 && FOE_TARGETS[o.ab.target]) {
        const t = eng.living('mon').find((m) => m.boss && m.buffs[b.stat] > -1 && !plan.buffed.has(m.key + b.stat));
        if (t) { plan.buffed.add(t.key + b.stat); return cmdOf(o, t); }
      }
    }
    return null;
  }

  // ------------------------------------------------------------ focus fire
  // Playtest 「オートが頭悪い。殴る対象を分散化しすぎてる」: the party concentrates on ONE enemy at
  // a time — the one whose removal helps most per round spent on it: threat (expected damage it
  // deals per round) ÷ rounds the party needs to finish it (so an enemy that dies this round comes
  // first, a hard hitter before a harmless one). Damage the members planned earlier this round is
  // subtracted; once a target is dead-in-expectation the next members move on to the next one.
  /** rough damage per round monster m deals to the party */
  function threat(eng, m) {
    const party = eng.living('party');
    if (!party.length) return 1;
    let phys = 0, mdef = 0;
    for (const p of party) { phys += eng.expectAttack(m, p); mdef += p.stat('mdef'); }
    phys /= party.length; mdef /= party.length;
    const magic = (m.stat('mag') * 0.6 + (m.level || 1)) * (100 / (100 + mdef));
    let t = Math.max(phys, magic, 1) * U.clamp((m.d && m.d.actsPerTurn) || 1, 1, 3);
    if (!m.canAct()) t *= 0.3;
    else if (m.status.confuse) t *= 0.5;
    return t;
  }
  /**
   * a target counts as finished once the expected damage aimed at it reaches 85 % of its HP:
   * expected damage already includes misses, and a 15 % margin keeps a third member from being
   * spent on a sliver (sim: fewer rounds and less damage taken than a full 100 % cover)
   */
  const FOCUS_COVER = 0.85;
  /**
   * living foes, best focus target first. plan (optional): damage already planned this round —
   * foes that are dead-in-expectation go last.
   */
  function focusOrder(eng, plan) {
    const foes = eng.living('mon');
    const left = (m) => Math.max(0, m.hp * FOCUS_COVER - ((plan && plan.dmg.get(m)) || 0));
    const rows = foes.map((m) => {
      const l = left(m);
      // damage it deals per HP the party must still spend on it: low HP and hard hitters first
      const score = threat(eng, m) / Math.max(1, l);
      // dead-in-expectation: last, the least over-covered one first (the likeliest survivor)
      return { m, l, score: l > 0 ? score : -((plan && plan.dmg.get(m)) || 0) / Math.max(1, m.hp) };
    });
    rows.sort((a, b) => b.score - a.score || a.l - b.l || a.m.idx - b.m.idx);
    return rows.map((r) => r.m);
  }
  /**
   * u's share of the party's focus fire this round: the members still to plan (u and everyone after
   * it) are split over the foes in focus order — each target gets the cheapest set of attackers
   * whose expected damage finishes it (a strong hitter is not spent on a 2-HP remnant a weak one
   * can finish), leftovers join the next target; a target nobody can finish this round takes
   * everyone left. → the foe u should attack
   */
  function assignTarget(eng, u, plan) {
    const order = focusOrder(eng, plan);
    if (!order.length) return null;
    let free = eng.party.filter((p) => p.idx >= u.idx && p.commandable() && (p === u || !p.status.confuse));
    if (!free.includes(u)) free.push(u);
    const planned = (m) => (plan && plan.dmg.get(m)) || 0;
    for (const m of order) {
      const need = m.hp * FOCUS_COVER - planned(m);
      if (need <= 0) continue;
      const ds = free.map((p) => eng.expectAttack(p, m));
      const total = ds.reduce((a, b) => a + b, 0);
      if (total < need) return m; // cannot fall this round: all hands on it
      // cheapest covering subset (n ≤ 4 → brute force); ties → fewer attackers
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
    // everything is covered: back up the target most likely to survive
    return order.slice().sort((a, b) => planned(a) / Math.max(1, a.hp) - planned(b) / Math.max(1, b.hp))[0];
  }
  /** the focus target for u's plain attack (records the expected damage in plan) */
  function focusTarget(eng, u, plan) {
    const t = focusOrder(eng, plan)[0] || null;
    if (t && plan) plan.dmg.set(t, (plan.dmg.get(t) || 0) + eng.expectAttack(u, t));
    return t;
  }

  function offense(eng, u, acts, plan) {
    const foes = eng.living('mon');
    if (!foes.length) return { type: 'defend' };
    const left = (m) => Math.max(0, m.hp - (plan.dmg.get(m) || 0));
    const open = foes.filter((m) => left(m) > 0);
    const pool = open.length ? open : foes;
    const value = (d, m) => { const l = left(m) || m.hp; return Math.min(d, l) * (d >= l ? 1.35 : 1); };
    // focus fire: single-target actions go for the focus target; another foe only when the
    // action finishes it outright (a kill is never a wasted spread)
    const focus = assignTarget(eng, u, plan);
    const single = (d, m) => (m === focus ? value(d, m) : d >= left(m) && left(m) > 0 ? value(d, m) * 0.9 : -1);
    // plain attack on the focus target
    const d0 = eng.expectAttack(u, focus);
    let best = { score: value(d0, focus), cmd: { type: 'attack', target: focus }, hits: [[focus, d0]] };
    const attackScore = best.score;
    const total = pool.reduce((s, m) => s + left(m), 0);
    const mpRate = u.mmp ? u.mp / u.mmp : 0;
    // weak foes: keep MP; bosses: spend freely; low MP: be frugal
    const easy = !eng.boss && (total <= Math.max(1, attackScore) * 2.5 || (plan.thrift && plan.trivial));
    let mpWeight = eng.boss ? 0.3 : easy ? Infinity : mpRate < 0.3 ? 4 : 1.2;
    // オート (thrift): ordinary fights are one of many before the next inn — MP is worth a lot,
    // big spells only when the party is in trouble, and a healer keeps its MP for healing
    const healer = plan.thrift && acts.some((o) => !o.item && has(o.ab, 'heal') && ALLY_TARGETS[o.ab.target]);
    if (plan.thrift && !eng.boss && isFinite(mpWeight)) mpWeight = plan.danger ? 1.5 : mpRate < 0.4 ? 8 : 4;
    for (const o of acts) {
      if (!has(o.ab, 'damage') || !FOE_TARGETS[o.ab.target] || o.item) continue;
      if (!isFinite(mpWeight) && o.cost > 0) continue;
      if (plan.thrift && !eng.boss && !plan.danger && o.cost > 0 && (healer || o.cost > Math.max(4, u.mmp * 0.12))) continue;
      const t0 = o.ab.target;
      const cands = t0 === 'enemy' || t0 === 'group' ? pool : [pool[0]];
      for (const m of cands) {
        const targets = t0 === 'enemy' ? [m] : t0 === 'group' ? pool.filter((x) => x.id === m.id) : pool;
        let v = 0;
        const hits = [];
        for (const t of targets) {
          let d = eng.expectDamage(u, o.ab, t);
          if (t0 === 'random') {
            const de = effOf(o.ab, 'damage');
            const n = Array.isArray(de.hits) ? (de.hits[0] + de.hits[1]) / 2 : Math.max(1, de.hits | 0 || 1);
            d = (d * n) / targets.length;
          }
          v += t0 === 'enemy' ? single(d, t) : value(d, t);
          hits.push([t, d]);
        }
        if (v < 0) continue;
        const hpCost = o.ab.effects.reduce((mx, e) => Math.max(mx, e.hpCost || 0), 0) * u.mhp;
        const score = v - o.cost * mpWeight - hpCost * (u.hpRate() < 0.5 ? 2 : 0.5);
        if (score > best.score * 1.1) best = { score, cmd: cmdOf(o, m), hits };
      }
    }
    for (const [t, d] of best.hits) plan.dmg.set(t, (plan.dmg.get(t) || 0) + d);
    return best.cmd;
  }

  /** one party member's action for this round (plan is shared by the whole party) */
  function partyAction(eng, u, plan, opts) {
    const acts = abilityOptions(eng, u);
    if (opts && opts.items) acts.push(...itemOptions(eng, plan, opts.items));
    return tryRevive(eng, u, acts, plan) || tryHeal(eng, u, acts, plan) || tryCure(eng, u, acts, plan) ||
      tryDispel(eng, u, acts, plan) || tryBuff(eng, u, acts, plan) || offense(eng, u, acts, plan);
  }
  function newPlan() { return { heal: new Map(), revive: new Set(), dmg: new Map(), cured: new Set(), buffed: new Set(), dispelled: new Set(), items: {} }; }
  /**
   * How the fight looks for the party: trivial = plain attacks finish it in about two rounds
   * and nobody is hurt; danger = party HP below half (or someone down) in a real fight.
   */
  function assess(eng, plan) {
    const party = eng.living('party'), foes = eng.living('mon');
    const hp = party.reduce((s, p) => s + p.hp, 0), mhp = eng.party.reduce((s, p) => s + p.mhp, 0);
    let perRound = 0;
    for (const p of party) {
      if (!p.commandable()) continue;
      let best = 0;
      for (const m of foes) best = Math.max(best, eng.expectAttack(p, m));
      perRound += best;
    }
    const foeHp = foes.reduce((s, m) => s + m.hp, 0);
    const down = eng.party.some((p) => !p.alive);
    plan.danger = !eng.boss && (down || (mhp ? hp / mhp : 1) < 0.5);
    plan.trivial = !eng.boss && !plan.danger && foeHp <= perRound * 2 && party.every((p) => p.hpRate() >= 0.5);
  }
  /**
   * commands for every commandable party member (array by party index).
   * opts: {items: true|'auto' (consumables allowed; 'auto' = only when no spell can do it),
   *        thrift: bool (in-game オート: conserve MP in ordinary fights)}
   */
  function partyCommands(eng, opts) {
    const plan = newPlan();
    plan.thrift = !!(opts && opts.thrift);
    assess(eng, plan);
    const cmds = [];
    for (const u of eng.party) if (u.commandable()) cmds[u.idx] = partyAction(eng, u, plan, opts || {});
    return cmds;
  }

  R.BattleAI = { monster, monCommand, condOk, partyCommands, partyAction, abilityOptions, itemOptions, newPlan, pickPartyTarget, assess, threat, focusOrder, focusTarget, assignTarget };
})(window.RPG);
