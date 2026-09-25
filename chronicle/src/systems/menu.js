// Field menu (DESIGN §8): the B-button command window with gold / play time /
// party / next-objective windows, plus the shared menu kit (screen base class,
// party picker, labels, drawing helpers) and the one helper that applies field
// effects of items and abilities (R.Menu.applyFieldEffect).
// Sub-screens live in menu_*.js; each registers itself on R.Menu at load time.
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  // ------------------------------------------------------------ labels
  const STAT_NAMES = {
    hp: '最大HP', mp: '最大MP', str: '力', vit: '体力', agi: '素早さ', int: '知力', mnd: '精神', luk: '運',
    atk: '攻撃力', def: '守備力', mag: '魔力', mdef: '魔法防御', hit: '命中', eva: '回避', crit: '会心',
  };
  const ELEM_NAMES = { fire: '炎', ice: '氷', thunder: '雷', wind: '風', earth: '大地', water: '水', holy: '聖', dark: '闇' };
  const STATUS_NAMES = { poison: '毒', sleep: '眠り', paralyze: '麻痺', confuse: '混乱', silence: '沈黙', blind: '暗闇', death: '即死', regen: '再生' };
  const KIND_NAMES = { action: 'アクション', reaction: 'リアクション', support: 'サポート', field: 'フィールド' };
  const KIND_COLORS = { action: '#ff9a5a', reaction: '#6fd8ff', support: '#8ce07a', field: '#e8c860' };
  const ELEMS = ['fire', 'ice', 'thunder', 'wind', 'earth', 'water', 'holy', 'dark'];

  const elemName = (e) => (DB.elements[e] && DB.elements[e].name) || ELEM_NAMES[e] || e;
  const statusName = (s) => (DB.statuses[s] && DB.statuses[s].name) || STATUS_NAMES[s] || s;
  const jobName = (j) => (DB.jobs[j] && DB.jobs[j].name) || '？？？';
  const itemName = (id) => (DB.items[id] && DB.items[id].name) || '？？？';
  const abName = (id) => (DB.abilities[id] && DB.abilities[id].name) || '？？？';

  // ------------------------------------------------------------ drawing kit
  const K = {
    STAT_NAMES, ELEM_NAMES, STATUS_NAMES, KIND_NAMES, KIND_COLORS, ELEMS,
    elemName, statusName, jobName, itemName, abName,

    /** text shrunk (never below 7px) so it fits maxW */
    fitText(str, x, y, maxW, opts) {
      const o = Object.assign({}, opts || {});
      const w = G().textWidth(str, o.size);
      if (w > maxW) o.size = Math.max(7, (o.size || G().FS) * maxW / w);
      G().text(str, x, y + (o.size && o.size < G().FS ? (G().FS - o.size) * 0.6 : 0), o);
    },
    /** 16x24 party sprite for member c in a job (or null if the art is missing) */
    sprite(c, job, dir, frame) {
      const key = 'party:' + c.id + ':' + (job || c.job);
      if (!G().has(key)) return null;
      const s = G().get(key);
      if (!s) return null;
      if (s.getContext || s.width) return s;
      const a = s[dir || 'down'] || s.down;
      return Array.isArray(a) ? a[(frame || 0) % a.length] : a;
    },
    /** draw a party sprite bottom-centred at (cx, bottom); fallback silhouette if no art */
    drawSprite(c, cx, bottom, opts) {
      const o = opts || {};
      const img = K.sprite(c, o.job, o.dir, o.frame);
      if (img) {
        if (o.dark) G().drawTinted(img, cx - (img.width >> 1), bottom - img.height, '#000000', o.darkAmt != null ? o.darkAmt : 0.85);
        else G().draw(img, cx - (img.width >> 1), bottom - img.height, o.alpha != null ? { alpha: o.alpha } : null);
        return;
      }
      const col = o.dark ? '#202028' : (DB.jobs[o.job || c.job] && DB.jobs[o.job || c.job].outfit && DB.jobs[o.job || c.job].outfit.main) || '#8090a0';
      G().rect(cx - 4, bottom - 22, 8, 8, o.dark ? '#202028' : '#f0c8a0');
      G().rect(cx - 5, bottom - 14, 10, 13, col);
    },
    iconKey(it) {
      if (!it) return null;
      switch (it.type) {
        case 'weapon': return it.wtype;
        case 'shield': return 'shield';
        case 'head': case 'body': return it.atype;
        case 'acc': return 'acc';
        case 'key': return 'key';
        case 'consumable': {
          const e = (it.use && it.use.effects) || [];
          return e.some((x) => x.type === 'heal' && !x.pct) && !e.some((x) => x.type === 'healMp') ? 'herb' : 'potion';
        }
      }
      return null;
    },
    drawIcon(it, x, y) {
      const k = K.iconKey(it);
      if (k && G().has('icon:' + k)) G().draw(G().get('icon:' + k), x, y);
    },
    /** item name with ★ for rare ones */
    itemLabel(id) { const it = DB.items[id]; return it ? it.name + (it.rare ? '★' : '') : '？？？'; },
    /** name colour by condition (DQ: orange when low, red when down) */
    condColor(c) {
      if (c.hp <= 0) return G().C.dead;
      const s = R.Rules.stats(c);
      if (c.hp <= s.hp / 4) return G().C.hpLow;
      if (c.status && c.status.poison) return G().C.purple;
      return G().C.white;
    },
    statusText(c) {
      if (c.hp <= 0) return { text: '戦闘不能', color: G().C.dead };
      const s = c.status || {};
      for (const k of ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind']) if (s[k]) return { text: statusName(k), color: G().C.purple };
      return null;
    },
    /** small HP/MP gauge */
    gauge(x, y, w, cur, max, color) {
      G().rect(x, y, w, 2, '#303048');
      G().rect(x, y, Math.round(w * U.clamp(max ? cur / max : 0, 0, 1)), 2, color);
    },
    /** right-aligned number with a small label on the left */
    labelNum(label, value, x, y, w, opts) {
      const o = opts || {};
      G().text(label, x, y, { color: o.labelColor || G().C.white });
      G().text(String(value), x + w, y, { align: 'right', color: o.color || G().C.white });
    },
    /** blinking left/right arrows around a header (member switch hint) */
    lrArrows(x1, x2, y) {
      if (Math.floor(R.Engine.frame / 20) % 2) return;
      for (let i = 0; i < 4; i++) {
        G().rect(x1 + i, y + 4 - i, 1, 1 + i * 2, '#ffffff');
        G().rect(x2 - i, y + 4 - i, 1, 1 + i * 2, '#ffffff');
      }
    },
    /** rectangle selection frame (grid cursors) */
    frame(x, y, w, h, color, blink) {
      if (blink && Math.floor(R.Engine.frame / 16) % 2) return;
      G().strokeRect(x, y, w, h, color || '#ffffff');
    },
    /** R.UI.say with explicit flags (a reused window would otherwise inherit noWait/auto) */
    say(text, opts) { return R.UI.say(text, Object.assign({ noWait: false, keep: false, auto: 0 }, opts)); },
    async msg(text) { await K.say(text); },
    async yesno(text) { const r = await R.UI.yesno(text); R.UI.closeMessage(); return r; },
    wrap(str, w, size) { return G().wrap(str, w, size); },
  };
  Menu.kit = K;

  // ------------------------------------------------------------ screen base
  /** A menu layer: input goes to input() unless an async flow is running. */
  class Screen extends R.Layer {
    constructor() { super(); this.busy = false; this.hidden = false; }
    update() { if (!this.busy && !this.closed) this.input(); }
    input() {}
    /** run an async sub-flow; input is ignored until it finishes */
    flow(fn) {
      if (this.busy) return;
      this.busy = true;
      Promise.resolve().then(() => fn.call(this)).catch((e) => R.Engine.reportError(e)).finally(() => {
        this.busy = false;
        R.Input.consume();
      });
    }
    draw() { if (!this.hidden) this.render(); }
    render() {}
  }
  K.Screen = Screen;

  // ------------------------------------------------------------ party picker
  class PickerLayer extends Screen {
    constructor(o) {
      super();
      this.o = o;
      this.party = R.Game.party;
      this.index = U.clamp(o.initial || 0, 0, this.party.length - 1);
      if (o.valid && !o.valid(this.party[this.index])) {
        const k = this.party.findIndex(o.valid);
        if (k >= 0) this.index = k;
      }
      this.w = 150; this.rowH = 30;
      this.h = 14 + this.party.length * this.rowH;
      this.x = o.x != null ? o.x : R.W - this.w - 6;
      this.y = o.y != null ? o.y : 50;
    }
    input() {
      const d = In().dirRepeat();
      const n = this.party.length;
      if (d === 'up' || d === 'down') {
        this.index = (this.index + (d === 'up' ? n - 1 : 1)) % n;
        R.sfx('cursor');
      }
      if (In().pressed('a')) {
        const c = this.party[this.index];
        if (this.o.valid && !this.o.valid(c)) { R.sfx('buzzer'); return; }
        R.sfx('confirm');
        this.close(this.index);
      } else if (In().pressed('b')) { R.sfx('cancel'); this.close(-1); }
    }
    render() {
      const { x, y, w, h } = this;
      G().window(x, y, w, h, { title: this.o.title });
      this.party.forEach((c, i) => {
        const ry = y + 8 + i * this.rowH;
        const ok = !this.o.valid || this.o.valid(c);
        if (this.o.mark === i) G().rect(x + 4, ry - 2, w - 8, this.rowH, '#23336e');
        const st = R.Rules.stats(c);
        K.drawSprite(c, x + 26, ry + 26, { frame: i === this.index ? Math.floor(R.Engine.frame / 16) : 0, alpha: ok ? 1 : 0.45 });
        const col = ok ? K.condColor(c) : G().C.gray;
        const stt = K.statusText(c);
        // long names shrink so they never run into the status label (e.g. 戦闘不能)
        K.fitText(c.name, x + 40, ry + 1, w - 50 - (stt ? G().textWidth(stt.text) + 4 : 0), { color: col });
        if (stt) G().text(stt.text, x + w - 10, ry + 1, { align: 'right', color: ok ? stt.color : G().C.gray });
        const tc = ok ? G().C.white : G().C.gray;
        G().text('H', x + 40, ry + 14, { color: tc });
        const hc = K.condColor(c);
        G().text(c.hp + '/' + st.hp, x + 92, ry + 14, { align: 'right', color: !ok ? tc : hc === G().C.purple ? G().C.white : hc });
        G().text('M', x + 97, ry + 14, { color: tc });
        G().text(String(c.mp), x + w - 10, ry + 14, { align: 'right', color: tc });
        K.gauge(x + 40, ry + 26, 52, c.hp, st.hp, c.hp <= st.hp / 4 ? '#ffb03c' : '#6ee07a');
        K.gauge(x + 97, ry + 26, 43, c.mp, st.mp, '#6fa8ff');
        if (i === this.index) G().cursor(x + 5, ry + 8, !this.busy);
      });
      if (this.o.info) this.o.info(x, y + h + 2);
    }
  }
  /** choose a party member → index or -1. o: {title, valid(c), initial, x, y, info(x,y)} */
  Menu.pickMember = (o) => R.Engine.run(new PickerLayer(o || {}));

  // ------------------------------------------------------------ field effects
  const targetsOf = (effects) => effects || [];
  const hasType = (effects, t) => targetsOf(effects).some((e) => e.type === t);

  /** amount of a heal effect in the field (matches battle when R.Battle.healAmount exists) */
  function healAmount(eff, user, target, isItem) {
    const st = R.Rules.stats(target);
    if (eff.pct) return Math.ceil(st.hp * eff.pct);
    if (R.Battle && typeof R.Battle.healAmount === 'function') {
      try {
        const v = R.Battle.healAmount(user, target, eff, { item: isItem, field: true });
        if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.round(v));
      } catch (e) { /* fall through */ }
    }
    const um = user ? R.Rules.mods(user) : {};
    const us = user ? R.Rules.stats(user) : { mnd: 0 };
    const scale = eff.scale != null ? eff.scale : isItem ? 0 : 0.6;
    const bonus = isItem ? (um.itemPct || 0) : (um.healPct || 0);
    return Math.max(1, Math.round(((eff.power || 0) + us.mnd * scale) * U.rf(0.95, 1.05) * (1 + bonus / 100)));
  }

  /** would effects change anything for c? (prevents wasting items) */
  function affects(effects, c) {
    const st = R.Rules.stats(c);
    for (const e of targetsOf(effects)) {
      switch (e.type) {
        case 'heal': if (c.hp > 0 && c.hp < st.hp) return true; break;
        case 'healMp': if (c.hp > 0 && c.mp < st.mp) return true; break;
        case 'revive': if (c.hp <= 0) return true; break;
        case 'cure': {
          const s = c.status || {};
          if (c.hp > 0 && (e.statuses === 'all' ? Object.keys(s).some((k) => s[k]) : (e.statuses || []).some((k) => s[k]))) return true;
          break;
        }
        case 'grow': if (c.hp > 0) return true; break;
        default: break;
      }
    }
    return false;
  }
  Menu.affects = affects;

  /**
   * Apply field effects (item or ability) of `def` ({effects, target}) used by
   * `user` on `targets` (array of chars). Handles heal/healMp/revive/cure/grow and
   * repel directly; teleport/exit are reported back (they need the menu closed).
   * → {lines:[text], changed:bool, teleport?:true, exit?:true}
   */
  Menu.applyFieldEffect = function (def, user, targets, opts) {
    const o = opts || {};
    const isItem = !!o.item;
    const effects = targetsOf(def && def.effects);
    const out = { lines: [], changed: false };
    const um = user ? R.Rules.mods(user) : {};
    const itemMul = isItem ? 1 + (um.itemPct || 0) / 100 : 1;
    for (const e of effects) {
      if (e.type === 'teleport') { out.teleport = true; continue; }
      if (e.type === 'exit') { out.exit = true; continue; }
      if (e.type === 'repel') {
        const steps = e.steps || 150;
        if (R.Field && R.Field.repel) R.Field.repel(steps); else R.Game.repelSteps = Math.max(R.Game.repelSteps || 0, steps);
        out.lines.push('魔物が寄りつかなくなった！');
        out.changed = true;
        continue;
      }
    }
    for (const c of targets || []) {
      for (const e of effects) {
        const st = R.Rules.stats(c);
        switch (e.type) {
          case 'heal': {
            if (c.hp <= 0 || c.hp >= st.hp) break;
            const before = c.hp;
            c.hp = Math.min(st.hp, c.hp + Math.round(healAmount(e, user, c, isItem)));
            const d = c.hp - before;
            out.lines.push(c.hp >= st.hp ? c.name + 'のHPが全回復した！' : c.name + 'のHPが' + d + '回復した！');
            out.changed = true;
            break;
          }
          case 'healMp': {
            if (c.hp <= 0 || c.mp >= st.mp) break;
            const before = c.mp;
            c.mp = Math.min(st.mp, c.mp + Math.round((e.power || 0) * itemMul));
            out.lines.push(c.mp >= st.mp ? c.name + 'のMPが全回復した！' : c.name + 'のMPが' + (c.mp - before) + '回復した！');
            out.changed = true;
            break;
          }
          case 'revive': {
            if (c.hp > 0) break;
            c.hp = Math.max(1, Math.floor(st.hp * (e.pct != null ? e.pct : 0.25)));
            c.status = {};
            out.lines.push('なんと、' + c.name + 'が生き返った！');
            out.changed = true;
            break;
          }
          case 'cure': {
            if (c.hp <= 0) break;
            const s = c.status || (c.status = {});
            const list = e.statuses === 'all' ? Object.keys(s) : (e.statuses || []);
            const cured = list.filter((k) => s[k]);
            if (!cured.length) break;
            for (const k of cured) delete s[k];
            out.lines.push(cured.length > 1 ? c.name + 'はすっかり元気になった！' : c.name + 'の' + statusName(cured[0]) + 'が治った！');
            out.changed = true;
            break;
          }
          case 'grow': {
            if (c.hp <= 0) break;
            const n = e.n || 1;
            const s0 = R.Rules.stats(c);
            R.Rules.grow(c, e.stat, n);
            const s1 = R.Rules.stats(c);
            if (e.stat === 'hp') c.hp = Math.min(s1.hp, c.hp + (s1.hp - s0.hp));
            if (e.stat === 'mp') c.mp = Math.min(s1.mp, c.mp + (s1.mp - s0.mp));
            const gain = e.stat === 'hp' || e.stat === 'mp' ? s1[e.stat] - s0[e.stat] || n : n;
            out.lines.push(c.name + 'の' + (STAT_NAMES[e.stat] || e.stat) + 'が' + gain + '上がった！');
            out.changed = true;
            break;
          }
          default: break;
        }
      }
    }
    return out;
  };

  // ------------------------------------------------------------ use flows
  const needsPick = (t) => t === 'ally' || t === 'ally_dead' || t === 'ally_any';
  function validFor(target, effects) {
    return (c) => {
      if (target === 'ally_dead') return c.hp <= 0;
      if (target === 'ally_any') return true;
      if (hasType(effects, 'revive') && !effects.some((e) => e.type !== 'revive')) return c.hp <= 0;
      return c.hp > 0;
    };
  }

  /** choose a teleport destination → location id or null */
  async function chooseTown() {
    const list = R.Field && R.Field.teleportList ? R.Field.teleportList() : [];
    if (!list.length) { await K.msg('飛んでいける場所がない！'); return null; }
    const i = await R.UI.choose(list.map((l) => l.name), { y: 40, title: 'どこへ行く？', rows: Math.min(list.length, 9) });
    return i < 0 ? null : list[i].id;
  }

  /** after the whole menu has closed: announce + teleport/exit on the field */
  function afterMenu(lines, act) {
    Menu._after = async () => {
      const run = async (ev) => {
        for (const l of lines) await K.say(l, { keep: true });
        R.UI.closeMessage();
        if (act.teleport && R.Field && R.Field.teleport) await R.Field.teleport(act.teleport);
        if (act.exit && R.Field && R.Field.exitDungeon) await R.Field.exitDungeon();
      };
      if (R.Events && R.Events.run) await R.Events.run(run, { self: 'menu' });
      else await run();
    };
  }

  /** who uses an item in the field: the living member with the best item bonus (else the leader) */
  function itemUser() {
    let best = R.State.leader(), bv = -1;
    for (const c of R.State.alive()) {
      const v = R.Rules.mods(c).itemPct || 0;
      if (v > bv) { bv = v; best = c; }
    }
    return bv > 0 ? best : R.State.leader();
  }
  Menu.itemUser = itemUser;

  /**
   * Field use of an inventory item. Returns 'exit' when the menu must close
   * (teleport / exit), true when something was used, false otherwise.
   */
  Menu.useItem = async function (id) {
    const it = DB.items[id];
    const u = it && it.use;
    if (!u || u.field === false || !(u.effects || []).length || (!u.field && u.battle)) {
      await K.msg(it && it.type === 'consumable' ? 'それは今は使えない。' : 'それは使うものではない。');
      return false;
    }
    const lead = itemUser();
    const eff = u.effects;
    if (hasType(eff, 'teleport') || hasType(eff, 'exit')) {
      const tp = hasType(eff, 'teleport');
      if (tp ? !(R.Field && R.Field.canTeleport && R.Field.canTeleport()) : !(R.Field && R.Field.canExit && R.Field.canExit())) {
        await K.msg('ここでは使えないようだ。');
        return false;
      }
      let loc = null;
      if (tp) { loc = await chooseTown(); if (!loc) return false; }
      R.State.removeItem(id, 1);
      afterMenu([lead.name + 'は' + it.name + 'を使った！'], tp ? { teleport: loc } : { exit: true });
      return 'exit';
    }
    if (hasType(eff, 'repel') && !needsPick(u.target)) {
      R.State.removeItem(id, 1);
      const r = Menu.applyFieldEffect(u, lead, [], { item: true });
      R.sfx('item');
      await K.msg(lead.name + 'は' + it.name + 'を使った！\n' + r.lines.join('\n'));
      return true;
    }
    if (!needsPick(u.target)) {
      const targets = u.target === 'self' ? [lead] : R.Game.party.slice();
      if (!targets.some((c) => affects(eff, c))) { await K.msg('今は使う必要がないようだ。'); return false; }
      R.State.removeItem(id, 1);
      const r = Menu.applyFieldEffect(u, lead, targets, { item: true });
      R.sfx(hasType(eff, 'revive') ? 'revive' : 'heal');
      await K.msg(lead.name + 'は' + it.name + 'を使った！\n' + r.lines.join('\n'));
      return true;
    }
    // pick a target, repeatedly while the item lasts (FF-style quick healing)
    let used = false, last = 0;
    const valid = validFor(u.target, eff);
    if (!R.Game.party.some((c) => valid(c) && affects(eff, c))) { await K.msg('今は使う必要がないようだ。'); return false; }
    for (;;) {
      if (!R.State.count(id)) break;
      const i = await Menu.pickMember({ title: it.name + ' ×' + R.State.count(id), valid, initial: last });
      if (i < 0) break;
      last = i;
      const c = R.Game.party[i];
      if (!affects(eff, c)) { R.sfx('buzzer'); await K.msg('今は使う必要がないようだ。'); continue; }
      R.State.removeItem(id, 1);
      const r = Menu.applyFieldEffect(u, lead, [c], { item: true });
      used = true;
      R.sfx(hasType(eff, 'revive') ? 'revive' : hasType(eff, 'grow') ? 'buff' : 'heal');
      await K.msg(lead.name + 'は' + it.name + 'を使った！\n' + r.lines.join('\n'));
    }
    return used;
  };

  /** can c use ability ab in the field right now? → '' or reason */
  Menu.abilityBlock = function (c, abId) {
    const ab = DB.abilities[abId];
    if (!ab) return '使えない';
    if (c.hp <= 0) return '倒れている';
    if (c.mp < R.Rules.mpCost(c, abId)) return 'MPが足りない';
    return '';
  };

  /** field use of an action ability by c → 'exit' | true | false */
  Menu.useAbility = async function (c, abId) {
    const ab = DB.abilities[abId];
    if (!ab) return false;
    const cost = R.Rules.mpCost(c, abId);
    const verb = ab.magic ? 'を唱えた！' : 'を使った！';
    const block = Menu.abilityBlock(c, abId);
    if (block) { R.sfx('buzzer'); await K.msg(block === 'MPが足りない' ? 'MPが足りない！' : c.name + 'は' + block + '。'); return false; }
    const eff = ab.effects || [];
    if (hasType(eff, 'teleport') || hasType(eff, 'exit')) {
      const tp = hasType(eff, 'teleport');
      if (tp ? !(R.Field && R.Field.canTeleport && R.Field.canTeleport()) : !(R.Field && R.Field.canExit && R.Field.canExit())) {
        await K.msg('ここでは使えないようだ。');
        return false;
      }
      let loc = null;
      if (tp) { loc = await chooseTown(); if (!loc) return false; }
      c.mp -= cost;
      afterMenu([c.name + 'は' + ab.name + verb], tp ? { teleport: loc } : { exit: true });
      return 'exit';
    }
    if (hasType(eff, 'repel') && !needsPick(ab.target)) {
      c.mp -= cost;
      const r = Menu.applyFieldEffect(ab, c, [], {});
      R.sfx('magic');
      await K.msg(c.name + 'は' + ab.name + verb + '\n' + r.lines.join('\n'));
      return true;
    }
    if (!needsPick(ab.target)) {
      const targets = ab.target === 'self' ? [c] : R.Game.party.slice();
      if (!targets.some((t) => affects(eff, t))) { await K.msg('今は使う必要がないようだ。'); return false; }
      c.mp -= cost;
      const r = Menu.applyFieldEffect(ab, c, targets, {});
      R.sfx(hasType(eff, 'revive') ? 'revive' : 'heal');
      await K.msg(c.name + 'は' + ab.name + verb + '\n' + r.lines.join('\n'));
      return true;
    }
    let used = false, last = R.Game.party.indexOf(c);
    const valid = validFor(ab.target, eff);
    if (!R.Game.party.some((t) => valid(t) && affects(eff, t))) { await K.msg('今は使う必要がないようだ。'); return false; }
    for (;;) {
      if (c.mp < cost || c.hp <= 0) break;
      const i = await Menu.pickMember({ title: ab.name + (cost ? ' MP' + cost : ''), valid, initial: last });
      if (i < 0) break;
      last = i;
      const t = R.Game.party[i];
      if (!affects(eff, t)) { R.sfx('buzzer'); await K.msg('今は使う必要がないようだ。'); continue; }
      c.mp -= cost;
      const r = Menu.applyFieldEffect(ab, c, [t], {});
      used = true;
      R.sfx(hasType(eff, 'revive') ? 'revive' : 'heal');
      await K.msg(c.name + 'は' + ab.name + verb + '\n' + r.lines.join('\n'));
    }
    return used;
  };

  // ------------------------------------------------------------ main menu
  const COMMANDS = [
    { id: 'items', label: '道具' }, { id: 'abilities', label: 'アビリティ' },
    { id: 'equip', label: '装備' }, { id: 'jobs', label: 'ジョブ' },
    { id: 'set', label: 'セット' }, { id: 'status', label: '強さ' },
    { id: 'order', label: '並び替え' }, { id: 'book', label: '図鑑' },
    { id: 'map', label: '地図' }, { id: 'save', label: 'セーブ' },
    { id: 'settings', label: '設定' },
  ];
  const onWorld = () => !!(R.Field && R.Field.map && R.Field.map.isWorld);
  let lastCmd = 0;

  class MainMenu extends Screen {
    constructor() {
      super();
      this.list = new R.UI.List({
        x: 4, y: 4, w: 150, cols: 2, rows: 6, padX: 15, index: lastCmd,
        items: COMMANDS.map((c) => ({ label: c.label, disabled: c.id === 'map' && !(onWorld() && R.Minimap && R.Minimap.open) })),
        onChange: (i) => { lastCmd = i; },
      });
    }
    input() {
      const r = this.list.update();
      if (r === 'cancel') this.close();
      else if (r === 'select') {
        const cmd = COMMANDS[this.list.index].id;
        lastCmd = this.list.index;
        this.flow(() => this.run(cmd));
      }
    }
    async run(cmd) {
      const screens = {
        items: Menu.itemScreen, abilities: Menu.abilityScreen, equip: Menu.equipScreen, jobs: Menu.jobScreen,
        set: Menu.setScreen, status: Menu.statusScreen, order: Menu.orderScreen, book: Menu.bookScreen,
        save: Menu.saveScreen, settings: Menu.settings,
      };
      if (cmd === 'map') {
        this.hidden = true;
        try { await R.Minimap.open(); } finally { this.hidden = false; }
        return;
      }
      const fn = screens[cmd];
      if (typeof fn !== 'function') { R.sfx('buzzer'); return; }
      this.hidden = true;
      let res;
      try { res = await fn({ fromMenu: true }); } finally { this.hidden = false; }
      if (res === 'exit' || Menu._after) this.close('exit');
    }
    render() {
      this.list.draw();
      const titled = !!R.Game.title;
      drawGold(4, 104, 150);
      drawParty(156, 4);
      drawObjective(4, titled ? 164 : 150, 248);
    }
  }

  function drawGold(x, y, w) {
    const title = R.Game.title; // 称号 earned in the post-game
    G().window(x, y, w, title ? 58 : 44);
    K.labelNum('ゴールド', R.Game.gold + ' G', x + 12, y + 8, w - 24);
    K.labelNum('プレイ時間', U.playTime(R.Game.playFrames || 0), x + 12, y + 22, w - 24);
    if (title) G().text('★' + title, x + 12, y + 36, { color: G().C.gold });
  }
  Menu.drawGold = drawGold;

  function drawParty(x, y) {
    const w = 96, h = 46;
    R.Game.party.forEach((c, i) => {
      const yy = y + i * (h + 2);
      G().window(x, yy, w, h);
      const col = K.condColor(c);
      G().text(c.name, x + 10, yy + 6, { color: col });
      G().text('Lv' + c.level, x + w - 9, yy + 6, { align: 'right', color: col });
      K.fitText(jobName(c.job), x + 10, yy + 19, w - 20, { color: G().C.cyan });
      G().text('H', x + 10, yy + 32, { color: col });
      G().text(String(c.hp), x + 45, yy + 32, { align: 'right', color: col });
      G().text('M', x + 51, yy + 32, { color: col });
      G().text(String(c.mp), x + w - 9, yy + 32, { align: 'right', color: col });
    });
  }
  Menu.drawParty = drawParty;

  function objectiveText() {
    const o = DB.objectives && R.Game.objective && DB.objectives[R.Game.objective];
    return o && o.text ? String(o.text) : '';
  }
  function drawObjective(x, y, w) {
    const t = objectiveText();
    if (!t) return;
    const lines = G().wrap(t, w - 22).slice(0, 4);
    G().window(x, y, w, 16 + lines.length * 14 - 2 + 2, { title: '次の目的' });
    lines.forEach((l, i) => G().text(l, x + 11, y + 9 + i * 14));
  }

  // ------------------------------------------------------------ public API
  let opened = null; // the live MainMenu layer
  /** open the field menu (B on the field); resolves when it closes */
  Menu.open = async function () {
    if ((opened && R.Engine.layers.includes(opened)) || !R.Game) return;
    Menu._after = null;
    R.sfx('menu_open');
    const L = (opened = new MainMenu());
    try {
      await R.Engine.run(L);
    } finally { if (opened === L) opened = null; }
    const after = Menu._after;
    Menu._after = null;
    if (after) await after();
  };
  Menu.isOpen = () => !!(opened && R.Engine.layers.includes(opened));
})(window.RPG);
