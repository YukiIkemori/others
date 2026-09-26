// Battle UI fixture (bui A3): a small scripted stand-in for R.Battle.Engine.
// It has the shape the scene reads (§3.3.8: party / mons units, groups, unusable, attackIssue,
// repeatCommands, begin / playRound / rewards / finish generators) and yields the same event
// vocabulary, so tests and the gallery can drive every presentation deterministically — whatever
// state the real engine (battle A2) is in.
//
//   const eng = new R.bui.FakeEngine({party:[CharState], mons:[{id, name, sprite, hp, flags, golden}], inv, noEscape});
//   eng.script = {glimmer:[{round, idx, id}], drops:[{item, grade, mon}], ...}
(function (R) {
  'use strict';
  const DB = R.DB;
  const BUI = (R.bui = R.bui || {});
  const LETTERS = 'ＡＢＣＤＥＦＧＨ';

  class FUnit {
    constructor(side, key) {
      this.side = side; this.key = key;
      this.buffs = { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 };
      this.gone = false; this.defending = false;
    }
    get alive() { return this.hp > 0 && !this.gone; }
    get isParty() { return this.side === 'party'; }
    hpRate() { return this.mhp ? this.hp / this.mhp : 0; }
    disabled() { for (const s of ['sleep', 'paralyze', 'freeze', 'stun']) if (this.status[s]) return s; return null; }
    canAct() { return this.alive && !this.disabled(); }
    commandable() { return this.canAct() && !this.status.confuse; }
  }
  class FParty extends FUnit {
    constructor(c, i) {
      super('party', 'p' + i);
      this.c = c; this.idx = i;
      if (!c.status) c.status = {};
      let st = null;
      try { st = R.Rules && R.Rules.stats ? R.Rules.stats(c) : null; } catch (e) { st = null; }
      const mx = c._max || {};
      this.st = { hp: mx.hp || (st && st.hp) || c.hp || 1, mp: mx.mp != null ? mx.mp : (st && st.mp) || c.mp || 0, mods: (st && st.mods) || {} };
      this.permRegen = !!this.st.mods.regen;
    }
    get name() { return this.c.name; }
    get hp() { return this.c.hp; } set hp(v) { this.c.hp = v; }
    get mp() { return this.c.mp; } set mp(v) { this.c.mp = v; }
    get mhp() { return this.st.hp; } get mmp() { return this.st.mp; }
    get status() { return this.c.status; } set status(v) { this.c.status = v; }
    get mods() { return this.st.mods; }
    get boss() { return false; }
    get golden() { return false; }
    get row() { return this.c.row || 'front'; }
    flag() { return false; }
  }
  class FMon extends FUnit {
    constructor(e, i) {
      super('mon', 'm' + i);
      const base = (DB.monsters && DB.monsters[e.id]) || {};
      this.id = e.id; this.idx = i;
      this.d = Object.assign({ sprite: e.sprite || base.sprite || e.id }, base, e.d || {});
      if (e.sprite) this.d.sprite = e.sprite;
      this.golden = !!e.golden;
      this.base = e.name || (this.golden && R.Mon && R.Mon.goldenName && base.name ? R.Mon.goldenName(base) : base.name) || e.id;
      this.name = this.base;
      this.hp = this.mhp = e.hp || base.hp || 50;
      this.mp = this.mmp = 0;
      this.status = {};
      this.flags = (e.flags || base.flags || []).slice();
      if (this.golden) { this.d.golden = true; if (!this.flags.includes('golden')) this.flags.push('golden'); }
    }
    get species() { return this.id + (this.golden ? '*' : ''); }
    get mods() { return {}; }
    get boss() { return this.flags.includes('boss'); }
    get rare() { return this.flags.includes('rare'); }
    get metal() { return this.flags.includes('metal'); }
    flag(f) { return this.flags.includes(f); }
  }

  class FakeEngine {
    constructor(o) {
      this.o = o;
      this.inv = o.inv || {};
      this.party = o.party.map((c, i) => new FParty(c, i));
      this.mons = (o.mons || []).map((e, i) => new FMon(typeof e === 'string' ? { id: e } : e, i));
      this.relabel();
      this.boss = this.mons.some((m) => m.boss);
      this.noEscape = !!o.noEscape || this.boss;
      this.round = 0;
      this.result = null;
      this.surprise = null;
      this.killed = [];
      this.script = o.script || {};
      this.rounds = []; // cmds received per round (tests read this)
      this.finished = false;
    }
    relabel() {
      const by = {};
      for (const m of this.mons) (by[m.species] = by[m.species] || []).push(m);
      for (const k in by) by[k].forEach((m, i) => { m.name = by[k].length > 1 ? m.base + LETTERS[i] : m.base; });
    }
    groups(all) {
      const out = [], by = {};
      for (const m of this.mons) {
        if (!all && !m.alive) continue;
        let g = by[m.species];
        if (!g) { g = by[m.species] = { id: m.id, key: m.species, name: m.base, units: [], n: 0, golden: m.golden }; out.push(g); }
        g.units.push(m); g.n++;
      }
      return out;
    }
    effRow(u) {
      if ((u.c.row || 'front') !== 'middle') return 'front';
      return this.party.some((p) => p.alive && (p.c.row || 'front') !== 'middle') ? 'middle' : 'front';
    }
    attackIssue(u, slot) {
      const it = DB.items[(u.c.equip || {})[slot || 'weapon1']];
      const wt = DB.weaponTypes && DB.weaponTypes[it ? it.wtype : 'fist'];
      return this.effRow(u) === 'middle' && wt && wt.reach === false ? 'reach' : null;
    }
    /** the MP an action costs (techs and spells, A18) — battle_scene's weaponMenu calls eng.mpCost when present */
    mpCost(u, id) { return R.Rules && R.Rules.mpCost ? R.Rules.mpCost(u.c, id) : (DB.actions[id] || {}).mp || 0; }
    unusable(u, id, slot) {
      const a = DB.actions[id];
      if (!a) return 'none';
      if (a.kind === 'tech') {
        if (a.magic && u.status.silence) return 'silence';
        if (this.effRow(u) === 'middle' && !a.reach) return 'reach';
        if (u.mp < this.mpCost(u, id)) return 'mp';
      } else if (a.kind === 'spell') {
        if (u.status.silence) return 'silence';
        if (u.mp < this.mpCost(u, id)) return 'mp';
      }
      return null;
    }
    checkEnd() {
      if (this.result) return this.result;
      if (!this.party.some((p) => p.alive)) this.result = 'lose';
      else if (!this.mons.some((m) => m.alive)) this.result = 'win';
      return this.result;
    }
    m(text) { return { t: 'msg', text }; }
    *begin() {
      for (const g of this.groups()) {
        if (g.golden) yield { t: 'golden', u: g.units[0] };
        const d = g.units[0].d;
        if (g.n === 1 && d.appear) { yield this.m(d.appear); continue; }
        yield this.m(g.n > 1 ? `${g.name}が${g.n}匹現れた！` : `${g.name}が現れた！`);
      }
      if (this.o.surprise === 'pre') { this.surprise = 'pre'; yield this.m('魔物たちは、まだこちらに気づいていない。先手を取った！'); }
    }
    /** one scripted round: each party command acts (fixed damage), then every monster hits someone */
    *playRound(cmds) {
      if (this.result) return;
      this.round++;
      cmds = cmds || [];
      this.rounds.push(cmds);
      if (cmds.flee) {
        yield { t: 'actor', u: null };
        yield this.m(`${this.party[0].name}たちは逃げ出した。`);
        if (this.noEscape) { yield { t: 'escape', ok: false }; yield this.m('この戦いからは逃げられない！'); }
        else { this.result = 'escape'; yield { t: 'escape', ok: true }; return; }
      } else {
        for (const p of this.party) {
          if (this.checkEnd()) break;
          const c = cmds[p.idx];
          if (!c || !p.alive) continue;
          yield { t: 'actor', u: p };
          const g = (this.script.glimmer || []).find((x) => x.round === this.round && x.idx === p.idx);
          let cmd = c;
          if (g) {
            const a = DB.actions[g.id] || { name: g.id, kind: 'tech' };
            yield { t: 'glimmer', u: p, id: g.id, kind: a.kind === 'spell' ? 'spell' : 'tech' };
            yield this.m(`${p.name}は${a.name}を閃いた！`);
            cmd = { type: a.kind === 'spell' ? 'spell' : 'tech', id: g.id, target: c.target };
          }
          yield* this.act(p, cmd);
        }
      }
      for (const m of this.mons) {
        if (this.checkEnd() || !m.alive) continue;
        if (this.script.monsIdle) continue;
        const t = this.party.find((x) => x.alive);
        yield { t: 'actor', u: m };
        yield this.m(`${m.name}の攻撃！`);
        yield { t: 'fx', fx: 'claw', user: m, targets: [t], kind: 'attack' };
        const n = this.script.monDamage != null ? this.script.monDamage : 3;
        t.hp = Math.max(0, t.hp - n);
        yield { t: 'dmg', u: t, n, kind: 'phys' };
        yield this.m(`${t.name}に${n}のダメージ！`);
        if (t.hp <= 0) { yield { t: 'die', u: t }; yield this.m(`${t.name}は倒れた！`); }
      }
      this.checkEnd();
    }
    *act(p, c) {
      const foes = this.mons.filter((m) => m.alive);
      if (c.type === 'defend') { yield this.m(`${p.name}は守りを固めている。`); return; }
      const a = c.id ? DB.actions[c.id] || (DB.items[c.id] && DB.items[c.id].use) : null;
      if (c.type === 'item') { const it = DB.items[c.id]; if (this.inv[c.id]) this.inv[c.id]--; yield this.m(`${p.name}は${it ? it.name : c.id}を使った！`); }
      else if (c.type === 'spell') { yield this.m(`${p.name}は${a ? a.name : c.id}を唱えた！`); if (a) p.mp = Math.max(0, p.mp - this.mpCost(p, c.id)); }
      else if (c.type === 'tech') { yield this.m(`${p.name}の${a ? a.name : c.id}！`); if (a) p.mp = Math.max(0, p.mp - this.mpCost(p, c.id)); }
      else yield this.m(`${p.name}の攻撃！`);
      let t = c.target && c.target.alive ? c.target : foes[0];
      if (!t || t.isParty) { if (t && t.isParty) { yield { t: 'fx', fx: (a && a.fx) || 'heal', user: p, targets: [t], ab: a, kind: 'ability' }; yield { t: 'heal', u: t, n: 10 }; } return; }
      yield { t: 'fx', fx: c.type === 'attack' ? null : (a && a.fx) || 'slash', user: p, targets: [t], ab: a, kind: c.type === 'attack' ? 'attack' : 'ability', slot: c.slot };
      const n = this.script.partyDamage != null ? this.script.partyDamage : 12;
      t.hp = Math.max(0, t.hp - n);
      yield { t: 'dmg', u: t, n, kind: 'phys' };
      yield this.m(`${t.name}に${n}のダメージ！`);
      if (t.hp <= 0) { this.killed.push(t); yield { t: 'die', u: t }; yield this.m(`${t.name}は倒れた！`); }
    }
    /** リピート (the engine's rule in short: same action and target, a fallen target → the next living foe) */
    repeatCommands(prev) {
      const out = [];
      for (const p of this.party) {
        if (!p.commandable()) continue;
        const q = prev && prev[p.idx];
        const c = q ? Object.assign({}, q) : { type: 'attack', slot: 'weapon1', target: null };
        if (c.target && !c.target.alive && !c.target.isParty) c.target = this.mons.find((m) => m.alive) || null;
        out[p.idx] = c;
      }
      this.repeated = (this.repeated || 0) + 1;
      return out;
    }
    *rewards() {
      this.rewardInfo = { exp: 120, gold: 300 };
      yield { t: 'victory' };
      yield this.m('魔物たちを倒した！');
      yield this.m('それぞれ120の経験値を得た！');
      yield this.m('300ゴールドを手に入れた！');
      yield { t: 'pause' };
      for (const lu of this.script.levelUps || []) {
        const p = this.party[lu.idx];
        yield { t: 'clear' };
        yield { t: 'jingle', id: 'levelup' };
        yield { t: 'levelup', c: p.c, u: p, level: lu.level, gains: lu.gains || { hp: 14, mp: 2 } };
        yield this.m(`${p.name}はレベル${lu.level}に上がった！`);
        yield this.m('最大HP+14　最大MP+2');
        yield { t: 'pause' };
      }
      for (const d of this.script.drops || []) {
        const it = DB.items[d.item] || { name: d.item };
        const name = d.name || ((DB.monsters[d.mon] || {}).name) || d.mon;
        yield { t: 'clear' };
        yield { t: 'drop', mon: d.mon, name, item: d.item, grade: d.grade };
        yield this.m(`${name}は${d.grade !== 'normal' ? '★' : ''}${it.name}を残していった！`);
        if (d.grade === 'rare') yield this.m('レアアイテムだ！');
        if (d.grade === 'super') yield this.m('超レアアイテムだ！');
        yield { t: 'pause' };
      }
    }
    finish() { this.finished = true; }
  }
  BUI.FakeEngine = FakeEngine;
})(window.RPG);
