// Battle rules engine (DESIGN §5.3–5.6, §6). Pure logic, no DOM.
//
// An Engine resolves a whole battle as a stream of small events produced by
// generator functions. State is mutated exactly when the matching event is
// yielded, so the scene (battle_scene.js) can animate every step in sync
// (HP windows drop as the damage line appears), and the headless simulator
// (R.Battle.simulate) runs the very same code by simply draining the stream.
//
// Events: {t:'msg',text} {t:'actor',u} {t:'fx',fx,user,targets,ab,kind}
//   {t:'dmg',u,n,crit,mp,kind} {t:'heal',u,n,mp} {t:'miss',u} {t:'crit',u}
//   {t:'die',u} {t:'revive',u} {t:'status',u,s,on} {t:'buff',u,stat,d}
//   {t:'flee',u} {t:'escape',ok} {t:'cover',u,ally} {t:'react',u,a}
//   {t:'gain',item,rare} {t:'rare'} {t:'victory'} {t:'jingle',id} {t:'pause'} {t:'clear'}
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;
  const B = (R.Battle = R.Battle || {});

  // ------------------------------------------------------------ constants
  const STAGES = [0.5, 0.75, 1, 1.5, 2]; // buff stage −2..+2
  const stageMult = (s) => STAGES[U.clamp(s | 0, -2, 2) + 2];
  const BUFF_STATS = ['atk', 'def', 'mag', 'mdef', 'agi'];
  const TIMED = { sleep: [1, 4], paralyze: [1, 3], confuse: [2, 4], silence: [3, 5], blind: [3, 5], regen: [5, 5] };
  const BAD = ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind'];
  // 二刀流 (twoSwords): 戦う (and counters) swing a second time with the off-hand weapon (only when one is in the
  // shield slot); that swing deals ×OFFHAND_MULT so the good physical skills still beat it (tools/sim_dualwield.js)
  const OFFHAND_MULT = 0.6;
  const NAMES = {
    elem: { fire: '炎', ice: '氷', thunder: '雷', wind: '風', earth: '大地', water: '水', holy: '聖', dark: '闇' },
    buff: { atk: '攻撃力', def: '守備力', mag: '魔力', mdef: '魔法防御', agi: '素早さ' },
    stat: { hp: '最大HP', mp: '最大MP', str: '力', vit: '体力', agi: '素早さ', int: '知力', mnd: '精神', luk: '運' },
    status: { poison: '毒', sleep: '眠り', paralyze: '麻痺', confuse: '混乱', silence: '沈黙', blind: '暗闇', regen: '再生', death: '即死' },
  };
  const ST_ON = {
    poison: (n) => `${n}は毒に冒された！`,
    sleep: (n) => `${n}は眠ってしまった！`,
    paralyze: (n) => `${n}は体がしびれて動けなくなった！`,
    confuse: (n) => `${n}は混乱した！`,
    silence: (n) => `${n}は魔法を封じられた！`,
    blind: (n) => `${n}は目が見えなくなった！`,
    regen: (n) => `${n}の体を命の光が包んだ！`,
  };
  const ST_OFF = {
    poison: (n) => `${n}の毒が消えた！`,
    sleep: (n) => `${n}は目を覚ました！`,
    paralyze: (n) => `${n}の体のしびれが取れた！`,
    confuse: (n) => `${n}は我に返った！`,
    silence: (n) => `${n}の魔法の封印が解けた！`,
    blind: (n) => `${n}の目が見えるようになった！`,
    regen: (n) => `${n}を包む光が消えた。`,
  };
  const LEVEL_STATS = ['str', 'agi', 'vit', 'int', 'mnd', 'luk', 'hp', 'mp'];
  const LETTERS = 'ＡＢＣＤＥＦＧＨ';
  // default normal-attack animation per monster base sprite
  const MON_ATTACK_FX = {
    wolf: 'bite', rat: 'bite', snake: 'bite', bat: 'bite', crab: 'claw', harpy: 'claw', scorpion: 'claw',
    lizardman: 'slash', skeleton: 'slash', armor: 'slash', mummy: 'claw', orc: 'strike', golem: 'strike',
    minotaur: 'strike', yeti: 'claw', jelly: 'strike', mushroom: 'strike', wisp: 'strike', eyeball: 'strike',
    wyvern: 'bite', chimera: 'bite', sandworm: 'bite', kraken: 'strike', plant: 'bite', mimic: 'bite',
    boss_serpent: 'bite', boss_sphinx: 'claw', boss_bandit: 'slash', boss_general_a: 'slash',
  };
  const WEAPON_FX = { sword: 'slash', katana: 'slash', axe: 'slash', knife: 'slash', spear: 'pierce', bow: 'pierce', claw: 'claw', staff: 'strike', rod: 'strike', harp: 'strike' };
  const EMPTY = Object.freeze({});

  // ---------------------------------------------------------------- units
  class Unit {
    constructor(side, key) {
      this.side = side; this.key = key;
      this.buffs = { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 };
      this.turns = {}; // timed status → turns left
      this.defending = false;
      this.acts = 0; // actions taken so far (for 'every' conds)
      this.used = {}; // ids used this battle (for 'once' conds)
      this.gone = false; // ran away
    }
    get alive() { return this.hp > 0 && !this.gone; }
    get isParty() { return this.side === 'party'; }
    hpRate() { return this.mhp ? this.hp / this.mhp : 0; }
    /** can take a turn of its own (not asleep/paralysed) */
    canAct() { return this.alive && !this.status.sleep && !this.status.paralyze; }
    /** can be given a command by the player */
    commandable() { return this.canAct() && !this.status.confuse; }
  }

  class PartyUnit extends Unit {
    constructor(c, i) {
      super('party', 'p' + i);
      this.c = c; this.idx = i;
      if (!c.status) c.status = {};
      for (const s in c.status) if (s !== 'poison') delete c.status[s];
      this.refresh();
      this.permRegen = !!this.st.mods.regen;
    }
    refresh() { this.st = R.Rules.stats(this.c); }
    get name() { return this.c.name; }
    get hp() { return this.c.hp; }
    set hp(v) { this.c.hp = v; }
    get mp() { return this.c.mp; }
    set mp(v) { this.c.mp = v; }
    get mhp() { return this.st.hp; }
    get mmp() { return this.st.mp; }
    get status() { return this.c.status; }
    set status(v) { this.c.status = v; }
    get mods() { return this.st.mods; }
    get boss() { return false; }
    get level() { return this.c.level; }
    flag() { return false; }
    stat(k) { return this.st[k] || 0; }
    elemMult(e) { const r = this.st.mods.elemResist; return e && r && r[e] != null ? r[e] : 1; }
    elemBoost(e) { const b = this.st.mods.elemBoost; return (e && b && b[e]) || 0; }
    resist(s) { const im = this.st.mods.statusImmune; return im && im.includes(s) ? 1 : 0; }
  }

  class MonUnit extends Unit {
    constructor(id, i) {
      super('mon', 'm' + i);
      const d = DB.monsters[id];
      this.id = id; this.d = d; this.idx = i;
      this.base = d.name; this.name = d.name;
      this.hp = this.mhp = Math.max(1, d.hp | 0);
      this.mp = this.mmp = d.mp || 0;
      this.status = {};
      this.flags = d.flags || [];
      this.stolen = false;
      this.permRegen = false;
    }
    get mods() { return EMPTY; }
    get boss() { return this.flags.includes('boss'); }
    get level() { return this.d.lv || 1; }
    flag(f) { return this.flags.includes(f); }
    stat(k) {
      const d = this.d;
      switch (k) {
        case 'hit': return d.hit != null ? d.hit : 95;
        case 'eva': return d.eva != null ? d.eva : 3;
        case 'crit': return d.crit != null ? d.crit : 1.5;
        case 'luk': return d.luk != null ? d.luk : (d.lv || 1);
        case 'mnd': return d.mnd != null ? d.mnd : (d.mag || 0);
        case 'int': return d.mag || 0;
        default: return d[k] || 0;
      }
    }
    elemMult(e) { return e && this.d.elem && this.d.elem[e] != null ? this.d.elem[e] : 1; }
    elemBoost(e) { return (e && this.d.elemBoost && this.d.elemBoost[e]) || 0; }
    resist(s) {
      if (this.boss && s === 'death') return 1;
      const r = this.d.statusRes;
      return r && r[s] != null ? r[s] : 0;
    }
  }

  // --------------------------------------------------------------- engine
  class Engine {
    /**
     * o: {party:[charObjects], mons:[monsterIds], inv:{id:count}, live:bool (write R.Game: bestiary, gold, items),
     *     noEscape, surprise:'pre'|'ambush'|null (forced; omit to roll), noSurprise:bool (never roll)}
     */
    constructor(o) {
      this.o = o;
      this.live = !!o.live;
      this.inv = o.inv || {};
      this.party = o.party.map((c, i) => new PartyUnit(c, i));
      this.mons = o.mons.filter((id) => DB.monsters[id]).map((id, i) => new MonUnit(id, i));
      const count = {};
      for (const m of this.mons) count[m.id] = (count[m.id] || 0) + 1;
      const seen = {};
      for (const m of this.mons) if (count[m.id] > 1) m.name = m.base + LETTERS[(seen[m.id] = (seen[m.id] || 0) + 1) - 1];
      this.boss = this.mons.some((m) => m.boss);
      this.noEscape = !!o.noEscape || this.boss;
      this.round = 0;
      this.escapes = 0;
      this.result = null;
      this.surprise = null;
      this.killed = [];
      this.stolen = [];
      this.reactQ = [];
      this.said = 0;
      this.stats = { dealt: 0, taken: 0, deaths: 0 };
    }

    // ------------------------------------------------------- queries
    units() { return this.party.concat(this.mons); }
    living(side) { return (side === 'party' ? this.party : this.mons).filter((u) => u.alive); }
    foes(u) { return this.living(u.isParty ? 'mon' : 'party'); }
    friends(u) { return this.living(u.side); }
    leaderName() { const l = this.party.find((p) => p.alive) || this.party[0]; return l ? l.name : ''; }
    /** monster groups in display order: [{id, name, units, n (alive)}] */
    groups(all) {
      const out = [], by = {};
      for (const m of this.mons) {
        if (!all && !m.alive) continue;
        let g = by[m.id];
        if (!g) { g = by[m.id] = { id: m.id, name: m.base, units: [], n: 0 }; out.push(g); }
        g.units.push(m); g.n++;
      }
      return out;
    }
    checkEnd() {
      if (this.result) return this.result;
      if (!this.party.some((p) => p.alive)) this.result = 'lose';
      else if (!this.mons.some((m) => m.alive)) this.result = 'win';
      return this.result;
    }
    m(text) { this.said++; return { t: 'msg', text }; }
    pct(u, key) { return u.isParty ? (u.mods[key] || 0) : 0; }
    /** sum of a numeric mod over the living party */
    partyMod(key) { let s = 0; for (const p of this.party) if (p.alive) s += p.mods[key] || 0; return s; }
    mpCost(u, id, ab) {
      if (u.isParty && DB.abilities[id]) return R.Rules.mpCost(u.c, id);
      return (ab && ab.mp) || 0;
    }
    /** why an ability cannot be chosen right now (null = usable) */
    unusable(u, id) {
      const ab = DB.abilities[id];
      if (!ab) return 'none';
      if (ab.magic && u.status.silence) return 'silence';
      if (u.mp < this.mpCost(u, id, ab)) return 'mp';
      if (!ab.effects || !ab.effects.some((e) => BATTLE_EFFECT[e.type])) return 'field';
      return null;
    }
    weaponFx(u) {
      if (u.isParty) {
        const w = u.c.equip && u.c.equip.weapon && DB.items[u.c.equip.weapon];
        return w ? (w.fx || WEAPON_FX[w.wtype] || 'slash') : 'strike';
      }
      return u.d.attackFx || MON_ATTACK_FX[u.d.sprite] || 'claw';
    }

    // ------------------------------------------------------ inventory
    count(id) { return this.inv[id] || 0; }
    takeItem(id) {
      if (this.live && R.State && R.Game && this.inv === R.Game.inv) return R.State.removeItem(id, 1);
      if (!this.inv[id]) return false;
      if (--this.inv[id] <= 0) delete this.inv[id];
      return true;
    }
    giveItem(id) {
      if (!DB.items[id]) return false;
      if (this.live && R.State && R.Game && this.inv === R.Game.inv) return R.State.addItem(id, 1);
      this.inv[id] = Math.min(99, (this.inv[id] || 0) + 1);
      return true;
    }
    /** most economical healing consumable for unit t (never a rare item) */
    bestHealItem(t) {
      const miss = t.mhp - t.hp;
      let best = null, bestV = 0, big = null, bigV = 0;
      for (const id in this.inv) {
        const it = DB.items[id];
        if (!it || !this.inv[id] || it.type !== 'consumable' || it.rare || !it.use || !it.use.battle) continue;
        if (!['ally', 'self', 'ally_any'].includes(it.use.target)) continue;
        const h = it.use.effects.find((e) => e.type === 'heal');
        if (!h || it.use.effects.some((e) => e.type === 'revive')) continue;
        const v = h.pct ? h.pct * t.mhp : h.power || 0;
        if (v >= miss * 0.7 && (!best || v < bestV)) { best = id; bestV = v; }
        if (v > bigV) { big = id; bigV = v; }
      }
      return best || big;
    }

    // ------------------------------------------------------- start
    *begin() {
      for (const g of this.groups()) {
        const d = g.units && g.units[0] && g.units[0].d;
        if (g.n === 1 && d && d.appear) { yield this.m(d.appear); continue; } // rare monsters' own entrance line
        yield this.m(g.n > 1 ? `${g.name}が${g.n}匹現れた！` : `${g.name}が現れた！`);
      }
      if (this.live && R.State && R.Game) for (const g of this.groups()) R.State.seen(g.id);
      if (this.o.surprise !== undefined) this.surprise = this.o.surprise || null; // forced ('pre'|'ambush'|null)
      else if (!this.o.noSurprise && !this.boss) {
        const pre = 1 / 16 + this.partyMod('preemptPct') / 100;
        const r = U.r();
        if (r < pre) this.surprise = 'pre';
        else if (r < pre + 1 / 32) this.surprise = 'ambush';
      }
      if (this.surprise === 'pre') yield this.m('しかし魔物たちは、まだこちらに気づいていない！');
      if (this.surprise === 'ambush') yield this.m('魔物たちがいきなり襲いかかってきた！');
      for (const p of this.party) {
        const sb = p.mods.startBuffs;
        if (p.alive && sb) for (const k in sb) if (BUFF_STATS.includes(k)) p.buffs[k] = U.clamp(p.buffs[k] + sb[k], -2, 2);
      }
    }

    // ------------------------------------------------------- rounds
    /**
     * One round. cmds: array by party index of {type:'attack'|'ability'|'item'|'defend', id, target}
     * (targets are Unit objects of this engine), or {flee:true} for the whole party.
     */
    *playRound(cmds) {
      if (this.result) return;
      this.round++;
      const surprise = this.round === 1 ? this.surprise : null;
      let partyActs = surprise !== 'ambush';
      const monsAct = surprise !== 'pre';
      cmds = cmds || [];
      if (cmds.flee && partyActs) {
        if (yield* this.tryEscape(surprise === 'pre')) return;
        partyActs = false;
      }
      const order = [];
      const init = (u) => u.stat('agi') * stageMult(u.buffs.agi) * U.rf(0.6, 1.0);
      if (partyActs) {
        for (const p of this.party) {
          if (!p.alive) continue;
          const cmd = cmds[p.idx] || null;
          p.defending = !!cmd && cmd.type === 'defend' && p.commandable();
          order.push({ u: p, cmd, v: p.defending ? 1e6 + init(p) : init(p) });
        }
      }
      if (monsAct) {
        for (const m of this.mons) {
          if (!m.alive) continue;
          const n = U.clamp(m.d.actsPerTurn || 1, 1, 3);
          for (let k = 0; k < n; k++) order.push({ u: m, cmd: null, v: init(m) });
        }
      }
      order.sort((a, b) => b.v - a.v);
      for (const s of order) {
        if (this.checkEnd()) break;
        if (!s.u.alive) continue;
        yield* this.turn(s.u, s.cmd);
      }
      for (const u of this.units()) u.defending = false;
      this.checkEnd();
    }

    *turn(u, cmd) {
      if (u.isParty && !cmd && u.commandable()) {
        // nothing chosen (e.g. revived this round): only end-of-turn upkeep, announced if anything happens
        let first = true;
        for (const ev of this.endTurn(u)) { if (first) { first = false; yield { t: 'actor', u }; } yield ev; }
        u.acts++;
        return;
      }
      yield { t: 'actor', u };
      for (const s of ['sleep', 'paralyze']) {
        if (!u.status[s]) continue;
        const left = (u.turns[s] || 1) - 1;
        if (left <= 0) yield* this.clearStatus(u, s);
        else {
          u.turns[s] = left;
          yield this.m(s === 'sleep' ? `${u.name}は眠っている。` : `${u.name}は体がしびれて動けない！`);
        }
        yield* this.endTurn(u);
        u.acts++;
        return;
      }
      if (u.status.confuse) {
        yield this.m(`${u.name}は混乱している！`);
        cmd = this.confusedCommand(u);
      } else if (!u.isParty) {
        if (u.flag('flee') && !u.boss && U.chance(u.d.fleeRate != null ? u.d.fleeRate : 0.3)) {
          u.gone = true;
          yield this.m(`${u.name}は逃げ出した！`);
          yield { t: 'flee', u };
          return;
        }
        cmd = R.BattleAI && R.BattleAI.monster ? R.BattleAI.monster(this, u) : { type: 'attack', target: U.pick(this.foes(u)) };
      }
      if (cmd) yield* this.execute(u, cmd);
      yield* this.flushReactions();
      if (!this.checkEnd()) yield* this.endTurn(u);
      u.acts++;
    }

    confusedCommand(u) {
      const mates = this.friends(u).filter((f) => f !== u);
      const foes = this.foes(u);
      const t = mates.length && (U.chance(0.5) || !foes.length) ? U.pick(mates) : U.pick(foes);
      return { type: 'attack', target: t || u };
    }

    *execute(u, cmd) {
      switch (cmd.type) {
        case 'attack': return yield* this.attack(u, cmd.target, false);
        case 'defend':
          u.defending = true;
          yield this.m(`${u.name}は身を守っている。`);
          return;
        case 'wait':
          yield this.m(`${u.name}は様子をうかがっている。`);
          return;
        case 'flee':
          if (!u.isParty && !u.boss) {
            u.gone = true;
            yield this.m(`${u.name}は逃げ出した！`);
            yield { t: 'flee', u };
          }
          return;
        case 'ability': {
          const ab = DB.abilities[cmd.id];
          if (!ab || ab.kind !== 'action') return yield* this.attack(u, cmd.target, false);
          return yield* this.useAbility(u, cmd.id, ab, cmd.target, null);
        }
        case 'item': {
          const it = DB.items[cmd.id];
          if (!it || !it.use) return;
          return yield* this.useAbility(u, cmd.id, it.use, cmd.target, it);
        }
      }
    }

    *endTurn(u) {
      if (!u.alive) return;
      if (u.status.poison) {
        const n = Math.max(1, Math.floor(u.mhp / 12));
        u.hp = Math.max(0, u.hp - n);
        if (u.isParty) this.stats.taken += n; else this.stats.dealt += n;
        yield { t: 'dmg', u, n, kind: 'poison' };
        yield this.m(`${u.name}は毒で${n}のダメージを受けた！`);
        if (u.hp <= 0) { yield* this.die(u, null); return; }
      }
      if ((u.status.regen || u.permRegen) && u.hp < u.mhp) {
        yield* this.restore(u, Math.max(1, Math.floor(u.mhp / 10)), 'hp');
      }
      for (const s of ['confuse', 'silence', 'blind', 'regen']) {
        if (u.status[s] && (u.turns[s] = (u.turns[s] || 1) - 1) <= 0) yield* this.clearStatus(u, s);
      }
    }

    *clearStatus(u, s, quiet) {
      if (!u.status[s]) return false;
      delete u.status[s];
      delete u.turns[s];
      yield { t: 'status', u, s, on: false };
      if (!quiet) yield this.m(ST_OFF[s](u.name));
      return true;
    }

    // ------------------------------------------------------- escape
    *tryEscape(sure) {
      yield { t: 'actor', u: null };
      yield this.m(`${this.leaderName()}たちは逃げ出した！`);
      if (this.noEscape) {
        yield { t: 'escape', ok: false };
        yield this.m('しかし逃げられない！');
        return false;
      }
      if (sure || U.chance(this.escapeChance())) {
        this.escapes++;
        this.result = 'escape';
        yield { t: 'escape', ok: true };
        return true;
      }
      this.escapes++;
      yield { t: 'escape', ok: false };
      yield this.m('しかし回り込まれてしまった！');
      return false;
    }
    escapeChance() {
      const avg = (l) => l.length ? l.reduce((s, u) => s + u.stat('agi') * stageMult(u.buffs.agi), 0) / l.length : 0;
      let p = 0.5 + 0.1 * this.escapes + (avg(this.living('party')) - avg(this.living('mon'))) / 200;
      p = U.clamp(p, 0.3, 1);
      return Math.min(1, p * (1 + this.partyMod('escapePct') / 100));
    }

    // ------------------------------------------------------- attacks
    /** a living target for u: the chosen one if still valid, else a random foe (same species first) */
    pickFoe(u, t) {
      if (t && t.alive) return t;
      const foes = this.foes(u);
      if (!foes.length) return null;
      if (t && !t.isParty) { const same = foes.filter((m) => m.id === t.id); if (same.length) return U.pick(same); }
      // a monster whose target fell picks a new one with the same formation weights (front 50/30/20)
      if (!u.isParty && foes[0].isParty && R.BattleAI && R.BattleAI.pickPartyTarget) return R.BattleAI.pickPartyTarget(this) || U.pick(foes);
      return U.pick(foes);
    }

    /** dual wielding right now: twoSwords AND a weapon in the shield slot (a shield / empty hand → one swing) */
    dualWield(u) { return !!(u.isParty && u.mods.twoSwords && u.st.atk2 > 0); }

    *attack(u, target, counter) {
      yield this.m(counter ? `${u.name}の反撃！` : `${u.name}の攻撃！`);
      const swings = this.dualWield(u) ? 2 : 1;
      for (let i = 0; i < swings; i++) {
        let t = this.pickFoe(u, target);
        if (!t || !u.alive) break;
        if (!counter) t = yield* this.cover(u, t);
        const atk = i === 1 ? u.st.atk2 : u.stat('atk');
        yield { t: 'fx', fx: this.weaponFx(u), user: u, targets: [t], kind: 'attack' };
        const r = this.roll(u, t, { formula: 'phys', power: 1 }, { atk });
        if (i === 1 && r.dmg) r.dmg *= OFFHAND_MULT; // the off-hand swing is the weaker one
        const landed = yield* this.hit(u, t, r, { kind: 'phys' });
        const onHit = u.isParty ? u.st.onHit : u.d.onHit;
        if (landed && onHit && t.alive) yield* this.inflict(u, t, onHit.status, onHit.chance, true);
        target = t;
      }
    }

    /** a party member with the cover reaction steps in for an ally under 25 % HP */
    *cover(att, t) {
      if (!t.isParty || att.side === t.side || t.hpRate() >= 0.25) return t;
      for (const p of this.party) {
        if (p === t || !p.commandable() || p.hpRate() < 0.25) continue;
        const ra = this.reactionOf(p);
        if (ra && ra.react.type === 'cover' && U.chance(ra.chance != null ? ra.chance : 1)) {
          yield { t: 'cover', u: p, ally: t };
          yield this.m(`${p.name}は${t.name}をかばった！`);
          return p;
        }
      }
      return t;
    }

    elemFactor(att, tgt, el) {
      if (!el) return 1;
      return tgt.elemMult(el) * (1 + att.elemBoost(el) / 100);
    }
    vsMult(eff, tgt) {
      if (!eff.vs || tgt.isParty) return 1;
      let v = 1;
      for (const f in eff.vs) if (tgt.flag(f)) v *= eff.vs[f];
      return v;
    }
    hitCount(eff) {
      const h = eff && eff.hits;
      if (Array.isArray(h)) return U.ri(h[0], h[1]);
      return Math.max(1, h | 0 || 1);
    }

    /**
     * Roll one hit of a damage effect. ctx: {atk (override), item, expect (AI: mean values, no misses/crits)}.
     * → {dmg, crit, miss, immune, resisted}
     */
    roll(att, tgt, eff, ctx) {
      ctx = ctx || {};
      const x = !!ctx.expect;
      const rf = (a, b) => (x ? (a + b) / 2 : U.rf(a, b));
      const f = eff.formula || 'phys';
      const power = eff.power != null ? eff.power : 1;
      const el = eff.element || (f === 'phys' ? (att.isParty ? att.st.element : att.d.element) : null) || null;
      const vs = this.vsMult(eff, tgt);
      const itemMul = ctx.item ? 1 + this.pct(att, 'itemPct') / 100 : 1;
      if (f === 'phys') {
        let hit = (att.stat('hit') * (eff.acc != null ? eff.acc : 1) - tgt.stat('eva')) / 100;
        if (att.status.blind) hit *= 0.5;
        if (tgt.status.sleep || tgt.status.paralyze) hit = 1;
        hit = U.clamp(hit, 0.05, 1);
        if (!x && !U.chance(hit)) return { miss: true, dmg: 0 };
        const atk = ctx.atk != null ? ctx.atk : att.stat('atk');
        const crit = !x && U.chance((att.stat('crit') + (eff.critBonus || 0)) / 100);
        const mods = (1 + this.pct(att, 'physPct') / 100) * itemMul * vs;
        let dmg;
        if (tgt.flag('metal')) dmg = x ? 0.5 : crit ? U.ri(1, 3) : U.ri(0, 1);
        else if (crit) dmg = atk * power * rf(0.95, 1.05) * stageMult(att.buffs.atk) * this.elemFactor(att, tgt, el) * mods;
        else {
          const def = eff.ignoreDef ? 0 : tgt.stat('def');
          const base = (atk * power) / 2 - def / 4;
          if (base < 1) dmg = x ? 0.5 : U.ri(0, 1);
          else dmg = base * rf(0.875, 1.125) * this.elemFactor(att, tgt, el) * (stageMult(att.buffs.atk) / stageMult(tgt.buffs.def)) * mods;
        }
        return { dmg: x ? dmg * hit : dmg, crit };
      }
      if (f === 'percent') {
        if (tgt.boss) return { immune: true };
        if (eff.acc != null && !x && !U.chance(eff.acc)) return { resisted: true };
        const d = Math.max(1, Math.floor(tgt.hp * power));
        return { dmg: x && eff.acc != null ? d * eff.acc : d };
      }
      if (tgt.flag('metal')) return { immune: true };
      if (eff.acc != null && eff.acc < 1 && !x && !U.chance(eff.acc)) return { resisted: true };
      let dmg;
      if (f === 'magic') {
        const scale = eff.scale != null ? eff.scale : 0.6;
        dmg = (power + att.stat('mag') * scale) * rf(0.9, 1.1) * (100 / (100 + Math.max(0, tgt.stat('mdef'))));
        dmg *= (stageMult(att.buffs.mag) / stageMult(tgt.buffs.mdef)) * (1 + this.pct(att, 'magicPct') / 100);
        dmg *= this.elemFactor(att, tgt, el);
      } else if (f === 'breath') {
        dmg = power * rf(0.9, 1.1) * tgt.elemMult(el);
      } else {
        dmg = power * rf(0.9, 1.1) * this.elemFactor(att, tgt, el);
      }
      dmg *= vs * itemMul;
      if (x && eff.acc != null) dmg *= eff.acc;
      return { dmg };
    }

    /** apply a rolled hit to tgt; returns true when it connected */
    *hit(att, tgt, r, info) {
      const kind = info.kind || 'phys';
      if (r.miss) {
        yield { t: 'miss', u: tgt, att };
        yield this.m(tgt.isParty ? `しかし${tgt.name}は素早く身をかわした！` : `ミス！　${tgt.name}はひらりと身をかわした！`);
        return false;
      }
      if (r.crit) {
        yield { t: 'crit', u: att };
        yield this.m(att.isParty ? '会心の一撃！' : '痛恨の一撃！');
      }
      let dmg = r.dmg;
      if (tgt.defending && dmg > 0) dmg /= 2;
      dmg = dmg < 0 ? -Math.round(-dmg) : Math.round(dmg);
      if (dmg < 0) {
        yield this.m(`しかし${tgt.name}はダメージを吸収した！`);
        yield* this.restore(tgt, -dmg, 'hp');
        return true;
      }
      if (info.mp) {
        const n = Math.min(tgt.mp, dmg);
        tgt.mp -= n;
        yield { t: 'dmg', u: tgt, n, mp: true, kind };
        yield this.m(`${tgt.name}のMPが${n}減った！`);
        if (info.drain && n > 0 && att.alive) yield* this.restore(att, Math.round(n * info.drain), 'mp', 'drain');
        return true;
      }
      if (dmg <= 0) {
        yield { t: 'dmg', u: tgt, n: 0, kind };
        yield this.m(tgt.isParty ? `ミス！　${tgt.name}はダメージを受けない！` : `ミス！　${tgt.name}にダメージを与えられない！`);
        return true;
      }
      const dealt = Math.min(tgt.hp, dmg);
      tgt.hp = Math.max(0, tgt.hp - dmg);
      if (tgt.isParty) this.stats.taken += dealt; else this.stats.dealt += dealt;
      yield { t: 'dmg', u: tgt, n: dmg, crit: !!r.crit, kind, src: att };
      yield this.m(tgt.isParty ? `${tgt.name}は${dmg}のダメージを受けた！` : `${tgt.name}に${dmg}のダメージ！`);
      if (tgt.hp <= 0) yield* this.die(tgt, att);
      else {
        if (tgt.status.sleep && U.chance(0.5)) yield* this.clearStatus(tgt, 'sleep');
        if (tgt.status.confuse && U.chance(0.6)) yield* this.clearStatus(tgt, 'confuse');
        this.triggerReactions(att, tgt, kind);
      }
      if (info.drain && att.alive && dealt > 0) yield* this.restore(att, Math.round(dealt * info.drain), 'hp', 'drain');
      return true;
    }

    *die(u, killer) {
      u.hp = 0;
      for (const s in u.status) delete u.status[s];
      u.turns = {};
      u.buffs = { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 };
      u.defending = false;
      yield { t: 'die', u, killer };
      if (u.isParty) {
        this.stats.deaths++;
        yield this.m(`${u.name}は倒れた！`);
        const ra = this.reactionOf(u);
        if (ra && ra.trigger === 'ko' && ra.react.type === 'revive' && !u.revived && U.chance(ra.chance != null ? ra.chance : 1)) {
          u.revived = true;
          u.hp = Math.max(1, Math.floor(u.mhp * (ra.react.pct || 0.25)));
          yield { t: 'react', u, a: ra };
          yield { t: 'revive', u };
          yield this.m(`しかし${u.name}は再び立ち上がった！`);
        }
      } else {
        if (!this.killed.includes(u)) this.killed.push(u);
        yield this.m(`${u.name}を倒した！`);
      }
    }

    /** heal hp/mp by n (capped); why = 'drain'|'regen'|undefined changes the wording */
    *restore(t, n, kind, why) {
      n = Math.max(0, Math.round(n));
      const room = kind === 'mp' ? t.mmp - t.mp : t.mhp - t.hp;
      const got = Math.min(room, n);
      if (kind === 'mp') t.mp += got; else t.hp += got;
      yield { t: 'heal', u: t, n: got, mp: kind === 'mp' };
      const K = kind === 'mp' ? 'MP' : 'HP';
      if (why === 'drain') yield this.m(`${t.name}は${K}を${got}吸い取った！`);
      else if (got > 0) yield this.m(`${t.name}の${K}が${got}回復した！`);
      else yield this.m(`${t.name}の${K}はもう満タンだ。`);
      return got;
    }

    *inflict(u, t, s, chance, quiet) {
      if (!t.alive) return false;
      const res = t.resist(s);
      if (s === 'death') {
        if (res >= 1 || !U.chance((chance != null ? chance : 1) * (1 - res))) {
          if (!quiet) yield this.m(`しかし${t.name}には効かなかった！`);
          return false;
        }
        yield { t: 'status', u: t, s: 'death', on: true };
        yield this.m(t.isParty ? `${t.name}の息が止まった！` : `${t.name}の息の根を止めた！`);
        yield* this.die(t, u);
        return true;
      }
      if (t.status[s] || (s !== 'regen' && !U.chance((chance != null ? chance : 1) * (1 - res)))) {
        if (!quiet) yield this.m(`しかし${t.name}には効かなかった！`);
        return false;
      }
      t.status[s] = true;
      if (TIMED[s]) t.turns[s] = U.ri(TIMED[s][0], TIMED[s][1]);
      yield { t: 'status', u: t, s, on: true };
      yield this.m(ST_ON[s](t.name));
      return true;
    }

    // ------------------------------------------------------- abilities & items
    /** targets for an action; chosen = Unit picked in the menu (or by the AI) */
    targets(u, act, chosen) {
      const foes = this.foes(u), friends = this.friends(u);
      const side = (u.isParty ? this.party : this.mons).filter((x) => !x.gone);
      switch (act.target) {
        case 'enemy': { const t = this.pickFoe(u, chosen); return t ? [t] : []; }
        case 'group': {
          const t = this.pickFoe(u, chosen);
          if (!t) return [];
          return t.isParty ? foes : foes.filter((m) => m.id === t.id);
        }
        case 'enemies': case 'random': return foes;
        case 'ally': {
          if (chosen && chosen.alive && chosen.side === u.side) return [chosen];
          const t = friends.slice().sort((a, b) => a.hpRate() - b.hpRate())[0];
          return t ? [t] : [];
        }
        case 'allies':
          return (act.effects || []).some((e) => e.type === 'revive') ? side : friends;
        case 'self': return [u];
        case 'ally_dead': {
          if (chosen && !chosen.alive && !chosen.gone && chosen.side === u.side) return [chosen];
          const t = side.find((x) => !x.alive);
          return t ? [t] : [];
        }
        case 'ally_any':
          return chosen && chosen.side === u.side && !chosen.gone ? [chosen] : [u];
      }
      return [];
    }

    announce(u, ab, item) {
      if (item) return `${u.name}は${item.name}を使った！`;
      if (ab.msg) return ab.msg.replace(/\{user\}/g, u.name).replace(/\{name\}/g, ab.name);
      return ab.magic ? `${u.name}は${ab.name}を唱えた！` : `${u.name}の${ab.name}！`;
    }

    *useAbility(u, id, ab, chosen, item) {
      if (!item) {
        if (ab.magic && u.status.silence) {
          yield this.m(this.announce(u, ab));
          yield this.m('しかし魔法は封じられている！');
          return;
        }
        const cost = this.mpCost(u, id, ab);
        if (u.mp < cost) {
          yield this.m(this.announce(u, ab));
          yield this.m('しかしMPが足りない！');
          return;
        }
        u.mp -= cost;
      } else if (!this.takeItem(id)) {
        yield this.m(`${u.name}は${item.name}を使おうとした！`);
        yield this.m(`しかし${item.name}はもうなかった！`);
        return;
      }
      u.used[id] = true;
      yield this.m(this.announce(u, ab, item));
      const effects = ab.effects || [];
      const hpCost = effects.reduce((mx, e) => Math.max(mx, e.hpCost || 0), 0);
      if (hpCost > 0) {
        const pay = Math.min(u.hp - 1, Math.floor(u.mhp * hpCost));
        if (pay > 0) { u.hp -= pay; yield { t: 'dmg', u, n: pay, kind: 'cost' }; }
      }
      const ctx = { ab, item, id, fx: ab.fx || null };
      const said = this.said;
      if (ab.target === 'random') {
        const n = this.hitCount(effects.find((e) => e.type === 'damage'));
        for (let i = 0; i < n; i++) {
          const foes = this.foes(u);
          if (!foes.length || !u.alive) break;
          const t = U.pick(foes);
          yield { t: 'fx', fx: ctx.fx, user: u, targets: [t], ab, kind: 'ability' };
          for (const eff of effects) {
            if (!t.alive && eff.type !== 'revive') break;
            yield* this.effect(u, t, eff, Object.assign({ once: true }, ctx));
          }
        }
      } else {
        const targets = this.targets(u, ab, chosen);
        if (!targets.length) { yield this.m('しかし何も起こらなかった！'); return; }
        yield { t: 'fx', fx: ctx.fx, user: u, targets, ab, kind: 'ability' };
        for (const t of targets) {
          for (const eff of effects) {
            if (this.result === 'escape') return;
            if (!t.alive && eff.type !== 'revive') break;
            yield* this.effect(u, t, eff, Object.assign({ multi: targets.length > 1 }, ctx));
          }
        }
      }
      if (this.said === said) yield this.m('しかし何も起こらなかった！');
    }

    *effect(u, t, eff, ctx) {
      switch (eff.type) {
        case 'damage': return yield* this.damageEffect(u, t, eff, ctx);
        case 'heal': {
          if (!t.alive) return;
          let n;
          if (eff.pct) n = t.mhp * eff.pct;
          else {
            const scale = eff.scale != null ? eff.scale : ctx.item ? 0 : 0.6;
            n = (eff.power || 0) + u.stat('mnd') * scale;
            n *= U.rf(0.95, 1.05) * (ctx.item ? 1 : 1 + this.pct(u, 'healPct') / 100);
          }
          if (ctx.item) n *= 1 + this.pct(u, 'itemPct') / 100;
          return yield* this.restore(t, n, 'hp');
        }
        case 'healMp': {
          if (!t.alive) return;
          let n = eff.power || 0;
          if (ctx.item) n *= 1 + this.pct(u, 'itemPct') / 100;
          return yield* this.restore(t, n, 'mp');
        }
        case 'revive': {
          if (t.alive || t.gone) return;
          t.hp = Math.max(1, Math.floor(t.mhp * (eff.pct != null ? eff.pct : 0.25)));
          const i = this.killed.indexOf(t);
          if (i >= 0) this.killed.splice(i, 1);
          yield { t: 'revive', u: t };
          yield this.m(`${t.name}は生き返った！`);
          return;
        }
        case 'cure': {
          const list = eff.statuses === 'all' ? BAD : eff.statuses || [];
          for (const s of list) if (t.status[s]) yield* this.clearStatus(t, s);
          return;
        }
        case 'status': return yield* this.inflict(u, t, eff.status, eff.chance, false);
        case 'regen': return yield* this.inflict(u, t, 'regen', 1, false);
        case 'buff': return yield* this.buff(t, eff);
        case 'dispel': {
          if (!BUFF_STATS.some((k) => t.buffs[k])) return;
          t.buffs = { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 };
          yield { t: 'buff', u: t, stat: null, d: 0 };
          yield this.m(`${t.name}にかかっていた効果が消えた！`);
          return;
        }
        case 'steal': return yield* this.steal(u, t, eff);
        case 'scan': return yield* this.scan(t);
        case 'escape': {
          if (!u.isParty) {
            if (u.boss) return;
            u.gone = true;
            yield this.m(`${u.name}は逃げ出した！`);
            yield { t: 'flee', u };
            return;
          }
          if (this.result) return;
          if (this.noEscape) { yield this.m('しかし逃げられない！'); return; }
          this.result = 'escape';
          yield { t: 'escape', ok: true };
          yield this.m(`${this.leaderName()}たちはうまく逃げ切った！`);
          return;
        }
        case 'grow': {
          if (!t.isParty || !t.alive) return;
          const n = eff.n || 1;
          const mhp = t.mhp, mmp = t.mmp;
          R.Rules.grow(t.c, eff.stat, n);
          t.refresh();
          if (t.mhp > mhp) t.hp += t.mhp - mhp;
          if (t.mmp > mmp) t.mp += t.mmp - mmp;
          yield { t: 'buff', u: t, stat: eff.stat, d: 1, grow: true };
          yield this.m(`${t.name}の${NAMES.stat[eff.stat] || eff.stat}が${n}上がった！`);
          return;
        }
        case 'teleport': case 'exit': case 'repel':
          yield this.m('しかしここでは使えない！');
          return;
        case 'special': {
          const fn = B.specials && B.specials[eff.id];
          if (fn) yield* fn(this, u, t, eff, ctx);
          return;
        }
      }
    }

    *damageEffect(u, t, eff, ctx) {
      const n = ctx.once ? 1 : this.hitCount(eff);
      const kind = (eff.formula || 'phys') === 'phys' ? 'phys' : 'magic';
      for (let i = 0; i < n; i++) {
        if (!t.alive || !u.alive) break;
        if (i > 0) yield { t: 'fx', fx: ctx.fx, user: u, targets: [t], ab: ctx.ab, kind: 'ability' };
        if (kind === 'phys' && !ctx.multi && ctx.ab.target === 'enemy') t = yield* this.cover(u, t);
        const r = this.roll(u, t, eff, ctx);
        if (r.immune || r.resisted) { yield { t: 'miss', u: t, att: u }; yield this.m(`しかし${t.name}には効かなかった！`); break; }
        yield* this.hit(u, t, r, { kind, mp: !!eff.mp, drain: eff.drain || 0 });
      }
    }

    *buff(t, eff) {
      if (!t.alive || !BUFF_STATS.includes(eff.stat)) return;
      const st = eff.stages || 1;
      const name = NAMES.buff[eff.stat];
      if (eff.chance != null && !U.chance(eff.chance)) { yield this.m(`しかし${t.name}には効かなかった！`); return; }
      const cur = t.buffs[eff.stat], nv = U.clamp(cur + st, -2, 2), d = nv - cur;
      if (!d) { yield this.m(`しかし${t.name}の${name}はもう${st > 0 ? '上がらない' : '下がらない'}！`); return; }
      t.buffs[eff.stat] = nv;
      yield { t: 'buff', u: t, stat: eff.stat, d };
      yield this.m(`${t.name}の${name}が${d > 0 ? '上がった' : '下がった'}！`);
    }

    *steal(u, t, eff) {
      if (!u.isParty) {
        // monster thieves take a little gold (real battles only)
        const g = this.live && R.Game ? Math.min(R.Game.gold, (u.level || 1) * 5) : 0;
        if (!g) { yield this.m(`しかし${u.name}は何も盗めなかった！`); return; }
        R.Game.gold -= g;
        yield this.m(`${this.leaderName()}たちは${g}ゴールドを盗まれた！`);
        return;
      }
      if (t.isParty) return;
      const s = t.d.steal;
      if (!s || t.stolen || (!s.item && !s.rare)) { yield this.m(`${t.name}は何も持っていない！`); return; }
      if (!U.chance(this.stealChance(u, t))) { yield this.m('しかし盗めなかった！'); return; }
      let item = s.item, rare = false;
      if (s.rare && (!s.item || U.chance(this.rareStealChance(u, eff, t)))) { item = s.rare; rare = true; }
      t.stolen = true;
      this.giveItem(item);
      this.stolen.push({ mon: t.id, item, rare });
      if (this.live && R.State && R.Game) R.State.noteDrop(t.id, rare ? 'stealRare' : 'steal');
      if (rare) { yield { t: 'rare' }; yield this.m('★レアアイテム！'); }
      yield { t: 'gain', item, rare };
      yield this.m(`${u.name}は${t.name}から${(DB.items[item] || {}).name || item}を盗んだ！`);
    }
    stealChance(u, t) {
      let p = U.clamp(0.4 + (u.stat('agi') - t.stat('agi')) / 200 + u.stat('luk') / 400, 0.1, 0.9);
      p *= 1 + this.pct(u, 'stealPct') / 100;
      if (t.boss) p *= 0.5;
      return Math.min(0.98, p);
    }
    rareStealChance(u, eff, t) {
      const bonus = (eff && eff.rareBonus) || 0;
      // rare monsters' exclusive items stay as precious as their 1/64–1/128 drop
      if (t && t.d && t.d.flags && t.d.flags.includes('rare')) {
        return Math.min(1, (1 / 64 + bonus * 0.04) * (1 + this.pct(u, 'rarePct') / 100));
      }
      return Math.min(1, (0.125 + bonus) * (1 + this.pct(u, 'rarePct') / 100));
    }

    *scan(t) {
      yield this.m(`${t.name}　レベル${t.level}　HP${t.hp}/${t.mhp}`);
      if (t.isParty) return;
      const el = t.d.elem || {};
      const weak = Object.keys(el).filter((e) => el[e] >= 1.5).map((e) => NAMES.elem[e]);
      const absorb = Object.keys(el).filter((e) => el[e] < 0).map((e) => NAMES.elem[e]);
      yield this.m(weak.length ? `弱点：${weak.join('・')}` : '弱点は見つからない。');
      if (absorb.length) yield this.m(`吸収：${absorb.join('・')}`);
      if (this.live && R.State && R.Game) R.State.noteDrop(t.id, 'scan');
    }

    // ------------------------------------------------------- reactions
    reactionOf(u) {
      if (!u.isParty) return null;
      const id = u.c.set && u.c.set.reaction;
      const a = id && DB.abilities[id];
      return a && a.kind === 'reaction' && a.react && R.Rules.learned(u.c, id) ? a : null;
    }
    triggerReactions(att, tgt, kind) {
      if (!tgt.isParty || !att || att.side === tgt.side) return;
      const ra = this.reactionOf(tgt);
      if (ra) {
        const tr = ra.trigger;
        if (tr === 'hitAny' || (tr === 'hitPhys' && kind === 'phys') || (tr === 'hitMagic' && kind !== 'phys') ||
          (tr === 'lowHp' && tgt.hpRate() < 0.25)) this.queueReaction(tgt, ra, att, null);
      }
      if (tgt.hpRate() < 0.25) {
        for (const p of this.party) {
          if (p === tgt || !p.alive) continue;
          const r2 = this.reactionOf(p);
          if (r2 && r2.trigger === 'allyLowHp') this.queueReaction(p, r2, att, tgt);
        }
      }
    }
    queueReaction(u, a, src, ally) {
      if (a.react.type === 'cover' || a.react.type === 'revive') return;
      if (this.reactQ.some((q) => q.u === u)) return;
      this.reactQ.push({ u, a, src, ally });
    }
    *flushReactions() {
      const q = this.reactQ;
      this.reactQ = [];
      for (const r of q) {
        if (this.checkEnd()) break;
        const u = r.u;
        if (!u.commandable()) continue;
        if (!U.chance(r.a.chance != null ? r.a.chance : 1)) continue;
        yield* this.react(u, r);
      }
      this.reactQ = [];
    }
    *react(u, r) {
      const re = r.a.react;
      const t = r.ally && r.ally.alive ? r.ally : u;
      switch (re.type) {
        case 'counter':
          if (!r.src || !r.src.alive || r.src.side === u.side) return;
          yield { t: 'react', u, a: r.a };
          yield* this.attack(u, r.src, true);
          return;
        case 'heal':
          yield { t: 'react', u, a: r.a };
          yield this.m(`${u.name}の${r.a.name}！`);
          yield { t: 'fx', fx: 'heal', user: u, targets: [t], kind: 'react' };
          yield* this.restore(t, t.mhp * (re.pct || 0.25), 'hp');
          return;
        case 'autoItem': {
          const id = this.bestHealItem(t);
          if (!id || !this.takeItem(id)) return;
          const it = DB.items[id];
          yield { t: 'react', u, a: r.a };
          yield this.m(`${u.name}はとっさに${it.name}を使った！`);
          yield { t: 'fx', fx: it.use.fx || 'heal', user: u, targets: [t], kind: 'react' };
          for (const eff of it.use.effects) yield* this.effect(u, t, eff, { item: it, ab: it.use });
          return;
        }
        case 'buff':
          yield { t: 'react', u, a: r.a };
          yield this.m(`${u.name}の${r.a.name}！`);
          yield { t: 'fx', fx: (re.stages || 1) > 0 ? 'buff' : 'debuff', user: u, targets: [u], kind: 'react' };
          yield* this.buff(u, { stat: re.stat, stages: re.stages || 1 });
          return;
        case 'mp':
          yield { t: 'react', u, a: r.a };
          yield this.m(`${u.name}の${r.a.name}！`);
          yield { t: 'fx', fx: 'mp', user: u, targets: [u], kind: 'react' };
          yield* this.restore(u, re.power || 10, 'mp');
          return;
      }
    }

    // ------------------------------------------------------- AI helpers
    /** expected HP damage of an action's damage effects on t (mean rolls × hit chance) */
    expectDamage(u, act, t, item) {
      let sum = 0;
      for (const eff of act.effects || []) {
        if (eff.type !== 'damage' || eff.mp) continue;
        const r = this.roll(u, t, eff, { expect: true, item });
        if (r.immune || r.resisted) continue;
        let d = Math.max(0, r.dmg);
        if (t.defending) d /= 2;
        const hits = Array.isArray(eff.hits) ? (eff.hits[0] + eff.hits[1]) / 2 : Math.max(1, eff.hits | 0 || 1);
        sum += act.target === 'random' ? d : d * hits;
      }
      return sum;
    }
    expectAttack(u, t) {
      let d = this.roll(u, t, { formula: 'phys', power: 1 }, { expect: true }).dmg;
      if (this.dualWield(u)) d += OFFHAND_MULT * this.roll(u, t, { formula: 'phys', power: 1 }, { expect: true, atk: u.st.atk2 }).dmg;
      return t.defending ? d / 2 : d;
    }
    /** expected HP healed on t by an action (0 if it does not heal) */
    expectHeal(u, act, t, item) {
      let n = 0;
      for (const eff of act.effects || []) {
        if (eff.type !== 'heal') continue;
        if (eff.pct) n += t.mhp * eff.pct;
        else n += ((eff.power || 0) + u.stat('mnd') * (eff.scale != null ? eff.scale : item ? 0 : 0.6)) * (item ? 1 : 1 + this.pct(u, 'healPct') / 100);
      }
      if (item) n *= 1 + this.pct(u, 'itemPct') / 100;
      return n;
    }

    // ------------------------------------------------------- rewards
    computeRewards() {
      let exp = 0, gold = 0, jp = 0;
      const drops = [];
      const dropPct = this.partyMod('dropPct'), rarePct = this.partyMod('rarePct');
      for (const m of this.killed) {
        const d = m.d;
        exp += d.exp || 0; gold += d.gold || 0; jp += d.jp || 0;
        if (d.drop && d.drop.item && U.chance((1 / Math.max(1, d.drop.rate || 1)) * (1 + dropPct / 100))) drops.push({ mon: m.id, item: d.drop.item, rare: false });
        if (d.rare && d.rare.item && U.chance((1 / Math.max(1, d.rare.rate || 1)) * (1 + rarePct / 100))) drops.push({ mon: m.id, item: d.rare.item, rare: true });
      }
      gold = Math.round(gold * (1 + this.partyMod('goldPct') / 100));
      const each = this.party.filter((p) => p.alive).map((p) => ({
        u: p,
        exp: Math.round(exp * (1 + (p.mods.expPct || 0) / 100)),
        jp: Math.round(jp * (1 + (p.mods.jpPct || 0) / 100)),
      }));
      return { exp, gold, jp, drops, each };
    }

    /** victory: messages + apply EXP/JP/gold/items (to R.Game when live) */
    *rewards() {
      const rw = (this.rewardInfo = this.computeRewards());
      yield { t: 'victory' };
      if (!this.killed.length) { yield this.m('魔物たちはいなくなった。'); yield { t: 'pause' }; return; }
      const species = new Set(this.killed.map((m) => m.id));
      yield this.m(species.size === 1 && this.killed.length === 1 ? `${this.killed[0].base}をやっつけた！` : '魔物たちをやっつけた！');
      const same = (k) => rw.each.every((e) => e[k] === rw.each[0][k]);
      if (rw.each.length) {
        if (same('exp')) yield this.m(`${rw.each.length > 1 ? 'それぞれ' : ''}${rw.each[0].exp}ポイントの経験値を獲得！`);
        else for (const e of rw.each) yield this.m(`${e.u.name}は${e.exp}ポイントの経験値を獲得！`);
      }
      if (rw.gold > 0) {
        if (this.live && R.State && R.Game) R.State.addGold(rw.gold);
        yield this.m(`${rw.gold}ゴールドを手に入れた！`);
      }
      if (rw.each.length && rw.jp > 0) {
        if (same('jp')) yield this.m(`${rw.each.length > 1 ? 'それぞれ' : ''}${rw.each[0].jp}JPを獲得！`);
        else for (const e of rw.each) yield this.m(`${e.u.name}は${e.jp}JPを獲得！`);
      }
      yield { t: 'pause' };
      for (const e of rw.each) {
        const c = e.u.c;
        const before = R.Rules.stats(c);
        const lv0 = c.level;
        if (R.Rules.gainExp(c, e.exp) > 0) {
          const after = R.Rules.stats(c);
          e.u.refresh();
          yield { t: 'clear' };
          yield { t: 'jingle', id: 'levelup' };
          yield this.m(`${c.name}はレベル${c.level}に上がった！`);
          // stat gains, three per line: 「力+2　素早さ+1　体力+2」
          const gains = LEVEL_STATS.filter((k) => after[k] > before[k]).map((k) => `${NAMES.stat[k]}+${after[k] - before[k]}`);
          for (let i = 0; i < gains.length; i += 3) yield this.m(gains.slice(i, i + 3).join('　'));
          yield { t: 'pause', levels: c.level - lv0 };
        }
        const jr = R.Rules.gainJp(c, e.jp);
        if (jr.levelUps.length || jr.unlocked.length) {
          yield { t: 'clear' };
          yield { t: 'jingle', id: 'jobup' };
          for (const lu of jr.levelUps) yield this.m(`${c.name}の${(DB.jobs[lu.job] || {}).name || lu.job}のジョブレベルが${lu.level}に上がった！`);
          for (const j of jr.unlocked) yield this.m(`新しいジョブ『${(DB.jobs[j] || {}).name || j}』になれるようになった！`);
          yield { t: 'pause' };
        }
      }
      for (const d of rw.drops) {
        const it = DB.items[d.item];
        if (!it) continue;
        this.giveItem(d.item);
        if (this.live && R.State && R.Game) R.State.noteDrop(d.mon, d.rare ? 'rare' : 'drop');
        yield { t: 'clear' };
        if (d.rare) { yield { t: 'rare' }; yield this.m('★レアアイテム！'); }
        yield { t: 'gain', item: d.item, rare: d.rare };
        yield this.m(`${DB.monsters[d.mon].name}は${it.name}を落としていった！`);
        yield { t: 'pause' };
      }
    }

    /** bookkeeping once the battle is over (both real and simulated) */
    finish() {
      if (this.live && R.State && R.Game) for (const m of this.killed) R.State.killed(m.id);
      for (const p of this.party) {
        for (const s in p.c.status) if (s !== 'poison') delete p.c.status[s];
        if (p.c.hp <= 0) { p.c.hp = 0; p.c.status = {}; }
        R.Rules.clampHpMp(p.c);
      }
    }
  }

  const BATTLE_EFFECT = { damage: 1, heal: 1, healMp: 1, revive: 1, cure: 1, status: 1, buff: 1, dispel: 1, steal: 1, scan: 1, escape: 1, regen: 1, grow: 1, special: 1 };

  // ------------------------------------------------------------ monsters
  /** monster id list for a battle: {mons:[[id,n]|[id,min,max]]} | {troop} | {zone} (≤ 8) */
  function buildMons(o) {
    let spec = null;
    if (o.mons) spec = o.mons;
    else if (o.troop && DB.troops[o.troop]) spec = DB.troops[o.troop].mons;
    else if (o.zone && DB.encounters[o.zone]) {
      const z = DB.encounters[o.zone];
      if (z.groups && z.groups.length) spec = U.weighted(z.groups).mons;
    }
    const out = [];
    for (const e of spec || []) {
      const [id, a, b] = Array.isArray(e) ? e : [e, 1];
      if (!DB.monsters[id]) { R.warn('battle: unknown monster', id); continue; }
      const n = b != null ? U.ri(a, b) : a != null ? a : 1;
      for (let i = 0; i < n && out.length < 8; i++) out.push(id);
    }
    if (!out.length && spec) {
      const first = spec.map((e) => (Array.isArray(e) ? e[0] : e)).find((id) => DB.monsters[id]);
      if (first) out.push(first);
    }
    // keep each species together (display groups, 'group' targeting)
    const firstAt = {};
    out.forEach((id, i) => { if (!(id in firstAt)) firstAt[id] = i; });
    return out.map((id, i) => [firstAt[id], i, id]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
  }

  function drain(gen, sink) { for (const ev of gen) if (sink) sink(ev); }

  /**
   * Headless battle (balance tools). Uses clones of the party and inventory, the party AI
   * for the player side and the normal monster AI. Same resolution code as real battles.
   * o: {party:[chars] (default R.Game.party), inv, mons|troop|zone, maxRounds=50, seed,
   *     items:bool (let the AI use consumables), rewards:bool (apply EXP/JP to the clones),
   *     surprise:'pre'|'ambush'|null (default: rolled like a real battle), log:bool}
   * → {result:'win'|'lose'|'escape'|'timeout', rounds, partyHpPct, partyMpPct, deaths,
   *    damageDealt, damageTaken, killed, exp, gold, jp, party (clones after the fight), inv, log?}
   */
  function simulate(o) {
    o = o || {};
    const saved = U.rng;
    if (o.seed != null) U.seed(o.seed);
    try {
      const party = (o.party || (R.Game && R.Game.party) || []).map((c) => U.clone(c));
      const inv = U.clone(o.inv || (R.Game && R.Game.inv) || {});
      const troop = o.troop && DB.troops[o.troop];
      const eng = new Engine({
        party, mons: buildMons(o), inv, live: false,
        noEscape: !!(o.noEscape || (troop && troop.noEscape)), surprise: o.surprise,
      });
      const log = o.log ? [] : null;
      const sink = log ? (ev) => { if (ev.t === 'msg') log.push(ev.text); } : null;
      drain(eng.begin(), sink);
      const maxR = o.maxRounds || 50;
      while (!eng.result && eng.round < maxR) {
        const cmds = R.BattleAI && R.BattleAI.partyCommands ? R.BattleAI.partyCommands(eng, { items: !!o.items }) : [];
        drain(eng.playRound(cmds), sink);
      }
      if (eng.result === 'win' && o.rewards) drain(eng.rewards(), sink);
      const rw = eng.rewardInfo || eng.computeRewards();
      eng.finish();
      const sum = (k) => eng.party.reduce((s, p) => s + Math.max(0, p[k]), 0);
      const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
      return {
        result: eng.result || 'timeout',
        rounds: eng.round,
        partyHpPct: pct(sum('hp'), sum('mhp')),
        partyMpPct: pct(sum('mp'), sum('mmp')),
        deaths: eng.stats.deaths,
        damageDealt: eng.stats.dealt,
        damageTaken: eng.stats.taken,
        killed: eng.killed.length,
        mons: eng.mons.map((m) => m.id),
        exp: rw.exp, gold: rw.gold, jp: rw.jp,
        party, inv, log,
      };
    } finally { U.rng = saved; }
  }

  Object.assign(B, {
    Engine, Unit, PartyUnit, MonUnit, NAMES, BUFF_STATS, TIMED, BAD, STAGES, stageMult,
    MON_ATTACK_FX, WEAPON_FX, BATTLE_EFFECT, OFFHAND_MULT,
    buildMons, simulate, drain,
    /** registry for effect type 'special': B.specials[id] = function* (engine, user, target, eff, ctx) */
    specials: B.specials || {},
  });
})(window.RPG);
