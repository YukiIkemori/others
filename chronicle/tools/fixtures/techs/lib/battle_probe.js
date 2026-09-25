// Battle probe for area A7 (techs): runs every tech through the real battle engine
// (R.Battle.Engine, owner A2) and checks what DESIGN §6.2–§6.3 says the tech does there —
// the announcement, the WP paid, unusable reasons (reach / silence), quick, the hit counts
// and targets, element, HP cost, drain, the riders after a landed hit (status, debuff, steal,
// dispel), counter stances {slot, power, parry, critBonus} and counters, cover and ×mul
// redirection, heal / healMp pct / cure / own-side buffs, vs multipliers (race, flag, status id),
// noAuto in the party AI.
//
// The engine belongs to another owner and may be mid-rewrite, so callers report the
// results as warnings. Used by `node tools/check_techs.js --battle` and by test_techs.js.
// (Lives in a subdirectory so `build.js --with tools/fixtures/techs` does not load it.)
'use strict';

/**
 * F: a full game load (tools/lib/load). S: fixtures/techs/lib/spec. opts: {trials, seed}
 * → {skipped: reason | null, results: [{ok, id, msg}], techs: n}
 */
function run(F, S, opts) {
  opts = opts || {};
  const TRIALS = opts.trials || 24;
  const B = F.Battle, RU = F.Rules, DB = F.DB, U = F.U;
  if (!B || typeof B.Engine !== 'function' || typeof B.drain !== 'function') return { skipped: 'R.Battle.Engine not available', results: [] };
  if (!RU || !RU.newChar || !RU.fullHeal) return { skipped: 'R.Rules.newChar / fullHeal not available', results: [] };
  if (!DB.companions.selma || !DB.companions.marta) return { skipped: 'companions selma / marta not registered', results: [] };
  const results = [];
  const rec = (ok, id, msg) => { results.push({ ok: !!ok, id, msg }); return !!ok; };
  const savedRng = U.rng;
  U.seed(opts.seed != null ? opts.seed : 7); // reproducible runs (R.U is the only RNG the engine uses, §1.2-7)
  try {
    return runSeeded();
  } finally { U.rng = savedRng; }

  function runSeeded() {
    // ---------------------------------------------------------------- the cast
    const LV = 30, TIER = 4;
    const weaponFor = (w) => Object.entries(DB.items)
      .filter(([, it]) => it && it.type === 'weapon' && it.wtype === w && !it.element && !it.onHit && !it.vs && !it.drain && !it.metalHit && !it.sealTech && (it.grade === 'normal' || !it.grade))
      .sort((a, b) => Math.abs((a[1].tier || 0) - TIER) - Math.abs((b[1].tier || 0) - TIER) || a[0].localeCompare(b[0]))
      .map(([id]) => id)[0] || null;
    const plain = (m) => m && !(m.flags || []).some((f) => f === 'boss' || f === 'rare' || f === 'metal' || f === 'flying') && m.lv && !m.bossType;
    const mons = Object.entries(DB.monsters).filter(([, m]) => plain(m))
      .sort((a, b) => Math.abs(a[1].lv - LV) - Math.abs(b[1].lv - LV) || a[0].localeCompare(b[0]));
    const res0 = (m, s) => !(m.statusRes && m.statusRes[s]);
    const monFor = (s) => {
      const hit = mons.find(([, m]) => (!s || res0(m, s)) && m.drops && m.drops.normal);
      return hit ? hit[0] : null;
    };
    const base = monFor(null);
    if (!base) return { skipped: 'no plain monster (non-boss, non-flying) registered', results: [] };
    const other = (mons.find(([id]) => id !== base) || [base])[0];

    function member(id, w, tech) {
      const c = RU.newChar({ id, level: LV });
      if (w) {
        const wid = weaponFor(w);
        if (!wid) return null;
        c.equip.weapon1 = wid; c.equip.weapon2 = null;
        if (RU.hasTwoHanded && RU.hasTwoHanded(c)) c.equip.shield = null;
      }
      if (tech) c.techs = [tech];
      c.row = 'front';
      c.status = {};
      RU.fullHeal(c);
      return c;
    }
    /** a fresh engine: party [user, ally], monsters [a, a, b], no glimmer, monsters that do not fall */
    function engine(t, monA, setup) {
      const c1 = member('selma', t.wtype, t.id), c2 = member('marta', null, null);
      if (!c1) return null;
      if (setup) setup(c1, c2);
      const eng = new B.Engine({ party: [c1, c2], reserve: [], mons: [monA, monA, other], inv: {}, live: false, tier: TIER, lv: LV, noSurprise: true, noEscape: true });
      B.drain(eng.begin());
      eng.round = 1;
      eng.glimmerStep = function* () { return null; }; // the probe tests the tech itself, never its glimmer replacement
      for (const m of eng.mons) { m.hp = 1e6; m.mhp = 1e6; }
      return eng;
    }
    const collect = (gen) => { const ev = []; for (const e of gen) ev.push(e); return ev; };
    const cmdFor = (eng, t) => {
      const pu = eng.party[0];
      const target = t.target === 'enemy' || t.target === 'group' ? eng.mons[0] : t.target === 'ally' ? eng.party[1] : t.target === 'self' ? pu : null;
      return { type: 'tech', id: t.id, slot: 'weapon1', target };
    };

    const techs = S.techList(F);
    for (const t of techs) {
      const d = S.damageOf(t);
      const riders = t.effects.filter((e) => e !== d);
      const need = riders.find((e) => e.type === 'status' && e.status !== 'counter');
      const monA = (need && monFor(need.status)) || base;
      let eng;
      try { eng = engine(t, monA); } catch (e) { rec(false, t.id, `engine setup threw: ${e.message}`); continue; }
      if (!eng) { rec(false, t.id, `no plain ${t.wtype} weapon in DB.items to test with`); continue; }
      const pu = eng.party[0];

      // ---- usability (§6.3.1, §6.3.4, §3.3.8 unusable)
      rec(eng.unusable(pu, t.id, 'weapon1') == null, t.id, `usable in the front row with full WP (unusable = ${eng.unusable(pu, t.id, 'weapon1')})`);
      rec(eng.isQuick(cmdFor(eng, t)) === !!t.quick, t.id, `quick ${!!t.quick} → acts in the first slot of the round (§4.5.2)`);
      try {
        const em = engine(t, monA, (c1) => { c1.row = 'middle'; });
        const why = em.unusable(em.party[0], t.id, 'weapon1');
        rec(em.effRow(em.party[0]) === 'middle' && (t.reach ? why == null : why === 'reach'), t.id, `middle row → ${t.reach ? 'usable' : "'reach'"} (got ${why})`);
        const es = engine(t, monA);
        es.party[0].status.silence = true;
        const ws = es.unusable(es.party[0], t.id, 'weapon1');
        rec(t.magic ? ws === 'silence' : ws == null, t.id, `silenced → ${t.magic ? "'silence'" : 'usable'} (got ${ws})`);
      } catch (e) { rec(false, t.id, `reach / silence probe threw: ${e.message}`); }

      // ---- vs keys: race / flag / status id (§6.2.4-D) — the multiplier the engine applies to a matching target
      if (d && d.vs && typeof eng.vsMult === 'function') {
        for (const [k, mul] of Object.entries(d.vs)) {
          let got = null, where = '';
          if (S.BAD_STATUSES.includes(k)) {
            const m0 = eng.mons[0];
            const off = eng.vsMult(d.vs, m0);
            m0.status[k] = true;
            got = eng.vsMult(d.vs, m0) / off;
            delete m0.status[k];
            where = `a ${k} target`;
          } else {
            const hit = Object.entries(DB.monsters).find(([, m]) => m && !(m.flags || []).includes('boss') && (m.race === k || (m.flags || []).includes(k)) && m.lv);
            if (!hit) { rec(false, t.id, `vs ${k}: no monster with that race / flag to test on`); continue; }
            try {
              const ev = engine(t, hit[0]);
              const others = Object.entries(d.vs).filter(([k2]) => k2 !== k && (ev.mons[0].race === k2 || ev.mons[0].flags.includes(k2))).reduce((p, [, v]) => p * v, 1);
              got = ev.vsMult(d.vs, ev.mons[0]) / others;
              where = `${hit[0]} (${k})`;
            } catch (e) { rec(false, t.id, `vs ${k}: probe threw ${e.message}`); continue; }
          }
          rec(Math.abs(got - mul) < 1e-9, t.id, `vs ${k}: ×${mul} on ${where} (engine ×${got})`);
        }
      }

      // ---- one use: announcement, WP
      let ev;
      const wp0 = pu.wp, cost = eng.wpCost(pu, t.id);
      try { ev = collect(eng.turn(pu, cmdFor(eng, t))); } catch (e) { rec(false, t.id, `using it threw: ${e.stack.split('\n').slice(0, 2).join(' ')}`); continue; }
      rec(ev.some((e) => e.t === 'msg' && e.text === `${pu.name}の${t.name}！`), t.id, `announced 「${pu.name}の${t.name}！」 (§6.2.4-E)`);
      rec(cost === Math.max(1, t.wp) && wp0 - pu.wp === cost, t.id, `pays WP ${t.wp} (paid ${wp0 - pu.wp}, wpCost ${cost})`);

      // ---- repeated trials
      const agg = { fxOk: 0, dmg: 0, el: 0, cost: 0, drain: 0, rider: 0, landedTrials: 0, stance: 0, counter: 0, parry: 0, cover: 0, coverDmg: 0, heal: 0, mp: 0, cure: 0, buff: 0, err: null };
      for (let k = 0; k < TRIALS && !agg.err; k++) {
        try {
          const e2 = engine(t, monA);
          const u = e2.party[0], ally = e2.party[1], m0 = e2.mons[0];
          // preconditions
          // a status rider is only checked for landing at all (its rate is A2's test_battle): the highest status factor
          if (need && u.st) { u.st.dex = 999; u.st.int = 999; }
          if (t.effects.some((e) => e.type === 'dispel')) m0.buffs.atk = 2;
          if (d && d.drain) u.hp = Math.max(1, Math.floor(u.mhp / 2));
          if (t.effects.some((e) => e.type === 'heal')) { u.hp = 1; ally.hp = 1; }
          if (t.effects.some((e) => e.type === 'healMp')) { u.mp = 0; ally.mp = 0; }
          const cure = t.effects.find((e) => e.type === 'cure');
          if (cure) for (const s of cure.statuses) { u.status[s] = true; u.turns[s] = 3; }
          const hp0 = u.hp;
          const evs = collect(e2.turn(u, cmdFor(e2, t)));
          const fx = evs.filter((e) => e.t === 'fx' && e.kind === 'ability');
          const onMons = (e) => e.u && !e.u.isParty;
          if (d) {
            const hits = d.hits || 1;
            let good;
            if (t.target === 'random') good = fx.length === hits;
            else if (t.target === 'enemy') good = fx.length === hits && fx.every((e) => e.targets.length === 1 && e.targets[0] === m0);
            else if (t.target === 'group') good = fx.length === 1 && fx[0].targets.length === 2 && fx[0].targets.every((x) => x.id === m0.id);
            else good = fx.length === 1 && fx[0].targets.length === 3;
            if (good) agg.fxOk++;
            const dm = evs.filter((e) => e.t === 'dmg' && onMons(e) && e.n > 0);
            if (dm.length) { agg.dmg++; agg.landedTrials++; }
            if (dm.some((e) => (e.el || null) === (d.element || null))) agg.el++;
            if (d.hpCost && evs.some((e) => e.t === 'dmg' && e.u === u && e.kind === 'cost' && e.n === Math.min(hp0 - 1, Math.floor(u.mhp * d.hpCost)))) agg.cost++;
            if (d.drain && dm.length && u.hp > hp0) agg.drain++;
            for (const r of riders) {
              if (r.type === 'status' && evs.some((e) => e.t === 'status' && onMons(e) && e.s === r.status && e.on)) agg.rider++;
              else if (r.type === 'buff' && evs.some((e) => e.t === 'buff' && onMons(e) && e.stat === r.stat && e.d < 0)) agg.rider++;
              else if (r.type === 'steal' && evs.some((e) => e.t === 'msg' && /盗んだ|何も盗めなかった/.test(e.text))) agg.rider++;
              else if (r.type === 'dispel' && dm.some((e) => e.u === m0) && m0.buffs.atk === 0) agg.rider++;
            }
          }
          for (const eff of t.effects) {
            if (eff.type === 'status' && eff.status === 'counter') {
              const st = u.status.counter;
              if (st && st.slot === 'weapon1' && st.power === eff.power && (st.parry || 0) === (eff.parry || 0) && (st.critBonus || 0) === (eff.critBonus || 0)) agg.stance++;
              // one enemy single-target physical attack on the user (§6.2.4-A3)
              const ea = collect(e2.execute(m0, { type: 'attack', target: u })).concat(collect(e2.flushReactions()));
              if (ea.some((e) => e.t === 'miss' && e.u === u && e.parry)) agg.parry++;
              if (ea.filter((e) => e.t === 'react' && e.u === u).length === 1 && ea.some((e) => e.t === 'msg' && e.text === `${u.name}の反撃！`)) agg.counter++;
            } else if (eff.type === 'cover') {
              if (u.status.cover && u.status.cover.mul === eff.mul) agg.stance++;
              const ea = collect(e2.execute(m0, { type: 'attack', target: ally }));
              if (ea.some((e) => e.t === 'cover' && e.u === u && e.ally === ally)) agg.cover++;
              if (!ea.some((e) => e.t === 'dmg' && e.u === ally)) agg.coverDmg++;
            } else if (eff.type === 'heal') {
              const tg = t.target === 'self' ? [u] : t.target === 'ally' ? [ally] : [u, ally];
              if (tg.every((x) => x.hp > 1)) agg.heal++;
            } else if (eff.type === 'healMp') {
              const tg = t.target === 'ally' ? [ally] : [u, ally];
              if (tg.every((x) => x.mp === Math.min(x.mmp, Math.max(1, Math.ceil(x.mmp * eff.pct))))) agg.mp++;
            } else if (eff.type === 'cure') {
              if (eff.statuses.every((s) => !u.status[s])) agg.cure++;
            } else if (eff.type === 'buff' && !d) {
              const tg = t.target === 'self' ? [u] : t.target === 'ally' ? [ally] : [u, ally];
              if (tg.every((x) => x.buffs[eff.stat] === eff.stages)) agg.buff++;
            }
          }
        } catch (e) { agg.err = e.stack.split('\n').slice(0, 2).join(' '); }
      }
      if (agg.err) { rec(false, t.id, `a trial threw: ${agg.err}`); continue; }
      const N = TRIALS;
      if (d) {
        rec(agg.fxOk === N, t.id, `${t.target}${d.hits ? ' ×' + d.hits : ''}: the right targets and number of hits in ${agg.fxOk}/${N} uses`);
        rec(agg.dmg > 0, t.id, `deals damage (landed in ${agg.dmg}/${N})`);
        rec(agg.el === agg.dmg, t.id, `element ${d.element || 'none'} on every landed hit (${agg.el}/${agg.dmg})`);
        if (d.hpCost) rec(agg.cost === N, t.id, `pays HP ${Math.round(d.hpCost * 100)}% first (${agg.cost}/${N})`);
        if (d.drain) rec(agg.drain === agg.dmg && agg.dmg > 0, t.id, `drains HP on a landed hit (${agg.drain}/${agg.dmg})`);
        if (riders.length) rec(agg.rider > 0, t.id, `the rider${riders.length > 1 ? 's' : ''} (${riders.map((r) => r.status || r.stat || r.type).join(', ')}) land at least once in ${N} uses (${agg.rider})`);
      }
      for (const eff of t.effects) {
        if (eff.type === 'status' && eff.status === 'counter') {
          rec(agg.stance === N, t.id, `stance {slot:'weapon1', power ${eff.power}, parry ${eff.parry || 0}, critBonus ${eff.critBonus || 0}} (${agg.stance}/${N})`);
          rec(agg.counter === N, t.id, `one counter per enemy attack (${agg.counter}/${N})`);
          if (eff.parry) rec(agg.parry > 0 && agg.parry < N, t.id, `parries some attacks (${agg.parry}/${N}, parry ${eff.parry})`);
          else rec(agg.parry === 0, t.id, `never parries (parry 0) (${agg.parry}/${N})`);
        } else if (eff.type === 'cover') {
          rec(agg.stance === N, t.id, `cover {mul ${eff.mul}} (${agg.stance}/${N})`);
          rec(agg.cover === N && agg.coverDmg === N, t.id, `takes the enemy's attack on the ally (${agg.cover}/${N}, ally untouched ${agg.coverDmg}/${N})`);
        } else if (eff.type === 'heal') rec(agg.heal === N, t.id, `heals HP ${Math.round(eff.pct * 100)}% (${agg.heal}/${N})`);
        else if (eff.type === 'healMp') rec(agg.mp === N, t.id, `restores ceil(max MP × ${eff.pct}) (${agg.mp}/${N})`);
        else if (eff.type === 'cure') rec(agg.cure === N, t.id, `cures ${eff.statuses.join(' ')} (${agg.cure}/${N})`);
      }
      const ownBuffs = t.effects.filter((e) => e.type === 'buff' && !d);
      if (ownBuffs.length) rec(agg.buff === N * ownBuffs.length, t.id, `own-side ${ownBuffs.map((e) => e.stat + (e.stages > 0 ? '+' : '') + e.stages).join(' ')} (${agg.buff}/${N * ownBuffs.length})`);

      // ---- noAuto: the party AI (オート, the simulators) never considers it (§6.0 0.13, §6.2.7)
      const AI = F.BattleAI;
      if (AI && typeof AI.abilityOptions === 'function') {
        try {
          const e3 = engine(t, monA);
          const offered = AI.abilityOptions(e3, e3.party[0]).map((o) => o.id);
          rec(offered.includes(t.id) === !t.noAuto, t.id, t.noAuto ? `noAuto: not among the オート AI's options (${offered.join(' ') || 'none'})` : 'among the オート AI\'s options (no noAuto)');
        } catch (e) { rec(false, t.id, `R.BattleAI.abilityOptions threw: ${e.message}`); }
      }
    }
    return { skipped: null, results, techs: techs.length, cast: { weapons: S.WTYPES.map((w) => `${w}:${weaponFor(w)}`), base, other } };
  }
}

module.exports = { run };
