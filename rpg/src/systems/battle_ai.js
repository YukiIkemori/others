// Battle AI: monster action choice (weights + conds, DESIGN §5.6) and the
// party AI used by オート battles and by R.Battle.simulate. Pure logic.
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;

  const FOE_TARGETS = { enemy: 1, enemies: 1, group: 1, random: 1 };
  const ALLY_TARGETS = { ally: 1, allies: 1, self: 1, ally_any: 1 };
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
    return (ab.mp || 0) <= u.mp;
  }
  /** party member a monster attacks: the front of the line is hit a little more often */
  function pickPartyTarget(eng) {
    const l = eng.living('party');
    if (!l.length) return null;
    return U.weighted(l.map((p) => ({ p, w: p.idx === 0 ? 4 : 3 }))).p;
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
      case 'ally': case 'ally_any': {
        if (heal) {
          const t = mons.filter((m) => m.hpRate() < 0.6).sort((a, b) => a.hpRate() - b.hpRate())[0];
          return t ? { type: 'ability', id, target: t } : null;
        }
        const b = has(ab, 'buff') && effOf(ab, 'buff');
        const cand = b ? mons.filter((m) => m.buffs[b.stat] < 2) : mons;
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
  function itemOptions(eng, plan) {
    const out = [];
    for (const id in eng.inv) {
      const it = DB.items[id];
      if (!it || it.type !== 'consumable' || !it.use || !it.use.battle || it.rare) continue;
      if (eng.count(id) - (plan.items[id] || 0) <= 0) continue;
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
      const targets = o.ab.target === 'allies' ? mates : [o.ab.target === 'self' ? u : hurt[0]];
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
      if (!bad.length) continue;
      const o = acts.find((x) => {
        const cu = has(x.ab, 'cure') && effOf(x.ab, 'cure');
        return cu && ALLY_TARGETS[x.ab.target] && x.ab.target !== 'self' && (cu.statuses === 'all' || bad.some((s) => cu.statuses.includes(s)));
      });
      if (o) { plan.cured.add(p); reserve(plan, o); return cmdOf(o, p); }
    }
    return null;
  }

  function tryBuff(eng, u, acts, plan) {
    if (!eng.boss || eng.round > 4 || U.r() > 0.4) return null;
    for (const o of acts) {
      if (o.item || !has(o.ab, 'buff')) continue;
      const b = effOf(o.ab, 'buff');
      if (b.stages > 0 && ALLY_TARGETS[o.ab.target]) {
        const t = o.ab.target === 'self' ? u : eng.living('party').find((p) => p.buffs[b.stat] < 1 && !plan.buffed.has(p.key + b.stat));
        if (t && t.buffs[b.stat] < 1) { plan.buffed.add(t.key + b.stat); return cmdOf(o, t); }
      }
      if (b.stages < 0 && FOE_TARGETS[o.ab.target]) {
        const t = eng.living('mon').find((m) => m.boss && m.buffs[b.stat] > -1 && !plan.buffed.has(m.key + b.stat));
        if (t) { plan.buffed.add(t.key + b.stat); return cmdOf(o, t); }
      }
    }
    return null;
  }

  function offense(eng, u, acts, plan) {
    const foes = eng.living('mon');
    if (!foes.length) return { type: 'defend' };
    const left = (m) => Math.max(0, m.hp - (plan.dmg.get(m) || 0));
    const open = foes.filter((m) => left(m) > 0);
    const pool = open.length ? open : foes;
    const value = (d, m) => { const l = left(m) || m.hp; return Math.min(d, l) * (d >= l ? 1.35 : 1); };
    // plain attack on the best single target
    let best = null;
    for (const m of pool) {
      const d = eng.expectAttack(u, m);
      const s = value(d, m);
      if (!best || s > best.score) best = { score: s, cmd: { type: 'attack', target: m }, hits: [[m, d]] };
    }
    const attackScore = best.score;
    const total = pool.reduce((s, m) => s + left(m), 0);
    const mpRate = u.mmp ? u.mp / u.mmp : 0;
    // weak foes: keep MP; bosses: spend freely; low MP: be frugal
    const easy = !eng.boss && total <= Math.max(1, attackScore) * 2.5;
    const mpWeight = eng.boss ? 0.3 : easy ? Infinity : mpRate < 0.3 ? 4 : 1.2;
    for (const o of acts) {
      if (!has(o.ab, 'damage') || !FOE_TARGETS[o.ab.target] || o.item) continue;
      if (!isFinite(mpWeight) && o.cost > 0) continue;
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
          v += value(d, t);
          hits.push([t, d]);
        }
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
    if (opts && opts.items) acts.push(...itemOptions(eng, plan));
    return tryRevive(eng, u, acts, plan) || tryHeal(eng, u, acts, plan) || tryCure(eng, u, acts, plan) ||
      tryBuff(eng, u, acts, plan) || offense(eng, u, acts, plan);
  }
  function newPlan() { return { heal: new Map(), revive: new Set(), dmg: new Map(), cured: new Set(), buffed: new Set(), items: {} }; }
  /** commands for every commandable party member (array by party index) */
  function partyCommands(eng, opts) {
    const plan = newPlan();
    const cmds = [];
    for (const u of eng.party) if (u.commandable()) cmds[u.idx] = partyAction(eng, u, plan, opts || {});
    return cmds;
  }

  R.BattleAI = { monster, monCommand, condOk, partyCommands, partyAction, abilityOptions, newPlan, pickPartyTarget };
})(window.RPG);
